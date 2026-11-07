# THE IMPOSSIBLE STAIRWELL · Opus 5.5 candidate

ENM Studio composer challenge, Opus 5.5 High. This is **one finished candidate** for the ten-second surreal
architectural short: a seamless, rotating ascent through an infinite 1930s Art Deco stairwell.

> Isolated workspace. No DaemonV12 engine code, Signature Rack code, existing composition or film visual was
> modified. Every sound is synthesized by the existing hash-verified Signature Rack (the unmodified MUTATION 001
> engines). No SoundFont, no FluidR3, no recordings, no third-party samples. The composer is an AI agent and
> **cannot hear audio**: the musical descriptions below are design intent, and the numbers are measurements.

## Deliverables

| What | Path |
|---|---|
| **WAV master** (PCM24 stereo, 44,100 Hz, exactly 441,000 frames) | [`candidate/delivery/masters/stairwell.24.wav`](candidate/delivery/masters/stairwell.24.wav) |
| **Listening MP3** (192 kbps, encoded directly from the master) | [`candidate/delivery/listening/stairwell.24.mp3`](candidate/delivery/listening/stairwell.24.mp3) |
| **Repeated-playback MP3** (three sample-exact passes, 30 s) | [`candidate/qa/stairwell-loop-x3.mp3`](candidate/qa/stairwell-loop-x3.mp3) |
| **Aligned stems** (13 × PCM24, 441,000 frames each, frame 0 aligned) | [`candidate/delivery/stems/`](candidate/delivery/stems/) |
| **Editable DaemonV12 project** | [`candidate/delivery/source/stairwell.json`](candidate/delivery/source/stairwell.json) + `source/assets/` |
| **Editable musical source** (rack performance score and its authoring script) | [`score.json`](score.json), [`compose.ts`](compose.ts) (copies sealed in `delivery/source/`) |
| **Technical QA** | [`candidate/qa/QA.json`](candidate/qa/QA.json), [`spectrogram.png`](candidate/qa/spectrogram.png), [`waveform.png`](candidate/qa/waveform.png) |
| Provenance, analysis, inventory, hashes | `candidate/delivery/metadata/`, `candidate/delivery/SHA256SUMS` (55 files, exact set) |

Master SHA-256: `99f6c547c84d479189aa2ef020f3dc226fdef3508ac2c3fdf6b6d79d1f60b6c1`.

## What the footage shows

The one-second clip (`ENM_Stairwell_Checker_Smoke_1s.mp4`) is 1080×1920 vertical H.264 at 24 fps, with exactly
24 frames and no audio. I inspected it with the contact sheet (frames 1, 5, 9, 13, 17 and 21) and with extracted
frames.

- It is a top-down view into a **square** shaft. Landings nest toward a dark vanishing point, and every landing
  carries a **diamond-in-square inlay at each of its four corners**. Brass rails and warm amber sconces sit in deep
  shadow.
- The camera **rotates slowly clockwise and pushes inward** without a cut. A wall sconce enters at upper left during
  the second; the motion is even, mechanical and unhurried.
- Everything repeats with **fourfold symmetry**. One quarter-turn plus one landing deeper looks like the start again.

That symmetry became the musical form.

## The composition

**Clock:** 96 BPM and four bars of 4/4, which is 16 beats and exactly 10.000 s. That is 240 picture frames at
15 frames per beat, so each bar is 60 frames: one flight, or one side of the square.

**One idea that cannot end, the "Sigh of the Stair".** Each flight sings one four-note figure:

1. the held root;
2. a leap up a minor sixth, which sighs down a semitone onto the fifth;
3. a fall to the minor third.

That minor third **is** the next flight's root, so the voice holds it across the bar line while the building turns
underneath. The flights rise by minor thirds: **D minor → F minor → A♭ minor → B minor → D minor**. Those four roots
form one diminished-seventh chord, the harmonic shape of a square. After four flights you are an octave higher and
back where you started.

Two "witness" voices sing the figure in octaves as a Shepard pair: the upper one fades as it climbs and the lower one
grows. At the loop point the lower witness's D4 is handed to the upper witness's fresh D4, so the ascent never
resolves. The glass halo of every voice is tuned to the same diminished axis (D6 F6 G♯6 B6), so the stone
resonates on the axis the building turns around.

**The dialogue:**

- **Presences.** These are Impossible Voices at different apparent depths, each with its own tract size, detune,
  pan, room send and level. None of them sings words.
  - A near echo repeats the sigh while the witnesses hold the third.
  - A far echo answers an octave lower and later, as if from landings below.
  - A giant voice with undertones sings each flight's fifth.
  - Two murmuring crowds, hard left and right, sing seeded chord-tone fragments deep in the room.
- **Resonant stone.**
  - A friction-bowed bar sounds each flight's fifth with a twelfth-below subharmonic, re-bowed every flight, so it
    is never a static pad.
  - A warm sub floor drops *down* to A♭1 at the crest, so the ground falls away there.
- **The recurring mechanical gesture.**
  - An escapement ticks every beat (every 15 picture frames).
  - At the end of every flight, three rising hocketed strikes turn the key into the next chord and land on a bell at
    the next downbeat.
  - Tiny tuned bearings, like dust in the lamplight, glint on the diminished axis.

