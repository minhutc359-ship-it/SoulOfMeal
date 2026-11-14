import { gameEvents } from '../core/events.js';
import { chessBattleOutcome, simulateChessCombat } from './chessCombat.js';
import { CHESS_COMPONENTS, CHESS_ITEMS, chessItemPlacement } from './chessItems.js';

export const CHESS_PREPARATION_SECONDS = 30;

export { CHESS_TRAITS, chessTraits } from './chessCombat.js';

const BOARD_COLUMNS = 7;
const BOARD_ROWS = 4;
const BENCH_SIZE = 9;
const SHOP_SIZE = 5;
const LEVEL_CAP = 9;

export function chessRoundInfo(run) {
  const { lobby, round } = run;
  if (!lobby) return { label: String(round), stage: run.stage, neutral: false };
  const offset = round - lobby.opening_neutral_rounds - 1;
  if (offset < 0) return { label: '1-' + round, stage: 1, neutral: true };
  const stage = 2 + Math.floor(offset / lobby.rounds_per_stage);
  const step = 1 + offset % lobby.rounds_per_stage;
  return { label: stage + '-' + step, stage, neutral: step === lobby.rounds_per_stage };
}

export function chessXpNeeded(run) {
  return run.level >= LEVEL_CAP ? 0 : run.lobby?.xp_required[run.level] ?? 4;
}

function addExperience(entrant, amount, lobby) {
  if (entrant.level >= LEVEL_CAP) return;
  entrant.experience = (entrant.experience ?? 0) + amount;
  while (entrant.level < LEVEL_CAP && entrant.experience >= lobby.xp_required[entrant.level]) {
    entrant.experience -= lobby.xp_required[entrant.level];
    entrant.level++;
  }
  if (entrant.level === LEVEL_CAP) entrant.experience = 0;
}

function livingOpponents(run) { return run.opponents.filter(opponent => opponent.hp > 0); }

export function chessPoolCounts(run, includeShop = true) {
  if (!run.lobby) return new Map();
  const counts = new Map(Object.entries(run.pool));
  const held = [...run.board, ...run.bench, ...livingOpponents(run).flatMap(bot => [...bot.units, ...bot.bench])];
  for (const unit of held) counts.set(unit.id, (counts.get(unit.id) ?? 0) - 3 ** (unit.star - 1));
  if (includeShop) {
    for (const offer of run.shop.filter(Boolean)) counts.set(offer.id, (counts.get(offer.id) ?? 0) - 1);
  }
  return counts;
}

export function canBuyChessOffer(run, slot) {
  const offer = run.shop[slot];
  return run.phase === 'prepare' && Boolean(offer) && run.gold >= offer.cost
    && (run.bench.length < BENCH_SIZE || Boolean(run.lobby && copiesOf(run, offer.id) >= 2));
}

function copiesOf(entrant, id) {
  return [...entrant.board, ...entrant.bench].filter(unit => unit.id === id && unit.star === 1).length;
}

export function equipChessItem(run, zone, unitIndex, bagIndex) {
  assertPrepare(run);
  if (!run.lobby || !['board', 'bench'].includes(zone) || !Number.isInteger(unitIndex) || !Number.isInteger(bagIndex)) throw new Error('Chọn quân và vật phẩm hợp lệ.');
  const unit = run[zone][unitIndex];
  const item = run.items[bagIndex];
  if (!unit || !Object.hasOwn(CHESS_ITEMS, item)) throw new Error('Không tìm thấy quân hoặc vật phẩm.');
  const placement = chessItemPlacement(unit, item);
  if (!placement) throw new Error('Quân đã mang đủ ba vật phẩm.');
  const updated = structuredClone(run);
  (updated[zone][unitIndex].items ??= [])[placement.slot] = placement.id;
  updated.items.splice(bagIndex, 1);
  record(updated, `${unit.display_name} nhận ${CHESS_ITEMS[placement.id].name}.`);
  return updated;
}

