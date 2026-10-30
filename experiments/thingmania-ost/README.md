# THING//MANIA OST · Phase 1: find the hook

Three radically different, original **four-bar** concepts for the THING//MANIA
signature theme, composed and rendered with DaemonV12. This is the audition stage
only: **no full soundtrack has been built.** Pick a direction and Phase 2 starts
from that project.

> **Listening disclosure.** The agent that made these could not hear audio. Every
> judgment below comes from the score, objective measurements of the renders, and
> stem pitch tracking. None of it comes from listening. Your ears decide.

## Listen

| | Direction | Loop ×4 + final downbeat (start here) | Exact 4-bar audition |
|---|---|---|---|
| **A** | **SOCK SLIDE**: bass-driven arcade funk | [sock-slide-x4.mp3](a-sock-slide/previews/sock-slide-x4.mp3) (38.5 s) | [sock-slide.mp3](a-sock-slide/previews/sock-slide.mp3) (9.05 s) |
| **B** | **FRIDGE LIGHT**: mysterious, sophisticated electronic groove | [fridge-light-x4.mp3](b-fridge-light/previews/fridge-light-x4.mp3) (42.5 s) | [fridge-light.mp3](b-fridge-light/previews/fridge-light.mp3) (10.0 s) |
| **C** | **LOW BATTERY CHOIR**: wildcard, a choir of singing appliances in 7/8 | [low-battery-choir-x4.mp3](c-low-battery-choir/previews/low-battery-choir-x4.mp3) (29.8 s) | [low-battery-choir.mp3](c-low-battery-choir/previews/low-battery-choir.mp3) (7.0 s) |

