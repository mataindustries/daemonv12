# HOOK//30: technical QA and licensing report

**Status: draft for owner review.** Nothing is merged, released, tagged or published. The producer is an AI agent
and **cannot hear audio**: descriptions of the music are design intent, and every number is a signal measurement or
a count, not a quality score. Which candidate is better, and whether either is good, is a listening decision.

- Listening guide: [LISTENING_GUIDE.md](LISTENING_GUIDE.md)
- Scores: [`studio-001/scores/hook30/`](../../studio-001/scores/hook30) (`hook30-groove.score.json`,
  `hook30-ascension.score.json`, written by `compose.ts`)
- Build and checks: [`build.ts`](../../studio-001/scores/hook30/build.ts), [`MANIFEST.json`](MANIFEST.json),
  [`SHA256SUMS`](SHA256SUMS), [`tests/hook30.test.ts`](../../tests/hook30.test.ts)

## What is here

| | GROOVE | ASCENSION |
|---|---|---|
| Master, 44.1 kHz stereo PCM16 | `HOOK30-GROOVE.wav` | `HOOK30-ASCENSION.wav` |
| Listening copy, MP3 256 kbit/s | `HOOK30-GROOVE.mp3` | `HOOK30-ASCENSION.mp3` |
| Three-cycle preview (90 s) | `HOOK30-GROOVE-loop-x3.mp3` | `HOOK30-ASCENSION-loop-x3.mp3` |
| Score as authored (score/2) and as lowered (score/1) | `GROOVE/score.json`, `score.lowered.json` | `ASCENSION/…` |
| Expanded performance | `GROOVE/performance.json` | `ASCENSION/…` |
| Motif report and motif events (v0.9 formats) | `GROOVE/motif-report.json`, `motif-events.json` | `ASCENSION/…` |
| Musical event map for picture sync | `GROOVE/event-map.json` | `ASCENSION/event-map.json` |
| Stems, FLAC, loop-aligned | `GROOVE/stems/` (9 parts + room) | `ASCENSION/stems/` (10 parts + room) |

Base: PR #49 head `d65ef67` (v0.9 motif layer). This work adds files only. The rack, the frozen engines, the motif
layer, `src/`, MCP, `package.json`, and every HOOK//10 file are unchanged; a test pins their hashes.

## Results (this session, Node v22.23.4, FFmpeg 6.1.1)

| Requirement | GROOVE | ASCENSION |
|---|---|---|
| Exactly 1,323,000 frames at 44.1 kHz (30.000 s) | yes | yes |
| Integrated loudness, FFmpeg `ebur128` | −16.0 LUFS | −16.0 LUFS |
| Integrated loudness, independent BS.1770 meter in this repo | −15.97 LUFS | −16.04 LUFS |
| True peak, FFmpeg / independent 4× oversampling | −2.8 / −2.82 dBTP | −4.5 / −4.52 dBTP |
| Loudness range | 4.1 LU | 3.1 LU |
| Samples at full scale, in master and in every stem | 0 | 0 |
| Limiter, compressor, EQ, crossfade, time-stretch | none: one gain (−0.885 dB) | none: one gain (−1.369 dB) |
| Loop fold identity, max absolute error | 0 | 0 |
| Render tail at the end of the 10 s tail | −211.8 dBFS RMS | −196.3 dBFS RMS |
| Wrap step, last frame to first frame | 822 LSB (90th percentile of all steps in the file; largest step inside is 10,576) | 55 LSB (12th percentile; largest inside 6,873) |
| What the seam adds: the render's first and last samples | 0 and 0 LSB | 0 and 0 LSB |
| Three-cycle file is three exact copies of the master | yes | yes |
| Stems summed against the master, worst sample | 4 LSB (rounding bound 6) | 4 LSB (rounding bound 7) |
| Event-map onsets checked against the rendered audio | 126 checked, 0 wrong | 125 checked, 0 wrong |
| v0.9 structure gate | pass | pass |
| Two builds in separate processes | identical SHA256SUMS | identical SHA256SUMS |

The engine's own analyzer (`daemonv12 analyze`, FFmpeg `loudnorm`) reads −15.90 and −15.98 LUFS. The B1 master
reads −16.0 (FFmpeg) and −15.96 (independent meter), so all three files are level-matched within 0.1 LU.

