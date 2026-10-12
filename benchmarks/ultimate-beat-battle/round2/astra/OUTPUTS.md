# Outputs — LATCH / RELEASE

All paths below are relative to this directory.

| File | Purpose |
|---|---|
| `listening-copy.mp3` | Final 192 kbps stereo listening copy, no loudness normalization |
| `project.json` | Frozen final DaemonV12 score |
| `final/project.wav` | Canonical 44.1 kHz stereo PCM16 master |
| `final/stems.tar.gz` | Lossless archive of twelve aligned processed stems |
| `final/stems-index.json` | Exact stem names, byte lengths and SHA-256s; archive verified |
| `final/project.mid` | Deterministic conductor-only MIDI; JSON carries sampled notes |
| `final/project.analysis.json` | Native master and stem analysis |
| `final/project.render.json` | Canonical render/provenance manifest |
| `metrics.json` | Native metrics plus supplemental section/spectral/stereo evidence |
| `NOTES.md`, `THESIS.md`, `ITERATIONS.md` | Concept, required checks, critiques and decisions |
| `project-v1.json`, `project-v2.json`, `project-v3.json` | Three complete serious score snapshots |
| `versions/v1.mp3`, `versions/v2.mp3`, `versions/v3.mp3` | Full version listening evidence |
| `review/` | First five seconds, payoff, final three seconds and restart excerpts |
| `assets/`, `asset-catalog.json`, `generate-assets.mjs` | All original sources, recipes, tuning and generator |
| `compose.mjs` | Reproducible versioned score authoring |
| `qc.mjs` | Read-only listening-proxy analysis; reuses repository FFT inspector |
| `verify-lock.mjs`, `determinism-report.json` | Engine/skill pin audit and two-render comparison |
| `preserve.mjs` | Exact canonical copying and deterministic lossless stem archiving |
| `evidence/` | Doctor, route smoke, version reports, final native check, asset determinism |
| `SHA256SUMS` | Preserved-file checksums, excluding the checksum file itself |

To extract stems without changing the master:

```sh
tar -xzf final/stems.tar.gz -C final
```

The twelve extracted files are under `final/project.stems/`, beginning at zero and
matching the master frame count. They include track processing and exclude master
processing. The master applies −2 dB gain and a 25 Hz highpass after summation.

Reproduce from repository root with the pinned engine and installed tools:

```sh
node benchmarks/ultimate-beat-battle/round2/astra/generate-assets.mjs
node benchmarks/ultimate-beat-battle/round2/astra/compose.mjs 3
node bin/daemonv12.js validate benchmarks/ultimate-beat-battle/round2/astra/project.json --json
node bin/daemonv12.js render benchmarks/ultimate-beat-battle/round2/astra/project.json --out-dir benchmarks/ultimate-beat-battle/round2/astra/renders/reproduction --stems --format wav,mp3 --json
```

`project.json` is already frozen; the authoring command rebuilds `project-v3.json`.
Raw V1/V2/V3, smoke, and duplicate final renders remain locally under ignored
`renders/`. Durable preservation includes their scores, listening copies and
reports, plus the complete final master/stems. No duplicate large renders are
required to use the submission.

Remote destination: `mataindustries/daemonv12`, branch
`beat-battle/round2-astra-latch-release`, this same submission path. Final commit
and verified remote reference are reported in the delivery message.
