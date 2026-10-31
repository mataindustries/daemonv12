#!/usr/bin/env python3
"""Original deterministic synthesis for EXIT VELOCITY // 2099. No external audio.
Requires NumPy and SciPy; writes 44.1 kHz PCM16 mono/stereo into assets/.
"""
from pathlib import Path
import json, wave
import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent / 'assets'
ROOT.mkdir(exist_ok=True)
SR=44100
rng=np.random.default_rng(2099)

def tt(sec): return np.arange(round(SR*sec), dtype=np.float64)/SR

def filt(x, mode, hz):
    return signal.sosfilt(signal.butter(3, hz, btype=mode, fs=SR, output='sos'), x)

def fade(x, attack=.002, release=.04):
    n=len(x); env=np.ones(n)
    a=min(n,max(1,round(attack*SR))); r=min(n,max(1,round(release*SR)))
    env[:a]*=np.linspace(0,1,a); env[-r:]*=np.linspace(1,0,r)
    return x * (env[:,None] if x.ndim==2 else env)

def save(name, x, peak=.67):
    x=np.nan_to_num(x); x=fade(x,.0015,.015)
    x=x/max(np.max(np.abs(x)),1e-12)*peak
    pcm=np.round(np.clip(x,-.999,.999)*32767).astype('<i2')
    with wave.open(str(ROOT / (name+'.wav')),'wb') as w:
        w.setnchannels(1 if x.ndim==1 else x.shape[1]); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

# Tight, tuned kick: thump, snap and warm harmonic; releases before the bass answer.
t=tt(.34); phase=2*np.pi*(47*t+110*.032*(1-np.exp(-t/.032)))
kick=np.sin(phase)*np.exp(-t*14)+.15*np.sin(phase*2)*np.exp(-t*25)+.24*filt(rng.normal(size=len(t)), 'highpass', 1800)*np.exp(-t*145)
save('kick',kick,.78)
# Handclap and snare hybrid: four differentiated slaps, noise body, pitch-stable knock.
t=tt(.35); noise=filt(rng.normal(size=len(t)),'highpass',800)
env=sum(a*np.exp(-np.maximum(t-d,0)/.012)*(t>=d) for d,a in [(0,.8),(.013,.75),(.029,.58),(.048,.5)])
env+=.28*np.exp(-t*13)
clap=noise*env*.57 + .4*np.sin(2*np.pi*(185*t-20*.02*np.exp(-t/.02)))*np.exp(-t*22)
save('clap',clap,.70)
# Hi-hat: noisy metallic body with independent oscillator beating.
t=tt(.095); noise=filt(rng.normal(size=len(t)), 'highpass', 7000)
hat=(.5*noise+.35*np.sin(2*np.pi*8660*t)*np.sin(2*np.pi*2810*t))*np.exp(-t*45)
save('hat',hat,.64)
# Tight woody rimshot; a contrasting open top, and a faint sand shaker.
t=tt(.16); rim=(np.sin(2*np.pi*890*t)+.4*np.sin(2*np.pi*1635*t))*np.exp(-t*60)+.5*filt(rng.normal(size=len(t)),'highpass',1900)*np.exp(-t*100)
save('rim',rim,.68)
t=tt(.28); x=filt(rng.normal(size=len(t)), 'highpass',5500)*np.exp(-t*13)
x+=.24*np.sin(2*np.pi*6700*t)*np.exp(-t*18)
save('open-hat',x,.60)
t=tt(.13); x=filt(rng.normal(size=len(t)),'highpass',4800)*np.sin(np.pi*np.minimum(t/.13,1))**1.5
save('shaker',x,.50)
# Bell/clink: inharmonic partials, metallic but short and not a melodic preset.
t=tt(.28); x=sum(a*np.sin(2*np.pi*f*t)*np.exp(-t*dec) for f,a,dec in [(780,1,26),(1143,.65,30),(2113,.37,40),(2940,.17,55)])
save('chrome',x,.64)
# Deep F1 pure body; deliberately separate the low and talking high bass.
t=tt(1.05); f0=43.65352893
x=(np.sin(2*np.pi*f0*t)+.11*np.sin(2*np.pi*f0*2*t))*np.minimum(1,t/.008)*np.exp(-t*.9)
save('sub-f1',x,.72)
# Vowel-filtered harmonic oscillator at F2: formants sweep across harmonics.
# This gives a reusable 'yah-ow' bass gesture without an external recording.
t=tt(1.05); f0=87.30705786
vowel=np.zeros_like(t)
f1=380+360*(.5-.5*np.cos(2*np.pi*(1.8*t+.03)))
f2=950+520*np.sin(2*np.pi*(.8*t+.13))
for n in range(1,37):
    freq=f0*n
    env=(.18 + 2.0*np.exp(-.5*((freq-f1)/145)**2) + 1.0*np.exp(-.5*((freq-f2)/230)**2))/n**.75
    vowel += env*np.sin(2*np.pi*freq*t+n*.13)