### How the loop is made and measured

The method is the HOOK//10 one, reused from `studio-001/scores/hook10/build.ts` without changing it.

1. Twelve bars at 96 BPM are 48 beats of 625,000 µs: exactly 1,323,000 frames.
2. The rack renders the piece once with a 10 s tail (1,764,000 frames).
3. The loop is `y[n] = x[n] + x[n + 1323000]`: the tail is added onto the start. That is the steady state of the
   render retriggered every 30 s. No crossfade and no edit.

The seam is then checked on the delivered PCM16 samples. The step from the last frame to the first is compared with
every other frame-to-frame step in the file, and it must sit below the 99th percentile. The only thing the wrap adds
to the render's own continuous signal is the render's first and last sample, and both are digital silence.
MP3 adds encoder padding, so loop the WAV (the listening page does).

### No clipping or unintended distortion

- Master and stems are written with a clip counter; all counts are 0, and the highest master sample is −2.82 dBFS
  (GROOVE) and −4.52 dBFS (ASCENSION).
- The signal path after the instruments is a sum, a shared room send and one gain. Nothing nonlinear is added.
- Intended nonlinearity lives inside the approved engines only: the Living Bass fold and drive, and the kick's
  saturator. Their control ranges are clamped by the rack as before.

### Determinism

- `compose.ts` is pure: a test checks that the two committed score files are exactly what it writes.
- Lowering, normalisation and rendering use seeded generators only. Two separate processes built both candidates to
  byte-identical WAV, MP3, FLAC and JSON files.
- A test rebuilds both candidates and compares every file hash with the committed ones. Like the HOOK//10 rebuild
  test, it needs the FFmpeg build recorded in the manifest and skips otherwise.

### Motif transformations

The symbolic report (`motif-report.json`), computed by the unchanged v0.9 layer:

| | GROOVE | ASCENSION |
|---|---:|---:|
| Notes that come from motif phrases (non-context parts) | 97 % | 87 % (the rest is the bowed harmony) |
| Statements of the hook: literal / developed | 3 / 39 | 3 / 36 |
| Parts that state the hook | voice, second voice, bass, bars, tines | voice, second voice, bars, tines |
| Developing transform kinds used | 10: displace, endOn, fragment, invert, mode, rhythm, scale, sequence, shift, transpose | 8: endOn, fragment, invert, mode, rhythm, scale, sequence, transpose |
| Recognizability (developed statements that keep the contour or the rhythm) | 1.0 (75 of 75) | 1.0 (65 of 65) |
| Longest run of identical bars in any part | 2 (clock, kick) | 2 (clock, kick) |
| Identical bars of the whole ensemble | none | none |

Tests assert the lowered pitches and beats of the statements that carry the form: the bass singing the hook, the
canon entries, the chromatic bass line, the hook in D major, the higher answers, the stretto shared between bars and
tines, the triplets and the sixteenths. They also assert that the eight B1 motifs are byte-equal to
`hook10-b1.score.json` and that bars 1–4 of voice, bass, mallets and clock equal B1's.

### Event map (`event-map.json`, schema `daemonv12.hook30.event-map/1`)

Made for picture sync (ENM Sandbox). Every `frame` is a sample index at 44.1 kHz inside the loop.

| Section | Content |
|---|---|
| `movements`, `barGrid`, `beatGrid` | 3 movements, 12 bars (110,250 frames each), 48 beats |
| `harmony` | every chord change with its frame (18 in GROOVE, 16 in ASCENSION) |
| `cues` | named moments: the hook, the cry, the bass call or the canon entries, the silence, the breath, the return, the highest notes, eighths, triplets, sixteenths, the loop point (19 and 23) |
| `phrases` | every motif statement with its part, root motif, transform chain, first frame and end frame (132 and 107) |
| `notes` | every note of every part with frame, beat, length, MIDI pitch, pitch name and velocity (495 and 494) |

- `frame = round(swung(beat) · 0.625 · 44100)`, the expression the rack places a note with. GROOVE swings odd
  sixteenths by 0.025 beat (689 frames); the frames include it.
