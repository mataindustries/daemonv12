# CONCRETE GOSPEL V2 · drum surgery

V2 of [Concrete Gospel](../concrete-gospel-001/README.md), built from the V1 composition. Only the drums, the
kick/808 relationship and the mix around them changed. **Stopped for the owner's listening approval.** Nobody has
listened yet; the composer cannot hear audio. The numbers below are signal measurements, not a verdict on whether it hits.

| Listen | |
|---|---|
| [`delivery/concrete-gospel-v1-vs-v2-drums-bass.mp3`](delivery/concrete-gospel-v1-vs-v2-drums-bass.mp3) | Bars 5–10 (21 s): kick + snare + hats + 808 only. V1, then one second of silence, then V2. Loudness-matched (both −16.1 LUFS), so neither wins by level |
| [`delivery/concrete-gospel-v2.mp3`](delivery/concrete-gospel-v2.mp3) / [`.wav`](delivery/concrete-gospel-v2.wav) | Full V2: 16 bars + 2.4 s tail, 29.067 s, −13.1 LUFS, the same loudness as V1 (−13.0) |
| [`delivery/stems/`](delivery/stems) | 12 aligned engine stems (lossless FLAC). The drum and bass ones are `kick`, `snare`, `hats`, `bass808` |

## Why V1's drums were weak (measured before changing anything)

Measured with [`qa/drums.py`](qa/drums.py) on V1's own build. The results are in
[`provenance/qa-drums-v1.json`](delivery/provenance/qa-drums-v1.json).

1. **The kick had no attack.** Its first 5 ms were only 1.2 dB above its body. 77% of its energy sat below 120 Hz, with
   2% click. The 1.5–6 kHz click sat 4 dB under the low body. The skin layer that was meant to punch peaked 18 ms
   late.
2. **The kick drowned in the 808.** In the kick's own first 40 ms, below 120 Hz, the 808 was 1.2 dB louder than the
   kick. The authored 5 dB duck removed only about 3 dB in practice. Kick-plus-808 low-end summing swung from −3.2 to
   +1.9 dB hit to hit, because the 808's phase at each kick is arbitrary. The kick held 11% of the sub power.
3. **The snare's attack was smeared.** NEON CLAP's bursts peak 35 ms after the hit, so the snare's first 10 ms were only
   1 dB above the next 30 ms, and 20% of its energy was "air". A reverb lengthened the tail.
4. **The master flattened what was left.** The master compressor and soft-clipper took a median 4.4 dB off every kick
   peak and 5.4 dB off every snare peak.
5. **Groove:** steady, even-velocity hats, a roll at nearly every phrase end, kicks mostly on eighths, no ghost notes.

## What changed

**Kick.** Each hit now triggers three layers, so one stem carries the whole kick:
- **Body:** V12 IRON PULSE tuned to C2 and gated 1/8.
- **Knock:** a Hand Skin slap on C3, peaking in about 4 ms, aligned 1.5 ms early.
- **Click:** a Hollow Log rim on C5, now about 1 dB under the body instead of 4 dB.

The one-shots are rendered with the rack's existing `kit` command. No new instruments or engine features.

**Kick and 808.** The 808 dips 14 dB at the kick, is still 8 dB down at about 42 ms, and is back by about 108 ms. It
is also 1 dB lower overall. The sub was not raised.

**Snare.** Each backbeat stacks three layers:
- V12 TITANIUM CRACK down 2 semitones;
- the HEADLINER context snare for the lower-mid body (it has its own clap layer);
- a skin slap on F3 for the front crack.

They are gated to 1/8, with a 0.35 s room at 5% wet. **NEON CLAP was dropped:** layered back in, it moved every
measurement by less than 1%.

**Groove.** Groove A puts a kick on the a-of-three, right after the snare ("crack . boom"). The F2→Ab1 swoop now plays
with no kick under it, so the next downbeat lands as a release.

