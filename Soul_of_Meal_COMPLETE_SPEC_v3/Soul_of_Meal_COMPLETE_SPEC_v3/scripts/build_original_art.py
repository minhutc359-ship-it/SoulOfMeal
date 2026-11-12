#!/usr/bin/env python3
"""Extract fresh Soul of Meal art into runtime WebP and strict RGBA source frames."""

import argparse
import hashlib
import json
import runpy
from pathlib import Path

from PIL import Image, ImageOps

HEROES = {
    "bunbo": "chr_bunbo_holinh",
    "pho": "chr_pho_lamvu",
    "goicuon": "chr_goicuon_diepnhi",
    "banhbao": "chr_banhbao_bachngoc",
    "caphe": "chr_caphe_davu",
}
BOSS = "boss_bep_truong"
MONSTERS = ("mob_mushroom_01", "mob_pepper_01")
STANDALONE_PROPS = {"boss_stove": 208, "empty_bowl_seal": 320, "tidal_conch": 320, "hollow_cauldron": 448}
ACTORS = ("npc_lilia", "mob_mushroom_01", "mob_pepper_01", BOSS)
COMBAT_EFFECTS = ("boss_warning", "boss_cleave", "shield_bubble", "shield_break")
PROPS = (
    "house_kitchen", "house_guild", "house_merchant", "tree",
    "chest_closed", "chest_open", "portal", "table",
)
ELEMENTS = ("fire", "water", "wood", "light", "shadow")
SCENES = ("home", "village", "forest", "arena", "harbor", "caldera", "sanctum", "tcg_table", "chess_court")
CARD_ART = tuple(f"card_demo_{index:02d}" for index in (7, *range(10, 19)))
DIRECTIONS = ("N", "E", "S", "W")
CLIPS = {
    "idle": ((0, 7), 3, True),
    "walk": ((1, 2), 7, True),
    "run": ((1, 2), 10, True),
    "attack_a": ((3, 4, 0), 9, False),
    "attack_b": ((3, 4, 7, 0), 10, False),
    "skill_01": ((3, 4, 6, 0), 9, False),
    "ultimate_01": ((3, 6, 4, 7), 6, False),
    "hit": ((5, 0), 8, False),
    "defeat": ((5,), 2, True),
    "victory": ((7, 0), 3, True),
}
BOSS_CLIPS = {
    "idle": ((0,), 1, True),
    "walk": ((1, 0, 2), 8, True),
    "run": ((1, 2), 10, True),
    "attack_a": ((3, 4, 0), 8, False),
    "attack_b": ((5, 4, 0), 8, False),
    "skill_01": ((3, 5), 1.5, False),
    "boss_release": ((4, 0), 5, False),
    "hit": ((6, 0), 8, False),
    "defeat": ((7,), 1, True),
}
MONSTER_CLIPS = {
    "idle": ((0, 7), 3, True),
    "walk": ((1, 0, 2), 8, True),
    "run": ((1, 2), 11, True),
    "attack_a": ((3, 4, 0), 9, False),
    "attack_b": ((3, 4, 7), 9, False),
    "hit": ((5, 0), 8, False),
    "defeat": ((6,), 2, True),
}
FRAME_SIZE = 256
ATLAS_FRAME = 160
GROUND = 230


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def alpha_bounds(image):
    alpha = image.getchannel("A")
    if alpha.getextrema()[0] > 20:
        raise ValueError("Image has no transparent pixels")
    bounds = alpha.point(lambda value: 255 if value > 20 else 0).getbbox()
    if not bounds:
        raise ValueError("Empty transparent cell")
    return bounds


def seams(mask, divisions, vertical=False):
    """Find the gutters near the intended grid, keeping ink out of cell edges."""
    length = mask.width if vertical else mask.height
    if divisions == 1:
        return [0, length]
    lines = [
        mask.crop((index, 0, index + 1, mask.height) if vertical else (0, index, mask.width, index + 1)).histogram()[255]
        for index in range(length)
    ]
    step = length / divisions
    splits = [0]
    for i in range(1, divisions):
        nominal = round(i * step)
        search = range(max(3, nominal - round(step * .34)), min(length - 3, nominal + round(step * .34)) + 1)
        splits.append(min(search, key=lambda value: (sum(lines[value - 2:value + 3]), abs(value - nominal))))
    return [*splits, length]


def cells(path, columns, rows):
    with Image.open(path) as sheet:
        if sheet.mode != "RGBA":
            raise ValueError(f"Expected transparent RGBA art: {path}")
        mask = sheet.getchannel("A").point(lambda value: 255 if value > 52 else 0)
        y_edges = seams(mask, rows)
        result = []
        for top, bottom in zip(y_edges, y_edges[1:]):
            x_edges = seams(mask.crop((0, top, sheet.width, bottom)), columns, vertical=True)
            result.extend(sheet.crop((left, top, right, bottom)) for left, right in zip(x_edges, x_edges[1:]))
        return result


