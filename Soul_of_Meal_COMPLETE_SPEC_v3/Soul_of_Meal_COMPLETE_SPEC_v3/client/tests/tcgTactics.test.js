import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gameEvents } from '../src/core/events.js';
import { createDefaultSave, migrateSave } from '../src/core/save.js';
import {
  assignTcgBlockers, attackTcg, createTcgMatch, decideTcgTrap, endTcgTurn, passTcgPriority, playTcgCard,
  runTcgBot, tcgCardIssue, tcgExposedDamage, tcgPresetDeck, tcgSpellTargets,
} from '../src/modes/tcg.js';
import { tcgCardCost, tcgEffectText, tcgTurnSerial } from '../src/modes/tcgCards.js';
import { tcgTrapArmed, tcgTrapOptions, tcgTrapRule } from '../src/modes/tcgTraps.js';

const read = async file => JSON.parse(await readFile(new URL('../../examples/cards/' + file, import.meta.url)));
const [catalog, starter] = await Promise.all([read('cards.catalog.json'), read('starter_deck.json')]);

function fixture(phase = 'action', player = 0) {
  const match = createTcgMatch(catalog, starter);
  Object.assign(match, { round: 3, phase, activePlayer: player, priority: player, mulliganDone: true });
  for (const entrant of match.players) Object.assign(entrant, { hand: [], mana: 10, maxMana: 10 });
  return match;
}

function card(id, instanceId = id) {
  const definition = catalog.cards.find(item => item.card_id === id);
  assert.ok(definition, id);
  return { ...structuredClone(definition), instance_id: instanceId };
}

function unit(id, lane, fields = {}) {
  const base = card(id, id + ':' + lane);
  return { ...base, lane, current_def: base.max_def, ready: true, ...fields };
}

function arm(match, owner, id, token = 1) {
  const played = card(id);
  match.players[owner].traps.push({ card: played, faceDown: true, setTurn: tcgTurnSerial(match) - 1, setRound: match.round - 1, token });
  match.nextTrapId = Math.max(match.nextTrapId, token + 1);
  return played;
}

function passBoth(match) {
  const first = passTcgPriority(match, match.priority);
  return passTcgPriority(first, first.priority);
}

function roundTrip(match) {
  const save = createDefaultSave();
  save.modes.tcg = match;
  return migrateSave(JSON.parse(JSON.stringify(save))).modes.tcg;
}

test('the catalog has legal themed decks and a playable rule for every spell and trap', () => {
  assert.equal(catalog.cards.length, 60);
  assert.equal(catalog.cards.filter(item => item.type === 'trap').length, 12);
  assert.equal(catalog.cards.filter(item => item.requires_character).length, 5);
  for (const preset of catalog.presets) {
    const deck = tcgPresetDeck(catalog, starter, preset.id);
    assert.equal(deck.cards.reduce((sum, entry) => sum + entry.count, 0), 36);
    assert.equal(createTcgMatch(catalog, deck).players[0].deck.length, 32);
  }
  for (const item of catalog.cards) {
    if (item.type === 'trap') assert.ok(tcgTrapRule(item), item.card_id);
    if (item.type.endsWith('_spell')) assert.ok(tcgEffectText(item), item.card_id);
  }
});

test('a trap stays private and can be held after arming on the next turn in the same round', t => {
  let match = fixture();
  const trap = card('card_demo_16', 'hidden-fire');
  const spellA = card('card_demo_11', 'spell-a');
  const spellB = card('card_demo_12', 'spell-b');
  match.players[0].hand = [trap];
  match.players[1].hand = [spellA, spellB];
  const observed = [];
  const record = event => observed.push(event.detail);
  gameEvents.addEventListener('game-event', record);
  t.after(() => gameEvents.removeEventListener('game-event', record));

  match = playTcgCard(match, 0, trap.instance_id);
  assert.equal(tcgTrapArmed(match, match.players[0].traps[0]), false);
  assert.equal(observed.at(-1).type, 'trap_set');
  assert.equal(observed.at(-1).payload.card_id, undefined);
  assert.equal(observed.at(-1).payload.element, undefined);
  assert.equal(JSON.stringify(match.log).includes(trap.display_name), false);
  match = playTcgCard(match, 1, spellA.instance_id, 'commander');
  assert.equal(match.phase, 'reaction');
  match = passBoth(match);
  assert.equal(match.players[0].hp, 7500);

  match = endTcgTurn({ ...match, phase: 'round_end' }, 0);
  assert.equal(match.round, 3);
  assert.equal(tcgTrapArmed(match, match.players[0].traps[0]), true);
  match = playTcgCard(match, 1, spellB.instance_id, 'commander');
  assert.equal(match.phase, 'trap_choice');
  const restored = roundTrip(match);
  assert.deepEqual(runTcgBot(restored, { yieldToPlayer: true }), restored);
  assert.deepEqual(tcgTrapOptions(restored).map(slot => slot.card.instance_id), ['hidden-fire']);
  assert.throws(() => decideTcgTrap(restored, 1, trap.instance_id), /chọn bẫy/);
  assert.throws(() => decideTcgTrap(restored, 0, 'missing'), /không thể/);
  match = decideTcgTrap(restored, 0);
  assert.equal(match.players[0].traps.length, 1);
  match = passBoth(match);
  assert.equal(match.players[0].hp, 6970);
  assert.ok(observed.every(event => event.type !== 'trap_revealed'));
});

