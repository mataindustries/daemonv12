# DaemonV12 — MORPH//04: CABLE//BEAST, Phase 1 (the drum experiment)

The MORPH//03 Cable Bass riff in two contrasting 8-second drum arrangements. Both are 4 bars
at 120 BPM in E Phrygian, loop seamlessly and are mastered to the same loudness as MORPH//03
(−13.9 LUFS, true peak ≤ −1.4 dBTP). Phase 1 ends here, at the human checkpoint: no full
track has been composed yet.

MORPH//01–03 are unchanged. This folder imports the MORPH//03 cable model, DSP kit and
household kit read-only (`../morph-03/`) and adds only percussion and arrangement code. The
DaemonV12 engine is untouched.

> **Nobody has listened to these yet.** I can't hear audio in the environment that made
> them. Everything claimed is measured or designed; the musical verdict is yours. See
> [REVIEW.md](REVIEW.md).

## Listen (Android: tap a link)

| Arrangement | 8 s MP3 | ×4 MP3 (32 s) | WAV master | Event map |
|---|---|---|---|---|
| A — HEAVY | [mp3](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-04-cable-beast/experiments/morph-04/audio/morph04-a-heavy.mp3) | [×4](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-04-cable-beast/experiments/morph-04/audio/morph04-a-heavy.x4.mp3) | [wav](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-04-cable-beast/experiments/morph-04/audio/morph04-a-heavy.wav) | [events](audio/events/morph04-a-heavy.md) |
| B — BREAKS | [mp3](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-04-cable-beast/experiments/morph-04/audio/morph04-b-breaks.mp3) | [×4](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-04-cable-beast/experiments/morph-04/audio/morph04-b-breaks.x4.mp3) | [wav](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-04-cable-beast/experiments/morph-04/audio/morph04-b-breaks.wav) | [events](audio/events/morph04-b-breaks.md) |
| ref: MORPH//03 Cable Bass (solo) | [mp3](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-03-cable-breaks/experiments/morph-03/audio/morph03-1-cable-bass.mp3) | [×4](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-03-cable-breaks/experiments/morph-03/audio/morph03-1-cable-bass.x4.mp3) | | |

- **Loop gaps:** the WAVs loop sample-seamlessly. MP3 padding can leave a small gap at a
  phone player's loop point, so use the ×4 files to judge replay value.
- **Stems:** 24-bit FLAC in [`audio/stems/`](audio/stems). They sum exactly to `premaster`,
  the dry mix before bus EQ, glue compression and mastering; `stems.json` gives the gain
  back to master level.

## A — HEAVY

A half-time groove: the snare lands on beat 3, every kick sits on a slap or in a bass rest,
and the cable decides where the music stops.

| Time | What happens |
|---|---|
| 0.0 s | Kick and SLAP together. The slap's tension dive starts about 5 semitones sharp and falls into E1; then a ghost and an octave POP. |
| 0.625 s | A kick alone in the bass's rest (bass and kick hocket); the G "ow" vowel follows. |
| 1.0 s | Half-time snare. A 16th later the cable SLAPS back, then the F→E bend. |
| 2.0 s | Answer: the biggest slap, a POP, and the G re-tensions abruptly to Bb. |
| **3.0 s** | **The choke:** the snare hits, and 70 ms later the hand grabs the cable while the drums and room are gated shut. The loop drops 54 dB for 0.43 s. |
| 3.5 s | The cable re-enters alone: a twelfth pop, then a 32nd-note run into bar 3. |
| 4.0 s | The statement again, heavier: cable ticks enter and the kicks shift. |
| 5.375 s | A stop-time hiccup: a kick cut off after 40 ms, then 80 ms of silence before the B. |
| 6.0 s | The answer again. |
| 7.0 s | The snare, then a twelfth pop a 16th later. |
| 7.25 s | The drums drop out under a bowed "aa" growl. |
| 7.5 s | SNAP: a snare with the cable inside it. The tension collapses into a 16th-note ratchet of reflections, a second cable answers on the right, and the loop turns over. |

