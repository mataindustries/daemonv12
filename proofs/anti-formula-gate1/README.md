# Anti-Formula Gate 1: proof and handoff

**Status: draft for owner review.** Nothing is merged, released, tagged or published. The composing agent
**cannot hear audio**. Every description of the music below is design intent, and every number is a count or a
signal measurement. None of it says C is better. That is the producer's call, and all three versions may be rejected.

- Contract and reconciliation with v0.9: [docs/ANTI_FORMULA_GATE1.md](../../docs/ANTI_FORMULA_GATE1.md)
- Producer checklist: [PRODUCER_CHECKLIST.md](PRODUCER_CHECKLIST.md)
- Ledger of the one decision: [hook10/C/ledger.json](hook10/C/ledger.json)
- Manifest: [hook10/MANIFEST.json](hook10/MANIFEST.json)

## Listen

**Android:** open <https://claude.ai/artifact/NqkTnsuBTMzkzvDGT2Hy9e> (private to the owner until shared). Tap X, Y
or Z. Each loops without a gap, switching keeps the place in the bar, and names stay hidden until you reveal them.
The page has a short answer sheet with a "Copy my answers" button. Its source is kept in [listening-page.html](listening-page.html); it plays the three WAV masters below.

| | File | What it is |
|---|---|---|
| A | [`HOOK10-A-existing-workflow.wav`](../v09-motif/hook10/HOOK10-A-existing-workflow.wav) ([mp3 ×3](../v09-motif/hook10/HOOK10-A-existing-workflow-loop-x3.mp3)) | Baseline. The committed v0.9 file, unchanged. The hook three times, then the turnaround. |
| B1 | [`HOOK10-B1-motif-development.wav`](../v09-motif/hook10/HOOK10-B1-motif-development.wav) ([mp3 ×3](../v09-motif/hook10/HOOK10-B1-motif-development-loop-x3.mp3)) | Motif development. The committed v0.9 file, unchanged. Bars 2 and 3 develop the hook. |
| C | [`HOOK10-C-anti-formula.wav`](hook10/HOOK10-C-anti-formula.wav) ([mp3 ×3](hook10/HOOK10-C-anti-formula-loop-x3.mp3)) | Anti-Formula. A with one decision: in bar 3 the voice sings the cry and withholds the descent. |

All three: D minor, 96 BPM, four bars, 441,000 frames (10.000 s), the same four instruments, room, macros,
expression curves and seed, one gain to −16 LUFS, no limiter, compressor or EQ. Loop the WAV; the MP3 has encoder
padding.

## The decision in C

| §11.5 question | Answer |
|---|---|
| What distinctive material was protected? | The hook's head, the cry: A4 leaping a minor sixth to an early, held F5. It is in bar 3 exactly as in bars 1 and 2. The bass riff, the clock and the mallets (the pocket) are protected as whole parts, and so are the first two statements and the cadence. Macros, expression, room and seed are not touched. |
| What expectation was established? | Bars 1 and 2: the voice sings the whole hook twice, so the cry is answered each time by the descent E5 C5 D5, landing on the tonic on beat 4. The memory marks the expectation established at beat 8, after two whole statements. |
| What was deliberately changed? | Bar 3, beats 3 and 4: the voice sings the cry and stops. The three notes of the descent are removed with the v0.9 `fragment` transform. Nothing is added. For two beats the voice rests over the unchanged pocket; the mallet echo is the only statement of the hook there. |
| Where is it resolved? | Bar 4, beat 1 (7.5 s, frame 330,750): the unchanged cadence begins on D5, the tonic the voice withheld. In A that D5 comes a quarter beat after the voice has just sung the same D5. In C it is the first tonic the voice sings since bar 2. The payoff is not louder, thicker or changed in any note. |
| Which v0.9 components were reused? | `lowerScore` and its phrase records (motif, root, chain, notes, recognisability flags), `expandMotif`/`cellPitches`, the `fragment` transform (and `endOn` for reframes), `transformLabel`, `onsetFrame`, `motifReport`, and the unchanged HOOK//10 build (render, tail fold, loudness gain). No transform, report or renderer was written. |
| Can the ledger trace the intervention to an intention? | Yes. [`C/ledger.json`](hook10/C/ledger.json) holds the composer's sentences (essence, expectation, intent, reason, payoff intent) verbatim, the transform and what it touches, the notes kept and removed, the timeline `stated, stated, established, withheld, resolved`, and the list of everything checked as unchanged. |
| Are the baseline and frozen outputs intact? | Yes. See the next two tables. |
| What did the producer actually hear? | **Not yet answered. Nobody has listened.** |

Why this decision and not a variation: A states the hook a third time and teaches nothing new; B1 answers that by
adding (a second head, faster mallets, a doubled clock). C tests the other direction named in §11.2: take away the
one thing the listener can already sing, keep the groove and every sound, and let an unchanged cadence mean more.
It is the composing agent's hypothesis. It may read as a mistake or as nothing at all.

## Symbolic evidence (tested in `tests/anti-formula.test.ts`)

