# MORPH//07 — HARMONIC MOTOR

A new synthesized instrument in which rotation is the music. A servo drives a rotor
against cogging, friction and load; a commutator on the rotor fires one current
pulse per contact; each pulse strikes a tuned stator tine, a low chassis mode and the
housing. Slowly turning, the contact geometry *is* a groove. Spun up, the same geometry
fuses into a pitch at the revolution rate, and the stator blooms when its tuning lands
on the rotor's harmonics. No samples and no engine change: one ~400-line instrument
file and two scores outside `src/`, rendered offline with Node.

Base: Sync Pack commit `dafda1522eda0f034c1ff2da260de394eec2d864` (`feat/morph-sync-pack`).
The original MORPH projects, the MORPH v1 pack and the sync demo are untouched.

## Listen

| Candidate | Length | Form | Files |
|---|---|---|---|
| **A — THE HYPNOTIC MOTOR** | 8.000 s, seamless loop | 4/4, 120 BPM, A minor → A overtone lock | [`hypnotic-motor.wav`](candidates/hypnotic-motor.wav) · [`.mp3`](candidates/hypnotic-motor.mp3) |
| **B — THE AWAKENING** | 11.852 s | 12/8, ♩. = 96, D minor → D overtone lock | [`awakening.wav`](candidates/awakening.wav) · [`.mp3`](candidates/awakening.mp3) |

WAV: 44.1 kHz stereo PCM16, −1 dBFS peak. MP3: MPEG-1 Layer III, 192 kb/s CBR,
44.1 kHz stereo (the engine's own FFmpeg/LAME path). A loops sample-accurately from the
WAV; MP3 encoder padding adds ~45 ms, so loop from the WAV.

## The two ideas

**A — THE HYPNOTIC MOTOR.** One revolution is one bar; sixteen commutator contacts are
the sixteenths. The rotor's eight cogging detents make it run slightly faster and slower
inside every revolution, so the machine swings by itself (≈58%: odd sixteenths land
~21 ms late). Kicks on 1, 2&, 3& come from the heavy contacts striking the chassis; an
arpeggio (A2 A3 E3 C4 · A2 A3 G4 C4 E3) comes from the tines each contact is wired to.
- **Bar 1, engage.** The groove in Am7, tuned in just intonation.
- **Bar 2, shift.** The stator changes gear to Fmaj7: same motif, new colour. A brief
  load on beat 4 drags the last three sixteenths 23–32 ms behind their swung places
  before the servo pulls them back.
- **Bar 3, heavy.** The rotor drops to half speed, so the pattern spreads into swung
  eighths under Dm7 → E7. Ringing tines bend into each new chord.
- **Bar 4, sing.** It spins up from the slowest speed in the piece to 55 rev/s. The
  ratchet blurs into an A1 tone, and the stator's tuning (2:3:4:5:7 of A) locks to the
  rotor's overtones: the minor third becomes a major third for a moment. Then it brakes
  hard and lands on beat 3, back in Am, so the last half-bar leads straight into the
  loop. Contrast comes from speed and weight, not from piling on layers.

**B — THE AWAKENING.** A twelve-contact rotor (a rolling 12/8 arpeggio) starts seized
in four strong cogging detents.
- **Dormant.** Scored current jolts rock it: a lub-dub heartbeat on the downbeat
  contact (0.10 s, 0.36 s). The next jolt lurches over a detent ("DUM ta-ting",
  0.99 s), then another ("dum ta-tang", 1.51 s). A surge rolls one whole revolution
  as the rust lets go, and the rotor settles to a cruise.
- **Catch.** The score waits for the motor: the bar grid is anchored where the freed
  rotor first crosses a beat contact (2.686 s), and the servo locks to it there.
- **Identity.** The motif that arrived in fragments becomes a lilting groove: Dm add9,
  then B♭maj7, with a load drag at the end.
- **Rise.** Double speed in Gm, so the eighths become sixteenths.
- **Ascent.** It accelerates through fusion. The pitch sweeps past the tines'
  resonances and locks on A1, the dominant (A overtones, 7th included). It shifts up
  a fourth to lock on D2, the payoff (D overtones 2:3:4:5:9): minor turned major, by
  the physics of lock rather than by a riser. It moves up to G2 (IV) and back home to
  D, with every partial gliding by a fourth.
- **Release.** The brush lifts and the stator rings the chord out to silence.

## The instrument

| Part | Model | What it gives musically |
|---|---|---|
| Rotor (`Rotor`) | Unit inertia; servo phase-locked to the score grid modulo one revolution, with feed-forward; torque limit; cogging `C·cos(2π(N·θ+φ))`; viscous and Coulomb friction (sticks at rest); load; open-loop push; Hann-shaped torque jolts | Tempo and pitch from one control; swing, drag, lurch, stall, breakaway, strain |
| Commutator | Contacts at fixed angles; every forward crossing fires one Hann current pulse with a sub-sample onset; reverse motion re-arms a contact | The groove is geometry; rocking in a detent re-strikes (the heartbeat) |
| Contact energy | Brush contact time shrinks with speed: equal-area pulses get shorter (brighter) and carry `1/(1+ω/4)` energy; spark noise falls as energy² | Rhythm fuses into pitch without a level jump or a hiss |
| Stator tines | Per-contact routing to complex one-pole resonators (fundamental, 4:1 bar partial, brief 9.2:1 ping); "gears" retune them with glides | Melody and harmony; harmonic lock when tunings are rotor harmonics |
| Chassis | Hardening (Duffing) low mode struck by heavy contacts, soft-saturated | A kick that drops ~72 → 55 Hz and locks under sung notes |
| Housing | Coil (L/R) smoothing → three shell resonances; brush crackle band | The ticks in rhythm, a buzzing voice in pitch |
| Rotor tone, room, master | Imbalance tone once pitched; four-line FDN; tanh saturation, DC block, −1 dBFS | Low-end weight and space; phone-level loudness without clipping |

Scores (`scores.ts`) are data: contact geometry, cog count/phase, gear tunings, and
fifteen sample-frame automation lanes — `speed, servo, torque, push, cogging, friction,
load, brush, damping, coil, tines, clicks, chassis, hum, room` — plus jolts, sections and
expected pitches. Musical positions use the engine's 960 PPQ rule (`ticksToFrames`:
nearest frame, ties later). Tempo changes are ramps centred on bar lines so the grid
phase is preserved. A's brake start is solved so step 8 lands exactly on its beat.

