# Export Contract

```
assets/characters/chr_bunbo_holinh/default/
  source/identity_ref.png       # approved reference, optional editable PSD/KRA
  animations/
    idle/E/chr_bunbo_holinh_default_idle_e_f000.png
    ...
    attack_a/E/chr_bunbo_holinh_default_attack_a_e_f000.png
  atlases/chr_bunbo_holinh_default_a00.png
  atlases/chr_bunbo_holinh_default_a00.json
  chr_bunbo_holinh_default.sprite.json
  preview/idle.gif
  qa/validation_report.json
```

- Frames are RGBA PNG 512×512 (same per clip); keep no text/label.
- Atlases use a uniform grid by default, 2px transparent gutter and up to 2048×2048 texture page.
- Atlas coordinates in pixels from top-left; JSON records `(x,y,w,h)`, `sourceSize`, `anchor`, `fps`, `loop`, `clip`, `direction`, `frame_index`.
- Renderer loads referenced frames by registry, not filename guessing at render time.
- Agent provides `sha256` and `license/provenance` for every source and produced art.
- Do not embed collision calculations in the texture atlas.

## Manual QA at actual target sizes
Render sprite at 64, 112 and 160 world pixel heights, on pale village and dark combat backgrounds. Confirm silhouette, no chroma halo, weapon always present, not moving through ground, alpha edges clean; compare key-poses across frames at 1x. If data and visual disagree, do not merge.
