# Animation Integration Spec — Browser Runtime

**Version** 1.1

**Status** Current Canvas playtest adapter and original sprite assets exist. This spec describes the presentation contract. The [v3.2 Web Asset Pipeline](WEB_ASSET_PIPELINE.md) defines the target Phaser and Spine integration.

**Purpose** Give an implementation agent one self-contained contract for connecting approved animation assets to gameplay without making animation authoritative.

## 1. Read First

Before implementation, read:

1. `client/README.md` for local run/test commands and current slice limitations.
2. `docs/02_art/SPRITE_PIPELINE.md` for frame, anchor, atlas, naming and provenance requirements.
3. `docs/00_foundation/PROJECT_BIBLE.md` for character identity and element IDs.
4. `client/src/core/events.js` and `client/src/modes/*.js` for actual event payloads.

Use rulebooks, catalogs and event payloads for runtime behavior. Concept images guide presentation. Record art approval independently of adapter integration.

## 2. Non-Negotiable Runtime Rules

- Simulation owns movement state, damage, HP, energy, mana, targeting, battle phase and rewards. The renderer and animation adapter only observe and display these results.
- An animation frame, contact frame, VFX callback, audio callback or clip-complete callback must never call a gameplay mutation such as damage, heal, reward claim, card resolution or turn advancement.
- `hit_resolved` is the authoritative visual cue for an already-resolved hit. Display its damage once; do not calculate or apply damage again.
- Clip timing may be late, interrupted, skipped by reduced-motion settings or absent because assets are missing. None of those conditions may block simulation.
- Use stable content IDs and explicit manifest references. Do not construct asset paths from display names.
- Preserve the existing placeholder renderer as a fallback until the corresponding approved asset and manifest entry exist.

## 3. Current Event Transport

`GameEventBus.emit(type, payload, context)` dispatches the same `detail` object on the internal `game-event` EventTarget and, in a browser, on `window` as `soul:game-event`.

```js
window.addEventListener('soul:game-event', ({ detail }) => {
  // enqueue presentation work only
});
```

The current envelope is:

```json
{
  "type": "hit_resolved",
  "seq": 17,
  "tick": 90,
  "payload": {},
  "battle_id": "battle_adventure_1",
  "rules_version": "client-p0-v1",
  "source_id": "chr_bunbo_holinh",
  "target_id": "mob_mushroom_01"
}
```

Only `type`, `seq`, `tick`, and `payload` are consistently supplied by the bus. Context fields are optional, not nullable guarantees. TCG may add `action_seq`. `seq` is currently allocated globally by one in-memory event bus; it is not a per-battle sequence, persisted replay cursor or cross-session ID. Do not assume events for a battle start at zero or are contiguous.

The browser entry point exposes the adapter as `window.soulOfMealAnimation`. The Canvas playtest routes battle effects and audio from the internal bus in `main.js`, with Auto Chess audio following replay timing. A presentation consumer using the adapter’s `presentation-event` should route `detail.actions` once per cue.

### Events currently emitted by the browser runtime

| Mode | Current event types | Available useful data / caveat |
|---|---|---|
| Adventure | `quest_accepted`, `quest_completed`, `chest_opened`, `route_changed` | Quest/chest/map IDs; no world-position cue or dialogue clip ID. |
| Adventure | `battle_started`, `actor_spawned`, `wave_completed`, `boss_phase_changed`, `battle_finished` | Battle context is provided for combat events. `actor_spawned` boss cue has actor ID and `boss: true`. |
| Adventure | `cast_started` | Ability ID, energy cost and target ID; context includes battle/source/target IDs. |
| Adventure | `hit_resolved`, `actor_died` | Battle context, source/target IDs and resolved damage. Basic and boss hits are labeled by `payload.source_kind`; ultimate impact currently uses the same resolved-hit channel. |
| TCG | `unit_summoned`, `card_played`, `trap_revealed` | Card/player/trigger data; these current emits do not consistently attach `battle_id` or actor source/target context. Hidden trap identity must stay hidden until `trap_revealed`. |
| TCG | `hit_resolved`, `battle_finished` | Include current match ID, rules version and `action_seq`; hit payload gives damage/effect kind/card ID. Unit attack `hit_resolved` targets instance IDs. |
| Auto Chess | `chess_unit_bought`, `chess_unit_placed`, `chess_units_merged`, `chess_combat_started`, `chess_combat_finished` | Unit/round/result data; most preparation events currently have no battle context. |
| Auto Chess | `hit_resolved` | Includes a generated battle ID, fixed simulation tick, actor source/target IDs and already-resolved damage. |

