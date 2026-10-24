"""Sample-accurate event envelopes and unwrapped MORPH07 telemetry. No audio DSP."""
import json, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'experiments'
MAP=json.loads((SOURCE/'morph-08/candidates/overtone.events.json').read_text())
COL=json.loads((SOURCE/'morph-07/candidates/hypnotic-motor.telemetry.json').read_text())['columns']
END=json.loads((Path(__file__).parent/'endpoint.json').read_text())
EVENTS=MAP['events']; SR=MAP['sampleRate']; TAU=math.tau
TRACKS={k:[e for e in EVENTS if e['trackId']==k] for k in {e['trackId'] for e in EVENTS}}
def rotor(t):
    # Preserve every source angle. Evaluate the true endpoint only for seam measurements.
    t=max(0.,min(8.,t)); u=t*60; i=min(479,int(u)); f=u-i
    a=COL['angle'][i]; b=COL['angle'][i+1] if i<479 else END['angle']
    v=COL['speed'][i]; w=COL['speed'][i+1] if i<479 else END['speed']
    ang=(2*f**3-3*f*f+1)*a+(f**3-2*f*f+f)*v/60+(-2*f**3+3*f*f)*b+(f**3-f*f)*w/60
    speed=((6*f*f-6*f)*a+(3*f*f-4*f+1)*v/60+(-6*f*f+6*f)*b+(3*f*f-2*f)*w/60)*60
    return ang,speed

def response(track,t,decay=.12,selector=lambda e:True,osc=0):
    out=0.
    for e in TRACKS.get(track,[]):
        if not selector(e):continue
        age=(t-e['sampleFrame']/SR)%8
        if age>decay*12:continue
        # previous-cycle tails are part of the opening state
        val=e.get('velocity',1)*math.exp(-age/decay)
        if osc:val*=math.sin(TAU*osc*age)
        out+=val
    return out

def smooth(x):
    x=max(0.,min(1.,x));return x*x*(3-2*x)

def gear_at(t):
    # Clamps glide according to the authoritative harmony event's glideMs.
    ev=TRACKS['harmony']; cur=ev[-1]
    for e in ev:
        if e['sampleFrame']/SR<=t:cur=e
    idx=ev.index(cur); prev=ev[idx-1]
    mix=smooth((t-cur['sampleFrame']/SR)/(cur['source']['glideMs']/1000))
    return [a+(b-a)*mix for a,b in zip(prev['source']['tineHz'],cur['source']['tineHz'])]

def state(t):
    t=t%8; a,v=rotor(t)
    locktime=TRACKS['voice'][0]['sampleFrame']/SR
    brake=next(e['sampleFrame']/SR for e in TRACKS['drive'] if e['eventId']=='brake')
    lock=smooth((t-locktime)/.045)*(1-smooth((t-brake)/.20))
    return dict(t=t,angle=a,speed=v,blur=smooth((abs(v)-1.4)/5),
      brush=response('commutator',t,.045),kick=response('kick',t,.11),
      clap=response('clap',t,.065),hat=response('hat',t,.035),
      bass=response('bass',t,.24),vox=response('vox',t,.31),
      vox_note=sum(response('vox',t,.31,lambda e:e['source'].get('note')==n)*j for j,n in enumerate(['A3','B3','C4','D4','E4','F4','G#3']))/max(.001,response('vox',t,.31)),
      load=COL['load'][min(479,int(t*60))],lock=lock,clamps=gear_at(t),
      tines=[response('tines',t,.20,lambda e:e['source'].get('tine')==i) for i in range(5)],
      flex=[sum(e['velocity']*math.exp(-((t-e['sampleFrame']/SR)%8)/.16)*math.sin(TAU*e['source']['hz']*((t-e['sampleFrame']/SR)%8)) for e in TRACKS['tines'] if e['source']['tine']==i) for i in range(5)])
