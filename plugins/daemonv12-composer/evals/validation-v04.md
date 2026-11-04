# Composer 0.4 validation

Date: 2026-10-25. Base: Signature feature branch commit
`17468e7ee1df11b8cef361cf4e49601d5f671589` (playbook included).
Node v24.19.0; FFmpeg 6.1.1; FluidSynth 2.3.7. Ajv 8.17.1 and YAML 2.8.1 were
installed in `/tmp/daemonv12-composer-validation-tools`, outside the repository.
No root dependency or lockfile change.

## Executed checks

| Check | Actual result |
| --- | --- |
| Original Ajv/YAML package suite | 9 passed, 0 failed, 0 skipped |
| Offline frontmatter/package mutations | 7 passed, 0 failed, 0 skipped |
| Production recipes, real renders enabled | 15 passed, 0 failed, 0 skipped; all ten unchanged projects rendered with aligned stems and no clipped/full-scale samples |
| Existing review-sections helper | 14 passed, 0 failed, 0 skipped |
| Original package CLI and offline package CLI, explicit stacked base | Passed: official manifest schema, frontmatter, local links, text hygiene, 16 activation fixtures, 24 behavioral plan entries, Composer-only tracked diff |
| Full `npm run check` | Typecheck passed; 317 tests passed, 0 failed, 8 skipped (325 total) |
| Targeted real-audio follow-up | 10 passed, 0 failed, 0 skipped; exercises all six GM/MCP cases skipped by the full run |
| Doctor with normal subprocess access | Passed; all readiness flags true |
| Signature guidance snapshot cross-check | All 16 names, roots, recommended ranges and source lengths match the installed catalog |
| Existing behavioral fixture preservation | B11–B18 records unchanged; B19–B24 appended, status remains planned |
| `git diff --check` | Passed |

The new package test copies both the complete plugin and the direct skill into
fresh temporary directories outside the repository, without Signature files.
It checks local resources/links, skill metadata and manifest validity there.
This establishes package portability; it does not simulate installed-host
activation or model behavior. Engine-dependent developer recipe tests still
run from a matching engine checkout, as before.

The recipe fixture JSON and its original provenance pin remain unchanged.
Its isolation assertion now uses the actual stacked release base; comparing
against the old v0.3 engine commit also includes legitimate pre-existing MORPH
and Signature additions. All source/asset isolation checks remain enabled.

Commands from the repository root:

```sh
COMPOSER_VALIDATORS_DIR=/tmp/daemonv12-composer-validation-tools node --test plugins/daemonv12-composer/evals/package.test.mjs
node plugins/daemonv12-composer/evals/validate-package.mjs --validators-dir /tmp/daemonv12-composer-validation-tools --base 17468e7ee1df11b8cef361cf4e49601d5f671589
python plugins/daemonv12-composer/evals/validate-package-offline.py 17468e7ee1df11b8cef361cf4e49601d5f671589
python plugins/daemonv12-composer/evals/offline-package.test.py
COMPOSER_RENDER_RECIPES=1 node --test plugins/daemonv12-composer/evals/production-recipes.test.mjs
node --test plugins/daemonv12-composer/skills/daemonv12-composer/scripts/review-sections.test.mjs
npm run check
node bin/daemonv12.js doctor --json
PATH="$(dirname "$DAEMONV12_FLUIDSYNTH"):$PATH" node --test tests/mcp.integration.test.ts tests/production.integration.test.ts tests/render.integration.test.ts tests/samples.integration.test.ts tests/stems.integration.test.ts
git diff --check
```

## Environment failures and reruns

The initial restricted sandbox run of `npm run check` passed typechecking but
returned **38 passed / 14 failed file-level tasks (52 total)**. Node child-process
capture returned EPERM or empty output. Restricted package/helper runs also
failed their subprocess checks (package: 7/9 with isolation disabled; helper:
12/14), and the restricted doctor timed out probing FluidSynth. These are failed
runs, not counted as passing tests. The authorized normal-subprocess reruns
above resolve the package/helper/doctor failures and run the full suite without
failed tests without editing the tests or
engine to suppress failures. No network policy or audio configuration was changed.

The first recipe attempt also exposed its obsolete v0.3 isolation base, before
running fixtures; the small base correction described above preceded the passing
15-test run. No recipe project or audio was changed.

## Full-suite skips

Six real GM/MCP integration cases probe `fluidsynth` on PATH, rather than the
configured `DAEMONV12_FLUIDSYNTH` path, and skipped in the full run. A targeted
follow-up adds the already configured audio-tool directory to that command's
PATH only: **10 passed, 0 failed, 0 skipped**, including all six previously
skipped cases. Four additional cases in those files also passed again.

Two v0.6 historical byte-compatibility gates (GLASSHOUSE and GLASS//FIRE) remain
skipped because their recordings used FFmpeg `6.1.1-3ubuntu5`; this environment
has `6.1.1`. The Signature showcase integration also explicitly omits its
recorded-build byte comparison for that mismatch, while passing its duration,
stem alignment, headroom, mono-low-end and section checks. These skipped
comparisons are not claimed passed. No alternate golden audio was written.

## Evidence limits

B01–B24 agent behavioral runs, fresh installed-host activation and human listening
are **unperformed**. No Astra/Sol/Opus comparison, automatic musical quality score
or behavioral improvement is claimed. The [fair test launch](composition-test-v04.md)
provides frozen-input setup, identical prompt, budgets, feedback conditions,
blind judging and deterministic final verification for later execution.

All changes are under `plugins/daemonv12-composer/`. Engine, audio, instruments,
existing compositions, BANGER LAB 001 and historical validation records are
unchanged. Signature remains optional and its audio is not redistributed with
this plugin; the installed catalog/provenance remain authoritative. No new
synthesis/analysis infrastructure or benchmark harness was added.
