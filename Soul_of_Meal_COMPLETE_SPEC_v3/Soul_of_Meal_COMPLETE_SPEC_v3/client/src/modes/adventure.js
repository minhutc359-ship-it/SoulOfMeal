import { gameEvents } from '../core/events.js';
import { moveWithCollision } from './adventureNavigation.js';
import { getAdventureMap } from './mapCatalog.js';
import { adventureBalance as balance } from './adventureBalance.js';

export const WORLD = { width: 960, height: 540 };
const PLAYER_SPEED = 190;
const TICK_RATE = 30;

const ENEMIES = {
  forest_wave: [
    { id: 'mob_mushroom_01', name: 'Nấm Lạc Vị', hp: 980, maxHp: 980, atk: 90, def: 20, interval: 54, element: 'wood' },
    { id: 'mob_pepper_01', name: 'Tiêu Tinh', hp: 1250, maxHp: 1250, atk: 110, def: 25, interval: 48, element: 'fire' },
  ],
  forest_boss: [
    { id: 'boss_bep_truong', name: 'Bếp Trưởng Hỏa Diệm', hp: 5200, maxHp: 5200, atk: 190, def: 85, interval: 75, element: 'fire', boss: true },
  ],
};

export function createAdventureState(save) {
  return {
    map: save.adventure.map,
    x: save.adventure.x,
    y: save.adventure.y,
    facing: 'down',
    tick: 0,
    input: { x: 0, y: 0 },
    battle: save.adventure.battle,
    lastMessage: save.adventure.quest === 'completed' ? 'Làng Ẩm Thực đã tìm lại hương vị.' :
      save.adventure.forestCleared ? 'Trở về làng để báo tin cho Lilia.' :
        save.adventure.map === 'forest' ? 'Theo dấu chân trong rừng.' : 'Tìm Lilia ở quảng trường để bắt đầu.',
    result: null,
  };
}

export function resolveMapSpawn(mapId, maps) {
  const map = getAdventureMap(maps, mapId);
  if (map?.world?.spawn) return { x: map.world.spawn.x, y: map.world.spawn.y };
  const fallback = { village: { x: 120, y: 310 }, forest: { x: 82, y: 420 } };
  return fallback[mapId] ?? { x: 120, y: 310 };
}

export function resolveMapTransition(mapId, toMap, maps) {
  const map = getAdventureMap(maps, mapId);
  if (map?.transitions) {
    const transition = map.transitions.find((door) => door.to === toMap || door.targetMap === toMap);
    if (transition?.spawn) return transition.spawn;
  }
  return resolveMapSpawn(toMap, maps);
}

export function transitionMap(state, save, mapId, maps) {
  const nextMap = mapId ?? state.map ?? 'village';
  const spawn = resolveMapTransition(state.map ?? 'village', nextMap, maps);
  const updated = structuredClone(save);
  updated.adventure.map = nextMap;
  updated.adventure.x = spawn.x;
  updated.adventure.y = spawn.y;
  state.map = nextMap;
  state.x = spawn.x;
  state.y = spawn.y;
  state.walkPath = [];
  state.walkTarget = null;
  return { state, save: updated, changed: true };
}

export function resolveCameraViewport(playerX, playerY, viewport, mapWidth = WORLD.width, mapHeight = WORLD.height) {
  const width = viewport.width ?? mapWidth;
  const height = viewport.height ?? mapHeight;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const clampedX = clamp(playerX - halfWidth, 0, Math.max(0, mapWidth - width));
  const clampedY = clamp(playerY - halfHeight, 0, Math.max(0, mapHeight - height));
  return { x: clampedX, y: clampedY };
}

export function setAdventureInput(state, x, y) {
  const length = Math.hypot(x, y) || 1;
  state.input.x = x / length;
  state.input.y = y / length;
}

export function nearestInteraction(state, save, maps) {
  if (state.battle) return null;
  const map = getAdventureMap(maps, state.map);
  if (!map) return null;
  const candidates = map.interactables
    .filter((item) => item.action !== 'chest' || !save.adventure.chestOpened)
    .filter((item) => item.action !== 'lilia' || save.adventure.quest !== 'completed')
    .filter((item) => item.action !== 'portal' || save.adventure.chestOpened)
    .filter((item) => item.action !== 'encounter' || !save.adventure.forestCleared)
    .filter((item) => item.action !== 'village_return' || save.adventure.forestCleared)
    .map((item) => ({ ...item, id: item.action }));
  return candidates
    .map((item) => ({ ...item, distance: Math.hypot(item.x - state.x, item.y - state.y) }))
    .filter((item) => item.distance <= item.radius)
    .sort((a, b) => a.distance - b.distance)[0] ?? null;
}

