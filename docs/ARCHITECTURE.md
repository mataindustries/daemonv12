# DaemonV12 Architecture

> **DaemonV12: 12 instruments for agents.** A headless, deterministic music engine. AI agents drive it
> through project files, a CLI and stdio MCP tools. It needs no DAW, GUI, browser or MIDI hardware.

Status: V0.4 implemented, engine `0.4.0`, project `formatVersion: 1`.
Normative details: [V0_SPEC.md](V0_SPEC.md). Phase plan: [ROADMAP.md](ROADMAP.md).
Implementation steps: [CODEX_HANDOFF.md](CODEX_HANDOFF.md).

V0.4 adds the isolated `mcp/` npm workspace, importing the core in one direction
only. Nine stdio tools expose project creation/read/validation/transactional edits,
GM/sample/kit discovery, rendering, analysis and provenance. The SDK and Zod stay
outside `src/`; the root engine still has no runtime npm dependencies. A narrow
`compileProjectTextWithAssets` extraction allows candidate edits to reuse the exact
file-compilation checks without first writing the proposed project. Render and
analysis tools call `runCommand`, as the CLI does. Engine audio paths are unchanged.
MCP adds explicit workspace containment, revision-checked atomic project writes,
and a new output directory for every render. See [V0_4_MCP.md](V0_4_MCP.md) for
the complete contract. Historical phase descriptions below remain the baseline.

