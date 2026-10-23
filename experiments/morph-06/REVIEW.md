# MORPH//06 production log: the gasp and the overload

**Nobody listened during production.** Everything below is one of three kinds:
- **Human feedback:** from the MORPH//05 review.
- **Measurements:** `analyze06.py`, the MORPH//03 analysis helpers, spectrograms.
- **Design intentions:** stated as intentions.

The measurements show whether an edit did what it was meant to and whether it broke anything
(clicks, clipping, masking, timing, the parts that should be unchanged). They cannot show
whether the record got better. That question is the brief's, and it is for human listening.

## The brief, as read

- **Feedback on V3:** excellent on headphones and in the car.
- **Requested:** a slightly longer dramatic silence before the 20 s payoff, and a more intense,
  escalating, increasingly chaotic ending that cuts off abruptly into silence.
- **Constraints:**
  - Do not rewrite the composition or invent another instrument.
  - Do not move the payoff downbeat.
  - Do not raise master gain, stack layers or limit hard.
  - Keep exactly 1,234,800 samples and 1,680 frames at 60 fps.
  - Preserve V3 and every earlier version.
  - Stop after three alternates: no merge, publish or video.

## Step 0: which render is "version C"

- **Page labels:** the MORPH//05 listening page offers **V1, V2, V3**; there is no "C". Read
  as the third version, C is **V3**, which the brief also names as the base.
- **Page against repo:** the MP3 the page plays has SHA-256 `04e1526b7bcc00dc…`, identical to
  `experiments/morph-05/audio/v3/cable-beast-v3.mp3` at `56f013be2ffa279bc191ce925451454b775a7e34`.
- **Master:** that MP3 was encoded from the V3 master WAV `a1c07efb6fe01b13…`.
- **Branch:** `feat/morph-06-overload` was cut from that commit. Nothing under
  `experiments/morph-05/` (or earlier) is modified; MORPH//06 imports `v3.mjs` and the
  MORPH//03–04 instruments read-only.

## Step 1: renderer control test (`control.mjs`)

**The copies.** `record.mjs` and `beast.mjs` are copies of the MORPH//05 renderer and Beast
with three features:
- **Silence windows:** a raised-cosine fade-out, then exact zeros, applied to every stem and
  again after the master chain.
- **'Overwind' cable state:** the existing wind-up, continued past the note.
- **Pinned levels:** described under "Found during verification" below.

**The tests.** Rendering the unchanged V3 score gives a master bit-identical to `a1c07efb…`,
twice:
1. as is;
2. with V3's own measured levels pinned.

Any difference in A, B or C therefore comes from their score edits.

## Experiment A: the gasp (125 ms)

**First design and its problem.**
- **Plan:** mute 19.875–20.000 s.
- **Measured problem:** V3's wind-up 2 ratchets 9 times across 19.375–20.0 s, the round trip
  shrinking from 375 ms to 29 ms. Its last 4 repeats, the fastest ones where the drums fuse
  into pitch, all fall inside the last 125 ms.
- **Consequence:** muting would have cut the wind-up off before its climax and made the silence
  sound like a dropout.

**Chosen design.**
- **Wind-up:** the same accelerando (dotted eighth to E1) on a curve 12.5% shorter, completing
  at 19.875 s.
- **Repeats:** 7 at 375 → 227 → 103 → 64 → 46 → 35 → 26 ms.
- **The silence:** the hand grabs the cable at 19.875 s. A 4 ms fade-out runs into exact zeros
  until the payoff at 20.000 s.
- **The return:**
  - The cable restarts from rest on the payoff slap.
  - The Beast's wound-up "aah" lets go a 32nd before the silence.

**Fix during A: the payoff attack.**
- **Problem:** a 2 ms fade-in at 20.000 s lowered the payoff downbeat's 15 ms crest from 8.0
  to 7.2 dB.
- **Why the guard can be shorter:** every instrument restarts from rest, so there is no
  waveform to click.
- **Fix:** instruments now return with a 0.3 ms guard; rooms and echo, which carry tails, fade
  back over 30 ms.

**Measured outcome.**
- **Silence:** exactly zero for 5,512 samples (124.99 ms), frames 876,488–881,999, picture
  frames 1192–1199.
- **No click:** fade-out edge 0.03× the music's largest step. The payoff onset ratio is 3.9×,
  against V3's own attack at 3.7×.
- **Payoff slap:** the cable's slap over everything else (300 Hz–4 kHz, 60 ms) rises from
  −0.7 to +1.4 dB.
- **Low end:** the kick leads the bass sub by 24.6 dB instead of 14.2, because the cable's sub
  no longer rings across the downbeat.
