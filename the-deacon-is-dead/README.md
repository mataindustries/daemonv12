# THE DEACON IS DEAD

A second imaginary record by The Velvet Hearse, and the productions made from it. Nothing in any track is a reed, a
horn-like lead, a synthetic voice, or a sample of one. The bass player, the singer and the reed player are written out
of the story, and with them the three most recognisable DaemonV12 sounds.

| Listen | What it is | Length |
|---|---|---|
| [`full/delivery/THE-DEACON-KNOCKS-BACK-FULL-WAKE.mp3`](full/delivery/THE-DEACON-KNOCKS-BACK-FULL-WAKE.mp3) | **The definitive version.** "THE DEACON KNOCKS BACK (FULL WAKE)": the record, the approved short version sampled as a second record, and pieces of it reversed | 2:52 |
| [`production/the-deacon-knocks-back.mp3`](production/the-deacon-knocks-back.mp3) | The approved short version, "THE DEACON KNOCKS BACK", made only from the record (preserved byte for byte) | 0:58.5 |
| [`source/the-velvet-hearse--the-deacon-is-dead.mp3`](source/the-velvet-hearse--the-deacon-is-dead.mp3) | **The record.** The Velvet Hearse, "The Deacon Is Dead" (1972, imaginary) | 1:21 |
| [`production/the-deacon-knocks-back--creative-pass.mp3`](production/the-deacon-knocks-back--creative-pass.mp3) | The short version before its refinement pass, for A/B | 0:58.5 |

The record plays about 8 LU quieter than the productions (-22.5 against -14.2 to -14.5 LUFS). Every part on it is a
hard transient and the rack has no limiter, so its normalisation stops at the -1 dBTP ceiling. Turn it up.

