# public/sync/

Drop the final GLASS//FIRE audio here. Everything in this folder except this README is
git-ignored. The full contract is in [`SYNC_HANDOFF.md`](../../SYNC_HANDOFF.md).

```
public/sync/
  sync.json            which file is which (required)
  master.wav           final master, exactly 24.000 s
  stems/kick.wav       one WAV per visual role, sample-aligned with the master
  stems/sub.wav
  stems/glass.wav
  stems/vox.wav
  stems/clap.wav
  stems/hat.wav
  master.render.json   optional: DaemonV12 render manifest (exact sample triggers)
  structure.json       optional: authored markers and automation lanes
  promo-data.json      written by `npm run analyze`; read by the composition

  # The vertical cut (npm run vertical:prepare) also reads:
  project.json         optional: the DaemonV12 project the manifest names (GM programs)
  master-gate.wav      optional: the master ducking source the manifest names (exact silences)
  # and writes:
  vertical-15s.wav     the 15-second edit of master.wav
  vertical-extras.json triggers, automation, silences and GM programs for GlassFireVertical
  vertical-15s.edit.json  the edit report (segments, crossfades, identity, seams, loudness)
```

`master.render.json` is required for the vertical cut. The two optional files are used only
when their SHA-256 matches the one recorded in the manifest.
