# THE CATHEDRAL EXPERIMENT · DaemonV12 Opus Signature Instrument Lab

Three new instruments for Concrete Gospel, each proved in the song's own context:

- **THRONE//VOLT**, an analog lead;
- **CATHEDRAL//ENGINE**, a synthetic pipe organ;
- **HEAVEN//MASS**, a synthetic celestial choir.

The work went through one design/implementation pass and one bounded QA/fix pass, and **stops here for the owner's
listening review**.

**Nobody has listened yet.** The composer (an AI agent) cannot hear audio. Every musical description below is design
intent; every number is a signal measurement, not a verdict on whether it works.

## Listen

All four in-context files are matched to the same integrated loudness, **−14.0 LUFS** (EBU R128), under a shared
−1 dBTP ceiling, so no version wins by level. The dry examples are matched to each other at −17.4 LUFS.

| File (`delivery/listening/*.mp3`, lossless in `delivery/lossless/*.wav`) | Length | What it is |
|---|---:|---|
| `0-concrete-gospel-v2-reference-bars-5-16` | 22.4 s | **The A/B reference**: the approved V2 master (reed lead), bars 5–16 |
| `1-throne-volt-analog-lead-over-v2` | 23.4 s | THRONE//VOLT plays the Concrete Gospel hook over the approved V2 backing, bars 5–16 |
| `2-cathedral-engine-organ-over-v2` | 23.4 s | CATHEDRAL//ENGINE plays the same hook and its harmony over the same backing |
| `3-heaven-mass-choir-over-v2-drums` | 24.0 s | HEAVEN//MASS sings an original four-part passage over V2's bars 1–12, from intimate to heavenly |
| `dry-1-throne-volt` | 19.2 s | The lead alone, no room |
| `dry-2-cathedral-engine` | 18.0 s | The organ alone, no Nave |
| `dry-3-heaven-mass` | 23.0 s | The choir alone, no room |

A suggested order: the reference, then 1 and 2 (the same bars, the same backing, only the lead changes), then 3, then the
dry files.

## What was found before anything was built

**Where Concrete Gospel V2 is.** It is not on `main`. Concrete Gospel V1 and V2 live on branch
`claude/awesome-dijkstra-nf60w1`, and V2 is commit `620426e` ("drum surgery").

- Its two compose modules and its delivered `SHA256SUMS` are copied byte for byte into [`upstream/`](upstream). Their
  origin and hashes are in [`upstream/PROVENANCE.json`](upstream/PROVENANCE.json). Nothing was retyped or recreated.
- [`backing.ts`](backing.ts) rebuilds V2 with V2's own build commands. It refuses to continue unless the result is
  **bit-identical** to the delivered V2: the master WAV and all 12 engine stems. It is, on Node 22.23.5 and FFmpeg
  6.1.1-3ubuntu5.
- The auditions therefore play over the approved backing itself, not a copy of it. That backing is V2's kick, snare,
  hats, toll, clank and 808 tracks, with V2's gains, effects, 808 duck and master chain.
- The hook, the bar-12 major answer and the bar-16 amen are read from V2's own score.

**Why the V2 lead sounds like a flute.** It is the Timbre Lab Breath Reed, a reed on a closed-open bore, which produces
odd harmonics. Measured on V2's reed stem on the six held C5s of the hook:

- even harmonics sit about 40 dB down (H2 −39.9, H4 −40.2, H6 −39.3, H8 −38.8 dB under the fundamental);
- 81% of the energy is in the fundamental.

That is a hollow, flute/clarinet spectrum.

**Why the V2 choir lacks depth and height.** It is three Impossible Voices, all with the same mid/high formant table,
voiced F3–D4. In its bar-12 answer:

- 85% of the energy is in 500 Hz–1 kHz;
- 0.0% is above 2 kHz;
- 0.0% is below 120 Hz.

## The instruments

The controls, ranges, articulations and per-note parameters of all eight instruments are in
[INSTRUMENTS.md](INSTRUMENTS.md), generated from the code. The sources are in [`instruments/`](instruments).

They plug into the Signature Rack the way the Timbre Lab does: an opt-in `--import` hook
([`instruments/register.ts`](instruments/register.ts)) redirects the rack's registry in that one process. The rack, its
registry and the frozen engines are not edited. All three use the rack's calibration and score format.

