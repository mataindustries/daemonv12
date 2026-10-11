# V0.6 sample performance

Engine `0.6.0` adds three optional fields to sampler and drum-kit notes in project
`formatVersion: 1`. A note can now **perform** its sample: play it faster or slower,
glide between speeds and start from inside the WAV. One source becomes pitched
phrases, chops, risers, dives and tape stops without pre-rendering derived assets.

**Playback rate changes pitch and duration together.** It is a speed control, like
tape or a turntable. It is not time-stretching: there is no way to change pitch
without changing length, or length without changing pitch.

Projects without the new fields render byte-identical audio to 0.5.0 (see
[compatibility](#backward-compatibility)). The V0.2 sample contract
([V0_2_SAMPLES.md](V0_2_SAMPLES.md)) and V0.5 timeline contract
([V0_5_TIMELINE_DYNAMICS.md](V0_5_TIMELINE_DYNAMICS.md)) remain normative for
everything else; this document is normative for the additions.

## Authoring

```json
{"start": "1:1", "velocity": 0.8, "playbackRate": 1.498307, "offsetSeconds": 0.239932,
 "glide": {"to": 0.25, "duration": "1/2"}}
```

| Field | Value | Default | Meaning |
|---|---|---|---|
| `playbackRate` | number, 0.25 through 4 | `1` | Speed multiplier at the note onset. |
| `offsetSeconds` | number, 0 through 600, at most six decimal places | `0` | Position in the source WAV where the voice starts reading. |
| `glide` | closed object `{"to": rate, "duration": "N/D"}` | none | The rate moves from `playbackRate` to `to` over `duration`, then holds `to`. |

- The fields are allowed on **sampler and drum-kit notes only**. `start`, `velocity`
  and drum-kit `pitch` keep their meanings. Sample notes still have no `duration`.
- `glide.to` uses the same 0.25–4 range and must differ from the starting rate
  (`playbackRate`, or 1). Remove `glide` to hold one rate.
- `glide.duration` uses the note-duration grammar: a positive whole-note fraction
  on the 960-PPQ grid (`"1/8"`, `"1/12"`, `"3/8"`, `"2/1"`). A glide starts at the
  note onset. It may outlast its pattern and its voice.
- Explicit defaults are accepted: `playbackRate: 1` and `offsetSeconds: 0` are an
  unperformed note, with identical audio and identical trigger provenance.
- Objects stay closed and validation stays collect-all. Each problem is a
  structured diagnostic at the field's path:

| Problem | Code | Notes |
|---|---|---|
| `playbackRate` or `glide.to` ≤ 0, below 0.25 or above 4 | `OUT_OF_RANGE` | Hint explains the multiplier. Integers that look like semitones get the conversion: `7` → "use 1.498307 (2^(7/12))". |
| Non-number, `NaN`, ±`Infinity` | `WRONG_TYPE` | `expected: "finite number"`. |
| `offsetSeconds` negative or above 600 | `OUT_OF_RANGE` | |
| `offsetSeconds` with more than six decimal places | `INVALID_DURATION` | Microsecond precision; never silently rounded. |
| Offset resolving at or past the end of the WAV the note plays | `OUT_OF_RANGE` | `expected` names the WAV, its frames and seconds and the resolved frame; hint gives the latest valid offset, e.g. `Use at most 0.949988 seconds.` |
| `glide` not an object; missing `to`/`duration`; another key | `WRONG_TYPE` / `MISSING_FIELD` / `UNKNOWN_FIELD` | |
| `glide.duration` malformed or off the tick grid | `INVALID_DURATION` / `OFF_GRID` | Same messages and hints as note durations. |
| `glide.to` equal to the starting rate | `OUT_OF_RANGE` | `Remove glide to hold one playbackRate.` |
| Any of the fields on a GM note | `UNKNOWN_FIELD` | `playbackRate, offsetSeconds and glide apply only to sampler and drum-kit notes.` |
| `rate`, `speed`, `pitchRatio`, `offset`, `startOffset`, `glideTo`, `bend`, `portamento` … | `UNKNOWN_FIELD` | Hint names the real field; `semitones`/`transpose`/`pitchShift` with a number give the exact rate. |

Offset bounds need the WAV's length, so they are checked by the asset-aware APIs
(`validate`, `midi`, `render`, `compileProjectFile`, `compileProjectTextWithAssets`
and the MCP project tools). As in V0.2, the pure `compileProjectText` checks project
semantics without reading assets.

## Playback rate

A voice at rate `r` reads `r` source frames per output frame. Frequencies are
multiplied by `r` and the voice lasts `1/r` as long:

| Rate | Pitch | Length | Rate | Pitch | Length |
|---|---|---|---|---|---|
| 4 | +24 semitones | ¼ | 0.5 | −12 semitones | 2× |
| 2 | +12 semitones | ½ | 0.25 | −24 semitones | 4× |
| 1.498307 | +7 semitones | 0.667× | 0.749154 | −5 semitones | 1.335× |

For `n` equal-tempered semitones use `2^(n/12)` (six decimals are plenty). Formants
move with the pitch, as on tape; there is no formant or transient preservation.
The 0.25–4 range (two octaves either way) bounds the interpolation filter's
length and keeps quarter-speed voices of typical one-shots well inside the
600-second render limit.

## Glide

Glides are **linear in rate**, measured in output frames. With starting rate `r0`,
destination `r1` and glide length `G` frames:

```
rate(n) = r0 + (r1 - r0) * n / G      for n < G
rate(n) = r1                          for n >= G

position(n) = offset + n * (r0 + (r1 - r0) * n / (2G))          for n <= G
position(n) = offset + G * (r0 + r1) / 2 + (n - G) * r1          for n > G
```

`position` is the exact integral of `rate`, evaluated independently for every output
frame from these closed forms. Nothing is accumulated frame to frame, so no
rounding drifts. The read position is continuous and strictly increasing, and the
rate is continuous at the start and end of the glide, so the glide adds no
discontinuity. After `G` the destination rate holds until the voice ends. If the
source runs out first, the voice simply ends mid-glide.

`G` is `frame(onset tick + glide ticks) - frame(onset tick)`, using the existing
nearest-frame rounding of absolute ticks (ties later), so a glide ends exactly on
the musical grid frame it names.

Linear rate is how a tape or turntable motor speeds up and slows down, so
`{"to": 0.25}` from rate 1 is a tape stop and a rise from 0.25 is a spin-up.
Perceived pitch is logarithmic in rate: a linear-rate glide covers more semitones
per second near its lower rate. Exponential (constant semitones per second) glides
are deferred.

## Duration

A voice sounds for output frames `0 … N-1`, where `N` is the first frame whose
read position reaches the source length `F`: `position(N) >= F`. At a constant rate
`N = ceil((F - offset) / rate)`. For GLASSHOUSE `ghost-vox.wav` (41,895 frames):
rate 2 → 20,948 frames; rate 0.5 → 83,790; rate 1.25 from frame 10,584 → 25,049.
The engine solves for `N` analytically and then confirms it against the exact
position function, so the length always matches the frames actually read.

There is no fade, loop, release or note-off: a voice ends at the natural end of its
source. Performed voices extend track timelines exactly like other sample tails.
`render.duration` and `render.tail` cut them at the permitted boundary like any
other audio, and the 600-second limit includes them.

## Offset

`offsetSeconds` uses the V0.5 wall-time conversion: exact decimal microseconds,
then the nearest source frame, ties toward the later frame:
`frame = round(microseconds * 44100 / 1000000)`. For example `0.005` is frame 221
(220.5 rounds up), `0.000012` is frame 1 and `0.000011` is frame 0. The source must
contain that frame: an offset resolving to frame `F` or later is rejected rather
than producing a silent event. With rate 1 and no glide the voice is a copy of the
source from that frame: there is no resampling, and the WAV file is never changed.
Pick offsets at zero crossings when a chop should start without a step; the engine
adds no fades.

## Interpolation

Rate 1 without a glide takes the **exact path**: source frames are copied, as in
every earlier version. Any other rate or any glide uses band-limited interpolation:

- **Kernel:** Kaiser-windowed sinc, β = 8.5, 32 zero crossings per side, tabulated at
  512 steps per zero crossing with linear interpolation between table entries.
- **Cutoff:** `0.92 × min(1, 1/rate)` of the source Nyquist frequency, using the
  instantaneous rate during glides. When pitching up the cutoff falls so content
  that would land above the output Nyquist is removed instead of aliasing; when
  pitching down it suppresses images. The kernel spans ±35 source frames at rate
  ≤ 1 and ±139 at rate 4.
- **Normalization:** weights are divided by their sum, giving exact unity gain at
  DC for every fractional position. Outside the source the signal is silence.
- **Quantization:** unchanged. Each voice sample becomes `round(value × velocity)`,
  then voices sum without intermediate clipping and the track saturates once.

Measured on 16-bit test tones (the 16-bit source quantization limits residuals to
roughly −95 dB):

| Measurement | Result |
|---|---|
| Passband | 0.0 dB through 18 kHz of source content at rate ≤ 1; −3.3 dB at 20 kHz output |
| Aliasing (tones that would exceed output Nyquist at rates 1.1–4) | −90.5 dB or lower |
| Imaging (near-Nyquist tones at rates 0.25–0.7) | −91.7 dB or lower |
| Residual against an ideal continuous-phase sine, including across glide boundaries | under 1 LSB at amplitude 12,000 |
| Read position recovered from a ramp source | within 0.001 frames (0.0002 measured) |
| Peak of a −0.2 dBFS sine at any rate or glide | no overshoot beyond 0.02%; no clipping |
| Cost | about 40–90 ms of CPU per mono output second (rate 0.5–4) |

The table and every per-frame computation use only IEEE-754 addition, subtraction,
multiplication and division (sine from a fixed series and Bessel I0 from a fixed
series in z²). No platform math library enters a performed voice, so its bytes are
identical on every platform and Node version. Golden SHA-256 values in the test
suite pin the voice and mix bytes.

## Sampler and drum kits

Sampler notes and drum-kit notes accept the same fields. Kit hits resolve exactly
as before (name, MIDI number or pitch name), and the performance applies to the WAV
that hit maps to. Offsets are validated against that WAV. Velocity keeps its
meaning. Every performed note is an independent voice: overlapping copies of one
sample at different rates sum like any other voices.

## Rendering paths

A performed voice is ordinary track input to the existing mixers. There is no
second render path:

- Sample-only projects without production fields keep the Node-only integer route.
- Production projects keep their order: voices, track gain/pan and automation,
  ordered effects, permitted tails, track quantization, master, ducking, exact
  output length, stems, analysis and MP3.
- Stems include their performed voices; the CLI and MCP gain no flags.

## Provenance

Each trigger of a performed note records a `playback` object. It is absent for
unperformed notes, so their records are unchanged:

```json
{"file": "assets/glasshouse/04-ghost-vox.wav", "tick": 23040, "frame": 453600, "velocity": 0.95,
 "playback": {"rate": 1, "offset": {"seconds": 0.300136, "frames": 13236},
              "glide": {"to": 0.25, "duration": "1/2", "frames": 37800}, "voiceFrames": 57936}}
```

`rate` is the starting rate. `offset` appears when one was requested and keeps the
requested seconds next to the resolved frame. `glide` keeps the destination, the
canonical duration and the resolved frames. `voiceFrames` is the natural voice
length before any render boundary. When any trigger performs, `samples.playback`
names the algorithm (`daemonv12-playback` version 1) and its settings. The PCM
renderer's `resampling: false` still means that source WAVs are never converted
from their stored format. The MCP compact provenance keeps `samples.playback` and
omits triggers; `render_info` with `detail: "full"` includes them.

## MCP

There are still **nine tools**. The note schema used by `project_patch`
(`pattern_put`, `notes_append`, `track_add`) publishes `playbackRate` (0.25–4),
`offsetSeconds` (0–600) and the closed `glide` object with descriptions, and
`project_read` returns them as authored. Schema violations return
`INVALID_ARGUMENT` with the edit path. Engine checks, such as offsets past a WAV's
end, glides that do not move and fields on GM notes, return the diagnostics above.
Failed batches leave the project bytes unchanged. Server instructions mention the
fields.

```json
{"op": "pattern_put", "trackId": "vox", "pattern": {"id": "chop", "bars": 1, "notes": [
  {"start": "1:1", "playbackRate": 1.498307, "offsetSeconds": 0.468322},
  {"start": "1:2", "playbackRate": 0.5, "glide": {"to": 0.25, "duration": "1/4"}},
  {"start": "1:3", "offsetSeconds": 0.0997, "glide": {"to": 2, "duration": "1/8"}}
]}}
```

## Recipes

| Gesture | Note fields |
|---|---|
| Melodic chop: G#4 from `ghost-vox.wav`, two sixteenths long at 140 BPM | `"playbackRate": 1.498307, "offsetSeconds": 0.628186` |
| Octave-down drone | `"playbackRate": 0.5` |
| Vocal bend E4 → G#4 from a C#4 vowel | `"playbackRate": 1.189207, "glide": {"to": 1.498307, "duration": "1/8"}` |
| Tape stop | `"glide": {"to": 0.25, "duration": "1/2"}` |
| Spin-up riser over a bar | `"playbackRate": 0.25, "glide": {"to": 1, "duration": "1/1"}` |
| Bass dive | `"playbackRate": 0.5, "glide": {"to": 0.25, "duration": "1/4"}` |
| Heavier drum-kit clap | `"pitch": "chrome-clap", "playbackRate": 0.890899` |

To make a chop last `L` seconds at rate `r` from a source of `F` seconds, start at
`offsetSeconds = F - L × r` (snap to a nearby zero crossing).

## GHOST//SHIFT

`examples/ghost-shift.json` is a 12.000-second, seven-bar demo at 140 BPM in C#
minor. Its lead is **one source**: GLASSHOUSE `ghost-vox.wav`, a 0.95-second C#4
vowel. Four sampler tracks perform it:

- `ghost-hook`: the untouched sample, an E4→G#4 bend, then a two-bar hook at seven
  pitches (C#4–C#5). Each chop starts at an upward zero crossing chosen so the chop
  lasts its written length.
- `ghost-high`: the hook an octave higher in the drop.
- `ghost-fx`: two spin-up risers (0.25→1 over a bar and 1→2 over half a bar) and the
  closing tape stop (1→0.25).
- `ghost-bass`: the vowel one and two octaves down, diving between them.

GLASSHOUSE drums (with a pitched-down clap and rising hats) and `sub-cs` support
it. The project uses 14 playback rates, 21 source offsets, 3 upward and 6 downward
glides. V0.5 could only play the vowel at C#4 from its first frame, so each of
those would have been a separate pre-rendered WAV.

```sh
npm run demo:ghost-shift   # renders/ghost-shift/: WAV, MP3, six stems, analysis, manifest
npm run test:v06
```

The master is exactly 529,200 frames: −15.7 LUFS integrated, −2.1 dBTP true peak,
2.2 LU loudness range, no clipped samples. The four ghost-vox stems are the loudest
(−17.9 to −20.4 LUFS against −22.4 drums and −24.9 sub). Acceptance tests render it
twice byte for byte. They measure every hook chop within 30 cents of its written
note, and track the tape stop, riser and bass dive against the linear-rate
trajectory within 30 cents. They also author the same project through the stdio
MCP server and get identical master and stems. The verification was analytical; no
listening session is claimed.

## Backward compatibility

- **Unperformed voices take the historical code path.** Randomized property tests
  compare the mixers against verbatim copies of the 0.5.0 implementations.
  Explicit `playbackRate: 1` / `offsetSeconds: 0` render identical bytes and
  trigger records.
- **Recorded renders are unchanged.** `tests/fixtures/v05-reference-renders.json`
  pins masters and every stem rendered by 0.5.0: the Node-only sample demo, the
  Orbital Foundry audition (`c1dd6439…`), the GLASSHOUSE audition (`fed00829…`) and
  GLASS//FIRE (`22c0d1a5…`, which still validates). Tests whose bytes depend on
  FFmpeg, FluidSynth or the SoundFont skip unless those identities match.
- MIDI encoding, GM rendering, the V0.5 production order and manifests of
  unperformed projects are unchanged apart from the engine version.

## Deferred

Independent pitch/time stretching, formant preservation, granular synthesis,
reverse playback, end offsets, slicing grids, loop points, resampling to new
assets, warp markers, exponential or multi-point glides, LFOs, a modulation matrix,
real-time streaming, plugin hosting and new MCP tools.
