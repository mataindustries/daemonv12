# PermitPulse · THE MAPS DISAGREE: challenger score (C3)

The V3 score is preserved untouched one directory up and remains the approved fallback.
This directory holds a separate creative attempt written **music first**: two hook
auditions, a full 28-second challenger (C1 → C2 → C3), and its own instruments, projects
and deliveries. Nothing outside `productions/permitpulse-maps-disagree/challenger/` was
changed, apart from one link in the parent README.

| | |
|---|---|
| **Challenger master** | `delivery/PermitPulse_TMD_Challenger_C3_48k24.wav`: 48 kHz / 24-bit stereo, exactly 1,344,000 frames (28.000 s) |
| Loudness | −15.6 LUFS integrated, −2.0 dBTP (loudness-matched to V3's −15.6 LUFS for a fair A/B), no clipping |
| Listening copy | `delivery/PermitPulse_TMD_Challenger_C3_320k.mp3` |
| Sync review | `delivery/review/PermitPulse_TMD_Challenger_C3_SyncReview_PROXY-360x640-30fps.mp4`: the proxy's video stream copied untouched, muxed with C3 (review only) |
| Music stems | `delivery/stems-48k24/music/`: kick, snare, hats, perc, bass, sub, voice, choir, keys, arp |
| Sound-design stems | `delivery/stems-48k24/sound-design/`: picture events, transitions |
| Cue map | [CUE_SHEET.md](CUE_SHEET.md), `delivery/*_events-60fps.json` (`daemonv12 sync`) and `delivery/*_cue-sheet.csv` |
| Auditions | `delivery/auditions/`: A (machine-voice groove) and B (electric-cello pulse), 8 s each |
| QA, V3 comparison, critique | [QA_AND_CRITIQUE.md](QA_AND_CRITIQUE.md) |
| Editable project | `project/challenger-c3.json` (plain DaemonV12, 150 BPM container) and `scores/challenger.ts` (the score source) |

**Nobody has listened to this yet, including me.** I can't hear audio. The musical decisions
come from composition reasoning; the evidence comes from spectrograms, stem envelopes, phone-band
simulation and the engine's own measurements. The owner's ears decide.

## Finding the hook: two auditions over picture 0–8 s

| | A: machine-voice groove | B: electric-cello pulse |
|---|---|---|
| Idea | Half-time 150 BPM groove; a ladder-filter acid bass riff in 3-3-2 syncopation; a formant "machine voice" hook, *wa-da-WAAH … do-DOOO* | 16th-note plucked arp, tuned toms, a bowed-saw "electric cello" melody climbing to F5 |
| Onsets, first 1.6 s | **10 /s** | 3.75 /s |
| Phone band, first 0.8 s | **−21.0 dB** | −25.5 dB (the cello swells in) |
| Weak spots | Bar 2 drops 8 dB on phone (no mid-range answer); quiet hats and snare; long kick tail | Familiar arp + strings + saw-lead archetype; continuous wall with little contrast |

**Chosen: A.** It grabs immediately and its gesture is a voice, not an arpeggio. Its
6.8 s triplet flip also sets up a real metric modulation at the cut. Every A weakness was
fixed in the full score: gear "toks" answer the voice in bar 2, the backbeat is louder, the kick is tighter.

## The challenger in one paragraph

A 150 BPM half-time machine groove in F minor that has a voice. The hook is there on frame 0. The
proposed unit lands as the bar-2 downbeat, and Map A seats as the pickup into bar 3. At 6.8 the floor
tilts: hats, kick, clap and bass slide onto a triplet grid while the harmony slips to G♭.
The camera build climbs D♭ → B♭m → G♭ → C7 into double time, and then **the machine stops mid-word at
13.2**. For 0.47 s only the conflicting triplet pulse keeps ticking (C6, D♭6, E♭6), re-phased so it
lands on frame 820. On the cut, that triplet pulse **becomes the new sixteenth: a metric modulation to
112.5 BPM**. The same hook, now sung over D♭maj9, turns out to be a major-seventh melody.
At the brand cut the tempo snaps back. The hook's own *wa-da-WAAH* lands its long note
on **NEVER GUESS in F major**, harmonised a third above. The CTA plays the hook's rhythm again as the
PermitPulse signature (*SEND IT* = wa, URL = da, then WAAH). The last bar ends on a bar line exactly at
28.000, so a looping video re-enters the hook on its next downbeat.

## Instruments (all original, synthesized in `synth/`)

| Stem | What it is |
|---|---|
| voice | Formant "machine voice": band-limited buzz through five moving vowel formants, scoops, vibrato, rendered per pitch |
| choir | The same engine as a three-to-five-singer ensemble (wide variant for the reveal and payoff) |
| bass | Ladder-filtered saw/pulse acid bass with accent, plus an unfiltered sub; resonant harmonics reach phones |
| sub | Round sine sub under the reveal and payoff |
| kick / snare / hats | Pitch-swept machine kick tuned to F, mechanical clap with metal re-strikes, 6-oscillator hats and escapement ticks |
| perc | Two-operator FM "gear toks", tuned: the machine answers the voice and carries the gap pulse |
| keys | FM glass keys, panned per note in C3 so the reveal moves across the stereo field |
| arp | Plucked ladder arp: the build, the payoff lift, CTA stabs |
| sfx-picture | Unit latch (F2 thunk, C6/F6 ring), plate seats tuned to C6 and G♭, Map B servo rising a minor sixth, amber underline zips (pentatonic tick runs) |
| sfx-transitions | The machine stop (F latch), paper snaps on the cuts, a reversed D♭ bloom leaking into the cut, final seat |

No recordings, sample libraries, General MIDI, FluidSynth or third-party audio are used. `catalog.json` lists every
rendered sample with its parameters and SHA-256.

## Build, edit, re-sync

```sh
node productions/permitpulse-maps-disagree/challenger/build.ts      # render all samples, kits, projects, sync schedules
node bin/daemonv12.js validate productions/permitpulse-maps-disagree/challenger/project/challenger-c3.json
node bin/daemonv12.js render productions/permitpulse-maps-disagree/challenger/project/challenger-c3.json \
  --out-dir productions/permitpulse-maps-disagree/challenger/versions/c3 --stems --format wav,mp3
node bin/daemonv12.js sync productions/permitpulse-maps-disagree/challenger/project/challenger-c3.sync-schedule.json \
  --out productions/permitpulse-maps-disagree/challenger/delivery/PermitPulse_TMD_Challenger_C3_events-60fps.json
```

- The DaemonV12 project uses a **150 BPM container**: one bar is 1.6 s and a sixteenth is 0.1 s, the
  picture's own editing grid. Sections I and III sit on that grid literally (`"2:1"` is the unit landing).
  Section II's 112.5 BPM sixteenths (2/15 s) and the 13.667 cut are exact ticks in the same container
  (1 tick = 1/2400 s).
- Every note references a kit sample by name (`pitch` = sample name), so velocities, timing, gates and
  mix can be edited in the JSON or through the MCP tools. New pitches or vowels need `build.ts`, which
  renders the missing samples deterministically.
- `scores/challenger.ts` holds the score. `challenger('c1' | 'c2' | 'c3')` keeps every version
  reproducible; picture times are named constants at the top (`CUT`, `STOP`, `CUES_*`).
- Instrument variants are frozen once rendered; new sounds get new variants (`kick('tight')`,
  `keys({ pan })`, `choir({ wide })`). C1, C2 and both auditions still re-render byte-identically.

## Environment

DaemonV12 0.7.0 at `23619d1` (source checkout), Node v22.22.0, FFmpeg 6.1.1-3ubuntu5. FluidSynth was not used.
The engine renders 44.1 kHz / 16-bit; delivery files are SoX-resampled to 48 kHz / 24-bit
and padded or trimmed to exactly 1,344,000 frames. A second render of C3 into a fresh directory
produced a byte-identical master and all 12 stems (master SHA-256 `96e96ef83e738002320931f9d28fed38194b9a32b9f74f2b81702a4c01ebb382`).
