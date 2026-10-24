#!/usr/bin/env python3
"""Production orchestration only. The approved creative checkout is never edited.

Checkpoints are immutable assets of a DRAFT release; this script never publishes it.
No Actions artifacts, caches, larger runners, or external compute are used.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import signal
import subprocess
import sys
import tarfile
import time
import urllib.parse
import urllib.request

SOURCE = "61bd2e1f8d28378203586a6a170a791bc9408e1d"
REPO = "mataindustries/daemonv12"
TAG = "circuit-v2-production-checkpoints-61bd2e1"
BRANCH = "production/the-circuit-v2-master-61bd2e1"
ROOT = Path(os.environ.get("CIRCUIT_SOURCE", "source")).resolve()
EXP = ROOT / "experiments/morph-commercial-02"
WORK = EXP / "work"
STORE = WORK / "production"
MASTER = EXP / "master"
SETTINGS = {"variant": "master", "width": 1080, "height": 1920, "samples": 16,
            "blender": "4.3.0", "device": "CPU", "threads": 4, "seed": 11062026}
REQUIRED_RECHECKS = {0, 240, 444, 453}
FROZEN = ["experiments/morph-commercial-02/" + n for n in
          ("PRODUCTION.md", "README.md", "build.sh", "scene.py", "render.py", "finish.py",
           "verify.py", "choreography.py")] + [
    "experiments/morph-commercial-01/scene.py", "experiments/morph-commercial-01/verify.py",
    "experiments/morph-commercial-01/mapping.json",
    "experiments/morph-commercial-01/audio/circuit-reference.wav",
    "experiments/morph-06/audio/b/cable-beast-b.wav"]


def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def sha(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def write_json(path, value):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def run(args, *, cwd=ROOT, log=None, timeout=3600):
    print("RUN", " ".join(map(str, args)), flush=True)
    if log:
        Path(log).parent.mkdir(parents=True, exist_ok=True)
        try:
            with Path(log).open("ab") as stream:
                subprocess.run(list(map(str, args)), cwd=cwd, stdout=stream,
                               stderr=subprocess.STDOUT, check=True, timeout=timeout)
        except BaseException:
            # Blender's useful exception is otherwise hidden in a runner-local log.
            print(f"FAILED SUBPROCESS LOG TAIL: {log}", flush=True)
            print(Path(log).read_text(errors="replace")[-16000:], flush=True)
            raise
    else:
        subprocess.run(list(map(str, args)), cwd=cwd, check=True, timeout=timeout)


def capture(args, *, cwd=ROOT):
    return subprocess.check_output(list(map(str, args)), cwd=cwd)


def api(endpoint, *args):
    return json.loads(capture(["gh", "api", endpoint, *args]))


def release(optional=False):
    # /releases/tags/{tag} only resolves published releases. Authenticated list
    # includes drafts, whose temporary HTML URL can still use an untagged name.
    matches = []
    for page in range(1, 20):
        entries = api(f"repos/{REPO}/releases?per_page=100&page={page}")
        matches.extend(entry for entry in entries if entry["tag_name"] == TAG)
        if len(entries) < 100:
            break
    else:
        raise RuntimeError("Unexpectedly many releases while looking up draft checkpoints")
    require(len(matches) <= 1, "Duplicate checkpoint drafts require investigation")
    if not matches:
        if optional:
            return None
        raise RuntimeError("Missing draft checkpoint release")
    result = matches[0]
    require(result["draft"] is True, "Checkpoint release must remain DRAFT")
    require(result["tag_name"] == TAG and result["target_commitish"] == SOURCE,
            "Checkpoint release target differs from the approved source")
    return result


def assets():
    rel = release()
    # Paginate: chunk, recovery, batch and final assets can exceed the default page.
    out = {}
    for page in range(1, 20):
        entries = api(f"repos/{REPO}/releases/{rel['id']}/assets?per_page=100&page={page}")
        for entry in entries:
            require(entry["name"] not in out, "Duplicate release asset name")
            out[entry["name"]] = entry
        if len(entries) < 100:
            return out
    raise RuntimeError("Unexpectedly many release assets")


def download(entry, dest):
    release()  # Never rely on a cached draft-state observation.
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_suffix(dest.suffix + ".part")
    with part.open("wb") as stream:
        subprocess.run(["gh", "api", f"repos/{REPO}/releases/assets/{entry['id']}",
                        "-H", "Accept: application/octet-stream"], stdout=stream, check=True)
    require(part.stat().st_size == entry["size"], "Truncated checkpoint download")
    digest = entry.get("digest")
    if digest:
        require(digest == "sha256:" + sha(part), "Release asset digest mismatch")
    part.replace(dest)


def upload(path, known=None):
    path = Path(path)
    require(path.stat().st_size < 2 * 1024**3, "Release asset exceeds 2 GiB")
    current = known if known is not None else assets()
    require(path.name not in current, f"Refusing to overwrite durable checkpoint {path.name}")
    rel = release()
    # Address the release by ID, never by a draft's unpublished tag. Stream the
    # file directly to GitHub's documented uploads host; credentials stay in memory.
    url = (f"https://uploads.github.com/repos/{REPO}/releases/{rel['id']}/assets?name=" +
           urllib.parse.quote(path.name, safe=""))
    headers = {"Authorization": "Bearer " + os.environ["GH_TOKEN"],
               "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
               "Content-Type": "application/octet-stream", "Content-Length": str(path.stat().st_size),
               "User-Agent": "circuit-v2-production"}
    with path.open("rb") as stream:
        request = urllib.request.Request(url, data=stream, headers=headers, method="POST")
        with urllib.request.urlopen(request, timeout=1800) as response:
            result = json.load(response)
    require(result["name"] == path.name and result["size"] == path.stat().st_size and
            result["state"] == "uploaded", "Checkpoint upload did not finish")
    if result.get("digest"):
        require(result["digest"] == "sha256:" + sha(path), "Uploaded checkpoint digest differs")
    print(f"UPLOADED {path.name} ({path.stat().st_size} bytes)", flush=True)
    release()


def source_hashes():
    return {p: sha(ROOT / p) for p in FROZEN}


def check_source():
    require(capture(["git", "rev-parse", "HEAD"]).decode().strip() == SOURCE,
            "Execution checkout is not the exact approved handoff")
    require(not capture(["git", "diff", "--name-only"]).strip(), "Creative tracked files changed")
    for p in FROZEN:
        expected = capture(["git", "show", f"{SOURCE}:{p}"])
        require(hashlib.sha256(expected).hexdigest() == sha(ROOT / p), f"Frozen source differs: {p}")
    STORE.mkdir(parents=True, exist_ok=True)
    return source_hashes()


def machine():
    return {"platform": platform.platform(), "python": platform.python_version(),
            "cpu": capture(["lscpu"]).decode(), "run_id": os.environ.get("GITHUB_RUN_ID"),
            "run_attempt": os.environ.get("GITHUB_RUN_ATTEMPT"),
            "runner": os.environ.get("RUNNER_NAME"), "runner_arch": os.environ.get("RUNNER_ARCH")}


def image_record(path):
    from PIL import Image
    with Image.open(path) as im:
        require(im.size == (1080, 1920) and im.mode == "RGB", f"Wrong PNG format: {path}")
        rgb = hashlib.sha256(im.tobytes()).hexdigest()
    return {"sha256": sha(path), "rgb_sha256": rgb, "width": 1080, "height": 1920, "mode": "RGB"}


def pack(path, files, kind, extra=None):
    """Each archive authenticates its exact file bytes and frozen render provenance."""
    manifest = {"schema": 1, "kind": kind, "source_commit": SOURCE,
                "settings": SETTINGS, "source_sha256": source_hashes(),
                "files": {name: {"sha256": sha(file), "bytes": Path(file).stat().st_size}
                          for name, file in files.items()}, **(extra or {})}
    manifest_path = STORE / (Path(path).name + ".manifest.json")
    write_json(manifest_path, manifest)
    with tarfile.open(path, "w:gz", compresslevel=1) as archive:
        archive.add(manifest_path, arcname="manifest.json")
        for name, file in files.items():
            archive.add(file, arcname=name)
    return manifest


def unpack(path, dest, kind, allowed):
    dest = Path(dest)
    with tarfile.open(path, "r:gz") as archive:
        members = archive.getmembers()
        require(all(m.isfile() for m in members), "Checkpoint archive contains non-files")
        names = [m.name for m in members]
        require(len(names) == len(set(names)) and "manifest.json" in names, "Invalid archive entries")
        manifest = json.load(archive.extractfile("manifest.json"))
        require(manifest["source_commit"] == SOURCE and manifest["settings"] == SETTINGS,
                "Checkpoint render settings/source differ")
        require(manifest["source_sha256"] == source_hashes(), "Checkpoint frozen-source hashes differ")
        require(manifest["kind"] == kind, "Unexpected checkpoint type")
        require(set(names) == set(manifest["files"]) | {"manifest.json"}, "Archive file manifest mismatch")
        require(set(manifest["files"]) <= set(allowed), "Unexpected archive path")
        for name, record in manifest["files"].items():
            target = dest / name
            require(target.resolve().is_relative_to(dest.resolve()), "Unsafe archive path")
            target.parent.mkdir(parents=True, exist_ok=True)
            tmp = target.with_name(target.name + ".restore-part")
            with archive.extractfile(name) as src, tmp.open("wb") as dst:
                shutil.copyfileobj(src, dst)
            require(tmp.stat().st_size == record["bytes"] and sha(tmp) == record["sha256"],
                    f"Checkpoint file checksum differs: {name}")
            if target.exists():
                require(sha(target) == record["sha256"], f"Conflicting completed frame/file: {name}")
                tmp.unlink()
            else:
                tmp.replace(target)
    return manifest


def restore_base(known=None):
    known = known if known is not None else assets()
    require("scene-base.tar.gz" in known, "Missing immutable base scene")
    path = STORE / "scene-base.tar.gz"
    download(known[path.name], path)
    return unpack(path, WORK, "scene-base", {"circuit-v2.blend", "scene-v2.json"})


DRIVER = r'''
import bpy,json,runpy,sys
from pathlib import Path
blend,script,*args=sys.argv[1:]
bpy.ops.wm.open_mainfile(filepath=blend)
s=bpy.context.scene
s.render.threads_mode='FIXED';s.render.threads=4
assert bpy.app.version[:3]==(4,3,0),bpy.app.version_string
assert s.render.engine=='CYCLES' and s.cycles.device=='CPU'
assert s.cycles.seed==11062026 and s.cycles.denoiser=='OPENIMAGEDENOISE'
assert s.cycles.use_denoising and s.render.use_motion_blur and s.render.motion_blur_shutter==0.5
assert s.render.use_persistent_data
assert s.view_settings.view_transform=='AgX' and s.view_settings.look=='AgX - Medium High Contrast'
print('PRODUCTION_RENDER_SETTINGS',json.dumps({'blender':bpy.app.version_string,'threads':s.render.threads,'device':s.cycles.device,'seed':s.cycles.seed}),flush=True)
sys.argv=[script,*args]
runpy.run_path(script,run_name='__main__')
'''


def render_frames(frames, out, log):
    spec = ",".join(map(str, frames))
    args = ["--variant", "master", "--width", "1080", "--samples", "16", "--frames", spec,
            "--out", str(out), "--resume"]
    run([sys.executable, "-c", DRIVER, WORK / "circuit-v2.blend", EXP / "render.py", *args],
        cwd=EXP, log=log, timeout=5400)


def chunk_frames(batch):
    lo, hi = batch * 57, (batch + 1) * 57
    return [list(range(start, min(start + 6, hi))) for start in range(lo, hi, 6)]


def chunk_name(frames):
    return f"frames-{frames[0]:03d}-{frames[-1]:03d}.tar.gz"


def png_name(f):
    return f"raw-{f:03d}.png"


def restore_chunk(entry, frames, out, kind="frame-chunk"):
    path = STORE / entry["name"]
    download(entry, path)
    manifest = unpack(path, out, kind, {png_name(f) for f in frames} |
                      {f"recheck/{png_name(f)}" for f in frames})
    require(manifest["frames"] == frames, "Chunk covers incorrect frames")
    for f in frames:
        require(image_record(out / png_name(f)) == manifest["images"][str(f)], "Restored RGB checksum differs")
    for f, record in manifest.get("rechecks", {}).items():
        require(int(f) in frames and image_record(out / "recheck" / png_name(int(f))) == record,
                "Restored recheck checksum differs")
        require(record["rgb_sha256"] == manifest["images"][f]["rgb_sha256"], "Certified recheck differs")
    return manifest


def checkpoint(frames, out, name, kind="frame-chunk", known=None, rechecks=()):
    path = STORE / name
    files = {png_name(f): out / png_name(f) for f in frames}
    files.update({f"recheck/{png_name(f)}": out / "recheck" / png_name(f) for f in rechecks})
    manifest = pack(path, files, kind,
                    {"frames": frames, "images": {str(f): image_record(out / png_name(f)) for f in frames},
                     "rechecks": {str(f): image_record(out / "recheck" / png_name(f)) for f in rechecks},
                     "machine": machine()})
    upload(path, known)
    return manifest


def recheck_frames(batch):
    frames = set(range(batch * 57, (batch + 1) * 57))
    return sorted({min(frames), max(frames)} | ((REQUIRED_RECHECKS | {395, 396}) & frames))


def preflight():
    check_source()
    repo = api(f"repos/{REPO}")
    require(repo["private"] is False and repo.get("visibility") == "public", "Free standard public-repository compute is required")
    require(os.environ.get("RUNNER_OS") == "Linux" and os.environ.get("RUNNER_ARCH") == "X64", "Unexpected standard runner platform")
    require(capture(["git", "ls-remote", "origin", f"refs/heads/{BRANCH}"]).decode().split()[0] == SOURCE,
            "Production branch must begin at the approved handoff before rendering")
    rel = release(optional=True)
    if rel is None:
        api(f"repos/{REPO}/releases", "--method", "POST", "-f", f"tag_name={TAG}",
            "-f", f"target_commitish={SOURCE}", "-F", "draft=true", "-F", "prerelease=false",
            "-f", "name=THE CIRCUIT V2 private production checkpoints — DO NOT PUBLISH",
            "-f", "body=Unpublished production checkpoints. Approved creative source is frozen. Never publish this release.")
    known = assets()
    if "scene-base.tar.gz" in known:
        restore_base(known)
        print("Restored immutable base; no scene rebuild", flush=True)
    else:
        run([sys.executable, EXP / "scene.py"], cwd=EXP, log=WORK / "scene.log", timeout=1800)
        path = STORE / "scene-base.tar.gz"
        pack(path, {n: WORK / n for n in ("circuit-v2.blend", "scene-v2.json")}, "scene-base",
             {"machine": machine(), "scene_log_sha256": sha(WORK / "scene.log")})
        upload(path, known)
    print("PREFLIGHT_PASS: exact frozen source; draft checkpoint storage; immutable scene ready", flush=True)


def render_batch(batch):
    require(0 <= batch < 8, "Invalid batch")
    check_source()
    known = assets()
    base = restore_base(known)
    out = WORK / "master"
    out.mkdir(exist_ok=True)
    log = STORE / f"batch-{batch}.log"
    chunks = chunk_frames(batch)
    batch_frames = [f for chunk in chunks for f in chunk]
    manifests = []
    required = set(recheck_frames(batch))
    for f in batch_frames:
        name = f"recovery-frame-{f:03d}.tar.gz"
        if name in known:
            restore_chunk(known[name], [f], out, "recovery-frame")

    def interrupted(signum, frame):
        raise InterruptedError(f"Runner received signal {signum}")

    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    current = []
    try:
        for chunk in chunks:
            current = chunk
            name = chunk_name(chunk)
            if name in known:
                manifest = restore_chunk(known[name], chunk, out)
                print("RESUMED", name, flush=True)
            else:
                render_frames(chunk, out, log)
                checks = sorted(required & set(chunk))
                for f in checks:
                    render_frames([f], out / "recheck", STORE / f"batch-{batch}-recheck.log")
                    require(image_record(out / png_name(f))["rgb_sha256"] ==
                            image_record(out / "recheck" / png_name(f))["rgb_sha256"],
                            f"Independent original-runner re-render differs at {f}")
                manifest = checkpoint(chunk, out, name, known=known, rechecks=checks)
                print("CHECKPOINTED", name, flush=True)
            manifests.append(manifest)
            current = []
    except BaseException:
        # Best effort on a catchable failure. A hard VM kill can lose the last in-flight chunk.
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        for f in current:
            path = out / png_name(f)
            name = f"recovery-frame-{f:03d}.tar.gz"
            if path.exists() and name not in known:
                try:
                    checks = [f] if f in required and (out / "recheck" / png_name(f)).exists() else []
                    checkpoint([f], out, name, "recovery-frame", known, rechecks=checks)
                except Exception as exc:
                    print(f"Recovery upload failed for frame {f}: {exc}", flush=True)
        raise

    # Rechecks travel inside the original runner's durable frame chunk. Recovery
    # validates this prior evidence rather than re-rendering noise on another CPU.
    rechecks = sorted(required)
    reout = out / "recheck"
    for f in rechecks:
        require(image_record(out / png_name(f))["rgb_sha256"] ==
                image_record(reout / png_name(f))["rgb_sha256"], f"Certified recheck differs at {f}")
    name = f"batch-{batch}-verification.tar.gz"
    if name in known:
        path, dest = STORE / name, STORE / f"completed-batch-{batch}"
        download(known[name], path)
        allowed = {f"recheck/{png_name(f)}" for f in rechecks} | {
            f"batch-{batch}.json", f"batch-{batch}.log", f"batch-{batch}-recheck.log"}
        unpack(path, dest, "batch-verification", allowed)
        completed = json.loads((dest / f"batch-{batch}.json").read_text())
        require(completed["status"] == "PASS" and completed["frames"] == batch_frames and
                completed["source_sha256"] == source_hashes() and completed["base_files"] == base["files"] and
                completed["settings"] == SETTINGS and set(map(int, completed["rechecks"])) == required,
                "Completed batch report differs")
        for f in rechecks:
            require(image_record(dest / "recheck" / png_name(f)) == completed["rechecks"][str(f)] and
                    completed["rechecks"][str(f)]["rgb_sha256"] == image_record(out / png_name(f))["rgb_sha256"],
                    "Completed original-machine evidence differs")
        print(f"BATCH_ALREADY_PASS {batch}: original runner checks restored without re-render", flush=True)
        return
    report = {"status": "PASS", "batch": batch, "frames": batch_frames,
              "chunks": [{"frames": m["frames"], "images": m["images"], "machine": m["machine"]} for m in manifests],
              "rechecks": {str(f): image_record(reout / png_name(f)) for f in rechecks},
              "source_commit": SOURCE, "source_sha256": source_hashes(), "settings": SETTINGS,
              "base_files": base["files"], "machine": machine(),
              "recheck_scope": "Same runner, Blender build, four threads and pristine base scene; isolated frame bake."}
    report_path = STORE / f"batch-{batch}.json"
    write_json(report_path, report)
    name = f"batch-{batch}-verification.tar.gz"
    # An immutable completed batch report is reused on retries after validating its content.
    if name not in known:
        files = {f"recheck/{png_name(f)}": reout / png_name(f) for f in rechecks}
        files.update({f"batch-{batch}.json": report_path})
        for label in (f"batch-{batch}.log", f"batch-{batch}-recheck.log"):
            if (STORE / label).exists():
                files[label] = STORE / label
        path = STORE / name
        pack(path, files, "batch-verification")
        upload(path, known)
    print(f"BATCH_PASS {batch}: {batch_frames[0]}-{batch_frames[-1]}; {len(rechecks)} independent spot checks", flush=True)


def canonical_audio(video):
    source = ROOT / "experiments/morph-commercial-01/audio/circuit-reference.wav"
    actual, expected = STORE / "actual.aac", STORE / "canonical.aac"
    run(["ffmpeg", "-y", "-v", "error", "-i", video, "-map", "0:a:0", "-c:a", "copy", "-f", "adts", actual])
    run(["ffmpeg", "-y", "-v", "error", "-i", source, "-map", "0:a:0", "-c:a", "aac",
         "-b:a", "256k", "-ar", "44100", "-f", "adts", expected])
    require(actual.read_bytes() == expected.read_bytes(), "Muxed AAC differs from canonical unchanged source encode")
    return {"status": "PASS", "canonical_aac_sha256": sha(expected), "muxed_aac_sha256": sha(actual),
            "source_pcm_sha256": sha(source), "processing": "No gain, fades, filters, resampling or composition changes."}


def delivery_files():
    names = ["the-circuit-v2-master.mp4", "the-circuit-v2-master.frames.json", "contact-sheet.jpg",
             "verification.json", "VERIFICATION.md", "production.json", "SHA256SUMS"]
    return {name: MASTER / name for name in names} | {
        "frames/" + p.name: p for p in sorted((MASTER / "frames").glob("*.png"))}


def push_delivery():
    run(["git", "fetch", "origin", f"refs/heads/{BRANCH}"])
    remote = capture(["git", "rev-parse", "FETCH_HEAD"]).decode().strip()
    run(["git", "merge-base", "--is-ancestor", SOURCE, remote])
    changed = capture(["git", "diff", "--name-only", SOURCE, remote]).decode().splitlines()
    require(all(p.startswith("experiments/morph-commercial-02/master/") for p in changed),
            "Production branch contains unexpected source changes")
    target = STORE / "delivery-checkout"
    run(["git", "worktree", "add", "--detach", target, remote])
    dest = target / "experiments/morph-commercial-02/master"
    for name, path in delivery_files().items():
        (dest / name).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dest / name)
    run(["git", "config", "user.name", "github-actions[bot]"], cwd=target)
    run(["git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], cwd=target)
    run(["git", "add", "--", "experiments/morph-commercial-02/master"], cwd=target)
    staged = capture(["git", "diff", "--cached", "--name-only"], cwd=target).decode().splitlines()
    require(all(p.startswith("experiments/morph-commercial-02/master/") for p in staged), "Unexpected staged file")
    if staged:
        run(["git", "commit", "-m", "production(circuit-v2): deliver verified full-resolution master"], cwd=target)
        run(["git", "push", "origin", f"HEAD:refs/heads/{BRANCH}"], cwd=target, timeout=1800)
    return capture(["git", "rev-parse", "HEAD"], cwd=target).decode().strip()


def finish():
    check_source()
    known = assets()
    base = restore_base(known)
    out, reout = WORK / "master", WORK / "master-recheck"
    covered, reports = [], []
    for batch in range(8):
        for chunk in chunk_frames(batch):
            name = chunk_name(chunk)
            require(name in known, f"Missing durable chunk {name}")
            restore_chunk(known[name], chunk, out)
            covered.extend(chunk)
        name = f"batch-{batch}-verification.tar.gz"
        require(name in known, f"Missing batch independent verification {batch}")
        path, dest = STORE / name, STORE / f"verified-batch-{batch}"
        download(known[name], path)
        allowed = {f"recheck/{png_name(f)}" for f in range(batch * 57, (batch + 1) * 57)} | {
            f"batch-{batch}.json", f"batch-{batch}.log", f"batch-{batch}-recheck.log"}
        unpack(path, dest, "batch-verification", allowed)
        report = json.loads((dest / f"batch-{batch}.json").read_text())
        require(report["status"] == "PASS" and report["batch"] == batch and
                report["frames"] == list(range(batch * 57, (batch + 1) * 57)), "Invalid batch coverage")
        require(report["source_sha256"] == source_hashes() and report["settings"] == SETTINGS and
                report["base_files"] == base["files"], "Batch provenance differs")
        required = set(recheck_frames(batch))
        require(set(map(int, report["rechecks"])) == required, "Missing independent boundary/required checks")
        for f in required:
            original = image_record(out / png_name(f))
            repeat = image_record(dest / "recheck" / png_name(f))
            require(original["rgb_sha256"] == repeat["rgb_sha256"] == report["rechecks"][str(f)]["rgb_sha256"],
                    f"Independent batch check differs: {f}")
            reout.mkdir(exist_ok=True)
            shutil.copy2(dest / "recheck" / png_name(f), reout / png_name(f))
        reports.append(report)
    require(covered == list(range(456)) and len(set(covered)) == 456, "Overlapping, missing or reordered primary frames")
    require({p.name for p in out.glob("raw-*.png")} == {png_name(f) for f in range(456)}, "Unexpected frame files")
    for f in range(456):
        image_record(out / png_name(f))
    video = MASTER / "the-circuit-v2-master.mp4"
    crf = None
    for candidate in (16, 17, 18):
        run([sys.executable, EXP / "finish.py", "--kind", "master", "--frames", out,
             "--output", video, "--stills", MASTER / "frames", "--crf", str(candidate)], cwd=EXP, timeout=3600)
        crf = candidate
        if video.stat().st_size <= 95_000_000:
            break
    run([sys.executable, EXP / "verify.py", "--kind", "master", "--frames", out,
         "--recheck", reout], cwd=EXP, timeout=2400)
    require(json.loads((MASTER / "verification.json").read_text())["status"] == "PASS", "Master verifier did not PASS")
    audio = canonical_audio(video)
    encoder = json.loads((MASTER / "the-circuit-v2-master.frames.json").read_text())
    require(list(map(int, encoder["finishedFrameSha256RGB"])) == list(range(480)), "Encoder frame ordering differs")
    production = {"status": "PASS", "source_commit": SOURCE, "source_sha256": source_hashes(),
                  "settings": SETTINGS, "scene_checkpoint": base["files"], "batches": reports,
                  "primary_frames_exactly_once": list(range(456)), "terminal_frames": "456-479 exact black; existing verifier PASS",
                  "required_rechecks": sorted(REQUIRED_RECHECKS),
                  "batch_boundaries": [[i * 57 - 1, i * 57] for i in range(1, 8)],
                  "boundary_checks": "Both sides of all seven matrix boundaries, prescribed frames 0/240/444/453, and internal clarity boundary 395/396 independently re-rendered on original runner; identical RGB hashes.",
                  "shutter_key_continuity": "Each frame bakes independent shutter-open/centre/close transform, lens and focus keys covering the entire 180-degree exposure. Linear interpolation inside that interval needs no neighboring batch keys. Frames 240, 453 and 395/396 additionally check internal checkpoint contexts.",
                  "audio": audio, "crf": crf, "mp4_sha256": sha(video), "mp4_bytes": video.stat().st_size,
                  "ffmpeg": capture(["ffmpeg", "-version"]).decode().splitlines()[0],
                  "finisher_machine": machine(), "checkpoint_storage": {"type": "DRAFT GitHub release", "tag": TAG,
                      "no_actions_artifact_or_cache_storage": True,
                      "compute": "Standard ubuntu-24.04 public-repository hosted runners; no larger runners or paid external compute.",
                      "storage_basis": "Draft GitHub release assets, each below 2 GiB; no Actions artifact/cache storage or transfers.",
                      "documentation": ["https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases", "https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions"], "assets_never_overwritten_or_deleted": True,
                      "failure_recovery": "Completed uploaded chunks preserved; catchable failures attempt per-frame recovery. A hard runner kill may lose the current incomplete six-frame chunk."},
                  "human_visual_review": "Pending final contact-sheet and approved climax reference review; no publishing or portfolio deployment."}
    write_json(MASTER / "production.json", production)
    generated = delivery_files()
    generated.pop("SHA256SUMS")
    (MASTER / "SHA256SUMS").write_text("".join(f"{sha(path)}  {name}\n" for name, path in sorted(generated.items())))
    # Preserve a verified durable bundle before attempting a Git push.
    bundle = STORE / f"verified-master-{sha(video)[:12]}.tar.gz"
    pack(bundle, delivery_files(), "verified-master", {"verification_status": "PASS"})
    if bundle.name not in known:
        upload(bundle, known)
    delivery = {"verification_status": "PASS", "mp4_sha256": sha(video), "bundle_asset": bundle.name,
                "production_branch": BRANCH, "commit_sha": None}
    try:
        require(video.stat().st_size <= 95_000_000, "CRF 18 still exceeds practical GitHub file-size limit")
        delivery["commit_sha"] = push_delivery()
    except Exception as exc:
        delivery["git_delivery_error"] = str(exc)
        print("VERIFIED MASTER SAFE IN DRAFT CHECKPOINT BUNDLE; Git delivery needs recovery:", exc, flush=True)
    write_json(STORE / "delivery-result.json", delivery)
    print("DELIVERY_RESULT", json.dumps(delivery, sort_keys=True), flush=True)
    if delivery["commit_sha"]:
        print(f"ANDROID_MP4 https://raw.githubusercontent.com/{REPO}/{delivery['commit_sha']}/experiments/morph-commercial-02/master/the-circuit-v2-master.mp4", flush=True)
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as stream:
            stream.write(f"commit_sha={delivery['commit_sha'] or ''}\nmp4_sha256={sha(video)}\n")
    require(delivery["commit_sha"], "Verified bundle preserved, but direct GitHub MP4 delivery is incomplete")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("preflight", "render", "finish"))
    parser.add_argument("--batch", type=int)
    args = parser.parse_args()
    if args.command == "preflight":
        preflight()
    elif args.command == "render":
        require(args.batch is not None, "Render requires --batch")
        render_batch(args.batch)
    else:
        finish()


if __name__ == "__main__":
    main()
