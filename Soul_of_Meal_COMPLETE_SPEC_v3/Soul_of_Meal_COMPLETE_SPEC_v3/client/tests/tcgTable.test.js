import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gameEvents } from '../src/core/events.js';
import { createTcgMatch, endTcgTurn, mulliganTcg, passTcgPriority, playTcgCard,
  strikeTcg, tcgCardIssue, tcgStrikePreview, tcgStrikeTargets, tcgTableDeck, validateDeck } from '../src/modes/tcg.js';
import { TCG_TABLE_VERSION, tcgRecipeFor } from '../src/modes/tcgCards.js';

const catalog = JSON.parse(await readFile(new URL('../../examples/cards/cards.catalog.json', import.meta.url)));
const deck = tcgTableDeck(catalog);
const card = (cardId, instanceId = cardId) => ({ ...structuredClone(catalog.cards.find(card => card.card_id === cardId)), instance_id: instanceId });
const unit = (id, instance, lane, extra) => ({ ...card(id, instance), lane, current_def: 600, ready: true, ...extra });

function fresh() {
  const match = createTcgMatch(catalog, deck, 17, deck, 'normal', TCG_TABLE_VERSION);
  Object.assign(match, { round: 2, mulliganDone: true });
  for (const player of match.players) Object.assign(player, { hand: [], mana: 7, maxMana: 7 });
  return match;
}

function resolve(match) {
  for (let step = 0; match.phase === 'reaction' && step < 8; step++) match = passTcgPriority(match, match.priority);
  return match;
}

test('new tables start with a compact legal deck and limit mulligans to three cards', () => {
  for (const id of Object.keys(catalog.table_decks)) validateDeck(tcgTableDeck(catalog, id), catalog, 24);
  const match = createTcgMatch(catalog, deck, 17, deck, 'normal', TCG_TABLE_VERSION);
  const ids = match.players[0].hand.map(card => card.instance_id);
  assert.deepEqual(match.players.map(player => player.hp), [3400, 3000]);
  assert.equal(match.players[0].deck.length, 20);
  assert.throws(() => mulliganTcg(match, ids), /tối đa 3/);
  assert.equal(mulliganTcg(match, ids.slice(0, 3)).players[0].hand.length, 4);
  const guards = [...match.players[0].hand, ...match.players[0].deck].filter(card => card.keywords?.includes('guard'));
  assert.ok(guards.length > 0);
});

test('summoning validates the exact slot, preserves the previous state and shields a same-element summon', () => {
  const match = fresh();
  const player = match.players[0];
  player.units = [unit('card_demo_06', 'other', 1)];
  player.hand = [card('card_demo_01')];
  const before = JSON.stringify(match);
  assert.throws(() => playTcgCard(match, 0, 'card_demo_01', null, 1), /trống/);
  assert.throws(() => playTcgCard(match, 0, 'card_demo_01', null, 4), /trống/);
  const next = playTcgCard(match, 0, 'card_demo_01', null, 3);
  assert.equal(JSON.stringify(match), before);
  const summoned = next.players[0].units.at(-1);
  assert.equal(summoned.lane, 3);
  assert.equal(summoned.shield, 100);
});

test('Hộ vệ protects targets until removed, counter damage is simultaneous and a unit only strikes once', () => {
  const match = fresh();
  match.players[0].units = [
    unit('card_demo_06', 'attacker', 0, { atk: 880, shield: 100 }),
    unit('card_demo_06', 'spare', 2, { atk: 300 }),
  ];
  match.players[1].units = [
    unit('card_demo_04', 'guard', 0, { atk: 400, shield: 150, keywords: ['guard'], rootedUntil: 7 }),
    unit('card_demo_02', 'other', 1),
  ];
  assert.deepEqual(tcgStrikeTargets(match, 0).map(target => target.id), ['guard']);
  assert.throws(() => strikeTcg(match, 0, 'attacker', 'commander'), /Hộ vệ/);
  assert.deepEqual(tcgStrikePreview(match.players[0].units[0], match.players[1].units[0], 3000),
    { damage: 600, absorbed: 150, counter: 300, spill: 0 });
  const after = strikeTcg(match, 0, 'attacker', 'guard');
  assert.equal(after.phase, 'action');
  assert.equal(after.players[0].units[0].current_def, 300);
  assert.deepEqual(after.players[1].units.map(unit => unit.instance_id), ['other']);
  assert.throws(() => strikeTcg(after, 0, 'attacker', 'commander'), /chưa sẵn sàng/);
  assert.equal(strikeTcg(after, 0, 'spare', 'commander').players[1].hp, 2700);
});

test('face-down traps protect identity, enforce the single slot and save recipe progress', () => {
  let match = fresh();
  match.players[0].hand = [card('card_trap_mirror'), card('card_demo_01'), card('card_demo_17')];
  const events = [];
  const capture = ({ detail }) => events.push(detail);
  gameEvents.addEventListener('game-event', capture);
  try {
    match = playTcgCard(match, 0, 'card_trap_mirror');
    const set = events.find(event => event.type === 'trap_set');
    assert.deepEqual(set.payload, { player_index: 0, slot: 0 });
    assert.equal(match.players[0].traps[0].faceDown, true);
    match = passTcgPriority(match, 1);
    assert.match(tcgCardIssue(match, 0, card('card_trap_roots')), /đã đầy/);
    match = passTcgPriority(playTcgCard(match, 0, 'card_demo_01', null, 2), 1);
    assert.equal(tcgRecipeFor(match, 0, match.players[0].hand[0]), 'fire');
    match = resolve(playTcgCard(JSON.parse(JSON.stringify(match)), 0, 'card_demo_17', 'commander'));
    assert.equal(match.players[1].hp, 3000 - card('card_demo_17').effect.value - 100);
    assert.equal(match.players[0].hand.length, 1);
    assert.equal(events.filter(event => event.type === 'tcg_recipe_resolved').length, 1);
  } finally {
    gameEvents.removeEventListener('game-event', capture);
  }
});

test('mana stops at seven and empty decks take increasing capped fatigue', () => {
  let match = fresh();
  match.players[1].deck = [];
  for (let round = 1; round <= 4; round++) {
    match = endTcgTurn(match, 0);
    assert.equal(match.players[1].maxMana, 7);
    assert.equal(match.players[1].hp, 3000 - [100, 300, 600, 900][round - 1]);
    match = endTcgTurn(match, 1);
  }
});
