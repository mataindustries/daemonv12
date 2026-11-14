"""SOLECITO instrument builder.

Original, seeded synthesis of every non-bass sound in the score: a two-reed
musette accordion, a G-funk whistle lead, a synth brass section, gourd guiro,
llamador, congas, tarola, kick, shaker, tuned campana, and a few effects.
No recordings, SoundFonts or third-party audio. Output: 44.1 kHz PCM16 WAV and
DaemonV12 drumkit JSON under assets/.
"""
from __future__ import annotations

import json
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
RNG_SEED = 105


def midi_hz(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def note_name(m: int) -> str:
    return f"note-{m}"


def t_axis(seconds: float) -> np.ndarray:
    return np.arange(int(round(seconds * SR))) / SR


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)


def fade_tail(x, ms=20):
    n = min(len(x), int(SR * ms / 1000))
    if n:
        x[-n:] *= np.linspace(1, 0, n)[:, None] if x.ndim == 2 else np.linspace(1, 0, n)
    return x


def stereo(x, width_l=1.0, width_r=1.0):
    return np.stack([x * width_l, x * width_r], axis=1)


def write_wav(path: Path, x: np.ndarray, peak=0.89):
    if x.ndim == 1:
        x = stereo(x)
    m = np.max(np.abs(x))
    if m > 0:
        x = x * (peak / m)
    x = fade_tail(x.copy(), 4)
    pcm = np.clip(np.round(x * 32767), -32768, 32767).astype("<i2")
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def write_kit(dirpath: Path, entries: list[tuple[str, int, str]]):
    kit = {"formatVersion": 1, "samples": [{"name": n, "pitch": p, "file": f} for n, p, f in entries]}
    (dirpath / "kit.json").write_text(json.dumps(kit, indent=2) + "\n")


# --------------------------------------------------------------------------
# Pitched instruments
# --------------------------------------------------------------------------

def additive(freq_track: np.ndarray, amps: list[float], phases: np.ndarray, nyq_guard=15500.0, amp_env=None):
    """Sum harmonics of a time-varying fundamental (phase-accumulated)."""
    phase = 2 * np.pi * np.cumsum(freq_track) / SR
    out = np.zeros_like(freq_track)
    f_max = float(np.max(freq_track))
    for k, a in enumerate(amps, start=1):
        if a == 0 or k * f_max > nyq_guard:
            continue
        env = 1.0 if amp_env is None else amp_env(k)
        out += a * env * np.sin(k * phase + phases[k - 1])
    return out


def accordion(m: int, rng: np.random.Generator, seconds=2.6) -> np.ndarray:
    """Two-reed musette (0 / +9 cents) plus a quiet low reed. Nasal 1.8 kHz reed body."""
    t = t_axis(seconds)
    f0 = midi_hz(m)
    nh = 48
    ks = np.arange(1, nh + 1)
    kf = ks * f0
    formant = 1 + 1.6 * np.exp(-(np.log2(kf / 1700.0) ** 2) / (2 * 0.45 ** 2)) + 0.3 * np.exp(-(np.log2(kf / 3400.0) ** 2) / (2 * 0.3 ** 2))
    base = (1 / ks ** 1.0) * formant
    base[1::2] *= 0.78  # slight even-harmonic dip: reed asymmetry
    amps = list(base)
    # Bellows: soft overshoot push then very slow sag; brightness blooms in ~30 ms.
    att = np.clip(t / 0.014, 0, 1) ** 1.5
    push = 1 + 0.10 * np.exp(-t / 0.09) * (t > 0.014)
    sag = 1 - 0.07 * (t / seconds)
    env = att * push * sag

    def bright(k):
        tau = 0.004 + 0.0011 * k
        return 1 - np.exp(-t / tau)

    out = []
    for cents, pan in ((0.0, -0.35), (9.0, 0.35)):
        drift = 1 + (2 ** (1.2 * np.sin(2 * np.pi * rng.uniform(0.2, 0.4) * t + rng.uniform(0, 6.28)) / 1200) - 1)
        ft = f0 * 2 ** (cents / 1200) * drift
        v = additive(ft, amps, rng.uniform(0, 2 * np.pi, nh), amp_env=bright)
        out.append((v, pan))
    low = additive(np.full_like(t, f0 / 2 * 2 ** (-3 / 1200)), list(base[:24] * 0.9), rng.uniform(0, 2 * np.pi, nh), amp_env=bright)
    air = bp(rng.standard_normal(len(t)), min(f0 * 2.5, 6000), min(f0 * 5, 12000)) * 0.012 * np.exp(-t / 0.25)
    click = hp(rng.standard_normal(len(t)), 3000) * np.exp(-t / 0.0025) * 0.05
    L = np.zeros_like(t)
    R = np.zeros_like(t)
    for v, pan in out:
        L += v * (1 - max(0, pan))
        R += v * (1 + min(0, pan))
    L += 0.22 * low + air + click
    R += 0.22 * low + air + click
    x = np.stack([L * env, R * env], axis=1)
    return fade_tail(x, 60)


