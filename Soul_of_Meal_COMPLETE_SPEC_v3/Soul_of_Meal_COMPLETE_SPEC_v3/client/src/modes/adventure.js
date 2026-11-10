import { gameEvents } from '../core/events.js';
import { moveWithCollision } from './adventureNavigation.js';
import { getAdventureMap } from './mapCatalog.js';

export const WORLD = { width: 960, height: 540 };
const INTERACT_RADIUS = 62;
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
    lastMessage: 'Tìm Lilia ở quảng trường để bắt đầu.',
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
  if (state.battle || state.map === 'forest') {
    if (state.battle) return null;
  }
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
      ...save.roster.map((actor, index) => ({ ...structuredClone(actor), actor_id: actor.id, team: 'player', cooldown: index * 6, alive: actor.hp > 0 })),
      ...structuredClone(ENEMIES.forest_wave).map((enemy, index) => ({ ...enemy, actor_id: enemy.id, team: 'enemy', cooldown: 12 + index * 8, alive: true })),
    ],
    bossPhase: 1,
    bossTelegraph: null,
    events: [],
  };
  state.lastMessage = 'Giao chiến! Các Vị Linh tự động đánh; chọn tuyệt kỹ khi đủ năng lượng.';
  gameEvents.emit('battle_started', { battle_id: state.battle.id, wave: 1 }, { battle_id: state.battle.id, rules_version: 'client-p0-v1', tick: 0 });
}

export function activateUltimate(state, save, actorId) {
  const battle = state.battle;
  if (!battle || battle.phase !== 'battle_running') return { ok: false, reason: 'Trận đấu chưa sẵn sàng.' };
  const actor = battle.actors.find((item) => item.actor_id === actorId && item.team === 'player');
  const target = battle.actors.find((item) => item.team === 'enemy' && item.alive);
  if (!actor || !actor.alive) return { ok: false, reason: 'Vị Linh đã gục.' };
  if (actor.energy < 100) return { ok: false, reason: 'Chưa đủ năng lượng.' };
  if (actor.ultimateReadyTick > battle.tick) return { ok: false, reason: 'Tuyệt kỹ đang hồi.' };
  if (!target) return { ok: false, reason: 'Không còn mục tiêu.' };
  actor.energy -= 100;
  actor.ultimateReadyTick = battle.tick + 90;
  const displayName = actor.id.replace(/^chr_/, '').replaceAll('_', ' ');
  state.lastMessage = `${displayName}: tuyệt kỹ gây sát thương lên ${target.name}.`;
  gameEvents.emit('cast_started', { ability_id: `${actor.id}_ultimate`, energy_cost: 100, target_id: target.id }, battleContext(battle));
  applyBattleHit(battle, actor, target, 15000, 'ultimate');
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
  for (const actor of battle.actors.filter((item) => item.alive)) {
    actor.cooldown -= 1;
    if (actor.cooldown > 0) continue;
    const opposing = battle.actors.filter((item) => item.alive && item.team !== actor.team).sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp) || a.actor_id.localeCompare(b.actor_id));
    const target = opposing[0];
    if (!target) break;
    if (actor.team === 'player') {
      const coefficient = actor.role === 'assassin' ? 11000 : actor.role === 'mage' ? 10500 : 10000;
      applyBattleHit(battle, actor, target, coefficient, 'basic');
      actor.energy = Math.min(100, actor.energy + 8);
    } else {
      const playerTarget = opposing.find((item) => item.role === 'guardian') ?? opposing[0];
      applyBattleHit(battle, actor, playerTarget, 10000, 'enemy_attack');
    }
    actor.cooldown = actor.team === 'player' ? 45 : (actor.interval ?? 60);
  }
  const alivePlayers = battle.actors.some((item) => item.team === 'player' && item.alive);
  const aliveEnemies = battle.actors.some((item) => item.team === 'enemy' && item.alive);
  if (!alivePlayers) finishBattle(state, save, false);
  else if (!aliveEnemies && battle.wave === 0) {
    battle.wave = 1;
    battle.actors.push(...structuredClone(ENEMIES.forest_boss).map((enemy) => ({ ...enemy, actor_id: enemy.id, team: 'enemy', cooldown: 45, alive: true })));
    gameEvents.emit('wave_completed', { wave: 1 }, battleContext(battle));
    gameEvents.emit('actor_spawned', { actor_id: 'boss_bep_truong', boss: true }, battleContext(battle));
    state.lastMessage = 'Đợt 1 hoàn tất. Bếp Trưởng Hỏa Diệm xuất hiện!';
  } else if (!aliveEnemies) finishBattle(state, save, true);

  const boss = battle.actors.find((item) => item.boss && item.alive);
  if (boss) {
    const ratio = boss.hp / boss.maxHp;
    const phase = ratio <= 0.3 ? 3 : ratio <= 0.7 ? 2 : 1;
    if (phase > battle.bossPhase) {
      battle.bossPhase = phase;
      battle.bossTelegraph = { ticks: phase === 3 ? 36 : 24, attack: phase === 3 ? 'fire_arc' : 'stove_surge' };
      gameEvents.emit('boss_phase_changed', { phase }, battleContext(battle));
    }
    if (battle.bossTelegraph) {
      battle.bossTelegraph.ticks -= 1;
      if (battle.bossTelegraph.ticks <= 0) {
        const victims = battle.actors.filter((item) => item.team === 'player' && item.alive).sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
        if (victims[0]) applyBattleHit(battle, boss, victims[0], phase === 3 ? 18000 : 14000, 'boss_telegraph');
        battle.bossTelegraph = null;
      }
    }
  }
}

function applyBattleHit(battle, source, target, coefficientBp, sourceKind) {
  if (!source?.alive || !target?.alive) return;
  const damage = Math.max(1, Math.floor(Math.max(1, Math.floor(source.atk * coefficientBp / 10000)) * 100 / (100 + target.def)));
  target.hp = Math.max(0, target.hp - damage);
  target.alive = target.hp > 0;
  if (target.team === 'player' && source.team === 'enemy') target.energy = Math.min(100, target.energy + 3);
  gameEvents.emit('hit_resolved', { hit_id: `${battle.tick}:${source.actor_id}:${target.actor_id}`, damage, hp_damage: damage, source_kind: sourceKind, element: source.element }, battleContext(battle, source.actor_id, target.actor_id));
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
    updated.roster = battle.actors.filter((item) => item.team === 'player').map((item) => ({ ...item, hp: item.alive ? item.hp : 1, energy: 0 }));
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