# Soundtrack freeze: picture-lock handoff

**Preferred soundtrack: Challenger C3** (frozen). **Alternate: V3.** No creative changes until
final synchronization and mastering against the completed 1080×1920 / 60 fps picture.

| | Preferred: C3 | Alternate: V3 |
|---|---|---|
| Master (48 kHz / 24-bit) | `challenger/delivery/PermitPulse_TMD_Challenger_C3_48k24.wav` · SHA-256 `65dd59e9fcfa5149f625aed1cbcf87e12079721b3ca7f90aea08debfd237dde2` | `delivery/PermitPulse_TheMapsDisagree_Score_V3_48k24.wav` |
| Engine master (44.1 kHz / 16-bit) | `challenger/versions/c3/challenger-c3.wav` · `96e96ef83e738002320931f9d28fed38194b9a32b9f74f2b81702a4c01ebb382` | `versions/v3/permitpulse-v3.wav` · `e3461851ae9a9f6fdd560b1a3e18ca429fc78bb0cdd1e97b3f9a3357947741c1` |
| Stems | `challenger/delivery/stems-48k24/{music,sound-design}/` (12) | `delivery/stems-48k24/` (12) |
| Editable project | `challenger/project/challenger-c3.json` · `cf8d2e3d5705c25d2e61a99cc533b646c37e83ddaf08edcc0d66de9910bc4216` | `project/permitpulse-v3.json` |
| Reproducible source | `challenger/build.ts` → `scores/challenger.ts` `challenger('c3')` | `score/compose.ts v3` |
| Cue sheet | `challenger/CUE_SHEET.md` + `challenger/delivery/*events-60fps.json` / `*cue-sheet.csv` | `CUE_SHEET.md` + `delivery/*` |
| Checksums | `challenger/delivery/SHA256SUMS` | `delivery/SHA256SUMS` |

Frozen at git tag `permitpulse-soundtrack-c3-freeze` on branch `feat/permitpulse-28s-score`.
Engine: DaemonV12 0.7.0 at `23619d1`, Node v22.22.0, FFmpeg 6.1.1-3ubuntu5. Repeat renders are byte-identical.

## Next step (not started): final sync and mastering
When the 60 fps picture is locked: verify each cue in the C3 cue sheet against actual contact
frames (1.600 landing, 3.100 seat, 5.500–6.800 Map B, 13.667 cut, 21.500 tagline, 23.600/23.800 CTA),
adjust only the named `CUES_*` / `CUT` / `STOP` constants if picture moved, re-render, then master to the
delivery spec. Any such change becomes a new version (C3.1); C3 stays as frozen here.