def whistle(m: int, rng: np.random.Generator, seconds=3.2) -> np.ndarray:
    """G-funk style whistle lead: soft square-ish sine, scoop-in, delayed vibrato, breath."""
    t = t_axis(seconds)
    f0 = midi_hz(m)
    scoop = 2 ** ((-45 * np.exp(-t / 0.035)) / 1200)
    vib_depth = np.clip((t - 0.16) / 0.45, 0, 1) * 24  # cents
    vib = 2 ** ((vib_depth * np.sin(2 * np.pi * 5.7 * t)) / 1200)
    ft = f0 * scoop * vib
    amps = [1.0, 0.10, 0.22, 0.03, 0.07, 0.0, 0.025]
    v = additive(ft, amps, np.zeros(len(amps)))
    breath = bp(rng.standard_normal(len(t)), min(f0 * 1.5, 9000), min(f0 * 3.5, 15000)) * 0.035
    breath *= 0.6 + 0.4 * np.exp(-t / 0.08)
    env = np.clip(t / 0.022, 0, 1) * (1 + 0.06 * np.sin(2 * np.pi * 5.7 * t + 1.2) * np.clip((t - 0.16) / 0.45, 0, 1))
    x = (v + breath) * env * (1 - 0.15 * t / seconds)
    return fade_tail(stereo(x), 80)


def brass_chord(midis: list[int], rng: np.random.Generator, seconds=1.8) -> np.ndarray:
    """Synth brass section: detuned saw stacks with a lip 'blat' brightness envelope."""
    t = t_axis(seconds)
    L = np.zeros_like(t)
    R = np.zeros_like(t)
    kc = 2.0 + 13.0 * (1 - np.exp(-t / 0.028))
    kc = kc * (0.55 + 0.45 * np.exp(-t / 0.35))  # blat then mellow
    for i, m in enumerate(midis):
        f0 = midi_hz(m)
        nh = int(min(40, 15500 / f0))
        for j, cents in enumerate((-7, -2.5, 2.5, 7)):
            scoop = 2 ** ((-30 * np.exp(-t / 0.03)) / 1200)
            vib = 2 ** ((6 * np.sin(2 * np.pi * (5.1 + 0.3 * j) * t + j)) / 1200)
            ft = f0 * 2 ** (cents / 1200) * scoop * vib
            amps = [1 / k for k in range(1, nh + 1)]
            v = additive(ft, amps, rng.uniform(0, 2 * np.pi, nh), amp_env=lambda k: np.exp(-k / kc))
            pan = (-0.5, 0.5, -0.2, 0.2)[j]
            L += v * (1 - max(0, pan))
            R += v * (1 + min(0, pan))
    env = np.clip(t / 0.012, 0, 1) * (0.62 + 0.38 * np.exp(-t / 0.22))
    x = np.stack([L * env, R * env], axis=1)
    x = np.stack([lp(x[:, 0], 7000), lp(x[:, 1], 7000)], axis=1)
    return fade_tail(x, 120)


# --------------------------------------------------------------------------
# Percussion
# --------------------------------------------------------------------------

def guiro(rng, length, rate0, rate1, strength=1.0):
    """Gourd scrape: a train of tiny ridge clicks through two gourd resonances."""
    t = t_axis(length + 0.08)
    out = np.zeros_like(t)
    pos = 0.004
    while pos < length:
        prog = pos / length
        rate = rate0 + (rate1 - rate0) * prog
        amp = np.sin(np.pi * min(1, prog * 1.15 + 0.08)) ** 0.6 * rng.uniform(0.6, 1.0)
        i = int(pos * SR)
        n = int(0.0035 * SR)
        burst = rng.standard_normal(n) * np.exp(-np.arange(n) / (0.0007 * SR)) * amp
        out[i:i + n] += burst[: len(out) - i]
        pos += 1 / rate * rng.uniform(0.85, 1.15)
    body = bp(out, 900, 1400) * 1.4 + bp(out, 2800, 3900) * 1.1 + hp(out, 5500) * 0.9
    body *= strength
    L = body
    R = np.concatenate([np.zeros(9), body[:-9]])  # tiny Haas width
    return fade_tail(np.stack([L, R], axis=1), 15)


def membrane(rng, f, decay, pitch_drop=0.08, overtones=((1.59, 0.35), (2.14, 0.18)), slap=0.0, seconds=0.6, noise_decay=0.012):
    t = t_axis(seconds)
    ft = f * (1 + pitch_drop * np.exp(-t / 0.02))
    ph = 2 * np.pi * np.cumsum(ft) / SR
    x = np.sin(ph) * np.exp(-t / decay)
    for ratio, a in overtones:
        x += a * np.sin(ph * ratio + rng.uniform(0, 6)) * np.exp(-t / (decay * 0.55))
    n = rng.standard_normal(len(t)) * np.exp(-t / noise_decay)
    x += bp(n, 800, 6000) * (0.25 + slap)
    return fade_tail(x, 10)


