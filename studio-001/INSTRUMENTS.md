# Signature Rack · instrument reference

Generated from the registry by `node studio-001/rack/docs.ts` (rack 1.0.0, interface 1.0.0). Do not edit by hand.

Every instrument renders at a calibrated nominal level: a reference note at macro 0 and velocity 0.8 measures -20 dBFS RMS, so part gains compare across families. `Suggested gain` is the balance of the approved auditions. Controls accept a constant, `[[beat, value], ...]` ramps or `{ "steps": [[beat, value], ...], "glide": beats }`, either absolute (`controls`) or added to the macro mapping (`offsets`); values are clamped to the listed range.

## warm → machine · living-bass

### `living-bass` · Living Bass

West Coast low-pass-gated complex oscillator over a phase-locked sine sub that turns, continuously and in tempo, into a folded, geared, driven machine with ratcheting servo slides and metal chassis strikes.

Version `1.0.0+mutation-001-A` · range C1–C4 (MIDI 24–60) · suggested gain -3 dB · macro `warm → machine`

| Articulation | Effect |
|---|---|
| `normal` | plucked through the low-pass gate (gate 90 %) |
| `accent` | harder strike (velocity x1.15), chassis hit at the machine end |
| `ghost` | soft (velocity x0.6), short (50 %) |
| `staccato` | short (45 %) |
| `legato` | no re-strike; travels from the previous pitch (slide, default 0.06 s) |

| Control | Range | What it does |
|---|---|---|
| `fold` | 0 … 1 | sine-folder gain: harmonic richness |
| `pm` | 0 … 1.5 | 1:1 phase modulation: saw-like edge |
| `grind` | 0 … 1.15 | 1:2 phase modulation: sub-octave grind |
| `gear` | 0 … 0.7 | phase-locked sub-octave chopper depth |
| `drive` | 0 … 1 | asymmetric tube drive |
| `bright` | 0 … 1 | low-pass-gate opening range |
| `hold` | 0 … 0.84 | gate opening while a note is held |
| `chassis` | 0 … 1 | metal chassis strikes and ratchet clicks |
| `ratchet` | 0 … 1 | slides step through semitones |
| `servo` | 0 … 1 | 0 damped finger slide .. 1 overshooting servo |
| `motion` | 0 … 1 | depth of the tempo-synced modulation |
| `harm` | 0 … 1 | octave/fifth harmonic selector |
| `body` | 0 … 1 | harmonic body over the constant sub |

Setup (per part): `seed` (0 … 4294967295: random seed for drift and chassis noise).

Per-note parameters: `scoop` (semitones to rise from on a fresh strike); `dive` (semitones to dive at the end of the note); `diveBeats` (length of the dive in beats).

## human → impossible · impossible-voice

### `impossible-voice` · Impossible Voice

Additive source-filter voice (no words, no language, no real singer): vowels drift, breath and cries, then bent harmonic series, split formants, undertones, an overtone melody, spectral shimmer and a sympathetic glass halo tuned to the key.

Version `1.0.0+mutation-001-B` · range G2–C6 (MIDI 43–84) · suggested gain 0 dB · macro `human → impossible`

| Articulation | Effect |
|---|---|
| `sung` | fresh onset with a small scoop |
| `legato` | glides from the previous note (slide in beats, default about 0.06 s) |
| `detached` | shorter (80 %) |
| `cry` | upward voice-break flip at the onset (param cry, semitones, default 1) |
| `fall` | sighing fall at the end (param fall, semitones, default 0.8) |
| `hum` | closed-mouth "mm" unless a vowel is given |

| Control | Range | What it does |
|---|---|---|
| `breath` | 0 … 1 | pitch-synchronous aspiration |
| `tilt` | 0 … 1 | source tilt: soft .. bright |
| `size` | -1 … 1 | tract scale (formants) |
| `split` | 0 … 0.3 | each formant divides into two peaks |
| `stretch` | 0 … 0.05 | harmonic n at n^(1+stretch): the series bends into a bell |
| `under` | 0 … 1 | undertone series under the voice |
| `whistle` | 0 … 1 | overtone-singing melody (overtone lane) |
| `glass` | 0 … 1 | send to the sympathetic glass halo |
| `shimmer` | 0 … 1 | vibrato migrates into the spectrum |
| `even` | 0 … 1 | even harmonics (1 = normal, 0 = hollow) |
| `disperse` | 0 … 1 | harmonics drift apart, high ones linger |
| `vib` | 0 … 1.5 | vibrato depth scale |

Setup (per part): `size` (-1 … 1: fixed tract scale (giant .. small)); `detune` (-50 … 50: cents); `vibRate` (3 … 8: Hz); `vibCents` (0 … 60: vibrato depth); `vowelTau` (0.03 … 0.6: vowel glide time constant (s)); `seed` (0 … 4294967295: random seed); `haloDecay` (0.2 … 3: glass resonator decay (s)); `haloGain` (0 … 3: halo level scale).

Per-note parameters: `vowel` (one of mm, oo, oh, aw, ah, uh, eh, ee); `to` (vowel reached by the end of the note); `scoop` (semitones); `cry` (semitones); `fall` (semitones).

## clockwork → alien machinery · mechanical-orchestra

### `mechanical-orchestra/bar` · Modal bar

Mallet-struck modal bar; mode ratios travel from a consonant tuned bar (1:4:10, motor tremolo) through a free-free bar to an alien gong with beating twin modes. Consecutive notes hocket left/right (setup spread).

Version `1.0.0+mutation-001-C` · range C3–C7 (MIDI 48–96) · suggested gain -8 dB · macro `clockwork → alien machinery`

