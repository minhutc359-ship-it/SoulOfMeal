import { gameEvents } from "../core/events.js";
import { TCG_RULES, RULES_VERSION } from "../core/rules.js";

const MAX_ROUNDS = 40;

export function createPresetDeck(kind = "balanced") {
  const selections = {
    balanced: [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 16, 19, 20, 21, 22],
    fire: [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 16, 17, 19, 21, 24],
    water: [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 15, 17, 19, 20, 21, 22, 23],
    wood: [1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 18, 19, 20, 21, 22, 23],
  };
  return {
    deck_id: kind,
    cards: (selections[kind] ?? selections.balanced).map((id) => ({
      card_id: `card_demo_${String(id).padStart(2, "0")}`,
      count: 2,
    })),
  };
}

export function createTcgMatch(catalog, deck, seed = 41) {
  validateDeck(deck, catalog);
  const byId = new Map(catalog.cards.map((card) => [card.card_id, card]));
  const players = [0, 1].map((playerIndex) => {
    const cards = deck.cards.flatMap(({ card_id, count }) =>
      Array.from({ length: count }, (_, copy) => ({
        ...structuredClone(byId.get(card_id)),
        instance_id: `p${playerIndex}:${card_id}:${copy}`,
      })),
    );
    shuffle(cards, seed + playerIndex * 1_003_037);
    return {
      hp: 8000,
      maxMana: 0,
      mana: 0,
      deck: cards,
      hand: cards.splice(0, 4),
      units: [],
      traps: [],
      graveyard: [],
      attackUsedRound: 0,
    };
  });
  players[0].maxMana = 1;
  players[0].mana = 1;
  return {
    seed,
    battleId: `battle_tcg_${seed}`,
    round: 1,
    maxRounds: MAX_ROUNDS,
    phase: "action",
    activePlayer: 0,
    priority: 0,
    passes: 0,
    stack: [],
    nextStackId: 1,
    pendingAttack: null,
    winner: null,
    result: null,
    players,
    rulesVersion: RULES_VERSION,
    mulliganUsed: [false, false],
    elementChains: [[], []],
    comboRound: [0, 0],
    eventSeq: 0,
    log: [
      {
        type: "match_started",
        text: "Trận đấu bắt đầu. Người chơi đi trước không rút bài ở lượt đầu.",
      },
    ],
  };
}

export function validateDeck(deck, catalog) {
  if (!Array.isArray(deck?.cards) || !Array.isArray(catalog?.cards))
    throw new Error("Dữ liệu bộ bài không hợp lệ.");
  const known = new Set(catalog.cards.map((card) => card.card_id));
  const seen = new Set();
  let total = 0;
  for (const entry of deck.cards) {
    if (!known.has(entry.card_id))
      throw new Error(`Không tìm thấy lá bài ${entry.card_id}.`);
    if (
      !Number.isInteger(entry.count) ||
      entry.count < 1 ||
      entry.count > 2 ||
      seen.has(entry.card_id)
    )
      throw new Error("Mỗi lá bài tối đa hai bản sao.");
    seen.add(entry.card_id);
    total += entry.count;
  }
  if (total !== 36) throw new Error("Bộ bài phải có đúng 36 lá.");
}

export function mulliganTcg(match, playerIndex, instanceIds = []) {
  assertMatch(match);
  if (
    match.round !== 1 ||
    match.eventSeq !== 0 ||
    match.mulliganUsed?.[playerIndex]
  )
    throw new Error("Chỉ đổi bài một lần trước hành động đầu tiên.");
  if (
    new Set(instanceIds).size !== instanceIds.length ||
    instanceIds.some(
      (id) =>
        !match.players[playerIndex].hand.some(
          (card) => card.instance_id === id,
        ),
    )
  )
    throw new Error("Bài đổi không hợp lệ.");
  const updated = structuredClone(match);
  const owner = updated.players[playerIndex];
  const returned = owner.hand.filter((card) =>
    instanceIds.includes(card.instance_id),
  );
  owner.hand = owner.hand.filter(
    (card) => !instanceIds.includes(card.instance_id),
  );
  owner.hand.push(...owner.deck.splice(0, returned.length));
  owner.deck.push(...returned);
  shuffle(owner.deck, updated.seed + playerIndex + 71);
  updated.mulliganUsed[playerIndex] = true;
  logEvent(updated, "mulligan", `Đã đổi ${returned.length} lá bài mở đầu.`);
  return updated;
}

