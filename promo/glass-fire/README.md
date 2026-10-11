# GLASS//FIRE

The visual system for the 24-second DaemonV12 promo: a deterministic, frame-accurate
Remotion composition that turns music data into motion. It is **isolated from the
DaemonV12 package**: it has its own `package.json` and lockfile, the root never imports
it, and the root package does not depend on Remotion or React (checked by
`tests/isolation.test.ts`).

The music is produced separately. This project renders now from deterministic placeholder
data, and later from the final master and stems without any change to the motion code
(see **[SYNC_HANDOFF.md](SYNC_HANDOFF.md)**).

## Commands

Run from `promo/glass-fire/` with Node ≥ 22.18:

```sh
npm ci
npm run dev             # Remotion Studio (also writes the dev click track)
npm run check           # typecheck + lint + 38 unit tests (no browser)
npm run verify          # render-level QA through the real renderer (17 checks)
npm run contact-sheet   # out/glass-fire-contact-sheet.png (36 frames on one sheet)
npm run render:preview  # out/glass-fire-preview-540p.mp4  (960×540, 60 fps, silent)
npm run render:click    # same, with the 160 BPM reference click (development only)
npm run render:silent   # out/glass-fire-1080p60-silent.mp4 (1920×1080, 60 fps, 24 s)
npm run analyze         # final audio → public/sync/promo-data.json
npm run render:final    # out/glass-fire-1080p60.mp4 with the final master

# The 15-second vertical cut (1080×1920, 60 fps, 900 frames); see "Vertical cut" below.
npm run vertical:prepare        # public/sync/vertical-15s.wav and vertical-extras.json
npm run render:vertical         # out/daemonv12-vertical-15s.mp4 (prepare → picture → mux)
npm run render:vertical-poster  # out/daemonv12-vertical-poster.png (1080×1920)
npm run verify:vertical         # render-level QA; add -- --video out/daemonv12-vertical-15s.mp4
```

Each act can be opened on its own in Studio (`Acts/Act1-Hook` … `Acts/Act6-Payoff`) or
rendered alone, for example `npx remotion render src/index.ts Act3-Drop1 out/drop1.mp4`.

**Browser.** Remotion downloads Chrome Headless Shell on first use. On machines that
cannot reach the download host, point it at an existing build:
`REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell npm run verify`
(`remotion.config.ts` reads the variable).

Renders, contact sheets and QA frames go to `out/`, which is git-ignored. Never commit
video.

## Visual concept

**The glass is the instrument.** The film opens on a single hairline, the wordmark, then
the real GLASSHOUSE `glass-hit` waveform. Its outline is extracted from the repository's
own WAV (`scripts/extract-glasshouse.ts`), not drawn. A `//` cut fractures it, and each
shard *refactors* into a related sound (crush, reverse): the pack's own derivation
story. From there the music assembles on screen: lanes appear when their sounds enter,
events quantize onto the grid, automation draws on, the arrangement drops, collapses to
ONE SOUND, returns in a perspective plane steered by automation, then locks into the
finished render of all six stems across the full 24 seconds. That render merges into
the master, the master flattens into the opening hairline, and the line opens into the
final card. The motif is a bookend: line → glass → system → line.

Palette: black, white, graphite (`src/theme.ts`). A thin-film iridescent accent
(cyan → violet → rose → amber, desaturated) appears only on glass edges, sheens, spectral
peaks and chromatic fringes at impacts. There are no gradients on surfaces, no neon, no
holograms, no fake DAW chrome. Silence is drawn as black.

## Timeline

`src/timeline/grid.ts` holds the locked constants: 60 fps, 160 BPM, 4/4, 16 bars,
1,440 frames. Musical positions are integer ticks (960 per beat, DaemonV12 notation
`"BAR:BEAT+N/D"`), and `frames = ticks · 3/128` is exact in floating point. Bars are
integer frames (90 each); beats are 22.5 frames. Discrete events land on the first frame
at or after their time (`eventFrame`, so 1:2 lands on frame 23). Continuous motion samples
exact time `frame / 60`.

