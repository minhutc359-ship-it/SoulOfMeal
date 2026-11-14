# Soul of Meal · playable client 0.4

Dependency-free browser game with three independent rule systems, shared Vị Linh IDs, Canvas sprites and local saves. Balance is **PROPOSED**, recorded in `src/core/rules.js` and the JSON catalogs. This is a substantial local PvE upgrade, not a production-art or online multiplayer release.

## Run and verify

From this package root:

```sh
npm run dev
# Open http://127.0.0.1:4173/client/
npm test
npm run build
npm run check
python -m unittest discover -s tests -v
python scripts/update_file_index.py .
python scripts/validate_package.py .
```

No dependency install is needed. `scripts/dev.mjs` accepts the preview host/port flags. Open `scripts/viewport.html` on this server to inspect 390×844, 844×390 and 1280×800 viewports. `?mode=adventure`, `?mode=tcg`, `?mode=chess` and page hashes support entry links.

## Playable scope

- **Adventure:** six data-authored maps with A*, collision sliding, collider recovery, follow camera and depth sorting; village quest/chest loop; return travel; one protagonist and up to four selected spirits; 30 Hz auto combat, manual/optional auto ultimates, healing, shields, burn and water delay; two story waves or three farm waves; boss tells, two interruptible stoves and phase changes; repeatable materials, one-time recipe puzzles, crafting, resting, upgrades and region unlocks.
- **TCG:** validated 36-card decks, four editable presets and 24 named cards; mulligan and surrender; five unit/two trap slots; mana, summon rest, chosen attackers/targets and guardian protection; sequential bot actions with human priority windows; LIFO spell/counter/trap stack; damage, buffs with expiry, healing, shields, draw and stun; paid fire/water/wood combo; commander defeat, mandatory deck-out and round limit retain terminal state.
- **Auto Chess:** five-offer shop with seeded odds, gold/interest/streak income, XP purchases, persistent shop lock, nine-slot bench, swaps/recall/sale, cross-zone triple merging capped at three stars, items and active unique-ID synergies. Seven bots own their gold/XP/shop/bench/board and choose different strategies. Neutral, elite and PvP rounds pair and resolve every living competitor; commander elimination determines placement and TOP 1. A documented overtime tiebreak prevents endless tied final rounds. Hex combat uses occupied-cell pathfinding, actual ranges, role abilities and deterministic event/frame playback; grid lines disappear during combat.
- **Presentation:** a single event bus drives the existing animation adapter, sprite anchors and VFX; combat clips run at 70% speed without changing simulation time. Existing sprite sheets are loaded into the adapter, with explicit fallbacks for missing art. Original Web Audio sequences provide mode music and a common `epic_boss_battle` score with crossfade. There is no Vietnamese TTS or voice setting.
- **Client/PWA:** viewport layout for desktop and portrait/landscape mobile, touch joystick, tap-to-inspect cards, drag/tap chess placement, secondary overlays, reduced motion, original install icons, a versioned precache and explicit update notification. Practice is browser-local, with save backup export/import.

## Save and offline behavior

Save v3 uses `soul-of-meal.save.v3`; v1/v2 are migrated without deleting player progression or resources. Incompatible v2 in-progress matches are closed with a migration message. Adventure snapshots and awarded results are checkpointed; one-time claims remain idempotent. Chess render samples are omitted from persistent saves except for the final frame, so long animations do not fill local storage. A loaded chess result shows its final state rather than replaying the transient animation. Storage failures are caught and reported.

`npm run build` regenerates `offline-manifest.js` from actual runtime files and catalogs. A failed precache cannot replace an existing working worker. Updates wait for the player's explicit **Áp dụng & tải lại** action. Offline play requires a first successful online load/cache. Development requests on `127.0.0.1` bypass the cache; use `client/?offline=1` to exercise the production cache locally. Competitive service, account/cloud sync and cross-device saves are not provided.

## Remaining production work

Existing portraits and sprites are inherited prototype assets; no new approved HD portraits, individual frame sets, turnaround, eight-direction motion or music recording was produced. Anchor/atlas fixes cannot repair a head already drawn incorrectly inside source pixels. `hero_ketvi`, normal monsters and boss objects use distinct procedural fallbacks until their art is supplied; the existing `boss_thief` sheet remains a boss presentation stand-in. Four new regions reuse the existing environment library with data/palette variations. There are five shared playable spirits, so some high trait thresholds need a larger authored roster. All provenance/art approval and actual iPhone/Android hardware/audio/install benchmarks remain pending. There is no matchmaking, authoritative server, anti-cheat, full deterministic command replay archive or full content/story campaign.

The Python rule prototypes are kept as their existing v3 reference slices; the upgraded playable rules live in `client/src/modes/`. Do not confuse a successful Python/package check with browser-game coverage.
