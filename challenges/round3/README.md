# Round 3: ONE SOUND — frozen cloud challenge input

This branch contains shared inputs and setup only. It contains no Round 3 contestant entries, critiques, scores, or identity mapping. Do not add them here or push them to any branch/PR/issue/artifact in this public repository before every contestant's output is locked.

## Immutable baseline

- Branch: `round3/challenge-input`.
- Base / Composer v0.2: `e8aa219903204bf0ed4086a2334f414906a59ecf`.
- Engine implementation: `ed75e9e2a0172266e56b292886ad7c1500677862`.
- The Composer merge only adds the frozen plugin; it does not change any engine file.
- The organizer records the full challenge commit SHA after committing this directory. All three tasks MUST start at that same SHA. The branch name is only a selector; a moving branch or merely sharing a base commit is not sufficient.
- `input/` contains all five original OneSound input ZIP members, unchanged.
- Composer is at `plugins/daemonv12-composer/`; do not install a moving version.
- The historical plugin proposal names Opus. The organizer roster is Sol 6.1 Ultra, Sonnet 5.5, Haiku 5.5. Do not edit the plugin to update its historical roster.

SHA-256:

| Item | Hash |
| --- | --- |
| Source WAV | `f77e088abd24d4f05f6ad18e898d569567ea70560cc3e68a7264cbdebb6e7be4` |
| Shared prompt | `e1daf4971856f55153b3dee4e61560ce47edc6b8270889cec3607888396988ba` |
| Original Composer file manifest | `2e61928b31637c57177498eb33611758215805e6fb0f2023f039dc0267d6bcb5` |
| Original input file manifest | `b29e6dba38b16417a870e055760e2e5d0570d34a58639e63bfa4a525ce78f123` |

`FROZEN_SHA256SUMS.txt` checks every baseline tracked file (including the engine and Composer) and the five input files. It uses repository-relative paths. The original manifest hashes above refer to the original coordinator manifests, not this combined manifest.

## Environment setup before prompt delivery

Use a fresh independent Codex Cloud task or Claude Code web task for each contestant. The organizer has selected these existing isolated cloud-task environments; no extra containers or Codespaces are needed. Do not reuse another contestant's task, attach its files, share task links, or share writable storage. Keep this input branch unchanged for the whole competition.

Select `mataindustries/daemonv12`, branch `round3/challenge-input`, and pin/check the organizer-recorded full challenge SHA before any composition. If the UI only accepts a branch, use the unchanged branch and make the setup command's exact HEAD check mandatory. A task-created branch is acceptable only if its initial HEAD equals the recorded SHA.

Use the cloud environment's setup phase (not a contestant prompt) to run:

```sh
bash challenges/round3/setup.sh "$R3_CHALLENGE_COMMIT"
```

Set `R3_CHALLENGE_COMMIT` to the full SHA from the organizer's launch report. Do not resolve it afresh from the branch at launch. The script verifies the checkout and frozen bytes, installs locked dependencies, runs doctor, and prepares task-local work/output folders. It never invokes a model. Configure an equivalent setup phase on both products; do not deliver the creative prompt as a setup task.

Use the same Node/npm/FFmpeg/ffprobe/Python versions and equivalent runtime resources in all three tasks. The verified coordinator runtime used Node 22.23.3, npm 10.9.9, FFmpeg/ffprobe 6.1.1-3ubuntu5, Python 3.12.3. Node must be >=22.18 and Python >=3.12. Record cloud versions and resource limits before launch; resolve or explicitly record any mismatch before proceeding. An earlier host smoke pass is not evidence of a cloud runtime pass. Perform the supplied coordinator's sample-only production-path smoke check in each cloud setup and keep diagnostics private to the organizer. If a setup snapshot contains diagnostics, remove those diagnostics before contestant access.

`setup.sh` creates `/tmp/daemonv12-round3-entry/work/assets/` and `/tmp/daemonv12-round3-entry/output/`. All compositions, revisions, critiques, renders, stems, logs, and submission hashes belong there, OUTSIDE the checkout. Export these files privately before the cloud task expires. No contestant result is to be committed, pushed, attached to a PR, or published to a shared artifact store. Do not republish a reusable environment after composition starts.

The cloud workspace boundary isolates tasks. This setup does not claim to mount engine files read-only. Frozen-file immutability is checked before and after the run; modifying engine, plugin or input bytes violates the frozen rules and invalidates the entry. Do not treat chmod or a Git branch as filesystem isolation.

