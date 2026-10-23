# STILL HERE V3 — the experimental tempo map (120 → 150 BPM)

**The ask:**

- 0–4 s at **120 BPM**: two bars of 4/4.
- 4–12 s at **150 BPM**: five bars of 4/4.
- Ignition exactly at **4.000 s**: audio frame 176,400, picture frame 240.

**The engine's limit:** DaemonV12 0.7 has **one tempo per project**.

- **Not changed:** this work adds no tempo automation to the engine, and nothing here claims
  the engine supports it.
- **Untouched:** `src/`, `bin/` and `dist/` are unchanged.

**What exists instead:** a score-local tempo map, [`src/tempo-map.mjs`](src/tempo-map.mjs).
It is translated, with no timing loss, into an *ordinary* fixed-tempo DaemonV12 project. The
unmodified engine then renders that project.

## How it works

1. **Positions.** The scores write every event as an absolute sixteenth: every bar has 16,
   whatever its tempo, and quarter-sixteenths are allowed.
2. **Exact times.** The map gives each position an exact time in **integer microseconds**:
   - 125,000 µs per sixteenth at 120 BPM;
   - 100,000 µs per sixteenth at 150 BPM.
3. **The carrier project.** The project runs at a fixed **150 BPM in 2/4**: 400,000 µs per
   quarter, 960 ticks per quarter. Both tempos' sixteenths are whole numbers of ticks on
   this grid:

   | | 120 BPM section (bars 1–2) | 150 BPM section (bars 3–7) |
   |---|---:|---:|
   | One sixteenth | 125,000 µs = **300 ticks** | 100,000 µs = **240 ticks** |
   | One 64th (finest authored step) | 75 ticks | 60 ticks |
   | One sixteenth as a v0.7 gate (whole-note fraction) | `5/64` | `1/16` |
   | One 4/4 bar | 2.0 s = 4,800 ticks = 2½ engine bars | 1.6 s = 3,840 ticks = 2 engine bars |

4. **Why 2/4.** The 120 BPM part lasts 4.0 s, which is 10 carrier quarters, or 5 bars of
   2/4. This has two consequences:
   - ignition is the engine's barline `6:1`;
   - every 150 BPM bar is exactly two engine bars.

   In 4/4, ignition would fall in the middle of engine bar 3.
5. **Frames.** The engine's own `ticksToFrames` and the exact time round the same way: to the
   nearest frame, ties later.

   ```
   engine frame = floor((tick × 400,000 × 44,100 + 480,000,000) / 960,000,000)
   exact frame  = floor((µs × 44,100 + 500,000) / 1,000,000),  with tick = µs × 960 / 400,000
   ```

   These are the same rational number, so every integer tick gives the exact frame. The code
   does not assume this; it checks it twice:
   - **At authoring:** `tempo-map.mjs` refuses any position whose tick is not an integer or
     whose engine frame differs from the exact frame.
   - **After rendering:** `build.mjs` reads the render manifest and re-checks every on-grid
     trigger the engine actually rendered.

## The sync points (all candidates share this map)

