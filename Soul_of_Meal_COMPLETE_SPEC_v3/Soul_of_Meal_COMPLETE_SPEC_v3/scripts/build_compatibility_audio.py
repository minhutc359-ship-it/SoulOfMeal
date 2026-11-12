#!/usr/bin/env python3
"""Build the optional MP3 bundle used when the browser cannot decode Ogg Vorbis."""
import json
from pathlib import Path
import struct
import subprocess

AUDIO = Path(__file__).resolve().parents[1] / "client/assets/audio"

index = {}
payload = bytearray()
for source in sorted(AUDIO.glob("*.ogg")):
    encoded = subprocess.check_output([
        "ffmpeg", "-v", "error", "-i", str(source), "-map_metadata", "-1",
        "-ac", "1", "-ar", "24000", "-b:a", "32k", "-codec:a", "libmp3lame",
        "-write_xing", "0", "-id3v2_version", "0", "-f", "mp3", "pipe:1",
    ])
    index[source.name] = [len(payload), len(encoded)]
    payload.extend(encoded)

header = json.dumps(index, separators=(",", ":")).encode("utf-8")
(AUDIO / "compatibility.bin").write_bytes(struct.pack("<I", len(header)) + header + payload)
