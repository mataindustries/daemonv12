#!/usr/bin/env python3
"""Score builder: writes the DaemonV12 project JSON for the Opus Round 2 record.

Musical decisions live here as readable note lists; the script only does the
bookkeeping DaemonV12 needs (swing ticks, canonical positions, playback rates,
choosing a source length so monophonic voices never overlap).

    python3 tools/build_project.py [out.json]
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..'))

BPM = 134
US_PER_Q = round(60_000_000 / BPM)
SEC_PER_TICK = US_PER_Q / 960 / 1_000_000
STEP = 240          # sixteenth note in ticks
BAR = 3840
SWING = 60          # even sixteenths land 60 ticks late (62.5% swing)
BARS = 16

# Pitch names relative to each source's tuning, in semitones.
SEMI = {'Eb': -4, 'E': -3, 'F': -2, 'F#': -1, 'G': 0, 'Ab': 1, 'A': 2, 'Bb': 3, 'B': 4,
        'C': 5, 'C#': 6, 'D': 7, 'Eb+': 8, 'F+': 10, 'G+': 12, 'Ab+': 13, 'Bb+': 15}
VARIANTS = {
    'voice': [0.10, 0.14, 0.19, 0.25, 0.33, 0.45, 0.60, 0.85, 1.20],
    'growl': [0.14, 0.20, 0.28, 0.38, 0.50, 0.70, 1.00],
    'sub': [0.12, 0.16, 0.20, 0.25, 0.30, 0.36, 0.42, 0.50, 0.60, 0.75, 0.90, 1.10, 1.40, 1.80],
}


def rate(semitones):
    return round(2.0 ** (semitones / 12.0), 6)


def tick(bar, step, swing=True):
    """Absolute tick for a 1-based bar and 1-based sixteenth step (steps may exceed 16)."""
    t = (bar - 1) * BAR + (step - 1) * STEP
    if swing and step % 2 == 0:
        t += SWING
    return t


def fmt_pos(t):
    bar = t // BAR + 1
    r = t % BAR
    beat = r // 960 + 1
    off = r % 960
    if off == 0:
        return f'{bar}:{beat}'
    g = math.gcd(off, 3840)
    return f'{bar}:{beat}+{off // g}/{3840 // g}'


def fmt_dur(t):
    g = math.gcd(t, 3840)
    return f'{t // g}/{3840 // g}'


def source_needed(r0, r1, glide_s, out_s):
    """Source seconds read in out_s output seconds (V0.6 linear-rate glide)."""
    if r1 is None or glide_s <= 0:
        return r0 * out_s
    if out_s <= glide_s:
        return out_s * (r0 + (r1 - r0) * out_s / (2 * glide_s))
    return glide_s * (r0 + r1) / 2 + (out_s - glide_s) * r1


def voice_length(L, r0, r1, glide_s):
    """Output seconds until a source of L seconds is exhausted."""
    lo, hi = 0.0, 20.0
    for _ in range(80):
        mid = (lo + hi) / 2
        if source_needed(r0, r1, glide_s, mid) >= L:
            hi = mid
        else:
            lo = mid
    return hi


class Track:
    def __init__(self, tid, instrument, desc, mono=None, family=None):
        self.id, self.instrument, self.desc = tid, instrument, desc
        self.mono, self.family = mono, family
        self.notes = []          # (tick, note dict, end_seconds or None)
        self.mix = None
        self.effects = []
        self.automation = None

    def hit(self, t, pitch=None, vel=0.8, r=None, glide=None, offset=None):
        n = {}
        if pitch is not None:
            n['pitch'] = pitch
        n['velocity'] = round(vel, 3)
        if r is not None and r != 1:
            n['playbackRate'] = r
        if offset:
            n['offsetSeconds'] = offset
        if glide:
            n['glide'] = {'to': glide[0], 'duration': fmt_dur(glide[1])}
        self.notes.append((t, n, None))
        return n

    def tone(self, t, semis, max_steps, vel=0.8, glide=None, min_variant=None):
        """Pitched note from a length-variant kit: choose the longest source that
        stops sounding within max_steps sixteenths (monophonic phrasing)."""
        r0 = rate(semis)
        r1 = rate(glide[0]) if glide else None
        g_s = glide[1] * SEC_PER_TICK if glide else 0.0
        out_s = max_steps * STEP * SEC_PER_TICK
        need = source_needed(r0, r1, g_s, out_s)
        options = [L for L in VARIANTS[self.family] if L <= need + 1e-9]
        if min_variant:
            options = [L for L in options if L >= min_variant] or [min_variant]
        L = options[-1] if options else VARIANTS[self.family][0]
        name = f'{self.family}-{int(round(L * 1000)):04d}'
        n = {'pitch': name, 'velocity': round(vel, 3)}
        if r0 != 1:
            n['playbackRate'] = r0
        if glide:
            n['glide'] = {'to': r1, 'duration': fmt_dur(glide[1])}
        end = t * SEC_PER_TICK + voice_length(L, r0, r1, g_s)
        self.notes.append((t, n, end))
        return n


def build():
    T = {}

    def add(*a, **k):
        tr = Track(*a, **k)
        T[tr.id] = tr
        return tr

    kit = lambda p: {'type': 'drumkit', 'kit': p}
    voice = add('voice', kit('assets/custom/voice-kit.json'),
                'Talking-steel hook voice (G4 source, rate-performed). Calls in bars 1-8, dives in the payoff.',
                mono=True, family='voice')
    twin = add('twin', kit('assets/custom/voice-kit.json'),
               'From the payoff on: the voice an octave higher on the opposite side, diving with the answer.',
               mono=True, family='voice')
    stall = add('stall', kit('assets/custom/voice-kit.json'),
                'The same voice, tape-stopped into a groan at the bar-9 stall; drenched in room.', family='voice')
    growl = add('growl', kit('assets/custom/growl-kit.json'),
                'Vowel bass from the same steel recipe at G2: takes over the call in the payoff.',
                mono=True, family='growl')
    sub = add('sub', kit('assets/custom/sub-kit.json'),
              'G1 sine sub with 808 drop. Answers the call with octave dives; doubles the bass call in the payoff.',
              mono=True, family='sub')
    kick = add('kick', kit('assets/iron-kit.json'), 'Orbital Foundry mechanical kick, retuned toward D (the fifth).')
    snare = add('snare', kit('assets/iron-kit.json'), 'Industrial snare + chrome clap on 2 and 4.')
    hats = add('hats', kit('assets/iron-kit.json'), 'Swung machine ticks and pixel hats: the garage shuffle.')
    openhat = add('openhat', kit('assets/iron-kit.json'), 'Steel open hat on the offbeat eighths (same steel family).')
    metal = add('metal', kit('assets/iron-kit.json'),
                'Metallic strike tuned to D6: the third voice in the call and response.')
    boom = add('boom', kit('assets/iron-kit.json'), 'Low boom tuned to G for the stall and the payoff downbeat.')
    halo = add('halo', {'type': 'sampler', 'sample': 'assets/custom/halo-g5.wav'},
               'Bowed-steel halo: G5 against A-flat tension, resolving to G5+D6 in the payoff.')

    D_KICK = rate(1)          # mechanical kick ~C#2 body -> D2
    D_STEEL = 0.98444         # metallic strike's 1193 Hz mode -> D6 (1174.7 Hz)

    # ---------------------------------------------------------------- the call
    def call(tr, bar, kind, octave_semis=0, vel=0.85, last_steps=2.6):
        """kind 'fall': G Bb Ab->G   kind 'rise': G Bb C->D   kind 'rise2': G Bb C->Eb"""
        o = octave_semis
        tr.tone(tick(bar, 1), 0 + o, 2.7, vel)
        tr.tone(tick(bar, 4), 3 + o, 2.4, vel * 0.92)
        if kind == 'fall':
            tr.tone(tick(bar, 7), 1 + o, last_steps, vel, glide=(0 + o, 2 * STEP))
        elif kind == 'rise':
            tr.tone(tick(bar, 7), 5 + o, last_steps, vel, glide=(7 + o, 2 * STEP))
        elif kind == 'rise2':
            tr.tone(tick(bar, 7), 5 + o, last_steps, vel, glide=(8 + o, 2 * STEP))

    def sub_answer(bar, root, vel=0.9):
        """Octave zap: root+12 -> root over a sixteenth, ends before the kick on step 11."""
        sub.tone(tick(bar, 9), root + 12, 1.9, vel, glide=(root, STEP))

    def steel(bar, step, vel, r=D_STEEL):
        metal.hit(tick(bar, step), 'metallic-strike', vel, r=r)

    # -------------------------------------------------------- drums & texture
    def shuffle(bar, density='full', vel=1.0):
        """Swung sixteenth ticks with accents; offbeat steel open hats; pixel ghosts."""
        for s in range(1, 17):
            pos = (s - 1) % 4
            if density == 'ticks':
                v = [0.62, 0.3, 0.52, 0.4][pos]
            else:
                v = [0.62, 0.34, 0.45, 0.48][pos]
            hats.hit(tick(bar, s), 'machine-tick', v * vel)
            if density != 'ticks' and pos == 2:
                openhat.hit(tick(bar, s), 'steelhat-open', (0.72 if s in (3, 11) else 0.6) * vel)
            if density == 'wide' and pos in (1, 3):
                hats.hit(tick(bar, s), 'pixel-hat', (0.5 if pos == 3 else 0.32) * vel)

    def two_step(bar, variant='a', snare_vel=0.85):
        kick.hit(tick(bar, 1), 'mechanical-kick', 0.92, r=D_KICK)
        kick.hit(tick(bar, 11), 'mechanical-kick', 0.8, r=D_KICK)
        if variant == 'b':
            kick.hit(tick(bar, 8), 'mechanical-kick', 0.62, r=D_KICK)
        for s in (5, 13):
            snare.hit(tick(bar, s), 'industrial-snare', snare_vel)
            snare.hit(tick(bar, s), 'chrome-clap', snare_vel * 0.8, r=rate(1))

    # =============================================================== SIGNAL 1-2
    for b, kind, root in ((1, 'fall', 0), (2, 'rise', -4)):
        call(voice, b, kind)
        sub_answer(b, root)
        shuffle(b, 'ticks', 0.85)
        steel(b, 12, 0.62)                       # the steel answers the sub
    steel(1, 1, 0.5)
    steel(2, 15, 0.38)
    # Halo an octave above the hook's partials, breathing once per two-bar phrase.
    for b in (1, 3, 5):
        halo.hit(tick(b, 1), vel=0.55, r=rate(12))
        halo.hit(tick(b, 1), vel=0.42, r=rate(13))

    # ============================================================== SHUFFLE 3-6
    for b in range(3, 7):
        kind = 'fall' if b % 2 == 1 else 'rise'
        root = 0 if b % 2 == 1 else -4
        if b <= 4:
            call(voice, b, kind)
            sub_answer(b, root)
            two_step(b, 'b' if b % 2 == 0 else 'a')
        else:
            # The answer interrupts: the sub dives on step 7, the voice finishes late.
            voice.tone(tick(b, 1), 0, 2.7, 0.85)
            voice.tone(tick(b, 4), 3, 2.4, 0.78)
            sub.tone(tick(b, 7), root + 12, 1.9, 0.9, glide=(root, STEP))
            if kind == 'fall':
                voice.tone(tick(b, 9), 1, 2.6, 0.88, glide=(0, 2 * STEP))
            else:
                voice.tone(tick(b, 9), 5, 2.6, 0.88, glide=(7, 2 * STEP))
            two_step(b, 'a')
        sub.tone(tick(b, 14), root, 1.8, 0.75)
        shuffle(b, 'full' if b <= 4 else 'wide')
        steel(b, 12, 0.6)
        if b >= 5:                               # the reply starts answering itself
            steel(b, 16, 0.4, r=D_STEEL * rate(-5))

    # =============================================================== TORQUE 7-8
    gear = [0, 3, 1, 0, 3, 1, 3, 5, 3, 5, 7]
    for i, semis in enumerate(gear):
        st = 1 + 3 * i
        b = 7 + (st - 1) // 16
        s = (st - 1) % 16 + 1
        voice.tone(tick(b, s), semis, 2.6, 0.8 + 0.015 * i)
        steel(b, s, 0.3 + 0.03 * i)
    for b in (7, 8):
        kick.hit(tick(b, 1), 'mechanical-kick', 0.9, r=D_KICK)
        kick.hit(tick(b, 7), 'mechanical-kick', 0.7, r=D_KICK)
        kick.hit(tick(b, 11), 'mechanical-kick', 0.78, r=D_KICK)
        snare.hit(tick(b, 5), 'industrial-snare', 0.85)
        snare.hit(tick(b, 5), 'chrome-clap', 0.7, r=rate(1))
        if b == 7:
            snare.hit(tick(b, 13), 'industrial-snare', 0.85)
            snare.hit(tick(b, 13), 'chrome-clap', 0.7, r=rate(1))
        shuffle(b, 'full')
    # Build bass: short hits, then the bass joins the gear cycle and climbs.
    sub.tone(tick(7, 1), 0, 1.8, 0.8)
    sub.tone(tick(7, 9), 0, 1.8, 0.75)
    for s, semis in ((3, 0), (6, 3), (9, 1), (12, 5), (15, 7)):
        sub.tone(tick(8, s), semis, 1.8, 0.7 + 0.03 * semis)
    for b in (7, 8):
        halo.hit(tick(b, 1), vel=0.6, r=rate(12))
        halo.hit(tick(b, 1), vel=0.48, r=rate(13))

    # ================================================================ STALL 9
    stall.tone(tick(9, 1), 7, 9.5, 0.9, glide=(-17, 8 * STEP))   # D5 seizing to D3
    sub.tone(tick(9, 1), 0, 9.0, 0.85, glide=(-12, 8 * STEP))
    boom.hit(tick(9, 1), 'low-boom', 0.8, r=rate(3))               # ~41 Hz -> ~49 Hz (G1)
    metal.hit(tick(9, 1), 'metallic-strike', 0.7, r=0.5)
    kick.hit(tick(9, 1), 'mechanical-kick', 0.95, r=D_KICK)

    # ================================================================= SWAP 10-13
    for b in range(10, 14):
        kind = {10: 'fall', 11: 'rise', 12: 'fall', 13: 'rise2'}[b]
        call(growl, b, kind, octave_semis=0, vel=0.95)
        call(sub, b, kind, octave_semis=0, vel=0.88)
        # The voice now owns the dive answer.
        ans_root = 0 if b % 2 == 0 else 1          # G, then A-flat (bII)
        top = 12 if b < 12 else 24 - ans_root       # deeper dive the second time (rate <= 4)
        voice.tone(tick(b, 9), ans_root + top, 2.8, 1.0, glide=(ans_root, STEP if b < 12 else 2 * STEP))
        twin.tone(tick(b, 9), 24, 2.8, 0.85, glide=(ans_root + 12, STEP if b < 12 else 2 * STEP))
        voice.tone(tick(b, 12), ans_root + 7, 1.6, 0.7)
        voice.tone(tick(b, 15), ans_root + 12, 1.6, 0.62)
        sub.tone(tick(b, 14), ans_root, 1.8, 0.75)
        two_step(b, 'b' if b % 2 == 1 else 'a', 0.9)
        shuffle(b, 'wide')
        steel(b, 12, 0.62)
        steel(b, 16, 0.42, r=D_STEEL * rate(-5))
    boom.hit(tick(10, 1), 'low-boom', 0.85, r=rate(3))
    steel(10, 1, 0.95)
    snare.hit(tick(10, 1), 'chrome-clap', 0.85, r=rate(1))
    for b in (10, 12):
        halo.hit(tick(b, 1), vel=0.6)
        halo.hit(tick(b, 1), vel=0.45, r=rate(7))

    # ============================================================= CONVERGE 14-15
    for b, kind in ((14, 'fall'), (15, 'rise')):
        ls = 1.9 if b == 14 else 3.0
        call(voice, b, kind, vel=0.92, last_steps=ls)
        call(twin, b, kind, octave_semis=12, vel=0.78, last_steps=ls)
        call(growl, b, kind, vel=0.92, last_steps=ls)
        call(sub, b, kind, vel=0.88, last_steps=ls)
    two_step(14, 'a', 0.9)
    shuffle(14, 'wide')
    steel(14, 12, 0.62)
    sub.tone(tick(14, 9), 12, 1.9, 0.9, glide=(0, STEP))
    voice.tone(tick(14, 9), 12, 2.8, 0.85, glide=(0, STEP))
    twin.tone(tick(14, 9), 24, 2.8, 0.75, glide=(12, STEP))
    # Bar 15: pull-up. Drums for the call, then only ticks under the held D.
    kick.hit(tick(15, 1), 'mechanical-kick', 0.92, r=D_KICK)
    snare.hit(tick(15, 5), 'industrial-snare', 0.9)
    snare.hit(tick(15, 5), 'chrome-clap', 0.72, r=rate(1))
    kick.hit(tick(15, 8), 'mechanical-kick', 0.62, r=D_KICK)
    for s_ in range(1, 17):
        v = [0.62, 0.34, 0.45, 0.48][(s_ - 1) % 4] * (1.0 if s_ <= 8 else 0.7)
        hats.hit(tick(15, s_), 'machine-tick', v)
        if s_ in (3, 7):
            openhat.hit(tick(15, s_), 'steelhat-open', 0.6)

    # ================================================================= EXIT 16
    # The answer gesture, finally sung by every voice at once.
    voice.tone(tick(16, 1), 12, 3.2, 0.95, glide=(0, 2 * STEP))
    twin.tone(tick(16, 1), 24, 3.2, 0.8, glide=(12, 2 * STEP))
    growl.tone(tick(16, 1), 12, 3.6, 0.92, glide=(0, 2 * STEP))
    sub.tone(tick(16, 1), 12, 3.6, 0.92, glide=(0, STEP))
    kick.hit(tick(16, 1), 'mechanical-kick', 0.95, r=D_KICK)
    snare.hit(tick(16, 1), 'chrome-clap', 0.85, r=rate(1))
    snare.hit(tick(16, 1), 'industrial-snare', 0.7)
    steel(16, 1, 0.8)

    # ================================================================ mix
    voice.mix = {'gainDb': -3}
    voice.effects = [{'type': 'highpass', 'frequencyHz': 180},
                     {'type': 'delay', 'timeMs': 335.8, 'wet': 0.12},
                     {'type': 'reverb', 'roomSize': 0.35, 'decaySeconds': 0.9, 'wet': 0.12}]
    # Payoff answers trade sides; everything before bar 10 stays centred.
    voice.automation = {'pan': [
        {'at': {'musical': '10:1'}, 'value': -0.45},
        {'at': {'musical': '14:1'}, 'value': -0.3},
    ]}
    twin.mix = {'gainDb': -1, 'pan': 0.6}
    twin.effects = [{'type': 'highpass', 'frequencyHz': 300},
                    {'type': 'reverb', 'roomSize': 0.5, 'decaySeconds': 1.1, 'wet': 0.2}]
    stall.mix = {'gainDb': -4}
    stall.effects = [{'type': 'highpass', 'frequencyHz': 70},
                     {'type': 'reverb', 'roomSize': 0.8, 'decaySeconds': 2.2, 'wet': 0.35}]
    growl.mix = {'gainDb': -3}
    growl.effects = [{'type': 'highpass', 'frequencyHz': 85},
                     {'type': 'saturation', 'driveDb': 9, 'mix': 0.5},
                     {'type': 'lowpass', 'frequencyHz': 11000}]
    sub.mix = {'gainDb': -5}
    sub.effects = [{'type': 'lowpass', 'frequencyHz': 220}]
    kick.mix = {'gainDb': -3}
    snare.mix = {'gainDb': -6}
    snare.effects = [{'type': 'highpass', 'frequencyHz': 160}]
    hats.mix = {'gainDb': -4, 'pan': -0.1}
    hats.effects = [{'type': 'highpass', 'frequencyHz': 2000}]
    hats.automation = {'pan': [{'at': {'musical': '10:1'}, 'value': -0.4},
                               {'at': {'musical': '16:1'}, 'value': -0.1}]}
    openhat.mix = {'gainDb': -9, 'pan': 0.1}
    openhat.effects = [{'type': 'highpass', 'frequencyHz': 4000}]
    openhat.automation = {'pan': [{'at': {'musical': '10:1'}, 'value': 0.45},
                                  {'at': {'musical': '16:1'}, 'value': 0.1}]}
    metal.mix = {'gainDb': -8, 'pan': -0.2}
    metal.effects = [{'type': 'highpass', 'frequencyHz': 350},
                     {'type': 'reverb', 'roomSize': 0.5, 'decaySeconds': 1.4, 'wet': 0.25}]
    boom.mix = {'gainDb': -6}
    halo.mix = {'gainDb': -16}
    halo.effects = [{'type': 'highpass', 'frequencyHz': 450},
                    {'type': 'reverb', 'roomSize': 0.85, 'decaySeconds': 2.8, 'wet': 0.45}]
    halo.automation = {'gainDb': [
        {'at': {'musical': '1:1'}, 'value': -15},
        {'at': {'musical': '7:1'}, 'value': -16, 'transition': 'linear'},
        {'at': {'musical': '9:1'}, 'value': -7},
        {'at': {'musical': '9:1+1/16'}, 'value': -60},
        {'at': {'musical': '10:1'}, 'value': -9},
    ]}

    master = {'gainDb': 0, 'effects': [
        {'type': 'compressor', 'thresholdDb': -16, 'ratio': 2, 'attackMs': 12, 'releaseMs': 140, 'makeupGainDb': 1}]}
    return T, master


def overlap_report(T):
    problems = []
    for tr in T.values():
        if not tr.mono:
            continue
        seq = sorted((t, end) for t, _, end in tr.notes)
        for (t0, e0), (t1, _) in zip(seq, seq[1:]):
            if e0 is not None and e0 > t1 * SEC_PER_TICK + 1e-6:
                problems.append(f'{tr.id}: note at {fmt_pos(t0)} rings {e0 - t1 * SEC_PER_TICK:.3f}s into {fmt_pos(t1)}')
    return problems


SECTIONS = [('signal', 1, 2), ('shuffle', 3, 6), ('torque', 7, 8), ('stall', 9, 9),
            ('swap', 10, 13), ('converge', 14, 15), ('exit', 16, 16)]


def to_project(T, master, title):
    tracks = []
    for tr in T.values():
        patterns, clips = [], []
        for name, b0, b1 in SECTIONS:
            lo, hi = (b0 - 1) * BAR, b1 * BAR
            notes = []
            for t, n, _ in sorted(tr.notes, key=lambda x: (x[0], json.dumps(x[1], sort_keys=True))):
                if lo <= t < hi:
                    notes.append({'start': fmt_pos(t - lo), **n})
            if notes:
                patterns.append({'id': name, 'bars': b1 - b0 + 1, 'notes': notes})
                clips.append({'bar': b0, 'pattern': name})
        out = {'id': tr.id, 'description': tr.desc, 'instrument': tr.instrument,
               'clips': clips, 'patterns': patterns}
        if tr.mix:
            out['mix'] = tr.mix
        if tr.effects:
            out['effects'] = tr.effects
        if tr.automation:
            out['automation'] = tr.automation
        tracks.append(out)
    return {
        'formatVersion': 1,
        'title': title,
        'description': 'Round 2 benchmark record. UK-garage skip, electro call-and-response, industrial steel, '
                       'futuristic vowel bass and cinematic tension from one "talking steel" sound family.',
        'bpm': BPM, 'timeSignature': '4/4', 'key': 'G minor', 'bars': BARS, 'seed': 12,
        'render': {'duration': {'bars': BARS}, 'tail': 'auto'},
        'master': master,
        'tracks': tracks,
    }


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'project.json')
    T, master = build()
    probs = overlap_report(T)
    for p in probs:
        print('OVERLAP', p)
    proj = to_project(T, master, 'SWING ARM')
    with open(out, 'w') as f:
        json.dump(proj, f, indent=1)
        f.write('\n')
    print(f'wrote {out}: {sum(len(t.notes) for t in T.values())} events, {len(T)} tracks, overlaps={len(probs)}')


if __name__ == '__main__':
    main()