**Form and dynamics** (from [QA.json](candidate/qa/QA.json)):

| Flight | Seconds | Frames | Chord | What happens | RMS |
|---|---|---|---|---|---|
| 1 | 0.0–2.5 | 0–59 | D minor | **Identity in the first second:** bell, tock, stone and sub on frame 0; the leap at 0.47 s; the sigh at 0.94 s | −19.0 dBFS |
| 2 | 2.5–5.0 | 60–119 | F minor | The presences gather | −18.6 |
| 3 | 5.0–7.5 | 120–179 | A♭ minor | Crest: the sigh becomes a cry, an overtone melody appears, the bars turn alien with motor tremolo, the floor drops | −17.0 |
| 4 | 7.5–10.0 | 180–239 | B minor | Withdrawal: sub, stone and giant voice nearly leave, the building audibly inhales, the key turns back to D | −20.1 |

Momentary loudness runs from −17 LUFS in the first second to −13.5 at the crest and −19.8 before the loop
re-ignites.

## How it is built (existing v0.8 tools only)

```bash
node production/infinite-stairwell/opus-55/compose.ts
```

```bash
node production/infinite-stairwell/opus-55/build.ts NEW_OUTPUT_DIRECTORY
```

1. **Rack score to native bounce.** `score.json` is rendered by the Signature Rack, which hash-verifies its frozen
   engines before loading them. It is bounced to one PCM16 phrase per part: one four-bar cycle plus a 6 s tail, at
   the engine's own frames.
2. **Loop project.** `stairwell.json` is an ordinary DaemonV12 project with `render.duration` of 10 s and tail
   `none`. Each track triggers its phrase **twice at bar 1**: once from the start, and once with `offsetSeconds: 10`.
   The cycle's own releases, halos and room tail therefore lie over its opening. This periodic fold is exact, so the
   wrap from frame 440,999 to frame 0 continues the take with no crossfade, edit or extra processing.
3. **PCM24 delivery.** `packageProduction24` (`scripts/headliner-production24.ts`) handles Float64 processing and
   the master sum, independent PCM24 master and stem exports, the MP3 straight from the master, provenance, and an
   exact-file-set `SHA256SUMS`. No normalization, limiting or extra mastering is applied; the master gain is +1.5 dB.
4. **QA**, as below.

The build takes about 30 s on this machine (Linux, Node v22.23.4, FFmpeg 6.1.1). Verify or replay the sealed package:

```bash
node scripts/headliner.ts hashes production/infinite-stairwell/opus-55/candidate/delivery
```

```bash
node scripts/headliner-production24.ts replay production/infinite-stairwell/opus-55/candidate/delivery NEW_DIRECTORY
```

## Technical QA (all gates pass)

| Check | Result |
|---|---|
| Sample count | Master and all 13 stems: **441,000** frames, stereo, 44,100 Hz, PCM24 (10.000 s) |
| Clipping | 0 clipped samples in the master and every stem |
| True peak | **−4.6 dBTP** (FFmpeg), −4.55 dBTP (engine); sample peak −4.55 dBFS |
| Loudness | −16.0 LUFS integrated (FFmpeg); the engine reads −16.24 |
| Mono compatibility | Correlation 0.867; worst 100 ms window 0.747 (no window below 0); mono fold-down −0.3 dB |
| Boundary continuity | Wrap jump (last frame to first) is 0.0014 L / 0.0026 R, at the **19th percentile** of the file's own sample-to-sample motion. High-pass click energy at the seams is +3.0/+3.8 dB over the median, against +11.3 dB at the 99.9th percentile |
| Fold integrity | Tail at the fold point: −89 dBFS. An independent reconstruction of the folded PCM16 phrases matches the master within **0.5 PCM24 LSB** |
| Repeated playback | Three sample-exact passes: −16.18 / −16.19 / −16.19 LUFS mean momentary; no seam artifacts ([listen](candidate/qa/stairwell-loop-x3.mp3)) |
| Determinism | A fresh-process package replay matches all 56 files byte for byte. A fresh-process rack re-bounce matches all 13 phrases. Two separate builds produced identical deliveries |
| Assets | Signature Rack synthesis only; no SoundFont/FluidR3, no external or unlicensed samples |

Stems are post-track, pre-master (pan baked in). `room` is the shared wet FDN. Apply the project's +1.5 dB master
gain to reconstruct the mix.

## Notes and limits

- **Unheard.** No one has listened to this yet. Balance, the Shepard handoff and the crest want human ears first.
- No Wonder reference MP3 was present in this session, so no benchmark comparison was made and nothing of it was used.
- Development stayed within the one-candidate limit:
  - A first probe rebalanced levels.
  - A first build showed that a pre-roll approach left a click at the loop point, because the rack's voices and
    room are not sample-periodic. That approach was replaced by the exact fold before this candidate was built.
  - Bar 4's dynamics were then deepened for contrast.
- Generated-audio licensing remains a pending owner declaration. Measurements are not a listening or mastering
  approval.
