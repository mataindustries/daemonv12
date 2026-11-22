"""
CONCRETE GOSPEL · FULL-LENGTH EDITION · technical QA (analysis only: numpy, scipy, FFmpeg). Signal measurements, not a verdict.

    python3 -I experiments/concrete-gospel-004/qa/measure.py experiments/concrete-gospel-004/build [--json OUT.json]

  - the record: loudness, true peak (WAV and MP3), LRA, full-scale samples, DC, the last 10 ms, mono fold-down (phones)
  - the arc: loudness, width and low end per section
  - drum punch per drum section (kick and snare hit over the preceding 180 ms) against V2's own master
  - the lead over the rest of the mix during its own notes, per section, 300 Hz-1 kHz and 1-4 kHz (V2's metric)
  - low end while the 808 plays: the new parts below 120 Hz and at 120-250 Hz against the 808
  - room for a voice: melodic parts (lead, organ, choir) in 300 Hz-3 kHz against the drums and 808, verses vs choruses
  - the choir's arc; clicks in the new stems; per-track clipping in the engine; tuning of held notes and the last chord
"""
import json, re, subprocess, sys, tempfile, wave
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
NAME = 'concrete-gospel-full-length'


def frame(beat):
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
    if lo is None:
        return sosfilt(butter(4, hi, btype='low', fs=SR, output='sos'), x, axis=0)
    return sosfilt(butter(4, [lo, hi], btype='band', fs=SR, output='sos'), x, axis=0)


def ebur_file(path):
    e = subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-nostats', '-i', str(path), '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    s = e[e.rfind('Summary:'):]
    g = lambda p: (lambda m: None if not m or m.group(1) == '-inf' else float(m.group(1)))(re.search(p, s))
    return {'lufs': g(r'I:\s+(-?[\d.]+|-inf) LUFS'), 'truePeak': g(r'Peak:\s+(-?[\d.]+|-inf) dBFS'), 'lra': g(r'LRA:\s+(-?[\d.]+) LU')}


def ebur(x):
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    with tempfile.NamedTemporaryFile(suffix='.wav') as f:
        with wave.open(f.name, 'wb') as w:
            w.setnchannels(x.shape[1]); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())
        return ebur_file(f.name)


BANDS = [(20, 60), (60, 120), (120, 250), (250, 500), (500, 1000), (1000, 2000), (2000, 4000), (4000, 8000), (8000, 16000)]


def shares(x):
    m = x.mean(axis=1) if x.ndim > 1 else x
    X = np.abs(np.fft.rfft(m * np.hanning(len(m)))) ** 2; f = np.fft.rfftfreq(len(m), 1 / SR); tot = X.sum() + 1e-30
    return {f'{a}-{b}': round(100 * float(X[(f >= a) & (f < b)].sum() / tot), 1) for a, b in BANDS}


def cat(x, windows):
    parts = [x[frame(a):frame(b)] for a, b in windows if frame(b) > frame(a)]
    return np.concatenate(parts) if parts else x[:0]


def active_margin(lead, rest, windows, lo, hi):
    L = cat(band(lead.mean(axis=1), lo, hi), windows); R = cat(band(rest.mean(axis=1), lo, hi), windows); ww = int(0.05 * SR)
    act = [j for j in range(0, len(L) - ww, ww) if rms(L[j:j + ww]) > 10 ** (-45 / 20)]
    if not act:
        return None
    return round(db(rms(np.concatenate([L[j:j + ww] for j in act]))) - db(rms(np.concatenate([R[j:j + ww] for j in act]))), 1)


def punch(x, hits):
    m = np.abs(x).max(axis=1); vals = []
    for h in hits:
        i = frame(h)
        if i - int(0.2 * SR) < 0 or i + int(0.03 * SR) > len(m): continue
        vals.append(db(m[i:i + int(0.03 * SR)].max()) - db(rms(x[i - int(0.18 * SR):i].mean(axis=1))))
    return round(float(np.median(vals)), 1) if vals else None


def spikes(sig):
    h = np.abs(band(sig, 6000, 20000)); ref = np.sqrt(np.convolve(h ** 2, np.ones(882) / 882, mode='same')) + 1e-9
    return int(np.sum((h / ref > 10) & (h > 10 ** (-50 / 20))))


def cents_of(stem, beat0, beat1, midi):
    fn = 440 * 2 ** ((midi - 69) / 12); x = stem[frame(beat0):frame(beat1)].mean(axis=1)
    n = len(x); X = np.abs(np.fft.rfft(x * np.hanning(n), 8 * n)) ** 2; f = np.fft.rfftfreq(8 * n, 1 / SR)
    h = max(range(1, 6), key=lambda k: X[(f > k * fn * 0.97) & (f < k * fn * 1.03)].sum())
    b = (f > h * fn * 0.97) & (f < h * fn * 1.03)
    return round(1200 * np.log2(float((X[b] * f[b]).sum() / X[b].sum()) / h / fn), 1)


