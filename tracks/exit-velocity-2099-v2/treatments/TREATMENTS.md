# Production treatments: EXIT VELOCITY // 2099

All three treatments use bars 17–24 of the original V3 score (the return), remapped to eight bars and rendered through DaemonV12. They preserve the F–Eb–C–Ab whistle and the original displaced kick framework. The 14.25-second MP3s are derived from native 44.1 kHz stereo WAVs, with fixed gain for comparable integrated loudness and a 200 ms end fade; they are 320 kbps. All drum and instrument sounds are procedural and seeded, with no external recordings.

* **A — West Coast Heavyweight:** low kick with longer body, thicker clap knock, strong centered sub, reduced hat chatter and compact response. A test of a confident, unhurried pocket; its quieter talk voice risks losing the conversational character.
* **B — Cybernetic Funk:** quicker kick envelope, faster formant movement and more aggressive waveshaping, extra call-and-response talking-bass pitches and rim answers, and alternating left/right upper voices. This is the most active rhythmic conversation and risks overcrowding the lead. A simultaneous duplicate bass trigger was removed before the final render.
* **C — Futuristic Cinematic Bass:** a longer low kick and heavier tonal clap, quieter bass speech, louder chord bed, and a sparse first half leading into a full second half. It offers the largest measured section contrast but sacrifices sustained groove in the approach.

Native production manifests report zero clipped samples in all tracks and masters. The following figures are measurements, not listening judgments. Correlation is Pearson L/R; the low-band measurement applies a 120 Hz fourth-order low-pass. Whole-stem LUFS values have different duty cycles and do not directly measure subjective loudness.

| Treatment | Native LUFS / dBTP | MP3 LUFS / dBTP | Full-band / low correlation | Lead / talk stem LUFS |
|---|---:|---:|---:|---:|
| A | −21.78 / −9.09 | −16.7 / −4.4 | 0.992 / 1.000 | −19.94 / −24.41 |
| B | −22.72 / −9.43 | −16.8 / −4.0 | 0.986 / 1.000 | −20.64 / −23.92 |
| C | −22.40 / −8.78 | −16.8 / −3.6 | 0.965 / 1.000 | −19.74 / −28.46 |

All are strongly center-focused; C has the most side energy but is still narrow. A's kick has higher average stem level than B's and a longer envelope; B's shorter kick and moving midrange are hypotheses for cleaner bass articulation. C's first and second four-bar RMS values are −25.17 and −22.42 dBFS respectively (A −22.06/−22.95); this quantifies the planned dynamic change, not an emotional payoff. All whistles contain a strong mono fundamental near 698 Hz and harmonics, which should aid small-speaker translation, but actual phone and mono listening remain necessary. The near-unity low-band correlation supports mono low-end compatibility; it cannot establish bass clarity or punch.

**Selection hypothesis:** B most directly amplifies the original's unusual rhythm and talking-bass identity, while A's kick/sub discipline and C's subtraction-and-return concept are compatible influences. This is a score-and-measurement hypothesis only; no human listening is claimed. The full revision should not simply merge all three scores. Final aesthetic selection requires listening.

Rebuild in this directory with `python generate_original_assets.py` then `python make_treatments.py`, followed by `node bin/daemonv12.js render <treatment>/project.json --out-dir <unique-dir> --stems --format wav --json` from the DaemonV12 repository root. Encode native A/B/C WAVs with fixed gains of +4.78/+5.60/+5.40 dB respectively and `afade=t=out:st=14.05:d=0.2`, using FFmpeg libmp3lame at 320 kbps. The original V3 score and generator are copied solely as reproducibility inputs; the original track files are untouched. NumPy/SciPy are required.
