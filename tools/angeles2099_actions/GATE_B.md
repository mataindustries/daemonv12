# ANGELES//2099 — Gate B only

Gate A is approved by the owner after reviewing [run 41391336159](https://github.com/mataindustries/daemonv12/actions/runs/41391336159): all five native PNGs, all 14 scene checks and manifest checksums passed; 16 samples plus denoising was accepted against 128. Owner-reported CPU times are f170 **251.0 s**, f330 **252.0 s**, f470 **124.4 s**; total Gate A elapsed **36m 48s**.

This PR adds a **manual-only Gate B proof**. Open the PR for review before merging or launching it. Gate C and full-film rendering are absent.

## Fixed proof contract

| Chunk | Inclusive source frames | Frames |
|---|---|---|
| 0 | 285–288 | 4 |
| 1 | 289–292 | 4 |
| 2 | 293–296 | 4 |

All 12 frames form one contiguous **0.5-second** sequence at **24 fps**, beginning at the teaser's source offset **285 / 24 = 11.875 s**. Two standard `ubuntu-24.04` CPU workers may run at once. Each chunk has a 90-minute cap; assembly has a 30-minute cap. The bounded frame set has no override input.

Production remains pinned to **2a3208d3679a32e9f5ced303d6bc8baa1a237071**. Python **3.11.14**, Blender **4.5.14**, all nine wheel hashes, CRESTLINE v3, original CREST master, choreography and animation are unchanged. Every scene build creates all 600 animation keys before selecting frames. Native render settings stay **1080×1920, 100%, Cycles CPU, 16 samples, OIDN, original 0.5/CENTER motion blur**. No reduced-resolution fallback exists.

The shared setup action uses the proven installer verifier from the Gate A hotfix. It records native environment evidence and fails on unexpected dependency/platform problems.

## Encoding and boundary proof

Each chunk uses libx264 **CRF 16 / preset slow / yuv420p**, 24 fps, closed GOP, GOP length 24, scene-cut disabled and **no B-frames**. The last choice makes tiny-chunk decode/presentation timing simple; it changes compression efficiency, not the locked render settings. RGB-to-YUV conversion explicitly uses a BT.709 limited-range matrix and matching color metadata. Original PNGs remain the lossless cache.

All chunks must match codec/profile/level, dimensions, pixel format, frame rate, time base, color metadata and codec extradata. Their FFmpeg/build/encoding fingerprint must match. Concatenation and audio mux use **video stream copy**.

QA counts decoded frames, checks exact 1/24-second presentation timestamps and duration, and compares **every decoded frame SHA-256** against the ordered decoded chunks before and after mux. Both chunk joins have explicit source IDs, neighbor hashes and zero-gap timestamp checks. The strict manifest ledger rejects missing, duplicated or reordered source-frame IDs. This establishes chunk/time continuity; it does not replace the owner's visual review of motion.

## Exact original-master synchronization

The 44.1 kHz / 24-bit stereo original master is checked against its locked SHA-256. Its source offset 11.875 s falls at source sample **523687.5**. Rounding that to a 44.1 kHz integer sample would be an avoidable offset.

Gate B performs high-quality **SoXR resampling to 48 kHz**, then trims exactly at sample **570000** for **24000** samples. Each video frame is exactly 2000 samples at this rate. There is no gain change, remastering, music regeneration or time stretch.

The QA reference independently resamples the whole master, then slices that result in Python; its PCM bytes must match the filter-trimmed reference exactly. The final MP4 contains AAC stereo at **320 kb/s / 48 kHz**. Decoded audio is checked against the reference across ±2400 samples, requiring best lag within **one sample** and zero-lag correlation at least **0.98**. Silence cannot pass as a synchronization proof.

Audio must start at timeline zero and have the same exact container/edit duration as the video. AAC decoder tail padding of at most 1023 samples is reported separately from presentation duration; it is not silently counted as music drift. The report records decoded sample count, padding, correlation, lag, offset and reference PCM hash.

## Storage and recovery

Admission reserves **256 MB**: at most three **64 MB** chunk artifacts plus a **64 MB** review artifact. It refuses when existing live repository artifacts plus the reservation exceed the conservative **400 MB** working ceiling. Gate B shares Gate A's concurrency group so those proofs cannot reserve storage simultaneously. This is a repository-level accounting check; account use in other repositories still needs owner review.

Each chunk retains its four original PNGs, incremental per-frame manifest, scene checks, source/environment evidence and encoded MP4. Publication has a hard byte cap, prioritizes validated native PNGs, bounds log tails and omits oversized derived media while marking failure. Such media can be regenerated from PNGs; quality is never reduced. No master audio, wheels, .blend, full resampled soundtrack or duplicate assembled inputs are uploaded. Artifacts retain **7 days**, with no automated deletion.

For recovery, start a **new manual run**, set `resume_run_id` and `resume_attempt` to an earlier Gate B run/attempt, and leave all other inputs fixed. Admission rejects an expired/mistyped selection with no retained chunk artifacts. Every worker restores available chunk artifacts. Valid completed PNGs are checked by input/adapter/quality fingerprint, file SHA-256, decoded image validity and actual settings before reuse. A complete verified chunk skips scene construction and rendering; partial chunks render only missing/invalid frames. Matching encoded video is reused; an encoder change or damaged MP4 causes re-encoding from retained PNGs.

Use the new-run resume inputs rather than GitHub's ordinary Re-run failed jobs: artifacts from different attempt numbers must not be silently mixed. Download/archive complete results before expiry. A forced VM loss before upload can still lose that attempt's unuploaded output.

Assembly runs even after a chunk failure to emit an incomplete-proof QA report when possible. It refuses to create an accepted review MP4 without all three verified chunks.

## Android trigger and review, after PR approval

1. Merge this PR only after review. GitHub needs the workflow on the default branch for first dispatch.
2. In Chrome, open [Gate B Actions](https://github.com/mataindustries/daemonv12/actions/workflows/angeles2099-gate-b.yml), enable Desktop site if needed, and choose **Run workflow → main**.
3. For a fresh proof leave resume blank. For recovery select the prior Gate B run and attempt as described above.
4. Download `angeles2099-gate-b-review-RUN-ATTEMPT`. Review **review.mp4**, **qa.json**, **report.md**, **checksums.sha256** and **artifact-publication.json**. Keep all three chunk artifacts for lossless reuse.
5. Review the half-second clip by looping/frame-stepping in the player. The encoded proof itself contains no repeated loop frames.
6. Compare both chunk joins and soundtrack timing. A passing numerical QA report is not approval for Gate C.

The owner still needs to approve the storage plan in [STORAGE.md](STORAGE.md) before a teaser run. This workflow cannot launch one.

## Estimates and tests

At the Gate A mean 209.13 s/frame, 12 renders cost about **41.8 CPU minutes**, plus three scene builds, setup, encoding, assembly and uploads. The slowest measured rate predicts about **16.8 render minutes per four-frame chunk**, or roughly two such waves with two workers. These are sparse-frame illustrations, not measured Gate B runtime.

Run `python -m unittest discover -s tools/angeles2099_actions/tests -v` with the pinned NumPy and FFmpeg/ffprobe available. Existing Ubuntu CI installs that same hash-pinned NumPy for the tests. The tests use synthetic 96×160 images/audio to exercise real H.264/AAC encode, concat, decode hashes, timing, shifted/wrong-offset audio rejection, incomplete work, resume and artifact limits; they never call the production renderer.

Local testing also exercised the **original CREST master** with synthetic video: exact offset verified, AAC lag **0 samples**, correlation **0.9984745**, and 576 decoded tail-padding samples outside the exact half-second presentation duration. That is an audio/assembly check, not a native GitHub Gate B render. Actual Gate B timing and review remain pending until this PR is approved and manually run.
