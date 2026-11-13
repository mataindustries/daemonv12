# Writing with motifs (score/2)

A guide for composers and composing agents. The normative contract is
[docs/V0_9_MOTIF_DEVELOPMENT.md](../docs/V0_9_MOTIF_DEVELOPMENT.md). Draft for owner review; the rack itself is unchanged.

**The idea.** Write the hook once, in scale steps. Everything else in the piece is that hook again, changed: lower,
shorter, upside down, slower, on another instrument. The file then says how the piece is built, and a report can
check it.

## Smallest working example

```json
{ "schema": "daemonv12.signature-rack.score/2", "title": "Two bars", "bpm": 96, "key": "D minor",
  "sections": [ { "id": "a", "bars": 2 } ],
  "motifs": [ { "id": "hook", "role": "hook", "notes": [ [0, 0.75, 4], [0.75, 1.25, 9, 0.9, { "gesture": "lift" }], [2, 0.5, 8], [2.5, 0.5, 6], [3, 0.75, 7] ] } ],
  "parts": [ { "id": "voice", "instrument": "impossible-voice", "phrases": [
    { "motif": "hook", "at": { "section": "a", "bar": 1 } },
    { "motif": "hook", "at": { "section": "a", "bar": 2 }, "transforms": [ { "op": "transpose", "steps": -2 } ] } ] } ] }
```

```bash
node studio-001/motif/cli.ts render my.score.json work/my-piece
```

Steps count from the tonic of the key in the motif's `octave` (default 4): in D minor, 0 = D4, 4 = A4, 7 = D5,
9 = F5, −1 = C4. Transposing by steps stays in the key, so a hook moved down two steps over a B♭ bass lands on that
chord's tones.

## A working method

1. **Hook first.** One bar or less. Give it a rhythm you can tap on one pitch and one interval that stands out.
2. **Plan the bass.** Decide the chord of each bar, then choose transpositions that put the hook on chord tones.
3. **State, answer, develop, close.** A reliable four-bar shape:
   - bar 1: the hook;
   - bar 2: `transpose` it (a third lower is the classic answer), or `invert` it;
   - bar 3: `fragment` its most recognisable two or three notes and `sequence` them upward; shorten with `scale 0.5`
     or `rhythm` to raise the pressure, or lengthen with `scale 2` to broaden;
   - bar 4: `invert` or `endOn` to land the last note, then lead back to bar 1.
4. **Hand it around.** Place the same motif on a second instrument (`octave`, then a fragment). Use gestures, which
   every instrument understands, instead of one instrument's articulation names.
5. **Read the report.** `node studio-001/motif/cli.ts expand SCORE --report NEW_FILE`. Look at `recognizability`
   (below 1 means a variation kept neither the contour nor the rhythm), `maxLiteralRun` (3 or more is a loop) and
   `cadence`.
6. **Listen, or ask someone to.** The report checks structure. It cannot hear.

## Transforms at a glance

| To do this | Use |
|---|---|
| Same shape on another chord | `transpose { steps }` |
| Same shape, another register | `octave { by }` |
| Mirror image | `invert { axis }` (the axis may be a half step, e.g. 5.5) |
| Twice as fast, twice as slow | `scale { factor: 0.5 }`, `scale { factor: 2 }` |
| Keep the pitches, new rhythm | `rhythm { durations }` |
| A piece of it | `fragment { from, to }` |
| Climb or fall with it | `sequence { steps: [0, 1, 2], every }` |
| Start it later | `displace { beats }` |
| Change the last note (answer, cadence, leading tone) | `endOn { step, alt }` |
| Minor to major, or the raised seventh | `mode { to }` |
| Decorate a long note | `ornament { at, kind: "turn" \| "upper" \| "lower" }` |
| Change how it is played | `gesture { set, at }` |
| Crescendo, diminuendo | `dynamics { from, to }` |
| Chromatic move | `shift { semitones }` |
| Backwards (hard to recognise by ear) | `retrograde` |

## Gestures

A gesture on a motif note becomes each instrument's own articulation when the phrase is lowered.

| Gesture | living-bass | impossible-voice | bar | bow | spring | tine | clock, bearings, context |
|---|---|---|---|---|---|---|---|
| `accent` | `accent` | `sung`, velocity ×1.12 | `hard` | `bite` | `twang` | `buzz` | velocity ×1.15 |
| `soft` | `ghost` | `hum`, velocity ×0.7 | `soft` | `swell`, velocity ×0.7 | `pluck`, velocity ×0.7 | `clean`, velocity ×0.7 | velocity ×0.7 |
| `short` | `staccato` | `detached` | `muted` | `bite`, length ×0.5 | `damped` | `clean`, length ×0.5 | length ×0.5 |
| `legato` | `legato` | `legato` | `ring` | `swell` | | | |
| `lift` | `normal`, scoop 2 | `sung`, cry 1 | `strike`, hardness 0.7 | `swell` | `twang` | | |
| `fall` | `normal`, dive 2 | `fall`, fall 0.8 | `ring`, damp 1.2 | `swell` | | | |

An empty cell leaves the note as written. Instrument values such as a vowel go in `params`; an instrument that does
not have them drops them with a warning.

## Things that go wrong

- **Out of range.** A phrase fails with the instrument's range. Add `"fit": "octave"`, or `octave` it yourself.
- **Long rings.** Mallet bars ring for seconds. A ringing note from one chord blurs the next; use `short`, or
  `damp` in `params`.
- **Sequence overlap.** `every` must be at least the cell length. Fragment or `scale` the cell first.
- **Loud glass.** The voice's glass halo resonates on the key's chord tones and grows with the macro. A held tonic at
  a high macro can jump several dB; lower `setup.haloGain` and check the stem levels.
- **Loops.** The engine has no loop crossfade. For a seamless loop see how
  [`scores/hook10/build.ts`](scores/hook10/build.ts) folds the render's tail onto its start.

## For the composer skill

Proposed text for a "Motifs" section, to be added in a Composer-only change:

> **Motifs (Signature Rack, score/2).** When the palette is the Signature Rack, write the chosen hook as a motif and
> build the piece from phrases of it. Aim for at least three different developing transforms, a statement on a second
> instrument, and no bar repeated more than once in a row. Run `expand --report` and fix any statement the report
> lists as unrecognizable before rendering. Treat the report as a structure check only. Offer the render to a human
> listener and record what they said; do not claim the piece is memorable without one.
