# A-to-S mix pass · GRIND and BOLLO

**Status: waiting for the owner to listen.** The compositions did not change: same scores, tempi, notes, glides,
silences and coin mechanics. Only mix settings and two coin *tone* parameters moved. I can't listen to audio, so
every claim below is a measurement.

## Listen first (all loudness-matched)

| | File | Order |
|---|---|---|
| **GRIND** | [GRIND-AB-orig-G1-G2.mp3](audio/grind/GRIND-AB-orig-G1-G2.mp3) | original → G1 PUNCH → G2 MENACE, one cycle each, 1 s apart, all at **-11.6 LUFS** |
| **BOLLO** | [BOLLO-AB-orig-B1-B2.mp3](audio/bollo/BOLLO-AB-orig-B1-B2.mp3) | original → B1 QUARTERS → B2 PARTY MONEY, sketch + closing hit each, all at **-10.8 LUFS** |
| | [BOLLO-AB-coins-only-orig-B1-B2.mp3](audio/bollo/BOLLO-AB-coins-only-orig-B1-B2.mp3) | the coins alone, one shared gain, so you hear the tone change without the band |

Then the three-cycle previews (each also loudness-matched): `audio/grind/GRIND-{original,G1-punch,G2-menace}-three-cycles.mp3`
and `audio/bollo/BOLLO-{original,B1-quarters,B2-party-money}-three-cycles.mp3`. Every MP3 has a PCM24 WAV beside it.
`stems/<variant>/` holds what each variant's master sums. `REPORT.json` holds every setting and measurement.

The "original" files here are the approved masters **turned down** to the shared loudness (the gain is in
REPORT.json). The approved files in `../grind/audio` and `../bollo/audio` are untouched; a test checks their
SHA256SUMS.

## What changed

