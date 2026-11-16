import assert from 'node:assert/strict';
import test from 'node:test';
import { playGachaCinematic, shouldPlayGachaCinematic } from '../src/shell/gachaCinematicDialog.js';
import { planGachaCinematic } from '../src/render/gachaCinematic.js';
import { spiritIllustration } from '../src/render/cardArtwork.js';
import { META } from '../src/modes/metaProgress.js';

function playback(t) {
  const prior = Object.fromEntries(['document','requestAnimationFrame','cancelAnimationFrame'].map(k => [k, globalThis[k]]));
  t.after(() => { for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } });
  const frames = new Map(); let id = 0;
  globalThis.document = Object.assign(new EventTarget(), { hidden: false });
  globalThis.requestAnimationFrame = fn => { frames.set(++id, fn); return id; };
  globalThis.cancelAnimationFrame = key => frames.delete(key);
  const classes = { add() {}, remove() {} };
  const button = new EventTarget(); button.focus = () => {};
  const close = { hidden: false, focus() {} };
  const context = new Proxy({}, { get(_, key) { return key.startsWith('create') ? () => ({ addColorStop() {} }) : () => {}; }, set() { return true; } });
  const canvas = { width: 960, height: 540, clientWidth: 960, clientHeight: 540, getContext: () => context };
  const status = { textContent: '' };
  const stage = { removed: false, remove() { this.removed = true; }, querySelector: s => s === 'canvas' ? canvas : s === 'button' ? button : status };
  const header = { classList: classes, querySelector: () => close };
  const dialog = new EventTarget();
  Object.assign(dialog, { open: true, isConnected: true, dataset: {}, classList: classes,
    insertAdjacentHTML() {}, querySelector: s => s === '.story-heading' ? header : stage });
  return { dialog, button, stage, frames, tick(now) { const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn(now)); } };
}

const receipt = count => ({ items: Array.from({ length: count }, (_, i) => ({ id: META.characters[i].id })) });
test('fresh single and ten-pulls have an intro; history and reduced motion bypass it', () => {
  for (const count of [1, 10]) {
    assert.equal(shouldPlayGachaCinematic({ fresh: true, reducedMotion: false, count }), true);
    assert.equal(shouldPlayGachaCinematic({ fresh: false, reducedMotion: false, count }), false);
    assert.equal(shouldPlayGachaCinematic({ fresh: true, reducedMotion: true, count }), false);
  }
});
test('cinematic cards use their settled character splash and actual highest rarity', () => {
  const draw = receipt(10), plan = planGachaCinematic(draw);
  assert.equal(plan.rarity, 'R');
  for (const card of plan.cards) assert.equal(card.art, spiritIllustration(card.id).preview);
});
test('ten-pull starts immediately and finishes on time even when artwork never loads', t => {
  const view = playback(t); let finished = 0;
  playGachaCinematic(view.dialog, receipt(10), { renderer: { loadImage: () => new Promise(() => {}) }, playCue() {}, reducedMotion: () => false, onComplete: () => finished++ });
  assert.equal(view.frames.size, 1);
  for (let time = 0; time < 7350; time += 50) view.tick(time);
  assert.equal(finished, 0);
  assert.equal(view.stage.removed, false);
  for (let time = 7350; time <= 7500; time += 50) view.tick(time);
  assert.equal(finished, 1);
  assert.equal(view.frames.size, 0);
  view.button.dispatchEvent(new Event('click'));
  assert.equal(finished, 1);
});
test('skip and close cancel queued frames without duplicate results', t => {
  const view = playback(t); let finished = 0;
  playGachaCinematic(view.dialog, receipt(1), { renderer: { loadImage: () => Promise.resolve(null) }, playCue() {}, reducedMotion: () => false, onComplete: () => finished++ });
  view.button.dispatchEvent(new Event('click'));
  view.button.dispatchEvent(new Event('click'));
  assert.equal(finished, 1);
  assert.equal(view.frames.size, 0);
  view.dialog.dispatchEvent(new Event('close'));
  assert.equal(finished, 1);
});

test('low frame rates keep the planned duration instead of stretching the intro', t => {
  const view = playback(t); let finished = 0;
  playGachaCinematic(view.dialog, receipt(10), { renderer: { loadImage: () => new Promise(() => {}) }, playCue() {}, reducedMotion: () => false, onComplete: () => finished++ });
  for (let time = 0; time <= 10000; time += 1000) view.tick(time);
  assert.equal(finished, 1);
});
test('time in a hidden tab does not skip the intro on return', t => {
  const view = playback(t); let finished = 0;
  playGachaCinematic(view.dialog, receipt(10), { renderer: { loadImage: () => new Promise(() => {}) }, playCue() {}, reducedMotion: () => false, onComplete: () => finished++ });
  view.tick(0); view.tick(1000);
  document.hidden = true; document.dispatchEvent(new Event('visibilitychange')); view.tick(10000);
  document.hidden = false; document.dispatchEvent(new Event('visibilitychange')); view.tick(20000);
  assert.equal(finished, 0);
  view.tick(29000);
  assert.equal(finished, 1);
});
