#!/usr/bin/env bash
# THE CIRCUIT V2 — build the low-resolution motion proof (no full-resolution master).
#   experiments/morph-commercial-02/build.sh [--reuse-scene] [--width 432] [--samples 12]
# Blender: set BLENDER_PY to a Python with the bpy 4.3.0 module, or BLENDER to a Blender 4.3 binary.
set -euo pipefail
cd "$(dirname "$0")"
reuse=0; width=432; samples=12
while [[ $# -gt 0 ]]; do
 case "$1" in
  --reuse-scene) reuse=1; shift ;;
  --width) width="$2"; shift 2 ;;
  --samples) samples="$2"; shift 2 ;;
  *) echo "Usage: $0 [--reuse-scene] [--width N] [--samples N]" >&2; exit 2 ;;
 esac
done
run_blender() {
 local script="$1"; shift
 if [[ -n "${BLENDER_PY:-}" ]]; then "$BLENDER_PY" "$script" "$@"
 else "${BLENDER:-blender}" -b --python "$script" -- "$@"; fi
}
mkdir -p work delivery
if [[ "$reuse" == 0 || ! -f work/circuit-v2.blend ]]; then
 run_blender scene.py > work/scene.log 2>&1
fi
run_blender render.py --frames 0-455 --width "$width" --samples "$samples" --out work/frames > work/render.log 2>&1
python3 finish.py --frames work/frames --output delivery/the-circuit-v2-motion-proof.mp4 --stills delivery/frames
run_blender render.py --frames 0,240,450 --width "$width" --samples "$samples" --out work/recheck > work/recheck.log 2>&1
python3 verify.py --video delivery/the-circuit-v2-motion-proof.mp4 --frames work/frames --recheck work/recheck
