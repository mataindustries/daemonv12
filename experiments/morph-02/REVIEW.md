# MORPH//02 production review

**I could not listen.** This environment has no audio perception. Every judgement below
is either a measurement (`analyze.py`, pitch tracking, spectrogram inspection) or a
design intention. The musical verdict belongs to the human listener. Proxy numbers
(loudness spread, band balance, onset density) only detect gross problems: a missing
low end, a flat arc, a smeared section. They can't tell you whether something is good.

All three masters are stereo 44.1 kHz / 24-bit, true peak ≤ −1.1 dBTP, and close in
loudness (−13.9 to −15.2 LUFS) so comparisons aren't won by level. MORPH//01 reference
copies are pure-gain matched to −14 LUFS in `audio/reference/`.

## Measured comparison (final renders)

| | A — Machine learns to sing | B — Alarm breaks reality | C — Tempo string | MORPH//01 performance (ref) |
|---|---:|---:|---:|---:|
| Length / tempo | 12.0 s, 90 BPM | 11.4 s, 120 BPM | 12.0 s, 80 BPM | 12.0 s, 120 BPM |
| Integrated loudness | −14.2 LUFS | −13.9 LUFS | −15.2 LUFS | −13.8 LUFS (gain-matched) |
| Peak-to-loudness ratio | 12.7 dB | 12.4 dB | 14.1 dB | 7.4 dB |
| Momentary spread P95−P10 | **11.2 LU** | 7.3 LU | 8.5 LU | 3.8 LU |
| Quietest → loudest half-second | −23.2 → −8.9 | −19.6 → −11.4 | −24.5 → −10.7 | −15.6 → −11.1 |
| Energy < 150 Hz | 51 % | 80 % | 48 % | 0 % |
| Energy > 2 kHz | 2.1 % | 4.4 % | 5.2 % | 4.5 % |
| Onsets per second | 4.7 | 5.5 | 5.8 | 2.3 |
| Stereo correlation | 0.86 | 0.96 | 0.92 | 1.00 (mono) |

B's 80 % below 150 Hz is a kick-and-bass-driven dance mix, about what a
−4.5 dB/octave tilt predicts. I checked that it isn't infrasonic waste: under 1 % of
energy per second is below 36 Hz.

## A — THE MACHINE LEARNS TO SING

**Intent.** Recognizable in the first three seconds: a tiny synthetic child voice hums
"mm", blooms into "AH" and sings "hel-lo" over a music box. Each early note starts
slightly off pitch and is pulled in, like someone finding a note. The arc goes from
delicate (bar 1, about −19 to −14 LUFS momentary) to confident and mechanical (bar 2: a
heartbeat and a dotted-eighth machine echo of its own words, with a stepped
square-wave vibrato), to transformation (bar 3: the throat physically stretches while
the pitch falls 19 semitones into a period-doubled growl, then the tongue jams into an
accelerating "lo-lo-lo"). Bar 4 is the monster, peaking at −8.9: "HEL-LOOO" as a
parallel-fifth machine choir over half-time drums. It rises in anguish and **cracks**
back into the child's falsetto. Then, in the silence, a tiny "hello?" and one music-box
tine. That ending is the dark-humour beat for picture.

**Revisions made.**
1. Voice engine v1 failed measurably. The lip output wasn't area-weighted, so a
   closed-mouth "mm" came out louder than an open "ah". An abrupt glottal closure plus a
   second differentiator put 87–98 % of test-phrase energy above 6 kHz. Fixed with
   area-weighted radiation, an LF-style return-phase tilt, lip radiation loss and a
   single differentiation.
2. Vowels were fitted to formant targets by grid search (`calibrate-voice.mjs`): /i/
   289/2163 Hz, /ɪ/ 390/1964, /ɛ/ 521/1746, /ʌ/ 631/1188, /o/ 444/808, /u/ 292/889. /a/ is
   the weakest fit at 645/1138 against a 730/1090 target.
3. Arrangement v1 buried the articulation under a low-frequency wall: a sub sine, an
   octave-down shadow voice, heartbeats and drive intermodulation. Rendering the voice
   alone showed the stutter dips, the crack and the final "hello?" were all intact. I
   restricted the shadow and sub to bar 4, high-passed the shadow, lightened the
   heartbeat, and removed a kick that landed on the crack.
4. At D5–A5 the child's harmonics were too sparse for the formants to articulate
   "hel-lo". I moved bars 1–2 down an octave to D4–A4 and added the fifth-voice choir.

**Self-assessment (design, not ears).** *Originality*: high. It's a physical throat
whose size, tension, growl and articulation are performed independently of pitch; a
sampler can't do this. *Hook*: the two-syllable "hel-lo" motif returns three ways.
*Emotion*: the strongest of the three by design (fragility → rage → the child inside).
*Weight*: bar 4 only. *Picture*: the most narrative; the crack at 9.67 s and the final
"hello?" are natural animation beats.
**Risks.** A synthetic child voice can land in uncanny or whistle territory.
Intelligibility of "hel-lo" isn't verified by ear. The 1.3-second growing throat in
bar 3 might read as a pitch-shift effect rather than a body getting bigger. Bar 4 is
dense.

## B — THE ALARM THAT BREAKS REALITY

