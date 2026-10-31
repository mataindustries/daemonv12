# LOWRIDER//2099 music: v1 audit and the v2 candidates (GATE 01)

**Listen:** [`review/music/crest.mp3`](../review/music/crest.mp3) and
[`review/music/hover.mp3`](../review/music/hover.mp3). Each is 25.0 s: 10 bars at 96 BPM in F minor,
mastered as 320 kbps MP3 and 24-bit WAV.
The approved v1 masters are untouched in [`experiments/lowrider-2099/audio`](../../../experiments/lowrider-2099/audio).

> **Nobody has listened to v2, including the producer, who cannot hear audio.** Every claim
> below is a design intention or a measurement. Measurements catch faults (clipping, masking,
> mono loss, phone translation, lost punch). They do not show that a record is infectious, and
> that is what the selection listen decides.

## Audit of v1: what the measurements said

| v1 problem | Evidence |
|---|---|
| Nearly mono | Side/mid −17 dB at 600 Hz–2.5 kHz, −14 dB at 2.5–8 kHz; L/R correlation 0.99 |
| Dark, little detail | 1.1% of energy above 8 kHz; spectral centroid 408 Hz |
| Quiet, with no real mastering | −11.8 LUFS from a tanh soft clip; the engine has no limiter |
| B delayed its own impact | No low end for the first 5 s |
| Hook head, identity | A 4-semitone scoop, then a plain falling triad. The weakest part of the first two seconds |
| No moment you replay for | A and B each had a stop or a tape stop, nothing a conventional beat couldn't do |

## What changed, ranked by expected impact

1. **One spectacular moment per candidate, only possible with the MORPH models:**
   - **CREST: the Mouth Drop.** Bar 6 of the finished beat (every track) is rendered and fed through
     the MORPH//03 Kelly–Lochbaum vocal tract. The mouth is open on "ah", then rounds to "oh" and "oo"
     while it grows to giant size, and seals on "mm" so only a nasal thump comes through the cheeks.
     Then silence, a reversed breath, and the slam. Measured: bar 6 starts at bar 5's level, the mids
     fall about 30 dB into the seal while the body stays, then true silence (−101 dB) and the breath.
   - **HOVER: the hover spin-up.** The Wobble Beast's bowed cable winds from countable pulses
     (a ratchet) into an F3 tone over two bars, with its mouth opening as it arrives, over a
     snare build. Then a hydraulic pssht, an eighth of nothing, and the slam into a half-time
     version of A's swung bounce.
