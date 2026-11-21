"""
Technical QA measurements for CONCRETE GOSPEL (analysis only; not part of the build).

    node experiments/concrete-gospel-001/build.ts
    python3 -I experiments/concrete-gospel-001/qa/measure.py experiments/concrete-gospel-001/build

Needs numpy, scipy and FFmpeg. Writes <build>/qa.json and prints a summary. Numbers are signal measurements, not
judgements of musical quality; nobody has listened yet.
"""
import json, re, subprocess, sys, wave
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt

SR, BPM = 44100, 144
BS = round(60e6 / BPM) / 1e6          # engine beat length (integer-microsecond tempo)
BAR = 4 * BS
STEMS = ['kick', 'snare', 'hats', 'toll', 'clank', 'bass808', 'reed-far', 'reed', 'choir-far', 'choir', 'room-far', 'room']
SECTIONS = [('sermon bars 1-4', 0, 4), ('doors bars 5-8', 4, 8), ('push bars 9-11', 8, 11), ('crack bar 12', 11, 12), ('return bars 13-16', 12, 16)]


def read(path):
    with wave.open(str(path), 'rb') as w:
        n, ch = w.getnframes(), w.getnchannels()
        x = np.frombuffer(w.readframes(n), dtype='<i2').astype(np.float64) / 32768.0
    return x.reshape(-1, ch)


def db(v):
    return float(20 * np.log10(max(float(v), 1e-12)))


def rms(s):
    return float(np.sqrt(np.mean(s ** 2))) if len(s) else 0.0


