import { getAdventureMap } from "./mapCatalog.js";

export const PLAYER_COLLISION_RADIUS = 14;
export const PATH_GRID_SIZE = 24;

export function getAdventureObstacles(mapId, maps) {
  return getAdventureMap(maps, mapId)?.collision?.obstacles ?? [];
}

export function collidesWithWorld(
  mapId,
  x,
  y,
  radius = PLAYER_COLLISION_RADIUS,
  maps,
) {
  const world = getAdventureMap(maps, mapId)?.world;
  if (
    !world ||
    x - radius < 0 ||
    x + radius > world.width ||
    y - radius < 0 ||
    y + radius > world.height
  )
    return true;
  return getAdventureObstacles(mapId, maps).some((obstacle) =>
    circleIntersectsRect(x, y, radius, obstacle),
  );
}

export function moveWithCollision(
  mapId,
  x,
  y,
  deltaX,
  deltaY,
  radius = PLAYER_COLLISION_RADIUS,
  maps,
) {
  const world = getAdventureMap(maps, mapId)?.world;
  if (!world) return { x, y, blockedX: true, blockedY: true };
  const movedX = resolveAxis(mapId, x, y, deltaX, true, radius, maps, world);
  const movedY = resolveAxis(
    mapId,
    movedX,
    y,
    deltaY,
    false,
    radius,
    maps,
    world,
  );
  return {
    x: movedX,
    y: movedY,
    blockedX: Math.abs(movedX - (x + deltaX)) > 0.01,
    blockedY: Math.abs(movedY - (y + deltaY)) > 0.01,
  };
}

export function findAdventurePath(
  mapId,
  start,
  destination,
  radius = PLAYER_COLLISION_RADIUS,
  maps,
) {
  const world = getAdventureMap(maps, mapId)?.world;
  if (!world) return [];
  const columns = Math.ceil(world.width / PATH_GRID_SIZE);
  const rows = Math.ceil(world.height / PATH_GRID_SIZE);
  const startNode = nearestWalkableNode(
    mapId,
    start,
    columns,
    rows,
    radius,
    maps,
    world,
  );
  const endNode = nearestWalkableNode(
    mapId,
    destination,
    columns,
    rows,
    radius,
    maps,
    world,
  );
  if (!startNode || !endNode) return [];

  const startId = nodeId(startNode.column, startNode.row, columns);
  const endId = nodeId(endNode.column, endNode.row, columns);
  if (startId === endId) {
    return [
      collidesWithWorld(mapId, destination.x, destination.y, radius, maps)
        ? nodePoint(endNode.column, endNode.row, world, radius)
        : destination,
    ];
  }

  const open = new MinHeap();
  const cameFrom = new Map();
  const costs = new Map([[startId, 0]]);
  const closed = new Set();
  open.push({
    ...startNode,
    id: startId,
    score: heuristic(startNode, endNode),
  });
  const directions = [
    [-1, 0, 1],
    [1, 0, 1],
    [0, -1, 1],
    [0, 1, 1],
    [-1, -1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [1, 1, Math.SQRT2],
  ];

  while (open.size) {
    const current = open.pop();
    if (closed.has(current.id)) continue;
    if (current.id === endId)
      return reconstructPath(
        mapId,
        cameFrom,
        current,
        columns,
        destination,
        start,
        radius,
        maps,
        world,
      );
    closed.add(current.id);

    for (const [offsetX, offsetY, cost] of directions) {
      const column = current.column + offsetX;
      const row = current.row + offsetY;
      if (column < 0 || column >= columns || row < 0 || row >= rows) continue;
      const point = nodePoint(column, row, world, radius);
      if (collidesWithWorld(mapId, point.x, point.y, radius, maps)) continue;
      if (offsetX && offsetY) {
        const sideA = nodePoint(
          current.column + offsetX,
          current.row,
          world,
          radius,
        );
        const sideB = nodePoint(
          current.column,
          current.row + offsetY,
          world,
          radius,
        );
        if (
          collidesWithWorld(mapId, sideA.x, sideA.y, radius, maps) ||
          collidesWithWorld(mapId, sideB.x, sideB.y, radius, maps)
        )
          continue;
      }
      const neighborId = nodeId(column, row, columns);
      if (closed.has(neighborId)) continue;
      const newCost = costs.get(current.id) + cost;
      if (newCost >= (costs.get(neighborId) ?? Infinity)) continue;
      cameFrom.set(neighborId, current.id);
      costs.set(neighborId, newCost);
      open.push({
        column,
        row,
        id: neighborId,
        score: newCost + heuristic({ column, row }, endNode),
      });
    }
  }
  return [];
}

function resolveAxis(mapId, x, y, delta, horizontal, radius, maps, world) {
  if (!delta) return horizontal ? x : y;
  const current = horizontal ? x : y;
  const other = horizontal ? y : x;
  const proposed = clamp(
    current + delta,
    radius,
    (horizontal ? world.width : world.height) - radius,
  );
  const blocked = getAdventureObstacles(mapId, maps).filter((obstacle) => {
    const rect = inflateRect(obstacle, radius);
    if (horizontal) {
      const crossesObstacle =
        delta > 0
          ? current <= rect.x && proposed > rect.x
          : current >= rect.x + rect.width && proposed < rect.x + rect.width;
      return other > rect.y && other < rect.y + rect.height && crossesObstacle;
    }
    const crossesObstacle =
      delta > 0
        ? current <= rect.y && proposed > rect.y
        : current >= rect.y + rect.height && proposed < rect.y + rect.height;
    return other > rect.x && other < rect.x + rect.width && crossesObstacle;
  });
  if (!blocked.length) return proposed;
  let resolved = proposed;
  for (const obstacle of blocked) {
    const rect = inflateRect(obstacle, radius);
    const low = horizontal ? rect.x : rect.y;
    const high = low + (horizontal ? rect.width : rect.height);
    resolved = delta > 0 ? Math.min(resolved, low) : Math.max(resolved, high);
  }
  return clamp(
    resolved,
    radius,
    (horizontal ? world.width : world.height) - radius,
  );
}

function nearestWalkableNode(
  mapId,
  position,
  columns,
  rows,
  radius,
  maps,
  world,
) {
  const idealColumn = clamp(
    Math.floor(position.x / PATH_GRID_SIZE),
    0,
    columns - 1,
  );
  const idealRow = clamp(Math.floor(position.y / PATH_GRID_SIZE), 0, rows - 1);
  let best = null;
  let bestDistance = Infinity;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const point = nodePoint(column, row, world, radius);
      if (collidesWithWorld(mapId, point.x, point.y, radius, maps)) continue;
      const gridDistance =
        Math.abs(column - idealColumn) + Math.abs(row - idealRow);
      const targetDistance = Math.hypot(
        point.x - position.x,
        point.y - position.y,
      );
      const score = targetDistance + gridDistance * 0.001;
      if (score < bestDistance) {
        best = { column, row };
        bestDistance = score;
      }
    }
  }
  return best;
}

