# AFTERIMAGE//PULSE V2 · DaemonV12 Sound Lab 03

E major, 136 BPM, 2-step swing. 28 bars plus 2.0 s of ring: **51.4 s**. V2 developed V1 in one creative revision, one
candidate render and one bounded QA/fix pass. **Work stops here for listening review.**

V1 is unchanged for comparison, in [`../afterimage-pulse-001/`](../afterimage-pulse-001/README.md). Its delivery still
verifies against its own `SHA256SUMS`, and git sees no change there
([`v1-unchanged.txt`](delivery/provenance/v1-unchanged.txt)).

**Nobody has listened yet.** The composer is an AI agent and cannot hear audio. Musical statements are intent; numbers
are signal measurements.

## Listen

| File (`delivery/`) | What it is |
|---|---|
| `afterimage-pulse-v2.mp3` | Phone copy, 320 kbps, −15.1 LUFS, −1.2 dBTP |
| `afterimage-pulse-v2.wav` | Lossless, 24-bit / 44.1 kHz, the same master |
| `stems/*.flac` | Ten sample-aligned key stems, pre-master |
| `source/afterimage-pulse-v2.mid` | Every part as MIDI |

The master is gain-matched toward −14 LUFS under the −1 dBTP ceiling. Kick peaks stop it at −15.1, and nothing was
limited to chase the number.

## V1's three main weaknesses (read from its score)

1. **The hook had one sound and one performance.** Every pulse pair was played the same way, with the same glide, the
   same velocities and a flat timbre per section. The opening was a filtered pluck, the toy-like part. The payoff's main
   move was the same notes an octave up and brighter.
2. **The rhythm section was a loop.** The 8-bar groove was the same 4 bars twice. The kick sat on 1 and the and-of-3 in
   every bar, the bass repeated one pattern per chord, and the bass and kick never argued with the hook. The glitch
   passage was a different loop: the voice and bass took turns and built nothing together.
3. **The return restated instead of transforming.** Its harmony and rhythm were the opening's; the choir only doubled the
   long notes.

## What changed (one deliberate revision)

### 1 · The hook's voice

- **No pluck.** THRONE//VOLT plays the hook from the first bar.
- **Each pair is closed, then open.** The pickup is dark; the held note opens through a sync sweep written per note,
  a "da-YOW", the hook's own vowel.
- **Long notes grow.** Growl arrives late in them, with late vibrato.
- **The three pairs in a bar crescendo slightly,** so the descending line leans forward.
- **Three characters, not one brightness:**
  - **dark and close** (bars 1–4): low macro, slow vocal swoops, an open "aw" throat;
  - **talking** (5–12): faster swoops, more drive and heat. The second statement develops the melody: the answer rises
    to F♯ instead of settling, and the reach goes up to A;
  - **full voice** (payoff): more heat and sub weight, in the **original octave**. It relaxes to a warm, vibrato-led E at
    the resolution.

### 2 · The groove (bars 5–12)

- **Eight bars, no two alike.**
  - Kicks move from bar to bar: 1 and the and-of-3; a late kick on the 12th sixteenth; a pickup kick into the next bar.
  - The snare drags to the 14th sixteenth once (bar 8).
  - Ghost notes and wood answers move; three hat-accent patterns rotate.
- **Bars 5–8:** the bass supports, then answers each held note with a phrase of its own (different in bars 6 and 8).
- **Bars 9–11:** the bass **breaks into dotted eighths**, the afterimage's own delay, against the hook's 2+3. It drags
  the kick with it:
  - there is no downbeat kick in bars 10 and 11;
  - everything **realigns on bar 12's downbeat** (0:19.4).

  That is forward motion without a fill.

### 3 · The glitch passage (bars 13–16): the melody taken apart and rebuilt by two bodies

| Bar | Time | Voice (Impossible Voice) | Bass (Living Bass) |
|---|---|---|---|
| 13, Am | 0:21.2 | Sings only the pickups, a closed "ee" | Sings the held notes, two octaves down, scooping up into each |
| 14, B7 | 0:22.9 | They swap. The voice takes the held notes; the second cries up to A and bends its vowel ah → ee | Takes the pickups, then growls a held B under the cry |
| 15, Cmaj7♯11 | 0:24.7 | Becomes the bass's afterimage: a dotted eighth behind, two octaves up | Leads the hook's lydian shadow; there is no downbeat kick |
| 16, D7 | 0:26.5 | Converges with the bass in octaves on the quickened pairs | (same) |

