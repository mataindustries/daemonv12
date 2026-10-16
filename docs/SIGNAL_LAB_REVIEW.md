# SIGNAL Lab optional pack — independent review handoff

Status: implementation ready for review; **release verification incomplete**.
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

## Validation on Node v24.19.0

- `npm run test:signal-lab`: 3 passed. Checks source hashes, PCM16/44.1 kHz,
  expected channels/durations/endpoints, catalog and kit mappings, byte-identical
  regeneration of 13 outputs into a temporary directory, exact tarball contents,
  unpacked source hashes, opt-in discovery and repeatable engine 0.7.0 playback.
- `npm run check`: typecheck passed; 298 tests, 290 passed, 0 failed, 8 skipped.
- Six PATH-dependent skips passed on separate reruns with the configured audio
  tool directory added to PATH: `tests/mcp.integration.test.ts` (the real stdio
  session) and `tests/{production,render,samples,stems}.integration.test.ts`.
- Two historical gates remain skipped: GLASSHOUSE and GLASS//FIRE require FFmpeg
  `6.1.1-3ubuntu5`, whereas this environment provides `6.1.1`. Their expected
  hashes are preserved. Other historical byte checks passed, including the
  recorded Orbital Foundry master/stems and the V0.5 Node-only master/stems.
- `npm run test:package`: 9 passed, including full audio from the installed core
  package and exclusion of the optional pack. An initial run detected changing
  scratch-log filenames in git status; scratch files were moved outside the
  checkout and the clean-room test then passed.
- `npm run smoke -- --mcp`: passed, including nonzero audio, SHA-256 and nine tools.
- `npm run pack:signal-lab`: produced the local 18-file optional tarball without
  publishing. Source `SHA256SUMS.txt` verification and `git diff --check` passed.

## Outstanding release gate

The supplied `signal-audition-projects.zip` could not be downloaded: the file tool
rejects transfers larger than 32 MiB. The existing SIGNAL audition has therefore
**not been inspected or verified**. The test-only package smoke project is not a
substitute for that audition.

To finish this requirement, provide a smaller archive containing an existing
audition's project JSON and render/hash manifests (audio may be omitted). Preserve
the authored project, resolve its existing assets, and validate/render it with the
pinned 0.7.0 engine in a temporary workspace. Compare any supplied canonical hashes
under their specified toolchain and record the result before treating release
verification as complete. Do not regenerate samples or alter historical hashes
to force a match.
