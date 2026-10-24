"""MORPH//09 V2 — every moving part, light and the camera as a pure function of time.

Standard library only. The authoritative inputs are read through V1's unchanged
`../morph-09/state.py`: the OVERTONE event map (sample-exact envelopes, modulo-eight ages so
previous-cycle tails are alive at the opening) and the Hermite-interpolated MORPH//07 rotor
telemetry. Nothing here retimes music or alters the telemetry.

Time conventions: picture frame f shows the exposure that *closes* at f / 60 s (Blender shutter
position END, 180 degrees), so no event can reach the screen before its sample.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
V1_DIR = HERE.parent / 'morph-09'
sys.path.insert(0, str(V1_DIR))
import state as v1  # noqa: E402  (V1 module, imported read-only)

TAU = math.tau
SR = v1.SR
FPS = 60
FRAMES = 480
PERIOD = 8.0
SHUTTER = 0.5                       # fraction of a frame; exposure [f - 0.5, f] in frames
SUBFRAMES = (-0.5, -0.25, 0.0)      # transform keys: shutter open, centre, close

# ---------------------------------------------------------------- authoritative landmarks
def _event(track, eid=None):
    rows = v1.TRACKS[track]
    row = rows[0] if eid is None else next(e for e in rows if e['eventId'] == eid)
    return row['sampleFrame'] / SR


FUSION = _event('regime', next(e['eventId'] for e in v1.TRACKS['regime'] if e['eventId'].startswith('fusion')))
SEPARATION = _event('regime', next(e['eventId'] for e in v1.TRACKS['regime'] if e['eventId'].startswith('separation')))
LOCK = _event('voice')                       # A1, 55 Hz harmonic lock
BRAKE = _event('drive', 'brake')
DRAG = _event('drive', 'drag')
RELEASE = _event('drive', 'release')
RETURN = _event('form', 'return')
TRAVEL = 27                                  # whole revolutions per loop (source: 27.000035)

# ---------------------------------------------------------------- instrument layout
BRUSH_AZ = -90.0                             # degrees; the fixed brush faces the opening camera
FORK_AZ = [-54.0, 18.0, 90.0, 162.0, 234.0]  # tine 0..4, a pentagonal crown around the rotor
FORK_R = 4.75
AM7 = v1.TRACKS['harmony'][0]['source']['tineHz']          # [110, 165, 220, 264, 385]
FORK_LEN = [5.40 * math.sqrt(AM7[0] / hz) for hz in AM7]    # longer tines ring lower
GAP_CLAP = -18.0
GAP_CALIPERS = (54.0, 198.0)
GAP_REED = 126.0
CONTACTS = 16
DRUM_R = 2.06


def rotor_angle(t: float) -> float:
    """Unwrapped rotor angle in revolutions; t may reach one frame before the cycle start."""
    if t < 0.0:
        return v1.rotor(t + PERIOD)[0] - TRAVEL
    return v1.rotor(min(t, PERIOD))[0]


def rotor_speed(t: float) -> float:
    return v1.rotor(t % PERIOD)[1]


def env(track, t, decay, select=None):
    return v1.response(track, t % PERIOD, decay, select or (lambda e: True))


def smooth(x):
    return v1.smooth(x)


def strobe_frame(f: int) -> bool:
    """The lock strobe is closed for frames whose exposure ends inside [LOCK, BRAKE)."""
    t = f / FPS
    return LOCK <= t < BRAKE


def governor(speed: float) -> float:
    """Spring governor wound to read pitch: equal extension per octave from 3 to 55 rev/s."""
    if speed <= 3.0:
        return 0.0
    return min(1.0, math.log(speed / 3.0) / math.log(55.0 / 3.0))


def _hat_rows():
    return sorted(v1.TRACKS['hat'], key=lambda e: e['sampleFrame'])


def pallet(t: float) -> float:
    """Escapement anchor: each hat tips it to the other side (tick-tock) and it stays there.

    Returns -1..1. The hat count per loop is even, so the anchor closes the loop on its own side.
    """
    t %= PERIOD
    rows = _hat_rows()
    assert len(rows) % 2 == 0
    k = sum(1 for e in rows if e['sampleFrame'] / SR <= t)
    side = 1.0 if k % 2 == 0 else -1.0
    last = rows[k - 1]['sampleFrame'] / SR if k else rows[-1]['sampleFrame'] / SR - PERIOD
    age = t - last
    move = smooth(age / 0.022)
    settle = 0.16 * math.exp(-age / 0.035) * math.sin(TAU * 24 * age) if age > 0.022 else 0.0
    return -side + 2.0 * side * move + side * settle


def rider_ratio(t: float):
    """Tuning rider positions follow the authoritative harmony glide (V1 gear_at)."""
    hz = v1.gear_at(t % PERIOD)
    return [AM7[i] / max(1.0, hz[i]) for i in range(5)]


def lock_level(t: float) -> float:
    """Sympathetic drive of all five forks: from the A1 lock until the brake opens it."""
    t %= PERIOD
    if t < LOCK:                      # the previous cycle's ring-down crosses the seam
        return math.exp(-(t + PERIOD - BRAKE) / 0.22)
    on = smooth((t - LOCK) / 0.02)
    off = math.exp(-(t - BRAKE) / 0.22) if t >= BRAKE else 1.0
    return on * off


def brake_clamp(t: float) -> float:
    t %= PERIOD
    load = v1.COL['load'][min(FRAMES - 1, int(t * FPS))] / 1.3
    braking = 1.0 if BRAKE <= t < RETURN else 0.0
    return max(load, braking)


def brake_heat(t: float) -> float:
    """Friction heat in the pads after each clamp, decaying across the loop seam."""
    t %= PERIOD
    out = 0.0
    for start, end, gain in ((DRAG, RELEASE, 0.25), (BRAKE, RETURN, 1.0)):
        for shift in (0.0, -PERIOD):
            a = t - (start + shift)
            if a < 0:
                continue
            rise = min(a, end - start) / (end - start)
            after = max(0.0, a - (end - start))
            out += gain * rise * math.exp(-after / 0.55)
    return out


def machine(t: float) -> dict:
    """All non-camera state at time t (seconds, any real value; periodic with 8 s)."""
    tm = t % PERIOD
    speed = rotor_speed(tm)
    lock = lock_level(tm)
    fused = 1.0 if FUSION <= tm < SEPARATION else 0.0
    tines = [env('tines', tm, 0.30, lambda e, i=i: e['source'].get('tine') == i) for i in range(5)]
    coil = [env('tines', tm, 0.055, lambda e, i=i: e['source'].get('tine') == i) for i in range(5)]
    ring = [min(1.35, tines[i] + 0.9 * lock) for i in range(5)]
    return dict(
        t=tm, angle=rotor_angle(t), speed=speed,
        kick=env('kick', tm, 0.11), clap=min(1.0, env('clap', tm, 0.065)),
        bass=env('bass', tm, 0.24), vox=env('vox', tm, 0.31),
        vox_note=v1.state(tm)['vox_note'],
        brush=env('commutator', tm, 0.045), fused=fused,
        arc=min(1.6, env('commutator', tm, 0.045) * 1.6 + 1.1 * fused),
        pallet=pallet(tm), riders=rider_ratio(tm),
        governor=governor(speed), lock=lock, strobe=1.0 if LOCK <= tm < BRAKE else 0.0,
        ring=ring, coil=[min(1.5, coil[i] + 0.8 * lock) for i in range(5)],
        clamp=brake_clamp(tm), heat=brake_heat(tm),
    )


# ---------------------------------------------------------------- camera
# One unbroken take. The camera never rides the rotor: it circles the instrument exactly once
# per loop (counter-clockwise, the rotor's direction) while the rotor turns 27 times.
# Columns: time, azimuth (deg, unwrapped), radius, height, look-at x, y, z, lens (mm), f-stop.
CAMERA_KEYS = [
    (0.00, -122.0, 3.70, 1.55, -0.17, -2.06, 1.10, 50.0, 2.50),   # contact macro; fork 1 behind
    (0.80, -114.0, 3.62, 1.80, -0.05, -2.00, 1.14, 50.0, 2.50),   # drifting with the contacts
    (1.60, -100.0, 3.90, 3.00, 0.30, -1.60, 1.35, 44.0, 2.80),    # rising over the brush
    (2.40, -74.0, 4.90, 3.70, 0.30, -0.80, 1.60, 38.0, 3.00),
    (3.20, -45.0, 7.40, 4.70, 0.10, -0.10, 1.90, 32.0, 3.20),
    (4.00, -8.0, 13.20, 7.00, 0.00, 0.30, 1.80, 28.0, 4.00),      # the whole resonator
    (5.00, 34.0, 11.60, 3.40, -0.10, 0.30, 1.90, 36.0, 3.60),     # heavier: lower, longer lens
    (5.80, 66.0, 8.40, 1.60, -0.20, 0.20, 2.00, 44.0, 3.00),
    (6.20, 100.0, 7.60, 5.20, 0.00, 0.00, 2.20, 32.0, 3.40),      # spin-up: the crane climbs
    (6.50, 150.0, 6.50, 9.50, 0.00, 0.00, 2.20, 24.0, 4.00),      # A1 lock: the strobe fires
    (6.76, 192.0, 6.00, 9.20, 0.00, 0.00, 2.10, 24.0, 4.00),      # orbiting the frozen instant
    (7.00, 208.0, 3.80, 5.60, -1.70, -0.95, 0.80, 30.0, 3.40),    # brake: dive onto the hot caliper
    (7.50, 228.0, 3.75, 2.20, -0.15, -1.95, 1.16, 46.0, 2.70),
]
SPIN = 360.0 / PERIOD   # mean azimuth rate, removed before interpolation and restored after


def _pchip_slopes(ts, ys, period):
    """Periodic Fritsch-Carlson slopes: C1, no overshoot between keys."""
    n = len(ts)
    h = [((ts[(i + 1) % n] - ts[i]) % period) or period for i in range(n)]
    d = [(ys[(i + 1) % n] - ys[i]) / h[i] for i in range(n)]
    m = []
    for i in range(n):
        dl, dr = d[i - 1], d[i]
        hl, hr = h[i - 1], h[i]
        if dl * dr <= 0:
            m.append(0.0)
        else:
            w1, w2 = 2 * hr + hl, hr + 2 * hl
            m.append((w1 + w2) / (w1 / dl + w2 / dr))
    return h, m


class PeriodicCurve:
    def __init__(self, ts, ys, period=PERIOD):
        self.ts, self.ys, self.period = list(ts), list(ys), period
        self.h, self.m = _pchip_slopes(self.ts, self.ys, period)

    def _segment(self, t):
        t = t % self.period
        n = len(self.ts)
        for i in range(n - 1, -1, -1):
            if t >= self.ts[i]:
                return i, t - self.ts[i]
        return n - 1, t + self.period - self.ts[-1]

    def __call__(self, t, derivative=False):
        i, x = self._segment(t)
        n = len(self.ts)
        h, y0, y1 = self.h[i], self.ys[i], self.ys[(i + 1) % n]
        m0, m1 = self.m[i], self.m[(i + 1) % n]
        s = x / h
        if derivative:
            return ((6 * s * s - 6 * s) * y0 + (3 * s * s - 4 * s + 1) * h * m0
                    + (-6 * s * s + 6 * s) * y1 + (3 * s * s - 2 * s) * h * m1) / h
        return ((2 * s ** 3 - 3 * s * s + 1) * y0 + (s ** 3 - 2 * s * s + s) * h * m0
                + (-2 * s ** 3 + 3 * s * s) * y1 + (s ** 3 - s * s) * h * m1)


_cols = list(zip(*CAMERA_KEYS))
_T = _cols[0]
_AZ = PeriodicCurve(_T, [a - SPIN * t for t, a in zip(_T, _cols[1])])
_CH = {name: PeriodicCurve(_T, col) for name, col in zip(
    ['radius', 'height', 'tx', 'ty', 'tz', 'lens', 'fstop'], _cols[2:])}


def camera(t: float) -> dict:
    """Camera position, look-at target, lens, focus and f-stop. Exactly periodic, C1."""
    az = math.radians(_AZ(t) + SPIN * t)
    r, z = _CH['radius'](t), _CH['height'](t)
    pos = (r * math.cos(az), r * math.sin(az), z)
    target = (_CH['tx'](t), _CH['ty'](t), _CH['tz'](t))
    fwd = [target[i] - pos[i] for i in range(3)]
    dist = math.sqrt(sum(c * c for c in fwd))
    return dict(position=pos, target=target, lens=_CH['lens'](t), focus=dist,
                fstop=_CH['fstop'](t), azimuth=math.degrees(az))


def camera_velocity(t: float) -> dict:
    """Analytic time derivatives, used by verify.py to check the seam."""
    azd = _AZ(t) + SPIN * t
    a = math.radians(azd)
    dadt = math.radians(_AZ(t, True) + SPIN)
    r, dr = _CH['radius'](t), _CH['radius'](t, True)
    return dict(
        position=(dr * math.cos(a) - r * math.sin(a) * dadt, dr * math.sin(a) + r * math.cos(a) * dadt,
                  _CH['height'](t, True)),
        target=tuple(_CH[k](t, True) for k in ('tx', 'ty', 'tz')),
        lens=_CH['lens'](t, True), fstop=_CH['fstop'](t, True))


def look_basis(pos, target, roll=0.0):
    """Right, up, forward unit vectors for a camera at pos looking at target (world +Z up)."""
    f = [target[i] - pos[i] for i in range(3)]
    n = math.sqrt(sum(c * c for c in f))
    f = [c / n for c in f]
    up = (0.0, 0.0, 1.0)
    r = [f[1] * up[2] - f[2] * up[1], f[2] * up[0] - f[0] * up[2], f[0] * up[1] - f[1] * up[0]]
    n = math.sqrt(sum(c * c for c in r))
    r = [c / n for c in r]
    u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]]
    if roll:
        c, s = math.cos(roll), math.sin(roll)
        r, u = [c * r[i] + s * u[i] for i in range(3)], [-s * r[i] + c * u[i] for i in range(3)]
    return r, u, f


if __name__ == '__main__':
    import json
    print(json.dumps({'fusion': FUSION, 'lock': LOCK, 'brake': BRAKE, 'return': RETURN,
                      'separation': SEPARATION, 'forkLengths': FORK_LEN,
                      'strobeFrames': [f for f in range(FRAMES) if strobe_frame(f)]}, indent=1))
