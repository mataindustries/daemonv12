# THING//MANIA OST · Phase 1b: the A+C experiment

*An irresistibly funky arcade band is interrupted by mischievous singing appliances.*

The listener ranked the Phase 1 auditions A (SOCK SLIDE) > C (LOW BATTERY CHOIR) > B (FRIDGE
LIGHT). This experiment asks whether A's funk plus C's singing appliances makes a stronger theme
than A alone. It contains **two controlled 8-bar variants** built on the same SOCK SLIDE core, so
the comparison isolates one decision: how much the appliances get to do. **No full soundtrack has
been built.**

> **Listening disclosure.** The agent that made these could not hear audio. Every judgment below
> comes from the score, stem pitch tracking and objective measurements of the renders. None of it
> comes from listening. Your ears decide.

## Listen

| | Version | Loop ×4 + closing downbeat (start here) | One loop | Seamless game loop |
|---|---|---|---|---|
| **AC-01** | **GROOVE FIRST**: 80% A / 20% C | [ac-01-groove-first-x4.mp3](previews/ac-01-groove-first-x4.mp3) (74.7 s) | [ac-01-groove-first.mp3](previews/ac-01-groove-first.mp3) | [WAV](loops/ac-01-groove-first-loop-seamless.wav) |
| **AC-02** | **THE APPLIANCES TAKE OVER**: 65% A / 35% C | [ac-02-appliances-take-over-x4.mp3](previews/ac-02-appliances-take-over-x4.mp3) (74.7 s) | [ac-02-appliances-take-over.mp3](previews/ac-02-appliances-take-over.mp3) | [WAV](loops/ac-02-appliances-take-over-loop-seamless.wav) |
| A | SOCK SLIDE (reference, unchanged) | [sock-slide-x4.mp3](../a-sock-slide/previews/sock-slide-x4.mp3) (38.5 s) | [sock-slide.mp3](../a-sock-slide/previews/sock-slide.mp3) | in `renders/` (reproducible) |

Each hybrid loop is 8 bars, exactly 798,210 frames (18.100 s). The x4 MP3s are the loop four times
plus one closing downbeat, so you hear how it wears. The MP3s carry encoder padding (+48 ms) and are
listening copies. **For the game, use the seamless WAV.**

## The hinge: A's bass bend is C's mischief note

SOCK SLIDE's riff bends **B♭1 up to B1** on beat 4. In E, B♭ (A♯) is the **raised 4th**, the
same scale degree as LOW BATTERY CHOIR's "DEE" (F♯ over C). So C's chant shape, moved into E minor,
becomes **ba (E) da (G) DEE (A♯)**, and its DEE lands on A's bend three octaves up. The appliances
sing A's own gesture back at it. Measured on the stems, the voice and the bass rise together
(voice +15 → +101 cents, bass +42 → +102 cents in the first 60 ms).

## Shared core (identical in both)

- 106.0773 BPM (96000/905, so 8 bars are exactly 798,210 frames), 16ths swung to 272/240 ticks (≈57%), E Dorian, 4/4.
- A's squelch riff and walk, whistle hook, clav, kick, snare and hats: the same sounds, events and processing.
  **Bars 1–2 of the bass, kick and snare stems are bit-identical to SOCK SLIDE's** (checked in `analysis/comparison.json`).
