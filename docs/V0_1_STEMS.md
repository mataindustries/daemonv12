# V0.1 track stems

Moved from the README for the public beta; the contract is unchanged. Production
renders (V0.3+) add aligned stems with track processing; see [V0_3_AUDIO.md](V0_3_AUDIO.md)
and [V0_5_TIMELINE_DYNAMICS.md](V0_5_TIMELINE_DYNAMICS.md).

`npx --no-install daemonv12 render examples/demo.json --stems` also produces
`renders/demo.stems/bass.wav` and `renders/demo.stems/keys.wav`.
Each stem is rendered from only that track's MIDI events, retaining the project's
conductor, original channel, and full musical timeline. All WAVs use the existing
44.1 kHz, 16-bit stereo PCM settings. The master is unchanged; natural release tails
may differ between stems. Silent tracks and silent portions are valid.

`--json` adds `artifacts.stems` entries (`trackId`, `wav`) and `manifest.stems`.
The manifest records track identity/index, source MIDI hash and note count, WAV path,
hash, size, duration and format, and renderer provenance. Stem paths in the manifest
are relative to the manifest directory; all stems share its top-level SoundFont identity.

Filenames use validated unique track IDs directly, with a leading underscore for
reserved device names such as `con`. Invalid or duplicate IDs fail validation rather
than being sanitized into collisions. The `<name>.stems/` directory is engine-owned.
A failed render removes master, MIDI, manifest, stems and intermediate files. A later
master-only render or MIDI command also removes old stems. Cleanup refuses directory
or symlink collisions, reports `OUTPUT_WRITE_FAILED`, and never recursively deletes
unrelated directories. The manifest is written last, only after every output succeeds.
As in V0, this is cleanup on command completion, not a crash-atomic multi-file commit.

V0.1's GM stem behavior remains unchanged in V0.2.
