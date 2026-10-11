# MODEL
Not recorded in repository artifacts. The model identity is given in the chat report for this submission.

# CONFIGURATION
Highest available effort, as requested by the brief. Not independently verified from inside the run.

# ROUND
DaemonV12 Ultimate Beat Battle — Round 1 Open Class

# ENGINE COMMIT
`ed75e9e2a0172266e56b292886ad7c1500677862` (DaemonV12 0.6.0). Checked with `git rev-parse HEAD` before composing. No engine file was edited, pulled, merged, or rebased.

# TRACK TITLE
**Idle Hymn**

# CREATIVE CONCEPT
A machine has been left idling and wakes up. The first sound is not a groove but a hymn: a metal-tine call with a slightly wrong note in it (a B-flat grace against the A tonic, the sound of a machine not quite warmed up). Machine ticks and a mechanical kick come in under it. A riser climbs over a dominant E chord until the machine stops for a breath, then the hymn returns an octave up with the full kit and an impact. The piece then winds down: the last tine tape-stops, the bass falls to A, the drone fades, and the record ends on one A2.

# WHY IT SHOULD BE REPLAYABLE
- The first 2.4 seconds contain a complete, memorable call with a built-in wrong note. The Bb grace is the thing a listener will want to hear again.
- The call returns in three harmonic colours (A minor, F, G), so the same contour is re-heard in new context rather than looped.
- The break is a real event: the groove drops out, a riser climbs, and there is silence before the impact.
- It ends on the tonic through a tape stop rather than a fade into nothing.
- At 28.8 seconds it is short enough to replay several times in a row.

# HOOK
Custom metal tine (benchmark-local sample, native A4) played as a sampler:

- Call: A4, Bb4 grace (1/16 after the beat), E5 leap (a fifth up), D5, C5. Bar 2 answers A4, Bb4, G4, A4, then falls to E4.
- Over F (bars 3–4) the leap lands on F5. Over G (bars 5–6) the call rises to G5 and falls back to E4.
- Hook test: the first 4.8 s (bars 1–2) contain the whole call and the bass entry. If everything after that disappeared, the call would still carry the identity.

# RHYTHMIC IDEA
100 BPM, straight sixteenths. Orbital Foundry machine-tick plays eighth notes at velocity 0.65, with off-sixteenths at 0.18–0.32 for a ratchet texture. Kick hits 1, 2 (sixteenth after), 3, and 4 (eighth after). Snare on 2 and 4 with a ghost on the 3-and. Bass is syncopated: a root on 1, a repeat on the 2-and, a third on 3, and an approach note on the 4-and. Bar 6 rolls the ticks up into the break.

# LOW-END DESIGN
- Bass: `tine-bass` (native A2, 0.9 s, short ring). One root per bar, roughly monophonic. The bar-6 bass drops its last note so the tail does not muddy the break.
- Sub: GLASSHOUSE `07-sub-cs.wav`, used only in the payoff (bars 9–10), one hit per bar on A2 and F2. Sub is absent from the verses to avoid a low-frequency wall.
- Drone: Orbital `10-dark-drone.wav`, only in the outro. Its energy is at 110, 165, and 220 Hz, and it glides to half speed as it fades.
- Master highpass at 28 Hz.
- Measured 120 Hz energy share per bar: 0.00–0.18 in the intro, 0.17–0.58 in the groove and payoff. The root tone dominates. No sustained sub wall.

# HARMONY / TONAL DESIGN
Implied chord per bar: Am (1–2), F (3–4), G (5–6), E (7–8, tension), Am (9), F (10), Am (11–12).

The hook pitches fit each chord. F5 sits on F, G5 on G, and E4/E5 supply the dominant colour. The Bb4 grace is the only flat-two. It is always short and against the tonic, so it reads as deliberate tension.

# STRUCTURE
| Bars | Time (s) | Content |
|---|---|---|
| 1 | 0.0–2.4 | Hook call alone. Intro gain −2 dB. |
| 2 | 2.4–4.8 | Hook call; bass root A2; machine ticks. |
| 3–4 | 4.8–9.6 | Groove enters with kick, snare, ticks. Hook over F. Bass F. |
| 5–6 | 9.6–14.4 | Groove. Hook answer over G. Bass G. Bar 6 tick roll into the break. |
| 7–8 | 14.4–19.2 | **Break.** Drums, bass, and hook silent. Riser over E (pitch 0.8→1.2) climbs and ends near 18.5 s, leaving about 0.7 s of silence before the drop. |
| 9–10 | 19.2–24.0 | **Payoff.** Cinematic impact and metal accent on bar 9. Groove returns. Hook an octave up at +3.5 dB, panned on a sweep from −0.45 to +0.45. Sub on A2 and F2. |
| 11–12 | 24.0–28.8 | **Tape stop.** The last tine glides 1→0.25 over a half note. Bass A2, C3, A2. Drums stop. Drone fades from −8 dB to the −60 dB floor by 27.6 s. Final A2 at 26.4 s. |

The break and payoff are the only places where the texture thins to a single element, and both are timed by automation rather than by note density.

