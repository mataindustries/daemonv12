# CHROME STALLION — full-length production log

Producer cannot hear audio; critiques are score intent + signal measurements, never quality proof.

## Frozen DNA (from approved sketch B)
G minor, 98 BPM, swing 0.58; signature bass cell (scoop accent, ghost, third, slide, step-down,
lift, staccato, held end); kick 0/1.75/2.5 + backbeat snare; clock-as-hat; tine stabs; voice cries;
warm->machine bass macro. Sketch frozen in ../FROZEN_SKETCH.json (hashes verified at Phase-2 start).

## V1 (complete, playable) — versions/chrome-stallion-v1-preview.mp3
76 bars / 304 beats, 188.62 s. Assembly note: the rack's single-process full-length mixdown did not
complete in this Codespace session environment (parts rendered, mixdown never landed), so V1 was rendered
as 9 section chunks (same score, split at section boundaries by work/headliner-002-full/split_chunks.py),
each chunk trimmed to its exact section duration and concatenated; preview MP3 loudnormed to -16 LUFS.
Chunk boundaries cut note/room tails at section joins — a V1 audition compromise, revisited for the final.

### V1 measurements (v1-concat.wav, unmastered)
- Integrated -19.8 LUFS, true peak -0.33 dBTP, no clipped samples in any chunk render.
- Section RMS dB: ignition -24.3 | groove -22.0 | development -22.0 | strange-beauty -22.6 |
  evolution -21.7 | organism -23.2 | heavy-return -19.1 | payoff -20.8 | coda -25.5.

### V1 critique (three weaknesses)
1. Heavy-return peak 0.96 (voice stem 0.76: lead + harmony + cries stack) caps global loudness and
   makes heavy-return (RMS -19.1) outweigh the payoff (-20.8) — impact inversion at the climax.
2. Strange-beauty break (-22.6) is barely quieter than the groove (-22.0): the intended contrast is weak.
3. Final 0.5 s at -84 dB: the tail is fully dead before the file ends (slightly long dead air).

## Revision 1 (focused, score-level) — planned
- Voice expression dip in heavy-return + lower voice-2 gain; payoff bass/voice expression lift.
- Lower bass/voice expression through strange-beauty for real negative contrast.
- Trim tailSeconds 2.5 -> 2.0.