Lossless: `assets/record/the-velvet-hearse--the-deacon-is-dead.wav` (the print), `production/the-deacon-knocks-back.wav`
(the short version's master; both 44.1 kHz/16-bit) and `full/delivery/THE-DEACON-KNOCKS-BACK-FULL-WAKE.24.wav` (PCM24).

> The producer (an AI agent) cannot hear audio. Musical descriptions here are design intent. Numbers are signal
> measurements, not quality scores. The owner approved the short version after normal and car playback; nobody has
> heard the full wake yet.

---

## THE DEACON KNOCKS BACK (FULL WAKE)

**96 BPM · seven equal steps · 2:52.** The definitive version. Three generations of one record, every sound read by
the unchanged DaemonV12 sampler:

| Gen | Source | Made by | Chops | Events |
|---|---|---|---|---|
| 1 | the record print, `assets/record/the-velvet-hearse--the-deacon-is-dead.wav` | `source/compose.ts`, printed once by the rack | 42 | 1,213 |
| 2 | **the approved short version**, sampled as a second record: `assets/short/the-deacon-knocks-back.wav`, a byte-identical copy of `production/the-deacon-knocks-back.wav` (the engine reads samples only under `assets/`) | `production/build.ts` | 16 | 73 |
| 3 | **the other side**, `assets/full/the-other-side.wav`: three gen-2 fragments (its reply, Iggy's three knocks, its seven-knock scale), frame order reversed bit-exact | `full/dig.py` | 2 | 7 |

The complete genealogy is [`full/genealogy.json`](full/genealogy.json): every file with its parents and hash, and every
chop played, with its source, generation, tracks, rates and event count. The chop notebook is
[`full/chops.json`](full/chops.json) (66 chops; the full wake plays 60). Gen 1 plays at 0.820336, two of its own seven
steps down. Gen 2 and gen 3 already live at 96 BPM and play at 1. Any chop moves by whole steps: rate × 2^(k/7).

**The conversation changes hands.** The short version had one idea: the living knock and the dead answer. The full
wake lets that conversation turn over. The dead start talking first. The wake is heard from inside the coffin. The
two sides knock at each other faster and faster, then climb past each other in opposite directions, then argue in
different meters. On the last call, for the first time, nobody answers, until the band has finished.

| Time | Bars | Section | What happens |
|---|---|---|---|
| 0:00 | 1-2 | VIEWING | The short version's opening, rebuilt: the door at half speed, three knocks, the reply, the likembé picks up |
| 0:05 | 3-4 | THUMB | The likembé alone and three knocks; from the other side, the reply played backwards inhales into the reply |
| 0:10 | 5-12 | WAKE | The approved one-shot groove, four knock-and-reply pairs, Odile's squeaks and the urn's whoop arriving one by one. In the fourth pair the third knock is already his |
| 0:30 | 13-20 | HE KNOCKS FIRST | The roles turn over. The dead knock first, from inside, in dotted eighths; the living answer with one crisp knock on the one. The spring bass moves five steps, then three, under a likembé that stays on the tonic: two keys at once |
| 0:50 | 21-24 | SEANCE i | The short version as a record: its wake (reply, groove, Odile, knocks) heard through the coffin lid, muffled and roomy, with only live coins on top |
| 1:00 | 25-28 | SEANCE ii | The same bar cut into sixteenths and dealt out again in 3+3+2, his reply leading each group, a snare roll made of one slice; then Iggy knocks for real |
| 1:10 | 29-32 | SEANCE iii | Half time. The short version's seven-knock scale stacked three high into a neutral chord, each voice at its own speed so the chord smears apart; the same scale backwards lands on every next downbeat. Ends on the short version's laugh, sampled |
| 1:20 | 33-36 | ODILE | The floor: four bars of the record as found, no drums. Her laugh stutters |
| 1:30 | 37-44 | FOURTEEN STEPS | The pallbearers' whole bars (half time, a march growing under them), then half bars, then the climb doubles: one step a beat, an octave up, fourteen steps in all. Two stabs |
| 1:50 | 45-46 | KNOCK | Silence and the door lifting. Dead and living knock at each other, the gaps shrinking from a beat to a sixteenth. Silence. His knock is the drop |
| 1:55 | 47-54 | KNOCKS BACK | The record's hot shout. The knocks as found, as a triad, as the seven-step scale; in the last pair the living climb the scale while the dead climb down it backwards |
| 2:15 | 55-62 | THE ARGUMENT | Three against four. The dead are the kick, on dotted quarters; the spring answers a dotted eighth later, so the bass line passes back and forth between the living and the dead. Odile screams; the bass moves five steps and back |
| 2:35 | 63-66 | LAST SHOUT | The shout once more with the scale both ways. Then the last call, the scale climbing alone, and no answer |
| 2:45 | 67-68 | CLOSED CASKET | The approved ending, now a late answer: the record's last hit, the spring's laser, the coins. Then one knock from inside, late. The door |

**The ending is earned by absence.** The reply has answered every call for 2:45, so its silence on the last downbeat
is the loudest event in the track. The knock that arrives four beats after the band has stopped is the same late knock
as in the short version, but now it is an answer.

### Delivery

| File | What it is |
|---|---|
| [`full/delivery/THE-DEACON-KNOCKS-BACK-FULL-WAKE.mp3`](full/delivery/THE-DEACON-KNOCKS-BACK-FULL-WAKE.mp3) | 320 kbps, encoded from the PCM24 master with no gain or normalisation change |
| `full/delivery/THE-DEACON-KNOCKS-BACK-FULL-WAKE.24.wav` | the master: PCM24 stereo, 44.1 kHz, 7,585,200 frames (172.0 s), through the Production24 path |
| `full/delivery/stems/*.flac` | 15 aligned PCM24 stems (post-track, pre-master), losslessly packed; each decodes sample-identical to the package's PCM24 stem |
| `full/delivery/metadata/` | the Production24 package's render, mastering, provenance and inventory records and its SHA256SUMS |
| [`full/SHA256SUMS`](full/SHA256SUMS) | hashes of every full-wake file above, and of its three sources |
| [`the-deacon-knocks-back-full-wake.json`](the-deacon-knocks-back-full-wake.json) | the editable native project |
| [`full/build.ts`](full/build.ts), [`full/dig.py`](full/dig.py) | the composition, and the dig of all three generations (it also derives gen 3) |
| [`full/genealogy.json`](full/genealogy.json), [`full/chops.json`](full/chops.json) | the sample genealogy and the chop notebook |

To restore a stem as WAV:

```bash
ffmpeg -i the-deacon-is-dead/full/delivery/stems/reply.flac -c:a pcm_s24le reply.wav
```

### The two passes

**Arrangement pass.** The form above, the three generations and the dig, rendered once at -13.94 LUFS, -1.87 dBTP and
LRA 4.5, with no clipping, 1,293 events and 33 % of the interpolation budget. The section arc measured as designed:
the séance dips through the lid, there is true silence before the drop (-74 LUFS momentary, then -12.9), and the
unanswered downbeat is the loudest moment. The weakness was the low end: as the dead talked more, energy below
120 Hz rose to 57 % in HE KNOCKS FIRST and 61 % in THE ARGUMENT. The car-approved short version runs 24-49 %.

**Refinement and QA pass.**

| | Change | Measured result |
|---|---|---|
| R1 | The Deacon's own knocks shortened, 0.7 → 0.45 beats | below 120 Hz in HE KNOCKS FIRST 57 → 56 %: no real effect |
| R2 | THE ARGUMENT's dead kick shorter (0.55 → 0.4 beats) and softer between accents | 61 → 56 %: little effect |
| R3 | His knocks and the argument's unaccented thuds moved to their own lightly driven `dead` track (6 dB drive). The approved reply sound keeps the hook answers and the accents. The two stabs joined the record-loop track to stay within 15 tracks | below 120 Hz: HE KNOCKS FIRST 56 → 32 %, THE ARGUMENT 56 → 32 %, the knock exchange 76 → 27 %, the wake 40 → 37 %. Every new section is now inside the approved range |

Measuring which stem carried the sub (the reply track: 59-97 %) showed why R1 and R2 failed. The reply's 18 dB
saturation flattens any level change made before it, and gain, velocity and gate all come before it. R3 also made HE
KNOCKS FIRST darker than the wake (-15.7 against -14.5 LUFS short-term), so the arc now dips there before the séance.

### Measurements (final PCM24 master)

| | |
|---|---|
| Length | 172.0 s; the door's groan is the last sound, from 2:48 |
| Loudness | -14.25 LUFS integrated, LRA 4.6 LU; the 320 kbps MP3 measures -14.2 LUFS |
| True peak | -1.83 dBTP; MP3 sample peak -1.8 dBFS; no full-scale samples, no clipping on the master or any of the 15 stems |
| Mono / stereo | fold-down changes RMS by -0.25 dB; stereo correlation 0.887 |
| Short-term loudness at each section's end (3 s) | viewing -17.0 · thumb -16.6 · wake -14.5 · he knocks first -15.7 · séance -14.1 · odile -17.2 · fourteen steps -15.1 · knock -17.2 · knocks back -12.2 · argument -14.7 · last shout -12.9 · then the ending decays |
| Low end | energy below 120 Hz 7-43 % per section; 52-56 % only in the viewing and the ending, the short version's own reply-alone moments |
| Timing (onsets vs grid) | living knocks 0 ms; the dead's knocks and the drop within 2 ms; gen-2 slices within 3 ms (the snare slice keeps the short version's +11 ms lay-back); the gen-2 wake within 4 ms; the reversed inhale peaks 7 ms before its beat |
| Preservation | the approved short version's 8 checksums ([`SHA256SUMS`](SHA256SUMS)) still pass; nothing under `production/`, `source/`, `assets/record/` or `counterfeit-gold-opus/` changed |
| Determinism | a Production24 replay of the whole package reproduced the master, all 15 stems and its MP3 byte for byte |

### Rebuild

From the repository root (Node 22.18+, FFmpeg, Python 3 with NumPy). The record print and the short version are
committed and reused as they are.

```bash
python3 the-deacon-is-dead/full/dig.py
```

```bash
node the-deacon-is-dead/full/build.ts --project-only
```

```bash
node scripts/headliner-production24.ts project the-deacon-is-dead/the-deacon-knocks-back-full-wake.json NEW_DELIVERY_DIR --reuse-voices
```

`full/build.ts full` instead renders an ordinary engine WAV with stems into `the-deacon-is-dead/work/full`.
[`full/measure.py`](full/measure.py) prints the per-section table (stems, mix, short-term loudness, low end).

### Things to check by ear

- **The séance.** Gen 2 is a finished, compressed master, so the cut-up and the smeared scale chords sit beside raw
  record chops. The re-dealt 3+3+2 bars and the smear are the least conventional and least tested passages.
- **THE ARGUMENT.** A dotted-quarter kick under a four-on-the-floor likembé and backbeat. It is meant to tilt; it may
  just sound out of time.
- **HE KNOCKS FIRST.** The bass five and then three steps away from a likembé that never moves: two keys at once in
  seven equal steps, on purpose.
- **The late knock.** It is the short version's, at the same distance from the last hit, but it follows 2:45 of
  answers. Whether its silence before reads as an ending or a mistake is the main bet.
- Everything the short version's list says about the tuning, the 45 Hz reply on phones, and the ringing likembé still
  applies.

---

## The short version: THE DEACON KNOCKS BACK

The approved 58.5-second version follows, preserved as delivered.

---

## The palette: the same engines, other jobs

The rack and the Timbre Lab hold few instrument engines, and FERRYMAN used almost all of them. So the new cast comes
from new *roles*: other registers, articulations and controls, and the two engines FERRYMAN never touched.

| Engine | Its familiar job (FERRYMAN) | Its job here |
|---|---|---|
| `organic-percussion/pot` | not used | **the urn**: the kick (palm thud, 70 Hz, 80 ms) and whoops |
| `mechanical-orchestra/bearings` | not used | **the collection plate**: two coins per sixteenth as the shaker; a coin spill at the end |
| `organic-percussion/log` | a few temple-log knocks | **the coffin**, a two-tongue slit drum: half the bass line, Iggy's knocks (the hook), and the Deacon knocking from inside, muffled and lower |
| `mechanical-orchestra/spring` | a damped chank, one laser | **the hearse's spare spring** as the bass: twanged at A1, its chirp falling into the note; a laser at the end |
| `mechanical-orchestra/tine` | clean Rhodes chords | **a likembé**: full bridge buzz, a sixteenth-note ostinato, tuned to seven equal steps |
| `organic-percussion/skin` | congas | twice: **a friction drum** (rub only: short squeaks, bends up to an octave) and **a rosary-bead snare** (slap, beads at full rattle) |
| `mechanical-orchestra/bar` | vibraphone and funeral bell | **the hearse's brake drum**: hard, muted, half-way to the alien end: the bell pattern |
| `mechanical-orchestra/bow` | bowed-saw drone | **the preparation-room door**: three hinge creaks |
| `living-bass`, `impossible-voice`, `breath-reed`, `context/kick`, `context/snare`, `mechanical-orchestra/clock` | the Deacon, Odile, Ezra, Iggy's kit, the hi-hat | **absent** |

Check it: `grep '"instrument"' source/the-deacon-is-dead.score.json` lists the record's ten parts, and every track of
[`the-deacon-knocks-back.json`](the-deacon-knocks-back.json) reads the one print.

---

## The record

**THE VELVET HEARSE · "The Deacon Is Dead"**
Lazarus Sound Library LSL-45-013 (1972), a 7-inch single. *The band, the label and the record are invented.*

Deacon Mortimer Vane, who played the upright bass, died in the spring of 1972. The night before his funeral his widow
locked the band's instruments in the hearse with him: no music in the house while he lay in it. So the band played the
house, and Lazarus's engineer left the portable recorder running in the preparation room. Odile would not sing.
Brother Ezra's reed had split. Nobody touched the Deacon's bass.

| Player | Plays | Engine |
|---|---|---|
| Ignatius "Iggy" Plank | the Deacon's coffin, as a slit drum (two tongues, the lid, the brass rail, a stick along the panels) and rosary beads on a tambourine skin | `organic-percussion/log`, `organic-percussion/skin` |
| Brother Ezra Coffin | the cremation urn | `organic-percussion/pot` |
| Mrs. Vane | the hearse's spare coil spring, hung from a hook | `mechanical-orchestra/spring` |
| Lucius Vane | a likembé built that night from the casket-handle springs and a cigar box | `mechanical-orchestra/tine`, full buzz |
| Odile Vane | a friction drum: a wet finger on a skin, moaning and laughing for her | `organic-percussion/skin`, rub |
| the mourners | the collection plate; the hearse's brake drum | `mechanical-orchestra/bearings`, `mechanical-orchestra/bar` |
| the house | the preparation-room door | `mechanical-orchestra/bow` |
| the Deacon | three knocks from inside the coffin | `organic-percussion/log`, muffled, three steps lower |

**Seven equal steps.** Lucius had nothing to tune the likembé against, so he tuned it to nothing: seven equal steps
to the octave, 171.4 cents each. Everything pitched on the record (the coffin's tongues, the urn, the spring, the brake
drum) matches it. The rack takes fractional MIDI pitches, so no engine change was needed. In seven equal steps every
triad has the same shape: root, a **neutral third** (343 cents, between minor and major), and a fifth 16 cents flat.
No chord is major or minor, and a chord change is only a change of root: a funeral that is neither grief nor party. The
tonic is A. Measured on the exposed likembé bar, the notes land within 5.6 to 6.3 cents of their targets, which is the
-6 cent detune written into the part.

**The hook** is an interaction, not a tune. The Deacon's bass line is split three ways: the urn's thud on the one, the
coffin's low tongue, the spring's twang on the fifth, the urn's whoop, the coffin's high tongue and rail. Every second
bar the band drops out for **three knocks on the coffin lid** (on 3, the and-of-3 and 4).

117.03 BPM (96 × 2^(2/7), chosen backwards from the production), swing 0.54, 38 bars of 4/4, 1,478 notes.

| Time | Bars | Section | What happens |
|---|---|---|---|
| 0:00 | 1-3 | lid | The door creaks. Three knocks on the lid. Mrs. Vane tries the spring twice, Ezra the urn once (each sound alone, which is where the producer later lifts them). Coins. The likembé picks up |
| 0:06 | 4-5 | thumb | The likembé alone, then the three knocks: the hook's skeleton |
| 0:10 | 6-13 | wake | The hook. Urn, coffin and spring split the line; bead snare, coins. From bar 10, Odile's drum answers "wee-oo" in the holes and the brake drum plays the bell. Roots 0 0 5 3 \| 0 0 5 6 |
| 0:27 | 14-15 | break | Drums alone: urn, beads, coins, the coffin rail, a stick scraped along the panels, the knocks |
| 0:31 | 16-19 | odile | The floor: her drum talks, squeaks, laughs and moans over the likembé (up three steps), the spring and one urn thud per bar |
| 0:39 | 20-26 | stairs | The pallbearers carry him up seven steps. Half time; the whole band one step higher every bar, home an octave up on the seventh. In twelve-tone tuning that takes twelve bars |
| 0:53 | 27-28 | knock | Two stabs. Silence (it decays to -54 dB). Then three knocks **from inside** the coffin. The door |
| 0:57 | 29-36 | shout | The hook hot: cavernous drums, the spring chirping, the likembé fully buzzing, Odile screaming. On every knock bar the third knock comes from inside |
| 1:14 | 37-38 | out | The last hit. The spring rings out as a laser, the coins spill, one more knock from inside, the door |

**Source files:** [`source/compose.ts`](source/compose.ts) writes the score
[`source/the-deacon-is-dead.score.json`](source/the-deacon-is-dead.score.json) (10 parts). The rack renders it
([`source/rack-render.json`](source/rack-render.json)), and the context mix is the print.

---

## The production: THE DEACON KNOCKS BACK

**96 BPM · seven equal steps on F+57 cents · 0:58.5.** Every sound is read from the printed record by the unchanged
DaemonV12 sampler. Nothing is synthesised and nothing is derived offline.

**The turntable move.** The record plays at **0.820336** of its speed: two steps of its own seven-step scale. 117.03
BPM becomes 96, each record beat becomes one grid beat, and every pitch stays inside the seven-step lattice.
Re-pitched chops also move by whole steps: rate = 0.820336 × 2^(k/7).

**The record mourned him; here he answers.** The hook is a conversation. Every second bar the groove stops for Iggy's
three knocks, crisp, an octave above the record. The next downbeat is **the Deacon's reply**: his knock from inside,
slowed to 0.552 of its speed so it lands on the tonic an octave under the bass, a one-beat thud, and saturated so a
phone hears some of it. On those downbeats the reply *is* the kick.

| Time | Bars | Section | What happens |
|---|---|---|---|
| 0:00 | 1-2 | VIEWING | The door groans at half speed. Knock, knock, knock. The reply. One spring boing, then the likembé picks up |
| 0:05 | 3-8 | WAKE | Rebuilt from one-shots: the urn is the kick, the bead slap the snare (laid back 8-12 ms), one coin shake the hats, the spring a new bass line with sampler glides (a seventh that slides home, a fifth that sags). Under it, only the likembé, lifted where it plays alone. Three knock-and-reply pairs; Odile's squeaks and the urn's whoop arrive in the second |
| 0:20 | 9-10 | ODILE | The floor: six beats of the record as found, her drum talking three steps higher. Then she cannot stop laughing: "he-he, he-he, he-he-he-he" over the coins alone |
| 0:25 | 11-14 | SEVEN STEPS | The pallbearers' seven bars cut to seven half-bars: the harmony climbs a step every two beats over a four-on-the-floor march and a snare that rolls into two stabs |
| 0:35 | 15 | KNOCK | Silence. The door lifting at half speed. Knock .. knock .. and the third knock from inside is the downbeat of |
| 0:37.5 | 16-21 | KNOCKS BACK | The record's hot shout. The knocks turn into a tune: the first time as found (two from Iggy, the third from inside), then as a neutral triad, then the coffin's whole seven-step scale in sixteenths, each answered from below |
| 0:52.5 | 22-23 | CLOSED CASKET | The reply under the record's last hit; the spring's laser and the coin spill. One more knock from inside. The door closes |

### Where every sound comes from

36 of the 45 chops in the notebook, 390 sampler events on 12 tracks. The record times are the record's own beats. The
full notebook, with onsets and cleanliness, is [`production/chops.json`](production/chops.json).

| Track | Chop (record beat) | How it is played |
|---|---|---|
| knock | Iggy's three knocks on the lid, alone (2.5, 3, 3.5) | an octave up (rate 1.64); in the shout re-pitched by steps into a triad and a seven-note scale |
| reply | the Deacon's third knock from inside (110), the first two (108.5, 109.25), the last one (149) | rate 0.552 (the tonic an octave down), one beat, saturated; the first two as recorded before the drop |
| kick | the urn's palm thud in the break (52), 13 dB clean | rate 0.82, saturated, compressed |
| snare | the bead slap (53) and a bead tap (55.75) from the break | laid back 8-12 ms |
| hat | one shake of the collection plate (52.25) | every sixteenth, accents on the off-eighths, highpassed at 1.4 kHz |
| bass | the spring tried alone on A1 (4), 17.5 dB clean | a new line in seven steps, glides between rates, choked |
| whoop | the urn's whoop tried alone (7) | twice, in the holes |
| lik | the likembé alone (12-16), the bar that stops for the knocks (16-18.5), the pickup (10.25) | the wake's whole bed |
| odile | two squeaks (60.75), a moan (61.5), the laugh (66) | the laugh stuttered: half, half, whole |
| loop | odile bars 1-2 (60), the first two beats of each stair bar (76 … 100), shout bars 1-2 (112), the out bar (144) | as found, choked on bar and half-bar lines |
| stabs | the two tutti stabs (104, 104.75) | |
| door | the door opening (0), lifting (110.75), closing (150) | the first two at half speed |

### The self-sampling chain

1. **Compose and perform** a rack score ([`source/compose.ts`](source/compose.ts)) on the Signature Rack and Timbre
   Lab instruments, in seven equal steps.
2. **Print**: render once with the rack, normalised to -16 LUFS or the -1 dBTP ceiling, whichever comes first (here
   the ceiling, at -22.1 LUFS). The context mix becomes a sampler asset.
3. **Dig** ([`tools/dig.py`](tools/dig.py)): only the print and the record's tempo and swing are read. For each chop
   the script finds the real onset near the record's beat, starts the chop on a zero crossing just before it, and
   records where the beat sits inside it, so the record's time lands on the new grid. Single hits are scored for
   cleanliness.
4. **Rebuild** ([`production/build.ts`](production/build.ts)): a native project
   ([`the-deacon-knocks-back.json`](the-deacon-knocks-back.json)) using only the engine's documented sampler features
   (`offsetSeconds`/`endSeconds` slices, `playbackRate`, `glide`, `gate`, `envelope`, `chokeGroup`), per-track
   effects, and `--reuse-voices`. No engine, rack or lab code was changed.

### The two passes

**Creative pass** ([`production/the-deacon-knocks-back--creative-pass.mp3`](production/the-deacon-knocks-back--creative-pass.mp3)).
The record and the production above, balanced until every part measured audible. These problems were found by
measurement and fixed inside this pass:

- On the record, the friction drum sat 5 dB above everything and the inside knock clipped. Gains were rebalanced from
  a per-section table ([`tools/balance.py`](tools/balance.py)).
- The likembé's stab chord rang through the silence before the knocks from inside, because tines cannot be damped. It
  was taken out of the stabs, and the silence now decays to -54 dB.
- The spring and the urn's whoop were never heard alone, so no clean bass chop existed. The record's intro gained a bar
  where each is tried once. The dig scores them 17.5 and 12 dB clean.
- The bead snare's 24 dB crest made almost every master peak, and the engine compressor detects RMS. With a 0.1 ms
  attack it catches the spikes anyway, and `tanh` saturation at full mix is the soft ceiling.
  The first renders reached only -18.7 to -17.8 LUFS, and raising the quiet parts made the master clip (+0.6 dBTP).
  With the fast compressor and the ceiling it measured -14.8 LUFS at -2.6 dBTP. The settings were found by replaying
  the engine's master chain offline on the stems.
- Kick, spring and reply all stacked at 45-57 Hz on each reply downbeat. The reply now owns those downbeats.
- The engine needs a twelve-tone key label, and this music has none. The key is omitted (it is optional).

**Refinement pass**, three bounded changes:

| | Change | Why | Measured result |
|---|---|---|---|
| R1 | Iggy's knocks up seven steps (one octave); the Deacon's own knocks move to the reply track | after slowing, the hook's knocks sat at 90 Hz, 83 % of their energy below 120 Hz: on a phone, mostly click | knock energy below 120 Hz 83 % → 0 %; 300 Hz-2 kHz 4.1 % → 8.7 %; above 2 kHz 0.1 % → 1.9 %. The call (wood, ~180 Hz) and the reply (45 Hz) are now two octaves apart |
| R2 | The reply's gate 1.6 → 1.0 beats | it droned under the first half of every answered bar | a 0.63 s thud instead of 1 s. With R1: energy below 120 Hz in the wake 52-58 % → 24-36 % |
| R3 | Master compressor makeup 5.5 → 6.5 dB | R1 took the knocks' sub energy out, leaving true-peak headroom | -15.26 → -14.31 LUFS; true peak -2.58 → -1.92 dBTP |

Together they also fixed the drop. In the creative pass the shout's first pass was no louder than the wake (-14.2
against -14.3 LUFS short-term); now it is 1.1 LU louder (-13.2 against -14.3).

