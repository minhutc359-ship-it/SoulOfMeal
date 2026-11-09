# TCG Setup and Draw Prototype — Engineering Reference

**Status: partial rules prototype, not a complete TCG runtime.** The TCG values remain **PROPOSED**. This reference documents the implemented setup, draw, card-action and spell-stack slice in `game_rules/tcg.py`.

## Run

From the package root:

```bash
python -m unittest tests.test_tcg -v
python -m unittest discover -s tests -v
python scripts/validate_package.py .
```

## Match creation

`validate_deck(deck, catalog, deck_size=36, copy_limit=2)` checks expanded deck size, known and unique catalog IDs, positive counts and the copy limit. `create_match(first_deck, second_deck, catalog, seed=...)` validates both decks, expands copies into instances, shuffles both libraries with a local seeded PRNG and deals four cards to each player.

Each player state contains commander HP, mana, deck, hand, burned cards, graveyard, exile, units, traps and a one-use mulligan flag. Match state records the seed, rules/catalog versions, shared round, active player, phase, stack placeholder, sequence and event log. The state is an internal authoritative object; integrations must not serialize both players' private zones to an opponent.

## Implemented operations

| Function | Behavior |
|---|---|
| `validate_deck(...)` | Rejects invalid deck composition before a match is created. |
| `create_match(..., seed, ...)` | Creates deterministic shuffled libraries and opening hands. |
| `mulligan(state, player_index, hand_indices)` | Once during mulligan phase, return chosen cards to the deck, shuffle with a player-specific seed derived from the match seed and draw the same count. Invalid indices do not mutate the source state. |
| `finish_mulligans(state)` | Closes the mulligan phase and begins the first player's first round. |
| `start_turn(state, player_index)` | Increases that player's max mana by one up to configured match cap, refills mana and performs the start draw except for player 0's first round. |
| `draw_cards(state, player_index, count, hand_limit=9, mandatory=True)` | Draws into hand; excess cards go to `burned`; an empty deck on mandatory draw ends the match by deck-out. Optional empty draws do not end the match. |
| `end_round(state, player_index)` | Advances to the other player in the same shared round, increments the round when player 0 begins, or adjudicates after the configured 40-round cap by commander HP. |
| `play_card(state, player_index, hand_index, target=None, unit_capacity=5, trap_capacity=2)` | Validates priority, mana and zone capacity; summons units, sets traps face down, queues fast damage spells (triggering armed matching traps) or resolves supported slow/burst damage spells. |
| `pass_priority(state, player_index)` | Two consecutive passes resolve only the top stack item; two passes with an empty stack close ACTION and enter `combat_declare`. |
| `declare_attacks(state, player_index, attackers)` | Active player declares up to five ready units on unique lanes once per player per round; matching armed traps open a reaction window, otherwise blockers are assigned immediately. An empty list skips attacking. |
| `assign_blockers(state, player_index, blockers)` | Defender assigns one unique unit to each declared lane; combat damage is applied simultaneously and unblocked ATK damages the commander. |

Shared `card_drawn` and `card_burned` events contain only a count, not card IDs. `trap_set` reveals only trap count; `trap_revealed` includes the card ID only after trigger. Player-private hand/deck/trap data remains in the internal state and still requires per-player filtering at any future network/UI boundary. Supported spell targets are the opposing commander or a current opposing unit instance; damage is resolved at the rules layer and unit destruction moves the card to its owner's graveyard.

## Determinism and limitations

- Given the same inputs and Python runtime, the same seed produces the same deck order, opening hands and mulligan results. Cross-runtime/version replay compatibility is not guaranteed yet.
- Mana cap, hand size, opening hand, commander HP, deck size and copy limit are function parameters/defaults; only the deck/catalog contents are read from JSON. The defaults are proposed rules, not approved balance.
- Only `deal_damage` spells and the trap `conditional_counter` effect are implemented. Proposed trap schema supports `when: spell_cast` with `condition.card_type: fast_spell`, or `when: attack_declared` with `condition.min_attackers`; matching traps set in an earlier round are revealed, consumed and added to the stack. Spell traps counter their referenced spell; attack traps cancel the pending attack. Both are resolved LIFO and consumed cards move to owners' graveyards. These fixture behaviors are not balance approval.
- Unit summoning and five-unit capacity are implemented, but attack declaration, lane assignment, blockers, simultaneous combat damage, status/effect grammar, surrender and the 40-round tiebreak are not.
- ACTION priority and one-at-a-time LIFO resolution are implemented for spells and configured traps. Attack-declaration traps open a REACTION window where the attacker may cast fast spells; two passes resolve one stack item at a time, then the empty window advances to blocker assignment. Broader trap target/condition grammar and full phase/turn timers are not implemented.
- Attack declaration, one-blocker-per-lane validation and simultaneous attack/blocker damage are implemented. The configured attack counter trap can cancel the pending attack before blockers are assigned.
- Basic turn advancement alternates players, refills/increases each player's mana, applies the first-player first-draw skip once, and adjudicates the configured shared-round limit using commander HP. There are no timers, automatic bot decisions or full turn scheduler/UI.
- Stack, field and graveyard zones are state placeholders for later rules work. No UI, animation, networking, persistence or replay hash is included.

The focused tests cover deck validation, seeded setup, opening hand size, one-time deterministic mulligan, first-player draw skip, mana ramp/refill, hand-cap burn, optional draw, mandatory deck-out, unit summons and capacity, face-down trap privacy, set-round protection, fast-spell and attack-declared trap reveal/consumption/counters, fast-spell responses during attack reactions, slow/fast spell damage, LIFO resolution, target validation, unit destruction and commander victory, attack/block exchanges, voluntary no-attack, turn alternation, per-player attack tokens and round-limit adjudication. They do not constitute full TCG acceptance or a complete playable match.