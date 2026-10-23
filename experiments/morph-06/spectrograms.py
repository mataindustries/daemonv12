#!/usr/bin/env python3
"""MORPH//06 spectrograms: one full-length spectrogram per alternate (MORPH//03 analyze.py), and two
side-by-side comparisons against unchanged V3: the gasp (19-21 s) and the ending (23.5-28 s).
Usage: python3 experiments/morph-06/spectrograms.py   (after build.mjs)
"""
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from analyze06 import read_wav, frame, SR  # noqa: E402
import matplotlib  # noqa: E402
matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402

OUT = HERE / 'audio' / 'spectrograms'
FILES = [('V3 (MORPH//05, unchanged)', HERE.parent / 'morph-05' / 'audio' / 'v3' / 'cable-beast-v3.wav')] + [
    (label, HERE / 'audio' / v / f'cable-beast-{v}.wav') for v, label in [('a', 'A: the gasp'), ('b', 'B: the overload'), ('c', 'C: the longer gasp')]]

if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = OUT / 'analysis.tmp.json'
    subprocess.run([sys.executable, str(HERE.parent / 'morph-03' / 'analyze.py'), str(tmp), *[str(f) for _, f in FILES[1:]], '--png', str(OUT)],
                   check=True, stdout=subprocess.DEVNULL)
    tmp.unlink()
    for name, (lo, hi) in {'gasp': (19.0, 21.0), 'ending': (23.5, 28.0)}.items():
        fig, axes = plt.subplots(4, 1, figsize=(12, 11), sharex=True)
        for ax, (k, f) in zip(axes, FILES):
            m = read_wav(f)[0].mean(axis=1)[frame(lo):frame(hi)]
            ax.specgram(m + 1e-12, NFFT=1024, Fs=SR, noverlap=896, cmap='magma', vmin=-120)
            ax.set_ylim(30, 16000); ax.set_yscale('log'); ax.set_title(k, fontsize=10); ax.set_ylabel('Hz')
            ticks = np.arange(0, hi - lo + 1e-9, 0.25 if name == 'gasp' else 0.5)
            ax.set_xticks(ticks); ax.set_xticklabels([f'{lo + t:.2f}' for t in ticks])
        axes[-1].set_xlabel('seconds')
        plt.tight_layout(); plt.savefig(OUT / f'compare-{name}.png', dpi=80); plt.close()
    print('spectrograms written to', OUT)
