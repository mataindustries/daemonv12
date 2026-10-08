# V0.5 timeline and dynamics

Engine `0.5.0` adds optional fields to project `formatVersion: 1`. V0–V0.4
projects retain their MIDI bytes, source playback, natural tails and render
routes. This phase supplies timeline and dynamics primitives for narrated video
and game layers. It adds no DAW, arbitrary automation, routing graph, plugin host,
tempo map, automatic composition or automatic mastering.

## Authored timeline, natural audio, exported duration

`bars`, meter and constant tempo define the authored events and MIDI End-of-Track.
Samples play their complete WAVs; FluidSynth releases voices; delay/reverb may
extend natural audio. Optional `render.duration` fixes the final PCM container;
`render.tail` controls release time allowed after the authored end.

```json
"render": {"duration": {"seconds": 175.2}, "tail": "auto"}
```

`duration` is **the final output length including permitted tails**, not an event
length to which another tail is added. Exactly one duration tag is allowed:

| Form | Meaning |
|---|---|
| `{"bars":16}` | Sixteen bars at the project's meter and tempo |
| `{"musical":"16/1"}` | Existing whole-note fraction grammar; exact 960-PPQ ticks |
| `{"seconds":175.2}` | Wall-clock length independent of tempo |

Bars are integers 1–1000; fractions must lie on the existing tick grid. Seconds
are finite decimals through six places (microseconds), at most 600. Excess
precision is rejected, not approximated. Fixed output must contain at least one
frame and at most 600 seconds at 44,100 Hz. A duration may be shorter or longer
than the authored timeline: shorter containers crop audio; longer ones preserve
permitted tails and then pad with zeros. Authored events and MIDI stay unchanged.

| `render.tail` | Without `duration` | With `duration` |
|---|---|---|
| absent or `"auto"` | Existing natural tail length | Natural audio, cropped/padded to final duration |
| `"none"` | Hard authored-end boundary | Cut at the earlier of authored end and final duration; zero-pad if needed |
| `{"seconds":0.75}` | Authored end plus exactly 0.75 seconds | Allow at most 0.75 seconds after authored end inside the fixed container |

Explicit tail seconds must be positive with the same precision/bounds as wall
duration. A tail budget grants time; it does not stretch releases or repeat notes.
The final duration always wins. An eight-second timeline with a ten-second final
duration and a half-second tail exports ten seconds: audio stops by 8.5 seconds,
then silence. A six-second final duration exports six seconds regardless of that
tail allowance. Invalid tagged objects, unknown fields, zero duration and off-grid
fractions return engine diagnostics.

Fixed masters and production stems start at frame zero and have identical exact
lengths in PCM16 stereo at 44,100 Hz. Boundaries round to the **nearest sample frame,
ties toward the later frame**. Decimal seconds become integer microseconds before
BigInt division. Musical durations use the existing MIDI tempo
`round(60000000/bpm)` and integer ticks. Authored time plus finite tail is combined
as one rational quantity and rounded once. For example 0.005 seconds is 220.5
frames, exported as 221; 175.2 seconds is 7,726,320 frames.

Without render fields, the historical ceiling for the sample timeline minimum
and renderer-defined tails are unchanged. Presence of `render`, `master`, track
`mix`, `effects` or `automation` opts into production routing. Explicit
`render:{}` / `tail:"auto"` uses independent production tracks with natural tails;
remove all production fields to restore the original full-score GM route.
Production still requires FFmpeg for analysis and uses the existing in-memory
600-second limit. Project configuration is authoritative; no new CLI flags exist.

## Gain and pan automation

Track `automation` contains only optional `gainDb` and `pan` lanes:

```json
"automation": {
  "gainDb": [
    {"at":{"seconds":0},"value":-12,"transition":"linear"},
    {"at":{"seconds":18.42},"value":-4},
    {"at":{"seconds":23.93},"value":-10}
  ],
  "pan": [
    {"at":{"musical":"1:1"},"value":-0.4,"transition":"linear"},
    {"at":{"musical":"9:1"},"value":0.4}
  ]
}
```