Listen on both a phone speaker and headphones. The x4 copy shows how the loop
wears over time and how its surprise lands on the repeat. The MP3s are listening copies: MP3 encoder
padding makes them 27–41 ms longer than the WAVs, so they do not loop gaplessly. WAV masters, stems and
the seamless game-loop WAVs are kept out of Git (see [Reproduce](#reproduce)).

---

## A · SOCK SLIDE: bass-driven arcade funk

*A sock-footed slide across a kitchen floor: cool, until the floor moves.*

| | |
|---|---|
| Tempo · key | 106.08 BPM, 16ths swung to about 57% (272/240 ticks) · E Dorian |
| Hook | A squelch-synth bass riff: low E, octave pop, D–B, ghost G, A, then **B♭ bent up to B** on beat 4. A nonchalant whistle answers B–D → swoop to E6 → D–B → the Dorian **C♯**. |
| Bass groove | The bass *is* the lead: eight notes per bar locked with the kick on 1 and 3-and. Bar 2 walks D–E♭ back up to the low E. |
| Harmony | Em9 vamp (rootless clav stabs on the swung off-beats). No chord progression, just one funk chord and a trapdoor. |
| Surprise | **The slip.** In bar 4 the band jumps up a semitone to F13 (♭II, the tritone substitute) while the drums drop out. Bass and whistle then *slide* back down into the loop's downbeat. |
| Loop | The slide resolves across the boundary, so every repeat starts with a landing. |
| Palette | Squelch bass (resonant 2-stage lowpass, 75 ms sweep) plus a parallel high-passed "grit" copy for phones; whistle (scooped sine, delayed vibrato, breath); clav stabs; tight synthesized kit. |

**Critique**
- **Memorability: strong.** Two hooks support each other: the riff's B♭→B bend
  and the whistle's swoop to E6. The semitone slip is a gag a player can predict
  and enjoy. Risk: the riff and the whistle could compete for "the" hook.
- **Rhythmic identity: strongest groove of the three.** Swing, ghost notes, a drum
  break every four bars. But swung-16th funk is a familiar idiom, so its identity
  rests on this particular riff rather than the feel.
- **Originality: moderate.** ♭II13 slips and funk vamps are established
  devices. The whistle lead and the "slide home" gag make it THING//MANIA's own.
  It is the closest of the three to "music people already know they like".
- **Replay value: medium.** The slip is the same gag every 9 seconds. In a full
  score it should vary (different slip targets, or a slip that sometimes fails).
- **Translation:** effectively mono (L/R correlation 0.992; side energy 0.3–0.5%
  of the mix). That's very robust on a phone but narrow on headphones; Phase 2
  would need real stereo arrangement. On the phone proxy the whistle leads
  (−17.8 LUFS) and the bass riff survives via the grit layer (−22.0 LUFS).
- **Biggest uncertainty:** whether the whistle reads as *cool* or as *novelty*.

## B · FRIDGE LIGHT: mysterious, sophisticated electronic groove

*Is the light still on when the door is closed?*

| | |
|---|---|
| Tempo · key | 96 BPM straight · F minor (Aeolian) |
| Hook | A four-note glass-bell motif, **C–A♭–E♭–D♭**, that is **three beats long**. It rotates against the four-beat bar (entering on beats 1, 4, 7 and 10), so every repeat lands on a different chord. A dotted-eighth echo doubles the three-against-four. |
| Bass groove | FM bass on each root with an octave pop. Every bar ends with a **semitone slide into the next root**: from above into D♭, B♭ and E, from below into the loop's F. |
| Harmony | Fm11 → D♭maj9♯11 → B♭m9 (all diatonic to F Aeolian) → **Emaj9**. |
| Surprise | **The light.** Bar 4 switches to E major, the chord a semitone *below* the tonic, voiced an octave higher. The motif is re-sung in E Lydian, doubled an octave up as a glint. Then the bass climbs E→F and the light clicks off on the downbeat. |
| Rhythm | Half-time cabinet knock on beat 3; faucet drips every third sixteenth (a second three-against-four layer); quiet shaker. |
| Palette | Inharmonic 3.5:1 FM glass bell; stereo FM electric-piano chords (constant-sum autopan, so the mono fold has no tremolo); FM bass plus grit copy; knock, drips, shaker. |

**Critique**
- **Memorability: medium-high, slow-acting.** The motif repeats four times per
  loop, but in a soft bell at moderate level. It may work as a creeping earworm
  rather than an instant one, and it is the most "background-able" of the three.
- **Rhythmic identity: distinctive but restrained.** Two layers of
  three-against-four over a half-time pulse are hypnotic and unusual. It is less
  *infectious* than A: it nods more than it bounces.
- **Originality: highest harmonic sophistication.** No stock progression. The
  Emaj9 → Fm11 move (two common tones, two voices rising a semitone) is a genuine
  surprise without being random.
- **Replay value: likely the highest for long play sessions** (low fatigue,
  slowly rotating motif). The risk is the reverse: "cool" but not *signature*.
- **Revision made (evidence-driven):** section analysis showed the "light" bar
  was *darker* than bar 1 (upper-mid −2.8 dB, because the shaker thins out). The
  octave-up glint brought it to −0.1 dB upper-mid / +0.5 dB high versus bar 1,
  and +1.3 / +1.7 dB versus bar 3. The light now measurably brightens, but it is
  still a harmonic event more than a timbral flash.
- **Translation:** modest real width from the stereo keys and reverbs
  (correlation 0.963, mono fold −0.2 LU). On the phone proxy the bell leads
  (−17.8 LUFS); the bass slides drop to a supporting color (grit −25.9 LUFS).

## C · LOW BATTERY CHOIR: wildcard

*The appliances form a choir. Someone forgot to charge them.*

| | |
|---|---|
| Tempo · meter | 120 BPM, **7/8** grouped 2+2+3 · C pedal |
| Hook | A synthetic voice chants **"ba-da-DEE-da-YAAAH"**: root, 3rd, **raised 4th**, 5th, held 3rd. The raised 4th ("DEE") is the mischief. |
| Harmony | The *identical* Lydian shape is planed onto **C, D, B♭ and A♭** triads over a C pedal: one object visiting four rooms of a procedurally assembled world. |
| Bass groove | A vocal "doom" bass on C with G and B♭ answers and a squeaky octave pop (the same sample at double speed). |
| Surprise | **The battery dies.** In bar 4 the lead, the choir and the bass glide down together toward three semitones flat; measured, the lead's C5 has fallen to 460 Hz (about −2.2 semitones) when it releases. Meanwhile the shaker winds down, and a **kitchen-timer ding** restores power on the loop downbeat. |
| Rhythm | Cardboard-box kick, spoon-on-pot-lid snare, rice-jar shaker; the 2+2+3 lurch. |
| Palette | An additive formant voice synthesized per syllable (consonant loci, formant glides, scoop, jitter, delayed vibrato); a close-harmony choir sung twice per part at ±7 cents, the copies leaning left and right; household percussion. |

**Critique**
- **Memorability: highest potential.** Sung syllables are the most imitable kind
  of hook (players can *sing* it back), and the battery-sag gag ties the music to
  the game's premise. The same shape heard four times in four keys is easy to
  recognize.
- **Rhythmic identity: most distinctive, least conventionally groovy.** 7/8 is
  instantly recognizable, but some listeners will find the lurch awkward rather
  than infectious.
- **Originality: highest.** Singing appliances, Lydian planing over a pedal, odd
  meter, and a pitch-sag gag.
- **Replay value: the biggest risk.** The chant has no rests, and novelty gags
  can wear thin. The synthetic voice is the main unknown: formant synthesis can
  read as charming "appliance" character or as cheap and buzzy.
- **Translation: best of the three on small speakers.** The smallest phone-proxy
  loss (−2.5 LU), with the lead dominant there (−15.1 LUFS). The seamless loop
  wraps with a step (0.009) *smaller* than the same boundary played continuously
  (0.012).

## Which to try first

An analytical opinion, not a listening verdict: **C** has the most "cult" upside
and the highest risk. **A** is the safest *infectious* option. **B** is the most
sophisticated and the easiest to live with for hours. If C's voice sounds cheap
to you, its devices (the planed motif and the sag-and-ding) can be transplanted
into A's groove in Phase 2.

---

## Technical checks

All three use the production route with `render.duration = 4 bars` and
`render.tail = "none"`. Generated by [`tools/render-all.mjs`](tools/render-all.mjs);
full data in each `analysis/checks.json`.

| Check | A · SOCK SLIDE | B · FRIDGE LIGHT | C · LOW BATTERY CHOIR |
|---|---|---|---|
| Tempo · meter | 106.0773 BPM · 4/4 | 96 BPM · 4/4 | 120 BPM · 7/8 |
| Exact length (4 bars) | 399,105 frames = 9.050 s (expected 399,105) | 441,000 frames = 10.000 s (expected 441,000) | 308,700 frames = 7.000 s (expected 308,700) |
| Integrated loudness | −16.38 LUFS | −14.84 LUFS | −15.64 LUFS |
| Sample / true peak | −1.37 dBFS / −1.35 dBTP | −1.90 dBFS / −1.9 dBTP | −3.20 dBFS / −1.37 dBTP |
| Clipping (master full-scale samples, render warnings) | 0, none | 0, none | 0, none |
| L/R correlation | 0.992 | 0.963 | 0.956 |
| Mono fold-down loudness change | −0.1 LU | −0.2 LU | −0.2 LU |
| Phone proxy (300 Hz HPF + mono) change | −3.5 LU | −3.6 LU | −2.5 LU |
| Loudest stem on phone proxy | whistle (−17.8 LUFS) | bell (−17.8 LUFS) | lead (−15.1 LUFS) |
| Loop cycle 2 vs cycle 3 (x4 render) | bit-identical | bit-identical | bit-identical |
| Seamless loop wrap step vs. same boundary played continuously | 0.094 vs 0.205 | 0.134 vs 0.333 | 0.009 vs 0.012 |
| Naive loop of exact file: tail energy missing in first 0.5 s | −18.6 dB | −14.7 dB | −15.8 dB |
| Second render byte-identical (master, stems) | yes, yes | yes, yes | yes, yes |
| Master WAV SHA-256 (prefix) | `712e40a3cc3de933` | `256ae8ddec41f91e` | `0bc411a7c00863b6` |

How to read the loop rows:

- **Game loops should use the seamless WAV, not the exact 4-bar file.** The exact
  file starts "cold", without the reverb, delay and release tails that the
  previous repeat would leave. The seamless loop is cycle 2 of the x4 render,
  cropped sample-exactly, so its start contains cycle 1's tails. Because cycles 2
  and 3 are bit-identical, looping that crop is exactly what continuous playback
  sounds like. Its wrap step is never larger than the step at the same downbeat
  in continuous playback.
- **A's tempo is 106.0773 BPM, not 106.** At 106 BPM a loop is 399,396.41 frames,
  so repeats drift by 0.41 frames and their onsets round differently. That was
  measured as a −19 dB high-frequency difference between cycles (−42 dB below
  300 Hz). 96000/905 BPM makes the quarter note exactly 565,625 µs and the loop
  exactly 399,105 frames, 0.07% faster and inaudible.
- **Phone proxy** means two 2-pole high-passes at 300 Hz followed by a mono fold.
  It measures what survives, not what a particular phone sounds like.

Also checked on the source palette ([`tools/inspect-palette.mjs`](tools/inspect-palette.mjs),
`analysis/palette-inspection.json`):

- **Tuning.** The basses, whistle and bell measure within ±2.3 cents of their
  notes. C's sung syllables measure −2.6 to +6.6 cents because of their
  deliberate pitch jitter and scoops. Chord rows and the ding (an inharmonic
  bell) have no meaningful single-pitch figure.
- **Bass harmonics.** The share of each bass note's energy above 120 Hz is
  11–18% (A), 16–18% (B) and 22–28% (C).
- **Squelch bass tuning.** A's squelch bass is pre-tuned +7 cents because its
  closing filter measurably bends pitch down while it sweeps.

## Rights and originality

- **Every sound is synthesized from scratch** by
  [`tools/instruments.mjs`](tools/instruments.mjs). No recordings, samples,
  loops, SoundFonts or existing songs are used, and no General MIDI.
- General MIDI was deliberately avoided for a shipping game. The repository's own
  rights audit ([`benchmarks/banger-lab-001/AUDIT.md`](../../benchmarks/banger-lab-001/AUDIT.md))
  excludes the FluidR3 GM SoundFont from commercial work, because some of its
  samples have no documented chain of title.
- All melodies, progressions and rhythms were written for this brief. None
  quotes or imitates an existing game soundtrack.
- **No license is declared** for these new assets or projects. That is the
  owner's decision, as it is for the engine code.

## Reproduce

Environment used: DaemonV12 0.7.0 at `23619d1`, Node v22.22.0, FFmpeg
6.1.1-3ubuntu5. FluidSynth 2.3.4 and FluidR3_GM (SHA-256 `74594e8f…`) were
installed through the repository's documented apt route and verified with a GM
probe render, but these auditions need only Node and FFmpeg.

From the repository root:

```sh
npm ci
node experiments/thingmania-ost/tools/make-sounds.mjs     # source WAVs + kits + palette.json (byte-identical on rerun)
node experiments/thingmania-ost/tools/compose.mjs         # writes the six project JSON files
node experiments/thingmania-ost/tools/render-all.mjs      # renders, checks, copies previews/analysis
```

Or render one project directly with the CLI:

```sh
node bin/daemonv12.js render experiments/thingmania-ost/a-sock-slide/sock-slide.json --out-dir experiments/thingmania-ost/renders/a-sock-slide/loop --stems --format wav,mp3
```

`render-all.mjs` writes masters, stems, MIDI and the seamless loops under
`experiments/thingmania-ost/renders/`, which Git ignores.

## Files

```
experiments/thingmania-ost/
  README.md                     this page
  tools/
    dsp.mjs                     deterministic oscillators, filters, WAV writer
    instruments.mjs             every instrument recipe
    make-sounds.mjs             builds each audition's assets/ (multisampled kits)
    compose.mjs                 authors the projects (the score, in code)
    render-all.mjs              DaemonV12 render + checks + preview copy
    inspect-palette.mjs         tuning and band checks for source WAVs
  a-sock-slide/ | b-fridge-light/ | c-low-battery-choir/
    <slug>.json                 the editable four-bar DaemonV12 project
    <slug>-x4.json              listening copy: loop x4 + one final downbeat
    assets/                     source WAVs, kit.json per instrument, palette.json (hashes, recipes)
    previews/                   <slug>.mp3 and <slug>-x4.mp3
    analysis/                   .render.json manifests, .analysis.json, checks.json, palette-inspection.json
  renders/                      (ignored) WAV masters, stems, MIDI, <slug>-loop-seamless.wav
```

Melodic instruments are multisampled. Each pitch is its own exactly tuned WAV,
exposed as a DaemonV12 drum kit, so a note picks its pitch by name (for example
`"pitch": "Bb1"`). `playbackRate` and `glide` are used only for deliberate gestures:
bends, slides, octave pops and the battery sag. Editing a project JSON by hand
works; rerunning `compose.mjs` overwrites it.

## Process notes and deviations

- The brief asked for Phase 1 only, so the composer plugin's full V1→V3 loop per
  piece was not run. Each audition got evidence-driven revisions instead:
  - **A:** bass/whistle rebalance; the parallel grit layer (bass on the phone
    proxy went from −26.4 to −22.0 LUFS); master headroom after the grit layer
    caused 129 full-scale samples; integer-frame tempo.
  - **B:** percussion measured far too low (knock −30, drips −40 LUFS) was
    brought up; grit layer; the light-bar glint.
  - **C:** the master true peak was +0.25 dBTP and is now −1.37; choir, lid and
    shaker rebalanced; more vocal-bass harmonics.
- The engine, existing examples, music experiments, PermitPulse and THING//MANIA
  source were not touched. Everything lives in this directory.
