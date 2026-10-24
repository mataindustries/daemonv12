# MORPH v1.0.0

Five frozen mono, 44,100 Hz, PCM16 one-shots: cable pluck/slap, Beast WOM,
and open/tight ratchet slices. `kit.json` maps the two cable articulations and
two ratchet slices; the Beast is played with a sampler track.

Generation parameters, source revisions/hashes, generator hash and WAV hashes
are in `examples/morph-v1.catalog.json`. The source audit and reproduction
instructions are in `docs/MORPH_SOUND_AUDIT.md`. Regenerate from the checkout:

```sh
node scripts/generate-morph-pack.ts
node bin/daemonv12.js render examples/morph-sync-demo.json --out-dir work/morph-demo
```

The demo is eight seconds and needs Node only. Each ratchet repeat is a
separate scheduled note so its audiovisual onset can be exported independently.
Pitch-rate changes also change duration; this pack does not implement time stretch.

These are new offline adaptations, not isolated stems of the approved master.
The original throat, continuous tension controls, performance controllers and
mastering chain are not runtime engine features. Repository licensing has not
been selected; this prototype asserts no new license grant for historical
source or derived samples.
