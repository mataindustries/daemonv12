# SOLECITO: NextCustomer original score (candidate V3)

A 20-second cue for the NextCustomer vertical Short. It is composed to work as music first and is not yet synced to picture. It replaces the rejected V1 and V2 tracks and shares no material with them.

**Listen:** [`delivery/solecito.mp3`](delivery/solecito.mp3). The lossless master is [`delivery/solecito.wav`](delivery/solecito.wav) (44.1 kHz, 16-bit, exactly 20.000 s), and the 13 aligned stems are in [`delivery/solecito.stems/`](delivery/solecito.stems).

| | |
|---|---|
| Style | Cumbia sonidera mixed with East-LA soul: a güiro-driven cumbia groove under a G-funk whistle lead |
| Tempo / key | 105 BPM, D Dorian, moving to **D major** at the payoff |
| Form | radio intro, hook, hook answer, B-section lift, build and break, sunrise payoff, button |
| Master | −14.0 LUFS integrated, −1.2 dBTP, LRA 3.7 LU, no clipping; renders byte-identically on repeat |

## Musical decisions

- **Hook.** An accordion riff in parallel thirds, played on a 3-3-2 rhythm (A–D–F, then E-D-E-F). Its answer falls through G7 to a hanging B♮. That B♮ is the Dorian sixth, which makes the minor key sound sunny rather than sad.
- **Opening trick.** Bar 1 plays the hook through a narrow "sonidero radio" filter with record crackle. At 2.29 s the full band comes in at full fidelity, with the Living Bass falling into the downbeat.
- **Groove.** The güiro scrapes long-short-short on every beat. The llamador drum answers on the offbeats, with a conga tumbao, a tarola backbeat and a soft tuned kick on beats 1 and 3. The Living Bass plays root and fifth with chromatic approach notes.
- **Contrast (9.1 s).** The roles swap. The accordion drops to offbeat "chucu" chords, and a gliding G-funk whistle takes a call that climbs one step at a time (F–D–F–G, then G–E–G–A) over B♭ and C.
- **Build (13.7 s).** Over an A7 pedal the whistle plays a Phrygian-dominant turn, then the accordion thirds climb chromatically. The drums tighten to sixteenths, the bass climbs A–B♭–B–C to C♯, and a riser leads into one A7/C♯ hit. About half a second of near-silence follows.
- **Payoff (16.0 s).** The harmony brightens to D major, like the sun in the logo. The whistle sings the hook an octave up in major, doubled by the accordion thirds. Brass appears here for the first time, with a campana tuned to D/A and a boom tuned to D. The payoff measures about 3 dB above the B section.
- **Ending (18.3 s).** A plagal G-to-D close lands on a D6/9 hit. The bass dives an octave, and the tail is fully decayed by 19.8 s with no fade.

## How it could fit the picture (for the later sync pass)

| Picture | Music |
|---|---|
| 0.87 / 1.13 s, "SHOULDN'T BE" / "ANOTHER JOB" typography | Hook notes land at 0.857 / 1.143 s, within 10 ms |
| 2.83–3.0 s, wipe and app cut | Full band enters at 2.29 s, so the groove is already running at the cut. One option is to move the entrance onto the cut |
| 7.0 s, Post | Hook answer, bar 4 (6.86 s) |
| 9.4 s, Story | Whistle entrance, 9.43 s |
| 12.0 s, copy montage | Tarola backbeat at exactly 12.0 s |
| 15–16 s, Spanish | Build, break hit and breath |
| **16.0 s, CTA** | **Payoff downbeat, exactly 16.0 s** |

## Instruments and route

- **DaemonV12 Living Bass** (Signature Rack, warm macro). Its performance score is in [`score/bass.score.json`](score/bass.score.json), bounced natively into `assets/bass/`.
- **Original synthesized instruments** from [`instruments.py`](instruments.py) (numpy and scipy, seeded): a two-reed musette accordion, a G-funk whistle, synth brass, güiro, llamador, congas, tarola, kick, shaker, a campana tuned to D/A, a riser, crashes and record crackle. No recordings, SoundFonts or third-party audio are used.
- The score is [`compose.py`](compose.py), which writes `assets/` and [`solecito.json`](solecito.json), an ordinary v0.7 project with 13 tracks. The unmodified engine renders it.

```bash
python3 production/nextcustomer-solecito/compose.py
node bin/daemonv12.js render production/nextcustomer-solecito/solecito.json --out-dir NEW_DIR --stems --format wav,mp3
```

This is a candidate for owner listening review only. No engine code, instruments, samples or earlier compositions were changed. The NextCustomer repository is untouched. No license or release is implied. The producer, an AI agent, cannot hear audio: the musical descriptions above state intent, and the numbers are measurements.
