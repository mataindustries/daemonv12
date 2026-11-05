# MUTATION 001 · checkpoint

**Branch:** `claude/vigilant-turing-2r0d5f`, based on `main` (`e2962cc`). It is independent of the SODIUM HOURS branch: nothing there was
merged, modified or copied except the two toolkit files listed below.

## Done: A · LIVING BASS

| Item | Path |
|---|---|
| Instrument | `mutation-001/tools/living-bass.ts` (`livingBass(notes, { morph, motion, over })`, `bassMacro(m)`) |
| Score helpers (shared) | `mutation-001/tools/score.ts` (`Grid` with swing, `pn`, `ramp`, `motionLane`) |
| Delivery (shared) | `mutation-001/tools/deliver.ts` (`deliver()` −19 LUFS / −1 dBTP + MP3, `writeManifest()`, `segmentStats()`) |
| Audition script | `mutation-001/tools/a-living-bass.ts` |
| Vendored, unmodified | `mutation-001/tools/dsp.ts`, `mutation-001/tools/instruments.ts` (from `6b1ab7b:headliner-001/tools/`) |
| Auditions | `mutation-001/auditions/a-living-bass/a1…a3 .wav/.mp3` |
| Hashes / measurements | `mutation-001/auditions/SHA256SUMS`, `mutation-001/auditions/manifest.json` |

Command: `node mutation-001/tools/a-living-bass.ts` (about 13 s). Verified: two runs give byte-identical WAV and MP3; `sha256sum -c` passes;
the engine's `daemonv12 analyze` reports −19.16 / −19.16 / −18.99 LUFS and no clipping.

SHA-256 of the A WAV files (the MP3 hashes are in `SHA256SUMS`):

```
f90c6ea28a28370712332d1b25a57ff183232485b8f7f612cb6960c00ed9f9eb  a1-living-bass-transformation-dry.wav
bbd59b7e432685e34bdc8a1c628e99feb24b7805c210ed58601441a5fe9661c0  a2-living-bass-transformation-context.wav
1f2b236f9dc88b8a862cc7a35031acf304f2b1f9a3e474479c3e882601a5dab2  a3-living-bass-states-dry.wav
```

**Do not regenerate A** unless `living-bass.ts`, `score.ts`, `deliver.ts` or `a-living-bass.ts` change. Running a B or C script only
merges that mutation's own section into `manifest.json` and `SHA256SUMS`; A's entries stay as they are.

**Open issues (A):** nobody has listened yet. The machine end may be harsh. The warm end is fundamental-heavy. The 25.6 Hz section may read as
buzz. Nothing scanned for clicks.

## Next: B · IMPOSSIBLE VOICE (not started)

1. New file `mutation-001/tools/impossible-voice.ts`. Start from `instruments.ts` `voicePhrase` (formant bank, portamento, breath)
   and keep it continuous like `living-bass.ts`:
   - Vowels are a **continuous 2-D position** (a lane), not the discrete `VOWELS` table. Interpolate formant frequencies,
     bandwidths and gains along that path. Let a `size` lane scale the formants beyond the human range (an impossible vocal
     tract), and add one or two inharmonic "throat" resonances that do not track a human vowel.
   - Source morph lane: glottal pulse → phase-modulated / folded source (reuse the living-bass oscillator idea) → breath-only.
   - Breath as its own instrument: inhale/exhale noise through the same formants, placed by the score between phrases.
   - Harmony: 3–4 voices from one score with independent vibrato, drift and onset spread. Intervals come from a chord lane, not
     parallel copies, so the voices move into and out of unison.
   - No words and no language. Do not model any real singer.
2. New file `mutation-001/tools/b-impossible-voice.ts`, modelled on `a-living-bass.ts`. Original phrase, about 25 s. Outputs:
   `b1-impossible-voice-dry` (mono or stereo), `b2-…-context` (sparse pad and pulse, fixed), `b3-…-states`. Write them with
   `deliver(join(root,'b-impossible-voice'), …)` and `writeManifest(root, 'B-impossible-voice', {...}, files, 'b-impossible-voice')`.
3. Update `README.md` (the B section and the state table) and this file, then commit and push.

## Then: C · MECHANICAL ORCHESTRA (not started)

`mechanical-orchestra.ts`: playable, pitched resonant machines. Planned voices:

- Modal bars and plates excited by mallet or bow, or by friction noise.
- Springs: dispersive all-pass chains with a tuned feedback loop.
- A plucked steel "tine" and a ratchet or escapement clock voice.

Each takes pitch, velocity, damping and an articulation input. A score plays them as an ensemble that interlocks (call and response,
hocket, a shared pulse with seeded micro-timing and velocity variation), not as a collage. The script is `c-mechanical-orchestra.ts`
with outputs c1 dry ensemble, c2 context, c3 states or solos. It uses the same delivery and the same −19 LUFS target.

Stop after the auditions. Human listening decides what gets promoted.