V0.1 adds optional `render --stems` at the existing per-track render seam. The pipeline
encodes each track with the same conductor, event ordering, original channel and EOT,
renders it through `AudioRenderer`, and appends stem provenance to the manifest. The
master path and project schema are unchanged. See [README](../README.md#track-stems-v01)
for output and cleanup contracts. The V0 design below remains the baseline.

V0.2 adds `sampler` and `drumkit` instruments at the existing discriminator seam.
The normative extension is [V0_2_SAMPLES.md](V0_2_SAMPLES.md). `project/sample-schema.ts`
validates portable kit definitions and paths; `project/assets.ts` owns contained
asset IO. The pipeline compiles against loaded kits and validates WAV bytes via
`render/index.ts`. Timing still resolves ticks; `ticksToFrames` uses exact BigInt
division at the orchestration boundary. `sample-render.ts` orchestrates PCM jobs,
GM jobs, stems and provenance. `render/pcm.ts` sees only PCM and frame requests;
it has no project, timing or MIDI imports. All rendering imports still use the
public render entry point. The CLI contains no new musical logic.

Architecture review found no need to change V0/V0.1 contracts. The relevant existing
constraints are renderer-defined GM tails, original-index channels, and a full-score
GM master that is not the sum of independent GM stems. V0.2 preserves each. A small
integer PCM summing layer is sufficient for fixed-format one-shots; FFmpeg and a
general mixer remain unnecessary. Sample-only projects skip the GM renderer.
Only sample-aware projects enter the new master-mixing path. Output under source
assets is refused, and existing artifact cleanup includes sampled stems.

V0.3 adds an opt-in production route through the per-track orchestration in
`sample-render.ts`. `render/production.ts` owns gain/balance, unsaturated summation,
quantization and padding; `render/analysis.ts` measures PCM WAV; `render/ffmpeg.ts`
is the sole effects/export/loudness subprocess boundary. Production stems include
track processing and pad to master duration. Legacy projects keep their existing
full-score GM master and unequal tails. FFmpeg is required only for production,
explicit export formats and analysis. See [V0_3_AUDIO.md](V0_3_AUDIO.md) for the decision,
exact additive schema, routing and provenance. The historical V0 design below is
preserved as the baseline; its deferred V0.3 items are superseded by that contract.

---

## 1. What V0 proves

V0 is one vertical slice, run end to end and headless inside a Linux container (Codespaces):

```
project.json → validate → resolve musical time → Standard MIDI File → FluidSynth + SoundFont → WAV
```

```
daemonv12 validate examples/demo.json   # diagnostics + summary, writes nothing
daemonv12 midi     examples/demo.json   # → renders/demo.mid
daemonv12 render   examples/demo.json   # → renders/demo.mid, renders/demo.wav, renders/demo.render.json
```

V0 leaves out stems, samples, drums, effects, analysis, MCP and the 12-voice rack. Each of them has a
planned seam (§11), so adding one later does not require replacing the project format.

## 2. Design principles

1. **Agents are the primary users, and the project file is the API.** An LLM must be able to write,
   patch, diff, validate and repair a project without help.
2. **Musical intent goes in the file. Machine detail stays in the engine.** Files say
   `"start": "3:2+1/8"`, `"duration": "1/8"`, `"pitch": "D2"`, `"program": "electric_bass_finger"`.
   Ticks, seconds, PPQ, MIDI channels and program numbers never appear in a project.
3. **Strict and loud.** Every object is closed, so an unknown field is an error, not something silently
   ignored. Validation collects all errors in one pass. Each diagnostic carries a code, a path, a
   message, the expected value, the received value and, where possible, a concrete fix.
4. **Deterministic by construction.** Time is integer ticks. Ordering is canonical. The core reads no
   clock and draws no random numbers. The external renderer and SoundFont are pinned, and every render
   records them by hash.
5. **Pure core, effects at the edges.** Parsing, validation, timing and MIDI encoding are pure
   functions. File IO and subprocesses live only in `project/load.ts`, `pipeline.ts`, `render/` and `cli/`.
6. **Library first, thin CLI.** The CLI parses arguments, calls the pipeline and formats the result.
   The MCP server (V0.4) will call the same pipeline functions.
7. **Small now, with seams for later.** There is no plugin system. The extension points are one
   discriminator field (`instrument.type`) and one renderer interface (`AudioRenderer`).

## 3. Data flow

```
                ┌──────────── pure, deterministic, no IO ─────────────┐
 project.json ─▶ load ─▶ validate ─────────▶ resolve ─────────▶ encodeSmf ─▶ demo.mid ─▶ AudioRenderer ─▶ demo.wav
   (text)       (JSON)   (Project:           (Timeline:          (bytes)                (FluidSynth +   demo.render.json
                          normalized,         absolute integer                           SoundFont)     (manifest)
                          pattern-relative    ticks, flattened
                          ticks)              notes per track)
      ▲                    │                   │                                         │
      └──── Diagnostic[] ◀─┴───────────────────┴──── (all stages report the same shape) ─┘
```

| Stage | Input → output | Errors reported |
|---|---|---|
| **load** | file path → JSON value | `FILE_NOT_FOUND`, `FILE_READ_FAILED`, `JSON_PARSE_ERROR` (line and column) |
| **validate** | JSON value → `Project` (normalized types: MIDI pitch numbers, GM program numbers, tick offsets) | structure, value grammar, references, musical bounds |
| **resolve** | `Project` → `Timeline` (clips flattened into absolute integer-tick notes, sorted) | `NOTE_OVERLAP` |
| **encodeSmf** | `Timeline` → `Uint8Array` (Standard MIDI File, format 1, 960 PPQ) | none (pure, total) |
| **render** | `.mid` path → `.wav` path through `AudioRenderer` | `SOUNDFONT_*`, `RENDERER_*`, `OUTPUT_WRITE_FAILED` |

`validate` runs load, validate and resolve. It therefore catches every project error that `midi` or
`render` could hit.

## 4. Modules and boundaries

```
src/
  diagnostics.ts          Diagnostic type, codes, exit-code mapping, did-you-mean, human formatting
  version.ts              ENGINE_VERSION
  project/
    types.ts              Project: the normalized output of validation (V0_SPEC §5.1)
    load.ts               read file + JSON.parse → diagnostics with line/column
    validate.ts           staged validation: unknown JSON → Project | Diagnostic[]
    pitch.ts              "C#4" ⇄ 61
    key.ts                "D minor" → { sharpsFlats: -1, mode: "minor" }
    gm-programs.ts        the 128 General MIDI program names
  timing/
    musical-time.ts       PPQ, time signatures, positions, durations ⇄ ticks, canonical formatting
    timeline.ts           Timeline types (the engine's internal score representation)
    resolve.ts            Project → Timeline, overlap detection
  midi/
    smf.ts                Timeline → Standard MIDI File bytes
  render/
    index.ts              the only public entry point: types, resolveSoundfont(), createDefaultRenderer()
    renderer.ts           AudioRenderer interface and result types
    soundfont.ts          SoundFont discovery, magic-byte check, hashing
    fluidsynth.ts         the only module that knows FluidSynth's CLI, flags and quirks
    wav.ts                minimal RIFF/WAVE header reader (output verification)
  pipeline.ts             compile / writeMidi / render orchestration and atomic artifact writes
  cli/main.ts             argv → pipeline → stdout/stderr + exit code
bin/daemonv12.js          two-line shim that imports src/cli/main.ts
```

Dependency rules (enforced by review; imports point downward only):

| Module | May import | Must not import |
|---|---|---|
| `timing/musical-time` | `diagnostics` | anything with IO |
| `project/*` | `timing/musical-time`, `diagnostics` | `midi`, `render`, `cli` |
| `timing/resolve` | `project/types`, `timing/*`, `diagnostics` | `midi`, `render`, `cli` |
| `midi/smf` | `timing/timeline` (types) | `project`, `render`, `cli`, Node IO |
| `render/*` | `diagnostics`, Node built-ins | `project`, `timing`, `midi`, `cli` (renderers see files, not projects) |
| `pipeline` | everything above (`render/` **only via `render/index.ts`**) | `cli` |
| `cli/main` | `pipeline`, `diagnostics`, `version` | music logic of any kind |

The single most important rule: **FluidSynth's executable, flags, quirks and environment variable live
only in `render/fluidsynth.ts`, and only files inside `src/render/` may import it.** The rest of the
engine reaches rendering through `render/index.ts` (`createDefaultRenderer`, `resolveSoundfont`) and
knows only the `AudioRenderer` interface. A test enforces the import rule.

## 5. Project model (summary)

Normative definition: V0_SPEC §2. Shape:

```
project  { formatVersion, title, description?, bpm, timeSignature, key?, bars, seed?, tracks[] }
 └ track { id, description?, instrument, clips[], patterns[] }
    ├ instrument { type: "gm", program: "<gm_program_name>" }
    ├ clip       { bar, pattern }                         ← where a pattern plays (absolute bar)
    └ pattern    { id, description?, bars, notes[] }      ← musical content (pattern-relative time)
       └ note    { start, pitch, duration, velocity? }    ← one line per note
```

Why this shape:

- **Patterns and clips.** Music repeats. An agent should be able to change a motif in one place and see
  the arrangement (`clips`) at a glance. The same split will later hold audio clips (V0.2) and drum
  patterns without changing shape.
- **Patterns are local to their track.** Everything a track plays sits in one subtree, which suits LLM
  context windows and local edits. Ids stay short (`"phrase-a"` in every track). Deleting a track
  leaves no orphan patterns.
- **One line per note.** `{ "start": "1:2+1/8", "pitch": "D2", "duration": "1/8", "velocity": 0.7 }`.
  Field names are full words. Changing one note changes one line of the diff.
- **Ids instead of indices for references.** Clips reference patterns by id. Track and pattern ids are
  kebab-case slugs. The track id becomes the MIDI track name and, later, the stem file name.
- **Optional `description`** on the project, tracks and patterns. JSON has no comments, so this is
  where agents record intent ("call-and-response answer phrase").

## 6. Time model

All timing is exact integer arithmetic. Floating point is used only to *report* seconds.

| Concept | Definition |
|---|---|
| **bar** | 1-based. Length is fixed by the time signature (constant in V0). |
| **beat** | 1-based. One beat is one unit of the time-signature *denominator*: 4/4 has 4 quarter-note beats, 6/8 has 6 eighth-note beats. |
| **position** | `"BAR:BEAT"` or `"BAR:BEAT+N/D"`. `N/D` is an offset smaller than one beat, measured in fractions of a whole note. |
| **duration** | `"N/D"` of a whole note: `"1/4"` quarter, `"3/8"` dotted quarter, `"1/12"` triplet eighth. |
| **tempo** | `bpm` = quarter notes per minute (the MIDI convention), whatever the meter. |
| **tick** | Internal unit. **960 PPQ**, so 3840 ticks per whole note. PPQ never appears in project files. |

```
ticksPerWhole = 3840                      ticksPerBeat = 3840 / denominator
ticksPerBar   = numerator × ticksPerBeat  ticks("N/D") = N × 3840 / D     (must be an integer)
tick("B:b+N/D") = (B−1)·ticksPerBar + (b−1)·ticksPerBeat + ticks("N/D")
absolute note tick = (clip.bar − 1)·ticksPerBar + tick(note.start)
µs per quarter = round(60 000 000 / bpm)  seconds(t) = t · µsPerQuarter / (960 · 10⁶)   (reporting only)
```

3840 = 2⁸·3·5, so every binary subdivision down to 1/256, every triplet and every quintuplet is exact.
Values that are not exact (for example septuplets, `"1/7"`) are rejected with `OFF_GRID` rather than
rounded. Raising PPQ later would accept them without changing a single project file.

**Canonical spelling.** The offset must be smaller than one beat, so every instant has exactly one
spelling. In 4/4, `"1:1+1/4"` is rejected and the error suggests `"1:2"`. That gives stable diffs,
trivial equality checks and no ambiguity for agents.

## 7. Dependency choices

| Need | Choice | Why |
|---|---|---|
| Runtime | **Node ≥ 22.18**, ESM, **zero runtime npm dependencies** | Node's built-ins cover everything: `node:fs`, `node:child_process`, `node:crypto`, `node:util` `parseArgs`, `node:test`. |
| Language | **TypeScript, zero-build.** Node strips types natively. `tsc` (TypeScript 7) only typechecks (`noEmit`). | With no `dist/`, there are no stale-build bugs, which are a classic agent failure mode. `erasableSyntaxOnly` keeps the code strippable. Verified on Node 22.22 with TS 7.0.2. |
| Validation | **Hand-written staged validator.** No Ajv, zod or JSON Schema in V0. | Error quality is the main agent-facing feature. Most rules are musical (grid, beat ranges, overlaps), which JSON Schema cannot express. One code path gives one consistent diagnostic format. A JSON Schema *export* arrives with MCP (V0.4), where tool schemas need it. |
| MIDI writing | **Own ~150-line SMF writer** (`midi/smf.ts`) | The byte layout is the heart of the determinism guarantee, so the engine owns it and pins it byte-for-byte in tests. `@tonejs/midi` was evaluated: unmaintained since 2022, CommonJS-only (the named ESM import fails at runtime, verified), float- and seconds-oriented API, and equal-tick ordering is an internal detail. |
| MIDI test oracle | **`@tonejs/midi` (devDependency only)** | An independent parser checks note counts and timing in our output. Caveat (verified): its *reader* mislabels minor keys (D minor shows as "F minor"), so key signatures are asserted on raw bytes. |
| CLI parsing | `node:util` `parseArgs` (strict) | Built in. Unknown flags become usage errors. |
| Tests | `node:test` + `node:assert/strict` | Built in. Runs `.ts` directly. No Jest or Vitest. |
| Audio rendering | **FluidSynth CLI** (subprocess), verified with 2.3.4 | Mature and headless, with full GM coverage and fast offline rendering. A subprocess needs no native addon builds and isolates crashes. |
| Sounds | **FluidR3_GM SoundFont** (Debian/Ubuntu `fluid-soundfont-gm`, MIT license) | Standard, freely licensed, packaged at a fixed path. Never vendored into the repo (148 MB). Every render records it by SHA-256. |
| Environment | `.devcontainer` on Ubuntu 24.04 (`base:1-noble`) + Node 22 + `fluidsynth` + `fluid-soundfont-gm` | Codespaces gets the exact FluidSynth and SoundFont builds that V0 was verified against. |
| FFmpeg | **Not used in V0** | Reserved for V0.3: mixing, effects, encoding, loudness. |

## 8. Determinism model

**Inputs that define a render:** the project's semantic content, the engine version, the renderer
(FluidSynth version and build), the SoundFont bytes, the fixed render settings and `seed`.

| Output | Guarantee |
|---|---|
| Diagnostics | Same input → same diagnostics, same order, same text. |
| `.mid` | **Bit-identical** for the same project semantics and engine version, on any OS or Node version. JSON whitespace, key order, note order inside a pattern and clip order inside a track do not matter, because events are sorted canonically. Track order *does* matter: it sets channels and MIDI track order. |
| `.wav` | **Bit-identical** for the same `.mid`, FluidSynth build, SoundFont and settings. Verified: three renders on FluidSynth 2.3.4 gave identical SHA-256. Across FluidSynth versions or platforms, small numeric differences are expected. The manifest makes such drift visible. |
| `.render.json` | Deterministic: no timestamps, hostnames or absolute paths. |

Rules that keep it that way:

- Timing uses integer ticks only. Floats appear only in velocity → MIDI velocity (`Math.round(v·127)`),
  bpm → µs per quarter (`Math.round(60e6/bpm)`) and reported seconds. These are single IEEE-754
  operations, so they give the same result everywhere.
- Every sort uses a total-order comparator. Equal-tick MIDI events have a fixed rank: name, program,
  note-off, note-on, then pitch.
- There is no `Math.random`, `Date`, `performance.now` or `process.hrtime` in `src/`. A test guards
  this. The first feature that needs randomness (humanize, probability, V1) must use a seeded PRNG
  derived from `project.seed`.
- WAV output is 16-bit integer PCM. Float WAV is *not* reproducible: libsndfile writes a timestamp into
  the PEAK chunk (verified, two float renders differed at byte 61).
- FluidSynth runs with fixed settings: 44.1 kHz, s16, gain 0.5, reverb off, chorus off, one CPU core.

## 9. Renderer strategy

```ts
interface AudioRenderer {
  readonly name: string;                                      // "fluidsynth"
  render(request: RenderRequest): Promise<RenderOutcome>;     // never throws for expected failures
}
interface RenderRequest { midiPath: string; wavPath: string }  // the renderer writes wavPath atomically
```

The interface is deliberately file-in, file-out. Renderers do not see projects. The pipeline asks
`render/index.ts` for the renderer (`createDefaultRenderer({ soundfont, env })`, which returns the
FluidSynth adapter in V0) and calls `render`. There is no plugin registry. Adding a second renderer
means writing a second factory plus one branch in `createDefaultRenderer`.

**FluidSynth facts verified on 2.3.4 + FluidR3_GM. The adapter is built around them:**

| Behavior | Consequence for the adapter |
|---|---|
| Missing or corrupt SoundFont → **exit 0** and a *silent* WAV | Check the SoundFont (exists, `RIFF....sfbk` magic) *before* rendering. Treat any `error`/`panic` line on stderr as failure. |
| Unwritable output → **exit 0**, no file | Verify that the output exists and parses as PCM s16 stereo 44.1 kHz. |
| Missing or corrupt MIDI → exit 255 | Map a non-zero exit to `RENDERER_FAILED` with captured stderr. |
| Normal run → stdout banner, empty stderr, exit 0 | The happy path is unambiguous. |
| Rendering continues past End-of-Track until voices finish (≈ EOT + 2 s minimum) | WAV length ≥ musical length. The tail is renderer-defined (demo: 20.000 s music → 23.069 s WAV). MIDI End-of-Track stays at the exact musical end. |
| s16 output is byte-identical across runs | Determinism holds within a pinned environment. |

**Later renderers plug in at this boundary.** Per-track FluidSynth runs give stems (V0.1). A JS sample
renderer reads the Timeline and writes stems (V0.2). FFmpeg mixes and encodes (V0.3). A remote render
service is another `AudioRenderer` whose `render` uploads a MIDI file and downloads a WAV. A pure-JS
SoundFont synth is a fallback for hosts without apt.

## 10. Error model

- One shape everywhere: `{ code, severity, path, message, expected?, received?, hint? }`. Example:
  `path: "tracks[1].patterns[0].notes[3].pitch"`, `message: "Invalid pitch \"H#4\"."`,
  `expected: "note name A-G, optional # or b, octave -1..9 (e.g. \"D2\", \"F#4\", \"Bb3\") or MIDI number 0-127"`.
- **Expected failures are values, not exceptions.** Functions return diagnostics. A thrown exception
  means a bug and becomes `INTERNAL_ERROR` (exit 4).
- **Staged, collect-all validation without cascades.** Stage 1 checks structure and syntax. Stage 2
  checks references and musical bounds, and only for values that passed stage 1. Stage 3 resolves and
  checks overlaps, and only when stages 1 and 2 found no errors.
- **Hints teach the format.** Did-you-mean for fields, program names and pattern ids. An alias table
  maps common LLM guesses (`"dur"` → `"duration"`, `"tempo"` → `"bpm"`). Conversions are computed for
  you (`"velocity": 100` → "use 0.79"; `"4n"` → `"1/4"`; `"1:1+1/4"` → `"1:2"`; GM program number →
  name, with both readings of the 0/1-based ambiguity).
- **Exit codes by failure class:** 0 ok, 1 project invalid (edit the file), 2 usage (fix the command),
  3 environment or renderer (fix the machine), 4 internal bug.
- **Machine-readable mode:** `--json` prints exactly one JSON object on stdout.
- **No stale artifacts:** a command either writes all of its artifacts fresh or leaves none of them.
  Writes go through temp files and an atomic rename. A failed run deletes that command's old artifacts,
  and `midi` also removes a `.wav`/manifest that no longer matches the new MIDI. An agent never
  analyzes a previous run's audio by mistake.

## 11. Extension seams (how later phases fit without a format rewrite)

| Future capability | Seam |
|---|---|
| Sample instruments, drum kits (V0.2), the 12 V12 voices (V1) | New `instrument.type` values: `"drumkit"`, `"sampler"`, `"voice"`. Drum hits become named pitches (`"kick"`). |
| Stems (V0.1); gain and pan deferred | Per-track render jobs. No project schema change for stems. |
| Effects, buses, MP3, loudness, analysis (V0.3) | Optional `effects` on tracks and project. An FFmpeg stage after `AudioRenderer`. An `analyze` command. |
| Tempo or meter changes, automation, sections (V1) | Optional additive fields (`tempoChanges`, `automation`, `sections`). Ticks already absorb any tempo map. |
| MCP (V0.4) | MCP tools wrap `pipeline.ts`. JSON Schema is generated for tool inputs. |
| Remote rendering | Another `AudioRenderer` implementation. |

**Format versioning.** `formatVersion` is an integer. Adding optional fields keeps it unchanged.
Changing or removing meaning bumps it. Because objects are closed, an older engine reports a newer
field as `UNKNOWN_FIELD` instead of silently mis-rendering it.

## 12. Decision log

| # | Decision | Rejected alternatives and why |
|---|---|---|
| D1 | Positions as `"BAR:BEAT(+N/D)"`, durations as `"N/D"` strings, canonical (offset < 1 beat) | Seconds: depend on tempo, use floats. Ticks: leak PPQ, unreadable. Ableton `"1.2.3"`: no triplets, 1-based sixteenths invite off-by-one errors. Decimal beats `"2.5"`: floats, so triplets can't be exact. Structured `{bar, beat, offset}`: 3× tokens and multi-line diffs. |
| D2 | Track-local patterns plus clips (placement by bar) | Flat absolute notes: verbose, and one motif edit touches N places. Global pattern library: cross-track coupling. Inline notes in clips: two ways to say one thing. |
| D3 | 960 PPQ internal integer ticks | 480 also works. 960 leaves headroom (1/256, 64th-note triplets) and is a DAW-standard resolution. |
| D4 | Beat = denominator unit; `bpm` in quarter notes | "Musical pulse" beats (dotted quarters in 6/8) are ambiguous to compute and explain. |
| D5 | Velocity `(0, 1]`; pitch `"C4"`=60 or a MIDI integer; GM programs **by name** | MIDI 1–127 velocity ties the format to MIDI 1.0. GM numbers are silently wrong when 0- and 1-based numbering is confused. Names are self-documenting in diffs. |
| D6 | Hand-written staged validator | JSON Schema, Ajv or zod: weaker messages and they cannot express the musical rules. |
| D7 | Own SMF writer; `@tonejs/midi` only in tests | See §7. |
| D8 | FluidSynth CLI subprocess | libfluidsynth bindings: native builds, crashes in-process. Pure-JS synth: kept as a future fallback. |
| D9 | Zero-build TypeScript on Node ≥ 22.18 | A tsc/tsx/vitest pipeline means more moving parts and stale `dist/` bugs. |
| D10 | Multiple tracks (≤ 15) supported in V0 | A single-track V0 needs an artificial rule. SMF format 1 is natively multi-track, and channel assignment is ~5 lines. Stems stay in V0.1. |
| D11 | Render manifest (`<name>.render.json`) | stdout only: provenance is lost once the terminal scrolls. |
| D12 | All-or-nothing artifacts; `render` always regenerates the `.mid` | Keeping stale outputs on failure: agents may analyze old audio. |

## 13. Known V0 limitations (intentional)

- Tempo and time signature are constant. No pickups, swing, CC, pitch bend, sustain pedal, drums or track mix.
- At most 15 tracks (16 MIDI channels minus the GM drum channel).
- Overlapping notes of the same pitch on the same track are errors (MIDI cannot represent them faithfully).
- Duplicate JSON keys are silently resolved by `JSON.parse` (last one wins). Detecting them needs a custom parser. Deferred.
- WAV tail length is renderer-defined, including V0.1 stems. They share the musical origin and EOT;
  fixed tails and equal-length output are deferred.
- Tested on Linux only. macOS/Windows should work but are not supported in V0.
