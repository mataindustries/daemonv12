"""Gate B only: fixed 12-frame proof, three chunks, read-only storage accounting."""
import argparse
import hashlib
import json
import os
import shutil
import re
import urllib.request
from fractions import Fraction
from pathlib import Path

import artifact_budget
import gate_a as A
import gate_b_media as M
import gate_b_render as R

ARTIFACT_MAX = 64_000_000
TOTAL_RESERVE = ARTIFACT_MAX * 4  # three render artifacts + one review artifact
REVIEW_MAX = 32_000_000


def read(path):
    return json.loads(Path(path).read_text())


def size(folder):
    return sum(p.stat().st_size for p in folder.rglob("*") if p.is_file())


def budget(out):
    resume, attempt = os.getenv("RESUME_RUN_ID", ""), os.getenv("RESUME_ATTEMPT", "1")
    if (resume and not re.fullmatch(r"[1-9][0-9]*", resume)) or not re.fullmatch(r"[1-9][0-9]*", attempt):
        raise RuntimeError("Resume ID and attempt must be positive integers")
    report = artifact_budget.remote_budget()
    if report["retainedBytes"] + TOTAL_RESERVE > artifact_budget.LIMIT:
        raise RuntimeError("Gate B needs 256 MB reserved under the 400 MB working ceiling; "
                           "download/verify old artifacts before removing any. Nothing was deleted.")
    report["gateBReserveBytes"] = TOTAL_RESERVE
    if resume:
        api, repo = os.environ.get("GITHUB_API_URL", "https://api.github.com"), os.environ["GITHUB_REPOSITORY"]
        req = urllib.request.Request(f"{api}/repos/{repo}/actions/runs/{resume}/artifacts?per_page=100",
                                     headers={"Authorization": "Bearer " + os.environ["GH_TOKEN"],
                                              "Accept": "application/vnd.github+json"})
        with urllib.request.urlopen(req, timeout=30) as response:
            artifacts = json.load(response)["artifacts"]
        expected = {f"angeles2099-gate-b-chunk-{i}-{resume}-{attempt}" for i in range(3)}
        report["resumeArtifacts"] = [a["name"] for a in artifacts if a["name"] in expected and not a.get("expired")]
        if not report["resumeArtifacts"]:
            raise RuntimeError("No retained Gate B chunks for that run/attempt; refusing a silent fresh render")
    A.write_json(out / "storage.json", report)
    print(json.dumps(report))


def valid_manifest(folder, index, fingerprint):
    manifest = read(folder / "manifest.json")
    spec = R.chunk(index)
    expected = list(range(spec["first"], spec["last"] + 1))
    if (manifest.get("schema") != 1 or manifest.get("gate") != "B" or manifest.get("chunk") != spec
            or manifest.get("sourceCommit") != A.SOURCE or manifest.get("fingerprint") != fingerprint
            or [r["frame"] for r in manifest.get("frames", [])] != expected):
        raise RuntimeError("Chunk manifest has wrong source, settings, frame order or coverage")
    if not all(R.cached(r, folder, fingerprint, expected) for r in manifest["frames"]):
        raise RuntimeError("Chunk PNG checksums or settings differ")
    for frame in expected:
        A.png_header(folder / f"frame_{frame:04d}.png")
    check = folder / "scene-check.json"
    if A.digest(check) != manifest.get("sceneCheckSha256") or not read(check).get("ok"):
        raise RuntimeError("Chunk scene checks are missing, changed or failed")
    return manifest


