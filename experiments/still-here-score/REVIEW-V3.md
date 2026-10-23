# STILL HERE V3 — review log: P and L, V1 critique, one revision each, V2 results

**Nobody has listened to these renders.** This environment cannot perceive audio. The
evidence comes in three kinds, labelled where it is used:

- **Score:** the notes and arrangement as written.
- **Measured:** DaemonV12 `analyze`, the Composer skill's `review-sections.mjs`, and
  `analysis/stems.py` (stem balance, hook presence, kick over sub at the engine's own trigger
  frames, phone and mono proxies). Some figures were computed directly from the delivered
  masters: the ignition steps, the per-note margins and the 10 ms envelopes.
- **Visual proxy:** the spectrograms `*/*/still-here-*.spectrogram.png`.

A measurement can catch masking, a flat arc or a missing contrast. It cannot tell whether a
hook is memorable or a groove makes you move. Your listening decides that.

**Workflow:** V1 → the three weakest moments in each → one revision (V2) → loudness-matched
delivery → stop.

## V1 at a glance (measured; every master at −14.0 LUFS)

| | P V1 | L V1 | A V2 (reference) | B V2 (reference) |
|---|---:|---:|---:|---:|
| Build → ignition: RMS of 3.0–4.0 s against 4.0–4.5 s | +6.9 dB | +4.4 dB | +4.5 dB | **+10.9 dB** |
| The same step below 120 Hz (sub) | +5.8 dB | +4.7 dB | +5.9 dB | +10.6 dB |
| Precision ticks before ignition (stem) | −50.2 dBFS | −50.8 dBFS | −46.1 dBFS | — |
| Ticks relative to the intro's low end | −30 dB | −26 dB | −21 dB | — |
| Kick over bass sub, first 50 ms (median / worst) | 4.3 / −0.4 dB | 4.5 / 0.8 dB | 15.1 / 5.8 dB | 9.75 / 3.3 dB |
| Transient proxy, three bars after ignition (RMS rises/s) | 3.1 / 2.5 / 1.9 | 0 / 1.2 / 0.6 | — | — |

You praised B's ignition, and B's build was the quietest relative to its arrival. You
favoured A's opening, which kept its ticks only about 21 dB under its low end.

## P — PROPULSION: the three weakest moments in V1

### P1. The opening: the machine's precision sits under the synth bass

**Where:** 0–3 s.

**Evidence:**

- **Measured — balance:** the 3+3+2 ticks sit at −50.2 dBFS, **30 dB under** the dark synth
  bass statements (−20.3). In A V2's opening, the one you favoured, the ticks sat 21 dB under
  its sub. The cable statements, A's machine voice, are at −41.4.
- **Measured — top and translation:** the upper-mid band (2–6 kHz) reads −52.5 dBFS in
  0–1 s. The phone proxy (high-pass at 300 Hz) costs 14.0 dB.
- **Measured — level:** the intro sits close to the groove. The 10 ms envelope median in
  0–1 s is −19.2 dBFS, against −25.8 in A V2.
- **Score:** bar 1's ticks play at velocity 0.32–0.68.

**Cause:** the new warm bass took over the role of A's cable statement, and the precision was
mixed as background.

**Checked and not a weakness:** the lull at 1–2 s. A V2 has the same rest between the call
and the answer (340 ms under −45 dBFS; P V1: 240 ms).

### P2. Ignition is a rhythm hit, not a melodic arrival

**Where:** 4.0–4.6 s; also the IV downbeat at 7.2 s.

**Evidence:**

- **Measured — the call is buried:** the lead's presence over everything else in
  300 Hz–4 kHz, per note:

  | Call note | D4 | A4 | D5 |
  |---|---:|---:|---:|
  | Margin | **−1.7 dB** | **0.0 dB** | +2.4 dB |

  The answer's notes stand out by +7.7 to +10.3 dB.
- **Score:** the call doubled the bass two octaves up (D4–A4–D5), inside the pad (D3–F♯4)
  and the stab (A3–F♯4). The D stab doubles the D4 itself.
- **Measured — the arrival:** in 4.0–4.5 s the lead is at −22.5 dBFS, against −13.3 for the
  kick and −16.7 for the bass. B V2's ignition was led by its voice, the loudest stem
  (−12.5).
- **Measured — the build:** the step into ignition is +6.9 dB (B V2: +10.9). The loudest
  thing in the last second is the 3.0 s heartbeat thump (−21.8 dBFS stem), louder than the
  turbine (−26.0).
