# MUTATION 001 · checkpoint

**Branch:** `claude/vigilant-turing-2r0d5f`, based on `main` (`e2962cc`). It is independent of the SODIUM HOURS branch: nothing there was
merged or modified. The only things copied from it are the two toolkit files below, unmodified.

**Frozen files.** Never edit `dsp.ts`, `instruments.ts`, `score.ts`, `deliver.ts`, `living-bass.ts` or `a-living-bass.ts`. A's
manifest records their SHA-256, and the owner approved A after listening. New helpers go in new files (`lanes.ts`). Each mutation
script rewrites only its own section of `auditions/manifest.json` and `auditions/SHA256SUMS`. Check with
`cd mutation-001/auditions && sha256sum -c SHA256SUMS`.

## A · LIVING BASS: done, owner-approved

`tools/living-bass.ts` and `tools/a-living-bass.ts` → `auditions/a-living-bass/a1–a3`. Command: `node mutation-001/tools/a-living-bass.ts`.
Owner feedback: "the warm sound has a beautiful soft side, and the machine transformation has a wicked crunchy bite". Do not regenerate.

```
f90c6ea28a28370712332d1b25a57ff183232485b8f7f612cb6960c00ed9f9eb  a1-living-bass-transformation-dry.wav
bbd59b7e432685e34bdc8a1c628e99feb24b7805c210ed58601441a5fe9661c0  a2-living-bass-transformation-context.wav
1f2b236f9dc88b8a862cc7a35031acf304f2b1f9a3e474479c3e882601a5dab2  a3-living-bass-states-dry.wav
```

## B · IMPOSSIBLE VOICE: done, waiting for the owner to listen

`tools/impossible-voice.ts` (additive source-filter voice and `glassHalo`), `tools/lanes.ts` (`steps`, `shifted`) and
`tools/b-impossible-voice.ts` → `auditions/b-impossible-voice/b1–b3`. Command: `node mutation-001/tools/b-impossible-voice.ts`
(about 21 s). Verified:

- two runs give byte-identical WAV and MP3;
- the engine's `analyze` reports −19.03 / −19.08 / −19.17 LUFS with no clipping;
- the click scan is clean;
- the overtone melody peaks track harmonics 4–5–6.

```
8ac7a4fa993fdfeb7c00b0094ba33db2f46545ab7f380203cf495594cde28855  b1-impossible-voice-transformation-dry.wav
964da2330e51552e5b8d7a70181cbd289d53d9d541cbc8a556c062b609f4a750  b2-impossible-voice-transformation-context.wav
fd7b56954ad3c73543f5e9972625615e83d5bacddd63a55d75c4b16bd1b8dc2d  b3-impossible-voice-states-dry.wav
```

Tuning done before delivery, all measured:

- The halo was raised by about 23 dB; it had been inaudible at −33 to −43 dB re the voices.
- The human-state tilt was brightened, upper formant bandwidths narrowed, and aspiration "air" doubled. The human state had been
  0.1 % above 2 kHz.
- Tails were trimmed so b1 and b2 fit within 30 s.

Open issues: see the README risks list.

## C · MECHANICAL ORCHESTRA: done, waiting for the owner to listen

`tools/mechanical-orchestra.ts` (`malletBar`, `bowedBar`, `spring`, `tine`, `tick`, `barRatios`) and
`tools/c-mechanical-orchestra.ts` → `auditions/c-mechanical-orchestra/c1–c3`. Command:
`node mutation-001/tools/c-mechanical-orchestra.ts` (about 17 s). Verified:

- two runs give byte-identical WAV and MP3;
- the engine's `analyze` reports −19.25 / −19.23 / −19.17 LUFS with no clipping;
- the spring's low harmonics are in tune at morph 0 and 1;
- the click scan is clean on c3; on c1 it flags only six spring pluck attacks.

```
139ca7b832451d4feeef3913b0ca33454e9d59f6aba0005807cfc522e73cb588  c1-mechanical-orchestra-transformation-dry.wav
394cb466e2f85919d5e55942cdd83c0158075a491f9e8c7d0dc4aca98462b267  c2-mechanical-orchestra-transformation-context.wav
6356d4f6b9517b6b67afae1199c0ceab3e9de39637e6905d1c7d0b6df586167b  c3-mechanical-orchestra-states-dry.wav
```

The pre-delivery fixes are listed in the README C section. One note on a measurement that misled me: an autocorrelation pitch probe
read the dispersive spring 36–68 cents sharp. A direct spectrum showed the low partials exactly in tune and only the upper partials
stretched, so the probe, not the instrument, was wrong.

## Status: stopped for human listening

All three mutations are delivered. The draft PR carries every audition. Nothing is merged or published, SODIUM HOURS is untouched,
and licensing is unchanged (pending). Next steps depend on the owner's listening notes for B and C.
