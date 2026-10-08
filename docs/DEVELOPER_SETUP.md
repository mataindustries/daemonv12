# Developer setup and portability

Node **22.18.0+** runs the repository's TypeScript directly. Run `npm ci` from the
checkout root; it installs both the engine's development tools and the MCP
workspace's pinned dependencies. No build or global `npm link` is required.
The CLI and MCP server render offline; no audio device or desktop session is needed.

## Doctor

```sh
npx --no-install daemonv12 doctor
npx --no-install daemonv12 doctor --json
npx --no-install daemonv12 doctor --soundfont /absolute/path/to/FluidR3_GM.sf2 --json
```

Doctor only reads files and runs bounded version/filter/encoder probes. It does
not render, install, create output directories or modify configuration. The
SoundFont resolver reads its RIFF/sfbk header and hashes its bytes, just as the
renderer does. This checks availability, not the completeness/playability of all
SoundFont instruments. Run a demo to prove real audio.

JSON has `schemaVersion: 1`, `command: "doctor"`, `engineVersion`, `ok`, `platform`,
`architecture`, `node`, `npm`, `fluidsynth`, `soundfont`, `ffmpeg`, `dependencies`,
`readiness` and `fixes`. Missing paths/versions are `null`; readiness values are
booleans. `fixes` contains `{component, action}` objects. There are no timestamps
or render artifacts. Example excerpt from an environment without audio tools:

```json
{
  "schemaVersion": 1,
  "command": "doctor",
  "engineVersion": "0.4.0",
  "ok": false,
  "readiness": {
    "generalMidi": false,
    "sampleOnly": true,
    "productionEffects": false,
    "mp3": false,
    "loudnessAnalysis": false,
    "mcp": true
  }
}
```

| Check | Meaning |
|---|---|
| `node` | Current version, supported flag, `>=22.18.0` requirement and executable path. Unsupported Node may fail to load TypeScript before doctor starts; check `node --version` first. |
| `npm` | Optional version/path probe. npm is needed for dependency installation, not audio rendering. |
| `fluidsynth` | Selected command, resolved path, version, availability and probe error. |
| `soundfont` | Selection source (`argument`, `environment`, `default`, `missing`), absolute path, readability, header validity, size, SHA-256 and error. |
| `ffmpeg` | Selected command/path/version, availability, filter/encoder capabilities and probe diagnostic. |
| `dependencies` | Zero engine runtime dependencies; presence and exact version of root development tools and the MCP workspace's runtime dependencies. |
| `readiness.generalMidi` | Supported Node + working FluidSynth version probe + readable RIFF/sfbk SoundFont. |
| `readiness.sampleOnly` | Supported Node; no FluidSynth, SoundFont, FFmpeg or npm requirement. Applies to plain sample WAV rendering without production fields/export. |
| `readiness.productionEffects` | Supported Node + FFmpeg highpass/lowpass/aecho, float PCM encoder and loudnorm (production rendering also analyzes the result). |
| `readiness.mp3` | Supported Node + FFmpeg libmp3lame and loudnorm. |
| `readiness.loudnessAnalysis` | Supported Node + FFmpeg loudnorm. |
| `readiness.mcp` | Supported Node + the pinned MCP runtime packages present. Stdio startup is verified separately by smoke. |

Exit **0** means all six readiness flags are true; **3** means at least one is
false. Missing npm/development tools produce fixes but do not block an installed
runtime's readiness. Usage errors exit **2**. A minimal sample environment can
therefore have a successful smoke and a doctor exit of 3; inspect `readiness`, not
just `ok`, for the capability you need.

Selection follows the renderer's existing rules:

- FluidSynth: `DAEMONV12_FLUIDSYNTH`, otherwise `fluidsynth` on PATH.
- SoundFont: `--soundfont`, then `DAEMONV12_SOUNDFONT`, then the existing standard
  system locations in `src/render/soundfont.ts`. A bad explicit selection never
  silently falls back to a system file.
- FFmpeg: `DAEMONV12_FFMPEG`, otherwise `ffmpeg` on PATH.

## Rootless Linux bootstrap

```sh
./scripts/bootstrap-audio-tools.sh
# Or select a persistent user-owned directory:
./scripts/bootstrap-audio-tools.sh --prefix /absolute/user-writable/audio-tools
```

Supported: **Linux x86_64, glibc >=2.28**. Requires Bash, curl with HTTPS/TLS trust,
GNU core utilities, `getconf`, `ar`, `tar` and `xz`. It never uses sudo, apt
installation, dpkg installation, shell activation or startup-file edits. It
rejects system-directory prefixes and refuses to overwrite an unrelated runtime.

The default prefix is
`${XDG_DATA_HOME:-$HOME/.local/share}/daemonv12/audio-tools`; override it with
`DAEMONV12_AUDIO_PREFIX` or `--prefix`. Use a path that persists across environment
sessions. Files are provisioned there:

