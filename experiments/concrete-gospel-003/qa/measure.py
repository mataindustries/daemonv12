"""
CONCRETE GOSPEL V3 · technical QA (analysis only: numpy, scipy, FFmpeg). Signal measurements, not a verdict on the music.

    python3 -I experiments/concrete-gospel-003/qa/measure.py experiments/concrete-gospel-003/build [--json OUT.json]

V3 against the V2 reference (V2's own master and engine stems, bit-identical to the delivered V2):
  - listening files: loudness, true peak, LRA, full-scale samples, DC, the last 10 ms
  - drum punch per section: kick and snare hit peaks over the preceding 180 ms (V2's own metric)
  - the lead over the rest of the mix per phrase, 300 Hz-1 kHz and 1-4 kHz (V2's own metric)
  - low end while the 808 plays: what the new parts put below 120 Hz and at 120-250 Hz, against the 808 in the same band
  - the climax: the lead against the choir and organ during its calls; the choir and organ during the answers
  - spectral balance per section; low-end mono-ness of the mix
  - clicks (high-frequency spikes) in the new stems; tuning of held lead notes and of the final chord
  - the choir's arc: level, width and low-frequency share per section
"""
import json, re, subprocess, sys, tempfile, wave
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100


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
    if lo is None:
        return sosfilt(butter(4, hi, btype='low', fs=SR, output='sos'), x, axis=0)
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


BANDS = [(20, 60), (60, 120), (120, 250), (250, 500), (500, 1000), (1000, 2000), (2000, 4000), (4000, 8000), (8000, 16000)]


def shares(x):
    m = x.mean(axis=1) if x.ndim > 1 else x
    X = np.abs(np.fft.rfft(m * np.hanning(len(m)))) ** 2; f = np.fft.rfftfreq(len(m), 1 / SR); tot = X.sum() + 1e-30
    return {f'{a}-{b}': round(100 * float(X[(f >= a) & (f < b)].sum() / tot), 1) for a, b in BANDS}


def active_margin(lead, rest, a, b, lo, hi):
    # lead over the rest of the mix in one band, over the 50-ms windows where the lead is active (V2's metric)
    L = band(lead.mean(axis=1), lo, hi)[frame(a):frame(b)]; R = band(rest.mean(axis=1), lo, hi)[frame(a):frame(b)]; ww = int(0.05 * SR)
    act = [j for j in range(0, len(L) - ww, ww) if rms(L[j:j + ww]) > 10 ** (-45 / 20)]
    if not act:
        return None
    return round(db(rms(np.concatenate([L[j:j + ww] for j in act]))) - db(rms(np.concatenate([R[j:j + ww] for j in act]))), 1)


def punch(x, hits):
    m = np.abs(x).max(axis=1); vals = []
    for h in hits:
        i = frame(h)
        if i - int(0.2 * SR) < 0 or i + int(0.03 * SR) > len(m): continue
        pk = m[i:i + int(0.03 * SR)].max(); pre = rms(x[i - int(0.18 * SR):i].mean(axis=1))
        vals.append(db(pk) - db(pre))
    return round(float(np.median(vals)), 1) if vals else None


def spikes(sig):
    h = np.abs(band(sig, 6000, 20000)); ref = np.sqrt(np.convolve(h ** 2, np.ones(882) / 882, mode='same')) + 1e-9
    return int(np.sum((h / ref > 10) & (h > 10 ** (-50 / 20))))


def cents_of(stem, beat0, beat1, midi):
    # power-weighted mean frequency (the carrier of a vibrato tone) of the strongest of harmonics 1-5, over its number
    fn = 440 * 2 ** ((midi - 69) / 12); x = stem[frame(beat0):frame(beat1)].mean(axis=1)
    n = len(x); X = np.abs(np.fft.rfft(x * np.hanning(n), 8 * n)) ** 2; f = np.fft.rfftfreq(8 * n, 1 / SR)
    h = max(range(1, 6), key=lambda k: X[(f > k * fn * 0.97) & (f < k * fn * 1.03)].sum())
    b = (f > h * fn * 0.97) & (f < h * fn * 1.03)
    return round(1200 * np.log2(float((X[b] * f[b]).sum() / X[b].sum()) / h / fn), 1)


def lowimg(x):
    a, b = band(x[:, 0], 20, 120), band(x[:, 1], 20, 120)
    return {'corr': round(float(np.sum(a * b) / np.sqrt(np.sum(a * a) * np.sum(b * b) + 1e-30)), 4), 'leftMinusRightDb': round(db(rms(a)) - db(rms(b)), 1)}


def beats_of(proj, track, pitch):
    t = next(t for t in proj['tracks'] if t['id'] == track); res = []
    for n in t['patterns'][0]['notes']:
        if n.get('pitch') != pitch: continue
        m = re.match(r'(\d+):(\d+)(?:\+(\d+)/(\d+))?$', n['start']); res.append((int(m[1]) - 1) * 4 + int(m[2]) - 1 + (int(m[3]) / int(m[4]) * 4 if m[3] else 0))
    return sorted(set(res))


