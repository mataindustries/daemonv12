#!/usr/bin/env python3
"""MORPH//03 proxy measurements (extends MORPH//02). These are NOT listening results.

Usage: python3 experiments/morph-02/analyze.py OUT.json FILE.wav [FILE.wav ...] [--png DIR]

Reads PCM16/24 WAVs, prints and writes a JSON of engineering proxies:
loudness (FFmpeg EBU R128), crest/PLR, band balance, onset density and
sharpness, spectral-centroid motion, stereo width, and first-vs-last
"development" distance. Optional spectrogram PNGs need matplotlib.
Requires numpy + scipy (analysis only; synthesis is Node-only).
"""
import json
import re
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from scipy.signal import lfilter, butter, sosfilt


def read_wav(path):
    with wave.open(str(path), "rb") as w:
        ch, sw, sr, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        raw = w.readframes(n)
    if sw == 2:
        x = np.frombuffer(raw, "<i2").astype(np.float64) / 32768
    elif sw == 3:
        b = np.frombuffer(raw, np.uint8).reshape(-1, 3)
        v = (b[:, 0].astype(np.int32) | (b[:, 1].astype(np.int32) << 8) | (b[:, 2].astype(np.int32) << 16))
        v = np.where(v & 0x800000, v - 0x1000000, v)
        x = v.astype(np.float64) / 8388608
    else:
        raise ValueError("PCM16/24 only")
    x = x.reshape(-1, ch)
    if ch == 1:
        x = np.repeat(x, 2, axis=1)
    return x, sr, ch


def ffmpeg_loudness(path):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af",
                          "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    tail = out[out.rfind("Summary:"):]
    get = lambda key: float(re.search(key + r":\s+(-?[\d.]+|-inf)", tail).group(1).replace("-inf", "-inf"))
    return {"integratedLufs": get("I"), "loudnessRangeLu": get("LRA"), "truePeakDbtp": get("Peak")}


def k_weight(x, sr):
    # ITU-R BS.1770 K-weighting (pre-filter + RLB), coefficients re-derived for sr.
    f0, g, q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    k = np.tan(np.pi * f0 / sr); vh = 10 ** (g / 20); vb = vh ** 0.4996667741545416
    a0 = 1 + k / q + k * k
    b1 = [(vh + vb * k / q + k * k) / a0, 2 * (k * k - vh) / a0, (vh - vb * k / q + k * k) / a0]
    a1 = [1, 2 * (k * k - 1) / a0, (1 - k / q + k * k) / a0]
    f0, q = 38.13547087602444, 0.5003270373238773
    k = np.tan(np.pi * f0 / sr)
    a2 = [1, 2 * (k * k - 1) / (1 + k / q + k * k), (1 - k / q + k * k) / (1 + k / q + k * k)]
    return lfilter([1, -2, 1], a2, lfilter(b1, a1, x, axis=0), axis=0)


