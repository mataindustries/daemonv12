import json, wave, array, math, sys, pathlib
wavp, scorep, outp = sys.argv[1], sys.argv[2], sys.argv[3]
score=json.load(open(scorep)); w=wave.open(wavp); n=w.getnframes(); sr=w.getframerate(); ch=w.getnchannels()
a=array.array('h'); a.frombytes(w.readframes(n))
secs=[]; at=0; spb=60/score['bpm']
def rms_db(seg):
    if not seg: return None
    r=math.sqrt(sum(x*x for x in seg)/len(seg))/32768
    return round(20*math.log10(r),1) if r>0 else -99.0
for s in score['sections']:
    beats=s['bars']*4; f0=int(at*spb*sr); f1=min(n,int((at+beats)*spb*sr))
    seg=a[f0*ch:f1*ch]
    # band energies via crude: low proxy not available; report rms + peak + stereo corr approx on downsampled
    peak=max((abs(x) for x in seg), default=0)/32768
    secs.append({"id":s['id'],"startSec":round(at*spb,1),"rmsDb":rms_db(seg),"peakDb":round(20*math.log10(peak),1) if peak else None})
    at+=beats
tail=a[int((n-0.5*sr))*ch:]
res={"durationSec":round(n/sr,3),"peakDb":round(20*math.log10(max(abs(x) for x in a)/32768),2),"sectionRms":secs,"final0.5sRmsDb":rms_db(tail)}
pathlib.Path(outp).write_text(json.dumps(res,indent=2)+"\n"); print(json.dumps(res,indent=2))
