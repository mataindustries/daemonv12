#!/usr/bin/env python3
"""MORPH//03 instrument-specific proxy checks on rendered stems. NOT listening results.

Usage:
  node experiments/morph-03/build.mjs --out STEMDIR --stems
  python3 experiments/morph-03/checks.py STEMDIR OUT.json

1  riff tuning: YIN pitch of each riff note (full band, and through the phone-speaker model:
   does the bass line survive with nothing below 300 Hz?)
2  wobble depth: P90-P10 of 15 ms formant-band energy in the Beast's answers (stem and mix)
3  the falling alarm: spectral centroid of each beep in bar 3 (does the timbre sink too?)
4  low-end sharing: bass sub-band level in the 60 ms after each kick vs. the rest
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from analyze import read_wav, phone, band  # noqa: E402

S16, SR_EXPECTED = 0.125, 44100


def mono(path):
    x, sr, _ = read_wav(path)
    assert sr == SR_EXPECTED
    return x.mean(axis=1), x, sr


def yin(m, sr, t, fmin=28, fmax=500, win=0.03):
    i, n = int(t * sr), int(win * sr)
    seg = m[i:i + 2 * n + int(sr / fmin) + 2]
    taus = np.arange(int(sr / fmax), int(sr / fmin))
    d = np.array([np.sum((seg[:n] - seg[tau:tau + n]) ** 2) for tau in taus])
    c = d * np.arange(1, len(d) + 1) / (np.cumsum(d) + 1e-12)
    cand = np.where(c < 0.25)[0]
    k = int(cand[0]) if len(cand) else int(np.argmin(c))
    while k + 1 < len(c) and c[k + 1] < c[k]:
        k += 1
    if 0 < k < len(c) - 1:
        a, b, cc = c[k - 1], c[k], c[k + 1]
        k = k + 0.5 * (a - cc) / (a - 2 * b + cc)
    return sr / (taus[0] + k), float(np.min(c))


def cents(f, midi):
    return 1200 * np.log2(f / (440 * 2 ** ((midi - 69) / 12)))


def riff_tuning(stems):
    """Pitch per band: the crossover delays the sub band a few ms, so a gliding onset reads
    differently per band; measure after the designed flare (80 ms; 200 ms for slaps)."""
    m, x, sr = mono(stems / "morph03-1-cable-bass.bass.wav")
    sub = band(x, sr, 0, 110).mean(axis=1)
    mid = band(x, sr, 300, 4000).mean(axis=1)
    ph = phone(x, sr).mean(axis=1)
    notes = [(32, 28, "slap"), (35, 40, "pop"), (38, 31, "pluck"), (40, 28, "slap"), (44, 35, "pluck"), (48, 28, "slap"),
             (51, 40, "pop"), (54, 31, "pluck"), (55, 34, "re-tension"), (56, 47, "12th pop"), (58, 28, "bowed")]
    rows = []
    for step, midi, kind in notes:
        t = step * S16 + (0.2 if kind == "slap" else 0.08)
        row = {"step": step, "midi": midi, "kind": kind, "at": round(t, 3)}
        for name, sig in (("sub", sub), ("mid", mid), ("phone", ph)):
            f, q = yin(sig, sr, t)
            row[f"cents_{name}"], row[f"aperiodicity_{name}"] = round(float(cents(f, midi)), 1), round(q, 3)
        rows.append(row)
    slap_onset = [round(float(cents(yin(mid, sr, step * S16 + 0.02)[0], 28)), 1) for step in (32, 48)]
    worst = lambda key: max(abs(r[key]) for r in rows)
    return {"notes": rows, "slapOnsetCentsMid": slap_onset,
            "maxAbsCents": {"sub": worst("cents_sub"), "mid": worst("cents_mid"), "phone": worst("cents_phone")}}


def wobble_depth(path, spans):
    _, x, sr = mono(path)
    out = {}
    for lo, hi in [(300, 800), (800, 2500), (2500, 5000)]:
        b = band(x, sr, lo, hi).mean(axis=1)
        w = int(0.015 * sr)
        vals = []
        for a, z in spans:
            seg = b[int(a * sr):int(z * sr)]
            e = np.array([10 * np.log10((seg[i:i + w] ** 2).mean() + 1e-12) for i in range(0, len(seg) - w, w)])
            vals.append(round(float(np.percentile(e, 90) - np.percentile(e, 10)), 1))
        out[f"{lo}-{hi}Hz"] = vals
    return out


def descent(stems):
    m, _, sr = mono(stems / "morph03-3-the-groove.alarm.wav")
    swing = 0.018
    out = []
    for step, name in [(32, "E6"), (33, "E5"), (35, "B4"), (38, "E4"), (39, "E3"), (41, "B2->B1")]:
        t = step * S16 + (swing if step % 2 else 0)
        w = int(0.06 * sr)
        seg = m[int(t * sr):int(t * sr) + w] * np.hanning(w)
        P = np.abs(np.fft.rfft(seg)) ** 2
        f = np.fft.rfftfreq(w, 1 / sr)
        out.append({"beep": name, "centroidHz": round(float((P * f).sum() / P.sum()))})
    return out


def low_end_sharing(stems, bass_mix_db=-1.0):
    """Masking risk: in the 60 ms after each kick, how far below the kick's own sub level is the
    bass sub? (stems are pre-fader; the bass bus is mixed at bass_mix_db)."""
    _, xb, sr = mono(stems / "morph03-3-the-groove.bass.wav")
    _, xd, _ = mono(stems / "morph03-3-the-groove.drums.wav")
    g = 10 ** (bass_mix_db / 20)
    bsub = band(xb, sr, 0, 120).mean(axis=1) * g
    dsub = band(xd, sr, 0, 120).mean(axis=1)
    kicks = [0, 4, 8, 12, 16, 20, 24, 27, 32, 44, 48, 52, 56]
    margins = []
    for k in kicks:
        t = k * S16 + (0.018 if k % 2 else 0)
        a, z = int(t * sr), int((t + 0.06) * sr)
        kick_db = 10 * np.log10(np.mean(dsub[a:z] ** 2) + 1e-12)
        bass_db = 10 * np.log10(np.mean(bsub[a:z] ** 2) + 1e-12)
        margins.append(kick_db - bass_db)
    return {"kickOverBassSubDbAfterEachKick": [round(float(v), 1) for v in margins],
            "medianMarginDb": round(float(np.median(margins)), 1), "worstMarginDb": round(float(np.min(margins)), 1)}


if __name__ == "__main__":
    stems, out = Path(sys.argv[1]) / "stems", Path(sys.argv[2])
    beast_spans = [[2, 4], [6, 8]]
    result = {
        "note": "Proxy measurements from rendered stems; not a listening verdict.",
        "exp1RiffTuning": riff_tuning(stems),
        "exp2WobbleDepthDb": {"beastStem": wobble_depth(stems / "morph03-2-wobble-beast.beastMid.wav", beast_spans),
                              "fullMix": wobble_depth(Path(sys.argv[1]) / "morph03-2-wobble-beast.wav", beast_spans),
                              "spans": beast_spans},
        "exp3FallingAlarm": descent(stems),
        "exp3LowEndSharing": low_end_sharing(stems),
    }
    out.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=1)[:3000])
