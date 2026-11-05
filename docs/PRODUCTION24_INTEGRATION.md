# Production24 integration candidate

This is a review candidate for the optional v0.8 production workflow. It is not a
versioned engine release. Engine version, existing project schemas, CLI/MCP/Composer
defaults and historical source files remain unchanged. No PR is merged and no music
is published by this work.

## Integrated heads and review

| Order | PR | Reviewed head | Actual dependency |
| --- | --- | --- | --- |
| 1 | #42 HEADLINER foundation | `35c466a638bebd070da5773d732737e9769d2f1f` | main `e2962cc1a443c841cd6ca7cb2cc56c5ebabf0e99` |
| 2 | #39 bounded voice reuse | `39e56a9cab053382220dd3cb5a971a7d9369b522` | same main |
| 3 | #41 Float64/PCM24 | `7e8c484cc7e8593d0d7f4b3f972dea3b234d5729` | exact #39 head |

The integration uses ordinary local merge commits in this order, with no conflicts.
#42's exact-head portable checks were green, but code review reproduced a blocking
metadata collision: variations named `score`, `catalog` or `verification` could
overwrite canonical package files. This candidate rejects those names before any
writes; regression tests include all reserved names. The original #42 therefore
needs this fix before independent merge.

Focused review of #39/#41 found no further blocking engine defect. The candidate
also records the separately loaded ducking source hash in the precision manifest.
The project and source assets remain byte-preserved; no synthesizer, composition,
arrangement or instrument parameters are added or changed for SODIUM HOURS.

## Optional production delivery

See [HEADLINER_PRODUCTION24.md](HEADLINER_PRODUCTION24.md) for the general API and
CLI. `scripts/headliner-production24.ts` connects the existing foundation to the
Float64 renderer without altering ordinary rendering. Processing and master sum
remain Float64 until independent PCM24 master/stem exports. The MP3 is encoded
directly from the final master. Authored track/master settings, measured loudness,
headroom, toolchain, engine/adapter source hashes, canonical input hashes and rights
documents accompany a sealed exact file set.

All current source WAVs remain PCM16. Newly calculated fractional processing detail
survives; original quantization loss does not disappear. PCM24 encoding and nonzero
low bytes alone do not prove higher source resolution. Mathematical precision
tests establish that this path avoids the legacy track quantization round trip.

## Reproduce SODIUM HOURS

Keep a separate original worktree at the immutable reference commit. Canonical
FLAC restoration is intentional; do not regenerate the instruments or song.
The workflow first invokes the original `verify-delivery.sh`, checking 163 source
WAV hashes, stored delivery hashes, 15 restored stem hashes, the alternate, and a
fresh original-engine render. It then checks the integrated legacy master and all
15 stems against the locked delivery before rendering PCM24.

From this integration checkout, with dependencies installed:

```sh
git fetch origin claude/peaceful-bardeen-f7swi8
git worktree add --detach ../daemonv12-sodium-original 6b1ab7b8f1602bd4e57244b16caee68d8876336f
npm ci
node scripts/sodium-production24.ts ../daemonv12-sodium-original work/sodium-hours-ab-new
```

Use new output paths. Pin Node `v24.19.0`, `DAEMONV12_FFMPEG` to the recorded
FFmpeg `6.1.1` executable, and FFmpeg on PATH for canonical FLAC restoration.
The checked environment used system FFmpeg `7.1.5-0+deb13u1` for lossless decoding;
every decoded WAV must match its canonical hash. The original master hash is
`43da3fd7119f5add17ff9896e29d46123cdb1f214ea9fc8e7747513903f1e07d`.

The command produces a delivery containing `original/`, `production24/` and
`verification/`, plus independent replay and legacy-render directories beside it.
It verifies the complete replay package byte for byte and compares the masters'
timing, level, phase/mono proxies, transients, residuals and section boundaries.
The PCM16 and PCM24 listening copies use identical encoder settings, without gain
changes or loudness normalization; the historical MP3 is also preserved.

Read-only saved-output checks:

```sh
node scripts/headliner.ts hashes work/sodium-hours-ab/production24
node scripts/headliner.ts hashes work/sodium-hours-ab-replay
node scripts/verify-sodium-production24.ts ../daemonv12-sodium-original/headliner-001 work/sodium-hours-ab/production24 work/sodium-hours-ab-replay work/sodium-hours-ab-check.json
node scripts/headliner.ts pack work/sodium-hours-ab work/sodium-hours-ab.tar.gz
sha256sum work/sodium-hours-ab.tar.gz
```

