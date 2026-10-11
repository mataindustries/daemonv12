"""Package the final source and rendered artifacts, excluding previous renders."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT=Path(__file__).resolve().parent
bundle=ROOT/'output/soft-teeth-submission.zip'
rootfiles=sorted(p for p in ROOT.iterdir() if p.is_file() and p.name not in ['bundle.json','FILES.txt'])
assets=sorted(p for p in (ROOT/'assets').rglob('*') if p.is_file())
final=sorted(p for p in (ROOT/'output/soft-teeth').rglob('*') if p.is_file() and p.suffix in ['.wav','.mp3','.mid','.json','.png'])
entries=rootfiles+assets+final
with zipfile.ZipFile(bundle,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in entries:z.write(p,str(p.relative_to(ROOT)))
with zipfile.ZipFile(bundle) as z:
    assert z.testzip() is None
    assert z.read('project.json')==(ROOT/'project.json').read_bytes()
    assert hashlib.sha256(z.read('output/soft-teeth/project.wav')).hexdigest()==json.loads((ROOT/'metrics.json').read_text())['deterministic_render_sha256']
(ROOT/'bundle.json').write_text(json.dumps({'file':str(bundle.relative_to(ROOT)),
    'bytes':bundle.stat().st_size,'sha256':hashlib.sha256(bundle.read_bytes()).hexdigest(),
    'entries':len(entries),'excluded':'Earlier/verification renders and the bundle inventory itself.'},indent=2)+'\n')
files=sorted(p for p in ROOT.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.name!='FILES.txt')
(ROOT/'FILES.txt').write_text('\n'.join(f'{p.stat().st_size:>10}  {p.relative_to(ROOT)}' for p in files)+'\n')
print(json.dumps({'bundle':str(bundle),'bytes':bundle.stat().st_size,'entries':len(entries)}))
