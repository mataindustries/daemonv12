# ORBITAL FOUNDRY

Twelve original sounds for lunar machinery, orbital infrastructure, controlled menace and propulsion. This is an offline-generated sound pack for DaemonV12's existing sampler, not an engine extension. The percussion works as a rhythm section; the atmosphere and transitions give it scale without another layer of sub-bass.

**All assets are generated in this repository. No third-party sample material is incorporated.** No recordings, downloaded samples, loops, SoundFonts or impulse responses contribute to these WAVs. The generated WAV assets are dedicated under CC0-1.0; see [LICENSE](LICENSE). They may be redistributed and used in commercial or noncommercial compositions.

## Inventory

All files are 44,100 Hz, signed PCM16 little-endian WAV. Peaks below are sample peaks (approximately ±0.002 dB after quantization), not true-peak guarantees. `M` means mono; `S` means stereo. All paths below are relative to this directory. The machine-readable [catalog](../../orbital-foundry.catalog.json) contains each ID, name, project-relative path, explicit noise seed, duration, channel count, source peak target, SHA-256, synthesis recipe and playing suggestion.

| ID / file | Seconds | Channels | Peak dBFS | Role and application | Velocity | Kit pitch |
|---|---:|:---:|---:|---|---|---:|
| `01-sub-pulse.wav` | 0.30 | M | −6 | Tight 49 Hz propulsion; 98/147 Hz harmonics. Offbeat eighths or quarters. | .55–.85 | 35 |
| `02-mechanical-kick.wav` | 0.42 | M | −6 | Falling pitch into 68 Hz mass; contact and mechanism layers. Four-on-floor or half-time. | .65–.95 | 36 |
| `03-metallic-strike.wav` | 1.65 | M | −7 | Inharmonic steel, mainly 1–6 kHz; sparse syncopated accents. | .40–.85 | 43 |
| `04-machine-tick.wav` | 0.085 | M | −9 | Twin-contact transient, crisp 2–9 kHz; eighths/sixteenths. | .35–.75 | 42 |
| `05-industrial-snare.wav` | 0.38 | M | −6 | Mechanical clamp and noise, strong 600 Hz–5 kHz presence; backbeat. | .60–.95 | 38 |
| `06-low-boom.wav` | 2.4 | M | −7 | Deep 41–95 Hz weight with short pressure texture; phrase boundaries. | .55–.85 | 41 |
| `07-cinematic-impact.wav` | 3.6 | S | −6 | Broadband contact, low mass and mid/high debris with spatial decay; major edits. | .65–.95 | 49 |
| `08-tension-riser.wav` | 4 | S | −8 | Rising pitch, accelerating modulation and opening noise; two bars at 120 BPM. | .55–.90 | sampler |
| `09-reverse-swell.wav` | 2 | S | −8 | Reversed steel and air suction; one bar at 120 BPM. | .45–.80 | sampler |
| `10-dark-drone.wav` | 8 | S | −10 | Moving 110–900 Hz machinery with friction; underlay, not sub reinforcement. | .40–.75 | sampler |
| `11-air-texture.wav` | 8 | S | −11 | Soft, broad upper-frequency width with low frequencies removed. | .35–.70 | sampler |
| `12-alarm-energy-pulse.wav` | 0.8 | M | −8 | Three unequal fixed-tone gates, D4/A-flat4 tension and motor harmonics. | .45–.85 | sampler |

The seven kit entries use semantic names (`sub-pulse`, `mechanical-kick`, `metallic-strike`, `machine-tick`, `industrial-snare`, `low-boom`, `cinematic-impact`). All twelve files can also be used directly as sampler instruments. The kit contains the same WAVs, with no duplicates or hidden variants.

## Agent discovery and use

From an MCP workspace rooted at the repository, call the existing tools:

```json
{"tool":"daemonv12_instruments_list","arguments":{"project":"examples/orbital-foundry-audition.json","query":"orbital-foundry","limit":50}}
{"tool":"daemonv12_drumkits_list","arguments":{"project":"examples/orbital-foundry-audition.json"}}
```

