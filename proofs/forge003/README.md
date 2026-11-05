# FORGE 003: the first useful production milestone

The [180-second WAV](audio/headliner-stress.wav) and [MP3 listening copy](audio/headliner-stress.mp3) are a full-length technical proof using existing V12 SIGNATURE and MORPH sounds. This is an independent engineering arrangement, not DAEMON//HEADLINER 001. No Opus branch was read or changed. The source baseline is current `main` at `e2962cc1a443c841cd6ca7cb2cc56c5ebabf0e99`.

The proof contains 96 bars at 128 BPM, 15 tracks and 3,467 sample onsets. Its layered repitched chords, melodic cells, gliding bass, mechanical percussion, absolute gain/pan automation and delay/reverb tails run continuously for exactly 7,938,000 stereo sample frames. It uses the original v0.7 project format. Existing renderer and Composer defaults are unchanged.

The [verification report](headliner-stress.verification.json) records measured results, output hashes, all aligned stem hashes, transition evidence and host-specific render cost. [Source asset hashes](headliner-stress.assets.json) identify the unchanged repository sounds. The complete engine [render manifest](audio/headliner-stress.render.json) and [analysis](audio/headliner-stress.analysis.json) accompany the audio.

## What this proves

Without an opt-in flag, this score is rejected by the existing one-billion interpolation-tap budget. `--reuse-voices` shares exactly equal unrounded interpolation buffers inside one render. Each onset still receives its own velocity, gate/choke envelope, placement and downstream automation/effects. This example requires 67 unique interpolated voices rather than recomputing 1,344 additional copies: 343,122,898 interpolation taps and 64,142,336 cache bytes, below the unchanged one-billion-tap and 128 MiB limits.

No separately reset sections are concatenated. Each complete track and its effect state runs from sample zero; the complete master follows. Long dry voices cross every musical section boundary. The full replay and independent reconstruction from exported post-track stems check every resulting sample, including those boundaries. The reconstruction sums the sample-aligned stems and applies the continuous master chain once; it must reproduce the global master SHA-256 exactly.

The measured master is conservative: **−20.95 LUFS integrated, −7.38 dBTP**, with zero clipped samples at every track and the master. This is an engineering mix with headroom, not a loudness-matched commercial master. The report records stereo correlation, low-band correlation, mono fold-down loss, final-tail levels and section loudness. These measurements do not establish musical quality or audible groove. No human listening session is claimed.

## Reproduce from this branch

Use Node 22.18+ and the configured FFmpeg runtime (`node bin/daemonv12.js doctor --json`). Run from the repository root:

```sh
npm ci
node scripts/create-headliner-stress.ts
node bin/daemonv12.js validate work/headliner-stress/input/headliner-stress.json --reuse-voices --json
node scripts/verify-headliner-stress.ts --deliver
node --test tests/headliner-stress.test.ts tests/voice-reuse.test.ts
```

The verifier makes **two independent complete renders** with 15 aligned stems and MP3 listening copies; compares master, every stem, MIDI, manifest and analysis hashes; reconstructs the master from the stems; independently checks every onset's integer timing; writes 1.5-second transition excerpts; and measures all eight sections. MP3 bytes are excluded from the determinism contract. `--deliver` copies the master WAV, MP3, manifest and analysis into this directory. If a matching first render already exists at `work/headliner-stress/audio`, `--existing-first --deliver` validates its source/output hashes and renders only the independent replay. When both complete renders exist, `--existing-first --existing-replay --deliver` revalidates every saved artifact and completes QC without rerendering audio.

Both render calls explicitly inherit the configured tool environment. During the interrupted first verification, one replay used system FFmpeg 7.1.5 rather than configured FFmpeg 6.1.1: its WAV/MIDI/analysis matched, while tool identity and MP3 provenance differed. That complete cross-version replay is preserved separately in the workspace. The final reproducibility proof uses two actual renders made with the same configured FFmpeg 6.1.1; no metadata was edited to manufacture a match.

Working outputs are ignored by git:

| Path | Contents |
| --- | --- |
| `work/headliner-stress/input/` | Runnable project and byte copies of approved existing assets |
| `work/headliner-stress/audio/` | First continuous master, 15 stems, provenance and analysis |
| `work/headliner-stress/replay/` | Independent render for deterministic comparison |
| `work/headliner-stress/transition-excerpts/` | Exact unmodified crops around 15, 45, 60, 90, 105, 120 and 165 seconds |