**Intent.** The hook is two-tone piezo double-beeps grouped 6+6+4 sixteenths: a
tresillo of "beep-beep-boop", E E B | E E B | G **F**. The F is the alarm's "wrong
note", alarm-like and danceable. Bar 1 is a kitchen. In bar 2 every beep moves
machinery: a hydraulic press stamp for the short beeps, a four-octave-down "BWOMM" horn
for the long ones, and a clock escapement the size of a building. At 3.5 s the
G-F fragment ratchets upward, a toaster spring pops, reality inhales, and a drop impact
lands at 4.0 s. The groove is built from household-sound archetypes: washer-drum kick,
toaster-spring snare (a dispersive allpass loop), alarm-clock-bell hats (swung),
fridge-hum bass on the hook rhythm, Em9 stabs, and the alarm itself as a talk-box-like
vowel lead. In bar 5 the floor vanishes for one beat and the alarm is left stuck on its
wrong note until it sags. A microwave DING ends the world, followed by one polite beep.

**Revisions made.**
1. Draft 1 failed measurably. The machine answers piled up into a continuous low wall
   (88 % of energy below 150 Hz). Bar 2 was louder than the drop, and the bus compressor
   took 16 dB. The cause was modal resonators whose low modes had about 1/sin(ω) gain
   under sustained excitation. I rewrote the resonators with explicit impulse/peak
   normalization, replaced the drone with discrete clank/horn events, and moved to dB
   gain staging. The arc became bar 1 ≈ −19, bar 2 ≈ −15, groove ≈ −12 LUFS momentary.
2. Sub-octave oscillators (about 20–31 Hz) in the bass and horn were wasting headroom,
   so I removed them.
3. I added the drop impact, and fixed a bell buffer that would have truncated a
   1.4-second ring at 0.35 s.

**Self-assessment.** *Hook potential*: highest of the three: a tiny melodic cell with
built-in syncopation and a comic wrong note. *Accessibility*: four-on-the-floor,
swing, sidechain pump. *Originality*: medium. The structure is classic, but every
sound is a household archetype rescaled. *Weight*: strong from 4 s on. *Picture*: made
for a surreal animated short. Each beep has a visible machine consequence.
**Risks.** The talk-box lead is a filter approximation, not a real talk box. The wrong
note could read as a mistake. The bar-2 machinery may be busier than ideal.

## C — THE IMPOSSIBLE INSTRUMENT: THE TEMPO STRING

**Intent.** A steel cable so long its fundamental *is* the tempo. One strike returns as
reflections; each round trip passes 160 first-order allpasses, so every reflection is a
longer, darker downward "pew" chirp (high frequencies outrun low ones). Two cables run
in 3:4 (quarter vs dotted-eighth), so two strikes make a syncopated groove. The anchor
bolt booms on each arrival. Tightening shortens the loop at a constant ratio: the
rhythm accelerates through a ratchet into a pitch, saturating feedback bows it, and it
lands on E1. The cable then plays a palm-muted bass riff with re-tension glides. On
release the pitch falls and decelerates back into the rhythm it came from. Rhythm and
pitch are one physical control, which is a structural device a film can be cut to
(zoom from cosmic to microscopic and back).

**Revisions made.**
1. Draft 1 failed measurably. The first strike was only audible after one round trip
   (0.55 s of near-silence). The rhythm section sat about 16 LU below the bass, the
   pitch transition was abrupt, the riff was organ-like, and less than 0.2 % of energy
   was above 2 kHz. I now inject the strike before the dispersion, self-strike in sync
   with each round trip, add palm mutes, brighten the loss filter and redesigned the
   levels.
2. The release smeared into noise, because stretching a loop time-stretches whatever is
   circulating in it, and the ending was louder than the riff. I damp the loop at
   release and start the decelerating self-strikes later.
3. The cubic tightening curve kept the loop long and then collapsed it. I replaced it
   with a geometric (constant-ratio) accelerando, the shape of a bouncing ball in
   reverse. Structural events are on the beat grid. I mastered at −15 LUFS to keep
   limiting light on the sub riff.

**Verified.** YIN pitch tracking of the isolated low cable puts all 14 riff notes
within **±4 cents** of their targets (E1 to E2). The dispersion delay compensation
inside the loop holds the cable in tune.
**Self-assessment.** *Originality*: highest of the three in technique. The rhythm↔pitch continuum itself
has a famous precedent (Stockhausen's *Kontakte*, 1960). What's new here is making
it one physical, playable control on a dispersive, self-oscillating cable model. *Weight*: an E1 bass and anchor booms. *Hook*: the 3:4 chirp
pattern and the riff. *Picture*: the strongest structural sync device.
**Risks.** Laser chirps are a known sci-fi cliché. The context here is new, but the
timbre isn't. The bowed bass may read as buzzy. The limiter still takes up to 3.8 dB
for a moment while the string fuses into pitch (4.0–4.8 s).

## Recommendation

Listen in this order: B (most immediately accessible), C (the concept), then A (the
story). After each, play the level-matched MORPH//01 reference.

My design-based bet for an identity: the **Tempo String** as the record's recurring
structural device (intros, transitions, film time-warps), the **alarm hook** as the
single, and the **singing machine** as the protagonist that hums, learns, breaks and
says "hello?". All three share E/D minor colour and integer-frame tempos (90/120/80 BPM
give whole picture frames per beat at 24 and 60 fps), so they can live on one record
and one timeline.

Next steps if a direction lands: render the voice in phrases with lyrics; expose the
cable as a playable instrument (strike timing, tension curve and dispersion as JSON);
and build a longer B arrangement from the engine kit already exported in `engine/`.
