# BOLLO — instrument handoff for Claude Fable

**Status: stop for owner listening review.** This delivery is an instrument and a five-second percussion proof. No complete BOLLO song, GRIND/FABLE composition, video or Blender work was done. Do not begin further development or composition before the owner reviews the auditions.

Branch `codex/bollo-coin-instrument`; base `codex/v12-motif-bridge` at `10a322835bc0c4ed84a90b214b5ae66ead75d2d6`. All frozen rack sources, existing packs, motif contracts, CRUSH and approved masters are unchanged. No existing PR was merged.

Listen: [F · groove](proofs/bollo-coin/audio/F-BOLLO-5s-dry.mp3), [G · coin rhythm alone](proofs/bollo-coin/audio/G-coins-only-dry.mp3), [I · dry then selective CRUSH](proofs/bollo-coin/audio/I-dry-then-selective-CRUSH.mp3). [Full A–I WAV/MP3 index](proofs/bollo-coin/README.md).

The identity is **metallic money moving over hard tile**. Face impacts are short slaps with flexural ring; edge strikes excite asymmetric split modes; bouncing loses speed through restitution; spin chatter accelerates under a separately bounded precession law. Rolling has continuous speed-dependent texture and spatial contacts. These are physically informed approximations, not measured quarter acoustics.

Use [coin.ts](instruments/bollo-coin/coin.ts) for individual triggers, [presets.ts](instruments/bollo-coin/presets.ts) for eight starting points, and [bridge.ts](instruments/bollo-coin/bridge.ts) for existing V12 score/2 motif workflows. [Parameters and mechanics](instruments/bollo-coin/README.md), [runnable two-bar integration score](instruments/bollo-coin/proof.score.json).

```ts
import { renderCoinBridge } from './instruments/bollo-coin/bridge.ts';
// In a regular BridgeScore, add a part:
// { id:'money', instrument:'bollo-coin', gainDb:3, room:0,
//   coin:{ motion:'edge', strike:.96, damping:.6, position:.2, seed:250 },
//   notes:[[0,.1,60,.85],[.75,.1,60,.65]] }
// const { audio, stems, manifest } = await renderCoinBridge(score);
```

Each note's velocity scales incoming speed, affecting both bounce timing and acoustic force. Pitch is ignored. Duration is the physical event's natural motion and ring-down; note length does not gate it. Use `tightFace`/`rim` for short rhythmic statements and `shortSpin` for punctuation. Full bounce/spin/roll can cross beat boundaries. Leave enough tail, and check `manifest.coinEvents[].truncated` when placing near the end. Score tempo changes trigger timing; internal coin motion remains in physical seconds.

Part-local `coin` parameters are supported; coin automation, per-note custom params, slides, room sends and pitched gestures are not implemented. Make separate coin parts for distinct parameter sets. Seed derivation is stable per part note index; changing an earlier note can change later realizations. The adapter reuses original motif timing and rejects unsupported requests; it does not alter the registry.

The proof's call/answer face and rim syncopation are engineering audition material, not an approved BOLLO arrangement. After listening approval, Fable can compose from scratch with the reusable instrument. Preserve the face/rim contrast and the distinctive accelerating wobble; avoid using full physical gestures on every sixteenth. Keep CRUSH selective: bright rim and chatter should remain intelligible. Optional H processes only face/bounce at 25% wet and then matches overall loudness.

[Technical QA and test results](proofs/bollo-coin/TECHNICAL_QA.md), [render statistics](proofs/bollo-coin/audio/qa.json), [sample-accurate event manifest](proofs/bollo-coin/audio/events.json), [dry stems](proofs/bollo-coin/audio/stems/). All WAVs are 44.1 kHz stereo PCM24; MP3 copies are derived at 256 kbps. Exact synthesis/codec versions and hashes accompany the delivery.

Owner listening decisions: quarter recognition; face/rim contrast; convincing bounce-to-wobble transition; roll texture; whether F feels compelling as a coin-led rhythmic proof. Technical checks have passed independently of those aesthetic decisions. No human headphone/speaker audition is claimed by this handoff.
