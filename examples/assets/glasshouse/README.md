# GLASSHOUSE

Ten original sounds for modern electronic and bass music: glossy, tuned, punchy and clean enough to process hard. Where Orbital Foundry is industrial machinery, GLASSHOUSE is one synthetic glass identity, one synthetic voice and a tuned low end, all in **C# minor**. It is an offline-generated pack for DaemonV12's existing sampler and drum kits, not an engine extension.

**All assets are generated in this repository. No third-party sample material is incorporated.** No recordings, vocals, downloaded samples, loops, SoundFonts, impulse responses or existing songs contribute to these WAVs. The generated WAV assets are dedicated under CC0-1.0; see [LICENSE](LICENSE). They may be redistributed and used in commercial or noncommercial work.

## Inventory

All files are 44,100 Hz signed PCM16 little-endian WAV. Peaks are sample peaks. `M` is mono, `S` stereo. The machine-readable [catalog](../../glasshouse.catalog.json) lists each ID, frame count, seed, peak target, tuning, family, SHA-256, synthesis recipe and playing suggestion.

| File | Seconds | Ch | Peak dBFS | Tuning | Kit pitch | Role |
|---|---:|:---:|---:|---|---:|---|
| `01-glass-hit.wav` | 1.000 | M | −6 | C#5 (554.37 Hz) | 81 | **Parent identity.** Bright glass transient with a sparkling 1.5–10 kHz halo; exposed melodic hits. |
| `02-glass-reverse.wav` | 0.857 | S | −7 | C#5 | sampler | The same glass bloomed and reversed; rises into a boundary. |
| `03-glass-crush.wav` | 0.420 | M | −6 | C#3 (138.59 Hz) | 41 | The glass two octaves down, driven and crushed; dark tonal bass-call. |
| `04-ghost-vox.wav` | 0.950 | M | −7 | C#4 (277.18 Hz) | sampler | Synthetic airy "oh-ah" vowel; vocal feel without a singer. |
| `05-vox-chip.wav` | 0.085 | M | −7 | C#4 | 78 | An 85 ms slice of the ghost-vox "ah"; 1/16 chops. |
| `06-bass-punch-cs.wav` | 0.320 | M | −5 | C#2 (69.30 Hz) | 36 | Upper-bass attack, 277→69 Hz drop, harmonics to 1 kHz for small speakers. |
| `07-sub-cs.wav` | 0.857 | M | −7 | C#2 | 35 | Clean sine sub body, controlled two-beat decay. |
| `08-chrome-clap.wav` | 0.360 | S | −5 | — | 39 | Clap/snare hybrid with a faint C#6 glass ring and controlled mid/side width. |
| `09-pixel-hat.wav` | 0.055 | M | −7 | — | 42 | Tight 6–12 kHz tick from high glass modes and resonant noise. |
| `10-prism-impact.wav` | 1.800 | S | −5 | C# minor | sampler | The glass refracted into a wide C#m chord over a mono C#2 drop; payoff. |

Total payload: 857,872 bytes. Stereo appears only where it carries something: the reverse's diffused bloom, the clap's side-only tail and the prism's spread chord. Their low end stays centered (L/R correlation below 150 Hz: reverse 0.98, clap 1.00, prism 0.93).

## Families

**Glass: one source, four transformations.** `GLASS` in the generator is a single modal recipe: a harmonic core (1, 2, 4) that fixes the pitch, plus free-free glass-bar modes (2.756, 5.404, 8.933, 13.34, 18.64). Each mode is a slightly split pair whose beating gives the shimmer. Every glass sound evaluates that same function:

- `glass-hit` strikes it at C#5.
- `glass-reverse` blooms it with a 0.2 s body and noise rung through its own mode resonators, diffuses only the part above 900 Hz per channel, then time-reverses the float buffer before PCM. It is the hit's decay played backwards into its attack, not a reversed WAV.
- `glass-crush` transposes it two octaves to C#3 with a longer, resample-like body, drops into pitch from G#3, then drives and crushes it in parallel with the clean glass and adds a falling mid resonance.
- `prism-impact` refracts it into C#4–G#4–C#5–E5–G#5–C#6, dispersing the tones 3 ms apart across the stereo field.

Measured peak ratios against each sound's own C#: the hit and the reverse show exactly the eight `GLASS` ratios; the crush shows 1, 2, 2.756, 4, 5.404 and 8.933 plus its deliberate drive products. `chrome-clap` (C#6) and `pixel-hat` (C#7) carry short high slices of the same modes.

**Vox: sung, then sliced.** One `voice` function renders formant-shaped additive harmonics (morphing "oh" to "ah"), a +8 cent double and glottal-pulsed breath. `ghost-vox` sings the whole gesture with a scoop and delayed vibrato. `vox-chip` evaluates the same function at the open "ah" and adds a consonant-like 4 ms burst. Their third-octave spectral profiles correlate at 0.98 (clap 0.67, hat 0.34).

