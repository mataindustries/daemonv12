# Music-to-video handoff

Lock picture length and musical structure explicitly. Record an authored cue
sheet in the composition workspace with section names and musical positions,
for example opening `1:1`, development `3:1`, payoff `5:1`, exit `8:3`, and end
`9:1` for an eight-bar 4/4 score. This sheet is a delivery sidecar, not an invented
project `markers`/`sections` field. Notes are pattern-relative and clips place
patterns at integer bars; the cue sheet names project-absolute positions.

Specify `render.duration` explicitly using exactly one of `seconds`, `bars`, or
`musical`. For locked picture, seconds names the complete final container
including tails, with at most six decimals. For a fixed musical-length cut, bars
or a whole-note fraction follows the engine tempo. Choose `render.tail` deliberately:

- `"none"`: cut by the earlier of authored end and final duration; pad if needed.
- `"auto"`: natural audio inside the fixed container, cropped/padded as needed.
- Positive `{ "seconds": 0.75 }`: permit at most that much after authored end,
  inside the final duration. It grants time, never extends source material.

A duration shorter than the score crops audio without changing MIDI events.
Longer duration can contain permitted tails then silence. Finite authored end
plus tail is rounded once as a combined rational value. Inspect the final gesture,
effect tails, boundary clicks and intentional silence. A hard boundary alone is
not a composed ending or a seamless loop.

Presence of `render` selects production routing, as do `master`, track `mix`,
`effects` or `automation`, even empty containers. Production requires FFmpeg;
GM additionally needs FluidSynth/SoundFont. Preserve the route across revisions.
Render the frozen project with `--stems --format wav --json` into a fresh directory.
Use the actual returned paths. Deliver:

- Frozen project and original assets/licenses plus SHA-256s, engine commit and
  Composer revision, Node/audio tools and SoundFont identity where used.
- Canonical PCM16 stereo 44,100 Hz WAV master with explicit final frame count.
- Aligned stems from frame zero, all with exactly the master's frame count.
  They contain track processing, exclude master gain/effects/VO ducking, and
  cannot recreate a processed master just by summing. Keep them at their origin.
- `.render.json` manifest and `.analysis.json`, including overload evidence and
  measured true peak. MP3 is only an optional listening copy; encoder padding
  makes it unsuitable as the authoritative picture clock.
- Authored musical cue positions resolved to absolute engine ticks and integer
  sample frames, with seconds derived from `frame / 44100` and the final boundary.
  Preserve sidecar provenance and hashes alongside the manifest.

## Exact engine timing

Never turn `60/bpm` directly into authoritative cue seconds. The engine first
quantizes tempo to integer microseconds per quarter:
`tempo = Math.round(60000000 / bpm)`. It uses 960 ticks per quarter, 3840 per
whole note. For absolute tick `t`, the nonnegative integer frame is:

```text
floor((t * tempo * 44100 + 480000000) / 960000000)
```

Use integer/BigInt arithmetic; nearest-frame rounding ties later. Resolve every
absolute boundary independently; do not accumulate rounded beat lengths.
In 4/4, `3:1` is tick 7680; at 140 BPM tempo is 428571 microseconds and that cue
is frame 151200. The authored eight-bar end `9:1` resolves to **604799** frames,
not the 604800 suggested by unquantized `60/bpm`. Even familiar BPM can disagree
by a frame. Wall seconds resolve through exact microseconds:
`floor((microseconds * 44100 + 500000) / 1000000)`.

Video agents must ultimately consume authoritative engine sample timing. In the
pinned engine checkout use `compileProjectFile`, then `parsePosition` (allow
`bars+1` to resolve the exact authored end) and `ticksToFrames` with the compiled
`timeline.usPerQuarter` from `src/timing/musical-time.ts`. Cross-check the cue
sheet against resolved trigger/automation frames where present and manifest
`timeline` duration/tail boundaries and actual WAV frames. Musical cues are not
a native engine marker export: resolve them with these engine APIs into a sidecar.
If only a compact MCP manifest is available, obtain full provenance before locking
the handoff. Do not manufacture silent notes/automation solely to export markers.

A musical cue beyond a shorter fixed container is cropped, not a delivered cue;
label/remove it in the delivered sheet while preserving authored intent. Map
engine frames to picture frame rate only in the video stage, recording that
stage's rounding decision; keep the original sample frame authoritative.
The section-review helper takes seconds, so derive its windows from resolved
sample frames too, rather than estimating score time from BPM.

Sources: `docs/V0_5_TIMELINE_DYNAMICS.md`, `docs/V0_7_SAMPLER_ARTICULATION.md`,
`src/timing/musical-time.ts`, `src/timing/render-plan.ts`, `src/timing/wall-time.ts`,
`src/pipeline.ts`, `src/sample-render.ts`.
