import { gameEvents } from "../core/events.js";
import {
  moveWithCollision,
  collidesWithWorld,
  recoverAdventurePosition,
  findAdventurePath,
  hasClearLine,
} from "./adventureNavigation.js";
import { getAdventureMap } from "./mapCatalog.js";
import { ADVENTURE_RULES as R, RULES_VERSION } from "../core/rules.js";

export const WORLD = { width: 960, height: 540 };
const INTERACT_RADIUS = 62;
const PLAYER_SPEED = 190;
const TICK_RATE = 30;

const ENEMIES = {
  forest_wave: [
    {
      id: "mob_mushroom_01",
      name: "Nấm Lạc Vị",
      hp: 980,
      maxHp: 980,
      atk: 90,
      def: 20,
      interval: 54,
      element: "wood",
    },
    {
      id: "mob_pepper_01",
      name: "Tiêu Tinh",
      hp: 1250,
      maxHp: 1250,
      atk: 110,
      def: 25,
      interval: 48,
      element: "fire",
    },
  ],
  forest_boss: [
    {
      id: "boss_bep_truong",
      name: "Bếp Trưởng Hỏa Diệm",
      hp: 5200,
      maxHp: 5200,
      atk: 190,
      def: 85,
      interval: 75,
      element: "fire",
      boss: true,
    },
  ],
};

export function createAdventureState(save) {
  return {
    map: save.adventure.map,
    x: save.adventure.x,
    y: save.adventure.y,
    facing: "down",
    tick: 0,
    input: { x: 0, y: 0 },
    battle: save.adventure.battle,
    lastMessage: "Tìm Lilia ở quảng trường để bắt đầu.",
    result: null,
    walkPath: [],
    stuckTicks: 0,
    safePosition: save.adventure.safePosition ?? null,
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
    const transition = map.transitions.find(
      (door) => door.to === toMap || door.targetMap === toMap,
    );
    if (transition?.spawn) return transition.spawn;
  }
  return resolveMapSpawn(toMap, maps);
}

export function transitionMap(state, save, mapId, maps) {
  const nextMap = mapId ?? state.map ?? "village";
  if (!getAdventureMap(maps, nextMap))
    throw new Error("Khu vực chưa tải được. Vị trí hiện tại được giữ lại.");
  if (
    save.adventure.unlockedMaps &&
    !save.adventure.unlockedMaps.includes(nextMap)
  )
    throw new Error("Hoàn thành thử thách trước để mở khóa khu vực này.");
  const spawn = resolveMapTransition(state.map ?? "village", nextMap, maps);
  const updated = structuredClone(save);
  updated.adventure.map = nextMap;
  updated.adventure.x = spawn.x;
  updated.adventure.y = spawn.y;
  state.map = nextMap;
  state.x = spawn.x;
  state.y = spawn.y;
  state.walkPath = [];
  state.walkTarget = null;
  state.safePosition = { x: spawn.x, y: spawn.y };
  return { state, save: updated, changed: true };
}

export function resolveCameraViewport(
  playerX,
  playerY,
  viewport,
  mapWidth = WORLD.width,
  mapHeight = WORLD.height,
) {
  const width = viewport.width ?? mapWidth;
  const height = viewport.height ?? mapHeight;
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const clampedX = clamp(playerX - halfWidth, 0, Math.max(0, mapWidth - width));
  const clampedY = clamp(
    playerY - halfHeight,
    0,
    Math.max(0, mapHeight - height),
  );
  return { x: clampedX, y: clampedY };
}

export function setAdventureInput(state, x, y) {
  const length = Math.hypot(x, y) || 1;
  state.input.x = x / length;
  state.input.y = y / length;
}

export function nearestInteraction(state, save, maps) {
  if (state.battle || state.map === "forest") {
    if (state.battle) return null;
  }
  const map = getAdventureMap(maps, state.map);
  if (!map) return null;
  const candidates = map.interactables
    .filter((item) => item.action !== "chest" || !save.adventure.chestOpened)
    .filter(
      (item) => item.action !== "lilia" || save.adventure.quest !== "completed",
    )
    .filter((item) => item.action !== "portal" || save.adventure.chestOpened)
    .filter(
      (item) => item.action !== "encounter" || !save.adventure.forestCleared,
    )
    .filter(
      (item) =>
        item.action !== "village_return" || save.adventure.forestCleared,
    )
    .map((item) => ({ ...item, interactionId: item.id, id: item.action }));
  return (
    candidates
      .map((item) => ({
        ...item,
        distance: Math.hypot(item.x - state.x, item.y - state.y),
      }))
      .filter((item) => item.distance <= item.radius)
      .sort((a, b) => a.distance - b.distance)[0] ?? null
  );
}

