# LOWRIDER//2099 × ANGELES//2099

An original West Coast rap / trap instrumental and a 9:16 futuristic-LA lowrider film driven by it.
This folder is self-contained production work; DaemonV12's engine (`src/`) is not modified.

## Gate status

| Gate | Deliverable | Status |
|---|---|---|
| **GATE 01** | Two upgraded music candidates | **Ready for owner selection.** [`review/music/crest.mp3`](review/music/crest.mp3), [`review/music/hover.mp3`](review/music/hover.mp3); details in [`music/README.md`](music/README.md) |
| **GATE 02** | Three styleframes: vehicle, road, skyline | **Ready for owner review.** [`review/styleframes/`](review/styleframes); honest critique in [`visual/DESIGN_BIBLE.md`](visual/DESIGN_BIBLE.md#styleframes-gate-02-honest-review) |
| GATE 03 | Five-frame Colab proof (360×640) | Pipeline built and validated without a GPU; **not run**: waits for GATES 01–02 |
| GATE 04 | Low-res motion preview on the approved music | Locked behind GATE 03 approval |
| GATE 05 | Final render | Not started; needs GATE 04 approval |

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
| [`review/styleframes/`](review/styleframes) | GATE 02 styleframes and the scene check report |
| [`colab/`](colab) | The notebook, its pipeline module, pinned config, validator and [Android instructions](colab/ANDROID.md) |

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
LOWRIDER_BPY_PYTHON=$(which python3.11) python3 productions/lowrider-2099/colab/validate_notebook.py
```
