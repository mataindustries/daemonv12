# MORPH//01 synthesis notes

`synth.mjs` is an offline, mono, 44,100 Hz synthesizer. It produces floating
samples and engineering statistics; the experiment's writer exports PCM16 WAV.
The module has no imports, IO, clock, external DSP library or prerecorded audio.
This is one voice architecture, not a plugin API or an engine extension.

## One carrier, three identities

Every note maintains one phase accumulator. A recurrence generates up to 64
harmonic sine components from that phase. Morphing changes their coefficients,
never their phase. Harmonic coefficients are evaluated every 32 samples and
linearly interpolated between evaluations. The control targets themselves follow
timestamped smoothstep curves with a 4 ms one-pole smoothing time. This prevents
steps even when an agent specifies extremely fast parameter changes.

The first half of `morph` uses smoothstep weights to move from glass to voice;
the second half moves from voice to machine. The weights blend **spectral
coefficients before synthesis**. Their squared coefficient sum is normalized to
0.82². Since these components share a carrier and are highly correlated, this
power calculation handles their correlation more directly than equal-power
crossfading separate oscillator banks. The common fundamental has an explicit
anchor in each identity. Velocity and gain remain outside normalization, so
musical dynamics survive. Modal and noise energy are deliberately small additions;
the result is approximately level matched, not a perceptual loudness guarantee.

### Glass

The harmonic body has an approximately h^-2 amplitude tilt, with a small even
harmonic reduction. A raised-cosine attack and slow bow-pressure amplitude
variation suggest sustained excitation rather than an impact. Six independent,
continuously running sinusoidal modes have ratios 2.003, 2.756, 4.113, 5.404,
8.933 and 12.61. Their gentle growth supplies a crystalline edge around the
pitched body. This is additive/modal synthesis, not a physical bowed-glass model.

### Voice

A harmonic h^-0.92 excitation passes through an analytically evaluated parallel
formant spectral envelope. Its three Lorentzian peaks move continuously through
approximate /u/, /o/, /a/, /e/ and /i/ regions as vowel moves from 0 to 1:

| Vowel position | F1 Hz | F2 Hz | F3 Hz |
| --- | ---: | ---: | ---: |
| 0, /u/ | 350 | 850 | 2400 |
| 0.25, /o/ | 450 | 1000 | 2600 |
| 0.5, /a/ | 800 | 1150 | 2900 |
| 0.75, /e/ | 500 | 1850 | 2600 |
| 1, /i/ | 300 | 2200 | 3000 |

These are expressive synthesis targets, not a speaker-specific vocal-tract fit.
The formants remain in Hz while pitch changes. The pitched part therefore uses
frequency-domain source/filter synthesis rather than shifting a recorded vowel.
Xorshift32 noise feeds three parallel topology-preserving state-variable
bandpass filters centered on the same formants, producing quiet breath texture.
The first 220 ms gradually introduce vibrato; a separate phase accumulator
integrates its rate so rate changes do not restart the vibrato waveform.

### Machine

The harmonic slope becomes shallower, odd partials strengthen with grit, and a
bounded spectral comb introduces ridges. A finite analytic nonlinear excitation
adds the third and fifth harmonics from the polynomial soft clipper

`P(x) = (15x - 10x³ + 3x⁵) / 8`.

For `x = sin(phase)`, the exact expansion is
`75/64 sin(phase) + 25/128 sin(3 phase) + 3/128 sin(5 phase)`.
The common fundamental is supplied by the body and the latter two terms form the
grit contribution. Computing this expansion directly permits each resulting
partial to be band limited. The renderer does **not** run a time-domain
waveshaper over a rich signal, so it does not generate an unbounded harmonic
series and then disguise the resulting aliases with a low-pass filter.

The six modal oscillators gradually bend toward ratios 1.414, 2.732, 3.91,
5.87, 8.23 and 11.2 as morph and grit increase. Slow, unequal sinusoidal frequency
motion and amplitude breathing make them beat and evolve. Each oscillator keeps
running when inaudible, so an identity transition never creates a fresh modal
attack or random phase. The moving modal frequencies are intentional spectral
motion around the anchored fundamental.

## Pitch, articulation and automation

A note supplies exactly one of `midi` (fractional values permitted) or `hz`.
Optional `glideFromMidi`/`glideFromHz` provides a glide origin. `glide` sets its
duration and smoothstep motion in log frequency. The pitch accumulator integrates
the resulting instantaneous frequency; it is not `sin(2π f(t) t)`, which would
produce erroneous pitch under time variation. `pitchCents` is optional explicit
pitch automation and has no dependency on morph, brightness, grit or vowel.

