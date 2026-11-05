# RELAY — v0.8 integration review

A 17-second, six-bar D minor study at 96 BPM for the approved Living Bass,
Impossible Voice and Mechanical Orchestra families. Authored specifically to
exercise the Signature Rack's native bounce through the integrated PCM24 path.

Listen to [the MP3](delivery/listening/main.24.mp3), inspect
[the PCM24 master](delivery/masters/main.24.wav), or use the five aligned
[stems](delivery/stems/). The sealed delivery also preserves the score, native
PCM16 sources, generator sources and complete production provenance.

```bash
node scripts/headliner.ts hashes production/v08-studio/delivery
node scripts/headliner-production24.ts replay production/v08-studio/delivery NEW_DELIVERY
node scripts/verify-v08-studio.ts NEW_PROOF_DIRECTORY
```

See [the integration report](../../docs/V0_8_STUDIO_INTEGRATION.md) for exact
source commits, measurements, determinism, PCM16 preservation and merge gates.

Technical review material only. Existing rights declarations remain unchanged;
no license, listening approval, mastering approval or music release is granted.
