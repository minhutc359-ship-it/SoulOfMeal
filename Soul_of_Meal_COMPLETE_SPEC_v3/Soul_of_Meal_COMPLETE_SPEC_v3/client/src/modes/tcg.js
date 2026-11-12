import { gameEvents } from '../core/events.js';
import { planTcgAttacks, planTcgBlocks, tcgUnitAttack, tcgUnitDurability } from './tcgStrategy.js';

const MAX_ROUNDS = 40;
const SPELL_TYPES = ['fast_spell', 'slow_spell', 'burst_spell'];
const REACTION_SPELLS = ['fast_spell', 'burst_spell'];
export const TCG_DIFFICULTIES = { normal: 'Thường', hard: 'Khó', extreme: 'Cực khó' };
const SPELL_EFFECT_TEXT = {
  deal_damage: value => `Gây ${value} sát thương lên đối thủ.`,
  restore_defense: value => `Hồi tối đa ${value} DEF cho một Vị Linh đồng minh đang bị thương.`,
  grant_shield: value => `Tạo ${value} hộ thuẫn cho một đồng minh đến hết lượt đang diễn ra.`,
  boost_attack: value => `Tăng ${value} ATK cho một đồng minh đến hết lượt đang diễn ra.`,
};

export function tcgEffectText(card) {
  const { kind, value } = card.effect ?? {};
  return Object.hasOwn(SPELL_EFFECT_TEXT, kind) ? SPELL_EFFECT_TEXT[kind](value) : '';
}

export function tcgPresetDeck(catalog, starter, presetId) {
  const preset = catalog.presets?.find(item => item.id === presetId);
  if (!preset) return starter;
  const deck = {
    ...starter, deck_id: 'deck_' + preset.id, catalog_version: catalog.catalog_version,
    cards: starter.cards.map(entry => ({ ...entry, card_id: preset.replace[entry.card_id] ?? entry.card_id })),
  };
  validateDeck(deck, catalog);
  return deck;
}

export function createTcgMatch(catalog, deck, seed = 41, botDeck = deck, difficulty = 'normal') {
  validateDeck(deck, catalog);
  validateDeck(botDeck, catalog);
  const byId = new Map(catalog.cards.map((card) => [card.card_id, card]));
  const players = [0, 1].map((playerIndex) => {
    const cards = (playerIndex === 0 ? deck : botDeck).cards.flatMap(({ card_id, count }) => Array.from({ length: count }, (_, copy) => ({
      ...structuredClone(byId.get(card_id)), instance_id: `p${playerIndex}:${card_id}:${copy}`,
    })));
    shuffle(cards, seed + playerIndex * 1_003_037);
    return { hp: 8000, maxMana: 0, mana: 0, deck: cards, hand: cards.splice(0, 4), units: [], traps: [], graveyard: [], attackUsedRound: 0 };
  });
  players[0].maxMana = 1;
  players[0].mana = 1;
  return {
    seed, battleId: `battle_tcg_${seed}`, round: 1, maxRounds: MAX_ROUNDS, phase: 'action', activePlayer: 0, priority: 0,
    passes: 0, stack: [], mulliganDone: false, nextStackId: 1, pendingAttack: null, winner: null, result: null,
    difficulty: Object.hasOwn(TCG_DIFFICULTIES, difficulty) ? difficulty : 'normal', players, eventSeq: 0, log: [{ type: 'match_started', text: 'Trận đấu bắt đầu. Người chơi đi trước không rút bài ở lượt đầu.' }],
  };
}

export function validateDeck(deck, catalog) {
  if (!Array.isArray(deck?.cards) || !Array.isArray(catalog?.cards)) throw new Error('Dữ liệu bộ bài không hợp lệ.');
  const known = new Set(catalog.cards.map((card) => card.card_id));
  const seen = new Set();
  let total = 0;
  for (const entry of deck.cards) {
    if (!known.has(entry.card_id)) throw new Error(`Không tìm thấy lá bài ${entry.card_id}.`);
    if (!Number.isInteger(entry.count) || entry.count < 1 || entry.count > 2 || seen.has(entry.card_id)) throw new Error('Mỗi lá bài tối đa hai bản sao.');
    seen.add(entry.card_id);
    total += entry.count;
  }
  if (total !== 36) throw new Error('Bộ bài phải có đúng 36 lá.');
}

