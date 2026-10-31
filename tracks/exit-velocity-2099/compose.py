#!/usr/bin/env python3
"""Compose three sketches, three full revisions, a risk test and a MIDI map.
Outputs native DaemonV12 projects adjacent to generated assets; no engine patches.
"""
from pathlib import Path
from fractions import Fraction
import json, math, struct

HERE=Path(__file__).resolve().parent
B=3840

def at(t):
    t=int(t); bar=t//B+1; p=t%B; beat=p//960+1; r=p%960
    if not r: return f'{bar}:{beat}'
    q=Fraction(r,3840)
    return f'{bar}:{beat}+{q.numerator}/{q.denominator}'

def rate(semitones): return round(2**(semitones/12),6)

def make_track(ident, source, gain, pan=0, effects=None, desc=''):
    inst={'type':'drumkit','kit':'assets/kit.json'} if source=='kit' else {'type':'sampler','sample':f'assets/{source}.wav'}
    d={'id':ident,'description':desc,'instrument':inst,'mix':{'gainDb':gain,'pan':pan},'clips':[{'bar':1,'pattern':'all'}],'patterns':[{'id':'all','bars':32,'notes':[]}]}
    if effects: d['effects']=effects
    return d

def compose(which, bars=32):
    ver=which if which in ('v1','v2','v3','risk') else 'v3'
    sketch=which.startswith('sketch-')
    concept=which[-1] if sketch else 'a'
    tracks={}
    def add(i,src,g,pan=0,effects=None,desc=''):
        tracks[i]=make_track(i,src,g,pan,effects,desc)
        tracks[i]['patterns'][0]['bars']=bars
    add('kick','kit',-4.8,desc='Short low punch; first transient has priority over the delayed sub.')
    add('clap','kit',-6.2,0.03,desc='Late halftime clap; occasional ghost slaps mark four-bar turns.')
    add('hats','kit',-11.2,.16,desc='Humanized eighths, selected gaps and a few short rolls.')
    add('rim','kit',-12.0,-.27,desc='Dry, syncopated rim answers: a nod to West Coast bounce.')
    add('chrome','kit',-14.2,.30,desc='Sparse metallic punctuation on phrase boundaries.')
    add('sub','sub-f1',-8.4,desc='Clean, gated F1 bass foundation; leaves a pocket for kick.')
    add('talk','talk-f2',-8.4,-.04,[{'type':'highpass','frequencyHz':105}],desc='Vowel-swept F2 bass; punctuates the kick, not constant wobble.')
    add('lead','whistle-f5',-8.1,.02,[{'type':'delay','timeMs':215,'wet':0.12}],desc='Bent F5 whistle motif announced at frame zero.')
    add('answer','answer-f4',-13.0,-.35,[{'type':'delay','timeMs':107,'wet':0.13}],desc='Warm midrange response in the gaps, not a unison lead layer.')
    add('haze','haze-f3',-18.8,.04,[{'type':'highpass','frequencyHz':200}],desc='Wide, sparse 7th chords supply skyline without masking the bass.')
    add('motor','motor-fall',-15.0,.24,desc='Short falling motor gesture announces section turns.')
    # V1 analysis: the prominent lead stem measured -18.35 LUFS, while the
    # talk bass measured -31.31 LUFS and hats -40.71 LUFS. These readings do
    # not prove a balance problem, but motivated this bounded V3 rebalance.
    if ver in ('v3','risk'):
        for tr,gain in {'lead':-10.0,'talk':-5.4,'hats':-7.2,'rim':-8.8,'chrome':-11.2,'answer':-10.5,'haze':-16.8,'motor':-12.5}.items():
            tracks[tr]['mix']['gainDb']=gain
        if not sketch:
            add('orbit','answer-f4',-11.5,.68,[{'type':'delay','timeMs':160,'wet':0.14}],desc='Distinct right-side midrange counterphrase opens the payoff without widening the low end.')
    midi={k:[] for k in tracks}
    def note(track, bar, tick, velocity, pitch=None, semi=0, gate=None, group=None, glide=None):
        if bar < 1 or bar>bars: return
        abs_tick=(bar-1)*B+tick
        if abs_tick<0 or abs_tick>=bars*B: return
        n={'start':at(abs_tick),'velocity':round(velocity,3)}
        if pitch is not None: n['pitch']=pitch
        if semi: n['playbackRate']=rate(semi)
        if gate:
            n['gate']=gate
            n['envelope']={'attackSeconds':0.002,'releaseSeconds':0.035 if track in ('lead','answer','haze') else 0.025}
        if group: n['chokeGroup']=group
        if glide: n['glide']={'to':round(rate(glide[0]),6),'duration':glide[1]}
        tracks[track]['patterns'][0]['notes'].append(n)
        # The MIDI is an explicitly labeled, approximate note-level map.
        base={'sub':29,'talk':41,'lead':77,'answer':65,'haze':53,'motor':84,'orbit':65}
        kit={'kick':36,'clap':39,'hat':42,'rim':37,'open-hat':46,'shaker':70,'chrome':56}
        p=kit.get(pitch,base.get(track,60)+semi)
        dur=240 if gate is None else int(Fraction(gate)*3840)
        midi[track].append((abs_tick,p,dur,round(velocity*127)))
    def d(track,b,t,v,p): note(track,b,t,v,pitch=p)
    # Root movements: Fm9, Dbmaj7, Abmaj7, Eb6. Registral choices keep the sub readable.
    roots=[0,0,0,0, 0,0,0,0, 8,8,-2,-2, 0,0,8,-2, 0,0,0,0, 8,8,-2,-2, 0,0,8,-2, 0,0,0,0]
    chords=[[0,3,7,10],[8,12,15,19],[3,7,10,15],[-2,2,5,10]]
    # Each concept employs a distinct lead phrase, rhythms and level of space.
    motifs={
      'a':[(0,0,.92,'1/8'),(480,-2,.72,'1/16'),(1080,-5,.86,'1/8'),(1920,-9,.84,'1/8'),(3120,-5,.75,'1/16')],
      'b':[(0,-12,.94,'1/8'),(720,-5,.76,'1/16'),(1200,-7,.86,'1/8'),(2160,-9,.86,'1/16'),(2760,-5,.78,'1/8'),(3480,0,.67,'1/16')],
      'c':[(0,-5,.85,'1/4'),(1440,-9,.72,'1/8'),(2520,0,.90,'1/8'),(3240,-2,.68,'1/16')]
    }
    # Phrase map uses two-bar question/answer and transformed return.
    for bar in range(1,bars+1):
        root=roots[(bar-1)%len(roots)]
        intro=bar<=4
        breakdown=13<=bar<=16
        outro=bar>=29
        payoff=17<=bar<=24
        # V1 is a complete opening-to-ending draft. V2 opens breathing room at the
        # break and turns the payoff into a rhythmic return; V3 adds sparse responses.
        sparse=(ver in ('v2','v3','risk') and breakdown)
        # Hook A is the chosen signature. V1 carries its phrase too often; later
        # drafts vary and subtract it to leave more response space.
        emit_hook = bar in (1,2,3,4,5,7,9,11,13,15,17,18,19,20,21,23,25,27,29,30,31,32)
        if ver=='v1': emit_hook = bar not in (8,16,24,28)
        if sparse and bar in (13,15): emit_hook=(bar==13)
        if sketch: emit_hook=True
        # Intentional last-bar closing quote leaves one-beat breathing room.
        if emit_hook:
            events=motifs[concept][:]
            if bar%2==0:
                events=[(0,0,.85,'1/8'),(720,-5,.70,'1/16'),(1440,-2,.72,'1/8'),(2400,-5,.82,'1/8')]
                if concept=='b': events=[(0,-9,.85,'1/8'),(840,-5,.73,'1/16'),(1680,-12,.85,'1/8'),(2760,-2,.78,'1/8')]
                if concept=='c': events=[(240,-2,.8,'1/8'),(1200,-5,.75,'1/4'),(2760,-9,.78,'1/8')]
            if bar in (9,11,21,23):
                events=[(x,s+(12 if j==0 else 0),v*.91,g) for j,(x,s,v,g) in enumerate(events)]
            if bar==32 and not sketch:
                events=[(0,0,.80,'1/8'),(480,-2,.63,'1/16'),(1080,-5,.72,'1/8'),(3000,-9,.62,'1/8')]
                if ver in ('v3','risk'):
                    # Final F5 answers the opening and naturally decays through
                    # the explicit tail rather than leaving 1+ s of dead air.
                    events=[(0,0,.80,'1/8'),(480,-2,.63,'1/16'),(1920,-5,.67,'1/8'),(3600,0,.62,'1/2')]
            for idx,(t,semi,v,g) in enumerate(events):
                # Use a slightly bent leading note in select phrases.
                gl=(semi+1,'1/16') if idx==0 and bar in (1,17) else None
                note('lead',bar,t,v,semi=semi,gate=g,group='lead',glide=gl)
        # Distinct musical risk: erase the expected first downbeat of payoff and
        # let the same motif re-enter on the following eighth note.
        if which=='risk' and bar==17:
            # Risk: leave the expected downbeat whistle silent; re-enter on the
            # eighth. Remove the original second pitch to avoid an accidental chord.
            start=(17-1)*B
            notes=tracks['lead']['patterns'][0]['notes']
            notes[:]=[n for n in notes if n['start']!=at(start+480)]
            for n in notes:
                if n['start']==at(start): n['start']=at(start+480)
            midi['lead']=[((t+480) if t==start else t,p,dur,vel) for t,p,dur,vel in midi['lead'] if t!=start+480]
        # Downbeat rhythms vary over four-bar cycles; only a few quick kicks.
        if concept=='b' and sketch:
            ks=[[0,1440,3120],[0,1680,2640],[0,1200,3000],[0,2280,3360]][(bar-1)%4]
        else:
            ks=[[0,1440,3000],[0,1680,2640],[0,1200,3120],[0,2040,3240]][(bar-1)%4]
        if sparse:
            ks=[] if bar in (14,16) else [0]
        if outro and bar==32: ks=[0,1680]
        if which=='risk' and bar==17: ks=[x for x in ks if x!=0]
        for j,t in enumerate(ks): d('kick',bar,t,[.91,.66,.72][j%3],'kick')
        # Stable and slightly late halftime clap, ghosted at a handful of turns.
        if not (sparse and bar in (14,16)):
            d('clap',bar,1960,.82 if not intro else .72,'clap')
        if bar%4==0 and bar not in (16,32):
            d('clap',bar,3540,.27,'clap')
        # A little delayed, accented eighth-note hat swing with deterministic offset.
        if not (sparse and bar in (14,16)):
            ts=list(range(0,3840,480))
            if bar%4==0: ts=[t for t in ts if t not in (2400,)]
            if intro and bar==1: ts=[480,1440,2400,3360]
            if sketch and concept=='c': ts=[480,1440,2400,3360]
            for j,t in enumerate(ts):
                swing=40 if j%2 else 0
                v=[.38,.23,.30,.24,.35,.22,.29,.25][j%8]*(1.12 if payoff else 1)
                d('hats',bar,min(t+swing,3800),v,'hat')
            if bar%4==0 and bar not in (16,32):
                for j,t in enumerate((3360,3480,3600,3720)):
                    d('hats',bar,t,.22+j*.035,'hat')
            if bar%2==0: d('hats',bar,2830,.25,'open-hat')
        # Rims float against the claps, with true rests.
        if bar>=3 and not (sparse and bar in (14,16)):
            for t in ([1020,2880] if bar%2 else [1320,3240]): d('rim',bar,t,.36 if t<2000 else .29,'rim')
            if bar%4==3: d('rim',bar,3460,.2,'shaker')
        if bar in (4,8,12,16,20,24,28,32):
            d('chrome',bar,2880,.46,'chrome')
        # Bass follows roots and is deliberately separated from kick transients.
        if bar>=2 and not (sparse and bar in (14,16)):
            bass=[(260,root,.82,'1/8'),(2260,root,.70,'1/8')]
            if bar%2==0: bass=[(260,root,.80,'1/8'),(2040,root,.72,'1/16'),(2860,root,.62,'1/16')]
            if sparse: bass=[(260,root,.57,'1/8')]
            if outro and bar==32: bass=[(260,root,.66,'1/8')]
            for t,s,v,g in bass: note('sub',bar,t,v,semi=s,gate=g,group='sub')
            if not intro or bar in (3,4):
                for t,s,v,g in [(720,root,.67,'1/16'),(2760,root+(3 if bar%4==3 else 0),.62,'1/8')]:
                    if sparse and t==720: continue
                    note('talk',bar,t,v*(1.08 if payoff else 1),semi=s,gate=g,group='talk')
        # Chords enter late; actual chord voicings are individual pitches at one time.
        if bar in (5,9,11,13,15,17,21,23,25,27,29):
            ci=0 if bar in (5,13,17,25,29) else 1 if bar in (9,15,21,27) else 3
            for s in chords[ci]: note('haze',bar,0,.38,semi=s,gate='3/4')
        # V2: turn around the phrase instead of filling it with more lead.
        # V3: introduce a contrasting soft mid-register answer at clear gaps.
        if ver in ('v2','v3','risk') and bar in (6,10,14,18,22,26,30):
            for t,s,v in [(240,-5,.53),(960,-2,.48),(2760,0,.50)]:
                note('answer',bar,t,v,semi=s,gate='1/8',group='answer')
        if ver in ('v3','risk') and bar in (8,12,20,24,28):
            for t,s,v in [(2400,-5,.48),(3000,-2,.44)]:
                note('answer',bar,t,v,semi=s,gate='1/16',group='answer')
        if 'orbit' in tracks and bar in (17,19,21,23):
            # Different from the left answer: two notes in the lead's gaps.
            for t,s,v in [(1440,3,.46),(2640,7,.43)]:
                note('orbit',bar,t,v,semi=s,gate='1/8',group='orbit')
        if bar in (8,16,24,28): note('motor',bar,3120,.50)
    # V3 supports the payoff with a distinct counterphrase and a more
    # forward talking-bass balance; V2 first introduced the breakdown.
    project={'formatVersion':1,'title':'EXIT VELOCITY // 2099' + (f' - {which.upper()}' if which!='v3' else ''),
      'description':'140 BPM F minor. A lowrider whistle and talking bass turn an asymmetric two-bar signal into a late-night payoff.',
      'bpm':140,'timeSignature':'4/4','key':'F minor','bars':bars,'seed':2099,
      'render':{'duration':{'seconds':56 if bars==32 else round(bars*4*60/140+0.6,6)},'tail':'auto'},
      'master':{'gainDb':-3},'tracks':list(tracks.values())}
    return project,midi

