"""Delivery QC only: exact timing, circular seam, stem sum and translation proxies.

Run from the repository with Python 3, NumPy and SciPy. This does not synthesize,
repair, normalize or otherwise change the composition. FFmpeg encodes listening
derivatives of the already rendered DaemonV12 master.
"""
import hashlib
import json
import math
import os
import re
from pathlib import Path
import subprocess
import tempfile
import wave

import numpy as np
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parent
QA = ROOT / "qa"
LISTEN = ROOT / "listening"
FFMPEG = os.environ.get("DAEMONV12_FFMPEG", "ffmpeg")
SR = 44100
N = 441000
QA.mkdir(exist_ok=True)
LISTEN.mkdir(exist_ok=True)


def read_wav(file):
    with wave.open(str(file), "rb") as f:
        info = dict(frames=f.getnframes(), sampleRate=f.getframerate(),
                    channels=f.getnchannels(), bitsPerSample=8 * f.getsampwidth())
        data = f.readframes(info["frames"])
    assert info["bitsPerSample"] == 24
    b = np.frombuffer(data, np.uint8).reshape(-1, 3).astype(np.int32)
    y = b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16)
    y = np.where(y & 0x800000, y - 0x1000000, y)
    return y.reshape(-1, info["channels"]) / 8388608, info, data


def db(x):
    return float(20 * np.log10(x)) if x > 0 else None


def rms(x):
    return float(np.sqrt(np.mean(x * x)))


def ffmpeg(args):
    p = subprocess.run([FFMPEG, "-hide_banner", "-nostdin", "-y", *args],
                       check=True, capture_output=True)
    return p


master = ROOT / "delivery/masters/main.24.wav"
manifest = json.loads((ROOT / "delivery/metadata/render.json").read_text())
x, fmt, data = read_wav(master)
assert fmt == dict(frames=N, sampleRate=SR, channels=2, bitsPerSample=24)
assert manifest["master"]["clippedSamples"] == 0
assert manifest["master"]["analysis"]["truePeakDbfs"] <= -1
assert np.max(np.abs(x)) < 1
project = json.loads((ROOT / "delivery/source/main.json").read_text())
assert project["bpm"] == 96 and project["bars"] == 4 and project["timeSignature"] == "4/4"

stems = []
stem_sum = np.zeros_like(x)
for stem in manifest["stems"]:
    y, info, _ = read_wav(ROOT / "delivery" / stem["file"])
    assert info == fmt and stem["clippedSamples"] == 0
    assert np.max(np.abs(y)) < 1
    stem_sum += y
    stereo_rms = rms(y)
    mono_change = db(rms(y.mean(axis=1)) / stereo_rms)
    stems.append(dict(id=stem["trackId"], **info, clippedSamples=0,
                      monoFoldChangeDb=mono_change))
stem_sum *= 10 ** (project["master"]["gainDb"] / 20)
residual = x - stem_sum
# Nine independently quantized stems versus one Float64 sum: allow 2e-6 FS.
assert np.max(np.abs(residual)) < 2e-6

seams = []
for frame, label in [(0, "last-to-first"), (110250, "bar-2"),
                     (220500, "bar-3"), (330750, "bar-4")]:
    idx = (np.arange(frame - 4410, frame + 4410) % N).astype(int)
    local = x[idx]
    diffs = np.abs(np.diff(local, axis=0))
    step = np.abs(x[frame] - x[(frame - 1) % N])
    p99 = np.quantile(diffs, .99, axis=0)
    # A sample difference is not a click by itself: compare it with surrounding slopes.
    assert np.max(step / np.maximum(p99, 1e-9)) < 2
    seams.append(dict(label=label, sampleFrame=frame,
                      stepLinear=step.tolist(), maxStepDbfs=db(float(step.max())),
                      localDerivative99Percentile=p99.tolist(),
                      stepToLocalP99Ratio=(step / p99).tolist()))

mono = x.mean(axis=1)
phone_filter = butter(2, [300, 3500], fs=SR, btype="bandpass", output="sos")
phone = sosfilt(phone_filter, np.tile(mono, 3))[N:2*N]
opening_band_change = db(rms(phone[:SR]) / rms(mono[:SR]))
assert opening_band_change > -15, "The opening disappears in the phone-band proxy."
phone_bytes = (np.clip(phone, -1, 1) * 32767).round().astype("<i2").tobytes()
with wave.open(str(QA / "phone-band-mono-proxy.wav"), "wb") as f:
    f.setparams((1, 2, SR, N, "NONE", "not compressed"))
    f.writeframes(phone_bytes)

