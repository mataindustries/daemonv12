#!/usr/bin/env python3
"""THE CIRCUIT V2 — the ring engine's deterministic choreography.

One standard-library module drives the Blender render (render.py) and the independent
checks (verify.py). It reads V1's authoritative event map without modifying it and never
reads or processes audio. Every visible response is a pure function of picture time.

The machine: V1's 48 silicon tiles (a 6 x 8 die) are re-seated as three nested closed
loops of exactly 24, 16 and 8 carriers. The loops advance slot by slot with the music:

- outer loop  = the cable's tick clock, 16ths then 32nds (clockwise); the ratchet winds it back,
- middle loop = the drums (counter-clockwise),
- inner loop  = the core, carried by the Beast (clockwise, lifting as it sings).

Hits write light into whichever carrier is passing a write gate, so each loop carries
the recent rhythm around as a rotating pattern (a delay-line memory).

Timing rule. Picture frame f covers audio samples [735 f, 735 (f + 1)). An event's visual
onset is the start of the frame that contains its sample (frame60 / 60 s). Frame f is
exposed over [(f + 0.5) / 60, (f + 1) / 60] (a 180-degree shutter ending with the frame's
audio interval) and its light state is evaluated at (f + 1) / 60. Every response is
therefore first visible in exactly the frame containing its sound, never earlier.
"""
from __future__ import annotations

import bisect
import hashlib
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
V1 = HERE.parent / 'morph-commercial-01'
MAPPING = V1 / 'mapping.json'
AUDIO = V1 / 'audio' / 'circuit-reference.wav'
MAPPING_SHA256 = '5e3f2d85dcc45e0ff7e458a85d85cd28c7af948bc4e2a9e11b57d477c71a8e8f'
AUDIO_SHA256 = '66551bbb73e103116be032e4cd082d66f7659f8dec24bc87d3c365d1d1f894cc'

FPS = 60
FRAMES = 480
CUT_FRAME = 456
SAMPLES_PER_FRAME = 735

# V1 die geometry (scene.py): tile pitch, die centre and tile top height.
PITCH_X, PITCH_Y = 0.46, 0.405
DIE_Y = 1.0
TILE_Z = 0.68

CYAN = (0.02, 0.62, 1.00)
WHITE = (0.80, 0.90, 1.00)
AMBER = (1.00, 0.30, 0.03)
COPPER = (1.00, 0.52, 0.24)

# Musical sections of the approved excerpt (seconds, 120 BPM: beat = 30 frames).
WIND_UP = (3.5, 4.0)     # cable SNAP to the Unison downbeat: the ratchet winds the clock back
OVERWIND = 7.0           # from here the ratchet winds the clock until the cut


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def onset(event: dict) -> float:
    """Frame-anchored visual onset in seconds (start of the containing picture frame)."""
    return event['frame60'] / FPS


def ease_back(u: float, c: float = 1.25) -> float:
    """Ratchet step: fast start, ~6 % mechanical overshoot, settles exactly at 1."""
    if u <= 0.0:
        return 0.0
    if u >= 1.0:
        return 1.0
    v = u - 1.0
    return 1.0 + (c + 1.0) * v ** 3 + c * v ** 2


def envelope(age: float, decay: float, attack: float = 0.008) -> float:
    if age <= 0.0:
        return 0.0
    return (1.0 - math.exp(-age / attack)) * math.exp(-age / decay)


def smoothstep(x: float) -> float:
    x = min(1.0, max(0.0, x))
    return x * x * (3.0 - 2.0 * x)


def lerp(a: float, b: float, u: float) -> float:
    return a + (b - a) * u


# ---------------------------------------------------------------------------
# Loop topology: 6 x 8 = 24 + 16 + 8, clockwise seen from above (+x right, +y up).

