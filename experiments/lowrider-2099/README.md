# LOWRIDER//2099

West Coast rap × futuristic trap, 96 BPM, F minor. One two-bar hook and two different
eight-bar candidates built on it. Every sound is synthesized in this directory (no recordings,
samples or SoundFonts), and every note renders through the stock **DaemonV12 v0.7 engine**: sampler and
drum-kit tracks, the production mix and the soft-clipped master. Nothing in `src/` was changed.

| Listen | What | Length |
|---|---|---|
| [`audio/hook.mp3`](audio/hook.mp3) | The hook, played twice | 10.0 s |
| [`audio/candidate-a-bounce.mp3`](audio/candidate-a-bounce.mp3) | **A: BOUNCE**, West Coast bounce | 20.0 s |
| [`audio/candidate-b-takeover.mp3`](audio/candidate-b-takeover.mp3) | **B: TAKEOVER**, aggressive futuristic trap | 20.0 s |

The 44.1 kHz/16-bit WAV masters, provenance manifests, loudness analyses, QA reports and
spectrograms are next to them in `audio/`.

> **Nobody has listened to these yet, including me: I can't hear audio.** Every judgement below is
> either a stated design intention or a measurement. The measurements catch engineering faults:
> masking, clipping, mono loss, phone translation, timing. They can't tell whether this is a
> record people replay. That is what the approval listen is for.

## The hook (bars 1–2, starts at 0:00)

Fm9 | Dbmaj9 . . C7(b9). The lead *calls* on beats 1–2½ in a 3+3+2 tresillo, and the talkbox
*answers* on beats 3½–4. Positions are 16th steps 0–15; odd steps swing 58% in A.

| | Lead (call) | Talkbox (answer) | 808 |
|---|---|---|---|
| **Bar 1**, Fm9 | step 0 **C6**, scooped up from Ab5 · 3 Ab5 · 6 F5, falling to Eb5 on step 8 | 10 "ooh" C4 · 12 "WEE" Eb4, bending up to F4 | 0 F1 · 7 octave pop F2 (the swung "a" of 2) · 10 F1 · 14 walk-up Ab1 |
| **Bar 2**, Dbmaj9 → C7(b9) on beat 4 | 0 **C6**, scooped · 3 Ab5 · 6 Db6 (scooped from C6), sighing to C6 on step 8 | 10 "yeah" Bb3 · 12 "YEAH" E4 → F4: **the shrink** | 0 Db2 · 7 Db2 pop · 10 C2, sliding down a fifth into the next F1 |

Within the first two seconds you hear the C6 "whoop" at 0.00 s, Ab5 at 0.49 s, F5 at 0.94 s
(falling at 1.25 s) and the first talkbox syllable at 1.56 s.

### The signature sound: TALKBOX//2099

A talkbox pipes a keyboard into a player's mouth, and it is *the* G-funk instrument. Ours has no
player. A bright synth (two detuned saws and a narrow pulse) is driven into the **MORPH//03
Kelly–Lochbaum vocal tract**: 44 oral and 28 nasal sections, calibrated vowels, articulated per
syllable. Because the mouth is a physical model, it can do something no human can. On the C7, the
answer holds E4 while the **tract changes from tiny to giant mid-word**: the formants
sweep down slightly more than an octave and the pitch does not move (`size: [1.45, 0.7]` in `score.mjs`).
The voice changes size while it sings, and it pulls the loop back to the downbeat.

In B, that giant mouth hands over to the **MORPH//06 Wobble Beast**: a bowed cable through the
same throat, where every wobble is a mouth shape and never an LFO. It becomes a talking bass that
answers the 808.

## The candidates

**A: BOUNCE.** The groove plays from the first beat. The hook is designed to be rapped over.

| Bars | What happens |
|---|---|
| 1–2 | The hook, full band: knock kick on 1, the swung "a" of 2 and the "and" of 3; dry clap + snap on 2 and 4; swung hats and push/pull shaker; 808; barely-there FM keys |
| 3–4 | **Verse mode**, the room for a rapper. The lead plays only the whoop (bar 3), then nothing; the talkbox keeps answering. A rim enters and the 808 walks F–Ab–Bb up into Db. A hydraulic *pssht-clunk* lands on the "and" of 4 in bar 4 |
| 5–6 | The hook again |
| 7–8 | The last call reaches up to **Eb6** and falls to C6. **Dead stop on bar 8 beat 3**: the hop's clunk, then the shrinking talkbox alone over one C7b9 chord, into the loop |