export function interactAdventure(state, save, maps) {
  const target = nearestInteraction(state, save, maps);
  if (!target) {
    state.lastMessage = "Không có điểm tương tác nào trong tầm với.";
    return { state, save, changed: false };
  }
  const updated = structuredClone(save);
  if (target.id === "lilia") {
    if (updated.adventure.quest === "not_started") {
      updated.adventure.quest = "accepted";
      state.lastMessage =
        "Lilia: Hương vị trong rừng đang biến mất. Hãy mở rương tiếp tế rồi theo dấu vào rừng.";
      gameEvents.emit(
        "quest_accepted",
        { quest_id: "quest_missing_flavor" },
        { map_id: "village" },
      );
    } else if (updated.adventure.quest === "ready_to_claim") {
      updated.adventure.quest = "completed";
      updated.player.gold += 80;
      updated.player.experience += 100;
      state.lastMessage =
        "Nhiệm vụ hoàn thành. Lilia trao 80 vàng và 100 kinh nghiệm.";
      gameEvents.emit("quest_completed", {
        quest_id: "quest_missing_flavor",
        gold: 80,
        experience: 100,
      });
    } else {
      state.lastMessage =
        "Lilia: Rương ở phía đông quảng trường có thể giúp bạn chuẩn bị.";
    }
  } else if (target.id === "chest") {
    if (updated.adventure.quest === "not_started") {
      state.lastMessage = "Chiếc rương cần một nhiệm vụ đang hoạt động.";
      return { state, save, changed: false };
    }
    if (!updated.adventure.chestOpened) {
      const claimId = "village_supply_chest_p0";
      if (!updated.adventure.rewardClaims.includes(claimId)) {
        updated.adventure.rewardClaims.push(claimId);
        updated.player.gold += 30;
        updated.player.essence += 5;
      }
      updated.adventure.chestOpened = true;
      state.lastMessage =
        "Rương đã mở: nhận 30 vàng và 5 tinh hoa. Cổng rừng đã sáng.";
      gameEvents.emit(
        "chest_opened",
        { chest_id: claimId, gold: 30, essence: 5 },
        { map_id: "village" },
      );
    }
  } else if (target.id === "portal") {
    const routed = transitionMap(state, updated, "forest", maps);
    Object.assign(updated, routed.save);
    Object.assign(state, routed.state);
    state.lastMessage = "Rừng Nguyên Liệu: những dấu chân dẫn sâu vào tán cây.";
    gameEvents.emit("route_changed", { map: "forest" }, { map_id: "forest" });
  } else if (target.id === "encounter") {
    beginBattle(state, updated);
  } else if (target.id === "village_return") {
    const routed = transitionMap(state, updated, "village", maps);
    Object.assign(updated, routed.save);
    Object.assign(state, routed.state);
    if (
      updated.adventure.forestCleared &&
      updated.adventure.quest === "accepted"
    )
      updated.adventure.quest = "ready_to_claim";
    state.lastMessage = "Đã trở về làng. Hãy báo tin cho Lilia.";
    gameEvents.emit("route_changed", { map: "village" }, { map_id: "village" });
  } else if (target.id === "rest") {
    updated.roster.forEach((actor) => {
      actor.hp = actor.maxHp;
      actor.energy = 0;
    });
    state.lastMessage = "Lilia mời cả đội một bữa ăn nóng. Đã hồi phục đầy HP.";
  } else if (target.id === "harvest") {
    const clock = updated.adventure.worldTick ?? 0;
    const previous = updated.adventure.harvests?.[target.interactionId];
    if (previous !== undefined && clock - previous < R.harvestCooldown) {
      state.lastMessage =
        "Nguyên liệu đang hồi phục. Hãy quay lại sau ít phút khám phá.";
      return { state, save, changed: false };
    }
    updated.adventure.harvests ??= {};
    updated.adventure.harvests[target.interactionId] = clock;
    if (target.material === "essence") updated.player.essence += 2;
    else updated.adventure.materials[target.material ?? "herbs"] += 3;
    state.lastMessage =
      "Đã thu thập nguyên liệu. Dùng tại đội hình để nâng cấp Vị Linh.";
  } else if (target.id === "farm") {
    beginBattle(state, updated, { farm: true });
  } else if (target.id === "puzzle") {
    state.puzzle = { id: `${state.map}:recipe`, selected: [] };
    state.lastMessage =
      "Bia đá: Nước dùng trước, Rau thơm tiếp, Hỏa vị cuối. Chọn đúng thứ tự!";
  } else if (target.id === "craft") {
    if (updated.adventure.materials.herbs < 3) {
      state.lastMessage = "Cần 3 rau thơm để chế biến. Có thể farm trong rừng.";
      return { state, save, changed: false };
    }
    updated.adventure.materials.herbs -= 3;
    updated.player.essence += 5;
    state.lastMessage = "Đã chế biến 3 rau thơm thành 5 tinh hoa.";
  }
  return { state, save: updated, changed: true };
}

