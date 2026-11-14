# Bridge verification

Base: PR #50 / `c49577340606e57217bcfd720206a7c47bf5fb71`.

| Check | Result |
|---|---|
| `npm run typecheck` | Pass, including adapter/CLI through test imports |
| `node --test tests/v12-motif-bridge.test.ts` | 11 passed, 0 failed, 0 skipped |
| `npm test` | 410 tests: 401 passed, 0 failed, 9 skipped; 269.4 s |
| Protected-file baseline | 138 original files unchanged; approved rack file set unchanged |
| Rack freeze manifest | All 31 frozen files match SHA-256 |
| Separate-process proof builds | Identical complete `audio/SHA256SUMS`, including MP3 and metadata |
| Delivered WAVs | 44.1 kHz, stereo PCM24, each 176,400 frames |
| Stem sum vs master | Maximum error 1 PCM24 LSB after separate quantization; float sum within 1e-14 |
| Clipping | No full-scale samples in master or any stem; master -14.6 dBTP |

The focused tests check all 16 catalog mappings and native channel layouts against original source PCM, pitch rates and transposition, REACTOR's measured octave-up fundamental (110 Hz), shared motif onsets, transformed gestures, swing, off-grid and humanized timing, held and released notes, source exhaustion, output caps, silent notes, repeatable WAVs/metadata, committed deliverable integrity, clipping refusal, rack-only score/1 and score/2 bit identity, preserved rack seed indices, and direct CRUSH compatibility. The bridge never calls CRUSH itself.

Full-suite skips: six checks require unavailable FluidSynth; three historical byte/loudness comparisons require the exact recorded FFmpeg build. The existing V12 showcase also reports that its historical hash comparison is skipped for that build mismatch; its render, alignment and clipping assertions pass. No bridge test is skipped. The suite selected bundled FFmpeg 6.1.1; proof MP3 encoding/true-peak measurement used system FFmpeg 7.1.5. Node: 24.19.0. Byte determinism is established on this runtime/toolchain; floating math and MP3 bytes are not promised across different toolchains.

## Reproduce

```sh
node studio-001/v12-bridge/cli.ts proofs/v12-motif-bridge/proof.score.json /tmp/v12-proof-a --mp3
node studio-001/v12-bridge/cli.ts proofs/v12-motif-bridge/proof.score.json /tmp/v12-proof-b --mp3
cmp /tmp/v12-proof-a/SHA256SUMS /tmp/v12-proof-b/SHA256SUMS
node --test tests/v12-motif-bridge.test.ts
npm run typecheck
npm test
```

Run from the repository root with two unused output paths. Detailed file measurements are in [VERIFICATION.json](VERIFICATION.json); audio and event provenance are in [audio/](audio/). The proof has 20 notes: 8 SUB HAMMER, 6 REACTOR, 6 approved modal-bar notes. REACTOR and the rack phrase onsets are `0, 15504, 31008, 82688, 98191, 113695`; bar 2 begins at frame 82688, and the two-bar boundary is frame 165375. The 250 ms tail brings the delivery to exactly 4 s. This verifies routing/timing; musical development of FABLE, GRIND and BOLLO remains outside this change.