- **Measured — low end:** kick over bass sub is worst at **7.2 s, −0.4 dB**, where G2 lands
  under the IV downbeat's kick. The median is 4.3 dB.

**Cause:** B's recipe was followed by half. P had the full harmony and the low end, but no
melodic arrival and no quieter build.

### P3. The ending repeats instead of developing

**Where:** 10.4–12.0 s.

**Evidence:**

- **Score:** the last bar is hook 1 again: the same bass call, the answer, four on the floor
  and the backbeat. The development (the ♭VI–♭VII climb, the snare roll) ends before it.
- **Measured:** the transient proxy reads **0 rises/s** in 10.4–11.2 s (climb: 2.5). The RMS
  is only 0.3 dB above the climb.
- **Brief:** P's ending was asked to grow "through rhythmic and harmonic development".

## L — LIFT: the three weakest moments in V1

### L1. Ignition does not open: the low end is already there

**Where:** 3.0–4.0 s into 4.000 s.

**Evidence:**

- **Measured — the step:** the build-to-ignition step is **+4.4 dB** (P V1: +6.9; B V2:
  +10.9). The sub band rises only 4.7 dB.
- **Measured — the source:** two things fill the sub right up to the downbeat (−23.7 dBFS
  below 120 Hz):
  - the heartbeat at 3.0 s (−22.1 dBFS stem);
  - the turbine wound into B1 (−26.3), whose fundamental is 62 Hz.
- **Score:** L has no breath by design, so that the *harmony* opens at ignition instead
  (Bsus4 → Emaj9). Without a breath, something must arrive at 4.000 s that was not there
  before.

### L2. After ignition the groove does not drive

**Where:** 4.0–8.8 s.

**Evidence:**

- **Measured — transients:** the proxy reads **0 / 1.2 / 0.6 rises/s** in the three bars
  after ignition (P V1: 3.1 / 2.5 / 1.9).
- **Measured — the 16th motion is faint at ignition:** the arpeggio is at −37.2 dBFS (it
  ramps in over four bars) and the hats at −43.6. The legato lead (−17.8) and the pad
  (−26.8) fill the gaps.
- **Measured — low end:** kick over bass sub has a median of 4.5 dB. The worst cases are
  0.8 dB (10.2 s), 1.4 dB (7.8 s) and 2.2 dB (7.2 s). The broken-beat kick lands on bass
  notes.

### L3. The opening's machine is buried

**Where:** 0–2 s.

**Evidence:**

- **Measured — ticks:** −50.8 dBFS, 26 dB under the heartbeat.
- **Measured — the machine's answer:** at 1.5 s the cable slap, placed where the spark's
  fourth note is missing, sits at **−46.7 dBFS**, 23 dB under the heartbeat. The idea the
  cue sheet promises ("the machine answers") is not audible.
- **Measured — translation:** the phone proxy in 1–2 s costs 14.1 dB, the worst second in
  the piece.

## The one revision per candidate

Each V2 is one revision with one purpose. Its edits are gated by version flags in
`scores/p.mjs` and `scores/l.mjs`, so V1 still renders from the same source byte for byte
(checked: P 108 files, L 83 files).

### P V2 — "the 3+3+2 is the spine"

**Hypothesis:** P's identity is A's 3+3+2. If it is heard from the first second and played
by the whole band at ignition and at the end, the opening, the ignition and the finish
become one idea.

| Weakness | Edit |
|---|---|
| P1, the opening | Ticks at full strength in both intro bars (3+3+2 accents 1.0, others 0.45); tick track +6 dB. |
| | Synth-bass statements −3 dB; cable statements +4.7 dB. |
| P2, ignition | In the hook bars the call moves up an octave and goes legato: **D5–A5–D6**, above the pad and the stab. |
| | The answer F♯5–A5–B5 is unchanged, so the call's D6 becomes the note the answer finally reaches at 11.2 s. |
| | The D stab plays all three 3+3+2 hits of the call: bass, stab and lead together. |
| | At 3.0 s the heartbeat is replaced by its **press alone** (the clank, high-passed, no kick). The turbine's start keeps A's accent without the sub. The ticks run one eighth further (3.0 and 3.125 s). |
| | Bass ducked 10 dB under the kick (was 7). |
| P3, the ending | The last bar stops the four on the floor and the backbeat. Kick, clap, D stab, bass and lead hit the 3+3+2 together (10.4, 10.7, 11.0 s) into the final hit at 11.2 s. Hats and arpeggio keep running 16ths. |