def ebur128(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-nostats', '-i', str(path), '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    s = r.stderr[r.stderr.rfind('Summary:'):]
    i = re.search(r'I:\s+(-?[\d.]+|-inf) LUFS', s)
    tp = re.search(r'Peak:\s+(-?[\d.]+|-inf) dBFS', s)
    f = lambda m: None if not m or m.group(1) == '-inf' else float(m.group(1))
    return f(i), f(tp)


def band(sig, lo, hi):
    return sosfilt(butter(4, [lo, hi], btype='band', fs=SR, output='sos'), sig)


def f0(sig, t0, t1, fmin=25, fmax=300, win=0.06, hop=0.01):
    """YIN pitch estimates (Hz) between t0 and t1 seconds."""
    out, t = [], t0
    while t < t1:
        a = int(t * SR); x = sig[a:a + int(win * SR)]; t += hop
        if len(x) < int(win * SR) or rms(x) < 1e-4:
            continue
        x = x - x.mean(); W = len(x) // 2; tmax = min(int(SR / fmin), W - 1); tmin = int(SR / fmax)
        d = np.array([np.sum((x[:W] - x[k:k + W]) ** 2) for k in range(tmax + 1)])
        cm = np.ones_like(d); cs = np.cumsum(d[1:]); cm[1:] = d[1:] * np.arange(1, len(d)) / np.maximum(cs, 1e-12)
        k = next((k for k in range(tmin, tmax) if cm[k] < 0.15), None)
        if k is None:
            continue
        while k + 1 < tmax and cm[k + 1] < cm[k]:
            k += 1
        s0, s1, s2 = cm[k - 1], cm[k], cm[k + 1]; den = s0 - 2 * s1 + s2
        out.append(SR / (k + (0.5 * (s0 - s2) / den if den else 0)))
    return out


def cents(hz, midi):
    return 1200 * np.log2(hz / (440 * 2 ** ((midi - 69) / 12)))


def main(build):
    render = Path(build) / 'render'
    master_path = render / 'concrete-gospel.wav'
    master = read(master_path)
    stems = {n: read(render / 'concrete-gospel.stems' / f'{n}.wav') for n in STEMS}
    mono = {n: s.mean(axis=1) for n, s in stems.items()}
    m = master.mean(axis=1)
    qa = {}

    # 1. levels: master and every stem
    lufs, tp = ebur128(master_path)
    qa['master'] = {'frames': len(master), 'seconds': round(len(master) / SR, 6), 'integratedLufs': lufs, 'truePeakDbtp': tp,
                    'samplePeakDbfs': round(db(np.abs(master).max()), 2), 'fullScaleSamples': int(np.sum(np.abs(master) >= 32767 / 32768)),
                    'lastTenMsPeakDbfs': round(db(np.abs(master[-441:]).max()), 1), 'dcOffset': [round(float(v), 6) for v in master.mean(axis=0)],
                    'sectionRmsDbfs': {lab: round(db(rms(m[int(a * BAR * SR):int(b * BAR * SR)])), 1) for lab, a, b in SECTIONS}}
    qa['stems'] = {}
    for n in STEMS:
        L, T = ebur128(render / 'concrete-gospel.stems' / f'{n}.wav')
        qa['stems'][n] = {'frames': len(stems[n]), 'integratedLufs': L, 'truePeakDbtp': T, 'samplePeakDbfs': round(db(np.abs(stems[n]).max()), 2)}
    qa['alignment'] = {'allStemsSameFramesAsMaster': all(len(s) == len(master) for s in stems.values())}

    # 2. kick vs 808 at kick onsets: who owns which band in the first 40 ms
    score = json.loads((Path(build).parent / 'source' / 'concrete-gospel.rack.json').read_text())
    kicks = [n[0] for n in next(p for p in score['parts'] if p['id'] == 'kick-punch')['notes']]
    w = int(0.04 * SR); rows = {}
    for lab, lo, hi in [('sub 30-80 Hz', 30, 80), ('punch 80-200 Hz', 80, 200), ('click 1-5 kHz', 1000, 5000)]:
        fk, fb = band(mono['kick'], lo, hi), band(mono['bass808'], lo, hi)
        diffs = [db(rms(fk[int(round(k * BS * SR)):int(round(k * BS * SR)) + w])) - db(rms(fb[int(round(k * BS * SR)):int(round(k * BS * SR)) + w])) for k in kicks]
        rows[lab] = {'kickMinus808MedianDb': round(float(np.median(diffs)), 1), 'min': round(float(min(diffs)), 1), 'max': round(float(max(diffs)), 1)}
    qa['kickVs808FirstFortyMs'] = rows

    # 3. hook lead over everything else while the reed plays
    lead_rows = {}
    for lab, lo, hi in [('300-1000 Hz', 300, 1000), ('1-4 kHz', 1000, 4000)]:
        F = {n: band(s, lo, hi) for n, s in mono.items()}
        per = {}
        for cyc, a, b in [('bars 5-6', 16, 24), ('bars 7-8', 24, 32), ('bars 9-10', 32, 40), ('bar 11', 40, 44), ('bars 13-14', 48, 56), ('bars 15-16', 56, 64)]:
            i0, i1 = int(a * BS * SR), int(b * BS * SR); lead = F['reed'][i0:i1]; rest = sum(F[n][i0:i1] for n in STEMS if n not in ('reed', 'reed-far'))
            ww = int(0.05 * SR); act = [j for j in range(0, len(lead) - ww, ww) if rms(lead[j:j + ww]) > 10 ** (-45 / 20)]
            per[cyc] = round(db(rms(np.concatenate([lead[j:j + ww] for j in act]))) - db(rms(np.concatenate([rest[j:j + ww] for j in act]))), 1)
        lead_rows[lab] = per
    qa['hookLeadOverMixDb'] = lead_rows

    # 4. tuning: 808 notes (stable middles) and the reed's held notes
    b = mono['bass808']
    checks = [(16.3, 17.0, 29, 'F1'), (20.3, 21.0, 34, 'Bb1'), (18.8, 19.2, 41, 'F2'), (23.55, 23.9, 36, 'C2'), (39.3, 39.45, 37, 'Db2'), (37.27, 37.48, 46, 'Bb2'), (48.3, 48.45, 29, 'F1')]
    qa['tuning808Cents'] = {f'{nm} @ beat {a}': round(float(cents(np.median(f0(b, a * BS, c * BS)), mid)), 1) for a, c, mid, nm in checks}
    r = mono['reed']
    held = [(17.3, 18.3, 72, 'C5 (call)'), (22.0, 22.8, 68, 'Ab4 (answer)'), (49.3, 50.3, 72, 'C5 (return)')]
    qa['tuningReedCents'] = {f'{nm} @ beat {a}': round(float(cents(np.median(f0(r, a * BS, c * BS, fmin=150, fmax=900)), mid)), 1) for a, c, mid, nm in held}

    # 5. clicks: isolated high-frequency spikes far above the local level
    def spikes(sig, thr=10.0, floor_db=-50):
        h = np.abs(band(sig, 6000, 20000)); ref = np.sqrt(np.convolve(h ** 2, np.ones(int(0.02 * SR)) / int(0.02 * SR), mode='same')) + 1e-9
        return int(np.sum((h / ref > thr) & (h > 10 ** (floor_db / 20))))
    qa['hfSpikesAboveMinus50Dbfs'] = {n: spikes(mono[n]) for n in ['bass808', 'reed', 'choir', 'room', 'toll']} | {'master': spikes(m)}

    # 6. low end in mono
    L, R = band(master[:, 0], 20, 120), band(master[:, 1], 20, 120)
    qa['lowEndLRCorrelation20to120Hz'] = round(float(np.sum(L * R) / np.sqrt(np.sum(L * L) * np.sum(R * R))), 4)

    # 7. the bar-12 tape stop and the ending: 808 level per 0.1 beat
    qa['tapeStop808RmsPerTenthBeatFrom43.9'] = [round(db(rms(b[int((43.9 + i * 0.1) * BS * SR):int((44.0 + i * 0.1) * BS * SR)])), 1) for i in range(9)]

    (Path(build) / 'qa.json').write_text(json.dumps(qa, indent=1) + '\n')
    print(json.dumps(qa, indent=1))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else str(Path(__file__).resolve().parent.parent / 'build'))
