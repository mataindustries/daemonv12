# STILL HERE — provenance

Every sound in both scores is original. All of them were synthesized for this piece by the
code in this directory:

- physical models copied from the MORPH experiments;
- four small new voices.

**What was not used:**

- third-party recordings, samples or presets;
- a SoundFont or General MIDI (FluidSynth is not installed here, and no GM track exists);
- any network asset.

## Source revisions

| What | Branch | Exact commit |
|---|---|---|
| Base of this work (DaemonV12 engine 0.7.0 and Composer skill) | `main` | `7dd67f1e3963b2fcbdbf1fc0aa8b1f926e8874b5` |
| MORPH//02 (voice, DSP kit) | `feat/morph-02-sound-breakthrough` | `fb3bd49643f049eeb3d85d7e6360f34296519d79` |
| MORPH//03 (Tempo String, throat, household kit, DSP kit) | `feat/morph-03-cable-breaks` | `71afdb4d7856f1ab6613b52736db5f2282188348` |
| MORPH//04 (membrane and cable percussion, performance lanes) | `feat/morph-04-cable-beast` | `34e694f0c87a1bb3390ae868411a150f0d104f2f` |
| MORPH//06 (CABLE//BEAST overload): no code copied; the A breath re-implements its "gasp" (exact silence after a 4 ms raised-cosine fade, applied after the master chain) | `feat/morph-06-overload` | `2b6e533a021218d6940a8da5a7032c2abe58a3d9` |

**The MORPH branches:**

- **Stacked:** 06 contains 05, 04, 03 and 02, all branched from `7dd67f1`.
- **Unchanged copies:** `git diff` shows that `experiments/morph-02/`, `morph-03/` and
  `morph-04/` are byte-identical between each experiment's own commit and `2b6e533`.
- **Untouched:** no MORPH branch, file or instrument was modified, and nothing was merged.

**Not found in the repository:** THE FOUNDRY and THE AWAKENING exist in no branch.