- **Vowels follow the hook's gesture:** closed on the pickups, open on the held notes.
- **The ticks mark the delay:** the clock ticks only where the voice's afterimage enters.
- **Space tells the story:** the voice's pickups sit left, its held notes right, the canon further right, and the octaves
  converge to centre.
- **Then three sixteenths of total silence** (0:27.1, 318 ms, −25 dB under the bar before). The cry follows, alone, and
  carries into the choir.

### 4 · The payoff (bars 21–28), new material

| Bars | Time | What happens |
|---|---|---|
| 21 | 0:35.3 | **C → A lifts.** The choir's G literally moves to G♯ as the descant begins |
| 21–24 | 0:35.3 | **A descant rises one step a bar** (G♯5, A5, B5, C♯6) against the hook's falling line. It is a new countermelody in the sopranos; the choir no longer doubles the hook |
| 23 | 0:38.8 | **The hook over the tonic, for the first time.** The bass drops to a low E under the same notes that have floated over A all record |
| 24 | 0:40.6 | **The bass finishes the hook.** The lead plays only the answer's first pair; the bass completes it with the swoop itself (E→B) and walks on |
| 25–26 | 0:42.4 | **The pulse breaks free.** Seven pulse pairs, one every 5 sixteenths, cross the bar lines. They climb (E4→C♯5 … D♯5→B5) while the bass falls A–G♯–F♯–B under them. Kick and bass hit every pickup; the snare holds 2 and 4. The cycle **realigns exactly on bar 27's downbeat** |
| 27 | 0:45.9 | Lead and descant **meet on B**. Then the hook's resolving pair: **D♯ → E** (0:46.7), with a low E, a kick and the full chord |
| 28 | 0:47.6 | The band releases. The music box plays **the opening image** once more (E, D♯, then C♯ left ringing) over a last heartbeat |

**Kept as V1:** the vulnerable passage (bars 17–20), note for note, with the same singers, including the sink into
C major at 0:33.3. Also kept: the drum sounds and the opening's music-box texture.

**Not used:** risers, impacts, stutter edits, supersaw stacks, CATHEDRAL//ENGINE, blackout devices. No new instrument
and no engine change were needed.

## Technical QA (one bounded pass)