### THRONE//VOLT · analog lead (`smoulder → blaze`)

**What is new:** an analog voice circuit, simulated at 2× and band-limited, that behaves like a player's instrument
rather than a preset.

- **Five oscillators per voice:**
  - a master saw;
  - two partner saws detuned either side and split left/right (the width);
  - a saw hard-synced to the master, whose ratio rides the filter envelope (a vowel-like "scream");
  - a sub-octave square.
- **Band-limiting:** every discontinuity, sync resets included, gets a one-sample-delayed polyBLEP.
- **The signal path:**
  1. a hot mixer (soft clip);
  2. a 2-pole high-pass that keeps the 808's range clear;
  3. the HEADLINER/MUTATION 4-pole ZDF ladder (reused through the rack's hash-verified loader), key-tracked and
     enveloped, with audio-rate cutoff FM from the sub phase (the `growl`);
  4. two soft throat peaks;
  5. the VCA;
  6. an asymmetric tube stage (`heat`).
- **Expression that a synth player uses:**
  - oscillators drift on their own;
  - each fresh attack lands a few cents off and settles;
  - an accent sags the supply for a moment;
  - portamento is an RC lag;
  - a held note *blooms*: the filter opens a little and the vibrato arrives late;
  - a release closes the filter;
  - the hook's moan is an accelerating fall that closes the filter as it goes.
- **Polyphonic:** chords are separate voices, and a legato note continues the voice nearest in pitch, so chord changes
  glide voice by voice.

**Measured in context:** the held notes are within ±2.8 cents. Pitch tracking shows the moan holding A♭4 at
68.00 ± 0.03, then falling with acceleration to F4 (bars 5–6) or to E♭4 (bars 9–10).

### CATHEDRAL//ENGINE · synthetic pipe organ (`whisper → full organ`)

**What is new:** every pipe that speaks is its own model. There are no samples.

- **Three divisions:**
  - **Great:** Principal 8', Octave 4', Twelfth, Fifteenth, Mixture IV, Bourdon 16', Trumpet 8';
  - **Swell**, enclosed: Gedackt 8', Viole Celeste II, Flute 4', Hautbois 8';
  - **Pedal**, in two towers: Contra 32' resultant, Subbass 16', Octave 8', Posaune 16'.
- **Ranks:** every rank is a continuous drawstop, so registration can change mid-phrase. The macro is a crescendo pedal.
- **Each pipe:**
  - a rank-specific harmonic recipe with per-pipe voicing and tuning scatter;
  - *speech*: upper harmonics come in first, big pipes speak slower, and there is a chiff burst, mouth noise and a pitch
    flare;
  - key speed shapes the onset;
  - a release droop.
- **Compound ranks:** the Mixture breaks back an octave above 3.3 kHz. The 32' is a resultant (16' + 10⅔') with a
  little real 32' under it.
- **Shared wind:** the pipes draw on one wind system per division with reservoir dynamics. A big chord sags the pressure
  (every pipe goes a few cents flat and slightly softer) and it wobbles back. The tremulant shakes the same wind.
- **Layout and space:**
  - the Swell's shades change level and brightness together;
  - pipes stand on the C or C♯ side of their chest;
  - each division feeds the **Nave**, an original stone-space model: early reflections that keep their side, then a
    modulated 16-line FDN with a loop low-cut and a high-passed tail, so a 5.6 s cathedral sits above an 808 instead
    of on it.
- **Trap-mix control (added in the QA pass):** a zero-phase low-frequency mono crossover, `lowMono`.

**Measured in context:** the held notes are within ±3.1 cents. The organ "moan" steps A♭–G–F, and its last key droops
about 30 cents (`sag`).

### HEAVEN//MASS · synthetic celestial choir (`intimate → heavenly`)

**What is new:** a choir, not one voice copied. It builds on the Impossible Voice's additive source-filter approach:
every harmonic's level is a glottal tilt times a five-formant cascade, so vowels glide without filter jumps.

- **Four throats.** Bass, tenor, alto and soprano each have their own sung-vowel formant tables.
  - The male tables cluster F3–F5, so a singer's ring emerges from the cascade itself. The female tables are wider at
    the top, for sweetness.
  - Altos and sopranos tune F1 above the fundamental and pull F2 toward 2·f0 on high notes, as trained voices do.
  - Each section has its own tilt, vibrato habits, seat, low cut, low-mid dip and presence/de-harsh EQ.
- **Individual singers.** Each singer has their own:
  - tuning and drift (the section is centred on the written pitch);
  - jitter and vibrato (rate, depth, delay);
  - onset timing, scoop and intonation settle;
  - vowel timing, tract length, breath and seat.
- **Ensemble behaviour:**
  - on a long chord the singers *converge* on pitch, so just-intoned chords can lock;
  - `ensemble` brings singers in one by one, so a passage literally grows from one voice per part to the full choir;
  - **octavists** sing an octave under the basses (dark, closed "oo"), for depth that does not crowd the low mids.
- **Breath and air:**
  - aspiration is pitch-synchronous and formant-filtered;
  - real inhales before phrases;
  - an unvoiced `air` sheen above 5 kHz gives height without harsh harmonics.
- **Space:** each section feeds the Nave at its own depth.

**Measured in context**, against the V2 choir's 85% / 0% / 0%: at the heavenly climax the new choir has

- 17.2% of its energy below 120 Hz (octavists and basses);
- only 1.8% in the low mids, about 200–500 Hz (no mud);
- 7.4% above 2 kHz;
- 1.6% above 5 kHz (air).

Its stereo width grows from side/mid −14.4 dB (intimate) to −5.8 dB (heaven).

## The auditions

All of them use V2's tempo (144 BPM, half time), key (F minor), backing and master chain. Times are in the listening
file.

### 1 · THRONE//VOLT

| Bars | Time | What happens |
|---|---|---|
| 5–8 | 0:00 | **The drop.** The hook enters with V2's groove A, warm and dark (macro 0.5). Accents spike the filter and sag the supply. The long A♭4 of each answer moans down to F4 |
| 9–11 | 0:06.7 | **Groove B**, hotter (macro 0.64). The synced oscillator starts to scream, and the moan falls deeper, to E♭4 |
| 12 | 0:11.7 | **The hole.** V2's 808 tape-stops. THRONE//VOLT plays V2's major answer itself, as three voices that glide into each other (F7sus → B♭/F → F → B♭/F) |
| 13–14 | 0:13.3 | **The slam.** Blaze (macro 0.88) and +1.5 dB. The held C5 snarls with audio-rate filter FM (where V2 growled the reed) |
| 15–16 | 0:16.7 | The last statement. Under the final moan, V2's minor amen swells in three voices as the drums stop |

### 2 · CATHEDRAL//ENGINE

| Bars | Time | What happens |
|---|---|---|
| 5–8 | 0:00 | **The hook on the Great** (Principal 8', Octave 4', Trumpet 8'), with accents marcato. An organ cannot bend, so each moan steps chromatically and the last key is let up slowly (it droops). **The Swell answers with the harmony of V2's own 808**: F minor 7 → B♭ minor 7 → C7, an F–E–E♭ inner line, box nearly closed |
| 9–11 | 0:06.7 | The box opens and Flute 4' is added. The deeper moan steps A♭–G–F–E♭ |
| 12 | 0:11.7 | **Where the 808 tape-stops out, the cathedral appears.** Full organ: the Great's chorus with Mixture, Twelfth, Fifteenth, Bourdon 16' and Trumpet on the answer's top line; the Swell open with Hautbois. **The Pedal enters on F** (32' resultant, 16', 8', Posaune 16'), the wind sags under the chord, and the Nave blooms |
| 13–14 | 0:13.3 | The slam: the solo with half the chorus and Mixture, and the pedal silent so the 808 owns the low end |
| 15–16 | 0:16.7 | The minor amen is held as the drums stop. The Pedal takes the floor as the 808 dives away, and the Nave rings out |

### 3 · HEAVEN//MASS

An original passage, not the hook. V2's bars 1–12 are the a-cappella "sermon" (bell, then quiet hats), the drop, groove
B and the bar-12 hole. Nothing is added after bar 12.

| Bars | Time | What happens |
|---|---|---|
| 1–2 | 0:00 | V2's bell. **Basses hum F alone** ("mm" opening to "oo"). Tenors join on the fifth and sigh up to D♭. Two or three voices, close, breathing |
| 3–4 | 0:03.3 | Altos join. Quiet hats. The basses walk F–D♭–C down to a low C (65 Hz): a half cadence |
| 5–8 | 0:06.7 | **The drop** (kick, 808, snare, hats, clank). Sopranos enter. F minor 7 / B♭ minor 7 / C7♭9 with V2's 808. Vowels open oh → aw → ah, and singers join one by one. Basses and tenors duck 4 / 2 dB on each kick |
| 9–10 | 0:13.3 | A second soprano part. The melody climbs F5–G5–A♭5, and a C7♭9 pulls back to F minor |
| 11 | 0:16.7 | F minor, then B♭ minor over the F pedal (the minor plagal "amen"). The melody is prepared on B♭5 |
| 12 + tail | 0:18.3 | **The drums vanish and the 808 dives.** B♭5 and B♭3 hang as suspensions over F, then fall together to **A natural: F major**, the first light in the piece, just-intoned. Octavists sing F1 beneath, a far descant floats on C6, and the Nave opens |

The choir's level grows by 20.5 dB from bar 1 to bar 12, and the mix's integrated loudness range is 9.4 LU.

## The numbers (final build)

Measured by [`qa/measure.py`](qa/measure.py). The full records are in `delivery/provenance/qa-final.json` and
`qa-before-fix-pass.json`.

| | V2 reference | 1 · THRONE//VOLT | 2 · CATHEDRAL//ENGINE | 3 · HEAVEN//MASS |
|---|---:|---:|---:|---:|
| Integrated loudness (matched) | −14.0 LUFS | −14.0 | −14.0 | −14.0 |
| True peak | −2.9 dBTP | −3.2 | −4.0 | −4.3 |
| Loudness range | 2.5 LU | 2.1 | 1.7 | 9.4 |
| Lead over the rest of the mix, 300 Hz–1 kHz, per two-bar cycle (V2's own metric) | +4.5 … +6.6 dB | +3.4 … +4.8 | +3.6 … +5.0 | — |
| Lead over the rest of the mix, 1–4 kHz | +2.5 … +7.5 dB | +3.9 … +5.3 | +6.0 … +7.2 | — |
| Kick / snare hit over the preceding 180 ms | 12.5 / 10.8 dB | 13.0 / 11.3 | 12.4 / 11.0 | 10.8 / 10.8 |
| Below 120 Hz: L/R correlation | 0.9999 | 0.9998 | 0.9988 | 0.9932 |

**Clean in every file:**

- 0 full-scale samples;
- DC under 0.0004;
- 0 high-frequency spikes (clicks) in any new instrument stem;
- the last 10 ms at −71 dBFS or lower.

**Timing:** THRONE//VOLT starts 0.09 ms after its written beat. The organ starts 4.8 ms after, which is its modelled
tracker action.

**Determinism:** two from-scratch builds produced byte-identical WAV and MP3 files, all 149 of them (listening files,
rack stems, engine renders); see `provenance/determinism.json`.

## The QA/fix pass (one bounded pass)

**Calibration, part of composing.** Before the candidate was frozen, calibration renders set the following (as Concrete
Gospel V1 and V2 did):

- **Lead levels:** matched to the V2 reed's in-mix loudness and V2's lead-over-mix metric.
- **Descant:** −8 dB, so it stays a halo.
- **The choir's arc:** the first render spanned 24 dB (LRA 14.4 LU), too faint at the start for a phone.
- **The choir's air sheen:** +7 dB. Above 4 kHz the choir read 0.2%.
- **Earlier defects caught on the way:**
  - THRONE//VOLT rendered silence: a NaN from a fractional power of a time a fraction of a sample before the first
    note;
  - the Swell clipped: it was calibrated with its shades closed;
  - the choir stems needed rack-stage headroom.

`node build.ts --pre-qa` rebuilds that candidate byte for byte, and it was measured first. Then:

| # | Found in the candidate | Fix | Before → after |
|---|---|---|---|
| F1 | Organ, bar 12: the low end leaned 15 dB to the right (L/R correlation 0.11). A pedal F stands in the right-hand tower | New `lowMono` crossover: the side signal below 140 Hz (pedal) or 110 Hz (manuals) is removed with a **zero-phase** low-pass. The first implementation used a minimum-phase filter whose lag left the side only 1 dB down at 44 Hz; it was measured, corrected, and the pedal's tower spread was halved for the audition | L−R −15.0 → **−0.8 dB**, correlation 0.11 → **0.969** (whole audition 0.951 → 0.9988) |
| F2 | Choir final chord: the soprano A read −6.0 cents against an intended just −13.7 | Each section's singers (all but the first) are centred on the written pitch | −6.0 → −5.8: **no measurable change** (see below) |
| F3 | Choir audition: kick and snare hits stood 1.9 / 0.7 dB less proud than in V2 | The choir sits 1.5 dB lower while the drums play (bars 5–11); the climax is untouched | Kick / snare 10.6 / 10.1 → 10.8 / **10.8** dB (V2: 12.5 / 10.8) |
| F4 | THRONE//VOLT, bars 13–16: at "blaze" its energy moves up; it led the mix by only +2.8–3.0 dB at 300 Hz–1 kHz | +1.5 dB from the slam, exactly as V2 did for its reed | +2.8 / +3.0 → +3.4 / +3.6 dB, and 1–4 kHz +4.0 / +3.9 → +4.8 / +4.6 |
| F5 | The QA tool measured pitch on the fundamental, which is weak in tenor and alto "ah" | Tuning is measured on the strongest of harmonics 1–5; the onset check is clamped at 0 | Tenor A3 reads −13.9 (intended −13.7) instead of a spurious −7.5 |

**About F2.** The fix is principled and stays in: it guarantees that each section's mean pitch is the written pitch.
Investigation showed, however, that the soprano reading is not a mean-pitch fault.

- With the singers' tuning and timing spreads at zero, the same chord reads −13.2 cents. That is the model doing
  exactly what is written.
- With four other singer seeds it reads −11.0 to −12.8.
- For this one seed, how the six singers' powers and pitches combine produces a sharper reading.

The as-built A sits about 6 cents flat of equal temperament: between equal temperament and just, and not out of tune.

## Provenance and licensing

- **What the sound is made of.**
  - Numeric parameters and seeded noise only.
  - No recordings, samples, sample packs, SoundFonts, impulse responses, presets or paid APIs.
  - No organ, choir or synthesizer recordings were used or analysed. Nothing imitates a recognisable singer, organ or
    product.
  - The stop names (Principal, Trumpet, Mixture…) are centuries-old generic organ terms.
  - The vowel formant targets are approximate textbook-style averages for sung vowels, adjusted by hand.
- **Reused code.**
  - From `mutation-001/tools/dsp.ts`: only the ZDF ladder and the Kaiser decimator, both used by THRONE//VOLT. They are
    loaded through the rack's hash-verified loader, so the frozen file is checked against its SHA-256 before import.
  - Everything else in `instruments/` is new code written for this lab: the sync oscillator, the pipe and voice
    models, the filters' own copies, the Nave.
- **The backing.** V2's engine tracks use the V12 Signature pack, Timbre Lab one-shots, the frozen Living Bass and the
  HEADLINER context snare, unchanged.
- **Untouched.** No approved engine, score or master was changed. Nothing outside this directory changed.
  - `node studio-001/rack/cli.ts freeze` reports every frozen engine, script and audition intact (see
    `provenance/freeze-check.txt`).
  - Concrete Gospel V1/V2 and BLACKOUT//ENGINE are untouched on their own branches.
- **Licensing.**
  - Every instrument in the backing has a pending licensing declaration.
  - The three new instruments are new, unapproved code with no licence chosen.
  - **The listening files and everything in `delivery/` are therefore private research assets.** They are not
    published and grant no licence.
  - **No commercial clearance is claimed.**

## Decisions and limitations

- **Audition lengths.**
  - The two lead auditions use bars 5–16 of V2. Bars 1–4 are left out because V2 plays its lead band-limited "through
    the wall" there, which would hide the instrument's character.
  - The choir uses bars 1–12, so its climax lands in V2's own bar-12 hole. Nothing new is arranged; this is not a V3.
- **What the backing leaves out.**
  - The old reed and old choir (and their room) are left out of auditions 1 and 2.
  - V2's bar-12 and bar-16 choir answers are played by the new instrument instead, so the arrangement stays whole.
- **The organ steps instead of bending.** A literal 3-semitone pitch bend is not something an organ does. If the moan is
  the soul of the hook, this is the biggest open question about the organ.
- **The choir fills the space between hits.** Even after F3, the kick stands 1.7 dB less proud of its surroundings than
  in V2. A choir holding chords over a trap beat fills that space.
- **The choir's dynamic range is wide.** Its intimate opening sits about 12 dB under its climax (LRA 9.4 LU against
  V2's 2.5).
- **The choir's opening is dark on purpose.** It hums at F2–A♭3, so 42% of its energy is in 200–500 Hz, at low level.
- **THRONE//VOLT is brighter than the reed by design.** It leads the mix less in 300 Hz–1 kHz than the reed did and more
  in 1–4 kHz. If it reads as too far back, +1–2 dB on its track is the lever.
- **Synthesis limits.**
  - The voices are additive and have no consonants or words.
  - The Nave is algorithmic, not a measured space.
  - The choir is the slowest of the three to render: about 30 s of compute for 24 s of audio.
- **Not frozen, not in the test suite.**
  - The instruments are unapproved and have no repository tests (experiment scope).
  - Their sources pass `tsc` with the repository's strict settings. That was checked with a temporary config, which is
    not committed.
- **The dry examples share one loudness.** They are matched as a group, and the choir's true peak limits it to
  −17.4 LUFS: its low fundamentals and octavists carry high peaks.

## Things only listening can decide

1. **THRONE//VOLT.**
   - Does it read as a vintage analog lead with authority, physically substantial and nowhere near a flute?
   - At the slam, do the sync scream and the growl add authority, or edge?
   - Does the moan sound like a player's bend, or like an effect?
2. **CATHEDRAL//ENGINE.**
   - Does the Trumpet-and-Principal hook carry over the drums, or would a rounder registration be better?
   - Do the stepped falls keep the hook's soul?
   - In bar 12, is full organ plus the 32' the moment "the cathedral appears", or too much?
   - Is the Nave the right size for a trap record?
3. **HEAVEN//MASS.**
   - Does it sound like a choir of people, and otherworldly in the right way?
   - Is the hummed opening intimate, or too dark and quiet?
   - At the climax, do the suspension falling to A natural, the octavists and the far descant feel heavenly?
   - In bars 5–11, does the choir fight the drums?
4. **Next.** Which character, or which combination, should Concrete Gospel V3 build on? For example, THRONE//VOLT
   on the hook with HEAVEN//MASS taking bar 12, and CATHEDRAL//ENGINE underneath the return.

## Rebuild

Requirements:

- Node 22.18+ (tested with 22.23.5);
- FFmpeg with libmp3lame (6.1.1-3ubuntu5);
- for the QA, Python 3 with numpy and scipy.

Byte-identical output was verified on that toolchain.

```bash
node experiments/cathedral-experiment-001/backing.ts
```

```bash
node experiments/cathedral-experiment-001/build.ts
```

```bash
PYTHON=python3 node experiments/cathedral-experiment-001/verify.ts
```

```bash
node experiments/cathedral-experiment-001/deliver.ts
```

- [`backing.ts`](backing.ts) rebuilds and verifies the V2 backing. `build.ts` also does this automatically the first
  time.
- [`build.ts`](build.ts) writes the scores, renders the rack parts, renders the engine projects and writes the
  listening files. It takes about 2.5 minutes. `--pre-qa` rebuilds the candidate exactly as it was before the fix pass.
- [`verify.ts`](verify.ts) runs the whole proof in about 12 minutes:
  1. the pre-QA build and its QA;
  2. two final builds, compared byte for byte;
  3. the final QA;
  4. the freeze check.
- [`deliver.ts`](deliver.ts) fills `delivery/`.

| Path | Contents |
|---|---|
| [`instruments/`](instruments) | The three instrument families (`throne-volt.ts`, `cathedral-engine.ts`, `heaven-mass.ts`), shared DSP and the Nave (`common.ts`), the registry and the opt-in hook, the docs generator |
| [`compose.ts`](compose.ts) | The three auditions and the three dry examples: every note, control curve and mix decision, and the QA switch |
| [`source/`](source) | The generated rack scores and engine projects |
| [`upstream/`](upstream) | Byte-identical Concrete Gospel V1/V2 compose sources and V2's delivered hashes, with provenance |
| [`qa/measure.py`](qa/measure.py) | The technical QA |
| [`delivery/`](delivery) | `listening/` (MP3), `lossless/` (WAV) and `provenance/`: build manifest, QA before and after, determinism, freeze check, V2 verification, instrument registry, source hashes, rack and engine manifests. Plus `SHA256SUMS` |

Stopped here for the owner's listening review. No Concrete Gospel V3 arrangement until the owner asks.
