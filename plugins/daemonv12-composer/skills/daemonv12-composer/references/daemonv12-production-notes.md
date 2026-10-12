# DaemonV12 production notes

Verified against engine **0.6.0**, project `formatVersion: 1`, repository commit
`ed75e9e2a0172266e56b292886ad7c1500677862`. Rechecked for Composer v0.2 against
current source files matching that base. Paths are relative to the **engine
repository root**, not this portable plugin. For a different engine revision,
read its current docs and implementation before relying
on these contracts. Do not change rendering behavior to fit the workflow.

Read the specs cumulatively: `docs/V0_SPEC.md` supplies the GM baseline;
`docs/V0_2_SAMPLES.md`, `docs/V0_3_AUDIO.md`,
`docs/V0_5_TIMELINE_DYNAMICS.md` and `docs/V0_6_SAMPLE_PERFORMANCE.md` extend it.
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
  reject `duration`. Sample voices may overlap freely; there is no automatic
  choke group or monophonic mode. Space triggers or prepare appropriate source
  lengths when sustained sub tails would accumulate.
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
| Voice duration | At constant rate: `ceil((sourceFrames - offsetFrames) / rate)` output frames. There is no per-note duration, end offset, release, fade, loop or note-off. Source exhaustion ends playback; render boundaries can cut it earlier. |
| Chops | Offsets add no fade. Prefer nearby zero crossings when appropriate; inspect start/end discontinuities and very short chops. Track gain automation affects every overlapping voice on that track, not one chop independently. |
| Overlapping transformations | Every trigger is an independent voice. Slowing a source lengthens its tail; inspect simultaneous voices, sub accumulation, masking and summed peaks before adding another transformed layer. |

Performance fields work on sampler/drum-kit notes, not GM notes. Reverse playback,
exponential/multipoint glides and automatic sample tuning are not provided.
Compilation checks transformed-voice work/memory budgets. If diagnostics reject
cost, simplify overlapping voices, shorten sources/use later offsets, move rates
closer to 1, or deliberately limit the rendered duration. Do not bypass validation.

Current preflight limits are **1,000,000,000 interpolation kernel taps per
project** and **128 MiB per performed-voice buffer**. The budget accounts for
production boundaries; rate 1 without a glide reads source frames directly and
has no interpolation charge. These are rendering resource limits, separate from
Composer's revision/analysis budget. A project can pass resource validation and
still have musically overcrowded voices.

Sources: `docs/V0_6_SAMPLE_PERFORMANCE.md`,
`src/render/playback.ts` (`voiceFrames`, `voiceCost`, playback limit constants),
`src/sample-render.ts` (`sampleTriggers`, `playbackBudget`),
`src/pipeline.ts` (offset and playback-budget validation).

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
