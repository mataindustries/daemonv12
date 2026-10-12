# SWING ARM — production log

Round 2 benchmark submission, written with the frozen DaemonV12 Composer Skill in
Benchmark Mode. Evidence is analytical; **no listening was possible**. Every "judgment"
below is a proxy built from score reasoning, stems, spectra and timing, and is labelled
as such. No self-scoring.

## Setup

- **Brief:** one 25–30 s record fusing futuristic bass music, UK-garage rhythm, electro,
  industrial percussion and cinematic tension into one identity.
- **Engine:** `ed75e9e2a0172266e56b292886ad7c1500677862` (DaemonV12 0.6.0), unmodified.
- **Skill:** `56dbdff62bf78e70e898f0dbb49f8044cd561655`; its parent is the engine commit;
  `git diff --exit-code 56dbdff..HEAD -- plugins/daemonv12-composer` clean. Installed by
  copying `plugins/daemonv12-composer/skills/daemonv12-composer` to `.agents/skills/`
  (not committed). Only `SKILL.md` and the files it links were read.
- **Isolation:** no Round 1 or Round 2 contestant material, branches or results were
  inspected (`benchmarks/` did not exist at the base commit). The shipped GLASS//FIRE and
  GHOST//SHIFT example projects were not opened.
- **Environment:** Node v22.22.0; pinned rootless bootstrap (`scripts/bootstrap-audio-tools.sh`):
  FFmpeg 6.1.1, FluidSynth 2.3.7 behind the organizer's headless wrapper (copy in
  `tools/fluidsynth-headless-wrapper.sh.txt`, sha256 `9c8a7a7d…86e5`), FluidR3_GM.sf2
  sha256 `74594e8f…1cb0`. `doctor`: all readiness flags true; `npm run demo` wrote a
  non-empty WAV. **This record is sample-only**, so FluidSynth and the SoundFont are not
  in its render path (manifest `gmRenderer: null`); FFmpeg runs effects and analysis.

## Musical thesis (written before any JSON — `THESIS.md`)

- **Hook:** a "talking steel" voice — struck metal that sings a three-note call
  (G–B♭–A♭↘G, grouped 3+3+2) at 0.00 s, answered by a sub that dives an octave like an
  electro zap.
- **Rhythmic identity:** 134 BPM 2-step skip (kick 1 and 3+, snare 2 and 4, swung
  sixteenth machine ticks) under an electro 3+3+2 call; in the build the call becomes a
  3-against-4 gear cycle.
- **Low-end role:** the sub is the *answer*, never the downbeat — until the payoff, where
  the bass takes the call itself.
- **Contrast:** bar 9 "stall": the gear cycle seizes, the voice tape-stops two octaves into
  a steel groan, then silence.
- **Payoff:** role swap — vowel bass + sub sing the hook; the steel voice answers with the
  dive the sub used to own; the answer chord moves from ♭VI to ♭II.
- **Ending:** call and answer finally together, ending on the answer gesture sung by
  every voice; restart on the opening call.

## Concept

One sound family stands in for all five genres instead of five sound sets glued together:
a formant-filtered struck-steel voice is simultaneously the garage vocal chop, the electro
robot/talkbox, the industrial clank and, two octaves down with more drive, the futuristic
vowel bass. The cinematic tension is the same steel, bowed (halo), and the A♭ against G in
the melody. The drama is a conversation: **call (top) / answer (bottom)**, which
interrupts itself, stalls, swaps roles, and finally speaks in unison.

## Structure (134 BPM, 4/4, bar = 1.791 s, 16 bars = 28.657 s)

