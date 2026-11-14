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

test('battle cues distinguish the windup, release, impact, guard and elemental ultimates', async () => {
  const player = new GameAudio({});
  const cues = [];
  player.play = (cue) => cues.push(cue);
  player.handle({ type: 'attack_started', payload: { clip_id: 'attack_b', travel_ticks: 0 } });
  player.handle({ type: 'attack_started', payload: { element: 'water', travel_ticks: 6 } });
  player.handle({ type: 'projectile_spawned', payload: { element: 'water' } });
  player.handle({ type: 'hit_resolved', payload: { element: 'water' } });
  player.handle({ type: 'hit_resolved', payload: { element: 'water', hp_damage: 0, absorbed: 15 } });
  player.handle({ type: 'boss_phase_changed', payload: { element: 'shadow' } });
  player.handle({ type: 'boss_cast_interrupted', payload: {} });
  player.handle({ type: 'battle_finished', payload: { winner: 'player' } });
  assert.deepEqual(cues, [
    'sfx_slash_b', 'sfx_element_water_cast', 'sfx_element_water_impact', 'sfx_guard_contact',
    'sfx_boss_warning', 'sfx_boss_break', 'sfx_victory',
  ]);
  for (const element of ['fire', 'water', 'wood', 'light', 'shadow']) {
    player.handle({ type: 'cast_started', payload: { element } });
    assert.equal(cues.at(-1), `sfx_element_${element}_ultimate`);
  }
  await Promise.all(cues.map(cue => readFile(new URL(`../assets/audio/${cue}.ogg`, import.meta.url))));
});

test('backgrounding stops one-shot audio, and reopening resumes the scene loop', t => {
  const originalAudio = globalThis.Audio;
  const originalDocument = globalThis.document;
  const tracks = [];
  globalThis.document = { hidden: false };
  globalThis.Audio = class extends EventTarget {
    constructor() { super(); this.playCount = 0; this.pauseCount = 0; tracks.push(this); }
    async play() { this.playCount++; }
    pause() { this.pauseCount++; }
  };
  t.after(() => {
    globalThis.Audio = originalAudio;
    globalThis.document = originalDocument;
  });
  const audio = new GameAudio({ music: 75, sfx: 80 });
  audio.setScene('login');
  audio.unlock();
  audio.play('sfx_ui_confirm');
  const [music, sound] = tracks;
  globalThis.document.hidden = true;
  audio.syncVisibility(true);
  audio.play('sfx_victory');
  assert.equal(tracks.length, 2, 'hidden scenes do not start one-shot sounds');
  assert.equal(music.pauseCount, 1);
  assert.equal(sound.pauseCount, 1);
  assert.equal(audio.active.size, 0);
  globalThis.document.hidden = false;
  audio.syncVisibility(false);
  assert.equal(music.playCount, 2);
  assert.equal(sound.playCount, 1);
});

test('footsteps require distance, alternate takes, and restart the cadence on a new surface', () => {
  const player = new GameAudio({});
  const cues = [];
  player.play = (cue) => cues.push(cue);
  player.footstep('village', 47);
  assert.deepEqual(cues, []);
  player.footstep('village', 2);
  player.footstep('village', 48);
  player.footstep('forest', 47);
  assert.deepEqual(cues, ['sfx_footstep', 'sfx_footstep_stone_b']);
  player.footstep('forest', 1);
  player.footstep('forest', 48);
  assert.deepEqual(cues.slice(-2), ['sfx_footstep_leaves_a', 'sfx_footstep_leaves_b']);
});
