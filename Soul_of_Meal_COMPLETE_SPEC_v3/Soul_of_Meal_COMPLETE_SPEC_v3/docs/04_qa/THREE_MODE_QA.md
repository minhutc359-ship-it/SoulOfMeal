# Three-mode upgrade QA · 2026-11-15

## Automated checks

- JavaScript: **68 tests**, including one complete interactive TCG command sequence through an adjudicated result. The human-command test driver follows phase legality; priority is consulted only during action/reaction windows.
- Python v3 reference slices: **65 tests**, unchanged implementations, passing against the updated catalogs.
- Runtime/package checks: all JS parses, every relative module import resolves without query-based duplicate identities, all 118 offline manifest URLs and install icons exist; package file-index sizes/hashes validated.
- `git diff --check` passes.

Commands:

```sh
npm test
python -m unittest discover -s tests -v
npm run build
npm run check
python scripts/update_file_index.py .
python scripts/validate_package.py .
```

## Observed browser checks

Actual client served through the managed preview, with ordinary UI input. Mobile layouts use same-origin viewport frames, not fabricated screenshots or direct game-state mutation.

| Surface | Observed flow / result |
| --- | --- |
| Desktop Chromium, 1365×936 | Home boot; TCG card detail/insufficient-mana state; five-unit rows/two traps; full Auto Chess preparation and seven opponents |
| Portrait 390×844 | Auto Chess buy → bench → place → buy two matching copies → two-star merge on board → enter canvas combat; shop disabled and grid absent during combat |
| Portrait 390×844 | Adventure tap-to-walk reaches Lilia (world x≈236), nearby interaction enables, accepting quest updates text, map opens as an overlay with locked later regions; joystick is visible |
| Portrait document bounds | `clientWidth = scrollWidth = 390`, `clientHeight = scrollHeight = 844` |
| Landscape 844×390 | TCG board and separate hand column visible together, mulligan replaces four cards, pass → bot pass → combat → skip attack → end turn; bot proceeds one action at a time |
| Landscape document bounds | `clientWidth = scrollWidth = 844`, `clientHeight = scrollHeight = 390` |
| PWA update | Waiting update banner shown, explicit Apply action reloads into the current client; update banner clears |
| Offline origin reload | Opened `client/?offline=1#chess`, bought/merged/placed a two-star spirit, then **stopped the preview origin** and reloaded. Client booted from cache with the same 7 gold, two-star unit and board position |

The stopped-origin check exercises cached app/data/assets; it is not a physical phone airplane-mode test. Browser-extension metadata warnings were unrelated to the game. No final-frame art/animation approval is inferred from a functional browser check.

## Remaining checks

Physical iPhone/Android touch/drag, speaker/audio mix/crossfade, install/update behavior on Safari, performance/memory benchmarks, licensed final art, true eight-direction frames, cloud saves and online competitive infrastructure remain unverified or unimplemented. The existing sprite grid sheets are consumed as inherited assets; no new individual production frames were created, so no strict individual-frame art validation is claimed. See `THREE_MODE_UPGRADE.md` and the client README for the delivery boundaries.
