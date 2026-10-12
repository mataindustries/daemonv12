# V2 result and critique

## What V2 changed (responding to the V1 critique)

1. Shuffle made audible and performed: ticks +7 dB with accent/ghost shape, offbeat steel
   open hat moved to its own track, metallic strike retuned to D6 (rate 0.98444) and raised
   +7 dB so the steel reply is a real third voice from bar 1.
2. Payoff: vowel bass +6 dB with heavier saturation and an open low-pass; full-band hit on
   the payoff downbeat (strike + clap + boom); voice answers and hats/open hats pan apart
   only from bar 10.
3. Build bass: the sustained pedal replaced by short hits; in bar 8 the sub joins the gear
   cycle and climbs G–B♭–A♭–C–D into the stall.

## Comparison V1 → V2 (same windows, `analysis/v1-report.json` vs `v2-report.json`)

| Window | V1 RMS / upper-mid | V2 RMS / upper-mid |
|---|---|---|
| build b7–8 | −16.9 dB / −3 dB | −18.5 dB / −2 dB |
| payoff entry (b10 beat 1) | −15.9 dB / −14 dB | −15.5 dB / −5 dB |
| payoff b10–13 | −17.9 dB / −3 dB, flux 8.6 | −17.5 dB / −3 dB, flux 10.9 |
| sub stem in build | −17.4 dB | −20.2 dB |

Kept: all three changes. The payoff is now the loudest, most transient section and its first
beat carries upper-mid; the build no longer pre-spends the low end. No track or master
overload (manifest `clippedSamples` 0 everywhere), true peak −3.23 dBTP.

## Three weakest musical results in V2

1. **Bars 5–6 (7.16–10.75 s) are a third identical statement of the call/answer.** Evidence:
   the voice and sub note lists of bars 5–6 are identical to bars 3–4 (checked
   programmatically); bars 1–6 voice stem RMS is flat (−24.8 dB in both windows). By 10.7 s
   the listener has heard the same two-bar exchange three times; only a quiet metal hit
   changed. Cause: development deferred entirely to the build. Change: change the
   conversation's consequence — the sub *interrupts* the call (answers on step 7, before
   the third note), and the voice finishes its phrase late. This flips the order, adds
   displacement that still lands on the 2-step, and foreshadows the payoff's role swap.

2. **The payoff gets bigger only in the low end and stays mono (bars 10–13).** Evidence:
   payoff L/R correlation 0.98 (side/mid −19.4 dB); upper-mid −3 dB, the same as the groove
   section (−2 dB) while the low band rose 7→11 dB. Cause: balance-panning mono sources
   moves them but cannot create width (each source stays perfectly correlated L/R), and no
   higher register arrives. Change: a second voice that dives an octave higher on the
   opposite side (different content per side = real width and a new top register),
   louder stereo halo in the payoff.

3. **The ending is a static held chord after a weak cadence (25.7–28.66 s).** Evidence: the
   rise call reaches D at bar 15 step 7, then 0.8 s of drums only, then a unison G held at
   constant level for ~1.0 s (band lanes flat 26.87–27.85 s) and a 0.8 s voice/reverb tail.
   The last gesture is a sustain, not a musical event, so the restart has nothing to
   answer. Cause: "unison hit" implemented as long variants. Change: pull the drums out on
   bar 15 beats 3–4, then end on the *answer gesture* — every voice dives together once —
   leaving the tuned steel ring and voice echo as the tail, with the 16-bar length kept so
   a loop restarts in tempo on the call.
