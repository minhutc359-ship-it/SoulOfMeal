import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  advanceChessRound, buyChessExperience, buyChessOffer, chessPoolCounts, chessRoundInfo, chessStandings,
  createChessRun, equipChessItem, nextChessOpponent, placeChessUnit, refreshChessShop, sellChessUnit, startChessCombat,
} from '../src/modes/autoChess.js';
import { chessHexDistance, chessPathStep } from '../src/modes/chessCombat.js';
import { CHESS_COMPONENTS } from '../src/modes/chessItems.js';
import { createDefaultSave, migrateSave } from '../src/core/save.js';

const readJson = async file => JSON.parse(await readFile(new URL('../../examples/auto_chess/' + file, import.meta.url)));
const [{ units }, config] = await Promise.all([readJson('units.json'), readJson('shop_odds.json')]);

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
