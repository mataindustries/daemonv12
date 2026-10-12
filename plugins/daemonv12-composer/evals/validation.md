# V0.2 validation record

Validated on 2026-10-12 from frozen Composer v0.1
`56dbdff62bf78e70e898f0dbb49f8044cd561655`, with unchanged engine files matching
`ed75e9e2a0172266e56b292886ad7c1500677862`. v0.1's validation record remains in
that frozen revision. All implementation changes are within
`plugins/daemonv12-composer/`; no Round 3 composition was started.

## Executed package and engine checks

- Official Agent Plugins 1.0 schema validation: passed with Ajv's Draft 2020-12
  validator, strict mode. Bundled schema is unchanged from its
  [canonical source](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json).
  SHA-256: `0a4aad95ce337878ad38802ebf0daa3fde76abe3f65400c86bcbb1ec0b3ab883`.
- YAML frontmatter, skill name/description, local links, UTF-8, final newlines,
  trailing whitespace, balanced fences, eval-fixture integrity and Composer-only
  tracked diff: passed. Six package mutation tests and one CLI symlink regression
  passed: **7 tests, zero failed or skipped**. Full package validation also passed
  through a symlink with and without `--preserve-symlinks-main`.
- The skill-creator Python quick validator could not import PyYAML in this
  environment. The standards YAML parser and frontmatter mutation checks in the
  package validator passed; no repository dependency was added for that check.
- Root `npm run typecheck`: passed. Root `npm test`: **261 passed, zero failed,
  zero skipped**, including real audio, compatibility, deterministic rendering,
  automation, pan, sampler performance and resource checks.
- Doctor: all intended readiness flags passed on recheck, using Node 22.23.3,
  FFmpeg 6.1.1-3ubuntu5, FluidSynth 2.3.4 and the existing FluidR3_GM SoundFont
  (`74594e8f4250680adf590507a306655a299935343583256f3b722c48a1bc1cb0`).
  Initial audio-tool probes timed out; direct executable checks, real
  integrations and the recheck succeeded without an engine/configuration edit.
- New JavaScript syntax checks and `git diff --check`: passed. The repository
  has no separate lint command; typecheck and package text checks are recorded
  rather than claiming an unrun linter.
- Section helper: **14 deterministic synthetic and CLI tests passed, zero failed or
  skipped**. Coverage includes sample boundaries, mono/stereo, silence, louder,
  bass/low-mid/bright sections, activity, differing/anti-phase/balance-only stereo,
  formats, malformed input, nonfinite values, CLI errors, block/section-edge
  impulses and unavailable bands at low sample rates. The symlink regression
  covers relative invocation, both symlink modes and silent library imports.
  No contestant audio was used.

Temporary Ajv/YAML test dependencies live under `/tmp`; the root manifest,
lockfile and engine dependencies are unchanged. Reproduction commands are in
[the eval plan](README.md).

## Activation: metadata-only audit

An independent agent received only the skill's exact name/description and
requests with expected labels hidden. The original thirteen requests were
evaluated together in one fresh context; three exact request forms were audited
in a supplemental turn. These were **16/16 matches**, ten positive and six
negative. This is neither fresh per-prompt host activation nor a cross-model
routing reliability result.

| Request | Expected / observed |
| --- | --- |
| Make a DaemonV12 beat. | Activate / Activate |
| Produce a 30-second cue in DaemonV12. | Activate / Activate |
| Improve this DaemonV12 song. | Activate / Activate |
| Make me a DaemonV12 beat. | Activate / Activate |
| Compose a 30-second boss cue with DaemonV12. | Activate / Activate |
| Improve this DaemonV12 track. | Activate / Activate |
| Use DaemonV12 to make a garage song. | Activate / Activate |
| Produce a new music loop through DaemonV12. | Activate / Activate |
| Make this DaemonV12 drop hit harder. | Activate / Activate |
| This DaemonV12 track sounds too safe. | Activate / Activate |
| Explain what DaemonV12 is. | Ignore / Ignore |
| Fix the DaemonV12 README. | Ignore / Ignore |
| Review a DaemonV12 pull request. | Ignore / Ignore |
| Change the sampler implementation. | Ignore / Ignore |
| How does FluidSynth work? | Ignore / Ignore |
| Make this Ableton Live mix hit harder; DaemonV12 is not part of this project. | Ignore / Ignore |

