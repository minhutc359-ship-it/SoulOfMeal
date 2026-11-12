# Tactical Card Game — Rules Baseline v3
**Status: PROPOSED** · deterministic, seeded bot PvE P0 · standalone stats. The screenshot values, art text and special effect previews do **not** define legal game rules.

## Browser playtest, rules version 2

The 0.5-proposed catalog contains 46 cards, including nine traps and five character-bound ultimates. All four themed presets have 36 cards. The rules use the established five unit lanes and two trap slots. Spell order, attack resolution and save recovery are deterministic. Open a new match to use version 2. Existing saved matches use the earlier automatic triggers and spell timings.

- A face-down trap becomes armed on the next active-player turn. After an attack's blockers are confirmed, a summon is placed, a fast or slow spell is queued, or a unit falls, the matching owner may activate one eligible trap for that trigger or keep the traps. A chosen trap enters the visible response stack. The attack then continues on the surviving, unblocked lanes. Scout reveals a trap without consuming it. Disarm removes it while preserving the privacy of its identity if it is still face down.
- Slow spells can only join an empty stack during deployment. Fast spells can join an open reaction. Both wait for resolution. Burst effects resolve immediately and retain priority. An ultimate needs its original caster on the board through resolution.
- Once per turn, a second consecutive public card of the same element costs one mana less, with a minimum cost of zero. Setting a trap pays its base cost and clears the owner's chain. The active-player transition clears both chains.
- A rooted unit cannot attack or block until its owner's turn ends. Pierce applies excess attack after the blocker's shield and DEF to the commander. Lifesteal heals the commander for 35% of actual DEF or HP damage from its combat hits, rounded down.
- Manual trap choice, reaction stack and deck selection are saved. The on-screen stack and emitted trap events expose the trap's identity at reveal only. The bot's attack and block forecasts use the board and public stats.

Interaction and mechanic references from MealGacha's prior TCG are [Trap Decision](https://github.com/minhutc359-ship-it/MealGacha/blob/f73b44a3901ee7fa58ad42cbe212004d234c9b18/src/components/game/TrapZone.tsx), [card and trap rules](https://github.com/minhutc359-ship-it/MealGacha/blob/f73b44a3901ee7fa58ad42cbe212004d234c9b18/dev/docs/TCG_RULES.md), and [Deck Builder](https://github.com/minhutc359-ship-it/MealGacha/blob/f73b44a3901ee7fa58ad42cbe212004d234c9b18/src/components/game/DeckBuilder.tsx). Visual and audio assets for this browser playtest use the local Soul of Meal v3 source inventory.

## 1. Match setup and card zones
Two commanders at **8000 HP**, 36-card deck each, max two copies per non-token card. Zones: deck, hand, graveyard, exile, 5 friendly unit slots, 2 friendly face-down trap slots, stack, and commander. Hand cap 9; excess draws burn and are logged. Initial hand 4; optional one mulligan (choose cards to replace, once), first player skips first draw. Card types: `unit`, `slow_spell`, `fast_spell`, `burst_spell`, `trap`, `ultimate` (a subtype/keyword, not a free extra slot). Units have `atk`, `max_def` (durability), `current_def`, keywords and effects. No generic damage reduction based on DEF: DEF is unit hit points in this mode.

## 2. Timeline and priority
A **round** consists of `ROUND_START -> DRAW -> ACTION -> COMBAT_DECLARE -> BLOCK_ASSIGN -> REACTION -> COMBAT_RESOLVE -> ROUND_END`. Both players may take priority actions in ACTION until both pass. Active player with attack token may DECLARE attack once per round. If defender has no legal action, pass is automatic. Any valid fast action or trap trigger opens a response window with a LIFO stack. When both players pass consecutively, resolve **top stack item only**, then offer priority again; continue until stack empty. Burst effects resolve immediately at a legal priority window and do not enter stack, but cannot execute while other pending action's resolution is in progress.

### Priority example
Attacker declares A (3 damage) -> defender flips `trap_guard` -> attacker casts `spell_ignite` -> both pass -> `spell_ignite` resolves -> both pass -> `trap_guard` resolves -> blocking/damage resolution. Every action creates a numbered log entry and tooltip explaining source and results.

