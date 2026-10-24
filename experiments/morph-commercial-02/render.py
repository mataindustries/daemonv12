"""THE CIRCUIT V2 — bake the choreography into keyframes, then render with CPU Cycles.

    python3.11 render.py --frames 0-455 --width 1080 --samples 16            # master
    python3.11 render.py --variant proof --width 432 --samples 12            # approved proof
    blender -b work/circuit-v2.blend --python render.py -- --frames 0-455

Every moving or glowing part is keyed from choreography.py before rendering, so no Python
runs while Cycles works. Transforms are keyed at each frame's shutter open, centre and close
(Blender frame f + 1 is picture frame f; shutter 0.5 centred = [(f + 0.5) / 60, (f + 1) / 60]
seconds), lights once per frame at its light time. --save writes the animated scene, which any
Blender 4.3 can render or scrub. Frames 456-479 are never rendered: finish.py writes them black.
Output: work/master/raw-NNN.png (8-bit RGB) unless --out is given.
"""
import argparse
import json
import math
import sys
import time
from pathlib import Path

import bpy
from mathutils import Matrix

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import choreography as ch  # noqa: E402

TILE_GAIN = 3.0
RAIL_GAIN = 3.0
WELL_GAIN = 4.0
BELL_GAIN = 8.0
TILT_DEGREES = 14.0
EXPOSURE = -0.9  # V1 graded its plates ~0.8 EV down in compositing; V2 sets exposure in the render
SUBFRAMES = (-0.25, 0.0, 0.25)


def frame_list(spec):
    frames = []
    for part in spec.split(','):
        step = 1
        if ':' in part:
            part, step = part.split(':')
            step = int(step)
        if '-' in part:
            lo, hi = part.split('-')
            frames += list(range(int(lo), int(hi) + 1, step))
        else:
            frames.append(int(part))
    return sorted({f for f in frames if 0 <= f < ch.CUT_FRAME})


def parse():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--frames', default=f'0-{ch.CUT_FRAME - 1}')
    ap.add_argument('--width', type=int, default=1080)
    ap.add_argument('--samples', type=int, default=16)
    ap.add_argument('--blend', type=Path, default=HERE / 'work' / 'circuit-v2.blend')
    ap.add_argument('--out', type=Path, default=HERE / 'work' / 'master')
    ap.add_argument('--save', type=Path, help='also save the baked, animated .blend here')
    ap.add_argument('--no-render', action='store_true')
    ap.add_argument('--variant', choices=ch.VARIANTS, default='master',
                    help="'proof' reproduces the approved motion proof; 'master' adds the climax clarity pass")
    ap.add_argument('--resume', action='store_true', help='skip frames whose PNG already exists')
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
            fc = owner.animation_data.action.fcurves.new(path, index=index)
            points.sort()
            fc.keyframe_points.add(len(points))
            fc.keyframe_points.foreach_set('co', [c for p in points for c in p])
            fc.keyframe_points.foreach_set('interpolation', [0 if constant else 1] * len(points))
            fc.update()
        return sum(len(p[2]) for p in self.keys.values())