- **Searched:** branch names, commit messages and file contents.
- **Closest match:** IGNITION 002, a video promo, which is unrelated.
- **Consequence:** they were not inspected. Their failure ("too slow, too predictable,
  insufficient after the 4-second activation") is taken from the brief.

**Audio inspected before adopting a technique:**

- **Spectrograms:** the committed MORPH//02 A (voice), MORPH//03 Cable Bass and MORPH//06 B.
  These are a visual proxy; nothing was heard.
- **Voice test renders:** at D5–A5 and two tenseness values, to check the summit note before
  using it.

## Copied files (`lib/`)

| File | Copied from | Original SHA-256 (at its commit) | Change |
|---|---|---|---|
| `dsp.mjs` | `morph-03/dsp.mjs` @ `71afdb4` | `d219f8cd…5258` | none |
| `cable.mjs` | `morph-03/cable.mjs` @ `71afdb4` | `591ae70a…fa19` | none |
| `throat.mjs` | `morph-03/throat.mjs` @ `71afdb4` | `9755ccca…50c9` | none |
| `household.mjs` | `morph-03/household.mjs` @ `71afdb4` | `5c800ca2…84f7` | none |
| `kit.mjs` | `morph-04/kit.mjs` @ `34e694f` | `6301ba16…1cfa` | import paths only (`../morph-03/` → `./`); now `7a6c623a…418e` |
| `perform.mjs` | `morph-04/perform.mjs` @ `34e694f` | `727ca955…b123` | import paths only; now `0883e88c…b8a8` |
| `voice.mjs` | `morph-02/voice.mjs` @ `fb3bd49` | `38b6256a…b517` | none |

**Why `voice.mjs` can share MORPH//03's kit:** it originally imported MORPH//02's
`dsp.mjs`. Every primitive it uses is byte-identical in MORPH//03's copy, checked function by
function: `SR`, `TAU`, `clamp`, `smooth`, `rng`, `bipolar`, `drift` and `Biquad`. It
therefore runs on the shared `lib/dsp.mjs` unchanged.

## New code (this directory)

| File | What it is |
|---|---|
| `src/instruments.mjs` | Performance lanes plus new voices. The talkbox is a saw driving the MORPH//03 throat. `singer` is MORPH//02's glottal voice, phrased. New small voices: modal tines, a saw-ensemble stab, a warm bass, a struck steel plate. MORPH clank/membrane combinations make the presses. |
| `scores/a.mjs`, `scores/b.mjs` | The two scores. V1 and V2 come from the same file, with V2's edits gated by version. |
| `src/project.mjs` | Writes the DaemonV12 project, kits and PCM16 assets. Authored sidechain lanes. |
| `src/timing.mjs` | Engine-exact timing: imports the engine's own `ticksToFrames` / `formatPosition` from `dist/`. |
| `src/master.mjs` | The external stage: loudness gain, true-peak limiter, silence window, PCM16 dither, MP3. |
| `src/wav.mjs` | WAV read/write. |
| `build.mjs` | The whole pipeline, with cue sheets and metadata. |
| `analysis/stems.py` | Stem-balance, hook-presence, kick/sub, phone and mono proxies; spectrograms. |

## What runs natively in DaemonV12, and what is external

Each concept is a real DaemonV12 0.7.0 project (`*/v*/project/*.daemonv12.json`). The
unmodified engine validates it and renders it (`render --stems --format wav`).

**Native — sequencing and articulation:**

- A has 9 drum-kit tracks: press, kick, snare, ticks, metal, crash, stabs, arpeggio and
  glass.
- B has 7: machine, kick, snare, ticks, metal, music box and cable.
- Every hit, chord stab, arpeggio note and music-box note is a native trigger:
  - at a 960-PPQ position;
  - with a velocity;
  - with v0.7 gates, envelopes and source slices where used (press, arpeggio, the spool
    ratchet ticks).

**Native — the mix:**

- track gain and pan;
- authored sidechain gain lanes: A's bass sub, stabs and lead; B's bass sub and choir;
- track effects: reverb on snare, glass and music box; single-tap delays on A's lead and
  arpeggio;
- the master high-pass and glue compressor;
- PCM16 summing, stems, the render manifest and analysis.

**External, rendered by Node from this directory's code:**

- **One-shot assets:** synthesizing every one-shot (the engine has no synthesizer).
- **Continuous performances**, each played by the engine as one sampler note at `1:1` and
  labelled `EXTERNAL:` in the project:
  - A: the Tempo String bass (split at 110 Hz into bass and bass-sub), the spool-up cable,
    the talkbox lead and harmony, and the lead's FDN room;
  - B: the glottal voice, a three-voice choir, their FDN room, and the warm bass (split at
    110 Hz).
- **The reason:** these are physical models whose state carries across notes (cable tension,
  throat shape, glottal pitch glides). DaemonV12's sampler cannot reproduce them note by note.
- **The final stage (`src/master.mjs`):**
  - one gain to −14.0 LUFS on the engine's own `loudnorm` meter;
  - the MORPH lookahead true-peak limiter at −1.2 dB (A: 1.53 dB maximum reduction; B: none);
  - A's breath window, applied after the master chain;
  - seeded TPDF dither to PCM16, skipping exact-zero samples;
  - a 320 kbps MP3 listening copy via FFmpeg/LAME.
- **Why external:** DaemonV12 has no limiter or loudness normalisation.

## Tools

| Tool | Version |
|---|---|
| Node | v22.22.0, linux-x64 |
| FFmpeg | 6.1.1-3ubuntu5: engine effects, `loudnorm` / `ebur128` meters, MP3 |
| DaemonV12 engine | 0.7.0 at `7dd67f1` (`doctor`: sample-only, production effects, MP3 and loudness analysis ready; GM unavailable and unused) |
| Analysis only | Python 3.13 with numpy 2.5.3, scipy 1.18.1, matplotlib 3.11.2 |

## Asset licence

All audio in this directory was synthesized by the code here, from scratch, for this piece.
No third-party material is involved. The licence follows the repository's own (an open owner
decision, per the README).
