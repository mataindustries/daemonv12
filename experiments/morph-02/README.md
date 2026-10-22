# DaemonV12 — MORPH//02: The Sound Design Breakthrough

Three new instruments and three 11–12 second sketches. They grew out of a diagnosis of
why MORPH//01 was technically correct but sounded small. MORPH//01 is untouched
(`experiments/morph-voice/`). This directory is self-contained: synthesis uses only
Node built-ins, and nothing in `src/`, `mcp/`, tests or fixtures changed.

> **Nobody has listened to these yet.** I couldn't perceive audio in the environment
> that made them. Everything claimed below is measured or designed, not heard.
> See [REVIEW.md](REVIEW.md).

## Listen

| File in `audio/` | What it is |
|---|---|
| `a-the-machine-learns-to-sing.wav` / `.mp3` | A physical voice learns to say "hel-lo", grows a giant throat, becomes a monster choir, cracks back into a child: "hello?" |
| `b-the-alarm-that-breaks-reality.wav` / `.mp3` | A kitchen alarm hook commands colossal machinery, glitches the room open, becomes a four-on-the-floor groove of household sounds, ends with a microwave DING |
| `c-the-impossible-instrument.wav` / `.mp3` | THE TEMPO STRING: a cable whose fundamental is the tempo. Its echoes are rhythm; tightened, they become a bass riff; released, rhythm again |
| `reference/morph-01-*.lufs-14.mp3` | MORPH//01 demos, pure-gain matched to −14 LUFS for a fair A/B |
| `spectrograms/*.png` | Spectrogram and envelope of every render |
| `../engine/render/morph-02-household-machine-kit.mp3` | A new groove sequenced *through the DaemonV12 0.7 engine* using exported assets |

Masters are stereo 44.1 kHz / 24-bit WAV, true peak ≤ −1.1 dBTP, −13.9 to −15.2 LUFS.
MP3s are 256 kbps listening copies.

## How each one is made

**A — glottis + waveguide throat (`voice.mjs`, `a-machine-learns-to-sing.mjs`).**
- **Source:** a Rosenberg/LF-style glottal flow derivative with:
  - a return-phase tilt controlled by tenseness;
  - per-period jitter and shimmer;
  - a period-doubling "growl", giving real subharmonics;
  - breath noise pulsed by the glottal flow.
- **Throat:** a 44-section Kelly-Lochbaum pressure-wave tract with a 28-section nasal
  branch joined at an N-port velum junction:
  - consonant constrictions with turbulence for m, n, l, h, d and s;
  - lip radiation that reflects lows and radiates highs;
  - a `metal` control that makes the walls ring.
- **Throat size:** the tract is stepped at a variable internal rate and band-limited,
  then resampled to 44.1 kHz. Size (child ↔ giant) therefore moves every formant
  smoothly while pitch stays independent.
- **Calibration:** vowels are fitted to formant targets by `calibrate-voice.mjs`.
- **The performance:** pitch, phonemes, size, tension, growl, metal and vibrato curves
  for one continuous 12 s voice. Two extra renders through all-metal giant throats (an
  octave and a fifth below) make the bar-4 choir.
- **Accompaniment:** a modal music box, a heartbeat, servo gears, half-time drums,
  4× oversampled drive and FDN reverbs.

**B — household archetypes, rescaled (`b-alarm-breaks-reality.mjs`).**
- **Beeps:** band-limited squares through a fixed piezo-housing resonance.
- **Machinery:** a press clank (steel-plate modes, thud and pneumatic hiss), a "BWOMM"
  horn (four octaves down, closing vowel) and a building-sized clock escapement.
- **Drums:** a washer-drum kick (pitched body, tub modes and click); a toaster-spring
  snare (an impulse through a 48-stage dispersive allpass loop, plus a 4-burst clap);
  alarm-clock-bell hats (two struck modal bells, swung 16ths).
- **Bass and lead:** a fridge-hum bass (saw+square, enveloped resonant low-pass, tube
  drive, sidechain pump) and a talk-box-like vowel lead.
- **Reality break:** the hook fragment re-sliced into ever-shorter, ever-higher repeats.
- **Spaces:** a 0.35 s kitchen against a 4.2 s hangar.

**C — the dispersive tempo string (`c-impossible-instrument.mjs`).**
- **The loop:** each cable is a delay loop:
  - fractional delay;
  - a 160-stage first-order allpass dispersion cascade (60 stages in the high cable);
  - a loss low-pass;
  - `tanh` saturating loop gain, which bows the cable when gain > 1;
  - a DC blocker.
- **Tuning:** the delay subtracts the cascade's and filter's phase delay at the current
  fundamental, so the cable stays in tune when pitched.