def varint(n):
    v=[n&127]; n >>=7
    while n: v.append((n&127)|128); n>>=7
    return bytes(reversed(v))

def midi_file(path, mid):
    # SMF type 1 at 960 PPQ. It is a note-level map, not the native sampler render.
    out=[]
    def track(events,end=125440):
        events=sorted(events,key=lambda e:(e[0],e[1]))
        buf=bytearray(); prev=0
        for tick,order,raw in events:
            buf+=varint(tick-prev)+raw; prev=tick
        buf+=varint(max(0,end-prev))+b'\xff\x2f\x00'
        return b'MTrk'+struct.pack('>I',len(buf))+buf
    name=b'EXIT VELOCITY // 2099 - approximate MIDI reconstruction'
    out.append(track([(0,0,b'\xff\x03'+varint(len(name))+name),(0,0,b'\xff\x51\x03'+int(428571).to_bytes(3,'big')),(0,0,b'\xff\x58\x04\x04\x02\x18\x08')]))
    channels={'kick':9,'clap':9,'hats':9,'rim':9,'chrome':9,'sub':0,'talk':1,'lead':2,'answer':3,'haze':4,'motor':5,'orbit':6}
    programs={'sub':38,'talk':39,'lead':80,'answer':81,'haze':89,'motor':81,'orbit':81}
    for name,ns in mid.items():
        ch=channels[name]; bs=name.encode()
        ev=[(0,0,b'\xff\x03'+varint(len(bs))+bs)]
        if name in programs: ev.append((0,0,bytes([0xc0|ch,programs[name]])))
        for t,p,d,v in ns:
            ev.extend([(t,2,bytes([0x90|ch,p,v])),(min(t+d,125440),1,bytes([0x80|ch,p,0]))])
        out.append(track(ev))
    path.write_bytes(b'MThd'+struct.pack('>IHHH',6,1,len(out),960)+b''.join(out))

for which in ['sketch-a','sketch-b','sketch-c','v1','v2','v3','risk']:
    project,mid=compose(which,8 if which.startswith('sketch-') else 32)
    (HERE/(which+'.json')).write_text(json.dumps(project,indent=2)+'\n')
    if which=='v3': midi_file(HERE/'exit-velocity-2099-note-map.mid',mid)
print('Generated 3 sketches, 3 complete revisions, one risk candidate, and a separate approximate MIDI map.')
