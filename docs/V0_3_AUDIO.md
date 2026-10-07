# V0.3 production audio

Engine `0.3.0`, additive project `formatVersion: 1`. The V0 and V0.2 specifications
remain the baseline when production fields are absent.

## Architecture decision

FFmpeg enters now because production export and standards-based loudness measurement
would otherwise require an encoder dependency and substantial DSP code. Its two-pole
filters and single-tap echo also cover a useful small effect set. It is isolated in
`src/render/ffmpeg.ts`, exported through `render/index.ts`; no CLI or orchestration
code constructs subprocess commands or filtergraphs. FluidSynth and sample playback
remain unchanged. Gain, stereo balance, summation, clipping measurement and final
PCM encoding remain deterministic engine-owned operations.

FFmpeg is required for production renders, explicit `--format` export, and `analyze`.
Legacy render commands without production fields or `--format` still work without it.
The adapter probes the executable version before rendering, uses argument arrays
without a shell, one filter thread, bounded output and a timeout. Missing executables
report `AUDIO_TOOL_NOT_FOUND`; failed processing, unsupported filters/encoders, malformed
measurement output and timeouts report `AUDIO_PROCESSING_FAILED` (exit 3).
`DAEMONV12_FFMPEG` selects an executable, otherwise `ffmpeg` is used. Verified with
FFmpeg 6.1.1 (Ubuntu package 6.1.1-3ubuntu5), FluidSynth 2.3.4 and FluidR3_GM.

Reference: [FFmpeg filters](https://www.ffmpeg.org/ffmpeg-filters.html) (`highpass`,
`lowpass`, `aecho`, `loudnorm`). Only loudnorm's **input** measurements are used;
its processed output is discarded and never replaces the master.

## Project interface

All new fields are optional. Objects remain closed and numeric values must be finite.

```json
{
  "master": {"gainDb": -1},
  "tracks": [{
    "id": "keys",
    "mix": {"gainDb": -4, "pan": -0.3},
    "effects": [
      {"type": "highpass", "frequencyHz": 150},
      {"type": "delay", "timeMs": 180, "wet": 0.16}
    ]
  }]
}
```

This fragment supplements the existing project and track fields; it is not a full project.

| Field | Range/default | Meaning |
|---|---|---|
| `track.mix.gainDb` | −60 through +12; default 0 | Linear amplitude multiplier `10^(gainDb/20)` |
| `track.mix.pan` | −1 through +1; default 0 | Negative left, positive right |
| `track.effects` | 0–8 effects; default empty | Applied in array order |
| `master.gainDb` | −60 through +12; default 0 | Applied after summing processed tracks |
| `master.effects` | 0–8 effects; default empty | Applied after master gain |

Pan uses **linear stereo balance**, a center-unity / 0 dB center law:
`L *= 1 - max(0, pan)`, `R *= 1 + min(0, pan)`. Center is an exact identity;
hard-left preserves left and silences right. It does not fold stereo into mono or
move the opposite channel across. Mono sample inputs have already been duplicated
into stereo. At ±0.5 one channel is attenuated by 6.0206 dB. This deliberately
avoids the center attenuation of a constant-power mono panner, preserving defaults.

Supported effects on both tracks and master:

| Type | Required parameters | Behavior |
|---|---|---|
| `highpass` | `frequencyHz`: 20–20000 | Two-pole Butterworth, −3 dB cutoff, float64 precision |
| `lowpass` | `frequencyHz`: 20–20000 | Two-pole Butterworth, −3 dB cutoff, float64 precision |
| `delay` | `timeMs`: 1–2000; `wet`: 0–0.5 | Unity dry signal plus one delayed copy scaled by wet; no feedback |

Filters preserve length; delay adds its full delay tail (even if wet is zero).
There is no arbitrary filtergraph, compressor, multi-band EQ, reverb, automation,
bus, target LUFS or automatic normalization. High/low cuts and a short echo provide
useful cinematic separation and space without presenting a mastering suite.

## Routing and compatibility

The **presence** of `master`, any track `mix`, or any track `effects` opts into
production routing, even if the object/array is empty. Remove all those fields to
restore legacy routing. Selecting an export format alone does not change routing.

Production routing is:

1. Render each GM track using the existing independent MIDI/FluidSynth seam and
   original channel; place sampled voices using the existing absolute frame timing.
2. Sum sample voices without saturating first, then apply track gain, stereo balance,
   and ordered effects. Quantize once into signed 16-bit track PCM.
3. Sum those exact track PCM values without intermediate saturation, apply master
   gain and ordered effects, and quantize once into the canonical master WAV.
4. Zero-pad every exported processed stem to the final master frame count, including
   master delay tails. All start at zero, 44100 Hz, stereo, signed 16-bit PCM.
