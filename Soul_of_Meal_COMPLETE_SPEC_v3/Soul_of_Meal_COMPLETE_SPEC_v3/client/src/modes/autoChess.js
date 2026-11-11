import { gameEvents } from '../core/events.js';

export const CHESS_TRAITS = {
  fire: { name: 'Bếp Lửa', detail: '+15% công cho quân Hỏa', stat: 'atk', bonus: .15 },
  wood: { name: 'Mầm Sống', detail: '+15% máu cho quân Mộc', stat: 'maxHp', bonus: .15 },
  light: { name: 'Hộ Quang', detail: '+15% thủ cho quân Quang', stat: 'def', bonus: .15 },
};

export function chessTraits(units) {
  const counts = new Map();
  for (const unit of new Map(units.map((unit) => [unit.id, unit])).values()) {
    counts.set(unit.element, (counts.get(unit.element) ?? 0) + 1);
  }
  return counts;
}

function applyTraits(units) {
  const counts = chessTraits(units);
  for (const unit of units) {
    const trait = CHESS_TRAITS[unit.element];
    if (!trait || counts.get(unit.element) < 2) continue;
    unit[trait.stat] = Math.floor(unit[trait.stat] * (1 + trait.bonus));
    if (trait.stat === 'maxHp') unit.hp = unit.maxHp;
  }
}

export function createChessRun(units, shopConfig, seed = 2077) {
  const run = {
    phase: 'prepare', round: 1, stage: 1, hp: 100, gold: 10, level: 2, experience: 0,
    bench: [], board: [], shopLocked: false, shop: [], seed, wins: 0, losses: 0,
    log: ['Vòng 1: chuẩn bị đội hình.'], combat: null, result: null,
    opponents: Array.from({ length: 7 }, (_, index) => ({ id: index + 1, hp: 100, units: botRoster(units, index + seed) })),
  };
  run.shop = rollChessShop(run, units, shopConfig, 5);
  return run;
}

export function buyChessOffer(run, slot) {
  assertPrepare(run);
  const offer = run.shop[slot];
  if (!offer) throw new Error('Ô cửa hàng trống.');
  if (run.bench.length >= 9) throw new Error('Băng ghế đã đủ 9 vị trí.');
  if (run.gold < offer.cost) throw new Error('Không đủ vàng.');
  const updated = structuredClone(run);
  const unit = updated.shop[slot];
  updated.shop[slot] = null;
  updated.gold -= unit.cost;
  updated.bench.push({ ...unit, star: 1, hp: 0, atk: 0, def: 0, placementOrder: updated.bench.length });
  mergeChessCopies(updated);
  record(updated, `Đã mua ${unit.display_name}.`);
  gameEvents.emit('chess_unit_bought', { unit_id: unit.id, cost: unit.cost });
  return updated;
}

export function placeChessUnit(run, benchIndex, x, y) {
  assertPrepare(run);
  if (run.board.length >= run.level) throw new Error(`Cấp ${run.level} chỉ dùng được ${run.level} quân.`);
  if (x < 0 || x >= 7 || y < 0 || y >= 4) throw new Error('Chọn ô phía đội mình trên bàn 7×4.');
  const updated = structuredClone(run);
  const existingIndex = updated.board.findIndex((unit) => unit.x === x && unit.y === y);
  if (existingIndex >= 0) throw new Error('Ô này đã có quân.');
  const [unit] = updated.bench.splice(benchIndex, 1);
  if (!unit) throw new Error('Không tìm thấy quân trên ghế dự bị.');
  const stats = chessStats(unit.id, unit.star);
  updated.board.push({ ...unit, ...stats, x, y, placementOrder: updated.board.length });
  mergeChessCopies(updated);
  record(updated, `${unit.display_name} đã vào vị trí (${x + 1}, ${y + 1}).`);
  gameEvents.emit('chess_unit_placed', { unit_id: unit.id, x, y });
  return updated;
}

export function moveChessUnit(run, boardIndex, x, y) {
  assertPrepare(run);
  if (x < 0 || x >= 7 || y < 0 || y >= 4) throw new Error('Chọn ô hợp lệ ở nửa bàn của bạn.');
  const updated = structuredClone(run);
  const selected = updated.board[boardIndex];
  if (!selected) throw new Error('Không tìm thấy quân.');
  const other = updated.board.find((unit) => unit.x === x && unit.y === y);
  if (other) { other.x = selected.x; other.y = selected.y; }
  selected.x = x; selected.y = y;
  return updated;
}