test('a revealed trap occupies the response stack and can be countered exactly once', t => {
  let match = fixture('combat');
  match.players[0].units = [unit('card_demo_01', 0, { atk: 1000 })];
  const refute = card('card_tcg_refute');
  match.players[0].hand = [refute];
  const trap = arm(match, 1, 'card_demo_14');
  const observed = [];
  const record = event => { if (event.detail.type === 'trap_revealed') observed.push(event.detail); };
  gameEvents.addEventListener('game-event', record);
  t.after(() => gameEvents.removeEventListener('game-event', record));

  match = attackTcg(match, 0);
  assert.equal(match.phase, 'trap_choice');
  assert.equal(match.players[1].hp, 8000);
  match = decideTcgTrap(match, 1, trap.instance_id);
  assert.equal(observed.length, 1);
  assert.equal(observed[0].payload.card_id, trap.card_id);
  assert.equal(match.players[1].traps.length, 0);
  assert.equal(match.stack[0].kind, 'trap');
  const target = tcgSpellTargets(match, 0, refute)[0].id;
  match = playTcgCard(match, 0, refute.instance_id, target);
  assert.equal(match.stack.length, 2);
  match = passBoth(match);
  assert.equal(match.phase, 'round_end');
  assert.equal(match.players[1].hp, 7000);
  assert.equal(match.players[1].graveyard.filter(item => item.instance_id === trap.instance_id).length, 1);
  assert.equal(match.players[0].graveyard.filter(item => item.instance_id === refute.instance_id).length, 1);
});

test('attack trap choices account for blocking lanes and reflection leaves other exchanges intact', () => {
  let match = fixture('combat');
  match.players[0].units = [unit('card_demo_01', 0, { atk: 1300 }), unit('card_demo_06', 1, { atk: 450 })];
  match.players[1].units = [unit('card_demo_08', 4, { atk: 200 })];
  const mirror = arm(match, 1, 'card_trap_mirror');
  arm(match, 1, 'card_trap_rally', 2);
  match = attackTcg(match, 0);
  assert.equal(match.phase, 'block_assign');
  match = assignTcgBlockers(match, 1, [{ lane: 1, blockerId: match.players[1].units[0].instance_id }]);
  assert.equal(tcgTrapOptions(match).length, 2);
  match = passBoth(decideTcgTrap(match, 1, mirror.instance_id));
  assert.equal(match.players[0].hp, 7400);
  assert.equal(match.players[1].hp, 8000);
  assert.equal(match.players[0].units[1].current_def, 550);
  assert.equal(match.players[1].units[0].current_def, 800);
  assert.equal(match.players[1].traps[0].card.card_id, 'card_trap_rally');
});

test('a summon resolves its entry shield before a root trap and root expires after the owner turn', () => {
  let match = fixture('action', 1);
  const trap = arm(match, 0, 'card_trap_roots');
  const guard = card('card_lantern_guard');
  match.players[1].hand = [guard];
  match = playTcgCard(match, 1, guard.instance_id);
  assert.equal(match.players[1].units[0].shield, 240);
  assert.equal(match.phase, 'trap_choice');
  match = passBoth(decideTcgTrap(match, 0, trap.instance_id));
  assert.equal(match.phase, 'action');
  assert.equal(match.players[1].units[0].current_def, 1040);
  assert.equal(match.players[1].units[0].shield, 0);
  assert.equal(match.players[1].units[0].rootedUntil, tcgTurnSerial(match));
  match = passBoth(match);
  assert.throws(() => attackTcg(match, 1, [guard.instance_id]), /không hợp lệ/);
  match = endTcgTurn(attackTcg(match, 1, []), 1);
  assert.equal(match.players[1].units[0].rootedUntil, undefined);
});

test('a revival trap restores the exact fallen unit with no entry effect and leaves the graveyard once', () => {
  let match = fixture('action', 1);
  const victim = unit('card_rain_keeper', 0, { current_def: 100, attackBuff: 200, shield: 20 });
  match.players[0].units = [victim];
  const trap = arm(match, 0, 'card_trap_recall');
  const kill = card('card_demo_11');
  match.players[1].hand = [kill];
  match = passBoth(playTcgCard(match, 1, kill.instance_id, victim.instance_id));
  assert.equal(match.phase, 'trap_choice');
  assert.equal(match.players[0].units.length, 0);
  const deckSize = match.players[0].deck.length;
  match = passBoth(decideTcgTrap(roundTrip(match), 0, trap.instance_id));
  const revived = match.players[0].units[0];
  assert.equal(revived.instance_id, victim.instance_id);
  assert.equal(revived.current_def, 400);
  assert.equal(revived.ready, false);
  assert.equal(revived.attackBuff, undefined);
  assert.equal(revived.shield, undefined);
  assert.equal(match.players[0].deck.length, deckSize);
  assert.ok(match.players[0].graveyard.every(item => item.instance_id !== victim.instance_id));
});

