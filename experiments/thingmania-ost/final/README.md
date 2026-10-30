# THING//MANIA · Official Soundtrack

*An irresistibly funky arcade band, a whistler who can't stop, and a kitchen full of appliances that
keep butting in, until the battery sags.*

This is the production soundtrack built from **AC-01 GROOVE FIRST**, the audition the listener chose
([`../hybrid-ac/`](../hybrid-ac/)). It is not a new composition. AC-01's sounds, swing, mix, master
and gestures are carried over unchanged and grown into a full 16-bar theme, a menu arrangement, a demo
cut and aligned stems. Everything is rendered with DaemonV12 from editable project JSON.

> **Listening disclosure.** The agent that made this could not hear audio. Every judgment below
> comes from the score, stem pitch tracking and objective measurements of the renders. None of it
> comes from listening. Your ears decide.

## Listen

| | Deliverable | Preview (start here) | One cycle / full piece | Browser copies | WAV master | Stems |
|---|---|---|---|---|---|---|
| **1** | **Main game theme** · 16 bars, 36.2 s loop | [main-theme-x2-listen.mp3](previews/main-theme-x2-listen.mp3) (the loop twice + ending, 74.7 s) | [main-theme-loop.mp3](previews/main-theme-loop.mp3) | [ogg](web/main-theme-loop.ogg) · [m4a](web/main-theme-loop.m4a) | [main-theme-loop.wav](masters/main-theme-loop.wav) | [stems/main-theme/](stems/main-theme/) |
| **2** | **Menu mix** · 16 bars, 36.2 s loop | [menu-mix-x2-listen.mp3](previews/menu-mix-x2-listen.mp3) (74.7 s) | [menu-mix-loop.mp3](previews/menu-mix-loop.mp3) | [ogg](web/menu-mix-loop.ogg) · [m4a](web/menu-mix-loop.m4a) | [menu-mix-loop.wav](masters/menu-mix-loop.wav) | [stems/menu-mix/](stems/menu-mix/) |
| **3** | **Demo mix** · 41.0 s, with an ending | — | [demo-mix.mp3](previews/demo-mix.mp3) | [ogg](web/demo-mix.ogg) · [m4a](web/demo-mix.m4a) | [demo-mix.wav](masters/demo-mix.wav) | [stems/demo-mix/](stems/demo-mix/) |

Listen on a phone speaker and on headphones. The x2 previews are a continuous render (the loop as the
game will play it, twice, then a closing downbeat), so the loop seam is in the middle of the file.

- **For the game:** use the WAV masters, or the Ogg copies on the web.
- **Ogg Vorbis and MP3 decode to exactly the master's length**, sample-aligned (checked with FFmpeg;
  the MP3 through its LAME gapless header).
- **The M4A** carries AAC end padding (1,020 frames on the loops, 284 on the demo), so a loop
  player must stop at frame 1,596,420.
