# PARALLAX

An original 28-second cinematic electronic cue in E Dorian at 140 BPM. A displaced fourth and falling reply move from clipped pluck to vowel lead; a bassless suspension gives way to a delayed low-end catch, then a composed E resolution.

Anonymous listening files: `final/entry-07.wav` and `final/entry-07.mp3`. Model identity is omitted from audio filenames, title, project descriptions and the listening-only archive.

- `entry-07.json`: frozen final project (identical to V4 Risk Pass).
- `entry-07.v1.json` through `entry-07.v4-risk.json`: complete creative snapshots.
- `hook-a.json`, `hook-b.json`, `hook-c.json` and `hooks/`: three competing short sketches and dry WAV auditions.
- `hook-anchor.json`: unchanged selected hook.
- `final/`: canonical WAV/MP3, 12 sample-aligned stems, native analysis and `.render.json` provenance.
- `versions/`: complete comparison WAVs and native reports; intermediate stems remain in the local workspace, while final stems are committed.
- `provenance/`: source/tool pins, validation, section comparisons, delivery audit, usage/deviation record and rerender hash comparison.
- `production-log.md`: musical thesis, provisional selection, critique, revisions, Risk Pass and evidence limits.
- `compose.py`: score authoring script, not synthesis or audio DSP.
- `assets/v12-signature/`: unchanged original 16 WAVs and kit. Pack licensing remains pending owner declaration; no license is added or changed.

Reproduce from the repository root:

```sh
node bin/daemonv12.js validate submissions/battle002/entry-07/entry-07.json --json
node bin/daemonv12.js render submissions/battle002/entry-07/entry-07.json --out-dir /tmp/entry-07-reproduce --stems --format wav,mp3 --json
```

DaemonV12 0.7.0 at `e2962cc1a443c841cd6ca7cb2cc56c5ebabf0e99`, Composer 0.4.0, Node 24.19.0 and configured FFmpeg 6.1.1. Sample-only production route. Stems start at sample zero and include track processing; they exclude master compression/saturation/gain.

No human listening was available. Hook selection and creative keep/revert decisions are provisional score judgments. Native measurements validate delivery and do not score musical quality. Exact runtime model/reasoning settings could not be verified; requested settings and all known deviations are recorded separately in provenance.