export function surrenderTcg(match, playerIndex = 0) {
  assertMatch(match);
  const updated = structuredClone(match);
  finishTcg(updated, 1 - playerIndex, "surrender");
  return updated;
}

export function playTcgCard(match, playerIndex, instanceId, targetId = null) {
  assertMatch(match);
  if (
    !["action", "reaction"].includes(match.phase) ||
    match.priority !== playerIndex
  )
    throw new Error("Bạn chưa có quyền hành động.");
  const player = match.players[playerIndex];
  const handIndex = player.hand.findIndex(
    (card) => card.instance_id === instanceId,
  );
  if (handIndex < 0) throw new Error("Lá bài không còn trong tay.");
  const card = player.hand[handIndex];
  if (player.mana < card.cost) throw new Error("Không đủ mana.");
  if (
    match.phase === "reaction" &&
    !["fast_spell", "burst_spell"].includes(card.type)
  )
    throw new Error("Cửa sổ phản ứng chỉ nhận tốc chú hoặc phép tức thời.");
  if (card.type === "unit" && player.units.length >= 5)
    throw new Error("Đã đầy 5 vị trí đơn vị.");
  if (card.type === "trap" && player.traps.length >= 2)
    throw new Error("Đã đầy 2 vị trí bẫy.");
  if (
    card.type.includes("spell") &&
    ![
      "deal_damage",
      "heal",
      "modify_stat",
      "draw",
      "destroy",
      "shield",
      "counter",
      "apply_status",
      "trigger_combo",
    ].includes(card.effect?.kind)
  )
    throw new Error("Hiệu ứng lá bài chưa được hỗ trợ.");
  if (card.type === "slow_spell" && match.stack.length)
    throw new Error("Chậm chú không thể vào stack đang mở.");
  if (card.type.includes("spell"))
    validateSpellTarget(match, card, playerIndex, targetId ?? "commander");

  const updated = structuredClone(match);
  const owner = updated.players[playerIndex];
  const played = owner.hand.splice(handIndex, 1)[0];
  owner.mana -= played.cost;
  const opponentIndex = 1 - playerIndex;
  if (played.type === "unit") {
    owner.units.push({
      ...played,
      current_def: played.max_def,
      shield: 0,
      buffs: [],
      lane: firstOpenLane(owner.units),
      ready: Boolean(
        played.keywords?.includes("haste") ||
          played.keywords?.includes("quick"),
      ),
    });
    logEvent(updated, "unit_summoned", `${played.display_name} vào sân.`);
    recordElement(updated, playerIndex, played.element);
  } else if (played.type === "trap") {
    owner.traps.push({ card: played, setRound: updated.round, faceDown: true });
    logEvent(updated, "trap_set", "Đã đặt một bẫy úp.");
  } else if (["fast_spell", "slow_spell"].includes(played.type)) {
    updated.stack.push({
      id: updated.nextStackId++,
      kind: "spell",
      card: played,
      owner: playerIndex,
      targetId: targetId ?? "commander",
    });
    updated.phase = "reaction";
    logEvent(updated, "spell_cast", `${played.display_name} chờ phản ứng.`);
    revealSpellTrap(updated, playerIndex);
  } else {
    resolveSpell(updated, played, playerIndex, targetId ?? "commander");
    logEvent(
      updated,
      "spell_resolved",
      `${played.display_name} được thi triển.`,
    );
  }
  if (!updated.result)
    updated.priority =
      played.type === "burst_spell" ? playerIndex : opponentIndex;
  updated.passes = 0;
  updated.eventSeq += 1;
  gameEvents.emit(
    played.type === "unit" ? "unit_summoned" : "card_played",
    played.type === "trap"
      ? {
          face_down: true,
          player_index: playerIndex,
        }
      : {
          card_id: played.card_id,
          player_index: playerIndex,
        },
  );
  return updated;
}

