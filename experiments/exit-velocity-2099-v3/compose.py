#!/usr/bin/env python3
"""EXIT VELOCITY // 2099 V3. Deterministic original score and stem renderer."""
from pathlib import Path
import subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
import instruments as ins

ROOT=Path(__file__).resolve().parent
SR=ins.SR
BPM=116
BEAT=60/BPM
BAR=4*BEAT
DUR=26*BAR+0.8
N=int(SR*DUR)
tracks={name:np.zeros((N,2),dtype=np.float32) for name in ('drums','bass','hook','harmony','texture')}

def freq(midi): return 440*2**((midi-69)/12)
def place(track, sound, time, gain=1., pan=0):
    i=max(0,int(time*SR)); n=min(len(sound),N-i)
    if n<=0:return
    a=np.asarray(sound[:n],dtype=np.float32)*gain
    tracks[track][i:i+n,0]+=a*np.sqrt((1-pan)*.5)
    tracks[track][i:i+n,1]+=a*np.sqrt((1+pan)*.5)
def note(track, kind, midi, bar, beat, dur, gain=1, pan=0):
    place(track,kind(freq(midi),dur),bar*BAR+beat*BEAT,gain,pan)
def echo(track,kind,midi,bar,beat,dur,gain,pan):
    note(track,kind,midi,bar,beat,dur,gain,pan)
    note(track,kind,midi,bar,beat+.75,dur,gain*.17,-pan)

# Two-bar question and answer. F minor with B natural as a mischievous passing tone.
question=[(0,65,.28),(0.75,68,.22),(1.5,72,.38),(2.5,71,.19),(3,68,.22),(3.5,63,.4)]
answer=[(.5,65,.22),(1.25,68,.20),(2,70,.25),(2.75,72,.23),(3.25,68,.3)]
roots=[41,39,37,36] # F, Eb, Db, C
chords=[[53,56,60,63],[51,55,58,60],[49,53,56,60],[48,52,55,58]]
for bar in range(26):
    section='intro' if bar<2 else 'groove' if bar<8 else 'lift' if bar<12 else 'break' if bar<14 else 'return' if bar<20 else 'turn' if bar<22 else 'payoff'
    root=roots[bar%4]
    # Vary the groove while preserving the kick/rim relationship.
    if section not in ('break','turn'):
        kicks=([0,1.5,2.5,3.5] if bar%2==0 else [0,1.25,2.5,3.25])
        if section=='intro': kicks=[0,2.5] if bar==0 else [0,1.5,2.5]
        for j,b in enumerate(kicks): place('drums',ins.kick(),bar*BAR+b*BEAT,.82 if j==0 else .65)
        for b in (1,3): place('drums',ins.snare(seed=bar*9+int(b)),bar*BAR+b*BEAT,.55 if section!='intro' else .37)
        for k in range(8):
            if section=='intro' and k%2: continue
            t=k*.5+(0.035 if k%2 else 0)
            place('drums',ins.hat(seed=bar*17+k),bar*BAR+t*BEAT,.18 if k%2==0 else .12,(-.25 if k%2 else .25))
        if section in ('lift','return','payoff'):
            for b in (0.75,2.75,3.75): place('drums',ins.rim(seed=bar*13+int(b*4)),bar*BAR+b*BEAT,.23, .35 if b<2 else -.35)
    elif section=='break':
        for b in (0,2.75): place('drums',ins.rim(seed=bar*7+int(b*4)),bar*BAR+b*BEAT,.30,-.25)
    else:
        for b in (0,1.5,2.5,3,3.5): place('drums',ins.rim(seed=bar*11+int(b*4)),bar*BAR+b*BEAT,.35,.1)
    # Answering bass is syncopated, and makes room for the kick and upper hook.
    if section in ('groove','lift','return'):
        seq=[(.5,root,.24),(1.75,root+7,.22),(2.75,root+10,.24),(3.5,root+7,.24)] if bar%2==0 else [(.5,root,.28),(1.5,root+3,.18),(2.25,root+7,.30),(3.5,root-2,.20)]
        for b,p,d in seq: note('bass',ins.bass,p,bar,b,d,.62)
    elif section=='intro' and bar==1:
        for b,p in [(1.75,41),(2.75,48),(3.5,51)]:note('bass',ins.bass,p,bar,b,.22,.45)
    elif section=='payoff':
        # The upper hook becomes a bassline: same contour and rhythmic identity.
        for b,p,d in question: note('bass',ins.bass,p-24,bar,b,d*.85,.68)
    # Hook: exact recognizable figure, later a response and finally displaced octaves.
    if section in ('intro','groove','lift','return'):
        seq=question if bar%2==0 else answer
        if section=='return' and bar%4==3: seq=question
        for idx,(b,p,d) in enumerate(seq):
            echo('hook',ins.rubber,p,bar,b,d,.34 if section=='intro' else .42,[-.3,.2,.35,-.2][idx%4])
    elif section=='break':
        # Exposed melody played as isolated glass, setting up a register switch.
        for idx,(b,p,d) in enumerate(question if bar==12 else answer):
            note('hook',ins.glass,p+12,bar,b,d,.24,(-.45 if idx%2 else .45))
    elif section=='turn':
        # First present the same gesture as tuned percussion, then lower it to bass.
        for idx,(b,p,d) in enumerate(question):
            note('hook',ins.glass,p+(0 if bar==20 else -12),bar,b,d,.31,(-.3 if idx%2 else .3))
    elif section=='payoff':
        # Countermelody answers the relocated hook, rather than doubling it.
        seq=[(.25,77,.3),(1.25,75,.3),(2,72,.4),(3.25,75,.35)] if bar%2==0 else [(.25,75,.3),(1.25,72,.3),(2.25,68,.4),(3.25,70,.4)]
        for idx,(b,p,d) in enumerate(seq):echo('hook',ins.rubber,p,bar,b,d,.32,(-.35 if idx%2 else .35))
    # Short chord stabs, not a constant pad. Keeps the movement audible.
    if section in ('lift','return','payoff'):
        for pos in ([.0,2.0] if section=='lift' else [.75,2.75]):
            for j,p in enumerate(chords[bar%4][1:]):
                note('harmony',ins.rubber,p+12,bar,pos,.5,.075,(-.6+j*.6))
    if section=='break':
        for j,p in enumerate(chords[bar%4]):note('harmony',ins.glass,p+12,bar,.0,1.2,.075,-.6+j*.4)
    # Sparse glass punctuation as a recognizable high-frequency answer.
    if section in ('lift','return','payoff') and bar%2:
        for j,(b,p) in enumerate([(3,84),(3.5,80),(3.75,77)]):note('texture',ins.glass,p,bar,b,.2,.10,[-.65,.65,0][j])

