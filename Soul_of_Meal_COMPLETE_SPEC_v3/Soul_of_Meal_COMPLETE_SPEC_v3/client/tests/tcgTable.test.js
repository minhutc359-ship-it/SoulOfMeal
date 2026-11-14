import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gameEvents } from '../src/core/events.js';
import { advanceTcgResponses, createTcgChallenge, createTcgMatch, decideTcgTrap, endTcgTurn, mulliganTcg, passTcgPriority, playTcgCard,
  strikeTcg, tcgCardIssue, tcgStrikePreview, tcgStrikeTargets, tcgSpellTargets, tcgTableDeck, validateDeck } from '../src/modes/tcg.js';
import { TCG_TABLE_VERSION, TCG_COMPACT_TABLE_VERSION, tcgBoardLimit, tcgTrapLimit, tcgRecipeFor } from '../src/modes/tcgCards.js';
import { tcgTrapArmed } from '../src/modes/tcgTraps.js';

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
  assert.throws(() => playTcgCard(match, 0, 'card_demo_01', null, 5), /trống/);
  const next = playTcgCard(match, 0, 'card_demo_01', null, 3);
  assert.equal(JSON.stringify(match), before);
  const summoned = next.players[0].units.at(-1);
  assert.equal(summoned.lane, 3);
  assert.equal(summoned.shield, 100);
  assert.equal(playTcgCard(match, 0, 'card_demo_01').players[0].units.at(-1).lane, 0);
});

