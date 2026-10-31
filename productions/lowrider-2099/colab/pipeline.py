"""ANGELES//2099 Colab pipeline. Standard library only.

Every notebook cell imports this module and calls one function. Nothing is shared between cells
through variables: paths come from fixed constants and config.json, state lives in files on Drive.
That makes each cell safe to run alone, again, or after a reconnect (the old notebook's
`NameError: BASE is not defined` cannot happen).

Local mode (LOWRIDER_LOCAL=1) maps Drive to a local folder and uses an existing bpy interpreter
(LOWRIDER_BPY_PYTHON) so the whole notebook can be validated without Colab or a GPU.
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROD = HERE.parent                                   # productions/lowrider-2099
CONFIG = json.loads((HERE / "config.json").read_text())
LOCAL = os.environ.get("LOWRIDER_LOCAL") == "1"


class PipelineError(RuntimeError):
    """A failure with a recovery instruction. The notebook prints it and stops."""

    def __init__(self, what, fix):
        super().__init__(f"{what}\nHOW TO FIX: {fix}")


def say(*a):
    print(*a, flush=True)


# ---------------------------------------------------------------------------------------------
# paths and state
# ---------------------------------------------------------------------------------------------
def paths():
    if LOCAL:
        drive = Path(os.environ.get("LOWRIDER_DRIVE", "/tmp/lowrider-local-drive"))
        venv = Path(os.environ.get("LOWRIDER_VENV", "/tmp/lowrider-local-venv"))
    else:
        drive = Path("/content/drive/MyDrive") / CONFIG["driveFolder"]
        venv = Path("/content/bpy311")
    return {
        "prod": PROD, "drive": drive, "venv": venv, "python": venv / "bin" / "python",
        "cache": drive / "cache", "reports": drive / "reports", "renders": drive / "renders",
        "state": drive / "state.json",
    }


def load_state():
    p = paths()["state"]
    return json.loads(p.read_text()) if p.exists() else {}


def save_state(**kv):
    p = paths()
    p["drive"].mkdir(parents=True, exist_ok=True)
    st = load_state()
    st.update(kv)
    st["updated"] = time.strftime("%Y-%m-%d %H:%M:%S")
    p["state"].write_text(json.dumps(st, indent=1) + "\n")
    return st


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def run(cmd, timeout=3600, check=True, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, **kw)
    if check and r.returncode != 0:
        raise PipelineError(f"command failed ({r.returncode}): {' '.join(map(str, cmd))}\n{(r.stdout + r.stderr)[-2000:]}",
                            "Read the output above. Rerun this cell; if it fails the same way, Runtime > Disconnect and delete runtime, then Run all.")
    return r


# ---------------------------------------------------------------------------------------------
# cell 2: Drive
# ---------------------------------------------------------------------------------------------
def mount_drive():
    p = paths()
    if not LOCAL and not Path("/content/drive/MyDrive").exists():
        try:
            from google.colab import drive  # type: ignore
        except ImportError as e:
            raise PipelineError("Not running in Google Colab.", "Open the notebook in Colab, or set LOWRIDER_LOCAL=1 for a local check.") from e
        drive.mount("/content/drive")
    for k in ("drive", "cache", "reports", "renders"):
        p[k].mkdir(parents=True, exist_ok=True)
    st = save_state(driveReady=True)
    say(f"Drive folder: {p['drive']}")
    say(f"Existing work kept: {sorted(x.name for x in p['renders'].iterdir()) or 'none yet'}; gates passed: {st.get('gates', {})}")
    return p["drive"]


# ---------------------------------------------------------------------------------------------
# cell 3: Blender (the pinned bpy wheel, identical to the one that rendered the styleframes)
# ---------------------------------------------------------------------------------------------
def install_blender():
    p, pins = paths(), CONFIG["pins"]
    if LOCAL:
        py = Path(os.environ.get("LOWRIDER_BPY_PYTHON", ""))
        if not py.exists():
            raise PipelineError("LOWRIDER_BPY_PYTHON does not point to a Python with bpy.", "Set it to the interpreter of a venv with bpy==4.5.14.")
        _verify_bpy(py)
        return py
    if p["python"].exists():
        try:
            _verify_bpy(p["python"])
            say("Blender already installed in this runtime.")
            return p["python"]
        except PipelineError:
            say("Existing install failed verification; reinstalling.")
    # uv (pinned) manages a Python 3.11 for bpy, independent of Colab's own Python
    req = p["cache"] / "uv-requirements.txt"
    req.write_text(f"uv=={pins['uv']['version']} --hash=sha256:{pins['uv']['sha256']}\n")
    run([sys.executable, "-m", "pip", "install", "--quiet", "--require-hashes", "-r", str(req)], timeout=600)
    uv = shutil.which("uv") or str(Path(sys.executable).parent / "uv")
    run([uv, "venv", "--python", pins["python"], str(p["venv"])], timeout=900)
    wheels = p["cache"] / "wheels"
    wheels.mkdir(parents=True, exist_ok=True)
    reqs = p["cache"] / "bpy-requirements.txt"
    reqs.write_text("".join(f"{w['name']}=={w['version']} --hash=sha256:{w['sha256']}\n" for w in pins["wheels"]))
    have = {w.name for w in wheels.glob("*.whl")}
    need = [w for w in pins["wheels"] if w["file"] not in have]
    if need:
        say(f"Downloading {', '.join(w['file'] for w in need)} to the Drive cache (once; later runtimes reuse it).")
        run([sys.executable, "-m", "pip", "download", "--no-deps", "--only-binary=:all:",
             "--python-version", pins["python"], "--platform", "manylinux_2_28_x86_64", "--platform", "manylinux2014_x86_64",
             "--require-hashes", "-r", str(reqs), "-d", str(wheels)], timeout=1800)
    for w in pins["wheels"]:
        f = wheels / w["file"]
        if not f.exists() or sha256(f) != w["sha256"]:
            if f.exists():
                f.unlink()
            raise PipelineError(f"{w['file']} is missing or does not match its pinned SHA-256.", "Rerun this cell: the bad file was deleted and will be downloaded again.")
    run([uv, "pip", "install", "--python", str(p["python"]), "--no-index", "--find-links", str(wheels), "--require-hashes", "-r", str(reqs)], timeout=1800)
    _verify_bpy(p["python"])
    return p["python"]


def _verify_bpy(py):
    r = run([str(py), "-c", "import bpy, numpy; print(bpy.app.version_string, numpy.__version__)"], timeout=300, check=False)
    out = r.stdout.strip().splitlines()[-1] if r.stdout.strip() else ""
    want = CONFIG["pins"]["blenderVersion"]
    if r.returncode != 0 or not out.startswith(want):
        raise PipelineError(f"Blender check failed (wanted {want}, got {out!r}).\n{r.stderr[-800:]}", "Rerun the Blender cell; it reinstalls from the pinned wheels.")
    save_state(blender=out)
    say(f"Blender OK: {out}")


# ---------------------------------------------------------------------------------------------
# cell 4: GPU
# ---------------------------------------------------------------------------------------------
GPU_PROBE = r"""
import bpy, json
prefs = bpy.context.preferences.addons['cycles'].preferences
found = {}
for backend in ('OPTIX', 'CUDA'):
    try:
        prefs.compute_device_type = backend; prefs.get_devices()
        found[backend] = [d.name for d in prefs.devices if d.type == backend]
    except TypeError:
        found[backend] = []
