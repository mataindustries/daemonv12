# MCP client setup

Run `npm ci` at the DaemonV12 checkout root using Node 22.18+. Run
`npm run smoke -- --mcp` to verify real stdio initialization and discovery of the
existing **nine tools**. Audio tools are optional for startup/sample-only WAVs;
doctor explains which rendering capabilities are installed.

Use absolute paths for **Node**, the **server script**, and an **existing music
workspace root**. The server works regardless of the client's working directory.
Choose the DaemonV12 checkout as root to access `examples/assets`; with a separate
music workspace, copy the desired kit/samples under that project's `assets/`.
These are operator/client settings. [Engine and tool behavior](V0_4_MCP.md) is
unchanged.

## Codex CLI

Register a local stdio server using the
[official Codex MCP setup](https://developers.openai.com/codex/mcp):

```sh
codex mcp add daemonv12 -- /absolute/path/to/node \
  /absolute/path/to/daemonv12/mcp/bin/daemonv12-mcp.js \
  --root /absolute/path/to/music-workspace
codex mcp get daemonv12 --json
codex mcp list
```

For rootless audio, register with the literal paths printed by the bootstrap:

```sh
codex mcp add daemonv12 \
  --env DAEMONV12_FLUIDSYNTH=/absolute/path/to/audio-tools/runtime/bin/fluidsynth \
  --env DAEMONV12_SOUNDFONT=/absolute/path/to/audio-tools/soundfonts/FluidR3_GM.sf2 \
  --env DAEMONV12_FFMPEG=/absolute/path/to/audio-tools/runtime/bin/ffmpeg \
  -- /absolute/path/to/node \
  /absolute/path/to/daemonv12/mcp/bin/daemonv12-mcp.js \
  --root /absolute/path/to/music-workspace
```

Equivalent explicit TOML configuration:

```toml
[mcp_servers.daemonv12]
command = "/absolute/path/to/node"
args = ["/absolute/path/to/daemonv12/mcp/bin/daemonv12-mcp.js", "--root", "/absolute/path/to/music-workspace"]

[mcp_servers.daemonv12.env]
DAEMONV12_FLUIDSYNTH = "/absolute/path/to/audio-tools/runtime/bin/fluidsynth"
DAEMONV12_SOUNDFONT = "/absolute/path/to/audio-tools/soundfonts/FluidR3_GM.sf2"
DAEMONV12_FFMPEG = "/absolute/path/to/audio-tools/runtime/bin/ffmpeg"
```

Restart/reload the client after configuration. `mcp get/list` inspect registration;
they do not prove audio rendering. In an agent session, discover the tools, read
or validate `examples/sample-only-demo.json` (when the root is this checkout),
and render it to hear working audio. No API key is needed by DaemonV12 itself.

## Generic `mcpServers` JSON / Claude-style clients

Put this entry in your client's stdio MCP configuration, replacing every
placeholder. For Claude Code, the `mcpServers` wrapper is also the project
`.mcp.json` shape; see the
[official Claude MCP docs](https://code.claude.com/docs/en/mcp).

```json
{
  "mcpServers": {
    "daemonv12": {
      "command": "/absolute/path/to/node",
      "args": [
        "/absolute/path/to/daemonv12/mcp/bin/daemonv12-mcp.js",
        "--root",
        "/absolute/path/to/music-workspace"
      ],
      "env": {
        "DAEMONV12_FLUIDSYNTH": "/absolute/path/to/audio-tools/runtime/bin/fluidsynth",
        "DAEMONV12_SOUNDFONT": "/absolute/path/to/audio-tools/soundfonts/FluidR3_GM.sf2",
        "DAEMONV12_FFMPEG": "/absolute/path/to/audio-tools/runtime/bin/ffmpeg"
      }
    }
  }
}
```

Omit `env` when system audio tools are already on the client's PATH and the
SoundFont is in a standard location, or when only plain sample WAVs are needed.
Use `command -v node` to locate your supported Node executable. Generic JSON does
not perform shell expansion: `~`, `$HOME` and `${VAR}` should be replaced with
absolute values unless your specific client explicitly supports them.

## Environment and troubleshooting

| Setting | Purpose |
|---|---|
| `DAEMONV12_FLUIDSYNTH` | Operator-selected FluidSynth executable; required for GM audio if PATH cannot locate it. |
| `DAEMONV12_SOUNDFONT` | Readable GM `.sf2`; no fallback when an explicit path is bad. |
| `DAEMONV12_FFMPEG` | FFmpeg executable for production effects, MP3 and loudness analysis. |
| PATH | Must locate supported Node; use an absolute Node command when a desktop client does not inherit terminal PATH. |

Set paths in the **client/server environment**, not in tool arguments. The client
must run on a machine/container that can see the checkout, workspace and audio
tools; a local desktop process cannot access a remote Cloud filesystem path.
There is no HTTP endpoint or hosted service to configure.

Stdout carries MCP JSON-RPC only. A manual launch that waits silently is normal.
Startup errors appear on stderr and exit 2: check the Node version, run `npm ci`
at the checkout root, and ensure `--root` exists. For render failures, run doctor
with the same environment as the client. Client approval/configuration locations
are client concerns; they do not change engine contracts.

Verification for this pass: Codex CLI **0.161.0** registration syntax/config
reading, and generic JSON command/args/env launched through official SDK client
**2.3.1**, from outside the repository, with nine-tool discovery. Automated
`npm run smoke -- --mcp` verifies the same server launch. Claude-style JSON is
protocol-tested; the Claude desktop UI and an authenticated Codex conversation
are not exercised by the fast smoke.
