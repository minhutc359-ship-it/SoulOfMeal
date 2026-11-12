#!/usr/bin/env python3
"""Build original elemental cast and contact sounds for the playtest."""
import math
import random

from build_music import OUT, RATE, TAU, write_ogg

# Hz, overtones, pitch sweep, noise mix, texture.
VOICES = {
    "fire": (156, (1, 2.4, 4.2), 1.6, .59, .25),
    "water": (380, (1, 1.49, 2.05), 1.2, .28, .69),
    "wood": (227, (1, 1.79, 3.45), .88, .48, .43),
    "light": (586, (1, 1.5, 2.01), 1.33, .07, .54),
    "shadow": (96, (1, 2.19, 3.02), .74, .27, .19),
}


def cue(voice, casting, seed):
    base, partials, sweep, noise_mix, smoothing = voice
    duration = .48 if casting else .29
    randomizer = random.Random(seed)
    phase = 0.0
    filtered = 0.0
    samples = []
    for index in range(round(RATE * duration)):
        progress = index / (RATE * duration)
        onset = min(1, index / (RATE * (.055 if casting else .008)))
        envelope = onset * (1 - progress) ** (1.5 if casting else 2.6)
        pitch = base * (1 + (sweep - 1) * (progress if casting else 1 - progress))
        phase += TAU * pitch / RATE
        raw = randomizer.uniform(-1, 1)
        filtered = filtered * smoothing + raw * (1 - smoothing)
        flutter = .85 + .15 * math.sin(TAU * (18 if casting else 31) * index / RATE)
        harmonic = sum(math.sin(phase * partial) / (order + 1.25) for order, partial in enumerate(partials))
        samples.append(.28 * envelope * (harmonic * (1 - noise_mix) + filtered * noise_mix * 1.6) * flutter)
    return samples


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for index, (element, voice) in enumerate(VOICES.items()):
        for casting, phase in ((True, "cast"), (False, "impact")):
            write_ogg(f"sfx_element_{element}_{phase}", cue(voice, casting, 214 + index * 2 + casting))