- **Browsers** honour MP3 and AAC gapless metadata inconsistently. Loop the Ogg (or the WAV) and
  treat the MP3 and M4A as listening copies; the M4A is the fallback where Ogg is not supported.
  Details are in [Technical QA](#technical-qa).

## What AC-01 gave the theme, and where it is

| Approved element | Where it lives in the final theme |
|---|---|
| **Squelch-bass personality** | The riff and its walk carry bars 1-8 and 13-16 with the same sound, choke and processing (the samples are byte-identical to AC-01's). In bars 9-12 the same riff shape moves to A, C and D and keeps its bend. |
| **Whistled hook** (E6 D6 B5 C#6, then the long note) | Bars 2, 4, 6 and 13 in full, bar 15 with the toaster taking the long note, and bars 8 and 16 as AC-01's clipped head: seven statements in 16 bars. Bars 13 and 15 add a second whistler a sixth below. |
| **Swung funk groove** | 16ths swung to 272/240 ticks (about 57%), kick locked to the bass on 1 and 3-and, ghost-note backbeat in every bar. The groove only stops where AC-01 stopped it: the stop-time in bar 8 and the slip in bar 16. |
| **Singing toaster call-and-response** | *ba-da-DEE* rides the bass's B♭→B bend in bars 5, 7 (with the kettle a fourth below) and 14. It is sung at double speed into the bar-8 hole, in A in bar 9, and the toaster steals the hook's long note in bar 15. In bar 10 the whistle answers the toaster back. |
| **Battery-sag turnaround** | Bar 16, identical to AC-01's bar 8. The F13 slip (♭II) is handed to the choir, which holds one beat and then sags exactly one semitone onto E as the bass slides F→E. |
| **Kitchen-timer ding** | The downbeat of every loop (E7): power restored after the sag. |

## Deliverable 1 · Main game theme

**106.0773 BPM, 4/4, E Dorian, 16 bars, exactly 36.2 s (1,596,420 frames).** The tempo is 96000/905
BPM, so one quarter note is exactly 565,625 µs and every loop repeat lands on the same frame.

| Bars | Harmony | What happens |
|---|---|---|
| **1-4** · establish | Em9 | **The riff and the hook, nothing else.** Bar 1: the ding restores power on the downbeat, the squelch riff bends B♭→B on beat 4 and the whistle picks up (B-D). Bar 2: the hook over the walk. Bar 3: the riff and the pickup again. Bar 4: the hook, but its long note now **bends up a semitone, catching the bass's bend**. |
| **5-8** · the appliances | Em9 | Bar 5: **the toaster answers** *ba-da-DEE* on beats 3-4, with the DEE riding the bass bend three octaves up. The clav steps aside. Bar 6: the whistle calls again, bent. Bar 7: the **kettle** joins a fourth below. Bar 8: AC-01's **stop-time**: the band stops dead on beat 3, the toaster sings the tag at double speed into the hole, and the band slams back in on the bend. |
| **9-12** · development | A13 → Cmaj9 → D6/9 | **i → IV → ♭VI → ♭VII.** Bar 9: the riff moves to A (the clav changes one note, D→C#, the Dorian 6th), a rice-jar shaker enters opposite the hats, and the toaster sings the tag **in A** (D#→E on the bend). Bar 10: **role reversal**: the whistle copies the toaster's A tag back to it. Bars 11-12: the **whole band hits in 3+3+2** (bass, kick, clav, and the appliance choir on "da") on C, then D. The riff's bend survives in each key (F#→G, G#→A), so the bend climbs **E, G, A**. A snare roll and a **kettle coming to the boil** (a whistle gliding up an octave) charge into bar 13. |
| **13-16** · return | Em9 → F13 → E | Bar 13: **the strongest hook statement**. It arrives on E after the ♭VI-♭VII climb with full band, a **second whistler a sixth below**, the choir under it and a pot lid doubling the backbeat. Bar 14: **everybody bends together** on beat 4: bass B♭→B, toaster A#→B, kettle F→F#, whistle A#→B. Bar 15: the hook's head again, with the second whistler, and **the toaster steals its long note** ("YAAAH"). Bar 16: AC-01's ending verbatim. The hook's head, the **F13 slip**, and the choir holding one beat before it **sags one semitone** as the battery dies. The bass slides F→E into the loop, and the ding on bar 1 restores power. |

The form is not AC-01 twice. Bars 1-8 expand AC-01's first six bars so the appliances arrive only
after the hook is established. Bars 9-12 are new. Bars 13-16 intensify the hook and end with AC-01's turnaround,
which is the loop's pickup.

**Using it in the game:** loop `masters/main-theme-loop.wav` from frame 0 to its end (1,596,420
frames). The file is cycle 2 of a continuous three-times render, so it already starts with the
previous cycle's sag, reverb and echo tails (audible for about half a second). Looping it is
identical to continuous playback. If the very first play should start cold, open with the demo mix's
cold open, or fade in.

## Deliverable 2 · Menu mix

The same theme, lighter, on the **same 16-bar form, bassline and harmonic map** (Em9 · A13 · Cmaj9 ·
D6/9 · Em9 · F13→E). Bar 1 of the menu lines up with bar 1 of the theme, so the game can switch
between them on any bar line, or crossfade them, without a musical seam. Both loops are 1,596,420
frames long.

- **Kept:** the full funky bassline (with its grit layer for phones), the whistle hook (bars 2, 6 and
  13, plus the bar-10 answer and the bar-16 head), the toaster's answers (bars 5, 9 and 14, with the
  kettle in 14), the battery sag into the loop, and the ding.
- **Lighter percussion:** a softer kick (−2 dB track, lower velocities), a quiet backbeat on 2 and 4
  with no ghost notes, and closed hats on the off-beat eighths only. No crunch bus, kitchen percussion,
  snare roll or band hits.
- **Harmony without transients:** the clav stabs are replaced by the appliance choir **humming the
  chords on "oo"**. It is the same wide choir recipe with C's closed vowel, low-passed at 2.5 kHz.
- **Room for button clicks:** the grit layer is low-passed at 2.2 kHz instead of 4 kHz. Once the drums
  are light, the grit is the loudest thing between 2 and 6 kHz, which is where UI clicks live. It keeps
  the 350 Hz-2 kHz harmonics that make the bass audible on phones.

## Deliverable 3 · Demo mix

**Exactly 41.0 s (1,808,100 frames): 18 bars and the ending's decay.** A short, complete piece for a 3-minute
hackathon demo video: a strong start, the groove at 2.3 s and the hook at 4.5 s, an energetic payoff
and a real ending.
It does not try to score the whole video. That waits for final picture timing. Cut it, loop the
theme under talking, or use the menu mix as a bed. Every section starts on a bar line:

| Starts at | Bar | Section |
|---|---|---|
| 0.000 s | 1 | **Cold open:** one full-band hit on E with the ding, then silence while the toaster sings its tag at double speed into the gap; the snare picks up. |
| 2.263 s | 2 | **Theme:** riff, pickup, and the hook from 4.525 s. |
| 11.313 s | 6 | **The appliances** answer, then the stop-time. |
| 20.363 s | 10 | **Development:** IV, then the ♭VI-♭VII band hits and the kettle boiling over. |
| 29.413 s | 14 | **Hook return:** two whistlers, everybody bends, the toaster steals the long note. |
| 36.200 s | 17 | **Battery sag** (F13 slip, choir sags one semitone). |
| 38.463 s | 18 | **Ending:** the sag lands on a final E hit: ding, whistle swoop with its harmony, choir, open hat. |
| 40.725 s | 19 | The decay. The mix is below −70 dBFS from 40.6 s and the file ends at 41.0 s. |

Bars are 2.2625 s long, so every section boundary is a bar-line cut point. For a shorter cut, note
that bar 1 and bar 13 end with the same bass pickup (D→E♭→E). The cold open can therefore jump
straight to the hook return at bar 14 (29.413 s), which gives a 15.8 s version that still ends
properly. Use a short crossfade at the splice so the reverb tails don't cut off.

## Deliverable 4 · Stems

Six stems for each of the three deliverables:

| Stem | Tracks |
|---|---|
| `drums` | kick, snare, drum-crunch (parallel bus), hats, kitchen (shaker, pot lid) |
| `bass-grit` | bass, bass-grit (parallel phone layer) |
| `whistle-lead` | whistle, whistle-dry, whistle-harmony |
| `appliances-choir` | voice (toaster), kettle, choir (stabs, return chord, battery sag) |
| `harmony` | clav (theme, demo); hum pads (menu) |
| `fx` | ding, kettle-boil riser |

- **Same start, same length, same rate.** Each stem starts at frame 0 of its master and has exactly
  the master's frame count (1,596,420 / 1,596,420 / 1,808,100), PCM16 stereo at 44.1 kHz. The loop
  stems are cut from the same cycle as the loop master, so they loop seamlessly too.
- **They sum to the master.** The engine's master is the sum of its track stems, then master gain,
  a 28 Hz high-pass and a gentle 2:1 bus compressor. The stems are printed through that same bus:
  each group gets the same gain and high-pass, and the compressor is keyed by the full mix (FFmpeg
  `sidechaincompress`, the same code as the engine's `acompressor`). Before splitting, the pipeline
  rebuilds the engine master from the track stems bit-for-bit. Then it checks the six stems against
  the master (null test below). So muting a stem gives exactly the mix without it, at the same level
  and dynamics.
- **Format:** FLAC (lossless PCM16) to keep the repository small. Each FLAC is decoded again and
  compared byte for byte with the WAV stem. WAV stems are produced in `renders/` by every run (see
  [Reproduce](#reproduce)).

## Technical QA

Generated by [`tools/render-final.mjs`](tools/render-final.mjs). Full data:
`analysis/<slug>.checks.json` and `analysis/summary.json`. The AC-01 column comes from a fresh
re-render of the approved project, which matches its recorded master bit for bit, measured with the
same code.

| Check | AC-01 (approved) | Main theme | Menu mix | Demo mix |
|---|---|---|---|---|
| Length | 8 bars, 798,210 frames | 1,596,420 frames (36.2 s; expected 1,596,420) | 1,596,420 frames (36.2 s; expected 1,596,420) | 1,808,100 frames (41.000 s; expected 1,808,100) |
| Project validation | ok, no warnings | ok, no warnings | ok, no warnings | ok, no warnings |
| Integrated loudness · loudness range | −16.4 LUFS · 0.6 LU | −16.4 LUFS · 0.9 LU | −17.9 LUFS · 1.5 LU | −16.4 LUFS · 1.1 LU |
| True peak · sample peak | −1.4 dBTP · −1.38 dBFS | −1.3 dBTP · −1.31 dBFS | −2.6 dBTP · −2.61 dBFS | −1.3 dBTP · −1.31 dBFS |
| Full-scale samples · clipped samples (all track, master and stem stages) | 0 · 0 | 0 · 0 | 0 · 0 | 0 · 0 |
| Mono fold-down loudness change | −0.1 LU | 0.0 LU | −0.1 LU | −0.1 LU |
| L/R correlation (whole · above 300 Hz) · side energy above 300 Hz | 0.98 · 0.942 · 3.0% | 0.98 · 0.944 · 2.8% | 0.966 · 0.943 · 2.9% | 0.979 · 0.939 · 3.1% |
| Phone proxy (300 Hz HPF + mono) change | −3.0 LU | −3.0 LU | −3.6 LU | −3.0 LU |
| Whistle unmasked (whole piece) | 99.3% | 99.1% | 99.1% | 99.1% |
| Hook head unmasked, per hook bar | 99.1%–99.4% (4 bars) | 98.8%–99.5% (7 bars) | 99.1%–99.6% (4 bars) | 98.6%–99.6% (7 bars) |
| Appliances unmasked · bass unmasked | 83.8% · 91.8% | 80.0% · 92.1% | 75.2% · 96.3% | 81.0% · 91.8% |
| Master compressor gain reduction (median · σ) | 3.05 · 1.45 dB | 3.03 · 1.43 dB | 2.82 · 1.39 dB | 2.98 · 1.5 dB |
| UI click vs music, 2-6 kHz (p10 · median · p90) | −6.8 · −1.0 · 4.2 dB | −6.6 · −1.2 · 4.3 dB | 2.4 · 3.8 · 16.3 dB | −6.4 · −0.8 · 10.4 dB |
| Music level in 2-6 kHz (median of 20 ms windows) | −36.5 dBFS | −36.4 dBFS | −43.0 dBFS | −36.9 dBFS |
| Bars unlike any earlier bar | 6 / 8 | 9 / 16 | 8 / 16 | 11 / 19 |
| Loop cycle 2 = cycle 3 (master, all six stems) | yes (master) | yes, yes | yes, yes | not a loop |
| Loop wrap step vs. same boundary played continuously | 0.144 vs 0.157 | 0.142 vs 0.154 | 0.063 vs 0.113 | — |
| Stems: start, length, rate | — | 6 × 1,596,420 frames, 44100 Hz, stereo | 6 × 1,596,420 frames, 44100 Hz, stereo | 6 × 1,808,100 frames, 44100 Hz, stereo |
| Stems sum to master (max error · residual) | — | 3 LSB · −76.6 dB | 2 LSB · −75.7 dB | 3 LSB · −76.5 dB |
| Bus rebuild of the engine master from track stems | — | bit-identical | bit-identical | bit-identical |
| Second render identical (master, track stems, six stems) | yes, yes, — | yes, yes, yes | yes, yes, yes | yes, yes, yes |
| Ogg Vorbis q6, decoded by FFmpeg | — | exact length, offset 0, −1.3 dBTP | exact length, offset 0, −2.5 dBTP | exact length, offset 0, −1.2 dBTP |
| MP3 192k, decoded by FFmpeg | — | exact length, offset 0, −1.7 dBTP | exact length, offset 0, −2.8 dBTP | exact length, offset 0, −1.8 dBTP |
| AAC/M4A 192k, decoded by FFmpeg | — | +1,020 frames, offset 0, −1.6 dBTP | +1,020 frames, offset 0, −2.7 dBTP | +284 frames, offset 0, −1.6 dBTP |
| FLAC stems decode byte-identical to WAV stems | — | yes (6/6) | yes (6/6) | yes (6/6) |

How to read them:

- **Loudness.** The theme and the demo sit exactly at AC-01's level (−16.4 LUFS) with at least
  1.3 dB of true-peak headroom. The menu sits 1.5 LU lower, as a background should. There is no
  limiter; the master is AC-01's gentle 2:1 bus compressor, and it works exactly as hard as it did on
  AC-01.
- **Hook head unmasked.** This is measured in every bar where the hook's head (E6 D6 B5 C#6) plays:
  the share of the whistle's energy, over beats 1-2, in third-octave bands where it is louder than
  everything else combined. The theme's new layers (second whistler, choir, shaker, lid) keep it
  within half a point of AC-01.
- **UI click vs music.** A synthetic −20 dBFS, 3 kHz button click is laid on every eighth note. Its
  energy in 2-6 kHz over 20 ms is compared with the music's in the same window. In the menu a click
  stands at least 2.4 dB above the music in 90% of slots, against −6.6 dB in the theme. The music
  itself is 6.6 dB quieter in that band.
- **Loops.** Each loop is cycle 2 of a continuous three-times render, cut on exact frames. Cycle 3 is
  bit-identical, so looping the file is exactly continuous playback. The step across the wrap is no
  larger than the step at the same downbeat played continuously. A naive render of the 16 bars alone
  would start without the previous cycle's tails: its first 500 ms differ by −14.1 dB.
- **Stems.** The maximum error of 2-3 LSB is the rounding of six 16-bit files. Stems that sum to the
  master can be muted or crossfaded in the game, or under voice-over, without changing the rest of
  the mix.
- **Encodes.** "Offset" is the alignment of the decoded copy against the master; 0 means
  sample-aligned. Every decoded copy peaks at or below −1.2 dBTP.
- **Phone proxy** is two 2-pole 300 Hz high-passes and a mono fold. "Unmasked" shares use 2048-sample
  frames and third-octave bands (100 Hz-12.5 kHz) on the mono track stems, as in the AC audition.

### Gesture checks (stem pitch tracking)

Every gesture happens where the score says. Values are cents from the reference note; full data is in
`probes` in each checks file.

- **Hook, bars 2 and 13 (identical):** E6 −4, D6 −186, B5 −494, C#6 −301, B5 −496 cents re E6.
  Targets are 0/−200/−500/−300/−500. D6 is a 16th long, and the reading probably includes the release
  of the E6 before it.
- **Bar 4**, whistle A#5→B5: +51 → +104. **Bar 5**, toaster A#4→B4 +15 → +101 with bass B♭1→B1
  +42 → +102. **Bar 7**, kettle F4→F#4: +21 → +103.
- **Bar 8**, tag at double speed: −7/+298/+601/+693 re E4 (targets 0/300/600/700).
- **Bar 9**, the tag in A: A4 −4, C#5 +398, D#5 bending to E5 +621 → +701, with bass E♭2→E2
  +46 → +102. **Bar 10**, the whistle copies it: A5 −2, C#6 +397, D#6→E6 +625 → +700.
- **Bars 11-12**, the bend climbs: F#2→G2 +48 → +103, then G#2→A2 +246 → +303 (re F#2).
  **Bar 12**, the kettle boils: +154, +470, +764, +1017 re E5 over 0.8 s.
- **Bar 13**, second whistler: G5 −2, F#5 −105, D5 −506, E5 −303, D5 −501 re G5 (a sixth under every
  hook note).
- **Bar 14**, everybody bends within 120 ms: bass +42 → +102, toaster +15 → +101, kettle +21 → +103,
  whistle +21 → +99.
- **Bar 15**, the toaster's stolen long note: B4 +2, then −18 in its vibrato.
- **Bar 16**, the battery sag: on the hold, G4/C5/D5 read −53/−47/−45 dB against −87/−77/−79 for
  F#4/B4/C#5. At the downbeat, B4/C#5 read −51/−46 against C5/D5 at −75/−72. The bass glides F1→E1
  (−7 → −64 cents, 160 ms into the 1/8 glide).
- **Menu pads** follow the harmony. In each bar the chord's distinguishing note is the strongest of
  D4/C#4/B3/A3: Em9 → D4, A13 → C#4, Cmaj7 → B3, D → A3.
- **Demo shape:**
  - first sound at 0.000 s; the first 100 ms at −15 dBFS RMS;
  - the cold-open gap at −33 dBFS RMS while the toaster sings into it;
  - the final hit at −15.5 dBFS RMS;
  - the last 250 ms at −82 dBFS RMS, and the last 20 ms peaking at −76 dBFS.

## Provenance and rights

- **Every sound is synthesized** by the repository's own deterministic recipes in
  [`../tools/instruments.mjs`](../tools/instruments.mjs), unmodified. There are no recordings,
  samples, loops, SoundFonts or General MIDI: FluidR3 GM is not used anywhere, and no project has a
  `gm` instrument.
- **AC-01's palette is regenerated, not copied, and proven identical.** All 44 AC-01 sounds (bass,
  whistle, clav, kit, toaster, kettle, choir, kitchen percussion, ding) are byte-identical to
  `hybrid-ac/assets` (`assets/palette.json`, `reusedFrom.byteIdentical`).
- **22 new sounds use the same recipes at new pitches or voicings:**
  - 6 bass notes (C2-G#2) for the transposed riff.
  - 6 whistle notes (D5-A5, D#6) for the harmony and the A-tag answer.
  - 3 clav voicings (A13, Cmaj9, D6/9).
  - 2 choir "da" stabs (C, D).
  - 4 hummed menu pads (AC-01's wide choir with C's "oo").
  - The kettle-boil riser (A's whistle recipe held 1.6 s).
- **Tuning** (`analysis/palette-inspection.json`): every single-pitch sound is within ±3 cents (bass
  ≤ 2.8, whistle −0.6, voices ±2.8). Chords have no single-pitch figure. The ding reads +89 cents from
  its inharmonic partials, as in AC-01; its strongest partial is E7 by construction.
- **The approved audition and earlier experiments are untouched.** The pipeline re-renders AC-01 from
  its project, checks that its master matches the recorded hash (`f29d28d5…`), and records that `git
  status` shows no change under `a-sock-slide/`, `b-fridge-light/`, `c-low-battery-choir/`, `hybrid-ac/`
  or `tools/` (`analysis/summary.json`, `referenceAc01`). The engine and the THING//MANIA game
  repository were not modified.
- All melodies and rhythms are developments of AC-01 (itself developed from auditions A and C), written
  for THING//MANIA. None quotes an existing game soundtrack. The ♭VI-♭VII-i climb in bars 11-13 is a
  common-practice cadence, not a quotation. No license is declared; that remains the owner's decision.

## Reproduce

Environment used: DaemonV12 0.7.0, Node v22.22.0, FFmpeg 6.1.1-3ubuntu5 (with libvorbis, libmp3lame,
FFmpeg's native AAC and FLAC encoders). From the repository root:

```sh
npm ci
```

```sh
node experiments/thingmania-ost/final/tools/make-sounds-final.mjs   # assets/: 66 WAVs; proves the 44 AC-01 sounds byte-identical
```

```sh
node experiments/thingmania-ost/final/tools/compose-final.mjs       # the five project JSON files
```

```sh
node experiments/thingmania-ost/final/tools/render-final.mjs        # render, stems, loops, encodes, QA (about 20 min)
```

```sh
node experiments/thingmania-ost/final/tools/manifest-final.mjs      # manifest.json
```

`render-final.mjs --fast <slug>` skips the repeat renders and the encodes, for quick iteration on one
arrangement. Every intermediate (x3 renders, per-track stems, WAV group stems, repeat renders) lands in
`final/renders/`, which Git ignores. The WAV versions of the stems are in `final/renders/<slug>/stems/`
after a run. To turn a committed FLAC stem back into the identical WAV:

```sh
ffmpeg -i experiments/thingmania-ost/final/stems/main-theme/drums.flac -c:a pcm_s16le drums.wav
```

Or render one project directly with the CLI:

```sh
node bin/daemonv12.js render experiments/thingmania-ost/final/main-theme.json --out-dir /tmp/thingmania --stems --format wav,mp3
```

That direct render is the exact 16-bar project. It starts cold, with no tails from a previous cycle,
so it is not the seamless loop master. The loop master is cycle 2 of `main-theme-x3.json`.

## Files

```
final/
  README.md
  manifest.json                 every delivered file: SHA-256, size, frames, format; project, tool and palette hashes; environment
  main-theme.json               editable 16-bar main theme (render.duration = 16 bars, tail none)
  main-theme-x3.json            loop-extraction copy: the loop at bars 1, 17, 33 + a closing downbeat
  menu-mix.json, menu-mix-x3.json
  demo-mix.json                 18 bars + decay, cut at 41.0 s; real start and ending
  masters/                      main-theme-loop.wav, menu-mix-loop.wav (seamless), demo-mix.wav
  stems/<slug>/                 drums, bass-grit, whistle-lead, appliances-choir, harmony, fx (.flac, lossless)
  web/                          <name>.ogg (Vorbis q6) and <name>.m4a (AAC 192k): browser listening copies
  previews/                     <name>.mp3 (192k CBR); <slug>-x2-listen.mp3 (the loop twice + ending)
  analysis/                     <slug>.checks.json (all QA), summary.json, engine render manifests and
                                analyses, palette-inspection.json (tuning)
  assets/                       66 source WAVs, kit.json per instrument, palette.json (hashes, AC-01 reuse proof)
  tools/
    make-sounds-final.mjs       builds assets/ from ../tools/instruments.mjs (unmodified)
    compose-final.mjs           the score, in code
    stem-groups.mjs             which track goes into which stem
    render-final.mjs            DaemonV12 renders + master-bus stems + loop extraction + encodes + QA
    analysis-final.mjs          hook legibility per bar, UI-click headroom, start/ending shape
    manifest-final.mjs          writes manifest.json
  renders/                      (ignored) x3 renders, per-track stems, WAV group stems, repeat renders, references
```

## Process notes and deviations

- **Built from AC-01, not restarted.** The approved project, sounds, swing, track processing and
  master chain are reused. `compose-final.mjs` copies AC-01's helpers and phrases, and every AC-01
  sound is regenerated byte-identically. Nothing under `hybrid-ac/` or the earlier auditions was
  modified.
- **Evidence-driven revisions during QA:**
  1. The first render peaked at −0.89 dBTP in bar 11, where a new kick on the band hit landed on the
     bass's octave pop. The kick (0.8→0.6) and the pop (0.85→0.75) were softened on the hits.
  2. The ghost notes of the transposed riffs (C2, E♭2, F2) peaked higher than the E riff's ghost G1:
     higher fundamentals drive the grit layer harder. They were lowered from 0.6/0.55 to 0.45.
  3. Master gain went from −3.0 to −3.3 dB. The theme now sits at AC-01's −16.4 LUFS with −1.3 dBTP,
     so every lossy copy decodes at or below −1.2 dBTP. The bus compressor behaves as in AC-01
     (median gain reduction 3.03 vs 3.05 dB, σ 1.43 vs 1.45 dB).
  4. In the menu, the bass grit was the loudest thing in 2-6 kHz (−40.7 dBFS against −48.8 for the
     drums). Its low-pass went from 4 kHz to 2.2 kHz, with +0.5 dB to keep phone translation.
  5. The demo's tails are below −70 dBFS from 40.6 s, so a full 19th bar left 2.4 s of dead air. The
     file is cut at 41.0 s.
- **Hook safety.** No arrangement change weakened the hook, so nothing had to be reverted. The hook's
  head stays 98.6-99.6% unmasked in every bar it plays, against 99.1-99.4% in AC-01. One idea was
  rejected before rendering: the toaster doubling the hook an octave below in bar 13. The toaster's
  second harmonic would sit exactly on the whistle's pitch and take over the hook's timbre. The bar
  uses a second whistle a sixth below instead, in a different third-octave band.
- **Whistle and appliances overlap more than in AC-01** (1.8 s vs 0.07 s per loop), on purpose: the
  choir chord under the bar-13 hook and the bar-14 bend that everybody shares. While they overlap,
  only 0.9% of the whistle's energy is contested.
- **The build is in texture, not loudness.** Bar by bar, the theme's median momentary loudness moves
  by only about ±0.5 LU (`arcMedianMomentaryLufsByBar`), because the bus compressor and the steady
  groove keep it even. That suits a loop under gameplay. The lift comes from more parts:
  - bar 2 has 8 sounding tracks; bar 13 has 11;
  - bar 13 is the loudest bar of the theme (−15.9 LUFS);
  - the bars where an appliance sings alone are the quietest (−16.7 / −16.8).
- **Engine limits respected, not changed.** DaemonV12 allows 15 tracks. The theme and the demo use
  all 15, so the ding and the boil riser share the `fx` track. Project keys can only be major or minor,
  so the JSON says "E minor" as AC-01 does; the music is E Dorian. Glide durations are straight ticks,
  so the riser and the bends start on swung positions but glide in straight time.
- **Loop masters start warm.** A seamless loop has to begin with the previous cycle's tails (the sag's
  release, reverb, echo). The very first play in a game therefore begins with those tails under the
  downbeat. Measured against a cold render, they stay within 20 dB of the music for 0.43 s and fall
  below −60 dBFS by 0.81 s. If that matters, start with the demo's cold open or a short fade-in.
- **Width** is moderate and mono-safe, as in AC-01: above 300 Hz the correlation is 0.94 and the side
  energy about 3% of the mix. Panned mono sources keep a high correlation by construction.

