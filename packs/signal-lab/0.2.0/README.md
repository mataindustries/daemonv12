# SIGNAL instrument prototype v0.2 (9 WAVs)

A deliberately small expansion for DaemonV12 0.7. It tests one question: do sustained instruments make cinematic writing better than the Orbital Foundry and GLASSHOUSE packs, which have no sustained tonal source? It is a sonic experiment, not a library and not an engine change.

**Rights: PENDING OWNER REVIEW.** No licence is granted or implied. No CC0 or other dedication is made on the owner's behalf. Commercial-use authorization is the repository owner's decision.

## Provenance

Every file is produced by `generate-signal-instruments.mjs` v0.2.0:
- Node built-ins only (`node:fs` for writing, `node:path`, `node:crypto`). It reads no files.
- float64 additive synthesis at 44.1 kHz. Every partial is a sine kept below 18 kHz, so nothing aliases.
- One explicit xorshift32 seed per sound, recorded in the catalog.
- No `Math.random`, clock or network.
- PCM16 by explicit rounding, no dither. First and last frames are exactly 0.

No recordings, downloaded samples, loops, SoundFonts, impulse responses, pretrained-model audio, third-party audio or existing melodies were used.

```sh
node generate-signal-instruments.mjs <output-dir>   # writes <out>/assets/signal-lab/** and <out>/signal-lab.catalog.json
```

Independent runs on the build machine produced byte-identical output for all 13 files (9 WAVs, 3 kit.json, catalog); see `SHA256SUMS.txt`. Floating-point differences between Node or CPU builds could change least-significant bits, so byte identity across environments is not promised.

## Families (measured values)

| File | Pitch / chord | Length | Ch | Peak | What it is |
|---|---|---:|:-:|---:|---|
| `pad/pad-csm.wav` | C# minor: C#3 G#3 C#4 (D#4→E4) G#4 | 8.0 s | S | −8 dBFS | **Evolving pad.** String-choir hybrid. Opens as sus2; the minor third arrives at 1.4–2.4 s. Spectral tilt opens and settles, a vowel formant pair morphs oo→ah→eh→oo, the odd/even balance breathes, and each partial has its own slow seeded shimmer. Release 6–8 s to exact zero. |
| `pad/pad-cs.wav` | C# major: C#3 G#3 C#4 (D#4→E#4) G#4 | 8.0 s | S | −8 dBFS | The same instrument; the third that arrives is E#. Played at rate 0.793701 it becomes A major, at 0.749154 G# major. |
| `lead/lead-cs4.wav`, `lead-e4.wav`, `lead-es4.wav`, `lead-gs4.wav`, `lead-a4.wav` | C#4, E4, E#4, G#4, A4 (the SIGNAL motif) | 4.0 s each | M | −8.3 … −4.3 dBFS | **Expressive lead.** A "bowed glass voice". Harmonic body with fixed alto/viola formants (600, 1400, 3000 Hz). 20-cent onset scoop, a bow-bite accent then a swell. Vibrato starts after 0.30 s (±13 cents measured, rate seeded per pitch around 5.3 Hz). Brightness rises with level. A brief glass-mode sheen on the attack (ratios 2.756 / 5.404 / 8.933, borrowed from GLASSHOUSE's glass model). Band-limited breath noise. |
| `swell/swell-dark.wav` | G#5 → G#7sus4 → G#7♭9 | 4.0 s | S | −6 dBFS | **Harmonic swell** (tension, minor key). The voices enter and move: C#5 slides to B#4 and A4 enters at 2.6 s. Crescendo from −24 dB, brightness opens, and a tremolo accelerates from 3 to 11 Hz. A 6 ms fade-in at the start. It ends **at full level** (12 ms taper), so it can be cut to silence or butt into a downbeat. |
| `swell/swell-bright.wav` | A(add9) → B major (♭VI → ♭VII of C#) | 4.0 s | S | −6.2 dBFS | **Harmonic swell** (hope). Every voice glides up a whole step at 1.0 s, the top climbs to D#5 at 2.0 s, and the vibrato deepens. Same edges. No noise riser. |

Measured:
- **Lead:**
  - Tuning within 1 cent of A4 = 440 Hz.
  - 9–16 harmonics within 40 dB.
  - The fundamental holds 39–63 % of the sustain energy, with 4–5.5 % in 2–5 kHz. The centroid is 744–793 Hz (GLASSHOUSE glass-hit: 813 Hz).
  - All five pitches sit at equal sustain loudness (−14.6 LUFS each).
- **Pads:** power-spectrum centroid about 620–635 Hz in the sustain, moving over the file.
- **Stereo:**
  - Each chord tone is three detuned voices (left-leaning, centre, right-leaning). Tones below 200 Hz are centred.
  - Side energy: 11 % (pads), 15 % / 9 % (swells).
  - The mono sum is 0.4–0.7 dB below the stereo RMS.

**v0.2 changes (after an independent audit of v0.1):**
- The swells started with a one-sample step; they now have a 6 ms fade-in.
- swell-bright's low end was not mono; voices under 200 Hz are now centred.
- Lead loudness spread 2 LU across pitches; the leads are now normalized to equal sustain RMS.
- The leads and pads were very dark (lead fundamental share 59–91 %, about 1 % in 2–5 kHz); both are now brighter.
- The catalog now hashes the three kit.json files.

## Using them in DaemonV12 0.7

Copy `assets/signal-lab/` into a project's `assets/`. Each family is a drum kit, because a sampler track holds one WAV:

```json
{"type": "drumkit", "kit": "assets/signal-lab/lead/kit.json"}
{"start": "1:2", "pitch": "lead-a4", "velocity": 0.9, "gate": "11/32", "envelope": {"releaseSeconds": 0.12}}
```

Names: `pad-csm`, `pad-cs`, `lead-cs4`, `lead-e4`, `lead-es4`, `lead-gs4`, `lead-a4`, `swell-dark`, `swell-bright`.
- Other pitches: use `playbackRate = 2^(n/12)` (pitch and length change together).
- For a plain chord without the sus2 opening, start a pad with `offsetSeconds: 2.6`.
- Shorten lead notes with `gate` plus a release of about 0.1 s.

`signal-lab.catalog.json` lists every file's pitch, chord or voice timeline, frames, measured peak/RMS/width, seed, full synthesis parameters and SHA-256, plus the kit hashes.
