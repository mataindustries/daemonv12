# Sharing and future package audit

Both root `daemonv12` and workspace `@daemonv12/mcp` remain **private**. This pass
does not publish, create a release or choose a code license.

## npm structure

The root already has a version, Node engine requirement, executable
`bin/daemonv12.js`, direct TypeScript sources and zero runtime npm dependencies.
The MCP workspace has its own bin and pinned SDK/Zod runtime dependencies.
Repository, homepage and issue URLs now match the existing Git remote.

The initial `npm pack --dry-run --json` audit found **119 entries**, **6,164,931
unpacked bytes** and **4,506,965 compressed bytes**. Most size is the checked-in
original sample packs; the external 148 MB FluidR3 GM SoundFont is not vendored.
Ignored `renders/`, `.daemonv12-renders/` and `node_modules/` are excluded, but
the default pack includes tests, devcontainer files, generator scripts, docs,
examples and portfolio reports (some report links are local historical paths).
After the readiness additions, the default root pack contains **132 entries**,
approximately **6.25 MB unpacked / 4.54 MB compressed**, including **5,486,200
bytes of sample assets** and no generated render paths. The separate MCP dry run
contains **9 entries / 37,275 unpacked bytes**, confirming that it omits the
engine sources it currently imports.

Before any intentional npm publication:

1. Choose a root code license and add its file/metadata; audit all intended assets.
2. Decide whether to publish the zero-dependency engine and MCP as separate
   packages or bundle MCP. A root tarball can contain `mcp/` source without
   installing its nested runtime dependencies: npm **workspaces do not make
   those root package dependencies**. A separately published MCP package also
   currently imports `../src`; its tarball alone is not standalone.
3. Define an explicit `files` allowlist for source/bin/docs and intentional demo
   assets; exclude tests, reports, development/bootstrap caches and generated
   renders. If retaining demos, include their WAVs, kit JSON and existing CC0
   notices. If removing examples, adjust demo/smoke scripts and documentation.
4. Decide the installed package's public entry points and Node support policy.
   Direct `.ts` execution works on supported Node; there is currently no library
   `exports` contract or compiled distribution to promise to consumers.
5. Pack and test actual tarballs in an empty directory, including CLI bins, MCP
   dependency resolution, an audible sample render and package size. A dry run
   alone is not a publication-readiness proof.
6. Only after those decisions should the owner intentionally change `private`
   and carry out a separate publishing/release workflow.

This repository is clone-ready with `npm ci`; it is **not yet a standalone npm
distribution**. No `files` allowlist or publication-facing dependency layout was
guessed during a portability pass.

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
- Pulse-kit WAV fixtures have an existing **CC0-1.0** dedication in that kit's
  README. These asset terms remain unchanged.
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

Once the owner selects a code license, update the root LICENSE, appropriate root
and MCP package `license` fields, README sharing language and any required
copyright/NOTICE material. Confirm coverage of code, project examples, kit/catalog
metadata and documentation; preserve separately scoped asset and dependency
licenses. No license selection is made here.
