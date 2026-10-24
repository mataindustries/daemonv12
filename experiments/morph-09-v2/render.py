"""MORPH//09 V2 — bake the choreography into keyframes, then render with CPU Cycles.

    /opt/bpyenv/bin/python experiments/morph-09-v2/render.py --frames 0-479 --width 432 --samples 16
    blender -b work/morph-09-v2/resonator.blend -P experiments/morph-09-v2/render.py -- --frames 0-479

Picture frame f is Blender frame f + 1. Its 180-degree exposure closes at f / 60 s (shutter
position END), so transforms are keyed at the shutter's open, centre and close: f - 0.5,
f - 0.25 and f. Lights and emitters hold the state at the closing instant, keyed once per frame
at the shutter centre, where Cycles reads non-motion data. Inside the
harmonic-lock strobe window every key of a frame takes the flash instant: the machine and the
camera are frozen sharp, exactly as a contact-fired xenon strobe would expose them.
No Python runs while Cycles renders; --save writes the animated scene.
"""
import argparse
import json
import math
import sys
import time
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import choreography as ch  # noqa: E402

WORK = ROOT / 'work' / 'morph-09-v2'
TAU = math.tau
TINE_DEG = 3.2           # visible tine excursion per unit of ring envelope
ARC_GAIN = 34.0
COIL_GAIN = 9.0
STROBE_POWER = 950.0
STROBE_DIM = 0.10        # continuous studio light that survives under the strobe


def frame_list(spec):
    out = []
    for part in spec.split(','):
        step = 1
        if ':' in part:
            part, step = part.split(':')
            step = int(step)
        if '-' in part:
            lo, hi = part.split('-')
            out += list(range(int(lo), int(hi) + 1, step))
        else:
            out.append(int(part))
    return sorted({f for f in out if 0 <= f < ch.FRAMES})


def parse():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--frames', default='0-479')
    ap.add_argument('--width', type=int, default=432)
    ap.add_argument('--samples', type=int, default=24)
    ap.add_argument('--blend', type=Path, default=WORK / 'resonator.blend')
    ap.add_argument('--out', type=Path, default=WORK / 'frames')
    ap.add_argument('--save', type=Path)
    ap.add_argument('--resume', action='store_true')
    ap.add_argument('--no-render', action='store_true')
    ap.add_argument('--prefix', default='')
    return ap.parse_args(argv)


class Track:
    """Collects (blender_frame, value) keys per animated property, then writes F-curves."""

    def __init__(self):
        self.keys = {}

    def add(self, owner, path, index, frame, value, constant=False):
        k = (owner.name, type(owner).__name__, path, index)
        self.keys.setdefault(k, (owner, constant, []))[2].append((frame, value))

    def write(self):
        for (_, _, path, index), (owner, constant, points) in self.keys.items():
            if owner.animation_data is None:
                owner.animation_data_create()
            if owner.animation_data.action is None:
                owner.animation_data.action = bpy.data.actions.new(f'{owner.name} / V2')
            act = owner.animation_data.action
            old = act.fcurves.find(path, index=index)
            if old:
                act.fcurves.remove(old)
            fc = act.fcurves.new(path, index=index)
            points.sort()
            fc.keyframe_points.add(len(points))
            fc.keyframe_points.foreach_set('co', [c for p in points for c in p])
            fc.keyframe_points.foreach_set('interpolation', [0 if constant else 1] * len(points))
            fc.update()
        return sum(len(p[2]) for p in self.keys.values())


def cam_quaternion(pos, target):
    r, u, f = ch.look_basis(pos, target)
    m = Matrix(((r[0], u[0], -f[0]), (r[1], u[1], -f[1]), (r[2], u[2], -f[2])))
    return m.to_quaternion()


