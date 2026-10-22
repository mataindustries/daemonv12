# DaemonV12 — MORPH//05: CABLE//BEAST, the first record

A 28-second experimental electronic record built from the approved MORPH//03 and MORPH//04
discoveries. One physical Tempo String plays the whole piece, the Wobble Beast answers it,
and the MORPH//04 physical percussion plays around them. Hybrid direction: HEAVY is the
anchor, and BREAKS supplies the mutations and transitions.

- **Format:** 120 BPM, 4/4, 14 bars, E Phrygian; 28 s = **1,234,800 frames** at 44.1 kHz =
  **1,680 frames** at 60 fps.
- **Versions:** three full-length versions are kept (V1, V2, V3); V3 is the current final.
- **Unchanged:** MORPH//01–04 and the DaemonV12 engine. This folder imports the earlier
  instruments read-only.

> **Nobody has listened to this yet.** I can't hear audio in the environment that made it.
> Every claim is a measurement, a score reading or a design intention, and human listening
> decides. See [REVIEW.md](REVIEW.md) for the revision log and the evidence.

## Listen (Android: tap a link)

| Version | MP3 (256 kbps) | What changed |
|---|---|---|
| **V3** (final candidate) | [cable-beast-v3.mp3](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-05-first-record/experiments/morph-05/audio/v3/cable-beast-v3.mp3) | Production: tamed Beast bursts, payoff downbeat cleared, wider Beast, clearer energy arc |
| V2 | [cable-beast-v2.mp3](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-05-first-record/experiments/morph-05/audio/v2/cable-beast-v2.mp3) | Musical: dead air removed, the Beast's voice collapses and is wound up, compressed third wind-up |
| V1 | [cable-beast-v1.mp3](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-05-first-record/experiments/morph-05/audio/v1/cable-beast-v1.mp3) | The complete arc |

- **Final WAV (24-bit):**
  [cable-beast-v3.wav](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-05-first-record/experiments/morph-05/audio/v3/cable-beast-v3.wav)
- **Stems:** 24-bit FLAC, aligned from frame 0, each exactly 1,234,800 frames, in
  [`audio/v3/stems/`](audio/v3/stems).
- **Event map:** [`audio/v3/cable-beast-v3.events.md`](audio/v3/cable-beast-v3.events.md)
  and `.events.json`.

## The record

**Thesis**
- **Hook:** the CABLE CALL. SLAP (pitch dive) · ghost · octave POP · G "ow", answered by
  an F~E bend. It is one gesture made only of the cable's physical articulations, and the
  Beast learns to sing it.
- **Rhythm:** HEAVY's half-time weight anchors it; BREAKS' cable-clocked time mutates it.
- **Low end:** the cable's E1 owns the sub. The membrane kick lands on slaps or in the gaps,
  and the sub ducks under it.
- **Contrast:** an exposed call, a heavy groove, a break, a conversation, then a choke and a
  sung solo.
- **Payoff:** cable and Beast, who only answered each other until then, share the hook and
  then play it as one voice.
- **Ending:** the hook is cut off by the SNAP, and its reflections lead back to the opening slap.

| Time | Bar | 60 fps frame | Section | What happens |
|---|---|---:|---|---|
| 0.0 s | 1 | 0 | **I. The call** | The hook alone, with no kick under the first slap. At 1.5 s the cable lets go and its reflections chirp. |
| 2.0 s | 2 | 120 | The call, grounded | Hook again, with kick and fast cable ticks, and a 32nd run into the groove. |
| 4.0 s | 3 | 240 | **II. Heavy** | MORPH//04 A: half-time snare, with the slap answering it a 16th late. |
| 6.5 s | 4 | 390 | The Beast answers | It imitates the hook with its mouth (WOM · ka · YOI · OW). A break-snare pickup follows. |
| 8.0 s | 5 | 480 | **III. Breaks** | The cable snaps slack: chirps every 3rd 16th against the break, ticks accented by the cable. |
| 10.0 s | 6 | 600 | Wind-up 1 | The drums repeat once per cable round trip as it winds: 375 → 255 → 126 → 78 ms … until they become a 41 Hz tone. A clank lands it; bowed triplet talk and a stutter follow. |
| 12.0 s | 7 | 720 | **IV. Call and response** | No snare. The cable calls (bars 7–8, angrier the second time, with a tritone); the Beast answers (wa-wa-YOW, then ya-ya-ya and the EEE-YOOW dive). |
| 16.0 s | 9 | 960 | **V. The choke** | Heavy statement; the snare at 17.0 s, then everything stops (17.07–17.5 s). |
| 17.5 s | 9 | 1050 | Beast solo | The hook sung slowly and unaccompanied. Its last note collapses into creak. |
| 19.0 s | 10 | 1140 | Wind-up 2 | The creak is wound back into pitch together with the cable and the ratcheting drums. |
| 20.0 s | 11 | 1200 | **VI. Payoff** | Heavy plus break complexity. Cable and Beast trade the hook (hocket), a second cable chirps 3 against 4 on the right, and cable toms walk down the scale. |
| 23.5 s | 12 | 1410 | Wind-up 3 | Snap and wind compressed into one beat. |
| 24.0 s | 13 | 1440 | Unison | Cable and Beast play the whole hook as one voice. |
| 26.0 s | 14 | 1560 | **VII. The snap** | The hook starts and is cut off at 26.5 s. The break slows with the releasing cable, and quarter-note reflections lead back to the opening. |

