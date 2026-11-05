# Full-length production rendering: exact interpolation reuse

The first FORGE 003 milestone keeps one continuous project timeline and reuses
identical performed sample buffers. It does not render or concatenate sections.
All notes keep their original absolute sample positions, source read phase,
glides, track-local chokes, final envelope length and velocity. Track automation
and all track/master effects run once across the complete song, so their state
and tails continue across musical section boundaries. Stems use the existing
common-origin, exact-master-length production contract.

This is opt-in. Existing project JSON, CLI defaults, MCP behavior, Composer v0.4
and the historical byte path are unchanged.

```sh
node bin/daemonv12.js validate song.json --reuse-voices --json
node bin/daemonv12.js render song.json --reuse-voices --stems --format wav,mp3 --out-dir renders/song
```

For API callers: `compileProjectFile(path, {reuseVoices: true})` or
`runCommand('render', path, {reuseVoices: true, stems: true, env: process.env})`.
MCP intentionally retains the existing conservative budget and has no new flag.
Use the CLI/API for projects requiring reuse.

## What limits dense three-minute projects

- Three minutes fits the existing 600-second sample/production duration bound.
  Full-song stereo Float64 buffers take about 121 MiB each at 180 seconds; effects
  and processing copies can keep several buffers live. This milestone reduces
  interpolation work; it does not promise streaming or constant-memory mixing.
- Historically every transformed trigger recomputes its interpolation, even if
  a hundred clips perform the same note. The one-billion-tap safety budget
  charges that repeated real work. Rate 1 without a glide already reads the
  source directly and needs no cache.
- Pitch and duration remain coupled. A slowed source lasts longer, a faster
  source ends sooner, and gates cannot extend exhausted audio. There are no
  sustain loops or time-stretching. Use sufficiently long sources, available
  articulations or explicitly authored retriggers; do not assume a held gate
  creates an indefinitely sustained instrument.
- The 15-track limit remains. It is part of the validated project/MIDI channel
  contract, rather than a barrier to 180 seconds. Arrange within it or use
  independently documented intermediate assets. This milestone does not merge
  arbitrary projects, expand MIDI channels or hide extra tracks.
- Output remains genuine PCM16, with per-voice integer rounding and PCM16
  track elements in the legacy production path. A PCM24 conversion of those
  files cannot recover lost precision. Higher-precision rendering is a separate
  milestone.

## Bounds and exact identity

With `--reuse-voices`, interpolation runs once per unique tuple of source PCM
identity, playback rate, source offset, glide target and duration, explicit
source endpoint and final rendered frame count. An explicit endpoint matters
even when equal to WAV length: its lower interpolation tap bound differs from
an offset-only voice. The rendered count includes source exhaustion, gate,
choke, release and output cap, resolved on the original absolute timeline.

Velocity, attack and release gain still apply independently at each onset.
Only unrounded Float64 interpolated source values are reused. The existing
velocity/envelope multiplication and rounding order do not change. A cache hit
therefore preserves the waveform and phase exactly, rather than replacing a
voice with a quantized intermediate WAV. Different velocities and envelope
curves can reuse samples when their actual rendered lengths match.

The existing **one-billion interpolation-tap limit remains** and charges actual
unique computations. The **128 MiB per-voice buffer bound remains**, and reuse
adds the stronger bound of **128 MiB total cached sample buffers per render**.
Both are checked from metadata before interpolation or audio-tool invocation.
The cache also enforces its limits defensively at runtime. There is no eviction,
silent repeated computation, arbitrary increased budget or concurrent duplicate
work. Rendering is sequential. A unique or through-composed score can still
exceed these bounds and must be simplified or use documented bounded asset
pre-renders; this feature does not make every valid musical score renderable.

`manifest.samples.reuse` records the algorithm, unique/reused voice counts,
charged interpolation taps, retained sample bytes and both limits. Default
manifests have no new field. Sources, source hashes and trigger provenance stay
unchanged. The cache belongs to one render request and is discarded afterwards;
separate render commands intentionally recompute it. Persistent disk caching,
incremental track reuse and section assembly are future work.

## Verification

`tests/voice-reuse.test.ts` compares cached and historical master/stem bytes,
checks repeatable manifests, verifies interpolation identity and aggregate
cache/work bounds, and exercises continuous glides, source endpoints, chokes,
gain/pan automation, a sustained voice across a bar boundary, delay and reverb
tails. The CLI accepts the flag only for validate and render. Existing V0.6 and
V0.7 budget tests continue checking the unchanged default refusal path.

```sh
node --test tests/voice-reuse.test.ts tests/architecture.test.ts tests/v06-budget.test.ts tests/v07-budget.test.ts tests/v07-pipeline.test.ts
npm run typecheck
```

The separate stress-test report records the 180-second render, its real source
identities, sample alignment, boundary checks, clipping, mono/stereo measures
and deterministic replay hashes. Objective checks establish technical evidence;
they do not certify musical continuity to a listener or commercial release
readiness. No listening judgment is inferred from metrics.
