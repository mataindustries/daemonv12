"""Authored musical score. Versions are retained beside shared immutable assets."""
from fractions import Fraction
from pathlib import Path
import json
import sys
import wave
import numpy as np

ROOT = Path(__file__).resolve().parent
VERSION = int(sys.argv[1]) if len(sys.argv)>1 else 1
BPM = 138
BARS = 16
BEAT = round(60_000_000/BPM)/1_000_000

def pos(beats):
    ticks = round(beats*960)
    bar, rem = divmod(ticks,3840)
    beat, sub = divmod(rem,960)
    return f'{bar+1}:{beat+1}' + (f'+{Fraction(sub,3840)}' if sub else '')

def duration(beats):
    return str(Fraction(round(beats*960),3840))

def from_pos(value):
    main,*fraction=value.split('+')
    bar,beat=map(int,main.split(':'))
    return (bar-1)*4+beat-1+(4*float(Fraction(fraction[0])) if fraction else 0)

def notes(t): return t['patterns'][0]['notes']

def remove_between(t,start,end):
    t['patterns'][0]['notes']=[n for n in notes(t) if not start<=from_pos(n['start'])<end]

def comp(threshold,ratio,attack,release,makeup=0):
    return {'type':'compressor','thresholdDb':threshold,'ratio':ratio,'attackMs':attack,'releaseMs':release,'makeupGainDb':makeup}

def point(beats,value,transition='step'):
    return {'at':{'musical':pos(beats)},'value':value,'transition':transition}

def sample(at, v=.8, semi=0, offset=0, glide=None):
    n={'start':pos(at),'velocity':v}
    if semi: n['playbackRate']=round(2**(semi/12),6)
    if offset: n['offsetSeconds']=round(offset,6)
    if glide: n['glide']={'to':round(2**(glide[0]/12),6),'duration':duration(glide[1])}
    return n

def gm(at,pitches,length,v=.6):
    return {'start':pos(at),'pitch':pitches,'duration':duration(length),'velocity':v}

def track(id,source,gain,pan=0,fx=None):
    return dict(id=id, instrument=({'type':'gm','program':source[3:]} if source.startswith('gm:') else
         {'type':'sampler','sample':'assets/'+source}), mix={'gainDb':gain,'pan':pan},
         effects=fx or [],clips=[{'bar':1,'pattern':'score'}],
         patterns=[{'id':'score','bars':BARS,'notes':[]}])

def hp(f): return {'type':'highpass','frequencyHz':f}
def lp(f): return {'type':'lowpass','frequencyHz':f}
def delay(ms,wet): return {'type':'delay','timeMs':ms,'wet':wet}
def room(wet,decay=.5): return {'type':'reverb','roomSize':.28,'decaySeconds':decay,'wet':wet}

kick=track('heel','heel-kick.wav',-5,fx=[hp(31)])
clap=track('chrome','chrome-clap.wav',-7,fx=[hp(480),room(.07,.28)])
hat=track('needles','pixel-hat.wav',-11,.24,fx=[lp(11000)])
tick=track('knuckles','machine-tick.wav',-9,-.32,fx=[hp(950),lp(6300)])
bass=track('pocket','pocket-bass-d2.wav',-6,fx=[hp(36),lp(850)])
lead=track('mouth','rubber-reed-d4.wav',-3,-.06,fx=[hp(240),delay(60_000/BPM*.375,.16),room(.10,.43)])
reply=track('mutter','rubber-reed-d4.wav',-6,.25,fx=[hp(180),lp(2600),delay(60_000/BPM*.75,.17)])
keys=track('velvet','gm:electric_piano_1',-8,-.22,fx=[hp(320),lp(5200),room(.22,.75)])
air=track('afterimage','rubber-reed-d4.wav',-14,.5,fx=[hp(850),delay(60_000/BPM*.75,.38),room(.64,.9)])
tracks=[kick,clap,hat,tick,bass,lead,reply,keys,air]

def add(t,n): t['patterns'][0]['notes'].append(n)

