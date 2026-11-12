import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gameEvents } from '../src/core/events.js';
import { createDefaultSave, migrateSave } from '../src/core/save.js';
import {
  assignTcgBlockers, attackTcg, canPlayTcgCard, createTcgMatch, declaredTcgAttackers,
  endTcgTurn, passTcgPriority, playTcgCard, runBotPriority, runTcgBot, tcgPresetDeck, tcgSpellTargets,
} from '../src/modes/tcg.js';
import { planTcgAttacks, planTcgBlocks } from '../src/modes/tcgStrategy.js';

const readJson = async file => JSON.parse(await readFile(new URL('../../examples/cards/' + file, import.meta.url)));
const [catalog, deck] = await Promise.all([readJson('cards.catalog.json'), readJson('starter_deck.json')]);

function card(cardId, instanceId) {
  return { ...structuredClone(catalog.cards.find(entry => entry.card_id === cardId)), instance_id: instanceId };
}

function unit(id, lane, atk, def, ready = true) {
  return { ...card('card_demo_01', id), lane, atk, max_def: def, current_def: def, ready };
}

function combat(active = 0) {
  const match = createTcgMatch(catalog, deck);
  Object.assign(match, { activePlayer: active, priority: active, phase: 'combat', round: 2 });
  match.players.forEach(player => { player.hand = []; });
  return match;
}

test('TCG support spells require eligible allies and resolve through their own timing rules', () => {
  let match = combat();
  const heal = card('card_spirit_renewal', 'heal');
  const ward = card('card_spirit_ward', 'ward');
  const boost = card('card_spirit_rally', 'boost');
  Object.assign(match, { phase: 'action' });
  Object.assign(match.players[0], {
    mana: 10, hand: [heal, ward, boost],
    units: [{ ...unit('wounded', 0, 650, 1000), current_def: 770 }, unit('healthy', 2, 550, 1100)],
  });
  match.players[1].units = [{ ...unit('enemy', 3, 900, 900), current_def: 300 }];
  assert.deepEqual(tcgSpellTargets(match, 0, heal).map(item => item.id), ['wounded']);
  assert.throws(() => playTcgCard(match, 0, heal.instance_id, 'enemy'), /mục tiêu hợp lệ/);
  match = playTcgCard(match, 0, 'heal', 'wounded');
  assert.equal(match.players[0].units[0].current_def, 770);
  assert.equal(match.phase, 'reaction');
  match = passTcgPriority(match, 1);
  assert.equal(canPlayTcgCard(match, 0, boost), false);
  match = playTcgCard(match, 0, 'ward', 'wounded');
  assert.equal(match.priority, 0);
  assert.equal(match.stack.length, 1);
  assert.equal(match.players[0].units[0].shield, 400);
  match = passTcgPriority(passTcgPriority(match, 0), 1);
  assert.equal(match.players[0].units[0].current_def, 1000);
  assert.equal(match.phase, 'action');
  assert.equal(match.priority, 0);
  match = playTcgCard(match, 0, 'boost', 'wounded');
  assert.equal(match.players[0].units[0].attackBuff, 360);
  match = passTcgPriority(passTcgPriority(match, 1), 0);
  match = assignTcgBlockers(attackTcg(match, 0, ['wounded']), 1, [{ lane: 0, blockerId: 'enemy' }]);
  assert.equal(match.players[0].units[0].current_def, 500);
  assert.equal(match.players[0].units[0].shield, 0);
  assert.equal(match.players[1].units.length, 0);
  match = endTcgTurn(match, 0);
  assert.equal(match.players[0].units[0].shield, undefined);
  assert.equal(match.players[0].units[0].attackBuff, undefined);
});

test('TCG presets remain legal and advanced tactics account for trades and commander HP', () => {
  const guard = tcgPresetDeck(catalog, deck, 'guard');
  const assault = tcgPresetDeck(catalog, deck, 'assault');
  assert.equal(guard.cards.reduce((sum, item) => sum + item.count, 0), 36);
  assert.equal(assault.cards.reduce((sum, item) => sum + item.count, 0), 36);
  assert.ok(guard.cards.some(item => item.card_id === 'card_spirit_ward'));
  assert.ok(assault.cards.some(item => item.card_id === 'card_spirit_rally'));
  const match = createTcgMatch(catalog, guard, 41, assault, 'extreme');
  assert.equal(match.difficulty, 'extreme');
  assert.ok([...match.players[1].hand, ...match.players[1].deck].some(item => item.card_id === 'card_spirit_rally'));
  const attacker = unit('strong', 0, 1500, 2200);
  const defender = unit('fragile', 3, 180, 200);
  assert.deepEqual(planTcgBlocks([attacker], [defender], 1300, 'extreme').blocks, [{ lane: 0, blockerId: 'fragile' }]);
  const weak = unit('weak', 4, 200, 200);
  assert.deepEqual(planTcgAttacks([weak], [attacker], 7500), []);
});

