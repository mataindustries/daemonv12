# Public beta release checklist

Nothing in this repository publishes automatically. A release removes safeguards on
purpose, in order. Steps marked **owner** are decisions only the owner can make.

## 1. Decisions (owner)

- [ ] **Code license.** Add `LICENSE` at the root, set the SPDX `license` field in
      `package.json`, and update the README "License" section and
      [SHARING.md](SHARING.md). Confirm it covers code, example projects, kit and
      catalog metadata and docs. The CC0 asset dedications stay as they are.
- [ ] **Version.** `0.5.0` has never been tagged or published, and the packaging work
      does not change audio output. The simplest first public release is `v0.5.0`,
      folding the CHANGELOG "Unreleased" entries into the 0.5.0 section. To mark the
      packaging separately, use `0.5.1` and change `package.json` and
      `src/version.ts` together (render manifests record the engine version).
- [ ] **npm name and account.** `daemonv12` and `daemonv12-mcp` were unclaimed when
      this was written. Decide which npm account or organization owns `daemonv12`,
      and enable two-factor authentication.
- [ ] **Repository.** Make it public if it is not, set a description and topics
      (for example `mcp`, `mcp-server`, `ai-agents`, `music`, `audio`, `midi`) so people
      can find it, and enable private vulnerability reporting (Settings > Security)
      so [SECURITY.md](../SECURITY.md) works.

## 2. Version and changelog

```sh
node -p "require('./package.json').version"   # must equal src/version.ts (a test enforces it)
```

- [ ] In `CHANGELOG.md`, turn "Unreleased" into `## <version>: <title> (<date>)`.
- [ ] `npm ci && npm run check` passes locally.

## 3. Package clean room

```sh
npm run test:package     # pack, install the tarball in an empty directory, use it
npm pack --dry-run       # review the file list and sizes
```

- [ ] `test:package` passes; with FluidSynth, a SoundFont and FFmpeg installed it also
      covers GM, production effects, MP3 and exact stems.
- [ ] The file list contains only `bin/`, `dist/`, the allowlisted examples, assets,
      docs and bootstrap files (about 88 files, 4.9 MB packed).

## 4. CI

- [ ] **Portable checks** is green on the release commit, including the package
      clean-room jobs on Linux and macOS.
- [ ] Run **Full audio verification** manually (Actions tab); both jobs are green.

## 5. Tag and GitHub release (owner)

```sh
git tag -a v0.5.0 -m "DaemonV12 0.5.0 public beta"
git push origin v0.5.0
npm pack                     # attach daemonv12-0.5.0.tgz so people can install without npm
gh release create v0.5.0 daemonv12-0.5.0.tgz --title "DaemonV12 0.5.0 (public beta)" --notes-file release-notes.md
```

A tarball attached to the release installs with
`npm install -g https://github.com/mataindustries/daemonv12/releases/download/v0.5.0/daemonv12-0.5.0.tgz`.

## 6. npm publication (only when intentionally enabled)

1. In the release commit, remove `"private": true` from `package.json`. This is the
   deliberate switch; until then npm refuses to publish. `npm publish --dry-run` does
   not check `private`, so it is no proof of safety.
2. `npm whoami`, then `npm publish --dry-run`. The `prepublishOnly` guard lists
   anything still missing (license, LICENSE, changelog section, clean tree,
   confirmation).
3. Publish, confirming the exact version:

   ```sh
   DAEMONV12_RELEASE=0.5.0 npm publish --access public
   ```

   `prepare` rebuilds `dist/` before packing. A 0.x version already signals beta.
4. Verify from an empty directory:

   ```sh
   npx -y daemonv12@0.5.0 doctor
   npm install -g daemonv12@0.5.0 && daemonv12 init /tmp/daemonv12-check && daemonv12-mcp --version
   ```

5. Update docs that avoid bare `npx`: once the name is yours, clients can launch
   `npx -y --package=daemonv12 daemonv12-mcp --root <workspace>`.

## 7. Release notes template

```markdown
DaemonV12 0.5.0 is a public beta of a headless, deterministic music engine for
AI agents: JSON projects or nine MCP tools in; MIDI, WAV, MP3, stems, loudness
analysis and SHA-256 provenance out.

Try it: git clone … && npm ci && npm run demo:share
Connect an agent: docs/MCP_CLIENTS.md (Claude Code, Codex CLI, any stdio client)

Highlights: General MIDI, samples and drum kits, the CC0 Orbital Foundry pack,
automation, compressor/reverb/saturation, VO ducking, exact loop and video durations.

Limitations: offline renderer, not a DAW or real-time engine; GM/sample palette;
rootless audio bootstrap is Linux x86_64 only; Windows untested.
Full changes: CHANGELOG.md.
```

## Rollback and deprecation

- **npm:** a published version number can never be reused. Unpublishing is only
  allowed within npm's [unpublish policy](https://docs.npmjs.com/policies/unpublish).
  Prefer `npm deprecate daemonv12@<bad> "<reason>; use <good>"`, publish a fixed
  version, and move `latest` with `npm dist-tag add daemonv12@<good> latest`.
- **GitHub:** edit or delete a bad release, but do not move a public tag; release
  a new version instead.
- **Users:** MCP configurations point at an installed path or `daemonv12-mcp`, so a
  fixed version takes effect after `npm install -g daemonv12@<good>` and a client
  restart.
