# DaemonV12 v0.8 studio integration candidate

This branch combines the approved production foundation and Signature Instrument
Rack for owner review. It does not declare v0.8 released. Package/engine version
remains 0.7.0; licensing and publication settings are unchanged.

## Exact inputs and order

| Input | Exact commit |
| --- | --- |
| Latest fetched main | `e2962cc1a443c841cd6ca7cb2cc56c5ebabf0e99` |
| PR #44, merged first | `713ab8b48da363975a993d4478dca7b01e66d2e2` |
| PR #43, merged second | `bdf78bd23dc1d994f3df2ef58d37a8610a7d4e29` |

The two ordered merge commits are `f5f70f94667d7bdeb752aa3599223b3502dbb3c6`
and `8b0af15638414e0aa4aba39c7c75c229507c46b4`. Both merges were clean.
PRs #39, #41 and #42 are already ancestors of #44 and were not merged separately.

[inputs.json](../proofs/v08-studio-integration/inputs.json) hashes the exact Git
blob bytes of all 173 files imported by the two source PRs. Of these, 172 remain
unchanged, including the instruments, engine, rack, auditions, CROSSING, HEADLINER
and SODIUM HOURS verification evidence. The sole adjustment is recorded in
[ci-adjustments.json](../proofs/v08-studio-integration/ci-adjustments.json): GitHub
retired macOS 14 on November 2, so its package check uses `macos-15-intel`, retaining
Intel macOS coverage with the same tests. The approved freeze manifest still verifies
all 31 entries: engines, audition scripts, 18 audio files and their manifests.
The SODIUM HOURS source/delivery is outside these two PRs; this candidate preserves
#44's sealed SODIUM evidence and does not regenerate or modify that composition.

## RELAY: one short new composition

[The score](../production/v08-studio/relay.score.json) is six bars in D minor at
96 BPM, with a two-second tail: **17 seconds** in total. Living Bass and Impossible
Voice trade a rising figure with Mechanical Orchestra bars and clock. All notes,
macros and room settings address the existing approved rack. There is no new
instrument code or full-length composition.

The [complete review delivery](../production/v08-studio/delivery/) contains the
authored and expanded scores, native PCM16 phrase assets, catalog, registry,
generator sources, PCM24 master, five PCM24 stems, MP3 listening copy, analysis,
engine/adapter hashes, provenance and exact-file-set `SHA256SUMS`.

- Master: `delivery/masters/main.24.wav`.
- Listening copy: `delivery/listening/main.24.mp3`.
- Stems: bass, voice, bars, clock and wet-only room under `delivery/stems/`.

The route is the rack's **unmodified native bounce**, followed by #44's
`packageProduction24` with bounded voice reuse. Canonical PCM16 source bytes are
preserved. Processing and master summation use Float64; each export is quantized
independently to PCM24. The MP3 is encoded directly from the final PCM24 master.
PCM24 retains newly computed fractions; it cannot recover detail lost in PCM16
sources. The unity-gain room stem needs no additional fractional detail.

## Measured acceptance results

[verification.json](../proofs/v08-studio-integration/verification.json) records:

- Master and all five stems: stereo 44.1 kHz integer PCM24, **749,700 frames**.
- All 15 section triggers use the native engine frames. An independent reference
  reconstructs each stem from the PCM16 phrase bytes and catalog placement, then
  reconstructs the master from the original floats before stem quantization.
  Every exported sample matches: zero frame lag and **zero PCM24 LSB error**.
- No export clips. The master contains 1,493,641 nonzero low bytes; four stems
  also retain fractional processing detail. Master measurements: −23.93 LUFS,
  −13.33 dBTP. No normalization, dither or additional mastering was applied.
- Two independent native bounces, one in a fresh process, match all 28 files.
  Independent production packages and a fresh-process complete replay match all
  **67 files** per package, including metadata, sources, stems, master and MP3.
- Source bytes, rack generators, frozen engines, engine sources, adapter and
  MP3 derivation are verified against their recorded hashes.

Master SHA-256:
`ff723b7262c416d21acc5e95a61afd7e5dcf05689895398c122842e2c81bb5d3`.

The separate PCM16 regression report is
[pcm16-verification.json](../proofs/v08-studio-integration/pcm16-verification.json).
An independent archive of main, the integrated default renderer and opt-in voice
reuse produce identical audio for four existing projects: four masters and
25 stems, plus MIDI. Default manifests are byte-identical too. All 80 adversarial
cache comparisons pass. `scripts/verify-v08-pcm16.mjs` prepares these renders with
the configured audio environment, then invokes #44's unchanged comparator with
`--existing`, which hashes the actual output bytes. The CROSSING check also forwards
the configured environment explicitly; the new verifier never relies on a system
FFmpeg installation.

CROSSING is re-bounced into scratch space, without invoking its delivery builder.
All 53 native phrase WAVs match the approved package manifest; both PCM16 masters
and all 12 main stems match their approved hashes. The original delivery and all
approved audition files remain byte-identical.

## Reproduce and CI

```bash
npm ci
node --test tests/v08-studio.test.ts
node scripts/verify-v08-studio.ts NEW_OUTPUT_DIRECTORY
```

The acceptance script refuses an existing output directory. It renders only into
that new directory and temporary scratch space. The existing compositions and
approved audio are read-only inputs. WAV reference hashes are checked against the
committed proof. Full metadata and MP3 byte comparisons are within the recorded
runtime/toolchain, not a claim of cross-platform bit identity.

The new **v0.8 Studio integration** workflow repeats the complete rack/PCM24 proof,
CROSSING preservation and archived-main PCM16 comparison. It retains a sealed
technical review delivery as a 14-day Actions artifact. Existing **Portable checks**
and **Production24 full audio** workflows run on the same PR. The apt full-audio
job covers the historical checks requiring Ubuntu's exact FFmpeg build; the
rootless jobs cover the pinned bootstrap toolchain.

The source PRs' independent CI results are evidence for the inputs. Only green
checks on the final integration head justify the integration GO recommendation.
The PR records the final head, run links and current recommendation.

## Merge procedure after explicit owner approval

1. Confirm the integration PR still targets `main`, its head is the exact SHA
   recorded with the GO recommendation, and main is still the base above. If
   either changes, update the integration and repeat the relevant CI before merge.
2. Confirm Portable checks, Production24 full audio and v0.8 Studio integration
   are all green on that head, and satisfy GitHub's review/branch rules.
3. Merge the **final integration PR once with a merge commit**. Preserve the two
   reviewed PR heads and their order. Do not separately merge #44, #43, #39, #41
   or #42; the final PR contains their approved aggregate.
4. Re-fetch main and verify that both exact source heads are ancestors. Keep
   release, versioning, licensing, npm publication and music release for separate
   explicit approval. Do not create a v0.8 tag or release as part of this merge.

This is a technical GO gate for an integration merge. Human listening and
release-specific mastering approval are not asserted by measurements or hashes.
