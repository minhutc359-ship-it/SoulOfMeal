import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createDefaultSave,
  migrateSave,
  persistSave,
} from "../src/core/save.js";
import {
  createTcgMatch,
  createPresetDeck,
  validateDeck,
  playTcgCard,
  passTcgPriority,
  attackTcg,
  endTcgTurn,
  stepTcgBot,
  mulliganTcg,
  surrenderTcg,
} from "../src/modes/tcg.js";
import {
  createChessRun,
  buyChessOffer,
  placeChessUnit,
  benchChessUnit,
  buyChessExperience,
  chessSynergies,
  chessStats,
  equipChessItem,
  sellChessUnit,
  startChessCombat,
  advanceChessRound,
} from "../src/modes/autoChess.js";
import {
  createAdventureState,
  beginBattle,
  stepAdventure,
  claimBattleResult,
  interactAdventure,
  transitionMap,
  solveAdventurePuzzle,
  upgradeAdventureCharacter,
  refineAdventureMaterial,
} from "../src/modes/adventure.js";
import { createAdventureMapRegistry } from "../src/modes/mapCatalog.js";
import {
  findAdventurePath,
  collidesWithWorld,
} from "../src/modes/adventureNavigation.js";
import { gameEvents } from "../src/core/events.js";
import { trackForContext } from "../src/core/audio.js";
const read = async (path) =>
  JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), "utf8"));
const catalog = await read("examples/cards/cards.catalog.json");
const deck = await read("examples/cards/starter_deck.json");
const units = (await read("examples/auto_chess/units.json")).units;
const odds = await read("examples/auto_chess/shop_odds.json");
const mapList = await Promise.all(
  ["village", "forest", "coast", "volcano", "mist", "ruins"].map((id) =>
    read(`examples/maps/${id}.json`),
  ),
);
const maps = createAdventureMapRegistry(mapList);
const match = () => createTcgMatch(catalog, deck, 41);
const card = (index, instance = `test:${index}`) => ({
  ...structuredClone(catalog.cards[index - 1]),
  instance_id: instance,
});
const fieldUnit = (index, lane = 0) => {
  const unit = card(index);
  return { ...unit, current_def: unit.max_def, lane, ready: true };
};
const resolveSpell = (state) =>
  passTcgPriority(passTcgPriority(state, state.priority), 1 - state.priority);

test("v2 migration keeps progress and resources, drops removed voice state and closes incompatible games", () => {
  const old = {
    ...createDefaultSave(),
    version: 2,
    player: { gold: 777 },
    settings: { voice: 100 },
    modes: { chess: { phase: "result" }, tcg: { phase: "combat" } },
  };
  const saved = migrateSave(old);
  assert.equal(saved.player.gold, 777);
  assert.equal(saved.settings.voice, undefined);
  assert.equal(saved.version, 3);
  assert.deepEqual(saved.modes, { tcg: null, chess: null });
});
test("unavailable storage does not crash gameplay", () =>
  assert.equal(
    persistSave(createDefaultSave(), {
      setItem() {
        throw new Error("quota");
      },
    }),
    false,
  ));
