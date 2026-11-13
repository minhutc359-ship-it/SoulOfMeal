# Auto Chess — Rules Baseline v3
**Status: PROPOSED**, P0 bot/local simulated; not confirmed economy balance. Chess unit stats differ from Adventure/TCG.

## 1. Match and board
8 competitors (bots permitted), each starts 100 commander HP. Board is 7 columns ×8 rows overall; each player controls their half of 7×4 before battle. Bench capacity 9. Shop has 5 offers, refresh costs 2 gold; locking keeps offers across next round; buying costs tier (1–5) in gold. Unit cap on own board equals player level (levels 2–9 in prototype). Controlled placement only during preparation; combat is autonomous. Use visual labels for bench/full board/cannot afford/locked shop.

The browser practice lobby uses a hex grid with one player and seven bots. It opens with two neutral rounds, then stages of four rival rounds and one neutral round. Neutral wins grant a component. Two components on a unit combine into a recipe, and each unit can hold up to three items. The lobby ends when the player is eliminated, all rivals are eliminated, or round 37 resolves. Existing browser runs keep their original format.

The formation UI shows tiles. The battle replay draws the arena art and actors over those same coordinates with the grid hidden.

## 2. Phase machine
`ROUND_SETUP -> SHOP_PREPARE (30s) -> LOCK_IN (1s) -> BATTLE (timeout 45s) -> RESOLVE -> PAYOUT -> NEXT_ROUND`. Low-motion setting shortens only render, not simulation. Temporary skills/status reset between rounds; persistent commander HP/gold/level, shop lock and standing board survive. Replay references RNG seed + roster + placements + purchases + versioned rules.

## 3. Economy
Start level 2 / 10 gold. Stage 1 can have neutral creep rounds. Prototype income: base +5 after battle, +1 for victory, interest +floor(gold_before_payout/10) capped +5. Streak bonus 0/1/2/3 for streak length <2 / 2-3 / 4-5 / >=6. Loss streak can be remunerated for comeback using same thresholds (separately configurable). Player damage if losing = `2 + floor(current_stage/2) + surviving_enemy_star_sum` capped at 25 per round; tune after test. Selling unit refunds its tier cost for 1-star units, higher stars use `sell_value` content table; never assume original total refund automatically.

## 4. Shop probabilities (illustrative, not final)
| Player level | Cost 1 | Cost 2 | Cost 3 | Cost 4 | Cost 5 |
|---|---:|---:|---:|---:|---:|
| 2 | 100% | 0% | 0% | 0% | 0% |
| 3 | 75% | 25% | 0% | 0% | 0% |
| 4 | 55% | 30% | 15% | 0% | 0% |
| 5 | 40% | 35% | 22% | 3% | 0% |
| 6 | 25% | 35% | 30% | 9% | 1% |
| 7 | 18% | 30% | 32% | 17% | 3% |
| 8 | 12% | 22% | 30% | 28% | 8% |
| 9 | 8% | 17% | 25% | 35% | 15% |

Each row sums to 100. The browser practice lobby uses the finite shared pool in `examples/auto_chess/shop_odds.json`. A shop reserves its offers until they are bought or rerolled. A merged unit retains the stock cost of its component copies. Sales and eliminations return copies to the pool. Buying XP does not reroll current offers.

## 5. Merge and placement
Three copies of **same character ID and same star** combine into one unit +1 star; 1→2→3 stars maximum. Merge priority: board copies before bench if any, destination at the first occupied original cell with stable `placement_order`; overflow moves to bench, then refund/compensation policy must be explicit. Merge only between rounds. Merge increases HP/ATK according to unit-specific star multiplier content, not a hardcoded global double.

The browser supports mouse and touch dragging between exact bench slots and board cells. Dropping on an occupied valid destination swaps the two units, including at the board and bench caps. The shop previews an available upgrade; the surviving unit shows its stars and a short merge cue. Tap to select and then tap a destination for keyboard-compatible formation changes. Formation interaction was adapted from [MealGacha f9d3925](https://github.com/minhutc359-ship-it/MealGacha/commit/f9d39257d17b4dd378a2fbd2a9f936724754fc16).

## 6. Element/role synergies
Elements: fire, water, wood, light, shadow. Jobs: fighter, guardian, mage, ranged, support, assassin. A unique deployed character counts once; 2-star duplicate does not count three times. Example PROPOSED thresholds `fire(2/4/6)` burn bonus, `water(2/4/6)` mana regen and slow, `wood(2/4/6)` sustain, `guardian(2/4)` bonus frontline shield, `chef(2/4/6)` team-wide buff. Synergy application happens at phase lock; changes during battle from summon effects require `dynamic_synergy` flag.

## 7. Combat simulation and targeting
Fixed 30Hz tick and stable event ordering. At lock-in, snapshot board placements; spawn mirrored teams. Each actor finds target by `taunt -> shortest reachable range -> lowest HP% -> stable actor ID`, pathfinds until range, attacks with interval timer, gains energy and casts when ready. Valid critical hits, shields and statuses are resolved in sim; FX socket/impact cannot cause additional damage. Units cannot deal damage from beyond effective range. On timeout, army with higher total remaining HP proportion wins (tie triggers draw).

## 8. Opponent pairing and bots
Bot decisions are generated from deterministic seed. `normal`: buy for immediate strength, low reroll. `hard`: interest-aware leveling, synergy search, fixes board gaps. `extreme`: compares candidate placement against observed rivals and adapts shop expenditure (same shop probabilities and available gold). Difficulty affects reasoning only, not hidden stats.

## 9. Player feedback/UX
Right-hand synergy status `active / close / unavailable`; shop card shows name, tier and cost; drag feedback distinguishes `valid cell`, `occupied swap`, `board cap`, `bench full`; show merge badge, player gold and interest preview. During battle, gray out shop and show attack trails, impact, projectiles, AOE radii, HP bars, damage numbers and results. All UI fits a landscape viewport without scrolling the document.

## 10. QA examples
- Gold 30 before payout grants +3 interest (if cap not reached); gold 50 grants +5.
- Level 4 shop probabilities sum to 100, never emits cost-5.
- 3×1-star of same ID merge into one 2-star, no second copy remains.
- On fixed input seed, same round result, shop and event hash repeat identically.
- Bot extreme has no unfair bonus to odds/stats.
- At lower visual FPS, target behavior, hit counts and final HP are unchanged.
