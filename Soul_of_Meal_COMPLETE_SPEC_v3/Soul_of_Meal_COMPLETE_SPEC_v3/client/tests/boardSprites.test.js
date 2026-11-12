import assert from 'node:assert/strict';
import test from 'node:test';
import { BoardSprites } from '../src/render/boardSprites.js';
import { ClipPlayer } from '../src/render/clipPlayer.js';

const west = frames => ({ fps: 4, loop: true, directions: { W: { frames } } });
const manifest = {
  mirror_east_west: true,
  clips: { idle: west(['idle_a', 'idle_b']), attack_a: west(['attack_a']), hit: west(['hit_a']) },
};

test('only opted-in monster atlases can mirror to the opposite facing', () => {
  const authored = new ClipPlayer(manifest, { direction: 'W' });
  assert.equal(authored.snapshot().flipX, false);
  authored.setDirection('E');
  assert.equal(authored.snapshot().flipX, true);
  assert.equal(authored.snapshot().frameId, 'idle_a');
  const withoutMirror = new ClipPlayer({ ...manifest, mirror_east_west: false }, { direction: 'E' });
  assert.equal(withoutMirror.snapshot().flipX, false);
});

test('board figures keep their idle progress on rerender and hit wins over attack within one exchange', () => {
  const drawn = [];
  const renderer = {
    sheets: new Map([['mob_mushroom_01', { manifest }]]),
    drawSprite(_context, _id, frame) { drawn.push(frame.frameId); return true; },
  };
  const makeCanvas = () => ({
    dataset: { chibiId: 'mob_mushroom_01', chibiKey: 'm:1', chibiFacing: 'W' },
    getContext: () => ({ clearRect() {} }),
  });
  let canvas = makeCanvas();
  const host = { querySelectorAll: () => [canvas] };
  const board = new BoardSprites(renderer);
  board.paint(host, .04, 40, false);
  board.paint(host, .04, 80, false);
  assert.deepEqual(drawn, ['idle_a']);
  canvas = makeCanvas();
  board.paint(host, .18, 260, false);
  assert.deepEqual(drawn, ['idle_a', 'idle_b']);
  board.cue('m:1', 'hit', 261, 7);
  board.cue('m:1', 'attack_a', 262, 7);
  board.paint(host, .016, 278, false);
  assert.equal(drawn.at(-1), 'hit_a');

  board.clear();
  canvas = makeCanvas();
  board.cue('m:1', 'attack_a', 300, 8);
  board.paint(host, .4, 320, true);
  assert.equal(drawn.at(-1), 'idle_a');
});
