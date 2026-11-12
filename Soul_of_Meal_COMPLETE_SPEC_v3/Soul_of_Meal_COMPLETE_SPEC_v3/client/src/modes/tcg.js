import { gameEvents } from '../core/events.js';
import { planTcgAttacks, planTcgBlocks, tcgCanAttack, tcgCanBlock, tcgPierce, tcgUnitAttack, tcgUnitDurability } from './tcgStrategy.js';
import { TCG_BOARD_LIMIT, TCG_HAND_LIMIT, TCG_MAX_HP, TCG_REACTIONS, TCG_RULES_VERSION, TCG_SPELL_TYPES,
  TCG_TRAP_LIMIT, tcgCardCost, tcgCaster, tcgEffectText, tcgSpellTargets, tcgTurnSerial } from './tcgCards.js';
import { chooseTcgTrap, tcgAttackLanes, tcgTrapArmed, tcgTrapKind, tcgTrapOptions, tcgTrapRule } from './tcgTraps.js';

const MAX_ROUNDS = 40;
export const TCG_DIFFICULTIES = { normal: 'Thường', hard: 'Khó', extreme: 'Cực khó' };
export { tcgEffectText, tcgSpellTargets } from './tcgCards.js';
const modern = match => match.rulesVersion === TCG_RULES_VERSION;

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
    return { hp: TCG_MAX_HP, maxMana: 0, mana: 0, deck: cards, hand: cards.splice(0, 4), units: [], traps: [], graveyard: [], attackUsedRound: 0 };
  });
  players[0].maxMana = 1;
  players[0].mana = 1;
  return {
    seed, battleId: `battle_tcg_${seed}`, rulesVersion: TCG_RULES_VERSION, botDeckId: botDeck.deck_id,
    round: 1, maxRounds: MAX_ROUNDS, phase: 'action', activePlayer: 0, priority: 0,
    passes: 0, stack: [], mulliganDone: false, nextStackId: 1, nextTrapId: 1, pendingAttack: null, winner: null, result: null,
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
  finishTcg(updated, 1 - playerIndex, 'surrender');
  return updated;
}

export function tcgCardIssue(match, playerIndex, card) {
  const player = match.players[playerIndex];
  if (!player) return 'Chủ soái không hợp lệ.';
  if (match.result || !['action', 'reaction'].includes(match.phase) || match.priority !== playerIndex) return 'Bạn chưa có quyền hành động.';
  if (player.mana < tcgCardCost(match, playerIndex, card)) return 'Không đủ mana.';
  if (match.phase === 'reaction' && !TCG_REACTIONS.includes(card.type)) return 'Chỉ Tốc chú và Tức chú dùng được khi phản ứng.';
  if (card.type === 'unit') return player.units.length >= TCG_BOARD_LIMIT ? 'Đã đầy 5 vị trí đơn vị.' : '';
  if (card.type === 'trap') {
    if (player.traps.length >= TCG_TRAP_LIMIT) return 'Đã đầy 2 vị trí bẫy.';
    return !modern(match) || tcgTrapRule(card) ? '' : 'Bẫy này chưa có điều kiện kích hoạt hợp lệ.';
  }
  if (!TCG_SPELL_TYPES.includes(card.type) || !tcgEffectText(card)) return 'Hiệu ứng lá bài chưa được hỗ trợ.';
  if (card.type === 'slow_spell' && match.stack.length) return 'Chậm chú không thể vào hàng chờ đang mở.';
  if (card.requires_character && !tcgCaster(match, playerIndex, card)) return 'Vị Linh thi triển tuyệt kỹ phải có mặt trên bàn.';
  return tcgSpellTargets(match, playerIndex, card).length ? '' : 'Chưa có mục tiêu hợp lệ.';
}

export function canPlayTcgCard(match, playerIndex, card) {
  return !tcgCardIssue(match, playerIndex, card);
}

