# LOWRIDER//2099 × ANGELES//2099

An original West Coast rap / trap instrumental and a 9:16 futuristic-LA lowrider film driven by it.
This folder is self-contained production work; DaemonV12's engine (`src/`) is not modified.

## Gate status

| Gate | Deliverable | Status |
|---|---|---|
| **GATE 01** | The soundtrack | **Approved: CREST is the locked primary** ([`review/music/crest.mp3`](review/music/crest.mp3)). HOVER stays buildable. Details in [`music/README.md`](music/README.md) |
| **GATE 02** | CRESTLINE and the look | **Approved and locked:** CRESTLINE v3 at `0b8af67` ([`review/car/v3/`](review/car/v3)), enforced by [`visual/specs/locks.json`](visual/specs/locks.json). Styleframes re-rendered with the v3 car: [`review/styleframes/v3/`](review/styleframes/v3) |
| **Motion** | A music-synchronised CPU motion proof with the CREST master | **Ready for review:** [`review/motion/`](review/motion) (the proof, a loop check, a contact sheet and the list of visual failures). The direction is in [`visual/DESIGN_BIBLE.md`](visual/DESIGN_BIBLE.md#motion-making-the-machine-come-alive) |
| GATE 03 | One-frame GPU test, then the five-frame Colab proof | **Not run:** needs approval of the motion direction and a GPU budget. Plan: [`RENDER_PLAN.md`](RENDER_PLAN.md) |
| GATE 04 | Workbench animatic on Colab | Locked behind GATE 03 |
| GATE 05 | Final render | Not started |

> **Nobody has listened to the music or watched motion yet.** The producer cannot hear audio.
> Every audio claim is a measurement or a design intention; the styleframes are real renders, but
> stills, not motion. Technical QA does not substitute for the owner's eyes and ears.

## What is where

| Path | What |
|---|---|
| [`music/`](music) | v2 sound design, arrangements, Mouth Drop, mastering ([`music/README.md`](music/README.md)) |
| [`review/music/`](review/music) | The two masters (24-bit WAV, 320 kbps MP3), master and QA reports, spectrograms, v1-vs-v2 comparison |
| [`qa/`](qa) | Audio QA: loudness, mono fold-down, stereo depth, brightness, phone model, kick punch, comparisons |
| [`visual/DESIGN_BIBLE.md`](visual/DESIGN_BIBLE.md) | The unified design bible |
| [`visual/specs/`](visual/specs) | Palette, vehicle, world and shot specs: JSON the generator reads |
| [`visual/sync/`](visual/sync) | Engine event maps at 24 fps and the cue sheets that drive the animation, with a transient cross-check |
| [`blender/angeles2099.py`](blender/angeles2099.py) | The deterministic Blender 4.5 LTS scene generator, with validation built in |
| [`review/car/`](review/car) | CRESTLINE: `v3/` the lowrider wheel and maglev suspension, before/after; `v2/` the earlier design sheet |
| [`review/styleframes/`](review/styleframes) | Styleframes v1, v2 and v3 (the locked car), scene check reports, before/after |
| [`review/motion/`](review/motion) | The CPU motion proof with the CREST master, the loop check, the contact sheet, seam metrics |
| [`RENDER_PLAN.md`](RENDER_PLAN.md) | Measured render times and the proposed GPU budget |
| [`colab/`](colab) | The notebook (pinned to one commit), its pipeline module, config, validators and [Android instructions](colab/ANDROID.md) |

The v1 experiment (the approved hook and the first A/B) is untouched in
[`experiments/lowrider-2099`](../../experiments/lowrider-2099).

## Rebuild

```sh
npm ci                                                        # once, at the repo root
productions/lowrider-2099/music/v2/make.sh                    # GATE 01: ~4 min
python3 -I productions/lowrider-2099/visual/sync/build_cues.py crest   # cue sheets (and hover)
# Blender: pip install bpy==4.5.14 (Python 3.11) with the pins in colab/config.json, then
python3.11 productions/lowrider-2099/blender/angeles2099.py --check
python3.11 productions/lowrider-2099/blender/angeles2099.py --styleframe SF2 --res 720x1280 --samples 96 --out sf2.png
python3.11 productions/lowrider-2099/blender/angeles2099.py --car-sheet car/ --res 960x540 --samples 64
LOWRIDER_BPY_PYTHON=$(which python3.11) python3 productions/lowrider-2099/colab/validate_notebook.py   # Run all twice, 0 frames
LOWRIDER_BPY_PYTHON=$(which python3.11) python3 productions/lowrider-2099/colab/e2e_local.py          # the GPU-spend path, on CPU
python3.11 productions/lowrider-2099/blender/angeles2099.py --frames 0-599 --res 216x384 --samples 8 --out-dir proof/   # motion proof (~2 h CPU)
python3 productions/lowrider-2099/blender/motion_proof.py proof/ productions/lowrider-2099/review/motion
```