**B: TAKEOVER.** Straight 16ths, distorted 808, the Beast.

| Bars | What happens |
|---|---|
| 1–2 | Hook only: driven lead, talkbox answers ("wow", then the shrink), soft ticks and a riser. The talkbox mouth grows to giant size *into* the drop |
| 3–8 | The **takeover**. The dirty 808 calls on beats 1–2½, diving in from a fifth below with octave drops, then **rests** while the Beast answers in the bass register on beats 3–4 ("WOM-ka-YOI-ka", "ya-ya-EEYOOW" diving 11 semitones, "wa-wa-YOW"). Snare + clap on 2 and 4. Hat rolls only at phrase ends: 32nds rising 4 semitones, then 16th-note sextuplets rising 7 |
| 8 | The last call's Db6 tape-stops to a quarter speed over a half note while the 808 dives an octave, into silence |

## How it's built

| Layer | Where | Why |
|---|---|---|
| Instruments (lead, 808s, drums, keys, FX) | `instruments.mjs` → `build-assets.mjs` → `assets/` (PCM16 WAV + kit JSON) | The engine samples; it does not synthesize. Every source is oscillators, noise, modal resonators or physical models, seeded and deterministic |
| Talkbox and Beast phrases | `score.mjs` (`TALKBOX`), `beast-phrases.mjs` → `assets/voice/` | A mouth needs an articulation trajectory over time, so each answer is performed offline and placed by the engine as one note |
| Every note, groove, bend, slide and mix move | `make-projects.mjs` → `hook.json`, `candidate-a-bounce.json`, `candidate-b-takeover.json` | Rendered by `bin/daemonv12.js` |

Engine features doing the musical work:

- **Pitched multi-sample instruments from drum kits.** The lead and both 808s are kits with one
  file per pitch, so straight notes are exact copies (no interpolation) and notes read like
  `"pitch": "C6"`.
- **Scoops and slides:** `playbackRate` + `glide` at note onset.
- **Mid-note bends (falls, sighs, the 808 slide home).** The sampler can only glide from a note's
  onset. A fall is therefore a *second voice*, started at the exact source frame the first voice
  is reading when its `gate` closes. Its `offsetSeconds` is computed from the engine's own
  closed-form read position. Both voices use matched 5 ms ramps, so the crossfade is
  phase-continuous and the new voice then glides. See `line()` in `score.mjs`.
- **Swing** as tick offsets (+40 ticks on odd 16ths = 58.3%). **Gates/envelopes** shape every
  808 and lead note, and a **choke group** handles the hats.
- **Mix:** per-track gain/pan, high-passes, delay, the built-in reverb, compressors and lead
  saturation in B.
- **Master:** high-pass → glue compressor → `saturation` at drive 0 / mix 1. The engine has no
  limiter, but tanh can never reach full scale, so this acts as a soft clipper.

The talkbox throat (`throat.mjs`), its DSP kit (`dsp.mjs`), the cable (`cable.mjs`), the
Beast (`beast.mjs`) and its timing helpers (`perform.mjs`) are vendored **unchanged** in
`vendor/` from `feat/morph-06-overload` @ `2b6e533a021218d6940a8da5a7032c2abe58a3d9`. Their
SHA-256s match the table in [`docs/MORPH_SYNC_SOURCES.md`](../../docs/MORPH_SYNC_SOURCES.md).

## Measurements

From `tools/qa.py` (stems + master) and the engine's own FFmpeg analysis. The phone model is a
4th-order 320 Hz high-pass, an 8 kHz low-pass and a +4 dB presence peak at 2.5 kHz. **Phone SMR** is
a part's level against everything else through that model, in the 100 ms windows where the part
sounds: above about −6 dB you can follow it as a line, and below −12 dB it is masked.

