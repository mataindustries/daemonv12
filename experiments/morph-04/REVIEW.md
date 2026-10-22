# MORPH//04 Phase 1 review: diagnosis, revisions, measurements

**I could not listen.** Every judgement below is a measurement (`checks.py`, MORPH//03
`analyze.py`, spectrograms) or a design intention. The proxies catch engineering faults:
masking, weak elements, lost transients, mono collapse, seams. They can't tell whether a
groove makes someone want to hear it again; that is the checkpoint's job.

## From the feedback to the brief

| Feedback / brief | What it meant here |
|---|---|
| Cable Bass: strong sound, needs interesting percussion and an arrangement | Keep the riff's notes and articulations (slap dives, zaps, pops, the F→E bend, the G→Bb re-tension, the bowed growl, the snap) and build two drum worlds around them. |
| Percussion from physical models | Struck membranes with tension-dependent pitch, wires that only rattle on one side, the cable itself as toms and ticks, MORPH//02 B's household objects. |
| Preserve space for the cable's articulations | Measured at every cable onset: bass presence (300 Hz–4 kHz) against everything else in the next 60 ms. Arrangement changes, not EQ tricks, fixed the collisions. |
| Stop prioritising DSP architecture | No changes to the cable model. The new code is percussion one-shots, a score-to-lanes layer and two arrangement files. |

## A — HEAVY

| Rev | Diagnosed weakness (measured) | Change | Result (measured) |
|---|---|---|---|
| 1 | The draft was bass plus kick. The snare sat 11 dB under the bass in its own eighth note (−26.9 vs −15.9 dB); the ticks were 35 dB under. Room −29.8 dB below the mix. Mid band almost mono (side −25.9 dB under mid). Kick −14.8 LU under the mix on the phone model. | Rebalanced: snare +5.5 dB, ticks +10 dB, bass −1 dB; room send +5 dB and return +4 dB; wider ticks and partner cable. | Snare −21.4 vs bass −17.2 dB in its beat; room −21.9 dB; mid side −19.6 dB. |
| 2 | Rev 1 exposed collisions: slaps on the half-time snare had only 2.9–3.7 dB presence margin, and the twelfth pop on bar 4's snare 4.1 dB. Snare peaks drove the limiter to 1.2 dB, with 2.5 dB crest loss at drum onsets. | The slap now answers the snare a 16th later (S on 3, slap on its "e"). Bar 2's snare is alone, so the choke follows a single hit. The pop moved off the snare. Ticks moved off ghost notes. Snare −1 dB. A small dark "garage" room around the cable and kick for depth. Kick beater raised for phones. | Slaps and pops ≥ 3.6 dB (median 23.4 dB). Crest loss ≤ 0.92 dB. Mid side −12.0 dB, high −11.4 dB. Kick on phone −8.1 LU (was −14.8). The choke is 53.5 dB down. |
| 2 | The stop-time hiccup was only a 32nd (−17 dB). | Lengthened: the kick on 43 is cut after 40 ms, then the loop holds. | −28 dB for 84 ms. |

Trade-off left in place: the downbeat slaps share their onset with the kick's beater (3.6–5.1
dB margin). Moving them would lose the unison punch, and the slap's dive lasts longer than
the 10 ms click.

## B — BREAKS

| Rev | Diagnosed weakness (measured) | Change | Result (measured) |
|---|---|---|---|
| 1 | Toms doubling the 32nd stutter buried it (0.9–2.5 dB margins). A 5-cycle of toms kept landing on riff notes (−1.6 dB at 4.2.2). The ratchet was the loudest element of bar 2: the cable sat up to 11 dB under it, and the ratchet measured −2.7 LU against the whole mix on the phone model. A ghost kick sat under the slack cable's low end (−0.6 dB). | Removed the doubles. The toms became a Phrygian walk-down placed only in the riff's gaps, and the 5-against-4 moved to the tick accents (high band, no masking). Ratchet −5 dB, toms −4 dB. The slack cable's sub is halved while it is percussion. | Unique articulations ≥ 3.8 dB; kick margin ≥ 4.7 dB. |
| 2 | The wind-up's geometric curve jumped from a dotted eighth straight to about a 16th (375 → 134 ms), so no subdivisions were heard on the way to pitch. The cable was quiet while the drums ratcheted (−30 vs −23 dB). The F→E bend shared its onset with a kick (1.4 dB). The B1 sat under the backbeat snare (−1.3 dB). | Ease-in tension curve (round trip = r^(u²)). The cable is re-struck at every round trip, in unison with the drum repeats. Kick moved to the ghost before the bend. The B answers the snare a 32nd late. Tick accents read from the cable's bright band, where each chirp's onset is. | Repeats 375 → 255 → 126 → 78 → 56 → 43 → 35 → 29 → 25 ms, then 41 Hz. Cable −16.8 dB at the end of the wind (was −30). Unique articulations ≥ 6.2 dB; plain plucks ≥ 3.6 dB. |

