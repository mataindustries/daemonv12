"""Gate B media operations. No Blender import and no render-range CLI."""
import hashlib
import json
import math
import shutil
import subprocess
from fractions import Fraction
from pathlib import Path

FPS = 24
AUDIO_RATE = 48000
ENCODE = ["-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
          "-g", "24", "-keyint_min", "24", "-sc_threshold", "0", "-bf", "0",
          "-x264-params", "open-gop=0", "-colorspace", "bt709", "-color_primaries", "bt709",
          "-color_trc", "bt709", "-color_range", "tv", "-video_track_timescale", "12288",
          "-movflags", "+faststart"]
RESAMPLE = "aresample=48000:resampler=soxr:precision=28"


def run(args, *, binary=False):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            timeout=180, text=not binary)
    if result.returncode:
        error = result.stderr.decode(errors="replace") if binary else result.stderr
        raise RuntimeError(f"{args[0]} failed: {error[-3000:]}")
    return result.stdout


def ffmpeg(*args, binary=False):
    return run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
                *map(str, args)], binary=binary)


def probe(path, frames=False):
    args = ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-show_data_hash", "sha256"]
    if frames:
        args += ["-show_frames"]
    return json.loads(run([*args, "-of", "json", str(path)]))


def encoder_id():
    version = run(["ffmpeg", "-version"])
    return hashlib.sha256((version + json.dumps(ENCODE)).encode()).hexdigest()


def stream_signature(stream):
    fields = ("codec_name", "codec_tag_string", "profile", "level", "width", "height",
              "pix_fmt", "sample_aspect_ratio", "has_b_frames", "r_frame_rate", "avg_frame_rate",
              "time_base", "color_space", "color_transfer", "color_primaries", "color_range", "extradata_hash")
    return {k: stream.get(k) for k in fields}


def video_qa(path, count, dimensions=(1080, 1920)):
    info = probe(path, frames=True)
    videos = [s for s in info["streams"] if s["codec_type"] == "video"]
    if len(videos) != 1:
        raise RuntimeError("Need exactly one video stream")
    stream = videos[0]
    if (stream["codec_name"] != "h264" or (stream["width"], stream["height"]) != dimensions
            or stream["pix_fmt"] != "yuv420p" or Fraction(stream["r_frame_rate"]) != FPS
            or Fraction(stream["avg_frame_rate"]) != FPS):
        raise RuntimeError("Video settings differ from the encoding contract")
    frames = [f for f in info["frames"] if f["media_type"] == "video"]
    if len(frames) != count or not frames[0]["key_frame"]:
        raise RuntimeError("Wrong decoded frame count or chunk does not begin at a keyframe")
    time_base = Fraction(stream["time_base"])
    times = [Fraction(f["best_effort_timestamp"]) * time_base for f in frames]
    if any(abs(t - Fraction(i, FPS)) > time_base / 2 for i, t in enumerate(times)):
        raise RuntimeError("Video frame timestamps have a gap, duplicate or wrong order")
    duration = Fraction(stream["duration_ts"]) * time_base
    if duration != Fraction(count, FPS):
        raise RuntimeError("Video duration is not the exact frame count / 24")
    hashes = []
    for line in ffmpeg("-i", path, "-map", "0:v:0", "-an", "-pix_fmt", "yuv420p",
                       "-fps_mode", "passthrough", "-f", "framehash", "-hash", "sha256", "-").splitlines():
        if line and not line.startswith("#"):
            hashes.append(line.split(",")[-1].strip())
    if len(hashes) != count:
        raise RuntimeError("Decoded frame-hash count differs")
    return {"count": count, "fps": "24/1", "duration": str(duration), "signature": stream_signature(stream),
            "frameSha256": hashes, "pts": [str(t) for t in times]}


def encode_chunk(png_dir, first, count, destination, dimensions=(1080, 1920)):
    ffmpeg("-framerate", FPS, "-start_number", first, "-i", Path(png_dir) / "frame_%04d.png",
           "-frames:v", count, "-an", "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
           *ENCODE, destination)
    return video_qa(destination, count, dimensions)


def concat_chunks(paths, destination, counts, dimensions=(1080, 1920)):
    if len(paths) < 3 or len(paths) != len(counts):
        raise RuntimeError("Gate B requires at least three chunks")
    individual = [video_qa(p, n, dimensions) for p, n in zip(paths, counts)]
    if any(q["signature"] != individual[0]["signature"] for q in individual):
        raise RuntimeError("Chunk codec parameters do not match")
    # Controlled basenames in one local directory; no untrusted ffconcat path or shell parsing.
    for i, path in enumerate(paths):
        target = destination.parent / f"input-{i}.mp4"
        if path.resolve() != target.resolve():
            shutil.copy2(path, target)
    listing = destination.parent / "chunks.ffconcat"
    listing.write_text("ffconcat version 1.0\n" + "".join(f"file input-{i}.mp4\n" for i in range(len(paths))))
    ffmpeg("-f", "concat", "-safe", "1", "-i", listing, "-map", "0:v:0", "-c:v", "copy",
           "-an", "-video_track_timescale", "12288", "-movflags", "+faststart", destination)
    joined = video_qa(destination, sum(counts), dimensions)
    expected = [h for q in individual for h in q["frameSha256"]]
    if joined["frameSha256"] != expected:
        raise RuntimeError("Concatenation changed, duplicated, dropped or reordered decoded frames")
    boundaries, position = [], 0
    for left, right in zip(individual, individual[1:]):
        position += left["count"]
        boundaries.append({"outputFrame": position, "time": str(Fraction(position, FPS)),
                           "leftSha256": expected[position - 1], "rightSha256": expected[position],
                           "decodedIdentity": True, "gapSeconds": 0})
    return joined, boundaries


