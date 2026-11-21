"""
THE CATHEDRAL EXPERIMENT · technical QA (analysis only: numpy, scipy, FFmpeg). Signal measurements, not a verdict.

    python3 -I experiments/cathedral-experiment-001/qa/measure.py experiments/cathedral-experiment-001/build [--json OUT.json]

Per audition (and the V2 reference, measured on V2's own engine stems the same way):
  - stem loudness over the excerpt (EBU R128 via FFmpeg)
  - hook lead over the rest of the mix, per two-bar cycle, 300 Hz-1 kHz and 1-4 kHz (Concrete Gospel V2's own metric)
  - listening file: loudness, true peak, LRA, full-scale samples, last-10-ms peak, DC
  - spectral balance of the listening file (energy share per band) next to the V2 reference
  - drum punch in the listening file: kick and snare hit peaks over the preceding 180 ms (V2's metric)
  - high-frequency spikes (clicks) in the new instrument stems
  - tuning of held lead notes (power-weighted mean frequency, robust to vibrato)
Choir audition only: per-bar loudness of the choir and of the mix, the choir's low-mid (200-500 Hz) and height
(>2 kHz, >5 kHz) shares per section of the form, its stereo width, and the tuning of the final chord.
"""
import json, re, subprocess, sys, tempfile, wave
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
BS = round(60e6 / 144) / 1e6  # engine beat seconds at 144 BPM


def frame(beat):
    # engine-identical frame of a beat (960 PPQ, integer-microsecond tempo, round half up)
    tick = round(beat * 960)
    return (tick * round(60e6 / 144) * SR + 480_000_000) // 960_000_000


def read(p):
    with wave.open(str(p), 'rb') as w:
        ch, n, bw = w.getnchannels(), w.getnframes(), w.getsampwidth(); raw = w.readframes(n)
    if bw == 2:
        x = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    else:
        b = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3).astype(np.int32)
        x = ((b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16)) << 8 >> 8).astype(np.float64) / 8388608.0
    return x.reshape(-1, ch)


def db(v):
    return float(20 * np.log10(max(float(v), 1e-12)))


def rms(s):
    return float(np.sqrt(np.mean(s ** 2))) if len(s) else 0.0


def band(x, lo, hi):
    return sosfilt(butter(4, [lo, hi], btype='band', fs=SR, output='sos'), x, axis=0)


def ebur(x):
    with tempfile.NamedTemporaryFile(suffix='.wav') as f:
        with wave.open(f.name, 'wb') as w:
            w.setnchannels(x.shape[1]); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())
        e = subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-nostats', '-i', f.name, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    s = e[e.rfind('Summary:'):]
    g = lambda p: (lambda m: None if not m or m.group(1) == '-inf' else float(m.group(1)))(re.search(p, s))
    return {'lufs': g(r'I:\s+(-?[\d.]+|-inf) LUFS'), 'truePeak': g(r'Peak:\s+(-?[\d.]+|-inf) dBFS'), 'lra': g(r'LRA:\s+(-?[\d.]+) LU')}


def lead_over_mix(stems, lead, rest_names, cycles):
    out = {}
    for lab, lo, hi in [('300-1000 Hz', 300, 1000), ('1-4 kHz', 1000, 4000)]:
        L = band(stems[lead].mean(axis=1), lo, hi); R = band(sum(stems[n].mean(axis=1) for n in rest_names), lo, hi); per = {}
        for cyc, a, b in cycles:
            i0, i1 = frame(a), frame(b); r, q = L[i0:i1], R[i0:i1]; ww = int(0.05 * SR)
            act = [j for j in range(0, len(r) - ww, ww) if rms(r[j:j + ww]) > 10 ** (-45 / 20)]
            if act:
                per[cyc] = round(db(rms(np.concatenate([r[j:j + ww] for j in act]))) - db(rms(np.concatenate([q[j:j + ww] for j in act]))), 1)
        out[lab] = per
    return out


BANDS = [(20, 60), (60, 120), (120, 250), (250, 500), (500, 1000), (1000, 2000), (2000, 4000), (4000, 8000), (8000, 16000)]


