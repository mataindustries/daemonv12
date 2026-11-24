# FERRYMAN TAKES FAKES (V2) · production and QA report

> The producer (an AI agent) cannot hear audio. Musical claims below are design intent; numbers are signal
> measurements. Nobody has listened to V2 yet. Nothing has been merged or published.

## Deliverables

| File | What it is |
|---|---|
| [`delivery/FERRYMAN-TAKES-FAKES-V2.mp3`](delivery/FERRYMAN-TAKES-FAKES-V2.mp3) | 320 kbps listening master, encoded from the PCM24 master (6.1 MB) |
| [`delivery/FERRYMAN-TAKES-FAKES-V2.24.wav`](delivery/FERRYMAN-TAKES-FAKES-V2.24.wav) | Full-resolution master: PCM24 stereo, 44.1 kHz, 6,703,200 frames (152.0 s), through the verified Production24 path |
| [`delivery/stems/*.flac`](delivery/stems) | 14 aligned PCM24 stems (post-track, pre-master), losslessly packed. Each decodes to sample-identical PCM24 data and exactly 6,703,200 frames |
| [`delivery/metadata/`](delivery/metadata) | The sealed package's render, mastering, provenance and inventory records, plus its exact SHA256SUMS |
| [`delivery/creative-pass.mp3`](delivery/creative-pass.mp3) | V2 before the refinement pass, for A/B |
| [`LINER-NOTES.md`](LINER-NOTES.md) | Updated fictional liner notes, with a section map |
| [`genealogy.json`](genealogy.json) | Every file's parents and hash, and every chop V2 plays |
| [`procession/`](procession) | The unreleased Procession Take: composer script, score, rack render record, 320 kbps MP3 |
| V1 | Unchanged: [`../beat/`](../beat), [`../source/`](../source), [`../ferryman-takes-fakes.json`](../ferryman-takes-fakes.json) |

To restore a stem WAV, use the command below (the sealed package in `work/` holds the exact WAV files):

```bash
ffmpeg -i counterfeit-gold-opus/v2/delivery/stems/kick.flac -c:a pcm_s24le kick.wav
```

## Measurements (final PCM24 master)