| | Hook | A: BOUNCE | B: TAKEOVER |
|---|---|---|---|
| Integrated loudness | −11.4 LUFS | −11.8 LUFS | −12.6 LUFS (includes the 5 s intro) |
| True peak / sample peak | −1.57 / −1.57 dBFS | −1.56 / −1.57 dBFS | −1.34 / −1.52 dBFS |
| Clipped or full-scale samples (master, every track, MP3 decode) | 0 | 0 | 0 |
| L/R correlation · mono fold-down loudness · worst band loss | 0.991 · −0.04 LU · −0.36 dB | 0.990 · −0.04 LU · −0.35 dB | 0.992 · −0.02 LU · −0.06 dB |
| Kick punch: master crest 25 ms after each kick vs 60 ms before (median / worst) | 14.3 / 9.9 dB | 14.3 / 9.9 dB | 21.3 / 10.6 dB |
| 808 phone SMR (median / worst 10%) | −4.7 / −9.6 dB | −4.6 / −9.6 dB | −5.6 / −9.4 dB |
| Lead · answer phone SMR | −1.0 · −0.7 (talkbox) | −0.8 · −0.7 (talkbox) | +5.0 · +10.3 (Beast) |
| Energy: <60 / 60–250 / 250–1k / 1–4k / >4k Hz | 31 / 42 / 17 / 8 / 1.5 % | 32 / 42 / 17 / 7.5 / 1.6 % | 22 / 36 / 25 / 13 / 3.3 % |

**Reproducibility:** a from-scratch `build-assets.mjs` run is byte-identical, and re-rendering all three
projects reproduces the master SHA-256s (`hook` `8652532e…`, A `5402a3f8…`, B `01ecfeaf…`) on
Node 22.22 / FFmpeg 6.1.1.

### What the measurements changed

| Draft problem (measured) | Fix | After |
|---|---|---|
| 49 Hz kick body 0.5 s long beating at ~5 Hz against the F1 808 (visible in the master waveform) | Short knock kick (50 ms body decay); the 808 owns the sub | Beating gone; kick-punch median 14.3 dB (the draft read 6.3 dB, partly because its long tail re-triggered the onset detector) |
| 808 dropped 11 LU relative to the mix on the phone model | More drive and an upper-harmonic "growl" layer, measured per setting (drive moved it most) | Phone-model loss vs the mix 11.1 → ~6 LU; over the last drive step, phone SMR median −6.2 → −4.6 dB and worst 10% −12.2 → −9.6 dB |
| 808 voices overlapping at the bar line summed past full scale (60 samples) | 3 dB of sample headroom; tighter releases | 0 clipped samples |
| Talkbox popped when the lips sealed around a sounding source; plosive burst (3×) at every phrase onset | The source stops before the lips seal; the mouth starts in the first vowel | Endings decay cleanly; the first 60 ms stay ≤ 1.1× the sustain level |
| Talkbox vowels barely distinguishable at C5 | A/B test of tract "metal" against register: the octave down resolves the formants, metal didn't matter | Answer in the C4–F4 talkbox register |
| Beast at F1: the bowed cable barely sustains (body ~−20 dB) and pops on closing | The WOM phrase moved up an octave; fade before the seal | Answers present (phone SMR +10.3 dB) |
| Answer ~5 LU under the call | Rebalanced; call/response panned ±0.15 | Within ~2 LU |

## Critical evaluation

**Groove.** A has a real bounce: swung kick on the "a" of 2, the 808 octave pop and the push/pull
shaker, with gaps in the 808 so the kick breathes. B is straighter and harder, with the 808 and the
Beast trading every half bar. *Unverified:* whether 58% swing is the right amount. It is one number
in `make-projects.mjs`, so try 54–62% by ear.

**Catchiness.** The hook is deliberately simple: a falling minor triad in a tresillo, with
the same head twice and a different tail on each bar, then a sung answer. Simple is how hooks stick,
but the same simplicity could read as generic. The scoop, the whine timbre and the talkbox carry
its identity. **This is the biggest open question, and only a listen can answer it.**

**Bass translation.** The 808 is followable on a phone (median SMR −4.6 dB in A) but not dominant.
The worst windows are where the lead and talkbox sit on top of it. B's distorted 808 has more
harmonics, but more competition from the snare and lead too.

