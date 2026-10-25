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

## 1–4. Verify, define, choose hooks, render

1. **Verify environment.** Locate the engine checkout and a separate composition
   workspace. Record engine commit and tool versions. Run `git rev-parse HEAD`,
   `node bin/daemonv12.js doctor --json` and `node bin/daemonv12.js --help`.
   Read [engine production notes](references/daemonv12-production-notes.md) and
   the selected catalog before authoring. Reuse verified environment/spec notes;
   investigate only changed or uncertain controls instead of repeating engine
   reconnaissance. Verify a small render through the intended route; use
   documented `init` for a new workspace. Diagnose actual failures and disclose blocked capabilities. Consult [headless audio](references/headless-audio.md)
   only for an audio-device initialization problem; do not apply its wrapper automatically.
2. **Write a six-line musical thesis:** hook; rhythmic identity or pacing;
   low-end role (or deliberate absence); contrast idea; payoff; ending.
   For an existing piece, infer and preserve its thesis unless the brief asks
   for a new direction. Read [short-form composition](references/short-form-composition.md)
   for arc, continuity, development and replay decisions; no fixed structure,
   key, BPM or palette is required.
3. **Choose roles, then compare hooks.** Read the portable
   [hook-first reference](references/hook-first.md). For a new composition, make
   **3–4 short competing hooks** before building a full arrangement: different
   rhythms and contours, not merely transpositions or new timbres. Use 2–4 bars
   (or a similarly short gesture for free-time music), minimal accompaniment,
   and declare low-end ownership before adding layers. Validate each sketch
   before a cheap dry render; defer full effects/stems until a winner is chosen.
   Human listening selects when available; otherwise record a provisional
   score-based choice and its uncertainty. Save the winning hook unchanged as
   an anchor. For revisions, preserve the established hook unless replacing it
   is the explicit hypothesis; do not restart a hook search for every edit.
   **Optional Signature Pack mode:** when requested or choosing that available
   palette, use [Signature Pack mode](references/signature-pack.md); confirm
   assets/catalog first. Missing pack: use verified available sounds and keep
   this workflow. No pack installation is required. Check tuning,
   source length, transformed tails and kick/bass overlap. More layers do not
   automatically create richness. Use v0.7 `gate`, `endSeconds`, per-voice
   `envelope` and track-local `chokeGroup` for sampled-note shape and spacing. Gates/chokes release sampled
   voices; they are not generic MIDI note-off. Read the
   [electronic-production recipes](references/electronic-production.md) when
   writing electronic parts; validate against the selected engine and assets.
4. **Expand the winner into complete V1.** Plan contrast through subtraction,
   harmonic movement and changed rhythmic patterns before adding layers.
   Repeat the hook so it becomes learnable; change its context or answer rather
   than erase its identity. Include a complete ending; establish identity
   within roughly the first 3–5 seconds. Establish repetition, then change its
   consequence. Leave space for the central idea before polishing details.

## 5–9. Evidence and three serious versions

Hook sketches are preflight, not V1–V3. The normal full workflow retains
separate `v1`, `v2`, `v3` project snapshots and complete renders. Use the actual
returned paths. Keep the same render route across comparisons;
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

7–8. Before V2, name what must survive: the hook's defining rhythm/contour and
any successful groove or arrival. Change only the roles/bars implicated by the
critique; compare against the saved anchor. Make V2, render, compare, and name
its three weaknesses.
9. Make V3 from that critique, render, compare, and record its status. **V1–V3
remain the normal full workflow**, with meaningful musical revisions. Renames,
identical rerenders, output formats and arbitrary gain edits do not count.
If no defensible musical change remains, keep the stronger version, record the
early-stop evidence and omitted versions, and complete review/Risk Pass on it.
Do not invent weaknesses to reach V3. Also disclose steps omitted by user
constraints. Keep or revert changes by musical consequence. Use the compact
[production log](assets/production-log.md).
Event, track, effect and automation counts or loudness are evidence, never
quality scores. Never assign an automatic musical quality score.

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

After V3 (or an evidence-based early stop), when the piece is technically clean,
coherent, balanced and structurally complete, **perform a Risk Pass**. Ask:
“What one high-upside musical decision could make this significantly more
memorable without destroying coherence?”

Propose **ONE risk**, its memorability upside, what could go wrong, the cheapest
useful test, and the musical evidence for **keep/revert**. Examples of possible
directions live in the short-form reference; they are not prescriptions. Test a
promising risk against the competent version. Revert a failed risk: useful
experimentation still counts. If the existing record is clearly stronger without
the proposed change, document why and keep it. Do not introduce random weirdness
or require a risky edit just to satisfy the pass. If competence is not yet reached,
address the specific defect before considering risk.

## 15. Optional V4/V5: compute discipline

**Every additional version after V3, and any rendered Risk Pass**, must state:

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
clean lock. A necessary repair still needs a bounded hypothesis and, beyond V5,
an unusually strong reason recorded before work or a user override; disclose a
defect that cannot be resolved within user constraints. Do not create analysis
software unless **all three** hold:
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

For video delivery, follow the [music-to-video handoff](references/music-to-video.md):
explicit fixed duration, deliberate tail policy and engine-resolved cue frames.

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