def render_chunk(source, out, index, resume):
    manifest = R.render(source, out, index, resume)
    video = out / f"chunk-{index}.mp4"
    try:
        encoder = M.encoder_id()
        old = read(resume / "manifest.json") if resume and (resume / "manifest.json").is_file() else {}
        old_video = resume / video.name if resume else None
        cached_encode = (old_video and old_video.is_file() and not old_video.is_symlink()
                         and old.get("encoder") == encoder and old.get("fingerprint") == manifest["fingerprint"]
                         and old.get("videoSha256") == A.digest(old_video)
                         and [r["sha256"] for r in old.get("frames", [])] == [r["sha256"] for r in manifest["frames"]])
        if cached_encode:
            shutil.copy2(old_video, video)
            qa = M.video_qa(video, 4)
        else:
            qa = M.encode_chunk(out, manifest["chunk"]["first"], 4, video)
        if video.stat().st_size > 20_000_000:
            raise RuntimeError("Derived chunk video exceeds its 20 MB allowance; PNGs are retained")
        manifest.update(state="complete", encoder=encoder, videoSha256=A.digest(video),
                        videoBytes=video.stat().st_size, videoQA=qa, encodedVideoReused=bool(cached_encode))
    except Exception as exc:
        manifest.update(state="failed", error=f"{type(exc).__name__}: {exc}")
        raise
    finally:
        A.write_json(out / "manifest.json", manifest)


def assemble(source, inputs, out):
    report = {"schema": 1, "gate": "B", "passed": False, "sourceCommit": A.SOURCE,
              "firstSourceFrame": R.FIRST, "lastSourceFrame": R.FIRST + R.COUNT - 1,
              "expectedFrames": R.COUNT, "fps": "24/1", "gateCApproved": False}
    try:
        pre = A.preflight(source, out)
        pre["gate"] = "B"
        A.write_json(out / "preflight.json", pre)
        fingerprint = R.key(pre)
        manifests, paths = [], []
        for i in range(3):
            candidates = list(inputs.glob(f"angeles2099-gate-b-chunk-{i}-*"))
            if len(candidates) != 1:
                raise RuntimeError(f"Need exactly one artifact for chunk {i}")
            folder = candidates[0]
            manifest = valid_manifest(folder, i, fingerprint)
            path = folder / f"chunk-{i}.mp4"
            if (manifest.get("state") != "complete" or not path.is_file() or path.is_symlink()
                    or A.digest(path) != manifest.get("videoSha256") or manifest.get("encoder") != M.encoder_id()):
                raise RuntimeError("Missing/stale/corrupt encoded chunk; reuse the PNGs to re-encode")
            if M.video_qa(path, 4) != manifest.get("videoQA"):
                raise RuntimeError("Decoded chunk differs from its saved QA and frame mapping")
            manifests.append(manifest)
            paths.append(path)
        ids = [r["frame"] for m in manifests for r in m["frames"]]
        if ids != list(range(R.FIRST, R.FIRST + R.COUNT)):
            raise RuntimeError("Duplicate, missing or reordered source frame")
        joined, boundaries = M.concat_chunks(paths, out / "video-only.mp4", [4, 4, 4])
        master = source / A.PRODUCTION / "review/music/crest.wav"
        audio = M.audio_reference(master, R.FIRST, R.COUNT, out / "audio-reference.wav")
        final, sync = M.mux_and_check(out / "video-only.mp4", out / "audio-reference.wav",
                                     out / "review.mp4", R.COUNT)
        if (out / "review.mp4").stat().st_size > REVIEW_MAX:
            raise RuntimeError("Review MP4 exceeds the reserved size; quality was not reduced")
        png_bytes = [r["bytes"] for m in manifests for r in m["frames"]]
        report.update(passed=True, renderFingerprint=fingerprint, sourceFrames=ids,
                      decodedFrameCount=final["count"], video=final, chunkBoundaries=boundaries,
                      audioReference=audio, audioSynchronization=sync, masterSha256=A.digest(master),
                      encoderFingerprint=M.encoder_id(), chunkManifestsSha256=[
                          A.digest(p.parent / "manifest.json") for p in paths],
                      pngStorage={"observations": len(png_bytes), "totalBytes": sum(png_bytes),
                                  "meanBytes": sum(png_bytes) / len(png_bytes), "maxBytes": max(png_bytes),
                                  "teaserAtMeanBytes": sum(png_bytes) / len(png_bytes) * 201,
                                  "filmAtMeanBytes": sum(png_bytes) / len(png_bytes) * 600,
                                  "note": "Small shot sample; do not treat as a guaranteed upper bound."})
        checksums = {name: A.digest(out / name) for name in ("review.mp4", "audio-reference.wav")}
        report["outputSha256"] = checksums
        (out / "checksums.sha256").write_text("".join(f"{v}  {k}\n" for k, v in checksums.items()))
    except Exception as exc:
        report["error"] = f"{type(exc).__name__}: {exc}"
        raise
    finally:
        A.write_json(out / "qa.json", report)
        (out / "report.md").write_text(
            "# ANGELES//2099 — Gate B\n\n"
            + f"Passed: **{report['passed']}**. Source frames 285–296; 12 frames / 24 fps = 0.5 s.\n\n"
            + "Three four-frame chunks; native 1080×1920 Cycles 16 / OIDN / original motion blur.\n\n"
            + "The original CREST master starts at exactly 11.875 s (570,000 samples at 48 kHz).\n\n"
            + "See qa.json for every decoded frame SHA-256, both boundaries, exact timestamps, "
            "independent source-offset verification, AAC lag/correlation and tail padding.\n\n"
            + ("Error: " + report["error"] + "\n\n" if "error" in report else "")
            + "Gate C remains unapproved. This proof does not launch a teaser or full film.\n")


