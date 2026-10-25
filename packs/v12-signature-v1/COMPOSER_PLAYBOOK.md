# V12 SIGNATURE · Composer playbook

For agents composing with this pack on DaemonV12 0.7.0. It explains *why*
IGNITION (`v12-signature-showcase.json`) works, turns that into five reusable
recipes, and lists the mistakes most likely to make a piece boring or muddy.
Facts about each sound (roots, ranges, hold lengths, rates) live in
[`v12-signature.catalog.json`](v12-signature.catalog.json) and the
[README inventory](README.md#inventory); measurements are in [REPORT.md](REPORT.md).
The general workflow (critique, Risk Pass, compute discipline) is the Composer
skill: `plugins/daemonv12-composer/skills/daemonv12-composer/SKILL.md`.

Following this playbook removes common technical and structural failures. It
does not guarantee a good piece: only listening can judge a hook or a drop.

---

## 1. How IGNITION was decided

Each row separates the **creative choice** from the **v0.7 constraint** that
shaped how it was written.

| Element | Creative choice (why) | Constraint it works around |
|---|---|---|
| **Key and register** | A minor: every pack root except PHANTOM's (E5) is A, so the tonic plays at rate 1 (exact and free). The lead sits in the 5th octave, above the chords (E3–G4). The arp (G#4–G5) shares the lead's octave, so it drops 2.5 dB under the hook. | Pitch is `playbackRate`; non-root notes cost interpolation budget and change length. |
| **Progression** | Am–F–G–E (i–VI–VII–V). F and G climb; E *major* (G#) is a leading-tone chord that makes the return to A feel inevitable. Bass roots A1, F1, G1, E1 stay inside the sub range (41–55 Hz) and move by step. | None; this is taste. A minor-key V chord just has to be spelled with G#. |
| **Hook** | One idea per bar on a 3+3+2 tresillo (`1:1`, `1:2+1/8`, `1:4`). Bar 1 leaps a fourth (E5–A5), bar 3 repeats that leap a step lower (D5–G5): a *sequence*, which makes the line learnable. Bar 2 answers by falling (F5–E5–C5). Bar 4 climbs the E-major arpeggio (E5–G#5–B5) and stops on tension; the resolution to A5 is held back until the final section. | Notes over ~0.5 s let PHANTOM's delayed vibrato bloom, so long notes "sing" and short ones stay clean. The final A5 (rate 1.33484) can last at most 4.49 s; the gate `3/2` plus 0.9 s release fits. |
| **Foreshadowing** | In the groove, SPECTER sings the first half of the hook an octave down, quietly, with long notes. The drop *returns* to a melody the listener has half-heard. | SPECTER is played from `offsetSeconds 1.2` (inside its "oh") with a 0.06 s attack so no note starts on the vowel's swell. |
| **Bass relationship** | Groove: a tight kick on each beat, sub on the three sixteenths between: they never overlap. Drop: kick layered (SUB HAMMER + IRON PULSE), held sub roots ducked under every kick, REACTOR on the off-beat eighths. Changing the bass *pattern* between sections is a big part of the contrast. | No sidechain: the duck is authored gain automation. No loop: the held sub is retriggered each bar with a gate. SUB HAMMER, IRON PULSE and ABYSS are phase-locked on A1, so same-tick hits reinforce. |
| **Hypnotic arp** | SIGNAL plays a three-note cell in continuous sixteenths. Three steps against a four-beat bar start each bar on a different note, so the loop drifts and never repeats exactly. Accent the cell's first note (×1.18 velocity); a dotted-eighth delay (3/16 note = 351.5625 ms at 128 BPM) adds a second rhythm. | The delay has one tap and no feedback: the echo pattern is written into the notes, not the effect. |
| **Arrangement** | IGNITION 2 bars → ORBIT 4 → ASCENSION 2 → CONVERGENCE (drop) 4 → AFTERGLOW 2 + tail. Something enters or leaves every two bars (bass bar 3, REACTOR bar 4, hats/clap/chords/choir bar 5). | 15-track limit and the interpolation budget (IGNITION uses 58% of it). Fewer, better elements. |
| **Build** | Bar 7 holds an E pedal (dominant). Bar 8 *removes* the kick (one hit on beat 1 only) and the sub, rolls the snare in sixteenths, and stops the arp one eighth before the drop: a held breath. | No filter automation: tension comes from subtraction, density and the riser, not sweeps. ASCENSION ends on its last frame, so its start is `offsetSeconds = 6 − build seconds`. |
| **Drop** | Kick, sub, impact, bell and hook all land on 9:1 into the low-end vacuum of bar 8. The arp steps back (−2.5 dB) so the hook speaks. Measured: drop 2.2 LU above the groove. | Before the fix the drop was only 0.6 LU louder: the groove was too full (the arp was as loud as the kick). Contrast was gained by making the groove *lighter*, not the drop louder. |
| **Ending** | Bar 13: the hook's held A5 over A minor with the opening bell, so the piece closes where it began. The arp echoes its cell three times, falling in velocity. Every release finishes before 28 s. | No master fade: the ending is composed with gates and long releases; `render.duration` 28 s leaves 1.75 s of tail (last 10 ms measured −60.8 dBFS). |

---

## 2. Five reusable recipes

All snippets are valid v0.7 note or track fields. Positions are pattern-relative
(place patterns with `clips`). Rates come from the catalog `rateTable`,
relative to each sound's `rootNote`.

### Recipe A — A hook with identity

1. Choose a rhythm before choosing pitches. Use tresillo (3+3+2 eighths) or another
   syncopation, **not** four even quarter notes.
2. Bar 1: start on a chord tone that is *not* the root, and leap (a fourth or more).
3. Bar 2: answer by moving the other way, by step.
4. Bar 3: repeat bar 1's shape one step lower or higher (a sequence).
5. Bar 4: end on tension (the 5th, the 7th, or the leading tone). Save the root for the payoff.
6. Hold the final note over the payoff for at least one bar.

PHANTOM (root E5), the first hook bar of IGNITION (E5, A5, G5):

```json
[{"start":"1:1","velocity":0.95,"gate":"3/8","envelope":{"attackSeconds":0.005,"releaseSeconds":0.12}},
 {"start":"1:2+1/8","velocity":0.95,"playbackRate":1.33484,"gate":"3/8","envelope":{"attackSeconds":0.005,"releaseSeconds":0.12}},
 {"start":"1:4","velocity":0.95,"playbackRate":1.189207,"gate":"1/4","envelope":{"attackSeconds":0.005,"releaseSeconds":0.12}}]
```

PHANTOM rates for A minor: A4 0.66742, C5 0.793701, D5 0.890899, E5 1 (omit),
F5 1.059463, G5 1.189207, G#5 1.259921, A5 1.33484, B5 1.498307, C6 1.587401.

### Recipe B — Groove that drives without mud

**Groove** (one beat shown; repeat on beats 2–4). Kick track (drumkit, the pack kit):

```json
{"start":"1:1","pitch":"sub-hammer","velocity":0.97,"gate":"1/16","envelope":{"attackSeconds":0.001,"releaseSeconds":0.04},"chokeGroup":"kick"}
```

ABYSS on the three sixteenths after the kick (add REACTOR with the same notes
at 0.85× velocity, on a track with `{"type":"highpass","frequencyHz":110}`):

```json
[{"start":"1:1+1/16","velocity":0.74,"gate":"1/16","envelope":{"attackSeconds":0.002,"releaseSeconds":0.02}},
 {"start":"1:1+1/8","velocity":0.62,"gate":"1/16","envelope":{"attackSeconds":0.002,"releaseSeconds":0.02}},
 {"start":"1:1+3/16","velocity":0.68,"gate":"1/16","envelope":{"attackSeconds":0.002,"releaseSeconds":0.02}}]
```

**Drop.**

- Kick: SUB HAMMER (`gate` `"1/8"`) plus IRON PULSE (no gate) on the same tick, both with `"chokeGroup":"kick"`.
- Sub: one ABYSS root per bar (`"gate":"1/1"`, envelope `{0.004, 0.06}`).
- Growl: REACTOR on each beat's `+1/8`.
- Duck the sub under every kick with track automation (absolute positions; ABYSS base −5.5 dB, depth −9 dB):

```json
{"at":{"musical":"8:4+15/64"},"value":-5.5,"transition":"linear"},
{"at":{"musical":"9:1"},"value":-14.5,"transition":"linear"},
{"at":{"musical":"9:1+1/16"},"value":-9.55,"transition":"linear"},
{"at":{"musical":"9:1+3/16"},"value":-5.5,"transition":"linear"}
```

Repeat the four points on every beat (dip 1/64 early, recover over a dotted
sixteenth). Use −7 dB depth on AFTERGLOW and −5 dB on EVENT HORIZON. Every point
is `linear`: a `step` on a sustained sound clicks.

### Recipe C — Harmony in two layers

- **Space**: one EVENT HORIZON note per chord, on the chord root (A2 = rate 1; F2
  0.793701, G2 0.890899, E2 0.749154). It is an open fifth, so it fits any major
  or minor chord. Use `offsetSeconds 1.6` (skip the swell), `gate "1/1"`, envelope
  `{0.15, 0.35}`, so chords cross-fade.
- **Colour**: AFTERGLOW (root A3) as three or four stacked notes between C3 and E4,
  moving each voice by the smallest step. The IGNITION voicings:

| Chord | Notes | AFTERGLOW rates |
|---|---|---|
| Am | E3 A3 C4 E4 | 0.749154, 1, 1.189207, 1.498307 |
| F | F3 A3 C4 F4 | 0.793701, 1, 1.189207, 1.587401 |
| G | G3 B3 D4 G4 | 0.890899, 1.122462, 1.33484, 1.781797 |
| E | E3 G#3 B3 E4 | 0.749154, 0.943874, 1.122462, 1.498307 |

Track: `{"type":"highpass","frequencyHz":120}` keeps the chords out of the bass.
IGNITION uses velocity 0.45 in the groove and 0.6 in the drop; three notes are enough when the budget is tight.

### Recipe D — Tension and payoff

1. **Foreshadow**: state half the hook early, quietly, on a different instrument
   (SPECTER an octave down: `offsetSeconds 1.2`, envelope `{0.06, 0.25}`).
2. **Pedal**: sit on the V chord (E) for the build; the harmony itself waits.
3. **Vacuum**: in the last bar before the drop, remove the kick after beat 1 and
   remove the sub entirely. End the arp one eighth early.
4. **Roll**: TITANIUM CRACK eighths, then sixteenths with rising velocity:
   `{"pitch":"titanium-crack","velocity":0.36,"gate":"1/32","envelope":{"attackSeconds":0.001,"releaseSeconds":0.015},"chokeGroup":"snare"}`,
   ramping to 0.86.
5. **Riser**: `{"start":"1:1","velocity":0.9,"offsetSeconds":2.25}` in a two-bar
   pattern at 128 BPM (6 − 3.75). Other tempos: `offsetSeconds = 6 − bars × 240 / bpm`,
   rounded to six decimals.
6. **Arrival**: kick, sub, CONVERGENCE (velocity ≤ 0.9) and the hook's first note
   on the same downbeat.
7. **Payoff**: the withheld root (A5) held over the tonic chord, plus the opening
   bell (CHROME STRIKE at rate 1 and 0.5).

### Recipe E — Seamless loops (games, video beds)

- `"render":{"duration":{"bars":8},"tail":"none"}`: the output is exactly eight bars,
  and anything still sounding is cut at the seam.
- Every voice must **finish inside the loop**: `gate` + release ≤ the time left
  before the seam. At 128 BPM, 1/8 note = 0.234 s, so a last-bar pad with
  `"gate":"7/8"` and `releaseSeconds 0.2` ends in time.
- Put kick + sub on `1:1` of bar 1: the seam then lands on the strongest beat,
  which masks the pad's short re-attack.
- No echo or reverb tail crosses the seam (they are cut). Keep loop tracks dry,
  or leave the final eighth of the loop empty.
- Long beds: EVENT HORIZON at rate 1 from `offsetSeconds 1.6` lasts 8.4 s, so retrigger
  it every four bars at 128 BPM (7.5 s) instead of holding it across eight.
- Do not use ASCENSION or CONVERGENCE inside a loop unless the loop *is* the build.
- v0.7 has no wrap-around tails: a short dip at the seam is the cost. Check the
  last 10 ms of the master is near silence.

---

## 3. Ten mistakes weaker agents make, and the fix

| # | Mistake | Correction |
|---:|---|---|
| 1 | **One pattern copied for the whole piece.** The same two bars for 30 s. | Write a section plan first. Add or remove at least one element every two to four bars. Change the *bass pattern* between groove and drop. Vary the fourth bar of every phrase (fill, rest or turnaround). |
| 2 | **Generic hook**: even quarter notes walking up the scale from the root, or arpeggios of the chord. | Apply Recipe A: rhythm first, one leap, an answer, a sequence, end on tension. If the hook still works sung on one pitch, the rhythm is good. If it does not, rewrite the rhythm. |
| 3 | **Muddy low end**: ABYSS, REACTOR full-range, untamed kick tails and low pad notes all at once. | One sub owner per moment (ABYSS). High-pass REACTOR at 110 Hz when ABYSS plays. Gate SUB HAMMER (`1/16` in grooves, `1/8` in drops). Duck the sub under kicks. High-pass pads at 70–120 Hz. Never hold two different sub pitches at once. |
| 4 | **The drop is not a drop**: the build already plays everything, so the drop only gets louder. | Keep the groove lighter (in IGNITION the arp at kick level flattened the arc). Empty the bar before the drop of kick and sub. Change pattern *and* register at the drop, not just gain. |
| 5 | **Overproduction**: 15 tracks, reverb on everything, all 16 sounds at once, four-note pads at high rates. | Use 8–13 tracks. Use three reverbs at most (bell, lead, voice). Bring in two or three new elements per section. Prefer one EVENT HORIZON note to stacked chords. Watch the budget: `daemonv12 validate` fails over one billion taps. |
| 6 | **Ignoring pitch–duration coupling**: an ungated pad note rings through four chord changes, or a high held note ends early because its source ran out. | Every sustained note gets `gate` + `envelope`. Check the README *Hold* column. A note at rate *r* lasts at most `catalog seconds / r`. |
| 7 | **Wrong pitch maths**: semitone numbers as `playbackRate`, PHANTOM computed from A, or kit pitch numbers treated as musical notes. | `playbackRate = 2^(semitones/12)` from the catalog `rootNote` (PHANTOM is E5). Copy values from `rateTable`. Kit `pitch` only *selects* a drum; tune drums with `playbackRate`. |
| 8 | **Clicks you cannot see**: `step` gain jumps on held notes, `offsetSeconds` starting mid-waveform with no attack, `releaseSeconds 0`. | Use `linear` automation with ramps of 1/64 or longer. When starting from inside a source, use an attack of 0.02–0.06 s and a release of 0.02 s or more. |
| 9 | **Bad endings**: the render cuts a ringing pad or reverb at `render.duration`, or the piece simply stops. | Compose the last bars: a held resolution, releases of 0.9–1.6 s, and a duration that leaves 1.5–2 s after the last onset. Confirm the last 10 ms are quiet. |
| 10 | **Chasing loudness**: raising every gain until it clips. | Keep low-end tracks below 0 dB (CONVERGENCE + ABYSS at velocity 1 reach +0.2 dBFS). Use a gentle master compressor (−12 dB, 1.8:1) and keep true peak under −1 dBTP. Judge sections against each other, not against commercial loudness. |

Also: give velocities shape (accents, crescendos, ghost notes). A flat 0.8 everywhere sounds mechanical.

---

## 4. Choosing instruments

Ranges, roots and hold lengths: the catalog (`playback.recommendedNotes`,
`sourceSecondsAtHighestRate`) and the README inventory. Roles in practice:

| Role | First choice | Pairs well with | Avoid |
|---|---|---|---|
| Sub | ABYSS (A1, held or rolling) | SUB HAMMER on the same tick (phase-locked) | Pitches below E1. Held under an ungated kick. Two sub notes at once. |
| Mid-bass | REACTOR (high-passed 110 Hz over ABYSS) | ABYSS with the same rhythm; off-beat eighths in drops | Full-range REACTOR plus held ABYSS (mud). Held REACTOR under busy chords. |
| Kick | SUB HAMMER (gated in grooves) | IRON PULSE layered for drops, both `chokeGroup "kick"` | IRON PULSE alone under a held sub (thin). Ungated SUB HAMMER at 120+ BPM. |
| Backbeat | NEON CLAP in grooves | TITANIUM CRACK + NEON CLAP stacked in drops; TITANIUM rolls for builds | Clap and snare stacked everywhere (no contrast left for the drop). |
| Hats | GHOST TICK sixteenths with accents | OPEN CIRCUIT off-beats, gated `1/8`, `chokeGroup "hats"` | A tick choking the open hat one sixteenth after it starts. |
| Arp / ostinato | SIGNAL (A3–G5) | Dotted-eighth delay; the hook above it | SIGNAL and PHANTOM equally loud in the same octave. |
| Lead | PHANTOM (A4–C6) | Its own vibrato on long notes; a 1/8 delay, reverb about 2 s | Fast note runs (its bloom needs length). Notes above C6. |
| Pads | EVENT HORIZON (bed), AFTERGLOW (chords) | HORIZON root + AFTERGLOW voicing together | AFTERGLOW below C3 (mud, budget). HORIZON's swell inside a fast change (use offset 1.6). |
| Voice | SPECTER (E3–E4) | Hook foreshadowing, the chord top in finales, reverb about 2.6 s | Above E4 (vibrato too fast). Short notes started on its swell. |
| Identity | CHROME STRIKE | Section downbeats, opening and closing; layer rate 1 + 0.5 | Every bar (the bell stops meaning "section"). |
| Transitions | ASCENSION → CONVERGENCE | Ending the riser on the impact's downbeat | Starting ASCENSION at offset 0 for a short build (it will not land on the downbeat). |

A strong small palette for a first draft: SUB HAMMER, ABYSS, NEON CLAP, GHOST
TICK, SIGNAL or PHANTOM, EVENT HORIZON. Add the rest only when a section needs them.

---

## 5. Hook-first iteration

Compose the smallest thing that can fail first: the hook.

1. **Brief in one line**: key, tempo, mood, length, use (loop, cue, track).
2. **Sketch three to four competing hooks** as separate four-bar projects: kick, an
   ABYSS root per bar, one EVENT HORIZON note per chord, and the hook. Make
   each one different in *rhythm and contour*, not only pitches.
3. **Technical gate** (measurable, automatic): `daemonv12 validate --json` is
   `ok`, no clipping, rates within each sound's recommended range, every
   sustained note gated.
4. **Musical critique** (needs judgment): Is there a leap and an answer? Does
   bar 4 end on tension? Would it survive being sung on one pitch? Is it
   different from the other sketches? Rewrite the weakest bar once.
5. **Pick one** by human listening if available. Otherwise mark the choice as
   provisional in the project `description`.
6. **Expand** the winner: an eight-bar loop with groove and harmony (Recipes B and C),
   then the section plan, the build and the drop (Recipe D). Add the ending last.
7. **Mix last**: gains, high-passes, ducking, at most three reverbs. Render the
   full production route only now, because each render with effects costs
   about a minute. Follow the Composer skill's limit of five serious versions.

| Measurable (automatic) | Needs human listening |
|---|---|
| `validate` ok; budget well under the limit; exact frame count | Is the hook memorable? |
| 0 clipped samples; true peak < −1 dBTP | Does the groove feel good at this tempo? |
| Drop section louder than the groove (section LUFS); stems aligned | Does the drop *feel* bigger, not just measure louder? |
| Low band mono (correlation near 1); last 10 ms quiet | Do the timbres suit the mood? Is anything harsh or annoying? |
| No `step` automation on sustained tracks; gates on held notes | Is it boring after the third repeat? Does the ending satisfy? |

Numbers are proxies. A piece can pass every check and still be dull. Report
measurements as measurements and musical claims as unverified until someone listens.

---

## 6. Handoff: multi-root sustained instruments (Codex task, not implemented)

**Goal.** Cut interpolation cost and keep timbre natural by adding extra root
variants of the sustained instruments. Add assets only; no engine change; the
existing 16 WAVs and both demos stay byte-identical.

**Task.**

1. In `scripts/generate-v12-signature.ts`, make the root a parameter of the
   AFTERGLOW, PHANTOM, SPECTER and SIGNAL voice functions (today they use the
   constants `A3`, `E5`, `A3`, `A4`). Keep vibrato, LFO and envelope times in
   seconds so every variant moves at the same speed.
2. Generate two extra roots per instrument, six semitones either side of the
   existing one, so every recommended note is within ±3 semitones of a root:
   - AFTERGLOW D#3, D#4
   - PHANTOM A#4, A#5
   - SPECTER D#3, D#4
   - SIGNAL D#4, D#5 (covers C4–F#5; its lowest notes, A3–B3, stay 4–6 semitones from D#4)

   Name files `12-afterglow-ds3.wav` style (no `#` in paths).
3. Add one kit per instrument (for example `assets/v12-signature/afterglow.kit.json`).
   Each entry's `pitch` equals its root MIDI number (D#3 = 51, A3 = 57, D#4 = 63)
   and its name looks like `afterglow-ds3`. Agents choose the nearest-root entry
   and compute `playbackRate` from that root.
4. Add the variants to the catalog with their own roots, ranges and hashes.
   Bump `PACK.version` to 1.1.0. Do not alter `sounds` entries 1–16 or their bytes.
5. Tests:
   - existing hashes unchanged
   - each variant tuned within ±5 cents
   - same peak target
   - third-octave profile similarity above 0.9 to the original after pitch alignment
   - kits parse
   - a *new* example project (a copy of IGNITION's drop using the kits) validates
     with materially lower `budgetUse()` than the original, which stays untouched
6. Do not modify the engine, `examples/`, BANGER LAB, or the IGNITION and
   audition projects. Licensing stays pending.
