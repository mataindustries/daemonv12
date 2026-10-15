# BANGER LAB 001 · Capability and rights audit

Audited on 2026-10-15 at `f913226e99496eca43b9da0fbcea68516bf9bbb8` (PR #23
merge, Composer v0.3.0). The engine content is identical to the v0.7.0 pin:
`git diff --name-only 02438eda48506a94d10ad2756c6aafff8c5a9469 f913226e99496eca43b9da0fbcea68516bf9bbb8 -- . ':(exclude)plugins/daemonv12-composer'`
lists **zero** paths.

Audit environment: Linux x86_64, Node **v22.22.0**, FFmpeg **6.1.1-3ubuntu5**
(Ubuntu package). FluidSynth and a SoundFont were absent. `doctor` readiness:
`sampleOnly`, `productionEffects`, `mp3` and `loudnessAnalysis` were true;
`generalMidi` was false (no FluidSynth or SoundFont) and `mcp` was false (`npm ci`
had not been run; the CLI needs no npm packages). Every render below ran in
scratch directories outside the repository; `git status` stayed clean.

Phase 1 (what the engine can do) and Phase 2 (what we are allowed to sell) are
separate questions. A sound can render byte-identically and still be
commercially unusable, and the reverse is also possible.

---

## Phase 1 · Production capability audit

### 1.1 Evidence actually produced

| Claim | Command or evidence | Result |
|---|---|---|
| This toolchain matches the recorded reference renders | Rendered `orbital-foundry-audition.json` and `glasshouse-audition.json` from an `init` workspace | Masters `c1dd6439d38b…` and `fed0082960cb…`, **byte-identical** to the hashes recorded in `docs/ORBITAL_FOUNDRY_VERIFICATION.md` and `docs/GLASSHOUSE_VERIFICATION.md` |
| A 75 s container is exact | `organizer/bl001-preflight.json` (128 BPM, 41 authored bars = 76.875 s, `render.duration.seconds: 75`) | Master **and all four stems: 3,307,500 frames**, 44,100 Hz, 2 ch, 16-bit; manifest `timeline.resultingFrames` 3,307,500 |
| Renders repeat | Two fresh output directories, same flags | WAV, MIDI, every stem, `.analysis.json`, `.render.json` and (in this environment) the MP3 are identical |
| The export format changes only the manifest | The same project rendered with `--format wav` and with `--format wav,mp3` | WAV, stems and `.analysis.json` identical; `.render.json` differs by its `mp3` object, so repeat renders must use the same flags |
| Audio does not depend on the project filename | Same project bytes under another name | Master, stems and analysis identical; only the manifest's `project.file` and artifact names differ |
| The container hard-cuts ringing audio | Probe drone still sounding at 75 s | Last frame non-zero; final 10 ms peak **−23.8 dBFS**, final 50 ms RMS −32.9 dBFS. No fade is applied. |
| MP3 is gapless here | `ffmpeg` decode of the engine's 192 kbps MP3 | Exactly 3,307,500 frames. MP3 still stays outside the determinism contract. |
| Loudness-matched copies are clean and repeatable | `ffmpeg … -map_metadata -1 -fflags +bitexact -flags:a +bitexact -af volume=…dB -c:a pcm_s16le` twice | Identical bytes, plain 44-byte header with no metadata, 3,307,500 frames, measured loudness within 0.01 LU of target |
| Exact 15 s excerpts | `atrim=start_sample=S:end_sample=S+661500` plus 10 ms `afade` in/out | Exactly 661,500 frames |
| Cue frames resolve through engine code | `compileProjectFile` + `parsePosition` + `ticksToFrames` (command in `BRIEF.md`) | Bar 9 at 128 BPM resolves to frame 661,500 (15.000 s, video frame 900); bar 17 to frame 1,323,000 (30.000 s) |
| Cost of a full render | 4-track 75 s probe, `--stems --format wav` | About 37 s wall time here. More tracks cost more. |
| Section helper works | `review-sections.mjs` on the probe master | Runs; JSON output |
| Palette compliance is checkable from the manifest | `samples.assets[]` file/SHA-256 against `approved-palette.json` | Pass on the probe; also `gmRenderer`, `soundfont` null and `midi.notes` 0 |

### 1.2 Inventory (engine 0.7.0, project `formatVersion: 1`)

**Instruments.** `sampler` (one WAV), `drumkit` (a kit JSON mapping names and
MIDI numbers to WAVs) and `gm` (128 General MIDI programs through FluidSynth and
a SoundFont; excluded from LAB 001, see Phase 2). There are 1–15 tracks in total.

**Approved samples: 22 WAVs** (`approved-palette.json` has hashes, frames and roles).

