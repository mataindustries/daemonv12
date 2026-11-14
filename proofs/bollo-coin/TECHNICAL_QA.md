# BOLLO technical QA · listening candidate 1

Delivery: Node **24.19.0**, FFmpeg **7.1.5-0+deb13u1**, 44,100 Hz, stereo amplitude-unit Float64 synthesis → nearest-rounded PCM24 WAV → 256 kbps MP3. Numeric coin synthesis only; existing kick/clap assets retain their original provenance. Reproduction commands and parameters live in [the instrument README](../../instruments/bollo-coin/README.md). [qa.json](audio/qa.json) records generator hashes, gains, exact counts, signal statistics and CRUSH settings; [events.json](audio/events.json) contains every contact, state transition and bridge trigger. [SHA256SUMS](audio/SHA256SUMS) covers every exported audio/metadata file and dry stem.

| Check | Result |
|---|---|
| Synthesis determinism | Each preset and the groove rendered twice with identical PCM24 hashes; eight preset hashes also match across fresh Node processes |
| Seed | Same seed reproduces output; changed seed changes mode/contact realization without changing ballistic gravity timing |
| Vertical bounce C | 10 ballistic contacts; first flight 448.848 ms, last 12.634 ms; interval ratios .64 within floating-point tolerance |
| Separate spin D | 85 wobble contacts; first interval 72.676 ms, last 6.372 ms; bounded at 156.75 Hz for spin .95 |
| Stopping | Per-contact wobble strength decreases, last chatter fades before final weak face contact; output ends at zero |
| Rolling | Spatial seam contacts plus continuous inter-contact energy; speed and texture decrease before independent final wobble |
| Length | F/H/G: exactly 220,500 frames (5 s); A/B: 52,920; C: 132,300; D/E: 176,400; I: 441,000 |
| MP3 | All nine copies decode gaplessly to the corresponding WAV frame counts |
| Levels | Worst delivered 4× oversampled peak −3.72 dBFS; no clipping or non-finite samples |
| DC | Coin-only audition means below 2×10⁻¹²; groove mean below 7.2×10⁻⁵ including unchanged kick/clap |
| Mono | A–E mono RMS relative to stereo: 0 to −.269 dB; F: −.046 dB; no artificial phase widening |
| HF/stability | Supported parameter extremes have poles strictly inside unit circle, modes below 15 kHz, and energy above 17 kHz below −30 dB relative to total; LP/DC stages remain finite |
| Maximum duration | Full 6 s spin/roll render finitely within 7.5 s including settle/tail, fewer than 1,000 contacts |
| Timing | Motifs, off-grid notes, swing/humanization match original bridge nearest absolute trigger frames; natural release/caps are explicit |
| Stems | Float stems sum exactly; delivered PCM24 stems reconstruct dry master within 5 PCM24 units |
| Compatibility | Ordinary V12/rack scores keep identical audio/stems and original part seed indices; proof kick/clap stems match original bridge output |
| Protected inputs | Frozen hash verification and all **138** existing bridge protected-file hashes pass; no changes to rack, packs, contracts, CRUSH or masters |

F dry and H selective CRUSH both measure **−19.6 LUFS**. F's 4× peak is **−4.12 dBFS**, H's **−3.72 dBFS**. H uses 25% processed face/bounce, preserving the other routes, then a **+.4 dB global comparison trim**. I concatenates F/H at exactly five seconds. Loudness and peak are verification data, not perceptual scores. The 4× peak estimator is not a certification of every possible intersample peak.

Validation commands:

```sh
npm run typecheck
node --test tests/bollo-coin.test.ts
node --test tests/v12-motif-bridge.test.ts tests/v09-motif.test.ts \
  tests/v09-motif.integration.test.ts tests/fable-crush.test.ts \
  tests/studio-rack.test.ts tests/v12-signature.test.ts \
  tests/v12-signature.integration.test.ts
```

Typecheck passes, including all new modules through the new test imports. The **13 coin tests pass**. The seven existing files supply **67 passing tests and one skipped test**: the historical HOOK//10 B1 rebuild requires its recorded FFmpeg build. The existing signature showcase also omits historical MP3 byte comparison on a different selected codec build; its render/structure tests pass. No frozen source was adjusted to accommodate this environment. An initial sandbox run blocked Node subprocesses with `EPERM`; rerunning with subprocess access passed the affected package/CLI tests.

Exact bytes are qualified to the recorded runtime and codec. Two independent synthesis renders are verified; no cross-platform libm equivalence is asserted. No full-suite claim is made beyond the relevant files above. This QA does not establish perceptual quarter recognition or musical approval. Owner listening review remains the next gate; further development and composition stop here.
