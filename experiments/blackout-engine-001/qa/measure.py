"""
Technical QA for a BLACKOUT//ENGINE build: format and length, loudness and peaks, clipping, section dynamics,
unintended silence, kick and snare attacks, kick versus bass low end, sub control and mono compatibility, the bass's
phone-band presence, the voice's lead and gate clicks, tuning, and stem alignment. Analysis only: the numbers describe
signals, not musical quality. Needs numpy, scipy and FFmpeg.

    python3 -I experiments/blackout-engine-001/qa/measure.py BUILD_DIR [--json OUT.json]
"""
import json, re, subprocess, sys, wave
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
BEAT = 60 / 128
NAME = 'blackout-engine'
SECTIONS = [('ignition', 0, 8), ('engine-room', 8, 24), ('brownout', 24, 30), ('dark', 30, 40), ('cold-start', 40, 48), ('in-the-gears', 48, 62), ('coda', 62, 64)]


def read(path):
    with wave.open(str(path), 'rb') as w:
        assert w.getframerate() == SR and w.getsampwidth() == 2
        return np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float64).reshape(-1, w.getnchannels()) / 32768.0


def db(v):
    return float(20 * np.log10(max(float(v), 1e-12)))


def rms(s):
    return float(np.sqrt(np.mean(s ** 2))) if len(s) else 0.0


def bp(x, lo, hi, order=4):
    if lo <= 0:
        return sosfilt(butter(order, hi, 'low', fs=SR, output='sos'), x, axis=0)
    if hi >= SR / 2:
        return sosfilt(butter(order, lo, 'high', fs=SR, output='sos'), x, axis=0)
    return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x, axis=0)


def phone(x):
    """A small-speaker stand-in: nothing useful under about 300 Hz, rolled off above 8 kHz."""
    return bp(bp(x, 300, 8000, 4), 300, 8000, 2)


def fr(beat):
    return int(round(beat * BEAT * SR))


def med(xs):
    return round(float(np.median(xs)), 1) if len(xs) else None


def ebur(path, extra=None):
    args = ['ffmpeg', '-hide_banner', '-nostdin', '-nostats', '-i', str(path)] + (extra or []) + ['-af', 'ebur128=peak=true', '-f', 'null', '-']
    e = subprocess.run(args, capture_output=True, text=True).stderr
    s = e[e.rfind('Summary:'):]
    g = lambda p: (lambda m: None if not m or m.group(1) == '-inf' else float(m.group(1)))(re.search(p, s))
    return {'integratedLufs': g(r'I:\s+(-?[\d.]+|-inf) LUFS'), 'lraLu': g(r'LRA:\s+(-?[\d.]+|-inf) LU'), 'truePeakDbtp': g(r'Peak:\s+(-?[\d.]+|-inf) dBFS')}


def short_term(x, win=3.0, hop=0.5):
    """Momentary-style loudness proxy: K-weighting approximated by a 2nd-order high-pass at 60 Hz and a +4 dB shelf
    above 1.5 kHz is not needed for relative section comparison; plain RMS over win seconds, in dBFS."""
    out = []
    t = 0.0
    while t + win <= len(x) / SR + 1e-9:
        a, b = int(t * SR), int((t + win) * SR)
        out.append((round(t, 2), round(db(rms(x[a:b])), 1)))
        t += hop
    return out


def triggers(man, track, min_vel=0.0):
    t = next(t for t in man['samples']['tracks'] if t['trackId'] == track)
    return sorted({tr['frame'] for tr in t['triggers'] if tr['velocity'] >= min_vel})