| | |
|---|---|
| Length | 152.0 s; the last sound (Odile's breath and the room) is gone by 2:29 (below -90 dBFS) |
| Integrated loudness | -15.17 LUFS; LRA 4.5 LU |
| True peak | -1.08 dBTP; sample peak -1.10 dBFS; no clipped samples on the master or any of the 14 stems |
| Mono compatibility | fold-down changes RMS by -0.08 dB; stereo correlation 0.963 |
| Kick/bass separation | below 60 Hz the eternal Deacon is 5.8 dB above the kick at kick hits (creative pass: 0.2 dB). From 60 to 120 Hz the kick leads by about 16 dB |
| Low end | energy below 120 Hz: 20-41 % per section (box 20 %, half-speed V1 34 %) |
| Timing | the LP stop-stab lands 5 ms before the bar 18 downbeat, after seven bars of 7/8. The street take's re-entries at 1:16, 1:24 and 2:21 land within 2 ms of the grid. The cadence's sub and the street's D chord land within 3 ms |
| Determinism | the Production24 replay reproduced all 27 members of the sealed package byte for byte: master, 14 stems, MP3, sources and metadata |

Short-term loudness (LUFS, 3 s window ending at each section's close):

| Section | | Section | |
|---|---|---|---|
| box | -18.1 | three Ezras (riff alone) | -17.6 |
| counterfeit | -15.4 to -16.1 | shout | -13.6 to -14.3 |
| crossing, drums out | -18.1 to -19.0 | the bite | -19.6 |
| crossing, the drums argue | -15.9 to -16.1 | half-speed V1, waking, collision | -12.7 to -14.4 |
| convergence | -14.7 | payment | -14.9 to -15.4 |
| cut him loose | -14.3 to -15.4 | cadence / coin | -13.8 / -20.1 |

## Sample genealogy

| Generation | Source | Made by | V2 events |
|---|---|---|---|
| 0 | the LP score, the Procession Take score | composed (`../source/compose.ts`, `procession/compose.ts`) | |
| 1 | the LP print (`assets/record/…ferryman.wav`) | rack performance, printed once | 985 |
| 1 | the Procession Take print (`assets/record/…procession-take.wav`) | rack performance, printed once; **new, unreleased material** | 94 |
| 2 | V1 master (`assets/v1/`, identical bytes to `../beat/`) | the V1 project from the LP print | 3 long passages, 27 s of V2 |
| 2 | eternal Deacon (`assets/v2/eternal-deacon.wav`) | engine print: his pluck, then 8 periods of sustain spliced every 4 periods, 62 phase-locked voices | 103 |
| 2 | reversed sheet (`assets/v2/reversed.wav`) | two LP slices, frames reversed bit-exact (the second matches V1's swell byte for byte) | 2 |

V2 plays 52 distinct chops in 1,187 events on 14 tracks; none is unaccounted for. The chop notebook is
[`chops.json`](chops.json); [`genealogy.json`](genealogy.json) lists every chop with its source, generation, tracks
and rates.

**Why a new recording.** The second idea needed joy in a dominant key on the same tonic. Re-pitching the LP's
minor-key chops can't produce that, because the minor chords underneath every reed note come along. One take
was recorded, and it carries the riff the two worlds share.

**Why the two prints.** The half-time sections need a bass that holds, and the Deacon only ever plucked. The engine
cannot play backwards, and the convergence and the half-speed V1 each need something to inhale into.

## The two passes

**Creative development pass.** Composition, then the levels it needed:

- The box was pulled down 5 dB so the drop lands 4 dB above it.
- The 7/8 record came down 3 dB so the bars without drums dip.
- Snare +2.5 dB and hats +4 dB.
- Ezra's solo bar was stripped to the reed alone.
- Stacked horn notes and stuttered syllables were re-aligned on their real attacks. Placing by the record's beat had
  flammed the baritone Ezra 31 ms early, because half speed doubles any offset.
- Result: -13.9 LUFS, LRA 4.0 on the ordinary engine render. Audio: `delivery/creative-pass.mp3`.

**Refinement pass.** Three bounded changes, each aimed at a measured weakness:

| | Change | Before | After |
|---|---|---|---|
| R1 | Kick highpass 40 → 58 Hz, two in series. A tone-up retune was refused by the engine's interpolation budget, so the kick stays an exact copy | sub over kick below 60 Hz: +0.2 dB | +5.8 dB |
| R2 | Odile's re-sung lines +3 dB | rap bars: vox 6.9 dB under the mix | 4.2 dB under |
| R3 | Master trim to the true-peak guardrail on the PCM24 path | -0.44 dBTP (engine), -0.72 (PCM24) | -1.08 dBTP |

## Guardrails

| Guardrail | Status |
|---|---|
| Dynamic contrast | Sections range from -12.7 to -20.1 LUFS short-term; LRA 4.5 LU |
| Mono | -0.08 dB fold-down; kick, snare and bass tracks centred |
| Kick and bass separation | R1, above |
| Sample boundaries | Every sampler voice has an explicit slice end and attack/release ramps. All but the two reversed swells (which play to their slice end) also have a musical gate. Chops that hand over use choke groups. The long passages (the crossing, the street line, V1) cut on bar lines |
| Clipping | none on any track or the master; true peak -1.08 dBTP |
| Reproducibility | Prints are cached by input hash (`prints.ts`). The dig and project are scripts. Engine, Production24 and replay hashes are recorded |

## Rebuild

From the repository root (Node 22.18+, FFmpeg). The LP print, the Procession Take print and V1 are committed and
reused as-is.

```bash
node counterfeit-gold-opus/v2/prints.ts
```

```bash
python3 counterfeit-gold-opus/v2/dig.py
```

```bash
node counterfeit-gold-opus/v2/build.ts final
```

```bash
node scripts/headliner-production24.ts project counterfeit-gold-opus/ferryman-takes-fakes-v2.json NEW_DELIVERY_DIR
```

```bash
python3 counterfeit-gold-opus/v2/genealogy.py
```

```bash
node counterfeit-gold-opus/v2/listen.ts listen.html
```

The engine render takes about 3.5 minutes and the PCM24 path about 2. To re-record the Procession Take (not needed):

```bash
node counterfeit-gold-opus/v2/procession/compose.ts
```

```bash
node --import ./timbre-lab/register.ts studio-001/rack/cli.ts render counterfeit-gold-opus/v2/procession/two-coins-procession-take.score.json NEW_DIR --normalize -16
```

## Open questions for the owner's ears

- **The street take is the risk.** Its brass-band swagger, the pram tuba's blat, and whether the second line reads
  as joy over the hip-hop low end are design intent, unheard.
- **Odile's rap.** Bar 39 is retuned to E♭7#11 with D♭s; bar 38's D/F pentatonic is plain. The bend at 1:42 (a cry
  bent up a fifth in an eighth of a beat) is meant to be impossible and may just sound wrong.
- **Half-speed V1.** Its own sub falls below hearing (18 Hz) and is filtered; the eternal Deacon replaces it. Its
  snares at half speed are deliberately loose against V2's (about 20 ms apart).
- **Loudness.** The master is not pushed past -15.2 LUFS: there is no limiter, and the true-peak guardrail decides.
- **The kick** stays untuned (F1 body) because retuning it exceeded the engine's interpolation budget.