| Claim | Evidence |
|---|---|
| The Anti-Formula source is condition A | `hook10-literal.score.json` (A written as score/2 phrases) lowers to the committed A performance, note for note, including the clock's seeded humanisation |
| C is A with one decision | C's performance equals A's in every part except the voice; the voice is A's minus the three notes the ledger names (E5 at beat 10, C5 at 10.5, D5 at 11); every curve, gain, setting and breath is A's |
| Note counts | 111 in the source, 108 in C: 3 removed, 0 added, 0 altered |
| The expectation was real | The voice states the hook whole at beats 0 and 4; the layer refuses an intervention before two whole statements, or on a first statement |
| The payoff is real and in time | The cadence sounds D5 (same octave as the withheld landing) at beat 12, 2 beats after the tail was expected; the plan allows 2 |
| The motif is still recognisable | The v0.9 motif report gives C recognisability 1.0 |
| What the memory says about each version | A: `stated stated established confirmed departed`. B1: `stated stated established departed departed`, with no recorded intention. C: `stated stated established withheld resolved`. Descriptions, not ratings. |
| Deterministic | The committed C score and ledger are byte-identical to what a fresh process produces from the committed source and plan |

## Audio evidence (tested in `tests/anti-formula.integration.test.ts`)

| | A | B1 | C |
|---|---:|---:|---:|
| Integrated loudness | −16.0 LUFS | −16.0 LUFS | −15.9 LUFS |
| True peak | −6.1 dBTP | −5.6 dBTP | −5.4 dBTP |
| Loudness range | 0.7 LU | 1.9 LU | 0.9 LU |
| Length | 441,000 frames | 441,000 frames | 441,000 frames |
| Loop seam, fold, tail decay, clipping | pass (v0.9 proof) | pass (v0.9 proof) | pass |

| Check | Result |
|---|---|
| A and B1 rebuilt on the same path when C was rendered | Every file byte-identical to the committed v0.9 proof (5 and 8 files) |
| The source transcription rendered | Same master SHA-256 as A |
| C's stems against A's, sample by sample | Bass, mallets and clock identical. Voice identical up to frame 275,625, which is beat 10.000, the first withheld note |
| The gap | The voice stem falls from −18 dBFS to −32 dBFS within half a beat and stays at or below −41 dBFS from beat 10.5 until bar 4 (A: −19 to −24 dBFS over the same stretch) |
| The cadence | Same notes, sung within 1.2 dB of A's level in every quarter beat. **Not sample-identical:** the voice engine carries its phase and noise state on from what it sang before. Whether that is audible is for the listener |
| Rebuilding C | Reproduces the committed master and every listed file, byte for byte |
| v0.9 structure gate on C | Fails one check, "no bar repeated more than once in a row in any part", because C keeps A's repeating pocket on purpose. Recorded in the manifest. It is not a listening result |

## How C was made, and the cherry-picking rule

1. The layer, the source, the plan, the C score and the ledger were committed and pushed **before any audio of C
   existed** (commit `f0bb995`).
2. One plan was written. One C was rendered. No alternative C was composed, rendered, auditioned or discarded.
3. The build was run a second time only to add the stem comparison to the manifest; its audio and every listed
   file were byte-identical to the first run (same `SHA256SUMS`).

## Reproduce

```bash
node studio-001/anti-formula/cli.ts apply studio-001/anti-formula/hook10/hook10-literal.score.json studio-001/anti-formula/hook10/hook10-c.plan.json --out work/c.score.json --ledger work/c.ledger.json
```

```bash
node studio-001/anti-formula/hook10/build.ts work/gate1-hook10
```

```bash
node --test tests/anti-formula.test.ts tests/anti-formula.integration.test.ts
```

The build needs FFmpeg with libmp3lame (6.1.1 here) and about 30 s of CPU. It refuses to write into an existing
directory and fails if the rebuilt A or B1 differ from the committed v0.9 proof.

## Verification (this session, Node v22.23.4, FFmpeg 6.1.1)

| Check | Result |
|---|---|
| Whole repository suite, `npm test` | 410 tests: 402 pass, 0 fail, 8 skipped. The 8 are the existing FluidSynth and SoundFont tests this environment cannot run, the same 8 as before |
| `npm run typecheck` | clean |
| Anti-Formula tests | 13 pure, 4 audio, all pass |
| Motif layer and rack sources | Unedited; both sets of file hashes are pinned in tests |
| `git diff` against the starting branch | Adds `studio-001/anti-formula/`, two test files, two documents under `docs/`, and this directory. Changes nothing else |

## What is not shown

- **That C sounds better than A or B1, or sounds good at all.** No human has listened.
- **That the idea generalises.** One motif, one piece, one kind of expectation, ten seconds.
- **A blind benchmark.** One listener who also directed the work is a producer's verdict, which is what this gate
  asks for. It is not the multi-listener protocol of the architecture document (§5.3).
- **Independence.** One agent wrote the plan knowing A and B1.
- **Licensing.** The audio licence state is unchanged from the v0.9 proof: every file here is audition-only until
  the owner records a declaration.