export function createChessRun(units, shopConfig, seed = 2077) {
  const lobby = shopConfig.lobby;
  const run = {
    phase: 'prepare', preparationSeconds: CHESS_PREPARATION_SECONDS, round: 1, stage: 1, hp: 100, gold: 10, level: 2, experience: 0,
    bench: [], board: [], shopLocked: false, shop: [], seed, wins: 0, losses: 0,
    streak: 0, log: ['Vòng đầu: chuẩn bị đội hình.'], combat: null, result: null,
    opponents: Array.from({ length: 7 }, (_, index) => ({
      id: index + 1, hp: 100, ...(lobby ? { units: [], bench: [], gold: 10, level: 2, experience: 0, streak: 0, items: [] }
        : { units: botRoster(units, index + seed) }),
    })),
  };
  if (lobby) Object.assign(run, {
    lobby: structuredClone(lobby), items: [],
    pool: Object.fromEntries(units.map(unit => [unit.id, lobby.pool_by_tier[unit.cost]])),
    economy: structuredClone(shopConfig.economy),
  });
  run.shop = rollChessShop(run, units, shopConfig);
  if (lobby) prepareLobby(run, units, shopConfig);
  return run;
}

export function buyChessOffer(run, slot, destination) {
  assertPrepare(run);
  if (!Number.isInteger(slot) || !run.shop[slot]) throw new Error('Ô cửa hàng trống.');
  const offer = run.shop[slot];
  if (run.gold < offer.cost) throw new Error('Không đủ vàng.');
  if (!canBuyChessOffer(run, slot)) throw new Error('Băng ghế đã đủ 9 vị trí.');
  if (destination && chessDropState(run, { zone: 'shop', index: slot }, destination) !== 'valid') {
    throw new Error('Chọn một ô trống còn chỗ trong đội hình.');
  }
  const updated = structuredClone(run);
  updated.shop[slot] = null;
  updated.gold -= offer.cost;
  const free = chessBenchSlots(run).indexOf(null);
  const piece = newChessUnit(offer, updated.bench.length);
  if (free >= 0) piece.benchSlot = free;
  // Keep the visual positions of existing bench units when filling a hole.
  chessBenchSlots(run).forEach((index, slot) => {
    if (index !== null) updated.bench[index].benchSlot = slot;
  });
  if (destination) {
    delete piece.benchSlot;
    Object.assign(piece, { x: destination.x, y: destination.y });
    updated.board.push(piece);
  } else updated.bench.push(piece);
  mergeChessCopies(updated);
  record(updated, `Đã mua ${offer.display_name}.`);
  gameEvents.emit('chess_unit_bought', { unit_id: offer.id, cost: offer.cost });
  if (destination) gameEvents.emit('chess_unit_placed', { unit_id: offer.id, x: destination.x, y: destination.y });
  return updated;
}

function newChessUnit(offer, placementOrder) {
  return { ...offer, ...chessStats(offer.id, 1), star: 1, placementOrder };
}

export function chessBenchSlots(run) {
  const slots = Array(BENCH_SIZE).fill(null);
  const unplaced = [];
  for (const [index, unit] of run.bench.entries()) {
    if (Number.isInteger(unit.benchSlot) && unit.benchSlot >= 0 && slots[unit.benchSlot] === null) slots[unit.benchSlot] = index;
    else unplaced.push(index);
  }
  for (const index of unplaced) {
    const empty = slots.indexOf(null);
    if (empty >= 0) slots[empty] = index;
  }
  return slots;
}

function chessPlacement(run, source, destination) {
  if (run.phase !== 'prepare' || !['board', 'bench'].includes(source.zone) || !run[source.zone][source.index]) return null;
  const slots = chessBenchSlots(run);
  if (destination.zone === 'board') {
    const { x, y } = destination;
    if (![x, y].every(Number.isInteger) || x < 0 || x >= BOARD_COLUMNS || y < 0 || y >= BOARD_ROWS) return null;
    const other = run.board.findIndex(unit => unit.x === x && unit.y === y);
    if (source.zone === 'bench' && other < 0 && run.board.length >= run.level) return null;
    return { slots, other };
  }
  if (destination.zone !== 'bench') return null;
  const slot = destination.slot ?? slots.indexOf(null);
  if (!Number.isInteger(slot) || slot < 0 || slot >= BENCH_SIZE) return null;
  return { slots, slot, other: slots[slot] ?? -1 };
}

