# PermitPulse · THE MAPS DISAGREE — original 28-second score

Music and sound design for the 28-second PermitPulse commercial *THE MAPS DISAGREE*
(tagline **NEVER GUESS.**), composed to picture and rendered with DaemonV12.
This directory is self-contained: it holds the original sound pack, the score
generator, three DaemonV12 projects (V1, V2, V3), their renders and the delivery
files. No existing MORPH, BANGER LAB, GLASSHOUSE, Orbital Foundry or other
experiment was touched.

**Delivered master: V3.** The brief asked for a V1 and a production V2. The
DaemonV12 Composer skill (v0.3) requires a third serious pass, and the V2
critique found real problems, so V3 is the production master. V1 and V2 stay
for comparison.

| | |
|---|---|
| Picture lock | 28.000 s · final 1080×1920 @ 60 fps (1680 frames) · reviewed on the 360×640 @ 30 fps proxy |
| Master | `delivery/PermitPulse_TheMapsDisagree_Score_V3_48k24.wav`: 48 kHz / 24-bit stereo, exactly 1,344,000 frames |
| Loudness | −15.6 LUFS integrated, −1.5 dBTP, LRA 5.1 LU, no clipping |
| Engine master | `versions/v3/permitpulse-v3.wav`: 44.1 kHz / 16-bit, exactly 1,234,800 frames, SHA-256 `e3461851…947741c1` |
| Listening copy | `delivery/PermitPulse_TheMapsDisagree_Score_V3_320k.mp3` |
| Stems | `delivery/stems-48k24/`: 12 aligned stems, each exactly 1,344,000 frames |
| Event map | `delivery/PermitPulse_TheMapsDisagree_V3_events-60fps.json` (`daemonv12 sync`) and `…_cue-sheet.csv` |
| Sync review | `delivery/review/PermitPulse_TMD_V3_SyncReview_PROXY-360x640-30fps.mp4`: the untouched proxy video stream (`-c:v copy`) muxed with the V3 score, **for review only, not a picture deliverable** |

See [CUE_SHEET.md](CUE_SHEET.md) for the timing map and
[QA_AND_CRITIQUE.md](QA_AND_CRITIQUE.md) for audio QA, the version log and an
honest self-critique.

**Challenger (music-first rewrite):** [challenger/](challenger/README.md) holds a separate 28-second
score (C3) built around a machine-voice hook, a 150 BPM groove and a metric modulation on the
evidence cut, with its own auditions, stems, cue map and comparison against V3. V3 here is unchanged
and stays the fallback.

## Musical thesis

- **Hook:** a heartbeat (*lub-dub*, deep analog D) under a three-note glass motif,
  **D–E–A** (short, short, LONG), from frame 0. The proposed rear unit landing at
  1.600 adds the fourth note, **F#**, so the landing completes the phrase.
- **Rhythmic identity:** the PermitPulse heartbeat at 75 BPM, a calm resting heart rate.
  The tempo is conducted to picture: 75 → 90 BPM accelerando under the camera move,
  90 into the cut, then a 100 BPM research pulse.
- **Two maps, two identities:** Map A is glass, on the beat, answering **F#** (major).
  Map B is darker struck metal, an eighth off A's grid with its heartbeat on a
  dotted-eighth grid (3 against 4), answering **F natural** (minor), over a
  Bb ground. The maps agree on D–E–A and disagree on one semitone: the
  disputed boundary. The amber trace (7.5–9.0) is literally a glide from F# down to F.
- **Evidence cut (13.667):** every conflicting layer stops on the cut. What remains
  is the motif made clean: a pure bell with no beating and no third, slower, ending on the
  octave (D–E–A … D) over open fifths and a controlled sub. Clarity is the
  transformation; there is no trailer impact.
- **Research brief:** a quiet clock, three tiny "citation" pings (the motif in
  retrograde), Map B's chord returning as a consonant Bbmaj9 when the finding card cuts
  in, the amber underline holding the question tone, and a minor-plagal approach (Gm6) into the brand.
- **NEVER GUESS (21.0–21.5):** the amber line rises from the card into the underline
  (D→A glide) while the motif speaks the tagline: **NE** (21.000) · **ver** (21.250)
  · **GUESS** (21.500), landing on a D 6/9 chord spread over three octaves, with
  heartbeat, bass and sub. The answer tone **F#** returns on *HAVE A PROPERTY? SEND IT.*
  (23.600) and the URL closes on the tonic (23.800), a final *lub-dub* sign-off.
