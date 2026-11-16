# Battle rendering, splash-art gacha and puzzle feedback

Date: 2026-11-16. Scope: browser presentation and local practice. Balance remains PROPOSED.

## Root cause and fix

A real Chromium session reproduced `TypeError: Illegal invocation` in `MusicCrossfade.finish`. The browser `clearInterval` method had been stored directly on a class instance and was called with that instance as its receiver. Music changes happen while building every mode screen, so this exception could stop navigation with a stale/empty screen. Wrap the host call so the receiver stays `globalThis`. A regression test supplies a receiver-sensitive timer API and exercises completing one fade and starting the next.

## Delivered behavior

- Summon receipts render the original per-character splash illustrations. Single reveals use HD with preview fallback. Ten draws open a sealed pack, reveal one ordered card at a time, then show all ten; duplicates and their exact essence stay visible. History and reduced-motion settings show the summary directly. The renderer never draws random numbers, spends currency or grants rewards.
- Matching puzzles show distinct ingredient symbols/names, three-step instructions, goal progress and a legal hint. Rules return an immutable swap/clear/fall/cascade trace. The UI locks additional moves during playback and cancels presentation when leaving the scene. Invalid swaps do not spend turns; claiming rewards continues through the existing idempotent rules.
- Sliding puzzles show the target arrangement, explicit empty tile, valid adjacent tiles and a sliding transition.
- Adventure damage/cutin and Chess impact labels are larger and persist longer. Simulation, hit timing, rewards and the existing playback rate are unchanged.

## Verification

- JavaScript suite: 195 tests. Python rules suite: 66 tests. TypeScript and Vite production build pass.
- Chromium: reproduced the previous music error; after the fix TCG rendered and accepted a summon, Auto Chess replay showed moving actors and damage followed by the result dialog, and Adventure exploration/quest interactions rendered.
- Chromium gacha: a ten-ticket draw opened the pack UI, the first card loaded at 1024 pixels, and summary contained ten ordered cards including duplicates and essence. This was a guest practice profile.
- Viewport QA: matching puzzle at 390x844 and 844x390. A hinted move played, returned control, changed score by three and consumed one move. Landscape board measured 312x312 inside the 844x390 scene; copy and controls fit inside the scene.
- The viewport checks are Chromium layout checks, not acceptance on real Safari iOS/Android hardware. Server-side account/end-to-end economy acceptance, long-session performance and final art/balance review remain separate work.