export function passTcgPriority(match, playerIndex) {
  assertMatch(match);
  if (
    !["action", "reaction"].includes(match.phase) ||
    match.priority !== playerIndex
  )
    throw new Error("Không có quyền bỏ lượt ưu tiên.");
  const updated = structuredClone(match);
  updated.passes += 1;
  logEvent(
    updated,
    "priority_passed",
    `${playerIndex === 0 ? "Bạn" : "Đối thủ"} bỏ ưu tiên.`,
  );
  if (updated.passes < 2) {
    updated.priority = 1 - playerIndex;
    return updated;
  }
  updated.passes = 0;
  if (updated.stack.length) {
    resolveStackTop(updated);
    updated.priority =
      updated.phase === "result" ? updated.priority : 1 - playerIndex;
    return updated;
  }
  if (updated.phase === "reaction") {
    resolvePendingAttack(updated);
    return updated;
  }
  updated.phase = "combat";
  updated.priority = updated.activePlayer;
  logEvent(updated, "combat_opened", "Giai đoạn tấn công bắt đầu.");
  return updated;
}

export function attackTcg(match, playerIndex, attackers = null, targets = {}) {
  assertMatch(match);
  if (match.phase !== "combat" || match.activePlayer !== playerIndex)
    throw new Error("Chưa đến lượt tấn công của bạn.");
  const updated = structuredClone(match);
  const player = updated.players[playerIndex];
  if (player.attackUsedRound === updated.round)
    throw new Error("Lượt này đã tấn công.");
  const chosen =
    attackers ??
    player.units.filter((unit) => unit.ready).map((unit) => unit.instance_id);
  if (
    new Set(chosen).size !== chosen.length ||
    chosen.some(
      (id) =>
        !player.units.some((unit) => unit.instance_id === id && unit.ready),
    )
  )
    throw new Error("Đơn vị tấn công chưa sẵn sàng.");
  const active = player.units.filter(
    (unit) => chosen.includes(unit.instance_id) && unit.ready,
  );
  const guardians = updated.players[1 - playerIndex].units.filter(isGuardian);
  for (const unit of active) {
    const target = targets[unit.instance_id];
    if (
      target &&
      target !== "commander" &&
      !updated.players[1 - playerIndex].units.some(
        (enemy) => enemy.instance_id === target,
      )
    )
      throw new Error("Mục tiêu tấn công không tồn tại.");
    if (
      target &&
      guardians.length &&
      !unit.keywords?.includes("piercing") &&
      !guardians.some((guard) => guard.instance_id === target)
    )
      throw new Error("Phải tấn công Hộ Vệ trước.");
  }
  player.attackUsedRound = updated.round;
  active.forEach((unit) => {
    unit.ready = false;
  });
  const traps = updated.players[1 - playerIndex].traps;
  const armedTrapIndex = traps.findIndex(
    (trap) =>
      trap.faceDown &&
      trap.setRound < updated.round &&
      trap.card.trigger?.when === "attack_declared",
  );
  if (
    armedTrapIndex >= 0 &&
    active.length >=
      (traps[armedTrapIndex].card.trigger.condition?.min_attackers ?? 1)
  ) {
    const [trap] = traps.splice(armedTrapIndex, 1);
    updated.stack.push({
      id: updated.nextStackId++,
      kind: "attack_counter",
      card: trap.card,
      owner: 1 - playerIndex,
    });
    updated.pendingAttack = {
      playerIndex,
      attackerIds: active.map((unit) => unit.instance_id),
      targets,
      canceled: false,
    };
    updated.phase = "reaction";
    updated.priority = playerIndex;
    updated.passes = 0;
    logEvent(
      updated,
      "trap_revealed",
      `${trap.card.display_name} lật mở và chặn đợt tấn công.`,
    );
    gameEvents.emit("trap_revealed", {
      card_id: trap.card.card_id,
      trigger: "attack_declared",
    });
    return updated;
  }
  resolveCombat(updated, playerIndex, active, targets);
  return finishUserCombat(updated, playerIndex);
}

