# Production analysis: evidence for musical decisions

Analysis tests a musical hypothesis. A clean measurement cannot prove that a
hook is memorable, a groove works or a payoff feels large. Preserve human
feedback alongside measurements; never present analytical inspection as human
listening. Metrics are evidence, not targets.

## Reuse native evidence first

From the engine checkout:

```sh
node bin/daemonv12.js render path/to/project.json --stems --format wav --out-dir path/to/version-output --json
node bin/daemonv12.js analyze path/to/version-output/project.wav --json
```

Use the master path returned by render. Production and explicit-format renders
already write `.analysis.json` for the master and requested stems; read it before
running another analysis. Analyze the canonical WAV, preserve separate version
outputs and keep routing consistent across comparisons. FFmpeg is required for
these production/analysis commands.

Native analysis supplies duration, frames, sample rate, channels, sample peak,
RMS, full-scale count, clipping, integrated LUFS, LRA and true peak. It does not
supply general per-section bands or stereo correlation. Do not rebuild reliable
native metrics. Use the section helper below only when a local comparison can
change the next musical decision.

| Evidence | Musical use and limits |
| --- | --- |
| Integrated LUFS (`integratedLufs`) | Whole-file frequency-weighted, gated loudness. Useful for broad level comparisons; a short entrance or ending may disappear from its account. It cannot establish impact or quality, and there is no universal target. |
| Sample peak (`peakDbfs`) | Largest stored sample. One isolated attack can set it while the hook remains buried. |
| True peak (`truePeakDbfs`) | FFmpeg's intersample estimate, conventionally described in dBTP. Inspect separately from sample peak and allow delivery headroom appropriate to the brief. |
| Clipping / `fullScaleSamples` | Exact full-scale PCM values are a warning, not proof of clipping history. Production `clippedSamples` and `preClipPeakDbfs` locate actual stage overload. Master attenuation cannot repair a clipped track. |
| LRA (`loudnessRangeLu`) | Measured loudness variation. Short/static cues can yield zero or uninformative LRA; it does not grade groove or arrival. |
| RMS (`rmsDbfs`) | Average waveform power. Sustained bass can raise it while masking attacks; silence and long tails lower whole-file RMS. Compare like-for-like windows. |
| Band evidence | Approximate energy in stated frequency ranges can locate accumulation, absent presence or competing sources. These are descriptive partitions, not an EQ curve to pursue. |
| Stem balance | Compare roles at shared active timeline positions to locate collisions. Whole-file stem loudness includes different amounts of silence; stem LUFS values do not add arithmetically. |
| Stereo evidence | Correlation and mid/side energy describe waveform relationships. They do not grade width, prove mono safety or distinguish a useful image from phase instability on their own. |

Exact silence can yield `null` peak, RMS, LUFS and true peak. Treat undefined
measurements as undefined, not zero loudness or a failure. An absent metric is
different from a measured zero.

## Compare musical sections

Choose boundaries from the score: opening, establishment, development,
approach, payoff and ending as applicable. The functions may overlap; ambient or
cinematic arrivals do not require a drop. Record actual timestamps per version,
especially after shifting an entrance. A disruption can be intentionally quiet
in context even when its excerpt alone looks empty.

Compare the complete sections and equal-duration excerpts when lengths differ.
Include the approach and first attacks of an arrival, not just its loudest
sustained moment. Read RMS, peaks, bands, attack activity and stereo evidence
together with note placement, register, source tails and automation. Ask what
physically changed and whether that change supports the thesis.

When human audition is available, compare documented, reasonably matched playback
levels so added gain does not masquerade as an arrangement improvement. Preserve
canonical files unchanged. Analytical level matching cannot certify equal
perceived loudness or replace human listening.

## Impact Test

A payoff/drop/arrival may measure louder and still feel smaller. Evaluate each
relevant dimension against the approach and established material:

| Dimension | Musical questions and useful evidence |
| --- | --- |
| **Low end** | Is there sub authority, a clear kick relationship and useful bass-note shape? Does low-end entry timing support the arrival? Compare coincident attacks, envelopes, overlap and stems. |
| **Transients** | What is attack density and contrast? Have important attacks been softened by overlap or processing? Examine note onsets, peaks and short-window activity; a higher activity count is not automatically better. |
| **Register** | Does vertical pitch range change? Does the arrival occupy more useful spectrum, or stack more parts in one register? Band energy cannot identify pitches or harmonic function; inspect the score. |
| **Presence** | Is the important hook visible in useful mid/upper-mid material? What competing role masks its outline? |
| **Top end** | Do hats, noise, air, metal or percussive brightness contribute where stylistically appropriate? Brightness is optional, not a requirement for scale. |
| **Stereo** | Is there side energy and width contrast? Does new width come from differing content or only balance-panning? Read channel relationships and source/arrangement evidence together. |
| **Density** | Is the increase or decrease meaningful? Does overcrowding blur attacks or weaken hierarchy? Subtraction can make an arrival consequential. |
| **Negative space** | Does silence or reduced activity immediately before impact create anticipation? Check whether the preceding section leaves room for the arrival. |
| **Musical consequence** | Is the payoff a transformation of established material, or merely more layers? Does it change expectation, meaning or physicality in the way the thesis intends? |

