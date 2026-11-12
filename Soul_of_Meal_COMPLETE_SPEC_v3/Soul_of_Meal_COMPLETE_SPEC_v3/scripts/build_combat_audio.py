#!/usr/bin/env python3
"""Synthesize original combat and movement cues for Soul of Meal."""
import math
import random

from build_element_sfx import VOICES
from build_music import OUT, RATE, TAU, write_ogg


def ultimate(voice, seed):
    base, partials, sweep, noise_mix, smoothing = voice
    randomizer = random.Random(seed)
    noise = phase = 0.0
    samples = []
    duration = .94
    for index in range(round(duration * RATE)):
        time = index / RATE
        position = time / duration
        charge = min(1, time / .10) * (1 - position) ** 1.3
        phase += TAU / RATE * base * (1 + (sweep - .3) * position ** 1.4)
        noise = smoothing * noise + (1 - smoothing) * randomizer.uniform(-1, 1)
        tone = sum(math.sin(phase * partial) / (order + 1.4) for order, partial in enumerate(partials))
        accent = max(0, time - .19)
        shimmer = math.sin(TAU * base * 3 * accent) * min(1, accent * 36) * math.exp(-accent * 7)
        samples.append(.41 * charge * (tone * (1 - noise_mix) + noise * noise_mix + .27 * shimmer))
    return samples


def step(seed, leaves):
    randomizer = random.Random(seed)
    noise = 0.0
    samples = []
    for index in range(round(.18 * RATE)):
        time = index / RATE
        envelope = min(1, time * 380) * math.exp(-time * 27)
        grain = randomizer.uniform(-1, 1)
        noise = .83 * noise + .17 * grain
        scuff = (grain - noise) * math.exp(-((time - .036) / .018) ** 2)
        thud = math.sin(TAU * (93 + seed % 23) * time) * math.exp(-time * 21)
        samples.append(envelope * (thud * (.12 if leaves else .27) + noise * .30 + scuff * (.28 if leaves else .07)))
    return samples


def chime(notes, duration, strike, seed):
    randomizer = random.Random(seed)
    samples = []
    for index in range(round(duration * RATE)):
        time = index / RATE
        value = 0.0
        for order, pitch in enumerate(notes):
            age = time - order * duration / (len(notes) + 2)
            if age >= 0:
                phase = TAU * pitch * age
                envelope = min(1, age * 220) * math.exp(-age * (7 + 14 * strike))
                value += envelope * (math.sin(phase) + .26 * math.sin(phase * (2 + strike)))
        grain = randomizer.uniform(-1, 1) * strike * math.exp(-time * 48)
        samples.append(.24 * (value + grain) * min(1, (duration - time) * 28))
    return samples


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for index, (element, voice) in enumerate(VOICES.items()):
        write_ogg(f"sfx_element_{element}_ultimate", ultimate(voice, 380 + index))
    write_ogg("sfx_footstep_stone_b", step(24, False))
    write_ogg("sfx_footstep_leaves_a", step(54, True))
    write_ogg("sfx_footstep_leaves_b", step(57, True))
    write_ogg("sfx_guard_contact", chime((254, 396), .22, .72, 41))
    write_ogg("sfx_skill_ready", chime((523, 659, 784), .39, .04, 11))
    write_ogg("sfx_boss_warning", chime((82, 72, 96), .72, .30, 15))
    write_ogg("sfx_boss_break", chime((420, 298, 592), .43, .83, 19))
