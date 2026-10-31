"""Spectrogram PNG for a PCM16 WAV (mono or stereo, mixed to mono). Log-frequency axis.

usage: python3 -I tools/spectro.py in.wav out.png [fmin] [fmax] [title]
"""
import sys
import wave

import numpy as np
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402


def read(path):
    with wave.open(path, "rb") as w:
        ch, sr, n = w.getnchannels(), w.getframerate(), w.getnframes()
        x = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float64) / 32768
    return x.reshape(-1, ch).mean(axis=1), sr


def main():
    src, out = sys.argv[1], sys.argv[2]
    fmin = float(sys.argv[3]) if len(sys.argv) > 3 else 30
    fmax = float(sys.argv[4]) if len(sys.argv) > 4 else 16000
    title = sys.argv[5] if len(sys.argv) > 5 else src.split("/")[-1]
    x, sr = read(src)
    nfft, hop = 4096, 256
    win = np.hanning(nfft)
    frames = max(1, 1 + (len(x) - nfft) // hop)
    spec = np.empty((nfft // 2 + 1, frames))
    for k in range(frames):
        seg = x[k * hop: k * hop + nfft]
        if len(seg) < nfft:
            seg = np.pad(seg, (0, nfft - len(seg)))
        spec[:, k] = np.abs(np.fft.rfft(seg * win))
    db = 20 * np.log10(spec + 1e-9)
    db -= db.max()
    f = np.fft.rfftfreq(nfft, 1 / sr)
    t = (np.arange(frames) * hop + nfft / 2) / sr
    fig, ax = plt.subplots(figsize=(14, 5), dpi=90)
    ax.pcolormesh(t, f[1:], db[1:], vmin=-80, vmax=0, cmap="magma", shading="auto")
    ax.set_yscale("log")
    ax.set_ylim(fmin, fmax)
    ax.set_xlabel("seconds")
    ax.set_ylabel("Hz")
    ax.set_title(title)
    for hz in (100, 300, 1000, 3000, 10000):
        ax.axhline(hz, color="white", lw=0.3, alpha=0.4)
    fig.tight_layout()
    fig.savefig(out)


if __name__ == "__main__":
    main()
