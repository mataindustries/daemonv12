# Private provenance (organizer only; not part of the blind listening copy)

- Contestant slot: OPUS. Neutral entry ID: `entry-k3v9`.
- Model: `get_session` reported `configured_model = claude-opus-5-5`, `session_context.model =
  claude-opus-5-5`, `external_metadata.last_served_model = claude-opus-5-5`. Effort setting: max.
  Session `session_01SCLHHs373RXBLdN7wN1FhR`, Claude Code 2.1.318, cloud container.
- Base: `main` = `e2962cc1a443c841cd6ca7cb2cc56c5ebabf0e99` (verified before work). Branch
  `claude/admiring-dirac-2uvzj5`. Only `benchmarks/daemon-battle-002/entry-k3v9/` was added;
  no engine, pack, `main`, licence or historical-benchmark change.
- Wall clock: 01:43:29Z → ~02:10Z for composition, render and verification (≈ 27 min, target 45).
  Committing and the PR came after that.
- Generated tokens: **not instrumented**. The session's `context_usage.used_tokens` reported 0.
  Self-estimate: well above the 30,000 target, probably 2–3×, mostly reasoning at max
  effort. Deviation disclosed; no figure is claimed as measured.
- Renders: 4 dry hook sketches; 4 complete creative versions (V1, V2, V3, V4 = rendered Risk Pass);
  2 final renders of the frozen project (canonical + determinism). Failed attempts: 0 renders and 2
  validations (symlinked-assets test rejected by the engine's real-path guard; then the project was
  placed beside `assets/`). One self-inflicted generator regression (V1 IRON velocity) was caught by
  the hash comparison against V1's manifest and fixed before V3; every `cue-vN.json` matches the
  project SHA-256 recorded in its own `.render.json`.
- Read: SKILL.md, composition-test-v04.md, signature-pack.md, catalog, the pack README *Inventory*
  section only, and the packaged skill references (production notes, hook-first, short-form,
  electronic recipes, production-analysis grep, log template), plus engine schema source
  (`src/project/validate.ts`, `sample-schema.ts`, `timing/musical-time.ts`, `audio-types.ts`).
- Not read: IGNITION / showcase project, COMPOSER_PLAYBOOK, REPORT, audition project, rendered
  demos, `benchmarks/banger-lab-001` contents (directory name listed only), other contestants.
  Isolation was self-enforced (same repository checkout), not harness-enforced.
- Tools written: `score-lib.mjs`/`compose.mjs`/`sketches.mjs` (note-list → project JSON authoring
  only). Two throwaway formatters (in scratch, not committed) only reformatted existing
  analysis/review-sections JSON. No synthesis or analysis software, no engine edits, no external music generation.
- Listening: none. All selections are score- and measurement-based (unassisted condition).
