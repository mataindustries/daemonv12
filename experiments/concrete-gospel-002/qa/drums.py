"""
Drum and low-end measurements for a CONCRETE GOSPEL build (V1 or V2), from the engine render, its stems and the
resolved trigger frames in its manifest. Analysis only: numbers describe signals, not musical quality.

    python3 -I experiments/concrete-gospel-002/qa/drums.py BUILD_DIR [--name RENDER_NAME] [--json OUT.json]

BUILD_DIR is a build directory containing render/concrete-gospel.render.json, the master and its stems (V1:
experiments/concrete-gospel-001/build, V2: experiments/concrete-gospel-002/build). Needs numpy, scipy.
"""
import json, sys, wave
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
BS = round(60e6 / 144) / 1e6


def read(path):
    with wave.open(str(path), 'rb') as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float64) / 32768.0
    return x.reshape(-1, 2).mean(axis=1)


def db(v):
    return float(20 * np.log10(max(float(v), 1e-12)))


def rms(s):
    return float(np.sqrt(np.mean(s ** 2))) if len(s) else 0.0


def bp(sig, lo, hi):
    if lo <= 0:
        return sosfilt(butter(4, hi, btype='low', fs=SR, output='sos'), sig)
    if hi >= SR / 2:
        return sosfilt(butter(4, lo, btype='high', fs=SR, output='sos'), sig)
    return sosfilt(butter(4, [lo, hi], btype='band', fs=SR, output='sos'), sig)


def phone(sig):
    """Rough small-speaker band: nothing useful below about 250 Hz, rolled off above 10 kHz."""
    return bp(sig, 250, 10000)


def med(xs):
    return round(float(np.median(xs)), 1)


def onsets(manifest, track, min_vel=0.0, exclude_frame0=True):
    t = next(t for t in manifest['samples']['tracks'] if t['trackId'] == track)
    frames = sorted({tr['frame'] for tr in t['triggers'] if tr['velocity'] >= min_vel and not (exclude_frame0 and tr['frame'] == 0)})
    return frames


