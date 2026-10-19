# Approved audio drop zone

Place the approved lossless master here, unchanged:

```
public/audio/ignition-002-second-wind.wav
SHA-256 6938bf3b8efd90d9c9818dc20689b71e408d9d22be1cab7e01da597da22a80e1
```

The file is git-ignored. `scripts/analyze.ts`, `scripts/render.ts` and `scripts/verify.ts` refuse
any other file. It is never regenerated, remastered, time-stretched or remixed: the master's AAC
track is encoded once, directly from this WAV.