def ring_path(r: int) -> list[tuple[int, int]]:
    x0, x1, y0, y1 = r, 5 - r, r, 7 - r
    path = [(ix, y1) for ix in range(x0, x1 + 1)]
    path += [(x1, iy) for iy in range(y1 - 1, y0 - 1, -1)]
    path += [(ix, y0) for ix in range(x1 - 1, x0 - 1, -1)]
    path += [(x0, iy) for iy in range(y0 + 1, y1)]
    return path


RINGS = [ring_path(r) for r in range(3)]
assert [len(p) for p in RINGS] == [24, 16, 8]
assert len({c for p in RINGS for c in p}) == 48


def cell_xy(cell: tuple[int, int]) -> tuple[float, float]:
    ix, iy = cell
    return (ix - 2.5) * PITCH_X, DIE_Y + (iy - 3.5) * PITCH_Y


def slot_xy(r: int, s: float) -> tuple[float, float]:
    """World XY of continuous slot position s on loop r (linear between adjacent cells)."""
    path = RINGS[r]
    n = len(path)
    base = math.floor(s)
    frac = s - base
    ax, ay = cell_xy(path[base % n])
    bx, by = cell_xy(path[(base + 1) % n])
    return ax + (bx - ax) * frac, ay + (by - ay) * frac


# Write gates face the four pin banks (V1 route sides: 0 left, 1 right, 2 bottom, 3 top).
OUTER_GATES = [RINGS[0].index(c) for c in [(0, 4), (5, 3), (2, 0), (3, 7)]]
MIDDLE_GATES = [RINGS[1].index(c) for c in [(1, 4), (4, 3)]]
SIDE_ROUTES = [list(range(side * 14, side * 14 + 14)) for side in range(4)]
ALL_ROUTES = list(range(56))


# ---------------------------------------------------------------------------
# Score: authoritative events -> machine actions.