test("every TCG preset is legal and uses a shared character ID for unit art", () => {
  for (const id of ["balanced", "fire", "water", "wood"])
    assert.doesNotThrow(() => validateDeck(createPresetDeck(id), catalog));
  assert.ok(
    catalog.cards
      .filter((item) => item.type === "unit")
      .every((item) => item.character_id && item.role),
  );
});
test("mulligan conserves instances and cannot happen after the first action", () => {
  const original = match();
  const all = original.players[0].deck
    .concat(original.players[0].hand)
    .map((item) => item.instance_id)
    .sort();
  const next = mulliganTcg(
    original,
    0,
    original.players[0].hand.map((item) => item.instance_id),
  );
  assert.deepEqual(
    next.players[0].deck
      .concat(next.players[0].hand)
      .map((item) => item.instance_id)
      .sort(),
    all,
  );
  assert.equal(next.players[0].hand.length, 4);
  assert.throws(() => mulliganTcg(next, 0, []));
});
test("invalid spell target consumes neither mana nor a hand card", () => {
  const original = match();
  original.players[0].mana = 10;
  original.players[0].hand = [card(11)];
  const snapshot = structuredClone(original);
  assert.throws(() => playTcgCard(original, 0, "test:11", "missing-unit"));
  assert.deepEqual(original, snapshot);
});
test("a target that vanished before resolution fizzles instead of damaging the commander", () => {
  const state = match();
  state.players[0].mana = 10;
  state.players[0].hand = [card(11)];
  state.players[1].units = [fieldUnit(2)];
  let next = playTcgCard(
    state,
    0,
    "test:11",
    state.players[1].units[0].instance_id,
  );
  next.players[1].units = [];
  next = resolveSpell(next);
  assert.equal(next.players[1].hp, 8000);
  assert.equal(next.players[0].graveyard.length, 1);
  assert.ok(next.log.some((entry) => entry.type === "spell_fizzled"));
});
test("lethal combat and mandatory deck-out retain the terminal phase", () => {
  const state = match();
  state.phase = "combat";
  state.players[0].units = [fieldUnit(1)];
  state.players[1].hp = 100;
  const won = attackTcg(state, 0);
  assert.equal(won.phase, "result");
  assert.equal(won.winner, 0);
  const other = match();
  other.phase = "round_end";
  other.players[1].deck = [];
  const deckOut = endTcgTurn(other, 0);
  assert.equal(deckOut.phase, "result");
  assert.equal(deckOut.result, "deck_out");
});
test("guardian prevents choosing the enemy commander and intercepts automatic attacks", () => {
  const state = match();
  state.phase = "combat";
  state.players[0].units = [fieldUnit(1)];
  state.players[1].units = [fieldUnit(4, 4)];
  assert.throws(
    () => attackTcg(state, 0, null, { "test:1": "commander" }),
    /Hộ Vệ/,
  );
  const next = attackTcg(state, 0);
  assert.equal(next.players[1].hp, 8000);
  assert.ok(next.players[1].units[0].current_def < 1250);
});
test("an attack trap may be countered before it cancels the attack", () => {
  const state = match();
  state.round = 2;
  state.phase = "combat";
  state.players[0].units = [fieldUnit(1)];
  state.players[0].mana = 10;
  state.players[0].hand = [card(24)];
  state.players[1].traps = [{ card: card(14), faceDown: true, setRound: 0 }];
  let next = attackTcg(state, 0);
  assert.equal(next.pendingAttack.canceled, false);
  next = playTcgCard(next, 0, "test:24", String(next.stack[0].id));
  next = resolveSpell(next);
  assert.equal(next.pendingAttack.canceled, false);
  next = resolveSpell(next);
  assert.equal(next.players[1].hp, 7700);
  assert.equal(next.phase, "round_end");
});
test("feast grants +500 ATK and expires after two complete rounds", () => {
  const state = match();
  state.players[0].units = [fieldUnit(1)];
  state.players[0].mana = 10;
  state.players[0].hand = [card(19)];
  let next = resolveSpell(playTcgCard(state, 0, "test:19"));
  assert.equal(next.players[0].units[0].atk, 800);
  for (let turn = 0; turn < 4; turn++) {
    next.phase = "round_end";
    next = endTcgTurn(next, next.activePlayer);
  }
  assert.equal(next.round, 3);
  assert.equal(next.players[0].units[0].atk, 300);
});
test("element combo requires three legal paid plays, fires once per round and is not inferred from portraits", () => {
  let state = match();
  state.players[0].mana = 10;
  state.players[0].hand = [card(1), card(2), card(3)];
  state = playTcgCard(state, 0, "test:1");
  state.priority = 0;
  state = playTcgCard(state, 0, "test:2");
  state.priority = 0;
  state = playTcgCard(state, 0, "test:3");
  assert.equal(state.players[1].hp, 7100);
  assert.equal(state.players[0].mana, 4);
  assert.equal(
    state.log.filter((entry) => entry.type === "element_combo").length,
    1,
  );
});
test("bot step never passes human priority, including the human response to a bot spell", () => {
  const state = match();
  state.activePlayer = 1;
  state.priority = 0;
  assert.equal(stepTcgBot(state), state);
  state.priority = 1;
  state.players[1].mana = 10;
  state.players[1].hand = [card(11)];
  const next = stepTcgBot(state);
  assert.equal(next.phase, "reaction");
  assert.equal(next.priority, 0);
  assert.equal(stepTcgBot(next), next);
});
test("surrender is terminal and does not mutate original match", () => {
  const state = match();
  const next = surrenderTcg(state);
  assert.equal(next.winner, 1);
  assert.equal(next.phase, "result");
  assert.equal(state.result, null);
});

