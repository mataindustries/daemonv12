# MORPH//01 diagnosis: why a correct instrument can sound small

I read `experiments/morph-voice/synth.mjs`, its DSP/README/report, and re-rendered the
three MORPH//01 demonstrations at the pinned commit (`c9eebf0`). I can't hear audio in
this environment. Everything below is either **measured** (code or proxy analysis by
`analyze.py`) or explicitly labelled a **listening hypothesis** for a human to confirm.

## Measured: what the signal actually contains

| Demo (mono, as rendered) | Energy < 150 Hz | Energy 150 Hz–2 kHz | Energy > 2 kHz | Momentary loudness spread (P95−P10) | Stereo | Onsets/s |
|---|---:|---:|---:|---:|---|---:|
| `the-transformation` | **0 %** | 96 % | 4.0 % | **1.5 LU** | mono | (1 sustained note) |
| `the-performance` | **0 %** | 95.5 % | 4.5 % | **3.8 LU** | mono | 2.3 |
| `the-impossible-gesture` | 24 % (glide to C#3) | 73 % | 3.4 % | 4.5 LU | mono | 4.3 |

Spectral centroid stays between about 560 and 850 Hz (P10–P90) for the whole
performance. In other words, nearly all of the energy sits in one octave-and-a-half
band, at a nearly constant level, in one channel, with no low end.

## Measured: architectural causes in `synth.mjs`

1. **Identities are power-normalized.** Every control block rescales the 64 harmonic
   coefficients to a fixed energy (`scale = 0.82 / sqrt(energy)`). The machine identity
   therefore can't be bigger, louder or denser than the glass. MORPH//01's own report
   measures 0.42 dB RMS across 11 morph positions. That was the design goal, and it
   rules out growth.
2. **Velocity scales amplitude only.** Timbre doesn't depend on how hard a note is
   played. In acoustic and analog sources, louder means brighter and more nonlinear.
3. **"Grit" is additive, not a nonlinearity.** It adds fixed third- and fifth-harmonic
   coefficients (at most 25/128 × grit ≈ 0.07 of the carrier) and a static spectral
   comb. There's no level-dependent saturation, intermodulation, subharmonics or noise
   modulation, which are the things that make machines and throats sound strained.
4. **The carrier is perfectly periodic.** There's one phase accumulator, no jitter and
   no shimmer. The vibrato is a pure 5.2 Hz, 9-cent sine with the same 220 ms onset on
   every note. The breath noise runs continuously and isn't pulsed by the glottal
   cycle, so it can't fuse with the voice. It sits beside it as hiss.
5. **The vowel is a static magnitude envelope.** Three Lorentzian peaks are evaluated
   at harmonic frequencies. There's no tract physics, so there are no closures,
   nasals, bursts, fricatives or consonants. Only vowels exist, and vowels alone can't
   articulate.
6. **Smoothness is enforced everywhere.** 4 ms one-pole smoothers, smoothstep
   automation and 32-sample coefficient interpolation mean no change can be abrupt,
   even when the music needs it to be.
7. **No space, no stereo, no low register.** The output is dry mono with no reverb,
   delay or width. The 64-harmonic ceiling and C#4-centred writing leave nothing
   below 138 Hz. The cue's backing was deliberately restrained (sub amplitude 0.30).
8. **No transient design.** Attacks are squared-sine ramps of 11 ms or more, with no
   click, burst, pitch blip or noise layer.
9. **The modal "metal" is faint.** Six modes at 0.02–0.11 relative level sit under a
   normalized harmonic body.
10. **The writing has one line and one dynamic.** It's a monophonic hook in one
    register, with velocities 0.60–0.86 (about 3 dB), repeated three times with gentle
    timbre changes.

## Listening hypotheses (not verified by ear)

- The voice probably reads as an organ- or accordion-like vowel pad rather than a
  singer: perfectly periodic, sine-phase harmonics, vowels without consonants.
- The machine identity probably reads as a brighter version of the same organ rather
  than machinery. It has the same level, the same envelopes and no mechanical noise
  or impacts.
- The transformation probably sounds like a slow filter sweep, because loudness is
  held constant while only tilt changes.
- With no low end, no space and mono, it will feel small: "inside a box" on any system.
- The structure (one hook, three answers, the same envelope family) is predictable.

## Keep, change, discard

| Idea from MORPH//01 | Verdict | Where it went in MORPH//02 |
|---|---|---|
| Formants in Hz, independent of pitch | **Keep, deepen** | A: a physical 44-section waveguide throat whose *size* is independent of pitch (child → giant) |
| Contrary motion: pitch falls while the mouth opens | **Keep** | A, bar 3: pitch falls 19 semitones as the throat grows and "eh" opens to "ah" |
| Phase-continuous state through morphs | **Keep** | A's tract and C's cables keep running state through every transformation |
| Deterministic, seeded, headless render; refuse to clip silently | **Keep** | All three sketches are byte-identical on re-render; the WAV writer throws on overload |
| Power-normalized identities | **Discard** | Transformations are allowed to grow (A: about 10 LU arc, B: about 7 LU) |
| Additive "grit" | **Discard** | 4× oversampled waveshaping, period-doubling growl, saturating feedback loops |
| Continuous breath noise | **Discard** | Breath is pulsed by glottal flow; aspiration and frication come from the tract |
| Smoothing everything | **Discard as a default** | Abrupt events are authored on purpose: stutters, register cracks, glitches, mutes |
| Dry mono demos with no low end | **Discard** | Stereo, designed spaces, an intentional sub/kick layer, mono-summed lows |
