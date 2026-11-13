import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultSave, migrateSave } from '../src/core/save.js';
import { ADVENTURE_OFFERS, changeAdventureInventory } from '../src/modes/adventureStore.js';
import { BANNERS, META, SPIRITS, adventureParty, changeParty, drawSpirits, finishOnboarding, rollStarters, starterSpirits } from '../src/modes/metaProgress.js';
import { adventureSpiritStats, spiritProfile } from '../src/modes/spiritProgress.js';

const newPlayer = () => finishOnboarding(createDefaultSave(), {
  name: 'Minh Kết Vị', avatar: META.mascot, starter: 'chr_som_016',
});
const featured = META.banners.find(banner => banner.featured);
const draw = (save, random, overrides = {}) => drawSpirits(save, {
  bannerId: featured.id, count: 1, payment: 'ticket', key: 'draw-1', ...overrides,
}, random);
const roll = (...values) => () => {
  assert.ok(values.length);
  return values.shift();
};

test('onboarding grants only the two starters and legacy migration keeps the previous party', () => {
  const save = newPlayer();
  assert.deepEqual(adventureParty(migrateSave(save)).map(spirit => spirit.id), [META.mascot, 'chr_som_016']);
  assert.throws(() => finishOnboarding(save, save.meta.profile), /đã được tạo/);
  const legacy = createDefaultSave();
  delete legacy.meta;
  const migrated = migrateSave(legacy);
  assert.ok(migrated.meta.profile);
  assert.deepEqual(adventureParty(migrated), legacy.roster);
});

test('first summon awards one random guardian and one SR and restores the same pending reward', () => {
  const fresh = createDefaultSave();
  const first = rollStarters(fresh, '  Minh Kết Vị  ', roll(0, 0));
  const last = rollStarters(fresh, 'Minh Kết Vị', roll(99, 99));
  assert.deepEqual(starterSpirits(first.meta.profile), [META.starterGuardians[0], META.starters[0]]);
  const ids = [META.starterGuardians.at(-1), META.starters.at(-1)];
  assert.deepEqual(starterSpirits(last.meta.profile), ids);
  assert.equal(last.meta.profile.avatar, ids[0]);
  assert.equal(first.player.name, 'Minh Kết Vị');
  assert.deepEqual(last.meta.wallet, fresh.meta.wallet);
  assert.deepEqual(last.meta.history, []);
  assert.deepEqual(last.meta.pity, {});
  assert.equal(fresh.meta.profile, null);
  const restored = migrateSave(JSON.parse(JSON.stringify(last)));
  assert.equal(restored.meta.starterRevealPending, true);
  assert.deepEqual(starterSpirits(restored.meta.profile), ids);
  assert.deepEqual(adventureParty(restored).map(spirit => spirit.id), ids);
  assert.throws(() => rollStarters(restored, 'Minh Kết Vị', roll(0, 0)), /đã được tạo/);
  restored.meta.starterRevealPending = false;
  assert.equal(migrateSave(restored).meta.starterRevealPending, false);
});

test('SSR hard pity wins over SR pity, and an off-banner SSR guarantees the next one', () => {
  const save = newPlayer();
  save.meta.pity[featured.family] = { sinceSsr: 79, sinceSr: 9, featuredGuaranteed: false, draws: 79 };
  const first = draw(save, roll(0, 99, 0));
  assert.equal(SPIRITS[first.receipt.items[0].id].rarity, 'SSR');
  assert.notEqual(first.receipt.items[0].id, featured.featured);
  assert.equal(first.save.meta.pity[featured.family].featuredGuaranteed, true);
  const next = draw(first.save, roll(99, 0), { key: 'next' });
  assert.equal(next.receipt.items[0].id, featured.featured);
  assert.equal(next.save.meta.pity[featured.family].featuredGuaranteed, false);
  assert.equal(next.save.meta.pity[featured.family].sinceSsr, 0);
  assert.equal(adventureParty(next.save).length, 2);
  assert.equal(adventureParty(changeParty(next.save, featured.featured)).length, 3);
});

test('a ten-draw settles one SR guarantee and repeating its request does not spend twice', () => {
  const save = newPlayer();
  const newbie = Object.values(BANNERS).find(banner => banner.limit);
  const params = { bannerId: newbie.id, count: 10 };
  const result = draw(save, () => 0, params);
  assert.equal(result.save.meta.wallet.ticket, 0);
  assert.equal(result.receipt.items[9].id, META.starters[0]);
  assert.equal(result.save.meta.pity[newbie.family].sinceSr, 0);
  assert.equal(result.receipt.items[1].isNew, false);
  assert.equal(result.receipt.items[1].essence, META.duplicateEssence.N);
  assert.strictEqual(draw(result.save, () => assert.fail('rerolled'), params).save, result.save);
  assert.throws(() => draw(result.save, () => 0, { ...params, payment: 'gem' }), /đã được sử dụng/);
  assert.throws(() => draw(result.save, () => 0, { ...params, payment: 'gem', key: 'other' }), /hết lượt/);
});

test('equipment swaps within one slot, affects Adventure stats and rejects stale changes', () => {
  let save = newPlayer();
  save.player.gold = 1000;
  const [member, other] = save.roster;
  const change = (type, id, characterId = member.id, quantity = 1) => {
    save = changeAdventureInventory(save, { type, id, characterId, quantity, expectedRevision: save.adventure.inventory.revision });
  };
  change('buy', 'basic_sword', member.id, 2);
  const [first, second] = Object.keys(save.adventure.inventory.gear);
  change('equip', first);
  change('equip', second);
  assert.equal(save.adventure.inventory.gear[first].owner, null);
  assert.equal(save.adventure.inventory.gear[second].owner, member.id);
  assert.throws(() => change('equip', second, other.id), /chưa sẵn sàng/);
  assert.throws(() => change('sell', second), /Tháo trang bị/);
  assert.throws(() => changeAdventureInventory(save, { type: 'buy', id: 'basic_sword', expectedRevision: 0 }), /vừa thay đổi/);
  const profile = spiritProfile(save, member.id);
  assert.equal(adventureSpiritStats(member, profile, undefined, save).atk, member.atk + ADVENTURE_OFFERS.basic_sword.bonus);
});
