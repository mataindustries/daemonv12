# GRIND — Wonder Anti-Formula Challenge

**Status: waiting for the owner to listen. No winner is chosen here.**

Three new, unrelated 8–12 s experiments. None remixes GRIND, BOLLO or SOLECITO, none uses a
four-bar loop, a stock riser or a cheerful arcade melody. Sampler-only projects (no GM/FluidSynth
on this machine), built with the existing DaemonV12 renderer from PR #55
(`origin/pr-55` @ `af38560`, used in a clean separate worktree on
`experiment/grind-wonder-anti-formula`; the previous checkout and its untracked work are untouched,
and no approved masters were altered). The DaemonV12 MCP tools were not callable in this session,
so the same renderer was driven through its CLI (`validate` → `render --format wav,mp3`).

## Listen

| | File | Seconds | The one idea |
|---|---|---:|---|
| A | `A-MACHINE-FAILURE.mp3` / `.wav` | 10.4 | A bass machine that is stable, then faulty, then dead |
| B | `B-DISPLACED-GRAVITY.mp3` / `.wav` | 9.8 | A trap hook that keeps landing in the wrong place |
| C | `C-IMPOSSIBLE-ASCENT.mp3` / `.wav` | 11.8 | A phrase that fails upward three times, then gets through |

Listening MP3 copies are also in `/workspaces/thing-mania/WONDER_AUDIO/GRIND/` (if accessible).

## A — MACHINE FAILURE

Abyss sub (root A) + Reactor grind, mechanical kick, machine ticks, one industrial snare, one alarm.

- Bars 1–2: the machine is confident — a held root, a stutter, an octave stab, four square kicks.
- Bars 3–4: faults, not development. The bass detunes off-grid (rates 0.97/1.03), starts skipping
  inside its own sample (`offsetSeconds` jumps), glides sag, a kick lands a triplet late and one
  kick never arrives, the ticks accelerate from 8ths to triplets to 16ths, one low clang.
- Bar 5: the kick is gone. A low floor-boom, a single short alarm scream, then measured near-silence
  (RMS falls to about −41 dB at 8.5 s).
- Bar 6: no drums at all. The bass descends A → F → C → below, gliding down past the file end —
  the render truncates it mid-note at exactly 10.4 s. It does not resolve; it stops working.

## B — DISPLACED GRAVITY

The hook is the whole piece (Glasshouse sub C♯ + bass-punch attack): it **anticipates** the
downbeat from the previous beat's last eighth, holds the downbeat it promised, stabs the flat-2
(D over C♯), then dives a fifth to below the root. Around it, gravity is wrong:

- The kick is an eighth late, the snare an eighth (later a 16th) early, hats stumble in triplets.
- Cycle 2: the same hook shifted a 16th later — and its dive is **withheld**. Bar 4 is left almost
  empty: one off-grid hat and a whispered ghost-vox (RMS ≈ −23 dB against −11 dB peaks).
- Bar 5: the missing dive arrives alone, a bar late. Bar 6: one crushed dive and a single stray
  high tick after it. Nothing returns to the grid.

## C — IMPOSSIBLE ASCENT

Phantom (root E5) sings the same climb — E, F♯, A, B — and falls back. Between attempts sits the
obstacle: the identical low boom at the identical pitch, every time. The wall does not change;
the phrase has to.

- Attempt 2 (with a detuned Specter shadow doubling it): strained, faster, and it plays a wrong
  note (F natural, the flat-2) on the way up.
- Attempt 3: compressed into quarter-beats, reaches the octave — and is dragged back down by a glide.
- Attempt 4: one unbroken glide E → B → E6 with no re-strikes. Only then does the wall move:
  in bar 7 it is played gliding **downward** into an open E–B–E chord, and the last sound is a
  single glass note (E, the C♯5 glass hit at +3 semitones) left ringing on its own.

## Measurements (renderer analysis, not a verdict)

| | Duration | Integrated LUFS | True peak | Clipping |
|---|---:|---:|---:|---|
| A | 10.4 s | −14.9 | −4.3 dBTP | none |
| B | 9.8 s | −15.0 | −1.5 dBTP | none |
| C | 11.8 s | −16.8 | −4.3 dBTP | none |

Master gain was only balanced between the three (no heavy mastering, no limiter chain) so the
listening choice is about the music, not the volume.

## Reproduce

```sh
python3 benchmarks/grind-wonder-anti-formula/build_projects.py   # writes the three project JSONs
for f in a-machine-failure b-displaced-gravity c-impossible-ascent; do
  node bin/daemonv12.js validate benchmarks/grind-wonder-anti-formula/$f.json
  node bin/daemonv12.js render  benchmarks/grind-wonder-anti-formula/$f.json \
      --out-dir benchmarks/grind-wonder-anti-formula/renders/$f --format wav,mp3
done
```

Assets under `assets/` are trimmed copies of the repo's existing Orbital Foundry, Glasshouse and
V12 Signature samples (project asset paths must live below the project's own `assets/`).
`renders/*/*.render.json` and `*.analysis.json` are the render provenance. Approved masters and
all previous tracks are untouched.