**Where it departs from the suggested structure, and why:**
- **Wind-up appears three times.** It is the record's transition motif: full length at 10 s,
  carrying the Beast at 19 s, and compressed into one beat at 23.5 s. The listener learns it
  first, so the later appearances read as development rather than new material.
- **No snare in the call-and-response (12–16 s).** The Beast answers into space, and the
  backbeat's return at 16 s makes the choke statement land.
- **Solo directly after the choke.** It sings the hook itself, so the "unexpected solo
  gesture" is also the hook's first transformation into a voice.
- **Hook cut off by the final snap.** Replaying the record completes it.

## DaemonV12 integration

The record is mastered from an external DSP render (Node, `record.mjs`). The cable, the Beast
and the cable-clocked ratchets are physical models whose state changes continuously, so
DaemonV12's sampler cannot reproduce them. They are **not** DaemonV12 instruments.
Everything that the sampler can play faithfully is played by it:

| In the DaemonV12 project ([`daemonv12/project/cable-beast.daemonv12.json`](daemonv12/project/cable-beast.daemonv12.json)) | How |
|---|---|
| Kick, snares and ghosts, toaster spring, cable toms, cable ticks (8-sample round-robin), alarm bells, press clank | **Native drum-kit notes**: 182 hits at exact 960-PPQ positions with velocities. Mix rides and the choke are track gain automation. The one-shots are rendered by the MORPH//04 kit into the project's kits. |
| Cable, Beast, partner cable, ratchets, four rooms | **External render**: aligned 28 s stems (frame 0), one sampler voice each, labeled as external in the project. |

**Results** ([`daemonv12/results/`](daemonv12/results)):
- **Timing:** all 182 native hits land on the external render's sample frames (0 frames
  different).
- **Native tracks:** they null against the external stems to −58 to −74 dB. The snare
  reaches −69 dB outside the choke's 6 ms fade; inside that fade, the engine's linear-dB
  gain ramp and the external smoothstep differ.
- **Whole pre-master mix:** the DaemonV12 render (unity master) reproduces the external
  pre-master mix to −61 dB, or −50 dB including the fade.
- **Mastering stays external:** bus EQ, glue compression, loudness gain, knee soft clip and
  the true-peak limiter have no DaemonV12 equivalent.
- **Engine timing:** every one of the record's 341 on-grid events was checked against
  DaemonV12's own `ticksToFrames` (0 mismatches). 14 bars resolve to exactly 1,234,800 frames.

## Files

- **Score:**
  - `v1.mjs` is the complete arrangement.
  - `v2.mjs` and `v3.mjs` are V1 plus documented edits; each exports `CHANGES`.
- **Renderer and instruments:**
  - `record.mjs` is the renderer.
  - `beast.mjs` is the MORPH//03 Wobble Beast, made playable from phrases.
- **Per version** (`audio/vN/`):
  - MP3 and `.meta.json` (WAV SHA-256 and mastering figures);
  - `.automation.json` (every lane at 100 Hz);
  - `.events.json` / `.md` (sample frame, 60 fps frame, 960-PPQ tick, position, pitch,
    velocity);
  - `.checks.json` (measurements).
  - V3 also has the WAV master and `stems/`.
  - V1 and V2 WAVs are reproducible from source and not committed; their hashes are in
    `MANIFEST.json`.
- **Analysis tools:** `checks.py` (section, interplay and translation proxies);
  `audio/spectrograms/`.
- **`MANIFEST.json`:** source and artifact SHA-256s, tool versions, determinism checks.

### Event timing for film

| Field | Meaning |
|---|---|
| `sampleFrame` | Authoritative: nearest frame, ties later, the DaemonV12 rule. At 120 BPM a 16th is 5,512.5 frames, so odd 16ths round up. |
| `frame60` | `floor(sampleFrame × 60 / 44100)`: the picture frame on screen when the event sounds. Odd 16ths fall halfway between picture frames, and floor puts them on the earlier one. |
| `tick` | 960 PPQ, present for events on the engine grid. |

Ratchet repeats and wind strikes follow the cable's physics, are off that grid, and carry
exact sample frames.

## Reproduce

From the repository root, on Node ≥ 22.18 (rendered on v22.22.0, linux-x64), with FFmpeg 6.1.1:

```sh
npm ci                                                       # dev tools; builds dist/ (DaemonV12 CLI, timing)
node experiments/morph-05/build.mjs v1 v2                    # listening copies, automation, events
node experiments/morph-05/build.mjs v3 --stems               # final: WAV, MP3, stems
pip install numpy scipy matplotlib                           # analysis only
python3 experiments/morph-05/checks.py experiments/morph-05/audio/v3 experiments/morph-05/audio/v3/cable-beast-v3.checks.json --png experiments/morph-05/audio/spectrograms
node experiments/morph-05/daemonv12/export.mjs experiments/morph-05/daemonv12/project
node bin/daemonv12.js render experiments/morph-05/daemonv12/project/cable-beast.daemonv12.json --out-dir OUT --stems --format wav --json
python3 experiments/morph-05/daemonv12/nulltest.py experiments/morph-05/daemonv12/project OUT experiments/morph-05/daemonv12/results/null-test.json
node experiments/morph-05/manifest.mjs
```

Renders are deterministic on the same runtime:
- **External:** V3's master and all 14 stems were byte-identical on a second render.
- **V1:** its hash was unchanged across renderer revisions.
- **DaemonV12:** its master and 13 stems were byte-identical on a second render.
