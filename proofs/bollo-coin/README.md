# BOLLO · listening review

Start with **F**, then **A–E**, then the coins-only **G**. **I** plays the same five seconds dry followed by selectively CRUSH-processed, loudness-matched. No complete song has been made.

| Proof | Duration | MP3 | WAV |
|---|---:|---|---|
| A · quarter face impact | 1.2 s | [MP3](audio/A-quarter-face.mp3) | [WAV](audio/A-quarter-face.wav) |
| B · quarter edge impact | 1.2 s | [MP3](audio/B-quarter-edge.mp3) | [WAV](audio/B-quarter-edge.wav) |
| C · bouncing and settling | 3 s | [MP3](audio/C-quarter-bounce-settle.mp3) | [WAV](audio/C-quarter-bounce-settle.wav) |
| D · spinning into rapid wobble | 4 s | [MP3](audio/D-quarter-spin-wobble.mp3) | [WAV](audio/D-quarter-spin-wobble.wav) |
| E · rolling across tile | 4 s | [MP3](audio/E-quarter-roll-tile.mp3) | [WAV](audio/E-quarter-roll-tile.wav) |
| F · original BOLLO percussion groove | 5 s | [MP3](audio/F-BOLLO-5s-dry.mp3) | [WAV](audio/F-BOLLO-5s-dry.wav) |
| G · isolated coin rhythm | 5 s | [MP3](audio/G-coins-only-dry.mp3) | [WAV](audio/G-coins-only-dry.wav) |
| H · selectively CRUSH-processed groove | 5 s | [MP3](audio/H-BOLLO-5s-selective-CRUSH.mp3) | [WAV](audio/H-BOLLO-5s-selective-CRUSH.wav) |
| I · dry → selective CRUSH | 10 s | [MP3](audio/I-dry-then-selective-CRUSH.mp3) | [WAV](audio/I-dry-then-selective-CRUSH.wav) |

A–E have an 80 ms lead-in and fixed presentation gains: 0, 0, +3, +6, +12 dB respectively. These gains are not part of the instrument. F is two bars at 100 BPM plus .2 s tail, exactly 220,500 frames. Kick and clap use the existing, unchanged V12 `sub-hammer` and `neon-clap`; all other percussion is this instrument. No downloaded or recorded audio.

H sends **face + bounce only** into unchanged CRUSH, amount .46, reference −16 dBFS, ceiling −6 dBFS; blend is 25% wet. Other layers bypass processing. A final +.4 dB trim matches F's integrated loudness; that comparison trim applies to the whole H mix. This is a restrained optional color, not the source of coin identity.

[Aligned dry PCM24 stems](audio/stems/), [events and full parameter plans](audio/events.json), [machine QA](audio/qa.json), [SHA-256 inventory](audio/SHA256SUMS), [technical QA](TECHNICAL_QA.md), [instrument source](../../instruments/bollo-coin/README.md).

Perceptual acceptance is pending owner listening. The analytical checks do not establish that the sounds are recognizable as quarters. Listen for the face slap versus rim ring, shortening bounce intervals, a separate accelerating wobble, continuous rolling texture, and coins functioning as the groove's rhythm.
