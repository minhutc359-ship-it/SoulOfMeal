"""Deterministic, engine-independent TCG setup and draw rules."""

from __future__ import annotations

import random
from collections.abc import Mapping, Sequence
from copy import deepcopy
from typing import Any


def _integer(value: Any, name: str, *, minimum: int = 0) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise ValueError(f"{name} must be an integer >= {minimum}")
    return value


def validate_deck(
    deck: Mapping[str, Any],
    catalog: Mapping[str, Any],
    *,
    deck_size: int = 36,
    copy_limit: int = 2,
) -> None:
    """Validate expanded deck size, IDs, and per-card copy limits."""
    if not isinstance(deck, Mapping) or not isinstance(catalog, Mapping):
        raise ValueError("deck and catalog must be objects")
    deck_size = _integer(deck_size, "deck_size", minimum=1)
    copy_limit = _integer(copy_limit, "copy_limit", minimum=1)
    cards = deck.get("cards")
    catalog_cards = catalog.get("cards")
    if not isinstance(cards, list) or not isinstance(catalog_cards, list):
        raise ValueError("deck.cards and catalog.cards must be lists")

    catalog_by_id = {}
    for card in catalog_cards:
        if not isinstance(card, Mapping):
            raise ValueError("catalog entries must be objects")
        card_id = card.get("card_id")
        if not isinstance(card_id, str) or not card_id:
            raise ValueError("catalog card_id must be a non-empty string")
        if card_id in catalog_by_id:
            raise ValueError(f"duplicate catalog card_id: {card_id}")
        catalog_by_id[card_id] = card

    total = 0
    seen = set()
    for entry in cards:
        if not isinstance(entry, Mapping):
            raise ValueError("deck entries must be objects")
        card_id = entry.get("card_id")
        count = _integer(entry.get("count"), f"count for {card_id}", minimum=1)
        if card_id not in catalog_by_id:
            raise ValueError(f"unknown card_id: {card_id}")
        if card_id in seen:
            raise ValueError(f"duplicate deck entry: {card_id}")
        seen.add(card_id)
        if count > copy_limit:
            raise ValueError(f"copy limit exceeded for {card_id}")
        total += count
    if total != deck_size:
        raise ValueError(f"deck must contain exactly {deck_size} cards; got {total}")


def _expand_deck(deck: Mapping[str, Any], catalog_by_id: Mapping[str, Mapping[str, Any]], player: int) -> list[dict[str, Any]]:
    expanded = []
    for entry in deck["cards"]:
        card = catalog_by_id[entry["card_id"]]
        for copy_index in range(entry["count"]):
            instance = deepcopy(dict(card))
            instance["instance_id"] = f"p{player}:{card['card_id']}:{copy_index}"
            expanded.append(instance)
    return expanded


