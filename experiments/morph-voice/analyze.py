#!/usr/bin/env python3
"""Read-only spectral checks and a portable listening reference figure.

Optional analysis dependency: NumPy 2.3.5, matplotlib 3.10.8. Audio synthesis and
the DaemonV12 cue do not depend on Python. No audio is altered by this script.
"""
import json
import math
import os
from pathlib import Path
import sys
import wave

HERE = Path(__file__).resolve().parent
os.environ.setdefault("MPLCONFIGDIR", str(HERE / "work" / "matplotlib"))
os.environ.setdefault("XDG_CACHE_HOME", str(HERE / "work" / "cache"))
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


def wav(path):
    with wave.open(str(path), "rb") as source:
        if source.getsampwidth() != 2 or source.getcomptype() != "NONE":
            raise ValueError("Expected uncompressed PCM16")
        rate, channels, frames = source.getframerate(), source.getnchannels(), source.getnframes()
        samples = np.frombuffer(source.readframes(frames), dtype="<i2").reshape(-1, channels).astype(np.float64) / 32768
    return samples.mean(axis=1), rate, channels, frames


def stft(x, rate, size=2048, hop=441):
    window = np.hanning(size)
    framed = np.lib.stride_tricks.sliding_window_view(x, size)[::hop]
    magnitude = np.abs(np.fft.rfft(framed * window, axis=-1))
    times = (np.arange(len(framed)) * hop + size / 2) / rate
    frequencies = np.fft.rfftfreq(size, 1 / rate)
    return times, frequencies, magnitude


def curve(performance, key, times):
    base = performance.get("controls", {}).get(key, 0)
    points = performance.get("automation", {}).get(key, [])
    result = np.full(len(times), base, dtype=float)
    for index, point in enumerate(points):
        selected = times >= point["at"]
        if index == len(points) - 1:
            result[selected] = point["value"]
        else:
            following = points[index + 1]
            selected &= times < following["at"]
            u = np.clip((times[selected] - point["at"]) / (following["at"] - point["at"]), 0, 1)
            result[selected] = point["value"] + (following["value"] - point["value"]) * (u * u * (3 - 2 * u))
    return result


def midi_hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def expected_pitch(performance, times):
    # Demonstration C has exactly one note. Vibrato and control lag are omitted
    # from this central-frequency reference, and are stated in the JSON report.
    note = performance["notes"][0]
    target = note["hz"] if "hz" in note else midi_hz(note["midi"])
    initial = note.get("glideFromHz", midi_hz(note.get("glideFromMidi", note.get("midi", 69))))
    if "glideFromMidi" not in note and "glideFromHz" not in note:
        initial = target
    glide = note.get("controls", {}).get("glide", performance["controls"].get("glide", 0))
    u = np.clip((times - note["at"]) / glide, 0, 1) if glide else np.ones(len(times))
    fraction = u * u * (3 - 2 * u)
    return initial * (target / initial) ** fraction * 2 ** (curve(performance, "pitchCents", times) / 1200)


