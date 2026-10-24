# MORPH sync pack

This small library extracts MORPH//06 and THE CIRCUIT's timing convention without
changing the audio engine. The prototype sound pack uses existing sampler and
drum-kit projects. Historical masters, films and experimental source are untouched.

## Reproduce the demonstration

Use Node 22.18 or newer from a clean checkout:

```sh
npm ci
npm run check
npm run demo:morph-sync -- work/reproduction-a
npm run demo:morph-sync -- work/reproduction-b
cmp work/reproduction-a/verification.json work/reproduction-b/verification.json
```

No FluidSynth, SoundFont, FFmpeg, Python, Blender or historical media downloads are
needed. Each run regenerates five one-shots from recorded parameters, copies the
checked composition, renders it through the existing sampler with aligned stems,
exports its event map and extracts an exact PCM clip. Output stays under the
chosen directory. `verification.json` records WAV/map hashes and asserts no master
clipping. The tests pin the generated assets and composition render too.

The composition is four bars at 120 BPM: 352,800 frames / eight seconds, 46 events.
It alternates cable plucks/slaps, answers with a performed Beast syllable, then
accelerates ratchet slices. The independently recorded WAV SHA-256 is
`4687a4b239196a49075083edc2fae5e043519e43db3ca21d4bf53855a0b50275`.
The checked `examples/morph-sync-demo.events.json` is generated from that project's
resolved timeline. `examples/morph-sync-demo.wav` and
`examples/morph-sync-demo.verification.json` provide a ready-to-review render and
hash report in the repository; the WAV is excluded from the npm package to avoid
duplicating audio payload. `examples/morph-v1.catalog.json` records generation parameters,
seeds, provenance, generator and output hashes. Regenerating on another runtime
must pass the pinned PCM hashes before claiming identical sound assets; offline
synthesis uses JavaScript floating-point transcendental functions. The integer
export math itself is exact across supported runtimes.

## Library

Source checkouts import `src/sync/index.ts`; an installed package exposes
`daemonv12/sync`. It has no I/O, environment reads, synthesizer, project schema or
renderer concepts. Pass events already scheduled by any custom score generator:

```js
import { buildEventMap, cropEventMap, serializeEventMap } from 'daemonv12/sync';
const source = { repository: 'example/score', commit: 'immutable-ref', path: 'score.mjs' };
const map = buildEventMap([
  { sampleFrame: 882735, trackId: 'cable bass', eventId: 'phrase-2/slap-0',
    velocity: 1.5, visualRoles: ['cable-attack'], source: { ...source, index: 12 } }
], { sampleRate: 44100, fps: { numerator: 60000, denominator: 1001 }, source });
const clip = cropEventMap(map, 882000, 1234800);
const json = serializeEventMap(clip);
```

`ScheduledEvent` requires an absolute nonnegative safe-integer `sampleFrame`, stable
`trackId`/`eventId`, nonnegative finite `velocity` (linear gain, including values
above 1), and nonempty JSON `source`. Semantic `visualRoles` are optional strings.
They describe meaning, such as `impact` or `voice`; visual software decides how to
interpret them. Keep source event names, indices, parameters and hashes in `source`.
The exporter cannot authenticate provenance: callers must record honest source
identities and verify their bytes.
Provenance accepts at most 128 nested objects or arrays; deeper metadata is
rejected with diagnostics before validation or serialization can exhaust the stack.

`buildEventMap(events, options)` validates inputs and returns `formatVersion: 1`,
`kind: "daemonv12-event-map"`, sample rate, reduced rational FPS, source provenance,
clip bounds (or `null`) and mapped events. Each event contains:

| Field | Meaning |
|---|---|
| `sampleFrame` | Unchanged absolute source audio frame; never inferred from picture/time |
| `clipSampleFrame` | `sampleFrame - clip.startSampleFrame`, or `sampleFrame` without a clip |
| `pictureFrame` | `floor(clipSampleFrame * fps.numerator / (sampleRate * fps.denominator))` |
| `sourcePictureFrame` | The same floor projection from the absolute sample frame |
| `trackId`, `eventId`, `velocity`, `visualRoles`, `source` | Original scheduled identity, gain and metadata |

