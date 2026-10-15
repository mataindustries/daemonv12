# V0.3 validation record

Composer v0.3.0 targets engine v0.7.0 at
`02438eda48506a94d10ad2756c6aafff8c5a9469`. All changes are confined to
`plugins/daemonv12-composer/`. The user supplied the verified Opus Phase 0
recommendations in this session because the full audit was not saved in the
repository. Normative engine documentation/source governs any conflict.

Historical [v0.2 validation](validation.md), [v0.2 eval plan](README-v02.md),
Round 2/3 materials, original benchmark assets and audio projects are preserved.
No BANGER LAB entry, PR #22 change, merge, deployment or engine DSP build is part
of this work.

## Executed checks

- Recipe contract/production suite: **15 passed, 0 failed, 0 skipped**, including
  ten asset-aware and real CLI validations/renders, valid controls/defaults,
  rejected invented/malformed controls, exact tempo/cue timing and aligned stems.
- Existing v0.7 suite with Node 24 `--test-isolation=none`: **34 passed, 0 failed,
  0 skipped**. Includes real production, MCP, original ONE SOUND comparison,
  byte-repeatability, track-local/same-frame chokes and envelope boundaries.
- Offline package validation: **passed**, including official schema, unique-key
  YAML frontmatter, shared JS text/link/fixture/isolation checks and negative
  probes. JSON parses, JS/Python syntax and `git diff --check`: **passed**.
- Existing review-sections suite with `--test-isolation=none`: **12 passed,
  2 failed** in CLI tests with empty captured output/JSON parse errors. These
  two original tests are **BLOCKED by sandbox subprocess capture**, not passed.
  Equivalent real CLI JSON/error/help, relative/symlink (both modes) and silent
  import checks passed using Python subprocess capture and synthetic WAV input.