| Articulation | Effect |
|---|---|
| `strike` | mallet |
| `soft` | soft mallet |
| `hard` | hard mallet |
| `muted` | damped short |
| `ring` | long ring |

| Control | Range | What it does |
|---|---|---|
| `hardness` | 0 … 1.2 | mallet hardness |
| `damp` | 0.2 … 1.5 | decay scale (default 0.75 - 0.2 macro) |
| `detune` | -50 … 50 | cents |

Setup (per part): `seed` (0 … 4294967295: random seed); `spread` (0 … 1: stereo spread (default 0.45, alternating left/right)).

Per-note parameters: `hardness` (per-note mallet hardness); `damp` (per-note decay scale).

### `mechanical-orchestra/bow` · Friction-bowed bar

The same bar driven by friction (stick-slip pulses plus rosin noise). Toward the alien end, bow overpressure skips slips: subharmonics an octave, then a twelfth, below.

Version `1.0.0+mutation-001-C` · range G2–C6 (MIDI 43–84) · suggested gain -14 dB · macro `clockwork → alien machinery`

| Articulation | Effect |
|---|---|
| `swell` | slow bow (attack about 0.45 s) |
| `bite` | fast attack, scratchier |
| `overpressure` | octave subharmonic |
| `fifth-under` | twelfth-below subharmonic |

| Control | Range | What it does |
|---|---|---|
| `sub` | 0 … 1 | overpressure (default from the macro) |
| `chatter` | 0 … 0.6 | irregular slips |
| `attack` | 0.02 … 2 | bow attack (s) |

Setup (per part): `seed` (0 … 4294967295: random seed); `spread` (0 … 1: stereo spread (default 0.3, alternating left/right)).

Per-note parameters: `attack` (seconds).

### `mechanical-orchestra/spring` · Dispersive spring

Coil-spring waveguide with an all-pass dispersion chain, tuned on its low harmonics; from a near-harmonic plucked steel string to a long chirping laser spring.

Version `1.0.0+mutation-001-C` · range E1–C5 (MIDI 28–72) · suggested gain -5 dB · macro `clockwork → alien machinery`

| Articulation | Effect |
|---|---|
| `pluck` | default |
| `twang` | strong attack pitch bend |
| `damped` | short, palm-muted |
| `laser` | maximum dispersion regardless of the macro |

| Control | Range | What it does |
|---|---|---|
| `bend` | 0 … 0.3 | attack twang (default 0.02 + 0.08 macro) |
| `decay` | 0.1 … 4 | T60 seconds (default by pitch and macro) |

Setup (per part): `seed` (0 … 4294967295: random seed); `spread` (0 … 1: stereo spread (default 0, alternating left/right)).

### `mechanical-orchestra/tine` · Buzzing tine

Clamped steel tine (cantilever modes) with a sitar-like bridge-contact buzz that grows toward the alien end.

Version `1.0.0+mutation-001-C` · range C4–E7 (MIDI 60–100) · suggested gain -11 dB · macro `clockwork → alien machinery`

| Articulation | Effect |
|---|---|
| `pluck` | default |
| `clean` | no buzz |
| `buzz` | full buzz |

| Control | Range | What it does |
|---|---|---|
| `buzz` | 0 … 1 | bridge buzz (default from the macro) |
| `detune` | -50 … 50 | cents |

Setup (per part): `seed` (0 … 4294967295: random seed); `spread` (0 … 1: stereo spread (default 0.2, alternating left/right)).

### `mechanical-orchestra/clock` · Escapement clock

Escapement tick (small high modes) or tock (lower modes). Toward the alien end accented ticks (velocity >= 0.5) sprout tiny high springs tuned to the note pitch.

Version `1.0.0+mutation-001-C` · range C4–E7 (MIDI 60–100) · suggested gain -14 dB · macro `clockwork → alien machinery`

| Articulation | Effect |
|---|---|
| `tick` | high escapement tick |
| `tock` | lower knock |

| Control | Range | What it does |
|---|---|---|
| `zip` | 0 … 1 | spring zips on accented ticks (default from the macro) |

Setup (per part): `seed` (0 … 4294967295: random seed); `spread` (0 … 1: stereo spread (default 0.15, alternating left/right)).

### `mechanical-orchestra/bearings` · Bearings

Tiny tuned metal pings (short bars) for textures; use a part `textures` block for seeded Poisson rain over chord tones.

Version `1.0.0+mutation-001-C` · range C5–C8 (MIDI 72–108) · suggested gain -22 dB · macro `clockwork → alien machinery`

| Articulation | Effect |
|---|---|
| `ping` | default |

Setup (per part): `seed` (0 … 4294967295: random seed); `spread` (0 … 1: stereo spread (default 0.8, random per note)).

## Context instruments (for musical-context mixes)

### `context/kick` · Context kick

Tuned kick from the HEADLINER 001 toolkit (unchanged); pitch sets the body pitch. For musical-context mixes.

Version `1.0.0+headliner-001` · range C1–C3 (MIDI 24–48) · suggested gain -8 dB · macro `none`

| Articulation | Effect |
|---|---|
| `hit` | default |
| `short` | tighter body |

### `context/snare` · Context snare

Snare/clap from the HEADLINER 001 toolkit (unchanged). Pitch is ignored. For musical-context mixes.

Version `1.0.0+headliner-001` · range C-1–G9 (MIDI 0–127) · suggested gain -12 dB · macro `none`

| Articulation | Effect |
|---|---|
| `snare` | snare with clap layer |
| `ghost` | soft short snare |
| `clap` | clap-forward |
