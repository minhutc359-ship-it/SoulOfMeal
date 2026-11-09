"""Deterministic, animation-independent Adventure battle rules prototype."""

from __future__ import annotations

import hashlib
from collections.abc import Mapping, Sequence
from copy import deepcopy
from typing import Any


def _integer(value: Any, name: str, *, minimum: int = 0) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise ValueError(f"{name} must be an integer >= {minimum}")
    return value


def create_battle(
    actors: Sequence[Mapping[str, Any]],
    *,
    seed: int,
    battle_id: str = "battle_adventure_p0",
    rules_version: str = "v3-proposed",
) -> dict[str, Any]:
    """Create a validated battle state from actor stat records."""
    if isinstance(seed, bool) or not isinstance(seed, int):
        raise ValueError("seed must be an integer")
    if not isinstance(battle_id, str) or not battle_id:
        raise ValueError("battle_id must be a non-empty string")
    if not isinstance(actors, Sequence) or isinstance(actors, (str, bytes)) or not actors:
        raise ValueError("actors must be a non-empty sequence")

    actor_map = {}
    for source in actors:
        if not isinstance(source, Mapping):
            raise ValueError("actors must be objects")
        actor = deepcopy(dict(source))
        actor_id = actor.get("actor_id")
        if not isinstance(actor_id, str) or not actor_id:
            raise ValueError("actor_id must be a non-empty string")
        if actor_id in actor_map:
            raise ValueError(f"duplicate actor_id: {actor_id}")
        actor["max_hp"] = _integer(actor.get("max_hp"), f"{actor_id}.max_hp", minimum=1)
        actor["hp"] = _integer(actor.get("hp", actor["max_hp"]), f"{actor_id}.hp")
        if actor["hp"] > actor["max_hp"]:
            raise ValueError(f"{actor_id}.hp cannot exceed max_hp")
        actor["atk"] = _integer(actor.get("atk"), f"{actor_id}.atk")
        actor["def"] = _integer(actor.get("def", 0), f"{actor_id}.def")
        actor["energy_max"] = _integer(actor.get("energy_max", 100), f"{actor_id}.energy_max", minimum=1)
        actor["energy"] = _integer(actor.get("energy", 0), f"{actor_id}.energy")
        if actor["energy"] > actor["energy_max"]:
            raise ValueError(f"{actor_id}.energy cannot exceed energy_max")
        actor["shield"] = _integer(actor.get("shield", 0), f"{actor_id}.shield")
        actor["crit_chance_bp"] = _integer(actor.get("crit_chance_bp", 0), f"{actor_id}.crit_chance_bp")
        if actor["crit_chance_bp"] > 10000:
            raise ValueError(f"{actor_id}.crit_chance_bp cannot exceed 10000")
        actor["crit_multiplier_bp"] = _integer(actor.get("crit_multiplier_bp", 15000), f"{actor_id}.crit_multiplier_bp")
        actor["cooldowns"] = deepcopy(actor.get("cooldowns", {}))
        actor["statuses"] = deepcopy(actor.get("statuses", []))
        actor["alive"] = actor["hp"] > 0
        actor_map[actor_id] = actor

    state = {
        "battle_id": battle_id,
        "rules_version": rules_version,
        "seed": seed,
        "tick": 0,
        "phase": "battle_running",
        "actors": actor_map,
        "pending_hits": [],
        "resolved_hit_ids": [],
        "next_hit_seq": 1,
        "event_seq": 0,
        "events": [],
        "result": None,
    }
    _emit(state, "battle_started", payload={"actor_ids": sorted(actor_map)})
    for actor_id in sorted(actor_map):
        _emit(state, "actor_spawned", source_id=actor_id, payload={"hp": actor_map[actor_id]["hp"]})
    return state


