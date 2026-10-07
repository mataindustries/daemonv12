# Codex Handoff: implement DaemonV12 V0

You are implementing **V0 of DaemonV12**, a headless, deterministic music engine for AI agents. The
deliverable is one working vertical slice:

```
examples/demo.json → validate → resolve musical time → renders/demo.mid → FluidSynth + SoundFont → renders/demo.wav
```

The architecture is already decided and the behavior is fully specified. Your job is to implement it
**exactly**, with tests, and to stop at V0. Do not redesign. Do not add features.

---

## 1. Read first (in this order)

1. **`docs/V0_SPEC.md`: all of it. It is normative.** Every number, string, ordering and byte in it is
   a requirement. Golden values (byte sizes, SHA-256) are derived from it and were verified with a
   prototype.
2. `docs/ARCHITECTURE.md`: §2 (principles), §4 (modules and dependency rules), §8 (determinism rules),
   §9 (renderer facts), §10 (error model).
3. `docs/ROADMAP.md`: read it only to learn what you must **not** build yet.
4. This file: the implementation order, the tests, and the definition of done.

Precedence when documents disagree: `V0_SPEC.md` > this handoff > `ARCHITECTURE.md`. Do **not** edit
anything under `docs/` and do **not** edit `examples/demo.json`; the golden MIDI hash depends on it.
If you find a real contradiction or a golden value you cannot reproduce after checking your code
against V0_SPEC §6, **stop and report it** instead of changing the golden value.

## 2. What already exists

| Path | Status |
|---|---|
| `package.json` | Done. Scripts: `typecheck`, `test`, `check`, `demo`. `bin` → `bin/daemonv12.js` (you create it). devDependencies are pinned: `typescript` 7.0.2, `@types/node` 22.20.5, `@tonejs/midi` 2.0.28 (a test oracle only). **No runtime dependencies, and do not add any npm packages.** |
| `package-lock.json` | Done. Use `npm ci`. |
| `tsconfig.json` | Done. Typecheck only (`noEmit`), strict, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `allowImportingTsExtensions`, `noUncheckedIndexedAccess`. Do not loosen it. |
| `.devcontainer/devcontainer.json` | Done. Ubuntu 24.04 + Node 22 + `fluidsynth` + `fluid-soundfont-gm`. This is the reference render environment. |
| `.gitignore`, `.nvmrc` | Done. `renders/` is ignored. |
| `examples/demo.json` | Done. The 8-bar demo (V0_SPEC §10). Read-only. |
| `src/`, `bin/`, `tests/`, `README.md` | **You create these.** |

## 3. Environment setup

```bash
node --version                 # must be >= 22.18 (native TypeScript type stripping). If lower, switch to Node 22 LTS or 24.
npm ci
fluidsynth --version || echo "no fluidsynth"
ls /usr/share/sounds/sf2/FluidR3_GM.sf2 || echo "no soundfont"
# If either is missing and you have apt (as root, drop sudo):
sudo apt-get update && sudo apt-get install -y --no-install-recommends fluidsynth fluid-soundfont-gm
```

If FluidSynth cannot be installed in your environment, do **everything else anyway**. The real-render
integration test must then *skip* with a clear reason. Say explicitly in your final report that the
real render was not verified. A human will run `npm run demo` in Codespaces.

## 4. Hard constraints

1. **TypeScript runs directly on Node, with no build step.** Only *erasable* syntax is allowed: no `enum`, `namespace`,
   parameter properties or `import x = require()`. Use `as const` objects and union types. Relative
   imports include the `.ts` extension (`import { x } from "./musical-time.ts"`). Type-only imports use
   `import type`.
2. **Zero runtime dependencies.** Use Node built-ins: `node:fs`, `node:path`, `node:child_process`,
   `node:crypto`, `node:util` (`parseArgs`), `node:os`, `node:test`, `node:assert/strict`.
3. **Determinism.** `src/` must not contain `Math.random`, `Date`, `performance.now` or `process.hrtime`.
   Timing math uses integer ticks only. Every sort has a total-order comparator. No locale formatting
   (`toLocaleString`). There is no randomness in V0 at all.
