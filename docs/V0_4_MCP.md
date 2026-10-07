# V0.4 MCP interface

DaemonV12 exposes nine semantic music tools over stdio using the official Model
Context Protocol TypeScript SDK. The project format remains version 1. Existing
CLI, timing, rendering, sample, production and provenance behavior is unchanged.

## Install and connect

From this checkout, run `npm ci`. Node 22.18+ runs TypeScript directly; no build is
needed. FluidSynth plus a GM SoundFont are needed for GM rendering. FFmpeg is needed
for production effects, MP3 and loudness analysis. Sample-only legacy rendering
does not need either executable. See the README for OS packages.

Launch command:

```sh
node mcp/bin/daemonv12-mcp.js --root /absolute/path/to/music-workspace
```

The root must already exist and is mandatory. The command is suitable for a local
MCP client's stdio configuration; the client launches the process. Use paths for
your checkout and workspace, for example this common `mcpServers` JSON shape:

```json
{
  "mcpServers": {
    "daemonv12": {
      "command": "node",
      "args": [
        "/absolute/path/to/daemonv12/mcp/bin/daemonv12-mcp.js",
        "--root", "/absolute/path/to/music-workspace"
      ]
    }
  }
}
```

Use an absolute Node executable path if the client's PATH cannot locate Node.
Client configuration locations differ; this is a launch configuration, not a
machine-specific checked-in configuration. The workspace can be this repository
to access `examples/assets`, or a separate music folder with its own assets.
Claude Code users get this server automatically from the checked-in `.mcp.json`
(project scope, approved on first launch). It resolves the launcher and root from
`${CLAUDE_PROJECT_DIR:-.}`, so it works in any checkout location and uses this
repository as the workspace.
Stdout contains only MCP JSON-RPC. Startup failures go to stderr and exit 2.

The server inherits `DAEMONV12_FLUIDSYNTH`, `DAEMONV12_SOUNDFONT` and
`DAEMONV12_FFMPEG` from its operator-controlled environment, just as the CLI does.
Tools cannot supply executable paths, shell commands, environment variables,
SoundFont paths or arbitrary output directories. There is no HTTP transport.

## Tool surface

All input objects are closed. `tools/list` exposes JSON Schemas generated from the
same Zod schemas used to validate calls. Musical semantics are always checked by
the engine, not reimplemented in Zod. Successful and failed tool calls return a
JSON object in both `structuredContent` and a text content block. Failures set
`isError: true`, with `ok: false` and structured `errors`.

| Tool | Contract |
|---|---|
| `daemonv12_project_create` | `project`, `title`; optional `bpm`, `timeSignature`, `key`, `bars`, `seed`. Creates only a new file, returns path, summary, warnings, SHA-256 revision and next actions. |
| `daemonv12_project_read` | `project`; optional `trackId`, `patternId` and pagination. Returns authored musical values, summary and revision, never flattened audio events. |
| `daemonv12_project_validate` | `project`. Checks schema, timing, clips, GM overlaps, kit mappings and WAV assets. Returns engine diagnostics and summary. Writes nothing. |
| `daemonv12_project_patch` | `project`, `expectedSha256`, `edits`. Applies a validated, atomic batch of semantic edits. Returns the new revision and summary. |
| `daemonv12_instruments_list` | Optional `project`, substring `query`, `offset`, `limit`. Lists exact GM program names and valid project-relative sampler WAVs. |
| `daemonv12_drumkits_list` | `project`, optional `offset`, `limit`. Lists valid kits, hit names, pitches and sample references. |
| `daemonv12_render` | `project`, optional `stems`, `format` (`wav`, `mp3`, `wav,mp3`). Calls the existing pipeline. Returns artifact paths, analysis when produced, and compact provenance. |
| `daemonv12_analyze` | `audio`: a rendered master/stem WAV path. Returns duration, frames, sample rate, channels, sample peak/RMS, clipping, integrated LUFS, loudness range and true peak. |
| `daemonv12_render_info` | `manifest`: a returned manifest path; optional `detail: "summary"` or `"full"`. Reads persisted provenance, including hashes and render settings. |

Tool path arguments and returned project/artifact paths are relative to the
configured root. Engine diagnostics may also identify operator environment paths.
Render artifacts live in `.daemonv12-renders/render-<unique-suffix>/`. Each render
gets a fresh directory, preserving earlier results and preventing basename
collisions between projects. Use the returned paths; do not predict the suffix.
WAV is always retained, including with `format: "mp3"`. Binary audio is never sent
through MCP. Summary provenance omits resolved sample triggers; request full
render info when necessary. Render info describes saved inputs, not the current
project; compare its `project.sha256` with the current project revision.

