#!/usr/bin/env python3
"""Export the eight original anime chibi key poses for the browser battle client."""
import argparse
import json
from pathlib import Path

from PIL import Image

CHARACTER = "chr_bunbo_holinh"
VISUAL = CHARACTER + "_battle"
CLIPS = {
    "idle": ([0, 1, 7], 3, True),
    "walk": ([0, 7], 8, True),
    "run": ([0, 4, 7], 10, True),
    "attack_a": ([2, 3, 4, 7], 8, False),
    "attack_b": ([5, 3, 4, 1], 8, False),
    "skill_01": ([2, 5, 6, 7], 6, False),
    "ultimate_01": ([2, 5, 0, 6, 7], 4.5, False),
    "hit": ([4, 7], 8, False),
    "defeat": ([5], 2, False),
    "victory": ([6, 1], 4, True),
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sheet", type=Path)
    parser.add_argument("--assets", type=Path, default=Path("client/assets"))
    args = parser.parse_args()
    with Image.open(args.sheet) as sheet:
        if sheet.mode != "RGBA":
            raise ValueError("Expected a transparent 4×2 sheet")
        width, height = sheet.size
        atlas = Image.new("RGBA", (1040, 520))
        source_dir = args.assets / "characters" / CHARACTER / "battle" / "poses"
        source_dir.mkdir(parents=True, exist_ok=True)
        packed = {}
        for index in range(8):
            row, col = divmod(index, 4)
            bounds = col * width // 4, row * height // 2, (col + 1) * width // 4, (row + 1) * height // 2
            cell = sheet.crop(bounds).resize((224, 224), Image.Resampling.LANCZOS)
            frame = Image.new("RGBA", (256, 256))
            frame.paste(cell, (16, 20))
            name = f"{CHARACTER}_battle_pose_{index:02d}"
            frame.save(source_dir / f"{name}.png", optimize=True)
            x, y = col * 260 + 2, row * 260 + 2
            atlas.paste(frame, (x, y))
            packed[name] = {"x": x, "y": y, "w": 256, "h": 256}
    asset_dir = args.assets / "golden"
    asset_dir.mkdir(parents=True, exist_ok=True)
    atlas.save(asset_dir / "bunbo_battle.webp", quality=88, method=6)
    frame_ids = list(packed)
    source_manifest = {
        "character_id": CHARACTER, "skin_id": "default", "frame_size_px": [256, 256],
        "rights_status": "pending_review", "identity_review": "pending",
        "animations": {"battle_keyposes": {"fps": 8, "loop": False, "directions": {
            "E": {"frames": [f"poses/{name}.png" for name in frame_ids], "ground_anchor": [.5, .9]},
        }}},
    }
    (source_dir.parent / "source.sprite.json").write_text(json.dumps(source_manifest, indent=2) + "\n")
    clips = {
        clip: {
            "fps": fps, "loop": loop, "directions": {
                "E": {"frames": [frame_ids[index] for index in poses], "anchor_normalized": [.5, .9]},
            },
        }
        for clip, (poses, fps, loop) in CLIPS.items()
    }
    manifest = {
        "schema_version": 1, "character_id": VISUAL, "skin_id": "default",
        "asset_version": "anime-chibi-draft-1", "atlas": "bunbo_battle.webp",
        "frames": packed, "clips": clips,
    }
    (asset_dir / "bunbo_battle.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
