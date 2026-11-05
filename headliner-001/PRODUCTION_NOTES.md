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

## 3. V1 — first complete single (3:08)

70 bars + tail, 15 tracks, 2,311 notes, 149 generated sounds. Form: intro "haze" (1–8) · groove
"boulevard" (9–16) · hook 1 (17–24) · verse "overpass" (25–32) · breakdown "mulholland" (33–40,
half-speed hook, Neapolitan → V) · hook 2 "freeway" (41–48) · signal loss (49–52, 3-3-3-3-4 stop-time,
voice stutter, two beats of silence) · final (53–64: choir sings the hook, C6 summit, E→F over
F major) · outro "dawn" (65–70). Engine: −17.7 LUFS, −3.7 dBTP, no clipping anywhere.
Preserved in `versions/v1/` (project, MP3, analysis, WAV hash).

**V1 critique (measurement + score; no listening).**

1. **Flat arc, weak physical payoff** (whole form). Section RMS: groove −18.0, hook 1 −17.9, verse −17.9,
   hook 2 −17.1, final −17.1 dBFS; side-energy fraction 0.03 in hook 1 and 0.037 in the final. The final
   is compositionally new but physically almost the same as hook 1. *Cause:* hook 1 already uses the
   full kit and the breakdown pad is the loudest pad of the song. *Change:* lighten hook 1, make the
   breakdown intimate, widen and thicken hook 2 and the final.
2. **Near-mono image with drums** (all beat sections, side fraction ≤ 0.04, correlation ≥ 0.93).
   *Cause:* the loud parts (kick, bass, snare core, dry voice, dry pluck) are mono and centred; wide
   parts are quiet. *Change:* raise wide parts, place contrasting parts left/right (keys and metal left,
   hats and pluck right).
3. **Groove mid-hole and dull top** (bars 9–16: sub 13.5 dB over mid; 6 kHz+ band 17–19 dB under the
   mids everywhere). *Cause:* keys too quiet to carry the groove, hats −32.7 LUFS. *Change:* keys up in
   the groove, hats up, more snare crack.

**Defects found.** (a) The struck pipe, tuned to F3 and hit six times per bar in the 3-3-2 pattern,
forms an F drone (visible as a continuous ~175 Hz line from bar 25) that clashes with the E♮ leading
tone over C7♭9 — it undercuts the hook's central tension. *Fix:* pipe follows the chord root, shorter
decay. (b) Kick track pre-clip peak −0.5 dBFS when the boom stacks on a main kick. *Fix:* lower boom
velocities. (c) The master sits at −17.7 LUFS with no soft-clip stage. *Fix in V2:* glue compressor
and a tanh soft-clip stage, target ≈ −11 to −12 LUFS with ≤ −1 dBTP (not loudness-chasing).

**Must survive into V2:** the hook's rhythm and contour, the slide into A♭5, the E♮/E♭ deception,
the groove pattern, the signal-loss rhythm, the two-beat silence, the F-major resolution.

## 4. V2 — balance, arc and master

**What changed and why (mapped to the V1 critique).**
- Pipe now follows the chord root with a 0.26 s body (defect a). Kick track gets its own tanh soft clip
  and lower boom velocities (defect b).
- Hook 1 lightened (no ghosts, no open hats, kick ×0.84); breakdown made intimate (slow voice
  velocity 0.92→0.5, bass 0.72→0.52, pad/choir down); Hook 2 and final widened and thickened (choir
  chords under the ensemble, pad, grit and wet tracks up, open-hat lift, impacts on each final pass).
- Placement contrast for width: keys and metal left, hats and dry pluck right.
- Hierarchy fixed after a per-stem K-weighted section matrix (`analysis/stem_matrix.py`) showed the
  kick as the loudest stem everywhere: voice +2.5 dB, snare +2.5 dB (with its own soft clip), kick −2 dB.
- **A first V2 render (V2a, preserved) changed almost nothing physically** — section differences stayed
  within ~1 dB. Diagnosis: my master compressor (−18 dB threshold, 2:1) sat above the mix RMS all
  the time and halved every section difference. Fixing that sent true peak to +0.69 dBTP, so the master
  was chosen offline with `analysis/master_sim.py`, which reproduces the engine's master chain on the
  stems (verified: −10.1 vs engine −10.16 LUFS, identical peak and true peak). Chosen chain: −4.5 dB,
  high-pass 28 Hz, glue compressor −11 dB 1.6:1, tanh 6 dB, tanh 0 dB ceiling.

**V2 measurements.** −11.7 LUFS integrated, LRA 6.1 LU, −1.4 dBTP, sample peak −2.6 dBFS, no clipped
samples. Relative to hook 1: breakdown −3.5 dB (V1 −1.4), final +1.4 (V1 +0.8), resolution +2.3.
Side-energy fraction: hook 1 0.040 → hook 2 0.052 → final 0.075 (V1: 0.030/0.029/0.037).
Soft clip exceeds 1 dB of gain reduction on 9.7 % of loud samples, 3 dB on 0.4 %.

**V2 critique (score + measurement; no listening).**
1. **The groove fails the lead-muted test in the mids** (bars 9–16). Its 500–2000 Hz band sits 8.5 dB
   below the hooks'; with no voice, the mid register holds only sparse keys stabs and pluck answers.
   *Change:* give the groove a real mid-register part — keys comping louder and with a moving top line —
   and a drum break at bar 16.
2. **The intro spends the reveal** (bars 1–8). The machine plays the *complete* hook twice, including the
   E♮ leading tone, before the voice ever sings; the voice's entrance adds timbre but no new melody.
   *Change:* the machine manages only the call; its answer breaks off after the first cell. The full
   answer, and the E♮, are first heard from the voice (bars 19–20).
