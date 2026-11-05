# SODIUM HOURS · asset and license inventory

**License status: pending the owner's declaration. Nothing in this folder grants a license** to the
generated sounds, the rendered audio, the composition or the code. This inventory records provenance
for the owner (`mataindustries`) and counsel; it is not legal advice.

## What the final uses

All **163 sounds** in `project/assets/sodium/` were synthesized for this single by
`headliner-001/tools` from numeric parameters and seeded pseudo-random generators. Each sound's recipe,
frame count, channel count, tuning and SHA-256 is in
[`project/sodium-hours.catalog.json`](project/sodium-hours.catalog.json), with the SHA-256 of every
generator file that produced it.

| Kit | Sounds | Ch | Total s | WAV MiB | What it is |
|---|---:|:-:|---:|---:|---|
| `kick` | 3 | M | 3.6 | 0.3 | Tuned F kicks (main, boom, soft) |
| `snare` | 5 | M/S | 3.7 | 0.6 | Snare, hall snare, clap, ghost, rim |
| `hats` | 5 | M/S | 1.5 | 0.2 | Hats, open hat, shaker, lowrider hydraulics, machine tick |
| `metal` | 8 | M/S | 5.3 | 0.8 | Chord-following struck pipes, C6 anvil, toms |
| `bass` | 17 | M | 51.0 | 4.3 | Round West Coast bass, one sample per pitch |
| `grit` | 25 | M | 65.0 | 5.5 | Industrial grit bass (plucked / held), per pitch |
| `keys` | 21 | S | 75.6 | 12.7 | FM electric-piano chord voicings |
| `pad` | 11 | S | 61.6 | 10.4 | Night-strings chord voicings |
| `pluck` | 12 | M | 12.0 | 1.0 | Low-pass-gate "machine" pluck, per pitch (dry) |
| `pluck-space` | 12 | S | 58.5 | 9.8 | Wet-only hall + dotted-eighth ping-pong per pluck |
| `voice` | 11 | M | 98.2 | 8.3 | Synthetic talkbox: one continuous take per phrase (dry) |
| `voice-space` | 11 | S | 134.2 | 22.6 | Wet-only hall + ping-pong per phrase |
| `choir` | 13 | S | 104.2 | 17.5 | Choir chords and the ensemble phrases that sing the final hook |
| `atmos` | 4 | S | 67.9 | 11.4 | Rain (two seeds), sodium lamp, distant siren |
| `fx` | 5 | S | 12.9 | 2.2 | Impact, reverse swells, signal-loss glitch |
| **total** | **163** | | **755.2** | **107.5** | stored as 38 MiB of lossless FLAC |

**Not used:** no recordings, downloaded samples or loops, no SoundFonts or General MIDI (FluidSynth is
not installed here, and the repository's own BANGER LAB audit excludes FluidR3_GM), no impulse
responses, no presets, no third-party audio of any kind. None of the repository's existing packs
(Orbital Foundry, GLASSHOUSE, V12 SIGNATURE, MORPH, pulse-kit) is used, so their license states do not
affect this single. No existing song, melody or recording was quoted or analysed.

## How the sounds were made

| Family | Method (all code in `tools/dsp.ts` and `tools/instruments.ts`) |
|---|---|
| Kick | Sine body with a two-stage exponential pitch drop onto F1 (43.65 Hz), beater click from high-passed noise and short sine blips, tanh drive, 2× oversampled with a Kaiser-sinc decimator |
| Snare, clap, rim | Two tuned body modes with pitch bend, band-passed noise, snap burst, four-burst clap, eight-line FDN room; hall variant adds a 2.1 s damped FDN tail |
| Hats, shaker, hydraulics, tick | Six-square-oscillator metal cluster through band-pass/high-pass (a generic analog-cymbal technique; the oscillator frequencies are those commonly documented for classic analog cymbal circuits — numbers, not audio); band-passed noise; a down-swept pneumatic hiss with a sine piston thump |
| Metal | Modal synthesis (free-free bar and tube mode ratios), tuned per chord root |
| Bass | Sine fundamental plus a saw through a zero-delay-feedback ladder with a short filter envelope |
| Grit | Detuned saws and a sub-octave pulse through a driven 4× oversampled ladder, a sine wavefolder and an asymmetric tube stage, high-passed at 95 Hz |
| Keys | Two-operator FM electric-piano model (tine plus 14× "bark"), stereo tremolo, short strum |
| Pad | Six detuned PolyBLEP saws per note split left/right, slowly breathing state-variable low-pass, baked FDN hall |
| Machine pluck | Buchla-style complex oscillator (2:1 FM) into a sine folder and a vactrol-style low-pass gate |
| Voice and choir | Saw + pulse source through a five-formant parallel bank using textbook adult vowel-formant averages (scaled), exponential portamento, delayed vibrato, breath noise; the choir and ensemble are several such voices with independent vibrato, detune and timing. Vowels only: no words, no language, not modelled on any singer or artist |
| Space | Eight-line feedback delay network (Householder matrix, damping, modulated lines) and a damped ping-pong delay, rendered as separate wet-only sounds |
| Atmosphere, FX | Seeded droplet resonances, pink/brown noise beds, passing-car sweeps, a flickering buzz tuned to F, a sine/triangle siren tracing the hook contour, a sub-drop impact, reversed choir halls, a sample-held glitch |

Published, non-proprietary techniques used as code: PolyBLEP oscillators, Zavalishin's topology-preserving
state-variable filter and zero-delay ladder, Robert Bristow-Johnson's biquad formulas, Paul Kellet's pink
noise filter, Kaiser-windowed sinc decimation, Householder FDN reverberation.

## Composition and arrangement

Melody, harmony, rhythm and arrangement were written for this single (`tools/hook.ts`, `tools/single.ts`).
The harmonic devices (deceptive cadence, Neapolitan sixth, Picardy third, Dorian vamp) are common-practice
conventions; no existing composition is quoted.

## Rendered and derived files

| File | Origin |
|---|---|
| `delivery/sodium-hours.wav`, stems, `.render.json`, `.analysis.json`, `.mid` | Rendered by the unchanged DaemonV12 0.7.0 engine (production route; FFmpeg 6.1.1-3ubuntu5 for filters, compression and measurement) |
| `*.mp3` | FFmpeg / libmp3lame listening copies, 192 kbps (outside the engine's byte-determinism contract, though they repeated here) |
| `*.flac` | Lossless FFmpeg FLAC of engine or generator WAVs; `tools/flac.ts restore` rebuilds the exact WAV bytes and checks SHA-256 |
| `versions/*.mp3`, `sketches/*.mp3` | Listening copies of earlier versions and the three direction sketches; their sounds are regenerable from the tools in git history and are not committed as WAV |

## Authorship

Generated by an AI agent (Claude) working in this repository at the owner's request, on branch
`claude/peaceful-bardeen-f7swi8`. The owner should record whether this is treated as commissioned work
and which license, if any, applies. The engine code license is itself still an open owner decision
(see the repository README).