export function endTcgTurn(match, playerIndex) {
  if (
    !["combat", "round_end"].includes(match.phase) ||
    match.activePlayer !== playerIndex
  )
    throw new Error("Không thể kết thúc lượt này.");
  const updated = structuredClone(match);
  return advanceTurn(updated, playerIndex);
}

export function runTcgBot(match) {
  let updated = structuredClone(match);
  let safety = 0;
  while (
    updated.result === null &&
    updated.activePlayer === 1 &&
    safety++ < 48
  ) {
    if (updated.phase === "action" || updated.phase === "reaction") {
      if (updated.priority === 1) {
        const move = chooseBotCard(updated.players[1], updated);
        updated = move
          ? playTcgCard(updated, 1, move.instance_id, move.target_id)
          : passTcgPriority(updated, 1);
      } else {
        updated = passTcgPriority(updated, 0);
      }
      continue;
    }
    if (updated.phase === "combat" && updated.activePlayer === 1) {
      const ready = updated.players[1].units
        .filter((unit) => unit.ready)
        .map((unit) => unit.instance_id);
      updated = attackTcg(updated, 1, ready);
      if (updated.phase === "round_end") updated = advanceTurn(updated, 1);
      continue;
    }
    if (updated.phase === "round_end" && updated.activePlayer === 1) {
      updated = advanceTurn(updated, 1);
      continue;
    }
    break;
  }
  return updated;
}

export function runBotPriority(match) {
  let updated = structuredClone(match);
  let safety = 0;
  while (
    (updated.phase === "action" || updated.phase === "reaction") &&
    updated.priority === 1 &&
    safety++ < 24
  ) {
    const move = chooseBotCard(updated.players[1], updated);
    updated = move
      ? playTcgCard(updated, 1, move.instance_id, move.target_id)
      : passTcgPriority(updated, 1);
  }
  return updated;
}

// Exactly one observable bot action. UI scheduling never auto-passes human priority.
export function stepTcgBot(match) {
  if (!match || match.result) return match;
  if (["action", "reaction"].includes(match.phase) && match.priority === 1) {
    const move = chooseBotCard(match.players[1], match);
    return move
      ? playTcgCard(match, 1, move.instance_id, move.target_id)
      : passTcgPriority(match, 1);
  }
  if (match.activePlayer !== 1) return match;
  if (match.phase === "combat") return attackTcg(match, 1);
  if (match.phase === "round_end") return endTcgTurn(match, 1);
  return match;
}

function chooseBotCard(player, match) {
  const affordable = player.hand.filter((card) => card.cost <= player.mana);
  const candidate =
    affordable.find((card) =>
      match.phase === "reaction"
        ? ["fast_spell", "burst_spell"].includes(card.type) &&
          card.effect?.kind === "deal_damage"
        : card.type === "unit" && player.units.length < 5,
    ) ??
    affordable.find(
      (card) =>
        match.phase === "action" &&
        card.type === "trap" &&
        player.traps.length < 2,
    ) ??
    affordable.find(
      (card) =>
        match.phase === "action" &&
        card.type.includes("spell") &&
        ["deal_damage", "draw", "heal"].includes(card.effect?.kind),
    ) ??
    affordable.find(
      (card) =>
        match.phase === "action" &&
        player.units.length &&
        card.effect?.kind === "modify_stat",
    );
  if (!candidate) return null;
  const target = ["heal", "modify_stat", "shield"].includes(
    candidate.effect?.kind,
  )
    ? "commander"
    : candidate.type.includes("spell")
      ? (match.players[0].units[0]?.instance_id ?? "commander")
      : null;
  return { instance_id: candidate.instance_id, target_id: target };
}