### Measurements

| | The record (print) | The production (final) |
|---|---|---|
| Length | 80.93 s | 58.50 s (the door's groan ends at 57.1 s) |
| Loudness | -22.1 LUFS, LRA 7.2 LU (FFmpeg); MP3 -22.5 | -14.31 LUFS, LRA 5.4 LU (engine `analyze`); MP3 -14.5 |
| True peak | -1.0 dBTP | -1.92 dBTP; MP3 sample peak -2.0 dBFS |
| Clipping | none on the mix or any stem | none on the master or any of the 12 tracks |
| Short-term loudness arc (3 s window, end of each section) | | viewing -17.0 · wake -14.6, -14.3, -14.3 · odile -18.0 · seven steps -14.1 · knock -17.5 · knocks back -13.2, -13.4, -12.9 · closed casket -21.2. The drop: -17.2 → -13.6 |
| Low end | | energy below 120 Hz: wake 24-36 %, knocks back 40-49 %, the knock bar 95 % (the knocks from inside, alone) |
| Timing (onsets vs grid) | likembé within -6 cents of seven equal steps | knocks within 2 ms (re-pitched ones included); replies 1-4 ms early; record loops -8 to +2 ms; snare 8-12 ms late and bass 4-6 ms early, as written |
| Sampler work | | 146 M of the 1,000 M interpolation-tap budget; 52 unique voices, 338 reused |
| Determinism | a second rack render reproduced the print and its MP3 byte for byte | a second engine render reproduced the WAV and MP3 byte for byte |

Hashes of the delivered audio are in [`SHA256SUMS`](SHA256SUMS). The engine's full provenance (inputs, every trigger,
per-track peaks) is in [`production/the-deacon-knocks-back.render.json`](production/the-deacon-knocks-back.render.json).

