# GLASS//FIRE: sync handoff

This document is the contract between the music (produced on a sibling branch) and this
motion system. The sync pass supplies audio and data. **It does not change any motion
code.** Every visual reads one `PromoData` document. Today that document is the
deterministic fixture. After the sync pass it is the analysis of the real song.

## 1. The locked frame

| | |
|---|---|
| Duration | **24.000 s** = **1,440 frames** at **60 fps** |
| Music | **160 BPM**, **4/4**, **16 bars** |
| Bar | 1.5 s = **90 frames** (always an integer frame) |
| Beat | 0.375 s = **22.5 frames** (odd beats fall between frames) |
| Acts | 1 HOOK bars 1–2 (f0–179) · 2 IGNITION 3–4 (f180–359) · 3 DROP 1 5–8 (f360–719) · 4 FAKEOUT 9–10 (f720–899) · 5 DROP 2 11–14 (f900–1259) · 6 PAYOFF 15–16 (f1260–1439) |

All times in the data are **seconds from the first sample of the master**. Bar 1 beat 1
is t = 0. If the music has a pickup or pre-roll, trim it so the downbeat of bar 1 is
sample 0. The analyzer refuses a master shorter than 24.000 s. A longer one is accepted
and its tail is ignored.

## 2. What to deliver

Put these files in `promo/glass-fire/public/sync/` (git-ignored):

| File | Required | Spec |
|---|---|---|
| `master.wav` | yes | The final master. PCM 16/24/32-bit or float WAV, any sample rate (44.1 kHz from DaemonV12 is ideal), mono or stereo, **≥ 24.000 s**, downbeat of bar 1 at sample 0. |
| `stems/kick.wav` | yes | Kick (or whatever plays the kick role). |
| `stems/sub.wav` | yes | Sub / bass (GLASSHOUSE `sub-cs`, `bass-punch-cs`). |
| `stems/glass.wav` | yes | Glass family: `glass-hit`, `glass-reverse`, `glass-crush`, `prism-impact`, chops. |
| `stems/vox.wav` | yes | `ghost-vox`, `vox-chip`. |
| `stems/clap.wav` | yes | Clap (`chrome-clap`). |
| `stems/hat.wav` | yes | Hats (`pixel-hat`). |
| `master.render.json` | recommended | The DaemonV12 render manifest (`*.render.json`) of the same render. It gives **exact, sample-accurate onsets** and the GLASSHOUSE sample name of every trigger. |
| `structure.json` | recommended | Authored markers and automation lanes (section 5). |
| `sync.json` | yes | Says which file is which (section 3). |

Stems must be the same length and sample rate as the master and sample-aligned. That is
what `daemonv12 render --stems` produces. Six roles are the visual vocabulary. If the
arrangement has more tracks, fold them into the nearest role. If a role is silent in the
song, still supply a silent WAV of full length; its lane will simply never fire.

If several roles share one DaemonV12 track (for example a single GLASSHOUSE kit track
playing clap and hat), point those roles at the same stem WAV and separate their onsets
through the manifest `samples` filter (section 3). Separate stems per role still give
better envelopes, so render them that way when you can.

## 3. `sync.json`

```json
{
  "master": "master.wav",
  "stems": {
    "kick": "stems/kick.wav",
    "sub": "stems/sub.wav",
    "glass": "stems/glass.wav",
    "vox": "stems/vox.wav",
    "clap": "stems/clap.wav",
    "hat": "stems/hat.wav"
  },
  "manifest": "master.render.json",
  "tracks": {
    "kick": ["kick"],
    "sub": ["sub", "bass"],
    "glass": ["glass-lead", "glass-chops"],
    "vox": ["vox"],
    "clap": {"tracks": ["kit"], "samples": ["chrome-clap"]},
    "hat": {"tracks": ["kit"], "samples": ["pixel-hat"]}
  },
  "structure": "structure.json"
}
```

- `manifest` and `tracks` are optional. `tracks` maps a role to DaemonV12 **track ids**
  in the manifest's `samples.tracks[]`. The `{tracks, samples}` form keeps only triggers
  whose asset path contains one of the `samples` strings. A role listed here takes its
  onsets **exactly** from the manifest (trigger frame ÷ 44,100). A role left out has its
  onsets **detected** from its stem.
- GM (FluidSynth) tracks have no sample triggers. Leave them out of `tracks` and let
  detection handle them.

## 4. Run it

```sh
cd promo/glass-fire
npm run analyze          # writes public/sync/promo-data.json and prints a report
npm run verify -- --data sync
npm run render:final     # out/glass-fire-1080p60.mp4, with master.wav as the soundtrack
```

`npm run analyze` prints:
- the onset count per role, and whether it came from the manifest (exact) or detection;
- the markers;
- the automation lanes;
- a **cue snapping** table showing, for every music-locked visual cue, how far the real
  onset sits from the grid.

A cue snaps to a real onset within ±90 ms of its written position; otherwise it stays on
the grid. If a cue is reported off by more than about 20 ms, check the trim (section 1)
before touching any code.

## 5. `PromoData` (what the analyzer writes, what the film reads)

The schema lives in `src/data/contract.ts` (zod) as `glass-fire.promo-data/1`. Run
`npm run fixture:export` for a complete, valid example in `out/fixture.promo-data.json`.

