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
# GPU spend: content-keyed outputs, an owner budget, measured timings only
# ---------------------------------------------------------------------------------------------
SAFETY = 1.25            # estimates are padded by 25 %
TEST_ALLOWANCE_MIN = 6.0 # the one-frame GPU test may use at most this much of the budget


def settings(kind):
    """Render settings from config.json; in local mode only, LOWRIDER_TEST_OVERRIDES (JSON) may
    shrink them so the full path can be exercised on a CPU in seconds."""
    c = dict(CONFIG[kind])
    if LOCAL and os.environ.get("LOWRIDER_TEST_OVERRIDES"):
        c.update(json.loads(os.environ["LOWRIDER_TEST_OVERRIDES"]).get(kind, {}))
    return c


def source_commit():
    r = subprocess.run(["git", "-C", str(PROD), "rev-parse", "HEAD"], capture_output=True, text=True)
    return r.stdout.strip() or None


def render_key(cand, gate, frames, res, samples, engine, root=None):
    """SHA-256 over everything that changes pixels: the generator, every spec, the cue sheet,
    config, the soundtrack hash, the frame list and render settings, and the Blender version.
    Outputs live under renders/<gate>/<key[:12]>; change any input and the cache misses."""
    root = Path(root) if root else PROD
    h = hashlib.sha256()
    files = [root / "blender" / "angeles2099.py", root / "colab" / "config.json", root / "visual" / "sync" / f"{cand}.cues.json"]
    files += sorted((root / "visual" / "specs").glob("*.json"))
    for f in files:
        h.update(f.relative_to(root).as_posix().encode()); h.update(sha256(f).encode())
    master = json.loads((root / "review" / "music" / f"{cand}.master.json").read_text())
    blob = {"cand": cand, "gate": gate, "frames": list(frames), "res": list(res), "samples": samples, "engine": engine,
            "soundtrack": master["wav"]["sha256"], "blender": CONFIG["pins"]["blenderVersion"]}
    h.update(json.dumps(blob, sort_keys=True).encode())
    return h.hexdigest()


def _budget_path():
    return paths()["drive"] / "budget.json"


def budget_state():
    p = _budget_path()
    b = json.loads(p.read_text()) if p.exists() else {"approvedMinutes": 0.0, "spent": []}
    b["spentMinutes"] = round(sum(x["minutes"] for x in b["spent"]), 2)
    b["remainingMinutes"] = round(b["approvedMinutes"] - b["spentMinutes"], 2)
    return b


def set_budget(minutes, approver):
    """Owner only: approve a total GPU-minute budget for this Drive folder. Every GPU render is
    charged against it and refused when its padded estimate does not fit."""
    if not approver or minutes <= 0:
        say("No GPU budget approved: set APPROVED_GPU_MINUTES and APPROVER in this cell. Nothing will render on a GPU until then.")
        return budget_state()
    b = budget_state()
    b.update({"approvedMinutes": float(minutes), "approver": approver, "approvedAt": time.strftime("%Y-%m-%d %H:%M:%S")})
    _budget_path().parent.mkdir(parents=True, exist_ok=True)
    _budget_path().write_text(json.dumps({k: b[k] for k in ("approvedMinutes", "approver", "approvedAt", "spent")}, indent=1) + "\n")
    say(f"GPU budget: {minutes} min approved by {approver}; {budget_state()['remainingMinutes']} min remaining.")
    return budget_state()


def _charge(what, seconds, key):
    b = budget_state()
    b["spent"].append({"what": what, "minutes": round(seconds / 60, 2), "key": key[:12], "at": time.strftime("%Y-%m-%d %H:%M:%S")})
    _budget_path().write_text(json.dumps({k: b[k] for k in ("approvedMinutes", "approver", "approvedAt", "spent") if k in b}, indent=1) + "\n")


def _require(st, gpu=True):
    if not st.get("validated"):
        raise PipelineError("Inputs have not been validated in this Drive folder.", "Run the 'Validate' cell first.")
    if gpu and not LOCAL and not st.get("gpu", {}).get("ok"):
        raise PipelineError("No verified GPU in this runtime.", "Run the GPU cell.")


def _blender(args, timeout):
    p = paths()
    py = install_blender() if LOCAL else p["python"]
    t0 = time.time()
    r = run([str(py), str(p["prod"] / "blender" / "angeles2099.py"), *args], timeout=timeout)
    per = [float(l.rsplit(" in ", 1)[1].split(" s")[0]) for l in r.stdout.splitlines() if l.startswith("rendered frame")]
    return time.time() - t0, per


def _write_manifest(out, key, extra):
    out.mkdir(parents=True, exist_ok=True)
    (out / "key.json").write_text(json.dumps({"key": key, "sourceCommit": source_commit(), **extra}, indent=1) + "\n")