- A test recomputes the map and compares every note frame with the normalised performance the rack renders.
- For mallets, tines, clock, kick and snare the build also checks the audio: where a part is silent before a note,
  the rendered part is exactly zero up to the event frame and non-zero on the next frame.
- **Known offset: the spring.** It is a waveguide, so its sound leaves the delay line one period after the pluck:
  1.5 to 10.5 ms after the event frame (GROOVE), 1.5 to 3.5 ms (ASCENSION). The map reports the pluck. Voice and
  bass notes have their own attacks (scoops, cries); their frames are note starts, not loudness peaks.
- Velocities are as authored. The clock's seeded ±10 % velocity variation is in `performance.json`.

### Regression

| Check | Result |
|---|---|
| Whole repository suite, `npm test` | 405 tests: 397 pass, 0 fail, 8 skipped. The 8 are the existing tests that need FluidSynth and its SoundFont, which this environment does not have (same as PR #49) |
| `npm run typecheck` | clean |
| v0.9 motif tests and Signature Rack tests | all pass, unchanged |
| Frozen files | `studio-001/motif/*`, `studio-001/scores/hook10/*`, the v0.9 contract and guide, the HOOK//10 manifest and SHA256SUMS match PR #49's head; the B1 master is `41c8541b…`; every HOOK//10 file matches its SHA256SUMS |
| `git diff` against PR #49 | new files, plus one CHANGELOG entry |

## What is not shown

- **That either piece is good.** No human had listened when this was written. The notes in the listening guide under
  "Things I would check first" are the places where the measurements say nothing.
- **Originality.** Both pieces are built from the B1 hook, which was written from first principles in PR #49. The
  new material (bass lines, canon, progressions, drum patterns) was written the same way, with no melody quoted on
  purpose. Symbolic checks cannot detect resemblance; the owner should attest.
- **Small-speaker translation.** Not measured. The mix balance follows B1's stem levels.

## Licensing and permitted use

| Item | State | Needed before commercial use |
|---|---|---|
| Instruments | Impossible Voice, Living Bass, mallet bar, tine, bowed bar, spring, clock: the frozen MUTATION 001 engines, owner-approved after listening. Kick and snare: the HEADLINER 001 patches the rack ships as `context/kick` and `context/snare`. All are synthesised from numeric parameters and seeded noise. No recordings, samples, SoundFonts, impulse responses or third-party presets. No General MIDI path | None for provenance |
| Kick and snare in a master | The rack describes them as "context instruments (for musical-context mixes)". HOOK//30 uses them in the masters, as CROSSING does in its main mix | **Flag:** confirm that using the context drums in a deliverable master is intended |
| **Generated audio** | The rack and PR #49 state that licensing of generated audio is pending the owner's declaration. No grant exists | **All HOOK//30 audio is audition-only. Not cleared for commercial use** until the owner records a declaration |
| Composition | Derived from the HOOK//10 B1 score in this repository | Owner's declaration covers it with the audio |
| Code | No root `LICENSE`; the README says it is not chosen. New code here: `studio-001/scores/hook30/*.ts`, `tests/hook30.test.ts` | Owner decision |
| FFmpeg 6.1.1 (Ubuntu build) | External tool, not bundled: MP3 encoding (libmp3lame), FLAC encoding, loudness measurement. Its output files carry no FFmpeg licence obligation | Keep unbundled |
| npm dependencies | None added. The build uses Node built-ins and the rack | None |
| Listening page | Loads three Google Fonts families (SIL Open Font License) from Google Fonts. No other third-party asset | None |

## Handoff

- **Listen first:** [LISTENING_GUIDE.md](LISTENING_GUIDE.md).
- **Change something:** edit `studio-001/scores/hook30/compose.ts`, run it, then run `build.ts` into a new
  directory. Part gains, the kick level and the length of the silences are single numbers in that file.
- **Not started, by instruction:** a full-length song, any release or publication, any merge.
- **Open questions for the owner**
  1. Which candidate, or which parts of each? The two share bars 1–4 and 11–12 in outline, so a hybrid is cheap:
     for example GROOVE's rhythm section under ASCENSION's harmony.
  2. Is −16 LUFS still the target for a 30-second piece, or should the final master be louder?
  3. Should the loop fold and the event-map builder move from the score folders into the rack or the motif layer?
