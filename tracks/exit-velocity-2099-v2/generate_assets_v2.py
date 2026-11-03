#!/usr/bin/env python3
"""EXIT VELOCITY V2: original deterministic synthesis, no external audio.
Usage: python generate_assets_v2.py --palette B --out assets
Python NumPy/SciPy; writes 44.1kHz mono/stereo PCM16 for DaemonV12.
Palette A is weighted/cruising, B agile/formant-rich, C distant/large.
"""
from pathlib import Path
import argparse, json, wave
import numpy as np
from scipy import signal

p=argparse.ArgumentParser(); p.add_argument('--palette', choices=['A','B','C'], default='B'); p.add_argument('--out', default='assets'); p.add_argument('--early-kick', action='store_true', help='reproduce initial softer kick used by early candidates'); args=p.parse_args()
ROOT=Path(args.out); ROOT.mkdir(parents=True, exist_ok=True)
SR=44100; rng=np.random.default_rng(2099)
PAL=args.palette

def tt(sec): return np.arange(round(SR*sec),dtype=np.float64)/SR
def filt(x, mode, hz, order=3): return signal.sosfilt(signal.butter(order,hz,btype=mode,fs=SR,output='sos'),x)
def save(name,x,peak=.67,attack=.0005,release=.012):
    x=np.nan_to_num(x); n=len(x); a=max(1,round(attack*SR)); r=max(1,round(release*SR))
    env=np.ones(n); env[:a]*=np.linspace(0,1,a); env[-r:]*=np.linspace(1,0,r)
    x=x*(env[:,None] if x.ndim==2 else env); x=x/max(np.max(np.abs(x)),1e-12)*peak
    pcm=np.round(np.clip(x,-.999,.999)*32767).astype('<i2')
    with wave.open(str(ROOT/(name+'.wav')),'wb') as w:
        w.setnchannels(1 if x.ndim==1 else x.shape[1]); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

# Pitched membrane, fast pitch relaxation, short beater and a separate warm
# second harmonic. The mono tail retreats before the short bass answer.
t=tt(.38); bend={'A':130,'B':115,'C':145}[PAL]; floor={'A':48,'B':49,'C':45}[PAL]
phase=2*np.pi*(floor*t+bend*.024*(1-np.exp(-t/.024)))
body=np.sin(phase)*np.exp(-t*10.8); overtone=np.sin(phase*2+.1)*np.exp(-t*28)
click=filt(rng.normal(size=len(t)),'highpass',2400)*np.exp(-t*(205 if args.early_kick else 160))
kick=np.tanh(1.6*(body+.20*overtone+(.13 if args.early_kick else .27)*click))
save('kick',kick,.83,attack=.00025,release=.025)
# A knuckle strike plus four non-identical handclap grains and resonant body.
t=tt(.38); white=rng.normal(size=len(t)); colored=filt(white,'highpass',950)
slaps=sum(a*np.exp(-np.maximum(t-d,0)/dec)*(t>=d) for d,a,dec in [(0,.8,.008),(.011,.58,.010),(.026,.72,.012),(.047,.44,.017)])
tail=filt(white,'lowpass',6700)*np.exp(-t*15)
body=(np.sin(2*np.pi*183*t)+.33*np.sin(2*np.pi*329*t))*np.exp(-t*21)
clap=.39*colored*slaps+.17*tail+.48*body
save('clap',clap,.76,attack=.00035,release=.018)
# Metallic upper percussion retains the original contrasting voices, with
# shorter attack than a generic white-noise hat.
t=tt(.105); noise=filt(rng.normal(size=len(t)),'highpass',6900)
hat=(.56*noise+.25*np.sin(2*np.pi*8660*t)*np.sin(2*np.pi*2810*t))*np.exp(-t*52)
save('hat',hat,.63,attack=.00025)
t=tt(.16); rim=(np.sin(2*np.pi*890*t)+.4*np.sin(2*np.pi*1635*t))*np.exp(-t*60)+.50*filt(rng.normal(size=len(t)),'highpass',1900)*np.exp(-t*100)
save('rim',rim,.68,attack=.0003)
t=tt(.28); x=filt(rng.normal(size=len(t)),'highpass',5500)*np.exp(-t*14)+.24*np.sin(2*np.pi*6700*t)*np.exp(-t*18)
save('open-hat',x,.60)
t=tt(.13); x=filt(rng.normal(size=len(t)),'highpass',4800)*np.sin(np.pi*np.minimum(t/.13,1))**1.5
save('shaker',x,.50)
t=tt(.28); x=sum(a*np.sin(2*np.pi*f*t)*np.exp(-t*dec) for f,a,dec in [(780,1,26),(1143,.65,30),(2113,.37,40),(2940,.17,55)])
save('chrome',x,.64)
# Separate mono sub, with just enough harmonic to make the pitch legible.
t=tt(1.05); f0=43.65352893
x=(np.sin(2*np.pi*f0*t)+.14*np.sin(2*np.pi*f0*2*t))*np.minimum(1,t/.006)*np.exp(-t*1.1)
save('sub-f1',x,.73)
# A quasi-vocal bank: moving narrow formants above a stable F2 fundamental.
# The short pitch scoop and two different formant arcs create consonant -> vowel.
# Saturation creates midrange detail; the sub role stays separate/centered.
t=tt(1.05); f0=87.30705786
scoop={'A':.018,'B':.034,'C':.022}[PAL]; vib={'A':2.0,'B':3.1,'C':1.35}[PAL]
freq=f0*(1+scoop*np.exp(-t/.035)); phase=2*np.pi*np.cumsum(freq)/SR
mouth=.5-.5*np.cos(2*np.pi*(vib*t+.03)); slow=.5+.5*np.sin(2*np.pi*(.7*t+.13))
f1={'A':340,'B':300,'C':390}[PAL]+{'A':310,'B':470,'C':260}[PAL]*mouth
f2=900+{'A':450,'B':700,'C':360}[PAL]*slow
vowel=np.zeros_like(t)
for n in range(1,37):
    f=f0*n
    amp=(.10+2.5*np.exp(-.5*((f-f1)/110)**2)+1.15*np.exp(-.5*((f-f2)/200)**2))/n**.68
    vowel+=amp*np.sin(n*phase+n*.13)