def gpu_frame_test(confirm=False):
    """Render ONE frame on the GPU at the proof settings and measure scene build and per-frame
    time separately. Every later estimate uses these numbers; nothing is assumed."""
    st = load_state()
    _require(st)
    c = settings("gpuTest")
    res, samples, frame = tuple(c["resolution"]), c["samples"], c["frame"]
    cand = st["candidate"]
    key = render_key(cand, "GPUTEST", [frame], res, samples, "CYCLES")
    meas = st.get("measured", {}).get(f"{res[0]}x{res[1]}@{samples}")
    if meas and meas.get("key") == key:
        say(f"Already measured for these inputs: build {meas['buildSeconds']} s, {meas['secondsPerFrame']} s/frame ({meas['device']}).")
        return meas
    b = budget_state()
    if not confirm:
        say(f"Not running the GPU test: set CONFIRM = True. It renders frame {frame} at {res[0]}x{res[1]}, {samples} samples, "
            f"and may use at most {TEST_ALLOWANCE_MIN} min of the approved budget ({b['remainingMinutes']} min remaining).")
        return None
    if b["remainingMinutes"] < TEST_ALLOWANCE_MIN:
        raise PipelineError(f"The GPU budget has {b['remainingMinutes']} min left; the test needs {TEST_ALLOWANCE_MIN}.", "Ask the owner to approve a budget in the budget cell.")
    out = paths()["renders"] / "GPUTEST" / key[:12]
    wall, per = _blender(["--cand", cand, "--frames", str(frame), "--res", f"{res[0]}x{res[1]}", "--samples", str(samples),
                          "--device", "CPU" if LOCAL else "GPU", "--out-dir", str(out)], timeout=1800)
    device = "CPU (local)" if LOCAL else (st.get("gpu", {}).get("nvidiaSmi") or "GPU")
    meas = {"key": key, "buildSeconds": round(wall - sum(per), 1), "secondsPerFrame": round(per[0], 1), "device": device}
    m = st.get("measured", {}); m[f"{res[0]}x{res[1]}@{samples}"] = meas
    save_state(measured=m)
    _charge("GPU test, 1 frame", wall, key)
    _write_manifest(out, key, {"kind": "gpu-test", "measured": meas})
    say(f"Measured on {device}: scene build {meas['buildSeconds']} s, {meas['secondsPerFrame']} s per frame. Frame in {out}.")
    return meas


def estimate(n_frames, res, samples, quiet=False):
    meas = load_state().get("measured", {}).get(f"{res[0]}x{res[1]}@{samples}")
    if not meas:
        return None
    minutes = (meas["buildSeconds"] + n_frames * meas["secondsPerFrame"]) * SAFETY / 60
    if not quiet:
        say(f"Estimate: {n_frames} frame(s) at {res[0]}x{res[1]}, {samples} samples = build {meas['buildSeconds']} s + "
            f"{n_frames} x {meas['secondsPerFrame']} s, +25 % => {minutes:.1f} min ({meas['device']}, measured).")
    return minutes


def render(gate, frames, res, samples, confirm=False):
    p, st = paths(), load_state()
    _require(st)
    if gate == "GATE04" and not st.get("gates", {}).get("GATE03"):
        raise PipelineError("GATE 04 needs the owner's GATE 03 approval.", "Review the five-frame proof, then record approval with approve('GATE03').")
    cand = st["candidate"]
    key = render_key(cand, gate, frames, res, samples, "CYCLES")
    out = p["renders"] / gate / key[:12]
    stale = [d.name for d in (p["renders"] / gate).glob("*") if d.is_dir() and d.name != key[:12]] if (p["renders"] / gate).exists() else []
    if stale:
        say(f"Ignoring stale {gate} renders from different inputs: {stale} (kept on Drive, never reused).")
    todo = [f for f in frames if not (out / f"frame_{f:04d}.png").exists()]
    if not todo:
        say(f"All {len(frames)} frames for these exact inputs are already in {out}. Nothing to do.")
        return out
    est = estimate(len(todo), res, samples)
    if est is None:
        msg = "No measured GPU timing for these settings yet."
        if confirm:
            raise PipelineError(msg, "Run the one-frame GPU test cell first; estimates are never assumed.")
        say(f"Not rendering. {msg} Run the GPU test cell first.")
        return None
    b = budget_state()
    if est > b["remainingMinutes"]:
        msg = f"Estimated {est:.1f} min exceeds the remaining approved budget ({b['remainingMinutes']} of {b['approvedMinutes']} min)."
        if confirm:
            raise PipelineError(msg, "Ask the owner to approve more GPU minutes in the budget cell, or render fewer frames.")
        say("Not rendering. " + msg)
        return None
    if not confirm:
        say(f"Not rendering: set CONFIRM = True to spend ~{est:.1f} of the {b['remainingMinutes']} approved minutes on {len(todo)} frame(s).")
        return None
    wall, per = _blender(["--cand", cand, "--frames", ",".join(map(str, todo)), "--res", f"{res[0]}x{res[1]}", "--samples", str(samples),
                          "--device", "CPU" if LOCAL else "GPU", "--out-dir", str(out)], timeout=6 * 3600)
    _charge(f"{gate}: {len(todo)} frame(s)", wall, key)
    _write_manifest(out, key, {"kind": gate, "frames": frames, "res": list(res), "samples": samples, "seconds": round(wall, 1)})
    save_state(**{f"{gate}Rendered": sorted(set(st.get(f"{gate}Rendered", [])) | set(todo))})
    say(f"Rendered {len(todo)} frame(s) to {out} in {wall / 60:.1f} min (estimate was {est:.1f}).")
    return out


