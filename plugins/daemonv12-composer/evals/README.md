# Composer V0.3 evaluation plan

This is a small repeatable test matrix, not an autonomous quality guarantee. Status: **planned; behavioral runs pending**. A static review can establish that instructions cover these cases; it cannot establish that an agent follows them or that a listener likes the result. Record those separately.

## Procedure

1. Freeze the plugin commit, engine commit, task prompt, available packs and tool versions. Give each model the same files and input evidence in an isolated output directory.
2. Test activation in a fresh context for each entry in [activation-cases.json](activation-cases.json). Expose the skill's name and description through the host's normal skill discovery mechanism without explicitly invoking it. Record selection and compare with `shouldActivate`; all sixteen cases should match. If only a text-based routing audit is available, label it as such, not as a host integration test.
3. For each behavioral case below, explicitly load [SKILL.md](../skills/daemonv12-composer/SKILL.md) and its relevant references. Use a fresh context, provide the scenario as a fixture, and request a diagnosis and revision plan. Clearly identify fixture observations as supplied evidence, not measurements performed by the agent. Require a source citation for engine claims.
4. For the iteration case, run the actual composition/render workflow and retain artifacts. Diagnostic text alone cannot pass that case. For other cases, score reasoning first; optional rendered revisions can later validate the proposed musical change. [behavioral-cases.json](behavioral-cases.json) provides the eight new V0.2 scenario fixtures. Its observations are hypothetical supplied evidence, not audio measurements or listener results. Keep fixture expectations hidden from the model being evaluated.
5. Record pass, fail or blocked, with transcript/artifact evidence. A missing tool, absent audio fixture or unrun render is blocked, never a pass. Use the same acceptance criteria for each model. Human blind listening remains the way to assess perceived improvement and replayability.

Suggested result fields: `case_id`, `model`, `plugin_commit`, `engine_commit`, `prompt`, `fixture_paths`, `tool_versions`, `status`, `observed_evidence`, `artifact_paths`, `limitations`. Keep results in contestant output directories, not in this shared plan.

## Behavioral matrix