export function beginBattle(state, save, options = {}) {
  const map = state.map;
  const strength =
    { forest: 1, coast: 1.25, volcano: 1.6, mist: 2, ruins: 2.4 }[map] ?? 1;
  const scaleEnemy = (enemy) => ({
    ...enemy,
    hp: Math.floor(enemy.hp * strength),
    maxHp: Math.floor(enemy.maxHp * strength),
    atk: Math.floor(enemy.atk * strength),
  });
  const protagonist = {
    id: "hero_ketvi",
    name: "Người Kết Vị",
    hp: 2800 + (save.player.level - 1) * 250,
    maxHp: 2800 + (save.player.level - 1) * 250,
    atk: 300 + (save.player.level - 1) * 35,
    def: 100,
    role: "fighter",
    element: "light",
    energy: 0,
  };
  const party = save.party
    ? [
        ...save.roster
          .filter((actor) => save.party.includes(actor.id))
          .slice(0, 4),
        protagonist,
      ]
    : save.roster;
  state.battle = {
    id: `battle_adventure_${save.completedBattles + 1}`,
    phase: "battle_running",
    tick: 0,
    wave: 0,
    map,
    farm: Boolean(options.farm),
    waveCount: options.farm ? 3 : 2,
    strength,
    actors: [
      ...party.map((actor, index) => ({
        ...structuredClone(actor),
        actor_id: actor.id,
        team: "player",
        cooldown: index * 6,
        combatX: 140 + index * 55,
        combatY: 300 + Math.sin(index * 2) * 25,
        alive: actor.hp > 0,
      })),
      ...structuredClone(ENEMIES.forest_wave).map((enemy, index) => ({
        ...scaleEnemy(enemy),
        actor_id: enemy.id,
        team: "enemy",
        cooldown: 12 + index * 8,
        combatX: 680 + index * 60,
        combatY: 300 + index * 30,
        alive: true,
      })),
    ],
    bossPhase: 1,
    bossTelegraph: null,
    events: [],
  };
  state.lastMessage =
    "Giao chiến! Các Vị Linh tự động đánh; chọn tuyệt kỹ khi đủ năng lượng.";
  gameEvents.emit(
    "battle_started",
    { battle_id: state.battle.id, wave: 1 },
    { battle_id: state.battle.id, rules_version: "client-p0-v1", tick: 0 },
  );
}

