import json
import unittest
from copy import deepcopy
from pathlib import Path

from game_rules.tcg import (
    create_match,
    assign_blockers,
    declare_attacks,
    draw_cards,
    end_round,
    finish_mulligans,
    mulligan,
    pass_priority,
    play_card,
    start_turn,
    validate_deck,
)


ROOT = Path(__file__).resolve().parents[1]


def load_json(relative_path):
    return json.loads((ROOT / relative_path).read_text(encoding="utf-8"))


class TcgSetupRulesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = load_json("examples/cards/cards.catalog.json")
        cls.deck = load_json("examples/cards/starter_deck.json")

    def make_match(self, seed=41):
        return create_match(self.deck, self.deck, self.catalog, seed=seed)

    def make_action_match(self, card_ids):
        match = finish_mulligans(self.make_match())
        player = match["players"][0]
        player["mana"] = 10
        cards_by_id = {card["card_id"]: card for card in self.catalog["cards"]}
        for index, card_id in enumerate(card_ids):
            card = deepcopy(cards_by_id[card_id])
            card["instance_id"] = f"test:{card_id}:{index}"
            player["hand"][index] = card
        return match

    def make_combat_state(self, attacker, defender=None):
        match = finish_mulligans(self.make_match())
        match = pass_priority(match, 0)
        match = pass_priority(match, 1)
        match["players"][0]["units"] = [attacker]
        if defender is not None:
            match["players"][1]["units"] = [defender]
        return match

    def test_valid_starter_deck_and_opening_hands(self):
        validate_deck(self.deck, self.catalog)
        match = self.make_match()
        self.assertEqual([len(player["hand"]) for player in match["players"]], [4, 4])
        self.assertEqual([len(player["deck"]) for player in match["players"]], [32, 32])
        self.assertEqual([player["commander_hp"] for player in match["players"]], [8000, 8000])

    def test_same_seed_produces_same_match_and_different_seed_changes_hands(self):
        first = self.make_match(seed=111)
        repeat = self.make_match(seed=111)
        different = self.make_match(seed=112)
        self.assertEqual(first, repeat)
        self.assertNotEqual(
            [card["instance_id"] for card in first["players"][0]["hand"]],
            [card["instance_id"] for card in different["players"][0]["hand"]],
        )

    def test_deck_validation_rejects_bad_size_unknown_id_and_copy_limit(self):
        too_small = deepcopy(self.deck)
        too_small["cards"][0]["count"] = 1
        with self.assertRaisesRegex(ValueError, "exactly 36"):
            validate_deck(too_small, self.catalog)

        unknown = deepcopy(self.deck)
        unknown["cards"][0]["card_id"] = "missing_card"
        with self.assertRaisesRegex(ValueError, "unknown card_id"):
            validate_deck(unknown, self.catalog)

        over_limit = deepcopy(self.deck)
        over_limit["cards"][0]["count"] = 3
        with self.assertRaisesRegex(ValueError, "copy limit"):
            validate_deck(over_limit, self.catalog)

    def test_mulligan_replaces_selected_cards_once_deterministically(self):
        match = self.make_match(seed=902)
        original_hand_ids = [card["instance_id"] for card in match["players"][0]["hand"]]
        result = mulligan(match, 0, [0, 2])
        new_hand_ids = [card["instance_id"] for card in result["players"][0]["hand"]]
        self.assertEqual(len(new_hand_ids), 4)
        self.assertEqual(len(set(new_hand_ids)), 4)
        self.assertTrue(set(original_hand_ids).intersection(new_hand_ids))
        self.assertEqual(len(result["players"][0]["deck"]), 32)
        self.assertTrue(result["players"][0]["mulligan_used"])
        self.assertEqual(result, mulligan(match, 0, [0, 2]))
        with self.assertRaisesRegex(ValueError, "already used"):
            mulligan(result, 0, [1])

    def test_invalid_mulligan_does_not_mutate_match(self):
        match = self.make_match()
        original = deepcopy(match)
        with self.assertRaisesRegex(ValueError, "out of range"):
            mulligan(match, 0, [4])
        self.assertEqual(match, original)

    def test_first_player_skips_first_draw_and_mana_refills(self):
        match = finish_mulligans(self.make_match())
        first = match["players"][0]
        self.assertEqual(match["phase"], "action")
        self.assertEqual(match["round"], 1)
        self.assertEqual((first["max_mana"], first["mana"]), (1, 1))
        self.assertEqual(len(first["hand"]), 4)
        self.assertEqual(len(first["deck"]), 32)

        match["phase"] = "round_end"
        second_turn = end_round(match, 0)
        second = second_turn["players"][1]
        self.assertEqual((second["max_mana"], second["mana"]), (1, 1))
        self.assertEqual(len(second["hand"]), 5)
        self.assertEqual(len(second["deck"]), 31)
        self.assertEqual(second_turn["round"], 1)

    def test_draw_burns_over_hand_limit(self):
        match = self.make_match()
        match["players"][0]["hand"] = match["players"][0]["hand"][:]
        match["players"][0]["hand"].extend(
            deepcopy(match["players"][0]["deck"][:5])
        )
        match["players"][0]["deck"] = match["players"][0]["deck"][5:]
        updated = draw_cards(match, 0, 1, hand_limit=9)
        self.assertEqual(len(updated["players"][0]["hand"]), 9)
        self.assertEqual(len(updated["players"][0]["burned"]), 1)
        self.assertEqual(match["players"][0]["burned"], [])
        burn_event = updated["event_log"][-1]
        self.assertEqual(burn_event["payload"], {"count": 1})
        self.assertNotIn("card_instance_id", burn_event["payload"])

    def test_draw_event_does_not_expose_card_identity(self):
        match = self.make_match()
        updated = draw_cards(match, 0, 1)
        draw_event = updated["event_log"][-1]
        self.assertEqual(draw_event["type"], "card_drawn")
        self.assertEqual(draw_event["payload"], {"count": 1})
        self.assertNotIn("card_instance_id", draw_event["payload"])

    def test_mandatory_deck_out_loses_but_optional_empty_draw_does_not(self):
        match = self.make_match()
        match["players"][0]["deck"] = []
        optional = draw_cards(match, 0, 1, mandatory=False)
        self.assertIsNone(optional["result"])
        mandatory = draw_cards(match, 0, 1)
        self.assertEqual(mandatory["result"], "deck_out")
        self.assertEqual(mandatory["winner"], 1)
        self.assertEqual(mandatory["phase"], "result")

    def test_playing_unit_spends_mana_and_summons_with_durability(self):
        match = self.make_action_match(["card_demo_01"])
        updated = play_card(match, 0, 0)
        unit = updated["players"][0]["units"][0]
        self.assertEqual(unit["current_def"], unit["max_def"])
        self.assertFalse(unit["can_attack_this_round"])
        self.assertEqual(updated["players"][0]["mana"], 9)
        self.assertEqual(updated["priority_player"], 1)
        self.assertEqual(match["players"][0]["units"], [])

    def test_unit_capacity_rejection_does_not_consume_card_or_mana(self):
        match = self.make_action_match(["card_demo_01"])
        match["players"][0]["units"] = [
            {**deepcopy(self.catalog["cards"][0]), "instance_id": f"occupied:{index}"}
            for index in range(5)
        ]
        original_mana = match["players"][0]["mana"]
        with self.assertRaisesRegex(ValueError, "unit slots are full"):
            play_card(match, 0, 0)
        self.assertEqual(match["players"][0]["mana"], original_mana)
        self.assertEqual(match["players"][0]["hand"][0]["card_id"], "card_demo_01")

    def test_setting_trap_keeps_card_identity_out_of_public_event(self):
        match = self.make_action_match(["card_demo_14"])
        updated = play_card(match, 0, 0)
        self.assertTrue(updated["players"][0]["traps"][0]["face_down"])
        event = updated["event_log"][-1]
        self.assertEqual(event["type"], "trap_set")
        self.assertEqual(event["payload"], {"trap_count": 1})
        self.assertNotIn("card_demo_14", json.dumps(event))

    def test_trap_cannot_trigger_on_its_set_round(self):
        match = self.make_action_match([])
        trap = deepcopy(self.catalog["cards"][13])
        trap["instance_id"] = "p1:trap:0"
        match["players"][1]["hand"][0] = trap
        match["players"][1]["mana"] = 10
        match["priority_player"] = 1
        match = play_card(match, 1, 0)
        match = pass_priority(match, 0)
        match = pass_priority(match, 1)
        match["players"][0]["units"] = [{
            **deepcopy(self.catalog["cards"][0]),
            "instance_id": "p0:attacker",
            "can_attack_this_round": True,
            "current_def": 500,
        }]
        updated = declare_attacks(match, 0, [{"instance_id": "p0:attacker", "lane": 0}])
        self.assertEqual(updated["phase"], "block_assign")
        self.assertEqual(len(updated["players"][1]["traps"]), 1)
        self.assertFalse(any(event["type"] == "trap_revealed" for event in updated["event_log"]))

    def test_armed_trap_reveals_consumes_and_counters_fast_spell(self):
        match = self.make_action_match(["card_demo_15"])
        match = play_card(match, 0, 0)
        match["players"][0]["traps"][0]["set_round"] = match["round"] - 1
        spell = deepcopy(self.catalog["cards"][9])
        spell["instance_id"] = "p1:fast:0"
        match["players"][1]["hand"][0] = spell
        match["players"][1]["mana"] = 10

        match = play_card(match, 1, 0, target={"kind": "commander", "player": 0})
        self.assertEqual(match["stack"][-1]["kind"], "trap")
        self.assertEqual(match["players"][0]["traps"], [])
        reveal_event = next(event for event in match["event_log"] if event["type"] == "trap_revealed")
        self.assertEqual(reveal_event["payload"]["card_id"], "card_demo_15")
        self.assertEqual(match["priority_player"], 1)

        match = pass_priority(match, 1)
        match = pass_priority(match, 0)
        self.assertEqual(match["stack"], [])
        self.assertEqual(match["players"][0]["commander_hp"], 8000)
        self.assertEqual(match["players"][1]["graveyard"][-1]["card_id"], "card_demo_10")
        self.assertEqual(match["players"][0]["graveyard"][-1]["card_id"], "card_demo_15")
        self.assertEqual(match["event_log"][-1]["type"], "stack_item_countered")

    def test_armed_attack_trap_counters_attack_before_block_assignment(self):
        match = self.make_action_match([])
        trap = deepcopy(self.catalog["cards"][13])
        trap["instance_id"] = "p1:attack-trap"
        match["players"][1]["hand"][0] = trap
        match["players"][1]["mana"] = 10
        match["priority_player"] = 1
        match = play_card(match, 1, 0)
        match["players"][1]["traps"][0]["set_round"] = match["round"] - 1
        match = pass_priority(match, 0)
        match = pass_priority(match, 1)
        match["players"][0]["units"] = [{
            **deepcopy(self.catalog["cards"][0]),
            "instance_id": "p0:attacker",
            "can_attack_this_round": True,
            "current_def": 500,
        }]

        match = declare_attacks(match, 0, [{"instance_id": "p0:attacker", "lane": 0}])
        self.assertEqual(match["phase"], "reaction")
        self.assertEqual(match["priority_player"], 0)
        self.assertEqual(match["stack"][-1]["counter_attack_id"], match["pending_attack"]["attack_id"])
        match = pass_priority(match, 0)
        match = pass_priority(match, 1)
        self.assertEqual(match["attacks"], [])
        self.assertTrue(match["pending_attack"]["cancelled"])
        self.assertEqual(match["players"][1]["graveyard"][-1]["card_id"], "card_demo_14")
        match = pass_priority(match, 0)
        match = pass_priority(match, 1)
        self.assertEqual(match["phase"], "block_assign")
        result = assign_blockers(match, 1, [])
        self.assertEqual(result["players"][1]["commander_hp"], 8000)
        self.assertEqual(result["phase"], "round_end")

    def test_attacker_can_cast_fast_spell_in_attack_reaction_window(self):
        match = self.make_action_match([])
        trap = deepcopy(self.catalog["cards"][13])
        trap["instance_id"] = "p1:attack-trap"
        match["players"][1]["hand"][0] = trap
        match["players"][1]["mana"] = 10
        match["priority_player"] = 1
        match = play_card(match, 1, 0)
        match["players"][1]["traps"][0]["set_round"] = match["round"] - 1
        fast_spell = deepcopy(self.catalog["cards"][9])
        fast_spell["instance_id"] = "p0:response-spell"
        match["players"][0]["hand"][0] = fast_spell
        match["players"][0]["mana"] = 10
        match = pass_priority(match, 0)
        match = pass_priority(match, 1)
        match["players"][0]["units"] = [{
            **deepcopy(self.catalog["cards"][0]),
            "instance_id": "p0:attacker",
            "can_attack_this_round": True,
            "current_def": 500,
        }]

        match = declare_attacks(match, 0, [{"instance_id": "p0:attacker", "lane": 0}])
        self.assertEqual(match["phase"], "reaction")
        match = play_card(match, 0, 0, target={"kind": "commander", "player": 1})
        self.assertEqual([item["kind"] for item in match["stack"]], ["trap", "spell"])
        match = pass_priority(match, 1)
        match = pass_priority(match, 0)
        self.assertEqual(match["players"][1]["commander_hp"], 7530)
        self.assertEqual(len(match["stack"]), 1)
        match = pass_priority(match, 0)
        match = pass_priority(match, 1)
        self.assertTrue(match["pending_attack"]["cancelled"])
        self.assertEqual(match["attacks"], [])

    def test_fast_spells_resolve_one_at_a_time_in_lifo_order(self):
        match = self.make_action_match(["card_demo_10", "card_demo_11"])
        first_spell = match["players"][0]["hand"][0]
        second_spell = match["players"][0]["hand"][1]
        target = {"kind": "commander", "player": 1}
        match = play_card(match, 0, 0, target=target)
        match = pass_priority(match, 1)
        match = play_card(match, 0, 0, target=target)
        match = pass_priority(match, 1)
        match = pass_priority(match, 0)
        self.assertEqual(match["players"][1]["commander_hp"], 7500)
        self.assertEqual(len(match["stack"]), 1)
        self.assertEqual(match["players"][0]["graveyard"][-1]["card_id"], second_spell["card_id"])
        match = pass_priority(match, 0)
        match = pass_priority(match, 1)
        self.assertEqual(match["players"][1]["commander_hp"], 7030)
        self.assertEqual(len(match["stack"]), 0)
        self.assertEqual(match["players"][0]["graveyard"][-1]["card_id"], first_spell["card_id"])

    def test_slow_spell_resolves_immediately(self):
        match = self.make_action_match(["card_demo_17"])
        updated = play_card(match, 0, 0, target={"kind": "commander", "player": 1})
        self.assertEqual(updated["players"][1]["commander_hp"], 7320)
        self.assertEqual(updated["stack"], [])
        self.assertEqual(updated["players"][0]["graveyard"][-1]["card_id"], "card_demo_17")

    def test_fast_spell_damages_and_destroys_unit_after_response_window(self):
        match = self.make_action_match(["card_demo_10"])
        target_unit = {
            **deepcopy(self.catalog["cards"][0]),
            "instance_id": "p1:target",
            "current_def": 300,
        }
        match["players"][1]["units"].append(target_unit)
        match = play_card(match, 0, 0, target={"kind": "unit", "player": 1, "instance_id": "p1:target"})
        match = pass_priority(match, 1)
        match = pass_priority(match, 0)
        self.assertEqual(match["players"][1]["units"], [])
        self.assertEqual(match["players"][1]["graveyard"][0]["instance_id"], "p1:target")

    def test_lethal_spell_finishes_match(self):
        match = self.make_action_match(["card_demo_10"])
        match["players"][1]["commander_hp"] = 400
        match = play_card(match, 0, 0, target={"kind": "commander", "player": 1})
        match = pass_priority(match, 1)
        match = pass_priority(match, 0)
        self.assertEqual(match["winner"], 0)
        self.assertEqual(match["result"], "commander_defeated")
        self.assertEqual(match["phase"], "result")

    def test_invalid_spell_target_does_not_spend_mana_or_consume_card(self):
        match = self.make_action_match(["card_demo_10"])
        original_mana = match["players"][0]["mana"]
        with self.assertRaisesRegex(ValueError, "target the opponent"):
            play_card(match, 0, 0, target={"kind": "commander", "player": 0})
        self.assertEqual(match["players"][0]["mana"], original_mana)
        self.assertEqual(match["players"][0]["hand"][0]["card_id"], "card_demo_10")

    def test_unsupported_trap_effect_is_rejected_without_spending(self):
        match = self.make_action_match(["card_demo_14"])
        invalid = deepcopy(match)
        invalid_spell = deepcopy(self.catalog["cards"][13])
        invalid_spell["type"] = "fast_spell"
        invalid["players"][0]["hand"][0] = invalid_spell
        before_mana = invalid["players"][0]["mana"]
        with self.assertRaisesRegex(ValueError, "effect is not implemented"):
            play_card(invalid, 0, 0, target={"kind": "commander", "player": 1})
        self.assertEqual(invalid["players"][0]["mana"], before_mana)
        self.assertEqual(invalid["players"][0]["hand"][0]["card_id"], "card_demo_14")

    def test_two_passes_with_empty_stack_close_action_phase(self):
        match = finish_mulligans(self.make_match())
        match = pass_priority(match, 0)
        match = pass_priority(match, 1)
        self.assertEqual(match["phase"], "combat_declare")

    def test_unblocked_attack_deals_full_atk_to_commander(self):
        attacker_card = deepcopy(self.catalog["cards"][0])
        attacker_card["atk"] = 1200
        attacker = {**attacker_card, "instance_id": "p0:attacker", "current_def": 1000, "can_attack_this_round": True}
        match = self.make_combat_state(attacker)
        match = declare_attacks(match, 0, [{"instance_id": "p0:attacker", "lane": 2}])
        result = assign_blockers(match, 1, [])
        self.assertEqual(result["players"][1]["commander_hp"], 6800)
        self.assertEqual(result["phase"], "round_end")

    def test_blocker_exchange_is_simultaneous_and_damage_persists(self):
        attacker_card = deepcopy(self.catalog["cards"][0])
        attacker_card.update({"atk": 1200, "max_def": 1000})
        attacker = {
            **attacker_card,
            "instance_id": "p0:attacker",
            "current_def": 1000,
            "can_attack_this_round": True,
        }
        defender_card = deepcopy(self.catalog["cards"][1])
        defender_card.update({"atk": 700, "max_def": 1500})
        defender = {**defender_card, "instance_id": "p1:blocker", "current_def": 1500}
        match = self.make_combat_state(attacker, defender)
        match = declare_attacks(match, 0, [{"instance_id": "p0:attacker", "lane": 1}])
        result = assign_blockers(match, 1, [{"instance_id": "p1:blocker", "lane": 1}])
        self.assertEqual(result["players"][0]["units"][0]["current_def"], 300)
        self.assertEqual(result["players"][1]["units"][0]["current_def"], 300)
        self.assertEqual(result["players"][1]["commander_hp"], 8000)

    def test_invalid_blocker_assignment_does_not_mutate_state(self):
        attacker = {
            **deepcopy(self.catalog["cards"][0]),
            "instance_id": "p0:attacker",
            "current_def": 500,
            "can_attack_this_round": True,
        }
        match = self.make_combat_state(attacker)
        match = declare_attacks(match, 0, [{"instance_id": "p0:attacker", "lane": 0}])
        original = deepcopy(match)
        with self.assertRaisesRegex(ValueError, "no declared attacker"):
            assign_blockers(match, 1, [{"instance_id": "missing", "lane": 1}])
        self.assertEqual(match, original)

    def test_attack_declaration_rejects_unready_unit_without_mutation(self):
        attacker = {
            **deepcopy(self.catalog["cards"][0]),
            "instance_id": "p0:attacker",
            "current_def": 500,
            "can_attack_this_round": False,
        }
        match = self.make_combat_state(attacker)
        original = deepcopy(match)
        with self.assertRaisesRegex(ValueError, "not ready"):
            declare_attacks(match, 0, [{"instance_id": "p0:attacker", "lane": 0}])
        self.assertEqual(match, original)

    def test_lethal_unblocked_attack_wins_match(self):
        attacker_card = deepcopy(self.catalog["cards"][0])
        attacker_card["atk"] = 9000
        attacker = {
            **attacker_card,
            "instance_id": "p0:attacker",
            "current_def": 500,
            "can_attack_this_round": True,
        }
        match = self.make_combat_state(attacker)
        match["players"][1]["commander_hp"] = 8000
        match = declare_attacks(match, 0, [{"instance_id": "p0:attacker", "lane": 3}])
        result = assign_blockers(match, 1, [])
        self.assertEqual(result["winner"], 0)
        self.assertEqual(result["result"], "commander_defeated")

    def test_player_can_skip_attack_and_advance_to_opponent_turn(self):
        match = self.make_combat_state({
            **deepcopy(self.catalog["cards"][0]),
            "instance_id": "p0:attacker",
            "current_def": 500,
            "can_attack_this_round": True,
        })
        match = declare_attacks(match, 0, [])
        match = assign_blockers(match, 1, [])
        next_turn = end_round(match, 0)
        self.assertEqual(next_turn["active_player"], 1)
        self.assertEqual(next_turn["round"], 1)
        self.assertEqual(next_turn["phase"], "action")

    def test_each_player_has_an_attack_token_in_the_shared_round(self):
        attacker = {
            **deepcopy(self.catalog["cards"][0]),
            "instance_id": "p0:attacker",
            "current_def": 500,
            "can_attack_this_round": True,
        }
        blocker = {
            **deepcopy(self.catalog["cards"][1]),
            "instance_id": "p1:attacker",
            "current_def": 500,
            "can_attack_this_round": True,
        }
        match = self.make_combat_state(attacker, blocker)
        match = declare_attacks(match, 0, [{"instance_id": "p0:attacker", "lane": 0}])
        match = assign_blockers(match, 1, [])
        match = end_round(match, 0)
        match = pass_priority(match, 1)
        match = pass_priority(match, 0)
        response = declare_attacks(match, 1, [{"instance_id": "p1:attacker", "lane": 1}])
        self.assertEqual(response["phase"], "block_assign")
        self.assertEqual(response["round"], 1)

    def test_round_limit_draw_and_hp_winner(self):
        draw_match = create_match(self.deck, self.deck, self.catalog, seed=2, max_rounds=1)
        draw_match = finish_mulligans(draw_match)
        draw_match["phase"] = "round_end"
        draw_match = end_round(draw_match, 0)
        self.assertEqual(draw_match["round"], 1)
        draw_match["phase"] = "round_end"
        draw_result = end_round(draw_match, 1)
        self.assertEqual(draw_result["result"], "round_limit_draw")
        self.assertEqual(draw_result["winner"], None)

        win_match = create_match(self.deck, self.deck, self.catalog, seed=2, max_rounds=1)
        win_match = finish_mulligans(win_match)
        win_match["players"][0]["commander_hp"] = 7000
        win_match["phase"] = "round_end"
        win_match = end_round(win_match, 0)
        win_match["players"][1]["commander_hp"] = 6000
        win_match["phase"] = "round_end"
        win_result = end_round(win_match, 1)
        self.assertEqual(win_result["result"], "round_limit_winner")
        self.assertEqual(win_result["winner"], 0)


if __name__ == "__main__":
    unittest.main()