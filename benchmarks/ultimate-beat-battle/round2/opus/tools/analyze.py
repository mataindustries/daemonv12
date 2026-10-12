#!/usr/bin/env python3
"""Read-only analysis helpers for the Opus Round 2 submission (evidence, not scores).

Method: numpy STFT (2048-point Hann, hop 512) on PCM16 44.1 kHz WAVs; bands are
unweighted power. Section windows are musical bar boundaries supplied by the
caller. Stereo correlation is Pearson L/R over the window (None for silence).

Subcommands:
  spec  <wav> <out.png> [t0 t1 fmax]      spectrogram (+ waveform + band energy lanes)
  grid  <out.png> <wav>...                small spectrogram grid for source sounds
  sections <wav> <bpm> <sections.json>    per-section metrics as JSON
  pitch <wav> <t0> <t1> [fmin fmax]       f0 estimate (harmonic product) in a window
"""
import json
import sys
import wave

import numpy as np

SR = 44100
BANDS = [(20, 60, 'sub'), (60, 120, 'low'), (120, 500, 'lowmid'), (500, 2000, 'mid'),
         (2000, 6000, 'upmid'), (6000, 20000, 'high')]


def load(path):
    with wave.open(path) as w:
        n, ch = w.getnframes(), w.getnchannels()
        x = np.frombuffer(w.readframes(n), dtype='<i2').astype(np.float64) / 32768.0
    return x.reshape(-1, ch)


