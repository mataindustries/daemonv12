---
name: daemonv12-composer
description: Compose, produce, or improve music with DaemonV12, including beats, songs, cues, loops, and music-production iteration workflows. Use when DaemonV12 is the requested or established music engine. Do not use for explanations of DaemonV12 or FluidSynth, README edits, pull-request reviews, sampler implementation changes, or unrelated audio tasks.
---

# DaemonV12 Composer

Turn a musical idea into a replayable record through the existing DaemonV12
CLI and JSON project workflow. Aim for 25–30 seconds when the brief leaves
duration open; adapt to the user's duration and purpose. DaemonV12 is an
instrument, not a style: electronic, cinematic, bass, garage, hip-hop,
experimental, game, ambient, hybrid, and other supported styles are welcome.

Explicit user instructions take precedence over this workflow. Make reasonable
creative decisions from the brief; ask only for missing information that blocks
useful work. Keep planning short and render a complete arc early. Do not modify
engine implementation or rendering behavior, invent fields, or install MCP to
use this skill. This skill provides process, not a quality guarantee.

## 1. Verify the environment

Locate the engine checkout and a separate composition/output directory. Record
the engine commit and tool versions; preserve existing user work. For a new
workspace, use the documented `init` command. In the engine checkout run:

```sh
git rev-parse HEAD
node bin/daemonv12.js doctor --json
node bin/daemonv12.js --help
```

Inspect current repo docs and available packs/catalogs; assign no capability
based on memory. Read [engine production notes](references/daemonv12-production-notes.md)
before authoring. Verify a small render using the intended tool route before
building a full composition. Node-only samples, GM rendering, and FFmpeg
production require different capabilities. If tools fail, diagnose the actual
error and report any blocked checks. Consult [headless audio](references/headless-audio.md)
only for an audio-device initialization problem; never apply its wrapper automatically.

When benchmark fairness matters, enable the optional Benchmark Mode below and
verify the organizer's engine pin before rendering. Ordinary requests need no
contestant setup or fixed historical engine commit.

## 2. Define the musical thesis

Before JSON, write six short lines, then proceed:

- **Hook:** the recognizable gesture and where it first appears.
- **Rhythmic identity:** pulse, swing, syncopation, phrasing, or intentional suspension.
- **Low-end role:** anchor, movement, punctuation, or deliberate absence.
- **Contrast idea:** what changes expectation without losing identity.
- **Payoff:** what the listener earns, and how it expands or transforms the idea.
- **Ending:** resolution, loop-back, or memorable final gesture.

For an existing track, infer and preserve its thesis unless the brief asks for
a new direction. Read [short-form composition](references/short-form-composition.md)
when designing the arc. A useful framework is **hook → groove/establishment →
development → disruption → payoff → replayable exit**. Combine, reorder, or omit
functions deliberately; do not impose fixed bars, BPM, key, drop, or genre.

## 3. Choose an intentional palette

Start with a limited set of sounds, each with a role: identity, pulse, low end,
support, answer, or transition. A track must earn its place. More tracks do not
automatically create richness. Check tuning and source lengths, especially for
repitched or slowed samples. Plan kick/sub interaction and overlapping tails.
Use monophonic low-end phrasing where appropriate, implemented through supported
timing or source preparation, not an invented sampler mono/choke control.

## 4. Compose V1 as a complete record

Build the full arc quickly, including the ending. Put identity or a hook in the
first approximately 3–5 seconds; it can be a texture or rhythmic signature in
styles that do not want a melody. Do not postpone all distinctive material to
the payoff. Establish repetition, then change its consequence. Leave enough
negative space for the central idea to read. Render before polishing details.

## 5. Render and gather evidence

Validate, render the master, and analyze it with the existing CLI. Use the
actual paths returned by render; save separate `v1`, `v2`, `v3` project snapshots,
renders, and reports instead of overwriting evidence. Render stems when they
help diagnose balance; retain stems for the final lock.
When aligned stems or an exact output duration are required, choose the documented
production route from V1 and keep it consistent across comparisons. Legacy GM
stems can have unequal natural tails; see the engine notes before changing routes.

```sh
node bin/daemonv12.js validate /path/to/project.json --json
node bin/daemonv12.js render /path/to/project.json --out-dir /path/to/v1 --stems --json
node bin/daemonv12.js analyze /path/to/v1/project.wav --json
```

Read [production analysis](references/production-analysis.md). Inspect true peak,
clipping, integrated LUFS, LRA, RMS, frequency balance, low end, section energy,
stereo behavior, hook clarity, and arrangement density. Label unavailable
measurements; never invent a listening result or infer quality from one number.
Use the score, waveform, stems, section comparisons, and any human feedback to
form musical hypotheses. Optional analysis tools are evidence aids, not gates
to creating music.

Inspect automation values against their real engine semantics, including
boundaries and held values. Check transformed samples for tuning, playback
rates, glide shape, source offsets, short-chop clicks, and overlapping voices.
When a field or effect is uncertain, read the current spec/schema/source and
validate a small example. Do not invent a feature to fix a musical problem.

## 6. State the three weakest musical results

Before each revision, name **three specific weaknesses**, with time/section,
evidence, likely cause, and intended musical change. For example:

- “The payoff feels smaller than the intro because bass and transient energy
  disappear at its entrance; restore the anchor and make space for the attack.”
