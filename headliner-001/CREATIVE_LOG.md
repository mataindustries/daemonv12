# DAEMON//HEADLINER 001 — creative-production log

Working title: **SODIUM HOURS**. Status: in production on branch
`claude/peaceful-bardeen-f7swi8`. Not published, merged or released; owner review pending.

**Listening disclosure.** The producer (an AI agent) cannot hear audio. Every judgment below is
labelled as one of: *score reasoning* (notes, rhythm, harmony as written), *measurement*
(engine analysis, spectrogram images, stem statistics), or *human feedback* (none received so far).
No listening claims and no numerical quality scores are made.

## 1. Identity (written before any sound was made)

**Image.** Los Angeles after 2 a.m., some years from now. Orange sodium-vapor light on wet asphalt,
freeway hum, a lowrider's hydraulics hissing at a red light. A machine city that is slowly learning
to sing.

**Six-line thesis.**

1. **Hook** — a four-bar sung phrase on a synthetic talkbox voice. Its signature is an upward slide
   into a held A♭ (the "cry") and an answer that ends on an unresolved leading tone E♮ which falls
   back to E♭ every time the hook repeats: the night that never resolves.
2. **Rhythmic identity** — a laid-back West Coast pocket at 92 BPM (late snare, ~58 % sixteenth
   swing) pitted against a straight-grid machine layer (a Buchla-style low-pass-gate pluck and metal
   percussion in 3-3-2 groupings). Human swing against machine grid.
3. **Low end** — a kick tuned to F and an F-minor slide bass: a clean sub plus a wavefolded
   "grit" layer that is withheld until the second half.
4. **Contrast** — groove sections sit on a static Dorian vamp (Fm9–B♭13); hook sections move through
   a cinematic progression (D♭maj9–E♭–Fm9–C7♭9) whose V–♭VI deceptive cadence never lets the song
   land; a beatless breakdown slows the hook to half speed.
5. **Payoff** — the final hook is sung by the voice *and* a choir, reaches a new peak (C6) and, for
   the first time, resolves E♮→F onto **F major** (a Picardy third): dawn.
6. **Ending** — the machine plays the motif one last time, now resolved, over the last of the rain;
   a final low hit and an F-major choir tail.

**Transformation arc.** The same motif is heard as *machine* (staccato, straight, plucked), then as
*voice* (legato, swung, sliding, vibrato), then as *choir* (harmonized, resolved). The final minute
can deliver what the opening cannot because the opening has not yet learned to sing.

**Palette rule.** A few deep instruments instead of many shallow ones, all synthesized from numbers in
this directory: no recordings, downloaded samples, SoundFonts, impulse responses, presets or
imitation of any artist. General MIDI is not used (unavailable here, and excluded by the repository's
own palette audit).

## 2. Three directions (arranged sketches, not loops)

Each sketch is a real arrangement with an opening, an established groove and a hook section, built from
original instruments in `tools/instruments.ts`. Listening copies: `sketches/*.mp3` (one render each).

| | A · SODIUM HOURS | B · IRON PSALM | C · GLASS COAST |
|---|---|---|---|
| Tempo / feel | 92 BPM, ~58 % swung sixteenths, late snare | 140 BPM half-time, straight | 104 BPM, straight broken beat, displaced snare |
| Key / harmony | F minor; Dorian vamp Fm9–B♭13 vs D♭maj9–E♭–Fm9–C7♭9 | D minor; i–VI–iv–V | A Dorian; Am9–D9–Fmaj7–G6 |
| Hook | Sung talkbox phrase: slide into A♭5, answer ends on unresolved E♮ | The wavefolded bass riff (chromatic C♯ lean); dark chant answers | Five-note LPG lattice in dotted eighths (3 against 4); metallic LPG lead |
| Low end | Round slide bass, F-tuned kick | Grit riff over a D1 sub, D1 boom | Wavefolded pluck bass |
| Length | 16 bars, 44.3 s | 24 bars, 42.9 s | 16 bars, 39.2 s |
| Measured (engine) | −16.8 LUFS, −3.7 dBTP, no clipping | −15.2 LUFS, −1.6 dBTP, no clipping | −17.3 LUFS, −1.8 dBTP, no clipping |

**Choice: A, provisionally** (score reasoning; no human listening was available). Reasons:

- It is the only direction that answers all four words of the brief at once: West Coast (talkbox,
  portamento, swing, lowrider hydraulics), industrial bass (the grit layer kept for the second half),
  nocturnal (rain, sodium lamp, distant siren), cinematic emotion (deceptive cadence, planned Neapolitan
  and Picardy resolution).
- Its hook carries a story that a three-minute form can pay off: the E♮ that never resolves can finally
  resolve in the last minute. B's chant sits on the most common "epic" progression; C's lattice is
  hypnotic but risks reading as a polyrhythm demonstration (the brief warns against arpeggio reliance).
- Two harmonic areas (static Dorian groove vs moving cinematic hook) give contrast without new material.

**Absorbed from the others:** B's riff aggression and 3-3-2 metal language feed the second half
(Hook 2 and the interruption); C's dotted-eighth lattice becomes a machine texture; C's straight grid
becomes the "machine" counterpart to A's swing. **Uncertainty:** the talkbox/G-funk lineage could read
as retro rather than futuristic; the industrial sound design and the machine→voice→choir arc are the
planned counterweight. Owner listening should confirm or overturn this choice.

**Sketch-A measurements that changed decisions.** First render: sub band ~10 dB over low-mids and
~8 dB over mids in the hook; upper-mid/high 12–18 dB under the mids; side-energy fraction 0.01
(near mono). Hats −39.6 LUFS, pad −35, keys −34 against bass −13.4. Rebalanced (bass −4.5 dB,
hats +9, pad/keys +7–8, wet tracks +3–4). A spectrogram of the voice stem showed broadband clicks at
vowel changes; fixed by gliding formant state (22 ms) instead of jumping.
