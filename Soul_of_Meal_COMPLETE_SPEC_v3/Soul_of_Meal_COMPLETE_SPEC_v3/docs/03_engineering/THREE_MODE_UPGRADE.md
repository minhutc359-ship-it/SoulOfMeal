# Three-mode upgrade · 0.4 · 2026-11-15

Source: the user-supplied [shared gameplay/visual brief](https://chatgpt.com/s/t_6af897f7a1e481919141119d2ffb2ff7), “Mô tả ba chế độ chơi”. Its visible message was read. The separately linked sandbox Markdown attachment was not accessible, and no unseen attachment contents are claimed. The current v3 repository remains the baseline where the brief leaves a rule unspecified.

All new economy/balance numbers and overtime rules are **PROPOSED**. They are executable local PvE choices, not newly approved production design.

| Brief requirement | Delivered implementation | Remaining boundary |
| --- | --- | --- |
| Common identities, independent mode stats | `core/characters.js`, explicit card `character_id`, independent Adventure/chess/card catalogs | Five existing spirits; no new approved character art |
| Fix rig/pivots and combat pacing | Shared foot anchor, frame-ID atlas validation, manifest-backed adapter, combat speed 0.7, one canonical event bus | Source-pixel head/rig defects and real 8-direction frames require art work |
| Adventure navigation | Authored obstacle data, A*, wall sliding, recovery, follow camera, y-depth sorting | No chunk streaming/dynamic navmesh |
| Adventure world/progression | Six regions, NPC/rest/craft, 1+4 party, repeatable harvest/farm, recipe puzzle, upgrades and unlocks | Palette/library reuse, no full long-form campaign, match-3 or escort minigame |
| Adventure battle | Separate left/right battle, waves, moving melee, role effects, boss warning/phase/stove interruption, checkpointed rewards | Prototype tuning/stand-in boss art; complete status grammar remains limited |
| TCG card and turn rules | 24 named ID-backed cards, deck builder/presets, 5+2 zones, mulligan, surrender, LIFO responses, sequential bot steps, guardian/targets, spell effects and combo | Local opponent; no network-private projection/server/card-set expansion or authored boss deck |
| Auto Chess economy/preparation | 5 offers, 9 bench, drag/tap, swap/recall, shop lock, paid XP, merge to 3 stars, data stats/items, interest/streaks | Infinite independent offer model, proposed balance |
| Auto Chess complete match | Seven economic bots, all-pair rounds, neutral/elite fights, elimination, standings, scouting and TOP 1 | AI is heuristic; no live multiplayer/shared finite pool |
| Auto Chess battle presentation | Hex movement/occupancy/range checks, role skills, render-only frame/event playback, hidden combat grid | No permanent command replay archive; later render polish remains |
| Mobile/desktop/PWA | Viewport shell, overlays, joystick, card detail, touch placement, install icons, precache/update flow, save migration/backup | Browser viewport QA is not physical device certification |
| Audio/VFX | Original procedural mode scores, common boss score, crossfade, shared element impacts, no TTS | Not a recorded orchestral soundtrack or final sound mix |

## Architecture corrections

Removed query variants from module imports. Previously `events.js` and `events.js?v=3` could create separate singleton buses in the same page. All modes, the presentation adapter and the UI now subscribe to the same module instance. Content URLs are resolved from the module path, so the client works under the repository's nested directory as well as at the server root.

Simulation owns HP, mana, positions, rewards, bot economy and the tournament result. Rendering owns time interpolation, clips, VFX and music. Slowing/skipping an animation never applies an extra hit or alters a winner. TCG UI uses `stepTcgBot`, which returns after one action and never passes human priority. Legacy headless convenience runners remain for existing reference tests, not interactive turns.

## Tournament adjudication (PROPOSED)

Every round plans each living bot from its actual shop odds, wallet and bench capacity. PvP pairs are deterministically rotated; an odd competitor fights a non-damaging ghost of a living opponent. Neutral/elite rounds simulate the same content for everyone, and their item rewards apply to bots as well. Each pair produces reciprocal outcomes from one simulation. Timeout compares the remaining HP proportion of the original armies. From round 30, tied combat uses a deterministic battle-ID tiebreak and losses receive increasing overtime damage. If an entire lobby would be eliminated simultaneously, the highest pre-round HP competitor (stable ID tiebreak) retains one HP. The player’s placement is fixed on elimination; TOP 1 requires all seven bots eliminated. There is no ten-round score-based victory.

## Save migration and asset provenance

v1/v2 player resources, roster and quest progress survive. v2 prototype matches close because their turn/tournament shape is incompatible; a notice explains this. v3 battle checkpoints retain awarded results before the reward panel is dismissed. Expensive chess presentation samples are transient and restore only their final frame.

No original reference images, sprite pixels, sprite manifests or proprietary reference-game assets were edited or added. New app icon SVG/PNG exports and local synthesized note patterns are original code-created assets. Existing art remains pending its existing provenance review. See `client/README.md` for explicit production gaps and `docs/02_art/LICENSE_AND_PROVENANCE.md`.

## Verification

Automated verification commands are in `client/README.md`. `specUpgrade.test.js` covers counterable attack traps, fizzling spells, terminal states, paid combos, independent stats, merge/swap/XP/items, seven-bot economy, non-overlapping hex combat and ranges, late-round TOP 1, map reachability/recovery, reward idempotency and save migration. Browser QA uses the actual client and a same-origin iframe viewport harness (`scripts/viewport.html`). Record observed viewport and flow results in `docs/04_qa/THREE_MODE_QA.md`.
