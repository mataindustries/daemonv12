# Experimental Float64 production and PCM24 export

This independent checkout workflow renders native v0.7 sampler/drumkit projects
to genuine 24-bit PCM WAV. Existing `daemonv12 render`, MCP tools, source format,
Composer v0.4 and their default bytes are unchanged. No publication or licensing
change is included.

```sh
node scripts/render-production24.ts path/to/project.json work/new-production24
node tests/precision.test.ts
npm run typecheck
```

Choose a **new** output directory. The command writes a stereo 44.1 kHz
`PROJECT.24.wav`, one sample-aligned PCM24 WAV per track and
`PROJECT.24.render.json`. It publishes the directory only after processing and
analysis succeed. A failed run removes its temporary directory. Existing renders
and source assets are never replaced.

## What precision means here

The normal production route rounds interpolated voices after velocity/envelope,
then quantizes each processed track to PCM16, decodes those stems and sums them
for master processing. Converting its finished WAV to PCM24 cannot recover either
rounding stage. The normal route deliberately remains compatible.

The experimental path instead keeps these values in Float64 through:

1. Existing band-limited interpolation, velocity and articulation, without
   per-voice integer rounding.
2. Track gain/pan automation and ordered effects.
3. Track summation, master gain/effects, output fit and optional VO ducking.
4. One PCM24 quantization for the master. Stems independently quantize the
   post-track, pre-master floats to PCM24.

FFmpeg effects receive and return Float64 audio through the existing processor.
Built-in reverb/saturation and ducking use their existing Float64 algorithms.
There is no PCM16 track round trip in the master path. Fractional gain,
interpolation, synthesis processing and effect results therefore survive below
a PCM16 least significant bit. Tests demonstrate a 0.1 PCM16-unit voice becoming
26 PCM24 units rather than disappearing; track/master attenuation and nonlinear
processing retain fractional detail too.

**Native source WAVs remain PCM16.** This does not recover detail already lost
in those assets and does not enable PCM24/float sources in the project schema.
General MIDI tracks are explicitly rejected because the existing FluidSynth
adapter outputs PCM16. Original high-precision synthesis sources need a future
source-format extension before their original detail can traverse native projects.

Stems are aligned but their sum need not equal the master byte for byte: each
stem has its own 24-bit quantization, and the master sums original floats before
its gain/effects/ducking. Overloaded exported stems are identified even when
master attenuation makes the float sum safe. Reduce authored track gain before
using overloaded stems in a DAW.

## Measurement and reproducibility

The report records Node/FFmpeg versions, source/project hashes, every output
hash, pre-export overload counts, PCM24 peak/RMS/full-scale counts, integrated
LUFS, loudness range and FFmpeg true peak. Stereo correlation and the RMS of
`(L+R)/2` measure cancellation in a conventional mono fold; a null logarithmic
level denotes silence (including complete cancellation). Low byte occupancy is
reported as a diagnostic, **not** as proof of audible fidelity.

Export is deterministic with pinned source bytes, source code, Node and FFmpeg.
There are no timestamp metadata chunks, implicit normalization, limiting or
dither. No universal loudness target or true-peak ceiling is imposed. Review the
measurements against the intended distributor's specification; apply authored
gain/processing and render again when needed. Metrics do not certify audible
quality, transition quality or mono translation; human listening is still needed.

The independent milestone retains the existing one-billion interpolation-tap,
128 MiB performed-voice buffer, 15-track and 600-second duration limits. It does
not bypass validation. It renders whole tracks, preserving voice phase, absolute
sample timing, automation and effect state; it does not concatenate section WAVs.
Processing uses several full-length Float64 arrays and is not a streaming mixer.
Repeated-voice cache support belongs to the separate full-length milestone;
dense scores rejected here need that milestone or documented intermediate assets.

No asset license is inferred from this workflow. Source provenance and owner
licensing declarations continue to apply; code licensing remains an owner decision.
