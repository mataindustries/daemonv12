# Contributing

DaemonV12 is a small engine that agents rely on for exact, repeatable output.
Bug reports, focused fixes and documentation improvements are welcome. The code
license has not been chosen yet, so please open an issue before starting a larger
contribution.

## Set up

Use Node 22.18 or newer:

```sh
npm ci
npm run check          # typecheck and tests; real-audio tests skip without FluidSynth/FFmpeg
npm run test:package   # before changing packaging, executables, dependencies or shipped files
```

`npx --no-install daemonv12 doctor` shows which audio tools are available; see
[developer setup](docs/DEVELOPER_SETUP.md) for FluidSynth, SoundFont and FFmpeg.

## Ground rules

- **Keep it deterministic.** The engine core uses no clocks, randomness or
  environment reads; `tests/architecture.test.ts` enforces module boundaries.
- **Keep the engine dependency-free.** `src/` imports no npm packages. The MCP SDK and
  Zod belong to `mcp/` only.
- **Don't change existing output.** Golden MIDI and audio-hash tests are the contract.
  Format changes are additive: new optional fields, never reinterpretations.
- **Treat errors as product.** Diagnostics need a code, a path and a hint an agent can
  act on.
- **Test what you change.** Real-audio tests may skip, but the Node-only path must
  stay covered.
- **Ship what you add.** New runtime files must be in the `files` allowlist in
  `package.json`; `npm run test:package` fails otherwise.
- Note user-visible changes under "Unreleased" in [CHANGELOG.md](CHANGELOG.md). Keep
  `package.json` and `src/version.ts` versions identical.

## Issues and pull requests

For bugs, include the command, the project JSON (or a minimal one) and the output of
`daemonv12 doctor --json`. Keep pull requests focused, and describe the behavior
change and how you verified it. CI must pass. Report security problems privately as
described in [SECURITY.md](SECURITY.md).