export function interactAdventure(state, save, maps) {
  const target = nearestInteraction(state, save, maps);
  if (!target) {
    state.lastMessage = 'Không có điểm tương tác nào trong tầm với.';
    return { state, save, changed: false };
  }
  const updated = structuredClone(save);
  if (target.id === 'lilia') {
    if (updated.adventure.quest === 'not_started') {
      updated.adventure.quest = 'accepted';
      state.lastMessage = 'Lilia: Hương vị trong rừng đang biến mất. Hãy mở rương tiếp tế rồi theo dấu vào rừng.';
      gameEvents.emit('quest_accepted', { quest_id: 'quest_missing_flavor' }, { map_id: 'village' });
    } else if (updated.adventure.quest === 'ready_to_claim') {
      updated.adventure.quest = 'completed';
      updated.player.gold += 80;
      updated.player.experience += 100;
      updated.player.level = 1 + Math.floor(updated.player.experience / 100);
      updated.roster = updated.roster.map((actor) => ({ ...actor, hp: actor.maxHp }));
      state.lastMessage = 'Nhiệm vụ hoàn thành. Lilia trao 80 vàng và 100 kinh nghiệm.';
      gameEvents.emit('quest_completed', { quest_id: 'quest_missing_flavor', gold: 80, experience: 100 });
    } else {
      state.lastMessage = 'Lilia: Rương ở phía đông quảng trường có thể giúp bạn chuẩn bị.';
    }
  } else if (target.id === 'chest') {
    if (updated.adventure.quest === 'not_started') {
      state.lastMessage = 'Chiếc rương cần một nhiệm vụ đang hoạt động.';
      return { state, save, changed: false };
    }
    if (!updated.adventure.chestOpened) {
      const claimId = 'village_supply_chest_p0';
      if (!updated.adventure.rewardClaims.includes(claimId)) {
        updated.adventure.rewardClaims.push(claimId);
        updated.player.gold += 30;
        updated.player.essence += 5;
      }
      updated.adventure.chestOpened = true;
      state.lastMessage = 'Rương đã mở: nhận 30 vàng và 5 tinh hoa. Cổng rừng đã sáng.';
      gameEvents.emit('chest_opened', { chest_id: claimId, gold: 30, essence: 5 }, { map_id: 'village' });
    }
  } else if (target.id === 'portal') {
    const routed = transitionMap(state, updated, 'forest', maps);
    Object.assign(updated, routed.save);
    Object.assign(state, routed.state);
    state.lastMessage = 'Rừng Nguyên Liệu: những dấu chân dẫn sâu vào tán cây.';
    gameEvents.emit('route_changed', { map: 'forest' }, { map_id: 'forest' });
  } else if (target.id === 'encounter') {
    beginBattle(state, updated);
  } else if (target.id === 'village_return') {
    const routed = transitionMap(state, updated, 'village', maps);
    Object.assign(updated, routed.save);
    Object.assign(state, routed.state);
    if (updated.adventure.forestCleared && updated.adventure.quest === 'accepted') updated.adventure.quest = 'ready_to_claim';
    state.lastMessage = 'Đã trở về làng. Hãy báo tin cho Lilia.';
    gameEvents.emit('route_changed', { map: 'village' }, { map_id: 'village' });
  }
  return { state, save: updated, changed: true };
}

export function beginBattle(state, save) {
  state.battle = {
    id: `battle_adventure_${save.completedBattles + 1}`,
    phase: 'battle_running',
    tick: 0,
    wave: 0,
    actors: [
      ...save.roster.map((actor, index) => spawnActor(actor, 'player', index)),
      ...ENEMIES.forest_wave.map((enemy, index) => spawnActor(enemy, 'enemy', index)),
    ],
    bossPhase: 1,
    bossTelegraph: null,
    events: [],
  };
  state.lastMessage = 'Các Vị Linh tự áp sát và tấn công. Hãy tung tuyệt kỹ khi đủ năng lượng.';
  gameEvents.emit('battle_started', { battle_id: state.battle.id, wave: 1 }, battleContext(state.battle));
}

function spawnActor(template, team, index) {
  const player = team === 'player';
  const formation = balance.formations[team];
  const [x, y] = template.boss ? balance.formations.boss : formation[index % formation.length];
  return {
    ...template, actor_id: template.id, team, x, y, homeX: x, homeY: y,
    alive: template.hp > 0, cooldown: player ? index * 4 : 12 + index * 8,
    energy: player ? Math.max(template.energy ?? 0, balance.openingEnergy) : 0,
    direction: player ? 'E' : 'W', moving: false, action: null, attackCount: 0,
  };
}

