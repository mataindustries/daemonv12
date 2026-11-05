#!/usr/bin/env bash
# Build one HEADLINER 001 target into <dir>, validate it, render WAV+MP3+stems, print a compact report.
#   headliner-001/scripts/render-target.sh <target> <dir>
set -euo pipefail
target="$1"; dir="$2"
root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"
node headliner-001/tools/build.ts "$target" "$dir"
node bin/daemonv12.js validate "$dir/$target.json" --json > "$dir/validate.json" || { cat "$dir/validate.json"; exit 1; }
node bin/daemonv12.js render "$dir/$target.json" --out-dir "$dir/out" --stems --format wav,mp3 --json > "$dir/render.json" || { head -c 3000 "$dir/render.json"; exit 1; }
python3 - "$dir/render.json" <<'PY'
import json, sys
r = json.load(open(sys.argv[1])); a = r['analysis']; m = a['master']; man = r['manifest']
print('ok', r['ok'], 'warnings', [w['code'] for w in r['warnings']])
print('master: %.2fs  LUFS %s  LRA %s  TP %s  peak %.2f' % (m['durationSeconds'], m['integratedLufs'], m['loudnessRangeLu'], m['truePeakDbfs'], m['peakDbfs']))
clip = [t['trackId'] for t in man['production']['tracks'] if t['clippedSamples']]
print('clipped tracks:', clip or 'none', '| master clipped', man['production']['master']['clippedSamples'])
print('  '.join('%s %s' % (t['trackId'], t['analysis']['integratedLufs']) for t in a['tracks']))
PY