export function sellChessUnit(run, zone, index) {
  assertPrepare(run);
  const updated = structuredClone(run);
  const list = zone === 'board' ? updated.board : updated.bench;
  const [unit] = list.splice(index, 1);
  if (!unit) throw new Error('Không tìm thấy quân.');
  const refund = unit.cost * unit.star;
  updated.gold += refund;
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
  updated.shop = rollChessShop(updated, units, shopConfig, 5);
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

export function startChessCombat(run) {
  assertPrepare(run);
  const updated = structuredClone(run);
  const opponent = updated.opponents[(updated.round - 1) % updated.opponents.length];
  const friendly = updated.board.map((unit, index) => ({ ...unit, team: 'player', actorId: `p:${unit.id}:${index}`, cooldown: 0 }));
  const enemyUnits = opponent.units.map((unit, index) => ({ ...unit, team: 'enemy', actorId: `b${opponent.id}:${unit.id}:${index}`, x: unit.x, y: unit.y + 4, cooldown: 6 + index * 2 }));
  applyTraits(friendly);
  applyTraits(enemyUnits);
  const actors = [...friendly, ...enemyUnits];
  updated.combat = { tick: 0, actors, startActors: structuredClone(actors), events: [] };
  updated.phase = 'combat';
  record(updated, `Vòng ${updated.round}: giao tranh tự động với đối thủ ${opponent.id}.`);
  gameEvents.emit('chess_combat_started', { round: updated.round, opponent_id: opponent.id });
  return resolveChessCombat(updated);
}

export function advanceChessRound(run, units, shopConfig) {
  if (run.phase !== 'result') throw new Error('Trận đấu chưa có kết quả.');
  const updated = structuredClone(run);
  if (updated.hp <= 0 || updated.round >= 10) {
    updated.phase = 'finished';
    updated.result = updated.wins > updated.losses ? 'victory' : 'complete';
    return updated;
  }
  updated.round += 1;
  updated.stage = Math.ceil(updated.round / 3);
  if (updated.level < 9) {
    updated.experience = (updated.experience ?? 0) + 1;
    if (updated.experience >= 4) {
      updated.experience -= 4;
      updated.level += 1;
    }
  }
  if (!updated.shopLocked) updated.shop = rollChessShop(updated, units, shopConfig, 5);
  updated.shopLocked = false;
  updated.phase = 'prepare';
  updated.combat = null;
  updated.result = null;
  record(updated, `Vòng ${updated.round}: nhận thu nhập và chuẩn bị đội hình.`);
  return updated;
}

export function buyChessExperience(run, units, shopConfig) {
  assertPrepare(run);
  if (run.level >= 9 || run.gold < 4) throw new Error('Cần 4 vàng và cấp dưới 9.');
  const updated = structuredClone(run);
  updated.gold -= 4;
  updated.level += 1;
  if (!updated.shopLocked) {
    updated.seed += 1;
    updated.shop = rollChessShop(updated, units, shopConfig, 5);
  }
  record(updated, `Đã nâng cửa hàng và đội hình lên cấp ${updated.level}.`);
  return updated;
}

function resolveChessCombat(run) {
  const combat = run.combat;
  const maxTicks = 45 * 30;
  while (combat.tick < maxTicks) {
    const alivePlayers = combat.actors.filter((actor) => actor.team === 'player' && actor.hp > 0);
    const aliveEnemies = combat.actors.filter((actor) => actor.team === 'enemy' && actor.hp > 0);
    if (!alivePlayers.length || !aliveEnemies.length) break;
    combat.tick += 1;
    for (const actor of combat.actors) {
      if (actor.hp <= 0 || actor.cooldown > 0) { actor.cooldown = Math.max(0, actor.cooldown - 1); continue; }
      const targets = combat.actors.filter((candidate) => candidate.hp > 0 && candidate.team !== actor.team);
      const target = targets.sort((a, b) => distance(actor, a) - distance(actor, b) || a.actorId.localeCompare(b.actorId))[0];
      if (!target) continue;
      const range = ['mage', 'ranged', 'support'].includes(actor.job) ? 3 : 1;
      if (distance(actor, target) > range) {
        const dx = Math.sign(target.x - actor.x); const dy = Math.sign(target.y - actor.y);
        const horizontal = { x: actor.x + dx, y: actor.y };
        const vertical = { x: actor.x, y: actor.y + dy };
        const routes = Math.abs(target.x - actor.x) >= Math.abs(target.y - actor.y)
          ? [horizontal, vertical] : [vertical, horizontal];
        const next = routes.find(({ x, y }) => !combat.actors.some((other) => other.hp > 0 && other.x === x && other.y === y));
        if (next) {
          Object.assign(actor, next);
          combat.events.push({ tick: combat.tick, type: 'move', source_id: actor.actorId, ...next });
        }
        actor.cooldown = next ? 7 : 4;
      } else {
        const damage = Math.max(1, actor.atk - target.def);
        target.hp = Math.max(0, target.hp - damage);
        combat.events.push({ tick: combat.tick, type: 'hit_resolved', source_id: actor.actorId, target_id: target.actorId, payload: { damage, hp: target.hp, element: actor.element } });
        gameEvents.emit('hit_resolved', { damage, hp_damage: damage, source_kind: 'auto_chess_attack' }, {
          battle_id: `battle_chess_${run.round}`,
          rules_version: 'client-auto-chess-v1',
          tick: combat.tick,
          source_id: actor.actorId,
          target_id: target.actorId,
        });
        actor.cooldown = actor.job === 'assassin' ? 22 : 30;
      }
    }
  }
  const playerHp = combat.actors.filter((actor) => actor.team === 'player' && actor.hp > 0).reduce((sum, unit) => sum + unit.hp, 0);
  const enemyHp = combat.actors.filter((actor) => actor.team === 'enemy' && actor.hp > 0).reduce((sum, unit) => sum + unit.hp, 0);
  const won = playerHp > enemyHp;
  const opponent = run.opponents[(run.round - 1) % run.opponents.length];
  const damage = won ? 0 : Math.min(25, 2 + Math.floor(run.stage / 2) + combat.actors.filter((actor) => actor.team === 'enemy' && actor.hp > 0).reduce((sum, unit) => sum + unit.star, 0));
  run.hp = Math.max(0, run.hp - damage);
  if (won) { run.wins += 1; opponent.hp = Math.max(0, opponent.hp - 12); }
  else { run.losses += 1; }
  const income = 5 + (won ? 1 : 0) + Math.min(Math.floor(run.gold / 10), 5);
  run.gold += income;
  run.phase = 'result';
  run.result = { won, damage, income, playerHp, enemyHp, ticks: combat.tick };
  run.log.unshift(won ? `Chiến thắng · +${income} vàng.` : `Thất bại · -${damage} HP, +${income} vàng.`);
  run.log = run.log.slice(0, 30);
  gameEvents.emit('chess_combat_finished', { won, damage, income, ticks: combat.tick });
  return run;
}

function mergeChessCopies(run) {
  let merged = true;
  while (merged) {
    merged = false;
    const groups = new Map();
    for (const zone of ['board', 'bench']) {
      for (const unit of run[zone]) {
        const key = `${unit.id}:${unit.star}`;
        groups.set(key, [...(groups.get(key) ?? []), { zone, unit }]);
      }
    }
    const triple = [...groups.values()].find((copies) => copies.length >= 3);
    if (!triple) return;
    const copies = triple.slice(0, 3);
    const destination = copies.find((copy) => copy.zone === 'board') ?? copies[0];
    const survivor = destination.unit;
    const consumed = new Set(copies.filter((copy) => copy !== destination).map((copy) => copy.unit));
    for (const zone of ['board', 'bench']) run[zone] = run[zone].filter((unit) => !consumed.has(unit));
    survivor.star += 1;
    Object.assign(survivor, chessStats(survivor.id, survivor.star));
    if (destination.zone === 'board') run.board.sort((first, second) => first.placementOrder - second.placementOrder);
    merged = true;
    record(run, `${survivor.display_name} hợp thể ${survivor.star} sao.`);
    gameEvents.emit('chess_units_merged', { unit_id: survivor.id, star: survivor.star });
  }
}

function rollChessShop(run, units, config, count) {
  const odds = config.probabilities_percent[String(run.level)];
  let seed = run.seed >>> 0;
  return Array.from({ length: count }, () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const roll = (seed >>> 0) % 100;
    let total = 0; let tier = config.cost_tiers[0];
    for (let index = 0; index < odds.length; index += 1) { total += odds[index]; if (roll < total) { tier = config.cost_tiers[index]; break; } }
    const pool = units.filter((unit) => unit.cost === tier);
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return structuredClone(pool[seed % pool.length]);
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

function distance(first, second) { return Math.abs(first.x - second.x) + Math.abs(first.y - second.y); }
function record(run, message) { run.log.unshift(message); run.log = run.log.slice(0, 30); }
function assertPrepare(run) { if (run.phase !== 'prepare') throw new Error('Chỉ được thao tác trong giai đoạn chuẩn bị.'); }