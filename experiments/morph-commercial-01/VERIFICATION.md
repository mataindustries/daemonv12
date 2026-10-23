# THE CIRCUIT — measured technical verification

Status: PASS. Measurements concern the rendered file `the-circuit.mp4`.

- H.264/AAC MP4, 1080 × 1920, 60 fps, 480 decoded picture frames, exactly 8.000 s. Both streams begin at presentation time 0.
- The MP4 has one fast-start MOOV box and a complete top-level box layout through the exact end of file. FFprobe reports no container warnings.
- The stereo 44.1 kHz, 24-bit PCM reference has 352,800 sample frames. Its payload is byte-identical to source sample frames 882,000–1,234,799, i.e. 20.000–28.000 s of the approved B WAV. No gain, limiting, recomposition or time stretching was applied.
- All 361 original events in the crop are retained in the mapping; sample offsets and zero-based 60 fps picture buckets match independently. 180 entries drive selected visual systems. One picture interval is 735 audio sample frames.
- Source cutoff 27.600 s maps to excerpt 7.600 s / sample 335,160 / picture 456. Picture 455 remains visible. Every RGB channel of every pixel in pictures 456–479 is exactly zero. The corresponding 17,640 PCM sample frames are exactly silent.
- AAC presentation contains 352,800 sample frames. Unconstrained AAC decoding returned 353,280 frames; 480 trailing coding-padding frames fall outside the declared 8.000 s presentation. Use the PCM reference for lossless/sample-exact work.
- All 179 selected non-blackout event onsets are independently checked against renderer state and its master animation audit; each first activates in its source onset's containing picture frame.
- Fresh compositor renders of pictures 0, 150, 444, 455 and 456 match the master render's raw RGB hashes and saved PNG pixels. This verifies deterministic compositing on this runtime with the same plates; it does not claim cross-platform path-tracer byte identity.
- Excluding the intentional blackout, the largest adjacent mean grayscale-luma step is 0.762 / 255. At most 0.423% of pixels change by more than 80 / 255 between adjacent pictures. These describe image changes; they are not a formal flash-safety compliance assessment.
- Tracked changes are confined to `experiments/morph-commercial-01/`; existing scores and the DaemonV12 engine are unchanged.

Detailed measurements and file SHA-256 hashes are in `verification.json`.

## Synchronization

The visual clock uses the original event map's authoritative audio sample indices. Subtracting 882,000 remaps each event from the source master into the exact eight-second crop; dividing the resulting integer index by 735 and taking the floor identifies the 60 fps picture interval containing that sound. Distinct event classes address circuit surges, structural responses, processor articulation and branching signals, while rapid events are deliberately coalesced to preserve readable motion. The terminal source silence at sample 1,217,160 becomes excerpt sample 335,160 and picture 456, producing one hard blackout held through the final 24 frames.
