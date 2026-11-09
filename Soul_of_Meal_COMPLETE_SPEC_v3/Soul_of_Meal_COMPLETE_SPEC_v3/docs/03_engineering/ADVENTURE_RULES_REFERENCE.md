# Adventure Combat Prototype — Engineering Reference

**Status: partial, animation-independent combat rules prototype.** Adventure balance and content values remain **PROPOSED**. This reference describes the currently implemented deterministic damage, scheduled-hit, status, shield and ultimate slice; it is not an exploration runtime or complete Adventure mode.

## Run

From the package root:

```bash
python -m unittest tests.test_adventure -v
python -m unittest discover -s tests -v
python scripts/validate_package.py .
```

## State and operations

`create_battle(actors, seed, battle_id=...)` builds an actor-indexed state. Actors require a unique `actor_id`, positive `max_hp`, nonnegative `atk` and optional `def`, energy, shield, crit fields, cooldowns, statuses and team. Initial events are `battle_started` and ordered `actor_spawned` records.

| Function | Behavior |
|---|---|
| `calculate_damage(atk, coefficient_bp, defense, ...)` | Integer `base = max(1, floor(atk * coefficient / 10000))`, mitigation by `100 / (100 + DEF)`, optional critical multiplier. |
| `schedule_hit(state, source_id, target_id, coefficient_bp, delay_ticks, hit_id)` | Schedules a single authoritative hit; zero-delay hits resolve immediately. Duplicate hit IDs are rejected. |
| `activate_ultimate(state, actor_id, target_id, ability)` | Checks actor alive/not stunned, target, energy and cooldown; spends energy and schedules the content ability at `hit_tick_offset`. |
| `advance_ticks(state, ticks=1)` | Advances fixed simulation ticks, expires statuses and resolves pending impacts by due tick and sequence. |
| `apply_status(...)` | Supports `burn`, `slow`, `bind`, `stun` and `taunt`; repeated `application_id` is idempotent and burn is capped at three stacks. |
| `grant_shield(...)` | Adds shield capped at 40% of target max HP and is idempotent by application ID. |

All combat events include `battle_id`, `tick`, monotonic `seq`, type, source/target, payload and `rules_version`. The renderer may display `projectile_spawned` and `hit_resolved`, but it must never apply a second hit.

## Verified behavior

- `examples/adventure/bunbo_ability.json` fixture: ATK 320, coefficient 15000, DEF 100 resolves exactly 240 damage.
- Ultimate consumes 100 energy, schedules its hit at configured tick offset, and starts the proposed 90-tick cooldown.
- Damage is applied to shield first, then HP; HP and shield never go below zero.
- Crits are derived from SHA-256 of battle seed, hit sequence and hit ID, giving a stable roll for identical inputs. This is a deterministic prototype technique, not an approved cross-version replay contract.
- Basic hit energy gain is +8 to attacker and +3 to target at most once per target per tick.
- Supported battle state enters `battle_end` when all actors from one of at least two teams are dead.

## Explicit limitations

- The burn prototype interprets `magnitude_bp` as a fraction of 1 damage unit per 10000 and applies it every 30 ticks; finalize the intended status damage unit/rate in approved content before using it as balance.
- Movement, navigation/pathfinding, target selection, attack intervals/auto-attacks, party setup, encounters, boss phases, hazards, healing, cleanse, full status stacking/counters, wave flow, rewards, quest/world interaction and save persistence are not implemented.
- This module is not integrated into a client, animation system, replay serializer or game-wide command dispatcher. The current slice is suitable for rules tests, not a playable release.