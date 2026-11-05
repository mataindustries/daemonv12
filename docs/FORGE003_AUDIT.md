# DAEMON//FORGE 003: production-path audit

Baseline: `main` commit `e2962cc1a443c841cd6ca7cb2cc56c5ebabf0e99`, engine
`0.7.0`, project format 1. This audit reads only the isolated FORGE worktree and
an archive of that main commit. No active composition branch is a source.

## What prevents a dense three-minute render

Three minutes is already inside the **600-second** sample/production duration
limit (`src/render/pcm.ts`, `MAX_PCM_FRAMES`). Duration alone is not the blocker.
The project-wide transformed-voice work budget, repeated interpolation and full
track buffering are the practical constraints.

| Constraint | Exact baseline behavior | Production consequence |
| --- | --- | --- |
| Interpolation work | `src/sample-render.ts`, `playbackBudget`, sums `voiceCost.work` over every sampled trigger across all tracks. `src/render/playback.ts` fixes `PLAYBACK_WORK_LIMIT` at **1,000,000,000 taps**. Asset-aware compilation rejects the project before rendering. | Repeating a short, identical repitched musical phrase charges and computes the same interpolation again. The 28-second Signature showcase uses about 58% of this budget; extending its density to 180 seconds cannot use the unchanged route. |
| Rate coupling | `playbackPosition` is the integral of playback rate. For constant rate, output frames are `ceil((end-offset)/rate)`. Glide ends at an absolute musical frame. | Higher notes exhaust sooner; vibrato and timbral gestures baked into the source speed up with pitch. Gates cannot extend a source. This is resampling, not time stretching. |
| Sustains | `voiceFrames` caps at source exhaustion, gate/choke plus release, and permitted output. There are no sustain loops or resumable synth voices. | Long pads must have sufficient authored source material, be retriggered deliberately, or be generated at the required pitch/duration beforehand. Repeating sources without a tested seam is not continuous sustain. |
| Performed voice memory | `voiceCost.bytes = renderedFrames × sourceChannels × 8`; **128 MiB** per transformed voice. Root-rate/no-glide voices use source views. | Extremely slowed stereo sustains can fail independently of the tap budget. Gates/endpoints reduce the real work and memory. |
| Tracks | `src/project/validate.ts` enforces **1–15 tracks**, irrespective of instrument type. This originated in the MIDI channel allocation contract. | Sample tracks inherit a MIDI-era limit. Raising it globally would alter accepted-project behavior and does not solve interpolation/memory cost. More layers can be authored into documented pre-rendered stems, subject to the same headroom and provenance checks. |
| Repeated cost | `sumFloat` and `mixPcm` call `voiceSamples` for each trigger. The baseline has no persistent transform cache or artifact dependency graph. Every render recomputes full tracks/effects. | Reusing identical transform results is a smaller first change than introducing section rendering and stateful effect checkpointing. A cache must have explicit memory/work bounds and deterministic invalidation. |
| Full-track memory | Production builds stereo `Float64Array`s for source summation, gain/pan and effects, then keeps decoded s16 track elements for the master. FFmpeg serialization also allocates input and output buffers. | One 180-second stereo Float64 array is **127,008,000 bytes**; a stereo s16 track is **31,752,000 bytes**, excluding WAV headers. Fifteen retained track elements alone approach 476 MB. A bounded interpolation cache does not make the entire production pipeline streaming. |
| Effect state and tails | Ordered effects run on complete track buffers, then on the complete master. FFmpeg handles IIR filters, compressor and single-tap delay; `builtinEffect` owns reverb/saturation. `renderPlan` caps/pads at absolute frames. | Cutting the arrangement into independently rendered sections resets IIR, compressor and reverb state and can discard releases. A short overlap is not a general proof of equivalence. |
| Automation | `automatedGainPan` applies absolute gain/pan values. Before the first point use static mix; a point's transition governs its outgoing segment. Gain interpolates in dB at absolute frames. | Cropping sections requires preserving the lane's entering state and global frame origin. Applying each section's first point at local zero changes the mix. |
| Stem alignment | Production pads/trims every post-track/pre-master stem to the master's exact frames. Master gain/effects/ducking do not belong to the stems. | Assembly must preserve origin and duration across stems and must apply the master chain once, after summation. |

The billion-tap estimate bounds the actual interpolation kernel conservatively;
stereo shares weights and therefore costs memory rather than twice the tap count.
At rates ≤1, the estimate uses about 71 taps/output frame. Faster rates widen the
anti-alias kernel. Gates, source ends, real track-local chokes and output caps
reduce the charged rendered frames. Same-frame grouped voices coexist. A choke
group does not cross tracks. These are checked in `tests/v06-budget.test.ts` and
`tests/v07-budget.test.ts`; they must remain safety gates on the default route.

## Smallest reliable first solution

Use an explicit opt-in, bounded transform/pre-render stage, then render complete
aligned tracks and the complete master continuously through existing processing.
Retain the original global frame schedule, source phase and resolved articulation.
Reuse identical computed voices without resetting read positions or quantizing
Float64 intermediate samples. This avoids introducing arbitrary audio joins.
Separate work accounting must represent the computations actually performed; it
must reject a too-large unique workload rather than disable the billion-tap
guard. Cache capacity and individual voice buffers also require hard bounds.