`at` is strictly tagged as `{"musical":"BAR:BEAT(+N/D)"}` or `{"seconds":number}`.
Musical positions are canonical and **project-absolute**, not pattern-relative.
A point exactly at authored end (`17:1` for sixteen 4/4 bars) is permitted;
musical positions beyond it are rejected. Wall positions start at zero and use
the same precision/bounds as wall duration. They can address permitted tails and
video timestamps without beat approximation.

Each lane has one time basis, 1–1024 points, strictly increasing positions, and
distinct rounded sample frames. Duplicate, unsorted, mixed-basis, ambiguous tagged
and noncanonical positions are errors. Omit unused lanes rather than using empty
arrays. Gain and pan may use different bases. Every object remains closed.

Point values are **absolute**, replacing the static mix parameter once the first
point is reached. Before it, the static value applies; after the last, hold its
value. `transition` describes the segment **from that point to the next**.
Missing transition means `step`: hold until the next point's frame, then switch.
`linear` between points `a` and `b` uses
`a.value + (b.value-a.value)*(frame-a.frame)/(b.frame-a.frame)`.
At the next point its value applies exactly. The last point has no outgoing segment.

Gain remains −60 through +12 dB. Linear gain ramps interpolate dB before conversion
to amplitude `10^(gainDb/20)` each frame. Pan remains −1 through +1 with V0.3's
linear stereo balance: `L *= 1-max(0,pan)`, `R *= 1+min(0,pan)`; center preserves
both channels. Pan ramps interpolate that balance parameter. GM, sampler and
drum-kit tracks share this processing. Automation does not add MIDI CC events.

## Semantic voiceover ducking

```json
"master": {
  "gainDb": -1,
  "ducking": {
    "source": "assets/voiceover/locked-vo.wav",
    "amountDb": 12,
    "thresholdDb": -35,
    "attackMs": 50,
    "releaseMs": 300
  }
}
```

V0.5 supports **master music bus ducking only**. Track-specific sidechains and
routing are deferred. The reference aligns at frame zero. Its activity is analyzed;
its waveform is never added to the music. An explicitly authored sampler track
can separately mix a supported audio file; configuring ducking does not do so.

| Parameter | Range | Meaning |
|---|---|---|
| `amountDb` | 0–36 | Maximum positive gain reduction in dB |
| `thresholdDb` | −60–0 | RMS activity threshold in dBFS |
| `attackMs` | 1–2000 | Reduction-envelope attack time constant |
| `releaseMs` | 10–9000 | Reduction-envelope release time constant |

A **trailing 20 ms RMS energy window** averages channel powers, so antiphase stereo
does not cancel activity. Initially and beyond the reference end, the window
receives zeros. Energy at or above threshold marks activity. This avoids driving
ducking from individual waveform zero crossings. Activity targets `amountDb`;
silence targets zero. Reduction in dB follows
`r += (target-r)*(1-exp(-1/(timeMs*44100/1000)))`, using attack when reduction
increases and release when it decreases. One time constant reaches about 63.2%
of a change. Applied gain is `10^(-r/20)`. There is no lookahead, speech recognition,
makeup or normalization. Choose the threshold for the supplied reference level.

References use the existing project-relative `assets/` grammar and realpath
containment. Supported WAV is nonempty RIFF/WAVE signed PCM16, mono/stereo,
44,100 Hz, at most 600 seconds; no hidden resampling/conversion. VO reads additionally
reject symlinks (including an assets-root symlink), hard links, nonregular files
and oversized bytes, and use `O_NOFOLLOW`. Legacy sample acceptance stays unchanged.
Output under assets is refused. Structured diagnostics at `master.ducking.source`
include `INVALID_ASSET_PATH`, `ASSET_NOT_FOUND`, `ASSET_READ_FAILED`, `UNSUPPORTED_WAV`.
No arbitrary filesystem-read capability is exposed through MCP. As with existing
MCP containment, this is a single-operator boundary assuming no hostile external
directory mutations during an operation, not an OS sandbox.

