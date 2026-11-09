# Sprite Animation Matrix

| Clip | frames | FPS | loop | Key pose | Footprint |
|---|---:|---:|---|---|---|
| idle | 8 | 8 | true | breathing & blink | static foot anchor |
| walk | 8 | 12 | true | contact left f2 / right f6 | foot sliding forbidden |
| run | 8 | 16 | true | anticipation f0 / steps f2,f6 | forward lean |
| attack_a | 12 | 16 | false | anticipation 0–3, strike 4–7, recoil 8–11 | contact cue f7 |
| attack_b | 12 | 16 | false | alternate arc, contact f8 | distinct silhouette |
| skill_01 | 16 | 16 | false | cast, projectile cue f6, recover | FX socket stable |
| ultimate_01 | 24 | 16 | false | intro 0–5, action 6–17, recover 18–23 | cutin separate timeline |
| hit | 6 | 12 | false | snap & recovery | no combat damage call |
| victory | 12 | 12 | false | high-energy pose → settle | no cropped weapon |
| defeat | 10 | 10 | false | stagger → collapse | safe ground contact |

**Simulation is separate**: `fx_frame` is visual sync only; `hit_resolved` comes from deterministic rules.

## Directional set
- Battle P0: east facing `E`, reflect to `W` only if weapon handedness and asymmetry reviewed.
- Map P0: `N, E, S, W` (true art turnarounds); diagonals optional only if navigation demands.
- No other clip direction inferred from rotated/warped finished sprite without review.