| ID | Fixture / task | Observable pass criteria | Failure signal |
| --- | --- | --- | --- |
| B01 Early hook | A 28-second piece has anonymous texture for 0–7 seconds, a distinctive hook at 8 seconds, and its strongest development after 17 seconds. Ask for improvement without changing genre. | Reviews the first 5 seconds separately; identifies delayed identity; proposes a recognizable hook fragment, rhythmic identity or intentional curiosity in roughly the first 3–5 seconds; preserves useful later development. A quiet opening may remain quiet when its identity is clear. | Merely increases intro gain, waits for the late highlight, or requires every genre to begin at full density. |
| B02 Weak ending | A strong payoff ends with an unrelated transformation and an extended tail that makes replay feel awkward. | Reviews the final 3 seconds and the replay transition; names the musical disconnect; proposes a concise hit, opening callback, purposeful loop-back, or cleaner tail appropriate to the thesis. May retain the effect if it serves the ending. | Treats the waveform stopping as a sufficient ending, preserves the gimmick without examining its role, or bans tape stops categorically. |
| B03 Small payoff | Master is unclipped and its integrated LUFS looks ordinary, but the payoff loses bass weight and kick impact while adding midrange layers. | Diagnoses why the payoff can feel smaller despite acceptable aggregate metrics; checks bass authority, transients, register, upper mids, top end, stereo contrast, harmonic density, automation and section contrast; prioritizes a few supported changes. | Raises master gain or chases a universal LUFS target as the primary cure. |
| B04 Bass masking | A sustained sub overlaps kick attacks and another low-pitched transformed sample. Energy accumulates across events. | Inspects arrangement and stems; checks overlaps, note/source lengths, monophony where appropriate, tuning and masking; uses v0.7 `gate`, `endSeconds`, output-time envelope and track-local `chokeGroup` where appropriate; checks release overlap, same-frame coexistence and cross-track kick/bass spacing; validates source bounds and supported gain/effect changes. | Globally brightens everything, adds more bass, rejects valid v0.7 gates/chokes, assumes cross-track/strict monophonic chokes, or invents arbitrary MIDI note-off. |
| B05 Gain automation | Static track gain is −9 dB; the first gain automation point is at 2 seconds with value −3 dB. Ask what happens before and after it, and how to preserve a −9 dB baseline through a later swell. | Reads the checked-out spec/source; states −9 dB before the first point and −3 dB from that point, not −12 dB; treats subsequent values as absolute; checks outgoing transition semantics and dB interpolation before constructing a ramp. | Assumes additive automation or confuses the point's transition with the preceding segment. |
| B06 Meaningful iteration | Compose a complete 25–30 second record through DaemonV12 using the skill, with environment tools available. | Retains at least V1, V2 and V3 as distinct complete rendered versions; each revision follows three specific musical weaknesses and a proposed fix; records changes and their observed consequences; completes final review and Risk Pass, addresses demonstrated defects within the hypothesis/budget rules, and discloses constrained blockers before lock. | Counts metadata-only edits, identical rerenders, three output formats or analysis-only runs as three serious versions; declares V1 final. |
| B07 Metrics serve music | Supply two candidate revisions: one has more tracks/events/effects and higher loudness, while the other makes the hook clearer and the payoff more distinct. Ask which deserves development. | Uses metrics as evidence for a musical judgment; discusses hook, groove, contrast, masking and replayability; acknowledges limits of a listening proxy and requests human judgment when needed; does not rank by counts or loudness alone. | Awards quality for event count, automation count, effect count or LUFS without relating them to the brief. |
| B08 Feature grounding | Ask for a pitched sampler chop with `pitch`, `duration`, a playback-rate glide and source offset, plus v0.7 end/gate/envelope/choke controls and an unfamiliar effect. | Checks the current schema/spec; distinguishes GM note controls from sampler controls; flags unsupported sampler fields; verifies coupled pitch/rate/duration, rate-glide semantics, offset units, rounded slice bounds and remaining source length; accepts valid v0.7 controls/defaults, distinguishes gate/choke from arbitrary MIDI note-off, checks release overlap; rejects invented aliases/effects and validates with assets. | Invents fields, assumes time-stretch, treats source offset as score timing, or copies obsolete behavior (including rejecting supported v0.7 articulation). |
| B09 Normal / benchmark boundary | Run once with a normal music request and once with Benchmark Mode explicitly enabled and a supplied engine commit. | Both use the musical workflow and iteration minimum. Only benchmark run enforces the supplied engine lock, contestant isolation, no competitor inspection, fixed iteration policy, metrics log, deterministic final WAV verification and clean submission; records any determinism blocker rather than claiming success. | Adds benchmark ceremony to every casual request, reads competitor files, silently changes the engine commit, or runs Round 2 without instruction. |
| B10 Honest verification | Provide a headless environment where live playback fails but offline tools may be present, and withhold stereo/spectral measurements. | Uses doctor and supported offline checks; consults the optional headless reference only if needed; distinguishes actual measurements, score-based inferences and unknowns; does not automatically install a wrapper or claim to have heard the music. | Automatically changes global audio configuration, fabricates listening or missing metrics, or equates a render passing validation with musical quality. |
| B11 Awkward but distinctive opening | Signature hook starts at zero, but the first beat obscures the pulse and its phrasing does not lead into the groove. | Separately examines 1-second impression, 3-second identity and 5-second continuity; diagnoses context and deliberate gesture; tests a focused timing/trim/pickup/answer change in the full entrance. | Passes solely on hook presence, or increases opening gain. |
| B12 Technically perfect but safe | V3 is clean, coherent, balanced and complete, but predictable. | Invokes a Risk Pass; proposes exactly one thesis-related risk, upside, downside, cheap test and keep/revert criterion; may revert or retain the original based on musical evidence. | Polishes forever, bundles unrelated risks, or equates random strangeness with improvement. |
| B13 Louder but smaller payoff | Payoff loudness rises while attacks, width contrast and useful register range decrease; sustained layers accumulate. | Uses the Impact Test to connect physical evidence and musical consequence; prioritizes a focused supported arrangement change; treats values as proxies and accommodates sparse arrivals. | Uses master gain as the primary cure or loudness as proof of scale. |
| B14 Over-analysis loop | At V4, two recent revisions are marginal; another analyzer is proposed for a tiny uncertainty with no decision attached. | States hypothesis, minimum evidence, cost and keep/revert criterion; rejects unnecessary tooling; compares candidates and stops if final checks pass. A genuine concern or explicit user override can justify more work. | Builds tools for more numbers, or treats five versions as an engine limit. |
| B15 Low-mid buildup | Bass calls, pads, distorted sources and tails overlap around 120–500 Hz; some body is desirable. | Reasons about overlap, register, source length, tails and supported filtering; tests one arrangement change while preserving useful warmth. | Treats the band as universally bad, invents EQ, or cuts all body. |
| B16 Width | Mono-source pan movement fails to produce expected payoff width. | Checks current balance/pan implementation; distinguishes positioning from differing stereo content; tests supported answers/doubles/section contrast; checks mono and phase-dependent width. | Claims pan creates decorrelation or treats maximum side energy as a target. |
| B17 Replay relationship | Technically interesting ending introduces an unrelated texture and long tail, weakening the restart. | Reviews final 3 seconds and end-to-start flow; compares thesis-related alternatives and keeps a technique only if it serves replay. | Chooses effect novelty over consequence, or considers file validity sufficient. |
| B18 Correct decision is stop | V4 passes final checks; Risk Pass was tested and reverted; two revisions were marginal and V5 has no audible hypothesis. | Locks the stronger V4, records stop rationale and deterministic verification; recognizes exceptions for explicit user overrides or a real new defect. | Renders V5 to fill a count or invents a new analysis project. |

