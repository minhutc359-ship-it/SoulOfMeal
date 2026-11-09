# AGENTS.md — Soul of Meal production handoff

You are working on the **standalone Soul of Meal v3 specification**, not a prior repository or legacy design. Read `README.md`, `docs/00_foundation/PROJECT_BIBLE.md`, then the mode-specific spec. Do not infer technical facts from AI-generated picture typography.

## Core invariants
- Character identity is common across Adventure, TCG and Auto Chess; numeric stats and rules are mode-specific.
- Sprite outputs must be clean transparent RGBA individual PNG frames plus metadata JSON, not only a concept poster or GIF.
- Attack damage is decided by deterministic game state; animation/VFX is purely a renderer of events.
- Feature changes require ID-based assets, predictable migration, licensing record and acceptance tests.
- No copyrighted sprites/portraits/sounds from reference games. Generate original content or verify licenses.
- Mark unapproved economy/balance and tech choices PROPOSED. Do not silently declare them final.

## If asked to create/update a sprite
Read `.agents/skills/soul-of-meal-sprite/SKILL.md` and its references. Produce an identity-lock, an approved action manifest, actual frames when generation/edit tools exist, an atlas and QA report. If image-generation/rigging is unavailable, stop at the pending-art brief; do not claim assets were produced.

## When done
Run `python scripts/validate_package.py .`, then validate sprite assets (`--strict`) only for a character with frames available. Provide clear names of produced outputs and note manual art review still required.
