# LATCH / RELEASE — original benchmark-local sounds

All WAVs in this directory were synthesized specifically for Ultimate Beat Battle
Round 2 / Astra by `../generate-assets.mjs`. No recordings, external samples,
Round 1 assets, or competitor material were used. Generated WAVs are dedicated
under **CC0-1.0**. The source generator is preserved alongside them.

All are 44,100 Hz signed PCM16, mono or stereo, with finite envelopes and tapered
endpoints. Noise uses fixed xorshift32 seeds; oscillators use deterministic
mathematical recipes. There is no embedded musical sequence in a source.

`../asset-catalog.json` records source tuning, frames, channels, synthesis recipes
and SHA-256 hashes. `kit.json` maps the original percussion and V1 chords;
`harmony-v2.json` maps the broader reed chords used by V2/V3. V1 sounds remain
unchanged so every saved version can be reproduced.

The central family is `latch-fs.wav`, its prepared reversal `latch-inhale.wav`,
and the wire responses. Bass sources are tuned F#1 and F#2. Project playback
rates author the other pitches; source duration therefore changes with pitch.

Regenerate from repository root:

```sh
node benchmarks/ultimate-beat-battle/round2/astra/generate-assets.mjs
```

Generator determinism is checked in the same Node/environment; cross-platform
floating-point transcendental differences are outside that promise.
