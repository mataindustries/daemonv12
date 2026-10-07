# DaemonV12 Roadmap

North star (V1): **an agent independently scores a short section of the Shoot the Moon project with
DaemonV12 and exports usable audio and stems.** Each phase adds exactly one capability layer. No phase
replaces the project format: new capabilities arrive as new `instrument.type` values, new optional
fields or new pipeline stages (see ARCHITECTURE §11).

| Phase | Capability unlocked | Explicitly deferred |
|---|---|---|
| **V0** — JSON → MIDI → WAV | Strict, agent-friendly project format: semantic time, track-local patterns + clips, GM instruments by name. Staged validation with fix hints. Canonical byte-exact MIDI. Headless FluidSynth render to WAV with a provenance manifest. CLI `validate` / `midi` / `render` with `--json` and exit-code classes. 1–15 tracks mixed into one WAV. 8-bar demo. | Everything below, plus tempo/meter changes, CC/automation, drums, and randomness. |
| **V0.1** — Stems & mixdown | `render --stems`: one sample-aligned, equal-length WAV per track; deterministic mixdown of the stems. Optional per-track `mix` (`gain` dB, `pan`). `inspect` command (flattened Timeline as JSON, so agents can see what plays when). `fmt` command (canonical layout: one note per line, canonical key order, so diffs stay one line per musical change). Exact-length output (musical length + fixed tail). | Samples, effects, encoding, analysis. |
| **V0.2** — Samples & drum kits | `instrument.type: "drumkit"` with named hits (`"pitch": "kick"`) and `"sampler"` (one-shot and pitch-mapped samples). Sample files are referenced by path, hashed in the manifest and never embedded. A deterministic JS sample renderer produces stems next to FluidSynth stems. | Time-stretching, synthesis, effects, MP3. |
| **V0.3** — Mixer, effects, FFmpeg, analysis | Declarative per-track and master `effects` (EQ, compressor, reverb, delay) compiled to an FFmpeg filtergraph. Buses. WAV/FLAC/MP3 export. `analyze` command: integrated LUFS, true peak, RMS per bar, spectral balance, waveform and spectrogram PNG, all as JSON metrics an agent can reason about. Loudness-normalized masters. | MCP, automation curves. |
| **V0.4** — MCP server | stdio MCP server wrapping the same pipeline: `validate_project`, `render_project`, `inspect_timeline`, `analyze_audio`, `list_instruments`, `apply_edit` (structured, validated edits instead of whole-file rewrites), `get_schema` (JSON Schema exported from the format). | Remote/cloud rendering, auth, multi-user. |
| **V1** — 12 voices + Shoot the Moon | **The V12 rack** as `instrument.type: "voice"`: Kick, Snare, Hats, Percussion, Bass, Keys, Pad, Lead, Strings, Brass, Texture, FX. Each is a curated, versioned, pinned sound source, so an agent picks from 12 well-defined voices instead of 128 GM programs. Scoring features: tempo map, meter changes, dynamics/expression automation, sections/markers, transpose/repeat, seeded humanize. **Milestone: an agent-composed Shoot the Moon section, exported as master + stems.** | Custom DSP synth engine, VST hosting, GUI/piano roll, cloud service, accounts, marketplace. |

## Order notes

- The order follows the original plan. One small item was pulled forward: **V0 already supports up to
  15 tracks** in a single mix. The schema has `tracks[]` anyway, SMF format 1 is natively multi-track,
  and channel assignment is a few lines of code. A one-track limit would have been an artificial rule
  to remove later. V0.1 keeps everything stem-specific.
- V0.1 introduces mixing by summing stems in JS, not FFmpeg, because V0.2's sample stems must mix with
  FluidSynth stems *before* FFmpeg arrives in V0.3. FFmpeg then takes over effects, encoding and analysis.
- Tempo and meter changes wait until V1 because the 8–32-bar cues needed before scoring do not need them.
  The tick-based Timeline already supports them, so adding them is additive.
