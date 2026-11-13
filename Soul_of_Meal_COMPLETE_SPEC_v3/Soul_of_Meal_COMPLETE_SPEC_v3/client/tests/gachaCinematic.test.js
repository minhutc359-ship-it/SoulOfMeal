import assert from 'node:assert/strict';
import test from 'node:test';
import { planGachaCinematic, RARITY_COLOR } from '../src/render/gachaCinematic.js';
import { META, SPIRITS } from '../src/modes/metaProgress.js';

const receipt = ids => ({ items: ids.map(id => ({ id, isNew: true, essence: 0 })) });

test('every single summon keeps its settled character and rarity-specific timing', () => {
  for (const spirit of META.characters) {
    const result = receipt([spirit.id]);
    const plan = planGachaCinematic(result);
    assert.equal(plan.spotlight.id, spirit.id);
    assert.equal(plan.rarity, spirit.rarity);
    assert.equal(plan.duration, { N: 5, R: 5, SR: 7, SSR: 10 }[spirit.rarity]);
    assert.ok(RARITY_COLOR[plan.rarity]);
    assert.ok(plan.impact < plan.reveal && plan.reveal < plan.duration);
    assert.deepEqual(result.items, [{ id: spirit.id, isNew: true, essence: 0 }]);
  }
  const ssr = META.characters.filter(spirit => spirit.rarity === 'SSR');
  assert.deepEqual(ssr.map(spirit => planGachaCinematic(receipt([spirit.id])).ending), ['flame', 'snow', 'tide', 'jade']);
});

test('a ten-summon keeps the ordered results and uses a single cinematic with the first SSR if present', () => {
  const ids = META.characters.slice(0, 10).map(spirit => spirit.id);
  const normal = planGachaCinematic(receipt(ids));
  assert.equal(normal.multi, true);
  assert.equal(normal.duration, 10);
  assert.equal(normal.spotlight, undefined);
  ids[2] = 'chr_som_023';
  ids[7] = 'chr_som_022';
  ids[9] = ids[2];
  const premium = planGachaCinematic(receipt(ids));
  assert.equal(premium.duration, 10);
  assert.equal(premium.spotlight.id, ids[2]);
  assert.equal(premium.ending, 'tide');
  assert.deepEqual(premium.cards.map(card => card.id), ids);
  assert.deepEqual(premium.cards.map(card => card.rarity), ids.map(id => SPIRITS[id].rarity));
});
