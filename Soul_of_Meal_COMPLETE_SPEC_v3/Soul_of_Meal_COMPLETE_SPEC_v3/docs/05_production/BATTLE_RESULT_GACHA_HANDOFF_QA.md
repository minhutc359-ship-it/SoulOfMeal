# Battle result timing and ten-card handoff

Date: 2026-11-16. Follow-up to the spirit-art and summon-intro correction.

## Behavior

- TCG keeps the final battlefield and inert hand layout while projectiles, contact effects, damage/death feedback, card flights, traps, recipes and cut-ins finish. The result opens from the render loop only after those presentations settle, scoped to the current match. No delayed result timer can leak into another match.
- Adventure stops simulation at its normal deterministic result tick while advancing animation, VFX and rig recovery/death presentation. The winning pose no longer forcibly replaces the final attack in the same tick. Held death poses settle once instead of restarting indefinitely. Presentation time never changes battle ticks, HP or awards.
- Auto Chess gates both round and final-lobby results behind replay completion. Replay completion consumes all events, impacts, falls and non-looping action clips; the old 420 ms cutoff could truncate 580/620 ms effects. A late frame cannot consume a newly started final clip immediately.
- All three modes show original victory/defeat artwork. Clicking/tapping the image or activating its button with the keyboard invokes the existing continue action once: claim/retry Adventure, set up a TCG match, or advance/restart Chess. Neutral-round item selection remains explicit, then advances through the existing reward/round functions.
- Ten-pull cinematic: converge, orbit, arrange ten matching backs in a five-by-two grid, hold briefly, then open the pack reader at 7.4 seconds. It never flips cards, draws a character face or spotlights an SSR. Manual opening and subsequent one-at-a-time reveals retain their existing receipt order and awards. Single-pull intros remain rarity-specific.

## Art

`client/assets/original/ui/battle-victory.webp` and `battle-defeat.webp` are original generated culinary-fantasy illustrations, encoded at 1200 × 800. Source prompts and source/runtime SHA-256 values are in `docs/02_art/ORIGINAL_ART_SOURCES.json`. No external game artwork is used. Final human art/commercial review remains pending.

## Verification

- Regression tests cover late TCG contact, outstanding impact/card/cut-in tails, match scoping, final Adventure attack priority, held defeat completion, rig recovery after a frozen simulation tick, Chess impacts longer than the old tail, longer character clips, single-use image continuation, packaged image files, ten-card grid geometry, no multi-pull face loads and no SSR spotlight.
- Chromium: the TCG defeat illustration loaded, tapping it opened the new-match setup directly, canceling restored the result, and starting a new match worked. A fresh ten-pull entered the cinematic with card backs, handed off to the unopened pack, and revealed cards 1 and 2 only through the separate manual reader. No game-source warning/error was observed; browser extension metadata warnings were unrelated.
- Full JavaScript/Python tests, TypeScript, production build and package validation are required for this change. Real-device Safari iOS/Android acceptance and full end-to-end Adventure/Chess matches remain manual QA items; their presentation regressions are covered by automated tests.

## Acceptance on devices

1. End TCG with a spell, attack and revealed trap; watch contact, damage and death feedback before the result image.
2. End Adventure with a projectile/ultimate and with party defeat; watch the final rig pose and VFX before tapping to claim/retry.
3. Finish a Chess neutral round and a final lobby round at normal and 2× speed; no result covers the final action. Check explicit item selection and progression.
4. Draw ten cards: the cinematic ends with ten evenly spaced backs; no face appears before the separate reveal step. Repeat with reduced motion and skip.