B05's expected semantics are grounded in `docs/V0_5_TIMELINE_DYNAMICS.md` (Gain and pan automation), `src/render/production.ts` (`automatedGainPan`) and `tests/v05-timeline-automation.test.ts`. B04/B08 also use `docs/V0_7_SAMPLER_ARTICULATION.md`, `src/project/validate.ts`, `src/pipeline.ts`, `src/sample-render.ts` and `src/render/playback.ts`. B02/B17 must respect glide rate floor/source exhaustion and gated endings; B15 can use slice/gate/envelope for tail buildup. Video handoffs must use fixed duration/tails and engine-resolved cue frames; saturation never certifies a true-peak ceiling. Recheck these in the chosen engine commit before running; record genuine engine changes rather than forcing obsolete expected behavior.

## V0.3 acceptance and follow-up

- Structural validation: manifest parses, YAML front matter has `name` and `description`, referenced files exist, no engine implementation diff.
- Activation: all ten positive and six negative cases match in the declared test mode. The original cases remain alongside the exact v0.2 request forms. Keep static routing audit and actual host activation results separate.
- Behavioral readiness: all B01–B18 meet their criteria in observed runs; any pending or blocked case remains explicitly outstanding. The skill can ship with this plan while reporting that those runs have not yet happened. Text-only reasoning checks do not prove rendered improvement.
- Musical outcome: compare the before/after render blind with a human listener. Ask about hook, groove, payoff size, ending and desire to replay. Treat the result as evidence for future skill revisions, not permission to copy a winning song.

Run the same matrix after changes to the skill or relevant engine semantics. Include an ambient or cinematic fixture with a consequential arrival rather than a drop; the pass criteria do not require maximum density, drums or loudness. No giant harness or automatic benchmark execution is required.

## Repeatable package checks

