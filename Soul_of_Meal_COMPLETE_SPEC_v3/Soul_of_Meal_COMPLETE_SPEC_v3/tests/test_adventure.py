import json
import unittest
from copy import deepcopy
from pathlib import Path

from game_rules.adventure import (
    activate_ultimate,
    advance_ticks,
    apply_status,
    calculate_damage,
    create_battle,
    grant_shield,
    schedule_hit,
)


ROOT = Path(__file__).resolve().parents[1]


def load_json(relative_path):
    return json.loads((ROOT / relative_path).read_text(encoding="utf-8"))


class AdventureRulesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ability = load_json("examples/adventure/bunbo_ability.json")

    def make_battle(self, *, seed=19, target_hp=3000, source_energy=100, crit_chance=0):
        return create_battle([
            {
                "actor_id": "hero",
                "team": "player",
                "max_hp": 3000,
                "atk": 320,
                "def": 100,
                "energy": source_energy,
                "crit_chance_bp": crit_chance,
                "crit_multiplier_bp": 15000,
            },
            {
                "actor_id": "enemy",
                "team": "enemy",
                "max_hp": target_hp,
                "atk": 100,
                "def": 100,
            },
        ], seed=seed)

    def test_documented_damage_fixture_is_exactly_240(self):
        fixture = self.ability["sample_damage_fixture"]
        result = calculate_damage(
            fixture["atk"],
            self.ability["coefficient_bp"],
            fixture["def"],
        )
        self.assertEqual(result["damage"], fixture["expected_damage"])

    def test_ultimate_hit_resolves_only_at_configured_tick(self):
        state = self.make_battle()
        state = activate_ultimate(state, "hero", "enemy", self.ability)
        self.assertEqual(state["actors"]["hero"]["energy"], 0)
        self.assertEqual(state["actors"]["enemy"]["hp"], 3000)
        self.assertEqual(state["pending_hits"][0]["due_tick"], self.ability["hit_tick_offset"])
        state = advance_ticks(state, self.ability["hit_tick_offset"] - 1)
        self.assertEqual(state["actors"]["enemy"]["hp"], 3000)
        state = advance_ticks(state, 1)
        self.assertEqual(state["actors"]["enemy"]["hp"], 2760)
        hit_events = [event for event in state["events"] if event["type"] == "hit_resolved"]
        self.assertEqual(len(hit_events), 1)
        self.assertEqual(hit_events[0]["tick"], self.ability["hit_tick_offset"])

    def test_shield_absorbs_before_hp_and_caps_at_40_percent(self):
        state = self.make_battle()
        state = grant_shield(state, "enemy", 2000, source_id="hero", application_id="shield-1")
        self.assertEqual(state["actors"]["enemy"]["shield"], 1200)
        state = schedule_hit(state, "hero", "enemy", coefficient_bp=15000)
        enemy = state["actors"]["enemy"]
        self.assertEqual(enemy["shield"], 960)
        self.assertEqual(enemy["hp"], 3000)
        event = next(event for event in state["events"] if event["type"] == "hit_resolved")
        self.assertEqual(event["payload"]["blocked_by_shield"], 240)
        self.assertEqual(event["payload"]["hp_damage"], 0)

    def test_shield_application_is_idempotent(self):
        state = self.make_battle()
        state = grant_shield(state, "hero", 500, source_id="hero", application_id="same-shield")
        repeated = grant_shield(state, "hero", 500, source_id="hero", application_id="same-shield")
        self.assertEqual(repeated["actors"]["hero"]["shield"], 500)
        self.assertEqual(repeated["events"], state["events"])

    def test_critical_roll_is_reproducible_for_same_seed(self):
        first = schedule_hit(self.make_battle(seed=4, crit_chance=10000), "hero", "enemy", coefficient_bp=15000)
        again = schedule_hit(self.make_battle(seed=4, crit_chance=10000), "hero", "enemy", coefficient_bp=15000)
        first_event = next(event for event in first["events"] if event["type"] == "hit_resolved")
        self.assertEqual(first, again)
        self.assertEqual(first_event["payload"]["damage"], 360)
        self.assertTrue(first_event["payload"]["is_critical"])

    def test_ultimate_rejects_insufficient_energy_and_cooldown_without_mutation(self):
        state = self.make_battle(source_energy=50)
        original = deepcopy(state)
        with self.assertRaisesRegex(ValueError, "no_energy"):
            activate_ultimate(state, "hero", "enemy", self.ability)
        self.assertEqual(state, original)

        ready = self.make_battle()
        activated = activate_ultimate(ready, "hero", "enemy", self.ability)
        with self.assertRaisesRegex(ValueError, "no_energy|cooldown"):
            activate_ultimate(activated, "hero", "enemy", self.ability)

    def test_stunned_actor_cannot_activate_ultimate(self):
        state = self.make_battle()
        state = apply_status(
            state,
            "hero",
            "stun",
            source_id="enemy",
            duration_ticks=10,
            application_id="stun-1",
        )
        with self.assertRaisesRegex(ValueError, "stunned"):
            activate_ultimate(state, "hero", "enemy", self.ability)

    def test_status_application_is_idempotent_and_burn_ticks_on_sim_time(self):
        state = self.make_battle()
        state = apply_status(
            state,
            "enemy",
            "burn",
            source_id="hero",
            duration_ticks=65,
            application_id="burn-1",
            magnitude_bp=10000,
        )
        repeated = apply_status(
            state,
            "enemy",
            "burn",
            source_id="hero",
            duration_ticks=65,
            application_id="burn-1",
            magnitude_bp=10000,
        )
        self.assertEqual(len(repeated["actors"]["enemy"]["statuses"]), 1)
        advanced = advance_ticks(repeated, 29)
        self.assertEqual(advanced["actors"]["enemy"]["hp"], 3000)
        advanced = advance_ticks(advanced, 1)
        self.assertEqual(advanced["actors"]["enemy"]["hp"], 2999)
        self.assertEqual(advanced["events"][-1]["payload"]["status_id"], "burn")

    def test_battle_ends_when_one_team_has_no_living_actors(self):
        state = self.make_battle(target_hp=10)
        result = schedule_hit(state, "hero", "enemy", coefficient_bp=10000)
        self.assertEqual(result["phase"], "battle_end")
        self.assertEqual(result["result"], "player")


if __name__ == "__main__":
    unittest.main()