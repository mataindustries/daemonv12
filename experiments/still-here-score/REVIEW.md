# STILL HERE — review log: V1 critique, one revision, V2 results

**Nobody has listened to these renders.** This environment cannot perceive audio. The
evidence below comes in three kinds, labelled where it is used:

- **Score:** inspection of the notes and arrangement as written.
- **Measured:** DaemonV12 `analyze`, the Composer skill's `review-sections.mjs`, FFmpeg
  `loudnorm`/`ebur128`, and `analysis/stems.py` (stem balance, hook presence, kick-over-sub at
  the engine's own trigger frames, phone and mono proxies).
- **Visual proxy:** spectrograms (`*/v*/*.spectrogram.png`).

A measurement can catch masking, overload or a flat arc. It cannot say whether a hook is
memorable or a groove makes someone want to replay it; the human checkpoint decides that.

**Workflow:**

- **The brief's process:** V1, three weaknesses, one revision (V2), stop for human listening.
- **Omitted:** the Composer skill's usual V3 and Risk Pass. These steps were omitted at the
  brief's request, not judged unnecessary.

## V1 at a glance (measured; masters matched to −14.0 LUFS on DaemonV12's meter)

| | A — PRECISION IGNITION V1 | B — THE HUMAN SPARK V1 |
|---|---:|---:|
| Frames / ignition frame | 529,200 / 176,400 | 529,200 / 176,400 |
| Integrated loudness / true peak | −14.0 LUFS / −1.3 dBTP | −14.0 LUFS / −2.8 dBTP |
| Engine master before the external stage | −17.0 LUFS (limiter max 1.8 dB) | −13.2 LUFS (no limiting) |
| Track or master overload | 0 clipped samples | 0 clipped samples |
| RMS before ignition → first 0.5 s after | −21.0 → −17.8 dBFS (+3.2 dB) | −25.5 → −13.7 dBFS (+11.8 dB) |
| Kick over bass sub, first 50 ms (median / worst) | 16.6 / 6.6 dB | 4.7 / −0.2 dB |
| Side-energy share after ignition | 3–5 % | < 1 % |
| Transient activity after ignition (RMS rises/s) | 2–3.5 | 0–0.8 |
| Phone proxy (high-pass at 300 Hz), 0–1 s | −16.3 dB | −6.1 dB |

## A — PRECISION IGNITION: three weaknesses in V1

### A1. The answer, the hook's warm half, is masked at the 6-second checkpoint

**Where:** 5.0–6.0 s (first answer) and 7.0–8.0 s (second answer).

**Evidence.**
- **Measured — presence margin:** in 300 Hz–4 kHz, the talkbox stands over everything else
  by different amounts per note:

  | Answer | Note 1 | Note 2 | Note 3 |
  |---|---:|---:|---:|
  | First | 22.7 dB | 6.6 dB | **2.9 dB** |
  | Second | 23.0 dB | 6.6 dB | 5.8 dB |

  Note 3 of the first answer is the F♯4, the open sixth that defines the answer.
- **Measured — level:** the lead stem averages −28 dBFS over 4–6 s, against −22 for the kick
  and −23 for the bass sub. Later in the piece it reaches −19.
- **Score:** two parts land on the F♯4 at pos 46 (5.75 s):
  - the D-push stab (D3–F♯4, the same register);
  - the bass ghost and pickup (pos 46–47).

**Cause:** arrangement collisions on the resolution note, and a lead that enters too low.

**Intended change:**
- Clear pos 46 and pos 62.
- Move the chord change to the downbeat.
- Let the sixth ring.
- Raise the first answers.

### A2. The first second has no midrange identity

**Where:** 0–1 s and 2–3 s.

**Evidence.**
- **Measured — phone proxy:** high-passing at 300 Hz costs 16.3 dB in 0–1 s and 12.7 dB in
  2–3 s; in the groove it costs 5–7 dB.
- **Measured — bands, 0–1 s:** mid −47.7 and upper-mid −51.6 dBFS, against sub −23.2.
- **Measured — ticks:** the stem sits at −54 dBFS before ignition.
- **Visual proxy:** the opening statement shows as low harmonic stacks only.

**Cause:**
- The dormant statement is played too muted: loss cut-off 2.6 kHz, palm-mute factor 0.55.
- The precision ticks were mixed almost out.

The hook's rhythm and the cable's metallic character, the "identity in two seconds", are
therefore carried only by sub thumps that a phone cannot play.

**Intended change:**
- Keep the statement dark but physical: slap chirps, a brighter loss filter.
- Bring the 3+3+2 ticks up so the rhythm reads.

### A3. Ignition is clean but not "huge"

**Where:** 4.000–4.5 s.

**Evidence.**
- **Measured — level:** RMS rises only 3.2 dB over the spool; upper-mid rises 5 dB.
- **Measured — balance:** in the first 0.5 s every part sits at a similar level. The crash
  plate is the quietest.

  | Kick | Bass | Brass stab | Crash plate |
  |---:|---:|---:|---:|
  | −22 | −26 | −28 | −31 |

- **Measured — width:** side energy is 10.6 % at the hit and falls to 3–5 %.
- **Score:** the high register stays empty until the arpeggio enters at 6.0 s.

**Cause:** the impact is built from equal parts, with nothing above the voice until bar 4.

**Intended change:**
- Give the crash its own, louder track.
- Start the precision arpeggio *at* ignition: register expansion and immediate motion.
- Widen the groove's top.

## B — THE HUMAN SPARK: three weaknesses in V1

### B1. The low end is a wall: the warm sub buries the kick

**Where:** 4–12 s.

**Evidence.**
- **Measured — the sub dominates:** the bass-sub stem is the loudest track, at −12 to
  −16 dBFS. The kick is at −18 to −23.
- **Measured — kick over sub:** the kick leads the bass sub by a median of 4.7 dB in its
  first 50 ms. The worst cases are −0.2 dB (7.83 s), 0.9 dB (4.83 s) and 1.2 dB (10.5 s).
  A's median is 16.6 dB.
- **Measured — spectral tilt:** in the master the sub band is −16 dBFS, against −37 to −40
  in 2–6 kHz.
- **Visual proxy:** the spectrogram shows a solid block below 100 Hz, and the 10 ms envelope
  is a flat plateau.

**Cause:**
- Legato bass notes are held for 92 % of their length.
- The sine fundamental is mixed at −6 dB.
- The duck is only 9 dB.

**Intended change:**
- Phrase the bass with real rests.
- Move its identity into the harmonics and the cable attack.
- Turn the sub down and duck it deeper.

### B2. After ignition the groove doesn't drive

**Where:** 4–10 s.

**Evidence.**
- **Measured — activity:** the transient proxy reads 0–0.8 rises/s after ignition, against
  2–3.5 for A.
- **Measured — drum levels:** snare −35 dBFS, ticks −44.
- **Score:** one backbeat per 1.33 s bar (half-time) until 8.0 s.

**Cause:** the drums sit far under the sustained voice, choir and bass, and the half-time
pattern gives few accents. This is the "too slow after activation" failure the brief warns
about.

**Intended change:**
- Bring the drums forward.
- Change gear earlier: double-time backbeat from 6.67 s.
- Keep ignition and the Lydian answer broad.

### B3. The breakthrough is not the summit

**Where:** 9.33–10.67 s.

**Evidence.**
- **Score — the melodic arc:** the voice's highest notes are F♯5, in bar 6 and twice in the
  ascent. The payoff then restarts the spark on D4, a ninth below the ascent's last note, and
  peaks on D5.
- **Measured — level:** the voice rises only 1 dB from ascent to payoff (−17 → −16), and the
  master 0.8 dB.
- **Measured — top line:** the music box doubling two octaves up sits at −27 dBFS.

**Cause:** the payoff was written in the hum's octave so it could land on D5.

**Intended change:**
- Let the voice sing the spark from A4 up to **A5**, the highest note of the piece, while the
  choir sings the original spark beneath it.
- Make the music-box top line audible.
- Measured voice spectra at D5–A5 show a clean, fundamental-led tone with no artefacts.

**Also noted for B (secondary, measured):** the image is close to mono, with side energy under
1 %; the choir is panned but quiet. The voice carries little 1–4 kHz energy, at −16 to −18 dB
relative to its total.

## The one revision per concept

Each V2 is one revision with one purpose. Its edits are gated by version in
`scores/a.mjs` and `scores/b.mjs`, so V1 still renders bit-identically from the same source.

### A V2 — make the hook and the ignition read

**Hypothesis:** the idea is worth remembering at 6 s only if all six notes of the hook are
heard; ignition is unmistakable only if it opens the top of the spectrum, not only the low
end.

**Edits:**

| Weakness | Edit |
|---|---|
| A1, the answer | Remove the D-push stab and both bass ghosts under the answer's last note; the D chord now lands on the downbeat of bar 4. |
| | The answer's last note rings 0.45 s instead of 0.32 s, over the bar line. |
| | Lead +3.5 dB for the first two answers, +2 dB after. |
| A2, the intro | The dormant statement is slapped (zap chirps) with a brighter, less muted cable: loss cut-off 4.2 / 4.8 kHz, mute factor 0.8 / 0.9. |
| | The 3+3+2 ticks play at full velocity before ignition, track +3 dB. |
| A3, ignition | The crash plate gets its own track (+6 dB). |
| | The cable-pluck arpeggio enters *at* ignition, on the hook's accents only, filling 16ths from 6.0 s. |
| | Arpeggio, glass and ticks are spread wider. |

**Result (measured):**

| | V1 | V2 | Read |
|---|---:|---:|---|
| Answer note 3 (F♯4) presence margin, first answer | 2.9 dB | **7.4 dB** | answer clear |
| Answer note 2 margin, first and second answers | 6.6 / 6.6 dB | **10.0 / 10.1 dB** | answer clear |
| Lead stem, 4–6 s | −28 dBFS | **−25 dBFS** | louder first entrance |
| Mid / upper-mid, 0–1 s | −47.7 / −51.6 dBFS | **−38.9 / −42.4 dBFS** | the opening has midrange |
| Phone proxy, 0–1 s | −16.3 dB | **−12.6 dB** | better, still sub-led |
| Crash at ignition (stem) | −31 dBFS | **−25 dBFS** | crash now readable |
| Top band at ignition / side energy | −32.6 dBFS / 10.6 % | **−29.4 dBFS / 14.2 %** | brighter, wider hit |
| RMS step, spool → ignition | +3.3 dB | +3.9 dB | small; the 121 ms of exact silence carries the contrast |
| Kick over sub (median / worst) | 16.6 / 6.6 dB | 15.1 / 5.8 dB | unchanged hierarchy |

- **Hook list:** the −9.6 dB entry (6.35–6.60 s) is the F♯4's intended ring-over tail,
  sounding under the next bass statement. It is not a masked note.

**Still open for listening:**

- **The opening:** the first second still loses 12.6 dB on the phone proxy. Its identity is
  now in the chirps and ticks, but the press and the cable's fundamentals still dominate the
  energy.
- **The arpeggio:** in bar 3 it is quiet (−50 dBFS). It may read only as sparkle, not as
  "register expansion".

### B V2 — let the groove drive and the spark lift

**Hypothesis:** B's warmth reads as weight only if the kick and snare can speak; the
breakthrough must be the melodic summit.

**Edits:**

| Weakness | Edit |
|---|---|
| B1, low end | Bass notes play 62 % of their written length; the final D2 still rings. |
| | Sub −4 dB, ducked 14 dB (was 9 dB) over 0.17 s. |
| | Bass body +2 dB; cable chirp layer +4 dB. |
| B2, drive | Snare +5 dB, ticks +6 dB, kick +1 dB. |
| | The drums change into double-time at **6.67 s** (bar 6) instead of 8.0 s; ignition and the Lydian answer stay half-time. |
| B3, summit | The payoff voice sings the spark **from A4 to A5**: A4–B4–E5–F♯5 → **A5** on the last bar line. A5 is the highest note of the piece. |
| | Beneath it, two choir voices sing the original D4–E4–A4–B4 and the third sings a fourth below. Under the A5 they hold D major (D5, F♯4, A3). |
| | Music-box top line +2 dB; 2.8 kHz presence (+4 dB) on the voice; voice track +3 dB. |
| Secondary, width | Choir panned ±0.8 and normalised jointly; V1 normalised L and R separately, which skewed its balance. Room +2 dB. |

**Fix made during the revision (logged, not a new idea):** the first V2 render put the A5
**5.4 dB under V1's D5**. The pressed phonation used for brightness (tenseness 0.72) narrows
the model's glottal open quotient and lowers its output. The payoff velocities were
compensated (1.25, and 1.8 on the A5), and the choir's unison was lowered under it. The voice
track then needed +3 dB to restore the hook margins against the louder drums.

**Result (measured):**

| | V1 | V2 | Read |
|---|---:|---:|---|
| Kick over bass sub, median / worst | 4.7 / −0.2 dB | **9.75 / 3.3 dB** | the kick speaks |
| Bass-sub stem, statement | −15 dBFS | **−22 dBFS** | — |
| Upper-mid, 4–12 s by section | −37 to −40 dBFS | **−30 to −36 dBFS** | tilt reduced 3–9 dB |
| Phone proxy, after ignition | −4.4 to −8.1 dB | **−2.7 to −5.0 dB** | better on small speakers |
| Hook presence (statement / answer / payoff) | 7.8 / 6.8 / 8.2 dB | 7.6 / 6.0 / 6.6 dB | held while drums rose 5 dB |
| Summit note | D5 (587 Hz) | **A5 (880 Hz)**, voice stem level as the cry | the payoff now peaks highest |
| Upper-mid in the final second | −39.1 dBFS | **−30.1 dBFS** | brightest moment of the piece |
| Side energy after ignition | 0.4–1.9 % | 1.2–3.6 % | wider, still narrow |
| Transient-activity proxy | 0–0.8 rises/s | 0–0.8 rises/s | **unchanged** |
| Ignition step (hum → first 0.5 s) | +11.7 dB | +10.9 dB | — |

**Still open for listening:**

- **Drive (B2):** only partly addressed. The drums are 5 dB louder and change gear earlier,
  but the transient proxy did not move. The voice, choir and bass are sustained, so the
  groove may still feel smooth rather than punchy. This is the most important question for B.
- **Width:** the image is still narrow.
- **Intro:** before ignition B stays about 11 dB below its groove. That is the concept
  (fragile → full), but it may read as too quiet on a phone.
- **Summit timbre:** whether the A5 sounds like a soaring human voice or a thin whistle.

## Both V2s, side by side (matched loudness)

| | A V2 | B V2 |
|---|---:|---:|
| Frames / 60 fps frames | 529,200 / 720 | 529,200 / 720 |
| Ignition | frame 176,400 / picture 240 | frame 176,400 / picture 240 |
| Integrated loudness (DaemonV12 `analyze`) | −13.97 LUFS | −13.96 LUFS |
| Integrated loudness (FFmpeg ebur128) | −14.4 LUFS | −14.2 LUFS |
| True peak / sample peak | −1.24 dBTP / −1.51 dBFS | −1.91 dBTP / −1.91 dBFS |
| Loudness range | 7.6 LU | 10.4 LU |
| External limiter, maximum gain reduction | 1.53 dB | 0 dB (gain only) |
| Clipped samples (all engine tracks and master) / full-scale samples | 0 / 0 | 0 / 0 |
| Exact digital silence | frames 171,062–176,399 (the breath) | none |

## Decisions and deviations from THESIS.md

- **A, no hum before ignition:** the thesis had the voice hum its answer at 2.5 s. In V1 the
  bar was too full (statement, then the spool), so the warm voice first enters at 5.0 s.
  Before ignition, a glass "robot" plays the answer.
- **A, lock timing:** the servo lock sits at 11.875 s (`6:4+3/16`), not 11.75 s.
- **B, breakthrough voice:** in V2 the voice sings the spark transposed to A; the original
  D-shape is in the choir and the music box. See B3.

## Determinism (verified)

- **Engine:** re-rendering both V2 projects into a fresh directory gave byte-identical engine
  masters and all 15 + 12 stems.
- **Full pipeline:** rebuilding both V2s from source gave byte-identical files throughout:

  | Files | A | B |
  |---|---:|---:|
  | Synthesised assets | 55 | 49 |
  | Project | ✓ | ✓ |
  | Engine master and stems | ✓ | ✓ |
  | Delivered master WAV | ✓ | ✓ |
  | MP3 | ✓ | ✓ |

- **Runtime:** Node v22.22.0, FFmpeg 6.1.1, Linux x64.

## For the human checkpoint

These are questions; I have not chosen a winner.

1. **4 s:** in A, does the breath plus hit feel like ignition? In B, does the lock of the
   machine's 3 into the spark's 4 read as the moment the factory comes alive?
2. **6 s:** which hook is already in your head? A's "BWAM · DUN · POP | wa · ow · YEAH", or
   B's D–E–A–B (→ D′)?
3. **12 s:** does A's 6 → 8 resolution or B's A5 summit feel more inspiring? Does either end
   feel like a logo moment that invites replay?
4. **Phone versus headphones:** does A's opening or B's quiet intro disappear on a phone
   speaker?
5. **B's groove (B2):** does it drive, or does it still feel sustained?
