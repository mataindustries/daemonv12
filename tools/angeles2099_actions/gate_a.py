"""Bounded, CPU-only Gate A. Importing this module never imports Blender or renders."""
import argparse
import hashlib
import importlib.metadata
import json
import math
import os
import platform
import shutil
import struct
import subprocess
import sys
import time
import wave
from pathlib import Path

from plan import estimate

SOURCE = "2a3208d3679a32e9f5ced303d6bc8baa1a237071"
PRODUCTION = Path("productions/lowrider-2099")
PYTHON = (3, 11, 14)
BLENDER = (4, 5, 14)
FRAMES = (170, 330, 470)
REFERENCES = (170, 470)
RESOLUTION = (1080, 1920)
MAX_BYTES = 64_000_000
SCHEMA = 1


def digest(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n")
    tmp.replace(path)


def git(source, *args):
    return subprocess.check_output(["git", "-C", str(source), *args], text=True).strip()


def input_files(prod):
    return ([prod / "blender/angeles2099.py", prod / "colab/config.json",
             prod / "visual/sync/crest.cues.json", prod / "visual/sync/crest.events-24fps.json",
             prod / "review/music/crest.master.json", prod / "review/music/crest.wav"]
            + sorted((prod / "visual/specs").glob("*.json")))


def preflight(source, out):
    if git(source, "rev-parse", "HEAD") != SOURCE:
        raise RuntimeError("Production checkout is not approved commit " + SOURCE)
    if Path(git(source, "rev-parse", "--show-toplevel")).resolve() != source.resolve():
        raise RuntimeError("Source must be its own immutable production checkout")
    if git(source, "status", "--porcelain", "--untracked-files=all", "--", str(PRODUCTION)):
        raise RuntimeError("Approved production tree is modified or has untracked files")
    prod = source / PRODUCTION
    locks = json.loads((prod / "visual/specs/locks.json").read_text())
    master = json.loads((prod / "review/music/crest.master.json").read_text())
    wav = prod / "review/music/crest.wav"
    if locks["soundtrack"]["primary"] != "crest" or locks["crestline"]["version"] != "v3":
        raise RuntimeError("Expected locked CREST and CRESTLINE v3")
    if digest(wav) != locks["soundtrack"]["sha256"] or digest(wav) != master["wav"]["sha256"]:
        raise RuntimeError("Original CREST master is missing or changed")
    with wave.open(str(wav), "rb") as audio:
        audio_info = {"rate": audio.getframerate(), "channels": audio.getnchannels(),
                      "sampleWidth": audio.getsampwidth(), "samples": audio.getnframes()}
    if (audio_info["rate"], audio_info["channels"], audio_info["sampleWidth"]) != (44100, 2, 3):
        raise RuntimeError("Expected original 44.1 kHz / stereo / 24-bit PCM master")
    if audio_info["samples"] < 600 * 44100 // 24:
        raise RuntimeError("Master is too short for the approved film")
    config = json.loads((prod / "colab/config.json").read_text())
    pins = config["pins"]
    if pins["blenderVersion"] != "4.5.14" or pins["python"] != "3.11":
        raise RuntimeError("Approved Blender/Python pin changed")
    if sys.version_info[:3] != PYTHON:
        raise RuntimeError("Use exact Python 3.11.14, not " + platform.python_version())
    if platform.machine() != "x86_64" or platform.system() != "Linux":
        raise RuntimeError("Use the standard Linux x86_64 CPU runner")
    release = platform.freedesktop_os_release()
    if (os.getenv("GITHUB_ACTIONS") != "true" or os.getenv("RUNNER_ENVIRONMENT") != "github-hosted"
            or release.get("ID") != "ubuntu" or release.get("VERSION_ID") != "24.04"):
        raise RuntimeError("Gate A rendering requires a GitHub-hosted ubuntu-24.04 runner")
    inputs = {p.relative_to(prod).as_posix(): digest(p) for p in input_files(prod)}
    fingerprint = hashlib.sha256(json.dumps({
        "schema": SCHEMA, "source": SOURCE, "inputs": inputs, "pins": pins,
        "harnessSha256": digest(Path(__file__)),
        "python": PYTHON, "resolution": RESOLUTION, "engine": "CYCLES", "device": "CPU",
        "denoising": True, "motionBlur": True, "shutter": 0.5,
        "frameRangeIndependent": True,
    }, sort_keys=True).encode()).hexdigest()
    cpu = next((s.split(":", 1)[1].strip() for s in Path("/proc/cpuinfo").read_text().splitlines()
                if s.startswith("model name")), "unknown")
    report = {
        "schema": SCHEMA, "sourceCommit": SOURCE, "renderFingerprint": fingerprint,
        "inputSha256": inputs, "audio": audio_info, "python": platform.python_version(),
        "host": {"cpu": cpu, "logicalCPUs": os.cpu_count(), "platform": platform.platform(),
                 "runnerOS": os.getenv("RUNNER_OS"), "imageOS": os.getenv("ImageOS"),
                 "imageVersion": os.getenv("ImageVersion")},
        "runId": os.getenv("GITHUB_RUN_ID", "local"), "attempt": os.getenv("GITHUB_RUN_ATTEMPT", "1"),
        "automationCommit": os.getenv("GITHUB_SHA"), "gate": "A", "state": "preflight-passed",
        "renders": [], "comparisons": [], "approval": "pending human review",
    }
    write_json(out / "preflight.json", report)
    return report


def verify_wheels(source, wheel_dir):
    pins = json.loads((source / PRODUCTION / "colab/config.json").read_text())["pins"]["wheels"]
    expected = {w["file"] for w in pins}
    if {p.name for p in wheel_dir.iterdir()} != expected:
        raise RuntimeError("Wheel directory does not contain exactly the approved filenames")
    for pin in pins:
        if digest(wheel_dir / pin["file"]) != pin["sha256"]:
            raise RuntimeError("Wheel hash mismatch: " + pin["file"])
    req = Path(__file__).with_name("requirements.lock").read_text()
    wanted = "".join(f"{p['name']}=={p['version']} --hash=sha256:{p['sha256']}\n" for p in pins)
    if req != wanted:
        raise RuntimeError("requirements.lock differs from the approved wheel pins")
    print("All nine approved wheel filenames and SHA-256 hashes match", flush=True)


def png_header(path):
    with Path(path).open("rb") as f:
        h = f.read(33)
    if len(h) != 33 or h[:8] != b"\x89PNG\r\n\x1a\n" or h[12:16] != b"IHDR":
        raise RuntimeError("Invalid PNG: " + str(path))
    width, height, depth, colour = struct.unpack(">IIBB", h[16:26])
    if (width, height, depth) != (*RESOLUTION, 8) or colour not in (2, 6):
        raise RuntimeError("Expected native 1080x1920 8-bit RGB/RGBA PNG: " + str(path))


def pixels(bpy, path):
    import numpy as np
    png_header(path)
    image = bpy.data.images.load(str(path.resolve()), check_existing=False)
    try:
        if tuple(image.size) != RESOLUTION:
            raise RuntimeError("Blender decoded the wrong dimensions")
        rgb = np.array(image.pixels[:], dtype=np.float32).reshape(1920, 1080, 4)[..., :3]
        if not np.isfinite(rgb).all() or float(rgb.std()) < 1e-5:
            raise RuntimeError("Non-finite or flat image: " + str(path))
        return rgb
    finally:
        bpy.data.images.remove(image)


def image_stats(bpy, path):
    import numpy as np
    rgb = pixels(bpy, path)
    return {"width": 1080, "height": 1920, "finite": True,
            "meanLinearRGB": float(rgb.mean()), "stdLinearRGB": float(rgb.std()),
            "nearBlackFractionLinear": float(np.mean(np.max(rgb, axis=2) < 1e-4)),
            "nearWhiteFractionLinear": float(np.mean(np.min(rgb, axis=2) > 0.99))}


def compare(bpy, target, reference):
    import numpy as np
    a, b = pixels(bpy, target), pixels(bpy, reference)
    mse = float(np.mean((np.clip(a, 0, 1) - np.clip(b, 0, 1)) ** 2))
    return {"meanAbsoluteErrorLinear": float(np.mean(np.abs(a - b))),
            "psnrLinearDb": round(-10 * math.log10(max(mse, 1e-12)), 3),
            "note": "Decoded scene-linear RGB, clipped to 0..1 for PSNR. Descriptive only; human visual approval required."}


def render_path(frame, samples):
    if (samples == 16 and frame in FRAMES) or (samples == 128 and frame in REFERENCES):
        return f"samples{samples}/frame_{frame:04d}.png"
    raise ValueError("Outside the fixed Gate A smoke contract")


def valid_resume(entry, root, fingerprint):
    """Reject stale settings, unsafe paths, incomplete files and corrupted bytes."""
    try:
        path = render_path(entry["frame"], entry["samples"])
        file = root / path
        return (entry["path"] == path and not file.is_symlink()
                and file.resolve().is_relative_to(root.resolve())
                and entry["renderFingerprint"] == fingerprint
                and type(entry["seconds"]) in (int, float) and math.isfinite(entry["seconds"])
                and entry["seconds"] > 0 and file.is_file()
                and entry["sha256"] == digest(file))
    except (KeyError, ValueError, TypeError, OSError):
        return False


def settings_snapshot(scene):
    return {"engine": scene.render.engine, "device": scene.cycles.device,
            "resolution": [scene.render.resolution_x, scene.render.resolution_y],
            "percentage": scene.render.resolution_percentage, "samples": scene.cycles.samples,
            "denoising": scene.cycles.use_denoising, "denoiser": scene.cycles.denoiser,
            "denoisingGPU": scene.cycles.denoising_use_gpu,
            "motionBlur": scene.render.use_motion_blur, "shutter": scene.render.motion_blur_shutter,
            "fps": scene.render.fps, "fpsBase": scene.render.fps_base, "seed": scene.cycles.seed,
            "adaptiveSampling": scene.cycles.use_adaptive_sampling,
            "adaptiveThreshold": scene.cycles.adaptive_threshold,
            "viewTransform": scene.view_settings.view_transform, "look": scene.view_settings.look,
            "motionBlurPosition": scene.render.motion_blur_position}


def assert_settings(actual, samples):
    expected = {"engine": "CYCLES", "device": "CPU", "resolution": list(RESOLUTION), "percentage": 100,
                "samples": samples, "denoising": True, "denoiser": "OPENIMAGEDENOISE",
                "motionBlur": True, "shutter": 0.5, "fps": 24, "fpsBase": 1.0, "seed": 0,
                "denoisingGPU": False, "motionBlurPosition": "CENTER",
                "adaptiveSampling": True, "viewTransform": "AgX"}
    wrong = {k: [actual.get(k), v] for k, v in expected.items() if actual.get(k) != v}
    if wrong or abs(actual["adaptiveThreshold"] - 0.02) > 1e-6:
        raise RuntimeError("Render quality or approved source settings changed: " + str(wrong))


def report_files(out, report):
    write_json(out / "manifest.json", report)
    rows = [
        "# ANGELES//2099 — Gate A",
        "", f"Status: **{report['state']}**. Human visual approval: **pending**.",
        f"Approved production: `{SOURCE}`. No later gate is authorized.",
        "", "Native 1080×1920 PNGs; Cycles CPU; 16 samples; OIDN; original 0.5 shutter motion blur.",
        "Matching 128-sample references are comparisons, not replacements for the requested setting.",
        "", f"Runner: {report['host']['cpu']} ({report['host']['logicalCPUs']} logical CPUs).",
        f"Python: {report['python']}; Blender: {report.get('blender', 'not started')}.",
        f"Scene build: {report.get('buildSeconds', 'pending')} s; validation: {report.get('validationSeconds', 'pending')} s.",
        "", "| Frame | Samples | Render seconds | Origin run/attempt | Result |",
        "|---|---|---|---|---|",
    ]
    for r in report["renders"]:
        rows.append(f"| {r['frame']} | {r['samples']} | {r['seconds']:.2f} | {r['originRun']}/{r['originAttempt']} | {'reused' if r.get('reused') else 'rendered'} |")
    rows.extend(["", "Open comparison.html beside this manifest and the PNG folders for paired visual inspection.",
                 "Compare chrome, tyre spokes, candy paint, haze, skyline noise and motion blur at 100%.",
                 "PSNR/MAE describe the sample change; they do not grant creative approval."])
    for c in report["comparisons"]:
        rows.append(f"- Frame {c['frame']}, 16 vs 128: linear PSNR {c['psnrLinearDb']} dB; linear MAE {c['meanAbsoluteErrorLinear']:.6f}.")
    if "projection" in report:
        p = report["projection"]
        rows.extend(["", "Illustrative future teaser projection from sparse smoke frames, including 25% padding:",
                     f"- 10 workers: {p['runnerMinutesAtMean']:.1f} total runner minutes; {p['renderWallMinutesAtWorst']:.1f} min render wall at slowest measured frame.",
                     "- Excludes dependency setup, queueing, encoding and upload. Shot costs vary; this is not an authorization.",
                     "- Teaser: exactly 201 frames / 24 = 8.375 s; master begins at 285 / 24 = 11.875 s. Sync is untested until Gate B."])
    if report.get("error"):
        rows.extend(["", "Failure: " + report["error"]])
    rows.extend(["", "Retain the PNGs and manifest before the seven-day artifact expiry. No .blend, wheels or master audio are uploaded.",
                 "Approved source and audio hashes, actual settings, per-frame hashes and origin timings are in manifest.json."])
    (out / "report.md").write_text("\n".join(rows) + "\n")
    panels = []
    for frame in REFERENCES:
        panels.append(f'<h2>Frame {frame}</h2><div class="pair"><figure><figcaption>16 samples</figcaption><img src="samples16/frame_{frame:04d}.png"></figure><figure><figcaption>128-sample reference</figcaption><img src="samples128/frame_{frame:04d}.png"></figure></div>')
    panels.append('<h2>Teaser action — frame 330, 16 samples</h2><img src="samples16/frame_0330.png">')
    (out / "comparison.html").write_text(
        '<!doctype html><meta charset="utf-8"><title>ANGELES2099 Gate A</title>'
        '<style>body{background:#181818;color:#eee;font:16px system-ui;margin:24px}'
        '.pair{display:flex;gap:16px}figure{margin:0}img{width:540px;height:960px;object-fit:contain}'
        'body.native img{width:1080px;height:1920px}button{padding:10px}</style>'
        '<h1>ANGELES//2099 — Gate A visual review</h1><p>Pending human review. '
        'Source 2a3208d, native 1080×1920, original animation and motion blur. '
        'Images show different sample counts at the same frame and camera.</p>'
        '<button onclick="document.body.classList.toggle(\'native\')">Toggle native 100% pixels</button>'
        + "".join(panels))


def render(source, out, resume):
    started = time.perf_counter()
    report = preflight(source, out)
    try:
        import bpy
        if bpy.app.version != BLENDER:
            raise RuntimeError("Expected Blender 4.5.14, got " + bpy.app.version_string)
        pins = json.loads((source / PRODUCTION / "colab/config.json").read_text())["pins"]["wheels"]
        for pin in pins:
            if importlib.metadata.version(pin["name"]) != pin["version"]:
                raise RuntimeError("Installed dependency differs from pin: " + pin["name"])
        report["blender"] = bpy.app.version_string
        sys.path.insert(0, str((source / PRODUCTION / "blender").resolve()))
        import angeles2099 as production
        # Build ALL 600 animation keys. Sparse construction changes interpolation and motion blur.
        t = time.perf_counter()
        scene_data = production.build("crest")
        report["buildSeconds"] = round(time.perf_counter() - t, 3)
        t = time.perf_counter()
        validation = production.validate(scene_data)
        write_json(out / "scene-check.json", validation)
        report["validationSeconds"] = round(time.perf_counter() - t, 3)
        if not validation.get("ok"):
            raise RuntimeError("Approved scene checks failed; rendering refused")
        scene = scene_data["scene"]
        production.set_device(scene, "CPU")
        scene.render.resolution_x, scene.render.resolution_y = RESOLUTION
        scene.render.resolution_percentage = 100
        scene.cycles.samples = 16
        assert_settings(settings_snapshot(scene), 16)
        report["state"] = "rendering"
        report_files(out, report)
        old = json.loads((resume / "manifest.json").read_text()) if (resume / "manifest.json").is_file() else {}
        prior = old.get("renders", []) if old.get("schema") == SCHEMA else []
        for samples, frames in ((16, FRAMES), (128, REFERENCES)):
            for frame in frames:
                path = render_path(frame, samples)
                destination = out / path
                destination.parent.mkdir(parents=True, exist_ok=True)
                entry = next((r for r in prior if r.get("frame") == frame and r.get("samples") == samples
                              and valid_resume(r, resume, report["renderFingerprint"])), None)
                # Decode cached pixels before accepting a matching checksum.
                if entry:
                    stats = image_stats(bpy, resume / path)
                    assert_settings(entry["settings"], samples)
                    shutil.copy2(resume / path, destination)
                    entry = dict(entry, reused=True, image=stats)
                else:
                    t = time.perf_counter()
                    production.render_frames(scene_data, [frame], RESOLUTION, samples, out_dir=str(destination.parent))
                    seconds = time.perf_counter() - t
                    actual = settings_snapshot(scene)
                    assert_settings(actual, samples)
                    entry = {"frame": frame, "samples": samples, "path": path, "seconds": seconds,
                             "originRun": report["runId"], "originAttempt": report["attempt"], "reused": False,
                             "camera": scene.camera.name, "settings": actual,
                             "renderFingerprint": report["renderFingerprint"], "sha256": digest(destination),
                             "image": image_stats(bpy, destination)}
                report["renders"].append(entry)
                report_files(out, report)  # Atomic manifest per completed PNG, even if the next frame fails.
                if sum(p.stat().st_size for p in out.rglob("*") if p.is_file()) > MAX_BYTES:
                    raise RuntimeError("Gate A exceeded its 64 MB reservation; completed PNGs preserved")
        for frame in REFERENCES:
            report["comparisons"].append(dict(frame=frame, **compare(
                bpy, out / render_path(frame, 16), out / render_path(frame, 128))))
        # Verify nothing wrote to or altered the approved production tree.
        if git(source, "status", "--porcelain", "--untracked-files=all", "--", str(PRODUCTION)):
            raise RuntimeError("Production source changed during render")
        report["projection"] = estimate(report["buildSeconds"] + report["validationSeconds"],
                                        [r["seconds"] for r in report["renders"] if r["samples"] == 16])
        report["state"] = "rendered-awaiting-visual-review"
    except Exception as exc:
        report["state"] = "failed"
        report["error"] = f"{type(exc).__name__}: {exc}"[:1000]
        raise
    finally:
        report["harnessWallSeconds"] = round(time.perf_counter() - started, 3)
        report_files(out, report)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("command", choices=("preflight", "wheels", "render"))
    ap.add_argument("--source", type=Path, required=True)
    ap.add_argument("--out", type=Path)
    ap.add_argument("--wheel-dir", type=Path)
    ap.add_argument("--resume", type=Path)
    a = ap.parse_args()
    if a.command == "wheels":
        if not a.wheel_dir:
            ap.error("wheels needs --wheel-dir")
        verify_wheels(a.source, a.wheel_dir)
    else:
        if not a.out:
            ap.error("preflight/render needs --out")
        a.out.mkdir(parents=True, exist_ok=True)
        if a.command == "preflight":
            preflight(a.source, a.out)
        else:
            render(a.source, a.out, a.resume or a.out / "no-resume")


if __name__ == "__main__":
    main()

