import assert from 'node:assert/strict';
import test from 'node:test';
import { ClipPlayer, validateAnimationManifest } from '../src/render/clipPlayer.js';
import { AnimationAdapter, normalizePresentationEvent } from '../src/render/animationAdapter.js';

const manifest = {
  schema_version: 1,
  character_id: 'chr_bunbo_holinh',
  skin_id: 'default',
  asset_version: '0.1.0',
  atlas: 'assets/test-atlas.png',
  clips: {
    idle: { loop: true, fps: 10, directions: { S: { frames: ['idle_0', 'idle_1'], anchor_normalized: [0.5, 0.9], events: [] } } },
    hit: { loop: false, fps: 10, directions: { S: { frames: ['hit_0', 'hit_1'], anchor_normalized: [0.5, 0.9], events: [] } } },
    defeat: { loop: false, fps: 10, directions: { S: { frames: ['defeat_0'], anchor_normalized: [0.5, 0.9], events: [] } } },
  },
};

test('manifest validator accepts valid frame references and rejects missing ones', () => {
  const frameIds = new Set(['idle_0', 'idle_1', 'hit_0', 'hit_1', 'defeat_0']);
  assert.deepEqual(validateAnimationManifest(manifest, frameIds), { valid: true, errors: [] });
  const invalid = validateAnimationManifest(manifest, new Set(['idle_0']));
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => error.includes('missing frame')));
});

test('clip player advances frames and loops without wall-clock dependencies', () => {
  const player = new ClipPlayer(manifest);
  assert.equal(player.snapshot().frameId, 'idle_0');
  assert.equal(player.advance(100).frameId, 'idle_1');
  assert.equal(player.advance(100).frameId, 'idle_0');
});

test('one-shot clips complete and return to the idle fallback', () => {
  const player = new ClipPlayer(manifest);
  assert.equal(player.play('hit'), true);
  const completed = player.advance(200);
  assert.equal(completed.completedClip, 'hit');
  assert.equal(player.snapshot().clipId, 'idle');
});

test('higher priority clips interrupt lower priority one-shots only', () => {
  const player = new ClipPlayer(manifest);
  player.play('hit');
  assert.equal(player.play('idle'), false);
  assert.equal(player.play('defeat'), true);
  assert.equal(player.snapshot().clipId, 'defeat');
});

test('missing clips resolve to placeholder or configured fallback without throwing', () => {
  const player = new ClipPlayer(manifest);
  assert.equal(player.play('ultimate_01'), true);
  assert.equal(player.snapshot().clipId, 'idle');
  assert.equal(player.snapshot().missingClip, true);
  player.setDirection('E');
  assert.equal(player.snapshot().requestedClipId, 'ultimate_01');
  const noManifest = new ClipPlayer(null);
  assert.equal(noManifest.snapshot().frameId, 'placeholder:idle');
  assert.equal(noManifest.snapshot().missingClip, true);
});

test('reduced motion keeps a stable frame when time advances', () => {
  const player = new ClipPlayer(manifest, { reducedMotion: true });
  player.play('hit');
  const firstFrame = player.snapshot().frameId;
  player.advance(500);
  assert.equal(player.snapshot().frameId, firstFrame);
});

test('presentation event normalization preserves optional IDs without inventing context', () => {
  const normalized = normalizePresentationEvent({ type: 'hit_resolved', seq: 4, payload: { target_id: 'target' } });
  assert.equal(normalized.target_id, 'target');
  assert.equal(normalized.battle_id, null);
  assert.equal(normalizePresentationEvent({ type: 'invalid', payload: {} }), null);
});

