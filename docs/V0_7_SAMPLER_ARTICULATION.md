# V0.7 sampler articulation

Engine `0.7.0` adds source ends, musical gates, per-voice envelopes and track-local
choke groups to sampler and drum-kit notes in project `formatVersion: 1`. Agents
can play a slice, leave space between bass notes and close an open percussion
voice without creating another WAV. The original source bytes never change.

Projects without these fields retain their historical WAV and stem bytes under
the same pinned audio tools. The [V0.2 sample contract](V0_2_SAMPLES.md),
[V0.5 timeline contract](V0_5_TIMELINE_DYNAMICS.md) and
[V0.6 playback contract](V0_6_SAMPLE_PERFORMANCE.md) still apply. This document is
normative for the additions below.

## Authoring

```json
{"start":"1:1", "offsetSeconds":0.12, "endSeconds":0.28,
 "gate":"1/16", "envelope":{"attackSeconds":0.001,"releaseSeconds":0.012},
 "chokeGroup":"hats", "playbackRate":1.5}
```

| Field | Accepted value | Meaning |
|---|---|---|
| `endSeconds` | finite number, 0 through 600, at most six decimal places; resolved end must exceed offset | Absolute, exclusive endpoint in the original source WAV. |
| `gate` | positive `"N/D"` whole-note fraction on the existing 960-PPQ grid | Time from onset to the requested release, independent of playback speed. |
| `envelope` | closed object with optional `attackSeconds` and `releaseSeconds` | Per-voice amplitude ramps; each duration is 0 through 10 seconds, at most six decimal places. |
| `chokeGroup` | existing kebab-case ID grammar, at most 32 characters | A new onset releases older voices in the same group on the same track. |

These fields apply only to sampled notes. GM note duration and note-off are
unchanged. Sample notes still reject `duration`; use `gate`. Sampler notes still
reject `pitch`; drum-kit pitch continues to select a mapping.

Any articulation field opts the voice into an envelope. Its defaults are
**1 ms attack and 5 ms release**. Omitted envelope members retain those defaults;
`envelope: {}` explicitly enables them. Zero disables the corresponding ramp and
allows a hard edge. A positive duration must resolve to at least one frame
(use at least `0.000012` seconds); a positive sub-frame guess receives a repair
diagnostic instead of silently becoming a hard edge. A gate alone therefore
releases safely; it does not silently
add an envelope to other notes. `playbackRate`, `glide` and `offsetSeconds` alone
remain V0.6 performance controls with no added fade.

## Source slices and pitch movement

Let `O` be the frame resolved from `offsetSeconds` (default zero), and `F` the
frame resolved from `endSeconds` (default WAV frame count). The readable slice is
`[O,F)`: `O` is included, `F` is excluded. Validation requires
`0 <= O < F <= WAV frames`, even when two different seconds values round to the
same frame. A one-frame slice is legal.

Seconds are exact decimal microseconds, then converted to nearest source frames,
with ties toward the later frame:

```
frame = (microseconds * 44100 + 500000) / 1000000   // integer division
```

There is no source-file cropping, derivative asset or hidden conversion. At rate
1 without a glide, selected source frames are copied exactly before the envelope.
At another rate, the existing V0.6 sinc kernel, cutoff and normalization remain
unchanged. An explicit `endSeconds` restricts interpolation taps to `[O,F)`;
outside taps read silence, including taps before the selected offset. Weights
still normalize over the full kernel; the engine
does not amplify an edge by renormalizing only its in-slice taps. Offsets without
an explicit endpoint retain V0.6 whole-WAV tap bounds, including when a gate,
envelope or choke is added.

`playbackRate` changes pitch and slice duration together. The V0.6 closed-form
read position remains continuous through a glide; `offsetSeconds` still names a
source position, not a delay. The natural slice length `N` is the first output
frame whose read position reaches `F`. At constant rate `r`,
`N = ceil((F-O)/r)`. The exact position function confirms the analytical solution
for a glide. A source ending mid-glide stops there; a gate ending mid-glide
releases while the read position and rate continue to advance. Neither resets,
freezes or time-stretches the source.