### Reproduce

Run these from the repository root. Node 22.18+, FFmpeg and Python 3 with NumPy are needed.

```bash
node the-deacon-is-dead/source/compose.ts
```

```bash
node --import ./timbre-lab/register.ts studio-001/rack/cli.ts render the-deacon-is-dead/source/the-deacon-is-dead.score.json the-deacon-is-dead/work/source --normalize -16
```

```bash
cp the-deacon-is-dead/work/source/mix-context.wav the-deacon-is-dead/assets/record/the-velvet-hearse--the-deacon-is-dead.wav
```

```bash
python3 the-deacon-is-dead/tools/dig.py
```

```bash
node the-deacon-is-dead/production/build.ts final
```

The print takes about 60 s and the production about 70 s on one core. `work/` is ignored by git. The measuring
scripts are [`tools/balance.py`](tools/balance.py) (the record per section), [`tools/beatbalance.py`](tools/beatbalance.py)
(the production per section) and [`tools/arc.py`](tools/arc.py) (the short-term loudness arc).

### Things to check by ear

- **Seven equal steps is the bet.** The neutral thirds are the point, but they may simply sound out of tune. The
  sharpest places are where the coffin's two fixed tongues (steps 0 and 4) meet the wake's roots 5 and 3.
- **The reply on a phone.** At 45 Hz it is mostly felt. Its saturation and click are what a phone speaker gets, so
  there the conversation may read as "knock knock knock, thump".