**Low pair.** The punch's pitch drop is `C#2·(1 + 3e^(−t/τ))` with `τ = 2/(3·C#2)`: exactly two extra cycles, so after about 40 ms its body is in phase with `sub-cs`. Triggered on the same tick they sum coherently (+2.0 dB over the separate energies, correlation 0.92), and at velocity 1 the pair peaks at −1.05 dBFS.

## Tuning

A4 = 440 Hz, equal temperament. Measured fundamentals: glass-hit 554.45 Hz (+0.3 cents), glass-reverse +0.1, glass-crush +3.5 (its falling onset), ghost-vox −0.5, vox-chip +2.6, bass-punch +3.2 (its drop), sub −0.0. DaemonV12 does not pitch-shift samples, so these sounds always play at their recorded pitch. Melody comes from rhythm, register (C#2/C#3/C#4/C#5) and layering, or from General MIDI tracks around them.

## Use

For projects in `examples/` (or a workspace from `daemonv12 init`):

```json
{"type":"drumkit","kit":"assets/glasshouse/kit.json"}
{"type":"sampler","sample":"assets/glasshouse/02-glass-reverse.wav"}
```

Kit notes use names: `{"start":"1:1","pitch":"bass-punch-cs","velocity":0.9}`. The kit maps the seven rhythmic sounds (`glass-hit`, `glass-crush`, `vox-chip`, `bass-punch-cs`, `sub-cs`, `chrome-clap`, `pixel-hat`). The three gestures (`glass-reverse`, `ghost-vox`, `prism-impact`) are samplers. Agents discover both with the existing `daemonv12_instruments_list` (query `glasshouse`) and `daemonv12_drumkits_list` tools.

- **Reverse timing.** `glass-reverse` and `sub-cs` are 37,800 frames: exactly two beats at 140 BPM. Start the reverse two beats before the target (for a target at bar *n*, place it at `(n−1):3`). At other tempos, start it 0.857 s early on the nearest grid position.
- **Low end.** Trigger `bass-punch-cs` and `sub-cs` together. Space sub retriggers by a beat or more: samples have no choke, and an overlapping tail at a different phase thins the new note.
- **Chops.** `vox-chip` clears a sixteenth up to 160 BPM. Alternate velocities (0.5/0.9) for stutters, and answer a `ghost-vox` phrase with chips at the same pitch.
- **Beat.** `chrome-clap` on half-time beat 3, `pixel-hat` sixteenths at 0.35–0.75 with accents, `glass-crush` on offbeats as the bass-call.
- **Starting mix** (the audition's track gains, master +1.4 dB): glass-hit −1, reverse −1, crush −2, ghost-vox −3 with a light reverb, vox-chip −2, bass-punch −7, sub −9, clap 0, hat 0, prism −2 dB.

## Reproduction and provenance

```sh
npm run fixtures:glasshouse   # WAVs, kit, catalog, then the audition project
npm run demo:glasshouse       # renders/glasshouse/: WAV, MP3, stems, analysis, provenance
node scripts/inspect-glasshouse.ts > renders/glasshouse/spectral.json
```

`scripts/generate-glasshouse.ts [output-project-directory]` uses only Node built-ins. Each sound has an explicit xorshift32 seed; there is no runtime randomness, timestamp, dither or external tool. Everything is synthesized in float64 at 4× (176.4 kHz) and decimated by a 255-tap Kaiser-windowed sinc (about 90 dB stop band), so the drive, crush and high partials do not alias. Then come a DC/infrasonic high-pass, endpoint tapers (first and last frames exactly zero), per-file peak scaling and explicit integer rounding to PCM16.

Repeated generation, in-process or in a fresh process, produces byte-identical WAVs, kit and catalog; tests enforce this and the catalog's SHA-256 values. Floating-point transcendental differences across Node/CPU implementations could change least-significant bits, so cross-environment byte identity is not promised.

## Audition

[GLASSHOUSE — Pack Audition](../../glasshouse-audition.json) is 14 bars of 4/4 at 140 BPM in C# minor: 24 s authored, 25.6 s with reverb tails, 10 tracks, 298 triggers. It demonstrates the pack; it is not GLASS//FIRE.

- Bars 1–2: exposed glass-hit motif answered by glass-crush; glass-reverse sucks into bar 3.
- Bars 3–4: ghost-vox phrases with vox-chip stutters at the same pitch; hats enter.
- Bars 5–10: half-time beat with the phase-locked low pair, chrome-clap, pixel-hat sixteenths, chip hook, crush bass-calls and glass punctuation.
- Bars 11–12: break on ghost-vox and glass, hat roll, chip and clap build, reverse into bar 13.
- Bar 13: prism-impact payoff with the low pair; bar 14 releases.

Measured render: −17.71 LUFS integrated, −2.2 dBTP, LRA 3.4 LU, no clipped samples on the master or any track. See [verification](../../../docs/GLASSHOUSE_VERIFICATION.md).