function revealSpellTrap(match, spellOwner) {
  const owner = match.players[1 - spellOwner];
  const trapIndex = owner.traps.findIndex(
    (trap) =>
      trap.faceDown &&
      trap.setRound < match.round &&
      trap.card.trigger?.when === "spell_cast",
  );
  if (trapIndex < 0) return;
  const [trap] = owner.traps.splice(trapIndex, 1);
  const top = match.stack.at(-1);
  match.stack.push({
    id: match.nextStackId++,
    kind: "counter",
    card: trap.card,
    owner: 1 - spellOwner,
    targetStackId: top?.id,
  });
  match.phase = "reaction";
  logEvent(
    match,
    "trap_revealed",
    `${trap.card.display_name} lật mở và phản ứng với tốc chú.`,
  );
  gameEvents.emit("trap_revealed", {
    card_id: trap.card.card_id,
    trigger: "spell_cast",
  });
}

function resolveStackTop(match) {
  const item = match.stack.pop();
  if (!item) return;
  if (item.kind === "counter") {
    const index = match.stack.findIndex(
      (stackItem) => stackItem.id === item.targetStackId,
    );
    if (index >= 0) {
      const [countered] = match.stack.splice(index, 1);
      match.players[countered.owner].graveyard.push(countered.card);
    }
    match.players[item.owner].graveyard.push(item.card);
    logEvent(
      match,
      "stack_item_countered",
      `${item.card.display_name} hóa giải hành động trên stack.`,
    );
  } else if (item.kind === "attack_counter") {
    match.players[item.owner].graveyard.push(item.card);
    if (match.pendingAttack) match.pendingAttack.canceled = true;
    logEvent(match, "attack_countered", "Đợt tấn công đã bị hủy.");
  } else {
    resolveSpell(match, item.card, item.owner, item.targetId);
  }
  if (
    !match.result &&
    !match.stack.length &&
    !match.pendingAttack &&
    match.phase === "reaction"
  )
    match.phase = "action";
}

