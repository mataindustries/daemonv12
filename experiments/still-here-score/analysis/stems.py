"""Stem balance proxies for STILL HERE (read-only; numpy/scipy only).

Answers three questions the native report cannot: which stem owns each section, whether the
hook's carrier stands out in its presence band while it sounds, and whether the kick or the
bass owns the sub at each kick. Usage:
  python3 analysis/stems.py a v1 [--png]
Measurements are proxies, not listening.
"""
import json, sys, glob, os, wave
import numpy as np
from scipy.signal import butter, sosfilt

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 44100


def rd(path):
    w = wave.open(path)
    x = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').reshape(-1, w.getnchannels()).astype(float) / 32768
    return x if x.shape[1] == 2 else np.repeat(x, 2, axis=1)


def band(x, lo=None, hi=None):
    if lo and hi: sos = butter(4, [lo, hi], btype='band', fs=SR, output='sos')
    elif lo: sos = butter(4, lo, btype='high', fs=SR, output='sos')
    else: sos = butter(4, hi, btype='low', fs=SR, output='sos')
    return sosfilt(sos, x, axis=0)


def db(v): return float(20 * np.log10(v)) if v > 1e-12 else None


def rms(x, a, b): return float(np.sqrt(np.mean(x[int(a * SR):int(b * SR)] ** 2))) if b > a else 0.0


def main(concept, version, png=False):
    base = os.path.join(HERE, concept, version)
    meta = json.load(open(glob.glob(os.path.join(base, '*.meta.json'))[0]))
    stems = {os.path.basename(p)[:-4]: rd(p) for p in sorted(glob.glob(os.path.join(base, 'render', '*.stems', '*.wav')))}
    master = rd(os.path.join(base, meta['files']['master']['path'].split('/')[-1]))
    sections = json.load(open(os.path.join(HERE, 'analysis', f'sections-{concept}.json')))['sections']
    out = {'concept': concept, 'version': version, 'sections': [], 'hook': [], 'kickSub': None, 'translation': {}}
    # 1. who owns each section (stem RMS, dBFS, before the master stage)
    for s in sections:
        row = {k: db(rms(v, s['start'], s['end'])) for k, v in stems.items()}
        out['sections'].append({'name': s['name'], 'stems': row})
    # 2. hook presence: carrier stem vs everything else, 300 Hz-4 kHz, over each carrier note window
    carrier = 'lead' if concept == 'a' else 'voice'
    others = sum(v for k, v in stems.items() if k not in (carrier, f'{carrier}-room', f'{carrier}-harm'))
    cb, ob = band(stems[carrier], 300, 4000), band(others, 300, 4000)
    env = np.sqrt(np.convolve(np.mean(cb ** 2, axis=1), np.ones(441) / 441, mode='same'))
    on = env > 10 ** (-40 / 20)
    edges = np.flatnonzero(np.diff(on.astype(int)))
    starts, ends = edges[::2] + 1, edges[1::2] + 1
    for a, b in zip(starts, ends):
        if (b - a) / SR < 0.06: continue
        c, o = rms(cb, a / SR, b / SR), rms(ob, a / SR, b / SR)
        out['hook'].append({'from': round(a / SR, 3), 'to': round(b / SR, 3), 'carrierDb': db(c), 'restDb': db(o), 'marginDb': round(db(c) - db(o), 1) if c and o else None})
    # 3. kick vs bass sub in the first 50 ms of every kick (below 120 Hz), at the engine's own trigger frames
    if 'kick' in stems:
        manifest = json.load(open(glob.glob(os.path.join(base, 'render', '*.render.json'))[0]))
        frames = [tr['frame'] for t in manifest['samples']['tracks'] if t['trackId'] == 'kick' for tr in t['triggers']]
        k_lo = band(stems['kick'], hi=120)
        subs = [v for k, v in stems.items() if k.startswith('bass')]
        b_lo = band(sum(subs), hi=120) if subs else np.zeros_like(k_lo)
        pairs = [(f / SR, rms(k_lo, f / SR, f / SR + 0.05), rms(b_lo, f / SR, f / SR + 0.05)) for f in frames]
        margins = [(round(t, 3), round(db(k) - db(b), 1)) for t, k, b in pairs if k > 1e-9 and b > 1e-9]
        vals = [m for _, m in margins]
        out['kickSub'] = {'kicks': len(frames), 'medianDb': float(np.median(vals)) if vals else None, 'minDb': float(min(vals)) if vals else None,
                          'worst': sorted(margins, key=lambda x: x[1])[:3]}
    # 4. translation proxies on the master: phone (HP 300 Hz), mono fold-down, section width
    full = master
    phone = band(full, 300)
    mono = (full[:, 0] + full[:, 1]) / 2
    for s in sections:
        f, p = rms(full, s['start'], s['end']), rms(phone, s['start'], s['end'])
        m = rms(mono[:, None], s['start'], s['end'])
        out['translation'][s['name']] = {'phoneDropDb': round(db(p) - db(f), 1) if p and f else None, 'monoDropDb': round(db(m) - db(f), 2) if m and f else None}
    path = os.path.join(base, f'{meta["name"]}.stems-analysis.json')
    json.dump(out, open(path, 'w'), indent=1)
    if png: spectrogram(master, sections, meta, os.path.join(base, f'{meta["name"]}.spectrogram.png'))
    return out


def spectrogram(x, sections, meta, path):
    import matplotlib; matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from scipy.signal import spectrogram as spg
    m = (x[:, 0] + x[:, 1]) / 2
    f, t, S = spg(m, fs=SR, nperseg=2048, noverlap=1536, window='hann')
    fig, (a1, a2) = plt.subplots(2, 1, figsize=(13, 6.5), gridspec_kw={'height_ratios': [3, 1]}, sharex=True)
    a1.pcolormesh(t, f, 10 * np.log10(S + 1e-14), shading='auto', cmap='magma', vmin=-130, vmax=-30)
    a1.set_yscale('symlog', linthresh=100); a1.set_ylim(30, 20000); a1.set_ylabel('Hz'); a1.set_title(meta['title'])
    env = 20 * np.log10(np.sqrt(np.convolve(m ** 2, np.ones(441) / 441, 'same')) + 1e-9)
    a2.plot(np.arange(len(env)) / SR, env, lw=0.6, color='k'); a2.set_ylim(-60, 0); a2.set_ylabel('dBFS (10 ms)'); a2.set_xlabel('s')
    for s in sections:
        for ax in (a1, a2): ax.axvline(s['start'], color='c', lw=0.5, alpha=0.6)
    for ax in (a1, a2): ax.axvline(4.0, color='lime', lw=1.2)
    a1.text(4.02, 15000, 'IGNITION 4.000 s', color='lime', fontsize=8)
    fig.tight_layout(); fig.savefig(path, dpi=90); plt.close(fig)


if __name__ == '__main__':
    r = main(sys.argv[1], sys.argv[2], '--png' in sys.argv)
    print(json.dumps({k: r[k] for k in ('hook', 'kickSub')}, indent=1)[:4000])
    for s in r['sections']:
        print(f"{s['name']:<22}", ' '.join(f"{k}:{v:.0f}" if v is not None else f'{k}:-' for k, v in s['stems'].items()))
    for k, v in r['translation'].items(): print(f'{k:<22} phone {v["phoneDropDb"]} dB, mono {v["monoDropDb"]} dB')
