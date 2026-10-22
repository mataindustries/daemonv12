# MORPH//01 research and integration boundary

This is an independent instrument experiment. The inspected SIGNAL branch supplies
context, not a continuation of its release review. No SIGNAL samples, kit files,
rights text, expected hashes or PR #25 are changed by this experiment.

## Inspected repository state

Read on 2026-10-21 through the connected GitHub repository tools:

| Ref | Commit | Context |
|---|---|---|
| `main` | `7dd67f1e3963b2fcbdbf1fc0aa8b1f926e8874b5` | Current main; identical to the starting checkout HEAD. |
| `feat/signal-lab-instruments` | `0eea7e312fe7f2388b3341d330125c555199a26b` | SIGNAL Lab 0.2.0 source, README and installation limitations. |

The local `origin/main` tracking ref was stale. Initial sandboxed Git transport
could not reach the configured proxy. Connected GitHub branch reads first
confirmed the live refs above, and the experiment branch was based on the local
commit matching live main. A subsequently permitted Git transport fetch of
`origin main feat/signal-lab-instruments` succeeded, updated `origin/main`, and
downloaded the SIGNAL object graph. Both fetched heads match the inspected
revisions. The experimental branch remains based on current main; no SIGNAL
branch ref or working tree was changed.

The inspected SIGNAL files are under `packs/signal-lab/0.2.0/` at the pinned
SIGNAL commit. Their Git blob identities are:

- `generate-signal-instruments.mjs`: `90c08258e95d4877608e208fa2d80dc866c66d64`
- `README.md`: `3120c82bd03e2cf74bfb121dd70e6224030ac891`
- `INSTALL.md`: `2f92bed7486209292fd55fe030fa9f433fde715f`

Read-only reference copies are scratch material in `work/reference/`, excluded
from version control. No SIGNAL WAV is used as an input to the new instrument.
Other context: `docs/ARCHITECTURE.md`, `docs/V0_2_SAMPLES.md`,
`docs/V0_3_AUDIO.md`, `docs/V0_5_TIMELINE_DYNAMICS.md`,
`docs/V0_6_SAMPLE_PERFORMANCE.md`, `docs/V0_7_SAMPLER_ARTICULATION.md`,
and the existing PCM/production rendering implementation.

## What SIGNAL already does

The supplied generator uses float64 additive synthesis at 44.1 kHz, at most 64
harmonics, a nominal 18 kHz partial ceiling, seeded xorshift32 noise, linearly
ramped spectral coefficients on 32-frame blocks, Gaussian formant gains and
explicit PCM16 rounding. Its lead already combines a harmonic bowed body,
fixed 600/1400/3000 Hz formants, delayed vibrato, an onset pitch scoop,
inharmonic glass ratios 2.756/5.404/8.933 and band-pass-filtered breath noise.
Its pads already contain time-varying vowels, spectral tilt, per-partial shimmer,
detuned ensembles and baked chord changes. Its swells already contain glides and
accelerating tremolo. None of those techniques alone is a new MORPH capability.

The pack exports nine fixed performances, including only five lead pitches.
In engine playback, source speed changes pitch, formants, vibrato rate and
duration together. Every trigger starts an independent recorded trajectory.
The meaningful new boundary is an agent-authored synthesis performance: arbitrary
supported pitch and glide, independently movable formants, continuous identity
morphing, and continuously running oscillator state during that performance.
It moves musical decisions out of baked sample timelines into explicit controls.

## Useful synthesis design

Use phase accumulation `phase += 2*pi*f/sampleRate` and wrap periodically.
Changing an oscillator's frequency changes its next increment, never its phase.
Advance hidden components too; a zero morph weight must not restart a component.
Smooth/ramp coefficient targets at deterministic boundaries so automation does
not insert a waveform step. A rapid automation test should include the center
of the morph range, where coherent components can otherwise cause a gain bump.

For a pitch-independent vowel, hold F1/F2/F3 in absolute Hz and evaluate the
spectral response at each harmonic frequency. For example a Gaussian response
`exp(-0.5*((harmonicHz-formantHz)/bandwidthHz)^2)` can weight a common harmonic
excitation. This is spectral-domain source/filter synthesis; it is not a speech
model or a prerecorded voice. A time-domain resonator bank is another valid
implementation, but coefficient interpolation and filter state then require care.
The harmonic spacing necessarily changes with pitch, so sampled formant peaks
can become sparse at high fundamentals even though their target Hz are fixed.

Glass can retain a strong harmonic body, a slow bow-like attack, weak sustained
inharmonic modes and a small noise component. Voice should emphasize a harmonic
source shaped by independently movable formants and breath. Machine can enrich
the harmonic spectrum, increase controlled inharmonic mode energy and evolve
resonance frequencies. Analytically generated harmonic coloration is a useful
bounded alternative to unrestricted sample-rate waveshaping. If an actual
nonlinearity is used, oversampling and a low-pass reconstruction stage are needed
to suppress its newly created out-of-band products.