4. **Pure core.** `timing/`, `midi/`, `project/pitch|key|gm-programs|validate` do no IO and read no
   `process.env`. IO lives in `project/load.ts`, `pipeline.ts`, `render/` and `cli/`.
5. **Expected failures are values.** Return `Diagnostic`s. Throw only for bugs; the CLI turns uncaught
   exceptions into `INTERNAL_ERROR` (exit 4).
6. **Renderer isolation.** Only files in `src/render/` may import `src/render/fluidsynth.ts`. Everything
   else imports from `src/render/index.ts`. `render/` never imports `project/`, `timing/` or `midi/`.
7. **Thin CLI.** `src/cli/main.ts` parses argv, calls the pipeline and formats output. It contains no
   musical logic.
8. **No library code writes to stdout or stderr** except `src/cli/main.ts`.
9. Style: small functions, explicit return types on exports, no `any` (use `unknown` and narrow), no
   class hierarchies, no registries or plugin systems, files under ~400 lines. Comment only what is
   non-obvious; spec references like `// V0_SPEC §6.2` are welcome.

## 5. Implementation order

Work in milestones. After each one, run `npm run check`, then commit with the message
`V0 M<n>: <summary>`. Do not start a milestone until the previous one is green.

### M1: Foundations
- `src/version.ts`: `export const ENGINE_VERSION = "0.0.1";`
- `src/diagnostics.ts`: the `Diagnostic` type (§9.1); the `DiagnosticCode` union of all codes (§9.2);
  `exitCodeFor(diagnostics)` (§8.2); `levenshtein`, `didYouMean(received, candidates, maxDistance)`;
  `formatPath`; `formatDiagnosticHuman(d)` (§8.3); the 100-diagnostic cap helper (§4.2).
- `tests/architecture.test.ts`: the determinism guard (scan `src/**/*.ts` for the forbidden APIs); no
  `dependencies` in `package.json`; `ENGINE_VERSION === package.json version`; only `src/render/*`
  imports `render/fluidsynth.ts`. With no `src/render/` yet, the import rule test still passes.

### M2: Musical time (`src/timing/musical-time.ts`)
- Constants `PPQ = 960`, `TICKS_PER_WHOLE = 3840`.
- `parseTimeSignature`, `parseDuration` (→ ticks or a diagnostic: syntax `INVALID_DURATION`, grid
  `OFF_GRID`), `parsePosition` (syntax, then semantic checks given the meter and the pattern bars →
  pattern-relative ticks), `formatPosition`, `formatDuration`, `usPerQuarter(bpm)`, `ticksToSeconds`.
  Include the duration hint conversions (`"4n"`, `"8t"`, `"4n."`, `"1/4."`, `"1"`).
- `tests/musical-time.test.ts`: every worked example in V0_SPEC §3.2 and §3.3; the off-grid cases;
  the canonical-form errors with their hints; 6/8, 7/8, 3/4 and 2/2; tempo conversions (96, 120, 110).

### M3: Pitch, key, GM (`src/project/pitch.ts`, `key.ts`, `gm-programs.ts`)
- Pitch parsing per §2.3 (string or integer) with the §9.2 hints. Key parsing per Appendix B with
  enharmonic suggestions. The GM table transcribed from Appendix A (128 names, index = program number)
  plus the GM alias table (§9.3).
- `tests/pitch-key-gm.test.ts`: every pitch example and counter-example in §2.3; all 30 keys map to
  the right `sf`/`mi`; `"D# major"` hints `"Eb major"`; the table has 128 unique names, with
  `electric_bass_finger` = 33 and `gunshot` = 127.

### M4: Load and validate (`src/project/types.ts`, `load.ts`, `validate.ts`)
- `load.ts`: read the file (`FILE_NOT_FOUND` / `FILE_READ_FAILED`), strip a BOM, `JSON.parse`. On
  failure, `JSON_PARSE_ERROR` with `line`/`column` (§9.2).
- `validate.ts`: stages 1–2 exactly as in V0_SPEC §4.1, producing the normalized `Project` (§5.1) or
  diagnostics. Implement the alias hints (§9.3) and did-you-mean. Respect the ordering and no-cascade
  rules (§4.1–4.2).