2. **The talking 808.** A distorted 808 is the vocal tract's source, so the bass line itself says "WAAH-OW"
   (CREST bar 8) or "WOOOW" (HOVER's drop), with its own sub kept dry below 110 Hz.
3. **Hook identity in two seconds.** The first note is now a full-octave whoop (C5→C6), and on bar 1
   the band hits the 3+3+2 tresillo with the lead (kick and 808 on steps 0, 3 and 6). The
   approved melody, talkbox answer and shrink are unchanged.
4. **Harder drums, groove kept.** A layered, denser kick (knock, punch body, beater). Claps with a
   2.6 kHz crack; snares and hats with decorrelated stereo tails. The swing stays at 58%.
5. **808 attitude.** A faster, deeper pitch punch, harder drive, and a folded 0.5–2.5 kHz rasp
   for phones. Dive-ins from a fifth below, octave drops, a tape-stop dive.
6. **Stereo, top end, mastering.** A mono-anchored stereo lead double with an octave whistle,
   wide keys, a +2.5 dB air shelf. A real mastering chain: lows mono below 120 Hz, a 4×
   oversampled soft clip, then the MORPH look-ahead true-peak limiter. The target was chosen
   from a measured trade-off table, not set in advance.

## The candidates

| | **CREST** | **HOVER** |
|---|---|---|
| Idea | A's bounce, swallowed, then a swung takeover | B's aggression from the first beat, then a hover spin-up into a half-time bounce |
| 1–2 | Hook: octave whoop, band tresillo, talkbox ooh-WEE / the shrink | Hook over dirty 808 and snare+clap, talkbox answers |
| 3–4 | **Verse pocket**: no lead; rim, 808 walk-up, a talkbox wa-wa fill, hydraulic hop | **Beast pocket**: no lead; the 808 calls, the Beast answers |
| 5 | Hook head | Hook head; the 808 dives out |
| 6 | **THE MOUTH DROP** | **Hover spin-up** (5–6) under a snare build; an eighth of silence |
| 7–8 | Slam. Dirty 808 calls, the Beast and the talking 808 answer, the hook on top | Slam + talking-808 WOOOW. **Half-time**, A's swing, long sliding 808, hook |
| 9–10 | **Pocket**: no lead, Beast answers, hat roll, hop into the loop | **Pocket**: no lead, Beast answers, keys; tape-stop dive into the loop |

## Measurements: v1 against v2

From `qa/compare.py`. Every column is measured on the final master with the same tool and rules.
(`review/music/compare.json`)

| Metric | A v1 | B v1 | CREST v2 | HOVER v2 |
|---|---|---|---|---|
| Integrated loudness (LUFS) | −11.8 | −12.7 | −11.4 | −11.8 |
| Sample peak (dBFS) / full-scale samples | −1.57 / 0 | −1.52 / 0 | −1.30 / 0 | −1.30 / 0 |
| Kick punch, median / worst (dB) | 14.3 / 9.9 | 21.3 / 10.6 | **21.5** / 9.7 | 15.8 / 8.9 |
| Side/mid 2.5–8 kHz (dB) | −14.4 | −24.3 | **−7.4** | **−8.6** |
| Side/mid 600 Hz–2.5 kHz (dB) | −17.0 | −18.8 | −14.4 | −14.4 |
| Energy above 8 kHz / centroid | 1.11% / 408 Hz | 1.57% / 655 Hz | **2.39% / 514 Hz** | **2.37% / 523 Hz** |
| Mono fold-down | −0.04 LU | −0.02 LU | −0.35 LU | −0.35 LU |
| Mono loss by band | ≤ 0.35 dB | ≤ 0.06 dB | ≤ 0.14 dB below 2 kHz; −2.6 dB at 8–16 kHz | same |
| 808 on a phone, 250 Hz–2 kHz (median / worst 10%) | −3.9 / −9.6 dB | −5.4 / −8.9 dB | −4.8 / −12.7 dB | **−2.9** / −12.1 dB |
| Master: soft clip / limiter | none / none | none / none | 4.4 dB on 1.1% of samples / 1.6 dB | 4.2 dB on 0.9% / 1.4 dB |

Rows that did not improve, or got worse:

- **The 808 on a phone at its worst moments.** In 90% of the windows where it sounds, the 808 is
  as clear as in v1, or clearer for HOVER. Its worst 10% are now about 3 dB worse. Measured
  culprits: the octave whoop and the hook's held notes (C5–C6 runs through the band where the
  808's phone harmonics live), and in HOVER bar 5 the 808 deliberately diving out of range under
  the spin-up. I kept the hook on top on purpose. If the 808 must survive phones even under the
  whoop, the fix is a short sidechain-style dip in the lead's 500 Hz–1 kHz range. The engine
  can't do that per band.
- **Loudness** rose only about 0.5 LU. Pushing to −10 LUFS needed 5+ dB of clipping on 3% of samples
  (the trade-off table is in `master.mjs`), and that trades impact for level. The directive says
  impact wins.
- **The top octave is wide** (−2.6 dB lost in mono at 8–16 kHz). The stereo hats are decorrelated by
  design. Everything below 2 kHz is mono-safe.
- **HOVER's kick punch** (15.8 dB) sits below CREST's: its half-time drop is denser.

## Rebuild

```sh
productions/lowrider-2099/music/v2/make.sh        # ~4 min: sounds, Mouth Drop, render, master, QA
python3 -I productions/lowrider-2099/qa/compare.py # the table above
```

| File | What |
|---|---|
| `v2/sounds.mjs` | v2 instruments, talking 808, Mouth Drop, hover spin-up, WAV I/O |
| `v2/build-assets.mjs` | Renders `v2/assets/` (kits + MANIFEST with hashes) |
| `v2/arrange.mjs` | Both candidates as DaemonV12 projects, plus the CREST pre-pass |
| `v2/build-mouth.mjs` | Mouth Drop pass 2: pre-pass bar 6 → vocal tract → `assets/mouth/` |
| `v2/master.mjs` | Air shelf, mono lows, oversampled soft clip, true-peak limiter; MP3 |
| `v2/crest.json`, `v2/hover.json` | The projects (render with `bin/daemonv12.js`) |

The engine renders every note. The mastering chain and the Mouth Drop's vocal-tract pass run
offline in this folder, from the vendored MORPH DSP. The v1 instruments, talkbox, Beast and timing
helpers are imported unchanged from `experiments/lowrider-2099`.