## Ordered production effects

The same track/master `effects` arrays contain at most eight effects in array
order. Highpass, lowpass and single-tap delay retain their V0.3 semantics. There
is no second effect system or arbitrary filtergraph interface.

| Type | Required parameters | Optional parameters |
|---|---|---|
| `compressor` | `thresholdDb`: −60–0; `ratio`: 1–20; `attackMs`: 0.01–2000; `releaseMs`: 0.01–9000 | `makeupGainDb`: 0–12, default 0 |
| `reverb` | `roomSize`: 0–1; `decaySeconds`: 0.1–10; `wet`: 0–1 | None |
| `saturation` | `driveDb`: 0–24; `mix`: 0–1 | None |

Compression uses FFmpeg's downward RMS compressor, hard knee and linked stereo
using the larger channel detector. Threshold/makeup convert to amplitude inside
the adapter. Ratio 1 is neutral compression; makeup is explicit. Length is
preserved. There is no automatic makeup, limiter or multiband stage.

Reverb is a Schroeder room: four parallel feedback combs and two serial allpasses
per channel, with fixed stereo offsets. Room size scales delay lengths; feedback
decays by 60 dB per `decaySeconds` (nominal RT60). A deterministic finite tail of
`ceil(decaySeconds*44100)` frames is processed, then remaining decay is truncated.
This is a fixed horizon, not a silence detector. Like existing delay, the horizon
is present even at zero wet. Mix is `(1-wet)*dry + wet*room`; `wet=1` is room only.
Feedback resonance can raise level; clipping analysis reports it. No normalization
or impulse-response loading follows.

Saturation uses `(1-mix)*input + mix*32767*tanh((input/32768)*10^(driveDb/20))`
in signed-16 sample units. This is a smooth nonlinear transfer with harmonic
generation, not hard clipping. Mix zero is identity; drive zero at nonzero mix
still applies the soft transfer. There is **no output compensation** or automatic
normalization. Length is preserved; resulting peaks and later overload are measured.

FFmpeg-specific syntax remains in `render/ffmpeg.ts`. Contiguous FFmpeg effects
share one pass; built-in reverb/saturation run between passes in the same order.
Intermediate processing stays float64 until existing track/master quantization.
Doctor/bootstrap now check `acompressor`; the existing pinned build supplies it.

## Signal flow and production stems

1. Render independent GM tracks; place sampler/kit voices at absolute rounded
   frames and sum voices without clipping. Keep source tails within a specified
   permitted audio boundary.
2. Apply static/automated track gain and stereo balance.
3. Apply ordered track effects; cap permitted tails and quantize to PCM16.
   These track elements feed the master and production stems.
4. Sum the track PCM elements, apply master gain and ordered master effects.
5. Enforce the permitted audio boundary and final container (crop/zero-pad).
6. Apply master VO ducking, then quantize the master to PCM16.
7. Trim/zero-pad stems to the identical master frame count. They include track
   automation/effects and exclude master gain/effects/ducking.
8. Measure audio, encode optional MP3 and write provenance last.

Processing is causal and starts at zero. No automatic fade, crossfade,
normalization or dither is introduced. A clipped track remains reported even if
master ducking attenuates it. Without master processing, the production stem sum
reproduces the master subject to clipping; otherwise apply master processing to
the sum. Legacy full-score GM/stem non-equivalence remains on the legacy route.

## Provenance and existing MCP tools

V0.5 manifests add `timeline`: authored ticks/frames, duration/tail definitions,
requested fixed frames, permitted audio boundary, rounding and resulting frames.
Production tracks record canonical automation, resolved frames and ordered effects.
The master records duck settings and reference relative path, byte size, SHA-256,
format/frames, detector window, activity frames and maximum reduction. Reference
audio is never embedded. Engine/algorithm, FluidSynth, SoundFont and FFmpeg versions,
output hashes, actual durations and peak/loudness analysis remain visible.
Node's runtime version is recorded for the built-in floating-point operations.
No timestamps, hostnames or absolute source paths enter engine manifests.