with tempfile.TemporaryDirectory(prefix="astra-listen-") as td:
    repeat = Path(td) / "three-cycles.wav"
    with wave.open(str(repeat), "wb") as f:
        f.setparams((2, 3, SR, 3*N, "NONE", "not compressed"))
        f.writeframes(data * 3)
    with wave.open(str(repeat), "rb") as f:
        assert f.getnframes() == 3 * N
        assert f.readframes(3*N) == data * 3
    for file, title, inp, frames in [
        ("the-ninth-landing.mp3", "The Ninth Landing", master, N),
        ("the-ninth-landing-x3.mp3", "The Ninth Landing - Three Cycles", repeat, 3*N),
    ]:
        output = LISTEN / file
        ffmpeg(["-v", "error", "-i", str(inp), "-map_metadata", "-1",
                "-codec:a", "libmp3lame", "-b:a", "256k", "-ar", str(SR),
                "-ac", "2", "-id3v2_version", "3", "-write_id3v1", "1",
                "-metadata", f"title={title}", "-metadata", "artist=ENM STUDIO",
                "-metadata", "album=The Impossible Stairwell - Astra Max", str(output)])
        decoded = ffmpeg(["-v", "error", "-i", str(output), "-f", "f32le", "-"]).stdout
        assert len(decoded) // 8 == frames, "Gapless-aware decoded duration differs."
        loud = ffmpeg(["-i", str(output), "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr.decode()
        (QA / (file + ".ebur128.txt")).write_text(loud[loud.rfind("Summary:"):])

# A lossless audition cut: last 1.5 s followed immediately by the first 1.5 s.
with wave.open(str(QA / "last-to-first.wav"), "wb") as f:
    f.setparams((2, 3, SR, 3*SR, "NONE", "not compressed"))
    f.writeframes(data[-int(1.5*SR)*6:] + data[:int(1.5*SR)*6])

encoded_metrics = []
for file in sorted(LISTEN.glob('*.mp3')):
    summary = (QA / (file.name + '.ebur128.txt')).read_text()
    true_peak = float(re.search(r'Peak:\s+(-?[\d.]+) dBFS', summary).group(1))
    integrated = float(re.search(r'I:\s+(-?[\d.]+) LUFS', summary).group(1))
    assert true_peak <= -1
    encoded_metrics.append(dict(file=file.name, truePeakDbTP=true_peak,
                                integratedLufs=integrated,
                                sha256=hashlib.sha256(file.read_bytes()).hexdigest()))

quarters = [dict(quarter=q, seconds=q*.625, pictureFrame=q*15,
                 sampleFrame=math.floor(q*27562.5+.5)) for q in range(17)]
result = dict(
    schema="enm.stairwell.qa/1", candidateCount=1, correctiveMusicalRevisions=0,
    pass_=True, format=fmt, durationSeconds=10.0, bpm=96, bars=4,
    picture=dict(fps=24, frames=240, quarterNoteFrames=15,
                 timingSource="Locked brief; supplied video only covers first second."),
    master=manifest["master"], stems=stems,
    stemReconstruction=dict(masterGainDb=project["master"]["gainDb"],
                            peakResidualDbfs=db(float(np.max(np.abs(residual)))),
                            rmsResidualDbfs=db(rms(residual)),
                            note="Independent PCM24 stem quantization; master sums Float64 before its own quantization."),
    seams=seams, quarterBoundaries=quarters,
    translation=dict(stereoCorrelation=float(np.corrcoef(x.T)[0,1]),
                     monoFoldChangeDb=db(rms(mono)/rms(x)),
                     phoneProxy="Mono; second-order 300–3500 Hz Butterworth bandpass; middle of 3 repeats for settled filter state. Not a physical phone measurement.",
                     openingPhoneBandChangeDb=opening_band_change),
    repeatedListening=dict(cycles=3, preEncodeFrames=3*N,
                           method="Byte-concatenate PCM master three times, then one MP3 encode; no MP3-to-MP3 joins.",
                           gaplessAwareDecodedFrames=3*N,
                           caveat="MP3 container packets include encoder padding; use WAV for exact editing. Device player gapless support varies."),
    encodedListening=encoded_metrics,
    psychoacoustics=dict(status="Unverified listener judgments", humanAudition=False,
                        physicalPhoneTest=False, physicalHeadphoneTest=False,
                        musicalContinuityEvidence="Final C-sharp pickup resolves upward to the opening D glass call; diminished pitch-class orbit returns after four minor-third turns. Continuous wrapped voice and room tails cross the seam. Waveform and score inspection are analytical audition, not human listening."),
    masterSha256=hashlib.sha256(master.read_bytes()).hexdigest(),
)
result["pass"] = result.pop("pass_")
(QA / "manifest.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(dict(passed=True, frames=N, truePeakDbTP=result["master"]["analysis"]["truePeakDbfs"],
                     monoFoldChangeDb=result["translation"]["monoFoldChangeDb"],
                     openingPhoneBandChangeDb=opening_band_change, loopStepToLocalP99=seams[0]["stepToLocalP99Ratio"]), indent=2))
