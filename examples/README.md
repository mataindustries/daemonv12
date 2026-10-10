# DaemonV12 example projects

Each JSON file is a complete DaemonV12 project. Sounds are referenced as
`assets/...` relative to the project file, so these projects work both here and
in a workspace created by `daemonv12 init <directory>` (which copies this guide,
the projects below and `assets/`).

Run commands from this directory. Use `daemonv12` after a global install, or
`node /path/to/daemonv12/bin/daemonv12.js` with a project-local install or a
source checkout (`daemonv12 init` prints the exact form for your copy). Output
goes to `renders/` here.

## Start here

| Project | What it demonstrates | Needs | Length |
|---|---|---|---|
| `sample-only-demo.json` | Pulse drum kit and an impact one-shot; 8 bars at 96 BPM. | Node only | 20.0 s |
| `orbital-foundry-audition.json` | All twelve Orbital Foundry sounds across 12 tracks with per-track gain/pan. | FFmpeg | 30.0 s |
| `v05-loop-demo.json` | An exact four-bar game layer at 100 BPM: tails are cut at the boundary and stems align. | FFmpeg | exactly 9.6 s (423,360 frames) |
| `v05-video-demo.json` | Locked-picture cue: exact 8 s output, gain/pan automation, VO ducking, compressor, reverb and saturation. | FFmpeg | exactly 8.0 s |
| `production-demo.json` | General MIDI bass and piano with samples, gain/pan, high/low-pass filters and delay. | FluidSynth, SoundFont, FFmpeg | 23.2 s |
| `shoot-the-moon-locked-score.json` | A 24-bar cinematic score composed by an agent through the MCP tools: Orbital Foundry plus four GM voices, 14 tracks. | FluidSynth, SoundFont, FFmpeg | 61.0 s (57.6 s score plus release tail) |

`daemonv12 doctor` tells you which of these your machine can render. Plain
sample projects need nothing beyond Node. Any `mix`, `effects`, `automation`,
`master` or `render` field uses the production renderer, which needs FFmpeg.
General MIDI (`"type": "gm"`) tracks need FluidSynth and a GM SoundFont.

```sh
daemonv12 render sample-only-demo.json                          # WAV, MIDI and provenance
daemonv12 render orbital-foundry-audition.json --stems --format wav,mp3
daemonv12 render v05-loop-demo.json --stems                     # exactly 423,360 frames
daemonv12 analyze renders/orbital-foundry-audition.wav          # LUFS, true peak, clipping
```

Re-rendering a project with the same inputs and tool versions produces
byte-identical WAV, stems and manifests; each `.render.json` records the hashes
and tool versions. MP3 is a listening copy, not a repeatability guarantee.

## Sounds

- `assets/orbital-foundry/`: twelve original cinematic/industrial sounds and a
  seven-hit kit (`kit.json`), CC0-1.0. `orbital-foundry.catalog.json` describes
  every sound's role, duration, peak and suggested use.
- `assets/pulse-kit/`: a small kick/snare/hat kit and an impact, CC0-1.0.
- `assets/v05/synthetic-vo.wav`: synthetic voice-over activity used as a ducking
  reference (not speech), CC0-1.0.

To use them in another project directory, copy the pack directory into that
project's own `assets/` directory. Asset WAVs must be 44.1 kHz, 16-bit PCM,
mono or stereo.

## Reference

Project format and behavior:
[V0 spec](https://github.com/mataindustries/daemonv12/blob/main/docs/V0_SPEC.md),
[samples and kits](https://github.com/mataindustries/daemonv12/blob/main/docs/V0_2_SAMPLES.md),
[production audio](https://github.com/mataindustries/daemonv12/blob/main/docs/V0_3_AUDIO.md),
[timeline and dynamics](https://github.com/mataindustries/daemonv12/blob/main/docs/V0_5_TIMELINE_DYNAMICS.md),
[MCP clients](https://github.com/mataindustries/daemonv12/blob/main/docs/MCP_CLIENTS.md).

In a source checkout, `examples/` also keeps historical and test fixtures that
are not part of the package or `init`: `demo.json` (the V0 General MIDI golden
demo), `sample-demo.json` (mixed GM/sample V0.2 demo) and `first-agent-cue.json`
(an early agent-composed cue).
