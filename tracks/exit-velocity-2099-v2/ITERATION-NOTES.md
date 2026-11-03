# EXIT VELOCITY // 2099 V2 — candidate notes

All projects inherit the 32-bar, 140 BPM F-minor original, including the
F–E♭–C–A♭ whistle, displaced kick and late clap. `original-v3-reference.json`
is an unchanged copy of the source score. None of the decisions below are
claims of human listening; render measurements and score inspection support
hypotheses for audition.

- **A/B/C treatments:** See `treatments/TREATMENTS.md` for the separate 14.25-second comparisons and their design, measured balance, and selection rationale.
- **V2A:** new sounds against essentially the original arrangement. Tests
  whether the physical kick/clap, harmonic whistle and formant bass make a
  stronger foundation while preserving the composition.
- **V2B:** adds quiet ghost answers, rhythmic bass syllables, a three-hit rim
  pickup, and a small turn after the main payoff. Tests whether the pocket
  feels more conversational without losing its pulse.
- **V2C:** revises track levels for headroom and integration; its score leaves
  the V2B development intact. Verify track and master stages and compare
  matched level, rather than equating louder with better.
- **RISK:** at bar 25, the whistle rests while the bass speaks the whistle's
  exact rhythm and descending pitch contour in its own register. The next
  bar restores the lead. This controlled timbral handoff may strengthen the
  identity or may obscure the hook; audition against V2C at the same level.
- **FINAL candidate:** retains the handoff, draws back the opening rhythm,
  removes kick/sub in bar 15, accents the return, and places short left-side
  response notes against the existing right-side orbit. Low frequencies remain
  centered; there is no anti-phase widening. A later kick design adds a brief
  beater transient. This is a deliberate creative hypothesis, not a listening
  verdict.

Native V2A, V2B, V2C and RISK respectively measure −19.34, −19.31, −20.69,
and −20.77 LUFS and −6.66, −6.66, −8.18, and −8.18 dBTP. Every candidate and
treatment reported zero clipped samples at each track and master stage. Their
320 kbps comparison MP3s apply fixed gains of +3.34, +3.31, +4.69 and +4.77 dB,
respectively, for an approximately −16 LUFS match. These gains do not compress
the music; MP3 encoding and gating can produce slight measurement differences.

## Recreating the candidates

The early renders use the initial kick. To regenerate them in an isolated copy
of the V2 workspace, run the following before validating/rendering their JSON:

```sh
python generate_assets_v2.py --palette A --early-kick --out assets/a
python generate_assets_v2.py --palette B --early-kick --out assets/b
python generate_assets_v2.py --palette C --early-kick --out assets/c
python compose_v2.py
node bin/daemonv12.js validate PATH/TO/v2c.json --json
node bin/daemonv12.js render PATH/TO/v2c.json --out-dir PATH/TO/new-render --stems --format wav --json
```

`bin/daemonv12.js` is relative to the DaemonV12 repository root; paths above
must be adjusted to the workspace. For the final candidate, regenerate B
without `--early-kick` into `assets/b` and render `final.json`. Each render
must use a fresh output directory. The asset generator uses deterministic
seeded noise and procedural oscillators; no external samples are used.
