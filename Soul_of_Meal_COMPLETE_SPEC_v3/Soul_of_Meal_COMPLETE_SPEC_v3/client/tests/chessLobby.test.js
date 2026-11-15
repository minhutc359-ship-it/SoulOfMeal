import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  advanceChessRound, arrangeChessUnit, chessBenchSlots, chessDropState, buyChessExperience, buyChessOffer, chessPoolCounts, chessRoundInfo, chessStandings,
  createChessRun, chooseChessLoot, chessOvertimeDamage, equipChessItem, nextChessOpponent, placeChessUnit, refreshChessShop, sellChessUnit, startChessCombat,
} from '../src/modes/autoChess.js';
import { chessHexDistance, chessPathStep } from '../src/modes/chessCombat.js';
import { CHESS_COMPONENTS } from '../src/modes/chessItems.js';
import { createDefaultSave, migrateSave } from '../src/core/save.js';

const readJson = async file => JSON.parse(await readFile(new URL('../../examples/auto_chess/' + file, import.meta.url)));
const [{ units }, config] = await Promise.all([readJson('units.json'), readJson('shop_odds.json')]);

test('a new lobby continues beyond round 37 and only a living last survivor earns first place', () => {
  let run = createChessRun(units, config, 59);
  run.round = 37;
  run.phase = 'result';
  run.result = { won: true };
  run = advanceChessRound(run, units, config);
  assert.equal(run.round, 38);
  assert.equal(run.phase, 'prepare');
  assert.equal(run.opponents.filter(bot => bot.hp > 0).length, 7);
  run.opponents.forEach(bot => { bot.hp = 0; });
  run.phase = 'result';
  run.result = { won: true };
  const winner = advanceChessRound(run, units, config);
  assert.equal(winner.result, 'victory');
  assert.equal(winner.placement, 1);
  run.hp = 0;
  const eliminated = advanceChessRound(run, units, config);
  assert.equal(eliminated.result, 'complete');
  assert.notEqual(eliminated.placement, 1);
});

test('overtime decides tied human and bot pairs consistently and survives save/reload', () => {
  const run = createChessRun(units, config, 2077);
  run.round = 38;
  run.stage = chessRoundInfo(run).stage;
  delete run.neutral;
  run.board = [];
  run.opponents.forEach(bot => { bot.units = []; bot.hp = 100; });
  assert.equal(chessOvertimeDamage(run), 10);
  const save = createDefaultSave();
  save.modes.chess = run;
  const result = startChessCombat(run);
  assert.deepEqual(result, startChessCombat(migrateSave(JSON.parse(JSON.stringify(save))).modes.chess));
  assert.equal(result.result.draw, false);
  assert.equal(result.result.tiebreak, true);
  const health = [result.hp, ...result.opponents.map(bot => bot.hp)];
  assert.equal(health.filter(hp => hp === 90).length, 4);
  assert.equal(health.filter(hp => hp === 100).length, 4);
  const legacy = structuredClone(run);
  delete legacy.lobby.finish_condition;
  assert.equal(chessOvertimeDamage(legacy), 0);
  assert.equal(startChessCombat(legacy).result.draw, true);
  assert.equal(chessOvertimeDamage({ ...run, round: 36 }), 0);
});

test('repeated tied bot boards cannot stall a surviving player forever', () => {
  let run = createChessRun(units, config, 19);
  run = placeChessUnit(buyChessOffer(run, 0), 0, 3, 3);
  run.round = 38;
  run.stage = chessRoundInfo(run).stage;
  delete run.neutral;
  for (let turn = 0; turn < 45 && run.phase !== 'finished'; turn++) {
    // This fixture isolates lobby attrition: actual simulations see an empty
    // rival board, including tied bot-vs-bot and ghost combat.
    delete run.neutral;
    run.opponents.forEach(bot => { bot.units = []; });
    run = startChessCombat(run);
    const rivals = run.opponents.filter(bot => bot.hp > 0).length;
    run = advanceChessRound(run, units, config);
    if (rivals) assert.equal(run.phase, 'prepare');
  }
  assert.equal(run.phase, 'finished');
  assert.equal(run.result, 'victory');
  assert.equal(run.opponents.filter(bot => bot.hp > 0).length, 0);
});

test('the shared pool reserves shop copies, returns sales and excludes eliminated bots', () => {
  const scarce = structuredClone(config);
  scarce.lobby.pool_by_tier[1] = 1;
  let run = createChessRun(units, scarce);
  assert.equal(run.shop.filter(Boolean).length, units.filter(unit => unit.cost === 1).length);
  const offer = run.shop[0];
  assert.equal(chessPoolCounts(run).get(offer.id), 0);
  run = buyChessOffer(run, 0);
  assert.equal(chessPoolCounts(run).get(offer.id), 0);
  run = sellChessUnit(run, 'bench', 0);
  assert.equal(chessPoolCounts(run).get(offer.id), 1);
  run = refreshChessShop(run, units, scarce);
  assert.equal(run.shop.filter(item => item?.id === offer.id).length, 1);

  run = createChessRun(units, config);
  const bot = run.opponents[0];
  const held = bot.units[0];
  const before = chessPoolCounts(run).get(held.id);
  const copies = [...bot.units, ...bot.bench].filter(unit => unit.id === held.id)
    .reduce((sum, unit) => sum + 3 ** (unit.star - 1), 0);
  bot.hp = 0;
  assert.equal(chessPoolCounts(run).get(held.id), before + copies);
  assert.ok([...chessPoolCounts(run).values()].every(count => count >= 0));
});

