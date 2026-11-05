# HEADLINER foundation

A small offline production starter for DaemonV12 **v0.7**. It turns a separate
musical score into original deterministic instruments, native-pitch multisamples,
bounced expressive phrases, section patterns/clips and shared-asset variations.
It makes ordinary projects; the engine and Composer defaults are unchanged.

The **Open Window** example is a nine-second D-major chamber study: uneven wood
intervals, a withheld reed entrance, a sparse response and a higher closing
phrase. It uses new notes, harmony, timbres and form. No SODIUM HOURS or
WEST//GHOST sounds, melody, progression or arrangement are imported.

## Reproduce the short proof

From this branch's repository root, use Node 22.18+, FFmpeg with libmp3lame,
GNU tar and gzip. Set `DAEMONV12_FFMPEG` if FFmpeg is outside PATH. Rendering needs
no SoundFont, FluidSynth, npm dependencies or engine upgrades. Development
typechecks need `npm ci`.

```sh
mkdir -p work
node scripts/headliner.ts verify production/headliner/example.score.json work/headliner
node scripts/headliner.ts hashes work/headliner
node scripts/headliner.ts pack work/headliner work/headliner.tar.gz
```

`verify` refuses an existing output directory. It builds the sources, regenerates
them with the **shipped generator in a fresh process**, validates both projects
against v0.7 and its unchanged budgets, renders main twice and reduced once,
and checks every repeated artifact including MP3 on the current toolchain.
It checks non-silent masters/stems, sample alignment, track/master clipping,
exact frames and a silent final 100 ms. It then seals all package files with
SHA-256. The example produces 396,900 stereo frames per mix; main has three
stems, reduced has two. [VERIFICATION.json](VERIFICATION.json) records the proof.

```sh
node --test --test-isolation=none --test-reporter=spec tests/headliner-foundation.test.ts tests/v07-pipeline.test.ts tests/architecture.test.ts
npm run typecheck
node node_modules/typescript/bin/tsc -p tsconfig.build.json
```

The tests also reject changed, missing/unlisted or linked files, invalid section
references and onsets rounding outside a section; compare two deterministic
archives; extract one and verify its complete file set. These checks passed:
11 tests, zero failures/skips. Engine branch test commands and counts are in
[ENGINE_REVIEW.md](ENGINE_REVIEW.md).

## Author and deliver another score

Copy `example.score.json` and change the musical data. `build.ts` has the typed
`Score` and `PerformanceNote` contracts. This first helper intentionally supports
4/4, 960 PPQ, sequential sections, major/minor key labels, and at most 15 tracks
and 600 seconds including a one-second release budget. The engine's interpolation,
voice-memory and track-memory limits still apply. It can describe a full-song
form; only the short example is rendered here.

- `instruments` contain additive partial amplitudes, attack/decay, source length
  and seeded noise. Fixed gain preserves expression; sources are never normalized
  individually. There are no external recordings, presets or audio dependencies.
- Each native MIDI note used on a track becomes one on-demand WAV/kit entry.
  The kit's integer `pitch` is a routing index; its named `note-N` sound is already
  tuned to MIDI N. Playback stays at rate 1, with no interpolation work.
- `phrases` save note onset/duration in beats, MIDI pitch, velocity, optional
  starting pitch slide, vibrato in cents and a two-point linear expression ramp.
  They are synthesized into one WAV before playback. Pitch movement retains phase
  within a note; separate phrase notes restart phase. This is a small performance
  interface, not a general legato synthesizer. Phrase duration is at most 16 seconds.
- `sections` explicitly name the development and bar count. Track events use
  zero-based beats inside a section. The compiler rounds to engine ticks and uses
  the engine's integer-microsecond tempo. The example changes register, density,
  texture and contour across four sections.
- `variations` omit named tracks while sharing exactly the same generated assets.
  The first adapter implements main/reduced mixes; other event arrangements can
  be authored as separate scores. No genre-specific progression or form is built in.

Generate without rendering, then use the ordinary CLI:

```sh
node production/headliner/build.ts MY_SCORE.json work/my-project
node bin/daemonv12.js validate work/my-project/main.json
node bin/daemonv12.js render work/my-project/main.json --out-dir renders/my-main --stems --format wav,mp3
node bin/daemonv12.js render work/my-project/reduced.json --out-dir renders/my-reduced --stems --format wav,mp3
```

Output duration includes the release budget; it is not added by the renderer.
Keep releases inside that budget and finish phrase envelopes before the endpoint.
`verify` deliberately rejects a clipped or abruptly active final edge. Longer
native sustains require appropriate source lengths; playback does not loop or
time-stretch them. Mix gain/pan are exposed; edit the emitted ordinary project
to use engine automation/effects. After project edits, rebuild/reverify the
delivery and hashes as a new version.

## Portable package and provenance

The generated package contains canonical PCM16 WAVs and kits, main/variation
projects, normalized score, standalone `source/build.ts`, per-asset recipes and
hashes in `catalog.json`, engine base/Node identity, and reproduction instructions.
`verify` adds delivery WAV/MP3, aligned stems, MIDI conductor/analysis/render
manifests and a verification report. Sample-track MIDI does not carry the phrase
notes; the score is the editable performance source. Stems are post-track and
pre-master; apply the documented project master gain to reconstruct a mix.

`hashes` verifies the exact package file set, refusing missing, changed, unlisted
and linked/special entries. `SHA256SUMS` excludes itself. `pack` verifies before
archiving and fixes member order, owner, modes and timestamps; archives contain
no absolute paths. No online service or publication is involved.

```sh
mkdir work/unpacked
tar -xzf work/headliner.tar.gz -C work/unpacked
node scripts/headliner.ts hashes work/unpacked
node work/unpacked/source/build.ts work/unpacked/score.json work/regenerated
node bin/daemonv12.js render work/unpacked/main.json --out-dir renders/unpacked --stems --format wav,mp3
```

Extracted packages retain their saved assets as canonical inputs. Regeneration
and render byte equality were tested on Linux, Node v24.19.0, FFmpeg
7.1.5-0+deb13u1 and GNU tar 1.35. V8 math, FFmpeg and gzip/tar versions can change
bytes; repeat with the recorded toolchain to compare saved hashes. Archive
compression uses `gzip -n -9` and streams to disk. Engine base:
`e2962cc1a443c841cd6ca7cb2cc56c5ebabf0e99`. The package is a source-project archive,
not an npm release or a bundled engine installation.

Generated audio licensing remains pending owner declaration. Numerical synthesis
does not grant a new license. Measurements verify engineering behavior; no human
listening or sound-quality approval is claimed.

## Integration and follow-ups

[REFERENCE_REVIEW.md](REFERENCE_REVIEW.md) separates reusable techniques from
SODIUM HOURS content and records its preserved tree/master hashes. No reference
file or hash was changed, no FLAC was restored, and no prior full-length render
was repeated.

Keep this starter on v0.7. If later authorized, integrate **#39 before #41**;
both are optional. Keep #40 experimental and outside the default pack. Details
and targeted verification are in [ENGINE_REVIEW.md](ENGINE_REVIEW.md).

Stop here after the short proof. Follow-ups, each requiring a concrete production
need: owner listening; richer bounded performance curves/articulations; alternate
event arrangements sharing an asset bank; optional wet-only bounces; a separate
PCM24 adapter with MP3 derivation and its own stem/manifest contract. Do not expand
this foundation into another song, engine redesign or default sound pack.
