# DaemonV12 V0 Specification

Status: **normative** for engine `0.0.x` and project `formatVersion: 1`.
V0.2 preserves this GM baseline; additive sample behavior is specified in
[V0_2_SAMPLES.md](V0_2_SAMPLES.md). Engine version strings below are historical V0 examples.
Rationale lives in [ARCHITECTURE.md](ARCHITECTURE.md). This document says *what* to build, exactly.
Wherever a number, string, ordering or byte is given here, the implementation must match it exactly.

Contents:
1. Scope
2. Project format
3. Timing model
4. Validation
5. Internal types
6. MIDI output
7. Rendering
8. CLI contract
9. Diagnostics
10. Demo
11. Acceptance criteria

Appendices: A. GM program names · B. Key signatures

---

## 1. Scope

**In V0:**

- JSON project files (`formatVersion: 1`): constant tempo, constant time signature, optional key,
  1–15 tracks, General MIDI instruments by name, track-local patterns placed by clips, notes and chords.
- Staged, collect-all validation with structured diagnostics and fix hints.
- Musical-time resolution to integer ticks (960 PPQ).
- Standard MIDI File writer (format 1) with a canonical byte layout.
- WAV rendering through FluidSynth and a GM SoundFont, behind a renderer interface.
- CLI: `validate`, `midi`, `render`; human output and `--json`; exit codes by failure class.
- A render manifest that records every input needed to reproduce a WAV.
- An 8-bar demo (`examples/demo.json`) that renders headlessly in the devcontainer/Codespaces.

**Not in V0** (do not build, not even partially): stems; per-track volume or pan; mute/solo; drums or
the GM drum channel; samples; synthesis; effects; FFmpeg; MP3; loudness or any audio analysis; tempo
or meter changes; swing, humanize or randomness; transpose or repeat sugar; CC, pitch bend, sustain
pedal or automation; pickups; markers or sections; MCP; JSON Schema export; `fmt` or `inspect`
commands; watch mode; config files; Windows/macOS support work; web UI; plugin systems.

---

## 2. Project format (`formatVersion: 1`)

### 2.1 Minimal valid project

This is also the test fixture `tests/fixtures/valid/minimal.json`. Copy it exactly; §6.5 pins its MIDI bytes.

```json
{
  "formatVersion": 1,
  "title": "Minimal",
  "bpm": 120,
  "timeSignature": "4/4",
  "bars": 1,
  "tracks": [
    {
      "id": "lead",
      "instrument": { "type": "gm", "program": "acoustic_grand_piano" },
      "clips": [{ "bar": 1, "pattern": "one" }],
      "patterns": [
        {
          "id": "one",
          "bars": 1,
          "notes": [
            { "start": "1:1", "pitch": "C4", "duration": "1/4", "velocity": 0.8 },
            { "start": "1:2+1/8", "pitch": "E4", "duration": "1/8" }
          ]
        }
      ]
    }
  ]
}
```

### 2.2 Objects

Every object is **closed**: a field not listed here is an `UNKNOWN_FIELD` error. "Required" means that
leaving the field out is a `MISSING_FIELD` error. Defaults apply only to optional fields.

**Project** (root object)

| Field | Type | Req. | Rules |
|---|---|---|---|
| `formatVersion` | integer | yes | Must be `1`. |
| `title` | string | yes | 1–200 characters, not only whitespace. Becomes the MIDI sequence name. |
| `description` | string | no | ≤ 2000 characters. Free text for intent. Ignored by the engine. |
| `bpm` | number | yes | `20 ≤ bpm ≤ 300`. **Quarter notes per minute**, whatever the meter. Decimals allowed. |
| `timeSignature` | string | yes | `"N/D"`, see §2.3. |
| `key` | string | no | `"<Tonic> major"` or `"<Tonic> minor"`, see Appendix B. Metadata only. Written to MIDI. |
| `bars` | integer | yes | `1–1000`. Project length. Every clip must end within it. |
| `seed` | integer | no (default `0`) | `0–4294967295`. V0 uses no randomness. The seed is recorded in the manifest. |
| `tracks` | array of Track | yes | 1–15 items. Order is meaningful: it sets the MIDI channel and track order. |

**Track**

| Field | Type | Req. | Rules |
|---|---|---|---|
| `id` | string | yes | Id grammar (§2.3). Unique among tracks. Becomes the MIDI track name. |
| `description` | string | no | ≤ 2000 characters. |
| `instrument` | Instrument | yes | |
| `clips` | array of Clip | yes | May be empty (warning `TRACK_EMPTY`). |
| `patterns` | array of Pattern | yes | May be empty. |

**Instrument** (discriminated by `type`. V0 has exactly one type.)

| Field | Type | Req. | Rules |
|---|---|---|---|
| `type` | string | yes | Must be `"gm"` (General MIDI sound set). Anything else: `UNSUPPORTED_INSTRUMENT_TYPE`. |
| `program` | string | yes | A name from Appendix A, for example `"electric_bass_finger"`. Numbers are rejected (`WRONG_TYPE`, and the hint names both the 0-based and the 1-based reading). |

**Clip** (places a pattern on the timeline)

| Field | Type | Req. | Rules |
|---|---|---|---|
| `bar` | integer | yes | ≥ 1. Absolute bar where the pattern's `"1:1"` lands. `bar + pattern.bars − 1 ≤ project.bars`. |
| `pattern` | string | yes | Id of a pattern **in the same track**. |

**Pattern** (musical content; all times are pattern-relative)

| Field | Type | Req. | Rules |
|---|---|---|---|
| `id` | string | yes | Id grammar. Unique within its track. |
| `description` | string | no | ≤ 2000 characters. |
| `bars` | integer | yes | `1–1000`. Pattern length. |
| `notes` | array of Note | yes | May be empty. |

**Note** (one object per note or chord, written on one line)

| Field | Type | Req. | Rules |
|---|---|---|---|
| `start` | string | yes | Position (§2.3), **relative to the pattern**: `"1:1"` is the pattern's first beat. |
| `pitch` | string, integer, or non-empty array of them | yes | Pitch grammar (§2.3). An array is a chord: every pitch shares `start`, `duration` and `velocity`. |
| `duration` | string | yes | Duration (§2.3), > 0. The note must end within the pattern. |
| `velocity` | number | no (default `0.8`) | `0 < velocity ≤ 1`. Loudness intent. Converted to MIDI in §6.3. |

### 2.3 Value grammars

Grammars are exact. There is no whitespace trimming and no case folding. These are the literal
JavaScript regular expressions (copy them as written):

