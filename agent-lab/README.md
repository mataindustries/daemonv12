# DaemonV12 Agent Lab v0.1

A standalone offline runner for three agent-proposed creative hypotheses. It
uses the existing engine pipeline without changing DSP, Composer, MCP or old
examples. The agent writes meaningful variations; humans judge the audio.
Measurements describe signals and timing, never musical quality.

Requires the repository's Node >=22.18 and FFmpeg with loudnorm. GM projects
also require FluidSynth and a SoundFont. Select tools with DAEMONV12_FFMPEG,
DAEMONV12_FLUIDSYNTH and DAEMONV12_SOUNDFONT. No AI API or additional npm
dependency is needed by the runner. Commands run from the repository root.

## Use

Create an experiment JSON and three candidate project JSON files. Paths are
relative to that definition; each project resolves its own assets through the
existing engine rules. All output parents must exist; output paths must be new.

```sh
# Once when intentionally selecting a toolchain; keep the pin for reruns.
node agent-lab/cli.mjs pin /private/experiment.json /private/toolchain.json

# One complete comparison: validation, repeated renders, checks, match, package.
node agent-lab/cli.mjs run /private/experiment.json /private/toolchain.json /runs/experiment-001

# After a human completes a COPY of public/scores-template.json:
node agent-lab/cli.mjs evaluate /runs/experiment-001 /private/scores.json /private/comparison.json
```

Equivalent entry point: `npm run agent-lab -- run ...`. Stdout is one small JSON
result; failures return exit 1 and JSON diagnostics with a code, repair and
optional evidence on stderr. Diagnostics and preparation logs are private.
Pinning is explicit: a changed engine, runner, tool or Node binary fails rather
than silently updating the lock. Reuse the same definition/seed and lock to
reproduce. Use a fresh unpredictable private seed for actual blind judging;
the benchmark helper's fixed seed is for reproduction, not secret judging.

Minimal definition (the three files must contain distinct, audible variations):

```json
{
  "version": 1,
  "source": "source.json",
  "candidates": [
    {"id":"room", "project":"room.json", "hypothesis":"A darker room bed may make contacts feel closer."},
    {"id":"pressure", "project":"pressure.json", "hypothesis":"A stronger pressure arc may increase anticipation."},
    {"id":"space", "project":"space.json", "hypothesis":"Opposing background placement may suggest unstable space."}
  ],
  "seed": "replace-with-private-seed",
  "frames": 529200,
  "window": {"startFrame":308700,"frames":132300},
  "loudness": {"targetLufs":-23,"ceilingDbtp":-1},
  "constraints": [
    {"kind":"triggers","track":"latch","frames":[66150]},
    {"kind":"onset","track":"latch","startFrame":63945,"endFrame":68355,
     "expectedFrame":66150,"toleranceFrames":1,"thresholdFraction":0.25,"minPeakDbfs":-50},
    {"kind":"silence","track":"$master","startFrame":485100,"endFrame":529200,"maxPeakDbfs":-80}
  ]
}
```

The definition rejects unknown fields. All times are integer 44100 Hz sample
frames; intervals end exclusively. `frames` must be 1–26460000 (600 seconds).
Window must fit inside the track. Target is −60…−5 LUFS; ceiling −12…−1 dBTP.
`constraints: []` is allowed. A `triggers` constraint compares the complete
ordered schedule for one track, so extra or missing notes fail. An `onset`
constraint measures the first stereo peak-envelope sample reaching the declared
fraction of the local peak in an isolated stem (or `$master`), with a minimum
peak gate and an explicit tolerance. This is a declared detector, not a universal
perceptual onset model. Silence checks every sample against a peak threshold.
Source and all candidates must satisfy the same duration and constraints.

## Artifacts and blind judging

Distribute **only `public/`**, which contains:

- `A.wav`, `B.wav`, `C.wav`: full-length matched PCM16 listening copies.
- `A-window.wav`, etc.: exact selected excerpts using the same whole-track gain.
- `listening.json`: generic instructions, lengths, A/B/C labels and key commitment.
- `scores-template.json`: blank human preference scores and notes, tied to the key.

Nothing in `public/` contains the seed, hypotheses, candidate/source hashes,
project names or measurements. WAVs have a plain 44-byte header with no metadata.
A domain-separated HMAC stream with rejection sampling and Fisher–Yates assigns
A/B/C reproducibly. Only three labels means only six possible assignments;
never treat the permutation as encryption.

`private/` holds the identity key, original project-byte and asset snapshots,
engine render/analysis artifacts and stems, source verification, JSON-pointer
changes (before/after), asset-hash changes, timing evidence and toolchain pin.
Original files are never written; hashes are checked again before publication.
`private/replay-experiment.json` remaps inputs to the self-contained snapshots:
run it with `private/toolchain.json` and a fresh output to reproduce audio after
moving the package. Path remapping changes definition/key hashes; absolute
input-integrity paths also change when inputs move.
The key is mode 0600 inside mode 0700. `input-integrity.json` records which
original paths were verified unchanged. The public SHA-256 commitment binds the
key before judging. The private source ZIP and generated benchmark audio are
not committed to the repository.

Use a separate trusted preparer and a judging context that cannot access private
inputs, key, definition, seed, process arguments or preparation logs. Same-user
filesystem permissions do not enforce blindness against that user. A preparer
can identify candidates at any time; the evaluation command only reads/reveals
the key after a complete, bound score sheet validates. Software cannot verify
that submitted numbers actually came from a human or that judging was blind.

