# V0.1 validation record

Validated on 2026-10-12 against engine source at
`ed75e9e2a0172266e56b292886ad7c1500677862`, Node 24.19.0 and FFmpeg 6.1.1.
Changes are confined to `plugins/daemonv12-composer/`. No Round 2 composition
was started and no engine implementation or rendering behavior was changed.

## Package and guidance checks

- Root `plugin.json` validated with Python `jsonschema.Draft202012Validator`
  against the official Agent Plugins 1.0 schema retrieved from
  `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`.
- `SKILL.md` front matter parsed with PyYAML; required name/description are
  strings, the name matches the directory, and the description is under 1024
  characters. All local Markdown links resolve within the packaged files.
- UTF-8, final newlines, trailing whitespace, balanced code fences and Git
  whitespace checks passed. No MCP manifest, hook or dependency was added.
- Independent source review found no actionable contradictions in engine
  semantics, install guidance, inspector usage or Round 2 pin separation.
- Existing engine tests passed (two test files, no failures or skips):

```sh
node --test tests/v05-timeline-automation.test.ts tests/v06-sample-performance.test.ts
```

These tests support the cited automation and sampler contracts; they are not
tests of musical quality. No new engine test or analyzer was introduced.

## Activation audit

An independent model context received only the skill name, exact description
and the ten requests, without expected labels. It returned these decisions:

| Request | Expected | Observed |
| --- | --- | --- |
| Make me a DaemonV12 beat. | Activate | Activate |
| Compose a 30-second boss cue with DaemonV12. | Activate | Activate |
| Improve this DaemonV12 track. | Activate | Activate |
| Use DaemonV12 to make a garage song. | Activate | Activate |
| Produce a new music loop through DaemonV12. | Activate | Activate |
| Explain what DaemonV12 is. | Ignore | Ignore |
| Fix the DaemonV12 README. | Ignore | Ignore |
| Review a DaemonV12 pull request. | Ignore | Ignore |
| Change the sampler implementation. | Ignore | Ignore |
| How does FluidSynth work? | Ignore | Ignore |

Result: **10/10 in a metadata-only routing audit**. The cases were supplied
together in one independent evaluation context. This is not a live installed-host
activation test, a cross-model result, or a measure of routing reliability over
repeated runs. Fresh per-prompt host activation runs remain a follow-up in the
[eval plan](README.md).

## CLI and determinism smoke check

Doctor reported all intended capabilities available. Ran the documented CLI
workflow on the existing `examples/sample-only-demo.json` fixture, twice into
fresh temporary directories (no composed benchmark entry):

```sh
node bin/daemonv12.js doctor --json
node bin/daemonv12.js render examples/sample-only-demo.json --out-dir /tmp/daemonv12-composer-smoke-a --stems --format wav --json
node bin/daemonv12.js render examples/sample-only-demo.json --out-dir /tmp/daemonv12-composer-smoke-b --stems --format wav --json
node bin/daemonv12.js analyze /tmp/daemonv12-composer-smoke-a/sample-only-demo.wav --json
node --input-type=module -e 'import { inspect } from "./scripts/inspect-orbital-foundry.ts"; console.log(JSON.stringify(inspect(process.argv[1]), null, 2));' /tmp/daemonv12-composer-smoke-a/sample-only-demo.wav
```

Both renders succeeded. All eight artifacts were byte-identical: master, four
stems, MIDI, analysis and provenance. Master/stems were aligned at 882,000
frames, 20 seconds, 44,100 Hz, stereo PCM16. Master SHA-256:

```text
6f0e2ded2d3cff99673e5d2285937b39e2424656911064193c0e1b55b52f8bce
```

Native analysis returned −24.08 LUFS, 2.4 LU LRA, −5.72 dBTP, −6.002065 dBFS
sample peak and no full-scale/clipped samples. These are fixture observations,
not production targets. The optional existing inspector returned band shares,
20 per-second RMS values and stereo correlation without running its pack-catalog
entrypoint. Its presence and limits justify omitting a duplicate helper.

## Outstanding evaluation

Behavioral B01–B10 runs and human blind listening are **planned, not executed**.
The source tests and smoke render do not prove three meaningful composition
iterations, hook improvement, replayability, or any autonomous quality guarantee.
The optional headless wrapper was documented, not activated or validated on this
fixture: sample-only rendering does not exercise FluidSynth. A live plugin-host
import/discovery test remains separate from schema and package validation.