These are tool names and argument examples, not an additional API. Instrument discovery returns descriptive numbered WAV paths; kit discovery returns validated names and pitch mappings. No new MCP tools or discovery registry are needed. The catalog lives outside `assets/` because native discovery treats JSON inside `assets/` as kit candidates.

For projects in `examples/`, use:

```json
{"type":"drumkit","kit":"assets/orbital-foundry/kit.json"}
{"type":"sampler","sample":"assets/orbital-foundry/10-dark-drone.wav"}
```

A drum note can be `{"start":"1:1","pitch":"mechanical-kick","velocity":0.8}`. A sampler note is `{"start":"1:1","velocity":0.6}`. Omit note duration and sampler pitch: these are native one-shots, with full tails and no pitch shifting or tempo stretching. For another project directory, copy this complete pack directory into that project's `assets/` directory.

Riser/swell length is fixed in seconds. At 120 BPM, place the four-second riser two bars before an edit and the two-second reverse one bar before it. At other tempos, calculate the start from the endpoint and use an available exact grid position; these assets do not automatically follow tempo. Endpoint tapers are 8 ms / 6 ms, with the final PCM frame at zero. The drone and air are finite eight-second gestures, not seamless loops; overlapping starts seven seconds apart give continuous beds. Avoid stacking every low sound on every beat. Alternate the pulse and kick, reserve the boom for phrase weight, and leave room around the major impact.

## Reproduction and provenance

From the repository root:

```sh
npm run fixtures:orbital-foundry
# Optional: recreate the native arrangement from its authoring script
node scripts/create-orbital-foundry-audition.ts
npm run demo:orbital-foundry
node scripts/inspect-orbital-foundry.ts > renders/orbital-foundry/spectral.json
```

`scripts/generate-orbital-foundry.ts [output-project-directory]` is isolated offline synthesis with no dependencies beyond Node built-ins. Each sound has its own explicit xorshift32 seed; stereo noise uses deterministic offset seeds. Float64 oscillators, analytic integrated pitch envelopes, cascaded one-pole noise filters, inharmonic resonators, amplitude modulation and asymmetric feed-forward reflections supply the layers. These are synthesized reflections, not recorded reverb impulses. High-pass filtering controls DC/infrasonics, per-file peak scaling leaves headroom, endpoint fades prevent discontinuities, and explicit integer rounding writes PCM16. There is no random dither, timestamp, runtime randomness or FFmpeg synthesis dependency.

Repeated generation in the same Node/environment produces byte-identical WAVs, kit and catalog. Floating-point transcendental differences across Node/CPU implementations can affect final PCM least-significant bits; cross-environment byte identity is not promised. The catalog records source hashes, and DaemonV12's render manifest independently hashes every used source and artifact. Source synthesis is independent of the project seed; the catalog's per-sound seeds are authoritative.

## Audition

[Systems Under Load](../../orbital-foundry-audition.json) uses only these twelve sounds: 15 bars, 4/4, 120 BPM, 30 seconds, 298 triggers and twelve separate stems. It is a pack demonstration, with no project-specific narrative logic in the sound assets.

- 0–2 s: drone and air establish the orbital space.
- 2–6 s: pressure boom, sub pulse and kick establish propulsion.
- 6–12 s: steel accents, ticks, then snare/kick interplay build a mechanical rhythm.
- 12–16 s: four-second riser; reverse joins at 14 s; rhythm makes room before the edit.
- 16 s: cinematic impact lands exactly at bar 9.
- 16–28 s: energy motif and full machinery continue, with fills and a final boom at 26 s.
- 28–30 s: percussion stops; the sustained atmosphere decays to zero intentionally.

The render command creates `renders/orbital-foundry/orbital-foundry-audition.wav`, `.mp3`, `.analysis.json`, `.render.json`, a sample-only `.mid`, and `.stems/` with twelve aligned WAVs. The MIDI contains no audible sample playback and is not the audition. Renders stay ignored by Git; source WAVs belong in the repository. See [verification](../../../docs/ORBITAL_FOUNDRY_VERIFICATION.md) for measured results and limitations.
