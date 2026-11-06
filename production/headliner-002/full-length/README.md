# CHROME STALLION — Full Length (HEADLINER 002, Phase 2)

**Status: FINAL CANDIDATE for owner listening. Not merged, not published, no licence granted.**
The producer (an AI agent) cannot hear audio; descriptions are score intent, numbers are measurements.

## Listen / download (workspace paths)
- **MP3 (start here):** `listening/chrome-stallion.24.mp3` (4.4 MB, 192 kbps, encoded directly from the PCM24 master)
- **PCM24 master:** `masters/chrome-stallion.24.wav` (48 MB, stereo 44.1 kHz signed 24-bit, 188.122 s = 3:08)
- **Aligned stems:** `delivery/stems/*.wav` (12 stems, each exactly 8,296,200 frames) and lossless
  `delivery/stems-flac/*.flac` (83 MB total; FLAC decode verified byte-identical to the WAV stems)
- Earlier versions: `versions/chrome-stallion-v1-preview.mp3`; Phase-1 sketch: `../listening/b-chrome-stallion.mp3`
- Hashes: `delivery/SHA256SUMS`; measurements: `VALIDATION.json`; per-chunk PCM24 metadata: `delivery/metadata/chunks/`

## The record (G minor, 98 BPM, swing 0.58, 76 bars)
Ignition (stretched riff gesture, bass alone) → the original sketch groove → harmonic development
(Eb/Cm/Eb/F) with a haunting Impossible Voice melody → strange-beauty break (drums withdraw, bowed
chords, slow melody) → displaced evolution (Eb cell shifted +0.5 beat against unchanged drums) →
**ORGANISM rupture**: half-time, the bass becomes long machine notes while clock/tines/bars take over
the riff's rhythm, two bars of negative space (bowed subharmonic + hum), stop-time return → heavy
evolved return (second voice harmonies, machine bass) → high-register machine payoff with the voice's
overtone lane over held roots → warm coda: fragments, resolution, and one held G whose bass macro
relaxes machine→warm inside the note, final bar-ring at beat 300.
Full arc, critique and revision history: `PRODUCTION_LOG.md`. Sketch DNA frozen in `FROZEN_SKETCH.json`.

## Reproduce
```bash
node production/headliner-002/full-length/scores/chrome-stallion-full.compose.ts   # regenerates the full score (no diff)
python3 production/headliner-002/full-length/tools/split_chunks.py               # from repo root: writes 9 chunk scores to work/headliner-002-full/chunks/ (committed copies in scores/chunks/)
# per chunk (9x):  node studio-001/rack/cli.ts bounce scores/chunks/chunk-XX-*.score.json NEW_BOUNCE
#                  node scripts/headliner-production24.ts project NEW_BOUNCE/main.json NEW_PCM24
# then trim each chunk master/stem to its section length (beats*60/98 s; keep the last chunk's tail),
# silence-pad missing stems, and concatenate with ffmpeg -c copy (see PRODUCTION_LOG.md).
node scripts/headliner-production24.ts replay <any chunk PCM24 delivery> NEW_DIR  # deterministic replay proof
```
Exact split/assembly tooling used is preserved in `tools/` (split_chunks.py, analyze.py, validate_final.py);
it expects to run with `work/headliner-002-full/` as its scratch directory.

## Provenance
Original synthesis only: Signature Rack 1.0.0 instruments (Living Bass, Impossible Voice, Mechanical
Orchestra; HEADLINER 001 context kick/snare) from numeric parameters + seeded PRNGs. No recordings,
samples, SoundFonts, presets, third-party audio or artist imitation. Sources remain PCM16 phrases;
Float64 engine processing is exported to genuine PCM24 (not an upconverted finished mix).
Licensing status: unchanged from the repository — owner review required; nothing here grants a licence.
