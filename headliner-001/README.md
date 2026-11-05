# DAEMON//HEADLINER 001 · SODIUM HOURS

An original instrumental single made with DaemonV12: **3:06.5, 92 BPM, F minor resolving to F major.**
Futuristic West Coast pocket, industrial bass, a nocturnal Los Angeles, cinematic harmony.

> **Status: owner review.** Not published, released or merged. Licensing of the generated audio is
> pending the owner's declaration (see [ASSETS_AND_LICENSES.md](ASSETS_AND_LICENSES.md)).
> The producer was an AI agent that **cannot hear audio**: every musical judgment in this folder is
> labelled score reasoning or measurement. No human listening feedback has been received yet.

## Listen

| File | What |
|---|---|
| [`delivery/sodium-hours.wav`](delivery/sodium-hours.wav) | **Final master**, 44.1 kHz / 16-bit stereo, 186.5 s |
| [`delivery/sodium-hours.mp3`](delivery/sodium-hours.mp3) | Listening copy (192 kbps) |
| [`delivery/alternate/sodium-hours-bed.mp3`](delivery/alternate/sodium-hours-bed.mp3) | Alternate mix: instrumental bed (no lead voice), `.flac` beside it is lossless |
| [`delivery/stems/`](delivery/stems) | 15 stems, lossless FLAC (decode to the exact engine WAVs with `tools/flac.ts`) |
| [`versions/`](versions) | V1, V2a, V2, V3, V4 and V5 (= final) listening copies for A/B |
| [`sketches/`](sketches) | The three directions explored before V1 |

## The idea

A machine city learning to sing. One motif is heard three ways: as a **machine** (a staccato
low-pass-gate pluck on a straight grid), as a **voice** (a synthetic talkbox, legato, swung, sliding),
and finally as a **choir** that sings it with the voice. The hook's answer ends on an unresolved E♮
that falls back to E♭ every time (a V–♭VI deceptive cadence); only in the last minute does it rise to
F, over F major. Across the three choruses the melodic ceiling climbs A♭5 → B♭5 → C6.

| Time | Bars | Section | What happens |
|---|---|---|---|
| 0:00 | 1–8 | Haze | Rain, a sodium-lamp hum. The machine plays the hook's *call*, cannot finish the answer; a distant siren traces the hook's slide. |
| 0:20.9 | 9–16 | Boulevard | The pocket alone: swung drums, slide-bass riff, keys with a moving top line, lowrider hydraulics. No lead. |
| 0:41.7 | 17–24 | The voice | The talkbox sings call and answer; the E♮ is heard for the first time. The machine answers in the gaps. |
| 1:02.6 | 25–32 | Overpass | New kick pattern, straight-grid 3-3-2 metal against the swing, first grit-bass pops, voice ad-libs; breaks on a hanging E♮. |
| 1:23.5 | 33–40 | Mulholland | Beatless. The hook at half speed over D♭maj9–B♭m9–E♭–Cm7–Fm9–D♭/F–G♭maj7–C7♭9; choir; the machine's lattice accelerates into a tom fill. |
| 1:44.3 | 41–48 | Freeway | Heaviest groove, grit bass fully open, choir under the hook; the ceiling rises to B♭5. |
| 2:05.2 | 49–52 | Signal loss | Stop-time in 3-3-3-3-4 sixteenths against the bar, the voice's cry stutters, then two beats of total silence. |
| 2:15.7 | 53–64 | Sodium hours | The choir sings the hook with the voice; new summit C6 (2:33.9); the cadence broadens into half time (2:36.5); **2:44.3** the E♮ resolves to F over F major. |
| 2:47.0 | 65–70 | Dawn | The machine plays the motif with the E♮ it learned; last rain, a low F, the choir's F-major tail. |

A spectrogram of the whole master with bar numbers: [`delivery/sodium-hours-map.png`](delivery/sodium-hours-map.png).

## Measurements (engine and FFmpeg, not quality scores)

