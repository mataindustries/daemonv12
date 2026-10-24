# MORPH//08 — MOTOR GROOVE

MORPH//07's HYPNOTIC MOTOR, played as an instrument inside two eight-second loops.
Listeners found the motor's sound interesting, but it was not yet clear how it could
sit inside great music. This experiment gives the motor a band. The motor keeps its
synthesis, its score and its swing. Every other part is an existing DaemonV12 or MORPH
one-shot, played by the engine's own sampler and locked to the frames where the motor
actually strikes.

Base: `feat/morph-07-harmonic-motor` at `8ca2a2f8ac7496ef6aee0b3424a4a54bf71864b9`, merged
with `main` at `181cb6c` (the reviewed MORPH Sync Pack, #27). The MORPH//07 instrument,
scores and candidates are byte-for-byte unchanged, and so is every engine source file.

## Listen

| Candidate | Idea | Files |
|---|---|---|
| **A — LOCKSTEP** | Minimal, hypnotic and rhythm-first. The motor is the star. | [`lockstep.wav`](candidates/lockstep.wav) · [`.mp3`](candidates/lockstep.mp3) · [stems](candidates/lockstep.stems) |
| **B — OVERTONE** | Melodic and energetic. The motor is the rhythmic engine of a complete track. | [`overtone.wav`](candidates/overtone.wav) · [`.mp3`](candidates/overtone.mp3) · [stems](candidates/overtone.stems) |

Both loops are 120 BPM in A minor, 4 bars long: 352,800 frames, exactly 8.000 s. Both
are loudness-matched at −12.0 LUFS (WAV), close to MORPH//07 A. True peak stays at or
below −1.2 dBTP. WAV files are 44.1 kHz stereo PCM16. MP3 files are 192 kb/s CBR, made
with the engine's FFmpeg/LAME path. **Put the WAV on repeat:** MP3 encoder padding
adds about 45 ms, so only the WAV loops sample-accurately.

## The idea: the band follows the machine

The motor's commutator is the groove. Its cogging swings the odd sixteenths about
22 ms late (58% swing). A load on beat 4 of bar 2 drags the last three sixteenths, and
the bar-3 downbeat lands 29 ms late. In bar 4 the rotor spins up into an A1 pitch,
locks its stator to the A overtones, then brakes back onto beat 3. These loops do not
quantize the motor to a grid. Every hit in the band is placed on the frame where the
motor struck that sixteenth, or where the rotor locked. The hits come from the motor's
own Sync Pack event map, rounded to 960 PPQ (within ±0.26 ms). The kick, bass, melody
and hats therefore swing with the motor and stumble with its drag, and the band lands
together when the motor lands.

All pitched parts are tuned with `playbackRate` to the motor's 5-limit just intonation
on A1 = 55 Hz (C = 6/5, E = 3/2, F = 8/5, G# = 15/8, …). A sung C4 is therefore exactly
the motor's C4 tine (264 Hz), and nothing beats against the stator. Measured pitches
are within 1 cent for the glass and within a few cents for the sub and the voice (its
vibrato). The clap's tonal body follows the chords too: A3, or G#3 under E7.

## Form (shared by both loops; the motor sets it)

| Bar | Motor (unchanged) | A — LOCKSTEP | B — OVERTONE |
|---|---|---|---|
| 1 · 0–2 s | Swung 16ths, Am7 arpeggio, chassis on 1 / 2& / 3& | Kick on every beat; sine sub on the offbeats; **glass E5–C5–A4 on the motor accents 1a, 2&, 3&** | Four-on-the-floor kick; cable bass on the motor accents; **sung hook A3–C4–E4 · D4–C4** |
| 2 · 2–4 s | Fmaj7, beat-4 drag | The same glass cell over F (A–C–E are chord tones of F too) | The hook rises: A3–C4–E4 · **F4–E4** |
| 3 · 4–6 s | Half speed (swung eighths), Dm7 → E7 | Half-time clap; glass sigh F5 → E5 | The voice falls F4–E4–D4–B3–G#3 to the leading tone |
| 4 · 6–8 s | Spin-up → A1 overtone lock (A **major**) → brake, lands on beat 3 → Am | Kick drops beat 2; the sub rests while the motor hum is the bass; **glass rings C#5 exactly as the rotor locks** | The voice resolves to A3 as the rotor locks, then E4–D4–C4 leads back to the top |

The lock's major third (C#) against the loop's minor third (C) is the emotional turn in
both loops. In A the glass rings it alone. In B the melody resolves into it.

## A — LOCKSTEP

| Part | Sound (existing asset) | Role |
|---|---|---|
| motor | MORPH//07 HYPNOTIC MOTOR, near its original balance (chassis −5 dB, hum +2) | The star: riff, swing, accents, spin-up and lock |
| kick | Orbital Foundry `02-mechanical-kick`, tuned to A1 | Every beat on the motor's quarter contacts; rests on beat 2 of bar 4 |
| bass | GLASSHOUSE `07-sub-cs`, A1 / F1 / D2–E2 | A gated sine sub on the offbeat eighths, under the motor's register |
| lead | GLASSHOUSE `01-glass-hit` | One falling cell answers the motor's rising arpeggio |
| perc | GLASSHOUSE `08-chrome-clap`, `09-pixel-hat` | Backbeat (half-time in bar 3); offbeat hats, with a swung ghost into each turn |

The motor fills 110–400 Hz and has almost nothing above 2.5 kHz. A adds only what it
lacks: sub-bass below it, one bell above it, and air at the top. The motor bus dips 3 dB
under each kick (140 ms recovery).

## B — OVERTONE

| Part | Sound (existing asset) | Role |
|---|---|---|
| motor | MORPH//07 HYPNOTIC MOTOR, rhythm forward (tines −6 dB, chassis −9, room −3) | The rhythmic voice: clicks, swing, drag, the spin-up and lock |
| kick | Orbital Foundry `02-mechanical-kick`, tuned to A1 | Four on the floor |
| bass | MORPH v1 `cable-pluck` (A1 native), octaves and chord roots | Plays the motor's own accent pattern (1, 2&, 3&) plus an octave pickup; half-time in bar 3 |
| lead | GLASSHOUSE `04-ghost-vox`, held on its open "ah" (from 0.2 s), A3–F4 | The sung hook; a human voice against the machine |
| perc | GLASSHOUSE `08-chrome-clap`, `09-pixel-hat` | Clap on 2 and 4; offbeat hats with swung "a" ghosts |

The melody mirrors the motor's gesture: each bar it rises like the spin-up and falls
like the brake, and bar 4 does the same thing at full scale. The kick ducks the motor
and the bass by 4 dB (160 ms recovery), so the kick owns the downbeats.

## Mix and master

`render.ts` renders the motor with `perform(hypnoticMotor(), { stems: true })` and wraps
its 2.5 s ring-out onto the start, as MORPH//07 does for its loop. It rebalances the
motor's five pre-master stems (tines, housing, chassis, hum, room) and passes them
through MORPH//07's own master curve, `tanh(2.4·x/peak)/tanh(2.4)`. It then generates
one engine project per arrangement ([`lockstep.project.json`](candidates/lockstep.project.json),
[`overtone.project.json`](candidates/overtone.project.json)). Each project is rendered
with `runCommand('render', …, { stems: true })` on the Node-only sampler route, from a
private staging copy of the assets. Sample tails past 8 s are wrapped onto the start.

[`mix.ts`](mix.ts) is the master bus. It removes DC with a loop-steady filter, applies
one soft-knee ceiling (linear to −7 dBFS, tanh shoulder to −1.8 dBFS), and solves a
pre-gain that brings both loops to −12 LUFS. Loudness is measured to ITU-R BS.1770-4
(K-weighting, 400 ms gated blocks). There is no limiter lookahead, EQ, reverb or
synthesis. Peak shaving reaches 2.9 dB on A, on the motor's 1 ms contact pulses. On B
it reaches 6.7 dB, on the tips of the cable bass's 2 ms waveguide pulses (the sound has
a 20 dB crest factor).

## Stems

Each candidate has five aligned stems in `<id>.stems/`: `motor`, `kick`, `bass`, `lead`
and `perc`. Each is 352,800 frames, starts at frame 0 and has its tail wrapped. Stems are
post-fader and pre-ceiling, delivered at −6 dB so none clips. To rebuild the master:

```
master = softClip(2 × (motor + kick + bass + lead + perc))     // mix.ts softClip, +6 dB
```

The test rebuilds both masters from the PCM16 stem files within 5 LSB. A stem shifted by
one sample misses by 2,859 LSB.

## Sync Pack event maps

`<id>.events.json` is built with `buildEventMap` (60/1 fps, clip `[0, 352800)`) from two
sources of authoritative sample frames:

- **Motor tracks.** `commutator`, `tines`, `chassis`, `rotor`, `drive`, `regime`,
  `voice`, `harmony` and `form` are exactly MORPH//07's `hypnotic-motor` map. The test
  compares them event by event. MORPH//07's
  [`hypnotic-motor.telemetry.json`](../morph-07/candidates/hypnotic-motor.telemetry.json)
  (rotor angle per picture frame) applies unchanged.
- **Band tracks.** A has `kick`, `sub`, `glass`, `clap` and `hat`; B has `kick`, `bass`,
  `vox`, `clap` and `hat`. They come from `scheduledEventsFromTimeline` and are equal to
  the engine's own trigger frames. Roles include `kick`, `low-end`, `bass`, `pitch`,
  `melody`, `hook`, `voice`, `backbeat`, `hat` and `tick`. `accent` marks velocity ≥ 0.85.
  `motor-locked` marks hits on a motor strike. `source` records the slot, the note, the
  project SHA-256 and the note index.

`<id>.schedule.json` is the same input for the Sync CLI:
`node bin/daemonv12.js sync <id>.schedule.json --out <map>` rebuilds each map byte for byte.
A has 178 events in 14 tracks; B has 205 events in 14 tracks.

## Reproduce

Node 22.18+ from a clean checkout. WAV files, stems, maps, schedules and projects need
nothing else:

```sh
npm ci
node experiments/morph-08/render.ts work/m08-a --no-mp3
node experiments/morph-08/render.ts work/m08-b --no-mp3
for f in lockstep.wav overtone.wav lockstep.events.json overtone.events.json \
         lockstep.stems/motor.wav overtone.stems/lead.wav; do
  cmp work/m08-a/$f work/m08-b/$f && cmp work/m08-a/$f experiments/morph-08/candidates/$f; done
node --test tests/morph08-groove.test.ts
```

Drop `--no-mp3` to also encode MP3 and record FFmpeg `loudnorm` readings. MP3 bytes
depend on the FFmpeg/LAME build; the WAV is the reference. As with MORPH v1 and MORPH//07,
synthesis and mixing use JavaScript transcendental functions, so pinned hashes are
verified on the supported Node runtime. An independent loudness check:
`ffmpeg -i experiments/morph-08/candidates/lockstep.wav -af ebur128=peak=true -f null -`.

## Verification results

| | A — LOCKSTEP | B — OVERTONE |
|---|---|---|
| Frames / seconds | 352,800 / 8.000 | 352,800 / 8.000 |
| WAV SHA-256 | `64b15950…c514b216` | `f7719799…b5e4111c` |
| Integrated loudness, WAV (Node BS.1770 / FFmpeg `ebur128`) | −12.00 / −12.0 LUFS | −12.00 / −12.0 LUFS |
| Integrated loudness, MP3 (`ebur128`) | −12.3 LUFS | −12.3 LUFS |
| Sample peak / true peak | −2.02 dBFS / −1.9 dBTP | −1.81 dBFS / −1.3 dBTP |
| Clipped samples (master, stems) | 0, 0 | 0, 0 |
| Peak shaving (max) | 2.9 dB, 6% of samples in the knee | 6.7 dB, 5% |
| Stem loudness vs master (stems +6 dB) | motor −3.3 · kick −5.0 · bass −7.7 · lead −8.9 · perc −13.3 LU | lead −5.7 · kick −5.2 · bass −5.2 · motor −6.9 · perc −10.5 LU |
| Events (tracks) | 178 (14) | 205 (14) |

`tests/morph08-groove.test.ts` regenerates every byte. Its checks:

- **Reproducibility.** WAV, stems, maps, schedules and projects match the checked files.
  The motor events match MORPH//07's map, and MORPH//07's candidates still match their
  recorded hashes. Two concurrent processes also produce identical files.
- **Onsets.**
  - Map frames equal the engine's trigger frames.
  - Every motor-locked hit sits within 13 frames (0.3 ms) of a motor strike.
  - Unlocked hits occur only while the rotor is a pitch (bar 4, beats 1–2).
  - Bar 1's odd sixteenths land 20–24.5 ms late, and the bar-3 kick follows the drag.
  - Every onset raises its stem: the kick by at least 40 dB (46 dB measured), every other
    part by at least 3 dB (legato vox and ducked bass are the smallest).
  - Every kick raises the master's band below 150 Hz.
- **Looping.** The first kick is at frame 69. No event falls past the seam. The tails
  that cross the seam reappear at the start. The step across the seam is smaller than
  the median sample step (A 80/3 LSB, B 161/208).
- **Clipping and loudness.** No clipping; true peak ≤ −1 dBTP; both loops within
  0.05 LU of −12 LUFS; FFmpeg readings within 0.3 LU of each other.
- **Sync.** Maps validate, carry the motor and band roles, and the Sync CLI rebuilds them.

## What to judge by ear

These loops were evaluated with analysis only: spectra, tonal balance against a
modern-electronic average, stem loudness, onsets, tuning and loop seams. Nobody has
listened to them yet. Questions for the listening session:

- **A:** Does the motor read as the lead, with the kick and sub as the floor? Is the
  glass cell memorable enough, or too sparse?
- **B:** Is the pitched "ah" voice the right human counterweight, or too bright or
  nasal? It produces a 1 kHz bump in the spectrum. Does the cable bass have enough weight
  on large speakers? Its fundamental is soft and the kick carries the sub.
- **Both:** Does the 29 ms drag into bar 3 feel like groove or like a stumble? It is the
  motor's, and the whole band follows it. Does the bar-4 lock land as the payoff on every
  repeat?

## Scope

There is no video, publication, engine change or new synthesizer. The motor's synthesis
and score are imported from `experiments/morph-07` untouched. All other sound comes from
checked-in assets: Orbital Foundry and GLASSHOUSE (CC0) and MORPH v1 (no new license
asserted; see its README). The arrangement adds about 470 lines of TypeScript: note data
and project generation (`arrangements.ts`), the motor bus, sampler staging and maps
(`render.ts`), and the master bus and meters (`mix.ts`).
