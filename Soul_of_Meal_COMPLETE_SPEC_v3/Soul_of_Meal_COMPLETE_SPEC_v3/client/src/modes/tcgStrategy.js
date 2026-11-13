export function tcgUnitAttack(unit) {
  return Math.max(0, unit.atk + (unit.attackBuff ?? 0));
}

export function tcgUnitDurability(unit) {
  return unit.current_def + (unit.shield ?? 0);
}

export function tcgCanBlock(unit) {
  return unit.current_def > 0 && !unit.rootedUntil;
}

export function tcgCanAttack(unit) {
  return unit.ready && tcgCanBlock(unit);
}

export function tcgPierce(unit, damage, durability) {
  return unit.keywords?.includes('pierce') ? Math.max(0, damage - durability) : 0;
}

export function planTcgBlocks(attackers, defenders, hp, difficulty) {
  const commanderPressure = difficulty === 'extreme' ? 0.72 : 1;
  let best = { score: -Infinity, blocks: [] };
  const chosen = [];

  function search(index, used, exposed, trade) {
    if (index === attackers.length) {
      const score = trade - exposed * commanderPressure - (exposed >= hp ? 100_000 : 0);
      if (score > best.score) best = { score, blocks: [...chosen] };
      return;
    }
    const attacker = attackers[index];
    const attack = tcgUnitAttack(attacker);
    search(index + 1, used, exposed + attack, trade);
    for (const [slot, defender] of defenders.entries()) {
      if (used & (1 << slot)) continue;
      const counter = tcgUnitAttack(defender);
      const gain = Math.min(counter, tcgUnitDurability(attacker)) * .45
        + (counter >= tcgUnitDurability(attacker) ? attacker.atk + attacker.cost * 120 : 0);
      const loss = Math.min(attack, tcgUnitDurability(defender)) * .45
        + (attack >= tcgUnitDurability(defender) ? defender.atk + defender.cost * 120 : 0);
      chosen.push({ lane: attacker.lane, blockerId: defender.instance_id });
      search(index + 1, used | (1 << slot), exposed + tcgPierce(attacker, attack, tcgUnitDurability(defender)), trade + gain - loss);
      chosen.pop();
    }
  }
  search(0, 0, 0, 0);
  return best;
}

export function planTcgAttacks(attackers, defenders, hp) {
  let best = { score: 0, ids: [] };
  for (let mask = 1; mask < 1 << attackers.length; mask++) {
    const group = attackers.filter((_, index) => mask & (1 << index));
    const defense = planTcgBlocks(group, defenders, hp, 'extreme');
    const score = -defense.score + group.length;
    if (score > best.score) best = { score, ids: group.map(unit => unit.instance_id) };
  }
  return best.ids;
}
