#!/usr/bin/env python3
"""Pitch-track a monophonic stem (YIN-style difference function) and compare with intended notes.

usage: pitch_check.py <stem.wav> <notes.json>
notes.json: [{"t": seconds, "d": seconds, "midi": n, "label": "..."}]  (absolute times in the stem)
For each note, the median detected pitch over its middle 50 % is compared with the written pitch (cents).
Evidence that the synthesis plays what the score says; not a judgment of musical quality.
"""
import sys, json, wave
import numpy as np

def read_mono(path):
    with wave.open(path, 'rb') as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float64).reshape(-1, w.getnchannels())
        return x.mean(axis=1) / 32768.0, w.getframerate()

def yin(frame, fs, fmin=150, fmax=1400, th=0.15):
    n = len(frame) // 2; tmin, tmax = int(fs / fmax), int(fs / fmin)
    d = np.array([np.sum((frame[:n] - frame[t:t + n]) ** 2) for t in range(tmax + 2)])
    cm = np.ones_like(d); cm[1:] = d[1:] * np.arange(1, len(d)) / np.maximum(1e-12, np.cumsum(d[1:]))
    for t in range(tmin, tmax):
        if cm[t] < th and cm[t] <= cm[t + 1]:
            a, b, c = cm[t - 1], cm[t], cm[t + 1]; den = a - 2 * b + c
            return fs / (t + (0.5 * (a - c) / den if den != 0 else 0))
    return None

def main():
    x, fs = read_mono(sys.argv[1]); notes = json.load(open(sys.argv[2]))
    print('%-10s %6s %6s %8s' % ('note', 'start', 'midi', 'cents'))
    worst = 0
    for nt in notes:
        a, b = nt['t'] + nt['d'] * 0.25, nt['t'] + nt['d'] * 0.75
        f0s = []
        for c in np.arange(a, b, 0.01):
            i = int(c * fs); fr = x[i:i + 2048]
            if len(fr) < 2048 or np.sqrt(np.mean(fr ** 2)) < 1e-3: continue
            f = yin(fr, fs)
            if f: f0s.append(69 + 12 * np.log2(f / 440))
        if not f0s: print('%-10s %6.2f %6d %8s' % (nt['label'], nt['t'], nt['midi'], 'n/a')); continue
        dev = (np.median(f0s) - nt['midi']) * 100; worst = max(worst, abs(dev))
        print('%-10s %6.2f %6d %+8.1f' % (nt['label'], nt['t'], nt['midi'], dev))
    print('max |deviation| %.1f cents over %d notes' % (worst, len(notes)))

if __name__ == '__main__':
    main()
