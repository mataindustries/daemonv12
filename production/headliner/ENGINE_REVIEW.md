# Optional engine integration review

Reviewed 2026-11-05 against main `e2962cc1a443c841cd6ca7cb2cc56c5ebabf0e99`:

- PR #39: `39e56a9cab053382220dd3cb5a971a7d9369b522`.
- PR #41: `7e8c484cc7e8593d0d7f4b3f972dea3b234d5729`.

## Recommendation

Ship the reusable starter independently on v0.7/main. SODIUM HOURS already completed there without voice reuse. Neither upgrade is necessary for deterministic source generation, multisamples, pre-bounced phrases, sections, variations, WAV/MP3, aligned stems or project packaging. No engine changes were merged and no existing full-length audio proof was rerendered during this review.

If the optional engine work is adopted later, integrate **#39 first, then #41**. Git ancestry confirms #39's final head is an ancestor of #41's head; #41's base is `forge/003-headliner-engine`, not main. Review/rebase that stack onto the then-current main, run the targeted checks, and preserve existing default byte fixtures. Do not cherry-pick #41 alone: its `sampleTriggers`, `CompilationOptions.reuseVoices`, `VoiceSampleCache` imports depend on #39.

## Compatibility findings

**#39** adds explicit CLI/API opt-in interpolation reuse. Cache identity includes source PCM object, rate, offset, glide, explicit endpoint and actual rendered length; velocity/envelope gain stays per onset. It caches unrounded source values and leaves summation/rounding order intact. Full track/master effect state stays continuous. Default CLI, project schema, MCP and Composer remain unchanged. MCP has no reuse flag, so dense projects must use CLI/API. Unity-rate phrase/multisample playback already avoids interpolation; caching supplies little benefit there.

Preflight and runtime retain the one-billion interpolation-tap limit and 128 MiB per-voice limit, adding a 128 MiB total cache limit. No eviction/recomputation bypass is introduced. Many distinct rate/glide/slice combinations can exhaust cache even if uncached rendering fits. Full-length Float64 memory usage, 15-track/600-second limits and finite source sustains remain; reuse is neither streaming nor time stretching.

**#41** correctly avoids both per-voice integer rounding and the PCM16 track round trip: fractional voice processing, track gain/automation/effects and master processing stay in Float64 until independent PCM24 exports. The fractional-signal test distinguishes this from upconverting a quantized master. Inputs remain PCM16; original high-precision synthesis detail already quantized in assets cannot be recovered. GM is explicitly rejected.

The optional command is `node scripts/render-production24.ts PROJECT NEW_OUTPUT [--reuse-voices]`, not an extension of normal `render`. It requires a new output directory and FFmpeg, emits PCM24 master/stems and its own manifest, and does not emit MP3 or MIDI. The normal starter should continue using the ordinary WAV/MP3/stem route. A future PCM24 adapter must handle this different naming/manifest contract and derive MP3 from the PCM24 master if desired. Do not pass PCM24 files back as native project assets. PCM24 stems are aligned post-track/pre-master exports; they are independently quantized and their sum need not match the float-summed master byte for byte. Exported stem overload is reported independently of master overload.

No blocking incompatibility was found for using the proposed starter alongside these opt-in branches. No subjective sound approval is implied.

## Targeted verification actually run

Node `v24.19.0`, existing configured audio tools, isolated worktrees. Only the short fixture renders invoked by these tests ran. The stress-fixture test generates/validates its score and assets; it does not render its 180-second song.

At #39 head:

```sh
node --test --test-isolation=none --test-reporter=spec tests/voice-reuse.test.ts tests/architecture.test.ts tests/v06-budget.test.ts tests/v07-budget.test.ts tests/v07-pipeline.test.ts tests/headliner-stress.test.ts
npm run typecheck
node node_modules/typescript/bin/tsc -p tsconfig.build.json
```

Result: **26 passed, 0 failed, 0 skipped**; both typechecks passed. Covers default refusal paths, exact cache/master/stem equality, cache source/bounds identity, aggregate preflight failure before tools, gates/glides/chokes/automation, continuous effect tails and CLI opt-in handling.

At #41 head:

```sh
node --test --test-isolation=none --test-reporter=spec tests/precision.test.ts tests/voice-reuse.test.ts tests/architecture.test.ts tests/v06-budget.test.ts tests/v07-budget.test.ts tests/v07-pipeline.test.ts
npm run typecheck
node node_modules/typescript/bin/tsc -p tsconfig.build.json
```

Result: **33 passed, 0 failed, 0 skipped**; both typechecks passed. Additional coverage: known fractional signal retained below one PCM16 step; <=0.5 PCM24-step error; float/cache equivalence; real FFmpeg filtering/loudness; deterministic aligned PCM24 stems; clipping/padding/cancellation; GM refusal and failed-output cleanup.

The initial sandboxed subprocess assertions failed with `spawnSync ... EPERM` and empty child stdout; the same tests passed once the execution environment permitted child process I/O. This was an environment restriction, not a source change. The commands above are the successful checks.

## Follow-up tasks

1. Keep #39/#41 optional and separately reviewed; rebase/test the stack when integration is authorized.
2. If dense repeated material needs reuse, add an explicit starter adapter with capability detection and preserve the v0.7 default path; keep preflight failures visible.
3. If PCM24 deliverables are required, add a separate adapter covering its manifest/naming/stem semantics, MP3 derivation and package verification, with a short fixture only.
4. Treat native PCM24/float source support, sustain looping/time stretching and streaming memory use as separate future engine decisions.
