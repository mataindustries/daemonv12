# MORPH//COMMERCIAL 01 — THE CIRCUIT

One eight-second, vertical audiovisual proof. Source: MORPH//06 Overload B at
`2b6e533a021218d6940a8da5a7032c2abe58a3d9`. Feature branch:
`feat/morph-commercial-01-circuit`. All new files are inside this experiment.

The scene is an original, fictional neuromorphic circuit fabricated from dark silicon
carbide, copper, plated contacts and tiled silicon. One restrained oblique macro move
reveals the processor and connected route network. There are no stock images,
third-party music, waveform displays or particle fields.

## Build

Dependencies: Blender 4.3.2 (Cycles CPU), FFmpeg 7.1 with libx264/AAC, Python 3.12.14,
NumPy 2.3.5 and Pillow 12.3.0 (tested on Linux). The editorial text uses the
installed DejaVu Sans font; another font/runtime can change raster bytes. No game engine, browser renderer or network service is needed.
The supplied plates avoid repeating the relatively expensive lighting pass.

From the repository root:

```bash
experiments/morph-commercial-01/build.sh
```

For a short animation proof only:

```bash
experiments/morph-commercial-01/build.sh --proof-only
```

To reuse existing `work/board.png`, `work/core.png`, `work/foreground.png` and
`work/scene.json`:

```bash
experiments/morph-commercial-01/build.sh --reuse-plates
```

The proof is 360 × 640, 30 fps, 3.6 seconds: three continuous windows from the opening,
call/response and overload, retaining their matching PCM audio. It is a review montage,
not the eight-second master. The master uses the identical geometry plates and frame
function, at 1080 × 1920 and 60 fps. The full master is rendered only after that proof.

Standalone package: run `./build.sh --reuse-plates` in the extracted directory.
It checks the included reference's hash when the original repository is unavailable.
Full source/crop verification requires the source repository at the stated commit.

## Files

- `scene.py`: procedural original Blender geometry, physically based materials and
  fixed studio lighting; three photographic planes and calibrated route coordinates.
- `render.py`: deterministic frame generation, small projective camera move, height
  parallax, macro focus finishing, optical emission, frame-interval event evaluation.
- `prepare.py`: exact PCM24 byte crop and event-map remapping. No audio processing.
- `mapping.json`: all 361 excerpt source events; selected events, exclusions, coalescing,
  source and relative sample indices, picture-frame buckets and system routing.
- `verify.py`: independent sample, event, stream, blackout, scope and determinism checks.
- `audio/circuit-reference.wav`: uncompressed 24-bit stereo, 44.1 kHz, 352,800 frames.
- `products/the-circuit.mp4`: H.264/AAC playback master, 480 frames, eight seconds.
- `products/circuit-motion-proof.mp4`: short low-resolution animation review.
- `products/frame-*.png`: representative full-resolution frames.
- `VERIFICATION.md`: measured technical report for this completed proof.
- `products/verification.md` and `.json`: full measured technical results.
- `products/animation-audit.json`: each selected onset and deterministic frame hashes.
- `products/circuit-review-package.zip`: self-contained review files, source and
  reusable lighting plates; `products/MANIFEST.json` records their hashes.

## Synchronization

The original B event map supplies authoritative 44.1 kHz sample indices. The visual
excerpt subtracts exactly 882,000 samples (20.000 seconds), and picture frame `f`
covers samples `[735f,735(f+1))`. Events activate in the containing frame using integer
floor division, including events between nominal frame timestamps. Cable attacks launch
cyan surges along the copper; kick pulses the processor frame; snare lights separate
contact banks; Beast syllables open amber die apertures for their scored durations;
ratchets and percussion split connected routes with increasing travel speed. Quiet or
nearby hits are deliberately omitted or coalesced, with the original rows preserved in
the map. All image layers and text cut to black at sample 335,160 / frame 456, exactly
matching source 27.600 seconds, and remain black for the last 24 frames. The WAV is the
untouched byte slice; AAC is only the playback encoding.

## Rendering method and limits

This is a deterministic 2.5D production proof, not a new real-time 3D engine. Cycles
renders actual geometry into three static physical-lighting planes. The compositor
adds a small projective dolly, differential height parallax, focus falloff and localized
routed emission. Reflections and shadows are baked; emission spill and tile apertures
are composited rather than dynamically path traced. Camera motion is kept small enough
to preserve the plate geometry. Repeated frames are bit-identical from the same plates
and runtime; cross-version Blender/FFmpeg bit identity is not promised. The portrait
composition is the delivered master; a landscape variation would need its own framing.

No video publication or source-engine / earlier-score changes are part of this proof.
