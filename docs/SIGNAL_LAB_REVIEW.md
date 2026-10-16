# SIGNAL Lab optional pack — independent review handoff

Status: SIGNAL audition verification complete; **GO for independent release review**.
Rights remain **PENDING OWNER REVIEW**. No ownership attestation, licence grant,
CC0 dedication, publication, deployment or merge is part of this change.

## Scope and preservation

Base: `ea9dfbcef4ac54698313c300640ed0a7be74059e` (current main at implementation).
The engine remains version 0.7.0 at that pinned revision; no engine or MCP source
is changed. Existing examples, audio, historical hash assertions, competitions
and showcases are unchanged.

`packs/signal-lab/0.2.0/` preserves every file from `signal-instruments.zip`,
including all nine WAVs, three kits, catalog, generator, README and SHA256SUMS.txt.
The supplied checksum manifest is independently pinned by the test. Source ZIP
SHA-256: `74553708aad7dba72d9adb0d9e5e044699911c4f23c06f1f5ab846e876055e49`.
Only private package metadata and separate installation/limitation notes are
added to that directory. No verified sample is replaced by regenerated output.

The pack has its own local tarball and explicit asset-copy installation. It is
excluded from the core tarball and default init. Existing project-relative MCP
discovery finds all nine samples and three kits after installation. The five-note
lead, fixed source chord timings and absence of true legato are documented in
[INSTALL.md](../packs/signal-lab/0.2.0/INSTALL.md).

## Initial implementation validation on Node v24.19.0

- `npm run test:signal-lab`: 3 passed. Checks source hashes, PCM16/44.1 kHz,
  expected channels/durations/endpoints, catalog and kit mappings, byte-identical
  regeneration of 13 outputs into a temporary directory, exact tarball contents,
  unpacked source hashes, opt-in discovery and repeatable engine 0.7.0 playback.
- `npm run check`: typecheck passed; 298 tests, 290 passed, 0 failed, 8 skipped.
- Six PATH-dependent skips passed on separate reruns with the configured audio
  tool directory added to PATH: `tests/mcp.integration.test.ts` (the real stdio
  session) and `tests/{production,render,samples,stems}.integration.test.ts`.
- Two historical gates were initially skipped: GLASSHOUSE and GLASS//FIRE require FFmpeg
  `6.1.1-3ubuntu5`, whereas this environment provides `6.1.1`. Their expected
  hashes are preserved. Other historical byte checks passed, including the
  recorded Orbital Foundry master/stems and the V0.5 Node-only master/stems.
  Follow-up verification of these gates is recorded below.
- `npm run test:package`: 9 passed, including full audio from the installed core
  package and exclusion of the optional pack. An initial run detected changing
  scratch-log filenames in git status; scratch files were moved outside the
  checkout and the clean-room test then passed.
- `npm run smoke -- --mcp`: passed, including nonzero audio, SHA-256 and nine tools.
- `npm run pack:signal-lab`: produced the local 18-file optional tarball without
  publishing. Source `SHA256SUMS.txt` verification and `git diff --check` passed.

## Original SIGNAL audition verification (2026-10-16)

Continued from `7505d67` on `feat/signal-lab-instruments`. The original large ZIP
exceeded the transfer limit; the supplied compact evidence closes that input gap.
No project builder was run and no music or instrument files were edited.

### Evidence and inputs

`SIGNAL_audition_verification_small.zip` SHA-256:
`c06ba4ec20931062e87dc0621d815887195790d288b0f40ae58984973c86437d`.
ZIP CRC validation passed. All **24 original members** listed in
`SELECTED_SHA256SUMS.txt` passed SHA-256 verification, including the two projects,
final/repeat render manifests, analysis, cues, environment and measurements.
The two additional archive control files are READ_ME_FIRST.md and the checksum
list. The full original ZIP's stated hash is supplied provenance metadata; the
omitted original ZIP itself could not be independently hashed here.

Original project SHA-256 values (unchanged in the temporary render workspace):

- A, `signal-original-palette.json`:
  `cceef062dc82e589a11c911a4d77801bcb9b2bbe8c68ad518243201910a19e10`.
- B, `signal-expanded-palette.json`:
  `882090e1676b5683677e48a1307825c6aa48b86b1de2201aab59a09b23ec686f`.

Existing Orbital Foundry and GLASSHOUSE assets were copied into temporary
`assets/` alongside the committed SIGNAL Lab assets. All **24 legacy WAV/kit
hashes** matched `benchmarks/banger-lab-001/approved-palette.json`; all **25 asset
references across both reference manifests** matched their staged bytes. SIGNAL
source integrity remained covered by its supplied manifest and automated test.
No frozen competition files or palette entries were changed.

### Engine, toolchains and invocation

The audition environment record pins engine commit
`02438eda48506a94d10ad2756c6aafff8c5a9469`, version **0.7.0**. That exact commit
was extracted with `git archive` into scratch space and used for validation and
rendering. Its `src/`, `mcp/` and `bin/` trees are identical to commit `7505d67`.
Both original projects validated with **zero errors and zero warnings**.

