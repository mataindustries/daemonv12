# DaemonV12 — MORPH//03: The Cable Breaks

The Tempo String from MORPH//02 C, the human listener's favourite, rebuilt as a playable
bass instrument, then tested in three 8-second loops. All three are 4 bars at 120 BPM in E,
loop seamlessly, and are mastered to the same loudness (−13.9 LUFS, true peak ≤ −1.5 dBTP).
MORPH//01 and MORPH//02 are untouched. Everything here lives in `experiments/morph-03/`, and
the DaemonV12 engine is unchanged.

> **Nobody has listened to these yet.** I can't perceive audio in the environment that
> made them. Everything claimed is measured or designed; the musical verdict is yours.
> See [REVIEW.md](REVIEW.md).

## Listen (Android: tap a link)

| Loop | 8 s MP3 | ×4 MP3 for replay | WAV master (24-bit) |
|---|---|---|---|
| 1 — CABLE BASS | [mp3](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-03-cable-breaks/experiments/morph-03/audio/morph03-1-cable-bass.mp3) | [×4](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-03-cable-breaks/experiments/morph-03/audio/morph03-1-cable-bass.x4.mp3) | [wav](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-03-cable-breaks/experiments/morph-03/audio/morph03-1-cable-bass.wav) |
| 2 — THE WOBBLE BEAST | [mp3](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-03-cable-breaks/experiments/morph-03/audio/morph03-2-wobble-beast.mp3) | [×4](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-03-cable-breaks/experiments/morph-03/audio/morph03-2-wobble-beast.x4.mp3) | [wav](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-03-cable-breaks/experiments/morph-03/audio/morph03-2-wobble-beast.wav) |
| 3 — THE GROOVE | [mp3](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-03-cable-breaks/experiments/morph-03/audio/morph03-3-the-groove.mp3) | [×4](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-03-cable-breaks/experiments/morph-03/audio/morph03-3-the-groove.x4.mp3) | [wav](https://raw.githubusercontent.com/mataindustries/daemonv12/feat/morph-03-cable-breaks/experiments/morph-03/audio/morph03-3-the-groove.wav) |

- **Loops:** the WAVs loop sample-seamlessly. MP3 encoding adds a few milliseconds of
  padding, so a phone player can leave a small gap at the loop point. The ×4 files are
  the seamless loop repeated four times (32 s): use them to judge replay value.
- **Reference:** MORPH//02 C, the original Tempo String, is at
  `../morph-02/audio/c-the-impossible-instrument.mp3`.

## What you're hearing

**1 — CABLE BASS.** The loop tells one physical story:
- **0–1.5 s:** the slack cable's quarter-note reflections, answered 3:4 by a second cable.
  These are the echoes of the snap that ends the previous cycle.
- **1.5–2.5 s:** the cable tightens: a geometric accelerando of self-strikes that fuses into E1.
- **2.5–3.5 s:** it is bowed and "talks" in triplet band-pass shapes.
- **3.5–4 s:** a 32nd-note stutter run.
- **4–7.5 s:** the riff, made of the new articulations:
  - slaps whose pitch dives fall out of the tension physics;
  - laser "zap" onsets;
  - palm-muted ghosts that keep their thump;
  - flageolet octave and twelfth pops;
  - a Phrygian F→E bend;
  - an abrupt tritone re-tension.
- **7.5–8 s:** THE CABLE BREAKS: a crack, the tension collapses as fast as physics allows,
  and the pitch dives back into the reflections that open the loop.

**2 — THE WOBBLE BEAST.** Call and response in a half-time feel:
- **Cable calls (bars 1, 3):**
  - a strike, chirp reflections, a ratchet into a slapped question;
  - then angrier: dives, a tritone, a stutter, a twelfth squeal, a snap.
- **The Beast answers (bars 2, 4).** The same cable, bowed hard, drives a physical vocal
  tract, so every wobble is a mouth shape in time (no LFO):
  - WOM (quarter), wa-wa (eighths), ya-ya-ya (triplets), yoi + a velar choke;
  - quintuplet "ka" chokes, an EEE-YOOW octave dive, 3+3+2 wobs;
  - a bit-crushed beat-repeat glitch and a gasp.
- **Rhythmic contrast:** the cable and the Beast never wobble at the same time. Drums
  (punchy anchor kick, cable-crack snare) are made from cable material.

**3 — THE GROOVE.** Swung 16ths with four-on-the-floor washer kicks, toaster-spring snares
and alarm-clock-bell hats (MORPH//02 B's kit). A two-bar, three-part phrase:
1. the alarm asks (piezo double-beeps, hocketed with the bass);
2. the cable answers (slap dives, octave pops, a slide);
3. the punchline: toaster POP, press CLANK, the alarm's wrong note F, answered by a
   Phrygian cable slide and a 32nd stutter.

**The surprise (bar 3):** the alarm hook falls an octave per beep, down a well. Its pitch
and its housing resonance sink together (spectral centroid 3.3 kHz → 450 Hz). The floor
opens, and the last beep lands exactly on the cable's B1, which takes the hook over and
finds the wrong note itself. Bar 4 answers; the cable dives an octave under a microwave
DING, and the alarm starts again.

## The instrument (`cable.mjs`)

The MORPH//02 core is kept. A delay loop's round trip *is* the cable's tension: long =
rhythm, short = pitch. A 160-stage allpass chain makes every round trip a dispersive chirp,
and saturating feedback bows the cable. New physics and articulations:

| Control | What it does |
|---|---|
| `stretch` (per event) | A hit raises tension in proportion to its force and relaxes (70 ms). Slaps dive about 5 semitones into pitch; plucks flare about 0.2 semitones. |
| `zapLane` | Every note onset briefly drives dispersion deep: a laser-chirp attack that settles into clean pitch. |
| `buzz` | One-sided contact barrier: the cable slaps its guide. Upper harmonics that read on phones, more when played harder. |
| `harmonic`, `harmonicN` | Flageolet touch at 1/N of the length: odd harmonics die, the note pops an octave (N=2) or a twelfth (N=3). |
| `damp` | Palm mute: overtones die fast, the fundamental keeps a short thump. |
| `bow` | Constant-force bowing: extra gain while the cable is below its stable amplitude, so low bowed notes sustain. |
| `events` | pluck, slap, ghost, scrape, crack; each with hardness and pick position (comb notch). |

Engine fixes found while testing (they also apply to MORPH//02's model):
- **Zipper fix:** delay and dispersion are ramped per sample. Stepping them every block made
  zipper tones at multiples of 2756 Hz during fast tension changes.
- **Dispersion cap:** dispersion can't exceed 85% of the round trip.
- **Bowed-sustain fix:** the loop's DC blocker sits at 5 Hz, not 12, so bowed E1 can sustain.

`throat.mjs` is MORPH//02's calibrated Kelly-Lochbaum vocal tract, driven by an external
source (the Beast). `household.mjs` is MORPH//02 B's kit, copied and adapted.

## Reproduce

From the repository root, on Node ≥ 22.18 (rendered on v22.22.0, linux-x64). FFmpeg is
needed for the MP3s.

```sh
node experiments/morph-03/build.mjs                      # all three -> experiments/morph-03/audio/
node experiments/morph-03/build.mjs 2                    # one loop
node experiments/morph-03/build.mjs --out /tmp/m3 --stems
pip install numpy scipy matplotlib                       # analysis only
python3 experiments/morph-03/analyze.py experiments/morph-03/audio/analysis.json experiments/morph-03/audio/morph03-*.wav --png experiments/morph-03/audio/spectrograms
python3 experiments/morph-03/checks.py /tmp/m3 experiments/morph-03/audio/checks.json
```

- **Determinism:** re-renders are byte-identical on the same runtime. Hashes are in
  `audio/*.meta.json`.
- **Automation:** every lane that shaped each sound (tension/period, dispersion, damping,
  buzz, harmonic touches) is sampled at 100 Hz into `audio/automation/*.json`.
- **Not committed:** stems, which are analysis-only.