def pcm(path, filters=None):
    args = ["-i", str(path), "-map", "0:a:0", "-vn"]
    if filters:
        args += ["-af", filters]
    return ffmpeg(*args, "-ar", AUDIO_RATE, "-ac", "2", "-c:a", "pcm_f32le", "-f", "f32le", "-", binary=True)


def audio_reference(master, first, count, destination):
    # 48 kHz makes every 24 fps boundary integral: exactly 2,000 samples/frame.
    start = first * (AUDIO_RATE // FPS)
    samples = count * (AUDIO_RATE // FPS)
    filters = f"{RESAMPLE},atrim=start_sample={start}:end_sample={start + samples},asetpts=PTS-STARTPTS"
    ffmpeg("-i", master, "-af", filters, "-ar", AUDIO_RATE, "-ac", "2", "-c:a", "pcm_f32le", destination)
    reference = pcm(destination)
    # Independent offset check: resample the WHOLE master, then slice in Python.
    full = pcm(master, RESAMPLE)
    independent = full[start * 8:(start + samples) * 8]
    if len(reference) != samples * 8 or reference != independent:
        raise RuntimeError("Reference PCM differs from independent full-master source-offset slice")
    return {"sourceFrame": first, "sourceOffset": str(Fraction(first, FPS)),
            "sourceOffsetSeconds": float(Fraction(first, FPS)), "outputRate": AUDIO_RATE,
            "startSample48k": start, "sampleCount": samples,
            "referencePcmSha256": hashlib.sha256(reference).hexdigest(), "independentOffsetVerified": True}


def alignment(expected, actual):
    import numpy as np
    n = len(expected)
    if n < 4000 or len(actual) != n:
        raise RuntimeError("Insufficient or mismatched audio samples")
    if not np.isfinite(expected).all() or not np.isfinite(actual).all():
        raise RuntimeError("Non-finite audio samples cannot establish synchronization")
    e, a = expected.mean(axis=1).astype("float64"), actual.mean(axis=1).astype("float64")
    e -= e.mean()
    a -= a.mean()
    energy = float(np.dot(e, e))
    if energy / n < 1e-10:
        raise RuntimeError("Audio reference is silent; cannot establish synchronization")
    size = 1 << (2 * n - 1).bit_length()
    corr = np.fft.irfft(np.fft.rfft(a, size) * np.conj(np.fft.rfft(e, size)), size)
    ee, aa = np.r_[0.0, np.cumsum(e * e)], np.r_[0.0, np.cumsum(a * a)]
    scores = []
    for lag in range(-2400, 2401):
        # Positive lag means decoded audio is delayed against the expected source.
        e0, e1 = max(0, -lag), min(n, n - lag)
        a0, a1 = max(0, lag), min(n, n + lag)
        denom = math.sqrt(max(float((ee[e1] - ee[e0]) * (aa[a1] - aa[a0])), 1e-30))
        scores.append((float(corr[lag % size]) / denom, lag))
    score, lag = max(scores)
    zero = float(np.dot(e, a) / math.sqrt(energy * float(np.dot(a, a))))
    if abs(lag) > 1 or zero < 0.98:
        raise RuntimeError(f"AAC synchronization/quality check failed: lag={lag} samples, correlation={zero:.6f}")
    return {"bestLagSamples48k": lag, "searchedLagSamples": [-2400, 2400],
            "zeroLagCorrelation": zero, "bestCorrelation": score, "toleranceSamples": 1}


def mux_and_check(video, reference, destination, count, dimensions=(1080, 1920)):
    import numpy as np
    before = video_qa(video, count, dimensions)
    ffmpeg("-i", video, "-i", reference, "-map", "0:v:0", "-map", "1:a:0",
           "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-ar", AUDIO_RATE, "-ac", "2",
           "-use_editlist", "1", "-video_track_timescale", "12288", "-movflags", "+faststart", destination)
    after = video_qa(destination, count, dimensions)
    if after["frameSha256"] != before["frameSha256"]:
        raise RuntimeError("Audio mux changed decoded video frames")
    info = probe(destination)
    tracks = [s for s in info["streams"] if s["codec_type"] == "audio"]
    duration = Fraction(count, FPS)
    if len(tracks) != 1:
        raise RuntimeError("Need exactly one soundtrack")
    track = tracks[0]
    if (track["codec_name"] != "aac" or int(track["sample_rate"]) != AUDIO_RATE or track["channels"] != 2
            or Fraction(track["start_time"]) != 0
            or Fraction(track["duration_ts"]) * Fraction(track["time_base"]) != duration):
        raise RuntimeError("Audio track start/duration/format differs from the video timeline")
    expected = np.frombuffer(pcm(reference), dtype="<f4").reshape(-1, 2)
    decoded = np.frombuffer(pcm(destination), dtype="<f4").reshape(-1, 2)
    samples = count * (AUDIO_RATE // FPS)
    padding = len(decoded) - samples
    # AAC decoders may expose a partial final packet. It lies outside the exact MP4 edit duration.
    if len(expected) != samples or not 0 <= padding < 1024:
        raise RuntimeError("Unexpected decoded AAC sample count or padding")
    audio = alignment(expected, decoded[:samples])
    audio.update(expectedSamples=samples, decodedSamples=len(decoded), tailPaddingSamples=padding,
                 containerDuration=str(duration), containerStart="0", primingHandledByEditList=True)
    return after, audio
