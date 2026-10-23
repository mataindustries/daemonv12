#!/usr/bin/env python3
"""MORPH//06 checks: the gasp, the cut and the last four seconds, against unchanged V3.
These are measurements, NOT listening results.

Usage: python3 experiments/morph-06/analyze06.py OUT.json NAME=DIR [NAME=DIR ...]
  DIR holds cable-beast-NAME.wav (24-bit), its .events.json and (optionally) stems/*.flac.

silence     every sample inside each planned silence is exactly 0 (after the 4 ms de-click fade)
clicks      largest sample-to-sample step at each silence edge and at the payoff onset, against
            the largest step in the 100 ms of music before it
clipping    sample peak, FFmpeg true peak, samples at full scale
loudness    FFmpeg integrated loudness (versions are matched to -14 LUFS)
payoff      cable slap over everything else at 20.000 s (300 Hz-4 kHz, 60 ms), kick over bass sub
            (50 ms), 15 ms crest of the payoff downbeat, level of 20-23.5 s vs. the approach
last 4 s    per 0.5 s from 24.0 s: level, peak-to-RMS, onsets per second, spectral centroid and
            flux, side/mid, and how hard the master worked (pre-master vs master level)
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "morph-03"))
sys.path.insert(0, str(HERE.parent / "morph-05"))
from analyze import read_wav, ffmpeg_loudness, k_weight, band  # noqa: E402
from checks import read_any  # noqa: E402

SR = 44100


def db(v):
    return float(20 * np.log10(v + 1e-12))


def kl(x):
    kw = k_weight(x, SR)
    return float(-0.691 + 10 * np.log10((kw ** 2).mean(axis=0).sum() + 1e-20))


def frame(t):
    return int(np.floor(t * SR + 0.5))


def step_report(x, t, after=False):
    """Largest |x[n]-x[n-1]| in +-2 ms around t vs the largest in 100 ms of the neighbouring music
    (before t for a fade-out, after it for a return from silence). A click shows as a ratio well above 1."""
    m = x.mean(axis=1)
    d = np.abs(np.diff(m))
    i = frame(t)
    edge = d[max(0, i - 88):i + 88].max()
    ref = d[i + int(0.01 * SR):i + int(0.11 * SR)].max() if after else d[max(0, i - int(0.11 * SR)):i - int(0.01 * SR)].max()
    return {"edgeMaxStep": float(edge), "musicMaxStep": float(ref), "comparedWith": "100 ms after" if after else "100 ms before", "ratio": round(float(edge / (ref + 1e-12)), 3)}


def onsets(m):
    hop = int(0.005 * SR)
    e = np.array([np.abs(m[i:i + hop]).max() for i in range(0, len(m) - hop, hop)])
    d = np.diff(20 * np.log10(e + 1e-6))
    return int(((d[1:-1] > 6) & (d[1:-1] >= d[:-2]) & (d[1:-1] >= d[2:])).sum())


def spectral(m):
    n = 2048
    frames = [m[i:i + n] * np.hanning(n) for i in range(0, len(m) - n, n // 2)]
    if not frames:
        return 0.0, 0.0
    S = np.abs(np.fft.rfft(np.array(frames), axis=1))
    f = np.fft.rfftfreq(n, 1 / SR)
    cen = float((S * f).sum() / (S.sum() + 1e-12))
    flux = float(np.mean(np.sqrt((np.maximum(0, np.diff(S, axis=0)) ** 2).sum(axis=1)))) if len(S) > 1 else 0.0
    return cen, flux


def analyze(name, d):
    d = Path(d)
    wav = d / f"cable-beast-{name}.wav"
    x, sr, _ = read_wav(wav)
    assert sr == SR
    ev = json.loads((d / f"cable-beast-{name}.events.json").read_text())["events"]
    res = {"file": wav.name, "frames": int(len(x)), "loudness": ffmpeg_loudness(wav),
           "samplePeakDbfs": round(db(np.abs(x).max()), 2), "fullScaleSamples": int((np.abs(x) >= 1.0 - 2 ** -23).sum())}
    # planned silences
    sil = []
    for e in ev:
        if e["part"] == "all" and e["event"].endswith(": silence"):
            a, b = e["sampleFrame"], frame(e["end"])
            seg = x[a:b]
            sil.append({"label": e["event"], "fromFrame": a, "toFrameExclusive": b, "frames": int(b - a), "ms": round((b - a) / SR * 1000, 2),
                        "allZero": bool(np.all(seg == 0)), "maxAbs": float(np.abs(seg).max()) if len(seg) else 0.0,
                        "fadeOutEdge": step_report(x, e["sampleFrame"] / SR), "frame60": [e["frame60"], int(np.floor(b * 60 / SR))]})
            if b < len(x):
                sil[-1]["resumeEdge"] = step_report(x, b / SR, after=True)
    res["silences"] = sil
    res["payoffOnset"] = step_report(x, 20.0, after=True)
    # stems-based payoff checks
    sd = d / "stems"
    if sd.exists():
        st = {p.stem: read_any(p) for p in sd.glob("*.flac")}
        others = sum(v for k, v in st.items() if k not in ("premaster", "cable", "room", "kitchen", "garage", "echo"))
        cb, ob = band(st["cable"].mean(axis=1), SR, 300, 4000), band(others.mean(axis=1), SR, 300, 4000)
        i0, i1 = frame(20.0), frame(20.06)
        res["payoffSlapOverOthersDb"] = round(db(np.sqrt((cb[i0:i1] ** 2).mean())) - db(np.sqrt((ob[i0:i1] ** 2).mean())), 1)
        ks, bs = band(st["kick"].mean(axis=1), SR, 0, 100), band((st["cable"] + st["beast"]).mean(axis=1), SR, 0, 100)
        j1 = frame(20.05)
        res["payoffKickOverBassSubDb"] = round(db(np.sqrt((ks[i0:j1] ** 2).mean())) - db(np.sqrt((bs[i0:j1] ** 2).mean())), 1)
        pre = st["premaster"]
        res["premasterVsMasterDb"] = []  # how much the master chain had to hold back, per window (gain-matched)
        g = np.sqrt((x ** 2).mean()) / np.sqrt((pre ** 2).mean())
        for a in np.arange(24.0, 27.6, 0.5):
            b = min(a + 0.5, 27.6)
            p1, p2 = pre[frame(a):frame(b)] * g, x[frame(a):frame(b)]
            res["premasterVsMasterDb"].append([round(float(a), 2), round(db(np.abs(p1).max()) - db(np.abs(p2).max()), 2)])
    seg = x[frame(20.0):frame(20.015)].mean(axis=1)
    res["payoffDownbeatCrestDb"] = round(db(np.abs(seg).max()) - db(np.sqrt((seg ** 2).mean())), 1)
    res["approachLevel"] = round(kl(x[frame(19.0):frame(19.75)]), 1)
    res["payoffLevel"] = round(kl(x[frame(20.0):frame(23.5)]), 1)
    # the last four seconds, per half second
    prog = []
    for a in np.arange(24.0, 28.0, 0.5):
        b = a + 0.5
        w = x[frame(a):frame(b)]
        m = w.mean(axis=1)
        cen, flux = spectral(m)
        r = np.sqrt((w ** 2).mean())
        prog.append({"from": round(float(a), 2), "levelK": round(kl(w), 1) if r > 0 else None, "peakDb": round(db(np.abs(w).max()), 1),
                     "crestDb": round(db(np.abs(w).max()) - db(r), 1) if r > 0 else None, "onsets": onsets(m), "centroidHz": round(cen),
                     "flux": round(flux, 2), "sideOverMidDb": round(db(np.sqrt((((w[:, 0] - w[:, 1]) / 2) ** 2).mean())) - db(np.sqrt((((w[:, 0] + w[:, 1]) / 2) ** 2).mean())), 1) if r > 0 else None})
    res["last4s"] = prog
    res["last4sLevelK"] = round(kl(x[frame(24.0):frame(28.0)]), 1)
    return res


if __name__ == "__main__":
    out = Path(sys.argv[1])
    results = {}
    for arg in sys.argv[2:]:
        name, d = arg.split("=", 1)
        results[name] = analyze(name, d)
    out.write_text(json.dumps(results, indent=1) + "\n")
    for k, r in results.items():
        print(k, "LUFS", r["loudness"]["integratedLufs"], "TP", r["loudness"]["truePeakDbtp"], "peak", r["samplePeakDbfs"], "fullscale", r["fullScaleSamples"],
              "| slap", r.get("payoffSlapOverOthersDb"), "kick/sub", r.get("payoffKickOverBassSubDb"), "downbeat crest", r["payoffDownbeatCrestDb"],
              "approach", r["approachLevel"], "payoff", r["payoffLevel"], "| payoff onset step ratio", r["payoffOnset"]["ratio"])
        for s in r["silences"]:
            print("   ", s["label"], s["fromFrame"], "-", s["toFrameExclusive"], s["ms"], "ms allZero", s["allZero"], "f60", s["frame60"], "fade-out edge ratio", s["fadeOutEdge"]["ratio"], "resume", s.get("resumeEdge", {}).get("ratio"))
        print("    last 4 s:", [(p["from"], p["levelK"], p["crestDb"], p["onsets"], p["centroidHz"], p["flux"]) for p in r["last4s"]])
        if "premasterVsMasterDb" in r:
            print("    master hold-back dB per 0.5 s from 24 s:", [v for _, v in r["premasterVsMasterDb"]])
