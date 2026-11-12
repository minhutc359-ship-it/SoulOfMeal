import { TCG_BOARD_LIMIT, TCG_MAX_HP, TCG_RULES_VERSION, tcgTurnSerial } from './tcgCards.js';
import { tcgUnitAttack } from './tcgStrategy.js';

export const TCG_TRAP_LABELS = {
  attack_declared: 'Địch tấn công',
  spell_cast: 'Địch thi triển phép',
  unit_summoned: 'Địch triệu hồi',
  ally_fallen: 'Đồng minh bị hạ',
};

const TRAP_EFFECTS = {
  cancel_attack: { when: 'attack_declared', text: () => 'Hủy đợt tấn công.' },
  counter_spell: { when: 'spell_cast', text: () => 'Hóa giải phép đang chờ.' },
  guard_commander: { when: 'attack_declared', text: n => `Chặn đòn không có quân chắn mạnh nhất và phản tối đa ${n} sát thương lên chủ soái địch.` },
  ward_blockers: { when: 'attack_declared', text: n => `Cấp ${n} hộ thuẫn đến hết lượt cho các đồng minh đang chặn.` },
  burn_attackers: { when: 'attack_declared', text: n => `Gây ${n} sát thương lên từng quân đang tấn công. Quân còn sống vẫn đánh.` },
  bind_summon: { when: 'unit_summoned', text: n => `Gây ${n} sát thương và trói quân vừa vào sân đến khi lượt của chủ kết thúc.` },
  summon_reserve: { when: 'unit_summoned', text: n => `Hồi tối đa ${n} HP cho chủ soái bạn và rút tối đa một lá.` },
  revive_unit: { when: 'ally_fallen', text: n => `Gọi lại đúng quân vừa bị hạ với tối đa ${n} DEF. Quân trở lại ở trạng thái nghỉ.` },
};

export function tcgTrapRule(card) {
  const { when, condition = {} } = card.trigger ?? {};
  const effect = TRAP_EFFECTS[tcgTrapKind(card)];
  if (!effect || effect.when !== when) return '';
  const filter = condition.card_type === 'fast_spell' ? ' · chỉ Tốc chú'
    : condition.min_cost ? ` · lá giá từ ${condition.min_cost}`
    : condition.max_cost ? ` · lá giá tối đa ${condition.max_cost}`
    : condition.min_attackers > 1 ? ` · từ ${condition.min_attackers} quân đánh` : '';
  return `${TCG_TRAP_LABELS[when]}${filter}. ${effect.text(card.effect.value)}`;
}

export function tcgTrapKind(card) {
  if (card.effect?.kind !== 'conditional_counter') return card.effect?.kind;
  return card.trigger?.when === 'attack_declared' ? 'cancel_attack' : 'counter_spell';
}

export function tcgTrapArmed(match, trap) {
  return match.rulesVersion === TCG_RULES_VERSION && Number.isInteger(trap.setTurn)
    ? trap.setTurn < tcgTurnSerial(match) : trap.setRound < match.round;
}

export function tcgAttackLanes(match) {
  const pending = match.pendingAttack;
  if (!pending || pending.canceled) return [];
  const defenders = match.players[1 - pending.playerIndex].units;
  const blockers = new Map((pending.blocks ?? []).map(block => [block.lane, block.blockerId]));
  return match.players[pending.playerIndex].units.filter(unit => unit.current_def > 0
    && pending.attackerIds.includes(unit.instance_id) && !unit.rootedUntil && !pending.prevented?.includes(unit.lane))
    .map(unit => ({
      unit,
      blocker: defenders.find(candidate => candidate.instance_id === blockers.get(unit.lane) && candidate.current_def > 0 && !candidate.rootedUntil),
    }));
}

export function tcgTrapOptions(match, owner = match.pendingTrap?.owner, intent = match.pendingTrap?.intent) {
  if (!intent || match.result || !match.players[owner]) return [];
  return match.players[owner].traps.filter(trap => tcgTrapArmed(match, trap) && trapMatches(match, owner, trap.card, intent));
}

function trapMatches(match, owner, card, intent) {
  const { when, condition = {} } = card.trigger ?? {};
  const kind = tcgTrapKind(card);
  if (when !== intent.when || TRAP_EFFECTS[kind]?.when !== when) return false;
  if (condition.card_type && condition.card_type !== intent.cardType) return false;
  if (condition.min_cost && !(intent.cost >= condition.min_cost)) return false;
  if (condition.max_cost && !(intent.cost <= condition.max_cost)) return false;
  if (when === 'attack_declared') {
    const lanes = tcgAttackLanes(match);
    if (lanes.length < (condition.min_attackers ?? 1)) return false;
    if (kind === 'guard_commander') return lanes.some(lane => !lane.blocker);
    if (kind === 'ward_blockers') return lanes.some(lane => lane.blocker);
  }
  if (when === 'spell_cast') return match.stack.some(item => item.id === intent.stackId && item.kind === 'spell' && item.owner !== owner);
  if (when === 'unit_summoned') return match.players[1 - owner].units.some(unit => unit.instance_id === intent.unitId && unit.current_def > 0);
  if (when === 'ally_fallen') return match.players[owner].units.length < TCG_BOARD_LIMIT
    && match.players[owner].graveyard.some(unit => unit.instance_id === intent.unitId && unit.type === 'unit');
  return true;
}

export function chooseTcgTrap(match) {
  const options = tcgTrapOptions(match);
  const owner = match.pendingTrap?.owner;
  const lanes = tcgAttackLanes(match);
  const exposed = lanes.filter(lane => !lane.blocker).reduce((sum, lane) => sum + tcgUnitAttack(lane.unit), 0);
  const best = options.map(trap => {
    const kind = tcgTrapKind(trap.card);
    const { value } = trap.card.effect;
    const score = {
      cancel_attack: exposed + lanes.length * 140,
      guard_commander: Math.max(0, ...lanes.filter(lane => !lane.blocker).map(lane => tcgUnitAttack(lane.unit))) + (value ?? 0) * .7,
      ward_blockers: lanes.filter(lane => lane.blocker).length * (value ?? 0),
      burn_attackers: lanes.length * (value ?? 0),
      counter_spell: 500 + (match.pendingTrap?.intent.cost ?? 0) * 110,
      bind_summon: 600 + (match.pendingTrap?.intent.cost ?? 0) * 110,
      summon_reserve: Math.min(value ?? 0, TCG_MAX_HP - match.players[owner].hp) + 380,
      revive_unit: 500 + (match.pendingTrap?.intent.cost ?? 0) * 180,
    }[kind];
    return { id: trap.card.instance_id, score };
  }).sort((a, b) => b.score - a.score)[0];
  return best?.id ?? null;
}