def kick(rng):
    t = t_axis(0.55)
    ft = 58 + 95 * np.exp(-t / 0.028) + 20 * np.exp(-t / 0.12)
    ph = 2 * np.pi * np.cumsum(ft) / SR
    x = np.sin(ph) * np.exp(-t / 0.15)
    x = np.tanh(1.6 * x) / np.tanh(1.6)
    x += hp(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.0018) * 0.25
    x += lp(rng.standard_normal(len(t)), 900) * np.exp(-t / 0.01) * 0.12
    return fade_tail(x, 20)


def tarola(rng, tone=330, snares=1.0, decay=0.13, seconds=0.45):
    t = t_axis(seconds)
    ft = tone * (1 + 0.12 * np.exp(-t / 0.01))
    ph = 2 * np.pi * np.cumsum(ft) / SR
    body = np.sin(ph) * np.exp(-t / 0.06) + 0.45 * np.sin(1.72 * ph) * np.exp(-t / 0.035)
    nz = rng.standard_normal(len(t))
    sn = bp(nz, 1800, 9000) * np.exp(-t / decay) * snares
    crack = hp(nz, 4000) * np.exp(-t / 0.003) * 0.7
    shell = np.sin(2 * np.pi * 880 * t) * np.exp(-t / 0.05) * 0.18 + np.sin(2 * np.pi * 1320 * t) * np.exp(-t / 0.03) * 0.1
    return fade_tail(body * 0.8 + sn * 0.9 + crack + shell, 15)


def shaker(rng, accent=1.0):
    t = t_axis(0.12)
    env = np.clip(t / 0.012, 0, 1) * np.exp(-np.clip(t - 0.012, 0, None) / 0.03)
    x = hp(rng.standard_normal(len(t)), 5500, 4) * env * accent
    return fade_tail(x, 5)


def campana(rng, f1=587.33, f2=880.0):
    t = t_axis(0.6)
    sq = lambda f: np.sign(np.sin(2 * np.pi * f * t)) * 0.6 + np.sin(2 * np.pi * f * t) * 0.4
    x = sq(f1) + 0.8 * sq(f2)
    x = bp(x, 500, 4500)
    env = np.exp(-t / 0.12) * 0.8 + np.exp(-t / 0.02) * 0.6
    x = x * env + hp(rng.standard_normal(len(t)), 3000) * np.exp(-t / 0.002) * 0.3
    return fade_tail(x, 20)


def crash(rng, seconds=2.6, bright=1.0):
    t = t_axis(seconds)
    x = np.zeros_like(t)
    for _ in range(70):
        f = rng.uniform(2800, 11500)
        d = rng.uniform(0.4, 1.6)
        x += np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t / d) * rng.uniform(0.2, 1)
    x = x / 25 + hp(rng.standard_normal(len(t)), 4500) * np.exp(-t / 0.9) * 0.6 * bright
    x *= np.clip(t / 0.002, 0, 1)
    L = x
    R = np.concatenate([np.zeros(23), x[:-23]]) * 0.95 + hp(rng.standard_normal(len(t)), 6000) * np.exp(-t / 0.7) * 0.15
    return fade_tail(np.stack([L, R], axis=1), 300)


def sun_impact(rng):
    """Payoff boom tuned to D: 73 Hz body falling to D1-ish, wrapped in a soft wash."""
    t = t_axis(2.2)
    ft = 36.71 + 60 * np.exp(-t / 0.05) + 36.7 * np.exp(-t / 0.5)
    ph = 2 * np.pi * np.cumsum(ft) / SR
    boom = np.tanh(1.8 * np.sin(ph) * np.exp(-t / 0.55))
    return fade_tail(boom, 200)


def riser(rng, seconds):
    t = t_axis(seconds)
    prog = t / seconds
    nz = rng.standard_normal(len(t))
    out = np.zeros_like(t)
    # stepped band sweep, 24 slices, crossfaded by envelope
    slices = 24
    for i in range(slices):
        c = 400 * (20 ** (i / (slices - 1)))
        w = np.exp(-((prog - i / (slices - 1)) ** 2) / (2 * (1.2 / slices) ** 2))
        out += bp(nz, c * 0.8, min(c * 1.25, 19000)) * w
    sweep_f = 220 * 2 ** (prog * 3)
    tone = np.sin(2 * np.pi * np.cumsum(sweep_f) / SR) * 0.15 + np.sin(2 * np.pi * np.cumsum(sweep_f * 1.5) / SR) * 0.08
    env = prog ** 2.2
    x = (out * 0.8 + tone) * env
    L = x
    R = np.concatenate([np.zeros(31), x[:-31]])
    return np.stack([L, R], axis=1)


