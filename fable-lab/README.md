# FABLE electro lab

Experiment branch `feat/fable-electro-lab`, based on PR #49's head (`claude/gifted-wozniak-qk1bvh`, `d65ef67`, the
v0.9 motif layer). Everything here is new and opt-in. The engine (`src/`), the rack, the motif layer, the frozen
MUTATION 001 sources, the V12 SIGNATURE pack and all existing audio are unchanged.

> **Status: checkpoint 1, waiting for a listening verdict.** Only the DAEMON//CRUSH A/B exists. FABLE has not been
> composed and nothing has been rendered for picture. The producer is an AI agent and **cannot hear audio**: every
> number below is a signal measurement, not a claim that anything sounds good.

## Listen first

All files are in [`crush/audio/`](crush/audio). Five seconds, 128 BPM, the existing V12 SIGNATURE sounds, rendered
by the unchanged engine. **A** is dry, **B** is the same audio through DAEMON//CRUSH at `amount 0.7`. Within each
pair the two files are at the same integrated loudness, so B is not winning by being louder.

| Order | File | What it is |
|---|---|---|
| 1 | `crush-ab-bus-switch-A-B-A-B.mp3` | The drum-and-bass bus, switching every bar: A, B, A, B (7.5 s) |
| 2 | `crush-ab-bus-A-dry` / `crush-ab-bus-B-crush` | The bus, 5 s each (`.wav` and `.mp3`) |
| 3 | `crush-ab-kick-A-dry` / `crush-ab-kick-B-crush` | SUB HAMMER + IRON PULSE, four on the floor |
| 4 | `crush-ab-bass-A-dry` / `crush-ab-bass-B-crush` | REACTOR: rolling sixteenths, then two held notes |
| ref | `crush-ab-bus-E-existing-effects` | The bus through the engine's own `saturation` + `compressor`, same loudness |

The pattern is a neutral test loop built from the pack's own recipes. It is not the FABLE riff.

**Four questions**

1. Does B's kick still hit, or has it gone soft? (B's kick front is about 1.9 dB lower against its own body.)
2. Is the bass between the kicks heavier in B?
3. Any fizz, harshness or pumping you do not like in B?
4. Heavier, lighter, or leave the knob at 0.7?

## What DAEMON//CRUSH is

[`crush/crush.ts`](crush/crush.ts): one knob (`amount` 0..1), three stages, 4x oversampled, zero latency,
deterministic. `amount 0` returns the input bit for bit. Nothing imports it unless a caller asks.

1. **DRIVE.** Three bands (150 Hz, 2.5 kHz). Each band has its own level-normalised shaper: the peak stays, what is
   under it comes up. The low band is driven for sustain, the mid band hardest, the top barely.
2. **SQUEEZE.** One stereo-linked compressor with a 14 ms attack and 120 ms release.
3. **CLIP.** A soft-knee clipper at the ceiling takes the fronts the compressor let through.

It is original code. It does not model, clone or measure any plugin or hardware unit.

## Measurements (amount 0.7)

Loudness is FFmpeg `ebur128`. "Density" is how much louder a file is than dry when both peak at -1 dBTP.
"Front to body" is the largest sample in a kick's first 12 ms against the RMS of its next 20-150 ms.

| Source | Condition | LUFS | True peak | Crest | Density vs dry | Front to body | Clipped samples |
|---|---|---:|---:|---:|---:|---:|---:|
| Bus | A dry | -14.0 | -1.0 dBTP | 13.4 dB | 0 | 9.7 dB | 0 |
| Bus | E existing effects | -14.0 | -2.8 dBTP | 11.7 dB | +1.8 LU | 9.8 dB | 0 |
| Bus | **B crush** | -14.0 | -4.5 dBTP | 10.1 dB | **+3.5 LU** | 7.8 dB | 0 |
| Kick | A dry | -13.3 | -1.0 dBTP | 12.2 dB | 0 | 8.4 dB | 0 |
| Kick | E existing effects (not delivered) | -13.3 | -1.5 dBTP | 11.6 dB | +0.5 LU | 9.0 dB | 0 |
| Kick | **B crush** | -13.3 | -3.3 dBTP | 10.0 dB | **+2.3 LU** | 7.0 dB | 0 |
| Bass | A dry | -13.9 | -1.0 dBTP | 14.0 dB | 0 | | 0 |
| Bass | E existing effects (not delivered) | -13.9 | -3.6 dBTP | 11.5 dB | +2.6 LU | | 0 |
| Bass | **B crush** | -13.9 | -5.3 dBTP | 9.7 dB | **+4.3 LU** | | 0 |

**Tonal balance of the bus at the same loudness** (share of energy per band, change against dry):

| Band | E existing effects | B crush |
|---|---:|---:|
| Sub 20-60 Hz | +0.5 dB | 0.0 dB |
| Bass 60-150 Hz | -1.3 dB | -0.7 dB |
| Low-mid 150-500 Hz | +1.4 dB | +2.0 dB |
| Mid 500 Hz-2 kHz | +2.8 dB | +2.0 dB |
| High 2-8 kHz | +0.6 dB | -1.4 dB |
| Air 8-20 kHz | +1.4 dB | -2.6 dB |

**Distortion products** (steady test tones, relative to the tone):

| Probe | Engine `saturation` (tanh, 10 dB drive) | DAEMON//CRUSH |
|---|---:|---:|
| Folded (aliased) harmonics of a 4.19 kHz sine | -37 dBc | -107 dBc (-113 dBc with the clipper held open) |
| Sub-on-mid intermodulation: 55 Hz stamped onto a 3 kHz tone | -5 dBc | -41 dBc |

**What each stage does on the bus** (ablation, each at -1 dBTP):