## B — BREAKS (the cable clocks the break)

A straight-16th breakbeat with ghost notes, whose time is bent by the cable's tension.

| Time | What happens |
|---|---|
| 0–2 s | The cable is slack, with a dotted-eighth round trip, so its descending laser-chirp reflections land every 3rd 16th: 3 against the break's 4. The ticks' accents follow the cable's own reflections (their velocity is read from its envelope), so they drift slightly ahead of the grid as dispersion speeds up each chirp's top. |
| **2.0 s** | **The wind-up:** a kick and snare are hit once, then repeated once per round trip of the cable as the hand winds it tight. The cable is re-struck in unison. The repeats pass through dotted eighths, eighths, 16ths and 32nds (375 → 255 → 126 → 78 → 56 → 43 → 35 → 29 → 25 ms) until the drum roll fuses into a 41 Hz tone: the cable's E1. |
| 3.0 s | A press CLANK lands it. The bowed cable talks in triplets, then a 32nd-note stutter with snare ghosts. |
| 4.0 s | The riff. Cable toms walk down E Phrygian (E3 D3 C3 B2 A2 G2 F2) only in the riff's gaps; the last, F2, lands a 16th before the cable's E twelfth pop. The ticks accent every 5th 16th: 5 against 4. |
| 5.56 s | The B answers the backbeat snare a 32nd late. |
| 7.25 s | A bowed growl. |
| **7.5 s** | **SNAP:** a crack and a toaster spring, repeated once per round trip of the releasing cable: a pitched buzz that slows (24 → 28 → 33 → 41 → 52 → 71 → 108 → 144 ms) back into rhythm, into the slack bar 1. |

## Percussion (`kit.mjs`): struck physical objects

| Sound | Model |
|---|---|
| Kick | Circular membrane modes (Bessel ratios) whose tension rises with displacement: the pitch starts 12–14 semitones high and drops as the skin's swing decays. Beater click plus the head's dense upper modes, which are what a phone hears. |
| Snare | A tighter membrane whose bottom head slaps the snare wires (one-sided contact: the wires rattle when the head swings away). Optional struck-cable "crack" layer: the cable's laser chirp inside the snare. |
| Cable tom | A short slapped Tempo String. The strike's tension spike makes the pitch dive about 4 semitones into the note. |
| Cable tick | A tiny, very tight cable flicked hard: an inharmonic metallic tick. |
| Household (B) | MORPH//02 B's toaster spring (a dispersive spring), alarm-bell hats and hydraulic-press clank. |

The bass is the MORPH//03 cable played from a score (`perform.mjs`). It adds the hand
**grab**, which stops the cable dead, and a tension **ratchet**, which repeats any captured
sound once per round trip of the cable.

## Reproduce

From the repository root, on Node ≥ 22.18 (rendered on v22.22.0, linux-x64). FFmpeg is
needed for MP3 and FLAC.

```sh
node experiments/morph-04/build.mjs --stems            # both -> experiments/morph-04/audio/
node experiments/morph-04/build.mjs b                  # one arrangement, no stems
pip install numpy scipy matplotlib                     # analysis only
python3 experiments/morph-04/checks.py experiments/morph-04/audio experiments/morph-04/audio/checks.json
python3 experiments/morph-03/analyze.py experiments/morph-04/audio/analysis.json experiments/morph-04/audio/morph04-*.wav --png experiments/morph-04/audio/spectrograms
```

- **Determinism:** re-renders are byte-identical on the same runtime. Hashes are in
  `audio/*.meta.json`.
- **Automation:** every lane that shaped the cable (tension/period, dispersion, damping,
  gain, bow, buzz, harmonic touches, gates) is sampled at 100 Hz into `audio/automation/`.
- **Event maps:** `audio/events/*.md` and `.json` list every scheduled event with its exact
  time, bar.beat.16th position, pitch and velocity. They are generated from the arrays the
  render reads, including each ratchet repeat's length.
