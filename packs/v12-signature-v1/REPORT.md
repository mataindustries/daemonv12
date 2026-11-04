# V12 SIGNATURE v1 · Sound-design and validation report

**Scope.** Sixteen generated instruments, a dry audition and a 28-second
showcase for DaemonV12 0.7.0, with no engine change. This report separates three
kinds of statement: **measured** (numbers from `scripts/inspect-v12-signature.ts`,
`scripts/verify-v12-signature.ts`, the engine's analysis and the tests),
**inferred** (design intent and expected musical effect), and **needs listening**.
No one has listened to this audio; the agent that made it cannot play sound.

## 1. Why this pack exists

BANGER LAB 001's audit ranked the sound library as the largest limitation: 22
approved sounds, *no sustained tonal pad, lead or long bass*, one synthetic
voice, two kick sources, GM excluded for rights. v0.7 has no loops or
time-stretch, so a held note lasts only as long as its source divided by its
playback rate. The pack answers that with long, tuned sources (4.5–10 s for
every bass, lead, pad and voice), a melodic-range table, and articulation
recipes that use v0.7's existing `gate`, `envelope`, `offsetSeconds` and
`chokeGroup`.

## 2. Design (inferred intent, implemented DSP)

Home key A minor, A4 = 440 Hz, equal temperament. Three shared identities give
the pack one sound rather than sixteen unrelated presets:

1. **Locked A1 low end.** Pitch drops are integrated so each adds a whole number
   of cycles (SUB HAMMER 4, IRON PULSE 3, CONVERGENCE 6); REACTOR's FM layer is
   inverted because its fundamental coefficient J0−J2 is negative at the indices
   it sustains at. Result: all settle in phase with ABYSS's zero-phase sine.
2. **CHROME**: an equal-tempered minor-third bell (0.5, 1, 1.189, 1.498, 2) plus
   eight inharmonic modes, used across bell, hats, snare ring, kick tick, riser
   and impact.
3. **Ghost vowel**: dark "oh" and open "ah" formants shared by REACTOR's growl,
   PHANTOM's voicing and SPECTER's choir.

| Sound | Technique (see catalog `method`) | Intended character |
|---|---|---|
| SUB HAMMER | Two-stage pitch drop 571→55 Hz, relaxing biased tanh, strike noise, beater click; 4× | Massive, tuned, tight when gated |
| IRON PULSE | 1.3 kHz→55 Hz drop, 150 Hz knock, heavy asymmetric drive + short fold, CHROME tick; 4× | Punch and aggression for drops |
| TITANIUM CRACK | Pitch-dropping membrane modes on A3, two-stage wire noise, crack, CHROME ring, diffused side room; 4× | Layered, impactful backbeat |
| NEON CLAP | Five panned bursts, tail through an 882 Hz comb; 4× | Bright, textured, wide |
| GHOST TICK / OPEN CIRCUIT | Squares on CHROME ratios, 10 kHz band, noise grain; open hat sweeps 7.2→10.5 kHz | Crisp tick; expressive open ring |
| ABYSS | Additive sine A1 with a 120 ms 2nd–5th harmonic bloom, slow 2nd-harmonic breathing | Deep, clean, sustained sub |
| REACTOR | Detuned saws + FM + phase-locked sine, 4× drive, vowel band-passes, 20 ms filter bark, slow breathing, mono < 180 Hz | Aggressive, rich mid-bass |
| SIGNAL | 1:2 FM + PWM through enveloped resonant low-pass, harmonic/inharmonic pings, centred voice + ±7 cent side pair; 2× | Hypnotic digital pluck that sustains |
| PHANTOM | 7-voice drifting unison (centre three in both channels), sub-octave square, delayed 5.1 Hz vibrato, 1.4 s bloom, vowel peaks, breath; 2×; root E5 | Powerful, vocal, emotional lead |
| EVENT HORIZON | 222 additive partials of an open fifth with independent LFOs, drift, a travelling spectral bump, rotating pans, chord-tone resonator noise | Evolving, spacious, chord-agnostic |
| AFTERGLOW | Six drifting saws + triangle, breathing low-pass, tanh warmth | Warm single-note chord pad |
| SPECTER | Three-voice additive glottal source through morphing four-formant vowels (oo→oh→ah→oh→oo), pulsed breath | Androgynous synthetic choir |
| CHROME STRIKE | Twelve CHROME modes with L/R split partners, a two-octave sparkle layer, FM anvil tick | Distinctive tuned metal |
| ASCENSION | A–E fifths gliding exactly one octave, swept band-pass noise with rising Q, CHROME shimmer, accelerating flutter | Musical riser ending on A |
| CONVERGENCE | A2→A1 locked sub drop, thump, crack, A-minor saw stab, diffused CHROME tail, debris | Cinematic downbeat |

## 3. Source measurements (measured)

All 16: 44,100 Hz PCM16, peak exactly at target, no full-scale samples, first
and last frames exactly zero, |DC| < 3e-4. True peak is 4× windowed-sinc.
Click = the largest 1 ms burst above 12 kHz relative to the loudest other frame
within ±40 ms, after the designed attack (0 dB means no isolated step; periodic
waveform edges do not count). Tuning = autocorrelation median [10th, 90th
percentile] in cents, or the spectral peak for inharmonic sounds. Stereo =
L/R correlation / mono fold-down loss in dB. Centroid = start → middle → end.

| Sound | Peak / TP dBFS | RMS | Click dB | Tuning (cents) | Stereo | Attack→−3 dB / −20 dB (s) | Centroid Hz |
|---|---|---:|---:|---|---|---|---|
| sub-hammer | −4 / −4.00 | −16.0 | 0 | +0.1 [0, +6] | mono | 0 / 0.68 | 60→56→56 |
| iron-pulse | −4 / −3.93 | −19.6 | 0 | +7.1 (drop tail) | mono | 0 / 0.20 | 70→61→61 |
| titanium-crack | −5 / −4.78 | −23.1 | 0.4 | peak +0.05 (A3) | 0.97 / −0.06 | 0 / 0.24 | 2768→5539→5691 |
| neon-clap | −5 / −5.00 | −28.4 | −1.0 | — | 0.77 / −0.54 | 0.03 / 0.31 | 7196→7305→7454 |
| ghost-tick | −7 / −6.10 | −26.4 | −16.7 | — | mono | 0 / 0.04 | 11784→11747→11598 |
| open-circuit | −7 / −7.00 | −29.4 | 0.8 | — | 0.81 / −0.42 | 0 / 0.55 | 11147→11517→11583 |
| abyss | −5 / −5.00 | −12.5 | 0 | 0.0 [−0.01, +0.01] | mono | 0.005 / 7.58 | 58→56→57 |
| reactor | −5 / −4.98 | −18.6 | 1.3 | 0.0 [−1.1, +1.2] | 0.78 / −0.52 | 0 / 5.32 | 248→253→234 |
| signal | −6 / −5.61 | −19.3 | 1.0 | 0.0 [−0.6, +0.6] | 0.86 / −0.32 | 0 / 4.22 | 804→672→835 |
| phantom | −6 / −5.97 | −13.3 | 1.9 | +1.1 [−16, +17] vibrato | 0.66 / −0.80 | 0.025 / 5.79 | 1143→1728→1519 |
| event-horizon | −7 / −6.97 | −21.2 | 1.0 | −0.5 [−1.2, 0] | 0.78 / −0.52 | 1.76 / 9.60 | 870→1109→721 |
| afterglow | −7 / −6.99 | −17.1 | 1.7 | −0.1 [−1.2, +1.0] | 0.68 / −0.77 | 0.61 / 7.52 | 383→279→398 |
| specter | −7 / −7.00 | −22.4 | 1.8 | −4.0 [−31, +15] vibrato/ensemble | 0.76 / −0.54 | 1.19 / 5.79 | 572→809→674 |
| chrome-strike | −6 / −5.99 | −22.9 | 0.7 | peak −0.02 (A4) | 0.57 / −1.06 | 0 / 2.19 | 521→471→435 |
| ascension | −6 / −4.74 | −29.0 | — (one long attack) | lands on A4 (glide) | 0.66 / −0.81 | 5.59 / — | 574→985→2500 |
| convergence | −4 / −3.99 | −14.5 | 1.0 | peak −0.3 (A1) | 0.74 / −0.62 | 0 / 4.12 | 190→197→216 |

**Low-end lock** (correlation below 80 Hz with ABYSS once settled; peak of the
same-tick sum at velocity 1): SUB HAMMER 0.92 (−0.46 dBFS), IRON PULSE 0.81
(−2.17), REACTOR 0.95 (−2.46), CONVERGENCE 0.88 (**+0.17**: lower one of them).
Low band (< 150 Hz) of every stereo bass, pad and impact folds to mono with at
most −0.15 dB loss (EVENT HORIZON, CONVERGENCE low-band correlation > 0.99).

**Spectra.** Inharmonic power between harmonics in a sustain window: ABYSS
−87.5 dB, SIGNAL −83.0, REACTOR −71.8 (no audible aliasing from its 4× drive),
AFTERGLOW −65.4, PHANTOM −35.9 relative to its sub-octave series (the
remainder is its intended breath layer). REACTOR harmonics 2–16 sit between
−2 and −20 dB; PHANTOM harmonics 2–5 between −9 and −11 dB.

## 4. Problems found and fixed (measured before → after)

| Problem | Evidence | Fix |
|---|---|---|
| SIGNAL folded to mono with −3.3 dB loss | ±3.5 cent L/R voices beating at 1.8 Hz, correlation −0.07 | Centred main voice + quieter ±7 cent side pair → 0.86 / −0.32 dB |
| REACTOR cancelled ABYSS | Fundamental correlation −0.55 (FM fundamental J0−J2 < 0) | Inverted FM layer → 0.95 |
| REACTOR was a second sub | 81% of energy 30–120 Hz, centroid 124–166 Hz | Less sine, more drive/saws, higher filter, vowel and 2.6 kHz bands, mono < 180 Hz → 2nd harmonic +7 dB over the fundamental |
| PHANTOM, SIGNAL, CHROME too dark | Centroids 0.8–1.0 kHz (E5 lead), bell 0.2% above 2 kHz | Higher bloom and sustain cutoffs, vowel F3 +6 dB, sparkle layer |
| Pads/hats/riser too wide | OPEN CIRCUIT and ASCENSION fold-down −2.9 / −2.4 dB | Shared metal and centred climb, partial decorrelation → −0.42 / −0.81 dB |
| Audition bleed | Open-hat ring 0.5 s into ABYSS's slot (integration test) | Ring moved to beat 3; bell given its own bar |
| Flat arrangement | Drop only 0.6 LU above the groove; arp as loud as the kick | Lighter groove, sub pulled from bar 8, louder drop lead/chords/REACTOR → drop 2.2 LU above the groove, 2.0 above the build |
| Measurement artifacts | 5 ms envelope read 55 Hz as tremolo; saw-reset edges read as clicks | 25 ms envelope windows; neighbour-maximum click baseline |

## 5. Showcase: IGNITION (measured and inferred)

128 BPM, A minor, 14 bars + released tail = **28.000 s** (1,234,800 frames). 13
tracks, 591 notes, all sixteen sounds, no GM. Progression Am–F–G–E resolving to
Am. The **hook** (PHANTOM, bars 9–12) is a 3+3+2 tresillo per bar:
E5–A5–G5 | F5–E5–C5 | D5–G5–F5 | E5–G#5–B5 → A5. Rising fourths (E–A, D–G)
answer each other and the E-major climb resolves to the held A5. SPECTER sings
the first half an octave down in bars 5–6 so the drop *returns* to a melody the
listener has half-heard (inferred).

| Section | Bars | LUFS | True peak | L/R corr. | Low-band corr. |
|---|---|---:|---:|---:|---:|
| IGNITION | 1–2 | −18.2 | −4.8 | 0.93 | 1.00 |
| ORBIT | 3–6 | −14.9 | −1.8 | 0.92 | 1.00 |
| ASCENSION | 7–8 | −14.6 | −2.9 | 0.87 | 0.99 |
| CONVERGENCE (drop) | 9–12 | **−12.7** | −1.6 | 0.87 | 0.99 |
| AFTERGLOW | 13–14 | −13.6 | −2.3 | 0.85 | 1.00 |
| tail | 15 | −31.0 | −18.9 | 0.72 | 0.98 |

Master: −14.2 LUFS, LRA 5.6 LU, −1.62 dBTP, 0 clipped samples at any stage, DC
−2.4e-4, mono fold-down −0.27 dB, last 10 ms peak −60.8 dBFS (no audible cut at
28 s). Drop octave bands relative to 1 kHz: 63 Hz +9, 125 +2, 250 +4, 500 +2,
2 k −3, 4 k −5, 8 k −5, 16 k −9 dB. Stem loudness (whole piece): kick −18.9,
PHANTOM −19.3, CONVERGENCE −21.0, snare −21.6, ABYSS −22.0, AFTERGLOW −23.0,
REACTOR −23.3, SIGNAL −24.2 LUFS. Mixing used only track gain/pan, gain
automation (kick-locked pumping with 1/64 look-ahead ramps), high-pass,
delay, reverb and a gentle master compressor; no limiter.

Audition: 57.000 s, 10 tracks, Node-only route (no FFmpeg needed), −15.1 LUFS,
−2.2 dBTP, no clipping; each sampler sound is silent before its slot and has
decayed 40 dB within 0.7 s after it (test-checked).

## 6. Reproducibility, budget and performance (measured)

- Two fresh processes regenerate all 20 pack files byte for byte; the catalog
  pins every WAV's SHA-256. Generation takes about 25 s (EVENT HORIZON's 222
  partials take 8 s of it).