test("chess merges stop at three stars, even when nine identical high-star units exist", () => {
  let run = createChessRun(units, odds, 3);
  run.gold = 99;
  run.bench = Array.from({ length: 3 }, (_, index) => ({
    ...units[0],
    star: 3,
    placementOrder: index,
    items: [],
  }));
  run = buyChessOffer(run, 0);
  assert.equal(run.bench.filter((unit) => unit.star === 3).length, 3);
  assert.ok(run.bench.every((unit) => unit.star <= 3));
});
test("a full bench still accepts the purchase that immediately makes a triple", () => {
  let run = createChessRun(units, odds, 3);
  run.gold = 99;
  run.bench = Array.from({ length: 9 }, (_, index) => ({
    ...units[index < 2 ? 0 : 1],
    star: index < 2 ? 1 : 3,
    placementOrder: index,
    items: [],
  }));
  run = buyChessOffer(run, 0);
  assert.equal(run.bench.length, 8);
  assert.equal(run.bench.find((unit) => unit.id === units[0].id).star, 2);
});
test("bench-to-board swap works when the board is at its level cap and recall is reversible", () => {
  let run = createChessRun(units, odds, 3);
  run.gold = 99;
  run = buyChessOffer(run, 0);
  run = buyChessOffer(run, 1);
  run = placeChessUnit(run, 0, 1, 3);
  run = placeChessUnit(run, 0, 2, 3);
  run = buyChessOffer(run, 2);
  // The third copy merged; use a different unit for the swap scenario.
  run.board = [
    { ...units[0], ...chessStats(units[0]), star: 1, x: 1, y: 3, items: [] },
    { ...units[1], ...chessStats(units[1]), star: 1, x: 2, y: 3, items: [] },
  ];
  run.bench = [{ ...units[2], star: 1, items: [] }];
  const next = placeChessUnit(run, 0, 1, 3);
  assert.equal(next.board.length, 2);
  assert.equal(next.board[0].id, units[2].id);
  assert.equal(next.bench[0].id, units[0].id);
  const recalled = benchChessUnit(next, 0);
  assert.equal(recalled.board.length, 1);
  assert.equal(recalled.bench.length, 2);
});
test("XP purchase spends gold, levels deterministically and does not silently buy XP between rounds", () => {
  const run = createChessRun(units, odds, 3);
  const next = buyChessExperience(run);
  assert.equal(next.gold, 6);
  assert.equal(next.level, 3);
  assert.equal(next.experience, 2);
});
test("synergies count unique character identities and change combat stats independently of Adventure", () => {
  const board = [
    { ...units[0], star: 1 },
    { ...units[0], star: 2 },
    { ...units[1], star: 1 },
    { ...units[2], star: 1 },
  ];
  const traits = chessSynergies(board);
  assert.equal(traits.find((trait) => trait.id === "cuisine").count, 3);
  assert.equal(traits.find((trait) => trait.id === "cuisine").tier, 1);
  assert.equal(traits.find((trait) => trait.id === "fire").count, 1);
});
test("equipped items alter chess stats and return to inventory on sale", () => {
  let run = createChessRun(units, odds, 3);
  run = buyChessOffer(run, 0);
  run.inventory = ["spice_blade"];
  const before = run.bench[0].atk;
  run = equipChessItem(run, "bench", 0, 0);
  assert.equal(run.bench[0].atk, before + 24);
  assert.equal(run.inventory.length, 0);
  run = sellChessUnit(run, "bench", 0);
  assert.deepEqual(run.inventory, ["spice_blade"]);
});
test("eight-player tournament has deterministic rounds, evolving bot economy and legal attack ranges", () => {
  let first = createChessRun(units, odds, 73);
  first = buyChessOffer(first, 0);
  first = placeChessUnit(first, 0, 3, 3);
  const a = startChessCombat(first),
    b = startChessCombat(first);
  assert.deepEqual(a, b);
  assert.equal(a.opponents.length, 7);
  assert.ok(
    a.opponents.every((bot) => bot.gold >= 0 && bot.board.length <= bot.level),
  );
  assert.ok(a.opponents.some((bot) => bot.board.length > 0));
  for (const event of a.combat.events.filter(
    (entry) => entry.type === "hit_resolved" && entry.payload.source_position,
  ))
    assert.ok(event.payload.distance <= event.payload.range);
  for (const frame of a.combat.frames) {
    const alive = frame.actors.filter((unit) => unit.hp > 0);
    assert.equal(
      new Set(alive.map((unit) => `${unit.x},${unit.y}`)).size,
      alive.length,
    );
  }
});
test("tournament can actually reach TOP 1 instead of stopping after ten rounds", () => {
  let run = createChessRun(units, odds, 31);
  run.round = 11;
  run.stage = 4;
  for (const bot of run.opponents) {
    bot.hp = 1;
    bot.gold = 0;
    bot.board = [
      { ...units[0], star: 1, x: 3, y: 3, items: [], placementOrder: 0 },
    ];
  }
  run.board = units.map((unit, index) => ({
    ...unit,
    ...chessStats(unit, 3),
    star: 3,
    x: index,
    y: 3,
    items: [],
    placementOrder: index,
  }));
  run.level = 9;
  for (let round = 0; round < 100 && run.phase !== "finished"; round++) {
    run = startChessCombat(run);
    run = advanceChessRound(run);
  }
  assert.equal(run.phase, "finished");
  assert.equal(run.placement, 1);
  assert.ok(run.opponents.every((bot) => bot.hp === 0));
  assert.ok(run.round > 10);
});

