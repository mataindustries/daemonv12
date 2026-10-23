# STILL HERE V3 — what was kept, what was dropped, two new candidates

This file records the decisions behind P and L.

- **What the decisions rest on:** your listening feedback on A and B, and an inspection of
  their scores and measurements.
- **What this file is not:** a listening report. Nobody here has heard any of the audio.

## The feedback, read as instructions

| You said | So V3… |
|---|---|
| A's opening was the favourite | keeps its rhythm, precision, tension and turbine, in both candidates |
| B's ignition at 4 s was much more powerful | copies B's measured recipe: a sustained melodic arrival on the downbeat, with full harmony and low end, after a build about 11 dB quieter |
| Both contain ideas worth developing | recomposes A's call/answer (P) and B's spark (L) for new instruments; no audio is spliced |
| Neither palette sounded right | replaces both palettes and does not polish the old instruments |
| Neither tempo felt ideal | uses 120 → 150 BPM (A was 120; B was 180 with a half-time feel) |
| The groove needs more exciting movement | gives both a 150 BPM groove with 16th motion, a syncopated bass and a melodic hook |

## A and B, ingredient by ingredient

| Ingredient | From | Decision | Where it went |
|---|---|---|---|
| 3+3+2 precision ticks (MORPH cable ticks) | A | **kept** | P: the spine of the piece. L: the factory under the spark. |
| Press heartbeat, once per second | A (press), B (machine) | **kept, rebuilt** | A low-passed electronic kick inside the MORPH press clank, tuned to the pedal note. |
| Turbine: the cable wound from eighth notes into pitch, with a ratchet | A | **kept** | P: into A1, then the breath. L: into B1, straight into ignition. |
| The breath: exact silence 3.875–4.000 s | A | **kept in P only** | L tests the opposite: no breath; the harmony opens instead. |
| Call 1–5–8 / answer 3–5–6, and the 6 → 8 completion | A | **kept as P's hook** | Recomposed in D: call D–A–D, answer F♯–A–B, completion B5 → D6. |
| The spark 1–2–5–6 (→ 8) | B | **kept as L's hook** | Recomposed in E: E–F♯–B–C♯ → E. |
| Lydian II, the "wonder chord" | B | **kept** | L, bar 4: F♯/E. |
| The hook completed an octave higher as the summit | B | **kept** | L: E6 at 10.4 s. P: the answer finally reaches the call's D6 at 11.2 s. |
| Talkbox lead | A | dropped | Part of the rejected palette. |
| Glottal voice and choir | B | dropped | "Thin artificial high vocals", "overbearing choir pads". |
| Music box, glass tines | B, A | dropped | "Childish music-box timbres". L's pre-ignition spark uses a warm, low triangle bell (E4–C♯5). |
| Steel-plate crash, cable toms | A, B | dropped | Replaced by an electronic crash and a snare roll. |
| Tempo String as the bass | A | dropped as the bass | Kept only as industrial colour: P's cable statements, both turbines, L's machine answer. |
| Saw-ensemble brass stab | A | dropped | Trailer brass. P uses a short synth chord stab instead. |

## The palette (`src/synths.mjs`)

Small, classic subtractive voices, built from the existing MORPH DSP primitives. This is not
a new synthesis project.

| Part | Sound |
|---|---|
| Drums | Swept-sine kick with a beater click (so phones hear it); a clap layered on an electronic snare; metallic 808-style hats; shaker; electronic crash |
| Bass | Warm and punchy: saw + square + sine through a 24 dB low-pass with its own envelope, lightly driven, mono |
| P lead | Resonant square/saw pluck with a small pitch blip |
| L lead | Soaring: two detuned saws and a sub-octave pulse, legato glides, delayed vibrato, light ensemble |
| Arpeggio | Pulse/saw pluck in 16ths, accented in 3+3+2 |
| Harmony | Warm polysynth pad. P also has short saw chord stabs. |
| Industrial (MORPH, restrained) | Press clank inside the heartbeat, cable ticks, cable turbine. P: quiet cable statements under the intro bass. L: the cable's answer at 1.5 s. |

## Tempo

Both candidates run two bars at 120 BPM, then five at 150 BPM. Ignition is at 4.000 s,
frame 176,400. The conversion and its limits are in [TEMPO-MAP.md](TEMPO-MAP.md).

## P — PROPULSION (D major)

*An irresistible groove.* A short call-and-answer motif drives the piece forward, and the
ending builds rhythmically and harmonically.

| Time | What happens |
|---|---|
| 0–4 s (120) | A's factory on an A pedal: heartbeat, 3+3+2 ticks, a dark synth-bass statement A–E–A with the cable inside it. Robot blips answer C♯–E–F♯ (the answer's shape). Then the waking statement, the turbine into A1, and the breath. |
| **4.000 s** | 150 BPM. The call in D, tutti: bass D–A–D, lead, stabs, big kick, crash. Four on the floor starts. |
| 4.0–7.2 s | Hook twice. The machine calls 1–5–8; the lead answers F♯–A–B (3–5–6). Both are in 3+3+2. The second answer reaches C♯6. |
| 7.2–8.8 s | IV (G). The arpeggio enters. |
| 8.8–10.4 s | ♭VI–♭VII (B♭, C): bass and lead in rhythmic unison, snare roll. |
| 10.4–12 s | D. The answer F♯–A–B completes to **D6 at 11.2 s** (6 → 8): final hit and crash. The heartbeat "locks" at 11.6 s. |

## L — LIFT (E major)

*Melodic beauty and uplift.* The same tempo map and ignition frame as P, with a different
hook, harmony, drum pattern and lead. L also takes the opposite approach before ignition (no
breath).

| Time | What happens |
|---|---|
| 0–4 s (120) | Heartbeat on a B pedal. The spark grows in the bell: E–F♯–B, and the machine answers at 1.5 s where the fourth note is missing. Then E–F♯–B–C♯. At 3 s the turbine winds into B1 under a Bsus4 swell, with no breath. |
| **4.000 s** | 150 BPM. The spark completes on **E5** as the harmony opens from Bsus4 to **Emaj9**. Bass, big kick, crash, arpeggio and a broken beat: kick on 1, the "a" of 2 and the "and" of 3. |
| 4.0–7.2 s | The lead sings E5–F♯5–G♯5–B5, then the Lydian answer A♯5–G♯5–F♯5–E5 over F♯/E. |
| 7.2–8.8 s | The spark, sung: E5–F♯5–B5–C♯6 over C♯m9 → Amaj9. |
| 8.8–10.4 s | Rising bass A–B–C♯–D♯, four on the floor, snare roll. The spark in diminution. |
| 10.4–12 s | **E6 over Eadd9**: the spark completed an octave above ignition, with big kick and crash. The heartbeat returns at 11.6 s under the ringing chord. |