## New scenarios: independent reasoning audit

A separate fresh agent read the skill/references and raw hypothetical
observations, with eval acceptance criteria hidden. It generated no audio,
built no tooling and claimed no measurements or listening. All eight
diagnosis/action choices matched the intended behavior in this limited scope:

| Case | Supplied observations | Observed diagnosis and next action |
| --- | --- | --- |
| A / B11 | Hook at zero; first note/downbeat and groove emphasis disconnected. | Diagnose opening continuity; shift/rephrase the gesture or handoff, compare first 5 seconds, preserve identity. |
| B / B12 | V3 clean, coherent, balanced, complete; supplied human “too safe.” | One thesis-related pre-return gap risk; anticipation upside versus lost-momentum downside; cheap edit/excerpt test and keep/revert criterion. |
| C / B13 | Payoff +2 LU but softened attacks, contracted register, similar channels. | Impact Test; inspect masking, processing, register and differing content; restore a leading attack/register before gain. |
| D / B14 | Strong V4, two tiny revisions, proposed analyzer for uncertain 300 Hz detail. | Reject tooling without a musical decision; compare existing versions, keep stronger and stop speculative iteration. |
| E / B15 | Bass, pad and distorted tails overlap 120–500 Hz; supplied “boxy.” | Restore role hierarchy through spacing/register/source/tail changes; preserve body and avoid blanket EQ. |
| F / B16 | Identical mono doubles hard panned; supplied correlation 1. | Verify balance/source duplication; test differing answers/register/timbre if expansion is intended; correlation alone is not a defect. |
| G / B17 | Valid exciting pitch dive; supplied restart disconnect. | Compare shorter gesture or opening-related callback via final 3 seconds plus restart and whole arc. |
| H / B18 | Strong V4; V5 asks for metrics/layers without an audible expectation. | Reject V5 and lock strong V4 after required reviews/Risk Pass and technical checks; unused budget is not a reason to render. |

The agent cited `src/render/production.ts` for balance/mono duplication,
`src/audio-types.ts` for supported filters/effects and `src/render/playback.ts`
plus `docs/V0_2_SAMPLES.md` for source-ended sample duration. These outcomes do
not prove rendered improvement, perceived scale or memorability.

## Adversarial review and fixes

The ten requested challenges were reviewed independently and by the author.

- No fixed genre, song, source, key, BPM or winning structure is encoded.
  Ambient/cinematic pacing and intimate arrivals are explicit alternatives.
- Risk has one thesis-related hypothesis, upside/downside, cheap comparison,
  revert and evidence-based keep-original paths; it does not reward random novelty.
- The stop wording initially conflicted with necessary defect repair in a
  reference. Core/reference now agree: end speculative marginal polishing,
  complete required review/Risk Pass and address demonstrated defects before
  claiming a clean lock; repairs retain hypothesis/budget requirements.
- Bands remain descriptive evidence; no frequency share, loudness, event count,
  correlation or side-energy quality target is prescribed.
- Native reports own whole-file delivery metrics. The helper adds arbitrary
  local sections and comparisons, without engine imports, dependencies or dashboards.
- Core SKILL is shorter than v0.1 and keeps detail in references. Benchmark
  ceremony is opt-in at the end; historical handoffs stay outside normal use.
- Human observations are generalized into musical questions, without entry
  identities or a universal improvement claim.
- The helper's initial disjoint Hann windows could omit block-edge impulses.
  Overlapping coverage and a boundary-impulse regression address the defect.
- Low-rate WAVs initially reported misleading band bounds/zero unmeasurable
  high energy. Explicit effective band availability addresses the ambiguity.

Plain numbered decisions and a compact log support smaller-model use.

## Completed small-model smoke test

A real Haiku 5.5 small-model smoke test completed successfully. The V1/V2/V3
workflow completed, and one Risk Pass was tested as V4. V4 was retained based on
evidence; compute discipline stopped before V5. The final result passed human
listening, and the deterministic rerender matched. The engine and skill remained
unchanged during the smoke test.

## Outstanding scope

The full B01–B18 matrix remains a plan for observed behavioral runs. The eight
reasoning audits above are only diagnosis checks; the completed smoke test
exercises B06's actual three-version composition workflow. Installed-host
activation, broader cross-model evaluation, actual cross-device listening and
human blind judgments of musical improvement remain unperformed. No benchmark
was initiated.