def bake(frames, meta):
    O = bpy.data.objects
    S = bpy.context.scene
    cam = S.camera
    tr = Track()
    tines = [O[n] for n in meta['tines']]
    riders = [O[n] for n in meta['riders']]
    arms = [O[n] for n in meta['arms']]
    jaws = [O[n] for n in meta['jaws']]
    pads = [O[n] for n in meta['pads']]
    coils = [O[n] for n in meta['coils']]
    windings = [O[n] for n in meta['windings']]
    coil_lights = [O[n] for n in meta['coilLights']]
    lights = {k: (O[v[0]], v[1]) for k, v in meta['lights'].items()}
    brush, pallet_o, hoop = O[meta['brush']], O[meta['pallet']], O[meta['hoop']]
    reed = O[meta['reedBow']]
    rotor, suspension, sleeve = O[meta['rotor']], O[meta['suspension']], O[meta['sleeve']]
    disc_rim = O[meta['discRim']]
    arc, arc_light = O[meta['arc']], O[meta['arcLight']]
    strobes, strobe_tubes = [O[n] for n in meta['strobe']], [O[n] for n in meta['strobeTube']]
    brush_home = brush.location.copy()
    bdir = Vector((math.cos(math.radians(ch.BRUSH_AZ)), math.sin(math.radians(ch.BRUSH_AZ)), 0))
    pallet_home = pallet_o.rotation_euler.z
    jaw_home = [j.location.copy() for j in jaws]
    jaw_tan = Vector((math.cos(math.radians(ch.GAP_CLAP + 90)), math.sin(math.radians(ch.GAP_CLAP + 90)), 0))
    last_q = None
    for f in frames:
        frozen = ch.strobe_frame(f)
        for sub in ch.SUBFRAMES:
            bf = f + 1 + sub
            t = f / ch.FPS if frozen else (f + sub) / ch.FPS
            m = ch.machine(t)
            c = ch.camera(t)
            q = cam_quaternion(c['position'], c['target'])
            if last_q is not None and q.dot(last_q) < 0:
                q.negate()
            last_q = q
            for i in range(3):
                tr.add(cam, 'location', i, bf, c['position'][i])
            for i in range(4):
                tr.add(cam, 'rotation_quaternion', i, bf, q[i])
            tr.add(cam.data, 'lens', 0, bf, c['lens'])
            tr.add(cam.data, 'dof.focus_distance', 0, bf, c['focus'])
            tr.add(cam.data, 'dof.aperture_fstop', 0, bf, c['fstop'])
            # Rotor: the telemetry angle; under the strobe, the flash instant (contact 0 at the brush).
            angle = math.floor(m['angle']) if frozen else m['angle']
            tr.add(rotor, 'rotation_euler', 2, bf, TAU * angle)
            tr.add(suspension, 'location', 2, bf, -0.075 * min(1.2, m['kick']))
            gov = meta['governor']
            alpha = math.radians(gov['restDeg'] + gov['travelDeg'] * m['governor'])
            for a in arms:
                tr.add(a, 'rotation_euler', 1, bf, -alpha)
            tr.add(sleeve, 'location', 2, bf, gov['sleeveZ'] + gov['sleeveTravel'] * m['governor'])
            b = min(1.2, m['brush'])
            loc = brush_home + bdir * 0.07 * b
            for i in range(3):
                tr.add(brush, 'location', i, bf, loc[i])
            tr.add(brush, 'rotation_euler', 1, bf, 0.08 * b)
            tr.add(pallet_o, 'rotation_euler', 2, bf, pallet_home + math.radians(7.5) * m['pallet'])
            for j, home, s in zip(jaws, jaw_home, (-1, 1)):
                p = home - s * jaw_tan * 0.13 * m['clap']
                for i in range(2):
                    tr.add(j, 'location', i, bf, p[i])
            k = 1 - 0.028 * min(1.3, m['bass'])
            tr.add(hoop, 'scale', 0, bf, k)
            tr.add(hoop, 'scale', 1, bf, k)
            v = min(1.2, m['vox'])
            tr.add(reed, 'scale', 2, bf, 1 + 0.85 * v)
            tr.add(reed, 'rotation_euler', 0, bf, 0.06 * v * (m['vox_note'] - 2))
            for n, (tine, rider) in enumerate(zip(tines, riders)):
                i, s = n // 2, (-1 if n % 2 == 0 else 1)
                amp = math.radians(TINE_DEG) * m['ring'][i]
                # A 110-385 Hz fork completes 0.9-3.2 cycles per exposure: it records as a smear
                # across its full excursion. Under the strobe every fork is a multiple of 55 Hz,
                # so the flash catches each at one phase: tines frozen open.
                sweep = 1.0 if frozen else (1.0 if sub == -0.25 else -1.0)
                tr.add(tine, 'rotation_euler', 1, bf, s * amp * sweep)
                L = ch.FORK_LEN[i]
                pos = L * min(0.86, max(0.24, 0.30 + 0.85 * (m['riders'][i] - 1)))
                tr.add(rider, 'location', 2, bf, pos)
            for s, pad in zip((-1, 1) * 2, pads):
                tr.add(pad, 'location', 2, bf, -s * 0.04 * min(1, m['clamp']))
        # Once per frame: lights and emitters hold the state at the picture's closing instant. Cycles
        # reads non-motion data at the shutter centre, so the constant key sits there.
        bf = f + 1 + ch.SUBFRAMES[1]
        m = ch.machine(f / ch.FPS)
        strobe_on = frozen
        dim = STROBE_DIM if strobe_on else 1.0
        for name, (o, base) in lights.items():
            tr.add(o.data, 'energy', 0, bf, base * dim, constant=True)
        arc_level = min(1.6, m['arc']) ** 1.5      # dark between strikes, bright on contact
        warm = (1.0, 0.56, 0.26)
        for i in range(3):
            tr.add(arc, 'color', i, bf, warm[i] * ARC_GAIN * arc_level * (0.35 if strobe_on else 1.0), constant=True)
        tr.add(arc_light.data, 'energy', 0, bf, 9.0 * arc_level * (0.35 if strobe_on else 1.0), constant=True)
        for i, (coil, light) in enumerate(zip(coils, coil_lights)):
            g = m['coil'][i]
            for k in range(3):
                tr.add(coil, 'color', k, bf, (1.0, 0.40, 0.12)[k] * COIL_GAIN * g, constant=True)
            tr.add(light.data, 'energy', 0, bf, 1.6 * g, constant=True)
        wind = m['clamp']
        for w in windings:
            for k in range(3):
                tr.add(w, 'color', k, bf, (1.0, 0.42, 0.14)[k] * 5.0 * wind, constant=True)
        heat = m['heat']
        for k in range(3):   # the disc rim carries the stop's heat as a dull red glow
            tr.add(disc_rim, 'color', k, bf, (1.0, 0.20, 0.035)[k] * 4.5 * heat ** 2.5, constant=True)
        for pad in pads:
            for k in range(3):
                tr.add(pad, 'color', k, bf, (1.0, 0.22, 0.04)[k] * 7.0 * heat * heat, constant=True)
        for strobe, tube in zip(strobes, strobe_tubes):
            tr.add(strobe.data, 'energy', 0, bf, STROBE_POWER if strobe_on else 0.0, constant=True)
            for k in range(3):
                tr.add(tube, 'color', k, bf, (0.85, 0.93, 1.0)[k] * (60.0 if strobe_on else 0.0), constant=True)
    return tr.write()


