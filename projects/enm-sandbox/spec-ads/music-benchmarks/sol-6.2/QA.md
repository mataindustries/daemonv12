# The Balance Spring · technical QA

**PASS** · One 6.000-second loop in E minor, 80 BPM, two bars of 4/4.

| Check | Result |
| --- | --- |
| Low gesture | E2 and E3 at 0.000 s (frame 0) |
| High answer | E6 at 3.000 s (frame 132,300) |
| Repeat | Frames 264,599 and 0 match adjacent frames of the continuous render to within two 24-bit quantization steps after gain. The peak inter-frame step at the join is 0.003728 full scale, versus a 0.044067 maximum within 10 ms on either side. |
| WAV | Stereo PCM24 at 44,100 Hz, 264,600 frames, exactly 6.000 s |
| Levels | -4.00 dBFS sample peak, -19.49 dBFS RMS, 0 clipped samples |
| SHA-256 | `149350649e99ab06f9547020ec710aaf9be05674d3b5b7f23e20414de66802fc` |

The score uses DaemonV12's original synthesized Living Bass, modal bar, friction-bowed bar and clean tine. The render uses zero samples or SoundFonts. QA decoded the delivered PCM and measured the join directly. Cue times come from the score.

Rendered once with the Signature Rack 1.0.0 at DaemonV12 commit
`917f4439f85a9f7bfba1c336c1f76090a24b49e3` using Node 24.22.1.
The score's three seconds of decay were folded across the repeat. To reproduce,
render the score to `mix-context.wav` with the rack. Apply an 8 ms half-cosine
fade-in to the first six seconds and a 125 ms half-cosine fade-out to the
three-second tail, then sum the tail into the first three seconds. Set sample
peak to −4 dBFS and round to signed 24-bit PCM. The fold carries the rendered
decay across the downbeat.