def create_match(
    first_deck: Mapping[str, Any],
    second_deck: Mapping[str, Any],
    catalog: Mapping[str, Any],
    *,
    seed: int,
    deck_size: int = 36,
    copy_limit: int = 2,
    opening_hand_size: int = 4,
    commander_hp: int = 8000,
    hand_limit: int = 9,
    max_mana: int = 10,
    max_rounds: int = 40,
) -> dict[str, Any]:
    """Validate decks, shuffle deterministically, and deal opening hands."""
    if isinstance(seed, bool) or not isinstance(seed, int):
        raise ValueError("seed must be an integer")
    opening_hand_size = _integer(opening_hand_size, "opening_hand_size")
    commander_hp = _integer(commander_hp, "commander_hp", minimum=1)
    hand_limit = _integer(hand_limit, "hand_limit", minimum=1)
    max_mana = _integer(max_mana, "max_mana", minimum=1)
    max_rounds = _integer(max_rounds, "max_rounds", minimum=1)
    if opening_hand_size > hand_limit:
        raise ValueError("opening_hand_size cannot exceed hand_limit")

    validate_deck(first_deck, catalog, deck_size=deck_size, copy_limit=copy_limit)
    validate_deck(second_deck, catalog, deck_size=deck_size, copy_limit=copy_limit)
    catalog_by_id = {card["card_id"]: card for card in catalog["cards"]}
    generator = random.Random(seed)
    players = []
    for player_index, deck in enumerate((first_deck, second_deck)):
        library = _expand_deck(deck, catalog_by_id, player_index)
        generator.shuffle(library)
        hand = [library.pop() for _ in range(opening_hand_size)]
        players.append({
            "player_id": player_index,
            "commander_hp": commander_hp,
            "max_mana": 0,
            "mana": 0,
            "deck": library,
            "hand": hand,
            "burned": [],
            "graveyard": [],
            "exile": [],
            "units": [],
            "traps": [],
            "mulligan_used": False,
            "turns_started": 0,
            "attack_declared_round": None,
        })

    return {
        "rules_version": "v3-proposed",
        "catalog_version": catalog.get("catalog_version"),
        "seed": seed,
        "mana_cap": max_mana,
        "max_rounds": max_rounds,
        "phase": "mulligan",
        "round": 0,
        "active_player": 0,
        "priority_player": 0,
        "consecutive_passes": 0,
        "players": players,
        "stack": [],
        "next_stack_id": 1,
        "action_seq": 0,
        "attacks": [],
        "pending_attack": None,
        "winner": None,
        "result": None,
        "event_log": [{"seq": 0, "type": "match_started", "seed": seed}],
    }


def mulligan(state: Mapping[str, Any], player_index: int, hand_indices: Sequence[int]) -> dict[str, Any]:
    """Replace chosen opening cards once, returning them to a seeded-shuffled deck."""
    _validate_player_index(state, player_index)
    if state.get("phase") != "mulligan":
        raise ValueError("mulligan is only legal during mulligan phase")
    if not isinstance(hand_indices, Sequence) or isinstance(hand_indices, (str, bytes)):
        raise ValueError("hand_indices must be a sequence")
    player = state["players"][player_index]
    if player["mulligan_used"]:
        raise ValueError("mulligan already used")
    if any(isinstance(index, bool) or not isinstance(index, int) for index in hand_indices):
        raise ValueError("hand indices must be integers")
    if len(set(hand_indices)) != len(hand_indices):
        raise ValueError("hand indices must be unique")
    if any(index < 0 or index >= len(player["hand"]) for index in hand_indices):
        raise ValueError("hand index is out of range")

    updated = deepcopy(dict(state))
    updated_player = updated["players"][player_index]
    replaced = [updated_player["hand"][index] for index in sorted(hand_indices)]
    for index in sorted(hand_indices, reverse=True):
        updated_player["hand"].pop(index)
    updated_player["deck"].extend(replaced)
    shuffle_seed = updated["seed"] + 1_000_003 * (player_index + 1)
    random.Random(shuffle_seed).shuffle(updated_player["deck"])
    updated_player["hand"].extend(
        updated_player["deck"].pop()
        for _ in range(len(replaced))
    )
    updated_player["mulligan_used"] = True
    _append_event(updated, "mulligan_resolved", player_index, replaced_count=len(replaced))
    return updated


def finish_mulligans(state: Mapping[str, Any]) -> dict[str, Any]:
    """Close the mulligan window and start round one for the first player."""
    if not isinstance(state, Mapping) or state.get("phase") != "mulligan":
        raise ValueError("match is not in mulligan phase")
    updated = deepcopy(dict(state))
    updated["phase"] = "round_start"
    return start_turn(updated, updated["active_player"])


