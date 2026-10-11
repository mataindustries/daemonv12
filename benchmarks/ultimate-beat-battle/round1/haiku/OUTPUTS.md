# OUTPUTS

Round 1 open-class submission, track **Idle Hymn**, engine `ed75e9e2a0172266e56b292886ad7c1500677862`. All paths are relative to this directory.

## Committed source

| Path | Purpose |
|---|---|
| `project.json` | Final DaemonV12 project. Source of truth for the render. |
| `NOTES.md` | Creative and technical notes, iteration history, known weaknesses. |
| `metrics.json` | Diagnostic metrics, generated from the project and the render manifest by `tools/metrics.py`. |
| `OUTPUTS.md` | This file. |
| `SHA256SUMS.txt` | SHA-256 for every committed file and the final master outputs. |
| `listening-copy.mp3` | Listening copy of the final master (192 kbps, 28.8 s). |
| `assets/tine/tine-hook.wav`, `assets/tine/tine-bass.wav` | Benchmark-local generated sounds. |
| `assets/glasshouse/07-sub-cs.wav` | Copied, byte-identical, from shipped GLASSHOUSE. |
| `assets/orbital-foundry/*.wav`, `assets/orbital-foundry/kit.json` | Copied, byte-identical, from shipped Orbital Foundry. `kit.json` is benchmark-local. |
| `assets/MANIFEST.json` | Provenance and SHA-256 for every asset. |
| `tools/make_assets.py` | Deterministic generator for the two tine sounds. |
| `tools/compose.py` | Writes `project.json` from explicit note tables. |
| `tools/build.sh` | Builds one version: assets, project, validate, render with stems and MP3, per-bar analysis. |
| `tools/analyze.py` | Per-bar RMS, peak, band share, and silence analysis of the master and stems. |
| `tools/metrics.py` | Writes `metrics.json`. |
| `versions/*.project.json` | Project snapshots for V1, V3 through V7, and final. |
| `.gitignore` | Excludes `output/`. |

## Ignored render directory (`output/`)

Large renders are not committed. Their reproduction recipe is below.

| Path | Contents |
|---|---|
| `output/final/project.wav` | **Final WAV master**, 16-bit stereo, 44.1 kHz, 28.8 s. |
| `output/final/project.mp3` | Listening MP3, the same master. |
| `output/final/project.stems/*.wav` | Six aligned stems: `tine-hook`, `tine-bass`, `drums`, `sub`, `fx`, `drone`. |
| `output/final/project.mid` | MIDI container from the engine (62 bytes; no General MIDI tracks). |
| `output/final/project.render.json` | Native render and provenance manifest. |
| `output/final/project.analysis.json` | Engine analysis of the master and each track. |
| `output/final/analysis-bars.json` | Per-bar analysis from `tools/analyze.py`. |
| `output/v1` … `output/v7` | Earlier serious versions, rendered with the same pipeline. V2 was rendered before the build script existed, so it has no `versions/` snapshot. |
| `output/haiku-round1-submission.zip` | Convenience package of the above deliverables. |

## Final checksums

| Artifact | SHA-256 |
|---|---|
| `output/final/project.wav` (final master) | `4777bf40a9288d53f9c5085ab9a47ed9ec2f14208c0c3495752a6c2ea12ec265` |
| `output/final/project.mp3` | `4fd4899f8e75c6bf5dd605019035582259e00aabc78c5d7f3fe3933084104310` |
| `listening-copy.mp3` | same as `output/final/project.mp3` |
| `output/final/project.mid` | `29828624afc580f3c163fb52ae2d1be9c53593ef9f9e2f7f22d500d04ed95560` |
| `output/final/project.render.json` | `75ec049991bca8df2e04823d158feeb734dc4defcdda0b4da02888220c43a38b` |
| `output/final/project.analysis.json` | `3bb1e410e9e38b6869fea449518af49e9c58ccfc6a58a77f62fef68863d2acb5` |
| `output/final/project.stems/drone.wav` | `705732dde9f7a92aff5db388e1c0d103ee686787661dd73e16f0230f74500b8a` |
| `output/final/project.stems/drums.wav` | `bc8c16368e7ac8d32846d0aeabf7114731731f2d45963748118b2f5ae7be42c4` |
| `output/final/project.stems/fx.wav` | `dbd21a933a4bdfe8d13349e7f7fd03adfcb2ec4379e07598efb1c83847a8d0b7` |
| `output/final/project.stems/sub.wav` | `52a478585d898d9a8356b8c2e9d6edbc8c07918a56ac16b9ed624f4e0692f65f` |
| `output/final/project.stems/tine-bass.wav` | `e890d2e067c8333cf56ae4b4f175399a7248e2240c5460b2786a36652404afaa` |
| `output/final/project.stems/tine-hook.wav` | `748c21a4bb7e2021d409105e15c12ceaa6d733d75a263757e458139c4ddff23f` |
| `project.json` | `5e5d0e8edc6204734bfbee7b839505391ee95009a299a6083edd5ebf71e6dcca` |

The final WAV is byte-identical to V7's master. The only changes after V7 were metadata, comments, and documentation.

## Determinism record

- **Two full renders of the final project were byte-identical.** The first render is `output/final`, the second is `output/final-rerun`. Compared: master WAV, MP3, MIDI, render manifest, analysis JSON, and all six stems. Each matched by SHA-256.
- The render manifest records the engine name and version, the project SHA-256, and the WAV, MP3, and stem hashes.
- Final render time on this container: about 17 seconds (measured with `date` around one render).
- The two custom sounds regenerate from `tools/make_assets.py` with seeded numpy. Re-running it on the same platform reproduces the bytes in `assets/MANIFEST.json`.
- Runtime used: Node v22.22.0, FFmpeg 6.1.1 (pinned by `scripts/audio-tools-linux-64.lock`). FluidSynth 2.3.7 was verified by `doctor` but is not used, since the project contains no General MIDI tracks.

## Reproduce

From the repository root, after `npm ci` and the audio bootstrap:

```sh
source "$HOME/.local/share/daemonv12/audio-tools/env.sh"
export SDL_AUDIODRIVER=dummy
B=benchmarks/ultimate-beat-battle/round1/haiku
python3 $B/tools/make_assets.py          # regenerate the two tine WAVs
python3 $B/tools/compose.py --version final   # regenerate project.json
npx --no-install daemonv12 validate $B/project.json
npx --no-install daemonv12 render $B/project.json --out-dir $B/output/final --stems --format wav,mp3
python3 $B/tools/analyze.py $B/output/final > $B/output/final/analysis-bars.json
python3 $B/tools/metrics.py $B/output/final
```

Or use `tools/build.sh final`, which runs the same steps.
