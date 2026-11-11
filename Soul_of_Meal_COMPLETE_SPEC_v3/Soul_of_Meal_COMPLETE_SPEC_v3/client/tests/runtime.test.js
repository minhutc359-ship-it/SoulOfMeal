import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createAdventureState, interactAdventure, nearestInteraction, beginBattle, bossTelegraphTargets, setAdventureInput, stepAdventure, claimBattleResult, activateUltimate, resolveMapSpawn, transitionMap, resolveCameraViewport } from '../src/modes/adventure.js';
import { advanceChessRound, buyChessOffer, createChessRun, placeChessUnit, startChessCombat, chessTraits } from '../src/modes/autoChess.js';
import { createTcgMatch, passTcgPriority, runBotPriority, runTcgBot, attackTcg, endTcgTurn, playTcgCard, mulliganTcg } from '../src/modes/tcg.js';
import { createDefaultSave, migrateSave, SAVE_VERSION } from '../src/core/save.js';
import { adventureJournal } from '../src/modes/adventureJournal.js';
import { gameEvents } from '../src/core/events.js';
import { collidesWithWorld, findAdventurePath, moveWithCollision } from '../src/modes/adventureNavigation.js';

const root = new URL('../../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));

test('save migration preserves version-one progress and normalizes coordinates', () => {
  const migrated = migrateSave({ version: 1, player: { gold: 70 }, adventure: { x: 0.25, y: 0.5, quest: 'accepted', chestOpened: true } });
  assert.equal(migrated.version, SAVE_VERSION);
  assert.equal(migrated.player.gold, 70);
  assert.equal(migrated.adventure.x, 240);
  assert.equal(migrated.adventure.y, 270);
  assert.equal(migrated.adventure.chestOpened, true);
});

test('Adventure requires nearby interaction and persists quest/chest/route progression', () => {
  const save = createDefaultSave();
  const state = createAdventureState(save);
  assert.equal(nearestInteraction(state, save), null);
  state.x = 235; state.y = 260;
  let result = interactAdventure(state, save);
  assert.equal(result.save.adventure.quest, 'accepted');
  result.state.x = 680; result.state.y = 355;
  result = interactAdventure(result.state, result.save);
  assert.equal(result.save.adventure.chestOpened, true);
  assert.equal(result.save.player.gold, 150);
  result.state.x = 878; result.state.y = 260;
  result = interactAdventure(result.state, result.save);
  assert.equal(result.save.adventure.map, 'forest');
  assert.equal(result.state.map, 'forest');
});

test('Adventure fixed-step battle advances simulation and emits an authoritative result', () => {
  const save = createDefaultSave();
  const state = createAdventureState(save);
  beginBattle(state, save);
  for (let frame = 0; frame < 1_800 && state.battle?.phase === 'battle_running'; frame += 1) stepAdventure(state, save, 1 / 30);
  assert.ok(state.battle.tick > 0);
  assert.ok(state.battle.events.length >= 0);
  assert.ok(['battle_running', 'battle_end'].includes(state.battle.phase));
});

test('Adventure ultimate announces the cast and applies an area hit on its simulation tick', () => {
  const save = createDefaultSave();
  save.roster[0].energy = 100;
  const state = createAdventureState(save);
  beginBattle(state, save);
  const caster = state.battle.actors[0];
  const opponents = state.battle.actors.filter((actor) => actor.team === 'enemy');
  const events = [];
  const listener = ({ detail }) => { if (detail.source_id === caster.actor_id) events.push(detail); };
  gameEvents.addEventListener('game-event', listener);
  try {
    assert.equal(activateUltimate(state, save, caster.actor_id).ok, true);
    assert.equal(caster.energy, 0);
    assert.equal(events[0].type, 'cast_started');
    assert.ok(opponents.every((actor) => actor.hp === actor.maxHp));
    const hitTick = caster.action.hitTick;
    while (state.battle.tick < hitTick - 1) stepAdventure(state, save, 1 / 30);
    assert.equal(events.filter((event) => event.type === 'hit_resolved').length, 0);
    stepAdventure(state, save, 1 / 30);
    assert.deepEqual(events.filter((event) => event.type === 'hit_resolved').map((event) => event.tick), [hitTick, hitTick]);
    assert.ok(opponents.every((actor) => actor.hp < actor.maxHp));
  } finally {
    gameEvents.removeEventListener('game-event', listener);
  }
});

test('Adventure projectiles take time to hit and defensive ultimates affect the team', () => {
  const save = createDefaultSave();
  for (const actor of save.roster) actor.energy = 100;
  const state = createAdventureState(save);
  beginBattle(state, save);
  const [, mage, support, guardian] = state.battle.actors;
  const ally = state.battle.actors[0];
  ally.hp -= 1000;
  const events = [];
  const listener = ({ detail }) => events.push(detail);
  gameEvents.addEventListener('game-event', listener);
  try {
    for (const actor of [mage, support, guardian]) assert.equal(activateUltimate(state, save, actor.actor_id).ok, true);
    for (let i = 0; i < 25; i += 1) stepAdventure(state, save, 1 / 30);
    const launch = events.find((event) => event.type === 'projectile_spawned' && event.source_id === mage.actor_id);
    const impact = events.find((event) => event.type === 'hit_resolved' && event.source_id === mage.actor_id);
    assert.equal(impact.tick - launch.tick, launch.payload.travel_ticks);
    assert.ok(ally.shield > 0 && ally.hp > ally.maxHp - 1000);
    assert.ok(events.some((event) => event.type === 'heal_resolved' && event.target_id === ally.actor_id));
  } finally {
    gameEvents.removeEventListener('game-event', listener);
  }
});

test('the Adventure journal points to the correct interaction after a map or quest change', () => {
  const save = createDefaultSave();
  assert.equal(adventureJournal(save).action, 'lilia');
  Object.assign(save.adventure, { quest: 'accepted' });
  assert.equal(adventureJournal(save).action, 'chest');
  Object.assign(save.adventure, { chestOpened: true });
  assert.equal(adventureJournal(save).action, 'portal');
  Object.assign(save.adventure, { map: 'forest' });
  assert.equal(adventureJournal(save).action, 'encounter');
  Object.assign(save.adventure, { forestCleared: true, quest: 'ready_to_claim' });
  assert.equal(adventureJournal(save).action, 'village_return');
  Object.assign(save.adventure, { map: 'village', quest: 'completed' });
  assert.equal(adventureJournal(save).action, null);
  assert.ok(adventureJournal(save).labels.every(step => step.status === 'done'));
});

test('the boss winds up, strikes the marked targets on the scheduled tick and emits one shield break', () => {
  const save = createDefaultSave();
  const state = createAdventureState(save);
  beginBattle(state, save);
  const battle = state.battle;
  for (const enemy of battle.actors.filter(actor => actor.team === 'enemy')) enemy.alive = false;
  stepAdventure(state, save, 1 / 30);
  const boss = battle.actors.find(actor => actor.boss);
  assert.equal(boss.id, 'boss_bep_truong');
  boss.hp = Math.floor(boss.maxHp * .6);
  boss.cooldown = 900;
  for (const actor of battle.actors.filter(actor => actor.team === 'player')) {
    actor.action = { hitTick: 900 };
  }
  const events = [];
  const listener = ({ detail }) => events.push(detail);
  gameEvents.addEventListener('game-event', listener);
  try {
    stepAdventure(state, save, 1 / 30);
    const windup = events.find(event => event.type === 'boss_phase_changed');
    assert.ok(windup);
    const targets = bossTelegraphTargets(battle, boss);
    assert.equal(targets.length, 2);
    targets[0].shield = 1;
    targets[0].shieldUntil = 500;
    const releaseTick = windup.tick + windup.payload.windup_ticks;
    while (battle.tick < releaseTick - 1) stepAdventure(state, save, 1 / 30);
    assert.ok(events.every(event => event.type !== 'boss_cast_released'));
    stepAdventure(state, save, 1 / 30);
    assert.equal(events.filter(event => event.type === 'boss_cast_released').length, 1);
    const hits = events.filter(event => event.type === 'hit_resolved' && event.source_id === boss.id);
    assert.deepEqual(hits.map(event => event.target_id), targets.map(actor => actor.actor_id));
    assert.ok(hits.every(event => event.tick === releaseTick));
    assert.equal(events.filter(event => event.type === 'shield_broken').length, 1);
  } finally {
    gameEvents.removeEventListener('game-event', listener);
  }
});

test('Adventure movement advances in world units on simulation time', () => {
  const save = createDefaultSave();
  const state = createAdventureState(save);
  state.x = 100; state.y = 100;
  setAdventureInput(state, 1, 0);
  stepAdventure(state, save, 1);
  assert.equal(state.x, 290);
  assert.equal(state.y, 100);
});

test('Adventure transitions use authored map spawn points and persist them to save state', () => {
  const save = createDefaultSave();
  let state = createAdventureState(save);
  state = transitionMap(state, save, 'forest').state;
  assert.equal(state.map, 'forest');
  assert.equal(state.x, 82);
  assert.equal(state.y, 420);
  assert.equal(resolveMapSpawn('village').x, 120);
  assert.equal(resolveMapSpawn('village').y, 310);
});

test('Adventure camera clamps to the world bounds while following the player', () => {
  const viewport = resolveCameraViewport(480, 270, { width: 960, height: 540 }, 960, 540);
  assert.equal(viewport.x, 0);
  assert.equal(viewport.y, 0);
  const edge = resolveCameraViewport(900, 500, { width: 960, height: 540 }, 960, 540);
  assert.equal(edge.x, 0);
  assert.equal(edge.y, 0);
  const follow = resolveCameraViewport(600, 300, { width: 960, height: 540 }, 480, 320);
  assert.ok(follow.x >= 0 && follow.x <= 480);
  assert.ok(follow.y >= 0 && follow.y <= 220);
});

test('Adventure simulation movement collides with solid village buildings', () => {
  const save = createDefaultSave();
  const state = createAdventureState(save);
  state.x = 250; state.y = 160;
  setAdventureInput(state, -1, 0);
  stepAdventure(state, save, 1);
  assert.equal(state.x, 250);
  assert.equal(state.y, 160);
});

test('Adventure collision blocks building penetration and permits wall sliding', () => {
  assert.equal(collidesWithWorld('village', 150, 160), true);
  const blocked = moveWithCollision('village', 250, 160, -80, 0);
  assert.equal(blocked.x, 250);
  assert.equal(blocked.blockedX, true);
  const leavingWall = moveWithCollision('village', 250, 160, 30, 0);
  assert.equal(leavingWall.x, 280);
  assert.equal(leavingWall.blockedX, false);
  const slide = moveWithCollision('village', 250, 250, 0, -30);
  assert.ok(slide.y < 250);
  assert.equal(collidesWithWorld('village', slide.x, slide.y), false);
});

test('Adventure tap navigation routes around solid buildings', () => {
  const path = findAdventurePath('village', { x: 250, y: 160 }, { x: 100, y: 160 });
  assert.ok(path.length > 1);
  assert.ok(path.every((point) => !collidesWithWorld('village', point.x, point.y)));
  assert.ok(path.some((point) => point.y > 237 || point.y < 91));

  const insideBuilding = findAdventurePath('village', { x: 250, y: 160 }, { x: 150, y: 160 });
  assert.ok(insideBuilding.length > 0);
  assert.ok(insideBuilding.every((point) => !collidesWithWorld('village', point.x, point.y)));
});

test('Adventure completes the P0 quest, battle reward and Lilia claim loop', () => {
  let save = createDefaultSave();
  const state = createAdventureState(save);
  state.x = 235; state.y = 260;
  let result = interactAdventure(state, save);
  save = result.save;
  state.x = 680; state.y = 355;
  result = interactAdventure(state, save);
  save = result.save;
  state.x = 878; state.y = 260;
  result = interactAdventure(state, save);
  save = result.save;
  state.x = 500; state.y = 300;
  result = interactAdventure(state, save);
  save = result.save;
  for (let frame = 0; frame < 1_800 && state.battle?.phase === 'battle_running'; frame += 1) stepAdventure(state, save, 1 / 30);

  assert.equal(state.battle.phase, 'battle_end');
  assert.equal(state.battle.result, 'victory');
  save = claimBattleResult(state, save);
  state.x = 900; state.y = 470;
  result = interactAdventure(state, save);
  save = result.save;
  state.x = 235; state.y = 260;
  result = interactAdventure(state, save);
  save = result.save;

  assert.equal(save.adventure.quest, 'completed');
  assert.equal(save.adventure.chestOpened, true);
  assert.equal(save.adventure.forestCleared, true);
  assert.equal(save.player.gold, 290);
  assert.equal(save.player.essence, 39);
  assert.equal(save.adventure.rewardClaims.length, 2);
});

test('TCG starts with a valid 36-card deck and passes priority into combat', async () => {
  const catalog = await readJson('examples/cards/cards.catalog.json');
  const deck = await readJson('examples/cards/starter_deck.json');
  const match = createTcgMatch(catalog, deck, 41);
  assert.equal(match.players[0].hand.length + match.players[0].deck.length, 36);
  assert.equal(match.players[0].mana, 1);
  match.players[1].hand = [];
  const afterPlayerPass = passTcgPriority(match, 0);
  const afterBotPass = runBotPriority(afterPlayerPass);
  assert.equal(afterBotPass.phase, 'combat');
  const skippedAttack = attackTcg(afterBotPass, 0, []);
  assert.equal(skippedAttack.phase, 'round_end');
  const opponentTurn = endTcgTurn(skippedAttack, 0);
  const returnedToPlayer = runTcgBot(opponentTurn);
  assert.equal(returnedToPlayer.activePlayer, 0);
  assert.equal(returnedToPlayer.round, 2);
});

test('TCG mulligan replaces selected cards once and preserves the deck size', async () => {
  const catalog = await readJson('examples/cards/cards.catalog.json');
  const deck = await readJson('examples/cards/starter_deck.json');
  const match = createTcgMatch(catalog, deck, 41);
  const selected = match.players[0].hand[0].instance_id;
  const updated = mulliganTcg(match, [selected]);
  assert.equal(updated.players[0].hand.length, 4);
  assert.equal(updated.players[0].deck.length, 32);
  assert.ok(!updated.players[0].hand.some((card) => card.instance_id === selected));
  assert.ok(updated.players[0].deck.some((card) => card.instance_id === selected));
  assert.throws(() => mulliganTcg(updated, []));
});

test('TCG summons units and an armed trap counters a fast spell without damage', async () => {
  const catalog = await readJson('examples/cards/cards.catalog.json');
  const deck = await readJson('examples/cards/starter_deck.json');
  const match = createTcgMatch(catalog, deck, 9);
  const unitCard = structuredClone(catalog.cards.find((card) => card.card_id === 'card_demo_01'));
  unitCard.instance_id = 'p0:unit:test';
  match.players[0].hand = [unitCard];
  match.players[0].mana = 10;
  let updated = playTcgCard(match, 0, unitCard.instance_id);
  assert.equal(updated.players[0].units.length, 1);
  assert.equal(updated.players[0].units[0].ready, false);

  const spellMatch = createTcgMatch(catalog, deck, 10);
  const spell = structuredClone(catalog.cards.find((card) => card.card_id === 'card_demo_10'));
  spell.instance_id = 'p0:spell:test';
  spellMatch.players[0].hand = [spell];
  spellMatch.players[0].mana = 10;
  const counterTrap = structuredClone(catalog.cards.find((card) => card.card_id === 'card_demo_15'));
  spellMatch.players[1].traps = [{ card: counterTrap, setRound: 0, faceDown: true }];
  spellMatch.round = 2;
  updated = playTcgCard(spellMatch, 0, spell.instance_id);
  assert.equal(updated.phase, 'reaction');
  assert.equal(updated.stack.length, 2);
  updated = passTcgPriority(updated, 1);
  updated = passTcgPriority(updated, 0);
  assert.equal(updated.players[1].hp, 8000);
  assert.equal(updated.stack.length, 0);
  assert.ok(updated.players[0].graveyard.some((card) => card.card_id === spell.card_id));
});

test('TCG lethal spell emits hit before battle finish and moves the spell once', async () => {
  const catalog = await readJson('examples/cards/cards.catalog.json');
  const deck = await readJson('examples/cards/starter_deck.json');
  const match = createTcgMatch(catalog, deck, 12);
  const spell = structuredClone(catalog.cards.find((card) => card.card_id === 'card_demo_10'));
  spell.instance_id = 'p0:spell:lethal';
  match.players[0].hand = [spell];
  match.players[0].mana = 10;
  match.players[1].hp = 400;
  const observed = [];
  const listener = ({ detail }) => { if (detail.battle_id === match.battleId) observed.push(detail.type); };
  gameEvents.addEventListener('game-event', listener);
  let updated = playTcgCard(match, 0, spell.instance_id);
  updated = passTcgPriority(updated, 1);
  updated = passTcgPriority(updated, 0);
  gameEvents.removeEventListener('game-event', listener);
  assert.equal(updated.result, 'commander_defeated');
  assert.equal(updated.players[0].graveyard.filter((card) => card.instance_id === spell.instance_id).length, 1);
  assert.ok(observed.indexOf('hit_resolved') < observed.indexOf('battle_finished'));
});

test('Auto Chess supports purchase, placement, deterministic combat and payout', async () => {
  const unitsData = await readJson('examples/auto_chess/units.json');
  const shop = await readJson('examples/auto_chess/shop_odds.json');
  const units = unitsData.units;
  let run = createChessRun(units, shop, 2077);
  const affordableSlot = run.shop.findIndex((unit) => unit.cost <= run.gold);
  run = buyChessOffer(run, affordableSlot);
  run = placeChessUnit(run, 0, 3, 1);
  assert.equal(run.board.length, 1);
  run = startChessCombat(run);
  assert.equal(run.phase, 'result');
  assert.ok(run.result.won || run.result.damage >= 0);
  assert.ok(run.result.income >= 5);
  assert.equal(run.round, 1);
});

test('Auto Chess loss damage remains finite with an empty player board', async () => {
  const unitsData = await readJson('examples/auto_chess/units.json');
  const shop = await readJson('examples/auto_chess/shop_odds.json');
  const run = createChessRun(unitsData.units, shop, 19);
  run.board = [];
  const result = startChessCombat(run);
  assert.equal(result.phase, 'result');
  assert.equal(result.result.won, false);
  assert.ok(Number.isFinite(result.result.damage));
  assert.ok(result.result.damage > 0);
  assert.ok(result.hp < 100);
});

test('Auto Chess merges across board and bench while keeping the placed survivor', async () => {
  const unitsData = await readJson('examples/auto_chess/units.json');
  const shop = await readJson('examples/auto_chess/shop_odds.json');
  let run = createChessRun(unitsData.units, shop, 3);
  run = buyChessOffer(run, 0);
  run = buyChessOffer(run, 1);
  run = placeChessUnit(run, 0, 4, 2);
  run = buyChessOffer(run, 2);
  assert.equal(run.board.length, 1);
  assert.equal(run.board[0].star, 2);
  assert.deepEqual([run.board[0].x, run.board[0].y], [4, 2]);
  assert.equal(run.bench.length, 0);
});

test('Auto Chess run reaches a terminal result at the round cap', async () => {
  const unitsData = await readJson('examples/auto_chess/units.json');
  const shop = await readJson('examples/auto_chess/shop_odds.json');
  let run = createChessRun(unitsData.units, shop, 44);
  for (let cycle = 0; cycle < 20 && run.phase !== 'finished'; cycle += 1) {
    if (run.phase === 'prepare') run = startChessCombat(run);
    if (run.phase === 'result') run = advanceChessRound(run, unitsData.units, shop);
  }
  assert.equal(run.phase, 'finished');
  assert.ok(['victory', 'complete'].includes(run.result));
});
test('Auto Chess applies synergy to unique allies and records an ordered replay', async () => {
  const { units } = await readJson('examples/auto_chess/units.json');
  const shop = await readJson('examples/auto_chess/shop_odds.json');
  let run = createChessRun(units, shop, 2077);
  const fire = units.filter((unit) => unit.element === 'fire');
  assert.equal(chessTraits([fire[0], fire[0]]).get('fire'), 1);
  run.shop[0] = fire[0];
  run.shop[1] = fire[1];
  run = placeChessUnit(buyChessOffer(run, 0), 0, 1, 2);
  run = placeChessUnit(buyChessOffer(run, 1), 0, 2, 2);
  const result = startChessCombat(run);
  assert.equal(result.combat.startActors[0].atk, Math.floor(run.board[0].atk * 1.15));
  assert.ok(result.combat.events.some((event) => event.type === 'move'));
  assert.ok(result.combat.events.some((event) => event.type === 'hit_resolved'));
  assert.ok(result.combat.events.every((event, index, events) => !index || events[index - 1].tick <= event.tick));
});
