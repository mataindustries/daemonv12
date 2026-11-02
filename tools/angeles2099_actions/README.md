# ANGELES//2099 — optional GitHub Actions CPU path

**This PR implements Gate A only.** It adds a manual, single-worker smoke test beside the existing Colab path. It cannot launch the teaser or film. Gate A's native images, measured CPU times and visual review must come before parallel rendering.

The workflow checks out production at **`2a3208d3679a32e9f5ced303d6bc8baa1a237071`** into a separate directory. It never follows the older Colab pin or a moving production branch. It adds no changes to the creative assets or Colab files. Every render builds all 600 animation keys before selecting the smoke frames, preserving interpolation, choreography, lighting and motion blur.

## What Gate A runs

Workflow: [`.github/workflows/angeles2099-gate-a.yml`](../../.github/workflows/angeles2099-gate-a.yml).

| Output | Frames | Settings |
|---|---|---|
| Requested production quality | 170, 330, 470 | Native 1080×1920, 100%, Cycles CPU, 16 samples, OIDN |
| Matching visual references | 170, 470 | Same scene, camera, resolution and blur; 128 samples |

Frame 170 covers the expensive car/wide shot; 330 covers teaser action; 470 covers the city. All five renders are sequential on **one standard `ubuntu-24.04` runner**. There is no matrix, schedule, push/PR trigger, GPU selection, larger runner, sample/resolution override, frame-range input or production mode. A 90-minute job timeout bounds a smoke attempt. Global workflow concurrency is one; additional manual requests queue.

Python is exactly **3.11.14**, Blender is the approved **4.5.14 `bpy` wheel**, and all nine Python wheels use the filenames and SHA-256 pins from the approved source's Colab configuration. Download is hash-checked; installation is offline from those verified wheels; installed versions and dependency consistency are checked. GitHub actions are pinned by commit. The runner image and Ubuntu system libraries remain GitHub/Ubuntu-maintained; their versions are recorded through the runner image identity, rather than represented as an immutable OS image.

The harness verifies the original **44.1 kHz, 24-bit stereo CREST WAV** against both the master report and lock SHA-256, checks the production checkout is clean, and runs the source's geometry, framing, rig, camera, animation and lock checks before rendering. The adapter asserts the actual resolution, samples, CPU device, OIDN, 24 fps, AgX, adaptive sampling and original **0.5 shutter / CENTER motion blur**. It fails if these differ; it does not reduce quality to fit a budget. No soundtrack is regenerated.

## Activate and trigger from Android

GitHub only accepts `workflow_dispatch` for a workflow that exists on the repository's default branch. **Opening this PR does not activate or run Gate A.** Review and merge this Gate-A-only PR into `main` to make the manual button available. Merging is a separate maintainer action; it does not authorize Gate B or C.