Picture frames are zero based and contain the audio event. Exact `BigInt` rational
arithmetic avoids float/FPS drift. Picture frames never move an audio onset.
Audio scheduling preserves the existing engine rule: round each absolute musical
boundary once to its nearest sample frame, ties later (`ticksToFrames`). Custom
MORPH generators can retain their already authoritative sample frames directly;
they need no General MIDI project or quantization to the 960 PPQ grid.

`cropEventMap(map, start, end)` takes **absolute integer source offsets** and keeps
onsets in the half-open interval `[start, end)`. It subtracts sample offsets before
deriving local picture frames; subtracting rounded picture indices is incorrect
for unaligned cuts. Repeated crops intersect the existing clip and cannot recover
discarded events. Disjoint intersections become empty intervals. Cropping describes
onset events only; it does not invent an event for a sustained voice already active
at the clip's start. Preserve longer visual state separately when needed.

`validateEventMap(unknown)` returns actionable diagnostics (code, path, message,
hint), checking schema, source JSON, identities, ordering and all derived timing.
`serializeEventMap` validates again and returns canonical compact JSON plus a newline.
Keys, equal-time event identities and role tags sort by UTF-16 code unit order, never locale.
Inputs are not mutated. Duplicated identities within a track, noninteger/unsafe
sample offsets and unsafe derived picture frames are rejected.

For existing Daemon projects, `scheduledEventsFromTimeline` from
`daemonv12/sync/timeline` converts a validated resolved `Timeline` with the same
`ticksToFrames` used by sampler rendering. Event IDs are resolved note ordinals
within each track. Provenance records track/note index, tick and pitch; it does not
pretend to recover pattern/clip identities that resolution has discarded. Supply
the source project hash and revision separately.

## CLI

```sh
# Export the independently generated schedule; the file contains FPS and provenance.
node bin/daemonv12.js sync work/reproduction-a/morph-sync-demo.schedule.json \
  --out work/custom.events.json

# Adapt a native sampler or GM project. Only the original project format uses --project.
node bin/daemonv12.js sync examples/morph-sync-demo.json --project \
  --fps 60000/1001 --out work/project.events.json

# Crop a schedule or an existing validated map by absolute sample offsets.
node bin/daemonv12.js sync work/custom.events.json \
  --start-sample 44101 --end-sample 220517 --out work/clip.events.json --json
```

Schedule input is `{sampleRate, fps, source, events, clip?}` with the same library
fields. Both clip flags must be supplied together. CLI errors use the existing
diagnostic/exit-code conventions. Exports never overwrite their input; writes use a
temporary sibling file and rename only after validation. No MCP tool is added.

For audio extraction, `extractWavFrames(bytes, start, end)` from
`daemonv12/audio/clip` copies integer PCM frame bytes with a fresh WAV header,
preserving sample rate, channels and bit depth (8/16/24/32). End is exclusive; empty
audio clips are rejected. It performs no DSP and drops non-audio RIFF metadata.
Map offsets are absolute source coordinates; after cropping an audio buffer, any
further audio offsets are relative to that buffer. The demo verifies the clip PCM
against an independent byte slice, including an edit one sample past a second.

## Scope and evidence

The fixtures retain all 595 MORPH//06 B source events and all 361 valid CIRCUIT
mapping events, including unselected visual events and the sample-accurate cutoff
at local sample 335,160 / picture frame 456. Tests compare every known frame at
44,100 Hz / 60 fps, unaligned and nested crops, rational FPS, invalid schemas,
repeat exports, sampler trigger parity, exact PCM16/24 extraction, sound hashes,
and the demonstration. Existing golden render tests remain the compatibility gate.
`npm run test:package` verifies the installed library and CLI in a fresh consumer.

See [source audit](MORPH_SYNC_SOURCES.md) for immutable refs, hashes and fixture
reconstruction, and [sound audit](MORPH_SOUND_AUDIT.md) for the five selected sounds
and deliberate adaptations. This is a prototype pack: no whole experimental synth
has been added to the engine and no new rights grant is asserted for historical
source or derived samples.