- Fixtures: `tests/fixtures/valid/minimal.json` (copy V0_SPEC §2.1 exactly);
  `tests/fixtures/invalid/bad-syntax.json` (malformed JSON, e.g. a missing comma);
  `tests/fixtures/invalid/bad-pitch.json` (the minimal fixture with `"H#4"`).
- `tests/validate.test.ts`: the minimal fixture and `examples/demo.json` give 0 errors and 0 warnings;
  plus the table-driven cases in §6 of this file.

### M5: Resolve (`src/timing/timeline.ts`, `src/timing/resolve.ts`)
- `resolve(project): { timeline, diagnostics }` per V0_SPEC §2.4, §4.1 stage 3 and §5.2. Flatten
  clips, expand chords, apply the defaults, sort notes by `(tick, pitch)`, detect `NOTE_OVERLAP`.
- `src/pipeline.ts`: `compileProjectText(text)` and `compileProjectFile(path)`, which run stages 0–3,
  return `{ diagnostics, project, timeline }`, and build `summarize(...)` → the JSON `summary` (§8.4).
- `tests/resolve.test.ts`: clip offsets (a pattern at bar 5 lands at tick 15360 in 4/4); chord
  expansion; the default velocity; back-to-back same pitch is allowed; the overlap cases;
  `endTick = bars × ticksPerBar`; the demo summary is exactly §10 (89 notes: bass 29, keys 60; 30720
  ticks; 20 s).

### M6: MIDI writer (`src/midi/smf.ts`)
- `encodeSmf(timeline): Uint8Array` exactly as in V0_SPEC §6: VLQ, chunks, conductor track, music
  tracks, channel mapping (skip 9), canonical event order, conversions.
- `tests/smf.test.ts`:
  - The minimal fixture encodes to **exactly** the 96 bytes of §6.5 (compare hex strings) with the
    SHA-256 given there.
  - The VLQ table in §6.3.
  - Determinism: encoding twice gives identical bytes. Shuffling note order inside patterns, clip order
    and JSON key order gives identical bytes. Changing track order *does* change the bytes.
  - Same-tick ordering: note-off before note-on for a repeated pitch.
  - Channel mapping: a 12-track project uses channels 0–8, 10–12 and never 9.
- `tests/demo.test.ts`: the demo MIDI is **911 bytes**, SHA-256
  `32bf52317120de2c48a5cab8292a614724c63acf3940ffa84f24a5fcebd536dc`; 3 `MTrk` chunks (raw bytes);
  the raw conductor bytes `ff 58 04 04 02 18 08`, `ff 59 02 ff 01`, `ff 51 03 09 89 68`; and, through
  `@tonejs/midi`: PPQ 960, tracks "bass" (channel 0, program 33, 29 notes) and "keys" (channel 1,
  program 0, 60 notes), `durationTicks` 30720, `duration` 20 s, first keys note D4 at tick 0 with
  velocity 114.

### M7: CLI for `validate` and `midi` (`src/cli/main.ts`, `bin/daemonv12.js`)
- `bin/daemonv12.js`: exactly `#!/usr/bin/env node` and `import "../src/cli/main.ts";`. Run `chmod +x`.
- The full contract of V0_SPEC §8: parseArgs strict, `help`, `--version`, `--json`, `--out-dir`,
  output naming, the exit codes, human and JSON output, atomic writes (`.tmp` + rename in the same
  directory), all-or-nothing artifacts (§7.5, last paragraph), `process.exitCode`.
- `tests/cli.test.ts` (spawn `process.execPath bin/daemonv12.js …` with `cwd` = repo root and
  `--out-dir` in a temp dir):
  - validate the demo: exit 0; `--json` parses as exactly one document; `summary` matches §10.
  - midi the demo: exit 0; the file exists with the golden size and hash; `artifacts.midi` is correct.
  - `bad-pitch.json`: exit 1; the JSON has `errors[0].code === "INVALID_PITCH"` and the expected path.
  - `bad-syntax.json`: exit 1, `JSON_PARSE_ERROR` with a line and a column.
  - A missing file: exit 2 `FILE_NOT_FOUND`. No args, an unknown command, an unknown flag,
    `--soundfont` on `midi`: exit 2 `USAGE_ERROR` (also in `--json` mode).
  - Stale-artifact rule: run `midi` successfully, break the project (a temp copy), run `midi` again:
    exit 1, and the old `.mid` is gone. Place dummy `demo.wav` and `demo.render.json` files in the
    out-dir, run a successful `midi`: both dummies are deleted (V0_SPEC §7.5).
  - `--version` prints `daemonv12 0.0.1`.
  - In `--json` mode, assert on stdout only (exactly one parseable document). Do not assert that
    stderr is empty: Node itself may print runtime warnings there.

