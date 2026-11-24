# COUNTERFEIT GOLD

An imaginary record from an imaginary past, composed and performed on DaemonV12's own instruments, printed to audio,
dug through, broken and rebuilt into an instrumental hip-hop track.

| Listen | What it is | Length |
|---|---|---|
| [`source/the-velvet-hearse--two-coins-for-the-ferryman.mp3`](source/the-velvet-hearse--two-coins-for-the-ferryman.mp3) | **The record.** The Velvet Hearse, "Two Coins for the Ferryman" (1971, imaginary) | 1:21 |
| [`beat/ferryman-takes-fakes.mp3`](beat/ferryman-takes-fakes.mp3) | **The production.** "Ferryman Takes Fakes", made only from that record | 0:59.5 |
| [`beat/ferryman-takes-fakes--creative-pass.mp3`](beat/ferryman-takes-fakes--creative-pass.mp3) | The production before the refinement pass, for A/B | 0:59.5 |

Lossless: `assets/record/the-velvet-hearse--two-coins-for-the-ferryman.wav` (the print the beat samples) and
`beat/ferryman-takes-fakes.wav` (the engine's master). Both are 44.1 kHz/16-bit stereo.

> The producer (an AI agent) cannot hear audio. Musical descriptions here are design intent. Numbers are signal
> measurements, not quality scores. Nobody has listened to either track yet.

---

## Side B, track 3: the record

**THE VELVET HEARSE · "Two Coins for the Ferryman"**
from *Music for the Viewing Room* (Lazarus Sound Library LSL-019, 1971). *The band, the label and the LP are invented.*

Vane & Sons Funeral Home kept a house combo for wakes. In 1971 the family pressed one album of background music for
the viewing room. It came out too funky for the viewing room, and most copies were buried with the customers.

| Player | Plays | Rack instrument |
|---|---|---|
| Deacon Mortimer Vane | upright bass | `living-bass`, warm |
| Odile Vane | voice, wordless | `impossible-voice`: human, then impossible in the crossing |
| Brother Ezra Coffin | reed | `breath-reed`: sings, barks, then feral |
| Lucius Vane | vibes, electric tines | `mechanical-orchestra/bar` with motor tremolo, `/tine` clean |
| Ignatius "Iggy" Plank | drums, congas, temple log | `context/kick` and `/snare`, `mechanical-orchestra/clock` as the hi-hat, `organic-percussion/skin` and `/log` |
| Mrs. Vane | bowed saw | `mechanical-orchestra/bow` |
| the building | the viewing-room bell | `mechanical-orchestra/bar` at the alien end |

The record is in F minor at 104.65 BPM, swing 0.56, 34 bars. The head is **Fm9 · Dbmaj9 · Bbm9 · Gb7#11**: a
bII7 that drags every chorus back to F. The tune is "two coins", two quick repeated notes, then a scooped leap. In the
last bar the reed sits on C, the #11 of Gb7: the ferryman's note.

| Time | Section | What happens |
|---|---|---|
| 0:00 | chime | The viewing-room bell alone. Odile breathes in and sighs one note. A bowed saw, and the clock |
| 0:05 | head-a | The theme, politely: reed and Odile's answers, Rhodes tines, vibes, bass, a few conga tones. **No drum kit** |
| 0:14 | break | Iggy cannot help himself: drums alone, a late snare, a conga roll into the band |
| 0:18 | head-b | The whole band grooving. Odile doubles the reed an octave down in the last bar |
| 0:28 | odile | The kit drops out. Odile sings the theme over bass and vibes, scats eight sixteenths, then falls a fourth |
| 0:37 | crossing | Eight cycles of **7/8** (2+2+3): the ferry. The vibes riff turns metallic, hands and log, saw and bell; Odile goes impossible (undertone, overtone whistle) and the reed barks |
| 0:53 | stop | Two band stabs, silence, the Deacon alone on a low F |
| 0:55 | shout | Two hot choruses: the reed feral with one overblown note and Odile crying, then reed and voice in unison and a chromatic climb |
| 1:13 | out | They hit the ferryman chord and never resolve. The bell, two coins on the tines, Odile breathes out |

The record is a real arrangement, and it also leaves something to dig in every section: a drumless theme, a clean
break, a sung chorus, a 7/8 vamp, stop-time stabs and one exposed bass note.

**Source files:** [`source/compose.ts`](source/compose.ts) writes the score
[`source/two-coins-for-the-ferryman.score.json`](source/two-coins-for-the-ferryman.score.json) (13 parts, 1,260 notes).
The rack renders it ([`source/rack-render.json`](source/rack-render.json)), and the context mix, normalized to -16 LUFS,
is the print.

---

## The production: FERRYMAN TAKES FAKES

**88 BPM · D minor · 0:59.5.** Every sound is read from the printed record by the unchanged DaemonV12 sampler.

**The turntable move.** The record plays at **0.840896** of its speed. 104.65 BPM in F minor becomes 88 BPM in D
minor, and each record beat becomes exactly one grid beat. The 104.65 was chosen backwards from that, as 88 × 2^(3/12).

**The counterfeit.** The record takes four bars to walk Fm9 → Db → Bbm9 → Gb7#11. The beat cuts the first two and a
half beats of bar 1 straight into bar 4. The ferryman's chord, now Eb7#11, arrives on the **and-of-three** and keeps
arriving there in every bar. The first two bars play the record as found, so the ear learns the real progression and
then hears it counterfeited at the drop.

| Time | Bars | Section | What happens |
|---|---|---|---|
| 0:00 | 1-2 | THE FIND | The record as found, two bars straight, heard through the wall (band-passed, saturated, small room). The viewing-room bell plays two octaves down. Then the two coins alone, dry |
| 0:05 | 3-10 | COUNTERFEIT | The re-cut loop, Iggy's break as the drums, and the Deacon's one low note as the whole bass line. Each pass ends differently: Odile's sigh; the coins stuttering three times; "deh-dah deh-dah OH"; the scat run. Pass 3 opens as a floor (no kick, bass or snare) until the counterfeit chord brings everything back at once |
| 0:27 | 11-14 | THE CROSSING | One 7/8 cycle retriggered every 3.5 beats across straight 4/4 drums. It would land on the one again only after seven bars, so here it never does. Odile's long fall, a reed bark, the steel string chirping like a toy laser |
| 0:38 | 15 | STOP | The record's two stabs, silence, the Deacon alone, a reversed bell swelling into |
| 0:41 | 16-19 | THE SHOUT | The same counterfeit, cut from the feral chorus: the overblown note, the record's own claps on the backbeat, Odile's sung coins on every downbeat, her scat run whole and then stuttered |
| 0:52 | 20 | PAYMENT | The unresolved ferryman chord falling, two coins, the bell two octaves down on D, a breath out |

### Where every sound comes from

29 chops from one print, 282 sampler events on 13 tracks. The record times are in the print, at the record's tempo.
The full notebook, with onsets and cleanliness, is [`beat/chops.json`](beat/chops.json).

| Track | Chop (record time) | How it is played |
|---|---|---|
| loop | head-a bar 1, beats 1-3 (0:04.6) + head-a bar 4 (0:11.5) | the counterfeit cut, 4 passes; choke group, 2 ms / 14 ms ramps |
| loop | shout bar 1, beats 1-2 (0:55.0) + shout bar 4 (1:01.9), its last two beats doubled back | the same cut from the feral chorus |
| loop | the two coins (0:04.9) | pickup into the drop, a triple stutter, and the payment |
| record | head-a bars 1-2 (0:04.6) | the intro "through the wall" |
| kick | break bar 2 beat 1 (0:16.1), 25 dB clean | rate 1, highpassed at 38 Hz to sit above the sub, saturated |
| snare | break bar 2 beat 2 (0:16.6) | rate 0.94, laid back 20-28 ms |
| hat | both break snares above 6.5 kHz | the wires and the room, gated to a sixteenth |
| perc | Iggy's four-stroke conga roll (0:17.8) | one hand at a time |
| bass | **the Deacon's lone F** from the stop bar (0:53.9) | 41 notes at D, E♭, C and G, with glides into and out of the loop |
| vox | Odile: "deh-dah" (0:27.8), the cry (0:09.0), the scat run (0:32.1), the fall (0:34.4), the breath (1:17.0) | dotted-eighth delay, room |
| seven | one 7/8 crossing cycle with its breath (0:38.7) | 5 retriggers every 3.5 beats |
| stabs | the stop stabs (0:52.7) and the last hit (1:13.4) | |
| bell | the opening bell (0:00) | rate 0.420448: two octaves down, on D |
| fx | reed bark (0:45.9), toy-laser string (0:52.2) | |
| swell | the shout downbeat (0:55.0), **reversed** | the one offline derivation: a bit-exact frame reversal ([`assets/derived/swell-reversed.wav`](assets/derived/swell-reversed.wav)), because the engine has no reverse playback |

### The self-sampling chain

1. **Compose and perform** a rack score (`source/compose.ts`) on the Signature Rack and the Timbre Lab instruments.
2. **Print**: render once with the rack and normalize; the context mix becomes a sampler asset.
3. **Dig** (`tools/dig.py`): only the print and the record's tempo are read. For each chop the script finds the
   real onset near the record's beat, starts the chop on a zero crossing just before it, and records where the
   record's beat sits inside the chop. That way the record's time lands on the new grid, not its first transient.
   Break hits are ranked by the energy in the 30 ms before each hit.
4. **Rebuild** (`beat/build.ts`): a native project ([`ferryman-takes-fakes.json`](ferryman-takes-fakes.json)) that
   uses only the engine's documented sampler features: `offsetSeconds`/`endSeconds` slices, `playbackRate`, `glide`,
   `gate`, `envelope` and `chokeGroup`, plus per-track effects. No engine or rack code was changed.

### The two passes

**Creative pass** (`beat/ferryman-takes-fakes--creative-pass.mp3`). The arrangement above, balanced until every part
measured audible. Three bugs were found by measurement and fixed inside this pass:

- The clock ticks under a highpass came out at -63 dB, so the hats were rebuilt from the break snares.
- The bass chop started on 32 ms of a stab's room tail, which made every bass note speak 36 ms early.
- `tail: "none"` with an explicit duration silenced everything after bar 20, including the final bell.

**Refinement pass**, three bounded changes:

| Change | Why | Measured result |
|---|---|---|
| R1: kick at its own speed, highpass 38 Hz; bass -1 dB | the kick and the Deacon shared D1 | energy below 150 Hz: 45-52 % → 35-46 % per section |
| R2: pass 3 opens as a floor (no kick, bass or snare until the and-of-three) | 22 s of flat level in bars 3-10 | that bar now jumps 3.6 dB at the counterfeit chord (was 0.9 dB) |
| R3: master +2.9 dB | loudness | -16.7 → -14.8 LUFS integrated, true peak -1.5 dBTP |

### Measurements

| | The record (print) | The production (final) |
|---|---|---|
| Length | 81.47 s | 59.50 s |
| Loudness | -16.0 LUFS, LRA 9.0 LU (FFmpeg) | -14.79 LUFS, LRA 5.6 LU (engine `analyze`) |
| True peak | -1.7 dBTP | -1.47 dBTP |
| Clipping | none | none on the master or any of the 13 tracks |
| Short-term loudness arc | | find -18.6 · counterfeit -14.2 to -15.1 · crossing -14.5 to -16.6 · stop -15.8 · shout -12.7 to -13.2 · payment -14.4, then a natural decay to -72 dB at the end |
| Timing (onsets vs grid) | long notes in tune: reed -2 to -15 cents, bass within 1 cent | loop chops within ±10 ms; kicks 1-7 ms and bass 3-9 ms early, snares 15-27 ms late (as written) |
| Determinism | a second rack render reproduced the print byte for byte | a second engine render reproduced the WAV and MP3 byte for byte |

Hashes of the delivered audio are in [`SHA256SUMS`](SHA256SUMS). The engine's full provenance (inputs, every trigger,
per-track peaks) is in [`beat/ferryman-takes-fakes.render.json`](beat/ferryman-takes-fakes.render.json).

