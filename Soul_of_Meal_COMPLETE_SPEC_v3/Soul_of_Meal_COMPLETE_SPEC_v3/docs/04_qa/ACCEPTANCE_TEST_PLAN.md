# QA & Production Acceptance Plan v3

## A. Asset QA (Golden Sample)
- CH-01 4-direction turnaround matches silhouette, facial features, costume and hand weapon.
- CH-02 8+ expressions keep same eye scale/hair accessories.
- CH-03 `idle`, `walk`, `run`, `attack_a`, `attack_b`, `skill_01`, `ultimate_01`, `hit`, `victory` have expected frames/timing and correct clip loops.
- CH-04 Individual sprites have RGBA alpha and 8px min safe padding; no label/text baked into image.
- CH-05 No clip has cut limbs or edge touching; consistent ground anchor; mirroring weapon tested.
- CH-06 Atlas manifest names and frame positions validated; replay preview inspected at 1x and 0.5x.
- CH-07 Any AI output is manually checked for frame continuity, copyright risk, and identity consistency before `approved`.

## B. Environment QA
- EN-01 NPC offers quest; `accepted` and `ready_to_claim` are persisted.
- EN-02 Chest cannot grant reward twice (double click/reload).
- EN-03 House door has collider / interaction radius / portal and returns player to valid spawn.
- EN-04 Camera and navigation work on all edges; no blocked spawn.
- EN-05 Chunks stream in without visible empty/freeze on target devices; landscape/portrait composition acceptable.

## C. Combat QA
- AD-01 320 ATK × 1.5 coefficient vs 100 DEF => 240 hit pre-crit.
- AD-02 projectile never hits twice; hit independent from render FPS.
- AD-03 boss telegraph visible; phase thresholds exactly once; shield consumes damage before HP.
- TC-01 exactly 36 card deck, 5 units, 2 traps, max 9 hand.
- TC-02 LIFO response; face-down trap hidden until reveal, cannot fire set round.
- TC-03 attacker 1200/1000 vs blocker 700/1500 leaves both with 300 DEF.
- TC-04 unblocked ATK 1200 reduces 8000 commander HP to 6800.
- AC-01 shop odds rows 100%; level4 cannot return tier5.
- AC-02 3×1-star merge to 2-star, no duplicate phantom units.
- AC-03 interest gold30=+3 and gold50=+5 (without other bonuses).
- AC-04 deterministic replay same seed+commands+catalog yields same hash.

## D. UI/A11y/Audio QA
- UI-01 Portrait home 390×844 logical, landscape game 960×540 logical; OS safe area and 44dp touch.
- UI-02 No document scroll required during TCG/Auto Chess gameplay; visible priority/action states.
- UI-03 Loading/empty/error/offline state of all 16 screens.
- AU-01 SFX matched to fire/water/wood/light/shadow, no clipping or >2 competing voice calls by default.
- AU-02 Muting Music/SFX/Voice/Ambience independent and preserved across reload.
- AU-03 Missing audio does not stall action or break battle rules.

## E. Regression gate
`Content lint PASS` AND `Sprite schema PASS` AND `Art review APPROVED` AND `Deterministic test PASS` AND `Mobile UX PASS` AND `License review APPROVED` AND `No blocker telemetry` before setting a build to Release Candidate. P0 may ship prototype internally with approved test-only placeholders clearly labelled.

## F. Current executable coverage
`python -m unittest discover -s tests -v` currently exercises engine-independent Auto Chess, TCG and Adventure rules slices:
- AC-01: configured shop rows sum to 100; level 4 offers no tier above cost 3.
- AC-03: interest examples at 30/50 gold, cap, and pre-payout balance; a payout breakdown.
- AC-05: board placement stays within 7×4 and level cap; occupied-cell move swaps units; returning a unit respects bench capacity.
- AC-02: 3 matching units merge one star; implementation tests also verify board-first destination, stable placement order and no promotion past 3 stars.
- Shop preparation: seeded roll repeatability, purchase cost/bench insertion, insufficient-gold and full-bench rejection, refresh cost, locked-shop rejection, and invalid probability rejection.
- TCG setup/actions/combat: deck validation/copy limit, seeded hands and mulligan, first-player draw skip, mana ramp, hand burn/deck-out, unit summon/cap, hidden trap-set event, set-round protection, fast-spell and attack-declared trap reveal/counter, fast-spell response during attack reaction, targeted spell damage, LIFO resolution, unit death, commander victory, exact 1200 unblocked damage and 1200/1000 vs 700/1500 simultaneous blocker exchange, turn alternation, per-player attack token and 40-round HP adjudication. Draw/burn/trap-set events do not expose hidden card IDs.
- Adventure combat: 320 ATK × 1.5 vs 100 DEF = 240; fixed-tick ultimate impact; shield-first damage/40% cap; seeded crit, status idempotency/burn ticks, stun/cooldown/energy validation and battle-end event.

These tests do not establish full replay determinism, round rollover, star stat scaling, reaction triggers beyond configured examples, remaining card effects, Adventure movement/target selection/boss/wave/reward flow, UI behavior, mobile performance or release readiness. Those remain unimplemented or require manual/device validation as applicable. Exact test names and behavior are listed in the mode-specific references in `docs/03_engineering/`.

The local browser client has two Node test suites: `client/tests/runtime.test.js` (16 tests) covers save migration, the Adventure P0 quest/reward loop, movement/fixed-step collision/A* route planning, TCG setup/priority/summon/trap counter/lethal event order, and Auto Chess purchase/placement/combat/loss damage/cross-zone merge/round-cap completion; `client/tests/animation.test.js` (12 tests) covers manifest validation, clip timing/priority, missing-asset and reduced-motion behavior, event normalization, cue mapping, deduplication and actor retention. Browser smoke checks were performed on desktop for navigation, Adventure placeholder animation/fallback, TCG turn progression and Auto Chess, plus mobile 390×844 layout for Home and TCG. Tile-authored collision, navmesh/chunk streaming, production sprites/atlas loading, full P0 acceptance, actual-device/mobile UX, PWA/offline, performance and release checks remain pending.
