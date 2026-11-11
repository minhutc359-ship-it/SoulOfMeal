import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { BattleEffects } from '../src/render/battleEffects.js';
import { validateAnimationManifest } from '../src/render/clipPlayer.js';
import { actorArt, BOSS_ID, combatArt, cutinArt, ELEMENT_ART, effectArt, HERO_NAMES, originalCardArt, preloadGameAssets, TRAVEL_HERO } from '../src/render/spriteAssets.js';

const assetFile = (path) => new URL('../' + path.slice(2), import.meta.url);

test('the playtest preloads original art for the entire roster and all directions of travel', async () => {
  const paths = new Set();
  async function readAsset(path) {
    assert.ok(path.startsWith('./assets/original/'), path);
    paths.add(path);
    return readFile(assetFile(path));
  }
  const manifests = await preloadGameAssets({
    loadImage: readAsset,
    async loadCharacter(id, image, manifestPath) {
      await readAsset(image);
      const manifest = JSON.parse(await readAsset(manifestPath));
      assert.equal(manifest.character_id, id);
      assert.deepEqual(validateAnimationManifest(manifest, new Set(Object.keys(manifest.frames))).errors, []);
      return { loaded: true, manifest };
    },
  });

  assert.deepEqual(Object.keys(manifests).sort(), [TRAVEL_HERO, BOSS_ID, ...Object.keys(HERO_NAMES)].sort());
  for (const [hero, manifest] of Object.entries(manifests)) {
    if (hero === TRAVEL_HERO || hero === BOSS_ID) continue;
    assert.equal(Object.keys(manifest.clips).length, 10);
    assert.ok(paths.has(actorArt(hero)) && paths.has(cutinArt(hero)));
    assert.ok(manifest.clips.ultimate_01.directions.E.frames.length >= 3);
  }
  assert.deepEqual(Object.keys(manifests[TRAVEL_HERO].clips.walk.directions).sort(), ['E', 'N', 'S', 'W']);
  assert.ok(manifests[BOSS_ID].clips.skill_01.directions.W.frames.length >= 2);
  assert.ok(manifests[BOSS_ID].clips.defeat.directions.W.frames.length);
  for (const key of ['boss_warning', 'boss_cleave', 'shield_bubble', 'shield_break']) assert.ok(paths.has(combatArt(key)));
  for (const index of [7, 10, 11, 12, 13, 14, 15, 16, 17, 18]) {
    await readAsset(originalCardArt('card_demo_' + String(index).padStart(2, '0')));
  }
  for (const element of Object.keys(ELEMENT_ART)) {
    assert.ok(paths.has(effectArt(element, 'trail')));
    assert.ok(paths.has(effectArt(element, 'impact')));
  }
});

test('each Adventure ultimate draws its own cut-in and honors reduced motion', () => {
  const drawn = [];
  const renderer = {
    images: { get: () => ({ naturalWidth: 220, naturalHeight: 250 }) },
    drawImage(_context, path) { drawn.push(path); },
  };
  const context = new Proxy({}, {
    get: (_target, key) => key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {},
  });

  for (const [index, hero] of Object.keys(HERO_NAMES).entries()) {
    const element = Object.keys(ELEMENT_ART)[index];
    const battle = { id: 'test', tick: 5, actors: [{ actor_id: hero, element, x: 100, y: 180 }] };
    const effects = new BattleEffects(renderer);
    const cast = { type: 'cast_started', battle_id: 'test', source_id: hero, tick: 5, payload: { element, name: 'Test', windup_ticks: 19 } };
    effects.handle(cast, battle);
    effects.advance(.09);
    drawn.length = 0;
    effects.draw(context, battle, false);
    assert.deepEqual(drawn, [effectArt(element, 'impact'), cutinArt(hero)]);
    drawn.length = 0;
    effects.draw(context, battle, true);
    assert.deepEqual(drawn, [effectArt(element, 'impact')]);
  }
});

test('Adventure projectile uses its element and disappears at the authoritative contact tick', () => {
  const drawn = [];
  const renderer = {
    images: { get: () => ({ naturalWidth: 240, naturalHeight: 80 }) },
    drawImage(_context, path) { drawn.push(path); },
  };
  const context = new Proxy({}, { get: () => () => {} });
  const battle = { id: 'test', tick: 12, actors: [] };
  const effects = new BattleEffects(renderer);
  effects.handle({
    type: 'projectile_spawned', battle_id: 'test', tick: 12,
    payload: { element: 'water', travel_ticks: 10, source: { x: 12, y: 34 }, target: { x: 134, y: 74 } },
  }, battle);
  effects.draw(context, battle, false);
  assert.deepEqual(drawn, [effectArt('water', 'trail')]);
  battle.tick = 22;
  effects.draw(context, battle, false);
  assert.equal(drawn.length, 1);
});
