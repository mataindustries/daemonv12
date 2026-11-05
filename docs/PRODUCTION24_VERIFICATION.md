# Production24: completed 180-second proof

The original full-length PCM24 job completed before the checkpoint was resumed.
Its complete directory, master, 15 stems and manifest were preserved. No active
precision render remained. The earlier `kill -TERM 976` targeted the old test
runner; it did not stop the PCM24 job. A second independent render to a new
directory now matches all 17 checked files: master, every stem and manifest.

The [committed master](../proofs/production24/audio/headliner-stress.24.wav) is
47,628,044 bytes. The [machine-readable verification](../proofs/production24/headliner-stress24.verification.json)
records every output hash, source identities, absolute event rounding, section
boundary crossings, tails and stereo/mono measurements. The [render manifest](../proofs/production24/headliner-stress.24.render.json)
records the signal path and all 15 stem identities. Large stem/replay files stay
in local `work/` output directories and can be reproduced without changing audio
sources or project defaults.

| Measurement | Result |
| --- | ---: |
| Duration / frames | 180.000 seconds / 7,938,000 |
| Tracks / onsets | 15 / 3,467 |
| Export | 44.1 kHz stereo, signed 24-bit PCM |
| Master sample peak | -7.481338 dBFS |
| True peak / integrated loudness | -7.38 dBTP / -20.95 LUFS |
| Loudness range | 11.3 LU |
| Master and stem pre-export clipping | 0 samples |
| Master full-scale samples | 0 |
| Stereo correlation | 0.935758 |
| Mono fold RMS change | -0.141824 dB |
| Low-band correlation / mono change | 0.996140 / -0.008392 dB |
| Last second / final frame | exact silence / `[0, 0]` |
| Actual unique interpolation work | 343,122,898 taps |
| Total cache buffers | 64,142,336 bytes |

Master SHA-256:
`21c72595aa9e0f297aec298651d404086d889ee3307a888cf23c1986b1f319c1`.
The bounds remain one billion actual taps and 128 MiB total cached buffers.
These bounds do not cover all full-length mixing/effect buffers or exported
stems; this is not a streaming renderer.

Each stem starts at sample zero and has the master's exact frame count. Every
resolved onset matches independent BigInt nearest-frame rounding. Sustained dry
voices cross every boundary at 15, 45, 60, 90, 105, 120 and 165 seconds. All track
and master effects run continuously through those boundaries. No independently
reset sections are joined. Local boundary deltas are retained as diagnostics;
they are not a perceptual seam test. Post-track stems quantize independently to
PCM24, while the master sums original Float64 tracks before its own processing.
Their exported sum is therefore not a byte-identical master reconstruction.

The source WAVs remain PCM16. This workflow preserves new fractional performance,
mix and effect detail; it does not recover original lost source precision.
Eight precision tests verify fractional-LSB survival, nonlinear processing,
safe float overload recovery, aligned deterministic output and failure cleanup.
A known fractional sine calculation has at least 46.99 dB less quantization
error in PCM24 than PCM16, with PCM24 error within half a 24-bit step. This is a
mathematical result for that calculation, not a listening or fidelity claim.

## Reproduce or verify saved output

Use Node `v24.19.0` and the configured FFmpeg `6.1.1` to reproduce these hashes.
Keep `DAEMONV12_FFMPEG` set to that pinned executable; a system `ffmpeg` with a
different build may change processing or provenance. The renderer proof branch
supplies `scripts/create-headliner-stress.ts` and the unchanged source packs.
When this milestone is stacked onto that proof branch, run from its checkout:

```sh
node scripts/create-headliner-stress.ts work/headliner-stress/input
node scripts/render-production24.ts work/headliner-stress/input/headliner-stress.json work/headliner-stress24 --reuse-voices
node scripts/render-production24.ts work/headliner-stress/input/headliner-stress.json work/headliner-stress24-replay --reuse-voices
node scripts/verify-production24.ts work/headliner-stress/input/headliner-stress.json work/headliner-stress24 work/headliner-stress24-replay proofs/production24/headliner-stress24.verification.json --stress
```

Both render commands require **new** output directories and never replace
existing renders. If those complete directories already exist, run only the
verification command. It hashes and measures the saved output without rendering
or removing anything. In the task workspace, the exact input is
`/workspace/daemonv12-forge003/work/headliner-stress/input/headliner-stress.json`;
the two PCM24 directories are under `/workspace/daemonv12-precision003/work/`.
Render wall time and peak memory were not captured for the first job and are
not asserted as benchmarks.

Validation completed after restoring the renderer import boundary:

```sh
SDL_AUDIODRIVER=dummy node --test tests/architecture.test.ts tests/precision.test.ts tests/production.test.ts tests/v07-articulation.test.ts tests/v07-budget.test.ts
npm run typecheck
node_modules/.bin/tsc --ignoreConfig --strict --noEmit --allowImportingTsExtensions --module nodenext --target es2023 --skipLibCheck --types node scripts/verify-production24.ts
```

The selected tests passed **41 tests, zero failures, zero skips**, including the
eight precision tests. Both typechecks passed. Test subprocess execution must be
enabled; a restricted sandbox previously returned `EPERM` for executable test
fixtures, which was an environment failure rather than a renderer regression.

The preserved earlier Signature showcase proof is 28.000 seconds / 1,234,800
frames, with no clipping, -14.23 LUFS and -1.62 dBTP. Its SHA-256 is
`79e8c3a85e1e3c0913964ffcc4740a4b91616bc41c4bc8234e2ed0598fb98a9f`.
It remains in `work/production24-showcase/`; no new render was needed to retain it.

## Provenance and remaining work

This is the independently implemented PCM24 milestone originally committed as
`48ee41e3d6e6e0237b7172c7695aaf8d531690fe`, subsequently stacked onto the bounded
renderer milestone. Existing Signature/MORPH assets are used unchanged at the
owner's request. Their commercial licensing and the code license still await
owner declarations. No license terms, release, publication, Composer defaults or
active composition branch are changed. General MIDI remains unsupported in this
experimental path; true higher-precision source assets require a later source
format extension. Human listening and release-specific mastering remain pending.
