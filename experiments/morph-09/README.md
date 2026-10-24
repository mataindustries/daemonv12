# MORPH//09 — THE MACHINE THAT MAKES MUSIC

**OVERTONE, performed by a fictional precision electromagnetic instrument.** A sixteen-contact copper rotor passes one fixed ceramic brush at twelve o’clock. Selected contacts excite one of five tuned metal forks in a crown above it. The brush recoils, the selected fork bends, and light remains attached to the ringing metal. This repeated gesture is the visual identity of the loop.

The instrument combines dark enamel, graphite, satin silver and warm copper. A fixed camera keeps the whole mechanism legible at phone size. Its final transformation comes from the same rotor accelerating until separate contacts fuse into a continuous ring, then becoming a readable rhythm again under controlled braking.

Source repository: `mataindustries/daemonv12`. Source branch: `feat/morph-08-motor-groove`, verified at `dd705942faec535433b3b030c990e247261ce905`. Work branch: `feat/morph-09-resonant-rotor`. The approved music, motor score, telemetry and DaemonV12 engine remain unchanged. This is an eight-second motion-design proof awaiting human creative approval.

| Musical cause | Mechanical response |
|---|---|
| Motor contact impacts | The fixed brush recoils on exported `commutator` impacts. Separate `tines` events select a fork through `source.tine`. |
| Percussion | Kick compresses the axial rotor suspension, clap closes the side jaws, and hats flick the smaller escapement fingers. |
| Bass accents | The outer tension hoop contracts and returns elastically. |
| Sung melody | A separate silver reed arch below the rotor bows and tilts, with a longer response than the contacts. |
| Harmonic transitions | Five tuning clamps slide according to the event’s tine frequencies and glide time. |
| Final rotor pitch lock | The central collar closes and the five fork lights converge to warm ivory. |

| Time | Choreography |
|---|---|
| 0–2 s | Establish the brush–rotor–fork relationship immediately in Am7. Swung contacts produce short mechanical answers beneath the sung hook. |
| 2–4 s | Repeat the gesture over Fmaj7. Tuning clamps move together; the scored load at 3.5 s visibly grips the mechanism before release at 3.75 s. |
| 4–6 s | The actual rotor slows into the heavier pattern. The same mechanism has more space between gestures, while the clamps move through Dm7 and E7. |
| 6–8 s | Accelerate into contact fusion, converge at the A1 lock, brake, and recover the opening Am7 mechanism. The final second remains illuminated and active. |

Continuous rotor position and speed come from [`hypnotic-motor.telemetry.json`](../morph-07/candidates/hypnotic-motor.telemetry.json). Cubic Hermite interpolation preserves its 480 angle and velocity samples. The [`OVERTONE event map`](../morph-08/candidates/overtone.events.json) supplies the musical onsets at their authoritative sample frames, with no audio analysis or music retiming. It contains 52 exported contact impacts and 30 selected tine strikes; these are separate tracks, and the exported impacts do not enumerate every physical crossing during high-speed rotation. Event envelopes include the preceding cycle’s tails so lighting and vibration are already alive at the opening. At high speed, an annular surrogate replaces the repeated rotor features; this is a lightweight exposure approximation, not a temporally sampled motion-blur render.

The final sequence follows the source events precisely: fusion at **6.235261 s**, A1 harmonic lock at **6.499070 s**, braking at **6.762653 s**, Am7 return at **7.000000 s**, and separation back into rhythm at **7.026803 s**. At 60 fps, an onset first becomes eligible for display at `ceil(sampleFrame / 735)`; this introduces less than one picture frame of presentation delay and never triggers an event early. This timing audit does not measure per-pixel visibility, and structural events do not each receive a separate visual impulse. The event map’s floor `pictureFrame` is retained as evidence, not used to anticipate an onset.

Loop closure is measured against the physical endpoint, not inferred from a modulo reset. The unmodified full-precision motor travels 27.000034963 revolutions: its orientation differs by **0.0125866°** and its endpoint speed by **0.0718%**. The renderer’s rounded opening telemetry gives a **0.0124887°** angular residual. The conservative geometric edge displacement at the proof resolution is 0.022 pixels. These tiny source mismatches are disclosed rather than corrected. Sixteen identical contacts and spokes carry no unique angular marker. The surrounding vibration, clamp and light responses are periodic, and the opening has no blackout. This is near-continuous physical rotor closure, not mathematically exact source closure.

Open the [local creative review](review/index.html). The package contains a **384 × 480, 60 fps, eight-second motion proof** and three **768 × 960** stills. `review/overtone-proof.mov` is the reference container for the original PCM audio; `review/overtone-preview.mp4` is the convenient AAC viewing copy. The package also includes `contact-sheet.png`, `sync-timeline.png`, `sync-audit.csv`, `loop-audit.json` and a local `index.html`. Treat the generated audit’s rendered-media section as the authority for actual duration, frame count and decoded audio equality. `review/resonant-rotor.blend` contains 480 editable animation frames and the approved WAV packed byte-for-byte; `native-audit.json` records its independent checks.

The scene and responses are reproducible with Blender 4.3, FFmpeg and Python (NumPy, Pillow and Matplotlib). Eevee needs a working graphics context; this environment uses Mesa software rendering with a local Xvfb display. Cycles is an available slower fallback. The modeled source can be baked into editable 60 fps keyframes with `--mode bake`.

```sh
blender -b -P experiments/morph-09/render.py -- \
  --mode preview --engine eevee --width 384 --height 480 --samples 16 \
  --out work/morph-09/previews

blender -b -P experiments/morph-09/render.py -- \
  --mode motion --engine eevee --width 384 --height 480 --samples 4 \
  --out work/morph-09/motion-final

blender -b -P experiments/morph-09/render.py -- \
  --mode stills --engine eevee --width 768 --height 960 --samples 64 \
  --out work/morph-09/stills

blender -b experiments/morph-09/review/resonant-rotor.blend -P experiments/morph-09/audit-native.py
python3 experiments/morph-09/package-review.py
python3 experiments/morph-09/verify.py --out work/morph-09/audit
# After muxing the reference proof, also supply --proof PATH/TO/overtone-proof.mov.
```

[`state.py`](state.py) defines the deterministic responses; [`render.py`](render.py) builds and evaluates the instrument; [`verify.py`](verify.py) records source hashes, contact alignment, event presentation and seam measurements. [`audit-source.mjs`](audit-source.mjs) derives the unmodified motor’s full-precision endpoint for the independent boundary check. No full-resolution master or publication is part of this experiment. Creative review should decide whether the repeating contact gesture is clear, the slower third bar feels heavier, and the final convergence earns another viewing.
