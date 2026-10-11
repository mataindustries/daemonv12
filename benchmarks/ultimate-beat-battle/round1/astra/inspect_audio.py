"""Read-only listening evidence for a DaemonV12 master and aligned stems."""
from pathlib import Path
from fractions import Fraction
import json
import sys
import wave
import os
os.environ.setdefault('MPLCONFIGDIR','/tmp/astra-matplotlib')
os.environ.setdefault('XDG_CACHE_HOME','/tmp/astra-cache')
import numpy as np
from scipy.signal import welch, spectrogram
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT=Path(__file__).resolve().parent
project=ROOT/sys.argv[1]
folder=ROOT/'output'/sys.argv[2]
p=json.loads(project.read_text())
stem=project.stem
wav=folder/(stem+'.wav')

def read(path):
    with wave.open(str(path),'rb') as w:
        sr=w.getframerate()
        x=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(float).reshape(-1,w.getnchannels())/32768
    return sr,x

def db(a):return float(20*np.log10(max(float(a),1e-12)))
def rms(a):return np.sqrt(np.mean(a*a)) if len(a) else 0
def beat_at(s):
    main,*frac=s.split('+')
    b,q=map(int,main.split(':'))
    return (b-1)*4+(q-1)+(4*float(Fraction(frac[0])) if frac else 0)

sr,x=read(wav)
mono=np.mean(x,axis=1)
beat=round(60_000_000/p['bpm'])/1_000_000
barsec=beat*4
f,psd=welch(mono,sr,nperseg=16384)
bands={}
for lo,hi in [(0,30),(30,45),(45,120),(120,300),(300,2000),(2000,6000),(6000,20000)]:
    bands[f'{lo}-{hi}Hz']=float(np.sum(psd[(f>=lo)&(f<hi)])/np.sum(psd))
bars=[]
for b in range(p['bars']):
    z=x[round(b*barsec*sr):round((b+1)*barsec*sr)]
    bars.append({'bar':b+1,'start_seconds':b*barsec,'rms_dbfs':db(rms(z)),
                 'peak_dbfs':db(np.max(np.abs(z)))})
stem_rows=[]
for path in sorted((folder/(stem+'.stems')).glob('*.wav')):
    _,z=read(path)
    stem_rows.append({'file':path.name,'rms_dbfs':db(rms(z)),'peak_dbfs':db(np.max(np.abs(z))),
        'bar_rms_dbfs':[db(rms(z[round(b*barsec*sr):round((b+1)*barsec*sr)])) for b in range(p['bars'])]})
events=[]
for ti,tr in enumerate(p['tracks']):
    patterns={q['id']:q for q in tr['patterns']}
    for clip in tr['clips']:
        for n in patterns[clip['pattern']]['notes']:
            events.append({'track':tr['id'],'row':ti,'seconds':((clip['bar']-1)*4+beat_at(n['start']))*beat,
                'velocity':n.get('velocity',.8),'pitches':n.get('pitch'),
                'playback_rate':n.get('playbackRate',1),'glide':n.get('glide')})
block=round(.01*sr)
short=np.array([rms(x[i:i+block]) for i in range(0,len(x),block)])
ev={'duration_seconds':len(x)/sr,'stereo_correlation':float(np.corrcoef(x.T)[0,1]),
    'mid_rms_dbfs':db(rms(mono)),'side_rms_dbfs':db(rms((x[:,0]-x[:,1])/2)),
    'crest_db':db(np.max(np.abs(x)))-db(rms(x)),'mean_dc':x.mean(axis=0).tolist(),
    'spectral_energy_fraction':bands,'bars':bars,'stems':stem_rows,
    'ten_ms_windows_below_minus_55_dbfs':int(np.sum(short<10**(-55/20))),
    'last_100ms_peak_dbfs':db(np.max(np.abs(x[-round(.1*sr):]))),
    'last_frame':x[-1].tolist(),'events':events}
(folder/'evidence.json').write_text(json.dumps(ev,indent=2)+'\n')

fig,axes=plt.subplots(4,1,figsize=(15,12),gridspec_kw={'height_ratios':[1.15,1.5,1.5,1.1]})
fig.suptitle(p['title']+' — rendered evidence',fontsize=16,fontweight='bold')
step=128
t=np.arange(0,len(x),step)/sr
hi=np.array([np.max(x[i:i+step]) for i in range(0,len(x),step)])
lo=np.array([np.min(x[i:i+step]) for i in range(0,len(x),step)])
axes[0].fill_between(t,lo,hi,color='#286f8e',alpha=.85)
axes[0].set_ylabel('Master amplitude')
axes[0].set_ylim(-1,1)
f,ts,s=spectrogram(mono,sr,nperseg=2048,noverlap=1536)
axes[1].pcolormesh(ts,f,10*np.log10(s+1e-14),shading='auto',vmin=-100,vmax=-35,cmap='magma')
axes[1].set_yscale('log');axes[1].set_ylim(25,18000);axes[1].set_ylabel('Frequency / Hz')
for e in events:
    axes[2].scatter(e['seconds'],e['row'],s=12+45*e['velocity'],color='#186f6d',alpha=.7)
axes[2].set_yticks(range(len(p['tracks'])),[tr['id'] for tr in p['tracks']]);axes[2].invert_yaxis()
for row in stem_rows:
    axes[3].plot([(b+.5)*barsec for b in range(p['bars'])],row['bar_rms_dbfs'],label=row['file'].removesuffix('.wav'))
axes[3].plot([(b+.5)*barsec for b in range(p['bars'])],[b['rms_dbfs'] for b in bars],color='black',linewidth=2.5,label='master')
axes[3].set_ylim(-52,-8);axes[3].set_ylabel('Bar RMS / dBFS');axes[3].set_xlabel('Time / seconds')
axes[3].legend(loc='upper left',bbox_to_anchor=(1.01,1),fontsize=8)
for ax in axes:
    ax.set_xlim(0,len(x)/sr)
    for b in range(p['bars']+1):ax.axvline(b*barsec,color='grey',linewidth=.4,alpha=.3)
fig.tight_layout(rect=(0,0,.94,.97))
fig.savefig(folder/'evidence.png',dpi=150)
plt.close(fig)
print(json.dumps({k:v for k,v in ev.items() if k not in ['events','stems']},indent=2))
print(json.dumps({'stem_levels':[{k:v for k,v in r.items() if k!='bar_rms_dbfs'} for r in stem_rows]},indent=2))