Creation defaults are **120 BPM, 4/4, four bars, seed 0, no key metadata**, and one
silent `lead` track with `acoustic_grand_piano`, empty patterns and empty clips.
The engine requires at least one track, so this produces a valid document without
altering the V0 format. `TRACK_EMPTY` is an expected warning. Add musical content
to `lead`, or add another track and remove `lead` in one batch. Project parent
directories must already exist. Creation never overwrites, even an invalid file.

Project reads return track instruments, mix, effects, clip counts and up to 100
clips per track from `clipOffset` (default 0). Patterns are flattened into a page
of up to 20 entries with `trackId`; `patternOffset` defaults to 0 and `patternLimit`
to 20. Each pattern includes `totalNotes` and a note page (`noteOffset: 0`,
`noteLimit: 32` by default; maximum 128). Filters narrow that view. Pagination does
not change project revisions. No silent truncation: totals and offsets accompany
the pages. Project JSON is limited to 2 MiB at this interface.

Discovery searches only the selected project's `assets/`, including unreferenced
assets. `project` may name a not-yet-created JSON file in an existing directory:
use `examples/new.json` with the repository as root to discover the bundled kit.
Kit sample references in discovery are relative to that kit file's directory;
the `kit` and standalone sampler paths are relative to the project directory.
Assets must be installed by the operator; tools do not copy/download arbitrary
files. Discovery is sorted and paginated, skips symlinks and invalid audio, and
reports invalid kit diagnostics. Scans are bounded to 10,000 entries/12 levels.

## Editing contract

Read/create returns a SHA-256 hash of the exact project bytes. Supply it as
`expectedSha256` when patching. The server applies edits in order to a cloned
document and validates the **complete batch** against the same asset-aware
compiler used by the CLI. Intermediate edit states may be incomplete: adding a
pattern and its clips in the same batch is supported. Any invalid final state or
missing edit target leaves the existing file byte-for-byte unchanged.

| `op` | Fields and behavior |
|---|---|
| `project_update` | `fields`: title, description, bpm, timeSignature, key, bars, seed, master. |
| `track_add` | `track`: id and instrument required; patterns/clips default to empty. Appends in musical track order. Duplicate IDs fail validation. |
| `track_remove` | `trackId`. Removes exactly that track. The final document must retain 1–15 tracks. |
| `track_update` | `trackId`, `fields`: instrument, description, mix, effects. |
| `pattern_put` | `trackId`, `pattern`: id, bars, notes, optional description. Creates or replaces the entire pattern with that ID. |
| `pattern_remove` | `trackId`, `patternId`. Clips referencing it must also be removed or redirected in the batch. |
| `notes_append` | `trackId`, `patternId`, `notes`. Appends a batch of musical events; use pattern_put to replace/remove existing notes. |
| `clips_set` | `trackId`, `clips`. Replaces that track's complete clip arrangement. |

`fields` updates named fields only. A supplied `mix`, `master`, `instrument` or
`effects` value replaces that whole field; no recursive merge or implicit defaults
are written. `null` removes optional description/key/mix/master/effects fields.
For example, remove all production fields to restore legacy rendering. Replace
the effects array to add/remove/reorder effects. Instrument changes must have
compatible notes in the resulting batch. No arbitrary JSON Pointer, executable
expression, MIDI message stream or custom composition language is exposed.

Example after creating `cue.json` (replace the revision placeholder with the
returned hash):

```json
{
  "project": "cue.json",
  "expectedSha256": "<sha256 returned by create or read>",
  "edits": [
    {
      "op": "pattern_put", "trackId": "lead",
      "pattern": {
        "id": "phrase", "bars": 1,
        "notes": [{"start": "1:1", "pitch": ["D4", "F4", "A4"], "duration": "1/4"}]
      }
    },
    {"op": "clips_set", "trackId": "lead", "clips": [{"bar": 1, "pattern": "phrase"}]},
    {"op": "track_update", "trackId": "lead", "fields": {"mix": {"gainDb": -4, "pan": -0.2}}}
  ]
}
```

Creation uses an atomic no-replace link from a fully written temporary file.
Patching writes/fsyncs a temporary file in the same directory, rechecks the current
revision, then atomically renames it. Temporary files are cleaned up. Tools are
serialized within the server so concurrent clients cannot lose updates or read a
partially published result. A stale revision reports `PROJECT_CONFLICT`.