def analyze(path, png_dir=None):
    x, sr, ch = read_wav(path)
    mono = x.mean(axis=1)
    n = len(mono)
    eps = 1e-12
    peak = np.abs(x).max()
    rms = np.sqrt((x ** 2).mean())
    loud = ffmpeg_loudness(path)
    # Momentary (400 ms) loudness every 100 ms -> dynamic contrast within the sketch.
    kw = k_weight(x, sr)
    win, hop = int(0.4 * sr), int(0.1 * sr)
    mom = []
    for s in range(0, max(1, n - win), hop):
        z = (kw[s:s + win] ** 2).mean(axis=0).sum()
        mom.append(-0.691 + 10 * np.log10(z + eps))
    mom = np.array(mom)
    active = mom[mom > mom.max() - 40]
    # STFT
    size, step = 2048, 512
    w = np.hanning(size)
    frames = np.lib.stride_tricks.sliding_window_view(mono, size)[::step] * w
    mag = np.abs(np.fft.rfft(frames, axis=1))
    freqs = np.fft.rfftfreq(size, 1 / sr)
    power = mag ** 2
    bands = {"sub_<60": (20, 60), "low_60-150": (60, 150), "lowmid_150-500": (150, 500),
             "mid_500-2k": (500, 2000), "presence_2k-6k": (2000, 6000), "air_>6k": (6000, sr / 2)}
    total = power[:, freqs >= 20].sum() + eps
    balance = {k: round(100 * power[:, (freqs >= lo) & (freqs < hi)].sum() / total, 2) for k, (lo, hi) in bands.items()}
    frame_energy = power.sum(axis=1)
    loud_frames = frame_energy > frame_energy.max() * 1e-4
    centroid = (power * freqs).sum(axis=1) / (frame_energy + eps)
    c = centroid[loud_frames]
    flat = np.exp(np.log(power[:, 1:] + eps).mean(axis=1)) / (power[:, 1:].mean(axis=1) + eps)
    # Onsets: half-wave rectified log-spectral flux, peak-picked.
    logmag = np.log1p(100 * mag)
    flux = np.maximum(0, np.diff(logmag, axis=0)).sum(axis=1)
    flux = flux / (flux.max() + eps)
    thresh = np.convolve(flux, np.ones(9) / 9, mode="same") + 0.08
    peaks = [i for i in range(1, len(flux) - 1) if flux[i] > thresh[i] and flux[i] >= flux[i - 1] and flux[i] > flux[i + 1]]
    min_gap = int(0.05 * sr / step)
    onsets = []
    for p in peaks:
        if not onsets or p - onsets[-1] > min_gap:
            onsets.append(p)
    onset_times = [(p * step + size / 2) / sr for p in onsets]
    # Attack sharpness: 10%->90% rise time of a 1 ms envelope around each onset.
    env = np.sqrt(np.convolve(mono ** 2, np.ones(44) / 44, mode="same"))
    rises = []
    for t in onset_times:
        a, b = int(max(0, (t - 0.06) * sr)), int(min(n, (t + 0.08) * sr))
        seg = env[a:b]
        if len(seg) < 10:
            continue
        top = seg.max(); lo = seg[:max(1, seg.argmax())].min() if seg.argmax() > 0 else 0
        if top - lo < 1e-4:
            continue
        i10 = np.argmax(seg >= lo + 0.1 * (top - lo)); i90 = np.argmax(seg >= lo + 0.9 * (top - lo))
        rises.append(1000 * (i90 - i10) / sr)
    # Stereo
    L, R = x[:, 0], x[:, 1]
    mid, side = (L + R) / 2, (L - R) / 2
    corr = float((L * R).sum() / np.sqrt((L ** 2).sum() * (R ** 2).sum() + eps))
    # Development: distance between average log-band spectra of first and last 2.5 s.
    edges = np.geomspace(30, sr / 2, 33)
    def band_profile(seg):
        p = (seg ** 2).mean(axis=0)
        return np.array([p[(freqs >= edges[i]) & (freqs < edges[i + 1])].sum() for i in range(32)])
    q = int(2.5 * sr / step)
    first, last = band_profile(mag[:q]), band_profile(mag[-q - int(0.8 * sr / step):-int(0.8 * sr / step)] if len(mag) > 2 * q else mag[-q:])
    lf, ll = 10 * np.log10(first + eps), 10 * np.log10(last + eps)
    development_db = float(np.sqrt(((lf - ll) ** 2).mean()))
    result = {
        "file": Path(path).name, "seconds": round(n / sr, 3), "sourceChannels": ch, **loud,
        "samplePeakDbfs": round(20 * np.log10(peak + eps), 2), "rmsDbfs": round(20 * np.log10(rms + eps), 2),
        "crestDb": round(20 * np.log10((peak + eps) / (rms + eps)), 2),
        "plrDb": round(loud["truePeakDbtp"] - loud["integratedLufs"], 2),
        "momentaryLufsP95MinusP10": round(float(np.percentile(active, 95) - np.percentile(active, 10)), 2),
        "bandBalancePct": balance,
        "centroidHz": {"median": round(float(np.median(c)), 1), "p10": round(float(np.percentile(c, 10)), 1),
                       "p90": round(float(np.percentile(c, 90)), 1)},
        "spectralFlatnessMedian": round(float(np.median(flat[loud_frames])), 5),
        "onsetsPerSecond": round(len(onset_times) / (n / sr), 2),
        "medianAttackRiseMs": round(float(np.median(rises)), 2) if rises else None,
        "stereoCorrelation": round(corr, 3),
        "sideToMidDb": round(10 * np.log10((side ** 2).sum() / ((mid ** 2).sum() + eps) + eps), 2),
        "firstVsLastSpectralDistanceDb": round(development_db, 2),
        # momentary (400 ms) loudness every 0.5 s: the dynamic arc of the sketch
        "momentaryLufsEveryHalfSecond": [round(float(v), 1) for v in mom[::5]],
    }
    result["defects"] = defects(x, sr)
    result.update(morph03_checks(x, sr, path))
    if png_dir:
        png(mono, sr, Path(png_dir) / (Path(path).stem + ".png"), Path(path).name)
    return result


