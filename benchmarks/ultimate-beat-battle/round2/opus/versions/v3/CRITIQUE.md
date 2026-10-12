# V3 result and critique

## What V3 changed (responding to the V2 critique)

1. Bars 5–6: the sub now **interrupts** the call (dives on step 7) and the voice finishes its
   phrase late on step 9; pixel-hat ghosts join. Bars 5–6 are no longer a copy of 3–4.
2. Payoff: new `twin` track — the voice an octave higher, diving on the opposite side
   (pan +0.6) while the main voice sits at −0.45; halo raised in the payoff.
3. Ending: bar 15 pulls the drums out after beat 2 (ticks only under the held D), then bar
   16 ends on the *answer gesture* sung by voice, growl and sub together (octave dives),
   with kick/clap/snare and the tuned steel. 16-bar container kept for in-tempo loop-back.

## Comparison V2 → V3 (`analysis/v2-report.json` vs `v3-report.json`)

| Window | V2 | V3 |
|---|---|---|
| exit bar 16: RMS / crest | −18.7 dB / 15.2 dB | −21.8 dB / 19.2 dB (a gesture, not a sustain) |
| last 3 s: RMS | −19.4 dB | −21.6 dB; boundary −93 dBFS, last sample 0 |
| payoff b10–13: corr / side-mid | 0.98 / −19.4 dB | 0.96 / −17.2 dB |
| integrated / LRA / true peak | −17.35 LUFS / 2.7 LU / −3.23 dBTP | −17.30 LUFS / 3.7 LU / −2.59 dBTP |

Click scan (per stem, |Δx| vs 5 ms local median): only the machine tick's designed contact
transient and the vowel bass's steepest waveform edge (equal to its source's 99.9th
percentile) are flagged; every automation step lands on a silent or sounding-onset frame.
Kept: all three changes.

## Three weakest musical results in V3

1. **The twin is too quiet to widen or brighten the payoff (bars 10–13).** Evidence: twin stem
   −40.0 dB RMS in the payoff, 12 dB below the main voice (−28.4 dB); payoff correlation only
   moved 0.98→0.96; payoff upper-mid (−3 dB) is still no higher than the groove (−2 dB).
   Cause: −7 dB track gain, 0.7 velocity and a 400 Hz high-pass on a source already pitched
   up two octaves. Change: make the twin a real partner (≈ +6 dB), so the answer is heard as
   an octave pair split across the image.

2. **The convergence (bars 14–15) is smaller and narrower than the payoff it should crown.**
   Evidence: RMS −18.2 dB vs −17.5 dB in the payoff; correlation returns to 1.00 (side/mid
   −27 dB) the moment bar 14 starts; upper-mid −5 dB vs −3 dB. The thesis's resolution —
   call and answer together — currently sounds like a step back. Cause: all three unison
   voices are centred and the twin stops at bar 13. Change: twin sings the convergence call
   an octave above (right) with the voice slightly left, so the final statement spans three
   octaves and keeps the payoff's width; the twin also joins the final dive.

3. **Cinematic tension is nearly absent before the build (0–10.75 s).** Evidence: halo stem
   −42 dB RMS in bars 1–2 and −71 dB (tail only) in bars 3–6; it only becomes audible in the
   build (−35.5 dB). One of the five ingredients therefore lives in a section instead of the
   record's language. Cause: one quiet halo strike at bar 1, nothing in bars 3–6, and the
   halo's G5 fuses with the voice's own second harmonic (784 Hz). Change: re-voice the halo an
   octave up (G6/A♭6, above the hook's partials) and let it breathe once per two-bar phrase
   through bars 1–6, so the minor-second tension is always present but never masks the call.
