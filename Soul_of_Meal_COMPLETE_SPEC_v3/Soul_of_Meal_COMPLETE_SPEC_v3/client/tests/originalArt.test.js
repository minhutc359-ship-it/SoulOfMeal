import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { BattleEffects } from '../src/render/battleEffects.js';
import { validateAnimationManifest } from '../src/render/clipPlayer.js';
import { actorArt, BOSS_ID, combatArt, cutinArt, ELEMENT_ART, effectArt, HERO_ID, HERO_NAMES, MONSTER_IDS, originalCardArt, preloadGameAssets, TRAVEL_HERO } from '../src/render/spriteAssets.js';
import { ADVENTURE_OFFERS } from '../src/modes/adventureStore.js';
import { SPIRITS } from '../src/modes/metaProgress.js';
import { portraitRigDefinition, SpiritRig } from '../src/render/spiritRig.js';
import { itemArt } from '../src/render/spriteAssets.js';

const assetFile = (path) => new URL('../' + path.slice(2), import.meta.url);

test('every additional Vị Linh uses a valid articulated rig and the seven offers have art', async () => {
  for (const spirit of Object.values(SPIRITS).filter(item => !Object.hasOwn(HERO_NAMES, item.id))) {
    await readFile(assetFile(actorArt(spirit.id)));
    const rig = new SpiritRig(...portraitRigDefinition(spirit, 240, 330), { naturalWidth: 240, naturalHeight: 330 });
    assert.equal(Object.keys(rig.clips).length, 10);
    assert.notDeepEqual(rig.pose(rig.clips.attack_a, 0), rig.pose(rig.clips.attack_a, .5));
    assert.ok(rig.effectPoint('ultimate_01', 0, 0, 'E', 1));
  }
  for (const id of Object.keys(ADVENTURE_OFFERS)) assert.ok((await readFile(assetFile(itemArt(id)))).length > 1000);
});

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

  assert.deepEqual(Object.keys(manifests).sort(), [TRAVEL_HERO, BOSS_ID, ...MONSTER_IDS, ...Object.keys(HERO_NAMES)].sort());
  for (const [hero, manifest] of Object.entries(manifests)) {
    if (!Object.hasOwn(HERO_NAMES, hero)) continue;
    assert.equal(Object.keys(manifest.clips).length, 10);
    assert.ok(paths.has(actorArt(hero)) && paths.has(cutinArt(hero)));
    assert.ok(manifest.clips.ultimate_01.directions.E.frames.length >= 3);
  }
  assert.deepEqual(Object.keys(manifests[TRAVEL_HERO].clips.walk.directions).sort(), ['E', 'N', 'S', 'W']);
  assert.ok(manifests[BOSS_ID].clips.skill_01.directions.W.frames.length >= 2);
  assert.ok(manifests[BOSS_ID].clips.defeat.directions.W.frames.length);
  for (const id of MONSTER_IDS) {
    const manifest = manifests[id];
    assert.equal(Object.keys(manifest.frames).length, 8);
    assert.equal(manifest.mirror_east_west, true);
    for (const action of ['idle', 'walk', 'attack_a', 'hit', 'defeat']) {
      assert.ok(manifest.clips[action].directions.W.frames.length > 0);
    }
  }
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

test('loading can be retried after required map art is missing', async () => {
  let missing = true;
  const renderer = {
    async loadImage(path) {
      if (missing && path.endsWith('/sanctum.webp')) return null;
      return {};
    },
    async loadCharacter(_id, _image, manifestPath) {
      return { loaded: true, manifest: JSON.parse(await readFile(assetFile(manifestPath))) };
    },
  };
  await assert.rejects(preloadGameAssets(renderer), /Không tải được bản đồ hoặc hoạt ảnh/);
  missing = false;
  assert.ok((await preloadGameAssets(renderer))[HERO_ID]);
});

test('a missing or invalid monster atlas keeps its portrait available in all modes', async () => {
  const sheets = new Map();
  const renderer = {
    sheets,
    async loadImage() { return {}; },
    async loadCharacter(id, _image, manifestPath) {
      const manifest = JSON.parse(await readFile(assetFile(manifestPath)));
      if (id === MONSTER_IDS[0]) manifest.frames = {};
      const entry = { loaded: id !== MONSTER_IDS[1], manifest };
      sheets.set(id, entry);
      return entry;
    },
  };
  const manifests = await preloadGameAssets(renderer);
  assert.ok(manifests[HERO_ID]);
  for (const id of MONSTER_IDS) {
    assert.equal(manifests[id], undefined);
    assert.equal(sheets.has(id), false);
    assert.ok(await readFile(assetFile(actorArt(id))));
  }
});
