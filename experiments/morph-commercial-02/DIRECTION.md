# THE CIRCUIT V2 — creative direction

V1 (Sol, `feat/morph-commercial-01-circuit` at `572caf9`) is preserved untouched. V2 lives here,
on `feat/morph-commercial-02-living-circuit`, branched from that commit.

How this was studied: I inspected decoded frames and measured both films and the soundtrack
numerically (frame differences, kymographs, autocorrelation, onset analysis). I cannot hear
audio or watch video in real time; statements about sound below are measurements or come
from the event map, not listening.

## 1. Why the V12 Overdrive loop is hypnotic

Measured on the supplied 15 s file (1080 × 1920, 60 fps; all films decoded to 270 × 480 grey):

- **One readable machine, many identical units in fixed phase.** Twelve cylinders do the same
  thing offset in time. The eye learns one unit and then enjoys the pattern of repetition.
- **The machine is phase-locked to the tempo.** The soundtrack's onset autocorrelation peaks at
  0.467 s (≈128.6 BPM, 28 frames). In the static opening shot the intake-runner glow repeats every
  56 frames (autocorrelation 0.59), exactly two beats. You can predict the next stroke; the sound
  confirms it. That confirmation is the satisfaction.
- **A continuous carrier under punctuated accents.** Gears, crank and a drifting camera never stop;
  firing flashes land on the beat.
- **Visible causality.** You can see what drives what.
- **Composition travels.** Three distinct views (oblique overhead with timing gears, low side-on
  along the bank, low hero angle) cut at about 4.0, 7.4 and 11.4 s, with continuous motion inside
  each shot. It returns to its opening view, so it loops.
- **It builds and resolves.** Mean luma 19 → 46.5 (at 9 s) → 20.5; motion energy (mean absolute
  adjacent-frame difference) 1.9 → 6.4 → 1.9. The peak is brighter, closer, lower and faster.

## 2. Why V1 is not (measured on the delivered master, same method)

- Motion energy 0.35–1.06 per second against the loop's 1.8–6.4: four to eight times less movement.
- Mean luma 43.2 → 45.3 across the film: no visual crescendo (the loop swings 2.4×).
- Frame 0 and frame 450 correlate at 0.74 (the loop's opening and side shots: 0.40): one framing.
- The camera is a 2.5D plate warp: 3.5 % zoom and ~2 % drift in 7.6 s. V1's method cannot move
  much further without breaking the baked plates, so its subtlety was structural.
- Nothing physically moves. Signals are 1–4 px lines near the frame edges; the die's amber is a
  near-uniform tint. Many small effects, no dominant motion.

**Worth keeping:** the fabricated world (silicon carbide, rose copper, plated gold, nickel), the
processor and its 6 × 8 die, the 56 escape routes in four pin banks, the cyan/amber palette, the
sample-exact synchronisation rule, the hard blackout and the lockup. V2 runs V1's `scene.py`
geometry, materials and lights unchanged (hash-checked) and builds on them.

## 3. Two concepts

### A. THE RING ENGINE (chosen)

V1's 6 × 8 die already contains a machine: its tiles split exactly into three nested closed loops,
**24 + 16 + 8 = 48**. In V2 the tiles are carriers riding those loops, pushed one slot at a time by
linear-motor rails between them, like a watch movement or a sushi conveyor in silicon.

- **Outer loop = the cable's tick clock.** One slot per tick, clockwise: sixteenths (every 7.5
  frames), then thirty-seconds from 5.0 s. This is the dominant visual rhythm, legible even muted.
- **Middle loop = the drums**, counter-clockwise: the syncopated groove (kick on 1, 2e, 4&; the
  half-time snare; toms) visibly argues with the steady clock.
- **Inner loop = the core, carried by the Beast.** Each syllable lifts the core, tilts it open over
  an amber well and turns it: one slot for *ka*, two for *OW*/*YOW*, half a turn for *WOM*.
- **The ratchet winds the clock.** At the SNAP the clock catches; the wind-up ratchets it backwards
  six slots in accelerating clicks; the Unison downbeat releases exactly those six slots. In the
  overwind the ratchet winds it again, faster and faster, until the steps fuse into a spin, just as
  the ratchet repeats fuse into a pitch in the mix. Then the cut. The release never comes.
- **The loops remember.** Every hit writes light into the carrier passing a write gate (cable =
  cyan, drums = white, toms = copper, Beast = amber). The loops carry those marks around, so the
  recent rhythm becomes a rotating pattern, like a delay-line memory. As the music densifies, the
  memory lengthens and the loops fill with light.
- **The board answers.** Slaps fire all 56 routes outward as comets; in the overwind every strike
  draws a pin bank inward instead: the flow reverses while the machine winds.

Why it is hypnotic: rotation is the oldest hypnotic motion; counter-rotating rings keep the eye
from settling; discrete clicks give the satisfaction of a watch movement; the light patterns are
recognisable and slowly changing; mechanical causality is visible (rail flash → carrier moves).
Why it suits CABLE//BEAST: the record is about winding — wind-up, ratchet, overwind, snap. A
stepping mechanism maps its discrete events one to one.

### B. THE TIDE (not chosen)

Replace the die with a dense field of actuated micro-pins (for example 24 × 32) and drive
metachronal lift waves across it, like wind over wheat or a millipede's legs. Each beat launches a
wavefront from the core; the Beast reshapes it (*WOM* a single swell, *ka* a sharp ripple); in the
overload two sources interfere into standing patterns; the overwind spirals into a vortex.

Hypnotic because metachronal and interference patterns are mesmerising and physically strange.
Rejected because: it discards V1's processor, the element most worth keeping; at phone size a wave
of small displacements reads as moving light, which is V1's problem again; waves are continuous,
while this music's defining gestures are discrete mechanical events (clicks, slaps, the snap); and
animating ~800 pins per frame costs more for a less legible result.

### Choice

The Ring Engine wins on clarity (one rotation, readable at any size and muted), feasibility (it
reuses V1's geometry; only rigid tiles move) and rhythmic potential (sixteenths → thirty-seconds →
ratchet spin is a built-in crescendo that matches the score event for event).

## 4. Camera: four shots, cut on the music's section boundaries

Rendering changed to make this possible: every frame is now path traced in Cycles from the real
3D scene (V1 composited three fixed plates), so the camera can move for real, glints travel across
the copper and the carriers' light spills physically. Studio lights are V1's.

| Frames | Music | Shot |
|---|---|---|
| 0–209 | VI. Payoff | **The machine.** High three-quarter view orbiting 28° and pushing in: the loops tick, routes fire. |
| 210–239 | SNAP, Wind-up 3 | **Wind-up macro.** Low along the outer loop's front row; carriers turn the corner and recede as the ratchet winds. |
| 240–359 | Unison, Excitement | **The dial.** Top-down, rotating 46° and slowly pushing in; the release and the WOM swing the loops together on the cut. |
| 360–455 | VII. Overload, Overwind | **The overload.** Low orbit behind the die; the BIG snare slams; from 7.0 s the camera cranes up and drifts in while the clock loop spins up beneath it. |
| 456–479 | CUT | Exact black. |

## 5. Synchronisation (unchanged rule, stricter audit)

The authoritative 44.1 kHz sample of every event (V1's `mapping.json`, unchanged) gives its picture
frame `floor(sample / 735)`. A response starts at the beginning of that frame; the frame is exposed
over its second half (180° shutter) and its light is read at its end. `verify.py` checks, for every
event with a visual role, that its contribution is exactly zero in the previous frame and visible in
its own. The cut is exact black from frame 456. The audio is V1's untouched PCM crop.
