"""MORPH//09 V3 — CRITICAL OVERLOAD: three effects as deterministic functions of V2's state.

Standard library only. Every effect is driven by V2's choreography (imported unchanged from
../morph-09-v2), which reads the authoritative OVERTONE event map and MORPH//07 telemetry
through V1's state.py. Random choices use fixed seeds per picture or per particle, so a
re-run produces identical geometry, trajectories and light.

1. Electrical overload, 6.2 s to the A1 lock. As the rotor accelerates past ~2 rev/s,
   commutation cannot keep up: plasma flashes over from the brush's trailing edge onto the
   riser tabs (the bar terminals) that have just left it. Arc count, reach downstream and
   brightness grow with log(rotor speed); every arc ends on a riser cheek at that picture's
   real rotor angle. Arcs stop at the lock: no activity inside the strobe stillness.
2. Brake friction, from the brake event. Incandescent particles leave the trailing edge of
   each caliper, thrown along the disc's motion with speed set by the disc's surface speed,
   under drag and gravity, bouncing once off the deck, cooling along a blackbody ramp.
3. Thermal vapor. One plume rises over the visible caliper after engagement. Its envelope is
   a function of the time since the brake modulo eight seconds and reaches exactly zero
   before the loop point, so nothing disappears at 479 → 0.
"""
from __future__ import annotations

import math
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'morph-09-v2'))
import choreography as ch  # noqa: E402  (V2, imported read-only)

TAU = math.tau
SEED_ARC, SEED_SPARK = 909_101, 770_301

# ---------------------------------------------------------------- shared geometry (V2 scene)
BRUSH_TRAIL_DEG = 4.3            # brush half-width in azimuth at the drum surface
BRUSH_TOP = 1.18                 # top of the graphite block
RISER_R = (1.98, 2.24)           # riser cheeks, radial extent
RISER_TOP = 1.51                 # top of the riser cheeks
CHEEK_DEG = (1.1, 3.8)           # cheek angular span either side of a riser centre
PITCH = 360.0 / ch.CONTACTS
CALIPER_PAD_HALF_DEG = 4.3       # pad half-width in azimuth at the rim
DISC_TOP = 0.46
VISIBLE_CALIPER = ch.GAP_CALIPERS[1]   # 198 degrees: the one the camera dives onto


def smoothstep(a, b, x):
    x = min(1.0, max(0.0, (x - a) / (b - a)))
    return x * x * (3 - 2 * x)


def polar(r, az_deg, z):
    a = math.radians(az_deg)
    return (r * math.cos(a), r * math.sin(a), z)


def overload(speed: float) -> float:
    """0 below 2 rev/s, 1 at 55 rev/s (A1), logarithmic in between."""
    if speed <= 2.0:
        return 0.0
    return min(1.0, math.log(speed / 2.0) / math.log(55.0 / 2.0))


# ---------------------------------------------------------------- 1. electrical overload
def _sub(a, b): return tuple(x - y for x, y in zip(a, b))
def _add(a, b): return tuple(x + y for x, y in zip(a, b))
def _mul(a, k): return tuple(x * k for x in a)
def _len(a): return math.sqrt(sum(x * x for x in a))


def _perp_jitter(rng, d, sigma):
    """Random offset perpendicular to direction d with standard deviation sigma."""
    while True:
        v = (rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))
        n = _len(d) or 1.0
        u = _mul(d, 1.0 / n)
        dot = sum(x * y for x, y in zip(v, u))
        p = _sub(v, _mul(u, dot))
        if _len(p) > 1e-6:
            return _mul(p, sigma)


def _midpoint_path(rng, pts, levels, rough):
    """Recursive midpoint displacement: the irregular, self-similar line of a plasma channel."""
    for lvl in range(levels):
        out = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            d = _sub(b, a)
            m = _add(_mul(_add(a, b), 0.5), _perp_jitter(rng, d, rough * _len(d) * (0.62 ** lvl)))
            out += [m, b]
        pts = out
    return pts


