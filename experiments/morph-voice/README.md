# DaemonV12 — MORPH//01: The Singing Machine

One experimental offline instrument: bowed glass → a synthetic throat → a
metallic machine. All code, scores and new tests live in this directory. It has
no dependencies of its own and does not add an engine instrument, MCP tool or
sample pack. The existing engine remains 0.7.0. Nothing is published or deployed.

## Hear it

Run `node experiments/morph-voice/build.mjs` from the repository root. Outputs:

| File beneath `renders/` | Listening purpose |
|---|---|
| `demos/the-transformation.wav` | 12 s; one C#4 (277.1826 Hz), no vibrato or pitch automation. Glass, vowel and machine unfold across a fixed carrier. |
| `demos/the-performance.wav` | 12 s; a syncopated four-second hook returns three times, with articulation, dynamic accents and evolving identity. C#, E, G#, A and E#; E#4 is MIDI 65, enharmonic F4. |
| `demos/the-impossible-gesture.wav` | 8 s; “falling throat, rising mouth, swallowed gears.” A two-octave descending glide moves against an opening vowel, then repeated voice/metal folds interrupt the resonance before the throat returns. |
| `cue/render/morph-01-cue.wav` | 12 s; the hook arranged through the real 0.7 pipeline with new sub, kick, clap and clock backing. |
| `cue/render/morph-01-cue.stems/` | Five aligned stereo stems, including the MORPH part alone. |

The gesture is an authored counter-motion, followed by uneven resonant
“syllables.” Changing sample playback speed would move pitch, mouth resonances,
vibrato and articulation together. Here the pitch descends while the vowel moves
independently, and the metallic modes keep their phase through the folds. A
sufficiently elaborate sampler can approximate many results; this experiment
makes these decisions explicit and editable before rendering.

Use moderate listening levels. Compare the exposed demonstrations before the
mixed cue. Measurements are engineering evidence; human listening must decide
whether the voice, continuity and hook are compelling. No listening panel or
perceptual smoothness verdict is claimed.

## Reproduce

The reference environment is **Node v24.19.0, Linux x64**. `.nvmrc` and the private
experiment package pin that version; no `npm install` inside this directory is
needed. The synthesis itself uses only Node built-ins. The cue needs the normal
repository dependencies and configured FFmpeg (reference: 6.1.1). It uses only
sample tracks, so FluidSynth and a SoundFont are not required for this cue.
Exact Node and FFmpeg executable hashes, runtime library versions, input/source
hashes and every audio hash are written to `renders/provenance.json`.

From the repository root:

```sh
node --version
node experiments/morph-voice/build.mjs
node --test experiments/morph-voice/verify.test.mjs
node experiments/morph-voice/verify.mjs
node experiments/morph-voice/reproduce.mjs
npm run check
```

`reproduce.mjs` renders every demonstration and the cue again into ignored
`work/repeat/`, then compares every WAV byte and records the result. It never
changes reference audio to make a comparison pass. File hashes are scoped to
the recorded runtime/inputs; different platforms may change transcendental
rounding or FFmpeg measurements. Cost observations vary between runs.

For the optional spectral figure and additional analysis, install NumPy and
Matplotlib in an existing Python environment, then run:

```sh
python experiments/morph-voice/analyze.py experiments/morph-voice/renders
```

The shipped listening bundle includes these analyses already. Its
`SHA256SUMS.txt` covers the shipped files; `sha256sum -c SHA256SUMS.txt` checks
transfer integrity from the bundle root. Generated audio stays ignored in Git;
source performances and renderer remain reviewable on the experimental branch.

## Compose with it

Write a closed JSON description, or edit one of `performances/*.json`:

```json
{
  "formatVersion": 1,
  "title": "A held throat",
  "seconds": 4,
  "seed": 42,
  "controls": {"morph": 0.5, "vowel": 0.3, "vibratoDepth": 0},
  "notes": [{"at": 0, "duration": 3.4, "hz": 277.1826309768721, "velocity": 0.8}],
  "automation": {"vowel": [{"at": 0, "value": 0.1}, {"at": 3, "value": 0.9}]}
}
```

