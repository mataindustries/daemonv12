# V12 motif bridge — Fable handoff

Branch: `codex/v12-motif-bridge`, based on PR #50 head `c49577340606e57217bcfd720206a7c47bf5fb71`. PR base: `feat/fable-electro-lab`.

From the repository root, with Node >=22.18 and the existing dependencies installed:

```sh
node studio-001/v12-bridge/cli.ts proofs/v12-motif-bridge/proof.score.json /tmp/fable-bridge-proof --mp3
node --test tests/v12-motif-bridge.test.ts
npm run typecheck
npm test
```

Use a **new output directory** each time; its parent must exist. Omit `--mp3` to remove the FFmpeg dependency. No FluidSynth is needed. The bridge lives outside the frozen rack and never edits the pack, motif layer, CRUSH, existing scores, or approved audio.

## Addressing instruments

Keep using score/2 motifs and phrases. Set a sample part's instrument to `v12-signature/<catalog-sound-id>`. All 16 sounds in `packs/v12-signature-v1/v12-signature.catalog.json` are available; ordinary rack instrument IDs work alongside them. This is an opt-in adapter input: send it to the bridge CLI/API, not the existing rack CLI.

```json
{
  "id": "bass",
  "instrument": "v12-signature/reactor",
  "gainDb": -8,
  "v12": { "releaseSeconds": 0.08 },
  "phrases": [{ "motif": "your-bass-motif", "at": 0 }]
}
```

The complete runnable example is [proof.score.json](proofs/v12-motif-bridge/proof.score.json). Its `cell` is stated by REACTOR and `mechanical-orchestra/bar`; SUB HAMMER states `pulse`. It is a two-bar timing fixture, 128 BPM, A minor, with a 250 ms tail: **4.000 s / 176,400 frames**. Hear [MP3](proofs/v12-motif-bridge/audio/master.mp3) or [WAV](proofs/v12-motif-bridge/audio/master.wav); stems are under `audio/stems/`.

`v12` options apply to the whole part:

| Option | Behavior |
|---|---|
| `mode` | `pitched` or `one-shot`. Catalog kit entries default to one-shot; other entries default to pitched. |
| `gate` | Default true for pitched, false for one-shot. True starts release at the note's end; false plays the source to exhaustion. |
| `attackSeconds` | Default 0.001; 0 disables attack fade. |
| `releaseSeconds` | Default 0.005; 0 disables release fade. Also fades source exhaustion or the output cap. |

Pitch is `2 ** ((MIDI - catalog.rootMidi) / 12)`; score transposition is applied once. REACTOR's root is **A1/MIDI 33**. SUB HAMMER's **kit pitch 36 is a selector, not its acoustic root**, which is also 33. One-shot mode ignores score pitches and transposition and plays at rate 1. Use `{ "mode": "pitched" }` to tune a rooted percussion sample. Unpitched samples cannot use pitched mode.

## Output and processing

The directory contains stereo **44.1 kHz PCM24** master/stems, `score.json`, `events.json`, and `SHA256SUMS`, plus optional MP3. WAVs are authoritative for alignment; MP3 has codec delay/padding. Every stem includes part gain/pan and score master gain. Add all part stems and the separate `room` stem at unity to reconstruct the master (within 24-bit rounding). The proof's room stem is silent. Export refuses clipping; lower gains if necessary. There is no limiter or automatic gain normalization.

`events.json.events` records **performed** onsets after swing/humanization: `frame`, `noteEndFrame`, pitch and velocity. Sample entries include source hash/layout/root/kit selector, rate, attack/release frames, source exhaustion (`naturalEndFrame`), and actual exclusive `endFrame`. `truncated` means a gate or output boundary ended the source early. `noteEndFrame` marks release onset for gated V12 samples; for rack instruments it is the nominal note end, whose articulation may change acoustic duration. The separate `phrases` array retains symbolic lowering provenance; it is before humanization and final score transposition, and is not the authoritative performed timeline.

```ts
import { renderBridge, bridgeWav } from './studio-001/v12-bridge/bridge.ts';
import { crush } from './fable-lab/crush/crush.ts';
import { writeFileSync } from 'node:fs';

const result = await renderBridge(score);
// result.audio and result.stems.get('bass') are [Float64Array, Float64Array],
// amplitude units at 44100 Hz, with the same length and timeline as the WAVs.
const processed = crush(result.audio, { amount: 0.7 }).audio;
writeFileSync('/tmp/fable-processed.wav', bridgeWav(processed));
```

CRUSH is optional and is never called by the bridge. Calibrate input level for CRUSH separately when evaluating its sound; the proof intentionally has generous headroom. Its PCM16-only `measure.ts` reader does not read these PCM24 files; use the float API above or convert with FFmpeg when needed.

## Boundaries

- Reuses unchanged `lowerScore`, `normalizeScore`, rack rendering/mixdown, and `sumFloatPrecise`/sample playback. An internal `context/snare` placeholder provides the broad MIDI range and plain gestures during lowering/normalization only; **it is never rendered for sample parts**. Original part order/seed indices are retained.
- Score/1 plain notes also work. Score/2 transforms, section positions, repeats, textures, swing and seeded humanization reuse existing semantics. Sample gestures: `accent` (velocity ×1.15), `soft` (×0.7), `short` (half gate duration). One-shots need `gate:true` for duration/short gestures to affect the sound.
- Sample articulations, per-note params, slides, legato/lift/fall gestures, continuous timbre controls, setup, motion, breaths, and `fit:"octave"` are rejected. Explicitly transpose motifs to fit. Rack parts retain their existing features.
- One sound per sample part; overlapping notes are independent voices. No choking, looped sustain, time stretching, cross-note phase continuity, or new instruments. Pitch changes source duration, and long gates cannot extend source audio. Engine rates remain 0.25–4 (±24 semitones); catalog recommended ranges are narrower. Existing 4/4, 14-part, tempo and duration limits apply.
- Timing matches rack placement: nearest absolute frame using integer-microsecond tempo, with no extra PPQ snap. At 960-PPQ grid positions this matches native engine events; off-grid motif/humanized positions retain rack timing. Freeze verification is mandatory.

Evidence: [VERIFICATION.json](proofs/v12-motif-bridge/VERIFICATION.json), [protected-file baseline](proofs/v12-motif-bridge/PROTECTED.json), and [bridge tests](tests/v12-motif-bridge.test.ts). No sample licensing or provenance declarations have been changed.
