# Handoff: giao việc cho AI tạo sprite

1. Copy whole `.agents/skills/soul-of-meal-sprite/` to a compatible agent workspace. Some agents scan `.agents/skills/`, others use `.claude/skills/` or manual skills invocation. If unsupported, explicitly attach `SKILL.md` and reference docs in the task.
2. Specify exact `character_id`, skin, required clips/directions, identity reference and output folder. Preferred `asset_ids` come from v1 manifest, and v3 naming rules override inconsistent legacy picture labels.
3. Agent first sends *identity-lock board* then only generates frames once identity is approved. Do not claim 8 frames are consistent solely because the prompt asked.
4. Agent cleans transparent PNGs and exports valid JSON metadata, atlas and preview, runs technical QA.
5. Human art review mandatory for animation readability, fidelity and rights. Only then integrate into engine.

## Copy-ready agent task
> Apply skill `soul-of-meal-sprite`. Character: `chr_bunbo_holinh`, skin `default`, reference: `references/visuals/crops/character/hero_full.png` and `docs/00_foundation/PROJECT_BIBLE.md`. Deliver a consistent 4-view chibi identity board, 8 facial expressions, `idle/walk/run/attack_a/attack_b/skill_01/ultimate_01/hit/victory` animations, transparent 512×512 individual frames, atlas PNG+JSON, GIF previews and QA/provenance report. Keep fire overlays separate from base animation. Do not bake captions or UI into sprites. Use strict validator and report missing items honestly.