## 3. Mana and card cost
At ROUND_START increase max mana by one, cap 10; refill current mana to max. Spending mana checks affordability at the time of declaration. For P0 prototype, unused mana does **not** carry across rounds; no spell-mana reservoir. Cost is a nonnegative integer. If an action is invalid, do not spend mana or consume card. Summoned units cannot attack in the same round unless `quick_attack_ready`/`haste` keyword (name to be approved); defending is allowed immediately.

## 4. Attack, blockers and damage
Up to five attackers are assigned to attack lanes. Defender may assign one blocker per attacking lane if unit available and not stunned. By default unblocked attacker deals full ATK to enemy commander; blocked attackers deal ATK damage to blocking unit while blocker deals ATK simultaneously to attacker. Both damages are applied in one resolution window; units with current_def ≤0 die and go graveyard. Damage **persists** while unit stays on board unless healed; it is not reset after round. Blocking is positional by lane; no unsolicited strike through a live blocker. Overflow is not allowed without a `pierce` keyword.

The browser playtest lets the defender assign a unit to an attack lane for that exchange. Its board position stays the same. An available defender can block while resting. A blocker removed by a response opens its attack lane before combat resolves. The bot assigns its available blockers to the highest-ATK attacks first, preferring a blocker in the same lane when possible.

Example: 1200-ATK/1000-DEF unit attacks 700-ATK/1500-DEF blocker. Both exchange damage: attacker goes to 300 DEF, blocker goes to 300 DEF. No commander damage. If attacker is unblocked, commander HP 8000→6800. This resolves the scale question explicitly for this mode.

## 5. Traps
Trap is placed face-down in one of two slots and may not be activated on the placement round unless it has an explicit exception keyword. Its trigger has `when`, `condition`, `targets`, `priority`, `effect`. When a matching event occurs, the engine reveals the trap, enqueues a reaction, marks trap consumed, then opens response priority. Neither client may see trap identity before reveal (including log/telemetry sent to the opponent). Cancelled traps still move to graveyard unless a card says otherwise.

## 6. Statuses, effects and order
Effects use grammar `deal_damage(target,n)`, `heal(target,n)`, `apply_status(target,id,duration)`, `summon(token,slot)`, `draw(n)`, `destroy(target)`, `modify_stat(target,delta,duration)`, `counter(stack_id)` and `trigger_combo(key)`. Selection and legality occur at cast time; revalidate target at resolution. If target vanished, fizzle *only the dependent part*, unless text explicitly retargets. Event ordering is tick-independent: `(round,action_seq,stack_position)`. Infinite trigger loops capped at 64 effect resolves per chain with draw/abort adjudication and replay log.

## 7. Win and tie
Enemy commander HP ≤0 => win; both ≤0 simultaneously => draw. A player unable to draw a mandatory card loses by deck-out. Voluntary surrender immediate. Bot-only P0 ignores disconnect; future PvP has reconnect/timeout rules in separate ADR. Hard cap 40 rounds P0: higher commander HP wins, tie draws (prototype baseline).

## 8. Deck building and card validation
Deck has exactly 36 cards; all IDs exist in `cards.catalog.json`; normal cards ≤2 copies; no client-side edits mid match; deck snapshot + rules_version + card_catalog_version stored with replay. Element-specific decks: Fire Aggro, Water Control and Wood Growth; cards have independent TCG stats, not Adventure HP. Conditional synergy should require paying costs and making legal casts, not automatically trigger because the portraits share colors.

## 9. UI requirements
Always display commander HP, mana, active player, priority holder, current phase, attack token, trap count (not hidden identity), visible unit buffs/debuffs, accessible action log and `Pass`/`End Round` labels. On mobile landscape, no webpage scrolling during board combat. Attack declarations and targets highlight; pending stack items are visible in a readable compact strip.

## 10. Test fixtures
- initial draw, mulligan and first-player draw skip.
- 5-unit / 2-trap capacity and 9-card hand cap.
- cannot fire unarmed trap on set round, trigger reveals and consumes once.
- sample 1200/1000 vs 700/1500 simultaneous exchange results 300/300.
- 1200 unblocked reduces commander from 8000 to 6800.
- LIFO stack and double-pass priority deterministic; same seed and command list produce identical replay hash.
