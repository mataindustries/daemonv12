# ANGELES//2099 release plan

CREST, CRESTLINE v3, the motion and the camera choreography are locked. Gate 03's T4 proof is
approved. This page holds the last lighting test, the measured render choice, the teaser and what
is left before publication. No GPU was used to produce it.

## 1. Skyline lighting: tested, not adopted

Three shading and compositing cues were tried. None used new geometry, simulation or volumetrics.
- **Crowns:** a warm-gold light chase up the crowns of a third of the towers, only on CREST's four
  full-strength bar downbeats after the slam (360, 420, 480, 540).
- **Airships:** a double-blink navigation beacon once per bar, and a ring of light along the hull
  on the slam and bar 9.
- **Atmosphere:** a shorter aerial haze (30 → 21 km) and a soft fog glow.

Comparison: [`review/lighting/skyline-cues-tested-reverted.jpg`](review/lighting/skyline-cues-tested-reverted.jpg),
360×640, before and after at f428 (mid-chase), f470 and f486.

| Cue | Pixels that changed visibly | At phone size |
|---|---|---|
| Crown chase (f428) | 2.3 % | Not visible: the crowns are already near-white cream; most of the change was the glow on the car's lamps |
| Atmosphere (f470) | 0.4 % | Not visible |
| Airship beacon and hull ring (f486) | 3.2 % | Not visible: a beacon is ~6 m on a hull 4.5 km away, under a pixel |

**Reverted, as agreed.** The fog glow was the only visible change, and it bloomed the approved car
lights, which was not the brief. The scene is byte-identical to the pinned commit (`9c53a58`).

## 2. Rendering recommendation (measured)

[`blender/engine_bench.py`](blender/engine_bench.py) builds the CREST scene once and renders the
costliest frame (f170) and the megacity frame (f470) with each option. It compares each against a
Cycles 128-sample reference: [`review/render/engine-bench.jpg`](review/render/engine-bench.jpg),
[`engine-bench.json`](review/render/engine-bench.json). The machine was this 4-vCPU container; EEVEE
ran through software OpenGL.

| Option (360×640) | f170 | f470 | PSNR vs reference | Looks |
|---|---|---|---|---|
| Cycles 128 + denoise | 93.6 s | 35.4 s | reference | — |
| Cycles 32 + denoise (Gate 03 setting) | 50.1 s | 18.6 s | 36.1 / 39.4 dB | identical at phone size |
| **Cycles 16 + denoise** | **31.6 s** | **10.9 s** | **34.8 / 38.0 dB** | **identical at phone size** |
| Cycles 8 + denoise | 23.2 s | 6.8 s | 32.7 / 36.2 dB | slight smear on the granite |
| EEVEE Next, 64 samples | 347 s | 324 s | 23.3 / 28.5 dB | **wrong:** see below |
| EEVEE Next, 16 samples | 106 s | 107 s | 23.2 / 28.4 dB | **wrong:** see below |

Scene build: 52 s, once per job.

**EEVEE runs headless here, but it breaks the approved look:**
- The glass greenhouse renders as an opaque pink box.
- The violet field pools and the light-linked car rig are missing.
- The wheels smear.
- The granite loses its shading.

Porting the materials is real work on a locked look. Its T4 speed is also unmeasured (the CPU numbers
above are software OpenGL). It also needs OpenGL through EGL on the runtime, where Cycles needs only
CUDA/OptiX. **Not recommended.**

**Recommendation: Cycles, 16 samples, OpenImageDenoise, 1080×1920, half-frame motion blur.**

**Per-frame overhead, measured.**
- Every frame used to re-sync the scene: about 3 s, plus about 6 s for the first frame.
- Final renders now keep it between frames (persistent render data): 29 % faster over a five-frame
  sequence. Output is identical: across the slam cut the largest difference was one pixel off by
  1/255, the same as two fresh renders of the same frame.
- The remaining fixed cost is specific to S2 (frames 120–239): about 10 s per frame, regardless of
  resolution. Cycles re-syncs the car's light-linked rig each frame (1.1 s without light linking).
  Light linking is what keeps the rig off the road, so it stays.
- The T4 benchmark's car frame is an S2 frame, so its measurement includes that cost.
- **CPU cost at that setting:** f170 takes 204 s and f470 85 s per frame. That is 4.3× cheaper than
  128 samples (886 s for f170) and 4.1–4.6× the approved 360×640 / 32-sample proof frame.
- **Floor:** below 16 samples the saving is small. About 15–20 s per frame is fixed scene sync that
  samples do not touch, and on a T4 that part stays on the runtime's CPU.

Sizing on the T4 (no assumptions):
- Let *t* be the T4 time you measured for proof frame 170 (360×640, 32 samples; in the notebook's
  status cell).
