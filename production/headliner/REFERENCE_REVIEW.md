# Reference extraction and preservation audit

Reviewed the SODIUM HOURS creative log, detailed production notes, README and asset inventory; its source builders (`tools/build.ts`, `song.ts`, `kits.ts`, `theory.ts`, `hook.ts`, `single.ts`, `instruments.ts`, `dsp.ts`, sketches and audition harness); production analysis and reproduction scripts. Reference commit: `6b1ab7b8f1602bd4e57244b16caee68d8876336f` on `claude/peaceful-bardeen-f7swi8`.

## Reusable mechanisms

| Reference | Reusable technique | Boundary for this foundation |
| --- | --- | --- |
| `headliner-001/tools/song.ts:14` and `:88` | Register generated source families on demand; collect absolute-tick events; write section patterns/clips, track mix and automation into ordinary v0.7 project JSON. | Reimplement a small typed helper around current engine types; do not inherit the fixed 4/4 / 960-PPQ assumptions silently if later generalized. |
| `headliner-001/tools/instruments.ts:250` | Save phrase notes independently of the renderer: onset, duration, MIDI pitch, velocity and expression. Render a complete continuous legato performance before sampling. | Preserve the control concept; do not carry the talkbox phrase, vowels, patch or its sound as the starter default. |
| `headliner-001/tools/kits.ts:44` | Native-pitch multisamples avoid expensive interpolation and unwanted pitch/duration coupling; optional wet-only phrase bounces share the dry source calculation. | Supply a fresh minimal instrument and new pitches; dry/wet split is optional rather than a required production aesthetic. |
| `headliner-001/tools/song.ts:118`, `tools/build.ts:27` | Catalog per-source recipe, tuning, channels, frames, bytes, source SHA-256 and generator hashes; deterministic seeded generation. | Hash all starter inputs and assets, including score and kit, and fail explicitly on missing or changed members. |
| `headliner-001/tools/song.ts:157`, `tools/single.ts:39` | An alternate arrangement can share canonical assets while choosing different events/tracks. | Variants should render as separate normal projects; authored musical development belongs in score data. |
| `headliner-001/tools/flac.ts`, `scripts/verify-delivery.sh` | Separate canonical saved audio from source regeneration; exact lossless recovery plus SHA verification; clean temporary render and comparison. | Tiny PCM16 WAV assets need no FLAC complexity. Reproducible package needs source, score, assets, tool identity, hashes and reproduction commands. |
| `headliner-001/analysis/stem_matrix.py` | Section-by-section stem balance exposes whether a development or reduced arrangement retains its intended hierarchy. | Keep the method and explicit section metadata; its NumPy dependency is unnecessary for a tiny starter. |
| `headliner-001/analysis/master_sim.py` | Audition master changes cheaply on existing stems before rerendering a whole song. | The simulator mirrors v0.7 PCM16 summing, FFmpeg filters and tanh order; it is not automatically compatible with PR #41 Float64 stems. Do not promote a second engine implementation into this PR. |
| `headliner-001/analysis/pitch_check.py`, `spectro.py` | Compare monophonic phrase synthesis against saved score; visualize click, spectral and transition problems. | Parameterized analysis is reusable, but neither pitch agreement nor loudness metrics establish musical quality. Existing readers assume PCM16. |
| `headliner-001/CREATIVE_LOG.md` and `PRODUCTION_NOTES.md` | Explicit thesis, contrasting sections, later transformations, evidence-backed critique and a fixed stop budget. | Reuse the process, without fixing genre, key, tempo, loudness, number of sections or song length. |

## Song-specific material excluded

`tools/hook.ts` contains the actual SODIUM HOURS call/answers, fragments, swing amount and final resolution. `tools/single.ts` contains its F-minor voicings, Dorian vamp, D♭–E♭–Fm–C7 progression, rhythm patterns, tempo, 70-bar form, layering and master settings. The sketches are alternative compositions rather than generic demos. `tools/kits.ts` is an orchestration palette tied to these identities: F-tuned kick/lamp, phrase and chord names, West Coast bass, talkbox, rain, siren, city atmosphere and machine/voice/choir concept. Even broadly useful DSP primitives are interleaved with those choices. None of this musical material or audio is needed by the starter.

