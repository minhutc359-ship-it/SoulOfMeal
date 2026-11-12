import assert from 'node:assert/strict';
import test from 'node:test';
import { BoardSprites } from '../src/render/boardSprites.js';
import { ClipPlayer } from '../src/render/clipPlayer.js';
import { DuelEffects } from '../src/render/duelEffects.js';
import { ChessReplay } from '../src/render/chessReplay.js';

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

test('TCG contact fires once after the trail and pending effects clear when a duel is left', t => {
  const css = globalThis.CSS;
  globalThis.CSS = { escape: value => value };
  t.after(() => { globalThis.CSS = css; });
  const rect = { left: 0, top: 0, width: 200, height: 100 };
  const node = { querySelector: () => null, getBoundingClientRect: () => rect };
  const field = { querySelector: () => node, getBoundingClientRect: () => rect };
  const duel = new DuelEffects({});
  const event = { battle_id: 'duel', source_id: 'unit', target_id: 'enemy', payload: { target_player: 1 } };
  const contacts = [];
  const callback = detail => contacts.push(detail);
  const due = duel.queue(field, event, 100, false);
  duel.paint(null, 'duel', due - 1, false, callback);
  assert.equal(contacts.length, 0);
  duel.paint(null, 'duel', due, false, callback);
  duel.paint(null, 'duel', due + 10, false, callback);
  assert.deepEqual(contacts, [event]);
  duel.queue(field, event, 350, false);
  duel.paint(null, 'new-duel', 600, false, callback);
  assert.deepEqual(contacts, [event]);
  assert.equal(duel.queue(field, event, 625, true), 625);
});

test('Auto Chess plays an attack lead once and makes contact on the recorded tick', () => {
  const startActors = [
    { actorId: 'p', id: 'chr_bunbo_holinh', x: 1, y: 3, team: 'player', job: 'fighter', hp: 200, element: 'fire' },
    { actorId: 'e', id: 'mob_mushroom_01', x: 1, y: 4, team: 'enemy', hp: 200, element: 'wood' },
  ];
  const events = [{ type: 'hit_resolved', source_id: 'p', target_id: 'e', tick: 50, payload: { hp: 150, damage: 50 } }];
  const replay = new ChessReplay({ tick: 100, startActors, events }, { sheets: new Map() }, false);
  const heard = [];
  const onCue = cue => heard.push(cue.type);
  replay.advance(1.17, onCue);
  replay.advance(.08, onCue);
  assert.deepEqual(heard, ['attack_started']);
  assert.equal(replay.actors.get('e').hp, 200);
  replay.advance(.09, onCue);
  assert.deepEqual(heard, ['attack_started', 'hit_resolved']);
  assert.equal(replay.actors.get('e').hp, 150);
});

test('board figures keep idle progress on rerender and play windup before a simultaneous counterhit', () => {
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
  assert.deepEqual(drawn, ['idle_a', 'idle_a']);
  canvas = makeCanvas();
  board.paint(host, .18, 260, false);
  assert.equal(drawn.at(-1), 'idle_b');
  board.cue('m:1', 'hit', 436, 7);
  board.cue('m:1', 'attack_a', 261, 7);
  board.cue('m:1', 'hit', 437, 7);
  board.paint(host, .016, 278, false);
  assert.equal(drawn.at(-1), 'attack_a');
  board.paint(host, .016, 436, false);
  assert.equal(drawn.at(-1), 'hit_a');

  board.clear();
  canvas = makeCanvas();
  board.cue('m:1', 'attack_a', 450, 8);
  board.paint(host, .4, 470, true);
  assert.equal(drawn.at(-1), 'idle_a');
});
