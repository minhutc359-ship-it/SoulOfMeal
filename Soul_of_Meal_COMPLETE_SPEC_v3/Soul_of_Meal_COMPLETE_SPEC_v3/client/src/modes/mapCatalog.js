export function validateAdventureMap(map) {
  const errors = [];
  if (!isRecord(map)) return { valid: false, errors: ['map must be an object'] };
  if (map.schema_version !== 1) errors.push('schema_version must equal 1');
  if (!isId(map.map_id)) errors.push('map_id must be a non-empty ID');
  if (!isId(map.runtime_key)) errors.push('runtime_key must be a non-empty ID');
  if (typeof map.catalog_version !== 'string' || !map.catalog_version) errors.push('catalog_version must be a non-empty string');
  if (!isRecord(map.world)) errors.push('world must be an object');
  if (!isRecord(map.collision) || !Array.isArray(map.collision.obstacles)) errors.push('collision.obstacles must be an array');
  if (map.transitions !== undefined && !Array.isArray(map.transitions)) errors.push('transitions must be an array when present');
  if (!Array.isArray(map.interactables)) errors.push('interactables must be an array');
  if (!Array.isArray(map.visuals)) errors.push('visuals must be an array');

  const width = map.world?.width;
  const height = map.world?.height;
  if (!Number.isFinite(width) || width <= 0) errors.push('world.width must be positive');
  if (!Number.isFinite(height) || height <= 0) errors.push('world.height must be positive');
  if (!Number.isFinite(map.world?.player_radius) || map.world.player_radius <= 0) errors.push('world.player_radius must be positive');
  if (!isRecord(map.world?.spawn) || !insideWorld(map.world.spawn, width, height)) errors.push('world.spawn must be inside world bounds');

  const seenIds = new Set();
  for (const [index, obstacle] of (map.collision?.obstacles ?? []).entries()) {
    const path = `collision.obstacles[${index}]`;
    if (!isRecord(obstacle) || !isId(obstacle.id)) {
      errors.push(`${path}.id must be a non-empty ID`);
      continue;
    }
    if (seenIds.has(obstacle.id)) errors.push(`${path}.id is duplicated: ${obstacle.id}`);
    seenIds.add(obstacle.id);
    if (obstacle.type !== 'rect') errors.push(`${path}.type must be rect`);
    if (![obstacle.x, obstacle.y, obstacle.width, obstacle.height].every(Number.isFinite) || obstacle.width <= 0 || obstacle.height <= 0) {
      errors.push(`${path} must have finite position and positive dimensions`);
      continue;
    }
    if (obstacle.x < 0 || obstacle.y < 0 || obstacle.x + obstacle.width > width || obstacle.y + obstacle.height > height) errors.push(`${path} is outside world bounds`);
  }

  for (const [index, transition] of (map.transitions ?? []).entries()) {
    if (!isRecord(transition) || !isId(transition.id) || !isId(transition.type) || !isId(transition.to)) errors.push(`transitions[${index}] needs id, type and target`);
    if (transition.spawn && (!isRecord(transition.spawn) || !Number.isFinite(transition.spawn.x) || !Number.isFinite(transition.spawn.y))) errors.push(`transitions[${index}].spawn must be numeric x/y`);
  }

  for (const [index, item] of (map.interactables ?? []).entries()) {
    if (!isRecord(item) || !isId(item.id) || !isId(item.kind) || !isId(item.action) || !isId(item.label)) errors.push(`interactables[${index}] needs id, kind, action and label`);
    else if (!insideWorld(item, width, height)) errors.push(`interactables[${index}] is outside world bounds`);
    if (!Number.isFinite(item.radius) || item.radius <= 0) errors.push(`interactables[${index}].radius must be positive`);
  }

  for (const [index, visual] of (map.visuals ?? []).entries()) {
    if (!isRecord(visual) || !isId(visual.id) || !isId(visual.kind) || !Number.isFinite(visual.x) || !Number.isFinite(visual.y)) errors.push(`visuals[${index}] needs id, kind and finite position`);
  }

  return { valid: errors.length === 0, errors };
}

