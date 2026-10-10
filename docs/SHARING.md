# Sharing and package readiness

The repository can be shared by GitHub clone today, and `npm pack` produces a
self-contained, installable tarball. Nothing has been published: the package stays
`"private": true`, and the code license is the owner's outstanding decision. The
deliberate release steps are in [PUBLIC_BETA_RELEASE.md](PUBLIC_BETA_RELEASE.md).

## Package structure (resolved for the public beta)

The earlier audit found that both `daemonv12` and the `@daemonv12/mcp` workspace
were private, that the MCP workspace imported engine source outside its own package,
that npm workspaces do not turn into dependencies of a packed root tarball, and that
there was no `files` allowlist. A real install test also showed a blocker the dry run
missed: **Node refuses to strip TypeScript types under `node_modules`**, so even
`daemonv12 --version` crashed from an installed tarball. Now:

- **One package, two executables:** `daemonv12` (CLI) and `daemonv12-mcp` (MCP
  server). The MCP SDK and Zod are ordinary root `dependencies`, exactly pinned; the
  engine under `src/` still imports no npm package. The `mcp/` workspace manifest is
  gone, and `mcp/bin/daemonv12-mcp.js` remains as a compatibility path for clones.
- **Compiled runtime for installs only.** `npm pack`/`npm publish` run `prepare`,
  which compiles `src/` and `mcp/` to `dist/` with type erasure only. `bin/launch.js`
  runs the TypeScript in a checkout and `dist/` in an installed package. A checkout
  never executes `dist/`, so development keeps its zero-build loop.
- **Explicit `files` allowlist:** `bin/`, `dist/`, seven starter projects, the two sound
  catalogs, `examples/assets/` (all four CC0 packs), format and MCP docs, the rootless
  bootstrap and its lock, `CHANGELOG.md` and `SECURITY.md`. Tests, reports, CI,
  devcontainer, historical examples, internal docs, generators and renders are
  excluded. The package has no install-time scripts.
- **Measured tarball:** 103 files, about 5.6 MB packed and 8.3 MB unpacked; 7.7 MB of
  that is the CC0 sample audio. The external 148 MB FluidR3 GM SoundFont is not
  bundled.
- **Proof:** `npm run test:package` packs the repository, installs only the tarball
  into an empty directory, and exercises the CLI, `init`, Node-only rendering, the
  nine MCP tools and (when available) full audio, failing if any installed process
  loads a module from the checkout. CI runs it on Linux and macOS.
- **Publish safety:** `"private": true` makes npm refuse to publish (note that
  `npm publish --dry-run` does not check it). The `prepublishOnly` guard
  (`scripts/release-guard.ts`) additionally refuses without a license, a LICENSE
  file, a matching changelog section, a clean git tree and an explicit
  `DAEMONV12_RELEASE=<version>` confirmation.
- **Name:** neither `daemonv12` nor `daemonv12-mcp` exists on npm yet. Until the owner
  publishes, documentation avoids bare `npx daemonv12…`, which would download
  whatever package later claims the name.

## Licensing inventory and owner decision

There is **no root code LICENSE or package license field**. Public access to a
repository is not a general grant to modify/redistribute its code. Outside
builders need the owner's explicit license decision before relying on those
rights. This is a sharing blocker, even when clone/install/render works; see
[GitHub's licensing guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository).

The checked-in WAVs appear internally generated: their generator scripts use
mathematical/noise synthesis, and the pack documentation states that no external
recordings or sample sources were used. Existing asset terms are already explicit:

- The twelve Orbital Foundry WAVs have an existing **CC0-1.0** dedication in
  `examples/assets/orbital-foundry/LICENSE`; it expressly does not license code.
- The ten GLASSHOUSE WAVs have the same **CC0-1.0** dedication in
  `examples/assets/glasshouse/LICENSE`, which likewise does not license code.
- Pulse-kit WAV fixtures have an existing **CC0-1.0** dedication in that kit's
  README. These asset terms remain unchanged.
- The synthetic voice-over reference `examples/assets/v05/synthetic-vo.wav` has a
  **CC0-1.0** dedication in its directory README. All four packs ship in the npm
  package with their notices; dependencies are installed by npm, not bundled.
- No separately vendored third-party implementation was identified in this
  review. That is an inspection finding, not a legal provenance guarantee for
  every line of code or project metadata.
- npm dependencies retain their own terms: the SDK and TypeScript are Apache-2.0;
  Zod, MIDI tooling and many transitives are MIT, with some ISC packages. Their
  package licenses/notices remain in dependencies and the lockfile.
- Provisioned FluidSynth and this FFmpeg build are **GPL-2.0-or-later** according
  to their package metadata. FluidR3 GM carries its upstream MIT notice, extracted
  alongside the SoundFont. Runtime packages retain their own license metadata;
  they are downloaded into user space, not relicensed or added to the repository.
  Redistribution of external binaries requires reviewing their applicable
  license/notice/source obligations separately from choosing a code license.

Once the owner selects a code license, add the root LICENSE file, set the package
`license` field, update the README license section and add any required
copyright/NOTICE material. Confirm coverage of code, project examples, kit/catalog
metadata and documentation; preserve separately scoped asset and dependency
licenses. No license selection is made here.
