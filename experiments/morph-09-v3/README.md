# MORPH//09 V3 — CRITICAL OVERLOAD

Status: **effects proof, stopped for human approval.** Eight seconds at 432 × 768, 60 fps, with
the approved OVERTONE audio. No 1080 × 1920 master. Nothing published.

One focused visual-effects upgrade to the approved V2 proof (`005f02c`, branch
`feat/morph-09-v2-inside-the-resonator`). V3 lives here, on
`feat/morph-09-v3-critical-overload`. It is branched from V2's head `ad202aa`: the approved
proof plus playback-link documentation only.

In the final two seconds the instrument reaches its physical limits:

- **Electrical overload:** plasma arcs between the brush and the riser tabs as the rotor
  accelerates, from 6.217 s to the A1 lock.
- **Brake friction:** incandescent particles from the calipers, from the brake at 6.763 s.
- **Thermal vapor:** one plume over the hot caliper.

The harmonic-lock freeze (6.499–6.763 s) is left exactly as V2 rendered it: the arcs stop dead
at the lock, so the stillness reads as impossible precision amid rising instability.

Timing, physical models and seam: [EFFECTS.md](EFFECTS.md).

## Unchanged

Machine, camera path, lens, focus, choreography, V2's lighting and glowing brake rim, soundtrack,
the 205 synchronised events, the sync rule and the 0–8 s camera and machine continuity. V3 runs
V2's `choreography.py`, `scene.py` and `render.py` byte-identical to the approved proof
(hash-checked) and adds effect objects only. Outside pictures 373–471 every addition is
hidden, and the picture is V2's, pixel for pixel. `verify.py` renders and compares.

## Delivery

**Android playback.** Raw links (public repository, pinned to delivery commit `61a93b0`, verified by
download in [`delivery/retrieval-verification.json`](delivery/retrieval-verification.json); on
Android the raw link downloads the file, which any video player opens):

- V3 proof MP4: https://raw.githubusercontent.com/mataindustries/daemonv12/61a93b06538dee3d9c0e34d8f813327a42f8d7e2/experiments/morph-09-v3/delivery/morph-09-v3-critical-overload.mp4
- V2 vs V3, 6–8 s: https://raw.githubusercontent.com/mataindustries/daemonv12/61a93b06538dee3d9c0e34d8f813327a42f8d7e2/experiments/morph-09-v3/delivery/v2-vs-v3-6-8s.mp4
- PCM reference MOV: https://raw.githubusercontent.com/mataindustries/daemonv12/61a93b06538dee3d9c0e34d8f813327a42f8d7e2/experiments/morph-09-v3/delivery/morph-09-v3-critical-overload.mov
- Comparison sheet: https://raw.githubusercontent.com/mataindustries/daemonv12/61a93b06538dee3d9c0e34d8f813327a42f8d7e2/experiments/morph-09-v3/delivery/v2-v3-comparison.jpg


- `delivery/morph-09-v3-critical-overload.mp4`: H.264 + AAC, for phones.
- `delivery/morph-09-v3-critical-overload.mov`: H.264 + the approved PCM, sample for sample.
- `delivery/v2-vs-v3-6-8s.mp4`: V2 and V3 side by side, 6.0–8.0 s, with audio.
- `delivery/vfx-preview-6-8s.mp4`: the first lightweight preview (288 × 512). Later changes are
  in the proof, not in this preview: stronger particles and vapor, the heat light moved under
  the plume, and the shorter vapor life that verification required (see EFFECTS.md).
- `delivery/v2-v3-comparison.jpg`: V2 above V3 at 6.25, 6.48, 6.80, 6.97, 7.10 and 7.50 s.
- `delivery/effect-detail.jpg`: each effect at 2×, V2 beside V3.
- `delivery/contact-sheet.jpg`, `delivery/loop-boundary.jpg`.
- `delivery/v3-audit.json`: verification. `delivery/v3-audit-identity-0-240.json` records the
  identity re-renders of pictures 0 and 240.
- `delivery/picture-sources.txt`: which pictures were rendered from the V3 scene.
- `delivery/SHA256SUMS`.

## Build

Needs the same tools as V2: the `bpy==4.3.0` module or a Blender 4.3 binary, FFmpeg, NumPy,
Pillow and Matplotlib.

```bash
experiments/morph-09-v3/build.sh
```

The script runs these steps:

1. Build V2's scene.
2. Add the effects.
3. Render the 6–8 s preview at 288 × 512.
4. Render pictures 372–479 at proof settings: 432 × 768, 16 samples, OpenImageDenoise, 180°
   motion blur.
5. Re-render quiet pictures 0 and 240 as identity checks.
6. Finish and verify.

The V2 frames it reuses come from `experiments/morph-09-v2/build.sh`.
