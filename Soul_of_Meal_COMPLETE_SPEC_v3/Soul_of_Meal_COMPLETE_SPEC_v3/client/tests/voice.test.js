import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { GameVoice } from '../src/core/voice.js';
import lines from '../src/core/voiceLibrary.json' with { type: 'json' };
import { CHAPTER_DIALOGUES } from '../src/modes/adventureStory.js';

test('bundled voices cover the actual story text and play without a device voice', async () => {
  for (const [scene, { lines: dialogue }] of Object.entries(CHAPTER_DIALOGUES)) {
    dialogue.forEach(({ text }, index) => assert.equal(lines['story-' + scene + '-' + index], text));
  }
  await Promise.all(Object.keys(lines).map(async key => {
    const file = await readFile(new URL('../assets/audio/voice/' + key + '.mp3', import.meta.url));
    assert.ok(file.length > 1000);
  }));
  const tracks = [];
  class AudioTrack extends EventTarget {
    constructor(url) { super(); this.url = url; tracks.push(this); }
    play() { return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  const settings = { voice: 80 };
  const voice = new GameVoice(settings, null, null, AudioTrack);
  const states = [];
  voice.onPlaying = playing => states.push(playing);
  assert.ok(voice.speak(lines['system-welcome'], 'npc_lilia', { clip: 'system-welcome', priority: true }));
  assert.equal(tracks[0].url, './assets/audio/voice/system-welcome.mp3');
  assert.equal(voice.speak(lines['commander-attack'], 'commander', { clip: 'commander-attack' }), false);
  settings.voice = 0;
  voice.setSettings(settings);
  assert.equal(tracks[0].paused, true);
  assert.deepEqual(states, [true, false]);
});
