# DaemonV12

**12 instruments for agents.** DaemonV12 V0.5 is a working headless music engine
for AI builders. An agent can create and edit musical projects through nine stdio
MCP tools, then render deterministic MIDI, WAV/MP3 and stems with hashes and
provenance. General MIDI, WAV instruments, reusable drum kits and the original
Orbital Foundry cinematic pack are included. No GUI or audio device is needed.

**Hear something immediately** after cloning, with Node **22.18+**:

```sh
npm ci
npm run smoke -- --mcp
```

Open the WAV at the printed `Listen:` path. This checks the environment, validates
the bundled sample-only example, verifies audible PCM and its hash, and discovers
all nine MCP tools. It works without FluidSynth, a SoundFont or FFmpeg. On a remote
machine, download/open the WAV locally. Setup and [MCP client examples](docs/MCP_CLIENTS.md)
follow below; the [engine contracts](#documentation) remain the technical reference.

## 5 minute quickstart

### A. Codespaces / devcontainer

Open the clone in its devcontainer (or create a Codespace). Its setup installs
Node 22, FluidSynth, FluidR3 GM and FFmpeg, runs `npm ci`, doctor and a smoke render.
From the repository root:

```sh
npm ci
npx --no-install daemonv12 doctor
npm run demo:sample-only           # renders/sample-only-demo.wav; Node only
npm run demo:orbital-foundry       # renders/orbital-foundry/; FFmpeg, no FluidSynth
npm run smoke -- --mcp             # fast stdio discovery check
```

### B. Unprivileged / rootless Linux

With Node 22.18+ already installed, run from the repository root:

```sh
npm ci
npm run demo:sample-only           # working sound before installing audio tools
./scripts/bootstrap-audio-tools.sh
source "${DAEMONV12_AUDIO_PREFIX:-${XDG_DATA_HOME:-$HOME/.local/share}/daemonv12/audio-tools}/env.sh"
npx --no-install daemonv12 doctor --json
npm run demo:orbital-foundry
```

The noninteractive bootstrap uses pinned, verified user-space packages; no sudo,
system package installation or shell startup edits. It currently supports Linux
x86_64 with glibc 2.28+ and needs about 250 MB of downloads plus runtime/cache disk
space. Network speed can extend the quickstart. See [paths, prerequisites, limitations
and Cloud setup](docs/DEVELOPER_SETUP.md). Other platforms can use the Node-only demo
and provide their own audio executables. `doctor` exits 3 when any optional audio/MCP
capability is unavailable; the sample smoke still succeeds when its own requirements
are met.

## Connect an agent through MCP

The client launches this process; `--root` must be an existing music workspace.
Choose the clone as root to use its `examples/assets`:

```sh
node /absolute/path/to/daemonv12/mcp/bin/daemonv12-mcp.js --root /absolute/path/to/daemonv12
```

Minimal Claude-style / generic stdio configuration:

```json
{
  "mcpServers": {
    "daemonv12": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/daemonv12/mcp/bin/daemonv12-mcp.js", "--root", "/absolute/path/to/music-workspace"]
    }
  }
}
```

Replace every placeholder; JSON paths do not automatically expand `~` or shell
variables. For rootless audio, pass the bootstrap's three `DAEMONV12_*` paths in
the client's environment. [Codex CLI, Claude-style JSON and troubleshooting](docs/MCP_CLIENTS.md)
are separate from the [nine tools and editing contracts](docs/V0_4_MCP.md).
Stdout is reserved for MCP; a manual launch waits for protocol input.

TypeScript runs directly in Node with no build step. The engine has zero runtime
npm dependencies; the MCP workspace uses the official SDK and Zod. Install all
workspace dependencies with `npm ci`. For full verification, run `npm run check`.

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

V0.1's GM stem behavior remains unchanged in V0.2.

## Sample instruments (V0.2)

Use `{"type":"sampler","sample":"assets/pulse-kit/impact.wav"}` for one-shots or
`{"type":"drumkit","kit":"assets/pulse-kit/kit.json"}` for reusable mapped kits.
Notes use existing musical positions: `{"start":"1:2","pitch":"snare","velocity":0.8}`.
Sampler notes omit pitch; both omit duration and play the full WAV, including overlapping tails.

Samples must be 44.1 kHz, 16-bit PCM WAV, mono or stereo, beneath the project's
`assets/` directory. Paths and symlink containment are validated. Sample-only renders
need no FluidSynth or SoundFont. Mixed renders combine sampled tracks with the
existing GM master; `--stems` exports every track aligned to time zero.

`npm run demo:sample-only` plays the existing drum/impact tracks from the sample
demo, writing `renders/sample-only-demo.wav`, MIDI and provenance with Node alone.
`npm run demo:samples` is the **mixed GM/sample** version: it needs FluidSynth and
a SoundFont and writes `renders/sample-demo.wav`, MIDI, provenance and six stems.
`npm run fixtures:samples` regenerates the small original development sounds.
Sample rendering uses a narrow deterministic PCM layer, with no FFmpeg, resampling,
effects or normalization. Sample/mixed renders are limited to 600 seconds including
tails. See [sample format, timing and provenance](docs/V0_2_SAMPLES.md) for the full contract.

## ORBITAL FOUNDRY sound pack

[ORBITAL FOUNDRY](examples/assets/orbital-foundry/README.md) supplies twelve original,
deterministically generated cinematic/industrial sounds: propulsion, mechanical
percussion, steel, impact, transitions, drone, air and a tense energy motif.
The compact PCM16 pack includes a seven-hit named kit, a machine-readable
[catalog](examples/orbital-foundry.catalog.json), and a native
[30-second audition](examples/orbital-foundry-audition.json). Existing MCP instrument
and kit discovery finds it under the project's assets directory.

`npm run fixtures:orbital-foundry` regenerates the source pack.
`npm run demo:orbital-foundry` renders WAV, MP3, twelve stems, analysis and provenance
under `renders/orbital-foundry/` (FFmpeg required; no SoundFont required).
See the [measured verification](docs/ORBITAL_FOUNDRY_VERIFICATION.md).

## Production audio (V0.3)

Add `"mix": {"gainDb": -4, "pan": -0.3}` to a track; negative pan is left.
Optional ordered `effects` support `highpass`, `lowpass`, and single-tap `delay`.
Use project `"master": {"gainDb": -1}` for master gain. No automatic normalization
runs. Production stems include track processing and share the master duration.
Projects without these fields keep their existing rendering behavior.

```sh
npm run demo:production  # upgraded sample arrangement: WAV, MP3, six stems, analysis
npx daemonv12 render examples/production-demo.json --stems --format wav,mp3
npx daemonv12 analyze renders/production-demo.wav --json
```

FFmpeg supplies effects, MP3 and integrated LUFS/true-peak measurements behind an
isolated adapter. Set `DAEMONV12_FFMPEG` to select it. WAV remains canonical, including
when `--format mp3` is used. The analysis JSON and manifest report peaks, loudness,
clipping, production settings and tool versions. See the [V0.3 contract](docs/V0_3_AUDIO.md)
for ranges, pan law, effects, stem semantics and compatibility.

## Timeline and dynamics (V0.5)

Score locked video with an exact runtime and automatic VO ducking:

```json
"render": {"duration":{"seconds":175.2},"tail":"auto"},
"master": {"ducking":{"source":"assets/vo.wav","amountDb":12,"thresholdDb":-35,"attackMs":50,"releaseMs":300}}
```

Use `"render":{"duration":{"bars":16},"tail":"none"}` for exact musical loops
and aligned stems. Track gain/pan automation and ordered compressor, algorithmic
reverb and soft saturation work through project files and the existing MCP tools.
Stems include track automation/effects; VO ducking affects the master. Exact loop
length alone does not guarantee a click-free waveform transition.

`npm run demo:v05` renders and verifies the synthetic narrated Foundry cue and
four-bar loop under `renders/v05/`. See the [V0.5 contract](docs/V0_5_TIMELINE_DYNAMICS.md)
for tagged time values, tails, ranges and processing order. Existing projects keep
their previous audio behavior.

## Commands

- `doctor [--soundfont <file.sf2>] [--json]` probes versions, paths, SoundFont validity, dependencies and each rendering/MCP capability without writing artifacts. [Stable JSON fields and exit behavior](docs/DEVELOPER_SETUP.md#doctor).
- `validate <project.json>` checks structure, musical time, references, bounds, GM overlaps and sample assets without writing files.
- `midi <project.json> [--out-dir <dir>]` writes canonical format-1 MIDI at 960 PPQ; sampled tracks are omitted with a warning.
- `render <project.json> [--out-dir <dir>] [--soundfont <file.sf2>] [--stems] [--format wav|mp3|wav,mp3]` writes MIDI, WAV, provenance and optional MP3.
- `analyze <audio.wav>` reports PCM format, duration, peaks, clipping and loudness.

Each command accepts `--json` for one structured JSON result. Exit codes: **0** success, **1** invalid project, **2** usage/file access, **3** renderer/environment, **4** internal bug.
Use `npx daemonv12 --help` or `npx daemonv12 --version` for CLI information.

The output directory defaults to `renders/`. A failed MIDI/render command removes its old artifacts; generating MIDI also removes stale WAV/provenance files.
SoundFont selection: `--soundfont`, then `DAEMONV12_SOUNDFONT`, then standard system locations.
Set `DAEMONV12_FLUIDSYNTH` to select a renderer executable.

## Documentation

- [V0.5 timeline and dynamics](docs/V0_5_TIMELINE_DYNAMICS.md): exact duration, tails, loops, gain/pan automation, VO ducking and production effects.
- [V0.4 MCP interface](docs/V0_4_MCP.md): stdio configuration, tools, edits, path safety and agent demo.
- [MCP clients](docs/MCP_CLIENTS.md): Codex CLI and generic/Claude-style setup, absolute paths and environment variables.
- [Developer setup](docs/DEVELOPER_SETUP.md): doctor JSON, rootless bootstrap, smoke, CI and Cloud persistence.
- [Sharing and licensing audit](docs/SHARING.md): future npm packaging and the owner's outstanding code-license decision.
- [V0 specification](docs/V0_SPEC.md): exact format, timing, diagnostics, and output contracts.
- [V0.3 audio production](docs/V0_3_AUDIO.md): gain/pan, effects, WAV/MP3, analysis and provenance.
- [V0.2 samples](docs/V0_2_SAMPLES.md): one-shots, reusable kits, PCM mixing, asset security, provenance and limits.
- [Architecture](docs/ARCHITECTURE.md): module boundaries and determinism model.
- [Implementation handoff](docs/CODEX_HANDOFF.md): milestones and acceptance tests.
- [Roadmap](docs/ROADMAP.md): later phases, outside V0.
