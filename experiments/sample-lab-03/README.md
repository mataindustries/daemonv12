# DAEMONV12 · SAMPLE LAB 03 / OBJECT ORCHESTRA: MUTATION

One eight-second loop: SAMPLE LAB 02's kitchen band, developed into four bars that mutate one recorded bar.

**Status: stopped for human listening approval.** This is one candidate, not a song. No engine, Composer or site code
was changed. SAMPLE LAB 01, SAMPLE LAB 02 and its three four-second sketches are untouched: this lab only reads LAB 02's
approved recordings and verifies their hashes.

## Listen

| Files | Length | |
|---|---|---|
| [`mutation.wav`](deliverables/mutation/mutation.wav) · [`mutation.mp3`](deliverables/mutation/mutation.mp3) · [`mutation-x4.mp3`](deliverables/mutation/mutation-x4.mp3) | 8.000 s · 120 BPM · 4 bars of 4/4 · A minor | On a phone, play the ×4 MP3: the same loop four times with no gap |

Also in `deliverables/mutation/`: five aligned stems (`stems/`), the event map (`mutation.events.json`), and the engine's
render manifest. `deliverables/CHECKS.md` has the measurements.

## The idea

No new instruments. One bar of the band is printed once (**TAKE**: the mug four octaves down, the drips and the mug at
its own pitch). Every other bar is that same record, mutated. Only the box kick, the book snare and the coin play live.

