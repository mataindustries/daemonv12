#!/usr/bin/env python3
"""Three distinct reproducible 8-bar interpretations of original payoff bars 17–24.

Run generate_original_assets.py first, then this file. Synthesized audio only.
"""
import copy, json, math, re, shutil, wave
from pathlib import Path
import numpy as np
from scipy import signal

ROOT=Path(__file__).resolve().parent
SR=44100
P=json.loads((ROOT/'original-v3.json').read_text())

def save(path,x,peak=.75):
    x=np.asarray(x,dtype=np.float64); n=len(x); a=min(n,int(.001*SR)); z=min(n,int(.035*SR))
    x[:a]*=np.linspace(0,1,a); x[-z:]*=np.linspace(1,0,z)
    x=np.nan_to_num(x); x=x/(np.max(np.abs(x))+1e-12)*peak
    data=np.round(np.clip(x,-.999,.999)*32767).astype('<i2')
    with wave.open(str(path),'wb') as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR); f.writeframes(data.tobytes())

def band(x,mode,hz):
    return signal.sosfilt(signal.butter(3,hz,btype=mode,fs=SR,output='sos'),x)

def synth_assets(name):
    d=ROOT/name/'assets'; d.mkdir(parents=True,exist_ok=True)
    for p in (ROOT/'assets').iterdir(): shutil.copy(p,d/p.name)
    rng=np.random.default_rng({'a':950,'b':951,'c':952}[name])
    t=np.arange(int(.46*SR))/SR
    # Differing weights, envelopes and transient structures, all synthesized.
    pitch={'a':(50,130,.031),'b':(51,145,.025),'c':(45,150,.042)}[name]
    hz,drop,tau=pitch; phase=2*np.pi*(hz*t+drop*tau*(1-np.exp(-t/tau)))
    body=np.sin(phase)*np.exp(-t*({'a':10.8,'b':14,'c':8.8}[name]))
    harmonics=.20*np.sin(2*phase)*np.exp(-t*24)
    click=band(rng.normal(size=len(t)),'highpass',1800)*np.exp(-t*160)*{'a':.19,'b':.25,'c':.15}[name]
    save(d/'kick.wav',np.tanh(1.4*(body+harmonics))+click,.82)
    t=np.arange(int(.34*SR))/SR; noise=band(rng.normal(size=len(t)),'highpass',750)
    env=sum(a*np.exp(-np.maximum(t-delay,0)/.012)*(t>=delay) for delay,a in [(0,.8),(.013,.6),(.031,.5),(.052,.35)])
    tonal=np.sin(2*np.pi*(185*t+45*.025*(1-np.exp(-t/.025))))*np.exp(-t*17)
    save(d/'clap.wav',noise*(.48*env+.12*np.exp(-t*17))+tonal*{'a':.65,'b':.48,'c':.78}[name],.77)
    t=np.arange(int(1.05*SR))/SR; f0=87.30705786; voice=np.zeros_like(t)
    if name=='a': f1=450+270*np.sin(2*np.pi*1.4*t+.5); f2=1250+250*np.cos(2*np.pi*.9*t)
    elif name=='b': f1=430+310*np.sin(2*np.pi*3.2*t+.15); f2=1020+530*np.sin(2*np.pi*2*t+1.1)
    else: f1=390+190*np.sin(2*np.pi*.8*t); f2=1100+280*np.cos(2*np.pi*.5*t)
    for k in range(1,37):
        freq=f0*k; amp=(.3+1.9*np.exp(-.5*((freq-f1)/150)**2)+1.1*np.exp(-.5*((freq-f2)/230)**2))/k**.78
        voice+=amp*np.sin(2*np.pi*freq*t+k*.13)
    voice=band(np.tanh(voice*{'a':2.5,'b':3.2,'c':2.0}[name]),'highpass',110)
    voice*=np.minimum(1,t/.006)*np.exp(-t*1.0)
    save(d/'talk-f2.wav',voice,.76)
    t=np.arange(int(.85*SR))/SR; f0=698.4564629
    freq=f0*(1-.024*np.exp(-t/.035)+.004*np.sin(2*np.pi*5.3*t)*np.minimum(1,t/.13)); ph=2*np.pi*np.cumsum(freq)/SR
    wh=(np.sin(ph)+.35*np.sin(2*ph+.2)+.17*np.sin(3*ph)+.08*np.sin(4*ph))
    wh*=np.minimum(1,t/.009)*np.exp(-t*1.15)
    save(d/'whistle-f5.wav',wh,.73)