**Fixes made during the revision (logged, not new ideas):**

1. **First render:** the ignition step barely moved (+7.1 dB). The 3.0 s heartbeat, then
   only shortened, still dominated the last second, so it was removed.
2. **Second render:** without the heartbeat, a near-silence of about 120 ms opened at
   3.05–3.17 s, the turbine's first round trip. A has no such gap; its press sits there. The
   press-only accent fills it.

**Result (measured):**

| | P V1 | P V2 | Read |
|---|---:|---:|---|
| Call notes at ignition, presence margin | −1.7 / 0.0 / +2.4 dB | **+4.6 / +4.7 / +3.5 dB** | the call now stands out |
| Second call | +1.0 / 0.0 / +3.2 dB | +4.4 / +4.6 / +4.1 dB | — |
| Lead stem at ignition | −22.5 dBFS | **−18.3 dBFS** | — |
| Mid band (0.5–2 kHz) at ignition | −27.5 dBFS | −21.7 dBFS | — |
| Build → ignition step | +6.9 dB | **+9.8 dB** | B V2: +10.9 |
| The same step below 120 Hz | +5.8 dB | **+15.2 dB** | the sub arrives at 4.000 s |
| Ticks before ignition (stem) | −50.2 dBFS | **−40.9 dBFS** | 17.5 dB under the bass (A V2: 21) |
| Upper-mid / phone proxy, 0–1 s | −52.5 dBFS / −14.0 dB | −44.9 dBFS / −13.0 dB | brighter, still sub-led |
| Kick over sub (median / worst) | 4.3 / −0.4 dB | **6.6 / 1.6 dB** | the IV downbeat kick speaks |
| Transient proxy, last bar | 0 rises/s | 2.5 rises/s | — |
| Loudness range / limiter maximum | 5.8 LU / 0.95 dB | 7.4 LU / 0.38 dB | more contrast |

**Still open for listening:**

- **The D6:** the call now touches D6 at 4.6 s and 6.2 s. Does that set up the completion at
  11.2 s, or take its surprise away?
- **The tutti ending:** the last bar trades the four on the floor for unison 3+3+2 hits. Is
  that a stronger landing, or does it lose drive?
- **The phone:** the opening still loses 13 dB on the phone proxy (A V2: 12.6). The low
  statements carry most of its energy.

### L V2 — "withhold, then open"

**Hypothesis:** the ignition opens the harmonic world only if the build gives something up
first. L keeps its no-breath design. Instead, the low end stays out of the build, so the sub,
the 16th motion and Emaj9 arrive together at 4.000 s.

| Weakness | Edit |
|---|---|
| L1, ignition | The turbine is high-passed at 150 Hz: its pitch stays in its harmonics, and the B1 fundamental waits for the downbeat. It is also 2 dB quieter (cable track −14 dB, was −12). |
| | No heartbeat at 3.0 s: the turbine takes over the pulse. |
| L2, drive | The arpeggio is at full strength from the ignition downbeat (no four-bar ramp). |
| | Hats +4 dB; bass ducked 11 dB under the kick (was 7). |
| L3, the machine | Ticks at full strength in both intro bars; tick track +6 dB. |
| | The machine's answer gets its own native one-shot track (`answer`): the same cable slap, high-passed at 140 Hz into the mids, about 11 dB louder. |

**Fix made during the revision (logged):** the first V2 render only shortened the 3.0 s
heartbeat to 0.125 s, and the sub in the last second fell just 1.5 dB. The delivered V2
removes that beat.

**Result (measured):**

| | L V1 | L V2 | Read |
|---|---:|---:|---|
| Build → ignition step | +4.4 dB | **+7.5 dB** | B V2: +10.9 |
| Sub in the last second / its step at ignition | −23.7 dBFS / +4.7 dB | **−42.4 dBFS / +23.2 dB** | the low end now arrives at 4.000 s |
| The machine's answer, 1–2 s (stem) | −46.7 dBFS | **−35.5 dBFS** | audible in the mids |
| Phone proxy, 1–2 s / 3–4 s | −14.1 / −3.9 dB | −9.6 / −0.7 dB | the build now lives in the mids |
| Ticks before ignition (stem) | −50.8 dBFS | −40.9 dBFS | — |
| Arpeggio / hats at ignition (stem) | −37.2 / −43.6 dBFS | −32.9 / −39.6 dBFS | the 16th motion starts on the downbeat |
| Kick over sub (median / worst) | 4.5 / 0.8 dB | **7.1 / 3.4 dB** | — |
| Transient proxy, three bars after ignition | 0 / 1.2 / 0.6 | 0 / 1.2 / 0.6 | **unchanged** |
| Side-energy share, 3–4 s | 17.7 % | 37.3 % | the mono sub left; the turbine, bell and room are wide |