### M8: Rendering (`src/render/*`, `render` command, manifest)
- `wav.ts` (§7.4), `soundfont.ts` (§7.2), `renderer.ts` (§7.1 types), `fluidsynth.ts` (§7.3),
  `index.ts` (`resolveSoundfont`, `createDefaultRenderer`, types). Add `render` to the pipeline and CLI
  following §7.5 exactly. Write the manifest per §7.6 (key order matters; basenames only; no time).
- `tests/helpers/fake-fluidsynth.mjs`: executable (`#!/usr/bin/env node`, `chmod +x`, commit it as mode
  100755). It behaves according to `FAKE_FLUIDSYNTH_MODE`:
  - `ok`: on `--version` it prints `FluidSynth runtime version 9.9.9`; on render it writes a valid
    PCM s16 stereo 44.1 kHz WAV with 4410 silent frames to the path after `-F`, and exits 0.
  - `silent-error`: writes the same valid WAV, prints
    `fluidsynth: error: fluid_is_soundfont(): fopen() failed: 'File does not exist.'` to stderr, and
    exits 0. **This mimics real FluidSynth.**
  - `exit-1`: prints an error to stderr and exits 1.
  - `no-output`: exits 0 and writes nothing.
  - `bad-wav`: writes `not a wav` to the output path and exits 0.
  - `hang`: never exits. Use it with a short timeout passed to the renderer factory.
  In every mode, `--version` behaves as in `ok`.
- `tests/fixtures/fake.sf2`: 12 bytes, `RIFF` + 4 zero bytes + `sfbk`, so it passes the magic check.
  Generate it with a one-off script and commit the file.
- `tests/render-adapter.test.ts`: `wav.ts` parses good and bad headers; SoundFont resolution order and
  errors (flag > env > defaults; a missing path never falls back; a bad magic gives
  `SOUNDFONT_INVALID`); with the fake binary, `ok` gives an `ok` outcome with version `9.9.9`, and
  every failure mode gives `RENDERER_FAILED` with no `.tmp` and no `.wav` left; a nonexistent binary
  path gives `RENDERER_NOT_FOUND`; the argument list equals §7.3 exactly (have the fake echo its argv
  to a file in a debug mode, or unit-test an exported `buildArgs()`).
- Extend `tests/cli.test.ts`: `render` with `DAEMONV12_FLUIDSYNTH=<fake>`, `FAKE_FLUIDSYNTH_MODE=ok`
  and `DAEMONV12_SOUNDFONT=tests/fixtures/fake.sf2` gives exit 0 and three artifacts. The manifest has
  the §7.6 keys in order, `renderer.version` `9.9.9`, `soundfont.file` `fake.sf2` and `midi.sha256` =
  the golden demo hash. `silent-error` gives exit 3 `RENDERER_FAILED` and **no** artifacts.
  `--soundfont /nope.sf2` gives exit 3 `SOUNDFONT_NOT_FOUND`. `DAEMONV12_FLUIDSYNTH=/nope/fluidsynth`
  gives exit 3 `RENDERER_NOT_FOUND`.
- `tests/render.integration.test.ts`: **skip** (`{ skip: "<reason>" }`) unless real `fluidsynth`
  runs and `resolveSoundfont({ env: process.env })` succeeds. Otherwise render the demo into a temp dir and assert
  acceptance criterion 5 of V0_SPEC §11 (format, duration 20–26 s, RMS per 2.5 s bar window > −45 dBFS,
  RMS after 22.0 s < −50 dBFS when present, no ±32767 samples). Render twice and assert byte-identical
  WAV and manifest. Put the WAV analysis in `tests/helpers/wav-analysis.ts`.