def calculate_damage(
    atk: int,
    coefficient_bp: int,
    defense: int,
    *,
    critical: bool = False,
    crit_multiplier_bp: int = 15000,
) -> dict[str, int]:
    """Apply the proposed Adventure damage formula using integer arithmetic."""
    atk = _integer(atk, "atk")
    coefficient_bp = _integer(coefficient_bp, "coefficient_bp")
    defense = _integer(defense, "defense")
    crit_multiplier_bp = _integer(crit_multiplier_bp, "crit_multiplier_bp", minimum=1)
    base = max(1, atk * coefficient_bp // 10000)
    mitigated = max(1, base * 100 // (100 + defense))
    damage = mitigated * crit_multiplier_bp // 10000 if critical else mitigated
    return {"base_damage": base, "mitigated_damage": mitigated, "damage": max(1, damage)}


def schedule_hit(
    state: Mapping[str, Any],
    source_id: str,
    target_id: str,
    *,
    coefficient_bp: int = 10000,
    element: str | None = None,
    delay_ticks: int = 0,
    hit_id: str | None = None,
) -> dict[str, Any]:
    """Schedule an authoritative hit; visuals cannot cause or duplicate its damage."""
    _validate_battle(state)
    delay_ticks = _integer(delay_ticks, "delay_ticks")
    coefficient_bp = _integer(coefficient_bp, "coefficient_bp")
    _validate_actor(state, source_id, can_act=True)
    _validate_actor(state, target_id)
    updated = deepcopy(dict(state))
    if hit_id is None:
        hit_id = f"hit_{updated['next_hit_seq']:06d}"
    if not isinstance(hit_id, str) or not hit_id:
        raise ValueError("hit_id must be a non-empty string")
    if hit_id in updated["resolved_hit_ids"] or any(hit["hit_id"] == hit_id for hit in updated["pending_hits"]):
        raise ValueError(f"duplicate hit_id: {hit_id}")

    hit = {
        "hit_id": hit_id,
        "source_id": source_id,
        "target_id": target_id,
        "coefficient_bp": coefficient_bp,
        "element": element,
        "due_tick": updated["tick"] + delay_ticks,
        "sequence": updated["next_hit_seq"],
    }
    updated["next_hit_seq"] += 1
    updated["pending_hits"].append(hit)
    updated["pending_hits"].sort(key=lambda item: (item["due_tick"], item["sequence"]))
    _emit(updated, "projectile_spawned", source_id=source_id, target_id=target_id, payload={"hit_id": hit_id, "due_tick": hit["due_tick"]})
    if delay_ticks == 0:
        _resolve_due_hits(updated)
    return updated


def activate_ultimate(
    state: Mapping[str, Any],
    actor_id: str,
    target_id: str,
    ability: Mapping[str, Any],
    *,
    energy_cost: int = 100,
    cooldown_ticks: int = 90,
) -> dict[str, Any]:
    """Validate ultimate resource/cooldown and schedule its configured hit tick."""
    _validate_battle(state)
    if not isinstance(ability, Mapping):
        raise ValueError("ability must be an object")
    _validate_actor(state, actor_id, can_act=True)
    _validate_actor(state, target_id)
    energy_cost = _integer(energy_cost, "energy_cost", minimum=1)
    cooldown_ticks = _integer(cooldown_ticks, "cooldown_ticks")
    coefficient_bp = _integer(ability.get("coefficient_bp"), "coefficient_bp")
    hit_delay = _integer(ability.get("hit_tick_offset", 0), "hit_tick_offset")
    source = state["actors"][actor_id]
    ability_id = ability.get("ability_id")
    if not isinstance(ability_id, str) or not ability_id:
        raise ValueError("ability_id must be a non-empty string")
    if source["energy"] < energy_cost:
        raise ValueError("no_energy")
    if source["cooldowns"].get(ability_id, 0) > state["tick"]:
        raise ValueError("cooldown")

    updated = deepcopy(dict(state))
    updated_source = updated["actors"][actor_id]
    updated_source["energy"] -= energy_cost
    updated_source["cooldowns"][ability_id] = updated["tick"] + cooldown_ticks
    _emit(
        updated,
        "cast_started",
        source_id=actor_id,
        target_id=target_id,
        payload={"ability_id": ability_id, "energy_cost": energy_cost, "hit_tick": updated["tick"] + hit_delay},
    )
    return schedule_hit(
        updated,
        actor_id,
        target_id,
        coefficient_bp=coefficient_bp,
        element=ability.get("element"),
        delay_ticks=hit_delay,
        hit_id=f"{ability_id}:{updated['next_hit_seq']:06d}",
    )


def advance_ticks(state: Mapping[str, Any], ticks: int = 1) -> dict[str, Any]:
    """Advance fixed simulation ticks and resolve due hits in stable order."""
    _validate_battle(state)
    ticks = _integer(ticks, "ticks")
    updated = deepcopy(dict(state))
    for _ in range(ticks):
        if updated["phase"] != "battle_running":
            break
        updated["tick"] += 1
        _expire_statuses(updated)
        _resolve_due_hits(updated)
    return updated


def apply_status(
    state: Mapping[str, Any],
    target_id: str,
    status_id: str,
    *,
    source_id: str,
    duration_ticks: int,
    application_id: str,
    magnitude_bp: int = 0,
) -> dict[str, Any]:
    """Apply a supported, idempotent status to an actor."""
    _validate_battle(state)
    _validate_actor(state, target_id)
    if status_id not in {"burn", "slow", "bind", "stun", "taunt"}:
        raise ValueError(f"unsupported status: {status_id}")
    duration_ticks = _integer(duration_ticks, "duration_ticks", minimum=1)
    magnitude_bp = _integer(magnitude_bp, "magnitude_bp")
    if not isinstance(application_id, str) or not application_id:
        raise ValueError("application_id must be a non-empty string")
    if source_id not in state["actors"]:
        raise ValueError("source actor does not exist")
    existing = state["actors"][target_id]["statuses"]
    if any(status.get("application_id") == application_id for status in existing):
        return deepcopy(dict(state))

    updated = deepcopy(dict(state))
    actor = updated["actors"][target_id]
    status = {
        "status_id": status_id,
        "source_actor_id": source_id,
        "expires_tick": updated["tick"] + duration_ticks,
        "magnitude_bp": magnitude_bp,
        "application_id": application_id,
        "next_tick": updated["tick"] + 30 if status_id == "burn" else None,
    }
    matching = [item for item in actor["statuses"] if item["status_id"] == status_id]
    if status_id == "burn":
        if len(matching) >= 3:
            weakest = min(matching, key=lambda item: (item["magnitude_bp"], item["expires_tick"]))
            actor["statuses"].remove(weakest)
        actor["statuses"].append(status)
    elif status_id == "slow" and matching:
        strongest = max(matching, key=lambda item: item["magnitude_bp"])
        strongest["magnitude_bp"] = max(strongest["magnitude_bp"], magnitude_bp)
        strongest["expires_tick"] = max(strongest["expires_tick"], status["expires_tick"])
    elif status_id in {"stun", "bind", "taunt"} and matching:
        strongest = max(matching, key=lambda item: item["expires_tick"])
        strongest["expires_tick"] = max(strongest["expires_tick"], status["expires_tick"])
    else:
        actor["statuses"].append(status)
    _emit(updated, "status_applied", source_id=source_id, target_id=target_id, payload={"status_id": status_id, "application_id": application_id})
    return updated


def grant_shield(
    state: Mapping[str, Any],
    target_id: str,
    amount: int,
    *,
    source_id: str,
    application_id: str,
) -> dict[str, Any]:
    """Add shield up to the proposed 40% max-HP cap; application IDs are idempotent."""
    _validate_battle(state)
    _validate_actor(state, target_id)
    amount = _integer(amount, "amount")
    if source_id not in state["actors"]:
        raise ValueError("source actor does not exist")
    if not isinstance(application_id, str) or not application_id:
        raise ValueError("application_id must be a non-empty string")
    if application_id in state.get("shield_applications", []):
        return deepcopy(dict(state))
    updated = deepcopy(dict(state))
    actor = updated["actors"][target_id]
    cap = actor["max_hp"] * 40 // 100
    before = actor["shield"]
    actor["shield"] = min(cap, before + amount)
    updated.setdefault("shield_applications", []).append(application_id)
    _emit(updated, "shield_changed", source_id=source_id, target_id=target_id, payload={"before": before, "after": actor["shield"]})
    return updated


def _resolve_due_hits(state: dict[str, Any]) -> None:
    due = [hit for hit in state["pending_hits"] if hit["due_tick"] <= state["tick"]]
    state["pending_hits"] = [hit for hit in state["pending_hits"] if hit["due_tick"] > state["tick"]]
    for hit in due:
        source = state["actors"].get(hit["source_id"])
        target = state["actors"].get(hit["target_id"])
        if source is None or target is None or not source["alive"] or not target["alive"]:
            _emit(state, "hit_fizzled", source_id=hit["source_id"], target_id=hit["target_id"], payload={"hit_id": hit["hit_id"]})
            state["resolved_hit_ids"].append(hit["hit_id"])
            continue

        roll = int(hashlib.sha256(f"{state['seed']}:{hit['sequence']}:{hit['hit_id']}".encode("utf-8")).hexdigest()[:8], 16) % 10000
        critical = roll < source["crit_chance_bp"]
        damage = calculate_damage(
            source["atk"],
            hit["coefficient_bp"],
            target["def"],
            critical=critical,
            crit_multiplier_bp=source["crit_multiplier_bp"],
        )
        shield_damage = min(target["shield"], damage["damage"])
        target["shield"] -= shield_damage
        hp_damage = damage["damage"] - shield_damage
        target["hp"] = max(0, target["hp"] - hp_damage)
        target["alive"] = target["hp"] > 0
        source["energy"] = min(source["energy_max"], source["energy"] + 8)
        if target.get("energy_gain_tick") != state["tick"]:
            target["energy"] = min(target["energy_max"], target["energy"] + 3)
            target["energy_gain_tick"] = state["tick"]
        _emit(
            state,
            "hit_resolved",
            source_id=hit["source_id"],
            target_id=hit["target_id"],
            payload={
                "hit_id": hit["hit_id"],
                "base_damage": damage["base_damage"],
                "damage": damage["damage"],
                "blocked_by_shield": shield_damage,
                "hp_damage": hp_damage,
                "element": hit["element"],
                "is_critical": critical,
            },
        )
        if shield_damage:
            _emit(state, "shield_changed", source_id=hit["target_id"], target_id=hit["target_id"], payload={"absorbed": shield_damage, "remaining": target["shield"]})
        state["resolved_hit_ids"].append(hit["hit_id"])
        if not target["alive"]:
            _emit(state, "actor_died", source_id=hit["source_id"], target_id=hit["target_id"], payload={})
            _finish_if_decided(state)


def _expire_statuses(state: dict[str, Any]) -> None:
    for actor_id, actor in state["actors"].items():
        remaining = []
        for status in actor["statuses"]:
            if status["status_id"] == "burn" and status["next_tick"] <= state["tick"] and actor["alive"]:
                burn_damage = max(1, status["magnitude_bp"] // 10000)
                actor["hp"] = max(0, actor["hp"] - burn_damage)
                actor["alive"] = actor["hp"] > 0
                status["next_tick"] += 30
                _emit(state, "hit_resolved", source_id=status["source_actor_id"], target_id=actor_id, payload={"damage": burn_damage, "element": "fire", "is_critical": False, "status_id": "burn"})
                if not actor["alive"]:
                    _emit(state, "actor_died", source_id=status["source_actor_id"], target_id=actor_id, payload={})
                    _finish_if_decided(state)
            if status["expires_tick"] > state["tick"]:
                remaining.append(status)
        actor["statuses"] = remaining


def _finish_if_decided(state: dict[str, Any]) -> None:
    teams = {actor["team"] for actor in state["actors"].values() if "team" in actor}
    if len(teams) < 2:
        return
    living_teams = {actor["team"] for actor in state["actors"].values() if actor["alive"] and "team" in actor}
    if len(living_teams) <= 1:
        state["phase"] = "battle_end"
        state["result"] = next(iter(living_teams), None)
        _emit(state, "battle_finished", payload={"winner_team": state["result"]})


def _validate_battle(state: Mapping[str, Any]) -> None:
    if not isinstance(state, Mapping) or not isinstance(state.get("actors"), Mapping):
        raise ValueError("state must contain an actors object")
    if state.get("phase") != "battle_running":
        raise ValueError("battle is not running")


def _validate_actor(state: Mapping[str, Any], actor_id: str, *, can_act: bool = False) -> None:
    if not isinstance(actor_id, str) or actor_id not in state["actors"]:
        raise ValueError("actor does not exist")
    actor = state["actors"][actor_id]
    if not actor["alive"]:
        raise ValueError("dead")
    if can_act and any(
        status["status_id"] == "stun" and status["expires_tick"] > state["tick"]
        for status in actor["statuses"]
    ):
        raise ValueError("stunned")


def _emit(
    state: dict[str, Any],
    event_type: str,
    *,
    source_id: str | None = None,
    target_id: str | None = None,
    payload: Mapping[str, Any],
) -> None:
    event = {
        "battle_id": state["battle_id"],
        "tick": state["tick"],
        "seq": state["event_seq"],
        "type": event_type,
        "source_id": source_id,
        "target_id": target_id,
        "payload": dict(payload),
        "rules_version": state["rules_version"],
    }
    state["events"].append(event)
    state["event_seq"] += 1