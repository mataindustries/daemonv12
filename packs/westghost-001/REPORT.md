# WEST//GHOST 001 · prototype validation

All four native performance prototypes, four dry auditions and three musical
studies are complete. The seven projects contain 350 events and 17 stems. This
pack is independent of the renderer/export work and was developed from main
`e2962cc1a443c841cd6ca7cb2cc56c5ebabf0e99` without changing the engine or Composer
defaults. Existing formatVersion 1 v0.7 projects remain the playback format.

No human listening evaluation was performed. The results below establish
reproduction, timing and measured headroom; they do not establish release
quality. Commercial licensing awaits the owner's declaration. See
[PROVENANCE.md](PROVENANCE.md).

## Delivered audio

Every row has a stereo PCM16 WAV, 192 kbps MP3, MIDI, render manifest, analysis
and sample-aligned stems in [`audio/`](audio/). Sources are mono at 44.1 kHz.
The MP3s are audition copies; exact replay comparisons use the WAVs and their
supporting artifacts.

| Study | Seconds | Frames | LUFS-I | True peak dBTP | Stems |
| --- | ---: | ---: | ---: | ---: | ---: |
| Dry GRAVITY | 16 | 705600 | -14.43 | -10.34 | 1 |
| Dry VANDAL | 16 | 705600 | -18.69 | -10.12 | 1 |
| Dry APPARITION | 16 | 705600 | -17.31 | -10.46 | 1 |
| Dry IRON//BLOOM | 16 | 705600 | -17.87 | -9.97 | 1 |
| A · GRAVITY + VANDAL | 32 | 1411200 | -19.51 | -5.95 | 5 |
| B · APPARITION | 24 | 1058400 | -18.10 | -9.77 | 4 |
| C · IRON//BLOOM | 24 | 1058400 | -23.53 | -10.22 | 4 |

These levels retain demonstration headroom. They have not been normalized to a
release loudness target. All master and track clipping counts are zero.

## Checks completed

- Independent synthesis regenerated all 249 generated files byte for byte,
  including eight reference performances, native event assets, portable kits,
  project files and performance/source metadata. Sources are identified by
  performance inputs and generator SHA-256 hashes.
- Each of the seven projects was rendered in two independent output directories.
  Every master WAV, stem WAV, MIDI, analysis and render manifest matched exactly.
  Existing successful A audio was retained. Saved renders are reused only after
  their project, source-asset and export hashes pass verification.
- Every stem has its master's exact frame count. Event starts use the engine's
  absolute `ticksToFrames` conversion and rounded microseconds-per-quarter tempo.
  Full-score preflight rejects a source whose rounded gate plus release exceeds
  the last available output frame. No concatenation or splice operation is used.
- Each source begins and ends at exactly zero, with a fixed 4 ms endpoint fade.
  Pitch slides integrate oscillator phase within the note. The slide landing
  and steady GRAVITY pitches at MIDI 26, 38 and 50 pass the autocorrelation-based
  tuning checks. This does not measure perceived intonation or cross-note legato.
- All sources are mono. The largest measured context mono-fold energy change is
  0.0174 dB; below 150 Hz it is 0.00119 dB. The low-band method is two cascaded
  one-pole low-passes, comparing summed mono energy with mean channel energy.
  This is an energy/fold-down check rather than a listening judgment.
- Seven instrument tests and three architecture tests pass, with zero skips.
  Tests cover independent pitch/duration, deterministic noise, sustained control
  movement, pressure response, 32 range/articulation/control endpoint cases,
  pitch slides, invalid-input and processing budgets, exact score boundaries,
  reference hashes and unchanged Node-only sampler playback. Repository
  typecheck and a strict standalone verifier typecheck pass.

The complete numeric result and master/stem hashes are in
[`westghost001.verification.json`](westghost001.verification.json). Each
`.sources.json` holds all native source hashes; each `.render.json` identifies
the project, playback sources and exports. [`SHA256SUMS`](SHA256SUMS) additionally
covers this milestone's delivered files and generator/test sources.

## Reproduction and retained checkpoints

The verified runtime is Node v24.19.0 and FFmpeg 6.1.1. All delivered and
independent replay manifests identify FFmpeg 6.1.1. Bit identity across other
JavaScript or FFmpeg versions has not been established. The engine supports
Node 22.18+, but this pack's exact byte proof uses the versions above.

From the repository root, after configuring FFmpeg 6.1.1 through
`DAEMONV12_FFMPEG` as described in `docs/DEVELOPER_SETUP.md`:

```sh
export DAEMONV12_FFMPEG=/workspace/.daemonv12-audio/runtime/bin/ffmpeg
node scripts/generate-westghost.ts work/westghost-fresh
npm run typecheck
node --test tests/westghost.test.ts tests/architecture.test.ts
node_modules/.bin/tsc --ignoreConfig --noEmit --target es2023 --module nodenext --moduleResolution nodenext --types node --strict --allowImportingTsExtensions --erasableSyntaxOnly --noUncheckedIndexedAccess --skipLibCheck scripts/verify-westghost.ts
node scripts/verify-westghost.ts --deliver
sha256sum -c packs/westghost-001/SHA256SUMS
```

The export line is the exact path used in this cloud checkpoint. On another
machine, set it to the local FFmpeg 6.1.1 executable.

`verify-westghost.ts` keeps source-regeneration evidence and first/replay audio
under the ignored `work/westghost-verification/` directory. It validates and
reuses complete checkpoints. Partial or mismatched directories are preserved
and cause an explicit failure for inspection. To make another fully fresh
verification without erasing evidence, rename that directory before rerunning.
The verifier passes its configured environment to each render subprocess.

For one musical study, the ordinary v0.7 command is:

```sh
node bin/daemonv12.js render packs/westghost-001/b-apparition.json --stems --format wav,mp3 --out-dir work/westghost-apparition-audition
```

## Limits and remaining work

Native synthesis accepts bounded control curves, not real-time MIDI input.
Each trigger starts independent phase; a continuous slide belongs inside one
event. Thirty-second gates, five-second releases, 128 points per control,
128 unique performances per track and a 600-second unique-source job budget
bound processing. Long material can be authored as documented intermediate
scores. No existing safety budget is bypassed.

VANDAL uses 2x oversampling and a fourth-order 9 kHz low-pass before decimation.
APPARITION caps voiced partials below 8 kHz; IRON//BLOOM tapers high modes before
Nyquist. Nonlinear stages are not certified alias-free. The report's aggregate
energy above 16 kHz at one steady test pitch is a diagnostic, not an alias
measurement or a guarantee across the full range.

The sounds are approximate original synthesis designs, not calibrated physical
objects or modeled human voices. All voices are mono; stereo instrument design,
human listening revision and translation checks remain. Source audio is PCM16:
Float64 synthesis followed by quantization does not preserve 24-bit source
detail. The separate production precision milestone is not implied by this
pack. Owner rights declarations and listening approval remain necessary before
a commercial release.
