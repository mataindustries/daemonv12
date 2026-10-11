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
```
