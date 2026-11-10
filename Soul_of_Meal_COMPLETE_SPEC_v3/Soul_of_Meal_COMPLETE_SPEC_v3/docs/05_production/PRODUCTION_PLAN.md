# Production Plan / Next Steps

## Documentation-first checkpoint

Before expanding gameplay implementation, keep the documents and code in sync:

1. Use `docs/00_foundation/DECISION_REGISTER.md` to track every unresolved baseline; do not silently promote **PROPOSED** values to approved rules.
2. Keep each mode's rulebook as the gameplay source of truth and record implemented API/state contracts in `docs/03_engineering/` without implying unimplemented behavior exists.
3. Link acceptance criteria to executable tests where available; label manual, art, device and future-runtime checks as such.
4. Update examples/config schemas and their validators when a documented contract changes.
5. Re-run `python -m unittest discover -s tests -v` and `python scripts/validate_package.py .` after documentation or contract updates.

Current implementation note: Python rules prototypes remain available for focused unit tests. A separate local browser technical vertical slice now connects an Adventure quest/encounter/reward loop, TCG bot-match slice and Auto Chess preparation/combat run using placeholder Canvas 2D presentation and local versioned saves. Adventure movement has static placeholder collision and grid A* tap routing, but no tile-authored navmesh/chunk streaming. This is not a production client or complete implementation of every rule. `client/README.md` records run instructions, event adapter contract and gaps; mode-specific Python references remain authoritative for those Python modules only.

## Gate 0 — Approve art & rule baselines
Game designer and tech lead review v3 prototype baselines and mark ADR statuses. Art director approves 5 character identities, color board, one isometric map angle, and Home/TCG/Chess hierarchy. Unapproved items stay in data configs. Output: decisions and constraints, not code.

## Gate 1 — Build Golden Sample character
Use sprite agent skill to build `chr_bunbo_holinh` from a standalone identity guide; source layers, turnarounds and frames. Export 9 animations, 8 facial expressions, one cut-in, VFX sockets, audio cues. Validate asset + scene preview; refine until no identity drift/clip issues. Output: complete reusable production template + benchmark.

## Gate 2 — Environment slice
Implement village: main plaza, restaurant, guild, merchant, forge, houses, bridge, chest; Lilia quest and forest portal. Pathfinding/navmesh, chunk streaming, camera, collision, interactions. Output: player can explore and reload.

## Gate 3 — Core combat and 3 mode demos
Adventure: 1 boss/2 enemy varieties/1 ultimate; TCG: 36-card decks with traps and stack, one bot; Auto Chess: shop, merge, 7x8 board, bot, combat events. Implement separate data schemas sharing Vị Linh `id`, art motifs, SFX buses. Output: 20-minute end-to-end demo.

## Gate 4 — UI, audio, update flow
Build 16 screens, adaptive layout, 4 audio buses, SFX/vocal mapping and PWA install/update. Preload by mode, fallback and asset hashes, save migration/recovery.

## Gate 5 — QA and production readiness
Run 30/60 render FPS behavior tests, mobile low-memory benchmarking, 53 old QA acceptance cases + v3 new case IDs, copyright/provenance and release checklist. Prioritize fixes using reproducible issue IDs and fixture versions.

## Suggested agent responsibilities
| Agent | Inputs | Outputs | Approval gate |
|---|---|---|---|
| `game-design-agent` | rulebooks | validated mode catalog and balancing workbook | Game Designer |
| `character-art-agent` | character bible + skill | identity, sprites, cutin and atlas | Art Director |
| `environment-agent` | map/props spec | tile/props/NPC sprites, collision | Level Designer |
| `ui-agent` | wireframes/state matrix | responsive components & animation | UX QA |
| `combat-agent` | rulebooks/events | deterministic simulation + replay | Tech Lead |
| `vfx-audio-agent` | five-element guide | FX profiles + SFX/voice event links | Audio/Art Lead |
| `qa-agent` | test plan + schemas | regression reports and captures | QA Lead |
| `release-agent` | artifact manifest | versioned assets + compliance checks | Release Manager |

## Milestones (not promised dates)
M0 approval and scope lock; M1 Golden Sample; M2 Adventure slice; M3 TCG bot play; M4 Auto Chess bot play; M5 unified vertical slice; M6 beta. Advance only after acceptance, not after a calendar date.

## Open gaps remaining after v3
1. Final balance from long playtests (not inferred from image).
2. Runtime engine benchmark / final renderer choice.
3. Real finished transparent sprites / rigs, original BGMs/voices, scene prefab and shader implementation.
4. PvP server authority, matchmaking/reconnect/anti-cheat (if in scope).
5. Ownership/license approvals and publishing / economy legal compliance.
