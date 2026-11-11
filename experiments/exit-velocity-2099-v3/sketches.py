#!/usr/bin/env python3
"""Render three original, self-contained EXIT VELOCITY V3 composition sketches.

Usage: python sketches.py
The synthesizers are defined in instruments.py; no external samples are used.
"""
from pathlib import Path
from functools import lru_cache
import subprocess
import tempfile
import numpy as np
from scipy.io import wavfile
import instruments as ins

SR = ins.SR
OUT = Path(__file__).resolve().parent / 'sketches'
OUT.mkdir(exist_ok=True)


def hz(n):
    return 440 * 2 ** ((n - 69) / 12)


@lru_cache(maxsize=500)
def note(name, pitch, dur, velocity):
    return getattr(ins, name)(hz(pitch), dur, velocity)


@lru_cache(maxsize=100)
def hit(name, velocity, seed):
    if name in ('snare', 'rim', 'hat'):
        return getattr(ins, name)(velocity, seed=seed)
    return getattr(ins, name)(velocity)


class Sketch:
    def __init__(self, seconds):
        self.audio = np.zeros((int(seconds * SR), 2), dtype=np.float32)

    def add(self, sound, time, gain=1., pan=0., echo=0.):
        i = max(0, int(time * SR))
        n = min(len(sound), len(self.audio)-i)
        if n <= 0:
            return
        # Constant-power panning keeps centered low end solid.
        angle = (pan + 1) * np.pi / 4
        self.audio[i:i+n, 0] += sound[:n] * gain * np.cos(angle)
        self.audio[i:i+n, 1] += sound[:n] * gain * np.sin(angle)
        if echo:
            j = i + int(.19 * SR)
            m = min(n, len(self.audio)-j)
            if m > 0:
                self.audio[j:j+m, 0] += sound[:m] * gain * echo * np.sin(angle)
                self.audio[j:j+m, 1] += sound[:m] * gain * echo * np.cos(angle)

    def n(self, name, pitch, duration, time, vel=.8, gain=1., pan=0., echo=0.):
        self.add(note(name, pitch, round(duration, 3), vel), time, gain, pan, echo)

    def d(self, name, time, vel=.8, pan=0., seed=42):
        self.add(hit(name, vel, seed), time, 1., pan)

    def export(self, filename):
        x = self.audio
        fade = min(int(.18 * SR), len(x))
        x[-fade:] *= np.linspace(1, 0, fade)[:, None]
        x[:128] *= np.linspace(0, 1, 128)[:, None]
        # A modest saturator catches summed transients without a loudness race.
        x = np.tanh(1.15 * x) / np.tanh(1.15)
        x *= .82 / max(.82, np.max(np.abs(x)))
        with tempfile.NamedTemporaryFile(suffix='.wav') as f:
            wavfile.write(f.name, SR, (x * 32767).astype(np.int16))
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f.name,
                            '-codec:a', 'libmp3lame', '-b:a', '320k',
                            str(OUT / filename)], check=True)
        print(filename, round(len(x)/SR, 2), 'seconds', 'peak', round(float(np.max(np.abs(x))), 3))


def rubber_signal():
    beat = 60/116
    bar = beat*4
    s = Sketch(bar*4 + .25)
    chords = [(53,56,60,63), (51,55,58,60), (49,53,56,60), (48,52,55,58)]
    roots = [41,39,37,36]
    for b in range(4):
        t = b*bar
        for p in chords[b]:
            s.n('reed', p, bar*.84, t, .43, .26, (p%3-1)*.4)
        for step, p, length in [(0,65,1.4),(3,68,1.4),(6,72,2.6),(10,71,1.3),(12,68,1.2),(14,63 if b<3 else 65,1.8)]:
            # Last bar hints at resolution without losing the signature shape.
            s.n('rubber', p, length*beat/4, t+step*beat/4, .82, .72, .12, .18)
        r = roots[b]
        for step, p, length in [(0,r,1.4),(5,r+7,1.),(8,r+10,1.2),(11,r+7,1.1),(14,r,1.5)]:
            s.n('bass', p, length*beat/4, t+step*beat/4, .78, .8)
        for step in (0,6,10,14): s.d('kick',t+step*beat/4,.86 if step==0 else .68)
        for step in (4,12): s.d('snare',t+step*beat/4,.64,seed=19+b)
        for step in (2,6,10,14): s.d('hat',t+step*beat/4,.48,pan=(-.25 if step%4==2 else .25),seed=20+step+b)
        s.d('rim',t+15*beat/4,.36,pan=.3,seed=77+b)
    s.export('01-rubber-signal.mp3')


def glass_relay():
    beat=60/138
    bar=4*beat
    s=Sketch(bar*6+.3)
    roots=[35,33,31,30,35,30]
    phrase=[71,78,76,74,78,81,79,78]
    answer=[71,74,73,69,66,64,66,66]
    for b in range(6):
        t=b*bar
        notes = phrase if b%2==0 else answer
        for i,p in enumerate(notes):
            # Accents articulate 3+3+2 rather than even eighths.
            s.n('glass',p,.20,t+i*beat/2,.86 if i in (0,3,6) else .65,.8,(-.25 if i%2==0 else .25),.25)
        root=roots[b]
        for step,p in [(0,root),(3,root+7),(6,root+12),(9,root+7),(12,root+10),(14,root+7)]:
            s.n('bass',p,beat*.32,t+step*beat/4,.75,.76)
        for step in (0,3,7,10,14): s.d('kick',t+step*beat/4,.8 if step==0 else .64)
        for step in (4,12): s.d('snare',t+step*beat/4,.7,seed=30+b)
        for step in range(2,16,4): s.d('hat',t+step*beat/4,.5,pan=.23,seed=40+step+b)
    s.export('02-glass-relay.mp3')


def moon_taxi():
    beat=60/96
    bar=4*beat
    s=Sketch(bar*4+.3)
    chords=[(48,51,55,58),(44,48,51,55),(41,44,48,51),(43,47,50,53)]
    roots=[36,32,29,31]
    for b in range(4):
        t=b*bar
        for p in chords[b]: s.n('glass',p,bar*.8,t,.35,.33,(p%3-1)*.45,.2)
        for sub,p,length in [(0,67,2.8),(3,63,.8),(4,60,.8),(5,58,.8),(6,62,1.8),(8,63,.8),(9,67 if b<3 else 60,2.5)]:
            s.n('reed',p,length*beat/3,t+sub*beat/3,.78,.66,.14,.16)
        root=roots[b]
        for sub,p,length in [(0,root,2.3),(4,root+7,1.4),(6,root+12,1.4),(9,root+7,2.2)]:
            s.n('bass',p,length*beat/3,t+sub*beat/3,.77,.8)
        for sub in (0,8,10): s.d('kick',t+sub*beat/3,.82 if sub==0 else .59)
        s.d('snare',t+6*beat/3,.68,seed=60+b)
        for sub in (2,5,8,11): s.d('rim',t+sub*beat/3,.42,pan=(-.3 if sub%2 else .3),seed=70+b+sub)
        for sub in (3,9): s.d('hat',t+sub*beat/3,.32,pan=.2,seed=80+b+sub)
    s.export('03-moon-taxi.mp3')


if __name__ == '__main__':
    rubber_signal()
    glass_relay()
    moon_taxi()