## Architecture and security

`mcp/` is a separate npm workspace. Its pinned dependencies are official
`@modelcontextprotocol/server` 2.3.1 and Zod 4.6.5; the official client 2.3.1 is a
development dependency for tests/demo. The root engine package retains zero
runtime dependencies. Only MCP imports the SDK. The low-level official `Server`
and `StdioServerTransport` own protocol initialization/framing; the adapter owns
tool argument validation so schema errors retain structured diagnostics.

`schemas.ts` declares the tool and edit inputs; `workspace.ts` owns contained IO
and atomic publication; `projects.ts` applies edits; `handlers.ts` orchestrates
the existing core; `server.ts` advertises/calls tools; `main.ts` starts stdio.
The only core refactor extracts `compileProjectTextWithAssets(text, destination)`
from file compilation. Candidate edits and CLI files share validation, asset IO
and timing resolution. `runCommand` still owns rendering and analysis; MCP never
spawns the DaemonV12 CLI or implements rendering, DSP, timing or provenance.

The operator explicitly chooses the root. Tool paths reject absolute paths,
traversal, backslashes, hidden components, symlinks, hard-linked project/artifact
files and special files. Project operations also reject `assets/` and
`node_modules/` targets. Artifact reads are restricted to the server's output
area and their expected file types. File reads use `O_NOFOLLOW`. Existing engine
asset checks enforce `assets/` syntax and realpath containment, including kit WAVs.
The server has no general filesystem, shell, asset-upload or delete tool.

This is a local, single-operator boundary for agent-supplied paths, not an OS
sandbox against another process with the same filesystem permissions. Use one
server process per root; do not concurrently mutate directories, assets or files
with external writers. Hash checks detect stale edits, but cannot provide a
cross-process filesystem compare-and-swap against hostile concurrent mutations.
The engine's existing audio memory/time limits and completion-cleanup contract
remain; multi-file renders are not crash-atomic. New render directories and their
artifacts are retained until the operator removes them.

Engine codes and hints are preserved. Adapter codes include `INVALID_ARGUMENT`,
`UNKNOWN_TOOL`, `PATH_UNSAFE`, `PROJECT_EXISTS`, `PROJECT_CONFLICT`,
`EDIT_TARGET_NOT_FOUND`, `RESOURCE_LIMIT`, `INVALID_MANIFEST`, `FILE_ACCESS_FAILED`.
Responses never include internal stack traces. Malformed protocol messages use
the SDK's normal JSON-RPC errors. Existing invalid project files can be validated
and diagnosed; patching requires a valid starting document.

## Reproducible agent demonstration

```sh
npm run demo:mcp
npm run check
```

The demo creates a fresh folder under `renders/mcp-demo-<suffix>/`, installs the
repository's original sample fixtures there, then starts the actual stdio server
using the official SDK client. There is initially **no project file**. All project
creation, reading, edits, validation, rendering and analysis happen through MCP:

1. Create two bars at 120 BPM in D minor, seed 7.
2. Discover GM names and the pulse drum kit.
3. Add an electric piano and drum-kit track, removing the default silent lead.
4. Create patterns, append piano chords/notes and named drum hits, place clips.
5. Set gain/pan, a piano high-pass effect, and master gain.
6. Read and validate. Reject an overlapping-note patch without modifying bytes;
   reject an overwrite attempt and a traversal read.
7. Render real WAV + MP3 + two aligned stems. Analyze the master and a stem.
8. Inspect the full persisted manifest and verify source/master/MP3/stem hashes.
9. Render again into a fresh directory and compare exact WAV, stem, analysis and
   manifest bytes. MP3 is verified as an export, not a determinism guarantee.

The printed report links the workspace and artifacts. `mcp-transcript.json`
records each tool call and response; `mcp-verification.json` records the outcome.
No hand-authored project JSON is supplied to the demo.

Tests cover direct handlers, real protocol initialization/schema discovery,
transactional rejection, revision conflicts, security, audio-independent stdio
startup, and the complete real stdio demo. Real audio integration skips when
FluidSynth/FFmpeg are absent; the normal repository audio environment runs it.

## Scope decisions

Nine tools suffice; no separate timeline, schema-fetch, stem or MP3 tool is needed.
Schemas are provided by MCP discovery, stems/MP3 are render options, and project
read exposes musical intent. The roadmap's earlier provisional tool names are
superseded by this interface. Full standalone project-schema export is not added.
There is no HTTP/SSE service, auth, GUI, new DSP, plugin hosting, automation,
composition model or V1 rack.
