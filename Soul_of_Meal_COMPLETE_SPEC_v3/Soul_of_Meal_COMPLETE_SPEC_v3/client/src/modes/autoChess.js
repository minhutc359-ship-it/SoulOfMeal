import { gameEvents } from "../core/events.js";
import {
  CHESS_RULES as R,
  CHESS_TRAITS,
  CHESS_ITEMS,
  RULES_VERSION,
} from "../core/rules.js";

const BOT_NAMES = [
  "Lửa Bếp",
  "Lam Hải",
  "Vườn Gia Vị",
  "Bạch Ngọc",
  "Dạ Hương",
  "Đầu Bếp Mây",
  "Khách Lữ Hành",
];
const STRATEGIES = [
  "aggressive",
  "economy",
  "synergy",
  "guardian",
  "reroll",
  "balanced",
  "adaptive",
];

export function createChessRun(units, shopConfig, seed = 2077) {
  const run = {
    rulesVersion: RULES_VERSION,
    phase: "prepare",
    round: 1,
    stage: 1,
    hp: R.startHp,
    gold: R.startGold,
    level: R.startLevel,
    experience: 0,
    bench: [],
    board: [],
    shopLocked: false,
    shop: [],
    seed: seed >>> 0 || 1,
    wins: 0,
    losses: 0,
    streak: 0,
    placementCounter: 0,
    inventory: [],
    log: ["Vòng 1: mua quân và chuẩn bị đội hình."],
    combat: null,
    result: null,
    catalog: structuredClone(units),
    shopConfig: structuredClone(shopConfig),
    opponents: BOT_NAMES.map((name, index) => ({
      id: index + 1,
      name,
      strategy: STRATEGIES[index],
      hp: R.startHp,
      gold: R.startGold,
      level: R.startLevel,
      experience: 0,
      seed: (seed + 104729 * (index + 1)) >>> 0,
      bench: [],
      board: [],
      shop: [],
      shopLocked: false,
      placementCounter: 0,
      streak: 0,
      wins: 0,
      losses: 0,
      inventory: [],
    })),
  };
  run.shop = rollShop(run, units, shopConfig);
  return run;
}

export function buyChessOffer(run, slot) {
  assertPrepare(run);
  const updated = structuredClone(run);
  purchase(updated, slot, true);
  record(updated, `Đã mua ${run.shop[slot].display_name}.`);
  gameEvents.emit("chess_unit_bought", {
    unit_id: run.shop[slot].id,
    cost: run.shop[slot].cost,
  });
  return updated;
}
function purchase(owner, slot, emit = false) {
  const offer = owner.shop[slot];
  if (!offer) throw new Error("Ô cửa hàng trống.");
  if (owner.gold < offer.cost) throw new Error("Không đủ vàng.");
  const canMerge =
    [...owner.board, ...owner.bench].filter(
      (unit) => unit.id === offer.id && unit.star === 1,
    ).length >= 2;
  if (owner.bench.length >= R.bench && !canMerge)
    throw new Error("Băng ghế đã đủ 9 vị trí.");
  owner.gold -= offer.cost;
  owner.shop[slot] = null;
  owner.bench.push({
    ...offer,
    ...chessStats(offer, 1),
    star: 1,
    placementOrder: owner.placementCounter++,
    items: [],
  });
  mergeCopies(owner, emit);
}