| | Master | Instrumental bed |
|---|---:|---:|
| Integrated loudness | −11.35 LUFS | −12.56 LUFS |
| Loudness range | 6.2 LU | 7.0 LU |
| True peak | −2.07 dBTP | −2.07 dBTP |
| Sample peak | −2.58 dBFS | −2.76 dBFS |
| Clipped samples (every track stage and master) | 0 | 0 |

Hook pitch check (YIN on the dry voice stem vs the score): all notes within ±13 cents except one
sixteenth-note passing tone that glides into the summit (−34 cents). Mono fold-down costs 0.1–0.6 dB.
Interpolated sampler work: 13 voices, ~3.7 % of the engine's one-billion-tap budget.

## What is in this folder

| Path | Contents |
|---|---|
| `project/sodium-hours.json` | The final DaemonV12 project (15 tracks, 2,223 sample triggers) |
| `project/sodium-hours-bed.json` | Alternate-mix project (same assets and mix, no voice tracks or sung ensemble) |
| `project/sodium-hours.catalog.json` | Every generated sound: recipe, frames, channels, tuning, SHA-256; generator file hashes |
| `project/assets/sodium/<kit>/` | `kit.json` + lossless FLAC of each of the 163 sounds (WAVs are restored, not committed) |
| `delivery/` | Master WAV/MP3, render manifest (`.render.json`), analysis, MIDI (conductor only), stems, alternate, `SHA256SUMS`, map |
| `tools/` | The instrument generator and score (TypeScript, no dependencies): `dsp.ts`, `instruments.ts`, `kits.ts`, `hook.ts`, `single.ts`, `song.ts`, `build.ts`, `flac.ts`, sketches |
| `analysis/` | Evidence tools: spectrogram PNG, per-stem section loudness, master-chain simulator, pitch check |
| `CREATIVE_LOG.md`, `PRODUCTION_NOTES.md` | Short creative log; detailed version-by-version evidence |

## Reproduce

One command checks everything from committed files (about 4 minutes): restores the 163 assets and the
stems from FLAC, verifies every hash, renders the master and stems and compares them.

```bash
headliner-001/scripts/verify-delivery.sh
```

Or step by step, from the repository root, with Node 22.18+ and FFmpeg (the engine's own requirements; no
`npm ci` needed):

```bash
node headliner-001/tools/flac.ts restore headliner-001/project/assets headliner-001/project/assets headliner-001/project/sodium-hours.catalog.json
```

```bash
node bin/daemonv12.js render headliner-001/project/sodium-hours.json --out-dir renders/sodium-hours --stems --format wav,mp3
```

```bash
sha256sum renders/sodium-hours/sodium-hours.wav
```

Expect `43da3fd7119f5add17ff9896e29d46123cdb1f214ea9fc8e7747513903f1e07d` (see `delivery/SHA256SUMS`;
stem WAV hashes are listed there too). The alternate: render `project/sodium-hours-bed.json` the same way.

Instead of restoring, the assets can be **regenerated from code** (about 2 minutes):

```bash
node headliner-001/tools/build.ts single headliner-001/project
```

**Verified here** (Linux x86_64, Node v22.23.4, FFmpeg 6.1.1-3ubuntu5, engine 0.7.0): two fresh renders were
byte-identical (WAV, manifest, analysis, MIDI, MP3, all stems); a regeneration in a new process matched all
178 asset files and the project byte for byte; a fresh copy holding only the committed FLAC assets
restored and rendered the identical master; the 15 stems summed and passed through the documented master
chain reproduce the master with zero difference. Regeneration uses only V8's own math routines and seeded
generators, but byte equality on other platforms or Node versions has not been tested; the committed FLAC
assets are the canonical inputs.

## Owner decisions pending

1. Listen: does direction A (and the V4 half-time cadence) hold up? V3 is kept for the A/B.
2. Declare a license for the generated audio and the song (nothing in this folder grants one).
3. Decide on publication, distribution, merge or release. None has happened.
