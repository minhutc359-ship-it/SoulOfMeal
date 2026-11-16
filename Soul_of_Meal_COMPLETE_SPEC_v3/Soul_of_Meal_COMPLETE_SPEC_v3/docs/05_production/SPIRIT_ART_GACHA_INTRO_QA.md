# Spirit artwork and gacha intro correction

Date: 2026-11-16. Baseline: main `1c41b5b50826b03ef1b398d593e6511db0e3e9ea`.

## Findings

- Production is reachable at `https://soul-of-meal.vercel.app/client/`. The README's former `soul-of-meal-roan.vercel.app` address returned 404.
- All 24 character preview and HD URLs responded with image/webp (48/48). All 24 downloaded previews matched the SHA-256 values in the source packs. A local contact sheet compared each actor and its assigned splash: the identities correspond. This does not replace final human art approval.
- Roster thumbnails and several Chess portraits still selected actor/chibi paths instead of the common splash illustration. The profile loaded HD directly, leaving a blank area while a larger image downloaded. Fallbacks were attached separately after rendering and were inconsistent across screens.
- Fresh ten-pulls explicitly skipped the cinematic. Additionally the old 2.5-second asset-loading timer could jump directly to results on a slower network.
- main's CI failed the package validator because the size/hash for metaPanels.js had not been refreshed after a later import fix. Preserve that import and refresh the package index.

## Changes

- Use identity-specific splash previews for collection and Chess images; keep explicit chibi images for moving actors and the lobby fallback.
- Show the preview immediately and preload HD separately; replace the displayed image only when HD is ready. Keep the preview when HD fails or the screen has changed.
- Install image failure handling before images enter the DOM. Deduplicate nested capture handlers, consume each fallback once and never switch to another character's portrait.
- Restore cinematic eligibility for every fresh single/ten draw. Start its renderer before waiting for artwork, retain already loaded art, and pause elapsed playback while hidden. Keep skip, close, history, and reduced-motion behavior.
- Single-pull intros display the settled character's splash art. Ten-pull intros use the highest actual rarity for effects but keep all ten cards face down, then hand off to the manual pack reader. No economy, receipt order, rewards, or random draws are modified.

Follow-up: [battle result timing and ten-card handoff](BATTLE_RESULT_GACHA_HANDOFF_QA.md).

## Verification

- 207 JavaScript tests, 66 Python tests, TypeScript and production build pass.
- Tests exercise exact card-to-character identity, preview-to-HD upgrade, failed/detached HD, bounded fallback chains, nested event deduplication, intro rendering with artwork that never finishes loading, result timing at normal and low frame rates, hidden-tab pause and skip/close completion guards.
- Chromium collection: all 24 thumbnails loaded and pointed to the assigned splash previews. Sushi Long Trieu profile loaded its 1024px HD illustration. Ten-pull entered the cinematic Canvas with the skip button and animated effects before reaching the pack UI. No game-source console errors were observed in these checks.
- Real Safari iOS/Android device acceptance and final human art approval remain outstanding.
