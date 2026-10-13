# DaemonV12 Roadmap

North star (V1): **an agent independently scores a short section of the Shoot the Moon project with
DaemonV12 and exports usable audio and stems.** Each phase adds exactly one capability layer. No phase
replaces the project format: new capabilities arrive as new `instrument.type` values, new optional
fields or new pipeline stages (see ARCHITECTURE §11).

| Phase | Capability unlocked | Explicitly deferred |
|---|---|---|
| **V0** — JSON → MIDI → WAV | Strict, agent-friendly project format: semantic time, track-local patterns + clips, GM instruments by name. Staged validation with fix hints. Canonical byte-exact MIDI. Headless FluidSynth render to WAV with a provenance manifest. CLI `validate` / `midi` / `render` with `--json` and exit-code classes. 1–15 tracks mixed into one WAV. 8-bar demo. | Everything below, plus tempo/meter changes, CC/automation, drums, and randomness. |
| **V0.1** — Multitrack stems | `render --stems`: independent per-track MIDI → FluidSynth WAVs, unchanged V0 master, deterministic stem provenance and all-or-nothing cleanup on command completion. Existing formatVersion 1; no authoring changes. [Contract](V0_1_STEMS.md). | Mixdown from stems, gain/pan, fixed tails/equal-length output, `inspect`, `fmt`, samples, effects, encoding, analysis. |
| **V0.2** — Samples & drum kits (implemented) | `instrument.type: "drumkit"` with named/pitch-mapped hits and `"sampler"` one-shots. Reusable contained kit assets, fixed PCM WAV validation, exact tick-to-frame placement, velocity and overlapping tails. Deterministic JS PCM stems and combined GM/sample master with provenance. [Contract](V0_2_SAMPLES.md). | Pitch shifting/melodic samplers, resampling, time-stretching, streaming, synthesis, effects, MP3. |
| **V0.3** — Production audio (implemented) | Per-track gain/stereo balance, master gain, high-pass/low-pass/single-tap delay; isolated FFmpeg adapter; WAV plus optional MP3; PCM peak/RMS/clipping and integrated LUFS/LRA/true-peak analysis; common production stem duration; deterministic provenance. [Contract](V0_3_AUDIO.md). | Buses, FLAC, reverb/compressor/multi-band EQ, normalization, per-bar/spectral/image analysis, MCP, automation curves. |
| **V0.4** — MCP server (implemented) | Nine stdio tools over the same core: project create/read/validate/patch, instrument/kit discovery, render (including stems/MP3), analyze, render info. Typed semantic edit batches, revision checks, atomic publication, explicit workspace containment, SDK-discovered JSON input schemas, real end-to-end agent demo. [Contract](V0_4_MCP.md). | Remote/cloud rendering, auth, multi-user, standalone full project-schema export. |
| **V0.5** — Timeline & dynamics (implemented) | Exact output durations (bars, musical time, seconds) and tail control for video cues and game loops; track gain/pan automation; master voice-over ducking; compressor, reverb and saturation; the nine MCP tools accept the new fields. [Contract](V0_5_TIMELINE_DYNAMICS.md). | Tempo maps, buses/sidechain routing, loop crossfades, adaptive game integration. |
| **Public beta** — packaging (0.5, no engine change) | One installable package with `daemonv12` and `daemonv12-mcp`; compiled `dist/` for installed copies; `daemonv12 init` workspaces; a clean-room tarball release gate in CI; first-run docs. [Release checklist](PUBLIC_BETA_RELEASE.md). | npm publication and the code license (owner decisions). |
| **V0.6** — Sample performance (implemented) | Sampler and drum-kit notes take optional `playbackRate` (0.25–4; pitch and duration change together), a linear-rate `glide` and `offsetSeconds` into the source. Band-limited, bit-exact interpolation; the rate-1 path is unchanged and projects without the fields render 0.5.0 bytes. Same render path, provenance per trigger, nine MCP tools. GHOST//SHIFT demo. [Contract](V0_6_SAMPLE_PERFORMANCE.md). | Time-stretching, formant preservation, granular, reverse, slicing grids, resample-to-asset, warp markers, LFOs, modulation matrix, streaming, plugin hosting, new MCP tools. |
| **V0.7** — Sampler articulation (implemented) | Optional exclusive `endSeconds` slices, musical `gate`, output-time attack/release `envelope`, and track-local `chokeGroup`. Opt-in endpoint fades, exact grid/seconds rounding, work budgets based on rendered voice frames, unchanged V0.6 playback and historical bytes. Existing nine MCP tools; ONE SOUND before/after uses one original WAV for percussion and controlled low-end tails. [Contract](V0_7_SAMPLER_ARTICULATION.md). | Loops, slicing grids, cross-track chokes, time-stretching, reverse, exponential envelopes, streaming, new effects or MCP tools. |
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
- V0.6 came from composing GLASS//FIRE: sampler events could trigger a sound but not perform it, so
  pitch moves, tape rises/falls and chops needed pre-rendered assets. It is deliberately narrow (one
  sample becomes performable).
- V0.7 adds the complementary articulation layer: agents can bound a source slice,
  request a musical release and govern overlapping voices. Controls are opt-in so
  earlier cues, interpolation and tails retain their bytes.