| Musical position | Seconds | Tick | Sample frame | 60 fps | Engine position |
|---|---:|---:|---:|---:|---|
| bar 1, beat 1 @ 120 | 0.000 | 0 | 0 | 0 | `1:1` |
| bar 1, beat 3 @ 120 | 1.000 | 2,400 | 44,100 | 60 | `2:1+1/8` |
| bar 2, beat 1 @ 120 | 2.000 | 4,800 | 88,200 | 120 | `3:2` |
| bar 2, beat 3 @ 120 (turbine) | 3.000 | 7,200 | 132,300 | 180 | `4:2+1/8` |
| bar 2, beat 4 + 3/16 @ 120 (P's breath) | 3.875 | 9,300 | 170,888 | 232 | `5:2+11/64` |
| **bar 3, beat 1 @ 150 (IGNITION)** | **4.000** | **9,600** | **176,400** | **240** | **`6:1`** |
| bar 4 @ 150 | 5.600 | 13,440 | 246,960 | 336 | `8:1` |
| bar 5 @ 150 | 7.200 | 17,280 | 317,520 | 432 | `10:1` |
| bar 6 @ 150 | 8.800 | 21,120 | 388,080 | 528 | `12:1` |
| bar 7 @ 150 (P's breakthrough, L's summit) | 10.400 | 24,960 | 458,640 | 624 | `14:1` |
| bar 7, beat 3 @ 150 (P's final hit) | 11.200 | 26,880 | 493,920 | 672 | `15:1` |
| end | 12.000 | 28,800 | **529,200** | **720** | `16:1` |

**The project's metadata.** Each project file says `"bpm": 150, "timeSignature": "2/4",
"bars": 15`. That is the carrier grid, not the music:

- the music's first two bars are at 120 BPM;
- engine positions such as `6:1` count carrier bars;
- the cue sheets and event maps translate every event back to its musical bar ("3.1 @ 150
  BPM").

## Event maps (exact, 60 fps)

Each delivered candidate has `*.events.md` and `*.events.json`: **every trigger the engine
rendered**, read from its own render manifest. Each row gives:

- the time in seconds;
- the sample frame;
- the 60 fps picture frame, `floor(sampleFrame × 60 / 44100)`;
- the track, sound and velocity;
- the musical position and its tempo.

| Candidate | Events | Of which physics-timed |
|---|---:|---:|
| P V1 / **P V2** | 302 / **313** | 18 / **18** |
| L V1 / **L V2** | 295 / **295** | 28 / **28** |
| P fixed-120 control | 268 | 18 |

**Physics-timed events.** These are the turbine's ratchet ticks. They follow the cable's
round trips as the spool winds up, which is A's turbine and is not on any grid.

- **Placement:** each tick sits at the nearest engine tick, at most half a tick away
  (≤ 0.21 ms).
- **Labelling:** the maps show them as "physics-timed" with their fractional position.

## What else in the project depends on tempo

The music changes tempo but the project does not, so nothing in it may assume a tempo
silently:

- **Delays** are absolute milliseconds, chosen for the section each part plays in:
  - 375 ms is a dotted eighth at 120 BPM: P's intro blips and L's spark bell;
  - 300 ms is a dotted eighth at 150 BPM: the leads and arpeggios after ignition.
- **Sidechain duck lanes and gain automation** are written in seconds.
- **External stems** (cable, FDN rooms, L's legato lead) are rendered from the same exact
  times and placed at `1:1`.

## Limitations

1. **Only compatible tempo pairs.** A pair works only when both tempos' sixteenths are whole
   microseconds *and* whole ticks of one integer-microsecond carrier. 120 and 150 BPM
   qualify.
   - **Example:** 120 → 145 BPM is refused ("145 BPM sixteenth is not whole microseconds").
   - **Such a pair would need:** a different carrier, or external rendering of the affected
     parts.
2. **Steps only, no ramps.** An accelerando cannot be carried exactly. It could only be
   stepped.
3. **Finest grid.** The finest authored subdivision is a 64th: 75 ticks at 120, 60 at 150.
   - **Not representable:** a 128th at 120 BPM is 37.5 ticks.
   - **Hence:** the physics-timed ratchet is snapped to the nearest tick instead.
4. **The engine reports the carrier.** Its own metadata and analysis say 150 BPM. Anyone
   reading the project alone would not see the 120 BPM bars; the cue sheets, event maps and
   this file are the record.
5. **A real engine tempo map** would make this translation unnecessary. Building one was out
   of scope; the brief asked not to change the core engine yet.

## The fixed-120 control

`p/control120/` uses no translation: it is natively one engine tempo (120 BPM, 4/4).

- **Same opening:** 0–4 s and ignition fall on the same frames as P.
- **Different form:** after ignition it has **four** 120 BPM bars where P has five at 150.
  The control drops P's second hook bar, so the final hit lands at 11.000 s (485,100;
  picture 660) instead of 11.200 s.

## Check it yourself

From the repository root, after `npm ci` (the map imports the engine's built timing from
`dist/`):

```sh
node --input-type=module -e "
import { PROPULSION_MAP } from './experiments/still-here-score/src/tempo-map.mjs';
const M = PROPULSION_MAP();
for (const p of [31, 32, 112]) console.log(p, M.micro(p), M.tick(p), M.frame(p), M.picture(p), M.position(p));"
# 31 3875000 9300 170888 232 5:2+11/64
# 32 4000000 9600 176400 240 6:1
# 112 12000000 28800 529200 720 16:1
```