export function mulliganTcg(match, selected) {
  if (match.mulliganDone !== false || match.result || match.round !== 1 || match.eventSeq !== 0) {
    throw new Error('Chỉ có thể đổi bài trước hành động đầu tiên.');
  }
  const updated = structuredClone(match);
  const player = updated.players[0];
  const discarded = player.hand.filter((card) => selected.includes(card.instance_id));
  player.hand = player.hand.filter((card) => !selected.includes(card.instance_id));
  player.hand.push(...player.deck.splice(player.deck.length - discarded.length, discarded.length));
  player.deck.unshift(...discarded);
  shuffle(player.deck, (match.seed ^ 0x29fe13a5) >>> 0);
  updated.mulliganDone = true;
  logEvent(updated, 'mulligan', discarded.length ? `Đã đổi ${discarded.length} lá mở màn.` : 'Giữ tay bài mở màn.');
  return updated;
}

export function surrenderTcg(match, playerIndex) {
  assertMatch(match);
  if (![0, 1].includes(playerIndex)) throw new Error('Chủ soái không hợp lệ.');
  const updated = structuredClone(match);
  updated.pendingAttack = null;
  for (const item of updated.stack) updated.players[item.owner].graveyard.push(item.card);
  updated.stack = [];
  finishTcg(updated, 1 - playerIndex, 'surrender');
  return updated;
}

export function tcgSpellTargets(match, playerIndex, card) {
  const kind = card.effect?.kind;
  if (!Object.hasOwn(SPELL_EFFECT_TEXT, kind)) return [];
  const opposing = kind === 'deal_damage';
  const targetPlayer = opposing ? 1 - playerIndex : playerIndex;
  const { units } = match.players[targetPlayer];
  return [
    ...(opposing ? [{ id: 'commander', player: targetPlayer, unit: null }] : []),
    ...units.filter(unit => unit.current_def > 0 && (kind !== 'restore_defense' || unit.current_def < unit.max_def))
      .map(unit => ({ id: unit.instance_id, player: targetPlayer, unit })),
  ];
}

function cardIssue(match, playerIndex, card) {
  const player = match.players[playerIndex];
  if (!player) return 'Chủ soái không hợp lệ.';
  if (match.result || !['action', 'reaction'].includes(match.phase) || match.priority !== playerIndex) return 'Bạn chưa có quyền hành động.';
  if (player.mana < card.cost) return 'Không đủ mana.';
  if (match.phase === 'reaction' && !REACTION_SPELLS.includes(card.type)) return 'Chỉ Tốc chú và Tức chú dùng được khi phản ứng.';
  if (card.type === 'unit') return player.units.length >= 5 ? 'Đã đầy 5 vị trí đơn vị.' : '';
  if (card.type === 'trap') return player.traps.length >= 2 ? 'Đã đầy 2 vị trí bẫy.' : '';
  if (!SPELL_TYPES.includes(card.type) || !tcgEffectText(card)) return 'Hiệu ứng lá bài chưa được hỗ trợ.';
  if (card.type === 'slow_spell' && match.stack.length) return 'Chậm chú không thể vào hàng chờ đang mở.';
  return tcgSpellTargets(match, playerIndex, card).length ? '' : 'Chưa có đồng minh phù hợp để chọn.';
}

export function canPlayTcgCard(match, playerIndex, card) {
  return !cardIssue(match, playerIndex, card);
}

