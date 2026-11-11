import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createAdventureState, interactAdventure, nearestInteraction, beginBattle, bossTelegraphTargets, focusBossStove, setAdventureInput, stepAdventure, claimBattleResult, leaveAdventureDefeat, activateUltimate, activateLanternWard, resolveMapSpawn, transitionMap, resolveCameraViewport } from '../src/modes/adventure.js';
import { advanceChessRound, benchChessUnit, buyChessOffer, createChessRun, nextChessOpponent, placeChessUnit, startChessCombat, chessTraits } from '../src/modes/autoChess.js';
import { createTcgMatch, passTcgPriority, runBotPriority, runTcgBot, attackTcg, endTcgTurn, playTcgCard, mulliganTcg, surrenderTcg } from '../src/modes/tcg.js';
import { createDefaultSave, migrateSave, SAVE_VERSION } from '../src/core/save.js';
import { adventureJournal } from '../src/modes/adventureJournal.js';
import { FOREST_CLUE_IDS } from '../src/modes/adventureStory.js';
import { adventureSpiritStats, changeSpiritProgress, spiritProfile } from '../src/modes/spiritProgress.js';
import { createAdventureMapRegistry, getAdventureMap } from '../src/modes/mapCatalog.js';
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

test('Adventure spirit rank, gear and bond survive save migration and affect only their intended stats', () => {
  let save = createDefaultSave();
  const [hero, ally] = save.roster;
  const action = (type, id = hero.id, gearId) => { save = changeSpiritProgress(save, { type, id, gearId }); };
  assert.equal(spiritProfile(save, hero.id).rank, 1);
  assert.throws(() => changeSpiritProgress(save, { type: 'rank', id: hero.id }, true), /kết thúc trận/);
  action('rank');
  assert.equal(save.player.gold, 60);
  assert.equal(save.player.essence, 21);
  assert.throws(() => action('rank'), /Không đủ/);
  save.player.gold += 200;
  action('craft', hero.id, 'spice_blade');
  assert.throws(() => action('craft', hero.id, 'spice_blade'), /không thể chế tác/);
  action('equip', hero.id, 'spice_blade');
  assert.throws(() => action('equip', ally.id, 'spice_blade'), /Hãy tháo/);
  action('unequip', hero.id, 'spice_blade');
  action('equip', ally.id, 'spice_blade');
  action('gift');
  action('gift');
  save = migrateSave(JSON.parse(JSON.stringify(save)));
  assert.deepEqual(spiritProfile(save, hero.id), { rank: 2, bond: 2, equipped: [] });
  assert.deepEqual(spiritProfile(save, ally.id).equipped, ['spice_blade']);
  const trained = adventureSpiritStats(save.roster[0], spiritProfile(save, hero.id));
  assert.deepEqual([trained.maxHp, trained.atk, trained.def], [3240, 342, 105]);
  assert.equal(adventureSpiritStats(save.roster[1], spiritProfile(save, ally.id)).atk, 418);
  assert.deepEqual(save.roster, [hero, ally, ...createDefaultSave().roster.slice(2)]);
  assert.deepEqual(save.modes, { tcg: null, chess: null });

  save.adventure.spirits.profiles[hero.id].equipped = ['spice_blade', 'unknown'];
  const repaired = migrateSave(save);
  assert.deepEqual(spiritProfile(repaired, hero.id).equipped, ['spice_blade']);
  assert.deepEqual(spiritProfile(repaired, ally.id).equipped, []);
});

test('Adventure battle uses ranked and equipped stats and normalizes remaining HP back to the saved roster', () => {
  const initial = createDefaultSave();
  initial.player.gold = 200;
  const id = initial.roster[0].id;
  initial.roster[0].hp = 1500;
  let save = changeSpiritProgress(initial, { type: 'rank', id });
  save = changeSpiritProgress(save, { type: 'craft', id, gearId: 'village_recipe' });
  save = changeSpiritProgress(save, { type: 'equip', id, gearId: 'village_recipe' });
  const state = createAdventureState(save);
  beginBattle(state, save);
  const hero = state.battle.actors.find(actor => actor.id === id);
  assert.deepEqual([hero.hp, hero.maxHp, hero.atk], [1740, 3480, 342]);
  hero.hp = 870;
  Object.assign(state.battle, { phase: 'battle_end', result: 'victory' });
  save = claimBattleResult(state, save);
  assert.deepEqual([save.roster[0].hp, save.roster[0].maxHp, save.roster[0].atk], [750, 3000, 320]);
  beginBattle(state, save);
  assert.equal(state.battle.actors.find(actor => actor.id === id).hp, 870);
});

