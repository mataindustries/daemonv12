# DAEMON//HEADLINER 002 — Wonder Max · Three Sketches for Owner Listening

**Status: HUMAN LISTENING GATE. Work stops here — no full-length song has been started.**
Nothing is merged or published. This branch (`experiment/wonder-headliner-002`) only adds this folder.

> The producer (an AI agent) **cannot hear audio**. Every musical description below is
> *design intent written into the score*, and every number is a signal measurement,
> not a quality judgement. Only the owner's ears can rank these sketches.

## Listen (in this order, same loudness: all −16 LUFS integrated)

| # | Sketch | MP3 (committed) | WAV (in workspace, not committed) | Length |
|---|---|---|---|---|
| A | **GLASS ORCHARD** — Strange Beauty | `listening/a-glass-orchard.mp3` | `wav/a-glass-orchard.wav` | 48.7 s |
| B | **CHROME STALLION** — The Impossible Groove | `listening/b-chrome-stallion.mp3` | `wav/b-chrome-stallion.wav` | 41.0 s |
| C | **THE MOON KEEPS RECEIPTS** — Beyond the Known | `listening/c-tidal-receipts.mp3` | `wav/c-tidal-receipts.wav` | 39.2 s |

WAVs are the rack's canonical stereo PCM16 / 44.1 kHz `mix-context` masters (all parts + context + room).
MP3s are the rack's 192 kbps encodes of the same masters. WAVs were left uncommitted by design
(source + small MP3s are committed, per the brief); regenerate them exactly with the commands below.

## The three creative identities

### A — GLASS ORCHARD · Strange Beauty · D minor, 72 BPM, 14 bars
- **Hook:** a falling sigh, `A4–F4–E4`, answered by `D4–F4–A4`, then a ♭VI lift to `B♭4` before falling home to D.
- **Journey:** bowed-drone *breath* with only the sigh fragment (0:00) → full sung hook over warm Living Bass
  with ghost notes (0:13) → **metamorphosis** (0:27): the melody leaves the voice and is played an octave up
  by alien modal bars (macro → 1) while the voice drops to a low hum carrying an overtone-whistle melody and a
  heartbeat kick appears → *coda* (0:40): the human sigh returns over one held warm D, answered by a single glass D.
- **Restraint:** no snare, no groove kit; only 6 parts. The bass only edges toward the machine (macro ≤ 0.38).

### B — CHROME STALLION · The Impossible Groove · G minor, 98 BPM, swing 0.58, 16 bars
- **Hook:** the bass riff itself — a swaggering G-minor cell with a late `E♭→F` lift, slides, scoops and ghosts,
  humanised (±4 ms). Tine stabs and short wordless voice cries answer it; the clockwork clock is the hi-hat.
- **Journey:** warm riff alone (0:00) → hook statement developing to a `Cm→D` lift with stab/cry answers and a
  dive ending (0:10) → **disruption** (0:20): floor drops to half-time stop-time hits, held subs, triplet then
  revving bass motion, one high cry alone → **payoff** (0:29): the same riff returns as full machine
  (macro → 0.9, sixteenth/growl motion) and dives 5 semitones out.
- **Physicality:** context kick/snare are the unchanged HEADLINER 001 patches; no part plays a generic four-on-the-floor.

### C — THE MOON KEEPS RECEIPTS · Beyond the Known · E major (Lydian `A♯`), 116 BPM, 18 bars
- **Invention:** the hook is a 5-note gravity motif `E5–G♯5–B5–A♯5–F♯5` stated in **7-beat cells that cross the
  4/4 barlines**, hocketed between the dispersive spring (low octave) and the modal bars — no single instrument
  owns it, and there is no voice or bass at all for the first 14 seconds.
- **Journey:** *signal* (0:00, four crossing cells + bearings rain) → *gravity-hook* (0:15): the Living Bass
  pulses in the same 7-beat cycle (`E–C♯–A–B`) against the barlines while a human voice finally sings the motif
  whole, twice → *zero-gravity* (0:29): everything drops to a bowed octave-subharmonic drone and one lone `A♯`
  ring → *return* (0:33): the motif comes back reordered and harder in the bars while the voice holds only the
  root `E` and its **overtone lane** plays the motif above it; final bass dive.
- **Why it might be replayable:** the ear learns a melody from machinery first, recognises it when a human
  sings it, then hears it leave the human body again in the finale.

All three are original material: different keys, tempos, hooks, forms and instrument roles from each other,
and no melody, rhythm, progression, key or arrangement is taken from SODIUM HOURS or CROSSING.

## Reproduce

From the repository root (Node 22.18+, FFmpeg with libmp3lame). Each `*.compose.ts` deterministically
regenerates its `*.score.json` (verified: regeneration produces no diff), and each render refuses an
existing output directory.

```bash
node production/headliner-002/scores/a-glass-orchard.compose.ts
node studio-001/rack/cli.ts render production/headliner-002/scores/a-glass-orchard.score.json work/headliner-002/a --normalize -16

node production/headliner-002/scores/b-chrome-stallion.compose.ts
node studio-001/rack/cli.ts render production/headliner-002/scores/b-chrome-stallion.score.json work/headliner-002/b --normalize -16

node production/headliner-002/scores/c-tidal-receipts.compose.ts
node studio-001/rack/cli.ts render production/headliner-002/scores/c-tidal-receipts.score.json work/headliner-002/c --normalize -16
# listening master = <out>/mix-context.wav and <out>/mix-context.mp3
```

Instruments are the owner-approved Signature Rack 1.0.0 (`studio-001/rack/cli.ts list`): Living Bass,
Impossible Voice, Mechanical Orchestra, plus the unchanged HEADLINER 001 context kick/snare.
Sounds are numeric parameters and seeded PRNGs only — no recordings, samples, SoundFonts, presets,
third-party audio, or imitation of any artist. All material here is original and commercially appropriate
subject to the owner's licensing declaration (none is granted by this document).

## Validation (measurements, not quality) — see `VALIDATION.json`

| Sketch | Duration | Integrated (WAV) | True peak | Clipped samples | Final 0.5 s RMS |
|---|---|---|---|---|---|
| A | 48.667 s | −16.1 LUFS | −3.8 dBTP | 0 | −48.7 dB (decayed tail) |
| B | 40.984 s | −16.0 LUFS | −2.2 dBTP | 0 | −54.0 dB |
| C | 39.241 s | −16.1 LUFS | −2.1 dBTP | 0 | −44.1 dB |

- Pitch/range, articulation, control and duration validation is enforced by the Signature Rack score
  validator before rendering (it correctly rejected an out-of-range spring part in C's first draft);
  the rack's own test suite verifies pitch within ±15 cents and onsets at the engine frame.
- Per-section RMS in `VALIDATION.json` confirms every section is non-silent and the intended arcs occur
  (e.g. C: signal −23.7 → gravity-hook −17.4 → zero-gravity −28.5 → return −14.2 dB; B's disruption dips).
- Independent re-measurement of the delivered files with FFmpeg `loudnorm`: MP3s −16.3 to −16.4 LUFS.
- Environment: Node v24.22.2, FFmpeg 6.1.1 (libmp3lame), rack 1.0.0 / interface 1.0.0, branch commit history
  in git. Intermediate stem renders were deleted after delivery to save disk.
- Genuine blockers: none for rendering. **The one real unknown is musical quality — unheard by the producer.**

## Listening gate

STOP. Tell the producer which sketch (A, B, or C) is strongest — or what to change — and only then will
the chosen concept be developed into the 3–4 minute record.
