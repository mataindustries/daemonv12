# EXIT VELOCITY // 2099 — V2

A 56-second, 140 BPM refinement of the composition in the adjacent original workspace. The opening F–E♭–C–A♭ whistle, displaced kick and late-clap pocket, and answering vowel bass remain. The sounds are newly synthesized; no external audio is used. The original project and delivery remain intact.

## Listen

- `delivery/exit-velocity-2099-v2-master-320.mp3`: complete 320 kbps master; `delivery/exit-velocity-2099-v2-master.wav`: 44.1 kHz stereo PCM16 master, the engine's native resolution.
- `delivery/original-matched-27s.mp3` and `delivery/v2-matched-27s.mp3`: the same 27–42 s passage, each −18.0 LUFS, with short boundary fades.
- `treatments/`: three 14.25-second loudness-matched productions of the original return. See `TREATMENTS.md` for the distinctions, measurements and selection hypothesis.
- `candidates/`: full V2A, V2B, V2C and RISK renders, approximately matched to −16 LUFS. See `ITERATION-NOTES.md` for the hypotheses and exact gain changes.
- `delivery/exit-velocity-v2-stems.zip`: twelve aligned stereo stems at 44.1 kHz PCM16. Stems include track processing and automation, but exclude the master stage and post-render gain; their sum is not the mastered WAV.

The lead drops out at bar 25 as the bass takes its exact contour and rhythm, then returns. This is the retained originality experiment, a score-based creative choice requiring human listening. The final also restrains the opening, removes selected low-end events in the approach, adds a pickup and raises return accents. Its separate left and right responses add space above a centered low end. The signature last F5 recalls the opening. `SYNTHESIS.md` explains the kick, clap, moving formants and whistle; `ITERATION-NOTES.md` describes the revisions. All aesthetic judgments remain open to listening.

## Reproduce

From the repository root, using DaemonV12 0.7.0, Node, FFmpeg, Python, NumPy and SciPy:

```sh
V2=tracks/exit-velocity-2099-v2
python "$V2/generate_assets_v2.py" --palette B --out "$V2/assets/b"
python "$V2/compose_v2.py"
node bin/daemonv12.js validate "$V2/final.json" --json
node bin/daemonv12.js render "$V2/final.json" --out-dir /tmp/exit-velocity-v2-render --stems --format wav --json
```

Use a fresh output directory. The generator is deterministic with seed 2099; floating-point/library versions may change least-significant bits. Native render and its stages are documented in `delivery/native.render.json` and `delivery/native.analysis.json`. The final WAV applies fixed +6.1 dB and triangular dither to the native 16-bit engine output; the MP3 is encoded with libmp3lame at 320 kbps. No compressor or limiter is added in mastering. Reproduction commands and technical checks, including MP3 true peak, appear in `delivery/QA.md`. For the earlier candidate sounds, use `--early-kick` as documented in `ITERATION-NOTES.md`. Treatment synthesis and instructions are self-contained under `treatments/`.

The SHA-256 list covers the delivered files. Measurements establish technical behavior, not whether the track sounds exceptional; final selection belongs to a listener.
