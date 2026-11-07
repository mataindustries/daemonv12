# THE NINTH LANDING

ENM STUDIO · THE IMPOSSIBLE STAIRWELL · Composer Challenge 03 · ASTRA MAX

One finished, original ten-second candidate. A double glass call opens into a vowel; the voices climb by exchanging register and timbre. At the unoccupied landing, the harmony briefly becomes tender. A C♯ pickup reaches for the opening D across the return.

**Listen:** [Android MP3](listening/the-ninth-landing.mp3) · [three uninterrupted cycles](listening/the-ninth-landing-x3.mp3) · [PCM24 WAV master](delivery/masters/main.24.wav).

In GitHub, open a file and use **Download raw file**. The MP3s are tagged MPEG-1 Layer III, 256 kb/s, 44.1 kHz stereo. The three-cycle file is encoded once from three exact PCM copies, avoiding compressed-file joins. Use the WAV for picture editing; MP3 packet padding and player gapless support vary.

| Locked delivery | Verified value |
|---|---|
| Music | 96 BPM · four bars · 4/4 |
| Master | 44,100 Hz · stereo PCM24 · exactly 441,000 frames per channel |
| Duration | 10.000 seconds |
| Picture grid | 24 fps · 240 frames · 15 frames per quarter note |
| Sample peak / estimated true peak | −3.50023 dBFS / −3.48 dBTP |
| Integrated loudness | −12.15 LUFS |
| Clipping | zero in master, sources and all nine exported stems |
| Mono fold | −0.08862 dB RMS relative to stereo |
| First-second 300–3500 Hz mono proxy | −1.56 dB relative to unfiltered mono |
| Independent regeneration | all 34 canonical phrase sources, master and nine stems byte-identical |

The encoded listening files also measure −3.5 dBTP at FFmpeg's reported precision. All stem files begin at sample zero and contain exactly 441,000 frames. They include track gain/pan and the authored sound; the room is a separate wet-only stem. They exclude the master gain, **+8.232198675885224 dB**. Apply that gain to their sum for reconstruction, allowing independent PCM24 quantization error. No limiter, compressor, normalization after rendering, or dither was applied.

## The four turns

| Time | Musical action |
|---|---|
| 0–2.5 s | D: glass attacks at 0 and 0.15625 s; a near vowel answers against distant voices. |
| 2.5–5 s | F: the signature rises a minor third, while the upper gallery descends. |
| 5–7.5 s | A♭: the landing empties; at 6.25 s a close C voice and E♭ reveal A♭ major. |
| 7.5–10 s | B: the transformed signature returns higher; C♯ becomes the pickup to D. |

The harmonic framework is the diminished-seventh orbit `{D, F, A♭, B}`. Four transpositions of three semitones give twelve semitones, returning the pitch-class set to itself. Counter-moving voices and changing formant/partial emphasis exchange foreground and background. The A♭-major interruption makes the symmetry an emotional expectation that can be broken. This is a finite composed voice exchange, not a continuous octave-stacked Shepard sweep.

The loop carries real voice and room tails. The rack first renders a six-second source tail. The composition bounce folds that tail modulo 441,000 frames, then applies periodic placement and the interior hush. Only the remote end of the source tail is faded; the master has no endpoint fade or crossfade. The affected room tail is below −129 dBFS before master gain, and the other source tails are already zero there.

## Editable delivery

- [score.json](score.json): every original note, vowel, articulation, expression curve and timbre control.
- [loop-recipe.json](loop-recipe.json) and [build.ts](build.ts): the composition's periodic bounce and gain recipe.
- [delivery/source/main.json](delivery/source/main.json): validated native DaemonV12 project with all canonical source assets beside it.
- [delivery/stems/](delivery/stems/): nine aligned PCM24 stems.
- [qa/manifest.json](qa/manifest.json): exact timing, seam, stem reconstruction and translation checks.
- [qa/last-to-first.wav](qa/last-to-first.wav): lossless analytical audition cut, last 1.5 seconds followed by first 1.5 seconds.
- [qa/phone-band-mono-proxy.wav](qa/phone-band-mono-proxy.wav): diagnostic only; no claim to model a particular phone.
- [qa/sections.json](qa/sections.json), [qa/determinism.json](qa/determinism.json), [PRODUCTION_LOG.md](PRODUCTION_LOG.md): section evidence, independent reproduction and decisions.
- [PROVENANCE.md](PROVENANCE.md), [reference.json](reference.json), and [delivery/metadata/](delivery/metadata/): original-source record, visual review, tool identities and hashes.

The preserved score is the note-editable performance source. The native project plays section phrases; edit notes in the score and regenerate to change their contents. The copied `delivery/source/build.ts` is an archival copy of the repository script, whose imports expect its original repository location.

## Reproduce or retrieve

Work is on `codex/infinite-stairwell-astra-max`, based on fetched main **eee072d71a7581913faebff95c935cae8c9be41b**. DaemonV12 still identifies as 0.7.0; this uses its merged v0.8-compatible Signature Rack and Production24 capabilities. No engine code changes, SoundFont, FluidSynth or paid API are needed.

From a checkout of this branch, with Node 24.19.0 and the recorded FFmpeg 6.1.1 build:

```bash
# Verify every delivered file, then the sealed native delivery.
cd production/infinite-stairwell/astra-max
sha256sum -c SHA256SUMS
cd ../../..
node scripts/headliner.ts hashes production/infinite-stairwell/astra-max/delivery

# Regenerate original instruments and render into a NEW directory.
node production/infinite-stairwell/astra-max/build.ts /tmp/ninth-landing-rebuild

# Or render the preserved native project without regenerating instruments.
node scripts/render-production24.ts production/infinite-stairwell/astra-max/delivery/source/main.json /tmp/ninth-landing-render

# Create a portable download of this complete composition directory.
git archive --format=zip --output=ninth-landing.zip HEAD production/infinite-stairwell/astra-max
```

For a fresh retrieval:

```bash
git clone --single-branch --branch codex/infinite-stairwell-astra-max https://github.com/mataindustries/daemonv12.git
```

`verify_audio.py` reproduces the supplemental QC and listening derivatives with Python 3, NumPy and SciPy; it does not change the master. The detailed provenance records exact runtime versions. Cross-platform bit identity is not asserted.

## Evidence limits

The boundary is technically continuous: its adjacent-sample step is 0.445/0.377 times the local 99th-percentile waveform slope in L/R. The last and first samples need not be equal. Score inspection establishes a deliberate C♯→D return, and the three-repeat file preserves it without inserted silence. These are analytical checks of the actual rendered candidate, not proof that a listener experiences endless ascent.

Memorability, beauty, emotional contrast, spatial illusion and the desire to replay remain unverified human judgments. No human audition or physical phone/headphone test is claimed. The rendered half-second hush measures −75.77 dBFS RMS; the following close voice changes both register and spectral balance. Such measurements support the design intent without grading its emotional effect.

The supplied one-second silent MP4 and contact sheet were inspected. Full ten-second camera geometry follows the brief. The competing audio was never auditioned, transcribed, analyzed, sampled or imitated. One candidate; zero corrective musical revisions; no merge or film changes.