def _keep_outside_copper(p):
    """Plasma runs in air: keep points off the drum face, the riser cheeks and the brush."""
    x, y, z = p
    r = math.hypot(x, y)
    a = math.atan2(y, x)
    if RISER_TOP - 0.15 < z < RISER_TOP + 0.01 and r < RISER_R[1] + 0.02:
        r = RISER_R[1] + 0.02
    if z <= RISER_TOP - 0.15 and r < ch.DRUM_R + 0.015:
        r = ch.DRUM_R + 0.015
    return (r * math.cos(a), r * math.sin(a), z)


def _bezier(p0, p1, p2, n):
    out = []
    for i in range(n):
        s = i / (n - 1)
        out.append(tuple((1 - s) ** 2 * a + 2 * (1 - s) * s * b + s * s * c for a, b, c in zip(p0, p1, p2)))
    return out


def arc_events():
    """All arcs of one loop: birth picture, intensity, main path and branches (world space).

    Two kinds, both ending on a riser cheek at the picture's real rotor angle:
    bridge arcs leap outward from the brush's trailing top edge across the air gap to a passing
    riser; creep arcs (higher overload only) crawl downstream along the risers' outer faces.
    """
    arcs = []
    for f in range(ch.FRAMES):
        t = f / ch.FPS
        if not (6.0 <= t < ch.LOCK) or ch.strobe_frame(f):
            continue
        g = overload(ch.rotor_speed(t))
        if g <= 0:
            continue
        rng = random.Random(SEED_ARC + f)
        expected = 0.45 + 2.6 * g ** 1.25
        count = int(expected) + (1 if rng.random() < expected - int(expected) else 0)
        angle = ch.rotor_angle(t)
        trail = ch.BRUSH_AZ + BRUSH_TRAIL_DEG
        reach = 12.0 + 50.0 * g
        risers = sorted(((ch.BRUSH_AZ - k * PITCH + 360.0 * angle - trail) % 360.0, k) for k in range(ch.CONTACTS))
        for n in range(count):
            near = [rk for rk in risers if 1.5 <= rk[0] <= reach] or [next(rk for rk in risers if rk[0] >= 1.5)]
            delta, riser = near[min(len(near) - 1, int(rng.random() ** 1.5 * len(near)))]
            az_end = trail + delta + rng.choice((-1, 1)) * rng.uniform(*CHEEK_DEG)
            end = polar(RISER_R[1] + 0.006, az_end, rng.uniform(RISER_TOP - 0.06, RISER_TOP))
            creep = g > 0.45 and rng.random() < 0.3
            if creep:
                start = polar(RISER_R[1] + 0.02, trail + rng.uniform(-0.5, 0.5), rng.uniform(1.32, 1.44))
                mid = polar(RISER_R[1] + rng.uniform(0.05, 0.12), (trail + az_end) / 2, rng.uniform(1.45, 1.62))
                rough = 0.10
            else:
                # Hot plasma bows upward and outward between the brush and the riser it chases.
                start = polar(rng.uniform(2.12, 2.50), trail + rng.uniform(-0.8, 0.2), BRUSH_TOP + rng.uniform(0.0, 0.02))
                apex = 1.50 + (0.18 + 0.30 * g) * rng.uniform(0.7, 1.0)
                mid = polar(rng.uniform(2.30, 2.55), trail + (az_end - trail) * rng.uniform(0.35, 0.6), 2 * apex - 0.5 * (
                    BRUSH_TOP + end[2]))
                rough = 0.13
            main = _midpoint_path(rng, _bezier(start, mid, end, 5), 3, rough)
            main = _midpoint_path(rng, main, 1, 0.05)
            main = [main[0]] + [_keep_outside_copper(p) for p in main[1:-1]] + [main[-1]]
            branches = []
            for _ in range(rng.choice((0, 1, 1, 2))):
                i0 = int(rng.uniform(0.25, 0.75) * (len(main) - 1))
                base = main[i0]
                d = _sub(main[min(len(main) - 1, i0 + 2)], main[max(0, i0 - 2)])
                d = _mul(d, 1.0 / (_len(d) or 1))
                out = _mul((base[0], base[1], 0.0), 1.0 / (math.hypot(base[0], base[1]) or 1))
                dirv = _add(_add(_mul(d, 0.5), _mul(out, rng.uniform(0.4, 1.0))), (0, 0, rng.uniform(-0.3, 0.4)))
                L = rng.uniform(0.08, 0.22) * (0.6 + 0.6 * g)
                tip = _add(base, _mul(dirv, L / (_len(dirv) or 1)))
                br = _midpoint_path(rng, [base, tip], 3, 0.22)
                branches.append([br[0]] + [_keep_outside_copper(p) for p in br[1:]])
            lingering = rng.random() < 0.35 * g
            arcs.append({'frame': f, 'time': t, 'overload': g, 'kind': 'creep' if creep else 'bridge',
                         'intensity': rng.uniform(0.65, 1.0) * (0.55 + 0.45 * g),
                         'coreFrames': 2 if lingering else 1, 'riserIndex': riser, 'main': main, 'branches': branches})
    return arcs


