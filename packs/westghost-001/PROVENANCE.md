# WEST//GHOST 001 · provenance and rights status

**License: pending owner declaration. No license grant is made here.** The task
authorizes development and review in this repository. That does not establish
the rights needed for external commercial distribution. Existing engine,
Signature and MORPH licensing status is unchanged.

| Evidence | Detail |
| --- | --- |
| Generator | `scripts/generate-westghost.ts` compiles explicitly authored native performances to v0.7 projects and replay assets. |
| DSP | `scripts/westghost-dsp.ts` and `scripts/westghost-resonators.ts`; original numeric recipes and seeded xorshift32 noise. |
| Scores | `scripts/westghost-scores.ts` contains the eight reference performances, four dry studies and three musical studies. Each exported `.performance.json` preserves the controls. |
| Inputs | Numeric parameters and saved curves only. No input audio, downloads, SoundFonts, presets, impulse responses, learned voice, embedded recording or commercial recording analysis. |
| Methods | Additive/spectral synthesis, FM, moving filters, soft waveshaping, modal spring/metal-inspired synthesis and seeded filtered noise. Hand-chosen broad vowel centers describe generic synthetic vowels, without voice impersonation. |
| Relation to MORPH | Existing MORPH documentation informed the production brief's interest in mechanical/sustained articulation. This generator imports no historical MORPH source, sound, branch, physical throat or cable implementation. IRON//BLOOM is its own modal approximation. |
| Generation precision | Float64 synthesis with fixed gain and endpoint/DC treatment, exported to mono 44.1 kHz PCM16 without dither or per-note normalization. |
| Render path | Existing, unchanged DaemonV12 v0.7 sampler/drumkit and production engine. Each note is synthesized at its final pitch and gate duration before sampling. |
| Reproduction | Catalog and per-score source manifests include generator hashes, exact performance inputs, source frame counts and SHA-256. `scripts/verify-westghost.ts` independently rebuilds sources and compares complete render replay artifacts. |
| Authorship | AI-assisted development for `mataindustries` under DAEMON//FORGE 003, isolated from the concurrent HEADLINER 001 composition. The exact model/reasoning settings are not exposed or independently verified. |

No files are relicensed, published or copied into the engine's default installed
palette. No assertion of CC0, exclusive copyright, clearance, release quality or
human listening approval is inferred from original synthesis or test results.
Before commercial release, the owner must decide and document the rights for
code, WAVs, scores, metadata and rendered demonstrations. External audio tools
and dependencies retain their own terms.
