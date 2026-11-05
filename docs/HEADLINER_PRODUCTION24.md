# Optional HEADLINER PCM24 delivery

`scripts/headliner-production24.ts` connects the existing HEADLINER foundation to
the separate Float64 production renderer. Ordinary engine, CLI, MCP, Composer and
foundation commands retain their legacy behavior. The adapter accepts only existing
sampler/drumkit projects; it does not alter musical data or generate new instrument
types. GM remains outside this precision path.

Run from this engine checkout with Node 22.18+ and FFmpeg/libmp3lame:

```sh
# Existing unchanged composition and canonical assets:
node scripts/headliner-production24.ts project PATH/song.json NEW_DELIVERY
# Existing HEADLINER short score, through its existing source generator:
node scripts/headliner-production24.ts starter production/headliner/example.score.json NEW_DELIVERY
# Optional bounded voice reuse is explicit on either command:
node scripts/headliner-production24.ts project PATH/song.json NEW_DELIVERY --reuse-voices
# Verify every member, then reproduce the entire sealed package:
node scripts/headliner.ts hashes NEW_DELIVERY
node scripts/headliner-production24.ts replay NEW_DELIVERY SECOND_DELIVERY
# Use the existing deterministic archive route:
node scripts/headliner.ts pack NEW_DELIVERY delivery.tar.gz
```

The output must be a new directory. Failed rendering or MP3 encoding removes the
temporary package; an existing delivery is never replaced. Canonical project and
compiler-loaded asset bytes are copied unchanged, including any sidechain reference.
Additional generators, scores, catalogs and rights documents can be included through
the exported API:

```ts
import { packageProduction24 } from './scripts/headliner-production24.ts';
await packageProduction24('canonical/song.json', 'NEW_DELIVERY', {
  reuseVoices: false,
  provenance: { referenceCommit: 'IMMUTABLE_REFERENCE_COMMIT' },
  sourceFiles: [{ path: 'canonical/catalog.json', file: 'catalog.json' }],
  licenseFiles: ['canonical/ASSETS_AND_LICENSES.md'],
});
```

| Directory/file | Contract |
| --- | --- |
| `source/` | Unchanged project, canonical PCM16 sources/kits and explicitly supplied source files. |
| `masters/*.24.wav` | Stereo 44.1 kHz genuine PCM24 export from Float64 track processing and master sum. |
| `stems/*.wav` | PCM24 post-track/pre-master exports, padded/truncated to the master frame count. |
| `listening/*.24.mp3` | 192 kbit/s libmp3lame copy encoded directly from the final PCM24 master, without gain changes. |
| `metadata/render.json` | Precision renderer manifest with delivery-relative paths, analysis, asset hashes and any bounded-cache evidence. |
| `metadata/mastering.json` | Original master/render parameters, sample/true peak, headroom, loudness, export and listening derivation. |
| `metadata/provenance.json` | Engine/runtime identity, exact engine source hashes, adapter hash and caller reference facts. |
| `metadata/inventory.json` | Every included source's hash/type/precision and a rights-document inventory. |
| `metadata/licenses/` | Supplied documents copied verbatim; no license declaration is invented. |
| `SHA256SUMS` | Exact member-set verification, including MP3 and all metadata. |

Sources remain PCM16. Float64 interpolation, velocity/envelope, gain/pan,
automation, ordered effects and summation retain newly calculated fractional
detail until PCM24 export. No source detail lost before processing is recovered.
PCM24 stems are independently quantized; their sum need not match the Float64-summed,
master-processed master byte for byte. No dither or extra normalization is added.
Authored nonlinear/master effects remain in their original order.

Replay verifies the package before using its preserved source/extras/rights/caller
facts. Exact byte reproduction, including MP3, requires the same engine source,
Node version, FFmpeg build and platform behavior. No timestamps or temporary
absolute paths are written by the adapter. Existing limits remain 15 tracks,
600 seconds including tails, one billion interpolation taps and 128 MiB cached
performed voices; this remains an in-memory renderer, not a streaming engine.

Technical metrics do not certify sound quality. The metadata explicitly retains
human listening, rights clearance and release-specific mastering as pending;
clipped master/stem exports add concrete blockers. Providing rights documents
does not itself grant commercial permission. Packaging is local and does not
merge, release, publish or distribute the result.

Focused verification:

```sh
node --test --test-isolation=none --test-reporter=spec tests/headliner-production24.test.ts
npm run typecheck
node node_modules/typescript/bin/tsc -p tsconfig.build.json
```

The tests check unchanged project/source bytes, sidechain inventory, genuine
fractional PCM24 detail, master/stem alignment, direct-master MP3 derivation,
complete package replay equality, refusal to overwrite, failure cleanup and the
existing foundation's explicit PCM24 route.
