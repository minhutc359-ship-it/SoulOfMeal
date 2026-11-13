import { getAdventureMap } from './mapCatalog.js';
import { firstObstacleHit, walkablePoint } from './worldCollision.js';

export const PLAYER_COLLISION_RADIUS = 14;
export const PATH_GRID_SIZE = 24;

export function collidesWithWorld(mapId, x, y, radius = PLAYER_COLLISION_RADIUS, maps) {
  return !walkablePoint(getAdventureMap(maps, mapId), x, y, radius);
}

export function moveWithCollision(mapId, x, y, deltaX, deltaY, radius = PLAYER_COLLISION_RADIUS, maps) {
  const map = getAdventureMap(maps, mapId);
  if (!map) return { x, y, blockedX: true, blockedY: true };
  const dx = clamp(x + deltaX, radius, map.world.width - radius) - x;
  const dy = clamp(y + deltaY, radius, map.world.height - radius) - y;
  const solids = map.collision.obstacles;
  const t = firstObstacleHit(solids, { x, y }, dx, dy, radius);
  const point = { x: x + dx * t, y: y + dy * t };
  if (t < 1) {
    const restX = dx * (1 - t);
    const restY = dy * (1 - t);
    point.x += restX * firstObstacleHit(solids, point, restX, 0, radius);
    point.y += restY * firstObstacleHit(solids, point, 0, restY, radius);
  }
  return { ...point, blockedX: Math.abs(point.x - x - deltaX) > .01, blockedY: Math.abs(point.y - y - deltaY) > .01 };
}

export function safeAdventurePosition(mapId, position, maps) {
  const map = getAdventureMap(maps, mapId);
  if (!map || walkablePoint(map, position.x, position.y)) return position;
  return { ...map.world.spawn };
}

export function findAdventurePath(mapId, start, destination, radius = PLAYER_COLLISION_RADIUS, maps) {
  const world = getAdventureMap(maps, mapId)?.world;
  if (!world) return [];
  const columns = Math.ceil(world.width / PATH_GRID_SIZE);
  const rows = Math.ceil(world.height / PATH_GRID_SIZE);
  if (hasClearLine(mapId, start, destination, radius, maps)) return [{ x: destination.x, y: destination.y }];
  const startNode = nearestWalkableNode(mapId, start, columns, rows, radius, maps, world, true);
  const endNode = nearestWalkableNode(mapId, destination, columns, rows, radius, maps, world);
  if (!startNode || !endNode) return [];

  const startId = nodeId(startNode.column, startNode.row, columns);
  const endId = nodeId(endNode.column, endNode.row, columns);
  if (startId === endId) {
    return [nodePoint(endNode.column, endNode.row, world, radius)];
  }

  const open = new MinHeap();
  const cameFrom = new Map();
  const costs = new Map([[startId, 0]]);
  const closed = new Set();
  open.push({ ...startNode, id: startId, score: heuristic(startNode, endNode) });
  const directions = [
    [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
    [-1, -1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, 1, Math.SQRT2],
  ];

  while (open.size) {
    const current = open.pop();
    if (closed.has(current.id)) continue;
    if (current.id === endId) return reconstructPath(mapId, cameFrom, current, columns, destination, start, radius, maps, world);
    closed.add(current.id);

    const origin = nodePoint(current.column, current.row, world, radius);
    for (const [offsetX, offsetY, cost] of directions) {
      const column = current.column + offsetX;
      const row = current.row + offsetY;
      if (column < 0 || column >= columns || row < 0 || row >= rows) continue;
      const point = nodePoint(column, row, world, radius);
      if (!hasClearLine(mapId, origin, point, radius, maps)) continue;
      const neighborId = nodeId(column, row, columns);
      if (closed.has(neighborId)) continue;
      const newCost = costs.get(current.id) + cost;
      if (newCost >= (costs.get(neighborId) ?? Infinity)) continue;
      cameFrom.set(neighborId, current.id);
      costs.set(neighborId, newCost);
      open.push({ column, row, id: neighborId, score: newCost + heuristic({ column, row }, endNode) });
    }
  }
  return [];
}

function nearestWalkableNode(mapId, position, columns, rows, radius, maps, world, connected = false) {
  const idealColumn = clamp(Math.floor(position.x / PATH_GRID_SIZE), 0, columns - 1);
  const idealRow = clamp(Math.floor(position.y / PATH_GRID_SIZE), 0, rows - 1);
  let best = null;
  let bestDistance = Infinity;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const point = nodePoint(column, row, world, radius);
      if (collidesWithWorld(mapId, point.x, point.y, radius, maps) || connected && !hasClearLine(mapId, position, point, radius, maps)) continue;
      const gridDistance = Math.abs(column - idealColumn) + Math.abs(row - idealRow);
      const targetDistance = Math.hypot(point.x - position.x, point.y - position.y);
      const score = targetDistance + gridDistance * 0.001;
      if (score < bestDistance) {
        best = { column, row };
        bestDistance = score;
      }
    }
  }
  return best;
}

