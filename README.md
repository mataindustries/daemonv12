# DaemonV12

**A headless, deterministic music engine for AI agents.** An agent describes music
as a JSON project, directly or through nine MCP tools, and DaemonV12 renders it
offline to MIDI, WAV, MP3 and per-track stems, with loudness analysis and a
SHA-256 provenance manifest. No DAW, GUI, audio device or API key.

> **Public beta, version 0.5.** Works today from a GitHub clone or a packed
> release tarball. Not yet published to npm, and the code license is still an
> open owner decision (see [status](#status-and-limitations)).

## Why would an agent need it?

Agents can't drive a DAW, but they are good at writing structured data and
calling tools. DaemonV12 gives them a music format built for that:

- **Semantic, checkable input.** Notes sit at musical positions such as
  `"3:2+1/8"`. Validation catches overlaps, off-grid timing and bad asset paths,
  and returns repair hints the agent can act on.
- **Deterministic output.** The same project and tool versions produce the same
  bytes. Every render records input, asset, tool and output hashes, so an agent
  can verify, compare and iterate on its own work.
- **Exact timing for real deliverables.** Fix a cue to 175.2 seconds of
  picture, or loop exactly 16 bars. Stems are sample-aligned with the master.
- **A safe tool surface.** MCP edits are validated, revision-checked
  transactions confined to one workspace directory. Agents cannot run commands
  or choose output paths.

## What can it produce?

- **Files:** 44.1 kHz/16-bit stereo WAV, MP3, canonical MIDI, aligned per-track
  stems, a `.render.json` provenance manifest and an analysis report (peak, RMS,
  integrated LUFS, loudness range, true peak, clipping).
- **Sounds:** the 128 General MIDI instruments (through FluidSynth and a
  SoundFont), your own WAV one-shots and drum kits, and two bundled CC0 packs:
  **Orbital Foundry** (twelve cinematic/industrial sounds) and **GLASSHOUSE**
  (ten tuned C# electronic/bass sounds built from one glass and one vocal identity).
- **Production:** track gain/pan and their automation; high-pass, low-pass,
  delay, compressor, reverb and saturation; master gain; voice-over ducking.
- **Timing:** exact output durations in bars, musical time or seconds, with
  controlled release tails.

Measured examples (Linux; Ubuntu's FluidSynth 2.3.4, FluidR3_GM and FFmpeg 6.1.1):

| Demo | What it is | Result |
|---|---|---|
| `shoot-the-moon-locked-score.json` | 24-bar cinematic score an agent composed through the MCP tools | 61.0 s, 14 tracks, −16.9 LUFS, no clipping |
| `orbital-foundry-audition.json` | All twelve Orbital Foundry sounds | 30.0 s, −17.4 LUFS; WAV SHA-256 `c1dd6439…`, byte-identical to the [earlier recorded render](docs/ORBITAL_FOUNDRY_VERIFICATION.md) made with a different Node version |
| `glasshouse-audition.json` | All ten GLASSHOUSE sounds at 140 BPM in C# minor | 25.6 s, −17.7 LUFS, −2.2 dBTP, no clipping ([verification](docs/GLASSHOUSE_VERIFICATION.md)) |
| `v05-loop-demo.json` | Four-bar game loop at 100 BPM | exactly 423,360 frames (9.6 s) with aligned stems |
| `sample-only-demo.json` | Drum kit and impact, Node only | 20.0 s in about 0.2 s |

## Hear something in 60 seconds

You need Node.js **22.18 or newer** and git:

```sh
git clone https://github.com/mataindustries/daemonv12.git
cd daemonv12
npm ci
npm run demo:share
```

`demo:share` renders the best demo your machine supports (the agent-composed
score with full audio tools, the Orbital Foundry audition with FFmpeg, or a
Node-only groove otherwise). It prints the file paths, duration, loudness, hash
and the command to play the result. On a remote machine, download the file and
play it locally. `npx --no-install daemonv12 doctor` shows what is installed.

## Connect your agent

1. **Create a workspace.** It holds the starter projects and sound packs, and
   your agent's projects and renders:

   ```sh
   node bin/daemonv12.js init ~/daemonv12-music
   ```

   `init` prints the exact MCP launch command and JSON for your machine.

2. **Register the MCP server** (from the clone root; the shell fills in the paths):

   ```sh
   # Claude Code
   claude mcp add --transport stdio daemonv12 -- "$(command -v node)" "$PWD/bin/daemonv12-mcp.js" --root ~/daemonv12-music
   # Codex CLI
   codex mcp add daemonv12 -- "$(command -v node)" "$PWD/bin/daemonv12-mcp.js" --root ~/daemonv12-music
   ```

   Other clients take the JSON that `init` printed. Settings, environment variables
   and troubleshooting: **[docs/MCP_CLIENTS.md](docs/MCP_CLIENTS.md)**.

3. **Give your agent this:**

   > Use the DaemonV12 MCP tools to compose `foundry-cue.json`: a 16-bar industrial
   > cue at 100 BPM in D minor. Discover the drum kits first and use the Orbital
   > Foundry kit for the rhythm, with the `10-dark-drone.wav` and
   > `08-tension-riser.wav` samples for atmosphere and a build into bar 13.
   > Validate it, render WAV, MP3 and stems, analyze the master, and report the
   > output paths, duration, integrated loudness and true peak.

   The agent discovers the kit, creates the project, adds tracks, patterns and
   clips in validated transactions, renders, analyzes and reports paths under
   `.daemonv12-renders/`. A scripted run of those same six tool calls produced
   a 38.4-second cue with WAV, MP3, four stems and analysis in 12 seconds. MP3
   and analysis need FFmpeg; on a Node-only machine, ask for a WAV render
   without a format.

## Install paths

**A. GitHub clone (recommended for the beta):** `git clone`, `npm ci`, then the
commands above. TypeScript runs directly; there is no build step to remember.

**B. Package tarball (the future npm path):** `npm pack` in a clone produces
`daemonv12-0.5.0.tgz`, which installs anywhere without the clone:

```sh
npm install -g ./daemonv12-0.5.0.tgz     # once published: npm install -g daemonv12
daemonv12 doctor
daemonv12 init ~/daemonv12-music && cd ~/daemonv12-music
daemonv12 render sample-only-demo.json   # renders/sample-only-demo.wav, Node only
daemonv12-mcp --help                     # the MCP server executable
```

**C. Codespaces or devcontainer:** open the repository in a Codespace (or VS Code
Dev Containers). Setup installs Node 22, FluidSynth, FluidR3 GM and FFmpeg, then runs
`npm ci`, doctor and the smoke render, so every example works.

**Audio tools are optional.** Sample and drum-kit projects need only Node. General
MIDI instruments need FluidSynth and a GM SoundFont. Production features, MP3
and analysis need FFmpeg.

| Platform | Install |
|---|---|
| Debian/Ubuntu | `sudo apt-get install fluidsynth fluid-soundfont-gm ffmpeg` |
| macOS (Homebrew) | `brew install fluid-synth ffmpeg`, plus a GM `.sf2` SoundFont via `DAEMONV12_SOUNDFONT` |
| Linux x86_64 without root | `./scripts/bootstrap-audio-tools.sh` (pinned, checksum-verified user-space install), then `source` the printed `env.sh` |

See [developer setup](docs/DEVELOPER_SETUP.md) for the bootstrap, the doctor and the
`DAEMONV12_FLUIDSYNTH`, `DAEMONV12_SOUNDFONT` and `DAEMONV12_FFMPEG` variables.

## Status and limitations

DaemonV12 is a **public beta for agents that need deterministic, programmatic
music assets**: game loops, video cues, stingers, sketches and stems. It is:

- **Headless and offline.** It renders files. It is not a live DAW, does not play
  audio, and is not a real-time or interactive game audio engine.
- **Not a replacement for Ableton, Logic or a human producer.** There is no GUI,
  plugin (VST/AU) hosting, recording, synthesis engine or mastering chain.
- **Limited in palette.** Melodic sounds come from General MIDI, so their quality
  depends on the SoundFont. Samples are one-shots without pitch-shifting or
  time-stretching. The curated 12-voice rack the name refers to is a
  [roadmap](docs/ROADMAP.md) goal, not a current feature.
- **Simple in structure.** One tempo and meter per project, up to 15 tracks, and
  at most 600 seconds per sample/production render.
- **Deterministic per tool version.** WAV, stems and manifests repeat byte for
  byte with the same FluidSynth, SoundFont and FFmpeg; MP3 is a listening copy.
- **Local only.** The MCP server is stdio for one operator and one workspace.
  It is a path-safety boundary, not an OS sandbox. There is no hosted service.

**Platforms:** Node 22.18+. CI runs the full suite on Linux x86_64 (Node 22.18 and
24) and the package clean-room test on Linux and macOS arm64 with audio tools
hidden. Full audio is verified manually on Linux. The rootless bootstrap supports
only Linux x86_64 with glibc 2.28+; elsewhere, install the tools yourself. Windows
is untested.

## Examples

Start with the six curated projects in [examples/README.md](examples/README.md):
Node-only samples, Orbital Foundry, an exact game loop, a narrated-video cue with
ducking, a production mix and the agent-composed score. Other files in
`examples/` are historical fixtures kept for tests.

## Commands

| Command | Purpose |
|---|---|
| `daemonv12 doctor [--json]` | Checks Node, FluidSynth, SoundFont, FFmpeg and MCP, and explains each capability. |
| `daemonv12 init <dir>` | Creates a workspace with starter projects and sound packs; prints the MCP configuration. |
| `daemonv12 validate <project.json>` | Checks structure, timing, references and assets; writes nothing. |
| `daemonv12 render <project.json> [--stems] [--format wav\|mp3\|wav,mp3] [--out-dir <dir>]` | Writes MIDI, WAV, provenance and optional stems/MP3 (default `renders/`). |
| `daemonv12 midi <project.json>` | Writes canonical format-1 MIDI at 960 PPQ. |
| `daemonv12 analyze <audio.wav>` | Reports format, peak, RMS, clipping, LUFS and true peak (needs FFmpeg). |
| `daemonv12-mcp --root <dir>` | Stdio MCP server with nine tools. |

Every CLI command accepts `--json`. Exit codes: 0 success, 1 invalid project,
2 usage or file access, 3 renderer or environment, 4 internal error. In a clone,
run commands as `npx --no-install daemonv12 …` or `node bin/daemonv12.js …`.

## Documentation

- [MCP clients](docs/MCP_CLIENTS.md): Claude Code, Codex CLI and generic stdio setup, workspaces, environment, troubleshooting.
- [MCP tools](docs/V0_4_MCP.md): the nine tools, edit operations and path safety.
- [Project format](docs/V0_SPEC.md), [stems](docs/V0_1_STEMS.md), [samples and kits](docs/V0_2_SAMPLES.md), [production audio](docs/V0_3_AUDIO.md), [timeline and dynamics](docs/V0_5_TIMELINE_DYNAMICS.md).
- [Developer setup](docs/DEVELOPER_SETUP.md): doctor JSON, rootless bootstrap, smoke tests and CI.
- [Architecture](docs/ARCHITECTURE.md), [roadmap](docs/ROADMAP.md), [changelog](CHANGELOG.md).
- [Contributing](CONTRIBUTING.md), [security](SECURITY.md), [sharing and licensing](docs/SHARING.md), [release checklist](docs/PUBLIC_BETA_RELEASE.md).

## License

**The code license has not been chosen yet.** Until the owner adds one, the
repository is visible, but no license grants rights to copy, modify or
redistribute the code. The Orbital Foundry, GLASSHOUSE, pulse-kit and synthetic
voice-over WAV assets are dedicated to the public domain under CC0-1.0 (see their
directories). Dependencies and external audio tools keep their own licenses.