export function chessDropState(run, source, destination) {
  if (source.zone === 'shop') {
    const { x, y } = destination;
    const fits = destination.zone === 'board' && [x, y].every(Number.isInteger)
      && x >= 0 && x < BOARD_COLUMNS && y >= 0 && y < BOARD_ROWS
      && run.board.length < run.level && !run.board.some(unit => unit.x === x && unit.y === y);
    return fits && canBuyChessOffer(run, source.index) ? 'valid' : 'blocked';
  }
  const placement = chessPlacement(run, source, destination);
  if (!placement) return 'blocked';
  return placement.other < 0 || source.zone === destination.zone && source.index === placement.other ? 'valid' : 'swap';
}

export function arrangeChessUnit(run, source, destination) {
  assertPrepare(run);
  const placement = chessPlacement(run, source, destination);
  if (!placement) throw new Error(destination.zone === 'bench' ? 'Băng ghế không có chỗ.' : 'Chọn ô hợp lệ hoặc đổi chỗ với một quân trên bàn.');
  if (source.zone === destination.zone && source.index === placement.other) return run;
  const updated = structuredClone(run);
  placement.slots.forEach((index, slot) => {
    if (index !== null) updated.bench[index].benchSlot = slot;
  });
  const piece = updated[source.zone][source.index];
  const other = updated[destination.zone][placement.other];
  const from = source.zone === 'board' ? { x: piece.x, y: piece.y } : { slot: piece.benchSlot };
  function position(unit, zone, place) {
    if (zone === 'board') {
      delete unit.benchSlot;
      Object.assign(unit, { x: place.x, y: place.y });
    } else {
      delete unit.x;
      delete unit.y;
      unit.benchSlot = place.slot;
    }
  }
  position(piece, destination.zone, { ...destination, slot: placement.slot });
  if (other) position(other, source.zone, from);
  if (source.zone !== destination.zone) {
    updated[source.zone].splice(source.index, 1, ...(other ? [other] : []));
    if (other) updated[destination.zone][placement.other] = piece;
    else updated[destination.zone].push(piece);
  }
  if (destination.zone === 'board') {
    mergeChessCopies(updated);
    record(updated, `${piece.display_name} vào ô (${destination.x + 1}, ${destination.y + 1}).`);
    gameEvents.emit('chess_unit_placed', { unit_id: piece.id, x: destination.x, y: destination.y });
  } else record(updated, `${piece.display_name} vào ghế ${placement.slot + 1}.`);
  return updated;
}

export function placeChessUnit(run, benchIndex, x, y) {
  return arrangeChessUnit(run, { zone: 'bench', index: benchIndex }, { zone: 'board', x, y });
}

export function moveChessUnit(run, boardIndex, x, y) {
  return arrangeChessUnit(run, { zone: 'board', index: boardIndex }, { zone: 'board', x, y });
}

export function benchChessUnit(run, boardIndex) {
  return arrangeChessUnit(run, { zone: 'board', index: boardIndex }, { zone: 'bench' });
}

export function sellChessUnit(run, zone, index) {
  assertPrepare(run);
  if (!['board', 'bench'].includes(zone) || !Number.isInteger(index) || !run[zone][index]) throw new Error('Không tìm thấy quân.');
  const updated = structuredClone(run);
  const [unit] = updated[zone].splice(index, 1);
  if (!unit) throw new Error('Không tìm thấy quân.');
  const refund = updated.lobby ? unit.cost * 3 ** (unit.star - 1) - Number(unit.cost > 1) * (unit.star - 1)
    : unit.cost * unit.star;
  updated.gold += refund;
  if (updated.lobby) updated.items.push(...(unit.items ?? []));
  record(updated, `Đã bán ${unit.display_name}, nhận ${refund} vàng.`);
  return updated;
}

export function refreshChessShop(run, units, shopConfig) {
  assertPrepare(run);
  if (run.shopLocked) throw new Error('Cửa hàng đang khóa.');
  if (run.gold < 2) throw new Error('Không đủ 2 vàng để làm mới.');
  const updated = structuredClone(run);
  updated.gold -= 2;
  updated.seed += 1;
  updated.shop = rollChessShop(updated, units, shopConfig);
  record(updated, 'Cửa hàng đã làm mới.');
  return updated;
}

export function toggleChessLock(run) {
  assertPrepare(run);
  const updated = structuredClone(run);
  updated.shopLocked = !updated.shopLocked;
  record(updated, updated.shopLocked ? 'Đã khóa cửa hàng cho vòng sau.' : 'Đã mở khóa cửa hàng.');
  return updated;
}

