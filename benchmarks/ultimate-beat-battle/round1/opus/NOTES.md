# Next Door — Opus, Ultimate Beat Battle Round 1

## MODEL

Claude Opus 5.5

## CONFIGURATION

Max

## ROUND

Ultimate Beat Battle — Round 1 Open Class (raw DaemonV12 CLI/project interface; no composer skill, no MCP).

## ENGINE COMMIT

`ed75e9e2a0172266e56b292886ad7c1500677862` (DaemonV12 0.6.0). Checked with `git rev-parse HEAD` before composing and again before the final render. No engine code, dependency or shipped pack was modified. No other branch or submission was looked at.

## TRACK TITLE

**Next Door** — 2-step garage, 140 BPM, C# minor, 4/4, 16 bars (27.43 s authored, 29.60 s rendered including the natural tail).

## CREATIVE CONCEPT

A singer is in the room with you while a party plays through the wall.

For the first four bars the voice is close, clear and dry. The beat, the bass and the electric piano are the same parts you will hear later, but they arrive through a 4-pole low-pass "wall" and creep louder. On beat 3 of bar 4 the party stops dead. Only the voice and a reversed glass swell are left. On bar 5 the door opens: the same groove, now full-range and in the room.

Everything after that is about two versions of one voice:
- The singer's real register carries the hook.
- Her slowed-tape double, the same syllables an octave down, answers her in the breakdown, rises as a spin-up riser, doubles her under the final drop and has the last word.

The record also starts and stops like one. The very first syllable spins up from quarter speed, and the last one tape-stops.

## HOOK

Two one-bar phrases with the same rhythm, sung as chopped syllables:

```
slot (16ths)  0 . . 3 . . 6 . . . 10 . 12 . . .      rhythm 3-3-4-2-4 (odd 16ths swung)
Q  (call)     G#4   B4    C#5       E5   D#5~~~      ya - ya - wo - hey - ah   (rises, ends on the 9th: a question)
A  (answer)   C#5   B4    C#5       B4   G#4~~~      da - da - wo - ya  - ah   (circles, falls to G#: the answer)
```

Over the progression `C#m9 | Amaj9 | F#m9 | G#7sus4` every held note is a colour tone:
- the 9th over C#m9;
- the major 7th over Amaj9;
- the 9th and 11th over F#m9;
- the sus4 over G#7sus4.

