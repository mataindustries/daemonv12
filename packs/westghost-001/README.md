# WEST//GHOST 001

Four experimental offline performance instruments for DaemonV12 v0.7. Pitch,
held duration, musical slides and control curves are synthesized before a
portable sample project is written. The instruments are functions with bounded
performance inputs; the rendered WAVs are replay artifacts, not a fixed catalog
of one-shots offered as new instruments.

This independent pack changes no engine or Composer default and needs no
FluidSynth, SoundFont, external sample, preset or recorded voice. Original
synthesis does not itself establish commercial clearance: licensing awaits the
owner's declaration in [PROVENANCE.md](PROVENANCE.md).

| Instrument | Native range | Articulations | Performance identity |
| --- | --- | --- | --- |
| GRAVITY | C1–C4, MIDI 24–60 | sustain, impact | Shared-phase clean sub and pressure-driven upper harmonics; integrated pitch curves produce slides without restarting phase. |
| VANDAL | E1–E4, MIDI 28–64 | sustain, bite | FM, waveshaping, a moving filter and rhythmic motion, generated at twice the output rate before filtered decimation. |
| APPARITION | C3–C6, MIDI 48–84 | sustain, whisper | Harmonic spectral vowels, seeded breath, pressure and delayed vibrato. No identifiable voice is modeled. |
| IRON//BLOOM | C2–C6, MIDI 36–84 | strike, bow | Tuned body and inharmonic spring/metal modes, contact noise and moving excitation. Bow articulation stays active while held. |

Eight reference performances in `assets/westghost001/` expose two articulations
per instrument. Their exact controls and hashes are in
[`westghost001.catalog.json`](westghost001.catalog.json). Performances in the
audition subdirectories are generated from the saved scores; their count is not
the number of instruments.

## Auditions

| MP3 / WAV beside it | Duration | Purpose |
| --- | ---: | --- |
| [A · GRAVITY + VANDAL](audio/a-gravity-vandal.mp3) | 32 s | Syncopated bass exchange, harmonic bite, filter motion and a long phase-continuous closing slide. |
| [B · APPARITION](audio/b-apparition.mp3) | 24 s | Vowel trajectories, expressive held melody, breath attacks and whisper answers. |
| [C · IRON//BLOOM](audio/c-iron-bloom.mp3) | 24 s | Interlocking mechanical strikes, resonating pitched responses and sustained bowed blooms. |
| [Dry GRAVITY](audio/dry-gravity.mp3) | 16 s | Four native pitches, alternating articulation and harmonic/slide controls. |
| [Dry VANDAL](audio/dry-vandal.mp3) | 16 s | Four native pitches, sustained spectral and rhythmic movement. |
| [Dry APPARITION](audio/dry-apparition.mp3) | 16 s | Four native pitches, vowel, pressure and whisper changes. |
| [Dry IRON//BLOOM](audio/dry-iron-bloom.mp3) | 16 s | Four native pitches, hardness, contact and strike/bow contrast. |

These are instrument studies. No human listening judgment or finished-release
quality claim has been made. Measurements, checks and limitations are in
[REPORT.md](REPORT.md) and `westghost001.verification.json`.

## Compose a native performance

Save a performance score such as:

```json
{
  "id": "my-gravity", "title": "Sliding sub", "description": "Original instrument study",
  "bpm": 120, "bars": 2,
  "tracks": [{ "id": "sub", "gainDb": -6, "events": [{
    "step": 0,
    "performance": {
      "instrument": "gravity", "note": 26, "gate": 3, "release": 0.4,
      "velocity": 0.85, "articulation": "sustain",
      "pitch": [{"time": 0, "value": 26}, {"time": 1, "value": 26}, {"time": 1.4, "value": 33}],
      "timbre": [{"time": 0, "value": 0.1}, {"time": 2.7, "value": 0.85}]
    }
  }] }]
}
```

```sh
node scripts/generate-westghost.ts --score my-score.json --out-dir work/my-performance
node bin/daemonv12.js validate work/my-performance/my-gravity.json --json
node bin/daemonv12.js render work/my-performance/my-gravity.json --stems --format wav,mp3 --out-dir work/my-performance/audio
```

`step` is a zero-based sixteenth-note index. Each control time is output seconds
relative to that event. `note` and `pitch` curve values are absolute MIDI pitch;
fractional pitches are accepted within the instrument's range. Curve values
interpolate linearly; before the first point the instrument uses its default.
Each independently triggered note starts its oscillator phase at zero. Put a
legato pitch movement inside one event to retain phase through that movement.

All four instruments support `pitch`, `expression` and `timbre` curves.
VANDAL, APPARITION and IRON//BLOOM also use `motion`; APPARITION alone uses
`breath`. Seeds affect APPARITION breath and IRON//BLOOM contact noise.
Expression, timbre, motion and breath use 0–1 values. APPARITION timbre follows
ah → eh → ee → oh → oo at 0, 0.25, 0.5, 0.75 and 1. No per-note peak
normalization erases authored velocity or expression.

Gate is 0.02–30 seconds, release 0.01–5 seconds, velocity `(0,1]`, and each
curve has at most 128 strictly increasing points. Scores allow 1–64 bars at
40–240 BPM, up to 15 tracks, 512 events and 128 distinct performances per track,
and at most 600 seconds of unique synthesized source audio in one job.
Complete-score validation runs before writing assets. Gate plus release must
fit the engine's exact rounded output boundary. Use a new output directory for
revisions so earlier performances stay available for comparison.

The compiler writes native-pitch PCM16 mono assets, contained drum kits and a
normal formatVersion 1 v0.7 project. Kit pitches select the generated source;
they do not retune it. Editing a source performance requires compiling it again.
Avoid repitching a reference asset when independent duration or fixed vowel
centers matter: v0.7 playback rate still couples pitch and duration.

## Reproduce and verify

From the repository root with Node 22.18+ and FFmpeg:

```sh
node scripts/generate-westghost.ts work/westghost-fresh
node --test tests/westghost.test.ts
npm run typecheck
node scripts/verify-westghost.ts --deliver
```

The verifier regenerates sources independently, compares their bytes, validates
the seven projects, compares two complete WAV/stem/analysis/manifest renders,
checks headroom, true peak, exact length and mono fold-down, and writes the
verification report. MP3s are listening copies. Saved complete renders are
reused only after checking project, source and artifact hashes. Interrupted
work remains in `work/westghost-verification/`; a partial render requires
inspection before rerunning into its directory. No successful audio is deleted.

All sources are mono; stereo context comes from track balance. This gives a
controlled low end but does not provide decorrelated stereo instrument voices.
Portable source export is PCM16; Float64 synthesis is not a claim that these
assets preserve 24-bit source detail. Realtime synthesis, sustain loops,
cross-note oscillator continuity and calibrated physical-object simulation
remain outside this prototype.