export function activateUltimate(state, save, actorId) {
  const battle = state.battle;
  if (!battle || battle.phase !== 'battle_running') return { ok: false, reason: 'Trận đấu chưa sẵn sàng.' };
  const actor = battle.actors.find((item) => item.actor_id === actorId && item.team === 'player');
  if (!actor?.alive) return { ok: false, reason: 'Vị Linh đã gục.' };
  if (actor.energy < 100) return { ok: false, reason: 'Chưa đủ năng lượng.' };
  if (actor.ultimateReadyTick > battle.tick || actor.action) return { ok: false, reason: 'Chờ Vị Linh kết thúc đòn hiện tại.' };
  const ability = balance.ultimates[actor.id];
  const target = selectTarget(battle, actor, ability.kind === 'execute');
  if (!target) return { ok: false, reason: 'Không còn mục tiêu.' };
  actor.energy -= 100;
  actor.ultimateReadyTick = battle.tick + balance.ultimateCooldown;
  state.lastMessage = ability.name + '!';
  startAction(battle, actor, target, ability, 'ultimate');
  return { ok: true, save };
}

export function stepAdventure(state, save, deltaSeconds, maps) {
  if (state.battle) {
    state.battle.accumulator = (state.battle.accumulator ?? 0) + Math.min(deltaSeconds, 0.25);
    const tickDuration = 1 / TICK_RATE;
    while (state.battle.accumulator >= tickDuration && state.battle.phase === 'battle_running') {
      state.battle.accumulator -= tickDuration;
      stepBattle(state, save);
    }
  } else {
    const length = Math.hypot(state.input.x, state.input.y);
    if (length > 0) {
      const movement = moveWithCollision(
        state.map,
        state.x,
        state.y,
        state.input.x * PLAYER_SPEED * deltaSeconds,
        state.input.y * PLAYER_SPEED * deltaSeconds,
        getAdventureMap(maps, state.map)?.world.player_radius,
        maps,
      );
      state.x = movement.x;
      state.y = movement.y;
      state.facing = Math.abs(state.input.x) > Math.abs(state.input.y) ? (state.input.x < 0 ? 'left' : 'right') : (state.input.y < 0 ? 'up' : 'down');
    }
  }
  state.tick += 1;
}

function stepBattle(state, save) {
  const battle = state.battle;
  battle.tick += 1;
  gameEvents.setTick(battle.tick);
  for (const actor of battle.actors) {
    if (!actor.alive) continue;
    stepActor(battle, actor);
  }
  const alivePlayers = battle.actors.some((actor) => actor.team === 'player' && actor.alive);
  const aliveEnemies = battle.actors.some((actor) => actor.team === 'enemy' && actor.alive);
  if (!alivePlayers) return finishBattle(state, save, false);
  if (!aliveEnemies) {
    if (battle.wave === 1) return finishBattle(state, save, true);
    battle.wave = 1;
    battle.actors = battle.actors.filter((actor) => actor.team === 'player');
    for (const actor of battle.actors) {
      actor.action = null;
      actor.x = actor.homeX;
      actor.y = actor.homeY;
      actor.moving = false;
      actor.cooldown = Math.max(actor.cooldown, 10);
    }
    battle.actors.push(...ENEMIES.forest_boss.map((enemy, index) => spawnActor(enemy, 'enemy', index)));
    gameEvents.emit('wave_completed', { wave: 1 }, battleContext(battle));
    gameEvents.emit('actor_spawned', { actor_id: 'boss_bep_truong', character_id: 'boss_thief', boss: true }, battleContext(battle));
    state.lastMessage = 'Bếp Trưởng Hỏa Diệm xuất hiện!';
  }
  updateBoss(battle);
}

