# THE CIRCUIT V2 — final master verification

Status: PASS. Measured on `the-circuit-v2-master.mp4` (SHA-256 `fbc46d118d94928fd8e425c55562d93d74a5651f971049727ed3eaf9bf6d9f8f`).

- H.264/AAC MP4, 1080 × 1920, 60 fps, 480 decoded frames, exactly 8.000 s; both streams start at 0; one fast-start MOOV; FFprobe reports no container warnings.
- Audio: V1's 24-bit PCM reference, unchanged (SHA-256 checked), byte-identical to source samples 882,000–1,234,799 of the approved B master; AAC presentation is exactly 352,800 samples.
- Event map: V1's mapping.json, unchanged; all 361 source events retained. 304 drive a visual response; each is zero in the frame before its sample's frame and visible in that frame. The rest are documented as absorbed, coalesced or metadata.
- Frames 456–479: every RGB channel of every pixel is exactly zero; frames 0–455 are not black.
- No typography: finished without any overlay; 36 frames recomputed from the raw renders (vignette and grain only) match the encoder input exactly. Engraved markings that are part of the fictional board remain.
- Climax clarity (frames 396–455 only, camera only): the camera's share of the 180° shutter closes to 0.25 by 7.0 s, the final move turns and rolls less, f-stop 3.5 → 5.6, focus tracks the lifting core. The machinery keeps its full motion blur; no event timing changed.
- The approved proof (`9b0f7c9645348d1daac3e93f6b22bbc1529c25f4`) is unchanged and reproducible from this source.
- Largest adjacent mean-luma step outside the blackout: 31.05 / 255; at most 33.44% of pixels change by more than 80 / 255 between adjacent frames (descriptive, not a flash-safety certification).
- Tracked changes are confined to `experiments/morph-commercial-02/`; V1 files are unchanged.
- 21 frames re-rendered from scratch are bit-identical to the raw frames (same machine and settings).

Production delivery checks: PASS.

- Frames 0–455 occur exactly once across eight disjoint batches. All seven matrix boundaries and the internal clarity transition have independent RGB recheck evidence in `production.json`.
- Approved source `61bd2e1f8d28378203586a6a170a791bc9408e1d` remains frozen; only `master/` deliverables differ.
- CRF 16 master: 37,097,685 bytes. The muxed AAC is byte-identical to an independent encode of the unchanged PCM with the same encoder and settings.
- Codex reviewed the final contact sheet and frames 420/444/453 against Opus's approved master references. Luma correlations exceed 0.999 and full-resolution sharpness is within 1.4% of the references. See `visual-comparison.json` and `climax-production-comparison.jpg`. The final reference panel clips 10 pixels; matching valid crops were used for that comparison.
- Anonymous MP4 retrieval returned HTTP 200, matched the committed SHA-256, and passed an independent container/frame-count check. See `retrieval-verification.json`.
- Final human approval remains pending. No YouTube or portfolio publication was performed.
