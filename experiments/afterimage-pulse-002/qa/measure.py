"""AFTERIMAGE//PULSE V2 technical QA (V1's tool, adapted: V2 parts, the descant, the silent hole). Signal measurements only: none of these numbers says whether the music works.

    python3 -I experiments/afterimage-pulse-002/qa/measure.py BUILD_DIR [--json OUT.json]

Reads BUILD_DIR/out/afterimage-pulse.wav (the matched master), the engine's track stems
(BUILD_DIR/engine/render/afterimage-pulse.stems/*.wav, pre-master) and source/map.json.

Measures what the brief asks to translate to headphones, a car and a phone:
  loudness        integrated / true peak / LRA (ffmpeg ebur128), per-section loudness, mono fold-down loss
  transients      kick and snare hit over the preceding 180 ms (broadband and in a phone band, 150 Hz-4 kHz)
  low end         L/R correlation and side/mid below 120 Hz; sub (<90 Hz) in the 35 ms after each kick vs 60-160 ms after
  hook            hook part over the rest of the mix during its notes (300 Hz-1 kHz, 1-4 kHz), per section; its share of
                  the 1-4 kHz band (what survives at low volume); its own side/mid and mono loss (phase-independence)
  stereo          whole-mix side/mid per section
  hygiene         clipped samples, DC, clicks in tonal stems, the last 10 ms
  tuning          held lead notes (>= 0.35 s): cents from the written pitch, on the strongest of harmonics 1-4
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy import signal

SR = 44100
NAME = 'afterimage-pulse-v2'


def read(path):
    import wave
    with wave.open(str(path), 'rb') as w:
        ch, bits, n = w.getnchannels(), w.getsampwidth() * 8, w.getnframes()
        raw = w.readframes(n)
    if bits == 16:
        x = np.frombuffer(raw, '<i2').astype(np.float64) / 32768
    elif bits == 24:
        b = np.frombuffer(raw, np.uint8).reshape(-1, 3)
        v = (b[:, 0].astype(np.int32) | (b[:, 1].astype(np.int32) << 8) | (b[:, 2].astype(np.int32) << 16))
        v = np.where(v >= 1 << 23, v - (1 << 24), v)
        x = v.astype(np.float64) / 8388608
    else:
        raise ValueError(f'{path}: {bits}-bit')
    x = x.reshape(-1, ch).T
    return x if ch == 2 else np.vstack([x[0], x[0]])


def ebur128(path):
    e = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    s = e[e.rfind('Summary:'):]
    import re
    g = lambda pat: float(re.search(pat, s).group(1))
    return {'lufs': g(r'I:\s+(-?[\d.]+) LUFS'), 'truePeakDbtp': g(r'Peak:\s+(-?[\d.]+) dBFS'), 'lra': g(r'LRA:\s+(-?[\d.]+) LU')}


def kweight(x):
    """BS.1770 K-weighting at 44.1 kHz (high-shelf + RLB high-pass, coefficients from the analogue prototypes)."""
    f0, G, Q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    K = np.tan(np.pi * f0 / SR); Vh = 10 ** (G / 20); Vb = Vh ** 0.4996667741545416
    a0 = 1 + K / Q + K * K
    b1 = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0]
    a1 = [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
    f0, Q = 38.13547087602444, 0.5003270373238773
    K = np.tan(np.pi * f0 / SR)
    a2 = [1, 2 * (K * K - 1) / (1 + K / Q + K * K), (1 - K / Q + K * K) / (1 + K / Q + K * K)]
    b2 = [1, -2, 1]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=-1), axis=-1)


def lufs_ungated(x):
    k = kweight(x)
    ms = np.mean(k ** 2, axis=-1).sum()
    return float(-0.691 + 10 * np.log10(max(ms, 1e-20)))


def band(x, lo, hi):
    sos = signal.butter(4, [lo, hi], btype='band', fs=SR, output='sos') if lo else signal.butter(4, hi, btype='low', fs=SR, output='sos')
    return signal.sosfiltfilt(sos, x, axis=-1)


db = lambda p: float(10 * np.log10(max(p, 1e-20)))
r2 = lambda v: round(float(v), 2)


def main():
    build = Path(sys.argv[1])
    out_json = sys.argv[sys.argv.index('--json') + 1] if '--json' in sys.argv else None
    here = Path(__file__).resolve().parent.parent
    m = json.loads((here / 'source' / 'map.json').read_text())
    bs = m['beatSeconds']
    master_path = build / 'out' / f'{NAME}.wav'
    mix = read(master_path)
    stems_dir = build / 'engine' / 'render' / f'{NAME}.stems'
    stems = {p.stem: read(p) for p in sorted(stems_dir.glob('*.wav'))}
    n = mix.shape[1]
    pre = sum(stems.values())                       # pre-master sum of the engine stems
    secs = [(s['id'], int(s['fromBeat'] * bs * SR), int(s['toBeat'] * bs * SR)) for s in m['sections']]
    R = {}

    # ---------------------------------------------------------------- loudness
    R['master'] = ebur128(master_path)
    R['mp3'] = ebur128(build / 'out' / f'{NAME}.mp3')
    mono = mix.mean(axis=0)
    R['monoFoldDownLossLu'] = r2(lufs_ungated(mix) - lufs_ungated(np.vstack([mono, mono])))
    R['sectionLufs'] = {sid: r2(lufs_ungated(mix[:, a:b])) for sid, a, b in secs}
    vals = list(R['sectionLufs'].values())
    R['sectionContrastLu'] = r2(max(vals) - min(vals))

    # ---------------------------------------------------------------- transients
    def hits(times, x):
        out = []
        for t in times:
            i = int(round(t * bs * SR))
            pre_ = x[:, max(0, i - int(0.18 * SR)): i - int(0.005 * SR)]
            hit = x[:, i: i + int(0.015 * SR)]
            if pre_.shape[1] < 100 or hit.shape[1] < 10:
                continue
            out.append(20 * np.log10(np.abs(hit).max() + 1e-12) - 10 * np.log10(np.mean(pre_ ** 2) + 1e-20))
        return out
    phone = band(mix, 150, 4000)
    trans = {}
    for kind in ('kicks', 'snares'):
        bysec = {}
        for sid, a, b in secs:
            ts = [t for t in m[kind] if a <= t * bs * SR < b]
            if ts:
                bysec[sid] = {'n': len(ts), 'broadbandDb': r2(np.median(hits(ts, mix))), 'phoneBandDb': r2(np.median(hits(ts, phone)))}
        trans[kind] = bysec
    R['transients'] = trans

    # ---------------------------------------------------------------- low end
    lo = band(mix, 0, 120)
    mid, side = (lo[0] + lo[1]) / 2, (lo[0] - lo[1]) / 2
    R['lowEnd'] = {'lrCorrelationBelow120': r2(np.corrcoef(lo[0], lo[1])[0, 1] * 100) / 100,
                   'sideOverMidBelow120Db': r2(db(np.mean(side ** 2)) - db(np.mean(mid ** 2)))}
    sub = band(pre.mean(axis=0, keepdims=True), 0, 90)[0]
    seps = []
    for t in m['kicks']:
        i = int(round(t * bs * SR))
        if i + int(0.16 * SR) >= n:
            continue
        a_ = np.mean(sub[i: i + int(0.035 * SR)] ** 2)
        b_ = np.mean(sub[i + int(0.06 * SR): i + int(0.16 * SR)] ** 2)
        seps.append(db(a_) - db(b_))
    R['lowEnd']['subAfterKickMinusTailDb'] = r2(np.median(seps)) if seps else None
    # the bass sub alone against the kick's own low end, per hit (does the sub get out of the kick's way?)
    if 'bass-sub' in stems and 'kick' in stems:
        bsub, kk = stems['bass-sub'].mean(axis=0), band(stems['kick'].mean(axis=0, keepdims=True), 0, 120)[0]
        d = []
        for t in m['kicks']:
            i = int(round(t * bs * SR)); w = slice(i, i + int(0.04 * SR))
            if np.mean(kk[w] ** 2) > 0:
                d.append(db(np.mean(bsub[w] ** 2)) - db(np.mean(kk[w] ** 2)))
        R['lowEnd']['bassSubUnderKickHitDb'] = r2(np.median(d)) if d else None

    # ---------------------------------------------------------------- hook audibility and phase-independence
    hook = {}
    for part in ('lead', 'voice', 'bass-mid', 'choir-high'):
        if part not in stems:
            continue
        x = stems[part]; rest = pre - x
        notes = [h for h in m['hook'] if h['part'] == part]
        mask = np.zeros(n, bool)
        for h in notes:
            a = int(h['beat'] * bs * SR); b = int((h['beat'] + h['beats']) * bs * SR)
            mask[a:b] = True
        rows = {}
        for sid, a, b in secs:
            mk = mask.copy(); mk[:a] = False; mk[b:] = False
            if mk.sum() < SR * 0.3:
                continue
            row = {}
            for lo_, hi_, key in ((300, 1000, 'over300to1kDb'), (1000, 4000, 'over1to4kDb')):
                xb, rb = band(x[:, mk], lo_, hi_), band(rest[:, mk], lo_, hi_)
                row[key] = r2(db(np.mean(xb ** 2)) - db(np.mean(rb ** 2)))
            xb, mb = band(x[:, mk], 1000, 4000), band(pre[:, mk], 1000, 4000)
            row['shareOf1to4kPct'] = r2(100 * np.mean(xb ** 2) / max(np.mean(mb ** 2), 1e-20))
            rows[sid] = row
        xm = x[:, mask]
        s_, m_ = (xm[0] - xm[1]) / 2, (xm[0] + xm[1]) / 2
        hook[part] = {'bySection': rows, 'sideOverMidDb': r2(db(np.mean(s_ ** 2)) - db(np.mean(m_ ** 2))),
                      'monoLossDb': r2(db(np.mean(xm ** 2)) - db(np.mean(((xm[0] + xm[1]) / 2) ** 2)))}
    R['hook'] = hook
    # the payoff descant (a countermelody, not the hook): over the rest of the mix while it sings
    cmask = np.zeros(n, bool)
    for h in m.get('counter', []):
        cmask[int(h['beat'] * bs * SR):int((h['beat'] + h['beats']) * bs * SR)] = True
    if cmask.any() and 'choir-high' in stems:
        x = stems['choir-high'][:, cmask]; rest = pre[:, cmask] - x
        R['descant'] = {k: r2(db(np.mean(band(x, lo_, hi_) ** 2)) - db(np.mean(band(rest, lo_, hi_) ** 2))) for lo_, hi_, k in ((300, 1000, 'over300to1kDb'), (1000, 4000, 'over1to4kDb'))}
    # the glitch's silent hole: how far below the bar around it
    if 'hole' in m:
        a = int(m['hole']['from'] * bs * SR) + int(0.03 * SR); b = int(m['hole']['to'] * bs * SR) - int(0.005 * SR)
        around = mix[:, int((m['hole']['from'] - 1.5) * bs * SR): int(m['hole']['from'] * bs * SR)]
        R['hole'] = {'ms': r2((b - a) / SR * 1000), 'belowPrecedingDb': r2(db(np.mean(mix[:, a:b] ** 2)) - db(np.mean(around ** 2)))}

    # ---------------------------------------------------------------- stereo
    R['stereoSideOverMidDb'] = {sid: r2(db(np.mean(((mix[0, a:b] - mix[1, a:b]) / 2) ** 2)) - db(np.mean(((mix[0, a:b] + mix[1, a:b]) / 2) ** 2))) for sid, a, b in secs}

    # ---------------------------------------------------------------- hygiene
    hyg = {'masterFullScaleSamples': int((np.abs(mix) >= 0.9999).sum()), 'masterDc': [r2(mix[0].mean() * 1e4) / 1e4, r2(mix[1].mean() * 1e4) / 1e4],
           'last10msDbfs': r2(20 * np.log10(np.abs(mix[:, -int(0.01 * SR):]).max() + 1e-12)),
           'stemPeaksDbfs': {k: r2(20 * np.log10(np.abs(v).max() + 1e-12)) for k, v in stems.items()}}
    clicks = {}
    hp = signal.butter(4, 9000, btype='high', fs=SR, output='sos')
    for k in ('lead', 'pad', 'voice', 'choir-low', 'choir-high', 'bass-mid', 'echo'):
        if k not in stems:
            continue
        y = signal.sosfilt(hp, stems[k].mean(axis=0))
        env = np.sqrt(signal.lfilter([1 / 441], [1, -(1 - 1 / 441)], y ** 2)) + 1e-5
        spikes = np.where((np.abs(y) > 0.02) & (np.abs(y) > 12 * np.roll(env, 220)))[0]
        ev = np.unique(spikes // int(0.01 * SR)) * 0.01
        on = np.array(sorted(h['beat'] * bs for h in m['hook'] if h['part'] == k)) if k in ('lead', 'voice', 'bass-mid') else np.array([])
        away = [e for e in ev if not len(on) or np.min(np.abs(on - e)) > 0.025]
        clicks[k] = {'hfEvents': int(len(ev)), 'awayFromWrittenOnsets': int(len(away)) if len(on) else None}
    hyg['clickEvents'] = clicks
    R['hygiene'] = hyg

    # ---------------------------------------------------------------- tuning of held lead notes
    lead = stems.get('lead')
    cents = []
    if lead is not None:
        y = lead.mean(axis=0)
        for h in m['hook']:
            if h['part'] != 'lead' or h['beats'] * bs < 0.35:
                continue
            end = min(0.9 * h['beats'], h['beats'] - h.get('fallBeats', 0))       # a written fall is not a tuning error
            a = int((h['beat'] + 0.4 * h['beats']) * bs * SR); b = int((h['beat'] + end) * bs * SR)
            if b - a < int(0.1 * SR):
                continue
            seg = y[a:b] * np.hanning(b - a)
            N = 1 << 18
            sp = np.abs(np.fft.rfft(seg, N)); fr = np.fft.rfftfreq(N, 1 / SR)
            f0 = 440 * 2 ** ((h['pitch'] - 69) / 12)
            best = None
            for k_ in (1, 2, 3, 4):
                lo_, hi_ = k_ * f0 * 2 ** (-0.6 / 12), k_ * f0 * 2 ** (0.6 / 12)
                sel = (fr > lo_) & (fr < hi_)
                if not sel.any():
                    continue
                j = np.argmax(sp * sel)
                if best is None or sp[j] > best[0]:
                    best = (sp[j], fr[j] / k_)
            if best:
                cents.append(1200 * np.log2(best[1] / f0))
    R['leadHeldNoteCents'] = {'n': len(cents), 'min': r2(min(cents)), 'max': r2(max(cents)), 'medianAbs': r2(np.median(np.abs(cents)))} if cents else None

    txt = json.dumps(R, indent=1)
    if out_json:
        Path(out_json).write_text(txt + '\n')
    print(txt)


if __name__ == '__main__':
    main()