function reconstructPath(mapId, cameFrom, current, columns, destination, start, radius, maps, world) {
  const ids = [current.id];
  while (cameFrom.has(ids[0])) ids.unshift(cameFrom.get(ids[0]));
  const gridPoints = ids.map(id => nodePoint(id % columns, Math.floor(id / columns), world, radius));
  if (hasClearLine(mapId, start, gridPoints[1], radius, maps)) gridPoints.shift();
  const points = compressPath(gridPoints);
  const last = points.at(-1);
  if (!collidesWithWorld(mapId, destination.x, destination.y, radius, maps) && hasClearLine(mapId, last, destination, radius, maps)) {
    points.push(destination);
  }
  return points;
}

export function hasClearLine(mapId, start, end, radius = PLAYER_COLLISION_RADIUS, maps) {
  const map = getAdventureMap(maps, mapId);
  return Boolean(end && walkablePoint(map, start.x, start.y, radius) && walkablePoint(map, end.x, end.y, radius)
    && firstObstacleHit(map.collision.obstacles, start, end.x - start.x, end.y - start.y, radius) === 1);
}

function compressPath(points) {
  if (points.length < 3) return points;
  const result = [points[0]];
  let previousDirection = directionBetween(points[0], points[1]);
  for (let index = 1; index < points.length - 1; index += 1) {
    const nextDirection = directionBetween(points[index], points[index + 1]);
    if (nextDirection.x !== previousDirection.x || nextDirection.y !== previousDirection.y) result.push(points[index]);
    previousDirection = nextDirection;
  }
  result.push(points.at(-1));
  return result;
}

function directionBetween(first, second) {
  return { x: Math.sign(second.x - first.x), y: Math.sign(second.y - first.y) };
}

function nodePoint(column, row, world, radius) {
  return { x: clamp(column * PATH_GRID_SIZE + PATH_GRID_SIZE / 2, radius, world.width - radius), y: clamp(row * PATH_GRID_SIZE + PATH_GRID_SIZE / 2, radius, world.height - radius) };
}

function nodeId(column, row, columns) {
  return row * columns + column;
}

function heuristic(first, second) {
  const dx = Math.abs(first.column - second.column);
  const dy = Math.abs(first.row - second.row);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

class MinHeap {
  #items = [];
  get size() { return this.#items.length; }
  push(item) {
    this.#items.push(item);
    let index = this.#items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.#items[parent].score <= item.score) break;
      this.#items[index] = this.#items[parent];
      index = parent;
    }
    this.#items[index] = item;
  }
  pop() {
    if (!this.#items.length) return null;
    const first = this.#items[0];
    const last = this.#items.pop();
    if (this.#items.length) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this.#items.length) break;
        const child = right < this.#items.length && this.#items[right].score < this.#items[left].score ? right : left;
        if (this.#items[child].score >= last.score) break;
        this.#items[index] = this.#items[child];
        index = child;
      }
      this.#items[index] = last;
    }
    return first;
  }
}
