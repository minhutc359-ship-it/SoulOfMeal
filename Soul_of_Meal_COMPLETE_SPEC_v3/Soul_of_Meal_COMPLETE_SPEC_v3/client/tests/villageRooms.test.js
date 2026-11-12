import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createDefaultSave, migrateSave } from '../src/core/save.js';
import { createAdventureState, interactAdventure, nearestInteraction, purchaseAdventureSupplies } from '../src/modes/adventure.js';
import { adventureJournal } from '../src/modes/adventureJournal.js';
import { collidesWithWorld, findAdventurePath } from '../src/modes/adventureNavigation.js';
import { createAdventureMapRegistry } from '../src/modes/mapCatalog.js';
import { ROOM_EXIT, VILLAGE_ROOMS } from '../src/modes/villageRooms.js';

async function villageMaps() {
  return createAdventureMapRegistry(await Promise.all(['village', ...VILLAGE_ROOMS].map(async key =>
    JSON.parse(await readFile(new URL('../../examples/maps/' + key + '.json', import.meta.url))))));
}

test('each village door has a navigable interior, service and saved route back to its own entrance', async () => {
  const maps = await villageMaps();
  const village = maps.get('village');
  const save = createDefaultSave();
  const services = ['gear', 'journal', 'supplies'];
  for (const [index, room] of VILLAGE_ROOMS.entries()) {
    const entrance = village.interactables.find(item => item.id === room + '_door');
    const state = createAdventureState(save);
    assert.ok(findAdventurePath('village', state, entrance, undefined, maps).length);
    Object.assign(state, { x: entrance.x, y: entrance.y });
    const entered = interactAdventure(state, save, maps);
    const restored = migrateSave(JSON.parse(JSON.stringify(entered.save)));
    assert.equal(restored.adventure.map, room);
    assert.equal(restored.adventure.quest, save.adventure.quest);
    assert.equal(adventureJournal(restored).action, ROOM_EXIT);
    assert.equal(collidesWithWorld(room, state.x, state.y, undefined, maps), false);
    const service = maps.get(room).interactables.find(item => item.kind === 'room_service');
    assert.ok(findAdventurePath(room, state, service, undefined, maps).length);
    Object.assign(state, { x: service.x, y: service.y });
    assert.equal(interactAdventure(state, restored, maps).service, services[index]);
    const exit = maps.get(room).interactables.find(item => item.id === ROOM_EXIT);
    assert.ok(findAdventurePath(room, state, exit, undefined, maps).length);
    Object.assign(state, { x: exit.x, y: exit.y });
    const left = interactAdventure(state, restored, maps);
    assert.equal(left.save.adventure.map, 'village');
    assert.equal(collidesWithWorld('village', state.x, state.y, undefined, maps), false);
    assert.equal(nearestInteraction(state, left.save, maps)?.id, entrance.id);
    assert.equal(adventureJournal(left.save).action, 'lilia');
  }
});

test('supplies spend and grant resources once per purchase at the merchant counter', async () => {
  const maps = await villageMaps();
  const save = createDefaultSave();
  const state = createAdventureState(save);
  assert.equal(purchaseAdventureSupplies(state, save, maps).save, save);
  const counter = maps.get('village_merchant').interactables[0];
  Object.assign(state, { map: 'village_merchant', x: counter.x, y: counter.y });
  const result = purchaseAdventureSupplies(state, save, maps);
  assert.equal(result.purchased, true);
  assert.equal(result.save.player.gold, save.player.gold - counter.offer.gold);
  assert.equal(result.save.player.essence, save.player.essence + counter.offer.essence);
  const lowGold = { ...save, player: { ...save.player, gold: counter.offer.gold - 1 } };
  assert.deepEqual(purchaseAdventureSupplies(state, lowGold, maps), { save: lowGold, purchased: false });
  assert.equal(migrateSave(result.save).player.essence, result.save.player.essence);
});
