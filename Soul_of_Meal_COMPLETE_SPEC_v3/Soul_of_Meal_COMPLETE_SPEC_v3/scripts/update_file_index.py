#!/usr/bin/env python3
"""Refresh FILE_INDEX.json sizes and SHA-256 digests for package files."""

import hashlib
import json
import sys
from pathlib import Path


def update_index(root: Path) -> int:
    manifest_path = root / "FILE_INDEX.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entries = manifest["files"]
    by_path = {entry["path"]: entry for entry in entries}

    package_files = sorted(
        path
        for path in root.rglob("*")
        if path.is_file()
        and path != manifest_path
        and "__pycache__" not in path.parts
        and ".git" not in path.parts
        and path.relative_to(root).parts[:2] not in {("client", "node_modules"), ("client", "dist")}
    )
    for path in package_files:
        relative = path.relative_to(root).as_posix()
        content = path.read_bytes()
        entry = by_path.get(relative)
        if entry is None:
            entry = {"path": relative, "bytes": 0, "sha256": ""}
            entries.append(entry)
            by_path[relative] = entry
        entry["bytes"] = len(content)
        entry["sha256"] = hashlib.sha256(content).hexdigest()

    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return len(entries)


if __name__ == "__main__":
    package_root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
    print(f"Updated {update_index(package_root)} indexed files.")