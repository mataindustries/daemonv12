# SAMPLE LAB 03 · Sources, generations and provenance

Everything MUTATION plays comes from SAMPLE LAB 02's approved recordings, or from generations made from them by the
DaemonV12 engine and one bit-exact offline reverse. Nothing new was recorded, synthesized, downloaded or sampled. The
machine-readable version, with full SHA-256 hashes, is [`sources.manifest.json`](sources.manifest.json), written by
`scripts/build.ts`. This is evidence, not legal advice.

## Imported from SAMPLE LAB 02 (read only)

The build copies these byte for byte and refuses to run unless each copy matches the hash in
`experiments/sample-lab-02/sources.manifest.json`. What each one models is described in
[SAMPLE LAB 02's SOURCES.md](../sample-lab-02/SOURCES.md): physical models, not microphone recordings.

| File | In this lab | SHA-256 (first 16) |
|---|---|---|
| `sources/mug.wav` | The mug at its own pitch in TAKE | `7147553e396843d2` |
| `sources/drips.wav` | The riff and the bounce in TAKE | `93a89c43d536c312` |
| `sources/box.wav` | Kick | `557ca4a92c62e5f2` |
| `sources/book.wav` | Snare | `7f789f2cb963636e` |
| `sources/coin.wav` | The landing | `5a842253bef29202` |
| `prints/mug-quarter.wav` | LAB 02's MUG ÷4 print, played at quarter speed again in TAKE: the bass | `5cc7a2f4f483081d` |

## Generations made here

| File | Made by | From | SHA-256 (first 16) |
|---|---|---|---|
| `prints/take.wav` | The engine, `projects/take.json` (3.0 s: one bar plus a second of room) | mug-quarter, mug, drips | `bacfcd9f9446a350` |
| `derived/mirror.wav` | Offline: frames 0–88199 of `take.wav` (exactly one bar) in reverse order. Bit-exact, with no level change and no fades. Offline only because the engine has no reverse playback | take.wav | `1a208a4b9161f755` |

The loop (`projects/mutation.json`) reads `take.wav`, `mirror.wav`, `box.wav`, `book.wav` and `coin.wav`. Delivered
loop SHA-256 (first 16): `9961e8fa8f654375`.

**Drip tuning.** Each drop is retuned to its note from its *sounding* pitch. That pitch is the spectral peak 8–54 ms
after the splash, measured from the approved `drips.wav` by `scripts/mutation.ts` (`DROP_HZ`), not from the bubble's
starting pitch. The measured pitches are 1269, 1748, 1046, 1556, 1877, 1268, 1488, 2287, 1322 and 2147 Hz for the ten
ringing drops.

## Rights

As for SAMPLE LAB 02: the license is not yet declared. That is the owner's decision; CC0-1.0 is proposed. There is no
third-party material. The riff, its mutations and the drum parts were written for this lab. The influences named in
earlier briefs (The Avalanches, J Dilla, Flying Lotus) shaped only general production ideas. The owner should still run
a human resemblance check while listening.
