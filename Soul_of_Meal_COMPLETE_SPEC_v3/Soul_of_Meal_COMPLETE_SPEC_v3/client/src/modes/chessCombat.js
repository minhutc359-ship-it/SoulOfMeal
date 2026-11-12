import { applyChessItems } from './chessItems.js';

const WIDTH = 7;
const HEIGHT = 8;
const MAX_TICKS = 45 * 30;
const RANGED = ['mage', 'ranged', 'support'];
const CARDINAL = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const HEX_STEPS = [
  [[1, 0], [-1, 0], [0, 1], [-1, 1], [0, -1], [-1, -1]],
  [[1, 0], [-1, 0], [1, 1], [0, 1], [1, -1], [0, -1]],
];

export const CHESS_TRAITS = {
  fire: { name: 'Bếp Lửa', detail: '+15% công cho quân Hỏa', stat: 'atk', bonus: .15 },
  wood: { name: 'Mầm Sống', detail: '+15% máu cho quân Mộc', stat: 'maxHp', bonus: .15 },
  light: { name: 'Hộ Quang', detail: '+15% thủ cho quân Quang', stat: 'def', bonus: .15 },
  guardian: { name: 'Hộ Vệ', detail: '+20% thủ cho Hộ vệ', stat: 'def', bonus: .20 },
  support: { name: 'Tiếp Sức', detail: '+20% máu cho Hỗ trợ', stat: 'maxHp', bonus: .20 },
};

export function chessTraits(units) {
  const counts = new Map();
  for (const unit of new Map(units.map(unit => [unit.id, unit])).values()) {
    counts.set(unit.element, (counts.get(unit.element) ?? 0) + 1);
    if (unit.job) counts.set(unit.job, (counts.get(unit.job) ?? 0) + 1);
  }
  return counts;
}

export function chessHexOffset(row) { return (row & 1) / 2; }

export function chessHexDistance(first, second) {
  const dq = first.x - (first.y >> 1) - second.x + (second.y >> 1);
  const dr = first.y - second.y;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}

function positionKey({ x, y }) { return y * WIDTH + x; }

export function chessPathStep(actor, target, range, occupied, hex) {
  const distance = hex ? chessHexDistance : squareDistance;
  const visited = new Set([positionKey(actor)]);
  const queue = [{ x: actor.x, y: actor.y, first: null }];
  for (let i = 0; i < queue.length; i++) {
    const { x, y, first } = queue[i];
    for (const [dx, dy] of hex ? HEX_STEPS[y & 1] : CARDINAL) {
      const next = { x: x + dx, y: y + dy };
      const key = positionKey(next);
      if (next.x < 0 || next.x >= WIDTH || next.y < 0 || next.y >= HEIGHT || occupied.has(key) || visited.has(key)) continue;
      if (distance(next, target) <= range) return first ?? next;
      visited.add(key);
      queue.push({ ...next, first: first ?? next });
    }
  }
  return null;
}

function squareDistance(first, second) { return Math.abs(first.x - second.x) + Math.abs(first.y - second.y); }

function spawnTeam(units, team, hex) {
  const counts = chessTraits(units);
  return units.map((unit, index) => {
    const enemy = team === 'enemy';
    const actor = {
      ...unit, team, actorId: `${team}:${unit.id}:${index}`,
      y: enemy ? hex ? HEIGHT - 1 - unit.y : unit.y + 4 : unit.y,
      cooldown: enemy ? 6 + index * 2 : 0,
    };
    if (hex) Object.assign(actor, { mana: 0, shield: 0 });
    if (hex) applyChessItems(actor);
    const traits = hex ? [actor.element, actor.job] : [actor.element];
    for (const id of traits) {
      const trait = CHESS_TRAITS[id];
      if (!trait || counts.get(id) < 2) continue;
      actor[trait.stat] = Math.floor(actor[trait.stat] * (1 + trait.bonus));
    }
    actor.hp = actor.maxHp;
    return actor;
  });
}

function strike(source, target, skill, hex) {
  const damage = Math.max(1, Math.floor(source.atk * (skill ? 2.25 : 1)) - target.def);
  const absorbed = Math.min(target.shield ?? 0, damage);
  if (hex) {
    target.shield -= absorbed;
    target.mana = Math.min(100, target.mana + 10);
  }
  target.hp = Math.max(0, target.hp - damage + absorbed);
  return {
    damage, hp: target.hp, element: source.element, skill, absorbed,
    sourceMana: source.mana, targetMana: target.mana, shield: target.shield,
  };
}

