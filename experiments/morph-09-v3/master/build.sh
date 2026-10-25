#!/usr/bin/env bash
# MORPH//09 V3 full-resolution production; all work stays beside the locked sources.
set -euo pipefail
cd "$(dirname "$0")"
MASTER_DIR="$PWD"
ROOT="$(cd ../../.. && pwd)"
WORK="$ROOT/work/morph-09-v3-master"
PY="${PYTHON:-python3}"
phase=render
frames=""
resume=()
extra=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --prepare) phase=prepare; shift ;;
    --render) phase=render; shift ;;
    --finalize) phase=finalize; shift ;;
    --frames) frames="$2"; shift 2 ;;
    --resume) resume=(--resume); shift ;;
    --samples) extra+=(--samples "$2"); shift 2 ;;
    --out) extra+=(--out "$2"); shift 2 ;;
    --allow-provisional) extra+=(--allow-provisional); shift ;;
    *) echo "Usage: $0 [--prepare|--render|--finalize] [--frames 0-95] [--resume] [--samples N --out DIR --allow-provisional]" >&2; exit 2 ;;
  esac
done
mkdir -p "$WORK/logs"
run_blender() {
  local script="$1"; shift
  if [[ -n "${BLENDER_PY:-}" ]]; then
    "$BLENDER_PY" "$script" "$@"
  else
    "${BLENDER:-blender}" -b --python "$script" -- "$@"
  fi
}
prepare() {
  # Validate sources before executing any approved creative module.
  "$PY" - "$ROOT" "$MASTER_DIR/source-hashes.json" <<'PY'
import hashlib, json, pathlib, sys
root, path = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
data = json.loads(path.read_text())
assert data['sourceCommit'] == '9e8a03d2b5bfed15f8056970ca3b4cdb1c2cfbc7'
for rel, expected in data['hashes'].items():
    assert hashlib.sha256((root / rel).read_bytes()).hexdigest() == expected, rel
PY
  run_blender "$ROOT/experiments/morph-09-v2/scene.py" > "$WORK/logs/scene-v2.log" 2>&1
  run_blender "$ROOT/experiments/morph-09-v3/scene.py" > "$WORK/logs/scene-v3.log" 2>&1
  # Query the runtime through Blender itself; no dependency on a system bpy module.
  cat > "$WORK/record-scene-build.py" <<'PY'
import hashlib, json
from pathlib import Path
import bpy
root = Path(__file__).resolve().parents[2]
work = root / 'work/morph-09-v3-master'
source = json.loads((root / 'experiments/morph-09-v3/master/source-hashes.json').read_text())
config = json.loads((root / 'experiments/morph-09-v3/master/config.json').read_text())
assert bpy.app.version_string == config['blenderVersion'], 'matching Blender version required'
bpy.context.scene.cycles.denoiser = 'OPENIMAGEDENOISE'
assert bpy.context.scene.cycles.denoiser == 'OPENIMAGEDENOISE', 'Cycles OpenImageDenoise support required'
files = ['work/morph-09-v2/resonator.blend', 'work/morph-09-v2/resonator.json',
         'work/morph-09-v3/resonator-v3.blend', 'work/morph-09-v3/resonator.json']
manifest = {'sourceCommit': source['sourceCommit'],
            'sourceDigest': hashlib.sha256(json.dumps(source, sort_keys=True, separators=(',', ':')).encode()).hexdigest(),
            'blenderVersion': bpy.app.version_string,
            'files': {rel: hashlib.sha256((root / rel).read_bytes()).hexdigest() for rel in files}}
(work / 'scene-build.json').write_text(json.dumps(manifest, sort_keys=True, indent=2) + '\n')
print(json.dumps(manifest, indent=2))
PY
  run_blender "$WORK/record-scene-build.py" > "$WORK/logs/scene-manifest.log" 2>&1
  echo "Built locked V2 and V3 scenes; recorded $WORK/scene-build.json"
}
case "$phase" in
  prepare) prepare ;;
  render)
    [[ -f "$WORK/scene-build.json" ]] || prepare
    if [[ -n "$frames" ]]; then
      run_blender "$MASTER_DIR/render.py" --frames "$frames" "${resume[@]}" "${extra[@]}" > "$WORK/logs/render-selected.log" 2>&1
    else
      batch_size="$("$PY" -c 'import json; print(json.load(open("config.json"))["batchSize"])')"
      first=0
      while [[ $first -lt 480 ]]; do
        last=$((first + batch_size - 1))
        [[ $last -lt 480 ]] || last=479
        label="$(printf '%04d-%04d' "$first" "$last")"
        echo "Rendering pictures $label"
        run_blender "$MASTER_DIR/render.py" --frames "$first-$last" --batch-id "$label" "${resume[@]}" "${extra[@]}" > "$WORK/logs/render-$label.log" 2>&1
        first=$((last + 1))
      done
    fi
    ;;
  finalize)
    # The strict verifier also requires these controls; a successful encode alone is insufficient.
    controls="$("$PY" - "$WORK/frames" <<'PY'
import json, pathlib, sys
folder = pathlib.Path(sys.argv[1])
rows = [json.loads((folder / f'{f:04d}.json').read_text()) for f in range(480)]
controls = {0, 24, 242, 389, 396, 418, 450, 479}
for a, b in zip(rows, rows[1:]):
    if a['batchId'] != b['batchId']:
        controls.update((a['frame'], b['frame']))
print(','.join(map(str, sorted(controls))))
PY
)"
    run_blender "$MASTER_DIR/render.py" --frames "$controls" --out "$WORK/rerenders" --resume > "$WORK/logs/rerenders.log" 2>&1
    run_blender "$MASTER_DIR/render.py" --frames 0,240,372,390,405,472,479 --backend v3 --out "$WORK/quiet-v3" --resume > "$WORK/logs/quiet-v3.log" 2>&1
    "$PY" "$MASTER_DIR/finish.py" --frames "$WORK/frames" --graded "$WORK/graded" --out "$MASTER_DIR/delivery"
    "$PY" "$MASTER_DIR/verify.py" --frames "$WORK/frames" --graded "$WORK/graded" --delivery "$MASTER_DIR/delivery" --rerenders "$WORK/rerenders" --quiet-v3 "$WORK/quiet-v3" --manifest "$WORK/render-manifest.json"
    ;;
esac