- **Ending:** the chord decays inside the picture (fade from 26.6, below −48 dBFS in the last 50 ms),
  with one distant heartbeat at 25.6 that rhymes with frame 0 on replay.

## Palette (12 tracks, all original)

Every sound is synthesized by `sound-design/generate-pack.ts` from math and a
seeded PRNG: modal resonators, additive filtered saws and shaped noise.
No recordings, sample libraries, General MIDI or third-party audio are used.
FluidSynth and a SoundFont were not installed and were not needed.

| Stem | Role |
|---|---|
| 01 pulse | Heartbeat LUB/DUB on D (Map A) and Bb (Map B); CTA sign-off |
| 02 bass | Deep analog bass: enters when Map A seats, glides D→Bb with Map B, 8th-note ostinato under the camera move |
| 03 sub | Controlled D1 sub: hook, evidence cut, brand bloom |
| 04 glass-a | Map A motif (glass, slow beating partial, one uneasy inharmonic partial) |
| 05 metal-b | Map B motif (dark metal, faster beating, minor-tenth partial) |
| 06 sig | Clean evidence/brand bell: the motif without beating |
| 07 pad | Bowed-glass harmony, multi-sampled per pitch |
| 08 amber | The amber evidence line: boundary trace, underline, rising brand line |
| 09 ticks-a | Map A escapement ticks; soft research clock |
| 10 ticks-b | Map B ratchet (dotted grid, then triplets) |
| 11 glint | Crystalline accent on picture hits (small-speaker presence) |
| 12 foley | Unit lands, plates seat, Map B slides in, editorial paper cut, one reversed-glass inhale |

Stems include track gain, pan, automation and effects, and start at frame 0. They exclude the master
stage (+6 dB gain, gentle 2:1 compressor), so their plain sum is about 6 dB quieter than the master
and less compressed. Rebalance the stems, then apply your own bus processing.

## Rebuild, re-sync, remix

From the repository root (Node 22.18+, FFmpeg; no FluidSynth needed):

```sh
node productions/permitpulse-maps-disagree/sound-design/generate-pack.ts   # regenerate the sound pack
node productions/permitpulse-maps-disagree/score/compose.ts v3             # regenerate project + sync schedule
node bin/daemonv12.js validate productions/permitpulse-maps-disagree/project/permitpulse-v3.json
node bin/daemonv12.js render productions/permitpulse-maps-disagree/project/permitpulse-v3.json \
  --out-dir productions/permitpulse-maps-disagree/versions/v3 --stems --format wav,mp3
node bin/daemonv12.js sync productions/permitpulse-maps-disagree/score/sync-schedule-v3.json \
  --out productions/permitpulse-maps-disagree/delivery/PermitPulse_TheMapsDisagree_V3_events-60fps.json
```

- **Re-sync:** every hit point is a named entry in `CUES` at the top of
  `score/compose.ts`, in picture seconds. The tempo map recomputes itself, so the cut,
  the brand cut and the beats around them stay on picture. Moving a cue is a one-line edit.
- **Remix:** track gains, pans, effects and automation are in the `specs` table of
  `score/compose.ts`. The generated `project/permitpulse-v3.json` is an ordinary
  DaemonV12 project and can also be edited directly or through the MCP tools.
- **48 kHz / 24-bit delivery** is an FFmpeg SoX-resampler conversion of the
  engine master and stems (`aresample=48000:resampler=soxr:precision=28`, padded or trimmed
  to exactly 1,344,000 frames, `pcm_s24le`). DaemonV12 renders only 44.1 kHz / 16-bit,
  so the 24-bit files add no resolution; they spare the video pipeline a resample.

V1 and V2 WAVs and all native 44.1 kHz stems are reproducible with the commands above
and are not committed (see `.gitignore`); their manifests, analyses, section reports and MP3s are.

## Environment and provenance

- Engine: DaemonV12 0.7.0 at `23619d1` (main), source checkout; Composer skill 0.3.0.
- Node v22.22.0; FFmpeg 6.1.1-3ubuntu5 (render, analysis, conversion); no FluidSynth or SoundFont.
- Second render of the frozen V3 project into a fresh directory: master and all 12 stems byte-identical.
- Sound pack hashes: `sound-design/catalog.json`. Render provenance: `versions/*/permitpulse-*.render.json`.
- Rights: the sounds and composition were made for this production in this repository and
  derive from no reference track. The repository's code licence is still undecided, and no
  separate licence is asserted for these files here.
