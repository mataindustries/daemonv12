# Final QA · THE LANDING REMEMBERS

| Check | Result |
|---|---|
| Form | 96 BPM, 4/4, four bars, exactly 10.000 seconds |
| Master and all six stems | Stereo PCM16, 44,100 Hz, exactly 441,000 sample frames per channel |
| Picture clock | 24 fps, 15 frames per beat; section cues 0/60/120/180, boundary 240 |
| Level | −14.44 LUFS integrated; −2.500189 dBFS sample peak; −2.47 dBTP |
| Clipping | Zero source, track, master or full-scale sample overloads |
| Stem reconstruction | Integer sum equals every master sample: zero PCM LSB error |
| Mono proxy | Correlation 0.9323; mono RMS only 0.1553 dB below stereo RMS |
| Loop seam | Last-to-first steps −51.22/−55.19 dBFS, smaller than 78.6%/86.5% of ordinary adjacent-sample steps |
| MP3 decode | Exactly 441,000 / 1,323,000 frames for one / three cycles; neither decoded copy clips |
| Fresh-process reproduction | All 24 compared files match, including source assets, WAV, six stems, analysis, render manifest and both MP3s |

The four-bar performance is synthesized with ten seconds of natural tail. Each Float64 stem, including the shared wet-only room, is folded modulo 441,000 frames before PCM quantization. There is no endpoint fade, crossfade, time stretch or limiter. The room's residual in the final 10 ms of the source tail is below −185 dBFS before the common gain. The opening therefore contains the preceding phrase's real decay. Harmonic continuity is composed: the final A pickup and common E/A tones return to D minor.

The opening states the identifiable mallet contour immediately; the lower voice answers it within the first bar. Bar two changes its last note and harmonic context. At 5.000 s the bars drop out, B♭ becomes B and F becomes F♯, and the same contour belongs to a close voice over D major/F♯. Measured side-energy fraction falls from 6.76% in bar two to 0.19% in bar three. The final bar carries a descending vocal answer and pickup rather than an ending. These are score and signal observations, not a claim of human listening.

One correction was made: lower `someone-close` by 5 dB. The first render's bar-three RMS was 6.28 dB above bar two; the final contrast is 1.68 dB, preserving the spatial and harmonic reveal. All notes, rhythms, instruments and harmony survive unchanged. Pre-correction reports are retained under `review/`. The central risk is the sudden major, human-scale reinterpretation of the metal theme; retain it because the contour stays recognizable while register, texture and harmony change its meaning. Additional hook searches, V2/V3 composition rounds and a separate Risk Pass render were omitted under the user's explicit production budget. No further revision is proposed.

Engine base: `eee072d71a7581913faebff95c935cae8c9be41b`, fetched and verified as `origin/main` before branching. This is the v0.8-compatible integrated main; its package version remains 0.7.0. Node v24.19.0; FFmpeg 6.1.1. All 31 frozen rack entries verify unchanged. Impossible Voice, Living Bass and Mechanical Orchestra are owner-original numeric synthesis with seeded PRNGs. No recordings, third-party audio, SoundFont, paid API or downloaded impulse response was used. Existing owner licensing declarations remain unchanged; this candidate makes no new license grant. Exact generator and asset SHA-256 hashes are in `delivery/provenance.json` and the native `.render.json`.

The supplied silent clip and contact sheet were inspected, including decoded first/middle/last video frames. The attachment is a one-second 1080×1920, 24 fps study with 24 frames and no audio. The score follows the requested ten-second, 240-frame motion; a full ten-second picture was not supplied, so its unique-frame count and full camera trajectory cannot be verified here. No human listening, physical playback-device test or musical-quality guarantee is asserted. Machine evidence is in `review/verification.json`, `review/sections-analysis.json`, `review/cue-verification.json` and `review/reproducibility.json`.