def shares(x):
    m = x.mean(axis=1) if x.ndim > 1 else x
    X = np.abs(np.fft.rfft(m * np.hanning(len(m)))) ** 2; f = np.fft.rfftfreq(len(m), 1 / SR); tot = X.sum() + 1e-30
    return {f'{a}-{b}': round(100 * float(X[(f >= a) & (f < b)].sum() / tot), 1) for a, b in BANDS}


def punch(x, hits):
    m = np.abs(x).max(axis=1); vals = []
    for h in hits:
        i = frame(h)
        if i + int(0.03 * SR) > len(m): continue
        pk = m[i:i + int(0.03 * SR)].max(); pre = rms(x[max(0, i - int(0.18 * SR)):i].mean(axis=1))
        vals.append(db(pk) - db(pre))
    return round(float(np.median(vals)), 1) if vals else None


def spikes(sig):
    h = np.abs(band(sig, 6000, 20000)); ref = np.sqrt(np.convolve(h ** 2, np.ones(882) / 882, mode='same')) + 1e-9
    return int(np.sum((h / ref > 10) & (h > 10 ** (-50 / 20))))


def cents_of(stem, beat0, beat1, midi):
    # QA fix F5: the power-weighted mean frequency (the carrier of a vibrato tone) of the STRONGEST of harmonics 1-5,
    # divided by its number. Measuring the fundamental alone was biased where it is weak (tenor and alto "ah": H1 about
    # 8 dB under H3, close to the breath noise).
    fn = 440 * 2 ** ((midi - 69) / 12); x = stem[frame(beat0):frame(beat1)].mean(axis=1)
    n = len(x); X = np.abs(np.fft.rfft(x * np.hanning(n), 8 * n)) ** 2; f = np.fft.rfftfreq(8 * n, 1 / SR)
    h = max(range(1, 6), key=lambda k: X[(f > k * fn * 0.97) & (f < k * fn * 1.03)].sum())
    b = (f > h * fn * 0.97) & (f < h * fn * 1.03)
    return round(1200 * np.log2(float((X[b] * f[b]).sum() / X[b].sum()) / h / fn), 1)


KICKS, SNARES = None, None


def drum_times(v2_compose_json):
    return v2_compose_json


