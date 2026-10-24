#!/usr/bin/env bash
# MORPH//09 V2 — rebuild the low-resolution motion proof, stills and audit.
#   experiments/morph-09-v2/build.sh            # scene, 480 frames, stills, finish, verify
#   options: --resume (keep frames already rendered), --skip-stills
# Blender: set BLENDER_PY to a Python with the bpy 4.3.0 module (default /opt/bpyenv/bin/python),
# or BLENDER to a Blender 4.3 binary. Needs FFmpeg (libx264, AAC), NumPy, Pillow, Matplotlib.
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
WORK="$ROOT/work/morph-09-v2"
resume=(); stills=1
for arg in "$@"; do
 case "$arg" in
  --resume) resume=(--resume) ;;
  --skip-stills) stills=0 ;;
  *) echo "Usage: $0 [--resume] [--skip-stills]" >&2; exit 2 ;;
 esac
done
run_blender() {
 local script="$1"; shift
 if [[ -n "${BLENDER:-}" ]]; then "$BLENDER" -b --python "$script" -- "$@"
 else "${BLENDER_PY:-/opt/bpyenv/bin/python}" "$script" "$@"; fi
}
PY="${BLENDER_PY:-/opt/bpyenv/bin/python}"
mkdir -p "$WORK"
run_blender scene.py > "$WORK/scene.log" 2>&1
run_blender render.py --frames 0-479 --width 432 --samples 16 --out "$WORK/frames" ${resume[@]+"${resume[@]}"} > "$WORK/render.log" 2>&1
if [[ "$stills" == 1 ]]; then
 run_blender render.py --frames 24,242,396,423 --width 864 --samples 128 --out "$WORK/stills" > "$WORK/stills.log" 2>&1
fi
"$PY" finish.py --frames "$WORK/frames" --stills "$WORK/stills" --out delivery
"$PY" verify.py --out "$WORK/audit" --frames "$WORK/frames" \
 --proof delivery/morph-09-v2-inside-the-resonator.mov --preview delivery/morph-09-v2-inside-the-resonator.mp4
cp "$WORK/audit/v2-audit.json" "$WORK/audit/v2-sync-audit.csv" "$WORK/audit/camera-choreography.png" delivery/
"$PY" analyze.py --v2 delivery/morph-09-v2-inside-the-resonator.mp4 --out delivery/motion-analysis.json > /dev/null
(cd delivery && find . -type f ! -name SHA256SUMS | sort | xargs sha256sum > SHA256SUMS)