export function nextChessOpponent(run) {
  if (run.neutral) return run.neutral;
  const { opponents } = run;
  if (!run.lobby) {
    for (let offset = 0; offset < opponents.length; offset++) {
      const opponent = opponents[(run.round - 1 + offset) % opponents.length];
      if (opponent.hp > 0) return opponent;
    }
    return null;
  }
  const alive = livingOpponents(run);
  const index = (run.round - 1) % alive.length;
  const next = alive[index];
  return alive.length > 1 && next.id === run.lastOpponentId ? alive[(index + 1) % alive.length] : next ?? null;
}

export function chessStandings(run) {
  return [
    { id: 0, hp: run.hp, level: run.level, eliminatedRound: run.hp === 0 ? run.round : null },
    ...run.opponents,
  ].sort((a, b) => b.hp - a.hp || (b.eliminatedRound ?? 0) - (a.eliminatedRound ?? 0) || a.id - b.id);
}

export function startChessCombat(run) {
  assertPrepare(run);
  const updated = structuredClone(run);
  const opponent = nextChessOpponent(updated);
  if (!opponent) throw new Error('Không còn đối thủ trên bàn.');
  const hex = Boolean(updated.lobby);
  const alive = livingOpponents(updated);
  const combat = simulateChessCombat(updated.board, opponent.units, { hex });
  updated.combat = combat;
  updated.phase = 'combat';
  const opponentName = opponent.neutral ? opponent.name : 'đối thủ ' + opponent.id;
  record(updated, `Vòng ${chessRoundInfo(updated).label}: giao tranh với ${opponentName}.`);
  gameEvents.emit('chess_combat_started', { round: updated.round, opponent_id: opponent.id });
  const outcome = chessBattleOutcome(combat, updated.stage);
  if (outcome.won) updated.wins++;
  else if (!outcome.draw) updated.losses++;
  updated.hp = Math.max(0, updated.hp - outcome.damage);
  const payout = awardIncome(updated, outcome.won, outcome.draw, updated.economy, opponent.neutral);
  const income = Object.values(payout).reduce((sum, amount) => sum + amount, 0);
  let rewardItem = null;
  let lootChoices;
  if (hex) {
    if (opponent.neutral && outcome.won) {
      rewardItem = roundLoot(updated, 0);
      if (opponent.boss) {
        const first = CHESS_COMPONENTS.indexOf(rewardItem);
        lootChoices = [0, 1, 2].map(index => CHESS_COMPONENTS[(first + index) % CHESS_COMPONENTS.length]);
        rewardItem = null;
      } else updated.items.push(rewardItem);
    }
    if (!opponent.neutral) {
      settleBot(opponent, outcome.enemyDamage, !outcome.won && !outcome.draw, outcome.draw, updated);
      updated.lastOpponentId = opponent.id;
    }
    playBotMatches(updated, alive, opponent);
  } else if (outcome.won) opponent.hp = Math.max(0, opponent.hp - 12);
  updated.phase = 'result';
  updated.result = { ...outcome, enemyDamage: hex ? outcome.enemyDamage : outcome.won ? 12 : 0,
    income, payout, ticks: combat.tick, opponentId: opponent.id, boss: opponent.boss === true, rewardItem, ...(lootChoices ? { lootChoices } : {}) };
  record(updated, outcome.won ? `Chiến thắng · +${income} vàng.` : outcome.draw ? `Hòa · +${income} vàng.` : `Thất bại · -${outcome.damage} HP, +${income} vàng.`);
  if (rewardItem) record(updated, 'Nhặt được ' + CHESS_ITEMS[rewardItem].name + '.');
  gameEvents.emit('chess_combat_finished', { won: outcome.won, draw: outcome.draw, damage: outcome.damage, income, ticks: combat.tick });
  return updated;
}

function awardIncome(entrant, won, draw, economy, neutral = false) {
  const prior = entrant.streak ?? 0;
  if (!neutral) entrant.streak = draw ? 0 : won ? Math.max(0, prior) + 1 : Math.min(0, prior) - 1;
  const streak = Math.abs(entrant.streak);
  const table = entrant.streak > 0 ? economy?.win_streak_bonus_by_length : economy?.loss_streak_bonus_by_length;
  const bonus = Object.entries(table ?? { 2: 1, 4: 2, 6: 3 })
    .reduce((best, [threshold, gold]) => streak >= Number(threshold) ? Math.max(best, gold) : best, 0);
  const payout = {
    base: economy?.base_income ?? 5, win: won ? economy?.victory_bonus ?? 1 : 0,
    interest: Math.min(Math.floor(entrant.gold / (economy?.interest_gold_interval ?? 10)), economy?.interest_cap ?? 5),
    streak: bonus,
  };
  entrant.gold += Object.values(payout).reduce((sum, amount) => sum + amount, 0);
  return payout;
}

