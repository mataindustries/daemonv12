# EXIT VELOCITY // 2099 — composition and production record

## Musical thesis

- Hook: a bent F5 whistle drops through Eb, C and Ab, then asks again; it begins at time zero.
- Rhythm: a swung, late-clap half-time pocket with displaced kicks and dry rim answers; 140 BPM, 4/4.
- Low end: a short F1 sub arrives after the kick, while a separate vowel-swept F2 voice answers it.
- Contrast: pull away drums and sub in the middle and let the lower response carry the empty space.
- Payoff: bring the original motif, bass and kick back at bar 17, with a separate right-side counterline.
- Ending: quote the opening and let a held F5 fall into the remaining space in the 56-second container.

The 32-bar grid ends at **54.857088 s** using DaemonV12's rounded tempo, leaving 1.142912 s within the explicit 56.000 s container. The final note starts at approximately 54.750 s and its natural release/delay occupies part of that tail. The score is in F minor, with brief chromatic lead bends and Fm/Db/Eb harmony.

## Three sketches

All sketches have eight bars and use the same custom sound family. Their scores are `sketch-a.json` through `sketch-c.json`; playable WAVs were rendered locally under `renders/sketch-a/`, `renders/sketch-b/`, and `renders/sketch-c/`. The repository ignores `renders/`, so these WAVs are regenerated from their scores and the assets when needed.

- **A — crest signal:** an immediate high F5–Eb5–C5–Ab4 descending signal, half-time kick pocket and straight-ahead rim counter. Chosen as the clearest thematic starting point on score inspection.
- **B — motor speech:** lower-register, more syncopated multi-note signal and alternate kick pattern; more movement immediately, less exposed high-register identity.
- **C — skyline float:** a longer opening C5, fewer hats and wider spaces in the phrase; more suspended than the requested forward-driving bounce.

No human or model listening session was available, so the concept decision is a score-based creative hypothesis, not a claim about perceived quality.

## Iterations

The local renders are 44.1 kHz stereo PCM, all using DaemonV12 production routing. Every project was independently validated. Render directories are ignored by Git; their WAVs, analysis reports, and manifests can be recreated using the command below. The final delivery is handled separately.

**V1** is a complete 32-bar draft. It places the hook immediately, then uses the same motif in most bars; drums and bass largely continue through the approach. Native analysis: 56 s, −20.1 LUFS, −8.24 dBTP, zero production overload in master or individual tracks. Three evidence-led hypotheses informed the changes:

1. At 6.86–27.43 s, the whistle recurs in most bars. Score inspection suggests its repetition may crowd out a dialogue. V2 removes some entries and adds quieter midrange answers; no listening claim is made.
2. At 24.00–27.43 s the full groove still leads directly into the bar-17 return. A section RMS proxy showed the V1 arrival only about 1.31 dB above the immediately preceding window; that does not prove weak impact, but supports a test with more negative space. V2 removes the kick, clap, hats and sub in select break bars.
3. The ending's last short lead phrase leaves roughly a second before the fixed boundary. Its replay effect is unknown; the later V3 closing revision sustains an opening-related note into the available tail.

**V2** introduces rests in bars 13–16 and answers the lead at bars 6, 10, 14, 18, 22, 26 and 30. It remains a full 56-second composition. An independent window measurement found a 10.84 dB RMS difference between the last two bars of the approach and the first two bars of the payoff. This quantifies the increased contrast, not how powerful it sounds. Three remaining hypotheses:

1. The lead remains strongly foregrounded: V1's lead stem measured −18.35 LUFS while the talking-bass stem measured −31.31 LUFS and hats −40.71 LUFS. Different duty cycles limit direct comparison, so V3 makes a bounded rebalance rather than treating these as targets.
2. The V2 payoff is close to mono by content: side-energy proxy ~0.35%, versus ~4.0% in the sparse approach. V3 places a distinct, two-note right-side response at bars 17, 19, 21 and 23 while keeping kick and sub centered.
3. The short final phrase is unchanged, and the fixed-duration tail can feel empty. V3 changes the closing quote so F5 persists into the final second.

**V3** keeps the stronger subtraction/return structure. It lowers the lead, brings up the talking bass and supporting percussion, adds selected midrange answers and a right-side counterphrase, and extends the final F5. These are creative choices supported by the score and comparative measurements, not audited listening judgments. The native final measured −21.66 LUFS / −8.45 dBTP, with no overload (see the generated final analysis and manifest for details). The first V3 test had the short ending; the frozen final has the tail repair.

### Ending repair (additional bounded render)