export function placeChessUnit(run, benchIndex, x, y) {
  assertPrepare(run);
  validateCell(x, y);
  const updated = structuredClone(run);
  const unit = updated.bench[benchIndex];
  if (!unit) throw new Error("Không tìm thấy quân trên ghế dự bị.");
  const occupied = updated.board.findIndex(
    (other) => other.x === x && other.y === y,
  );
  if (occupied >= 0) {
    const [other] = updated.board.splice(occupied, 1, {
      ...unit,
      ...chessStats(unit, unit.star),
      x,
      y,
    });
    delete other.x;
    delete other.y;
    updated.bench[benchIndex] = other;
  } else {
    if (updated.board.length >= updated.level)
      throw new Error(
        `Cấp ${updated.level} chỉ dùng được ${updated.level} quân.`,
      );
    updated.bench.splice(benchIndex, 1);
    updated.board.push({ ...unit, ...chessStats(unit, unit.star), x, y });
  }
  gameEvents.emit("chess_unit_placed", { unit_id: unit.id, x, y });
  return updated;
}
export function moveChessUnit(run, boardIndex, x, y) {
  assertPrepare(run);
  validateCell(x, y);
  const updated = structuredClone(run);
  const selected = updated.board[boardIndex];
  if (!selected) throw new Error("Không tìm thấy quân.");
  const other = updated.board.find((unit) => unit.x === x && unit.y === y);
  if (other) {
    other.x = selected.x;
    other.y = selected.y;
  }
  selected.x = x;
  selected.y = y;
  return updated;
}
export function benchChessUnit(run, boardIndex) {
  assertPrepare(run);
  if (run.bench.length >= R.bench) throw new Error("Băng ghế đã đầy.");
  const updated = structuredClone(run);
  const [unit] = updated.board.splice(boardIndex, 1);
  if (!unit) throw new Error("Không tìm thấy quân.");
  delete unit.x;
  delete unit.y;
  updated.bench.push(unit);
  return updated;
}
export function sellChessUnit(run, zone, index) {
  assertPrepare(run);
  if (
    !["board", "bench"].includes(zone) ||
    !Number.isInteger(index) ||
    index < 0
  )
    throw new Error("Vị trí bán không hợp lệ.");
  const updated = structuredClone(run);
  const [unit] = updated[zone].splice(index, 1);
  if (!unit) throw new Error("Không tìm thấy quân.");
  const refund =
    unit.sell_values?.[unit.star - 1] ??
    unit.cost * R.sellMultipliers[unit.star];
  updated.gold += refund;
  updated.inventory.push(...(unit.items ?? []));
  record(
    updated,
    `Đã bán ${unit.display_name}: +${refund} vàng; trang bị trở về túi.`,
  );
  return updated;
}
export function refreshChessShop(
  run,
  units = run.catalog,
  config = run.shopConfig,
) {
  assertPrepare(run);
  if (run.shopLocked) throw new Error("Mở khóa cửa hàng trước khi làm mới.");
  if (run.gold < R.refreshCost) throw new Error("Không đủ 2 vàng.");
  const updated = structuredClone(run);
  updated.gold -= R.refreshCost;
  updated.shop = rollShop(updated, units, config);
  return updated;
}
export function toggleChessLock(run) {
  assertPrepare(run);
  const updated = structuredClone(run);
  updated.shopLocked = !updated.shopLocked;
  return updated;
}
export function buyChessExperience(run) {
  assertPrepare(run);
  if (run.level >= 9) throw new Error("Đã đạt cấp tối đa.");
  if (run.gold < R.xpCost) throw new Error("Không đủ 4 vàng.");
  const updated = structuredClone(run);
  updated.gold -= R.xpCost;
  grantXp(updated, R.xpPerPurchase);
  return updated;
}
export function equipChessItem(run, zone, index, inventoryIndex) {
  assertPrepare(run);
  if (!["board", "bench"].includes(zone))
    throw new Error("Vị trí không hợp lệ.");
  const updated = structuredClone(run);
  const unit = updated[zone][index];
  const item = updated.inventory[inventoryIndex];
  if (!unit || !CHESS_ITEMS[item])
    throw new Error("Không tìm thấy quân hoặc trang bị.");
  if ((unit.items?.length ?? 0) >= 3)
    throw new Error("Mỗi quân tối đa 3 trang bị.");
  (unit.items ??= []).push(updated.inventory.splice(inventoryIndex, 1)[0]);
  Object.assign(unit, chessStats(unit, unit.star));
  return updated;
}
export function chessSynergies(board) {
  const unique = [...new Map(board.map((unit) => [unit.id, unit])).values()];
  return CHESS_TRAITS.map((trait) => {
    const count =
      trait.id === "cuisine"
        ? unique.length
        : trait.id === "elements"
          ? new Set(unique.map((unit) => unit.element)).size
          : unique.filter(
              (unit) =>
                unit.element === trait.id ||
                unit.job === trait.id ||
                unit.traits?.includes(trait.id),
            ).length;
    return {
      ...trait,
      count,
      tier: trait.thresholds.filter((threshold) => count >= threshold).length,
    };
  });
}
export function chessRoundType(round) {
  return round % 7 === 0 ? "elite" : (round - 1) % 7 === 0 ? "neutral" : "pvp";
}

