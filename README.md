# DaemonV12

**12 instruments for agents.** DaemonV12 V0.3 is a headless music engine: author a JSON project with musical positions, track-local patterns, General MIDI instruments and sampled drum kits, then validate it, generate deterministic MIDI, and render WAV audio with provenance.

## Requirements

Open the repository in its devcontainer, or use Linux with Node **22.18+** and:

```sh
sudo apt-get install -y fluidsynth fluid-soundfont-gm ffmpeg
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
# Six-track sample demo, with generated kick/snare/hats and an impact:
npm run demo:samples
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

`npm run demo:samples` writes `renders/sample-demo.wav`, MIDI, provenance and six stems.
`npm run fixtures:samples` regenerates the small original development sounds.
Sample rendering uses a narrow deterministic PCM layer, with no FFmpeg, resampling,
effects or normalization. Sample/mixed renders are limited to 600 seconds including
tails. See [sample format, timing and provenance](docs/V0_2_SAMPLES.md) for the full contract.

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

## Commands

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

- [V0 specification](docs/V0_SPEC.md): exact format, timing, diagnostics, and output contracts.
- [V0.3 audio production](docs/V0_3_AUDIO.md): gain/pan, effects, WAV/MP3, analysis and provenance.
- [V0.2 samples](docs/V0_2_SAMPLES.md): one-shots, reusable kits, PCM mixing, asset security, provenance and limits.
- [Architecture](docs/ARCHITECTURE.md): module boundaries and determinism model.
- [Implementation handoff](docs/CODEX_HANDOFF.md): milestones and acceptance tests.
- [Roadmap](docs/ROADMAP.md): later phases, outside V0.
