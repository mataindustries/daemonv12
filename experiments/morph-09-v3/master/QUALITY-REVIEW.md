# Full-resolution quality and sampling review

Final verification requires `delivery/quality-evidence.json`. This records an
explicit operator or human visual review; the verifier does not make an aesthetic
judgment from image statistics. Keep it separate from preflight results.

Inspect the actual selected-sample full-resolution renders and phone-size
previews. Compare at least one representative picture rendered at two sample
counts. The alternative can be higher or lower than the selected count: a higher
sample reference may justify choosing the cheaper production count. Explain the
quality/cost decision in `samplingRationale` and each comparison's `notes`.

For a locally available reviewed PNG, retain its original adjacent renderer JSON sidecar. Record
`path` relative to the repository root, plus the sidecar's `fileSha256`,
`pixelSha256` and `settingsDigest`. The verifier checks the actual files, decoded
pixels, creative-source provenance, complete timeline bake and production
settings. Only the sample count can differ in the alternative comparison. The
selected-sample reviewed pictures must match the delivered raw pictures exactly.

The following is a **template**, not completed evidence. Replace the review
metadata, add actual render entries and comparisons, inspect every group, then
change each decision to `pass` only after accepting its image quality. Review
frames must be selected-sample renders listed under `renders`. The loop review
must include both 479 and 0; also inspect the finished loop-boundary strip.

```json
{
  "sourceCommit": "9e8a03d2b5bfed15f8056970ca3b4cdb1c2cfbc7",
  "selectedSamples": 32,
  "reviewMethod": "operator-visual-review",
  "reviewer": "REVIEWER",
  "reviewedAtUtc": "UTC_TIMESTAMP",
  "samplingRationale": "RECORD_OBSERVED_QUALITY_AND_RENDER_COST",
  "renders": [],
  "sampleComparisons": [
    {"frame": 0, "comparisonSamples": 16, "notes": "RECORD_COMPARISON"}
  ],
  "visualReview": {
    "copperAndCeramic": {"frames": [0], "decision": "pending", "notes": ""},
    "focusAndMotionBlur": {"frames": [24], "decision": "pending", "notes": ""},
    "plasma": {"frames": [373, 389], "decision": "pending", "notes": ""},
    "strobe": {"frames": [396], "decision": "pending", "notes": ""},
    "sparksAndVapor": {"frames": [418], "decision": "pending", "notes": ""},
    "phoneSizeClarity": {"frames": [0, 389, 418], "decision": "pending", "notes": ""},
    "cameraReturn": {"frames": [450, 479], "decision": "pending", "notes": ""},
    "loopBoundary": {"frames": [479, 0], "decision": "pending", "notes": ""}
  }
}
```

One `renders` entry has this form, with actual hashes from its sidecar:

```json
{
  "path": "work/morph-09-v3-master/pilot32/0000.png",
  "fileSha256": "ACTUAL_FILE_SHA256",
  "pixelSha256": "ACTUAL_DECODED_RGB_SHA256",
  "settingsDigest": "ACTUAL_SETTINGS_DIGEST"
}
```

For remote pilots, keep raw PNGs outside Git. Commit only the unchanged renderer
JSON sidecars and derived full-resolution/phone JPEG review plates. A remote
`renders` entry uses this alternative form:

```json
{
  "recordPath": "experiments/morph-09-v3/master/pilot-review/RUN-ATTEMPT/p00/samples-32/0000.json",
  "recordRepositoryPath": "experiments/morph-09-v3/master/pilot-review/RUN-ATTEMPT/p00/samples-32/0000.json",
  "recordSha256": "ACTUAL_SIDECAR_FILE_SHA256",
  "evidenceCommit": "FULL_COMMIT_CONTAINING_THIS_SIDECAR_AND_REVIEW_PLATES",
  "workflowRunUrl": "https://github.com/mataindustries/daemonv12/actions/runs/NUMERIC_RUN_ID",
  "fileSha256": "ORIGINAL_RAW_PNG_SHA256_FROM_SIDECAR",
  "pixelSha256": "ORIGINAL_RAW_RGB_SHA256_FROM_SIDECAR",
  "settingsDigest": "SETTINGS_DIGEST_FROM_SIDECAR",
  "reviewImages": [
    {
      "path": "experiments/morph-09-v3/master/pilot-review/RUN-ATTEMPT/p00/frame-0000-full.jpg",
      "repositoryPath": "experiments/morph-09-v3/master/pilot-review/RUN-ATTEMPT/p00/frame-0000-full.jpg",
      "sha256": "ACTUAL_JPEG_FILE_SHA256"
    }
  ]
}
```

The evidence commit must be available locally. The verifier checks every fetched
sidecar and review image against `git show COMMIT:PATH`, validates the recorded
production settings and raw hashes, then checks that selected pilot pixel hashes
match the final production PNGs. It explicitly records that remote alternative
raw pixels were not decoded locally. The producing job and immutable evidence
commit provide their provenance; the review plates provide the visual evidence.

The rendered seam also has an automated anomaly gate. At 135 × 240 review size,
the 479 → 0 mean absolute RGB step must be no larger than the 95th percentile of
the other loop steps, and no larger than 1.25 times the maximum of seven nearby
steps plus 0.5 on the 0–255 scale. This detects an unusually large loop jump; the
explicit visual review remains required. An anomalous result stops certification
for investigation and must not be silently accepted by editing the evidence.
