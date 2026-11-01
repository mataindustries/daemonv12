"""Measure render options on this machine: Cycles at lower sample counts with denoising, and
EEVEE Next (if it runs headless here at all). Builds the CREST scene once, renders the same frames
with each option, and compares every result with a Cycles 128-sample reference.

usage: python3.11 blender/engine_bench.py OUT_DIR [--frames 170,470] [--res 360x640]
writes OUT_DIR/<option>/frame_NNNN.png and OUT_DIR/bench.json (times, error vs the reference)
"""
import argparse
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy  # noqa: E402
import numpy as np  # noqa: E402
import angeles2099 as A  # noqa: E402

OPTIONS = [("cycles128", "CYCLES", 128), ("cycles32", "CYCLES", 32), ("cycles16", "CYCLES", 16), ("cycles8", "CYCLES", 8),
           ("eevee64", "BLENDER_EEVEE_NEXT", 64), ("eevee16", "BLENDER_EEVEE_NEXT", 16)]


def load(path):
    img = bpy.data.images.load(path, check_existing=False)
    a = np.array(img.pixels[:], dtype=np.float32).reshape(img.size[1], img.size[0], 4)[..., :3]
    bpy.data.images.remove(img)
    return a


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--frames", default="170,470")
    ap.add_argument("--res", default="360x640")
    a = ap.parse_args(argv)
    frames = [int(v) for v in a.frames.split(",")]
    res = tuple(int(v) for v in a.res.split("x"))
    t0 = time.time()
    S = A.build("crest")
    build_s = time.time() - t0
    sc = S["scene"]
    A.set_device(sc, "CPU")
    rep = {"blender": bpy.app.version_string, "frames": frames, "res": list(res), "buildSeconds": round(build_s, 1), "options": {}}
    for name, engine, samples in OPTIONS:
        out = os.path.join(a.out, name)
        os.makedirs(out, exist_ok=True)
        sc.render.engine = engine
        if engine == "CYCLES":
            sc.cycles.samples = samples
            sc.cycles.use_denoising = True
        else:
            sc.eevee.taa_render_samples = samples
            if hasattr(sc.eevee, "use_raytracing"):
                sc.eevee.use_raytracing = True          # chrome and candy need screen-space reflections
        times, err = [], None
        try:
            for f in frames:
                sc.frame_set(f)
                sc.render.resolution_x, sc.render.resolution_y = res
                sc.render.filepath = os.path.join(out, f"frame_{f:04d}.png")
                t = time.time()
                bpy.ops.render.render(write_still=True)
                times.append(round(time.time() - t, 1))
                print(f"{name} frame {f}: {times[-1]} s", flush=True)
        except Exception as e:                                # an engine that cannot run here is a result, not a crash
            err = f"{type(e).__name__}: {e}"[:300]
            print(f"{name} failed: {err}", flush=True)
        rep["options"][name] = {"engine": engine, "samples": samples, "seconds": times, "error": err}
    ref = {f: load(os.path.join(a.out, "cycles128", f"frame_{f:04d}.png")) for f in frames}
    for name, o in rep["options"].items():
        if o["error"] or name == "cycles128":
            continue
        d = []
        for f in frames:
            x = load(os.path.join(a.out, name, f"frame_{f:04d}.png"))
            mse = float(np.mean((np.clip(x, 0, 1) - np.clip(ref[f], 0, 1)) ** 2))
            d.append({"frame": f, "meanAbs255": round(float(np.mean(np.abs(x - ref[f]))) * 255, 2), "psnr": round(10 * np.log10(1.0 / max(mse, 1e-10)), 1)})
        o["vsCycles128"] = d
    with open(os.path.join(a.out, "bench.json"), "w") as fh:
        json.dump(rep, fh, indent=1)
    print(json.dumps(rep))


if __name__ == "__main__":
    main(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:])