function resolveSpell(match, card, ownerIndex, targetId) {
  const effect = card.effect;
  const owner = match.players[ownerIndex];
  if (effect.kind !== "deal_damage") {
    const ownTargets =
      effect.target === "all_allies" || targetId === "commander"
        ? owner.units
        : owner.units.filter((unit) => unit.instance_id === targetId);
    if (effect.kind === "modify_stat")
      for (const unit of ownTargets) {
        const stat = effect.stat ?? "atk";
        unit[stat] += effect.value;
        (unit.buffs ??= []).push({
          stat,
          value: effect.value,
          expiresRound: match.round + (effect.duration ?? 2),
        });
      }
    if (effect.kind === "shield")
      for (const unit of ownTargets)
        unit.shield = (unit.shield ?? 0) + effect.value;
    if (effect.kind === "heal") {
      if (targetId === "commander")
        owner.hp = Math.min(TCG_RULES.commanderHp, owner.hp + effect.value);
      else
        for (const unit of ownTargets)
          unit.current_def = Math.min(
            unit.max_def,
            unit.current_def + effect.value,
          );
    }
    if (effect.kind === "draw")
      for (let i = 0; i < effect.value && !match.result; i++)
        drawCard(match, ownerIndex);
    if (effect.kind === "destroy") {
      const victim = match.players[1 - ownerIndex];
      const target = victim.units.find((unit) => unit.instance_id === targetId);
      if (target) {
        victim.units = victim.units.filter((unit) => unit !== target);
        victim.graveyard.push(target);
      }
    }
    if (effect.kind === "counter") {
      const index = match.stack.findIndex(
        (item) => String(item.id) === String(targetId),
      );
      if (index >= 0) {
        const [removed] = match.stack.splice(index, 1);
        match.players[removed.owner].graveyard.push(removed.card);
      }
    }
    if (effect.kind === "apply_status") {
      const target = match.players[1 - ownerIndex].units.find(
        (unit) => unit.instance_id === targetId,
      );
      if (target && effect.status === "stun") {
        target.ready = false;
        target.stunnedUntil = match.round + 1;
      }
    }
    owner.graveyard.push(card);
    logEvent(
      match,
      "spell_resolved",
      `${card.display_name}: ${effect.description ?? effect.kind}.`,
    );
    gameEvents.emit("spell_resolved", {
      card_id: card.card_id,
      effect_kind: effect.kind,
      value: effect.value,
    });
    recordElement(match, ownerIndex, card.element);
    return;
  }
  const victimIndex = 1 - ownerIndex;
  const victim = match.players[victimIndex];
  const unit = victim.units.find((item) => item.instance_id === targetId);
  let commanderDefeated = false;
  if (unit) {
    damageUnit(unit, card.effect.value);
    if (unit.current_def <= 0) {
      victim.units = victim.units.filter(
        (item) => item.instance_id !== targetId,
      );
      victim.graveyard.push(unit);
    }
  } else if (targetId === "commander") {
    victim.hp = Math.max(0, victim.hp - card.effect.value);
    commanderDefeated = victim.hp === 0;
  } else {
    owner.graveyard.push(card);
    logEvent(
      match,
      "spell_fizzled",
      `${card.display_name}: mục tiêu đã rời sân, hiệu ứng bị hủy.`,
    );
    return;
  }
  gameEvents.emit(
    "hit_resolved",
    { damage: card.effect.value, effect_kind: "spell", card_id: card.card_id },
    {
      battle_id: match.battleId,
      rules_version: "client-tcg-v1",
      tick: 0,
      action_seq: match.eventSeq,
      source_id: card.card_id,
      target_id: unit?.instance_id ?? `commander:p${victimIndex}`,
    },
  );
  match.players[ownerIndex].graveyard.push(card);
  logEvent(
    match,
    "damage_resolved",
    `${card.display_name} gây ${card.effect.value} sát thương.`,
  );
  if (commanderDefeated) finishTcg(match, ownerIndex);
  else recordElement(match, ownerIndex, card.element);
}

function resolvePendingAttack(match) {
  const pending = match.pendingAttack;
  if (!pending) return;
  if (!pending.canceled)
    resolveCombat(
      match,
      pending.playerIndex,
      pending.attackerIds
        .map((id) =>
          match.players[pending.playerIndex].units.find(
            (unit) => unit.instance_id === id,
          ),
        )
        .filter(Boolean),
      pending.targets,
    );
  match.pendingAttack = null;
  if (!match.result) match.phase = "round_end";
  logEvent(
    match,
    pending.canceled ? "attack_canceled" : "combat_resolved",
    pending.canceled ? "Đợt tấn công đã bị hủy." : "Giao tranh đã kết thúc.",
  );
}

