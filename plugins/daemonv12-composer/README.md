# DaemonV12 Composer · 0.1.0

A reusable composition and production workflow for agents using DaemonV12.
It turns a brief into a musical thesis, intentional palette, complete first
render, at least three meaningful versions, and a documented final lock.
The default short-record focus is 25–30 seconds; the principles also support
20–45 second cues and other user-specified durations and genres.

## What Round 1 taught us

Round 1 paired raw models with DaemonV12 and no composer skill. All contestants
used engine commit `ed75e9e2a0172266e56b292886ad7c1500677862`. Human blind results:

| Track | Score | Useful lesson |
| --- | --- | --- |
| Next Door | 95/100 | Strongest hook, production, originality, engine showcase and effective drop; an odd ending reduced replayability. |
| SOFT TEETH | 90/100 | Good groove; the beginning needed a stronger identity. |
| Idle Hymn | 88/100 | Trippy development after about 17 seconds; perceived size needed work. |

All three were considered replayable. This is a small set of human observations,
not a universal ranking formula. The skill extracts early hooks, groove,
consequential development, perceived size beyond loudness, and replay-friendly
endings. It includes no contestant score files, custom samples, prescribed keys,
tempos, harmonies, or song structures.

## Install and use

Keep an existing DaemonV12 checkout and its normal CLI/audio tools. This plugin
does not install the engine. From this repository root, a direct local Codex
skill install is:

```sh
mkdir -p .agents/skills
cp -R plugins/daemonv12-composer/skills/daemonv12-composer .agents/skills/
```

Use a fresh destination; if that skill is already installed, update it
deliberately rather than creating a nested copy. Restart the client if discovery
has not refreshed. Invoke explicitly in Codex:

```text
$daemonv12-composer Make a replayable 30-second DaemonV12 boss cue.
```

Or tell any agent with file access:

```text
Read plugins/daemonv12-composer/skills/daemonv12-composer/SKILL.md and follow it
to improve this DaemonV12 composition. Load its linked references as needed.
```

For plugin distribution, package **this directory** with `plugin.json` and
`skills/` at the archive root. The portable manifest uses the current
[OpenAI plugin format](https://developers.openai.com/plugins/build/plugins).
Add the folder through the host's supported local marketplace or plugin import;
for a repository marketplace, merge this entry into
`.agents/plugins/marketplace.json` (do not overwrite an existing catalog):

```json
{
  "name": "daemonv12-local",
  "plugins": [{
    "name": "daemonv12-composer",
    "source": {"source": "local", "path": "./plugins/daemonv12-composer"},
    "policy": {"installation": "AVAILABLE", "authentication": "ON_INSTALL"},
    "category": "Productivity"
  }]
}
```

The source path resolves from the repository root. Enable the plugin in the
host; avoid installing both copies of the same skill. Other hosts can load the
unchanged skill folder or read its files explicitly. No MCP server, app
connection, credentials, hook, or automatic setup script is required.

Packaging and skill discovery were checked against the official
[skill authoring guide](https://developers.openai.com/plugins/build/skills) and
[local skill discovery guide](https://learn.chatgpt.com/docs/build-skills) on
2026-10-12. The root manifest follows the
[Agent Plugins 1.0 schema](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json);
fixed `skills/` discovery needs no legacy `skills` manifest field.

## Workflow and resources

Verify environment → define six-line thesis → choose palette → complete V1 →
render/analyze → identify three musical weaknesses → revise → repeat through at
least V3 → inspect first 5 seconds, payoff and final 3 seconds → lock artifacts.

- [SKILL.md](skills/daemonv12-composer/SKILL.md): workflow, decision heuristics,
  engine verification and optional Benchmark Mode.
- [Short-form composition](skills/daemonv12-composer/references/short-form-composition.md):
  identity, repetition with consequence, space, contrast, payoff and endings.
- [Production analysis](skills/daemonv12-composer/references/production-analysis.md):
  evidence-led metric interpretation and existing analysis tools.
- [DaemonV12 production notes](skills/daemonv12-composer/references/daemonv12-production-notes.md):
  source-grounded automation, sampler, routing, effect, duration and stem traps.
- [Headless audio](skills/daemonv12-composer/references/headless-audio.md): an
  opt-in workaround only when device initialization actually fails.
- [Production log](skills/daemonv12-composer/assets/production-log.md): reusable
  thesis, critique, revision and provenance template.
- [Eval plan](evals/README.md) and [activation cases](evals/activation-cases.json):
  ten activation prompts and ten behavioral scenarios with observable criteria.
- [V0.1 validation](evals/validation.md): executed checks and their limits.
- [Round 2 handoff](round-2.md): distribute the same frozen skill to Astra,
  Opus and Haiku without changing the engine pin.

No new `scripts/` helper is shipped. Native `render`/`analyze` already expose
duration, peak, RMS, LUFS, LRA, clipping and stems; an existing repository
inspection helper covers section, spectral and stereo evidence with documented
limits. Reusing these avoids maintaining a duplicate analyzer.

## Normal composition and Benchmark Mode

Both modes require musical critique and at least three serious versions. Normal
composition uses the available verified engine and keeps a compact production
log. Benchmark Mode additionally freezes engine and skill revisions, isolates
contestants, forbids competitor inspection, fixes equal constraints, requires a
deterministic second render, logs metrics and preserves a clean blind submission.
Loading this plugin does not enable Benchmark Mode or start Round 2.

This is an instruction layer. It does not change rendering, add effects or
sampler features, impose a genre, guarantee musical quality, replace human
listening, or score compositions by loudness or complexity. DaemonV12 remains
the instrument; the agent still makes musical decisions.