function support(source, allies) {
  if (source.job === 'guardian') {
    const amount = Math.ceil(source.maxHp * .23);
    source.shield = Math.max(source.shield, amount);
    return { target: source, amount, shield: source.shield, hp: source.hp };
  }
  const target = allies.reduce((lowest, unit) => unit.hp / unit.maxHp < lowest.hp / lowest.maxHp ? unit : lowest, source);
  const amount = Math.min(target.maxHp - target.hp, Math.round(source.atk * 2.1));
  target.hp += amount;
  return { target, amount, hp: target.hp, shield: target.shield };
}

export function simulateChessCombat(player, enemy, { hex = false, replay = true } = {}) {
  const actors = [...spawnTeam(player, 'player', hex), ...spawnTeam(enemy, 'enemy', hex)];
  const startActors = replay ? structuredClone(actors) : null;
  const events = replay ? [] : null;
  const distance = hex ? chessHexDistance : squareDistance;
  let tick = 0;
  function record(type, source, target, payload) {
    events?.push({ tick, type, source_id: source.actorId, target_id: target.actorId, payload });
  }

  while (tick < MAX_TICKS) {
    if (!actors.some(unit => unit.hp > 0 && unit.team === 'player') || !actors.some(unit => unit.hp > 0 && unit.team === 'enemy')) break;
    tick++;
    for (const actor of actors) {
      if (actor.hp <= 0) continue;
      if (actor.cooldown > 0) {
        actor.cooldown--;
        continue;
      }
      const living = actors.filter(unit => unit.hp > 0);
      const targets = living.filter(unit => unit.team !== actor.team)
        .sort((a, b) => distance(actor, a) - distance(actor, b) || a.actorId.localeCompare(b.actorId));
      const target = targets[0];
      if (!target) continue;
      const range = RANGED.includes(actor.job) ? 3 : 1;
      if (distance(actor, target) > range) {
        const occupied = new Set(living.map(positionKey));
        let next;
        for (const candidate of targets) {
          next = chessPathStep(actor, candidate, range, occupied, hex);
          if (next) break;
        }
        if (next) {
          Object.assign(actor, next);
          events?.push({ tick, type: 'move', source_id: actor.actorId, ...next });
        }
        actor.cooldown = next ? 7 : 4;
        continue;
      }
      const skill = hex && actor.mana >= 100;
      if (hex) actor.mana = skill ? 0 : Math.min(100, actor.mana + 24);
      if (skill && (actor.job === 'guardian' || actor.job === 'support')) {
        const { target: ally, ...effect } = support(actor, living.filter(unit => unit.team === actor.team));
        record('ability', actor, ally, { ...effect, element: actor.element, sourceMana: actor.mana });
      } else record('hit_resolved', actor, target, strike(actor, target, skill, hex));
      actor.cooldown = actor.job === 'assassin' ? 22 : 30;
    }
  }
  return { tick, actors, startActors, events, ...(hex ? { geometry: 'hex' } : {}) };
}

export function chessBattleOutcome(combat, stage) {
  const allies = combat.actors.filter(unit => unit.team === 'player');
  const enemies = combat.actors.filter(unit => unit.team === 'enemy');
  const total = (units, stat) => units.reduce((sum, unit) => sum + unit[stat], 0);
  const playerHp = total(allies, 'hp');
  const enemyHp = total(enemies, 'hp');
  const timedOut = playerHp > 0 && enemyHp > 0;
  const difference = timedOut ? playerHp * total(enemies, 'maxHp') - enemyHp * total(allies, 'maxHp') : playerHp - enemyHp;
  const won = difference > 0;
  const draw = difference === 0;
  const damage = units => Math.min(25, 2 + Math.floor(stage / 2) + units.reduce((sum, unit) => sum + (unit.hp > 0 ? unit.star : 0), 0));
  return { won, draw, playerHp, enemyHp, damage: !won && !draw ? damage(enemies) : 0, enemyDamage: won ? damage(allies) : 0 };
}
