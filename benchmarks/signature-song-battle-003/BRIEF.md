# SIGNATURE SONG BATTLE 003 — Equal-conditions full-song challenge

## Mission

Compose a **finished, memorable 80–88-second original electronic track** that a listener wants to replay outside the game. This is not an ambient cue, a short trailer, three disconnected sketches or a repetitive eight-bar groove. **Aim for a distinctive, singable signature hook that returns with changed meaning**, a satisfying low-end groove, real harmonic/emotional movement, and an ending that earns another play.

**Neutral benchmark baseline:** `mataindustries/daemonv12`, main commit `e2962cc1a443c841cd6ca7cb2cc56c5ebabf0e99` (pack v1 and Composer v0.4 present). This brief is on `feat/signature-song-battle-003`. Each contestant receives an **identical copy of this committed brief, pack WAVs and toolchain**, and works on a separately isolated branch/checkout. The resulting isolated submission is not a statement of general model superiority.

**Palette:** exclusively the sixteen source WAVs in `packs/v12-signature-v1/assets/v12-signature/` and its kit. Read `packs/v12-signature-v1/README.md` for roles, roots, rate/hold constraints and `PROVENANCE.md` for the current licensing status. Read DaemonV12 engine and **Composer v0.4 hook-first skill** at `plugins/daemonv12-composer/skills/daemonv12-composer/SKILL.md`, plus its *generic hook-first/production* references if needed. **Do not read** `packs/v12-signature-v1/COMPOSER_PLAYBOOK.md`, `scripts/create-v12-signature-projects.ts`, showcase scores or audio, prior benchmark compositions, any `experiments/thingmania-ost/` content, or other contestants' files; those contain earlier melodies/recipes. The pack is **not** automatically installed by `init`: import/copy the 16 files and kit into your own validated project workspace and prove actual sound loading before composition.

**Rights:** The pack contains original synthesized assets with a documented chain of creation, but its repository license declaration is still **pending**. This run is for **private evaluation only** until the owner decides commercial rights; do not publish/distribute as royalty-free or claim rights have been cleared.

## Equal creative challenge

You have freedom to choose tempo, key, meter, harmonic language, identity and genre. Dark/cinematic/hypnotic colors are the shared instruments' starting point, **not a command to copy an existing Signature demo**. You may deliberately pivot to an unexpected style if it remains musically coherent and replayable.

- **Hook:** By 0:05, expose a **2–4 second motif that could be recognized, tapped or sung without production effects**. Give it its own rhythmic contour and a distinctive interval/pitch or timbral gesture. A busy arpeggio or random bell flourish is not an identity.
- **Groove:** Make the bass and kick relate intentionally. REACTOR/ABYSS should create physical impact without swallowing the melody on phone speakers. Rhythm should feel authored—not just kick on all four beats with the same hat pattern for 80 seconds.
- **Development:** Write a second contrasting hook or convincing answer that interacts with the first; change harmonic direction or expectation midway. Let the original hook return transformed, not merely louder.
- **Surprise:** Commit to **one earned high-upside musical risk** (unusual meter transition, tonal pivot, rhythmic deception, hard silence, false drop, melodic handoff, etc.). Do not bolt on random weirdness to satisfy a checklist.
- **Ending:** Deliberately resolve the journey between 80 and 88 seconds, with a clean controlled tail and replay-friendly return; no unexplained late bell or dead silence.
- **Instrumentation:** Use **at least six** of the verified Signature sounds and no outside samples/GM/SoundFonts/copyrighted music. Do not use all 16 merely to hit a count. Original note events, transformations, envelopes, effects and arrangement through DaemonV12 v0.7 are the point.
- **Form:** At least three distinguishable musical sections with a meaningful transition and payoff. Do not repeat an unaltered 8–16-second pattern for most of the track.

## Hook-first composition procedure (strict compute budget)

1. **Preflight once:** `git rev-parse HEAD`, doctor, validate engine CLI, verify source pack filenames/manifest hashes, copy assets into an isolated workspace. Make a **single cheap 2-second sample smoke render** containing a drum, bass and lead. If the pack can't be loaded, STOP with actual error. Avoid MCP debugging after prior invalid-JSON failures; CLI use is permitted and should be recorded. Do not modify core engine.
2. **Six-line musical thesis:** title/concept; primary hook; groove/low-end; counterhook; emotional contrast; ending. Short; then compose music.
3. **Hook round:** Draft **three musically different** 2–4-bar candidates (rhythm/contour/harmony, not only timbre). Dry-render the small hooks if economical and save WIP projects/previews. Choose the best based on musical intention and objective features, not claiming personal listening unavailable.
4. **Full V1:** Expand the winning hook into an 80–88s track. Make intro, development, bridge/contrast, transformed hook return, proper resolution. Validate with the engine, render one true audio master.
5. **V2:** Identify **two specific audible hypotheses** tied to actual sections, fix them without destroying the hook; render a second full version. If V1 is actually stronger or no defensible change exists, keep V1 and report why.
6. **Optional risk test:** Only if it can realistically improve the song and budget remains, test one focused section/excerpt, then at most **one** extra full V3 render if the musical hypothesis justifies it. No unlimited experimentation, custom metering tool project, or 20-minute environment debugging. No marketing/video production.
7. **Lock:** Final mix WAV and MP3, editable DaemonV12 JSON, sample/stem provenance and SHA256. Compare final rerender hashes if reasonable. Record which V1/V2/V3 was chosen and why, while distinguishing score hypotheses from real human listening.

**Technical targets:** 44.1kHz stereo master, full length 80–88s, integrated loudness around -16 LUFS (±2), true peak <= -1 dBTP, no clipped PCM samples, usable mono and highpass phone proxy, clear first 5 seconds and controlled final 3 seconds. Prefer aligned stems in FLAC/WAV where feasible; allow a technical correction if a defect actually blocks listening. Sound quality is necessary but not a music-quality score.

**Deliverables** in local isolated `benchmarks/signature-song-battle-003/<model-slug>/`:
- `final.json` editable project, `final.wav`, `final.mp3`, `v1` and `v2` projects (V3 if used), short hook sketches, stems/manifest if available.
- `README.md` with exact instrument sources, reasoning/version setting when known, actual CLI/MCP mode, render and analysis commands, wall time, tool-call count when measured, and spend only if reported by the provider. Never invent cost.
- `analysis.json`: measured duration/LUFS/true peak/clip/mono/phone/seam and reproducibility/hashes (report skipped checks honestly).
- A clearly named, easy-to-download **single final MP3**; save large WAV/stems/previews to an ignored output directory if repository hygiene requires it. Commit source/docs only. Don't touch other projects or experimental audio.

### Blind final comparison

Listeners must receive anonymized, loudness-matched final MP3s with no model or style descriptions. Score:
- **Hook memorability / repeated listening:** 40%
- **Groove / bass / rhythm:** 20%
- **Arrangement development and payoff:** 20%
- **Originality / emotional identity:** 15%
- **Production clarity / translation:** 5%

This benchmark is for music humans want to replay, not who accumulates more tracks or passes more QA. Record listener response before opening agent reports.

**STOP** after the chosen final, audio delivery and measured QA. Do not autonomously launch a second composition or unrelated benchmarks.
