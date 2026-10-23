# DaemonV12 — MORPH//06: CABLE//BEAST, the overload (alternate mixes)

Three controlled alternates of the MORPH//05 record, built from the approved V3 and judged
against it.
- **A — the gasp:** 125 ms of silence before the payoff.
- **B — the overload:** A plus a redesigned final four seconds that escalates and cuts to
  digital silence at 27.600 s.
- **C — the longer gasp:** B with 250 ms of silence before the payoff.

The approved V3 master and every earlier version are unchanged on `feat/morph-05-first-record`.

> **Nobody has listened to these.** I can't hear audio in the environment that made them.
> The tables below are measurements, labelled as such; whether the gasp lands and whether the
> overload improves the record is for human listening to decide.

## Which render is "version C"?

- **The page has no "C".** The listening page
  ([artifact](https://claude.ai/artifact/YVW58G2kPPWjvr67vyP3c8)) labels its versions V1, V2
  and V3, in that order, so C is read as the third, **V3**. The brief's "use the existing V3
  arrangement" agrees.
- **Hashes match:** the page's V3 MP3 is byte-identical (SHA-256 `04e1526b…`) to
  `experiments/morph-05/audio/v3/cable-beast-v3.mp3` at commit `56f013be2ffa279bc191ce925451454b775a7e34`,
  rendered from the WAV `a1c07efb…`. This branch starts from that commit.
- **Renderer control** (`control.mjs`): `record.mjs` and `beast.mjs` here are MORPH//05's
  renderer and Beast plus three features: silence windows, an "overwind" cable state and
  pinned levels (below). Rendering the unchanged V3 score with them gives `a1c07efb…` again,
  bit-identical, both as is and with V3's own levels pinned. A, B and C therefore differ
  from V3 only by their documented edits.
- **Pinned levels:** MORPH//05 normalises the Beast (twice inside the model, and its crest
  threshold), the second cable and the bass, each to its own peak or RMS over the whole record.
  - **The problem:** a louder phrase in the last four seconds then changes the level and drive
    of everything before it. An earlier B render made the Beast 5.6 dB quieter and cleaner
    from its first note (see REVIEW).
  - **The fix:** A, B and C pin all seven references to the values V3's own render measured
    (`v3-levels.json`).
  - **Result:** before the gasp edit, every stem of A, B and C matches V3 to within 24-bit
    quantisation.

## Listen (Android: tap a link)

| Version | MP3 | WAV (24-bit) |
|---|---|---|
| V3 (reference, unchanged) | [mp3](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-05-first-record/experiments/morph-05/audio/v3/cable-beast-v3.mp3) | [wav](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-05-first-record/experiments/morph-05/audio/v3/cable-beast-v3.wav) |
| **A — the gasp** | [mp3](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-06-overload/experiments/morph-06/audio/a/cable-beast-a.mp3) | [wav](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-06-overload/experiments/morph-06/audio/a/cable-beast-a.wav) |
| **B — the overload** | [mp3](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-06-overload/experiments/morph-06/audio/b/cable-beast-b.mp3) | [wav](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-06-overload/experiments/morph-06/audio/b/cable-beast-b.wav) |
| **C — the longer gasp** | [mp3](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-06-overload/experiments/morph-06/audio/c/cable-beast-c.mp3) | [wav](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-06-overload/experiments/morph-06/audio/c/cable-beast-c.wav) |

**Places to compare:**
- **The gasp:** listen from 19.0 s.
- **The ending:** listen from 24.0 s.
- **Loudness:** all four masters are matched to −14.0 LUFS integrated (FFmpeg).

## What changed, exactly

Every changed event, with sample and 60 fps frames, is in
[`audio/EVENT-CHANGES.md`](audio/EVENT-CHANGES.md). Each version's full event map is in
`audio/<v>/cable-beast-<v>.events.json` and `.md`.

**A — the gasp** (`a.mjs`; the ending is V3's, untouched):
- **The silence:** every instrument, room and echo fades out over 4 ms (raised cosine) ending
  at 19.875 s, then is exactly zero from frame 876,488 to 881,999 (125 ms; picture frames
  1192–1199).
- **The payoff downbeat:** stays on 20.000 s (frame 882,000, picture frame 1200).
  Instruments return with a 0.3 ms guard; rooms fade back in over 30 ms.
- **Wind-up 2:** it now completes at 19.875 s. It is the same accelerando (dotted eighth to
  E1) on a curve 12.5% shorter, with 7 drum repeats (375 → 227 → 103 → 64 → 46 → 35 → 26 ms).
  - V3 had 9 repeats; its last was cut short by the downbeat.
  - Muting V3 as it was would have deleted its last 4 repeats, the fastest ones, where the
    drums fuse into the cable's pitch.
- **Cable and Beast:** the hand holds the cable through the gasp, so the payoff slap restarts
  it from rest. The Beast lets go a 32nd before the gasp.

**B — the overload** (`b.mjs`): A's gasp, then only the final four seconds (24.0–28.0 s) rewritten:

| Time | What happens |
|---|---|
| 24.0–25.5 s | The unison hook, as V3 (cable and Beast unchanged). From 25.0 s the ticks double to 32nds; a kick at 25.125 s and ghost snares at 25.375 and 25.4375 s lead into the climb. |
| 25.5–26.0 s | V3's 16th run becomes slap-pop pairs in 32nds, climbing E-G-A-B. The Beast answers in triplets and chokes. Snare roll harder, ticks in 32nds, the second cable cracks on the right. |
| 26.0–26.5 s | The hook's head (slap, ghost, pop) as V3; the Beast sings WOM, ka, YOI with it, at V3's level. |
| 26.5–27.0 s | V3 snapped here. Now the big snare hits but **the cable does not snap**: the hook's head again in 8ths, climbing, against a 16th Beast hocket (ka-YOI). |
| 27.0–27.6 s | **Overwind.** The cable is wound past its note, from G1 toward E3: its pitch measures 56 → 87 → 124 Hz across 27.2–27.5 s, and it is re-struck every round trip, brighter and more dispersive. The drums ratchet with it into a rising metallic buzz. The Beast chokes in quintuplets climbing E2-B2, screams toward E3 and breaks (beat-repeat + crush at 27.525 s). Kicks go from quarters to 16ths to 32nds, getting lighter as they multiply; a 32nd snare roll; toms walk **up** F2-A3 (the payoff walked down); alarm bells and clanks. |
| 27.600 s | Everything fades out over 4 ms and is exactly zero from frame 1,217,160 (picture frame 1656) to the end (1,234,800 frames, picture frame 1680). |

How the overload stays a mix rather than a wall of limiting:
- **Rides:**
  - The drums ride down 2–3 dB as they multiply, and the cable rides up 3.5 dB.
  - The Beast keeps V3's level through the unison. Its new overload phrases sing hotter than
    V3's, so they ride lower from 25.5 s: −1 dB, then +1 dB on the hook's head (V3's level
    there), then down to −6/−7 dB in the overwind.
  - Cable and Beast then meet within a few dB of each other, trading the lead.
- **Trim:** the whole overload is trimmed 2 dB (26.0–26.5 s onward), so loudness matching does
  not push the first 24 seconds down.

**C — the longer gasp** (`c.mjs`): B, with the silence from 19.750 s (frames 870,975–881,999,
250 ms, picture frames 1185–1199). The wind-up completes at 19.750 s on a curve 25% shorter,
in 6 repeats; the last is cut at a 20 ms round trip.

## Measured comparison

| | V3 | A | B | C |
|---|---:|---:|---:|---:|
| Integrated loudness / true peak | −14.0 LUFS / −1.4 dBTP | −14.0 / −1.4 | −14.0 / −1.4 | −14.0 / −1.4 |
| Samples at full scale | 0 | 0 | 0 | 0 |
| Limiter max / master soft clip max | 1.37 / 2.97 dB | 1.37 / 2.94 | 1.28 / 2.76 | 1.30 / 2.83 |
| Most the master holds back in any 0.5 s of the last 4 s | 3.1 dB | 2.9 dB | 3.8 dB | 3.9 dB |
| Stems before the gasp edit vs V3 (after the shared export gain) | — | bit-identical to 18.7 s | −88 dB (24-bit quantisation) to 18.7 s | −88 dB to 18.6 s |
| Planned silences exactly zero | — | yes (5,512 samples) | yes (5,512 + 17,640) | yes (11,025 + 17,640) |
| Largest step at a fade-out vs music before it | — | 0.03× | 0.03×, 0.09× | 0.06×, 0.08× |
| Largest step at the payoff onset vs music after it | 3.7× (V3's own attack) | 3.9× | 3.9× | 2.4× |
| Cable slap over everything else at 20.000 s (300 Hz–4 kHz, 60 ms) | −0.7 dB | +1.4 dB | +1.4 dB | +2.8 dB |
| Kick over bass sub at 20.000 s (50 ms) | 14.2 dB | 24.6 dB | 24.6 dB | 24.4 dB |
| Payoff downbeat crest (15 ms) | 8.0 dB | 7.5 dB | 7.6 dB | 7.3 dB |
| Level: approach (19.0–19.75 s) / payoff (20–23.5 s) | −14.8 / −13.3 | −14.4 / −13.2 | −14.6 / −13.4 | −14.1 / −13.3 |
| Level of the last 4 s | −13.2 | −13.2 | −12.0 | −12.1 |

- **Click checks:** the step ratios compare the largest sample-to-sample step at an edge with
  the largest in the neighbouring 100 ms of music.
  - At the fade-outs the edge is far below the music (no click).
  - At the payoff the edge step is the payoff's own attack, in line with V3's 3.7×.
- **Payoff arrival after silence:**
  - The slap stands 2–3.5 dB clearer, and the kick owns the sub by 10 dB more, because the
    cable restarts from rest.
  - The downbeat's 15 ms crest is 0.4–0.7 dB lower than V3's (less spiky, not louder).
- **The record before the ending:** with loudness matched, B and C play the approach and the
  payoff within 0.7 dB of V3 (the 2 dB trim on the overload keeps it from pulling them down).
- **Ratios:** levels are K-weighted dB (LUFS-like) per window. Step ratios compare
  sample-to-sample steps, and 1× would mean an edge as sharp as the music's sharpest.

**The last four seconds, every 0.5 s** (level / spectral centroid / spectral flux):

| From | V3 | A | B | C |
|---|---|---|---|---|
| 24.0 s | −11.0 / 3651 Hz / 62 | −11.0 / 3664 / 63 | −11.1 / 3666 / 62 | −11.2 / 3692 / 61 |
| 24.5 s | −12.6 / 2260 / 46 | −12.6 / 2267 / 46 | −12.8 / 2270 / 45 | −12.8 / 2284 / 45 |
| 25.0 s | −12.1 / 3547 / 46 | −12.2 / 3546 / 46 | −11.9 / 3959 / 52 | −11.8 / 3956 / 52 |
| 25.5 s | −12.5 / 3294 / 47 | −12.5 / 3312 / 48 | −10.9 / 4247 / 75 | −11.2 / 4274 / 70 |
| 26.0 s | −10.7 / 3658 / 65 | −10.7 / 3639 / 65 | −11.6 / 3859 / 60 | −11.7 / 3888 / 60 |
| 26.5 s | −13.8 / 4327 / 35 | −13.8 / 4340 / 35 | −12.4 / 4918 / 52 | −12.4 / 4932 / 52 |
| 27.0 s | −26.7 / 2174 / 13 | −26.8 / 2190 / 13 | −11.1 / 3920 / 73 | −11.1 / 3936 / 73 |
| 27.5 s | −32.9 (tail) | −33.0 (tail) | 0.1 s of music, then silence | same as B |

**The final 1.6 s in 0.2 s steps:**
- **V3** decays after its snap: −10.1 → −14.6 → −18.3 → −25 → −30.5.
- **B** keeps rising to the cut: −11.1, −11.6, −11.3, −12.0, (−15.1, a breath at 26.8 s),
  −11.3, −11.0, then **−10.2 in its last 0.2 s**, with flux 82. That last window is the
  loudest and busiest.
- **C** matches B to within 0.1 dB.
- **Cable and Beast in the overwind** (200 Hz–4 kHz, per 0.25 s from 27.0 s): the Beast is
  +2.2, −1.7, then +3.6 dB over the cable, trading the lead.
- **Overwind pitch:** the cable climbs from about 56 Hz at 27.2 s to 124 Hz at 27.5 s, toward
  E3 (165 Hz) at the cut.

## What the measurements can't tell

- **The gasp:** whether 125 or 250 ms reads as a breath that enlarges the arrival or as an
  interruption.
  - Measured: the arrival is clearer.
  - The wind-up has 7 (A, B) or 6 (C) repeats instead of V3's 9: the same curve, compressed
    rather than cut.
- **The overload:** whether it feels like a machine getting excited or like clutter.
- **The cut:** whether it feels like an interruption at the peak, and whether it makes you
  want the record again (it is not a loop).
- **The missing snap:** whether losing V3's snap and reflections ending costs too much.

## Files and reproduction

- **Scores:** `a.mjs`, `b.mjs`, `c.mjs` (each exports `CHANGES`); V3 is imported unchanged
  from `experiments/morph-05/v3.mjs`.
- **Renderer:** `record.mjs` and `beast.mjs` (copies with the three features; control-tested
  by `control.mjs`, which also writes `v3-levels.json`). The cable and kit are imported
  read-only from MORPH//03–04.
- **Per version** (`audio/<v>/`):
  - WAV and MP3;
  - `stems/` (24-bit FLAC, 14 files, aligned from frame 0, each exactly 1,234,800 frames;
    they sum to `premaster`);
  - automation at 100 Hz, including the `silence` and `mixTrimDb` lanes;
  - event map (sample frames, 60 fps frames, 960-PPQ ticks checked against DaemonV12's
    `ticksToFrames`: 0 mismatches);
  - `.meta.json` (WAV SHA-256 and mastering figures).
- **Comparison data:** `audio/comparison.json` (from `analyze06.py`); spectrograms in
  `audio/spectrograms/`, including `compare-gasp.png` and `compare-ending.png`.
- **Hashes:** `MANIFEST.json`.

```sh
npm ci   # builds dist/ (DaemonV12 timing functions used by the event-map check)
node experiments/morph-06/control.mjs          # V3 bit-identical, unpinned and pinned; writes v3-levels.json
node experiments/morph-06/build.mjs a b c --stems
python3 experiments/morph-06/spectrograms.py
python3 experiments/morph-06/analyze06.py experiments/morph-06/audio/comparison.json \
  v3=experiments/morph-05/audio/v3 a=experiments/morph-06/audio/a b=experiments/morph-06/audio/b c=experiments/morph-06/audio/c
python3 experiments/morph-06/event_changes.py experiments/morph-06/audio/EVENT-CHANGES.md experiments/morph-05/audio/v3/cable-beast-v3.events.json \
  a=experiments/morph-06/audio/a/cable-beast-a.events.json b=experiments/morph-06/audio/b/cable-beast-b.events.json c=experiments/morph-06/audio/c/cable-beast-c.events.json
node experiments/morph-06/manifest.mjs
```

On this runtime (Node v22.22.0, FFmpeg 6.1.1), second renders of A, B and C into a fresh
directory were byte-identical, masters and stems both.