Measured with [`qa/measure.py`](qa/measure.py) (V1's tool, plus measurements for the descant and the silent hole).
Records: `delivery/provenance/qa-candidate.json` and `qa-final.json`.

**Reproducibility:**

- `node build.ts --candidate` regenerates the measured candidate's engine project byte for byte.
- The candidate master's SHA-256 is `19c0797c…`.
- The fix pass changed only the mix, so all six rack renders were reused.

| # | Found in the candidate | Fix | Before → after |
|---|---|---|---|
| F1 | **In the payoff, the descant covered the hook.** During the lead's notes it was louder than the lead in 1–4 kHz | Lead +4 dB written (it feeds a 2:1 compressor); descant −3 dB | Lead over the rest, 300 Hz–1 kHz / 1–4 kHz: −0.5 / −1.8 → **+2.4 / +2.5 dB**. The descant now sits under the hook (−3.8 dB in 1–4 kHz) |
| F2 | The glitch voice sat under the melodic bass in 1–4 kHz | Voice +3 dB written; the bass's glitch level −1 dB | Voice 1–4 kHz −3.4 → **−2.1 dB**, 300 Hz–1 kHz +3.1 → +4.7 dB |
| F3 | The glitch was the narrowest passage (side 23.1 dB under mid) | The voice's pan lane, as described above | Side/mid −23.1 → **−19.8 dB** |
| F4 | The opening was 2 LU louder than V1's, which flattened the arc | Opening lead −2.5 dB | Opening −17.5 → −18.7 LUFS; section contrast 4.4 → **5.1 LU**; LRA 5.8 → 6.7 |

**Final:**

| | V2 final | V1 final |
|---|---|---|
| Loudness / true peak (WAV · MP3) | −15.1 LUFS / −1.2 · −1.2 dBTP, LRA 6.7 | −14.9 / −1.2 · −1.3, LRA 7.0 |
| Mono fold-down loss | 0.21 LU | 0.22 |
| Sections: image · pulse · glitch · afterimage · payoff (LUFS) | −18.7 · −14.5 · −15.0 · −18.1 · −13.6 | −19.5 · −14.2 · −14.2 · −18.0 · −13.5 |
| Kick hit over the preceding 180 ms: image · pulse · glitch · payoff | 19.5 · 15.3 · 13.9 · 14.0 dB | 21.4 · 14.8 · 13.7 · 13.6 |
| Snare hit: pulse · glitch · payoff | 11.8 · 11.6 · 11.5 dB | 10.9 · 12.1 · 10.9 |
| Below 120 Hz: L/R correlation; side under mid | 0.9994; −35 dB | 0.9998; −40 |
| Lead over the rest (300 Hz–1 kHz / 1–4 kHz): image · pulse · payoff | +3.8/+4.5 · +2.8/+7.2 · +2.4/+2.5 dB | (pluck) +1.0/+1.0 · +3.2/+5.7 · −9.1/+2.2 |
| Lead stereo: side under mid; mono loss | −13.2 dB; 0.20 dB | −14.2; 0.16 |
| Whole-mix side under mid: image · pulse · glitch · afterimage · payoff | −13.2 · −16.5 · −19.8 · −11.0 · −13.2 dB | −11.9 · −15.8 · −17.6 · −10.6 · −12.8 |
| Clipping; DC; clicks | 0 full-scale samples; DC under 0.00003; 0 high-frequency events away from written onsets | same |
| Held lead notes | −4.4 … +2.5 cents | −3.9 … +3.7 |

**Remaining trade-offs, left for listening:**

- **The glitch voice** is still 2.1 dB under the rest in 1–4 kHz. Its partner, the melodic bass, is +3.3 dB there: the
  two halves of the melody share the band by design.
- **The descant is quieter than the hook** in the payoff. If it should sing out more, the trade is against the hook.
- **The ending.** The last music-box note is still ringing (about −55 dBFS) when the file's 50 ms end fade begins.
- **The low end** is slightly less mono than V1's (0.9994): the choir basses sing roots in the payoff.

## Sources and provenance

- **Instruments:** Signature Rack Living Bass, Impossible Voice and Mechanical Orchestra (frozen); Timbre Lab log and
  skin; Cathedral Experiment THRONE//VOLT and HEAVEN//MASS. The Cathedral instruments are the same seven files used in
  V1, checked out from `e79412f`, and re-verified by `deliver.ts` against both approved manifests
  ([`cathedral-instruments.json`](delivery/provenance/cathedral-instruments.json)).
- **Rack freeze check:** passes ([`freeze-check.txt`](delivery/provenance/freeze-check.txt)).
- **Drums:** V12 Signature IRON PULSE, TITANIUM CRACK, GHOST TICK and OPEN CIRCUIT; GLASSHOUSE (CC0) bass punch, chrome
  clap and pixel hat.
- **Material:** numeric parameters and seeded noise, plus those seven one-shots. No performer recordings, third-party
  samples, SoundFonts, impulse responses or presets.
- **The reference recording** named in the brief was not sampled, transcribed or analysed.
- **Licensing: provisional.** This is a private research asset; GLASSHOUSE is CC0, everything else awaits the owner's
  declaration ([`licensing.json`](delivery/provenance/licensing.json)).

## Things only listening can decide

1. Does the "da-YOW" performance make the hook feel alive and physical, rather than like a toy?
2. Do the dotted-eighth bars (0:14–0:19) pull you forward, or just feel unsteady?
3. Does the glitch sound like two voices rebuilding the melody? Does the silence at 0:27.1 land?
4. Does the hook over the tonic (0:38.8) change how the melody feels?
5. Is the cascade (0:42.4) kinetic and inevitable, or busy? Does the downbeat landing at 0:45.9 feel earned?
6. Is the descant loud enough to register as a second melody?
7. Does the music box's return to the opening image end the story, or leave it open in a good way?

## Rebuild

Node 22.18+, FFmpeg with libmp3lame; for the QA, Python 3 with numpy and scipy.

```bash
node experiments/afterimage-pulse-002/build.ts --candidate
```

```bash
python3 -I experiments/afterimage-pulse-002/qa/measure.py experiments/afterimage-pulse-002/build --json experiments/afterimage-pulse-002/build/qa-candidate.json
```

```bash
node experiments/afterimage-pulse-002/build.ts
```

```bash
node experiments/afterimage-pulse-002/deliver.ts
```

| Path | Contents |
|---|---|
| [`compose.ts`](compose.ts) | The whole piece: hook, per-note performance lanes, groove arc, glitch, payoff, mix and automation, the fix switches (`--candidate`, `FIX`) |
| [`source/`](source) | The six rack scores, the engine project, kits and the QA map: the editable source as data |
| `build.ts`, `deliver.ts`, `qa/measure.py` | V1's scripts, adapted (name, stems, two added measurements, the V1-unchanged check) |

**Stopped for listening review.**
