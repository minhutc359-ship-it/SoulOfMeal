import assert from 'node:assert/strict';
import test from 'node:test';
import { SpriteRenderer } from '../src/render/spriteRenderer.js';

function createContext() {
  const calls = [];
  return {
    calls,
    save() {},
    restore() {},
    translate(...args) { calls.push(['translate', ...args]); },
    scale(...args) { calls.push(['scale', ...args]); },
    transform(...args) { calls.push(['transform', ...args]); },
    drawImage(...args) { calls.push(['drawImage', ...args]); },
  };
}

test('draws the atlas rectangle selected by frame ID and normalized anchor', () => {
  const renderer = new SpriteRenderer();
  const image = { complete: true, naturalWidth: 128, naturalHeight: 128 };
  renderer.sheets.set('chr_test', {
    image,
    frames: {
      walk_01: { x: 16, y: 24, width: 32, height: 48, sourceWidth: 32, sourceHeight: 48, offsetX: 0, offsetY: 0 },
    },
  });
  const context = createContext();

  assert.equal(renderer.drawSprite(context, 'chr_test', {
    frameId: 'walk_01',
    anchor: [0.5, 0.9],
  }, 100, 120, { scale: 2 }), true);

  const draw = context.calls.find(([name]) => name === 'drawImage');
  assert.deepEqual(draw.slice(1), [image, 16, 24, 32, 48, -32, -86.4, 64, 96]);
});

test('returns false for a missing or out-of-bounds atlas frame', () => {
  const renderer = new SpriteRenderer();
  renderer.sheets.set('chr_test', {
    image: { complete: true, naturalWidth: 64, naturalHeight: 64 },
    frames: {
      broken: { x: 60, y: 0, width: 8, height: 8, sourceWidth: 8, sourceHeight: 8, offsetX: 0, offsetY: 0 },
    },
  });
  const context = createContext();

  assert.equal(renderer.drawSprite(context, 'chr_test', { frameId: 'missing' }, 0, 0), false);
  assert.equal(renderer.drawSprite(context, 'chr_test', { frameId: 'broken' }, 0, 0), false);
  assert.equal(context.calls.some(([name]) => name === 'drawImage'), false);
});

test('the chibi rig joins its skin bands at the same coordinates and pins the ground anchor', () => {
  const renderer = new SpriteRenderer();
  const hero = 'chr_bunbo_holinh';
  const image = { complete: true, naturalWidth: 160, naturalHeight: 160 };
  renderer.sheets.set(hero, {
    image,
    frames: { pose: { x: 0, y: 0, width: 160, height: 160, sourceWidth: 160, sourceHeight: 160, offsetX: 0, offsetY: 0 } },
  });
  const context = createContext();
  const pose = { frameId: 'pose', anchor: [.5, .9], direction: 'E', requestedClipId: 'attack_a', motionPhase: .625 };
  renderer.drawSprite(context, hero, pose, 30, 60);
  const transforms = context.calls.filter(([name]) => name === 'transform').map(call => call.slice(1));
  const heights = context.calls.filter(([name]) => name === 'drawImage').map(call => call[5]);
  assert.equal(transforms.length, 4);
  assert.equal(heights.reduce((sum, value) => sum + value, 0), 160);
  for (let i = 0; i < transforms.length - 1; i++) {
    const [, , shear, slope, x, y] = transforms[i];
    assert.ok(Math.abs(x + shear * heights[i] - transforms[i + 1][4]) < 1e-8);
    assert.ok(Math.abs(y + slope * heights[i] - transforms[i + 1][5]) < 1e-8);
  }
  assert.deepEqual(transforms.at(-1), [1, 0, 0, 1, -80, 0]);

  const reduced = createContext();
  renderer.drawSprite(reduced, hero, { ...pose, motionPhase: null }, 30, 60);
  assert.equal(reduced.calls.filter(([name]) => name === 'drawImage').length, 1);
});

test('keeps the legacy grid-sheet path when no atlas frame map is loaded', () => {
  const renderer = new SpriteRenderer();
  const image = { complete: true, naturalWidth: 128, naturalHeight: 128 };
  renderer.sheets.set('chr_test', { image, frameWidth: 32, frameHeight: 32 });
  const context = createContext();

  assert.equal(renderer.drawSprite(context, 'chr_test', { clipId: 'walk', frameIndex: 1 }, 0, 0), true);
  const draw = context.calls.find(([name]) => name === 'drawImage');
  assert.deepEqual(draw.slice(1, 6), [image, 32, 32, 32, 32]);
});
