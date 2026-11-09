# QA Gate for sprites

## Gate levels
- DRAFT: one or more image key poses, no guaranteed correct frame segmentation.
- EDITABLE: source layer(s), review against turnaround and pose plan.
- EXPORTED: every frame RGBA and valid manifest/atlas.
- ART_APPROVED: human reviewed animation at normal/half speed, no jitter, no identity drift and original/IP compliant.
- GAME_READY: gameplay clips, VFX sockets, SFX mapping, runtime perf checked.

## Fix map
| Failure | Diagnosis | Repair |
|---|---|---|
| Edge touch or cut hair/weapon | bounding box touches canvas border | enlarge canvas or repaint missing limbs |
| Background halo / black matte | alpha matte not premultiplied or chroma not cleaned | re-export straight alpha + check linear color |
| Walk foot jitter | changing ground line or duplicate poses | re-register anchor, redraw foot contacts |
| Weapon flips hands | auto-mirror or generation drift | render opposite-facing art, review handedness |
| Tiny detail flickers | inconsistent ornament between frames | use source layer reuse, redraw offending frames |
| Hit twice | animation callback and sim event both apply damage | remove logic from render callback; use hit_resolved only |
| Page seams | no atlas gutter or incorrect texture filtering | pad atlas and test bilinear at 0.5x zoom |
| Loop snap | first/last pose not transitioning | redraw near seam, avoid duplicate end frame unless deliberate |

## Required sign-off
identity_review, export_validator_pass, motion_review, cross_mode_review, license_review, performance_review. Record reviewer's role/name and date if actually reviewed; otherwise status `pending`.
