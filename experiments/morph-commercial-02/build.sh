#!/usr/bin/env bash
# THE CIRCUIT V2 — build the final master, or reproduce the approved motion proof.
#   experiments/morph-commercial-02/build.sh                    # master: 1080 x 1920, 16 samples, no typography
#   experiments/morph-commercial-02/build.sh --approved-proof   # the approved 432 x 768 proof, into work/approved-proof
#   options: --reuse-scene, --resume (keep frames already rendered)
# Blender: set BLENDER_PY to a Python with the bpy 4.3.0 module, or BLENDER to a Blender 4.3 binary.
set -euo pipefail
cd "$(dirname "$0")"
reuse=0; resume=(); proof=0
for arg in "$@"; do
 case "$arg" in
  --reuse-scene) reuse=1 ;;
  --resume) resume=(--resume) ;;
  --approved-proof) proof=1 ;;
  *) echo "Usage: $0 [--reuse-scene] [--resume] [--approved-proof]" >&2; exit 2 ;;
 esac
done
run_blender() {
 local script="$1"; shift
 if [[ -n "${BLENDER_PY:-}" ]]; then "$BLENDER_PY" "$script" "$@"
 else "${BLENDER:-blender}" -b --python "$script" -- "$@"; fi
}
mkdir -p work
if [[ "$reuse" == 0 || ! -f work/circuit-v2.blend ]]; then
 run_blender scene.py > work/scene.log 2>&1
fi
if [[ "$proof" == 1 ]]; then
 run_blender render.py --variant proof --width 432 --samples 12 --out work/approved-proof/frames ${resume[@]+"${resume[@]}"} > work/approved-proof.log 2>&1
 python3 finish.py --kind proof --lockup --frames work/approved-proof/frames \
  --output work/approved-proof/the-circuit-v2-motion-proof.mp4
 sha256sum work/approved-proof/the-circuit-v2-motion-proof.mp4 delivery/the-circuit-v2-motion-proof.mp4
 exit 0
fi
run_blender render.py --variant master --width 1080 --samples 16 --out work/master ${resume[@]+"${resume[@]}"} > work/master.log 2>&1
python3 finish.py --kind master --frames work/master --output master/the-circuit-v2-master.mp4
run_blender render.py --variant master --frames 0,240,444,453 --width 1080 --samples 16 --out work/master-recheck > work/master-recheck.log 2>&1
python3 verify.py --kind master --frames work/master --recheck work/master-recheck
