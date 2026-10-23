#!/usr/bin/env python3
"""Package the measured review proof, source and reusable photographic plates."""
from pathlib import Path
import hashlib,json,zipfile
P=Path(__file__).resolve().parent
O=P/'products'
FILES=['.gitignore','README.md','REVIEW.md','VERIFICATION.md','scene.py','render.py','prepare.py','verify.py','package.py','build.sh','mapping.json','requirements.txt','audio/circuit-reference.wav','work/board.png','work/core.png','work/foreground.png','work/scene.json','work/circuit.blend']
FILES += ['products/'+x for x in ['the-circuit.mp4','circuit-motion-proof.mp4','proof-contact-sheet.jpg','review-frames.jpg','animation-audit.json','proof-audit.json','verification.json','verification.md']]
FILES += [str(p.relative_to(P)) for p in sorted(O.glob('frame-*.png'))]
for name in FILES:
 if not (P/name).is_file():raise SystemExit(f'Missing deliverable {name}')
manifest={name:hashlib.sha256((P/name).read_bytes()).hexdigest() for name in FILES}
(O/'MANIFEST.json').write_text(json.dumps({'title':'MORPH//COMMERCIAL 01 — THE CIRCUIT','filesSha256':manifest},indent=2)+'\n')
with zipfile.ZipFile(O/'circuit-review-package.zip','w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for name in FILES+['products/MANIFEST.json']:z.write(P/name,'morph-commercial-01/'+name)
print(O/'circuit-review-package.zip')