class Score:
    """All machine actions, derived once from the event map. Pure data after init."""

    def __init__(self, events: list[dict]):
        self.events = events
        self.steps = [[], [], []]          # per loop: (t, delta_slots, duration, overshoot, src)
        self.writes = []                   # (t, loop, gate_slot, rgb, strength, decay, src)
        self.flashes = []                  # (t, loops, rgb, strength, decay, src)
        self.pulses = []                   # (t, routes, direction, amplitude, travel, src)
        self.lifts = []                    # (t, duration, height, src)
        self.thumps = []                   # (t, strength, src)
        self.punches = []                  # (t, strength, src)
        self.bells = []                    # (t, strength, src)
        self.glitch_frame = None
        self.audit = {}
        self._build()
        for loop in self.steps:
            loop.sort(key=lambda s: s[0])
        self._step_times = [[s[0] for s in loop] for loop in self.steps]
        self._longest = [max((s[2] for s in loop), default=0.0) for loop in self.steps]
        self._prefix = []
        for loop in self.steps:
            total, prefix = 0.0, [0.0]
            for s in loop:
                total += s[1]
                prefix.append(total)
            self._prefix.append(prefix)

    def note(self, e: dict, role: str, reason: str) -> None:
        self.audit.setdefault(e['sourceIndex'], []).append({'role': role, 'reason': reason})

    def _build(self) -> None:
        tom_gate = 0
        wind_gate = 0
        pluck_pair = 0
        groove_frames = {}
        for e in self.events:
            part, name, v, t = e['part'], e['event'], e.get('velocity', 1.0), onset(e)
            raw = e['time']
            if part == 'all':
                self.note(e, 'cut', 'Exact black from this frame; render is never called for 456-479.')
                continue
            if part == 'section':
                self.note(e, 'metadata', 'Section marker; its music already drives the loops.')
                continue
            if part == 'perc' and name == 'cable tick':
                if WIND_UP[0] <= raw <= WIND_UP[1] or raw >= OVERWIND:
                    self.note(e, 'absorbed', 'The ratchet pawl holds the clock loop while it is wound.')
                    continue
                dur = 0.075 if raw < 5.0 else 0.05
                self.steps[0].append((t, 1.0, dur, 1.25, e['sourceIndex']))
                self.note(e, 'clock', 'Outer loop advances one slot clockwise.')
                continue
            if part == 'ratchet':
                if name != 'repeat':
                    self.note(e, 'metadata', 'Ratchet header; its repeats wind the loop.')
                elif raw < WIND_UP[1] or raw >= OVERWIND:
                    self.steps[0].append((t, -1.0, 0.045, 0.8, e['sourceIndex']))
                    self.note(e, 'wind', 'Ratchet winds the outer loop back one slot.')
                else:
                    self.note(e, 'absorbed', 'Tail of the wind-up, carried by the release on the downbeat.')
                continue
            if part == 'cable bass':
                if name == 'ghost':
                    self.note(e, 'absorbed', 'Ghost articulation; the major attacks carry the phrase.')
                    continue
                if name == 'slap':
                    self.pulses.append((t, ALL_ROUTES, 1, 0.75 * v, self.travel(raw), e['sourceIndex']))
                    for g in OUTER_GATES:
                        self.writes.append((t, 0, g, CYAN, 1.1 * v, self.memory(raw), e['sourceIndex']))
                    self.note(e, 'fire', 'Slap fires all 56 routes outward and writes all four outer gates.')
                    if abs(raw - WIND_UP[1]) < 1e-6:
                        self.steps[0].append((t, 6.0, 0.42, 1.6, e['sourceIndex']))
                        self.note(e, 'release', 'The wound clock loop springs forward the six slots it was wound.')
                else:
                    sides = [0, 1] if pluck_pair % 2 == 0 else [2, 3]
                    pluck_pair += 1
                    routes = [r for s in sides for r in SIDE_ROUTES[s]]
                    self.pulses.append((t, routes, 1, 0.45 * v, self.travel(raw), e['sourceIndex']))
                    self.writes.append((t, 0, OUTER_GATES[sides[pluck_pair % 2]], CYAN, 0.8 * v, self.memory(raw),
                                        e['sourceIndex']))
                    self.note(e, 'fire', 'Pluck fires two pin banks and writes one of their outer gates.')
                continue
            if part == 'cable':
                if name == 'SNAP (crack)':
                    self.pulses.append((t, ALL_ROUTES, 1, 1.1, 0.30, e['sourceIndex']))
                    self.flashes.append((t, (0, 1, 2), WHITE, 1.2, 0.10, e['sourceIndex']))
                    self.steps[0].append((t, 0.35, 0.06, 0.0, e['sourceIndex']))
                    self.steps[0].append((t + 0.06, -0.35, 0.05, 0.0, e['sourceIndex']))
                    self.note(e, 'snap', 'Crack: the clock loop jolts and catches; every route flashes outward.')
                elif name == 'slap (strike)':
                    self.pulses.append((t, ALL_ROUTES, 1, 0.75 * v, 0.24, e['sourceIndex']))
                    for g in OUTER_GATES:
                        self.writes.append((t, 0, g, CYAN, 1.1 * v, self.memory(raw), e['sourceIndex']))
                    self.note(e, 'fire', 'Overwind strike fires all routes and writes all outer gates.')
                elif name == 'wind strike':
                    side = wind_gate % 4
                    wind_gate += 1
                    self.pulses.append((t, SIDE_ROUTES[side], -1, 0.9 * v + 0.25, 0.26, e['sourceIndex']))
                    self.writes.append((t, 0, OUTER_GATES[side], CYAN, 1.6 * v + 0.3, self.memory(raw), e['sourceIndex']))
                    self.note(e, 'draw', 'Each wind strike draws one pin bank inward and charges its gate.')
                else:
                    self.note(e, 'metadata', 'State marker; the ratchet repeats and strikes carry it.')
                continue
            if part == 'cable partner':
                if name == 'crack':
                    self.pulses.append((t, SIDE_ROUTES[1], 1, 0.7 * v, self.travel(raw), e['sourceIndex']))
                    self.writes.append((t, 0, OUTER_GATES[1], WHITE, 0.9 * v, 0.5, e['sourceIndex']))
                    self.note(e, 'fire', 'The second cable cracks on the right pin bank.')
                else:
                    self.note(e, 'absorbed', 'Quiet partner pluck sounds with the main slap.')
                continue
            if part in ('kick', 'snare', 'toms'):
                if name == 'toaster spring':
                    self.note(e, 'absorbed', 'Spring layer belongs to the snare hit.')
                    continue
                if part == 'snare' and name == 'ghost snare' and v < 0.3:
                    self.note(e, 'absorbed', 'Quiet ghost below the roll threshold.')
                    continue
                big = name.startswith('BIG')
                frame = e['frame60']
                if frame in groove_frames and not big:
                    self.note(e, 'coalesced', 'Shares a picture frame with another drum hit: one loop step.')
                else:
                    if frame in groove_frames:
                        prior = groove_frames[frame]
                        self.steps[1] = [s for s in self.steps[1] if s is not prior]
                    step = (t, -2.0 if big else -1.0, 0.11 if big else 0.065, 1.5 if big else 1.25, e['sourceIndex'])
                    self.steps[1].append(step)
                    groove_frames[frame] = step
                    self.note(e, 'groove', 'Middle loop advances counter-clockwise.')
                if part == 'kick' and 'ghost' not in name:
                    self.thumps.append((t, v, e['sourceIndex']))
                    for g in MIDDLE_GATES:
                        self.writes.append((t, 1, g, WHITE, 0.55 * v, 0.22, e['sourceIndex']))
                    self.note(e, 'thump', 'Kick presses the whole package and writes the middle gates.')
                if part == 'snare' and name != 'ghost snare':
                    loops = (0, 1, 2) if big else (1,)
                    self.flashes.append((t, loops, WHITE, (1.6 if big else 0.8) * v, 0.16 if big else 0.12, e['sourceIndex']))
                    if big:
                        self.punches.append((t, 1.0, e['sourceIndex']))
                        self.thumps.append((t, 1.6, e['sourceIndex']))
                    self.note(e, 'ring', 'Snare rings the middle loop white.' if not big else 'BIG snare: every carrier flashes, the package slams.')
                if part == 'toms':
                    gate = (MIDDLE_GATES[0] + tom_gate) % 16
                    tom_gate += 1
                    self.writes.append((t, 1, gate, COPPER, 0.5 * v, 0.30, e['sourceIndex']))
                    self.note(e, 'walk', 'Tom writes copper at a gate that walks one slot per tom.')
                continue
            if part == 'beast':
                if name.startswith('glitch'):
                    self.glitch_frame = e['frame60']
                    self.note(e, 'glitch', 'Beat-repeat: the picture repeats a two-frame slice and crushes.')
                    continue
                syllable = name.lower()
                dur = max(0.09, e['duration'])
                slots, height = {
                    'ka': (1, 0.07), 'yoi': (1, 0.10), 'ya': (1, 0.09), 'ow': (2, 0.14),
                    'yow': (2, 0.14), 'wom': (4, 0.20), 'eeyoow': (4, 0.20)}[syllable]
                glide = max(dur, 0.12 * slots)
                self.steps[2].append((t, float(slots), glide, 0.9, e['sourceIndex']))
                self.lifts.append((t, dur, height, e['sourceIndex']))
                self.note(e, 'voice', f'Core lifts, glows amber and turns {slots} slot(s).')
                continue
            if part == 'perc' and name == 'alarm-bell hat':
                self.bells.append((t, v, e['sourceIndex']))
                self.note(e, 'bell', 'Corner fasteners strike white.')
                continue
            if part == 'perc' and name == 'press clank':
                self.thumps.append((t, 0.8, e['sourceIndex']))
                self.note(e, 'thump', 'Clank presses the package.')
                continue
            self.note(e, 'metadata', 'No separate visual response.')

    @staticmethod
    def travel(raw: float) -> float:
        """Outward surge travel time: the routes get faster as the overload builds."""
        return 0.42 if raw < 5.5 else (0.34 if raw < 6.5 else 0.27)

    @staticmethod
    def memory(raw: float) -> float:
        """Decay of light written into the clock loop: the memory lengthens with intensity."""
        return 0.42 + 0.9 * min(1.0, raw / 7.6)

    # ---- kinematics -------------------------------------------------------
    def phase(self, r: int, tau: float) -> float:
        times = self._step_times[r]
        n = bisect.bisect_right(times, tau)
        # Steps older than the loop's longest step have completed: add them exactly.
        lo = min(n, bisect.bisect_left(times, tau - self._longest[r]))
        total = self._prefix[r][lo]
        for t, delta, dur, c, _ in self.steps[r][lo:n]:
            total += delta * ease_back((tau - t) / dur, c)
        return total

    def lift(self, tau: float) -> float:
        height = 0.0
        for t, dur, h, _ in self.lifts:
            age = tau - t
            if age <= 0.0 or age > dur + 0.6:
                continue
            rise = 1.0 - math.exp(-age / 0.03)
            fall = 1.0 if age < dur else math.exp(-(age - dur) / 0.11)
            height = max(height, h * rise * fall)
        return height

    def thump(self, tau: float) -> float:
        z = 0.0
        for t, s, _ in self.thumps:
            age = tau - t
            if 0.0 < age < 0.6:
                z -= 0.018 * s * (1.0 - math.exp(-age / 0.012)) * math.exp(-age / 0.075)
        return z

    def punch(self, tau: float) -> float:
        return sum(s * envelope(tau - t, 0.13, 0.01) for t, s, _ in self.punches)

    # ---- light ------------------------------------------------------------
    def tile_lights(self, tau: float, core_tau: float | None = None,
                    core_gain: float = 1.0) -> list[list[tuple[float, float, float]]]:
        """Emission colour of every carrier, indexed [loop][carrier].

        The Beast's amber in the core follows `core_tau` (its beat-repeat clock).
        """
        out = [[[0.0, 0.0, 0.0] for _ in path] for path in RINGS]
        for t, r, gate, rgb, s, decay, _ in self.writes:
            age = tau - t
            if age <= 0.0 or age > 6 * decay:
                continue
            n = len(RINGS[r])
            carrier = (gate - round(self.phase(r, t))) % n
            k = s * envelope(age, decay)
            for i in range(3):
                out[r][carrier][i] += rgb[i] * k
        for t, loops, rgb, s, decay, _ in self.flashes:
            k = s * envelope(tau - t, decay)
            if k <= 1e-4:
                continue
            for r in loops:
                for c in out[r]:
                    for i in range(3):
                        c[i] += rgb[i] * k
        core = core_gain * self.lift(tau if core_tau is None else core_tau) / 0.2
        if core > 1e-4:
            for c in out[2]:
                for i in range(3):
                    c[i] += AMBER[i] * 1.7 * core
        return [[tuple(c) for c in loop] for loop in out]

    def rail_lights(self, tau: float) -> list[tuple[float, float, float]]:
        """Linear-motor rails flash when their loop is driven: outer, middle, inner."""
        colours = [CYAN, WHITE, AMBER]
        out = []
        for r in range(3):
            k = 0.0
            times = self._step_times[r]
            n = bisect.bisect_right(times, tau)
            for t, delta, dur, c, _ in self.steps[r][max(0, n - 48):n]:
                k += min(1.0, abs(delta)) * envelope(tau - t, 0.07, 0.004)
            k = 1.4 * (1.0 - math.exp(-k))
            out.append(tuple(colours[r][i] * k for i in range(3)))
        return out

    def core_glow(self, tau: float, gain: float = 1.0) -> tuple[float, float, float]:
        k = 2.5 * gain * self.lift(tau) / 0.2
        return tuple(AMBER[i] * k for i in range(3))

    def bell_light(self, tau: float) -> float:
        return sum(2.0 * s * envelope(tau - t, 0.09) for t, s, _ in self.bells)

    def route_pulses(self, tau: float, slots: int = 6) -> list[list[tuple[float, float]]]:
        """Per route: up to `slots` (position along route 0..1, signed amplitude) pairs.

        Positive amplitude travels outward from the processor pad, negative inward.
        """
        per = [[] for _ in range(56)]
        for t, routes, direction, amp, travel, _ in self.pulses:
            age = tau - t
            if age <= 0.0 or age > travel * 1.6:
                continue
            u = age / travel
            pos = u if direction > 0 else 1.0 - u
            k = amp * (1.0 - math.exp(-age / 0.01)) * (1.0 if u < 1.0 else math.exp(-(u - 1.0) / 0.15))
            for r in routes:
                per[r].append((t, pos, direction * k))
        result = []
        for lst in per:
            lst.sort(key=lambda p: p[0], reverse=True)
            result.append([(p, a) for _, p, a in lst[:slots]])
        return result

    # ---- audit ------------------------------------------------------------
    def response(self, src: int, frame: int) -> float:
        """Size of one source event's own visual contribution in picture frame `frame`.

        Kinematics are read at the shutter close, light at the frame's light time, the same
        instants render.py uses. Zero means the event has no visible effect in that frame.
        """
        _, close, light = frame_times(frame)
        total = 0.0
        for loop in self.steps:
            for t, delta, dur, c, s in loop:
                if s == src:
                    total += abs(delta * ease_back((close - t) / dur, c))
        for t, _, _, _, k, decay, s in self.writes:
            if s == src:
                total += k * envelope(light - t, decay)
        for t, _, _, k, decay, s in self.flashes:
            if s == src:
                total += k * envelope(light - t, decay)
        for t, _, _, amp, _, s in self.pulses:
            if s == src and light > t:
                total += amp * (1.0 - math.exp(-(light - t) / 0.01))
        for t, _, h, s in self.lifts:
            if s == src and close > t:
                total += h * (1.0 - math.exp(-(close - t) / 0.03))
        for t, k, s in self.thumps + self.punches + self.bells:
            if s == src:
                total += k * envelope(light - t, 0.075)
        return total