test('scout reveals a live trap while disarm keeps hidden card names out of the log', t => {
  let match = fixture();
  const first = arm(match, 1, 'card_trap_rally', 5);
  const hidden = arm(match, 1, 'card_trap_reserve', 8);
  const scout = card('card_tcg_scout');
  const disarm = card('card_tcg_disarm');
  match.players[0].hand = [scout, disarm];
  assert.deepEqual(tcgSpellTargets(match, 0, scout).map(target => target.label), ['Bẫy địch ô 1', 'Bẫy địch ô 2']);
  match = playTcgCard(match, 0, scout.instance_id, 'trap:5');
  assert.equal(match.players[1].traps[0].faceDown, false);
  assert.equal(match.players[1].traps[0].card.card_id, first.card_id);
  assert.equal(match.players[1].traps.length, 2);
  assert.equal(match.priority, 0);
  const observed = [];
  const record = event => observed.push(event.detail);
  gameEvents.addEventListener('game-event', record);
  t.after(() => gameEvents.removeEventListener('game-event', record));
  match = passBoth(playTcgCard(match, 0, disarm.instance_id, 'trap:8'));
  assert.deepEqual(match.players[1].traps.map(slot => slot.card.card_id), [first.card_id]);
  assert.equal(match.players[1].graveyard[0].hidden, true);
  assert.ok(!JSON.stringify(match.log).includes(hidden.display_name));
  assert.ok(!JSON.stringify(observed).includes(hidden.card_id));
});

test('same-element cards resonate once per turn and placing a trap never reveals its element', () => {
  let match = fixture();
  const first = card('card_demo_01');
  const second = card('card_hearth_pepper');
  const third = card('card_fire_guard');
  const trap = card('card_demo_16');
  match.players[0].hand = [first, second, third, trap];
  match = playTcgCard(match, 0, first.instance_id);
  match = passTcgPriority(match, 1);
  assert.equal(tcgCardCost(match, 0, second), 0);
  assert.equal(tcgCardCost(match, 0, trap), 1);
  match = playTcgCard(match, 0, second.instance_id);
  match = passTcgPriority(match, 1);
  assert.equal(match.players[0].mana, 9);
  assert.equal(match.players[0].resonanceUsed, true);
  assert.equal(tcgCardCost(match, 0, third), 2);
  match = playTcgCard(match, 0, trap.instance_id);
  assert.equal(match.players[0].chainElement, null);
  match = endTcgTurn({ ...match, phase: 'round_end' }, 0);
  assert.equal(match.players[0].resonanceUsed, undefined);
});

test('the Fire ultimate hits every enemy and fizzles if its original caster falls in response', t => {
  const match = fixture();
  const flame = card('card_ultimate_fire');
  const hero = unit('card_demo_01', 0, { current_def: 150 });
  match.players[0].hand = [flame];
  match.players[1].units = [unit('card_demo_06', 0, { current_def: 500 }), unit('card_demo_08', 2, { current_def: 900 })];
  assert.match(tcgCardIssue(match, 0, flame), /Vị Linh/);
  match.players[0].units = [hero];
  const queued = playTcgCard(match, 0, flame.instance_id, 'row');
  const casts = [];
  const record = event => { if (event.detail.type === 'tcg_ultimate_resolved') casts.push(event.detail); };
  gameEvents.addEventListener('game-event', record);
  t.after(() => gameEvents.removeEventListener('game-event', record));
  const after = passBoth(queued);
  assert.equal(casts.length, 1);
  assert.equal(casts[0].source_id, hero.instance_id);
  assert.deepEqual(after.players[1].units.map(unit => unit.current_def), [280]);
  assert.equal(after.players[1].hp, 8000);
  const response = card('card_demo_11');
  queued.players[1].hand = [response];
  const sniped = passBoth(playTcgCard(queued, 1, response.instance_id, hero.instance_id));
  const fizzled = passBoth(sniped);
  assert.equal(fizzled.players[0].units.length, 0);
  assert.equal(fizzled.players[1].units.length, 2);
  assert.equal(casts.length, 1);
});

test('pierce and drain count the damage left after a blocker’s shield and remaining DEF', () => {
  let match = fixture('combat');
  const attacker = unit('card_shadow_hunter', 0);
  const blocker = unit('card_demo_06', 2, { current_def: 300, shield: 100 });
  match.players[0].hp = 6000;
  match.players[0].units = [attacker];
  match.players[1].units = [blocker];
  const blocks = [{ lane: 0, blockerId: blocker.instance_id }];
  assert.equal(tcgExposedDamage([attacker], [blocker], blocks), 320);
  match = assignTcgBlockers(attackTcg(match, 0), 1, blocks);
  assert.equal(match.players[1].hp, 7680);
  assert.equal(match.players[0].hp, 6217);
  assert.equal(match.players[0].units[0].current_def, 330);
});
