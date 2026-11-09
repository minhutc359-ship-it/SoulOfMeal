"""Deterministic, engine-independent Auto Chess prototype rules."""

from __future__ import annotations

import random
from copy import deepcopy
from collections.abc import Mapping, Sequence
from typing import Any


def _nonnegative_int(value: Any, name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(f"{name} must be a nonnegative integer")
    return value


def validate_shop_odds(shop_odds: Mapping[str, Any]) -> None:
    """Raise ValueError unless all configured probability rows are valid."""
    tiers = shop_odds.get("cost_tiers")
    rows = shop_odds.get("probabilities_percent")
    if not isinstance(tiers, list) or not tiers:
        raise ValueError("cost_tiers must be a non-empty list")
    if any(isinstance(tier, bool) or not isinstance(tier, int) or tier < 1 for tier in tiers):
        raise ValueError("cost_tiers must contain positive integers")
    if len(set(tiers)) != len(tiers):
        raise ValueError("cost_tiers must be unique")
    if not isinstance(rows, Mapping) or not rows:
        raise ValueError("probabilities_percent must be a non-empty object")

    for level, probabilities in rows.items():
        if not isinstance(probabilities, list) or len(probabilities) != len(tiers):
            raise ValueError(f"level {level} must have one probability per cost tier")
        if any(
            isinstance(probability, bool)
            or not isinstance(probability, int)
            or probability < 0
            for probability in probabilities
        ):
            raise ValueError(f"level {level} probabilities must be nonnegative integers")
        if sum(probabilities) != 100:
            raise ValueError(f"level {level} probabilities must sum to 100")


def calculate_interest(gold_before_payout: int, economy: Mapping[str, Any]) -> int:
    """Calculate capped interest from the balance before payout."""
    gold = _nonnegative_int(gold_before_payout, "gold_before_payout")
    interval = _nonnegative_int(economy.get("interest_gold_interval"), "interest_gold_interval")
    cap = _nonnegative_int(economy.get("interest_cap"), "interest_cap")
    if interval == 0:
        raise ValueError("interest_gold_interval must be greater than zero")
    return min(gold // interval, cap)


def _streak_bonus(table: Mapping[str, int], streak_length: int) -> int:
    streak = _nonnegative_int(streak_length, "streak_length")
    eligible = [
        (int(threshold), _nonnegative_int(bonus, f"streak bonus at {threshold}"))
        for threshold, bonus in table.items()
        if int(threshold) <= streak
    ]
    return max(eligible, default=(0, 0), key=lambda entry: entry[0])[1]


def calculate_payout(
    gold_before_payout: int,
    won: bool,
    streak_length: int,
    economy: Mapping[str, Any],
) -> dict[str, int]:
    """Return a transparent payout breakdown for one resolved round."""
    gold = _nonnegative_int(gold_before_payout, "gold_before_payout")
    if not isinstance(won, bool):
        raise ValueError("won must be a boolean")
    base_income = _nonnegative_int(economy.get("base_income"), "base_income")
    victory_bonus = _nonnegative_int(economy.get("victory_bonus"), "victory_bonus") if won else 0
    streak_table_key = "win_streak_bonus_by_length" if won else "loss_streak_bonus_by_length"
    streak_table = economy.get(streak_table_key, {})
    if not isinstance(streak_table, Mapping):
        raise ValueError(f"{streak_table_key} must be an object")
    streak_bonus = _streak_bonus(streak_table, streak_length)
    interest = calculate_interest(gold, economy)
    total = base_income + victory_bonus + streak_bonus + interest
    return {
        "base_income": base_income,
        "victory_bonus": victory_bonus,
        "streak_bonus": streak_bonus,
        "interest": interest,
        "total": total,
        "gold_after_payout": gold + total,
    }


def roll_shop(
    level: int,
    units: Sequence[Mapping[str, Any]],
    shop_odds: Mapping[str, Any],
    *,
    seed: int,
    offer_count: int = 5,
) -> list[dict[str, Any]]:
    """Roll independent shop offers from configured tiers using a local seed."""
    validate_shop_odds(shop_odds)
    level = _nonnegative_int(level, "level")
    offer_count = _nonnegative_int(offer_count, "offer_count")
    if offer_count == 0:
        raise ValueError("offer_count must be greater than zero")
    if isinstance(seed, bool) or not isinstance(seed, int):
        raise ValueError("seed must be an integer")

    probabilities = shop_odds["probabilities_percent"].get(str(level))
    if probabilities is None:
        raise ValueError(f"no shop odds configured for level {level}")
    tiers = shop_odds["cost_tiers"]
    eligible_by_tier = {
        tier: [dict(unit) for unit in units if unit.get("cost") == tier]
        for tier in tiers
    }
    for tier, probability in zip(tiers, probabilities):
        if probability and not eligible_by_tier[tier]:
            raise ValueError(f"no units available for cost tier {tier}")

    generator = random.Random(seed)
    offers = []
    for _ in range(offer_count):
        roll = generator.randrange(100)
        cumulative = 0
        for tier, probability in zip(tiers, probabilities):
            cumulative += probability
            if roll < cumulative:
                offers.append(dict(generator.choice(eligible_by_tier[tier])))
                break
    return offers


def buy_shop_offer(state: Mapping[str, Any], slot: int, *, bench_capacity: int = 9) -> dict[str, Any]:
    """Buy one offer into the bench, leaving the input state unchanged."""
    if not isinstance(state, Mapping):
        raise ValueError("state must be an object")
    gold = _nonnegative_int(state.get("gold"), "gold")
    capacity = _nonnegative_int(bench_capacity, "bench_capacity")
    if isinstance(slot, bool) or not isinstance(slot, int) or slot < 0:
        raise ValueError("slot must be a nonnegative integer")
    bench = state.get("bench")
    offers = state.get("shop_offers")
    if not isinstance(bench, list) or not isinstance(offers, list):
        raise ValueError("state must contain bench and shop_offers lists")
    if len(bench) >= capacity:
        raise ValueError("bench is full")
    if slot >= len(offers) or offers[slot] is None:
        raise ValueError("shop slot is empty or out of range")
    offer = offers[slot]
    if not isinstance(offer, Mapping):
        raise ValueError("shop offer must be an object")
    cost = _nonnegative_int(offer.get("cost"), "offer cost")
    if gold < cost:
        raise ValueError("not enough gold")

    updated = deepcopy(dict(state))
    updated["gold"] = gold - cost
    updated["bench"].append(deepcopy(dict(offer)))
    updated["shop_offers"][slot] = None
    return updated


def refresh_shop(
    state: Mapping[str, Any],
    level: int,
    units: Sequence[Mapping[str, Any]],
    shop_odds: Mapping[str, Any],
    *,
    seed: int,
    refresh_cost: int = 2,
    offer_count: int = 5,
) -> dict[str, Any]:
    """Pay to replace shop offers; locked shops and invalid actions are unchanged."""
    if not isinstance(state, Mapping):
        raise ValueError("state must be an object")
    gold = _nonnegative_int(state.get("gold"), "gold")
    cost = _nonnegative_int(refresh_cost, "refresh_cost")
    if not isinstance(state.get("shop_offers"), list):
        raise ValueError("state must contain a shop_offers list")
    if state.get("shop_locked", False):
        raise ValueError("shop is locked")
    if gold < cost:
        raise ValueError("not enough gold")

    new_offers = roll_shop(level, units, shop_odds, seed=seed, offer_count=offer_count)
    updated = deepcopy(dict(state))
    updated["gold"] = gold - cost
    updated["shop_offers"] = new_offers
    return updated


def set_shop_locked(state: Mapping[str, Any], locked: bool) -> dict[str, Any]:
    """Return a copied shop state with its lock flag set."""
    if not isinstance(state, Mapping) or not isinstance(state.get("shop_offers"), list):
        raise ValueError("state must contain a shop_offers list")
    if not isinstance(locked, bool):
        raise ValueError("locked must be a boolean")
    updated = deepcopy(dict(state))
    updated["shop_locked"] = locked
    return updated


def _board_coordinates(
    board: list[Mapping[str, Any]],
    *,
    width: int,
    height: int,
) -> set[tuple[int, int]]:
    coordinates = set()
    for unit in board:
        if not isinstance(unit, Mapping):
            raise ValueError("board units must be objects")
        x = unit.get("x")
        y = unit.get("y")
        if (
            isinstance(x, bool)
            or not isinstance(x, int)
            or isinstance(y, bool)
            or not isinstance(y, int)
            or not 0 <= x < width
            or not 0 <= y < height
        ):
            raise ValueError("board unit has invalid coordinates")
        coordinate = (x, y)
        if coordinate in coordinates:
            raise ValueError("multiple board units occupy the same cell")
        coordinates.add(coordinate)
    return coordinates


def place_bench_unit(
    state: Mapping[str, Any],
    bench_index: int,
    x: int,
    y: int,
    *,
    level: int,
    board_width: int = 7,
    board_height: int = 4,
) -> dict[str, Any]:
    """Place one bench unit on an empty cell, enforcing the level unit cap."""
    if not isinstance(state, Mapping):
        raise ValueError("state must be an object")
    bench = state.get("bench")
    board = state.get("board")
    if not isinstance(bench, list) or not isinstance(board, list):
        raise ValueError("state must contain bench and board lists")
    if isinstance(bench_index, bool) or not isinstance(bench_index, int) or bench_index < 0:
        raise ValueError("bench_index must be a nonnegative integer")
    level = _nonnegative_int(level, "level")
    if level == 0:
        raise ValueError("level must be greater than zero")
    board_width = _nonnegative_int(board_width, "board_width")
    board_height = _nonnegative_int(board_height, "board_height")
    if board_width == 0 or board_height == 0:
        raise ValueError("board dimensions must be greater than zero")
    _validate_coordinate(x, y, board_width, board_height)
    occupied = _board_coordinates(board, width=board_width, height=board_height)
    if (x, y) in occupied:
        raise ValueError("board cell is occupied")
    if len(board) >= level:
        raise ValueError("board unit cap reached for player level")
    if bench_index >= len(bench):
        raise ValueError("bench index is out of range")

    updated = deepcopy(dict(state))
    unit = updated["bench"].pop(bench_index)
    if not isinstance(unit, dict):
        raise ValueError("bench units must be objects")
    board_orders = [
        existing.get("placement_order", index)
        for index, existing in enumerate(updated["board"])
        if isinstance(existing, Mapping)
    ]
    next_order = _nonnegative_int(
        updated.get("next_placement_order", max(board_orders, default=-1) + 1),
        "next_placement_order",
    )
    unit["placement_order"] = max(next_order, max(board_orders, default=-1) + 1)
    updated["next_placement_order"] = unit["placement_order"] + 1
    unit["x"] = x
    unit["y"] = y
    updated["board"].append(unit)
    return updated


def _validate_coordinate(x: int, y: int, width: int, height: int) -> None:
    if (
        isinstance(x, bool)
        or not isinstance(x, int)
        or isinstance(y, bool)
        or not isinstance(y, int)
        or not 0 <= x < width
        or not 0 <= y < height
    ):
        raise ValueError("board coordinate is out of range")


def move_board_unit(
    state: Mapping[str, Any],
    board_index: int,
    x: int,
    y: int,
    *,
    board_width: int = 7,
    board_height: int = 4,
) -> dict[str, Any]:
    """Move a board unit to an empty cell or swap it with the occupant."""
    if not isinstance(state, Mapping) or not isinstance(state.get("board"), list):
        raise ValueError("state must contain a board list")
    board = state["board"]
    if isinstance(board_index, bool) or not isinstance(board_index, int) or board_index < 0:
        raise ValueError("board_index must be a nonnegative integer")
    board_width = _nonnegative_int(board_width, "board_width")
    board_height = _nonnegative_int(board_height, "board_height")
    if board_width == 0 or board_height == 0:
        raise ValueError("board dimensions must be greater than zero")
    _validate_coordinate(x, y, board_width, board_height)
    _board_coordinates(board, width=board_width, height=board_height)
    if board_index >= len(board):
        raise ValueError("board index is out of range")

    updated = deepcopy(dict(state))
    selected = updated["board"][board_index]
    selected_x, selected_y = selected["x"], selected["y"]
    occupant_index = next(
        (index for index, unit in enumerate(updated["board"]) if unit["x"] == x and unit["y"] == y),
        None,
    )
    if occupant_index is not None and occupant_index != board_index:
        occupant = updated["board"][occupant_index]
        occupant["x"], occupant["y"] = selected_x, selected_y
    selected["x"], selected["y"] = x, y
    return updated


def return_board_unit(
    state: Mapping[str, Any],
    board_index: int,
    *,
    bench_capacity: int = 9,
) -> dict[str, Any]:
    """Return a deployed unit to the bench if capacity permits."""
    if not isinstance(state, Mapping):
        raise ValueError("state must be an object")
    board = state.get("board")
    bench = state.get("bench")
    if not isinstance(board, list) or not isinstance(bench, list):
        raise ValueError("state must contain board and bench lists")
    if isinstance(board_index, bool) or not isinstance(board_index, int) or board_index < 0:
        raise ValueError("board_index must be a nonnegative integer")
    capacity = _nonnegative_int(bench_capacity, "bench_capacity")
    if len(bench) >= capacity:
        raise ValueError("bench is full")
    if board_index >= len(board):
        raise ValueError("board index is out of range")

    updated = deepcopy(dict(state))
    unit = updated["board"].pop(board_index)
    unit.pop("x", None)
    unit.pop("y", None)
    updated["bench"].append(unit)
    return updated


def merge_units(state: Mapping[str, Any]) -> dict[str, Any]:
    """Merge available triples by unit ID and star, preferring board copies."""
    if not isinstance(state, Mapping):
        raise ValueError("state must be an object")
    board = state.get("board")
    bench = state.get("bench")
    if not isinstance(board, list) or not isinstance(bench, list):
        raise ValueError("state must contain board and bench lists")

    updated = deepcopy(dict(state))
    while True:
        groups: dict[tuple[str, int], list[tuple[str, int]]] = {}
        for zone_name in ("board", "bench"):
            indexed_units = list(enumerate(updated[zone_name]))
            if zone_name == "board":
                for _, unit in indexed_units:
                    if not isinstance(unit, Mapping):
                        raise ValueError("board units must be objects")
                    if "placement_order" in unit:
                        _nonnegative_int(unit["placement_order"], "placement_order")
                indexed_units.sort(
                    key=lambda pair: (
                        pair[1].get("placement_order", pair[0])
                        if isinstance(pair[1], Mapping)
                        else pair[0],
                        pair[0],
                    )
                )
            for index, unit in indexed_units:
                if not isinstance(unit, Mapping):
                    raise ValueError(f"{zone_name} units must be objects")
                unit_id = unit.get("id", unit.get("unit_id"))
                star = unit.get("star", 1)
                if not isinstance(unit_id, str) or not unit_id:
                    raise ValueError("mergeable units must have a non-empty id")
                if isinstance(star, bool) or not isinstance(star, int) or not 1 <= star <= 3:
                    raise ValueError("unit star must be an integer from 1 to 3")
                if "placement_order" in unit:
                    _nonnegative_int(unit["placement_order"], "placement_order")
                if star < 3:
                    groups.setdefault((unit_id, star), []).append((zone_name, index))

        triple = next((locations[:3] for locations in groups.values() if len(locations) >= 3), None)
        if triple is None:
            return updated

        destination = next(
            ((zone, index) for zone, index in triple if zone == "board"),
            triple[0],
        )
        destination_zone, destination_index = destination
        merged_unit = deepcopy(updated[destination_zone][destination_index])
        merged_unit["star"] = merged_unit.get("star", 1) + 1
        updated[destination_zone][destination_index] = merged_unit

        removals: dict[str, list[int]] = {"board": [], "bench": []}
        for zone, index in triple:
            if (zone, index) != destination:
                removals[zone].append(index)
        for zone, indices in removals.items():
            for index in sorted(indices, reverse=True):
                updated[zone].pop(index)