- One final frame ≈ 4.6 × *t*, the conservative end of the measured ratio.
- The 246-frame teaser ≈ 246 × 4.6 × *t* × 1.25 ÷ 60 minutes, plus one scene build.
- The 600-frame film ≈ 600 × 4.6 × *t* × 1.25 ÷ 60 minutes.

f170 is the costliest frame, so both are upper bounds. Fallback if that is too dear: the same
setting at 720×1280, upscaled. That costs one test frame and a look on a phone before anyone relies
on it.

## 3. The teaser: 8.375 s, frames 285–485

Revised to open on the strongest existing image. The 240–299 orbit spent 1.9 s at dusk before
anything happened. **Frame 285 is the approved SF2 composition:** the car on the crest, the road
winding to the skyline.

The cut starts one beat before the Mouth Drop, on the pickup into bar 6. Nothing new is rendered,
the music is untouched and the cameras are locked.

| Teaser | Frames | Shot | Picture | Music (CREST) |
|---|---|---|---|---|
| 0:00.000–0:00.625 | 285–299 | S3 | SF2: the car above the winding road, skyline behind | bar 5, beat 4: the pickup |
| 0:00.625–0:03.125 | 300–359 | S4c | **The Mouth Drop**: the barrel-roll push into the grille, "ah, oh, oo, mm", black, the roll completes in the dark, the breath | bar 6, swallowed |
| 0:03.125 | 360 | S5 | **The slam**: level, the body drops, shock rings | the slam |
| 0:03.125–0:08.125 | 360–479 | S5 | **The megacity reveal**: a crane through the multiplane haze | bars 7–8 |
| 0:08.125–0:08.375 | 480–485 | S6 | The bar-9 hit against the skyline and an airship; hard cut to black | the 808 hit, fading |

201 frames. Audio: the committed master `review/music/crest.wav` (SHA-256 `37fbfa66…`, the same file
as the build's master) from **11.875 s to 20.250 s**, a 10 ms fade-in and a 250 ms fade-out:

```sh
ffmpeg -framerate 24 -start_number 285 -i TEASER/frame_%04d.png -ss 11.875 -t 8.375 -i productions/lowrider-2099/review/music/crest.wav \
  -af "afade=t=in:st=0:d=0.01,afade=t=out:st=8.125:d=0.25" -c:v libx264 -profile:v high -crf 16 -pix_fmt yuv420p \
  -c:a aac -b:a 320k -shortest -movflags +faststart angeles2099-teaser.mp4
```

The longer 240–485 cut (10.25 s, audio from 10.000 s) is still available. Frames 240–284 would
then be the only teaser frames the film does not already need.

**No frame is rendered twice.** Final frames are stored once per setting:
`renders/frames/<key>/`, keyed on everything that changes pixels and nothing else. A film job
renders only the frames that are missing. The 201 teaser frames count towards the 600; the film
then needs 399 more. Tested in `colab/e2e_local.py`: a second job reused two frames, rendered
only its one new frame and was charged for one.

## 4. What is left before publication

1. **Owner:** approve the setting (Cycles 16 + denoise; 720×1280 or 1080×1920 after the cost gate) and the teaser cut (285–485).
2. **T4 cost gate (≤ 12 min of budget):** notebook cell 12 (`P.bench_t4`).
   - It renders the car frame (170) and the city frame (470) at 720×1280 and 1080×1920, 16 samples.
   - It saves both sizes to `renders/BENCH/` for a side-by-side look on a phone.
   - It records the timings the teaser and film renders estimate from, and prints projected
     minutes for the teaser and for the rest of the film, typical and worst case.
3. **Render the teaser on the T4:** `P.render("TEASER", list(range(285, 486)), (1080, 1920), 16, confirm=True)` (or 720×1280 if the cost gate says so).
   This is keyed, budgeted and refused if over budget; size the budget with §2.
4. **Assemble** with the command above and review on a phone. Fix only blockers.
5. **Render the film:** `P.render("FILM", list(range(600)), …)` at the same setting renders only the 399 frames the teaser did not, under its own budget. Assemble with the
   full master. The loop version is the same file, because the seam is built in.
6. **Deliverables:**
   - the film and the teaser, 1080×1920 H.264 High, 24 fps, AAC 320 kbps, with the master
     untouched (−11 LUFS; platforms normalise);
   - a poster frame (SF3);
   - an optional end slate. This is a decision: the film has no text, so a slate would be 2D, added
     at assembly.
7. **Publish:**
   - Credits and provenance: original music made in DaemonV12 with its vendored DSP; an original
     car and world; no samples, no third-party assets.
   - Captions, platform copy, and the client-reel cut.
8. **Accepted for release (known, not blocking):** the seam's background shift, the dark first
   half-second, the blimp shadow reading as dimming, the subtle multiplane depth, the S3 orbit's
   skyline smear, and the granite at the top of S2.
