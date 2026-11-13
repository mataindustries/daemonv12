# v0.9 motif development: proof, HOOK//10 and handoff

**Status: draft for owner review.** Nothing is merged, released, tagged or published. The producer is an AI agent
and **cannot hear audio**: descriptions of the music are design intent, and every number is a signal measurement or
a count, not a quality score.

- Contract: [docs/V0_9_MOTIF_DEVELOPMENT.md](../../docs/V0_9_MOTIF_DEVELOPMENT.md)
- Composer guide: [studio-001/MOTIFS.md](../../studio-001/MOTIFS.md)
- Listening guide: [LISTENING_GUIDE.md](LISTENING_GUIDE.md)
- Masters and manifest: [`hook10/`](hook10), [`hook10/MANIFEST.json`](hook10/MANIFEST.json)

## What was built

| | |
|---|---|
| Layer | `studio-001/motif/` (about 740 lines): motifs in scale steps, 15 transforms, section-relative phrases, 6 portable gestures, symbolic report, sample-frame event map, CLI (`expand`, `render`, `bounce`) |
| Base | main @ `eee072d` (v0.8 studio integration). The approved rack, frozen engines, `src/`, MCP, `package.json` and the license are untouched |
| Scores | `studio-001/scores/hook10/` (A as score/1; B1, B2, B3 as score/2) and `studio-001/scores/examples/motif-theme.score.json` |
| Tests | `tests/v09-motif.test.ts` (19, pure) and `tests/v09-motif.integration.test.ts` (8, audio) |

## Verification (this session, Node v22.23.4, FFmpeg 6.1.1)

| Check | Result |
|---|---|
| Whole repository suite, `npm test` | 393 tests: 385 pass, 0 fail, 8 skipped. The 8 are existing tests that need FluidSynth and its SoundFont, which this environment does not have; CI should run them |
| `npm run typecheck` | clean |
| Approved rack sources vs main | all 12 files and `INSTRUMENTS.md` byte-identical (pinned in a test) |
| Committed score/1 scores vs main | CROSSING and the three examples (one also at +5 semitones, 92 BPM) give identical performance JSON hashes; the three examples also rendered to identical WAV hashes on main and on this branch |
| score/2 vs its lowered score/1 | identical rendered WAV hashes, also with `--transpose` |
| CROSSING equivalence | the theme as a motif lowers to the committed notes at beats 8–16; `transpose −2` reproduces the hand-typed `voice-2` harmony at beats 40–47.5 |
| Determinism | two separate processes built all four HOOK//10 versions to identical SHA256SUMS; a test rebuilds B1 and matches the committed files |
| Event frames | a rendered mallet, tine or clock note begins exactly on its event frame at 96, 84 and 133 BPM with swing |

## HOOK//10 masters

Every file is in [`hook10/`](hook10). 44.1 kHz stereo PCM16 WAV, 441,000 frames. One gain per version; no limiter,
compressor or EQ was added.

| Version | Integrated loudness | True peak | LRA | Seam step / largest step inside (LSB) | Structure gate |
|---|---:|---:|---:|---:|---|
| A `HOOK10-A-existing-workflow` | −16.0 LUFS | −6.1 dBTP | 0.7 LU | 445 / 3140 | not applicable (score/1) |
| B1 `HOOK10-B1-motif-development` | −16.0 LUFS | −5.6 dBTP | 1.9 LU | 194 / 3001 | pass |
| B2 `HOOK10-B2-motif-call-response` | −16.0 LUFS | −4.8 dBTP | 2.6 LU | 303 / 3505 | pass |
| B3 `HOOK10-B3-motif-mirror-broad` | −15.9 LUFS | −7.0 dBTP | 1.3 LU | 268 / 3114 | pass |

Symbolic report of the B versions:

| | Coverage | Developing transforms used | Recognizability | Longest literal bar run | Hook stated by | Dropped params |
|---|---:|---|---:|---:|---|---:|
| B1 | 0.98 | endOn, fragment, invert, rhythm, scale, sequence, transpose | 1.0 | 2 (clock) | voice, bars | 36 |
| B2 | 0.97 | endOn, fragment, invert, mode, scale, sequence, transpose | 1.0 | 2 (clock) | voice, bars | 32 |
| B3 | 1.00 | endOn, fragment, invert, ornament, scale, sequence, transpose | 1.0 | 2 (clock) | voice, bars | 32 |

The dropped params are the voice's vowels on the mallet statements of the hook, which is the intended behaviour.
A, by construction, repeats one bar three times in every part.

## Loop verification