test('Adventure defeat allows preparing the party again without granting encounter rewards', () => {
  const save = createDefaultSave();
  const state = createAdventureState(save);
  beginBattle(state, save);
  assert.equal(leaveAdventureDefeat(state), false);
  for (const actor of state.battle.actors) if (actor.team === 'player') actor.alive = false;
  stepAdventure(state, save, 1 / 30);
  assert.equal(state.battle.result, 'defeat');
  assert.equal(leaveAdventureDefeat(state), true);
  assert.equal(state.battle, null);
  assert.equal(save.player.gold, 120);
  assert.deepEqual(save.adventure.rewardClaims, []);
});

test('Adventure restores clue IDs without resetting completed chapters or changing rewards', () => {
  const [salt, ladle] = FOREST_CLUE_IDS;
  const partial = migrateSave({
    version: 2, adventure: { quest: 'accepted', chestOpened: true, map: 'forest', forestClues: ['unknown', ladle, ladle] },
  });
  assert.deepEqual(partial.adventure.forestClues, [ladle]);
  assert.equal(adventureJournal(partial).action, salt);
  for (const quest of ['ready_to_claim', 'completed']) {
    const legacy = migrateSave({ version: 2, player: { gold: 290 }, adventure: { quest, forestCleared: true } });
    assert.deepEqual(legacy.adventure.forestClues, [salt, ladle]);
    assert.equal(legacy.adventure.quest, quest);
    assert.equal(legacy.player.gold, 290);
  }
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
  assert.equal(adventureJournal(save).action, 'forest_clue_salt');
  save.adventure.forestClues.push('forest_clue_ladle');
  assert.equal(adventureJournal(save).action, 'forest_clue_salt');
  save.adventure.forestClues.push('forest_clue_salt');
  assert.equal(adventureJournal(save).action, 'encounter');
  Object.assign(save.adventure, { forestCleared: true, quest: 'ready_to_claim' });
  assert.equal(adventureJournal(save).action, 'village_return');
  Object.assign(save.adventure, { map: 'village', quest: 'completed' });
  assert.equal(adventureJournal(save).action, null);
  assert.ok(adventureJournal(save).labels.every(step => step.status === 'done'));
});

function prepareBossCharge(encounter = 'forest') {
  const save = createDefaultSave();
  const state = createAdventureState(save);
  beginBattle(state, save, encounter);
  const battle = state.battle;
  for (const enemy of battle.actors.filter(actor => actor.team === 'enemy')) enemy.alive = false;
  const advance = () => stepAdventure(state, save, 1 / 30);
  advance();
  const boss = battle.actors.find(actor => actor.boss);
  boss.hp = Math.floor(boss.maxHp * .6);
  boss.cooldown = 900;
  for (const actor of battle.actors.filter(actor => actor.team === 'player')) {
    actor.action = { hitTick: 900 };
  }
  return { advance, save, state, battle, boss };
}