- **Crest:** the downbeat crest is 7.5 dB (V3 8.0).
- **Rest of the record:** every stem is bit-identical to V3's up to 18.7 s, where the
  shortened wind-up begins. The ending is V3's.

## Experiment B: the overload

**Plan.** Keep A's gap. Rewrite only 24.0–28.0 s, from the existing cable, Beast and kit:
- the cable's slap, pop, ghost, wind and ratchet;
- the Beast's existing syllables, chokes, glitch and crush;
- kick, snare, toms, ticks, spring, bells and clank;
- the second cable's cracks.

The hook stays in place through 26.5 s. Exact events and timestamps: README "What changed"
and `audio/EVENT-CHANGES.md`.

**Shape, as intended:**
- **25.0–25.5 s:** the ticks double.
- **25.5 s:** the hook's run splits into slap-pop pairs in 32nds.
- **26.5 s:** where V3 snapped, the cable refuses to snap and repeats the hook's head in 8ths
  against a Beast hocket.
- **27.0 s:** the cable "overwinds", wound past its note toward E3. It is re-struck every round
  trip, and the drums ratchet with it.
- **27.0–27.6 s:** the Beast climbs in quintuplet chokes and screams. Kicks multiply from
  quarters to 32nds, toms walk up, and bells and clanks alarm.
- **27.600 s:** everything is cut.

**First render: too hot.**
- **Master:** soft clip reached 6.4 dB and master hold-back up to 9.9 dB.
- **Balance:** the drums dominated, with the cable 7.7 dB under them. That is "stacking layers
  and heavy limiting", which the brief forbids.

**Fixes:**
- **Kicks:** fewer and lighter 32nds; no kick under the big snare at 26.5 s.
- **Roll, bells, ticks:** a softer roll, quieter bells, lighter ticks.
- **Rides:** the drums ride down 2–3 dB as they multiply, and the cable rides up 3.5 dB into
  the overwind.
- **Trim:** 2 dB on the whole overload (ramped in over 26.0–26.5 s), so matching integrated
  loudness does not pull the rest of the record down.

### Found during verification: the overload had changed the whole Beast

**How it was found.** A stem-by-stem comparison against V3 before the gasp showed B and C
were not V3 before 19 s, though their scores are identical there. The Beast stem was 5.6 dB
quieter from its first note at 6.4 s. After gain matching, a −8.3 dB residual remained: its
sound had changed, not just its level.

**Cause.** MORPH//05 normalises several sources to their own peak or RMS over the whole
record:
- inside the Beast, the bowed source before the fold distortion and the mouth before its grit;
- the Beast's crest-limit threshold;
- the Beast mid and sub, the second cable and the bass.

The overload's scream and chokes produced a mouth peak 4.6× V3's, so the whole Beast was
driven 13 dB softer into its grit and came out quieter and cleaner from the first note. For
one record that is harmless. For an alternate that should only change its ending, it
silently changed the instrument the feedback praised.

**Fix.**
- **The copy:** `beast.mjs` (copied; the MORPH//05 file is untouched) and `record.mjs` accept
  pinned references.
- **The values:** `control.mjs` measures them from V3's own render (`v3-levels.json`) and
  proves pinning them reproduces V3 bit-identically.
- **The pin:** A, B and C pin all seven.

**Result.**
- **Stems:** before 18.7 s every stem of B and C matches V3 to −88 dB after the shared stem
  export gain, which is 24-bit quantisation. A is bit-identical.
- **Approach and payoff:** these now play at V3's level after loudness matching (B −14.6 /
  −13.4, V3 −14.8 / −13.3). The earlier render had them 1.3 / 0.6 dB lower; that trade-off is
  gone.

**Re-balancing the overload.**
- **Problem:** with the Beast's drive restored, its new overload phrases sang 2.5–6.6 dB hotter
  than in the design the overload was balanced on. Its WOM-ka-YOI on the hook's head at
  26.0 s sat 3 dB over V3's level there.
- **Fix:** they ride lower from 25.5 s only:
  - −1 dB on the climb;
  - +1 dB on the hook's head (V3's level there: −23.4 / −21.6 dB against V3's −23.3 /
    −21.1 dB pre-master);
  - −6 to −7 dB in the overwind.
- **Result:** the Beast-over-cable balance in 200 Hz–4 kHz returned to within about 1–2 dB of
  the design, per 0.25 s.

### Measured outcome (final)