```
id              /^[a-z][a-z0-9-]*$/
timeSignature   /^([1-9][0-9]?)\/([1-9][0-9]?)$/
duration        /^([1-9][0-9]{0,3})\/([1-9][0-9]{0,3})$/
position        /^([1-9][0-9]{0,3}):([1-9][0-9]?)(?:\+([1-9][0-9]{0,3})\/([1-9][0-9]{0,3}))?$/
pitch (string)  /^([A-G])(#|b)?(-1|[0-9])$/
key             /^([A-G])(#|b)? (major|minor)$/
```

| Value | Rules beyond the regex |
|---|---|
| Id | Length ≤ 32. Example: `"phrase-a"`. |
| Time signature | Numerator 1–32. Denominator ∈ {1, 2, 4, 8, 16, 32}. |
| Duration | `N/D` of a whole note. `N × 3840 / D` must be an integer (`OFF_GRID` otherwise). |
| Position | `BAR:BEAT` or `BAR:BEAT+N/D`. BAR ≤ pattern `bars`. BEAT ≤ time-signature numerator. Offset `N/D` on the grid and **strictly less than one beat** (canonical form). |
| Pitch (string) | MIDI number = `12 × (octave + 1) + pc(letter) + acc`, where pc C=0 D=2 E=4 F=5 G=7 A=9 B=11 and acc `#`=+1, `b`=−1. Must be 0–127. **C4 = 60** (scientific pitch notation). |
| Pitch (integer) | 0–127. |
| Key | Must appear in Appendix B. |

Pitch examples: `C4`=60, `A4`=69, `C-1`=0, `G9`=127, `Bb1`=34, `D2`=38, `C#5`=73, `B#3`=60, `Cb4`=59,
`E#4`=65. Invalid: `H#4`, `c4`, `C#`, `C10`, `G#9` (128), `Cb-1` (−1), `"60"` (a string of digits).

### 2.4 Semantics

- **Pattern-relative time.** Note positions are measured from the start of their pattern. A clip with
  `"bar": 5` plays the pattern's `"1:1"` at project bar 5, beat 1.
- **Clips may overlap** (layering on one instrument is legal). The flattened result must not contain
  two overlapping notes of the same pitch on the same track (`NOTE_OVERLAP`). Back-to-back is fine:
  a note may start exactly where another note of the same pitch ends.
- **Track order** sets the MIDI channel (§6.2) and MIDI track order. Pattern order, clip order and
  note order inside a pattern do not affect output.
- **Unused patterns** are legal (warning `PATTERN_UNUSED`). A track with no clips is legal (warning `TRACK_EMPTY`).
- **Velocity default** is `0.8`. The **seed default** is `0`. A missing `key` means none.

### 2.5 Authoring conventions (non-normative)

Field order: project `formatVersion, title, description, bpm, timeSignature, key, bars, seed, tracks`.
Track: `id, description, instrument, clips, patterns`. Note: `start, pitch, duration, velocity`.
Keep one note, clip and instrument object per line (see `examples/demo.json`). Use `description`
fields to record musical intent.

---

## 3. Timing model

### 3.1 Constants and formulas

```
PPQ               = 960                     ticks per quarter note (engine constant, never in files)
TICKS_PER_WHOLE   = 3840
ticksPerBeat      = 3840 / denominator
ticksPerBar       = numerator × ticksPerBeat
durationTicks(N/D)= N × 3840 / D            (must be an integer)
positionTicks(B:b+N/D) = (B − 1)·ticksPerBar + (b − 1)·ticksPerBeat + durationTicks(N/D)
noteTick          = (clip.bar − 1)·ticksPerBar + positionTicks(note.start)
endTick           = project.bars × ticksPerBar
usPerQuarter      = Math.round(60_000_000 / bpm)
seconds(ticks)    = ticks × usPerQuarter / (960 × 1_000_000)        (reporting only)
```

All tick math uses integer JavaScript numbers. The largest possible value (1000 bars of 32/1) is
122,880,000, which is well inside both the safe-integer range and the MIDI delta-time limit
(0x0FFFFFFF).

### 3.2 Worked examples

| Meter | ticksPerBeat | ticksPerBar | Example → ticks |
|---|---|---|---|
| 4/4 | 960 | 3840 | `"3:2+1/8"` → 7680 + 960 + 480 = **9120** |
| 3/4 | 960 | 2880 | `"2:3"` → 2880 + 1920 = **4800** |
| 6/8 | 480 | 2880 | `"2:4"` → 2880 + 1440 = **4320**. `"1:1+1/16"` → **240** |
| 7/8 | 480 | 3360 | `"1:7"` → **2880** |
| 2/2 | 1920 | 3840 | `"1:2"` → **1920**. `"1:1+1/4"` → **960** (valid: 1/4 < one half-note beat) |

Durations: `"1/4"`=960, `"1/8"`=480, `"3/8"`=1440, `"1/1"`=3840, `"2/1"`=7680, `"1/12"`=320 (triplet
eighth), `"1/20"`=192 (quintuplet sixteenth), `"1/256"`=15. `"1/7"` and `"1/512"` are `OFF_GRID`.
The three triplet eighths of beat 1 in 4/4 are `"1:1"`, `"1:1+1/12"`, `"1:1+1/6"`.

Canonical-form errors, all `POSITION_OUT_OF_RANGE` with the computed canonical spelling as hint:
`"1:1+1/4"` in 4/4 (hint `"1:2"`), `"1:5"` in 4/4 (hint `"2:1"`), `"1:1+1/8"` in 6/8 (hint `"1:2"`).

### 3.3 Canonical formatting (ticks → strings)

Used in messages, hints and summaries.
- `formatPosition(t)`: `bar = floor(t / ticksPerBar) + 1`, `r = t mod ticksPerBar`,
  `beat = floor(r / ticksPerBeat) + 1`, `o = r mod ticksPerBeat`. The result is `"bar:beat"` if `o = 0`,
  else `"bar:beat+n/d"`, where `n/d` is `o/3840` reduced by the gcd.
  Examples (4/4): 0 → `"1:1"`, 1440 → `"1:2+1/8"`, 640 → `"1:1+1/6"`, 3840 → `"2:1"`.
- `formatDuration(t)`: `t/3840` reduced, as `"n/d"`. Examples: 1440 → `"3/8"`, 7680 → `"2/1"`.

---

## 4. Validation

### 4.1 Stages (collect all errors; never cascade)

