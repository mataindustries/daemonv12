# Launch a fair Astra vs. Sol vs. Opus composition test

This is an organizer handoff, not an executed competition or a quality claim.
Compare models with the **same Composer 0.4**, not Composer versions. Keep model
behavior, technical delivery and blind human preference as separate evidence.
Do not modify or submit to BANGER LAB 001.

## 1. Freeze inputs before opening contestant sessions

From a clean checkout containing the Composer 0.4 commit, run the following in
Bash. `RUN` must be a new absolute directory outside the repository. `COMPOSER_COMMIT`
is resolved once; retain the printed SHA instead of later following a branch tip.

```sh
ENGINE_COMMIT=17468e7ee1df11b8cef361cf4e49601d5f671589
COMPOSER_COMMIT=$(git rev-parse HEAD)
RUN=/tmp/composer-v04-test-01
mkdir "$RUN"
git worktree add --detach "$RUN/engine" "$ENGINE_COMMIT"
mkdir "$RUN/plugin"
git archive "$COMPOSER_COMMIT" plugins/daemonv12-composer | tar -x -C "$RUN/plugin"
node -p "JSON.parse(require('node:fs').readFileSync('$RUN/plugin/plugins/daemonv12-composer/plugin.json')).version"
printf '%s\n' "engine=$ENGINE_COMMIT" "composer=$COMPOSER_COMMIT" > "$RUN/pins.txt"
```

Require the printed version to be `0.4.0`. Prepare the engine's existing documented
runtime dependencies and audio tools identically for all models (`npm ci` in the
engine worktree if needed). Run `node bin/daemonv12.js doctor --json` there and
retain results; verify one small supported render before sessions. Use the same
Node, FFmpeg build, environment and render route. Do not regenerate the pack.

For each of `astra`, `sol`, `opus`, prepare a separate sandbox using this loop:

```sh
for contestant in astra sol opus; do
  mkdir -p "$RUN/$contestant/assets" "$RUN/$contestant/.agents/skills"
  cp -R "$RUN/plugin/plugins/daemonv12-composer/skills/daemonv12-composer" "$RUN/$contestant/.agents/skills/"
  cp -R "$RUN/engine/packs/v12-signature-v1/assets/v12-signature" "$RUN/$contestant/assets/"
  cp "$RUN/engine/packs/v12-signature-v1/v12-signature.catalog.json" "$RUN/$contestant/"
  cp "$RUN/engine/packs/v12-signature-v1/README.md" "$RUN/$contestant/pack-README.md"
  cp "$RUN/engine/packs/v12-signature-v1/PROVENANCE.md" "$RUN/$contestant/pack-PROVENANCE.md"
done
```

Record SHA-256 inventories of the copied skill, catalog and source WAVs; require
identical inputs. Verify catalog source hashes against the copied WAVs. Supply
the same read-only engine CLI, docs and dependencies to each sandbox, plus its
own writable workspace. Restrict access to other contestant/organizer folders
and the engine's showcase projects/audio, generator and benchmark entries; a
folder naming convention alone is not isolation. The contestants receive the
pack inventory/catalog and packaged references, not a finished composition to
imitate. Do not use the copied pack README's repository links as permission to
read excluded files. Log the access policy and any inability to enforce it.

## 2. Lock model settings and budgets

Record exact provider model IDs/revisions for Astra, Sol and Opus; display names
alone are insufficient. Record reasoning settings, temperature, context/token
limits and tool permissions. Use fresh contexts, identical harness/system text,
no model-specific musical coaching, no competitor inspection and no shared chat
memory. If a provider lacks a setting, disclose it rather than inventing parity.

