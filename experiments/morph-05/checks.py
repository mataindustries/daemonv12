#!/usr/bin/env python3
"""CABLE//BEAST proxy checks: masters, aligned stems and the event map. NOT listening results.

Usage:
  node experiments/morph-05/build.mjs v1 --stems --out DIR
  python3 experiments/morph-05/checks.py DIR/v1 OUT.json [--png PNG_DIR]

whole record  MORPH//03 analyze.py (loudness, true peak, PLR, bands, phone drop, mono, seam, onset crest)
windows       first 1 / 3 / 5 s, payoff (20-26 s), final 3 s, and every score section:
              level, crest, bands, side/mid, phone and car-cabin proxies, onsets per second,
              and which stems are active (dB relative to the window's mix)
interplay     kick over bass sub (first 50 ms after kicks); cable articulations over everything
              else (300 Hz-4 kHz, 60 ms after each slap/pop/bend); the Beast's presence over the
              rest during its phrases, and how much it covers the cable when they overlap
transients    15 ms crest at drum onsets, pre-master stems vs master
return        the last 0.5 s against the first 0.5 s (does the ending lead into the opening?)
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "morph-03"))
from analyze import analyze, read_wav, phone, band, lufs_of, k_weight  # noqa: E402

SR = 44100
BANDS = [("sub<120", 0, 120), ("lowMid120-500", 120, 500), ("mid500-2k", 500, 2000), ("upper2k-6k", 2000, 6000), ("high>6k", 6000, SR / 2)]


def read_any(path):
    if str(path).endswith(".wav"):
        return read_wav(path)[0]
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(path), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, "<f4").astype(np.float64).reshape(-1, 2)


def db(v):
    return float(20 * np.log10(v + 1e-12))


def rms(x):
    return float(np.sqrt(np.mean(x ** 2))) if len(x) else 0.0


def seg(x, a, b):
    return x[int(round(a * SR)):int(round(b * SR))]


def car(x):
    """Crude car-cabin proxy: +8 dB low shelf (cabin gain) under ~70 Hz, 30 Hz high-pass, 12 kHz low-pass."""
    lo = sosfilt(butter(2, 70, "lp", fs=SR, output="sos"), x, axis=0)
    y = x + (10 ** (8 / 20) - 1) * lo
    sos = np.vstack([butter(2, 30, "hp", fs=SR, output="sos"), butter(2, 12000, "lp", fs=SR, output="sos")])
    return sosfilt(sos, y, axis=0)


def kloud(x):
    """Ungated K-weighted level of a window (LUFS-like; for comparing windows only)."""
    kw = k_weight(x, SR)
    return float(-0.691 + 10 * np.log10((kw ** 2).mean(axis=0).sum() + 1e-20))


def onsets_per_second(m):
    hop = int(0.005 * SR)
    e = np.array([np.abs(m[i:i + hop]).max() for i in range(0, len(m) - hop, hop)])
    d = np.diff(20 * np.log10(e + 1e-6))
    peaks = (d[1:-1] > 6) & (d[1:-1] >= d[:-2]) & (d[1:-1] >= d[2:])
    return float(peaks.sum() / (len(m) / SR))


def window(master, stems, a, b, name):
    x = seg(master, a, b)
    if len(x) < 2048:
        return None
    m = x.mean(axis=1)
    out = {"name": name, "start": round(a, 4), "end": round(b, 4), "levelK": round(kloud(x), 1),
           "peakDb": round(db(np.abs(x).max()), 1), "crestDb": round(db(np.abs(x).max()) - db(rms(x)), 1)}
    P = np.abs(np.fft.rfft(m * np.hanning(len(m)))) ** 2
    f = np.fft.rfftfreq(len(m), 1 / SR)
    out["bandsPct"] = {n: round(float(100 * P[(f >= lo) & (f < hi)].sum() / P.sum()), 1) for n, lo, hi in BANDS}
    L, R = x[:, 0], x[:, 1]
    out["sideOverMidDb"] = round(db(rms((L - R) / 2)) - db(rms((L + R) / 2)), 1)
    out["phoneDropLu"] = round(kloud(phone(x, SR)) - out["levelK"], 1)
    out["carGainLu"] = round(kloud(car(x)) - out["levelK"], 1)
    out["onsetsPerSecond"] = round(onsets_per_second(m), 1)
    ref = rms(seg(stems["premaster"], a, b))
    out["stemsDb"] = {k: round(db(rms(seg(v, a, b))) - db(ref), 1) for k, v in stems.items() if k != "premaster" and rms(seg(v, a, b)) > 1e-5}
    return out


def kick_bass(stems, events):
    ks = band(stems["kick"].mean(axis=1), SR, 0, 100)
    bs = band(stems["cable"].mean(axis=1), SR, 0, 100) + band(stems["beast"].mean(axis=1), SR, 0, 100)
    margins = []
    for e in events:
        if e["part"] == "kick":
            t = e["sampleFrame"] / SR
            margins.append((round(db(rms(seg(ks, t, t + 0.05))) - db(rms(seg(bs, t, t + 0.05))), 1), e["position"]))
    v = np.array([m for m, _ in margins])
    return {"kicks": len(v), "medianDb": round(float(np.median(v)), 1), "minDb": round(float(v.min()), 1), "worst": sorted(margins)[:4]}


def presence_margin(target, others, events, part, kinds, dur=0.06):
    t_b, o_b = band(target, SR, 300, 4000), band(others, SR, 300, 4000)
    rows = []
    for e in events:
        if e["part"] != part or (kinds and e["event"] not in kinds):
            continue
        t = e["sampleFrame"] / SR
        rows.append((round(db(rms(seg(t_b, t, t + dur))) - db(rms(seg(o_b, t, t + dur))), 1), e["position"], e["event"], e.get("detail", "")))
    if not rows:
        return None
    v = np.array([r[0] for r in rows])
    return {"n": len(rows), "medianDb": round(float(np.median(v)), 1), "minDb": round(float(v.min()), 1), "below3dB": int((v < 3).sum()), "worst": sorted(rows)[:4]}


def transients(stems, master, events):
    pre, m = stems["premaster"].mean(axis=1), master.mean(axis=1)
    def crest(x, t):
        s = seg(x, t, t + 0.015)
        return db(np.abs(s).max()) - db(rms(s))
    loss = np.array([crest(pre, e["sampleFrame"] / SR) - crest(m, e["sampleFrame"] / SR) for e in events if e["part"] in ("kick", "snare") and e.get("velocity", 1) >= 0.5])
    return {"drumOnsets": len(loss), "crestLossDbMedian": round(float(np.median(loss)), 2), "crestLossDbMax": round(float(loss.max()), 2)}


def check(vdir, png=None):
    name = vdir.name
    master_path = vdir / f"cable-beast-{name}.wav"
    ev = json.loads((vdir / f"cable-beast-{name}.events.json").read_text())
    events = ev["events"]
    stems = {p.stem: read_any(p) for p in sorted((vdir / "stems").glob("*.flac"))}
    master = read_any(master_path)
    res = {"version": name, "frames": int(len(master)), "global": analyze(master_path, png)}
    secs = [e for e in events if e["part"] == "section"]
    bounds = [(s["sampleFrame"] / SR, (secs[k + 1]["sampleFrame"] / SR if k + 1 < len(secs) else 28.0), s["event"]) for k, s in enumerate(secs)]
    res["windows"] = [w for w in [window(master, stems, a, b, n) for a, b, n in
                                  [(0, 1, "first 1 s"), (0, 3, "first 3 s"), (0, 5, "first 5 s"), (20, 26, "payoff 20-26 s"), (25, 28, "final 3 s")]] if w]
    res["sections"] = [w for w in [window(master, stems, a, b, n) for a, b, n in bounds] if w]
    res["kickBass"] = kick_bass(stems, events)
    others_c = sum(v for k, v in stems.items() if k not in ("premaster", "cable", "room", "kitchen", "garage", "echo"))
    res["cableArticulations"] = presence_margin(stems["cable"].mean(axis=1), others_c.mean(axis=1), events, "cable bass", ("slap", "pluck"))
    others_b = sum(v for k, v in stems.items() if k not in ("premaster", "beast", "room", "kitchen", "garage", "echo"))
    res["beastOverOthers"] = presence_margin(stems["beast"].mean(axis=1), others_b.mean(axis=1), events, "beast", None, 0.12)
    res["transients"] = transients(stems, master, events)
    a, b = master[: int(0.5 * SR)], master[-int(0.5 * SR):]
    res["return"] = {"last0.5sDb": round(db(rms(b)), 1), "first0.5sDb": round(db(rms(a)), 1),
                     "last50msDb": round(db(rms(master[-int(0.05 * SR):])), 1), "lastSampleAbs": float(np.abs(master[-1]).max())}
    return res


if __name__ == "__main__":
    args = sys.argv[1:]
    png = None
    if "--png" in args:
        i = args.index("--png"); png = args[i + 1]; del args[i:i + 2]
    vdir, out = Path(args[0]), Path(args[1])
    r = check(vdir, png)
    out.write_text(json.dumps(r, indent=1, default=float) + "\n")
    g = r["global"]
    print(r["version"], r["frames"], {k: g[k] for k in ("integratedLufs", "truePeakDbtp", "plrDb", "phoneLufsDrop", "loudnessRangeLu") if k in g}, g["bandBalancePct"])
    print("  mono", {k: v["monoSumLossDb"] for k, v in g["mono"].items()}, "infra%", g["infrasonicPctBelow20Hz"])
    for w in r["windows"] + r["sections"]:
        print(f"  {w['name'][:34]:34s} {w['start']:6.2f}-{w['end']:5.2f} lvl {w['levelK']:6.1f} crest {w['crestDb']:4.1f} S/M {w['sideOverMidDb']:6.1f} phone {w['phoneDropLu']:5.1f} car {w['carGainLu']:4.1f} ons/s {w['onsetsPerSecond']:4.1f}  {w['bandsPct']}")
        print("      stems dB:", w["stemsDb"])
    for k in ("kickBass", "cableArticulations", "beastOverOthers", "transients", "return"):
        print(" ", k, r[k])
