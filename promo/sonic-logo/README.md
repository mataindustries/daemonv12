# DaemonV12 / ENM Studio · sonic logo

A two-syllable signature sting, rendered by the unchanged Signature Rack (`studio-001`) with the Timbre Lab
instruments (`timbre-lab/`) registered. Organic body, digital edge:

| Time | What | Instrument |
|---|---|---|
| 0.00 s | a clay pot whoops up to D3, a palm booms a skin on D2 | `organic-percussion/pot` (whoop), `organic-percussion/skin` (bass) |
| 0.25 s | a slap on the skin, then two knuckle knocks D4 → A4 | `organic-percussion/skin` (slap), `organic-percussion/log` (knuckle) |
| 0.50 s | a voice cries up to A4 with a reed bark under it, slides to D5 and turns to glass (human → impossible) | `impossible-voice` (cry → legato, glass + shimmer + stretch ramps), `breath-reed` (accent) |
| 0.50 s on | a detuned gong bar on D5 / A5 and a scatter of tuned pings ring it out | `mechanical-orchestra/bar` (ring), `mechanical-orchestra/bearings` |

Key D minor. The melodic cell is D → A → D' (tonic, fifth, octave): the knocks say it dry, the voice sings it.

## Cuts

| Cut | Score | File | Length | Use |
|---|---|---|---|---|
| Full | `full.score.json` | `render/full.wav` / `.mp3` | 3.6 s | intros, title cards, the front of a trailer |
| Short | `short.score.json` | `render/short.wav` / `.mp3` | 1.6 s | bumpers, app sounds (same score at 160 BPM, shorter ring) |
| Quiet tail | `tail.score.json` | `render/tail.wav` / `.mp3` | 5.4 s | the end of a video: no slap, the voice hums instead of cries, three seconds of halo |

All three are normalised to **-16 LUFS integrated** with true peak at or under -1 dBTP (`render/render.json` has the
measurements; the quiet tail is quiet in its arrangement and decay, not in its integrated loudness, so it sits at the
same level as the other two when it follows them in an edit). WAV is 24-bit 44.1 kHz; MP3 is 192 kbit/s.

## Build

```bash
node promo/sonic-logo/build.ts               # renders render/*.wav, render/*.mp3, render/render.json and listen.html
node promo/sonic-logo/build.ts --page-only   # rebuilds listen.html from the existing renders
```

The build asks the rack for -16 LUFS; where the rack stops early to keep the true peak under -1 dBTP, a 2 ms
look-ahead limiter takes the remaining gain, and a 60 ms fade covers the rack's hard cut at the end of the tail.
`listen.html` is one self-contained phone page (audio embedded, about 0.25 MB) with a play button and a
"loop with 2 s of silence" mode for judging each cut against silence, as a sting is heard.
