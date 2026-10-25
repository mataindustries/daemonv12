# MORPH//09 V3 — CRITICAL OVERLOAD: effect timing notes

One focused visual-effects pass on the approved V2 proof (`005f02c`). Machine, camera,
choreography, lighting, soundtrack and the 205 synchronised events are V2's, unchanged: V3
imports V2's code (byte-identical, checked by `verify.py`) and adds only effect objects.

## Timeline

Picture `f` is the exposure that closes at `f / 60` s (V2's convention). Event times are from
the OVERTONE event map; speeds from the MORPH//07 rotor telemetry.

| Time (s) | Picture | Cause | V3 effect |
|---|---|---|---|
| 6.000 | 360 | `drive` spin-up | none yet |
| 6.217 | 373 | rotor passes ~2 rev/s on its way to 55 | first arc at the brush |
| 6.235 | 375 | `regime` fusion: pulses become pitch | arcs continue to build (V2's contact seam fuses as before) |
| 6.217–6.483 | 373–389 | rotor 2 → 46 rev/s | 29 arcs: 1 per picture rising to 3; reach downstream 12° → 62°; brighter with speed |
| 6.483 | 389 | last picture before the lock | peak arcing |
| **6.499** | **390–405** | **`voice` A1 lock: strobe** | **nothing added. The freeze is pixel-identical to V2: the arcs stop dead** |
| 6.763 | 406 | `drive` brake | incandescent particles leave both calipers' trailing edges |
| 6.763–6.858 | 406–412 | friction power (clamp × speed^1.5) | 22 particle births (11 per caliper) |
| 6.80 | 408 | brake heat builds | vapor appears over the visible caliper |
| 6.967 | 418 | — | vapor at its peak; the hot pad lights its underside |
| 7.04–7.22 | 422–433 | — | vapor thins and dissipates before the camera's dive passes the caliper |
| 7.031 | 422 | — | last particle cools below visible glow |
| ~7.1 | 426 | camera turns back toward the brush (V2 path) | caliper and plume leave the frame |
| 7.0 / 7.027 | 420 / 422 | `form` return / `regime` separation | unchanged from V2 |
| 7.223 | 434 | — | vapor envelope exactly zero |
| 7.867 | 472 | — | radiant heat light (off-screen) reaches exactly zero |
| 7.867–8.000, 0–6.2 | 472–479, 0–372 | — | no effect: the picture is V2's, pixel for pixel |

## The three effects

**1. Electrical overload (arcs).** Physical cause: as the rotor accelerates through the fusion
regime, commutation can no longer extinguish cleanly; plasma flashes over from the brush's
trailing edge to the riser tabs (the bar terminals) that have just left it. Overload is
`log(speed / 2) / log(55 / 2)`, clamped 0–1, from the actual telemetry speed. It sets how many
arcs per picture (0.45 + 2.6·g^1.25 expected), how far downstream they reach (12° + 50°·g) and
how bright they are. Every arc ends on a riser cheek at that picture's real rotor angle
(`verify.py` checks all 29). Two kinds: bridge arcs that bow up and out across the air gap
(23), and creep arcs along the risers' outer faces (6, only at high overload). Each is a
midpoint-displaced plasma path with 0–2 tapering branches. Look: a thin blue-white core, a
saturated blue halo, the existing restrained glare, and a small blue-white light (11 W at the
peak, local) on the copper. Afterglow: one or two pictures of core, then three pictures of fading
orange (hot copper vapour). No full-screen flash; nothing in strobe pictures.

Where the camera is: from 6.2 to 6.5 s the camera is climbing on the far side of the rotor, so
the brush's contact face is hidden behind the drum. The arcs therefore live where the camera
can see contact geometry: across the gap between the brush top and the riser ring, near
frame centre.

**2. Brake friction (particles).** Born where each caliper's pads release the disc (trailing
edge), at times drawn from the friction power. Launched along the disc's motion at a speed set
by its surface speed (capped at 16 units/s), with outward and upward components, under drag
(3.2 /s) and scaled gravity (30 units/s²). They bounce once off the deck if they reach it. They
cool along a blackbody ramp from 2300 K (τ 0.09–0.20 s); brightness ∝ T⁴. The camera's 180°
shutter turns their flight into short streaks. Only the 198° caliper is in frame; the 54°
caliper's particles are physically present and partly visible.

**3. Thermal vapor.** One plume over the visible caliper. Cycles volume: Gaussian cross-section
widening with height, advected 4D noise for wisps, a front rising at 3.4 units/s, and a lean
along the disc's direction of motion (the rotor's windage). It is lit by the studio, by V2's
glowing disc rim and pads, and by a radiant-heat point light at the hot pad face (orange, energy
∝ V2's brake heat², windowed). Envelope: a function of time since the brake modulo 8 s, rising
over 0.03–0.20 s and decaying to exactly zero by 0.46 s (7.22 s). That timing came from
verification: with the longer life first tried (zero at 7.86 s), the camera's dive at 7.15–7.35 s
passed within one unit of the still-dense plume, which then hung as a grey veil over the
foreground mechanism. The brief puff peaks while the caliper is in frame and is gone before the
dive reaches it. It is zero for 46 pictures before the loop point.

V2's glowing brake rim and pads are unchanged.

## Determinism

Fixed seeds: arcs `909101 + picture`, particles `770301 + 100·caliper + n`. The vapor noise is a
fixed procedural field, a pure function of position and time. `verify.py` regenerates every
event twice and compares SHA-256 digests.

## Seam

No effect is active from picture 472 to picture 372 of the next loop. Pictures 472–479 and
0–2 are therefore V2's pixels, and the 479 → 0 boundary is V2's verified seam unchanged.
`v3-audit.json` records:

- the camera and machine seam (V2's numbers);
- the pixel identity of every rendered quiet picture with V2;
- the measured image seam.