function settleBot(bot, damage, won, draw, run, neutral = false) {
  bot.hp = Math.max(0, bot.hp - damage);
  if (bot.hp === 0) bot.eliminatedRound = run.round;
  else awardIncome(bot, won, draw, run.economy, neutral);
}

function roundLoot(run, playerId) {
  return CHESS_COMPONENTS[((run.seed + 13 * run.round + 17 * playerId) >>> 0) % CHESS_COMPONENTS.length];
}

function playBotMatches(run, alive, opponent) {
  if (opponent.neutral) {
    for (const bot of alive) {
      const outcome = chessBattleOutcome(simulateChessCombat(bot.units, opponent.units, { hex: true, replay: false }), run.stage);
      settleBot(bot, outcome.damage, outcome.won, outcome.draw, run, true);
      if (outcome.won && bot.hp) (bot.items ??= []).push(roundLoot(run, bot.id));
    }
    return;
  }
  const rivals = alive.filter(bot => bot !== opponent);
  const shift = (run.round - 1) % Math.max(1, rivals.length);
  const ordered = [...rivals.slice(shift), ...rivals.slice(0, shift)];
  for (let i = 0; i < ordered.length; i += 2) {
    const first = ordered[i];
    const second = ordered[i + 1];
    const outcome = chessBattleOutcome(simulateChessCombat(first.units, (second ?? opponent).units, { hex: true, replay: false }), run.stage);
    settleBot(first, outcome.damage, outcome.won, outcome.draw, run);
    if (second) settleBot(second, outcome.enemyDamage, !outcome.won && !outcome.draw, outcome.draw, run);
  }
}

export function chooseChessLoot(run, id) {
  if (run.phase !== 'result' || !run.result.lootChoices?.includes(id)) {
    throw new Error('Phần thưởng này không còn khả dụng.');
  }
  const updated = structuredClone(run);
  updated.items.push(id);
  updated.result.rewardItem = id;
  delete updated.result.lootChoices;
  record(updated, 'Đã chọn ' + CHESS_ITEMS[id].name + '.');
  return updated;
}

export function advanceChessRound(run, units, shopConfig) {
  if (run.phase !== 'result') throw new Error('Trận đấu chưa có kết quả.');
  const updated = run.result.lootChoices ? chooseChessLoot(run, run.result.lootChoices[0]) : structuredClone(run);
  const rivals = livingOpponents(updated);
  if (updated.hp <= 0 || updated.round >= (updated.lobby?.max_rounds ?? 10) || !rivals.length) {
    updated.phase = 'finished';
    if (updated.lobby) {
      updated.placement = updated.hp === 0 ? rivals.length + 1 : chessStandings(updated).findIndex(entry => entry.id === 0) + 1;
      updated.result = updated.placement === 1 ? 'victory' : 'complete';
    } else updated.result = updated.hp > 0 && (!rivals.length || updated.wins > updated.losses) ? 'victory' : 'complete';
    return updated;
  }
  updated.round++;
  updated.stage = updated.lobby ? chessRoundInfo(updated).stage : Math.ceil(updated.round / 3);
  if (updated.lobby) addExperience(updated, updated.lobby.xp_per_round, updated.lobby);
  else if (updated.level < LEVEL_CAP) {
    updated.experience = (updated.experience ?? 0) + 1;
    if (updated.experience >= 4) { updated.experience -= 4; updated.level++; }
  }
  if (!updated.shopLocked) updated.shop = rollChessShop(updated, units, shopConfig);
  updated.shopLocked = false;
  updated.phase = 'prepare';
  updated.preparationSeconds = CHESS_PREPARATION_SECONDS;
  updated.combat = null;
  updated.result = null;
  if (updated.lobby) prepareLobby(updated, units, shopConfig);
  record(updated, `Vòng ${chessRoundInfo(updated).label}: chuẩn bị đội hình.`);
  return updated;
}

