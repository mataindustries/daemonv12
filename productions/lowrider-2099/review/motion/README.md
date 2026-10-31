# Motion proof (CREST)

| File | What |
|---|---|
| [`crest-motion-proof.mp4`](crest-motion-proof.mp4) | All 600 frames with the locked CREST master. Cycles on CPU at 216×384, 8 samples, denoised, half-frame motion blur, shown 2× |
| [`loop-check.mp4`](loop-check.mp4) | The last 2 s into the first 2 s, twice, with the audio stitched the same way |
| [`contact.jpg`](contact.jpg) | The key moments, labelled |
| [`seam.json`](seam.json) | The loop cut measured against the film's ordinary frame-to-frame change |

This is a proof of timing, motion and transitions, not of the look: the grain and smear come from
8 samples. It took 77 min on 4 CPU cores (7.6 s per frame). Rebuild it with:

```sh
python3.11 blender/angeles2099.py --frames 0-599 --res 216x384 --samples 8 --out-dir proof/
python3 blender/motion_proof.py proof/ review/motion
```

## What passes (every second frame, every shot boundary, the seam; CREST and HOVER)

- **Framing:** the car is in frame on every checked frame; the tightest is S5, 22 % from the edge.
- **Rig:** the rigged arms, struts and springs stay within 80–125 % of their length. On the hop a
  strut reached 133 %; it now has a 12 cm stroke and the module hangs from the body.
- **Clearances:**
  - The modules stay at least 31 mm above the road and 3 mm under the floor (the bump stop).
  - The tyres stay at least 38 mm above the road, and their tops stay under 0.60 m, below the
    hood at 0.82 m.
- **Cameras:** no jumps inside a shot, and no camera inside geometry.
- **Loop seam:** frame 599's camera is frame 0's camera, car-relative: 0.0 m, 0.0°, 24 mm, and
  focus 1.18 m on both sides.
- **The GATE 02 lock:** the vehicle spec, the 16 car-building functions and the CREST master are
  unchanged.

## Visual failures

1. **The loop seam is still a cut.**
   - The framing matches exactly, but the paint flips from night-lit red to golden-hour dark and
     the sky from lavender to peach.
   - The 599 → 0 change is larger than 99 % of the film's frame-to-frame changes (`seam.json`).
     The flash softens it but does not hide it.
2. **S2 frames the car too small.** The car sits in the bottom fifth under a wall of granite. The
   drift reads against the lane lines but is small on a phone, and the upper mountain reads as
   crystalline spikes.
3. **The blimp shadow reads as dimming, not as a blimp.** With the sun 2° up, the shadow is a soft
   band over the lower granite and a darker car, not a silhouette.
4. **The slam unwind (f360–367) is 8 frames of spinning blur** at bumper height. The roll reads
   before and after it, not in the spin.
5. **S6 at night has no city behind the car.** The slide reads (now with a follow-zoom), but
   against dark mountain.
6. **The multiplane depth is subtle.** It reads as haze at the tower bases, not as distinct layers.
7. **The field distortion is below proof resolution.** The pools and contact shadows read; the
   mirage shimmer and ripples need proof-frame size to judge.
8. **"Ah" clips:** at f300 the grille glows near-white instead of violet.
9. **The S3 orbit smears the skyline.** Under half-frame motion blur the orbit is fast enough to
   smear the skyline (visible in SF2).

## The audio seam (the master is locked, reported only)

There is no click: the jump across the seam is 0.002, against a typical sample-to-sample step of
0.017. The master's last 100 ms decays to −22 dBFS before the −9 dBFS downbeat, so a loop has a
~0.1 s breath on the flash.