Coherent harmonic components should share phase where possible. Normalize the
combined spectral coefficients, or explicitly account for their covariance:
equal-power crossfades only preserve energy for uncorrelated signals. Independent
metal/noise components can use power-weighted mixing, with a retained harmonic
anchor so the fundamental remains identifiable. This controls average energy,
not perceived equal loudness, and is not a substitute for listening.

## Aliasing and numerical limits

- A sine below Nyquist does not alias by itself. Frequency modulation, amplitude
  modulation, moving spectral weights, finite attacks and morph motion create
  sidebands. An 18 kHz oscillator ceiling leaves margin at 44.1 kHz but cannot
  justify an absolute claim of zero aliasing.
- White noise shaped by a finite-order band-pass still has energy above its
  center band. Low-pass and high-frequency tapering reduce it; they do not make
  a finite signal mathematically bandlimited.
- Hard threshold removal of partials when pitch changes can click. Taper their
  amplitudes toward the frequency ceiling and interpolate coefficient changes.
- High-Q moving resonators can ring, overshoot or become unstable if their
  coefficients are interpolated carelessly. Bound center frequency, Q and
  feedback; test finite values and amplitude at extremes.
- Strong nonlinear coloration generates upper harmonics. Without sufficient
  oversampling/filtering it aliases, even when its input is bandlimited.
- Float64 transcendental functions may differ in their last bits across runtime,
  CPU and math-library builds. Exact byte reproduction is promised only with
  pinned runtime/inputs; record hashes rather than replacing expectations when
  a different platform drifts.
- PCM16 quantization without dither produces low-level signal-correlated error.
  Exact-zero endpoints eliminate endpoint steps, not all high-frequency content.
  Automated spectral or derivative checks cannot prove audible smoothness.

## Existing 0.7 sample/render seam

The integration requires exported audio, not a new engine instrument type:

1. Export RIFF/WAVE format tag 1, PCM signed 16-bit little-endian, 44,100 Hz,
   mono or stereo. The decoder rejects other rates and encodings; there is no
   implicit conversion. Reference it beneath the project-relative `assets/`.
2. Use the existing `sampler` instrument for one rendered performance, or a
   `drumkit` for several rendered articulations. Sampler notes have `start` and
   velocity, and reject pitch and duration. A kit's pitch chooses a mapping;
   it does not specify a synthesized fundamental.
3. The existing v0.6 rate/glide is tape-speed playback. At rate 1 without a glide
   the renderer preserves source frames; changing rate couples source pitch and
   spectral character again. Keep the MORPH performance at rate 1 when
   demonstrating its independent controls.
4. V0.7 `gate`, `endSeconds`, `envelope` and track-local `chokeGroup` can arrange
   exported material safely. Positive attack begins at zero; positive release
   finishes at zero. A release still needs source material. A hard zero-duration
   ramp or a source discontinuity can create a click.
5. Presence of `render`, `master`, track `mix`/`effects`/`automation` selects the
   production route: sampled voices, track processing and quantization, summing,
   master processing, exact trim/pad, measurement and equal-length stems.
   FFmpeg is required for production analysis. Stems are pre-master.
6. Six 4/4 bars at 120 BPM are 12 seconds. Set
   `render.duration.seconds = 12` for exactly 529,200 output frames. At 60 fps,
   picture frames are indices 0 through 719 with exclusive boundary 720.
   Picture events can use rational seconds/audio-frame positions; do not confuse
   a frame index with the exclusive end boundary.

The engine continues to own contained asset IO, absolute BigInt musical-frame
rounding, rendering, analysis and source hashes. Future engine-level work would
be a new synthesis instrument/schema or rendering seam, synthesis automation,
resource validation, provenance and MCP authoring support. This prototype does
not add those capabilities to the core.

## Established method references

These references identify the documented DSP methods behind the design; they
are not audio assets or dependency licenses. The synthesis implementation is
local code and does not fetch these resources at render time.

- Julius O. Smith, *Physical Audio Signal Processing*, including additive,
  source/filter and modal/resonator methods:
  <https://ccrma.stanford.edu/~jos/pasp/>
- Julius O. Smith, *Spectral Audio Signal Processing*, spectral envelopes,
  sinusoidal analysis/synthesis and sampling considerations:
  <https://ccrma.stanford.edu/~jos/sasp/>
- Robert Bristow-Johnson, *Audio EQ Cookbook*, normalized biquad formulas and
  parameter meanings:
  <https://webaudio.github.io/Audio-EQ-Cookbook/audio-eq-cookbook.html>
- Curtis Roads, *The Computer Music Tutorial* (MIT Press, 1996), additive,
  waveshaping, modulation and formant synthesis. The prototype uses these
  established technique families; it does not claim a new DSP algorithm.

The method discussion above combines direct repository inspection with standard
DSP reasoning. It is not a report of a human listening session.