# The subdivision delay is written into the score, never randomized.
def swing(q):
    return q+.035 if abs((q*4)%2-1)<.01 else q

kick_patterns=[[0,1.75,2.5],[0,.75,2.75,3.5],[0,1.5,2.75],[.0,1.75,3.25]]
for bar in range(16):
    base=4*bar
    k=kick_patterns[bar%4]
    sn=[1,3]
    hs=[.5,1.5,2,2.5,3.5,3.75]
    tk=[.75,2.75]
    if bar==0: k=[2.5]; sn=[3]; hs=[2.5,3.5]; tk=[]
    if bar in [6,7]:
        k=[0,2.75] if bar==6 else [0,1.75]
        sn=[2] if bar==6 else [1]
        hs=[.5,1.5,3.5] if bar==6 else [.5,1.5]
        tk=[3.25] if bar==6 else [2.5,2.75,3]
    if bar==15: k=[0,1.5]; sn=[1]; hs=[.5];tk=[]
    for i,q in enumerate(k): add(kick,sample(base+q,.92 if i==0 else .78))
    for q in sn: add(clap,sample(base+q+.015,.8 if q==1 else .88,semi=-1))
    for i,q in enumerate(hs): add(hat,sample(base+swing(q),[.58,.39,.47,.63,.41,.29][i%6],semi=(i%3)-1))
    for i,q in enumerate(tk): add(tick,sample(base+swing(q),.45 if i==0 else .34,semi=3 if i else -2))
    if bar in [3,5,9,11,13]:
        add(clap,sample(base+2.78,.22,semi=2,offset=.036))
        add(hat,sample(base+3.875,.26,semi=4))

# Bass roots follow the harmony; rests after each call preserve the pocket.
roots=[0,0,0,-2,-5,-2,-4,-5,0,0,-5,-2,0,-5,0,0]
for bar,root in enumerate(roots):
    base=bar*4
    bs=[(.18,.83,root),(1.95,.76,root),(3.25,.66,root+7)]
    if bar%2: bs=[(.17,.84,root),(2.88,.78,root),(3.62,.58,root+12)]
    if bar==0:bs=[(2.52,.84,0)]
    if bar==6:bs=[(.16,.78,-4),(2.85,.70,-4)]
    if bar==7:bs=[(.18,.7,-5)]
    if bar==15:bs=[(.14,.78,0),(1.55,.81,0)]
    for q,v,p in bs:add(bass,sample(base+q,v,semi=p))

# Signature: D, F, E that slumps to D; the rest is part of the hook.
for bar in [0,2,4,8,10,12,14]:
    base=bar*4
    add(lead,sample(base,.85,semi=0))
    add(lead,sample(base+.785,.73,semi=3))
    add(lead,sample(base+1.5,.9,semi=2,glide=(0,.5)))
    if bar in [8,12]: add(air,sample(base+1.5,.53,semi=14,glide=(12,.5)))
for bar in [1,3,5,9,11,13]:
    base=bar*4
    add(reply,sample(base+.5,.73,semi=-5))
    add(reply,sample(base+1.285,.67,semi=-2,offset=.013))
    add(lead,sample(base+2.5,.8,semi=0))
    add(lead,sample(base+3.285,.59,semi=7,offset=.022))
add(reply,sample(6*4+.5,.7,semi=-5,glide=(-2,.75)))
add(air,sample(6*4+2.5,.7,semi=12))
add(lead,sample(7*4+.5,.7,semi=3,glide=(-9,1)))
add(reply,sample(15*4,.69,semi=-5))
add(lead,sample(15*4+.75,.70,semi=3))
add(lead,sample(15*4+1.5,.9,semi=0))

chords={0:['F3','A3','C4','E4'],2:['F3','A3','C4','E4'],3:['E3','G3','B3','D4'],
        4:['C4','E4','G4','B4'],5:['E3','G3','B3','D4'],6:['Bb3','D4','F4','A4'],
        7:['B3','D4','F4','A4'],8:['F3','A3','C4','E4'],10:['C4','E4','G4','B4'],
        11:['E3','G3','B3','D4'],12:['F3','A3','C4','E4'],13:['B3','D4','F4','A4'],
        14:['F3','A3','C4','E4'],15:['F3','A3','D4','E4']}
