# Motion proof (CREST)

| File | What |
|---|---|
| [`crest-motion-proof.mp4`](crest-motion-proof.mp4) | All 600 frames with the locked CREST master. Cycles on CPU at 216×384, 8 samples, denoised, half-frame motion blur, shown 2× |
| [`loop-check.mp4`](loop-check.mp4) | The last 2 s into the first 2 s, twice, with the audio stitched the same way |
| `compare-*.jpg` | Before and after for each fix in the polish pass: [seam](compare-seam.jpg), [S2 drift](compare-s2-drift.jpg), [S6 skyline](compare-s6-skyline.jpg), [Mouth Drop](compare-mouth-drop.jpg), [opening](compare-opening.jpg) |
| [`seam-before-after.json`](seam-before-after.json), [`seam.json`](seam.json) | The loop cut, measured on the rendered frames |
| [`contact.jpg`](contact.jpg) | The key moments, labelled |

This is a proof of timing, motion and transitions, not of the look: the grain and smear come from
8 samples. Only the changed ranges were re-rendered in the polish pass:
- 0–259, 300–383 and 480–599, which is 464 of the 600 frames;
- about 66 min of CPU in all (8.9 s per frame mean over the first two ranges, 3.9 s per frame
  for S6);
- no GPU.

```sh
python3.11 blender/angeles2099.py --frames 0-259,300-383,480-599 --res 216x384 --samples 8 --out-dir proof/
python3 blender/motion_proof.py proof/ review/motion
```

## The polish pass: what changed

### 1. The loop seam: hidden by occlusion, not a flash

- **The cut:** frames 599 and 0 are both under the car at road level, looking at the rear-right
  maglev module and the wheel. The body hides the sky and the sun.
- **Matched light:** the underglow swells on both sides, and the emitters and field footprints
  settle to their frame-0 values. Exposure is equal (0.8) on both sides.
- **Measured on the rendered frames:**
  - The 599 → 0 change dropped from 53.7 to 22.0 (mean absolute RGB difference, 0–255).
  - That is now smaller than the largest frame-to-frame changes of the fly-in and glide around
    it (52.5).
  - Across the film it moved from the 99th to the 96th percentile of all frame-to-frame changes.
- **Camera:** the scene check finds 0.0 m, 0.0°, 24 mm and matching focus on both sides.

### 2. S2: the drift reads

The camera sits 2.2 m up and close, in the road's frame, looking down onto the lane lines. The car
fills most of the frame. The body lean in drifts was raised from 1° to 2.6° (at the 12° drift)
because 1° could not be seen on a phone. That is the only motion parameter changed; the hover
rig is untouched.

### 3. S6: the skyline and an airship behind the slide

S6 is now a telephoto tracking shot on the line from the skyline through the car, 34 m out and low.
Its height is solved for terrain and line of sight, then smoothed. The megatowers stay behind the
car for the whole slide. One airship was added on that sightline, 4.5 km out; it exists only in S6,
so it cannot appear in shots rendered without it. The car is unchanged.

### 4. The Mouth Drop: the roll ends in the dark; the slam pays off

- **The roll:** it completes to 360° inside the black (f345–356), so the reversed breath shows a
  level grille.
- **The slam:** f360 opens level and readable, at bumper height behind the car, as the body drops
  onto the modules and the road leads to the skyline.
- **The white "grille glow" was not the grille.**
  - Two lights caused it: the headlamps at 25, and the 2600 W rim light mirrored in the flat
    candy front.
  - The v3 grille has no glow material, so the old grille keys did nothing.
  - The rim light now dims to 12 % for the shot. The headlamps are the mouth's eyes: unclipped on
    "ah", closing through "oo", shut on "mm".

### 5. The opening second

The film starts under the machine: the module and the tiny wheel spinning in mid-air over its
rippling field. By frame 24 (one second) the camera is at road level behind the wheel, and the 8 cm
gap under the tyre is lit from behind.

## What passes (CREST and HOVER, every second frame, every shot boundary, the seam)

- **Framing:** the car (body or a corner) is in frame on every checked frame.
- **Rig:** the rigged arms, struts and springs stay within 80–125 % of their length.
- **Clearances:** the modules stay above the road and under the floor; the tyres clear the road and
  stay inside the body.
- **Cameras:** no jumps inside a shot (now measured correctly; cameras are keyed as quaternions,
  because Euler keys flipped mid-roll and motion blur would have smeared through the flip), and no
  camera inside geometry.
- **Loop seam:** frame 599's camera is frame 0's.
- **The GATE 02 lock:** CRESTLINE v3 and the CREST master are unchanged.

## Visual failures (revised)

Fixed in this pass: the seam's colour pop, S2's small car, S6's missing city, the Mouth Drop's
spinning slam and white grille, and the slow opening.

Still open:

1. **The seam's residual.** The hardware matches across the cut, but a strip of the world behind
   the tyre goes from night to warm golden hour. It reads as light coming up as the camera emerges,
   but a careful viewer can see the change.
2. **The first half-second is dark.** It has to be: frame 0 matches the dark under-car frame 599.
   The hovering wheel reads from about frame 12.
3. **The blimp shadow reads as dimming, not as a blimp.** The sun is 2° up. This pass did not
   address it.
4. **The multiplane depth is subtle.** It reads as haze at the tower bases. Not addressed.
5. **The field shimmer is below proof resolution.** Judge it in the GPU proof frames.
6. **The S3 orbit's motion blur smears the skyline** (SF2). Not addressed.
7. **S2's upper frame still shows the cracked-plate granite,** though much less of it.

## The audio seam (the master is locked, reported only)

There is no click: the jump across the seam is 0.002, against a typical sample-to-sample step of
0.017. The last 100 ms decays to −22 dBFS before the −9 dBFS downbeat, a ~0.1 s breath that now
falls as the camera dives under the car.
