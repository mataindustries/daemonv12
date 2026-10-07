# ORBITAL FOUNDRY verification

Measured with Node v22.23.3 and FFmpeg 6.1.1-3ubuntu5 on the existing Linux environment. All audio was rendered through DaemonV12 0.4.0's native production pipeline; no mastering, limiter, normalization or external sound source was used. The audition uses static gain/pan and envelopes already baked into the source sounds. No runtime engine, schema or MCP changes were necessary.

## Canonical audition

Project: `examples/orbital-foundry-audition.json`. Render: `npm run demo:orbital-foundry`.

| Measurement | Result |
|---|---:|
| Duration | 30.000000 s / 1,323,000 frames |
| Format | 44,100 Hz, stereo, PCM16 WAV |
| Integrated loudness | −17.43 LUFS |
| Sample peak | −1.604219 dBFS |
| True peak | −1.59 dBTP |
| RMS | −20.890031 dBFS |
| Loudness range | 3.2 LU |
| Full-scale samples | 0 |
| Clipping (master and every production track) | none |
| Tracks / triggers | 12 / 298 |
| Source WAV payload including headers | 5,048,656 bytes (4.815 MiB) |

True peak is the existing FFmpeg analyzer's measurement; the JSON field is named `truePeakDbfs`. WAV is canonical; MP3 is a listening convenience, not a byte-repeatability contract. Canonical master SHA-256: `c1dd6439d38b701efc897a3652716d3ea2ce5cdf3198845d3727a15f42d6fcee`.

Every source peak is between −11 and −6 dBFS; source durations range from 85 ms to eight seconds. Exact source identities and synthesis recipes are in `examples/orbital-foundry.catalog.json`.

Artifacts, all under `renders/orbital-foundry/`:

- `orbital-foundry-audition.wav` and `.mp3`: full audition.
- `orbital-foundry-audition.stems/`: twelve aligned, active 30-second WAVs, named by sound role. Native stems include track gain/pan, before the master gain of +0.3 dB.
- `orbital-foundry-audition.analysis.json`: native master and stem analysis.
- `orbital-foundry-audition.render.json`: native source hashes, trigger frames, render settings, tool versions and artifact hashes.
- `orbital-foundry-audition.mid`: native sample-only MIDI companion; no GM notes.
- `spectral.json`: offline spectral and per-second RMS QC for master and every source.
- `spectrogram.png`: logarithmic-frequency visual inspection.

These are reproducible build artifacts and remain Git-ignored. The twelve source WAVs, kit, catalog, project, generator, tests and documentation are the deliverables to version.

## Tonal balance and musical duration

Measured with `node scripts/inspect-orbital-foundry.ts > renders/orbital-foundry/spectral.json`. The estimator uses 8192-point Hann windows at 50% overlap, includes windows centered on the start transient, and sums separate-channel FFT power. Bands are approximate, unweighted energy shares, not perceptual loudness. A known 1 kHz tone and a first-frame impulse validate the estimator.

| Band | Audition power |
|---|---:|
| Below 30 Hz | 0.07% |
| 30–120 Hz | 33.02% |
| 120–500 Hz | 28.24% |
| 500 Hz–2 kHz | 12.06% |
| 2–6 kHz | 16.43% |
| 6–12 kHz | 6.85% |
| 12–22.05 kHz | 3.33% |

The audition remains weighty, but energy below 120 Hz is about one-third of total power. The mechanical mids, metallic presence and atmospheric top are independently represented; the drone is predominantly low-mid rather than sub. The steel strike has about 88% of its power across 500 Hz–6 kHz; the machine tick about 76% in 2–6 kHz. High-frequency air provides width; the full mix's L/R correlation is +0.7557, without relying on polarity inversion.

For context, the pre-existing `render-Cl548i/first-agent-cue.wav` measured −32.36 LUFS with roughly 60.1% below 120 Hz and 1.4% at 2–6 kHz using the same spectral method. The other saved first-cue render measured −33.74 LUFS. The new audition is approximately 15–16 LU louder. These comparisons refer to the existing local render artifacts; the earlier project and its renders were not modified.

Every one-second window from 2–28 seconds has RMS above −25 dBFS. New rhythmic triggers stop before 28 seconds while their short tails finish; the atmosphere continues through the final fade. RMS at 27–28 s is −19.94 dBFS, at 28–29 s −25.36 dBFS, and at 29–30 s −34.12 dBFS. The last PCM frame is zero. There is no long silent render extension.

Visual inspection confirms the launch sweep into the 16-second edit, recurring mechanical transients and energy motifs afterward, and the intentional closing fade. Verification here is analytical and visual; it is not a claim of a human headphone/speaker listening session. The supplied WAV/MP3 and isolated stems support that final aesthetic review.

## Checks

- Baseline `npm run check`: typecheck passed; 172 tests passed, zero failed/skipped.
- Focused source suite: 5 tests passed, zero failed/skipped. Two regeneration passes match all repository WAVs, kit and catalog exactly; authored project regeneration also matches.
- Focused real integration suite: 1 test passed, zero failed/skipped. Two real production renders match canonical master WAV, all twelve stems, analysis and manifest bytes; MP3 exports successfully. FluidSynth and SoundFont are intentionally unavailable to this test to verify sample-only independence.
- MCP regression after expanding the catalog: 10 tests passed, zero failed/skipped. The old one-kit expectation now checks the exact paths and complete hit names of both kits; existing coverage is preserved and strengthened.
- Final `npm run check`: typecheck passed; **178 tests passed, 0 failed, 0 skipped, 0 cancelled**, test duration 122,945.049177 ms. `git diff --check` and local documentation-link checks are clean.

The checks cover PCM format/rate/depth, unique source identities, headroom and endpoints, stereo distinction, kit validity, existing MCP discovery without warnings, project validation, loudness/true peak, no clipping before or after the master, frequency-role contrast, rising transition energy, short pulse recovery, full-duration activity, exact impact start, aligned stems and hash provenance.

## Environment readiness

FluidSynth, FluidR3 GM and FFmpeg are installed in this environment; the baseline real-audio tests run without skips. The existing `.devcontainer/devcontainer.json` has a non-interactive `sudo apt-get` post-create installation for all three tools, and the README documents system package installation. This is a privileged system setup, not a reusable unprivileged Linux bootstrap.

No repository script currently installs the complete audio toolchain into a user-owned prefix, resolves shared-library/runtime paths, and verifies the SoundFont plus executable overrides without sudo. Those are the missing pieces. No Cloud configuration or bootstrap implementation was attempted.