def bake(score, frames, meta, variant):
    obj = bpy.data.objects
    carriers = [[obj[f'carrier r{r} k{k:02d}'] for k in range(len(p))] for r, p in enumerate(ch.RINGS)]
    rails = [obj[n] for n in meta['rails']]          # outer, middle, inner, spine
    well = obj[meta['well']]
    bells = [obj[n] for n in meta['bells']]
    ribbons = [obj[n] for n in meta['ribbons']]
    rig = obj['core rig']
    cam = bpy.context.scene.camera
    cam.rotation_mode = 'QUATERNION'
    tr = Track()
    tilt_max = math.radians(TILT_DEGREES)
    for f in frames:
        fc = ch.core_frame(score, f)
        cam_shutter = ch.camera_shutter((f + 0.75) / ch.FPS, variant)
        for sub in SUBFRAMES:
            bf = f + 1 + sub
            tx = (f + 0.75 + sub) / ch.FPS
            tx_core = (fc + 0.75 + sub) / ch.FPS
            # The camera's keys may span less time than the machinery's: a camera-only shutter.
            c = ch.camera(score, (f + 0.75 + sub * cam_shutter) / ch.FPS, variant)
            rot = Matrix(((c['right'][0], c['up'][0], -c['forward'][0]),
                          (c['right'][1], c['up'][1], -c['forward'][1]),
                          (c['right'][2], c['up'][2], -c['forward'][2]))).to_quaternion()
            for i in range(3):
                tr.add(cam, 'location', i, bf, c['position'][i])
            for i in range(4):
                tr.add(cam, 'rotation_quaternion', i, bf, rot[i])
            # Lens and focus are keyed at the shutter instants too: Cycles motion-blurs zoom,
            # and a once-per-frame key would interpolate across a cut inside the shutter.
            tr.add(cam.data, 'lens', 0, bf, c['lens'])
            tr.add(cam.data, 'dof.focus_distance', 0, bf, c['focus'])
            tr.add(cam.data, 'dof.aperture_fstop', 0, bf, c['fstop'])
            tr.add(rig, 'location', 2, bf, score.thump(tx))
            lift = score.lift(tx_core)
            tilt = tilt_max * min(1.0, lift / 0.2)
            for r in range(3):
                phase = score.phase(r, tx_core if r == 2 else tx)
                for k, o in enumerate(carriers[r]):
                    x, y = ch.slot_xy(r, k + phase)
                    tr.add(o, 'location', 0, bf, x)
                    tr.add(o, 'location', 1, bf, y)
                    tr.add(o, 'location', 2, bf, ch.TILE_Z + (lift if r == 2 else 0.0))
                    if r == 2:
                        tr.add(o, 'rotation_euler', 1, bf, tilt * max(-1.0, min(1.0, x / 0.23)))
        bf = f + 1
        tl, tl_core = (f + 1.0) / ch.FPS, (fc + 1.0) / ch.FPS
        crush = ch.core_gain(score, f)
        lights = score.tile_lights(tl, core_tau=tl_core, core_gain=crush)
        rail = score.rail_lights(tl)
        glow = score.core_glow(tl_core, crush)
        bell = score.bell_light(tl)
        for r in range(3):
            for k, o in enumerate(carriers[r]):
                for i in range(3):
                    tr.add(o, 'color', i, bf, lights[r][k][i] * TILE_GAIN, constant=True)
        for o, rgb in zip(rails, [rail[0], rail[1], rail[2], rail[2]]):
            for i in range(3):
                tr.add(o, 'color', i, bf, rgb[i] * RAIL_GAIN, constant=True)
        for i in range(3):
            tr.add(well, 'color', i, bf, glow[i] * WELL_GAIN, constant=True)
        for o in bells:
            for i in range(3):
                tr.add(o, 'color', i, bf, ch.WHITE[i] * BELL_GAIN * bell, constant=True)
        for o, pulses in zip(ribbons, score.route_pulses(tl)):
            for i in range(6):
                p, a = pulses[i] if i < len(pulses) else (0.0, 0.0)
                tr.add(o, f'["p{i}"]', 0, bf, p, constant=True)
                tr.add(o, f'["a{i}"]', 0, bf, a, constant=True)
    return tr.write()


def main():
    args = parse()
    if not bpy.data.filepath:
        bpy.ops.wm.open_mainfile(filepath=str(args.blend))
    meta = json.loads((Path(bpy.data.filepath).parent / 'scene-v2.json').read_text())
    S = bpy.context.scene
    score = ch.load_score()
    frames = frame_list(args.frames)
    if args.resume:
        frames = [f for f in frames if not (args.out / f'raw-{f:03d}.png').exists()]
    t0 = time.time()
    keys = bake(score, frames, meta, args.variant)
    print(f'BAKED {keys} keys for {len(frames)} frames ({args.variant}) in {time.time() - t0:.1f}s', flush=True)
    S.frame_start, S.frame_end = 1, ch.CUT_FRAME
    S.render.resolution_x = args.width
    S.render.resolution_y = round(args.width * 16 / 9)
    S.render.resolution_percentage = 100
    S.render.image_settings.file_format = 'PNG'
    S.render.image_settings.color_mode = 'RGB'
    S.render.image_settings.color_depth = '8'
    S.cycles.samples = args.samples
    S.view_settings.exposure = EXPOSURE
    bpy.app.handlers.frame_change_pre.clear()
    if args.save:
        bpy.ops.wm.save_as_mainfile(filepath=str(args.save), copy=True)
        print('SAVED', args.save, flush=True)
    if args.no_render:
        return
    args.out.mkdir(parents=True, exist_ok=True)
    start = time.time()
    for n, f in enumerate(frames):
        S.frame_set(f + 1)
        part = args.out / f'.part-raw-{f:03d}.png'
        S.render.filepath = str(part)
        t1 = time.time()
        bpy.ops.render.render(write_still=True)
        part.replace(args.out / f'raw-{f:03d}.png')  # complete frames only, so --resume is safe
        print(f'FRAME {f} {time.time() - t1:.2f}s ({n + 1}/{len(frames)})', flush=True)
    print(f'RENDER_DONE {len(frames)} frames in {time.time() - start:.1f}s', flush=True)


main()