vowel=np.tanh(vowel*{'A':1.55,'B':2.0,'C':1.4}[PAL])
vowel=filt(vowel,'highpass',125)*np.minimum(1,t/.005)*np.exp(-t*.95)
save('talk-f2',vowel,.74)
# The original high F whistle contour remains, but a breath transient,
# harmonic body and gentle delayed pitch expression make the hook read on
# small speakers. Timbre is mono and therefore survives mono fold-down.
t=tt(.85); f0=698.4564629
freq=f0*(1-.029*np.exp(-t/.045)+.0035*np.sin(2*np.pi*5.4*t)*np.minimum(1,t/.14)); phase=2*np.pi*np.cumsum(freq)/SR
x=np.sin(phase)+.34*np.sin(2*phase+.25)+.17*np.sin(3*phase)+.075*np.sin(4*phase)
x+=.045*filt(rng.normal(size=len(t)),'bandpass',[2200,6500])*np.exp(-t*28)
x=np.tanh(x*1.15)*np.minimum(1,t/.008)*np.exp(-t*1.05)
save('whistle-f5',x,.70)
t=tt(1.05); f0=349.2282314; ph=2*np.pi*f0*t
x=(np.sin(ph)+.29*np.sin(2*ph)+.15*np.sin(3*ph)+.07*np.sin(5*ph))*(.82+.18*np.sin(2*np.pi*4.9*t))*np.minimum(1,t/.018)*np.exp(-t*1.15)
save('answer-f4',x,.62)
# Distinct oscillator paths create slow stereo movement rather than a widened sub.
t=tt(2.35); f0=174.6141157; sides=[]
for cents in [-5,6]:
    freq=f0*2**(cents/1200); q=2*np.pi*freq*t
    x=(np.sin(q)+.32*np.sin(2*q)+.12*np.sin(3*q)+.07*np.sin(4*q))
    x*=np.minimum(1,t/.10)*np.minimum(1,(2.35-t)/.3)*(.86+.14*np.cos(2*np.pi*.44*t)); sides.append(x)
save('haze-f3',np.stack(sides,axis=1),.40)
# Falling motor, no stock riser. C lengthens decay for more distance.
t=tt(.65); freq=1050-650*(1-np.exp(-t*8)); ph=2*np.pi*np.cumsum(freq)/SR
x=(np.sin(ph)+.15*np.sin(ph*2))*np.exp(-t*(4.5 if PAL=='C' else 6)); save('motor-fall',x,.52)
kit={'formatVersion':1,'samples':[{'name':name,'pitch':pitch,'file':name+'.wav'} for name,pitch in [('kick',36),('clap',38),('hat',42),('rim',37),('open-hat',46),('shaker',70),('chrome',56)]]}
(ROOT/'kit.json').write_text(json.dumps(kit,indent=2)+'\n')
print('Synthesized palette',PAL,'into',ROOT)
