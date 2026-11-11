"""Score authoring only. All audio comes from the unchanged DaemonV12 engine."""
import json, math
from fractions import Fraction
from pathlib import Path
ROOT=Path(__file__).resolve().parent
CAT=json.loads((ROOT/'v12-signature.catalog.json').read_text())
S={x['id']:x for x in CAT['sounds']}
RATE=CAT['rateTable']
def write(name,p):
    (ROOT/name).write_text(json.dumps(p,indent=2)+'\n')
def frac(n):
    x=Fraction(round(float(n)*960),3840)
    return f'{x.numerator}/{x.denominator}'
def pos(b):
    b=Fraction(round(float(b)*960),960); bar=int(b//4); beat=int(b%4); f=(b-bar*4-beat)/4
    return f'{bar+1}:{beat+1}'+(f'+{f.numerator}/{f.denominator}' if f else '')
def midi(n):
    if isinstance(n,int): return n
    names={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
    a=names[n[0]]; i=1
    if n[i:i+1] in ['#','b']: a+=1 if n[i]=='#' else -1;i+=1
    return (int(n[i:])+1)*12+a
def note(sound,b,n=None,g=.5,v=.8,a=.002,r=.035,offset=None,**kw):
    d={'start':pos(b),'velocity':v,'gate':frac(g),'envelope':{'attackSeconds':a,'releaseSeconds':r},'chokeGroup':sound}
    if n is not None:d['playbackRate']=RATE[str(midi(n)-S[sound]['rootMidi'])]
    if offset is not None:d['offsetSeconds']=offset
    d.update(kw);return d
def track(sound,notes,bars=2,id=None,gain=None,pan=0,effects=None,description=None):
    t={'id':id or sound,'instrument':{'type':'sampler','sample':S[sound]['file']},'clips':[{'bar':1,'pattern':'score'}],'patterns':[{'id':'score','bars':bars,'notes':notes}]}
    if gain is not None:t['mix']={'gainDb':gain,'pan':pan}
    if effects:t['effects']=effects
    if description:t['description']=description
    return t
def proj(title,bars,tracks,bpm=140):
    return {'formatVersion':1,'title':title,'bpm':bpm,'timeSignature':'4/4','key':'E minor','bars':bars,'seed':702,'tracks':tracks}
# Each tuple: onset in quarter-note beats, pitch, gate in beats, velocity.
HOOKS={
'a':[(0,'B4',.5,.83),(.75,'E5',.5,.91),(1.5,'D5',.75,.8),(2.75,'B4',.25,.7),(3.25,'F#4',.5,.78),(4.5,'G4',.5,.78),(5.25,'B4',.5,.88),(6,'C#5',.75,.87),(7,'B4',.5,.74)],
'b':[(.5,'E4',.35,.7),(1.5,'E4',.35,.82),(2.5,'E4',.35,.9),(3.25,'G4',.5,.8),(4,'A4',.75,.84),(5,'B4',.75,.9),(6.25,'F#5',.75,.83),(7.25,'E5',.5,.78)],
'c':[(0,'E5',1.25,.86),(1.75,'B4',.25,.72),(2.25,'G4',1,.84),(3.75,'E4',.25,.69),(4.25,'D5',1.25,.88),(6,'F#5',.5,.8),(6.75,'G5',.25,.78),(7.25,'E5',.5,.84)]}
for label,h in HOOKS.items():
    lead=[note('signal',b,n,g,v) for b,n,g,v in h]
    kicks=[note('sub-hammer',b,'E1',.25,.65,r=.025) for b in [0,2.5,4,6.5]]
    bass=[note('abyss',b,'E2',.4,.37,r=.025) for b in [.5,3.25,4.5,7.25]]
    write(f'hook-{label}.json',proj(f'Hook {label.upper()}',2,[track('signal',lead),track('sub-hammer',kicks),track('abyss',bass)]))
# Locked hook A: no alteration to its timing, contour, gates or velocity.
write('hook-anchor.json',json.loads((ROOT/'hook-a.json').read_text()))

def make_v1():
    bars=16
    ns={k:[] for k in ['sub-hammer','backbeat','hats','abyss','reactor','signal','phantom','afterglow','specter','chrome-strike','ascension','convergence']}
    def add(s,b,n=None,g=.5,v=.8,**kw):ns[s].append(note(s,b,n,g,v,**kw))
    # Hook statements; two intact statements establish the displaced cell.
    for start in [0,8,16,32,40]:
        for b,n,g,v in HOOKS['a']:
            if start<32:add('signal',start+b,n,g,v)
            else:add('phantom',start+b,n,g,v,offset=.52,a=.008,r=.065)
    # A rising continuation eventually gives PHANTOM time to sing.
    for b,n,g,v in [(48,'B4',.5,.82),(48.75,'E5',.5,.9),(49.5,'D5',.75,.84),(50.75,'B4',.25,.78),(51.25,'F#5',.5,.88),(52.5,'G5',1.25,.94),(54,'F#5',.75,.88),(55,'D#5',.65,.85)]:
        add('phantom',b,n,g,v,offset=.48,a=.01,r=.09)
    # Bassless suspension: a long-vowel transformation of the hook's intervals.
    for b,n,g,v in [(24,'E5',2.5,.66),(27,'D5',1.5,.61),(29,'C#5',1,.64),(30.5,'D#5',1,.68)]:add('phantom',b,n,g,v,offset=.35,a=.08,r=.12)
    # Opening-related final answer; a complete E resolution rather than a cut.
    for b,n,g,v in [(56,'B4',.5,.74),(56.75,'E5',.5,.83),(57.5,'D5',.75,.72),(58.75,'G4',.4,.62),(59.5,'F#4',.35,.6),(60,'E5',1.4,.76),(62,'E4',.45,.47)]:add('signal',b,n,g,v,r=.12)
    kicks={0:[0],1:[0,2.75],2:[0,1.75,3.25],3:[0,1.5,2.75],4:[0,1.75,3.25],5:[0,1.5,3.25],6:[],7:[],8:[0,.75,1.5,3.25],9:[0,1.25,2.5,3.5],10:[0,.75,1.75,3.25],11:[0,1.5,2.75],12:[0,1.75,3.25],13:[0,1.5,2.75],14:[0],15:[]}
    allkick=[]
    for bar,beats in kicks.items():
        root='A1' if bar in [4,5,10] else 'D2' if bar==11 else 'B1' if bar==13 else 'E1'
        # D2 is outside SUB HAMMER recommended range; keep its body at E1 under D harmony.
        kickroot='A1' if root=='A1' else 'B1' if root=='B1' else 'E1'
        for j,b in enumerate(beats):
            t=bar*4+b;allkick.append(t)
            add('sub-hammer',t,kickroot,.25,.92 if j==0 else .77 if j%2 else .85,r=.025)
            if 8<=bar<=13 and j==0:
                ns['backbeat'].append({'start':pos(t),'pitch':'iron-pulse','velocity':.38,'playbackRate':RATE[str(midi(kickroot)-33)],'gate':'1/16','envelope':{'attackSeconds':.001,'releaseSeconds':.02},'chokeGroup':'iron'})
        if bar in [6,7,15]:continue
        # Sub owns 20–110 Hz. Each kick leaves a separate, audible bass answer.
        for j,b in enumerate(beats):
            if bar==14:
                add('abyss',56.4,'E1',2.7,.81,r=.16);continue
            nextb=beats[j+1] if j+1<len(beats) else 4
            space=nextb-b
            if space>.7:
                gate=round(min(1.4,space-.58)*40)/40
                bassroot='E2' if bar<2 else root
                add('abyss',bar*4+b+.4,bassroot,gate,.63 if bar<2 else .86,r=.025,a=.004)
        if 2<=bar<=5 or 8<=bar<=13:
            for b in [2]:
                ns['backbeat'].append({'start':pos(bar*4+b),'pitch':'titanium-crack','velocity':.82 if bar<8 else .95,'gate':'1/8','envelope':{'attackSeconds':.001,'releaseSeconds':.055},'chokeGroup':'snare','playbackRate':RATE['-2']})
                if bar>=8:ns['backbeat'].append({'start':pos(bar*4+b+.025),'pitch':'neon-clap','velocity':.31,'gate':'1/8','envelope':{'attackSeconds':.001,'releaseSeconds':.06},'playbackRate':.943874})
            if bar in [3,5,9,11,13]:ns['backbeat'].append({'start':pos(bar*4+1.75),'pitch':'titanium-crack','velocity':.24,'gate':'1/32','envelope':{'attackSeconds':.001,'releaseSeconds':.02},'chokeGroup':'snare'})
    # Sparse, asymmetric hats; one shared local choke group closes the open hat.
    for bar in list(range(1,6))+list(range(8,14)):
        for j,b in enumerate([0,.53,1,1.55,2,2.53,3,3.55]):
            ns['hats'].append({'start':pos(bar*4+b),'pitch':'open-circuit' if j==7 and bar%2==1 else 'ghost-tick','velocity':([.39,.62,.3,.48,.37,.67,.29,.56][j])*(.8 if bar<8 else 1),'gate':frac(.27 if j==7 else .16),'envelope':{'attackSeconds':.001,'releaseSeconds':.025},'chokeGroup':'hats','playbackRate':1.059463 if j%2 else 1})
        if bar in [3,9,11,13]:
            for b,v in [(3.75,.3),(3.875,.2)]:ns['hats'].append({'start':pos(bar*4+b),'pitch':'ghost-tick','velocity':v,'gate':'1/64','envelope':{'attackSeconds':.001,'releaseSeconds':.012},'chokeGroup':'hats'})
    # Mid-bass is a question/answer voice, never a second sub.
    for bar in [4,5,8,9,10,11,12,13]:
        root='A1' if bar in [4,5,10] else 'D2' if bar==11 else 'B1' if bar==13 else 'E2'
        for b,g,v in [(1.1,.32,.69),(2.85,.25,.53)]:add('reactor',bar*4+b,root,g,v,offset=.12,a=.003,r=.035)
    # Small voice-led voicings, always in C3–E4. No open-fifth pad doubling bass.
    chords=[(0,['E3','G3','B3'],7.3,.52),(8,['F#3','G3','B3'],7.3,.58),(16,['E3','A3','C#4'],7.1,.59),(24,['D3','F#3','A3'],3.3,.55),(28,['D#3','F#3','A3'],3.2,.58),(32,['E3','G3','B3'],7.1,.69),(40,['E3','A3','C#4'],3.1,.65),(44,['D3','F#3','A3'],3.1,.64),(48,['E3','G3','B3'],3.1,.66),(52,['D#3','F#3','A3'],3.2,.65),(56,['E3','G3','C#4'],6.4,.59)]
    for b,voicing,g,v in chords:
        for n in voicing:
            # Separate voicing tones must coexist; no common choke group.
            d=note('afterglow',b,n,g,v,a=.12,r=.32);d.pop('chokeGroup');ns['afterglow'].append(d)
    for b,n,g,v in [(24,'B3',3,.47),(28,'F#3',2.8,.5),(32,'E4',3,.47),(40,'E4',2.9,.43),(48,'B3',3,.48),(56,'E4',5.9,.4)]:add('specter',b,n,g,v,offset=1.2,a=.06,r=.22)
    for b,n,g,v in [(0,'E4',1.5,.7),(16,'A3',1,.45),(32,'E4',2,.77),(48,'B4',1,.51),(56,'E4',2.3,.74)]:add('chrome-strike',b,n,g,v,r=.18)
    # Four-beat source fragment ending at payoff, 32 beats = 13.714272 seconds.
    add('ascension',28,None,4,.73,offset=4.285716,a=.06,r=.015)
    add('convergence',32,'G1',1.8,.69,a=.001,r=.2)
    tracks=[]
    tracks.append(track('sub-hammer',ns['sub-hammer'],bars,gain=-2.8,description='Kick attack; gated before sub answers.'))
    for id,gain in [('backbeat',-5.5),('hats',-8.5)]:
        t={'id':id,'instrument':{'type':'drumkit','kit':'assets/v12-signature/kit.json'},'clips':[{'bar':1,'pattern':'score'}],'patterns':[{'id':'score','bars':bars,'notes':ns[id]}],'mix':{'gainDb':gain,'pan':0}}
        tracks.append(t)
    tracks.append(track('abyss',ns['abyss'],bars,gain=-3.5,description='Sole sustained sub owner; attacks follow kick releases.'))
    tracks.append(track('reactor',ns['reactor'],bars,gain=-9.5,effects=[{'type':'highpass','frequencyHz':120},{'type':'lowpass','frequencyHz':2900},{'type':'saturation','driveDb':3,'mix':.24}]))
    tracks.append(track('signal',ns['signal'],bars,gain=-2,pan=-.08,effects=[{'type':'highpass','frequencyHz':220},{'type':'delay','timeMs':160.714,'wet':.13},{'type':'reverb','roomSize':.36,'decaySeconds':.7,'wet':.1}]))
    tracks.append(track('phantom',ns['phantom'],bars,gain=-3,pan=.1,effects=[{'type':'highpass','frequencyHz':240},{'type':'reverb','roomSize':.52,'decaySeconds':1,'wet':.13}]))
    tracks.append(track('afterglow',ns['afterglow'],bars,gain=-13.5,effects=[{'type':'highpass','frequencyHz':180}]))
    tracks.append(track('specter',ns['specter'],bars,gain=-15,effects=[{'type':'highpass','frequencyHz':350},{'type':'reverb','roomSize':.65,'decaySeconds':1.3,'wet':.2}]))
    tracks.append(track('chrome-strike',ns['chrome-strike'],bars,gain=-11,effects=[{'type':'highpass','frequencyHz':250}]))
    tracks.append(track('ascension',ns['ascension'],bars,gain=-13,effects=[{'type':'highpass','frequencyHz':450}]))
    tracks.append(track('convergence',ns['convergence'],bars,gain=-9.5,effects=[{'type':'highpass','frequencyHz':100}]))
    p=proj('PARALLAX',bars,tracks)
    p['description']='A displaced fourth and falling reply. E Dorian, 140 BPM; half-time broken pulse, suspended vowel, physical return, minor-sixth resolution.'
    p['render']={'duration':{'seconds':28},'tail':'auto'}
    p['master']={'gainDb':-1.5,'effects':[{'type':'compressor','thresholdDb':-11,'ratio':1.7,'attackMs':18,'releaseMs':120,'makeupGainDb':1},{'type':'saturation','driveDb':1,'mix':.08}]}
    return p
write('entry-07.v1.json',make_v1())

def beat_at(n):
    z=n['start']; a,z=z.split(':'); bits=z.split('+'); b=int(bits[0]);f=Fraction(bits[1])*4 if len(bits)>1 else 0
    return float((int(a)-1)*4+b-1+f)
def notes(t):return t['patterns'][0]['notes']
def make_v2(p):
    p=json.loads(json.dumps(p));ts={t['id']:t for t in p['tracks']}
    # Preserve absolute melody events but return PHANTOM's low replies to SIGNAL.
    low=[];keep=[]
    for n in notes(ts['phantom']):
        b=beat_at(n)
        if 32<=b<48 and n['playbackRate']<.66742:
            pitch=76+round(12*math.log2(n['playbackRate']))
            d=note('signal',b,pitch,float(Fraction(n['gate'])*4),n['velocity'],r=.065)
            low.append(d)
        else:keep.append(n)
    ts['phantom']['patterns'][0]['notes']=keep
    notes(ts['signal']).extend(low)
    # More substantial formant bass answers, with E2/B1/A1 contour and longer gates.
    for n in notes(ts['reactor']):
        b=beat_at(n)
        n['offsetSeconds']=.38;n['gate']=frac(.55 if b%4<2 else .45)
        if 32<=b<56:n['velocity']=min(1,n['velocity']+.1)
    ts['reactor']['mix']['gainDb']=-7.5
    # A two-note bass response in the answer's gap, then release into the next kick.
    for b,pitch in [(38.85,'B1'),(46.85,'A1'),(54.85,'F#2')]:
        notes(ts['reactor']).append(note('reactor',b,pitch,.45,.62,offset=.38,r=.035))
    # The approach's last leading tone is clipped; the riser breathes before impact.
    for n in notes(ts['phantom']):
        if beat_at(n)==30.5:n['gate']=frac(.5);n['envelope']['releaseSeconds']=.06
    for n in notes(ts['afterglow']):
        if beat_at(n)==28:n['gate']=frac(2.7);n['envelope']['releaseSeconds']=.18
    for n in notes(ts['ascension']):
        n['gate']=frac(3.5);n['envelope']['releaseSeconds']=.035
        # Preserve the rising end of the source, moving it earlier by half a beat.
        n['offsetSeconds']=4.499999
    for n in notes(ts['specter']):
        if beat_at(n)==28:n['gate']=frac(2.4);n['envelope']['releaseSeconds']=.1
    return p
write('entry-07.v2.json',make_v2(make_v1()))

def make_v3(p):
    p=json.loads(json.dumps(p));ts={t['id']:t for t in p['tracks']}
    # V2 accidentally kept the old REACTOR pitches beneath its new same-frame
    # answers. Same-frame choke-group voices coexist: retain the directed answer.
    rnotes=notes(ts['reactor']);last={}
    for n in rnotes:last[n['start']]=n
    ts['reactor']['patterns'][0]['notes']=list(last.values())
    # Dismantle the second groove phrase before the suspension rather than
    # repeating a complete drum/bass bar and abruptly removing it at bar 7.
    for id in ['sub-hammer','abyss','hats','reactor']:
        ns=notes(ts[id]);ts[id]['patterns'][0]['notes']=[n for n in ns if not 22.7<=beat_at(n)<24]
    for n in notes(ts['abyss']):
        if 21.8<beat_at(n)<22.1:n['gate']=frac(.6)
    # The final lower-octave answer gets a clear held centre and an intact tail.
    for n in notes(ts['signal']):
        if beat_at(n)==62:n['gate']=frac(.9);n['envelope']['releaseSeconds']=.16
    return p
write('entry-07.v3.json',make_v3(make_v2(make_v1())))

def make_risk(p):
    p=json.loads(json.dumps(p));ts={t['id']:t for t in p['tracks']}
    # One decision: delayed physical arrival underneath the intact melodic pickup.
    for id in ['sub-hammer','backbeat','chrome-strike','convergence']:
        keep=[]
        for n in notes(ts[id]):
            b=beat_at(n)
            if id=='sub-hammer' and b==32.75:continue
            if b==32:n['start']=pos(32.5)
            keep.append(n)
        ts[id]['patterns'][0]['notes']=keep
    keep=[]
    for n in notes(ts['abyss']):
        b=beat_at(n)
        if abs(b-33.15)<.002:continue
        if abs(b-32.4)<.002:n['start']=pos(32.9);n['gate']=frac(.4)
        keep.append(n)
    ts['abyss']['patterns'][0]['notes']=keep
    # Remove only the hat on the withheld downbeat; the next swung offbeat stays.
    ts['hats']['patterns'][0]['notes']=[n for n in notes(ts['hats']) if beat_at(n)!=32]
    return p
write('entry-07.v4-risk.json',make_risk(make_v3(make_v2(make_v1()))))
