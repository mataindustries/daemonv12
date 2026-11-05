# DAEMON//STUDIO 001 · Signature Instrument Rack

A reusable, headless production rack for DaemonV12, built from the three owner-approved MUTATION 001 instrument families.
A composer writes a new **performance score** in beats and plays the families with pitch, duration, velocity, articulation,
expression and continuous timbre controls. The score renders directly into dry, context and stem mixes, or bounces into
**native DaemonV12 assets and projects** that the unchanged engine renders.

> **Status: draft for owner review.** Nothing is merged, released or published. Licensing of generated audio is pending the
> owner's declaration: nothing here grants a license. The producer (an AI agent) **cannot hear audio**. Musical descriptions
> are design intent; numbers are signal measurements, not quality scores.

| Family | Macro | Instruments |
|---|---|---|
| **Living Bass** | `warm → machine` | `living-bass` |
| **Impossible Voice** | `human → impossible` | `impossible-voice` (any number of voices per score) |
| **Mechanical Orchestra** | `clockwork → alien machinery` | `mechanical-orchestra/bar`, `/bow`, `/spring`, `/tine`, `/clock`, `/bearings` |
| Context (musical-context mixes only) | none | `context/kick`, `context/snare` (unchanged HEADLINER 001 patches) |

The per-instrument reference (controls, ranges, articulations, per-note parameters, suggested gains) is
[INSTRUMENTS.md](INSTRUMENTS.md). It is generated from the registry.

## Listen

| File (in [`demo/`](demo)) | What it is |
|---|---|
| `crossing.wav` / `.mp3` | **CROSSING**, the new 53.8 s demonstration, as the unchanged DaemonV12 engine renders the bounced project (all parts, context drums, room) |
| `crossing-dry.wav` / `.mp3` | The same performance, instrument parts only (no context drums, no room) |
| `stems/*.flac` | The engine's 12 aligned stems of the main mix (lossless; `node studio-001/demo/restore-stems.ts NEW_DIR` restores the exact engine WAV bytes) |
| `DEMO.json`, `SHA256SUMS`, `package-manifest/` | Loudness, determinism checks, hashes, and the bounced package's projects, kits, catalog, scores and complete SHA256SUMS |

| Example (in [`scores/examples/audio/`](scores/examples/audio), -16 LUFS each) | Key, tempo | Families |
|---|---|---|
| `bass-groove.mp3` | E minor, 104 BPM | Living Bass + context drums: a new riff played warm, then as the machine |
| `bass-groove-a-minor-92bpm.mp3` | A minor, 92 BPM | **The same score file**, rendered with `--transpose 5 --bpm 92` |
| `voice-duet.mp3` | A♭ major, 66 BPM | Two Impossible Voices over bowed bars; the halo is retuned to A♭ major automatically |
| `clockwork.mp3` | D major, 132 BPM | Mechanical Orchestra: a music-box theme played three times while the machines turn alien |

## CROSSING (the demonstration)

C minor, 84 BPM, 18 bars, original material. **The unusual transformation: the three families transform in opposite
directions and cross.**

- The voice goes from impossible to human.
- The orchestra goes from alien machinery to clockwork.
- The bass goes from warm to the machine, then back to warm inside a single held note.

At bar 11 every macro sits near 0.5, and the voice and the mallet bars sing the theme in unison: the crossing point.
Score: [`scores/crossing.score.json`](scores/crossing.score.json), written with [`crossing.compose.ts`](scores/crossing.compose.ts).