def arc_level(arc, f):
    """(core, afterglow) brightness of one arc in picture f; nothing in strobe pictures."""
    if ch.strobe_frame(f) or f < arc['frame']:
        return 0.0, 0.0
    age = f - arc['frame']
    if age < arc['coreFrames']:
        return arc['intensity'] * (1.0 if age == 0 else 0.55), 0.0
    after = age - arc['coreFrames']
    if after < 3:
        return 0.0, arc['intensity'] * (0.55, 0.22, 0.07)[after]
    return 0.0, 0.0


# ---------------------------------------------------------------- 2. brake friction particles
GRAVITY = 30.0       # units / s^2 at this watch scale (tuned for plausible arcs, not SI)
DRAG = 3.2           # 1 / s
DT = 1.0 / 2400.0
SPARKS_PER_CALIPER = 11


def _friction_power(t):
    """Clamp force times sliding speed: where sparks are born."""
    return ch.brake_clamp(t) * ch.rotor_speed(t) ** 1.5


def blackbody(T):
    """Linear-sRGB colour of a glowing body, normalised to its red channel (T in kelvin)."""
    table = [(700, (1.0, 0.012, 0.0)), (1000, (1.0, 0.040, 0.0)), (1500, (1.0, 0.152, 0.0)),
             (2000, (1.0, 0.250, 0.006)), (2500, (1.0, 0.360, 0.065)), (3000, (1.0, 0.460, 0.150))]
    if T <= table[0][0]:
        return table[0][1]
    for (t0, c0), (t1, c1) in zip(table, table[1:]):
        if T <= t1:
            k = (T - t0) / (t1 - t0)
            return tuple(a + (b - a) * k for a, b in zip(c0, c1))
    return table[-1][1]