SECTIONS = {'darkness (bars 1-4)': (0, 16), 'command (bars 5-8)': (16, 32), 'tension (bars 9-11)': (32, 44), 'breath (bar 12)': (44, 48), 'divine (bars 13-16)': (48, 64), 'final chord (beat 62 on)': (62, None)}
NEW = ['volt', 'volt-room', 'great', 'swell', 'pedal', 'choir-low', 'choir-mid', 'choir-high']


def main(build):
    B = Path(build); man = json.loads((B / 'manifest.json').read_text()); out = {'stage': man['stage'], 'listening': {}}
    files = {f['id']: read(B.parent / f['wav']) for f in man['listening']}
    for f in man['listening']:
        x = files[f['id']]; l = ebur(x)
        out['listening'][f['id']] = {'seconds': f['seconds'], 'lufs': l['lufs'], 'truePeakDbtp': l['truePeak'], 'lra': l['lra'], 'gainAppliedDb': f['gainDb'], 'masterLufsBeforeMatching': f['lufsBefore'],
                                     'samplePeakDbfs': round(db(np.abs(x).max()), 2), 'fullScaleSamples': int(np.sum(np.abs(x) >= 1 - 1 / 8388608)),
                                     'lastTenMsPeakDbfs': round(db(np.abs(x[-441:]).max()), 1), 'dc': round(float(x.mean()), 6), 'lowEndBelow120Hz': lowimg(x)}
    v3, v2 = files['concrete-gospel-v3'], files['concrete-gospel-v2-reference']
    proj = json.loads((B / 'engine' / 'concrete-gospel-v3.json').read_text())
    kicks = beats_of(proj, 'kick', 'iron-pulse'); snares = [b for b in beats_of(proj, 'snare', 'crack') if b in (18, 22, 26, 30, 34, 38, 42, 50, 54, 58, 62)]
    drum_secs = {'bars 5-8': (16, 32), 'bars 9-11': (32, 44), 'bars 13-16': (48, 64)}
    out['drumHitOverPreceding180msDb'] = {name: {sec: {'kick': punch(x, [k for k in kicks if a <= k < b]), 'snare': punch(x, [s for s in snares if a <= s < b])} for sec, (a, b) in drum_secs.items()}
                                          for name, x in [('v2-reference', v2), ('v3', v3)]}
    # ---------------------------------------------------------------- stems
    stems_of = lambda d: {p.stem: read(p) for p in sorted(d.glob('*.wav'))}
    s3 = stems_of(B / 'engine' / 'render' / 'concrete-gospel-v3.stems')
    s2 = stems_of(B.parent.parent / 'cathedral-experiment-001' / 'build' / 'v2' / 'render' / 'concrete-gospel.stems')
    n3 = len(next(iter(s3.values())))
    total3 = sum(s3.values())
    # the lead over the rest of the mix, per phrase (V3: volt; V2: its reed), where each lead is active
    phrases = [('bars 5-6', 16, 24), ('bars 7-8', 24, 32), ('bars 9-10', 32, 40), ('bar 11', 40, 44), ('bar 13 (call)', 48, 52), ('bars 15-16', 56, 64)]
    lead = {}
    for name, st, key in [('v2-reference (reed)', s2, 'reed'), ('v3 (THRONE//VOLT)', s3, 'volt')]:
        rest = sum(v for k, v in st.items() if k not in (key, 'reed-far'))
        lead[name] = {lab: {ph: active_margin(st[key], rest, a, b, lo, hi) for ph, a, b in phrases} for lab, lo, hi in [('300-1000 Hz', 300, 1000), ('1-4 kHz', 1000, 4000)]}
    out['leadOverRestOfMixDb'] = lead
    # the same metric restricted to the lead's own notes in the climax (the phrase windows above also hold the lead's
    # release tail under the choir's answers and its last A3 inside the final chord, where it is meant to dissolve)
    rest3 = sum(v for k, v in s3.items() if k != 'volt')
    out['leadNotesOverRestOfMixDb'] = {f'{a}-{b}': {lab: active_margin(s3['volt'], rest3, a, b, lo, hi) for lab, lo, hi in [('300-1000 Hz', 300, 1000), ('1-4 kHz', 1000, 4000)]}
                                       for a, b in [(48, 50.5), (56, 59.5), (60.5, 62)]}
    # the climax: during the lead's calls, the lead against the choir + organ only; during the answers, choir + organ against the drums + 808
    choir3 = s3['choir-low'] + s3['choir-mid'] + s3['choir-high']; organ3 = s3['great'] + s3['swell'] + s3['pedal']; drums3 = s3['kick'] + s3['snare'] + s3['hats'] + s3['toll'] + s3['clank'] + s3['bass808']
    calls = [(48, 50.5), (56, 59.5), (60.5, 62)]
    out['climax'] = {
        'leadOverChoirAndOrganDuringCalls': {f'{a}-{b}': {lab: active_margin(s3['volt'], choir3 + organ3, a, b, lo, hi) for lab, lo, hi in [('300-1000 Hz', 300, 1000), ('1-4 kHz', 1000, 4000)]} for a, b in calls},
        'choirOverDrumsAnd808DuringAnswers': {f'{a}-{b}': round(db(rms(choir3[frame(a):frame(b)])) - db(rms(drums3[frame(a):frame(b)])), 1) for a, b in [(50.5, 52.5), (52.5, 56), (60, 62)]},
        'choirLufs': {f'{a}-{b}': ebur(choir3[frame(a):frame(b)])['lufs'] for a, b in [(48, 50.5), (50.5, 52.5), (52.5, 56), (56, 60), (60, 62), (62, 64)]},
    }
    # low end while the 808 plays: the new parts against the 808 in the same band
    w808 = [(16, 44), (48, 61.5)]
    def cat(x):
        return np.concatenate([x[frame(a):frame(b)] for a, b in w808])
    low = {}
    for lab, lo, hi in [('below 120 Hz', None, 120), ('120-250 Hz', 120, 250)]:
        ref = db(rms(band(cat(s3['bass808']).mean(axis=1), lo, hi)))
        low[lab] = {k: round(db(rms(band(cat(s3[k]).mean(axis=1), lo, hi))) - ref, 1) for k in ['volt', 'great', 'swell', 'choir-low', 'choir-mid', 'choir-high']}
        low[lab]['all new parts'] = round(db(rms(band(cat(sum(s3[k] for k in NEW)).mean(axis=1), lo, hi))) - ref, 1)
    out['lowEndWhile808PlaysDbRelativeTo808'] = low
    # spectral balance per section, V3 against V2
    def part(x, a, b):
        return x[frame(a):(frame(b) if b is not None else len(x))]
    out['bandShares%'] = {sec: {'v2': shares(part(v2, a, b)) if (b or 64) <= 64 and a < len(v2) else None, 'v3': shares(part(v3, a, b))} for sec, (a, b) in SECTIONS.items()}
    out['lowEndBelow120HzPerSection'] = {sec: lowimg(part(v3, a, b)) for sec, (a, b) in SECTIONS.items() if sec != 'darkness (bars 1-4)'}
    # clicks in the new stems
    out['hfSpikesAboveMinus50Dbfs'] = {k: spikes(s3[k].mean(axis=1)) for k in NEW}
    # tuning: the lead's held notes, and the final chord
    tune = {}
    for lab, a, b, midi in [('C4 bar 5 (16.6-18.0)', 16.75, 18.0, 60), ('Db4 bar 6 (21.6-23.4)', 21.75, 23.4, 61), ('C4 bar 13 (48.6-50.4)', 48.75, 50.4, 60), ('Ab4 bar 11 (40.6-42.0)', 40.75, 42.0, 68), ('A3 final (62.6-64.4)', 62.75, 64.4, 57)]:
        tune[lab] = cents_of(s3['volt'], a, b, midi)
    out['leadTuningCents'] = tune
    out['finalChordCents'] = {'choir A5 (soprano)': cents_of(s3['choir-high'], 62.5, 64.5, 81), 'choir C5 (alto)': cents_of(s3['choir-mid'], 62.5, 64.5, 72), 'organ A4 (swell)': cents_of(s3['swell'], 62.5, 64.5, 69)}
    # onsets: the new stems start where the score writes them
    def onset(x, from_beat):
        m = np.abs(x.mean(axis=1)); i0 = max(0, frame(from_beat) - int(0.05 * SR)); thr = 10 ** (-50 / 20)
        j = np.argmax(m[i0:] > thr); return round((i0 + j - frame(from_beat)) / SR * 1000, 2)
    out['onsetMsAfterWrittenBeat'] = {'volt (beat 16)': onset(s3['volt'], 16), 'swell (beat 18.5)': onset(s3['swell'], 18.5), 'choir-low (beat 0)': onset(s3['choir-low'], 0), 'great (beat 50.5)': onset(s3['great'], 50.5)}
    # the choir's arc
    arc = {}
    for sec, (a, b) in SECTIONS.items():
        c = part(choir3, a, b)
        if rms(c) < 1e-5: continue
        s = shares(c); M, S = c.mean(axis=1), (c[:, 0] - c[:, 1]) / 2
        arc[sec] = {'lufs': ebur(c)['lufs'], 'sideOverMidDb': round(db(rms(S)) - db(rms(M)), 1), 'below120%': round(s['20-60'] + s['60-120'], 1),
                    'lowMid120-500%': round(s['120-250'] + s['250-500'], 1), 'above2k%': round(s['2000-4000'] + s['4000-8000'] + s['8000-16000'], 1)}
    out['choirArc'] = arc
    out['stemLufs'] = {sec: {k: ebur(part(s3[k], a, b))['lufs'] for k in ['kick', 'snare', 'bass808'] + NEW} for sec, (a, b) in SECTIONS.items()}
    return out


if __name__ == '__main__':
    res = main(sys.argv[1]); txt = json.dumps(res, indent=1)
    if '--json' in sys.argv:
        Path(sys.argv[sys.argv.index('--json') + 1]).write_text(txt + '\n')
    print(txt)