The hook develops as the track goes:
- **Bar 6:** the voice rests and GLASSHOUSE glass sings the answer an octave up, in the hook's rhythm.
- **Bar 7:** the call keeps climbing (E5–F#5–G#5) to the song's highest note.
- **Bar 8:** a 32nd-note "da" stutter climbs chromatically into the breakdown.
- **Bar 15:** the held C#5 bends down to B#4 just as the harmony turns to G#7♭9, so the suspension resolves inside the vocal.

Sustained notes measure within 30 cents of their written pitch: 46/46 measurable hook chops, median −6.5 cents. Details are in `analysis/report.txt`.

## RHYTHMIC IDEA

The groove is a 62.5% 2-step shuffle: odd 16ths land 60 ticks (26.8 ms) late. This is verified on the rendered hat triggers.

- **Kick:** on beat 1 and the and-of-3, never on beat 3. Alternate bars add a swung ghost and a pickup.
- **Clap:** on 2 and 4.
- **Hats:** offbeat, with swung ghosts. Rims answer the vocal in its rests.

The hook's 3-3-4-2-4 grouping is the main rhythmic motif. It returns three times:
1. in the glass answer (bar 6);
2. in the glass counter-line (3-3-2 against the hook in drop B);
3. in the 808 itself, which locks onto the hook rhythm in drop B.

The build switches to straight time for tension:
- quarter-note kicks;
- a G#1 pedal in eighths;
- a snare roll going 8ths → 16ths → 32nds, each hit half a semitone higher.

## LOW-END DESIGN

- **One synthesized 808 source** (C#2 sine with a short pitch punch and soft clipping) is transposed per note with `playbackRate`. Slides are single-voice `glide`s, so it behaves like a real 808 portamento: B1→A1, G#1→F#1 and G#1→C#2 into downbeats, and C#2→C#1 for the closing tape stop.
- **Monophonic by automation.** DaemonV12 samples have no note-off or choke, so the bass runs on three round-robin sampler tracks. Gain automation chokes each voice 8 ms before the next note starts. Measured: two lanes are within 20 dB of each other for only 30 ms in total, all of it inside those 8 ms ramps.
- **Kick ducking.** The same automation lanes duck the 808 by 5 dB under every kick (75 ms recovery), so the kick's knock leads and the sub swells in behind it.
- **Section levels.** The 808 runs at −8 → −5 dB "next door" and at −8 → 0 dB across the build. In drop B it is −1.5 dB, so the busier hook-rhythm line sits under the voices. There are 184 automation points in total.
- **Kick shape.** The kick has a short 85 ms body and a 45 Hz high-pass, so the 808 owns the sub. Side energy below 150 Hz is −58 to −61 dB in the drops, so the low end is mono.
- **Saturation** (tanh) on the 808 gives 2nd/3rd harmonics, so the bassline is still audible on small speakers.

## STRUCTURE

| Bars | Time (s) | Section | What happens |
|---|---|---|---|
| 1–2 | 0.00–3.43 | Next door | Tape-start into the hook. The 2-step, 808 and EP are muffled behind the wall; glass answers each phrase. |
| 3–4 | 3.43–6.86 | Closer | The hook again while the party creeps louder (+3 dB). **4:3 (6.00 s): the party stops dead.** The voice continues; a reversed glass swell rises. |
| 5–8 | 6.86–13.71 | Drop A: the door opens | Crash, kick, 808, claps, swung hats and EP stabs, all full-range. Bar 6: glass sings the answer. Bar 7: the peak line to G#5. Bar 8: 32nd stutter and snare flick. |
| 9–10 | 13.71–17.14 | Switch | Kick and 808 drop out (one A1 note). Half-time clap, shaker, choir. The high voice calls with half-phrases and the octave-down voice answers; glass falls between them. |
| 11–12 | 17.14–20.57 | Build | Quarter kicks, G#1 eighth pedal, rising snare roll, six-beat vocal spin-up riser, EP eighth pulse on G#7♭9. **12:4 (20.14 s): near-silence and an inhale.** |
| 13–15 | 20.57–25.71 | Drop B: payoff | Prism impact and crash. The hook with a diatonic third below and the octave-down double. Glass counter-line. The 808 locks to the hook rhythm and walks C#–B–A–G#–F#. Bar 15: the vocal bend resolves the suspension. |
| 16 | 25.71–29.60 | Ending | One last hit on C#m9: the vocal tape-stops, the 808 dives an octave and the prism impact slows to half speed. At 26.79 s the low voice sings a soft "oo" on C#4 and the room rings out. |

Section RMS (dBFS): next door −17.9, closer −18.3, drop A −15.6, switch −18.0, build −16.6, drop B −15.2, ending −17.0. The door also opens the spectrum: third-octave 8 kHz goes from −20.8 dB (intro) to −15.8 dB (drop A), relative to the loudest band.

## DAEMONV12 FEATURES USED

- **Mixed GM and samples:** three GM tracks through FluidSynth (2 × `electric_piano_1`, `choir_aahs`) and twelve sample tracks (nine drum-kit, three sampler) on the production route.
- **Sample performance (V0.6):**
  - 168 performed triggers at 36 distinct `playbackRate`s;
  - 10 glides: tape start, tape stop, vocal bend, spin-up riser, 808 slides and a slowing prism impact;
  - the snare roll pitched by rate.
  - `offsetSeconds` was deliberately not used: an offset would cut off the syllables' consonant onsets, so chop length comes from separate short/medium/long syllable samples instead.
- **Drum-kit instruments as a vocal-chop kit:** syllables are selected by kit name and pitched per note.
- **Gain automation** (5 lanes) for chokes, ducking, section levels and the "creeping closer" wall. **Pan automation** (2 lanes) for the glass drift and the hat sweep in the build.
- **Production effects:**
  - track effects: high-pass ×10, low-pass ×9, reverb ×10, saturation ×5, delay ×2, compressor ×1;
  - master: high-pass + gentle 2:1 compressor;
  - 39 effect instances in total.
- **Fixed render length** (`render.duration` 29.6 s, natural tails), 15 stems, analysis, provenance manifest and MP3.
- **Deterministic rendering:** two independent final renders are byte-identical across all 20 artifacts.

## ITERATION HISTORY

Seven complete versions were rendered, each inspected through stems, spectrum, loudness/peaks and the actual event map. Every version's `project.json`, score generator, analysis summary and stem-activity map is in `versions/`.

The generated assets also changed between versions (v4: +10 dB vocal formant presence and a clap crack; v5: the 60 ms `da-x` slice; v6: the inhale +8 dB; v7: 4.2 Hz vibrato). Re-rendering an old snapshot today uses the current assets, so its audio will not match that version's archived analysis exactly.

| Version | Master LUFS / dBTP / LRA | Drop A: sub<60 Hz · 2–6 kHz | What changed and why |
|---|---|---|---|
| **v1** | −16.5 / −2.8 / 5.4 | 45% · 0.26% | First full draft. Concept "Glass Lung": an octave-down voice through a wall for the intro, then the hook. **Weakest:** (1) the 808 lanes measured louder than the master itself while clap/hats/glass/choir sat around −36 LUFS, so the groove was inaudible; (2) the intro was a 120–500 Hz blob (75% of its power) with the hook only in a dark, slowed form; (3) the build was quieter than the intro (−22.5 vs −21.0 dB), and the switch was ruled by a 2-bar 808 dive to A0 (27.5 Hz). |
| **v2** | −14.9 / −2.1 / 5.1 | 52% · 0.24% | New concept "Next Door": the hook clear from 0:00 with a tape start, the party muffled behind a wall, the door opening across bars 3–4. 808 made monophonic (3-lane choke) and ducked under kicks. The build got a G#1 pedal, quarter kicks and a louder roll; the dive became one A1 note plus space. **Weakest:** (1) the gradual 2-bar door fade gave away the drop (the intro was only 3 dB below it); (2) the hook repeated unchanged through bars 1–8; (3) the low end was still dominant. |
| **v3** | −15.1 / −1.5 / 4.9 | 48% · 0.69% | The door became one sudden event (the party stops dead on 4:3, everything opens at 5:1). Bar 7 re-cut into the peak line to G#5. Clap, hats and glass raised. **Weakest:** (1) drop A bass bus −11.8 vs vocal −18.2 LUFS; (2) a 2–4 kHz hole (−21/−27 dB relative to 63 Hz); (3) drop B had no new rhythmic idea, and the "silence" before it was filled by a reverse glass. |
| **v4** | −14.7 / −1.2 / 4.2 | 37% · 1.73% | **Found my automation error:** DaemonV12 gain automation is absolute (per V0.5), so the static `mix.gainDb` changes I made to the 808 in v2–v4 had been ignored. Folded the bus gain into every automation value; drop A bass now −16.5 LUFS. Brighter vocal source (+10 dB formant presence) and a clap crack. Drop B 808 locks to the hook rhythm with slides. Reverse glass removed from the gap; crash on both drops. |
| **v5** | −14.6 / −1.0 / 4.3 | 38% · 1.84% | Bar 6: the voice rests and the glass sings the answer (phrase-level call-and-response). The bar-8 stutter rebuilt from a dedicated 60 ms syllable, because 170 ms chops at 32nds had overlapped three deep. Vocal +1 dB, hats +1 dB. A click screen, validated on a planted −40 dBFS step, found nothing. |
| **v6** | −14.9 / −1.25 / 4.2 | 38% · 1.84% | The inhale was masked by the choir tail (−39 vs −32 dB in the gap). Fixes: breath source +8 dB and choir chord shortened, so the inhale now leads the gap (−31 vs −44 dB). "Next door" tracks 2 dB lower, so the door is also a level event. Master −0.5 dB for true-peak margin. |
| **v7 (final)** | −15.0 / −1.24 / 4.2 | 38% · 1.84% | The vocal source's vibrato re-synthesized at 4.2 Hz with 20-cent depth, because `playbackRate` scales vibrato like tape and the held notes had reached 7.9–10.6 Hz. Drop B 808 −1.5 dB (bass bus −16.2 vs vocal −16.7 LUFS). |

## FINAL PRODUCTION DECISIONS

- **Loudness:** −14.98 LUFS integrated, −1.24 dBTP true peak, −1.37 dBFS sample peak, 4.2 LU loudness range, no clipped samples on the master or any track.
- **Master chain:** a gentle 2:1 compressor (threshold −18 dB, 15/160 ms) and a 28 Hz high-pass; no limiter.
- **Bus balance (LUFS, stems summed, pre-master):**

  | Bus | Drop A | Drop B |
  |---|---|---|
  | Bass | −16.5 | −16.2 |
  | Drums | −18.0 | −17.9 |
  | Vocals | −18.2 | −16.7 |
  | Keys/choir | −22.0 | −20.0 |
  | Glass | −23.9 | −23.1 |

- **Tonal slope:** −1.5 to −1.6 dB/oct (100 Hz–10 kHz) in the drops. The intro is deliberately darker (8 kHz about 5 dB lower).
- **Stereo:** the low end is mono. EP left (−0.25), glass right (+0.35, drifting to −0.35 across drop B), harmony vocal right (+0.4), low voice slightly left, clap tail decorrelated. L/R balance stays within 0.3–1.1 dB; correlation is 0.93.
- **Space:**
  - Vocal: compressor (3:1), light saturation, dotted-8th delay (321 ms) and a 1.4 s room.
  - Wall effect: two cascaded low-passes, 4-pole (450 Hz on drums, 600 Hz on keys), plus a bigger room.
  - Rhythm section: the kick and hats stay dry.
- **Tail:** the authored music ends at 27.43 s. The render runs to 29.60 s so the last "oo" and the reverbs decay naturally; the last 0.25 s is at −67.7 dB.

## WHAT WORKED

These conclusions come from analysis, not listening: I can't hear the audio.

- **The door is measurable.** The 4:3 cut drops 7.7 dB below drop level. At 5:1 the top end opens (8 kHz band +5 dB) along with a +2.5 dB level jump (bars 1–4 −18.1 → drop A −15.6 dBFS RMS).
- **The low end works as designed:**
  - one 808 voice at a time (30 ms of overlap in total, all inside the choke ramps);
  - mono below 150 Hz;
  - the bass bus sits level with drums and vocals instead of 6 LU over them.
- **The vocal is in tune:** 46/46 measurable hook chops are within 30 cents, and the tape gestures follow their glides.
- **The two designed silences are real.** The 12:4 gap sits 11.7 dB below the build, and the inhale is the loudest thing in it (−31.3 dB, against a −44.4 dB choir tail).
- **The whole chain reproduces exactly:** generated assets, catalog, score and every render artifact regenerate byte-identically.

## KNOWN WEAKNESSES

- **I can't hear it.** Whether the synthetic voice sounds sung rather than robotic, and whether the hook is actually catchy, has not been confirmed by a human listener.
  - The voice is formant synthesis (parallel formants, a slow drift, breath noise). It has no cycle-to-cycle jitter.
  - The G#5 peak plays at rate 2.0, which shifts the formants up an octave: a deliberate "chipmunk-chop" timbre, but possibly thin.
- **GM electric piano and choir.** They are processed (high/low-pass, saturation, reverb) but are still FluidR3 GM samples.
- **Modest level dynamics.** The level arc is about 3 dB section to section (LRA 4.2 LU). Most of the contrast comes from spectrum and density rather than level.
- **Reverb tails can't be gated.** Automation is pre-effects, so the "silences" contain decaying tails by design, not digital silence.
- **The switch is slightly left-heavy** (+1.1 dB L/R), because the EP and the low voice carry it.
- **The track uses all 15 tracks** (the engine maximum), so there was no room for a vocal double or a separate FX bus.

## ENGINE ISSUES ENCOUNTERED

No genuine DaemonV12 defect was reproduced. Every surprise traced to documented behaviour or to my own authoring:

1. **Gain automation is absolute.** Once a lane's first point is reached it replaces `mix.gainDb` (V0.5 spec). I had written my choke/duck lanes relative to 0 dB, so mix-gain changes on the 808 did nothing in v2–v4 (and caused a +2 dB jump on the "next door" tracks). This was my error. Workaround: the bus gain is folded into every point.
2. **Automation is pre-effects.** Gain automation can't cut reverb/delay tails (documented signal flow). Silences are shaped by note lengths instead.
3. **No filter automation.** The "wall" is two separate low-passed tracks (drums-far, keys-far) handed over to the full-range tracks at the door.
4. **Samples have no note-off, choke or end offset**, and `offsetSeconds` only moves the start. Workarounds: a monophonic 808 from three round-robin tracks with automation chokes, and chop lengths from separate short/medium/long syllable samples.
5. **`playbackRate` is a tape-speed model** (documented). Pitch, length, formants and vibrato rate all scale together. Workaround: the vibrato was re-synthesized for the rates the hook uses.
6. **`saturation` has no output compensation** (documented). It raised the 808 by about 3–4 dB, which had to be accounted for in gain staging.
7. **Integrated LUFS gating makes sparse stems read loud.** That's an analysis caveat, not a defect; bus loudness was judged per section from summed stems instead (`tools/balance.py`).
8. **Not DaemonV12:** FFmpeg's `showspectrumpic` draws a fixed bright row in log-frequency mode, even on pink noise. It was replaced by a numpy STFT spectrogram (`tools/analyze-render.py`).

## SOUND DESIGN: BENCHMARK-ONLY ASSETS

All assets are generated by `tools/generate-assets.ts` (Node built-ins only), using:
- float64 synthesis from closed-form oscillators, RBJ biquads, time-varying resonators and explicit xorshift32 seeds;
- 4× oversampling with Kaiser-sinc decimation where needed;
- endpoint tapers, peak scaling and a single rounding to PCM16 at 44.1 kHz.

There are no recordings, downloaded samples, SoundFonts or impulse responses. `assets.catalog.json` lists every file's recipe, seed, frames, peak and SHA-256. Regenerating gives byte-identical files.

- **`assets/opus-vox/`** (drum-kit): 13 sung syllables plus an inhale, all on G#4 (415.30 Hz), in short, medium and long lengths: `ya`, `wo`, `hey`, `da`, `ah`, `oo`, and the 60 ms `da-x` stutter slice.
  - The voice is additive harmonics under a parallel five-formant envelope with a glottal low formant, morphing vowels, an onset scoop, delayed 4.2 Hz vibrato, a slow drift, and breath noise through moving formant resonators.
  - Consonants are made as formant glides (y, w), aspiration (h) and a burst (d).
- **`assets/opus-drums/`** (drum-kit): 2-step kick (62 Hz body, 185 Hz knock, click), four-burst clap with a 3 kHz crack, snare, rim, closed and open hats (six 808-ratio square oscillators plus noise), shaker.
- **`assets/opus-bass/sub-808-cs2.wav`:** the 808 described above (2.4 s).
- **`assets/glasshouse/`:** `01-glass-hit`, `02-glass-reverse` and `10-prism-impact` are byte-for-byte copies of the shipped CC0 GLASSHOUSE pack (hash-checked against `examples/glasshouse.catalog.json`), with a project-local `glass-kit.json`. The shipped pack is untouched.

## METRICS

See `metrics.json`. Key values:

| Metric | Value |
|---|---|
| Model / configuration | Claude Opus 5.5 / Max |
| Engine commit | `ed75e9e2a0172266e56b292886ad7c1500677862` |
| Title / BPM / key | Next Door / 140 / C# minor |
| Duration | 27.43 s authored, 29.60 s rendered |
| Serious iterations | 7 |
| Tracks / stems | 15 / 15 (3 GM, 9 drum-kit, 3 sampler) |
| Events | 393 authored note events → 536 expanded (193 GM MIDI notes + 343 sample triggers) |
| Sample assets | 28 manifest entries: 25 WAVs + 3 kit JSONs (22 generated WAVs + 3 GLASSHOUSE copies) |
| Performed triggers | 168 (36 distinct rates, 10 glides, 0 offsets) |
| Automation | 7 lanes, 184 points |
| Effects | 39 instances: high-pass, low-pass, reverb, saturation, delay, compressor (track and master) |
| Sample peak / true peak | −1.37 dBFS / −1.24 dBTP |
| Integrated loudness / LRA | −14.98 LUFS / 4.2 LU |
| Clipped samples | 0 (master and all tracks) |
| `project.json` | 73,809 bytes |
| Final WAV SHA-256 | `06bc47143e60a5db5b25d035ba31e4d4cdd03fbea5627e1f0ab123a0343d9171` |
| Render time | about 47 s per full render (stems + MP3) |
| Determinism | Two independent renders: 20/20 artifacts byte-identical (master, MIDI, manifest, analysis, MP3, 15 stems) |

## REPRODUCE

```sh
cd "$(git rev-parse --show-toplevel)"
source "$HOME/.daemonv12-round1-env.sh"
cd benchmarks/ultimate-beat-battle/round1/opus
node tools/generate-assets.ts            # byte-identical assets + assets.catalog.json
node tools/compose.ts                    # byte-identical project.json
npx --no-install daemonv12 render project.json --out-dir output/final --stems --format wav,mp3
python3 tools/analyze-render.py output/final --png analysis --json analysis/summary.json
python3 tools/balance.py output/final; python3 tools/clicks.py output/final
```

## FILES

| Path | Contents |
|---|---|
| `project.json` | The final DaemonV12 project (generated by `tools/compose.ts`). |
| `NOTES.md`, `metrics.json` | This document and the metrics. |
| `next-door.mp3` | Listening copy of the final master (192 kbps, from the engine). |
| `assets/`, `assets.catalog.json` | Benchmark-only sounds plus the GLASSHOUSE copies, with recipes and hashes. |
| `tools/` | Asset generator, score generator, analysis scripts (numpy plus the pinned FFmpeg). |
| `analysis/` | Final report, summary, balance, click screen, spectrogram, waveform, stem map, render manifest, engine analysis, determinism record, `SHA256SUMS`. |
| `versions/` | v1–v7 project snapshots, score generators, analysis summaries and images. |
| `output/` (git-ignored) | `final/` (WAV master, MP3, MIDI, 15 stems, analysis, manifest), `final-check/` (determinism re-render), `v1`–`v7` renders, and the submission ZIP. |
