import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { GameAudio } from '../src/core/audio.js';

const folder = new URL('../assets/audio/', import.meta.url);
const pack = readFileSync(new URL('compatibility.bin', folder));

test('the MP3 pack contains all shipped Ogg loops and cues', () => {
  const base = 4 + pack.readUInt32LE(0);
  const index = JSON.parse(pack.subarray(4, base));
  assert.deepEqual(Object.keys(index), readdirSync(folder).filter(name => name.endsWith('.ogg')).sort());
  let end = base;
  for (const [offset, length] of Object.values(index)) {
    assert.equal(base + offset, end);
    assert.equal(pack[base + offset], 0xff);
    assert.equal(pack[base + offset + 1] & 0xe0, 0xe0);
    end += length;
  }
  assert.equal(end, pack.length);
});

test('a browser without Ogg resumes Web Audio, cancels stale loops and plays a decoded SFX', async t => {
  const starts = [];
  const resumes = [];
  let releasePack;
  const delivery = new Promise(resolve => { releasePack = resolve; });
  const saved = { Audio: globalThis.Audio, AudioContext: globalThis.AudioContext, fetch: globalThis.fetch };
  t.after(() => Object.assign(globalThis, saved));
  globalThis.Audio = class { canPlayType() { return ''; } };
  globalThis.AudioContext = class {
    state = 'suspended';
    currentTime = 0;
    destination = {};
    async resume() { this.state = 'running'; resumes.push(true); }
    async decodeAudioData(bytes) { return { duration: 5, bytes: bytes.byteLength }; }
    createBufferSource() {
      return { connect() {}, disconnect() {}, start() { starts.push(this); }, stop() { this.stopped = true; this.onended(); } };
    }
    createGain() { return { connect() {}, disconnect() {}, gain: { value: 0 } }; }
  };
  globalThis.fetch = async path => {
    assert.equal(path, './assets/audio/compatibility.bin');
    await delivery;
    return new Response(pack);
  };
  const player = new GameAudio({ music: 80, sfx: 70, ambience: 0 });
  player.setScene('login');
  player.unlock();
  player.setScene('chess');
  player.play('sfx_slash_a');
  releasePack();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(resumes.length, 1);
  assert.equal(starts.filter(source => source.loop).length, 1);
  assert.equal(starts.filter(source => !source.loop).length, 1);
  assert.ok(starts.every(source => source.buffer.bytes > 0));
  player.setSettings({ music: 0, sfx: 0, ambience: 0 });
  assert.equal(starts.find(source => source.loop).stopped, true);
});
