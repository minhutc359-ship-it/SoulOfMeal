import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { writeOfflinePackage } from '../build/offlinePackage.js';
import { enableOfflinePractice, inspectOfflinePractice } from '../src/core/offlinePractice.js';

const workerSource = new URL('../offline-worker.js', import.meta.url);
const scope = 'https://game.example/som/releases/123456789abcdef0123456789abcdef0/client/';
const manifest = { schema: 1, build: 'a'.repeat(64), bytes: 200, entries: [
  { url: 'index.html', integrity: 'sha256-test-index' },
  { url: '../assets/game.js', integrity: 'sha256-test-js' },
  { url: '../examples/maps/village.json', integrity: 'sha256-test-map' },
  { url: 'assets/audio/sound_track/epic_boss_battle.mp3', integrity: 'sha256-test-audio' },
] };

class CacheStorage {
  stores = new Map();
  async has(key) { return this.stores.has(key); }
  async open(key) {
    if (!this.stores.has(key)) this.stores.set(key, new Map());
    const items = this.stores.get(key);
    return { put: async (url, response) => items.set(String(url), response.clone()),
      match: async url => items.get(String(url))?.clone() };
  }
  async keys() { return [...this.stores.keys()]; }
  async delete(key) { return this.stores.delete(key); }
}

function workerHarness({ fail, caches = new CacheStorage() } = {}) {
  const handlers = {}, requests = [];
  let online = true, claimed = false;
  runInNewContext('const OFFLINE_PACKAGE = ' + JSON.stringify(manifest) + ';\n' + readFileSync(workerSource, 'utf8'), {
    self: { registration: { scope }, addEventListener: (name, fn) => { handlers[name] = fn; }, clients: { claim: async () => { claimed = true; } } },
    URL, Request, Response, AbortController, setTimeout, clearTimeout, caches,
    fetch: async request => {
      assert.ok(online, 'Offline requests must be served from the installed package');
      requests.push(request);
      if (String(request.url).includes(fail ?? '\0')) return new Response('Missing', { status: 404 });
      return new Response(request.url.endsWith('index.html') ? '<html>Offline Soul of Meal</html>' : 'asset:' + request.url);
    },
  });
  return { caches, requests, get claimed() { return claimed; }, disconnect() { online = false; },
    async lifecycle(name) { let work; handlers[name]({ waitUntil: promise => { work = promise; } }); await work; },
    intercept(url, { method = 'GET', mode = 'cors' } = {}) {
      let answer;
      handlers.fetch({ request: { url, method, mode }, respondWith: promise => { answer = promise; } });
      return answer;
    } };
}

test('the production package is reproducible, integrity checked and includes real boss audio', t => {
  const output = mkdtempSync(join(tmpdir(), 'som-offline-'));
  t.after(() => rmSync(output, { recursive: true, force: true }));
  mkdirSync(join(output, 'client/assets/audio/voice'), { recursive: true });
  mkdirSync(join(output, 'client/assets/audio/sound_track'), { recursive: true });
  mkdirSync(join(output, 'assets'), { recursive: true });
  writeFileSync(join(output, 'client/index.html'), '<html>Game</html>');
  writeFileSync(join(output, 'assets/game.js'), 'export const game = 1;');
  writeFileSync(join(output, 'client/assets/audio/voice/dormant.mp3'), 'unused');
  writeFileSync(join(output, 'client/assets/audio/sound_track/epic_boss_battle.mp3'), 'boss');
  writeFileSync(join(output, 'client/assets/audio/sound_track/unused-theme.mp3'), 'not used by this version');
  writeFileSync(join(output, 'client/assets/audio/soundtracks.json'), JSON.stringify({ epic_boss_battle: 'sound_track/epic_boss_battle.mp3' }));
  mkdirSync(join(output, 'client/assets/golden'), { recursive: true });
  writeFileSync(join(output, 'client/assets/golden/legacy.webp'), 'old prototype');
  const first = writeOfflinePackage(output, workerSource);
  assert.deepEqual(writeOfflinePackage(output, workerSource), first);
  assert.equal(first.entries.length, 4);
  assert.ok(first.entries.some(entry => entry.url.includes('epic_boss_battle.mp3')));
  assert.ok(first.entries.every(entry => entry.integrity.startsWith('sha256-') && !entry.url.startsWith('/')));
  assert.ok(first.bytes > 0);
  writeFileSync(join(output, 'assets/game.js'), 'export const game = 2;');
  const second = writeOfflinePackage(output, workerSource);
  assert.notEqual(second.build, first.build);
  const changedWorker = join(tmpdir(), 'som-worker-' + first.build + '.js');
  t.after(() => rmSync(changedWorker, { force: true }));
  writeFileSync(changedWorker, readFileSync(workerSource, 'utf8') + '\n/* new worker policy */');
  assert.notEqual(writeOfflinePackage(output, changedWorker).build, second.build);
});