SODIUM HOURS already succeeded on unchanged DaemonV12 v0.7.0. Its README records 13 interpolated voices / approximately 3.7% of the one-billion-tap budget because most sources play at rate 1 and expressive passages are bounced. Voice reuse is therefore optional capacity for other arrangements, not a prerequisite or a correction of this song.

## Preservation evidence (read-only; no restore or full render)

The reference worktree was clean before and after inspection (`git status --porcelain` empty). No reference source, audio, catalog or hash file was edited. Existing committed delivery files were read and SHA-256 checked against `delivery/SHA256SUMS`: **25 verified, zero mismatches**. The remaining **16 entries** describe 15 stem WAVs and the alternate WAV stored as FLAC; their recorded hashes were retained without decoding or rerendering.

| Object | Existing identity |
| --- | --- |
| Final master `headliner-001/delivery/sodium-hours.wav` SHA-256 | `43da3fd7119f5add17ff9896e29d46123cdb1f214ea9fc8e7747513903f1e07d` |
| Final project SHA-256 | `fb9ca8ad10ca3029b0d873e6190760ba6e20019bb021744e2cf5b1e8de644edb` |
| Catalog SHA-256 | `b03b3c7ed0ea04e245c99cbffa46b6593376df9b5cc5d5b399a97e6c3d1d7f9e` |
| Delivery SHA256SUMS SHA-256 | `a0a1671953a36e3473bd60985cad63a6263bf69446548162a7a09fe0c3f642ee` |
| Complete `headliner-001` Git tree | `13401fbf9e0bf4e7882059c979087e6ac67430cf` |
| `headliner-001/project` Git tree | `6f85cd4dd91da48ed8dd43f651152c5f7ba0250a` |
| `headliner-001/project/assets` Git tree | `ae84a5d01ac6e372d57c254bb8bb977be2650408` |
| `headliner-001/delivery` Git tree | `a3fc338267ad4b414ca00561cf7b39019fa8beca` |

These immutable Git trees preserve every existing source/asset/hash member at the reference commit. This foundation is based on main and does not import or rewrite the reference branch. The saved-output hash audit confirms preservation; it does not repeat the prior full-length reproduction proof.

## WEST//GHOST boundary and reusable control interface

Reviewed PR #40 at `afd0bb91f630b339b8c6a10dc196a0b5f745bf80`, specifically `scripts/westghost-dsp.ts`, `scripts/generate-westghost.ts` and `packs/westghost-001/README.md`. Keep the entire pack experimental. Its four instruments, eight reference articulations and studies should stay outside the default starter. No subjective sound approval follows from its deterministic output or DSP checks.

Useful interface concepts:

- `Performance` separates `note`, `gate`, `release`, `velocity`, `articulation`, `seed` and curves (`pitch`, `expression`, `timbre`; instrument-specific `motion` / `breath`). Absolute MIDI pitch and time in output seconds avoid playback-rate coupling. Duration is synthesized independently of pitch.
- Curves have finite bounded values, at most 128 points and strictly increasing local seconds; linear interpolation, pre-first-point fallback and held last value are documented. Pitch movement inside one event retains phase; separate events restart it.
- `compileScore` validates complete score, output boundaries, unique-source count and synthesis duration before writes. It hashes each performance into a reusable source, writes native-pitch PCM16 WAV/kit/project, and saves performance score and provenance alongside it.
- Fixed generator gain preserves authored velocity/expression; normalizing every note to a common peak would erase performance intent. Playback velocity is 1 when velocity is already baked into the source.

The generic starter can adopt a subset of these ideas using its own neutral instrument and score. Do not import WEST//GHOST DSP, instrument IDs, patches, scores or generated audio. It needs no PR #40 integration.

## Follow-up tasks after this bounded foundation

1. Owner listening of the new example before any claim about sound quality; separately retain the existing SODIUM HOURS listening/licensing decisions.
2. If future scores justify it, extract a stable generic performance schema with adapters and documented units. Keep instrument-specific controls separate.
3. Add optional wet-only bounces or externally supplied asset recipes only when a concrete production requires them, retaining provenance and tail accounting.
4. If PR #41 is later integrated, update any PCM16-specific analysis/reconstruction tools explicitly; its precision path does not improve already quantized sources.

No licensing declaration was changed. SODIUM HOURS `ASSETS_AND_LICENSES.md` states that generated sounds, composition and code await owner declaration; original numerical synthesis alone grants no license. Carry an equally accurate provenance/license status into the new example.