export function activateUltimate(state, save, actorId) {
  const battle = state.battle;
  if (!battle || battle.phase !== "battle_running")
    return { ok: false, reason: "Trận đấu chưa sẵn sàng." };
  const actor = battle.actors.find(
    (item) => item.actor_id === actorId && item.team === "player",
  );
  const target = battle.actors.find(
    (item) => item.team === "enemy" && item.alive,
  );
  if (!actor || !actor.alive) return { ok: false, reason: "Vị Linh đã gục." };
  if (actor.energy < 100) return { ok: false, reason: "Chưa đủ năng lượng." };
  if (actor.ultimateReadyTick > battle.tick)
    return { ok: false, reason: "Tuyệt kỹ đang hồi." };
  if (!target) return { ok: false, reason: "Không còn mục tiêu." };
  actor.energy -= 100;
  actor.ultimateReadyTick = battle.tick + 90;
  const displayName = actor.id.replace(/^chr_/, "").replaceAll("_", " ");
  state.lastMessage = `${displayName}: tuyệt kỹ gây sát thương lên ${target.name}.`;
  gameEvents.emit(
    "cast_started",
    {
      ability_id: `${actor.id}_ultimate`,
      energy_cost: 100,
      target_id: target.id,
    },
    battleContext(battle),
  );
  if (actor.element === "wood") {
    for (const ally of battle.actors.filter(
      (unit) => unit.team === "player" && unit.alive,
    )) {
      const healing = Math.min(
        ally.maxHp - ally.hp,
        Math.floor(actor.atk * 2.4),
      );
      ally.hp += healing;
      gameEvents.emit(
        "heal_resolved",
        { healing, element: "wood" },
        battleContext(battle, actor.actor_id, ally.actor_id),
      );
    }
  } else if (actor.role === "guardian") {
    for (const ally of battle.actors.filter(
      (unit) => unit.team === "player" && unit.alive,
    ))
      ally.shield = (ally.shield ?? 0) + Math.floor(actor.maxHp * 0.15);
  } else {
    applyBattleHit(battle, actor, target, 15000, "ultimate");
    if (actor.element === "fire")
      target.burn = {
        ticks: 90,
        damage: Math.floor(actor.atk * 0.12),
        source: actor.actor_id,
      };
    if (actor.element === "water") target.cooldown += 30;
  }
  return { ok: true, save };
}

export function stepAdventure(state, save, deltaSeconds, maps) {
  if (state.battle) {
    state.battle.accumulator =
      (state.battle.accumulator ?? 0) + Math.min(deltaSeconds, 0.25);
    const tickDuration = 1 / TICK_RATE;
    while (
      state.battle.accumulator >= tickDuration &&
      state.battle.phase === "battle_running"
    ) {
      state.battle.accumulator -= tickDuration;
      stepBattle(state, save);
    }
  } else {
    if (collidesWithWorld(state.map, state.x, state.y, undefined, maps)) {
      const safe = recoverAdventurePosition(
        state.map,
        state.safePosition ?? state,
        maps,
      );
      if (safe) {
        state.x = safe.x;
        state.y = safe.y;
        state.walkPath = [];
        state.lastMessage = "Đã trở lại điểm đi được gần nhất.";
      }
    }
    if (state.walkPath?.length && !state.manualInput) {
      const point = state.walkPath[0];
      const dx = point.x - state.x;
      const dy = point.y - state.y;
      if (Math.hypot(dx, dy) <= Math.max(4, PLAYER_SPEED * deltaSeconds)) {
        state.walkPath.shift();
        if (!state.walkPath.length) {
          state.walkTarget = null;
          setAdventureInput(state, 0, 0);
        }
      } else setAdventureInput(state, dx, dy);
    }
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
      if (movement.blockedX && movement.blockedY) state.stuckTicks++;
      else state.stuckTicks = 0;
      state.safePosition = { x: state.x, y: state.y };
      if (state.walkPath?.length && state.stuckTicks > 10) {
        state.walkPath = findAdventurePath(
          state.map,
          state,
          state.walkTarget ?? state.walkPath.at(-1),
          undefined,
          maps,
        );
        state.stuckTicks = 0;
      }
      state.facing =
        Math.abs(state.input.x) > Math.abs(state.input.y)
          ? state.input.x < 0
            ? "left"
            : "right"
          : state.input.y < 0
            ? "up"
            : "down";
    }
  }
  state.tick += 1;
  state.worldClock =
    (state.worldClock ?? save.adventure.worldTick ?? 0) +
    deltaSeconds * TICK_RATE;
  save.adventure.worldTick = Math.floor(state.worldClock + 1e-8);
}

