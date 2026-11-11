#!/usr/bin/env python3
"""Synthesize original loopable music and ambience for the browser playtest."""
from array import array
import math
from pathlib import Path
import random
import subprocess

RATE = 24000
TAU = math.tau
OUT = Path("client/assets/audio")
MELODIES = {
    "village_theme": (0.48, (50, 55, 47, 48), (74, 76, 79, 81, 79, 76, 74, 69, 72, 74, 76, 79, 76, 74, 72, 69)),
    "forest_theme": (0.60, (45, 48, 43, 47), (69, 72, 74, 76, 74, 72, 69, 67, 67, 69, 72, 76, 74, 72, 69, 64)),
    "battle_theme": (0.32, (45, 41, 43, 40), (69, 76, 74, 72, 69, 72, 76, 79, 74, 76, 77, 76, 74, 72, 71, 67)),
}


def pluck(mix, midi, start, duration, level, bright):
    frequency = 440 * 2 ** ((midi - 69) / 12)
    offset = round(start * RATE)
    for index in range(round(duration * RATE)):
        time = index / RATE
        phase = TAU * frequency * time
        envelope = min(1, time * 135) * math.exp(-time * (5 if bright else 3))
        tone = math.sin(phase) + .28 * math.sin(2 * phase + .18 * math.sin(phase))
        if bright:
            tone += .16 * math.sin(3 * phase) * math.exp(-time * 9)
        mix[(offset + index) % len(mix)] += tone * level * envelope


def write_ogg(name, mix):
    samples = array("h", (int(max(-1, min(1, sample)) * 32767) for sample in mix))
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(RATE),
         "-ac", "1", "-i", "-", "-c:a", "libvorbis", "-q:a", "3", str(OUT / (name + ".ogg"))],
        input=samples.tobytes(), check=True,
    )


def music(name, beat, bass, melody):
    mix = [0.0] * round(beat * 32 * RATE)
    for measure in range(8):
        root = bass[measure % len(bass)]
        for step, interval in enumerate((0, 7, 12, 7)):
            pluck(mix, root + interval, (measure * 4 + step) * beat, beat * 1.9, .16, False)
    for index, note in enumerate(melody * 2):
        start = index * beat + (0.12 * beat if index % 4 == 2 else 0)
        pluck(mix, note, start, beat * 2.3, .18 if index % 4 else .24, True)
        pluck(mix, note, start + beat * .66, beat * 1.8, .045, True)
        if name == "battle_theme" and index % 2 == 0:
            pluck(mix, 32 + (index % 4), start, beat, .20, False)
    write_ogg(name, mix)


def wind():
    randomizer = random.Random(72)
    noise = [0.0] * (RATE * 8)
    smooth = 0.0
    for index in range(len(noise)):
        smooth = .94 * smooth + .06 * randomizer.uniform(-1, 1)
        cycle = TAU * index / len(noise)
        volume = .14 * (1 - math.cos(cycle))
        noise[index] = smooth * volume * (1 + .28 * math.sin(cycle * 3))
    write_ogg("forest_wind", noise)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, arguments in MELODIES.items():
        music(name, *arguments)
    wind()
