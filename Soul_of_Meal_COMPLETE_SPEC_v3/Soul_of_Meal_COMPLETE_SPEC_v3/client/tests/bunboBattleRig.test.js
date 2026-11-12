import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BattleRigClock, BunBoBattleRig } from '../src/render/bunboBattleRig.js';

const asset = name => JSON.parse(readFileSync(new URL('../assets/original/rigs/bunbo/' + name, import.meta.url)));
const rig = new BunBoBattleRig(asset('bunbo.json'), asset('regions.json'), { naturalWidth: 448, naturalHeight: 336 });

test('Bún Bò has separate hair and limb tracks and draws twelve independently attached parts', () => {
  assert.equal(rig.bones.length, 16);
  const bone = name => rig.bones.findIndex(item => item.name === name);
  const start = rig.pose(rig.clips.run, 0);
  const stride = rig.pose(rig.clips.run, .25);
  assert.notEqual(start[bone('leg_near')].angle, stride[bone('leg_near')].angle);
  assert.notEqual(stride[bone('leg_far')].angle, stride[bone('leg_near')].angle);
  assert.notEqual(stride[bone('hair')].angle, stride[bone('head')].angle);
  const calls = [];
  const context = {
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    drawImage(...args) { calls.push(args); },
  };
  assert.equal(rig.draw(context, { id: 'attack_b', phase: .62 }, 400, 290, 'W', .88), true);
  assert.equal(calls.length, 12);
  assert.equal(new Set(calls.map(([, x, y]) => x + ',' + y)).size, 12);
});

test('a restored windup reaches the sword socket on the impact tick and an area hit starts one recovery', () => {
  const clock = new BattleRigClock(rig, 30);
  const battle = { tick: 114, phase: 'battle_running' };
  const hero = { alive: true, action: { launchTick: 120, windup: 24, sourceKind: 'ultimate' } };
  const animation = { requestedClipId: 'idle', motionPhase: .2 };
  const { duration, contact } = rig.clips.ultimate_01;
  assert.deepEqual(clock.motion(battle, hero, animation), { id: 'ultimate_01', phase: .75 * contact / duration });
  battle.tick = 120;
  hero.action = null;
  assert.equal(clock.contact(battle, 'ultimate_01'), true);
  assert.equal(clock.contact(battle, 'ultimate_01'), false);
  assert.deepEqual(clock.motion(battle, hero, animation), { id: 'ultimate_01', phase: contact / duration });
  assert.deepEqual(clock.motion(battle, hero, { ...animation, motionPhase: null }), { id: 'idle', phase: 0 });
  const east = rig.bladeTip('ultimate_01', 400, 290, 'E', .88);
  const west = rig.bladeTip('ultimate_01', 400, 290, 'W', .88);
  assert.equal(east.x + west.x, 800);
  assert.equal(east.y, west.y);
  battle.tick += 40;
  assert.deepEqual(clock.motion(battle, hero, animation), { id: 'idle', phase: .2 });
});
