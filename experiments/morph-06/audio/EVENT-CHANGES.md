# MORPH//06: exact event changes against MORPH//05 V3

Every scheduled event that differs from V3, generated from the event maps the renders read.
Time = sampleFrame / 44100; f60 = floor(sampleFrame x 60 / 44100). Ratchet repeats, wind strikes and
cable ticks are counted rather than listed (their full lists are in each version's events.json).

## A

### Removed (in V3, not here): 18 events

- 7 x cable wind strike, 19.630-19.997 s
- 8 x ratchet repeat, 19.375-19.997 s

| Time (s) | Position | Sample | f60 | Part | Event | Pitch | Velocity | Detail |
|---:|---|---:|---:|---|---|---|---:|---|
| 19.0000 | 10.3.1 | 837900 | 1140 | beast | aah (wound up with the cable) | fry->E1 |  | until 10.4.4½ |
| 19.0000 | 10.3.1 | 837900 | 1140 | cable | WIND-UP |  |  | round trip shrinks to E1 by 11.1.1; re-struck every round trip |
| 19.0000 | 10.3.1 | 837900 | 1140 | ratchet | RATCHET (ks) |  |  | 9 repeats, one per cable round trip, until 11.1.1 |

### Added or changed (here, not in V3): 18 events

- 5 x cable wind strike, 19.602-19.849 s
- 6 x ratchet repeat, 19.375-19.849 s

| Time (s) | Position | Sample | f60 | Part | Event | Pitch | Velocity | Detail |
|---:|---|---:|---:|---|---|---|---:|---|
| 19.0000 | 10.3.1 | 837900 | 1140 | beast | aah (wound up with the cable) | fry->E1 |  | until 10.4.3½ |
| 19.0000 | 10.3.1 | 837900 | 1140 | cable | WIND-UP |  |  | round trip shrinks to E1 by 10.4.4; re-struck every round trip |
| 19.0000 | 10.3.1 | 837900 | 1140 | ratchet | RATCHET (ks) |  |  | 7 repeats, one per cable round trip, until 10.4.4 |
| 19.8750 | 10.4.4 | 876488 | 1192 | all | GASP: silence |  |  | every instrument and effect faded out over 4 ms (raised cosine) ending at 19.875 s; exactly zero from frame 876488 to 881999 |
| 19.8750 | 10.4.4 | 876488 | 1192 | cable | bowed |  |  | wind-up complete; held silent through the gasp |
| 19.8750 | 10.4.4 | 876488 | 1192 | cable | grab (hand stops the cable) |  |  | until 10.4.4½ |
| 19.8750 | 10.4.4 | 876488 | 1192 | section | The gasp |  |  | 125 ms of silence; the payoff stays on 20.000 s |

## B

### Removed (in V3, not here): 58 events

- 7 x cable wind strike, 19.630-19.997 s
- 8 x perc cable tick, 25.000-25.875 s
- 16 x ratchet repeat, 19.375-26.856 s

| Time (s) | Position | Sample | f60 | Part | Event | Pitch | Velocity | Detail |
|---:|---|---:|---:|---|---|---|---:|---|
| 19.0000 | 10.3.1 | 837900 | 1140 | beast | aah (wound up with the cable) | fry->E1 |  | until 10.4.4½ |
| 19.0000 | 10.3.1 | 837900 | 1140 | cable | WIND-UP |  |  | round trip shrinks to E1 by 11.1.1; re-struck every round trip |
| 19.0000 | 10.3.1 | 837900 | 1140 | ratchet | RATCHET (ks) |  |  | 9 repeats, one per cable round trip, until 11.1.1 |
| 25.5000 | 13.4.1 | 1124550 | 1530 | cable bass | pluck | B1 | 1 |  |
| 25.5000 | 13.4.1 | 1124550 | 1530 | snare | ghost snare |  | 0.15 |  |
| 25.5625 | 13.4.1½ | 1127306 | 1533 | snare | ghost snare |  | 0.18 |  |
| 25.6250 | 13.4.2 | 1130063 | 1537 | cable bass | pluck | A1 | 1 |  |
| 25.6250 | 13.4.2 | 1130063 | 1537 | snare | ghost snare |  | 0.22 |  |
| 25.6875 | 13.4.2½ | 1132819 | 1541 | snare | ghost snare |  | 0.26 |  |
| 25.7500 | 13.4.3 | 1135575 | 1545 | cable bass | pluck | G1 | 1 |  |
| 25.7500 | 13.4.3 | 1135575 | 1545 | kick | kick |  | 0.85 |  |
| 25.7500 | 13.4.3 | 1135575 | 1545 | snare | ghost snare |  | 0.3 |  |
| 25.8125 | 13.4.3½ | 1138331 | 1548 | cable bass | pluck | G1 | 1 |  |
| 25.8125 | 13.4.3½ | 1138331 | 1548 | snare | ghost snare |  | 0.35 |  |
| 25.8750 | 13.4.4 | 1141088 | 1552 | cable bass | pluck | A1 | 1 |  |
| 25.8750 | 13.4.4 | 1141088 | 1552 | snare | ghost snare |  | 0.4 |  |
| 25.9375 | 13.4.4½ | 1143844 | 1556 | cable bass | pluck | B1 | 1 |  |
| 25.9375 | 13.4.4½ | 1143844 | 1556 | snare | ghost snare |  | 0.45 |  |
| 26.0000 | 14.1.1 | 1146600 | 1560 | beast | WOM | E1 |  | ending: the hook, cut off |
| 26.0000 | 14.1.1 | 1146600 | 1560 | section | VII. The snap |  |  | the hook is cut off; reflections lead back to the opening |
| 26.2500 | 14.1.3 | 1157625 | 1575 | beast | ka | E1 |  | ending: the hook, cut off |
| 26.3750 | 14.1.4 | 1163138 | 1582 | beast | YOI | E2 |  | ending: the hook, cut off |
| 26.5000 | 14.2.1 | 1168650 | 1590 | cable | SNAP (crack) |  |  | tension collapses to a 500 ms round trip |
| 26.5000 | 14.2.1 | 1168650 | 1590 | cable partner | crack |  | 0.9 |  |
| 26.5000 | 14.2.1 | 1168650 | 1590 | ratchet | RATCHET (crack) |  |  | 8 repeats, one per cable round trip, until 14.3.1 |
| 26.5625 | 14.2.1½ | 1171406 | 1593 | beast | gasp |  |  |  |
| 27.9250 | 14.4.4 | 1231493 | 1675 | cable | grab (hand stops the cable) |  |  | until 15.1.3 |

### Added or changed (here, not in V3): 259 events

- 51 x cable wind strike, 19.602-27.596 s
- 42 x perc cable tick, 25.000-27.562 s
- 53 x ratchet repeat, 19.375-27.596 s

| Time (s) | Position | Sample | f60 | Part | Event | Pitch | Velocity | Detail |
|---:|---|---:|---:|---|---|---|---:|---|
| 19.0000 | 10.3.1 | 837900 | 1140 | beast | aah (wound up with the cable) | fry->E1 |  | until 10.4.3½ |
| 19.0000 | 10.3.1 | 837900 | 1140 | cable | WIND-UP |  |  | round trip shrinks to E1 by 10.4.4; re-struck every round trip |
| 19.0000 | 10.3.1 | 837900 | 1140 | ratchet | RATCHET (ks) |  |  | 7 repeats, one per cable round trip, until 10.4.4 |
| 19.8750 | 10.4.4 | 876488 | 1192 | all | GASP: silence |  |  | every instrument and effect faded out over 4 ms (raised cosine) ending at 19.875 s; exactly zero from frame 876488 to 881999 |
| 19.8750 | 10.4.4 | 876488 | 1192 | cable | bowed |  |  | wind-up complete; held silent through the gasp |
| 19.8750 | 10.4.4 | 876488 | 1192 | cable | grab (hand stops the cable) |  |  | until 10.4.4½ |
| 19.8750 | 10.4.4 | 876488 | 1192 | section | The gasp |  |  | 125 ms of silence; the payoff stays on 20.000 s |
| 25.1250 | 13.3.2 | 1108013 | 1507 | kick | kick |  | 0.8 |  |
| 25.3750 | 13.3.4 | 1119038 | 1522 | snare | ghost snare |  | 0.3 |  |
| 25.4375 | 13.3.4½ | 1121794 | 1526 | snare | ghost snare |  | 0.35 |  |
| 25.5000 | 13.4.1 | 1124550 | 1530 | beast | ya | E1 |  | overload: climbing with the 32nds |
| 25.5000 | 13.4.1 | 1124550 | 1530 | cable bass | slap | E1 | 1.3 | strike stretch 0.25 |
| 25.5000 | 13.4.1 | 1124550 | 1530 | cable partner | crack |  | 0.7 |  |
| 25.5000 | 13.4.1 | 1124550 | 1530 | kick | kick |  | 0.9 |  |
| 25.5000 | 13.4.1 | 1124550 | 1530 | section | Excitement |  |  | slap-pop pairs in 32nds climbing E-G-A-B; the Beast in triplets and chokes |
| 25.5000 | 13.4.1 | 1124550 | 1530 | snare | ghost snare |  | 0.25 |  |
| 25.5625 | 13.4.1½ | 1127306 | 1533 | cable bass | pluck | E1 | 1 | flageolet octave pop |
| 25.5625 | 13.4.1½ | 1127306 | 1533 | snare | ghost snare |  | 0.314 |  |
| 25.6250 | 13.4.2 | 1130063 | 1537 | cable bass | slap | G1 | 1.3 | strike stretch 0.25 |
| 25.6250 | 13.4.2 | 1130063 | 1537 | snare | ghost snare |  | 0.379 |  |
| 25.6667 | 13.4.2 | 1131900 | 1540 | beast | ya | G1 |  | overload: climbing with the 32nds |
| 25.6875 | 13.4.2½ | 1132819 | 1541 | cable bass | pluck | G1 | 1 | flageolet octave pop |
| 25.6875 | 13.4.2½ | 1132819 | 1541 | snare | ghost snare |  | 0.443 |  |
| 25.7500 | 13.4.3 | 1135575 | 1545 | cable bass | slap | A1 | 1.4 | strike stretch 0.3 |
| 25.7500 | 13.4.3 | 1135575 | 1545 | kick | kick |  | 0.9 |  |
| 25.7500 | 13.4.3 | 1135575 | 1545 | snare | ghost snare |  | 0.507 |  |
| 25.8125 | 13.4.3½ | 1138331 | 1548 | cable bass | pluck | A1 | 1 | flageolet octave pop |
| 25.8125 | 13.4.3½ | 1138331 | 1548 | snare | ghost snare |  | 0.571 |  |
| 25.8333 | 13.4.3½ | 1139250 | 1550 | beast | ka | A1 |  | overload: climbing with the 32nds |
| 25.8750 | 13.4.4 | 1141088 | 1552 | cable bass | slap | B1 | 1.5 | strike stretch 0.3 |
| 25.8750 | 13.4.4 | 1141088 | 1552 | snare | ghost snare |  | 0.636 |  |
| 25.9163 | 13.4.4 | 1142907 | 1554 | beast | ka | B1 |  | overload: climbing with the 32nds |
| 25.9375 | 13.4.4½ | 1143844 | 1556 | cable bass | pluck | B1 | 1 | flageolet twelfth pop |
| 25.9375 | 13.4.4½ | 1143844 | 1556 | snare | ghost snare |  | 0.7 |  |
| 26.0000 | 14.1.1 | 1146600 | 1560 | beast | WOM | E1 |  | overload: the hook's head, hocket in 16ths |
| 26.0000 | 14.1.1 | 1146600 | 1560 | section | VII. The overload |  |  | the hook's head, then in 8ths against a 16th Beast hocket |
| 26.0625 | 14.1.1½ | 1149356 | 1563 | perc | alarm-bell hat |  | 0.4 |  |
| 26.2500 | 14.1.3 | 1157625 | 1575 | beast | ka | E1 |  | overload: the hook's head, hocket in 16ths |
| 26.2500 | 14.1.3 | 1157625 | 1575 | kick | break kick |  | 0.7 |  |
| 26.3750 | 14.1.4 | 1163138 | 1582 | beast | YOI | E2 |  | overload: the hook's head, hocket in 16ths |
| 26.5000 | 14.2.1 | 1168650 | 1590 | cable bass | slap | E1 | 1.6 | strike stretch 0.45 |
| 26.5000 | 14.2.1 | 1168650 | 1590 | cable partner | crack |  | 0.8 |  |
| 26.5000 | 14.2.1 | 1168650 | 1590 | snare | toaster spring |  | 0.4 |  |
| 26.5625 | 14.2.1½ | 1171406 | 1593 | beast | ka | E1 |  | overload: the hook's head, hocket in 16ths |
| 26.6250 | 14.2.2 | 1174163 | 1597 | cable bass | pluck | E1 | 1 | flageolet octave pop |
| 26.6250 | 14.2.2 | 1174163 | 1597 | perc | press clank |  | 0.4 |  |
| 26.6875 | 14.2.2½ | 1176919 | 1601 | beast | YOI | E2 |  | overload: the hook's head, hocket in 16ths |
| 26.7500 | 14.2.3 | 1179675 | 1605 | cable bass | slap | G1 | 1.6 | strike stretch 0.4 |
| 26.7500 | 14.2.3 | 1179675 | 1605 | kick | kick |  | 0.9 |  |
| 26.7500 | 14.2.3 | 1179675 | 1605 | perc | alarm-bell hat |  | 0.3 |  |
| 26.7500 | 14.2.3 | 1179675 | 1605 | snare | break snare + spring |  | 0.5 |  |
| 26.8125 | 14.2.3½ | 1182431 | 1608 | beast | ka | G1 |  | overload: the hook's head, hocket in 16ths |
| 26.8750 | 14.2.4 | 1185188 | 1612 | cable bass | pluck | G1 | 1 | flageolet twelfth pop |
| 26.8750 | 14.2.4 | 1185188 | 1612 | snare | break snare + spring |  | 0.6 |  |
| 26.9375 | 14.2.4½ | 1187944 | 1616 | beast | YOI | G2 |  | overload: the hook's head, hocket in 16ths |
| 26.9375 | 14.2.4½ | 1187944 | 1616 | snare | ghost snare |  | 0.4 |  |
| 27.0000 | 14.3.1 | 1190700 | 1620 | beast | ka | E2 |  | overload: quintuplet chokes, then the scream |
| 27.0000 | 14.3.1 | 1190700 | 1620 | cable | slap (strike) |  | 1.4 |  |
| 27.0000 | 14.3.1 | 1190700 | 1620 | cable | OVERWIND |  |  | wound past its note: round trip shrinks to E3 by 14.4.1½; re-struck every round trip; brighter, more dispersive, driven harder |
| 27.0000 | 14.3.1 | 1190700 | 1620 | cable partner | crack |  | 0.8 |  |
| 27.0000 | 14.3.1 | 1190700 | 1620 | kick | break kick |  | 0.7 |  |
| 27.0000 | 14.3.1 | 1190700 | 1620 | perc | alarm-bell hat |  | 0.3 |  |
| 27.0000 | 14.3.1 | 1190700 | 1620 | ratchet | RATCHET (crack) |  |  | 47 repeats, one per cable round trip, until 14.4.1½ |
| 27.0000 | 14.3.1 | 1190700 | 1620 | section | Overwind |  |  | cable wound past its note to E3; drums ratchet with it; quintuplet chokes; toms walk up |
| 27.0000 | 14.3.1 | 1190700 | 1620 | snare | ghost snare |  | 0.25 |  |
| 27.0000 | 14.3.1 | 1190700 | 1620 | snare | break snare + spring |  | 0.45 |  |
| 27.0000 | 14.3.1 | 1190700 | 1620 | snare | toaster spring |  | 0.35 |  |
| 27.0000 | 14.3.1 | 1190700 | 1620 | toms | cable tom | F2 | 0.5 |  |
| 27.0625 | 14.3.1½ | 1193456 | 1623 | snare | ghost snare |  | 0.272 |  |
| 27.0625 | 14.3.1½ | 1193456 | 1623 | toms | cable tom | G2 | 0.55 |  |
| 27.1000 | 14.3.1½ | 1195110 | 1626 | beast | YOI | F2 |  | overload: quintuplet chokes, then the scream |
| 27.1250 | 14.3.2 | 1196213 | 1627 | kick | break kick |  | 0.65 |  |
| 27.1250 | 14.3.2 | 1196213 | 1627 | snare | ghost snare |  | 0.294 |  |
| 27.1250 | 14.3.2 | 1196213 | 1627 | toms | cable tom | A2 | 0.6 |  |
| 27.1875 | 14.3.2½ | 1198969 | 1631 | perc | press clank |  | 0.4 |  |
| 27.1875 | 14.3.2½ | 1198969 | 1631 | snare | ghost snare |  | 0.317 |  |
| 27.1875 | 14.3.2½ | 1198969 | 1631 | toms | cable tom | B2 | 0.6 |  |
| 27.2000 | 14.3.2½ | 1199520 | 1632 | beast | ka | G2 |  | overload: quintuplet chokes, then the scream |
| 27.2500 | 14.3.3 | 1201725 | 1635 | cable partner | crack |  | 0.75 |  |
| 27.2500 | 14.3.3 | 1201725 | 1635 | kick | break kick |  | 0.7 |  |
| 27.2500 | 14.3.3 | 1201725 | 1635 | perc | alarm-bell hat |  | 0.33 |  |
| 27.2500 | 14.3.3 | 1201725 | 1635 | snare | ghost snare |  | 0.339 |  |
| 27.2500 | 14.3.3 | 1201725 | 1635 | snare | break snare + spring |  | 0.45 |  |
| 27.2500 | 14.3.3 | 1201725 | 1635 | toms | cable tom | C3 | 0.65 |  |
| 27.3000 | 14.3.3 | 1203930 | 1638 | beast | YOI | A2 |  | overload: quintuplet chokes, then the scream; sputter |
| 27.3125 | 14.3.3½ | 1204481 | 1638 | kick | ghost kick |  | 0.5 |  |
| 27.3125 | 14.3.3½ | 1204481 | 1638 | snare | ghost snare |  | 0.361 |  |
| 27.3125 | 14.3.3½ | 1204481 | 1638 | toms | cable tom | D3 | 0.7 |  |
| 27.3750 | 14.3.4 | 1207238 | 1642 | kick | break kick |  | 0.7 |  |
| 27.3750 | 14.3.4 | 1207238 | 1642 | perc | alarm-bell hat |  | 0.35 |  |
| 27.3750 | 14.3.4 | 1207238 | 1642 | snare | ghost snare |  | 0.383 |  |
| 27.3750 | 14.3.4 | 1207238 | 1642 | toms | cable tom | E3 | 0.7 |  |
| 27.4000 | 14.3.4 | 1208340 | 1644 | beast | ka | B2 |  | overload: quintuplet chokes, then the scream |
| 27.4375 | 14.3.4½ | 1209994 | 1646 | cable partner | crack |  | 0.75 |  |
| 27.4375 | 14.3.4½ | 1209994 | 1646 | kick | ghost kick |  | 0.55 |  |
| 27.4375 | 14.3.4½ | 1209994 | 1646 | snare | ghost snare |  | 0.406 |  |
| 27.4375 | 14.3.4½ | 1209994 | 1646 | toms | cable tom | F3 | 0.75 |  |
| 27.4688 | 14.3.4½ | 1211372 | 1648 | perc | press clank |  | 0.45 |  |
| 27.5000 | 14.4.1 | 1212750 | 1650 | beast | ya | B2->E3 |  | overload: quintuplet chokes, then the scream |
| 27.5000 | 14.4.1 | 1212750 | 1650 | kick | break kick |  | 0.75 |  |
| 27.5000 | 14.4.1 | 1212750 | 1650 | perc | alarm-bell hat |  | 0.4 |  |
| 27.5000 | 14.4.1 | 1212750 | 1650 | snare | ghost snare |  | 0.428 |  |
| 27.5000 | 14.4.1 | 1212750 | 1650 | snare | break snare + spring |  | 0.5 |  |
| 27.5000 | 14.4.1 | 1212750 | 1650 | snare | toaster spring |  | 0.5 |  |
| 27.5000 | 14.4.1 | 1212750 | 1650 | toms | cable tom | G3 | 0.8 |  |
| 27.5250 | 14.4.1 | 1213853 | 1651 | beast | glitch (beat-repeat + crush) |  |  | 3 repeats |
| 27.5625 | 14.4.1½ | 1215506 | 1653 | kick | ghost kick |  | 0.6 |  |
| 27.5625 | 14.4.1½ | 1215506 | 1653 | snare | ghost snare |  | 0.45 |  |
| 27.5625 | 14.4.1½ | 1215506 | 1653 | toms | cable tom | A3 | 0.8 |  |
| 27.6000 | 14.4.1½ | 1217160 | 1656 | all | CUT: silence |  |  | every instrument and effect faded out over 4 ms (raised cosine) ending at 27.6 s; exactly zero from frame 1217160 to 1234799 |
| 27.6000 | 14.4.1½ | 1217160 | 1656 | cable | silent |  |  | cut |
| 27.6000 | 14.4.1½ | 1217160 | 1656 | cable | grab (hand stops the cable) |  |  | until 15.1.3 |
| 27.6000 | 14.4.1½ | 1217160 | 1656 | section | CUT |  |  | digital silence to 28.000 s |

## C

### Removed (in V3, not here): 58 events

- 7 x cable wind strike, 19.630-19.997 s
- 8 x perc cable tick, 25.000-25.875 s
- 16 x ratchet repeat, 19.375-26.856 s

| Time (s) | Position | Sample | f60 | Part | Event | Pitch | Velocity | Detail |
|---:|---|---:|---:|---|---|---|---:|---|
| 19.0000 | 10.3.1 | 837900 | 1140 | beast | aah (wound up with the cable) | fry->E1 |  | until 10.4.4½ |
| 19.0000 | 10.3.1 | 837900 | 1140 | cable | WIND-UP |  |  | round trip shrinks to E1 by 11.1.1; re-struck every round trip |
| 19.0000 | 10.3.1 | 837900 | 1140 | ratchet | RATCHET (ks) |  |  | 9 repeats, one per cable round trip, until 11.1.1 |
| 25.5000 | 13.4.1 | 1124550 | 1530 | cable bass | pluck | B1 | 1 |  |
| 25.5000 | 13.4.1 | 1124550 | 1530 | snare | ghost snare |  | 0.15 |  |
| 25.5625 | 13.4.1½ | 1127306 | 1533 | snare | ghost snare |  | 0.18 |  |
| 25.6250 | 13.4.2 | 1130063 | 1537 | cable bass | pluck | A1 | 1 |  |
| 25.6250 | 13.4.2 | 1130063 | 1537 | snare | ghost snare |  | 0.22 |  |
| 25.6875 | 13.4.2½ | 1132819 | 1541 | snare | ghost snare |  | 0.26 |  |
| 25.7500 | 13.4.3 | 1135575 | 1545 | cable bass | pluck | G1 | 1 |  |
| 25.7500 | 13.4.3 | 1135575 | 1545 | kick | kick |  | 0.85 |  |
| 25.7500 | 13.4.3 | 1135575 | 1545 | snare | ghost snare |  | 0.3 |  |
| 25.8125 | 13.4.3½ | 1138331 | 1548 | cable bass | pluck | G1 | 1 |  |
| 25.8125 | 13.4.3½ | 1138331 | 1548 | snare | ghost snare |  | 0.35 |  |
| 25.8750 | 13.4.4 | 1141088 | 1552 | cable bass | pluck | A1 | 1 |  |
| 25.8750 | 13.4.4 | 1141088 | 1552 | snare | ghost snare |  | 0.4 |  |
| 25.9375 | 13.4.4½ | 1143844 | 1556 | cable bass | pluck | B1 | 1 |  |
| 25.9375 | 13.4.4½ | 1143844 | 1556 | snare | ghost snare |  | 0.45 |  |
| 26.0000 | 14.1.1 | 1146600 | 1560 | beast | WOM | E1 |  | ending: the hook, cut off |
| 26.0000 | 14.1.1 | 1146600 | 1560 | section | VII. The snap |  |  | the hook is cut off; reflections lead back to the opening |
| 26.2500 | 14.1.3 | 1157625 | 1575 | beast | ka | E1 |  | ending: the hook, cut off |
| 26.3750 | 14.1.4 | 1163138 | 1582 | beast | YOI | E2 |  | ending: the hook, cut off |
| 26.5000 | 14.2.1 | 1168650 | 1590 | cable | SNAP (crack) |  |  | tension collapses to a 500 ms round trip |
| 26.5000 | 14.2.1 | 1168650 | 1590 | cable partner | crack |  | 0.9 |  |
| 26.5000 | 14.2.1 | 1168650 | 1590 | ratchet | RATCHET (crack) |  |  | 8 repeats, one per cable round trip, until 14.3.1 |
| 26.5625 | 14.2.1½ | 1171406 | 1593 | beast | gasp |  |  |  |
| 27.9250 | 14.4.4 | 1231493 | 1675 | cable | grab (hand stops the cable) |  |  | until 15.1.3 |

### Added or changed (here, not in V3): 257 events

- 50 x cable wind strike, 19.564-27.596 s
- 42 x perc cable tick, 25.000-27.562 s
- 52 x ratchet repeat, 19.375-27.596 s

| Time (s) | Position | Sample | f60 | Part | Event | Pitch | Velocity | Detail |
|---:|---|---:|---:|---|---|---|---:|---|
| 19.0000 | 10.3.1 | 837900 | 1140 | beast | aah (wound up with the cable) | fry->E1 |  | until 10.4.2½ |
| 19.0000 | 10.3.1 | 837900 | 1140 | cable | WIND-UP |  |  | round trip shrinks to E1 by 10.4.3; re-struck every round trip |
| 19.0000 | 10.3.1 | 837900 | 1140 | ratchet | RATCHET (ks) |  |  | 6 repeats, one per cable round trip, until 10.4.3 |
| 19.7500 | 10.4.3 | 870975 | 1185 | all | GASP: silence |  |  | every instrument and effect faded out over 4 ms (raised cosine) ending at 19.75 s; exactly zero from frame 870975 to 881999 |
| 19.7500 | 10.4.3 | 870975 | 1185 | cable | bowed |  |  | wind-up complete; held silent through the gasp |
| 19.7500 | 10.4.3 | 870975 | 1185 | cable | grab (hand stops the cable) |  |  | until 10.4.4½ |
| 19.7500 | 10.4.3 | 870975 | 1185 | section | The gasp |  |  | 250 ms of silence; the payoff stays on 20.000 s |
| 25.1250 | 13.3.2 | 1108013 | 1507 | kick | kick |  | 0.8 |  |
| 25.3750 | 13.3.4 | 1119038 | 1522 | snare | ghost snare |  | 0.3 |  |
| 25.4375 | 13.3.4½ | 1121794 | 1526 | snare | ghost snare |  | 0.35 |  |
| 25.5000 | 13.4.1 | 1124550 | 1530 | beast | ya | E1 |  | overload: climbing with the 32nds |
| 25.5000 | 13.4.1 | 1124550 | 1530 | cable bass | slap | E1 | 1.3 | strike stretch 0.25 |
| 25.5000 | 13.4.1 | 1124550 | 1530 | cable partner | crack |  | 0.7 |  |
| 25.5000 | 13.4.1 | 1124550 | 1530 | kick | kick |  | 0.9 |  |
| 25.5000 | 13.4.1 | 1124550 | 1530 | section | Excitement |  |  | slap-pop pairs in 32nds climbing E-G-A-B; the Beast in triplets and chokes |
| 25.5000 | 13.4.1 | 1124550 | 1530 | snare | ghost snare |  | 0.25 |  |
| 25.5625 | 13.4.1½ | 1127306 | 1533 | cable bass | pluck | E1 | 1 | flageolet octave pop |
| 25.5625 | 13.4.1½ | 1127306 | 1533 | snare | ghost snare |  | 0.314 |  |
| 25.6250 | 13.4.2 | 1130063 | 1537 | cable bass | slap | G1 | 1.3 | strike stretch 0.25 |
| 25.6250 | 13.4.2 | 1130063 | 1537 | snare | ghost snare |  | 0.379 |  |
| 25.6667 | 13.4.2 | 1131900 | 1540 | beast | ya | G1 |  | overload: climbing with the 32nds |
| 25.6875 | 13.4.2½ | 1132819 | 1541 | cable bass | pluck | G1 | 1 | flageolet octave pop |
| 25.6875 | 13.4.2½ | 1132819 | 1541 | snare | ghost snare |  | 0.443 |  |
| 25.7500 | 13.4.3 | 1135575 | 1545 | cable bass | slap | A1 | 1.4 | strike stretch 0.3 |
| 25.7500 | 13.4.3 | 1135575 | 1545 | kick | kick |  | 0.9 |  |
| 25.7500 | 13.4.3 | 1135575 | 1545 | snare | ghost snare |  | 0.507 |  |
| 25.8125 | 13.4.3½ | 1138331 | 1548 | cable bass | pluck | A1 | 1 | flageolet octave pop |
| 25.8125 | 13.4.3½ | 1138331 | 1548 | snare | ghost snare |  | 0.571 |  |
| 25.8333 | 13.4.3½ | 1139250 | 1550 | beast | ka | A1 |  | overload: climbing with the 32nds |
| 25.8750 | 13.4.4 | 1141088 | 1552 | cable bass | slap | B1 | 1.5 | strike stretch 0.3 |
| 25.8750 | 13.4.4 | 1141088 | 1552 | snare | ghost snare |  | 0.636 |  |
| 25.9163 | 13.4.4 | 1142907 | 1554 | beast | ka | B1 |  | overload: climbing with the 32nds |
| 25.9375 | 13.4.4½ | 1143844 | 1556 | cable bass | pluck | B1 | 1 | flageolet twelfth pop |
| 25.9375 | 13.4.4½ | 1143844 | 1556 | snare | ghost snare |  | 0.7 |  |
| 26.0000 | 14.1.1 | 1146600 | 1560 | beast | WOM | E1 |  | overload: the hook's head, hocket in 16ths |
| 26.0000 | 14.1.1 | 1146600 | 1560 | section | VII. The overload |  |  | the hook's head, then in 8ths against a 16th Beast hocket |
| 26.0625 | 14.1.1½ | 1149356 | 1563 | perc | alarm-bell hat |  | 0.4 |  |
| 26.2500 | 14.1.3 | 1157625 | 1575 | beast | ka | E1 |  | overload: the hook's head, hocket in 16ths |
| 26.2500 | 14.1.3 | 1157625 | 1575 | kick | break kick |  | 0.7 |  |
| 26.3750 | 14.1.4 | 1163138 | 1582 | beast | YOI | E2 |  | overload: the hook's head, hocket in 16ths |
| 26.5000 | 14.2.1 | 1168650 | 1590 | cable bass | slap | E1 | 1.6 | strike stretch 0.45 |
| 26.5000 | 14.2.1 | 1168650 | 1590 | cable partner | crack |  | 0.8 |  |
| 26.5000 | 14.2.1 | 1168650 | 1590 | snare | toaster spring |  | 0.4 |  |
| 26.5625 | 14.2.1½ | 1171406 | 1593 | beast | ka | E1 |  | overload: the hook's head, hocket in 16ths |
| 26.6250 | 14.2.2 | 1174163 | 1597 | cable bass | pluck | E1 | 1 | flageolet octave pop |
| 26.6250 | 14.2.2 | 1174163 | 1597 | perc | press clank |  | 0.4 |  |
| 26.6875 | 14.2.2½ | 1176919 | 1601 | beast | YOI | E2 |  | overload: the hook's head, hocket in 16ths |
| 26.7500 | 14.2.3 | 1179675 | 1605 | cable bass | slap | G1 | 1.6 | strike stretch 0.4 |
| 26.7500 | 14.2.3 | 1179675 | 1605 | kick | kick |  | 0.9 |  |
| 26.7500 | 14.2.3 | 1179675 | 1605 | perc | alarm-bell hat |  | 0.3 |  |
| 26.7500 | 14.2.3 | 1179675 | 1605 | snare | break snare + spring |  | 0.5 |  |
| 26.8125 | 14.2.3½ | 1182431 | 1608 | beast | ka | G1 |  | overload: the hook's head, hocket in 16ths |
| 26.8750 | 14.2.4 | 1185188 | 1612 | cable bass | pluck | G1 | 1 | flageolet twelfth pop |
| 26.8750 | 14.2.4 | 1185188 | 1612 | snare | break snare + spring |  | 0.6 |  |
| 26.9375 | 14.2.4½ | 1187944 | 1616 | beast | YOI | G2 |  | overload: the hook's head, hocket in 16ths |
| 26.9375 | 14.2.4½ | 1187944 | 1616 | snare | ghost snare |  | 0.4 |  |
| 27.0000 | 14.3.1 | 1190700 | 1620 | beast | ka | E2 |  | overload: quintuplet chokes, then the scream |
| 27.0000 | 14.3.1 | 1190700 | 1620 | cable | slap (strike) |  | 1.4 |  |
| 27.0000 | 14.3.1 | 1190700 | 1620 | cable | OVERWIND |  |  | wound past its note: round trip shrinks to E3 by 14.4.1½; re-struck every round trip; brighter, more dispersive, driven harder |
| 27.0000 | 14.3.1 | 1190700 | 1620 | cable partner | crack |  | 0.8 |  |
| 27.0000 | 14.3.1 | 1190700 | 1620 | kick | break kick |  | 0.7 |  |
| 27.0000 | 14.3.1 | 1190700 | 1620 | perc | alarm-bell hat |  | 0.3 |  |
| 27.0000 | 14.3.1 | 1190700 | 1620 | ratchet | RATCHET (crack) |  |  | 47 repeats, one per cable round trip, until 14.4.1½ |
| 27.0000 | 14.3.1 | 1190700 | 1620 | section | Overwind |  |  | cable wound past its note to E3; drums ratchet with it; quintuplet chokes; toms walk up |
| 27.0000 | 14.3.1 | 1190700 | 1620 | snare | ghost snare |  | 0.25 |  |
| 27.0000 | 14.3.1 | 1190700 | 1620 | snare | break snare + spring |  | 0.45 |  |
| 27.0000 | 14.3.1 | 1190700 | 1620 | snare | toaster spring |  | 0.35 |  |
| 27.0000 | 14.3.1 | 1190700 | 1620 | toms | cable tom | F2 | 0.5 |  |
| 27.0625 | 14.3.1½ | 1193456 | 1623 | snare | ghost snare |  | 0.272 |  |
| 27.0625 | 14.3.1½ | 1193456 | 1623 | toms | cable tom | G2 | 0.55 |  |
| 27.1000 | 14.3.1½ | 1195110 | 1626 | beast | YOI | F2 |  | overload: quintuplet chokes, then the scream |
| 27.1250 | 14.3.2 | 1196213 | 1627 | kick | break kick |  | 0.65 |  |
| 27.1250 | 14.3.2 | 1196213 | 1627 | snare | ghost snare |  | 0.294 |  |
| 27.1250 | 14.3.2 | 1196213 | 1627 | toms | cable tom | A2 | 0.6 |  |
| 27.1875 | 14.3.2½ | 1198969 | 1631 | perc | press clank |  | 0.4 |  |
| 27.1875 | 14.3.2½ | 1198969 | 1631 | snare | ghost snare |  | 0.317 |  |
| 27.1875 | 14.3.2½ | 1198969 | 1631 | toms | cable tom | B2 | 0.6 |  |
| 27.2000 | 14.3.2½ | 1199520 | 1632 | beast | ka | G2 |  | overload: quintuplet chokes, then the scream |
| 27.2500 | 14.3.3 | 1201725 | 1635 | cable partner | crack |  | 0.75 |  |
| 27.2500 | 14.3.3 | 1201725 | 1635 | kick | break kick |  | 0.7 |  |
| 27.2500 | 14.3.3 | 1201725 | 1635 | perc | alarm-bell hat |  | 0.33 |  |
| 27.2500 | 14.3.3 | 1201725 | 1635 | snare | ghost snare |  | 0.339 |  |
| 27.2500 | 14.3.3 | 1201725 | 1635 | snare | break snare + spring |  | 0.45 |  |
| 27.2500 | 14.3.3 | 1201725 | 1635 | toms | cable tom | C3 | 0.65 |  |
| 27.3000 | 14.3.3 | 1203930 | 1638 | beast | YOI | A2 |  | overload: quintuplet chokes, then the scream; sputter |
| 27.3125 | 14.3.3½ | 1204481 | 1638 | kick | ghost kick |  | 0.5 |  |
| 27.3125 | 14.3.3½ | 1204481 | 1638 | snare | ghost snare |  | 0.361 |  |
| 27.3125 | 14.3.3½ | 1204481 | 1638 | toms | cable tom | D3 | 0.7 |  |
| 27.3750 | 14.3.4 | 1207238 | 1642 | kick | break kick |  | 0.7 |  |
| 27.3750 | 14.3.4 | 1207238 | 1642 | perc | alarm-bell hat |  | 0.35 |  |
| 27.3750 | 14.3.4 | 1207238 | 1642 | snare | ghost snare |  | 0.383 |  |
| 27.3750 | 14.3.4 | 1207238 | 1642 | toms | cable tom | E3 | 0.7 |  |
| 27.4000 | 14.3.4 | 1208340 | 1644 | beast | ka | B2 |  | overload: quintuplet chokes, then the scream |
| 27.4375 | 14.3.4½ | 1209994 | 1646 | cable partner | crack |  | 0.75 |  |
| 27.4375 | 14.3.4½ | 1209994 | 1646 | kick | ghost kick |  | 0.55 |  |
| 27.4375 | 14.3.4½ | 1209994 | 1646 | snare | ghost snare |  | 0.406 |  |
| 27.4375 | 14.3.4½ | 1209994 | 1646 | toms | cable tom | F3 | 0.75 |  |
| 27.4688 | 14.3.4½ | 1211372 | 1648 | perc | press clank |  | 0.45 |  |
| 27.5000 | 14.4.1 | 1212750 | 1650 | beast | ya | B2->E3 |  | overload: quintuplet chokes, then the scream |
| 27.5000 | 14.4.1 | 1212750 | 1650 | kick | break kick |  | 0.75 |  |
| 27.5000 | 14.4.1 | 1212750 | 1650 | perc | alarm-bell hat |  | 0.4 |  |
| 27.5000 | 14.4.1 | 1212750 | 1650 | snare | ghost snare |  | 0.428 |  |
| 27.5000 | 14.4.1 | 1212750 | 1650 | snare | break snare + spring |  | 0.5 |  |
| 27.5000 | 14.4.1 | 1212750 | 1650 | snare | toaster spring |  | 0.5 |  |
| 27.5000 | 14.4.1 | 1212750 | 1650 | toms | cable tom | G3 | 0.8 |  |
| 27.5250 | 14.4.1 | 1213853 | 1651 | beast | glitch (beat-repeat + crush) |  |  | 3 repeats |
| 27.5625 | 14.4.1½ | 1215506 | 1653 | kick | ghost kick |  | 0.6 |  |
| 27.5625 | 14.4.1½ | 1215506 | 1653 | snare | ghost snare |  | 0.45 |  |
| 27.5625 | 14.4.1½ | 1215506 | 1653 | toms | cable tom | A3 | 0.8 |  |
| 27.6000 | 14.4.1½ | 1217160 | 1656 | all | CUT: silence |  |  | every instrument and effect faded out over 4 ms (raised cosine) ending at 27.6 s; exactly zero from frame 1217160 to 1234799 |
| 27.6000 | 14.4.1½ | 1217160 | 1656 | cable | silent |  |  | cut |
| 27.6000 | 14.4.1½ | 1217160 | 1656 | cable | grab (hand stops the cable) |  |  | until 15.1.3 |
| 27.6000 | 14.4.1½ | 1217160 | 1656 | section | CUT |  |  | digital silence to 28.000 s |

