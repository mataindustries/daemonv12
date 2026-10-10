# GLASSHOUSE verification

Measured with Node v22.22.0 and FFmpeg 6.1.1-3ubuntu5 on Linux x86_64, rendered through DaemonV12 0.5.0's native production pipeline. No engine, schema or MCP change was needed. Verification is analytical and visual (spectrograms); no human listening session was available. The WAV, MP3 and stems support that final aesthetic review.

## Canonical audition

Project: `examples/glasshouse-audition.json` (authored by `scripts/create-glasshouse-audition.ts`). Render: `npm run demo:glasshouse`.

| Measurement | Result |
|---|---:|
| Authored length | 14 bars at 140 BPM = 24.000 s |
| Rendered length | 25.599977 s / 1,128,959 frames (reverb horizons on glass-hit and ghost-vox) |
| Integrated loudness | −17.71 LUFS |
| True peak / sample peak | −2.2 dBTP / −2.296 dBFS |
| RMS / loudness range | −20.16 dBFS / 3.4 LU |
| Clipped samples (master and all ten tracks) | 0 |
| Tracks / triggers | 10 / 298 (7 drum-kit tracks, 3 samplers) |
| Master SHA-256 | `fed0082960cb69d7cb58255c2a91b16eb30c42ba655fabdb12f742ad74b74773` |

Track loudness (stems, integrated): ghost-vox −22.7, prism-impact −22.5, bass-punch −23.1, glass-reverse −23.9, chrome-clap −24.7, glass-hit −25.3, glass-crush −25.9, sub −26.2, vox-chip −26.4, pixel-hat −31.7 LUFS.

Master band power (`node scripts/inspect-glasshouse.ts`, unweighted, independent channels): below 30 Hz 0.06%, 30–120 Hz 51.7%, 120–500 Hz 9.2%, 500 Hz–2 kHz 34.5%, 2–6 kHz 2.5%, 6–12 kHz 1.6%, above 12 kHz 0.4%; L/R correlation 0.966. The mix is centered and mid-forward by design: glass at 554 Hz and voice formants at 0.8–1.2 kHz carry the identity. Per-second RMS stays above −25 dBFS from 0 to 21 s, then releases (−28, −32, −38 dBFS) after the 20.57 s payoff.

The integration test also verifies: prism-impact begins exactly at bar 13 (frame 907,199) and is silent before it; glass-reverse rises more than 20 dB into bar 3 and is silent from that boundary on; all ten stems are aligned and hash-identical to the manifest; and a second render is byte-identical (master, stems, analysis, manifest).

## Sources

| Sound | s | Ch | Peak | Tuning | Measured character |
|---|---:|:---:|---:|---|---|
| glass-hit | 1.000 | M | −6 | +0.3 ¢ | 93.8% 0.5–2 kHz, 5.5% 2–6 kHz, 0.3% 6–12 kHz; −40 dB at 870 ms |
| glass-reverse | 0.857 | S | −7 | +0.1 ¢ | rises from −61 to −16 dB (first/last tenth), peak at 845 ms; correlation 0.94, below 150 Hz 0.98 |
| glass-crush | 0.420 | M | −6 | +3.5 ¢ | 61.5% 120–500 Hz, 36.9% 0.5–2 kHz; glass modes 5.404/2.756 at −13/−16 dB re fundamental |
| ghost-vox | 0.950 | M | −7 | −0.5 ¢ | formant energy 0.5–2 kHz, 2.0% 2–6 kHz air, envelope peak 90 ms |
| vox-chip | 0.085 | M | −7 | +2.6 ¢ | peak at 10 ms, −40 dB by 80 ms; profile similarity to ghost-vox 0.98 |
| bass-punch-cs | 0.320 | M | −5 | +3.2 ¢ | 65.9% 30–120 Hz, 33.9% 120 Hz–2 kHz; last tenth −35 dB below first |
| sub-cs | 0.857 | M | −7 | 0.0 ¢ | 99.6% 30–120 Hz |
| chrome-clap | 0.360 | S | −5 | — | 26/27/30/11/5% across 120–500/0.5–2k/2–6k/6–12k/12k+; correlation 0.88, below 150 Hz 1.00 |
| pixel-hat | 0.055 | M | −7 | — | 80.7% 6–12 kHz, 0% below 2 kHz, −40 dB by 25 ms |
| prism-impact | 1.800 | S | −5 | C#m | 15.9% 30–120 Hz, 5.3% 2–6 kHz; correlation 0.50, below 150 Hz 0.93 |

Low pair at velocity 1 on the same tick: peak −1.05 dBFS, +2.0 dB coherent energy over the separate sounds, 0.92 correlation after the punch's drop. All sources: first and last frames zero, |DC| < 0.0001 of full scale, no samples at ±full scale.

## Quality pass

The first full draft was rejected on analysis before the audition was written. Glass-hit had 1.1% power at 2–6 kHz (weak sparkle) and ghost-vox 0.05% (muffled, not airy). The clap was 72.5% body below 500 Hz (a tom, not a clap). The reverse's diffuser scrambled its fundamental between channels (correlation 0.14), so it would partly cancel in mono. And the crush's quantizer acted as a gate, cutting its grit off abruptly at 0.33 s. Calibration fixed those (5.5%, 2.0%, 26.4%, 0.94; crush before the gate).

The refinement pass then came from the first audition render. That render was 78% below 120 Hz, peaked at −0.18 dBFS and had an 8 LU loudness range. Its spectrogram showed the sub sustaining as one continuous drone from 7 to 18 s.

- **sub-cs** decay 0.5 s / 1.0 s → 0.34 s / 0.857 s (two beats at 140 BPM). The groove now has low-end gaps, and retriggers no longer land on a loud out-of-phase tail. At 140 BPM a sixteenth is 7.42 cycles of 69.3 Hz.
- **glass-crush** read as a low boom (centroid 155 Hz, 7.5% midrange). It gained a falling 1.5 kHz→650 Hz call resonance and a longer, resample-like glass body, giving 36.9% midrange (centroid 302 Hz). Its glass modes rose 5–7 dB, while its 3rd-harmonic distortion fell to −21 dB.
- **pixel-hat** −10 → −7 dBFS and **chrome-clap** −6 → −5 dBFS, so the drums sit against the low pair at ordinary velocities.
- The audition mix was rebalanced; an attempted master compressor was removed because it lowered loudness by 1.4 LU. Result: 51.7% below 120 Hz, −2.2 dBTP, LRA 3.4 LU.

## Checks

- Generator: byte-identical WAVs, kit and catalog in-process and in a fresh Node process, identical to the checked-in files and the catalog SHA-256s; the audition project regenerates identically and compiles without diagnostics.
- `tests/glasshouse.test.ts` (7 tests): format, channels, rate, frames, duration bounds, peak targets, headroom, no clipping, DC, zero endpoints, tail truncation, stereo distinctness, pack size, tuning within 5 cents, spectral roles, family evidence, catalog/kit/MCP discovery consistency, audition structure.
- `tests/glasshouse.integration.test.ts` (1 test, real FFmpeg render, twice): as above.
- Updated existing expectations for the third discovered kit (`tests/mcp.test.ts`), the fourth init pack (`tests/init.test.ts`) and the package file list (`tests/package.clean-room.ts`).

Renders under `renders/glasshouse/` stay Git-ignored. Floating-point transcendental differences across Node/CPU builds could change least-significant bits; the tests compare against this environment's output.
