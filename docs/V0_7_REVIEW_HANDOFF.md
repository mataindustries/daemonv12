# V0.7 review handoff

Status: **independently reviewed; ready for the GitHub Actions release gate.** This is
not a merge or publication approval. Branch `feat/v07-sampler-articulation`
(PR #20), based on main `c9899d823c39ace9373c89c20327104f61694080`; main
`51b27c275cbe2e24dee7976ef65a5ddb256894c7` has been merged in. The verified code
is commit `9c601a5`; later commits on the branch change documentation only.

## Change and contract

Read [V0_7_SAMPLER_ARTICULATION.md](V0_7_SAMPLER_ARTICULATION.md), then the diff
against the base above. Optional sampled-note `endSeconds`, `gate`, `envelope`
and `chokeGroup` are implemented in project validation, asset-aware compilation,
timeline propagation, both PCM mixers, provenance and the existing nine MCP tools.
Groups are scoped to a track; simultaneous output-frame onsets coexist and
releases may briefly overlap. Omission preserves V0.6 source reads,
interpolation, offsets, natural tails and trigger records. Seconds use exact
microseconds then nearest-frame rounding (ties later); gates use differences of
rounded absolute musical boundaries.

## Independent adversarial review (2026-10-15)

A second reviewer, working from the diff against the base and not from the original
verification report, found **no correctness, security, determinism or
backward-compatibility defect**. Method and results (these runs used the reviewed head
`2ab34a9`; the fix below changes only the two mixers, and the choke/stem oracle, a
permutation run, an 80-case differential fuzz and the full suite were repeated on the
fixed head with the same outcome):

| Area | Evidence |
|---|---|
| Frame counts, one-frame slices, offsets, glides | 57,446 randomized cases against a brute-force first-crossing search; the one disagreement was the oracle's float rounding (exact BigInt arithmetic on the actual doubles confirms the engine) |
| Slice isolation | 38,802 cases: mutating source frames outside `[offset,end)` never changes a sliced voice (mono and stereo) |
| Gate and envelope at tiny durations | 2.43 million gain cases: finite, in `[0,1]`, never above the authored attack ramp, exact-zero first and last frames, unimodal, never rising after a gate or choke. Largest adjacent-source-length step at 30 frames or more is 1.585 dB; the old 31 dB cliff is gone |
| Chokes, overlap, simultaneous onsets | 180 random multi-track, multi-clip, drum-kit projects through the real CLI: 4,089 voices, 256 effective chokes; manifest provenance and **stem audio sample-exact** against an independent model. Shuffling notes, clips and patterns (24 projects, half production-mode) leaves audio and the trigger multiset unchanged |
| Tap budget and voice buffer | 54,862 cases: preflight cost never below recounted interpolation taps and bytes exact; near-limit stress renders as expected and over-limit projects are rejected before audio work |
| MCP schema and transactions | 26 hostile payloads (null, wrong types, `__proto__`/`constructor` keys, out-of-range, GM-track fields) rejected with project bytes unchanged; five racing patches on one `expectedSha256` yield exactly one winner; 9,000 articulated notes validate in under 0.5 s |
| Render provenance and cleanup | No host path in any manifest; a failed render removes master, stems and manifest from a fixed `--out-dir`; output inside `assets/` is refused and sources stay intact |
| Rounding | 430,000 seconds-to-frame values match exact BigInt arithmetic, including exact half-frame ties |

## Performance fix (review finding F1)

The reviewed head called `voiceGain()` per sample and channel for every voice,
including unarticulated ones, which slowed the unbudgeted copy path. Both mixers
(`mixPcm`, `sumFloat`) now evaluate one gain per output frame and skip the call for
unarticulated voices. Output bytes are unchanged. Median of seven, 400 voices of
105,840 frames, same machine:

| Path | Base 0.6.0 | Reviewed v0.7 | Fixed v0.7 |
|---|---|---|---|
| `mixPcm` mono, unarticulated | 481-595 ms | 795-878 ms | 463-465 ms |
| `mixPcm` stereo, unarticulated | 517-559 ms | 847-1,154 ms | 349-405 ms |
| `sumFloat` mono, unarticulated | 479-555 ms | 718-755 ms | 373-424 ms |
| `mixPcm` mono, articulated | n/a | 1,520-1,526 ms | 697-863 ms |
| `sumFloat` mono, articulated | n/a | 1,398-1,499 ms | 655-747 ms |

Wall-clock figures are informational. Two deterministic guards in
`tests/v07-articulation.test.ts` do not time anything: one counts gain evaluations
(exactly one per frame for mono and stereo sources, in both mixers; it fails on the
previous code) and one pins the historical per-voice rounding of unarticulated voices
in both mixers, plain and performed.

## Verification of the final head

Toolchain: Node v22.22.0 (the engines floor is 22.18.0; the original run used
v24.19.0), FFmpeg 6.1.1-3ubuntu5, FluidSynth 2.3.4 (the original run used 2.3.7),
FluidR3_GM SHA-256 `74594e8f4250680adf590507a306655a299935343583256f3b722c48a1bc1cb0`.

| Check | Result |
|---|---|
| `npm run check` (apt FluidSynth, SoundFont, FFmpeg) | typecheck passed; 295 tests, **295 passed, 0 failed, 0 skipped** |
| `npm run build` | passed |
| `npm run test:v07` | 34 passed, 0 failed, 0 skipped |
| `npm run test:package` | 9 passed, 0 failed, 0 skipped |
| `npm run demo:one-sound` | passed |
| `npm run smoke -- --mcp` | passed |
| `git diff --check` | clean |
| Node-only lane (no audio tools on `PATH`, as in Portable checks) | `npm run check`: 295 tests, 263 passed, 0 failed, **32 skipped**; `npm run test:package`: 8 passed, 1 skipped; MCP smoke passed |

## Compatibility

Compared with a detached checkout of the base commit, using the same tools and
`--stems --format wav,mp3`, all 11 shipped examples render **97 byte-identical
audio files** (WAV, MP3, MIDI, master and stems). Every manifest and analysis JSON
differs only at `/engine/version` (`0.6.0` to `0.7.0`). This includes the GHOST//SHIFT,
GLASS//FIRE, GLASSHOUSE and Orbital Foundry gates, which also pass as test gates against
their recorded 0.5.0 hashes. A differential fuzz of 340 random unarticulated performed
projects (rates, glides, offsets, tiny and stereo sources, production effects)
(260 on the reviewed head, 80 on the fixed head) produced 236 byte-identical renders and
104 identical rejections, with no mismatch.
Unarticulated `voiceSamples`, `voiceFrames` and `voiceCost` are bit-identical to the
base module across 3,832 randomized cases. No existing test assertion or skip predicate
was changed, and no file under `plugins/`, `promo/`, `site/` (apart from the merged
main change), `examples/assets/`, historical examples or fixtures differs from main.

## ONE SOUND

All twelve audio-derived recorded hashes (both masters, six stems, two analyses) reproduce
byte for byte across Node v22.22.0 and v24.19.0, FluidSynth versions and FFmpeg builds.
The two **manifest** hashes in [V0_7_VERIFICATION.json](V0_7_VERIFICATION.json) are
toolchain-bound: manifests embed the Node and FFmpeg version strings, and they matched
only after substituting `v22.22.0` with `v24.19.0` and `6.1.1-3ubuntu5` with `6.1.1`.
Gate on master, stem and analysis hashes; compare manifests only on an identical
toolchain. That JSON file remains the original author's record of the original run.

## The eight historical skips

In a bare environment 285 of 293 tests (before this change) passed and eight skipped;
none is a pass. They need system FluidSynth plus a SoundFont, and in the
originally recorded rootless environment also the FFmpeg identity string
`6.1.1-3ubuntu5`. With `apt-get install fluidsynth fluid-soundfont-gm ffmpeg` all eight
run and pass:

| Test | File |
|---|---|
| real stdio agent session | `tests/mcp.integration.test.ts` |
| real production demo | `tests/production.integration.test.ts` |
| real FluidSynth demo | `tests/render.integration.test.ts` |
| real sampled six-stem demo | `tests/samples.integration.test.ts` |
| real demo stems; real delayed and empty tracks | `tests/stems.integration.test.ts` |
| V0.5 real FluidSynth releases | `tests/v05-pipeline.test.ts` |
| Gate E GLASS//FIRE, and Gate D GLASSHOUSE where the FFmpeg identity differs | `tests/v06-compat.integration.test.ts` |

Which eight skip depends on the environment's FFmpeg identity; the count is eight in
both variants.

## Continuous integration

**Portable checks stays the intentional Node-only lane.** It does not install audio
tools, and its `smoke` step deliberately points them at nonexistent paths; that
workflow is unchanged. On the PR's head the push run passed and the pull-request run
failed once, in `tests/bootstrap.test.ts`: the fixture's 10 s `spawnSync` limit
expired (`status` null) while building a few-byte `tar -J` archive. The bootstrap test is
hermetic (fake downloads, no network), and neither it nor the script is touched by V0.7.
It did not reproduce in 25 sequential runs, or in 12 concurrent runs beside eight CPU
hogs on four cores, so no workflow or test change was made. Re-run the job if it
recurs, and escalate only if it reproduces.

The audio-dependent tests (32 in that lane, including V0.7 production and ONE SOUND
renders) run only in the manual **Full audio verification** workflow. Run it on this
branch before merging.

## Remaining limitations

Explicit zero fades permit hard edges. One- and two-frame voices with both fades
enabled are silent; tiny ramps and internal source discontinuities can have
high-frequency energy. Bounded voice gain adds no amplification, but sinc overshoot
and summed voices can still clip, with counts reported; there is no hidden limiter.
Chokes are track-local, not a strict one-voice polyphony limit during release.
Preflight tap cost can overcount for decelerating glides (safe, never under). The
copy path (rate 1, no glide) remains outside the interpolation budget, and large
sources still require decode memory. No loops, reverse, time stretching,
cross-track groups or streaming were added. No human listening session is claimed.
Same-tick onsets are the only way output frames coincide, since one tick is at
least nine frames at the 300 BPM limit.

Composer v0.2 and the frozen Round 3 inputs are unchanged. Composer v0.2 predates V0.7
and tells agents not to use choke or note-off controls; Round 3 stays pinned to its
own engine commit, not to main. A future release that uses V0.7 should pin an engine
commit SHA and the tool versions above.
