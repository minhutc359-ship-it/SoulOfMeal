#!/usr/bin/env python3
"""Stage a Vite build and atomically activate a complete, immutable release."""
import argparse
import errno
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
from tempfile import NamedTemporaryFile, TemporaryDirectory

PROJECT = Path(__file__).resolve().parents[1]
MARKER = "release-build.json"


def build_id(source):
    if not all((source / name).is_file() for name in (
        "client/index.html", "examples/cards/cards.catalog.json", "examples/maps/village.json",
    )):
        raise ValueError("Expected a complete Soul of Meal Vite build")
    digest = hashlib.sha256()
    for path in sorted(source.rglob("*")):
        relative = path.relative_to(source).as_posix()
        if path.is_symlink():
            raise ValueError(f"Symlinks are unsupported in a release: {relative}")
        if path.is_file() and relative != MARKER:
            digest.update(relative.encode("utf-8") + b"\0")
            digest.update(hashlib.sha256(path.read_bytes()).digest())
    return digest.hexdigest()[:32]


def atomic_write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(dir=path.parent, delete=False) as temporary:
        staged = Path(temporary.name)
        try:
            temporary.write(content)
            temporary.flush()
            staged.chmod(0o644)
            staged.replace(path)
        finally:
            staged.unlink(missing_ok=True)


def activate(root, version):
    if not re.fullmatch(r"[0-9a-f]{32}", version):
        raise ValueError("Invalid release ID")
    release = root / "releases" / version
    marker = json.loads((release / MARKER).read_text(encoding="utf-8"))
    if marker != {"schema": 1, "build": version} or build_id(release) != version:
        raise ValueError(f"Release {version} is incomplete or modified")
    atomic_write(root / "release.json", (json.dumps(marker) + "\n").encode("utf-8"))
    return version


def publish(source, root):
    source = source.resolve()
    root = root.resolve()
    if source == root or source in root.parents or root in source.parents:
        raise ValueError("Build and publication directories must be separate")
    versions = root / "releases"
    versions.mkdir(parents=True, exist_ok=True)
    version = build_id(source)
    release = versions / version
    if not release.exists():
        with TemporaryDirectory(dir=versions) as staging:
            staged = Path(staging) / "build"
            shutil.copytree(source, staged)
            if build_id(staged) != version:
                raise ValueError("Vite build changed during publication")
            (staged / MARKER).write_text(json.dumps({"schema": 1, "build": version}) + "\n", encoding="utf-8")
            try:
                os.rename(staged, release)
            except OSError as error:
                if error.errno not in {errno.EEXIST, errno.ENOTEMPTY}:
                    raise
    launcher = PROJECT / "client/release-launcher"
    for name in ("launcher.css", "launcher.js", "index.html"):
        atomic_write(root / "client" / name, (launcher / name).read_bytes())
    atomic_write(root / "client/contentRelease.js", (PROJECT / "client/src/core/contentRelease.js").read_bytes())
    return activate(root, version)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    upload = commands.add_parser("publish")
    upload.add_argument("source", type=Path)
    upload.add_argument("root", type=Path)
    switch = commands.add_parser("activate")
    switch.add_argument("version")
    switch.add_argument("root", type=Path)
    args = parser.parse_args()
    if args.command == "publish":
        print(publish(args.source, args.root))
    else:
        print(activate(args.root, args.version))