def publish(out, destination):
    """Hard cap artifact bytes. Keep validated lossless frames; omit oversized derived files/logs."""
    if destination.resolve() == out.resolve() or (destination.exists() and any(destination.iterdir())):
        raise RuntimeError("Artifact staging directory must be separate and empty")
    destination.mkdir(parents=True, exist_ok=True)
    exclusions = []
    # Native frames are bounded at 9 MB each; at most four are accepted.
    pngs = sorted(out.glob("frame_*.png"))
    if len(pngs) > 4:
        raise RuntimeError("Unexpected frame count in publication directory")
    for path in pngs:
        A.png_header(path)
        if path.is_symlink() or path.stat().st_size > R.PNG_MAX:
            raise RuntimeError("Unexpected PNG size/path; refusing an unbounded artifact")
        shutil.copy2(path, destination / path.name)
    names = ["manifest.json", "qa.json", "report.md", "scene-check.json", "preflight.json",
             "install-check.json", "storage.json", "checksums.sha256", "audio-reference.wav",
             "review.mp4", "chunk-0.mp4", "chunk-1.mp4", "chunk-2.mp4"]
    for name in names:
        path = out / name
        if path.is_file() and not path.is_symlink():
            if size(destination) + path.stat().st_size <= ARTIFACT_MAX - 1_000_000:
                shutil.copy2(path, destination / name)
            else:
                exclusions.append(name)
    for path in out.glob("*.log"):
        if path.is_file() and not path.is_symlink():
            (destination / path.name).write_bytes(path.read_bytes()[-250_000:])
    A.write_json(destination / "artifact-publication.json",
                 {"ceilingBytes": ARTIFACT_MAX, "excludedDerivedFiles": exclusions, "logTailBytes": 250000,
                  "files": {p.name: {"sha256": A.digest(p), "bytes": p.stat().st_size}
                            for p in destination.iterdir() if p.is_file()}})
    if size(destination) > ARTIFACT_MAX:
        raise RuntimeError("Artifact publication exceeded its hard ceiling")
    if exclusions:
        raise RuntimeError("Derived outputs exceeded the artifact cap; lossless frames were preserved")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("budget", "render", "assemble", "publish"))
    parser.add_argument("--source", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--chunk", type=int, choices=(0, 1, 2))
    parser.add_argument("--resume", type=Path)
    parser.add_argument("--inputs", type=Path)
    parser.add_argument("--destination", type=Path)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    if args.command == "budget":
        budget(args.out)
    elif args.command == "render":
        if args.source is None or args.chunk is None:
            parser.error("render needs --source and --chunk")
        render_chunk(args.source, args.out, args.chunk, args.resume)
    elif args.command == "assemble":
        if args.source is None or args.inputs is None:
            parser.error("assemble needs --source and --inputs")
        assemble(args.source, args.inputs, args.out)
    else:
        if args.destination is None:
            parser.error("publish needs --destination")
        publish(args.out, args.destination)


if __name__ == "__main__":
    main()