export function buyChessExperience(run, units, shopConfig) {
  assertPrepare(run);
  if (run.level >= LEVEL_CAP || run.gold < 4) throw new Error('Cần 4 vàng và cấp dưới 9.');
  const updated = structuredClone(run);
  updated.gold -= 4;
  if (updated.lobby) {
    addExperience(updated, updated.lobby.xp_per_purchase, updated.lobby);
    record(updated, `Đã mua ${updated.lobby.xp_per_purchase} XP · cấp ${updated.level}.`);
  } else {
    updated.level++;
    if (!updated.shopLocked) {
      updated.seed++;
      updated.shop = rollChessShop(updated, units, shopConfig);
    }
    record(updated, `Đã nâng đội hình lên cấp ${updated.level}.`);
  }
  return updated;
}

function prepareLobby(run, units, config) {
  const { neutral, stage } = chessRoundInfo(run);
  run.neutral = neutral ? neutralRoster(units, stage, run.round) : null;
  for (const bot of livingOpponents(run)) {
    if (run.round > 1) addExperience(bot, run.lobby.xp_per_round, run.lobby);
    if (bot.level < LEVEL_CAP && bot.units.length >= bot.level && bot.gold >= 9 + bot.id % 3) {
      bot.gold -= 4;
      addExperience(bot, run.lobby.xp_per_purchase, run.lobby);
    }
    const lineup = { board: bot.units, bench: bot.bench, items: bot.items ??= [] };
    const shop = rollChessShop(run, units, config, bot);
    for (let n = 0; n < 2; n++) {
      const offers = shop.map((unit, slot) => ({ unit, slot }))
        .filter(({ unit }) => unit && bot.gold >= unit.cost && (bot.bench.length < BENCH_SIZE || copiesOf(lineup, unit.id) >= 2));
      const score = unit => copiesOf(lineup, unit.id) * 4 + unit.cost;
      offers.sort((a, b) => score(b.unit) - score(a.unit) || a.slot - b.slot);
      const offer = offers[0];
      if (!offer) break;
      bot.gold -= offer.unit.cost;
      shop[offer.slot] = null;
      bot.bench.push(newChessUnit(offer.unit, bot.bench.length));
      mergeChessCopies(lineup, false);
    }
    while (bot.units.length < bot.level && bot.bench.length) {
      const candidates = bot.bench.map((unit, index) => ({ unit, index }));
      candidates.sort((a, b) => b.unit.star - a.unit.star || b.unit.cost - a.unit.cost || a.index - b.index);
      const [unit] = bot.bench.splice(candidates[0].index, 1);
      const row = ['guardian', 'fighter', 'assassin'].includes(unit.job) ? 3 : 0;
      const slots = [3, 2, 4, 1, 5, 0, 6].flatMap(x => [row, row === 3 ? 2 : 1].map(y => ({ x, y })));
      const cell = slots.find(({ x, y }) => !bot.units.some(member => member.x === x && member.y === y));
      bot.units.push({ ...unit, ...cell, placementOrder: bot.units.length });
    }
    const carriers = [...bot.units].sort((a, b) => b.star - a.star || b.cost - a.cost);
    bot.items = bot.items.filter(item => {
      const carrier = carriers.find(unit => chessItemPlacement(unit, item));
      if (!carrier) return true;
      const placement = chessItemPlacement(carrier, item);
      (carrier.items ??= [])[placement.slot] = placement.id;
      return false;
    });
  }
}

function neutralRoster(units, stage, round) {
  const choices = ['mob_mushroom_01', 'mob_pepper_01'].map(id => units.find(unit => unit.id === id) ?? units[0]);
  const count = stage === 1 ? round : Math.min(4, 1 + stage);
  return {
    id: 0, neutral: true, boss: stage >= 2, name: stage >= 2 ? 'Tinh anh Thất Vị' : 'Đội tuần tra Thất Vị',
    units: Array.from({ length: count }, (_, index) => {
      const base = newChessUnit(choices[index % choices.length], index);
      const leader = stage >= 2 && index === 0;
      const hp = stage === 1 ? 155 + 35 * round : Math.round(base.maxHp * (1 + .13 * stage + (leader ? .28 : 0)));
      return { ...base, x: 3 + [0, -1, 1, -2][index], y: 3, hp, maxHp: hp,
        atk: stage === 1 ? 30 + 5 * round : base.atk, def: stage === 1 ? 12 : base.def };
    }),
  };
}