def note(bar, beat, frac, vel, semi=0, gate='1/16'):
    s=f'{bar}:{beat}'+(f'+{frac}' if frac else '')
    n={'start':s,'velocity':vel,'gate':gate,'envelope':{'attackSeconds':.002,'releaseSeconds':.025},'chokeGroup':'talk'}
    if semi: n['playbackRate']=round(2**(semi/12),6)
    return n

def make(name):
    synth_assets(name)
    p=copy.deepcopy(P); p['title']={'a':'A — WEST COAST HEAVYWEIGHT','b':'B — CYBERNETIC FUNK','c':'C — FUTURISTIC CINEMATIC BASS'}[name]
    p['bars']=8; p['render']['duration']={'seconds':14.25}; p['master']['gainDb']=-5
    t={x['id']:x for x in p['tracks']}
    for tr in t.values():
        tr['patterns'][0]['bars']=8; selected=[]
        for n in tr['patterns'][0]['notes']:
            m=re.match(r'^(\d+)(:.*)$',n['start']); bar=int(m.group(1))
            if 17<=bar<=24:
                n['start']=str(bar-16)+m.group(2); selected.append(n)
        tr['patterns'][0]['notes']=selected
    # All 3 retain exact original lead contour and characteristic displaced kicks.
    if name=='a':
        for id,g in {'kick':-3.7,'clap':-5.5,'sub':-7.7,'talk':-5.6,'hats':-8.5,'haze':-18}.items(): t[id]['mix']['gainDb']=g
        # Leave the heavy pocket breathable: fewer top-end chatter notes, close answer.
        t['hats']['patterns'][0]['notes']=[n for i,n in enumerate(t['hats']['patterns'][0]['notes']) if i%5!=3]
        t['orbit']['mix']['gainDb']=-14
        t['talk']['patterns'][0]['notes'] += [note(4,4,'1/16',.56,-2),note(8,4,'1/16',.61,0)]
    elif name=='b':
        for id,g in {'kick':-4.6,'clap':-6.3,'sub':-9,'talk':-4.9,'rim':-7.5,'hats':-8.4,'lead':-10.7,'answer':-9.5}.items(): t[id]['mix']['gainDb']=g
        # Speech punctuation in the gaps. An intentional 3+3+2 answer to the whistle.
        for bar in (2,4,6,8):
            t['talk']['patterns'][0]['notes']=[n for n in t['talk']['patterns'][0]['notes'] if n['start'] != f'{bar}:1+3/16']
            t['talk']['patterns'][0]['notes'] += [note(bar,1,'3/16',.65,-5),note(bar,2,'1/8',.63,-2),note(bar,3,'1/16',.68,0)]
        for bar in (2,4,6,8):
            for beat,frac,v in [(2,'1/16',.30),(4,'1/8',.38)]:
                t['rim']['patterns'][0]['notes'].append({'start':f'{bar}:{beat}+{frac}','velocity':v,'pitch':'rim'})
        t['answer']['mix']['pan']=-.48; t['orbit']['mix']['pan']=.50
    else:
        for id,g in {'kick':-4,'clap':-5.6,'sub':-8,'talk':-7,'haze':-12.8,'lead':-9.8,'motor':-10.5}.items(): t[id]['mix']['gainDb']=g
        # First 4 bars are a pressure chamber, last 4 land at full level.
        for id in ('kick','clap','hats','rim','sub'):
            ns=t[id]['patterns'][0]['notes']
            t[id]['patterns'][0]['notes']=[n for n in ns if int(n['start'].split(':')[0])>4 or (id=='kick' and ':1' in n['start'] and int(n['start'].split(':')[0])%2==1) or (id=='clap' and int(n['start'].split(':')[0]) in (2,4))]
        t['haze']['mix']['pan']=0
        t['haze']['patterns'][0]['notes'] += [dict(n,start=n['start'].replace('1:','3:',1)) for n in t['haze']['patterns'][0]['notes'] if n['start'].startswith('1:')]
        t['motor']['patterns'][0]['notes'].append({'start':'4:4+1/16','velocity':.60})
    for tr in p['tracks']:
        tr['patterns'][0]['notes'].sort(key=lambda n: tuple(int(x) for x in re.findall(r'\d+',n['start'])[:2]))
    (ROOT/name/'project.json').write_text(json.dumps(p,indent=2)+'\n')

for name in ('a','b','c'): make(name)
print('Wrote three original-score payoff treatments.')