print(json.dumps(found))
"""


def check_gpu():
    p = paths()
    smi = shutil.which("nvidia-smi")
    gpu_name = None
    if smi:
        r = run([smi, "--query-gpu=name,memory.total", "--format=csv,noheader"], check=False)
        gpu_name = r.stdout.strip() or None
    py = install_blender() if LOCAL else p["python"]
    if not Path(py).exists():
        raise PipelineError("Blender is not installed in this runtime.", "Run the 'Install Blender' cell first.")
    r = run([str(py), "-c", GPU_PROBE], timeout=300, check=False)
    found = json.loads(r.stdout.strip().splitlines()[-1]) if r.returncode == 0 and r.stdout.strip() else {}
    ok = bool(found.get("OPTIX") or found.get("CUDA"))
    save_state(gpu={"nvidiaSmi": gpu_name, "cycles": found, "ok": ok})
    if not ok:
        raise PipelineError(f"No CUDA/OptiX GPU visible to Cycles (nvidia-smi: {gpu_name or 'none'}).",
                            "Runtime > Change runtime type > T4 GPU > Save, then Runtime > Run all. Renders are refused on CPU here to protect your time.")
    say(f"GPU OK: {gpu_name}; Cycles devices {found}")
    return found


# ---------------------------------------------------------------------------------------------
# cell 5: soundtrack and scene validation (CPU only, no rendering)
# ---------------------------------------------------------------------------------------------
def validate_inputs(candidate=None):
    p = paths()
    cand = candidate or CONFIG["candidate"]
    if cand not in ("crest", "hover"):
        raise PipelineError(f"Unknown candidate {cand!r}.", "Set candidate to 'crest' or 'hover' in colab/config.json.")
    wav = p["prod"] / "review" / "music" / f"{cand}.wav"
    rep = json.loads((p["prod"] / "review" / "music" / f"{cand}.master.json").read_text())
    if not wav.exists() or sha256(wav) != rep["wav"]["sha256"]:
        raise PipelineError(f"Soundtrack {wav.name} is missing or differs from its master report.", "Re-fetch the project (cell 1); do not edit files in review/music.")
    cues = json.loads((p["prod"] / "visual" / "sync" / f"{cand}.cues.json").read_text())
    if cues["durationFrames"] != CONFIG["frames"]:
        raise PipelineError("Cue sheet length does not match config.", "Rebuild cues with visual/sync/build_cues.py.")
    py = install_blender() if LOCAL else p["python"]
    p["reports"].mkdir(parents=True, exist_ok=True)
    report = p["reports"] / f"scene-check-{cand}.json"
    r = run([str(py), str(p["prod"] / "blender" / "angeles2099.py"), "--check", "--cand", cand, "--report", str(report)], timeout=1800, check=False)
    chk = json.loads(report.read_text()) if report.exists() else {"ok": False}
    for c in chk.get("checks", []):
        say(("PASS " if c["ok"] else "FAIL ") + c["check"])
    if not chk.get("ok"):
        raise PipelineError("Scene validation failed (see the FAIL lines).", "Do not render. Send the report file to the producer: " + str(report))
    st = save_state(candidate=cand, validated=True, soundtrackSha256=rep["wav"]["sha256"])
    say(f"Inputs valid for {cand}. Nothing was rendered.")
    return st


# ---------------------------------------------------------------------------------------------
# cells 6-7: gated renders with an explicit GPU budget
# ---------------------------------------------------------------------------------------------
def budget(n_frames, res, samples):
    """Conservative T4 estimate, from the measured seconds per frame if a proof has run."""
    st = load_state()
    per = st.get("measuredSecondsPerFrame", {}).get(f"{res[0]}x{res[1]}@{samples}")
    if per is None:
        px = res[0] * res[1] * samples
        per = 25.0 + px / 360 / 640 / 32 * 35.0          # assumed until measured: ~60 s at 360x640, 32 spp
        basis = "assumed (no measurement yet)"
    else:
        basis = "measured on this project"
    total = n_frames * per + 120                         # + scene build per batch
    say(f"GPU budget: {n_frames} frames at {res[0]}x{res[1]}, {samples} samples ~ {per:.0f} s/frame ({basis}) "
        f"=> ~{total / 60:.1f} min of T4 time.")
    return total


def render(gate, frames, res, samples, confirm=False):
    p, st = paths(), load_state()
    if not st.get("validated"):
        raise PipelineError("Inputs have not been validated in this Drive folder.", "Run the 'Validate' cell first.")
    if gate == "GATE04" and not st.get("gates", {}).get("GATE03"):
        raise PipelineError("GATE 04 needs the owner's GATE 03 approval.", "Review the five-frame proof, then record approval with approve('GATE03').")
    if not LOCAL and not st.get("gpu", {}).get("ok"):
        raise PipelineError("No verified GPU in this runtime.", "Run the GPU cell.")
    budget(len(frames), res, samples)
    out = p["renders"] / gate
    todo = [f for f in frames if not (out / f"frame_{f:04d}.png").exists()]
    if not todo:
        say(f"All {len(frames)} frames already on Drive in {out} (kept). Nothing to do.")
        return out
    if not confirm:
        say(f"Not rendering: set CONFIRM = True in this cell to spend the budget above on {len(todo)} frame(s).")
        return None
    out.mkdir(parents=True, exist_ok=True)
    py = install_blender() if LOCAL else p["python"]
    device = "CPU" if LOCAL else "GPU"
    t0 = time.time()
    run([str(py), str(p["prod"] / "blender" / "angeles2099.py"), "--cand", st["candidate"], "--frames", ",".join(map(str, todo)),
         "--res", f"{res[0]}x{res[1]}", "--samples", str(samples), "--device", device, "--out-dir", str(out)], timeout=6 * 3600)
    per = (time.time() - t0) / len(todo)
    m = st.get("measuredSecondsPerFrame", {})
    m[f"{res[0]}x{res[1]}@{samples}"] = round(per, 1)
    save_state(measuredSecondsPerFrame=m, **{f"{gate}Rendered": sorted(set(st.get(f"{gate}Rendered", [])) | set(todo))})
    say(f"Rendered {len(todo)} frame(s) to {out} at {per:.0f} s/frame ({device}).")
    return out


def approve(gate):
    """Record the owner's approval of a gate on Drive (only the owner should run this)."""
    st = load_state()
    g = st.get("gates", {})
    g[gate] = time.strftime("%Y-%m-%d %H:%M:%S")
    save_state(gates=g)
    say(f"Recorded approval of {gate}.")


def status():
    p, st = paths(), load_state()
    say(json.dumps(st, indent=1))
    if p["renders"].exists():
        for d in sorted(p["renders"].iterdir()):
            say(f"{d.name}: {len(list(d.glob('*.png')))} frame(s)")
