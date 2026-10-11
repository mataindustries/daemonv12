#!/usr/bin/env python3
"""Deterministic benchmark-local sound generator for the Round 1 open-class submission.

Writes two custom one-shots under ../assets/tine/:

  tine-hook.wav  metal tine, native pitch A4 (440 Hz), short ring (~1.4 s)
  tine-bass.wav  metal tine, native pitch A2 (110 Hz), short ring (~0.9 s)

Both are pure additive synthesis with inharmonic bar-like partial ratios, a
seeded noise click for the strike, and a 1.5 ms fade-in. There are no external
recordings. Re-running this script on the same platform reproduces the same
bytes; the SHA-256 values are recorded in ../assets/MANIFEST.json.
"""
import os
import wave

import numpy as np

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.normpath(os.path.join(HERE, '..', 'assets', 'tine'))


def strike(f0, ratios, amps, taus, dur, click_amp, click_tau, seed, peak):
    n = int(round(dur * SR))
    t = np.arange(n) / SR
    y = np.zeros(n)
    for r, a, tau in zip(ratios, amps, taus):
        y += a * np.sin(2 * np.pi * f0 * r * t) * np.exp(-t / tau)
    # Seeded strike click: a short noise burst, smoothed to remove the hiss.
    rng = np.random.default_rng(seed)
    click = rng.standard_normal(n) * np.exp(-t / click_tau)
    kernel = np.ones(6) / 6
    click = np.convolve(click, kernel, mode='same')
    y += click_amp * click / (np.max(np.abs(click)) + 1e-12)
    fade = np.minimum(1.0, t / 0.0015)
    y *= fade
    y = y / (np.max(np.abs(y)) + 1e-12) * peak
    return y


def write_wav(path, y):
    pcm = np.clip(np.round(y * 32767), -32768, 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    # The hook keeps a bright upper-partial tail (12.7x) so the top end is not dead.
    hook = strike(
        f0=440.0,
        ratios=[1.0, 2.76, 5.40, 8.93, 12.7],
        amps=[1.0, 0.45, 0.30, 0.20, 0.14],
        taus=[0.30, 0.16, 0.09, 0.05, 0.05],
        dur=1.4, click_amp=0.25, click_tau=0.004, seed=11, peak=0.62,
    )
    bass = strike(
        f0=110.0,
        ratios=[1.0, 2.0, 2.76, 5.40],
        amps=[1.0, 0.30, 0.25, 0.08],
        taus=[0.26, 0.14, 0.08, 0.03],
        dur=0.9, click_amp=0.35, click_tau=0.003, seed=23, peak=0.70,
    )
    write_wav(os.path.join(OUT_DIR, 'tine-hook.wav'), hook)
    write_wav(os.path.join(OUT_DIR, 'tine-bass.wav'), bass)
    print('wrote', os.path.join(OUT_DIR, 'tine-hook.wav'))
    print('wrote', os.path.join(OUT_DIR, 'tine-bass.wav'))


if __name__ == '__main__':
    main()