There are still **nine MCP tools**. Create accepts optional render/master settings;
read exposes authored settings. `project_update`, `track_add`, `track_update`
accept the new fields. Whole-field replacement, `null` removal, revision hashes,
asset-aware validation, invalid-batch rollback and atomic publication are unchanged.

```json
{
  "project":"cue.json",
  "expectedSha256":"<revision returned by read>",
  "edits":[
    {"op":"project_update","fields":{
      "render":{"duration":{"seconds":175.2},"tail":"auto"},
      "master":{"gainDb":-1,"ducking":{"source":"assets/vo.wav","amountDb":12,"thresholdDb":-35,"attackMs":50,"releaseMs":300}}
    }},
    {"op":"track_update","trackId":"lead","fields":{
      "automation":{"gainDb":[{"at":{"seconds":18.42},"value":-12,"transition":"linear"},{"at":{"seconds":23.93},"value":-4}]},
      "effects":[{"type":"compressor","thresholdDb":-18,"ratio":3,"attackMs":20,"releaseMs":200},{"type":"reverb","roomSize":0.5,"decaySeconds":1.2,"wet":0.15},{"type":"saturation","driveDb":3,"mix":0.2}]
    }}
  ]
}
```

This example requires existing track `lead` and a valid installed `assets/vo.wav`.
Semantic ducking derives speech reduction; gain points independently shape section
levels. Call existing `daemonv12_render` with `stems:true`, `format:"wav,mp3"`.
MP3 containers include encoder delay/padding; gapless decoding recovers the exact
PCM timeline. A player ignoring that metadata may expose padding. WAV/stems are
canonical for duration; MP3 bytes remain outside the repeatability guarantee.

## Fixtures, acceptance and game-layer readiness

```sh
npm run fixtures:v05
npm run demo:v05              # both fixtures and complete acceptance checks
npm run demo:v05-loop         # exact four-bar layer and stems
npm run test:v05
npm run check
npm run doctor
npm run smoke -- --mcp
```

`examples/v05-video-demo.json` combines Foundry, eight-second output, gain/pan
automation, synthetic VO, compression, reverb and saturation. Fake activity is
1.2–2.8 and 4.4–5.8 seconds; it is not real speech or the Shoot the Moon score.
The verifier renders WAV/MP3/three stems/analysis/provenance, checks gapless decoded
frames, measures ducking against the processed stem sum, checks clipping/loudness
and repeats canonical artifacts byte-for-byte. It writes
`renders/v05/v05-acceptance.json` and `acceptance-unducked.wav` for A/B inspection.
A separate integration proves active reference plus silent music stays silent.

`examples/v05-loop-demo.json`: 100 BPM, 4/4, four bars, no tail, exactly
**423,360 frames / 9.6 seconds** with two aligned stems. A late sample and its
reverb are cut at the boundary. The video has **352,800 frames / 8 seconds**.
Tests also cover GM/sample automation, FluidSynth-tail trimming, exact rounding,
finite tails, path security, transactional patches, effect order and repeatability.

Future **SURFACE, THREAT, COMBAT, CLAIM** layers can share tempo, meter, bar count
and exact output boundaries, using `render.duration.bars` / `render.tail:"none"`.
The host game can crossfade them. Game integration, adaptive routing, automatic
loop composition and loop crossfades remain deferred.

**Exact length does not guarantee perceptually seamless looping.** Sustains,
effects and mismatched boundary waveforms can click when cut. The engine honors
the hard boundary and never silently changes musical content to hide it.
Composition and host transitions must address waveform continuity.

## Backward compatibility

Original demo/sample/Foundry/production projects remain unchanged. Without V0.5
fields, MIDI events, sample quantization, FluidSynth settings, full-score GM
mixing, unequal natural stem tails and V0.3 effect processing preserve behavior.
The engine/package version advances normally. New algorithm provenance appears
only on V0.5 routes. Golden MIDI and all legacy tests remain intact.