| Stage | Runs when | Checks |
|---|---|---|
| **0 Load** | always | Read the file. Strip a leading UTF-8 BOM. An empty file is a `JSON_PARSE_ERROR`. `JSON.parse`. |
| **1 Structure** | JSON parsed | Root is an object. `formatVersion` comes first: if it is present and is not exactly the number `1` (for example `2`, or the string `"1"`), emit `UNSUPPORTED_FORMAT_VERSION` and **stop**. Then, for every object: required, unknown and type checks; scalar grammars (ids, time signature, key, pitch, position syntax, duration syntax); numeric ranges; array lengths; instrument type and GM name. |
| **2 Semantics** | after stage 1 (always attempted) | Duplicate ids. Clip → pattern references. Duration and offset grid (`OFF_GRID`). Beat ≤ numerator, offset < beat, bar ≤ pattern bars. Note end ≤ pattern end. Clip end ≤ project end. Warnings. **Skip any check whose inputs failed stage 1.** For example, an invalid `timeSignature` skips every position, duration and clip-bound check, and an invalid `pattern.bars` skips the bound checks that depend on it. |
| **3 Resolve** | only if stages 1–2 produced **zero errors** | Flatten clips into a Timeline (§5.2). `NOTE_OVERLAP`. |

Stage-3 overlap rule: per track, group notes by MIDI pitch and sort by tick. If
`next.tick < prev.tick + prev.durationTicks`, report `NOTE_OVERLAP` at the *later* note's path. The
message names both notes (paths, the clips they came from and absolute positions via `formatPosition`)
and says so when both come from the same chord. Report the overlaps of a track ordered by tick, then pitch.

### 4.2 Diagnostic order and cap

- Stage 1 and 2 diagnostics follow traversal order. Within an object: known fields in the order of the
  §2.2 tables, then unknown fields in file order. Arrays go in index order, depth first. Stage 3
  diagnostics come after them, ordered by track index, tick, pitch.
- At most **100** diagnostics are reported (errors and warnings combined). If more exist, the JSON
  result carries `"omitted": <count>`, and human output ends with `… and <count> more`.

### 4.3 Paths

Dot/bracket notation from the root, with no leading `$` or dot: `bpm`,
`tracks[1].patterns[0].notes[3].pitch`, `tracks[0].clips[2]`. An unknown key that is not a plain
identifier uses JSON-quoted brackets: `tracks[0]["my key"]`. The root itself is the empty string,
printed as `(root)`.

What each diagnostic points at:
- Field-level problems (type, grammar, range, unknown or missing field) point at the field itself,
  for example `…notes[0].pitch` or `…notes[0].pitch[1]` for a chord member.
- `DUPLICATE_ID` points at the later `id`.
- `UNKNOWN_PATTERN` points at `clips[k].pattern`. `CLIP_EXCEEDS_PROJECT` points at `clips[k].bar`.
- `NOTE_EXCEEDS_PATTERN` points at the note's `duration`. `NOTE_OVERLAP` points at the later *note object*.
- `PATTERN_UNUSED` points at the pattern object. `TRACK_EMPTY` points at the track's `clips` array.

---

## 5. Internal types

These shapes are normative in spirit: the field names may differ slightly, but the information content
and the split between the two layers must stay.

### 5.1 `Project` (output of validation: normalized, every musical string parsed)

```ts
interface Project {
  formatVersion: 1;
  title: string;
  description: string | null;
  bpm: number;
  timeSignature: { numerator: number; denominator: number };
  key: { text: string; sharpsFlats: number; mode: "major" | "minor" } | null;
  bars: number;
  seed: number;
  tracks: Track[];
}
interface Track {
  id: string;
  description: string | null;
  instrument: { type: "gm"; program: number; programName: string };
  clips: { bar: number; pattern: string }[];
  patterns: Pattern[];
}
interface Pattern { id: string; description: string | null; bars: number; notes: Note[] }
interface Note {
  startTicks: number;      // pattern-relative
  durationTicks: number;
  pitches: number[];       // MIDI numbers in authored order; length ≥ 1
  velocity: number;        // 0 < v ≤ 1, default applied
}
```

### 5.2 `Timeline` (output of resolve: the engine's renderer-neutral score)

```ts
interface Timeline {
  title: string;
  ppq: 960;
  bpm: number;
  usPerQuarter: number;
  timeSignature: { numerator: number; denominator: number };
  key: { sharpsFlats: number; mode: "major" | "minor" } | null;
  ticksPerBar: number;
  endTick: number;                     // bars × ticksPerBar
  tracks: TimelineTrack[];             // project track order
}
interface TimelineTrack {
  id: string;
  index: number;                       // 0-based position in project.tracks
  instrument: { type: "gm"; program: number };
  notes: TimelineNote[];               // sorted by (tick, pitch)
}
interface TimelineNote { tick: number; durationTicks: number; pitch: number; velocity: number }
```

---

## 6. MIDI output (Standard MIDI File)

### 6.1 File layout

- Header chunk `MThd`: length 6, **format 1**, `ntrks = 1 + tracks.length`, division **960** (`03 C0`).
- Track chunk 0 is the **conductor**: meta events only.
- Track chunk *k* (1…n) holds `timeline.tracks[k−1]`.
- Delta times are MIDI variable-length quantities (VLQ). **No running status**: every event carries its
  status byte. Chunk lengths are 32-bit big-endian.
- Text meta events are UTF-8. The length VLQ counts bytes.

### 6.2 Events

Conductor track, all at tick 0, in this order:
1. `FF 03 <len> <title>`: sequence/track name.
2. `FF 58 04 nn dd cc 08`: time signature. `nn` = numerator, `dd` = log2(denominator),
   `cc` = 96 / denominator (MIDI clocks per beat).
3. `FF 59 02 sf mi`: key signature, **only if `key` is set**. `sf` = sharps (+) or flats (−) as a signed
   byte (Appendix B), `mi` = 0 for major, 1 for minor.
4. `FF 51 03 tt tt tt`: tempo, `usPerQuarter` as 24-bit big-endian.
5. `FF 2F 00`: End of Track at **`endTick`**.

Music track for `tracks[i]`, channel `c = i < 9 ? i : i + 1` (channel index 9 is reserved for GM drums):
1. tick 0: `FF 03 <len> <track id>`
2. tick 0: `Cc pp`: program change, `pp` = GM program number (Appendix A)
3. each note: Note On `9c kk vv` at `tick`; Note Off `8c kk 40` at `tick + durationTicks`
4. `FF 2F 00` at **`endTick`**