- “The hook loses its outline behind the drums; simplify the competing part
  and check its register/presence before adding another layer.”
- “The final tail outlasts the last meaningful gesture; tighten the exit and
  compare the restart.”

“LUFS is low” and “there is little 5 kHz energy” are observations, not musical
critiques. When evidence is ambiguous, label the concern as a hypothesis and
test it; do not manufacture certainty or destructive edits to fill three slots.

## 7–8. Revise, render, and repeat

Fix the identified weaknesses, then compare the same sections of the new render
with the prior version. Use comparable playback level when human audition is
available. Keep or revert each change according to its musical effect.

Require **at least three serious versions: V1, V2, V3**. V1 includes a rendered
whole arc and critique; V2 and V3 each include purposeful changes tied to the
prior critique, a new render, evidence, and a new critique. Renames, rerenders,
extra events, or arbitrary gain changes do not count as meaningful iterations.
Continue beyond V3 while a specific change is likely to improve the record;
stop when the remaining proposals have no convincing musical benefit and the
final checks pass. If the user explicitly limits time or iterations, respect
that constraint and report which workflow steps remain incomplete.

Use [the production log template](assets/production-log.md) as a compact record.
Never optimize event, track, automation, or effect counts, or LUFS as a score.

## Decision heuristics

| Evidence or concern | Musical next step |
| --- | --- |
| Intro has less energy than later sections | Check whether the hook is clear and creates curiosity before increasing intro volume. |
| Payoff is not larger or different | Check bass weight, transient density, register, stereo spread, harmonic density, and gain automation before master gain. A sparse payoff can work if its contrast is legible. |
| Mix seems small | Inspect low-end authority, transient impact, midrange/upper-mid presence, top-end energy, stereo activity, section contrast, and density at the payoff. Do not solve size solely with loudness. |
| Bass dominates | Check sustained sub accumulation and kick/sub masking. Adjust note/source lengths, overlap, register, arrangement, or supported processing before globally brightening the mix. |
| Hook repeats without development | Change its consequence: register, harmony, rhythm, answer, orchestration, or transformation. Preserve recognition. |
| Ending harms replay | Compare a concise final hit, loop-back, opening callback, or cleaner tail. Tape stops and long decays are options only when they serve the ending; no technique is banned. |

## 9. Final listening-proxy check

Agents cannot hear or judge replayability like a human listener. Explicitly
inspect these excerpts alone as well as in context, and label proxy judgments
as such. Human feedback, if available, outweighs a favorable metric.

- **First 5 seconds:** immediate identity, readable hook, and curiosity? Too
  empty or generic? Is the distinctive material buried?
- **Payoff:** clearly larger or meaningfully different, earned by what precedes
  it, and not crowded? Inspect the transition as well as its loudest instant.
- **Final 3 seconds:** a strong resolution, intentional loop-back, or memorable
  gesture? Check accidental energy collapse, dead air, abrupt crop, excessive
  tail, and a clever gimmick that harms replay. For a loop, inspect end-to-start
  timing and continuity. The piece must do more than merely stop.

Record evidence, judgment, and any uncertainty for all three. Revisit the whole
arc after an excerpt edit; a locally better moment can weaken the full record.

## 10. Lock and deliver

Keep the chosen final project and source assets alongside the master WAV,
aligned stems, analysis, iteration log, and `.render.json` provenance. Record
asset origins/licenses, engine commit, Node/audio-tool versions, SoundFont hash,
and any environment wrapper. Compute SHA-256 hashes for the final submission
files. Render the same frozen project a second time into a separate directory
where practical; compare master/stem hashes with identical tools and assets.
Report differences rather than claiming determinism. MP3 is an optional
listening copy. Give the user paths, a short musical rationale, the improvements
across versions, and unresolved listening/measurement limitations.

## Optional BENCHMARK MODE

Enable only when the user or organizer requests a benchmark. Preserve the same
composition workflow and add:

1. Pin **both** the engine commit and skill package revision/hash. Round 1 used
   `ed75e9e2a0172266e56b292886ad7c1500677862`; use the organizer's Round 2 pin,
   not an assumed latest checkout. Keep engine and skill checkouts separate so
   installing the skill does not change the locked engine. No engine edits.
2. Use an isolated contestant workspace/output directory. Do not inspect,
   borrow, compare against, or share competitor work during composition.
3. Hold brief, duration, allowed assets, tools, time budget, and iteration
   minimum equal across contestants. Fix the minimum before the run: at least
   three meaningful rendered versions, with critique before revision. If a
   run cannot meet it, mark it incomplete rather than lowering the rule.
4. Log versioned projects, critiques, changes, metrics, tool versions, and
   source provenance. Log metrics as evidence, never a quality leaderboard.
5. Require a deterministic second final render under the same environment;
   compare WAV/stem hashes. Investigate mismatches; disclose an unresolved
   mismatch as an incomplete determinism check.
6. Preserve an unmodified submission folder with project/assets, final master,
   stems, analysis, log, provenance, and hashes. Keep judge-facing naming blind
   according to the organizer's rules and identity metadata in the private log.

Round 1 taught early identity, groove, consequential development, perceived
size, and replayable endings. It did not establish one winning formula. Never
copy its songs' structures, harmonies, instruments, custom samples, BPMs, or keys.
