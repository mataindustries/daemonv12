# MORPH//01 — The Singing Machine: experimental handoff

Built on current main `7dd67f1e3963b2fcbdbf1fc0aa8b1f926e8874b5`, on local
branch `feat/morph-voice-prototype`. SIGNAL context was read at
`0eea7e312fe7f2388b3341d330125c555199a26b`. Both branches were fetched; all
prototype changes are under `experiments/morph-voice/`. No merge, push,
publication, deployment, core/MCP change or historical asset/test change occurred.
SIGNAL PR #25, its committed WAVs, rights status and expected hashes are untouched.

## What works

An agent can author a JSON performance with independent pitch, morph, vowel,
brightness, grit, vibrato, articulation, gain and explicit glide. The pure Node
synthesizer renders it deterministically without prerecorded speech or sample
inputs. One harmonic phase accumulator underlies all three identities; spectral
coefficients blend before synthesis and receive power compensation. Six modal
oscillators keep running through morph changes. Seeded, filtered breath and
fixed-Hz formant shaping supply the vocal component. Analytic polynomial
coloration and evolving inharmonic modes supply the machine component.

The 0.7 integration is real exported-PCM playback through the existing sampler,
production mixer and stem pipeline. The project validates without warnings and
renders six bars at 120 BPM to exactly 12 seconds / 529,200 stereo audio frames.
Five stems are aligned at zero. The visual map contains every displayed picture
frame 0–719 at 60 fps, plus beat, scene and source-note events. Boundary 720 is
exclusive; the audio endpoint is 529,200. Notes between picture frames preserve
their exact audio time and explicitly report up to 8.333 ms picture rounding.

## Listen and judge

| File beneath `renders/` | Passage and purpose |
|---|---|
| `demos/the-transformation.wav` | 12 s, C#4 throughout. 0–2 s exposes glass; approximately 3.7–6 s crosses two vowel regions; 8–11 s exposes the unstable machine. There is no pitch automation or vibrato in this demonstration. |
| `demos/the-performance.wav` | 12 s, 29 note onsets. A four-second syncopated cell returns with timbral variations; the final answer uses E# tension and a short G#4→C#5 glide. C#, E, G#, A and E# are all present. |
| `demos/the-impossible-gesture.wav` | 8 s. C#5 falls two octaves to C#3 in 1.65 s while vowel moves from /u/ toward /i/. Around 3.2–5.4 s, irregular voice/metal folds and expression dips turn the resonance into interrupted syllables, then it opens back into glass. |
| `cue/render/morph-01-cue.wav` | 12 s mixed cue. MORPH hook, newly synthesized sub/kick/clap/clock; a C#→A→G#→C# bass arc supports repeated visual reveals. |

The most promising candidate for further audition is the contrary pitch/formant
gesture, especially the return from metallic resonance into a held throat. Its
musical premise is independently moving pitch, mouth shape and resonance memory,
followed by asymmetrical articulation. A conventional playback-rate sweep moves
these together. A complex sampler could approximate the result, but it would
need additional processing and recorded trajectories; here the agent directly
authors those trajectories.

This is a design-based assessment, not a claim that a human has listened and
approved the sound. The files are supplied for that evaluation. In particular,
judge whether the middle identity reads as almost human, whether the machine
retains the musical center, and whether the repeated hook is worth developing.
Automated checks do not establish perceptual smoothness or musical quality.

## Engineering evidence

All deliverables are RIFF/WAVE PCM16 little-endian at 44.1 kHz. Standalone demos
are mono; the cue and stems are stereo. Every delivered WAV has zero first and
last frames. No demo, master or stem reaches PCM full scale; the pipeline reports
zero clipped samples and no warnings. FFmpeg input true-peak estimates remain
below full scale too.

| Render | Seconds / frames | Sample peak dBFS | RMS dBFS | Integrated LUFS |
|---|---:|---:|---:|---:|
| Transformation | 12 / 529,200 | −8.37 | −17.44 | −17.60 |
| Performance | 12 / 529,200 | −8.59 | −18.97 | −19.01 |
| Impossible Gesture | 8 / 352,800 | −7.51 | −18.13 | −18.60 |
| Mixed cue | 12 / 529,200 | −6.20 | −19.89 | −18.05 |