**Canonical order inside a track:** sort by `(tick, rank, pitch)` with rank: track name 0, program
change 1, **note off 2, note on 3**. Note-offs come before note-ons at the same tick so that a repeated
pitch re-triggers cleanly. The overlap rule makes the order total.

End of Track is always at `endTick`, even when it is later than the last note. That keeps the exact
musical length in the file. Rendering tails are the renderer's job (§7).

### 6.3 Conversions

- MIDI velocity = `clamp(Math.round(velocity × 127), 1, 127)`. So 0.8 → 102, 0.9 → 114, 0.7 → 89,
  0.85 → 108, 0.95 → 121, 1 → 127.
- Tempo: `usPerQuarter = Math.round(60_000_000 / bpm)`. So 96 → 625000 (`09 89 68`), 120 → 500000
  (`07 A1 20`), 110 → 545455.
- Time signature bytes: 4/4 → `04 02 18 08`. 3/4 → `03 02 18 08`. 6/8 → `06 03 0C 08`.
- D minor → `FF 59 02 FF 01`.
- VLQ: 0 → `00`, 127 → `7F`, 128 → `81 00`, 480 → `83 60`, 960 → `87 40`, 1920 → `8F 00`,
  3840 → `9E 00`, 16383 → `FF 7F`, 16384 → `81 80 00`, 30720 → `81 F0 00`, 0x0FFFFFFF → `FF FF FF 7F`.

### 6.4 Encoder contract

`encodeSmf(timeline: Timeline): Uint8Array` is pure and total for any valid Timeline. The same input
always gives the same bytes. It must not read the clock, the environment or the file system.

### 6.5 Golden bytes: minimal fixture (§2.1), 96 bytes

```
4d 54 68 64 00 00 00 06 00 01 00 02 03 c0                          MThd, format 1, 2 tracks, 960 PPQ
4d 54 72 6b 00 00 00 1f                                            MTrk 0, 31 bytes
  00 ff 03 07 4d 69 6e 69 6d 61 6c                                 name "Minimal"
  00 ff 58 04 04 02 18 08                                          4/4
  00 ff 51 03 07 a1 20                                             tempo 500000
  9e 00 ff 2f 00                                                   EOT @3840
4d 54 72 6b 00 00 00 23                                            MTrk 1, 35 bytes
  00 ff 03 04 6c 65 61 64                                          name "lead"
  00 c0 00                                                         program 0, channel 0
  00 90 3c 66                                                      @0    C4 on, vel 102
  87 40 80 3c 40                                                   @960  C4 off
  83 60 90 40 66                                                   @1440 E4 on, vel 102 (default 0.8)
  83 60 80 40 40                                                   @1920 E4 off
  8f 00 ff 2f 00                                                   EOT @3840
```

SHA-256 of these 96 bytes: `8c96235bf3f12d96cd33c370ff238962a9fd5c0e3cc45e53fe4480dd4f05e6fc`.

---

## 7. Rendering

### 7.1 Renderer interface (`src/render/renderer.ts`)

```ts
interface AudioRenderer {
  readonly name: string;
  render(request: RenderRequest): Promise<RenderOutcome>;   // expected failures are returned, not thrown
}
interface RenderRequest { midiPath: string; wavPath: string }
type RenderOutcome =
  | { ok: true; renderer: { name: string; version: string; settings: Record<string, string | number | boolean> };
      wav: { frames: number; sampleRate: number; channels: number; bitsPerSample: number } }
  | { ok: false; diagnostic: Diagnostic };
```

`src/render/index.ts` is the only entry point other modules may import from `render/`. It exports the
types, `resolveSoundfont(options)` and `createDefaultRenderer(options)`, which in V0 returns the
FluidSynth renderer. **Only files inside `src/render/` may import `src/render/fluidsynth.ts`.**
Environment variables are read from an injected `env` object, never directly from `process.env`
inside `render/`, so tests can control them.

### 7.2 SoundFont resolution (`src/render/soundfont.ts`)

1. `--soundfont <path>` if given. A missing file is `SOUNDFONT_NOT_FOUND`, with no fallback.
2. Otherwise `DAEMONV12_SOUNDFONT` if set and non-empty. Same rule: missing → `SOUNDFONT_NOT_FOUND`.
3. Otherwise the first existing file of: `/usr/share/sounds/sf2/FluidR3_GM.sf2`,
   `/usr/share/soundfonts/FluidR3_GM.sf2`, `/usr/share/sounds/sf2/default-GM.sf2`,
   `/usr/share/soundfonts/default.sf2`. If none exists: `SOUNDFONT_NOT_FOUND` (`received` = the list
   searched; hint = `sudo apt-get install -y fluid-soundfont-gm`, or pass `--soundfont`).

Validity check: the file is a readable regular file whose first 12 bytes are `RIFF`, any 4 bytes, then
`sfbk`. Otherwise: `SOUNDFONT_INVALID`.
Identity for the manifest: `basename(realpath)`, size in bytes, SHA-256 (streamed).

### 7.3 FluidSynth adapter (`src/render/fluidsynth.ts`)

- Executable: `env.DAEMONV12_FLUIDSYNTH` if set, otherwise `"fluidsynth"` (resolved through `PATH` by
  `spawn`). Always use `spawn` with an argument array and **no shell**.
- **Probe:** `<exe> --version` (timeout 10 s). A spawn `ENOENT` is `RENDERER_NOT_FOUND` (hint:
  `sudo apt-get install -y fluidsynth`, or set `DAEMONV12_FLUIDSYNTH`). Any other failure or a non-zero
  exit is `RENDERER_FAILED`. The version is the first match of `/version\s+(\d+\.\d+\.\d+)/i` on stdout,
  else `"unknown"`.
- **Render:** write to `tmp = wavPath + ".tmp"` with exactly these arguments, in this order:

  ```
  -n -i -F <tmp> -T wav -O s16 -r 44100 -g 0.5 -R 0 -C 0 -o synth.cpu-cores=1 <soundfont> <midi>
  ```

  (no MIDI input, no shell, fast file render, 16-bit WAV, 44.1 kHz, gain 0.5, reverb off, chorus off,
  single-threaded). Timeout: 120 s by default, configurable through the factory options for tests.
- **Success requires all of:** exit code 0; no stderr line matching
  `/error|panic|not a soundfont or midi file|no midi file specified/i`; `tmp` exists and parses
  (`render/wav.ts`) as RIFF/WAVE, PCM (format tag 1), 2 channels, 44100 Hz, 16-bit, ≥ 1 frame. On
  success, rename `tmp` → `wavPath`.
