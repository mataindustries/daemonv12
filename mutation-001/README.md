# DAEMON//MUTATION 001 · THE LIVING INSTRUMENT

Sound-design auditions derived from the SODIUM HOURS (HEADLINER 001) synthesis toolkit. These are new instruments, not a
song: each audition is a short, original phrase.

> **Status: waiting for the owner to listen.** Nothing here is published, released or merged. Licensing is pending the owner's declaration
> (nothing in this folder grants a license). The producer was an AI agent that **cannot hear audio**: every
> description below is design intent or a signal measurement, not a listening impression or a quality score.

| Mutation | State |
|---|---|
| **A · LIVING BASS** | Done: three auditions, WAV + MP3 |
| B · IMPOSSIBLE VOICE | Not started (see [MUTATION_PROGRESS.md](MUTATION_PROGRESS.md)) |
| C · MECHANICAL ORCHESTRA | Not started |

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

## Loudness

Every audition is set by a single gain to **−19 LUFS integrated** (FFmpeg `ebur128`), with a −1 dBTP true-peak ceiling and no
compression or limiting. −19 LUFS is the highest common level that the sub-heavy dry bass reaches without limiting. The DaemonV12 engine's
own `daemonv12 analyze` gives the same result: a1 −19.16 LUFS / −2.42 dBTP, a2 −19.16 / −4.52, a3 −18.99 / −1.52, no full-scale
samples. Later mutations use the same target.

## Reproduce

From the repository root, with Node 22.18+ and FFmpeg with libmp3lame (6.1.1 used):

```bash
node mutation-001/tools/a-living-bass.ts
```

```bash
cd mutation-001/auditions && sha256sum -c SHA256SUMS
```

It takes about 13 s and needs no input files. Two consecutive runs produced byte-identical WAV **and** MP3 files. `auditions/manifest.json` records
each file's loudness, true peak, LRA and SHA-256, the SHA-256 of every generator file, and the Node version.

## Provenance

- `tools/dsp.ts` and `tools/instruments.ts` are copied **unmodified** from `headliner-001/tools/` on branch
  `claude/peaceful-bardeen-f7swi8` at commit `6b1ab7b` (git blobs `7bfc3aa`, `819053b`; SHA-256 `594be2c4…`, `03bd48ff…`). They
  supply the DSP primitives (oscillators, ZDF filters, decimator) and, for `a2` only, the context drum and FM-keys patches. The kick
  is retuned to D1 through its existing `f0` argument.
- New code: `score.ts`, `living-bass.ts`, `deliver.ts`, `a-living-bass.ts`.
- No recordings, samples, loops, SoundFonts, impulse responses, presets or third-party audio. SODIUM HOURS' melody,
  harmony and arrangement are not used: the riff, key, tempo and form are new. SODIUM HOURS and its master are untouched, on their own branch.
- License: **pending the owner's declaration**, as for SODIUM HOURS.

## Risks to check by listening

- Nobody has listened to any of this yet. The machine end uses strong drive and folding and may be harsher than wanted; `over.drive`
  and `over.fold` lanes can turn it down without touching the other dimensions.
- The warm end is mostly fundamental (centroid 59 Hz), so it may thin out on small speakers.
- Bars 9–10 modulate at 25.6 Hz on purpose, so that the rhythm turns into a growl. It may read as buzz.
- Automated checks covered peak, clipping, loudness and determinism only. Nothing scanned for clicks.