- **Master:** soft clip max 2.76 dB (V3 2.97); limiter max 1.28 dB (V3 1.37).
- **Hold-back:** the master holds back at most 3.8 dB in any half second of the ending
  (V3 3.1).
- **Peaks:** 0 full-scale samples; true peak −1.4 dBTP.
- **Escalation:**
  - Per 0.2 s from 26.0 s the level stays between −12.0 and −10.2 dB, apart from one planned
    breath at 26.8 s (−15.1). After the breath it climbs to the cut: −11.3, −11.0, −10.2.
  - The last window is the loudest; its flux is 82, near the busiest.
  - Over the same span V3 decays to −30.5.
- **The last 4 s:** 1.4 dB above the payoff (V3 0.1 dB above).
- **Overwind:**
  - The cable rises from about 56 Hz at 27.2 s to 124 Hz at 27.5 s.
  - Cable and Beast trade the lead within about 4 dB (Beast +2.2, −1.7, +3.6 dB per 0.25 s).
- **The cut:**
  - Exactly zero for 17,640 samples from frame 1,217,160 (27.600 s, picture frame 1656) to
    the end.
  - The fade-out edge step is 0.09× the music before it.
  - The file is exactly 1,234,800 frames.
- **The payoff:** slap +1.4 dB over the rest, kick 24.6 dB over the bass sub, crest 7.6 dB.
- **The hook:** 24.0–26.5 s keeps V3's hook. The cable and Beast are unchanged through 25.5 s,
  and the drums change from 25.0 s.

## Experiment C: the longer gasp (250 ms)

- **Design:** B's ending, with the gasp from 19.750 s.
- **Muting problem:** muting V3 would have deleted the last 6 of its 9 repeats.
- **Wind-up:** the curve is 25% shorter and gives 6 repeats (375 → 189 → 80 → 50 → 36 →
  20 ms, the last cut by the grab). It keeps the wind-up's identity, an accelerating ratchet
  that fuses into pitch, but compresses it harder than A.
- **Silence:** exactly zero for 11,025 samples (250.0 ms), frames 870,975–881,999, picture
  frames 1185–1199. Fade-out edge 0.06×.
- **Payoff:**
  - The slap stands +2.8 dB over everything else, the clearest of the four.
  - The downbeat crest is 7.3 dB, the softest.
  - The onset step ratio is 2.4×.
- **Ending:** identical in design to B; measured within 0.1–0.3 dB of it.

## What remains for human listening

| Question | What the measurements say | What they cannot say |
|---|---|---|
| Does the gasp make the payoff bigger? | The slap is clearer (+2 to +3.5 dB) and the kick owns the low end (+10 dB). Crest is 0.4–0.7 dB lower. | Whether it reads as a breath or as an interruption of the accelerating cable. |
| 125 or 250 ms? | 250 ms gives the clearest slap. It costs one more wind-up repeat and a faster curve. | Which length keeps the wind-up feeling like V3's. |
| Does the overload improve the ending? | It escalates in level, density and flux to the cut, without clipping or extra limiting. The cable and Beast trade the lead. | Whether it sounds excited or cluttered, and whether it still feels like CABLE//BEAST. |
| Does the cut land? | Exact digital silence from 27.600 s, with no click at the edge. | Whether it feels like an interruption at the peak, and whether losing V3's snap and reflections ending is worth it. |
| Is the earlier record hurt? | Before the gasp, all three match V3 stem for stem. At matched loudness the approach and payoff are within 0.7 dB of V3. | Nothing further expected; listen for it anyway. |

## Verification checklist

- [x] Version C verified as V3 by hash before any edit.
- [x] Renderer control: unchanged V3 renders bit-identically, as is and with its own levels
  pinned.
- [x] A, B and C match V3 stem for stem before the gasp edit (A bit-identical; B and C at
  24-bit quantisation).
- [x] Each master is exactly 1,234,800 frames; event map frame60 checked against DaemonV12
  `ticksToFrames` (0 mismatches).
- [x] All planned silences contain exactly zero samples after the de-click fades.
- [x] No click at any silence edge (fade-out step ratios ≤ 0.09; resume ratios within V3's own
  payoff attack).
- [x] Integrated loudness −14.0 LUFS for all four; true peak −1.4 dBTP; 0 full-scale samples.
- [x] Last four seconds analysed separately (0.5 s and 0.2 s windows: level, crest, onsets,
  centroid, flux, side/mid, master hold-back; cable and Beast balance per 0.25 s).
- [x] Determinism: second renders of A, B and C (masters and all stems) byte-identical.
- [x] V3 master and all earlier versions unchanged; nothing merged, published or replaced; no
  video built.
- [ ] Human listening.
