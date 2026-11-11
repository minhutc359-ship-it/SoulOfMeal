import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { GameAudio } from '../src/core/audio.js';
import { customSoundtrack, DEFAULT_SOUNDTRACKS, resolveSoundScene } from '../src/core/soundScenes.js';

test('the eight configurable tracks map to reachable scenes and their built-in fallbacks exist', async () => {
  const config = JSON.parse(await readFile(new URL('../assets/audio/soundtracks.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(config), Object.keys(DEFAULT_SOUNDTRACKS));
  await Promise.all(Object.values(DEFAULT_SOUNDTRACKS).map(file => readFile(new URL('../assets/audio/' + file, import.meta.url))));
  assert.equal(resolveSoundScene('title'), 'login');
  assert.equal(resolveSoundScene('home'), 'village');
  assert.equal(resolveSoundScene('adventure', { map: 'village' }), 'village');
  assert.equal(resolveSoundScene('adventure', { map: 'forest' }), 'forest');
  assert.equal(resolveSoundScene('adventure', { map: 'harbor' }), 'adventure');
  assert.equal(resolveSoundScene('tcg'), 'tcg');
  assert.equal(resolveSoundScene('deck'), 'tcg');
  assert.equal(resolveSoundScene('chess'), 'chess');
  assert.equal(resolveSoundScene('journey'), 'adventure');
  assert.equal(resolveSoundScene('adventure', { battle: { actors: [] } }), 'adventure_battle');
  assert.equal(resolveSoundScene('adventure', { battle: { actors: [{ boss: true, alive: false }] } }), 'epic_boss_battle');
});

test('track paths allow local Unicode names and stay inside the audio folder', () => {
  assert.equal(customSoundtrack('custom/Rừng nguyên liệu.mp3'), 'custom/R%E1%BB%ABng%20nguy%C3%AAn%20li%E1%BB%87u.mp3');
  for (const value of [null, '/demo.mp3', '../demo.mp3', 'https://example.org/demo.mp3', 'x/%2e%2e/demo.ogg', 'x\\demo.mp3', 'demo.txt']) {
    assert.equal(customSoundtrack(value), null);
  }
});

test('scene changes stop the prior loop and bad files fall back without another attempt', async (t) => {
  const originals = globalThis.Audio;
  const created = [];
  globalThis.Audio = class extends EventTarget {
    constructor(url) { super(); this.url = url; this.plays = 0; this.pauses = 0; created.push(this); }
    play() { this.plays += 1; return Promise.resolve(); }
    pause() { this.pauses += 1; }
  };
  t.after(() => { globalThis.Audio = originals; });

  const player = new GameAudio({ music: 70, ambience: 50, sfx: 80 });
  await player.loadSoundtracks(async () => ({ ok: true, json: async () => ({
    login: 'custom/intro.mp3', forest: 'custom/woods.ogg', epic_boss_battle: 'custom/boss.wav',
  }) }));
  player.setScene('login');
  assert.equal(created.length, 0);
  player.unlock();
  assert.ok(created[0].url.endsWith('/custom/intro.mp3'));
  assert.equal(created[0].loop, true);
  player.setScene('login');
  assert.equal(created[0].plays, 1);
  player.setScene('forest');
  assert.equal(created[0].pauses, 1);
  assert.ok(created[1].url.endsWith('/custom/woods.ogg'));
  assert.ok(created[2].url.endsWith('/forest_wind.ogg'));
  created[1].dispatchEvent(new Event('error'));
  assert.ok(created[3].url.endsWith('/forest_theme.ogg'));
  player.setScene('forest');
  assert.equal(created.length, 4);
  player.setScene('epic_boss_battle');
  assert.equal(created[2].pauses, 1);
  assert.equal(created[3].pauses, 1);
  assert.ok(created[4].url.endsWith('/custom/boss.wav'));
  player.setSettings({ music: 0, ambience: 50 });
  assert.equal(created[4].pauses, 1);
});
