"""Stacked waveform view of chosen stems + master over a time window.

usage: python3 -I tools/waves.py <render-dir> <name> <t0> <t1> <out.png> stem1 stem2 ...
"""
import sys
from pathlib import Path

import numpy as np
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

from qa import read  # noqa: E402

SR = 44100


def main():
    d, name, t0, t1, out = Path(sys.argv[1]), sys.argv[2], float(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
    rows = [("master", read(d / f"{name}.wav"))] + [(s, read(d / f"{name}.stems" / f"{s}.wav")) for s in sys.argv[6:]]
    a, b = int(t0 * SR), int(t1 * SR)
    fig, axes = plt.subplots(len(rows), 1, figsize=(14, 1.6 * len(rows)), dpi=90, sharex=True)
    t = np.arange(a, b) / SR
    for ax, (label, x) in zip(np.atleast_1d(axes), rows):
        m = x[a:b].mean(axis=1)
        ax.plot(t[:len(m)], m, lw=0.4, color="#333")
        ax.set_ylim(-1, 1)
        ax.set_ylabel(label, rotation=0, ha="right")
        # 16th grid at 96 BPM
        for g in np.arange(0, t1 + 1e-9, 0.15625):
            if g >= t0:
                ax.axvline(g, color="#c33" if abs(g / 0.625 - round(g / 0.625)) < 1e-6 else "#ddd", lw=0.5)
    fig.tight_layout()
    fig.savefig(out)


if __name__ == "__main__":
    main()