**GRIND G1 · PUNCH**
- The kick no longer goes through its own 2.5 dB clip into a 3 dB master clip. It gets a keyed +2 dB lift on its
  first 8 ms (gain curve from the score's kick frames), its body sits 1 dB lower, the click layer is 3 dB up, and
  the tip is clipped only 1.5 dB.
- The snare, 808 and music bus takes most of the clipping (4 dB) *before* the kick and hats are added. The master
  clipper then pushes 2.5 dB, so the fronts that matter meet it with less to shave.
- The 808 now waits 55 ms under each kick instead of 45 ms (16 dB duck, same 90 ms release).
- Bell +4.5 dB with a 2.8 kHz presence lift, drone +3 dB with a brighter low-pass, hats +1 dB with an air shelf.

**GRIND G2 · MENACE**
- A parallel growl layer: only the 808 above 280 Hz goes through CRUSH at amount 1, pushed 8 dB, low-passed at
  5.2 kHz and blended 7 dB under the 808. It **rides up 3 dB from bar 3**, so the second half bites harder than the
  first. That ride is the contrast.
- The 808 is pushed harder into CRUSH (0.8, +4 dB, 85 % wet). Snare and clap get CRUSH 0.9 at 75 % wet and a
  2.2 kHz edge.
- The drone is 5.5 dB louder, darker and half-crushed (the threat). The bell is 2 dB up.
- The kick lift is the same idea as G1, gentler. Bus clip 5 dB, master clip 3.5 dB: denser than G1 on purpose.

**BOLLO, why the coins sounded like glass.** In every coin part, the lowest mode pair (2.9–5.4 kHz, weights 1.0 and
0.63) rang for 84–103 ms. The instrument's own 6.5–11 kHz low-pass removes the dense upper partials. A single long
pitched "ting" with nothing above it reads as a bottle. A real coin is a short, noisy contact with a cluster of
inharmonic partials.

**BOLLO B1 · QUARTERS**
- Coin parameters: `damping` 1.0 (bounce 0.9, spin 0.85) and `hardness` 1.0. These existing controls give a
  shorter ring and a sharper force pulse, and open the instrument's low-pass from about 10.5 to 11 kHz. Restitution,
  spin, velocity, size, strike and seed are unchanged. A test re-plans every coin note and confirms that every
  contact keeps its frame and strength.
- Mix:
  - each part gets a 6 dB cut at its *own* computed lowest mode (and 3 dB at its partner), so the pitched tone goes
    and the inharmonic cluster stays;
  - a contact-keyed decay shortener: each physical contact opens the gain, and the ring falls 9 dB after 6 ms;
  - +3 dB at 1.4 kHz, where the floor slap (the table contact) lives;
  - the glassy room drops from -10 to -20 dB.
- A coin-bus tip clip (CRUSH soft clip) shaves only sub-millisecond spikes. It replaces the master clipper doing
  that job 3.7 dB deep.

**BOLLO B2 · PARTY MONEY**
- The same coin parameters as B1, with a lighter mode cut and shortener so more ring stays.
- Clatter taps on the guiro, face and rim coins (9, 17 and 28 ms; -9, -12 and -16 dB; panned L, R, centre-left).
  These are short delayed copies with no feedback, and they read as several coins.
- A parallel CRUSH layer on the coin bus, band-passed 1.5–9 kHz, sits 11 dB under the coins.
- The face call is 3 dB up and the rim answer 2 dB up.
- The synth bus ducks 3 dB under each face hit, so the call cuts through without making the master louder.

No synthesis, instrument, CRUSH, bridge, rack, motif or V12 SIGNATURE file was changed. No opt-in synthesis
parameter was needed: the instrument's existing `damping` and `hardness` plus mix code covered it.

## Measurements (at matched loudness)

| GRIND | Kick front/body (peak) | Kick front/body (10 ms RMS) | Crest | 500 Hz–2 kHz | 2–8 kHz | Sub / bass | True peak |
|---|---:|---:|---:|---:|---:|---:|---:|
| original | 6.9 dB | 0.0 dB | 10.3 dB | -13.4 | -20.9 | -5.4 / -4.4 | -2.8 dBTP |
| G1 PUNCH | **9.9 dB** | **+1.3 dB** | 12.5 dB | -11.8 | -18.9 | -5.3 / -5.2 | -1.0 dBTP |
| G2 MENACE | 8.5 dB | +1.1 dB | 11.0 dB | **-10.3** | -19.5 | -5.6 / -5.0 | -2.5 dBTP |

The dry mix's kick was 9.5 dB, so G1 gets back the 2.6 dB the processing took and adds a little more. G2's
mid-range (the growl) is up 3 dB with harshness (2–5 kHz against 0.5–2 kHz) slightly *lower* than the original. Low
end: the sub stays within 0.2 dB. The 60–150 Hz band is 0.8 dB lower in G1, from the longer duck.

| BOLLO | Coin front/body (peak) | Coin front/body (10 ms RMS) | Coin harshness 2–5 vs 0.5–2 kHz | Coin 0.5–2 kHz share | Coin tips into master clipper | Mix 2–8 kHz | Mix 8–20 kHz |
|---|---:|---:|---:|---:|---:|---:|---:|
| original | 11.8 dB | 2.0 dB | 15.1 dB | -23.3 | +3.7 dB over | -10.2 | -18.6 |
| B1 QUARTERS | **16.6 dB** | **5.8 dB** | **6.4 dB** | -13.8 | +1.9 dB over | -13.4 | -15.9 |
| B2 PARTY MONEY | 14.7 dB | 4.8 dB | 7.3 dB | -14.2 | +2.5 dB over | -10.9 | -15.0 |

QA, all six masters:
- No sample at full scale. Every true peak is at or under -1.0 dBTP.
- Three-cycle loudness is within 0.1 LU of the single cycle.
- The step across each loop point is at or below the typical sample-to-sample step around it. BOLLO's seam lands on
  the downbeat coin handful, so a transient there is expected.
- LRA is unchanged, within 0.3 LU.
- Original mixes are reproduced bit-exactly (float SHA-256) before any variant is written, and fresh renders are
  byte-identical.

## What may be wrong
- G1 reaches -11.6 LUFS at -1 dBTP; the original reached -9.8. A punchier kick costs peak headroom. At matched
  loudness that is the trade; if G1 must also be as loud as the original, it needs a kick-aware limiter, which is
  not built.
- G2's growl ride from bar 3 is a mix automation and may read as an arrangement change. Set `rideBars34Db: 0` to
  remove it.
- B1 may be *too* dry (more click than ring), or the 1.4 kHz contact may read as wood. B2 sits between the original
  and B1. The coins-only A/B is the quickest way to judge.
- The B2 clatter taps add comb colour to the rim and face coins, and more on the spin's sixteenths.

## Rebuild

```sh
node sound-lab/upgrade/grind.ts      # ~50 s; GRIND_ONLY=G1 to render one variant
node sound-lab/upgrade/bollo.ts      # ~2 min; BOLLO_ONLY=B1
node --test tests/sound-lab-upgrade.test.ts
```
`SOUNDLAB_CACHE=<dir>` caches the rendered instrument stems for quick mix iteration (delivery was checked against
fresh renders).