# SOUND DESIGN
Benchmark-local generated sounds (`tools/make_assets.py`, seeded numpy, documented in `assets/MANIFEST.json`):

- `assets/tine/tine-hook.wav`: metal tine at A4 (440 Hz). Five inharmonic partials at ratios 1, 2.76, 5.40, 8.93, and 12.7. Fundamental decay 0.30 s. 1.4 s long. A seeded strike click. Peak 0.62.
- `assets/tine/tine-bass.wav`: the same tine at A2 (110 Hz), four partials, shorter decay (0.26 s), 0.9 s long. Peak 0.70.

Shipped sounds, copied byte-identical (SHA-256 in the manifest):

- Orbital Foundry: mechanical kick, industrial snare, machine tick, metallic strike, cinematic impact, tension riser, dark drone (plus a benchmark-local `kit.json` mapping them).
- GLASSHOUSE: `07-sub-cs.wav`.

No external recordings. No shipped packs modified.

Effects, by track:
- tine-hook: highpass 140 Hz, saturation (4 dB, mix 0.15), reverb (room 0.45, decay 1.1 s, wet 0.20).
- tine-bass: highpass 35 Hz, compressor (−18 dB, 3:1, attack 6 ms, release 90 ms, makeup 1 dB).
- drums: highpass 40 Hz, compressor (−12 dB, 4:1, attack 4 ms, release 70 ms, makeup 2 dB), saturation (6 dB, mix 0.2).
- sub: highpass 30 Hz.
- fx riser: reverb (room 0.6, decay 2.0 s, wet 0.30).
- drone: lowpass 260 Hz.
- Master: gain −3 dB; highpass 28 Hz; compressor (−16 dB, 4:1, attack 3 ms, release 100 ms, makeup 2 dB); saturation (2 dB, mix 0.10).

# DAEMONV12 FEATURES USED
- Sampler notes with `playbackRate`: 20 distinct rates from 0.59 to 3.0 (the melody comes from transposing a single native-pitch tine).
- Playback-rate glides: 3 (hook tape stop 1→0.25 over 1/2; riser 0.8→1.2 over 2/1; drone 1→0.5 over 2/1).
- Drum kit: 5 hit names from the copied Orbital kit.
- Gain and pan automation: 5 lanes, 13 points (hook gain 4, hook pan 2, drums gain 2, riser gain 2, drone gain 3).
- Fixed 12-bar container (28.8 s) with `tail: auto`.
- Production effects: highpass, compressor, reverb, saturation, lowpass, plus the master chain.
- Six aligned stems (1,270,080 frames each), MP3 listening copy, analysis, and provenance manifest.

Not used: source offsets (0), General MIDI voices, delay, master ducking, MCP tools.

# ITERATION HISTORY

## V1
**Attempted:** the full 12-bar form at 100 BPM. Tine call from bar 1, groove from bar 3, riser into the break, octave payoff, drone outro.

**Weak:**
- Master clipped: 35 full-scale samples, +0.16 dBTP, at bars 3–5 where hook, bass, and drums sum.
- The octave payoff was quieter than the groove (hook stem about −24 dB vs −19 dB). A 2× playback rate halves each note's length, which lowers the average level.
- Bar 7 carried bass tail from bar 6 (82% low-band share), so the break was muddy.
- Ending near-silent: bar 12 at −55 dB RMS.
- Top end dark: above-4 kHz energy was about 1–2% in every bar.

## V2
**Changed:**
- Hook gain arc: restrained intro, louder payoff.
- Bar-6 bass drops its last note.
- Master gain −3 dB, makeup 0.
- Outro: a two-bar bass cell ending on a final A2 at 12:1.
- Drone fades to the −60 dB floor.

**Result:** clipping reduced to one sample, true peak +0.05 dBTP. The break is now 21–28% near-silent in bars 7–8.

**Still weak:** top end; the groove repeats unchanged for four bars.

## V3
**Changed:**
- Tine partial set extended with a bright 12.7× partial.
- Bar-6 fill rolling the ticks into the break.
- Hook gain ramps linearly from bar 3 to bar 9.
- Master gain −4 dB.

**Result:** no full-scale samples, true peak −0.79 dBTP. But LUFS was −19.9, too quiet for fair comparison, and the top end barely moved.

## V4
**Changed:**
- Master compressor and saturation for glue and presence.
- Eighth-note ticks raised from 0.55 to 0.65 velocity.
- Intro hook −2 dB.
- Tine upper-partial amplitude raised.

**Result:** LUFS −17.95, but true peak +0.24 dBTP with two full-scale samples. The compressor makeup and saturation overshot.

## V5
**Changed:** master gain −3 dB; compressor at −16 dB, 4:1, attack 3 ms, release 100 ms, makeup 2 dB.

**Result:** true peak −2.96 dBTP, no full-scale samples, LUFS −18.9, LRA 9.8. Clean master.

## V6
**Changed:**
- Payoff hook +3.5 dB at bar 9, compensating for the 2× octave copy.
- Drone start −7 dB.

