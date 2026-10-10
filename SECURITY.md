# Security

DaemonV12 is a public beta. Please report vulnerabilities privately through
GitHub's **Report a vulnerability** form on the repository's Security tab
(private vulnerability reporting), not in a public issue. Include the version
(`daemonv12 --version`), your platform and a minimal reproduction. If private
reporting is unavailable, open an issue asking for a private contact without
including details.

Security fixes target the latest release only.

## What DaemonV12 is designed to protect

- **MCP workspace containment.** Agent-supplied paths must stay inside the
  `--root` workspace. Absolute paths, `..` traversal, hidden components, symlinks,
  hard links and special files are rejected. Projects cannot be written under
  `assets/` or `node_modules/`, and renders go to fresh directories under
  `.daemonv12-renders/`.
- **No executable input from agents.** MCP tools cannot choose executables,
  shell commands, environment variables, SoundFont paths or output directories.
  Those come only from the operator's environment (`DAEMONV12_FLUIDSYNTH`,
  `DAEMONV12_SOUNDFONT`, `DAEMONV12_FFMPEG`).
- **No network access.** The engine and MCP server make no network requests and
  expose no HTTP endpoint. Only the optional audio bootstrap script downloads
  files, from pinned URLs with SHA-256 verification.
- **No install-time scripts.** The package runs nothing during `npm install`.

## Limits of that boundary

The MCP server is a local, single-operator boundary for agent-supplied paths,
not an OS sandbox. Another process with the same filesystem permissions can
still change the workspace. Run one server per workspace, and do not point
`--root` at a directory containing secrets. FluidSynth and FFmpeg are external
programs that parse the audio DaemonV12 gives them; keep them updated.
Reports about a path escape, unexpected file access or execution are in scope.
