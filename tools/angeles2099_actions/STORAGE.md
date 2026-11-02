# Storage decision before Gate C

**This is a proposal for owner review. No release/cache publishing, deletion or teaser render is implemented or launched by the Gate B PR.**

The free Actions artifact allowance is treated as **500 MB shared account storage**. Proof workflows use a lower **400 MB repository working ceiling**, reserve whole-run worst-case upload space, and keep 100 MB of headroom. Other repositories' use is outside that repository inventory and must be checked in the account's usage page.

## Evidence and planning size

The approved Gate A artifact is **12,348,720 bytes** ([run 41391336159](https://github.com/mataindustries/daemonv12/actions/runs/41391336159), artifact 13119251009). It contains five native PNGs, including two 128-sample references, plus logs/reports. Dividing the bundle by five gives a rough **2.47 MB mixed-frame planning proxy**, not a measured mean for 16-sample production PNGs.

| Lossless PNG store | At that rough proxy |
|---|---:|
| 201-frame teaser | about 496 MB |
| 600-frame film | about 1.48 GB |
| 20-frame archive | about 49 MB |

Thus keeping every teaser PNG plus review MP4s/old attempts in Actions is not a safe plan; the film is larger still. Gate B's machine-readable QA measures actual bytes for all 12 16-sample frames and projects both mean and maximum costs. That short shot sample is not an upper bound across the whole film.

For admission bounds, an ordinary 8-bit native RGBA PNG is allocated **9 MB/frame** (above its raw scanline/deflate size); output beyond the configured bound is rejected, never downscaled. Before Gate C, use measured bytes plus a margin, and enforce actual archive bytes during publication.

## Recommended durable cache: versioned GitHub release assets

Use a separately approved **project render-cache prerelease** for the original lossless PNG archives and their manifests. These are project build outputs, not source files. Keep distribution H.264 chunks separate from the lossless store.

[GitHub's current release documentation](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases#storage-and-bandwidth-quotas) allows up to **1000 assets per release**, each **under 2 GiB**, with no total release-size or bandwidth limit. Release assets are outside the Actions artifact retention mechanism and avoid using Actions as the long-term frame store. Confirm current account terms/limits again in the Gate C implementation review; do not enable paid LFS, larger runners or another paid service.

Proposed cache layout:

- One cache identity per approved source/input hashes, Blender/Python/wheel pins, native resolution, samples, denoising, original motion blur and producer adapter revision.
- Native PNG archives of roughly **20 frames each**, with deterministic inclusive frame ranges and exact per-frame filename/SHA-256/byte size/settings/origin metadata. Cap each archive at **200 MB**, far below the release-asset limit, and include an archive SHA-256. Compression level may change archive bytes but cannot change extracted PNG bytes.
- An immutable producing commit/run identity and a hash-index manifest. Do not overwrite an accepted asset with another payload of the same name.
- Only a dedicated cache publisher would need `contents: write`; render and assembly jobs stay read-only. Publication requires explicit Gate C approval because a published cache in this public repository makes the lossless frames publicly downloadable. No such permission or release write is added in Gate B.
- Upload an archive, confirm remote asset size/digest, download/verify before marking its frames durable, and publish the index last. An interrupted upload is not a completed checkpoint.
- Actions retains small review MP4s, QA and at most a bounded fallback buffer. A later implementation must reserve fallback space before starting workers. If release upload fails, stop admitting work after the reserved fallback buffer is full; do not keep launching renders or deleting the only verified copy.
- A failed cache publisher can resume from an uploaded Actions fallback archive. After its exact bytes are verified in the durable cache, the owner can remove the transient Actions artifact manually.

This plan supports eventual 8–12 compute workers without requiring all large PNG archives to coexist in Actions. Concurrency still depends on measured compute and a tested publication/fallback budget. Gate B does not implement or enable that worker count.

## Free alternative without public cache publication

The owner can download lossless archives to Android/PC storage, verify hashes, and keep two copies. Use **manual waves of at most three or four approximately 20-frame chunks**, reserving their worst-case bytes plus MP4/QA before each wave. Download and verify a wave before manually deleting its Actions artifacts, then launch the next wave.

At the rough proxy, allow at least **2 GB per full native film store**, plus backup space; the actual worst case can be higher. A practical initial device allocation is **6 GB**, then revise using Gate B's measured maximum. Keep the archive index and all checksums with both copies. Seven-day Actions retention is not a backup.

If public release caching is declined, the 500 MB ceiling can restrict a wave to fewer than 8–12 concurrent workers. That tradeoff must be approved before Gate C; the workflow must not silently exceed quota or lower quality. For film reuse, restore only the wave's verified archive back to the runner through an approved upload/download path; review that path and its budget in the Gate C/D PR.

## Film reuse and acceptance conditions

For the full 600-frame film, verify/import all **201 teaser frames** from the lossless store and render only missing compatible frames. H.264 distribution video is lossy and cannot replace this cache. Keep the source-frame numbering **0–599**; teaser frames are **285–485 inclusive**. Video chunk boundaries must not be part of a per-frame cache identity.

Preserve Gate A's three 16-sample PNGs separately from its 128-sample references. After a successful Gate B, its 12 native PNGs can also be imported through an explicit compatibility check: Gate A frames 330 and 470 plus Gate B frames 285–296 would cover **14 teaser frames**, leaving **187** new teaser frames. Frame 170 is an additional possible film reuse outside the teaser. These savings require validated source/settings/provenance import; no cross-gate cache importer or full-film trigger is added here.

Before Gate C, review and approve:

1. Actual Gate B artifact/PNG sizes, QA, CPU times and numerical/audio/visual findings.
2. Release-cache publication versus local archive waves, with account storage headroom.
3. Lossless extraction/checksum/import tests, including a failed upload, expired artifact, corrupt archive, duplicate/missing frame, and a resumed encode from PNGs.
4. Read/write token scopes, immutable asset naming, fallback byte reservations and an explicit stop when capacity is exhausted.
5. A separate manually triggered teaser-only implementation. No automatic 600-frame render.
