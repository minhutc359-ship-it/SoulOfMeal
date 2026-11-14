import village from '../../../examples/maps/village.json' with { type: 'json' };
import forest from '../../../examples/maps/forest.json' with { type: 'json' };
import harbor from '../../../examples/maps/harbor.json' with { type: 'json' };
import caldera from '../../../examples/maps/caldera.json' with { type: 'json' };
import sanctum from '../../../examples/maps/sanctum.json' with { type: 'json' };
import orchard from '../../../examples/maps/orchard.json' with { type: 'json' };
import spice_garden from '../../../examples/maps/spice_garden.json' with { type: 'json' };
import village_guild from '../../../examples/maps/village_guild.json' with { type: 'json' };
import village_kitchen from '../../../examples/maps/village_kitchen.json' with { type: 'json' };
import village_merchant from '../../../examples/maps/village_merchant.json' with { type: 'json' };
import { walkablePoint } from './worldCollision.js';

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

  const list = value => Array.isArray(value) ? value : [];
  const seenIds = new Set();
  for (const [index, obstacle] of list(map.collision?.obstacles).entries()) {
    const path = `collision.obstacles[${index}]`;
    if (!isRecord(obstacle) || !isId(obstacle.id)) {
      errors.push(`${path}.id must be a non-empty ID`);
      continue;
    }
    if (seenIds.has(obstacle.id)) errors.push(`${path}.id is duplicated: ${obstacle.id}`);
    seenIds.add(obstacle.id);
    if (obstacle.type === 'polygon') {
      if (!validPolygon(obstacle.points, width, height)) errors.push(`${path}.points must describe a convex polygon inside the world`);
      continue;
    }
    if (obstacle.type !== 'rect') errors.push(`${path}.type must be rect`);
    if (![obstacle.x, obstacle.y, obstacle.width, obstacle.height].every(Number.isFinite) || obstacle.width <= 0 || obstacle.height <= 0) {
      errors.push(`${path} must have finite position and positive dimensions`);
      continue;
    }
    if (obstacle.x < 0 || obstacle.y < 0 || obstacle.x + obstacle.width > width || obstacle.y + obstacle.height > height) errors.push(`${path} is outside world bounds`);
  }

  if (map.layers?.occlusion !== undefined && !Array.isArray(map.layers.occlusion)) errors.push('layers.occlusion must be an array');
  for (const [index, layer] of list(map.layers?.occlusion).entries()) {
    if (!isId(layer?.id) || !validPolygon(layer.points, width, height) || !Number.isFinite(layer.depth)) {
      errors.push(`layers.occlusion[${index}] needs an id, depth and convex polygon`);
    }
  }
  if (!errors.length && !walkablePoint(map, map.world.spawn.x, map.world.spawn.y)) errors.push('world.spawn overlaps collision');

  for (const [index, transition] of list(map.transitions).entries()) {
    if (!isRecord(transition) || !isId(transition.id) || !isId(transition.type) || !isId(transition.to)) errors.push(`transitions[${index}] needs id, type and target`);
    if (transition?.spawn && (!isRecord(transition.spawn) || !Number.isFinite(transition.spawn.x) || !Number.isFinite(transition.spawn.y))) errors.push(`transitions[${index}].spawn must be numeric x/y`);
  }

  for (const [index, item] of list(map.interactables).entries()) {
    if (!isRecord(item) || !isId(item.id) || !isId(item.kind) || !isId(item.action) || !isId(item.label)) errors.push(`interactables[${index}] needs id, kind, action and label`);
    else if (!insideWorld(item, width, height)) errors.push(`interactables[${index}] is outside world bounds`);
    if (!Number.isFinite(item?.radius) || item.radius <= 0) errors.push(`interactables[${index}].radius must be positive`);
  }

  for (const [index, visual] of list(map.visuals).entries()) {
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
  for (const map of registry.values()) {
    for (const transition of map.transitions ?? []) {
      const target = registry.get(transition.to);
      const spawn = transition.spawn;
      if (target && spawn && !walkablePoint(target, spawn.x, spawn.y)) {
        throw new Error(`Invalid transition ${transition.id}: spawn overlaps collision in ${target.runtime_key}`);
      }
    }
  }
  return registry;
}

function validPolygon(points, width, height) {
  if (!Array.isArray(points) || points.length < 3 || !points.every(point => Array.isArray(point) && point.length === 2 && insideWorld({ x: point[0], y: point[1] }, width, height))) return false;
  const turns = points.map(([x, y], index) => {
    const [nx, ny] = points[(index + 1) % points.length];
    const [px, py] = points[(index + 2) % points.length];
    return (nx - x) * (py - ny) - (ny - y) * (px - nx);
  });
  return turns.every(turn => turn > 0) || turns.every(turn => turn < 0);
}

export const ADVENTURE_MAP_KEYS = Object.freeze(['village', 'forest', 'harbor', 'caldera', 'sanctum', 'orchard', 'spice_garden', 'village_guild', 'village_kitchen', 'village_merchant']);
const DEFAULT_ADVENTURE_MAPS = createAdventureMapRegistry([village, forest, harbor, caldera, sanctum, orchard, spice_garden, village_guild, village_kitchen, village_merchant]);

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