export function playTcgCard(match, playerIndex, instanceId, targetId = null) {
  assertMatch(match);
  const player = match.players[playerIndex];
  if (!player) throw new Error('Chủ soái không hợp lệ.');
  const handIndex = player.hand.findIndex(card => card.instance_id === instanceId);
  if (handIndex < 0) throw new Error('Lá bài không còn trong tay.');
  const card = player.hand[handIndex];
  const issue = cardIssue(match, playerIndex, card);
  if (issue) throw new Error(issue);
  const target = targetId ?? (card.effect?.kind === 'deal_damage' ? 'commander' : null);
  if (SPELL_TYPES.includes(card.type) && !tcgSpellTargets(match, playerIndex, card).some(item => item.id === target)) {
    throw new Error('Hãy chọn mục tiêu hợp lệ.');
  }
  const updated = structuredClone(match);
  const owner = updated.players[playerIndex];
  const played = owner.hand.splice(handIndex, 1)[0];
  owner.mana -= played.cost;
  const opponentIndex = 1 - playerIndex;
  if (played.type === 'unit') {
    owner.units.push({ ...played, current_def: played.max_def, lane: firstOpenLane(owner.units), ready: Boolean(played.keywords?.includes('haste')) });
    logEvent(updated, 'unit_summoned', `${played.display_name} vào sân.`);
  } else if (played.type === 'trap') {
    owner.traps.push({ card: played, setRound: updated.round, faceDown: true });
    logEvent(updated, 'trap_set', 'Đã đặt một bẫy úp.');
  } else if (played.type === 'fast_spell') {
    updated.phase = 'reaction';
    updated.stack.push({ id: updated.nextStackId++, kind: 'spell', card: played, owner: playerIndex, targetId: target });
    logEvent(updated, 'spell_cast', `${played.display_name} chờ phản ứng.`);
    revealSpellTrap(updated, playerIndex);
  } else {
    resolveSpell(updated, played, playerIndex, target);
    logEvent(updated, 'spell_resolved', `${played.display_name} được thi triển.`);
  }
  updated.priority = played.type === 'burst_spell' ? playerIndex : opponentIndex;
  updated.passes = 0;
  updated.eventSeq += 1;
  if (played.type === 'trap') {
    gameEvents.emit('trap_set', { player_index: playerIndex });
  } else {
    gameEvents.emit(played.type === 'unit' ? 'unit_summoned' : 'card_played', {
      card_id: played.card_id, player_index: playerIndex,
    });
  }
  return updated;
}

export function passTcgPriority(match, playerIndex) {
  assertMatch(match);
  if (!['action', 'reaction'].includes(match.phase) || match.priority !== playerIndex) throw new Error('Không có quyền bỏ lượt ưu tiên.');
  const updated = structuredClone(match);
  updated.passes += 1;
  logEvent(updated, 'priority_passed', `${playerIndex === 0 ? 'Bạn' : 'Đối thủ'} bỏ ưu tiên.`);
  if (updated.passes < 2) {
    updated.priority = 1 - playerIndex;
    return updated;
  }
  updated.passes = 0;
  if (updated.stack.length) {
    resolveStackTop(updated);
    updated.priority = updated.phase === 'result' ? updated.priority : 1 - playerIndex;
    return updated;
  }
  if (updated.phase === 'reaction') {
    resolvePendingAttack(updated);
    return updated;
  }
  updated.phase = 'combat';
  updated.priority = updated.activePlayer;
  logEvent(updated, 'combat_opened', 'Giai đoạn tấn công bắt đầu.');
  return updated;
}

export function attackTcg(match, playerIndex, attackers = null) {
  if (match.phase !== 'combat' || match.activePlayer !== playerIndex) throw new Error('Chưa đến lượt tấn công của bạn.');
  const updated = structuredClone(match);
  const player = updated.players[playerIndex];
  if (player.attackUsedRound === updated.round) throw new Error('Lượt này đã tấn công.');
  const ready = player.units.filter(unit => unit.ready && unit.current_def > 0);
  const chosen = attackers ?? ready.map(unit => unit.instance_id);
  const active = ready.filter(unit => chosen.includes(unit.instance_id));
  if (active.length !== chosen.length) throw new Error('Đội hình tấn công có đơn vị không hợp lệ.');
  player.attackUsedRound = updated.round;
  if (!active.length) {
    updated.phase = 'round_end';
    logEvent(updated, 'attack_skipped', 'Bỏ đợt tấn công.');
    return updated;
  }

  active.forEach(unit => { unit.ready = false; });
  const defender = 1 - playerIndex;
  updated.pendingAttack = { playerIndex, attackerIds: active.map(unit => unit.instance_id), blocks: [], canceled: false };
  logEvent(updated, 'attack_declared', `${active.length} Vị Linh tuyên bố tấn công.`);

  const traps = updated.players[defender].traps;
  const armedTrapIndex = traps.findIndex(trap => trap.faceDown && trap.setRound < updated.round
    && trap.card.trigger?.when === 'attack_declared' && active.length >= (trap.card.trigger.condition?.min_attackers ?? 1));
  if (armedTrapIndex >= 0) {
    const [trap] = traps.splice(armedTrapIndex, 1);
    updated.stack.push({ id: updated.nextStackId++, kind: 'attack_counter', card: trap.card, owner: defender });
    updated.phase = 'reaction';
    updated.priority = playerIndex;
    updated.passes = 0;
    logEvent(updated, 'trap_revealed', `${trap.card.display_name} lật mở khi có đợt tấn công.`);
    gameEvents.emit('trap_revealed', { card_id: trap.card.card_id, trigger: 'attack_declared' });
  } else if (eligibleBlockers(updated, defender).length) {
    updated.phase = 'block_assign';
    updated.priority = defender;
  } else {
    startAttackReaction(updated);
  }
  return updated;
}