def anchor_peak(samples, rate, at, expected, seconds=0.35):
    """Estimate the retained harmonic anchor, not unrestricted perceived pitch.

    A Hann-windowed FFT and log-magnitude parabolic interpolation find the
    strongest line within +/-15% of the authored fundamental. Inharmonic modes
    lie outside that search region in these demos. This deliberately constrained
    estimate can validate the carrier line, but cannot decide pitch salience.
    """
    size = min(len(samples), round(seconds * rate))
    start = max(0, min(len(samples) - size, round(at * rate) - size // 2))
    segment = samples[start:start + size]
    magnitude = np.abs(np.fft.rfft(segment * np.hanning(size), n=262144))
    frequency = np.fft.rfftfreq(262144, 1 / rate)
    candidates = np.flatnonzero((frequency >= expected * 0.85) & (frequency <= expected * 1.15))
    peak = int(candidates[np.argmax(magnitude[candidates])])
    a, b, c = np.log(np.maximum(magnitude[peak-1:peak+2], 1e-30))
    offset = 0.5 * (a - c) / (a - 2 * b + c) if a - 2 * b + c else 0
    result = (peak + float(np.clip(offset, -1, 1))) * rate / 262144
    return {"atSeconds": at, "expectedAnchorHz": float(expected), "measuredAnchorHz": result,
            "errorCents": 1200 * math.log2(result / expected)}


def segment_metrics(samples, rate, start, end):
    segment = samples[round(start * rate):round(end * rate)]
    window = np.hanning(len(segment))
    power = np.abs(np.fft.rfft(segment * window)) ** 2
    frequencies = np.fft.rfftfreq(len(segment), 1 / rate)
    total = power.sum()
    return {"startSeconds": start, "endSeconds": end,
            "rmsDbfs": 20 * math.log10(float(np.sqrt(np.mean(segment ** 2)))),
            "centroidHz": float((power * frequencies).sum() / total),
            "rolloff95Hz": float(frequencies[np.searchsorted(np.cumsum(power), total * 0.95)]),
            "energyAbove8kPercent": float(100 * power[frequencies >= 8000].sum() / total)}


def spectrogram(axis, samples, rate, title, expected=None):
    times, frequencies, magnitude = stft(samples, rate)
    # A fixed 0 dBFS sine amplitude reference; identical scales across both plots.
    db = 20 * np.log10(np.maximum(magnitude / (2048 / 4), 1e-7))
    selected = (frequencies >= 100) & (frequencies <= 16000)
    image = axis.pcolormesh(times, frequencies[selected], db[:, selected].T,
                            shading="auto", vmin=-80, vmax=-6, cmap="magma", rasterized=True)
    axis.set_yscale("log")
    axis.set_ylim(100, 16000)
    axis.set_yticks([100, 277.18, 1000, 4000, 16000], labels=["100", "277", "1k", "4k", "16k"])
    axis.set_xlim(0, len(samples) / rate)
    axis.set_title(title)
    axis.set_ylabel("Frequency / Hz")
    axis.set_xlabel("Seconds")
    if expected is not None:
        axis.plot(times, expected(times), color="#90f8dd", lw=1.15, label="Authored pitch reference")
        axis.legend(loc="upper right", fontsize=8)
    return image


def analyze(root):
    root = Path(root).resolve()
    output = root / "analysis"
    output.mkdir(parents=True, exist_ok=True)
    names = ["the-transformation", "the-performance", "the-impossible-gesture"]
    audio = {name: wav(root / "demos" / f"{name}.wav") for name in names}
    performances = {name: json.loads((root / "performances" / f"{name}.json").read_text()) for name in names}
    transformation, rate, _, _ = audio["the-transformation"]
    fixed = midi_hz(61)
    anchors = [anchor_peak(transformation, rate, float(at), fixed) for at in np.arange(0.5, 10.76, 0.25)]
    samples, gesture_rate, _, _ = audio["the-impossible-gesture"]
    gesture_times = [0.25, 0.6, 1.0, 1.4, 1.9, 2.5, 3.0, 4.0, 5.5, 6.5]
    gesture_expected = expected_pitch(performances["the-impossible-gesture"], np.array(gesture_times))
    gesture_anchors = [anchor_peak(samples, gesture_rate, at, expected, seconds=0.10 if at < 1.7 else 0.25)
                       for at, expected in zip(gesture_times, gesture_expected)]
    report = {"method": {"sampleReader": "Python wave and signed little-endian PCM16",
              "spectralMetrics": "Hann-windowed FFT power centroid and 95% power rolloff; not perceptual brightness scores",
              "anchorEstimator": "Hann FFT zero-padded to 262144, strongest bin within +/-15% of authored f0; log-parabolic peak interpolation",
              "anchorLimitations": "Constrained estimate validates the retained carrier line only. It cannot establish perceived pitch, continuity, vocal likeness or musical quality. Metallic modes, finite windows, vibrato and glide bias estimates. Expected gesture pitch omits vibrato and 4 ms control lag.",
              "plot": "2048-frame Hann STFT, hop441 (10ms), common sine-referenced dBFS scale",
              "runtime": {"python": sys.version.split()[0], "numpy": np.__version__, "matplotlib": matplotlib.__version__}},
      "theTransformation": {"referenceHz": fixed, "vibratoDepthCents": 0,
              "anchorChecks": anchors,
              "maxAbsoluteAnchorErrorCents": max(abs(item["errorCents"]) for item in anchors),
              "segments": {label: segment_metrics(transformation, rate, a, b) for label, a, b in [
                  ("glass", 0.6, 1.2), ("voice-a", 4.1, 4.7), ("voice-i", 5.8, 6.4), ("machine", 9.5, 10.1)]}},
      "thePerformance": {"authoredMidiInventory": sorted(set(note["midi"] for note in performances["the-performance"]["notes"])),
              "pitchSpellings": {"61": "C#4", "64": "E4", "65": "E#4 (enharmonic F4)", "68": "G#4", "69": "A4", "73": "C#5"},
              "authoredNoteEvents": [{"atSeconds": note["at"], "audioFrame": round(note["at"] * rate),
                     "midi": note["midi"], "gateSeconds": note["duration"], "velocity": note["velocity"]}
                     for note in performances["the-performance"]["notes"]],
              "timingLimitations": "Events come from the input JSON; this is not an independent onset detector. Released voices may overlap subsequent attacks."},
      "theImpossibleGesture": {"authoredMovement": "C#5 to C#3 over 1.65s, while vowel moves u to i; then repeatedly folds voice/metal at fixed target pitch",
              "anchorChecks": gesture_anchors,
              "formantControlAtCheckTimes": [{"atSeconds": at, "vowel": float(value)} for at, value in zip(gesture_times, curve(performances["the-impossible-gesture"], "vowel", np.array(gesture_times)))],
              "interpretation": "Contrary pitch and formant movement is represented independently in the performance. Curves and spectral lines are evidence of control separation; the expressive result requires listening."}}
    (output / "spectral.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10, "axes.spines.top": False, "axes.spines.right": False})
    fig, axes = plt.subplots(2, 2, figsize=(15.0, 9.0), gridspec_kw={"height_ratios": [1.45, 1]}, constrained_layout=True)
    image = spectrogram(axes[0, 0], transformation, rate, "A / THE TRANSFORMATION — one C#4",
                        expected=lambda times: np.full(len(times), fixed))
    spectrogram(axes[0, 1], samples, gesture_rate, "C / THE IMPOSSIBLE GESTURE — falling throat, rising mouth",
                expected=lambda times: expected_pitch(performances["the-impossible-gesture"], times))
    fig.colorbar(image, ax=axes[0, :], label="STFT / dBFS", shrink=0.8, pad=0.02)
    times = np.linspace(0, 12, 1201)
    for control, color in [("morph", "#8e3abd"), ("vowel", "#da6830"), ("brightness", "#159f9d"), ("grit", "#65738b")]:
        axes[1, 0].plot(times, curve(performances["the-transformation"], control, times), label=control, color=color, lw=1.7)
    axes[1, 0].set(xlim=(0, 12), ylim=(-0.03, 1.03), xlabel="Seconds", ylabel="Authored control / 0–1", title="A / independent control trajectories")
    axes[1, 0].legend(ncol=4, fontsize=8, loc="upper left")
    hook, hook_rate, _, _ = audio["the-performance"]
    hop = 220
    windows = np.lib.stride_tricks.sliding_window_view(hook, 441)[::hop]
    rms = np.sqrt(np.mean(windows ** 2, axis=1))
    axes[1, 1].fill_between((np.arange(len(rms)) * hop + 220) / hook_rate, rms, color="#344d73", alpha=0.9, label="10 ms RMS envelope")
    for note in performances["the-performance"]["notes"]:
        axes[1, 1].axvline(note["at"], color="#dc6830", lw=0.65, alpha=0.6)
    axes[1, 1].set(xlim=(0, 12), xlabel="Seconds", ylabel="Linear RMS", title="B / THE PERFORMANCE — repeated 4-second hook")
    axes[1, 1].legend(fontsize=8)
    fig.suptitle("MORPH//01 / THE SINGING MACHINE\nSignal evidence for listening — no perceptual judgment implied", fontsize=16)
    fig.savefig(output / "audio-overview.png", dpi=150, metadata={"Software": "MORPH//01 spectral analysis"})
    plt.close(fig)
    print(json.dumps({"spectral": str(output / "spectral.json"), "figure": str(output / "audio-overview.png"),
                      "fixedPitchMaxErrorCents": report["theTransformation"]["maxAbsoluteAnchorErrorCents"]}))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python experiments/morph-voice/analyze.py OUTPUT_ROOT")
    analyze(sys.argv[1])