# A half-beat of breathing room before the transformation.
start=int((20*BAR-.18)*SR); end=int(20*BAR*SR)
for x in tracks.values(): x[start:end]*=np.linspace(1,0,end-start,dtype=np.float32)[:,None]
# Fade a short tail, leaving the final phrase open rather than a hard stop.
for x in tracks.values(): x[-int(.5*SR):]*=np.linspace(1,0,int(.5*SR),dtype=np.float32)[:,None]

out=ROOT/'stems';out.mkdir(exist_ok=True)
for name,a in tracks.items(): wavfile.write(out/(name+'.wav'),SR,a)
mix=sum(tracks.values())
# Mix headroom, then use FFmpeg's dynamic loudness normalizer with true-peak ceiling.
wavfile.write(ROOT/'premaster.wav',SR,mix.astype(np.float32))
def run(*args): subprocess.run(args,check=True,stdout=subprocess.DEVNULL)
run('ffmpeg','-y','-v','error','-i',str(ROOT/'premaster.wav'),'-af','loudnorm=I=-14:TP=-1.5:LRA=8:linear=false','-ar','48000','-c:a','pcm_s24le',str(ROOT/'EXIT-VELOCITY-2099-V3.wav'))
run('ffmpeg','-y','-v','error','-i',str(ROOT/'EXIT-VELOCITY-2099-V3.wav'),'-c:a','libmp3lame','-b:a','320k',str(ROOT/'EXIT-VELOCITY-2099-V3.mp3'))
# The transformation and payoff, with one bar of lead-in.
run('ffmpeg','-y','-v','error','-ss',str(19*BAR),'-t','15','-i',str(ROOT/'EXIT-VELOCITY-2099-V3.wav'),'-c:a','libmp3lame','-b:a','320k',str(ROOT/'highlight-15s.mp3'))
print('Rendered',DUR,'seconds at',BPM,'BPM')
