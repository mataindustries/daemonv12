# SIGNAL Lab 0.2.0 — optional pack

**Rights: PENDING OWNER REVIEW.** No licence is granted or implied. The private
package metadata prevents accidental npm publication; `UNLICENSED` is not an
ownership attestation or a CC0 dedication. The supplied README, catalog and
generator retain their original provenance statements without adding attestations.

This pack contains exactly nine existing WAVs, three kits and a catalog from the
reviewed instrument archive. All supplied files, including the generator, README
and SHA256SUMS.txt, are preserved byte-for-byte. Pack version 0.2.0 is independent
of engine version 0.7.0. It is excluded from the core npm tarball and default init.

Source archive `signal-instruments.zip` SHA-256:
`74553708aad7dba72d9adb0d9e5e044699911c4f23c06f1f5ab846e876055e49`.

## Install into a project

From the repository root, with an existing project at `/path/to/project/cue.json`:

```sh
mkdir -p /path/to/project/assets
cp -R packs/signal-lab/0.2.0/assets/signal-lab /path/to/project/assets/
cp packs/signal-lab/0.2.0/signal-lab.catalog.json /path/to/project/
```

Choose a destination without an existing `assets/signal-lab` directory. Keep this
pack's README, INSTALL.md and checksums alongside any internal archive copy.
No generator run is needed to install or use the verified samples.

Existing MCP `daemonv12_instruments_list` and `daemonv12_drumkits_list` discover
these assets when passed that project path. Select one of:

- `assets/signal-lab/pad/kit.json`
- `assets/signal-lab/lead/kit.json`
- `assets/signal-lab/swell/kit.json`

Each is a normal `drumkit` instrument; use the named hits in the supplied README.
No rendering or discovery algorithm changes are required.

## Limits

- The lead has only five sampled notes: C#4, E4, E#4, G#4 and A4. There are no
  multisamples for other pitches or velocity layers. `playbackRate` transposition
  changes pitch, duration, vibrato and formants together.
- Chord movements are baked into the WAVs at fixed source times, not tied to
  project tempo. The pads' thirds arrive at 1.4–2.4 seconds. The bright swell
  moves at 1.0 and 2.0 seconds; the dark swell adds A4 at 2.6 seconds. Offsets,
  gates and playback rates can skip, cut or rescale those movements.
- There is no true legato: every trigger starts an independent sample voice.
  Overlaps, envelopes, choke groups and rate glide do not preserve a shared
  bow, breath or oscillator phase between notes.

## Verify and package locally

```sh
cd packs/signal-lab/0.2.0
sha256sum -c SHA256SUMS.txt
cd ../../..
npm run test:signal-lab
npm run pack:signal-lab
```

The last command creates `daemonv12-signal-lab-0.2.0.tgz` locally; it does not
publish. Extract it with `tar -xzf daemonv12-signal-lab-0.2.0.tgz`; the pack is
under `package/`. Copy `package/assets/signal-lab` as above. The tests unpack this
tarball, verify every source hash and exercise discovery in an isolated workspace.

Regeneration checks write only to temporary directories and compare all nine
WAVs, three kits and catalog to the supplied files. Never replace the verified
files with regenerated output. Floating-point transcendental differences across
Node/CPU implementations may affect exact regeneration; a mismatch is a failure
to investigate, not permission to update the checksums.
