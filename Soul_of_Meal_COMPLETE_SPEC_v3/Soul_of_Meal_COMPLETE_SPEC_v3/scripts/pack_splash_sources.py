#!/usr/bin/env python3
"""Package original splash bytes for reproducible materialization by npm/Vite."""
import base64
import gzip
import hashlib
import io
import json
import sys
from pathlib import Path


def pack_sources(root, target_bytes=4_000_000):
    assets = root / 'client/assets/splash'
    destination = root / 'client/source-art/splash'
    destination.mkdir(parents=True, exist_ok=True)
    files = sorted(assets.rglob('*.webp'))
    if len(files) != 160:
        raise ValueError(f'Expected 160 HD/preview files; found {len(files)}')
    manifest = {'schema': 1, 'packs': [], 'files': []}
    entries, current_bytes = [], 0

    def flush():
        if not entries:
            return
        payload = json.dumps({'schema': 1, 'entries': entries}, separators=(',', ':')).encode()
        output = io.BytesIO()
        with gzip.GzipFile(fileobj=output, mode='wb', filename='', mtime=0) as archive:
            archive.write(payload)
        content = output.getvalue()
        name = f'splash-{len(manifest["packs"]) + 1:03}.json.gz'
        (destination / name).write_bytes(content)
        manifest['packs'].append({'file': name, 'bytes': len(content),
                                  'sha256': hashlib.sha256(content).hexdigest(), 'entries': len(entries)})
        entries.clear()

    for file in files:
        content = file.read_bytes()
        if entries and current_bytes + len(content) > target_bytes:
            flush()
            current_bytes = 0
        path = file.relative_to(assets).as_posix()
        manifest['files'].append({'path': path, 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()})
        entries.append({'path': path, 'content': base64.b64encode(content).decode('ascii')})
        current_bytes += len(content)
    flush()
    keep = {pack['file'] for pack in manifest['packs']}
    for old in destination.glob('splash-*.json.gz'):
        if old.name not in keep:
            old.unlink()
    (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf8')
    return manifest


if __name__ == '__main__':
    result = pack_sources(Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1])
    print(f'Packed {len(result["files"])} images into {len(result["packs"])} source packs.')
