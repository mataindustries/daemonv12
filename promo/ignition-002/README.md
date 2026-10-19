# IGNITION 002 — THE INFINITE REACTOR

A 15-second, 1080×1920, 60 fps seamless-loop music video for **IGNITION 002: SECOND WIND**
(128 BPM, F♯ minor, eight bars). It is built as a deterministic Remotion composition: a colossal
reactor at the end of a dark tunnel of bulkheads, drawn procedurally, frame by frame, on one
canvas. The project is isolated from the DaemonV12 package. It has its own `package.json` and
lockfile, the root never imports it, and `tests/isolation.test.ts` checks this.

## Status: music pending

The picture is finished, but the approved WAV still has to be added:

- The approved WAV could not be fetched from Google Drive in the build environment, because its
  network policy blocks the Drive hosts.
- `src/sync/sync.json` is therefore the labelled **grid placeholder** (`"source": "grid"`): a kick
  on every beat, a backbeat on 2 and 4, off-beat hats.
- The final master must not be made from that. Finish it in four commands:

```sh
cp /path/to/approved.wav public/audio/ignition-002-second-wind.wav   # SHA-256 6938bf3b…a80e1
npm run analyze          # measures the real hits → src/sync/sync.json ("source": "analysis")
npm run render:master    # out/IGNITION-002-INFINITE-REACTOR-15S-1080x1920.mp4 + poster
npm run verify           # all checks, QA evidence in out/qa/, checksums in out/SHA256SUMS.txt
```

Commit the regenerated `src/sync/sync.json` afterwards. Without the WAV, `render:master` refuses
to run. `render:master -- --picture-only` writes a silent master instead, and its file name says
`PICTURE-ONLY`.

## Commands

Run from `promo/ignition-002/` with Node ≥ 22.18:

```sh
npm ci
npm run dev              # Remotion Studio
npm run check            # typecheck + lint + tests (no browser)
npm run analyze          # approved WAV → src/sync/sync.json (refuses any other file)
npm run analyze:grid     # labelled 128 BPM placeholder
npm run render:preview   # out/IGNITION-002-preview-540x960.mp4 (with the music when present)
npm run render:master    # ProRes HQ mezzanine → two-pass x264 + AAC from the WAV → faststart MP4
npm run verify           # spec, seam, virtual frame 900, flashes, audio offset, 3× loop, checksums
```

**Browser.** If Remotion cannot download Chrome Headless Shell, point it at an existing build:
`REMOTION_BROWSER_EXECUTABLE=/path/to/headless_shell` (read by `remotion.config.ts`).

## The film

| Time | Bars | Movement | What happens |
|---|---|---|---|
| 0–3.75 s | 1–2 | ACTIVE | The reactor is already running. The ratchet advances one detent per kick. Three gyro rings spin on tilted gimbals. Rings of light run down the tunnel on every kick. Clamp LEDs pulse with the kick. A light chases around the stator on sixteenths. |
| 3.75–7.5 s | 3–4 | ACCELERATE | The rings speed up and their gimbals open. The odd tunnel rails and the four diagonal mounts come alive one per beat: these are the new pathways. In bar 3 an LED chase circles the clamps on sixteenths. In bar 4 the clamps unlatch one per sixteenth. |
| 7.5–11.25 s | 5–6 | OPEN | On the downbeat, all sixteen clamps slam back and a refraction shockwave rolls out. The stator tilts and turns exactly once. The gyro rings open into an armillary cage. Polar plasma jets erupt and the magnetic field lobes expand. On bar 6 the whole cage precesses by 90°. Snares throw plasma arcs. |
| 11.25–15 s | 7–8 | CONVERGE | Everything closes in sequence and the rings decelerate. In bar 8 the clamps zip shut clockwise, one per sixteenth. The last one lands a sixteenth before the loop point, where every ring's index mark returns to twelve o'clock. |

Details to find on repeat viewing:

- counter-rotating rings, each with one white index mark;
- the 64-tooth ratchet ticking on the kicks;
- the two comets that chase around every gyro ring;
- field-line pulses that run pole to pole on each kick;
- corner beacons in the tunnel patterned on the hats;
- parallax between the reactor, the tunnel and two out-of-focus girders near the lens.

**Copy.** There are only three lines: IGNITION, SECOND WIND and DAEMONV12. They are always on screen,
since a loop has no title reveal, and always inside the platform-safe box `SAFE`
(x 162–918, y 300–1460) in `src/layout.ts`. `npm run verify` renders the copy alone and measures it
against that box. A heat sweep crosses IGNITION on every bar line.

## Loop engineering

Every value is a closed-form, exactly periodic function of `t = frame / 60`
(`src/motion/periodic.ts`):

- **Springs** (`cycleSpring`) are linear, so a chain of target changes is the superposition of
  step responses. Each chain's moves sum to zero, and earlier cycles are included. Position and
  velocity are therefore continuous through every retarget and through 15 s → 0 s.
- **Rotations** (`integratedAngle`) integrate a periodic speed profile and are normalised to a
  whole number of turns per loop (gyros +4/−6/+8, stator 1 inside OPEN, field −3).
- **The ratchet** (`ratchet`) advances one detent per analysed kick and lands one full turn per
  loop.
- **Hit envelopes** wrap around the loop point, so a hit at 14.9 s decays into frame 0.
- **Drift patterns** (haze, jet knots, rail flow, chase lights) travel a whole number of tiles or
  steps per loop.

`tests/loop.test.ts` samples every smooth driver at 0.1 ms steps across the seam. It checks exact
periodicity and that the seam step is never larger than the largest in-film frame step. `scripts/verify.ts`
checks the rendered film the same way. It also renders *virtual frame 900*: frame 899 with
`timeOffset = 1/60`, which must equal frame 0.

## Music data

`src/sync/sync.json` (`src/sync/contract.ts`) holds:

- kick, snare and hat hits, with times and measured strengths;
- accents;
- per-frame loudness and band levels.

`scripts/lib/analyze.ts` treats the WAV as circular, so the last second is prepended before
filtering. It splits three bands (< 120 Hz, 300–2500 Hz, > 6 kHz) and detects transients by their
log-energy rise. It searches every sixteenth ±35 ms, after estimating the grid offset. Each hit's
strength comes from its own peak level, so loud and soft hits are told apart.

`tests/analyze.test.ts` proves the analyser on a synthetic loop with known, unequal hits.

## Files

```
src/
  Root.tsx, index.ts          composition registry (InfiniteReactor: 1080×1920, 60 fps, 900 frames)
  InfiniteReactor.tsx         canvas + copy + optional <Audio> for Studio
  timeline.ts                 locked grid: 128 BPM, 8 bars, 15 s, 900 frames
  choreo.ts                   every moving quantity as a periodic function of t
  motion/periodic.ts          springs, integrated angles, ratchet, wrapped hit envelopes
  reactor/render.ts           procedural renderer (tunnel, haze, depth-sorted machinery, core,
                              field, jets, arcs, shockwave refraction, bloom, grade)
  reactor/math3d.ts           vectors, rotations, perspective orbit camera
  reactor/ReactorCanvas.tsx   draws one frame synchronously
  Titles.tsx, fonts.ts        copy (Archivo, JetBrains Mono, bundled from fontsource)
  layout.ts                   platform-safe box for copy
  sync/contract.ts, sync.json music data contract and current data
scripts/                      analyze, render, verify, lib/{analyze,wav,approved,deliverables}
tests/                        loop, motion, analyzer, isolation
public/audio/                 approved WAV drop zone (git-ignored)
```

Built with Remotion 4.0.534, the version already pinned by `promo/glass-fire`. It follows the
official Remotion agent skills (`remotion-best-practices`, `remotion-create`, `remotion-markup`):

- motion comes only from `useCurrentFrame()`, with no CSS animation;
- fonts load through `@remotion/fonts`;
- audio uses `<Audio>` from `@remotion/media`;
- the composition is registered with inline default props.
