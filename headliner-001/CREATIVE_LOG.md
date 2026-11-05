# SODIUM HOURS · creative-production log (short)

The full evidence for every step is in [PRODUCTION_NOTES.md](PRODUCTION_NOTES.md). I cannot hear audio:
judgments below come from the score and from measurements (engine analysis, spectrograms, per-stem
loudness, pitch tracking). No human listening feedback was available.

**Thesis.** A machine city learning to sing. The motif is heard as machine (low-pass-gate pluck,
straight grid), as voice (synthetic talkbox, swung, sliding) and finally as choir. Its answer ends on
an E♮ that keeps falling back to E♭ (V–♭VI deceptive cadence) until the last minute, when it rises to F
over F major. 92 BPM, F minor; groove sections on a Dorian vamp, hooks on D♭maj9–E♭–Fm9–C7♭9.

**Directions (sketches).** A: West Coast talkbox nocturne. B: industrial half-time hymn (riff as hook).
C: Buchla polyrhythm (five-note lattice in dotted eighths). Chose A provisionally: the only one answering
all four words of the brief, with a hook whose unresolved note gives a three-minute form something to
pay off. B's riff aggression and C's lattice were absorbed into A's second half.

**Versions.**
- **V1** — complete 70-bar form. Measurements showed a flat arc (beat sections within 1 dB), a
  near-mono image and a mid-range hole in the groove; a struck pipe tuned to F was acting as a drone
  that clashed with the E♮.
- **V2** — pipe follows the chord root; hook 1 lighter, breakdown intimate, hook 2 and final wider;
  hierarchy fixed from a per-stem loudness matrix (the kick had been the loudest stem everywhere). A first
  V2 render showed the master compressor was flattening every section difference; the master was then
  chosen with a simulator that reproduces the engine's chain exactly.
- **V3** — the intro withholds the answer, so the voice reveals the E♮; keys get a moving top line so the
  groove carries the mids without the lead; transitions de-duplicated; rain rumble halved; a natural tail.
- **V4 (risk pass)** — the final cadence broadens into half time before the F-major resolution. Kept:
  accents land on structural melody notes and no energy hole opened. V3 is preserved for an A/B.
- **V5** — Hook 2 gets its own answer, so the ceiling climbs A♭5 → B♭5 → C6 across the choruses. Kept
  after a pitch check. Stopped at the five-version budget.

**Sound.** 163 original sounds, all synthesized in `tools/` (no recordings, samples, SoundFonts, GM or
existing packs). Exposed parts use baked FDN halls because the engine's built-in reverb showed flutter
and low-frequency comb buildup on the same pluck. Most instruments are multisampled at rate 1 and the
voice is bounced per phrase, so the sampler used 3.7 % of its interpolation budget.

**Delivery.** Master −11.35 LUFS, LRA 6.2 LU, −2.07 dBTP, no clipped samples; instrumental bed as the
alternate mix; 15 stems. Two renders byte-identical; stems plus the documented master chain reproduce
the master exactly; a fresh copy restored from the committed FLAC assets renders the identical master.

**Known risks for owner listening.** The talkbox/G-funk lineage could read as retro rather than
futuristic. On small speakers the groove loses more than the hooks (it is bass-led). The half-time
cadence trades momentum for breadth. Only listening can settle these.
