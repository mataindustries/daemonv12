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

## 3. The teaser: 10.25 s, frames 240–485

Built from the locked choreography and the original master, with nothing new rendered beyond these
frames. 9:16, 24 fps, 246 frames. Audio: the CREST master from **10.000 s to 20.250 s**, a 10 ms
fade-in and a 250 ms fade-out over the last 6 frames.

| Teaser | Frames | Shot | Picture | Music (CREST) |
|---|---|---|---|---|
| 0:00.00–0:02.50 | 240–299 | S3 | A 150° orbit, rising, at last light; the skyline comes round behind the car | Bar 5: the build |
| 0:02.50–0:05.00 | 300–359 | S4c | **The Mouth Drop.** A barrel-roll push into the grille: "ah" 300, "oh" 315, "oo" 327, "mm" seals 334, black 345, the roll completes in the dark, the breath 347–359 | Bar 6: the beat is swallowed, silence, a reversed breath |
| 0:05.00 | 360 | S5 | **The slam.** Opens level, the body drops onto the modules, shock rings | The slam downbeat |
| 0:05.00–0:10.00 | 360–479 | S5 | **The megacity reveal.** A crane up and back through the multiplane haze, 24 → 70 mm, crowned megatowers and airships | Bars 7–8: the swung takeover, the talking 808 |
| 0:10.00–0:10.25 | 480–485 | S6 | The button: the bar-9 downbeat, the car against the skyline and an airship. Hard cut to black | The 808 hit, fading |

A shorter cut, if a platform wants under 9 s: frames 270–479 (8.75 s), audio 11.250 → 20.000 s,
with a 250 ms fade-out.

Assembly, once the frames exist (`TEASER/` holds `frame_0240.png` … `frame_0485.png`):

```sh
ffmpeg -framerate 24 -start_number 240 -i TEASER/frame_%04d.png -ss 10.0 -t 10.25 -i productions/lowrider-2099/music/v2/masters/crest.wav \
  -af "afade=t=in:st=0:d=0.01,afade=t=out:st=10.0:d=0.25" -c:v libx264 -profile:v high -crf 16 -pix_fmt yuv420p \
  -c:a aac -b:a 320k -shortest -movflags +faststart angeles2099-teaser.mp4
```

## 4. What is left before publication

1. **Owner:** approve the setting (Cycles 16 + denoise, 1080×1920) and the teaser cut (240–485).
2. **Measure on the T4 (≤ 6 min of budget):**
   - Set `gpuTest` in `colab/config.json` to 1080×1920 and 16 samples (frame 170), re-pin, and run
     cell 7.
   - The pipeline only estimates from a timing measured at the exact settings it will render.
3. **Render the teaser on the T4:** `P.render("TEASER", list(range(240, 486)), (1080, 1920), 16, confirm=True)`.
   This is keyed, budgeted and refused if over budget; size the budget with §2.
4. **Assemble** with the command above and review on a phone. Fix only blockers.
5. **Render the film:** all 600 frames at the same setting under its own budget. Assemble with the
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