- **Any failure:** delete `tmp` and return `RENDERER_FAILED`. Its `message` gives the reason (exit code,
  timeout, error line, missing or invalid output). Its `received` is `{ exitCode, stderr }`, with
  stderr truncated to 2000 characters. Its `hint` is the full command line, so an agent can reproduce
  the failure by hand.
- Settings reported in the outcome: `{ sampleRate: 44100, sampleFormat: "s16", channels: 2, gain: 0.5, reverb: false, chorus: false, cpuCores: 1 }`.

Why these rules: FluidSynth 2.3.4 exits **0** with a missing or corrupt SoundFont (and writes a silent
WAV) and exits **0** when the output path is unwritable. Its exit code alone cannot be trusted. Float
output is not reproducible (libsndfile timestamps the PEAK chunk), so the format is pinned to s16.

### 7.4 WAV reader (`src/render/wav.ts`)

`readWavInfo(bytes | path)` parses `RIFF`/`WAVE`, walks the chunks (sizes are padded to even length),
and returns `{ formatTag, channels, sampleRate, bitsPerSample, dataOffset, dataBytes, frames }`, or an
error for a malformed file. Do not assume a 44-byte header.

### 7.5 `render` sequence (normative order)

1. Compile the project (stages 0–3). Errors → exit 1 (or exit 2 for `FILE_NOT_FOUND` / `FILE_READ_FAILED`).
2. `resolveSoundfont`. Failure → exit 3.
3. Probe the renderer. Failure → exit 3.
4. Create the out-dir (`mkdir -p`). Failure → `OUTPUT_WRITE_FAILED`, exit 3.
5. Write `<name>.mid` atomically (`.tmp` + rename).
6. `renderer.render({ midiPath, wavPath })`.
7. Compute hashes and write `<name>.render.json` atomically.
8. Print the result. Exit 0.

On any failure after argument parsing (steps 1–8), delete `<name>.mid`, `<name>.wav`,
`<name>.render.json` and any `.tmp` siblings in the out-dir, then exit with the failure's code.
`midi` follows the same pattern for `<name>.mid`. On success **and** on failure it also deletes
`<name>.wav` and `<name>.render.json`, because they no longer match the new MIDI. The invariant agents
can rely on: every `<name>.*` artifact in the out-dir comes from the latest successful run for that
project name.

### 7.6 Render manifest (`<name>.render.json`)

Keys in exactly this order. Two-space indentation and a trailing newline. File names are **basenames
only**. No timestamps, hostnames or absolute paths. Floats are rounded to 6 decimals.

```json
{
  "engine": { "name": "daemonv12", "version": "0.0.1" },
  "project": { "file": "demo.json", "sha256": "<sha256 of project file bytes>", "formatVersion": 1, "seed": 1 },
  "midi": { "file": "demo.mid", "sha256": "<hex>", "bytes": 911, "ppq": 960, "durationTicks": 30720, "durationSeconds": 20, "notes": 89 },
  "renderer": { "name": "fluidsynth", "version": "2.3.4", "settings": { "sampleRate": 44100, "sampleFormat": "s16", "channels": 2, "gain": 0.5, "reverb": false, "chorus": false, "cpuCores": 1 } },
  "soundfont": { "file": "FluidR3_GM.sf2", "sha256": "<hex>", "bytes": 148398306 },
  "wav": { "file": "demo.wav", "sha256": "<hex>", "bytes": 4069420, "frames": 1017344, "durationSeconds": 23.069025 }
}
```

The example values are the reference values for the demo on Ubuntu 24.04 with FluidSynth 2.3.4 and
FluidR3_GM (`sha256 74594e8f4250680adf590507a306655a299935343583256f3b722c48a1bc1cb0`). Only the
`midi` values are environment-independent.

---

## 8. CLI contract

### 8.1 Synopsis

```
daemonv12 validate <project.json> [--json]
daemonv12 midi     <project.json> [--out-dir <dir>] [--json]
daemonv12 render   <project.json> [--out-dir <dir>] [--soundfont <file.sf2>] [--json]
daemonv12 help | --help | -h          usage on stdout, exit 0
daemonv12 --version | -v              "daemonv12 0.0.1" on stdout, exit 0
```

- Entry point: `bin/daemonv12.js` (`#!/usr/bin/env node` + `import "../src/cli/main.ts";`, executable
  bit set). Inside the repo, `npx daemonv12 …` works with no build step. `npm link` installs it globally.
- Arguments are parsed with `node:util` `parseArgs` in strict mode. Exactly one positional (the project
  path) after the command. An unknown command, an unknown flag, a missing or extra positional, a
  missing flag value, or a flag that does not apply to the command (`--out-dir` on `validate`,
  `--soundfont` on anything but `render`) is a `USAGE_ERROR` with exit 2. No arguments at all prints
  usage to stderr and exits 2.
- `--out-dir` defaults to `renders`, resolved against the current working directory, and is created
  if missing.
- `<name>` = the project file's basename with a trailing `.json` (case-insensitive) removed.
  Artifacts: `<out-dir>/<name>.mid`, `<out-dir>/<name>.wav`, `<out-dir>/<name>.render.json`.
  Reported paths are `path.join(outDir, file)` as given (relative stays relative).
- Environment variables: `DAEMONV12_SOUNDFONT` (default SoundFont), `DAEMONV12_FLUIDSYNTH` (renderer
  executable).
- Set `process.exitCode`. Never call `process.exit()` before stdout has drained, or piped JSON gets
  truncated.

### 8.2 Exit codes

| Code | Class | Meaning for an agent | Codes |
|---|---|---|---|
| 0 | success | Artifacts are fresh. Warnings may exist. | none |
| 1 | project invalid | Edit the project file. | `JSON_PARSE_ERROR` … `NOTE_OVERLAP` (§9.2) |
| 2 | usage | Fix the command line or the path. | `USAGE_ERROR`, `FILE_NOT_FOUND`, `FILE_READ_FAILED` |
| 3 | environment or renderer | Fix the machine (install, path, permissions). | `SOUNDFONT_*`, `RENDERER_*`, `OUTPUT_WRITE_FAILED` |
| 4 | internal | An engine bug. Report it. | `INTERNAL_ERROR` |

If several classes occur, the highest code wins (4 > 3 > 2 > 1).

### 8.3 Human output

