# Outputs — SWING ARM

All paths are relative to `benchmarks/ultimate-beat-battle/round2/opus/`.
Checksums for every committed file: `SHA256SUMS` (`sha256sum -c SHA256SUMS`).

## Listen

| File | What | SHA-256 |
|---|---|---|
| `listening-copy.mp3` | 192 kbps listening copy (exact copy of the render's MP3) | `ca5f130c87e0ebb5118fb5cc69ec3c40b773cbca3bdf8440b4af6344e1fad028` |
| `final/project.wav` | Canonical master, PCM16 stereo 44.1 kHz, 1,263,761 frames (28.657 s) | `2f2bfc0375c430f3f4562a46e37d37b98395a1baaf4cc5a5aba491088cf84116` |

## Locked project and provenance

| File | What |
|---|---|
| `project.json` | Final project (sha256 `8f5d6da8…3a74`, matches the manifest) |
| `final/project.render.json` | Engine provenance manifest: every source hash, trigger, playback rate/glide, automation, effect, clip count, stem hash |
| `final/project.analysis.json` | Native analysis of master and 12 stems |
| `final/project.mid` | Conductor-only MIDI (sample-only project) |
| `assets/` | Generated "talking steel" family + copied CC0 pack hits + kits (`assets/README.md`) |
| `custom-catalog.json` | Generated-asset catalog with per-file SHA-256 |

## Process evidence

| File | What |
|---|---|
| `THESIS.md` | Six-line thesis written before any JSON |
| `NOTES.md` | Production log: thesis, structure, iterations, final checks, decisions, uncertainties |
| `metrics.json` | Diagnostic metrics (not a score) |
| `versions/v1…v4/` | Project + builder snapshot and critique for each serious version |
| `versions/v5a`, `v5b/` | Rejected sidechain experiments (snapshot + note) |
| `analysis/v*-report.json`, `final-report.*` | Identical section windows per version (RMS, crest, bands, stereo, transient flux, stem RMS) |
| `analysis/final-checks.json` | Width >1 kHz, downbeat low-end table, hook pitch measurements, ending levels |
| `analysis/determinism.json` | Two-render hash comparison (17 artifacts, all identical) |
| `analysis/*.png` | Spectrograms: V1 full, final full / first 5 s / stall+payoff / last 3 s |
| `tools/` | Asset generator, score builder, analysis helpers, copy of the headless FluidSynth wrapper |

## Reproduce

From the repository root at the frozen engine commit, with the pinned audio tools:

```sh
python3 benchmarks/ultimate-beat-battle/round2/opus/tools/generate_assets.py --verify   # 32 x OK
python3 benchmarks/ultimate-beat-battle/round2/opus/tools/build_project.py /tmp/check.json  # identical to project.json
node bin/daemonv12.js render benchmarks/ultimate-beat-battle/round2/opus/project.json \
  --out-dir benchmarks/ultimate-beat-battle/round2/opus/renders/check --stems --format wav,mp3 --json
```

Renders under `renders/` are git-ignored; the master WAV, manifest and analysis of the
lock are preserved in `final/`. Stems (12 × ~5 MB) are not committed; their hashes are in
`final/project.render.json` and `analysis/determinism.json`.