export function createAdventureMapRegistry(maps) {
  if (!Array.isArray(maps) || maps.length === 0) throw new Error('maps must be a non-empty array');
  const registry = new Map();
  for (const map of maps) {
    const validation = validateAdventureMap(map);
    if (!validation.valid) throw new Error(`Invalid map ${map?.map_id ?? '<unknown>'}: ${validation.errors.join('; ')}`);
    if (registry.has(map.runtime_key)) throw new Error(`Duplicate map runtime_key: ${map.runtime_key}`);
    registry.set(map.runtime_key, map);
  }
  return registry;
}

const DEFAULT_ADVENTURE_MAPS = createAdventureMapRegistry([
  {
    schema_version: 1,
    catalog_version: 'client-p0-v1',
    map_id: 'env_village_square',
    runtime_key: 'village',
    display_name: 'Làng Ẩm Thực',
    world: { width: 960, height: 540, player_radius: 14, spawn: { x: 120, y: 310 } },
    collision: {
      obstacles: [
        { id: 'building_kitchen', type: 'rect', x: 60, y: 105, width: 176, height: 118 },
        { id: 'building_guild', type: 'rect', x: 400, y: 90, width: 176, height: 118 },
        { id: 'building_merchant', type: 'rect', x: 640, y: 100, width: 176, height: 118 },
        { id: 'plaza_table', type: 'rect', x: 270, y: 395, width: 85, height: 52 },
      ],
    },
    transitions: [
      { id: 'portal_ingredient_forest', type: 'door', from: 'village', to: 'forest', targetMap: 'forest', spawn: { x: 82, y: 420 }, label: 'Cổng Rừng Nguyên Liệu' },
    ],
    interactables: [
      { id: 'npc_lilia', kind: 'npc', action: 'lilia', label: 'Lilia', x: 235, y: 260, radius: 62 },
      { id: 'village_supply_chest_p0', kind: 'chest', action: 'chest', label: 'Rương nguyên liệu', x: 680, y: 355, radius: 62 },
      { id: 'portal_ingredient_forest', kind: 'portal', action: 'portal', label: 'Cổng Rừng Nguyên Liệu', x: 878, y: 260, radius: 62 },
    ],
    visuals: [
      { id: 'building_kitchen', kind: 'house', x: 60, y: 105, width: 176, height: 118, palette: 'coral' },
      { id: 'building_guild', kind: 'house', x: 400, y: 90, width: 176, height: 118, palette: 'sage' },
      { id: 'building_merchant', kind: 'house', x: 640, y: 100, width: 176, height: 118, palette: 'gold' },
      { id: 'plaza_table', kind: 'table', x: 270, y: 395, width: 85, height: 52 },
      { id: 'npc_lilia', kind: 'marker', x: 235, y: 260, label: 'LILIA', palette: 'wood' },
      { id: 'village_supply_chest_p0', kind: 'chest', x: 680, y: 355, label: 'RƯƠNG' },
      { id: 'portal_ingredient_forest', kind: 'portal', x: 878, y: 260, label: 'RỪNG' },
    ],
  },
  {
    schema_version: 1,
    catalog_version: 'client-p0-v1',
    map_id: 'env_ingredient_forest',
    runtime_key: 'forest',
    display_name: 'Rừng Nguyên Liệu',
    world: { width: 960, height: 540, player_radius: 14, spawn: { x: 82, y: 420 } },
    collision: {
      obstacles: [
        { id: 'forest_tree_01', type: 'rect', x: 16, y: 60, width: 50, height: 58 },
        { id: 'forest_tree_02', type: 'rect', x: 153, y: 139, width: 50, height: 58 },
        { id: 'forest_tree_03', type: 'rect', x: 290, y: 218, width: 50, height: 58 },
        { id: 'forest_tree_04', type: 'rect', x: 427, y: 297, width: 50, height: 58 },
        { id: 'forest_tree_05', type: 'rect', x: 564, y: 376, width: 50, height: 58 },
        { id: 'forest_tree_06', type: 'rect', x: 701, y: 115, width: 50, height: 58 },
        { id: 'forest_tree_07', type: 'rect', x: 838, y: 194, width: 50, height: 58 },
        { id: 'forest_tree_08', type: 'rect', x: 15, y: 273, width: 50, height: 58 },
        { id: 'forest_tree_09', type: 'rect', x: 152, y: 352, width: 50, height: 58 },
        { id: 'forest_tree_10', type: 'rect', x: 289, y: 91, width: 50, height: 58 },
        { id: 'forest_tree_11', type: 'rect', x: 426, y: 170, width: 50, height: 58 },
        { id: 'forest_tree_12', type: 'rect', x: 563, y: 249, width: 50, height: 58 },
        { id: 'forest_tree_13', type: 'rect', x: 700, y: 328, width: 50, height: 58 },
      ],
    },
    transitions: [
      { id: 'forest_return_portal', type: 'door', from: 'forest', to: 'village', targetMap: 'village', spawn: { x: 878, y: 260 }, label: 'Về làng' },
    ],
    interactables: [
      { id: 'forest_clue_salt', kind: 'clue', action: 'forest_clue_salt', label: 'Muối đã mất vị', x: 268, y: 435, radius: 48 },
      { id: 'forest_clue_ladle', kind: 'clue', action: 'forest_clue_ladle', label: 'Chiếc vá ám khói', x: 682, y: 207, radius: 48 },
      { id: 'forest_encounter_p0', kind: 'encounter', action: 'encounter', label: 'Sân bếp Hỏa Diệm', x: 500, y: 300, radius: 62 },
      { id: 'forest_return_portal', kind: 'portal', action: 'village_return', label: 'Về làng', x: 900, y: 470, radius: 62 },
    ],
    visuals: [
      { id: 'forest_tree_01', kind: 'tree', x: 41, y: 70, palette: 'forest_dark' },
      { id: 'forest_tree_02', kind: 'tree', x: 178, y: 149, palette: 'forest_light' },
      { id: 'forest_tree_03', kind: 'tree', x: 315, y: 228, palette: 'forest_dark' },
      { id: 'forest_tree_04', kind: 'tree', x: 452, y: 307, palette: 'forest_light' },
      { id: 'forest_tree_05', kind: 'tree', x: 589, y: 386, palette: 'forest_dark' },
      { id: 'forest_tree_06', kind: 'tree', x: 726, y: 125, palette: 'forest_light' },
      { id: 'forest_tree_07', kind: 'tree', x: 863, y: 204, palette: 'forest_dark' },
      { id: 'forest_tree_08', kind: 'tree', x: 40, y: 283, palette: 'forest_light' },
      { id: 'forest_tree_09', kind: 'tree', x: 177, y: 362, palette: 'forest_dark' },
      { id: 'forest_tree_10', kind: 'tree', x: 314, y: 101, palette: 'forest_light' },
      { id: 'forest_tree_11', kind: 'tree', x: 451, y: 180, palette: 'forest_dark' },
      { id: 'forest_tree_12', kind: 'tree', x: 588, y: 259, palette: 'forest_light' },
      { id: 'forest_tree_13', kind: 'tree', x: 725, y: 338, palette: 'forest_dark' },
      { id: 'forest_clue_salt', kind: 'clue', x: 268, y: 435, label: 'MUỐI NHẠT' },
      { id: 'forest_clue_ladle', kind: 'clue', x: 682, y: 207, label: 'VÁ ÁM KHÓI' },
      { id: 'forest_encounter_p0', kind: 'marker', x: 500, y: 300, label: 'SÂN BẾP', palette: 'coral' },
      { id: 'forest_return_portal', kind: 'portal', x: 900, y: 470, label: 'VỀ LÀNG' },
    ],
  },
]);

export function getAdventureMap(maps, mapKey) {
  if (!maps) return DEFAULT_ADVENTURE_MAPS.get(mapKey) ?? null;
  if (maps instanceof Map) return maps.get(mapKey) ?? DEFAULT_ADVENTURE_MAPS.get(mapKey) ?? null;
  return maps?.[mapKey] ?? DEFAULT_ADVENTURE_MAPS.get(mapKey) ?? null;
}

export function getMapTransition(map, toMap) {
  if (!map || !Array.isArray(map.transitions)) return null;
  return map.transitions.find((transition) => transition.to === toMap || transition.targetMap === toMap) ?? null;
}

function insideWorld(point, width, height) {
  return Number.isFinite(width) && Number.isFinite(height)
    && Number.isFinite(point?.x) && Number.isFinite(point?.y)
    && point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isId(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