function stepBattle(state, save) {
  const battle = state.battle;
  battle.tick += 1;
  gameEvents.setTick(battle.tick);
  for (const actor of battle.actors.filter((unit) => unit.alive && unit.burn)) {
    actor.burn.ticks--;
    if (actor.burn.ticks % 30 === 0) {
      const source = battle.actors.find(
        (unit) => unit.actor_id === actor.burn.source,
      );
      if (source) applyBattleHit(battle, source, actor, 1200, "burn");
    }
    if (actor.burn.ticks <= 0) delete actor.burn;
  }
  for (const actor of battle.actors.filter((item) => item.alive)) {
    if (actor.bossObject) continue;
    actor.cooldown -= 1;
    if (actor.cooldown > 0) continue;
    const opposing = battle.actors
      .filter((item) => item.alive && item.team !== actor.team)
      .sort(
        (a, b) =>
          a.hp / a.maxHp - b.hp / b.maxHp ||
          a.actor_id.localeCompare(b.actor_id),
      );
    const target = opposing[0];
    if (!target) break;
    const effectiveRange = ["mage", "support", "ranged"].includes(actor.role)
      ? 420
      : 100;
    if (
      Number.isFinite(actor.combatX) &&
      Math.abs(actor.combatX - target.combatX) > effectiveRange
    ) {
      actor.combatX += Math.sign(target.combatX - actor.combatX) * 4;
      actor.cooldown = 0;
      continue;
    }
    gameEvents.emit(
      "attack_started",
      { element: actor.element, projectile: effectiveRange > 100 },
      battleContext(battle, actor.actor_id, target.actor_id),
    );
    if (actor.team === "player") {
      const coefficient =
        actor.role === "assassin"
          ? 11000
          : actor.role === "mage"
            ? 10500
            : 10000;
      applyBattleHit(battle, actor, target, coefficient, "basic");
      actor.energy = Math.min(100, actor.energy + 8);
      if (actor.role === "support") {
        const ally = battle.actors
          .filter((unit) => unit.team === "player" && unit.alive)
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        const healing = Math.min(
          ally.maxHp - ally.hp,
          Math.floor(actor.atk * 0.45),
        );
        ally.hp += healing;
        if (healing)
          gameEvents.emit(
            "heal_resolved",
            { healing, element: "wood" },
            battleContext(battle, actor.actor_id, ally.actor_id),
          );
      }
      if (save.settings?.autoUltimate && actor.energy >= 100)
        activateUltimate(state, save, actor.actor_id);
    } else {
      const playerTarget =
        opposing.find((item) => item.role === "guardian") ?? opposing[0];
      applyBattleHit(battle, actor, playerTarget, 10000, "enemy_attack");
    }
    actor.cooldown = actor.team === "player" ? 45 : (actor.interval ?? 60);
  }
  const alivePlayers = battle.actors.some(
    (item) => item.team === "player" && item.alive,
  );
  const aliveEnemies = battle.actors.some(
    (item) => item.team === "enemy" && item.alive,
  );
  if (!alivePlayers) finishBattle(state, save, false);
  else if (!aliveEnemies && battle.wave + 1 < battle.waveCount) {
    battle.wave++;
    battle.nextBossTell = battle.tick + 180;
    battle.actors = battle.actors.filter((actor) => actor.team === "player");
    const final = battle.wave + 1 === battle.waveCount;
    battle.actors.push(
      ...structuredClone(final ? ENEMIES.forest_boss : ENEMIES.forest_wave).map(
        (enemy) => ({
          ...enemy,
          hp: Math.floor(enemy.hp * battle.strength),
          maxHp: Math.floor(enemy.maxHp * battle.strength),
          atk: Math.floor(enemy.atk * battle.strength),
          actor_id: enemy.id,
          team: "enemy",
          cooldown: 45,
          combatX: 680,
          combatY: 285,
          alive: true,
        }),
      ),
    );
    gameEvents.emit(
      "wave_completed",
      { wave: battle.wave },
      battleContext(battle),
    );
    if (final)
      gameEvents.emit(
        "actor_spawned",
        { actor_id: "boss_bep_truong", boss: true },
        battleContext(battle),
      );
    state.lastMessage = final
      ? "Bếp Trưởng Hỏa Diệm · Lv.50 xuất hiện!"
      : `Đợt ${battle.wave + 1}/${battle.waveCount}: tinh anh xuất hiện!`;
  } else if (!aliveEnemies) finishBattle(state, save, true);

  const boss = battle.actors.find((item) => item.boss && item.alive);
  if (boss) {
    const ratio = boss.hp / boss.maxHp;
    const phase = ratio <= 0.3 ? 3 : ratio <= 0.7 ? 2 : 1;
    while (phase > battle.bossPhase) {
      battle.bossPhase++;
      const current = battle.bossPhase;
      battle.bossTelegraph = {
        ticks: current === 3 ? 36 : 180,
        attack: current === 3 ? "fire_arc" : "stove_surge",
      };
      if (current === 2)
        for (let index = 0; index < 2; index++)
          battle.actors.push({
            id: `boss_stove_${index}`,
            actor_id: `boss_stove_${index}`,
            name: "Lò lửa · phá để ngắt chiêu",
            team: "enemy",
            hp: 500,
            maxHp: 500,
            atk: 0,
            def: 20,
            alive: true,
            bossObject: true,
            element: "fire",
            combatX: 720 + index * 50,
            combatY: 320 + index * 35,
          });
      gameEvents.emit(
        "boss_phase_changed",
        { phase: current },
        battleContext(battle),
      );
    }
    if (
      battle.bossTelegraph?.attack === "stove_surge" &&
      !battle.actors.some((actor) => actor.bossObject && actor.alive)
    ) {
      battle.bossTelegraph = null;
      battle.nextBossTell = battle.tick + 180;
      state.lastMessage = "Đã phá hai lò lửa và ngắt tuyệt kỹ của boss!";
    }
    if (
      !battle.bossTelegraph &&
      battle.tick >= (battle.nextBossTell ?? Infinity)
    ) {
      battle.bossTelegraph = {
        ticks: phase === 3 ? 36 : 24,
        attack: phase === 3 ? "fire_arc" : "pan_slash",
      };
      battle.nextBossTell = battle.tick + 180;
    }
    if (battle.bossTelegraph) {
      battle.bossTelegraph.ticks -= 1;
      if (battle.bossTelegraph.ticks <= 0) {
        const victims = battle.actors
          .filter((item) => item.team === "player" && item.alive)
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
        for (const victim of victims)
          applyBattleHit(
            battle,
            boss,
            victim,
            phase === 3 ? 14000 : 11000,
            "boss_telegraph",
          );
        battle.bossTelegraph = null;
      }
    }
  }
}