## Exact model selection

| Contestant label | Exact model identifier | Required setting | Evidence / launch gate |
| --- | --- | --- | --- |
| Sol 6.1 Ultra | `gpt-6.1-sol` | Codex reasoning effort `ultra`; standard/default speed, no Fast tier | Authenticated coordinator Codex `model/list` advertises `ultra`. Confirm the same model and effort in the target Codex Cloud picker before sending the prompt. |
| Sonnet 5.5 | `claude-sonnet-5-5` | adaptive thinking; effort `high` | Official model ID and default effort. Confirm availability and selected effort in the target Claude Code web account before sending the prompt. |
| Haiku 5.5 | `claude-haiku-5-5` | adaptive thinking; effort `medium` | Official model ID and default effort. Confirm availability and selected effort in the target Claude Code web account before sending the prompt. |

These are explicit organizer settings for this prepared launch, not a claim of equivalent reasoning/token budgets. Do not use `sonnet`/`haiku` moving aliases or fall back to another model. The public OpenAI API documents efforts through `max`; `ultra` here is the advertised Codex product setting, not an assumed API parameter. Do not substitute `max` for Ultra. Leave sampling and other generation settings at product defaults and record the effective settings, product/client version, task ID and selected model before launch. If a required model/effort is unavailable or cannot be confirmed on the selected product, stop that launch and report it.

## Launch procedure — organizer only

1. Prepare three fresh isolated tasks from the exact same challenge SHA. Record the task-to-model mapping privately; anonymous judge IDs are assigned only after submission. Do not store this mapping in the repository.
2. For Sol, open Codex Cloud, select the prepared environment/repository/branch, and choose GPT-6.1 Sol with Ultra reasoning. For each Claude contestant, open Claude Code on the web, select the repository/branch, and choose the exact Sonnet 5.5 or Haiku 5.5 model and effort above. Use independent fresh tasks, not a continued or forked contestant conversation. If the web controls cannot express a required setting, do not launch with an approximation.
3. Complete setup, initial HEAD/hash/runtime checks, and production smoke BEFORE delivering the competition prompt. Record that each task has only its own task-local work/output and no mounted peer or organizer directories. Cloud task identity and provider isolation replace the rejected shared local-worktree approach.
4. Arm an organizer-controlled wall-clock timer for 3600 seconds per contestant. Record UTC prompt-delivery time and deadline externally. Deliver the exact bytes of `input/ROUND3_SHARED_PROMPT.txt` as the initial competition message to each model. Do not prepend model-specific instructions or rewrite the prompt. The unchanged rules and these setup paths are already available in the checkout.
5. The clock runs continuously from prompt delivery through final artifact lock, including questions, retries and render time. No token-budget equivalence is claimed. Stop the task and freeze/export outputs by the deadline; closing the browser alone does not stop a cloud task. Record actual stop and lock times. Do not rely on the contestant to enforce its own deadline. A failed stop or late lock must be reported, not silently granted extra time.
6. Require complete distinct V1, V2 and V3 renders. Before each revision: three musical weaknesses tied to section/time and evidence. After V3: Composer Risk Pass. Optional V4/V5 require musical hypotheses and keep/revert criteria, with at most five serious versions. The second deterministic final master AND stems render is mandatory and does not count as a creative version.
7. Recheck frozen hashes and verify final project, exact 30-second WAV, aligned stems, analysis/render provenance, production log and SHA256SUMS. Collect final artifacts privately and keep outputs off GitHub until all three entries are locked. Never expose an earlier contestant's work to a later contestant through branches, PRs, task sharing, caches, or prompt context.
8. Only after all locks may the organizer prepare anonymous listening copies and conduct blind human judging. No contestants are launched by committing this branch or running setup.sh.

## Product references

- Codex Cloud task environments: https://learn.chatgpt.com/docs/environments/cloud-environments
- Claude Code cloud sessions: https://code.claude.com/docs/en/claude-code-on-the-web
- GPT-6.1 Sol public API model: https://developers.openai.com/api/docs/models/gpt-6.1-sol
- Sonnet 5.5 model/settings: https://platform.claude.com/docs/en/models/sonnet-5-5/overview
- Haiku 5.5 model/settings: https://platform.claude.com/docs/en/models/haiku-5-5/overview