def start_turn(state: Mapping[str, Any], player_index: int) -> dict[str, Any]:
    """Increase and refill mana, then draw unless this is the first player's first turn."""
    _validate_player_index(state, player_index)
    if state.get("phase") != "round_start":
        raise ValueError("turn can only start in round_start phase")
    if state.get("active_player") != player_index:
        raise ValueError("turn order mismatch")
    updated = deepcopy(dict(state))
    player = updated["players"][player_index]
    if player_index == 0:
        updated["round"] += 1
    skips_first_draw = player["turns_started"] == 0 and player_index == 0
    player["turns_started"] += 1
    updated["active_player"] = player_index
    updated["priority_player"] = player_index
    updated["consecutive_passes"] = 0
    player["max_mana"] = min(player["max_mana"] + 1, updated["mana_cap"])
    player["mana"] = player["max_mana"]
    for unit in player["units"]:
        unit["can_attack_this_round"] = (
            unit.get("summoned_round", -1) < updated["round"]
            or "haste" in unit.get("keywords", [])
        )
    updated["phase"] = "draw"
    _append_event(updated, "round_started", player_index, round=updated["round"], max_mana=player["max_mana"])

    if not skips_first_draw:
        updated = draw_cards(updated, player_index, 1)
    if updated["result"] is None:
        updated["phase"] = "action"
    return updated


def end_round(state: Mapping[str, Any], player_index: int) -> dict[str, Any]:
    """Advance to the opponent's turn or adjudicate the configured round limit."""
    _validate_player_index(state, player_index)
    if state.get("phase") != "round_end":
        raise ValueError("round can only end from round_end phase")
    if state.get("active_player") != player_index:
        raise ValueError("only the active player can end their turn")
    if state.get("stack"):
        raise ValueError("cannot end a round while the stack is open")

    updated = deepcopy(dict(state))
    next_player = 1 - player_index
    if next_player == 0 and updated["round"] >= updated["max_rounds"]:
        first_hp = updated["players"][0]["commander_hp"]
        second_hp = updated["players"][1]["commander_hp"]
        if first_hp == second_hp:
            updated["winner"] = None
            updated["result"] = "round_limit_draw"
        else:
            updated["winner"] = 0 if first_hp > second_hp else 1
            updated["result"] = "round_limit_winner"
        updated["phase"] = "result"
        _append_event(
            updated,
            "match_finished",
            player_index,
            result=updated["result"],
            commander_hp=[first_hp, second_hp],
        )
        return updated

    updated["active_player"] = next_player
    updated["phase"] = "round_start"
    _append_event(updated, "turn_ended", player_index, next_player=next_player)
    return start_turn(updated, next_player)


def draw_cards(
    state: Mapping[str, Any],
    player_index: int,
    count: int = 1,
    *,
    hand_limit: int = 9,
    mandatory: bool = True,
) -> dict[str, Any]:
    """Draw cards, burn excess over hand limit, or lose on mandatory deck-out."""
    _validate_player_index(state, player_index)
    count = _integer(count, "count")
    hand_limit = _integer(hand_limit, "hand_limit", minimum=1)
    if not isinstance(mandatory, bool):
        raise ValueError("mandatory must be a boolean")
    updated = deepcopy(dict(state))
    player = updated["players"][player_index]
    for _ in range(count):
        if not player["deck"]:
            if mandatory:
                updated["winner"] = 1 - player_index
                updated["result"] = "deck_out"
                updated["phase"] = "result"
                _append_event(updated, "deck_out", player_index, winner=updated["winner"])
            break
        card = player["deck"].pop()
        if len(player["hand"]) >= hand_limit:
            player["burned"].append(card)
            _append_event(updated, "card_burned", player_index, count=1)
        else:
            player["hand"].append(card)
            _append_event(updated, "card_drawn", player_index, count=1)
    return updated