| Bars | Time | Voice (macro) | Orchestra (macro) | Bass (macro) | What happens |
|---|---|---|---|---|---|
| 1–4 *alien-night* | 0:00 | 1 | 1 | — | Gong bars state the theme slowly. Laser springs, a bowed C drone with a twelfth-below subharmonic, bearings and a zipping clock. The impossible voice sings the theme's first phrase with an overtone melody, an undertone and the glass halo |
| 5–8 *arrival* | 0:11 | 1 → 0.72 | 1 → 0.72 | 0 | The Living Bass enters **warm**, a West Coast groove with finger slides. Tines and ticks wake, and the kick and snare enter. The voice sings the whole theme |
| 9–12 *crossing* | 0:23 | 0.72 → 0.45 | 0.72 → 0.42 | 0.05 → 0.62 | Bowed A♭ and B♭ chords, and a second voice enters beneath. Bar 11: the macros cross near 0.5, and the voice and bars sing the theme together |
| 13–16 *exchange* | 0:34 | 0.45 → 0 | 0.42 → 0 | 0.62 → 1 | Roles exchanged: a human voice hums into a new answer over a clockwork music box (tuned bars with motor tremolo, clean tines, ticking clock). Under it, the bass becomes the machine: triplets, revving, then thirty-second gear motion and ratcheting slides |
| 17–18 *coda* | 0:46 | 0 | 0 | 1 → 0.12 | One held low C: the machine bass relaxes back to warm while it sounds. The human hum resolves to C, and the glass halo returns on that last note as one impossible echo |

**Measurements** (engine master; plain signal statistics):

| Section | RMS | Spectral centroid | Energy < 150 Hz | Energy > 2 kHz |
|---|---:|---:|---:|---:|
| alien-night | -22.9 dBFS | 743 Hz | 6.5 % | 8.0 % |
| arrival | -17.2 dBFS | 655 Hz | 35.6 % | 7.9 % |
| crossing | -18.0 dBFS | 512 Hz | 31.6 % | 3.4 % |
| exchange | -18.1 dBFS | 490 Hz | 28.1 % | 1.6 % |
| coda | -22.3 dBFS | 506 Hz | 19.0 % | 1.1 % |

- **Main mix:** -16.4 LUFS integrated, -3.8 dBTP, LRA 8.1 LU (FFmpeg); the engine's `analyze` reads -16.51 LUFS and no clipping.
- **Dry mix:** -16.7 LUFS, -4.3 dBTP.
- **Determinism:** two bounces from separate processes produced identical package hashes, and two engine renders produced
  identical WAV, MP3 and stems.
- **Click scan:** clean; it flags only the first onset from silence.

## Quick start

From the repository root, with Node 22.18+. FFmpeg with libmp3lame is needed only for MP3, loudness, stems through the engine and
the demo build.

```bash
node studio-001/rack/cli.ts list
```

```bash
node studio-001/rack/cli.ts render studio-001/scores/examples/bass-groove.score.json work/groove
```

```bash
node studio-001/rack/cli.ts render studio-001/scores/examples/bass-groove.score.json work/groove-a92 --transpose 5 --bpm 92
```

```bash
node studio-001/rack/cli.ts bounce studio-001/scores/crossing.score.json work/crossing-package
```

```bash
node bin/daemonv12.js render work/crossing-package/main.json --out-dir work/crossing-render --stems --format wav,mp3
```

```bash
node studio-001/rack/cli.ts kit mechanical-orchestra/bar work/bar-kit --pitches 60-72 --macro 0.5
```

```bash
node studio-001/rack/cli.ts verify work/crossing-package
```

```bash
node studio-001/demo/build.ts
```

- **`render`** writes rack mixes into a new directory: `mix-dry`, `mix-context`, aligned `stems/<part>.wav` (after gain and
  pan, before the master) and `stems/room.wav`. It also writes `render.json` (peaks, clipping, loudness) and a SHA256SUMS.
  `--normalize LUFS` applies one gain to everything.
- **`bounce`** writes a sealed native package (see below).
- **`kit`** writes a native-pitch multisample kit (`note-60`, …) at a fixed macro state for use in any DaemonV12 project.
- **`demo/build.ts`** rebuilds and re-verifies CROSSING, in about 2.5 minutes.

Every command refuses to write into an existing path.

## Writing a performance score

A score is portable JSON (`schema: "daemonv12.signature-rack.score/1"`). All times are **beats** (quarter notes from
the start), so the same score plays at any tempo, and pitches are names or MIDI numbers that `transpose` moves.