test("all six maps validate and every interaction is reachable from its authored spawn", () => {
  for (const map of mapList)
    for (const target of map.interactables) {
      const path = findAdventurePath(
        map.runtime_key,
        map.world.spawn,
        target,
        14,
        maps,
      );
      assert.ok(path.length, `${map.runtime_key}:${target.id}`);
      const end = path.at(-1);
      assert.ok(
        Math.hypot(end.x - target.x, end.y - target.y) <= target.radius,
        `${map.runtime_key}:${target.id}: proximity`,
      );
      assert.ok(
        path.every(
          (point) =>
            !collidesWithWorld(map.runtime_key, point.x, point.y, 14, maps),
        ),
      );
    }
});
test("locked or unknown map transitions preserve the original state", () => {
  const save = createDefaultSave(),
    state = createAdventureState(save),
    snapshot = structuredClone(state);
  assert.throws(() => transitionMap(state, save, "volcano", maps), /mở khóa/);
  assert.deepEqual(state, snapshot);
  assert.throws(() => transitionMap(state, save, "does-not-exist", maps));
  assert.deepEqual(state, snapshot);
});
test("a legacy position embedded in a collider recovers to a valid location", () => {
  const save = createDefaultSave(),
    state = createAdventureState(save);
  state.x = 100;
  state.y = 150;
  stepAdventure(state, save, 1 / 30, maps);
  assert.equal(collidesWithWorld("village", state.x, state.y, 14, maps), false);
});
test("harvest cooldown and puzzle reward claims survive save/reload", () => {
  let save = createDefaultSave();
  let state = createAdventureState(save);
  state.map = "forest";
  state.x = 390;
  state.y = 440;
  let result = interactAdventure(state, save, maps);
  save = result.save;
  assert.equal(save.adventure.materials.herbs, 3);
  state = createAdventureState({
    ...save,
    adventure: { ...save.adventure, map: "forest", x: 390, y: 440 },
  });
  result = interactAdventure(state, save, maps);
  assert.equal(result.save.adventure.materials.herbs, 3);
  state.puzzle = { id: "village:recipe", selected: [] };
  save = solveAdventurePuzzle(state, save, ["water", "wood", "fire"]);
  const gold = save.player.gold;
  state.puzzle = { id: "village:recipe", selected: [] };
  save = solveAdventurePuzzle(state, save, ["water", "wood", "fire"]);
  assert.equal(save.player.gold, gold);
});
test("Adventure starts one protagonist plus four selected spirits and uses a separate upgrade economy", () => {
  const save = createDefaultSave(),
    state = createAdventureState(save);
  beginBattle(state, save);
  const party = state.battle.actors.filter((actor) => actor.team === "player");
  assert.equal(party.length, 5);
  assert.ok(party.some((actor) => actor.id === "hero_ketvi"));
  save.adventure.materials.herbs = 3;
  const tcgStats = structuredClone(catalog.cards[0]);
  const chessBase = chessStats(units[0]);
  const next = upgradeAdventureCharacter(save, save.roster[0].id);
  assert.ok(next.roster[0].atk > save.roster[0].atk);
  assert.deepEqual(catalog.cards[0], tcgStats);
  assert.deepEqual(chessStats(units[0]), chessBase);
});
test("farm runs have three waves, award useful materials and cannot be claimed twice", () => {
  let save = createDefaultSave();
  const state = createAdventureState(save);
  state.map = "forest";
  beginBattle(state, save, { farm: true });
  for (
    let tick = 0;
    tick < 4000 && state.battle.phase === "battle_running";
    tick++
  )
    stepAdventure(state, save, 1 / 30, maps);
  assert.equal(state.battle.phase, "battle_end");
  assert.equal(state.battle.waveCount, 3);
  assert.equal(state.battle.result, "victory");
  save = claimBattleResult(state, save);
  assert.equal(save.adventure.materials.herbs, 4);
  const gold = save.player.gold;
  save = claimBattleResult(state, save);
  assert.equal(save.player.gold, gold);
  assert.ok(save.adventure.unlockedMaps.includes("coast"));
});
test("all modes choose the exact same boss score and recover their normal track", () => {
  for (const page of ["adventure", "tcg", "chess"]) {
    assert.equal(trackForContext(page, true), "epic_boss_battle");
    assert.equal(trackForContext(page, false), page);
  }
});