function stepActor(battle, actor) {
  actor.moving = false;
  if (actor.shieldUntil <= battle.tick) actor.shield = 0;
  actor.cooldown = Math.max(0, actor.cooldown - 1);
  if (actor.action) {
    const action = actor.action;
    if (action.travel && battle.tick === action.launchTick) {
      const target = battle.actors.find((item) => item.actor_id === action.targetId);
      if (target?.alive) {
        gameEvents.emit('projectile_spawned', {
          element: actor.element, travel_ticks: action.travel,
          source: { x: actor.x, y: actor.y }, target: { x: target.x, y: target.y },
        }, battleContext(battle, actor.actor_id, target.actor_id));
      }
    }
    if (battle.tick >= action.hitTick) {
      actor.action = null;
      resolveAction(battle, actor, action);
    }
    return;
  }
  const target = selectTarget(battle, actor);
  if (!target || (actor.boss && battle.bossTelegraph)) return;
  const profile = actor.team === 'player' ? balance.roles[actor.role] ?? balance.roles.fighter : balance.enemyRoles[actor.id];
  const dx = target.x - actor.x;
  const dy = target.y - actor.y;
  const distance = Math.hypot(dx, dy);
  actor.direction = dx < 0 ? 'W' : 'E';
  if (distance > profile.range) {
    const speed = balance.approachSpeed * (actor.slowUntil > battle.tick ? .55 : 1);
    const step = Math.min(speed, distance - profile.range);
    actor.x += dx * step / distance;
    actor.y += dy * step / distance;
    actor.moving = true;
  } else if (actor.cooldown === 0) {
    const sourceKind = actor.team === 'player' ? 'basic' : 'enemy_attack';
    const clip = actor.attackCount++ % 2 === 0 ? 'attack_a' : 'attack_b';
    const windup = actor.id === 'chr_bunbo_holinh' && clip === 'attack_b' ? 8 : profile.windup;
    startAction(battle, actor, target, { ...profile, windup, clip }, sourceKind);
    actor.cooldown = (profile.interval ?? actor.interval) + (actor.slowUntil > battle.tick ? 14 : 0);
  }
}

function selectTarget(battle, actor, weakest = false) {
  const targets = battle.actors.filter((item) => item.alive && item.team !== actor.team);
  if (actor.team === 'enemy') {
    const guardian = targets.find((item) => item.role === 'guardian');
    if (guardian) return guardian;
  }
  const score = (item) => weakest || actor.role === 'assassin' ? item.hp / item.maxHp : Math.hypot(item.x - actor.x, item.y - actor.y);
  return targets.sort((a, b) => score(a) - score(b) || a.actor_id.localeCompare(b.actor_id))[0];
}

function startAction(battle, actor, target, profile, sourceKind) {
  actor.moving = false;
  actor.action = {
    ...profile, targetId: target.actor_id, sourceKind,
    launchTick: battle.tick + profile.windup,
    hitTick: battle.tick + profile.windup + (profile.travel ?? 0),
  };
  gameEvents.emit(sourceKind === 'ultimate' ? 'cast_started' : 'attack_started', {
    ability_id: `${actor.id}_${sourceKind}`, name: profile.name, element: actor.element,
    clip_id: profile.clip ?? 'ultimate_01', kind: profile.kind, windup_ticks: profile.windup, travel_ticks: profile.travel ?? 0,
  }, battleContext(battle, actor.actor_id, target.actor_id));
}

function resolveAction(battle, actor, action) {
  if (action.kind === 'heal' || action.kind === 'shield') {
    for (const ally of battle.actors.filter((item) => item.alive && item.team === actor.team)) {
      const amount = Math.floor(ally.maxHp * action.ratio);
      if (action.kind === 'heal') {
        const healed = Math.min(amount, ally.maxHp - ally.hp);
        ally.hp += healed;
        if (healed) gameEvents.emit('heal_resolved', { amount: healed, element: actor.element }, battleContext(battle, actor.actor_id, ally.actor_id));
      } else {
        ally.shield = Math.max(ally.shield ?? 0, amount);
        ally.shieldUntil = battle.tick + action.duration;
        gameEvents.emit('shield_applied', { amount, element: actor.element }, battleContext(battle, actor.actor_id, ally.actor_id));
      }
    }
    return;
  }
  const originalTarget = battle.actors.find((item) => item.actor_id === action.targetId && item.alive);
  const target = originalTarget ?? (action.sourceKind === 'ultimate' && !action.travel ? selectTarget(battle, actor, action.kind === 'execute') : null);
  const targets = action.kind === 'area' ? battle.actors.filter((item) => item.alive && item.team !== actor.team) : target ? [target] : [];
  for (const victim of targets) {
    const coefficient = action.kind === 'execute' && victim.hp <= victim.maxHp * .35 ? action.executeCoefficient : action.coefficient;
    applyBattleHit(battle, actor, victim, coefficient ?? 10000, action.sourceKind);
    if (action.kind === 'slow') victim.slowUntil = battle.tick + action.duration;
  }
  if (actor.team === 'player' && action.sourceKind === 'basic') actor.energy = Math.min(100, actor.energy + balance.basicEnergy);
}

