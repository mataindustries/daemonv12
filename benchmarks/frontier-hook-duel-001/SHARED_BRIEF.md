# DAEMONV12 FRONTIER HOOK DUEL 001 — SHARED BRIEF

**IMPORTANT: This same text must be provided to each contestant.** Only the selected model identity, the isolated session, and the file output root may differ. Do not give any model another contestant's artifacts, music, results, or earlier Liminal Lullaby compositions. This is a quick **one-entry pilot**, not BANGER LAB 001's three-sketch competition.

## Objective

Create one original, replay-worthy **15.000-second** electronic instrumental using the existing DaemonV12 engine and only the approved Orbital Foundry / GLASSHOUSE sample packs. The desired feeling: dark, futuristic, commanding, physically propulsive, with a strong cinematic payoff. Not generic trailer mush; it needs one signature musical idea that listeners can recognize after one play.

The record is judged by what people hear, not code elegance. Opening identity should be immediate. A deliberately memorable 3–6 note or rhythmic/timbral hook must appear early and **return with a meaningful mutation**. The low end should hit with authority without fighting the kick. Use contrast (including space) so a final return or payoff matters. Favor a tight, confident groove over maximal density.

## Identical creative constraints

- **Tempo 128 BPM, 4/4, eight bars**. Exactly 15.000 s and 661,500 samples at 44,100 Hz stereo.
- **Tonality C# minor** with creative chromatic color permitted.
- Use **only existing approved CC0 WAVs** from `examples/assets/orbital-foundry` and `examples/assets/glasshouse`; other files, generated derivative WAVs, and General MIDI (`gm` / FluidR3) are prohibited. Existing `kit.json` paths are allowed.
- The engine and Composer must remain **unchanged**. Discover real sound filenames, schema, and constraints from the current checked-out repo. Sample and drumkit instruments only. No invented audio controls, extra software, network assets or external synthesis.
- Existing music (including Liminal Lullaby, old test compositions, GHOST//SHIFT and the audition projects) is **off limits as creative source**. Read technical documentation, spec and approved palette only.
- No sub-agents or other composition models. Do not switch models. The single assigned model must author the composition.
- The final 10ms of the 15-second master must be <= -50 dBFS; avoid a hard cutoff. Zero clipped samples, zero full-scale samples, and true peak <= -1.0 dBTP. Stereo WAV and MP3 plus aligned stems.
- Technical failures can be repaired and counted separately, but not disguised as musical revisions.

## Small, fixed process

1. Record current git commit, Node, FFmpeg, DaemonV12 doctor output and exact model name/settings in a run log. Check schema and approved samples.
2. In 6 lines or fewer, state hook, groove, bass, contrast and payoff.
3. Create **V1** as `examples/frontier-hook-v1.json`, validate and render to `renders/frontier-hook-v1` (WAV, MP3, stems). Preserve V1 exactly.
4. Inspect the score and audio measurements; identify **three specific musical weaknesses or plausible hypotheses** (not only mastering). Do not pretend to have heard audio you cannot actually play.
5. Make exactly one **substantive musical V2** as `examples/frontier-hook-v2.json` and render to `renders/frontier-hook-v2` (WAV, MP3, stems). No V3. Only V2 is submitted.
6. Validate V2, verify duration, true peak, clipping, quiet boundary, stems and actual asset paths; if a technical failure occurs, allow narrow corrections, disclosing every additional render. No further creative versions or retakes.
7. Output `renders/frontier-hook-v2` MP3 and WAV paths, project paths, relevant metrics, final status and a concise change log. Finish, do not start additional tasks.

Run from repository root using existing commands:
```bash
node bin/daemonv12.js doctor --json
node bin/daemonv12.js validate examples/frontier-hook-v1.json --json
node bin/daemonv12.js render examples/frontier-hook-v1.json --out-dir renders/frontier-hook-v1 --stems --format wav,mp3
node bin/daemonv12.js validate examples/frontier-hook-v2.json --json
node bin/daemonv12.js render examples/frontier-hook-v2.json --out-dir renders/frontier-hook-v2 --stems --format wav,mp3
```
The project files are in `examples/` so their `assets/` references resolve to `examples/assets/`. The model must discover actual sound filenames and validate their use, not guess.

## Human scorecard (only after listening)

Total 100: memorability 20, immediate identity 15, groove 15, bass/percussion 10, arrangement/payoff 10, physical/emotional response 10, replay appeal 10, production 10. Judge anonymously at matched loudness; technical validity is not artistic quality. Label the actual model used; if access to the assigned model is denied, **stop**, do not substitute another model.

## Baseline rules for second contestant

Run Muse Open in a fresh separate Codespace/worktree, with **the identical shared brief, engine commit, approved assets, render toolchain and creative budget**, after archiving the first contestant's outputs outside its accessible workspace. Do not call the different model from the first model's agent session. No access to earlier contestant data before blind judging.
