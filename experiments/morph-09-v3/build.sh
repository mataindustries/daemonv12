#!/usr/bin/env bash
# MORPH//09 V3 — rebuild the overload effects proof on top of V2's rendered frames.
#   experiments/morph-09-v3/build.sh [--resume]
# Requires V2's frames in work/morph-09-v2/frames (experiments/morph-09-v2/build.sh).
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
WORK="$ROOT/work/morph-09-v3"
PY="${BLENDER_PY:-/opt/bpyenv/bin/python}"
resume=()
[[ "${1:-}" == "--resume" ]] && resume=(--resume)
mkdir -p "$WORK"
"$PY" ../morph-09-v2/scene.py > "$WORK/scene-v2.log" 2>&1
"$PY" scene.py > "$WORK/scene.log" 2>&1
"$PY" render.py --frames 360-479 --width 288 --samples 10 --out "$WORK/preview" ${resume[@]+"${resume[@]}"} > "$WORK/preview.log" 2>&1
"$PY" render.py --frames 372-479 --width 432 --samples 16 --out "$WORK/frames" ${resume[@]+"${resume[@]}"} > "$WORK/render.log" 2>&1
"$PY" render.py --frames 0,240 --width 432 --samples 16 --out "$WORK/identity" > "$WORK/identity.log" 2>&1
"$PY" finish.py
"$PY" verify.py --out "$WORK/audit" --frames "$WORK/proof" --rendered "$WORK/frames" \
 --proof delivery/morph-09-v3-critical-overload.mov --preview delivery/morph-09-v3-critical-overload.mp4
"$PY" verify.py --out "$WORK/audit-identity" --rendered "$WORK/identity" > /dev/null
cp "$WORK/audit/v3-audit.json" delivery/
(cd delivery && find . -type f ! -name SHA256SUMS | sort | xargs sha256sum > SHA256SUMS)
