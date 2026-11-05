# V12 SIGNATURE — Music Benchmark 002 / Corrected Instrument Access

**Reason for this run:** Benchmark 001 on `feat/wonder-max-music-benchmark` was forked from `feat/thingmania-ost-final`, a branch which **did not include the 16-instrument V12 Signature pack**. Its three 4-bar W1/W2/W3 sketches therefore cannot assess that pack. This run starts from `main` after Signature pack integration.

**Model:** This is a *model-neutral* challenge. Run the identical brief, source commit, sample files, time budget and output tests for each agent (Muse Wonder Max, Opus 5.5, Sol, etc.). Don't use earlier model outputs as inspiration. Use one separate isolated directory/session per model. The exact model and settings must be recorded by the operator. If evaluating only Muse Wonder in this iteration, label it a single-model pilot, not a proven ranking.

## Step 0 — Prove sound access before composing

- Repo: `mataindustries/daemonv12`, branch `feat/signature-benchmark-002` (based on the actual `main` that includes `packs/v12-signature-v1/`).
- Read the **instrument inventory and constraints only** from `packs/v12-signature-v1/README.md`. Read `PROVENANCE.md` for rights limitations. Avoid showcase/IGNITION audio and score, COMPOSER_PLAYBOOK, previous Opus or Wonder compositions, `experiments/thingmania-ost/`, and previous audition reports.
- Run `git status --short`, `node --version`, `node bin/daemonv12.js doctor`, `node bin/daemonv12.js --help`. Check `packs/v12-signature-v1/assets/v12-signature/kit.json`, presence of the **16 source WAVs**, and SHA-256 values from the pack's catalog.
- **Important:** The pack is **opt-in**, NOT copied by `daemonv12 init`. Explicitly copy or safely reference its approved source WAVs and kit into the isolated benchmark workspace in a way accepted by DaemonV12's project-path validator. Do not presume they are available simply because the server starts.
- Validate a minimal 2-second sample-only test with at least SUB HAMMER, REACTOR and PHANTOM. Report the actual asset names and file hashes. STOP immediately and report a blocker if the new pack cannot be loaded.
- Muse Wonder's previous `daemonv12_instruments_list` MCP call failed due to invalid JSON arguments. You may use DaemonV12's public CLI with editable JSON and Node scripts if MCP is not reliable. Do not spend credits debugging repeated invalid tool calls. Record whether the run was `MCP` or `CLI`.
- No GM, FluidR3 SoundFont or third-party unlicensed samples. The Signature pack's commercial licensing declaration remains **pending**; outputs are for private evaluation until rights are resolved.

## The creative challenge — one serious 28-second composition

**Title:** V12 SIGNATURE / UNEXPECTED ARRIVAL
**Thesis:** Produce a memorable, technically bold electronic music cue with an emotional arc, not generic game-menu plinks or a four-bar loop. Use the original, dark/cinematic/hypnotic Signature identity but invent your own hooks and arrangement. Do not copy or quote IGNITION or a prior track.

All models receive the same prompt and the same 16 instruments. Pick your own tempo, key and harmony inside the samples' usable playing range, using genuine note/rate mappings. Produce **exactly 28.000 seconds** (44,100 Hz, 1,234,800 audio frames) with a deliberate musically resolved ending. An 8–16-second idea repeated without evolution is **not sufficient**.

### Musical form / dynamic expectation
- **0–4s:** Immediate memorable motif or provocative sonic signature; listeners must understand the hook quickly.
- **4–11s:** Establish undeniable groove, low-end lock and a contrasting answering phrase.
- **11–17s:** Change harmony, meter, or texture enough to create real suspense. Use silence/negative space deliberately.
- **17–24s:** Main payoff: hook returns transformed; one genuinely surprising gesture that is musically earned.
- **24–28s:** Designed finale, clean decay and an intentional final cadence; NOT a random bell after the music ends.

Use **at least eight distinct Signature pack sources**, including minimum one drum, ABYSS or REACTOR as bass, SIGNAL or PHANTOM as a recognizable lead, and one atmosphere/choir voice. More instruments do not inherently mean better music; use only parts that serve the arrangement. No unrelated substitute palette. Main hook must be audible on phone speakers and at low volume.

### Files and QA
- One DaemonV12 editable JSON score; original compositional material, validated before rendering, with full palette manifest/hashes and reproducible commands.
- One actual rendered 28.000-second WAV master, MP3 listening copy, and aligned stems if feasible.
- Master around -16 LUFS (tolerance ±2), **true peak ≤ -1 dBTP**, zero clipped PCM samples. Measure mono fold-down, phone proxy, low-end and timing, plus render determinism where practical.
- Capture exact tool versions/environment, project and audio SHA256, wall time, source sample list, and available Meta API usage/estimated cost. Do not fabricate prices or self-reported listening.
- Creative self-review may be tentative, but technical claims must come from renders.
- Allow one broad arrangement pass and **one bounded corrective render** if evidence finds a problem; keep the earlier version for comparison and label which is final.
- Output isolated small source/documents under `benchmarks/signature-002/<model-slug>/`; large WAVs/stems and preview MP3s in `benchmarks/signature-002/<model-slug>/renders/` or a designated ignored workspace. Do not touch the released engine, pack files, existing experiments or THING//MANIA.
- At completion, report exactly where the human can download the 28s MP3, what instruments were truly used, SHA256 and core measurements. No claim of beating other models before a level-matched blind human listen.

**STOP after the single finished 28-second composition.** This is a capability benchmark, not a release, content campaign, or multi-song production sprint.