| Bars | Time (s) | Function | What happens |
|---|---|---|---|
| 1–2 | 0.00–3.58 | Hook / identity | Steel call at 0.00; sub octave-zap answer at 0.90; tuned steel reply at 1.26; swung ticks from 0.00; G6/A♭6 halo breathes in. Bar 2 call rises (C→D), answered on E♭. |
| 3–4 | 3.58–7.16 | Groove | 2-step kick/snare+clap, offbeat steel open hats; same conversation over the groove. |
| 5–6 | 7.16–10.75 | Development | The answer **interrupts**: the sub dives on step 7, the voice finishes late on step 9; pixel-hat ghosts. |
| 7–8 | 10.75–14.33 | Build ("torque") | The call becomes a 3-step gear cycle against 4/4 with a steel hit per gear; kick 1/7/11; sub joins the gears and climbs G–B♭–A♭–C–D; halo crescendo −16→−7 dB. |
| 9 | 14.33–16.12 | Disruption ("stall") | Voice seizes D5→D3 (glide over two beats), sub dives to G0, low boom, half-speed steel; ~0.9 s at −41.5 dB RMS before the downbeat. |
| 10–13 | 16.12–23.28 | Payoff ("role swap") | Vowel bass + sub sing the call; voice (left) and twin an octave up (right) answer with dives; second pair dives two octaves; answer chords G then A♭ (♭II); image opens. |
| 14–15 | 23.28–26.87 | Convergence | Call in three octaves + bass in unison, voice/twin split L/R; bar 14 unison dive; bar 15 pulls the drums out after beat 2. |
| 16 | 26.87–28.66 | Exit | Every voice sings the answer dive once, with kick/clap/snare/tuned steel; steel ring decays to −81 dBFS; boundary in tempo for a loop. |

## Sound design and features used

- 32 generated assets (`tools/generate_assets.py`, provenance in `assets/README.md`,
  `custom-catalog.json`) + 7 shipped CC0 pack hits copied byte-for-byte.
- **Sample performance (V0.6):** 196 performed voices; 17 distinct playback rates incl.
  glide targets; 45 glides (11 up, 34 down: answer dives, call bends, stall, gear climb);
  pack hits retuned by rate (kick → D2, steel → D6, clap ring → D6, boom → G1).
  **No source offsets** — every chop is a whole length-variant source, so no
  offset-induced discontinuity can exist.
- **Monophonic phrasing without a choke:** the score builder (`tools/build_project.py`)
  computes each voice's real duration from the V0.6 glide integral and picks the longest
  length variant that stops before the next note; it reports overlaps (0 in the lock).
- **Automation (4 lanes, 11 points):** halo gain (breath, crescendo, cut at the stall,
  resolved level in the payoff); voice, hats and open-hat pan opening only at the payoff.
- **Effects (19):** high/low-pass for register separation, a 3/16 delay on the voice (its
  echo lands on the next call position), five reverbs (voice, stall room, twin, steel,
  halo), saturation on the vowel bass, a gentle master compressor (−16 dB, 2:1).
- Stems, deterministic rendering, production analysis and provenance manifest.

## Iterations

Full critiques: `versions/v1..v4/CRITIQUE.md`. Snapshots of each project and builder
are in `versions/`. Section metrics per version: `analysis/v*-report.json`.

### V1 — complete arc, then three weaknesses
1. Garage swing inaudible; bars 1–2 have dead air (hats stem −53/−42 dB vs kick −28 dB).
2. Payoff smaller/darker than the build (payoff RMS −17.9 vs build −16.9 dB; upper-mid on
   its first beat −14 dB; L/R correlation 1.00 everywhere).
3. Build bass a sustained wall that pre-spends the payoff (sub stem −17.4 dB, loudest).

### V2 — fixes; three remaining weaknesses
Changes: performed, louder shuffle + open-hat track + tuned steel reply; forward vowel
bass, full-band payoff downbeat, payoff-only panning; rhythmic build bass.
Result: payoff entry upper-mid −14→−5 dB; payoff now the loudest, most transient section
(flux 10.9 vs 2.8 in the build); build sub −17.4→−20.2 dB. Remaining:
1. Bars 5–6 note-for-note identical to bars 3–4 (third identical statement).
2. Payoff bigger only in the low end and still mono (corr 0.98).
3. Ending is a 1-s static held chord after a weak cadence.

### V3 — fixes
Interruption in bars 5–6; upper-octave twin on the opposite side; pull-up + unison
answer-dive ending. Exit crest 15.2→19.2 dB (a gesture, not a sustain); boundary
−93 dBFS. Remaining (V3 critique): twin too quiet (−40 dB), convergence narrower and
smaller than the payoff (corr 1.00), cinematic halo absent in bars 3–6 (−71 dB).

