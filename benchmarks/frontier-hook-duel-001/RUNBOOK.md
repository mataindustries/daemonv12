# Frontier Hook Duel 001 — operator

Read [SHARED_BRIEF.md](SHARED_BRIEF.md). This independent pilot deliberately uses 15 seconds, 128 BPM / 8 bars instead of Banger Lab 001's 75-second lead-composer assignment.

**Start from a clean clone of this branch.** Never run Muse on the first entrant's workspace: both projects use the same `examples/frontier-hook-v*.json` paths.

In Codespaces:

```bash
cd /workspaces/daemonv12
git fetch origin experiment/frontier-hook-duel-001
git switch --track origin/experiment/frontier-hook-duel-001
npm ci
node bin/daemonv12.js doctor
```

Then launch the chosen agent and provide the same text in `SHARED_BRIEF.md`. Operator prefix may identify the assigned model and output environment, but may not add creative instructions or reference other contestants. Confirm selected model availability and identity before starting; do not silently use a substitute.

Music-only source palette is the two CC0 sample packs in `examples/assets`. Keep original WAVs immutable. Archive audio and JSON before running another contestant in a new isolated checkout. Do not commit generated WAV or MP3 files into this branch accidentally.
