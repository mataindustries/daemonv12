import json, numpy as np, wave, struct, hashlib, pathlib
def read24(p):
    w=wave.open(p); n=w.getnframes(); raw=w.readframes(n); sr=w.getframerate(); w.close()
    b=np.frombuffer(raw,dtype=np.uint8).reshape(-1,3)
    v=b[:,0].astype(np.int32)|(b[:,1].astype(np.int32)<<8)|(b[:,2].astype(np.int32)<<16)
    v=np.where(v>=1<<23, v-(1<<24), v).astype(np.float64)/(1<<23)
    return v.reshape(-1,2), sr, n
master='production/headliner-002/full-length/masters/chrome-stallion.24.wav'
x,sr,n=read24(master); score=json.load(open('production/headliner-002/full-length/scores/chrome-stallion-full.score.json'))
spb=60/score['bpm']; secs=[]; at=0
for s in score['sections']:
    beats=s['bars']*4; f0=int(round(at*spb*sr)); f1=min(n,int(round((at+beats)*spb*sr))); seg=x[f0:f1]; at+=beats
    rms=20*np.log10(np.sqrt(np.mean(seg**2))+1e-20); peak=20*np.log10(np.max(np.abs(seg))+1e-20)
    # spectral bands on mono downmix, Hann FFT in 8192 hops averaged crudely via one FFT per 2 sec block
    mono=seg.mean(axis=1); specs=[]
    for i in range(0, max(1,len(mono)-8192), 44100):
        blk=mono[i:i+8192]*np.hanning(min(8192,len(mono[i:i+8192])))
        if len(blk)<8192: continue
        F=np.abs(np.fft.rfft(blk))**2; specs.append(F)
    if specs:
        F=np.mean(specs,axis=0); freqs=np.fft.rfftfreq(8192,1/sr); tot=F[1:].sum()
        low=F[(freqs>=20)&(freqs<150)].sum()/tot*100; high=F[freqs>2000].sum()/tot*100
    else: low=high=None
    secs.append({"id":s['id'],"startSec":round((at-beats)*spb,1),"rmsDb":round(float(rms),1),"peakDb":round(float(peak),2),"lowBandPct":round(float(low),1) if low is not None else None,"highBandPct":round(float(high),1) if high is not None else None})
mono=x.mean(axis=1); corr=float(np.corrcoef(x[:,0],x[:,1])[0,1])
res={"master":{"frames":int(n),"durationSec":round(n/sr,3),"sampleRate":sr,"bits":24,"peakDbfs":round(float(20*np.log10(np.max(np.abs(x)))),2),
 "stereoCorrelation":round(corr,3),"monoFoldChangeDb":round(float(20*np.log10(np.sqrt(np.mean(mono**2))/np.sqrt(np.mean(x**2)))),2),
 "final0.5sRmsDb":round(float(20*np.log10(np.sqrt(np.mean(x[int(n-0.5*sr):]**2))+1e-20)),1),
 "sha256":hashlib.sha256(pathlib.Path(master).read_bytes()).hexdigest()},"sections":secs,"stems":{}}
for f in sorted(pathlib.Path('production/headliner-002/full-length/delivery/stems').glob('*.wav')):
    y,_,ny=read24(str(f)); res['stems'][f.name]={"frames":int(ny),"rmsDb":round(float(20*np.log10(np.sqrt(np.mean(y**2))+1e-20)),1),"peakDb":round(float(20*np.log10(np.max(np.abs(y))+1e-20)),2)}
pathlib.Path('production/headliner-002/full-length/VALIDATION.json').write_text(json.dumps({"schema":"headliner-002.full-validation/1","note":"Signal measurements only; producer cannot hear audio. Final master assembled from 9 section-wise native bounces rendered through the Float64/PCM24 route (scripts/headliner-production24.ts), each trimmed to its exact section duration and concatenated sample-accurately; stems silence-padded where a part is absent in a section. Chunk-00 PCM24 package replay reproduced its master byte-identically.","masterLoudnormFfmpeg":{"integratedLufs":-18.21,"truePeakDb":-0.33,"lraLu":7.4},"mp3LoudnormFfmpeg":{"integratedLufs":-18.48,"truePeakDb":-0.67},"result":res},indent=2)+"\n")
print(json.dumps(res,indent=1))