def crackle(rng, seconds=2.6):
    t = t_axis(seconds)
    x = lp(hp(rng.standard_normal(len(t)), 1500), 7000) * 0.025
    n_pops = int(seconds * 28)
    for _ in range(n_pops):
        i = rng.integers(0, len(t) - 200)
        n = rng.integers(20, 120)
        x[i:i + n] += rng.standard_normal(n) * np.exp(-np.arange(n) / rng.uniform(4, 20)) * rng.uniform(0.1, 0.9) ** 2
    x = bp(x, 700, 9000)
    return np.stack([x, np.concatenate([np.zeros(13), x[:-13]])], axis=1)


# --------------------------------------------------------------------------

def build(assets: Path, used: dict[str, set[int]]):
    rng = np.random.default_rng(RNG_SEED)

    def pitched(name, fn, notes, peak):
        d = assets / name
        entries = []
        for m in sorted(notes):
            write_wav(d / f"{note_name(m)}.wav", fn(m, np.random.default_rng(RNG_SEED + m)), peak=peak)
            entries.append((note_name(m), m, f"{note_name(m)}.wav"))
        write_kit(d, entries)

    pitched("accordion", accordion, used["accordion"], 0.5)
    pitched("whistle", whistle, used["whistle"], 0.6)

    d = assets / "brass"
    chords = {
        "brass-d": [62, 66, 69, 74],          # D: D4 F#4 A4 D5
        "brass-g": [62, 67, 71, 74],          # G/D: D4 G4 B4 D5
        "brass-a7": [61, 64, 67, 69],         # A7/C#: C#4 E4 G4 A4
        "brass-d69": [62, 69, 71, 76, 78],    # D6/9: D4 A4 B4 E5 F#5
    }
    for i, (n, ms) in enumerate(chords.items()):
        write_wav(d / f"{n}.wav", brass_chord(ms, np.random.default_rng(RNG_SEED + 300 + i)), peak=0.8)
    write_kit(d, [(n, 60 + i, f"{n}.wav") for i, n in enumerate(chords)])

    d = assets / "perc"
    hits = {}
    r = np.random.default_rng(RNG_SEED + 500)
    hits["kick"] = kick(r)
    hits["guiro-long-a"] = guiro(r, 0.20, 46, 62)
    hits["guiro-long-b"] = guiro(r, 0.19, 50, 58)
    hits["guiro-short-a"] = guiro(r, 0.055, 70, 70, 0.8)
    hits["guiro-short-b"] = guiro(r, 0.05, 76, 66, 0.75)
    hits["guiro-short-c"] = guiro(r, 0.06, 64, 72, 0.8)
    hits["llamador-a"] = membrane(r, 420, 0.05, pitch_drop=0.05, slap=0.35, seconds=0.3)
    hits["llamador-b"] = membrane(r, 405, 0.045, pitch_drop=0.05, slap=0.3, seconds=0.3)
    hits["conga-open"] = membrane(r, 300, 0.16, seconds=0.6)
    hits["tumba-open"] = membrane(r, 205, 0.2, seconds=0.7)
    hits["conga-slap"] = membrane(r, 340, 0.04, pitch_drop=0.02, slap=1.4, seconds=0.3, noise_decay=0.02)
    hits["conga-mute"] = membrane(r, 260, 0.025, pitch_drop=0.0, slap=0.05, seconds=0.2)
    hits["tarola"] = tarola(r)
    hits["tarola-ghost"] = tarola(r, tone=350, snares=0.8, decay=0.07, seconds=0.25)
    hits["shaker"] = shaker(r)
    hits["shaker-accent"] = shaker(r, 1.4)
    hits["campana"] = campana(r)
    peaks = {"kick": 0.95, "conga-open": 0.7, "tumba-open": 0.75, "campana": 0.6}
    entries = []
    for i, (n, x) in enumerate(hits.items()):
        write_wav(d / f"{n}.wav", x, peak=peaks.get(n, 0.8))
        entries.append((n, 35 + i, f"{n}.wav"))
    write_kit(d, entries)

    d = assets / "fx"
    r = np.random.default_rng(RNG_SEED + 900)
    beat = 60 / 105
    fx = {
        "crash": crash(r),
        "crash-small": crash(r, 1.6, 0.6),
        "sun-impact": sun_impact(r),
        "riser": riser(r, 3 * beat),
        "crackle": crackle(r),
    }
    entries = []
    for i, (n, x) in enumerate(fx.items()):
        write_wav(d / f"{n}.wav", x, peak=0.85)
        entries.append((n, 70 + i, f"{n}.wav"))
    write_kit(d, entries)
