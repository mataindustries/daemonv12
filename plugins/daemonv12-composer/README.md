# DaemonV12 Composer · 0.3.0

Composer v0.3 targets engine v0.7.0 at
`02438eda48506a94d10ad2756c6aafff8c5a9469`. It teaches source ends, musical gates,
output-time envelopes and track-local choke groups without inventing MIDI
note-off. It adds [validated electronic recipes](skills/daemonv12-composer/references/electronic-production.md)
and an exact [music-to-video handoff](skills/daemonv12-composer/references/music-to-video.md).
The musical workflow, critique, Risk Pass and compute discipline still apply.

See [current evaluation plan](evals/README.md) and [v0.3 validation](evals/validation-v03.md)
for executed checks and limits. This upgrade changes only the plugin/workflow;
it starts no benchmark or BANGER LAB composition. Existing projects and Round 3
materials are preserved. Round 3's older engine assumptions are historical;
new production uses the v0.7 contract in the linked engine notes.

The v0.2 overview below, [v0.2 validation](evals/validation.md), and
[v0.2 evaluation plan](evals/README-v02.md) remain historical records.

## Historical v0.2.0 overview

A reusable plugin/skill for composing and improving music with DaemonV12.
v0.2 moves from avoiding production failures toward memorable musical decisions.
It incorporates human blind-listening findings from internal benchmark rounds:
immediate identity can still feel awkward, polished music can remain too safe,
and originality or greater loudness can coexist with weak physical impact.
These observations guide questions, not a fixed genre or a universal quality claim.

v0.1 stays frozen at `56dbdff62bf78e70e898f0dbb49f8044cd561655`.
v0.2 is a new revision of the same `daemonv12-composer` plugin. The engine
implementation, project format and render behavior are unchanged.

## What changed

- **Opening Continuity:** first 1 second for deliberate impression, 3 seconds
  for identity, 5 seconds for connection into the piece. Distinctive does not
  necessarily mean coherent; trimming or shifting may help more than volume.
- **Impact Test:** compare the setup and arrival across low end, attacks,
  register, presence, top end, stereo content, density, negative space and
  musical consequence. A louder payoff can feel smaller; an intimate arrival
  can still change the piece's meaning.
- **Risk Pass:** after competent V3, propose one high-upside musical decision,
  upside/downside, a cheap test and keep/revert evidence. Random strangeness is
  not the goal. A failed risk may be reverted; a clearly stronger existing
  version can stay.
- **Compute Discipline:** every version after V3 states an audible hypothesis,
  minimum evidence, cost and keep/revert criterion. Default maximum is five
  serious versions; beyond V5 needs an unusually strong reason, and the user
  can override it. Two marginal revisions trigger comparison and stopping.
  New software needs an unresolved musical question that existing tools cannot
  answer and whose answer could change a decision.
- **Translation Robustness:** mono, midrange identity, attacks, kick/bass and
  width-dependence checks provide proxy evidence. Human phone/car/headphone
  listening remains the judge.
- **Stop Criteria:** lock when the thesis, opening, hook, movement, payoff and
  replay ending work with no obvious technical defect. Speculative ideas do
  not justify endless analysis.

The effective V1–V3 critique/render workflow remains. Core instructions are
shorter; deeper analysis and musical examples live in references. Notes now
explain useful versus crowded 120–500 Hz energy and stereo arrangement versus
the engine's balance pan.

## Install and use

Keep an existing DaemonV12 checkout and its documented CLI/audio tools. From
this repository root, install the skill to a fresh local destination:

```sh
mkdir -p .agents/skills
cp -R plugins/daemonv12-composer/skills/daemonv12-composer .agents/skills/
```

Update an existing copy deliberately rather than nesting another copy. Refresh
host discovery as needed. Invoke explicitly:

```text
$daemonv12-composer Make a replayable 30-second DaemonV12 cue.
```

Or give an agent with file access this instruction:

```text
Read plugins/daemonv12-composer/skills/daemonv12-composer/SKILL.md and follow it
to improve this DaemonV12 composition. Load its linked references as needed.
```

Package this directory with `plugin.json` and `skills/` at the archive root for
a host's supported plugin import. The manifest follows the
[Agent Plugins 1.0 schema](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json).
Avoid installing both plugin and direct skill copies. No MCP server, connection,
credentials, hook or automatic setup script is required.

## review-sections helper

Native DaemonV12 reports remain the source for whole-file peak, RMS, clipping,
LUFS, LRA and true peak. The new dependency-free Node helper answers a narrower,
repeated question: **how are named sections physically different?** It reports
bounded-section duration, RMS/peak, approximate band energy, activity, stereo
evidence and differences relative to the first listed section.

Create `sections.json` with boundaries from the actual arrangement:

```json
{
  "sections": [
    {"name": "opening", "start": 0, "end": 5},
    {"name": "groove", "start": 5, "end": 14},
    {"name": "payoff", "start": 18, "end": 24},
    {"name": "ending", "start": 24, "end": 28}
  ]
}
```

```sh
node plugins/daemonv12-composer/skills/daemonv12-composer/scripts/review-sections.mjs /path/to/master.wav sections.json
```

Use sections that fit the WAV, not the example times as a composition template.
The helper supports mono/stereo PCM or floating-point RIFF WAV, reads bounded
blocks, and adds no package dependency. Its approximate FFT bands and envelope
rise proxy are neither EQ targets nor listening results. Side energy can rise
from balance alone; correlation/content and mono behavior must also be examined.
It does not rank musical quality, replace native analysis or create dashboards.
See [production analysis](skills/daemonv12-composer/references/production-analysis.md)
for method, format limits and interpreting undefined values.

## Workflow and resources

Verify → six-line thesis → palette → complete V1 → analysis/three weaknesses →
V2 → analysis/three weaknesses → V3 → opening continuity → impact → final
3-second replay check → translation proxy → risk → optional justified V4/V5 →
stop decision → deterministic lock. Adapt genre/duration and explicit user
constraints; ordinary composition should keep a compact log.

- [SKILL.md](skills/daemonv12-composer/SKILL.md): core workflow and critical decisions.
- [Short-form composition](skills/daemonv12-composer/references/short-form-composition.md):
  continuity, consequential repetition, impact, risk and ending/restart.
- [Production analysis](skills/daemonv12-composer/references/production-analysis.md):
  section evidence, low-mid buildup, stereo, translation and when to stop analyzing.
- [Engine production notes](skills/daemonv12-composer/references/daemonv12-production-notes.md):
  verified automation, pan, samples, effects, routing and resource constraints.
- [Headless audio](skills/daemonv12-composer/references/headless-audio.md):
  optional guidance only for a reproduced audio-device initialization problem.
- [Production log](skills/daemonv12-composer/assets/production-log.md): compact v0.2 template.
- [Evals](evals/README.md), [activation cases](evals/activation-cases.json) and
  [validation record](evals/validation.md): tests, observations and limits.
- [Round 3 proposal](round-3.md): future one-sound challenge; no contest started.
  [Round 2 handoff](round-2.md) remains historical v0.1 documentation.

## Normal composition and optional Benchmark Mode

Normal composition uses the available verified engine, musical iteration and
a compact log. Explicit Benchmark Mode adds organizer-chosen engine/skill pins,
contestant isolation, equal constraints, blind submission and mandatory
deterministic final WAV/stem verification. Loading Composer does not enable that
mode or start a round. The normal workflow supports ambient, cinematic,
non-drop music and user-specified genres without borrowing a contestant's song.

This is an instruction layer. Human listening remains the test of musical
improvement and replayability.