### M9: README and final verification
- `README.md` (≤ 60 lines): one-paragraph pitch ("12 instruments for agents"), requirements (Node ≥
  22.18, fluidsynth, fluid-soundfont-gm, or just open the devcontainer), quickstart commands, the three
  commands with one-line descriptions, and links to the four docs. Nothing aspirational beyond one
  link to `docs/ROADMAP.md`.
- Run everything in §7 of this file and produce the final report (§10).

## 6. Validation test table (`tests/validate.test.ts`)

Start each case from a deep clone of `tests/fixtures/valid/minimal.json`, apply the mutation, and run
it through `compileProjectText(JSON.stringify(value))` (stages 0–3). Assert that the **first error's
`code` and `path`** match, and the hint substring where given. `N` means
`tracks[0].patterns[0].notes`. Cases 37–38 need stage 3: mark them `todo` in M4 and enable them in M5.

| # | Mutation | Code | Path | Hint contains |
|---|---|---|---|---|
| 1 | `N[0].pitch = "H#4"` | `INVALID_PITCH` | `tracks[0].patterns[0].notes[0].pitch` | |
| 2 | `N[0].pitch = "G#9"` | `INVALID_PITCH` | same | |
| 3 | `N[0].pitch = ["C4", "X4"]` | `INVALID_PITCH` | `tracks[0].patterns[0].notes[0].pitch[1]` | |
| 4 | `N[0].pitch = []` | `OUT_OF_RANGE` | `tracks[0].patterns[0].notes[0].pitch` | |
| 5 | `N[0].velocty = 0.5` | `UNKNOWN_FIELD` | `tracks[0].patterns[0].notes[0].velocty` | `velocity` |
| 6 | `delete N[0].duration; N[0].dur = "1/4"` | `MISSING_FIELD` then `UNKNOWN_FIELD` | `….notes[0].duration` then `….notes[0].dur` | 2nd: `duration` |
| 7 | `delete bpm` | `MISSING_FIELD` | `bpm` | |
| 8 | `delete bpm; tempo = 120` | `MISSING_FIELD` then `UNKNOWN_FIELD` | `bpm` then `tempo` | 2nd: `bpm` |
| 9 | `bars = "1"` | `WRONG_TYPE` | `bars` | |
| 10 | `bars = 2.5` | `WRONG_TYPE` | `bars` | |
| 11 | `bpm = 500` | `OUT_OF_RANGE` | `bpm` | |
| 12 | `title = "   "` | `OUT_OF_RANGE` | `title` | |
| 13 | `timeSignature = "4/3"` | `INVALID_TIME_SIGNATURE` | `timeSignature` | |
| 14 | `timeSignature = "4:4"` | `INVALID_TIME_SIGNATURE` | `timeSignature` | `4/4` |
| 15 | `key = "D dorian"` | `INVALID_KEY` | `key` | |
| 16 | `key = "D# major"` | `INVALID_KEY` | `key` | `Eb major` |
| 17 | `formatVersion = 2` | `UNSUPPORTED_FORMAT_VERSION` (the only diagnostic) | `formatVersion` | |
| 18 | `tracks[0].instrument.type = "sampler"` | `UNSUPPORTED_INSTRUMENT_TYPE` | `tracks[0].instrument.type` | |
| 19 | `tracks[0].instrument.program = "acoustic_grand_pianoo"` | `UNKNOWN_GM_PROGRAM` | `tracks[0].instrument.program` | `acoustic_grand_piano` |
| 20 | `tracks[0].instrument.program = 33` | `WRONG_TYPE` | `tracks[0].instrument.program` | `electric_bass_finger` and `acoustic_bass` |
| 21 | `tracks[0].id = "Lead Synth"` | `INVALID_ID` | `tracks[0].id` | `lead-synth` |
| 22 | `tracks[1] = clone(tracks[0])` | `DUPLICATE_ID` | `tracks[1].id` | |
| 23 | `N[0].start = "1.2.1"` | `INVALID_POSITION` | `tracks[0].patterns[0].notes[0].start` | `BAR:BEAT` |
| 24 | `N[0].start = "0:1"` | `INVALID_POSITION` | same | `1-based` |
| 25 | `N[0].start = "1:5"` | `POSITION_OUT_OF_RANGE` | same | |
| 26 | `N[1].start = "1:2+1/4"` | `POSITION_OUT_OF_RANGE` | `tracks[0].patterns[0].notes[1].start` | `1:3` |
| 27 | `N[0].start = "2:1"` | `POSITION_OUT_OF_RANGE` | `tracks[0].patterns[0].notes[0].start` | |
| 28 | `N[0].duration = "4n"` | `INVALID_DURATION` | `tracks[0].patterns[0].notes[0].duration` | `1/4` |
| 29 | `N[0].duration = 0.25` | `WRONG_TYPE` | same | `1/4` |
| 30 | `N[0].duration = "1/7"` | `OFF_GRID` | same | |
| 31 | `N[0].start = "1:1+1/7"` | `OFF_GRID` | `tracks[0].patterns[0].notes[0].start` | |
| 32 | `N[0].duration = "2/1"` | `NOTE_EXCEEDS_PATTERN` | `tracks[0].patterns[0].notes[0].duration` | |
| 33 | `N[0].velocity = 100` | `OUT_OF_RANGE` | `tracks[0].patterns[0].notes[0].velocity` | `0.79` |
| 34 | `N[0].velocity = 0` | `OUT_OF_RANGE` | same | |
| 35 | `tracks[0].clips[0].pattern = "onee"` | `UNKNOWN_PATTERN` | `tracks[0].clips[0].pattern` | `one` |
| 36 | `tracks[0].clips[0].bar = 2` | `CLIP_EXCEEDS_PROJECT` | `tracks[0].clips[0].bar` | |
| 37 | `N.push({start:"1:1+1/8", pitch:"C4", duration:"1/8"})` | `NOTE_OVERLAP` | `tracks[0].patterns[0].notes[2]` | |
| 38 | `N[0].pitch = ["C4", "C4"]` | `NOTE_OVERLAP` | `tracks[0].patterns[0].notes[0]` | |
| 39 | 16 tracks with unique ids | `OUT_OF_RANGE` | `tracks` | |
| 40 | `tracks = []` | `OUT_OF_RANGE` | `tracks` | |
| 41 | root is `[]` | `WRONG_TYPE` | `""` | |
| 42 | root `patterns = []` | `UNKNOWN_FIELD` | `patterns` | `tracks[i].patterns` |
| 43 | `timeSignature = "4/3"` **and** `N[0].start = "1:9"` | `INVALID_TIME_SIGNATURE` is the **only** error (no cascade) | `timeSignature` | |
| 44 | `N[0].pitch = "H#4"`, `bpm = 500`, `N[0].velocty = 1` | exactly 3 errors in this order: `OUT_OF_RANGE`, `INVALID_PITCH`, `UNKNOWN_FIELD` | `bpm`, `….pitch`, `….velocty` | |
| 45 | add an unused pattern `{id:"two", bars:1, notes:[]}` | **no error**, warning `PATTERN_UNUSED` | `tracks[0].patterns[1]` | |
| 46 | add a track `{id:"pad", instrument:{type:"gm", program:"pad_2_warm"}, clips:[], patterns:[]}` | **no error**, warning `TRACK_EMPTY` | `tracks[1].clips` | |