def play_card(
    state: Mapping[str, Any],
    player_index: int,
    hand_index: int,
    *,
    target: Mapping[str, Any] | None = None,
    unit_capacity: int = 5,
    trap_capacity: int = 2,
) -> dict[str, Any]:
    """Play a unit/trap or cast a supported spell from the current priority hand."""
    _validate_player_index(state, player_index)
    if state.get("phase") not in {"action", "reaction"}:
        raise ValueError("cards can only be played during action or reaction phase")
    if state.get("priority_player") != player_index:
        raise ValueError("player does not have priority")
    if isinstance(hand_index, bool) or not isinstance(hand_index, int) or hand_index < 0:
        raise ValueError("hand_index must be a nonnegative integer")
    unit_capacity = _integer(unit_capacity, "unit_capacity", minimum=1)
    trap_capacity = _integer(trap_capacity, "trap_capacity", minimum=1)
    player = state["players"][player_index]
    if hand_index >= len(player["hand"]):
        raise ValueError("hand index is out of range")
    card = player["hand"][hand_index]
    card_type = card.get("type")
    cost = _integer(card.get("cost"), "card cost")
    if player["mana"] < cost:
        raise ValueError("not enough mana")
    if state["phase"] == "reaction" and card_type != "fast_spell":
        raise ValueError("only fast spells can be played during reaction phase")

    if card_type == "unit":
        if len(player["units"]) >= unit_capacity:
            raise ValueError("unit slots are full")
    elif card_type == "trap":
        if len(player["traps"]) >= trap_capacity:
            raise ValueError("trap slots are full")
        _validate_trap_definition(card)
    elif card_type in {"slow_spell", "fast_spell", "burst_spell"}:
        effect = card.get("effect")
        if not isinstance(effect, Mapping) or effect.get("kind") != "deal_damage":
            raise ValueError("card effect is not implemented")
        _validate_target(state, player_index, target)
        if card_type == "slow_spell" and state["stack"]:
            raise ValueError("slow spell cannot be played while the stack is open")
        if card_type == "burst_spell" and state["stack"]:
            raise ValueError("burst spell cannot resolve while the stack is open")
    else:
        raise ValueError(f"unsupported card type: {card_type}")

    updated = deepcopy(dict(state))
    actor = updated["players"][player_index]
    played_card = actor["hand"].pop(hand_index)
    actor["mana"] -= cost
    opponent_index = 1 - player_index
    trap_triggered = False
    if card_type == "unit":
        played_card["current_def"] = played_card["max_def"]
        played_card["summoned_round"] = updated["round"]
        played_card["can_attack_this_round"] = "haste" in played_card.get("keywords", [])
        actor["units"].append(played_card)
        _append_event(updated, "unit_summoned", player_index, card_id=played_card["card_id"])
    elif card_type == "trap":
        actor["traps"].append({
            "card": played_card,
            "face_down": True,
            "set_round": updated["round"],
        })
        _append_event(updated, "trap_set", player_index, trap_count=len(actor["traps"]))
    elif card_type == "fast_spell":
        stack_item = {
            "stack_id": updated["next_stack_id"],
            "kind": "spell",
            "card": played_card,
            "controller": player_index,
            "target": dict(target),
        }
        updated["next_stack_id"] += 1
        updated["stack"].append(stack_item)
        _append_event(updated, "spell_cast", player_index, card_id=played_card["card_id"], stack_size=len(updated["stack"]))
        trap_triggered = _trigger_matching_traps(updated, player_index, stack_item)
    else:
        updated = _resolve_spell(updated, played_card, player_index, target)
    updated["priority_player"] = player_index if trap_triggered else opponent_index
    updated["consecutive_passes"] = 0
    return updated


def _validate_trap_definition(card: Mapping[str, Any]) -> None:
    trigger = card.get("trigger")
    effect = card.get("effect")
    if not isinstance(trigger, Mapping):
        raise ValueError("trap trigger is not implemented")
    condition = trigger.get("condition")
    if not isinstance(condition, Mapping):
        raise ValueError("trap condition is not implemented")
    if trigger.get("when") == "spell_cast":
        if condition.get("card_type") != "fast_spell":
            raise ValueError("trap condition is not implemented")
    elif trigger.get("when") == "attack_declared":
        _integer(condition.get("min_attackers"), "trap min_attackers", minimum=1)
    else:
        raise ValueError("trap trigger is not implemented")
    if not isinstance(effect, Mapping) or effect.get("kind") != "conditional_counter":
        raise ValueError("trap effect is not implemented")