function resolveCombat(match, attackerIndex, attackers, targets = {}) {
  const defenderIndex = 1 - attackerIndex;
  const attackersByLane = new Map(attackers.map((unit) => [unit.lane, unit]));
  const defenderUnits = match.players[defenderIndex].units;
  const blockers = [];
  const usedBlockers = new Set();
  for (const [lane, attacker] of attackersByLane) {
    const explicit = targets?.[attacker.instance_id];
    const guardian =
      !attacker.keywords?.includes("piercing") &&
      defenderUnits.find(isGuardian);
    const blocker =
      guardian ||
      (explicit && explicit !== "commander"
        ? defenderUnits.find((unit) => unit.instance_id === explicit)
        : explicit === "commander"
          ? null
          : defenderUnits.find(
              (unit) =>
                unit.lane === lane && !usedBlockers.has(unit.instance_id),
            ));
    if (blocker) {
      blockers.push({ attacker, blocker });
      usedBlockers.add(blocker.instance_id);
    } else {
      match.players[defenderIndex].hp = Math.max(
        0,
        match.players[defenderIndex].hp - attacker.atk,
      );
      emitTcgHit(
        match,
        attacker.atk,
        attacker.instance_id,
        `commander:p${defenderIndex}`,
      );
    }
  }
  for (const { attacker, blocker } of blockers) {
    damageUnit(attacker, blocker.atk);
    damageUnit(blocker, attacker.atk);
    emitTcgHit(match, blocker.atk, blocker.instance_id, attacker.instance_id);
    emitTcgHit(match, attacker.atk, attacker.instance_id, blocker.instance_id);
  }
  for (let playerIndex = 0; playerIndex < 2; playerIndex += 1) {
    const player = match.players[playerIndex];
    const dead = player.units.filter((unit) => unit.current_def <= 0);
    player.graveyard.push(...dead);
    player.units = player.units.filter((unit) => unit.current_def > 0);
  }
  if (match.players[defenderIndex].hp <= 0) finishTcg(match, attackerIndex);
  logEvent(
    match,
    "combat_resolved",
    `${attackers.length} đơn vị tham chiến; sát thương được áp dụng đồng thời.`,
  );
}

function finishUserCombat(match, playerIndex) {
  if (!match.result) match.phase = "round_end";
  match.players[playerIndex].attackUsedRound = match.round;
  logEvent(match, "combat_resolved", "Giao tranh đã kết thúc.");
  return match;
}

function advanceTurn(match, playerIndex) {
  if (match.result) return match;
  const next = 1 - playerIndex;
  if (next === 0) match.round += 1;
  if (match.round > match.maxRounds) {
    const [first, second] = match.players;
    match.winner = first.hp === second.hp ? null : first.hp > second.hp ? 0 : 1;
    match.result =
      match.winner === null ? "round_limit_draw" : "round_limit_winner";
    match.phase = "result";
    logEvent(
      match,
      "match_finished",
      `Kết thúc giới hạn lượt ${match.maxRounds}.`,
    );
    return match;
  }
  match.activePlayer = next;
  match.priority = next;
  match.players[next].maxMana = Math.min(10, match.players[next].maxMana + 1);
  match.players[next].mana = match.players[next].maxMana;
  match.players[next].units.forEach((unit) => {
    unit.ready = true;
  });
  for (const player of match.players)
    for (const unit of player.units) {
      unit.buffs ??= [];
      for (const buff of unit.buffs.filter(
        (item) => item.expiresRound <= match.round,
      ))
        unit[buff.stat] -= buff.value;
      unit.buffs = unit.buffs.filter((item) => item.expiresRound > match.round);
      if (unit.stunnedUntil >= match.round) unit.ready = false;
    }
  if (next === 0) match.elementChains = [[], []];
  if (!(next === 0 && match.round === 1)) drawCard(match, next);
  if (!match.result) match.phase = "action";
  match.passes = 0;
  logEvent(
    match,
    "round_started",
    `Vòng ${match.round}, người chơi ${next === 0 ? "bạn" : "đối thủ"}.`,
  );
  return match;
}

function drawCard(match, playerIndex) {
  const player = match.players[playerIndex];
  if (!player.deck.length) {
    finishTcg(match, 1 - playerIndex, "deck_out");
    return;
  }
  const card = player.deck.pop();
  if (player.hand.length < 9) player.hand.push(card);
  else {
    player.graveyard.push(card);
    logEvent(match, "card_burned", "Tay đã đủ 9 lá: bài rút thêm đi vào mộ.");
  }
  logEvent(
    match,
    "card_drawn",
    `${playerIndex === 0 ? "Bạn" : "Đối thủ"} rút một lá.`,
  );
}