Accepted imprecision: the slack cable's reflections drift ahead of the 16th grid, because
dispersion makes each chirp's top arrive early. The cable-driven tick accents follow the
drift (0, 3, 5–6, 8, 11–12 …) instead of an exact 3-grid. That drift is the cable's own
physics.

## Final measurements

| | A — HEAVY | B — BREAKS | MORPH//03 Cable Bass (ref) |
|---|---:|---:|---:|
| Integrated loudness | −13.9 LUFS | −13.9 LUFS | −13.9 LUFS |
| True peak | −1.5 dBTP | −1.4 dBTP | −1.7 dBTP |
| Peak-to-loudness | 12.4 dB | 12.5 dB | 12.2 dB |
| Momentary spread (P95−P10) | 3.5 LU | 7.4 LU | 6.0 LU |
| Energy < 150 / 150–2k / > 2k Hz | 75 / 20 / 5.4% | 68 / 27 / 5.1% | 72 / 25 / 2.3% |
| Phone-speaker drop (HP 300 Hz) | −4.3 LU | −3.6 LU | −3.4 LU |
| Kick over bass sub, first 50 ms (median / min) | 18.0 / 9.4 dB | 10.9 / 5.2 dB | no drums |
| Cable articulations over the rest, 300 Hz–4 kHz (median / min) | 23.4 / 3.6 dB | 19.5 / 6.2 dB | solo |
| Crest loss at drum onsets, pre-master → master (median / max) | 0.45 / 0.92 dB | 0.0 / 1.39 dB | no drums |
| Limiter max / master soft clip max | 1.0 / 1.75 dB | 0.9 / 1.55 dB | 0 / 0.55 dB |
| Side vs mid, 150 Hz–2 kHz / > 2 kHz | −12.0 / −11.4 dB | −14.9 / −11.3 dB | −18.3 / −15.7 dB |
| Mono fold-down loss (low / mid / high) | 0.00 / 0.27 / 0.30 dB | 0.00 / 0.14 / 0.31 dB | 0.01 / 0.06 / 0.12 dB |
| Infrasound < 20 Hz | 0.0015% | 0.0006% | 0.0012% |
| Loop seam (join step ÷ local median step) | 0.19 | 0.48 | 1.26 |

- **Phone translation:** HEAVY loses the most on the phone model, because 75% of its energy
  is below 150 Hz. On the phone model the snare is −2.7 LU and the bass −1.6 LU against the
  whole mix, so the groove's backbone survives; the kick is mostly its beater there (−8.1 LU).
- **Source data:** `audio/checks.json` and `audio/analysis.json` hold the full numbers;
  spectrograms are in `audio/spectrograms/`.

## For the checkpoint

Proposals for what to listen for, not conclusions:
1. **Direction:** HEAVY's weight and silence, or BREAKS' cable-driven time? The final track can
   also borrow from the other, for example HEAVY's choke inside the BREAKS world.
2. **HEAVY:** does the choke at 3.0 s feel like a shock or a mistake? Does the slap a 16th
   after the snare feel like a call-and-response, or late?
3. **BREAKS:** does the wind-up at 2.0 s read as the drums being pulled into the cable's
   pitch? Is bar 1's 3-against-4 groove too loose before the riff arrives?
4. **Kit:** which percussion sounds earn a place in the track: the membrane kick and
   snare, cable toms, cable ticks, the toaster spring, the press clank?
5. **For Phase 2:** the Wobble Beast is not in either loop yet. It is reserved as the cable's
   answer in the composition, as the brief asks.