def _trigger_matching_traps(
    state: dict[str, Any],
    spell_owner: int,
    stack_item: Mapping[str, Any],
) -> bool:
    trap_owner = 1 - spell_owner
    traps = state["players"][trap_owner]["traps"]
    eligible = []
    for index, trap in enumerate(traps):
        card = trap["card"]
        trigger = card.get("trigger", {})
        condition = trigger.get("condition", {}) if isinstance(trigger, Mapping) else {}
        if (
            trap.get("face_down")
            and trap.get("set_round", state["round"]) < state["round"]
            and trigger.get("when") == "spell_cast"
            and condition.get("card_type") == stack_item["card"].get("type")
        ):
            eligible.append(index)

    for index in reversed(eligible):
        trap = traps.pop(index)
        card = trap["card"]
        _append_event(
            state,
            "trap_revealed",
            trap_owner,
            card_id=card["card_id"],
            trigger_stack_id=stack_item["stack_id"],
        )
        reaction = {
            "stack_id": state["next_stack_id"],
            "kind": "trap",
            "card": card,
            "controller": trap_owner,
            "counter_stack_id": stack_item["stack_id"],
        }
        state["next_stack_id"] += 1
        state["stack"].append(reaction)
        _append_event(
            state,
            "trap_triggered",
            trap_owner,
            stack_size=len(state["stack"]),
        )
    return bool(eligible)


def _trigger_attack_traps(
    state: dict[str, Any],
    attacker_index: int,
    attack_id: int,
    attacker_count: int,
) -> bool:
    trap_owner = 1 - attacker_index
    traps = state["players"][trap_owner]["traps"]
    eligible = []
    for index, trap in enumerate(traps):
        card = trap["card"]
        trigger = card.get("trigger", {})
        condition = trigger.get("condition", {}) if isinstance(trigger, Mapping) else {}
        minimum = condition.get("min_attackers", 1)
        if (
            trap.get("face_down")
            and trap.get("set_round", state["round"]) < state["round"]
            and trigger.get("when") == "attack_declared"
            and attacker_count >= minimum
        ):
            eligible.append(index)

    for index in reversed(eligible):
        trap = traps.pop(index)
        card = trap["card"]
        _append_event(
            state,
            "trap_revealed",
            trap_owner,
            card_id=card["card_id"],
            trigger_attack_id=attack_id,
        )
        reaction = {
            "stack_id": state["next_stack_id"],
            "kind": "trap",
            "card": card,
            "controller": trap_owner,
            "counter_attack_id": attack_id,
        }
        state["next_stack_id"] += 1
        state["stack"].append(reaction)
        _append_event(state, "trap_triggered", trap_owner, stack_size=len(state["stack"]))
    return bool(eligible)


def _resolve_trap(state: dict[str, Any], reaction: Mapping[str, Any]) -> dict[str, Any]:
    updated = deepcopy(state)
    card = reaction["card"]
    controller = reaction["controller"]
    counter_id = reaction.get("counter_stack_id")
    if counter_id is None:
        pending_attack = updated.get("pending_attack")
        if pending_attack is None or pending_attack.get("attack_id") != reaction.get("counter_attack_id"):
            _append_event(updated, "trap_fizzled", controller, card_id=card["card_id"])
        else:
            pending_attack["cancelled"] = True
            updated["attacks"] = []
            _append_event(updated, "attack_countered", controller, trap_card_id=card["card_id"])
        updated["players"][controller]["graveyard"].append(card)
        return updated
    counter_index = next(
        (index for index, item in enumerate(updated["stack"]) if item.get("stack_id") == counter_id),
        None,
    )
    if counter_index is None:
        _append_event(updated, "trap_fizzled", controller, card_id=card["card_id"])
    else:
        countered = updated["stack"].pop(counter_index)
        updated["players"][countered["controller"]]["graveyard"].append(countered["card"])
        _append_event(
            updated,
            "stack_item_countered",
            controller,
            trap_card_id=card["card_id"],
            countered_stack_id=counter_id,
        )
    updated["players"][controller]["graveyard"].append(card)
    return updated


