# DaemonV12 Beat Battle — Round 3: ONE SOUND

Status: **organizer-ready ruleset; no contestant run has begun**.

## Frozen references

- **DaemonV12 engine Git commit:** `ed75e9e2a0172266e56b292886ad7c1500677862` (the Composer reference's verified engine base).
- **DaemonV12 Composer v0.2 package Git commit:** `e8aa219903204bf0ed4086a2334f414906a59ecf` (PR #18 merged).
- **Source:** `round3_source_csharp3_1500ms.wav`.
- **Source SHA-256:** `f77e088abd24d4f05f6ad18e898d569567ea70560cc3e68a7264cbdebb6e7be4`.
- Composer v0.2 **must** be exported from the frozen commit; export byte-identical plugin files to each contestant; do not install a moving-main version.
- Use the same Node build, DaemonV12 dependency lockfile, FFmpeg build, and runtime hardware. No General MIDI/FluidSynth/SoundFont voices may be used. Keep Composer separate from the frozen engine checkout.

## Shared creative brief

Build a memorable, original **30.000-second beat** in **C# minor**, **128 BPM**, **4/4**, exactly **16 bars**, with a clear rhythmic identity, an identifiable hook or motif, contrast/development, a consequential payoff, and a purposeful ending that encourages replay. **Any genre, groove, or arrangement is welcome.** The supplied one-shot is the only permitted audible source.

## Single-source rule — strict

1. Every audible source note must reference **the exact supplied WAV bytes**. Copies into a project's `assets/` directory may be renamed only if their SHA-256 remains identical. All performed source voices must come from that file.
2. **Allowed:** native DaemonV12 sampler `playbackRate`, `glide`, `offsetSeconds`, independent triggering, track layering, gain/pan and supported gain/pan automation, and supported native track/master effects. These must be described by the project JSON and rendered by the frozen engine.
3. **Forbidden:** pre-trimmed slices, reversed copies, pitch-shifted/resampled copies, filtered/baked/normalized derivatives, crossfaded sample files, newly synthesized/recorded WAVs, imported loops, drum kits, GM/SoundFont instruments, external synths, vocals, external mastering or editing of the submitted WAV, and adding audible material through external renderers.
4. Temporary diagnostic or analytical files are permitted **only for investigation**; they may not become audio sources or be mixed into the submitted composition. Do not change the source file or engine to bypass sampler limitations.
5. The engine's sampler plays through the remaining sample; there is **no note-off/choke, native reverse, or per-note end offset**. Do not invent unsupported project keys. Observe actual playback memory/work preflight limits.

## Equal run budget

- Exactly the same contestant-facing prompt, plugin bytes, WAV bytes, engine, tool/build versions, environment and file access.
- **60 minutes maximum per contestant** from prompt delivery to final artifact lock, recorded by the organizer. Do not claim equivalent token budgets across vendors.
- Complete **V1, V2, V3**, each with a distinct, complete rendered piece and a documented musical change. Identify three musical weaknesses before each revision, grounded in a section/time and evidence. Render snapshots and track their actual paths.
- After V3, perform the Composer v0.2 **Risk Pass**. V4 and V5 are allowed for musical hypotheses with stated keep/revert criteria, not required. **At most five serious full versions**. The mandatory second deterministic final render does not count as a creative version.
- No competitor submissions, competitor analyses, or earlier round songs may be inspected.
- Use the production route consistently; render WAV and aligned stems. Log unavoidable environmental mismatches before proceeding.

## Technical pass/fail

- Final duration: **1,323,000 frames** at 44,100 Hz = exactly 30.000 s.
- Final rendered audio non-silent, valid stereo PCM16 WAV, no full-scale clipping; investigate track preclip metrics and true peak. No artificial loudness contest.
- Validated DaemonV12 JSON with all sample assets resolving inside the project assets directory. Source hash must match the above.
- Final complete project, WAV, aligned stems, `*.analysis.json`, `*.render.json`, `production-log.md`, `SHA256SUMS.txt` and proof of a second deterministic master/stem render from the same input/tool versions.
- Report if a check cannot be performed; never invent hearing, playback-device tests, deterministic equality or analysis measurements.

## Blind listening and judging

Organizer assigns anonymous IDs (A/B/C) *after* submissions; contestants never choose identity-revealing judge names. Judge original final WAVs, with **organizer-made loudness-matched listening copies** used only for fair comparison. Keep originals unmodified for technical checks. Blind scores out of 100:

| Dimension | Weight |
| --- | ---: |
| Hook / replay memorability | 30 |
| Rhythm and low-end musical authority | 25 |
| Musical arc / contrast / payoff / replay ending | 20 |
| Mix clarity, continuity and translation | 15 |
| Inventive yet coherent use of one sound | 10 |

Judge by human listening rather than maximizing measurements. Listen to the first 1/3/5 seconds, full arc, arrival and final 3 seconds, then ending into opening. At least one headphone listen plus another playback device where available. Log the device and uncertainties; do not assert unavailable tests.