def frame_set(images):
    bounds = [alpha_bounds(image) for image in images]
    widest = max(right - left for left, _, right, _ in bounds)
    tallest = max(bottom - top for _, top, _, bottom in bounds)
    ratio = min(212 / widest, 203 / tallest)
    frames = []
    for image, box in zip(images, bounds):
        subject = image.crop(box)
        subject = subject.resize(
            (round(subject.width * ratio), round(subject.height * ratio)),
            Image.Resampling.LANCZOS,
        )
        frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE))
        frame.paste(subject, ((FRAME_SIZE - subject.width) // 2, GROUND - subject.height))
        frames.append(frame)
    return frames


def export_cutout(path, image, max_size, quality=83):
    subject = image.crop(alpha_bounds(image))
    subject.thumbnail(max_size, Image.Resampling.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    subject.save(path, quality=quality, method=6)


def export_atlas(path, frames):
    columns = 4
    stride = ATLAS_FRAME + 4
    rows = (len(frames) + columns - 1) // columns
    atlas = Image.new("RGBA", (columns * stride, rows * stride))
    coordinates = {}
    for index, (frame_id, frame) in enumerate(frames.items()):
        x, y = index % columns * stride + 2, index // columns * stride + 2
        atlas.paste(frame.resize((ATLAS_FRAME, ATLAS_FRAME), Image.Resampling.LANCZOS), (x, y))
        coordinates[frame_id] = {"x": x, "y": y, "w": ATLAS_FRAME, "h": ATLAS_FRAME}
    path.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(path, quality=83, method=6)
    return coordinates


def clip(frames, fps, loop, direction):
    return {
        "fps": fps,
        "loop": loop,
        "directions": {direction: {"frames": frames, "anchor_normalized": [.5, GROUND / FRAME_SIZE]}},
    }


def export_character(source, assets, character_id, travel=False):
    images = cells(source, 4, 3 if travel else 2)
    frames = frame_set(images)
    visual_id = character_id + "_travel" if travel else character_id
    source_root = assets / "characters" / character_id / ("original_travel" if travel else "original_battle")
    frame_dir = source_root / "poses"
    frame_dir.mkdir(parents=True, exist_ok=True)
    frame_ids = [f"{visual_id}_pose_{index:02d}" for index in range(len(frames))]
    for frame_id, frame in zip(frame_ids, frames):
        frame.save(frame_dir / f"{frame_id}.png", optimize=True)

    if travel:
        source_directions = {
            direction: {"frames": [f"poses/{frame_ids[index]}.png" for index in (i, i + 4, i + 8)]}
            for i, direction in enumerate(DIRECTIONS)
        }
        runtime_clips = {}
        for clip_id, indexes, fps in (("idle", (0,), 1), ("walk", (1, 0, 2), 8), ("run", (1, 0, 2), 12)):
            runtime_clips[clip_id] = {
                "fps": fps, "loop": True,
                "directions": {
                    direction: {
                        "frames": [frame_ids[index * 4 + i] for index in indexes],
                        "anchor_normalized": [.5, GROUND / FRAME_SIZE],
                    }
                    for i, direction in enumerate(DIRECTIONS)
                },
            }
    else:
        facing = "W" if character_id == BOSS or character_id in MONSTERS else "E"
        clips = BOSS_CLIPS if character_id == BOSS else MONSTER_CLIPS if character_id in MONSTERS else CLIPS
        source_directions = {facing: {"frames": [f"poses/{frame_id}.png" for frame_id in frame_ids]}}
        runtime_clips = {
            name: clip([frame_ids[index] for index in indexes], fps, loop, facing)
            for name, (indexes, fps, loop) in clips.items()
        }
        if character_id != BOSS and character_id not in MONSTERS:
            export_cutout(assets / "original" / "actors" / f"{character_id}.webp", images[0], (330, 330))
            export_cutout(assets / "original" / "cutins" / f"{character_id}.webp", images[6], (470, 470), 87)

    identity = {}
    if character_id in MONSTERS:
        identity = {
            "identity_reference": f"original/actors/{character_id}.webp",
            "clip_review": "pending",
            "authored_facing": "W",
            "opposite_facing": "mirrored_playtest",
            "runtime_clips": runtime_clips,
        }

    source_manifest = {
        "character_id": character_id,
        "skin_id": "default",
        "frame_size_px": [FRAME_SIZE, FRAME_SIZE],
        "source_sheet_sha256": sha256(source),
        "ground_anchor": [.5, GROUND / FRAME_SIZE],
        "rights_status": "pending_review",
        "identity_review": "pending",
        "animations": {"keyposes": {"fps": 8, "loop": False, "directions": source_directions}},
        **identity,
    }
    manifest_path = source_root / "source.sprite.json"
    write_json(manifest_path, source_manifest)
    validator = runpy.run_path(str(Path(__file__).resolve().parents[1] / ".agents/skills/soul-of-meal-sprite/scripts/validate_sprite.py"))
    report = validator["validate"](manifest_path, source_root, strict=True)
    write_json(source_root / "qa.json", report)
    if not report["pass"]:
        raise ValueError(f"Sprite validation failed: {report['errors']}")

    atlas_path = assets / "original" / "atlases" / f"{visual_id}.webp"
    coordinates = export_atlas(atlas_path, dict(zip(frame_ids, frames)))
    write_json(atlas_path.with_suffix(".json"), {
        "schema_version": 1,
        "character_id": visual_id,
        "skin_id": "default",
        "asset_version": "original-chibi-preview-1",
        "atlas": atlas_path.name,
        "frames": coordinates,
        "clips": runtime_clips,
        **({"mirror_east_west": True} if character_id in MONSTERS else {}),
    })


def export_art(sources, assets, selection):
    for source_id in selection:
        source = sources / f"{source_id}.png"
        if source_id in HEROES or source_id == "travel":
            export_character(source, assets, HEROES[source_id] if source_id in HEROES else HEROES["bunbo"], source_id == "travel")
        elif source_id == BOSS or source_id in MONSTERS:
            export_character(source, assets, source_id)
        elif source_id in STANDALONE_PROPS:
            size = STANDALONE_PROPS[source_id]
            with Image.open(source) as prop:
                export_cutout(assets / "original" / "props" / f"{source_id}.webp", prop.convert("RGBA"), (size, size), 86)
        elif source_id == "combat_effects":
            for effect, image in zip(COMBAT_EFFECTS, cells(source, 2, 2)):
                export_cutout(assets / "original" / "effects" / f"{effect}.webp", image, (384, 384), 88)
        elif source_id == "chronicle":
            target = assets / "original" / "chronicle"
            target.mkdir(parents=True, exist_ok=True)
            with Image.open(source) as page:
                if page.width % 3 or page.height % 2:
                    raise ValueError("Expected a chronicle atlas with 3 equal columns and 2 equal rows")
                width, height = page.width // 3, page.height // 2
                for index in range(6):
                    x, y = (index % 3) * width, (index // 3) * height
                    panel = page.crop((x, y, x + width, y + height)).convert("RGB")
                    panel.thumbnail((640, 640), Image.Resampling.LANCZOS)
                    panel.save(target / f"chapter-{index + 1}.webp", quality=84, method=6)
        elif source_id == "extras":
            for actor, image in zip(ACTORS, cells(source, 4, 1)):
                export_cutout(assets / "original" / "actors" / f"{actor}.webp", image, (330, 330))
        elif source_id == "props":
            for prop, image in zip(PROPS, cells(source, 4, 2)):
                export_cutout(assets / "original" / "props" / f"{prop}.webp", image, (264, 264))
        elif source_id == "cards":
            for card, image in zip(CARD_ART, cells(source, 5, 2)):
                export_cutout(assets / "original" / "cards" / f"{card}.webp", image, (244, 244))
        elif source_id == "effects":
            for index, image in enumerate(cells(source, 5, 2)):
                phase = "trail" if index < len(ELEMENTS) else "impact"
                element = ELEMENTS[index % len(ELEMENTS)]
                export_cutout(assets / "original" / "effects" / f"{element}_{phase}.webp", image, (240, 240))
        else:
            path = assets / "original" / "scenes" / f"{source_id}.webp"
            path.parent.mkdir(parents=True, exist_ok=True)
            with Image.open(source) as scene:
                ImageOps.fit(scene.convert("RGB"), (1280, 720), Image.Resampling.LANCZOS).save(path, quality=79, method=6)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sources", type=Path, help="Directory of newly generated source sheets named by asset ID")
    parser.add_argument("--assets", type=Path, default=Path("client/assets"))
    ids = (*HEROES, "travel", "extras", "props", "effects", "cards", *SCENES, "chronicle", BOSS, *MONSTERS, *STANDALONE_PROPS, "combat_effects")
    parser.add_argument("ids", nargs="*", metavar="ASSET_ID")
    args = parser.parse_args()
    unknown = set(args.ids) - set(ids)
    if unknown:
        parser.error(f"unknown asset IDs: {sorted(unknown)}")
    default_ids = tuple(asset_id for asset_id in ids if asset_id not in (BOSS, *MONSTERS, *STANDALONE_PROPS, "combat_effects", "chronicle", "harbor", "caldera", "sanctum", "tcg_table", "chess_court")
                        or (args.sources / f"{asset_id}.png").is_file())
    export_art(args.sources, args.assets, args.ids or default_ids)


if __name__ == "__main__":
    main()