test('the lantern reduces one cast from the seal without changing marked targets or damage timing', () => {
  const { advance, state, battle, boss } = prepareBossCharge('seal');
  const events = [];
  const listener = ({ detail }) => events.push(detail);
  gameEvents.addEventListener('game-event', listener);
  try {
    assert.equal(activateLanternWard(state), false);
    advance();
    const telegraph = battle.bossTelegraph;
    assert.equal(telegraph.attack, 'Sương Rút Vị');
    assert.equal(telegraph.duration, 90);
    const targets = bossTelegraphTargets(battle, boss);
    assert.equal(targets.length, 2);
    for (const target of targets) target.x = boss.x;
    assert.deepEqual(bossTelegraphTargets(battle, boss), targets);
    const before = targets.map(actor => actor.hp);
    const releaseTick = battle.tick + telegraph.duration;
    battle.paused = true;
    assert.equal(activateLanternWard(state), false);
    battle.paused = false;
    assert.equal(activateLanternWard(state), true);
    assert.equal(activateLanternWard(state), false);
    while (battle.tick < releaseTick - 1) advance();
    assert.deepEqual(targets.map(actor => actor.hp), before);
    advance();
    const hits = events.filter(event => event.type === 'hit_resolved' && event.source_id === boss.id);
    assert.deepEqual(hits.map(event => event.target_id), targets.map(actor => actor.actor_id));
    assert.deepEqual(hits.map(event => event.payload.hp_damage), targets.map(actor => Math.floor(boss.atk * 1.28 * 100 / (100 + actor.def))));
    assert.ok(hits.every(event => event.tick === releaseTick));
    boss.hp = Math.floor(boss.maxHp * .4);
    advance();
    assert.equal(battle.bossTelegraph.attack, 'Triều Sương');
    assert.equal(bossTelegraphTargets(battle, boss).length, 5);
    assert.equal(activateLanternWard(state), false);
    assert.equal(events.filter(event => event.type === 'lantern_ward_activated').length, 1);
  } finally {
    gameEvents.removeEventListener('game-event', listener);
  }
});

test('one surviving stove lets the boss hit the marked targets on the scheduled tick', () => {
  const { advance, battle, boss } = prepareBossCharge();
  assert.equal(boss.id, 'boss_bep_truong');
  const events = [];
  const listener = ({ detail }) => events.push(detail);
  gameEvents.addEventListener('game-event', listener);
  try {
    advance();
    const windup = events.find(event => event.type === 'boss_phase_changed');
    assert.equal(windup.payload.windup_ticks, 180);
    Object.assign(battle.stoves[0], { hp: 0, alive: false });
    assert.equal(focusBossStove(battle, battle.stoves[0].actor_id), false);
    assert.equal(focusBossStove(battle, battle.stoves[1].actor_id), true);
    const targets = bossTelegraphTargets(battle, boss);
    assert.equal(targets.length, 2);
    targets[0].shield = 1;
    targets[0].shieldUntil = 500;
    const releaseTick = windup.tick + windup.payload.windup_ticks;
    while (battle.tick < releaseTick - 1) advance();
    assert.ok(events.every(event => event.type !== 'boss_cast_released'));
    advance();
    assert.equal(events.filter(event => event.type === 'boss_cast_released').length, 1);
    const hits = events.filter(event => event.type === 'hit_resolved' && event.source_id === boss.id);
    assert.deepEqual(hits.map(event => event.target_id), targets.map(actor => actor.actor_id));
    assert.ok(hits.every(event => event.tick === releaseTick));
    assert.equal(events.filter(event => event.type === 'shield_broken').length, 1);
    assert.deepEqual(battle.stoves, []);
    assert.equal(battle.stoveTargetId, null);
  } finally {
    gameEvents.removeEventListener('game-event', listener);
  }
});

