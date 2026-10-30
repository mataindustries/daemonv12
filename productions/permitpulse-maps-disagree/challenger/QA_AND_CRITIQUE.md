# Challenger C3: audio QA, comparison with V3, and self-critique

**Read this first:** no one has heard this music yet. I can't listen. Everything below is either
**measured** (DaemonV12 analysis, FFmpeg, section/phone-band scripts) or **reasoned** from the
score and spectrograms. Measurements can show that a moment is louder, brighter, wider or exactly
in sync. They can't show that it is beautiful, memorable or worth replaying. Nothing here claims
S-tier. The owner's listening decides.

## 1. Delivery QA (measured)

| Check | Result |
|---|---|
| Length | 48k/24 master and all 12 stems exactly **1,344,000 frames = 28.000 s**; engine master exactly 1,234,800 frames @ 44.1 kHz |
| Loudness | **−15.6 LUFS** integrated (engine −15.69); V3 is −15.6, so the A/B is loudness-matched |
| True peak | **−2.0 dBTP** at 48 kHz (engine −1.93); sample peak −1.97 dBFS |
| Clipping | 0 clipped samples on all 12 tracks and the master (manifest overload counters). C2 clipped once at 21.5; fixed in C3 |
| Dynamics | LRA 1.9–2.0 LU. The short-term range is narrow, but the section contrast is large: build climax −16.7 → gap −26.8 dB RMS → cut −17.5 |
| Boundaries | First sample 0 (engine); last 50 ms below −53.8 dBFS; last sample −65 dBFS. The final-bar choir wash and its reverb tail were removed in C3 for this |
| Clicks | High-slope events are designed transients (gap ticks at 13.27–13.53, gear toks at 2.0). Every voice released at the 13.2 stop uses an 8 ms ramp |
| DC | −67 dBFS (a 20 Hz master high-pass was added in C3) |
| Mono | Correlation 0.85; mono fold-down RMS −0.35 dB against stereo, so no cancellation. Width comes from different content per side (choir singers, per-note key panning, decorrelated snare and hat noise) |
| Sync | 18 of 18 cue events land on their exact engine sample frame (0.000 ms error) |
| Determinism | Second render of C3 into a fresh directory: master and all 12 stems **byte-identical**. C1, C2, Audition A and Audition B also re-render byte-identically from the current sources |

### Section evidence (C3)

| Section | Full RMS dB | Phone-band RMS dB | Mid 0.5–2 kHz | Sub 20–120 Hz | Side % |
|---|---|---|---|---|---|
| hook 0–1.6 | −17.9 | −20.6 | −20.2 | −24.8 | 6.1 |
| groove 1.6–5.5 | −18.1 | −21.9 | −22.0 | −23.4 | 4.5 |
| tilt 6.8–9.0 | −16.6 | **−18.8** | −18.9 | −24.7 | 5.9 |
| climax 11.2–13.2 | −16.7 | −20.2 | −20.5 | −22.8 | 6.0 |
| **gap 13.2–13.667** | **−26.8** | −29.1 | −29.7 | −41.5 | 21.0 |
| **cut 13.667–15** | −17.5 | −19.8 | −19.1 | −23.8 | **11.9** |
| reveal 15–17.4 | −18.3 | −23.5 | −24.5 | −21.3 | 9.2 |
| card 17.4–21 | −17.7 | −21.1 | −20.8 | −22.4 | 8.1 |
| payoff 21–23.6 | −16.5 | −21.0 | −21.4 | −20.5 | 10.6 |
| CTA 23.6–24.8 | −17.6 | −19.9 | −20.0 | −26.2 | 10.0 |
| afterglow 24.8–28 | −18.7 | −22.9 | −25.2 | −25.1 | 7.7 |

The phone band is a 280 Hz 4th-order high-pass plus a 9 kHz low-pass, in mono: a crude stand-in
for a phone speaker, not a measurement of one. A quiet-volume proxy (300 Hz–3.4 kHz telephone band)
puts the hook at −20.4 dB, 2.1 dB stronger than V3.

## 2. Challenger C3 vs V3 (same loudness)

| Measure | V3 | C3 |
|---|---|---|
| Spectral onsets in the first 2 s | 9 | **33** |
| Hook: sub band minus 0.5–2 kHz band | +5.0 dB (bass-led) | **−7.1 dB** (midrange-led) |
| Phone band, first 0.8 s | −20.2 | **−19.2** |
| Phone band, build peak 12.0–13.2 | −22.9 | **−20.5** |
| Phone band, 0.8 s after the cut | **−19.4** | −20.2 |
| Phone band, NEVER GUESS 21.5–22.3 | −22.4 | **−19.5** |
| Phone band, CTA 23.6–24.4 | −22.7 | **−19.5** |
| Drop into the cut (build → gap) | none (synchronous stop) | **11.2 dB** silence before frame 820 |
| Payoff vs cut on phone (0.8 s windows) | payoff 3 dB *weaker* than the cut | payoff 0.7 dB *stronger* than the cut |
| Whole-piece side energy | 5.0 % | 7.7 % |
| Research brief, telephone band | −27.5 (very discreet) | −23.2 (more present) |

What changed musically: V3 illustrated the story with symbols (glass motif, F vs F#, heartbeat,
clean bell). C3 is a groove track with a singing lead, and the picture events are part of
the groove. The landing is a downbeat, the seat a pickup, the disagreement a change of meter, the cut a
change of tempo, the tagline the hook's long note.

## 3. Version log

**Auditions (8 s each).** A beat B on immediacy (10 against 3.75 onsets/s; −21.0 against −25.5 dB phone level
at the start) and on distinctiveness (a vocal gesture rather than an arp archetype). A's weaknesses: a phone dip
of 8 dB in bar 2, buried hats and snare, a long kick tail.

