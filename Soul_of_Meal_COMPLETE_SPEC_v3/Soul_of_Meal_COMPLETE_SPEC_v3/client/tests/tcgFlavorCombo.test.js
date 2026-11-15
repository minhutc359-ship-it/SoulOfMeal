import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createTcgMatch, tcgTableDeck, playTcgCard, advanceTcgResponses, endTcgTurn } from '../src/modes/tcg.js';
import { TCG_TABLE_VERSION } from '../src/modes/tcgCards.js';
import { gameEvents } from '../src/core/events.js';

const catalog=JSON.parse(await readFile(new URL('../../examples/cards/cards.catalog.json',import.meta.url)));
const card=id=>structuredClone(catalog.cards.find(c=>c.card_id===id));
function fresh(){
  const deck=tcgTableDeck(catalog),match=createTcgMatch(catalog,deck,17,deck,'normal',TCG_TABLE_VERSION);
  match.mulliganDone=true;
  match.players[0].units=['card_demo_01','card_demo_02','card_demo_03'].map((id,lane)=>({...card(id),instance_id:'unit:'+id,lane,current_def:500,ready:true}));
  match.players[1].units=[{...card('card_demo_04'),instance_id:'enemy',lane:0,current_def:500,ready:true}];
  return match;
}
function cast(match,element,type='burst_spell'){
  const spell={...card('card_demo_10'),element,type,cost:0,instance_id:'spell:'+element+match.eventSeq,effect:{kind:'deal_damage',value:1}};
  match.players[0].hand.push(spell);match.priority=0;
  return playTcgCard(match,0,spell.instance_id,'commander');
}

test('three successfully resolved spell elements trigger once with live matching spirits, and survive save/reload',()=>{
  const events=[],receive=event=>events.push(event.detail);
  gameEvents.addEventListener('game-event',receive);
  try{
    let match=cast(cast(fresh(),'fire'),'water');
    match=JSON.parse(JSON.stringify(match));
    assert.equal(match.players[1].units[0].current_def,500);
    match=cast(match,'wood');
    assert.equal(match.players[1].hp,2797);
    assert.equal(match.players[1].units[0].current_def,150);
    assert.equal(match.players[0].flavorComboUsed,true);
    const event=events.find(e=>e.type==='tcg_recipe_resolved' && e.payload.card_ids);
    assert.deepEqual(event.payload.elements,['fire','water','wood']);
    assert.deepEqual(event.payload.card_ids,['card_demo_01','card_demo_02','card_demo_03']);
    match=cast(match,'wood');
    assert.equal(match.players[1].hp,2796,'repeat spells cannot trigger a second combo');
    match=endTcgTurn(match,0);
    assert.equal(match.players[0].flavorElements,undefined);
    assert.equal(match.players[0].flavorComboUsed,undefined);
  }finally{gameEvents.removeEventListener('game-event',receive);}
});

test('a countered spell never qualifies, and the third spell must find all three spirits alive',()=>{
  let match=cast(fresh(),'fire','fast_spell');
  const refute={...card('card_tcg_refute'),cost:0,instance_id:'refute'};
  match.players[1].hand=[refute];
  match=playTcgCard(match,1,refute.instance_id,'stack:'+match.stack[0].id);
  match=advanceTcgResponses(match);
  assert.equal(match.players[0].flavorElements,undefined);
  match=cast(cast(match,'water'),'wood');
  assert.equal(match.players[0].flavorComboUsed,undefined);
  match.players[0].units=match.players[0].units.filter(unit=>unit.element!=='wood');
  match=cast(match,'fire');
  assert.equal(match.players[0].flavorComboUsed,undefined);
});

test('saved tables without the opt-in version retain their original combo rules',()=>{
  let match=fresh();delete match.elementalComboVersion;
  for(const element of ['fire','water','wood'])match=cast(match,element);
  assert.equal(match.players[1].hp,2997);
  assert.equal(match.players[1].units[0].current_def,500);
  assert.equal(match.players[0].flavorElements,undefined);
});
