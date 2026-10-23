# STILL HERE P: PROPULSION (CONTROL120): sync points

Tempo map: 2 bars at 120 BPM, then 4 bars at 120 BPM (engine project: fixed 120 BPM in 4/4). Sample frames are DaemonV12's own tick → frame resolution (nearest frame, ties later);
the 60 fps frame is floor(sampleFrame × 60 / 44100). The file is 529200 frames (720 picture frames).

| Cue | Position | Tick | Sample frame | Seconds | 60 fps | What happens |
|---|---|---:|---:|---:|---:|---|
| statement (dormant) | `1:1` | 0 | 0 | 0.000 | 0 | 3+3+2 ticks at full strength; heartbeat; dark synth bass A1-E2-A2 under the cable |
| robot answer | `1:3` | 1920 | 44100 | 1.000 | 60 | Blips C#5-E5-F#5 |
| statement (waking) | `2:1` | 3840 | 88200 | 2.000 | 120 | Brighter bass statement |
| turbine | `2:3` | 5760 | 132300 | 3.000 | 180 | The heartbeat hands over to the turbine: cable wound into A1; ticks ratchet with it |
| breath | `2:4+3/16` | 7440 | 170888 | 3.875 | 232 | Exact silence until ignition |
| IGNITION | `3:1` | 7680 | 176400 | 4.000 | 240 | Tempo stays 120: the call tutti in D, the lead D5-A5-D6 above bass and stabs, big kick, crash; four on the floor |
| first answer | `3:3` | 9600 | 220500 | 5.000 | 300 | Lead F#5-A5-B5 |
| IV | `4:1` | 11520 | 264600 | 6.000 | 360 | G: call G, answer B5-A5-G5; the arpeggio enters |
| climb | `5:1` | 15360 | 352800 | 8.000 | 480 | bVI-bVII (Bb, C): bass and lead in rhythmic unison; snare roll |
| BREAKTHROUGH | `6:1` | 19200 | 441000 | 10.000 | 600 | D: the band hits the 3+3+2 together (kick, clap, stab, bass) under the lead F#5-A5-B5; hats and arpeggio keep running |
| completion | `6:3` | 21120 | 485100 | 11.000 | 660 | B5 -> D6 (6 -> 8): final hit, D stab, crash |
| lock | `6:4` | 22080 | 507150 | 11.500 | 690 | The heartbeat locks; ring-out to 12.0 s |
