# Technical Architecture — Engine-neutral Reference

## 1. Components
- `content/` JSON records: character identities, animations, abilities, TCG cards/decks, chess units, maps, quests, VFX/SFX registries.
- `game-rules/`: pure deterministic simulation, immutable command-processing, seeded PRNG, replay event log, world save schema.
- `render/`: mapping authoritative game events to sprites, texture atlases, VFX, cameras and sound. **Render never decides damage, mana, rewards, card stack or targeting**.
- `input/`: touch/keyboard/gamepad → validated commands, contextual button state.
- `ui/`: screen state machine, accessible tooltips and responsive layout, localization.
- `storage/`: save local versioning, optional cloud/sync conflict strategy, content version caches.
- `services/` only when needed: auth, pvp matchmaking, authoritative battle, analytics; not part of local P0 dependency.

### Current implementation status

The component list above remains the production target. A dependency-free browser client now exists in `client/`: it has a local-save shell, Canvas 2D placeholder renderer, Adventure quest/exploration/combat/reward slice, TCG bot-match slice and Auto Chess preparation/combat run. The browser rules are separate JavaScript modules; the existing Python references remain independent prototypes. The browser client is not yet a production renderer or complete implementation of any mode. See `client/README.md` and the mode references for exact coverage and gaps.

The Python reference functions accept content/config data and return values or copied state. The browser slices validate their local phases and emit animation-facing events; Adventure now includes radius-aware collision against static placeholder obstacles and grid A* tap routing. Map collision still is not authored from tile/map content. The client is not integrated with a shared command service, replay serializer or game-wide persistent event log.

The current Canvas 2D geometry is a technical placeholder, not the approved final WebGL renderer. No production sprite, animation, audio, cloud service or online authority is included.

## 2. Screen state machine
`boot -> preload_core -> home -> adventure | tcg | auto_chess | characters | gacha | quests | settings`. Every page supports `loading | ready | empty | error | offline_optional`. Each battle has `preload | prepare | play | pause_if_pve | result | rewards | exit`. Forbidden transitions rejected with `reason_code`; route history never leaves an orphan active battle.

## 3. Design data units
- Game time in integer `tick` at fixed 30Hz for both auto-combat modes; TCG use sequential `action_seq` not ms.
- World coordinates use float32 `world_units` with an agreed pixels-per-unit mapping per scene. UI in dp/logical px with safe area.
- Art master in RGBA PNG and export formats; runtime atlas page ≤2048x2048, no dynamic string path construction inside combat frame loop.
- IDs snake_case ASCII; stable `version` in all content objects; migrations preserve owned units/decks.

## 4. Event example
```json
{
  "battle_id":"battle_p0_0001", "rules_version":"0.3-proposal", "tick":270, "seq":54,
  "type":"hit_resolved", "source_id":"chr_bunbo_holinh", "target_id":"mob_mushroom_01",
  "payload":{"damage":240,"element":"fire","blocked_by_shield":0,"is_critical":false}
}
```
Render receives the event, shows contact VFX, damage number, impact SFX and hit reactions. It must not apply another 240 damage. Events sent to multiple UI subscribers are deduplicated on `(battle_id,seq)`.

## 5. Failure behavior
- Missing atlas => visible placeholder **in editor only** + error telemetry; not a production release.
- Audio unsupported => mute gracefully, no gameplay delay.
- Update asset manifest => download staged assets, verify hashes, activate version atomically, keep save schema and recovery copy.
- Network lost in local PvE => keep simulation and save; competitive mode must implement reconnect/forfeit server rules before release.
- Hidden TCG info remains hidden in client payload until revealed; protect deck and trap data.

## 6. Testing and performance
Unit test pure rules; property tests for no negative HP/mana/gold, max capacities; deterministic replay hash tests; content schema tests; load-test and actual device benchmark 30/60 FPS. Include low-memory phone and mid-range laptop. Track atlas count, draw calls, texture peak, script time, asset download size, frame jitter and audio clipping.

## 7. Security & copyright
No API keys in shipped frontend bundles. Validate all persisted game actions server-side in multiplayer. Sanitize names and localization. Keep original asset source, prompt/provenance if generated, approved license and author/owner fields; no repackaging of copyrighted game reference assets as release assets. No hidden loot rates.

## 8. Engine selection decision matrix
Benchmark 3 candidate stacks with same Golden Sample scene (movement, 5 actors, 12 NPCs, 2 VFX, camera zoom and UI): `FPS p50/p95`, main-thread frame duration, memory, load duration, bundled runtime size, mobile touch fidelity, rig compatibility, deployment constraints. Select only after results. Suggestion: engine-agnostic atlases + JSON contracts avoid long-term migration costs.