function finishTcg(match, winner, result = "commander_defeated") {
  match.winner = winner;
  match.result = result;
  match.phase = "result";
  logEvent(
    match,
    "match_finished",
    winner === 0 ? "Bạn thắng trận." : "Đối thủ thắng trận.",
  );
  gameEvents.emit(
    "battle_finished",
    { mode: "tcg", winner: winner === 0 ? "player" : "bot" },
    {
      battle_id: match.battleId,
      rules_version: "client-tcg-v1",
      tick: 0,
      action_seq: match.eventSeq,
    },
  );
}

function isGuardian(unit) {
  return unit.role === "guardian" || unit.keywords?.includes("guardian");
}
function damageUnit(unit, damage) {
  const absorbed = Math.min(unit.shield ?? 0, damage);
  unit.shield = Math.max(0, (unit.shield ?? 0) - absorbed);
  unit.current_def -= damage - absorbed;
}
function validateSpellTarget(match, card, ownerIndex, targetId) {
  const kind = card.effect.kind;
  if (["draw", "trigger_combo"].includes(kind)) return;
  if (kind === "counter") {
    if (!match.stack.some((item) => String(item.id) === String(targetId)))
      throw new Error("Chọn hành động đang chờ trên stack.");
    return;
  }
  const friendly = ["heal", "modify_stat", "shield"].includes(kind);
  const owner = match.players[friendly ? ownerIndex : 1 - ownerIndex];
  if (targetId === "commander" && !["destroy", "apply_status"].includes(kind))
    return;
  if (!owner.units.some((unit) => unit.instance_id === targetId))
    throw new Error(
      friendly ? "Chọn Vị Linh đồng minh." : "Mục tiêu không hợp lệ.",
    );
}
function recordElement(match, ownerIndex, element) {
  if (match.result || !["fire", "water", "wood"].includes(element)) return;
  match.elementChains ??= [[], []];
  match.comboRound ??= [0, 0];
  if (!match.elementChains[ownerIndex].includes(element))
    match.elementChains[ownerIndex].push(element);
  if (
    match.elementChains[ownerIndex].length < 3 ||
    match.comboRound[ownerIndex] === match.round
  )
    return;
  match.comboRound[ownerIndex] = match.round;
  const enemy = match.players[1 - ownerIndex];
  enemy.hp = Math.max(0, enemy.hp - TCG_RULES.comboDamage);
  logEvent(
    match,
    "element_combo",
    `Hỏa + Thủy + Mộc → Hương Vị Bùng Nổ! ${TCG_RULES.comboDamage} sát thương.`,
  );
  gameEvents.emit(
    "element_combo",
    {
      owner: ownerIndex,
      elements: ["fire", "water", "wood"],
      damage: TCG_RULES.comboDamage,
    },
    { battle_id: match.battleId },
  );
  if (!enemy.hp) finishTcg(match, ownerIndex);
}

function emitTcgHit(match, damage, sourceId, targetId) {
  gameEvents.emit(
    "hit_resolved",
    { damage, hp_damage: damage, source_kind: "tcg_combat" },
    {
      battle_id: match.battleId,
      rules_version: "client-tcg-v1",
      tick: 0,
      action_seq: match.eventSeq,
      source_id: sourceId,
      target_id: targetId,
    },
  );
}

function firstOpenLane(units) {
  const occupied = new Set(units.map((unit) => unit.lane));
  for (let lane = 0; lane < 5; lane += 1) if (!occupied.has(lane)) return lane;
  return 4;
}

function shuffle(items, seed) {
  let value = seed >>> 0;
  for (let index = items.length - 1; index > 0; index -= 1) {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    const target = (value >>> 0) % (index + 1);
    [items[index], items[target]] = [items[target], items[index]];
  }
}

function logEvent(match, type, text) {
  match.log.unshift({ seq: match.eventSeq++, type, text });
  match.log = match.log.slice(0, 40);
}

function assertMatch(match) {
  if (!match || match.phase === "result" || match.result)
    throw new Error("Trận đấu đã kết thúc.");
}
