#!/usr/bin/env python3
"""Pack a Vị Linh puppet sheet or export editor-ready PNG attachments and JSON."""
import argparse
import json
from pathlib import Path
import shutil

from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parents[1] / "client/assets/original/rigs"
PARTS = (
    "head", "hair", "torso", "ribbon",
    "arm_near", "hand_near", "arm_far", "hand_far",
    "leg_near", "leg_far", "sword", "tassel",
)
CELL = 112
ROTATIONS = {
    "chr_pho_lamvu": {"arm_near": 24, "hand_near": -78, "arm_far": -10, "hand_far": -84, "leg_near": 14, "leg_far": 7},
    "chr_goicuon_diepnhi": {"arm_near": 24, "hand_near": -94, "arm_far": -15, "hand_far": -96, "leg_near": 15, "leg_far": 8},
    "chr_banhbao_bachngoc": {"arm_near": 24, "hand_near": -54, "arm_far": -12, "hand_far": -61, "weapon": 24},
    "chr_caphe_davu": {"arm_near": 25, "hand_near": -43, "arm_far": -25, "hand_far": -45, "leg_near": 12, "leg_far": -7},
}


def clean_alpha(alpha):
    """Remove isolated matte specks while keeping anti-aliased edges of the parts."""
    width, height = alpha.size
    pixels = bytearray(alpha.point(lambda value: int(value >= 120)).tobytes())
    components = []
    for start in range(len(pixels)):
        if not pixels[start]:
            continue
        component = [start]
        pixels[start] = 0
        for index in component:
            y, x = divmod(index, width)
            for neighbor in (
                index - 1 if x else -1, index + 1 if x + 1 < width else -1,
                index - width if y else -1, index + width if y + 1 < height else -1,
            ):
                if neighbor >= 0 and pixels[neighbor]:
                    pixels[neighbor] = 0
                    component.append(neighbor)
        components.append(component)
    largest = max(map(len, components), default=0)
    mask = bytearray(len(pixels))
    for component in components:
        if len(component) >= max(8, largest // 35):
            for index in component:
                mask[index] = 255
    edge = Image.frombytes("L", alpha.size, bytes(mask)).filter(ImageFilter.MaxFilter(5))
    return ImageChops.multiply(alpha, edge)


def pack(source, character):
    directory = ROOT / character
    directory.mkdir(parents=True, exist_ok=True)
    parts = PARTS if character == "bunbo" else (*PARTS[:-2], "weapon", "detail")
    atlas = Image.new("RGBA", (CELL * 4, CELL * 3))
    regions = {}
    with Image.open(source) as sheet:
        if sheet.mode != "RGBA":
            raise ValueError("The sheet needs an alpha channel")
        width, height = sheet.size
        for index, name in enumerate(parts):
            row, col = divmod(index, 4)
            part = sheet.crop((col * width // 4, row * height // 3,
                               (col + 1) * width // 4, (row + 1) * height // 3))
            alpha = part.getchannel("A").point(lambda value: 0 if value < 36 else value)
            if character != "bunbo":
                alpha = clean_alpha(alpha)
            bbox = alpha.point(lambda value: 255 if value >= 120 else 0).getbbox()
            if bbox is None:
                raise ValueError(f"Missing {name}")
            left, top, right, bottom = bbox
            part.putalpha(alpha)
            part = part.crop((max(0, left - 4), max(0, top - 4),
                              min(part.width, right + 4), min(part.height, bottom + 4)))
            angle = ROTATIONS.get(character, {}).get(name, 0)
            if angle:
                part = part.rotate(angle, Image.Resampling.BICUBIC, expand=True)
                part = part.crop(part.getchannel("A").getbbox())
            part.thumbnail((CELL - 8, CELL - 8), Image.Resampling.LANCZOS)
            x, y = col * CELL + 4, row * CELL + 4
            atlas.paste(part, (x, y))
            regions[name] = [x, y, part.width, part.height]
    atlas.save(directory / "parts.webp", lossless=True, method=6)
    (directory / "regions.json").write_text(json.dumps(regions, indent=2) + "\n", encoding="utf-8")


def export(output, character):
    directory = ROOT / character
    images = output / "images"
    images.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(directory / f"{character}.json", output / f"{character}.json")
    regions = json.loads((directory / "regions.json").read_text(encoding="utf-8"))
    with Image.open(directory / "parts.webp") as atlas:
        for name, (x, y, width, height) in regions.items():
            atlas.crop((x, y, x + width, y + height)).save(images / f"{name}.png")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--character", choices=("bunbo", *ROTATIONS), default="bunbo")
    options = parser.add_mutually_exclusive_group(required=True)
    options.add_argument("--pack", type=Path, metavar="SHEET")
    options.add_argument("--export", type=Path, metavar="DIRECTORY")
    args = parser.parse_args()
    pack(args.pack, args.character) if args.pack else export(args.export, args.character)