- Success: a summary on **stdout**. Diagnostics (warnings) go to **stderr**, before the summary.
  ```
  OK examples/demo.json
    "DaemonV12 Demo": 8 bars of 4/4 at 96 BPM, D minor, 2 tracks, 89 notes, 20.000 s
    wrote renders/demo.mid
    wrote renders/demo.wav (23.069 s, 44100 Hz, 16-bit stereo, fluidsynth 2.3.4, FluidR3_GM.sf2)
    wrote renders/demo.render.json
  ```
  (`validate` prints the first two lines. `midi` adds the `.mid` line.)
- Failure: every diagnostic on **stderr**, then a final line `FAILED <project>: <e> error(s), <w> warning(s)`.
  ```
  error[INVALID_PITCH] tracks[0].patterns[0].notes[3].pitch
    Invalid pitch "H#4".
    expected: note name A-G, optional # or b, octave -1..9 (e.g. "D2", "F#4", "Bb3"), or MIDI number 0-127
    received: "H#4"
    hint: The letter must be A-G; German "H" is "B" in this notation, e.g. "B4".
  ```
  Warnings use `warning[CODE]`. The root path prints as `(root)`. `received` is printed as JSON.

### 8.4 JSON output (`--json`)

**Exactly one JSON document** on stdout (pretty-printed with 2 spaces, plus a newline). Nothing else
goes to stdout, and the engine writes nothing to stderr in this mode. Node runtime warnings are outside
the contract, so tests assert on stdout only. Usage errors are also reported as JSON when `--json`
appears anywhere in argv.

```json
{
  "ok": true,
  "command": "render",
  "engineVersion": "0.0.1",
  "project": "examples/demo.json",
  "errors": [],
  "warnings": [],
  "summary": {
    "title": "DaemonV12 Demo", "bars": 8, "timeSignature": "4/4", "bpm": 96, "key": "D minor",
    "tracks": 2, "notes": 89, "durationTicks": 30720, "durationSeconds": 20
  },
  "artifacts": { "midi": "renders/demo.mid", "wav": "renders/demo.wav", "manifest": "renders/demo.render.json" },
  "manifest": { "…": "same object as written to <name>.render.json" }
}
```

- `command`: `"validate" | "midi" | "render" | null`. It is null when the command could not be determined.
- `project`: the path as given, or null.
- `summary`: present (non-null) whenever stages 0–3 succeeded, even if a later step failed. `notes`
  counts MIDI notes (each chord member counts). `key` is null when absent.
- `artifacts`: only files that exist after the command. Empty `{}` on failure and for `validate`.
- `manifest`: the manifest object for a successful `render`, otherwise null.
- `omitted`: present only when diagnostics were capped (§4.2).

---

## 9. Diagnostics

### 9.1 Shape (`src/diagnostics.ts`)

```ts
interface Diagnostic {
  code: DiagnosticCode;          // stable, SCREAMING_SNAKE_CASE, never renamed once released
  severity: "error" | "warning";
  path: string;                  // §4.3; "" for root or non-project diagnostics
  message: string;               // one or two full sentences; names the offending value
  expected?: string;             // what would be valid, in words, with examples
  received?: unknown;            // the offending JSON value, verbatim
  hint?: string;                 // a concrete fix for this case (did-you-mean, conversion, command)
  line?: number;                 // JSON_PARSE_ERROR only (1-based)
  column?: number;               // JSON_PARSE_ERROR only (1-based)
}
```

### 9.2 Codes

| Code | Sev. | Exit | When | Hint rule |
|---|---|---|---|---|
| `USAGE_ERROR` | error | 2 | Bad command line (§8.1) | Show the synopsis line for the command. |
| `FILE_NOT_FOUND` | error | 2 | The project path does not exist | — |
| `FILE_READ_FAILED` | error | 2 | Exists but unreadable (a directory, permissions) | — |
| `JSON_PARSE_ERROR` | error | 1 | Empty file or invalid JSON | `line` and `column` from the V8 message `(line L column C)`; else computed from `position N`; else omitted. If the text at the error position looks like an unquoted fraction or position (`1/4`, `3:2`): "durations and positions are strings: write \"1/4\"". |
| `UNSUPPORTED_FORMAT_VERSION` | error | 1 | `formatVersion` present and ≠ 1 (validation stops) | "This engine reads formatVersion 1." |
| `MISSING_FIELD` | error | 1 | Required field absent | Show a minimal valid example of the field. |
| `UNKNOWN_FIELD` | error | 1 | A field not in §2.2 | Alias table (§9.3), else did-you-mean (Levenshtein ≤ 2). `expected` lists the allowed fields. |
| `WRONG_TYPE` | error | 1 | JSON type mismatch (e.g. `"bars": "8"`, integer expected but 2.5 given) | GM program number → "33 is \"electric_bass_finger\" (0-based) or \"acoustic_bass\" (1-based); use the name". A number where a duration is required → `Durations are strings of whole-note fractions, e.g. "1/4" (quarter), "1/8" (eighth), "3/8" (dotted quarter).` A number where a position is required → the generic position hint. |
| `OUT_OF_RANGE` | error | 1 | A number or array length outside §2.2 limits (e.g. bpm 500, 0 tracks, 16 tracks, string too long) | `velocity` in (1, 127] → "MIDI-style velocity; use v/127 = 0.79" (rounded to 2 decimals). |
| `INVALID_ID` | error | 1 | Id grammar violated | Suggest a slug: lowercase, spaces and `_` to `-`, other characters removed. |
| `DUPLICATE_ID` | error | 1 | Track id repeated, or pattern id repeated within a track | Name the first occurrence's path. |
| `INVALID_TIME_SIGNATURE` | error | 1 | Grammar or numerator/denominator rule | `"4:4"`, `"C"` → `"4/4"`. |
| `INVALID_KEY` | error | 1 | Grammar, or not in Appendix B | `"Dm"`, `"D min"`, `"d minor"` → `"D minor"`. Enharmonic suggestion (`"D# major"` → `"Eb major"`). |
| `UNSUPPORTED_INSTRUMENT_TYPE` | error | 1 | `instrument.type` ≠ `"gm"` | "V0 supports only \"gm\"." |
| `UNKNOWN_GM_PROGRAM` | error | 1 | `program` not in Appendix A | Alias table (§9.3), else did-you-mean (Levenshtein ≤ 3). |
| `INVALID_PITCH` | error | 1 | Pitch grammar or range violated | Lowercase letter → uppercase. Missing octave → "e.g. \"Db4\"". `♯`/`♭` → `#`/`b`. `H` → `B`. Out of range → the valid range. |
| `INVALID_POSITION` | error | 1 | Position grammar violated | Generic: `Write BAR:BEAT or BAR:BEAT+N/D, e.g. "3:2" or "3:2+1/8"`. A `0` bar or beat → "bars and beats are 1-based". |
| `POSITION_OUT_OF_RANGE` | error | 1 | Beat > numerator, offset ≥ one beat, or bar > pattern bars | The canonical spelling (§3.3) when it lies inside the pattern. Else "positions are pattern-relative: valid range 1:1 … <last beat>". |
| `INVALID_DURATION` | error | 1 | Duration grammar violated | `"4n"`→`"1/4"`, `"8t"`→`"1/12"`, `"4n."`→`"3/8"`, `"1/4."`→`"3/8"`, `"1"`→`"1/1"`, `0.25`/`"0.25"` → explain whole-note fractions. |
| `OFF_GRID` | error | 1 | Duration or offset not an integer number of ticks at 960 PPQ | "Supported: binary subdivisions down to 1/256, triplets, quintuplets." |
| `NOTE_EXCEEDS_PATTERN` | error | 1 | Note start + duration > pattern end | The maximum duration that fits (`formatDuration`), or lengthen the pattern. |
| `UNKNOWN_PATTERN` | error | 1 | A clip references a missing pattern id | Did-you-mean among the track's pattern ids. `expected` lists them. |
| `CLIP_EXCEEDS_PROJECT` | error | 1 | `clip.bar + pattern.bars − 1 > project.bars` | "Increase `bars` to N or move the clip." |
| `NOTE_OVERLAP` | error | 1 | Same pitch overlaps on one track (§4.1) | "Shorten the earlier note to `<formatDuration>` or move one note to another track." |
| `PATTERN_UNUSED` | warning | 0 | No clip references the pattern | — |
| `TRACK_EMPTY` | warning | 0 | The track has no clips | — |
| `SOUNDFONT_NOT_FOUND` | error | 3 | §7.2 | Install command or `--soundfont`. |
| `SOUNDFONT_INVALID` | error | 3 | §7.2 magic check failed or unreadable | — |
| `RENDERER_NOT_FOUND` | error | 3 | §7.3 probe `ENOENT` | Install command or `DAEMONV12_FLUIDSYNTH`. |
| `RENDERER_FAILED` | error | 3 | §7.3 | The full reproducible command line. |
| `OUTPUT_WRITE_FAILED` | error | 3 | Cannot create the out-dir or write or rename an artifact | — |
| `INTERNAL_ERROR` | error | 4 | An unexpected exception (bug) | The exception message in `message`. Stack trace on stderr in human mode only. |