| Path beneath prefix | Contents |
|---|---|
| `bin/micromamba` | Official micromamba **2.3.2-0**, SHA-256 pinned in the script. |
| `runtime/bin/fluidsynth` | conda-forge **2.3.7**, build `hd992666_0`. |
| `runtime/bin/ffmpeg` | conda-forge **6.1.1**, GPL build `gpl_h0db5852_117`, including libmp3lame and required filters. |
| `runtime/`, `mamba/`, `cache/` | Runtime libraries, package metadata and user-space cache. |
| `soundfonts/FluidR3_GM.sf2` | FluidR3 GM, extracted from Debian `fluid-soundfont-gm_3.1-5.3_all.deb`; package and extracted file both SHA-256 verified. |
| `soundfonts/FluidR3-GM.copyright` | Original Debian/upstream license notice retained with the SoundFont. |
| `downloads/`, `env.sh` | Verified downloaded artifacts and explicit Bash exports for the engine. |

All **122** conda package versions, builds, HTTPS URLs and SHA-256 hashes are
checked into `scripts/audio-tools-linux-64.lock`. Installation uses that explicit
lock with enabled integrity checks, not a floating solve or `latest` endpoint.
The script probes both binaries and verifies the required FFmpeg filters and
encoder before printing success. Micromamba may also register the environment
in user-owned conda metadata; it does not modify shell startup files.

A completed rerun probes and reuses the same runtime and verified SoundFont
without downloads. An interrupted download is replaced after verification; an
interrupted owned runtime install can be retried. A concurrent run is rejected.
After forcibly killing a run, check no bootstrap is active before removing its
reported `.bootstrap-lock` directory. A changed package lock requires a new
prefix, preserving the old installation.

Apply the printed exports explicitly, for example:

```sh
source "${DAEMONV12_AUDIO_PREFIX:-${XDG_DATA_HOME:-$HOME/.local/share}/daemonv12/audio-tools}/env.sh"
npx --no-install daemonv12 doctor --json
npm run demo                    # real General MIDI audio
npm run demo:orbital-foundry    # sample production audio, MP3 and stems
```

Downloads total approximately **250 MB**, including the 114 MiB Debian SoundFont
archive; allow at least **1.5 GB** for extraction, runtime and caches. Network
access is required only for first provisioning/recovery: GitHub release assets
(including their redirected asset host), `conda.anaconda.org` and
`deb.debian.org`. Preserve your platform's proxy and CA trust configuration;
checksums and TLS are not disabled. Blocked upstream access fails explicitly.

ARM, macOS, Windows and musl/Alpine are outside this bootstrap lock. Their
deterministic fallback is the checked-in `demo:sample-only` with supported Node;
for production or GM audio, supply compatible OS tools through the same three
environment variables. No unsupported FFmpeg download is guessed. Updating the
bootstrap means reviewing a new explicit dependency lock/hashes and testing real
GM and production renders, not editing version strings alone.

Sources: [micromamba installation](https://mamba.readthedocs.io/en/stable/installation/micromamba-installation.html),
[explicit package locks](https://mamba.readthedocs.io/en/stable/user_guide/micromamba.html),
[official pinned micromamba release](https://github.com/mamba-org/micromamba-releases/releases/tag/2.3.2-0),
[Debian package integrity](https://packages.debian.org/bookworm/all/fluid-soundfont-gm/download).

## Fast smoke and CI

```sh
npm run smoke
npm run smoke -- --mcp
npm run test:readiness
npm run check
```

Smoke uses `examples/sample-only-demo.json`, an exact subset of the existing
sample-demo drum/impact tracks, with their existing notes/assets. It validates,
renders a master WAV into a fresh ignored `renders/smoke-*` directory, verifies
44.1 kHz/16-bit stereo PCM, nonzero signal, no clipping and the manifest SHA-256,
then prints its listening path. No expensive stems or full agent session runs.
`--mcp` additionally initializes the actual stdio server and discovers nine tools;
it does not edit a project or compose music.

CI runs `npm ci` and the unchanged full check plus sample/MCP smoke on Node
22.18.0 and 24. The smoke step explicitly selects missing external audio tools,
proving the Node-only path. Doctor JSON, missing tools/dependencies and bootstrap
integrity/retry/idempotence/failure behavior have focused tests. Bootstrap tests
use tiny local artifacts and mock downloads/installations; ordinary tests make
no network requests. CI does not download SoundFonts or create a release.

## Cloud setup and persistence

Use these commands in a future environment setup step, from the clone root:

```sh
npm ci
./scripts/bootstrap-audio-tools.sh
source "${DAEMONV12_AUDIO_PREFIX:-${XDG_DATA_HOME:-$HOME/.local/share}/daemonv12/audio-tools}/env.sh"
npx --no-install daemonv12 doctor --json
npm run smoke -- --mcp
```

Persist the **printed absolute values** of `DAEMONV12_FLUIDSYNTH`,
`DAEMONV12_SOUNDFONT` and `DAEMONV12_FFMPEG` through the platform's environment
settings. Prepend the printed `runtime/bin` directory to the platform PATH if
tools will be called by name. Environment settings may not expand `$PATH`, `~`
or shell variables; use the platform's supported PATH mechanism and literal
absolute values. A setup subprocess cannot export variables into future tasks.

Choose a persistent prefix, and rerun the idempotent script when environments are
recreated. The setup comes from committed scripts/locks, not temporary setup-chat
files or an assumed interactive shell. This repository does not configure Codex
Cloud itself.
