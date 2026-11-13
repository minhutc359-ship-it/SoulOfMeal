const EPSILON = 1e-6;
const compiled = new WeakMap();

export function obstaclePoints(obstacle) {
  if (obstacle.type === 'polygon') return obstacle.points;
  const { x, y, width, height } = obstacle;
  return [[x, y], [x + width, y], [x + width, y + height], [x, y + height]];
}

function obstacleAxes(obstacle) {
  if (compiled.has(obstacle)) return compiled.get(obstacle);
  const points = obstaclePoints(obstacle);
  const axes = [[1, 0], [0, 1]];
  if (obstacle.type === 'polygon') {
    for (const [i, [x, y]] of points.entries()) {
      const [nx, ny] = points[(i + 1) % points.length];
      const length = Math.hypot(nx - x, ny - y);
      axes.push([(y - ny) / length, (nx - x) / length]);
    }
  }
  const shape = axes.map(([x, y]) => {
    const values = points.map(([px, py]) => px * x + py * y);
    return { x, y, min: Math.min(...values), max: Math.max(...values), padding: Math.abs(x) + Math.abs(y) };
  });
  compiled.set(obstacle, shape);
  return shape;
}

// Intersect the swept foot box with the convex obstacle's open interior.
export function firstObstacleHit(obstacles, start, dx, dy, radius) {
  let nearest = 1;
  for (const obstacle of obstacles) {
    let enter = 0;
    let exit = nearest;
    for (const axis of obstacleAxes(obstacle)) {
      const origin = start.x * axis.x + start.y * axis.y;
      const step = dx * axis.x + dy * axis.y;
      const low = axis.min - radius * axis.padding;
      const high = axis.max + radius * axis.padding;
      if (Math.abs(step) < EPSILON) {
        if (origin <= low + EPSILON || origin >= high - EPSILON) { exit = 0; break; }
      } else {
        const a = (low - origin) / step;
        const b = (high - origin) / step;
        enter = Math.max(enter, Math.min(a, b));
        exit = Math.min(exit, Math.max(a, b));
        if (enter >= exit) break;
      }
    }
    if (enter < exit) nearest = enter;
  }
  return nearest;
}

export function walkablePoint(map, x, y, radius = map?.world?.player_radius) {
  const world = map?.world;
  return Boolean(world && x >= radius && x <= world.width - radius && y >= radius && y <= world.height - radius
    && firstObstacleHit(map.collision.obstacles, { x, y }, 0, 0, radius) === 1);
}