function reconstructPath(
  mapId,
  cameFrom,
  current,
  columns,
  destination,
  start,
  radius,
  maps,
  world,
) {
  const ids = [current.id];
  while (cameFrom.has(ids[0])) ids.unshift(cameFrom.get(ids[0]));
  const points = ids
    .slice(1)
    .map((id) =>
      nodePoint(id % columns, Math.floor(id / columns), world, radius),
    );
  if (
    points.length &&
    !collidesWithWorld(mapId, destination.x, destination.y, radius, maps) &&
    hasClearLine(mapId, points.at(-1), destination, radius, maps)
  )
    points.push(destination);
  if (
    !points.length &&
    Math.hypot(destination.x - start.x, destination.y - start.y) > 1
  )
    points.push(destination);
  return compressPath(points);
}

export function hasClearLine(
  mapId,
  start,
  end,
  radius = PLAYER_COLLISION_RADIUS,
  maps,
) {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const steps = Math.ceil(distance / 6);
  for (let step = 1; step <= steps; step += 1) {
    const ratio = step / steps;
    if (
      collidesWithWorld(
        mapId,
        start.x + (end.x - start.x) * ratio,
        start.y + (end.y - start.y) * ratio,
        radius,
        maps,
      )
    )
      return false;
  }
  return true;
}

export function recoverAdventurePosition(mapId, position, maps) {
  if (
    !collidesWithWorld(
      mapId,
      position.x,
      position.y,
      PLAYER_COLLISION_RADIUS,
      maps,
    )
  )
    return { ...position };
  const world = getAdventureMap(maps, mapId)?.world;
  if (!world) return null;
  const node = nearestWalkableNode(
    mapId,
    position,
    Math.ceil(world.width / PATH_GRID_SIZE),
    Math.ceil(world.height / PATH_GRID_SIZE),
    PLAYER_COLLISION_RADIUS,
    maps,
    world,
  );
  return node
    ? nodePoint(node.column, node.row, world, PLAYER_COLLISION_RADIUS)
    : null;
}

function compressPath(points) {
  if (points.length < 3) return points;
  const result = [points[0]];
  let previousDirection = directionBetween(points[0], points[1]);
  for (let index = 1; index < points.length - 1; index += 1) {
    const nextDirection = directionBetween(points[index], points[index + 1]);
    if (
      nextDirection.x !== previousDirection.x ||
      nextDirection.y !== previousDirection.y
    )
      result.push(points[index]);
    previousDirection = nextDirection;
  }
  result.push(points.at(-1));
  return result;
}

function directionBetween(first, second) {
  return { x: Math.sign(second.x - first.x), y: Math.sign(second.y - first.y) };
}

function nodePoint(column, row, world, radius) {
  return {
    x: Math.min(
      column * PATH_GRID_SIZE + PATH_GRID_SIZE / 2,
      world.width - radius,
    ),
    y: Math.min(
      row * PATH_GRID_SIZE + PATH_GRID_SIZE / 2,
      world.height - radius,
    ),
  };
}

function nodeId(column, row, columns) {
  return row * columns + column;
}

function heuristic(first, second) {
  const dx = Math.abs(first.column - second.column);
  const dy = Math.abs(first.row - second.row);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

function circleIntersectsRect(x, y, radius, rect) {
  const closestX = clamp(x, rect.x, rect.x + rect.width);
  const closestY = clamp(y, rect.y, rect.y + rect.height);
  return (x - closestX) ** 2 + (y - closestY) ** 2 < radius ** 2;
}

function inflateRect(rect, amount) {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
  };
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

class MinHeap {
  #items = [];
  get size() {
    return this.#items.length;
  }
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
        const child =
          right < this.#items.length &&
          this.#items[right].score < this.#items[left].score
            ? right
            : left;
        if (this.#items[child].score >= last.score) break;
        this.#items[index] = this.#items[child];
        index = child;
      }
      this.#items[index] = last;
    }
    return first;
  }
}
