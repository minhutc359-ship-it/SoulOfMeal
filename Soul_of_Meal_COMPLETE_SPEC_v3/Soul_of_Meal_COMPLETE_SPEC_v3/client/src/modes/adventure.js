import { gameEvents } from '../core/events.js';
import { moveWithCollision } from './adventureNavigation.js';
import { getAdventureMap } from './mapCatalog.js';
import { adventureBalance as balance, adventureEncounters, ADVENTURE_TICK_RATE } from './adventureBalance.js';
import { FOREST_CLUES, FOREST_CLUE_IDS, FOREST_LANTERNS, HARBOR_CLUES, HARBOR_CLUE_IDS } from './adventureStory.js';
import { FINALE_CHAPTERS, FINALE_ROUTES, finaleChapterComplete } from './adventureFinale.js';
import { adventureSpiritStats, spiritProfile } from './spiritProgress.js';

export const WORLD = { width: 960, height: 540 };
const RANGE_EPSILON = 1e-6;
const PLAYER_SPEED = 190;

const VILLAGE_QUEST_REWARD = { gold: 80, experience: 100 };
const FOREST_QUEST_REWARD = { gold: 110, experience: 100 };
const HARBOR_QUEST_REWARD = { gold: 140, experience: 100 };
const ENCOUNTER_ACTIONS = { encounter: 'forest', seal_encounter: 'seal', tide_encounter: 'tide' };

const CHECKPOINT_VERSION = 1;

export function adventureCheckpoint(battle) {
  if (!battle) return null;
  const { events, accumulator, ...snapshot } = battle;
  return structuredClone({ ...snapshot, checkpointVersion: CHECKPOINT_VERSION });
}

function restoreBattle(save) {
  const { battle } = save.adventure;
  if (battle?.checkpointVersion !== CHECKPOINT_VERSION || !Object.hasOwn(adventureEncounters, battle.encounter)) return null;
  const encounter = adventureEncounters[battle.encounter];
  const allowedMap = encounter.scene ?? 'forest';
  if (save.adventure.map !== allowedMap || !Number.isInteger(battle.tick) || battle.tick < 0
      || !Number.isInteger(battle.wave) || !encounter.waves[battle.wave] || typeof battle.id !== 'string'
      || !['battle_running', 'battle_end'].includes(battle.phase)
      || !Array.isArray(battle.actors) || !Array.isArray(battle.stoves)
      || !save.roster.every(member => battle.actors.some(actor => actor?.actor_id === member.id && actor.team === 'player'))) return null;
  if (battle.phase === 'battle_end' && !['victory', 'defeat'].includes(battle.result)) return null;
  const tell = battle.bossTelegraph;
  if (tell && (!encounter.phases[tell.phase] || !Number.isFinite(tell.ticks))) return null;
  return { ...structuredClone(battle), events: [], paused: battle.phase === 'battle_running' };
}

