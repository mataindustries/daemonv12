# Optional headless audio setup

Use this only when a real render reports audio-device initialization failure.
First run `node bin/daemonv12.js doctor --json` and a minimal render. A missing
executable, SoundFont, library, or FFmpeg capability is a different problem;
follow the engine's `docs/DEVELOPER_SETUP.md` for those cases.

DaemonV12 renders files. Nevertheless, some FluidSynth/SDL builds try to open an
audio device even in a cloud environment. Round 1 found a useful environment
workaround: `SDL_AUDIODRIVER=dummy`, FluidSynth `-a file`, and
`-o player.timing-source=sample`. Do not install or activate this automatically.
Sample-only projects do not need FluidSynth.

## Opt-in wrapper

After reproducing the device error, create a wrapper outside the engine, in
the composition workspace. Replace the absolute executable path with the real
FluidSynth executable discovered on that machine; it must not point back to
this wrapper. Preserve any existing launcher needed for its libraries.

```sh
#!/bin/sh
export SDL_AUDIODRIVER=dummy
exec /absolute/path/to/real/fluidsynth -a file -o player.timing-source=sample "$@"
```

Make that file executable, then select it for the affected command only:

```sh
chmod +x /path/to/workspace/fluidsynth-headless
DAEMONV12_FLUIDSYNTH=/path/to/workspace/fluidsynth-headless \
  node bin/daemonv12.js doctor --json
DAEMONV12_FLUIDSYNTH=/path/to/workspace/fluidsynth-headless \
  node bin/daemonv12.js render /path/to/project.json --out-dir /path/to/render --json
```

The wrapper forwards the engine's arguments unchanged after the extra options,
including the output path and format. It is an environment workaround, not an
engine patch or a guarantee for every FluidSynth build. Check that `--version`
probing and a real render succeed, inspect stderr, verify nonempty audio, then
analyze the WAV. A doctor pass alone does not prove rendering works.

Keep the workaround local to commands that need it. Record its contents/hash,
real executable version, SoundFont hash, and environment in provenance notes.
Use identical settings for both deterministic renders. In a benchmark the
organizer must provide equivalent environment settings to every contestant.

Verified integration points at `ed75e9e2a0172266e56b292886ad7c1500677862`:
`src/render/fluidsynth.ts` (`fluidSynthCommand`, `buildArgs`) reads
`DAEMONV12_FLUIDSYNTH`, forwards inherited environment, and already requests
offline WAV output with `-F`. See `docs/DEVELOPER_SETUP.md` and
`docs/MCP_CLIENTS.md` for environment configuration. The additional headless
flags above are an optional operational lesson, not an engine requirement.
