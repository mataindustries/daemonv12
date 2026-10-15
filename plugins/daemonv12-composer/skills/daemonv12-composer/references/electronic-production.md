# Electronic production with Composer v0.3

These are starting techniques, not BANGER LAB entries or a required genre/palette.
Read [engine notes](daemonv12-production-notes.md) for defaults, rounding,
source/gate/release interactions, limits and citations. All ten complete JSON
projects in [production-recipes.json](production-recipes.json) are validation
fixtures for engine v0.7.0, commit
`02438eda48506a94d10ad2756c6aafff8c5a9469`. The wrapper's `engineCommit`,
`recipes` and `id` are fixture metadata: only each `project` is engine input.
No additional note or effect field is implied by the recipe names.

Copy a selected `project` to a separate composition workspace with the matching
`assets/glasshouse/` and `assets/orbital-foundry/` directories from the engine's
`examples/assets/` (or `init`). Preserve sources and licenses. Validate the saved
project before rendering; changing assets changes slice validity and sound.
The eval test compiles every project with those real assets, without modifying
examples or building engine DSP. These deliberately small one-bar fixtures test
contracts, not finished arrangements or musical quality.

| Recipe ID | How to use it and what to check |
| --- | --- |
| `tight-gated-bass` | C# sub with `gate: "1/16"`, source `endSeconds: 0.6`, 2 ms attack / 12 ms release and `chokeGroup: "bass"`. The next half-speed note still has a musical gate. Inspect actual release endpoint, not only gate length; rate slows the source, not the envelope. |
| `kick-bass-spacing` | Kick at `1:1` / `1:2`, bass at `1:1+1/16` / `1:2+1/16`; kick gate `1/16` includes default release afterward. Inspect both stems at the collision and shorten gate/release if necessary. Separate tracks cannot choke each other; effects can ring past voice release. Retain body when it supports the arrival. |
| `hat-percussion-chokes` | One kit track uses a quarter-speed pixel hat as the longer voice, then a normal hat in the same `hats` group. A second kit track lets `machine-tick` release `metallic-strike` in group `metal`. Different mappings choke on the same track. Same-frame onsets coexist; old release can overlap the new attack. This is not guaranteed monophony. |
| `pitched-sliced-hook` | Three slices of C#4 ghost-vox use absolute source offsets/endpoints and rates 1, 1.498307 (+7 semitones) and 2 (+12). Start from verified tuning; source formants move too. Gates do not stretch a short slice. Check each rounded `[offset,end)` bound and transient; do not put `pitch` or `duration` on a sampler note. |
| `swing-offsets` | Offbeat hats use `1:1+1/6` and `1:2+1/6`: two-thirds through a quarter-note beat in 4/4 (a 2:1 eighth swing). Offsets after `+` are whole-note fractions smaller than a beat, on the 960-PPQ grid. A straight eighth would be `+1/8`. Vary velocities deliberately; there is no global `swing` or humanize field. `offsetSeconds` would move the source read, not the onset. |
| `gain-pumping` | Track `automation.gainDb` drops to −24 dB on each written beat and recovers linearly in dB to −9 dB by `+1/8`. Each point's `transition` applies toward the next. Values replace static gain, never add to it. Repeat points for later beats/bars; lanes are project-absolute, not repeated with clips. This is authored sidechain-style pumping, not a kick detector or track sidechain. |
| `glide-riser` | Ghost-vox spins from rate 0.25 to 1 over `1/4`, with gate and output envelope. Rates rise linearly, not exponentially in pitch. Choose a sufficiently long source/slice for the gesture; source exhaustion wins. |
| `glide-tape-stop` | Rate 1 falls to 0.25 over `1/4`, then holds. Gate and release finish the phrase; zero speed is unsupported. Check final three seconds and restart relationship in a complete arrangement. |
| `filter-transition` | Two aligned ghost-vox tracks have static lowpass/highpass at 600 Hz; complementary outgoing gain ramps transfer emphasis from dark to bright. These dB ramps are not equal-power crossfades, and the two filters do not form a guaranteed complementary crossover. Check level dips, correlated summation, phase and track count (15 maximum). |
| `master-saturation` | Conservative track gain, master −3 dB, saturation drive 3 dB / mix 0.2. This is a timbral starting point, not an automatic loudness/peak target or output compensation. Inspect all track stages and final sample/true peaks before delivery. |

For a stepped filter opening, separate tracks can instead carry static lowpasses
at different cutoffs, with clips/gain ramps selecting the stages. Existing
highpass/lowpass use `frequencyHz`; only gain and pan automation lanes exist.
Do not invent cutoff automation, resonance, parametric EQ, a new routing bus or
an arbitrary FFmpeg graph. Filter transitions are approximations whose musical
consequence must be evaluated in context.

Master saturation uses a tanh transfer blended with dry audio. It has no automatic
output compensation, oversampled true-peak limiter or guaranteed hard true-peak
ceiling. Dry blend, prior clipping, subsequent effects and reconstruction peaks
matter. A compressor is also not a limiter. Read `.render.json` track/master
`clippedSamples` and `preClipPeakDbfs`, then `.analysis.json` sample peak,
`fullScaleSamples` and `truePeakDbfs`. Master attenuation cannot undo track-stage
clipping. If the brief's peak limit fails, lower the responsible stage, revise
processing/overlap, rerender and remeasure. Do not claim certification from the
presence of saturation, or infer true peak from sample peak alone.

For reproduction from the engine root:

```sh
node --test plugins/daemonv12-composer/evals/production-recipes.test.mjs
```

Sources: `docs/V0_7_SAMPLER_ARTICULATION.md`,
`docs/V0_6_SAMPLE_PERFORMANCE.md`, `docs/V0_5_TIMELINE_DYNAMICS.md`,
`src/audio-types.ts`, `src/project/validate.ts`, `src/pipeline.ts`,
`src/timing/musical-time.ts`, `src/render/playback.ts`,
`src/render/production.ts`, `src/render/dynamics.ts`, `src/render/ffmpeg.ts`,
`examples/assets/glasshouse/README.md`, `examples/assets/orbital-foundry/kit.json`.