test("chess presentation frames are trimmed from saves without changing authoritative outcomes", () => {
  let run = createChessRun(units, odds, 7);
  run = buyChessOffer(run, 0);
  run = placeChessUnit(run, 0, 3, 3);
  run = startChessCombat(run);
  const save = createDefaultSave();
  save.modes.chess = run;
  let serialized = "";
  assert.equal(
    persistSave(save, {
      setItem(key, value) {
        serialized = value;
      },
    }),
    true,
  );
  const restored = JSON.parse(serialized).modes.chess;
  assert.equal(restored.combat.frames.length, 1);
  assert.equal(restored.combat.events.length, 0);
  assert.deepEqual(restored.result, run.result);
  assert.equal(restored.hp, run.hp);
  assert.ok(run.combat.frames.length > 1);
});
test("harvest clocks advance identically at 30 and 60 render frames per second", () => {
  const first = createDefaultSave(),
    second = createDefaultSave();
  const a = createAdventureState(first),
    b = createAdventureState(second);
  for (let i = 0; i < 300; i++) stepAdventure(a, first, 1 / 30, maps);
  for (let i = 0; i < 600; i++) stepAdventure(b, second, 1 / 60, maps);
  assert.equal(first.adventure.worldTick, second.adventure.worldTick);
  assert.equal(first.adventure.worldTick, 300);
});