def setup(args, meta):
    S = bpy.context.scene
    S.render.resolution_x = args.width
    S.render.resolution_y = round(args.width * 16 / 9)
    S.cycles.samples = args.samples
    S.render.use_persistent_data = True
    O = bpy.data.objects
    S.camera.cycles.motion_steps = 2
    for n in meta['tines']:
        for c in O[n].children_recursive:
            c.cycles.motion_steps = 2


def main():
    args = parse()
    if not bpy.data.filepath:
        bpy.ops.wm.open_mainfile(filepath=str(args.blend))
    meta = json.loads((Path(bpy.data.filepath).parent / 'resonator.json').read_text())
    frames = frame_list(args.frames)
    if args.resume:
        frames = [f for f in frames if not (args.out / f'{args.prefix}{f:04d}.png').exists()]
    t0 = time.time()
    n = bake(frames, meta)
    print(f'BAKED {n} keys for {len(frames)} frames in {time.time() - t0:.1f}s', flush=True)
    setup(args, meta)
    S = bpy.context.scene
    if args.save:
        bpy.ops.wm.save_as_mainfile(filepath=str(args.save), copy=True)
        print('SAVED', args.save, flush=True)
    if args.no_render:
        return
    args.out.mkdir(parents=True, exist_ok=True)
    start = time.time()
    for k, f in enumerate(frames):
        S.frame_set(f + 1)
        part = args.out / f'.part-{args.prefix}{f:04d}.png'
        S.render.filepath = str(part)
        t1 = time.time()
        bpy.ops.render.render(write_still=True)
        part.rename(args.out / f'{args.prefix}{f:04d}.png')
        el = time.time() - start
        print(f'FRAME {f} {time.time() - t1:.1f}s  [{k + 1}/{len(frames)}, eta {el / (k + 1) * (len(frames) - k - 1) / 60:.1f} min]',
              flush=True)


if __name__ == '__main__':
    main()