A raw transformed-voice identity must cover the actual PCM source identity,
rate, offset, glide endpoint and duration in frames, explicit source endpoint,
and computed output length. An envelope is applied outside `voiceSamples`, but
its stop/release can change that length, which in turn changes endpoint-envelope
placement. A render cap can shorten two otherwise equal notes differently.
Cache hits must not reuse a voice from a different source with the same length.

The meaningful equivalence check is exact master and stem bytes against a
single continuous render for projects that fit both paths. Include glides,
chokes straddling nominal section points, dense simultaneous voices, gain ramps,
delay/reverb across points, and a final output cap. Different cache capacities or
processing batch sizes must not alter the sound. Full-length replay hashes,
frame counts, clipping, local boundary deltas and mono measurements supplement
that equivalence test; low boundary energy alone does not establish continuity.

## Precision and release-export limitations

The baseline accepts only PCM16 mono/stereo 44.1 kHz sample assets
(`src/render/pcm.ts`, `decodePcm`); FluidSynth is configured for s16. Interpolation
and production gain/effects use Float64, but precision is lost at three places:

1. `sumFloat` rounds each voice after velocity/envelope multiplication to signed
   16-bit sample units, before track processing.
2. `processTrack` quantizes every processed track to s16 and decodes those bytes
   to form the master's inputs. Track overload is therefore irreversible even
   if master gain later turns the sum down.
3. Final `quantize` writes s16 with no dither or normalization.

The FFmpeg effects boundary already uses `f64le` without an integer WAV in the
middle, so it can carry meaningful fractional-LSB processing. A real opt-in
24-bit route must retain that precision through track summation and final
quantization, and clearly disclose PCM16 source/GM limitations. Converting the
finished s16 master to s24 only pads zeros and is not a fidelity improvement.
Tests should exercise fractional-LSB gain signals and recovery from track levels
above full scale before a safe final master gain. Deterministic file headers
should be owned by the engine; libsndfile timestamp-bearing float WAV is not a
deterministic intermediate container merely because its audio samples repeat.

Peak/RMS and full-scale sample counts are engine-measured PCM properties.
FFmpeg loudnorm supplies integrated LUFS, loudness range and oversampled true
peak. Neither establishes musical quality or audibility. Mono cancellation and
stereo correlation require separate measurement; no listening is claimed here.

## Provenance and licensing

Signature and MORPH generators are original or source-documented repository
synthesis, but their provenance documents explicitly say **licensing awaits the
owner's declaration**. Authorized use inside this requested repository work is
not a statement of commercial clearance or a new license grant. Existing CC0
packs keep their existing status. FORGE must not relabel any pack, code or
derived demonstration as CC0 or commercially licensed without owner action.

## Verification status

Runtime checked on 2026-11-05: Node `v24.19.0`, FFmpeg `6.1.1` with effects,
MP3 and loudness support. The initial FluidSynth doctor probe timed out in this
headless environment. The root agent subsequently verified FluidSynth `2.3.7`
and all doctor readiness flags using the command-local environment
`SDL_AUDIODRIVER=dummy`; no project or engine default was changed. The configured
SoundFont bytes parse and hash to
`74594e8f4250680adf590507a306655a299935343583256f3b722c48a1bc1cb0`.
The full-length proof uses approved existing sampled sources and requires no GM.

Independent comparisons rendered four real shipped projects from archived main,
the modified default route, and the opt-in reuse route: MORPH sync demo, ONE
SOUND after, GHOST//SHIFT, and the Signature showcase. All **master, MIDI and
25 stem file hashes** matched across all three routes. All four default manifest
file hashes also matched main; opt-in manifests intentionally add reuse
provenance. The [retained report](FORGE003_LEGACY_VERIFICATION.json) records the
individual hashes and runtime. Eighty seeded adversarial cases additionally
compared capped Float64 mixes and uncapped PCM mixes exactly, including distinct
same-shaped sources, glides, source ends, changing envelopes/velocities and caps.

The independent review found the cache's source-scoped identity, unrounded
Float64 values, per-onset envelopes and continuous effect processing consistent
with exact audio reuse. A renderer-boundary import issue was corrected before
the implementation milestone. No audio equivalence defect was found in these
checks. This is bounded technical evidence, not proof over every possible input
and not a human listening review.

Reproduce the independent comparison without checking out or reading any active
composition branch (allow several minutes for twelve complete renders):

```sh
mkdir -p /tmp/forge003-main-archive
git archive e2962cc1a443c841cd6ca7cb2cc56c5ebabf0e99 | tar -x -C /tmp/forge003-main-archive
node scripts/verify-voice-reuse-legacy.mjs /tmp/forge003-main-archive /tmp/forge003-legacy
cmp /tmp/forge003-legacy-verification.json docs/FORGE003_LEGACY_VERIFICATION.json
```

The final comparison expects the recorded runtime/tool versions. New environments
can still check all within-environment equivalence assertions; their manifest
hashes may differ from the retained report. To re-hash those retained outputs
without rendering again, add `--existing`; this checks the audio files themselves
and reruns all eighty adversarial cases. The script never modifies its baseline
source archive or the committed report.
