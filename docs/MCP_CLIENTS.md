# MCP client setup

DaemonV12's MCP server is the `daemonv12-mcp` executable: a local stdio process that
your MCP client launches. There is no HTTP endpoint, account or API key. The nine
tools and their contracts are described in [V0_4_MCP.md](V0_4_MCP.md).

## 1. Choose the launch command

| You have | Launch command |
|---|---|
| A global install (a release tarball now, npm later) | `daemonv12-mcp --root <workspace>` |
| A project-local install | `<node> <project>/node_modules/daemonv12/bin/daemonv12-mcp.js --root <workspace>` |
| A GitHub clone (after `npm ci`) | `<node> <clone>/bin/daemonv12-mcp.js --root <workspace>` |

Desktop applications often do not inherit your shell's `PATH` (nvm, fnm,
Homebrew), so absolute paths for Node and the script are the most reliable
choice. `daemonv12 init` prints the absolute form for your machine. Existing
configurations that use the clone's older `mcp/bin/daemonv12-mcp.js` path keep
working.

Do not use `npx daemonv12-mcp` until DaemonV12 is published on npm: npx would try
to download whatever package owns that name.

## 2. Create a workspace

```sh
daemonv12 init ~/daemonv12-music
# from a clone: node bin/daemonv12.js init ~/daemonv12-music
```

`--root` is the workspace, the only directory the tools can touch:

- **Projects** are JSON files inside it. Tool paths are relative to the root (`cue.json`,
  `scores/cue.json`). Absolute paths, `..`, hidden names and symlinks are rejected.
- **Sounds** come from the `assets/` directory **next to each project file**. After
  `init`, `assets/` sits at the root, so a root-level project can use
  `assets/orbital-foundry/kit.json`; a project at `scores/cue.json` would need
  `scores/assets/`. Discovery tools accept a project path that does not exist yet.
- **You install assets**; agents cannot upload or download files. Copy a sound-pack
  directory into `assets/`. WAVs must be 44.1 kHz, 16-bit PCM, mono or stereo.
- **Renders** go to a new `<root>/.daemonv12-renders/render-<id>/` directory per
  render, so nothing is overwritten. Tools return paths relative to the root.
  Delete old renders yourself.
- Use one server per workspace. Using a clone as the root also works (agent projects
  then belong under `examples/`, next to `examples/assets/`), but mixes agent files
  into the repository.

## 3. Register the server

The examples assume a clone at the current directory; substitute the launch command
from step 1 if you installed the package instead.

### Claude Code

```sh
claude mcp add --transport stdio daemonv12 -- "$(command -v node)" "$PWD/bin/daemonv12-mcp.js" --root ~/daemonv12-music
claude mcp list        # daemonv12: ... - ✓ Connected
```

With audio tool paths:

```sh
claude mcp add --env DAEMONV12_FFMPEG=/usr/bin/ffmpeg --transport stdio daemonv12 -- "$(command -v node)" "$PWD/bin/daemonv12-mcp.js" --root ~/daemonv12-music
```

Keep `--transport stdio` (or another option) between the last `--env` and the
server name, or Claude Code reads the name as one more variable. `--scope local`
(the default) is private to you in the current project, `--scope user` applies
everywhere, and `--scope project` writes a shareable `.mcp.json`:

```json
{
  "mcpServers": {
    "daemonv12": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/daemonv12/bin/daemonv12-mcp.js", "--root", "/absolute/path/to/daemonv12-music"],
      "env": { "DAEMONV12_FFMPEG": "/usr/bin/ffmpeg" }
    }
  }
}
```