# ---------------------------------------------------------------------------
# Camera: four shots cut on section boundaries, each with continuous motion.

SHOTS = [(0, 'A machine'), (210, 'B wind-up'), (240, 'C dial'), (360, 'D overload')]


def frame_of(tau: float) -> int:
    return max(0, math.ceil(tau * FPS - 1e-9) - 1)


def shot_of(frame: int) -> str:
    name = SHOTS[0][1]
    for first, label in SHOTS:
        if frame >= first:
            name = label
    return name


def camera(score: Score, tau: float) -> dict:
    """Spherical rig: target, azimuth (0 = from -y), elevation, distance, roll, lens."""
    f = frame_of(tau)
    shot = shot_of(f)
    if shot.startswith('A'):
        u = tau / 3.5
        target = (0.0, 1.0 + 0.10 * u, 0.55)
        az, el, dist, lens, fstop, roll = 34 - 28 * u, 50 - 4 * u, 9.2 - 2.0 * u, 38, 4.5, 0.0
    elif shot.startswith('B'):
        u = (tau - 3.5) / 0.5
        target = (-0.35 + 0.10 * u, -0.4175, 0.74)
        az, el, dist, lens, fstop, roll = -90 + 4 * u, 13 + 2 * u, 2.2 - 0.3 * u, 50, 2.4, 0.0
    elif shot.startswith('C'):
        u = (tau - 4.0) / 2.0
        late = max(0.0, tau - 5.5) / 0.5
        target = (0.0, 1.0, 0.70)
        az = -36 * u - 10 * late * late
        el, dist, lens, fstop, roll = 88.0, 7.6 - 1.0 * u, 36, 6.0, 0.0
    else:
        s = tau - 6.0
        target = (0.0, 1.0, 0.62)
        if s < 1.0:
            az, el, dist = 148 + 50 * s, 27 + 7 * s, 4.9 - 0.9 * s
            lens, roll = 28.0, 0.0
        else:
            w = s - 1.0
            az = 198 + 50 * w + 60 * w * w  # the loops' spin, not the camera, is the climax
            el = 34 + 38 * smoothstep(w / 0.6)
            dist = 4.0 - 1.5 * smoothstep(w / 0.6)
            lens, roll = 28.0 - 4.0 * (w / 0.6), 14.0 * (w / 0.6) ** 2
        fstop = 3.5
    dist *= 1.0 - 0.07 * score.punch(tau)
    a, e, q = math.radians(az), math.radians(el), math.radians(roll)
    radial = (math.cos(e) * math.sin(a), -math.cos(e) * math.cos(a), math.sin(e))
    pos = tuple(target[i] + dist * radial[i] for i in range(3))
    forward = tuple(-x for x in radial)
    up = (-math.sin(e) * math.sin(a), math.sin(e) * math.cos(a), math.cos(e))
    right = (forward[1] * up[2] - forward[2] * up[1],
             forward[2] * up[0] - forward[0] * up[2],
             forward[0] * up[1] - forward[1] * up[0])
    if q:
        c, s_ = math.cos(q), math.sin(q)
        right, up = (tuple(c * right[i] + s_ * up[i] for i in range(3)),
                     tuple(-s_ * right[i] + c * up[i] for i in range(3)))
    return {'shot': shot, 'position': pos, 'right': right, 'up': up, 'forward': forward,
            'lens': lens, 'fstop': fstop, 'focus': dist, 'target': target}