test("save recovery rejects unknown character identity and invalid mode/map shapes", () => {
  const save = createDefaultSave();
  save.roster = [{ id: "unknown-injected-character", hp: 1 }];
  save.party = ["unknown-injected-character"];
  save.adventure.map = "missing";
  save.settings.music = "loud";
  save.modes.tcg = { players: [] };
  const loaded = migrateSave(save);
  assert.equal(loaded.roster.length, 5);
  assert.ok(loaded.roster.every((actor) => actor.id.startsWith("chr_")));
  assert.deepEqual(loaded.party, []);
  assert.equal(loaded.adventure.map, "village");
  assert.equal(loaded.settings.music, 70);
  assert.equal(loaded.modes.tcg, null);
});

test("all farm materials refine into spendable essence only in the village", () => {
  let save = createDefaultSave();
  for (const key of ["herbs", "pearl", "ember", "mist"]) {
    save.adventure.materials[key] = 3;
    const previous = save.player.essence;
    save = refineAdventureMaterial(save, key);
    assert.ok(save.player.essence > previous);
    assert.ok(save.adventure.materials[key] < 3);
  }
  save.adventure.map = "coast";
  assert.throws(() => refineAdventureMaterial(save, "pearl"));
});
test("face-down trap identity is absent from public presentation events until reveal", () => {
  const state = match();
  state.players[0].mana = 10;
  state.players[0].hand = [card(14)];
  const events = [];
  const listener = ({ detail }) => events.push(detail);
  gameEvents.addEventListener("game-event", listener);
  playTcgCard(state, 0, "test:14");
  gameEvents.removeEventListener("game-event", listener);
  const event = events.find((entry) => entry.type === "card_played");
  assert.equal(event.payload.face_down, true);
  assert.equal(event.payload.card_id, undefined);
});

test("a complete interactive TCG command sequence reaches an adjudicated result without auto-passing human input", () => {
  let state = match();
  for (let action = 0; action < 3000 && !state.result; action++) {
    if (
      (["action", "reaction"].includes(state.phase) && state.priority === 1) ||
      (state.activePlayer === 1 &&
        ["combat", "round_end"].includes(state.phase))
    ) {
      const next = stepTcgBot(state);
      assert.ok(
        next !== state,
        `Bot cannot advance ${state.phase} at priority ${state.priority}`,
      );
      state = next;
      continue;
    }
    if (["action", "reaction"].includes(state.phase)) {
      let played = false;
      for (const handCard of state.players[0].hand) {
        if (
          handCard.cost > state.players[0].mana ||
          handCard.effect?.kind === "counter"
        )
          continue;
        const friendly = ["heal", "shield", "modify_stat", "draw"].includes(
          handCard.effect?.kind,
        );
        const target = friendly
          ? "commander"
          : (state.players[1].units[0]?.instance_id ?? "commander");
        try {
          state = playTcgCard(state, 0, handCard.instance_id, target);
          played = true;
          break;
        } catch {
          /* Try the next legal card. */
        }
      }
      if (!played) state = passTcgPriority(state, 0);
    } else if (state.phase === "combat") state = attackTcg(state, 0);
    else if (state.phase === "round_end") state = endTcgTurn(state, 0);
    else assert.fail(`Unexpected phase: ${state.phase}`);
  }
  assert.equal(state.phase, "result");
  assert.ok(state.result);
  assert.ok(state.round <= 41);
});
