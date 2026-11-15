import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { tcgCardFace, cardIllustration, spiritIllustration, cardBackIllustration } from '../src/render/cardArtwork.js';
import { SPIRITS } from '../src/modes/metaProgress.js';
const catalog=JSON.parse(await readFile(new URL('../../examples/cards/cards.catalog.json',import.meta.url)));

test('card labels use the actual TCG numbers and keep names and rules as escaped UI text',()=>{
  const card={...catalog.cards[0],display_name:'<script>Hỏa Linh</script>',keywords:['guard']};
  const face=tcgCardFace(card,{cost:0,rule:'Tạo <b>khiên</b>'});
  assert.match(face,/ATK <span>300<\/span>/);assert.match(face,/DEF <span>500<\/span>/);
  assert.match(face,/aria-label="0 mana"/);assert.match(face,/Hộ Vệ/);
  assert.doesNotMatch(face,/<script>|<b>khiên<\/b>/);assert.match(face,/&lt;script&gt;/);
});

test('spell and trap faces show their rules without inventing unit attack or defense',()=>{
  for(const type of ['fast_spell','trap']){
    const card=catalog.cards.find(card=>card.type===type);
    const face=tcgCardFace(card,{rule:'Luật của thẻ'});
    assert.match(face,/Luật của thẻ/);assert.doesNotMatch(face,/<b>ATK |<b>DEF /);
  }
});

test('all 79 cards and all 24 spirits resolve to individual HD illustrations with a dedicated card back',async()=>{
  const jobs=JSON.parse(await readFile(new URL('../../docs/02_art/SPLASH_ART_JOBS.json',import.meta.url))).jobs;
  const digests=new Set();
  assert.equal(catalog.cards.length,79);assert.equal(jobs.length,80);
  for(const card of catalog.cards){
    const art=cardIllustration(card.card_id);assert.ok(art,card.card_id);
    const job=jobs.find(job=>job.id===card.card_id);assert.equal(job.status,'generated');
    assert.ok(art.width>=1024 && art.height>=1536);
    for(const [path,sha] of [[art.hd,job.sha256],[art.preview,job.preview_sha256]]){
      const bytes=await readFile(new URL('../'+path.slice(2),import.meta.url));
      assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(createHash('sha256').update(bytes).digest('hex'),sha);
    }
    digests.add(job.sha256);
  }
  assert.equal(digests.size,79);
  const portraits=new Set();for(const spirit of Object.values(SPIRITS)){const art=spiritIllustration(spirit.id);assert.ok(art,spirit.id);portraits.add(art.hd);}
  assert.equal(portraits.size,24);assert.ok(cardBackIllustration());
});