- Bars 1–2 establish A; the appliances never enter before bar 3 (AC-01 starts each loop with the ding that pays off the previous loop's sag).

## AC-01 · GROOVE FIRST (80 / 20)

*Cool, catchy, slightly absurd. The band leads; one appliance keeps butting in.*

| Bars | What happens |
|---|---|
| 1–2 | A untouched: riff, then the whistle hook (call). A kitchen-timer **ding** (E7) on the downbeat restores power after the previous loop's sag. |
| 3–4 | **The toaster answers**: *ba-da-DEE* on beats 3, 3-and, 4, the DEE riding the bass bend. The clav steps aside for it. In bar 4 the whistle repeats its call, but its long note now **bends up a semitone, copying the appliance**. |
| 5–6 | A **kettle** (a second, smaller formant voice) doubles the tag a fourth below, planing like C. **Rhythmic surprise:** in bar 6 the whistle starts its hook, then the whole band **stops dead on beat 3**; the toaster sings the tag at **double speed** into the hole (*ba-da-DEE-YAH*) and the band slams back in on the bend. |
| 7–8 | Groove, then A's **F13 slip** (♭II). The whistle hands the slip to a close-harmony **choir** (G4 C5 D5) that holds one beat, then **sags exactly one semitone** onto F♯4 B4 C♯5 (E6/9) as its battery dies. The sag *is* A's slide home (♭II → I); the bass slides with it, and the ding lands on the downbeat. |

The sag is a held note followed by a continuation of the same sample at `offsetSeconds` = one beat,
gliding −1 semitone, cross-faded by a choke group. The continuation starts exactly where the held
voice is in the source (onset +24,944 frames, offset 24,944 frames), so the join is coherent.

## AC-02 · THE APPLIANCES TAKE OVER (65 / 35)

*More bizarre, unmistakably THING//MANIA. The appliances grab the hook, then the power fails.*

| Bars | What happens |
|---|---|
| 1–2 | A untouched, exactly as AC-01. |
| 3–4 | **The appliances grab the hook**: toaster and kettle in fourths sing *ba-da-DEE-da*, landing on a held **YAAAH** (G4) over a close-harmony E-minor choir. **The whistle is pushed two beats late**, answering in the second half of bar 4. C's box kick, pot lid and rice shaker join under A's kit from bar 3. |
| 5–6 | **Rhythmic surprise: C's 7/8 inside A's 4/4.** The toaster chants C's 2+2+3 grouping (*ba da · DEE da · YAAAH*) twice back to back over the unchanged 4/4 groove: first in E minor, then **C's own Lydian shape on A** (A C♯ D♯ E C♯, the Dorian IV) with an A-major choir. Fourteen eighths of chant against sixteen of groove, so the second chant lands off the beat; the band answers with a snare fill in the one free beat. |
| 7 | **Breakdown**: the kitchen kit replaces the drum kit and "da" choir stabs replace the clav, while A's riff keeps going; toaster and kettle sing the bent tag. |
| 8 | A's F slip becomes a **power failure**: bass, choir and lead sag **three semitones together** (C's original sag) from F to D over 1.5 beats. The timer **dings** in the gap, the snare cracks twice and the bass picks up E: D → E (♭VII → I) into the loop. |

## Critical comparison

Against the original A, on evidence only:

- **Is the bass groove still as satisfying?** The riff is untouched in both (bit-identical in bars 1–2,
  and 7 of each hybrid's 8 bass bars are A's own bars) and just as loud (-15.4 vs -15.2 / -15.3 LUFS while
  playing). On a phone it carries better: the grit layer is 2 dB hotter (-20.2 → -18.4 LUFS
  phone proxy) and a parallel crunch bus gives the kick a phone presence (crunch -21.7 LUFS on the phone proxy)
  that A's kick alone does not have (-35.2). The extra parts cost the bass a little clarity: its
  unmasked share falls from 93.0% to 91.8% (AC-01) and 87.5% (AC-02).
- **Can the listener remember the vocal hook?** AC-01's three-syllable tag is heard three times per loop
  (alone, harmonized, at double speed), always on the bend, so it is anchored to the riff rather than
  floating on top of it. That is the most memorable-on-paper hook in the experiment. AC-02's hook is
  bolder and longer, with the held YAAAH as a sing-back moment, but the 2+2+3 chant deliberately
  scrambles where it lands, which helps surprise more than recall.
- **Does the battery sag pay off musically?** In AC-01, yes on paper: the sag performs the ♭II → I
  resolution and lands on the downbeat (measured: the chord's energy moves from G4/C5/D5 to F♯4/B4/C♯5
  by the downbeat). In AC-02 it is a bigger, funnier event (−2.8 semitones measured on the bass by the
  ding) whose payoff is the reboot: D → E plus the ding and two snare cracks.