**C1: first full score.** Six-dimension critique:
1. *Hook:* right gestures from frame 0, but the hook bar was the quietest groove section.
2. *Memorability:* good; six recognisable statements of the hook.
3. *Groove:* weak. The snare sat about 10 dB under the kick and the hats at −43 LUFS.
4. *Originality:* voice, acid bass and gear toks distinctive; the reveal's keys arp generic.
5. *Payoff:* poor on phone. The cut (−24.7) and NEVER GUESS (−21.9) were under the build (−21.5). The reveal was sub-dominated and narrower than the groove.
6. *Picture:* exact; the mid-word stop and the GUESS landing worked.

**C2: substantive revision.** A wide, bright D♭maj9 bloom on the cut (open 'a' vowel, five singers a
side) with a chime stab panned across, and a faint reversed bloom leaking in during the gap. Keys panned per note.
Sub −9 dB; snare +6 dB, hats +4 dB, toks +3 dB. A harmonised major-third WAAH at 21.5 and at the
CTA. *Result:* cut on phone −24.7 → −21.1 (now equal to the climax), cut-section side energy 3.1 % → 11.4 %,
CTA −23.6 → −20.4. *But:* NEVER GUESS was still under the cut on phone, and the master clipped once at 21.5.

**C3: production challenger.** Hypothesis: *the payoff must be the strongest phone moment without clipping.*
Changes: a bright upper wide-choir voicing, the arp returning in F major, open offbeat hats (a real chorus
lift), and the coinciding landing kick and big snare reduced. A fast 2.5:1 master glue compressor
trims about 2.5 dB of stacked-transient crest, with makeup set to V3's loudness. QA fixes: the last bar
became a dry rhythmic ending (the master was at −36 dBFS on its final sample); a 20 Hz master high-pass
for DC; the brand-cut zip moved onto frame 1260. *Result:* GUESS −19.5 ≥ cut −20.2 on phone, no clipping,
clean boundary.

## 4. Aggressive self-critique of C3

1. **Immediate hook strength.** *Measured:* 33 onsets in 2 s, midrange-led, and one of the strongest
   phone-band moments of the piece (−19.2 dB in the first 0.8 s). *Unknown:* whether the formant "machine voice" sounds charismatic or cheap.
   It is a synthesized vowel-filter buzz, not a sung voice. If it reads as a novelty robot, the
   whole concept weakens, because the voice is the identity. **This is the first thing to judge by ear.**
2. **Memorability.** The hook is short (*wa-da-WAAH … do-DOOO*) and returns in six forms: minor, climbing,
   cut off on the dominant, augmented over D♭maj9, major on NEVER GUESS, and as the CTA signature. That is
   consequential repetition by design, but 28 s holds a lot of it.
3. **Groove.** A 3-3-2 acid riff against a half-time backbeat with escapement ticks should move the body.
   Risk: the mechanical clap and hats are synthesized from noise and modal partials and may sound thin
   next to the bass. The triplet tilt at 6.8 may read as *wrong* rather than *exciting* to some ears.
   That is intended, but untested.
4. **Originality.** No reference track was used and every sound was built for this piece. The
   ingredients (acid bass, half-time groove, vocal chops) are familiar; the identity rests on how
   they combine with the picture.
5. **Escalation and payoff.**
   - *Strongest ideas:* the mid-word stop with a ticking gap, the metric modulation (the conflict's
     triplet becomes the new pulse), and the minor hook revealed as a major-seventh melody.
   - *Weakest link:* section II. The reveal keeps the voice singing during reading time. It is louder in
     the telephone band than V3 (−23.2 against −27.5), so it may compete with the research brief.
   - *Payoff:* F major arriving exactly on the hook's long note is inevitable in hindsight. Whether it
     feels *cathartic* or just *bright* depends on the voice timbre.
   - Section-level phone RMS still favours the cut window (−19.8) over the whole payoff window (−21.0),
     because the payoff window includes the pickup. At the moment itself GUESS is stronger.
6. **Integration with picture.** All hits are frame-exact and musical: downbeat, pickup, meter change,
   tempo change, long note. Open question: the 0.47 s stop before frame 820 happens while the camera is
   still moving. It should feel like a held breath, but it could feel like a dropout.

**Engine and production limits:**
- DaemonV12 has no limiter, EQ or synthesis engine, so instruments are rendered offline per note.
- 16-bit / 44.1 kHz engine output; the 24-bit / 48 kHz files are conversions.
- The narrow LRA comes from the glue compressor and the dense groove; the large section contrasts are compositional.

## 5. Questions only a human listen can answer

1. Does the first second (0.0–1.0) make you stop scrolling, or does the voice sound like a gimmick?
2. Is *wa-da-WAAH … do-DOOO* still in your head after one listen?
3. Does the 6.8 triplet tilt feel exciting or just wrong?
4. Does the 13.2 stop plus ticking gap feel like a held breath, and does the 13.667 bloom feel like a reveal?
5. Is the 112.5 BPM reveal pleasant to read over, or does the singing get in the way of the brief?
6. Does NEVER GUESS at 21.5 feel like catharsis, and does the CTA *wa-da-WAAH* work as a reusable sonic logo?
7. On a real phone, are the clap, ticks and toks audible, or does only the voice survive?
8. Looped, does 28.0 → 0.0 make you want to hear it again?

If the answer to (1) is no, the fix is a different lead timbre, not a mix change. The score, picture
sync and form are independent of the voice instrument (`synth/instruments.ts`, `voice()`).
