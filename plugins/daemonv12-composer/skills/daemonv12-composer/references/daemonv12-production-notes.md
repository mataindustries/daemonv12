# DaemonV12 production notes

Verified for Composer **0.3.0** against engine **0.7.0**, project
`formatVersion: 1`, repository commit
`02438eda48506a94d10ad2756c6aafff8c5a9469`. Paths are relative to the **engine
repository root**, not this portable plugin. For a different engine revision,
read its current docs and implementation before relying
on these contracts. Do not change rendering behavior to fit the workflow.

Read the specs cumulatively: `docs/V0_SPEC.md` supplies the GM baseline;
`docs/V0_2_SAMPLES.md`, `docs/V0_3_AUDIO.md`,
`docs/V0_5_TIMELINE_DYNAMICS.md`, `docs/V0_6_SAMPLE_PERFORMANCE.md` and
`docs/V0_7_SAMPLER_ARTICULATION.md` extend it. The v0.7 contract supersedes older
sample-end/release/choke statements; read `docs/V0_7_REVIEW_HANDOFF.md` for review evidence.
Old “not supported/deferred” statements and pack README comments can describe an
earlier release. In particular, the current engine **does** support rate-based
sample repitching, gain/pan automation, compression, reverb and saturation.

## Establish the actual environment

From the engine checkout, use the existing CLI:

```sh
node --version
node bin/daemonv12.js --version
node bin/daemonv12.js doctor --json
node bin/daemonv12.js render examples/sample-only-demo.json --out-dir renders/composer-smoke --json
```

Node must be 22.18.0 or newer. Follow `docs/DEVELOPER_SETUP.md` for `npm ci` and
missing tools. Doctor probes availability; a real render verifies operation.
Its exit code 3 can mean an unused capability is unavailable: inspect individual
`readiness` flags. Plain sampler/drum-kit WAV rendering needs only Node; GM also
needs FluidSynth and a SoundFont. Production routing, explicit `--format`, MP3
export and loudness analysis need FFmpeg. GM production needs both sets of tools.

For a new composition directory, `node bin/daemonv12.js init /path/to/new-workspace`
copies starter projects and packs into a new or empty directory. It also prints
MCP configuration, but this skill requires no MCP connection. Discover the actual
palette by reading that workspace's `assets/*/README.md`, kit JSON and copied
`orbital-foundry.catalog.json` / `glasshouse.catalog.json`; GM program names are
in `src/project/gm-programs.ts`. There is no CLI `packs` or `instruments` command.
Existing MCP discovery is optional if already configured.

Read source tuning, duration and channel layout before choosing a sound. Do not
infer tuning from a kit's MIDI mapping: that mapping selects a hit, not its pitch.
Bundled packs are options, not a required aesthetic. Use an environment-specific
headless wrapper only if needed; see [headless-audio.md](headless-audio.md).

Sources: `README.md` (Commands, Install paths), `docs/DEVELOPER_SETUP.md`,
`src/cli/main.ts`, `src/cli/init.ts`, `src/doctor.ts`.

## Author and validate the real project format

- One tempo and meter; 1–15 tracks total, including samples. Track → pattern →
  notes plus clips is the arrangement model. Clips place patterns at integer bars;
  note positions are pattern-relative; automation positions are project-absolute.
- Durations are whole-note fractions on a 960-PPQ grid, not arbitrary seconds.
  GM notes require `pitch` and `duration`; note ends must fit inside their pattern.
  Same-pitch overlapping GM notes on one track fail validation. Different pitches
  can overlap, so intentional bass monophony still needs an arrangement check.
- Sampler notes have `start`, optional `velocity` and performance fields below;
  no note `pitch` or `duration`. Drum-kit notes require mapped `pitch` and also
  reject `duration`; use `gate`. Voices overlap unless explicitly grouped.
  `chokeGroup` is track-local and permits release overlap; it is not a strict
  monophonic mode or arbitrary MIDI note-off. Space kicks and bass across tracks.
- Assets resolve relative to the project JSON, under its `assets/`, not the shell's
  current directory. Kit WAV paths resolve relative to kit JSON. Inputs must be
  nonempty RIFF PCM16, 44,100 Hz, mono/stereo WAV. No implicit format conversion.
  Keep output directories outside `assets/`.
- Objects are closed: invented fields fail. Run `validate` before rendering and
  act on structured errors, not guessed repairs.

Sources: `docs/V0_SPEC.md`, `docs/V0_2_SAMPLES.md`,
`src/project/validate.ts`, `src/project/sample-schema.ts`, `src/project/assets.ts`.

## Gain/pan automation replaces static settings

