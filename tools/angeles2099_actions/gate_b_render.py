"""Fixed Gate B frame renderer. Builds the full locked animation; never exposes a frame range."""
import hashlib
import importlib.metadata as md
import json
import os
import shutil
import sys
import time
from pathlib import Path

import gate_a as A

FIRST, COUNT = 285, 12
CHUNKS = tuple({"index": i, "first": FIRST + i * 4, "last": FIRST + i * 4 + 3, "count": 4} for i in range(3))
PNG_MAX = 9_000_000


def chunk(index):
    if type(index) is not int or index not in (0, 1, 2):
        raise ValueError("Only Gate B chunks 0, 1 and 2 are allowed")
    return dict(CHUNKS[index])


def key(preflight):
    return hashlib.sha256((preflight["renderFingerprint"] + A.digest(Path(__file__)) + ":cycles16").encode()).hexdigest()


def cached(entry, folder, fingerprint, frames):
    try:
        path = folder / f"frame_{entry['frame']:04d}.png"
        A.assert_settings(entry["settings"], 16)
        return (entry["frame"] in frames and entry["fingerprint"] == fingerprint and not path.is_symlink()
                and path.resolve().is_relative_to(folder.resolve()) and path.stat().st_size <= PNG_MAX
                and A.digest(path) == entry["sha256"])
    except (KeyError, TypeError, ValueError, OSError, RuntimeError):
        return False


def render(source, out, index, resume=None):
    spec = chunk(index)
    frames = list(range(spec["first"], spec["last"] + 1))
    pre = A.preflight(source, out)
    pre["gate"] = "B"
    A.write_json(out / "preflight.json", pre)
    fingerprint = key(pre)
    report = {"schema": 1, "gate": "B", "sourceCommit": A.SOURCE, "chunk": spec,
              "fingerprint": fingerprint, "state": "rendering", "frames": [],
              "run": os.getenv("GITHUB_RUN_ID", "local"), "attempt": os.getenv("GITHUB_RUN_ATTEMPT", "1")}
    old = json.loads((resume / "manifest.json").read_text()) if resume and (resume / "manifest.json").is_file() else {}
    try:
        import bpy
        if bpy.app.version != A.BLENDER:
            raise RuntimeError("Blender must remain 4.5.14")
        pins = json.loads((source / A.PRODUCTION / "colab/config.json").read_text())["pins"]["wheels"]
        if any(md.version(p["name"]) != p["version"] for p in pins):
            raise RuntimeError("Installed versions differ from the approved pins")
        for frame in frames:
            previous = next((r for r in old.get("frames", []) if r.get("frame") == frame
                             and cached(r, resume, fingerprint, frames)), None)
            if previous:
                path = resume / f"frame_{frame:04d}.png"
                A.image_stats(bpy, path)  # Decode and reject malformed/non-finite/flat cached images.
                shutil.copy2(path, out / path.name)
                report["frames"].append(dict(previous, reused=True))
                A.write_json(out / "manifest.json", report)
        check_path = resume / "scene-check.json" if resume else None
        valid_check = (check_path and check_path.is_file() and old.get("sceneCheckSha256") == A.digest(check_path)
                       and json.loads(check_path.read_text()).get("ok"))
        if len(report["frames"]) == 4 and valid_check:
            shutil.copy2(check_path, out / "scene-check.json")
        else:
            sys.path.insert(0, str((source / A.PRODUCTION / "blender").resolve()))
            import angeles2099 as production
            started = time.perf_counter()
            scene_data = production.build("crest")  # All 600 keys, never only the requested frames.
            check = production.validate(scene_data)
            A.write_json(out / "scene-check.json", check)
            if not check.get("ok"):
                raise RuntimeError("Approved scene validation failed")
            report["buildAndValidationSeconds"] = time.perf_counter() - started
            production.set_device(scene_data["scene"], "CPU")
            have = {r["frame"] for r in report["frames"]}
            for frame in frames:
                if frame in have:
                    continue
                started = time.perf_counter()
                production.render_frames(scene_data, [frame], A.RESOLUTION, 16, out_dir=str(out))
                seconds = time.perf_counter() - started
                settings = A.settings_snapshot(scene_data["scene"])
                A.assert_settings(settings, 16)
                path = out / f"frame_{frame:04d}.png"
                if path.stat().st_size > PNG_MAX:
                    raise RuntimeError("PNG exceeded the reserved native-frame size")
                stats = A.image_stats(bpy, path)
                report["frames"].append({"frame": frame, "sha256": A.digest(path), "bytes": path.stat().st_size,
                                         "seconds": seconds, "settings": settings, "image": stats,
                                         "fingerprint": fingerprint, "originRun": report["run"],
                                         "originAttempt": report["attempt"], "reused": False})
                A.write_json(out / "manifest.json", report)
        if A.git(source, "status", "--porcelain", "--untracked-files=all", "--", str(A.PRODUCTION)):
            raise RuntimeError("Production files changed")
        report["sceneCheckSha256"] = A.digest(out / "scene-check.json")
        report["frames"].sort(key=lambda r: r["frame"])
        report["state"] = "rendered"
        return report
    except Exception as exc:
        report.update(state="failed", error=f"{type(exc).__name__}: {exc}")
        raise
    finally:
        A.write_json(out / "manifest.json", report)
