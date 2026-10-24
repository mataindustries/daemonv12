# MORPH//09 V2 — INSIDE THE RESONATOR: creative direction

V1 (Sol, `feat/morph-09-resonant-rotor` at `4ad6905`) is preserved untouched in
`experiments/morph-09/`. V2 is built separately here, on
`feat/morph-09-v2-inside-the-resonator`, branched from that exact commit.

How this was studied: I read V1's scene, state and audit code, inspected its stills and
contact sheet, and read the OVERTONE event map and MORPH//07 telemetry row by row. I cannot
hear audio or watch video in real time; statements about sound below come from the event map
and telemetry, not listening.

## 1. What V1 got right, and why it reads as "basic"

**Worth keeping.** V1's mechanism is sound. Every musical part has its own mechanical answer:

| Musical cause | V1 mechanism | V2 |
|---|---|---|
| Motor contacts (`commutator`) | the fixed brush recoils | kept, plus a commutation glow at the brush's leading edge |
| Selected tine strikes (`tines`, `source.tine`) | that fork bends and lights | kept: the fork's drive coil pulses, its tines ring |
| Kick | axial rotor suspension compresses | kept |
| Clap | side jaws close | kept |
| Hats | escapement fingers flick | became a real anchor escapement that ticks *tock* on alternate hats |
| Bass | outer tension hoop contracts | kept |
| Vox | silver reed arch bows and tilts by note | kept |
| Harmony (`tineHz`, `glideMs`) | tuning clamps slide | kept: brass riders slide along every tine |
| Load / brake | brake calipers close | kept, on a slotted brake disc; the pads heat after the stop |
| Pitch lock at 6.499 s | collar closes, lights converge | replaced by the stroboscopic lock (section 4) |

Also kept: the actual MORPH//07 rotor telemetry (V1's Hermite interpolation, imported
unchanged), the event envelopes with previous-cycle tails, `ceil(sample / 735)` presentation,
and V1's honesty about the 0.0126° raw rotor seam residual.

**Why it reads as basic.**

- **One fixed orthographic, top-down camera.** Orthographic projection removes depth cues
  entirely; the machine is a flat plate seen like a product render. Nothing passes in front
  of anything; there is no parallax, no scale and no discovery.
- **Everything lives in one plane.** Forks lie flat on the deck, so their bending is a
  sideways wiggle of a few pixels at phone size. Most of the visible change is therefore
  light, not motion.
- **The payoff is a colour change.** At the A1 lock the collar scales and five lights turn
  ivory. The machine does not *do* anything you would remember.
- **Materials read as enamel and plastic**: rasterised Eevee, flat backdrop, no environment
  for the metals to reflect.

## 2. The machine, rebuilt for a camera that goes inside it

The cause-and-effect map is unchanged; the construction is made vertical and layered, so a
perspective camera can move between its parts.

- **Commutator drum** (the hero): sixteen machined copper bars around a mica core, a burnished
  brush track worn into their faces, slotted risers with round armature wires soldered in.
  Underneath, a slotted titanium brake disc whose 24 windows make speed legible until they smear.
- **Brush**: a copper-graphite block bedded to the drum radius, held in an alumina holder with
  brass rails and a blued constant-force spring. Each exported contact impact lights a thin
  commutation seam at its leading edge and a warm pool on the copper.
- **Five tuning forks standing upright in a pentagonal crown** around the rotor, graded by pitch
  (tine length ∝ 1/√f; 110 Hz stands 1.9× the 385 Hz fork). Each stands on an alumina
  pedestal with a copper drive coil on its stem, brass tuning riders and a xenon tube facing
  the rotor. They tower over the drum, so the camera can travel among them.
- **Spring governor** on the arbor: three polished flyweights that swing out with rotor speed.
  Its spring is wound to read pitch, with equal extension per octave from 3 rev/s (the fusion
  regime) to 55 rev/s (A1). It turns the spin-up into a shape change you can see even when the
  rotor itself is a blur.
- Watch-scale finishing: gunmetal deck with circular graining, chapter ring, black zirconia
  plinth, heat-blued screws, ruby cap jewel and pallet stones.