### 9.3 Alias hints (checked before did-you-mean)

| Object | Wrong field → right field |
|---|---|
| Project | `tempo`→`bpm`; `time_signature`, `timesig`, `meter`, `signature`→`timeSignature`; `length`, `measures`, `numBars`→`bars`; `name`→`title`; `version`, `schemaVersion`, `format`→`formatVersion`; `instruments`, `parts`→`tracks`; `patterns`→"patterns live inside each track: tracks[i].patterns"; `notes`→"notes live inside patterns: tracks[i].patterns[j].notes" |
| Track | `name`→`id`; `program`, `patch`, `sound`, `preset`→`instrument` (show `{"type": "gm", "program": "…"}`); `notes`→"notes live inside patterns; place patterns with clips"; `arrangement`, `placements`, `sequence`→`clips` |
| Instrument | `kind`→`type`; `preset`, `patch`, `name`, `sound`→`program` |
| Clip | `start`, `at`, `position`, `measure`→`bar`; `patternId`, `ref`, `id`, `name`→`pattern` |
| Pattern | `name`→`id`; `length`, `measures`→`bars`; `events`→`notes` |
| Note | `at`, `time`, `position`, `onset`, `tick`→`start`; `dur`, `length`, `len`, `value`→`duration`; `vel`, `volume`, `dynamics`→`velocity`; `note`, `midi`, `key`, `pitches`, `notes`→`pitch` |

GM program aliases: `piano`→`acoustic_grand_piano`, `epiano`/`rhodes`→`electric_piano_1`,
`organ`→`drawbar_organ`, `guitar`→`acoustic_guitar_nylon`, `bass`→`electric_bass_finger`,
`synth_bass`→`synth_bass_1`, `strings`→`string_ensemble_1`, `choir`→`choir_aahs`,
`brass`→`brass_section`, `lead`→`lead_1_square`, `pad`→`pad_2_warm`.

An alias hint applies only when its target field is **absent** from the same object. For example, a
clip that has both `id` and `pattern` gets a plain `UNKNOWN_FIELD` for `id`, not "use `pattern`".

Did-you-mean: Levenshtein distance (insert, delete, substitute = 1) compared case-insensitively.
The smallest distance wins. Ties go to the earliest candidate in canonical order (spec-table order,
Appendix A order, or file order for pattern ids).

---

## 10. Demo (`examples/demo.json`, provided; do not edit)

**"DaemonV12 Demo"**: 8 bars, 4/4, 96 BPM (bar = 2.5 s, total 20.000 s), D minor, seed 1.
Two tracks share one arrangement: `phrase-a` (bars 1–2), `phrase-b` (3–4), `phrase-a` again (5–6),
`ending` (7–8).

| Bar | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Chord | Dm | Bb | F | C | Dm | Bb | Gm → A | Dm (held) |
| `bass` (electric_bass_finger, ch 0) | root dotted-quarter, root on 2&, fifth, root | ″ | ″ | ″ | ″ | ″ | G G A A1 | D2 whole note |
| `keys` (acoustic_grand_piano, ch 1) | eighth-note up-down arpeggio | ″ | ″ | ″ | ″ | ″ | rising Gm, rising A (crescendo) | 4-note chord, whole note |

It exercises: two tracks; pattern reuse; `+1/8` offsets; durations 1/8, 1/4, 3/8 and 1/1; a chord
array; default and explicit velocities; a same-pitch note-off/note-on at the same tick (bass bar 1,
tick 1440); key metadata; and descriptions. You can hear it working: steady piano eighths over a bass
pulse, the opening phrase returns at bar 5, and a rising cadence lands on a held D-minor chord.

Reference values (environment-independent unless noted):

