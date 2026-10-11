"""Time the unmodified CLI; save full results and expose a compact report."""
from pathlib import Path
import json
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parent
project=ROOT/sys.argv[1]
out=ROOT/'output'/sys.argv[2]
out.mkdir(parents=True,exist_ok=True)
start=time.perf_counter()
r=subprocess.run(['bash',str(ROOT/'render.sh'),str(project),'--out-dir',str(out),'--stems','--format','wav,mp3','--json'],capture_output=True,text=True)
elapsed=time.perf_counter()-start
(out/'cli-result.json').write_text(r.stdout)
(out/'stderr.log').write_text(r.stderr)
(out/'render-time.json').write_text(json.dumps({'elapsed_seconds':elapsed,'returncode':r.returncode},indent=2)+'\n')
try:
    result=json.loads(r.stdout)
    print(json.dumps({k:result.get(k) for k in ['ok','errors','warnings','summary','artifacts','analysis']},indent=2))
except json.JSONDecodeError:
    print(r.stdout,r.stderr)
print(f'Render elapsed: {elapsed:.3f} s')
sys.exit(r.returncode)