Path conventions these cases imply (and which V0_SPEC §4.3 allows): field-level problems point at the
field; `NOTE_OVERLAP` points at the later note object; `DUPLICATE_ID` at the later `id`;
`PATTERN_UNUSED` at the pattern object; `TRACK_EMPTY` at the track's `clips` array.

## 7. Commands (run all of these before declaring done)

```bash
npm ci
npm run typecheck
npm test
npm run check
npx daemonv12 --version
npx daemonv12 validate examples/demo.json
npx daemonv12 validate examples/demo.json --json
npx daemonv12 midi examples/demo.json && stat -c %s renders/demo.mid && sha256sum renders/demo.mid
npx daemonv12 validate tests/fixtures/invalid/bad-pitch.json; echo "exit=$?"
npx daemonv12 render examples/demo.json; echo "exit=$?"            # needs fluidsynth + soundfont
npm run demo                                                        # same as the previous line
ls -l renders/ && cat renders/demo.render.json
```

## 8. Definition of done

All 10 acceptance criteria in **V0_SPEC §11** are met. Concretely:

- [ ] `npm run check` is green. Only the real-render test may be skipped, and only if FluidSynth is unavailable.
- [ ] Every test file listed in §5 exists and covers what it lists. All 46 cases in §6 pass.
- [ ] The demo `validate` summary equals V0_SPEC §10.
- [ ] `renders/demo.mid` is 911 bytes with SHA-256 `32bf52317120de2c48a5cab8292a614724c63acf3940ffa84f24a5fcebd536dc`.
- [ ] The minimal fixture encodes to the 96 golden bytes.
- [ ] `npx daemonv12 render examples/demo.json` produces `.mid`, `.wav` and `.render.json` that meet
      §11.5, and two renders are byte-identical (or the step is reported as unverified, with the reason).
