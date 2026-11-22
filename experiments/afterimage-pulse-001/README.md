# AFTERIMAGE//PULSE · DaemonV12 Sound Lab 03 · identity proof

An original melodic electronic piece: E major, 136 BPM, 2-step garage swing, 26 bars. That is 45.9 s of music plus 2.0 s
of ring, **47.9 s** in all. It went through one composition pass and one bounded technical QA/fix pass, and **work stops
here for the owner's listening approval**. The full 2–3 minute song is not arranged.

**Nobody has listened to it yet.** The composer is an AI agent and cannot hear audio. Every musical statement below is
design intent; every number is a signal measurement. None of it says whether the music works.

## Listen

| File (`delivery/`) | What it is |
|---|---|
| `afterimage-pulse.wav` | Lossless master, 24-bit / 44.1 kHz, −14.9 LUFS, −1.2 dBTP |
| `afterimage-pulse.mp3` | Phone copy, 320 kbps, −14.9 LUFS, −1.3 dBTP |
| `stems/*.flac` | Ten key stems, sample-aligned and pre-master; they sum to the mix before the master bus |
| `source/afterimage-pulse.mid` | Every part as MIDI (drums on channel 10) |

The master is matched toward −14 LUFS under a −1 dBTP ceiling, with a 0.2 dB margin for the MP3, using gain only. The
true-peak ceiling stops it at −14.9. Kick hits set every one of the master's highest peaks, and none of them was limited
(see [QA](#technical-qa-one-bounded-pass)).

## The idea

**The hook: "pulse pairs".** A short pickup leaps up a sixth into a held note. It happens three times per bar, on a
2 + 3 sixteenth grouping (onsets 0–2, 5–7 and 10–12), and each leap lands a step lower: G♯–E, F♯–D♯, E–C♯. Over the A
chord that line is A lydian; the D♯ is the colour note. An answer bar climbs (B–C♯–E) and lets go. It has three endings:

| Ending | Notes | Where it is heard |
|---|---|---|
| **settles** | … → B | statements 1–3 |
| **yearns** | … → leap up to G♯ | statements 1–3, and once in the payoff |
| **resolves** | D♯ → E | only in the payoff: the first tonic chord in the piece |

**The afterimage.** A music box (Mechanical Orchestra bar) plays a canon a dotted eighth behind whatever carries the
hook. Its role changes through the piece:

1. a texture behind the opening pluck;
2. a ghost behind the chopped voice in the tense passage;
3. a memory of the hook at tempo, under the half-speed choir;
4. in the last bar, after the band has stopped, it finishes the phrase alone.

**The pulse.** The same short–long shape appears in four places:

- the pad breathes in the hook's rhythm (it dips on every pickup);
- the payoff's kick and bass lock to the pickups;
- the tense passage's pairs compress into sixteenths, as if the pulse were quickening;
- the vulnerable passage's heartbeat is a hand drum's lub-dub.

## Map

Each bar lasts 1.76 s.

| Bars | Time | Section | What happens |
|---|---|---|---|
| 1–4 | 0:00 | **image** | The hook from the first downbeat on a filtered analog pluck (THRONE//VOLT), with the music box behind it and a pad. Hats on the offbeats and log rims on 2 and 4. Kick and bass enter in bar 3. In bar 4, hand drums answer the held G♯ in the hook's own rhythm and climb into the groove |
| 5–12 | 0:07.1 | **pulse** | 2-step groove: kick on 1 and the and-of-3, snare 5–8 ms behind the beat, ghost notes, swung pixel hats, log knuckles. THRONE//VOLT sings the hook and *swoops* (portamento) into every held note. Living Bass talks in the holes the hook leaves, with a different fill under each answer bar. The second statement adds the full canon, open hats and accented targets, and its last held G♯ falls away |
| 13–16 | 0:21.2 | **glitch** | The hook's E-minor shadow: Am – B7 – Cmaj7♯11 – D7. Impossible Voice sings it as chops: "ee" pickups and open-vowel cries. Through the passage its formants split and its harmonics bend. The bass answers at the machine end, with ratchet dives between chords. The beat breaks into half time; clockwork ticks burst at the ends of bars. In bar 16 the pairs compress into sixteenths, and the band leaves one layer at a time: hats, snare, kick, then the bass with a dive. The voice's last cry, an A, carries over the bar line |
| 17–20 | 0:28.2 | **afterimage** | No drums. A hand-drum heartbeat at 68 per minute; warm sub. HEAVEN//MASS sings the hook at half speed, with a few singers per part ("oo" opening to "ah"): F♯m9 – Amaj9 – C♯m7. The music box remembers the hook at tempo, softly. At **0:33.3**, on the and-of-4, the harmony sinks a semitone into **C major**: bass and tenors slide down, altos hold E, sopranos rise to a G natural. Then the choir grows from a few singers to all of them, with octavists on a low C. The heartbeat stops under the chord, then returns |
| 21–25 | 0:35.3 | **payoff** | C → A: every voice that moved lifts a semitone (C→C♯, G→G♯). The lead plays an octave up, brighter, with a sync edge. The choir sings the hook's long notes; the pluck returns underneath. The kick lands on every pickup, and the bass leaps with the melody, low pickup to high target. The answer yearns, then at **0:41.4** resolves to E: a kick and a low E1 together on the syncopated 7th sixteenth. Bar 25 starts the hook again |
| 26 | 0:44.1 | **ending** | The band plays the first pair and stops at 0:44.6. The music box finishes the resolving answer alone (B–C♯, D♯–E) over one last heartbeat, and it rings out |

**Not reused from earlier records:** BLACKOUT//ENGINE's blackouts and breaker, Concrete Gospel's organ and cathedral
climax, and any 808 tape-stop. The two silences in this piece are composed differently. The glitch passage dissolves one
layer per pickup; the ending stops after the hook's first pair while the music box carries on.

## Instruments and how they are used

| Role | Instrument | Version | Status |
|---|---|---|---|
| Lead (groove and payoff), opening pluck, pad | THRONE//VOLT, three parts with their own setups | `0.1.0+cathedral-experiment` | Cathedral Experiment, not frozen |
| Afterimage passage, payoff long notes | HEAVEN//MASS bass, tenor, alto, soprano | `0.1.0+cathedral-experiment` | Cathedral Experiment, not frozen |
| Talking bass, ratchet dives, warm sub | Living Bass | `1.0.0+mutation-001-A` | Frozen, owner-approved |
| The hook as chops (glitch) | Impossible Voice | `1.0.0+mutation-001-B` | Frozen, owner-approved |
| The afterimage music box; clockwork ticks | Mechanical Orchestra bar, clock | `1.0.0+mutation-001-C` | Frozen, owner-approved |
| Rims and knuckles; fill, talking drum, heartbeat | Timbre Lab hollow log, hand skin | `0.1.0+timbre-lab` | Not approved, not frozen |
| Kick: body + small-speaker knock | V12 IRON PULSE + GLASSHOUSE bass punch | packs in this repository | |
| Snare: crack + clap | V12 TITANIUM CRACK (+1 st) + GLASSHOUSE chrome clap | | |
| Hats | GLASSHOUSE pixel hat, V12 ghost tick and open circuit | | |
| Mix, master | DaemonV12 engine 0.7 production route (unchanged); FFmpeg 6.1.1 | | |

- **Not used:** Breath Reed, clay pot, CATHEDRAL//ENGINE. The organ is Concrete Gospel's signature.
- **Repurposed, not preset:**
  - THRONE//VOLT is three instruments. The pluck has a closed resonant filter, a fast envelope, no sub and no sync. The
    lead swoops into its targets and gains sync and growl at the payoff. The pad is wide and detuned, and its level
    breathes in the hook rhythm.
  - Mechanical Orchestra's tuned bar plays a melodic canon. In the glitch passage it is pushed toward its beating
    "alien" modes.
  - Living Bass moves between warm (afterimage) and machine (glitch).
- **Mono sub, a body that carries on phones.** The bass is split at 120 Hz. The sub is mono, under a fast duck on every
  kick. The upper part is saturated, so it talks on phone speakers.

## Sources, verification and provenance

- **Where the Cathedral instruments come from.** They are not on `main`. They live on `claude/kind-ritchie-1r5oyt`
  (also `claude/elegant-faraday-y4ohq7`), commit `e79412f`.
  - `experiments/cathedral-experiment-001/instruments/` (7 files) was checked out **byte for byte at its original
    path**, so its relative imports and its opt-in registration hook work unchanged.
  - All seven SHA-256 hashes match the Cathedral Experiment's own `sources.SHA256SUMS`.
  - They also match the hashes recorded by the approved Concrete Gospel Full-Length Edition (`6654bc4`).
  - Record: [`delivery/provenance/cathedral-instruments.json`](delivery/provenance/cathedral-instruments.json).
- **Registration, as documented:** `node --import ./experiments/cathedral-experiment-001/instruments/register.ts
  studio-001/rack/cli.ts …`. That hook also registers the Timbre Lab. Nothing in the rack, its registry or the frozen
  engines is edited.
- **Freeze check:** `node studio-001/rack/cli.ts freeze` reports every frozen engine, script and audition intact
  ([`freeze-check.txt`](delivery/provenance/freeze-check.txt)).
- **Nothing else was touched.** No previous experiment or approved master was changed. BLACKOUT//ENGINE (`571162f`) and
  Concrete Gospel (`6654bc4`) stay on their own branches; this directory only adds files.
- **Material:**
  - Numeric parameters and seeded noise (all synthesized parts), plus seven one-shot WAVs from packs in this
    repository.
  - No recordings of performers, third-party samples, SoundFonts, impulse responses, presets or paid APIs. The voices
    are wordless additive synthesis.
- **The reference recording** named in the brief was not sampled, transcribed or analysed. The melody, harmony, rhythm,
  bass phrases and arrangement are new.
- **Licensing: provisional.** This is a private research asset; no licence is granted and no commercial clearance is
  claimed ([`licensing.json`](delivery/provenance/licensing.json)).
  - GLASSHOUSE is CC0.
  - V12 Signature, the Signature Rack, the Timbre Lab and the Cathedral instruments await the owner's declaration.
  - Authorship and work-for-hire status of the AI-written composition and code are for the owner to record.

## Technical QA (one bounded pass)

Measured by [`qa/measure.py`](qa/measure.py). The full records are `delivery/provenance/qa-candidate.json` and
`qa-final.json`. `node build.ts --candidate` rebuilds the candidate byte for byte (master SHA-256 `b5159b0f…`, the same
as measured).

**Calibration (part of composing).** Three calibration renders came before the candidate was frozen:

- The first render's choir clipped in the rack. Its four sections were lowered 2–8 dB there, and the level was made
  back up in the engine.
- The choir then dominated the payoff (−9.8 LUFS against the lead's −18), and the vulnerable passage was louder than the
  groove. The choir came down 5 dB in the afterimage and about 12 dB in the payoff. Snare, hats, bass, pad, music box and
  percussion were raised 3–5 dB.
- The glitch voice sat 8 dB under the rest in 1–4 kHz. It was brightened (source tilt, smaller tract).
- The groove was widened: music-box spread, panned hats, room.

**What the QA pass found and fixed:**

| # | Found in the candidate | Fix | Before → after |
|---|---|---|---|
| F1 | The hook's body barely cleared the groove: in 300 Hz–1 kHz the lead was +0.8 dB over the rest, mostly against the saturated bass harmonics | Lead +4 dB in bars 5–12 (written about twice the wanted size, because automation feeds the track's 2:1 compressor); bass mid −1 dB there | 300 Hz–1 kHz **+0.8 → +3.2 dB**; 1–4 kHz +3.6 → **+5.7 dB** |
| F2 | The glitch hook (voice) was under the rest in 1–4 kHz | Voice +3.5 dB written, through its cry into bar 17 | 1–4 kHz −2.0 → **−0.2 dB**; 300 Hz–1 kHz +2.8 → **+4.7 dB** |
| F3 | The tuning check read the bar-12 G♯5 at −7.5 cents | Measurement fix: that note has a written five-semitone fall, so it is now measured before the fall | Held lead notes **−3.9 … +3.7 cents**, median 1.2 |
| F4 | The groove section was narrow (side 16.3 dB under mid) | Hats drift ±0.35 across the field once every two bars, in the groove and the payoff only; the hook stays centred | Side/mid −16.3 → **−15.8 dB** (a small change) |
| F5 | My automation helper combined lanes by minimum from the base level, so **positive** section offsets were silently clipped to 0 dB. In the candidate this dropped the music box's +2 dB for its solo ending (and, in the first fix build, F1 and F2) | Positive offsets now start from the lane's top. `--candidate` keeps the old behaviour so the candidate stays reproducible | The final bars' music box sounds +2 dB as written |

**Final measurements:**

| | Final |
|---|---|
| Loudness / true peak (WAV · MP3) | −14.9 LUFS / −1.2 · −1.3 dBTP; LRA 7.0 LU |
| Mono fold-down loss (a phone speaker) | 0.22 LU |
| Section loudness, image · pulse · glitch · afterimage · payoff | −19.5 · −14.2 · −14.2 · −18.0 · −13.5 LUFS (6.0 LU contrast) |
| Kick hit over the preceding 180 ms, broadband (phone band 150 Hz–4 kHz) | image 21.4 (21.8) · pulse 14.8 (16.6) · glitch 13.7 (14.4) · payoff 13.6 (14.1) dB |
| Snare hit over the preceding 180 ms | pulse 10.9 (12.9) · glitch 12.1 (13.6) · payoff 10.9 (12.7) dB |
| Below 120 Hz: L/R correlation; side under mid | 0.9998; −40 dB |
| Bass sub under each kick hit (first 40 ms), against the kick's own low end | −12.1 dB |
| Hook over the rest of the mix (300 Hz–1 kHz / 1–4 kHz) | pluck, image +1.0 / +1.0; lead, pulse +3.2 / +5.7; voice, glitch +4.7 / −0.2; choir, afterimage +2.5 / +2.7; lead, payoff −9.1 / +2.2 (it plays an octave up, so its body sits above 1 kHz and the choir holds the lower octave) |
| Hook stereo (phase-independence): side under mid; mono loss | lead −14.2 dB, 0.16 dB; pluck −10.2, 0.4; voice −22.8, 0.02; choir −6.5, 0.88 |
| Whole-mix side under mid, image · pulse · glitch · afterimage · payoff | −11.9 · −15.8 · −17.6 · −10.6 · −12.8 dB |
| Clipping; DC; clicks | 0 full-scale samples; DC under 0.00004; 0 high-frequency events away from written note onsets (the 26 lead and 14 pluck events are the instruments' own attacks, all within 20 ms of a written onset) |
| Hottest pre-master track | kick, −1.4 dBFS; the choir stem −3.4 |

**Remaining trade-offs, left for listening:**

- **Loudness.** −14.9 LUFS is set by kick peaks under the −1 dBTP ceiling. Reaching −14.0 would need a limiter or a
  softer kick; I kept the transients.
- **The glitch passage is the narrowest** (side 17.6 dB under mid), and the voice is still slightly under the rest in
  1–4 kHz. It is the mono, chopped, half-time passage by design, and the music box doubles its long notes.
- **The payoff lead is a high, bright octave.** At low volume its 1–4 kHz margin (+2.2 dB) is smaller than the groove's
  (+5.7). The choir and the pluck carry the hook's lower octave underneath.

## Things only listening can decide

1. Is the hook recognisable after one listen? Do the swoops into the held notes read as a voice, or as an effect?
2. Does the 2-step pocket (swing 0.57, the late snare, the ghost notes, the talking bass) make you move?
3. Is the glitch passage playful and tense, or just strange? Do the voice chops carry the hook?
4. Does the sink into C major (0:33.3) and the lift back to A (0:35.3) land as the emotional turn?
5. Does the payoff feel earned? The resolution to E (0:41.4) is the first tonic in the piece.
6. Does the music box finishing the phrase alone make you want the next bar?
7. **For the full song:**
   - Which section's world should the verse live in?
   - Does the C major turn want to become a bridge?
   - Should the "resolves" ending stay this rare?

## Rebuild

Requirements:

- Node 22.18+ (built with 22.23.5);
- FFmpeg with libmp3lame (6.1.1);
- for the QA, Python 3 with numpy and scipy;
- the Cathedral instruments, already in this branch, at `experiments/cathedral-experiment-001/instruments/`.

```bash
node experiments/afterimage-pulse-001/build.ts --candidate
```

```bash
python3 -I experiments/afterimage-pulse-001/qa/measure.py experiments/afterimage-pulse-001/build --json experiments/afterimage-pulse-001/build/qa-candidate.json
```

```bash
node experiments/afterimage-pulse-001/build.ts
```

```bash
node experiments/afterimage-pulse-001/deliver.ts
```

- [`build.ts`](build.ts):
  - runs compose;
  - renders the six rack scores, four at a time (about 15 s each; the choir and the voice are the slowest);
  - renders the engine project (about 50 s);
  - writes the matched WAV, the MP3 and the key stems.

  A score whose JSON is unchanged since its last render is not rendered again, so a mix-only change re-runs only the
  engine.
- **Determinism:** the candidate was rebuilt from the same rack renders and reproduced its measured master
  byte for byte. A second from-scratch rack render was not run, to stay within the render budget.

| Path | Contents |
|---|---|
| [`compose.ts`](compose.ts) | The whole piece: the hook and its endings, every part, the drums with their timing, the mix and its automation, the QA switches (`--candidate`, `FIX`) |
| [`source/`](source) | The six generated rack scores, the engine project, three drum kits and the QA map: the editable source as data |
| [`build.ts`](build.ts) · [`deliver.ts`](deliver.ts) · [`qa/measure.py`](qa/measure.py) | Build, delivery, measurement |
| [`delivery/`](delivery) | WAV, MP3, `stems/`, `source/` (MIDI), `provenance/`, `SHA256SUMS` |

**Stopped here for the owner's listening approval.** No full-length arrangement until the owner asks.
