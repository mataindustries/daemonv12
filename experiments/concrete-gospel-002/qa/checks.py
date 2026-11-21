"""
Whole-mix checks for a CONCRETE GOSPEL build (V1 or V2): stem alignment and loudness, the hook's lead over the rest
of the mix, isolated high-frequency spikes (clicks), low-end mono, section levels, and the MP3's decoded peak.
Analysis only (numpy, scipy, FFmpeg).

    python3 -I experiments/concrete-gospel-002/qa/checks.py BUILD_DIR [--json OUT.json]
"""
import json, re, subprocess, sys, wave
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
BS = round(60e6 / 144) / 1e6


def read(path):
    with wave.open(str(path), 'rb') as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float64).reshape(-1, 2) / 32768.0


def db(v):
    return float(20 * np.log10(max(float(v), 1e-12)))


def rms(s):
    return float(np.sqrt(np.mean(s ** 2))) if len(s) else 0.0


def band(x, lo, hi):
    return sosfilt(butter(4, [lo, hi], btype='band', fs=SR, output='sos'), x)


def ebur(path_or_args):
    args = ['ffmpeg', '-hide_banner', '-nostdin', '-nostats', '-i', str(path_or_args), '-af', 'ebur128=peak=true', '-f', 'null', '-']
    e = subprocess.run(args, capture_output=True, text=True).stderr; s = e[e.rfind('Summary:'):]
    g = lambda p: (lambda m: None if not m or m.group(1) == '-inf' else float(m.group(1)))(re.search(p, s))
    return g(r'I:\s+(-?[\d.]+|-inf) LUFS'), g(r'Peak:\s+(-?[\d.]+|-inf) dBFS')


def main(build):
    R = Path(build) / 'render'
    master = read(R / 'concrete-gospel.wav'); m = master.mean(axis=1)
    names = sorted(p.stem for p in (R / 'concrete-gospel.stems').glob('*.wav'))
    stems = {n: read(R / 'concrete-gospel.stems' / f'{n}.wav') for n in names}
    mono = {n: s.mean(axis=1) for n, s in stems.items()}
    out = {}
    L, T = ebur(R / 'concrete-gospel.wav')
    out['master'] = {'frames': len(master), 'integratedLufs': L, 'truePeakDbtp': T, 'samplePeakDbfs': round(db(np.abs(master).max()), 2),
                     'fullScaleSamples': int(np.sum(np.abs(master) >= 32767 / 32768)), 'lastTenMsPeakDbfs': round(db(np.abs(master[-441:]).max()), 1),
                     'sectionRmsDbfs': {lab: round(db(rms(m[int(a * 4 * BS * SR):int(b * 4 * BS * SR)])), 1) for lab, a, b in
                                        [('bars 1-4', 0, 4), ('bars 5-8', 4, 8), ('bars 9-11', 8, 11), ('bar 12', 11, 12), ('bars 13-16', 12, 16)]}}
    mp3 = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(R / 'concrete-gospel.mp3'), '-f', 's16le', '-acodec', 'pcm_s16le', '-'], capture_output=True).stdout
    d = np.frombuffer(mp3, dtype='<i2'); out['mp3'] = {'decodedPeakDbfs': round(db(np.abs(d).max() / 32768), 2), 'fullScaleSamples': int(np.sum(np.abs(d.astype(np.int32)) >= 32767))}
    out['stems'] = {n: dict(zip(['integratedLufs', 'truePeakDbtp'], ebur(R / 'concrete-gospel.stems' / f'{n}.wav'))) | {'frames': len(stems[n])} for n in names}
    out['allStemsSameFramesAsMaster'] = all(len(s) == len(master) for s in stems.values())
    lead = {}
    for lab, lo, hi in [('300-1000 Hz', 300, 1000), ('1-4 kHz', 1000, 4000)]:
        F = {n: band(s, lo, hi) for n, s in mono.items()}; per = {}
        for cyc, a, b in [('bars 5-6', 16, 24), ('bars 7-8', 24, 32), ('bars 9-10', 32, 40), ('bar 11', 40, 44), ('bars 13-14', 48, 56), ('bars 15-16', 56, 64)]:
            i0, i1 = int(a * BS * SR), int(b * BS * SR); r = F['reed'][i0:i1]; rest = sum(F[n][i0:i1] for n in names if n not in ('reed', 'reed-far'))
            ww = int(0.05 * SR); act = [j for j in range(0, len(r) - ww, ww) if rms(r[j:j + ww]) > 10 ** (-45 / 20)]
            per[cyc] = round(db(rms(np.concatenate([r[j:j + ww] for j in act]))) - db(rms(np.concatenate([rest[j:j + ww] for j in act]))), 1)
        lead[lab] = per
    out['hookLeadOverMixDb'] = lead

    def spikes(sig):
        h = np.abs(band(sig, 6000, 20000)); ref = np.sqrt(np.convolve(h ** 2, np.ones(882) / 882, mode='same')) + 1e-9
        return int(np.sum((h / ref > 10) & (h > 10 ** (-50 / 20))))
    out['hfSpikesAboveMinus50Dbfs'] = {n: spikes(mono[n]) for n in ['bass808', 'reed', 'choir', 'room', 'toll'] if n in mono} | {'master': spikes(m)}
    lo = [band(master[:, c], 20, 120) for c in (0, 1)]
    out['lowEndLRCorrelation20to120Hz'] = round(float(np.sum(lo[0] * lo[1]) / np.sqrt(np.sum(lo[0] ** 2) * np.sum(lo[1] ** 2))), 4)
    return out


if __name__ == '__main__':
    res = main(sys.argv[1]); txt = json.dumps(res, indent=1)
    if '--json' in sys.argv:
        Path(sys.argv[sys.argv.index('--json') + 1]).write_text(txt + '\n')
    print(txt)
