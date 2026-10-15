# Blind listening copies

From a trusted preparation session, after sealing submissions and recording the
RULES §13 delivery gates:

```sh
node benchmarks/banger-lab-001/tools/make-listening-copies.mjs \
  --pool /private/hook-pool.json --engine /workspace/engine \
  --out /runs/C-judging/S1 --seed "$BLIND_SEED" \
  --ffmpeg /path/to/ffmpeg
```

`--engine` is the engine root, not its CLI file. `--ffmpeg` defaults to
`DAEMONV12_FFMPEG`, then PATH. Use the reference Node/FFmpeg from RULES §3 and
verify the organizer preflight fingerprint. No npm install is needed for this
utility; the existing engine must be runnable. The output parent must exist;
the output itself must not exist (including symlinks).

The private pool JSON has this strict schema (paths resolve relative to it):

```json
{
  "pool": "hook",
  "edgeTreatment": true,
  "listeners": 5,
  "entries": [
    {"source": "sealed/sketch.wav", "frames": 661500, "role": "sketch"},
    {"source": "sealed/lead.wav", "startFrame": 1323000, "frames": 661500, "role": "lead excerpt"}
  ]
}
```

Use `pool: "version"` with `edgeTreatment: false`, 3307500 frames and no
nonzero start. `confirmation` accepts either length, uniform within the pool,
without excerpting or fading. Only hooks receive the identical 10 ms fades;
full-length sketches receive them too. Inputs must be 44.1 kHz stereo PCM16.
Pool sizes are 2–100 entries; listener counts are 1–1000. Optional `role` and
`startFrame` default to an empty string and zero. Unknown fields are rejected.
The tool validates this definition and audio, not the submission's creative,
palette or provenance eligibility; record the existing delivery gates first.

Distribute **only `copies/`**: anonymous WAVs and `listening.json` with IDs and
listener orders. There are no measurements or source hashes in that folder.
Stdout contains only target, IDs, orders and key hash. Record that hash before
listening. With at least three listeners, openers cycle through a shuffled set
of IDs; hearing every item first requires at least as many listeners as items.
MP3 is optional under the rules and is deliberately omitted here.

Keep the pool definition and `private/blind-key.json` with the trusted preparer,
away from judges until scores lock. The key alone records the seed, identities,
roles, source hashes, measurements, gains and toolchain fingerprints. Its mode
is 0600 inside a 0700 directory. These permissions do not prevent the same OS
user from opening it: a judging organizer must not inspect the private inputs,
key, process arguments or preparation session. Use a fresh unpredictable seed
per pool; reuse it only to reproduce that same pool. Shell history and session
logs containing the seed belong to the private preparation context.

Gain is static, with the RULES §6 target formula. Verification retries the whole
pool at 0.5 LU lower, at most three times; targets below the −70 LUFS measurement
gate fail. Every WAV is encoded twice and hash-compared, re-analyzed for length,
±0.3 LU and ≤−1.0 dBTP, and checked for full-scale samples. Source hashes are
compared before and after. Failed runs remove staging output and publish no
bundle. Successful publication renames a private staging directory; use a
trusted output parent without concurrent writers. Preserve the masters and key.

Run the focused real-audio tests with the same toolchain:

```sh
BL001_ENGINE=/workspace/engine node --test benchmarks/banger-lab-001/tools/make-listening-copies.test.mjs
npm run check
```

Tests compare two complete bundles byte for byte, verify the exact FFmpeg edge
recipe independently, exercise 15 s and 75 s pools and rejection paths, and
prove the unchanged delivery checker rejects an unauthorized sample and a
clipped master starting from an otherwise passing fixture.