### V4 — additional serious version
Twin +6 dB; twin sings the convergence call an octave up and joins both dives; halo
re-voiced to G6/A♭6 and breathing every two bars. Convergence side/mid −27→−18 dB;
>1 kHz correlation in the payoff 0.84→0.79; halo in bars 3–6 −71→−42 dB.

### V5a / V5b — tested and reverted
Hypothesis from the low-end check: on payoff downbeats the bass sits 6 dB over the kick
in 35–130 Hz, masking it. Tried a manual sidechain (gain-automation duck, −9 dB,
1/32 recovery) on sub+bass (V5a) and on sub only (V5b). The kick did lead the first
30 ms (−4.6 → +1.0 dB relative), but the composite downbeat peak fell (trim-compensated
mean −12.2 dBFS in V4 vs −13.4 / −15.2) and V5a softened the hook's first consonant. The
in-phase kick + 808 + bass onset is the larger downbeat, so the duck was reverted. The
only carried-over change is a −1 dB master trim (true peak −1.41 → −2.24 dBTP), a
delivery decision not counted as an iteration.

## Final checks (on the locked render)

**First 5 seconds** — evidence: the hook is the first event (voice onset 0.000 s, pitches
measured G4 391.6 → B♭4 465.7 → A♭4 bending to 395.7 Hz); voice carries 46% of the
first-5-s energy; ticks from 0.00 s; sub answer 0.90 s, steel reply 1.26 s, delay echo
1.01 s fill what was dead air in V1; drums at 3.58 s. Proxy judgment: identity immediate
and readable, curiosity from the unresolved G/A♭ halo and the octave zap; not generic.
Uncertainty: whether the synthetic vowel timbre is *attractive* is unmeasurable here.

**Payoff (bars 10–13)** — evidence: preceded by ~0.9 s at −41.5 dB RMS; RMS −18.0 vs
groove −20.4 dB; low band +4 dB; transient flux 10.25 vs 4.67; >1 kHz correlation 0.80
vs 0.92; hook survives in the bass with exact pitches (G2 98.25, B♭2 116.4 Hz; sub G1
49.1 Hz); answers land on G4 391.6 / G5 784.6 Hz. Call (bass, steps 1–8) and answer (top,
steps 9–16) are separated in time and register, so it is dense but not crowded. Proxy
judgment: earned, transforms established material, larger and stranger (♭II answer).
Uncertainty: the level lift is modest by design; perceived size relies on density, low
end, width and the silence before it.

**Final 3 seconds (25.66–28.66 s)** — evidence: unison rise call → 0.55 s pull-up (ticks
only) → unison answer dive at 26.87 s (bass ends 27.25, voice 27.51 s) → tuned steel ring
−38 → −81 dBFS; last moment above −40 dBFS at 27.35 s; last sample 0; first sample of
the file ≈0, first 10 ms already at 0.38 peak (the call). Proxy judgment: a concise final
gesture taken from the record's own vocabulary; restart lands exactly one bar after the
final hit, so a loop stays in tempo. Uncertainty: 1.3 s of ring may read as a pause
rather than a loop to some listeners.

**Perceived size** — strongest section (payoff/convergence) has: low-end authority (+4 dB
low band), 2.2× transient flux, G1–G6 register span, upper-mid at/above the groove,
widest image (>1 kHz corr 0.80), and silence before impact. The loudest peaks are the
convergence downbeats and final dive. No master gain was used to create size.

**Low end** — groove downbeats belong to the kick alone (bass −95 to −120 dB in the
downbeat window); sub answers sit in the gaps; build bass is short and rhythmic; the sub
never overlaps itself (builder check 0 overlaps; sub/growl are octave doubles by design);
low-band occupancy (time above −24 dBFS): groove 32%, build 48%, payoff 62%,
convergence 52% — rising toward the payoff, not a wall. Payoff downbeats fuse kick + 808
+ bass in phase (kept after V5 test).

