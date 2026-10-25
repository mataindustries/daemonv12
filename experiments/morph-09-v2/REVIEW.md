# MORPH//09 V2 — human creative checkpoint

This is a motion proof, stopped here for review: the full eight seconds at 432 × 768 and 60 fps
with the approved OVERTONE audio, so rhythm, camera and synchronisation can be judged. It is
not the 1080 × 1920 master, which has not been rendered.

I have inspected rendered frames and measured the film; I have not heard it or watched it in
real time. Whether it is beautiful and replayable is the reviewer's call.

## What changed from V1

| | V1 | V2 |
|---|---|---|
| Camera | fixed orthographic, top-down | one unbroken perspective take: a full 360° orbit per loop with crane, dolly, lens and focus moves |
| Construction | flat plate; forks lying on the deck | layered and vertical: commutator drum over a slotted brake disc, five upright forks in a crown, a governor on the arbor |
| Rendering | Eevee, flat backdrop | Cycles path tracing, depth of field, 180° motion blur, a reflection studio for the metals |
| Materials | enamel, satin silver | machined copper with a burnished brush track, brushed titanium, alumina and zirconia ceramics, heat-blued steel, rubies |
| Contacts | brush recoil | brush recoil plus a commutation seam of light that burns continuously while pulses are pitch |
| Rotor speed | annular surrogate swap at high speed | real motion blur of the actual telemetry; a governor that opens with pitch |
| Payoff (6.499 s) | collar closes, lights turn ivory | the xenon strobe freezes rotor, governor and all five forks open while the camera keeps moving |
| Brake | calipers move | calipers clamp; the disc rim and pads glow from the stop as the camera dives onto them |
| Kept | — | every cause-and-effect mapping, the telemetry, the event map, the sync rule, the honest seam audit |

## The take, beat by beat

| Time | Music | Camera | What it shows |
|---|---|---|---|
| 0.0–1.6 s | engage, Am7 | macro at the brush, drifting with the arriving bars | contact sharp, fork 1 soft behind it: each bar strikes, the seam flashes, the fork's coil answers |
| 1.6–4.0 s | shift, Fmaj7 | rises over the brush, passes fork 0 as a foreground wipe, pulls out to the whole crown | the riders slide up all ten tines at 2.0 s; the 3.5 s drag grips the disc |
| 4.0–6.0 s | heavy, Dm7 → E7 | sinks low and slows, longer lens | half-time rotor, wider gaps between gestures; tallest fork rings on the downbeat |
| 6.0–6.499 s | spin-up; fusion at 6.235 | the crane climbs fast past fork 2 and over the crown | the governor opens per octave, the contact seam fuses into a steady line, the rotor smears into a copper ring |
| 6.499–6.763 s | A1 lock | high above the crown, orbiting | strobe: the machine at 55 rev/s appears perfectly still and sharp; forks frozen open; tubes blazing |
| 6.763–7.0 s | brake | dives onto the caliper | warm light and blur return; the rotor drops from 55 to 0.5 rev/s in under 0.2 s; the disc rim glows |
| 7.0–8.0 s | return, Am7 | descends back to the brush | the opening composition, lens and focus, still drifting the same way: the loop restarts without a cut |

## Measured (descriptive; `analyze.py`, both films decoded to 135 × 240 grey)

| Per second | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| V1 motion energy | 3.22 | 3.2 | 3.22 | 3.15 | 1.9 | 1.84 | 1.75 | 3.25 |
| V2 motion energy | 18.73 | 23.87 | 23.79 | 15.47 | 9.55 | 11.57 | 26.51 | 22.8 |
| V1 mean luma | 76 | 76 | 76 | 76 | 76 | 76 | 78.4 | 76 |
| V2 mean luma | 57.8 | 80.7 | 65.6 | 49.1 | 45.8 | 46.2 | 64 | 70.8 |

- Motion energy is the mean absolute difference between adjacent pictures (0–255). V2 moves
  five to fifteen times more than V1, and its shape follows the score: the heavy half-time
  bar (4–6 s) is the calmest stretch, the spin-up, lock and brake (6–7 s) the most active.
- Lowest correlation of any picture with picture 0: V1 0.897, V2 -0.172. V1 never
  leaves its framing; V2 travels all the way round and back.

## Seam verification (`verify.py`, [delivery/v2-audit.json](delivery/v2-audit.json))

- **Camera** (periodic by construction): largest state difference between 0 s and 8 s across
  position, orientation, lens, focus and f-stop 8.9e-16; largest velocity difference
  across the seam 2.2e-05 (finite-difference resolution). One 360° orbit per loop.
  Closest approach to any fork axis 1.02 units.
- **Machine**: 29 non-rotor channels close within 8.1e-08. The raw rotor closes to
  0.0125° (MORPH//07 telemetry, disclosed, not corrected); picture 0's shutter unwraps the
  previous cycle so the rotor never spins backwards inside an exposure.
- **Pictures**: the change from picture 479 to picture 0 is 20.0 (8-bit mean), against a
  median picture-to-picture change of 21.4; it ranks 279 of 480 steps. No blackout,
  no duplicated closing frame ([loop-boundary.jpg](delivery/loop-boundary.jpg)).
- **Audio**: the `.mov` decodes to the approved PCM exactly; the `.mp4` is the AAC viewing copy.
- **Sync**: all 205 events are presented no earlier than their sample (largest delay
  16.395 ms); the strobe covers pictures 390–405, exactly those whose exposure ends in
  [6.499070, 6.762653) s.

## Please judge

1. **The opening.** Does the contact macro read immediately, at phone size, as a bar striking a
   brush with a fork answering behind it?
2. **The lock.** Does the strobe freeze land as the payoff, or does stillness at the loudest
   moment feel like a dropped frame? Is 16 pictures (0.26 s) long enough?
3. **Camera energy.** The climb at 6.0–6.5 s and the dive at 6.8–7.2 s are the fastest moves.
   Thrilling, or too much before the return?
4. **Legibility of the small mechanisms.** Clap jaws, escapement, hoop and reed are real but
   secondary; the camera favours the brush, the forks, the governor and the brake. Is that the
   right hierarchy?

## Known limits of this proof

- 16 samples with denoising: fine grain and some denoiser smoothing in deep defocus. The
  master would raise samples.
- Fork vibration is represented as the smear a 1/120 s exposure records, exaggerated in
  excursion for legibility. Under the strobe the proof shows one flash per picture; a real 60
  fps camera would alias a 55 Hz strobe.
- The raw rotor telemetry closes to within 0.0125° per loop (inherited from MORPH//07, as V1
  disclosed). It is not corrected.
