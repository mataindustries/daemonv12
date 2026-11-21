# CONCRETE GOSPEL · DaemonV12 First Listening Benchmark

16 bars of dark Southern trap at 144 BPM (halftime), F minor. One composition pass and one bounded technical QA/fix
pass, then stopped for the owner's listening review. **Nobody has listened to it yet.** The composer (an AI agent) cannot
hear audio, so musical descriptions below are design intent and the numbers are signal measurements, not quality scores.

| Listen | |
|---|---|
| [`delivery/concrete-gospel.mp3`](delivery/concrete-gospel.mp3) | Phone copy, 192 kbps |
| [`delivery/concrete-gospel.wav`](delivery/concrete-gospel.wav) | Master, 44.1 kHz/16-bit stereo, 29.067 s = 16 bars (26.667 s) + 2.4 s release tail |
| [`delivery/stems/`](delivery/stems) | 12 sample-aligned engine stems, lossless FLAC (each decodes to the engine's exact PCM) |

## Map

| Bars | Time | What happens |
|---|---|---|
| 1–4 | 0:00 | The hook on the breath reed, heard as if through a concrete wall (band-limited 320 Hz–1.5 kHz). The choir hums "oo" on Fm and Bbm, and a steel bell tolls. Quiet hats from bar 3, then half a beat of silence. |
| 5–8 | 0:06.7 | The wall opens: full-band reed with kick, 808, snare and clap, hats and a steel clank (groove A, twice). A rising pitched hat roll leads into bar 9. |
| 9–11 | 0:13.3 | Groove B: stutter kicks, an 808 octave hop and a Db–C–F walk-down. The reed's moan falls deeper (to Eb4). |
| 12 | 0:18.3 | **The unexpected moment** (below). |
| 13–16 | 0:20.0 | Slam back on F minor with the bell. The reed is pushed into a growl and the 808 gets grittier, with metal strikes. Bar 16: the drums stop on the last snare, the 808 dives an octave, and a quiet minor "amen" sits under the last moan. |

## What was written (intent, not a grade)

**Hook (two bars, call and answer).** The answer starts an eighth note late, and its moan lands on the note the next call
starts from, so the loop closes on itself.

| Part | Notes (beats from the start of the bar) |
|---|---|
| Call, bar 1 | Triplet walk-up Ab4–Bb4–B4 (beats 1, 1⅓, 1⅔; B natural is the blue note), into C5 held from beat 2 for 1½ beats |
| Answer, bar 2 | From the and-of-1: triplet Eb5–Db5–C5, into Ab4 held 2 beats that bends down three semitones to F4 as the breath lets go |

**Low end.** The Living Bass is played as a tuned, sliding 808 on F1 and Bb1, with a sine sub and a saturated body for
phone audibility. Its moves:
- a pitch-drop punch on fresh strikes (negative `scoop`);
- an F2→Ab1→Bb1 swoop after the snare and a C2→F1 glide back;
- the Bb2 octave hop and the Db2–C2–F1 walk-down in groove B;
- dive endings.

The kick owns the attack: V12 IRON PULSE tuned to C2 and gated, plus a Hand Skin palm stroke (punch) and a Hollow Log rim
(click). The 808 owns the sub, and its gain is authored down 5 dB for about 100 ms under every kick.

**Groove.** The halftime backbeat on beat 3 stacks TITANIUM CRACK (down a semitone) with NEON CLAP. Kicks fall on 1 and the
and-of-2, with pickups. Hats play eighths with a 2.6 ms late lean on the off-beats, and the rolls are written out (triplet
and 32nd; some rise in pitch). The hats leave holes, for example under the start of the bar-10 moan and through bar 12. The
bell is gated short as a steel clank that answers the hook in its rests.

**Unexpected moment (bar 12, 0:18.3–0:20.0):**
1. The 808's Ab1 swoop is held into the downbeat and tape-stops 19 semitones while everything drops out.
2. In the hole, three voices sing the hook's answer, with the same rhythm and contour, in **major** over an F pedal:
   Eb–D–C→D (F7sus→Bb/F→F→Bb/F, a plagal "amen"), with the glass halo ringing.
3. The reed only draws breath, then bar 13 slams back into F minor.

It is the title's one moment of light inside the concrete, and it gives the return something to land against.

## Instruments and provenance

| Role | Instrument | Version / source | Status |
|---|---|---|---|
| Hook | Breath Reed | Timbre Lab `0.1.0+timbre-lab` | Not approved, not frozen; licensing pending |
| 808 | Living Bass | Signature Rack `1.0.0+mutation-001-A` | Frozen, owner-approved after listening; licensing pending |
| Choir (×3) | Impossible Voice | Signature Rack `1.0.0+mutation-001-B` | Frozen, owner-approved; licensing pending |
| Kick punch, click | Hand Skin, Hollow Log | Timbre Lab `0.1.0+timbre-lab` | Not approved; licensing pending |
| Kick body, snare, clap, hats, bell, clank | IRON PULSE, TITANIUM CRACK, NEON CLAP, GHOST TICK, OPEN CIRCUIT, CHROME STRIKE | V12 Signature v1 (`scripts/generate-v12-signature.ts`) | Engineering-verified pack; licensing pending |
| Room | Rack shared FDN room (wet only) | Signature Rack 1.0.0 | As above |
| Mix | DaemonV12 0.7.0 production route | Unchanged engine; FFmpeg 6.1.1 for filters, compressor, MP3 and loudness | |

**What it is made of.** Everything is synthesized from numeric parameters and seeded noise. There are no recordings,
sample packs, SoundFonts, General MIDI, impulse responses or paid APIs. SUB HAMMER is copied only because the V12 kit maps
it; it is never played.

**Tried and not used.** The Mechanical Orchestra bar and tine rang too long for the clank role. The HEADLINER context kick
measured as pure sub with no click. Clay Pot and the V12 melodic and bass sounds were not needed.

**Licensing: every instrument used has a pending licensing declaration, so the master, MP3 and stems are private research
assets.** They are not published and grant no license.

## Levels and render status (final master)

- **Format:** 1,281,841 frames, 44.1 kHz stereo PCM16.
- **Loudness:** −13.04 LUFS integrated (engine analysis), LRA 4.3 LU.
- **Peaks:** sample peak −2.25 dBFS, true peak −2.15 dBTP.
- **Clipping:** none. Zero full-scale samples, and the engine's production overload counters read 0 on all 12 tracks and the master.
- **Edges:** the last 10 ms peak at −57.8 dBFS; DC offset is about −0.0003.
- **Section RMS (dBFS):** sermon −18.6 · doors −13.2 · push −13.2 · bar 12 −18.0 · return −13.4.
- **Stems:** all 12 start at frame 0 and have the master's exact frame count. Each FLAC was verified to decode to the engine's PCM.
- **MP3:** 192 kbps libmp3lame; decodes cleanly.
- **Determinism:** a second from-scratch build produced a byte-identical master WAV, MP3 and all 12 stems (Linux, Node 22.23.5, FFmpeg 6.1.1-3ubuntu5).
- **Repository:** nothing outside this directory changed, and `node studio-001/rack/cli.ts freeze` still reports every frozen engine intact.

| Stem | LUFS | Peak dBFS | | Stem | LUFS | Peak dBFS |
|---|---:|---:|---|---|---:|---:|
| bass808 | −12.2 | −4.1 | | reed (bars 5–16) | −14.8 | −4.1 |
| kick | −18.5 | −2.1 | | reed-far (bars 1–4) | −19.3 | −14.2 |
| snare | −17.1 | −4.8 | | choir (bar 12, bar 16) | −21.5 | −7.5 |
| hats | −29.2 | −10.8 | | choir-far (bars 1–4) | −22.7 | −14.0 |
| toll | −25.8 | −9.5 | | room / room-far | −30.3 / −35.7 | −13.4 / −24.7 |
| clank | −33.2 | −18.3 | | | | |

The far/near pairs (`reed-far` and `reed`, and so on) are the same rack stem on two tracks. One is filtered for the intro,
and they hand over in the silent half beat before bar 5.

## The QA/fix pass

**Before the first master.** Balance was set from per-stem loudness measured on a calibration render, the composer's
stand-in for ears:
- hats +7 dB, clank +6 dB, snare +3 dB, toll +2 dB;
- reed and the intro (far) parts +3 dB, room +5 to +6 dB, master +1 dB;
- bar-12 choir −4.5 dB.

**QA measurements on the first master** ([`qa/measure.py`](qa/measure.py), results in
[`delivery/provenance/qa.json`](delivery/provenance/qa.json)):
- **Kick vs 808, first 40 ms of every kick:** the kick leads the 808 by a median 5.4 dB at 80–200 Hz and 12.3 dB at 1–5 kHz. The 808 leads below 80 Hz (median −3.1 dB).
- **Low end:** mono, with L/R correlation 0.9993 below 120 Hz.
- **Tuning:** the 808 is within 2 cents on every checked note, and the reed's held notes within 3.5 cents.
- **Clicks:** none in the 808, reed, choir, room or bell. The single flagged master transient is an intended kick click.

**Fixed (levels and automation only; notes and form unchanged):**

| Found | Change | Result |
|---|---|---|
| In bars 13–14 the grittier 808 cut the hook's lead to +0.9 dB (300 Hz–1 kHz) and +2.4 dB (1–4 kHz) | 808 low-pass at 1.6 kHz after its saturation; reed +1 dB makeup and +1.5 dB from bar 13 | +2.7 / +4.7 dB; +4.3 to +9.1 dB elsewhere |
| The bar-12 tape stop was faded from its first frame, so little of the dive was heard | Fade starts 0.2 beat later and still ends before the gate closes, where the bass would spring back | The first 0.2 beat of the dive is at full level |
| Master after the fixes | | −13.2 → −13.04 LUFS; true peak −2.16 → −2.15 dBTP |

## Things only listening can decide

- Is the hook memorable after one play? Does the "through the wall" intro help it, or delay it?
- The reed is an unapproved physical model. Does it read as a human player?
- Does the bar-12 major answer feel like light in the same song, or like a different song? Do the voices sound like people?
- The kick's skin punch peaks about 18 ms after the click. Is the kick tight enough?
- Are the hats and clank too quiet, and is the intro too quiet against the drop (about 5.4 dB)?
- Is the 808 weight right on both a full system and a phone?

## Rebuild

```bash
node experiments/concrete-gospel-001/build.ts
```

```bash
node experiments/concrete-gospel-001/deliver.ts
```

```bash
python3 -I experiments/concrete-gospel-001/qa/measure.py experiments/concrete-gospel-001/build
```

`build.ts` runs the whole pipeline in about 45 s:
1. [`compose.ts`](compose.ts) writes [`source/`](source).
2. The rack renders the reed, choir, 808 and kick layers, with the Timbre Lab registered through `--import`.
3. An isolated engine project is assembled in `build/project`. It holds copies of the V12 WAVs and the rack stems, so
   nothing is referenced outside it.
4. The engine renders it.

The QA script is analysis only and needs numpy, scipy and FFmpeg. `build/` is ignored by git. Run the QA script before
`deliver.ts` to include `qa.json` in the delivery.

| Path | Contents |
|---|---|
| `compose.ts` | The composition: hook, choir, grooves, drums, automation, mix. The single source of truth |
| `source/` | Generated rack score, engine project and the two small kits |
| `delivery/` | Master, MP3, stems, `provenance/` (engine manifest and analysis, rack manifest and expanded performance, QA record), `SHA256SUMS` |

Stopped here for the listening review. No extended arrangement until the owner asks.
