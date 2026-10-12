---
name: daemonv12-composer
description: Compose, produce, or improve music with DaemonV12, including beats, songs, cues, loops, harder arrivals, and tracks that sound too safe. Use when DaemonV12 is the requested or established music engine. Do not use for engine implementation, explanations of DaemonV12 or FluidSynth, README edits, pull-request reviews, or unrelated audio tasks.
---

# DaemonV12 Composer

Make a technically competent piece memorable through deliberate musical choices.
DaemonV12 is an instrument, not a style. Adapt to the user's genre, duration and
purpose; when duration is open, a complete 25–30 second arc is a useful starting
point. In ambient or cinematic work, a hook may be a texture, groove may be
intentional pacing, and payoff may be sudden intimacy rather than a drop.

User instructions override the normal full workflow. Make reasonable creative
decisions, keep planning short, and render early. Preserve user work. Use the
existing CLI/project format; never modify the engine, invent fields, or require
MCP installation. This skill provides process, not a quality guarantee.

## 1–4. Verify, define, choose, render

1. **Verify environment.** Locate the engine checkout and a separate composition
   workspace. Record engine commit and tool versions. Run `git rev-parse HEAD`,
   `node bin/daemonv12.js doctor --json` and `node bin/daemonv12.js --help`.
   Read [engine production notes](references/daemonv12-production-notes.md) and
   the current specs/catalogs before authoring. Verify a small render through the
   intended route; use documented `init` for a new workspace. Diagnose actual
   failures and disclose blocked capabilities. Consult [headless audio](references/headless-audio.md)
   only for an audio-device initialization problem; do not apply its wrapper automatically.
2. **Write a six-line musical thesis:** hook; rhythmic identity; low-end role;
   contrast idea; payoff; ending. For an existing piece, infer and preserve its
   thesis unless the brief asks for a new direction. Read [short-form composition](references/short-form-composition.md)
   for arc, continuity, development and replay decisions; no fixed structure,
   key, BPM or palette is required.
3. **Choose an intentional palette.** Give each sound a job. Check tuning,
   source length, transformed tails and kick/bass overlap. More layers do not
   automatically create richness. Use supported timing/source preparation for
   bass monophony where useful; do not invent sampler choke or note-off controls.
4. **Render complete V1 quickly.** Include the ending and identity within roughly
   3–5 seconds. Establish repetition, then change its consequence. Leave space
   for the central idea before polishing details.

## 5–9. Evidence and three serious versions

Validate and render separate `v1`, `v2`, `v3` project snapshots and outputs. Use
the actual returned paths. Keep the same render route across comparisons;
choose production routing when aligned stems/exact duration matter. Reuse the
written analysis report before rerunning native analysis:

```sh
node bin/daemonv12.js validate /path/to/project.json --json
node bin/daemonv12.js render /path/to/project.json --out-dir /path/to/v1 --stems --format wav --json
node bin/daemonv12.js analyze /path/to/v1/project.wav --json
```

Read [production analysis](references/production-analysis.md) for metric limits
and targeted section comparisons. Inspect overload, true peak, masking,
automation boundaries and sample transformations before assuming a musical
failure. Read current schema/spec/source for uncertain controls. Measurements,
score inspection and human feedback are distinct kinds of evidence; label
unavailable measurements and proxy judgments. Never claim to have heard a track
or tested physical playback devices without that evidence.

5–6. Analyze V1 and name **three musical weaknesses**, each with section/time,
evidence, likely cause and intended change. “Low LUFS” or “few effects” alone is
not a musical weakness. If evidence is uncertain, name a hypothesis; never
manufacture defects to fill slots.

7–8. Make V2 from that critique, render, compare, and name its three weaknesses.
9. Make V3 from that critique, render, compare, and record its status. **V1–V3
are required in the normal full workflow:** complete renders and meaningful
musical revisions. Renames, identical rerenders, output formats and arbitrary
gain edits do not count. If user constraints prevent the full workflow, disclose
the omitted steps. Keep or revert changes by musical consequence. Use the
compact [production log](assets/production-log.md).
Event, track, effect and automation counts or loudness are evidence, never
quality scores.

## 10–13. Review the record

- **10. OPENING CONTINUITY CHECK:** inspect the **first 1 second** for deliberate
  initial impression, **first 3 seconds** for identity, and **first 5 seconds**
  for continuity. Does the first gesture resolve into or interact with what
  follows? Does the next section honor its rhythmic/harmonic/contextual promise?
  Check a confusing first beat/bar, an abruptly pasted hook, and whether trimming
  or shifting improves flow. Distinctive can still be awkward. Make the opening
  make musical sense; volume is not the cure.