def pass_priority(state: Mapping[str, Any], player_index: int) -> dict[str, Any]:
    """Pass priority; two consecutive passes resolve one stack item or close action phase."""
    _validate_player_index(state, player_index)
    if state.get("phase") not in {"action", "reaction"}:
        raise ValueError("priority can only be passed during action or reaction phase")
    if state.get("priority_player") != player_index:
        raise ValueError("player does not have priority")
    updated = deepcopy(dict(state))
    _append_event(updated, "priority_passed", player_index)
    updated["consecutive_passes"] += 1
    if updated["consecutive_passes"] < 2:
        updated["priority_player"] = 1 - player_index
        return updated

    updated["consecutive_passes"] = 0
    if updated["stack"]:
        stack_item = updated["stack"].pop()
        if stack_item.get("kind") == "trap":
            updated = _resolve_trap(updated, stack_item)
        else:
            updated = _resolve_spell(
                updated,
                stack_item["card"],
                stack_item["controller"],
                stack_item["target"],
            )
        if updated["result"] is None:
            updated["priority_player"] = updated["active_player"]
        return updated

    if updated["phase"] == "reaction":
        updated["phase"] = "block_assign"
        _append_event(updated, "reaction_window_closed", player_index)
        return updated

    updated["phase"] = "combat_declare"
    updated["priority_player"] = updated["active_player"]
    _append_event(updated, "action_phase_ended", player_index)
    return updated


