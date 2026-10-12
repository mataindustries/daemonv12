# Round 2 handoff (do not start the contest during setup)

Give Astra, Opus and Haiku **identical bytes**, not model-specific rewrites.
Use the plugin commit reported for `daemonv12-composer-skill`, not a moving
branch name. The engine stays separately pinned to
`ed75e9e2a0172266e56b292886ad7c1500677862` unless the organizer explicitly
chooses a different common commit before the run.

## Coordinator preparation

1. Freeze the skill commit and export `plugins/daemonv12-composer/` from it.
   Hash the exported files with SHA-256 and copy the same package, including all
   references and the production-log template, into each isolated environment.
   Keep the package read-only during each run. Record its commit and hash list.
2. Provide each contestant a clean checkout at the common engine commit, the
   same Node/audio tools and SoundFont, allowed source assets and shared brief.
   Keep skill files separate from the engine checkout so its HEAD stays pinned.
   Use fresh output directories with no access to other contestants' work.
3. Set the same time/tool budget and a minimum of three meaningful rendered
   versions before starting. Record exact model identifiers/settings. Do not
   give contestants Round 1 songs or custom samples to imitate.
4. Use the identical prompt below for all three. Replace the angle-bracket
   fields once with the agreed common paths/brief; each environment can expose
   the same `/input/composer`, `/workspace/engine` and `/output` paths. Fill the
   skill commit with the actual frozen revision. Installation is optional when
   the agent can read the files directly.

## Same short prompt for Astra, Opus and Haiku

```text
Use DaemonV12 Composer v0.1.0, frozen skill commit <SKILL_COMMIT>.
Read /input/composer/skills/daemonv12-composer/SKILL.md and its references.
Enable BENCHMARK MODE. The engine at /workspace/engine must remain at
ed75e9e2a0172266e56b292886ad7c1500677862. Do not modify it or inspect competitors.
Shared brief: <IDENTICAL ROUND 2 BRIEF, ALLOWED ASSETS AND TIME/TOOL BUDGET>.
Create an original replayable 25–30 second record in /output. Complete at least
V1, V2 and V3 with three musical weaknesses identified before each revision.
Check the first 5 seconds, payoff and final 3 seconds. Preserve final project,
assets, WAV, stems, analysis, log, provenance and SHA-256 hashes; verify a second
deterministic render. Keep judge-facing submission names blind.
```

Skill version and engine version are separate pins. If the engine pin changes,
reverify source-grounded guidance for all contestants before running. Run this
only when the organizer starts Round 2; this handoff does not initiate it.