def lufs_of(x, sr):
    kw = k_weight(x, sr)
    win, hop = int(0.4 * sr), int(0.1 * sr)
    blocks = np.array([(kw[s:s + win] ** 2).mean(axis=0).sum() for s in range(0, len(kw) - win, hop)])
    blocks = blocks[blocks > 0]
    l = -0.691 + 10 * np.log10(blocks + 1e-20)
    gated = blocks[l > -70]
    rel = -0.691 + 10 * np.log10(gated.mean() + 1e-20) - 10
    gated = gated[(-0.691 + 10 * np.log10(gated + 1e-20)) > rel]
    return float(-0.691 + 10 * np.log10(gated.mean() + 1e-20))


def phone(x, sr):
    """Crude small-phone-speaker model: 4th-order high-pass at 300 Hz, 2nd-order low-pass at 9 kHz."""
    sos = np.vstack([butter(4, 300, "hp", fs=sr, output="sos"), butter(2, 9000, "lp", fs=sr, output="sos")])
    return sosfilt(sos, x, axis=0)


def band(x, sr, lo, hi):
    if lo <= 0:
        return sosfilt(butter(4, hi, "lp", fs=sr, output="sos"), x, axis=0)
    if hi >= sr / 2:
        return sosfilt(butter(4, lo, "hp", fs=sr, output="sos"), x, axis=0)
    return sosfilt(butter(4, [lo, hi], "bp", fs=sr, output="sos"), x, axis=0)


def morph03_checks(x, sr, path):
    eps = 1e-20
    full = lufs_of(x, sr)
    ph = phone(x, sr)
    out = {"phoneLufsDrop": round(lufs_of(ph, sr) - full, 2)}
    # mono compatibility: correlation per band and loss when L+R are summed
    mono = {}
    for name, lo, hi in [("low<150", 0, 150), ("mid150-2k", 150, 2000), ("high>2k", 2000, sr / 2)]:
        b = band(x, sr, lo, hi)
        L, R = b[:, 0], b[:, 1]
        corr = float((L * R).sum() / np.sqrt((L ** 2).sum() * (R ** 2).sum() + eps))
        loss = 10 * np.log10((((L + R) / 2) ** 2).sum() / (((L ** 2).sum() + (R ** 2).sum()) / 2 + eps) + eps)
        mono[name] = {"corr": round(corr, 3), "monoSumLossDb": round(float(loss), 2)}
    out["mono"] = mono
    # infrasonic share
    m = x.mean(axis=1)
    P = np.abs(np.fft.rfft(m)) ** 2
    f = np.fft.rfftfreq(len(m), 1 / sr)
    out["infrasonicPctBelow20Hz"] = round(float(100 * P[(f > 0) & (f < 20)].sum() / (P[f > 0].sum() + eps)), 4)
    out["extremeSubPct20to30Hz"] = round(float(100 * P[(f >= 20) & (f < 30)].sum() / (P[f > 0].sum() + eps)), 3)
    # loop seam: is the end-to-start join continuous?
    n10, n250 = int(0.01 * sr), int(0.25 * sr)
    d = np.abs(np.diff(x, axis=0)).max(axis=1)
    seam = float(np.abs(x[0] - x[-1]).max())
    rms = lambda seg: 20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-12)
    w = int(0.05 * sr)
    local = np.concatenate([d[-w:], d[:w]])  # steps within 50 ms either side of the join
    out["loopSeam"] = {
        "jump": round(seam, 5),
        # a seamless loop's join step looks like its neighbours (ratio ~1 to the local median, < 1 to the local max)
        "jumpVsLocalMedianStep": round(seam / (np.median(local) + 1e-12), 2),
        "jumpVsLocalMaxStep": round(seam / (local.max() + 1e-12), 3),
        "last250msDb": round(rms(x[-n250:]), 2), "first250msDb": round(rms(x[:n250]), 2),
        "last10msDb": round(rms(x[-n10:]), 2), "first10msDb": round(rms(x[:n10]), 2),
    }
    # transient punch: crest of the first 15 ms after the strongest onsets
    env = np.abs(m)
    hop = int(0.005 * sr)
    e = np.array([env[i:i + hop].max() for i in range(0, len(env) - hop, hop)])
    rise = np.maximum(0, np.diff(20 * np.log10(e + 1e-6)))
    idx = np.argsort(rise)[-12:]
    crest = []
    for k in sorted(idx):
        s0 = k * hop
        seg = m[s0:s0 + int(0.015 * sr)]
        if len(seg) > 10:
            crest.append(20 * np.log10((np.abs(seg).max() + 1e-12) / (np.sqrt((seg ** 2).mean()) + 1e-12)))
    out["onsetCrestDbMedian"] = round(float(np.median(crest)), 2) if crest else None
    return out