3. **Repeated transition gestures** — two impacts 1.3 s apart (bar 32 beat 3 and bar 33), and four
   similar "stop" silences (bars 8, 32, 40, 52). *Change:* drop the bar-32 impact; bar 40 runs straight
   into Hook 2 on a tom fill; silences escalate: one beat (8), a hanging E♮ (32), total silence (52).
   Also still slightly dark (upper-mid 11.7 dB and highs 16.7 dB under the mids in the final):
   brighten hats/snare/keys a little.

## 5. V3 — the reveal, the pocket, the edges (3:06.5)

**Changes (mapped to the V2 critique).**
1. The machine now states only the *call*; its answer breaks off after one cell (bar 7) and a stalled
   A♭4. The complete answer, and its E♮, are first sung by the voice (bars 19–20).
2. Keys comping gained a moving top line (G A♭ B♭ | A♭ G F E♭ | G F G | D C G A♭, nine voicings with A♭3 as
   common tone) and +4 dB in the groove; bar 16 breaks the drums on beats 3–4 while bass and keys keep
   talking. K-weighted keys level in the groove: −24.8 → −20.5 (within ~3 dB of kick, bass and snare).
3. Bar-32 impact replaced by a reverse swell; bar 40 now runs into Hook 2 on a tom + ghost-snare fill
   instead of a fourth silence. Silences now escalate: one beat (8), a hanging E♮ (32), total (52).
4. The final's first pass is a new take (new seed, more vibrato and intensity) rather than a reuse of
   hook 1's exact performance.
5. Edges: the rain patch's freeway rumble halved (it painted a 50–150 Hz haze over the bass-less intro);
   the last choir chord now fades its voices inside the sample and lets the hall decay naturally
   (tail −27 → −96 dBFS over 182–185 s instead of a cliff); container trimmed to 186.5 s; master −4.0 dB.

**Measured.** −11.3 LUFS, LRA 6.2 LU, −2.1 dBTP, sample peak −2.6 dBFS, no clipped samples anywhere.
**Voice pitch check** (`analysis/pitch_check.py`, YIN on the dry voice stem vs the score): all 44 notes
of hook 1 within ±13 cents, most within ±6; the larger values are sixteenth-note passing tones still
settling from portamento.

**Review checks (proxies; no listening).**
- *Opening:* first sound is the machine's E♭5 at 0:00 inside rain at full level within 1 s; the call is
  complete by ~3 s; the siren's distant cry answers from 5.2 s; bass and keys at bar 5.
- *Impact:* Hook 2 arrival vs approach +4.6 dB RMS (sub +8.1, upper-mid +4.9, highs +7.9); final arrival
  vs signal loss +1.3 dB RMS with mids +6.2 and side fraction 0.028 → 0.077; bar 64 (resolution) is the
  loudest window (−10.0 dBFS) with no drums.
- *Final 3 seconds:* low F hit, F-major pad and choir, the machine's last notes E→F; smooth decay, ~1 s of
  silence, then a replay restarts on the minor-key machine call ("the night returns").
- *Translation proxy:* mono fold-down costs 0.1–0.6 dB (mono-safe). In a 300 Hz–8 kHz band the hooks lose
  ~5 dB (the voice carries them) but the groove loses 9.5 dB: on phones the pocket depends on snare,
  hats, keys and bass harmonics. **Known risk**, accepted for a bass-led groove; flagged for owner listening.

**Remaining weakness worth naming:** Hook 2 repeats Hook 1's phrases; only the arrangement changes.

## 6. Risk Pass (V4) and V5

**V4 — Risk Pass: half-time cadence.** *Hypothesis:* switching bars 61–63 (D♭ → E♭ → G♭ Neapolitan → C7)
to half time — kick on 1, hall snare + clap on beat 3, long bass roots — broadens the approach to the
F-major resolution like a ritardando without changing tempo, so bar 64 lands as the end of a
deceleration and the last pass differs from every earlier one. *Risk:* momentum loss before the payoff;
syncopations fighting the new accents. *Cost:* one score edit, one render. *Evidence and result:*
the half-time accents coincide with structural melody notes (kick under the A♭5 cry at 62:1; snare on
the call's turn E♭5 at 61:3, its closing F5 at 62:3, and the C7 arrival under C5 at 63:3). Bars 61–63:
−11.0 dBFS RMS vs −10.8 for 57–60 (no energy hole); upper-mid −1.7 dB and highs −3.3 dB vs V3 (fewer
transients, as intended); sub unchanged. **Kept** on score reasoning and measurement; V3 is preserved
for an owner A/B because only listening can confirm the momentum trade-off.

**V5 — the climbing ceiling.** *Hypothesis:* Hook 2 reused Hook 1's phrases. A new second answer for
Hook 2 that peaks on B♭5 makes the song's melodic ceiling climb chorus by chorus — A♭5 (hook 1) →
B♭5 (hook 2) → C6 (final) — giving Hook 2 its own identity and turning the final summit into the third
step of a staircase. *Cost:* one new phrase, one render. *Keep if* the pitch check passes and the line
fits C7♭9 (B♭ = ♭7). *Result:* B♭5 +1.3 cents, C6 +1.3, A♭5 +2.6; the only outlier (−34 cents) is the
sixteenth-note A♭5 passing tone gliding into the summit slide, present identically in V3. **Kept.**

**Stop decision.** V5 is the fifth serious version, the default budget. Remaining ideas (e.g. grit
answers in Hook 2's rests — the bass and grit already pop there) are speculative; the record is locked
at V5. Final measurements are in `delivery/`.