**Mix.** It is mono-safe almost by construction, which makes it narrow: correlation 0.99, and the
width comes only from panned hats, shaker, rim and reverbs. A is dark: 1.6% of its energy is above
4 kHz. Loudness is about −12 LUFS against −8 to −9 for commercial rap masters.

**Artistic identity.** The talkbox through a physical vocal tract, the shrinking mouth, and in
B the Beast are things only this instrument system makes. The hydraulic hop ties A to the title.

**Recommendation:** approve the hook, then build on **A**. It grooves from the first beat, leaves
room in bars 3–4 and has a turnaround made for a rapper. B's Beast answers are the strongest
"2099" material, and would work as a later section (a switch-up or a second hook) rather than the
foundation.

## What still needs work

1. **A human listen.** Above all, check whether the talkbox reads as words ("ooh-WEE", "yeah") or only as
   vowels. The spectrograms show the formant motion; they cannot show intelligibility.
2. **Loudness and top end.** The engine has no limiter and no shelf EQ. Pushing the tanh soft
   clipper further will audibly distort the 808. For release, master outside the engine or add a
   limiter. A also wants more air than its hats can provide.
3. **Width.** Real stereo content (a different hat pattern per side, a stereo double of the answer)
   instead of balance panning.
4. **The 808 on phones.** In A, a mid-range layer or more drive in the bars where the lead is
   silent would help.
5. **B's intro is 5 s with no low end.** If B is chosen, consider dropping at bar 2. A filter
   sweep would be better than the riser, but the engine has no filter automation.
6. **Performed phrases are baked.** Changing what the talkbox or Beast sings means editing
   `score.mjs` / `beast-phrases.mjs` and re-running `build-assets.mjs`. Re-pitching in the sampler
   moves the formants too.
7. **The Beast may read as a creature rather than a bass.** The MORPH//03 review raised the same
   risk.
8. **Engine gaps this exposed:** no mid-note bend (worked around with phase-continuous voices), no
   limiter, no shelf/peak EQ, no filter automation, no exponential (constant-semitone) glide.

## Reproduce

Needs Node 22.18+ and FFmpeg. QA and spectrograms also need Python 3 with numpy, scipy and matplotlib.

```sh
npm ci                                    # once, from the repository root
experiments/lowrider-2099/render.sh       # sounds -> projects -> WAV/MP3/stems -> QA -> audio/
```

Stems (every track, sample-aligned with the master) are written to
`experiments/lowrider-2099/renders/<project>/<project>.stems/`. They are not committed (75 MB) but
reproduce byte for byte. To edit the music, change `score.mjs` or `make-projects.mjs` and re-run.
The JSON projects can also be edited directly and rendered with
`node bin/daemonv12.js render <project>.json --stems --format wav,mp3`.

## Rights

All melodies, rhythms and sounds are original to this directory. The harmony (i–bVI–V7) and the
tresillo are common genre conventions; no existing recording, melody or lyric is imitated or sampled.
The talkbox and the Beast sing non-lexical syllables. The vendored MORPH code belongs to this repository.
Like the rest of the repository, this directory has no code license yet. That is the owner's
decision (see the root README).

## Files

| Path | What |
|---|---|
| `instruments.mjs` | Every synthesized instrument, plus the talkbox (synth → vocal tract) |
| `score.mjs` | Engine timing helpers, the phase-continuous bend writer, the hook, talkbox phrases |
| `beast-phrases.mjs` | B's Wobble Beast answers (120 → 96 BPM step mapping, pre-roll for the inhale) |
| `build-assets.mjs` | Renders `assets/` (WAV + kit JSON + `MANIFEST.json` with hashes) |
| `make-projects.mjs` | Writes the three DaemonV12 projects |
| `hook.json`, `candidate-a-bounce.json`, `candidate-b-takeover.json` | The projects |
| `render.sh` | The whole pipeline |
| `tools/qa.py`, `tools/spectro.py`, `tools/waves.py` | QA metrics, spectrograms, stacked waveform views |
| `vendor/` | MORPH//03, //04 and //06 sources, unchanged |
| `audio/` | Deliverables |
