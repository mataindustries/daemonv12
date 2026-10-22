# MORPH//03 review: diagnosis, revisions, measurements

**I could not listen.** Every judgement below is a measurement (`analyze.py`, `checks.py`,
pitch tracking, spectrogram inspection) or a design intention. Proxy numbers catch
engineering faults (masking, mistuning, seams, over-limiting). They can't tell whether
something is fun, heavy or worth replaying; that is the checkpoint's job.

## From the feedback to a design

| Feedback | What it meant for the design |
|---|---|
| C, the dispersive cable, is the favourite and should become the identity | Keep the physics: the round trip is tension, so rhythm and pitch are one control, and every reflection is a dispersive chirp. Build the bass *out of* it, not around it. |
| B: keep the playfulness, percussion and accessibility | Reuse B's kit and the alarm hook in loop 3; four-on-the-floor with swing. |
| A was too safe: wanted aggressive wobbles, growls, surprising transformations | Replace the singing voice with a Beast whose vocal folds are the bowed cable and whose wobbles are mouth movements; add broken gestures. |

What MORPH//02 C lacked as a bass instrument (from its source and renders):
- **Organ-like body:** its pitched section was one bowed, self-oscillating tone shaped
  only by palm mutes and re-plucks.
- **No dynamics in the tone:** strike force changed loudness, not pitch or timbre.
- **Identity lost on landing:** dispersion was turned down to −0.2 when the cable became
  pitched, so the chirp character all but disappeared exactly when the bass started.
- **Latent engine faults**, found here:
  - the delay length stepped every 16 samples (zipper tones during fast tension changes);
  - a 12 Hz in-loop DC blocker that stops a low E1 from being bowed reliably.

New articulations in `cable.mjs` address the expressive gaps: force-dependent stretch,
laser zaps, contact buzz, flageolet pops, a physical palm mute, constant-force bow (see
the README table).

## Loop 1 — CABLE BASS

| Revision | Diagnosed weakness (measured) | Change | Result (measured) |
|---|---|---|---|
| 1 | Energy-driven tension left every riff note 1–2.5 semitones sharp; saturation kept the loop energy high, so notes never settled | Strike "stretch": tension rises with hit force and relaxes in 70 ms | Slaps dive about +3 to +5 semitones and settle; plucks within ±25 c |
| 1 | A whistle at about 2.87 kHz trapped in the loop after the snap | Ablation traced it to zipper stepping (multiples of 44100/16 Hz); delay and dispersion now ramp per sample | Tone at −72 dB relative (was −21 dB) |
| 1 | Loop seam: reverb LFO phases jumped at the wrap | LFOs locked to whole cycles per loop | Circular reverb matches the true periodic steady state within 1.3e−6 |
| 2 | Riff only had 3.5 s of 8; infrasonic sweep from the snap dive (2.3% below 30 Hz) | Tightening moved to 1.5–2.5 s; 4th-order 30 Hz high-pass on the sub path | Riff from 4.0 s with a 1.5 s pickup; below 20 Hz now 0.001% |
| 2 | Palm mutes killed the fundamental, so the riff measured 2–5 LU under its own pickup | A mute now darkens fast but keeps the fundamental's thump | Riff within about 1–5 LU of the pickup |
| 2 | Limiter up to 2.9 dB, active 4.3% of the time | Oversampled soft clip on the bass bus | Limiter 0 dB; master soft-clip touches 0.11% of samples (≤ 0.55 dB) |
| 3 | The dispersive "pew" identity vanished inside the riff | "Zap": each onset briefly deepens dispersion | 500 Hz–2 kHz share 15.7 → 20.7%; phone drop −4.1 → −3.2 LU; pitch still settles |
| 4 | Plucks still about +10–20 c sharp at 80 ms | Pluck stretch halved | Plucks and pops +0–10 c (mid band, 80 ms) |

**Listen for:**
- the bar-1 reflections and 3:4 answer;
- the accelerando at 1.5 s;
- triplet "talk" at 2.5 s;
- slap dives at 4.0 and 6.0 s;
- octave pops at 4.375 and 6.375 s;
- the tritone re-tension at 6.875 s and the twelfth pop at 7.0 s;
- the snap at 7.5 s and how it loops.

**Risks:**
- It's a solo instrument (plus anchor thumps), so the groove may feel loose without drums.
- Slaps intentionally start about 5 semitones sharp.

## Loop 2 — THE WOBBLE BEAST

| Revision | Diagnosed weakness (measured) | Change | Result (measured) |
|---|---|---|---|
| 1 | The Beast's first answer was nearly silent (stem mean −75 dB) | Two bugs. Answer 1's cells were in the wrong time units. The bow couldn't sustain E1 (the 12 Hz DC blocker cost 0.34 dB per round trip). Fixed the score; 5 Hz blocker plus constant-force bow | Both answers present (stem means −45 / −46 dB) |
| 1 | Vowels smeared: fold distortion after the throat turned formant motion into intermodulation | Distort the "vocal folds" (the cable) before the throat; only light saturation after | Stem wobble depth 24–41 dB across the formant bands (dry prototype: 22–35) |
| 1 | Loop seam jump 5.7× the local step (kick click starting on sample 0) | 0.3 ms ramp on the click | Seam 0.13× the local step |
| 2 | 90% of energy below 150 Hz; the kick carried 8–11 dB more low energy than both basses | Punchy 0.13 s / 50 Hz kick; subs duck under kicks; mouth +3.5 dB | Below 150 Hz 65%; 150 Hz–2 kHz 27% (was 8%) |
| 2 | Answer 2's wobble masked by the snapped caller's reflections (mix depth about 16 dB) | Caller dies faster after the snap and ducks under the mouth's envelope | Mix wobble depth 20–28 dB in both answers |
| 2 | Limiter up to 5.2 dB | Per-bus soft clips, master knee clip on the top 3 dB | Limiter 0.57 dB, 0% of time above 1 dB |
| 3 | Caller notes lacked the zap identity | Zap onsets on the caller | Phone drop −7.4 (draft 1) → −2.7 LU |

