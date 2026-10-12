# V4 result and critique

## What V4 changed (responding to the V3 critique)

1. Twin raised to a real partner (−7 → −1 dB, velocity 0.85, high-pass 300 Hz).
2. Convergence: the twin sings the call an octave above (right), the voice sits at −0.3,
   the twin joins the bar-14 dive and the final dive — the call now spans three octaves.
3. Halo re-voiced an octave up (G6/A♭6 via rate 2 and 2.118926) and re-struck at bars 1, 3,
   5, 7, 8 so the minor-second tension breathes through the whole first half.

## Comparison V3 → V4 (`analysis/v3-report.json` vs `v4-report.json`; >1 kHz width ad hoc)

| Window | V3 | V4 |
|---|---|---|
| payoff: corr / side-mid / upper-mid | 0.96 / −17.2 dB / −3 dB | 0.96 / −16.5 dB / −2 dB |
| payoff >1 kHz corr | 0.84 | 0.79 |
| convergence: corr / side-mid / upper-mid | 1.00 / −27.2 dB / −5 dB | 0.97 / −18.1 dB / −3 dB |
| twin stem in payoff / convergence | −40.0 / −96.9 dB | −32.3 / −27.1 dB |
| halo stem in groove b3–6 | −71.1 dB | −42.1 dB |
| true peak | −2.59 dBTP | −1.41 dBTP (loudest peaks now convergence downbeats and final dive) |

Kept: all three. Final-check passes on V4 (first 5 s, payoff, final 3 s, click scan) are in
`NOTES.md`.

## Remaining weakness found in the V4 checks (one, evidence-backed)

**Kick punch is masked on every payoff/convergence downbeat (bars 9–16).** Evidence: in the
first 60 ms after each downbeat, 35–130 Hz energy of sub+growl is −12.9 dB vs the kick's
−19.0 dB (bars 10–15); in the groove the same windows show the kick alone (bass −95 to
−120 dB). The bass call now *starts* on the kick, so the transient the payoff needs most is
6 dB under the bass. Cause: the role swap puts the bass on step 1; samples have no choke or
sidechain. Change: a manual sidechain — gain automation ducking sub and growl ~9 dB at each
coincident kick, recovering linearly over a thirty-second note — so kick → bass becomes a
handoff with an audible pump. Also trim the master −1 dB for true-peak headroom
(delivery decision, not counted as a musical change).

Two observations deliberately **not** acted on: (a) payoff RMS is only +2.4 dB over the
groove — its size comes from density, low end, width and the silence before it, which is
the intended contrast; raising level would be loudness competition. (b) the voice timbre is
buzzy/bright by design; its pleasantness is a human-listening question the analysis cannot
answer.