The [committed score](headliner-stress.project.json) is a portable source snapshot. Generate the workspace before rendering: its `assets/` references are deliberately contained alongside the runnable project. The generator copies source assets unchanged; it does not download or synthesize them. It also rewrites the deterministic committed score and asset manifest, so regeneration should produce no diff.

## For the composer

Continue using existing v0.7 note fields and current Composer behavior. For a long score with repeated performed voices, validate and render explicitly:

```sh
node bin/daemonv12.js validate YOUR-PROJECT.json --reuse-voices --json
node bin/daemonv12.js render YOUR-PROJECT.json --reuse-voices --stems --format wav,mp3 --out-dir work/YOUR-RENDER
```

Choose a musical gate and output-time envelope; account for release overlap and source exhaustion. Repeated pitch/rate/glide/offset/end and rendered frame count can share interpolation. Velocities, envelope gain, track automation and effects remain independent. A slightly different absolute gate rounding can legitimately require another cache entry. Root-rate voices without a glide retain the existing fast copy path.

This does not provide time stretching, looping, arbitrary infinite sustain, more MIDI tracks or cross-track chokes. For long beds, retrigger authored notes with controlled overlap or generate a documented original sustained source. A gate cannot extend a source. Novel unique transformed material can still exceed the original budgets; shorten voices, simplify or render documented bounded intermediate assets. The flag never silently drops voices, lowers interpolation quality, evicts/recomputes the cache or raises a safety limit.

The 15-track and 600-second limits remain. The cache bound does not describe the whole renderer's memory: full-song float arrays, PCM track elements, FFmpeg buffers and stems still require substantial RAM and disk. The verifier reports its process's maximum resident memory separately, where available; child FFmpeg memory is excluded. Fifteen PCM16 stems total about 476 MB per render. Only the roughly 31.75 MB master and 4.32 MB MP3 plus metadata are retained here.

The stress score deliberately takes EVENT HORIZON down to D2 and the mutated PHANTOM phrase up to E6, outside those sounds' recommended pack ranges but within valid engine rates. These are disclosed stress cases, not listening-approved range extensions. A release composition should use the pack's documented useful ranges and listening review.

## Arrangement and boundaries

| Time | Section | Main technical exercise |
| --- | --- | --- |
| 0–15 s | Cold ignition | Slow pad attacks and uninterrupted sustained source playback |
| 15–45 s | Displaced drive | Exact delayed sixteenths, gates/chokes, high-passed cable and bass replies |
| 45–60 s | Pressure | Repeated rolls and bass removal before an arrival |
| 60–90 s | First arrival | Held pumping sub, original melodic question/answer, layered chords |
| 90–105 s | Ghost chamber | Subtraction, exposed vocal-like source, effects continuing through the change |
| 105–120 s | Reconstruction | Absolute-time gain/pan movement and repeated gliding mid-bass |
| 120–165 s | Second arrival and mutation | Changed melodic/register context, recurring harmony and mechanical fills |
| 165–180 s | Dissolution | Explicit releases, a continuous fade and time for effects to dissipate |

Boundary checks report actual crossing dry voices, adjacent-frame differences and exact-frame listening excerpts. Onset frames are checked independently against BigInt nearest-frame arithmetic. Quiet final samples are evidence against an abrupt technical cut; they do not establish perceptual continuity. Listen to each transition in context before a commercial master.

## Provenance and remaining work

All sounds are existing original synthesized repository assets. [V12 SIGNATURE provenance](../../packs/v12-signature-v1/PROVENANCE.md) and [MORPH audit](../../docs/MORPH_SOUND_AUDIT.md) remain authoritative. Their owner licensing declarations are **pending**. This owner-authorized internal proof creates no license grant or commercial clearance and changes no license. No SoundFont, recording, third-party sample, voice impersonation or external source is used.

This milestone exports the existing PCM16 production path. Meaningful 24-bit export requires preserving higher precision before track/master quantization; padding this WAV is not an upgrade. The separate precision milestone addresses that path. Full streaming, persistent render caching, source looping/time stretching, more than 15 project tracks and subjective listening approval remain outside this milestone.