```sh
node experiments/morph-voice/render.mjs my-performance.json my-performance.wav
```

`renderPerformance(description)` is a pure ESM API in `synth.mjs`; it returns
mono `Float64Array` samples, frame count, sample rate and signal statistics.
`encodeWav` exports timestamp-free 44.1 kHz PCM16. Out-of-range audio is rejected
by the encoder, never silently normalized or limited.

| Control | Range; default | Musical effect |
|---|---|---|
| `morph` | 0–1; 0.5 | Glass at 0, voice at 0.5, machine at 1. |
| `vowel` | 0–1; 0.5 | Continuous u → o → a → e → i regions; formants stay in Hz independently of pitch. |
| `brightness` | 0–1; 0.55 | Spectral tilt and upper-partial rolloff. |
| `grit` | 0–1; 0.35 | Saturation-spectrum color and inharmonic metallic modes. |
| `vibratoRate` | 0–12 Hz; 5.2 | Continuous vibrato speed. |
| `vibratoDepth` | 0–100 cents; 9 | Pitch modulation with a short onset fade-in. Zero fixes the carrier. |
| `attack`, `release` | 0.001–3 s / 0.005–3 s; 0.08 / 0.18 | Smooth note edges. Duration is gate time; release follows it. |
| `glide` | 0–2 s; 0 | Duration of the explicit `glideFromMidi` or `glideFromHz` to the note pitch. |
| `gain` | 0–1; 0.7 | Continuous expression; note `velocity` supplies an independent scalar. |
| `pitchCents` | −2400–2400; 0 | Optional independent pitch automation, in cents. |

Each note supplies exactly one of `midi` (21–108, fractional permitted) or `hz`
(27.5–4186 Hz), plus seconds-based `at` and `duration`. Recommended musical
range: 55–1760 Hz; the extremes have sparse formants or truncated harmonics.
Per-note `controls` override global controls **and automation** for those keys.
Attack/release/glide are sampled at note onset. Other controls run continuously.
Automation is an object of control-name arrays of strictly increasing
`{at,value}` points. Between points it uses smoothstep interpolation; before the
first point the base value applies; after the last the last value holds. A 4 ms
smoother and interpolated spectral coefficients handle fast edits without
restarting oscillators. This is offline automation, not a real-time control API.

Limits: 30 seconds, 128 notes, 8 overlapping voices including release tails,
2048 points per control, fixed 44.1 kHz. Unknown fields, nonfinite numbers and
out-of-range values fail with an identified path. Output cannot escape memory
bounds through an unbounded duration or note count. Loud polyphony can still
exceed full scale; lower gain/velocity rather than relying on a limiter.

## Architecture and boundary

Read [DSP.md](DSP.md) for equations and numerical/aliasing limitations,
[RESEARCH.md](RESEARCH.md) for the inspected main/SIGNAL revisions and what
SIGNAL already did, and [reports/REPORT.md](reports/REPORT.md) for measured results
and the handoff decision.

The cue project and its `assets/` are generated under `renders/cue/`. It has six
bars of 4/4 at 120 BPM, an explicit 12-second no-tail render, 529,200 audio
frames and five stems. `visual-events.json` maps every picture frame 0–719 at
60 fps to audio, with end-exclusive picture boundary 720 / audio boundary
529,200. Beat/scene events and authored note onsets carry synchronization data;
half-picture-frame note offsets retain their exact audio onset and rounding
error instead of pretending they land on a picture boundary.

Only baked PCM enters the existing sampler. Native `instrument.type: voice`,
engine-owned synthesis scheduling, project-schema timbre automation, streaming,
MCP discovery/control and continuous legato across separate notes still need
engine-level design. The prototype is suitable for an agent to write JSON,
render, audition and import a performance today. It is not a new engine API or
a full synthesis framework.