The validator uses temporary standards libraries, not repository dependencies. It validates the manifest against the bundled unmodified [Agent Plugins 1.0 schema](fixtures/plugin.schema.json), parses YAML frontmatter, checks package-local links and text hygiene, checks evaluation-fixture integrity, and compares tracked changes against an explicit release baseline. For v0.3, that baseline is engine commit `02438eda48506a94d10ad2756c6aafff8c5a9469`. The schema was retrieved from its [canonical source](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json) on 2026-10-12. These are package checks; they do not simulate skill selection or grade musical quality.

```sh
npm install --prefix /tmp/daemonv12-composer-validation-tools --ignore-scripts --no-audit --no-fund ajv@8.17.1 yaml@2.8.1
COMPOSER_VALIDATORS_DIR=/tmp/daemonv12-composer-validation-tools node --test plugins/daemonv12-composer/evals/package.test.mjs
node plugins/daemonv12-composer/evals/validate-package.mjs --validators-dir /tmp/daemonv12-composer-validation-tools --base 02438eda48506a94d10ad2756c6aafff8c5a9469
node --test plugins/daemonv12-composer/evals/production-recipes.test.mjs
node --test plugins/daemonv12-composer/skills/daemonv12-composer/scripts/review-sections.test.mjs
npm run check
git diff --check
```

The v0.3 release command above must retain its explicit `--base`; omitting it compares against historical v0.1 and incorrectly includes legitimate later engine changes. `--base <commit>` changes the comparison base; the historical default remains frozen V0.1 `56dbdff62bf78e70e898f0dbb49f8044cd561655`. The validator checks tracked HEAD/index/worktree changes, so run it again after committing. Pre-existing unrelated untracked user files are outside that comparison. Mutation tests verify that invalid manifest fields, frontmatter, links, encoding, fences, fixture records and engine paths are rejected. The separate helper tests use generated deterministic synthetic audio, never benchmark entries.

Store v0.3 executed checks and their exact limits in [validation-v03.md](validation-v03.md).
[validation.md](validation.md) and [README-v02.md](README-v02.md) preserve v0.2 evidence.
The new recipe tests call the actual asset-aware engine validator and timing APIs
at the pinned base. They exercise B04/B08 control acceptance/rejection, not agent
behavior or musical quality. No BANGER LAB entry is produced by these fixtures. Fresh installed-host activation, actual V1–V3 composition and human blind-listening results remain separate from package validation and metadata-only routing audits.

## Offline validation and production smoke

When Ajv/YAML cannot be installed, check existing libraries and cache first;
do not repeatedly retry registry access. If Python already supplies PyYAML and
jsonschema, this supported offline alternative checks the same bundled schema,
unique-key frontmatter and shared JS text/link/fixture/isolation functions:

```sh
python plugins/daemonv12-composer/evals/validate-package-offline.py 02438eda48506a94d10ad2756c6aafff8c5a9469
python plugins/daemonv12-composer/evals/offline-package.test.py
COMPOSER_RENDER_RECIPES=1 node --test --test-isolation=none plugins/daemonv12-composer/evals/production-recipes.test.mjs
```

No libraries are installed by either command. The production smoke uses installed
FFmpeg and temporary copies of the shipped assets, checks all ten CLI validations
and renders, zero track/master overload/full-scale counts, finite measured true
peak, fixed master length and aligned stems; it removes its temporary outputs.
Without `COMPOSER_RENDER_RECIPES=1`, the render check is explicitly skipped.
`--test-isolation=none` is useful on Node 24 when sandbox subprocess capture blocks
the test runner; omit it on older Node versions that do not provide the option.
The Ajv/YAML suite still needs its own run; record it as BLOCKED if unavailable.

The offline frontmatter mutations run the real validator on temporary plugin/Git
copies. They reject unclosed headers, blank descriptions, their combination and
duplicate YAML keys, while accepting valid scalar/folded descriptions. The real
`SKILL.md` is never edited, and its hash is checked after the suite.