- **Still enjoyable after four repetitions?** Each loop is twice as long as A's (18.1 s against 9.05 s),
  so the x4 preview repeats every idea four times in 72 s where A repeats its one gag eight times.
  Variety measured on the master: 6/8 (AC-01) and 7/8 (AC-02) bars differ from every earlier bar,
  against 3/4 in A. AC-02 stacks three gags per loop (chant, breakdown, power failure), and gags wear
  faster than grooves. AC-01 has one gag and a lot of groove.
- **Uniquely THING//MANIA?** AC-02, clearly: a kitchen kit, an appliance choir that takes the hook, and
  a power failure. AC-01 reads as a cool funk theme that a talking toaster keeps interrupting.

**Recommendation (analytical, not a listening verdict):** **AC-01 is the stronger main-theme
candidate.** It keeps everything that made SOCK SLIDE the favorite, adds a hook that is literally the
riff's bend sung back, gives the battery sag a real harmonic job, and doubles the loop length without
diluting the groove. **AC-02 is the stronger identity statement** and the better source of material
for later: its 7-against-4 chant and its power failure could be variations, a boss state or a
"low battery" game state in a full score. If either hybrid beats SOCK SLIDE alone, the evidence
points to AC-01. The biggest open question is the same as in Phase 1: whether the formant voice,
now sung an octave lower than C's, reads as charming or cheap. Here it is used briefly in AC-01 and
heavily in AC-02.

## Production

- **Separation.** Whistle and appliance voices sound together for only 0.07 s (AC-01) and 0.12 s (AC-02) per loop;
  the whistle keeps 99.3% / 99.2% of its energy unmasked (99.3% in A). The first renders overlapped for
  0.8 s because the whistle's dotted-eighth echo landed exactly on each appliance entry. The phrases that hand over to an appliance
  now play on a `whistle-dry` track (same sound, no echo). Registers are stacked: bass E1–E♭2, choir and appliances E4–E5 (toaster
  spectral centroid ≈ 765 Hz), whistle B5–E6 (≈ 1135 Hz). The clav rests when an appliance sings.
- **Phone speakers.** Bass grit 2 dB up, a parallel drum-crunch bus (high-passed, driven, compressed). Phone proxy change:
  -3.0 / -2.8 LU (A -3.5 LU).
- **Width, mono-safe.** Clav left, toaster left, whistle right, kettle right, hats right, rice shaker left, choir sung twice
  per part at ±7 cents with the copies leaning 0.85/0.15. Above 300 Hz the side energy is 3.0% / 3.9% of
  the mix (A 1.5%), and the mono fold changes loudness by only -0.1 / -0.1 LU. This is wider than A but still
  a moderate image; bass and kick stay centered.
- **Headroom and dynamics.** No full-scale samples, true peak -1.39 / -1.78 dBTP. The master uses A's gentle 2:1 bus
  compressor; its measured gain reduction has a median of 3.05 / 2.84 dB and swings by σ 1.45 / 1.36 dB, the same as A
  (3.09 dB, σ 1.39 dB). The hybrids pump no more than the original. There is no limiter.

## Technical checks

Generated by [`tools/render-ac.mjs`](tools/render-ac.mjs). Full data: `analysis/<slug>.checks.json`,
`analysis/comparison.json`, `analysis/reference-sock-slide.checks.json`.