def main(build):
    B = Path(build); man = json.loads((B / 'manifest.json').read_text()); out = {'listening': {}}
    for f in man['files']:
        x = read(B.parent / f['wav']); l = ebur(x)
        out['listening'][f['id']] = {'seconds': f['seconds'], 'lufs': l['lufs'], 'truePeakDbtp': l['truePeak'], 'lra': l['lra'], 'gainAppliedDb': f['gainDb'],
                                     'samplePeakDbfs': round(db(np.abs(x).max()), 2), 'fullScaleSamples': int(np.sum(np.abs(x) >= 1 - 1 / 8388608)),
                                     'lastTenMsPeakDbfs': round(db(np.abs(x[-441:]).max()), 1), 'dc': round(float(x.mean()), 6), 'bandShares%': shares(x)}
    def lowimg(x):
        a, b = band(x[:, 0], 20, 120), band(x[:, 1], 20, 120)
        return {'corr': round(float(np.sum(a * b) / np.sqrt(np.sum(a * a) * np.sum(b * b) + 1e-30)), 4), 'leftMinusRightDb': round(db(rms(a)) - db(rms(b)), 1)}
    lowEnd = {}
    for f in man['files']:
        x = read(B.parent / f['wav']); lowEnd[f['id']] = lowimg(x)
        if f['id'] == '2-cathedral-engine': lowEnd['2-cathedral-engine bar 12'] = lowimg(x[frame(28.5):frame(32)])
        if f['id'] == '3-heaven-mass': lowEnd['3-heaven-mass bar 12 + tail'] = lowimg(x[frame(44):])
    out['lowEndBelow120Hz'] = lowEnd
    # drum hit times from V2's own project (kick and snare tracks), as beats
    proj = json.loads((B / 'engine' / '1-throne-volt' / '1-throne-volt.json').read_text())
    def beats(track, pitch):
        t = next(t for t in proj['tracks'] if t['id'] == track); res = []
        for n in t['patterns'][0]['notes']:
            if n.get('pitch') != pitch: continue
            m = re.match(r'(\d+):(\d+)(?:\+(\d+)/(\d+))?$', n['start']); res.append((int(m[1]) - 1) * 4 + int(m[2]) - 1 + (int(m[3]) / int(m[4]) * 4 if m[3] else 0))
        return sorted(set(res))
    kicks, snares = beats('kick', 'iron-pulse'), beats('snare', 'crack')
    snares = [b for b in snares if b in (18, 22, 26, 30, 34, 38, 42, 50, 54, 58, 62)]
    cycles16 = [('bars 5-6', 16, 24), ('bars 7-8', 24, 32), ('bars 9-10', 32, 40), ('bar 11', 40, 44), ('bars 13-14', 48, 56), ('bars 15-16', 56, 64)]
    # ---------------------------------------------------------------- V2 reference and auditions 1-2
    def stems_of(d):
        return {p.stem: read(p) for p in sorted(d.glob('*.wav'))}
    v2 = stems_of(B / 'v2' / 'render' / 'concrete-gospel.stems')
    a16, b16 = frame(16), None
    lead = {}
    lead['0-v2-reference'] = lead_over_mix(v2, 'reed', [n for n in v2 if n not in ('reed', 'reed-far')], cycles16)
    st1 = stems_of(B / 'engine' / '1-throne-volt' / 'render' / '1-throne-volt.stems')
    st2 = stems_of(B / 'engine' / '2-cathedral-engine' / 'render' / '2-cathedral-engine.stems')
    lead['1-throne-volt'] = lead_over_mix(st1, 'volt', [n for n in st1 if n != 'volt'], cycles16)
    lead['2-cathedral-engine'] = lead_over_mix(st2, 'great', [n for n in st2 if n != 'great'], [c for c in cycles16 if c[0] != 'bar 11'])
    out['hookLeadOverMixDb'] = lead
    win = lambda st: {n: ebur(s[a16:])['lufs'] for n, s in st.items()}
    out['stemLufsBars5to16'] = {'0-v2-reference': win(v2), '1-throne-volt': win(st1), '2-cathedral-engine': win(st2)}
    # drum punch in the listening files (bars 5-16 start at frame(16) in the source, at 0 in the cut)
    def punch_in(fid, offset_beats):
        x = read(B.parent / next(f for f in man['files'] if f['id'] == fid)['wav'])
        sh = lambda hs: [h - offset_beats for h in hs if h >= offset_beats]
        return {'kick': punch(x, [h for h in sh(kicks) if frame(h) > int(0.2 * SR)]), 'snare': punch(x, [h for h in sh(snares) if frame(h) > int(0.2 * SR)])}
    out['drumHitOverPreceding180msDb'] = {fid: punch_in(fid, 16 if fid != '3-heaven-mass' else 0) for fid in ['0-v2-reference', '1-throne-volt', '2-cathedral-engine', '3-heaven-mass']}
    # clicks in the new stems
    st3 = stems_of(B / 'engine' / '3-heaven-mass' / 'render' / '3-heaven-mass.stems')
    out['hfSpikesAboveMinus50Dbfs'] = {f'{k}/{n}': spikes(s.mean(axis=1)) for k, st, names in [('1', st1, ['volt', 'volt-amen', 'room']), ('2', st2, ['great', 'swell', 'pedal']), ('3', st3, ['bass', 'tenor', 'alto', 'soprano', 'soprano-2', 'descant'])] for n, s in st.items() if n in names}
    # tuning of held lead notes: the long C5 of each call (beats c+1.25 .. c+2.4) and the Ab4 before its fall
    tune = {}
    for name, st, key in [('1-throne-volt', st1, 'volt'), ('2-cathedral-engine', st2, 'great')]:
        cs = [cents_of(st[key], c + 1.3, c + 2.4, 72) for c in (16, 24, 32, 40, 48, 56)]
        ab = [cents_of(st[key], c + 5.65, c + 6.5 if name.startswith('1') else c + 6.6, 68) for c in (16, 24, 48)]
        tune[name] = {'C5 held (6 calls)': cs, 'Ab4 before the fall': ab}
    out['leadTuningCents'] = tune
    # ---------------------------------------------------------------- choir audition
    names = ['bass', 'tenor', 'alto', 'soprano', 'soprano-2', 'descant']
    choir = sum(st3[n] for n in names); mix3 = read(B / 'engine' / '3-heaven-mass' / 'render' / '3-heaven-mass.wav')
    per_bar = {}
    for bar in range(1, 13):
        i0, i1 = frame((bar - 1) * 4), frame(bar * 4)
        per_bar[bar] = {'choirRmsDbfs': round(db(rms(choir[i0:i1])), 1), 'mixRmsDbfs': round(db(rms(mix3[i0:i1])), 1)}
    tail = (frame(48), len(mix3))
    per_bar['bar 12 + tail'] = {'choirRmsDbfs': round(db(rms(choir[frame(44):])), 1), 'mixRmsDbfs': round(db(rms(mix3[frame(44):])), 1)}
    form = {'intimate (bars 1-4)': (0, 16), 'drop (bars 5-8)': (16, 32), 'climb (bars 9-11)': (32, 44), 'heaven (bar 12 + tail)': (44, None)}
    def part(x, a, b):
        return x[frame(a):(frame(b) if b is not None else len(x))]
    colour = {}
    for lab, (a, b) in form.items():
        c = part(choir, a, b); s = shares(c); M, S = c.mean(axis=1), (c[:, 0] - c[:, 1]) / 2
        colour[lab] = {'lowMid200-500%': round(sum(v for k, v in s.items() if k in ('250-500',)) + 0.5 * s['120-250'], 1), 'above2k%': round(s['2000-4000'] + s['4000-8000'] + s['8000-16000'], 1),
                       'above5k%': round(100 * float((lambda X, f: X[f >= 5000].sum() / X.sum())(np.abs(np.fft.rfft(c.mean(axis=1))) ** 2, np.fft.rfftfreq(len(c), 1 / SR))), 2),
                       'below120%': round(s['20-60'] + s['60-120'], 1), 'sideOverMidDb': round(db(rms(S)) - db(rms(M)), 1), 'bandShares%': s}
    out['choir'] = {'perBar': per_bar, 'colour': colour}
    # final-chord tuning, measured where there is no room tail to bias it: the dry example ends on the same F major
    # chord (A just-intoned: intended -13.7 cents; C +2.0; F 0). The audition's own chord is reported beside it, with
    # the caveat that the Nave's tail of the Bb suspension (6 % above the A) sits inside the analysis band.
    D = B / 'rack' / 'dry-heaven-mass' / 'stems'
    dry = {n: read(D / f'{n}.wav') for n in ['bass', 'tenor', 'alto', 'soprano']}
    out['choir']['finalChordCentsDry'] = {'soprano A5 (intended -13.7)': cents_of(dry['soprano'], 44, 47, 81), 'tenor A3 (intended -13.7)': cents_of(dry['tenor'], 44, 47, 57),
                                          'alto F4 (intended 0)': cents_of(dry['alto'], 44, 47, 65), 'bass F2 (intended 0)': cents_of(dry['bass'], 44, 47, 41)}
    out['choir']['finalChordCentsInAuditionWithRoom'] = {'soprano A5': cents_of(st3['soprano'], 46.5, 48, 81), 'tenor A3': cents_of(st3['tenor'], 46.5, 48, 57), 'alto F4': cents_of(st3['alto'], 46.5, 48, 65)}
    # onset alignment: the new stems must start on the beat the score writes (rack frames = engine frames)
    def onset(x, from_beat):
        m = np.abs(x.mean(axis=1)); i0 = max(0, frame(from_beat) - int(0.05 * SR)); thr = 10 ** (-50 / 20)  # F5: clamped at 0
        j = np.argmax(m[i0:] > thr); return round((i0 + j - frame(from_beat)) / SR * 1000, 2)
    out['onsetMsAfterWrittenBeat'] = {'1/volt (beat 16)': onset(st1['volt'], 16), '2/great (beat 16)': onset(st2['great'], 16), '3/bass (beat 0)': onset(st3['bass'], 0.0)}
    out['choir']['stemLufs'] = {n: ebur(st3[n])['lufs'] for n in names}
    return out


if __name__ == '__main__':
    res = main(sys.argv[1]); txt = json.dumps(res, indent=1)
    if '--json' in sys.argv:
        Path(sys.argv[sys.argv.index('--json') + 1]).write_text(txt + '\n')
    print(txt)
