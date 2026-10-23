#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
reuse=0
proof_only=0
for arg in "$@"; do
 case "$arg" in
  --reuse-plates) reuse=1 ;;
  --proof-only) proof_only=1 ;;
  *) echo "Usage: $0 [--reuse-plates] [--proof-only]" >&2; exit 2 ;;
 esac
done
mkdir -p work products
if [[ -f ../morph-06/audio/b/cable-beast-b.wav ]]; then
 python3 prepare.py
else
 python3 - <<'PY'
from pathlib import Path
import hashlib,json
m=json.loads(Path('mapping.json').read_text())
assert hashlib.sha256(Path('audio/circuit-reference.wav').read_bytes()).hexdigest()==m['audio']['sha256']
print('Portable package: using verified exact PCM reference and included event map.')
PY
fi
if [[ "$reuse" == 0 ]]; then
 blender -b -t 3 --python scene.py -- --width 1404 --samples 48 > work/scene.log 2>&1
fi
python3 render.py --proof
if [[ "$proof_only" == 1 ]]; then
 exit 0
fi
python3 render.py
if [[ -f ../morph-06/audio/b/cable-beast-b.wav ]]; then
 python3 verify.py --video products/the-circuit.mp4 --output products
fi