- Hypothesis: an F5 callback at 54.75 s will keep the motif present through more of the tail and make a more coherent return to the opening.
- Evidence: score event and final-window waveform/analysis; listening remains necessary to judge replay appeal.
- Cost: one score edit and one complete render.
- Keep criterion: the note rings without an abrupt container cut or overload, and the opening remains unchanged. The corrected render is the selected V3.

### Risk pass: delayed return

- Risk: in `risk.json`, remove the kick at bar 17 and delay its first lead hit by an eighth note, removing the next lead pitch to keep the texture legible.
- Upside: anticipation and an unexpectedly suspended downbeat.
- Failure mode: the main payoff may feel weak or mistimed and obscure the opening motif's return.
- Cheapest useful test: one score variant and full production-route render, `renders/risk-final/risk.wav`; compare with `renders/final/v3.wav` around 27.43 s and in the complete arc. These are locally generated, ignored renders.
- Keep only if listening confirms stronger anticipation without loss of impact. No listening was available, so this risk is **not adopted**: the committed composition retains the direct V3 downbeat rather than treating an unverified aesthetic hypothesis as a demonstrated improvement.

## Editorial positions at 60 fps

Frame numbers are zero-based and rounded to the nearest 60-fps video frame; the sound events remain on the engine's 44.1 kHz sample grid. Timecodes are `HH:MM:SS:FF` at exactly 60 fps. The 56-second endpoint is the exclusive boundary.

| Section | Score time | Nearest frame | Timecode |
|---|---:|---:|---:|
| Opening / bar 1 | 0.000000 s | 0 | 00:00:00:00 |
| Harmony enters / bar 5 | 6.857136 s | 411 | 00:00:06:51 |
| Harmony change / bar 9 | 13.714272 s | 823 | 00:00:13:43 |
| Break / bar 13 | 20.571408 s | 1234 | 00:00:20:34 |
| Return / bar 17 | 27.428544 s | 1646 | 00:00:27:26 |
| After the payoff / bar 25 | 41.142816 s | 2469 | 00:00:41:09 |
| Closing passage / bar 29 | 47.999952 s | 2880 | 00:00:48:00 |
| Last bar / bar 32 | 53.142804 s | 3189 | 00:00:53:09 |
| Final F5 | 54.749945 s | 3285 | 00:00:54:45 |
| 32-bar grid ends | 54.857088 s | 3291 | 00:00:54:51 |
| Container ends | 56.000000 s | 3360 | 00:00:56:00 |

## Reproduction and assets

All audio source WAVs in `assets/` were synthesized specifically for this track from mathematical oscillators and seeded noise by `generate_assets.py`; no external samples, vocals, recordings or SoundFonts are used. Python requires NumPy and SciPy. The generator uses NumPy's seeded RNG (`2099`) and SciPy filters. Different library/CPU versions may produce different least-significant sample bits. `compose.py` builds the three sketches, `v1.json`, `v2.json`, `v3.json`, `risk.json` and the reconstructed MIDI. Regenerating overwrites only files in this track directory.

From the repository root:

```sh
python tracks/exit-velocity-2099/generate_assets.py
python tracks/exit-velocity-2099/compose.py
node bin/daemonv12.js validate tracks/exit-velocity-2099/v3.json --json
node bin/daemonv12.js render tracks/exit-velocity-2099/v3.json --out-dir tracks/exit-velocity-2099/renders/final --stems --format wav --json
node bin/daemonv12.js analyze tracks/exit-velocity-2099/renders/final/v3.wav --json
```

Engine commit `23619d1575c6f0f5dd242f14907a4f390871492b`, DaemonV12 0.7.0, Node v24.19.0, Python NumPy 2.3.5 / SciPy 1.17.0, configured FFmpeg 6.1.1. An independent synthesis run regenerated all 14 asset files byte-for-byte. A separate fresh render reproduced the final native WAV, MIDI, analysis, manifest and all 12 stems byte-for-byte under this environment. The configured `DAEMONV12_FFMPEG` in this environment is `/workspace/.daemonv12-audio/runtime/bin/ffmpeg`; no FluidSynth wrapper or SoundFont is required for this sample-only project. The engine's native MIDI for a sample-only project has no sample notes. `exit-velocity-2099-note-map.mid` is a separately generated, explicitly labeled **approximate MIDI reconstruction** of the note onsets, pitches and gates, including GM drum-channel mapping. It does not recreate the sample timbres, articulation envelopes, delay, exact sample-tail behavior or pitch glides. Refer to the JSON, assets and rendered stems for the canonical composition.
