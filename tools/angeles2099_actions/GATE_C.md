# Gate C: finished CREST teaser, disabled pending approval

Gate B is owner-approved: 12 ordered native frames, both boundaries, zero-sample CREST lag, 0.99847 correlation and exactly 0.500 s all passed independent review. This implementation targets the finished teaser; it adds no artistic changes.

## Publication-permission decision

**Decision for this PR: NO public cache publication; NO teaser launch.** Neither repository approval variable is set by this code, and the manual workflow defaults to plan-only. This PR does not merge itself or start a render.

Two separate owner decisions are required after code review:

| Repository Actions variable | Required value | Meaning |
|---|---|---|
| `ANGELES2099_GATE_C_PUBLICATION_APPROVED` | `true` | Permit publicly downloadable project PNGs/manifests in versioned prereleases |
| `ANGELES2099_GATE_C_LAUNCH_APPROVED` | `true` | Permit the full 201-frame teaser render |

An absent/false variable blocks execution even if the manual render checkbox is checked. Publication also requires a manual workflow event. Plan-only has read permissions and creates no release or asset. Only the gated render job receives `contents: write`; assembly remains read-only. No paid service/token or larger/GPU runner is introduced.

## Fixed plan and runtime

Frames **285–485 inclusive**, **201 frames**, **24 fps**, duration **8.375 s**. Original CREST starts at **11.875 s**. The source remains **2a3208d3679a32e9f5ced303d6bc8baa1a237071**, Python 3.11.14 / Blender 4.5.14, all existing wheel hashes, native 1080×1920, Cycles 16, OIDN and original 0.5/CENTER motion blur. All 600 animation keys are built, but only missing teaser frames are rendered.

There are **26 deterministic contiguous chunks**. Conservative car/action frames 285–419 use at most seven frames/chunk; the city region 420–485 uses at most twelve. The city cost classification is an estimate, not a guarantee. Even twelve frames at the slowest measured 252 s/frame cost 50.4 minutes, leaving setup/checkpoint time within a **90-minute job cap**. A 65-minute render deadline, 70-minute process timeout and TERM handler leave time to retain unpublished work.

Choose **8 workers initially**, or **10** after owner review. Fail-fast stops admission of queued chunks after a failure; completed cache checkpoints remain intact. The concurrency group is shared with Gates A/B.

Using the approved 252 s heavy / 124.4 s city observations gives **11.73 runner hours** for frames alone. Allow approximately **13–16 runner hours** including builds, setup, assembly and margin, and roughly **2–3 hours elapsed at eight workers**, depending on queue/hardware/shot costs. These are projections, not Gate C measurements. Compatible A/B imports could avoid 14 teaser renders, leaving **187 new frames**; input these runs explicitly if their artifacts are retained.

## Verified lossless cache

The backend uses published **prereleases**, explicitly approved as public project build outputs. Every frame has an original PNG asset and a content-addressed JSON manifest published **last**. Manifest names carry the source/settings recipe, frame number and manifest SHA-256. The PNG name carries its original SHA-256 and producing run/attempt. Records include exact source, actual settings, frame identity, byte count and origin. The recipe is independent of chunk boundaries or requested frame range.

Tags are versioned by recipe and **200-frame blocks**, keeping a normal release below 400 assets even when all 600 film frames are eventually archived across three releases. Every PNG is at most 9 MB; each manifest is at most 100 KB. This is far below GitHub's [under-2-GiB per asset / 1000 assets per release limits](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases#storage-and-bandwidth-quotas). A soft capacity stop leaves repair headroom; server/API errors remain fatal and resumable.

For each completed frame:
1. Validate original PNG dimensions, decoded image and locked settings; atomically save its local checkpoint.
2. Upload the PNG without overwriting another asset.
3. Download the public asset and verify its bytes/SHA-256.
4. Publish its content-addressed manifest, then download/verify that manifest.
5. Mark the frame durable and remove only that verified local working copy.

No cache artifact is overwritten/deleted. Corrupt manifests or PNGs are rejected; a missing compatible frame is imported or rendered again. Repairs append new run-specific assets and new manifest commit markers. A failed upload never becomes an accepted cache entry.

Image validation preserves the locked Mouth Drop seal/black exposure cue (334–359), including intentionally black frames. Only near-black flat images in that authored transition are accepted; unexpected flat images elsewhere, white flat images and non-finite pixels fail. No pixel values or animation are changed.