function applyBattleHit(battle, source, target, coefficientBp, sourceKind) {
  if (!source?.alive || !target?.alive) return;
  const damage = Math.max(
    1,
    Math.floor(
      (Math.max(1, Math.floor((source.atk * coefficientBp) / 10000)) * 100) /
        (100 + target.def),
    ),
  );
  const absorbed = Math.min(target.shield ?? 0, damage);
  target.shield = Math.max(0, (target.shield ?? 0) - absorbed);
  target.hp = Math.max(0, target.hp - damage + absorbed);
  target.alive = target.hp > 0;
  if (target.team === "player" && source.team === "enemy")
    target.energy = Math.min(100, target.energy + 3);
  gameEvents.emit(
    "hit_resolved",
    {
      hit_id: `${battle.tick}:${source.actor_id}:${target.actor_id}`,
      damage,
      hp_damage: damage,
      source_kind: sourceKind,
      element: source.element,
    },
    battleContext(battle, source.actor_id, target.actor_id),
  );
  if (!target.alive)
    gameEvents.emit(
      "actor_died",
      { actor_id: target.actor_id },
      battleContext(battle, source.actor_id, target.actor_id),
    );
}

function finishBattle(state, save, won) {
  const battle = state.battle;
  battle.phase = "battle_end";
  battle.result = won ? "victory" : "defeat";
  if (won) {
    const updated = structuredClone(save);
    const claimId = `${battle.id}:forest_reward`;
    if (!updated.adventure.rewardClaims.includes(claimId)) {
      updated.adventure.rewardClaims.push(claimId);
      updated.player.gold += 60;
      updated.player.essence += 10;
      updated.completedBattles += 1;
    }
    updated.roster = updated.roster.map((actor) => {
      const result = battle.actors.find((item) => item.actor_id === actor.id);
      return result
        ? { ...actor, hp: result.alive ? result.hp : 1, energy: 0 }
        : actor;
    });
    if (!battle.farm) {
      updated.adventure.forestCleared = true;
      updated.adventure.quest = "ready_to_claim";
    }
    updated.adventure.encountersWon ??= {};
    updated.adventure.encountersWon[battle.map] =
      (updated.adventure.encountersWon[battle.map] ?? 0) + 1;
    const next = {
      forest: "coast",
      coast: "volcano",
      volcano: "mist",
      mist: "ruins",
    }[battle.map];
    updated.adventure.unlockedMaps ??= ["village", "forest"];
    if (next && !updated.adventure.unlockedMaps.includes(next))
      updated.adventure.unlockedMaps.push(next);
    if (battle.farm) {
      const material = {
        forest: "herbs",
        coast: "pearl",
        volcano: "ember",
        mist: "mist",
      }[battle.map];
      if (material) updated.adventure.materials[material] += 4;
    }
    updated.player.experience += 40;
    updated.player.level = Math.max(
      updated.player.level,
      1 + Math.floor(updated.player.experience / 150),
    );
    state.result = { won: true, gold: 60, essence: 10 };
    state._pendingSave = updated;
    state.lastMessage = "Chiến thắng! Phần thưởng đã sẵn sàng nhận.";
  } else {
    state.result = { won: false, gold: 0, essence: 0 };
    state.lastMessage = "Đội hình đã gục. Bạn có thể thử lại khi đã chuẩn bị.";
  }
  gameEvents.emit(
    "battle_finished",
    { result: battle.result, winner_team: won ? "player" : "enemy" },
    battleContext(battle),
  );
}