export function declaredTcgAttackers(match) {
  const pending = match.pendingAttack;
  if (!pending) return [];
  return match.players[pending.playerIndex].units
    .filter(unit => unit.current_def > 0 && pending.attackerIds.includes(unit.instance_id));
}

function eligibleBlockers(match, playerIndex) {
  return match.players[playerIndex].units.filter(unit => unit.current_def > 0);
}

export function assignTcgBlockers(match, playerIndex, blocks) {
  if (match.phase !== 'block_assign' || match.priority !== playerIndex || match.pendingAttack?.playerIndex !== 1 - playerIndex) {
    throw new Error('Chưa đến lượt chọn quân chặn.');
  }
  const lanes = new Set(declaredTcgAttackers(match).map(unit => unit.lane));
  const units = new Set(eligibleBlockers(match, playerIndex).map(unit => unit.instance_id));
  for (const { lane, blockerId } of blocks) {
    if (!lanes.delete(lane) || !units.delete(blockerId)) throw new Error('Mỗi đường và mỗi Vị Linh chỉ được chọn một lần.');
  }
  const updated = structuredClone(match);
  updated.pendingAttack.blocks = blocks.map(({ lane, blockerId }) => ({ lane, blockerId }));
  logEvent(updated, 'blockers_assigned', blocks.length ? `Đã bố trí ${blocks.length} quân chặn.` : 'Đợt tấn công không có quân chặn.');
  startAttackReaction(updated);
  return updated;
}

function startAttackReaction(match) {
  if (match.players.some((player, index) => player.hand.some(card => REACTION_SPELLS.includes(card.type)
    && card.cost <= player.mana && tcgSpellTargets(match, index, card).length))) {
    match.phase = 'reaction';
    match.priority = 1 - match.pendingAttack.playerIndex;
    match.passes = 0;
  } else {
    resolvePendingAttack(match);
  }
}

function chooseBotBlocks(match, playerIndex) {
  const defenders = [...eligibleBlockers(match, playerIndex)];
  const attackers = declaredTcgAttackers(match).sort((a, b) => tcgUnitAttack(b) - tcgUnitAttack(a) || a.lane - b.lane);
  if (match.difficulty && match.difficulty !== 'normal' && playerIndex === 1) {
    return planTcgBlocks(attackers, defenders, match.players[playerIndex].hp, match.difficulty).blocks;
  }
  const blocks = [];
  for (const attacker of attackers) {
    if (!defenders.length) break;
    const sameLane = defenders.findIndex(unit => unit.lane === attacker.lane);
    const [blocker] = defenders.splice(Math.max(0, sameLane), 1);
    blocks.push({ lane: attacker.lane, blockerId: blocker.instance_id });
  }
  return blocks;
}

export function endTcgTurn(match, playerIndex) {
  if (!['combat', 'round_end'].includes(match.phase) || match.activePlayer !== playerIndex) throw new Error('Không thể kết thúc lượt này.');
  const updated = structuredClone(match);
  return advanceTurn(updated, playerIndex);
}