**Sample transformation** — rates checked against measured pitches (above); glides are
linear in rate per spec and visible as continuous arcs (stall, dives); no offsets; every
source starts and ends on a zero frame; transformed voices overlap only where intended
(voice + twin octave pair; bass + sub doubles).

**Automation** — semantics verified against `docs/V0_5_TIMELINE_DYNAMICS.md` and the
resolved manifest: values are absolute (halo's 1:1 point replaces its static −16 dB
from frame 0); `linear` interpolates dB over bars 7–8; step pans change only on silent
frames or at a new onset (measured |x| before each boundary ≤ 0.02 and no discontinuity).
Pan is balance, so width comes from different content per side (twin vs voice, hats vs
open hats), not from panning one source.

**Clicks / discontinuities** — per-stem |Δx| scan against a 5 ms local median: only the
machine tick's designed contact transient (every beat, identical) and the vowel bass's
steepest saturated waveform edge (= its source's 99.9th percentile) are flagged. No
offsets, mutes or rate jumps exist; glides are continuous by construction.

**Loudness / headroom** — −17.8 LUFS integrated, LRA 3.8 LU, sample peak −2.38 dBFS,
true peak −2.24 dBTP, 0 full-scale samples, 0 clipped samples at every track and master
stage.

## Production decisions

- Sample-only, so every role is shaped by the same steel family and V0.6 performance;
  GM was not needed for any role.
- Swing via exact tick placement (+60 ticks on even sixteenths); no engine swing exists.
- Width created by content (octave twin opposite the voice), because balance-pan cannot.
- Ending length = exactly 16 bars so a looped play stays on the grid.
- Rejected after measurement: the sidechain duck (V5a/b).

## Known weaknesses and human-listening uncertainties

- The talking-steel voice is additive/formant synthesis; it may read as buzzy or
  synthetic in a way analysis cannot judge.
- The halo's minor-second beating (G6/A♭6) is intentionally tense; it could read as harsh.
- The payoff's lift is +2.4 dB RMS over the groove; if a listener equates size with
  level, it may feel modest despite density/width gains.
- 62.5% swing and the Orbital Foundry kick's tone were chosen analytically, not by ear.
- The final ~1.3 s is a decaying ring before restart.

## Engine observations (no engine changes made)

- Worked as specified: rates, glides (measured landing pitches), automation semantics,
  fixed-length containers, per-stage clipping counters, deterministic stems/manifest; in
  this environment even the MP3 repeated byte-for-byte (outside the contract).
- No sampler note-off/choke → length-variant kits plus a builder overlap check were
  needed for monophonic phrasing.
- No track-to-track sidechain; gain automation can emulate a duck (it did, V5).
- Kits/assets must sit under the project's `assets/` → pack hits were copied.
- Native `analyze` has no section, spectral or stereo report → own read-only tools
  (`tools/analyze.py`, `tools/report.py`).

## Composer Skill observations

- The six-line thesis before JSON fixed the call/answer/role-swap idea; later decisions
  (e.g. not ducking the bass's first consonant) were argued from it.
- "Render the whole arc early" meant V1 already had an ending, so critiques were about
  musical function rather than missing sections.
- "Three weakest results with time and evidence" exposed problems the score hid (V1's
  shuffle was written but inaudible; V2's bars 5–6 were identical).
- The engine notes changed concrete choices: absolute automation, balance pan (→ octave
  twin for width), no choke (→ variant kits), offsets add no fade (→ no offsets).
- The payoff/size heuristics kept every size fix in arrangement, register and width
  rather than master gain.
- Limits: no bundled spectral/section tool (wrote my own); the three-weakness format can
  invite filler — V4's critique lists one weakness rather than inventing three; proxies
  for "punch" can disagree (V5), and the skill cannot replace a listener.

## Determinism

Two independent renders of the locked project into fresh directories: master WAV, MIDI,
manifest, analysis, MP3 and all 12 stems byte-identical (`analysis/determinism.json`).
Master SHA-256 `2f2bfc0375c430f3f4562a46e37d37b98395a1baaf4cc5a5aba491088cf84116`.
Generated assets regenerate byte-identically (`generate_assets.py --verify`: 32/32).