**Listen for:**
- **Answer 1:** WOM at 2.0 s, wa-wa at 2.5 s, ya-ya-ya triplets at 3.0 s, yoi and choke
  at 3.5 s.
- **Answer 2:** quintuplet chokes at 6.0 s, EEE-YOOW octave dive at 6.5 s, 3+3+2 wobs at
  7.0 s, glitch at 7.84 s, gasp at 7.95 s.
- **Caller:** the question bend at 1.5 s and the snap at 5.5 s.

**Risks:**
- A physical throat gives monstrous, breathy vowels rather than a clean talk-box; it may
  read as "creature", not "bass".
- The glitch is brief (0.15 s).

## Loop 3 — THE GROOVE

| Revision | Diagnosed weakness (measured) | Change | Result (measured) |
|---|---|---|---|
| 1 | Kick dominated (61% of energy at 60–150 Hz); the bar-3 surprise was masked; phone drop −5.3 LU | Kick −3 dB, bass +1.5 dB, two kicks removed under the descent, beeps louder | Phone drop −3.3 LU; bar 3 dips 3–4 LU, then the bass takes over |
| 2 | The "fall" didn't sink: each beep kept the same bright 3.15 kHz housing resonance | Housing resonance scales down with depth; the last beep falls exactly onto the cable's B1 | Beep spectral centroid 3270 → 1615 → 1256 → 999 → 553 → 452 Hz |
| 3 | Masking: on 6 of 13 kicks the bass sub was within 3 dB of the kick's sub (ghost notes on kicks) | Ghosts moved off kicks; sidechain depth 55 → 75% | Kick leads bass sub by a median of 10.6 dB (worst 2.3 dB, at the intentional unison downbeat) |
| 3 | Bass articulation lacked the cable's identity | Zap onsets | Phone drop −2.8 LU; 150 Hz–2 kHz 28% |

**Listen for:**
- the alarm/bass hocket in bar 1;
- the punchline at 3.0–3.6 s (POP, CLANK, wrong note, F→E slide, stutter);
- **the well, 4.0–5.2 s**;
- the bass taking the hook at 5.1 s and finding the F at 5.75 s;
- the dive under the DING at 7.5–8 s, then the loop turning over.

**Risks:**
- It's busy: hats, ticks, beeps and bass in the same 4 kHz.
- Four-on-the-floor plus swing is accessible but conventional; the surprise has to carry
  the novelty.

## Final measurements

| | 1 CABLE BASS | 2 WOBBLE BEAST | 3 THE GROOVE | MORPH//02 C (ref) |
|---|---:|---:|---:|---:|
| Integrated loudness | −13.9 LUFS | −13.9 LUFS | −13.9 LUFS | −15.2 LUFS |
| True peak | −1.7 dBTP | −1.5 dBTP | −1.5 dBTP | −1.1 dBTP |
| Peak-to-loudness | 12.2 dB | 12.4 dB | 12.4 dB | 14.1 dB |
| Momentary spread (P95−P10) | 6.0 LU | 6.8 LU | 3.9 LU | 8.5 LU |
| Energy < 150 / 150–2k / > 2k Hz | 72 / 25 / 2.3% | 65 / 27 / 8.1% | 62 / 28 / 10.2% | 48 / 47 / 5.2% |
| Phone-speaker drop (HP 300 Hz) | −3.4 LU | −2.7 LU | −2.8 LU | −2.6 LU |
| Mono fold-down loss (low / mid / high) | 0.01 / 0.06 / 0.12 dB | 0.00 / 0.18 / 0.10 dB | 0.00 / 0.08 / 0.11 dB | 0.02 / 0.32 / 0.34 dB |
| Infrasound < 20 Hz | 0.001% | 0.009% | 0.0003% | 0.17% |
| Loop seam (join step ÷ local median step) | 1.26 | 0.13 | 1.32 | not a loop |
| Limiter max / time above 1 dB | 0 dB / 0% | 0.57 dB / 0% | 0 dB / 0% | 3.8 dB (MORPH//02 notes) |
| Master soft-clip activity | 0.11% (≤ 0.55 dB) | 0.17% (≤ 1.8 dB) | 0.02% (≤ 0.39 dB) | none |

- **Seam:** a ratio near 1 means the join looks like any other sample step.
- **Phone proxy:** with nothing below 300 Hz, the riff's notes still pitch-track to within
  45 cents at 80 ms (most within 20 cents), so the bass line's periodicity survives in its
  upper harmonics.
- **Source data:** `audio/analysis.json` and `audio/checks.json` hold the full numbers.

## For the checkpoint

These are proposals for what to listen for, not conclusions:
1. **The keeper sounds?** Candidates:
   - slap dive (loop 1, 4.0 s);
   - zap onsets;
   - flageolet octave pop (4.375 s);
   - bowed triplet talk (2.5 s);
   - snap into reflections (7.5 s);
   - the Beast's WOM, yoi-choke or quintuplet chokes (loop 2);
   - the falling alarm (loop 3, 4.0 s).
2. **Does the Beast read as a voice-like wobble, or as noise?** If noise, the next step is
   a cleaner throat (lower metal, less fold) rather than more modulation.
3. **Does the cable riff need drums?** Loop 1 is deliberately solo; loop 3 shows it with
   the kit.
4. **For the 24-second piece:** all three share 120 BPM, E, and exact 4-bar loops. They can
   be chained, or their strongest gestures recombined, without retiming.
