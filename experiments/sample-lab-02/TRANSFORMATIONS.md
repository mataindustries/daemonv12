# SAMPLE LAB 02 · The unusual transformations

What makes each sound, what to listen for (times are seconds into the loop), and how each sketch measures up against
the four questions in the brief. These are design intent checked by measurement (pitch tracking, spectra, loudness,
transient contrast), not a listening verdict: I cannot hear audio.

## A — GHOST FREQUENCY (radio)

**The source.** A fictional shortwave numbers station, "received" off the air. A formant-synthesized announcer reads
ECHO · ECHO · NINER · OVER on a monotone B3 after a six-note music-box interval signal, then repeats the message. The
station is reduced-carrier SSB. On the repeat the receiver drifts, so the product detector **frequency-shifts** the
voice: every partial moves by the same number of hertz, which is not the same as pitch-shifting, and the harmonics stop
lining up. The pilot carrier becomes a whistle at the offset. The drift holds on offsets that are notes (E2, A2, C4), so
even the whistle is in key. AGC breathing, fading, crackle, lightning crashes, squelch tails and a narrow CW filter
that makes static ring at F#5 all come with the recording.

**The transformations.**
- **An echo that climbs.** The "cho" of ECHO returns three times, a dotted eighth apart, and rises: B3 → D4 → E4 → G4.
  Those are the first four notes of the station's own interval signal, so the word turns into the station's tune. The
  echo pulse (every 3 sixteenths) runs four against the bar's three.
- **A voice the dial broke.** "O-VER" is taken from the drifted repeat, shifted +262 Hz: an inharmonic "duck" voice
  with the pilot whistle singing C4 inside it. Then it sinks a tone while the bass slides C → B.
- **The dial as a fill.** The last 0.46 s of the tuning sweep (a whistle falling from 470 Hz) is placed so that **zero
  beat lands exactly on the loop point**. The station comes back into tune on the next "E-CHO".
- **Artifacts as a kit and a bass.** The transmitter key-up thump (slowed to 0.9) is the kick. A lightning crash and
  the CW-filter crash are the snares. Squelch-tail grains are the hats. CW pings are retuned to E5, B5 and A5. The
  receiver's 60 Hz ground-loop buzz, retuned, is the bassline E | C → B.
- **A happy accident, kept.** The first "E" still carries the dying last note of the interval signal (a music-box
  E5), the way a real chop drags in the end of the previous sound. It sounds the tonic in the first tenth of a second.

**Listen for:** 0.00 "E" + thump + hum · 0.16 "CHO" · 0.63 / 1.11 / 1.57 the echo climbing · 1.27 crash snare · 1.87
"NI" 2.19 "NER" · 2.51 "O" and 2.82 "VER" from the broken dial · 3.14 the ringing CW snare · 3.30 → 3.75 the dial
falling into tune.

| Criterion | Assessment |
|---|---|
| Recognizable identity | A radio voice whose echo sings: monotone syllables, static and whistles, 3 + 3 lilt. |
| Surprising moment | 2.5–3.75 s: the voice goes inharmonic, then the sweep drops into zero beat right as the loop restarts. |
| Rhythmic pocket | 96 BPM in 6/4 felt as two halves, kick on 1 and 4, snares late on 3 (+22 ms) and 6 (+16 ms), echoes in a 4-against-3 pulse. |
| Reason to replay | The loop ends on the station tuning back in, so every replay is "it's back". |

**Risks:** the synthetic voice may sound like a speech synthesizer rather than a person, which suits a numbers station
but may sound cheap. The "duck" voice could read as a mistake. The 6/4 lilt is unusual for this tempo.

## B — OBJECT ORCHESTRA (kitchen)

**The sources.** Five physically modelled takes in a small kitchen:
- a big ceramic mug struck with a teaspoon (bell-like modes 1 : 2.40 : 4.27 …, doublets split by the handle);
- a dripping tap into a bowl (Minnaert bubbles that ring and chirp upward);
- a fist on a cardboard box;
- a hardback book slapped on a table;
- a coin spun until it falls (Euler's-disk acceleration).

**The transformations.**
- **The mug's shadow (primary instrument).** One spoon tap is printed by the engine at quarter speed (A5 → A3, 1.8 s
  → 7.2 s), and the sketch plays that print at quarter speed again. **The bassline is the tap four octaves down and
  sixteen times slower.** The spoon click becomes a soft thock, and the kitchen's 2–10 ms reflections become a long dark
  bloom. The mug's minor-tenth partial rides 4 dB under each note, so every bass note is a small minor bell. The line
  uses only A, D and E, so that overtone (C, F, G) stays in A minor whichever partial the ear follows. On the first
  downbeat the real mug rings 14 ms after the kick, so you hear the object and its giant shadow together.
- **Drips as hi-hat and melody at once.** Sixteen drops a loop, each retuned by less than 1 % to A minor pentatonic
  and swung 17–21 ms. The upward bubble chirp gives every note a liquid scoop.
- **Physics as a fill.** The coin is set spinning at 2.875 s so that its contact rate rises from 12 to 125 a second and
  it **falls flat exactly on the next downbeat**, under the next mug boom: an accelerando no drummer played.

