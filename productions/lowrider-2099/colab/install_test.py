"""The real Blender install path, as on a fresh Colab runtime (CPU only, nothing rendered).

Fresh install from a Drive cache holding only bpy and numpy (the state the first T4 run left),
import bpy and every dependency, reconnect (venv gone), a broken venv, a corrupt cached wheel,
then real scene generation and validation. Writes colab/install_test.json.

usage (a plain Python with pip stands in for Colab's; LOWRIDER_BPY_PYTHON must be unset):
  LOWRIDER_LOCAL=1 LOWRIDER_DRIVE=/tmp/drive LOWRIDER_VENV=/tmp/venv python3 colab/install_test.py
"""
import json, os, shutil, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pipeline as P
p = P.paths()
res = []
def step(name, fn):
    t = time.time()
    try:
        out = fn(); ok = True
    except Exception as e:
        out, ok = str(e)[:400], False
    res.append((name, ok, round(time.time() - t, 1), str(out)[:200]))
    print(("PASS " if ok else "FAIL ") + f"{name} ({res[-1][2]} s): {res[-1][3]}", flush=True)
    return ok
cache = p["cache"] / "wheels"
print("cache before:", sorted(f.name.split("-")[0] for f in cache.glob("*.whl")))
step("fresh runtime: install from a cache holding only bpy and numpy (the failed run's state)", P.install_blender)
print("cache after:", sorted(f.name.split("-")[0] for f in cache.glob("*.whl")))
step("import bpy and every dependency; bpy.app.version_string", lambda: P.run([str(p["python"]), "-c",
     "import bpy, numpy, Cython, requests, zstandard; print(bpy.app.version_string)"]).stdout.strip())
shutil.rmtree(p["venv"])
step("reconnect: new runtime, venv gone, wheels on Drive (offline install)", P.install_blender)
bpy_dir = next((p["venv"] / "lib").glob("python3.11/site-packages/bpy"))
shutil.rmtree(bpy_dir)
step("broken venv (bpy deleted): detected and rebuilt", P.install_blender)
w = next(cache.glob("zstandard-*.whl")); w.write_bytes(b"truncated")
shutil.rmtree(p["venv"])
step("corrupt cached wheel: deleted, downloaded again, verified", P.install_blender)
step("scene generation and validation with the installed Blender (crest)", lambda: P.validate_inputs("crest"))
rep = {"ok": all(r[1] for r in res), "steps": [{"step": n, "ok": o, "seconds": s} for n, o, s, _ in res]}
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "install_test.json"), "w").write(json.dumps(rep, indent=1) + "\n")
print(json.dumps(rep))
sys.exit(0 if rep["ok"] else 1)