Node **v22.22.0**, matching the reference, was downloaded from nodejs.org and
verified against its official SHA256 list (binary archive hash
`9aa8e9d2298ab68c600bd6fb86a6c13bce11a4eca1ba9b39d79fa021755d7c37`).
Ubuntu FFmpeg **6.1.1-3ubuntu5** and its libav libraries were extracted locally
from Ubuntu packages, verified against the Ubuntu package-index SHA-256 values.
The FFmpeg package hash is
`1a23baace5f2688a47e28119aedae6993cd638e6279a7227dfc52d9a337a1c17`.
No system packages or engine files were modified. This is a rootless toolchain
reconstruction on Debian with other available dependencies, not a reproduction
of the complete original Ubuntu OS image.

Each project was rendered twice with the pinned Node/engine and each of two
FFmpeg builds: the available **6.1.1** build and the reference Ubuntu
**6.1.1-3ubuntu5** build (eight renders total). Invocation:

```sh
"$pinned_node" "$pinned_engine/bin/daemonv12.js" validate "$original_project" --json
DAEMONV12_FFMPEG="$selected_ffmpeg" "$pinned_node" \
  "$pinned_engine/bin/daemonv12.js" render "$original_project" \
  --out-dir "$fresh_output" --stems --format wav --json
```

### Exact results

With the reference Node/FFmpeg versions, **all supplied artifact hashes matched
in both fresh runs**: 18 files for A and 16 for B. These include each master,
MIDI, complete render manifest, complete analysis JSON, and all **14 A stems and
12 B stems**. The evidence's final and repeat hash lists also agree exactly.

| Artifact SHA-256 | A: original palette | B: expanded palette |
| --- | --- | --- |
| Master WAV | `e8516109e5df82897e2662c0f52b27e185a5de8bf5cce71bfcb91c2cae570f53` | `c1fa8f647dd405bb25a387af39d71dacc8b08659aa2fc230af1343c4c8288f55` |
| Render manifest | `cf9ca23e08d32fa02ee343685653d42aed555d1da74e1186cd4c7fe797a5d848` | `aa1a5f05f444191bdc4a98857c539448b1b10907427daa0856e58621c5fee110` |
| Analysis JSON | `344f0f346c93f846c594090d16c59d49e16af535224677e85e0fb987aeb6760c` | `b696529b716358e469a610468a5e3a072c3ab6fbd60c6656d2fce0588ea12616` |

Both masters and every stem have exactly **1,323,000 frames / 30 seconds**,
PCM16, 44,100 Hz, stereo. The eight common stems are byte-identical between A
and B. Regenerating only the supplied cue files with the pinned engine produced
byte-identical cues for both projects: ten sections, eight hits and the original
edit points, including 1,800 video frames at 60 fps.

PCM checks independently confirmed zero nonzero samples in **[661500, 793800)**
(15–18 seconds) for both masters and all 26 stems, no full-scale samples, and
an exactly silent final 10 ms. All stem peaks and master endpoints matched the
supplied final measurements; the last nonzero master times are
**29.512312925170068 s (A)** and **29.425895691609977 s (B)**.

| Engine master analysis (exact reference match) | A | B |
| --- | ---: | ---: |
| Peak dBFS | -2.477595 | -3.354594 |
| RMS dBFS | -22.396222 | -22.318643 |
| Integrated LUFS | -19.46 | -19.6 |
| Loudness range LU | 5.9 | 5.3 |
| True peak dBFS | -2.48 | -3.33 |

Full master **and per-track** engine analysis matched exactly, not just the
summary above. These are the engine's loudnorm measurements; the supplied report
also quotes ebur128 measurements, which use a different analysis method.

With the available FFmpeg **6.1.1** build, master/stem/MIDI hashes and analysis
still matched exactly on both runs. Recursive manifest comparison found only
`production.processor.version` and `audioTool.version` changed from
`6.1.1-3ubuntu5` to `6.1.1`; both full reference manifests matched once the
reference build was used. These were toolchain identity differences, with
**no observed audio regression**.

### Remaining checks and review limits

- On Node 22.22.0, `tests/signal-lab.test.ts`: **3 passed**, including original
  SHA-256, WAV format, regeneration, optional packaging and kit discovery.
- On Ubuntu FFmpeg 6.1.1-3ubuntu5, compatibility Gates A–D passed, including the
  previously skipped GLASSHOUSE historical master and ten stems.
- GLASS//FIRE Gate E initially matched its historical master, all fifteen stems
  and SoundFont hash, then failed only the FluidSynth identity assertion:
  available **2.3.7**, reference **2.3.4**. A rerun using Ubuntu's locally extracted
  FluidSynth/libfluidsynth **2.3.4-1build3** passed: **1 passed, 0 failed, 0
  skipped**, including audio hashes, SoundFont hash and renderer identity. Across
  the focused runs, all three SIGNAL tests and all five historical compatibility
  gates passed; no failure remains unresolved.
- The initial full suite, installed-package and smoke results above remain
  applicable: this follow-up changes documentation only. Original project,
  evidence and staged asset hashes were rechecked after rendering; source and
  historical fixtures remain untouched. `git diff --check` passed.

The compact archive omits reference WAV/stem payloads. Comparison therefore uses
their supplied SHA-256 values, corroborated by byte-identical full manifests and
analysis; there was no direct access to the omitted reference media. Reported
specialist role/spectral metrics were integrity-checked as evidence, not
independently reimplemented without their omitted measurement tools. No listening
test, realism claim or preference judgment is made.

**Recommendation: GO for independent technical release review.** This verifies
the existing auditions without changing music, instruments, engine or historical
fixtures. It does not authorize public/commercial release: rights remain
**PENDING OWNER REVIEW**. PR #25 is not merged; nothing is published or deployed.