test('adapter maps cast and hit events to source/target clips and deduplicates seq', () => {
  const eventTarget = new EventTarget();
  const adapter = new AnimationAdapter({ eventTarget, manifests: { chr_bunbo_holinh: manifest } });
  adapter.registerActor({ actorId: 'hero', characterId: 'chr_bunbo_holinh', team: 'player', x: 10, y: 20 });
  adapter.registerActor({ actorId: 'mob', characterId: 'chr_bunbo_holinh', team: 'enemy', x: 40, y: 20 });
  const details = [];
  adapter.addEventListener('presentation-event', ({ detail }) => details.push(detail));

  const cast = { type: 'cast_started', seq: 20, tick: 3, source_id: 'hero', payload: { ability_id: 'hero_ultimate' } };
  eventTarget.dispatchEvent(new CustomEvent('game-event', { detail: cast }));
  assert.equal(adapter.getActorState('hero').animation.requestedClipId, 'ultimate_01');
  assert.equal(adapter.getActorState('hero').animation.clipId, 'idle');
  assert.equal(adapter.getActorState('hero').animation.missingClip, true);

  const hit = { type: 'hit_resolved', seq: 21, tick: 4, source_id: 'hero', target_id: 'mob', payload: { damage: 240 } };
  eventTarget.dispatchEvent(new CustomEvent('game-event', { detail: hit }));
  assert.equal(adapter.getActorState('mob').animation.clipId, 'hit');
  eventTarget.dispatchEvent(new CustomEvent('game-event', { detail: hit }));
  assert.equal(details.length, 2);
  adapter.destroy();
});

test('adapter changes presentation state only and respects dead actor state', () => {
  const eventTarget = new EventTarget();
  const adapter = new AnimationAdapter({ eventTarget, manifests: { chr_bunbo_holinh: manifest } });
  const battleState = { hp: 100, gold: 3 };
  adapter.registerActor({ actorId: 'hero', characterId: 'chr_bunbo_holinh', team: 'player', alive: true });
  eventTarget.dispatchEvent(new CustomEvent('game-event', { detail: {
    type: 'hit_resolved', seq: 1, source_id: 'hero', target_id: 'hero', payload: { damage: 50 },
  } }));
  assert.deepEqual(battleState, { hp: 100, gold: 3 });
  eventTarget.dispatchEvent(new CustomEvent('game-event', { detail: {
    type: 'actor_died', seq: 2, payload: { actor_id: 'hero' },
  } }));
  assert.equal(adapter.getActorState('hero').animation.clipId, 'defeat');
  adapter.destroy();
});

test('adapter rejects malformed manifests and warns without failing initialization', () => {
  const warnings = [];
  const adapter = new AnimationAdapter({ manifests: { chr_bunbo_holinh: { schema_version: 99 } }, onWarning: (message) => warnings.push(message) });
  adapter.registerActor({ actorId: 'hero', characterId: 'chr_bunbo_holinh' });
  assert.equal(adapter.getActorState('hero').animation.frameId, 'placeholder:idle');
  assert.equal(warnings.length, 2);
  adapter.destroy();
});

test('scene retention removes stale actor views and clip players', () => {
  const adapter = new AnimationAdapter({ manifests: { chr_bunbo_holinh: manifest } });
  adapter.registerActor({ actorId: 'hero', characterId: 'chr_bunbo_holinh' });
  adapter.registerActor({ actorId: 'enemy', characterId: 'chr_bunbo_holinh' });
  adapter.retainActors(['hero']);
  assert.ok(adapter.getActorState('hero'));
  assert.equal(adapter.getActorState('enemy'), null);
  adapter.destroy();
});

test('non-actor events produce explicit scene, boss and trap presentation cues', () => {
  const eventTarget = new EventTarget();
  const adapter = new AnimationAdapter({ eventTarget });
  const cues = [];
  adapter.addEventListener('presentation-event', ({ detail }) => cues.push(...detail.actions.map((action) => action.cue).filter(Boolean)));
  for (const [seq, type, payload] of [
    [30, 'route_changed', { map: 'forest' }],
    [31, 'boss_phase_changed', { phase: 2 }],
    [32, 'trap_revealed', { card_id: 'card_trap_01' }],
  ]) eventTarget.dispatchEvent(new CustomEvent('game-event', { detail: { type, seq, payload } }));
  assert.deepEqual(cues, ['scene_transition', 'boss_phase', 'trap_reveal']);
  adapter.destroy();
});