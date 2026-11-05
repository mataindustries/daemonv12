# DAEMON//MUTATION 001 · THE LIVING INSTRUMENT

Sound-design auditions derived from the SODIUM HOURS (HEADLINER 001) synthesis toolkit. These are new instruments, not a
song: each audition is a short, original phrase.

> **Status: waiting for the owner to listen.** Nothing here is published, released or merged. Licensing is pending the owner's declaration
> (nothing in this folder grants a license). The producer was an AI agent that **cannot hear audio**: every
> description below is design intent or a signal measurement, not a listening impression or a quality score.

| Mutation | State |
|---|---|
| **A · LIVING BASS** | **Approved by the owner after listening.** Three auditions, WAV + MP3; frozen |
| **B · IMPOSSIBLE VOICE** | Done: three auditions, WAV + MP3; waiting for the owner to listen |
| **C · MECHANICAL ORCHESTRA** | Done: three auditions, WAV + MP3; waiting for the owner to listen |

## A · LIVING BASS

| File (WAV + MP3 in [`auditions/a-living-bass/`](auditions/a-living-bass)) | Length | What it is |
|---|---:|---|
| `a1-living-bass-transformation-dry` | 26.0 s, mono | The main audition. One continuous ten-bar take that turns from a warm West Coast groove into a growling machine |
| `a2-living-bass-transformation-context` | 26.8 s, stereo | The same take over drums and FM keys (unchanged HEADLINER 001 patches, the same pattern throughout), so only the bass changes |
| `a3-living-bass-states-dry` | 18.2 s, mono | The opening two-bar riff three times, with the morph held at 0, 0.5 and 1: a direct comparison of the states |

**a1 form.** 96 BPM, D minor, 57 % swing, original riff (not from SODIUM HOURS).

| Bars | Time | Morph | Rhythmic modulation inside the bass | Riff |
|---|---|---|---|---|
| 1–2 | 0:00 | 0 | none | **A**: root scooped from below, finger slides (A1→C2→A1, C2↘D1 over ten semitones), octave pops |
| 3–4 | 0:05 | 0 → 0.38 | eighths, harmonics breathe | **A′**: B♭–A7 turnaround, chromatic C♯ |
| 5–6 | 0:10 | 0.38 → 0.72 | swung sixteenth accent pattern | **B**: held notes that pulse; the G1↘D1 slide starts to ratchet |
| 7–8 | 0:15 | 0.72 → 1 | sixteenth triplets against the swing, then rising ramps | **B′**: a G1↗B♭1 servo slide and a nine-semitone ratchet climb E1↗C♯2 |
| 9–10 | 0:20 | 1 | 32nds, then 64ths (25.6 Hz: the rhythm becomes the growl) | **A returns as the machine**; the last D1 powers down, diving seven semitones in steps |

**The instrument** ([`tools/living-bass.ts`](tools/living-bass.ts)). It renders a whole phrase as one performance, so the timbre can move
continuously under a groove. Everything is phase-locked to one oscillator phase, so the sub and the growl never beat against each
other.

- *Warm end:* a sine core with gentle 1:1 phase modulation and light sine folding, through a vactrol-style low-pass gate that opens on
  each strike and closes slowly as it dims. Under it is a clean, constant sine sub. Slides are a damped spring, like a
  finger, and a fresh pluck starts slightly sharp.
- *Machine end:* deep sine folding plus 1:1 and 1:2 phase modulation (a sub-octave grind). Then come a phase-locked sub-octave "gear" chopper,
  asymmetric tube drive, and a pitch-tracked resonator that only lifts octaves and fifths (2, 3, 4, 6 × f0), so the
  growl stays in tune. Seven inharmonic modal "chassis" resonances are struck by accents. Slides become an overshooting servo that
  ratchets through semitones and clicks the chassis on every step.
- *Rhythmic modulation:* a tempo-synced step lane ([`tools/score.ts`](tools/score.ts) `motionLane`) drives fold depth, sub-grind,
  gate opening, gear depth and which harmonic is lifted. Its division speeds up across the take, from eighths to 64ths.
