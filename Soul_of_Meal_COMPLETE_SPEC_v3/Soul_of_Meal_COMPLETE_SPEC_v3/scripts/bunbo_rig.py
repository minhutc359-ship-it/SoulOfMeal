#!/usr/bin/env python3
"""Pack Bún Bò's puppet sheet or export editor-ready individual PNG attachments."""
import argparse
import json
from pathlib import Path
import shutil

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "client/assets/original/rigs/bunbo"
PARTS = (
    "head", "hair", "torso", "ribbon",
    "arm_near", "hand_near", "arm_far", "hand_far",
    "leg_near", "leg_far", "sword", "tassel",
)
CELL = 112


def pack(source):
    atlas = Image.new("RGBA", (CELL * 4, CELL * 3))
    regions = {}
    with Image.open(source) as sheet:
        if sheet.mode != "RGBA":
            raise ValueError("The sheet needs an alpha channel")
        width, height = sheet.size
        for index, name in enumerate(PARTS):
            row, col = divmod(index, 4)
            part = sheet.crop((col * width // 4, row * height // 3,
                               (col + 1) * width // 4, (row + 1) * height // 3))
            alpha = part.getchannel("A").point(lambda value: 0 if value < 36 else value)
            bbox = alpha.point(lambda value: 255 if value >= 120 else 0).getbbox()
            if bbox is None:
                raise ValueError(f"Missing {name}")
            left, top, right, bottom = bbox
            part.putalpha(alpha)
            part = part.crop((max(0, left - 4), max(0, top - 4),
                              min(part.width, right + 4), min(part.height, bottom + 4)))
            part.thumbnail((CELL - 8, CELL - 8), Image.Resampling.LANCZOS)
            x, y = col * CELL + 4, row * CELL + 4
            atlas.paste(part, (x, y))
            regions[name] = [x, y, part.width, part.height]
    atlas.save(ROOT / "parts.webp", lossless=True, method=6)
    (ROOT / "regions.json").write_text(json.dumps(regions, indent=2) + "\n", encoding="utf-8")


def export(output):
    images = output / "images"
    images.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / "bunbo.json", output / "bunbo.json")
    regions = json.loads((ROOT / "regions.json").read_text(encoding="utf-8"))
    with Image.open(ROOT / "parts.webp") as atlas:
        for name, (x, y, width, height) in regions.items():
            atlas.crop((x, y, x + width, y + height)).save(images / f"{name}.png")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    options = parser.add_mutually_exclusive_group(required=True)
    options.add_argument("--pack", type=Path, metavar="SHEET")
    options.add_argument("--export", type=Path, metavar="DIRECTORY")
    args = parser.parse_args()
    pack(args.pack) if args.pack else export(args.export)