| Item | Value |
|---|---|
| `validate` | 0 errors, 0 warnings |
| Summary | 2 tracks, **89 notes** (bass 29, keys 60), `durationTicks` 30720, `durationSeconds` 20 |
| `demo.mid` | **911 bytes**, SHA-256 `32bf52317120de2c48a5cab8292a614724c63acf3940ffa84f24a5fcebd536dc` |
| MIDI header | format 1, 3 track chunks, division 960 |
| Conductor | name "DaemonV12 Demo", `FF 58 04 04 02 18 08`, `FF 59 02 FF 01`, `FF 51 03 09 89 68`, EOT @30720 |
| Track "bass" | channel 0, program 33, 29 notes, EOT @30720 |
| Track "keys" | channel 1, program 0, 60 notes, EOT @30720 |
| `demo.wav` (Ubuntu 24.04, FluidSynth 2.3.4, FluidR3_GM) | PCM s16le, 2 ch, 44100 Hz, 1,017,344 frames (23.069 s), peak −6.0 dBFS, no clipping, per-bar RMS −23.7 to −25.7 dBFS, SHA-256 `135ec69b6647add9e96ed867a0b85162e7f0e1cab4d3f055ddd8deae71533696` (informational; byte-identical across repeated renders in that environment) |

---

## 11. Acceptance criteria

V0 is complete when **all** of the following hold:

1. `npm ci && npm run check` passes: the typecheck plus every test. On a machine without FluidSynth,
   only the real-render integration test is *skipped* (and says why). Nothing fails.
2. `npx daemonv12 validate examples/demo.json` exits 0, and its `--json` `summary` equals §10.
3. `npx daemonv12 midi examples/demo.json` exits 0 and writes `renders/demo.mid` with exactly the §10
   size and SHA-256.
4. The minimal fixture encodes to exactly the 96 bytes of §6.5.
5. In the devcontainer or Codespaces, `npx daemonv12 render examples/demo.json` exits 0 and writes:
   `demo.mid` (same hash as criterion 3); `demo.wav` (PCM s16le, 2 channels, 44100 Hz, duration
   20.0–26.0 s, RMS > −45 dBFS in each of the eight 2.5 s bar windows, RMS < −50 dBFS after 22.0 s if
   the file is that long, no sample at ±32767); and `demo.render.json` matching §7.6.
6. Rendering twice in the same environment gives a byte-identical `demo.wav` and `demo.render.json`.
7. Every validation case in CODEX_HANDOFF §6 yields the specified code and path. Through the CLI,
   project errors exit 1 and `--json` prints exactly one parseable JSON document.
8. A missing FluidSynth gives exit 3 `RENDERER_NOT_FOUND`. A missing SoundFont gives exit 3
   `SOUNDFONT_NOT_FOUND`. Each fake-renderer failure mode gives exit 3 `RENDERER_FAILED`. After any of
   these, no `.mid`, `.wav`, `.render.json` or `.tmp` file remains in the out-dir.
9. An unknown command, unknown flag or missing argument gives exit 2 `USAGE_ERROR`. A missing project
   file gives exit 2 `FILE_NOT_FOUND`.
10. `package.json` has no `dependencies` (dev only). `src/` contains no `Math.random`, `Date`,
    `performance.now` or `process.hrtime`. Only `src/render/` imports `src/render/fluidsynth.ts`.

---

## Appendix A: General MIDI program names (0-based program number → `program` value)

```
  0 acoustic_grand_piano     32 acoustic_bass           64 soprano_sax             96 fx_1_rain
  1 bright_acoustic_piano    33 electric_bass_finger    65 alto_sax                97 fx_2_soundtrack
  2 electric_grand_piano     34 electric_bass_pick      66 tenor_sax               98 fx_3_crystal
  3 honky_tonk_piano         35 fretless_bass           67 baritone_sax            99 fx_4_atmosphere
  4 electric_piano_1         36 slap_bass_1             68 oboe                   100 fx_5_brightness
  5 electric_piano_2         37 slap_bass_2             69 english_horn           101 fx_6_goblins
  6 harpsichord              38 synth_bass_1            70 bassoon                102 fx_7_echoes
  7 clavinet                 39 synth_bass_2            71 clarinet               103 fx_8_sci_fi
  8 celesta                  40 violin                  72 piccolo                104 sitar
  9 glockenspiel             41 viola                   73 flute                  105 banjo
 10 music_box                42 cello                   74 recorder               106 shamisen
 11 vibraphone               43 contrabass              75 pan_flute              107 koto
 12 marimba                  44 tremolo_strings         76 blown_bottle           108 kalimba
 13 xylophone                45 pizzicato_strings       77 shakuhachi             109 bagpipe
 14 tubular_bells            46 orchestral_harp         78 whistle                110 fiddle
 15 dulcimer                 47 timpani                 79 ocarina                111 shanai
 16 drawbar_organ            48 string_ensemble_1       80 lead_1_square          112 tinkle_bell
 17 percussive_organ         49 string_ensemble_2       81 lead_2_sawtooth        113 agogo
 18 rock_organ               50 synth_strings_1         82 lead_3_calliope        114 steel_drums
 19 church_organ             51 synth_strings_2         83 lead_4_chiff           115 woodblock
 20 reed_organ               52 choir_aahs              84 lead_5_charang         116 taiko_drum
 21 accordion                53 voice_oohs              85 lead_6_voice           117 melodic_tom
 22 harmonica                54 synth_voice             86 lead_7_fifths          118 synth_drum
 23 tango_accordion          55 orchestra_hit           87 lead_8_bass_lead       119 reverse_cymbal
 24 acoustic_guitar_nylon    56 trumpet                 88 pad_1_new_age          120 guitar_fret_noise
 25 acoustic_guitar_steel    57 trombone                89 pad_2_warm             121 breath_noise
 26 electric_guitar_jazz     58 tuba                    90 pad_3_polysynth        122 seashore
 27 electric_guitar_clean    59 muted_trumpet           91 pad_4_choir            123 bird_tweet
 28 electric_guitar_muted    60 french_horn             92 pad_5_bowed            124 telephone_ring
 29 overdriven_guitar        61 brass_section           93 pad_6_metallic         125 helicopter
 30 distortion_guitar        62 synth_brass_1           94 pad_7_halo             126 applause
 31 guitar_harmonics         63 synth_brass_2           95 pad_8_sweep            127 gunshot
```

## Appendix B: Key signatures (`sf` for `FF 59`; negative = flats)

| sf | −7 | −6 | −5 | −4 | −3 | −2 | −1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| major | Cb | Gb | Db | Ab | Eb | Bb | F | C | G | D | A | E | B | F# | C# |
| minor | Ab | Eb | Bb | F | C | G | D | A | E | B | F# | C# | G# | D# | A# |

Valid `key` values are exactly these 30 (for example `"Bb major"`, `"F# minor"`). Anything else is
`INVALID_KEY`. When an enharmonic equivalent with the same mode exists in the table, suggest it.