function mergeChessCopies(run, announce = true) {
  for (;;) {
    const groups = new Map();
    for (const zone of ['board', 'bench']) {
      for (const unit of run[zone]) {
        if (unit.star >= 3) continue;
        const key = unit.id + ':' + unit.star;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(unit);
      }
    }
    const triple = [...groups.values()].find(copies => copies.length >= 3);
    if (!triple) return;
    const [survivor, ...consumed] = triple.slice(0, 3);
    for (const zone of ['board', 'bench']) {
      for (let index = run[zone].length - 1; index >= 0; index--) {
        if (consumed.includes(run[zone][index])) run[zone].splice(index, 1);
      }
    }
    survivor.star++;
    Object.assign(survivor, chessStats(survivor.id, survivor.star));
    for (const item of consumed.flatMap(unit => unit.items ?? [])) {
      const placement = chessItemPlacement(survivor, item);
      if (placement) (survivor.items ??= [])[placement.slot] = placement.id;
      else run.items.push(item);
    }
    if (announce) {
      record(run, `${survivor.display_name} hợp thể ${survivor.star} sao.`);
      const onBoard = run.board.includes(survivor);
      gameEvents.emit('chess_units_merged', {
        unit_id: survivor.id, star: survivor.star, x: survivor.x, y: survivor.y,
        bench_slot: onBoard ? null : chessBenchSlots(run).indexOf(run.bench.indexOf(survivor)),
      });
    }
  }
}

function rollChessShop(run, units, config, bot = null) {
  const odds = config.probabilities_percent[String(bot?.level ?? run.level)];
  let seed = (run.seed + (run.lobby ? 131 * run.round + 701 * (bot?.id ?? 0) : 0)) >>> 0;
  const pool = chessPoolCounts(run, Boolean(bot));
  const draw = total => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed >>> 8) % total;
  };
  function choose(items, weights) {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total === 0) return null;
    let roll = draw(total);
    return items.find((_, index) => (roll -= weights[index]) < 0) ?? null;
  }
  return Array.from({ length: SHOP_SIZE }, () => {
    const stock = unit => run.lobby ? Math.max(0, pool.get(unit.id) ?? 0) : 1;
    const tiers = config.cost_tiers.map(tier => units.filter(unit => unit.cost === tier && stock(unit) > 0));
    const group = choose(tiers, tiers.map((items, index) => items.length ? odds[index] : 0));
    if (!group) return null;
    const unit = choose(group, group.map(stock));
    if (run.lobby) pool.set(unit.id, pool.get(unit.id) - 1);
    return structuredClone(unit);
  });
}

function botRoster(units, seed) {
  let value = seed >>> 0;
  const count = 2 + (seed % 3);
  return Array.from({ length: count }, (_, index) => {
    value = (value * 1664525 + 1013904223) >>> 0;
    const unit = structuredClone(units[value % units.length]);
    return { ...unit, ...chessStats(unit.id, 1), star: 1, team: 'enemy', actorId: `op:${seed}:${index}`, x: index % 7, y: 1 + Math.floor(index / 7) };
  });
}

function chessStats(id, star) {
  const base = {
    chr_bunbo_holinh: [690, 68, 34], chr_pho_lamvu: [510, 86, 24],
    chr_goicuon_diepnhi: [590, 52, 31], chr_banhbao_bachngoc: [820, 42, 52],
    chr_caphe_davu: [470, 94, 20], mob_pepper_01: [490, 75, 24],
    mob_mushroom_01: [770, 44, 45], npc_lilia: [610, 60, 32],
  }[id] ?? [500, 60, 30];
  const multiplier = star === 1 ? 1 : star === 2 ? 1.8 : 3.2;
  return { hp: Math.floor(base[0] * multiplier), maxHp: Math.floor(base[0] * multiplier), atk: Math.floor(base[1] * multiplier), def: Math.floor(base[2] * multiplier) };
}

function record(run, message) { run.log.unshift(message); run.log = run.log.slice(0, 30); }
function assertPrepare(run) { if (run.phase !== 'prepare') throw new Error('Chỉ được thao tác trong giai đoạn chuẩn bị.'); }
