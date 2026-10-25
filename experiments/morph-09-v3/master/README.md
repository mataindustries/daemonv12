# MORPH//09 V3 — 1080 × 1920 master production

This is a separate production pipeline from the approved proof. It starts from
`9e8a03d2b5bfed15f8056970ca3b4cdb1c2cfbc7` on
`prod/morph-09-v3-1080p-master`. All earlier experiments, creative code and proof
deliverables remain unchanged. Raw renders and working files live under
`work/morph-09-v3-master`, outside Git history.

The target is 480 pictures at 60 fps, exactly eight seconds, rendered directly at
1080 × 1920 with Cycles and the original OVERTONE soundtrack. Nothing in this
pipeline publishes video or provisions compute.

## Runtime and preparation

Use the matching `bpy==4.3.0` module with OpenImageDenoise, Python 3.11, NumPy,
Pillow, Matplotlib and FFmpeg with libx264/AAC. A Blender 4.3.0 binary with those
features can also be selected with `BLENDER`. Some distribution Blender builds
omit OpenImageDenoise and cannot reproduce the approved rendering settings.

From the repository root:

```bash
export BLENDER_PY=/workspace/work/bpyenv/bin/python
export PYTHON="$BLENDER_PY"
bash experiments/morph-09-v3/master/build.sh --prepare
```

Preparation checks `source-hashes.json`, executes the unchanged V2 and V3 scene
builders, then records the resulting scene and metadata hashes. Rendering rejects
stale scenes, changed creative inputs and a different Blender version.

## Sampling decision

`config.json` starts with a **provisional** sample count. Do representative
full-resolution comparisons before setting `samplingStatus` to `selected` and
writing the reason in `samplingDecision`. The renderer refuses an ordinary
production render while sampling is provisional.

For example, compare the same pictures in separate output directories:

```bash
"$BLENDER_PY" experiments/morph-09-v3/master/render.py \
  --frames 0,24,242,373,389,396,406,418,433,450,479 \
  --samples 32 --allow-provisional --out work/morph-09-v3-master/pilot32
"$BLENDER_PY" experiments/morph-09-v3/master/render.py \
  --frames 24,389,418 --samples 64 --allow-provisional \
  --out work/morph-09-v3-master/pilot64
```

These are real 1080 × 1920 renders. The width is never derived from the proof,
and there is no image upscaling step. Check copper, ceramic, optical focus and
motion blur, arcs, the unchanged strobe, sparks/vapor, return and phone-size
clarity. Record measured render times and available quotas before scheduling the
full run. Existing local compute is used; paid compute needs explicit approval.

## Recoverable rendering

After selecting samples:

```bash
bash experiments/morph-09-v3/master/build.sh --render --resume
```

The default is sixteen sequential batches of 30 pictures, each with a separate log.
A single batch can be run or recovered independently:

```bash
bash experiments/morph-09-v3/master/build.sh --render --frames 180-209 --resume
```

Use one process per output directory. Every invocation bakes the complete
480-picture timeline before rendering the requested subset. This preserves
interpolation, quaternion continuity and constant light/visibility keys at batch
boundaries and in independent single-picture checks.

V2 renders pictures 0–372, 390–405 and 472–479. V3 renders 373–389 and 406–471,
including the residual approved heat light after the visible vapor ends. The
renderer checks these windows against the unchanged effect functions. V2 and V3
must have identical production render settings. Camera, mechanical animation,
180° END shutter, OIDN, lighting, color management, materials and VFX timing are
inherited from the approved code. Only resolution and the documented sample
selection affect image quality.

Each PNG is written through a partial file and gets an adjacent JSON record with
picture index, scene backend, full-resolution dimensions, samples, source and
settings hashes, Blender version, batch ID, elapsed time, file SHA-256 and decoded
RGB8 pixel SHA-256. `--resume` decodes and verifies these records; a proof frame,
unrecorded PNG, altered file or incompatible settings is rejected. An interrupted
completed partial frame can be recovered after verifying its hashes.

The aggregate `render-manifest.json` is regenerated from the individual records.
No raw frames are committed to Git.

## Finishing and verification

```bash
bash experiments/morph-09-v3/master/build.sh --finalize
```

Finalization independently re-renders representative pictures and both sides of
each recorded batch boundary. Quiet V3 control pictures are compared with the V2
master to check that hidden effects do not alter the image. It then applies
V2’s unchanged `grade()` finish, writes an H.264/AAC Android MP4 and an H.264/PCM
MOV reference, and runs the strict master verifier.

The verifier requires 480 correctly ordered full-resolution raw and graded
pictures, 60 fps/eight-second media, unchanged original PCM in the MOV, all 205
events, approved effect windows and procedural determinism, picture/camera seam
evidence, identical selected re-renders and batch controls, consistent settings,
and successful container decoding. It writes verification reports and checksums
only for checks actually completed. A preflight report is not a verified master.

Deliverables are kept in `master/delivery`: MP4, PCM-reference MOV, contact sheet,
loop-boundary comparison, verification report and `SHA256SUMS`. Public delivery
still requires an actual unauthenticated download and matching checksum for every
linked artifact. Keep any publication workflow separate: the task ends at human
approval of the verified master.

The dormant GitHub Actions workflow and its separate pilot/production gates are
documented in [ACTIONS.md](ACTIONS.md).
