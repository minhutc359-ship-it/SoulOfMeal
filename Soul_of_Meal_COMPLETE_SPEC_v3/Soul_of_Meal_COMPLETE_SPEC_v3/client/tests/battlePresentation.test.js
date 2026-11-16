import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DuelEffects } from '../src/render/duelEffects.js';
import { ChessReplay } from '../src/render/chessReplay.js';
import { AnimationAdapter } from '../src/render/animationAdapter.js';
import { tcgPresentationPending } from '../src/render/presentationState.js';
import { battleResultCover, bindBattleResultCover } from '../src/shell/battleResult.js';

test('both result illustrations are real packaged WebP files with recorded provenance', () => {
  const provenance = JSON.parse(readFileSync(new URL('../../docs/02_art/ORIGINAL_ART_SOURCES.json', import.meta.url)));
  for (const outcome of ['victory', 'defeat']) {
    const image = readFileSync(new URL(`../assets/original/ui/battle-${outcome}.webp`, import.meta.url));
    assert.equal(image.toString('ascii', 0, 4), 'RIFF');
    assert.equal(image.toString('ascii', 8, 12), 'WEBP');
    assert.ok(provenance.sources[`battle_${outcome}`].source_sha256);
  }
});

const clip = (id, frames = 10) => ({ loop: id === 'idle', fps: 10,
  directions: { S: { frames: Array.from({ length: frames }, (_, i) => `${id}_${i}`), anchor_normalized: [.5, .9] } } });
const manifest = { schema_version: 1, character_id: 'hero', skin_id: 'default', asset_version: '1', atlas: 'test.png',
  clips: Object.fromEntries(['idle', 'attack_a', 'attack_b', 'skill_01', 'hit', 'defeat', 'victory'].map(id => [id, clip(id)])) };

test('TCG waits for actual contact and its impact even when the contact frame arrives late', () => {
  const effects = new DuelEffects({});
  const event = { battle_id: 'final', payload: { element: 'fire' } };
  effects.attacks.push({ event, from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, now: 0, contact: 100 });
  const state = { effects, cards: { pending: () => false }, impacts: new Map(), cues: [] };
  assert.equal(tcgPresentationPending('final', 500, state), true);
  let hits = 0;
  effects.paint(null, 'final', 500, false, () => hits++);
  assert.equal(hits, 1);
  assert.equal(tcgPresentationPending('final', 500, state), true);
  effects.paint(null, 'final', 2000, false, () => hits++);
  assert.equal(hits, 1);
  assert.equal(tcgPresentationPending('final', 2000, state), false);
});

test('TCG also waits for a card flight, death number, trap and cut-in; another match never blocks', () => {
  let flying = true;
  const state = { effects: new DuelEffects({}), cards: { pending: () => flying },
    impacts: new Map([['unit', { matchId: 'final', expires: 700 }]]),
    cues: [{ matchId: 'final', expires: 1450 }, { matchId: 'previous', expires: 9000 }] };
  assert.equal(tcgPresentationPending('final', 100, state), true);
  flying = false;
  assert.equal(tcgPresentationPending('final', 800, state), true);
  assert.equal(tcgPresentationPending('final', 1450, state), false);
});

test('Adventure keeps the final attack before victory and holds a settled defeat without restarting it', () => {
  const adapter = new AnimationAdapter({ manifests: { hero: manifest } });
  adapter.registerActor({ actorId: 'hero', characterId: 'hero', team: 'player', alive: true });
  adapter.handleEvent({ seq: 1, type: 'attack_started', source_id: 'hero', payload: { clip_id: 'attack_a' } });
  adapter.handleEvent({ seq: 2, type: 'battle_finished', payload: { won: true } });
  assert.equal(adapter.getActorState('hero').animation.requestedClipId, 'attack_a');
  assert.equal(adapter.pendingActions(), true);
  adapter.advance(900);
  assert.equal(adapter.pendingActions(), true);
  adapter.advance(100);
  assert.equal(adapter.getActorState('hero').animation.requestedClipId, 'victory');
  assert.equal(adapter.pendingActions(), false);
  adapter.handleEvent({ seq: 3, type: 'actor_died', target_id: 'hero', payload: {} });
  adapter.advance(1000);
  for (let i = 0; i < 5; i++) {
    adapter.syncMotion('hero', { alive: false });
    adapter.advance(100);
    assert.equal(adapter.getActorState('hero').animation.requestedClipId, 'defeat');
    assert.equal(adapter.getActorState('hero').animation.motionPhase, 1);
    assert.equal(adapter.pendingActions(), false);
  }
});

function replay(type, reducedMotion = false, sheets = new Map()) {
  const actor = (actorId, team) => ({ actorId, id: actorId, team, x: 1, y: 1, hp: 100, maxHp: 100, element: 'fire', job: 'mage' });
  const combat = { tick: 76, startActors: [actor('hero', 'player'), actor('enemy', 'enemy')], events: [
    { tick: 76, type, source_id: 'hero', target_id: 'enemy', payload: { hp: type === 'ability' ? 10 : 0, damage: 100, amount: 10, skill: true } },
  ] };
  return new ChessReplay(combat, { sheets }, reducedMotion);
}

for (const reduced of [false, true]) test(`Chess waits beyond the old 420ms tail for the final impact (reduced=${reduced})`, () => {
  for (const type of ['hit_resolved', 'ability']) {
    const view = replay(type, reduced);
    assert.equal(view.advance(view.duration, () => {}), false);
    assert.equal(view.advance(.43, () => {}), false);
    assert.ok(view.impacts.length);
    assert.equal(view.advance(.2, () => {}), true);
    assert.equal(view.impacts.length, 0);
  }
});

test('Chess waits for longer character action clips after impact has faded', () => {
  const view = replay('hit_resolved', false, new Map([['hero', { manifest }]]));
  view.advance(view.duration - .1, () => {});
  assert.equal(view.advance(.1, () => {}), false);
  assert.equal(view.advance(.63, () => {}), false);
  assert.equal(view.advance(.3, () => {}), true);
});

test('the illustrated result opens details exactly once and focuses the existing reward action', () => {
  const cover = new EventTarget(); let focused = 0, removed = 0;
  cover.focus = () => {}; cover.hidden = false;
  const details = { hidden: true, querySelector: selector => selector === 'button' ? { focus: () => focused++ } : null };
  const dialog = { querySelector: selector => selector === '[data-result-continue]' ? cover : details,
    classList: { remove: () => removed++ } };
  bindBattleResultCover(dialog);
  assert.equal(details.hidden, true);
  cover.dispatchEvent(new Event('click'));
  cover.dispatchEvent(new Event('click'));
  assert.equal(details.hidden, false);
  assert.equal(cover.hidden, true);
  assert.equal(focused, 1);
  assert.equal(removed, 1);
  for (const result of ['victory', 'defeat', 'draw']) {
    assert.match(battleResultCover(result), /<button type="button"/);
    assert.match(battleResultCover(result), /battle-(victory|defeat)\.webp/);
  }
});

test('tapping the result image continues directly through the existing primary action once', () => {
  const cover = new EventTarget(); cover.focus = () => {};
  let continued = 0, closed = 0;
  const details = { querySelector: selector => selector.startsWith('[data-battle-result]') ? { click: () => continued++ } : null };
  bindBattleResultCover({ querySelector: selector => selector === '[data-result-continue]' ? cover : details,
    close: () => closed++ });
  cover.dispatchEvent(new Event('click'));
  cover.dispatchEvent(new Event('click'));
  assert.equal(continued, 1);
  assert.equal(closed, 1);
});
