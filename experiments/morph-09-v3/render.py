"""MORPH//09 V3 — V2's keys, plus the overload effects, rendered with CPU Cycles.

    /opt/bpyenv/bin/python experiments/morph-09-v3/render.py --frames 360-479 --width 432 --samples 16

V2's own bake (camera, machine, lights; imported unchanged from ../morph-09-v2/render.py) runs
first, then the effects are keyed on top. Effect objects and lights are hidden in every picture
where they carry nothing, so those pictures render the V2 scene exactly. Conventions follow V2:
picture f is Blender frame f + 1; transforms keyed at the shutter's open, centre and close;
light and emission hold the state at the closing instant and are keyed at the shutter centre.
"""
import argparse
import json
import sys
import time
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import effects as fx  # noqa: E402  (also puts ../morph-09-v2 on the path)
import importlib.util  # noqa: E402

# V2's render module, loaded by path because this file shares its name.
_spec = importlib.util.spec_from_file_location('v2render', HERE.parent / 'morph-09-v2' / 'render.py')
v2 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(v2)
ch = fx.ch
WORK = ROOT / 'work' / 'morph-09-v3'

CORE_BLUE = (0.80, 0.88, 1.0)
HALO_BLUE = (0.26, 0.42, 1.0)
EMBER = (1.0, 0.42, 0.14)
CORE_GAIN, HALO_GAIN, AFTER_GAIN, AFTER_HALO = 55.0, 4.5, 9.0, 0.9
ARC_LIGHT_W = 3.5             # per unit of arc intensity, kept low: no frame-wide flashes
SPARK_GAIN = 360.0
HEAT_LIGHT_W = 4.0


def parse():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--frames', default='360-479')
    ap.add_argument('--width', type=int, default=432)
    ap.add_argument('--samples', type=int, default=16)
    ap.add_argument('--blend', type=Path, default=WORK / 'resonator-v3.blend')
    ap.add_argument('--out', type=Path, default=WORK / 'frames')
    ap.add_argument('--resume', action='store_true')
    ap.add_argument('--save', type=Path)
    return ap.parse_args(argv)


def heat_window(t):
    """Radiant heat light only while the brake is hot enough to matter; zero long before the seam."""
    age = (t - ch.BRAKE) % ch.PERIOD
    return fx.smoothstep(0.0, 0.03, age) * (1.0 - fx.smoothstep(0.80, 1.10, age))


def bake_effects(frames, meta):
    O = bpy.data.objects
    v3 = meta['v3']
    tr = v2.Track()
    arcs = fx.arc_events()
    sparks = fx.spark_events()
    cores = [O[a['core']] for a in v3['arcs']]
    halos = [O[a['halo']] for a in v3['arcs']]
    parts = [O[n] for n in v3['sparks']]
    arc_light, heat_light, vapor = O[v3['arcLight']], O[v3['heatLight']], O[v3['vapor']]
    vtree = bpy.data.materials[v3['vaporMaterial']].node_tree
    for f in frames:
        t_close = f / ch.FPS
        centre = f + 1 + ch.SUBFRAMES[1]
        subs = [f + 1 + s for s in ch.SUBFRAMES]

        def hide(o, hidden):
            for bf in subs:
                tr.add(o, 'hide_render', 0, bf, float(bool(hidden)), constant=True)

        # 1. plasma: colour and visibility per picture; geometry is fixed per arc
        total = 0.0
        for arc, core, halo in zip(arcs, cores, halos):
            c, a = fx.arc_level(arc, f)
            on = c > 0 or a > 0
            hide(core, not on)
            hide(halo, not on)
            if c > 0:
                cc = [k * CORE_GAIN * c for k in CORE_BLUE]
                hc = [k * HALO_GAIN * c for k in HALO_BLUE]
            else:
                cc = [k * AFTER_GAIN * a for k in EMBER]
                hc = [k * AFTER_HALO * a for k in EMBER]
            for i in range(3):
                tr.add(core, 'color', i, centre, cc[i], constant=True)
                tr.add(halo, 'color', i, centre, hc[i], constant=True)
            total += c + 0.2 * a
        hide(arc_light, total <= 0)
        tr.add(arc_light.data, 'energy', 0, centre, ARC_LIGHT_W * total, constant=True)

        # 2. particles: positions at the shutter samples (they streak), glow at the closing instant
        for sp, o in zip(sparks, parts):
            state = fx.spark_state(sp, t_close)
            hide(o, state is None)
            for bf, s in zip(subs, ch.SUBFRAMES):
                pos = fx.spark_position(sp, (f + s) / ch.FPS)
                for i in range(3):
                    tr.add(o, 'location', i, bf, pos[i])
            rgb, k = (state[1], state[2]) if state else ((0, 0, 0), 0.0)
            for i in range(3):
                tr.add(o, 'color', i, centre, rgb[i] * SPARK_GAIN * k, constant=True)

        # 3. vapor and the hot metal's radiant light
        vp = fx.vapor(t_close)
        hide(vapor, vp['envelope'] <= 0)
        for key in ('age', 'envelope', 'front'):
            tr.add(vtree, f'nodes["{key}"].outputs[0].default_value', 0, centre, vp[key], constant=True)
        w = heat_window(t_close) * fx.heat_glow(t_close)
        hide(heat_light, w <= 1e-4)
        tr.add(heat_light.data, 'energy', 0, centre, HEAT_LIGHT_W * w, constant=True)
    return tr.write()


def main():
    args = parse()
    bpy.ops.wm.open_mainfile(filepath=str(args.blend))
    meta = json.loads((args.blend.parent / 'resonator.json').read_text())
    frames = v2.frame_list(args.frames)
    if args.resume:
        frames = [f for f in frames if not (args.out / f'{f:04d}.png').exists()]
    t0 = time.time()
    n = v2.bake(frames, meta) + bake_effects(frames, meta)
    print(f'BAKED {n} keys for {len(frames)} frames in {time.time() - t0:.1f}s', flush=True)
    v2.setup(args, meta)
    S = bpy.context.scene
    if args.save:
        bpy.ops.wm.save_as_mainfile(filepath=str(args.save), copy=True)
    args.out.mkdir(parents=True, exist_ok=True)
    start = time.time()
    for k, f in enumerate(frames):
        S.frame_set(f + 1)
        part = args.out / f'.part-{f:04d}.png'
        S.render.filepath = str(part)
        t1 = time.time()
        bpy.ops.render.render(write_still=True)
        part.rename(args.out / f'{f:04d}.png')
        el = time.time() - start
        print(f'FRAME {f} {time.time() - t1:.1f}s  [{k + 1}/{len(frames)}, eta {el / (k + 1) * (len(frames) - k - 1) / 60:.1f} min]',
              flush=True)


if __name__ == '__main__':
    main()
