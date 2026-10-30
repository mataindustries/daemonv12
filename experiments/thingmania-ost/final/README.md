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
| **3** | **Demo mix** · 42.99 s, with an ending | — | [demo-mix.mp3](previews/demo-mix.mp3) | [ogg](web/demo-mix.ogg) · [m4a](web/demo-mix.m4a) | [demo-mix.wav](masters/demo-mix.wav) | [stems/demo-mix/](stems/demo-mix/) |

Listen on a phone speaker and on headphones. The x2 previews are a continuous render (the loop as the
game will play it, twice, then a closing downbeat), so the loop seam is in the middle of the file.

- **For the game:** use the WAV masters, or the Ogg/M4A copies for the web.
- **The Ogg Vorbis copies decode to exactly the master's length**, so they loop sample-exactly.
- **MP3 and AAC carry encoder padding**, and browsers handle it inconsistently. Treat them as
  listening copies (checked in [Technical QA](#technical-qa)).

## What AC-01 gave the theme, and where it is

| Approved element | Where it lives in the final theme |
|---|---|
| **Squelch-bass personality** | The riff and its walk carry bars 1-8 and 13-16 with the same sound, choke and processing (the samples are byte-identical to AC-01's). In bars 9-12 the same riff shape moves to A, C and D and keeps its bend. |
| **Whistled hook** (E6 D6 B5 C#6, then the long note) | Bars 2, 4, 6, 13 and 15 in full; bars 8 and 16 as AC-01's clipped head. Bar 13 adds a second whistler a sixth below. |
| **Swung funk groove** | 16ths swung to 272/240 ticks (about 57%), kick locked to the bass on 1 and 3-and, ghost-note backbeat in every bar. The groove only stops where AC-01 stopped it: the stop-time in bar 8 and the slip in bar 16. |
| **Singing toaster call-and-response** | *ba-da-DEE* rides the bass's B♭→B bend in bars 5, 7 (with the kettle a fourth below) and 14. It is sung at double speed into the bar-8 hole, in A in bar 9, and the toaster steals the hook's long note in bar 15. In bar 10 the whistle answers the toaster back. |
| **Battery-sag turnaround** | Bar 16, identical to AC-01's bar 8. The F13 slip (♭II) is handed to the choir, which holds one beat and then sags exactly one semitone onto E as the bass slides F→E. |
| **Kitchen-timer ding** | The downbeat of every loop (E7): power restored after the sag. |

## Deliverable 1 · Main game theme

**106.0773 BPM, 4/4, E Dorian, 16 bars, exactly 36.2 s (1,596,420 frames).** The tempo is 96000/905
BPM, so one quarter note is exactly 565,625 µs and every loop repeat lands on the same frame.

| Bars | Harmony | What happens |
|---|---|---|
| **1-4** · establish | Em9 | **The riff and the hook, nothing else.** Bar 1: the ding restores power on the downbeat, the squelch riff bends B♭→B on beat 4 and the whistle picks up (B-D). Bar 2: the hook over the walk. Bar 3: the riff again. Bar 4: the hook, but its long note now **bends up a semitone, catching the bass's bend**. |
| **5-8** · the appliances | Em9 | Bar 5: **the toaster answers** *ba-da-DEE* in the slot where the whistle just answered itself, with the DEE riding the bass bend three octaves up. The clav steps aside. Bar 6: the whistle calls again, bent. Bar 7: the **kettle** joins a fourth below. Bar 8: AC-01's **stop-time**: the band stops dead on beat 3, the toaster sings the tag at double speed into the hole, and the band slams back in on the bend. |
| **9-12** · development | A13 → Cmaj9 → D6/9 | **i → IV → ♭VI → ♭VII.** Bar 9: the riff moves to A (the clav changes one note, D→C#, the Dorian 6th), a rice-jar shaker enters opposite the hats, and the toaster sings the tag **in A** (D#→E on the bend). Bar 10: **role reversal**: the whistle copies the toaster's A tag back to it. Bars 11-12: the **whole band hits in 3+3+2** (bass, kick, clav, and the appliance choir on "da") on C, then D. The riff's bend survives in each key (F#→G, G#→A), so the bend climbs **E, G, A**. A snare roll and a **kettle coming to the boil** (a whistle gliding up an octave) charge into bar 13. |
| **13-16** · return | Em9 → F13 → E | Bar 13: **the strongest hook statement**. It arrives on E after the ♭VI-♭VII climb with full band, a **second whistler a sixth below**, the choir under it and a pot lid doubling the backbeat. Bar 14: **everybody bends together** on beat 4: bass B♭→B, toaster A#→B, kettle F→F#, whistle A#→B. Bar 15: the hook again, and **the toaster steals its long note** ("YAAAH"). Bar 16: AC-01's ending verbatim. The hook's head, the **F13 slip**, and the choir holding one beat before it **sags one semitone** as the battery dies. The bass slides F→E into the loop, and the ding on bar 1 restores power. |

The form is not AC-01 twice. Bars 1-8 re-order AC-01's eight bars so the appliances arrive only after the
hook is established. Bars 9-12 are new. Bars 13-16 intensify the hook and end with AC-01's turnaround,
which is the loop's pickup.

**Using it in the game:** loop `masters/main-theme-loop.wav` from frame 0 to its end (1,596,420
frames). The file is cycle 2 of a continuous three-times render, so it already starts with the
previous cycle's sag, reverb and echo tails. Looping it is identical to continuous playback. If the
first play should start cold, start with the demo mix's cold open or fade in for 50 ms.

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

**42.99 s (1,895,749 frames), 18 bars plus one decay bar.** A short, complete piece for a 3-minute
hackathon demo video: a strong start, the hook within 2.3 s, an energetic payoff and a real ending.
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
| 40.725 s | 19 | Decay to digital silence. |

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
  the master's frame count (1,596,420 / 1,596,420 / 1,895,749), PCM16 stereo at 44.1 kHz. The loop
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

TBD

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
  demo-mix.json                 19 bars, real start and ending
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

TBD
