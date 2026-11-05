#!/usr/bin/env bash
# Verify the SODIUM HOURS delivery from committed files only:
#   1. restore the 163 assets from FLAC and check them against the catalog SHA-256
#   2. check every delivered file against delivery/SHA256SUMS
#   3. restore the 15 stems and the alternate from FLAC and check the engine WAV hashes
#   4. render the project into a temporary directory and compare the master and stems with the delivered hashes
# Needs Node 22.18+ and FFmpeg (the engine's own requirements). Run from anywhere: headliner-001/scripts/verify-delivery.sh
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$root"
h=headliner-001; d=$h/delivery; tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
echo "1/4 assets"; node $h/tools/flac.ts restore $h/project/assets $h/project/assets $h/project/sodium-hours.catalog.json
echo "2/4 delivered files"; (cd $d && grep -v '^#' SHA256SUMS | grep -v ' stems/.*\.wav$' | grep -v ' alternate/.*\.wav$' | sha256sum -c --quiet && echo "delivered files OK")
echo "3/4 stems and alternate from FLAC"
grep ' stems/.*\.wav$' $d/SHA256SUMS > "$tmp/stems.sha"; grep ' alternate/.*\.wav$' $d/SHA256SUMS > "$tmp/alt.sha"
node $h/tools/flac.ts restore $d/stems "$tmp/stems" "$tmp/stems.sha"
mkdir -p "$tmp/alt-flac" && cp $d/alternate/sodium-hours-bed.flac "$tmp/alt-flac/" && node $h/tools/flac.ts restore "$tmp/alt-flac" "$tmp/alternate" "$tmp/alt.sha"
echo "4/4 render"
node bin/daemonv12.js render $h/project/sodium-hours.json --out-dir "$tmp/render" --stems --format wav --json > "$tmp/render.json"
want=$(grep ' sodium-hours.wav$' $d/SHA256SUMS | cut -c1-64); got=$(sha256sum "$tmp/render/sodium-hours.wav" | cut -c1-64)
[ "$want" = "$got" ] && echo "master OK $got" || { echo "MASTER MISMATCH want $want got $got"; exit 1; }
(cd "$tmp/render/sodium-hours.stems" && sed 's# stems/# #' "$tmp/stems.sha" | sha256sum -c --quiet && echo "rendered stems OK")
echo "verified"