export function createAdventureState(save) {
  const battle = restoreBattle(save);
  return {
    map: save.adventure.map,
    x: save.adventure.x,
    y: save.adventure.y,
    facing: 'down',
    tick: 0,
    input: { x: 0, y: 0 },
    battle,
    lastMessage: battle ? (battle.phase === 'battle_running' ? 'Trận đã được khôi phục. Chọn Tiếp tục để chơi.' : 'Kết quả trận đã được khôi phục.') :
      save.adventure.map === 'harbor' ? 'Hải Vực Hương Biển. Mở nhật ký để xem bước tiếp theo.' :
      save.adventure.quest === 'completed' ? 'Mở nhật ký để tiếp tục hành trình.' :
      save.adventure.forestCleared ? 'Trở về làng để báo tin cho Lilia.' :
        save.adventure.map === 'forest' ? 'Theo dấu Bếp Trưởng Hỏa Diệm trong rừng.' :
          save.adventure.quest === 'accepted' ? 'Mở nhật ký để tiếp tục điều tra Thất Vị.' : 'Tìm Lilia ở quảng trường để bắt đầu.',
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
  return availableAdventureInteractions(state.map, save, maps)
    .map((item) => ({ ...item, id: item.action, distance: Math.hypot(item.x - state.x, item.y - state.y) }))
    .filter((item) => item.distance <= item.radius)
    .sort((a, b) => a.distance - b.distance)[0] ?? null;
}

export function availableAdventureInteractions(mapId, save, maps) {
  const { quest, chestOpened, forestCleared, forestClues, chapterTwo, chapterThree } = save.adventure;
  const items = getAdventureMap(maps, mapId)?.interactables ?? [];
  const investigating = quest === 'completed' && chapterTwo.stage === 'accepted';
  const chapter = FINALE_CHAPTERS.find(item => item.map === mapId);
  return items.filter(({ action, kind }) => {
    if (Object.hasOwn(FINALE_ROUTES, action)) {
      const { map, after } = FINALE_ROUTES[action];
      return (!after || finaleChapterComplete(save.adventure, after)) && Boolean(getAdventureMap(maps, map));
    }
    if (['finale_guide', 'finale_objective', 'finale_encounter'].includes(kind)) {
      if (!chapter || !finaleChapterComplete(save.adventure, chapter.number - 1)) return false;
      const progress = save.adventure.finale[chapter.number];
      if (kind === 'finale_guide') return chapter.guide === action && (chapter.number === 6 || progress.stage !== 'completed');
      if (progress.stage !== 'accepted') return false;
      if (kind === 'finale_encounter') {
        return chapter.encounter === action && Object.keys(chapter.objectives).every(id => progress.objectives.includes(id));
      }
      return Object.hasOwn(chapter.objectives, action) && !progress.objectives.includes(action);
    }
    if (kind === 'clue') return Object.hasOwn(FOREST_CLUES, action) && quest === 'accepted' && !forestCleared && !forestClues.includes(action);
    if (kind === 'lantern') return investigating && FOREST_LANTERNS.indexOf(action) >= chapterTwo.lanterns;
    if (kind === 'harbor_clue') return chapterThree.stage === 'accepted' && Object.hasOwn(HARBOR_CLUES, action) && !chapterThree.clues.includes(action);
    switch (action) {
      case 'chest': return !chestOpened;
      case 'lilia': return chapterTwo.stage !== 'completed';
      case 'portal': return chestOpened;
      case 'encounter': return quest === 'accepted' && !forestCleared && FOREST_CLUE_IDS.every(id => forestClues.includes(id));
      case 'seal_encounter': return investigating && chapterTwo.lanterns === FOREST_LANTERNS.length;
      case 'harbor_route': return chapterTwo.stage === 'completed' && Boolean(getAdventureMap(maps, 'harbor'));
      case 'harbor_guide': return chapterTwo.stage === 'completed' && chapterThree.stage !== 'completed';
      case 'tide_encounter': return chapterThree.stage === 'accepted' && HARBOR_CLUE_IDS.every(id => chapterThree.clues.includes(id));
      default: return true;
    }
  });
}

export function interactAdventure(state, save, maps) {
  const target = nearestInteraction(state, save, maps);
  if (!target) {
    state.lastMessage = 'Không có điểm tương tác nào trong tầm với.';
    return { state, save, changed: false };
  }
  const updated = structuredClone(save);
  const chapterTwo = updated.adventure.chapterTwo;
  const chapterThree = updated.adventure.chapterThree;
  let dialogue;
  if (target.id === 'lilia') {
    if (updated.adventure.quest === 'not_started') {
      updated.adventure.quest = 'accepted';
      state.lastMessage = 'Đã nhận nhiệm vụ. Mở rương tiếp tế ở phía đông quảng trường.';
      dialogue = 'opening';
      gameEvents.emit('quest_accepted', { quest_id: 'quest_missing_flavor' }, { map_id: 'village' });
    } else if (updated.adventure.quest === 'ready_to_claim') {
      updated.adventure.quest = 'completed';
      grantAdventureQuestReward(updated, VILLAGE_QUEST_REWARD);
      state.lastMessage = 'Đã hoàn thành Hương Vị Đầu Tiên. Nhận 80 vàng và 100 kinh nghiệm.';
      dialogue = 'ending';
      gameEvents.emit('quest_completed', { quest_id: 'quest_missing_flavor', ...VILLAGE_QUEST_REWARD });
    } else if (updated.adventure.quest === 'completed') {
      if (chapterTwo.stage === 'not_started') {
        chapterTwo.stage = 'accepted';
        dialogue = 'forestOpening';
        state.lastMessage = 'Vào rừng và thắp đèn Mộc trước, rồi đến đèn Quang.';
        gameEvents.emit('quest_accepted', { quest_id: 'quest_empty_bowl' }, { map_id: 'village' });
      } else if (chapterTwo.stage === 'ready_to_claim') {
        chapterTwo.stage = 'completed';
        grantAdventureQuestReward(updated, FOREST_QUEST_REWARD);
        dialogue = 'forestEnding';
        state.lastMessage = 'Đã hoàn thành Bí Mật Rừng Nguyên Liệu. Manh mối dẫn tới Hải Vực Hương Biển.';
        gameEvents.emit('quest_completed', { quest_id: 'quest_empty_bowl', ...FOREST_QUEST_REWARD });
      } else {
        state.lastMessage = 'Lilia: Thắp đèn Mộc trước, rồi đến đèn Quang.';
        return { state, save, changed: false, dialogue: 'forestOpening' };
      }
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
    state.lastMessage = 'Rừng Nguyên Liệu. Mở nhật ký để xem mục tiêu hoặc dùng Dẫn đường.';
    gameEvents.emit('route_changed', { map: 'forest' }, { map_id: 'forest' });
  } else if (target.kind === 'clue') {
    updated.adventure.forestClues.push(target.id);
    const allCluesFound = FOREST_CLUE_IDS.every(id => updated.adventure.forestClues.includes(id));
    state.lastMessage = allCluesFound
      ? 'Đã tìm đủ manh mối. Lần theo vệt tro tới sân bếp.'
      : 'Đã ghi vào nhật ký: ' + FOREST_CLUES[target.id].title + '.';
    gameEvents.emit('clue_discovered', { clue_id: target.id }, { map_id: 'forest' });
  } else if (target.kind === 'lantern') {
    if (target.id !== FOREST_LANTERNS[chapterTwo.lanterns]) {
      state.lastMessage = 'Đèn Quang chưa bắt lửa. Hãy thắp đèn Mộc trước.';
      return { state, save, changed: false };
    }
    chapterTwo.lanterns += 1;
    state.lastMessage = chapterTwo.lanterns === FOREST_LANTERNS.length
      ? 'Cả hai đèn đã sáng. Lối vào đàn đá mở và Đèn Giữ Vị sẵn sàng.'
      : 'Đèn Mộc đã sáng. Hãy thắp đèn Quang.';
    gameEvents.emit('clue_discovered', { clue_id: target.id }, { map_id: 'forest' });
  } else if (target.id === 'harbor_route' || target.id === 'harbor_return') {
    const map = target.id === 'harbor_route' ? 'harbor' : 'village';
    const result = transitionMap(state, save, map, maps);
    state.lastMessage = map === 'harbor' ? 'Đã tới Hải Vực Hương Biển. Mở nhật ký hoặc tìm Phở Lam Vũ ở bến.'
      : 'Đã về Làng Ẩm Thực. Bến thuyền vẫn mở khi bạn muốn trở lại cảng.';
    gameEvents.emit('route_changed', { map }, { map_id: map });
    return result;
  } else if (target.id === 'harbor_guide') {
    if (chapterThree.stage === 'not_started') {
      chapterThree.stage = 'accepted';
      dialogue = 'harborOpening';
      state.lastMessage = 'Kiểm tra tấm lưới và vạch triều trên bến.';
      gameEvents.emit('quest_accepted', { quest_id: 'quest_tidal_conch' }, { map_id: 'harbor' });
    } else if (chapterThree.stage === 'ready_to_claim') {
      chapterThree.stage = 'completed';
      grantAdventureQuestReward(updated, HARBOR_QUEST_REWARD);
      dialogue = 'harborEnding';
      state.lastMessage = 'Đã hoàn thành Hải Vực Hương Biển. Nhận 140 vàng và 100 kinh nghiệm.';
      gameEvents.emit('quest_completed', { quest_id: 'quest_tidal_conch', ...HARBOR_QUEST_REWARD });
    } else {
      return { state, save, changed: false, dialogue: 'harborOpening' };
    }
  } else if (target.kind === 'harbor_clue') {
    chapterThree.clues.push(target.id);
    state.lastMessage = chapterThree.clues.length === HARBOR_CLUE_IDS.length
      ? 'Đã rõ nguồn cơn thủy triều. Hãy tới Tù Và Hải Triều ở cuối bến.'
      : HARBOR_CLUES[target.id].note;
    gameEvents.emit('clue_discovered', { clue_id: target.id }, { map_id: 'harbor' });
  } else if (Object.hasOwn(ENCOUNTER_ACTIONS, target.id)) {
    beginBattle(state, updated, ENCOUNTER_ACTIONS[target.id]);
  } else if (Object.hasOwn(FINALE_ROUTES, target.id)) {
    const { map } = FINALE_ROUTES[target.id];
    const result = transitionMap(state, save, map, maps);
    state.lastMessage = getAdventureMap(maps, map).display_name + '. Mở nhật ký để xem mục tiêu.';
    gameEvents.emit('route_changed', { map }, { map_id: map });
    return result;
  } else if (['finale_guide', 'finale_objective', 'finale_encounter'].includes(target.kind)) {
    return interactFinale(state, save, updated, target);
  } else if (target.id === 'village_return') {
    const routed = transitionMap(state, updated, 'village', maps);
    Object.assign(updated, routed.save);
    Object.assign(state, routed.state);
    if (updated.adventure.forestCleared && updated.adventure.quest === 'accepted') updated.adventure.quest = 'ready_to_claim';
    state.lastMessage = updated.adventure.quest === 'ready_to_claim' || chapterTwo.stage === 'ready_to_claim' ? 'Đã trở về làng. Hãy báo tin cho Lilia.'
      : 'Đã trở về làng. Có thể quay lại rừng khi đã sẵn sàng.';
    gameEvents.emit('route_changed', { map: 'village' }, { map_id: 'village' });
  }
  return { state, save: updated, changed: true, dialogue };
}

function interactFinale(state, save, updated, target) {
  const chapter = FINALE_CHAPTERS.find(item => item.map === state.map);
  const progress = updated.adventure.finale[chapter.number];
  const context = { map_id: state.map };
  if (target.kind === 'finale_encounter') {
    beginBattle(state, updated, chapter.boss);
    return { state, save: updated, changed: true };
  }
  if (target.kind === 'finale_objective') {
    progress.objectives.push(target.id);
    state.lastMessage = chapter.objectives[target.id].note;
    gameEvents.emit('clue_discovered', { clue_id: target.id }, context);
    return { state, save: updated, changed: true };
  }
  if (progress.stage === 'not_started') {
    progress.stage = 'accepted';
    state.lastMessage = chapter.steps[1] + '.';
    gameEvents.emit('quest_accepted', { quest_id: chapter.quest }, context);
    return { state, save: updated, changed: true, dialogue: chapter.opening };
  }
  if (progress.stage === 'completed') return { state, save, changed: false, dialogue: chapter.ending };
  const finishedPreparation = !chapter.encounter && Object.keys(chapter.objectives).every(id => progress.objectives.includes(id));
  if (progress.stage === 'ready_to_claim' || finishedPreparation) {
    progress.stage = 'completed';
    grantAdventureQuestReward(updated, chapter.reward);
    state.lastMessage = chapter.number === 6 ? 'Đã hoàn thành Hành Trình Vị Linh.' : 'Đã hoàn thành ' + chapter.title + '.';
    gameEvents.emit('quest_completed', { quest_id: chapter.quest, ...chapter.reward }, context);
    return { state, save: updated, changed: true, dialogue: chapter.ending };
  }
  state.lastMessage = chapter.steps[1] + '.';
  return { state, save, changed: false, dialogue: chapter.opening };
}

function grantAdventureQuestReward(save, { gold, experience }) {
  save.player.gold += gold;
  save.player.experience += experience;
  save.player.level = 1 + Math.floor(save.player.experience / 100);
  save.roster = save.roster.map(actor => ({ ...actor, hp: actor.maxHp }));
}

export function beginBattle(state, save, encounter = 'forest') {
  state.battle = {
    id: `battle_adventure_${save.completedBattles + 1}`,
    phase: 'battle_running',
    encounter,
    tick: 0,
    wave: 0,
    actors: [
      ...save.roster.map((actor, index) => spawnActor(adventureSpiritStats(actor, spiritProfile(save, actor.id)), 'player', index)),
      ...adventureEncounters[encounter].waves[0].map((enemy, index) => spawnActor(enemy, 'enemy', index)),
    ],
    bossPhase: 1,
    bossTelegraph: null,
    wardUsed: false,
    stoves: [],
    stoveTargetId: null,
    paused: false,
    speed: 1,
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
  if (battle.paused) return { ok: false, reason: 'Trận đấu đang tạm dừng.' };
  if (battle.bossTelegraph?.retreating) return { ok: false, reason: 'Đội hình đang lùi về vùng khô.' };
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

export function focusBossStove(battle, stoveId) {
  if (battle?.phase !== 'battle_running' || !battle.stoves.some(stove => stove.actor_id === stoveId && stove.alive)) return false;
  battle.stoveTargetId = stoveId;
  return true;
}

export function activateLanternWard(state) {
  const battle = state.battle;
  if (battle?.phase !== 'battle_running' || battle.paused || battle.wardUsed || battle.bossTelegraph?.counter !== 'lantern') return false;
  const boss = battle.actors.find(actor => actor.boss && actor.alive);
  if (!boss) return false;
  battle.wardUsed = true;
  battle.bossTelegraph.warded = true;
  state.lastMessage = 'Đèn Giữ Vị đã sáng. Đội được giảm sát thương từ đợt sương này.';
  gameEvents.emit('lantern_ward_activated', { element: 'light' }, battleContext(battle, boss.actor_id));
  return true;
}

export function retreatFromTide(state) {
  const battle = state.battle;
  const wave = battle?.bossTelegraph;
  if (battle?.phase !== 'battle_running' || battle.paused || wave?.counter !== 'retreat' || wave.retreating) return false;
  wave.retreating = true;
  state.lastMessage = 'Đội đang lùi về bậc đá khô. Vị Linh sẽ tự quay lại sau khi sóng qua.';
  gameEvents.emit('tide_retreat', { element: 'water' }, battleContext(battle));
  return true;
}

export function activateBossCounter(state, input) {
  const battle = state.battle;
  const telegraph = battle?.bossTelegraph;
  if (battle?.phase !== 'battle_running' || battle.paused || telegraph?.counter !== 'sequence') return false;
  const phase = adventureEncounters[battle.encounter].phases[telegraph.phase];
  const { order, options } = phase.sequence;
  if (telegraph.counterStep >= order.length || !Object.hasOwn(options, input)) return false;
  if (order[telegraph.counterStep] !== input) {
    telegraph.counterStep = 0;
    state.lastMessage = 'Sai thứ tự. Hãy bắt đầu lại trước khi hết giờ.';
  } else {
    telegraph.counterStep += 1;
    state.lastMessage = telegraph.counterStep === order.length
      ? 'Đã hoàn thành chuỗi ngắt chiêu.' : options[input] + ' đã kích hoạt.';
  }
  return true;
}

export function findBattleTarget(battle, targetId) {
  return battle.actors.find(actor => actor.actor_id === targetId)
    ?? battle.stoves?.find(stove => stove.actor_id === targetId);
}

export function stepAdventure(state, save, deltaSeconds, maps) {
  if (state.battle) {
    if (state.battle.paused || state.battle.phase !== 'battle_running') return;
    state.battle.accumulator = (state.battle.accumulator ?? 0) + Math.min(deltaSeconds, 0.25);
    const tickDuration = 1 / ADVENTURE_TICK_RATE;
    while (state.battle.accumulator >= tickDuration && state.battle.phase === 'battle_running') {
      state.battle.accumulator -= tickDuration;
      stepBattle(state);
    }
  } else {
    const length = Math.hypot(state.input.x, state.input.y);
    if (length > 0) {
      const waypoint = state.walkPath?.[0];
      const distance = waypoint ? Math.min(PLAYER_SPEED * deltaSeconds, Math.hypot(waypoint.x - state.x, waypoint.y - state.y))
        : PLAYER_SPEED * deltaSeconds;
      const movement = moveWithCollision(
        state.map,
        state.x,
        state.y,
        state.input.x * distance,
        state.input.y * distance,
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

function stepBattle(state) {
  const battle = state.battle;
  battle.tick += 1;
  gameEvents.setTick(battle.tick);
  for (const actor of battle.actors) {
    if (!actor.alive) continue;
    actor.previousX = actor.x;
    actor.previousY = actor.y;
    stepActor(battle, actor);
  }
  const alivePlayers = battle.actors.some((actor) => actor.team === 'player' && actor.alive);
  const aliveEnemies = battle.actors.some((actor) => actor.team === 'enemy' && actor.alive);
  if (!alivePlayers) return finishBattle(state, false);
  if (!aliveEnemies) {
    const waves = adventureEncounters[battle.encounter ?? 'forest'].waves;
    if (battle.wave + 1 === waves.length) return finishBattle(state, true);
    battle.wave += 1;
    battle.actors = battle.actors.filter((actor) => actor.team === 'player');
    for (const actor of battle.actors) {
      actor.action = null;
      actor.x = actor.homeX;
      actor.y = actor.homeY;
      actor.previousX = actor.x;
      actor.previousY = actor.y;
      actor.moving = false;
      actor.cooldown = Math.max(actor.cooldown, 10);
    }
    const enemies = waves[battle.wave].map((enemy, index) => spawnActor(enemy, 'enemy', index));
    battle.actors.push(...enemies);
    gameEvents.emit('wave_completed', { wave: battle.wave }, battleContext(battle));
    for (const enemy of enemies) {
      gameEvents.emit('actor_spawned', { actor_id: enemy.id, character_id: enemy.id, boss: enemy.boss }, battleContext(battle));
    }
    state.lastMessage = enemies[0].name + ' xuất hiện!';
  }
  updateBoss(state);
}

function stepActor(battle, actor) {
  actor.moving = false;
  if (actor.shieldUntil <= battle.tick) actor.shield = 0;
  actor.cooldown = Math.max(0, actor.cooldown - 1);
  const wave = battle.bossTelegraph;
  const committed = actor.action && (actor.action.sourceKind === 'ultimate'
    || (actor.action.travel && battle.tick > actor.action.launchTick));
  if (actor.team === 'player' && wave?.retreating && !committed) {
    actor.action = null;
    if (actor.x > wave.safeX - 16) {
      const speed = adventureEncounters[battle.encounter].retreatSpeed;
      actor.x = Math.max(wave.safeX - 16, actor.x - speed);
      actor.direction = 'W';
      actor.moving = true;
    }
    return;
  }
  if (actor.action) {
    const action = actor.action;
    if (action.travel && battle.tick === action.launchTick) {
      const target = findBattleTarget(battle, action.targetId);
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
  if (distance - profile.range > RANGE_EPSILON) {
    if (actor.stationary) return;
    const speed = (actor.speed ?? balance.approachSpeed) * (actor.slowUntil > battle.tick ? .55 : 1);
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
  if (actor.team === 'player' && battle.stoveTargetId) {
    const focused = findBattleTarget(battle, battle.stoveTargetId);
    if (focused?.alive) return focused;
  }
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
  const originalTarget = findBattleTarget(battle, action.targetId);
  const target = originalTarget?.alive ? originalTarget
    : action.sourceKind === 'ultimate' && !action.travel ? selectTarget(battle, actor, action.kind === 'execute') : null;
  const targets = action.kind === 'area'
    ? [...battle.actors, ...battle.stoves].filter((item) => item.alive && item.team !== actor.team)
    : target ? [target] : [];
  const clipId = action.clip ?? (action.sourceKind === 'ultimate' ? 'ultimate_01' : 'attack_a');
  for (const victim of targets) {
    const coefficient = action.kind === 'execute' && victim.hp <= victim.maxHp * .35 ? action.executeCoefficient : action.coefficient;
    applyBattleHit(battle, actor, victim, coefficient ?? 10000, action.sourceKind, clipId);
    if (action.kind === 'slow') victim.slowUntil = battle.tick + action.duration;
  }
  if (actor.team === 'player' && action.sourceKind === 'basic') actor.energy = Math.min(100, actor.energy + balance.basicEnergy);
}

function updateBoss(state) {
  const battle = state.battle;
  const boss = battle.actors.find((item) => item.boss && item.alive);
  if (!boss) return;
  const encounter = adventureEncounters[battle.encounter ?? 'forest'];
  const phase = battle.bossPhase + 1;
  const next = encounter.phases[phase];
  if (next && boss.hp <= Math.ceil(boss.maxHp * next.threshold) && !battle.bossTelegraph && !boss.action) {
    battle.bossPhase = phase;
    const telegraph = { phase, ticks: next.windup, duration: next.windup, attack: next.attack, counter: next.counter };
    battle.bossTelegraph = telegraph;
    if (next.counter === 'stoves') {
      const { hp, def, positions } = balance.bossStoves;
      battle.stoves = positions.map(([x, y], index) => ({
        actor_id: 'boss_stove_' + (index + 1), team: 'enemy', stove: true, x, y, hp, maxHp: hp, def, alive: true,
      }));
      state.lastMessage = 'Chọn từng bếp lửa để cả đội tập trung phá bếp và ngắt chiêu.';
    } else if (next.counter === 'lantern') {
      telegraph.targetIds = bossTelegraphTargets(battle, boss).map(actor => actor.actor_id);
      state.lastMessage = boss.name + ' đang tụ ' + next.attack + '. Hãy để ý các Vị Linh được đánh dấu.';
    } else if (next.counter === 'retreat') {
      telegraph.safeX = next.safeX;
      state.lastMessage = next.attack + ' sắp tràn qua. Bấm R hoặc Lùi về vùng khô để tránh sóng.';
    } else if (next.counter === 'sequence') {
      telegraph.counterStep = 0;
      state.lastMessage = next.attack + ' sắp tung ra. Kích hoạt theo đúng thứ tự để ngắt chiêu.';
    } else {
      state.lastMessage = 'Bếp Trưởng sắp tung Vòng Lửa. Hãy bảo vệ các Vị Linh được đánh dấu.';
    }
    gameEvents.emit('boss_phase_changed', { phase, attack: next.attack, windup_ticks: next.windup, element: boss.element }, battleContext(battle, boss.actor_id));
    return;
  }
  if (!battle.bossTelegraph) return;
  const { phase: attackPhase, attack, counter, warded, counterStep } = battle.bossTelegraph;
  const attackSpec = encounter.phases[attackPhase];
  const interrupted = (counter === 'stoves' && battle.stoves.every(stove => !stove.alive))
    || (counter === 'sequence' && counterStep === attackSpec.sequence.order.length);
  if (!interrupted && --battle.bossTelegraph.ticks > 0) return;
  const victims = bossTelegraphTargets(battle, boss);
  clearBossTelegraph(battle);
  const cue = interrupted ? 'boss_cast_interrupted' : 'boss_cast_released';
  gameEvents.emit(cue, { element: boss.element, attack, warded: Boolean(warded) }, battleContext(battle, boss.actor_id));
  if (interrupted) {
    boss.cooldown = Math.max(boss.cooldown, 24);
    state.lastMessage = counter === 'sequence' ? 'Đã ngắt ' + attack + '!' : 'Đã phá cả hai bếp và ngắt Bếp Bùng Cháy!';
    return;
  }
  state.lastMessage = counter === 'retreat'
    ? victims.length ? `Sóng đánh trúng ${victims.length} Vị Linh còn trong vùng nước.` : 'Cả đội đã tránh được sóng!'
    : boss.name + ' đã tung ' + attack + '!';
  const { coefficient } = attackSpec;
  const adjusted = warded ? Math.floor(coefficient * (10000 - encounter.wardReductionBp) / 10000) : coefficient;
  for (const victim of victims) applyBattleHit(battle, boss, victim, adjusted, 'boss_telegraph');
}

function clearBossTelegraph(battle) {
  battle.bossTelegraph = null;
  battle.stoves = [];
  battle.stoveTargetId = null;
}

export function bossTelegraphTargets(battle, boss) {
  const telegraph = battle.bossTelegraph;
  if (!telegraph) return [];
  const allies = battle.actors.filter(actor => actor.team === 'player' && actor.alive);
  if (telegraph.counter === 'retreat') return allies.filter(actor => actor.x > telegraph.safeX);
  if (telegraph.targetIds) return telegraph.targetIds.map(id => allies.find(actor => actor.actor_id === id)).filter(Boolean);
  const phase = adventureEncounters[battle.encounter ?? 'forest'].phases[telegraph.phase];
  const distance = (actor) => Math.hypot(actor.x - boss.x, actor.y - boss.y);
  const order = phase.counter === 'lantern' ? -1 : 1;
  return allies.sort((a, b) => order * (distance(a) - distance(b)))
    .slice(0, phase.targets);
}

function applyBattleHit(battle, source, target, coefficientBp, sourceKind, clipId) {
  const damage = Math.max(1, Math.floor(source.atk * coefficientBp / 10000 * 100 / (100 + target.def)));
  const absorbed = Math.min(damage, target.shield ?? 0);
  target.shield = (target.shield ?? 0) - absorbed;
  const guarded = target.boss && ['stoves', 'sequence'].includes(battle.bossTelegraph?.counter);
  const nextPhase = target.boss ? adventureEncounters[battle.encounter ?? 'forest'].phases[battle.bossPhase + 1] : null;
  const hpFloor = nextPhase ? Math.ceil(target.maxHp * nextPhase.threshold) : 0;
  const hpDamage = guarded ? 0 : Math.min(Math.max(0, target.hp - hpFloor), damage - absorbed);
  target.hp -= hpDamage;
  target.alive = target.hp > 0;
  if (target.team === 'player') target.energy = Math.min(100, target.energy + balance.hurtEnergy);
  const payload = {
    hit_id: `${battle.tick}:${source.actor_id}:${target.actor_id}`, damage, hp_damage: hpDamage, absorbed,
    source_kind: sourceKind, element: source.element, timed: true, guarded: Boolean(guarded),
  };
  if (clipId) payload.clip_id = clipId;
  const hit = gameEvents.emit('hit_resolved', payload, battleContext(battle, source.actor_id, target.actor_id));
  battle.events.push(hit);
  if (absorbed > 0 && target.shield === 0) {
    gameEvents.emit('shield_broken', { element: 'light' }, battleContext(battle, source.actor_id, target.actor_id));
  }
  if (!target.alive && target.stove) {
    if (battle.stoveTargetId === target.actor_id) battle.stoveTargetId = null;
    gameEvents.emit('boss_stove_destroyed', { element: 'fire' }, battleContext(battle, source.actor_id, target.actor_id));
  } else if (!target.alive) {
    gameEvents.emit('actor_died', { actor_id: target.actor_id }, battleContext(battle, source.actor_id, target.actor_id));
  }
}

function finishBattle(state, won) {
  const battle = state.battle;
  battle.phase = 'battle_end';
  clearBossTelegraph(battle);
  battle.result = won ? 'victory' : 'defeat';
  state.result = won ? { won, ...adventureEncounters[battle.encounter ?? 'forest'].reward } : { won, gold: 0, essence: 0 };
  state.lastMessage = won ? 'Chiến thắng! Phần thưởng đã sẵn sàng nhận.' : 'Đội hình đã gục. Bạn có thể thử lại khi đã chuẩn bị.';
  gameEvents.emit('battle_finished', { result: battle.result, winner_team: won ? 'player' : 'enemy' }, battleContext(battle));
}

export function claimBattleResult(state, save) {
  const battle = state.battle;
  if (battle?.phase !== 'battle_end' || battle.result !== 'victory') return save;
  const updated = structuredClone(save);
  updated.adventure.battle = null;
  const { encounter } = battle;
  const finale = FINALE_CHAPTERS.find(chapter => chapter.boss && chapter.boss === encounter);
  const claimId = encounter === 'seal' ? 'forest_empty_bowl_reward'
    : encounter === 'tide' ? 'harbor_tidal_conch_reward' : finale ? adventureEncounters[encounter].claimId : `${battle.id}:forest_reward`;
  if (!updated.adventure.rewardClaims.includes(claimId)) {
    const { gold, essence } = adventureEncounters[battle.encounter ?? 'forest'].reward;
    updated.adventure.rewardClaims.push(claimId);
    updated.player.gold += gold;
    updated.player.essence += essence;
    updated.completedBattles += 1;
    updated.roster = updated.roster.map(member => {
      const actor = battle.actors.find(item => item.actor_id === member.id);
      return { ...member, hp: Math.max(1, Math.round(actor.hp * member.maxHp / actor.maxHp)), energy: 0 };
    });
    if (encounter === 'seal') updated.adventure.chapterTwo.stage = 'ready_to_claim';
    else if (encounter === 'tide') updated.adventure.chapterThree.stage = 'ready_to_claim';
    else if (finale) updated.adventure.finale[finale.number].stage = 'ready_to_claim';
    else {
      updated.adventure.forestCleared = true;
      updated.adventure.quest = 'ready_to_claim';
    }
  }
  state.battle = null;
  state.result = null;
  state.lastMessage = encounter === 'seal' ? 'Ấn Bát Rỗng đã vỡ. Hãy mang mảnh men về cho Lilia.'
    : encounter === 'tide' ? 'Thủy triều đã dịu. Hãy trở lại đầu bến báo tin cho Phở Lam Vũ.'
      : finale ? finale.steps[3] + '.' : 'Rừng đã yên tĩnh. Hãy trở về làng để báo tin cho Lilia.';
  return updated;
}

export function leaveAdventureDefeat(state) {
  if (state.battle?.phase !== 'battle_end' || state.battle.result !== 'defeat') return false;
  state.battle = null;
  state.result = null;
  state.lastMessage = 'Đội đã rút lui. Hãy chuẩn bị Vị Linh rồi quay lại điểm giao tranh.';
  return true;
}

function battleContext(battle, sourceId, targetId) {
  return { battle_id: battle.id, rules_version: 'client-p0-v1', tick: battle.tick, source_id: sourceId, target_id: targetId };
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