The original project, source catalog, generator code and original rights inventory
are copied with the candidate. The original branch's tracked tree and locked
master must remain unchanged before and after all measurements. The committed
proof report and measured results accompany this document.

## Completed local SODIUM HOURS result

Both production packages match all **221 files** byte for byte, including the
master, 15 stems, MP3, canonical sources and metadata. The unchanged project has
15 tracks, 2,223 triggers and 163 canonical PCM16 sounds. Both masters are exactly
8,224,650 frames / 186.5 seconds; the measured best lag is zero frames.

The PCM24 master SHA-256 is
`93e08083ba191cb32ff0c3526712e35970d44cb0ba7135df505e953b92645f1c`.
Both versions measure -11.35 LUFS, 6.2 LU loudness range and -2.07 dBTP at the
analyzer's reported precision. No master or exported stem clips. The unfitted,
sample-aligned residual measures -89.079711 dBFS RMS / -72.353880 dBFS peak.
PCM24 retains a low-level tail during the final second (-98.217054 dBFS peak)
where the PCM16 output is zero; both final 100 ms are exact silence.

See [the detailed measured comparison](PRODUCTION24_SODIUM_RESULTS.md) and
[machine-readable evidence](../proofs/production24-integration/sodium-hours.ab.json).
These measurements do not establish subjective improvement or additional source
resolution.

## Verification and release boundaries

Portable CI runs the existing Node 22/24 and package Linux/macOS matrix. A narrowly
scoped Production24 PR workflow reuses the existing full-audio apt and rootless
bootstrap jobs; the manual full-audio trigger remains available. Local logs record
the full suite with real tools, build checks, installed-package checks, hidden-tool
smoke, Python CPU proofs, independent legacy comparison, and focused adapter/A/B
tests. Sandbox child-process I/O initially failed with EPERM; successful reruns used
an execution context permitting subprocess I/O, with assertions unchanged.

Local suite coverage: 347 cases, with 345 distinct cases exercised successfully
and zero failures after resolving six PATH-dependent discovery skips. The two
historical FFmpeg-build gates remain unavailable; the SIGNATURE test's recorded
byte subcomparison has the same build limitation. Five additional adapter/A/B/
output-preservation tests pass. Full-audio installed package checks pass 10/10;
hidden-audio package checks pass 9 with the intentionally unavailable full-audio
case covered by the full run. Python CPU proofs pass 53/53. Four independent main/
integration legacy comparisons preserve four masters, 25 stems, MIDI and default
manifests, plus 80 adversarial cache cases. Source and build typechecks pass.

**Remote status:** no branch was uploaded. Automatic approval review rejected
the push as conflicting with the request to stop before publishing. A concrete
local branch, draft PR text and delivery are prepared for approval; no GitHub PR
or remote CI result is claimed. Node 22/Linux, macOS and the remote apt/rootless
audio matrix remain required before merge/release.

Boundaries and release blockers:

- Human listening and release-specific mastering approval remain pending. Metrics
  identify technical differences and cannot establish subjective improvement.
- Generated sounds, composition and engine code require owner license declarations.
  The copied inventory grants no new rights or commercial clearance.
- GM is unsupported by the precision path; native PCM24/float inputs are not added.
- Aligned stems are post-track and pre-master. Each is quantized separately; their
  sum does not reconstruct the Float64-summed and master-processed export exactly.
- No normalization or dither is added. This is a deliberate, explicit export policy;
  any delivery-specific mastering policy needs a separate reviewed decision.
- The renderer retains full buffers. The 600-second, 15-track, one-billion-tap and
  128 MiB performed-voice/cache limits remain; cache bounds do not bound total render
  memory. It is not a streaming workflow.
- Exact output hashes are specific to the recorded runtime/toolchain. Cross-platform
  bit identity is not certified. MP3 is a listening format with encoder delay.
- Historical GLASSHOUSE/GLASS//FIRE golden gates and the SIGNATURE prerecorded
  byte subcomparison require FFmpeg `6.1.1-3ubuntu5`; this runner identifies as
  `6.1.1`. The assertions and fixtures remain unchanged. Complete those gates and
  remote CI after branch-upload approval.
- Stop before merge, release or publication. The draft PR and local delivery are
  review artifacts, not authorization to distribute the song.