def measure(build, name='concrete-gospel'):
    build = Path(build)
    R = build / 'render'
    man = json.loads((R / f'{name}.render.json').read_text())
    st = {n: read(R / f'{name}.stems' / f'{n}.wav') for n in ['kick', 'snare', 'hats', 'bass808']}
    allstems = sorted((R / f'{name}.stems').glob('*.wav'))
    premaster = sum(read(p) for p in allstems)
    master = read(R / f'{name}.wav')
    out = {}

    # ---------------------------------------------------------------- kick
    K = onsets(man, 'kick')
    k, b = st['kick'], st['bass808']
    w = lambda i, a_ms, b_ms: slice(i + int(a_ms * SR / 1000), i + int(b_ms * SR / 1000))
    WIN = [(0, 5), (5, 20), (20, 50), (50, 100), (100, 200)]
    peaks, prof, clickr, knockr = [], [], [], []
    bands = {'sub <60': (0, 60), 'body 60-120': (60, 120), 'knock 120-300': (120, 300), '300-1k': (300, 1000), 'click 1-5k': (1000, 5000), '>5k': (5000, SR / 2)}
    bandE = {n: 0.0 for n in bands}
    kb = {n: bp(k, lo, hi) for n, (lo, hi) in bands.items()}
    for i in K:
        peaks.append(db(np.abs(k[w(i, 0, 60)]).max()))
        body = rms(kb['body 60-120'][w(i, 0, 60)] + kb['sub <60'][w(i, 0, 60)])
        clickr.append(db(rms(bp(k[w(i, -5, 20)], 1500, 6000)[int(0.005 * SR):int(0.013 * SR)])) - db(body))
        knockr.append(db(rms(kb['knock 120-300'][w(i, 0, 20)])) - db(body))
        prof.append([db(rms(k[w(i, a, b_)])) for a, b_ in WIN])
        for n in bands:
            bandE[n] += float(np.sum(kb[n][w(i, 0, 120)] ** 2))
    tot = sum(bandE.values()); pm = np.median(np.array(prof), axis=0)
    out['kick'] = {
        'hits': len(K),
        'peakDbfsMedian': med(peaks), 'peakSpreadDb': round(float(np.std(peaks)), 2),
        'rmsDbfsByWindowMs (median)': {f'{a}-{b_}': round(float(v), 1) for (a, b_), v in zip(WIN, pm)},
        'click 1.5-6k (0-8 ms) vs body <120 Hz (0-60 ms), dB median': med(clickr),
        'knock 120-300 (0-20 ms) vs body <120 Hz (0-60 ms), dB median': med(knockr),
        'first120msEnergyShare%': {n: round(100 * e / tot, 1) for n, e in bandE.items()},
    }

    # ---------------------------------------------------------------- kick vs 808
    kl, bl = bp(k, 0, 120), bp(b, 0, 120)
    ratio, duck, kvb_phone, kvb_low = [], [], [], []
    kp, bpn = phone(k), phone(b)
    for i in K:
        s = w(i, 0, 60)
        ek, eb, es = np.sum(kl[s] ** 2), np.sum(bl[s] ** 2), np.sum((kl[s] + bl[s]) ** 2)
        if ek > 1e-9 and eb > 1e-9:
            ratio.append(10 * np.log10(es / (ek + eb)))
        # 808 level just after the kick against the same note once the duck has recovered (150-250 ms)
        duck.append(db(rms(b[w(i, 5, 35)])) - db(rms(b[w(i, 150, 250)])) if rms(b[w(i, 150, 250)]) > 1e-3 else None)
        kvb_phone.append(db(rms(kp[w(i, 0, 30)])) - db(rms(bpn[w(i, 0, 30)])))
        kvb_low.append(db(rms(kl[w(i, 0, 40)])) - db(rms(bl[w(i, 0, 40)])))
    dk = [d for d in duck if d is not None]
    out['kickVs808'] = {
        'lowSumVsPowerSumDb(0-60ms,<120Hz) median/min/max': [med(ratio), round(min(ratio), 1), round(max(ratio), 1)],
        'note': 'positive = kick and 808 lows reinforce, negative = they cancel; 0 = uncorrelated',
        'kickMinus808Below120HzFirst40msDb(median)': med(kvb_low),
        'kickMinus808PhoneBandFirst30msDb(median)': med(kvb_phone),
        '808At5-35msVs150-250msDb(median, where the 808 still sounds at 150-250 ms)': med(dk) if dk else None,
    }

    # ---------------------------------------------------------------- snare
    S = onsets(man, 'snare', min_vel=0.6)
    s = st['snare']
    sb = {'<150': (0, 150), 'body 150-300': (150, 300), '300-1.5k': (300, 1500), 'crack 1.5-6k': (1500, 6000), 'air >6k': (6000, SR / 2)}
    sE = {n: 0.0 for n in sb}; sbf = {n: bp(s, lo, hi) for n, (lo, hi) in sb.items()}
    SW = [(0, 10), (10, 40), (40, 100), (100, 200), (200, 400)]
    late, spk, sprof = [], [], []
    for i in S:
        for n in sb:
            sE[n] += float(np.sum(sbf[n][w(i, 0, 150)] ** 2))
        e_all = np.sum(s[w(i, 0, 600)] ** 2); late.append(100 * np.sum(s[w(i, 150, 600)] ** 2) / max(e_all, 1e-12))
        spk.append(db(np.abs(s[w(i, 0, 40)]).max()))
        sprof.append([db(rms(s[w(i, a, b_)])) for a, b_ in SW])
    st_ = sum(sE.values()); sp = np.median(np.array(sprof), axis=0)
    out['snare'] = {'hits': len(S), 'peakDbfsMedian': med(spk), 'first150msEnergyShare%': {n: round(100 * e / st_, 1) for n, e in sE.items()},
                    'rmsDbfsByWindowMs (median)': {f'{a}-{b_}': round(float(v), 1) for (a, b_), v in zip(SW, sp)}, 'energyAfter150ms%': med(late)}

    # ---------------------------------------------------------------- how far the hits jump out of the mix
    def jump(sig, frames, band=None):
        x = band(sig) if band else sig
        return med([db(np.abs(x[w(i, 0, 15)]).max()) - db(rms(x[w(i, -200, -20)])) for i in frames])
    out['transientJumpDb (peak in 15 ms after the hit over RMS of the 180 ms before)'] = {
        'kick: master full band': jump(master, K), 'kick: pre-master sum': jump(premaster, K), 'kick: master phone band': jump(master, K, phone),
        'snare: master full band': jump(master, S), 'snare: pre-master sum': jump(premaster, S), 'snare: master phone band': jump(master, S, phone),
    }

    # ---------------------------------------------------------------- low-frequency balance and level relationships (bars 5-11, 13-16)
    spans = [(16, 44), (48, 64)]
    def span(sig):
        return np.concatenate([sig[int(a * BS * SR):int(b_ * BS * SR)] for a, b_ in spans])
    lf = {n: rms(bp(span(st[n]), 0, 100)) for n in ['kick', 'bass808']}
    out['lowFrequency'] = {
        'below100HzRmsDbfs kick / 808': [round(db(lf['kick']), 1), round(db(lf['bass808']), 1)],
        'below100Hz kick share of (kick+808) power %': round(100 * lf['kick'] ** 2 / (lf['kick'] ** 2 + lf['bass808'] ** 2), 1),
        'master below 100 Hz RMS dBFS': round(db(rms(bp(span(master), 0, 100)))), 'master RMS dBFS': round(db(rms(span(master))), 1),
        'master sample peak dBFS': round(db(np.abs(master).max()), 2),
        'master crest (peak - RMS, dB)': round(db(np.abs(span(master)).max()) - db(rms(span(master))), 1),
    }
    return out


if __name__ == '__main__':
    res = measure(sys.argv[1], sys.argv[sys.argv.index('--name') + 1] if '--name' in sys.argv else 'concrete-gospel')
    txt = json.dumps(res, indent=1)
    if '--json' in sys.argv:
        Path(sys.argv[sys.argv.index('--json') + 1]).write_text(txt + '\n')
    print(txt)