```json
{ "schema": "daemonv12.signature-rack.score/1", "title": "My piece", "bpm": 96, "key": "F# minor", "swing": 0.55, "seed": 3,
  "tailSeconds": 2, "masterGainDb": 0,
  "sections": [ { "id": "verse", "bars": 4, "development": "what changes here" }, { "id": "drop", "bars": 4 } ],
  "room": { "rt60": 2.4 },
  "parts": [
    { "id": "bass", "instrument": "living-bass", "gainDb": -3, "pan": 0, "room": 0.05,
      "macro": [[0, 0], [16, 1]], "offsets": { "drive": [[16, 0], [32, -0.3]] }, "expression": [[0, 0.6], [32, 0.85]],
      "motion": [ { "fromBeat": 8, "toBeat": 32, "preset": "triplets" } ],
      "notes": [ [0, 1, "F#1", 0.9, { "articulation": "accent", "scoop": 2 }], [1.5, 0.5, "A1", 0.7, { "slide": 0.1 }] ] } ] }
```

| Field | Meaning |
|---|---|
| `notes` | `[beat, beats, pitch, velocity?, { articulation?, slide?, ...per-note params }]` or the same as an object. Velocity defaults to 0.8. `slide` is a legato glide in beats |
| `macro` | The family's transformation macro, 0 → 1 (warm → machine, human → impossible, clockwork → alien machinery). It moves every timbre dimension along the approved path |
| `controls` / `offsets` | Any listed control: an absolute curve, or a curve added to the macro mapping. Values are clamped to the safe range |
| `expression` | Dynamics and intensity, 0..1 (0.7 neutral): scales velocity and, per family, the gate opening (bass) or level and brightness (voice) |
| curves | A number, `[[beat, value], ...]` (smooth ramps), or `{ "steps": [[beat, value], ...], "glide": beats }` |
| `repeats` | `{ fromBeat, toBeat, lengthBeats, notes }`: a cell repeated deterministically |
| `textures` | `{ fromBeat, toBeat, density (events/s curve), pitches, velocity?, beats?, seed? }`: seeded Poisson notes (bearings rain) |
| `humanize` | `{ timingMs, velocity, seed? }`: seeded micro-timing and velocity variation |
| `breaths`, `overtone` | Impossible Voice: `{ beat, beats, kind: "in" \| "out" }` breaths; overtone-melody lane (harmonic numbers) |
| `motion` | Living Bass: tempo-synced modulation spans. `preset` is one of `none`, `breath`, `eighths`, `sixteenths`, `triplets`, `revving`, `thirty-seconds`, `growl`, or give `div`/`pattern`/`shape` |
| `setup` | Fixed per-part options: seeds, voice `size`/`detune`/`vibRate`, `halo` pitches (default: the key's chord tones), stereo `spread` |
| `room`, `context` | Per-part room send (wet-only shared FDN room); `context: true` parts appear only in the context mix |
| `sections` | Bars per section. Bounces cut one phrase per section and part |

`swing` delays notes exactly on odd sixteenths.

**Validation:** scores are checked before anything renders. Pitch outside an instrument's range, unknown articulations,
controls or setup options, bad vowels, unsafe ids, or a piece longer than the engine's 600 s all fail with numbered,
specific messages.

**Saved performance:** every render and package saves the authored `score.json` **and** the expanded `performance.json`
(every generated note, the resolved key and the instrument versions).

## Two render routes, one result

1. **Rack direct render.** Each part is rendered as one continuous performance at a calibrated nominal level, then gain and
   pan, a shared wet-only room, and the dry and context mixes. The frame count equals the engine's output length for the
   score.
2. **Native bounce.** Each part's take is cut into one stereo PCM16 phrase per section, **at the exact frames the engine
   computes** (integer-microsecond tempo, 960 PPQ, each tick rounded independently). The phrases are written as drumkit
   kits and ordinary v0.7 projects: `main.json` (all parts, context and room) and `dry.json`. They play at rate 1 and
   velocity 1, so the engine sum reproduces the rack take.
   - Measured on the test fixture: engine stems are within 2 LSB of the rack stems (the voice stem is bit-identical).
   - Frame counts are equal.

   The package also carries `score.json`, `performance.json`, `registry.json`, `catalog.json` (asset hashes, frames, section
   boundaries, generator hashes, engine base, Node version), `REPRODUCE.txt` and an **exact-file-set** `SHA256SUMS`.
   `verify` fails on missing, modified, unlisted, linked or special files.

**Containment:** every kit and sample path is relative, stays inside the package and contains no links. This matches the
engine, which treats the project directory as its trust root. The tests also confirm that a tampered kit path is caught.

## Frozen approvals and provenance

- [`rack/frozen.json`](rack/frozen.json) freezes the approved MUTATION 001 material: 8 engine files, 3 audition scripts,
  the nine auditions (18 WAV/MP3 files) and their manifest and SHA256SUMS. It was recorded at PR #43's head `471bb55`.
- The rack **never copies or edits** that code. [`rack/frozen.ts`](rack/frozen.ts) verifies every engine file's SHA-256 before
  loading it, and refuses to run if anything changed.
- **Re-render check:** in this session the three frozen audition scripts were re-run into a fresh directory. All 18 audition
  files came out byte-identical to the committed ones.
- Adapters only translate time, pitch, articulation, expression and curves. **Engine safety envelope:** controls are clamped
  to the range the approved macros span. Past bass `hold` 0.84 or `bright` 1, the engine's vactrol release time constant turns
  negative and the gate diverges; it measured +20 dB in an early rack render before the clamp. A test keeps that from returning.
- **What the sounds are made of:** numeric parameters and seeded PRNGs only. No recordings, samples, SoundFonts, impulse
  responses, presets or third-party audio. The context drums are the unchanged HEADLINER 001 kick and snare.
- SODIUM HOURS, the nine auditions, engine code and defaults, the Codex PCM24 branch and licensing are untouched.

## Tests

```bash
node --test --test-reporter=spec tests/studio-rack.test.ts
```

```bash
npm run typecheck
```

13 tests, about 12 s. They run in the repository's normal `npm test` and CI (Node 22.18 and 24). They check:

- the freeze record and every audition manifest's recorded generator hashes;
- the registry and macro labels, and that INSTRUMENTS.md is current;
- score validation messages;
- deterministic renders, and that seeds and macros change them;
- pitch within ±15 cents across registers and transposition;
- onsets at the engine frame for each tempo;
- articulation effects (staccato, ghost, legato, bow vs strike);
- the bass safety envelope;
- each macro moving in its documented direction:
  - bass: brighter spectrum;
  - voice: undertone appears and the 6th partial bends sharp;
  - bar: mode 2 travels from 4 f0 to 1.493 f0;
- bounce determinism, frame-exact phrase boundaries, engine `validate`, containment and tamper detection;
- kit export;
- the committed demo and example hashes.

The engine-render reproduction subtest needs FFmpeg and skips without it, as the repository's other audio tests do.

## Known limitations and things to check by listening

- **Unheard.** Nobody has listened to CROSSING or the examples yet. The crossing concept, the balance and the coda's
  machine-to-warm return need human ears.
- Calibration matches reference notes, not perceived loudness. Part gains for a new score need a listen, or a look at the
  per-stem levels in `render.json`.
- Supported scope:
  - 4/4 only in rack 1.x.
  - 14 parts per score; one engine track is the room.
  - 600 s maximum.
  - One phrase per section and part.
- Phrases are rendered audio, so editing notes means re-bouncing. Projects reference phrases, not live synthesis.
- The rack renders at roughly 1× real time for a full ensemble (CROSSING: about 45 s of compute for 54 s of audio).
- Compatibility with the HEADLINER foundation and the PCM24 work: [COMPATIBILITY.md](COMPATIBILITY.md).
