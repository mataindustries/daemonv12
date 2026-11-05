# entry-k3v9 · DAEMON//BATTLE 002 submission

Original 28.000 s cinematic electronic cue. **B minor, 140 BPM, 4/4, 16 bars + composed tail.**
Only the 16 V12 SIGNATURE 1.0.0 samples (hash-verified copies in `assets/`) and the unmodified
DaemonV12 0.7.0 engine; sample-only route, no FluidSynth/General MIDI, no external generation.

## Listen

| File | What |
| --- | --- |
| [`final/entry-k3v9.wav`](final/entry-k3v9.wav) | Canonical master, 44.1 kHz / 16-bit stereo, 1,234,800 frames |
| [`final/entry-k3v9.mp3`](final/entry-k3v9.mp3) | Listening copy (outside the determinism contract, but it also repeated byte-identically) |
| [`final/entry-k3v9.stems/`](final/entry-k3v9.stems/) | 14 sample-aligned stems (all 1,234,800 frames; include track gain/pan/automation/effects, exclude master gain) |
| [`entry-k3v9.json`](entry-k3v9.json) | Frozen project (byte-identical to `cue-v4.json`) |

Master: sample peak −1.04 dBFS, true peak −1.04 dBTP, −13.91 LUFS integrated, LRA 5.4 LU,
0 full-scale samples, 0 clipped samples at every track and master stage.

## Musical thesis

- **Hook:** a tresillo (3+3+2) call on repeated B, a leap up, then a falling sigh (B B B → G–F#).
  The same pitches mean something different over every chord: ♭6→5 over Bm, root→maj7 over G,
  3→9 over Em, ♭9→root over F#.
- **Rhythmic identity:** the hook's 3+3+2 becomes the sub/kick pattern; the SIGNAL ostinato is
  grouped 3+3+3+3+2+2 sixteenths, and its delay is a dotted eighth (three sixteenths).
- **Low end:** ABYSS owns the sub. Kick and sub always share onset and playback rate (the pack's
  phase-lock), so they add instead of cancel. The sub holds a **B pedal** for the first half.
- **Contrast:** the harmony moves over a bass that refuses to move; then subtraction before the
  arrival (kick out, floor drops at 8:3, the leap is withheld for a full bar).
- **Payoff:** the withheld leap lands an octave higher on the impact, and the bass moves for the first time.
- **Ending:** an exposed climax, a leading-tone cadence onto a high B, then a bell echo of the call
  *without* its leap, which the opening bar answers on replay.

## Form

| Bars | Time (s) | Section | What happens |
| --- | --- | --- | --- |
| 1–2 | 0.00–3.43 | I Exposure | CHROME strike on B; PHANTOM states the hook (minor-sixth leap) over a swelling open fifth; a quiet SIGNAL pulse gives the grid |
| 3–6 | 3.43–10.29 | II Pedal groove | Sub plays the tresillo on a B pedal (kick on downbeats only, joining the full tresillo at bar 5); harmony G/B → Em/B; leap grows to a minor 7th |
| 7–8 | 10.29–13.71 | III Suspension | F#/B; kick out; choir B → A#; lead plays the call only; floor drops at 8:3; snare plays the tresillo; riser ends on 9:1 |
| 9–12 | 13.71–20.57 | IV Arrival | Leap lands on B5 with CONVERGENCE + IRON PULSE; bass walks B–G–E–F#; REACTOR off-beats; backbeat doubles; chords enter; ostinato splits L/R |
| 13–14 | 20.57–24.00 | V Final statement | Choir doubles the call; bar 14 drops drums, bass and ostinato: octave leap → A#5, exposed |
| 15–16 | 24.00–28.00 | VI Cadence | B5 resolves over Bm with a second, gated impact; the bell echoes B·B·B; everything decays before the boundary (final 10 ms peak −62.7 dB) |

## Reproduce

From the engine checkout (`e2962cc`, Node ≥ 22.18, FFmpeg for `--format`/MP3/loudness):

```sh
(cd benchmarks/daemon-battle-002/entry-k3v9 && node compose.mjs v1 v2 v3 v4)   # rewrites cue-v*.json byte-identically
node bin/daemonv12.js render benchmarks/daemon-battle-002/entry-k3v9/entry-k3v9.json --out-dir /tmp/check --stems --format wav,mp3 --json
```

`compose.mjs`/`score-lib.mjs` only author note lists into project JSON (no DSP/analysis). Hashes:
[`SHA256SUMS`](SHA256SUMS). Process record: [`PRODUCTION-LOG.md`](PRODUCTION-LOG.md).
Intermediate version stems were rendered but are not committed (size); their masters, analysis,
provenance and section evidence are in `out/v1`–`out/v4` and regenerate deterministically.
