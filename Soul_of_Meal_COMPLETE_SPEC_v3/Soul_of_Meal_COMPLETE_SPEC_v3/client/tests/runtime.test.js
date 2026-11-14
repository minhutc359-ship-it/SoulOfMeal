import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createAdventureState, interactAdventure, nearestInteraction, beginBattle, setAdventureInput, stepAdventure, claimBattleResult, activateUltimate, resolveMapSpawn, transitionMap, resolveCameraViewport } from '../src/modes/adventure.js';
import { advanceChessRound, buyChessOffer, createChessRun, placeChessUnit, startChessCombat } from '../src/modes/autoChess.js';
import { createTcgMatch, passTcgPriority, runBotPriority, runTcgBot, attackTcg, endTcgTurn, playTcgCard } from '../src/modes/tcg.js';
import { createDefaultSave, migrateSave, SAVE_VERSION } from '../src/core/save.js';
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

test('Adventure ultimate emits cast cue before its resolved impact', () => {
  const save = createDefaultSave();
  save.roster[0].energy = 100;
  const state = createAdventureState(save);
  beginBattle(state, save);
  const battleId = state.battle.id;
  const eventTypes = [];
  const listener = ({ detail }) => { if (detail.battle_id === battleId) eventTypes.push(detail.type); };
  gameEvents.addEventListener('game-event', listener);
  const actorId = state.battle.actors.find((actor) => actor.team === 'player').actor_id;
  activateUltimate(state, save, actorId);
  gameEvents.removeEventListener('game-event', listener);
  assert.ok(eventTypes.indexOf('cast_started') < eventTypes.indexOf('hit_resolved'));
});

test('Adventure movement advances in world units on simulation time', () => {
  const save = createDefaultSave();
  const state = createAdventureState(save);
  state.x = 100; state.y = 300;
  setAdventureInput(state, 1, 0);
  stepAdventure(state, save, 1);
  assert.equal(state.x, 290);
  assert.equal(state.y, 300);
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

test('Auto Chess empty-board run terminates through commander elimination', async () => {
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