for bar,chord in chords.items():
    at=bar*4+(2.25 if bar not in [6,7,15] else .25)
    add(keys,gm(at,chord,1.15 if bar in [6,7] else .38,.52 if bar not in [6,7] else .7))
    if bar in [4,10,12]:add(keys,gm(bar*4+3.5,chord,.25,.43))

project={'formatVersion':1,'title':'Working title — rubber reed','description':'Original sixteen-bar broken-garage miniature: rubber reed, displaced percussion, pocket bass, electric-piano openings.','bpm':BPM,'timeSignature':'4/4','key':'D minor','bars':BARS,'seed':601138,
    'render':{'duration':{'bars':BARS},'tail':'none'},
    'master':{'gainDb':-1,'effects':[hp(28),{'type':'compressor','thresholdDb':-14,'ratio':1.5,'attackMs':25,'releaseMs':100,'makeupGainDb':1}]},'tracks':tracks}

if VERSION>=2:
    project['title']='SOFT TEETH'
    project['description']='A rubber-reed hook bites into swung broken garage; Bbmaj7 and G13 open a brief window, a vacuum interrupts it, and the hook returns in a new register. D minor with Dorian colour.'
    # Render one revealed bass-heavy balance and barely audible percussion/harmony.
    clap['mix']['gainDb']=-1.8
    clap['effects']=[hp(220),{'type':'saturation','driveDb':3,'mix':.18},room(.06,.26)]
    hat['mix']['gainDb']=-1
    tick['mix']['gainDb']=1
    bass['mix']['gainDb']=-7.5
    bass['effects']=[hp(36),{'type':'saturation','driveDb':5,'mix':.14},lp(1000)]
    lead['mix']['gainDb']=-2
    lead['effects']=[hp(230),comp(-20,2,1.5,65,2),delay(60_000/BPM*.375,.14),room(.09,.40)]
    reply['mix']['gainDb']=-3
    reply['effects']=[hp(190),lp(3000),comp(-22,2.1,4,65,2),delay(60_000/BPM*.75,.15)]
    keys['mix']={'gainDb':2,'pan':-.38}
    keys['effects']=[hp(260),lp(5200),room(.17,.65)]
    air['mix']['gainDb']=-7
    # Sustained, plainly voiced harmony gives the middle a different grammar.
    remove_between(keys,24,32)
    add(keys,gm(24.25,['Bb3','D4','F4','A4'],2.5,.73))
    add(keys,gm(28,['B3','F4','A4','E5'],1.65,.70))
    remove_between(bass,28,32)
    add(bass,sample(28.15,.76,semi=-7))
    remove_between(lead,28,32)
    add(lead,sample(28.25,.72,semi=3,glide=(-9,1)))
    remove_between(tick,30,32)
    for q,v in [(30,.50),(30.333333,.40),(30.666667,.30)]:
        add(tick,sample(q,v,semi=4,offset=.002))
    # A full-register change and altered replies distinguish the second statement.
    for n in notes(lead):
        b=from_pos(n['start'])
        shift=12 if 32<=b<34 else (7 if 40<=b<42 else 0)
        if shift:
            n['playbackRate']=round(n.get('playbackRate',1)*2**(shift/12),6)
            if 'glide' in n:n['glide']['to']=round(n['glide']['to']*2**(shift/12),6)
        if 36<=b<40 and b%4>3:n['playbackRate']=round(2**(10/12),6)
    remove_between(air,32,36)
    add(air,sample(35.5,.63,semi=19,offset=.065))
    add(reply,sample(43.65,.62,semi=0,offset=.030))
    # Opening space remains dry; the return uses moving, complementary positions.
    lead['automation']={'pan':[point(0,-.08),point(32,-.28,'linear'),point(40,.16,'linear'),point(48,-.08)]}
    reply['automation']={'pan':[point(0,.27),point(32,.38,'linear'),point(48,.16)]}
    # Predetermined small gate into the return, before effects; room tails are allowed.
    for tr in [kick,clap,hat,tick,bass,lead,reply,keys,air]:
        gain=tr['mix']['gainDb']
        tr.setdefault('automation',{})['gainDb']=[point(0,gain),point(31.125,gain,'linear'),point(31.25,-60),point(32,gain)]
    # The final D has space around it; no kick doubles its transient.
    remove_between(kick,61,64)
    for n in notes(bass):
        if from_pos(n['start'])>=61:n['velocity']=.67
    project['master']={'gainDb':-.8,'effects':[hp(28),comp(-16,1.6,18,85,1)]}

