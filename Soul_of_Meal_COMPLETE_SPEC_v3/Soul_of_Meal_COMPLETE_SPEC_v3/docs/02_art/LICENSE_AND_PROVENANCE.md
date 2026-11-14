# Asset provenance and copyright review

- `references/original_user_images/*`: images uploaded by user for guidance. Rights to third-party elements remain subject to source licensing; do not redistribute publicly without checking rights.
- `references/visuals/full/*` and `crops/*`: AI-generated *concept* references, not production-ready transparent sprites. Use the material as internal visual directions and inspect outputs for derivative similarity/copyright risks.
- `archive/v2_production_spec/*`: historical specs and concept references; some sample screens contain AI text errors and unapproved measurements; not authoritative for gameplay or production assets.
- Any new sprite: record source file hash, generator/model/tool if applicable, operator, date, content source, approved artist review, release rights and any license terms. `pending_review` means **not allowed in public release**.
- No copying sprites/music/UI resources from Princess Connect! Re:Dive, Azur Lane or Legends of Runeterra. Reference only high-level genre principles, then create original assets.

## Client 0.4 additions (2026-11-15)

- `client/assets/app-icon.svg` and its `app-icon-192.png` / `app-icon-512.png` raster exports: original code-created bowl/steam/circle geometry, produced for this repository. No source-game art is used.
- `client/src/core/audio.js`: original short note patterns and local Web Audio synthesis; no downloaded recordings, copied scores, TTS or external sound service.
- Existing portraits, card/sprite/environment images are unchanged prototype inputs. Integrating their IDs does not approve their source provenance or production art quality. New maps use the existing environment asset library and procedural color palettes.
