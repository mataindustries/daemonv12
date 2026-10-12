# Round 3 proposal · not started

Recommended future participants: **Sol 6.1 Ultra**, **Claude Opus 5.5 Max** and
**Claude Haiku 5.5**. These are organizer-facing proposed labels; verify exact
available model IDs/settings before a future run. No run or model provisioning
is initiated by this handoff.

Freeze a common **engine commit chosen by the organizer** and the **Composer
v0.2 commit**, separately. v0.1 remains frozen at
`56dbdff62bf78e70e898f0dbb49f8044cd561655`; its engine base was
`ed75e9e2a0172266e56b292886ad7c1500677862`. Neither a moving branch nor installing
the skill should change the engine pin. Use identical exported plugin bytes,
source assets, tools/builds, SoundFont when needed and isolated workspaces.

## Proposed ONE-SOUND CHALLENGE

Use the same source sample, BPM, tonal center/key, duration, engine, skill and
allowed tools. Derive most of each track's identity from transforming that one
source through supported DaemonV12 playback rate, glides, offsets, chopping,
layering, rhythm, effects and automation. Apply any drums/sub support constraints
identically. This proposal aims to isolate composition and sound-design judgment
more cleanly than Open Class; it does not establish a winning musical formula.

DaemonV12 sampler voices play through the remaining source material rather than
having an arbitrary note-off/choke. Before Round 3, the organizer must define
source length, whether contestants may create pre-trimmed slices, whether
reversed/preprocessed derivatives are allowed, and whether all transforms must
begin from the same exact source file. A short source of roughly 1–2 seconds is
recommended so transformed-render budget trivia does not dominate the benchmark.

Before starting, the organizer should settle the source and its tuning/license,
brief/duration, exact allowed transformations/source preparation, support-sound
limits, common tool/time budget and handling of V4/V5. Require complete V1–V3;
retain opening, impact, translation-proxy, risk and stop decisions with evidence.
Use blind judge-facing submissions and human listening across devices when
available. Keep metrics as evidence and verify deterministic final WAV/stem
hashes under identical inputs/tools.

These are recommendations, not finalized rules. The organizer must choose the
common commits, fill the remaining constraints, and explicitly start Round 3.
