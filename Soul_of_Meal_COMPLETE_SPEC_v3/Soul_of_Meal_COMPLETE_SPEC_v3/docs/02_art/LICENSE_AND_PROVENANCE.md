# Asset provenance and copyright review

- `references/original_user_images/*`: images uploaded by user for guidance. Rights to third-party elements remain subject to source licensing; do not redistribute publicly without checking rights.
- `references/visuals/full/*` and `crops/*`: AI-generated *concept* references, not production-ready transparent sprites. Use the material as internal visual directions and inspect outputs for derivative similarity/copyright risks.
- `archive/v2_production_spec/*`: historical specs and concept references; some sample screens contain AI text errors and unapproved measurements; not authoritative for gameplay or production assets.
- Any new sprite: record source file hash, generator/model/tool if applicable, operator, date, content source, approved artist review, release rights and any license terms. `pending_review` means **not allowed in public release**.
- No copying sprites/music/UI resources from Princess Connect! Re:Dive, Azur Lane or Legends of Runeterra. Reference only high-level genre principles, then create original assets.

## Browser playtest assets

| Asset | Source | Review |
|---|---|---|
| `client/assets/golden/bunbo.webp`, `fire.webp`, `client/assets/audio/sfx_*.ogg` | Bún Bò Hỏa Linh Golden Sample v1 supplied with Soul of Meal SPEC v3.1, from original procedural frames and audio | Technical frame validation passed. Human art review pending. |
| `client/assets/characters/chr_bunbo_holinh/battle/poses/`, `golden/bunbo_battle.webp` | Original generated anime chibi poses based on the Soul of Meal identity (orange ponytail, spice flower, cream and red chef-warrior coat, flame knife). The prompt specified eight isolated poses in a transparent 4×2 grid with shared ground line. | Draft. Eight source RGBA poses checked for bounds and uniqueness. Identity, continuity and commercial rights review pending. |
| `client/assets/cinematic/*.webp` | Original generated key art. Prompts specified a chibi heroine in a Vietnamese-inspired lantern market, a top-down village courtyard, a forest clearing, a transparent airborne ultimate pose and two isolated forest imps. | Draft. Commercial rights review pending. |
| `client/assets/audio/*_theme.ogg`, `forest_wind.ogg` | Original melodies and synthesized ambience defined in `scripts/build_music.py`. | Playback and loudness on target devices pending. |

The anime chibi art uses the visual direction requested for Soul of Meal. Characters and assets are original to this project. No art or audio from the reference game is included in these additions.