- *Independent controls:* pitch (per note, plus slide time, scoop and dive), gate length, articulation (accent, ghost, staccato,
  legato slide), the `morph` macro, and each of the 13 timbre dimensions as its own lane (`over: { drive, fold, gear, … }`).
  `bassMacro(m)` is only the default path from warm to machine.

**Measurements** (dry renders; plain signal statistics, from `auditions/manifest.json`):

| a1 section | RMS (dB re peak) | Spectral centroid | Energy above 150 Hz |
|---|---:|---:|---:|
| bars 1–2 | −14.3 | 59 Hz | 3.8 % |
| bars 3–4 | −14.1 | 100 Hz | 16.2 % |
| bars 5–6 | −13.6 | 141 Hz | 32.3 % |
| bars 7–8 | −12.7 | 240 Hz | 38.3 % |
| bars 9–10 | −14.1 | 243 Hz | 39.9 % |

a3 states: morph 0 → centroid 59 Hz / 3.7 %; morph 0.5 → 128 Hz / 29.8 %; morph 1 → 227 Hz / 37.0 %. RMS stays within
1.6 dB across the take, so the change is in the timbre, not just the level.

## B · IMPOSSIBLE VOICE

| File (WAV + MP3 in [`auditions/b-impossible-voice/`](auditions/b-impossible-voice)) | Length | What it is |
|---|---:|---|
| `b1-impossible-voice-transformation-dry` | 29.4 s, stereo | The main audition: three voices and their glass halo, no room. Four phrases, from a restrained human-like voice to the alien |
| `b2-impossible-voice-transformation-context` | 30.0 s, stereo | The same performance with an FDN hall, warm Living Bass on the roots (A's code, unchanged, morph 0.05) and a heartbeat kick, all fixed |
| `b3-impossible-voice-states-dry` | 25.6 s, stereo | Phrase 1 sung three times with the morph held at 0, 0.5 and 1 |

**b1 form.** 78 BPM, B minor, original phrases (nothing from SODIUM HOURS). No words and no language.

| Phrase | Time | Morph | What happens |
|---|---|---|---|
| 1 | 0:00 | 0 | An inhale. A hum opens into "oo". A restrained line B4–A4–F♯4 glides up a sixth to D5, the vowel drifting from "oh" toward "ah", then settles on B4 |
| 2 | 0:06 | 0 → 0.18 | The answer climbs to E5 with a small voice break (an upward flip). A second voice enters **in unison** on G4, then slides away to sing beneath. The phrase ends with a sighing fall to F♯4 |
| 3 | 0:12 | 0.18 → 0.66 | A third, giant-throated voice holds B3 and A♯3. An **overtone melody** appears above the lead. Formants split into pairs, the harmonic series starts to bend, and the vibrato moves from the pitch into the spectrum. Climax on F♯5 |
| 4 | 0:18 | 0.66 → 1 | **Phrase 1 returns, sung by the alien.** Bell-like stretched harmonics, an undertone an octave below, a hollow tone as the even harmonics fade. The glass halo rings with each note and with the breath. Over the held D5 the overtone melody climbs A6–D7–F♯7–A7. The last B4 evaporates: its harmonics detune apart and the high ones linger. One exhale through the glass |

**The instrument** ([`tools/impossible-voice.ts`](tools/impossible-voice.ts)). Built on the same source-filter idea as the SODIUM HOURS
talkbox, but rebuilt as an additive voice. Every harmonic is its own oscillator. Its amplitude is a glottal source tilt times a
five-formant cascade evaluated at that harmonic's frequency, so vowels move smoothly with no filter-coefficient jumps, and no vowel ever
sweeps at an onset. Vowels drift slowly across a whole note. A soprano-style F1 rises above the fundamental on high notes. A hum ("mm")
is a closed-mouth vowel.

- *Human dimensions:* pitch-synchronous aspiration (breath), source tilt, tract size, delayed vibrato with drift and jitter, onset
  scoop, voice-break "cry", sighing fall, legato glides, and inhales and exhales placed by the score.
- *Impossible dimensions*, each its own lane:
  - `stretch`: harmonic n sits at n^(1+σ)·f0, so the series bends into a bell while the pitch holds.
  - `split`: each formant becomes a pair.
  - `under`: an undertone series of odd multiples of f0/2.
  - `whistle` with the `overtone` lane: an overtone-singing emphasis that steps between harmonics (octaves, fifths and the third of
    the sung note, chosen to sit inside the chord).
  - `shimmer`: vibrato migrates into the spectrum.
  - `even`: hollowing.
  - `glass`: send to `glassHalo`, six pairs of sympathetic high-Q resonators on B5 D6 F♯6 A6 B6 C♯7, excited by the voices and the
    breath.
  - `disperse`: the harmonics drift apart and the high ones decay last.
- `voiceMacro(m)` is only the default path from human to alien. Each of the 12 dimensions, plus pitch, gate length, articulation and
  the vowel path, can be set on its own.

**Measurements** (mono fold-down of the dry renders, from `auditions/manifest.json`):

| b1 phrase | RMS (dB re peak) | Spectral centroid | Energy above 2 kHz | Halo re voices |
|---|---:|---:|---:|---:|
| 1 | −16.4 | 631 Hz | 0.2 % | −19.4 dB |
| 2 | −15.3 | 664 Hz | 0.3 % | −17.8 dB |
| 3 | −13.2 | 886 Hz | 6.5 % | −9.4 dB |
| 4 | −14.3 | 900 Hz | 12.8 % | −12.4 dB |

b3 states: morph 0 → centroid 631 Hz / 0.2 %; morph 0.5 → 931 Hz / 2.8 %; morph 1 → 971 Hz / 15.4 %.

The overtone melody shows up in the spectrum. Over the held D5 in phrase 4, the strongest peak between 1.5 and 6 kHz moves 2406 → 3101 →
3628 Hz, tracking stretched harmonics 4, 5 and 6, at about −11 dB re the spectrum maximum. A click scan (2 ms windows of
second-difference energy against the local median) found nothing in b1 and b3. In b2 it flagged only the heartbeat kick's attack at
0:00.

## C · MECHANICAL ORCHESTRA

| File (WAV + MP3 in [`auditions/c-mechanical-orchestra/`](auditions/c-mechanical-orchestra)) | Length | What it is |
|---|---:|---|
| `c1-mechanical-orchestra-transformation-dry` | 27.6 s, stereo | The main audition: six machine families, no room. Twelve bars, from a clockwork music box to strange machines |
| `c2-mechanical-orchestra-transformation-context` | 27.6 s, stereo | The same performance in an FDN hall over a half-time kick and snare that never change (HEADLINER 001 patches) |
| `c3-mechanical-orchestra-states-dry` | 18.3 s, stereo | The two-bar theme on bars, tines, spring and clock with the morph held at 0, 0.5 and 1 |

**c1 form.** 112 BPM, A minor (Am · Fmaj7♯11 · Dm9 · E7 · Am), straight sixteenths with seeded micro-timing, velocity
variation and the odd missed tick. The theme, variations and parts are original.

| Bars | Time | Morph | What happens |
|---|---|---|---|
| 1–2 | 0:00 | 0 | **A clockwork music box.** Two tuned bars hocket the theme left/right, with vibraphone-style motor tremolo. Clean steel tines play dotted eighths (3 against 4). An escapement ticks sixteenths, with a tock on 1 and 3 |
| 3–4 | 0:04 | 0 → 0.35 | The spring bass ostinato enters as a nearly harmonic plucked steel string. The bars' modes begin to leave their consonant tuning |
| 5–6 | 0:09 | 0.35 → 0.5 | **Friction:** bowed metal (D and A) swells under the melody's high point. The tines start to buzz against their bridge |
| 7–8 | 0:13 | 0.5 → 0.72 | E7 tension. A busier spring figure with dispersion chirps, and a bow on E–B then G♯–D. The first bearings fall, and the clock starts to sprout spring "zips" |
| 9–10 | 0:17 | 0.72 → 1 | **The theme returns on the strange machines.** Alien gong bars with slowly beating twin modes, a laser-spring bass and buzzing tines. Bow overpressure grows subharmonics, first an octave and then a twelfth below. The clock zips and the bearings thicken |
| 11–12 | 0:21 | 1 | Cadence onto A. A last bowed A–E–C chord rings under the rain of bearings, then fades |

**The machines** ([`tools/mechanical-orchestra.ts`](tools/mechanical-orchestra.ts)). Each one is a playable note function: pitch,
velocity, morph and its own articulation inputs.

- `malletBar`: a modal bar whose five mode ratios move along a path, from tuned 1:4:10 (consonant), through a free-free bar
  1:2.756:5.404, to an alien set 1:1.493:2.41:3.73:6.13 with slowly beating twin modes. Controls: hardness, damping, detune.
- `bowedBar`: the same modes driven by friction, as a stick-slip pulse train plus rosin noise. Controls:
  - bow pressure envelope;
  - `chatter`, irregular slips;
  - `sub`/`subN`, overpressure that skips slips and produces subharmonics.
- `spring`: a dispersive coil spring. A delay loop runs through up to 53 first-order all-passes, so low frequencies travel slower.
  It is tuned so the low harmonics are exact; at morph 1 the spectrum of A1 is 55.2 / 109.7 / 164.9 / 220.0 / 275.2 Hz. Morph
  raises the dispersion from a near-harmonic plucked string to a chirping laser spring. Controls: attack twang (`bend`), decay.
- `tine`: a clamped steel tine (cantilever modes 1:6.27:17.55:34.39) with a sitar-like bridge-contact `buzz`.
- `tick`: an escapement tick or tock. The strange clock adds tiny high springs.
- `bearings`: in the score, Poisson-timed tiny `malletBar` pings on the current chord tones, thickening over time.

The ensemble is one score (`c-mechanical-orchestra.ts` `play()`). Its parts interlock: the hocket, 3 against 4, the bass ostinato,
the clock grid and the bowed chords. Family levels are set in dB against a calibrated reference note of each machine.

**Measurements** (mono fold-down of the dry renders, from `auditions/manifest.json`):

| c1 section | RMS (dB re peak) | Spectral centroid | Energy above 2 kHz |
|---|---:|---:|---:|
| bars 1–2 | −23.3 | 855 Hz | 5.4 % |
| bars 3–4 | −19.9 | 647 Hz | 4.3 % |
| bars 5–6 | −17.8 | 626 Hz | 2.9 % |
| bars 7–8 | −16.8 | 665 Hz | 3.3 % |
| bars 9–10 | −16.5 | 674 Hz | 2.5 % |
| bars 11–12 | −17.8 | 740 Hz | 3.6 % |

Per-family RMS by section is in `manifest.json` (`c1FamilyRmsDb`). In bars 9–10 the bars are at −1.2 dB, spring −5.5, bow −4.3,
tines −12.7, bearings −20.9 and clock −21.3. c3 states: morph 0 → 673 Hz / 3.9 %; morph 0.5 → 607 Hz / 2.0 %; morph 1 → 765 Hz /
2.8 %.

The brightness does not climb as the machines turn strange. The change is in harmonicity, beating, friction and dispersion, not in
distortion. Within the c1 RMS figures, about 7 dB of build comes from parts entering.

Tuning changes made from measurements before delivery:

- Bow level is held constant across the morph (it had fallen 13 dB toward the alien end).
- Tine buzz is level-compensated (it had added about 10 dB).
- The bar's near-unison twin modes no longer cancel (they cost 6.5 dB at morph 0.5).
- The spring's raw impulse pluck became a smooth zero-mean pulse. It had produced clicks with a crest factor near 28 dB, and those
  had forced the true-peak ceiling.

The click scan is clean on c3. On c1/c2 it flags six spring pluck attacks in quiet moments, the bass's first entry among them.

## Loudness

Every audition is set by a single gain to **−19 LUFS integrated** (FFmpeg `ebur128`), with a −1 dBTP true-peak ceiling and no
compression or limiting. −19 LUFS is the highest common level that the sub-heavy dry bass reaches without limiting. The DaemonV12
engine's own `daemonv12 analyze` gives the same result:

- a1 −19.16 LUFS / −2.42 dBTP; a2 −19.16 / −4.52; a3 −18.99 / −1.52.
- b1 −19.03 / −6.62; b2 −19.08 / −6.12; b3 −19.17 / −7.62.
- c1 −19.25 / −3.54; c2 −19.23 / −3.54; c3 −19.17 / −1.91.

No file has any full-scale samples.

## Reproduce

From the repository root, with Node 22.18+ and FFmpeg with libmp3lame (6.1.1 used):

```bash
node mutation-001/tools/a-living-bass.ts
```

```bash
node mutation-001/tools/b-impossible-voice.ts
```

```bash
node mutation-001/tools/c-mechanical-orchestra.ts
```

```bash
cd mutation-001/auditions && sha256sum -c SHA256SUMS
```

The scripts take about 13 s, 21 s and 17 s and need no input files. Each mutation script rewrites only its own section of `manifest.json`
and `SHA256SUMS`. Two runs of each produced byte-identical WAV **and** MP3 files. `auditions/manifest.json` records each file's
loudness, true peak, LRA and SHA-256, the SHA-256 of every generator file, and the Node version.

## Provenance

- `tools/dsp.ts` and `tools/instruments.ts` are copied **unmodified** from `headliner-001/tools/` on branch
  `claude/peaceful-bardeen-f7swi8` at commit `6b1ab7b` (git blobs `7bfc3aa`, `819053b`; SHA-256 `594be2c4…`, `03bd48ff…`). They
  supply the DSP primitives (oscillators, ZDF filters, decimator) and, for `a2` only, the context drum and FM-keys patches. The kick
  is retuned to D1 through its existing `f0` argument.
- New code: `score.ts`, `living-bass.ts`, `deliver.ts`, `a-living-bass.ts` (A, frozen); `lanes.ts`, `impossible-voice.ts`,
  `b-impossible-voice.ts` (B); `mechanical-orchestra.ts`, `c-mechanical-orchestra.ts` (C). B and C only import A's files,
  so A's recorded generator hashes still match. The vowel formant figures in
  `impossible-voice.ts` are approximate textbook ranges for sung vowels (numbers, not audio).
- No recordings, samples, loops, SoundFonts, impulse responses, presets or third-party audio. SODIUM HOURS' melody,
  harmony and arrangement are not used: the riff, key, tempo and form are new. SODIUM HOURS and its master are untouched, on their own branch.
- License: **pending the owner's declaration**, as for SODIUM HOURS.

## Risks to check by listening

- Nobody has listened to any of this yet. The machine end uses strong drive and folding and may be harsher than wanted; `over.drive`
  and `over.fold` lanes can turn it down without touching the other dimensions.
- The warm end is mostly fundamental (centroid 59 Hz), so it may thin out on small speakers.
- Bars 9–10 modulate at 25.6 Hz on purpose, so that the rhythm turns into a growl. It may read as buzz.
- A: the later click scan flags transients in a1 and a3 from bar 4 on. They line up with the designed chassis strikes and ratchet clicks
  (the approved "bite"). A was not changed.
- B has not been listened to.
  - The human phrases are deliberately dark and intimate (0.2–0.3 % of the energy above 2 kHz) and may read as muffled.
  - The overtone melody may read as a whistle rather than part of the voice.
  - In phrase 4 the stretched harmonics are inharmonic by design and may sound out of tune against the context bass.
  - How much the halo rings depends on vibrato sweeping the harmonics through very narrow resonances.
- C has not been listened to.
  - The bars carry the melody and are the loudest family. The clock sits 15–20 dB under them and may be too faint or too busy.
  - In bars 3–8 the mode ratios are partway between tunings and inharmonic; that may read as out of tune rather than strange.
  - In the last bars the bow's twelfth-below subharmonic may read as grind.
  - The spring pluck attacks are deliberate transients.
