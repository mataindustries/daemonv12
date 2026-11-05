# Muse Wonder Max × DaemonV12 — Blind Composition Benchmark 001

## Purpose

Measure whether **Muse Wonder 1.0 (Max reasoning)** can compose original, distinctive music with the same **DaemonV12** headless-engine capabilities previously used by Opus. This is a **creative and technical benchmark**, not a music-video edit and not a Meta hackathon submission. The human listener judges without being told which agent created which cue.

**Run location:** `mataindustries/daemonv12`, branch `feat/wonder-max-music-benchmark`.
**Output folder:** `benchmarks/wonder-max-001/` (small editable source, manifests, evaluation; large renders kept ignored/local).
**MCP:** Use the connected `daemonv12` server with its own isolated writable workspace.

## Strict blind-run boundary

- Do **not read** `experiments/thingmania-ost/`, any Opus compositions, past A/B/C audition reports, `final/`, or the official PUMP soundtrack. These are reference results used **after** your run, not creative input. No references or samples from those tracks.
- Read only engine/API documentation, tool schemas, licensing notes, and available approved CC0 packs. You may explore `README.md`, `docs/MCP_CLIENTS.md`, `docs/V0_SPEC.md`, and the original engine's project format examples outside the forbidden comparison tree.
- No General MIDI instrument or FluidR3 SoundFont whose commercial sampling rights are unclear. Use original deterministic synthesized WAV palettes or bundled CC0 packs, with precise provenance.
- Do not modify DaemonV12's renderer, shared assets, engine code, existing experiments, or any THING//MANIA code.
- Do not claim listening if audio playback/perception is unavailable; report your musical intentions, actual renders, and objective measurements separately.

## Common brief — three independently original four-bar auditions

Design three short **arcade theme candidates** that could stand alone as memorable game music. The game theme is mischievous, playful, physical, and unpredictable, but the music must be worth listening to outside the game. **Choose your own key, tempo, harmony, meter, instruments, rhythm, structure and original hook**. Sound identity matters more than busy arpeggios or excessive effects.

- **A · Groove:** Bass-forward, unmistakable pocket and a clear two-second hook. A musical payoff in bar 4.
- **B · Harmonic:** An evocative, harmonically surprising motif with rhythmic invention and a resolution that makes the loop addictive. A musical payoff in bar 4.
- **C · Wildcard:** High originality, risk-taking instrumentation or meter, but genuinely singable or memorable. A musical payoff in bar 4.

Each cue must last **exactly four bars** at its chosen tempo. Prefer 90–150 BPM unless the musical concept justifies otherwise. Each audition must have **at most 15 tracks**; produce individual WAV, MP3 preview, and editable DaemonV12 JSON. Where feasible include aligned stems, loop-ready export and an x4 listening copy to test repetition. Avoid repetitive underscore and generic chord-loop presets.

Each cue needs:
1. A one-sentence hook description and why it is different.
2. Musical score events that actually realize that hook.
3. A named, rights-cleared sound palette; one strong original instrument per cue is encouraged.
4. A **real** successful project validation and actual audio render.
5. Target original mastered loudness around `-16 LUFS` (tolerance ±2 LU), true peak below `-1 dBTP`, no clipping; reasonable mono and simulated phone reproduction.
6. A seam analysis and second render comparison where affordable, with limitations disclosed.
7. One evidence-driven creative/technical revision **maximum per cue** if needed. Preserve the initial version for audit where convenient; no endless revision loop.

## Agent workflow and spending discipline

- Before composition, call an actual DaemonV12 MCP discovery tool (e.g., instruments or project/list) and verify a successful response. If unavailable, **STOP** with the exact error; do not hallucinate tool calls.
- Inventory the working audio tools once (Node, ffmpeg; FluidSynth optional). Do not install system-wide software unless necessary; no debugging rabbit hole.
- Allocate an equal, bounded process budget to A/B/C. Do not spend the entire run perfecting A while omitting B and C. First make all three renderable, then one targeted revision pass at most.
- Prefer the MCP API for musical operations. If the tools can't express original palette generation, use a small deterministic local synthesis script in `benchmarks/wonder-max-001/` to create WAVs and import through DaemonV12; keep all generated assets isolated.
- All external paid costs are Meta Model API calls for your agent. **No hard API quota is enforced by this prompt.** Monitor spend manually and abort if the agent repeats failed calls.
- Do not re-use official THING//MANIA PUMP or Opus audition material. Novelty here must come from independent composition.
- Do not upload generated audio into Git when large; save a short local preview or publish small MP3s if allowed. Never commit secrets, private recordings or proprietary soundfonts.

## Results and reproducibility

Produce:
- `benchmarks/wonder-max-001/README.md`: musical thesis for A/B/C, comparisons grounded in actual audio and caveats, clear reproduction steps, total tool calls and costs if measurable.
- `benchmarks/wonder-max-001/a.json`, `b.json`, `c.json`: editable complete projects, or a clear manifest pointing at isolated MCP workspace projects.
- `benchmarks/wonder-max-001/analysis/results.json`: timings, LUFS, true peak, clipping, mono loss, phone proxy, render hashes, success/failure, environment.
- `benchmarks/wonder-max-001/previews/`: short MP3 previews for listening if file sizes permit.
- Per-cue stems/manifests and exact final WAV paths within the isolated workspace.
- A command list / headless regeneration script using DaemonV12, without secret keys.
- Clear label if any quality metric is untested or a render is absent.

**Stop after three actual auditions.** The owner will perform a **blind comparison** against existing Opus cues. Do not declare yourself the winner. An eventual winner may be expanded into a longer arrangement in a separate follow-up challenge.

## Blind listening rubric (human only)

- Memorable hook and replayability: **35%**
- Bass/groove/rhythm: **25%**
- Originality and creative surprise: **20%**
- Sound design, mixing and technical quality: **15%**
- Emotional/personality fit for a whimsical arcade: **5%**

The three cue files should be anonymized (W1/W2/W3) for listening. Comparison against Opus is performed externally to this agent run after all files are final and level-matched. No model comparisons based on unverifiable subjective self-scores.