`duration` is gate time. `attack`, `release` and `glide` are captured at note
onset; other controls evolve during the note. Release follows the gate until the
output boundary. Attack and release use squared-sine/cosine curves. If a gate
reaches the output end, a final 8 ms smoothstep taper prevents a hard crop. The
first and last output samples and the first/last samples of each voice are zero.

Global control points are `{at: seconds, value: number}` in strictly increasing
time. Values follow C1 smoothstep segments, hold the last value after the final
point, and use the base control before the first point. Per-note controls override
the base value and the global curve for that control. Identical seeds and inputs
produce identical floating samples on the pinned runtime and architecture.

## Aliasing and numerical limits

- Partial coefficients taper smoothly from 0.35 to 0.43 times the sample rate
  (15,435–18,963 Hz). A second instantaneous guard prevents a fast pitch glide
  from briefly moving an already allocated harmonic past this limit. Modal
  frequency and amplitude changes are interpolated and receive a similar guard.
- The polynomial's third/fifth harmonics are explicit and receive the same
  guard as other partials. No hard clipping, absolute-value waveshaping,
  phase discontinuity, rectification or unbounded FM is applied to the output.
- A guard region is not proof of zero aliasing. Vibrato, parameter modulation,
  moving resonances and envelopes create sidebands. Normal musical curves are
  slow relative to the reserved margin; adversarial fast modulation can still
  produce folded sidebands. There is no oversampled, reconstruction-filtered
  path in this prototype. Noise exists throughout the digital bandwidth and is
  shaped by stable digital filters, not a claim of continuous-time band limitation.
- The 64-partial ceiling makes very low notes comparatively dark. At high pitch
  there are too few harmonics to resolve a human vowel convincingly. The most
  useful range is approximately 55–1760 Hz, with C#4 chosen for the identity demo.
- Harmonic recurrence uses double precision and is restarted from the common
  carrier every sample, preventing accumulated oscillator-recursion drift.
  Phases are wrapped. TPT bandpass states remain bounded at the restricted
  center frequencies. Floating transcendental functions can differ across V8,
  CPU or runtime versions; byte identity is claimed only for a pinned runtime.
- There is no hidden limiter or automatic per-performance normalization. Large
  coherent polyphony can overload. Keep gain and velocities moderate and inspect
  `stats.clippedSamples` before PCM export. A renderer must refuse or explicitly
  account for clipping rather than silently saturate these floats.

## Resource limits and statistics

Validation permits at most 30 seconds, 128 notes, 2048 points per control and
eight concurrent voices including release tails. The sample array is at most
10,584,000 bytes. Synthesis cost is bounded by 64 harmonics plus six modes and
three noise filters per active voice sample; voice state is small and reused.
There are no recursively created delay buffers or unbounded file/process calls.
The renderer reports peak, RMS, clipping count, rendered voice frames, harmonic
ceiling and control block size. `maximumPartialHz` is an evaluated nominal
partial-frequency statistic, not an FFT alias-energy measurement. Performance
measurements belong in the experiment's verification report and vary by host.

## Signal-processing references

The implementation uses established techniques, without copying DSP source:

- Julius O. Smith, *Spectral Audio Signal Processing*, additive sinusoidal
  modeling and time-varying sinusoidal synthesis:
  <https://ccrma.stanford.edu/~jos/sasp/>.
- Julius O. Smith, *Physical Audio Signal Processing*, modal resonators and
  voice source/filter models: <https://ccrma.stanford.edu/~jos/pasp/>.
- Vadim Zavalishin, *The Art of VA Filter Design*, topology-preserving
  state-variable filters: <https://www.native-instruments.com/fileadmin/ni_media/downloads/pdf/VAFilterDesign_2.1.0.pdf>.
- Dennis Klatt, “Software for a cascade/parallel formant synthesizer,” JASA
  67(3), 1980, DOI <https://doi.org/10.1121/1.383940>, for the general formant
  synthesis context. This instrument is not an implementation of Klatt's model.
- George Marsaglia, “Xorshift RNGs,” *Journal of Statistical Software* 8(14),
  2003, DOI <https://doi.org/10.18637/jss.v008.i14>.

Automated tests can expose discontinuities, amplitude errors and pitch coupling.
They cannot establish that a transformation is perceptually smooth, vocal,
beautiful or musically compelling. Use the supplied listening demonstrations.