For a deliberately intimate arrival, assess the intended focused contrast rather
than demanding maximum width, sub or brightness. Do not solve impact only by
increasing master gain. Originality and technical cleanliness do not establish
perceived scale; keep this evaluation explicit.

## Low end and low-mid buildup

Inspect kick and bass separately, together and in the master. Mark their attacks
and decays: sustained bass may cover the kick's onset, or an early-ending bass
voice may leave the main impact unsupported. Check slowed samples and repeated
triggers for accumulating tails. Use authored gates, slices, envelopes and
track-local choke groups to control sampled tails; grouped releases can overlap and do not choke other tracks;
consult [engine notes](daemonv12-production-notes.md).

Energy around **120–500 Hz** can create weight, warmth and body. It is not a
universal bad-frequency region. Excessively overlapping bass calls, pads,
distorted samples and tails can also make a section boxy, crowded, smaller or
less punchy. A rising low-mid band is a clue only when it accompanies a musical
problem.

When buildup is suspected, first examine overlapping parts, register, source
length, arrangement and effect tails. Test a spacing change, shorter source,
later offset, different register, reduced redundant layer or carefully supported
filtering. A highpass/lowpass is a broad filter, not a guessed parametric EQ.
DaemonV12 exposes no conventional multiband/parametric EQ; never invent one.
Phase interaction depends on waveform and timing, so overlap alone does not
justify phase inversion or another unsupported control.

## Stereo width evidence

Current production pan is linear stereo **balance**, not a decorrelation effect.
Mono sample inputs are duplicated to both channels before balance. Panning a
mono phrase changes placement and level; it does not generate different
waveforms. Panning a stereo source can attenuate or discard one existing channel
rather than move its complete image. Verify the selected engine's implementation
before relying on these claims; see [engine notes](daemonv12-production-notes.md).

Build useful section contrast with genuinely different left/right material,
call-and-response placement, octave or timbral doubles, or verified stereo source
and effect behavior. Identical mono copies separated only by pan remain the same
information. Different parts can create a broader arrangement while retaining a
stable identity in the center; compare their musical interaction rather than
maximizing width everywhere.

Read correlation with mid/side energy and score/source evidence. Side energy can
rise from unequal channel gains alone, even when both channels carry the same
waveform. Strong positive correlation can be intentional focus; low correlation
may reflect useful width or unstable phase. Negative correlation warrants a mono
check, not automatic rejection. Silence or a channel with no variance can make
correlation undefined. There is no ideal universal value.

## Translation robustness proxy

An agent cannot claim human phone, car-speaker or headphone listening without
such feedback. Use these as **proxy evidence**; human cross-device listening
remains the judge.

Check whether identity depends excessively on sub-bass only, extreme width,
ultra-high frequencies or barely audible ambience. Does important musical
information also exist in useful midrange? Inspect the hook's midrange identity,
transient readability, kick/bass relationship and phase-dependent width.

A mono sum or existing FFmpeg band-limited diagnostic can help expose disappearing
material, but it is not a model of a particular phone or car. Inspect whether
important gestures survive summing and whether the anchor remains readable.
Preserve intentional sub, width and air when they serve the piece; the aim is a
robust identity, not identical sound on every playback system. Record the proxy
used and remaining uncertainty.

## Use review-sections.mjs

This lightweight, read-only Node helper answers **“How are these sections
physically different?”**, not **“Which section is better?”** It adds local
comparisons missing from native analysis; native reports remain authoritative
for delivery loudness, true peak and overload evidence. It requires no new
heavyweight dependency.

From the plugin repository checkout:

```sh
node plugins/daemonv12-composer/skills/daemonv12-composer/scripts/review-sections.mjs path/to/master.wav path/to/sections.json
```

From an installed plugin, use the corresponding script path. Example section
file; replace boundaries with valid times in the actual WAV:

```json
{
  "sections": [
    {"name":"opening","start":0,"end":5},
    {"name":"groove","start":5,"end":14},
    {"name":"payoff","start":18,"end":24},
    {"name":"ending","start":24,"end":28}
  ]
}
```

