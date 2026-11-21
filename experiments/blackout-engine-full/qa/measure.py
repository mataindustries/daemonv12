"""
Technical QA for a BLACKOUT//ENGINE full-length build: timing and length, loudness and peaks, clipping, section
dynamics, unintended silence, transitions (clicks and level jumps at every section boundary), the ending, kick and
snare attacks and the drummer's timing, kick versus bass, sub control and mono compatibility, phone- and car-band
balance, which part leads each section, and tuning. Analysis only: the numbers describe signals, not musical quality.
Needs numpy, scipy and FFmpeg.

    python3 -I experiments/blackout-engine-full/qa/measure.py BUILD_DIR [--json OUT.json]
"""
import json, re, subprocess, sys, wave
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
BEAT = 60 / 128
NAME = 'blackout-engine-full'
SECTIONS = [('ignition', 0, 32), ('escalation', 32, 72), ('collapse', 72, 96), ('cold-start', 96, 112), ('transformation', 112, 176),
            ('drop', 176, 184), ('climax', 184, 238), ('resolution', 238, 288)]
# boundaries worth checking, with what is meant to happen there
TRANSITIONS = [(32, 'hook B enters'), (64, 'pressure'), (72, 'overload trip'), (96, 'cold start'), (108, 'gear change to triplets'), (112, 'transformation'),
               (144, 'cycle 2'), (176, 'drop'), (184, 'climax'), (200, 'climax phase 2'), (216, 'climax phase 3'), (238, 'second blackout'),
               (248, 'the voice reaches D'), (260, 'warm engine'), (278, 'Ab major'), (280, 'G major')]


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


def ebur(path):
    e = subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-nostats', '-i', str(path), '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    s = e[e.rfind('Summary:'):]
    g = lambda p: (lambda m: None if not m or m.group(1) == '-inf' else float(m.group(1)))(re.search(p, s))
    return {'integratedLufs': g(r'I:\s+(-?[\d.]+|-inf) LUFS'), 'lraLu': g(r'LRA:\s+(-?[\d.]+|-inf) LU'), 'truePeakDbtp': g(r'Peak:\s+(-?[\d.]+|-inf) dBFS')}


def triggers(man, track, min_vel=0.0):
    t = next(t for t in man['samples']['tracks'] if t['trackId'] == track)
    return sorted({tr['frame'] for tr in t['triggers'] if tr['velocity'] >= min_vel})


def spikes(sig):
    h = np.abs(bp(sig, 6000, 20000)); ref = np.sqrt(np.convolve(h ** 2, np.ones(882) / 882, mode='same')) + 1e-9
    return sorted({round(i / SR, 2) for i in np.where((h / ref > 10) & (h > 10 ** (-50 / 20)))[0]})