test('targeted basic attacks and ultimates can interrupt the boss on the final charge tick', () => {
  const { advance, save, state, battle, boss } = prepareBossCharge();
  const mage = battle.actors.find(actor => actor.role === 'mage');
  const fighter = battle.actors.find(actor => actor.role === 'fighter');
  const events = [];
  const listener = ({ detail }) => events.push(detail);
  gameEvents.addEventListener('game-event', listener);
  try {
    advance();
    const [first, second] = battle.stoves;
    const releaseTick = battle.tick + battle.bossTelegraph.duration;
    assert.equal(battle.bossPhase, 2);
    assert.equal(focusBossStove(battle, boss.actor_id), false);
    Object.assign(fighter, { x: boss.x - 70, y: boss.y, action: null, cooldown: 0, atk: 1000 });
    const bossHP = boss.hp;
    advance();
    assert.equal(fighter.action.targetId, boss.actor_id);
    while (fighter.action) advance();
    assert.equal(boss.hp, bossHP);
    assert.ok(events.some(event => event.type === 'hit_resolved' && event.payload.guarded));

    assert.equal(focusBossStove(battle, first.actor_id), true);
    Object.assign(fighter, { x: first.x - 70, y: first.y, cooldown: 0 });
    advance();
    assert.equal(fighter.action.targetId, first.actor_id);
    while (fighter.action) advance();
    assert.equal(first.alive, false);
    assert.equal(battle.stoveTargetId, null);
    assert.equal(second.hp, second.maxHp);
    fighter.cooldown = 900;

    assert.equal(focusBossStove(battle, second.actor_id), true);
    Object.assign(mage, { action: null, cooldown: 900, energy: 100, atk: 1000 });
    while (battle.tick < releaseTick - 24) advance();
    battle.paused = true;
    assert.equal(activateUltimate(state, save, mage.actor_id).ok, false);
    for (let i = 0; i < 30; i++) advance();
    assert.equal(battle.tick, releaseTick - 24);
    battle.paused = false;
    assert.equal(activateUltimate(state, save, mage.actor_id).ok, true);
    while (battle.tick < releaseTick) advance();
    assert.ok(events.some(event => event.type === 'projectile_spawned' && event.target_id === second.actor_id));
    assert.equal(second.alive, false);
    assert.equal(battle.bossTelegraph, null);
    assert.deepEqual(events.filter(event => event.type === 'boss_cast_interrupted').map(event => event.tick), [releaseTick]);
    assert.ok(events.every(event => event.type !== 'boss_cast_released'));

    boss.hp = Math.floor(boss.maxHp * .3);
    advance();
    assert.equal(battle.bossPhase, 3);
    assert.equal(battle.bossTelegraph.duration, 36);
    assert.equal(bossTelegraphTargets(battle, boss).length, 3);
    assert.deepEqual(battle.stoves, []);
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

test('Adventure completes chapter one across a reload, with a gated boss and a single reward', async () => {
  const maps = createAdventureMapRegistry(await Promise.all(['village', 'forest'].map(key => readJson(`examples/maps/${key}.json`))));
  let save = createDefaultSave();
  let state = createAdventureState(save);
  function interact(action) {
    const item = getAdventureMap(maps, state.map).interactables.find(item => item.action === action);
    Object.assign(state, { x: item.x, y: item.y });
    const result = interactAdventure(state, save, maps);
    save = result.save;
    return result;
  }

  assert.equal(interact('lilia').dialogue, 'opening');
  interact('chest');
  interact('portal');
  assert.equal(interact('encounter').changed, false);
  assert.equal(state.battle, null);
  const [salt, ladle] = FOREST_CLUE_IDS;
  assert.equal(interact(ladle).changed, true);
  assert.equal(interact(ladle).changed, false);
  assert.equal(interact('encounter').changed, false);

  interact('village_return');
  assert.equal(state.map, 'village');
  save = migrateSave(JSON.parse(JSON.stringify(save)));
  state = createAdventureState(save);
  assert.deepEqual(save.adventure.forestClues, [ladle]);
  interact('portal');
  assert.equal(adventureJournal(save).action, salt);
  assert.equal(interact(salt).changed, true);
  assert.equal(interact('encounter').changed, true);
  for (let frame = 0; frame < 1_800 && state.battle.phase === 'battle_running'; frame += 1) stepAdventure(state, save, 1 / 30, maps);

  assert.equal(state.battle.phase, 'battle_end');
  assert.equal(state.battle.result, 'victory');
  save = claimBattleResult(state, save);
  interact('village_return');
  assert.equal(interact('lilia').dialogue, 'ending');

  assert.equal(save.adventure.quest, 'completed');
  assert.equal(save.adventure.chestOpened, true);
  assert.equal(save.adventure.forestCleared, true);
  assert.equal(adventureJournal(save).clues.length, 2);
  assert.equal(save.player.gold, 290);
  assert.equal(save.player.essence, 39);
  assert.equal(save.adventure.rewardClaims.length, 2);
  assert.equal(interact('lilia').dialogue, 'forestOpening');
  assert.equal(save.player.gold, 290);
  assert.equal(save.adventure.chapterTwo.stage, 'accepted');
});

test('chapter two unlocks in order, survives reload and credits the current save once', async () => {
  const maps = createAdventureMapRegistry(await Promise.all(['village', 'forest'].map(key => readJson(`examples/maps/${key}.json`))));
  let save = migrateSave({
    version: SAVE_VERSION,
    player: { gold: 290, essence: 39, experience: 100, level: 2 },
    adventure: { quest: 'completed', chestOpened: true, forestCleared: true },
    completedBattles: 1,
  });
  let state = createAdventureState(save);
  function interact(action) {
    const item = getAdventureMap(maps, state.map).interactables.find(item => item.action === action);
    Object.assign(state, { x: item.x, y: item.y });
    const result = interactAdventure(state, save, maps);
    save = result.save;
    return result;
  }
  assert.equal(save.adventure.chapterTwo.stage, 'not_started');
  assert.equal(adventureJournal(save).nextChapterAction, 'lilia');
  assert.equal(interact('lilia').dialogue, 'forestOpening');
  interact('portal');
  assert.equal(interact('forest_lantern_light').changed, false);
  assert.equal(interact('seal_encounter').changed, false);
  assert.equal(interact('forest_lantern_wood').changed, true);
  save = migrateSave(JSON.parse(JSON.stringify(save)));
  state = createAdventureState(save);
  assert.equal(adventureJournal(save).action, 'forest_lantern_light');
  assert.equal(interact('forest_lantern_light').changed, true);
  assert.equal(interact('seal_encounter').changed, true);
  assert.equal(state.battle.encounter, 'seal');
  for (let i = 0; i < 2400 && state.battle.phase === 'battle_running'; i++) {
    if (state.battle.bossPhase === 3) activateLanternWard(state);
    stepAdventure(state, save, 1 / 30, maps);
  }
  assert.equal(state.battle.result, 'victory');
  save.player.gold += 17;
  save = claimBattleResult(state, save);
  assert.equal(save.player.gold, 397);
  assert.equal(save.adventure.chapterTwo.stage, 'ready_to_claim');
  assert.equal(claimBattleResult(state, save), save);
  interact('village_return');
  assert.equal(interact('lilia').dialogue, 'forestEnding');
  assert.equal(interact('lilia').changed, false);
  assert.equal(save.player.gold, 507);
  assert.equal(save.player.level, 3);
  assert.equal(save.adventure.chapterTwo.stage, 'completed');
  assert.equal(adventureJournal(save).action, null);
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

test('TCG surrender resolves a pending match once and preserves already spent cards', async () => {
  const catalog = await readJson('examples/cards/cards.catalog.json');
  const deck = await readJson('examples/cards/starter_deck.json');
  const match = createTcgMatch(catalog, deck);
  const card = match.players[1].hand.pop();
  match.stack.push({ card, owner: 1, kind: 'spell' });
  match.pendingAttack = { playerIndex: 1 };
  const result = surrenderTcg(match, 0);
  assert.equal(result.winner, 1);
  assert.equal(result.result, 'surrender');
  assert.equal(result.phase, 'result');
  assert.deepEqual(result.stack, []);
  assert.equal(result.pendingAttack, null);
  assert.deepEqual(result.players[1].graveyard, [card]);
  assert.equal(match.result, null);
  assert.throws(() => surrenderTcg(result, 0), /đã kết thúc/);
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

test('Auto Chess benches a deployed unit without selling it and scouts the same living opponent used in combat', async () => {
  const unitsData = await readJson('examples/auto_chess/units.json');
  const shop = await readJson('examples/auto_chess/shop_odds.json');
  let run = createChessRun(unitsData.units, shop);
  run = buyChessOffer(run, 0);
  run = placeChessUnit(run, 0, 2, 3);
  const gold = run.gold;
  const id = run.board[0].id;
  run = benchChessUnit(run, 0);
  assert.equal(run.board.length, 0);
  assert.equal(run.bench[0].id, id);
  assert.equal(run.bench[0].x, undefined);
  assert.equal(run.gold, gold);
  run = placeChessUnit(run, 0, 4, 0);
  run.opponents[0].hp = 0;
  const forecast = nextChessOpponent(run);
  assert.equal(forecast.id, run.opponents[1].id);
  const result = startChessCombat(run);
  assert.equal(result.result.opponentId, forecast.id);
  assert.deepEqual(result.combat.startActors.filter(actor => actor.team === 'enemy').map(({ id, x, y }) => [id, x, y]),
    forecast.units.map(unit => [unit.id, unit.x, unit.y + 4]));
  assert.throws(() => benchChessUnit(result, 0), /chuẩn bị/);
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
