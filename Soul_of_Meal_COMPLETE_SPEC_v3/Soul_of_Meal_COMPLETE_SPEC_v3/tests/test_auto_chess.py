import json
import unittest
from pathlib import Path

from game_rules.auto_chess import (
    buy_shop_offer,
    calculate_interest,
    calculate_payout,
    merge_units,
    move_board_unit,
    place_bench_unit,
    refresh_shop,
    roll_shop,
    return_board_unit,
    set_shop_locked,
    validate_shop_odds,
)


ROOT = Path(__file__).resolve().parents[1]


def load_json(relative_path):
    return json.loads((ROOT / relative_path).read_text(encoding="utf-8"))


class AutoChessRulesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.shop = load_json("examples/auto_chess/shop_odds.json")
        cls.units = load_json("examples/auto_chess/units.json")["units"]
        cls.economy = cls.shop["economy"]

    def make_shop_state(self, gold=10):
        return {
            "gold": gold,
            "bench": [],
            "board": [],
            "shop_locked": False,
            "shop_offers": [dict(self.units[0]), dict(self.units[1])],
        }

    def test_interest_examples_and_cap(self):
        self.assertEqual(calculate_interest(30, self.economy), 3)
        self.assertEqual(calculate_interest(50, self.economy), 5)
        self.assertEqual(calculate_interest(100, self.economy), 5)

    def test_payout_breakdown_uses_pre_payout_gold(self):
        payout = calculate_payout(30, True, 4, self.economy)
        self.assertEqual(payout, {
            "base_income": 5,
            "victory_bonus": 1,
            "streak_bonus": 2,
            "interest": 3,
            "total": 11,
            "gold_after_payout": 41,
        })

    def test_configured_shop_odds_are_valid(self):
        validate_shop_odds(self.shop)
        self.assertEqual(sum(self.shop["probabilities_percent"]["4"]), 100)

    def test_level_four_shop_never_offers_tier_five(self):
        offers = roll_shop(4, self.units, self.shop, seed=7)
        self.assertEqual(len(offers), 5)
        self.assertTrue(all(offer["cost"] <= 3 for offer in offers))

    def test_shop_roll_is_reproducible_for_same_seed(self):
        first = roll_shop(6, self.units, self.shop, seed=2026)
        second = roll_shop(6, self.units, self.shop, seed=2026)
        self.assertEqual(first, second)

    def test_invalid_probability_row_is_rejected(self):
        invalid_shop = dict(self.shop)
        invalid_shop["probabilities_percent"] = {"4": [55, 30, 15, 0, 1]}
        with self.assertRaisesRegex(ValueError, "sum to 100"):
            validate_shop_odds(invalid_shop)

    def test_buy_spends_tier_cost_and_moves_offer_to_bench(self):
        state = self.make_shop_state()
        updated = buy_shop_offer(state, 1)
        self.assertEqual(updated["gold"], 8)
        self.assertEqual(updated["bench"], [self.units[1]])
        self.assertIsNone(updated["shop_offers"][1])
        self.assertEqual(state["gold"], 10)
        self.assertEqual(len(state["bench"]), 0)

    def test_rejected_purchase_leaves_state_unchanged(self):
        state = self.make_shop_state(gold=0)
        original = json.loads(json.dumps(state))
        with self.assertRaisesRegex(ValueError, "not enough gold"):
            buy_shop_offer(state, 0)
        self.assertEqual(state, original)

    def test_full_bench_rejects_purchase_without_mutation(self):
        state = self.make_shop_state()
        state["bench"] = [dict(self.units[0]) for _ in range(9)]
        original = json.loads(json.dumps(state))
        with self.assertRaisesRegex(ValueError, "bench is full"):
            buy_shop_offer(state, 0)
        self.assertEqual(state, original)

    def test_refresh_spends_two_gold_and_is_seeded(self):
        state = self.make_shop_state()
        first = refresh_shop(state, 4, self.units, self.shop, seed=3)
        second = refresh_shop(state, 4, self.units, self.shop, seed=3)
        self.assertEqual(first, second)
        self.assertEqual(first["gold"], 8)
        self.assertEqual(len(first["shop_offers"]), 5)
        self.assertEqual(state["gold"], 10)

    def test_locked_shop_cannot_refresh(self):
        state = set_shop_locked(self.make_shop_state(), True)
        original = json.loads(json.dumps(state))
        with self.assertRaisesRegex(ValueError, "shop is locked"):
            refresh_shop(state, 4, self.units, self.shop, seed=3)
        self.assertEqual(state, original)

    def test_place_bench_unit_on_valid_cell(self):
        state = self.make_shop_state()
        state["bench"] = [dict(self.units[0])]
        updated = place_bench_unit(state, 0, 6, 3, level=2)
        self.assertEqual(updated["bench"], [])
        self.assertEqual(updated["board"], [{**self.units[0], "placement_order": 0, "x": 6, "y": 3}])
        self.assertEqual(state["bench"], [self.units[0]])
        self.assertEqual(state["board"], [])

    def test_board_unit_cap_is_player_level(self):
        state = self.make_shop_state()
        state["bench"] = [dict(self.units[0])]
        state["board"] = [
            {**self.units[0], "x": 0, "y": 0},
            {**self.units[1], "x": 1, "y": 0},
        ]
        original = json.loads(json.dumps(state))
        with self.assertRaisesRegex(ValueError, "unit cap"):
            place_bench_unit(state, 0, 2, 0, level=2)
        self.assertEqual(state, original)

    def test_board_rejects_out_of_range_cell(self):
        state = self.make_shop_state()
        state["bench"] = [dict(self.units[0])]
        original = json.loads(json.dumps(state))
        with self.assertRaisesRegex(ValueError, "out of range"):
            place_bench_unit(state, 0, 7, 0, level=2)
        self.assertEqual(state, original)

    def test_move_to_occupied_cell_swaps_units(self):
        state = self.make_shop_state()
        state["board"] = [
            {**self.units[0], "x": 0, "y": 0},
            {**self.units[1], "x": 1, "y": 0},
        ]
        updated = move_board_unit(state, 0, 1, 0)
        self.assertEqual((updated["board"][0]["x"], updated["board"][0]["y"]), (1, 0))
        self.assertEqual((updated["board"][1]["x"], updated["board"][1]["y"]), (0, 0))
        self.assertEqual(state["board"][0]["x"], 0)

    def test_move_to_empty_cell(self):
        state = self.make_shop_state()
        state["board"] = [{**self.units[0], "x": 0, "y": 0}]
        updated = move_board_unit(state, 0, 5, 2)
        self.assertEqual((updated["board"][0]["x"], updated["board"][0]["y"]), (5, 2))

    def test_return_board_unit_to_bench(self):
        state = self.make_shop_state()
        state["board"] = [{**self.units[0], "x": 2, "y": 1}]
        updated = return_board_unit(state, 0)
        self.assertEqual(updated["bench"], [self.units[0]])
        self.assertEqual(updated["board"], [])

    def test_return_to_full_bench_is_rejected_without_mutation(self):
        state = self.make_shop_state()
        state["bench"] = [dict(self.units[0]) for _ in range(9)]
        state["board"] = [{**self.units[1], "x": 0, "y": 0}]
        original = json.loads(json.dumps(state))
        with self.assertRaisesRegex(ValueError, "bench is full"):
            return_board_unit(state, 0)
        self.assertEqual(state, original)

    def test_merge_three_matching_bench_units(self):
        state = self.make_shop_state()
        state["bench"] = [dict(self.units[0]) for _ in range(3)]
        updated = merge_units(state)
        self.assertEqual(len(updated["bench"]), 1)
        self.assertEqual(updated["bench"][0]["star"], 2)
        self.assertEqual(updated["bench"][0]["id"], self.units[0]["id"])
        self.assertEqual(len(state["bench"]), 3)

    def test_merge_prefers_board_copy_and_keeps_its_cell(self):
        state = self.make_shop_state()
        state["board"] = [{**self.units[0], "x": 4, "y": 2}]
        state["bench"] = [dict(self.units[0]), dict(self.units[0])]
        updated = merge_units(state)
        self.assertEqual(len(updated["board"]), 1)
        self.assertEqual(updated["board"][0]["star"], 2)
        self.assertEqual((updated["board"][0]["x"], updated["board"][0]["y"]), (4, 2))
        self.assertEqual(updated["bench"], [])

    def test_merge_uses_earliest_placement_order_as_destination(self):
        state = self.make_shop_state()
        state["board"] = [
            {**self.units[0], "star": 1, "placement_order": 8, "x": 5, "y": 0},
            {**self.units[0], "star": 1, "placement_order": 3, "x": 2, "y": 1},
        ]
        state["bench"] = [{**self.units[0], "star": 1}]
        updated = merge_units(state)
        survivor = updated["board"][0]
        self.assertEqual(survivor["star"], 2)
        self.assertEqual(survivor["placement_order"], 3)
        self.assertEqual((survivor["x"], survivor["y"]), (2, 1))

    def test_merge_repeats_until_three_star_without_exceeding_cap(self):
        state = self.make_shop_state()
        state["bench"] = [
            {**self.units[0], "star": 1},
            {**self.units[0], "star": 1},
            {**self.units[0], "star": 1},
            {**self.units[0], "star": 2},
            {**self.units[0], "star": 2},
        ]
        updated = merge_units(state)
        self.assertEqual(len(updated["bench"]), 1)
        self.assertEqual(updated["bench"][0]["star"], 3)

    def test_three_star_units_do_not_merge(self):
        state = self.make_shop_state()
        state["bench"] = [{**self.units[0], "star": 3} for _ in range(3)]
        self.assertEqual(merge_units(state), state)

    def test_units_with_different_stars_do_not_merge(self):
        state = self.make_shop_state()
        state["bench"] = [
            {**self.units[0], "star": 1},
            {**self.units[0], "star": 1},
            {**self.units[0], "star": 2},
        ]
        self.assertEqual(merge_units(state), state)

    def test_merge_rejects_invalid_placement_order(self):
        state = self.make_shop_state()
        state["board"] = [
            {**self.units[0], "placement_order": "first", "x": 0, "y": 0},
            {**self.units[0], "x": 1, "y": 0},
        ]
        state["bench"] = [dict(self.units[0])]
        with self.assertRaisesRegex(ValueError, "placement_order"):
            merge_units(state)


if __name__ == "__main__":
    unittest.main()