# ANGELES//2099 render plan (measured)

No GPU has been used. Every number below was measured in this repository's CPU container (4 vCPU,
Cycles CPU, Blender 4.5.14 LTS, the pinned wheel), except where a row says **unmeasured**. GPU
time on Colab is unknown until the one-frame test (notebook cell 7) measures it, and the pipeline
refuses to estimate a render without that measurement.

## What was measured

| Job | Settings | Measured | Notes |
|---|---|---|---|
| Scene build + validation | full scene, CREST | **71 s** | `--check` wall time: generate everything, keyframe 600 frames, ray-cast every camera. Was 114 s until the road extension became one straight segment each way (identical distances, max difference 1e-13 m) |
| GATE 03 proof (as configured) | 360×640, 32 spp | frame 0: **54.1 s** · 170: **53.9** · 330: **42.4** · 400: **17.8** · 560: **44.1** | mean **42.5 s**; a second run with persistent render data was within 2 % (no gain, not enabled) |
| One frame at final quality | 1080×1920, 128 spp | frame 400: **312.5 s** · frame 170: **886.3 s** | the heaviest planned setting |
| Final ÷ proof, same frame | | **×17.6** (frame 400) · **×16.4** (frame 170) | the plan uses **×18** to scale the GPU measurement |
| GATE 02 styleframes | 720×1280, 96 spp | SF1 **194 s** · SF2 **183 s** · SF3 **129 s** | v1 took 177 / 130 / 78 s: the v2 world costs 10–65 % more per frame |
| Car design sheet | 960×540, 64 spp | **134–186 s** per view | four views, 794 s wall |
| Workbench animatic | 360×640 | **1.37 s/frame** median | software OpenGL (Mesa) on CPU, with another render running; NVIDIA EGL on a T4 should be faster (**unmeasured**) |
| End-to-end GPU-spend path | thumbnails on CPU | **18/18** checks pass | [`colab/e2e_local.json`](colab/e2e_local.json) |

Per-frame cost varies about 3× across the piece: the wide road-and-city frames are the expensive
ones. The one-frame GPU test therefore renders **frame 170**, the costliest proof frame, so
every estimate built on it errs high, not low.

## What it implies on CPU (for scale, not a proposal)

- The five-frame proof: **71 s + 212 s ≈ 4.7 min** on this 4-vCPU container.
- A Workbench animatic of all 600 frames: about **14 min** of frames plus the build, before padding.
- A final render of all 600 frames at 1080×1920, 128 spp: 600 × 42.5 s × ~17 ≈ **120 hours** of
  4-vCPU CPU. That is why the final render needs a GPU and its own approval.

## Proposed budget (the owner decides)

| Step | Cell | Proposed limit | How it is enforced |
|---|---|---|---|
| One-frame GPU test | 7 | **6 min** of render time | `TEST_ALLOWANCE_MIN`; refuses if less is left |
| GATE 03 proof, 5 frames | 8 | **9 min** more: **15 min** in total | measured build + 5 × measured s/frame, +25 %; refuses if over. On this CPU that formula gives 7.1 min, so a T4 should fit easily |
| GATE 04 animatic, 600 frames | 10 | a **separate 20 min** approval after GATE 03 | locked until GATE 03 is approved; estimate (measured build + 1.4 s × frames) × 1.25 ≈ 19 min, an upper bound from CPU |
| GATE 05 final | not in this notebook | sized only from the GPU measurement | proof s/frame × 18 × 600 frames, +25 %, presented for approval first |

Worked example of the GATE 05 sizing, so the owner can check it: if cell 7 measures *t* seconds for
frame 170 at proof settings on the T4, a final frame costs about 18 × *t*, and the film about
600 × 18 × *t* × 1.25 ÷ 3600 = **3.75 × *t* hours**. At *t* = 2 s that is 7.5 hours; at
*t* = 5 s, 19 hours. These illustrate the arithmetic; they are not predictions. If the measured
number is too high, the levers are samples (64 with the denoiser instead of 128), resolution
(720×1280, upscaled) and splitting the job across sessions. Each needs one test frame and the
owner's eye before it is used.

## What the ledger does and does not count

The ledger on Drive (`ANGELES2099/budget.json`) counts **render time**: the scene build plus the
frames, as Blender reports them. Colab bills a GPU runtime for **as long as it is connected**,
including the Blender install (cached on Drive after the first time), validation, and time the
notebook sits idle. A session that runs the test and the proof therefore uses roughly the 15
budgeted minutes plus 5–10 minutes of setup. Disconnect the runtime when done (Runtime ›
Disconnect and delete runtime). Check Colab's resources panel for the current compute-unit rate;
the pipeline does not assume one.
