Title: feat: integrate HEADLINER Float64/PCM24 production with locked SODIUM HOURS verification

Base: main (`e2962cc1a443c841cd6ca7cb2cc56c5ebabf0e99`)

Head: codex/production24-integration

Status: draft text prepared locally; no remote branch or GitHub PR created.

The existing HEADLINER workflow lacks a precision-aware delivery adapter, and legacy track exports quantize to PCM16 before the master sum. This candidate integrates #42, #39 and its dependent #41, then adds an explicit PCM24 production/package/replay route while preserving legacy rendering and all locked SODIUM HOURS artistic parameters.

The opt-in route keeps track processing and master summation in Float64, exports aligned PCM24 master/stems, and derives MP3 directly from the final master. It records authored mix/master settings, analysis, source/engine/adapter hashes, licenses and exact package membership. PCM16 sources remain PCM16; no source-resolution recovery or subjective improvement is claimed.

Integration order and exact reviewed heads:

1. #42 `35c466a638bebd070da5773d732737e9769d2f1f`.
2. #39 `39e56a9cab053382220dd3cb5a971a7d9369b522`.
3. #41 `7e8c484cc7e8593d0d7f4b3f972dea3b234d5729`, stacked on the exact #39 head.

Review fixes: reject foundation variation names that overwrite score/catalog/verification metadata; inventory separately loaded precision ducking sources; refuse all existing SODIUM output/sibling directories before rendering. Regression tests cover these failures. No version bump, default precision change, new synthesizer or new composition is included.

SODIUM HOURS validation:

- Ran its original canonical FLAC/hash/render verification first: all 163 sources, stored delivery, 15 stems and alternate pass. Integrated legacy master and all 15 stems also match the locked delivery.
- The unchanged project retains 15 tracks and 2,223 triggers. PCM24 master/stems are exactly 8,224,650 frames / 186.5 s; all trigger rounding checks pass, measured master lag is zero, and no export clips.
- Two independent complete PCM24 packages match all 221 files byte for byte, including MP3, source/generator inventory and metadata.
- Both masters measure −11.35 LUFS and −2.07 dBTP at reported precision. Unfitted PCM24-minus-PCM16 residual: −89.079711 dBFS RMS / −72.353880 dBFS peak. PCM24 retains a very low final-second tail; both end in 100 ms of exact silence.
- Original master SHA: `43da3fd7119f5add17ff9896e29d46123cdb1f214ea9fc8e7747513903f1e07d`.
- PCM24 master SHA: `93e08083ba191cb32ff0c3526712e35970d44cb0ba7135df505e953b92645f1c`.

Local checks: full suite has 347 cases, with 345 distinct cases exercised successfully and zero failures after resolving six PATH-dependent discovery skips. Five additional adapter/A/B/output-preservation tests pass. Source/build typechecks, full-audio installed package (10/10), hidden-tool package/smoke, share demo and 53 Python CPU tests pass. Four independent main/default/reuse comparisons preserve four masters, 25 stems, MIDI/default manifests; 80 adversarial cache cases pass.

Remaining gates: remote Node22/Linux/macOS and apt/rootless audio CI; exact Ubuntu FFmpeg historical GLASSHOUSE/GLASS//FIRE gates and SIGNATURE recorded-byte subcomparison; owner listening, license declarations and release-specific mastering approval. Local FFmpeg identifies as `6.1.1`, while those recorded gates require `6.1.1-3ubuntu5`. Assertions and fixtures remain unchanged. The new scoped PR workflow reuses existing full-audio jobs, retaining manual dispatch.

Reproduction and technical limitations: `docs/PRODUCTION24_INTEGRATION.md`, `docs/PRODUCTION24_SODIUM_RESULTS.md`, and `proofs/production24-integration/`.

The complete sealed SODIUM review delivery remains local, including the PCM24 master, aligned stems, original/PCM24 listening copies and source provenance. This PR proposes code and verification evidence. Merge, release and music publication remain outside scope.

Remote upload was blocked by automatic approval review, which interpreted the instruction to stop before publishing as prohibiting a branch push. Explicit branch-upload/draft-PR approval is pending. Do not enable auto-merge.