export function claimBattleResult(state, save) {
  if (!state.battle || state.battle.phase !== "battle_end") return save;
  if (state._pendingSave) save = state._pendingSave;
  state._pendingSave = null;
  state.battle = null;
  state.result = null;
  state.map = state.battle?.map ?? state.map;
  state.lastMessage = "Rừng đã yên tĩnh. Hãy trở về làng để báo tin cho Lilia.";
  return save;
}

export function solveAdventurePuzzle(state, save, sequence) {
  if (!state.puzzle || state.battle)
    throw new Error("Chưa ở cạnh bia đá công thức.");
  if (sequence.join(",") !== "water,wood,fire") {
    state.lastMessage = "Hương vị chưa hòa quyện. Hãy đọc lại gợi ý!";
    return save;
  }
  const updated = structuredClone(save);
  updated.adventure.puzzles ??= {};
  if (!updated.adventure.puzzles[state.puzzle.id]) {
    updated.adventure.puzzles[state.puzzle.id] = true;
    updated.player.gold += 25;
    updated.player.essence += 4;
  }
  state.puzzle = null;
  state.lastMessage = "Công thức hoàn chỉnh! Mỗi bia đá trao thưởng một lần.";
  return updated;
}

export function upgradeAdventureCharacter(save, actorId) {
  const actor = save.roster.find((unit) => unit.id === actorId);
  if (!actor) throw new Error("Không tìm thấy Vị Linh.");
  if ((actor.level ?? 1) >= R.maxLevel) throw new Error("Đã đạt cấp tối đa.");
  if (
    save.player.gold < R.levelGold ||
    save.player.essence < R.levelEssence ||
    save.adventure.materials.herbs < R.levelHerbs
  )
    throw new Error("Cần 45 vàng, 8 tinh hoa và 3 rau thơm.");
  const updated = structuredClone(save);
  const unit = updated.roster.find((item) => item.id === actorId);
  updated.player.gold -= R.levelGold;
  updated.player.essence -= R.levelEssence;
  updated.adventure.materials.herbs -= R.levelHerbs;
  unit.level = (unit.level ?? 1) + 1;
  unit.maxHp += 180;
  unit.hp = unit.maxHp;
  unit.atk += 22;
  unit.def += 8;
  return updated;
}

function battleContext(battle, sourceId, targetId) {
  return {
    battle_id: battle.id,
    rules_version: "client-p0-v1",
    tick: battle.tick,
    source_id: sourceId,
    target_id: targetId,
  };
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

// PROPOSED village recipes make every farm material useful to progression.
export function refineAdventureMaterial(save, material) {
  const recipes = {
    herbs: { cost: 3, essence: 5 },
    pearl: { cost: 2, essence: 8 },
    ember: { cost: 2, essence: 10 },
    mist: { cost: 2, essence: 12 },
  };
  const recipe = recipes[material];
  if (!recipe || save.adventure.map !== "village" || save.adventure.battle)
    throw new Error("Chế biến nguyên liệu tại làng, ngoài trận chiến.");
  if (save.adventure.materials[material] < recipe.cost)
    throw new Error(`Cần ${recipe.cost} nguyên liệu để chế biến.`);
  const updated = structuredClone(save);
  updated.adventure.materials[material] -= recipe.cost;
  updated.player.essence += recipe.essence;
  updated.adventure.recipes[material] =
    (updated.adventure.recipes[material] ?? 0) + 1;
  return updated;
}