**Listen for:** 0.00 box + mug boom (A1) + coin landing, 0.014 the real mug · 0.14 → drips (E6, A6, G6 …) · 0.52 and
1.53 the book, laid back · 0.76 E2, 1.26–1.39 D2 sliding to E2 in the bass · 2.875 → 4.00 the coin speeding up into the
downbeat.

| Criterion | Assessment |
|---|---|
| Recognizable identity | A kitchen you can name (water, a mug, a book, a coin) playing a minor groove. |
| Surprising moment | The first boom: a mug cannot be that deep. Then the coin's accelerando landing on the one. |
| Rhythmic pocket | 120 BPM; box on 1, the "a" of 2 and the "and" of 3 (moving to 2-and and 3-e in bar 2); book 21–31 ms late on 2 and 4; swung drips; bass with its own offsets. |
| Reason to replay | The coin always falls on the downbeat, and the boom answers it. |

**Risks:** physical models can sound toy-like next to real recordings. The bass's bell overtone may read as two notes
at once. Six objects is the most layers of the three sketches.

## C — TIME FRACTURE (one take, three states of time)

**The source.** One stereo take in a tiled stairwell: someone keeps time with their foot and finger snaps for a bar,
then whistles an original two-bar tune in B minor at 75 BPM, still tapping. The whistle has portamento, scoops, delayed
vibrato, fall-offs, tongue dips and pitched breath. The stairwell rings with a flutter echo.

**The generations.**
1. *Offline reverse* (bit-exact mirror): `stairwell-reversed.wav`.
2. *Offline time stretch*: the held B5, 4× longer at the same pitch (phase vocoder with identity phase locking).
3. *Engine print*: the steady start of that B5 at quarter speed (`whistle-quarter.wav`).
4. *The sketch*: the engine plays all of these. The bass is generation 3 at quarter speed again, so it is **the whistle
   four octaves down, sixteen times slower**, with saturation to give it harmonics a phone can play.

**The transformations.**
- **Forward (beats 1–2).** The first two beats of the take exactly as recorded: F#6 scooped, E6, D6, landing on B5, with
  the whistler's own foot and snap.
- **Frozen (beat 3).** The held B5 continues in the slow-motion generation, so its vibrato slows from 5.6 to 1.4 Hz.
  Then the frozen beat **fractures at golden-ratio points** (593, 227 and 140 ticks) into shards read from later and
  later in the note, sagging −40 then −100 cents like a stopping tape.
- **Rewound (beats 4–5).** The same two beats from the reversed take. A reversal mirrors the grid, so the reversed snap
  **swells into beat 5**, the reversed foot **swells into the next downbeat**, and the reversed scoop slides *down* off
  F#6 just before the forward scoop slides *up* onto it. The melody descends F#–E–D–B and returns B–D–E–F#: a palindrome
  with a frozen centre.
- **Bass.** B (with a passing D) | G | A | F# (i VI VII v). It answers the foot a sixteenth late, so the whistler's own
  foot stays audible.

**Listen for:** 0.00 foot + F#6 scoop · 0.60 E6, 0.80 D6 + snap (0.82) · 1.20 B5 · 1.60 time stops, the vibrato
slows · 2.09 / 2.28 the shards sag · 2.40 rewind, snap on 4 · 3.18 reversed snap into 5 · 3.99 reversed foot sucks into
the downbeat.

| Criterion | Assessment |
|---|---|
| Recognizable identity | Someone whistling in a stairwell whose time keeps breaking. |
| Surprising moment | 1.6 s: the note goes into slow motion while the foot keeps time, then the phrase runs backwards. |
| Rhythmic pocket | 75 BPM in 5/4: foot on 1 and 3, snap on 2 and 4 (about 20 ms late, as performed), reversed hits sucking into 5 and 1. |
| Reason to replay | It is a palindrome. The end rewinds into the beginning, so the loop never quite resolves. |

**Risks:** 5/4 with a frozen beat is more hypnotic than head-nodding. Phase-vocoder smear can sound "digital". The
sixteen-times bass is subtle on phone speakers.

## Side by side

| | A — GHOST FREQUENCY | B — OBJECT ORCHESTRA | C — TIME FRACTURE |
|---|---|---|---|
| Source | One radio recording + its hum | Five kitchen takes | One stairwell take |
| Primary transformation | Frequency shift (SSB drift) and a climbing echo | Two quarter-speed prints: a spoon tap as bass | Reverse + phase-vocoder freeze + golden shards |
| Time feel | 96 BPM, 6/4 (3 + 3) | 120 BPM, 4/4 | 75 BPM, 5/4 (2 + 1 + 2) |
| Key | E minor | A minor | B minor |
| Tracks | 4 | 6 | 4 |
| Loudness / true peak | −13.93 LUFS / −3.82 dBTP | −14.03 LUFS / −2.22 dBTP | −14.01 LUFS / −6.99 dBTP |

My expectation, not a verdict: B is the one you nod to, A is the one people ask about, and C is the most "impossible".
Which one survives the twentieth pass is your call.
