"""Small numpy-only audio inspection helpers for the Opus Round 1 submission.

Read-only analysis of PCM16 WAVs rendered by DaemonV12. No third-party DSP libraries.
"""
import struct
import numpy as np

SR = 44100


def read_wav(path):
    """Return float64 array (frames, channels) scaled to [-1, 1) and the sample rate."""
    with open(path, "rb") as f:
        data = f.read()
    assert data[:4] == b"RIFF" and data[8:12] == b"WAVE", path
    pos, fmt, raw = 12, None, None
    while pos + 8 <= len(data):
        cid, size = data[pos:pos + 4], struct.unpack("<I", data[pos + 4:pos + 8])[0]
        body = data[pos + 8:pos + 8 + size]
        if cid == b"fmt ":
            fmt = struct.unpack("<HHIIHH", body[:16])
        elif cid == b"data":
            raw = body
        pos += 8 + size + (size & 1)
    tag, ch, rate, _, _, bits = fmt
    assert tag == 1 and bits == 16, (path, fmt)
    x = np.frombuffer(raw[: len(raw) // (2 * ch) * 2 * ch], dtype="<i2").astype(np.float64) / 32768.0
    return x.reshape(-1, ch), rate


def mono(x):
    return x.mean(axis=1) if x.ndim == 2 else x


def db(v, floor=-120.0):
    v = np.asarray(v, dtype=np.float64)
    with np.errstate(divide="ignore"):
        out = 20 * np.log10(np.maximum(v, 1e-12))
    return np.maximum(out, floor)


def rms(x):
    return float(np.sqrt(np.mean(np.square(x)))) if x.size else 0.0


def window_rms_db(x, start_s, end_s, sr=SR):
    a, b = int(round(start_s * sr)), int(round(end_s * sr))
    seg = x[a:b]
    return float(db(rms(seg))) if seg.size else -120.0


def envelope_db(x, hop_s=0.01, sr=SR):
    m = mono(x)
    hop = int(hop_s * sr)
    n = len(m) // hop
    frames = m[: n * hop].reshape(n, hop)
    return db(np.sqrt(np.mean(frames ** 2, axis=1)))


BANDS = [(0, 30), (30, 60), (60, 120), (120, 250), (250, 500), (500, 2000), (2000, 6000), (6000, 12000), (12000, 22050)]


def band_shares(x, sr=SR, nfft=8192):
    """Power share per band using Hann-windowed 50%-overlap frames over both channels."""
    chans = x.T if x.ndim == 2 else [x]
    hop = nfft // 2
    win = np.hanning(nfft)
    acc = np.zeros(nfft // 2 + 1)
    for c in chans:
        if len(c) < nfft:
            c = np.pad(c, (0, nfft - len(c)))
        for i in range(0, len(c) - nfft + 1, hop):
            acc += np.abs(np.fft.rfft(c[i:i + nfft] * win)) ** 2
    freqs = np.fft.rfftfreq(nfft, 1 / sr)
    total = acc.sum() or 1.0
    return {f"{lo}-{hi}": float(acc[(freqs >= lo) & (freqs < hi)].sum() / total) for lo, hi in BANDS}


def centroid(x, sr=SR, nfft=8192):
    m = mono(x)
    hop = nfft // 2
    win = np.hanning(nfft)
    acc = np.zeros(nfft // 2 + 1)
    for i in range(0, max(1, len(m) - nfft + 1), hop):
        seg = m[i:i + nfft]
        if len(seg) < nfft:
            seg = np.pad(seg, (0, nfft - len(seg)))
        acc += np.abs(np.fft.rfft(seg * win)) ** 2
    freqs = np.fft.rfftfreq(nfft, 1 / sr)
    return float((acc * freqs).sum() / max(acc.sum(), 1e-20))


def correlation(x):
    if x.ndim != 2 or x.shape[1] < 2:
        return 1.0
    l, r = x[:, 0], x[:, 1]
    d = np.sqrt((l ** 2).sum() * (r ** 2).sum())
    return float((l * r).sum() / d) if d > 0 else 1.0


def lowpass_fft(m, cutoff, sr=SR):
    spec = np.fft.rfft(m)
    freqs = np.fft.rfftfreq(len(m), 1 / sr)
    spec[freqs > cutoff] = 0
    return np.fft.irfft(spec, len(m))


def pitch_yin(seg, sr=SR, fmin=40.0, fmax=1500.0, thresh=0.15):
    """Return (f0_hz, aperiodicity) of a mono segment using a compact YIN."""
    seg = seg - seg.mean()
    w = len(seg) // 2
    tau_min, tau_max = int(sr / fmax), min(int(sr / fmin), w - 1)
    if tau_max <= tau_min + 2:
        return None, 1.0
    d = np.zeros(tau_max + 1)
    x0 = seg[:w]
    for tau in range(1, tau_max + 1):
        diff = x0 - seg[tau:tau + w]
        d[tau] = np.dot(diff, diff)
    cmnd = np.ones_like(d)
    running = np.cumsum(d[1:])
    cmnd[1:] = d[1:] * np.arange(1, tau_max + 1) / np.maximum(running, 1e-20)
    tau = None
    for t in range(tau_min, tau_max):
        if cmnd[t] < thresh:
            while t + 1 < tau_max and cmnd[t + 1] < cmnd[t]:
                t += 1
            tau = t
            break
    if tau is None:
        tau = tau_min + int(np.argmin(cmnd[tau_min:tau_max]))
    if 1 <= tau < tau_max:
        a, b, c = cmnd[tau - 1], cmnd[tau], cmnd[tau + 1]
        den = a - 2 * b + c
        shift = 0.5 * (a - c) / den if den != 0 else 0.0
    else:
        shift = 0.0
    return sr / (tau + shift), float(cmnd[tau])


NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def hz_to_note(f):
    if not f or f <= 0:
        return None, None
    midi = 69 + 12 * np.log2(f / 440.0)
    n = int(round(midi))
    return f"{NOTE_NAMES[n % 12]}{n // 12 - 1}", float((midi - n) * 100)
