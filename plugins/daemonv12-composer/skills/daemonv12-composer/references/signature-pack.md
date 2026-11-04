# Optional V12 SIGNATURE mode (pack 1.0.0)

Use only when choosing this palette or when requested. First confirm the pack's
catalog, `assets/v12-signature/kit.json` and required WAVs exist. The pack is
**not** bundled with Composer, copied by `daemonv12 init`, or included in the
engine npm package. If absent, report that and use verified available sounds;
do not invent paths or silently download/generate instruments. Normal Composer
and [hook-first](hook-first.md) work without it.

In an existing authorized installation, copy the needed assets into the separate
composition workspace's `assets/v12-signature/`; keep paths relative to the
project. Read the installed catalog and provenance. Pack licensing is pending
owner declaration; Composer includes guidance only, no pack audio. This compact
snapshot comes from pack README, catalog and COMPOSER_PLAYBOOK sections 1–5 at
`17468e7ee1df11b8cef361cf4e49601d5f671589`. Installed metadata wins if different;
record that version. No future multi-root variants are assumed.

## Roles and tuning

Catalog filenames are `assets/v12-signature/NN-id.wav` using the numbers below.
Kit `pitch` selects a drum by name (e.g. `sub-hammer`), not its musical pitch.
Use sampler `playbackRate = 2^(semitones/12)` from the **individual root**;
prefer the catalog's six-decimal rate table. Rate changes length and vibrato too.
Ranges are musical recommendations, narrower than engine validity (0.25–4).

| # / Sound | Role | Root | Recommended notes or rate | Source seconds |
| --- | --- | --- | --- | ---: |
| 01 SUB HAMMER | Weighty kick; gate fast grooves | A1 | E1–C2 | 0.95 |
| 02 IRON PULSE | Kick attack layer | A1 | F#1–D2 | 0.45 |
| 03 TITANIUM CRACK | Backbeat/build roll | A3 | F3–C#4 | 0.60 |
| 04 NEON CLAP | Lighter backbeat | unpitched | 0.749154–1.189207 | 0.65 |
| 05 GHOST TICK | Accented closed hat | unpitched | 0.840896–1.33484 | 0.12 |
| 06 OPEN CIRCUIT | Off-beat open hat | unpitched | 0.840896–1.259921 | 1.00 |
| 07 ABYSS | Single sub owner | A1 | D1–F#2; prefer E1 or above for weight | 8.00 |
| 08 REACTOR | Mid-bass; highpass 110 Hz over ABYSS | A1 | D1–F#2 | 5.50 |
| 09 SIGNAL | Arp/short ostinato | A4 | A3–G5 | 4.50 |
| 10 PHANTOM | Singing lead; bloom after ~0.5 s | **E5** | A4–C6 | 6.00 |
| 11 EVENT HORIZON | One-note open-fifth bed | A2 | E2–E3 | 10.00 |
| 12 AFTERGLOW | Chord colour; small voice-led voicings | A3 | **C3–E4** | 8.00 |
| 13 SPECTER | Quiet foreshadow/choir | A3 | E3–E4 | 6.50 |
| 14 CHROME STRIKE | Opening/section/ending identity | A4 | A3–E5 | 2.60 |
| 15 ASCENSION | Timed riser | A4 | G4–B4 | 6.00 |
| 16 CONVERGENCE | Arrival impact | A1 | F#1–B1 | 5.00 |

Start small: kick, ABYSS, one pad, SIGNAL **or** PHANTOM. Add clap/hat or another
role only when needed. A minor is convenient, not compulsory. Do not copy the
showcase melody/arrangement or require its tempo. Some showcase AFTERGLOW
voicings exceed the recommended E4 ceiling; keep this mode within the catalog
range unless deliberately testing and disclosing an exception.

## Performance constraints before rendering

- Held sampler notes need `gate` plus `envelope`. At constant rate, available
  seconds ≈ `(endSeconds − offsetSeconds) / playbackRate` (end defaults to source
  length). Fit gate **and release** within that, the next conflicting voice,
  and the output boundary. Gates cannot loop or extend an exhausted source.
  With glides, rely on asset-aware validation/resolved provenance instead.
- EVENT HORIZON offset 1.6 skips the swell; SPECTER offset 1.2 enters the "oh".
  Use attacks (about 0.15 / 0.06 s respectively) and allow releases. At rate 1,
  HORIZON has 8.4 s left after that offset; retrigger for longer beds.
- Chokes are **track-local**, release older voices and allow release overlap.
  Same-frame kick layers coexist. Kick/bass on separate tracks need spacing
  or authored gain ramps; sharing a group name does not solve their collision.
- Low-end phase alignment is a pack property at the designed A1/root timing,
  not a guarantee after arbitrary repitching, offsets or envelopes. Reinforcement
  can overload: CONVERGENCE + ABYSS at velocity 1 / unity gain was measured over
  full scale. Use conservative gains and inspect track/master overload evidence.
- Validate interpolation work before full rendering: 15 tracks, one billion taps
  maximum. Root-rate notes without glides are cheap; stacked repitched sustained
  chords are expensive. Fewer voices and gated tails usually help more than tools.

## Five adaptable recipes

1. **Hook:** choose rhythm first; try leap → falling answer → related sequence →
   withheld resolution. Compare 3–4 genuinely different ideas, not four copies
   of this recipe. PHANTOM E5 is rate 1; A5 is 1.33484; C5 is 0.793701. A held
   A5 has at most ~4.49 s before offsets; leave room for its release.
2. **Groove to arrival:** SUB HAMMER groove gate `1/16`, attack 0.001 / release
   0.04 s; ABYSS off the kick, gate `1/16`, attack 0.002 / release 0.02 s.
   The nominal gate can still overlap: inspect releases and shorten/space as
   needed. At the arrival, try a `1/8` kick plus same-tick IRON PULSE and a held
   sub; move REACTOR to off-beat eighths, highpass at 110 Hz. Duck held sub with
   authored **absolute** `automation.gainDb` points: base, dip on each kick,
   linear recovery. Repeat at project-absolute beats; no automatic sidechain.
3. **Harmony:** one EVENT HORIZON root per chord, plus optional three-note
   AFTERGLOW voicings within C3–E4. Am–F–G–E is one tension/resolution example;
   E major needs G#. Keep voices near each other and pads above bass; a supported
   highpass at 70–120 Hz is a starting option, not a mandatory mix target.
4. **Tension/payoff:** quietly foreshadow half the hook; hold a dominant/pedal;
   remove sub and most kick before the arrival; stop an arp early. Change bass
   pattern or register on the return. For rate-1 ASCENSION, align its last frame
   with the arrival: `offsetSeconds = 6 − buildSeconds`, rounded to six decimals,
   only for builds ≤6 s. Other rates change the required source span. Do not
   invent filter automation; subtraction and harmony can supply the tension.
5. **Ending/loop:** compose resolution or a deliberate loop-back; fit gates,
   releases and effect tails inside the container. `render.duration.bars` plus
   `tail: "none"` cuts remaining sound at the seam; no wrap-around tails exist.
   Check the seam/end with existing tools and listening when available. A quiet
   last 10 ms cannot certify a musically satisfying or seamless loop.

Validate sketches first; defer mix/effects/stems. Keep normal V1–V3 critique,
Risk Pass and stopping rules. True peak, section loudness and clean tails check
technical delivery; none proves a strong hook or drop. Never copy showcase
measurements into a new piece's report or invent listening results.
