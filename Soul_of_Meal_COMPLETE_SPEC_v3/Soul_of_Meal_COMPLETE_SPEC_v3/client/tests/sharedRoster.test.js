import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { SPIRITS } from '../src/modes/metaProgress.js';
import { createTcgMatch, playTcgCard, tcgTableDeck } from '../src/modes/tcg.js';
import { TCG_TABLE_VERSION } from '../src/modes/tcgCards.js';
import { createChessRun, refreshChessShop, buyChessOffer } from '../src/modes/autoChess.js';
import { createDefaultSave, migrateSave } from '../src/core/save.js';
const json = async path => JSON.parse(await readFile(new URL('../../examples/'+path,import.meta.url)));
const [catalog,{units},shop] = await Promise.all([json('cards/cards.catalog.json'),json('auto_chess/units.json'),json('auto_chess/shop_odds.json')]);

test('all 24 shared spirit identities exist in both strategic mode catalogs',()=>{
  assert.equal(Object.keys(SPIRITS).length,24);
  for(const spirit of Object.values(SPIRITS)){
    const card=catalog.cards.find(card=>card.character_id===spirit.id);
    const piece=units.find(unit=>unit.id===spirit.id);
    assert.ok(card && piece,spirit.name);
    assert.equal(card.element,spirit.element);
    assert.equal(piece.element,spirit.element);
    assert.ok(card.atk>0 && card.max_def>0);
    assert.ok(piece.baseStats.every(Number.isFinite));
  }
  for(const [id,cost] of [['chr_banhbao_bachngoc',1],['chr_som_017',2],['chr_som_009',3],['chr_som_008',4]])assert.equal(units.find(unit=>unit.id===id).cost,cost);
});

test('every spirit can be summoned using its TCG values and survives the existing save format',()=>{
  const deck=tcgTableDeck(catalog);
  for(const spirit of Object.values(SPIRITS)){
    const card=catalog.cards.find(card=>card.character_id===spirit.id);
    const match=createTcgMatch(catalog,deck,71,deck,'normal',TCG_TABLE_VERSION);
    Object.assign(match,{round:2,mulliganDone:true});
    for(const player of match.players)Object.assign(player,{hand:[],mana:7,maxMana:7});
    match.players[0].hand=[{...card,instance_id:'shared-'+spirit.id}];
    const summoned=playTcgCard(match,0,'shared-'+spirit.id,null,0);
    const unit=summoned.players[0].units[0];
    assert.equal(unit.character_id,spirit.id);
    assert.equal(unit.atk,card.atk);
    assert.equal(unit.max_def,card.max_def);
    const save=createDefaultSave();save.modes.tcg=summoned;
    assert.deepEqual(migrateSave(JSON.parse(JSON.stringify(save))).modes.tcg,summoned);
  }
});

test('a Chess lobby snapshots its catalog, keeping shop prices and combat stats stable across content updates',()=>{
  const run=createChessRun(units,shop,93);
  const changed=structuredClone(units);
  for(const unit of changed){unit.cost=5;unit.baseStats=[99999,99999,99999];}
  assert.deepEqual(refreshChessShop(run,changed,shop),refreshChessShop(run,units,shop));
  const selected=units.find(unit=>unit.id==='chr_som_024');
  const fixture=structuredClone(run);fixture.gold=50;fixture.shop=[selected];
  const bought=buyChessOffer(fixture,0).bench[0];
  assert.deepEqual([bought.maxHp,bought.atk,bought.def],selected.baseStats);
});

test('legacy Chess snapshots retain their eight-unit stock, original costs and original stats',()=>{
  const costs={chr_bunbo_holinh:1,chr_pho_lamvu:2,chr_goicuon_diepnhi:3,chr_banhbao_bachngoc:4,chr_caphe_davu:5,mob_pepper_01:1,mob_mushroom_01:2,npc_lilia:3};
  const legacy=units.filter(unit=>Object.hasOwn(costs,unit.id)).map(({baseStats,...unit})=>({...unit,cost:costs[unit.id]}));
  const run=createChessRun(legacy,shop,53);delete run.catalogSnapshot;
  const restored=refreshChessShop(run,units,shop);
  for(const offer of restored.shop.filter(Boolean)){
    assert.ok(Object.hasOwn(costs,offer.id));assert.equal(offer.cost,costs[offer.id]);assert.equal(offer.baseStats,undefined);
  }
  restored.shop=[legacy.find(unit=>unit.id==='chr_bunbo_holinh')];
  const bought=buyChessOffer(restored,0).bench[0];
  assert.deepEqual([bought.maxHp,bought.atk,bought.def],[690,68,34]);
});