| Role | Orbital Foundry (industrial, cinematic) | GLASSHOUSE (tuned C#, electronic/bass) |
|---|---|---|
| Kick / low hits | `mechanical-kick` 0.42 s (~68 Hz body), `sub-pulse` 0.30 s (49 Hz), `low-boom` 2.4 s | `bass-punch-cs` 0.32 s (C#2 attack, 277→69 Hz drop) |
| Sub / bass | (`low-boom` as weight) | `sub-cs` 0.857 s (pure C#2 sine), phase-locked with `bass-punch-cs`; `glass-crush` 0.42 s (C#3 bass-call) |
| Snare / clap | `industrial-snare` 0.38 s | `chrome-clap` 0.36 s (stereo) |
| Hats / ticks | `machine-tick` 0.085 s | `pixel-hat` 0.055 s |
| Metal / accents | `metallic-strike` 1.65 s, `alarm-energy-pulse` 0.8 s (D4/A-flat4) | `glass-hit` 1.0 s (C#5 pluck/bell, the hook-friendly identity) |
| Voice | none | `ghost-vox` 0.95 s ("oh-ah" vowel, C#4), `vox-chip` 0.085 s |
| Transitions | `tension-riser` 4 s, `reverse-swell` 2 s, `cinematic-impact` 3.6 s | `glass-reverse` 0.857 s, `prism-impact` 1.8 s (C# minor chord drop) |
| Beds | `dark-drone` 8 s (110–900 Hz), `air-texture` 8 s | none |

**Performance controls** (sampler and drum-kit notes): `velocity` (0–1];
`playbackRate` 0.25–4, where pitch and length change together;
`glide {to, duration}`, linear in rate; `offsetSeconds` (source read position);
`endSeconds` (exclusive source end); `gate` (musical release time);
`envelope {attackSeconds, releaseSeconds}` (0–10 s, output time; defaults 1 ms
and 5 ms once any articulation field is present); `chokeGroup` (track-local).
Several notes at the same `start` make a chord or a layer.

**Arrangement model.** One tempo (20–300 BPM, quantized to integer µs per
quarter) and one meter. Patterns hold notes at pattern-relative positions; clips
place patterns at integer bars. The 960-PPQ grid supports binary divisions to
1/256, triplets and quintuplets; swing is written as offsets such as `+1/6`.
There is no global swing or humanize field.

**Mix and automation.** Track `mix.gainDb` (−60…+12) and `mix.pan` (−1…+1,
linear balance, not a panner). `automation.gainDb` and `automation.pan` take
1–1024 absolute points per lane, `step` or `linear` (linear in dB), with musical
(project-absolute) or seconds positions. No other lanes exist.

**Effects** (up to 8 per track and 8 on the master, in array order):
`highpass`/`lowpass` (two-pole, 20–20000 Hz), `delay` (one tap, 1–2000 ms, wet
≤ 0.5, no feedback), `compressor` (RMS, hard knee, explicit makeup), `reverb`
(Schroeder; `roomSize`, `decaySeconds` 0.1–10, `wet`), `saturation` (tanh, drive
0–24 dB, mix). Master also has `gainDb` and voice-over `ducking` (not useful
here). There is no limiter, normalization, EQ band, bus or sidechain.

**Render and timing.** `render.duration` (`seconds`, `bars` or `musical`) fixes
the final container; `render.tail` is `auto`, `none` or `{seconds}`. Any of
`render`, `master`, `mix`, `effects` or `automation` selects the production
route: stems equal the master's frame count, include track processing and
exclude master processing. The limits are 600 s per render, 1,000,000,000
interpolation taps per project and 128 MiB per performed voice, checked by
`validate` before rendering.

**Outputs.** `.wav` (PCM16, 44-byte header, no metadata), `.mid` (GM notes only,
so conductor-only here), `.render.json` (hashes of the project, every asset and
every output, plus the trigger frames, articulation, clipping per stage and
tool versions), `.analysis.json` (master and stems), optional `.mp3`
(libmp3lame 192 kbps) and `<name>.stems/`.

**Analysis.** `analyze` and `.analysis.json` report frames, peak, RMS,
full-scale count, clipping flag, integrated LUFS, LRA and true peak (FFmpeg
`loudnorm` input measurements). The Composer helper `review-sections.mjs` adds
coarse per-section band energy, an activity proxy and stereo evidence.

**MCP.** Nine stdio tools exist but are optional. LAB 001 uses the CLI, which
needs no `npm ci` for sample/production rendering.

### 1.3 Exact 75-second render with aligned stems

1. In the project: `"render": {"duration": {"seconds": 75}, "tail": "auto"}`, or
   `"none"`, or `{"seconds": x}`. `secondsToFrames(75)` = 75,000,000 µs ×
   44,100 / 10⁶ = **3,307,500** frames.
2. `node bin/daemonv12.js validate <project.json> --json` returns `ok: true`
   (asset-aware: slices, offsets and budget are checked).
3. `node bin/daemonv12.js render <project.json> --out-dir <fresh dir> --stems --format wav,mp3 --json`
4. Confirm `wav.frames`, `timeline.resultingFrames` and every
   `analysis.tracks[].analysis.frames` equal 3,307,500
   (`tools/check-delivery.sh` does this).
5. Tail semantics inside a fixed container: `auto` keeps natural tails and crops
   at 75 s; `none` cuts at the authored end, or at 75 s if that comes first, then
   pads with silence; `{seconds: x}` allows at most x s after the authored end.
   **Every choice is a hard edge at the boundary.** Make sure nothing is
   sounding there.

### 1.4 Genuine production limitations

None of these blocks a memorable 75-second dark electronic instrumental, and none
justifies new engine work before LAB 001.

| Limitation (verified) | Musical consequence | v0.7 way to handle it |
|---|---|---|
| **Small, curated palette** (22 sounds, one synthetic voice, two kick sources, no sustained tonal pad or lead; GM excluded for rights) | Harmonic beds and sustained leads are thin; entries may share a recognizable "house sound" | Chords from same-start repitched notes; `dark-drone`/`air-texture` beds; `prism-impact` slowed for swells; transformation through rate, slice and envelope rather than more layers |
| Pitch and length are coupled; no time-stretch, loop points or reverse playback | Long low notes are capped by source length: `sub-cs` lasts 0.857 s, 1.71 s an octave down | Overlapping retriggers with attack/release ramps and choke releases; `low-boom` (2.4 s) for long weight; `glass-reverse`/`reverse-swell` are pre-reversed assets |
| Automation is limited to track gain and pan; no master, filter, rate or effect automation | No master fade or true filter sweep | Fade each track's gain; stepped filters on parallel tracks with gain crossfades (approximations; they use track slots) |
| No sidechain compressor | Pumping must be authored | Gain points per beat; ≤ 1024 points per lane covers 75 s even at 174 BPM with three points per beat (651) |
| Delay is one tap, no feedback, same on both channels | No dub-style feedback throws | Write echoes as repeated notes with falling velocity; answers on a second track |
| Filters are two-pole high/low-pass only | No surgical EQ | Fix masking through register, overlap, gates and arrangement first |
| No limiter or loudness maximizer | Masters land quieter than commercial references (the repo's examples measure −15.7 to −17.7 LUFS) | Gain staging; matched blind listening removes loudness bias. Release loudness is a post-lab mastering decision, not a LAB 001 requirement. |
| One tempo and meter; 15 tracks | No tempo ramps; track slots must be planned | Pattern design; combine compatible roles on a kit track |
| Interpolation budget | Dense pitched layers across 75 s can exceed it | Rate 1 for workhorse sounds; gates and `endSeconds` reduce counted frames |
| Hard container boundary | Click at 75 s if anything sounds | Compose the ending; envelopes; per-track gain fade |
| No native cue/marker export | The video handoff needs a sidecar | Engine-API resolution command (verified); manifest trigger frames are authoritative onsets |

---

## Phase 2 · Commercial rights audit

Not legal advice. This records evidence; the owner (`mataindustries`) decides,
and counsel should review before any exclusive licensing deal.

### 2.1 Per-source findings

| Source | Provenance evidence | License | Commercial-use evidence | Technically reproducible? | LAB 001 status |
|---|---|---|---|---|---|
| **Orbital Foundry** (12 WAVs + kit), `examples/assets/orbital-foundry/` | Generated by `scripts/generate-orbital-foundry.ts` | **CC0-1.0** (`LICENSE`, SHA-256 `4be9f201…`) | LICENSE: "may be copied, modified, distributed and performed, including for commercial purposes, without permission or attribution" | **Yes**: regenerated byte-identical, all 12 WAVs, kit and catalog | **APPROVED** |
| **GLASSHOUSE** (10 WAVs + kit), `examples/assets/glasshouse/` | Generated by `scripts/generate-glasshouse.ts` | **CC0-1.0** (`LICENSE`) | Same explicit commercial wording | **Yes**: regenerated byte-identical, all 10 WAVs, kit and catalog | **APPROVED** |
| **FluidR3 GM SoundFont** (all 128 `gm` programs) | Not in the repository. `scripts/bootstrap-audio-tools.sh` downloads Debian `fluid-soundfont-gm_3.1-5.3_all.deb` (pinned SHA-256 `6f531493…`, SoundFont SHA-256 `74594e8f…`). Debian `debian/copyright` (from `fluid-soundfont_3.1-5.3.debian.tar.xz`, SHA-256 `1ffdfe84…`, fetched for this audit): "Fluid was constructed **in part from samples found in the public domain** that I edited/cleaned/remixed/programmed and largely from recordings of my own and in conjunction with" 13 named people. | MIT ("I hereby release Fluid under the MIT license") | The public-domain sample sources are not identified, so no per-sample chain of title exists. MIT is a software license; how its notice condition applies to rendered audio is unsettled. | Partly: the documented reference renders used FluidSynth 2.3.4, the bootstrap pins 2.3.7, and byte equality between them is not established. Not installed in the audit environment. | **EXCLUDED** until the owner or counsel clears it |
| Pulse kit (`examples/assets/pulse-kit/`) | Generated by `scripts/generate-sample-demo.ts` | CC0-1.0 (README) | CC0 wording | **Yes**: regenerated into scratch byte-identical (4 WAVs and kit) | Rights OK; **excluded by design** (development fixture) |
| `examples/assets/v05/synthetic-vo.wav` | Generated by `scripts/generate-v05-fixtures.ts` | CC0-1.0 (README) | CC0 wording | **Yes**: regenerated into scratch byte-identical | Rights OK; **excluded by design** (ducking reference, not music) |
| Earlier DaemonV12 songs and demos (GLASS//FIRE, GHOST//SHIFT, ONE SOUND, Shoot the Moon, auditions) | Compositions, not sound sources; Shoot the Moon uses GM | Composition rights not stated | n/a | n/a | **Excluded** as source material (original-work rule) |
| User-supplied or downloaded WAVs, bounces of contestants' own renders | None verified | Unknown | None | n/a | **Excluded** for LAB 001; the palette is frozen at launch |
| FFmpeg 6.1.1, FluidSynth (tools) | Distribution packages | GPL-2.0-or-later (per `docs/SHARING.md`) | Tool licenses govern redistributing the binaries, which no deliverable does; they are not sound sources | n/a | Tool use only |

### 2.2 Evidence for the two approved packs

1. **Explicit terms.** Both LICENSE files dedicate the generated WAVs to CC0 1.0,
   explicitly allow commercial use without attribution, and expressly do not
   license DaemonV12 code. The catalogs repeat `license: "CC0-1.0"` and
   `provenance: "All assets are generated in this repository. No third-party
   sample material is incorporated."`
2. **Closed generators.** Both generators import only `node:fs` (`mkdirSync`,
   `writeFileSync`; no reads), `node:path`, `node:url` and `node:crypto`. There
   is no network access, no input file and no embedded audio data (no
   base64-like runs; longest source lines are 419 and 271 characters).
3. **Independent regeneration.** Running both generators into empty scratch
   directories (Node v22.22.0) reproduced **every WAV, both kits and both
   catalogs byte-for-byte**. The shipped audio is therefore a pure function of
   code in this repository with no external material.
4. **Hashes.** All 22 catalog SHA-256 values match the shipped files.
   `daemonv12 init` copies are identical to `examples/assets/`.
5. **Chain of custody.** The packs and their LICENSE files arrived in
   `2032ef9` (PR #6) and `2e233a2` (PR #11), committed by the repository owner's
   account.

**Residual item (pre-launch checkbox, not a blocker):** the CC0 text says "the
contributors … waive". The owner should record a one-line attestation in the
run archive (wording in `prompts/C-organizer-judging.md` §0) that they authored or
commissioned these packs and that the CC0 dedication is theirs.

### 2.3 Commercial readiness beyond the samples

- **The composition itself.** Each entry is largely AI-generated, with human
  selection and direction. Whether, and how far, such a work is protected by
  copyright varies by jurisdiction and is unsettled. That affects exclusivity
  in licensing, not the right to use the CC0 sounds. Record every human creative
  decision (brief, selections, revision directions) in the run archive, and get
  counsel review before selling exclusive rights.
- **Resemblance.** Judges flag any hook that strongly resembles an existing
  song (score-sheet field). A flagged entry is not released until the owner
  reviews it.
- **Engine code license** is still an open owner decision (`docs/SHARING.md`).
  It does not restrict the owner's use of their own renders. It does block third
  parties from reusing the engine, which LAB 001 does not need.
- **No attribution is required** for the CC0 packs. Crediting "Sounds:
  DaemonV12 Orbital Foundry / GLASSHOUSE (CC0)" is optional.

### 2.4 Intake rule for future labs (not used in LAB 001)

An additional asset may enter a future palette only with: the creator and
source; the exact license text, with commercial use explicit (CC0 or a written
grant); evidence of the chain of title for every embedded recording; a SHA-256
of the original file; any format conversion to PCM16 44.1 kHz recorded as a
reproducible command; and owner approval **before** launch. Palettes never
change mid-run.