The engine has no loop crossfade (deferred), so the loop is made in the benchmark build script
[`studio-001/scores/hook10/build.ts`](../../studio-001/scores/hook10/build.ts), without touching the rack:

1. The four bars are 16 beats at 96 BPM: 625,000 µs per beat, exactly 441,000 frames.
2. The rack renders the piece once with a 10 s tail (882,000 frames), long enough for the mallets to ring out.
3. The loop is `y[n] = x[n] + x[n + 441000]`: the tail is added onto the start. That is the steady state of the
   one-shot render retriggered every 441,000 frames. There is no crossfade, time-stretch or edit.

What was checked for each version (values in `MANIFEST.json`, re-asserted by a test from the committed WAV):

| Check | Result (all four) |
|---|---|
| Master length | 441,000 frames |
| Fold identity, max absolute error | 0 |
| Render tail fully decayed before the render ends | yes: last 0.1 s is below −190 dBFS RMS |
| What the seam adds beyond the render's own continuous signal: the render's first and last samples | 0 LSB and 0 LSB |
| Step from the last frame to the first, against every other frame-to-frame step in the file | at the 37th to 75th percentile; far below the largest step inside |
| Three-pass listening file | three exact copies of the master |
| Clipping | none |

MP3 files are for listening. MP3 adds encoder padding, so loop the WAV (the listening page does).

## What is not shown

- **That B sounds better.** No human has listened. The benchmark in the spec needs three independent runs per
  condition from fresh contexts, at least three listeners and 27 pooled forced choices. Here one agent wrote A and
  the three B candidates in one session, knowing which was which.
- **That A is the best the old workflow can do.** A is the hook tiled with `repeats` plus a written turnaround, the
  way the rack's own examples restate a theme. A composer could also type bars 2 and 3 of B1 by hand in score/1;
  the audio would be identical. The layer makes development cheap to write, visible in the file and checkable. It
  does not add a sound.
- **Originality.** The hooks were written from first principles, with no melody quoted or imitated on purpose.
  Symbolic checks cannot detect resemblance; the owner should attest per entry.

## Licensing and release blockers

| Item | State | Needed |
|---|---|---|
| Instruments used in HOOK//10 | Impossible Voice, Living Bass, mallet bar, clock: synthesised by the frozen MUTATION 001 engines from numeric parameters and seeded noise. No recordings, samples, SoundFonts or impulse responses. No General MIDI path was used | None for provenance |
| **Generated audio licence** | The rack says licensing of generated audio is pending the owner's declaration. No grant exists | **All eight HOOK//10 audio files are audition-only** until the owner records a declaration. Not cleared for commercial use |
| Code licence | No root `LICENSE`; the README says it is not chosen | Owner decision. Blocks npm publication |
| Rack not packaged | `studio-001/` is outside the npm `files` list and marked draft; the motif layer sits beside it | Accept the rack first; packaging is a separate step |
| Version drift | v0.8 is merged but the package says 0.7.0 and nothing is tagged | Declare and tag v0.8, or fold it into 0.9, before tagging v0.9 |
| v0.8 proof guard | `proofs/v08-studio-integration` pins the rack sources and `package.json`. Any later rack or package change must first retire or supersede that guard | Owner decision on when the v0.8 review closes. v0.9 avoids the question by not editing those files |
| FFmpeg | Used as an external tool (Ubuntu 6.1.1 with libmp3lame) for MP3 encoding and loudness measurement. Not bundled | Keep unbundled |
| Benchmark outputs | Kept under `proofs/`, outside the package | Keep out of the package |

## Handoff

- **Listen first.** [LISTENING_GUIDE.md](LISTENING_GUIDE.md). The decision the spec asks for is yours and your
  listeners'. If B does not clearly win on memorability and on "composed", ship this as an authoring and sync
  convenience and make no musical claim.
- **Rebuild:** `node studio-001/scores/hook10/build.ts NEW_DIR` (about 30 s, needs FFmpeg). A is regenerated from B1
  with `node studio-001/scores/hook10/compose-a.ts`.
- **Open questions for the owner**
  1. Should the layer stay beside the rack, or move into it once the v0.8 guard is retired? Moving it is mechanical.
  2. The cadence rule and the recognizability rule were tightened to be computable (see the contract's adjustment
     table). Confirm or change them before they gate anything real.
  3. Loop folding lives in the benchmark script. If it proves useful it belongs in the rack or the engine (v0.10).
- **Next, if the listening result is good:** run the spec's full protocol (fresh-context runs, blind pairs,
  delayed recall) and record the tally here.