vowel=np.tanh(vowel*1.65)*(.76+.24*np.sin(2*np.pi*4.2*t)) * np.minimum(1,t/.008) * np.exp(-t*1.1)
vowel=filt(vowel,'highpass',115)
save('talk-f2',vowel,.70)
# Signature west-coast whistle, F5: light scoop plus delayed vibrato.
t=tt(.85); f0=698.4564629
freq=f0*(1-.032*np.exp(-t/.045)+.004*np.sin(2*np.pi*5.4*t)*np.minimum(1,t/.14))
phase=2*np.pi*np.cumsum(freq)/SR
x=(np.sin(phase)+.28*np.sin(2*phase+.25)+.11*np.sin(3*phase)+.05*np.sin(4*phase))
x*=np.minimum(1,t/.014)*np.exp(-t*1.3)
save('whistle-f5',x,.68)
# Softer octave answer: detuned triangle-like voice, discrete from the lead.
t=tt(1.05); f0=349.2282314
ph=2*np.pi*f0*t
x=(np.sin(ph)+.22*np.sin(2*ph)+.12*np.sin(3*ph)+.045*np.sin(5*ph))*(.78+.22*np.sin(2*np.pi*4.9*t))*np.minimum(1,t/.025)*np.exp(-t*1.3)
save('answer-f4',x,.58)
# Chord bed: individual F3/Ab3/C4/Eb4 voices can be pitched independently.
# Two decorrelated detuned oscillator banks provide a gentle stereo spread.
t=tt(2.35); f0=174.6141157
sides=[]
for cents in [-4,5]:
    freq=f0*2**(cents/1200)
    p=2*np.pi*freq*t
    x=(np.sin(p)+.32*np.sin(2*p)+.12*np.sin(3*p)+.07*np.sin(4*p))
    x*=np.minimum(1,t/.10)*np.minimum(1,(2.35-t)/.3)*(.86+.14*np.cos(2*np.pi*.44*t))
    sides.append(x)
save('haze-f3',np.stack(sides,axis=1),.40)
# A 600 ms falling motor chirp for exposed transition, not a riser loop.
t=tt(.65); freq=1050-650*(1-np.exp(-t*8)); ph=2*np.pi*np.cumsum(freq)/SR
x=(np.sin(ph)+.15*np.sin(ph*2))*np.exp(-t*6)
save('motor-fall',x,.52)
kit={'formatVersion':1,'samples':[{'name':name,'pitch':pitch,'file':name+'.wav'} for name,pitch in [('kick',36),('clap',38),('hat',42),('rim',37),('open-hat',46),('shaker',70),('chrome',56)]]}
(ROOT/'kit.json').write_text(json.dumps(kit,indent=2)+'\n')
print('Created original synthetic assets:', len(list(ROOT.glob('*.wav'))))
