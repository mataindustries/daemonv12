# THE CIRCUIT V2 — final master: production handoff

Status: creative approval received with two finishing changes. Both are implemented, saved
and checked on full-resolution stills and a short motion check. **The full 480-frame master
has not been rendered.** Do not publish; stop at the final human approval checkpoint.

## Approved changes (in source)

1. **No typography in the picture.** `finish.py` draws nothing over the render (vignette and
   grain only). `--lockup` re-creates the approved proof's title overlay solely to reproduce that
   proof. `verify.py --kind master` proves the master's encoder input is raw render + grade.
   Engraved markings that are part of the fictional board (V1 `scene.py`: `M O R P H`,
   `C01 / NEUROMORPHIC`, fabrication labels) are scene geometry and remain unchanged.
2. **Climax clarity**, `--variant master`, camera only, frames 396–455 (from 6.6 s):
   - the camera's share of the 180° shutter closes from 1.0 to 0.25 by 7.0 s (keys at the
     shutter instants span less time); the machinery keeps the full 180° shutter;
   - overwind move: azimuth acceleration 60 → 30 °/s², elevation rise 38° → 34°,
     roll 14° → 6° (same path, start and framing);
   - f-stop 3.5 → 5.6 over 6.6–7.0 s; focus tracks the top of the lifting core.
   - Unchanged: every frame before 396, all music-driven machinery, all event timing.
   Measured camera smear at 1080 × 1920 in the overwind: 16–24 px (plus up to 17 px of roll
   at the edges) → 2–5 px. Laplacian sharpness of finished stills: +31 % at 7.0 s, +63 % at
   7.4 s, +77 % at 7.55 s. Evidence: `master/review/`.

The approved proof is preserved: `delivery/` is unchanged since `9b0f7c9`, and
`build.sh --approved-proof` reproduces its MP4 byte-for-byte
(`f4d73ca4d8c4ab1a5d6fa377c4db93eac6dadaa61c145a4ab7b70f914d89dbb7`).

## Production settings (fixed in source)

| | |
|---|---|
| Picture | 1080 × 1920, 60 fps, 480 frames, 8.000 s; frames 0–455 rendered, 456–479 written as exact black |
| Renderer | Blender 4.3, CPU Cycles, 16 samples, OpenImageDenoise, seed 11062026, persistent data |
| Motion blur | 180° shutter centred in the frame's second half; camera-only shutter per `choreography.camera_shutter` |
| Look | AgX, Medium High Contrast, exposure −0.9 (`render.py`); fog-glow glare threshold 4, mix −0.75 (`scene.py`) |
| Finish | vignette + seeded grain, no overlay (`finish.py --kind master`) |
| Encode | H.264 High, yuv420p, CRF 16, preset slow; AAC-LC 256 kb/s 44.1 kHz from V1's unchanged PCM; `+faststart`; timescale 60000 |
| Audio/events | `../morph-commercial-01/audio/circuit-reference.wav` and `mapping.json`, hash-checked, never modified |

## Dependencies

- Blender 4.3 with CPU Cycles: a `blender` 4.3.x binary on PATH, **or** the `bpy==4.3.0` module
  (requires Python 3.11): `python3.11 -m venv venv && venv/bin/pip install bpy==4.3.0`.
  The proof and stills used the module (V1 used the 4.3.2 binary).
- FFmpeg with libx264 and AAC (tested: 6.1.1).
- Python 3 with NumPy and Pillow for `finish.py`, `verify.py`, `analyze.py` (tested: Python 3.13,
  NumPy 2.3.5, Pillow 12.3.0); DejaVu Sans for the contact-sheet labels only.
- A checkout of `feat/morph-commercial-02-living-circuit` with `experiments/morph-commercial-01/`
  and `experiments/morph-06/` present (verification compares the audio with the source master).
- Disk: about 3 GB for the raw 1080p frames in `work/master/` (gitignored).

## Production command

From the repository root (`--resume` makes reruns skip completed frames; frames are written
atomically, so an interrupted render can always be resumed):

```bash
BLENDER_PY=venv/bin/python experiments/morph-commercial-02/build.sh --resume
# or with a Blender binary:   experiments/morph-commercial-02/build.sh --resume
```

`build.sh` (1) builds `work/circuit-v2.blend` from `scene.py` (~4 min), (2) renders frames 0–455
with `render.py --variant master --width 1080 --samples 16 --out work/master`, (3) finishes
`master/the-circuit-v2-master.mp4`, (4) re-renders frames 0, 240, 444 and 453 into
`work/master-recheck`, (5) runs `verify.py --kind master`. If a job runner caps run time, split
step 2 and rerun it until done, for example:

```bash
cd experiments/morph-commercial-02
for r in 0-113 114-227 228-341 342-455; do
  venv/bin/python render.py --variant master --width 1080 --samples 16 --out work/master --frames $r --resume
done
```

Measured cost on a 4-thread CPU: 55–61 s per 1080 × 1920 frame, so about 7–8 hours for 456
frames; a GPU-equipped Blender 4.3 renders the same scene far faster (set Cycles to GPU in a
copy of the blend saved with `render.py --save`, and note that GPU noise differs from CPU).

## Expected outputs

- `work/master/raw-000.png` … `raw-455.png` (8-bit RGB, not committed).
- `master/the-circuit-v2-master.mp4`, `master/the-circuit-v2-master.frames.json` (per-frame
  RGB hashes of the encoder input), `master/contact-sheet.jpg`.
- `master/verification.json`, `master/VERIFICATION.md` (written by `verify.py`).

## Verification procedure (all must pass)

1. `verify.py --kind master --frames work/master --recheck work/master-recheck` prints
   `"status": "PASS"`. It checks: 1080 × 1920; H.264/AAC; 60 fps; 480 frames; 8.000 s; both
   streams start at 0; one fast-start MOOV; AAC presents exactly 352,800 samples; audio and
   event-map hashes; 361 events, every visual response first visible in its own frame; frames
   456–479 exact RGB zero and 0–455 not black; no typography (finished frames recomputed from
   raw); approved proof unchanged; V1 unchanged; re-renders bit-identical (same machine).
2. Look at `master/contact-sheet.jpg` and frames 420/444/453 against `master/review/` (same
   composition; noise may differ on another CPU or Blender build).
3. `sha256sum` the MP4, contact sheet and reports into `master/SHA256SUMS`; commit
   `master/` (never `work/`); push to `feat/morph-commercial-02-living-circuit`.
4. Download `https://raw.githubusercontent.com/mataindustries/daemonv12/<commit>/experiments/morph-commercial-02/master/the-circuit-v2-master.mp4`
   without credentials, compare its SHA-256 and re-run the container check on the download;
   record it in `master/retrieval-verification.json` (as in `delivery/`). The repository is
   public, so the link opens on Android without login (it downloads; open in a video player).
5. If the MP4 exceeds ~95 MB (GitHub's limit is 100 MB per file), re-finish with `--crf 17` or
   `--crf 18` and note it in the report.

Reference raw RGB SHA-256 of the full-resolution `--variant master` stills rendered here
(bpy 4.3.0, 4 CPU threads; a different CPU or build may differ in noise only):
see `master/review/clarity-measurements.json`.
