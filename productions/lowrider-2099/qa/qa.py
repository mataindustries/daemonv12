"""LOWRIDER//2099 technical QA for a DaemonV12 render directory (master + stems).

v2 adds stereo depth (side/mid per band), energy above 8 kHz and spectral centroid, and can
measure a separately mastered file against the engine stems (--master <wav>).

Measures what a listener's playback chain will do to the record, not whether it is good:
  - level: sample peak, BS.1770 integrated loudness (K-weighted, gated), crest
  - balance: share of energy per band
  - mono: L/R correlation, loudness change when folded to mono, worst band loss
  - phone: a small-speaker model (steep 4th-order high-pass at 320 Hz, 8 kHz low-pass, +4 dB
    presence at 2.5 kHz). Reports how much of each stem survives relative to the full-range mix,
    i.e. whether the 808 is still heard as a note on a phone
  - punch: crest of the master in 25 ms after each kick onset vs the 60 ms before it

usage: python3 -I tools/qa.py <render-dir> <name> [--json out.json]
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np
from scipy import signal

SR = 44100


def read(path):
    """PCM16 or PCM24 WAV -> float array (frames, channels)."""
    with wave.open(str(path), "rb") as w:
        raw, width, nc = w.readframes(w.getnframes()), w.getsampwidth(), w.getnchannels()
    if width == 2:
        x = np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768
    elif width == 3:
        b = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3).astype(np.int32)
        v = b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16)
        x = np.where(v >= 1 << 23, v - (1 << 24), v).astype(np.float64) / (1 << 23)
    else:
        raise ValueError(f"{path}: unsupported sample width {width}")
    return x.reshape(-1, nc)


def kweight(x):
    # BS.1770 pre-filter: high-shelf (+4 dB above ~1.5 kHz), RBJ cookbook with BS.1770 parameters
    A = 10 ** (3.99984 / 40)
    w0 = 2 * np.pi * 1681.97 / SR
    alpha = np.sin(w0) / (2 * 0.7071752)
    cw = np.cos(w0)
    b = [A * ((A + 1) + (A - 1) * cw + 2 * np.sqrt(A) * alpha), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - 2 * np.sqrt(A) * alpha)]
    a = [(A + 1) - (A - 1) * cw + 2 * np.sqrt(A) * alpha, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - 2 * np.sqrt(A) * alpha]
    y = signal.lfilter(b, a, x, axis=0)
    # RLB high-pass, RBJ cookbook with the BS.1770 Q of 0.5003 (not Butterworth)
    w1 = 2 * np.pi * 38.135 / SR
    a1 = np.sin(w1) / (2 * 0.5003)
    c1 = np.cos(w1)
    hb = [(1 + c1) / 2, -(1 + c1), (1 + c1) / 2]
    ha = [1 + a1, -2 * c1, 1 - a1]
    return signal.lfilter(hb, ha, y, axis=0)


def lufs(x):
    if x.ndim == 1:
        x = x[:, None]
    y = kweight(x)
    win, hop = int(0.4 * SR), int(0.1 * SR)
    z = np.array([np.sum(np.mean(y[s:s + win] ** 2, axis=0)) for s in range(0, len(y) - win + 1, hop)])
    if len(z) == 0 or z.max() <= 0:
        return None
    lk = -0.691 + 10 * np.log10(z + 1e-20)
    z = z[lk > -70]
    rel = -0.691 + 10 * np.log10(z.mean()) - 10
    z = z[-0.691 + 10 * np.log10(z) > rel]
    return float(-0.691 + 10 * np.log10(z.mean()))


def band_shares(x):
    m = x.mean(axis=1)
    f, p = signal.welch(m, SR, nperseg=8192)
    bands = {"sub <60": (0, 60), "bass 60-250": (60, 250), "lowmid 250-1k": (250, 1000), "mid 1-4k": (1000, 4000), "high 4k+": (4000, 22050)}
    tot = p.sum()
    return {k: round(100 * p[(f >= lo) & (f < hi)].sum() / tot, 1) for k, (lo, hi) in bands.items()}


def phone(x):
    m = x.mean(axis=1) if x.ndim == 2 else x
    sos = signal.butter(4, 320 / (SR / 2), btype="highpass", output="sos")
    sos2 = signal.butter(2, 8000 / (SR / 2), btype="lowpass", output="sos")
    y = signal.sosfilt(sos2, signal.sosfilt(sos, m))
    # +4 dB presence peak at 2.5 kHz (RBJ peaking)
    A, w0 = 10 ** (4 / 40), 2 * np.pi * 2500 / SR
    al = np.sin(w0) / (2 * 1.0)
    b = [1 + al * A, -2 * np.cos(w0), 1 - al * A]
    a = [1 + al / A, -2 * np.cos(w0), 1 - al / A]
    return signal.lfilter(b, a, y)


def mono_report(x):
    L, R = x[:, 0], x[:, 1]
    corr = float(np.corrcoef(L, R)[0, 1]) if np.std(L) > 0 and np.std(R) > 0 else 1.0
    st, mo = lufs(x), lufs(np.stack([(L + R) / 2] * 2, axis=1))
    # per-band mono loss (energy of mono sum vs mean channel energy)
    worst = 0.0
    for lo, hi in [(30, 120), (120, 500), (500, 2000), (2000, 8000), (8000, 16000)]:
        sos = signal.butter(4, [lo / (SR / 2), hi / (SR / 2)], btype="bandpass", output="sos")
        bl, br = signal.sosfilt(sos, L), signal.sosfilt(sos, R)
        e_st = (np.mean(bl ** 2) + np.mean(br ** 2)) / 2
        e_mo = np.mean(((bl + br) / 2) ** 2)
        if e_st > 1e-12:
            worst = min(worst, 10 * np.log10(e_mo / e_st))
    return {"lrCorrelation": round(corr, 3), "monoLoudnessChangeLu": round(mo - st, 2) if st and mo else None, "worstBandMonoLossDb": round(worst, 2)}


def kick_punch(master, kick):
    env = np.abs(kick).max(axis=1)
    thr = env.max() * 0.3
    onsets, i, n = [], 0, len(env)
    while i < n:
        if env[i] > thr:
            onsets.append(i)
            i += int(0.1 * SR)
        else:
            i += 1
    m = master.mean(axis=1)
    out = []
    for o in onsets:
        a, b = m[max(0, o - int(0.06 * SR)):o], m[o:o + int(0.025 * SR)]
        if len(a) > 10 and len(b) > 10:
            out.append(20 * np.log10((np.abs(b).max() + 1e-9) / (np.sqrt(np.mean(a ** 2)) + 1e-9)))
    return {"kickOnsets": len(onsets), "punchDbMedian": round(float(np.median(out)), 1) if out else None, "punchDbMin": round(float(np.min(out)), 1) if out else None}


def sounding_windows(x, w_s=0.1, below_db=20):
    """100 ms windows where the part is actually sounding: within `below_db` of its own median level
    over windows above -60 dBFS. (A fixed -40 dBFS gate also counted release tails 20+ dB down,
    which a listener does not follow as notes; that rule is applied to v1 and v2 alike.)"""
    m = x.mean(axis=1)
    w = int(w_s * SR)
    starts = list(range(0, len(m) - w, w))
    rms = np.array([np.sqrt(np.mean(m[i:i + w] ** 2)) for i in starts])
    on = rms > 10 ** (-60 / 20)
    if not on.any():
        return []
    ref = np.median(rms[on])
    return [i for i, r in zip(starts, rms) if r > ref * 10 ** (-below_db / 20)]


def phone_smr_band(stems, key, lo=250, hi=2000):
    """Like phone_smr, but only inside lo-hi Hz: where a phone reproduces an 808's harmonics. Hats and
    air above 5 kHz cannot mask those harmonics, but the broadband ratio counts them as maskers."""
    sos = signal.butter(4, [lo / (SR / 2), hi / (SR / 2)], btype="bandpass", output="sos")
    tgt = signal.sosfilt(sos, phone(stems[key]))
    rest = signal.sosfilt(sos, phone(sum(v for k, v in stems.items() if k != key)))
    act = sounding_windows(stems[key])
    w = int(0.1 * SR)
    smr = [10 * np.log10((np.mean(tgt[i:i + w] ** 2) + 1e-12) / (np.mean(rest[i:i + w] ** 2) + 1e-12)) for i in act]
    return {"band": [lo, hi], "medianSmrDb": round(float(np.median(smr)), 1), "p10SmrDb": round(float(np.percentile(smr, 10)), 1)} if smr else None


def phone_smr(stems, key):
    """While `key` sounds: phone-filtered `key` vs phone-filtered everything else, in 100 ms windows.
    Above about -6 dB a part is generally still followed as a line; below -12 dB it is masked."""
    tgt = phone(stems[key])
    rest = phone(sum(v for k, v in stems.items() if k != key))
    act = sounding_windows(stems[key])
    w = int(0.1 * SR)
    smr = [10 * np.log10((np.mean(tgt[i:i + w] ** 2) + 1e-12) / (np.mean(rest[i:i + w] ** 2) + 1e-12)) for i in act]
    return {"activeWindows": len(act), "medianSmrDb": round(float(np.median(smr)), 1) if smr else None,
            "p10SmrDb": round(float(np.percentile(smr, 10)), 1) if smr else None}


def stereo_depth(x):
    """Side/mid energy ratio per band (dB). Mono is -inf; a wide modern mix sits near -6 to -12 in the mids."""
    M, S = (x[:, 0] + x[:, 1]) / 2, (x[:, 0] - x[:, 1]) / 2
    out = {}
    for lo, hi in [(30, 150), (150, 600), (600, 2500), (2500, 8000), (8000, 16000)]:
        sos = signal.butter(4, [lo / (SR / 2), hi / (SR / 2)], btype="bandpass", output="sos")
        m, s = signal.sosfilt(sos, M), signal.sosfilt(sos, S)
        out[f"{lo}-{hi}"] = round(10 * np.log10(np.mean(s ** 2) / max(np.mean(m ** 2), 1e-20) + 1e-20), 1)
    return out


def brightness(x):
    f, p = signal.welch(x.mean(axis=1), SR, nperseg=8192)
    return {"above8kPercent": round(100 * p[f > 8000].sum() / p.sum(), 2), "centroidHz": round(float((f * p).sum() / p.sum()))}


def main():
    d, name = Path(sys.argv[1]), sys.argv[2]
    master = read(Path(sys.argv[sys.argv.index("--master") + 1])) if "--master" in sys.argv else read(d / f"{name}.wav")
    stems = {p.stem: read(p) for p in sorted((d / f"{name}.stems").glob("*.wav"))}
    rep = {"master": {
        "peakDbfs": round(20 * np.log10(np.abs(master).max() + 1e-12), 2),
        "fullScaleSamples": int((np.abs(master) >= 32767 / 32768).sum()),
        "lufs": round(lufs(master), 2),
        "crestDb": round(20 * np.log10(np.abs(master).max() / np.sqrt(np.mean(master ** 2))), 1),
        "bands": band_shares(master), **mono_report(master),
        "stereoSideToMidDb": stereo_depth(master), **brightness(master)}}
    # stems exclude master gain/effects: compare them with their own sum, not the master
    ssum = sum(stems.values()) if stems else master
    ph_mix = phone(ssum)
    ph_mix_l = lufs(np.stack([ph_mix] * 2, axis=1))
    full_l = lufs(ssum)
    ph_master = phone(master)
    rep["phone"] = {"mixLossLu": round(lufs(np.stack([ph_master] * 2, axis=1)) - rep["master"]["lufs"], 2), "stems": {}}
    rep["stems"] = {}
    for k, s in stems.items():
        L = lufs(s)
        if L is None:
            continue
        ph = phone(s)
        pl = lufs(np.stack([ph] * 2, axis=1))
        rep["stems"][k] = {"lufs": round(L, 1), "relToMixLu": round(L - full_l, 1), **mono_report(s)}
        # relative level of this stem inside the phone mix, vs inside the full-range mix
        rep["phone"]["stems"][k] = {"relFullLu": round(L - full_l, 1), "relPhoneLu": round(pl - ph_mix_l, 1) if pl is not None else None}
    if "kick" in stems:
        rep["punch"] = kick_punch(master, stems["kick"])
    if "bass-808" in stems:
        rep["phone808"] = phone_smr(stems, "bass-808")
        rep["phone808Band"] = phone_smr_band(stems, "bass-808")
    for lead in ("lead", "talkbox", "beast"):
        if lead in stems:
            rep.setdefault("phoneSmr", {})[lead] = phone_smr(stems, lead)["medianSmrDb"]
    out = json.dumps(rep, indent=1)
    print(out)
    if "--json" in sys.argv:
        Path(sys.argv[sys.argv.index("--json") + 1]).write_text(out + "\n")


if __name__ == "__main__":
    main()