### Known event-contract gaps

These are implementation gaps, not permission for the adapter to guess:

- Adventure movement is currently driven by local state/input, not `move_started`/`move_stopped` events.
- Adventure basic-attack windup is not emitted separately; the adapter can show a short attack reaction on `hit_resolved`, but must not pretend this is frame-accurate anticipation.
- Adventure has an actor-view registry. There is no shared cross-mode world/screen transform and socket contract in the playtest.
- TCG and Auto Chess event context is inconsistent. Some IDs are card IDs or per-match instance IDs rather than character IDs.
- The browser client has a clip player, animation-manifest validation, event adapter and reduced-motion support. `SpriteRenderer` can draw frame-ID atlas rectangles when atlas metadata is loaded, while preserving the legacy grid-sheet path. Original playtest manifest/atlas pairs load into the adapter. The elemental VFX and audio bridge are live in the playtest. Production art and timing coverage are tracked separately.

The agent must document and test any event/context additions it makes. Prefer adding optional presentation cues or context fields without changing existing gameplay results or removing current event types.

## 4. Playtest Integration Layout

The current vanilla JavaScript adapter uses these modules:

```text
client/src/render/
  animationAdapter.js       # event subscription, actor/clip routing, interruption rules
  animationManifest.js      # validated manifest loading and ID lookup
  clipPlayer.js             # frame timing, loop, cancel and fallback behavior
  actorViewRegistry.js      # simulation entity ID -> render entity / transform
```

### Current implementation checkpoint

- `client/src/render/clipPlayer.js`: frame-ID timing, looping, one-shot completion, interruption priority, reduced-motion freeze and manifest validation.
- `client/src/render/actorViewRegistry.js`: render-only actor identity/transform registry and scene retention.
- `client/src/render/animationAdapter.js`: subscribes to the internal `game-event` bus, normalizes optional IDs, deduplicates `seq`, maps spawn/cast/hit/death/result events to clip state, maps scene/wave/boss/trap/summon/chess events to presentation cue IDs, and falls back when a manifest/clip is missing.
- `client/src/main.js`: syncs Adventure actor transforms and locomotion from runtime state, draws the frame-backed sprites, and falls back on a procedural pose if needed.
- `client/src/render/spriteRenderer.js`: draws atlas rectangles by the clip snapshot's `frameId`, applies normalized anchors and falls back safely on missing/out-of-bounds frames.
- `client/src/render/spriteAssets.js`: preloads the original playtest atlases and clip manifests for five battle heroes and Bún Bò’s travel sprite.
- `client/src/render/battleEffects.js`, `client/src/render/chessReplay.js`, and `client/src/core/audio.js`: present combat effects, Auto Chess replay, and sound cues from resolved runtime events.

Use this checkpoint for fixture parity. The [engine architecture](../03_engineering/ENGINE_ARCHITECTURE.md) selects Phaser 4 and Spine for the target and defines the benchmark. Keep asset files under the project pipeline convention, for example:

```text
assets/characters/<character_id>/<skin_id>/animations/<clip_id>/<direction>/...
assets/characters/<character_id>/<skin_id>/atlases/...
```

Use the [Web Asset Pipeline](WEB_ASSET_PIPELINE.md) when migrating the adapter and asset lookup to Phaser.

## 5. Manifest Contract

Create a versioned JSON manifest for approved assets. The example is illustrative; frame IDs must match delivered PNG/atlas metadata exactly.

```json
{
  "schema_version": 1,
  "character_id": "chr_bunbo_holinh",
  "skin_id": "default",
  "asset_version": "0.1.0",
  "atlas": "assets/characters/chr_bunbo_holinh/default/atlases/chr_bunbo_holinh_default_a00.png",
  "clips": {
    "idle": {
      "loop": true,
      "fps": 8,
      "directions": {
        "S": {
          "frames": ["idle_s_f000", "idle_s_f001"],
          "anchor_normalized": [0.5, 0.9],
          "events": []
        }
      }
    },
    "attack_a": {
      "loop": false,
      "fps": 16,
      "directions": {
        "E": {
          "frames": ["attack_a_e_f000", "attack_a_e_f001"],
          "anchor_normalized": [0.5, 0.9],
          "events": [{"frame": 0, "name": "windup_visual"}]
        }
      }
    }
  }
}
```

Rules:

- Implement the canonical clips in `SPRITE_PIPELINE.md`: `idle`, `walk`, `run`, `attack_a`, `attack_b`, `skill_01`, `ultimate_01`, `hit`, `victory`, `defeat`. A missing clip is valid and must use the placeholder/fallback.
- The simulation does not wait for clip duration. `loop` and `fps` are presentation metadata only.
- `anchor_normalized`, frame dimensions and atlas frame IDs must be validated. Never infer collision size from rendered sprite size.
- Clip-local events are visual/audio cues only. A `contact`/`impact` marker must not cause another gameplay hit.
- Direction mirroring is opt-in and per character/clip. Do not mirror asymmetric weapons, costume details or lettering without an approved manifest flag/review.
- Do not invent frames or reuse unrelated character frames to satisfy missing clips. Return a missing-asset report.

## 6. Event-to-Presentation Mapping

Use this table as the first implementation. `source_id`/`target_id` are identifiers, not guaranteed asset IDs; resolve them through a registry and fall back safely.

| Event/state | Presentation action | Gameplay mutation allowed? |
|---|---|---|
| Adventure movement state | Select `idle`/`walk`/`run` from authoritative input/velocity state; face the movement direction. Add explicit motion events only if needed by the adapter. | No |
| `actor_spawned` | Create/register a render actor and start `idle`; use the mode state as source of position/stats. | No |
| `cast_started` | Play `skill_01` or `ultimate_01` from `ability_id`; optional cut-in/VFX/SFX cue. | No |
| `hit_resolved` | Play target `hit`, display provided damage, play source/impact VFX/SFX from `source_kind`/element. A hit can arrive without a prior cast cue. | No |
| `actor_died` | Play `defeat`, disable future visual reactions, then retain or remove according to scene/result policy. Simulation already owns `alive`/HP. | No |
| `boss_phase_changed` | Update boss visual phase and telegraph presentation from phase state. Do not create damage or skip the sim telegraph. | No |
| `wave_completed` | Play a non-blocking transition cue; spawn/phase changes still come from authoritative events/state. | No |
| `trap_revealed` | Reveal only the event-provided trap/card after this event; before it, render a generic facedown back. | No |
| `unit_summoned`, `chess_unit_placed`, `chess_units_merged` | Animate a card/actor presentation transition from the before/after state; read merged star level from event/state. | No |
| `route_changed`, `battle_finished`, `chess_combat_finished` | Play scene/result transition; state transition has already occurred. | No |

## 7. Clip Selection and Interruption

Implement deterministic presentation priority per render actor:

1. `defeat` while the actor is dead.
2. `ultimate_01` or `skill_01` while the cast presentation is active.
3. `hit` as a short reaction when not already in a higher-priority one-shot.
4. `attack_a`/`attack_b` when an explicit attack-start cue exists; until then, `hit_resolved` can trigger a brief source attack cue only as a documented approximation.
5. `run`, `walk`, then `idle` from movement state.

Rules:

- Re-check authoritative actor state before starting or resuming a clip; never infer alive/target/phase from clip completion.
- Queue or coalesce presentation events per actor to avoid unbounded backlogs. Stale event visuals may be dropped after a scene/battle transition; gameplay events are never dropped from simulation state.
- Deduplicate presentation by the best available identity: `(battle_id, seq)` when both exist; otherwise use `(mode/match ID if available, seq)` for the current process. Do not deduplicate on `type` alone.
- On missing actor, manifest or frame, log a development warning once and show the existing placeholder. Never stall the frame loop or match.
- Respect `settings.reducedMotion`: suppress optional shake/cutin/long transitions while preserving state labels, telegraph readability and final outcome.

## 8. Target Integration Work

1. Map the current clip events and content IDs to the Phaser presentation adapter. Load frame atlases or Spine rigs through the versioned asset manifest.
2. Verify the Golden Sample’s ground anchor, facing, socket mapping, clip timing, and recovery when a clip or asset is unavailable.
3. Align remaining cast, travel, impact and aftermath cues with the resolved combat event and replay timing in each mode. Cover these cues with fixture checks.
4. Check sprite loading and reduced motion on Chrome/Edge at the reference desktop viewport and on a supported touch viewport. Track art review and provenance separately from runtime checks.

## 9. Definition of Done

- Every currently emitted event is either mapped, intentionally ignored with a documented reason, or listed as requiring an event-contract change.
- Missing/corrupt animation data never breaks startup, input, simulation, save, result or route transitions.
- No animation callback changes HP, energy, target, card zones, gold, quest state or rewards.
- Repeated test input produces identical simulation results whether animations are enabled, disabled or reduced-motion.
- Agent reports asset IDs consumed, IDs missing, tests run and manual art/provenance checks still required.