## Gates and choke groups

A gate uses the existing duration grammar (`"1/8"`, `"1/12"`, `"3/8"`), not
seconds or decimal beats. Its release frame relative to the voice is
`frame(onset tick + gate ticks) - frame(onset tick)`. Each absolute musical frame
is rounded independently with BigInt nearest-frame arithmetic, ties later, as
for triggers and glides. A gate may outlast its pattern, project or source; it
does not extend a source that has already ended.

Groups are **track-local** and work across patterns, clips and drum-kit mappings.
A new distinct output-frame onset releases every older voice bearing the same
group, using each older voice's own release duration. Voices at the same output
frame coexist, even if distinct ticks rounded to that frame. Note order cannot
choose a winner. Ungrouped notes and groups on other tracks remain independent.

The earliest gate or choke release wins. Later group onsets cannot restart or
extend an older voice's release. A choke with the default release can briefly
overlap the new attack: it is a smooth transition, not a guaranteed single-voice
mix. Use modest velocities; overlapping voices can still sum beyond PCM16.
`releaseSeconds: 0` removes that overlap but can create a discontinuity.

## Envelope and endpoint rules

Envelope durations are measured in **output** seconds, so pitch and glide do not
speed up or slow down a ramp. They resolve to frames with the same microsecond
nearest-frame conversion. Let `A` and `R` be resolved attack and release frames,
`T` the earliest gate/choke release frame (or infinity), and `C` the remaining
permitted render frames (or infinity). The exclusive audible endpoint is:

```
E = min(N, T + R, C)
```

Only `0 ... E-1` are rendered. There is no padded source tail: release requires
source material, and a shorter source or output boundary wins. A release that
would overrun either is moved earlier to finish at that boundary. This can begin
the fade before a gate when the source is already close to its end. The voice
does not extend track tails beyond its original slice endpoint.

For output frame `n`, attack gain is `1` when `A=0`, otherwise
`min(1,n/A)`. Thus a nonzero attack begins at exact zero. When `R>0`, let
`S = max(0,E-R)`. Before `S`, use attack gain. At and after `S`, freeze the attack
gain at `S`, then release linearly:

```
gain(n) = attack(S) * (E-1-n) / (E-1-S)     for n >= S
```

A zero denominator gives zero. The last rendered frame is exact zero. When
an authored gate/choke has its full release window, the frozen attack level
prevents a rise during release. When source exhaustion or an output cap makes
the ramps overlap (`S<A` and either no stop was requested or `E<T+R`), both ramps
compress into the available frames, with an interior peak:

```
p = clamp(round((E-1) * A / (A + max(1,R-1))), 1, E-2)
p = min(p,T)                               if a stop was requested
peak = min(1,p/A)
gain(n) = peak * n/p                        for n <= p
gain(n) = peak * (E-1-n)/(E-1-p)             for n > p
```

This applies when `E>=3`; one- and two-frame voices with both ramps enabled are
silent, as is a positive attack stopped at frame zero. The peak frame is never
later than the requested gate/choke. The peak retains the authored attack level at `p`, so compression never
boosts the signal. Very short slices remain quiet but playable, with exact-zero
first and last frames. Set both durations to zero for an explicit hard one-frame
slice. Zero release preserves attack gain through the last frame and does not
promise a click-free endpoint.

Gain is applied before existing per-voice velocity rounding; voices still sum
without intermediate clipping. These linear amplitude ramps remove endpoint
steps. Very short ramps, source discontinuities inside a slice and dense overlap
can still have audible high-frequency content; no perceptual guarantee or hidden
limiter is added.

Only articulated voices receive these boundary ramps. An exact render boundary
still trims historical voices and downstream effects as before. Ordered track
effects, automation, quantization, master processing and ducking stay in their
existing order. Stems retain the musical origin and the production master's exact
frame length; effect tails remain governed by `render.duration`/`render.tail`.

## Validation, work limits and provenance

