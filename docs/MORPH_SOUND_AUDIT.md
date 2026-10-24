# MORPH sound audit and portable prototype

The audit uses `mataindustries/daemonv12` at immutable MORPH//06 revision
`2b6e533a021218d6940a8da5a7032c2abe58a3d9`. Exact source paths and SHA-256
hashes are recorded in `examples/morph-v1.catalog.json`; references can be fetched
from GitHub at that revision. No approved master, historical render or film
asset is changed or used as sample material.

| Original | Proven technique | Prototype decision |
| --- | --- | --- |
| `experiments/morph-03/cable.mjs` | Fractional delay is tension/pitch; allpass dispersion and low-pass loop loss color each round trip. Strike hardness adds relaxing tension; positive-side contact adds buzz. Bow gain depends on amplitude. | Extract one stationary note with the same feedback, allpass, phase-delay compensation, relaxation and contact formulas. Two frozen performances: soft pluck and hard slap. Reduce the dispersion chain from 160 to 32 stages; omit continuously changing controls, drift, harmonic touches and pick-position excitation. |
| `experiments/morph-06/beast.mjs` | A hard-bowed cable drives a nonlinear fold stage, then a Kelly–Lochbaum throat controlled by syllable shapes. A metal ring and clean low band add weight. Pinned normalization prevents a later phrase from changing earlier sounds. | Freeze one WOM gesture. Reuse the bowed cable and fold waveshaper; approximate the mouth with three moving resonators, retaining a simple ring and low band. This is deliberately a timbral approximation, not a port or claim of equivalence to the physical throat. Normalize this finite sound independently before it becomes a sample. |
| `experiments/morph-04/perform.mjs`, `ratchet()` | Repeat a capture once per cable round trip; round onset and length to sample frames and use 0.7 ms triangular edges. Rhythm becomes tone as periods shorten. | Freeze 160 ms and 80 ms first slices of one new cable/contact capture using the original edge rule. Schedule repeats individually with the existing drum kit so each onset remains an event. Dynamic cable-period following is outside this pack. |
| `experiments/morph-03/dsp.mjs` | Seeded mulberry32, Float64 processing, explicit gain staging and PCM output. | Retain seeded integer PRNG operations; export mono PCM16 WAVs with fixed headroom and endpoint tapers. No external DSP or audio tool is required. |

`scripts/generate-morph-pack.ts` contains only offline generation for these five
sounds. It imports no historical branch and needs no downloaded source. The
engine continues to use its existing sampler, drum kit, rate/glide, gate and
envelope implementations. New synthesis code is not added to `src/`.

The catalog is versioned `1.0.0`, separately from engine/project versions. It
records duration/frame count, seed, performance parameters, method, peak target,
WAV SHA-256 and byte count, original source hashes, and the generator's own
source hash. Metadata remains outside `assets/` because asset JSON discovery
treats those files as drum-kit definitions. The committed WAVs are the portable
playback contract. Regeneration uses Float64 transcendental arithmetic; its
reference is Node 22.18+ on the supported runtime, while playback of those PCM
bytes uses the existing deterministic engine. Tests check exact regeneration
against the committed hashes and the complete demo's pinned WAV hash.

The selected sounds total about 167 KiB of PCM WAV data. They cover three
musical functions without shipping the experimental synthesizer: a low cable
call, a vowel response, and a tightening mechanical fill. The demo,
`examples/morph-sync-demo.json`, is four bars at 120 BPM (352,800 sample frames,
eight seconds). Its 46 onsets use all five assets and include velocity, rate,
glide and gate/envelope variations. No General MIDI instrument, FluidSynth,
SoundFont or FFmpeg is required. The sparse second bar lets the vowel answer;
the fourth bar compresses individual ratchet slices into a final turn.

Regenerate and audition from a checkout without touching any historical output:

```sh
node scripts/generate-morph-pack.ts
node bin/daemonv12.js render examples/morph-sync-demo.json --out-dir work/morph-demo
node --test tests/morph-pack.test.ts
```

To compare independently, use `node scripts/generate-morph-pack.ts work/rebuilt`
and compare `work/rebuilt/assets/morph-v1/` plus its catalog with the committed
files. The tests do exactly this in a temporary directory, then render twice
with audio-tool environment configuration absent. See the sync-pack guide for
the event-map export and independently reproducible audiovisual demonstration.

The repository has not selected a code license. The prototype does not infer a
CC0 grant from unrelated existing packs or create a new grant for historical
MORPH code/derived material. Rights must be decided before external distribution.