1. In Chrome on Android, sign in to GitHub with repository write access.
2. Open [repository Actions](https://github.com/mataindustries/daemonv12/actions). If the controls are hidden, use Chrome's **Desktop site**.
3. Choose **ANGELES2099 CPU Gate A** → **Run workflow**. Select the reviewed branch/commit containing this workflow. Leave `resume_run_id` empty and `resume_attempt` as `1` for a fresh smoke test.
4. Tap the green **Run workflow** button once. Only the fixed smoke set runs.
5. Open the completed run. Its summary shows scene-build/validation times, each frame's render time, comparison metrics, source/host identity and a clearly labeled future projection.
6. Under **Artifacts**, download `angeles2099-gate-a-RUN_ID-ATTEMPT`. Extract the ZIP. Open `comparison.html` with its adjacent PNG folders, or view the PNG pairs in Android's file/image viewer. Use original PNGs and zoom to 100% to examine chrome, paint, spokes, skyline, haze, noise and blur. Local HTML support varies by Android viewer; the PNGs remain directly viewable.
7. Review `scene-check.json`, `manifest.json`, `report.md` and the actual images. A successful job means the smoke render completed; **it does not record creative approval**. Report Gate A's CPU times and visual findings before requesting Gate B.

The pinned production checkout stays at `2a3208d` even if the workflow branch changes. Treat any workflow/harness update as code to review before running.

## Resume a failed smoke test

The job uploads completed PNGs, an atomic per-frame manifest, logs and reports even if a later render fails. An attempt's artifact name is immutable and includes its run ID and attempt number. A new manual run can restore it using `resume_run_id` and `resume_attempt`. This is more useful than GitHub's ordinary **Re-run jobs**, which starts an empty runner without setting a resume source.

The harness compares a fingerprint covering the approved source files, original master hash, complete dependency pins, adapter code and quality settings. Each cached PNG also needs the expected frame/settings, a matching file SHA-256, valid dimensions, finite non-flat decoded pixels and a safe relative path. A matching completed frame is copied without invoking the renderer. Missing/corrupt/stale frames are rendered again. Build and scene validation run again; reused timings retain their origin run/attempt and are labeled **reused**.

Artifacts expire after **7 days**. Download successful results before expiry or deletion. Resume is available while the selected artifact is retained; it is not permanent storage. No artifact is deleted automatically. A hard VM loss or forced cancellation before upload can lose the current attempt's files; only uploaded outputs are durable.

## Storage

Gate A reserves **64,000,000 bytes** for five native PNGs, small reports and logs. It paginates a read-only repository artifact inventory before rendering and refuses when live artifacts plus the reservation would exceed a conservative **400,000,000-byte** working ceiling, leaving headroom below the user's 500 MB allowance. The final artifact is measured again. Completed PNGs are preserved if that measurement fails; review storage before another run.

No wheel cache, `.blend`, audio master, video, or duplicate reference assets are uploaded. PNG ZIP recompression is disabled. Only one Gate A job runs at a time. The inventory covers this repository, not shared account use across other repositories; check account **Settings → Billing and licensing → Usage** before dispatch. Download and remove old artifacts manually when necessary. Expired outputs cannot be resumed.

## Runtime and usage estimates

**Current GitHub runner measurements: pending.** See [RESULTS.md](RESULTS.md). Do not treat the historical CPU container numbers as a completed GitHub smoke test.

The approved source's `review/render/engine-bench.json` records native 16-sample frame 170 at **204.0 s** and frame 470 at **85.2 s** on a 4-vCPU CPU container. Its `RENDER_PLAN.md` records scene build plus validation near **71 s** and native 128-sample frame 170 at **886.3 s**. These are historical measurements on another machine. Frame 330 and a matching native 128-sample city reference have no authoritative Gate A measurement here. Gate A measures all five renders and reports separate build/validation times and total harness wall time; job elapsed time additionally includes setup/download/upload.

The current **90-minute timeout is a cap, not a runtime estimate**. For a later teaser, a worked illustration using 71 s of build/validation and the two historical 16-sample timings gives:

| Planning quantity | Illustration only |
|---|---|
| Teaser frames / playback | 201 / 8.375 seconds |
| Mean frame time from the two historical frames | 144.6 seconds |
| 10-worker total render compute, with 25% padding | about 620 runner minutes (10.3 runner hours) |
| Longest worker at 204 s/frame, 21 frames + build, with 25% padding | about 91 minutes |
| Remaining film frames after retaining all teaser PNGs | 399 |

Parallel workers shorten elapsed time; they do not reduce total CPU work, and each pays setup/build cost. The report recomputes an illustration from actual smoke times, while still identifying sparse sampling and omitted setup/encoding/queue costs. Resume reports identify timing origins; rerender on changed hardware if a fresh estimate is needed.

The requested public-repository standard-runner path is intended to use GitHub's free public Actions compute. Verify the repository's current billing/settings and shared artifact use before running. This workflow does not select a paid runner, spend Colab credits or provision another service.

## After approval: Gates B–D

These are documented follow-on requirements, **not implemented or runnable modes in this PR**.

- **Gate B:** After reviewing Gate A, add only a short contiguous sample spanning at least two chunk boundaries. Fix identical H.264 `libx264 -preset slow -crf 16 -pix_fmt yuv420p`, 24 fps, closed GOP and identical stream parameters across chunks. Concatenate in manifest/index order using stream copy. Count decoded frames and verify timestamps, boundary order and A/V duration. Trim the locked PCM CREST master at sample **523687.5** of 44.1 kHz (11.875 s); because this falls halfway between source samples, use explicit fractional-time resampling and quantify the sub-sample rounding. Account for AAC priming/padding with decoded-audio comparison, not container duration alone. Produce a small downloadable proof MP4 and sync report. No creative retiming, remastering or audio gain changes.
- **Gate C:** Only after explicit teaser approval, implement manual-only matrix rendering of **285–485 inclusive**, initially at the concurrency supported by measured results, then 8–12 workers after approval. `plan.py` already supplies tested deterministic balanced partitions for 8–12 workers; it only computes data. Build all animation keys per worker; render missing frames at the same quality; use manifests/hashes and retained artifacts to resume successful chunks. Validate all 201 unique ordered frames before assembly and mux the master at exactly **11.875 s**, for **8.375 s** of playback. Retention/upload limits and an explicit storage plan must be reviewed before launching.
- **Gate D:** After the teaser succeeds, prepare the 600-frame film by importing compatible **original lossless PNGs** (or another explicitly verified lossless frame store) and rendering the remaining 399 frames. H.264 distribution chunks alone are lossy and cannot stand in for a lossless render cache. Native 201-frame PNGs may exceed 500 MB; measure real bytes/frame at Gate A, reserve room, and agree a durable storage/download plan before Gate C. No full-film render is automated.

At 24 fps, frame 285 maps to **285 / 24 = 11.875 s** in the source timeline (the approved source is zero-based); the inclusive 201-frame teaser ends at **20.250 s**, exclusive. Gate B must prove this mapping with an identifiable waveform/timeline event. Merely encoding an MP4 or checking durations is insufficient.

## Local verification

These tests need only Python's standard library; they use a synthetic renderer for failure/resume behavior and do not claim Blender or GitHub integration success.

```sh
python -m unittest discover -s tools/angeles2099_actions/tests -v
```

They cover exact partitions for every worker count 8–12; timing arithmetic; quality guards; the bounded smoke set; full animation construction; invalid-scene refusal; storage refusal; interrupted rendering; complete-run resume; and rejection of corrupt/stale/unsafe cache entries. The real scene, wheel installation, native image quality, timings and uploads remain Gate A integration checks.

