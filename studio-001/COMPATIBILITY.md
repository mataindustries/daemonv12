# Signature Rack · compatibility notes

## Engine

- **Engine base:** DaemonV12 0.7.0, main `e2962cc` (the same base as the HEADLINER foundation, PR #42). The rack changes no
  engine code, schema, MCP tool, Composer default or CLI behaviour.
- **What packages use:** ordinary v0.7 projects with drumkit instruments, `BAR:BEAT` positions, `render.tail`,
  `master.gainDb` and track `mix.gainDb`.
- **Validation and render:** `daemonv12 validate` accepts both projects with no warnings. Rendering needs FFmpeg because of
  the production fields (track mix, master, render tail), exactly as the foundation's projects do.
- **Rounding:** frame arithmetic copies the engine's (`usPerQuarter`, `ticksToFrames`, the render-plan tail rounding). The
  rack's frame counts therefore equal the engine's, and phrase boundaries land on the engine's frames.

## HEADLINER production foundation (PR #42, `codex/headliner-foundation`)

Not merged. The rack was written against its conventions and does not depend on it.

| Foundation convention | Rack |
|---|---|
| Canonical PCM16 44-byte-header WAV assets, `kit.json` `{formatVersion: 1, samples: [{name, pitch, file}]}` | Same writer layout; phrases are stereo, kit notes mono or stereo |
| Native-pitch multisamples named `note-N`, played at rate 1 | `cli.ts kit` writes exactly that, at a chosen macro state |
| Pre-bounced phrases triggered at velocity 1 | Same; phrases are cut per section at engine frames so continuous transformations survive |
| Integer-microsecond tempo, 960 PPQ | Same arithmetic |
| `main` plus omission variations sharing assets | `main.json` and `dry.json` share the same assets (dry omits context parts and the room) |
| Exact-file-set `SHA256SUMS` (missing/modified/unlisted/linked fail), refuse existing outputs | Same semantics (`verify`) |
| Saved score and generator hashes in `catalog.json` | Authored `score.json`, expanded `performance.json`, `registry.json`, generator hashes, frozen-engine record |

**Differences:**

- The foundation's `Score` describes simple additive instruments in-line. The rack's score addresses registered instruments
  (frozen, approved engines) and adds continuous macro, control and expression curves, articulations and generators.
- The foundation limits phrases to 16 s. Rack phrases are as long as their section, with the same 600 s engine limit.
- Its `pack` (tar.gz) step is not reimplemented here.

**Using both:**

- **Rack kits in a foundation-style project:** a kit written by `cli.ts kit` can replace a track's `instrument.kit` in any
  foundation-style project. Its `note-N` names match.
- **Rack parts next to foundation tracks:** a rack package's `assets/<part>/` directory can be copied into a foundation
  package together with its track entry. Re-seal with that tool afterwards.
- **Not tested here:** an automated adapter between the two score formats. It would be a follow-up after the owner chooses
  which authoring route to keep.

## PCM24 integration (Codex, PRs #39/#41 and `codex/production24-review`)

- **Not touched.** No commit, merge or edit was made to those branches.
- **Assets stay PCM16.** Rack assets are PCM16 sources by design. #42's review notes that PCM24 output files must not be fed
  back as native assets, and the rack never does that.
- **Expected path, not run here:** because rack packages are ordinary projects, the optional
  `scripts/render-production24.ts PROJECT NEW_OUTPUT` from #41 should accept `main.json` and `dry.json` unchanged. It is
  not on this branch, so that render was not run.
- **Synthesis precision:** the rack synthesises in Float64 and quantises once per phrase. A future PCM24 adapter could ask the
  rack for 24-bit phrase assets only if the engine accepts PCM24 sources. Today it does not, so this stays a separate engine
  decision.

## CI on this branch (PR #43)

- **The failure:** `check (22.18.0)` failed on the Mutation C commit with one test,
  `tests/bootstrap.test.ts:85` ("bootstrap installs in a prefix with spaces…").
  - Its fixture step (`tar -cJf` on a few bytes in a temporary directory, line 28) hit the 10 s `spawnSync` timeout:
    `status null`, after 10 063 ms.
  - The test never reads the repository; locally the whole test takes about 0.3 s.
- **Why it is not this branch's code:**
  - On the same commit, `check (24)` passed.
  - The A and B commits passed the same job.
  - Other branches' runs of the same workflow passed later the same day.
  - Locally, all 317 tests pass on Node 22.18.0 and 22.23, including with FFmpeg removed from `PATH` to match the runner's skip
    set: 292 pass, 33 skip, 0 fail.
- **Classification:** an environment stall on the hosted runner. The test was not changed or skipped.