def lowimg(x):
    a, b = band(x[:, 0], 20, 120), band(x[:, 1], 20, 120)
    return {'corr': round(float(np.sum(a * b) / np.sqrt(np.sum(a * a) * np.sum(b * b) + 1e-30)), 4), 'leftMinusRightDb': round(db(rms(a)) - db(rms(b)), 1)}


def clip(windows, a, b):
    return [(max(x, a), min(y, b)) for x, y in windows if min(y, b) > max(x, a)]


NEW = ['volt', 'volt-room', 'great', 'swell', 'pedal', 'choir-low', 'choir-mid', 'choir-high']


def main(build):
    B = Path(build); E = B.parent; man = json.loads((B / 'manifest.json').read_text()); mp = json.loads((E / 'source' / 'map.json').read_text())
    S = {k: tuple(v) for k, v in mp['sections'].items()}; out = {'stage': man['stage']}
    rec = man['record']; x = read(E / rec['file']); l = ebur_file(E / rec['file']); lm = ebur_file(E / rec['mp3'])
    mono = x.mean(axis=1); lmono = ebur(mono)
    out['record'] = {'seconds': rec['seconds'], 'lufs': l['lufs'], 'truePeakDbtp': l['truePeak'], 'lra': l['lra'], 'mp3Lufs': lm['lufs'], 'mp3TruePeakDbtp': lm['truePeak'],
                     'masterLufsBeforeMatching': rec['masterLufs'], 'gainAppliedDb': rec['gainDb'], 'samplePeakDbfs': round(db(np.abs(x).max()), 2),
                     'fullScaleSamples': int(np.sum(np.abs(x) >= 1 - 1 / 8388608)), 'lastTenMsPeakDbfs': round(db(np.abs(x[-441:]).max()), 1), 'dc': round(float(x.mean()), 6),
                     'lowEndBelow120Hz': lowimg(x), 'monoFoldDownLufs': lmono['lufs'], 'monoLossLu': round(l['lufs'] - lmono['lufs'], 1) if lmono['lufs'] is not None else None}
    # the arc
    arc = {}
    for sec, (a, b) in S.items():
        seg = x[frame(a):(frame(b) if b < 304 else len(x))]; M, Sd = seg.mean(axis=1), (seg[:, 0] - seg[:, 1]) / 2; s = shares(seg)
        arc[sec] = {'lufs': ebur(seg)['lufs'], 'sideOverMidDb': round(db(rms(Sd)) - db(rms(M)), 1), 'below120%': round(s['20-60'] + s['60-120'], 1), 'above2k%': round(s['2000-4000'] + s['4000-8000'] + s['8000-16000'], 1), 'lowEnd': lowimg(seg)}
    out['arc'] = arc
    # drum punch: this record per drum section, V2's master per section (bars 5-8, 9-11, 13-16)
    kicks, snares = mp['kicks'], mp['snares']
    out['drumHitOverPreceding180msDb'] = {'this record': {sec: {'kick': punch(x, [k for k in kicks if a <= k < b]), 'snare': punch(x, [s for s in snares if a <= s < b])} for sec, (a, b) in mp['drumSections'].items()}}
    v2 = read(E.parent / 'cathedral-experiment-001' / 'build' / 'v2' / 'render' / 'concrete-gospel.wav')
    v2k = [b - 16 for b in kicks if 32 <= b < 60] + [b - 224 for b in kicks if 272 <= b < 286.5]; v2s = [18, 22, 26, 30, 34, 38, 42, 50, 54, 58, 62]
    out['drumHitOverPreceding180msDb']['V2 master'] = {sec: {'kick': punch(v2, [k for k in v2k if a <= k < b]), 'snare': punch(v2, [s for s in v2s if a <= s < b])} for sec, (a, b) in {'bars 5-8': (16, 32), 'bars 9-11': (32, 44), 'bars 13-16': (48, 64)}.items()}
    # stems
    st = {p.stem: read(p) for p in sorted((B / 'engine' / 'render' / f'{NAME}.stems').glob('*.wav'))}
    rest_of = lambda key: sum(v for k, v in st.items() if k != key)
    lead_notes = [tuple(w) for w in mp['leadNotes']]; rest = rest_of('volt')
    out['leadNotesOverRestOfMixDb'] = {sec: {lab: active_margin(st['volt'], rest, clip(lead_notes, a, b), lo, hi) for lab, lo, hi in [('300-1000 Hz', 300, 1000), ('1-4 kHz', 1000, 4000)]}
                                       for sec, (a, b) in S.items() if clip(lead_notes, a, b)}
    choir = st['choir-low'] + st['choir-mid'] + st['choir-high']; organ = st['great'] + st['swell'] + st['pedal']
    drums = st['kick'] + st['snare'] + st['hats'] + st['toll'] + st['clank'] + st['bass808']
    out['leadOverChoirAndOrganDuringCalls'] = {f'{a}-{b}': {lab: active_margin(st['volt'], choir + organ, [(a, b)], lo, hi) for lab, lo, hi in [('300-1000 Hz', 300, 1000), ('1-4 kHz', 1000, 4000)]} for a, b in mp['calls']}
    # low end while the 808 plays
    w808 = [tuple(w) for w in mp['bass808Windows']]; low = {}
    for lab, lo, hi in [('below 120 Hz', None, 120), ('120-250 Hz', 120, 250)]:
        ref = db(rms(band(cat(st['bass808'], w808).mean(axis=1), lo, hi)))
        low[lab] = {k: round(db(rms(band(cat(st[k], w808).mean(axis=1), lo, hi))) - ref, 1) for k in ['volt', 'great', 'swell', 'choir-low', 'choir-mid', 'choir-high']}
        low[lab]['all new parts'] = round(db(rms(band(cat(sum(st[k] for k in NEW), w808).mean(axis=1), lo, hi))) - ref, 1)
    out['lowEndWhile808PlaysDbRelativeTo808'] = low
    # room for a voice: the melodic parts in the vocal band against the beat, and how much of the time they speak at all
    melodic = st['volt'] + st['volt-room'] + organ + choir; voice = {}
    # verse 2's last four bars are an instrumental break (the floor and the stop-time); its rap bars are 41-48
    for sec, (a, b) in [(k, S[k]) for k in ['verse-1', 'verse-2']] + [('verse-2 rap bars 41-48', (S['verse-2'][0], S['verse-2'][0] + 32))] + [(k, S[k]) for k in ['chorus-1', 'chorus-2', 'hook']]:
        m = band(melodic.mean(axis=1), 300, 3000)[frame(a):frame(b)]; d = band(drums.mean(axis=1), 300, 3000)[frame(a):frame(b)]; ww = int(0.1 * SR)
        busy = [rms(m[j:j + ww]) > 10 ** (-40 / 20) for j in range(0, len(m) - ww, ww)]
        voice[sec] = {'melodicOverBeat300-3kHzDb': round(db(rms(m)) - db(rms(d)), 1), 'melodicBusy%': round(100 * float(np.mean(busy)), 0)}
    out['roomForAVoice'] = voice
    out['hfSpikesAboveMinus50Dbfs'] = {k: spikes(st[k].mean(axis=1)) for k in NEW + ['bass808']}
    prod = json.loads((B / 'engine' / 'render' / f'{NAME}.render.json').read_text())['production']
    out['enginePreClipPeakDbfs'] = {t['trackId']: [round(t['preClipPeakDbfs'], 2), t['clippedSamples']] for t in prod['tracks']}
    out['enginePreClipPeakDbfs']['master'] = [round(prod['master']['preClipPeakDbfs'], 2), prod['master']['clippedSamples']]
    # the choir's arc
    carc = {}
    for sec, (a, b) in S.items():
        c = choir[frame(a):(frame(b) if b < 304 else len(choir))]
        if rms(c) < 1e-5: continue
        s = shares(c); M, Sd = c.mean(axis=1), (c[:, 0] - c[:, 1]) / 2
        carc[sec] = {'lufs': ebur(c)['lufs'], 'sideOverMidDb': round(db(rms(Sd)) - db(rms(M)), 1), 'below120%': round(s['20-60'] + s['60-120'], 1), 'above2k%': round(s['2000-4000'] + s['4000-8000'] + s['8000-16000'], 1)}
    out['choirArc'] = carc
    out['stemLufsPerSection'] = {sec: {k: ebur(st[k][frame(a):(frame(b) if b < 304 else len(x))])['lufs'] for k in ['kick', 'snare', 'bass808'] + NEW} for sec, (a, b) in S.items()}
    out['leadTuningCents'] = {'C4 bar 1 (0.75-2.4)': cents_of(st['volt'], 0.75, 2.4, 60), 'C4 bar 9 (32.75-34.4)': cents_of(st['volt'], 32.75, 34.4, 60), 'C5 chorus 1 (137.7-139.1)': cents_of(st['volt'], 137.7, 139.1, 72),
                              'Ab3 held (288-295)': cents_of(st['volt'], 288, 295, 56), 'A3 last (298-302)': cents_of(st['volt'], 298, 302, 57)}
    out['lastChordCents'] = {'choir A (altos A4)': cents_of(st['choir-mid'], 297.5, 301.5, 69), 'choir descant A5 + sopranos F5 bus (A5)': cents_of(st['choir-high'], 297.5, 301.5, 81), 'organ A4 (Swell)': cents_of(st['swell'], 297.5, 301.5, 69)}
    def onset(sig, from_beat):
        m = np.abs(sig.mean(axis=1)); i0 = max(0, frame(from_beat) - int(0.05 * SR)); j = np.argmax(m[i0:] > 10 ** (-50 / 20)); return round((i0 + j - frame(from_beat)) / SR * 1000, 2)
    out['onsetMsAfterWrittenBeat'] = {'volt (beat 0)': onset(st['volt'], 0), 'kick (beat 32)': onset(st['kick'], 32), 'swell (beat 3.5)': onset(st['swell'], 3.5), 'choir-low (beat 4)': onset(st['choir-low'], 4)}
    return out


if __name__ == '__main__':
    res = main(sys.argv[1]); txt = json.dumps(res, indent=1)
    if '--json' in sys.argv:
        Path(sys.argv[sys.argv.index('--json') + 1]).write_text(txt + '\n')
    print(txt)