- Both projects render byte-identically in two fresh directories (WAV, stems,
  manifest, analysis, MIDI; 14 and 17 artifacts). Audition WAV
  `aa1538c8…`, showcase WAV `e73f3029…` (Node 22.22.0, FFmpeg 6.1.1-3ubuntu5).
- Render time on this 4-core container: audition about 6 s, showcase about
  60 s (FFmpeg production route with 13 stems).
- v0.7 budget: showcase **58.2%** of the one-billion interpolation taps, largest
  voice 2.7% of 128 MiB; audition 9.7% / 1.2%. Sustained transposed voices are
  the main cost; a 75-second piece with the same density would exceed the
  budget unless it favours root notes and single-voice pads.
- Tests: `tests/v12-signature.test.ts` (9: regeneration, format/headroom/DC/
  endpoints, hold lengths, tuning, phase lock, clicks/mono, spectral roles,
  catalog/kit/MCP discovery, projects and budget) and
  `tests/v12-signature.integration.test.ts` (Node-only audition render compared
  to the committed WAV with slot separation; showcase render with exact length,
  aligned stems, headroom, mono low end, section contrast and committed hash
  when FFmpeg matches).

## 7. What still needs human listening

Measurements cannot say whether these are *good*. Listen on headphones, a phone
speaker and a car or club system, and judge:

1. **PHANTOM** (highest risk): does the seven-saw unison with vowel peaks sound
   powerful and emotional, or nasal/cheap? Is the delayed vibrato natural at A5?
2. **SPECTER**: additive vowels can sound buzzy or "robotic"; is it haunting or
   uncanny in a bad way? Does the ensemble detune read as a choir?
3. **SIGNAL**: is the FM/PWM pluck distinctive enough to carry a hook, or generic?
4. **REACTOR**: aggressive enough? Is the 20 ms filter bark musical on rolling
   sixteenths, or clicky? Does the slow breathing sound alive or seasick?
5. **EVENT HORIZON / AFTERGLOW**: evolving and lush, or organ-like/static? Does
   the travelling spectral bump read as motion or as phasing?
6. **The hook and arrangement**: is the tresillo hook memorable? Does the drop
   land (the pulled sub in bar 8 is the main device)? Does the A5 resolution pay off?
7. **Kicks with sub**: does the phase lock translate as weight on a real system;
   is SUB HAMMER's 0.68 s decay too long at 128 BPM without a gate?
8. **Top end**: TITANIUM CRACK, NEON CLAP and both hats are measured, not heard;
   check harshness above 8 kHz and that the clap's comb sounds "neon", not metallic.

## 8. Recommended next iteration (after audition)

1. **Fix the two or three sounds listeners flag**, most likely PHANTOM's voicing
   and SPECTER's vowels, by editing their recipes and regenerating; the tests
   pin structure, not taste.
2. **Multi-root sustained instruments** (assets only, no engine change): render
   AFTERGLOW, PHANTOM and SPECTER at two or three roots (for example C, E, A) and
   map them through a kit, so chords and lines sit nearer rate 1. That cuts the
   interpolation budget (the main obstacle to 60–90 s pieces), shortens no notes
   and keeps formants and vibrato natural across the range.
3. Then decide the license and promote the pack into `examples/assets/` so
   `init` and the MCP tools give it to every agent by default.