export function playTcgCard(match, playerIndex, instanceId, targetId = null) {
  assertMatch(match);
  const player = match.players[playerIndex];
  if (!player) throw new Error('Chủ soái không hợp lệ.');
  const handIndex = player.hand.findIndex(card => card.instance_id === instanceId);
  if (handIndex < 0) throw new Error('Lá bài không còn trong tay.');
  const card = player.hand[handIndex];
  const issue = tcgCardIssue(match, playerIndex, card);
  if (issue) throw new Error(issue);
  const target = targetId ?? (card.effect?.kind === 'deal_damage' ? 'commander' : null);
  if (TCG_SPELL_TYPES.includes(card.type) && !tcgSpellTargets(match, playerIndex, card).some(item => item.id === target)) {
    throw new Error('Hãy chọn mục tiêu hợp lệ.');
  }
  const updated = structuredClone(match);
  const owner = updated.players[playerIndex];
  const played = owner.hand.splice(handIndex, 1)[0];
  const cost = tcgCardCost(updated, playerIndex, played);
  owner.mana -= cost;
  const opponentIndex = 1 - playerIndex;
  updated.priority = played.type === 'burst_spell' ? playerIndex : opponentIndex;
  updated.passes = 0;
  if (modern(updated)) {
    owner.chainElement = played.type === 'trap' ? null : played.element;
    if (cost < played.cost) {
      owner.resonanceUsed = true;
      logEvent(updated, 'resonance', `Cộng hưởng · ${played.display_name} giảm 1 mana.`);
    }
  }
  if (played.type === 'unit') {
    const unit = { ...played, current_def: played.max_def, lane: firstOpenLane(owner.units), ready: Boolean(played.keywords?.includes('haste')) };
    owner.units.push(unit);
    logEvent(updated, 'unit_summoned', `${played.display_name} vào sân.`);
    gameEvents.emit('unit_summoned', { card_id: played.card_id, player_index: playerIndex, element: played.element, target_lane: unit.lane },
      tcgContext(updated, null, unit.instance_id));
    if (played.on_play?.kind === 'shield') applyTcgSupport(updated, played, playerIndex, unit, 'shield', played.on_play.value);
    if (played.on_play?.kind === 'draw') drawTcgEffect(updated, playerIndex, played.on_play.value, played);
    if (modern(updated)) openTrapWindow(updated, opponentIndex, {
      when: 'unit_summoned', unitId: unit.instance_id, cardId: unit.card_id, cost: played.cost,
    });
  } else if (played.type === 'trap') {
    const slot = owner.traps.length;
    const trap = { card: played, setRound: updated.round, faceDown: true };
    if (modern(updated)) Object.assign(trap, { setTurn: tcgTurnSerial(updated), token: updated.nextTrapId++ });
    owner.traps.push(trap);
    logEvent(updated, 'trap_set', 'Đã đặt một bẫy úp.');
    gameEvents.emit('trap_set', { player_index: playerIndex, slot }, tcgContext(updated, null, tcgTrapAnchor(playerIndex, slot)));
  } else if (played.type === 'fast_spell' || (modern(updated) && played.type === 'slow_spell')) {
    const sourceId = tcgCaster(updated, playerIndex, played)?.instance_id;
    const item = { id: updated.nextStackId++, kind: 'spell', card: played, owner: playerIndex, targetId: target, sourceId };
    updated.phase = 'reaction';
    updated.stack.push(item);
    logEvent(updated, 'spell_cast', `${played.display_name} chờ phản ứng.`);
    emitCardPlayed(updated, played, playerIndex, sourceId);
    if (modern(updated)) openTrapWindow(updated, opponentIndex, {
      when: 'spell_cast', stackId: item.id, cardId: played.card_id, cardType: played.type, cost: played.cost,
    });
    else revealSpellTrap(updated, playerIndex);
  } else {
    const sourceId = tcgCaster(updated, playerIndex, played)?.instance_id;
    emitCardPlayed(updated, played, playerIndex, sourceId);
    resolveSpell(updated, played, playerIndex, target, sourceId);
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
    updated.priority = 1 - playerIndex;
    resolveStackTop(updated);
    if (updated.phase === 'reaction' && !updated.stack.length) {
      if (!updated.pendingAttack) closeReaction(updated);
      else if (modern(updated) && !hasAttackResponse(updated)) resolvePendingAttack(updated);
    }
    return updated;
  }
  if (updated.phase === 'reaction') {
    if (updated.pendingAttack) resolvePendingAttack(updated);
    else closeReaction(updated);
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
  const ready = player.units.filter(tcgCanAttack);
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
  const armedTrapIndex = modern(updated) ? -1 : traps.findIndex(trap => trap.faceDown && tcgTrapArmed(updated, trap)
    && trap.card.trigger?.when === 'attack_declared' && active.length >= (trap.card.trigger.condition?.min_attackers ?? 1));
  if (armedTrapIndex >= 0) {
    const [trap] = traps.splice(armedTrapIndex, 1);
    updated.stack.push({ id: updated.nextStackId++, kind: 'attack_counter', card: trap.card, owner: defender });
    updated.phase = 'reaction';
    updated.priority = playerIndex;
    updated.passes = 0;
    logEvent(updated, 'trap_revealed', `${trap.card.display_name} lật mở khi có đợt tấn công.`);
    emitTrapReveal(updated, trap.card, defender, armedTrapIndex, 'attack_declared');
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
    .filter(unit => tcgCanBlock(unit) && pending.attackerIds.includes(unit.instance_id));
}

function eligibleBlockers(match, playerIndex) {
  return match.players[playerIndex].units.filter(tcgCanBlock);
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
  const defender = 1 - match.pendingAttack.playerIndex;
  match.phase = 'reaction';
  match.priority = defender;
  match.passes = 0;
  if (modern(match) && openTrapWindow(match, defender, { when: 'attack_declared' })) return;
  if (!hasAttackResponse(match)) resolvePendingAttack(match);
}

function hasAttackResponse(match) {
  return match.players.some((player, index) => player.hand.some(card => TCG_REACTIONS.includes(card.type)
    && tcgCardCost(match, index, card) <= player.mana && tcgSpellTargets(match, index, card).length));
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
    if (updated.phase === 'trap_choice') {
      if (updated.priority === 0 && yieldToPlayer) return updated;
      updated = decideTcgTrap(updated, updated.priority, chooseTcgTrap(updated));
      continue;
    }
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
      const ready = updated.players[1].units.filter(tcgCanAttack);
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
  while (['action', 'reaction', 'block_assign', 'trap_choice'].includes(updated.phase) && updated.priority === 1 && safety++ < 48) {
    if (updated.phase === 'trap_choice') {
      updated = decideTcgTrap(updated, 1, chooseTcgTrap(updated));
      continue;
    }
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
    return tcgSpellTargets(match, 1, card).map(target => {
      const score = scoreTcgSpell(match, card, target);
      return { card, targetId: target.id, score: advanced ? score / (1 + .09 * tcgCardCost(match, 1, card)) : score };
    });
  });
  const best = moves.reduce((prior, move) => !prior || move.score > prior.score ? move : prior, null);
  return best ? { instance_id: best.card.instance_id, target_id: best.targetId } : null;
}

function scoreTcgSpell(match, card, target) {
  const { value, kind } = card.effect;
  const { unit, units, item } = target;
  const damage = (unit, value) => value >= tcgUnitDurability(unit)
    ? 1050 + tcgUnitAttack(unit) : 150 + value * .2;
  const heal = (unit, value) => Math.min(value, unit.max_def - unit.current_def) * .8;
  const reacting = Boolean(match.pendingAttack) * 220;
  switch (kind) {
    case 'deal_damage': return unit ? damage(unit, value) : value >= match.players[0].hp ? 10_000 : 550 + value * .2;
    case 'restore_defense': return 250 + heal(unit, value);
    case 'grant_shield':
    case 'boost_attack': return 210 + value * .65 + reacting + tcgUnitAttack(unit) * .1;
    case 'sweep_damage': return units.reduce((total, item) => total + damage(item, value), 0);
    case 'bind_damage': return damage(unit, value) + tcgUnitAttack(unit) * .65;
    case 'team_heal': return 150 + units.reduce((total, item) => total + heal(item, value), 0);
    case 'team_shield': return 150 + units.length * value * .54 + reacting;
    case 'execute': return 1100 + tcgUnitAttack(unit);
    case 'heal_commander': return Math.min(value, TCG_MAX_HP - match.players[1].hp) * (match.players[1].hp < 2000 ? 1.65 : .55);
    case 'draw_cards': return 150 + Math.min(value, TCG_HAND_LIMIT - match.players[1].hand.length + 1) * 260;
    case 'disarm_trap': return 680;
    case 'scout_trap': return 450;
    case 'counter_reaction': return 770 + item.card.cost * 180;
    default: return 0;
  }
}

function openTrapWindow(match, owner, intent) {
  if (!tcgTrapOptions(match, owner, intent).length) return false;
  if (match.phase !== 'reaction') match.trapReturn = { phase: match.phase, priority: match.priority };
  match.pendingTrap = { owner, intent };
  match.phase = 'trap_choice';
  match.priority = owner;
  match.passes = 0;
  return true;
}

export function decideTcgTrap(match, playerIndex, instanceId = null) {
  assertMatch(match);
  if (match.phase !== 'trap_choice' || match.pendingTrap?.owner !== playerIndex) throw new Error('Chưa đến lượt chọn bẫy.');
  const options = tcgTrapOptions(match);
  if (instanceId !== null && !options.some(trap => trap.card.instance_id === instanceId)) throw new Error('Bẫy không thể kích hoạt.');
  const updated = structuredClone(match);
  const { intent } = updated.pendingTrap;
  delete updated.pendingTrap;
  updated.phase = 'reaction';
  updated.passes = 0;
  if (instanceId === null) {
    logEvent(updated, 'trap_held', 'Cửa sổ bẫy đã qua.');
    if (!updated.stack.length) {
      if (!updated.pendingAttack) closeReaction(updated);
      else if (!hasAttackResponse(updated)) resolvePendingAttack(updated);
    }
    return updated;
  }
  const traps = updated.players[playerIndex].traps;
  const slot = traps.findIndex(trap => trap.card.instance_id === instanceId);
  const [trap] = traps.splice(slot, 1);
  updated.stack.push({ id: updated.nextStackId++, kind: 'trap', card: trap.card, owner: playerIndex, intent });
  updated.priority = 1 - playerIndex;
  logEvent(updated, 'trap_revealed', `${trap.card.display_name} lật mở và chờ xử lý.`);
  emitTrapReveal(updated, trap.card, playerIndex, slot, intent.when);
  return updated;
}

function nextFallenTrap(match) {
  while (match.fallenTraps?.length && !match.result) {
    const { owner, intent } = match.fallenTraps.shift();
    if (openTrapWindow(match, owner, intent)) break;
  }
  if (!match.fallenTraps?.length) delete match.fallenTraps;
}

function closeReaction(match) {
  const resume = match.trapReturn;
  delete match.trapReturn;
  match.phase = resume?.phase ?? 'action';
  match.priority = resume?.priority ?? match.priority;
  nextFallenTrap(match);
}

function revealFallenTraps(match, fallen) {
  if (!modern(match) || match.result) return;
  const intents = fallen.flatMap(({ owner, unit }) => {
    const intent = { when: 'ally_fallen', unitId: unit.instance_id, cardId: unit.card_id, cost: unit.cost };
    return tcgTrapOptions(match, owner, intent).length ? [{ owner, intent }] : [];
  });
  if (!intents.length) return;
  (match.fallenTraps ??= []).push(...intents);
  if (!match.pendingTrap) nextFallenTrap(match);
}

export function tcgTrapAnchor(player, slot) { return `trap:p${player}:${slot}`; }

export function tcgExposedDamage(attackers, defenders, assignedBlocks) {
  const blocks = new Map(assignedBlocks.map(({ lane, blockerId }) => [lane, blockerId]));
  return attackers.reduce((total, attacker) => {
    const blocker = defenders.find(unit => unit.instance_id === blocks.get(attacker.lane) && tcgCanBlock(unit));
    const attack = tcgUnitAttack(attacker);
    return total + (blocker ? tcgPierce(attacker, attack, tcgUnitDurability(blocker)) : attack);
  }, 0);
}

function tcgContext(match, source, target) {
  return {
    battle_id: match.battleId, rules_version: modern(match) ? 'client-tcg-v2' : 'client-tcg-v1', tick: 0,
    action_seq: match.eventSeq, source_id: source ?? undefined, target_id: target ?? undefined,
  };
}

function emitCardPlayed(match, card, owner, caster) {
  gameEvents.emit('card_played', { card_id: card.card_id, player_index: owner, element: card.element, ultimate: Boolean(card.requires_character) },
    tcgContext(match, caster, `commander:p${owner}`));
}

function emitTrapReveal(match, card, owner, slot, trigger) {
  gameEvents.emit('trap_revealed', { card_id: card.card_id, trigger, player_index: owner, slot, element: card.element },
    tcgContext(match, tcgTrapAnchor(owner, slot), `commander:p${owner}`));
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
  emitTrapReveal(match, trap.card, 1 - spellOwner, trapIndex, 'spell_cast');
}

function resolveStackTop(match) {
  const item = match.stack.pop();
  if (!item) return;
  if (item.kind === 'counter') {
    match.players[item.owner].graveyard.push(item.card);
    cancelTcgStackItem(match, item.card, item.targetStackId);
  } else if (item.kind === 'attack_counter') {
    match.players[item.owner].graveyard.push(item.card);
    if (match.pendingAttack) match.pendingAttack.canceled = true;
    logEvent(match, 'attack_countered', 'Đợt tấn công đã bị hủy.');
  } else if (item.kind === 'trap') resolveTrap(match, item);
  else resolveSpell(match, item.card, item.owner, item.targetId, item.sourceId);
}

function cancelTcgStackItem(match, source, stackId) {
  const index = match.stack.findIndex(item => item.id === stackId);
  if (index < 0) {
    logEvent(match, 'spell_fizzled', `${source.display_name} mất mục tiêu.`);
    return;
  }
  const [countered] = match.stack.splice(index, 1);
  match.players[countered.owner].graveyard.push(countered.card);
  logEvent(match, 'stack_item_countered', `${source.display_name} hóa giải ${countered.card.display_name}.`);
}

function damageTcgUnit(unit, damage) {
  const absorbed = Math.min(unit.shield ?? 0, damage);
  const loss = Math.min(unit.current_def, damage - absorbed);
  if (absorbed) unit.shield -= absorbed;
  unit.current_def -= loss;
  return { absorbed, loss, defeated: unit.current_def === 0 };
}

function removeFallenUnits(match) {
  const fallen = [];
  for (const [owner, player] of match.players.entries()) {
    const dead = player.units.filter(unit => unit.current_def <= 0);
    player.graveyard.push(...dead);
    player.units = player.units.filter(unit => unit.current_def > 0);
    fallen.push(...dead.map(unit => ({ owner, unit })));
  }
  return fallen;
}

function resolveSpell(match, card, ownerIndex, targetId, caster) {
  const { kind, value } = card.effect;
  match.players[ownerIndex].graveyard.push(card);
  const target = tcgSpellTargets(match, ownerIndex, card).find(item => item.id === targetId);
  const casterPresent = !card.requires_character || match.players[ownerIndex].units.some(unit => unit.instance_id === caster && unit.current_def > 0);
  if (!target || !casterPresent) {
    logEvent(match, 'spell_fizzled', `${card.display_name} mất mục tiêu.`);
    return;
  }
  const { unit, units, player, slot, item } = target;
  const source = { card, owner: ownerIndex, caster, kind: 'spell' };
  logEvent(match, 'spell_resolved', `${card.display_name} được thi triển.`);
  if (card.requires_character) gameEvents.emit('tcg_ultimate_resolved', {
    card_id: card.card_id, character_id: card.requires_character, element: card.element, player_index: ownerIndex,
  }, tcgContext(match, caster));
  switch (kind) {
    case 'deal_damage': damageTcgTargets(match, source, player, [unit], value); break;
    case 'sweep_damage': damageTcgTargets(match, source, player, units, value); break;
    case 'bind_damage': bindTcgUnit(match, player, unit); damageTcgTargets(match, source, player, [unit], value); break;
    case 'execute': damageTcgTargets(match, source, player, [unit], tcgUnitDurability(unit)); break;
    case 'restore_defense': applyTcgSupport(match, card, player, unit, 'heal', value, caster); break;
    case 'team_heal': for (const ally of units) applyTcgSupport(match, card, player, ally, 'heal', value, caster); break;
    case 'grant_shield': applyTcgSupport(match, card, player, unit, 'shield', value, caster); break;
    case 'team_shield': for (const ally of units) applyTcgSupport(match, card, player, ally, 'shield', value, caster); break;
    case 'boost_attack': applyTcgSupport(match, card, player, unit, 'boost', value, caster); break;
    case 'heal_commander': applyTcgSupport(match, card, player, null, 'heal', value, caster); break;
    case 'draw_cards': drawTcgEffect(match, player, value, card); break;
    case 'disarm_trap':
    case 'scout_trap': changeTcgTrap(match, source, player, slot); break;
    case 'counter_reaction': cancelTcgStackItem(match, card, item.id); break;
  }
}

function damageTcgTargets(match, { card, owner, caster, kind }, playerIndex, targets, damage) {
  const recipient = match.players[playerIndex];
  for (const unit of targets) {
    const result = unit ? damageTcgUnit(unit, damage) : { absorbed: 0, loss: Math.min(damage, recipient.hp) };
    if (!unit) recipient.hp -= result.loss;
    const name = unit?.display_name ?? 'chủ soái';
    gameEvents.emit('hit_resolved', {
      damage, hp_damage: result.loss, absorbed: result.absorbed, effect_kind: kind, defeated: Boolean(result.defeated),
      card_id: card.card_id, element: card.element, ultimate: Boolean(card.requires_character),
      target_player: playerIndex, target_lane: unit?.lane,
    }, tcgContext(match, caster ?? card.card_id, unit?.instance_id ?? `commander:p${playerIndex}`));
    logEvent(match, 'damage_resolved', `${card.display_name} gây ${result.loss} sát thương lên ${name}${result.absorbed ? ` · chặn ${result.absorbed}` : ''}.`);
  }
  const fallen = removeFallenUnits(match);
  if (recipient.hp === 0) finishTcg(match, owner);
  else revealFallenTraps(match, fallen);
}

function applyTcgSupport(match, card, playerIndex, unit, kind, value, caster) {
  const player = match.players[playerIndex];
  let amount = value;
  let label;
  if (!unit) {
    amount = Math.min(value, TCG_MAX_HP - player.hp);
    player.hp += amount;
    label = 'HP';
  } else if (kind === 'heal') {
    amount = Math.min(value, unit.max_def - unit.current_def);
    unit.current_def += amount;
    label = 'DEF';
  } else if (kind === 'shield') {
    unit.shield = (unit.shield ?? 0) + value;
    label = 'hộ thuẫn';
  } else {
    unit.attackBuff = (unit.attackBuff ?? 0) + value;
    label = 'ATK';
  }
  if (!amount) return;
  gameEvents.emit('tcg_support_resolved', { element: card.element, amount, label, target_player: playerIndex, kind,
    ultimate: Boolean(card.requires_character) },
  tcgContext(match, caster ?? card.instance_id, unit?.instance_id ?? `commander:p${playerIndex}`));
  logEvent(match, 'support_resolved', `${card.display_name} · ${unit?.display_name ?? 'Chủ soái'} +${amount} ${label}.`);
}

function bindTcgUnit(match, owner, unit) {
  unit.rootedUntil = tcgTurnSerial(match) + Number(match.activePlayer !== owner);
  logEvent(match, 'unit_bound', `${unit.display_name} bị trói.`);
}

function changeTcgTrap(match, { card, owner }, enemy, slot) {
  const traps = match.players[enemy].traps;
  const trap = traps[slot];
  if (card.effect.kind === 'scout_trap') {
    trap.faceDown = false;
    logEvent(match, 'trap_scouted', `${trap.card.display_name} bị lộ và vẫn giữ hiệu lực.`);
    emitTrapReveal(match, trap.card, enemy, slot, 'scout');
    drawTcgEffect(match, owner, 1, card);
    return;
  }
  traps.splice(slot, 1);
  match.players[enemy].graveyard.push(trap.faceDown ? { ...trap.card, hidden: true } : trap.card);
  logEvent(match, 'trap_disarmed', trap.faceDown ? 'Đã gỡ một bẫy úp.' : `Đã gỡ ${trap.card.display_name}.`);
  gameEvents.emit('tcg_trap_disarmed', { player_index: enemy, slot, element: card.element }, tcgContext(match, null, tcgTrapAnchor(enemy, slot)));
}

function resolveTrap(match, { card, owner, intent }) {
  const player = match.players[owner];
  const opponent = 1 - owner;
  player.graveyard.push(card);
  const value = card.effect.value;
  const source = { card, owner, kind: 'trap' };
  logEvent(match, 'trap_resolved', `${card.display_name} được xử lý.`);
  switch (tcgTrapKind(card)) {
    case 'counter_spell': cancelTcgStackItem(match, card, intent.stackId); break;
    case 'cancel_attack':
      if (match.pendingAttack) {
        match.pendingAttack.canceled = true;
        logEvent(match, 'attack_countered', 'Đợt tấn công đã bị hủy.');
      }
      break;
    case 'guard_commander': {
      const incoming = tcgAttackLanes(match).filter(lane => !lane.blocker)
        .sort((a, b) => tcgUnitAttack(b.unit) - tcgUnitAttack(a.unit) || a.unit.lane - b.unit.lane)[0];
      if (!incoming) break;
      (match.pendingAttack.prevented ??= []).push(incoming.unit.lane);
      logEvent(match, 'attack_blocked', `Đòn đường ${incoming.unit.lane + 1} bị bẫy chặn.`);
      damageTcgTargets(match, source, opponent, [null], Math.min(value, tcgUnitAttack(incoming.unit)));
      break;
    }
    case 'ward_blockers':
      for (const { blocker } of tcgAttackLanes(match)) if (blocker) applyTcgSupport(match, card, owner, blocker, 'shield', value);
      break;
    case 'burn_attackers':
      damageTcgTargets(match, source, opponent, tcgAttackLanes(match).map(({ unit }) => unit), value);
      break;
    case 'bind_summon': {
      const unit = match.players[opponent].units.find(unit => unit.instance_id === intent.unitId);
      if (!unit) break;
      bindTcgUnit(match, opponent, unit);
      damageTcgTargets(match, source, opponent, [unit], value);
      break;
    }
    case 'summon_reserve':
      applyTcgSupport(match, card, owner, null, 'heal', value);
      drawTcgEffect(match, owner, 1, card);
      break;
    case 'revive_unit': {
      const index = player.graveyard.findIndex(unit => unit.instance_id === intent.unitId && unit.type === 'unit');
      if (index < 0 || player.units.length >= TCG_BOARD_LIMIT) break;
      const [{ shield, attackBuff, rootedUntil, ...unit }] = player.graveyard.splice(index, 1);
      Object.assign(unit, { current_def: Math.min(unit.max_def, value), ready: false, lane: firstOpenLane(player.units) });
      player.units.push(unit);
      logEvent(match, 'unit_revived', `${unit.display_name} trở lại bàn đấu.`);
      gameEvents.emit('unit_summoned', { card_id: unit.card_id, player_index: owner, element: unit.element, target_lane: unit.lane, revived: true },
        tcgContext(match, null, unit.instance_id));
      break;
    }
  }
}

function resolvePendingAttack(match) {
  const pending = match.pendingAttack;
  if (!pending) return;
  const attackers = declaredTcgAttackers(match);
  match.pendingAttack = null;
  match.phase = 'round_end';
  match.priority = pending.playerIndex;
  if (pending.canceled) logEvent(match, 'attack_canceled', 'Đợt tấn công đã bị hủy.');
  else resolveCombat(match, pending.playerIndex, attackers.filter(unit => !pending.prevented?.includes(unit.lane)), pending.blocks ?? []);
  if (!match.result && !match.pendingTrap) nextFallenTrap(match);
}

function resolveCombat(match, attackerIndex, attackers, assignedBlocks) {
  const defenderIndex = 1 - attackerIndex;
  const defender = match.players[defenderIndex];
  const blocks = new Map(assignedBlocks.map(({ lane, blockerId }) => [lane, blockerId]));
  const drain = [0, 0];
  let faceDamage = 0;
  function faceHit(attacker, damage) {
    const loss = Math.min(damage, Math.max(0, defender.hp - faceDamage));
    faceDamage += damage;
    emitTcgHit(match, damage, attacker, `commander:p${defenderIndex}`, defenderIndex, undefined, { loss, absorbed: 0 });
    return loss;
  }
  for (const attacker of attackers) {
    const blocker = defender.units.find(unit => tcgCanBlock(unit) && unit.instance_id === blocks.get(attacker.lane));
    const attack = tcgUnitAttack(attacker);
    if (!blocker) {
      drain[attackerIndex] += lifeDrain(attacker, faceHit(attacker, attack));
      continue;
    }
    const counter = tcgUnitAttack(blocker);
    const excess = tcgPierce(attacker, attack, tcgUnitDurability(blocker));
    const defenderHit = damageTcgUnit(blocker, attack);
    const attackerHit = damageTcgUnit(attacker, counter);
    emitTcgHit(match, counter, blocker, attacker.instance_id, attackerIndex, attacker.lane, attackerHit);
    emitTcgHit(match, attack - excess, attacker, blocker.instance_id, defenderIndex, blocker.lane, defenderHit);
    const spilled = excess > 0 ? faceHit(attacker, excess) : 0;
    drain[attackerIndex] += lifeDrain(attacker, defenderHit.loss + spilled);
    drain[defenderIndex] += lifeDrain(blocker, attackerHit.loss);
  }
  defender.hp -= faceDamage;
  for (const [owner, player] of match.players.entries()) {
    if (drain[owner] > 0) applyTcgSupport(match, { display_name: 'Hút vị', element: 'shadow' }, owner, null, 'heal', drain[owner]);
    player.hp = Math.max(0, player.hp);
  }
  const fallen = removeFallenUnits(match);
  logEvent(match, 'combat_resolved', `${attackers.length} đơn vị tham chiến. Sát thương được áp dụng đồng thời.`);
  if (defender.hp <= 0) finishTcg(match, attackerIndex);
  else revealFallenTraps(match, fallen);
}

function lifeDrain(unit, damage) {
  return unit.keywords?.includes('lifesteal') ? Math.floor(damage * .35) : 0;
}

function advanceTurn(match, playerIndex) {
  if (match.result) return match;
  const next = 1 - playerIndex;
  for (const [owner, player] of match.players.entries()) {
    delete player.chainElement;
    delete player.resonanceUsed;
    for (const unit of player.units) {
      delete unit.shield;
      delete unit.attackBuff;
      if (owner === playerIndex && unit.rootedUntil <= tcgTurnSerial(match)) delete unit.rootedUntil;
    }
  }
  if (next === 0) match.round += 1;
  if (match.round > match.maxRounds) {
    const [first, second] = match.players;
    const winner = first.hp === second.hp ? null : first.hp > second.hp ? 0 : 1;
    finishTcg(match, winner, winner === null ? 'round_limit_draw' : 'round_limit_winner');
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

function drawTcgEffect(match, playerIndex, count, source) {
  const draws = Math.min(count, match.players[playerIndex].deck.length);
  for (let index = 0; index < draws; index++) drawCard(match, playerIndex);
  if (!draws) return;
  logEvent(match, 'cards_drawn', `${source.display_name} · ${playerIndex === 0 ? 'Bạn' : 'Đối thủ'} rút ${draws} lá.`);
  gameEvents.emit('tcg_cards_drawn', { player_index: playerIndex, amount: draws, element: source.element },
    tcgContext(match, null, `commander:p${playerIndex}`));
}

function drawCard(match, playerIndex) {
  const player = match.players[playerIndex];
  if (!player.deck.length) { finishTcg(match, 1 - playerIndex, 'deck_out'); return; }
  const card = player.deck.pop();
  if (player.hand.length < TCG_HAND_LIMIT) player.hand.push(card);
  else {
    player.graveyard.push(card);
    logEvent(match, 'hand_overflow', playerIndex === 0 ? 'Tay bạn đã đầy. Lá vừa rút chuyển vào mộ bài.' : 'Tay đối thủ đã đầy. Một lá chuyển vào mộ bài.');
  }
}

function finishTcg(match, winner, result = 'commander_defeated') {
  match.winner = winner;
  match.result = result;
  match.phase = 'result';
  for (const item of match.stack) match.players[item.owner].graveyard.push(item.card);
  match.stack = [];
  match.pendingAttack = null;
  delete match.pendingTrap;
  delete match.trapReturn;
  delete match.fallenTraps;
  const text = result === 'surrender'
    ? winner === 0 ? 'Đối thủ đã đầu hàng.' : 'Bạn đã đầu hàng.'
    : result === 'deck_out' ? (winner === 0 ? 'Đối thủ hết bài để rút.' : 'Bạn hết bài để rút.')
    : winner === null ? 'Hai bên còn cùng HP khi hết lượt.' : winner === 0 ? 'Bạn thắng trận.' : 'Đối thủ thắng trận.';
  logEvent(match, 'match_finished', text);
  gameEvents.emit('battle_finished', { mode: 'tcg', winner: winner === null ? 'draw' : winner === 0 ? 'player' : 'bot' }, tcgContext(match));
}

function emitTcgHit(match, damage, source, targetId, targetPlayer, targetLane, { absorbed, loss, defeated }) {
  gameEvents.emit('hit_resolved', {
    damage, hp_damage: loss, absorbed, source_kind: 'tcg_combat', element: source.element,
    target_player: targetPlayer, target_lane: targetLane, defeated: Boolean(defeated),
  }, tcgContext(match, source.instance_id, targetId));
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