test('lobby stages award loot, compose equipment and let surviving bots fight a deterministic round', () => {
  let run = createChessRun(units, config, 2077);
  const shop = structuredClone(run.shop);
  run = buyChessExperience(run, units, config);
  assert.equal(run.level, 3);
  assert.deepEqual(run.shop, shop);
  run = placeChessUnit(buyChessOffer(run, 0), 0, 3, 3);
  assert.deepEqual(chessRoundInfo(run), { label: '1-1', stage: 1, neutral: true });
  run = startChessCombat(run);
  assert.equal(run.result.won, true);
  assert.ok(CHESS_COMPONENTS.includes(run.result.rewardItem));
  assert.equal(run.streak, 0);
  run = advanceChessRound(run, units, config);
  assert.equal(chessRoundInfo(run).label, '1-2');
  run = equipChessItem(run, 'board', 0, 0);
  const equipped = run.board[0].items[0];
  run.items.push(equipped);
  run = equipChessItem(run, 'board', 0, 0);
  assert.equal(run.board[0].items.length, 1);
  assert.notEqual(run.board[0].items[0], equipped);
  run = advanceChessRound(startChessCombat(run), units, config);
  assert.deepEqual(chessRoundInfo(run), { label: '2-1', stage: 2, neutral: false });
  const save = createDefaultSave();
  save.modes.chess = run;
  const restored = migrateSave(JSON.parse(JSON.stringify(save))).modes.chess;
  assert.deepEqual(startChessCombat(run), startChessCombat(restored));
  const opponentId = nextChessOpponent(run).id;
  const combat = startChessCombat(run);
  assert.ok(combat.opponents.some(bot => bot.id !== opponentId && bot.hp < run.opponents.find(older => older.id === bot.id).hp));
  assert.equal(chessStandings(combat).length, 8);
  assert.equal(combat.combat.geometry, 'hex');
});

test('hex movement goes around occupied tiles and legacy runs keep their format after loading', () => {
  const start = { x: 2, y: 2 };
  const target = { x: 1, y: 3 };
  assert.equal(chessHexDistance(start, target), 1);
  const occupied = new Set([2 + 2 * 7, 2 + 3 * 7, 1 + 4 * 7]);
  const step = chessPathStep(start, { x: 1, y: 4 }, 1, occupied, true);
  assert.deepEqual(step, target);
  assert.equal(chessHexDistance(start, step), 1);
  const legacy = structuredClone(config);
  delete legacy.lobby;
  let oldRun = createChessRun(units, legacy, 41);
  const save = createDefaultSave();
  save.modes.chess = oldRun;
  oldRun = migrateSave(JSON.parse(JSON.stringify(save))).modes.chess;
  assert.equal(nextChessOpponent(oldRun).id, 1);
  assert.equal(chessRoundInfo(oldRun).label, '1');
  oldRun = startChessCombat(oldRun);
  assert.equal(oldRun.combat.geometry, undefined);
  oldRun = advanceChessRound(oldRun, units, config);
  assert.equal(chessRoundInfo(oldRun).label, '2');
  assert.equal(oldRun.lobby, undefined);
});

test('bench slots persist and permit swaps with a full bench and a capped board', () => {
  let run = createChessRun(units, config);
  const [a, b] = units.filter(unit => unit.cost === 1);
  run.shop = [a, b];
  run = buyChessOffer(run, 0);
  run = buyChessOffer(run, 1);
  run = placeChessUnit(run, 0, 0, 0);
  run.level = 1;
  const guest = run.bench[0];
  const original = run.board[0];
  run.bench = Array.from({ length: 9 }, (_, slot) => ({ ...guest, id: units.filter(unit => unit.id !== original.id)[slot % (units.length - 1)].id, uid: 'bench-' + slot, benchSlot: slot }));
  assert.equal(chessDropState(run, { zone: 'bench', index: 8 }, { zone: 'board', x: 1, y: 0 }), 'blocked');
  assert.equal(chessDropState(run, { zone: 'bench', index: 8 }, { zone: 'board', x: 0, y: 0 }), 'swap');
  run = arrangeChessUnit(run, { zone: 'bench', index: 8 }, { zone: 'board', x: 0, y: 0 });
  assert.equal(run.board[0].uid, 'bench-8');
  assert.equal(run.bench[chessBenchSlots(run)[8]].id, original.id);
  run = arrangeChessUnit(run, { zone: 'board', index: 0 }, { zone: 'bench', slot: 6 });
  assert.equal(run.board[0].uid, 'bench-6');
  assert.equal(run.bench[chessBenchSlots(run)[6]].uid, 'bench-8');
  run = arrangeChessUnit(run, { zone: 'bench', index: chessBenchSlots(run)[6] }, { zone: 'bench', slot: 3 });
  assert.equal(run.bench.length, 9);
  const profile = createDefaultSave();
  profile.modes.chess = run;
  const restored = migrateSave(JSON.parse(JSON.stringify(profile))).modes.chess;
  assert.equal(restored.bench[chessBenchSlots(restored)[3]].uid, 'bench-8');
});

test('elite loot is a persisted choice and may only be taken once', () => {
  const run = createChessRun(units, config);
  run.phase = 'result';
  run.result = { boss: true, lootChoices: [...CHESS_COMPONENTS.slice(0, 3)] };
  const save = createDefaultSave();
  save.modes.chess = run;
  const restored = migrateSave(JSON.parse(JSON.stringify(save))).modes.chess;
  const pick = restored.result.lootChoices[2];
  const chosen = chooseChessLoot(restored, pick);
  assert.equal(chosen.result.rewardItem, pick);
  assert.deepEqual(chosen.items, [pick]);
  assert.throws(() => chooseChessLoot(chosen, pick), /không còn khả dụng/);
  assert.deepEqual(advanceChessRound(restored, units, config).items, [restored.result.lootChoices[0]]);
});
