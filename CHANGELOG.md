# Changelog

Notable changes to DaemonV12. Every release reads project `formatVersion: 1`, and
existing projects keep their rendered output unless an entry says otherwise. No
version has been tagged or published to npm yet.

## 0.6.0: sample performance (2026-10-11)

The last engine milestone before distribution. Projects without the new fields
render byte-identical audio to 0.5.0 (the Orbital Foundry, GLASSHOUSE and
GLASS//FIRE masters and stems are pinned in the test suite).

- **Playback rate.** Sampler and drum-kit notes take optional `playbackRate`
  (0.25–4). Pitch and duration change together; this is not time-stretching.
- **Glides.** `glide: {"to": rate, "duration": "1/8"}` moves the rate linearly from
  the note onset, with a continuous read position, then holds it: tape stops,
  spin-ups, dives and vocal bends.
- **Source offsets.** `offsetSeconds` starts a voice inside its WAV (microsecond
  input, nearest source frame). Offsets at or past the end are validation errors.
- **Interpolation.** Band-limited Kaiser-windowed sinc with a rate-following cutoff,
  bit-exact on every platform. Rate 1 without a glide copies source frames exactly.
- **Provenance and MCP.** Performed triggers record rate, glide, requested and
  resolved offset and voice length; `samples.playback` names the algorithm. The nine
  MCP tools accept the fields; there is no new tool. Agent-facing hints convert
  semitone guesses and redirect field aliases.
- **Render budget.** Compilation rejects projects whose transformed voices would
  exceed one billion interpolation taps in total or a 128 MiB buffer per voice,
  before any audio work, with a structured `OUT_OF_RANGE` diagnostic.
- **GHOST//SHIFT.** A 12-second starter project in which one GLASSHOUSE vocal sample
  performs a whole lead. `npm run demo:ghost-shift`, `npm run test:v06`.
- [V0_6_SAMPLE_PERFORMANCE.md](docs/V0_6_SAMPLE_PERFORMANCE.md) is the contract.

### Public beta packaging (first released with 0.6.0)

No engine, project-format or audio changes. Renders are byte-identical to 0.5.0.

- **One package, two executables.** `daemonv12` (CLI) and `daemonv12-mcp` (MCP
  server). The MCP runtime dependencies (`@modelcontextprotocol/server`, `zod`) are
  now package dependencies and the separate `mcp/` npm workspace is gone.
  `mcp/bin/daemonv12-mcp.js` keeps working for existing source-checkout configs.
- **Installable tarball.** Node does not strip TypeScript types under
  `node_modules`, so installed copies run JavaScript compiled into `dist/` by the
  `prepare` script during `npm pack` / `npm publish`. Source checkouts still run
  TypeScript directly. An explicit `files` allowlist ships the runtime, seven starter
  projects, the CC0 sound packs, the format docs and the rootless audio bootstrap.
- **`daemonv12 init <dir>`** creates a music workspace (starter projects and sound
  packs) and prints the MCP client configuration for it.
- **MCP startup UX.** `--help` and `--version`; specific errors for a missing,
  non-existent or non-directory `--root` and for unexpanded `~`; readable
  unsupported-Node and missing-dependency messages; server `instructions` that
  describe the tool workflow to agents.
- **Doctor.** Reports `installation` (source checkout or installed package),
  explains what each capability unlocks, and gives fixes with the absolute
  bootstrap path plus apt and Homebrew package names.
- **`npm run demo:share`** renders the most complete demo the machine supports and
  prints paths, duration, loudness and how to listen.
- **Release gate.** `npm run test:package` packs the repository, installs the
  tarball into an empty directory, and checks both executables, a Node-only
  render, nine MCP tools and that nothing loads from the source checkout. CI runs
  it; a manual workflow verifies full audio.
- **Docs.** README rewritten for first-time users; new examples guide, MCP client
  guide, CONTRIBUTING, SECURITY and public-beta release checklist.
- **GLASSHOUSE sound pack.** Ten original CC0 electronic/bass sounds tuned to C#:
  one glass identity (hit, reverse, crush, prism impact), one synthetic voice
  (ghost-vox, vox-chip), a phase-locked punch/sub pair, clap and hat. Deterministic
  4x-oversampled generator, catalog, seven-hit kit, a 140 BPM audition (a starter
  project) and source/render tests. Asset and documentation only; the engine is
  unchanged.

## 0.5.0: timeline, automation, ducking and dynamics (2026-10-08)

- `render.duration` (bars, musical fraction or seconds) and `render.tail` for exact
  video and loop lengths, with aligned production stems.
- Track gain/pan automation in musical or wall-clock time.
- Master voice-over ducking from a contained reference WAV.
- Ordered compressor, algorithmic reverb and soft saturation effects.
- The nine MCP tools accept the new fields.

## Sound packs and portfolio (2026-10-07)

- Orbital Foundry: twelve original CC0 cinematic/industrial sounds, a seven-hit
  kit, a machine-readable catalog and a 30-second audition.
- Shoot the Moon: a 24-bar score composed by an agent through the MCP tools, with
  its review report.
- Developer readiness: `doctor`, the rootless Linux audio bootstrap, smoke checks
  and portable CI.

## 0.4.0: MCP server (2026-10-07)

- Nine stdio MCP tools: project create, read, validate and transactional patch;
  instrument and kit discovery; render; analyze; render provenance.

## 0.3.0: production audio (2026-10-07)

- Track gain/pan, master gain, high-pass, low-pass and delay; WAV plus MP3;
  peak, RMS, LUFS, loudness-range and true-peak analysis.

## 0.2.0: samples and drum kits (2026-10-07)

- `sampler` one-shots and reusable `drumkit` instruments mixed with General MIDI.

## V0.1: stems (2026-10-06)

- `render --stems`: deterministic per-track WAV stems (engine version unchanged).

## 0.0.1: V0 (2026-10-06)

- JSON project format, staged validation with repair hints, canonical MIDI and
  headless FluidSynth WAV rendering with a provenance manifest.