def spark_events():
    """Each particle: birth time, trajectory samples (t, x, y, z) and its cooling constants."""
    grid = [ch.BRAKE + i / 2000.0 for i in range(int(0.24 * 2000))]
    weights = [_friction_power(t) for t in grid]
    total = sum(weights)
    cdf, acc = [], 0.0
    for w in weights:
        acc += w / total
        cdf.append(acc)
    sparks = []
    for ci, caz in enumerate(ch.GAP_CALIPERS):
        for n in range(SPARKS_PER_CALIPER):
            rng = random.Random(SEED_SPARK + 100 * ci + n)
            u = rng.random()
            t0 = grid[next(i for i, c in enumerate(cdf) if c >= u)]
            speed = ch.rotor_speed(t0)
            r0 = rng.uniform(2.60, 2.79)
            az0 = caz + CALIPER_PAD_HALF_DEG + rng.uniform(0.0, 1.5)
            top = rng.random() < 0.75
            pos = list(polar(r0, az0, DISC_TOP + 0.015 if top else 0.29))
            a = math.radians(az0)
            tang = (-math.sin(a), math.cos(a), 0.0)
            radial = (math.cos(a), math.sin(a), 0.0)
            v0 = min(16.0, 0.012 * TAU * r0 * speed) * rng.uniform(0.7, 1.2)
            up = rng.uniform(0.25, 0.9) if top else -rng.uniform(0.1, 0.4)
            d = _add(_add(tang, _mul(radial, rng.uniform(0.15, 0.55))), (0, 0, up))
            vel = list(_mul(d, v0 / _len(d)))
            tau = rng.uniform(0.09, 0.20)
            life = min(0.42, tau * math.log(2300.0 / 760.0))
            samples, t, bounced = [], 0.0, False
            while t <= life + 1e-9:
                samples.append((t0 + t, *pos))
                for i in range(3):
                    acc = (-DRAG * vel[i]) + (-GRAVITY if i == 2 else 0.0)
                    vel[i] += acc * DT
                    pos[i] += vel[i] * DT
                if pos[2] < 0.012 and math.hypot(pos[0], pos[1]) < 6.7 and vel[2] < 0:
                    pos[2] = 0.012
                    vel = [vel[0] * 0.55, vel[1] * 0.55, -vel[2] * 0.32]
                    bounced = True
                t += DT
            sparks.append({'caliper': caz, 'birth': t0, 'tau': tau, 'life': life, 'samples': samples,
                           'bounced': bounced, 'initialSpeed': v0})
    return sparks


def spark_position(sp, t):
    """Trajectory position at time t, held at the birth and death points outside the life."""
    age = min(max(t - sp['birth'], 0.0), sp['life'])
    s = sp['samples']
    i = min(len(s) - 2, int(age / DT))
    k = min(1.0, max(0.0, (age - (s[i][0] - sp['birth'])) / DT))
    return tuple(a + (b - a) * k for a, b in zip(s[i][1:], s[i + 1][1:]))


def spark_state(sp, t):
    """Position, colour and brightness of one particle at time t (seconds in the loop)."""
    age = t - sp['birth']
    if age < 0 or age > sp['life']:
        return None
    pos = spark_position(sp, t)
    T = 2300.0 * math.exp(-age / sp['tau'])
    fade = smoothstep(760.0, 980.0, T)
    return pos, blackbody(T), (T / 2300.0) ** 4 * fade


# ---------------------------------------------------------------- 3. thermal vapor
VAPOR_BASE = polar(2.92, VISIBLE_CALIPER + 4.0, 0.80)   # over the hot pads, above the yoke
VAPOR_RISE = 3.4            # units / s


def vapor(t: float) -> dict:
    """Age since the brake (mod 8 s) and the plume's density envelope; zero before the seam."""
    age = (t - ch.BRAKE) % ch.PERIOD
    env = smoothstep(0.03, 0.20, age) * (1.0 - smoothstep(0.32, 1.10, age))
    return {'age': age, 'envelope': env, 'front': 0.15 + VAPOR_RISE * age}


def heat_glow(t: float) -> float:
    """Radiant light from the hot pads and rim, from V2's brake heat (unchanged)."""
    return ch.brake_heat(t) ** 2


if __name__ == '__main__':
    import json
    arcs, sparks = arc_events(), spark_events()
    print(json.dumps({
        'arcs': len(arcs), 'arcFrames': [arcs[0]['frame'], arcs[-1]['frame']] if arcs else None,
        'arcsPerFrame': {f: sum(1 for a in arcs if a['frame'] == f) for f in sorted({a['frame'] for a in arcs})},
        'sparks': len(sparks), 'sparkBirths': [round(min(s['birth'] for s in sparks), 4), round(max(s['birth'] for s in sparks), 4)],
        'sparkDeath': round(max(s['birth'] + s['life'] for s in sparks), 4),
        'vaporLastNonzeroFrame': max(f for f in range(480) if vapor(f / 60)['envelope'] > 0.0),
        'vaporFirstNonzeroFrame': min(f for f in range(480) if vapor(f / 60)['envelope'] > 0.0),
    }, indent=1))
