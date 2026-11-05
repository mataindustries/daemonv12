# Production log · Composer v0.4 · entry-k3v9

Evidence labels: **[M]** measured (DaemonV12 analysis/provenance, packaged `review-sections.mjs`,
FFmpeg `astats`); **[S]** score-based inference; **[U]** unavailable. No human listening feedback
was available (unassisted condition); nobody heard these renders during the workflow. No quality scores are assigned.

- Brief: original, replayable 28 s cinematic electronic cue; V12 SIGNATURE only; hook-first.
- Engine `e2962cc1a443c841cd6ca7cb2cc56c5ebabf0e99` (clean; nothing outside this folder changed),
  DaemonV12 0.7.0. Composer 0.4.0, skill package digest `8d3ae8dc…0498` (see SHA256SUMS).
- Doctor: `sampleOnly`, `productionEffects`, `mp3`, `loudnessAnalysis` true; GM/MCP false
  (FluidSynth and SoundFont absent, unused). Engine runtime dependencies: 0, so no `npm ci`. Node
  v22.23.4, FFmpeg/ffprobe 6.1.1-3ubuntu5. No wrapper. SoundFont: none.
- Palette: 16 pack WAVs + `kit.json` copied to `assets/v12-signature/` (a symlink is rejected
  by the engine's real-path guard); 16/16 SHA-256 match catalog 1.0.0. Licence: pending owner
  declaration (pack PROVENANCE); unchanged.

## MUSICAL THESIS

Hook: tresillo call on repeated B, a leap up, then a falling sigh; the leap widens on every return.
Rhythmic identity: 3+3+2 in the hook and low end; 3+3+3+3+2+2 ostinato; dotted-eighth delay.
Low end: ABYSS owns the sub, same onset and rate as the kick; a B pedal for bars 3–8, moving bass from bar 9.
Contrast: harmony moves over a static bass; subtraction plus a withheld leap before the arrival.
Payoff: the leap lands an octave higher on the impact while the bass moves for the first time.
Ending: exposed leading-tone climax → cadence on high B → bell echo of the call without its leap (loops into bar 1).

## HOOK PREFLIGHT

All four: 4 bars (hook ×2, Bm then G), identical HORIZON + ABYSS + half-time kick, cheap Node
route, validate 0 errors / 0 warnings, 0 clipped samples [M].

| Candidate | Rhythm | Contour / tension | Peak / TP [M] | Decision [S] |
| --- | --- | --- | --- | --- |
| A tresillo-leap (PHANTOM) | 3+3+2 repeated notes, then a long note | flat → minor-sixth leap → step down (♭6→5) | −1.55 / −1.55 | **Selected (provisional).** Rhythm can drive the low end; pitches fit i, ♭VI, iv and V with a new meaning on each |
| B grouped-ostinato (SIGNAL) | continuous 16ths, 3-grouped accents | top line rises, then falls | −0.81 / −0.80 | Rejected as hook, reused as accompaniment |
| C off-beat bell (CHROME) | off-beat repeats, stepwise run | static → ascent, withheld | −1.27 / −1.24 | Rejected: 2.6 s tails blur the rhythm; generic ascent |
| D triplet-descent (PHANTOM) | long note + quarter-triplets + pickup | high → stepwise descent | −0.88 / −0.87 | Rejected: least distinctive contour |

Uncertainty [U]: not heard. Whether the low B4 repeats speak through a mix and whether the tresillo
reads as cliché were unverified. The anchor is `hook-a-tresillo-leap.json` (unchanged). Pack 1.0.0 catalog verified.

## V1 THREE WEAKNESSES (`cue-v1.json`, `out/v1`)

1. Bars 3–6: the pedal groove already spends the payoff low end; sub −16.4 vs arrival −15.2 dB,
   overall +1.4 dB only [M]. Cause: groove kick/sub velocities ≈ arrival's. Change: lighten bars 3–4.
2. Bars 13–14: the climactic octave leap has no textural consequence; V within ~0.5 dB of IV in
   every band [M]. Change: orchestrate the hook itself (choir doubles the call; bell rings the leap).
3. Arrival width: side energy 5.2% vs 17.1% in the exposure; the payoff is narrower than the opening
   [M, proxy]. Change: split the ostinato L/R at the arrival (genuinely different content).
- Checked and *not* claimed: lead vs SIGNAL masking. The lead's mid band sits 9.4 dB above SIGNAL in IV [M].
- V2 keep: every hook statement, the pedal→moving-bass idea, suspension and ending. Result: arrival
  now +2.7 dB sub / +2.6 dB RMS over the groove [M]. **Kept.** Width barely moved (5.5%) [M].

## V2 THREE WEAKNESSES (`cue-v2.json`, `out/v2`)

1. Width still unresolved (5.5% vs 5.1%) [M]: the split ostinato is too quiet to change the image.
2. Bar 1 has no grid, so the tresillo may read as free time on first exposure [S, hypothesis].
3. IV→V show no contrast (−13.2 vs −13.7 dB) [M]: the climax is melodic only. Kept as a hypothesis for the Risk Pass.
- V3: B3 pulse in bar 1 (3-grouping), split ostinato +3–4 dB in IV–V. Result: marginal [M]
  (side 5.6%); the whole-band side fraction is dominated by mono sub energy, so it is not decisive. Kept.

## V3 STATUS

Clean: 0 clipping, true peak −1.04 dBTP, complete arc, final 250 ms peak −57.8 dB [M].
Concern found by the Risk Pass test [M]: V3's final cadence bar was *quieter* than its approach (−13.3 → −14.8 dB).

## OPENING CONTINUITY [S + M]

First 1 s: bell strike and lead B4 in unison, with a pad swell; a deliberate single gesture.
First 3 s: the complete hook (call from 0 s, leap at 1.71 s, sigh at 3.0 s); identity established.
First 5 s: the sub enters on the same tresillo the hook just played, so the groove is derived
from the hook rather than pasted in. Bar 1 grid added in V3. No trim needed.

## IMPACT TEST (9:1) [M]

Approach (bar 8) −23.0 dB RMS, sub −25.0 → first arrival bar −11.9 dB, sub −14.5. The impact
comes from the withheld leap landing an octave up, the first moving bass, new REACTOR, IRON PULSE,
chords and CONVERGENCE. Arrival vs groove: +2.7 dB sub. 0 overload.

## FINAL 3 SECONDS [M + S]

High B resolution, gated second impact, bell B·B·B echo; last 250 ms peak −56.5 dB, last 10 ms
−62.7 dB, so the music ends before the boundary. Ending → opening: the echo is the call without
its leap; bar 1 supplies the leap on replay [S].

## TRANSLATION ROBUSTNESS PROXY [M + S]

Mono sum vs stereo RMS: −0.25 dB (arrival), −0.29 dB (whole), so no cancellation. The hook lives
at 494–988 Hz (mid band, lead dominant). Kick/sub share onset and rate. Width is not load-bearing.
Device listening [U].

## RISK PASS → V4 (`cue-v4.json`, `out/v4`)

- Hypothesis: sudden intimacy. Drop drums, bass and ostinato in bar 14 under the octave leap, then a second gated CONVERGENCE on 15:1.
- Upside: the most memorable melodic moment is exposed, and the cadence becomes a second arrival.
- Downside: stalled momentum, an ending that steals the payoff, overload at 15:1.
- Test: one edit, one render. Keep if: 0 overload, TP ≤ −1 dBTP, and the cadence clearly exceeds its approach.
- Result [M]: bar 14 −19.0 dB (sub −41.4, side 19.6%, the widest moment) → cadence bar −12.8 dB
  (+6.2 dB; V3 had −1.5 dB). Still below the main arrival bar (−11.9). TP −1.04, 0 clipped. **KEEP.**
  This also gave the arrival-width contrast through subtraction.

## STOP DECISION

Thesis, opening, hook, groove, payoff and replay ending are all accounted for; no known technical
defect. V3 was marginal, and V4 (risk) was material and kept. Remaining ideas are speculative, so stopped.
Complete versions: V1–V4 (4 of the 5 allowed; V4 = rendered Risk Pass). No V5.

## DETERMINISM

Frozen `entry-k3v9.json` was rendered twice (`final/` and a fresh scratch directory) with
`--stems --format wav,mp3`: **all 19 artifacts were byte-identical** (WAV, 14 stems, MP3, MIDI,
analysis, render.json) [M]. Hashes: `SHA256SUMS`. Same Node, FFmpeg, assets and engine.
