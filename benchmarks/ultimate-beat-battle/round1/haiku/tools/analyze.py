#!/usr/bin/env python3
"""Per-bar analysis for an IDLE HYMN render (diagnostic, not a judge).

Reads the master WAV and the stems written by `daemonv12 render --stems` and
prints, per bar of the 12-bar form: RMS and peak (dBFS), share of energy below
120 Hz, share above 4 kHz, the fraction of time that is near-silent, and the
spectral centroid. Also reports full-scale sample counts.

Usage: python3 analyze.py <render-dir>   (expects project.wav, project.stems/)
"""
import glob
import json
import os
import sys
import wave

import numpy as np

BPM = 100
BAR_SEC = 4 * 60 / BPM          # 2.4 s
BARS = 12


def read_wav(path):
    with wave.open(path, 'rb') as w:
        sr = w.getframerate()
        ch = w.getnchannels()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float64) / 32768.0
    if ch == 2:
        data = data.reshape(-1, 2)
    return data, sr


def db(x):
    return 20 * np.log10(max(x, 1e-9))


def bar_metrics(x, sr):
    mono = x.mean(axis=1) if x.ndim == 2 else x
    rows = []
    spec_freqs = np.fft.rfftfreq(int(BAR_SEC * sr), 1 / sr)
    for b in range(BARS):
        s = int(round(b * BAR_SEC * sr))
        e = int(round((b + 1) * BAR_SEC * sr))
        seg = x[s:e] if x.ndim == 2 else x[s:e]
        m = mono[s:e]
        rms = float(np.sqrt(np.mean(seg ** 2)))
        peak = float(np.max(np.abs(seg)))
        spec = np.abs(np.fft.rfft(m * np.hanning(len(m)), n=len(m))) ** 2
        total = float(np.sum(spec)) + 1e-12
        low = float(np.sum(spec[spec_freqs < 120])) / total
        high = float(np.sum(spec[spec_freqs > 4000])) / total
        centroid = float(np.sum(spec_freqs * spec) / total)
        quiet = float(np.mean(np.abs(m) < 10 ** (-60 / 20)))
        rows.append({
            'bar': b + 1,
            'rmsDbfs': round(db(rms), 2),
            'peakDbfs': round(db(peak), 2),
            'lowShare120Hz': round(low, 3),
            'highShare4kHz': round(high, 3),
            'centroidHz': round(centroid, 1),
            'nearSilentFraction': round(quiet, 3),
        })
    return rows


def main():
    root = sys.argv[1]
    master, sr = read_wav(os.path.join(root, 'project.wav'))
    report = {
        'sampleRate': sr,
        'masterFullScaleSamples': int(np.sum(np.abs(master) >= 32767 / 32768)),
        'masterPeakDbfs': round(db(np.max(np.abs(master))), 3),
        'master': bar_metrics(master, sr),
        'stems': {},
    }
    for path in sorted(glob.glob(os.path.join(root, 'project.stems', '*.wav'))):
        stem, _ = read_wav(path)
        name = os.path.splitext(os.path.basename(path))[0]
        rows = bar_metrics(stem, sr)
        report['stems'][name] = [{'bar': r['bar'], 'rmsDbfs': r['rmsDbfs'], 'peakDbfs': r['peakDbfs']} for r in rows]
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