# ---------------------------------------------------------------------------
# Frame-level helpers shared by render.py and verify.py.

def core_frame(score: Score, frame: int) -> int:
    """The Beast's beat-repeat: from the glitch frame the core replays a two-frame slice.

    Only the core (inner loop, its lift and amber light) repeats; the clock loop, the drums,
    the routes and the camera keep running to the cut, as they do in the mix.
    """
    g = score.glitch_frame
    if g is None or frame < g:
        return frame
    return g + (frame - g) % 2


def core_gain(score: Score, frame: int) -> float:
    """The crush: the core's light jumps between two coarse levels while it repeats."""
    g = score.glitch_frame
    if g is None or frame < g:
        return 1.0
    return 1.45 if (frame - g) % 2 == 0 else 0.55


def frame_times(frame: int) -> tuple[float, float, float]:
    """(shutter open, shutter close, light time) in seconds for picture frame `frame`."""
    return (frame + 0.5) / FPS, (frame + 1.0) / FPS, (frame + 1.0) / FPS


def load_events(check_hashes: bool = True) -> list[dict]:
    if check_hashes:
        assert sha256(MAPPING) == MAPPING_SHA256, 'V1 event map changed'
        assert sha256(AUDIO) == AUDIO_SHA256, 'V1 PCM reference changed'
    data = json.loads(MAPPING.read_text())
    events = data['events']
    for e in events:
        assert e['frame60'] == e['sampleFrame'] // SAMPLES_PER_FRAME
    return events


def load_score(check_hashes: bool = True) -> Score:
    return Score(load_events(check_hashes))


if __name__ == '__main__':
    sc = load_score()
    roles = {}
    for rows in sc.audit.values():
        for row in rows:
            roles[row['role']] = roles.get(row['role'], 0) + 1
    print(json.dumps({'loopSteps': [len(s) for s in sc.steps], 'writes': len(sc.writes),
                      'pulses': len(sc.pulses), 'lifts': len(sc.lifts), 'glitchFrame': sc.glitch_frame,
                      'roles': roles}, indent=1))
    for f in [0, 30, 120, 209, 210, 239, 240, 300, 359, 360, 420, 450, 455]:
        tau = (f + 1) / FPS
        print(f, sc.camera if False else shot_of(f), [round(sc.phase(r, tau), 2) for r in range(3)],
              round(sc.lift(tau), 3), round(sc.thump(tau), 4))