## Sync Pack event maps

`candidates/<id>.events.json` is built by `buildEventMap` from `src/sync` (60/1 FPS,
clip `[0, frames)`). Sample frames are authoritative and come from two places: scored
marks at their 960 PPQ frames, and emergent events at the frame the simulation produced
them. The same events are written as Sync CLI input (`<id>.schedule.json`).

| Track | Roles | Meaning |
|---|---|---|
| `commutator` | `impact`, `accent` | Each contact strike a picture can resolve (≥ 30 ms after the previous one) |
| `tines` | `tine`, `melody` | The tine struck, with its Hz and gear in `source` |
| `chassis` | `impact`, `low-end` | Heavy contacts that strike the chassis |
| `rotor` | `revolution`, `breakaway`, `rest`, `servo-lock`, `downbeat` | Completed revolutions (≤ 30 rev/s), leaving or reaching rest, the catch |
| `drive` | `torque` + `accelerate` / `decelerate` / `brake` / `load` / `release` / `jolt` | Torque changes at the frame they are applied |
| `regime` | `fusion` / `rhythm-to-pitch`, `separation` / `pitch-to-rhythm` | Contact rate crossing ~34 / 28 per second (45 ms smoothing) |
| `voice` | `pitch`, `harmonic-lock` | The frame the rotor arrives within 1% of a scored pitch |
| `harmony` | `harmonic-transition` | Gear changes, with chord name and tine tunings |
| `form` | `section`, `climax`, `loop-point`, `downbeat` | Section boundaries |

`<id>.telemetry.json` is a derived companion, not part of the map: one row per 60 fps
picture frame (`sampleFrame = 735·n`) with rotor angle (revolutions), speed, drive
torque, load, gear, chassis displacement and regime. Event maps only carry onsets; a
spinning motor will also need its continuous angle. Each map's `source` records the
generator's SHA-256 and the WAV's SHA-256.

## Reproduce

Node 22.18+ from a clean checkout; WAV, maps, schedules and telemetry need nothing else:

```sh
npm ci
node experiments/morph-07/render.ts work/m07-a --no-mp3
node experiments/morph-07/render.ts work/m07-b --no-mp3
for f in hypnotic-motor.wav awakening.wav hypnotic-motor.events.json awakening.events.json; do
  cmp work/m07-a/$f work/m07-b/$f && cmp work/m07-a/$f experiments/morph-07/candidates/$f; done
node bin/daemonv12.js sync experiments/morph-07/candidates/awakening.schedule.json --out work/awakening.events.json
cmp work/awakening.events.json experiments/morph-07/candidates/awakening.events.json
node --test tests/morph07-motor.test.ts
```

Drop `--no-mp3` to also encode MP3 and measure loudness with FFmpeg (`libmp3lame`).
MP3 bytes depend on the FFmpeg/LAME build; the WAV is the reference. As with MORPH v1,
synthesis uses JavaScript transcendental functions: pinned hashes are verified on the
supported Node runtime.

## Verification results

| | A — HYPNOTIC MOTOR | B — AWAKENING |
|---|---|---|
| Frames / seconds | 352,800 / 8.000 | 522,688 / 11.852 |
| WAV SHA-256 | `b8eac0b5…14fa466` | `9dbc701e…f45c3` |
| Integrated loudness / LRA | −12.3 LUFS / 4.8 LU | −12.6 LUFS / 8.5 LU |
| True peak, clipped samples | −1.0 dBTP, 0 | −0.97 dBTP, 0 |
| Events (tracks) | 118 (9) | 166 (9) |

- Two independent renders are byte-identical (WAV, maps, schedules, telemetry,
  verification). The Sync CLI rebuilds both maps byte-identically from the
  schedules, and every map passes `validateEventMap`.
- **A's groove:** in bars 1–2, odd sixteenths average +22.2 ms and even ones
  +1.5 ms (58% swing). The beat-4 drag is +34 to +47 ms (23–32 ms beyond the swing). The A1 lock arrives at
  6.499 s (beat 2 of bar 4) and the landing hits beat 3 at +5 ms.
- **A's loop:** the opening downbeat falls at frame 64; the closing one falls past the
  end, so it never sounds twice. The seam jump (126/3 LSB) is in the range of an
  ordinary sample step.
- **B's timeline:**
  - Dormant: jolts at 0.02 / 0.29 / 0.94 / 1.46 s, breakaway at 0.94 s.
  - Catch: servo lock at 2.686 s; fusion at 7.912 s.
  - Pitch arrivals: A1 8.309 s, D2 8.715 s, G2 9.551 s, D2 9.969 s.
  - Release: the last 100 ms are at −49 dBFS RMS.
- **Sustained motor tones** are 98–100% harmonic energy, so the locks are exact.
  Rhythmic sections keep 2.5–6 kHz within −20 to −27 dB of the total, enough
  articulation for phone speakers. The payoff is brighter but harmonic (tine partials
  locked on h12/h16/h36).
- Full numbers: [`candidates/verification.json`](candidates/verification.json).

Evaluation so far is analytical (spectra, timing, loudness, stems); it has not been
listened to. Worth judging by ear:
- whether A's ~0.27 s A1 lock is long enough;
- whether the payoff's commutator whine is pleasant on a phone;
- whether B's 3.75 s identity section holds attention.

## What deserves promotion into DaemonV12

1. **Promote now: rendered assets.** Freeze motor gestures as a MORPH v2 sampler pack
   (commutator tick, chassis kick, lock chords on a few roots, spin-up and brake
   gestures, the heartbeat), following the MORPH v1 recipe of pinned hashes and a
   catalog. This brings the sound into projects at zero engine risk.
2. **Promote soon: the emergent-event pattern.** A performer that times its own events
   (impacts gated by visual resolvability, regime boundaries, pitch arrivals, scored
   torque marks) is the reusable lesson for the Sync Pack. The library needed nothing
   new. A small documented convention for these roles, plus an optional continuous
   "curve" companion format, would serve every future procedural instrument better
   than overloading onsets.
3. **Later: a controlled synthesis interface.** Expose `Rotor` + commutator + tines as an
   offline rendered-performance generator with a validated JSON score. Not yet:
   balancing pitched sections still relies on scored tine level/damping, B's dormant
   choreography needed tuning against the simulation, and the score format has no
   diagnostics.
4. **Keep experimental:** mix constants, the room, and the two-pass catch.