export function startChessCombat(run) {
  assertPrepare(run);
  const updated = structuredClone(run);
  const type = chessRoundType(updated.round);
  for (const bot of updated.opponents.filter((opponent) => opponent.hp > 0))
    planBot(bot, updated.catalog, updated.shopConfig);
  const alive = [
    { ...updated, id: 0, name: "Bạn" },
    ...updated.opponents.filter((bot) => bot.hp > 0),
  ];
  const offset = (updated.round - 1) % Math.max(1, alive.length - 1);
  const rotated = [
    alive[0],
    ...alive.slice(1 + offset),
    ...alive.slice(1, 1 + offset),
  ];
  const outcomes = new Map();
  let playerCombat = null;
  if (type !== "pvp") {
    for (const owner of alive) {
      const neutral = neutralBoard(updated, type);
      const combat = simulate(
        owner.board,
        neutral,
        `r${updated.round}:${owner.id}`,
      );
      outcomes.set(owner.id, outcome(combat, "player", updated));
      if (owner.id === 0)
        playerCombat = {
          ...combat,
          opponentName:
            type === "elite"
              ? "Bếp Trưởng Hỏa Diệm · Lv.50"
              : "Quái Rừng Gia Vị",
          opponentId: "neutral",
          roundType: type,
        };
    }
  } else {
    for (let index = 0; index < rotated.length; index += 2) {
      const first = rotated[index];
      const second = rotated[index + 1] ?? rotated[0];
      const ghost = index + 1 >= rotated.length;
      const combat = simulate(
        first.board,
        second.board,
        `r${updated.round}:${first.id}:${second.id}`,
      );
      outcomes.set(first.id, outcome(combat, "player", updated));
      if (!ghost) outcomes.set(second.id, outcome(combat, "enemy", updated));
      if (first.id === 0)
        playerCombat = {
          ...combat,
          opponentName: second.name,
          opponentId: second.id,
          roundType: type,
        };
    }
  }
  for (const owner of [updated, ...updated.opponents]) {
    if (owner.hp <= 0) continue;
    const id = owner === updated ? 0 : owner.id;
    const result = outcomes.get(id);
    if (!result) continue;
    const suddenDeath =
      updated.round >= R.suddenDeathRound
        ? (updated.round - R.suddenDeathRound + 1) * 5
        : 0;
    result.damage =
      result.won || result.draw
        ? 0
        : Math.min(100, result.damage + suddenDeath);
    owner.hp = Math.max(0, owner.hp - result.damage);
    if (result.won) {
      owner.wins++;
      owner.streak = Math.max(0, owner.streak ?? 0) + 1;
    } else if (!result.draw) {
      owner.losses++;
      owner.streak = Math.min(0, owner.streak ?? 0) - 1;
    }
    const interest = Math.min(R.interestCap, Math.floor(owner.gold / 10));
    const streak = Math.abs(owner.streak ?? 0);
    const streakIncome =
      streak >= 6 ? 3 : streak >= 4 ? 2 : streak >= 2 ? 1 : 0;
    result.income = R.baseIncome + Number(result.won) + interest + streakIncome;
    result.interest = interest;
    result.streakIncome = streakIncome;
    owner.gold += result.income;
  }
  for (const bot of updated.opponents) {
    const reward = outcomes.get(bot.id);
    if (reward?.won && type !== "pvp") {
      const item =
        Object.keys(CHESS_ITEMS)[
          (updated.round - 1) % Object.keys(CHESS_ITEMS).length
        ];
      const unit = bot.board.find((unit) => (unit.items?.length ?? 0) < 3);
      if (unit) (unit.items ??= []).push(item);
      else bot.inventory.push(item);
    }
  }
  // Resolve a simultaneous lobby wipe by the pre-round standing, preserving one winner.
  if (updated.hp <= 0 && updated.opponents.every((bot) => bot.hp <= 0)) {
    const survivor = [...alive].sort((a, b) => b.hp - a.hp || a.id - b.id)[0];
    if (survivor.id === 0) updated.hp = 1;
    else updated.opponents.find((bot) => bot.id === survivor.id).hp = 1;
  }
  const result = outcomes.get(0);
  // Neutral rounds offer deterministic item rewards to the player.
  if (result.won && type !== "pvp") {
    result.item =
      Object.keys(CHESS_ITEMS)[
        (updated.round - 1) % Object.keys(CHESS_ITEMS).length
      ];
    updated.inventory.push(result.item);
  }
  updated.combat = playerCombat;
  updated.phase = "result";
  updated.result = result;
  updated.standings = standings(updated);
  record(
    updated,
    `${result.won ? "Chiến thắng" : result.draw ? "Hòa" : "Thất bại"} vòng ${updated.round} · -${result.damage} HP · +${result.income} vàng.`,
  );
  gameEvents.emit("chess_combat_started", {
    round: updated.round,
    opponent_id: playerCombat.opponentId,
    boss: type === "elite",
  });
  gameEvents.emit("chess_combat_finished", { ...result, round: updated.round });
  return updated;
}
export function advanceChessRound(
  run,
  units = run.catalog,
  config = run.shopConfig,
) {
  if (run.phase !== "result") throw new Error("Trận đấu chưa có kết quả.");
  const updated = structuredClone(run);
  if (
    updated.hp <= 0 ||
    updated.opponents.every((opponent) => opponent.hp <= 0)
  ) {
    updated.phase = "finished";
    updated.placement =
      updated.hp > 0
        ? 1
        : 1 + updated.opponents.filter((opponent) => opponent.hp > 0).length;
    updated.result = updated.placement === 1 ? "victory" : "complete";
    gameEvents.emit("battle_finished", {
      mode: "chess",
      placement: updated.placement,
    });
    return updated;
  }
  updated.round++;
  updated.stage = Math.ceil(updated.round / 3);
  grantXp(updated, R.xpPerRound);
  for (const bot of updated.opponents.filter((opponent) => opponent.hp > 0))
    grantXp(bot, R.xpPerRound);
  if (!updated.shopLocked) updated.shop = rollShop(updated, units, config);
  updated.phase = "prepare";
  updated.combat = null;
  updated.result = null;
  return updated;
}
export function surrenderChess(run) {
  const updated = structuredClone(run);
  updated.hp = 0;
  updated.phase = "finished";
  updated.placement = 1 + updated.opponents.filter((bot) => bot.hp > 0).length;
  updated.result = "complete";
  return updated;
}
function standings(run) {
  return [
    { id: 0, name: "Bạn", hp: run.hp, level: run.level, gold: run.gold },
    ...run.opponents.map(({ id, name, hp, level, gold }) => ({
      id,
      name,
      hp,
      level,
      gold,
    })),
  ].sort((a, b) => b.hp - a.hp || a.id - b.id);
}
function planBot(bot, units, config) {
  if (!bot.shopLocked || !bot.shop.length)
    bot.shop = rollShop(bot, units, config);
  bot.shopLocked = false;
  if (bot.level < 9 && bot.gold >= (bot.strategy === "economy" ? 34 : 20)) {
    bot.gold -= R.xpCost;
    grantXp(bot, R.xpPerPurchase);
  }
  const reserve =
    bot.strategy === "economy" && bot.board.length >= bot.level ? 10 : 0;
  const slots = bot.shop
    .map((unit, slot) => ({
      unit,
      slot,
      score: unit
        ? bot.bench.filter((copy) => copy.id === unit.id && copy.star === 1)
            .length *
            8 +
          (bot.board.some((copy) => copy.id === unit.id) ? 5 : 1) +
          (bot.strategy === "guardian" && unit.job === "guardian" ? 4 : 0)
        : -1,
    }))
    .sort((a, b) => b.score - a.score);
  for (const { unit, slot } of slots)
    if (unit && bot.gold - unit.cost >= reserve) {
      try {
        purchase(bot, slot);
      } catch {
        /* Fair bench/economy constraints apply. */
      }
    }
  if (bot.strategy === "reroll" && bot.gold > 15) {
    bot.gold -= R.refreshCost;
    bot.shop = rollShop(bot, units, config);
    for (let slot = 0; slot < bot.shop.length; slot++)
      if (bot.shop[slot] && bot.gold - bot.shop[slot].cost >= 10) {
        try {
          purchase(bot, slot);
        } catch {}
      }
  }
  const army = [...bot.board, ...bot.bench].sort(
    (a, b) =>
      b.star - a.star || b.cost - a.cost || a.placementOrder - b.placementOrder,
  );
  const occupied = new Set();
  bot.board = army.splice(0, bot.level).map((unit) => {
    const back = ["mage", "support", "ranged"].includes(unit.job);
    const rows = back ? [0, 1, 2, 3] : [3, 2, 1, 0];
    const cells = rows.flatMap((y) =>
      [3, 2, 4, 1, 5, 0, 6].map((x) => ({ x, y })),
    );
    const cell = cells.find(({ x, y }) => !occupied.has(`${x},${y}`));
    occupied.add(`${cell.x},${cell.y}`);
    return { ...unit, ...chessStats(unit, unit.star), ...cell };
  });
  bot.bench = army.slice(0, R.bench);
}
function neutralBoard(run, type) {
  const count = type === "elite" ? 1 : 2;
  return Array.from({ length: count }, (_, index) => ({
    id: `neutral_${index}`,
    display_name: type === "elite" ? "Bếp Trưởng Hỏa Diệm" : "Nấm Gia Vị",
    element: type === "elite" ? "fire" : "wood",
    job: "fighter",
    x: 2 + index * 2,
    y: 2,
    star: Math.min(3, Math.ceil(run.stage / 4)),
    cost: 1,
    stats: {
      hp: (type === "elite" ? 1200 : 350) + run.stage * 85,
      atk: 30 + run.stage * 8,
      def: 12,
    },
    attack_range: 1,
    items: [],
  }));
}
function simulate(playerBoard, enemyBoard, battleId) {
  const actors = [
    ...prepareActors(playerBoard, "player"),
    ...prepareActors(enemyBoard, "enemy"),
  ];
  const combat = {
    battleId,
    tick: 0,
    actors,
    events: [],
    frames: [{ tick: 0, actors: structuredClone(actors) }],
  };
  for (const team of ["player", "enemy"]) {
    const synergy = chessSynergies(
      team === "player" ? playerBoard : enemyBoard,
    );
    const burst = synergy.find((trait) => trait.id === "elements").tier;
    if (burst)
      for (const target of actors.filter((actor) => actor.team !== team))
        damageActor(combat, null, target, burst * 90, "synergy");
  }
  while (combat.tick < R.timeoutTicks) {
    const playerAlive = actors.some(
      (actor) => actor.team === "player" && actor.hp > 0,
    );
    const enemyAlive = actors.some(
      (actor) => actor.team === "enemy" && actor.hp > 0,
    );
    if (!playerAlive || !enemyAlive) break;
    combat.tick++;
    for (const actor of actors) {
      if (actor.hp <= 0) continue;
      if (actor.cooldown-- > 0) continue;
      const targets = actors
        .filter((target) => target.hp > 0 && target.team !== actor.team)
        .sort(
          (a, b) =>
            hexDistance(actor, a) - hexDistance(actor, b) ||
            a.hp / a.maxHp - b.hp / b.maxHp ||
            a.actorId.localeCompare(b.actorId),
        );
      const target = targets[0];
      if (!target) continue;
      if (actor.energy >= 100) {
        actor.energy = 0;
        if (actor.job === "support") {
          const ally = actors
            .filter(
              (candidate) => candidate.team === actor.team && candidate.hp > 0,
            )
            .sort(
              (a, b) =>
                a.hp / a.maxHp - b.hp / b.maxHp ||
                a.actorId.localeCompare(b.actorId),
            )[0];
          const healing = Math.min(
            ally.maxHp - ally.hp,
            Math.floor(actor.atk * 2),
          );
          ally.hp += healing;
          combat.events.push({
            tick: combat.tick,
            type: "heal_resolved",
            source_id: actor.actorId,
            target_id: ally.actorId,
            payload: { healing, element: actor.element },
          });
        } else if (actor.job === "guardian")
          actor.shield += Math.floor(actor.maxHp * 0.2);
        else if (hexDistance(actor, target) <= actor.range)
          damageActor(
            combat,
            actor,
            target,
            Math.floor(actor.atk * 1.8),
            "skill",
          );
        actor.cooldown = 30;
        continue;
      }
      if (hexDistance(actor, target) > actor.range) {
        const step = findHexStep(actor, target, actors, actor.range);
        if (step) {
          actor.x = step.x;
          actor.y = step.y;
        }
        actor.cooldown = 5;
      } else {
        combat.events.push({
          tick: combat.tick,
          type: "attack_started",
          source_id: actor.actorId,
          target_id: target.actorId,
          payload: { element: actor.element, projectile: actor.range > 1 },
        });
        damageActor(
          combat,
          actor,
          target,
          actor.atk,
          actor.range > 1 ? "projectile" : "melee",
        );
        actor.energy = Math.min(100, actor.energy + 25);
        actor.cooldown = actor.job === "assassin" ? 22 : 30;
      }
    }
    if (combat.tick % 6 === 0)
      combat.frames.push({
        tick: combat.tick,
        actors: structuredClone(actors),
      });
  }
  combat.frames.push({ tick: combat.tick, actors: structuredClone(actors) });
  return combat;
}
function prepareActors(board, team) {
  const traits = chessSynergies(board);
  const cuisine = traits.find((trait) => trait.id === "cuisine").tier;
  const guardian = traits.find((trait) => trait.id === "guardian").tier;
  return board.map((unit, index) => {
    const stats = chessStats(unit, unit.star);
    const element =
      traits.find((trait) => trait.id === unit.element)?.tier ?? 0;
    const maxHp = Math.floor(
      stats.maxHp * (unit.job === "guardian" ? 1 + guardian * 0.3 : 1),
    );
    return {
      ...unit,
      ...stats,
      hp: maxHp,
      maxHp,
      atk: Math.floor(stats.atk * (1 + cuisine * 0.2 + element * 0.1)),
      x: team === "enemy" ? 6 - unit.x : unit.x,
      y: team === "enemy" ? 7 - unit.y : unit.y,
      team,
      actorId: `${team}:${unit.id}:${index}`,
      cooldown: index * 2,
      shield: 0,
      energy: 0,
      range:
        unit.attack_range ??
        (["mage", "support", "ranged"].includes(unit.job) ? 3 : 1),
    };
  });
}
function damageActor(combat, source, target, raw, kind) {
  const damage = Math.max(1, raw - target.def);
  const absorbed = Math.min(target.shield ?? 0, damage);
  target.shield = Math.max(0, (target.shield ?? 0) - absorbed);
  target.hp = Math.max(0, target.hp - damage + absorbed);
  target.energy = Math.min(100, (target.energy ?? 0) + 5);
  combat.events.push({
    tick: combat.tick,
    type: "hit_resolved",
    source_id: source?.actorId,
    target_id: target.actorId,
    payload: {
      damage: damage - absorbed,
      absorbed,
      element: source?.element,
      source_kind: kind,
      source_position: source ? { x: source.x, y: source.y } : null,
      target_position: { x: target.x, y: target.y },
      distance: source ? hexDistance(source, target) : 0,
      range: source?.range ?? 0,
    },
  });
  if (!target.hp)
    combat.events.push({
      tick: combat.tick,
      type: "actor_died",
      target_id: target.actorId,
      payload: {},
    });
}
function outcome(combat, team, run) {
  const own = combat.actors.filter((actor) => actor.team === team);
  const rivals = combat.actors.filter((actor) => actor.team !== team);
  const score = (actors) =>
    actors.reduce((sum, actor) => sum + actor.hp / actor.maxHp, 0) /
    Math.max(1, actors.length);
  const playerHp = own.reduce((sum, actor) => sum + actor.hp, 0);
  const enemyHp = rivals.reduce((sum, actor) => sum + actor.hp, 0);
  let won = score(own) > score(rivals);
  let draw = score(own) === score(rivals) && own.length > 0;
  if (
    score(own) === score(rivals) &&
    (run.round >= R.suddenDeathRound || (!own.length && !rivals.length))
  ) {
    const hash = [...combat.battleId].reduce(
      (sum, char) => sum + char.charCodeAt(0),
      0,
    );
    won = team === (hash % 2 ? "player" : "enemy");
    draw = false;
  }
  return {
    won,
    draw,
    damage:
      won || draw
        ? 0
        : Math.min(
            R.maxDamage,
            2 +
              Math.floor(run.stage / 2) +
              rivals
                .filter((actor) => actor.hp > 0)
                .reduce((sum, actor) => sum + actor.star, 0),
          ),
    playerHp,
    enemyHp,
    ticks: combat.tick,
  };
}
function mergeCopies(owner, emit = false) {
  while (true) {
    const groups = new Map();
    for (const zone of ["board", "bench"])
      for (const unit of owner[zone]) {
        if (unit.star >= R.maxStar) continue;
        const key = `${unit.id}:${unit.star}`;
        groups.set(key, [...(groups.get(key) ?? []), { unit, zone }]);
      }
    const group = [...groups.values()].find((copies) => copies.length >= 3);
    if (!group) return;
    const copies = group
      .sort(
        (a, b) =>
          Number(a.zone !== "board") - Number(b.zone !== "board") ||
          a.unit.placementOrder - b.unit.placementOrder,
      )
      .slice(0, 3);
    const survivor = copies[0].unit;
    const consumed = new Set(copies.slice(1).map((copy) => copy.unit));
    const items = copies.flatMap((copy) => copy.unit.items ?? []);
    survivor.items = items.slice(0, 3);
    if (owner.inventory) owner.inventory.push(...items.slice(3));
    for (const zone of ["board", "bench"])
      owner[zone] = owner[zone].filter((unit) => !consumed.has(unit));
    survivor.star++;
    if (emit)
      gameEvents.emit("chess_units_merged", {
        unit_id: survivor.id,
        star: survivor.star,
      });
    Object.assign(survivor, chessStats(survivor, survivor.star));
  }
}
export function chessStats(unit, star = 1) {
  const base = unit.stats ?? { hp: 500, atk: 60, def: 30 };
  const multiplier =
    unit.star_multipliers?.[star - 1] ?? R.starMultipliers[star];
  const items = (unit.items ?? []).map((id) => CHESS_ITEMS[id]).filter(Boolean);
  const hp =
    Math.floor(base.hp * multiplier) +
    items.reduce((sum, item) => sum + item.hp, 0);
  return {
    hp,
    maxHp: hp,
    atk:
      Math.floor(base.atk * multiplier) +
      items.reduce((sum, item) => sum + item.atk, 0),
    def:
      Math.floor(base.def * multiplier) +
      items.reduce((sum, item) => sum + item.def, 0),
  };
}
function grantXp(owner, amount) {
  owner.experience += amount;
  while (owner.level < 9 && owner.experience >= R.xpToNext[owner.level]) {
    owner.experience -= R.xpToNext[owner.level];
    owner.level++;
  }
}
function random(owner) {
  let value = owner.seed >>> 0 || 1;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  owner.seed = value >>> 0;
  return owner.seed;
}
function rollShop(owner, units, config) {
  const odds = config.probabilities_percent[String(owner.level)];
  return Array.from({ length: R.shop }, () => {
    const roll = random(owner) % 100;
    let total = 0;
    let tier = config.cost_tiers[0];
    for (let index = 0; index < odds.length; index++) {
      total += odds[index];
      if (roll < total) {
        tier = config.cost_tiers[index];
        break;
      }
    }
    const pool = units.filter((unit) => unit.cost === tier);
    return pool.length
      ? structuredClone(pool[random(owner) % pool.length])
      : null;
  });
}
function hexNeighbors(cell) {
  const odd = cell.y % 2;
  return [
    [-1, 0],
    [1, 0],
    [odd - 1, -1],
    [odd, -1],
    [odd - 1, 1],
    [odd, 1],
  ]
    .map(([dx, dy]) => ({ x: cell.x + dx, y: cell.y + dy }))
    .filter(({ x, y }) => x >= 0 && x < 7 && y >= 0 && y < 8);
}
function cube(cell) {
  const x = cell.x - (cell.y - (cell.y & 1)) / 2;
  return { x, z: cell.y, y: -x - cell.y };
}
function hexDistance(a, b) {
  a = cube(a);
  b = cube(b);
  return Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(a.z - b.z),
  );
}
function findHexStep(actor, target, actors, range) {
  const blocked = new Set(
    actors
      .filter((unit) => unit.hp > 0 && unit !== actor)
      .map((unit) => `${unit.x},${unit.y}`),
  );
  const queue = [{ ...actor, first: null }];
  const seen = new Set([`${actor.x},${actor.y}`]);
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head];
    if (node.first && hexDistance(node, target) <= range) return node.first;
    for (const next of hexNeighbors(node).sort(
      (a, b) =>
        hexDistance(a, target) - hexDistance(b, target) ||
        a.y - b.y ||
        a.x - b.x,
    )) {
      const key = `${next.x},${next.y}`;
      if (blocked.has(key) || seen.has(key)) continue;
      seen.add(key);
      queue.push({ ...next, first: node.first ?? next });
    }
  }
  return null;
}
function validateCell(x, y) {
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    x >= R.columns ||
    y < 0 ||
    y >= R.rows / 2
  )
    throw new Error("Chọn ô hợp lệ trong nửa bàn 7×4.");
}
function record(run, text) {
  run.log.unshift({ text });
  run.log = run.log.slice(0, 40);
}
function assertPrepare(run) {
  if (run.phase !== "prepare")
    throw new Error("Chỉ được thao tác trong giai đoạn chuẩn bị.");
}
