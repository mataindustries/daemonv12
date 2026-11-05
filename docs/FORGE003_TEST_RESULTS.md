# FORGE 003 renderer verification

Final verification ran on Linux x86_64 with Node `v24.19.0`, configured FFmpeg
`6.1.1`, FluidSynth `2.3.7` and the configured FluidR3 GM SoundFont. The renderer
implementation and independent legacy audit are commits `9efa0f3`, `00cfbc9`
and `9fc214f`. The completed stress proof is commit `b36f4e4`.

## Final repository check

```sh
SDL_AUDIODRIVER=dummy PATH=/tmp/forge003-tools:$PATH npm run check
```

Typecheck passed. The test runner reported **333 tests: 331 passed, zero failed,
two skipped**, in approximately 413 seconds. The final architecture check passed;
the earlier intermediate-state import failure is resolved. Actual General MIDI,
stdio MCP, sample/production audio, effects, MP3, alignment, cleanup and sampler
articulation integrations ran successfully. All seven exact-voice-reuse tests
and the 180-second score/budget regression passed.

The two skipped historical byte gates are GLASSHOUSE and GLASS//FIRE reference
renders recorded with FFmpeg `6.1.1-3ubuntu5`; this runtime reports `6.1.1`. The
Signature showcase test also explicitly omits its historical committed-WAV byte
comparison for that build-string difference, while its rendering, alignment,
headroom and mono checks pass. These omissions are not counted as byte-identity
proofs. The separate [legacy comparison](FORGE003_LEGACY_VERIFICATION.json)
compares archived main with this renderer under the same configured tools:
four projects, 25 stems and 80 adversarial cache cases.

## Installed-package check

```sh
SDL_AUDIODRIVER=dummy PATH=/tmp/forge003-tools:$PATH npm run test:package
```

The clean-room gate passed **10 tests with zero failures or skips**. It packs
the local checkout, installs the tarball in an empty temporary directory and
checks CLI, doctor, initialization, sync/cropping, the nine MCP tools, sample
rendering and real GM/production/MP3/stem rendering. No package was published.

Measured tarball: **128 files; 5,764,986 packed bytes; 8,720,460 unpacked bytes**,
within existing limits. Twenty installed DaemonV12 processes loaded 152 modules,
all inside the consumer installation; none loaded source-checkout modules. The
gate's before/after git-status assertion passed.

## Environment and retained evidence

`/tmp/forge003-tools/fluidsynth` is a temporary symlink to this session's
configured FluidSynth executable, needed by existing integration tests that
probe the literal command on `PATH`. `SDL_AUDIODRIVER=dummy` is the documented
headless setting. No global audio configuration or repository defaults changed.
On another host, put its supported FluidSynth executable on `PATH` and configure
the documented `DAEMONV12_*` audio variables before running these commands.

The execution sandbox rejects some Node fixture subprocesses with `EPERM`, so
these final checks ran with subprocess execution enabled. Logs retained in this
workspace are `/tmp/forge003-final-check.log` and
`/tmp/forge003-package-check.log`. The checked-in stress and legacy reports
retain their own source/output hashes and reproduction commands.

These are technical verification results. They do not establish listening
approval, musical quality, commercial clearance or a new license grant.