- **Rendering**: every frame path-traced in Cycles with real perspective, depth of field and
  180° motion blur. The world is dark to the camera but gives the metals a soft studio to
  reflect, so copper, titanium and steel read as metal at phone size.

## 3. Two camera approaches

### A. ONE REVOLUTION (chosen)

One unbroken take. The camera circles the instrument exactly once per loop, counter-clockwise,
the rotor's own direction, while the rotor turns 27 times. It never rides the rotor; it is a
slow, separate orbit whose radius, height, lens and focus breathe with the music's sections.

- 0–2 s: an extreme close-up of the contact under the brush, with fork 1 standing out of focus
  directly behind it: cause sharp, effect soft. The camera drifts alongside the arriving bars,
  then rises over the brush.
- 2–4 s: it climbs and pulls out, and the fork crown assembles around the rotor; at 4.0 s the
  whole resonator is in frame.
- 4–6 s: the heavy half-time bar. The camera sinks low, lengthens its lens and slows.
- 6.0–6.5 s: the rotor spins up; the crane climbs fast past fork 2 while the governor opens.
- 6.499 s: the strobe fires; the camera, high above the crown, orbits the frozen instant.
- 6.763–8 s: the brake. The camera dives over the crown and descends back to the brush,
  arriving in its opening position, lens and focus, still moving the same way.

Why it is strong: perspective and parallax give scale; the orbit keeps the parts sliding past
each other, so the eye is always discovering; one continuous take makes the loop a single
breath instead of an edit; and the return is physical, not a cut.

### B. THE AXIAL DIVE (not chosen)

A vertical move on the rotor's axis: start on the contacts, crane straight up the arbor to a
top-down mandala of the crown, then dive down through the open governor into the drum and
re-emerge at the brush.

Rejected: a mostly top-down camera repeats V1's flatness for half the film; looking down an
axis gives little parallax, so the fork crown reads as a pattern rather than a machine; and the
climb-and-dive has only one direction of travel, which makes a seamless return hard without an
obvious reversal. It also keeps the contact and the forks in separate shots for too long.

### Choice

A keeps every cause and effect in shared frames, gives the most depth and discovery, and closes
the loop by construction: an orbit that has turned once is back where it began.

## 4. The harmonic lock: a stroboscopic freeze

At 6.499 s the rotor reaches 55 rev/s: the source pitch A1. The five forks are tuned to the
A overtone series 2 : 3 : 4 : 5 : 7 (110, 165, 220, 275, 385 Hz), all exact multiples of the
rotor's 55 Hz. In V2 the governor reaches its stop at that speed and arms the instrument's
xenon tubes, which fire once per revolution, on contact 0. A strobe at the rotor's own frequency
stops the rotor, and because every fork rings at an integer multiple of 55 Hz, each flash also
catches every fork at the same phase. So the loudest, fastest moment of the film appears
perfectly still: rotor sharp, flyweights out, all five forks frozen open, five tubes blazing
cold white. The camera keeps moving through that instant, which reveals it in depth.

The brake event at 6.763 s opens the strobe circuit: warm continuous light, motion blur and the
violent deceleration return together, and the pads glow from the stop.

Representation notes (honest): a real 60 fps camera would alias a 55 Hz strobe; the proof shows
one flash per picture. The forks' ring at 110–385 Hz completes about 0.9–3.2 cycles per
exposure, so outside the strobe each fork records as a smear across its full excursion; the
excursion is exaggerated for legibility.

## 5. Synchronisation and seam

Unchanged rule: an event at sample `n` is first eligible in picture `ceil(n / 735)`. V2's
180° shutter closes at the picture's time, so no response appears before its sample. The
strobe window covers the 16 pictures whose exposure ends in [6.499070, 6.762653) s.

The camera is a periodic C1 interpolation (periodic Fritsch–Carlson, with the mean orbit rate
removed before interpolation): position, orientation, lens, focus and f-stop are identical at
0 and 8 s and their velocities match. The machine seam is measured separately, as V1 did.
