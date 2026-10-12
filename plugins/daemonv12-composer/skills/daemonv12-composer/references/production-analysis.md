# Production analysis: evidence for musical decisions

Use analysis to test a musical hypothesis, then revise the composition or mix.
A clean measurement does not prove that a hook is memorable, a groove works, or a
payoff feels large. Do not present analytical inspection as human listening.
When listening feedback is available, preserve it alongside the measurements.

## Start with the existing analyzer

From the DaemonV12 checkout, use the native workflow:

```sh
npx --no-install daemonv12 render path/to/project.json --stems --format wav --out-dir path/to/version-output --json
npx --no-install daemonv12 analyze path/to/version-output/project.wav --json
```

Use the actual master path returned by `render`; do not assume its basename.
Production renders already write an `.analysis.json` report for the master and
requested stems. Reuse that report before running another analysis. Explicit
`--format wav` also enables analysis for legacy projects. FFmpeg is required.
Analyze the canonical WAV, not an MP3 delivery copy. Preserve each serious
version in its own output directory so a later render cannot replace its evidence.

Native fields include duration, frames, sample rate, channels, sample peak, RMS,
full-scale sample count, clipping flag, integrated LUFS, LRA and true peak. Native
analysis does **not** provide a general spectral, per-section or stereo-correlation
report. Use optional read-only external analysis only when it answers an actual
production question. Record tool/version, channel handling, window length, band
definitions and section boundaries. If a check cannot be measured, mark it as
unmeasured; do not invent a result.

### Optional existing spectral/section proxy

The repository's `scripts/inspect-orbital-foundry.ts` exports a read-only
`inspect(path)` function. If that file is present in the selected checkout,
reuse the export for a verified **44,100 Hz PCM16 WAV** when band energy,
per-second RMS or stereo correlation will answer the current question:

```sh
node --input-type=module -e 'import { inspect } from "./scripts/inspect-orbital-foundry.ts"; console.log(JSON.stringify(inspect(process.argv[1]), null, 2));' path/to/master.wav
```

Run from the repo root with the supported Node version. Read the function before
use: it hardcodes 44,100 Hz, uses 8192-point Hann FFT windows with 50% overlap,
sums independent-channel power and includes fades/silence. Its direct script
entrypoint also inspects a particular pack catalog; importing the function avoids
that unrelated work. Its bands are descriptive, and its per-second windows are
not musical sections. Silent band shares or correlation can serialize as `null`;
treat them as undefined. If the helper is absent or the input differs, use an
appropriate external analyzer and document the method. Do not copy its constants
into a new engine feature or mistake this helper for a supported CLI contract.

## Interpret measurements

| Evidence | What it can tell you | Musical use and limits |
| --- | --- | --- |
| Integrated LUFS (`integratedLufs`) | Frequency-weighted, gated loudness over the complete file. | Helps compare versions and spot broad level changes. A short intro or ending can disappear from the story told by a single whole-file number. It cannot establish impact, size or quality; never pursue a universal LUFS target. |
| Sample peak (`peakDbfs`) | Largest stored PCM sample magnitude. | Helps identify scarce headroom. A large isolated transient can set the peak while the hook remains buried. |
| True peak (`truePeakDbfs`) | FFmpeg's estimate of reconstructed intersample peaks; conventionally described in dBTP despite the field name. | Inspect independently of sample peak. Peaks at or above full scale require attention to playback/encoding overload; allow appropriate delivery headroom without imposing a universal mastering number. |
| Clipping | `clipping` flags exact full-scale PCM samples; `fullScaleSamples` counts them. Production provenance also records `clippedSamples` and `preClipPeakDbfs`. | Full-scale samples are conservative evidence of possible clipping, not proof of its history. Production overload counts reveal saturation at individual stages. Fix unintended overload where it occurs; master attenuation cannot repair an already clipped track. |
| Loudness range (`loudnessRangeLu`, LRA) | Distribution of measured loudness variation. | Supports a contrast diagnosis, but can be zero or uninformative on short/static cues. It does not grade groove, transient movement or whether the payoff arrives convincingly. |
| RMS (`rmsDbfs`) | Average waveform power, without perceptual frequency weighting. | Compare like-for-like windows to locate sustained energy, weak sections or accumulating bass. Bass can raise RMS while obscuring the hook. Silence and long tails lower whole-file RMS. |
| Spectral balance | Estimated energy by frequency band over stated windows. | Helps locate low-end buildup, absent presence, excessive brightness or masking. Band shares are relative and unweighted; raising one band reduces the others' percentages without changing their audio. They are not a desired EQ curve. |
| Section energy | Comparable RMS/loudness, peaks, band behavior and transient activity over musical sections. | Tests whether the payoff changes in the intended way. Compare both complete sections and equal-duration excerpts when lengths differ. Energy alone cannot distinguish an effective sparse section from an empty one. |
| Stem balance | Each role's activity, peak, loudness and spectrum at the same timeline positions. | Localize collisions and identify which role disappears. Whole-file stem LUFS includes different amounts of activity and silence, so compare shared active windows. Stem loudness values do not add arithmetically to master loudness. |
| Stereo correlation | Similarity of left/right waveforms within a stated window, normally from −1 to +1. | Strong positive correlation can be intentional focus; low correlation can represent useful width or unstable phase. Negative correlation warrants a mono check, not an automatic rejection. Correlation is undefined for silence/zero channel power. There is no ideal universal value. |