**Still open for listening:**

- **Drive (L2):** the edits changed the balance, not the writing, and the transient proxy
  did not move. The legato lead and the pad still fill every gap. This is the most important
  question for L.
- **The ignition step:** +7.5 dB is still below B V2's +10.9. L keeps no breath; its
  contrast is in the low end (+23 dB below 120 Hz), not in overall level.
- **Width:** the build is now wider than the ignition (37 % against 17.5 % side share), the
  opposite of a narrow-to-wide opening. Worth a check on headphones.

## The fixed-120 control

**What it is:** P V2 at one native tempo, 120 BPM in 4/4, with no translation. It has the
same notes, sounds and mix. It has four bars after ignition instead of five; the second hook
bar is dropped.

**What it answers:** "does 150 BPM give better forward motion?" `p/v2` and `p/control120` are
identical until 4.000 s, so you can switch between them at the ignition.

| | P V2 (120 → 150) | Control (120 throughout) |
|---|---:|---:|
| Build → ignition step | +9.8 dB | +9.0 dB |
| Transient proxy per bar after ignition (rises/s) | 4.0 (first ½ s), 2.5, 1.9, 1.9, 2.5, 2.5 | 0 (first ½ s), 1.0, 1.5, 1.0, 2.0 |
| Kick over sub (median / worst) | 6.6 / 1.6 dB | 7.7 / 2.5 dB |
| Final hit | 11.200 s (493,920; picture 672) | 11.000 s (485,100; picture 660) |

## All deliverables (measured)

| | P V2 | L V2 | P control | P V1 | L V1 |
|---|---:|---:|---:|---:|---:|
| Frames / 60 fps frames | 529,200 / 720 | 529,200 / 720 | 529,200 / 720 | 529,200 / 720 | 529,200 / 720 |
| Ignition | 176,400 / picture 240 | same | same | same | same |
| Integrated loudness (DaemonV12 `analyze`) | −13.98 LUFS | −14.00 LUFS | −13.98 LUFS | −13.98 LUFS | −14.00 LUFS |
| Integrated loudness (FFmpeg ebur128) | −14.2 LUFS | −14.2 LUFS | −14.2 LUFS | −14.2 LUFS | −14.2 LUFS |
| True peak | −1.44 dBTP | −2.01 dBTP | −1.44 dBTP | −1.45 dBTP | −2.02 dBTP |
| Loudness range | 7.4 LU | 7.3 LU | 7.1 LU | 5.8 LU | 6.6 LU |
| External limiter, maximum reduction | 0.38 dB | 0 dB | 0.89 dB | 0.95 dB | 0 dB |
| Clipped samples (all engine tracks and master) | 0 | 0 | 0 | 0 | 0 |
| Exact digital silence | frames 171,062–176,399 (the breath) | none | the breath | the breath | none |

## Determinism (verified)

- **P and L V1:** both rebuilt byte-identically after the V2 edits were added. That covers
  every asset, project, engine render, master, MP3, cue sheet and event map: 108 files for P
  and 83 for L.
- **A and B:** V1 and V2 were rebuilt from this tree. All 276 hashes recorded in
  `MANIFEST.json` came back identical: assets, projects, engine masters, stems, masters and
  MP3s. The earlier music is unchanged.

## For the human checkpoint

These are questions; I have not picked a winner.

1. **The opening:** is it immediately interesting? Compare P (A's machine, with the ticks now
   forward) with L (the spark growing, with the machine answering it).
2. **Ignition:** which feels powerful, and does either match B's?
   - P: the breath, then the tutti call with D5 on the downbeat.
   - L: no breath; the low end and Emaj9 arrive at once.
3. **150 BPM:** compare P V2 with the control. They are the same until 4.000 s.
4. **The sounds:** are these the right family? The analog-style bass, P's pluck lead, L's
   soaring lead, the arpeggio and the electronic drums.
5. **The hook:** which is in your head afterwards? P's D–A–D | F♯–A–B (→ D), or L's E–F♯–B–C♯
   (→ E)?
6. **The payoff:** which inspires rather than sounds generic? P's tutti 3+3+2 into the D6 hit
   at 11.2 s, or L's E6 summit at 10.4 s?
