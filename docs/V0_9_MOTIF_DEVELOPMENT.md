# DaemonV12 v0.9: motif development layer (contract)

**Status: draft for owner review.** Nothing is released, tagged or published. `package.json` stays at 0.7.0, the
license is unchanged, and no file of the approved Signature Rack is edited. Whether music written this way sounds
better is a human listening question; see [the HOOK//10 proof](../proofs/v09-motif/README.md).

A composer writes a **motif** once, in scale steps, and places it as **phrases** with transform chains. The layer
**lowers** that `score/2` to an ordinary rack `score/1` of plain notes. The rack, the frozen engines and the DaemonV12
engine never see a motif.

```
score/2 JSON ──► studio-001/motif ──► score/1 JSON ──► rack normalizeScore ──► render / bounce   (unchanged)
  motifs[]         lowerScore            plain notes
  parts[].phrases     │
                      ├─► motif report (symbolic, deterministic)
                      └─► motif event map (sample frames for picture sync)
```

## Where it lives

| File | Role |
|---|---|
| `studio-001/motif/types.ts` | Types, `SCORE_SCHEMA_V2`, `MOTIF_INTERFACE_VERSION` (0.9.0) |
| `studio-001/motif/motif.ts` | Pure: scales, step → MIDI, the fifteen transforms, resolution, lowering |
| `studio-001/motif/gestures.ts` | Data: six gestures mapped onto each instrument's existing articulations and params |
| `studio-001/motif/report.ts` | Pure: symbolic report, event map, the HOOK//10 structure gate |
| `studio-001/motif/cli.ts` | `expand`, `render`, `bounce` |
| `studio-001/motif/index.ts` | Entry point, `normalizeAnyScore` |

`studio-001/rack/` is byte-identical to main; a test pins every file's SHA-256.

## Score format

`schema: "daemonv12.signature-rack.score/2"` is a rack score plus `motifs` and, on any part, `phrases`.

```json
{ "schema": "daemonv12.signature-rack.score/2", "title": "…", "bpm": 96, "key": "D minor",
  "sections": [ { "id": "call", "bars": 2 }, { "id": "turn", "bars": 2 } ],
  "motifs": [
    { "id": "hook", "role": "hook", "octave": 4, "notes": [
        [0, 0.75, 4, 0.72, { "params": { "vowel": "oh" } }],
        [0.75, 1.25, 9, 0.9, { "gesture": "lift" }], [2, 0.5, 8], [2.5, 0.5, 6], [3, 0.75, 7, 0.76, { "gesture": "fall" }] ] },
    { "id": "head", "from": "hook", "transforms": [ { "op": "fragment", "from": 0, "to": 2 } ] } ],
  "parts": [ { "id": "voice", "instrument": "impossible-voice", "phrases": [
      { "motif": "hook", "at": { "section": "call", "bar": 1 } },
      { "motif": "hook", "at": { "section": "call", "bar": 2 }, "transforms": [ { "op": "transpose", "steps": -2 } ] } ] } ] }
```

- **Motif note:** `[beat, beats, step, velocity?, options?]`. `beat` is relative to the motif start. `step` is a scale
  step from the key tonic in the motif's `octave` (default 4): 0 = tonic, 7 = an octave up, −1 = the seventh below.
  Options: `alt` (−1, 0, 1), `gesture`, `articulation`, `slide`, `params`. Velocity defaults to 0.8.
- **Motif:** `id`, optional `role` (`hook`, `answer`, `figure`, `bass`), `octave`, `lengthBeats` (default: end of the
  last note). Either literal `notes`, or `from` (another motif) with `transforms`. A derived motif inherits its
  source's octave and role unless it sets its own.
- **Phrase:** `motif`, `at`, optional `transforms` (after the motif's own chain), `velocity` (multiplier), `fit`,
  `id` (default `${part}.p${index}`). `at` is an absolute beat or `{ section, bar, beat? }`: `bar` is 1-based inside
  the section, `beat` is the 0-based offset inside the bar.
- **Pitch** is resolved only when a phrase is lowered:
  `midi = 12·(octave+1) + tonic + 12·floor(step/7) + SCALE[scale][mod(step,7)] + alt + semis`, with
  `major [0,2,4,5,7,9,11]`, `minor [0,2,3,5,7,8,10]`, `harmonic-minor [0,2,3,5,7,8,11]`. The scale starts as the
  key's mode. The key is the **untransposed** score key; the rack applies `transpose` afterwards, once.

## Transforms (applied in authored order to the cell; L is the cell length in beats)

| Op | Exact effect |
|---|---|
| `transpose { steps }` | `step += steps` (diatonic) |
| `shift { semitones }` | `semis += semitones` (chromatic) |
| `octave { by }` | `step += 7·by` |
| `invert { axis? }` | `step' = 2·axis − step`, `alt' = −alt`. Axis defaults to the first note's step; a half step (`5.5`) is allowed |
| `retrograde` | `beat' = L − (beat + beats)`; notes re-sorted; velocities, gestures and params stay with their notes |
| `scale { factor }` | beat, beats and L multiplied. Factors 0.25, 0.5, 0.6667 (exactly 2/3), 1.5, 2, 4 |
| `rhythm { durations }` | one duration per note; onsets cumulative from 0; `L = Σ` |
| `fragment { from, to }` | keeps notes `[from, to)` by onset order, shifted so the first starts at 0; L = end of the last kept note |
| `sequence { steps, every }` | copy *k* at `k·every` beats, transposed by `steps[k]`; `every < L` is an error; `L = every·steps.length` |
| `displace { beats }` | `beat += beats`, `L += beats` |
| `endOn { step, alt? }` | the last note by onset (ties: highest index) gets `step` and `alt` (default 0) |
| `mode { to }` | steps are re-resolved in `major`, `minor` or `harmonic-minor` |
| `ornament { at, kind }` | note `at` of duration d becomes `turn`: steps s+1, s, s−1, s, each d/4; `upper`: s (d/2), s+1 (d/4), s (d/4); `lower`: the same with s−1. Each piece must be at least 1/16 beat |
| `gesture { set, at? }` | sets the gesture on the listed note indices, or on all |
| `dynamics { from, to }` | `velocity ×= from + (to − from)·beat/L` |

Note indices always count the cell's notes in onset order at that point of the chain.

## Lowering

- Lowered note: `{ beat, beats, pitch, velocity, articulation?, slide?, ...params }`; beats and velocities rounded
  to 1e-6; velocity clamped to 0..1. Phrase notes are appended after the part's authored `notes`, in phrase order.
- **Gestures** (`accent`, `soft`, `short`, `legato`, `lift`, `fall`) come from the instrument's table in
  [`gestures.ts`](../studio-001/motif/gestures.ts) (listed in [MOTIFS.md](../studio-001/MOTIFS.md)): an articulation,
  params, a velocity multiplier, a length multiplier. An explicit articulation or param on the note wins.
- **Foreign values:** a motif-note param or explicit articulation the target instrument does not have is dropped and
  reported as a warning, so a sung motif can be handed to the mallets. `droppedParams` counts them.
- **Range:** `fit: "error"` (default) fails with the rack's "outside range … (transpose the part or the score)"
  message. `fit: "octave"` moves the whole phrase by the fewest octaves that fit (down first on a tie).
- **Limits:** 64 motifs; 64 notes per literal motif; 256 notes per expanded cell; 16 transforms per chain; `from`
  depth 8; cycles rejected with the cycle path; 512 phrases per part; 16 copies per sequence. The rack's own limits
  apply after lowering.
- **Errors** throw in the rack's `score is invalid (n problems)` form, each `path: problem (fix)`.
  `LoweredScore.problems` holds warnings only.

## Report (`motifReport`)

Symbolic, from the lowered score; no audio. `coverage` (share of onsets in non-context parts that come from phrases),
`statements` per literal motif (`literal`, `varied`, `parts`), `transformKinds` and `developingKinds` (everything but
`octave`, `gesture`, `dynamics`), `crossPart`, `recognizability`, `maxLiteralRun` per part, `cadence`,
`droppedParams`.

- A statement is **literal** when its chain has no developing op.
- A varied statement is **recognizable** when every `sequence` copy of it, with ornaments folded into their principal
  note, matches a contiguous window of the root motif's Parsons contour **or** of its onset/duration pattern (at the
  same speed or uniformly augmented or diminished). A copy of one note never matches.
- `maxLiteralRun`: the longest run of consecutive identical one-bar windows; empty bars break a run.
- `cadence`: the last note of the highest part (mean pitch) among parts that state a `hook` or `answer` motif, as a
  scale step of the key (`null` if chromatic).

`hook10Gate(report)` is the structure gate of the benchmark: coverage ≥ 0.6, at least 3 developing kinds,
recognizability 1.0, `maxLiteralRun ≤ 2` in every part, `crossPart ≥ 1`, cadence step 0, 2 or 4. It shows a piece was
built like composed music. It does not show the piece is good.

## Event map (`motifEvents`)

```json
{ "schema": "daemonv12.motif-events/1", "sampleRate": 44100, "bpm": 96, "swing": 0.5, "endBeat": 16, "endFrame": 441000,
  "events": [ { "id": "voice.hook", "kind": "phrase", "part": "voice", "motif": "hook", "root": "hook", "role": "hook",
                "chain": [], "literal": true, "beat": 0, "frame": 0, "lengthBeats": 4, "endFrame": 110250 },
              { "id": "voice.hook.n1", "kind": "note", "part": "voice", "phrase": "voice.hook",
                "beat": 0.75, "frame": 20672, "beats": 1.25, "pitch": 77, "velocity": 0.9 } ] }
```

`frame = round(swung(beat) · beatSeconds · 44100)`, the expression the rack's one-shot instruments place a note
with. A test renders notes and checks the waveform begins at that frame. `beat` is the notated beat; a phrase's beat
and frame are its first note's. A part's `humanize.timingMs` moves the audio and not these frames. Project frames to
picture FPS with the MORPH sync library (`daemonv12/sync`).

## Commands

```bash
node studio-001/motif/cli.ts expand studio-001/scores/hook10/hook10-b1.score.json --out work/b1.score.json --report work/b1.report.json --events work/b1.events.json
```

```bash
node studio-001/motif/cli.ts render studio-001/scores/examples/motif-theme.score.json work/motif-theme
```

```bash
node studio-001/motif/cli.ts bounce studio-001/scores/examples/motif-theme.score.json work/motif-theme-package
```

`render` and `bounce` write exactly what the rack writes for the lowered score (its `score.json` is the `score/1`, so
the rack alone reproduces the output) plus `motif/score.json`, `motif/report.json` and `motif/events.json`. A
`score/1` file passes straight through. Commands refuse to overwrite.

## Adjustments to the design spec

The spec is the authority. Each change below is the smallest one the existing code required.

| Spec | What was done | Why |
|---|---|---|
| Edit `studio-001/rack/{types,score,instruments,cli,docs}.ts`; bump the rack interface to 1.1.0; regenerate `INSTRUMENTS.md` | The layer lives in `studio-001/motif/` and wraps the rack. No rack file changes. `normalizeAnyScore` replaces the hook inside `normalizeScore`; the motif CLI replaces `/2` support in the rack CLI; gesture tables are in `motif/gestures.ts` and `MOTIFS.md` | `proofs/v08-studio-integration/inputs.json` pins every rack source, `INSTRUMENTS.md`, `studio-001/README.md` and `package.json` by hash, and `tests/studio-rack.test.ts` requires the committed CROSSING demo to have been built by exactly the current rack sources. Editing the rack fails both. |
| Add `"test:v09"` to `package.json` | Not added. `npm test` already runs `tests/v09*.test.ts`; `node --test "tests/v09*.test.ts"` runs them alone | `package.json` is pinned by the same proof |
| A "Motifs" section in the composer skill | Written as [studio-001/MOTIFS.md](../studio-001/MOTIFS.md), not into the plugin | The Composer package validator rejects diffs that touch files outside the plugin, and the reverse mixes two review scopes |
| Branch `feat/v09-motif-development` | `claude/gifted-wozniak-qk1bvh` | The session could push to that branch only |
| `lowerScore(input)` | `lowerScore(input, { transpose? })` | Range checks and `fit: "octave"` must see the CLI `--transpose` |
| `problems: string[]` | Errors throw; `problems` holds warnings. `LoweredScore` also carries `phrases` and `droppedParams` | Matches how the rack reports invalid scores; the report and event map need per-phrase data |
| `alt?: -1 \| 1` | `-1 \| 0 \| 1` | Lets generated scores write "no alteration" |
| `at.beat` unspecified | 0-based offset inside the bar | Every other beat value in a score is a 0-based offset |
| `octave` op semantics unspecified | Seven steps; counted with `gesture` and `dynamics` as not developing | An octave move keeps pitch classes and rhythm |
| `invert.axis` | Half steps allowed | Needed to mirror a motif onto a chosen ending note |
| Foreign params dropped | Foreign explicit articulations too | The stated purpose is handing a sung motif to an orchestra |
| "Params on a phrase-level override are validated strictly" | Nothing to do | `PhraseInput` has no params field |
| Recognizability over whole statements | Per sequence copy, windows, ornaments folded, speed-invariant rhythm | Otherwise the spec's own T8 (fragment + sequence) and any ornament could never pass the gate |
| Cadence of "the highest-pitched part" | Highest among parts stating a `hook` or `answer` motif | The literal reading picks the clock |
| Frames by `swung → tick → tickFrame` | `round(swung(beat)·beatSeconds·44100)` | That is what the rack's instruments compute. The tick path differs by up to one frame off the 960-PPQ grid, and S8 requires agreement with the render |
| Event fields | Added `root`, `role`, `literal`, `lengthBeats`, `endFrame`, and per note `part`, `phrase`, `beats`, `pitch`, `velocity`; top-level `title`, `endBeat`, `endFrame` | Picture tools need them; additive |
| "Freeze test 31/31" | The rack suite has 13 tests; all pass | Count in the spec was off |

## Tests

```bash
node --test "tests/v09*.test.ts"
```

27 tests, about 25 s. `tests/v09-motif.test.ts` is pure: the spec's T1–T10 fixtures, the CROSSING equivalences R1–R2,
exact error messages, limits, gesture tables against the live registry, report values computed by hand, event frames,
two-process determinism, and the HOOK//10 scores. `tests/v09-motif.integration.test.ts` checks that no rack file
differs from main, that committed `score/1` scores normalise to main's performances, that a `score/2` renders the
same bytes as its lowered score, that a rendered note begins on its event frame, and the committed HOOK//10 masters.

## Not in v0.9

New DSP or instruments, engine (`src/`) or MCP changes, a chord or harmony engine, generative motif invention, audio
quality scoring, loop crossfades in the engine, package, version or license changes.