### Reproduce

Run these from the repository root. Node 22.18+ and FFmpeg are needed; FluidSynth is not.

```bash
node counterfeit-gold-opus/source/compose.ts
node --import ./timbre-lab/register.ts studio-001/rack/cli.ts render counterfeit-gold-opus/source/two-coins-for-the-ferryman.score.json counterfeit-gold-opus/work/source --normalize -16
cp counterfeit-gold-opus/work/source/mix-context.wav counterfeit-gold-opus/assets/record/the-velvet-hearse--two-coins-for-the-ferryman.wav
python3 counterfeit-gold-opus/tools/dig.py
node counterfeit-gold-opus/beat/build.ts final
```

The print takes about 75 s and the beat about 70 s on one core. `work/` is ignored by git. `tools/` also holds the
measuring scripts used above: `sections.py`, `beatsections.py`, `arc.py` and `pitch.py`.

### Things to check by ear

- Head-a bar 1 still carries the faint tail of the opening bell (about -31 dB). Every counterfeit pass starts with it.
- Odile's scat run crosses the Eb7#11 in the shout. Its D and A pass against the chord quickly, on purpose; it may
  read as wrong.
- The crossing stacks the record's whole 7/8 band (hands, log, saw, bell tail, bass) under new 4/4 drums. It is the
  densest and least tested part of the track.
- The hats are snare noise above 6.5 kHz, not a cymbal, and the kick is not tuned to the key after R1.

### Notes

- **Sol's experiment.** `experimental/counterfeit-gold-001` and commit `86e1561` could not be reached: they are not on
  origin, in any pull-request ref, or on GitHub. The self-sampling chain here therefore builds on the engine's
  documented sample-performance contracts ([v0.6](../docs/V0_6_SAMPLE_PERFORMANCE.md),
  [v0.7](../docs/V0_7_SAMPLER_ARTICULATION.md)) and on the print-and-resample pattern of SAMPLE LAB 03
  (`feat/sample-lab-02-impossible-crate`). No musical material from either was reused.
- **What it is made of.** Numeric synthesis by the repository's own instruments only: no recordings, SoundFonts or
  third-party audio. The band, label and album are fiction. Licensing of the generated audio is the owner's decision
  and is not declared here.
- Nothing outside `counterfeit-gold-opus/` was changed.