def declare_attacks(
    state: Mapping[str, Any],
    player_index: int,
    attackers: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    """Declare up to five ready units on unique attack lanes."""
    _validate_player_index(state, player_index)
    if state.get("phase") != "combat_declare":
        raise ValueError("attacks can only be declared during combat_declare")
    if state.get("active_player") != player_index:
        raise ValueError("only the active player may declare attacks")
    if state["players"][player_index].get("attack_declared_round") == state.get("round"):
        raise ValueError("attack token already used this round")
    if not isinstance(attackers, Sequence) or isinstance(attackers, (str, bytes)):
        raise ValueError("attackers must be a sequence")
    if len(attackers) > 5:
        raise ValueError("at most five attackers may be declared")

    available = {unit.get("instance_id"): unit for unit in state["players"][player_index]["units"]}
    lanes = set()
    attacker_ids = set()
    normalized = []
    for assignment in attackers:
        if not isinstance(assignment, Mapping):
            raise ValueError("attacker assignments must be objects")
        instance_id = assignment.get("instance_id")
        lane = assignment.get("lane")
        if not isinstance(instance_id, str) or instance_id not in available:
            raise ValueError("attacker unit does not exist")
        if isinstance(lane, bool) or not isinstance(lane, int) or not 0 <= lane < 5:
            raise ValueError("attack lane must be an integer from 0 to 4")
        if lane in lanes or instance_id in attacker_ids:
            raise ValueError("attack lanes and attackers must be unique")
        unit = available[instance_id]
        if not unit.get("can_attack_this_round", False):
            raise ValueError("attacker is not ready to attack")
        _integer(unit.get("atk"), "unit atk", minimum=1)
        _integer(unit.get("current_def"), "unit current_def", minimum=1)
        lanes.add(lane)
        attacker_ids.add(instance_id)
        normalized.append({"instance_id": instance_id, "lane": lane})

    updated = deepcopy(dict(state))
    updated["attacks"] = normalized
    updated["players"][player_index]["attack_declared_round"] = updated["round"]
    updated["phase"] = "block_assign"
    updated["blocker_assignments"] = []
    attack_id = updated["next_stack_id"]
    updated["next_stack_id"] += 1
    updated["pending_attack"] = {
        "attack_id": attack_id,
        "controller": player_index,
        "cancelled": False,
    }
    _append_event(updated, "attacks_declared", player_index, lanes=sorted(lanes))
    triggered = _trigger_attack_traps(updated, player_index, attack_id, len(normalized))
    updated["phase"] = "reaction" if triggered else "block_assign"
    if triggered:
        updated["priority_player"] = player_index
    return updated


def assign_blockers(
    state: Mapping[str, Any],
    player_index: int,
    blockers: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    """Assign at most one available defender per lane and resolve combat simultaneously."""
    _validate_player_index(state, player_index)
    if state.get("phase") != "block_assign":
        raise ValueError("blockers can only be assigned during block_assign")
    if player_index != 1 - state.get("active_player", -1):
        raise ValueError("only the defender may assign blockers")
    if not isinstance(blockers, Sequence) or isinstance(blockers, (str, bytes)):
        raise ValueError("blockers must be a sequence")

    attack_by_lane = {attack["lane"]: attack for attack in state["attacks"]}
    defender_units = {unit.get("instance_id"): unit for unit in state["players"][player_index]["units"]}
    used_lanes = set()
    used_units = set()
    blocker_by_lane = {}
    for assignment in blockers:
        if not isinstance(assignment, Mapping):
            raise ValueError("blocker assignments must be objects")
        lane = assignment.get("lane")
        instance_id = assignment.get("instance_id")
        if isinstance(lane, bool) or not isinstance(lane, int) or lane not in attack_by_lane:
            raise ValueError("blocker lane has no declared attacker")
        if lane in used_lanes or instance_id in used_units:
            raise ValueError("each lane and blocker may be assigned only once")
        if not isinstance(instance_id, str) or instance_id not in defender_units:
            raise ValueError("blocker unit does not exist")
        unit = defender_units[instance_id]
        _integer(unit.get("atk"), "unit atk", minimum=1)
        _integer(unit.get("current_def"), "unit current_def", minimum=1)
        used_lanes.add(lane)
        used_units.add(instance_id)
        blocker_by_lane[lane] = instance_id

    updated = deepcopy(dict(state))
    updated["blocker_assignments"] = [
        {"lane": lane, "instance_id": instance_id}
        for lane, instance_id in sorted(blocker_by_lane.items())
    ]
    _resolve_combat(updated, player_index, blocker_by_lane)
    return updated


def _resolve_combat(
    state: dict[str, Any],
    defender_index: int,
    blocker_by_lane: Mapping[int, str],
) -> None:
    attacker_index = state["active_player"]
    damage_by_unit: dict[tuple[int, str], int] = {}
    commander_damage = 0
    attackers = {
        unit["instance_id"]: unit
        for unit in state["players"][attacker_index]["units"]
    }
    defenders = {
        unit["instance_id"]: unit
        for unit in state["players"][defender_index]["units"]
    }

    for attack in state["attacks"]:
        attacker = attackers[attack["instance_id"]]
        blocker_id = blocker_by_lane.get(attack["lane"])
        attacker["can_attack_this_round"] = False
        if blocker_id is None:
            commander_damage += attacker["atk"]
            continue
        blocker = defenders[blocker_id]
        attacker_key = (attacker_index, attacker["instance_id"])
        blocker_key = (defender_index, blocker["instance_id"])
        damage_by_unit[attacker_key] = damage_by_unit.get(attacker_key, 0) + blocker["atk"]
        damage_by_unit[blocker_key] = damage_by_unit.get(blocker_key, 0) + attacker["atk"]

    state["players"][defender_index]["commander_hp"] = max(
        0,
        state["players"][defender_index]["commander_hp"] - commander_damage,
    )
    _append_event(
        state,
        "combat_resolved",
        attacker_index,
        commander_damage=commander_damage,
        blocked_lanes=sorted(blocker_by_lane),
    )

    for owner_index in (attacker_index, defender_index):
        player = state["players"][owner_index]
        surviving = []
        for unit in player["units"]:
            damage = damage_by_unit.get((owner_index, unit["instance_id"]), 0)
            if damage:
                unit["current_def"] = max(0, unit["current_def"] - damage)
                _append_event(
                    state,
                    "unit_damaged",
                    owner_index,
                    instance_id=unit["instance_id"],
                    damage=damage,
                    current_def=unit["current_def"],
                )
            if unit["current_def"] <= 0:
                player["graveyard"].append(unit)
                _append_event(state, "unit_destroyed", owner_index, card_id=unit["card_id"])
            else:
                surviving.append(unit)
        player["units"] = surviving

    if state["players"][defender_index]["commander_hp"] <= 0:
        state["winner"] = attacker_index
        state["result"] = "commander_defeated"
        state["phase"] = "result"
        _append_event(state, "match_finished", attacker_index, result=state["result"])
    else:
        state["phase"] = "round_end"


def _validate_target(
    state: Mapping[str, Any],
    player_index: int,
    target: Mapping[str, Any] | None,
) -> None:
    if not isinstance(target, Mapping):
        raise ValueError("spell target is required")
    target_player = target.get("player")
    if isinstance(target_player, bool) or target_player != 1 - player_index:
        raise ValueError("spells must target the opponent in this prototype")
    if target.get("kind") == "commander":
        return
    if target.get("kind") == "unit":
        instance_id = target.get("instance_id")
        if not isinstance(instance_id, str) or not any(
            unit.get("instance_id") == instance_id
            for unit in state["players"][target_player]["units"]
        ):
            raise ValueError("target unit does not exist")
        return
    raise ValueError("unsupported spell target")


def _resolve_spell(
    state: dict[str, Any],
    card: Mapping[str, Any],
    controller: int,
    target: Mapping[str, Any],
) -> dict[str, Any]:
    updated = deepcopy(state)
    updated["players"][controller]["graveyard"].append(deepcopy(dict(card)))
    effect = card["effect"]
    amount = _integer(effect.get("value"), "effect value")
    target_player_index = target["player"]
    target_player = updated["players"][target_player_index]
    if target["kind"] == "commander":
        target_player["commander_hp"] = max(0, target_player["commander_hp"] - amount)
        _append_event(
            updated,
            "spell_resolved",
            controller,
            card_id=card["card_id"],
            target_kind="commander",
            damage=amount,
        )
    else:
        unit_index = next(
            (index for index, unit in enumerate(target_player["units"])
             if unit.get("instance_id") == target.get("instance_id")),
            None,
        )
        if unit_index is None:
            _append_event(updated, "spell_fizzled", controller, card_id=card["card_id"])
        else:
            unit = target_player["units"][unit_index]
            unit["current_def"] = max(0, unit["current_def"] - amount)
            _append_event(
                updated,
                "spell_resolved",
                controller,
                card_id=card["card_id"],
                target_kind="unit",
                target_instance_id=unit["instance_id"],
                damage=amount,
            )
            if unit["current_def"] == 0:
                target_player["graveyard"].append(target_player["units"].pop(unit_index))
                _append_event(updated, "unit_destroyed", target_player_index, card_id=unit["card_id"])

    if target_player["commander_hp"] <= 0:
        player_hp = updated["players"][controller]["commander_hp"]
        if player_hp <= 0:
            updated["winner"] = None
            updated["result"] = "draw"
        else:
            updated["winner"] = controller
            updated["result"] = "commander_defeated"
        updated["phase"] = "result"
        _append_event(updated, "match_finished", controller, result=updated["result"])
    return updated


def _validate_player_index(state: Mapping[str, Any], player_index: int) -> None:
    if not isinstance(state, Mapping) or not isinstance(state.get("players"), list):
        raise ValueError("state must contain a players list")
    if isinstance(player_index, bool) or not isinstance(player_index, int) or not 0 <= player_index < len(state["players"]):
        raise ValueError("player_index is out of range")


def _append_event(state: dict[str, Any], event_type: str, player_index: int, **payload: Any) -> None:
    sequence = len(state["event_log"])
    state["action_seq"] = sequence
    state["event_log"].append({
        "seq": sequence,
        "type": event_type,
        "player": player_index,
        "payload": payload,
    })