# QA & Production Acceptance Plan v3.2

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
- UI-01 Desktop game at the 1920×1080 reference viewport, scaled landscape game at 960×540, and portrait Login/Home at 390×844. Verify insets, input mapping and 44 CSS px touch targets.
- UI-02 No document scroll required during TCG/Auto Chess gameplay; visible priority/action states.
- UI-03 Verify loading, empty, error and offline states wherever applicable in each in-scope scene or overlay.
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

The Python suite covers engine-independent fixtures. The browser playtest also has Node suites under `client/tests/` covering local save migration, Adventure movement and reward flow, TCG turn and reaction order, Auto Chess preparation and result flow, and animation, atlas rendering and original asset checks. The current Canvas/DOM smoke exercises chapters 1–6 on a fresh PostgreSQL-backed account, confirms the unclaimed final-boss result and epilogue can be saved, and opens TCG and Auto Chess after completing Adventure. Runtime regressions cover the forest corner route, final quest gating, and resuming a saved boss charge without rerunning its elapsed ticks. See the [playtest audit](PLAYTEST_CONCEPT_GAP.md) for the implementation and remaining art scope.

## G. Web Client–Server acceptance

The account playtest smoke checks registration, login, session revocation, CSRF, account isolation, cross-session persistence, idempotent retries, and concurrent save revisions against PostgreSQL. The full inventory, authoritative rewards, reconnect and device benchmarks below remain production acceptance goals.

These are target checks for [SPEC v3.2](../03_engineering/ENGINE_ARCHITECTURE.md). The local playtest provides gameplay fixtures for these checks.

- WEB-01 Sign in through Login and Loading, open each of the three modes and return to Home in the same viewport and session. Main gameplay actions are accessible without document scroll.
- WEB-02 Verify the layouts in UI-01, keyboard focus, reduced-motion handling, audio unlock, and useful retries for account or required bundle failures.
- WEB-03 Sign in on another browser and verify inventory and progression. Concurrent or repeated claim requests for the same reward grant it once. Expired sessions reject commands and return to a recoverable login flow.
- WEB-04 Interrupt a battle connection, resume from a snapshot or event cursor and show each confirmed hit once. Inspect TCG transport for opponent hand or face-down trap data before reveal.
- WEB-05 Publish a new asset build during a match. The match retains its pinned assets and rules. Verify the next entry loads the new build, a missing required bundle permits retry, and rollback restores a complete prior build.
- WEB-06 Record the machine, browser, viewport, frame-time distribution, load times and texture memory for the Golden Sample benchmark. Check the 60 FPS desktop target with five Vị Linh, boss, HUD and effects active, and verify recovery from WebGL context loss. Document actual-device results for the supported matrix.