Six prototype tests pass. Same-seed inputs reproduce identical PCM; another seed
changes the breath/modal detail. Harmonic projection finds C#4 at morph 0, 0.5
and 1 and vowel 0/1, while harmonic spectra change substantially. A separate
constrained FFT analysis of the actual sustained demo finds the 277.18 Hz carrier
within 0.019 cents in its sampled windows. That estimator checks the retained
carrier near its known frequency; it does not establish perceived pitch.

At fixed pitch/vowel, eleven morph positions span **0.419 dB RMS** in the probe.
Velocity changes retain **12.04 dB** of dynamic difference. A rapid probe with
50 knots at 30 ms spacing passes sample-step, curvature and local-outlier
checks. These are bounded discontinuity probes, not an audibility threshold.
The actual demo's selected identity segments span approximately 0.46 dB RMS.

All **16 generated WAV files** reproduce byte for byte on a second complete
render, including the cue and its backing assets. All **1,058,400 master channel
samples** equal the sum of five processed stems followed by the master gain and
the specified rounding. The event map matches all 29 authored note onsets.

The maximum-duration stress probe renders **30 s, 8 overlapping voices,
1,323,000 frames** in **12.11 s wall / 12.10 s CPU**, with **74.37 MiB maximum
RSS**, under a 128 MiB V8 heap setting and a 60 s timeout. Its peak is 0.372 at
the explicitly moderate gain/velocity. These are host measurements, not a
real-time guarantee. Valid high-gain coherent polyphony can still overload;
the PCM writer rejects out-of-range samples instead of silently clipping.

The unchanged repository's baseline and final `npm run check` both pass
typechecking, with **293 tests passed, 0 failed and 2 skipped** out of 295.
Evidence is recorded in `regression-summary.json` and the accompanying logs. The two historical
FFmpeg-build identity gates retain their original expectations; they require
`6.1.1-3ubuntu5` rather than the available `6.1.1`. No substitute fixtures or
hash changes are used. This sprint does not resume SIGNAL release-audit work.

## What is new relative to SIGNAL

The synthesis techniques themselves are established. SIGNAL already contains
additive glass, vocal/formant color, vibrato, baked vowel movement and glides.
MORPH adds the **authorable performance boundary**: arbitrary supported pitch,
independent vowel and spectral controls, one continuous three-identity morph,
state maintained through that morph, and timestamped automation that an agent
can revise without changing a source recording or playback rate. The output is
a rendered instrument performance, rather than another fixed multisample pack.

## Limits and handoff decision

This is ready for another agent to compose **offline**: write JSON, render a
performance, audition it, then import its WAV into a 0.7 project. The source
scores, CLI, DSP notes, measured checks, exact hashes and self-contained cue
assets provide a concrete starting point. It is ready for listening review,
not a claim of release readiness or a reason to expand the synthesis framework.

Native voice instruments, project-schema timbre automation, MCP control,
streaming/real-time scheduling and legato state shared across distinct notes
still require engine-level integration. The existing sampler only receives
baked PCM; it cannot revise the morph after export. No engine extension is
implied by the integration demonstration.

The prototype has a 64-harmonic limit, fixed sample rate and deliberately simple
formants. Low notes become comparatively dark, high notes resolve vowels less
well, and fast modulation can create alias sidebands despite frequency guards.
It has no physical vocal tract, speech articulation, oversampled nonlinear
path, hidden limiter or automatic mastering. See `../DSP.md` for the equations,
alias/numerical caveats and documented methods. See `../README.md` for control
semantics and reproduction commands.

`renders/provenance.json`, `analysis/verification.json`, `analysis/spectral.json`,
`analysis/repeatability.json`, `analysis/cue-verification.json` and the engine
manifest carry detailed evidence. `reference-audio-sha256.json` pins this
experiment's new audio, without changing any previous expected hash. The
listening bundle checksum list covers the shipped files.
