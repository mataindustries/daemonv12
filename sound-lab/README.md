# THE SOUND LAB · GRIND and BOLLO auditions

**Status: waiting for the owner to listen.** Two short original auditions, built only from engineering that already
existed (Living Bass, the V12 motif bridge, the BOLLO coin instrument, DAEMON//CRUSH). Nobody has heard them: the
agent that made them cannot listen. Every number below is a measurement, not a verdict.

## Listen

| | File | What it is |
|---|---|---|
| **GRIND** | [GRIND-C-three-cycles.mp3](grind/audio/GRIND-C-three-cycles.mp3) | Start here. The processed cycle three times (21.6 s) |
| | [GRIND-B-crush.mp3](grind/audio/GRIND-B-crush.mp3) | One cycle, selectively processed (7.9 s) |
| | [GRIND-A-dry.mp3](grind/audio/GRIND-A-dry.mp3) | One cycle, no CRUSH anywhere |
| | [GRIND-D-dry-then-crush.mp3](grind/audio/GRIND-D-dry-then-crush.mp3) | A then B back to back. **Not loudness-matched**: B is 4 LU louder |
| | [stems](grind/audio/stems/) | `bass808`, `bass808-dry`, `kick`, `snare`, `hats`, `music`, `drums-only` |
| **BOLLO** | [BOLLO-B-three-cycles.mp3](bollo/audio/BOLLO-B-three-cycles.mp3) | Start here. Three cycles and the closing hit (30.1 s) |
| | [BOLLO-A-sketch.mp3](bollo/audio/BOLLO-A-sketch.mp3) | The sketch: one cycle and the closing hit (11.8 s) |
| | [BOLLO-C-coins-only.mp3](bollo/audio/BOLLO-C-coins-only.mp3) | Only the coins, same performance |
| | [BOLLO-D-band-only.mp3](bollo/audio/BOLLO-D-band-only.mp3) | Everything except the coins |
| | [BOLLO-E-no-crush.mp3](bollo/audio/BOLLO-E-no-crush.mp3) | The sketch with no CRUSH and no master clip |
| | [stems](bollo/audio/stems/) | `coins`, `kick`, `clap`, `bass`, `synth` |

Every MP3 has a 44.1 kHz stereo PCM24 WAV beside it; the WAV is the reference.

## GRIND · 808 performance audition

Four bars, 140 BPM, A minor, 6.857 s per cycle. Score: [grind/score.json](grind/score.json); score and mix as code:
[grind/build.ts](grind/build.ts); performed events: `grind/audio/events.json`.

- **The 808 is Living Bass, and it already glides.** Its oscillator keeps one phase accumulator for the whole part, so a
  `legato` note travels from the sounding pitch without restarting the wave. No new oscillator was written. The line
  uses six glides (a minor third, a fifth, an octave, steps back down) and two dives; each fresh strike starts a
  fifth high and falls in over about 75 ms (`scoop: -7`), which is the knock.
- **The idea.** A long held root, a stutter, a climb; the flat second leaning on the root; then the floor drops out
  for more than a beat (beats 6.25 to 7.25: no 808, no hats, only the snare's tail) before a double tap and an
  octave slide throw it back to the one. Bar 4 is pulled down a step at a time and falls away before the last roll.
- **Drums.** SUB HAMMER and IRON PULSE (gated to their first 86 ms), TITANIUM CRACK and NEON CLAP on beat 3, GHOST
  TICK in eighths with thirty-second and triplet rolls, OPEN CIRCUIT twice. A quiet SIGNAL bell figure (E F E C, then
  E F E G) and a SPECTER drone sit behind.
- **CRUSH, selectively.** The 808 (amount 0.7, input calibrated to the reference plus 3 dB, 80 % wet) and the
  snare/clap bus (0.7, 60 % wet). The kick and the hats never pass through CRUSH's drive or compressor. The kick has
  its own 2.5 dB soft clip and the sum goes 3 dB into the CRUSH soft clipper.
- **Kick against 808.** The 808 is ducked 14 dB for the first 45 ms of every kick and is back within 90 ms, so the two
  never add at an arbitrary phase. Measured after each kick, the band under 150 Hz rises the same way on every
  full hit.

| | Loudness | True peak | Crest | Kick front vs body |
|---|---:|---:|---:|---:|
| A dry | -13.9 LUFS | -1.0 dBTP | 14.5 dB | 9.5 dB |
| B crush | -9.8 LUFS | -1.0 dBTP | 10.3 dB | 6.9 dB |

What may be wrong: the processed kick front is 2.6 dB lower against its body than dry; the mix is bottom-heavy by
design (sub, bass and low-mid within 1.5 dB of each other, everything above 2 kHz about 15 dB lower); the bell and
drone are quiet and may read as absent on a phone speaker.

## BOLLO · coin rhythm sketch

Four bars of electro-cumbia, 105 BPM, A major, 9.143 s per cycle, plus a closing hit. Scores:
[bollo/score.json](bollo/score.json) and [bollo/closing-hit.score.json](bollo/closing-hit.score.json); score, mix and
every gain: [bollo/build.ts](bollo/build.ts); render settings and measurements: `bollo/audio/REPORT.json`; every coin
contact with its frame: `bollo/audio/events.json`.

- **The tempo was chosen to fit the coin.** The coin's mechanics run in real seconds, so the tempo was picked
  where they become rhythm:
  - a sixteenth at 105 BPM is 1/7 s, and a coin spun with `spin: 0` starts at 7 contacts per second. The spin in
    bar 4 begins as sixteenth notes, accelerates out of the grid, and lies flat exactly on the next downbeat;
  - with `restitution: 0.5` each flight is half the last. Dropped at the right speed, the flights are an eighth, a
    sixteenth, a thirty-second...; the bounce on beat 4 of bar 2 runs out exactly on the downbeat of bar 3.
- **Eight coin parts, all the unchanged instrument:** a small coin ticking the cumbia scraper figure; a large coin
  slapped flat (the call, 3 + 3 + 2); a quarter on its rim (the answer); the two tempo-locked bounces; the spin; and a
  handful of three different coins hitting the floor a few milliseconds apart on every downbeat.
- **The band plays the coin's rhythm.** In bar 4 kick, bass, chords and lead hit the face coin's 3 + 3 + 2 call
  together, then stop, and the spinning quarter has two beats alone.
- **Hook.** One bar in A major, repeated a step lower over the dominant, lifted in bar 3, sung in parallel thirds
  (PHANTOM), with off-beat SIGNAL stabs and a Living Bass tumbao under a four-on-the-floor IRON PULSE.
- **Coin tuning.** Sizes 0.74 to 1.0 put the coins' lowest ring between 2.9 and 5.4 kHz with 20 to 100 ms decays,
  aimed away from the bell-like attacks noted in the five-second proof. This is a parameter choice, not a change to
  the instrument, and only a listener can say whether they now read as coins.
- **CRUSH, selectively.** Bass (0.7, 60 % wet) and the lead/chord bus (0.7, 50 % wet) only. The coins never pass
  through CRUSH's drive or compressor; they get a 4 dB shelf above 6.5 kHz, a short hard room, and a 12 dB fader ride
  across the spin. In the full mix the tips of the loudest coin hits meet the master soft clipper (up to 3.7 dB over
  its ceiling).

| | Loudness | True peak | 2 to 8 kHz share |
|---|---:|---:|---:|
| A sketch | -10.1 LUFS | -1.0 dBTP | -10.2 dB |
| D band only | -11.1 LUFS | -1.5 dBTP | -21.2 dB |
| E no CRUSH | -15.3 LUFS | -1.0 dBTP | -10.3 dB |

What may be wrong: the coins are sharp and concentrated between 2 and 8 kHz and may be harsh; the two-beat spin is
much quieter than the band around it; the hook is deliberately simple and may be too plain.

## New code

No synthesis, engine, rack, bridge, coin or CRUSH source was added or changed.

- [lib.ts](lib.ts) (about 100 lines): buffer helpers for the two mixes. Filters and reverb are the frozen HEADLINER
  primitives; `crushed` and `clipTo` call DAEMON//CRUSH; `duck` is a keyed gain curve, `ride` a fader move, `cycle`
  lays loops end to end.
- [grind/build.ts](grind/build.ts) and [bollo/build.ts](bollo/build.ts): each is one score and one mix.
- [../tests/sound-lab.test.ts](../tests/sound-lab.test.ts): seven tests (coin tempo-lock, spin landing, slide phase
  continuity, kit and checksum checks).

```sh
node sound-lab/grind/build.ts /tmp/new-grind     # about 20 s; a second build is byte-identical here
node sound-lab/bollo/build.ts /tmp/new-bollo     # about 45 s
node --test tests/sound-lab.test.ts
```

## Technical QA

- Typecheck clean. `tests/sound-lab.test.ts`: 7 of 7. Coin, bridge and CRUSH tests (30) pass unchanged.
- Both builds rendered twice with identical hashes for every WAV, MP3 and JSON (Node 22.23.4, FFmpeg 6.1.1).
- No clipped samples (the PCM24 writer refuses them); every delivered file is at or under -1.0 dBTP.
- No coin event is truncated. Frame counts follow the tempo exactly (18,900 and 25,200 frames per beat).
- Frozen-file verification runs inside every bridge render and passed.

## Licensing and provenance

All audio here is synthesised by code in this repository: the V12 SIGNATURE pack, the Signature Rack's Living Bass
and the BOLLO coin instrument. No recordings, samples from outside the repository, or third-party audio were used,
and no existing melody was referenced. The V12 SIGNATURE pack's license is still **pending the owner's declaration**
([PROVENANCE.md](../packs/v12-signature-v1/PROVENANCE.md)); these auditions inherit that status. Nothing here is
cleared for commercial release.

## FABLE

The interrupted session's two candidates, INDUSTRIAL PURSUIT and CHROME FUNK, are preserved untouched in
[../fable-lab/fable/](../fable-lab/fable/RECOVERED.md). No FABLE composition was started here.
