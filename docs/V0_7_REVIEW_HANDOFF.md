# V0.7 adversarial review handoff

Status: **GO for an independent PR review**, not a merge or publication approval.
Branch: `feat/v07-sampler-articulation`, based on main
`c9899d823c39ace9373c89c20327104f61694080`. Verification: 2026-10-13.

## Change and contract

Read [V0_7_SAMPLER_ARTICULATION.md](V0_7_SAMPLER_ARTICULATION.md), then the diff
against the base above. Optional sampled-note `endSeconds`, `gate`, `envelope`
and `chokeGroup` are implemented in project validation, asset-aware compilation,
timeline propagation, both PCM mixers, provenance and the existing nine MCP tools.
No advertised control is missing. Groups are deliberately scoped to a track;
simultaneous output-frame onsets coexist and releases may briefly overlap.

Articulation is separate from V0.6 playback. Omission preserves historical source
reads, interpolation, offsets, natural tails and trigger records. Explicit slices
silence taps outside their selected source interval. Musical gates use differences
of rounded absolute boundaries, and seconds use exact microseconds followed by
nearest-frame rounding, ties later. Early stops reduce actual interpolation work
and allocated voice frames without increasing the existing limits.

Source or output exhaustion compresses overlapping fades without increasing the
authored attack gain or delaying a gate. Scheduled gates release from their current
attack level. Two review defects were fixed: entire short slices becoming silent,
and a roughly 31 dB attenuation cliff between 221 and 222 frames. Regression tests
cover both, including source/output threshold equality and gates during attack.

## Actual verification

| Check | Result |
|---|---|
| `npm run check` | Typecheck passed; 293 tests: 285 passed, 0 failed, 8 skipped |
| `node --test 'tests/v07*.test.ts'` | 32 passed, 0 failed, 0 skipped |
| `npm run build` | Passed |
| `npm run test:package` | 9 passed, 0 failed, 0 skipped; compiled articulation, real GM/effects/MP3/stems and MCP |
| `npm run demo:one-sound` | Passed; two fresh renders per version, exact duration, aligned stems, unchanged source, no clipping |
| `npm run smoke -- --mcp` | Passed; audio readiness, audible sample render, stdio and nine tools |
| `git diff --check` | Passed |
| Independent DSP review | 532,200 envelope cases and 400 randomized frame/tap-cost cases passed; no remaining concrete blocker identified |

The eight skipped tests are not passes:

- The historical real stdio audio session checks bare system `fluidsynth`/`ffmpeg`.
- The real production demo, GM demo, sampled six-stem demo, GM stem demo, and
  delayed/empty GM-track test remove configured renderer selection and require
  system-installed FluidSynth.
- Historical GLASSHOUSE and GLASS//FIRE gates require the recorded FFmpeg identity
  `6.1.1-3ubuntu5`; the configured tool reports `6.1.1`.

The configured rootless tools were exercised by package, pipeline, GHOST//SHIFT
stdio and standalone compatibility renders. This supplements those skips; it does
not mean the eight skipped assertion bodies ran. The apt-based full-audio workflow
remains useful for complete system-tool coverage.

## Compatibility and audible evidence

[V0_7_VERIFICATION.json](V0_7_VERIFICATION.json) records hashes and measurements.
A detached checkout of the main commit and the V0.7 worktree used the same Node
`v24.19.0`, FluidSynth `2.3.7`, FFmpeg `6.1.1`, and FluidR3_GM SHA-256
`74594e8f4250680adf590507a306655a299935343583256f3b722c48a1bc1cb0`.

All five masters and all 47 stems match byte for byte: sample-only demo, Orbital
Foundry, GLASSHOUSE, GLASS//FIRE and V0.6 GHOST//SHIFT. Projects, source asset
provenance, frame counts and stem identities also match. All four recorded V0.5
fixture master/stem sets match despite the tool-version-string skip predicates.
The old fixtures were not updated.

ONE SOUND uses the same original `06-low-boom.wav` for both versions. Each master
is exactly 352,800 frames with three aligned stems; each version's master, stems,
analysis and manifest match across two fresh directories. The opening original
stem is unchanged. Measured post-hit percussion RMS goes from 376.01 PCM units to
zero, and the bass gap goes from 1,864.73 to zero. True peaks are -10.09 dBTP before
and -11.4 dBTP after, with no clipped samples. Generated WAVs live under
`renders/one-sound/before/` and `renders/one-sound/after/`; regenerate with the
demo command above. Verification was analytical, with no human listening claim.

## Independent review request

Try to disprove the following, using an independent high-reasoning review:

1. No-articulation projects preserve V0.6 bytes and natural tails, including
   offsets, glides, production caps and per-voice rounding.
2. One/two-frame sources, nonzero offsets, mono/stereo taps, source endpoints,
   and accelerating/decelerating glides terminate on the correct exclusive frame.
3. Overlapping fades stay finite and bounded, have zero enabled boundaries,
   avoid threshold attenuation cliffs, and never rise after a gate/choke.
4. Chokes across clips, patterns and kit mappings remain track-local and
   independent of equal-frame enumeration; an existing release never restarts.
5. Metadata preflight and actual allocation agree after slices, gates, chokes and
   render caps, including pathological repeated voices and malformed inputs.
6. MCP failures remain transactional; failed renders remove stale/partial output;
   provenance hashes the original assets and distinguishes natural playback
   frames from articulated and capped frames.

Inspect `src/render/playback.ts`, both mixer seams, `src/sample-render.ts`, project
validation and asset bounds, then MCP schema/provenance. Run the commands above
with pinned tools; report skipped checks explicitly. Do not change the frozen
Round 3 challenge, Composer benchmark package or submissions. The entire plugins
tree, original sample assets, historical fixtures, site and promo trees are
unchanged in this branch.

## Remaining limitations

Explicit zero fades permit hard edges. One/two-frame voices with both fades enabled
are silent; tiny ramps and internal source discontinuities can have high-frequency
energy. Bounded voice gain adds no amplification, but sinc overshoot and summed
voices can still clip, with counts reported; there is no hidden limiter. Effects
retain their existing boundary/tail policies. Chokes are track-local, not a strict
one-voice polyphony limit during release. No loops, reverse, time stretching,
cross-track groups or streaming were added. The inherited copy path remains
outside the interpolation budget, and large sources still require decode memory.
