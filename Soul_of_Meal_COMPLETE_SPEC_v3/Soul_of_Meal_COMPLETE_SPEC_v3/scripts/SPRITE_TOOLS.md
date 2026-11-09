# Tools usage (requires Pillow)

```bash
python -m pip install Pillow
python .agents/skills/soul-of-meal-sprite/scripts/validate_sprite.py --manifest path/to/character.sprite.json --root . --strict
python .agents/skills/soul-of-meal-sprite/scripts/build_atlas.py --frames-dir assets/characters/chr_bunbo_holinh/default/animations/idle/E --output-prefix assets/characters/chr_bunbo_holinh/default/atlases/chr_bunbo_holinh_default_idle_e --fps 8 --loop
python .agents/skills/soul-of-meal-sprite/scripts/make_preview.py --frames-dir assets/characters/chr_bunbo_holinh/default/animations/idle/E --output assets/characters/chr_bunbo_holinh/default/preview/idle.gif --fps 8
```

**Important:** If image generation model cannot output clean transparent frames, an artist has to segment and repair the PNGs first. These scripts perform packaging and automated structural checks; they cannot repair style/continuity/illegal copying automatically.