if VERSION>=3:
    # V02's octave-up call had a thin second half: answer it in the original body.
    add(reply,sample(34.875,.65,semi=-5))
    remove_between(air,35,36)
    add(air,sample(38.75,.55,semi=12,offset=.065))
    # Coda: the expected third syllable is withheld, then answered below.
    remove_between(lead,49.4,52)
    remove_between(kick,48,52)
    for q,v in [(48,.91),(48.75,.74),(50.25,.84)]:add(kick,sample(q,v))
    remove_between(clap,48,52)
    for q,v in [(49.52,.84),(51.27,.74)]:add(clap,sample(q,v,semi=-1))
    remove_between(bass,48,52)
    for q,v,p in [(48.16,.8,0),(50.45,.74,0),(51.65,.60,7)]:add(bass,sample(q,v,semi=p))
    add(reply,sample(50.7,.76,semi=-5))
    add(reply,sample(51.5,.65,semi=0,offset=.04))
    remove_between(air,48,52)
    # An isolated descending triplet replaces a conventional drum fill.
    for tr in tracks:remove_between(tr,55,56)
    for q,p,v in [(55,12,.62),(55+1/3,7,.57),(55+2/3,3,.54)]:
        add(lead,sample(q,v,semi=p,offset=.11))
    # An Eb-to-D sigh resolves the last note; shorten the final bass tail slightly.
    for n in notes(lead):
        if abs(from_pos(n['start'])-61.5)<.001:
            n['playbackRate']=round(2**(1/12),6)
            n['glide']={'to':1,'duration':'1/16'}
    for n in notes(bass):
        if from_pos(n['start'])>=61:n['offsetSeconds']=.03
    keys['automation']['pan']=[point(0,-.38),point(24,-.38,'linear'),point(28,.22),point(32,-.25)]
    # Offsets were deliberately auditioned through measurements. Sample notes have
    # no built-in fade: choose near-zero source frames, not arbitrary cut points.
    for tr in tracks:
        if tr['instrument']['type']!='sampler':continue
        with wave.open(str(ROOT/tr['instrument']['sample']),'rb') as w:
            x=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').reshape(-1,w.getnchannels())
        for n in notes(tr):
            if not n.get('offsetSeconds'):continue
            center=round(n['offsetSeconds']*44100)
            radius=round(.0018*44100)
            lo=max(1,center-radius);hi=min(len(x)-1,center+radius)
            candidates=np.arange(lo,hi+1)
            # Both channels matter for a stereo clap; deterministic tie-breaking.
            cost=np.max(np.abs(x[candidates].astype(float)),axis=1)+.025*np.abs(candidates-center)
            frame=int(candidates[np.argmin(cost)])
            n['offsetSeconds']=round(frame/44100,6)
    # Only makeup changes for delivery level: the master remains a gentle 1.6:1.
    project['master']['effects'][-1]['makeupGainDb']=4.6

if VERSION not in [1,2,3]:
    raise SystemExit('Later versions must be written after render evidence.')

for tr in tracks:
    tr['patterns'][0]['notes'].sort(key=lambda n:from_pos(n['start']))
path=ROOT/f'v{VERSION:02d}.project.json'
path.write_text(json.dumps(project,indent=2)+'\n')
print(json.dumps({'project':str(path),'events':sum(len(t['patterns'][0]['notes']) for t in tracks),'tracks':len(tracks),'seconds':64*BEAT}))
