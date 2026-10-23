# STILL HERE P: PROPULSION (V2): sync points

Tempo map: 2 bars at 120 BPM, then 5 bars at 150 BPM (engine project: fixed 150 BPM in 2/4). Sample frames are DaemonV12's own tick → frame resolution (nearest frame, ties later);
the 60 fps frame is floor(sampleFrame × 60 / 44100). The file is 529200 frames (720 picture frames).

| Cue | Position | Tick | Sample frame | Seconds | 60 fps | What happens |
|---|---|---:|---:|---:|---:|---|
| statement (dormant) | `1:1` | 0 | 0 | 0.000 | 0 | 3+3+2 ticks at full strength; heartbeat; dark synth bass A1-E2-A2 under the cable |
| robot answer | `2:1+1/8` | 2400 | 44100 | 1.000 | 60 | Blips C#5-E5-F#5 |
| statement (waking) | `3:2` | 4800 | 88200 | 2.000 | 120 | Brighter bass statement |
| turbine | `4:2+1/8` | 7200 | 132300 | 3.000 | 180 | The heartbeat hands over to the turbine: cable wound into A1; ticks ratchet with it |
| breath | `5:2+11/64` | 9300 | 170888 | 3.875 | 232 | Exact silence until ignition |
| IGNITION | `6:1` | 9600 | 176400 | 4.000 | 240 | Tempo 150: the call tutti in D, the lead D5-A5-D6 above bass and stabs, big kick, crash; four on the floor |
| first answer | `7:1` | 11520 | 211680 | 4.800 | 288 | Lead F#5-A5-B5 |
| hook again | `8:1` | 13440 | 246960 | 5.600 | 336 | Call; answer climbs to C#6 |
| IV | `10:1` | 17280 | 317520 | 7.200 | 432 | G: call G, answer B5-A5-G5; the arpeggio enters |
| climb | `12:1` | 21120 | 388080 | 8.800 | 528 | bVI-bVII (Bb, C): bass and lead in rhythmic unison; snare roll |
| BREAKTHROUGH | `14:1` | 24960 | 458640 | 10.400 | 624 | D: the band hits the 3+3+2 together (kick, clap, stab, bass) under the lead F#5-A5-B5; hats and arpeggio keep running |
| completion | `15:1` | 26880 | 493920 | 11.200 | 672 | B5 -> D6 (6 -> 8): final hit, D stab, crash |
| lock | `15:2` | 27840 | 511560 | 11.600 | 696 | The heartbeat locks; ring-out to 12.0 s |