- Existing v0.5/v0.6 suites with `--test-isolation=none`: **45 passed, 2 failed,
  3 skipped (50 total)**. Both failures are real stdio MCP `CONNECTION_CLOSED`
  outcomes (v0.5 MCP and GHOST//SHIFT integration), which remain unresolved here.
  The three skips are FluidSynth probe timeouts (two) and a recorded FFmpeg build
  mismatch (one). Timeline, automation, dynamics, resource, rate/glide/offset and
  sample production checks passed. This suite is **not green**; rerun it in CI.
- Original Ajv/YAML package test suite and `validate-package.mjs`: **BLOCKED**
  (`Cannot find module 'ajv/dist/2020.js'`); neither is claimed passed.
- `npm run check`: typecheck **passed**; default isolated test runner returned
  **33 passed / 12 failed file-level tasks (45 total)**, not 295 passing tests.
  The full suite is **not green** and must run later outside this sandbox.
  Its affected files include CLI/demo-share/doctor/init/MCP integration,
  production-pipeline/render-adapter/samples/smoke/stems, v0.5 MCP and v0.6 demo.
  Captured-child EPERM/empty output and audio tool readiness need normal CI
  verification; no engine files were changed to work around them.
- Doctor: sampler, production effects, MP3, loudness analysis and MCP ready;
  General MIDI readiness **blocked** by FluidSynth probe timeout. Actual sampler
  recipe rendering and true-peak analysis succeeded with installed FFmpeg.

Commands used from the engine root:

```sh
python plugins/daemonv12-composer/evals/validate-package-offline.py
COMPOSER_RENDER_RECIPES=1 node --test --test-isolation=none plugins/daemonv12-composer/evals/production-recipes.test.mjs
node --test --test-isolation=none tests/v07*.test.ts
node --test --test-isolation=none tests/v05*.test.ts tests/v06*.test.ts
node --test --test-isolation=none plugins/daemonv12-composer/skills/daemonv12-composer/scripts/review-sections.test.mjs
npm run check
node bin/daemonv12.js doctor --json
git diff --check
```

Toolchain: Node v24.19.0; installed FFmpeg 6.1.1. The schema file and historical
records are unchanged. No root dependency/lockfile or network policy edit.

### Validated production recipes

All projects export **75,600 frames**, one 4/4 bar at engine-quantized 140 BPM,
with a fixed bars duration and no tail. Track/master overload counts and master
full-scale sample counts are zero; all stems match the master frame count.
These are measured fixture results, not promised ceilings or listening scores.

| Recipe | Stems | Measured master true peak (dBTP) |
| --- | ---: | ---: |
| Tight gated bass | 1 | -20.44 |
| Kick/bass spacing | 2 | -19.27 |
| Hat/percussion chokes | 2 | -16.17 |
| Pitched/sliced hook | 1 | -22.50 |
| Swing offsets | 1 | -19.58 |
| Gain pumping | 1 | -26.22 |
| Glide riser | 1 | -20.46 |
| Glide tape stop | 1 | -20.46 |
| Filter transition | 2 | -21.64 |
| Master saturation | 1 | -22.75 |

Fixtures and full field values are in
[production-recipes.json](../skills/daemonv12-composer/references/production-recipes.json).
Temporary production outputs are removed by the smoke test; the test prints
these measurements for reproduction. No existing project/assets were edited.
Ajv/YAML are unavailable locally or in the npm cache. The registry/proxy EPERM
blocked installation; no retry, sudo or network reconfiguration was used after
the user's instruction. The offline alternative uses installed PyYAML 6.0.3 and
Python jsonschema 4.26.0 against the unchanged bundled Draft 2020-12 schema,
plus the actual shared JavaScript package checks. It does not stand in for the
unrun Ajv/YAML mutation suite.

## Source verification

- Sample controls/defaults, precision, GM rejection and repair aliases:
  `docs/V0_7_SAMPLER_ARTICULATION.md`, `src/project/validate.ts`.
- Rounded source bounds and asset-aware validation: `src/pipeline.ts`.
- Track-local/same-frame choke resolution, gate boundary differences and
  articulation provenance: `src/sample-render.ts`.
- Slice interpolation, coupled rate/length, output ramps and limits:
  `src/render/playback.ts`, `src/render/pcm.ts`, `src/render/production.ts`.
- Duration/tails, quantized tempo, absolute cue and automation frames:
  `docs/V0_5_TIMELINE_DYNAMICS.md`, `src/timing/musical-time.ts`,
  `src/timing/wall-time.ts`, `src/timing/render-plan.ts`.
- Supported effects, gain/pan, saturation limits and stage order:
  `src/audio-types.ts`, `src/render/dynamics.ts`, `src/render/production.ts`,
  `src/render/ffmpeg.ts`, `src/render/analysis.ts`, `src/sample-render.ts`.
- Rate/glide/offset continuity and compatibility:
  `docs/V0_6_SAMPLE_PERFORMANCE.md`, `docs/V0_7_REVIEW_HANDOFF.md`.

## Evidence limits

B04/B08 now accept correct v0.7 articulation and reject invented fields.
Automated contract tests exercise those fields; they do not prove an agent
follows the behavioral matrix. B01–B18 observed model runs, fresh installed-host
activation and human listening remain separate and unperformed in this upgrade.
No independent reviewer has yet reviewed v0.3. Saturation does not guarantee a
true-peak ceiling; filter transitions and pumping are authored approximations.
No required engine change was found.

## Follow-up in Codespaces or GitHub Actions

Run the original Ajv/YAML package validator/mutation suite, all fourteen original
review-sections tests, and `npm run check` with working subprocess capture and
ready audio tools. Use the existing full-audio verification lane for tool-pinned
compatibility gates, including the recorded FFmpeg build. Repeat the new recipe
suite with `COMPOSER_RENDER_RECIPES=1`. Do not interpret blocked checks as passes.
Composer v0.3 is ready for independent review with these environment limitations
visible; merge/release readiness requires the outstanding checks. No deployment,
PR #22 modification or BANGER LAB composition was performed.