test('table clicks can resolve an uncontested spell while retaining real responses and trap choices', () => {
  const match = fresh();
  const spell = card('card_demo_11');
  const response = card('card_tcg_refute');
  match.players[0].hand = [spell];
  const cast = playTcgCard(match, 0, spell.instance_id, 'commander');
  assert.equal(advanceTcgResponses(cast).players[1].hp, 2500);
  // The next spell is an enemy effect, so the refute in hand is a real response.
  const enemy = fresh();
  enemy.players[0].hand = [response];
  enemy.players[1].hand = [spell];
  enemy.priority = 1;
  const queued = advanceTcgResponses(playTcgCard(enemy, 1, spell.instance_id, 'commander'));
  assert.equal(queued.phase, 'reaction');
  assert.equal(queued.priority, 0);
  const trap = card('card_demo_16');
  enemy.players[0].hand = [];
  enemy.players[0].traps = [{ card: trap, setRound: 1, setTurn: 1, token: 1, faceDown: true }];
  const pending = advanceTcgResponses(playTcgCard(enemy, 1, spell.instance_id, 'commander'));
  assert.equal(pending.phase, 'trap_choice');
  const revealed = advanceTcgResponses(decideTcgTrap(pending, 0, trap.instance_id));
  assert.equal(revealed.players[0].hp, 3400);
  assert.ok(revealed.log.some(entry => entry.type === 'stack_item_countered'));
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

test('face-down traps protect identity and keep recipe progress in old compact matches', () => {
  let match = fresh();
  match.rulesVersion = TCG_COMPACT_TABLE_VERSION;
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

test('the challenges draw their opening piece from the opponent deck and keep the rest of the match deterministic', () => {
  for (const scenario of catalog.table_challenges) {
    const match = createTcgChallenge(catalog, deck, 41, scenario.id);
    assert.deepEqual(match, createTcgChallenge(catalog, deck, 41, scenario.id));
    const bot = match.players[1];
    assert.equal(match.challengeId, scenario.id);
    assert.equal(bot.hp, scenario.commander_hp);
    assert.equal(bot.hand.length, 4);
    const owned = [...bot.deck, ...bot.hand, ...bot.units, ...bot.traps.map(trap => trap.card)];
    assert.equal(new Set(owned.map(card => card.instance_id)).size, 24);
    if (scenario.opening_trap) {
      assert.ok(bot.traps[0].faceDown);
      assert.ok(tcgTrapArmed(match, bot.traps[0]));
    } else assert.equal(bot.units[0].card_id, scenario.opening_unit);
  }
});

test('shatter breaks shields before applying damage and recall removes a guard without duplicating the unit', () => {
  let match = fresh();
  const [ally, enemy] = match.players;
  ally.hand = [card('card_ember_break'), card('card_mist_recall')];
  enemy.units = [unit('card_jade_watch', 'guard', 1, { shield: 500, keywords: ['guard'], rootedUntil: 6 })];
  match = resolve(playTcgCard(match, 0, 'card_ember_break', 'guard'));
  assert.equal(match.players[1].units[0].current_def, 320);
  assert.equal(match.players[1].units[0].shield, undefined);
  if (match.priority === 1) match = passTcgPriority(match, 1);
  match = resolve(playTcgCard(match, 0, 'card_mist_recall', 'guard'));
  assert.equal(match.players[1].units.length, 0);
  const returned = match.players[1].hand[0];
  assert.equal(returned.instance_id, 'guard');
  assert.equal(returned.current_def, undefined);
  assert.equal(returned.rootedUntil, undefined);
  assert.equal(match.players[1].graveyard.length, 0);
  assert.equal(tcgStrikeTargets(match, 0).at(-1).id, 'commander');
});

test('revive targets an exact grave entry and does not restore a spent strike', () => {
  let match = fresh();
  const ally = match.players[0];
  ally.graveyard = [unit('card_night_reaper', 'fallen-a', 2, { current_def: 0, struckTurn: 3 }),
    unit('card_night_reaper', 'fallen-b', 2, { current_def: 0, shield: 300 })];
  ally.hand = [card('card_leaf_reclaim'), card('card_jade_encore')];
  match = resolve(playTcgCard(match, 0, 'card_leaf_reclaim', 'grave:fallen-b'));
  const revived = match.players[0].units[0];
  assert.equal(revived.instance_id, 'fallen-b');
  assert.equal(revived.current_def, 540);
  assert.equal(revived.ready, false);
  assert.equal(revived.shield, undefined);
  assert.ok(match.players[0].graveyard.some(item => item.instance_id === 'fallen-a'));
  assert.deepEqual(tcgSpellTargets(match, 0, card('card_jade_encore')), []);
});

test('weaken applies during a strike, expires at turn change and rally only readies a unit that struck', () => {
  let match = fresh();
  const [ally, enemy] = match.players;
  ally.units = [unit('card_ember_runner', 'runner', 0)];
  ally.hand = [card('card_jade_encore')];
  enemy.hand = [card('card_mist_dampen')];
  assert.deepEqual(tcgSpellTargets(match, 0, ally.hand[0]), []);
  match = strikeTcg(match, 0, 'runner', 'commander');
  assert.equal(match.priority, 1);
  match = resolve(playTcgCard(match, 1, 'card_mist_dampen', 'runner'));
  assert.equal(match.players[1].hp, 2840);
  match = playTcgCard(match, 0, 'card_jade_encore', 'runner');
  assert.ok(match.players[0].units[0].ready);
  match = strikeTcg(match, 0, 'runner', 'commander');
  assert.equal(match.players[1].hp, 2680);
  match = endTcgTurn(match, 0);
  assert.equal(match.players[0].units[0].attackBuff, undefined);
});

test('Dạ Yến drains only damage through shields and the mist trap can reduce an attack to zero', () => {
  let match = fresh();
  const [ally, enemy] = match.players;
  ally.hp = 2600;
  ally.hand = [card('card_night_feast')];
  enemy.units = [unit('card_jade_watch', 'target', 0, { shield: 410 })];
  match = resolve(playTcgCard(match, 0, 'card_night_feast', 'target'));
  assert.equal(match.players[0].hp, 2710);
  assert.equal(match.players[1].units[0].current_def, 490);

  match = fresh();
  match.players[0].units = [unit('card_demo_01', 'attacker', 0)];
  match.players[1].traps = [{ card: card('card_trap_mist'), faceDown: true, setRound: 0, setTurn: 0, token: 1 }];
  match = strikeTcg(match, 0, 'attacker', 'commander');
  assert.equal(match.phase, 'trap_choice');
  match = resolve(decideTcgTrap(match, 1, 'card_trap_mist'));
  assert.equal(match.players[1].hp, 3000);
  assert.equal(match.players[0].units[0].attackBuff, -300);
});

test('the ward trap protects survivors and the dusk trap draws even from a full board', () => {
  const armed = id => ({ card: card(id), faceDown: true, setRound: 0, setTurn: 0, token: 1 });
  let match = fresh();
  match.players[0].hand = [card('card_demo_01')];
  match.players[1].traps = [armed('card_trap_jade')];
  match.players[1].units = [unit('card_demo_04', 'first', 0), unit('card_demo_02', 'second', 3)];
  match = playTcgCard(match, 0, 'card_demo_01');
  assert.equal(match.phase, 'trap_choice');
  match = resolve(decideTcgTrap(match, 1, 'card_trap_jade'));
  assert.deepEqual(match.players[1].units.map(item => item.shield), [250, 250]);

  match = fresh();
  const [ally, enemy] = match.players;
  ally.hand = [card('card_ember_runner')];
  ally.units = [unit('card_ember_runner', 'runner', 0)];
  enemy.traps = [armed('card_trap_night')];
  enemy.units = Array.from({ length: 4 }, (_, lane) => unit('card_jade_watch', 'enemy-' + lane, lane,
    { current_def: lane === 0 ? 200 : 600, keywords: ['guard'] }));
  match = strikeTcg(match, 0, 'runner', 'enemy-0');
  assert.equal(match.phase, 'trap_choice');
  match = resolve(decideTcgTrap(match, 1, 'card_trap_night'));
  assert.equal(match.players[1].hand.length, 2);
  assert.equal(match.players[1].graveyard.filter(item => item.type === 'unit').length, 1);
});


test('new tables fill five unit lanes and preserve both trap positions across removal and reload', () => {
  let match = fresh();
  assert.equal(tcgBoardLimit(match), 5);
  assert.equal(tcgTrapLimit(match), 2);
  match.players[0].hand = [
    ...Array.from({ length: 6 }, (_, index) => ({ ...card('card_demo_01'), instance_id: 'unit-' + index, cost: 0 })),
    { ...card('card_trap_mirror'), cost: 0 }, { ...card('card_trap_roots'), cost: 0 },
  ];
  for (let index = 0; index < 5; index++) {
    match = passTcgPriority(playTcgCard(match, 0, 'unit-' + index), 1);
    assert.equal(match.players[0].units.at(-1).lane, index);
  }
  assert.throws(() => playTcgCard(match, 0, 'unit-5'), /đủ Vị Linh/);
  match = passTcgPriority(playTcgCard(match, 0, 'card_trap_roots', 'set:1'), 1);
  assert.throws(() => playTcgCard(match, 0, 'card_trap_mirror', 'set:1'), /ô bẫy còn trống/);
  match = passTcgPriority(playTcgCard(match, 0, 'card_trap_mirror', 'set:0'), 1);
  assert.match(tcgCardIssue(match, 0, card('card_trap_roots')), /đã đầy/);
  match = JSON.parse(JSON.stringify(endTcgTurn(match, 0)));
  const disarm = { ...catalog.cards.find(item => item.effect?.kind === 'disarm_trap'), instance_id: 'disarm', cost: 0 };
  match.players[1].hand = [disarm];
  const targets = tcgSpellTargets(match, 1, disarm);
  assert.equal(targets.length, 2);
  match = resolve(playTcgCard(match, 1, 'disarm', targets.find(target => target.slot === 0).id));
  assert.deepEqual(match.players[0].traps.map(trap => trap.slot), [1]);
  assert.equal(match.players[0].graveyard.find(item => item.card_id === 'card_trap_mirror').hidden, true);
});
