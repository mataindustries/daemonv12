# BLACKOUT//ENGINE · DaemonV12 Sound Lab 02

Industrial hip-hop: 128 BPM, G minor, 16 bars, **exactly 30.000 s** (1,323,000 frames). It went through one
composition pass and one bounded technical QA/fix pass, and stops here for the owner's listening review.

**Nobody has listened to it yet.** The composer (an AI agent) cannot hear audio. Musical descriptions below are design
intent. The numbers are signal measurements, not quality scores.

| Listen | |
|---|---|
| [`delivery/blackout-engine.mp3`](delivery/blackout-engine.mp3) | Phone copy, 192 kbps |
| [`delivery/blackout-engine.wav`](delivery/blackout-engine.wav) | Master, 44.1 kHz/16-bit stereo, 30.000 s, no tail |
| [`delivery/stems/`](delivery/stems) | 13 sample-aligned engine stems, lossless FLAC (each verified to decode to the engine's exact PCM) |

## The idea

**The machine's riff is a lament in disguise.**

- **The riff.** The Living Bass hook strikes G three times, leaps an octave, and ratchets down the chromatic stair
  G–F♯–F–E–E♭–D, one gear tooth per semitone. This descending chromatic fourth is a centuries-old lament figure,
  played here by a machine.
- **The first blackout.** The power fails in the middle of a bar. A single human voice sings the same stair slowly in
  the dark.
- **The cold start.** The engine coughs back to life in the riff's own rhythm, warm to machine. It catches the voice in
  its gears: the voice is chopped into the riff and pushed from human toward impossible. It sings the stair with the
  bass but is never allowed the last step, D.
- **The second blackout.** The engine dies on its own octave scream. Only in the dark does the voice finish the phrase:
  E♭ → D, a sigh that lands on the dominant. It is unresolved, so the song has to continue.

Each family's macro is part of the story:

| Family | Macro | What it stands for |
|---|---|---|
| Living Bass | warm → machine | The engine's power |
| Impossible Voice | human → impossible | How far the machine has taken the voice |
| Mechanical Orchestra | clockwork → alien | How hot the engine room is running |

## Map

| Bars | Time | Section | What happens |
|---|---|---|---|
| 1–2 | 0:00 | ignition | The riff from the first downbeat, already the machine: bass, kick and snare only |
| 3–6 | 0:03.8 | engine room | The engine room joins: clock escapement, anvil taps, wood knocks, and a spring recoil after the hammer. The bass heats from 0.82 to 0.97 |
| 7–8 | 0:11.3 | brownout | Bar 7 misfires: the third stroke and the snare are missing, and a laser spring snaps where the hammer should be. In bar 8 each stroke is warmer and weaker than the last |
| 8, beat 3 | **0:14.06** | **blackout** | A breaker trips where the octave scream and snare should land: a contact click, then the lever stop 35 ms later. Everything cuts |
| 8½–10 | 0:14.1 | dark | An inhale; a low hum (G3); the octave cry (G4, on the downbeat at 0:15.00); the stair one sigh per beat (F♯ F E E♭); E♭ is held and unresolved. Hot metal ticks as it cools |
| 11–12 | 0:18.8 | cold start | The engine coughs warm, sub only, with chassis knocks, in the riff's 3+3+2. Each stroke is hotter than the last. The held E♭ is chopped by the strokes. Bar 12: the stair returns with the voice gated in unison, two octaves up |
| 13–16 | 0:22.5 | in the gears | Full machine (macro 1). One alien gong. The voice is gated into the riff and gets more impossible (glass halo, split formants), and its gate is always shut when the bass reaches D. A log scrape doubles the ratchet glide |
| 16, beat 3 | **0:29.06** | **blackout** | The breaker trips under the octave scream |
| 16, beats 3–4 | 0:29.1 | coda | In the dark, the voice alone: E♭4 → D4. It fades to silence at 30.000 s |

## What was written (intent, not a grade)

**The riff** (two bars). Numbers are sixteenth positions in the bar.

| Bar | Notes |
|---|---|
| A, "the engine" | G1 (0, scoop) · G1 (3) · G1 (6) · **G2** scream with the snare (8) · ratchet glide to D2 (9) · D2 growls, then a hole (to 12) · A♭1 pickup, the ♭2 (14) |
| B, "the fall" | G1 (0, scoop) · G1 (3) · **G2** (6) · F♯2 with the snare (8) · F2 (10) · E2 (12) · E♭2 (14) · D2 (15) → G1 |

- The strokes are short (written 0.35–0.55 beat) so the 3+3+2 articulates. Calibration measured 12–20 dB dips between
  strokes.
- Bar A's descent is one continuous servo glide. With `ratchet` 1 it steps through each semitone with a chassis click,
  overshoots to C♯2 and settles. Bar B writes the same stair out as eighths, so the melody is stated plainly before the
  voice sings it.

**The Living Bass as the main character.** Its moves, all from the approved engine's own controls:

- the `scoop` growl into the first stroke (a fifth below at 0:00 and at the return);
- servo overshoot on every fresh strike;
- ratchet stairs with clicks;
- triplet `motion` on the D2 growl (64th-note growl in the gears);
- per-stroke macro steps: the bar-8 brownout (0.9 → 0.66 → 0.42) and the cold start (0.04 → 1 over two bars, one
  step per stroke);
- a `chassis` offset so the warm coughs knock like an engine block;
- a damped finger slide (ratchet 0, servo 0.25) for the warm version of the glide.

In the engine, one stem is split by a 110 Hz Linkwitz-Riley crossover (two cascaded 2-pole sections a side, which sum
flat):

- **`bass-sub`** is the clean phase-locked sine. It is mono, unsaturated, ducked 14 dB under each kick, and 4 dB higher
  in the gears.
- **`bass-grind`** is saturated again and low-passed at 6.5 kHz for small speakers, and ducked 10 dB under each kick.

**Kick and snare** (the authority), built on Concrete Gospel V2's measured layering:

- **Kick:** IRON PULSE tuned to D2, which settles a fifth above the G1 sub so it punches rather than booms, plus a skin
  slap knock (D3) and a log rim click (D5). It plays on the riff's first two strokes and its pickups, and never under
  the stair.
- **Snare (the hammer):** half-time on beat 3. It stacks TITANIUM CRACK down two semitones (G3), the HEADLINER context
  snare, a skin slap (G3), and the alien modal bar gated to a sixteenth as a sheet-metal ring. A few TITANIUM ghost
  notes.

**The engine room.** Each part has one mechanical job, and nothing runs in sixteenths:

| Part | Instrument | Job |
|---|---|---|
| Escapement | clock | Ticks on the off-beat eighths, tocks on 2 and 4, never on 1 or the hammer. In the gears, accented tocks sprout spring zips |
| Anvil | alien modal bar, gated | Tapped on the a-of-2, right before the hammer ("tink-CRACK"), and once more after the glide; a dotted-eighth echo |
| Recoil | damped spring | A sixteenth after the hammer in bar A; in bar 7, the laser snap that replaces the missing hammer |
| Wood | Hollow Log | Knuckle and rim ghosts in the holes; in the gears, a scrape that doubles the ratchet glide |
| Cooling metal | bearings | Eight slowing pings in the dark only |
| Gong | alien gong bar | One hit, the return |
| Breaker | clock click, log rim, clock tock, skin mute | The two blackouts |

## Instruments and provenance

| Role | Instrument | Version / source | Status |
|---|---|---|---|
| Riff, sub and grind | Living Bass | Signature Rack `1.0.0+mutation-001-A` | Frozen, owner-approved |
| Lament and the voice in the gears | Impossible Voice | Signature Rack `1.0.0+mutation-001-B` | Frozen, owner-approved |
| Escapement, recoil and laser, bearings, gong, anvil and snare metal | Mechanical Orchestra clock, spring, bearings, bar | Signature Rack `1.0.0+mutation-001-C` | Frozen, owner-approved |
| Kick knock, snare front, breaker thud | Hand Skin | Timbre Lab `0.1.0+timbre-lab` | Not approved, not frozen |
| Kick click, wood ghosts, scrape, breaker rim | Hollow Log | Timbre Lab `0.1.0+timbre-lab` | Not approved, not frozen |
| Kick body, snare crack | IRON PULSE, TITANIUM CRACK | V12 Signature v1 (`scripts/generate-v12-signature.ts`) | Engineering-verified pack |
| Snare body | Context snare | HEADLINER 001 (unchanged) | |
| Room | Rack shared FDN room (wet only) | Signature Rack 1.0.0 | |
| Mix | DaemonV12 0.7.0 production route | Unchanged engine; FFmpeg 6.1.1 for filters, compressor, MP3 and loudness | |

- **How Timbre Lab was activated:** through its documented opt-in, `node --import ./timbre-lab/register.ts
  studio-001/rack/cli.ts …`, in `build.ts`.
- **Approved engines untouched:** no engine, rack, Timbre Lab or repository file outside this directory was changed.
  `node studio-001/rack/cli.ts freeze` reports every frozen engine, script and audition intact; the output is in
  [`provenance/freeze-check.txt`](delivery/provenance/freeze-check.txt).
- **Concrete Gospel V1/V2 and every existing master are untouched.** V1/V2 live on their own branch
  (`claude/awesome-dijkstra-nf60w1`).
- **What it is made of:** numeric parameters and seeded noise only. There are no recordings, sample packs, SoundFonts,
  General MIDI, impulse responses or paid APIs. Nothing quotes or imitates an existing record. The lament figure (a
  descending chromatic fourth) is a centuries-old common device, not a melody from a recording.
- **Licensing:** every instrument used has a pending licensing declaration (V12 Signature, Signature Rack, Timbre Lab,
  HEADLINER). The master, MP3 and stems are therefore private research assets: they are not published and grant no
  license.

**Considered and not used:**

- **Breath Reed.** The reveal needed one human melodic voice. A second one (the reed) would have broken the piece's
  minimalism, and Concrete Gospel already used the reed for its hook.
- **Clay Pot and the context kick.** Their roles were already covered.

**No new instrument was needed.** Four constraints were worked around with existing features, and are worth knowing for
the next brief:

1. The modal bar rings past a second even when `muted`. The anvil and snare metal are one-shots gated in the engine.
2. At the machine end the Living Bass's folding saturates, so tempo-synced `motion` on a held note is only about a
   3 dB ripple in 1–4 kHz, not an audible stutter. The riff uses short strokes and a hole after the D2 growl instead.
3. The engine applies track effects after gain automation, so a track's reverb or delay tail cannot be gated or faded by
   automation. Long tails therefore come from the rack room, which is a stem and can be faded.
4. The Impossible Voice's glass halo rings on inside the voice stem after a note ends. The bar-16 glass send is pulled
   down so the coda is not swamped (below).

## Technical QA (one bounded pass)

**Before the first master (calibration, part of composing).** A series of calibration renders, each measured with
[`qa/measure.py`](qa/measure.py):

- The engine room measured far too quiet (clock −45, anvil −39, log −40 LUFS). It was raised 7–13 dB.
- The sub sat 5.9 dB under the mix RMS below 100 Hz. It was raised 5 dB.
- Everything was trimmed 3 dB because the layered kick stem peaked at 0.0 dBFS.
- The voice was made more intimate in the dark and pushed forward in the gears.
- The glass halo was ringing into the coda at 61–67 % of its energy, louder than the sigh. The bar-16 glass send was
  pulled down; the halo's loudest resonator now sits 12 dB under the voice.
- The riff strokes were shortened after the first render smeared the 3+3+2.

**The QA pass.** The candidate was measured, then levels, automation and one effect parameter were fixed. Notes and
form were not changed. `node build.ts pre-qa` reproduces the candidate exactly. Both records are in `provenance/`:
`qa-before-fix-pass.json` and `qa-final.json`.

| Found | Fix | Before → after |
|---|---|---|
| The file's last 10 ms were not silent: the voice's own 1.1 s reverb (applied after the end fade) was cut off at 30.000 s | The voice track reverb became a 0.45 s booth; the long space is the rack room, which is faded | −37.1 → **−55.8 dBFS** |
| The gears' low end was 2 dB lighter than the other running sections | Sub +4 dB from the return (was +2) | −6.0 → **−4.9 dB** under the mix RMS below 100 Hz (other sections −3.8 to −5.1) |
| The kick led the bass by only 7.9 dB in the phone band in its first 30 ms | The grind ducks 10 dB under each kick (was 8) | 7.9 → **9.6 dB** |

**Final master.** All of these come from `qa-final.json` and the engine's own manifest.

- **Format:** 1,323,000 frames, 44.1 kHz stereo PCM16.
- **Loudness:** −13.4 LUFS integrated, LRA 6.7 LU.
- **Peaks:** true peak −1.3 dBTP, sample peak −1.30 dBFS.
- **Clipping:** none. There are 0 full-scale samples in the master and in the decoded MP3. The engine's clipped-sample
  counters read 0 on all 13 tracks and the master; the hottest track before its clip stage is the kick at −2.4 dBFS.
- **Phone copy:** the MP3 measures −13.7 LUFS, with a decoded peak of −1.56 dBFS.
- **Dynamic contrast:**
  - Section RMS (dBFS): ignition −15.1 · engine room −15.3 · brownout −16.5 · dark −21.4 · cold start −15.3 · gears
    −13.6 · coda −20.9.
  - 3 s RMS range: 8.3 dB.
- **Unintended silence:** no 250 ms window falls under −60 dBFS. The quietest moment of the dark is −34 dBFS.
- **Kick:** the click is level with its sub body (+0.1 dB) and the knock is +1.2 dB. In its first 40 ms the kick leads
  the bass by 12.7 dB below 120 Hz. Kick hits jump 11.6 dB out of the master.
- **Snare:** the first 10 ms are 4.1 dB over the next 30 ms. Energy shares: body 53 %, crack 20 %, air 10 %. Hits jump
  11.4 dB out of the master.
- **Sub and mono:**
  - The bass sub is 12.4 dB down just after each kick.
  - Left/right correlation below 120 Hz is 0.9999, and the side signal there is 42 dB under the mid.
  - The mono sum is only −0.12 dB from stereo.
  - Content at 18–30 Hz is 28.5 dB under the 40–60 Hz band.
- **Voice over the rest of the mix (300 Hz–4 kHz, while it sounds):** dark +13.8 · cold start +2.1 · gears +3.5 ·
  coda +17.1 dB.
- **Tuning (cents):**
  - Bass G1 strokes median +1.7 (−2.1 to +3.8). The D2 after the glide's overshoot +2.0, F♯2 −0.4, E2 +0.5.
  - Voice G4 +1.8, E4 +2.3, E♭4 +4.6, D4 +6.1.
  - Held test notes read within 0.5 cents.
  - Single periods at the machine end alternate by ±35–55 cents. That is the grind and gear's f0/2 component, not
    mistuning, so pairs of periods are measured.
- **Clicks:** none in the voice stem, where the 2.9 ms gate edges sit, or in the sub, room or bearings. The flagged
  high-frequency transients are the kick clicks, the ratchet teeth, the cold-start chassis knocks and the gong strike,
  all intended.
- **Stems:** all 13 start at frame 0 and have the master's exact frame count.
- **Determinism:** a second from-scratch build produced a byte-identical master WAV, MP3 and all 13 stems (Linux, Node
  22.23.5, FFmpeg 6.1.1).

## Things only listening can decide

- Is the riff unmistakable within two seconds, and does the ratchet stair read as a melody or as a noise?
- Does the voice in the dark sound like a person, and does the reveal feel inevitable (the same stair) or merely sudden?
- In the gears, is the gated voice a hook, or clutter on top of the riff?
- Phone band (300 Hz–8 kHz): the bass leads the rest of the mix by 6.2 dB in bars 1–2 and by 3.5 dB in the engine
  room. In the gears it sits 5.4 dB under the voice and the engine room.
  - Is the growl aggressive enough on a phone?
  - Is the kick's click (level with its body) hard enough against it?
- The blackouts are hard cuts with only the breaker's reverb. Do they read as a power failure, or as an edit?
- Do the last 0.9 s (the E♭→D sigh alone) leave you wanting the rest of the song?

## Rebuild

```bash
node experiments/blackout-engine-001/build.ts pre-qa
```

```bash
node experiments/blackout-engine-001/build.ts
```

```bash
python3 -I experiments/blackout-engine-001/qa/measure.py experiments/blackout-engine-001/build/pre-qa --json experiments/blackout-engine-001/build/pre-qa/qa.json
```

```bash
python3 -I experiments/blackout-engine-001/qa/measure.py experiments/blackout-engine-001/build/final --json experiments/blackout-engine-001/build/final/qa.json
```

```bash
node experiments/blackout-engine-001/deliver.ts
```

- **Build:** about 45 s per stage. Needs Node 22.18+ and FFmpeg with libmp3lame.
- **QA:** analysis only; needs numpy and scipy.
- `build/` is ignored by git.

| Path | Contents |
|---|---|
| [`compose.ts`](compose.ts) | The composition: riff, lament, engine room, drums, automation, mix, the QA switch. The single source of truth |
| [`source/`](source) | Generated rack score, engine project and the four one-shot kits (the score and source files) |
| [`build.ts`](build.ts), [`deliver.ts`](deliver.ts) | Pipeline: rack render (Timbre Lab opt-in) → one-shots (rack `kit`) → isolated engine project → engine render → delivery |
| [`qa/measure.py`](qa/measure.py) | The technical QA |
| [`delivery/`](delivery) | Master, MP3, stems, `provenance/` and `SHA256SUMS` |

`provenance/` holds the engine manifest and analysis, the rack manifest and expanded performance (every note and the
instrument versions), the one-shot catalogs, both QA records and the freeze check.

Stopped here for the listening review. No extended arrangement until the owner asks.
