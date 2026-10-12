#!/usr/bin/env python3
"""Deterministic benchmark-local sound generator (Round 2, Opus submission).

One synthesis family, "talking steel", supplies the hook voice, the vowel bass,
the sub and the bowed-steel halo. Everything is computed from first principles
with numpy float64 arithmetic and a seeded xorshift32 noise source: no
recordings, downloaded samples, SoundFonts or impulse responses.

Usage (from the repository root):
    python3 benchmarks/ultimate-beat-battle/round2/opus/tools/generate_assets.py

Writes 44,100 Hz signed PCM16 WAVs plus kit JSON files into ../assets/custom/
and a provenance catalog (custom-catalog.json) with SHA-256 per file.
Repeated runs in the same environment are byte-identical (checked by --verify).
"""
import hashlib
import json
import os
import sys
import wave

import numpy as np

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'assets', 'custom'))


def hz(midi):
    return 440.0 * 2.0 ** ((midi - 69) / 12.0)


G1, G2, G4, G5 = hz(31), hz(43), hz(67), hz(79)


class XorShift32:
    def __init__(self, seed):
        self.s = (seed & 0xFFFFFFFF) or 1

    def noise(self, n):
        out = np.empty(n)
        s = self.s
        for i in range(n):
            s ^= (s << 13) & 0xFFFFFFFF
            s ^= s >> 17
            s ^= (s << 5) & 0xFFFFFFFF
            out[i] = s / 2147483648.0 - 1.0
        self.s = s
        return out


def raised(n):
    """Raised-cosine ramp 0 -> 1 over n samples."""
    if n <= 1:
        return np.ones(max(n, 0))
    return 0.5 - 0.5 * np.cos(np.pi * np.arange(n) / (n - 1))


def onepole_hp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    prev_x = 0.0
    prev_y = 0.0
    for i in range(len(x)):
        prev_y = a * (prev_y + x[i] - prev_x)
        prev_x = x[i]
        y[i] = prev_y
    return y


def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def envelope(n, attack_s, release_s, body_tau):
    t = np.arange(n) / SR
    env = np.exp(-t / body_tau) if body_tau else np.ones(n)
    a = min(n, max(2, int(attack_s * SR)))
    env[:a] *= raised(a)
    r = min(n - a, max(2, int(release_s * SR)))
    env[n - r:] *= raised(r)[::-1]
    return env


# Vowel formant table (Hz). Order: F1..F5.
VOWELS = {
    'u': [320, 800, 2240, 3300, 4300],
    'o': [470, 820, 2600, 3300, 4300],
    'a': [740, 1150, 2500, 3450, 4400],
    'aw': [600, 900, 2450, 3300, 4300],
    'e': [560, 1750, 2500, 3450, 4400],
}
F_GAIN = [1.0, 0.75, 0.42, 0.26, 0.14]
F_BW = [90, 110, 170, 240, 320]


def vowel_tracks(n, path):
    """path: list of (seconds, vowel). Returns array (5, n) of formant Hz."""
    t = np.arange(n) / SR
    times = [p[0] for p in path]
    out = np.empty((5, n))
    for i in range(5):
        out[i] = np.interp(t, times, [VOWELS[p[1]][i] for p in path])
    return out


def formant_filter(x, F, gains, bws, dry):
    """Parallel time-varying two-pole resonators (unity peak gain), coefficients
    refreshed every 16 samples from the formant tracks F (5, n)."""
    n = len(x)
    y = dry * x.copy()
    for i in range(F.shape[0]):
        r = np.exp(-np.pi * bws[i] / SR)
        y1 = y2 = 0.0
        out = np.empty(n)
        for start in range(0, n, 16):
            th = 2 * np.pi * F[i, start] / SR
            a1 = 2 * r * np.cos(th)
            a2 = r * r
            b0 = (1 - r) * np.sqrt(1 - 2 * r * np.cos(2 * th) + r * r)
            for j in range(start, min(n, start + 16)):
                v = b0 * x[j] + a1 * y1 - a2 * y2
                y2 = y1
                y1 = v
                out[j] = v
        y += gains[i] * out
    return y


