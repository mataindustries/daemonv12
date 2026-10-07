# V0.2 sample instruments

Engine `0.2.0` extends `formatVersion: 1`. All V0 GM authoring, golden MIDI bytes,
FluidSynth settings, and V0.1 GM stem behavior remain supported. This document is
normative for the added sample behavior; V0_SPEC remains the GM baseline.

## Authoring

Keep the existing track → patterns → notes and clips structure. Add either:

```json
{"type":"sampler","sample":"assets/pulse-kit/impact.wav"}
```

or:

```json
{"type":"drumkit","kit":"assets/pulse-kit/kit.json"}
```

These instrument objects are closed. `sampler` notes contain required `start` and
optional `velocity`. `drumkit` notes additionally require `pitch`: a mapped name,
MIDI integer, or scientific pitch name. Both use the existing velocity range
`0 < v <= 1`, default `0.8`. Sample notes reject `duration`; sampler notes also reject
`pitch`. There is no pitch shifting, chord array, looping, choke group, note-off,
or implicit tail truncation. Multiple notes at the same tick/pitch are legal.

For example, a drum track's one-bar pattern can contain:

```json
[
  {"start":"1:1","pitch":"kick","velocity":0.9},
  {"start":"1:2","pitch":"snare"},
  {"start":"1:3","pitch":36,"velocity":0.85},
  {"start":"1:4","pitch":"D2"},
  {"start":"1:1+1/8","pitch":"hat","velocity":0.5}
]
```

Place an impact at bar 8 by putting `{"start":"1:1"}` in a sampler pattern and
placing its clip with `{"bar":8,"pattern":"accent"}`. Positions, subdivisions,
clip references, and pattern/project bounds use the unchanged 960-PPQ validator.
The onset must be inside the pattern; a WAV tail may extend beyond its end and
beyond the project end. The existing 15-track maximum includes sampled tracks.

A kit file is a closed object with `formatVersion: 1` and `samples` (1–128 entries):

```json
{
  "formatVersion":1,
  "samples":[
    {"name":"kick","pitch":36,"file":"kick.wav"},
    {"name":"snare","pitch":38,"file":"snare.wav"},
    {"name":"hat","pitch":42,"file":"hat.wav"}
  ]
}
```

Each entry is closed and requires `name`, `pitch`, and `file`. Names follow the
existing kebab-case ID grammar (maximum 32 characters); names and normalized
pitches must each be unique. Entry pitches use the existing 0–127 pitch grammar.
Files are relative to the kit JSON's directory. Copy the whole kit directory
into another project's `assets/` directory to reuse it; individual hits never
repeat file paths. Kits can be shared by multiple tracks and project files.

## Assets and validation

Project instrument references must start with `assets/`, relative to the project
JSON's directory, independent of the process working directory. Path components
start with an ASCII letter, digit, underscore or hyphen; subsequent characters
may also include dots. Absolute paths, dot segments, backslashes, empty segments,
URL/percent escapes and traversal are rejected. Kit file references use the same
component grammar but are relative to the kit. Resolved real paths must remain
under the project's assets directory; symlink escapes, including an escaping
asset-root symlink, are rejected. Output directories under assets (including
symlink aliases) are refused before cleanup or writes, protecting source files.

Initial supported format: **RIFF/WAVE PCM format tag 1, signed 16-bit little-endian,
44,100 Hz, mono or stereo, at least one complete frame**. Mono copies to both
output channels. Other rates, float, compressed or extensible WAV, malformed
chunks and inconsistent frame layouts fail with `UNSUPPORTED_WAV`. No resampling
or format conversion is hidden in the renderer.

`validate`, `midi`, and `render` all load kit definitions and validate all referenced
WAVs, including unused mappings. Files are read once per compilation and the same
bytes supply playback and provenance. Invalid assets are project errors (exit 1):
`INVALID_ASSET_PATH`, `ASSET_NOT_FOUND`, `ASSET_READ_FAILED`, `INVALID_DRUMKIT`,
`UNKNOWN_DRUM_HIT`, `UNSUPPORTED_WAV`. Diagnostics identify the referencing
instrument or note and the asset path. `validate` writes nothing.

The file API, `compileProjectFile`, includes asset IO checks. The pure
`compileProjectText(text, kits?)` API checks project semantics only; callers must
provide normalized kit entries to resolve named/mapped hits. It does not certify
WAV existence or format.

## Timing and PCM

Tempo retains the MIDI convention `usPerQuarter = round(60000000 / bpm)`.
For each absolute trigger tick, independently:

```
numerator = BigInt(tick) * BigInt(usPerQuarter) * 44100n
denominator = 960n * 1000000n
frame = (numerator + denominator / 2n) / denominator
```

