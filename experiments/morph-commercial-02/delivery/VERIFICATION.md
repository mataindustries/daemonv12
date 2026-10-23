# THE CIRCUIT V2 — motion proof verification

Status: PASS. Measured on `the-circuit-v2-motion-proof.mp4` (SHA-256 `f4d73ca4d8c4ab1a5d6fa377c4db93eac6dadaa61c145a4ab7b70f914d89dbb7`).

- H.264/AAC MP4, 432 × 768, 60 fps, 480 decoded frames, exactly 8.000 s; both streams start at 0; one fast-start MOOV; FFprobe reports no container warnings.
- Audio: V1's 24-bit PCM reference, unchanged (SHA-256 checked), byte-identical to source samples 882,000–1,234,799 of the approved B master; AAC presentation is exactly 352,800 samples.
- Event map: V1's mapping.json, unchanged; all 361 source events retained. 304 drive a visual response; each is zero in the frame before its sample's frame and visible in that frame. The rest are documented as absorbed, coalesced or metadata.
- Frames 456–479: every RGB channel of every pixel is exactly zero; frames 0–455 are not black.
- Largest adjacent mean-luma step outside the blackout: 31.74 / 255; at most 32.72% of pixels change by more than 80 / 255 between adjacent frames (descriptive, not a flash-safety certification).
- Tracked changes are confined to `experiments/morph-commercial-02/`; V1 files are unchanged.
- 4 frames re-rendered from scratch are bit-identical to the proof's raw frames (same machine and settings).
