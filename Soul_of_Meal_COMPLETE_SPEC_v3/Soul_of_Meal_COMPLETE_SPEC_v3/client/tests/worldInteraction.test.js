import assert from 'node:assert/strict';
import test from 'node:test';
import village from '../../examples/maps/village.json' with { type: 'json' };
import { createDefaultSave } from '../src/core/save.js';
import { createAdventureState, interactAdventure, nearestInteraction, setAdventureInput, stepAdventure } from '../src/modes/adventure.js';
import { collidesWithWorld, findAdventurePath, hasClearLine, moveWithCollision } from '../src/modes/adventureNavigation.js';
import { ADVENTURE_MAP_KEYS, getAdventureMap } from '../src/modes/mapCatalog.js';

const walkable = ({ x, y }) => !collidesWithWorld('village', x, y);

test('all exploration maps have solid geometry and walkable routes to every interaction', () => {
  for (const key of ADVENTURE_MAP_KEYS) {
    const map = getAdventureMap(null, key);
    const radius = map.world.player_radius;
    assert.ok(map.collision.obstacles.length > 0, key);
    for (const destination of map.interactables) {
      assert.equal(collidesWithWorld(key, destination.x, destination.y, radius), false, destination.id);
      const path = findAdventurePath(key, map.world.spawn, destination, radius);
      assert.ok(path.length, destination.id);
      const last = path.at(-1);
      assert.ok(Math.hypot(last.x - destination.x, last.y - destination.y) < 1, destination.id);
    }
  }
});

test('north wall stops a swept foot hitbox on both sides of the gate', () => {
  for (const x of [...Array.from({ length: 10 }, (_, i) => 244 + i * 18), ...Array.from({ length: 10 }, (_, i) => 537 + i * 31)]) {
    const end = moveWithCollision('village', x, 307, 0, -470);
    assert.ok(end.y >= 110 && end.blockedY && walkable(end), JSON.stringify({ x, end }));
  }
  const gate = moveWithCollision('village', 485, 307, 0, -470);
  assert.equal(gate.y, 70);
  assert.ok(walkable(gate));
});

test('ten seconds of diagonal input cannot push the character into a wall or building', () => {
  const save = createDefaultSave();
  const state = createAdventureState(save);
  Object.assign(state, { x: 480, y: 270 });
  setAdventureInput(state, -.23, -1);
  for (let i = 0; i < 300; i++) {
    stepAdventure(state, save, 1 / 30);
    assert.ok(walkable(state), `frame ${i}: ${state.x}, ${state.y}`);
  }
  assert.ok(state.y >= 105);
});

test('tap-to-move shares the swept collision mask and recovers old saves inside painted walls', () => {
  const start = { x: 479, y: 275 };
  for (const target of [{ x: 485, y: 45 }, { x: 715, y: 81 }, { x: 249, y: 178 }, ...village.interactables]) {
    const route = findAdventurePath('village', start, target);
    assert.ok(route.length, target.id ?? JSON.stringify(target));
    let last = start;
    for (const point of route) {
      assert.ok(hasClearLine('village', last, point), `${JSON.stringify(last)} → ${JSON.stringify(point)}`);
      last = point;
    }
  }
  const save = createDefaultSave();
  Object.assign(save.adventure, { x: 710, y: 82, chestOpened: true });
  const restored = createAdventureState(save);
  assert.ok(walkable(restored));
  assert.equal(restored.map, 'village');
  assert.equal(save.adventure.chestOpened, true);
});

test('forest portal only works in reach of the actual painted gateway', () => {
  const save = createDefaultSave();
  save.adventure.chestOpened = true;
  const state = createAdventureState(save);
  Object.assign(state, { x: 878, y: 260 });
  assert.notEqual(nearestInteraction(state, save)?.id, 'portal');
  Object.assign(state, { x: 485, y: 117 });
  const result = interactAdventure(state, save);
  assert.equal(result.state.map, 'forest');
  assert.equal(collidesWithWorld('forest', result.state.x, result.state.y), false);
});
