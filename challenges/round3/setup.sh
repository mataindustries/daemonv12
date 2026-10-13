#!/usr/bin/env bash
# Environment preparation only: does not invoke any model or create music.
set -euo pipefail
R3_EXPECTED_COMMIT="${1:?Pass the organizer-recorded full challenge commit SHA}"
R3_REPO="$(git rev-parse --show-toplevel)"
cd "$R3_REPO"
[[ "$R3_EXPECTED_COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo 'Full commit SHA required' >&2; exit 1; }
[[ "$(git rev-parse HEAD)" == "$R3_EXPECTED_COMMIT" ]] || { echo 'Wrong challenge checkout' >&2; exit 1; }
sha256sum --check --quiet challenges/round3/FROZEN_SHA256SUMS.txt
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<22||(a===22&&b<18))process.exit(1)'
node --version
npm --version
ffmpeg -version | head -n 1
ffprobe -version | head -n 1
python3 --version
npm ci --no-audit --no-fund
# Separate cloud tasks may use identical local paths: their filesystems are isolated.
R3_RUN_ROOT=/tmp/daemonv12-round3-entry
[[ ! -e "$R3_RUN_ROOT" ]] || { echo 'Use a fresh cloud task; entry directory already exists' >&2; exit 1; }
mkdir -p "$R3_RUN_ROOT/work/assets" "$R3_RUN_ROOT/output" "$R3_RUN_ROOT/setup"
cp challenges/round3/input/round3_source_csharp3_1500ms.wav "$R3_RUN_ROOT/work/assets/"
node bin/daemonv12.js doctor --json > "$R3_RUN_ROOT/setup/doctor.json"
sha256sum --check --quiet challenges/round3/FROZEN_SHA256SUMS.txt
printf 'Prepared challenge %s; work/output are outside Git at %s\n' "$R3_EXPECTED_COMMIT" "$R3_RUN_ROOT"
