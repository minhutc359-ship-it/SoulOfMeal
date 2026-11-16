import assert from 'node:assert/strict';
import test from 'node:test';
import { gachaResultCard } from '../src/shell/gachaPack.js';
import { META } from '../src/modes/metaProgress.js';
import { spiritIllustration } from '../src/render/cardArtwork.js';

test('every summon uses its splash illustration with rarity and duplicate outcome', () => {
  for (const spirit of META.characters) {
    const item = { id: spirit.id, isNew: false, essence: 12 };
    const art = spiritIllustration(item.id);
    assert.ok(art?.preview && art?.hd);
    const html = gachaResultCard(item, 0);
    assert.ok(html.includes(art.preview));
    assert.ok(html.includes(`data-rarity="${spirit.rarity}"`));
    assert.ok(html.includes('+12 Tinh Hoa'));
    assert.ok(gachaResultCard(item, 0, { hd: true }).includes(art.hd));
  }
});
test('ten-card summaries preserve receipt order, duplicates and per-item awards', () => {
  const ids = META.characters.slice(0, 9).map(spirit => spirit.id);
  ids.push(ids[0]);
  const items = ids.map((id, index) => ({ id, isNew: index !== 9, essence: index === 9 ? 8 : 0 }));
  const receipt = structuredClone(items);
  const faces = items.map((item, index) => gachaResultCard(item, index, { profile: true }));
  assert.equal(faces.length, 10);
  faces.forEach((html, index) => {
    assert.ok(html.includes(`data-result-index="${index}"`));
    assert.ok(html.includes(`data-result-profile="${ids[index]}"`));
    assert.ok(html.includes(index === 9 ? '+8 Tinh Hoa' : 'MỚI'));
  });
  assert.deepEqual(items, receipt);
});
