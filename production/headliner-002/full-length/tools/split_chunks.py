import json, copy, pathlib
src=json.load(open('production/headliner-002/full-length/scores/chrome-stallion-full.score.json'))
outdir=pathlib.Path('work/headliner-002-full/chunks'); outdir.mkdir(parents=True, exist_ok=True)
def interp(curve, x):
    if isinstance(curve,(int,float)): return curve
    pts=curve; v=pts[0][1]
    for i,(b,val) in enumerate(pts):
        if x>=b: v=val
        if i+1<len(pts) and pts[i][0]<=x<pts[i+1][0]:
            b0,v0=pts[i]; b1,v1=pts[i+1]; return v0+(v1-v0)*(x-b0)/(b1-b0) if b1>b0 else v1
    return v
def xcurve(curve,a,b):
    if isinstance(curve,(int,float)): return curve
    pts=[[p[0]-a,p[1]] for p in curve if a<=p[0]<b]
    return [[0,round(interp(curve,a),4)]]+pts
def xsteps(obj,a,b):
    if not obj: return obj
    o=copy.deepcopy(obj); o['steps']=[[p[0]-a,p[1]] for p in obj['steps'] if a<=p[0]<b]; return o
at=0; meta=[]
for si,sec in enumerate(src['sections']):
    beats=sec['bars']*4; a, b = at, at+beats; at=b
    s=copy.deepcopy(src); s['sections']=[sec]; s['title']=f"{src['title']} [chunk {si} {sec['id']}]"; s['tailSeconds']=src['tailSeconds'] if si==len(src['sections'])-1 else 1.0
    for p in s['parts']:
        if 'notes' in p: p['notes']=[[n[0]-a]+list(n[1:]) for n in p['notes'] if a<=n[0]<b]
        if 'repeats' in p:
            p['repeats']=[{**r,'fromBeat':max(r['fromBeat'],a)-a,'toBeat':min(r['toBeat'],b)-a} for r in p['repeats'] if r['fromBeat']<b and r['toBeat']>a]
        if 'textures' in p:
            tx=[]
            for t in p['textures']:
                if t['fromBeat']<b and t['toBeat']>a:
                    t2=copy.deepcopy(t); t2['fromBeat']=max(t['fromBeat'],a)-a; t2['toBeat']=min(t['toBeat'],b)-a
                    if isinstance(t.get('density'),list): t2['density']=xcurve(t['density'],a,b)
                    tx.append(t2)
            p['textures']=tx
        if 'motion' in p: p['motion']=[{**m,'fromBeat':max(m['fromBeat'],a)-a,'toBeat':min(m['toBeat'],b)-a} for m in p['motion'] if m['fromBeat']<b and m['toBeat']>a]
        if 'breaths' in p: p['breaths']=[{**br,'beat':br['beat']-a} for br in p['breaths'] if a<=br['beat']<b]
        if 'overtone' in p:
            ot=xsteps(p['overtone'],a,b)
            if ot and ot.get('steps'): p['overtone']=ot
            else: del p['overtone']
        for k in ('macro','expression'):
            if k in p: p[k]=xcurve(p[k],a,b)
        if 'controls' in p:
            for ck,cv in list(p['controls'].items()):
                if isinstance(cv,list): p['controls'][ck]=xcurve(cv,a,b)
    fn=outdir/f"chunk-{si:02d}-{sec['id']}.score.json"; fn.write_text(json.dumps(s,indent=2)+"\n")
    meta.append({"chunk":si,"id":sec['id'],"startBeat":a,"beats":beats,"file":str(fn)})
pathlib.Path(outdir/'chunks.json').write_text(json.dumps(meta,indent=2)+"\n"); print(json.dumps(meta,indent=1))