def defects(x, sr):
    """Proxy defect scan: sharp transients (clicks OR intended attacks; inspect), DC, narrow resonant peaks."""
    out = {"dcOffset": [round(float(x[:, c].mean()), 6) for c in range(2)]}
    # Clicks: high-passed second difference far above its local (50 ms) median level.
    clicks = []
    for c in range(2):
        d2 = np.abs(np.diff(x[:, c], 2))
        w = int(0.05 * sr)
        k = max(1, len(d2) // w)
        med = np.array([np.median(d2[i * w:(i + 1) * w]) + 1e-6 for i in range(k)])
        local = np.repeat(med, w)[:len(d2)]
        local = np.pad(local, (0, len(d2) - len(local)), mode="edge")
        idx = np.where((d2 > 40 * local) & (d2 > 0.05))[0]
        for i in idx:
            t = round(i / sr, 3)
            if not clicks or t - clicks[-1] > 0.02:
                clicks.append(t)
    out["sharpTransientCandidatesSeconds"] = sorted(set(clicks))[:40]
    # Long-term spectrum: narrow peaks standing > 12 dB above a 1/3-octave smoothed curve.
    mono = x.mean(axis=1)
    size = 16384
    frames = np.lib.stride_tricks.sliding_window_view(mono, size)[::size // 2] * np.hanning(size)
    p = (np.abs(np.fft.rfft(frames, axis=1)) ** 2).mean(axis=0)
    f = np.fft.rfftfreq(size, 1 / sr)
    db = 10 * np.log10(p + 1e-20)
    peaks = []
    for i in range(10, len(f) - 10):
        if f[i] < 40 or f[i] > 16000:
            continue
        lo, hi = f[i] / 2 ** (1 / 6), f[i] * 2 ** (1 / 6)
        band = db[(f >= lo) & (f <= hi)]
        if db[i] == band.max() and db[i] - np.median(band) > 12:
            peaks.append((round(float(f[i]), 1), round(float(db[i] - np.median(band)), 1)))
    peaks.sort(key=lambda v: -v[1])
    out["narrowPeaksHzDb"] = peaks[:12]
    return out


def png(mono, sr, out, title):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    size, step = 4096, 256
    w = np.hanning(size)
    frames = np.lib.stride_tricks.sliding_window_view(np.pad(mono, (size // 2, size // 2)), size)[::step] * w
    db = 20 * np.log10(np.abs(np.fft.rfft(frames, axis=1)) + 1e-9)
    db -= db.max()
    freqs = np.fft.rfftfreq(size, 1 / sr)
    times = np.arange(len(frames)) * step / sr
    fig, ax = plt.subplots(2, 1, figsize=(14, 7), gridspec_kw={"height_ratios": [4, 1]}, sharex=True)
    keep = freqs >= 25
    ax[0].pcolormesh(times, freqs[keep], db[:, keep].T, vmin=-90, vmax=0, cmap="magma", shading="auto")
    ax[0].set_yscale("log"); ax[0].set_ylim(25, sr / 2); ax[0].set_ylabel("Hz"); ax[0].set_title(title)
    env = np.sqrt(np.convolve(mono ** 2, np.ones(441) / 441, mode="same"))
    t = np.arange(len(mono)) / sr
    ax[1].plot(t[::50], 20 * np.log10(env[::50] + 1e-6), lw=0.6, color="k")
    ax[1].set_ylim(-60, 0); ax[1].set_ylabel("dBFS env"); ax[1].set_xlabel("s"); ax[1].grid(alpha=0.3)
    fig.tight_layout(); out.parent.mkdir(parents=True, exist_ok=True); fig.savefig(out, dpi=90); plt.close(fig)


if __name__ == "__main__":
    args = sys.argv[1:]
    png_dir = None
    if "--png" in args:
        i = args.index("--png"); png_dir = args[i + 1]; del args[i:i + 2]
    out, files = args[0], args[1:]
    results = [analyze(f, png_dir) for f in files]
    Path(out).write_text(json.dumps(results, indent=2) + "\n")
    keys = ["integratedLufs", "truePeakDbtp", "plrDb", "momentaryLufsP95MinusP10", "onsetsPerSecond",
            "medianAttackRiseMs", "stereoCorrelation", "firstVsLastSpectralDistanceDb"]
    for r in results:
        print(r["file"], {k: r[k] for k in keys}, r["bandBalancePct"], r["centroidHz"])
        print("  arc:", r["momentaryLufsEveryHalfSecond"])
        print("  phone drop LU:", r["phoneLufsDrop"], " mono:", r["mono"], " infra% <20 Hz:", r["infrasonicPctBelow20Hz"], " 20-30 Hz %:", r["extremeSubPct20to30Hz"])
        print("  seam:", r["loopSeam"], " onset crest dB:", r["onsetCrestDbMedian"])