5. Measure the master and exported stems; optionally encode the master as MP3.

Stems include track gain, pan and effects, and exclude master gain/effects. Summing
stems with unity master settings reproduces the master PCM unless the sum clips.
With master processing, reproduce that processing after summing. Tails are never
trimmed to equalize lengths. Rendering with or without `--stems` produces the same
master. Temporary per-track files are removed when stems were not requested.

Legacy projects retain the original full-score GM master, V0.2 sampled-track mix,
renderer-defined unequal stem tails and manifest shape (apart from engine version).
They are not silently switched to independent GM summation. The historical GM
master/stem non-equivalence remains true on this path. `--format` adds export and
analysis provenance while preserving its WAV bytes and stem lengths.

Production uses the existing 600-second PCM limit, now also for GM production
projects and effect tails. Processing is in memory, intended for short cues.

## Clipping and analysis

No normalization or limiter runs implicitly. Each production quantization records
`clippedSamples` (individual channel values exceeding the signed-16 range after
rounding) and `preClipPeakDbfs`. Out-of-range output saturates explicitly to
`[-32768,32767]`; a render warning `AUDIO_CLIPPING` tells an agent to lower gain.
A clipped track remains reported even when master attenuation makes the final WAV
quiet. Input sample files or FluidSynth output may already contain distortion;
post-render measurements cannot reconstruct pre-render overload.

```
daemonv12 analyze renders/production-demo.wav --json
```

The existing command envelope contains `analysis` with:

- `durationSeconds`, `frames`, `sampleRate`, `channels`, `bitsPerSample`, `format`.
- `peakDbfs`, `rmsDbfs`, `fullScaleSamples`, `clipping`.
- `integratedLufs`, `loudnessRangeLu`, `truePeakDbfs` (FFmpeg input measurements).

The standalone analyzer accepts nonempty signed 16-bit PCM WAV, including rates
other than 44100 Hz. MP3 is a delivery artifact; analyze the canonical WAV.
Exact silence has `null` peak/RMS/LUFS/true peak, representing undefined or negative
infinity without invalid JSON. Loudness range may be zero for short or static audio.
All analysis is read-only. File errors exit 2; unsupported WAV exits 1; tool errors
exit 3. Human mode prints the metric object; `--json` emits one command envelope.

`clipping` is conservative: at least one exact PCM full-scale sample. It is evidence
of possible clipping, not proof of the original signal's history. True peak is a
separate intersample estimate and may exceed sample peak. An agent should inspect
both, as well as the exact production overload counts, and choose its own target
loudness. No universal "too quiet" threshold is imposed.

## Export and provenance

```
daemonv12 render examples/production-demo.json --stems --format wav,mp3
```

`--format` accepts `wav`, `mp3`, or `wav,mp3`. Default is WAV. **All forms retain
WAV**, MIDI and manifest as canonical artifacts; `mp3` requests an additional
192 kbps stereo libmp3lame delivery file. Production renders automatically write
`<name>.analysis.json`; explicit `--format` enables the same analysis on legacy
projects. It contains `{master, tracks: [{trackId, analysis}]}`; tracks are included
when stems are exported. CLI JSON also returns it in `analysis` and links the file
in `artifacts.analysis`.

The manifest adds resolved track gain/pan/effects, master settings, processing order,
pan law, pre-clip peaks/counts, stem alignment, analysis, FFmpeg version, and MP3
codec/bitrate/hash/size when requested. Existing source asset hashes, MIDI provenance,
FluidSynth settings, SoundFont identity, and final WAV/stem hashes remain. There are
no timestamps or absolute paths. WAVs use the existing fixed metadata-free PCM
writer. Repeated renders in the same tool/build environment are byte-identical,
including WAV, stems, analysis and manifest. MP3 is not the determinism contract.

The manifest is written last, after every requested artifact succeeds. Failures
remove partial and stale WAV, MIDI, MP3, analysis, manifest, stems and temporary files.
A subsequent WAV-only render removes old MP3; `midi` removes all old audio and analysis.
The existing collision/asset protection and completion-cleanup contracts still apply.

## Reproducible demo

```
npm run fixtures:samples
npm run demo:production
node bin/daemonv12.js analyze renders/production-demo.wav --json
```

`production-demo.json` is the V0.3 treatment of the existing six-track sample demo:
bass −4 dB, piano slightly left, percussion right, high-pass cuts on piano/hats,
a short piano echo, low-pass impact, and −1 dB master gain. It uses exactly the same
self-generated repository assets, 186 events, and 20-second composition. The existing
`sample-demo.json` remains an unchanged V0.2 regression reference; the generator writes
both. `examples/demo.json` is unchanged.