| Section | Kicks (beat in the two-bar cycle) | Ghost snares | Hats |
|---|---|---|---|
| Groove A, bars 5–8 | 0 · 1.5 · 2.75 · 4 · 5.5 · 6.75 | Soft TITANIUM before bar 2 (beat 3.25), one pickup into groove B | No hat on the backbeat; space under the moan in bar 6 |
| Groove B, bars 9–10 and 13–14 | 0 · 0.75 · 1.5 · 2.75 · 4 · 5.25 (on the 808's octave hop) · 7.25 (on its Db) | Beats 3.25 and 7.75 | Answer bar switches to triplet eighths under the hook's own triplet |
| Bar 11 | As groove A | A two-hit snare drag into bar 12, then nothing on the downbeat | Stop at the snare |
| Bars 15–16 | Groove B, then the ending | | Stop on the last snare |

The only hat rolls are the two that announce a change: into groove B, and into the ending. Hats are a little quieter
and more accented (0.66 on the beat, 0.42 off it).

**Mix.**
- Kick +1 dB and snare +1 dB relative to the first A/B measurement.
- The reed hook is darkened with a 5.5 kHz low-pass.
- Every track is trimmed 4 dB, because the layered kick needed headroom.
- The master is gentler: compressor 1.6:1 with a 30 ms attack, then a light soft-clip. Its gain was chosen so peaks are
  only lightly rounded.

**Unchanged:** the hook, the 808 notes, choir, bell, clank, room, form, the "through the wall" intro and the bar-12
moment. The reed, choir, 808 and room stems V2 renders are byte-identical to V1's.

## Measurements, V1 → V2

Same scripts and windows for both. Full records are in `delivery/provenance/qa-*.json`.

**Transient behaviour**

| | V1 | V2 |
|---|---:|---:|
| Kick click (1.5–6 kHz, first 8 ms) vs its low body | −4.0 dB | −1.2 dB |
| Kick knock (120–300 Hz, first 20 ms) vs its low body | −1.0 dB | +0.3 dB |
| Kick body at 50–100 ms (median RMS) | −15.5 dBFS | −20.4 dBFS (shorter, controlled) |
| Kick hit-to-hit peak spread | 0.47 dB | 0.49 dB |
| Snare attack: first 10 ms over the next 30 ms | +1.0 dB | +4.8 dB |
| Snare energy share: body 150–300 Hz / crack 1.5–6 kHz / air >6 kHz | 38 / 27 / 20 % | 49 / 21 / 11 % |
| Snare energy after 150 ms | 7.4 % | 3.8 % |
| Master: hit peaks rounded by the master chain (median, kick / snare) | 4.4 / 5.4 dB | 2.7 / 3.9 dB |
| Master: hit peak over the preceding 180 ms (kick / snare) | 9.8 / 9.6 dB | 11.0 / 10.7 dB |
| Drum-and-bass A/B: true peak minus loudness, same loudness | 11.5 dB | 15.1 dB |

**Kick and 808, low-frequency balance**

| | V1 | V2 |
|---|---:|---:|
| Kick minus 808 below 120 Hz, kick's first 40 ms | −1.2 dB | +11.8 dB |
| Kick minus 808 in a phone band (250 Hz–10 kHz), first 30 ms | +6.9 dB | +19.5 dB |
| 808 just after a kick vs the same note 150–250 ms later | −2.8 dB | −10.3 dB |
| Kick + 808 low-end summing, hit to hit (median, range) | −0.1 (−3.2 to +1.9) dB | −0.1 (−2.0 to +1.2) dB |
| Kick share of kick + 808 power below 100 Hz | 10.7 % | 17.5 % |
| Master below 100 Hz, relative to master RMS | −2.7 dB | −3.5 dB (the low end is slightly leaner, not louder) |
| Low end in mono (L/R correlation 20–120 Hz) | 0.9993 | 0.9999 |

**Clipping and levels**

- **No clipping anywhere:** zero clipped samples on all 12 tracks and the master. The kick track peaks at −0.22 dBFS
  before clipping, the snare at −2.6.
- **Master:** −13.1 LUFS integrated, true peak −0.99 dBTP (at the −1 dBTP ceiling), sample peak −1.07 dBFS, LRA 7.7 LU
  (V1 4.3). The MP3 decodes to the same −1.07 dBFS peak with no full-scale samples.
- **Clicks:** none in the 808, reed, choir, room or bell stems. The master's 22 flagged high-frequency transients are all
  inside kick hits: the click itself, and the saturated kick body's waveform peaks at about 15, 29 and 43 ms.
- **The hook stays on top:**
  - 300 Hz–1 kHz: it leads the rest of the mix by 4.5–6.6 dB (V1 2.7–6.3 dB);
  - 1–4 kHz: it leads by 2.5–7.5 dB (V1 4.3–9.1 dB), where the snare crack and kick click now share its band.
- **Section RMS (dBFS):** bars 1–4 −21.4 · bars 5–8 −13.5 · bars 9–11 −13.6 · bar 12 −20.0 · bars 13–16 −13.5.
- **Determinism:** a second full build was byte-identical. Nothing outside this directory changed.

## For the listening decision

- In the A/B, does V2's kick read as an attack on a phone, and does the 808 still feel big? Its sub is no louder, and it
  now ducks hard for about 100 ms under every kick.
- Is the new snare authoritative or too boxy? Its body share went up and its air went down.
- The after-snare kick (beat 2.75), the ghost snares and the triplet hats in groove B are the new pocket. Is it
  compelling, or busier than wanted?
- The master still rounds snare peaks by about 4 dB. A cleaner snare would mean a quieter master.
- Is the hook still clear, now slightly darkened? It lost 1–2 dB of lead in 1–4 kHz to the drums.

## Rebuild

```bash
node experiments/concrete-gospel-002/build.ts ab
```

```bash
node experiments/concrete-gospel-002/ab.ts
```

```bash
node experiments/concrete-gospel-002/build.ts full
```

```bash
python3 -I experiments/concrete-gospel-002/qa/drums.py experiments/concrete-gospel-002/build/full --json experiments/concrete-gospel-002/build/full/drums-v2.json
```

```bash
node experiments/concrete-gospel-002/deliver.ts
```

The QA scripts need numpy and scipy. `deliver.ts` also expects `drums-v1.json` and the two `checks-*.json` records in
`build/full`, produced the same way:
- `qa/drums.py` on `experiments/concrete-gospel-001/build`;
- `qa/checks.py` on each build.

V1 must have been built (`node experiments/concrete-gospel-001/build.ts`) for its QA. The A/B uses V1's delivered stems.

**Provenance and licensing:** as V1. Every instrument used (V12 Signature, Signature Rack, Timbre Lab, the HEADLINER
context snare) has a pending licensing declaration, so V2 is a private research asset.
