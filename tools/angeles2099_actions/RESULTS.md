# Gate A status

**Gate A is pending execution and visual review. No teaser or film job has been launched.**

Implemented and locally verified:

- Manual-only workflow with one standard `ubuntu-24.04` CPU runner and a fixed five-render contract.
- Python 3.11.14; the approved Blender 4.5.14 wheel and all nine dependency SHA-256 pins.
- Production checkout pinned to `2a3208d3679a32e9f5ced303d6bc8baa1a237071`; original CREST WAV, geometry, choreography and animation guards.
- Native 1080×1920, 16-sample production smoke frames 170, 330 and 470; native 128-sample comparison frames 170 and 470.
- Per-frame manifests/checksums, resume, artifact budget/retention checks and a native-pixel visual comparison viewer.
- **14 standard-library tests passed**, including synthetic renderer failure and resume tests. Workflow YAML parsed and its manual-only runner/permissions contract checked locally.

Actual GitHub CPU scene build, render times, images, visual metrics, artifact bytes and synchronization results are **unmeasured**. Tests use synthetic render outputs; they establish orchestration behavior, not production image quality.

Execution blockers in the implementation session:

1. GitHub requires the manually dispatched workflow to exist on the default branch before its first dispatch. This change is submitted as a PR; it has not been merged.
2. The connected GitHub tools support PR/git-data operations but expose no workflow-dispatch operation. The cloud shell cannot connect to its configured network proxy; its GitHub CLI authentication check also fails. Shell push/dispatch and downloading the pinned environment could not be used. Repository reads and PR publication use the working GitHub connector.

After maintainer review/activation, use the Android instructions in [README.md](README.md) to dispatch Gate A only. Populate this report with the run URL, runner identity, installed versions, scene-check result, five per-frame render times, artifact bytes and human visual findings. Keep Gate B, C and D pending.

Historical 4-vCPU CPU measurements are quoted separately in README.md for planning only and are never labeled GitHub runner results.

