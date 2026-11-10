# Soul of Meal Browser Runtime

This is the local, dependency-free technical vertical slice. It uses placeholder Canvas 2D scene rendering; no production sprite, animation, audio, WebGL renderer, server or art asset is included. The rules runtime emits events so an animation/render adapter can be attached without changing gameplay outcomes.

## Run

From the package root:

```bash
python3 -m http.server 4173 --directory .
```

Open `http://localhost:4173/client/`. The JSON catalogs are loaded from `examples/`. Progress is stored in this browser's local storage under a versioned save key.

Run the client tests from the package root:

```bash
node --test client/tests/*.test.js
```

## Implemented Slices

- **Adventure:** WASD/arrow keys with collision/axis sliding around static village buildings and props; tap-to-move with 24-world-unit grid A* around static obstacles; Lilia quest; one-time chest claim; village/forest route; two encounter waves including a phased boss; 30 Hz combat; auto attacks; manual ultimates; win/loss results; quest and reward persistence.
- **TCG:** seeded 36-card setup; units, traps, sample fast/slow damage spells, mana/turn flow, sequential priority, trap reaction and LIFO counter resolution, lane attacks/blocks, bot turns, commander defeat, deck-out and round limit.
- **Auto Chess:** seeded five-slot shop, buy/refresh/lock/sell, bench, 7×4 player board, placement/move, cross-zone three-copy merge, deterministic bot squads, fixed-tick combat, payouts and ten-round run state.
- **Profile:** five shared identities, local versioned save migration, audio/accessibility setting state and navigation between modes.

## Animation Adapter

Agent implementation contract, current event coverage, manifest shape and acceptance checklist are in [`docs/02_art/ANIMATION_INTEGRATION_SPEC.md`](../docs/02_art/ANIMATION_INTEGRATION_SPEC.md). Read that spec before adding an adapter or changing event payloads.

The first runtime adapter now exists in `client/src/render/`: `clipPlayer.js` validates clip manifests and advances frame IDs; `actorViewRegistry.js` holds render-only transforms; `animationAdapter.js` maps actor events to clip state and non-actor events to named presentation cues. Adventure reads authoritative movement/battle state and applies simple procedural pose changes to its existing placeholder shapes. With no approved frame assets supplied, this proves event wiring, priority and fallback behavior only; it is not production animation playback or an art approval.

Listen for events on `window`:

```js
window.addEventListener('soul:game-event', ({ detail }) => {
  if (detail.type === 'hit_resolved') {
    // Render the event; never apply gameplay damage here.
  }
});
```

Events include `type`, `seq`, `tick`, `payload` and optional mode context such as `battle_id`, `rules_version`, `source_id`, `target_id` or TCG `action_seq`. The adapter publishes `presentation-event` actions including `scene_transition`, `wave_transition`, `boss_phase`, `trap_reveal`, `unit_summon`, `chess_merge` and result cues. The simulation owns damage, phase transitions and rewards. Animation can be delayed, skipped for reduced motion or replaced without affecting state. The adapter listens to the internal event bus once; do not attach a second adapter listener to the mirrored window event or the same cue may be presented twice.

Presentation-only consumers can listen to the browser singleton:

```js
window.soulOfMealAnimation.addEventListener('presentation-event', ({ detail }) => {
  for (const action of detail.actions) {
    // Route visual/audio cues only; never mutate simulation state.
  }
});
```

## Known Technical Gaps

- Canvas 2D is placeholder presentation only; the approved WebGL renderer baseline still needs a named-engine/device benchmark.
- Adventure currently has simple grid A* over hard-coded placeholder map obstacles, not tile-authored collision, navmesh/chunk streaming, dynamic doors or authored interactable bounds; full boss mechanics, healing/status grammar and mid-battle recovery remain incomplete.
- TCG implements only the sample effect grammar; mulligan UI, deck builder, full effect grammar, surrender, timers and opponent-private network projections are absent.
- Auto Chess is a local round-vs-bot prototype, not a complete eight-player tournament. Opponent planning, finite pool, complete economy progression, combat replay and active synergy effects remain incomplete.
- No production sprites/animations/audio, PWA offline/update flow, cloud save, online service, telemetry backend, device benchmark or release/legal gate is delivered.