- [ ] Exit codes 0/1/2/3 are demonstrated by tests. No artifacts are left after any failure.
- [ ] Architecture rules hold (tests in `architecture.test.ts`).
- [ ] `README.md` exists and its commands work.
- [ ] Work is committed milestone by milestone, with no unrelated changes.

## 9. Do NOT implement

Anything in V0_SPEC §1 "Not in V0", and also: extra CLI commands or flags; config files; environment
variables beyond the two specified; logging frameworks or verbosity flags; caching; parallel rendering;
retry loops; a renderer registry or plugin loader; a generic "effects" or "mix" field; JSON Schema
files; a pure-JS synthesizer; FFmpeg calls; any change to the project format; new npm dependencies of
any kind. If you believe something here is truly required, do not build it. Explain why in your report.

## 10. Verified traps (each was hit or measured during design; do not rediscover them)

1. `import { Midi } from "@tonejs/midi"` **typechecks but fails at runtime** (CommonJS). Use
   `import tonejs from "@tonejs/midi"; const { Midi } = tonejs;`.
2. `@tonejs/midi` mislabels minor keys when reading: D minor (`sf=-1, mi=1`) comes back as
   `{ key: "F", scale: "minor" }`. **Our bytes are correct.** Assert key signatures on raw bytes.
3. `@tonejs/midi` hides the conductor track: the demo has 3 `MTrk` chunks but `midi.tracks.length === 2`.
4. FluidSynth **exits 0** with a missing or corrupt SoundFont (and writes a *silent* WAV) and exits 0
   when the output path is unwritable. Never trust its exit code alone (V0_SPEC §7.3).
5. FluidSynth float WAV output is not reproducible (libsndfile timestamps the PEAK chunk). Use `-O s16` only.
6. FluidSynth renders past End-of-Track until voices finish. The demo is 20.000 s of music and a
   23.069 s WAV. That is correct; do not "fix" it.
7. `node --test` runs test files in parallel processes. Tests must write only to `fs.mkdtempSync`
   directories, never to the repo's `renders/`.
8. Calling `process.exit()` can truncate piped stdout. Set `process.exitCode` and return.
9. Node 22's `JSON.parse` errors already contain `(line L column C)`. "Unexpected end of JSON input"
   carries no position.
10. `util.parseArgs` in strict mode throws errors with `code` `ERR_PARSE_ARGS_UNKNOWN_OPTION`,
    `ERR_PARSE_ARGS_INVALID_OPTION_VALUE` or `ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL`. Map them to `USAGE_ERROR`.
11. TypeScript 7's `tsc` is used only for typechecking. Keep `"types": ["node"]`: TS 6+ no longer
    auto-includes `@types/*`.
12. `fs.renameSync` is atomic only within one filesystem. Put `.tmp` files in the same directory as the target.
13. A fake binary without the executable bit fails with `EACCES`, not `ENOENT`. Check the mode in git
    (`git ls-files -s tests/helpers/fake-fluidsynth.mjs` should show `100755`).

## 11. Final report (reply with exactly these sections)

1. **Result**: done or not done, in one sentence.
2. **Acceptance checklist**: V0_SPEC §11 items 1–10, each ✅/❌ with evidence (test counts, byte size,
   SHA-256 lines, exit codes, WAV duration).
3. **Decisions where the spec was silent** (bullets, one line each).
4. **Spec problems found**: contradictions or impossible requirements, if any.
5. **Not verified**: anything you could not run (for example, the real FluidSynth render) and why.
6. **Files created** (tree).
