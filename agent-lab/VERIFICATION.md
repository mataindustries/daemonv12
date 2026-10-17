# Agent Lab v0.1 verification

Verified 2026-10-17 from latest main
`ea9dfbcef4ac54698313c300640ed0a7be74059e`, on
`feat/agent-lab-v01`. Runtime: Node v24.19.0, Linux x64, FFmpeg 6.1.1
(the configured rootless audio toolchain). No external AI API was used.

## Focused checks

`npm run test:agent-lab`: **5 passed, 0 failed, 0 skipped**.

The real-PCM suite verifies complete bundle content hashes across repeat runs,
source/project/asset immutability, source and candidate validation, matched
whole-track/window lengths and headroom, metadata-free anonymous WAVs, private
key permissions and commitment, post-score identity reveal, ties, score/audio
integrity, output collision preservation, missing/invalid/duplicate candidates,
bad windows, stale pins, exact-duration failure, clipping and unmeasurable audio.
It also replays a self-contained snapshot bundle and compares all listening
WAV hashes. Dedicated checks reject one-frame onset drift, quiet/peak gate
failures, and a deliberately sabotaged FFmpeg gain pass; failures publish no
bundle and leave earlier outputs untouched. Scoring tests use explicitly
synthetic test scores; they are not listening judgments.

## Repository checks

`npm run check`: typecheck passed; **295 tests: 287 passed, 0 failed,
8 skipped**. Six skips require FluidSynth, which is unavailable to these legacy
integration tests; two require the recorded FFmpeg 6.1.1-3ubuntu5 build rather
than this runtime's 6.1.1 build. No tests were disabled for this change.
`git diff --check` and all new executable-module syntax checks passed.
Engine source, historical examples, Composer and existing benchmark tools have
no changes relative to main.

## Private PRE-ECHO 001 benchmark

The supplied source ZIP was available and used. No attached scripts were run.
All 74 extracted files were compared byte-for-byte against their ZIP entries
after execution; none changed. The source WAV reproduced the authoritative hash
recorded in the archive. The private source and generated audio are excluded
from Git.

The final run used three authored variations of room balance/filtering,
pressure gain arc, and background spatial placement/filtering. Contact sources,
source offsets, envelopes and schedules were retained.

- Three distinct valid project and master hashes.
- Source plus three candidates: eight repeated engine renders, each master,
  MIDI, manifest, analysis and stem set identical within its repeat pair.
- Duration: 529200 frames each (12 s at 44100 Hz).
- Listening window: frames 308700–441000 exclusive (7–10 s), 132300 frames.
- Three complete trigger lists, four measured contacts and final silence:
  eight timing checks on each of four projects, **32 passes**.
- Contact frames: 66150, 198450, 374850 and 383670, within the declared ±1 frame
  onset tolerance. Final second stayed below −80 dBFS.
- Requested target −23 LUFS; shared effective target **−27.7 LUFS** to preserve
  peak headroom. Static gain only; no limiter. Measured full-track range:
  **−27.70…−27.69 LUFS**. Highest measured true peak across full tracks and
  listening windows: **−1.11 dBTP**, below the −1 dBTP ceiling. No clipping.
- Each full listening copy encoded twice with identical hashes; selected
  excerpts were measured and verified separately for length and peak headroom.
- Identity key, hypotheses, changes, source hashes and all measurements stayed
  in private artifacts. Public files contain only A/B/C audio, generic listening
  metadata, the key commitment and a blank score template.

No real human scores were supplied, so **no creative winner is claimed**.

## Workflow counts and limits

For PRE-ECHO, the current direct interfaces require at least three renders
(which already validate) plus three gain commands: at least six commands,
plus window/analysis, timing, provenance and blind packaging work. Separate
explicit preflight validation adds three optional commands (nine total).
The existing BANGER copy utility needs three renders plus one copy command
for its supported 15/75-second pools, but cannot package this 12-second fixture.
Agent Lab needs one pin setup command, one comparison command, and one separate
evaluation command after human scoring. Its optional PRE-ECHO helper adds one
fixture/candidate preparation command. Historical intervention counts and token
usage were not measured; no token, time or musical-quality savings are claimed.

The runtime pin is not a hermetic container: shared libraries, kernel and CPU
behavior are not fully captured. GM pinning uses the existing pipeline but was
not exercised by this sample-based benchmark. Detector thresholds are declared
signal checks, not perceptual judgments. A trusted preparer must keep private
inputs, seed, organizer package and preparation logs away from judges; permissions
cannot prevent the same OS user from reading the key. Interrupted processes can
leave unpublished staging directories. See README.md for usage and repairs.
