import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultSave, exportGuestSave, loadSave, migrateSave, persistSave, SAVE_KEY } from '../src/core/save.js';

test('a failed device write preserves the last good snapshot and permits retry and export', () => {
  const prior = createDefaultSave();
  let value = JSON.stringify(prior);
  let full = true;
  const storage = { getItem: () => value, setItem: (_key, next) => { if (full) throw new DOMException('Quota exceeded', 'QuotaExceededError'); value = next; } };
  const playing = structuredClone(prior);
  playing.player.gold += 40;
  playing.modes.chess = { round: 38, phase: 'prepare', lobby: { finish_condition: 'last_survivor' } };
  assert.equal(persistSave(playing, storage), false);
  assert.deepEqual(JSON.parse(value), prior);
  const backup = JSON.parse(exportGuestSave(playing));
  assert.equal(backup.format, 'soul-of-meal.guest-save');
  assert.deepEqual(migrateSave(backup.save), migrateSave(playing));
  full = false;
  assert.equal(persistSave(playing, storage), true);
  assert.equal(loadSave(storage).player.gold, playing.player.gold);
  assert.deepEqual(loadSave(storage).modes.chess, playing.modes.chess);
});

test('blocked storage access and serialization errors return a failure instead of ending play', t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  t.after(() => descriptor ? Object.defineProperty(globalThis, 'localStorage', descriptor) : delete globalThis.localStorage);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new DOMException('Denied', 'SecurityError'); } });
  assert.equal(persistSave(createDefaultSave()), false);
  const save = createDefaultSave();
  save.self = save;
  assert.equal(persistSave(save, { setItem() { assert.fail('Circular data must not be written'); } }), false);
  assert.equal(persistSave(save, null), false);
});

test('existing v2 guest progression, inventory and ongoing mode snapshots keep their save key', () => {
  const save = createDefaultSave();
  save.player.gold = 888;
  save.adventure.inventory.stacks = { spice: 8 };
  save.modes.tcg = { rulesVersion: 'client-tcg-v4', turn: 8 };
  const entries = new Map();
  const storage = { setItem: (key, value) => entries.set(key, value), getItem: key => entries.get(key) };
  assert.equal(persistSave(save, storage), true);
  assert.ok(entries.has(SAVE_KEY));
  assert.deepEqual(loadSave(storage), migrateSave(save));
});