| Stages | Density vs dry | Front to body | Low-mid change |
|---|---:|---:|---:|
| All three | +3.5 LU | 7.8 dB | +2.0 dB |
| Drive only | +0.8 LU | 9.2 dB | +1.5 dB |
| Squeeze only | -0.9 LU | 11.1 dB | +0.5 dB |
| Clip only | +0.1 LU | 9.6 dB | 0.0 dB |
| Without drive | +1.3 LU | 9.3 dB | +0.5 dB |
| Without squeeze | +2.2 LU | 8.1 dB | +1.4 dB |
| Without clip | -0.8 LU | 11.7 dB | +2.3 dB |

**The knob on the bus**: amount 0.25 gives +1.1 LU, 0.5 gives +2.5, 0.7 gives +3.5, 0.85 gives +3.9, 1.0 gives +4.0
(deepest clipper shave 0.8, 2.9, 4.5, 5.6 and 6.8 dB).

Full numbers, hashes and settings: [`crush/audio/REPORT.json`](crush/audio/REPORT.json). Picture:
[`crush/audio/crush-ab-bus-waveforms.png`](crush/audio/crush-ab-bus-waveforms.png) (blue A, red B; whole file, then
the first beat).

## What was kept and what was dropped

- **Existing effects were tried first and are not enough for this job.** The engine's `saturation` is a tanh at the
  output rate with no band split: on the bus it reaches +1.8 LU, it folds harmonics back at -37 dBc, and a steady
  sub modulates the mids at -5 dBc. That is the reason for a separate module. The existing effects are untouched.
- **Kept: all three stages.** No single stage does the job. Squeeze alone and "without clip" make the bus *less*
  dense at the same peak; the compressor and the clipper only pay off together. Drive supplies most of the
  low-mid lift.
- **Dropped: a two-band drive.** The first version lifted hats and air by about 4 dB and shaved the kick front by
  up to 11 dB. It measured denser (+4.4 LU) and was removed because it changed the mix balance.
- **Not added:** stereo widening, an exciter, a look-ahead limiter, a second knob.

## Limits of this evidence

- **Nobody has listened.** Density, crest and band energy are proxies. Whether B sounds fatter or just flatter is
  the listening question.
- At the same loudness B's peaks are 3.5 dB lower and the 60-150 Hz band is 0.7 dB lower.
- The knob is not strictly monotonic: on the bass alone, amount 1.0 is slightly less dense than 0.7.
- The distortion probes are steady tones; music is not. One existing-effects setting was tried, not a search.
- Thresholds are fixed, so the input has to be calibrated: the build normalises each source to a -3 dBFS peak first.

## Reproduce

```bash
node fable-lab/crush/ab.ts NEW_DIR --amount 0.7
```

```bash
node --test tests/fable-crush.test.ts
```

Needs Node 22.18+ and FFmpeg with libmp3lame (6.1.1 here). About 50 s. Two builds in this session produced identical
`SHA256SUMS`. `ab.ts` copies the pack into a scratch directory, renders with `bin/daemonv12.js`, and deletes the
scratch directory.

## Phase 1 inventory

| Area | What exists | How FABLE can use it |
|---|---|---|
| Motif layer (PR #49) | `studio-001/motif/`: score/2 lowered to rack score/1, fifteen transforms, report and frame-accurate event map | Write the bass riff and stabs as motifs. `lowerScore` only accepts rack instruments, so V12 sounds need a bridge (next row) |
| V12 SIGNATURE pack | `packs/v12-signature-v1/`: sixteen PCM16 WAVs, played by the engine's `sampler` and `drumkit` | A small adapter in this lab: take the motif layer's lowered notes (beat, length, MIDI pitch, velocity), write an ordinary engine project with `playbackRate = 2^((pitch - root)/12)`, gates and envelopes. No pack or instrument source is edited. Limits: pitch and length are coupled, REACTOR's range is D1-F#2 |
| Living Bass | `living-bass` in the rack: fold, pm, grind, gear, drive, motion presets, slides | Candidate for the riff at the machine end of its macro; plays motifs directly |
| Existing processing | Engine: `saturation`, `compressor`, high/low-pass, delay, reverb, VO ducking, gain automation. No limiter, no clipper, no sidechain input | Pump by gain automation (the pack's recipe) or by CRUSH's compressor; CRUSH for bass, drum bus and master if approved |
| Lowrider / CRESTLINE | `productions/lowrider-2099/` at commit `2a3208d` (not on this branch): a Blender 4.5.14 `bpy` generator with `build_vehicle`, `build_hover_module`, `build_lowrider_wheel`, `animate_vehicle` (hop and spring tracks), cameras and cue sheets from engine event maps. CRESTLINE v3 is locked by `visual/specs/locks.json` | Reuse the car, wheel and suspension as they are; new cameras and cues only. Blender is not installed in this session; the measured CPU cost there was 7.6 s per frame at 216x384, 8 samples |
| ENM Studio | `mataindustries/enm-studio` `main` holds only Infinite Stairwell | No lowrider assets there. Its agent notes restrict work to that project, so nothing is written to it |

## Licensing flags

- The repository has **no code license** yet.
- V12 SIGNATURE, the rack and MUTATION 001 audio are all **"licensing pending the owner's declaration"**. Anything
  built from them, including these A/B files and a future FABLE, is **audition-only** until that is recorded.
- Every sound is generated from numeric parameters. No third-party samples, presets, recordings or impulse
  responses are used here, and DAEMON//CRUSH copies no plugin.
- FFmpeg and libmp3lame are external tools used for measurement and MP3 encoding; they are not redistributed.

## Not done yet (each waits for approval)

1. FABLE candidates A and B (128 BPM, 8 bars, 15 s) with three-cycle proofs.
2. The 3-second synchronised visual proof, then the 15-second film.
