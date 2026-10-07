# DaemonV12 Roadmap

North star (V1): **an agent independently scores a short section of the Shoot the Moon project with
DaemonV12 and exports usable audio and stems.** Each phase adds exactly one capability layer. No phase
replaces the project format: new capabilities arrive as new `instrument.type` values, new optional
fields or new pipeline stages (see ARCHITECTURE §11).

| Phase | Capability unlocked | Explicitly deferred |
|---|---|---|
| **V0** — JSON → MIDI → WAV | Strict, agent-friendly project format: semantic time, track-local patterns + clips, GM instruments by name. Staged validation with fix hints. Canonical byte-exact MIDI. Headless FluidSynth render to WAV with a provenance manifest. CLI `validate` / `midi` / `render` with `--json` and exit-code classes. 1–15 tracks mixed into one WAV. 8-bar demo. | Everything below, plus tempo/meter changes, CC/automation, drums, and randomness. |
| **V0.1** — Multitrack stems | `render --stems`: independent per-track MIDI → FluidSynth WAVs, unchanged V0 master, deterministic stem provenance and all-or-nothing cleanup on command completion. Existing formatVersion 1; no authoring changes. | Mixdown from stems, gain/pan, fixed tails/equal-length output, `inspect`, `fmt`, samples, effects, encoding, analysis. |
| **V0.2** — Samples & drum kits (implemented) | `instrument.type: "drumkit"` with named/pitch-mapped hits and `"sampler"` one-shots. Reusable contained kit assets, fixed PCM WAV validation, exact tick-to-frame placement, velocity and overlapping tails. Deterministic JS PCM stems and combined GM/sample master with provenance. [Contract](V0_2_SAMPLES.md). | Pitch shifting/melodic samplers, resampling, time-stretching, streaming, synthesis, effects, MP3. |
| **V0.3** — Mixer, effects, FFmpeg, analysis | Declarative per-track and master `effects` (EQ, compressor, reverb, delay) compiled to an FFmpeg filtergraph. Buses. WAV/FLAC/MP3 export. `analyze` command: integrated LUFS, true peak, RMS per bar, spectral balance, waveform and spectrogram PNG, all as JSON metrics an agent can reason about. Loudness-normalized masters. | MCP, automation curves. |
| **V0.4** — MCP server | stdio MCP server wrapping the same pipeline: `validate_project`, `render_project`, `inspect_timeline`, `analyze_audio`, `list_instruments`, `apply_edit` (structured, validated edits instead of whole-file rewrites), `get_schema` (JSON Schema exported from the format). | Remote/cloud rendering, auth, multi-user. |
| **V1** — 12 voices + Shoot the Moon | **The V12 rack** as `instrument.type: "voice"`: Kick, Snare, Hats, Percussion, Bass, Keys, Pad, Lead, Strings, Brass, Texture, FX. Each is a curated, versioned, pinned sound source, so an agent picks from 12 well-defined voices instead of 128 GM programs. Scoring features: tempo map, meter changes, dynamics/expression automation, sections/markers, transpose/repeat, seeded humanize. **Milestone: an agent-composed Shoot the Moon section, exported as master + stems.** | Custom DSP synth engine, VST hosting, GUI/piano roll, cloud service, accounts, marketplace. |

## Order notes

- The order follows the original plan. One small item was pulled forward: **V0 already supports up to
  15 tracks** in a single mix. The schema has `tracks[]` anyway, SMF format 1 is natively multi-track,
  and channel assignment is a few lines of code. A one-track limit would have been an artificial rule
  to remove later. V0.1 keeps everything stem-specific.
- V0.1 is scoped to independent stems. The master still uses the original full-project FluidSynth
  render. Mixing and exact-length output are deferred; WAVs retain natural renderer tails.
- V0.2 brings forward only the PCM summing required to combine samples with that GM master.
  General mixer controls, effects and FFmpeg remain V0.3 work. No V0/V0.1 behavior is replaced.
- Tempo and meter changes wait until V1 because the 8–32-bar cues needed before scoring do not need them.
  The tick-based Timeline already supports them, so adding them is additive.
