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

test('keeps the legacy grid-sheet path when no atlas frame map is loaded', () => {
  const renderer = new SpriteRenderer();
  const image = { complete: true, naturalWidth: 128, naturalHeight: 128 };
  renderer.sheets.set('chr_test', { image, frameWidth: 32, frameHeight: 32 });
  const context = createContext();

  assert.equal(renderer.drawSprite(context, 'chr_test', { clipId: 'walk', frameIndex: 1 }, 0, 0), true);
  const draw = context.calls.find(([name]) => name === 'drawImage');
  assert.deepEqual(draw.slice(1, 6), [image, 32, 32, 32, 32]);
});