# STILL HERE L: LIFT (V1): sync points

Tempo map: 2 bars at 120 BPM, then 5 bars at 150 BPM (engine project: fixed 150 BPM in 2/4). Sample frames are DaemonV12's own tick → frame resolution (nearest frame, ties later);
the 60 fps frame is floor(sampleFrame × 60 / 44100). The file is 529200 frames (720 picture frames).

| Cue | Position | Tick | Sample frame | Seconds | 60 fps | What happens |
|---|---|---:|---:|---:|---:|---|
| spark (3 notes) | `1:1` | 0 | 0 | 0.000 | 0 | Heartbeat on B; bell E4-F#4-B4; 3+3+2 ticks |
| machine answers | `2:2+3/16` | 3600 | 66150 | 1.500 | 90 | Low cable pluck where the 4th note is missing |
| spark (4 notes) | `3:2` | 4800 | 88200 | 2.000 | 120 | E4-F#4-B4-C#5 |
| turbine + swell | `4:2+1/8` | 7200 | 132300 | 3.000 | 180 | Cable wound into B1, ticks ratchet, Bsus4 swell; no breath |
| IGNITION | `6:1` | 9600 | 176400 | 4.000 | 240 | Tempo 150: the spark completes on E5 as the harmony opens to Emaj9; bass, big kick, crash, arpeggio, broken beat |
| Lydian II | `8:1` | 13440 | 246960 | 5.600 | 336 | F#/E: A#5-G#5-F#5-E5 |
| the spark sung | `10:1` | 17280 | 317520 | 7.200 | 432 | E5-F#5-B5-C#6 over C#m9 -> Amaj9 |
| ASCENT | `12:1` | 21120 | 388080 | 8.800 | 528 | Rising bass A-B-C#-D#, four on the floor, snare roll |
| payoff pickup | `13:1` | 23040 | 423360 | 9.600 | 576 | The spark in diminution E5-F#5-B5-C#6 |
| SUMMIT | `14:1` | 24960 | 458640 | 10.400 | 624 | E6 (the spark completed an octave above ignition) over Eadd9; big kick, crash |
| heartbeat | `15:2` | 27840 | 511560 | 11.600 | 696 | The factory pulse returns under the ringing chord |