Objects remain closed and diagnostics collect independent failures. Invalid
numbers use `WRONG_TYPE` or `OUT_OF_RANGE`; excess decimal precision uses
`INVALID_DURATION`. Gate syntax uses existing `INVALID_DURATION` and `OFF_GRID`
repairs. Endpoint failures identify the note, WAV length, resolved offset and
endpoint, and suggest a valid bound. Common guessed fields receive repair hints
for `endSeconds`, `gate`, `envelope` and `chokeGroup`. Fields on GM notes fail as
`UNKNOWN_FIELD`.

WAV-relative slice bounds require asset-aware compilation, as V0.6 offsets do.
The pure `compileProjectText` validates syntax and musical semantics without
certifying source length. Validation and MCP transactions check the same
render budget before publishing project edits.

The one-billion interpolation-tap and 128 MiB per-voice buffer limits do not
increase. Work and performed-voice buffers use frames actually rendered through
slice, gate, choke and permitted output boundaries. The fastest reachable rate
within those frames bounds the kernel, including a glide cut off early. Attack
and release multiplication does not add interpolation taps or a voice buffer.
Rate 1 without a glide still reads source frames in place, with envelope gain
applied by the mixer. Historical unperformed voices keep their fast path.

Articulated triggers add an `articulation` object alongside existing playback
provenance:

- `sourceEnd: {seconds,frames}` records an explicitly requested source endpoint.
- `gate: {duration,frames}` records the canonical musical gate and relative frame.
- `envelope` records attack/release seconds and their resolved frame counts.
- `chokeGroup` records a requested group. `choke: {frame,frames}` appears only when
  a later group onset changes the effective stop: `frame` is its absolute output
  frame, and `frames` is relative to this voice's onset.
- `articulation.voiceFrames` includes the slice, gate and choke before an output
  cap; `articulation.renderedFrames` applies the permitted output cap.

On performed notes, the existing `playback.voiceFrames` retains its V0.6 meaning:
the natural full-WAV duration at the requested offset/rate/glide, before any
articulation. It is not the number of frames the articulated voice renders.
`samples.articulation` identifies the algorithm. Unarticulated trigger records
keep their historical shape; engine version changes normally. Every asset
identity still hashes the original WAV.
No host path, timestamp or source derivative enters the manifest. Existing
all-or-nothing output cleanup and source-directory protections remain in force.

## MCP

The same nine tools expose these note fields through `project_patch`
(`track_add`, `pattern_put`, `notes_append`). Descriptions distinguish absolute
source seconds, musical gate time and output envelope seconds. The envelope
schema is closed and durations/ranges match engine validation. `project_read`
returns authored controls; full render provenance reports resolved frames.
Invalid batches leave project bytes unchanged. No extra render flag or tool is
required.

## ONE SOUND: before and after

[Before](../examples/one-sound-before.json) and
[After](../examples/one-sound-after.json) both use only the original Orbital
Foundry `06-low-boom.wav`: a 2.4-second mono, 41–95 Hz pressure sound. First it is
exposed alone. From 4 seconds, the same file supplies fast percussion and slowed
low-end voices. Onsets, playback rates, glides, offsets and velocities match.
The after version adds endpoints for shorter percussion, gates for bass space,
envelopes and independent percussion/bass choke groups. It adds no effects or
derived WAVs.

```sh
npm run demo:one-sound       # renders/one-sound/: before/after WAVs, three stems each, report
npm run test:v07
```

Each render is exactly 352,800 frames (8 seconds). The verification script renders
each project into two fresh directories, compares master/stem/manifest hashes,
checks alignment and clipping, confirms the unchanged source SHA-256 and measures
post-hit percussion and bass tail energy. The opening original stem is identical
between versions. The report preserves those measurements and output paths.
Verification is analytical; no human listening session is claimed. Listen to
the WAVs to assess the musical tradeoff between ringing weight and tighter space.

## Deferred

Loop points, automatic slicing grids, cross-track chokes, sustain loops, MIDI
note-off import, reverse playback, time-stretching, exponential envelope curves,
granular synthesis, new effects, streaming and new MCP tools.