def main(build):
    R = Path(build) / 'render'
    man = json.loads((R / f'{NAME}.render.json').read_text())
    master = read(R / f'{NAME}.wav'); m = master.mean(axis=1)
    names = sorted(p.stem for p in (R / f'{NAME}.stems').glob('*.wav'))
    stems = {n: read(R / f'{NAME}.stems' / f'{n}.wav') for n in names}
    mono = {n: s.mean(axis=1) for n, s in stems.items()}
    premaster = sum(mono.values())
    out = {}

    # ------------------------------------------------------------------ timing, loudness, peaks, edges
    out['master'] = {'frames': len(master), 'seconds': len(master) / SR, 'expectedFrames(72 bars at 128 BPM)': fr(288), **ebur(R / f'{NAME}.wav'),
                     'samplePeakDbfs': round(db(np.abs(master).max()), 2), 'fullScaleSamples': int(np.sum(np.abs(master) >= 32767 / 32768)),
                     'firstTenMsPeakDbfs': round(db(np.abs(master[:441]).max()), 1), 'lastTenMsPeakDbfs': round(db(np.abs(master[-441:]).max()), 1),
                     'dcOffset': [round(float(master[:, c].mean()), 5) for c in (0, 1)]}
    mp3 = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(R / f'{NAME}.mp3'), '-f', 's16le', '-acodec', 'pcm_s16le', '-ac', '2', '-'], capture_output=True).stdout
    d = np.frombuffer(mp3, dtype='<i2').astype(np.int32)
    out['mp3'] = {'decodedPeakDbfs': round(db(np.abs(d).max() / 32768), 2), 'fullScaleSamples': int(np.sum(np.abs(d) >= 32767)), **ebur(R / f'{NAME}.mp3')}
    out['engineClippedSamples'] = {'tracks': sum(t.get('clippedSamples', 0) for t in man['production']['tracks']), 'master': man['production']['master']['clippedSamples'],
                                   'hottestTrackPreClipDbfs': round(max(t['preClipPeakDbfs'] for t in man['production']['tracks']), 2)}
    out['stems'] = {n: {'frames': len(stems[n]), 'peakDbfs': round(db(np.abs(stems[n]).max()), 1), 'clippedSamples': int(np.sum(np.abs(stems[n]) >= 32767 / 32768)),
                        'integratedLufs': ebur(R / f'{NAME}.stems' / f'{n}.wav')['integratedLufs']} for n in names}
    out['allStemsSameFramesAsMaster'] = all(len(s) == len(master) for s in stems.values())

    # ------------------------------------------------------------------ sections and dynamics
    sec = {}
    for lab, a, b in SECTIONS:
        seg = master[fr(a):fr(b)]; ms_ = seg.mean(axis=1)
        sec[lab] = {'rmsDbfs': round(db(rms(seg)), 1), 'phoneBandRmsDbfs': round(db(rms(phone(ms_))), 1), 'below100HzVsSectionRmsDb': round(db(rms(bp(ms_, 0, 100))) - db(rms(seg)), 1),
                    'carBand30-60HzVsSectionRmsDb': round(db(rms(bp(ms_, 30, 60))) - db(rms(seg)), 1)}
    out['sections'] = sec
    w3 = int(3 * SR); vals = [db(rms(m[i:i + w3])) for i in range(0, len(m) - w3, int(0.5 * SR))]
    out['shortTerm3sRms'] = {'maxDbfs': round(max(vals), 1), 'minDbfs': round(min(vals), 1), 'rangeDb': round(max(vals) - min(vals), 1)}
    w = int(0.25 * SR)
    out['windowsBelowMinus60DbfsRms250ms'] = [round(i / SR, 2) for i in range(0, len(m) - w, w // 2) if rms(m[i:i + w]) < 10 ** (-60 / 20)]
    out['quietestQuarterSecondDbfs'] = {lab: round(min(db(rms(m[i:i + w])) for i in range(fr(a), fr(b) - w, w // 2)), 1) for lab, a, b in SECTIONS}

    # ------------------------------------------------------------------ transitions: level change and clicks around each boundary
    trans = {}
    for b, what in TRANSITIONS:
        i = fr(b); before, after = m[max(0, i - int(1.5 * SR)):i], m[i:i + int(1.5 * SR)]
        sp = [s for s in spikes(m[max(0, i - int(0.25 * SR)):i + int(0.25 * SR)])]
        trans[f'beat {b} ({what})'] = {'secondsAt': round(b * BEAT, 2), 'rms1.5sBeforeDbfs': round(db(rms(before)), 1), 'rms1.5sAfterDbfs': round(db(rms(after)), 1),
                                       'hfSpikesWithin250ms': len(sp)}
    out['transitions'] = trans

    # ------------------------------------------------------------------ ending
    tail = m[fr(280):]
    out['ending'] = {'finalChordAtSeconds': round(280 * BEAT, 2), 'rmsByHalfSecondAfterFinalChordDbfs': [round(db(rms(tail[i:i + SR // 2])), 1) for i in range(0, len(tail) - SR // 4, SR // 2)],
                     'lastTenMsPeakDbfs': out['master']['lastTenMsPeakDbfs'], 'lastSampleValues': [int(round(x * 32768)) for x in master[-1]]}

    # ------------------------------------------------------------------ drums
    K = triggers(man, 'kick', 0.5); S = triggers(man, 'snare', 0.8)
    k = mono['kick']; s = mono['snare']; bass = mono['bass-sub'] + mono['bass-grind']
    win = lambda i, a_ms, b_ms: slice(max(0, i + int(a_ms * SR / 1000)), i + int(b_ms * SR / 1000))
    kl, bl, kp, bpn = bp(k, 0, 120), bp(bass, 0, 120), phone(k), phone(bass)
    click, knock, kvb, kvbp, jump = [], [], [], [], []
    for i in K:
        body = rms(kl[win(i, 0, 60)])
        click.append(db(rms(bp(k[win(i, -5, 20)], 1500, 6000)[int(0.005 * SR):int(0.013 * SR)])) - db(body))
        knock.append(db(rms(bp(k[win(i, 0, 20)], 120, 300))) - db(body))
        kvb.append(db(rms(kl[win(i, 0, 40)])) - db(rms(bl[win(i, 0, 40)])))
        kvbp.append(db(rms(kp[win(i, 0, 30)])) - db(rms(bpn[win(i, 0, 30)])))
        if i > int(0.2 * SR):
            jump.append(db(np.abs(m[win(i, 0, 15)]).max()) - db(rms(m[win(i, -200, -20)])))
    out['kick'] = {'hits': len(K), 'click1.5-6kVsBodyDb': med(click), 'knockVsBodyDb': med(knock), 'kickMinusBassBelow120HzFirst40msDb': med(kvb),
                   'kickMinusBassPhoneBandFirst30msDb': med(kvbp), 'masterJumpDb': med(jump)}
    att, sjump = [], []
    for i in S:
        att.append(db(rms(s[win(i, 0, 10)])) - db(rms(s[win(i, 10, 40)])))
        sjump.append(db(np.abs(m[win(i, 0, 15)]).max()) - db(rms(m[win(i, -200, -20)])))
    out['snare'] = {'hits': len(S), 'attackFirst10msOverNext30msDb': med(att), 'masterJumpDb': med(sjump)}
    # the drummer: onset offsets from the grid, from the manifest's trigger frames
    def offsets(track, min_vel):
        t = next(t for t in man['samples']['tracks'] if t['trackId'] == track)
        offs = []
        for tr in t['triggers']:
            if tr['velocity'] < min_vel:
                continue
            beat = tr['tick'] / 960; grid = round(beat * 12) / 12  # nearest sixteenth or triplet
            offs.append((beat - grid) * BEAT * 1000)
        return offs
    ko, so = offsets('kick', 0.5), offsets('snare', 0.8)
    out['drummerTimingMs'] = {'kick mean/sd': [round(float(np.mean(ko)), 2), round(float(np.std(ko)), 2)], 'snare backbeat mean/sd': [round(float(np.mean(so)), 2), round(float(np.std(so)), 2)]}

    # ------------------------------------------------------------------ low end: sub control, mono, car
    lo = [bp(master[:, c], 20, 120) for c in (0, 1)]
    out['mono'] = {'lowEndLRCorrelation20to120Hz': round(float(np.sum(lo[0] * lo[1]) / np.sqrt(np.sum(lo[0] ** 2) * np.sum(lo[1] ** 2))), 4),
                   'sideBelow120HzVsMidDb': round(db(rms((lo[0] - lo[1]) / 2)) - db(rms((lo[0] + lo[1]) / 2)), 1),
                   'wholeMixLRCorrelation': round(float(np.sum(master[:, 0] * master[:, 1]) / np.sqrt(np.sum(master[:, 0] ** 2) * np.sum(master[:, 1] ** 2))), 3),
                   'monoSumMinusStereoRmsDb': round(db(rms(m)) - db(rms(master)), 2)}
    S_ = np.abs(np.fft.rfft(m * np.hanning(len(m)))) ** 2; f = np.fft.rfftfreq(len(m), 1 / SR)
    out['subsonic18-30HzVs40-60HzDb'] = round(10 * np.log10(S_[(f >= 18) & (f < 30)].sum() / S_[(f >= 40) & (f < 60)].sum()), 1)
    out['bassSubDuckAfterKickDb'] = med([db(rms(mono['bass-sub'][win(i, 5, 35)])) - db(rms(mono['bass-sub'][win(i, 150, 250)])) for i in K if rms(mono['bass-sub'][win(i, 150, 250)]) > 1e-3])

    # ------------------------------------------------------------------ who leads: phone band per section, pre-master stems
    lead = {}
    for lab, a, b in SECTIONS:
        sl = slice(fr(a), fr(b)); row = {}
        tot = phone(premaster[sl])
        for n in ['bass-grind', 'voice', 'voice-end', 'bells', 'bow', 'hands', 'machines', 'kick', 'snare']:
            x = phone(mono[n][sl])
            if rms(x) > 10 ** (-60 / 20):
                row[n] = round(db(rms(x)) - db(rms(tot - x)), 1)
        lead[lab] = row
    out['phoneBandPartMinusRestDb'] = lead

    # ------------------------------------------------------------------ clicks in the sustained parts
    out['hfSpikeCount'] = {n: len(spikes(mono[n])) for n in ['bass-sub', 'voice', 'voice-end', 'bow', 'room', 'air']} | {'master': len(spikes(m))}

    # ------------------------------------------------------------------ tuning
    def zc(sig, t0, t1, midi):
        ref = 440 * 2 ** ((midi - 69) / 12); x = bp(sig, 20, ref * 1.4)[int(t0 * SR):int(t1 * SR)]
        neg = np.signbit(x); idx = np.where(neg[:-1] & ~neg[1:])[0]; fr_ = idx + x[idx] / (x[idx] - x[idx + 1]); n = (len(fr_) - 1) // 2 * 2
        return float(SR * n / (fr_[n] - fr_[0]))

    def spec(sig, t0, t1, midi):
        """Pitch centre of a sung or struck note: median of 60 ms autocorrelation estimates (vibrato averages out)."""
        ref = 440 * 2 ** ((midi - 69) / 12); x = bp(sig, ref * 0.75, ref * 1.3); W = int(0.06 * SR); est = []
        for a in range(int(t0 * SR), int(t1 * SR) - W, int(0.02 * SR)):
            seg = x[a:a + W] * np.hanning(W); ac = np.correlate(seg, seg, 'full')[W - 1:]; lo_, hi_ = int(SR / (ref * 1.3)), int(SR / (ref * 0.75))
            k_ = lo_ + int(np.argmax(ac[lo_:hi_])); y0, y1, y2 = ac[k_ - 1], ac[k_], ac[k_ + 1]; est.append(SR / (k_ + 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2)))
        return float(np.median(est))
    def peak(sig, t0, t1, midi):
        """Struck bars have no vibrato: the spectral peak within +-3 % of the note (a chord cannot confuse it)."""
        seg = sig[int(t0 * SR):int(t1 * SR)]; Sx = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), 1 << 17)); fx = np.fft.rfftfreq(1 << 17, 1 / SR)
        ref = 440 * 2 ** ((midi - 69) / 12); band = (fx > ref * 0.97) & (fx < ref * 1.03)
        return float(fx[band][np.argmax(Sx[band])])
    cents = lambda f_, midi: round(1200 * np.log2(f_ / (440 * 2 ** ((midi - 69) / 12))), 1)
    bsub, v, ve, bells = mono['bass-sub'], mono['voice'], mono['voice-end'], mono['bells']
    out['tuningCents'] = {
        'bass G1 second strokes (median)': med([cents(zc(bsub, (c + 0.75) * BEAT + 0.05, (c + 0.75) * BEAT + 0.14, 31), 31) for c in (0, 4, 8, 12, 48, 52, 184, 188, 216)]),
        'bass D2 after the glide (beat 2.85-3.08)': cents(zc(bsub, 2.85 * BEAT, 3.08 * BEAT, 38), 38),
        'bass Bb1 resolution (beat 248.5-251)': cents(zc(bsub, 248.5 * BEAT, 251 * BEAT, 34), 34),
        'bass final G1 (beat 280.5-283)': cents(zc(bsub, 280.5 * BEAT, 283 * BEAT, 31), 31),
        'voice D4 collapse (beat 84.6-86.6)': cents(spec(v, 84.6 * BEAT, 86.6 * BEAT, 62), 62),
        'voice G5 climax (beat 216.6-219.4)': cents(spec(v, 216.6 * BEAT, 219.4 * BEAT, 79), 79),
        'voice C6 climax (beat 228.6-231.4)': cents(spec(v, 228.6 * BEAT, 231.4 * BEAT, 84), 84),
        'voice-end G4 (beat 259.4-261.6)': cents(spec(ve, 259.4 * BEAT, 261.6 * BEAT, 67), 67),
        'voice-end B4, final (beat 280.4-282.8)': cents(spec(ve, 280.4 * BEAT, 282.8 * BEAT, 71), 71),
        'bells D5, hook B (beat 32.05-33.3, spectral peak)': cents(peak(bells, 32.05 * BEAT, 33.3 * BEAT, 74), 74),
        'bells B4 in the final chord (beat 280.2-283, spectral peak)': cents(peak(bells, 280.2 * BEAT, 283 * BEAT, 71), 71),
    }
    return out


if __name__ == '__main__':
    res = main(sys.argv[1]); txt = json.dumps(res, indent=1)
    if '--json' in sys.argv:
        Path(sys.argv[sys.argv.index('--json') + 1]).write_text(txt + '\n')
    print(txt)
