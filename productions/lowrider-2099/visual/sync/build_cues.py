"""Beat-sync cue sheets for ANGELES//2099, from the engine's own event maps.

Reads visual/sync/<cand>.events-24fps.json (written by `daemonv12 sync <project> --project --fps 24/1`)
and the candidate's mastered audio, and writes visual/sync/<cand>.cues.json with:
  - the exact grid: 96 BPM at 24 fps is 15 frames per beat and 60 per bar, so beats and bars land
    on whole frames;
  - sections (the arrangement, which the shot plan follows);
  - the animation drivers the Blender generator reads: kicks -> hover bounce, snares/claps ->
    body roll accents, 808 onsets -> hover-emitter pulses, the slam -> suspension drop,
    the hop -> hydraulic lift, answers -> emitter colour shift;
  - a transient cross-check: each kick's engine frame against the nearest onset detected in the
    master (spectral flux), reported in milliseconds.

usage: python3 -I visual/sync/build_cues.py crest|hover   (from productions/lowrider-2099)
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
FPS, SR, BPM = 24, 44100, 96
FRAMES_PER_BEAT = FPS * 60 // BPM          # 15
FRAMES_PER_BAR = 4 * FRAMES_PER_BEAT      # 60

SECTIONS = {
    "crest": [(1, 2, "hook"), (3, 4, "pocket"), (5, 5, "build"), (6, 6, "transition-mouth"), (7, 8, "drop"), (9, 10, "pocket-out")],
    "hover": [(1, 2, "hook"), (3, 4, "pocket"), (5, 6, "transition-hover"), (7, 8, "drop"), (9, 10, "pocket-out")],
}


def read_wav(path):
    with wave.open(str(path), "rb") as w:
        raw, width, nc = w.readframes(w.getnframes()), w.getsampwidth(), w.getnchannels()
    if width == 3:
        b = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3).astype(np.int32)
        v = b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16)
        x = np.where(v >= 1 << 23, v - (1 << 24), v) / float(1 << 23)
    else:
        x = np.frombuffer(raw, dtype="<i2") / 32768.0
    return x.reshape(-1, nc).mean(axis=1)


def transient_offsets_ms(x, times, window_ms=25):
    """For each expected time, the offset (ms) of the steepest rise of a 1 ms envelope of the
    2-6 kHz band (the kick's beater click) within +-window_ms. A global onset detector missed kicks
    whose onsets coincide with 808 notes; a local search tests exactly the claim we need."""
    from scipy import signal
    sos = signal.butter(4, [2000 / (SR / 2), 6000 / (SR / 2)], btype="bandpass", output="sos")
    env = np.convolve(np.abs(signal.sosfilt(sos, x)), np.ones(44) / 44, mode="same")
    rise = np.diff(env, prepend=env[0])
    w = int(window_ms * SR / 1000)
    out = []
    for t in times:
        c = int(round(t * SR))
        a, b = max(0, c - w), min(len(rise), c + w)
        out.append(1000 * (a + int(np.argmax(rise[a:b])) - c) / SR)
    return np.array(out)


def main():
    cand = sys.argv[1]
    em = json.loads((HERE / f"{cand}.events-24fps.json").read_text())
    ev = em["events"]
    by = {}
    for e in ev:
        by.setdefault(e["trackId"], []).append(e)
    frames_total = 10 * FRAMES_PER_BAR
    pitch = lambda e: e["source"].get("pitch")
    kicks = [{"frame": e["pictureFrame"], "sample": e["sampleFrame"], "strength": e["velocity"]} for e in by.get("kick", [])]
    hits = sorted({e["pictureFrame"]: e["velocity"] for e in by.get("snare", []) + by.get("clap", [])}.items())
    sub = [{"frame": e["pictureFrame"], "midi": pitch(e), "strength": e["velocity"]} for e in by.get("bass-808", [])]
    fx = by.get("fx", []) + by.get("mouth", [])
    # fx pitches in the v2 kits: 50 hop, 51 riser, 52 slam, 53 hover; mouth kit 60 swallow
    names = {50: "hop", 51: "riser", 52: "slam", 53: "hover-spinup", 60: "mouth-swallow"}
    events = [{"frame": e["pictureFrame"], "event": names.get(pitch(e), str(pitch(e)))} for e in fx]
    answers = [{"frame": e["pictureFrame"], "voice": e["trackId"]} for e in by.get("talkbox", []) + by.get("beast", [])]
    lead = [{"frame": e["pictureFrame"], "midi": pitch(e)} for e in by.get("lead", [])]

    # transient cross-check against the master
    master = ROOT / "music/v2/masters" / f"{cand}.wav"
    check = None
    if master.exists():
        errs = transient_offsets_ms(read_wav(master), [k["sample"] / SR for k in kicks])
        check = {"master": str(master.relative_to(ROOT)), "method": "steepest 1 ms envelope rise, 2-6 kHz, within +-25 ms of each engine kick",
                 "kicks": len(kicks), "within2ms": int((np.abs(errs) <= 2).sum()), "within5ms": int((np.abs(errs) <= 5).sum()),
                 "medianErrorMs": round(float(np.median(errs)), 2), "maxAbsErrorMs": round(float(np.abs(errs).max()), 2),
                 "pictureFrameMs": round(1000 / FPS, 2),
                 "note": "the engine sample frame is authoritative; this confirms the mastered audio's transients sit on it"}

    cues = {
        "candidate": cand, "fps": FPS, "bpm": BPM, "framesPerBeat": FRAMES_PER_BEAT, "framesPerBar": FRAMES_PER_BAR,
        "durationFrames": frames_total, "durationSeconds": frames_total / FPS,
        "source": {"eventMap": f"visual/sync/{cand}.events-24fps.json", "projectSha256": em["source"]["sha256"]},
        "sections": [{"name": n, "bars": [a, b], "frames": [(a - 1) * FRAMES_PER_BAR, b * FRAMES_PER_BAR]} for a, b, n in SECTIONS[cand]],
        "bars": [{"bar": b + 1, "frame": b * FRAMES_PER_BAR} for b in range(10)],
        "drivers": {"kick": kicks, "snareClap": [{"frame": f, "strength": v} for f, v in hits], "sub808": sub,
                    "lead": lead, "answers": answers, "events": sorted(events, key=lambda x: x["frame"])},
        "transientCheck": check,
    }
    out = HERE / f"{cand}.cues.json"
    out.write_text(json.dumps(cues, indent=1) + "\n")
    print(cand, "sections", [(s["name"], s["frames"]) for s in cues["sections"]], "events", cues["drivers"]["events"], "check", check)


if __name__ == "__main__":
    main()
