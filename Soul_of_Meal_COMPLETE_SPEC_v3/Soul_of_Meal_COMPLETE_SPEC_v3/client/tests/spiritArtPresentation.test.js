import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { spiritImage } from '../src/shell/metaPanels.js';
import { cardIllustration, spiritIllustration } from '../src/render/cardArtwork.js';
import { META } from '../src/modes/metaProgress.js';
import { actorArt } from '../src/render/spriteAssets.js';
import { advanceArtworkFallback, artworkImage, bindArtworkFallbacks, upgradeArtworkImage } from '../src/render/artworkImages.js';

const cards = JSON.parse(await readFile(new URL('../../examples/cards/cards.catalog.json', import.meta.url))).cards;
test('each roster thumbnail and portrait belongs to its exact unit-card identity', () => {
  for (const spirit of META.characters) {
    const card = cards.find(c => c.type === 'unit' && c.character_id === spirit.id);
    const art = spiritIllustration(spirit.id);
    assert.deepEqual(art, cardIllustration(card.card_id));
    assert.ok(spiritImage(spirit.id).includes(`src="${art.preview}"`));
    assert.ok(spiritImage(spirit.id, true).includes(`data-art-hd="${art.hd}"`));
    assert.ok(spiritImage(spirit.id).includes(`data-art-character="${spirit.id}"`));
    assert.ok(spiritImage(spirit.id, false, { showcase: false }).includes(`src="${actorArt(spirit.id)}"`));
  }
});
test('portrait stays on the preview while HD loads, then upgrades to the same character', () => {
  const image = { src: 'preview', isConnected: true, dataset: { artHd: 'hd', artFallbacks: '["actor"]' },
    getAttribute() { return this.src; }, setAttribute(key, value) { this.src = value; } };
  const preloader = {};
  upgradeArtworkImage(image, () => preloader);
  assert.equal(image.src, 'preview');
  assert.equal(preloader.src, 'hd');
  preloader.onload();
  assert.equal(image.src, 'hd');
  assert.deepEqual(JSON.parse(image.dataset.artFallbacks), ['preview', 'actor']);
});
test('failed or detached HD upgrades keep the preview and do not touch another screen', () => {
  const image = { src: 'preview', isConnected: true, dataset: { artHd: 'hd' },
    getAttribute() { return this.src; }, setAttribute(key, value) { this.src = value; } };
  const preloader = {};
  upgradeArtworkImage(image, () => preloader);
  preloader.onerror();
  assert.equal(image.src, 'preview');
  image.isConnected = false;
  preloader.onload();
  assert.equal(image.src, 'preview');
});
test('a failed HD portrait falls back once to its preview then its own actor without retry loops', () => {
  for (const spirit of META.characters) {
    const art = spiritIllustration(spirit.id);
    const image = {
      src: art.hd, dataset: { artFallbacks: JSON.stringify([art.preview, actorArt(spirit.id)]) },
      getAttribute() { return this.src; }, setAttribute(key, value) { this.src = value; },
    };
    assert.equal(advanceArtworkFallback(image), true);
    assert.equal(image.src, art.preview);
    assert.equal(advanceArtworkFallback(image), true);
    assert.equal(image.src, actorArt(spirit.id));
    assert.equal(advanceArtworkFallback(image), false);
    assert.equal(image.dataset.artUnavailable, 'true');
  }
});
test('nested listeners cannot consume two fallback levels for one image failure', () => {
  const host = new EventTarget(), child = new EventTarget();
  bindArtworkFallbacks(host); bindArtworkFallbacks(host); bindArtworkFallbacks(child);
  const image = { src: 'hd', dataset: { artFallbacks: '["preview","actor"]' },
    hasAttribute: () => true, getAttribute() { return this.src; }, setAttribute(key, value) { this.src = value; } };
  const event = new Event('error');
  Object.defineProperty(event, 'target', { value: image });
  host.dispatchEvent(event); child.dispatchEvent(event);
  assert.equal(image.src, 'preview');
});
test('art markup escapes labels and does not invent missing artwork', () => {
  assert.equal(artworkImage(null), '');
  const html = artworkImage({ preview: './preview.webp' }, { alt: '<script>bad</script>' });
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
});