Scores use version 1, the unchanged keySha256, a nonblank judge name, all three
numeric scores 0–10 (higher is preferred) and string notes for A/B/C. No default
scores are accepted. Evaluation verifies key and audio hashes, preserves the
score-sheet hash, reveals hypotheses and identities, reports preference order,
metrics, timing, changes, and all tied winners. A report is private and is never
written over an existing file. Do not put it in the judging distribution folder.
There is no winner before scores, and no automated musical ranking.

## Loudness and reproducibility contract

Whole-track input loudness and true peak are measured with the engine FFmpeg
analyzer. The shared effective target is the smaller of the requested target
and each candidate's whole-track `integratedLufs + ceilingDbtp - max(wholeTruePeak, windowTruePeak) - 0.1`, rounded
down to 0.1 LU. Static gain only; **no limiter, compressor, fade or time shift**
is added by the lab. Lowering for headroom is explicit in the CLI result, key
and final report. Excerpts preserve the full-track gain, so their LUFS can differ;
the selected window is not independently normalized. Raw and listening whole-
track/window measurements include RMS, sample peak, LUFS, LRA, true peak and
full-scale counts. Short/quiet windows may have null LUFS, and retain that null.

The source and each candidate render twice. All engine files (WAV, MIDI, stems,
manifest, analysis) must hash identically within each pair. Every matched full
WAV encodes twice and hash-compares; copies must have exact frames, finite
whole-track LUFS/true peak, ±0.3 LU target accuracy, zero full-scale samples and
true peak at/below the ceiling. Selected copies also verify exact window length,
zero full-scale samples and peak headroom (including possible cut-edge overshoot).
Any engine clipping count, clipping warning or
full-scale sample fails before matching. Bad targets, silence, changed inputs,
failed timing, tool failures or differing renders remove staging and publish
nothing. Existing outputs, even dangling symlinks, fail untouched. Use a trusted
output parent without concurrent writers. Process termination (including interruption) or
power loss can leave an unpublished `.agent-lab-*` scratch directory to remove.

Pins include all engine source and lab implementation hashes, Node version and
binary hash, platform/architecture, FFmpeg full version/configuration and binary
hash, optional FluidSynth binary/version and SoundFont hash, plus fixed rendering
and matching settings. Tool selection is rechecked at the end. Shared libraries,
OS kernel, CPU behavior and environment variables are not fully hermetic; a
lock is not a container image. Retain the runtime for archival reproduction.
Cross-host bit identity is not claimed. Two identical renders detect observed
nondeterminism, not every possible future source of it. GM is supported by the
same pipeline and pins, but the first benchmark and focused tests use samples.

## PRE-ECHO 001

The first benchmark uses the supplied private ZIP, which is kept outside Git.
Extract it into a private scratch directory. The helper reads only `project.json`,
`intent.json` and engine-resolved assets; it never executes attached scripts or
adopts instructions in the archive. It requires the known 12-second clock and
four target contact samples, and creates new source/candidate copies.

```sh
node agent-lab/prepare-pre-echo.mjs /private/extracted/experiments/pre-echo-001 /private/pre-echo-lab
node agent-lab/cli.mjs pin /private/pre-echo-lab/experiment.json /private/pre-echo-lab/toolchain.json
node agent-lab/cli.mjs run /private/pre-echo-lab/experiment.json /private/pre-echo-lab/toolchain.json /runs/pre-echo-001
```

The agent-authored hypotheses vary room gain/filtering, dread gain arc, or
background spatial placement/filtering. Dry contact assets, schedules, envelopes
and source offsets remain unchanged. Duration is 529200 frames (12 seconds).
Latch/glass onsets are 66150/198450; taps are 374850/383670 (±1 frame detector
tolerance). Last second must stay below −80 dBFS. Listening window is 7–10 s.
This preserves the supplied picture relationship: latch/glass lead their visual
actions by one second, while taps follow their visual reflection by one second.
The lab checks audio, not video frame content. The helper fails if the fixture
is missing; it never invents PRE-ECHO. Self-contained synthetic real-PCM fixtures
in the focused tests allow development without the private ZIP.

## Tests and workflow comparison

```sh
npm run test:agent-lab
npm run check
```

Focused tests generate small synthetic assets in scratch, exercise actual engine
and FFmpeg renders, compare complete experiment trees, validate immutability,
anonymity, gain/headroom, timing, scoring, ties and tamper handling, and reject
missing/duplicate candidates, stale pins, bad durations, clipping and silence.
See `VERIFICATION.md` for the measured PRE-ECHO run and check results.

For three prepared candidates, the direct engine CLI needs three render
commands; each render already validates its project and measures whole-track
audio. The documented explicit preflight workflow adds three optional standalone
validate commands. The current BANGER LAB copy utility adds a pool definition
and one preparation command for supported 15/75-second pools: **four commands**
(or seven with explicit validation). It does not support PRE-ECHO's 12-second
container. A direct PRE-ECHO workflow instead needs at least three separate
FFmpeg gain commands after its three renders: **at least six commands** (or nine
with explicit validation), before measurement-driven gain calculation, selected-
window extraction/analysis, provenance/timing checks and blind packaging.
These are lower bounds from the actual interfaces, not observed human-study
counts. Repeated renders add more work.

Agent Lab uses one pin setup command and **one comparison command**, followed
by one evaluation command after the required human listening/scoring step.
PRE-ECHO's helper adds one optional fixture/candidate preparation command.
Authoring candidates, choosing hypotheses/constraints, listening and deciding
remain human/agent interventions. Exact historical intervention counts were
not recorded. No token savings, creative-quality gains or elapsed-time savings
are inferred from command counts; repeat checks intentionally add computation.
