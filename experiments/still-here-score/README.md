# STILL HERE — the ignition sequence

Original 12-second scores for a DaemonV12 aerospace spec film, in two rounds:

- **Round 2, current: the propulsion experiment.** Two new candidates, **P — PROPULSION** and
  **L — LIFT**, on a 120 → 150 BPM tempo map. Each was rendered as V1 and revised once (V2).
  A fixed-120 BPM control of P is included.
- **Round 1, unchanged:** A — PRECISION IGNITION and B — THE HUMAN SPARK, as delivered in
  `9fd4d36` ([below](#round-1--a-and-b-unchanged-since-9fd4d36)).

| Requirement | Delivered (every file) |
|---|---|
| Ignition | audio frame **176,400**, picture frame **240** (4.000 s) |
| Length | exactly **529,200 frames** (12.000 s, 720 frames at 60 fps) |
| Loudness | **−14.0 LUFS**, matched on DaemonV12's own meter |
| Engine | DaemonV12 0.7.0 at `main` `7dd67f1`, sequencing and mixing natively, unmodified |

> **Nobody has listened to these.** This environment cannot perceive audio. Everything below
> is a score reading, a measurement or a design intention, labelled as such
> ([REVIEW-V3.md](REVIEW-V3.md), [REVIEW.md](REVIEW.md)). Human listening chooses; I have
> not picked a winner.

# Round 2 — the propulsion experiment (P and L)

## Listen (Android: tap a link)

| Candidate | MP3 (320 kbps) | WAV master (PCM16) | Sync sheet | Event map (60 fps) |
|---|---|---|---|---|
| **P — PROPULSION (V2)** | [still-here-p-v2.mp3](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/still-here-ignition-score/experiments/still-here-score/p/v2/still-here-p-v2.mp3) | [wav](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/still-here-ignition-score/experiments/still-here-score/p/v2/still-here-p-v2.wav) | [cues](p/v2/still-here-p-v2.cues.md) | [events](p/v2/still-here-p-v2.events.md) |
| **L — LIFT (V2)** | [still-here-l-v2.mp3](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/still-here-ignition-score/experiments/still-here-score/l/v2/still-here-l-v2.mp3) | [wav](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/still-here-ignition-score/experiments/still-here-score/l/v2/still-here-l-v2.wav) | [cues](l/v2/still-here-l-v2.cues.md) | [events](l/v2/still-here-l-v2.events.md) |
| P at a fixed 120 BPM (control, V2 material) | [still-here-p-control120.mp3](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/still-here-ignition-score/experiments/still-here-score/p/control120/still-here-p-control120.mp3) | [wav](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/still-here-ignition-score/experiments/still-here-score/p/control120/still-here-p-control120.wav) | [cues](p/control120/still-here-p-control120.cues.md) | [events](p/control120/still-here-p-control120.events.md) |
| P, V1 (before the revision) | [still-here-p-v1.mp3](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/still-here-ignition-score/experiments/still-here-score/p/v1/still-here-p-v1.mp3) | [wav](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/still-here-ignition-score/experiments/still-here-score/p/v1/still-here-p-v1.wav) | [cues](p/v1/still-here-p-v1.cues.md) | [events](p/v1/still-here-p-v1.events.md) |
| L, V1 (before the revision) | [still-here-l-v1.mp3](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/still-here-ignition-score/experiments/still-here-score/l/v1/still-here-l-v1.mp3) | [wav](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/still-here-ignition-score/experiments/still-here-score/l/v1/still-here-l-v1.wav) | [cues](l/v1/still-here-l-v1.cues.md) | [events](l/v1/still-here-l-v1.events.md) |

**Listening notes:**

- **Order:** play P V2 and L V2 first, each at least twice, then on a phone speaker.
- **The tempo question:** P V2 and the control are identical until 4.000 s. Play them back
  to back to hear what 150 BPM does after ignition.
- **Level:** every file sits at −14.0 LUFS, so loudness won't decide the comparison.
- **MP3s:** they are listening copies. The WAV is the master and the picture clock.

## What changed after your feedback

The full reasoning is in [THESIS-V3.md](THESIS-V3.md).

- **Kept from A:**
  - the opening: the 3+3+2 precision ticks, the press heartbeat and the cable turbine;
  - P's breath;
  - the call 1–5–8 / answer 3–5–6, which became P's hook.
- **Kept from B:**
  - the ignition recipe: a melodic arrival on the downbeat, with full harmony and low end,
    after a quieter build;
  - the spark 1–2–5–6, which became L's hook;
  - the Lydian II;
  - the summit: the hook completed an octave higher.
- **Dropped:**
  - both palettes: talkbox, glottal voice, choir, music box, glass, steel plate, brass stab;
  - the Tempo String as the bass;
  - both tempos.
- **New palette:** small analog-style subtractive voices and electronic drums
  ([`src/synths.mjs`](src/synths.mjs)). MORPH's physical instruments stay only as
  restrained industrial colour: ticks, press, turbine, the cable's answer.

## P — PROPULSION

*An irresistible groove, in D.*

- **0–4 s:** A's factory on an A pedal. A dark synth bass states A–E–A over 3+3+2 ticks,
  and robot blips answer. The turbine winds up, then the breath.
- **4.000 s:** at 150 BPM the whole band plays the call. The lead sounds D5–A5–D6 above
  bass and stabs, with a big kick and crash; four on the floor starts.
- **4–8.8 s:** the lead answers F♯–A–B, twice, then over IV, where the arpeggio enters.
- **8.8–10.4 s:** a ♭VI–♭VII climb with a snare roll.
- **10.4–12 s:** the band hits the 3+3+2 together, and the answer finally reaches D6 at
  **11.2 s**.

## L — LIFT

*Melodic beauty and uplift, in E.*

- **0–4 s:** the spark grows in a warm bell over a B pedal, and the machine answers at 1.5 s.
  The turbine winds into ignition with no breath and no low end.
- **4.000 s:** the spark completes on E5 as the harmony opens from Bsus4 to **Emaj9**. The
  sub, a broken beat and the 16th arpeggio arrive at once.
- **4–10.4 s:** a soaring legato lead (Lydian II at 5.6 s), the spark sung at 7.2 s, then a
  rising bass with the spark in diminution.
- **10.4 s:** **E6**, the spark completed an octave above ignition, over Eadd9.

## The tempo map

DaemonV12 0.7 has one tempo per project, and the engine was not changed. A score-local map,
[`src/tempo-map.mjs`](src/tempo-map.mjs), gives every event an exact time in integer
microseconds. It then translates the piece into an ordinary **fixed 150 BPM, 2/4** project:

- a 120 BPM sixteenth is exactly 300 ticks and a 150 BPM sixteenth exactly 240;
- ignition is the engine barline `6:1` = tick 9,600 = frame 176,400.

The engine's frame equals the exact frame for every event; this is checked, not assumed.
The method, a sync table, the limitations and a one-line check are in
[TEMPO-MAP.md](TEMPO-MAP.md).

## Native and external (round 2)

| Native DaemonV12 triggers (drum-kit tracks) | External, played as one sampler note at `1:1` |
|---|---|
| **P:** heartbeat/press/lock, kick, clap/snare, hats, ticks (with the turbine's physics-timed ratchet), crash, bass, lead, blips, stabs, pad, arpeggio | **P:** the cable (intro statements and turbine); the FDN room |
| **L:** heartbeat, kick, clap/snare, hats/shaker, ticks, crash, bass, bell, pad, arpeggio, the machine's answer (V2) | **L:** the legato lead (glides and vibrato carry across notes); the cable turbine; the FDN room |

The engine also does natively:

- gates and envelopes;
- gain, pan and authored duck lanes;
- delays and reverbs;
- the master high-pass and glue compressor;
- stems, the manifest and analysis.

Done outside the engine:

- every one-shot is synthesized by this directory's code;
- the final −14 LUFS gain and true-peak limiter;
- P's breath window.

The details are in [PROVENANCE.md](PROVENANCE.md).

## Files (round 2)

```
THESIS-V3.md  REVIEW-V3.md  TEMPO-MAP.md            plan, critique/revision log, tempo conversion
scores/p.mjs  scores/l.mjs  scores/v3-common.mjs    the scores (V1, V2 and the control in one file each)
src/synths.mjs  src/tempo-map.mjs                   the palette and the tempo map
p/v2/  l/v2/  p/control120/  p/v1/  l/v1/:
  still-here-*.wav / .mp3        delivered master and listening copy
  still-here-*.cues.md           sync sheet: musical position, tick, sample frame, 60 fps frame
  still-here-*.events.md/.json   every rendered trigger with its sample frame and 60 fps frame
  project/*.daemonv12.json       the DaemonV12 project (V2s keep their assets/)
  render/*.render.json, *.analysis.json, still-here-*.meta.json, *.stems-analysis.json, *.spectrogram.png
```

## Reproduce (round 2)

From the repository root, after `npm ci`:

```sh
node experiments/still-here-score/build.mjs p v2      # also: p v1 | p control120 | l v1 | l v2
python3 experiments/still-here-score/analysis/stems.py p v2 --png
node experiments/still-here-score/manifest.mjs
```

Each build takes about 30 s on this runtime, covering synthesis, the engine render and
mastering. Rebuilding gives byte-identical files (see [REVIEW-V3.md](REVIEW-V3.md)).

## Not done in round 2, by design

- **No engine tempo map:** the engine is unchanged.
- **No polishing of the old instruments.**
- **No video or visual assets.**
- **No merge or publish.**
- **No winner picked:** work stops here for your listening.

# Round 1 — A and B (unchanged since 9fd4d36)

## Listen (Android: tap a link)

| Candidate | MP3 (320 kbps) | WAV master (PCM16) | Sync sheet |
|---|---|---|---|
| **A — PRECISION IGNITION (V2)** | [still-here-a-v2.mp3](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/still-here-ignition-score/experiments/still-here-score/a/v2/still-here-a-v2.mp3) | [wav](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/still-here-ignition-score/experiments/still-here-score/a/v2/still-here-a-v2.wav) | [cues](a/v2/still-here-a-v2.cues.md) |
| **B — THE HUMAN SPARK (V2)** | [still-here-b-v2.mp3](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/still-here-ignition-score/experiments/still-here-score/b/v2/still-here-b-v2.mp3) | [wav](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/still-here-ignition-score/experiments/still-here-score/b/v2/still-here-b-v2.wav) | [cues](b/v2/still-here-b-v2.cues.md) |
| A, V1 (before the revision) | [still-here-a-v1.mp3](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/still-here-ignition-score/experiments/still-here-score/a/v1/still-here-a-v1.mp3) | [wav](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/still-here-ignition-score/experiments/still-here-score/a/v1/still-here-a-v1.wav) | [cues](a/v1/still-here-a-v1.cues.md) |
| B, V1 (before the revision) | [still-here-b-v1.mp3](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/still-here-ignition-score/experiments/still-here-score/b/v1/still-here-b-v1.mp3) | [wav](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/still-here-ignition-score/experiments/still-here-score/b/v1/still-here-b-v1.wav) | [cues](b/v1/still-here-b-v1.cues.md) |

**Listening notes:**

- **Order:** listen to the V2s first, each at least twice. Then try them on a phone speaker
  and in the car.
- **Level:** all four files sit at −14.0 LUFS, so a difference in loudness won't decide the
  comparison.
- **MP3s:** they are listening copies. The WAV is the master and the picture clock.

## A — PRECISION IGNITION

*Driving, rhythmically confident.* 120 BPM, 4/4, in A with a Mixolydian edge.

**The hook: a call and an answer in the same 3+3+2 rhythm.**

- **The call:** the Tempo String (MORPH's physical cable) states **A–E–A**: a pitch-diving
  slap, a fifth, and an octave flageolet pop. These are bare fifths, the machine.
- **The answer:** a talkbox voice replies **C♯–E–F♯**: the human third, ending on an open
  sixth. The talkbox is a saw driving MORPH's physical throat, the way a real talk box drives
  a mouth.

**The arc:**

| Time | What happens |
|---|---|
| 0.0–3.0 s | Before ignition, the factory dozes in its own rhythm. A press thumps once per second; the hook's rhythm ticks in the background. A dark statement at 0 s gets a tiny glass "robot" answer at 1.0 s, so all six notes are heard within two seconds. |
| 3.0 s | The cable is wound from eighth-note reflections into pitch, a turbine spooling up. |
| 3.875 s | The hand grabs the cable: **121 ms of exact digital silence**. |
| **4.000 s, ignition** | Kick, the cable's A1 slap, a struck steel plate and a brass stab. Four-on-the-floor starts at once. The precision arpeggio enters quietly on the hook's accents and fills in from 6.0 s. |
| 4–8 s | Call and response: statement, then the warm answer. The answer's open sixth rings over the bar line. Over IV (D) the answer climbs. |
| 8–10 s, ascent | ♭VI–♭VII (F–G): call and answer merge into one rhythm, bass and voices in unison. The answer climbs by sequence (A–C–D, then B–D–E). A snare roll and climbing cable toms build. |
| 10–12 s, breakthrough | Over A the voice sings C♯5–E5–F♯5. At **11.0 s** the open sixth finally resolves up to **A5**: the answer is completed. A final A(add9) hit and crash ring out. The precision ticks keep running quietly, and a servo "lock" click at 11.875 s points back to the opening press. |

## B — THE HUMAN SPARK

*More melodic and emotionally uplifting.* 180 BPM beat, half-time feel, 4/4, in D with a
Lydian II.

**The hook: the spark, D–E–A–B (→ D′).** A step, a pushed fourth, a step, then the octave.

**The arc:**

| Time | What happens |
|---|---|
| 0–4 s | The spark grows note by note in a music box: three notes, then four, then four with a human hum underneath. The machine breathes in **3**, one soft press per second plus two light ticks, against the spark's **4**. The two cycles coincide only at 0 and at 4.000 s. |
| ~3.83 s | An inhale. |
| **4.000 s, ignition** | The machine locks into the spark's meter, and the spark completes: the voice cries **D5**, the music box rings D6. The bass plays the fragile idea low and strong (D2–E2–A2–B2). Struck plate and half-time drums. |
| 4–8 s | The voice answers over the Lydian II chord (E/D, the wonder chord), then rises over vi. At 6.67 s the drums change into double-time. |
| 8–10 s, ascent | The spark in diminution climbs by step over a rising bass G–A–B–C♯, with a snare roll and cable toms. |
| 10–12 s, breakthrough | The spark is transformed: the voice sings it from A4 up to **A5**, the highest note of the piece, on the 10.667 s bar line. Beneath it the choir sings the original D–E–A–B, and the music box plays it two octaves up. A Lydian G♯ shimmer follows, then the machine's 1 Hz pulse returns, inviting the replay. |

## Basic analysis (V2, measured)

| | A V2 | B V2 |
|---|---:|---:|
| Frames / 60 fps frames | 529,200 / 720 | 529,200 / 720 |
| Ignition frame / picture frame | 176,400 / 240 | 176,400 / 240 |
| Breakthrough (10.000 s) | frame 441,000 / picture 600 | frame 441,000 / picture 600 |
| Integrated loudness (DaemonV12 `analyze`) | −13.97 LUFS | −13.96 LUFS |
| True peak / loudness range | −1.24 dBTP / 7.6 LU | −1.91 dBTP / 10.4 LU |
| Clipped or full-scale samples | 0 | 0 |
| External limiter, maximum gain reduction | 1.53 dB | 0 dB |
| Kick over bass sub, first 50 ms (median / worst) | 15.1 / 5.8 dB | 9.75 / 3.3 dB |
| Hook presence over the rest, 300 Hz–4 kHz | 7.4–25.8 dB per answer note | 6.0–7.6 dB per phrase |
| Phone proxy (high-pass at 300 Hz), after ignition | −0.7 to −4.8 dB | −2.7 to −5.0 dB |

**Not native metrics:**

- The proxies come from [`analysis/stems.py`](analysis/stems.py) and the Composer skill's
  `review-sections.mjs`.
- The full numbers are in `*/v*/*.meta.json`, `*/v*/*.stems-analysis.json`,
  `analysis/review-*.json` and the spectrograms `*/v*/*.spectrogram.png`.

## Sync points

Every cue was resolved by DaemonV12's own `ticksToFrames`, imported from the engine's build:

- **A:** 120 BPM, a 16th is 5,512.5 frames, ties round later.
- **B:** 180 BPM, tempo quantized to 333,333 µs.

The 60 fps frame is `floor(sampleFrame × 60 / 44100)`. The full sheets are linked in the
table above.

| Moment | A | B |
|---|---|---|
| Hook fragment | 0 s / frame 0 | 0 s / frame 0 |
| Pre-ignition gesture | spool 3.000 s (132,300; pic 180); breath 3.875 s (170,888; pic 232) | inhale 3.833 s (169,050; pic 230) |
| **Ignition** | **4.000 s · 176,400 · pic 240** | **4.000 s · 176,400 · pic 240** |
| Main hook complete | 5.0–6.0 s (answer) | 4.0–5.33 s (statement) / 5.33 s (answer) |
| Ascent | 8.000 s · 352,800 · pic 480 | 8.000 s · 352,800 · pic 480 |
| Breakthrough | 10.000 s · 441,000 · pic 600 | 10.000 s · 441,000 · pic 600 |
| Final gesture | 11.000 s · 485,100 · pic 660 (A5 + final hit) | 10.667 s · 470,400 · pic 640 (A5 lands) |
| Last event | lock 11.875 s · 523,688 · pic 712 | machine 11.667 s · 514,499 · pic 699 |

**B's one-frame quirk:** B's authored nine bars resolve to 529,199 frames because of tempo
quantization. `render.duration` fixes the file at 529,200, so the last frame is padding.

**Space for narration and sound effects:**

- **Final chord:** after the final gesture (A 11.0 s, B 10.67 s) only the final chord sustains.
  Light ticks and one closing click (A) or press (B) continue; no new melodic or rhythmic idea
  starts.
- **The A5:** the held top note sits in the speech band. It releases at about 11.7 s in A and
  about 11.6 s in B, so a tagline would sit over a decaying chord.
- **A's breath:** a clean 121 ms window before ignition.

## How it was made

1. **Survey.** The Composer skill and the MORPH//02–06 sources and reviews were read at
   their exact commits. THE FOUNDRY and THE AWAKENING are not in the repository
   ([PROVENANCE.md](PROVENANCE.md)).
2. **Plan.** Theses were written before any audio ([THESIS.md](THESIS.md)).
3. **Build.** Each score (`scores/a.mjs`, `scores/b.mjs`) synthesizes its own original
   assets and writes a DaemonV12 project. The unmodified engine validates and renders it,
   with stems.
4. **Master.** A minimal external stage applies loudness gain, a true-peak limiter and A's
   silence window.
5. **Critique.** Three named weaknesses per concept in V1, with evidence and causes.
6. **Revise.** One purposeful revision each:
   - A: make the hook and the ignition read;
   - B: let the groove drive and the spark lift.
7. **Measure and stop.** V2 was measured against the same weaknesses, then work stopped
   here for listening ([REVIEW.md](REVIEW.md)).

**Native and external:**

| Native in DaemonV12 | External, original physical models, provenance recorded |
|---|---|
| All drums | Tempo String bass and spool |
| Stabs | Talkbox |
| Arpeggio | Glottal voice and choir |
| Music box | Warm bass |
| Machine sounds | FDN rooms |
| Mix automation and track effects | Final loudness/limit stage |
| Master glue | — |

The details are in [PROVENANCE.md](PROVENANCE.md). No engine, MORPH or main-branch file was
changed.

## Files

```
THESIS.md  REVIEW.md  PROVENANCE.md  MANIFEST.json      thesis, critique/revision log, sources, hashes
scores/a.mjs  scores/b.mjs                              the two scores (V1 and V2 in one file each)
lib/        copied MORPH models      src/   pipeline + new small instruments
build.mjs   score -> assets -> DaemonV12 project -> render -> master -> MP3 -> cue sheet
a/v2/, b/v2/, a/v1/, b/v1/:
  still-here-*.wav / .mp3             delivered master and listening copy
  still-here-*.cues.md                sync sheet (sample frames, 60 fps frames, ticks)
  project/*.daemonv12.json            the DaemonV12 project (V2 also has its assets/)
  render/*.render.json, *.analysis.json   engine manifest and analysis
  still-here-*.meta.json, *.stems-analysis.json, *.spectrogram.png
```

Engine stems and engine pre-master WAVs are not committed. They are byte-reproducible, and
their SHA-256s are in each `meta.json` and in `MANIFEST.json`.

## Reproduce

From the repository root (Node 22.18 or newer; FFmpeg required):

```sh
npm ci                                                     # builds dist/ (engine timing used by the scores)
node experiments/still-here-score/build.mjs all v2         # or: a v1 | b v2 | all v1
node bin/daemonv12.js render experiments/still-here-score/a/v2/project/still-here-a-v2.daemonv12.json --out-dir /tmp/a-v2 --stems --format wav   # engine only
pip install numpy scipy matplotlib                          # analysis only
python3 experiments/still-here-score/analysis/stems.py a v2 --png
node experiments/still-here-score/manifest.mjs
```

**Measured run time** (V2, this runtime): about 22 s for A and about 16 s for B, including
synthesis, the engine render and mastering.

**Determinism:**

- Rebuilding from source reproduced every asset, engine master, stem, delivered WAV and MP3
  byte-for-byte (Node v22.22.0, FFmpeg 6.1.1, linux-x64).
- Other CPUs or runtimes may differ in the last bits of transcendental functions.

## Not done in this round, by design

- **No listening:** nobody has listened yet.
- **No winner picked.**
- **No further workflow steps:** no V3 and no Risk Pass, per the brief's
  "one revision, then stop".
- **No video:** no visual assets and no edit.
- **No merge or publish:** nothing was merged or published.