function updateBoss(battle) {
  const boss = battle.actors.find((item) => item.boss && item.alive);
  if (!boss) return;
  const ratio = boss.hp / boss.maxHp;
  const phase = ratio <= .3 ? 3 : ratio <= .7 ? 2 : 1;
  if (phase > battle.bossPhase && !battle.bossTelegraph) {
    battle.bossPhase = phase;
    battle.bossTelegraph = { phase, ticks: phase === 3 ? 36 : 27, attack: phase === 3 ? 'Vòng Lửa' : 'Bếp Bùng Cháy' };
    gameEvents.emit('boss_phase_changed', { phase, attack: battle.bossTelegraph.attack }, battleContext(battle, boss.actor_id));
  }
  if (!battle.bossTelegraph || --battle.bossTelegraph.ticks > 0) return;
  const attackPhase = battle.bossTelegraph.phase;
  battle.bossTelegraph = null;
  const victims = battle.actors.filter((item) => item.team === 'player' && item.alive);
  victims.sort((a, b) => Math.hypot(a.x - boss.x, a.y - boss.y) - Math.hypot(b.x - boss.x, b.y - boss.y));
  for (const victim of victims.slice(0, attackPhase === 3 ? 3 : 2)) applyBattleHit(battle, boss, victim, attackPhase === 3 ? 25000 : 18000, 'boss_telegraph');
}

function applyBattleHit(battle, source, target, coefficientBp, sourceKind) {
  const damage = Math.max(1, Math.floor(source.atk * coefficientBp / 10000 * 100 / (100 + target.def)));
  const absorbed = Math.min(damage, target.shield ?? 0);
  target.shield = (target.shield ?? 0) - absorbed;
  const hpDamage = Math.min(target.hp, damage - absorbed);
  target.hp -= hpDamage;
  target.alive = target.hp > 0;
  if (target.team === 'player') target.energy = Math.min(100, target.energy + balance.hurtEnergy);
  const payload = {
    hit_id: `${battle.tick}:${source.actor_id}:${target.actor_id}`, damage, hp_damage: hpDamage, absorbed,
    source_kind: sourceKind, element: source.element, timed: sourceKind !== 'boss_telegraph',
  };
  const hit = gameEvents.emit('hit_resolved', payload, battleContext(battle, source.actor_id, target.actor_id));
  battle.events.push(hit);
  if (!target.alive) gameEvents.emit('actor_died', { actor_id: target.actor_id }, battleContext(battle, source.actor_id, target.actor_id));
}

function finishBattle(state, save, won) {
  const battle = state.battle;
  battle.phase = 'battle_end';
  battle.result = won ? 'victory' : 'defeat';
  if (won) {
    const updated = structuredClone(save);
    const claimId = `${battle.id}:forest_reward`;
    if (!updated.adventure.rewardClaims.includes(claimId)) {
      updated.adventure.rewardClaims.push(claimId);
      updated.player.gold += 60;
      updated.player.essence += 10;
      updated.completedBattles += 1;
    }
    updated.roster = updated.roster.map((member) => {
      const actor = battle.actors.find((item) => item.actor_id === member.id);
      return { ...member, hp: Math.max(1, actor.hp), energy: 0 };
    });
    updated.adventure.forestCleared = true;
    updated.adventure.quest = 'ready_to_claim';
    state.result = { won: true, gold: 60, essence: 10 };
    state._pendingSave = updated;
    state.lastMessage = 'Chiến thắng! Phần thưởng đã sẵn sàng nhận.';
  } else {
    state.result = { won: false, gold: 0, essence: 0 };
    state.lastMessage = 'Đội hình đã gục. Bạn có thể thử lại khi đã chuẩn bị.';
  }
  gameEvents.emit('battle_finished', { result: battle.result, winner_team: won ? 'player' : 'enemy' }, battleContext(battle));
}

export function claimBattleResult(state, save) {
  if (!state.battle || state.battle.phase !== 'battle_end') return save;
  if (state._pendingSave) save = state._pendingSave;
  state._pendingSave = null;
  state.battle = null;
  state.result = null;
  state.map = 'forest';
  state.lastMessage = 'Rừng đã yên tĩnh. Hãy trở về làng để báo tin cho Lilia.';
  return save;
}

function battleContext(battle, sourceId, targetId) {
  return { battle_id: battle.id, rules_version: 'client-p0-v1', tick: battle.tick, source_id: sourceId, target_id: targetId };
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}