export function runTcgBot(match, { yieldToPlayer = false } = {}) {
  let updated = structuredClone(match);
  let safety = 0;
  while (updated.result === null && updated.activePlayer === 1 && safety++ < 48) {
    if (updated.phase === 'block_assign') {
      if (yieldToPlayer) return updated;
      updated = assignTcgBlockers(updated, 0, chooseBotBlocks(updated, 0));
      continue;
    }
    if (updated.phase === 'action' || updated.phase === 'reaction') {
      if (updated.priority === 1) {
        const move = chooseBotCard(updated.players[1], updated);
        updated = move ? playTcgCard(updated, 1, move.instance_id, move.target_id) : passTcgPriority(updated, 1);
      } else {
        if (yieldToPlayer) return updated;
        updated = passTcgPriority(updated, 0);
      }
      continue;
    }
    if (updated.phase === 'combat' && updated.activePlayer === 1) {
      const ready = updated.players[1].units.filter(unit => unit.ready && unit.current_def > 0);
      const attacks = updated.difficulty === 'extreme' ? planTcgAttacks(ready, eligibleBlockers(updated, 0), updated.players[0].hp)
        : ready.map(unit => unit.instance_id);
      updated = attackTcg(updated, 1, attacks);
      if (updated.phase === 'round_end') updated = advanceTurn(updated, 1);
      continue;
    }
    if (updated.phase === 'round_end' && updated.activePlayer === 1) {
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
  while (['action', 'reaction', 'block_assign'].includes(updated.phase) && updated.priority === 1 && safety++ < 24) {
    if (updated.phase === 'block_assign') {
      updated = assignTcgBlockers(updated, 1, chooseBotBlocks(updated, 1));
      continue;
    }
    const move = chooseBotCard(updated.players[1], updated);
    updated = move ? playTcgCard(updated, 1, move.instance_id, move.target_id) : passTcgPriority(updated, 1);
  }
  return updated;
}

function chooseBotCard(player, match) {
  const playable = player.hand.filter(card => canPlayTcgCard(match, 1, card)
    && (card.type !== 'slow_spell' || match.activePlayer === 1));
  const advanced = match.difficulty && match.difficulty !== 'normal';
  const moves = playable.flatMap(card => {
    if (card.type === 'unit') return [{ card, score: advanced ? card.atk + card.max_def * .35 : 3000 }];
    if (card.type === 'trap') return [{ card, score: advanced ? 340 : 2000 }];
    return tcgSpellTargets(match, 1, card).map(({ id, unit }) => {
      const { value, kind } = card.effect;
      let score;
      if (kind === 'deal_damage') {
        if (!unit && value >= match.players[0].hp) score = 10_000;
        else if (unit && value >= tcgUnitDurability(unit)) score = 1050 + tcgUnitAttack(unit);
        else score = unit ? 150 + value * .2 : 550 + value * .2;
      } else if (kind === 'restore_defense') {
        score = 250 + Math.min(value, unit.max_def - unit.current_def) * .8;
      } else {
        score = 210 + value * .65 + Number(match.pendingAttack != null) * 220 + tcgUnitAttack(unit) * .1;
      }
      return { card, targetId: id, score: advanced ? score / (1 + .09 * card.cost) : score };
    });
  });
  const best = moves.reduce((prior, move) => !prior || move.score > prior.score ? move : prior, null);
  return best ? { instance_id: best.card.instance_id, target_id: best.targetId } : null;
}

function revealSpellTrap(match, spellOwner) {
  const owner = match.players[1 - spellOwner];
  const trapIndex = owner.traps.findIndex((trap) => trap.faceDown && trap.setRound < match.round && trap.card.trigger?.when === 'spell_cast');
  if (trapIndex < 0) return;
  const [trap] = owner.traps.splice(trapIndex, 1);
  const top = match.stack.at(-1);
  match.stack.push({ id: match.nextStackId++, kind: 'counter', card: trap.card, owner: 1 - spellOwner, targetStackId: top?.id });
  match.phase = 'reaction';
  logEvent(match, 'trap_revealed', `${trap.card.display_name} lật mở và phản ứng với tốc chú.`);
  gameEvents.emit('trap_revealed', { card_id: trap.card.card_id, trigger: 'spell_cast' });
}

function resolveStackTop(match) {
  const item = match.stack.pop();
  if (!item) return;
  if (item.kind === 'counter') {
    const index = match.stack.findIndex((stackItem) => stackItem.id === item.targetStackId);
    if (index >= 0) {
      const [countered] = match.stack.splice(index, 1);
      match.players[countered.owner].graveyard.push(countered.card);
    }
    match.players[item.owner].graveyard.push(item.card);
    logEvent(match, 'stack_item_countered', `${item.card.display_name} hóa giải hành động trên stack.`);
  } else if (item.kind === 'attack_counter') {
    match.players[item.owner].graveyard.push(item.card);
    if (match.pendingAttack) match.pendingAttack.canceled = true;
    logEvent(match, 'attack_countered', 'Đợt tấn công đã bị hủy.');
  } else {
    resolveSpell(match, item.card, item.owner, item.targetId);
  }
  if (!match.stack.length && !match.pendingAttack && match.phase === 'reaction') match.phase = 'action';
}

function damageTcgUnit(unit, damage) {
  const absorbed = Math.min(unit.shield ?? 0, damage);
  if (absorbed) unit.shield -= absorbed;
  unit.current_def -= damage - absorbed;
  return absorbed;
}

function resolveSpell(match, card, ownerIndex, targetId) {
  const { kind, value } = card.effect;
  match.players[ownerIndex].graveyard.push(card);
  const target = tcgSpellTargets(match, ownerIndex, card).find(item => item.id === targetId);
  if (!target) {
    logEvent(match, 'spell_fizzled', `${card.display_name} mất mục tiêu.`);
    return;
  }
  const { unit, player: targetPlayer } = target;
  const recipient = match.players[targetPlayer];
  const context = {
    battle_id: match.battleId, rules_version: 'client-tcg-v1', tick: 0, action_seq: match.eventSeq,
    source_id: card.card_id, target_id: unit?.instance_id ?? `commander:p${targetPlayer}`,
  };
  if (kind !== 'deal_damage') {
    let amount = value;
    if (kind === 'restore_defense') {
      amount = Math.min(value, unit.max_def - unit.current_def);
      unit.current_def += amount;
    } else if (kind === 'grant_shield') unit.shield = (unit.shield ?? 0) + value;
    else unit.attackBuff = (unit.attackBuff ?? 0) + value;
    const label = kind === 'restore_defense' ? 'DEF' : kind === 'grant_shield' ? 'hộ thuẫn' : 'ATK';
    gameEvents.emit('tcg_support_resolved', { element: card.element, amount, label, target_player: targetPlayer }, context);
    logEvent(match, 'support_resolved', `${card.display_name}: ${unit.display_name} +${amount} ${label}.`);
    return;
  }

  let absorbed = 0;
  if (unit) {
    absorbed = damageTcgUnit(unit, value);
    if (unit.current_def <= 0) {
      recipient.units = recipient.units.filter(item => item !== unit);
      recipient.graveyard.push(unit);
    }
  } else recipient.hp = Math.max(0, recipient.hp - value);
  gameEvents.emit('hit_resolved', {
    damage: value, hp_damage: value - absorbed, absorbed, effect_kind: 'spell', card_id: card.card_id, element: card.element,
    target_player: targetPlayer, target_lane: unit?.lane,
  }, context);
  logEvent(match, 'damage_resolved', `${card.display_name} gây ${value} sát thương${absorbed ? ` · hộ thuẫn chặn ${absorbed}` : ''}.`);
  if (!unit && recipient.hp === 0) finishTcg(match, ownerIndex);
}

function resolvePendingAttack(match) {
  const pending = match.pendingAttack;
  if (!pending) return;
  const attackers = declaredTcgAttackers(match);
  if (!pending.canceled) resolveCombat(match, pending.playerIndex, attackers, pending.blocks ?? []);
  match.pendingAttack = null;
  if (match.result) return;
  match.phase = 'round_end';
  match.priority = pending.playerIndex;
  if (pending.canceled) logEvent(match, 'attack_canceled', 'Đợt tấn công đã bị hủy.');
}

function resolveCombat(match, attackerIndex, attackers, assignedBlocks) {
  const defenderIndex = 1 - attackerIndex;
  const defender = match.players[defenderIndex];
  const blocks = new Map(assignedBlocks.map(({ lane, blockerId }) => [lane, blockerId]));
  for (const attacker of attackers) {
    const blocker = defender.units.find(unit => unit.current_def > 0 && unit.instance_id === blocks.get(attacker.lane));
    const attack = tcgUnitAttack(attacker);
    if (!blocker) {
      defender.hp = Math.max(0, defender.hp - attack);
      emitTcgHit(match, attack, attacker, `commander:p${defenderIndex}`, defenderIndex);
      continue;
    }
    const counter = tcgUnitAttack(blocker);
    const defenderAbsorbed = damageTcgUnit(blocker, attack);
    const attackerAbsorbed = damageTcgUnit(attacker, counter);
    emitTcgHit(match, counter, blocker, attacker.instance_id, attackerIndex, attacker.lane, attackerAbsorbed);
    emitTcgHit(match, attack, attacker, blocker.instance_id, defenderIndex, blocker.lane, defenderAbsorbed);
  }
  for (const player of match.players) {
    const dead = player.units.filter(unit => unit.current_def <= 0);
    player.graveyard.push(...dead);
    player.units = player.units.filter(unit => unit.current_def > 0);
  }
  logEvent(match, 'combat_resolved', `${attackers.length} đơn vị tham chiến. Sát thương được áp dụng đồng thời.`);
  if (defender.hp <= 0) finishTcg(match, attackerIndex);
}

function advanceTurn(match, playerIndex) {
  if (match.result) return match;
  const next = 1 - playerIndex;
  for (const player of match.players) {
    for (const unit of player.units) {
      delete unit.shield;
      delete unit.attackBuff;
    }
  }
  if (next === 0) match.round += 1;
  if (match.round > match.maxRounds) {
    const [first, second] = match.players;
    match.winner = first.hp === second.hp ? null : first.hp > second.hp ? 0 : 1;
    match.result = match.winner === null ? 'round_limit_draw' : 'round_limit_winner';
    match.phase = 'result';
    logEvent(match, 'match_finished', `Kết thúc giới hạn lượt ${match.maxRounds}.`);
    return match;
  }
  match.activePlayer = next;
  match.priority = next;
  match.players[next].maxMana = Math.min(10, match.players[next].maxMana + 1);
  match.players[next].mana = match.players[next].maxMana;
  match.players[next].units.forEach((unit) => { unit.ready = true; });
  if (!(next === 0 && match.round === 1)) drawCard(match, next);
  if (match.result) return match;
  match.phase = 'action';
  match.passes = 0;
  logEvent(match, 'round_started', `Vòng ${match.round}, người chơi ${next === 0 ? 'bạn' : 'đối thủ'}.`);
  return match;
}

function drawCard(match, playerIndex) {
  const player = match.players[playerIndex];
  if (!player.deck.length) { finishTcg(match, 1 - playerIndex); return; }
  const card = player.deck.pop();
  if (player.hand.length < 9) player.hand.push(card);
  else {
    player.graveyard.push(card);
    logEvent(match, 'hand_overflow', playerIndex === 0 ? 'Tay bạn đã đầy. Lá vừa rút chuyển vào mộ bài.' : 'Tay đối thủ đã đầy. Một lá chuyển vào mộ bài.');
  }
}

function finishTcg(match, winner, result = 'commander_defeated') {
  match.winner = winner;
  match.result = result;
  match.phase = 'result';
  const text = result === 'surrender'
    ? winner === 0 ? 'Đối thủ đã đầu hàng.' : 'Bạn đã đầu hàng.'
    : winner === 0 ? 'Bạn thắng trận.' : 'Đối thủ thắng trận.';
  logEvent(match, 'match_finished', text);
  gameEvents.emit('battle_finished', { mode: 'tcg', winner: winner === 0 ? 'player' : 'bot' }, {
    battle_id: match.battleId,
    rules_version: 'client-tcg-v1',
    tick: 0,
    action_seq: match.eventSeq,
  });
}

function emitTcgHit(match, damage, source, targetId, targetPlayer, targetLane, absorbed = 0) {
  gameEvents.emit('hit_resolved', {
    damage, hp_damage: damage - absorbed, absorbed, source_kind: 'tcg_combat', element: source.element,
    target_player: targetPlayer, target_lane: targetLane,
  }, {
    battle_id: match.battleId,
    rules_version: 'client-tcg-v1',
    tick: 0,
    action_seq: match.eventSeq,
    source_id: source.instance_id,
    target_id: targetId,
  });
}

function firstOpenLane(units) {
  const occupied = new Set(units.map((unit) => unit.lane));
  for (let lane = 0; lane < 5; lane += 1) if (!occupied.has(lane)) return lane;
  return 4;
}

function shuffle(items, seed) {
  let value = seed >>> 0;
  for (let index = items.length - 1; index > 0; index -= 1) {
    value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
    const target = (value >>> 0) % (index + 1);
    [items[index], items[target]] = [items[target], items[index]];
  }
}

function logEvent(match, type, text) {
  match.log.unshift({ seq: match.eventSeq++, type, text });
  match.log = match.log.slice(0, 40);
}

function assertMatch(match) {
  if (!match || match.phase === 'result' || match.result) throw new Error('Trận đấu đã kết thúc.');
}