| Check | A · SOCK SLIDE | AC-01 | AC-02 |
|---|---|---|---|
| Length | 4 bars, 399,105 frames | 8 bars, 798,210 frames (expected 798,210) | 8 bars, 798,210 frames (expected 798,210) |
| Project validation (loop, x4) | — | ok, ok, no warnings | ok, ok, no warnings |
| Integrated loudness | -16.4 LUFS | -16.4 LUFS | -16.3 LUFS |
| True peak · full-scale samples · render warnings | -1.35 dBTP · 0 · none | -1.39 dBTP · 0 · none | -1.78 dBTP · 0 · none |
| L/R correlation (whole · above 300 Hz) | 0.992 · 0.972 | 0.98 · 0.942 | 0.971 · 0.923 |
| Mono fold-down loudness change | -0.1 LU | -0.1 LU | -0.1 LU |
| Phone proxy (300 Hz HPF + mono) change | -3.5 LU | -3.0 LU | -2.8 LU |
| Loudness while playing, full / phone (bass · grit · whistle · toaster) | -15.4/-25 · -18.8/-20.2 · -15.9/-16.1 · — | -15.2/-24.8 · -17/-18.4 · -16/-16.4 · -18.7/-20.1 | -15.3/-24.9 · -17.1/-18.5 · -15.6/-15.9 · -15.3/-15.9 |
| Whistle unmasked · appliances unmasked · bass unmasked | 99.3% · — · 93.0% | 99.3% · 83.8% · 91.8% | 99.2% · 92.7% · 87.5% |
| Whistle and appliances sounding together | — | 0.07 s | 0.12 s |
| Master compressor gain reduction (median · σ) | 3.09 · 1.39 dB | 3.05 · 1.45 dB | 2.84 · 1.36 dB |
| Bars unlike any earlier bar | 3 / 4 | 6 / 8 | 7 / 8 |
| Loop cycle 2 vs cycle 3 (x4 render) | bit-identical | bit-identical | bit-identical |
| Seamless wrap step vs. same boundary played continuously | 0.094 vs 0.205 | 0.144 vs 0.157 | 0.127 vs 0.164 |
| Second render byte-identical (master, stems) | yes, yes (Phase 1 checks) | yes, yes | yes, yes |
| Seamless loop WAV SHA-256 (prefix) | — | `af15f398004ef0a3` | `a172af0a582db33e` |

How to read them:

- **Seamless loops** use the established method: the WAV is cycle 2 of the x4 render, cut on exact
  frames, so it starts with cycle 1's reverb, delay and release tails. Cycles 2 and 3 are
  bit-identical, so looping the crop is exactly continuous playback, and its wrap step is no larger
  than the step at the same downbeat in continuous playback.
- **"Loudness while playing"** is the 90th percentile of momentary loudness (EBU R128, 400 ms), so
  parts that play only part of the time are not undercounted the way integrated loudness undercounts them.
- **Unmasked share**: per 2048-sample frame and third-octave band, the share of a part's energy in
  bands where it is louder than everything else combined.
- **Compressor gain reduction**: the master compared with the sum of its pre-master stems at the
  master gain, 300 Hz–5 kHz, 50 ms windows, makeup gain removed.

### Gesture checks (stem pitch tracking)

Recorded in `probes` in each checks file:

- AC-01 bar 3: toaster A♯4 → B4 (+15 → +101 cents) with the bass B♭1 → B1 (+42 → +102 cents).
  Bar 4: the whistle bends A♯5 → B5. Bar 5: kettle F4 → F♯4 (+21 → +103 cents). Bar 6: the
  double-speed tag measures E4, G4, A♯4, B4 (−7/+298/+601/+693 cents re E4; targets 0/300/600/700).
- AC-01 bar 8: choir tone levels move from G4/C5/D5 (hold) to F♯4/B4/C♯5 (downbeat).
- AC-02 bars 5–6: all ten chant pitches within ±6 cents of E4 G4 A♯4 B4 G4 | A4 C♯5 D♯5 E5 C♯5.
- AC-02 bar 8: bass F1 −24 → −284 cents and lead D5 −33 → −263 cents by the ding; choir energy
  moves from G4/C5/D5 to E4/A4/B4.

## Provenance and rights

