#!/usr/bin/env python3
"""Import validated Bún Bò Golden Sample frames as compact browser atlases."""
import argparse
from io import BytesIO
import json
from pathlib import Path
from zipfile import ZipFile

from PIL import Image


def pack(archive, root, output, asset_id, animations, character_id):
    is_hero = character_id == "chr_bunbo_holinh"
    size = 100 if is_hero else 128
    stride, columns = size + 4, 15
    frames = {}
    clips = {}
    for clip_id, clip in animations.items():
        directions = {}
        for direction, variant in clip["directions"].items():
            ids = [Path(path).stem for path in variant["frames"]]
            frames.update(zip(ids, variant["frames"]))
            directions[direction] = {
                "frames": ids,
                "anchor_normalized": variant["ground_anchor"],
                "events": [
                    {"frame": event["frame"], "name": event["type"]}
                    for event in clip.get("events", []) if event["frame"] < len(ids)
                ],
            }
        clips[clip_id] = {"fps": clip["fps"], "loop": clip["loop"], "directions": directions}

    rows = (len(frames) + columns - 1) // columns
    if rows > 15:
        raise ValueError("Atlas exceeds 2048 pixels")
    atlas = Image.new("RGBA", (min(columns, len(frames)) * stride, rows * stride))
    rects = {}
    for index, (frame_id, path) in enumerate(frames.items()):
        with Image.open(BytesIO(archive.read(root + path))) as source:
            if source.mode != "RGBA" or source.getextrema()[3][0] != 0:
                raise ValueError(f"Frame has no transparent pixels: {path}")
            frame = source.resize((size, size), Image.Resampling.LANCZOS)
        x, y = (index % columns) * stride + 2, (index // columns) * stride + 2
        atlas.paste(frame, (x, y))
        rects[frame_id] = {"x": x, "y": y, "w": size, "h": size}

    atlas.save(output / f"{asset_id}.webp", quality=72 if is_hero else 85, method=6)
    manifest = {
        "schema_version": 1, "character_id": character_id, "skin_id": "default",
        "asset_version": "golden-1.0", "atlas": f"{asset_id}.webp",
        "render_scale": 1.55 * 128 / size if is_hero else 1,
        "frames": rects, "clips": clips,
    }
    (output / f"{asset_id}.json").write_text(json.dumps(manifest, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--assets", type=Path, default=Path("client/assets"))
    args = parser.parse_args()
    output = args.assets / "golden"
    audio = args.assets / "audio"
    output.mkdir(parents=True, exist_ok=True)
    audio.mkdir(parents=True, exist_ok=True)
    with ZipFile(args.archive) as archive:
        suffix = "manifests/character.sprite.json"
        manifest_path = next(path for path in archive.namelist() if path.endswith(suffix))
        root = manifest_path.removesuffix(suffix)
        character = json.loads(archive.read(manifest_path))
        animations = {("defeat" if key == "ko" else key): value for key, value in character["animations"].items()}
        pack(archive, root, output, "bunbo", animations, character["character_id"])
        effects = json.loads(archive.read(root + "manifests/vfx.fire.json"))["vfx"]
        animations = {
            key.removeprefix("vfx_fire_"): {
                "fps": item["fps"], "loop": item["loop"],
                "directions": {"E": {"frames": item["frames"], "ground_anchor": item["anchor"]}},
            }
            for key, item in effects.items()
        }
        pack(archive, root, output, "fire", animations, "vfx_fire")
        for path in archive.namelist():
            if path.startswith(root + "assets/audio/sfx/fire/") and path.endswith(".ogg"):
                (audio / Path(path).name).write_bytes(archive.read(path))


if __name__ == "__main__":
    main()