Integer division rounds to the nearest frame, with ties toward the later frame.
There is no cumulative timing accumulator. The project minimum length uses ceiling
division instead. All sample stems begin at frame zero and run through at least
that minimum length, or through the final full sample tail if longer. Empty
sample tracks produce a silent full-timeline WAV. Natural GM tails remain unchanged.

Each voice scales each signed PCM value by velocity using `Math.round(sample * v)`
(ties toward positive infinity). Integer voice values sum without intermediate
clipping. The track saturates once to `[-32768,32767]`. The master sums those exact
track PCM outputs with the full-score GM render and saturates once again. Clipped
sample counts are recorded per sampled track and master. No normalization, gain
control, pan, dither, effects or mastering is added. Keeping input levels moderate
avoids clipping. The demo has no clipped values.

The narrow JS PCM layer avoids FFmpeg, new runtime dependencies, floating resampling,
and filtergraph conventions. A fixed 44-byte stereo PCM header contains no metadata
or timestamps. Integer sums make audio independent of trigger enumeration order.
Sample/mixed rendering has a **600-second maximum including tails**, reported as
`RENDERER_FAILED` before mixing oversized timelines. It uses in-memory PCM and is
intended for short cues, not long-form multitrack audio. GM-only rendering is not
subject to this new limit. Large source WAVs still require memory during validation.

## Outputs and compatibility

`render` produces a combined master, MIDI and manifest. `render --stems` additionally
exports one WAV per track, including independent sample tracks. Sample-only projects
need no SoundFont or FluidSynth. Mixed projects keep the existing GM full-score
render and per-GM-track render requests. GM-only projects bypass the PCM layer
entirely; their audio/MIDI path and manifest shape are unchanged (engine version
advances normally).

Place all stems at time zero to reproduce their musical placement. Sample PCM
in the master is exactly the exported sampled-track PCM. As in V0.1, independent
FluidSynth GM stems are **not guaranteed to sum bit-identically to its full-score
master**. No claim of identical GM stem summation is added. Stems need not have
equal tail lengths.

MIDI includes only GM tracks plus the conductor, keeps original project-index
channel assignment (skipping channel 9), and retains full-project EOT. A sample-only
project produces a conductor-only MIDI. `midi` emits warning `SAMPLES_OMITTED` for
sampled projects. Summary `notes` counts GM notes plus sample triggers; manifest
`midi.notes` counts only encoded GM notes. Existing summary keys are unchanged.

Sample-aware provenance adds:

- PCM renderer algorithm/settings, GM renderer and SoundFont identities (null when
  absent), and the hash/size/frame count of the GM audio mixed into the master.
- Every kit JSON and WAV path relative to the project, byte size and SHA-256; WAV
  format/frame properties; all kit mappings are covered, even unused entries.
- Per-track instrument references and resolved trigger tick, frame, velocity and
  sample path, plus clipping counts.
- Accurate final master and optional stem format, frame count, duration, size and
  hash. Sample stems describe sample sources; GM stems keep V0.1 MIDI provenance.

No absolute source paths, timestamps or hostnames appear in manifests. Repeat runs
with unchanged inputs, engine, FluidSynth build and SoundFont are byte-identical.
The existing engine-owned stem directory and all-or-nothing cleanup rules apply to
both instrument kinds. Manifest is written last; failures clear partial/stale
outputs. This remains completion cleanup, not crash-atomic multi-file publication.

## Demo and verification

```
npm run fixtures:samples  # regenerate original fixtures and project
npm run demo:samples     # real master + all six stems
npm run check
```

`examples/sample-demo.json` has eight bars at 96 BPM in D minor. It adds 16 kick hits,
16 snares, 64 eighth-note hats and a bar-eight impact to the original 29 bass and
60 piano notes: **186 events, 97 sampled triggers, six tracks, 20 seconds of music**.
The original demo file is unchanged. Fixture generation uses a fixed xorshift noise
sequence and short mathematical waveforms; no recordings, downloaded libraries,
or third-party sample rights are involved. See the fixture README for usage rights.

Tests cover validation and containment, missing/malformed assets, kit mappings,
overlap, velocity, precise frames and tails, saturation, isolation, mixing,
determinism, hash changes, original-channel MIDI export, resource errors, cleanup,
CLI behavior, fixture reproducibility and real FluidSynth audio. The original GM
golden MIDI and real-render regression tests remain in the suite.

Pitch-shifted melodic sampling, chokes, resampling, streaming, effects and mixer
controls are deferred. The roadmap's broad pitch-mapped sampler idea is narrowed
to mapped drum-kit one-shots for this first sample release.
