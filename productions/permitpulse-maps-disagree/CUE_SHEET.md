# Cue sheet / timing map: THE MAPS DISAGREE (V3)

All times are picture seconds. Every audio onset is placed on the DaemonV12 tick grid
(1 tick = 1/1920 s), and each sync event below lands on exactly the engine sample frame
shown (verified against the rendered manifest's trigger frames, 0.000 ms error).
Machine-readable versions: `delivery/PermitPulse_TheMapsDisagree_V3_events-60fps.json`
(DaemonV12 event map, 44.1 kHz, 60 fps) and `delivery/PermitPulse_TheMapsDisagree_V3_cue-sheet.csv`
(adds 48 kHz sample positions and proxy 30 fps frames).

Picture events marked *(proxy)* were measured on the 30 fps proxy by frame
differencing. The proxy's 30 fps frame numbers match the 60 fps cue list exactly
(cut = proxy frame 410 = final frame 820). Where the proxy shows a storyboard hold
(unit landing, plate seating, amber trace animation), the score follows the
brief's timestamps.

## Tempo map (musical beats → picture)

| Span | Tempo | Purpose |
|---|---|---|
| 0.000 – 9.000 | 75 BPM (0.8 s beat, 16th = 0.2 s) | Resting heartbeat. 1.600 = beat 3, 3.200 = bar 2, 6.800 = off-beat (Map B arrives out of phase) |
| 9.000 – 11.004 | accelerando 75 → 90.1 BPM | Matches the camera move's measured acceleration (9.0–11.0) |
| 11.004 – 13.667 | 90.1 BPM | The cut falls exactly on beat 18 |
| 13.667 – 15.000 | 90 BPM (2 beats) | Paper settles; motif made clean |
| 15.000 – 21.000 | 100 BPM | Research pulse: 15.0, 17.4 and 21.0 all fall on beats |
| 21.000 – 28.000 | free (picture seconds) | Brand: NE-ver-GUESS at 0.25 s spacing, CTA lub-dub 0.2 s apart |

## Event map

| Time | 60 fps frame | Picture | Music / sound design |
|---|---|---|---|
| 0.000 | 0 | Film begins | Heartbeat LUB (D) + sub + glass **D**; glint. Hook motif D–E–A at 0.0 / 0.2 / 0.4 |
| 0.200 | 12 | ABOUT TO COMMIT? *(proxy)* | Heartbeat DUB + glass **E** |
| 1.600 | 96 | Proposed rear unit lands | Tabletop *thock* (D-tuned body) + LUB + glass **F#** completes the motif; glint |
| 3.100 | 186 | Source A map seats | Glass plate seat (A-tuned ring); glint. Bass ground enters |
| 3.200 | 192 | (LOOKS CLEAR. at 3.7 *(proxy)*) | Map A restates D–E–A with D add9 harmony and escapement ticks; F# at 4.8 |
| 5.500 | 330 | Source B begins its reveal | Acrylic slide (pans right→centre, crescendo); bass **glides D→Bb** across 5.5–6.8 |
| 6.800 | 408 | Maps disagree (B boundary lands on the unit) | Map B arrives off the beat: metal **D + F** against ringing glass F#, Bb heartbeat, darker plate seat, Bbmaj7 chord with no bloom, ratchet starts (3 against 4); F/C glint |
| 7.200 | 432 | THE MAPS DISAGREE. (7.10–7.23 *(proxy)*) | Map B's long note A lands on the title |
| 7.500–9.000 | 450–540 | Amber disputed-boundary trace | Amber tone glides **F# → F** (the disputed semitone) over 1.5 s |
| 8.000 / 8.600 | 480 / 516 | — | A answers F#; B answers F |
| 9.000 | 540 | Camera move begins | Bass ostinato starts; tempo accelerates to 90 BPM by 11.0; D/F#/Bb conflict chord swells |
| 9.0–13.667 | 540–820 | Continuous camera move | A and B motifs in canon at the eighth, rising an octave; final beat is an F#/F trill; bass in 16ths, ratchet in triplets against 16th ticks |
| **13.667** | **820** | **HARD EDITORIAL EVIDENCE CUT** | Every conflicting layer stops on the frame (gates, 8–12 ms releases). Paper snap, glint, D1 sub, open-fifth pad; the motif in a clean bell: D (13.667) E (14.0) A (14.333) |
| 15.000 | 900 | Research brief established / EVERY FINDING CITED. | Bell resolves to the octave D; soft 100 BPM clock begins; glint |
| 15.6 / 16.2 / 16.8 | 936 / 972 / 1008 | Cited findings | Three tiny pings (A–E–D, the motif in retrograde) |
| 17.400 | 1044 | Cut to the 02 FIRE-HAZARD ZONE card *(proxy)* | Map B's chord returns consonant: Bbmaj9 over Bb; paper tick; Bb heartbeat |
| 18.100 | 1086 | KNOW WHAT TO VERIFY FIRST. + amber underline *(proxy)* | Amber holds the question tone **E** (#11 over Bb) |
| 19.800 | 1188 | — | Gm6 over G: minor-plagal approach to D |
| 19.900–21.000 | 1194–1260 | Title off at 20.9 *(proxy)* | One reversed-glass inhale ending on the brand cut |
| **21.000** | **1260** | Paper → brand resolution | Silence below the bass; amber line rises **D→A** with the picture's rising line; motif **NE** (D) |
| 21.250 | 1275 | — | **ver** (E) |
| **21.500** | **1290** | **NEVER GUESS.** | **GUESS** (A) in glass + bell an octave up, LUB-DUB, D2 bass, D1 sub, D 6/9 spread over three octaves; strongest glint |
| **23.600** | **1416** | **HAVE A PROPERTY? SEND IT.** | LUB + glass/bell **F#**: the answer tone, withheld since the maps disagreed |
| **23.800** | **1428** | **GETPERMITPULSE.COM** | DUB + bell **D6** (tonic) + A glint: the sonic signature closes |
| 24.400 | 1464 | Small disclaimer line *(proxy)* | — (left clear) |
| 25.600 / 25.800 | 1536 / 1548 | — | Distant final lub-dub (replay rhyme with frame 0) |
| 26.600–27.950 | 1596–1677 | — | All sustains fade to −60 dB; last 50 ms below −48 dBFS |
| 28.000 | 1680 | End | Container ends at exactly 28.000 s (1,234,800 @ 44.1 kHz / 1,344,000 @ 48 kHz) |