def main(build):
    R = Path(build) / 'render'
    man = json.loads((R / f'{NAME}.render.json').read_text())
    master = read(R / f'{NAME}.wav'); m = master.mean(axis=1)
    names = sorted(p.stem for p in (R / f'{NAME}.stems').glob('*.wav'))
    stems = {n: read(R / f'{NAME}.stems' / f'{n}.wav') for n in names}
    mono = {n: s.mean(axis=1) for n, s in stems.items()}
    premaster = sum(mono.values())  # the stems are pre-master: comparisons between parts use them, not master minus a stem
    out = {}

    # ------------------------------------------------------------------ format, loudness, peaks, edges
    L = ebur(R / f'{NAME}.wav')
    out['master'] = {
        'frames': len(master), 'seconds': len(master) / SR, **L,
        'samplePeakDbfs': round(db(np.abs(master).max()), 2), 'fullScaleSamples': int(np.sum(np.abs(master) >= 32767 / 32768)),
        'firstTenMsPeakDbfs': round(db(np.abs(master[:441]).max()), 1), 'lastTenMsPeakDbfs': round(db(np.abs(master[-441:]).max()), 1),
        'dcOffset': [round(float(master[:, c].mean()), 5) for c in (0, 1)],
    }
    mp3 = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(R / f'{NAME}.mp3'), '-f', 's16le', '-acodec', 'pcm_s16le', '-ac', '2', '-'], capture_output=True).stdout
    d = np.frombuffer(mp3, dtype='<i2').astype(np.int32)
    out['mp3'] = {'decodedPeakDbfs': round(db(np.abs(d).max() / 32768), 2), 'fullScaleSamples': int(np.sum(np.abs(d) >= 32767)), **ebur(R / f'{NAME}.mp3')}

    # ------------------------------------------------------------------ sections and dynamics
    sec = {}
    for lab, a, b in SECTIONS:
        seg = master[fr(a):fr(b)]
        sec[lab] = {'rmsDbfs': round(db(rms(seg)), 1), 'peakDbfs': round(db(np.abs(seg).max()), 1), 'phoneBandRmsDbfs': round(db(rms(phone(seg.mean(axis=1)))), 1)}
    out['sections'] = sec
    st = short_term(m)
    vals = [v for _, v in st]
    out['lowEndBelow100HzRelativeToMixRmsDb'] = {lab: round(db(rms(bp(m[fr(a):fr(b)], 0, 100))) - db(rms(m[fr(a):fr(b)])), 1) for lab, a, b in SECTIONS if lab not in ('dark', 'coda')}
    out['shortTerm3sRms'] = {'maxDbfs': max(vals), 'minDbfs': min(vals), 'rangeDb': round(max(vals) - min(vals), 1)}

    # unintended silence: any 250 ms window under -60 dBFS RMS (the dark is quiet, not silent)
    w = int(0.25 * SR); quiet = []
    for i in range(0, len(m) - w, w // 2):
        if rms(m[i:i + w]) < 10 ** (-60 / 20):
            quiet.append(round(i / SR, 2))
    out['windowsBelowMinus60DbfsRms250ms'] = quiet
    out['darkSectionFloorDbfs(min 250 ms RMS, beats 30-40)'] = round(min(db(rms(m[i:i + w])) for i in range(fr(30), fr(40) - w, w // 2)), 1)

    # ------------------------------------------------------------------ stems
    out['stems'] = {n: {'frames': len(stems[n]), 'peakDbfs': round(db(np.abs(stems[n]).max()), 1), 'clippedSamples': int(np.sum(np.abs(stems[n]) >= 32767 / 32768)),
                        'integratedLufs': ebur(R / f'{NAME}.stems' / f'{n}.wav')['integratedLufs']} for n in names}
    out['allStemsSameFramesAsMaster'] = all(len(s) == len(master) for s in stems.values())
    out['overloadCounters'] = man.get('production', {}).get('overload') or man.get('mix', {}).get('overload')

    # ------------------------------------------------------------------ kick
    K = triggers(man, 'kick', 0.5)
    k = mono['kick']; bsub = mono['bass-sub']; bg = mono['bass-grind']; bass = bsub + bg
    win = lambda i, a_ms, b_ms: slice(max(0, i + int(a_ms * SR / 1000)), i + int(b_ms * SR / 1000))
    kl, bl = bp(k, 0, 120), bp(bass, 0, 120)
    click, knock, kvb, kvb_phone, peaks, jump = [], [], [], [], [], []
    kp, bpn, mp = phone(k), phone(bass), phone(m)
    for i in K:
        body = rms(kl[win(i, 0, 60)])
        click.append(db(rms(bp(k[win(i, -5, 20)], 1500, 6000)[int(0.005 * SR):int(0.013 * SR)])) - db(body))
        knock.append(db(rms(bp(k[win(i, 0, 20)], 120, 300))) - db(body))
        kvb.append(db(rms(kl[win(i, 0, 40)])) - db(rms(bl[win(i, 0, 40)])))
        kvb_phone.append(db(rms(kp[win(i, 0, 30)])) - db(rms(bpn[win(i, 0, 30)])))
        peaks.append(db(np.abs(k[win(i, 0, 60)]).max()))
        if i > int(0.2 * SR):
            jump.append(db(np.abs(m[win(i, 0, 15)]).max()) - db(rms(m[win(i, -200, -20)])))
    out['kick'] = {'hits': len(K), 'click1.5-6k(5-13ms)VsBodyBelow120HzDb': med(click), 'knock120-300(0-20ms)VsBodyDb': med(knock),
                   'peakDbfsMedian': med(peaks), 'peakSpreadDb': round(float(np.std(peaks)), 2),
                   'kickMinusBassBelow120HzFirst40msDb': med(kvb), 'kickMinusBassPhoneBandFirst30msDb': med(kvb_phone),
                   'masterJumpDb(peak 0-15ms over RMS of the 180 ms before)': med(jump)}

    # ------------------------------------------------------------------ snare
    S = triggers(man, 'snare', 0.8)
    s = mono['snare']
    att, late, sjump, shares = [], [], [], {'body 150-300': [], 'mid 300-1.5k': [], 'crack 1.5-6k': [], 'air >6k': []}
    for i in S:
        att.append(db(rms(s[win(i, 0, 10)])) - db(rms(s[win(i, 10, 40)])))
        e_all = np.sum(s[win(i, 0, 500)] ** 2); late.append(100 * np.sum(s[win(i, 150, 500)] ** 2) / max(e_all, 1e-12))
        sjump.append(db(np.abs(m[win(i, 0, 15)]).max()) - db(rms(m[win(i, -200, -20)])))
        seg = s[win(i, 0, 150)]; tot = np.sum(seg ** 2)
        for lab, lo, hi in [('body 150-300', 150, 300), ('mid 300-1.5k', 300, 1500), ('crack 1.5-6k', 1500, 6000), ('air >6k', 6000, SR / 2)]:
            shares[lab].append(100 * np.sum(bp(seg, lo, hi) ** 2) / tot)
    out['snare'] = {'hits': len(S), 'attackFirst10msOverNext30msDb': med(att), 'energyAfter150ms%': med(late),
                    'masterJumpDb(peak 0-15ms over RMS of the 180 ms before)': med(sjump), 'first150msEnergyShare%': {k2: med(v) for k2, v in shares.items()}}

    # ------------------------------------------------------------------ bass: sub control, duck, phone presence, mono
    running = [(0, 30), (40, 62)]
    span = lambda x: np.concatenate([x[fr(a):fr(b)] for a, b in running])
    sub_rms = [db(rms(bsub[fr(c):fr(c + 2)])) for c in range(0, 30, 2)] + [db(rms(bsub[fr(c):fr(c + 2)])) for c in range(48, 62, 2)]
    out['bass'] = {
        'subStemRmsPerHalfBarDb (running sections) min/median/max': [round(min(sub_rms), 1), med(sub_rms), round(max(sub_rms), 1)],
        'grindBandShareOfBassPhoneBand%': round(100 * np.sum(phone(span(bg)) ** 2) / max(1e-12, np.sum(phone(span(bass)) ** 2)), 1),
        'bassPhoneBandRmsDbfs (running)': round(db(rms(phone(span(bass)))), 1),
        'restOfMixPhoneBandRmsDbfs (running, pre-master stems)': round(db(rms(phone(span(premaster - bass)))), 1),
        'bassSubAt5-35msAfterKickVs150-250msDb(median)': med([db(rms(bsub[win(i, 5, 35)])) - db(rms(bsub[win(i, 150, 250)])) for i in K if rms(bsub[win(i, 150, 250)]) > 1e-3]),
    }
    lo = [bp(master[:, c], 20, 120) for c in (0, 1)]
    out['mono'] = {
        'lowEndLRCorrelation20to120Hz': round(float(np.sum(lo[0] * lo[1]) / np.sqrt(np.sum(lo[0] ** 2) * np.sum(lo[1] ** 2))), 4),
        'wholeMixLRCorrelation': round(float(np.sum(master[:, 0] * master[:, 1]) / np.sqrt(np.sum(master[:, 0] ** 2) * np.sum(master[:, 1] ** 2))), 3),
        'monoSumMinusStereoRmsDb': round(db(rms(m)) - db(rms(master)), 2),
        'sideBelow120HzVsMidDb': round(db(rms((lo[0] - lo[1]) / 2)) - db(rms((lo[0] + lo[1]) / 2)), 1),
    }

    # ------------------------------------------------------------------ voice: lead over the mix, gate clicks
    v = mono['voice']; rest = premaster - v
    lead = {}
    for lab, a, b in [('dark', 31.5, 40), ('cold-start', 40, 48), ('in-the-gears', 48, 62), ('coda', 62.2, 63.9)]:
        vv, rr = bp(v[fr(a):fr(b)], 300, 4000), bp(rest[fr(a):fr(b)], 300, 4000)
        ww = int(0.05 * SR); act = [j for j in range(0, len(vv) - ww, ww) if rms(vv[j:j + ww]) > 10 ** (-48 / 20)]
        lead[lab] = round(db(rms(np.concatenate([vv[j:j + ww] for j in act]))) - db(rms(np.concatenate([rr[j:j + ww] for j in act]))), 1) if act else None
    out['voiceLeadOverRestOfMix300-4kHzDb (while the voice sounds)'] = lead

    def spikes(sig):
        h = np.abs(bp(sig, 6000, 20000)); ref = np.sqrt(np.convolve(h ** 2, np.ones(882) / 882, mode='same')) + 1e-9
        idx = np.where((h / ref > 10) & (h > 10 ** (-50 / 20)))[0]
        return [round(float(t), 3) for t in sorted({round(i / SR, 2) for i in idx})][:20]
    out['hfSpikeTimesSeconds'] = {n: spikes(mono[n]) for n in ['bass-sub', 'bass-grind', 'voice', 'room', 'gong', 'bearings']} | {'master': spikes(m)}

    # ------------------------------------------------------------------ tuning (bass sub stem and voice)
    def f0(sig, t0, t1, fmin, fmax):
        seg = bp(sig, fmin * 0.8, fmax * 1.1)[int(t0 * SR):int(t1 * SR)] * np.hanning(int(t1 * SR) - int(t0 * SR))  # band-limited: a ringing halo cannot win
        ac = np.correlate(seg, seg, 'full')[len(seg) - 1:]; lo_, hi_ = int(SR / fmax), int(SR / fmin)
        kk = lo_ + int(np.argmax(ac[lo_:hi_]))
        y0, y1, y2 = ac[kk - 1], ac[kk], ac[kk + 1]; kk = kk + 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2)
        return SR / kk
    cents = lambda f, midi: round(1200 * np.log2(f / (440 * 2 ** ((midi - 69) / 12))), 1)

    def zc(sig, t0, t1, midi):
        """Zero-crossing frequency of the band-limited sub over an even number of cycles: at the machine end the grind
        and gear add a small f0/2 component (about -28 dB) that makes alternate periods long and short, so single periods
        read +-35-55 cents while every pair of them is in tune."""
        ref = 440 * 2 ** ((midi - 69) / 12); x = bp(sig, 20, ref * 1.4)[int(t0 * SR):int(t1 * SR)]
        neg = np.signbit(x); idx = np.where(neg[:-1] & ~neg[1:])[0]; fr_ = idx + x[idx] / (x[idx] - x[idx + 1])
        n = (len(fr_) - 1) // 2 * 2
        return float(SR * n / (fr_[n] - fr_[0]))
    # second strokes only (their gate is 190 ms; the third stroke's 148 ms gate leaves too little steady tone)
    strokes = [c + 0.75 for c in (0, 4, 8, 12, 16, 20, 48, 52, 56)]
    out['bassG1SecondStrokesZeroCrossingCents (50-140 ms after onset)'] = (lambda v: {'median': round(float(np.median(v)), 1), 'min': round(min(v), 1), 'max': round(max(v), 1), 'strokes': len(v)})(
        [cents(zc(bsub, s * BEAT + 0.05, s * BEAT + 0.14, 31), 31) for s in strokes])
    out['tuningCents'] = {
        'bass D2 after the glide and its servo overshoot (beat 2.85-3.08, zero crossings)': cents(zc(bsub, 2.85 * BEAT, 3.08 * BEAT, 38), 38),
        'bass F#2 (beat 6.05-6.45, zero crossings)': cents(zc(bsub, 6.05 * BEAT, 6.45 * BEAT, 42), 42),
        'bass E2 (beat 7.05-7.45, zero crossings)': cents(zc(bsub, 7.05 * BEAT, 7.45 * BEAT, 40), 40),
        'voice G4 (beat 32.6-33.8)': cents(f0(v, 32.6 * BEAT, 33.8 * BEAT, 250, 600), 67),
        'voice E4 (beat 36.3-37.3)': cents(f0(v, 36.3 * BEAT, 37.3 * BEAT, 200, 500), 64),
        'voice Eb4 (beat 38-39.8)': cents(f0(v, 38 * BEAT, 39.8 * BEAT, 200, 500), 63),
        'voice D4 coda (beat 63.0-63.5)': cents(f0(v, 63.0 * BEAT, 63.5 * BEAT, 220, 400), 62),
    }
    return out


if __name__ == '__main__':
    res = main(sys.argv[1]); txt = json.dumps(res, indent=1)
    if '--json' in sys.argv:
        Path(sys.argv[sys.argv.index('--json') + 1]).write_text(txt + '\n')
    print(txt)