| Act | Bars | Frames | Content |
|---|---|---|---|
| 1 HOOK | 1–2 | 0–179 | hairline → DAEMONV12 → GLASS.HIT waveform → `//` fracture → CRUSH, REVERSE |
| 2 IGNITION | 3–4 | 180–359 | KICK SUB GLASS VOX HAT lanes, quantize-locking events, LPF curve, MCP flashes, pre-drop stop |
| 3 DROP 1 | 5–8 | 360–719 | six live lanes, sample clips, spectrum, master line, NO DAW., stop, JUST TOOLS. |
| 4 FAKEOUT | 9–10 | 720–899 | ONE SOUND. MUTATED. GLASS.HIT ↓ REVERSE · CRUSH · CHOP, collapse to a point |
| 5 DROP 2 | 11–14 | 900–1259 | automation-driven 3D plane, split lanes, shards → notes, throws, effect names, 9 MCP TOOLS, 12 INSTRUMENTS, COMPOSE EDIT PROCESS RENDER |
| 6 PAYOFF | 15–16 | 1260–1439 | full-song render locks → master → hairline → DAEMONV12 / GIVE AGENTS INSTRUMENTS. → black from frame 1418 |

Every act boundary is a bar line and a hard cut. All scheduled visual events are on one
cue sheet (`src/timeline/cues.ts`) in musical notation; music-locked cues snap to the
real onset of a named stem.

## Components (`src/primitives/`)

| Component | Role |
|---|---|
| `Waveform` | Real GLASSHOUSE outline as a glossy object: chrome horizon fill, thin-film edge, specular sheen, floor reflection, chromatic fringe. `reverse`, `crush` (quantize + sample-hold), `chop` and `from/to` slices are transformations of the same data |
| `SampleShard` | A waveform fragment in flight; velocity becomes a directional smear |
| `StemLane` | Scrolling envelope (filled behind the playhead, outlined ahead), onset blocks that quantize-lock before playing, hit flashes, activity square, typed label, L/R split |
| `SampleEvents` | Onsets that name a GLASSHOUSE sound, drawn as that sound's real waveform at its true length |
| `EnergyBand` | Spectral energy as a scrolling analysis strip (not an equalizer) |
| `AutomationCurve` | Played/ahead curve, breakpoints, value readout on the playhead |
| `BeatGrid`, `TimelineMarker` | Exact beat/bar lines and numbers, playhead, section flags, stops drawn as `//` hatching |
| `Arrangement` | Composes the above on one shared `TimeView`; Acts 2, 3 and 5 configure it differently |
| `TypeHit` | Rhythm typography: slam / mask / width-stretch / cut entries, onset punch, chromatic fringe, collapse exit |
| `MCPCall` | A real `daemonv12_*` tool call flashed in the margin |
| `FrameChrome` | Corner registration, bar · beat · sixteenth, timecode and frame, 16-bar progress strip |

## Data contract

The film reads one `PromoData` document (`src/data/contract.ts`, zod-validated):

- master envelope;
- per-stem envelopes and onsets for kick, sub, glass, vox, clap and hat;
- spectrum;
- automation lanes;
- structural markers.

The fixture (`src/data/fixture.ts`) is a seeded placeholder arrangement in that exact
shape. Its golden SHA-256 is pinned in the tests. `dataSource: "sync"` loads
`public/sync/promo-data.json` instead. See [SYNC_HANDOFF.md](SYNC_HANDOFF.md).

## Motion system (`src/motion/physics.ts`)

Every value is a closed-form function of time. There is no integration state, so any
frame renders identically in isolation.

- `springStep`: the exact damped-oscillator step response in all three damping regimes.
  Presets are `hit` (one musical overshoot), `lock` (critical, used for quantize and
  grid snaps), `heavy` (bar-line layout moves) and `snap` (micro motion).
- `springChain`: a spring re-targeted at keyframes by superposition, which keeps
  position and velocity continuous (tested). Act 5's camera follows the automation
  breakpoints this way.
- `impact`, `pulse`, `hitAt`: exponential hit envelopes driven by onsets.
- `smear`: velocity converted to blur length for a 180° shutter.
- `cutIn`: a reveal that is already more than half present on the event frame, so
  every cut lands.
- `hash01`: deterministic per-element variation. `Math.random` is never used.

## Typography

- **Archivo** variable (weights 100–900, width 62–125%): the display face. The width
  axis is animated, as in JUST TOOLS., which stretches from 62% to 112%.
