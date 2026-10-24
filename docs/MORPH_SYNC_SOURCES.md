# MORPH sync source audit

The source material lives on experimental branches of
[`mataindustries/daemonv12`](https://github.com/mataindustries/daemonv12), outside
`main`. This extraction reads the sources below; it does not replace the approved
CABLE//BEAST B master or THE CIRCUIT film. The new sampler pack is a separate
versioned prototype, not a revised historical master.

## Timing sources

MORPH//06 is pinned to commit
[`2b6e533a021218d6940a8da5a7032c2abe58a3d9`](https://github.com/mataindustries/daemonv12/tree/2b6e533a021218d6940a8da5a7032c2abe58a3d9)
(`feat/morph-06-overload`). `experiments/morph-06/record.mjs` builds its event rows
from the same scheduled arrays used to render cable, Beast, drums, wind strikes,
ratchet repeats, silence windows and section markers. It imports the earlier
`experiments/morph-04/events.mjs` row/identity helpers. The final timing pass is:

```js
sampleFrame = Math.floor((exactTime ?? step * 0.125) * 44100 + 0.5);
frame60 = Math.floor(sampleFrame * 60 / 44100);
```

The first operation is nearest audio frame, with ties later, matching DaemonV12's
tick timing rule. The second is the **zero-based containing picture frame**.
Authoritative integer `sampleFrame` takes priority over display `time`, `step`,
and MIDI ticks. In particular, wind strikes can use `exactTime` instead of a
rounded score step. The original ratchet helper rounds its reported slice times
to four decimals upstream; the reusable exporter preserves the published integer
event timings, including that historical convention.

The B map contains 595 events: 460 with grid ticks and 135 without. Its velocities
are linear gains before mixing, not MIDI velocities; a slap can have velocity
`1.5`. Rows without authored velocity use `1` in the portable adapter, following
THE CIRCUIT's existing mapping code.

THE CIRCUIT reference is pinned to commit
[`572caf9c6ae835e7f840f4163b73056e431bbf57`](https://github.com/mataindustries/daemonv12/tree/572caf9c6ae835e7f840f4163b73056e431bbf57)
(`feat/morph-commercial-01-circuit`). The audited files are
`experiments/morph-commercial-01/prepare.py` and `mapping.json`.
`prepare.py` verifies the source hashes, extracts PCM bytes for the half-open
sample interval `[882000, 1234800)`, and retains **all 361 valid event rows**.
Visual selection and coalescing annotate rows rather than deleting them.

The approved V2 production source at commit
[`fecba56ccba0ce7b89b7cefa9db68cbae22bb73a`](https://github.com/mataindustries/daemonv12/tree/fecba56ccba0ce7b89b7cefa9db68cbae22bb73a)
(`production/the-circuit-v2-master-61bd2e1`) was also checked:
`experiments/morph-commercial-02/choreography.py` reads this same V1 map, pins its
SHA-256 to `5e3f2d85…`, and asserts `frame60 == sampleFrame // 735` for every row.
The fixture therefore covers the authoritative timing shared by both films.

The clip is exactly 352800 sample frames (8 seconds). At 44100 Hz / 60 fps there
are exactly 735 samples per picture frame. Its mapping states:

```text
relativeSample = sourceSampleFrame - 882000
frame60 = relativeSample // 735
frame f represents audio samples [f*735, (f+1)*735)
```

The all-source cutoff is absolute sample `1217160`, local sample `335160`, picture
frame `456`; the final 24 picture frames are black. Reusable crop operations use
integer subtraction and reproject the new local sample offset. Subtracting a
rounded source picture frame is incorrect when the crop is not frame-aligned.

## Sound sources and extraction boundary

The sound implementations below are read at the same MORPH//06 commit. They
remain offline references rather than dependencies of the audio engine.

- `experiments/morph-03/cable.mjs`: a seeded fractional-delay feedback cable with
  a dispersive allpass cascade, loss filtering, strike-driven tension relaxation,
  contact buzz, harmonic touches, damping and bowed excitation. Long round trips
  become rhythm; short ones become pitch. Pluck/slap/ghost/scrape/crack are
  performance variations of the same mechanism.
- `experiments/morph-06/beast.mjs`: a bowed cable excites the MORPH//03
  Kelly–Lochbaum throat. Explicit syllable mouth trajectories, not an LFO, create
  the wobble. Source distortion precedes the throat, followed by mouth grit,
  metal ringing and a clean sub following mouth openness. Pinned peak
  normalization prevents later phrases changing earlier drive. A small sampled
  vocabulary is a useful extraction; the full throat and performance system are
  not required in the main engine.
- `experiments/morph-04/perform.mjs`, `ratchet`: repeats a captured kick/snare
  fragment once per cable round trip. Each capture starts at `round(t*SR)`, with
  `round(period(t)*SR)` samples and a 0.7 ms edge fade, until the requested end.
  Varying the period moves between rhythm and pitch. This is a rendering recipe
  for short captured variations, not an additional engine synthesizer.
- `experiments/morph-04/kit.mjs` and `morph-03/household.mjs`: provide the modal
  drums, cable ticks/toms and spring layer used by the historical ratchet
  captures. `morph-06/record.mjs` records the actual capture construction and mix
  parameters.

## Provenance hashes

SHA-256 is over the original bytes, including the source's final newline. Paths
are relative to the repository. All entries except the last two use MORPH//06's
commit above; the CIRCUIT preparation/mapping entries use `572caf9c…`.

| Source | SHA-256 |
| --- | --- |
| `experiments/morph-03/cable.mjs` | `591ae70a37b96a99ed57bc73819f61d314f84e5512f83c9084a1291219c7fa19` |
| `experiments/morph-03/dsp.mjs` | `d219f8cd93748889636fbb8037940c52d3b6651ffe1aeff1a07fc59c3a115258` |
| `experiments/morph-03/throat.mjs` | `9755cccacfa6bb163f96c298c20456c197929b33f03ce0ede29b715132a550c9` |
| `experiments/morph-03/household.mjs` | `5c800ca2c3dcdcb3add7579b08207a1e3037c38b445b3b1a998cc55a5e5e84f7` |
| `experiments/morph-04/kit.mjs` | `6301ba16bcae32070a084ac61eb17bfe40505c762b8f6759a3942cb0e3d81cfa` |
| `experiments/morph-04/perform.mjs` | `727ca9556c112ec12be56e4a9d6e0f154671bd1eb37cf25bf4a1902a1826b123` |
| `experiments/morph-04/events.mjs` | `3e754354dd54a40089f039c3d06e541914a838c3dcd4235cbcd5f15f9e5dac4c` |
| `experiments/morph-06/beast.mjs` | `fa1b83049efbe2e92ff81ad63f42a8b6f8bf63512629dacca13ee1243f017806` |
| `experiments/morph-06/record.mjs` | `d93befe5558870b6c3e24060a6840583a9fa120af2cdda35f9795c19c34dcdd4` |
| `experiments/morph-06/audio/b/cable-beast-b.events.json` | `de93e3cddf7d7267010da1553e0d295243efeec43f00d4888805ad8aa65e00d4` |
| `experiments/morph-commercial-01/prepare.py` | `0a429894c73e8af56ed7934a23535ebdb9a53475fb9e4f0e299f368cfb718654` |
| `experiments/morph-commercial-01/mapping.json` | `5e3f2d85dcc45e0ff7e458a85d85cd28c7af948bc4e2a9e11b57d477c71a8e8f` |

The approved B WAV is referenced by `prepare.py` with SHA-256
`1474f0d22e0e939acad1824a01b92d8264cb5b4e758623034e6c92c597c6c890`.
It is not needed to run these event-map regressions, and is not rewritten by the
new demonstration.

## Independent regression fixtures

`tests/fixtures/morph-sync/morph06-b.json` projects every source row into
`[sampleFrame, pictureFrame60, part, event, velocity-or-1]`, preserving original
row order. `the-circuit.json` independently projects every historical CIRCUIT row
into `[sourceIndex, sourceSampleFrame, sampleFrame, sourceFrame60, frame60, part,
event, velocity]`. Both fixtures record the original commit, path, SHA-256 and Git
blob ID. The expected CIRCUIT timings come from its committed map, not from the
new exporter.

To independently inspect or regenerate a projection, fetch the exact original
path from `https://raw.githubusercontent.com/mataindustries/daemonv12/<commit>/<path>`,
verify the SHA-256 above, parse JSON and project those columns without computing
new timing. Keep every row, including metadata and coalesced/unselected events.
Run `node --test tests/sync-circuit.test.ts` for all-row comparisons, an arbitrary
single-sample crop offset, nested cropping, cutoff boundaries and repeated
canonical exports. These tests require no network, MIDI synthesizer, Blender,
historical WAV or historical film.