```ts
{
  schema: 'glass-fire.promo-data/1',
  source: {kind: 'analysis', generator, master, masterSha256, stems, sampleRate},
  timing: {bpm: 160, beatsPerBar: 4, bars: 16, durationSeconds: 24},   // must match exactly
  master: {envelope: {rate: 60, values: number[1441]}},                 // 0…1
  stems: {kick | sub | glass | vox | clap | hat: {
    envelope: {rate: 60, values: number[1441]},                         // 0…1
    onsets: {t, strength, sample?, variant?, duration?, pitch?}[]        // sorted by t
  }},
  spectrum: {rate: 60, bandEdgesHz: [20,60,150,400,1000,2500,6000,12000,20000], values: number[1441][8]},
  automation: {id, label, target, unit: 'Hz'|'dB'|'%'|'pan', range: [min,max], points: {t, v}[]}[],
  markers: {t, kind: 'section'|'drop'|'stop'|'hit'|'end', id, label?, duration?}[]
}
```

How the analyzer derives each field:

| Field | Derivation |
|---|---|
| envelopes | RMS over a 1/30 s window centred on each video frame, ÷ the track's loudest frame, then `^0.65` so decays stay visible |
| onsets (manifest) | trigger `frame / 44100`; strength = velocity ÷ the role's maximum; `sample` from the asset file name (`01-glass-hit.wav` → `glass-hit`); `duration` from the asset length |
| onsets (detected) | log-energy rise ≥ 9 dB over about 9 ms, above (peak − 42 dB), peak-picked, minimum gap 35 ms, refined to the first sample over 25% of the local peak. The test suite recovers synthesized kick and hat onsets within 2 ms and the reference click within 0.5 ms |
| spectrum | 2048-point Hann FFT per video frame, 8 log bands, each band normalized to its own 60 dB range |
| markers | the six locked sections, plus **stops** (master below about −43 dB for at least a 1/16 note), plus anything authored in `structure.json`. Authored stops replace detected ones |
| automation | only from `structure.json`; never invented |

### `structure.json` (optional, recommended)

```json
{
  "markers": [
    {"t": 5.8125, "kind": "stop", "id": "stop.pre-drop1", "label": "PRE-DROP GAP", "duration": 0.1875},
    {"t": 21.0, "kind": "hit", "id": "final-impact", "label": "PRISM IMPACT"}
  ],
  "automation": [
    {"id": "glass.lpf", "label": "LPF", "target": "glass", "unit": "Hz", "range": [200, 20000],
     "points": [{"t": 3.0, "v": 700}, {"t": 5.8125, "v": 18000}]}
  ]
}
```

Take the automation from the DaemonV12 project (track gain/pan automation, effect
parameters, ducking). Convert positions with `t = ticks / 2560`, which is exact at
160 BPM with 960 ticks per beat; for example "4:4+1/8" = 14880 ticks = 5.8125 s. The
visuals look for these lane ids:

| id | Drives |
|---|---|
| `glass.lpf` (Hz) | Act 2: the first automation curve draws over the GLASS lane. Act 5: camera dolly and the "LPF" label |
| `sub.duck` (dB) | Act 5: pump of the perspective plane, the sawtooth over SUB, the "DUCK" label |
| `vox.delay` (%) | Act 3 and Act 5: the delay-throw curve and its label |
| `glass.pan` (pan, −1…1) | Act 5: camera yaw and roll (automation becomes spatial motion), the "PAN" label |
| `master.hpf` (Hz) | carried in the data; not drawn yet |

A missing lane degrades gracefully: the camera holds still and the label never appears.
Lane `label` is the exact on-screen effect name, so use the real one (`LPF`, `DELAY 3/16`).

## 6. What follows the music automatically

Nothing below needs code changes.

| Visual | Reads |
|---|---|
| Lane envelopes, onset blocks, flashes, label squares | `stems.*.envelope`, `stems.*.onsets` |
| GLASS/VOX sample clips (Acts 3, 5) | `onsets[].sample`, `duration` (real GLASSHOUSE waveforms) |
| Glass shards landing as notes (Act 5) | `stems.glass.onsets` |
| Clap transient lines, vox throws (Acts 3, 5) | `stems.clap.onsets`, `stems.vox.onsets` |
| Kick body punch, playhead flash, type punch | `stems.kick.onsets` |
| MCP tool list lighting (Act 5) | `stems.hat.onsets` |
| Spectrum strip and master line (Act 3) | `spectrum`, `master.envelope` |
| Negative space (Acts 2, 3, 5 go black) | `markers` of kind `stop` |
| Full-song overview (Act 6) | every stem envelope over 24 s, `master.envelope` |
| Type hits, act cues | `src/timeline/cues.ts`, snapped to the named stem's onset within ±90 ms |

## 7. If the music moves

- **A hit lands slightly off the grid.** Snapping handles it within ±90 ms. Wider than
  that, edit the one line for that cue in `src/timeline/cues.ts`, for example
  `noDaw: {at: '6:1', snap: 'kick'}`.
- **A section moves.** Edit the bar ranges in `src/timeline/acts.ts`. Acts must stay
  bar-aligned and tile 1,440 frames; this is checked on import and in the tests.
- **Tempo or length changes.** Not supported: the contract rejects any BPM other than
  160 and any duration other than 24 s. Raise it before producing the music.

## 8. Checklist for the sync pass

1. Trim the master so bar 1 beat 1 is sample 0, and confirm it is at least 24.000 s.
2. Render the stems with DaemonV12 (`--stems`) from the same project, and keep the
   `.render.json`.
3. Write `sync.json` (and `structure.json`).
4. `npm run analyze`, then read the cue-snapping table.
5. `npm run verify -- --data sync`, then `npm run contact-sheet -- --props=props/final.json`.
6. `npm run render:final`.
7. Do not commit the WAVs or the video. `public/sync/` and `out/` are git-ignored.