Exact silence may yield `null` peak, RMS, LUFS and true peak. Treat that as
undefined or negative infinity according to context, not zero loudness or a tool
failure. An absent metric is different from a measured zero.

## Diagnose size and low end

When a payoff feels small, inspect the actual payoff window against the preceding
section. Check bass authority, transient impact, midrange presence, top-end
activity, register, stereo contrast, harmonic density and the space reserved for
the arrival. Inspect automation before adding master gain. More simultaneous
notes can reduce apparent size by blurring attacks and masking the hook.

For low end, inspect kick and bass stems separately, together and in the master:

1. Mark coincident attacks and each sound's decay. Look for a useful handoff or a
   collision where sustained bass covers the kick's onset.
2. Check bass-note overlap, source tails and transformed voices. A new trigger may
   arrive while the previous low note still rings. Use monophonic behavior where
   musically appropriate, after verifying what the selected instrument supports.
3. Compare the low band's energy before, during and after dense passages. Rising
   sustained energy can indicate accumulation rather than useful weight.
4. Inspect mono behavior and low-register pitch relationships. Phase interaction
   depends on waveform and timing; do not assume every overlap needs phase inversion.
5. Try a purposeful change in note spacing, duration, register, source choice,
   gain or verified processing. Reduce masking before globally brightening the mix.

Check transformed samples for tuning, rate/pitch relationships, glides, source
offsets, hard chop boundaries and overlapping tails. A surprising spectral or
peak change may be a playback mistake. Consult
[engine production notes](daemonv12-production-notes.md) before correcting it.

## Compare versions and inspect boundaries

Record the same musical windows for each serious version: first five seconds,
establishment, development/disruption, payoff and final three seconds. Use
actual timestamps from that version when the arrangement changes. Inspect both
the whole arc and the excerpt; a disruption's low energy may be intentional only
in context. Whole-file averages must not conceal a weak entrance or ending.

For the first five seconds, identify the audible role expected to carry identity
and the event that should create curiosity. Check its onset, register, masking
and activity. A quiet opening can work when that role is clear.

For the final three seconds, inspect the final gesture, tail, silence and output
boundary. Check for an accidental collapse, a chopped release, a click, or a long
empty extension. For a loop, inspect end-to-start timing and sample continuity as
well as harmonic/rhythmic compatibility. A technically smooth seam alone does not
make the return compelling. Fixed duration does not create an automatic fade.

When comparing listening copies, use a documented matched playback level where
possible so added gain does not masquerade as a better arrangement. Preserve the
canonical files unchanged. An analytical proxy cannot certify equal perceived
loudness or replace human feedback.

## Turn evidence into a revision

Use a compact record for each of the three weakest musical issues:

> At [time/section], [musical problem] is supported by [arrangement and/or measured
> evidence]. Change [specific role or event]. On the next render, check [intended
> audible consequence] and [possible tradeoff].

Examples:

- “The payoff loses weight because the bass tail ends before the main impact and
  the next note enters late. Move the bass entrance into the arrival; recheck
  kick masking and track overload.”
- “The hook is obscured when hats enter. Simplify their competing accents and
  test the hook's upper-mid presence in that window.”
- “The ending spends its final seconds on an unrelated effect tail. Shorten the
  gesture or connect it to the opening; verify the new boundary and replay.”

Do not label “low LUFS,” “few events,” “few tracks,” “little 5 kHz energy,” or “not
enough effects” as musical weaknesses by themselves. Event, track, effect and
automation counts describe construction, not quality. Retain a revision only
when its musical consequence improves the brief; revert regressions explicitly.

## Engine grounding

Read these paths in the actual engine checkout; this portable plugin does not
replace their current contracts:

- `docs/V0_3_AUDIO.md`, “Clipping and analysis” and “Export and provenance.”
- `docs/V0_5_TIMELINE_DYNAMICS.md`, “Signal flow and production stems” and duration/tail rules.
- `src/render/analysis.ts` for PCM measurement semantics.
- `src/render/production.ts` for quantization overload reporting.

Production stems include track automation/effects and exclude master
gain/effects/ducking. Legacy GM stems are not guaranteed to sum identically to
the full-score master. Identify the route before treating a stem/master
difference as an error. Repository pack-inspection scripts are examples with
their own assumptions, not a general analyzer API.