**Automation values are absolute, not added to `mix`.** With static
`mix.gainDb: -9` and the first gain point `value: -3`, gain becomes **−3 dB**, not
−12 dB. Before the first point, static gain applies; after the last point, its
value holds. A point at time zero immediately replaces static gain.

`transition` belongs to the segment **from that point to the next**. Default is
`step`; `linear` interpolates dB, then converts to amplitude. It is not a linear
amplitude ramp. Pan uses the same absolute-point rule. Only track `gainDb` and
`pan` lanes exist; do not invent filter, playback-rate or master automation lanes.

Each lane has 1–1024 strictly increasing points, one time basis (seconds or
musical), and distinct rounded frames. Omit an unused lane. Gain is −60 through
+12 dB; −60 dB attenuates but is not digital silence. Read resolved automation in
the render manifest and check actual gain at the opening, transition and payoff.

Pan is linear **stereo balance**, with unity center. Hard-left keeps the source's
left channel and silences its right; it does not move the whole stereo image left.
This can discard useful content from a stereo source.

For `pan = p`, the channel multipliers are `L = 1-max(0,p)` and
`R = 1+min(0,p)`. Mono samples are duplicated to both channels before balance.
Panning a mono source changes placement and channel levels; it creates no
decorrelated information. Side energy can increase just from unequal balance,
so it does not prove different left/right content.

Sources: `docs/V0_5_TIMELINE_DYNAMICS.md` (Gain and pan automation),
`docs/V0_3_AUDIO.md` (Gain and pan),
`src/render/production.ts` (`automatedGainPan`, `balance`, `sumFloat`),
`tests/v05-timeline-automation.test.ts`.

## Stereo as arrangement

Use genuinely different left/right parts, call-and-response placement, octave
or timbral doubles, or contrast between focused and broad sections. Identical
mono copies panned apart still carry the same waveform; panning alone is not
decorrelation. Different rhythms, registers or timbres provide different content
through ordinary tracks and supported sample performance, subject to the same
track/voice constraints.

The current built-in reverb has different per-channel comb/allpass delay lengths,
which can decorrelate its room response. That verified behavior is an option,
not evidence that every wet sound becomes usefully wider. Reverb may also soften
attacks, mask a hook, extend tails or raise level. The single-tap delay applies
the same delay to both channels; it is not a configurable ping-pong or independent
left/right delay. Check mono compatibility and section contrast with source and
arrangement evidence, not a target correlation or side-energy value.

Sources: `src/render/production.ts` (`sumFloat`, `balance`),
`src/render/dynamics.ts` (`builtinEffect`),
`src/render/ffmpeg.ts` (`effectFilters`), `docs/V0_3_AUDIO.md`,
`docs/V0_5_TIMELINE_DYNAMICS.md` (Ordered production effects).

## Sampler rate, glide, offsets and overlap

| Field/behavior | Verified meaning and production check |
|---|---|
| `playbackRate` | 0.25–4, default 1. Pitch and duration change together. For a shift of `n` semitones use `2^(n/12)`; confirm the source's tuning first. No independent time stretch or formant preservation. |
| `glide` | `{"to": rate, "duration": "N/D"}` starts at note onset, moves linearly in **rate**, then holds destination. It is not linear in semitones and cannot reach rate zero. Destination must differ from starting rate. Source exhaustion may end the voice before the glide completes. |
| `offsetSeconds` | Source position, not timeline delay. 0–600 seconds with at most six decimal places; rounded to nearest 44.1 kHz source frame, ties later. Must resolve before source end. Check the transient/tuning at the new start, not just the original file. |
| Voice duration | Without articulation, the remaining source plays through. With articulation, use the slice/gate/envelope/choke rules below. No loop or arbitrary MIDI note-off is added. |
| Chops | Offsets alone add no fade. Prefer nearby zero crossings when appropriate; inspect start/end discontinuities and very short chops. Track gain automation affects every overlapping voice on that track, not one chop independently. |
| Overlapping transformations | Every trigger is an independent voice. Slowing a source lengthens its tail; inspect simultaneous voices, sub accumulation, masking and summed peaks before adding another transformed layer. |

Performance fields work on sampler/drum-kit notes, not GM notes. Reverse playback,
exponential/multipoint glides and automatic sample tuning are not provided.
Compilation checks transformed-voice work/memory budgets. If diagnostics reject
cost, simplify overlapping voices, shorten sources/use later offsets, move rates
closer to 1, use `gate`/`endSeconds`, or deliberately limit the rendered duration.
Do not bypass validation.

Current preflight limits are **1,000,000,000 interpolation kernel taps per
project** and **128 MiB per performed-voice buffer**. The budget accounts for
slices, gates, chokes and production boundaries; rate 1 without a glide reads
source frames directly and has no interpolation charge. These are rendering resource limits, separate from
Composer's revision/analysis budget. A project can pass resource validation and
still have musically overcrowded voices.