- **Every sound is synthesized** by the repository's own deterministic recipes in
  [`../tools/instruments.mjs`](../tools/instruments.mjs), unmodified. No recordings, samples, loops,
  SoundFonts or General MIDI (excluded for commercial work by the repository's rights audit).
- **Reused A and C sounds are regenerated, not copied, and proven identical:** all 23 (A's 8 bass notes, 5 whistle
  notes, 3 clav chords, 4 drums; C's box, lid and shaker) are byte-identical to the originals
  (`assets/palette.json`, `reusedFrom.byteIdentical`).
- **New sounds use C's recipes, re-pitched into E Dorian:** 12 toaster syllables (E4–E5, an octave
  below C's lead), 4 kettle syllables (same recipe, formant scale 1.32), 4 choir chords, the ding at
  E7 (C's was C7), and a 1.3 s F1 for AC-02's sag. The choir uses C's `choirChord` layout with the
  copies leaning 0.85/0.15 instead of 0.7/0.3 (`choirWide`). The stabs (`choirStab`) add C's
  consonant burst to the same layout. Both call C's `voice()` unmodified.
- **Tuning** (`analysis/palette-inspection.json`): bass, whistle and every sung syllable are within
  ±3 cents. Chords have no single-pitch figure. The ding's autocorrelation reading (+89 cents) comes
  from its inharmonic partials; its strongest partial is at E7 (2637 Hz) by construction and by measurement.
- **Originals untouched:** `git status` shows no change under `a-sock-slide/`, `b-fridge-light/`,
  `c-low-battery-choir/`, `tools/` or the Phase 1 README. A and C were re-rendered from their
  projects, and both masters match their recorded hashes (`712e40a3…`, `0bc411a7…`).
- All melodies and rhythms are developments of A and C, written for this brief. None quotes an
  existing game soundtrack. No license is declared; that remains the owner's decision.

## Reproduce

Environment: DaemonV12 0.7.0, Node v22.22.0, FFmpeg 6.1.1-3ubuntu5. From the repository root:

```sh
npm ci
node experiments/thingmania-ost/hybrid-ac/tools/make-sounds-ac.mjs   # assets/ (byte-identical on rerun; checks reuse against A and C)
node experiments/thingmania-ost/hybrid-ac/tools/compose-ac.mjs       # the four project JSON files
node experiments/thingmania-ost/hybrid-ac/tools/render-ac.mjs        # validate, render, check, previews, seamless loops (~5 min)
```

Or render one project with the CLI:

```sh
node bin/daemonv12.js render experiments/thingmania-ost/hybrid-ac/ac-01-groove-first.json --out-dir experiments/thingmania-ost/hybrid-ac/renders/manual --stems --format wav,mp3
```

## Files

```
hybrid-ac/
  README.md
  ac-01-groove-first.json             editable 8-bar DaemonV12 project (render.duration = 8 bars, tail none)
  ac-01-groove-first-x4.json          listening copy: loop at bars 1, 9, 17, 25 + closing downbeat at bar 33
  ac-02-appliances-take-over.json
  ac-02-appliances-take-over-x4.json
  previews/                           <slug>.mp3 and <slug>-x4.mp3
  loops/                              <slug>-loop-seamless.wav (sample-exact game loops)
  assets/                             source WAVs, kit.json per instrument, palette.json (hashes, reuse proof)
  analysis/                           <slug>.checks.json, comparison.json, render manifests, palette-inspection.json
  tools/
    make-sounds-ac.mjs                builds assets/ from ../tools/instruments.mjs
    compose-ac.mjs                    the score, in code
    render-ac.mjs                     DaemonV12 render + checks + previews + seamless loops + A/C reference renders
    analysis-ac.mjs                   masking, overlap, compressor activity, bar variety, pitch probes
  renders/                            (ignored) masters, stems, MIDI, repeat renders, reference renders
```

## Process notes and deviations

- **Kept from the brief:** A's 4/4 and 106.0773 BPM; C's 7/8 appears only as a 2+2+3 vocal grouping
  over the 4/4 groove (AC-02 bars 5–6). Nothing of C's composition is transplanted wholesale.
- **Evidence-driven revisions:** appliance levels rebalanced twice. The whistle-dry track removes
  0.7–0.8 s of whistle/appliance overlap. Pans widened and the choir's stereo lean opened for width.
  The whistle was raised 1 dB to keep A's level after panning it under the balance pan law.
- **Engine limits respected, not changed:** DaemonV12 allows 15 tracks, so in AC-02 C's box kick
  and pot lid share one `kitchen` track (the lid's 2 dB offset is folded into its velocities;
  velocity is linear gain). Project keys can only be major or minor, so the JSON says "E minor" as
  A's does; the music is E Dorian.
- **Width** is improved but moderate. Panned mono sources keep a high correlation by construction.
  More width would need more stereo source material, and that was not worth the mono risk at the audition stage.
- The engine, THING//MANIA, PermitPulse and the A/B/C auditions were not modified. Everything new
  lives in this directory.