- **11. IMPACT TEST:** compare the arrival with its setup. Check low-end
  authority/timing, transient contrast, useful register range, hook presence,
  appropriate top end, actual stereo-content contrast, density, negative space
  and musical consequence. A louder payoff can feel smaller. A quiet arrival
  can be consequential. Transform established material rather than merely
  stack layers; do not solve impact only with master gain.
- **12. FINAL 3 SECONDS:** inspect resolution, final gesture, tail and boundary,
  then ending followed by opening. Compare replay-friendly alternatives if an
  interesting effect damages the return. Recheck the whole arc after an excerpt edit.
- **13. TRANSLATION ROBUSTNESS PROXY:** ask whether identity depends too much on
  sub alone, extreme/phase-dependent width, ultra-high frequencies or barely
  audible ambience. Check mono behavior, useful midrange identity, readable
  transients and kick/bass relationship. These are proxies; human phone/car/
  headphone listening remains the judge.

For suspected **120–500 Hz** buildup, check overlapping roles, register, source
lengths and tails before supported filtering. This range can provide warmth,
weight and body; it is not a universal problem band. Verify available processing;
DaemonV12 has no conventional parametric EQ. Pan is stereo balance, not a source
of decorrelation: width can come from differing left/right content, answers,
timbral/octave doubles and section contrast. See the verified engine notes.

## 14. RISK PASS: risk after competence

After V3, when the piece is technically clean, coherent, balanced and structurally
complete, **perform a Risk Pass**. Ask: “What one high-upside musical decision
could make this significantly more memorable without destroying coherence?”

Propose **ONE risk**, its memorability upside, what could go wrong, the cheapest
useful test, and the musical evidence for **keep/revert**. Examples of possible
directions live in the short-form reference; they are not prescriptions. Test a
promising risk against the competent version. Revert a failed risk: useful
experimentation still counts. If the existing record is clearly stronger without
the proposed change, document why and keep it. Do not introduce random weirdness
or require a risky edit just to satisfy the pass. If competence is not yet reached,
address the specific defect before considering risk.

## 15. Optional V4/V5: compute discipline

**Every additional version after V3**, including a rendered risk test, must state:

- **MUSICAL HYPOTHESIS:** what exact audible musical improvement is expected?
- **EVIDENCE NEEDED:** what minimum evidence decides it?
- **COST:** one score edit, one render, one existing analysis, or unnecessary tooling?
- **KEEP / REVERT CRITERION:** what result justifies keeping the change?

**ANALYSIS TIME MUST NOT GROW FASTER THAN MUSICAL IMPROVEMENT.** Default maximum:
**5 serious versions**. V4/V5 need explicit musical hypotheses; beyond V5 needs
an unusually strong reason recorded before work. This is a composition budget,
not an engine limit; the user may override it. A focused excerpt can cheaply
reject a risk before rendering another complete version.

If two consecutive revisions yield only marginal improvements, compare them,
keep the stronger one and stop speculative iteration. Complete the required
review/Risk Pass and address a demonstrated technical defect before claiming a
clean lock. A necessary repair still needs a bounded hypothesis and the version
budget exception when applicable; disclose a defect that cannot be resolved
within user constraints. Do not create analysis software unless **all three** hold:
there is a specific unresolved musical question; existing DaemonV12/FFmpeg/tools
cannot answer it; and its answer could plausibly change a musical decision.
“I want more metrics” is insufficient. Prefer composition over tooling.

## 16–17. SHOULD I STOP? Then lock

Lock when the thesis reads clearly, opening is intentional, hook is legible,
groove/pacing works, payoff is consequential, ending supports replay, and no
obvious technical defect remains. Stop when remaining ideas are speculative or
two recent revisions have not materially improved the piece; do not invent
more edits to spend the remaining version budget. A finished strong track is
better than an endlessly analyzed track.

Preserve final project/assets, WAV, aligned stems, analysis, log and `.render.json`
provenance. Record asset origins/licenses, engine commit, Node/audio-tool versions,
SoundFont hash and any wrapper. Compute SHA-256 hashes. Render the frozen project
again to a fresh directory where practical and compare master/stem hashes under
identical tools/assets; disclose mismatches or an unperformed check. MP3 is an
optional listening copy. Deliver paths, a short musical rationale, meaningful
iteration results and unresolved evidence limits.

## Optional BENCHMARK MODE

Enable only on a user/organizer benchmark request. Add common engine and Composer
revision/hash pins, isolated contestant workspaces, no competitor inspection,
equal brief/assets/tools/budget and an agreed iteration policy. Keep skill files
separate from the frozen engine. Require a deterministic second final WAV/stem
render and a clean blind submission with private provenance; disclose deviations
and blockers. Normal composition needs none of this setup. Historical/future
handoffs are package docs; loading this skill starts no benchmark.