Boundaries round to the nearest sample, with start inclusive and end exclusive;
the output reports their aligned times. The concise JSON includes section
duration, linear full-scale RMS/peak and dBFS,
approximate `bandRms`, `activity.rmsRisesPerSecond`, and stereo evidence for
stereo input. The first input section is the comparison reference;
`relativeToFirst` reports RMS/peak/band dB differences against it. Put the intended
reference first or read the sections directly to compare an approach and payoff.

Band partitions are sub 20–120 Hz, low-mid 120–500 Hz, mid 500–2000 Hz,
upper-mid 2000–6000 Hz, and high 6000 Hz to Nyquist. The 2048-frame FFT uses a
square-root periodic Hann window with 1024-frame overlap and padded boundaries;
each sample's squared window weights sum to one, including edge impulses.
Energy remains coarse: taper leakage and short sections limit precise source
isolation, EQ or low-frequency diagnosis. No partition includes energy below
20 Hz. Read `method.bands` for effective bounds clipped to Nyquist and `available`.
Wholly unavailable bands and their relative dB differences are `null`, rather
than measured zero energy. Partially available bands cover only their reported
range; compare versions with equivalent methods/sample rates.

`activity.rmsRisesPerSecond` counts rises over 6 dB in whole-mix RMS between
roughly 10 ms blocks when the new block is above −60 dBFS. Use it as one rough
activity/contrast clue, not a musical onset counter or a target. Short attacks
can be masked by sustained material in this measurement, even when their peaks
exceed the sustain. An attack exactly at a section boundary can be missed because
the first block has no previous comparison block; marginal detections also depend
somewhat on block alignment. Zero or lower rises/s does not prove that rhythmic
attacks disappeared.

When rhythm matters, cross-check score/project events, percussion or rhythmic
stems, relevant spectral-band changes, and waveform/transient evidence. Do not
remove pads or sustains merely because this proxy drops. Keep it as evidence
alongside the arrangement and other measurements, never a grade for groove.

For stereo, `midRms`/`sideRms` use `(L+R)/2` and `(L-R)/2`;
`sideEnergyFraction` is side energy divided by mid-plus-side energy. Correlation
is a channel-relationship proxy. Use the balance caveat above: side energy alone
does not prove differing content. Mono input has no stereo measurement.
Silence has zero linear energy, `null` dBFS, undefined correlation and zero side
fraction; relative dB comparisons involving zero energy are `null`. Do not turn
those into NaN/Infinity or infer a finite gain difference from silence.

## When not to analyze more

Prefer composition over tooling. Create new analysis software only when all
three conditions hold: a specific musical question remains unresolved; existing
DaemonV12/FFmpeg/tools cannot answer it; and the answer could plausibly change a
musical decision. “I want more metrics” is insufficient. “Did the arrival gain
stereo contrast or only level, and should I change its arrangement?” is a useful
question, but this helper and source inspection should usually already answer it.

After V3, each additional version needs an exact audible musical hypothesis,
minimum evidence needed, cost and keep/revert criterion. Ask whether one score
edit, one render or existing analysis suffices before building anything.
**ANALYSIS TIME MUST NOT GROW FASTER THAN MUSICAL IMPROVEMENT.** If two consecutive
revisions produce only marginal improvement, compare them, keep the stronger
one and stop speculative iteration. Complete the required review/Risk Pass and
address a demonstrated technical defect before claiming a clean lock. Any repair
still needs a bounded hypothesis and, beyond V5, an unusually strong reason
recorded before work or a user override; disclose a defect that cannot be resolved
within user constraints.
The default five-version budget and exceptions live in [SKILL.md](../SKILL.md);
it is a workflow budget, not an engine limit.

Turn evidence into a concise revision:

> At [section/time], [musical problem] is supported by [score, measured or human
> evidence]. Change [role/event]. Check [audible consequence] and [tradeoff].

“Low LUFS,” “few events,” “few tracks” or “little high-band energy” are not musical
weaknesses by themselves. Keep a revision only when its consequence improves the
brief. A finished strong track is better than an endlessly analyzed track.

## Engine grounding

Read these paths in the selected engine checkout:

- `docs/V0_3_AUDIO.md`: clipping/analysis and export/provenance, supplemented by
  `docs/V0_5_TIMELINE_DYNAMICS.md` for current routing and duration/tails.
- `src/render/analysis.ts`: native PCM and FFmpeg measurement semantics.
- `src/render/production.ts`: `quantize`, `balance`, `automatedGainPan`.
- `src/render/dynamics.ts`: supported reverb and saturation behavior.

Production stems include track automation/effects and exclude master
gain/effects/ducking. Legacy GM stems need not sum identically to the full-score
master. Identify the route before diagnosing a stem/master difference as an error.