def stft(m, nfft=2048, hop=512):
    win = np.hanning(nfft)
    pad = np.concatenate([np.zeros(nfft // 2), m, np.zeros(nfft)])
    frames = 1 + (len(pad) - nfft) // hop
    idx = np.arange(nfft)[None, :] + hop * np.arange(frames)[:, None]
    S = np.abs(np.fft.rfft(pad[idx] * win, axis=1)) ** 2
    return S, np.fft.rfftfreq(nfft, 1 / SR), np.arange(frames) * hop / SR


def db(v):
    return None if v <= 0 else round(10 * np.log10(v), 2)


def band_power(S, f):
    return {name: S[:, (f >= lo) & (f < hi)].sum(axis=1) for lo, hi, name in BANDS}


def spec(path, out, t0=None, t1=None, fmax=12000):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    x = load(path)
    t0 = 0.0 if t0 is None else float(t0)
    t1 = len(x) / SR if t1 is None else float(t1)
    seg = x[int(t0 * SR):int(t1 * SR)]
    m = seg.mean(axis=1)
    S, f, t = stft(m)
    t = t + t0
    fig, ax = plt.subplots(3, 1, figsize=(16, 10), sharex=True,
                           gridspec_kw={'height_ratios': [1, 3, 1.4]})
    tt = t0 + np.arange(len(seg)) / SR
    ax[0].plot(tt, seg[:, 0], lw=0.3)
    if seg.shape[1] > 1:
        ax[0].plot(tt, seg[:, 1], lw=0.3, alpha=0.6)
    ax[0].set_ylim(-1, 1)
    ax[0].set_ylabel('wave')
    keep = f <= float(fmax)
    ax[1].pcolormesh(t, f[keep], 10 * np.log10(S[:, keep].T + 1e-12), shading='auto',
                     vmin=-70, vmax=30, cmap='magma')
    ax[1].set_yscale('symlog', linthresh=200)
    ax[1].set_ylim(30, float(fmax))
    ax[1].set_ylabel('Hz')
    bp = band_power(S, f)
    for name, p in bp.items():
        ax[2].plot(t, 10 * np.log10(p + 1e-12), lw=0.8, label=name)
    ax[2].set_ylim(-40, 50)
    ax[2].legend(ncol=6, fontsize=7, loc='lower left')
    ax[2].set_ylabel('band dB')
    for a in ax:
        a.grid(alpha=0.25)
    fig.suptitle(path.split('/')[-1] + f'  {t0:.2f}-{t1:.2f}s')
    fig.tight_layout()
    fig.savefig(out, dpi=80)


def grid(out, paths):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    cols = 4
    rows = (len(paths) + cols - 1) // cols
    fig, axs = plt.subplots(rows, cols, figsize=(16, 3 * rows))
    for ax, p in zip(np.ravel(axs), paths):
        m = load(p).mean(axis=1)
        S, f, t = stft(m, 2048, 256)
        keep = f <= 12000
        ax.pcolormesh(t, f[keep], 10 * np.log10(S[:, keep].T + 1e-12), shading='auto', vmin=-70, vmax=30, cmap='magma')
        ax.set_yscale('symlog', linthresh=200)
        ax.set_ylim(30, 12000)
        ax.set_title(p.split('/')[-1], fontsize=8)
    for ax in np.ravel(axs)[len(paths):]:
        ax.axis('off')
    fig.tight_layout()
    fig.savefig(out, dpi=70)


def window_metrics(x):
    if len(x) == 0:
        return None
    m = x.mean(axis=1)
    rms = np.sqrt(np.mean(x ** 2))
    S, f, _ = stft(m)
    bp = {k: float(v.sum()) for k, v in band_power(S, f).items()}
    tot = sum(bp.values())
    corr = None
    if x.shape[1] == 2:
        l, r = x[:, 0], x[:, 1]
        den = np.sqrt((l ** 2).sum() * (r ** 2).sum())
        corr = None if den == 0 else round(float((l * r).sum() / den), 3)
    side = x[:, 0] - x[:, 1] if x.shape[1] == 2 else np.zeros(1)
    # crest: peak / rms, transient proxy via 10 ms envelope flux
    env = np.sqrt(np.convolve(m ** 2, np.ones(441) / 441, mode='same'))
    flux = np.maximum(0, np.diff(env[::441]))
    return {
        'rmsDbfs': db(rms ** 2),
        'peakDbfs': db(np.max(np.abs(x)) ** 2),
        'crestDb': None if rms == 0 else round(20 * np.log10(np.max(np.abs(x)) / rms), 2),
        'bandSharePct': {k: (None if tot == 0 else round(100 * v / tot, 1)) for k, v in bp.items()},
        'bandDb': {k: db(v / max(1, len(m))) for k, v in bp.items()},
        'stereoCorrelation': corr,
        'sideToMidDb': None if rms == 0 else db((side ** 2).mean() / max(1e-20, ((x[:, 0] + x[:, 1]) ** 2).mean())),
        'transientFluxSum': round(float(flux.sum()), 4),
    }


def sections(path, bpm, spec_path):
    x = load(path)
    bar = 240.0 / float(bpm)
    secs = json.load(open(spec_path))
    out = []
    for s in secs:
        if 'bars' in s:
            a, b = (s['bars'][0] - 1) * bar, (s['bars'][1]) * bar
        else:
            a, b = s['seconds']
        out.append({'name': s['name'], 'start': round(a, 3), 'end': round(min(b, len(x) / SR), 3),
                    **(window_metrics(x[int(a * SR):int(b * SR)]) or {})})
    print(json.dumps(out, indent=1))


def pitch(path, t0, t1, fmin=30, fmax=1500):
    x = load(path).mean(axis=1)[int(float(t0) * SR):int(float(t1) * SR)]
    n = 1 << int(np.ceil(np.log2(len(x) * 4)))
    S = np.abs(np.fft.rfft(x * np.hanning(len(x)), n))
    f = np.fft.rfftfreq(n, 1 / SR)
    hps = S.copy()
    for h in (2, 3, 4):
        d = S[::h]
        hps[:len(d)] *= d
    keep = (f >= float(fmin)) & (f <= float(fmax))
    f0 = f[keep][np.argmax(hps[keep])]
    peak = f[keep][np.argmax(S[keep])]
    midi = 69 + 12 * np.log2(f0 / 440)
    print(json.dumps({'f0Hz': round(float(f0), 2), 'strongestHz': round(float(peak), 2),
                      'midi': round(float(midi), 2)}))


if __name__ == '__main__':
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd == 'spec':
        spec(*args)
    elif cmd == 'grid':
        grid(args[0], args[1:])
    elif cmd == 'sections':
        sections(*args)
    elif cmd == 'pitch':
        pitch(*args)