| Bar | Time | What happens |
|---|---|---|
| **1 · TAKE** | 0–2 s | The riff. Mug boom, the drips' "plink-PLINK" (E6 up to A6), a falling answer, the bass sliding D → E. Then on beat 4 **a water drop bounces**: eight hits, each interval 0.72 of the last and each hit 0.8 as loud, converging on the bar line. A water drop can't bounce; this one does. |
| **2 · MIRROR** | 2–4 s | **Time reverses at the bar line** (C's temporal inversion). The drop bounces back out of the mirror, slower and slower. The drips suck backwards, the booms swell into their own attacks, and the bar ends in a reversed bell and boom that swell into bar 3. The drums keep playing forwards on the **mirrored grid**. The kick pattern is bar 1's backwards, and every human offset flips sign, so the snare that sat late in bar 1 rushes here. |
| **3 · COPY OF A COPY** | 4–6 s | TAKE's opening cell (boom, plink, PLINK) is **chopped 3+3+3+3+2+2 and climbs A A C D E G**, bass and drips together. The last two chops squeeze the whole three-sixteenth cell into two sixteenths, so the bar accelerates as it climbs. |
| **4 · SINK → LANDING** | 6–8 s | **The floor drops.** The opening returns a major third down, in F minor, at 0.79 speed, so for a moment the band drags at about 95 BPM behind the 120 BPM drums. Then the coin is spun, and the bar-1 bounce returns a major third *up*, on **G#**: the same pitch as the Ab that F minor just left ringing in the mug's overtone. Coin and drop land together on the **A** of the next downbeat. |

**Listen for:** 0.00 boom + the coin landing from the previous loop · 0.14 / 0.25 plink-PLINK · 1.50 → 1.95 the drop
bouncing into the bar line · 2.00 → 2.50 bouncing back out · 2.47 and 3.48 the snare rushing · 3.24 → 4.00 the reversed bell
swelling into bar 3 · 4.00 / 4.38 / 4.75 / 5.13 / 5.50 / 5.76 the climbing chops · 6.00 the sink into F minor · 6.54 the
snare dragging · 6.88 the coin spun · 7.67 → 8.00 the G# bounce and the coin falling onto the A.

### Brief compliance

| Brief | How |
|---|---|
| One eight-second loop, 120 BPM, four bars | 352,800 frames; the seam is bit-exact (0 LSB difference between cycles, master and every stem) |
| Memorable melodic/rhythmic identity | The boom + "plink-PLINK" cell is heard nine times: once in bar 1, reversed in bar 2, six times climbing in bar 3, sunk in bar 4 |
| No extra instruments or layers | Five tracks (LAB 02's B had six) and the same five objects. The band only ever sounds as one printed record, forwards, mirrored or chopped, never stacked on itself |
| Recursive resampling | mug.wav → MUG ÷4 (LAB 02's print) → TAKE (quarter speed again) → chopped, transposed, slowed and mirrored in the loop: one spoon tap resampled three times in succession |
| Reversal, nonlinear chopping, rhythmic mutation | MIRROR (bit-exact offline reverse); 3+3+3+3+2+2 chops with the last two squeezed; geometric bounce timing; a mirrored drum grid; a polytempo drag |
| Physical, bouncing personality | The drop's bounce (forwards, mirrored, and transposed for the landing), the coin, the box, the book and the mug |
| C-inspired temporal inversion | Bar 2 is bar 1 mirrored about the bar line, with the drums kept forward on a mirrored grid, as C kept its foot and snap |
| Unexpected but satisfying payoff | A minor → F minor (a chromatic mediant) and back: Ab becomes G# and resolves up to A, F falls to E, C is held. Rhythmically, everything converges on the downbeat |
| Sampler and offline only, no engine changes | All chops, rates and prints are done by the engine; the only offline step is the reverse |

## How it is built

```text
SAMPLE LAB 02 (read only, SHA-256 verified): mug-quarter.wav, mug.wav, drips.wav, box.wav, book.wav, coin.wav
   │
   ├─ take.json ──engine──▶ take.wav      one bar: mug ÷4 again (bass), drips (riff + bounce), mug at pitch
   │                          ├─ offline: frames 0-88199 reversed ──▶ mirror.wav
   │                          │
   └─ mutation.json ──engine──┴─▶ take (bars 1, 3, 4) · mirror (bar 2) · box · book · coin ──▶ mutation.wav + stems
```

| Path | What |
|---|---|
| `scripts/mutation.ts` | The score: TAKE, the four bars, every rate, chop, offset and mix decision, with comments |
| `scripts/build.ts` | The pipeline: imports, TAKE, MIRROR, the loop (two cycles + a bar of tail, three-cycle seam proof), stems, event map, MP3s, checks |
| `projects/` | `take.json`, `mutation.json` and every audio file they read (`assets/sources`, `prints`, `derived`) |
| `deliverables/mutation/` | Loop WAV, MP3, ×4 MP3, `stems/01-take … 05-coin`, `mutation.events.json`, `mutation.render.json` |
| `SOURCES.md`, `sources.manifest.json` | Provenance with hashes |

The scripts reuse SAMPLE LAB 02's score helpers, hit map and coin timing by importing them; they change nothing there.

## Rebuild

From the repository root, with Node 22.18+ and FFmpeg, after `npm ci`:

```sh
node experiments/sample-lab-03/scripts/build.ts
```

It takes about 30 seconds. Two consecutive builds here (Linux, Node v22.22.0, FFmpeg 6.1.1-3ubuntu5) produced
byte-identical files, all 25 of them. Intermediate renders go to `work/`, which git ignores.

## Notes

- **The drips are now in tune, which changes them from LAB 02.** Each drop's bubble chirps upward and settles 6–22 %
  above its starting pitch. LAB 02 tuned the drops by their starting pitch, so B's drip line actually sounded 1.1 to 3.3
  semitones sharp of the written notes, by a different amount per note. Here every drop is tuned by its measured
  sounding pitch in the approved `drips.wav`. If the slightly crooked LAB 02 drips were part of what you liked, say so;
  it is a one-line change.
- **Level:** −15.1 LUFS, true peak −1.24 dBTP, a little quieter than the LAB 02 sketches. I stopped short of a mastering
  pass, as the brief asked.
- I checked this by measurement (pitch, spectra, stem loudness, junction continuity, event timing). **I cannot hear
  it.** Your ears decide.
