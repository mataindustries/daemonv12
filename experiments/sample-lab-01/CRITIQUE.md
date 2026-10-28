# SAMPLE LAB 01 · Musical critique

Both loops are cut from the same fictional record, CRATE-01: a drumless soul passage made from the palette, then
chopped. They differ in what they do with it. A treats the record as a soul sample to play on pads. B treats it as
tape to slow down and recolor.

I composed and mixed these from theory, measurement (chroma, spectrograms, stem levels, timing maps) and the engine's
exact event data. **I cannot hear audio.** Everything below is design intent checked by measurement, not a listening
verdict. Your ears are the approval gate.

## A — DUSTY POCKET (Bb minor)

**Identity in one line:** a backing group that never existed, chopped like a record, over a Moog line that answers it.

- **The hook is the chop, not a melody played over it.** At 0.00 s the `Bbm9-oh` chop lands: keys, the two-voice
  "oh-ah" group and glass, all as one recorded moment. At 1.08 s a 13 ms-early re-stab rushes the beat, and at 1.56 s the
  "ah" answers. That long / short-early / answer shape repeats with small changes each bar, so the loop has a phrase
  rather than a pad.
- **Harmony comes from the bass.** The chops are rootless, so the bass decides the chord. In bar 3 the same Bbm9 answer
  turns into Db/Ab when the bass walks Bb → Ab (6.26 s).
- **The surprise is a sampler move.** At 8.75 s the Gbmaj9 chop is replayed a major third down: slower, darker, the
  voices dropping with it, sounding D major 9. D major is the hexatonic pole of Bb minor, so the turn back at the loop is
  almost all half-steps (A→Bb, E→F, F#→F, with C#=Db held), and the bass's A1 pickup at 9.67 s leans into it. It should
  sound like a record briefly dragged into another key, not like a modulation.
- **Independent clocks, no global swing.** Snare 21.6 ms late on average (range +5…+35, one flam at 9.39 s). Shaker
  +16 ms, hat +12 ms on dragged accented off-beats. Bass +4.8 ms behind the kick with early pickups, and the kick both
  pushes and drags (−14…+18 ms). The chops lean early (−4.4 ms mean). See `deliverables/dusty-pocket/dusty-pocket.groove.svg`.
- **Deliberately absent lo-fi clichés:** no vinyl crackle, no wow/flutter wobble, no rain or room-noise bed, no
  sidechain pumping, no generic maj7 loop. The dust comes from the chop edges and filtering, and the drums sit forward
  (they peak above the music).

**Risks to listen for:** the snare is a mechanical source pitched down and may read harder than "dusty". The synthetic
voice group may sound synthetic on a revealing system. The bass (18 notes in four bars) may be busier than "minimal".

## B — COSMIC COLLAGE (Db, sinking)

**Identity in one line:** the record sinks a whole tone every bar under a hook that refuses to move, then snaps back up.

- **One chop, four keys.** The bed is a single Dbmaj9 chop pair replayed at four speeds: Dbmaj9 (0 s) → Bmaj9 (2.5 s)
  → Amaj9 (5.0 s) → Gmaj9(#11) (7.5 s). Each step down is also slower and darker, like a turntable losing power. At the
  loop point everything jumps up a tritone to Db. That snap is the payoff, and it is why the loop invites another play.
- **The hook stays put.** GLASS CHOIR, a resample of voice + octave-down voice + glass struck together, plays
  Ab-Eb-Db-Ab-Db-Eb in a 3+3+3+3+2+2 rhythm. Those notes are common to the first three chords, so the same phrase is
  heard as 5-9-1, then 6-3-9, then 7-#11-3. In bar 4 the hook bends into G lydian (F#-D-C#-A-C#-E), turning on C#, the
  one note all four chords share.
- **Unusual combinations, used as instruments.** The glass sounds an octave above the voice in every hook note. Glass is
  also pitched down two octaves into a wooden knock on a dotted-eighth cycle. The record is dragged an octave below the
  bed into a drone that rises under bars 3–4. Air swells breathe into bar 3 and into the loop point.
- **Rhythm that changes gear:** a half-time snare (13 ms late on average), hats switching per beat between pairs,
  quintuplets and sextuplets, and kicks displaced around the hook. Bar 4 ends with a rising ghost-vox stutter (9.54 s),
  32nd hats and an 18-semitone bass dive (9.37 s), all thrown into the snap.
- **Breathing:** the bed and drone duck against the main kicks through authored gain automation (the engine has no
  sidechain), and the hook drifts slowly left to right over the loop.

**Risks to listen for:** ten layers. If it feels crowded, the first cuts are the knock and the drone. To some ears,
whole-tone planing can read as detuned rather than sinking. The voice in the hook is pitched up to seven semitones and
may sound chipmunk-like on the Ab4 notes.

## Comparing them

| | A — DUSTY POCKET | B — COSMIC COLLAGE |
|---|---|---|
| What the record becomes | Pads played by hand | Tape slowed bar by bar |
| Hook | The Bbm9 "oh" chop phrase | GLASS CHOIR line, constant over moving chords |
| Harmonic surprise | Dmaj9 (same chop, major third down), 8.75 s | G lydian bar, then the tritone snap at the loop |
| Groove | Late snare, dragging hats and shaker, pushed chops | Half-time snare, gear-changing hats, cross-rhythm knock |
| Layers | 6 | 10 |
| Loudness | −13.94 LUFS, −1.61 dBTP | −13.90 LUFS, −1.43 dBTP |

If only one is kept, my expectation is that A is the one you put on repeat and B is the one people ask about. The test
is whether A's opening chop and B's snap still feel good on the twentieth pass.
