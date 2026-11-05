# Production24 integration evidence

No merge, release or publication is included. The canonical SODIUM HOURS tracked
tree remains unchanged at `6b1ab7b8f1602bd4e57244b16caee68d8876336f`.

- `original.verification.log`: existing canonical FLAC/delivery/render verification.
- `sodium-hours.legacy.json`: integration PCM16 master and all 15 stems match locked delivery.
- `sodium-hours.ab.json`: full A/B, source hashes, continuous boundary diagnostics,
  stem identities, 221-file independent replay and artifact provenance.
- `sodium-hours.24.render.json`, `sodium-hours.mastering.json`: copies of the
  delivered PCM24 metadata, with paths relative to the production package.
- `legacy.verification.json`: four independent main/integration legacy comparisons
  and 80 adversarial cache cases.
- `local-ci.json`, `LOCAL_CI_SUMMARY.md`: actual local checks, skips and remote blockers.

Audio remains in the local review delivery, outside Git:

```text
work/sodium-hours-ab/
  original/sodium-hours.pcm16.wav
  original/sodium-hours.pcm16.mp3
  original/sodium-hours.locked.mp3
  production24/masters/sodium-hours.24.wav
  production24/stems/*.wav
  production24/listening/sodium-hours.24.mp3
  production24/source/...
  production24/metadata/...
  verification/...
  SHA256SUMS
```

`work/sodium-hours-ab-replay` is the independent complete-package render;
`work/sodium-hours-ab-legacy-pcm16` is the integration's preserved PCM16 regression.
The sealed delivery archive contains original/master listening copies, aligned
PCM24 stems, canonical assets, original generator/catalog/rights inventory and
verification. The archive and Git bundle are produced locally for review.

Reproduction and limitations: [integration report](../../docs/PRODUCTION24_INTEGRATION.md).
