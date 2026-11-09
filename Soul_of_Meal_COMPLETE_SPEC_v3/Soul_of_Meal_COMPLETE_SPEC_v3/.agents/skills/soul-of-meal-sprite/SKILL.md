---
name: soul-of-meal-sprite
description: Generate, refine, validate and export original Soul of Meal anime/chibi characters into production sprite frames, atlas metadata, animation previews and integration notes. Use whenever requested to create/update a Vị Linh sprite, NPC animation, per-mode character animation or character VFX sockets.
---

# Soul of Meal — Sprite Artist Agent Skill v1.0

## Inputs / read first
1. `README.md`, `AGENTS.md` and `docs/00_foundation/PROJECT_BIBLE.md` at repo root.
2. `docs/02_art/SPRITE_PIPELINE.md` (source of truth for frame dimensions, IDs and animation matrix).
3. `references/visuals/crops/character/*` and *the approved* identity file at `examples/characters/<character_id>/identity.json`.
4. `references/animation_matrix.md`, `references/prompt_library.md`, `references/quality_gate.md` in this skill.

**Must not** generate art from a known copyrighted game's proprietary character as a direct copy. Use the user's Soul of Meal references solely for visual direction. If the user has not supplied approved turnaround, create it as a draft and flag identity for review.

## Expected input task
```json
{
  "character_id":"chr_bunbo_holinh",
  "skin_id":"default",
  "animation_ids":["idle","walk","run","attack_a","attack_b","skill_01","ultimate_01","hit","victory"],
  "directions":["E"],
  "frame_size":[512,512],
  "export_scale":1,
  "license_status":"pending_review"
}
```
Input is accepted only after checking `character_id` exists, `skin_id` consistent, task has a named art reference, and no conflict with character identity invariants.

## Execution workflow — ALWAYS in this order
1. **Identity lock**: create/verify character silhouette, facial features, costume, hairstyle, accessories, palette HEX, weapon handedness and head/body proportions. Create front/3/4/side/back key art before any frame bulk generation. Record reference assets and copyright provenance. Gate: manual `identity_review=approved`.
2. **Motion spec**: choose one clip at a time, frame_count, FPS, key poses, readable anticipation/contact/recovery and `ground_anchor`. Use the animation matrix; no speculative damage mechanics.
3. **Pose generation**: if an image-generation tool exists, produce clean isolated character key pose(s) with stable identity, plain/transparent backdrop, no text. For multi-frame images use a uniform grid with equal cell sizes, full body inside each cell, no margins, captions, numbering, borders or scene props. Never include the character name inside pixels. Use several small coherent batches for complicated motion rather than a 100-pose poster.
4. **Cleanup**: crop/separate frame cells, normalize frame canvas, remove opaque background, preserve intentional shadow on its own layer where possible, fix hand/weapon/hair drift, add 8% transparent margin, align ground anchors. **Do not infer that AI alpha is genuine**: inspect PNG channel and pixel edges.
5. **Export**: 8-bit RGBA PNG individual frames under `assets/characters/<id>/<skin>/animations/<clip>/<direction>/`; create manifest with `fps`, `loop`, `anchor_normalized`, `hitbox_world`, socket positions, events and source hash.
6. **Pack**: use `scripts/build_atlas.py` and keep atlas page ≤2048px. Frames **must retain per-frame dimensions and anchors**; add 2px bleed gutter. `make_preview.py` produces *only review GIF*, not game source asset.
7. **Validate**: run `scripts/validate_sprite.py --manifest <...> --root <...> --strict`. Inspect preview at 1x, 0.5x, moving on a map behind solid props and battle targets.
8. **Integrate**: update the shared asset registry and provide a demo link/path, mode variants, issues and provenance. Game logic drives hit events; animation frames carry sync cues but never compute damage.

## Size & quality defaults
- Master frame 512×512 RGBA, runtime frame 256×256 or 512×512 only after benchmark.
- Character grounded anchor normalized `[0.5,0.9]`, 8% inner safety (pose bbox <=84% of frame), foot ground line stable across idle/walk/run.
- Humanoid chibi ~2.4–2.8 heads; Bánh Bao mascot ~1.1–1.4 heads; never resize face/body inconsistently across poses.
- Source key art for `chr_bunbo_holinh`: red-orange hair, amber eyes, flower spice accessory, red cooking ribbon, fiery blade, anime kitchen warrior. Do not remove weapon or swap handedness between frames.
- For walk/run prefer 8 frames, 12/16fps, loop; attack A/B 12 frames @16fps non-loop; skill 16 @16fps; ultimate 24 @16fps; hit 6 @12fps; victory 12 @12fps.

## Output contract / naming
Use `templates/sprite_job.template.json`, `templates/identity.template.json`, `templates/manifest.template.json` and exact structure in `references/export_contract.md`.
`chr_bunbo_holinh_default_attack_a_e_f000.png` through `f011.png`; atlas names `chr_bunbo_holinh_default_a00.png/json`.

**Final handoff MUST include:** (a) approved identity snapshot; (b) source/editable art (or explicit missing-source blocker); (c) individual cleaned PNG frames; (d) manifest JSON; (e) atlas PNG+JSON; (f) preview; (g) QA report; (h) provenance/license status; (i) integration notes. If art generation tool is unavailable, return only briefing/spec and mark (c)–(f) `NOT_CREATED`; never claim completion.

## Prohibited shortcuts
- No `sprite sheet` consisting only of tiny labels and thumbnail art.
- No reusing one frame 8 times as a fake walk cycle.
- No painting backgrounds into each character frame.
- No arbitrary scale/anchor each frame; no baked lighting that conflicts with scene.
- No using one generated image for different characters or directions without identity review.
- No blank, pure geometric fallback VFX presented as final character ability.
- No sharing an unverified license or calling AI generated screenshots authoritative technical values.

## Troubleshooting
Look in `references/quality_gate.md` for alpha halo/ground jitter/edge clipping/weapon flipping/ghost duplicated frames. If failing, repair affected key poses, re-export and rerun validator. Do not lower validation thresholds to hide failure.