def animatic(confirm=False):
    """GATE 04: the whole piece as a Workbench animatic with the soundtrack, as MP4 on Drive.
    A layout check of timing, cameras and sync, not a look. Measured upper bound: 1.4 s/frame at
    360x640 on 4 CPU cores with software OpenGL; a T4 is faster."""
    p, st = paths(), load_state()
    _require(st, gpu=False)
    if not st.get("gates", {}).get("GATE03"):
        raise PipelineError("The animatic (GATE 04) needs the owner's GATE 03 approval.", "Review the five-frame proof, then record approval in the approval cell.")
    c = settings("animatic")
    res, first, last, step = tuple(c["resolution"]), c.get("first", 0), c.get("last", CONFIG["frames"] - 1), c.get("step", 1)
    frames = list(range(first, last + 1, step))
    cand = st["candidate"]
    key = render_key(cand, "ANIMATIC", frames, res, 0, "WORKBENCH")
    out = p["renders"] / "ANIMATIC" / key[:12]
    mp4 = out / f"angeles2099-{cand}-animatic.mp4"
    if mp4.exists():
        say(f"Animatic for these exact inputs already on Drive: {mp4}")
        return mp4
    # the scene build is the GPU test's measured build (it is CPU work either way); frames at the
    # measured CPU upper bound until a T4 number exists
    build = max((m.get("buildSeconds", 0) for m in st.get("measured", {}).values()), default=0) or 120.0
    est = (build + len(frames) * 1.4) * SAFETY / 60
    b = budget_state()
    if not confirm:
        say(f"Not rendering the animatic: set CONFIRM = True. {len(frames)} Workbench frames, at most ~{est:.0f} min "
            f"(CPU-measured upper bound); {b['remainingMinutes']} min of budget remaining.")
        return None
    if est > b["remainingMinutes"] and not LOCAL:
        raise PipelineError(f"Animatic upper bound {est:.0f} min exceeds the remaining budget ({b['remainingMinutes']} min).", "Ask the owner to approve more minutes.")
    import ctypes.util
    if not LOCAL and not ctypes.util.find_library("EGL"):
        run(["apt-get", "install", "-y", "-qq", "libegl1"], timeout=600)   # Workbench renders headless through EGL
    wall, per = _blender(["--cand", cand, "--animatic", str(out), "--res", f"{res[0]}x{res[1]}", "--first", str(first), "--last", str(last), "--step", str(step)], timeout=4 * 3600)
    audio = p["prod"] / "review" / "music" / f"{cand}.mp3"
    seq_fps = 24 / step
    run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", f"{seq_fps}", "-start_number", str(first), "-i", str(out / "frame_%04d.png"),
         "-ss", f"{first / 24:.6f}", "-i", str(audio), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "24", "-c:a", "aac", "-b:a", "192k",
         "-shortest", str(mp4)], timeout=1800)
    _charge(f"animatic: {len(frames)} frames", wall, key)
    _write_manifest(out, key, {"kind": "animatic", "frames": [first, last, step], "res": list(res), "seconds": round(wall, 1),
                               "medianSecondsPerFrame": sorted(per)[len(per) // 2] if per else None})
    say(f"Animatic: {mp4} ({len(frames)} frames in {wall / 60:.1f} min).")
    return mp4


def approve(gate):
    """Record the owner's approval of a gate on Drive (only the owner should run this)."""
    st = load_state()
    g = st.get("gates", {})
    g[gate] = time.strftime("%Y-%m-%d %H:%M:%S")
    save_state(gates=g)
    say(f"Recorded approval of {gate}.")


def status():
    p, st = paths(), load_state()
    b = budget_state()
    say(f"Source commit: {source_commit()}")
    say(f"GPU budget: {b['approvedMinutes']} min approved, {b['spentMinutes']} spent, {b['remainingMinutes']} remaining")
    for e in b["spent"]:
        say(f"  {e['at']}  {e['what']}: {e['minutes']} min")
    say(f"Measured timings: {json.dumps(st.get('measured', {}))}")
    say(f"Gates approved: {st.get('gates', {})}")
    if p["renders"].exists():
        for g in sorted(p["renders"].iterdir()):
            for d in sorted(g.iterdir()):
                if d.is_dir():
                    say(f"{g.name}/{d.name}: {len(list(d.glob('*.png')))} frame(s)")
