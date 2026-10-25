# Standard public GitHub Actions production

`.github/workflows/morph-09-master.yml` runs the reviewed free pilot. Production
remains disabled by its separate storage and sampling gates. The workflow accepts
this exact public repository and production branch only,
and uses standard `ubuntu-24.04` runners: four CPUs, 16 GB RAM and 14 GB SSD.
The current GitHub documentation identifies standard public-runner compute as
free. No larger runners, GPU services, self-hosted hosts, caches or deployments
are configured.

`requirements-actions.txt` pins the matching local Python environment; setup uses
Python 3.11.17 and bpy 4.3.0. Every job records versions, available CPU/disk,
locked-input preflight results and scene hashes. The configuration uses four
render threads for both pilot and production. Each runner has its own output
directory; raw-frame writers never share a directory.

## Pilot without artifact storage

With `actionMode: "pilot"` and `actionsPilotReviewGitAuthorized: true`, seven
independent jobs render these pairs at both 32 and 64 samples:

| Job | Pictures |
|---|---|
| p00 | 0, 24 |
| p01 | 242, 373 |
| p02 | 389, 390 |
| p03 | 396, 405 |
| p04 | 406, 418 |
| p05 | 433, 434 |
| p06 | 472, 479 |

Pilot jobs never invoke artifact upload. Raw PNGs remain on the temporary runner.
Each job commits only small derived JPEG review plates and original JSON render
metadata under `master/pilot-review/<run-id>-<attempt>/<job-id>/`. Native-size
32/64 panels and phone-size views have accompanying pixel-difference metrics,
raw PNG/pixel hashes, render times, file sizes and settings hashes. Metadata
verifies that sample count is the only setting that differs between each pair.
The selected sample count is still a separate production decision.

The workflow token has write permission in pilot jobs solely for these review
commits. The helper allowlists JPEG/JSON paths, caps each job’s derived review at
20 MB, stages those paths explicitly and uses bounded fetch/rebase/fast-forward
push retries. It never force-pushes and never commits raw PNGs. Review paths are
excluded from the workflow’s push trigger; workflow-token pushes also do not
recursively trigger workflows. Production jobs have read-only repository access.

## Production and storage gate

After evaluating the pilot, set `samplingStatus: "selected"`, record the chosen
samples and reason, and set `actionMode: "production"`. Artifact storage has a
separate gate: `actionsArtifactsAuthorized` must be true and
`actionsArtifactBudgetBytes` must be positive. Enable that gate only after
verifying free storage headroom or obtaining approval for possible storage
charges. Free public-runner compute does not itself establish free artifact
storage.

Production runs sixteen independent 30-picture jobs, with at most sixteen in
parallel. Each job also independently re-renders its internal batch boundaries
and assigned representative checks. Across the run this yields 480 master PNGs,
34 independent control PNGs and six quiet V3 control PNGs. All settings, sampling,
full-timeline baking and source provenance are identical across jobs.

The total configured artifact budget is divided into sixteen per-job caps. The
helper measures payload size and leaves ZIP metadata headroom before enabling an
upload. It stores complete PNGs/sidecars, controls, logs, preflight reports and
scene/runtime metadata; incomplete jobs can therefore be recovered independently.
Each batch is divided into independently verifiable download parts below 30 MiB,
with room for ZIP headers. Every PNG stays with its original JSON sidecar; tiny
source/runtime/scene/configuration headers are repeated so a part can be validated
on its own. Each part has a complete checksum file and inventory identifying its
part index/count. Ten explicit conditional upload steps handle the measured part
count without another SDK. The total measured size of all parts must fit the
authorized per-job storage cap, including repeated metadata. Artifacts retain for
one day, with compression disabled for already-compressed PNGs. Download and
verify them promptly. A failed render still attempts to retain its completed
picture pairs within the authorized storage cap.

A strict uncompressed PNG bound is approximately 6.23 MB per 1080 × 1920 RGB8
picture. The 520 production/control pictures therefore have an upper bound near
3.24 GB before small metadata overhead. Expected PNG sizes should be estimated
from the real pilot rather than treating that upper bound as a forecast. Native
render output per job is at most about 212 MB at this bound; the runtime, checkout
and scene files are expected to keep each runner well within its disk allocation.
The helper requires at least 4 GiB free after dependency installation.

After downloading all ZIP parts, run `collect-batches.py --archives DIR
--require-complete`. It rejects unsafe/unknown ZIP members, verifies every file’s
checksum and recorded inventory, decodes every full-resolution PNG and validates
its source/settings/pixel hashes. It merges non-overlapping frames and controls
into the local work directories, preserves per-part metadata/logs under
`work/morph-09-v3-master/batches`, and regenerates a sorted combined manifest.
An exact rerun safely skips existing matching bytes; conflicting bytes are never
overwritten. A different artifact claiming a previously collected picture is
rejected. Recover a failed batch by rendering its missing pictures and controls.
The completeness gate requires all 480 pictures, representative/boundary/quiet
controls and every declared part. Then run finishing and strict final
verification. Keep metadata and raw frames outside Git. Neither successful jobs
nor collected artifacts alone constitute a verified deliverable.