test('an installed immutable release opens its shell, chunks, catalogs and soundtrack offline', async () => {
  const worker = workerHarness();
  await worker.lifecycle('install');
  assert.equal(worker.requests.length, manifest.entries.length);
  assert.ok(worker.requests.every(request => request.integrity.startsWith('sha256-') && request.credentials === 'omit'));
  await worker.lifecycle('activate');
  assert.equal(worker.claimed, true);
  worker.disconnect();
  assert.match(await (await worker.intercept(scope, { mode: 'navigate' })).text(), /Offline Soul of Meal/);
  for (const entry of manifest.entries) {
    const response = await worker.intercept(new URL(entry.url, scope).href + '?v=unchanged');
    assert.equal(response.status, 200);
  }
  assert.equal((await (await worker.intercept(scope + 'offline-manifest.json')).json()).build, manifest.build);
});

test('the worker bypasses accounts, API writes, release pointers and unrelated origins or routes', async () => {
  const worker = workerHarness();
  await worker.lifecycle('install');
  worker.disconnect();
  for (const url of ['https://game.example/api/v1/practice-save', 'https://game.example/som/release.json',
    new URL('../release-build.json', scope).href, scope + 'missing-page', 'https://other.example/index.html']) {
    assert.equal(worker.intercept(url, { mode: 'navigate' }), undefined);
  }
  assert.equal(worker.intercept(scope + 'index.html', { method: 'POST' }), undefined);
});

test('a partial or failed install is removed while the last good release remains usable', async () => {
  const caches = new CacheStorage();
  const prior = 'soul-of-meal.practice.v1:' + scope + ':previous';
  const previous = await caches.open(prior);
  await previous.put(scope + 'index.html', new Response('previous working game'));
  const worker = workerHarness({ caches, fail: 'village.json' });
  await assert.rejects(worker.lifecycle('install'), /incomplete/);
  assert.deepEqual(await caches.keys(), [prior]);
  assert.equal(await (await previous.match(scope + 'index.html')).text(), 'previous working game');
});

test('activation cleans only older caches in its own scope, preserving other immutable releases', async () => {
  const worker = workerHarness();
  const prior = 'soul-of-meal.practice.v1:' + scope + ':previous';
  const other = 'soul-of-meal.practice.v1:https://game.example/other/client/:previous';
  await worker.caches.open(prior);
  await worker.caches.open(other);
  await worker.lifecycle('install');
  await worker.lifecycle('activate');
  assert.equal(await worker.caches.has(prior), false);
  assert.equal(await worker.caches.has(other), true);
});

test('quota exhaustion while writing the completion marker also discards the unfinished package', async () => {
  const caches = new CacheStorage();
  const originalOpen = caches.open.bind(caches);
  caches.open = async key => {
    const cache = await originalOpen(key);
    return { ...cache, put: async (url, response) => {
      if (String(url).endsWith('offline-manifest.json')) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      await cache.put(url, response);
    } };
  };
  const worker = workerHarness({ caches });
  await assert.rejects(worker.lifecycle('install'), /Quota exceeded/);
  assert.deepEqual(await caches.keys(), []);
});

test('the settings require a complete package and active worker before reporting offline readiness', async () => {
  const worker = workerHarness();
  let active;
  const env = { location: { href: scope }, isSecureContext: true, caches: worker.caches,
    fetch: async () => Response.json(manifest), navigator: { serviceWorker: { getRegistration: async () => ({ active }) } } };
  assert.equal((await inspectOfflinePractice(env)).ready, false);
  await worker.lifecycle('install');
  assert.equal((await inspectOfflinePractice(env)).ready, false);
  active = { scriptURL: scope + 'offline-worker.js' };
  assert.equal((await inspectOfflinePractice(env)).ready, true);
  await enableOfflinePractice(env);
  assert.equal((await inspectOfflinePractice({ ...env, isSecureContext: false })).supported, false);
  assert.equal((await inspectOfflinePractice({ ...env, fetch: async () => new Response('', { status: 404 }) })).supported, false);
});
