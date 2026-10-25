# MORPH//09 V2 — INSIDE THE RESONATOR

Status: **creative motion proof, stopped for review.** Eight seconds at 432 × 768, 60 fps, with
the approved OVERTONE audio. The 1080 × 1920 master has not been rendered. Nothing published.

V1 (Sol, `feat/morph-09-resonant-rotor` at `4ad6905`) is preserved untouched in
[`../morph-09/`](../morph-09/). V2 lives here, on `feat/morph-09-v2-inside-the-resonator`,
branched from that exact commit. The soundtrack, motor score, telemetry, event map and the
DaemonV12 engine are unchanged (hash-checked by `verify.py`).

## The idea in one sentence

One unbroken take that begins inside the contact gap of a watch-scale commutator, circles the
instrument exactly once while its rotor turns 27 times, climbs over a crown of five towering
tuning forks, and at the A1 harmonic lock is stopped dead by the instrument's own strobe, then
dives back to the brush for a seamless return.

Why, the alternative that was rejected, and the shot plan: [DIRECTION.md](DIRECTION.md).
What to judge: [REVIEW.md](REVIEW.md).

## Delivery

- [`delivery/morph-09-v2-inside-the-resonator.mp4`](delivery/morph-09-v2-inside-the-resonator.mp4)
  — H.264 + AAC viewing copy (phones).
- [`delivery/morph-09-v2-inside-the-resonator.mov`](delivery/morph-09-v2-inside-the-resonator.mov)
  — H.264 + the approved PCM, sample-for-sample (reference).
- [`delivery/stills/`](delivery/stills/) — four 864 × 1536 stills; [`delivery/contact-sheet.jpg`](delivery/contact-sheet.jpg).
- [`delivery/loop-boundary.jpg`](delivery/loop-boundary.jpg) — six consecutive pictures across the seam;
  [`delivery/camera-choreography.png`](delivery/camera-choreography.png) — every camera channel across two loops.
- [`delivery/v2-audit.json`](delivery/v2-audit.json), [`delivery/v2-sync-audit.csv`](delivery/v2-sync-audit.csv),
  [`delivery/motion-analysis.json`](delivery/motion-analysis.json), [`delivery/SHA256SUMS`](delivery/SHA256SUMS).

## Verified

Camera state identical at 0 and 8 s (9e-16); camera velocity continuous across the seam;
29 machine channels close within 8e-08; rotor residual 0.0125° inherited from the source
telemetry; picture 479 → 0 changes less than the median picture step (20.0 vs 21.4);
`.mov` audio is the approved PCM byte-for-byte; 480 pictures, 60 fps, 8.000 s. Details:
[REVIEW.md](REVIEW.md) and [delivery/v2-audit.json](delivery/v2-audit.json).

## Build

Blender 4.3 with CPU Cycles: the `bpy==4.3.0` module (Python 3.11, NumPy < 2) or a Blender 4.3
binary. download.blender.org is not reachable from the build machine, so the proof used the
module. Plus FFmpeg (libx264, AAC), NumPy, Pillow and Matplotlib.

```bash
python3.11 -m venv /opt/bpyenv && /opt/bpyenv/bin/pip install bpy==4.3.0 "numpy<2" pillow matplotlib
experiments/morph-09-v2/build.sh            # scene, 480 frames, 4 stills, finish, verify
experiments/morph-09-v2/build.sh --resume   # keep frames already rendered
```

Proof settings: 432 × 768, 16 samples with adaptive sampling and OpenImageDenoise, 180°
motion blur (shutter closing at each picture's time), depth of field. Stills: 864 × 1536,
128 samples.

## Pipeline

1. `choreography.py` (standard library only) imports V1's unchanged `state.py` for the event
   envelopes and the Hermite-interpolated MORPH//07 rotor telemetry, and defines every moving
   part, emitter and the camera as a pure function of time.
2. `scene.py` builds the instrument, materials, studio light and camera:
   `work/morph-09-v2/resonator.blend` plus `resonator.json` (names to animate).
3. `render.py` bakes the choreography into ordinary keyframes (transforms at each picture's
   shutter open, centre and close; light once per picture) and renders with CPU Cycles. No
   Python runs while Cycles renders.
4. `finish.py` applies an identical lens vignette to every picture, muxes the approved PCM into
   the `.mov` and an AAC copy into the `.mp4`, and builds the contact sheet and seam strip.
5. `verify.py` checks sources, the camera seam, the machine seam, event presentation and the
   rendered media; `analyze.py` describes V1's and V2's motion with the same measures.

## Mechanical cause and effect

| Music (event map) | Mechanism |
|---|---|
| `commutator` impacts | the brush recoils; a commutation seam lights at its leading edge |
| `tines` (`source.tine`) | that fork's drive coil pulses and its tines ring (smear across their excursion) |
| `harmony` (`tineHz`, `glideMs`) | brass tuning riders slide along all ten tines |
| kick / clap / hat | axial rotor suspension dips / clap jaws close / the anchor escapement ticks to its other side |
| bass / vox | the tension hoop contracts / the silver reed bows and leans by note |
| `drive` drag, release, brake | calipers clamp the slotted disc; after the stop the disc rim and pads glow |
| `regime` fusion → separation | the contact seam burns continuously while pulses are pitch |
| rotor speed (telemetry) | the governor's flyweights open, equal extension per octave, 3 → 55 rev/s |
| `voice` A1 lock → `drive` brake | contact-fired xenon strobe: rotor, governor and all five forks frozen |
