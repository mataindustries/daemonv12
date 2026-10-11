#!/usr/bin/env bash
# Rebuild one serious version: assets -> project -> validate -> render (+stems, MP3) -> per-bar analysis.
# Usage: tools/build.sh <version-label>   e.g. tools/build.sh v3
set -euo pipefail
VERSION="${1:?version label required}"
SUBMISSION="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENGINE="$(cd "$SUBMISSION/../../../.." && pwd)"
source "$HOME/.local/share/daemonv12/audio-tools/env.sh"
export SDL_AUDIODRIVER=dummy
python3 "$SUBMISSION/tools/make_assets.py" > /dev/null
python3 "$SUBMISSION/tools/compose.py" --version "$VERSION" > /dev/null
mkdir -p "$SUBMISSION/versions"
cp "$SUBMISSION/project.json" "$SUBMISSION/versions/$VERSION.project.json"
cd "$ENGINE"
npx --no-install daemonv12 validate "$SUBMISSION/project.json" > /dev/null
npx --no-install daemonv12 render "$SUBMISSION/project.json" --out-dir "$SUBMISSION/output/$VERSION" --stems --format wav,mp3 2>&1 | grep -iE "warning|error" || true
python3 "$SUBMISSION/tools/analyze.py" "$SUBMISSION/output/$VERSION" > "$SUBMISSION/output/$VERSION/analysis-bars.json"
python3 - "$SUBMISSION/output/$VERSION" <<'PY'
import json, sys
d = sys.argv[1]
r = json.load(open(d + '/analysis-bars.json'))
e = json.load(open(d + '/project.analysis.json'))['master']
print('engine: peak', e['peakDbfs'], 'fullScale', e['fullScaleSamples'], 'LUFS', e['integratedLufs'], 'LRA', e['loudnessRangeLu'], 'TP', e['truePeakDbfs'])
print('bar  rms    peak   low120  high4k  centroid  silent')
for m in r['master']:
    print(f"{m['bar']:>3} {m['rmsDbfs']:7.2f} {m['peakDbfs']:6.2f}  {m['lowShare120Hz']:.3f}  {m['highShare4kHz']:.3f}  {m['centroidHz']:8.0f}  {m['nearSilentFraction']:.3f}")
for k, v in r['stems'].items():
    print(f"{k:10s}", ' '.join(f"{x['rmsDbfs']:6.1f}" for x in v))
PY
