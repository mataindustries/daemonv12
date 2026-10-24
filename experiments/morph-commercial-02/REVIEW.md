# THE CIRCUIT V2 — human creative checkpoint

> **Outcome:** approved with two finishing changes — remove all typography, and make the
> last second clearer. Both are implemented for the master; see [PRODUCTION.md](PRODUCTION.md).
> This file is the record of the proof review and is otherwise unchanged.

This is a motion proof, stopped here for review. It is the full eight seconds at 432 × 768 and
60 fps with the approved audio, so rhythm and synchronisation can be judged; it is not the
1080 × 1920 master, which has not been rendered.

I have inspected decoded frames and measured the film; I have not heard it or watched it in real
time. Whether it is hypnotic is the reviewer's call.

## The new dominant action

**The ring engine.** The processor's 48 silicon tiles ride three nested closed loops of 24, 16 and
8 carriers, pushed slot by slot by glowing motor rails:

- the **outer loop ticks clockwise with the cable's clock**, one slot per sixteenth, then per
  thirty-second from 5.0 s;
- the **middle loop counter-rotates with the drums**, so the syncopated groove visibly argues
  with the steady clock;
- the **core lifts, tilts open over an amber well and turns** on every Beast syllable (half a turn
  on *WOM*);
- the **ratchet winds the clock backwards**: six accelerating clicks in the wind-up, released on
  the Unison downbeat; in the overwind it winds until the clicks fuse into a spin, and the film cuts
  to black before the release.

Hits write light into the carrier passing a write gate (cable cyan, drums white, toms copper, Beast
amber), and the loops carry those marks around: the rhythm becomes a rotating pattern.

## What changed from V1

| | V1 | V2 |
|---|---|---|
| Dominant action | none: many small light effects | one mechanism: three loops of moving carriers |
| What moves | light only | the carriers, the core, the package (kick), the camera |
| Rendering | three fixed Cycles plates, 2.5D compositing | every frame path traced in 3D (same geometry, materials, lights) |
| Camera | 3.5 % zoom, ~2 % drift, one framing | four shots cut on section boundaries; orbit, macro, rotating top-down dial, crane-and-spiral |
| Processor | amber tints on fixed tiles | the core lifts, opens and turns per syllable; it is the Beast |
| Progression | flat (luma 43 → 45) | sixteenths → thirty-seconds → ratchet spin; memory lengthens and the loops fill with light; route flow reverses in the overwind |
| Board signals | 1–4 px lines | comets on all 56 routes per slap, drawn inward during the overwind |
| Kept | — | V1's scene geometry, materials, studio lights, audio, event map, sync rule, blackout, lockup |

How the five V1 problems are answered:

1. **Camera too subtle** — the plate method limited the move; V2 renders the real scene per frame,
   so the camera orbits, cuts to a macro, rotates over the die and spirals in at the climax.
2. **No dominant rhythm** — the clock loop's tick is a single, large, periodic motion: the motion
   energy of the proof's opening repeats every 7.5 frames, the sixteenth-note grid.
3. **Processor not expressive** — the core is now a mechanism that moves with the voice.
4. **No visual crescendo** — the engine itself accelerates with the score (see DIRECTION.md §3),
   and the camera tightens and spins as the ratchet winds.
5. **Composition static** — four distinct views; no two adjacent shots share an angle.

## Measured (descriptive, `analyze.py`; every film decoded to 270 × 480 grey)

| Per second | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| V1 motion energy | 0.44 | 0.36 | 0.35 | 0.38 | 0.43 | 0.61 | 0.59 | 1.06 |
| V2 motion energy | 6.4 | 7.5 | 7.9 | 12.9 | 14.2 | 25.0 | 19.0 | 35.1 |
| V1 mean luma | 43 | 43 | 44 | 44 | 44 | 45 | 45 | 45 |
| V2 mean luma | 55 | 56 | 55 | 62 | 74 | 78 | 47 | 84 |

- Motion energy is the mean absolute difference between adjacent frames (0–255). The V12 loop
  measures 1.8–6.4 on the same scale. Relative to brightness, V2's opening moves like the
  loop's (0.12 vs 0.10), and its last second is about 1.8× the loop's peak: the overwind is
  deliberately the most intense moment, because the film ends there rather than looping back.
- The frame that correlates least with frame 0 scores 0.04 (V1: 0.74; V12: 0.30).
- The largest single-frame luma steps are the cut at frame 360 (31.7 / 255) and the BIG snare
  flash at 390; the most changed pixels are at the cut at 240.
- [motion-kymographs.png](delivery/motion-kymographs.png) shows the three films as time-strips:
  V1 is flat bands; V2 and the V12 loop show regular tick striations, cuts and camera arcs.

## Please judge

1. Muted, on a phone: is the clock loop's tick the first thing you read? Is the counter-rotation
   of the drum loop legible, or noise?
2. Does the release on the Unison downbeat (4.000 s, the cut to the top-down dial) land?
3. Is the overwind (7.0–7.6 s) thrilling or too busy before the blackout? The camera there was
   already slowed so the loops' spin, not the lens, carries the climax.
4. Colour: written light reads cyan-white on the clock loop and saturated amber in the core.
   Push the cyan's saturation further?
5. A step takes 4.5 of the 7.5 frames between sixteenth ticks, so the clock reads as a pulsing
   conveyor rather than a dry tick-tock. Crisper, shorter steps are a one-line change.
6. The lockup still reads `MORPH // COMMERCIAL 01` (V1's text). Keep, or retitle for V2?

## Not done, by instruction

No full-resolution master, no soundtrack change, nothing published. After approval the master
is `build.sh --width 1080 --samples 16` or more. On this 4-thread CPU the proof took about
7.5 s per frame at 432 × 768 and 12 samples; a 1080 × 1920 master has 6.25 times the pixels,
so expect several hours here, far less on a GPU (an estimate, not measured).

## Production notes

- The bpy 4.3.0 module stood in for V1's Blender 4.3.2 binary (download.blender.org is blocked
  from this machine). V2 runs V1's scene code unchanged, but plates are not compared across
  Blender builds.
- Rendering moving data from a frame handler crashed Blender once (a segfault while syncing an
  object property mid-render). `render.py` now bakes everything into keyframes before rendering;
  the baked scene can be saved with `--save` and rendered or scrubbed in any Blender 4.3.
- A once-per-frame lens key interpolated across cuts inside the shutter and ghosted the cut
  frames; lens and focus are now keyed at the shutter instants. Frames rendered before and after
  that fix were re-rendered from scratch and compared: bit-identical (see VERIFICATION.md).
