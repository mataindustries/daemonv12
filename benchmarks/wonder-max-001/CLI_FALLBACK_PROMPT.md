# Muse Wonder Max × DaemonV12 — CLI fallback after MCP argument-JSON failure

**Important labeling:** This is the **CLI fallback**, NOT proof that Wonder successfully invoked MCP. Use only if the single explicit-`{}` DaemonV12 MCP smoke test fails with `"arguments" must be valid JSON` again. The original blind A/B/C music challenge remains the creative brief, except the audio engine is driven via its published Node CLI and editable JSON files rather than MCP calls. Keep experiment results separate to compare model creativity while reporting tool-integration reliability honestly.

You are Muse Wonder 1.0 at Max effort, working in `mataindustries/daemonv12` on `feat/wonder-max-music-benchmark`. Read `benchmarks/wonder-max-001/WONDER_MAX_BENCHMARK_PROMPT.md` only for the musical brief and scoring/budget constraints. The mandatory MCP-discovery and MCP-operation clauses are superseded by **CLI fallback mode** below.

First inspect `node bin/daemonv12.js --help` and `node bin/daemonv12.js doctor`, confirm sample-only rendering and FFmpeg availability. Never invoke `daemonv12_*` MCP tools in this run; their transport produced invalid-JSON arguments. Use normal shell commands through Codex and DaemonV12's public CLI for validation, rendering, WAV/MP3/stems, analysis and repeatability.

Create three **independent**, original four-bar candidate themes: A bass-forward groove; B evocative harmonic invention; C wild risky singable idea. Use only rights-cleared/original deterministic sample synthesis and permitted bundled CC0 packs. No General MIDI/FluidR3. Do NOT inspect the earlier Opus tracks, PUMP, official OST, or `experiments/thingmania-ost/`. No game modifications.

Keep source and small documentation under `benchmarks/wonder-max-001/cli-fallback/` and large rendered WAV/stems/MP3 intermediates in an ignored directory. Match the same core benchmarks: target ~-16 LUFS ±2, < -1 dBTP, clip-free, 4 bars, ≤15 tracks, phone/mono checks, actual loop seam and one revision maximum per candidate.

Finish all three before polishing one. Output three playable anonymized MP3 auditions named W1/W2/W3 and editable project JSONs. Include actual filenames, durations, render hashes, LUFS, true peaks, and commands to regenerate. Document the first MCP-call error separately. Do not claim MCP integration passed. Do not claim subjective listening if unavailable. No more than one complete render and one technical correction per candidate unless required for correctness. Stop when three files are ready or report an honest blocker; no endless retries and no system-wide installs.

The owner will listen blind against Opus later, using a standardized playback level and a separate scoring rubric. Your job is to produce original music and validated render evidence, not self-select a winner.