Claude Code asks you to approve a project's `.mcp.json` servers once; until then
`claude mcp list` shows them as pending approval. Claude Code expands `${VAR}` in
`.mcp.json`; most other clients do not. See the
[Claude Code MCP documentation](https://code.claude.com/docs/en/mcp).

### Codex CLI

```sh
codex mcp add daemonv12 -- "$(command -v node)" "$PWD/bin/daemonv12-mcp.js" --root ~/daemonv12-music
codex mcp add daemonv12 --env DAEMONV12_FFMPEG=/usr/bin/ffmpeg -- "$(command -v node)" "$PWD/bin/daemonv12-mcp.js" --root ~/daemonv12-music
codex mcp get daemonv12 --json
```

The same configuration in `~/.codex/config.toml`:

```toml
[mcp_servers.daemonv12]
command = "/absolute/path/to/node"
args = ["/absolute/path/to/daemonv12/bin/daemonv12-mcp.js", "--root", "/absolute/path/to/daemonv12-music"]
# tool_timeout_sec = 300   # raise this if long renders time out

[mcp_servers.daemonv12.env]
DAEMONV12_FFMPEG = "/usr/bin/ffmpeg"
```

`codex mcp get` and `list` read the registration; they do not start the server.
See the [Codex MCP documentation](https://developers.openai.com/codex/mcp).

### Any other stdio client

Most clients accept the `mcpServers` JSON shape that `daemonv12 init` prints:

```json
{
  "mcpServers": {
    "daemonv12": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/daemonv12/bin/daemonv12-mcp.js", "--root", "/absolute/path/to/daemonv12-music"],
      "env": {
        "DAEMONV12_FLUIDSYNTH": "/absolute/path/to/fluidsynth",
        "DAEMONV12_SOUNDFONT": "/absolute/path/to/FluidR3_GM.sf2",
        "DAEMONV12_FFMPEG": "/absolute/path/to/ffmpeg"
      }
    }
  }
}
```

Use literal absolute paths: JSON configurations generally do not expand `~`,
`$HOME` or `${VAR}`. Omit `env` when the tools are on the client's `PATH` and the
SoundFont is in a standard location, or when you only need sample projects.

## 4. Audio tools and environment

| Variable | Used for |
|---|---|
| `DAEMONV12_FLUIDSYNTH` | FluidSynth executable for General MIDI tracks (otherwise `fluidsynth` on `PATH`). |
| `DAEMONV12_SOUNDFONT` | General MIDI `.sf2` file (otherwise standard system locations). A bad explicit path never falls back. |
| `DAEMONV12_FFMPEG` | FFmpeg for production fields, explicit formats, MP3 and analysis (otherwise `ffmpeg` on `PATH`). |

Set these in the **client's server configuration**, not in tool arguments. Agents
cannot choose executables. On Linux x86_64 without root, run
`scripts/bootstrap-audio-tools.sh` and copy the three absolute paths it prints into
`env`. See [DEVELOPER_SETUP.md](DEVELOPER_SETUP.md).

When a tool is missing, the server keeps running and the agent receives a
structured error whose hint says what to install:

| Missing | Still works | Fails with |
|---|---|---|
| FluidSynth or SoundFont | Everything except General MIDI (`gm`) tracks | `RENDERER_NOT_FOUND` or `SOUNDFONT_NOT_FOUND` when a project has `gm` tracks |
| FFmpeg | Discovery, editing, validation, render info, and rendering plain sample/drum-kit projects **without a `format`** | `AUDIO_TOOL_NOT_FOUND` for track mix, effects or automation; `master`; `render`; any explicit `format`; and `daemonv12_analyze` |

Run `daemonv12 doctor` with the same environment the client uses; desktop apps may
not see variables set in your shell profile.

## 5. Troubleshooting

- **The client reports a failed or disconnected server.** Run the exact launch
  command in a terminal. A working server prints `serving <root> ... waiting for an
  MCP client` to stderr and waits (Ctrl+C to stop). Problems exit with status 2 and
  a specific message: missing or nonexistent `--root`, an unexpanded `~`, Node older
  than 22.18, or missing dependencies (`npm ci` in a clone; reinstall a package).
- **`node` not found, or the wrong Node version.** Use the absolute path from
  `command -v node` as the command.
- **FFmpeg or FluidSynth "missing" although installed.** The client's environment
  differs from your shell's. Set the `DAEMONV12_*` variables in the server's `env`.
- **Long renders time out.** About a minute of audio with stems can take a minute to
  render. Raise the client's tool timeout (Codex: `tool_timeout_sec`).
- **Remote machines.** The client must run where the workspace and tools are; a
  desktop client cannot launch a server inside a remote container.
- **Never print to stdout** from a wrapper script: stdout carries MCP JSON-RPC.

## Verification record

- **Claude Code 2.1.296:** `claude mcp add` with and without `--env`, then
  `claude mcp list`/`get`, against the installed tarball's `daemonv12-mcp` reported
  `✓ Connected`. A project `.mcp.json` was recognized and held for approval.
- **Codex CLI 0.162.1:** `codex mcp add` (with `--env`), `get --json` and `list`
  wrote and read the TOML shown above. Codex does not connect outside a session.
- **Official MCP SDK client 2.3.1:** `npm run test:package` installs the packed
  tarball in an empty directory, launches `daemonv12-mcp`, checks the nine tools and
  server instructions, and creates, patches, validates and renders a project.
- **Not exercised:** an authenticated agent conversation in either client, and
  desktop applications such as Claude Desktop or Cursor.