**Result:** payoff now as loud as the groove. But the drone measured only about −45 dB through bar 11.

**Diagnosis:** the cause was my fade curve, not the engine. A dB-linear fade from −7 to −60 dB across 3.6 s drops about 15 dB per second, so the drone was gone after half a second. I also tested automation semantics directly. A static −20 dB combined with automation at −20 dB measured −40 dBFS, so automation replaces static gain as documented; it does not add to it.

## V7
**Changed:**
- Drone fade reshaped: −8 dB at 11:1, −12 dB at 12:1, −60 dB at 12:3.
- Dark-drone pitch corrected. Its spectrum shows A2 (110 Hz) energy, not A1; the earlier A1 estimate was a subharmonic.

**Result:** the drone is audible through bar 11 (−33 dB RMS) and gone by 27.6 s. True peak −2.54 dBTP, LUFS −18.85, zero clipped samples.

## FINAL (locked)
The final WAV is byte-identical to V7. Changes after V7 touched metadata only: the project description, code comments, the asset manifest, and version records.

# FINAL PRODUCTION DECISIONS
- 100 BPM, 12 bars, 28.8 s container with `tail: auto`.
- Peak control by master compressor and −3 dB headroom. No limiter. True peak −2.5 dBTP.
- Sub only in the payoff; drone only in the outro.
- No master ducking, voiceover, or sidechain.
- Stereo movement only from the hook pan sweep in bars 9–10, plus reverb.
- Master loudness −18.9 LUFS, deliberately below a brick-wall target.

# WHAT WORKED
- The break and drop: bars 7–8 are 21% and 14% near-silent. The riser ends before the impact.
- Hook identity: the custom tine and the Bb grace are distinct from the stock General MIDI sounds the brief warns against.
- The ending resolves on the tonic through a tape stop rather than a fade to nothing.
- Engine-level: zero clipped samples, exact 28.8 s length, aligned stems, and byte-identical re-renders.

# KNOWN WEAKNESSES
- Top end is dark. Above-4 kHz energy is 1.4–3.8% per bar. No EQ boost exists in the engine, and saturation was the only brightness tool. It may read dull.
- Loudness is moderate (−18.9 LUFS). It may sound soft beside louder entries.
- Stereo image is narrow: mostly centered, with width only from reverb and the bar 9–10 hook sweep.
- Tine tails overlap at 0.6 s spacing on 1.4 s samples. The Bb grace may smear into A4, and the reverb adds wash.
- The break rests on one riser. The silence before the drop is short, about 0.7 s.
- The octave payoff is brighter but thinner than the groove.
- Sub-bass below about 60 Hz is only in the payoff. The verses rely on kick and tine-bass.
- Melody is all playback-rate transposition of one tine. There are no pitch bends beyond the tape stop, and no vibrato.
- Machine ticks at sixteenth-note density may read as busy.

# THINGS THAT REQUIRE HUMAN LISTENING
I cannot hear the track. Everything above is numerical and analytical. A listener should judge:

1. Does the first call register as identity within 4–6 seconds? Does the Bb4 grace read as intended tension, or as mud?
2. The tine timbre: is it a pleasing metal tine, or harsh and ringing?
3. The groove and its pocket at 100 BPM with ratchet ticks.
4. The break: does the riser plus about 0.7 s of silence feel dramatic?
5. The payoff: does the octave copy feel like a lift?
6. The ending: does the tape stop onto A2 read as deliberate?
7. Overall level and top-end brightness.
8. Whether the 28.8 s length and repetition hold up.
9. Stereo width.

# ENGINE ISSUES ENCOUNTERED
No engine defect was reproduced, and no engine file was changed.

Observations:
- The environment script named in the brief, `$HOME/.daemonv12-round1-env.sh`, was absent. The pinned bootstrap (`scripts/bootstrap-audio-tools.sh`) installed FluidSynth 2.3.7, FFmpeg 6.1.1, and FluidR3_GM.sf2 under `~/.local/share/daemonv12/audio-tools`. The headless wrapper from the brief was not needed: the real FluidSynth binary works with `SDL_AUDIODRIVER=dummy`.
- `npm ci` ran the `prepare` build step. Git status shows no tracked engine files changed.
- The engine's `AUDIO_CLIPPING` warning correctly flagged the V1 master overload.
- Sampler voices have no note-off and no duration. Voice length is set by the source WAV, so tape stops and tails are limited by sample length. This is documented behaviour and shaped the design; it is not a defect.
- Automation semantics verified: values replace the static mix, as documented.
- The dark-drone pitch estimate from autocorrelation (A1) was a subharmonic error in my own analysis, corrected from the spectrum.

# DETERMINISM
- The engine commit is fixed. The final project was rendered twice, and the two renders are byte-identical for the master WAV, MP3, MIDI, render manifest, analysis JSON, and all six stems. SHA-256 values are in `OUTPUTS.md`.
- The benchmark-local sounds regenerate deterministically (seeded numpy). `assets/MANIFEST.json` lists their hashes and the copied shipped assets' hashes.
- Final render time on this container: about 17 seconds.
