import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BattleRigClock, SpiritRig, rigMotion } from '../src/render/spiritRig.js';
import { HERO_ID, HERO_NAMES } from '../src/render/spriteAssets.js';
import { adventureViewport, battleActorPoint } from '../src/render/adventureStage.js';

function openRig(id) {
  const dir = id === HERO_ID ? 'bunbo' : id;
  const asset = name => JSON.parse(readFileSync(new URL('../assets/original/rigs/' + dir + '/' + name + '.json', import.meta.url)));
  return new SpiritRig(asset(dir), asset('regions'), { naturalWidth: 448, naturalHeight: 336 });
}

const rig = openRig(HERO_ID);

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
  const windup = clock.motion(battle, hero, animation);
  assert.equal(windup.id, 'ultimate_01');
  assert.ok(Math.abs(windup.phase - .75 * contact / duration) < 1e-9);
  battle.tick = 120;
  hero.action = null;
  assert.equal(clock.contact(battle, 'ultimate_01'), true);
  assert.equal(clock.contact(battle, 'ultimate_01'), false);
  assert.deepEqual(clock.motion(battle, hero, animation), { id: 'ultimate_01', phase: contact / duration });
  assert.deepEqual(clock.motion(battle, hero, { ...animation, motionPhase: null }), { id: 'idle', phase: 0 });
  const east = rig.effectPoint('ultimate_01', 400, 290, 'E', .88);
  const west = rig.effectPoint('ultimate_01', 400, 290, 'W', .88);
  assert.equal(east.x + west.x, 800);
  assert.equal(east.y, west.y);
  battle.tick += 40;
  assert.deepEqual(clock.motion(battle, hero, animation), { id: 'idle', phase: .2 });
});

test('each of the five spirits has ten clips, independent limbs and mirrored effect sockets', () => {
  const clips = ['idle', 'walk', 'run', 'attack_a', 'attack_b', 'skill_01', 'ultimate_01', 'hit', 'victory', 'defeat'];
  for (const id of Object.keys(HERO_NAMES)) {
    const spirit = openRig(id);
    assert.deepEqual(Object.keys(spirit.clips).sort(), [...clips].sort());
    assert.equal(spirit.slots.length, 12);
    const pose = spirit.pose(spirit.clips.run, .25);
    const joint = name => pose[spirit.bones.findIndex(bone => bone.name === name)];
    assert.notEqual(joint('leg_near').angle, joint('leg_far').angle);
    assert.notEqual(joint('arm_near').angle, joint('arm_far').angle);
    const east = spirit.effectPoint('attack_b', 200, 180, 'E', .88);
    const west = spirit.effectPoint('attack_b', 200, 180, 'W', .88);
    assert.ok(Math.abs(east.x + west.x - 400) < 1e-9);
    assert.equal(east.y, west.y);
  }
  const dual = openRig('chr_caphe_davu');
  assert.notEqual(dual.clips.attack_a.socket, dual.clips.attack_b.socket);
});

test('a restored ranged action recovers after launch, and defeat remains at the final pose', () => {
  const mage = openRig('chr_pho_lamvu');
  const clock = new BattleRigClock(mage, 30);
  const battle = { tick: 91, phase: 'battle_running' };
  const actor = { alive: true, action: { sourceKind: 'basic', clip: 'attack_a', launchTick: 90, hitTick: 102, windup: 7 } };
  const animation = { requestedClipId: 'attack_a', motionPhase: .4 };
  const { duration, contact } = mage.clips.attack_a;
  assert.ok(Math.abs(clock.motion(battle, actor, animation).phase - (contact + 1/30) / duration) < 1e-9);
  assert.equal(rigMotion(mage.clips.attack_a, .4, { start: 0, contact: 200 }, 200), contact / duration);
  assert.equal(rigMotion(mage.clips.attack_a, null, { start: 0, contact: 200 }, 200), 0);
  actor.alive = false;
  assert.deepEqual(clock.motion(battle, actor, animation), { id: 'defeat', phase: 0 });
  battle.tick += 40;
  assert.deepEqual(clock.motion(battle, actor, { requestedClipId: 'idle', motionPhase: .9 }), { id: 'defeat', phase: 1 });
});

test('the party plants a foot during gait and enters an attack from the previous pose', () => {
  for (const id of Object.keys(HERO_NAMES)) {
    const spirit = openRig(id);
    for (const gait of ['walk', 'run']) {
      for (let frame = 0; frame <= 16; frame++) {
        const pose = spirit.groundedPose(spirit.clips[gait], { id: gait, phase: frame / 16 });
        assert.ok(Math.abs(spirit.lowestFoot(pose) - spirit.floor) < 1e-9);
      }
    }
  }
  const clock = new BattleRigClock(rig, 30);
  const battle = { tick: 20, wave: 0, phase: 'battle_running' };
  const actor = { alive: true, moving: true };
  const animation = { requestedClipId: 'run', motionPhase: .38 };
  const run = clock.frame(battle, actor, animation);
  battle.tick++;
  actor.moving = false;
  actor.action = { clip: 'attack_a', launchTick: 28, windup: 7 };
  const windup = clock.frame(battle, actor, animation);
  assert.equal(windup.transition.mix, 0);
  assert.deepEqual(rig.groundedPose(rig.clips.attack_a, windup), rig.groundedPose(rig.clips.run, run));
  battle.tick = actor.action.launchTick;
  const contact = clock.frame(battle, actor, animation, .5);
  assert.equal(contact.transition, undefined);
  assert.equal(contact.phase, rig.clips.attack_a.contact / rig.clips.attack_a.duration);
});

test('portrait arena separates melee silhouettes and keeps the retreat boundary accurate', () => {
  const view = adventureViewport(true, false, true);
  assert.ok(view.left > 0 && view.width < 960);
  assert.deepEqual(adventureViewport(false, false, true), { left: 0, top: 0, width: 960, height: 540 });
  const player = { team: 'player', x: 460, y: 337 };
  const fighter = { ...player, role: 'fighter', homeX: 280, homeY: 338 };
  const guard = { ...player, role: 'guardian', homeX: 326, homeY: 295 };
  const assassin = { ...player, role: 'assassin', homeX: 244, homeY: 396 };
  assert.ok(battleActorPoint(fighter).x < battleActorPoint(guard).x - 40);
  assert.ok(battleActorPoint(assassin).y > battleActorPoint(guard).y + 80);
  assert.ok(battleActorPoint(fighter, 1, 450).x > 450);
  assert.deepEqual(battleActorPoint({ team: 'enemy', x: 600, y: 333 }), { x: 600, y: 333 });
});
