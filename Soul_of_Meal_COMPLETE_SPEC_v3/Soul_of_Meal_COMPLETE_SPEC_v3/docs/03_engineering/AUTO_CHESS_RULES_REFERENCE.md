# Auto Chess Rules Prototype — Engineering Reference

**Status: prototype reference, not a complete game runtime.** The rules in `docs/01_gameplay/AUTO_CHESS_RULEBOOK.md` and the economy values in the data files remain **PROPOSED**. This document describes the behavior implemented in `game_rules/auto_chess.py`; it does not approve balance or extend the rulebook.

## Source files

- `game_rules/auto_chess.py`: engine-independent Python functions for odds validation, seeded shop rolls, payout calculations, shop actions, board placement and merging.
- `examples/auto_chess/shop_odds.json`: proposed tier odds and economy values.
- `examples/auto_chess/units.json`: example unit catalog used by shop rolls.
- `tests/test_auto_chess.py`: executable examples for the implemented slice.

Run from the package root:

```bash
python -m unittest discover -s tests -v
python scripts/validate_package.py .
```

## Data contracts

`shop_odds.json` contains `cost_tiers`, `probabilities_percent` keyed by player level, and `economy`. Each probability row must have one nonnegative integer per tier and sum to 100. Every tier with nonzero probability must have at least one matching unit in the catalog.

The current preparation state expected by shop actions is:

```json
{
  "gold": 10,
  "bench": [],
  "board": [],
  "shop_locked": false,
  "shop_offers": [
    {"id": "chr_bunbo_holinh", "cost": 1},
    null
  ]
}
```

An offer slot set to `null` is empty after purchase. The example is illustrative; real offers carry the full unit catalog record. Commands take a mapping and return a copied state. A rejected command raises `ValueError` and does not mutate the input state.

## Implemented functions

| Function | Behavior |
|---|---|
| `validate_shop_odds(shop_odds)` | Validates tier and probability row structure. |
| `calculate_interest(gold_before_payout, economy)` | Returns `min(floor(gold / interval), cap)`. |
| `calculate_payout(gold_before_payout, won, streak_length, economy)` | Returns a component breakdown and resulting gold; interest uses the pre-payout balance. |
| `roll_shop(level, units, shop_odds, seed, offer_count=5)` | Independently samples offers using configured tier odds and a local seeded PRNG. |
| `buy_shop_offer(state, slot, bench_capacity=9)` | Checks slot, affordability and capacity; deducts the offer's `cost`, appends it to the bench and empties that offer slot. |
| `refresh_shop(state, level, units, shop_odds, seed, refresh_cost=2, offer_count=5)` | Replaces offers and deducts the refresh cost. A locked shop or insufficient gold is rejected. |
| `set_shop_locked(state, locked)` | Returns a copied state with the lock flag set. |
| `place_bench_unit(state, bench_index, x, y, level, board_width=7, board_height=4)` | Moves a bench unit to an empty in-bounds board cell, enforcing `len(board) < level`; assigns stable `placement_order`. |
| `move_board_unit(state, board_index, x, y, board_width=7, board_height=4)` | Moves a deployed unit to an empty cell or swaps it with the unit there. |
| `return_board_unit(state, board_index, bench_capacity=9)` | Returns a deployed unit to the bench when capacity permits; board coordinates are removed. |
| `merge_units(state)` | Repeatedly merges triples with matching unit ID and star; board copies are preferred and the lowest `placement_order` survives. |

Defaults for offer count, bench capacity and refresh cost match the proposed rulebook values. They are function parameters today, not yet centralized in the JSON config. Economy values are read from the proposed `economy` object.

## Determinism and limitations

- Shop rolls use a local `random.Random(seed)` and do not mutate Python's module-global random stream. The same seed, inputs, catalog and Python runtime produce the same offers; this is not yet a versioned cross-runtime replay guarantee.
- Shop offers are sampled independently with replacement. There is no shared finite unit pool.
- `shop_locked` currently blocks refresh only. Carrying offers into the next round and clearing or retaining the lock across rounds are not implemented.
- The functions do not enforce a match phase, turn timer, player identity or command sequence. The caller must only expose shop and board actions during preparation.
- Board commands enforce the configured 7×4 coordinate bounds and player-level unit cap but do not validate preparation phase or team-side orientation. The caller must gate commands to preparation.
- Buying places units on the bench. Board placement, movement/swapping, return-to-bench and three-of-a-kind merging are implemented.
- Merge raises the surviving record's `star` from 1→2→3 but does not scale HP/ATK because unit-specific multipliers are not present in approved content. A board survivor retains its coordinates and `placement_order`; bench-only merges keep the first matching bench record. No merge animation/event is emitted because there is no event bridge.
- Sell/refund, XP/leveling, player damage, synergies, combat simulation, bots, events, replay hashes and save migrations are not implemented.
- Shop and economy defaults remain proposed. Do not use this module as a production balance contract or multiplayer authority.

## Test coverage

The current suite checks interest and payout examples, valid odds, the level-4 tier ceiling, same-seed shop rolls, malformed odds, purchase and refresh costs, bench capacity, locked-shop rejection, board bounds and unit cap, move/swap behavior, return-to-bench behavior, matching-triple merges, board-first destination, stable placement order and the three-star cap. It does not yet verify a full match, cross-version replay, finite-pool fairness, round-to-round lock behavior, star stat scaling or merge-event integration.

Adding a rule that changes player-visible outcomes requires updating the gameplay rulebook, this reference, config/schema as applicable, and a focused regression test. Mark the rule **APPROVED** only through the decision process in `docs/00_foundation/DECISION_REGISTER.md`.