Recommended small pilot per model: **30,000 generated tokens**, a common
**64,000-token context cap**, **45 minutes** wall time, 3–4 dry hook renders, at most one short repaired render per
hook, up to two targeted revision/risk excerpt renders, and at most **five
complete creative versions** including a rendered Risk Pass. The normal target
is complete V1, V2 and V3; a documented evidence-based early stop remains
allowed equally for all models. Do not count sketch/format duplicates. Reserve **one
additional unchanged final render** for determinism verification (not a creative
version). Validation and reuse of existing analysis are encouraged; all tool
calls and failed render attempts count against the time budget. Enforce limits
through the harness and log actual input, cached-input and generated tokens,
time and render counts separately. Freeze an amended
budget for all models before starting if the tools cannot fit this pilot.

Choose **one** feedback condition for everyone in advance:

- **Human-assisted:** pause after sketches. An organizer relabels and level
  matches listening copies without changing canonical WAVs; a listener blind to
  model identity selects one hook per contestant. Give every model only its
  winner and the same one-sentence feedback format. Pause the wall clock equally
  during this stage. No further coaching.
- **Unassisted:** no interim human feedback. Each model records a provisional
  score-based choice and listening uncertainty. Do not mix this condition with
  assisted results. Judge final outputs blind afterward.

## 3. Launch three separate sessions with this identical prompt

Replace only `ENGINE` and `WORKSPACE` with the allowed absolute paths. Use the
same brief below verbatim; disclose all session-level constraints above.

```text
Read WORKSPACE/.agents/skills/daemonv12-composer/SKILL.md and follow Composer
0.4, including its packaged hook-first reference and optional Signature Pack
mode. Engine CLI: node ENGINE/bin/daemonv12.js. Work only in WORKSPACE;
assets/v12-signature and v12-signature.catalog.json are supplied there.

Compose an original, replayable 28-second cinematic electronic cue using only
V12 Signature 1.0.0 samples. Choose key and tempo. Give it a recognizable hook,
a groove, a contrasting setup and consequential arrival, and a composed ending.
Do not copy the showcase or read competitor work. Compare 3–4 short hooks that
differ in rhythm and contour before full V1. Validate before rendering, use
cheap sketches first, declare low-end ownership and preserve the chosen hook.
Follow the organizer's common feedback condition. Without listening feedback,
label the selection provisional. Continue the normal V1–V3 critique and Risk
Pass within the common budget; stop speculative work when improvements cease.

Use the existing engine only; do not edit it, assets or pre-existing projects,
or build synthesis/analysis software. Measurements check technical validity;
do not fabricate listening or assign automatic musical-quality scores.
Keep versioned projects, hooks, final WAV, aligned stems, native analysis,
.render.json, a compact production log, tool/input hashes and final second-render
hash comparison. If a step is blocked, preserve evidence and report it honestly.
Provide a clean final submission with no model name in audio/project filenames
or creative descriptions; retain private provenance separately for the organizer.
```

## 4. Evaluate without conflating process and music

Organizer: retain transcripts, pins, budgets and deviations. Evaluate B19–B24
against hidden acceptance criteria using supplied scenario observations where
needed; run these diagnostic cases in separate fresh contexts with equal small
budgets so they do not coach the composition sessions. B19 requires actual saved
sketches/renders; B24 requires a separate pack-free acoustic setup. A text plan
cannot establish a rendered improvement. Mark each case pass/fail/blocked and
cite artifacts; these are workflow compliance decisions, not musical scores.

For final delivery, verify schema/assets, duration, overload/true peak against the
common delivery brief, aligned stem frames and byte-identical second WAV/stem
hashes. Missing measurements remain unknown. Keep technical failures visible;
do not silently discard a contestant or substitute showcase measurements.

For musical comparison, randomize neutral IDs, keep identity mapping private,
and use documented comparable listening levels on copies. Ask the same blinded
listeners about hook recall, rhythmic identity, tension/arrival, repetition,
ending and desire to replay; retain preference plus reasons and ties. Reveal
models only after judgments are frozen. One cue per model is a pilot; repeat
across briefs/seeds (including non-electronic briefs with suitable common assets)
before generalizing. This handoff launches no sessions and reports no winner.