Sources: `docs/V0_6_SAMPLE_PERFORMANCE.md`,
`src/render/playback.ts` (`voiceFrames`, `voiceCost`, playback limit constants),
`src/sample-render.ts` (`sampleTriggers`, `playbackBudget`),
`src/pipeline.ts` (offset and playback-budget validation).

## V0.7 sampled-note articulation

All four controls apply to sampler and drum-kit notes only; GM articulation
fields fail validation. Kit `pitch` selects a source mapping, not a repitch.
No sample `duration`, sampler `pitch`, `noteOff`, `sustain`, `loop`, `attackMs`,
`releaseMs`, `endOffset` or `choke` alias is accepted as a note control.

| Control | Range/default and behavior |
| --- | --- |
| `endSeconds` | Absolute exclusive source endpoint, 0–600 s, at most six decimals. Default is WAV frame count. Together with `offsetSeconds` (default 0), requires `0 <= O < F <= sourceFrames` after rounding. A one-frame slice is legal. |
| `gate` | Positive whole-note fraction on the 960-PPQ grid, such as `1/16` or `1/12`. Default: no scheduled gate release. Relative release frame is `frame(onsetTick + gateTicks) - frame(onsetTick)`, never independently rounded gate seconds. Can outlast pattern/project/source; cannot extend the source. |
| `envelope.attackSeconds` / `envelope.releaseSeconds` | Each 0–10 output seconds with at most six decimals. Any articulation field enables defaults of 0.001 / 0.005 s; `envelope: {}` enables both. Omitted members keep defaults. Zero disables that ramp. Positive values must resolve to at least one frame: 0.000012 s works; 0.000011 s fails. |
| `chokeGroup` | Lowercase ID starting with a letter, then letters/digits/hyphens, at most 32 characters. Default: ungrouped. A later distinct output-frame onset releases older same-group voices on this track, across patterns/clips/kit mappings, using each older voice's own release. Other tracks are independent. |

Seconds resolve as exact decimal microseconds `u`, then source/output frame
`floor((u*44100 + 500000)/1000000)` (integer arithmetic, ties later).
Distinct seconds can round to the same frame; asset-aware validation rejects
empty/out-of-source slices. Musical ticks resolve with the quantized engine tempo;
see [music-to-video](music-to-video.md). Equal output-frame grouped onsets
coexist. Note order chooses no winner.
Earliest gate/choke release wins; subsequent onsets never restart/extend release.
Default release can overlap a new attack, so grouped voices can still overload.
Zero release avoids that release overlap but risks clicks.

For slice `[O,F)` at constant rate `r`, natural length is `N=ceil((F-O)/r)`
output frames. A glide keeps its continuous read position/rate through release;
it neither freezes nor resets. Rate changes pitch and slice length together;
gate and envelopes remain in output time. `offsetSeconds` is source position,
never score delay. Explicit `endSeconds` silences interpolation taps outside
`[O,F)` without renormalizing only the remaining taps. Offset-only voices keep
v0.6 whole-WAV tap bounds, even with gate/envelope/choke. Rate/offset/glide alone
add no fade; omission of all articulation preserves the historical one-shot path.

With earliest release `T`, release length `R`, and remaining output cap `C`,
exclusive audible endpoint is `E=min(N,T+R,C)`. No padded source tail is created.
Release moves earlier to finish at source/output boundaries. Attack is linear
amplitude from zero; release freezes the attack level at its start and reaches
exact zero on the last rendered frame. When source/cap truncates overlapping
ramps, they compress proportionally with an interior peak, never boosting above
the authored attack or delaying the requested stop. One/two-frame voices with
both ramps enabled are silent; set both ramps to zero for a hard one-frame slice.
Zero release makes no click-free promise. Articulation gain precedes per-voice
velocity rounding and summation. Effects can still ring after a voice stops.

Manifest `articulation` records resolved source end, gate, envelope, group,
effective choke, `voiceFrames` and capped `renderedFrames`. Existing
`playback.voiceFrames` means natural full-WAV length before articulation, not
actual audible length. `samples.articulation` identifies the algorithm.
Use full provenance for timing; original asset hashes remain unchanged.
Pure `compileProjectText` cannot certify WAV bounds: use CLI `validate` or
`compileProjectFile` / `compileProjectTextWithAssets`.

Sources: `docs/V0_7_SAMPLER_ARTICULATION.md`, `src/project/validate.ts`,
`src/pipeline.ts` (asset bounds), `src/sample-render.ts` (`sampleTriggers`),
`src/render/playback.ts` (`voiceFrames`, `voiceGain`, `interpolate`, `voiceCost`),
`src/render/pcm.ts`, `src/render/production.ts`.