test('a chosen attacker exchanges damage with an assigned blocker from another lane', () => {
  const match = combat();
  match.players[0].units = [unit('attacker', 0, 1200, 1000), unit('reserve', 1, 1100, 1000)];
  match.players[1].units = [unit('blocker', 4, 700, 1500, false)];
  assert.throws(() => attackTcg(match, 0, ['attacker', 'attacker']));
  assert.throws(() => attackTcg(match, 0, ['missing']));
  const pending = attackTcg(match, 0, ['attacker']);
  assert.equal(pending.phase, 'block_assign');
  assert.deepEqual(declaredTcgAttackers(pending).map(actor => actor.instance_id), ['attacker']);
  assert.equal(pending.players[0].units[1].ready, true);
  assert.throws(() => assignTcgBlockers(pending, 0, []));
  assert.throws(() => assignTcgBlockers(pending, 1, [{ lane: 1, blockerId: 'blocker' }]));
  const after = assignTcgBlockers(pending, 1, [{ lane: 0, blockerId: 'blocker' }]);
  assert.equal(after.players[1].hp, 8000);
  assert.equal(after.players[0].units[0].current_def, 300);
  assert.equal(after.players[1].units[0].current_def, 300);
  assert.equal(after.players[1].units[0].lane, 4);
  assert.equal(after.phase, 'round_end');
  assert.equal(after.pendingAttack, null);
  assert.equal(pending.players[0].units[0].current_def, 1000);
});

test('the bot yields to the defender, preserves the decision across save/reload, and rejects duplicate assignments', () => {
  const match = combat(1);
  match.players[1].units = [unit('a', 0, 1200, 1000), unit('b', 1, 500, 1000)];
  match.players[0].units = [unit('blocker', 2, 700, 1500), unit('second', 4, 100, 800)];
  const pending = runTcgBot(match, { yieldToPlayer: true });
  assert.equal(pending.phase, 'block_assign');
  assert.equal(pending.priority, 0);
  const save = createDefaultSave();
  save.modes.tcg = pending;
  const restored = migrateSave(JSON.parse(JSON.stringify(save))).modes.tcg;
  assert.throws(() => assignTcgBlockers(restored, 0, [{ lane: 0, blockerId: 'blocker' }, { lane: 1, blockerId: 'blocker' }]));
  assert.throws(() => assignTcgBlockers(restored, 0, [{ lane: 0, blockerId: 'blocker' }, { lane: 0, blockerId: 'second' }]));
  assert.throws(() => assignTcgBlockers(restored, 0, [{ lane: 0, blockerId: 'a' }]));
  const after = runTcgBot(assignTcgBlockers(restored, 0, [{ lane: 0, blockerId: 'blocker' }]), { yieldToPlayer: true });
  assert.equal(after.players[0].hp, 7500);
  assert.equal(after.players[0].units[0].current_def, 300);
  assert.equal(after.activePlayer, 0);
  assert.equal(after.round, 3);
});

test('bot defense prioritizes the stronger lane and may assign its unit across lanes', () => {
  const match = combat();
  match.players[0].units = [unit('weak', 1, 450, 1000), unit('strong', 2, 1200, 1100)];
  match.players[1].units = [unit('guard', 1, 400, 1400)];
  const after = runBotPriority(attackTcg(match, 0));
  assert.equal(after.players[1].hp, 7550);
  assert.equal(after.players[0].units[0].current_def, 1000);
  assert.equal(after.players[0].units[1].current_def, 700);
  assert.equal(after.players[1].units[0].current_def, 200);
});

test('a response spell can remove a blocker and open the lane before damage resolves', () => {
  const match = combat();
  const spell = card('card_demo_10', 'fast');
  match.players[0].hand = [spell];
  match.players[0].mana = 10;
  match.players[0].units = [unit('attacker', 0, 1200, 1000)];
  match.players[1].units = [unit('blocker', 4, 700, spell.effect.value)];
  let pending = attackTcg(match, 0);
  pending = assignTcgBlockers(pending, 1, [{ lane: 0, blockerId: 'blocker' }]);
  assert.equal(pending.phase, 'reaction');
  pending = passTcgPriority(pending, 1);
  pending = playTcgCard(pending, 0, spell.instance_id, 'blocker');
  pending = passTcgPriority(passTcgPriority(pending, 1), 0);
  assert.equal(pending.players[1].units.length, 0);
  assert.equal(pending.players[1].hp, 8000);
  assert.equal(pending.phase, 'reaction');
  assert.equal(pending.pendingAttack.blocks.length, 1);
  const after = passTcgPriority(passTcgPriority(pending, 1), 0);
  assert.equal(after.players[1].hp, 6800);
  assert.equal(after.phase, 'round_end');
});

test('a face-down attack trap stays private until reveal and cancels once', () => {
  const match = combat();
  const trap = card('card_demo_14', 'trap');
  match.players[1].hand = [trap];
  match.players[1].mana = 10;
  const events = [];
  const record = event => events.push(event.detail);
  gameEvents.addEventListener('game-event', record);
  try {
    const set = playTcgCard({ ...match, phase: 'action', priority: 1 }, 1, trap.instance_id);
    assert.equal(events.at(-1).type, 'trap_set');
    assert.equal(events.at(-1).payload.card_id, undefined);
    set.players[0].units = [unit('attacker', 0, 1200, 1000)];
    const pending = attackTcg({ ...set, round: 3, phase: 'combat' }, 0);
    assert.equal(pending.stack.length, 1);
    assert.equal(events.at(-1).type, 'trap_revealed');
    assert.equal(events.at(-1).payload.card_id, trap.card_id);
    const stopped = passTcgPriority(passTcgPriority(pending, 0), 1);
    // Old saved matches only carried attackerIds, playerIndex and canceled.
    delete stopped.pendingAttack.blocks;
    const after = passTcgPriority(passTcgPriority(stopped, 0), 1);
    assert.equal(after.players[1].hp, 8000);
    assert.equal(after.players[1].graveyard.filter(entry => entry.instance_id === trap.instance_id).length, 1);
    assert.equal(after.pendingAttack, null);
  } finally {
    gameEvents.removeEventListener('game-event', record);
  }
});