- **The likembé rings.** Its tines ring through the bar (the fifth almost continuously), so the bed may read as a
  buzzing wash rather than a riff. At full buzz in the shout it may be harsh.
- **Odile's friction drum.** It is a drum (the skin model's rub: short squeaks with bends, never a held line), but it
  stands in for the singer. If it reads as a voice, it breaks the brief.
- **Seven steps.** Seven different record bars cut at two beats each, with 2 ms ramps and a choke. The joins are the
  least tested part.
- The knocks in the production are an octave above the record's, a smaller object on purpose (R1).

### Notes

- **What it is made of.** Numeric synthesis by the repository's own instruments only: no recordings, SoundFonts or
  third-party audio. The band, label, record and funeral are fiction. Licensing of the generated audio is the owner's
  decision and is not declared here.
- **What was read, and what was not used.** `counterfeit-gold-opus/README.md`, the V2 production and QA notes, the
  composer skill and its owner taste notes were read for production practice only. No musical material, chop or
  arrangement move from FERRYMAN was reused. The owner's loved patches (`giant-undertone`, `alien-gong`,
  `dead-marimba`, `laser-spring`) and grooves were set aside on purpose: they are part of the fatigue. The spring
  reaches its laser only on the shout's knock bars and in the last bar.
- FERRYMAN V1 and V2 and all their recordings are unchanged. Nothing outside `the-deacon-is-dead/` was changed.