## Effects, duration and signal flow

Current ordered track/master effects are `highpass`, `lowpass`, `delay`,
`compressor`, `reverb`, `saturation`; at most eight per array. Read exact parameter
names/ranges in `src/audio-types.ts`. The filters use `frequencyHz` (20–20000);
they are broad highpass/lowpass filters, not conventional parametric or multiband
EQ. There is no arbitrary effect/filtergraph field. Delay is one tap with unity
dry plus a wet copy, no feedback. Reverb uses a finite decay horizon;
delay/reverb can extend the
container even at zero wet. Compressor makeup is explicit; saturation has no
automatic output compensation. There is no implicit limiter or normalization.
Master voiceover ducking uses a reference WAV's activity; it does not mix that
reference into the music and is not a track-specific kick/bass sidechain.

The presence of `render`, `master`, track `mix`, `effects` or `automation` selects
production routing, including empty objects/arrays. This changes how GM tracks
are rendered/summed compared with the legacy full-score GM route. Keep routing
consistent when comparing versions unless that change is deliberate.

Production order is source voices → track gain/pan automation → track effects →
track PCM16 quantization → sum tracks → master gain/effects → output boundary →
master ducking → master PCM16 quantization. **A quiet master cannot repair a
clipped track.** Inspect each track's `clippedSamples` / `preClipPeakDbfs` in the
manifest as well as final WAV analysis.

`render.duration` specifies the complete final container, including tails. Choose
exactly one of `{"seconds": ...}`, `{"bars": ...}` or `{"musical": "N/D"}`.
`render.tail` is `"auto"`, `"none"` or a positive `{"seconds": ...}` allowance
after the authored end. Final duration always wins; extra room may become silence
and short room may cut a gesture. Sample/production renders are limited to 600
seconds including tails. Plan endings within the actual container, then inspect
the exported last three seconds. Exact length alone does not make a seamless loop;
no automatic fade/crossfade hides boundary discontinuities.

Sources: `docs/V0_3_AUDIO.md` read with `docs/V0_5_TIMELINE_DYNAMICS.md`,
`src/audio-types.ts`, `src/pipeline.ts` (`productionRoute`),
`src/sample-render.ts`, `src/render/dynamics.ts` (`builtinEffect`),
`src/timing/render-plan.ts` (`renderPlan`, `automationFrames`).

## Render, analyze and preserve useful artifacts

From the checkout root, after authoring `cue.json` and its adjacent `assets/`:

```sh
node bin/daemonv12.js validate /path/to/workspace/cue.json --json
node bin/daemonv12.js render /path/to/workspace/cue.json --out-dir /path/to/workspace/v1 --stems --format wav --json
node bin/daemonv12.js analyze /path/to/workspace/v1/cue.wav --json
```

Change the output directory for each serious version. A rerender owns the same
basename artifacts and stem directory: master-only rendering can remove previous
stems, WAV-only can remove old MP3, and failures clear partial/stale outputs. Keep
locked submissions away from working output paths.

Production stems begin at zero, match master frame count and include track
gain/pan/automation/effects. They exclude master gain/effects/ducking. Their sum
reproduces a unity, unprocessed master subject to clipping; with master processing,
that processing must also be applied. Legacy stems may have unequal natural tails,
and independent GM stems need not sum byte-identically to the full-score master.

Production or explicit-format renders write `.analysis.json` with master metrics
and exported-stem metrics. Standalone `analyze` reports duration, peak, RMS,
full-scale samples, integrated LUFS, LRA and true peak. `clipping` indicates at
least one PCM full-scale value, a warning sign rather than proof of past overload.
Silence can yield `null`; short clips can have uninformative LRA. The manifest's
actual overload counts complement these measurements. Read
[production-analysis.md](production-analysis.md) for musical interpretation and
existing section/spectral/stereo analysis tools; do not duplicate native analysis.

The canonical WAV, stems, analysis and `.render.json` provenance should repeat
with the same project, source assets, engine, Node, audio tool versions/builds and
SoundFont. MP3 is a listening copy, outside the byte-determinism contract. Preserve
project/asset SHA-256s, tool identities and engine commit alongside the manifest;
the manifest's engine version alone does not identify a Git commit. For a second
render use a fresh output directory and compare canonical artifact hashes. If
they differ, report and investigate the environment/inputs; do not claim a lock
was deterministic merely because both renders succeeded.

Sources: `docs/V0_1_STEMS.md`, `docs/V0_3_AUDIO.md`,
`docs/V0_5_TIMELINE_DYNAMICS.md`, `src/render/analysis.ts`,
`src/sample-render.ts`, `src/pipeline.ts`.
