# MORPH//COMMERCIAL — THE CIRCUIT V2: the ring engine

Status: **motion proof for the human creative checkpoint.** No full-resolution master has been
rendered, nothing has been published, and the soundtrack is unchanged.

V1 (Sol, branch `feat/morph-commercial-01-circuit`, commit `572caf9`) is preserved untouched in
`experiments/morph-commercial-01/`. V2 is built separately here, on
`feat/morph-commercial-02-living-circuit`, branched from that commit.

## The idea in one sentence

The processor's 48 silicon tiles become carriers circulating on three nested closed loops
(24 + 16 + 8): the outer loop ticks with the cable's clock, the middle loop counter-rotates with
the drums, the core lifts and turns with the Beast — and the ratchet winds the clock until it
spins, then the cut.

Why, and the alternative that was rejected: [DIRECTION.md](DIRECTION.md). What to look at:
[REVIEW.md](REVIEW.md). Measurements: [delivery/VERIFICATION.md](delivery/VERIFICATION.md).

## Build

Dependencies: Blender 4.3 with CPU Cycles — either the `blender` binary or the `bpy==4.3.0`
module (Python 3.11; the proof used the module because download.blender.org is not reachable
from the build machine) — plus FFmpeg with libx264/AAC, Python 3 with NumPy and Pillow (as V1).

```bash
# With the bpy module (python3.11 -m venv venv && venv/bin/pip install bpy==4.3.0):
BLENDER_PY=venv/bin/python experiments/morph-commercial-02/build.sh
# Or with a Blender 4.3 binary on PATH:
experiments/morph-commercial-02/build.sh
```

`build.sh` builds the scene, renders frames 0–455, finishes the MP4 and verifies it. Options:
`--reuse-scene`, `--width N` and `--samples N` (defaults 432 and 12, the proof's settings).

## Pipeline

1. `scene.py` runs V1's `scene.py` geometry, materials and studio lights unchanged (SHA-256
   checked, stopping before V1's camera and plate renders), removes V1's fixed die tiles and
   static signal channels, and adds the 48 carriers, the motor rails, the amber core well, the
   fastener strikes, 56 signal ribbons with an arc-length attribute, an optical glare pass and
   a camera. Output: `work/circuit-v2.blend`.
2. `choreography.py` (standard library only) turns V1's authoritative event map into machine
   actions and evaluates every moving part, light and the camera as pure functions of time.
3. `render.py` bakes the choreography into ordinary keyframes (transforms at each frame's
   shutter open, centre and close; lights once per frame), then renders each frame with CPU
   Cycles, 180° motion blur and OpenImageDenoise. No Python runs during rendering; `--save`
   writes the animated scene, which any Blender 4.3 can scrub or render (for example on a GPU).
4. `finish.py` adds V1's vignette, grain and lockup, writes frames 456–479 as exact black, and
   muxes V1's unchanged PCM reference as AAC.
5. `verify.py` checks sources, scope, container, frame count, duration, the black tail, audio
   presentation, every event's first visible frame and (with `--recheck`) bit-identical
   re-renders. `analyze.py` measures motion against V1 and, optionally, the V12 loop.

## Synchronisation

Unchanged from V1: 120 BPM, 60 fps, 735 samples per picture frame. An event at excerpt sample
`s` belongs to frame `floor(s / 735)`; its response starts at the beginning of that frame, the
frame is exposed over its second half and its light is read at its end. Each response is zero in
the previous frame and visible in its own (`verify.py` checks all of them). Frames 456–479 are
exact black: source sample 1,217,160 = excerpt sample 335,160 = frame 456.

## Files

- `DIRECTION.md` — V12 analysis, V1 diagnosis, two concepts, the choice, the shot plan.
- `REVIEW.md` — the human checkpoint: what changed, what to judge, open questions.
- `scene.py`, `choreography.py`, `render.py`, `finish.py`, `verify.py`, `analyze.py`, `build.sh`.
- `delivery/the-circuit-v2-motion-proof.mp4` — the proof: 432 × 768, 60 fps, 480 frames, 8.000 s.
- `delivery/contact-sheet.jpg`, `delivery/frames/` — representative finished frames.
- `delivery/motion-kymographs.png`, `delivery/motion-analysis.json` — V1 vs V2 (vs V12) motion.
- `delivery/verification.json`, `delivery/VERIFICATION.md` — measured checks and the sync audit.

Audio and event map are V1's (`../morph-commercial-01/audio/circuit-reference.wav`,
`../morph-commercial-01/mapping.json`), read and hash-checked, never copied or modified.