- **Strikes:** hammer and scrape enter *before* the dispersion, so even the first
  arrival is a chirp. Optional self-strikes fire on every round trip; this makes the
  accelerando audible.
- **Riff articulation:** palm mutes (loop-gain dips) and fast re-tension glides.
- **Around the cables:** an anchor-bolt modal boom on arrivals, a 5.5 s canyon reverb
  and a dotted-eighth wall reflection.

Shared kit (`dsp.mjs`):
- polyBLEP oscillators, TPT SVF and RBJ biquads;
- 4× windowed-sinc oversampled waveshaping;
- an 8-line Hadamard FDN reverb;
- modal banks with impulse/peak normalization;
- compressor, lookahead limiter with a 4× true-peak trim, and BS.1770 gain staging;
- a 24/16-bit WAV writer that refuses to clip.

## Picture sync points

| | Event | s | frame @24 | frame @60 |
|---|---|---:|---:|---:|
| A | hum → "AH" blooms | 0.50 | 12 | 30 |
| A | first "hel-lo" | 1.33 | 32 | 80 |
| A | heartbeat + machine echo | 2.67 | 64 | 160 |
| A | throat starts to stretch, pitch falls | 5.33 | 128 | 320 |
| A | "lo-lo-lo" stutter | 6.67 | 160 | 400 |
| A | monster "HEL-LOOO" + kick | 8.00 | 192 | 480 |
| A | crack into the child's falsetto | 9.67 | 232 | 580 |
| A | "hello?" | 10.83 | 260 | 650 |
| B | machinery obeys | 2.00 | 48 | 120 |
| B | glitch ratchet / toaster pop | 3.50 / 3.875 | 84 / 93 | 210 / 232.5 |
| B | drop | 4.00 | 96 | 240 |
| B | floor vanishes, stuck beep | 9.00 | 216 | 540 |
| B | DING / polite beep | 10.00 / 10.75 | 240 / 258 | 600 / 645 |
| C | first strike; 3:4 reflections | 0 / 0.5625 / 0.75 | 0 / 13.5 / 18 | 0 / 33.75 / 45 |
| C | tightening begins | 3.00 | 72 | 180 |
| C | rhythm has become E1; riff | 4.50 | 108 | 270 |
| C | release | 8.625 | 207 | 517.5 |
| C | rhythm returns | 10.50 | 252 | 630 |

The three tempos (90/120/80 BPM) give whole frames per beat at both 24 and 60 fps.

## Reproduce

From the repository root, on Node 22.18 or newer (reference: v22.22.0 linux-x64):

```sh
node experiments/morph-02/build.mjs               # all three -> audio/ (+ pcm16/, mp3 via ffmpeg)
node experiments/morph-02/build.mjs b             # one sketch
node experiments/morph-02/build.mjs --reference   # also the level-matched MORPH//01 copies
node experiments/morph-02/calibrate-voice.mjs --search   # re-fit vowels (about 2 min)
npm ci && node experiments/morph-02/integrate.mjs        # engine kit + render (DaemonV12 0.7)
pip install numpy scipy matplotlib                       # analysis only
python3 experiments/morph-02/analyze.py experiments/morph-02/audio/analysis.json experiments/morph-02/audio/*.wav --png experiments/morph-02/audio/spectrograms
```

- **Determinism:** re-rendering produces byte-identical WAVs on the same runtime.
  Hashes are in `audio/*.meta.json`. Other CPUs and runtimes may differ in the last
  bits of transcendental functions.
- **Render cost** on this host: A ≈ 16 s, B ≈ 6 s, C ≈ 7 s.
- **Not committed (rebuilt by the commands above):** the 16-bit copies, the reference
  WAVs and the engine stems.

## DaemonV12 integration

`integrate.mjs` exports eleven B one-shots as a drumkit, plus a tempo-string strike
from C and the bare 12 s voice performance from A, all as 44.1 kHz PCM16 under
`engine/assets/`. It then writes a **new** 5-bar project in
`engine/morph-02-household-machine-kit.json` and renders it with the unmodified 0.7
engine. The project uses drumkit pitches by name, v0.7 gates, envelopes and choke
groups, and sampler `offsetSeconds`/`endSeconds` slices of the voice ("hel-lo" and
"HEL-LO"). Production mixer and stems are included. Result: 0 diagnostics, 0 warnings,
0 clipped samples.

## Documents

- [DIAGNOSIS.md](DIAGNOSIS.md): why MORPH//01 sounds restrained, measured vs.
  hypothesized, and what to keep or discard.
- [REVIEW.md](REVIEW.md): production review, revision log, comparison, risks and a
  recommendation.