def talking_steel(f0, dur, path, *, drive, metal, tick, breath, tilt, detune_mix,
                  body_tau, release, seed, scoop_cents=-30.0, kmax_hz=13000.0,
                  bw_scale=1.0, dry=0.08, post_drive=1.3, fgain=None):
    """Band-limited buzz -> drive -> moving vowel resonators, plus struck steel
    modes and a contact tick (one recipe for the hook voice and the vowel bass)."""
    n = int(round(dur * SR))
    t = np.arange(n) / SR
    rng = XorShift32(seed)
    # Pitch: small onset scoop, then exactly f0 (robotic, no vibrato).
    scoop = scoop_cents * np.exp(-t / 0.018)
    ratio = 2.0 ** (scoop / 1200.0)
    phase_base = 2 * np.pi * np.cumsum(f0 * ratio) / SR
    phase_base -= phase_base[0]
    src = np.zeros(n)
    for detune, mix in ((1.0, 1.0), (2.0 ** (9 / 1200.0), detune_mix)):
        if mix == 0:
            continue
        for k in range(1, int(kmax_hz // (f0 * detune)) + 1):
            src += mix * np.sin(k * detune * phase_base) / k ** tilt
    src /= np.max(np.abs(src)) + 1e-12
    src = np.tanh(drive * src) / np.tanh(drive)
    F = vowel_tracks(n, path)
    bws = [b * bw_scale for b in F_BW]
    voice = formant_filter(src, F, fgain or F_GAIN, bws, dry)
    voice /= np.max(np.abs(voice)) + 1e-12
    # Struck steel: free-bar mode ratios, split pairs for shimmer.
    steel = np.zeros(n)
    for r, a, tau in ((1.0, 0.22, 0.30), (2.756, 0.38, 0.16), (5.404, 0.28, 0.09),
                      (8.933, 0.18, 0.055), (13.34, 0.10, 0.035)):
        f = f0 * r
        if f > 16000:
            continue
        for split in (0.9985, 1.0015):
            steel += 0.5 * a * np.exp(-t / tau) * np.sin(2 * np.pi * f * split * t)
    # Contact tick: differentiated noise burst (~1 ms decay).
    tk = rng.noise(n)
    tk = np.concatenate(([0.0], np.diff(tk))) * np.exp(-t / 0.0009)
    # Breath: noise shaped toward the F2/F3 region.
    br = rng.noise(n)
    br = onepole_lp(onepole_hp(br, 1400.0), 5200.0)
    br /= np.max(np.abs(br)) + 1e-12
    x = voice + metal * steel + tick * tk + breath * br
    x = np.tanh(post_drive * x) / np.tanh(post_drive)
    x *= envelope(n, 0.003, release, body_tau)
    x = onepole_hp(x, 0.45 * f0)
    return x


def sub808(dur, seed=0):
    """Clean sine sub at G1 with a short 808-style pitch drop and mild drive."""
    n = int(round(dur * SR))
    t = np.arange(n) / SR
    depth, tau = 1.1, 0.014
    phase = 2 * np.pi * G1 * (t + depth * tau * (1 - np.exp(-t / tau)))
    x = np.sin(phase)
    x = np.tanh(1.4 * x) / np.tanh(1.4) + 0.10 * np.sin(phase) ** 2 - 0.05
    env = envelope(n, 0.0015, min(0.035, dur * 0.3), 1.6)
    x *= env
    x = onepole_hp(x, 18.0)
    return x


def bowed_halo(dur, seed, stereo_detune):
    """Bowed steel: sustained modes at G5 with slow beating and bow judder."""
    n = int(round(dur * SR))
    t = np.arange(n) / SR
    rng = XorShift32(seed)
    out = []
    judder = 0.75 + 0.25 * np.sin(2 * np.pi * 6.3 * t)
    for ch, d in enumerate((1.0 - stereo_detune, 1.0 + stereo_detune)):
        x = np.zeros(n)
        for r, a in ((1.0, 1.0), (2.0, 0.22), (2.756, 0.30), (5.404, 0.12), (8.933, 0.04)):
            for split in (0.9988, 1.0012):
                x += 0.5 * a * np.sin(2 * np.pi * G5 * r * split * d * t + ch * 0.7 * r)
        fr = rng.noise(n)
        fr = onepole_lp(onepole_hp(fr, 2500.0), 7000.0)
        fr /= np.max(np.abs(fr)) + 1e-12
        x = x / np.max(np.abs(x)) + 0.12 * fr * judder
        out.append(x)
    x = np.stack(out, axis=1)
    env = envelope(n, 0.9, 0.9, None)
    return x * env[:, None]


def steel_hat(dur, seed):
    """Open hat from the same steel modes, transposed into 6-14 kHz, plus noise."""
    n = int(round(dur * SR))
    t = np.arange(n) / SR
    rng = XorShift32(seed)
    x = np.zeros(n)
    base = G5 * 8.0  # G8-ish anchor so the ring stays in the key's overtone world
    for r, a in ((1.0, 0.5), (1.38, 0.35), (1.74, 0.3), (2.07, 0.22)):
        f = base * r
        if f < 18000:
            x += a * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.09)
    nz = rng.noise(n)
    nz = onepole_hp(onepole_hp(nz, 5500.0), 5500.0)
    nz /= np.max(np.abs(nz)) + 1e-12
    x = 0.35 * x + nz * np.exp(-t / 0.075)
    return x * envelope(n, 0.0008, 0.03, None)


def to_pcm16(x, peak_dbfs):
    x = np.asarray(x, dtype=np.float64)
    target = 10 ** (peak_dbfs / 20.0)
    x = x * (target / (np.max(np.abs(x)) + 1e-12))
    pcm = np.round(x * 32767.0).astype(np.int64)
    pcm = np.clip(pcm, -32768, 32767).astype('<i2')
    if pcm.ndim == 1:
        pcm[0] = 0
        pcm[-1] = 0
    else:
        pcm[0, :] = 0
        pcm[-1, :] = 0
    return pcm


def write_wav(path, pcm):
    ch = 1 if pcm.ndim == 1 else pcm.shape[1]
    with wave.open(path, 'wb') as w:
        w.setnchannels(ch)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def build():
    sounds = []  # (file, array, peak, meta)

    # Hook voice at G4: "yow" talkbox vowel on struck steel. Lengths in seconds.
    voice_lengths = [0.10, 0.14, 0.19, 0.25, 0.33, 0.45, 0.60, 0.85, 1.20]
    for i, L in enumerate(voice_lengths):
        path = [(0.0, 'u'), (min(0.07, L * 0.45), 'a'), (max(L * 0.75, 0.08), 'a'), (L, 'o')]
        x = talking_steel(G4, L, path, drive=1.6, metal=0.45, tick=0.30, breath=0.04,
                          tilt=0.85, detune_mix=0.35, body_tau=0.9, bw_scale=1.8,
                          fgain=[0.8, 1.0, 0.75, 0.55, 0.35],
                          release=min(0.045, L * 0.3), seed=1001 + i)
        sounds.append((f'voice-{int(L*1000):04d}.wav', x, -6.0,
                       {'family': 'talking-steel', 'role': 'hook voice', 'tuning': 'G4', 'f0': G4, 'seconds': L}))

    # Vowel bass at G2: same recipe, heavier drive, reese detune, darker vowel motion.
    growl_lengths = [0.14, 0.20, 0.28, 0.38, 0.50, 0.70, 1.00]
    for i, L in enumerate(growl_lengths):
        path = [(0.0, 'o'), (min(0.09, L * 0.5), 'a'), (max(L * 0.7, 0.1), 'aw'), (L, 'o')]
        x = talking_steel(G2, L, path, drive=3.0, metal=0.22, tick=0.22, breath=0.0,
                          tilt=0.8, detune_mix=0.8, body_tau=1.2,
                          release=min(0.04, L * 0.25), seed=2001 + i, scoop_cents=-15.0,
                          kmax_hz=9000.0, bw_scale=1.2, dry=0.12)
        sounds.append((f'growl-{int(L*1000):04d}.wav', x, -6.0,
                       {'family': 'talking-steel', 'role': 'vowel bass', 'tuning': 'G2', 'f0': G2, 'seconds': L}))

    # Sub at G1.
    sub_lengths = [0.12, 0.16, 0.20, 0.25, 0.30, 0.36, 0.42, 0.50, 0.60, 0.75, 0.90, 1.10, 1.40, 1.80]
    for L in sub_lengths:
        x = sub808(L)
        sounds.append((f'sub-{int(L*1000):04d}.wav', x, -5.0,
                       {'family': 'sub', 'role': 'low end', 'tuning': 'G1', 'f0': G1, 'seconds': L}))

    # Bowed steel halo at G5 (stereo).
    x = bowed_halo(3.6, 3001, 0.0009)
    sounds.append(('halo-g5.wav', x, -9.0,
                   {'family': 'talking-steel', 'role': 'tension halo', 'tuning': 'G5', 'f0': G5, 'seconds': 3.6}))
    sounds.append(('steelhat-open.wav', steel_hat(0.30, 4001), -8.0,
                   {'family': 'talking-steel', 'role': 'open hat', 'tuning': None, 'seconds': 0.30}))
    return sounds


def kit(prefix, files, base_pitch):
    return {'formatVersion': 1,
            'samples': [{'name': os.path.splitext(f)[0], 'pitch': base_pitch + i, 'file': f}
                        for i, f in enumerate(files)]}


def main():
    verify = '--verify' in sys.argv
    os.makedirs(OUT, exist_ok=True)
    sounds = build()
    catalog = {'generator': 'tools/generate_assets.py', 'sampleRate': SR, 'format': 'PCM16 WAV',
               'numpy': np.__version__, 'python': sys.version.split()[0],
               'license': 'CC0-1.0 (benchmark-local, generated in this repository)',
               'sounds': []}
    groups = {}
    for name, x, peak, meta in sounds:
        pcm = to_pcm16(x, peak)
        data_path = os.path.join(OUT, name)
        if verify:
            tmp = data_path + '.verify'
            write_wav(tmp, pcm)
            a = open(tmp, 'rb').read()
            b = open(data_path, 'rb').read()
            os.remove(tmp)
            print(('OK   ' if a == b else 'DIFF ') + name)
            continue
        write_wav(data_path, pcm)
        digest = hashlib.sha256(open(data_path, 'rb').read()).hexdigest()
        frames = pcm.shape[0]
        catalog['sounds'].append({'file': name, 'frames': frames, 'channels': 1 if pcm.ndim == 1 else 2,
                                  'peakDbfs': peak, 'sha256': digest, **meta})
        groups.setdefault(name.split('-')[0], []).append(name)
    if verify:
        return
    for prefix, base in (('voice', 60), ('growl', 40), ('sub', 20)):
        with open(os.path.join(OUT, f'{prefix}-kit.json'), 'w') as f:
            json.dump(kit(prefix, groups[prefix], base), f, indent=2)
            f.write('\n')
    with open(os.path.join(HERE, '..', 'custom-catalog.json'), 'w') as f:
        json.dump(catalog, f, indent=2)
        f.write('\n')
    print(f'wrote {len(sounds)} sounds to {OUT}')


if __name__ == '__main__':
    main()
