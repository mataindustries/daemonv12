# DaemonV12

**12 instruments for agents.** DaemonV12 V0 is a headless music engine: author a JSON project with musical positions, track-local patterns and General MIDI instruments, then validate it, generate deterministic MIDI, and render WAV audio with provenance.

## Requirements

Open the repository in its devcontainer, or use Linux with Node **22.18+** and:

```sh
sudo apt-get install -y fluidsynth fluid-soundfont-gm
npm ci
```

TypeScript runs directly in Node; there is no build step or runtime npm dependency.

## Quickstart

```sh
npm run check
npx daemonv12 validate examples/demo.json
npx daemonv12 midi examples/demo.json
npx daemonv12 render examples/demo.json --stems
# Master-only demo render:
npm run demo
```

The demo produces `renders/demo.mid`, `renders/demo.wav`, and `renders/demo.render.json`.
The manifest records input/output hashes, engine and renderer versions, SoundFont identity, and render settings.
The WAV includes the renderer's natural release tail.

## Track stems (V0.1)

`npx daemonv12 render examples/demo.json --stems` also produces
`renders/demo.stems/bass.wav` and `renders/demo.stems/keys.wav`.
Each stem is rendered from only that track's MIDI events, retaining the project's
conductor, original channel, and full musical timeline. All WAVs use the existing
44.1 kHz, 16-bit stereo PCM settings. The master is unchanged; natural release tails
may differ between stems. Silent tracks and silent portions are valid.

`--json` adds `artifacts.stems` entries (`trackId`, `wav`) and `manifest.stems`.
The manifest records track identity/index, source MIDI hash and note count, WAV path,
hash, size, duration and format, and renderer provenance. Stem paths in the manifest
are relative to the manifest directory; all stems share its top-level SoundFont identity.

Filenames use validated unique track IDs directly, with a leading underscore for
reserved device names such as `con`. Invalid or duplicate IDs fail validation rather
than being sanitized into collisions. The `<name>.stems/` directory is engine-owned.
A failed render removes master, MIDI, manifest, stems and intermediate files. A later
master-only render or MIDI command also removes old stems. Cleanup refuses directory
or symlink collisions, reports `OUTPUT_WRITE_FAILED`, and never recursively deletes
unrelated directories. The manifest is written last, only after every output succeeds.
As in V0, this is cleanup on command completion, not a crash-atomic multi-file commit.

No project schema changes, mixing, normalization, panning or effects are introduced.

## Commands

- `validate <project.json>` checks structure, musical time, references, bounds, and overlaps without writing files.
- `midi <project.json> [--out-dir <dir>]` writes canonical format-1 MIDI at 960 PPQ.
- `render <project.json> [--out-dir <dir>] [--soundfont <file.sf2>] [--stems]` writes MIDI, WAV, and provenance.

Each command accepts `--json` for one structured JSON result. Exit codes: **0** success, **1** invalid project, **2** usage/file access, **3** renderer/environment, **4** internal bug.
Use `npx daemonv12 --help` or `npx daemonv12 --version` for CLI information.

The output directory defaults to `renders/`. A failed MIDI/render command removes its old artifacts; generating MIDI also removes stale WAV/provenance files.
SoundFont selection: `--soundfont`, then `DAEMONV12_SOUNDFONT`, then standard system locations.
Set `DAEMONV12_FLUIDSYNTH` to select a renderer executable.

## Documentation

- [V0 specification](docs/V0_SPEC.md): exact format, timing, diagnostics, and output contracts.
- [Architecture](docs/ARCHITECTURE.md): module boundaries and determinism model.
- [Implementation handoff](docs/CODEX_HANDOFF.md): milestones and acceptance tests.
- [Roadmap](docs/ROADMAP.md): later phases, outside V0.