- **JetBrains Mono** variable: technical labels.

Both are bundled from fontsource (OFL) and loaded through `@remotion/fonts`, never
fetched at render time. Copy is sparse and uppercase, and every word is placed on a
musical event.

## Vertical cut (`GlassFireVertical`)

A 15-second 1080×1920 cut for TikTok, Reels, Shorts, LinkedIn and X. It is its own
composition, built from the same data, primitives and motion system. The landscape
`GlassFire` composition is untouched.

**The edit** (`src/vertical/edit.ts`) is ten whole bars of the final master, cut only on bar
lines. Output bar *k* starts at (*k* − 1) · 1.5 s, exactly like a song bar.

| Output bars | Song bars | Section | Frames |
|---|---|---|---|
| 1 | 4 | HOOK: pre-drop riser and stop | 0–89 |
| 2–3 | 5, 8 | DROP 1 (cut 5 → 8: both bars open on the halftime downbeat) | 90–269 |
| 4–5 | 9–10 | FAKEOUT | 270–449 |
| 6–8 | 11, 12, 14 | DROP 2 (cut 12 → 14: both bars open on the two-step downbeat) | 450–719 |
| 9–10 | 15–16 | PAYOFF, to the last sample of the master | 720–899 |

`npm run vertical:prepare` cuts the audio from the final `master.wav` with two 8 ms
equal-power crossfades that end on the bar line, plus a 2 ms fade-in. Every other output
sample is byte-identical to the master; the script checks this and prints a seam report.
It also writes `vertical-extras.json` from the render manifest. That file holds:

- the exact sample triggers, each with its GLASSHOUSE identity;
- the project's real gain/pan automation;
- the master gate's silences, from `master-gate.wav` when its SHA-256 matches the manifest;
- the GM programs, from `project.json`, also hash-checked.

The composition remaps all music data through the same edit, so lanes, cues and camera
moves read the music at the time it is heard.

**The file.** `npm run render:vertical` renders the picture with Remotion
(`out/daemonv12-vertical-15s.video.mp4`). `scripts/vertical-mux.ts` then copies that H.264
stream untouched and encodes AAC once from `vertical-15s.wav` at its own 44.1 kHz. Remotion's
own audio track would be padded to a whole AAC frame and read 15.019 s, because 15 s at 48 kHz
is not a multiple of 1024 samples. The mux writes an exact edit list instead, so the video
stream, the audio stream and the file all read 15.000 s.

**Portrait layout** (`src/vertical/`). The arrangement is rotated so time runs down the frame
(`primitives/Columns.tsx`). It has six columns, and each trigger falls into a horizontal
playhead as its own GLASSHOUSE waveform. Drop 2 tilts the same columns into a perspective plane.
All copy stays inside `SAFE` (`layout.ts`): the centre 70 % of the width, between the top and
bottom platform overlays. `npm run verify:vertical` renders the copy layers alone and checks
every copy beat against that box.

**CTA.** The end-card line is the single constant `CTA_LINE` in `src/vertical/config.ts`.

## Files

```
src/
  index.ts, Root.tsx       composition registry (GlassFire, GlassFireVertical, Acts/*, QA/ContactSheet)
  GlassFire.tsx            main composition, data loading, audio, chrome
  ContactSheet.tsx         QA still made of frozen real frames
  context.tsx              data provider, global time inside acts
  theme.ts                 palette, fonts, stage geometry
  timeline/                grid.ts (locked math), acts.ts, cues.ts
  data/                    contract.ts, fixture.ts, signals.ts, glasshouse.ts + waveform JSON
  motion/physics.ts        springs, impacts, smear, hashes
  primitives/              the components above
  acts/                    Act1Hook … Act6Payoff
  vertical/                the 15-second cut: edit, sections, cues, data remap, layout, config (CTA),
                           primitives/ (Columns, TriggerTags, VChrome), sections/ (VHook … VPayoff)
scripts/                   analyze-stems, click-track, extract-glasshouse, export-fixture, verify,
                           vertical-prepare, vertical-mux, verify-vertical, lib/{wav,analyze,png}
tests/                     timeline, data, motion, analyzer, isolation, vertical
props/                     final.json (sync data + master), click.json (fixture + click), vertical.json
public/sync/               final audio drop zone (git-ignored except README)
```
