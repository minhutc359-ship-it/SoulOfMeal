# Self test

`python scripts/validate_package.py .` verifies required spec/reference files, every visual crop, the demo TCG 36-card deck and Auto Chess shop rows. It is a package/content check, not a game-runtime test.
`python scripts/update_file_index.py .` refreshes byte sizes and SHA-256 hashes in `FILE_INDEX.json`; run it after adding or editing package files, then rerun the validator.
`python -m unittest tests.test_adventure -v` runs the Adventure combat rules tests.
`python -m unittest tests.test_auto_chess -v` runs Auto Chess preparation/merge tests.
`python -m unittest tests.test_tcg -v` runs TCG setup/draw tests.
`python -m unittest discover -s tests -v` runs all implemented rules slices, not full game-runtime tests. See the engineering references for exact coverage and known gaps.

To test sprite tooling without finished art, create three 512×512 transparent PNG test frames outside the package, build atlas and generate preview. Example:

```bash
python - <<'PY'
from PIL import Image,ImageDraw
from pathlib import Path
p=Path('/tmp/som_sprite_test');p.mkdir(exist_ok=True)
for i in range(3):
    im=Image.new('RGBA',(512,512))
    ImageDraw.Draw(im).ellipse((190+i*4,180,320+i*4,450),fill=(240,80,30,255))
    im.save(p/f'test_idle_e_f{i:03d}.png')
PY
python .agents/skills/soul-of-meal-sprite/scripts/build_atlas.py --frames-dir /tmp/som_sprite_test --output-prefix /tmp/som_sprite_out/atlas --fps 8 --loop
python .agents/skills/soul-of-meal-sprite/scripts/make_preview.py --frames-dir /tmp/som_sprite_test --output /tmp/som_sprite_out/preview.gif --fps 8
```

The drawn shapes are *test data for export mechanics only*, **not Soul of Meal final sprites**.
