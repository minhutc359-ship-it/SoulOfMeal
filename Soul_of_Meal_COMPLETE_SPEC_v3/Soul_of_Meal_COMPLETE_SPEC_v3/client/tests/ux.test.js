import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createDefaultSave, migrateSave } from '../src/core/save.js';
import { adventureChronicle, chapterForScene } from '../src/modes/adventureStory.js';
import { chapterArt, sceneArt } from '../src/render/spriteAssets.js';
import { bindWorldStick } from '../src/render/worldHud.js';

test('chapter art and dialogue unlock from the saved Adventure story', async () => {
  const fresh = createDefaultSave();
  const initial = adventureChronicle(fresh);
  assert.equal(initial.length, 6);
  assert.ok(initial.every(chapter => chapter.scenes.length === 0));

  fresh.adventure.quest = 'completed';
  fresh.adventure.chapterTwo.stage = 'accepted';
  const chapters = adventureChronicle(migrateSave(fresh));
  assert.deepEqual(chapters.map(chapter => chapter.scenes), [['opening', 'ending'], ['forestOpening'], [], [], [], []]);
  assert.equal(chapterForScene('finaleEnding').number, 6);

  const assets = [...chapters.map(({ number }) => chapterArt(number)), sceneArt('tcg_table'), sceneArt('chess_court')];
  for (const asset of assets) {
    const bytes = await readFile(new URL('../' + asset.slice(2), import.meta.url));
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', asset);
  }
});

test('touch movement ignores other pointers and releases on cancellation', () => {
  class Control extends EventTarget {
    thumb = { style: {} };
    captured = null;
    querySelector() { return this.thumb; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 80, height: 80 }; }
    setPointerCapture(id) { this.captured = id; }
  }

  const stick = new Control();
  const changes = [];
  bindWorldStick(stick, input => changes.push(input));
  function dispatch(type, details) {
    stick.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), details));
  }

  dispatch('pointerdown', { pointerId: 8, button: 0, clientX: 80, clientY: 40 });
  assert.equal(stick.captured, 8);
  assert.deepEqual(changes.at(-1), { x: 1, y: 0 });
  dispatch('pointermove', { pointerId: 12, clientX: 40, clientY: 80 });
  assert.equal(changes.length, 1);
  dispatch('pointermove', { pointerId: 8, clientX: 40, clientY: 40 });
  assert.deepEqual(changes.at(-1), { x: 0, y: 0 });
  dispatch('pointercancel', { pointerId: 8 });
  assert.equal(stick.thumb.style.transform, '');
  assert.equal(changes.at(-1), null);
});

test('Adventure camera fills portrait and landscape while sharing the world-space input transform', async () => {
  const { adventureCamera, battleCamera } = await import('../src/render/adventureStage.js');
  const world = { width: 960, height: 540 };
  const aspect = 390 / 844;
  const first = adventureCamera({ x: 120, y: 310 }, world, 390, 844);
  const second = adventureCamera({ x: 710, y: 310 }, world, 390, 844);
  assert.ok(first.width < world.width);
  assert.equal(first.width / first.height, aspect);
  assert.ok(second.left > first.left);
  const corner = adventureCamera({ x: 960, y: 540 }, world, 390, 844);
  assert.equal(corner.left + corner.width, world.width);
  const wide = adventureCamera({ x: 50, y: 500 }, world, 844, 390);
  assert.equal(wide.top + wide.height, world.height);

  const arena = { left: 52, top: 75, width: 856, height: 425 };
  const battle = battleCamera(arena, 390, 844);
  assert.equal(battle.width / battle.height, aspect);
  assert.ok(battle.left <= arena.left && battle.top <= arena.top);
  assert.ok(battle.left + battle.width >= arena.left + arena.width);
  assert.ok(battle.top + battle.height >= arena.top + arena.height);
});