Public asset downloads use browser asset URLs, avoiding REST quota for payload readback. CLI write/metadata calls still consume GitHub API quota: an unseeded teaser is approximately 800–950 REST calls plus retry overhead, near the default repository token's hourly budget. Rate-limit/network failures stop workers rather than retrying indefinitely or continuing to render uncheckpointed frames. Resume after the limit resets; do not increase concurrency to evade the limit.

## Storage admission and interruptions

Actions admission reserves **240 MB** below the existing **400 MB repository ceiling**: up to ten concurrently failing workers at 16 MB each, one 64 MB review artifact, and 16 MB metadata headroom. Repository-wide/account usage in other repositories still needs owner review. Fail-fast prevents queued chunks continuing to accumulate fallback PNGs after the first failure.

Workers checkpoint publicly after **every frame**. A publication failure stops before rendering the next frame, so only one verified unpublished PNG needs fallback storage. Seven-day Actions artifacts retain that PNG, source preflight and incremental manifest. Successfully verified public-cache PNGs are not duplicated in Actions. Forced VM loss before a checkpoint/upload may lose the current frame, but not previous durable frames.

After review:
- Start a new manual dispatch using the same recipe; compatible cache frames are downloaded/verified and never rendered again.
- Supply `recovery_run` to restore pending-frame artifacts from a failed Gate C run before they expire.
- Supply approved Gate A/B run IDs to import compatible original PNGs. Only 16-sample A images are eligible; 128-sample references are excluded. Source/input fingerprints, frame filename/identity, actual settings, image decoding and original PNG SHA-256 all must match. Corrupt/incompatible entries cannot silently become cache hits.
- Encoder failure does not invalidate the lossless store. A new approved run can skip all completed frame renders and repeat assembly.
- Artifacts over their hard ceiling are not uploaded; quality is never reduced. No automatic artifact/release deletion is implemented.

The Gate A bundle was 12.35 MB including five mixed-sample PNGs and reports. Its rough 2.47 MB/image proxy implies **about 496 MB** for teaser PNGs and **1.48 GB** for the film, before overhead. Native cache storage at the 9 MB safety bound is **1.81 GB / 5.4 GB** respectively. Neither is forced into the 500 MB Actions allowance. Release storage is a distinct project asset backend; publication remains disabled in this PR.

## Assembly and QA

Assembly downloads and validates all 201 lossless frames, then uses Gate B's identical high-quality H.264 chunk encoder and stream-copy concat/mux. Missing/corrupt frames prevent accepted output. It verifies all decoded frames against the ordered decoded chunks, all joins and 24 fps timestamps, and produces **teaser.mp4**, **qa.json** and **checksums.sha256**.

The original locked master is independently verified, resampled with SoXR to 48 kHz and trimmed at sample **570000** for exactly **402000 samples**. Decoded AAC must meet the established one-sample lag tolerance and ≥0.98 correlation. Priming/padding and exact presentation duration are checked separately. QA includes source-frame IDs, lossless hashes, decoded frame hashes, boundary source IDs, original master hash and final MP4 hash. Review output is capped at 48 MB inside its 64 MB artifact reservation; an oversize encode fails without lowering quality.

## Android procedure

1. Review this PR and the public-cache decision. Do not enable either variable yet merely to inspect the plan.
2. After approval/merge, open **Actions → ANGELES2099 Gate C teaser → Run workflow → main** in Chrome (Desktop site if necessary). Leave **render unchecked** to inspect the fixed plan without rendering/publishing.
3. Only when the owner approves both publication and the teaser, set the two variables in **Repository Settings → Secrets and variables → Actions → Variables** (Desktop site may be needed).
4. Choose eight workers initially. Enter retained approved Gate A/B run IDs; optionally enter a failed Gate C recovery run. Check render and dispatch once.
5. Inspect prerelease checkpoints and Actions status. On failure, wait for any API reset and launch a new manual run with recovery ID. Public-cache matches avoid rerendering.
6. Download the review artifact, verify checksums, inspect the 201-frame MP4 and QA. Archive the public lossless cache index/manifests before any owner cleanup.
7. Disable launch approval again when done if desired. No workflow mode can render a full 600-frame film.

## Validation limits

Tests cover the fixed 201-frame plan, permission gates, cache identity/corruption rejection, checked upload commit order, pending-only fallback, proof-import compatibility, cache sharding and an actual synthetic **201-frame / 8.375-second H.264/AAC** concat/sync test. Existing Gate A/B tests remain in CI. No production teaser frame or public cache was generated during implementation. A real GitHub release publication/resume and native teaser run remain deliberately unexecuted until owner approval.
