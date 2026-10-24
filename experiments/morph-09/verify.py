#!/usr/bin/env python3
"""Verify source fidelity, event display quantization and the physical loop seam.

This audits MORPH09's presentation state; it does not regenerate approved music.
Run from repository root: python3 experiments/morph-09/verify.py
Optional --proof FILE.mov checks the rendered 60fps proof and lossless PCM audio.
"""
from __future__ import annotations
import argparse,csv,hashlib,json,math,os,subprocess,wave
from pathlib import Path
import numpy as np
import state as motion

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
SR=44100
FPS=60
STRIDE=735
DURATION=8.0


def digest(path:Path):return hashlib.sha256(path.read_bytes()).hexdigest()
def flat(value,prefix=''):
    if isinstance(value,dict):
        out={}
        for k,v in value.items():out.update(flat(v,prefix+'.'+k if prefix else k))
        return out
    if isinstance(value,list):
        out={}
        for i,v in enumerate(value):out.update(flat(v,f'{prefix}[{i}]'))
        return out
    return {prefix:float(value)}

def make_timeline(out:Path):
    os.environ.setdefault("MPLCONFIGDIR",str(out/".matplotlib-cache"))
    os.environ.setdefault("XDG_CACHE_HOME",str(out/".font-cache"))
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib.ticker import MultipleLocator
    t=np.arange(0,480)/60
    speed=[motion.rotor(float(x))[1] for x in t]
    colors=['#bb8051','#e0b47a','#59bdad','#c4dbe9','#8095c8','#d8c892']
    fig=plt.figure(figsize=(16,9.5),facecolor='#f4f4ef')
    gs=fig.add_gridspec(2,1,height_ratios=[1.0,1.7],hspace=.32,left=.115,right=.97,top=.86,bottom=.12)
    ax=fig.add_subplot(gs[0]); lanes=fig.add_subplot(gs[1],sharex=ax)
    for a in [ax,lanes]:
        a.set_facecolor('#f4f4ef');a.spines[['top','right']].set_visible(False);a.spines[['left','bottom']].set_color('#c9cecb')
        a.tick_params(colors='#344448',labelsize=10);a.xaxis.set_major_locator(MultipleLocator(.5));a.grid(axis='x',color='#dee2de',linewidth=.7);a.set_xlim(0,8)
    ax.plot(t,speed,color='#245e60',lw=2);ax.set_ylabel('Rotor speed / rev·s⁻¹',color='#344448',fontsize=11)
    ax.set_ylim(0,60)
    ax.text(.015,.89,'ACTUAL TELEMETRY · 60 samples / second',transform=ax.transAxes,color='#245e60',fontsize=10)
    rows=[('Motor contacts',['commutator']),('Percussion',['kick','clap','hat']),('Bass accents',['bass']),('Sung melody',['vox']),('Harmony',['harmony']),('Final pitch lock',['voice'])]
    lane_markers={'kick':'|','clap':'D','hat':'.'}
    for y,(label,tracks) in enumerate(rows):
        for tr in tracks:
            ev=motion.TRACKS[tr];times=[e['sampleFrame']/SR for e in ev]
            sizes=[45+80*e['velocity'] for e in ev] if tr not in ['hat','kick'] else [70]*len(ev)
            lanes.scatter(times,[y]*len(ev),s=sizes,c=colors[y],marker=lane_markers.get(tr,'o'),alpha=.9,linewidths=1.8,label=tr,zorder=4)
        lanes.axhline(y,color='#d8ded8',lw=.65,zorder=1)
    lanes.set_yticks(range(len(rows)),[r[0] for r in rows]);lanes.invert_yaxis();lanes.set_xlabel('Authoritative source time / seconds',fontsize=11,color='#344448',labelpad=12)
    transitions=[('Fusion',6.2352607709750565),('55 Hz lock',6.49907029478458),('Brake',6.76265306122449),('Return',7.0)]
    for j,(name,x) in enumerate(transitions):
        ax.axvline(x,color='#87918d',lw=.8,ls='--');lanes.axvline(x,color='#87918d',lw=.8,ls='--')
        ax.annotate(name,xy=(x,54 if j!=0 else 4),xytext=(x+(.11 if j%2 else -.12),64+j%2*7),ha='center',fontsize=9,color='#344448',arrowprops={'arrowstyle':'-','lw':.7,'color':'#87918d'})
    for x,name in [(0,'ESTABLISH'),(2,'HARMONIC VARIATION'),(4,'HEAVY'),(6,'SING / BRAKE / RETURN')]:
        lanes.axvspan(x,x+2,facecolor='#245e60',alpha=.035 if x%4==0 else .0,zorder=0)
        fig.text(.115+(x+.13)/8*.855,.055,name,fontsize=9,fontweight='bold',color='#245e60')
    fig.text(.115,.944,'MORPH // 09',fontsize=12,fontweight='bold',color='#245e60')
    fig.text(.115,.905,'OVERTONE — evidence of musical causality',fontsize=22,color='#243c40')
    fig.text(.115,.018,'205 authoritative events · 480 proof frames · no music retiming · source pitch arrival at 6.499070 s',fontsize=10,color='#52615f')
    fig.savefig(out/'sync-timeline.png',dpi=140,facecolor=fig.get_facecolor());plt.close(fig)


def audit_media(path:Path):
    p=subprocess.run(['ffprobe','-v','error','-count_frames','-show_streams','-show_format','-of','json',str(path)],check=True,capture_output=True)
    metadata=json.loads(p.stdout)
    v=next(x for x in metadata['streams'] if x['codec_type']=='video');a=next(x for x in metadata['streams'] if x['codec_type']=='audio')
    source=ROOT/'experiments/morph-08/candidates/overtone.wav'
    with wave.open(str(source),'rb') as w:approved=w.readframes(w.getnframes())
    decoded=subprocess.run(['ffmpeg','-v','error','-i',str(path),'-map','0:a:0','-f','s16le','-acodec','pcm_s16le','-'],capture_output=True,check=True).stdout
    report={'path':str(path),'durationSeconds':float(metadata['format']['duration']),'videoCodec':v['codec_name'],'dimensions':[v['width'],v['height']],'videoFrameRate':v['r_frame_rate'],'videoFrames':int(v['nb_read_frames']),'audioCodec':a['codec_name'],'audioRate':int(a['sample_rate']),'audioChannels':a['channels'],'decodedPcmBytes':len(decoded),'approvedPcmSha256':hashlib.sha256(approved).hexdigest(),'decodedPcmSha256':hashlib.sha256(decoded).hexdigest(),'decodedPcmExactlyEqualsApproved':decoded==approved}
    assert report['videoFrames']==480 and report['videoFrameRate']=='60/1'
    assert abs(report['durationSeconds']-8)<1e-6
    assert report['audioRate']==44100 and report['audioChannels']==2
    if a['codec_name'].startswith('pcm_'):assert report['decodedPcmExactlyEqualsApproved']
    return report


def main():
    p=argparse.ArgumentParser();p.add_argument('--out',default='work/morph-09');p.add_argument('--proof',type=Path);args=p.parse_args()
    out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    rows=[];contact_errors=[]
    for e in motion.EVENTS:
        n=e['sampleFrame'];frame=(n+STRIDE-1)//STRIDE;time=n/SR
        row={'track':e['trackId'],'eventId':e['eventId'],'roles':'|'.join(e['visualRoles']),'sampleFrame':n,'sourceTimeSeconds':time,'sourceMapPictureFrameFloor':e['pictureFrame'],'firstVisibleProofFrame':frame,'firstVisibleTimeSeconds':frame/FPS,'displayQuantizationMilliseconds':(frame*STRIDE-n)/SR*1000,'contactAlignmentErrorDegrees':''}
        if e['trackId']=='commutator':
            expected=e['source']['revolution']+e['source']['step']/16
            residual=(motion.rotor(time)[0]-expected)*360
            row['contactAlignmentErrorDegrees']=residual;contact_errors.append(residual)
        assert 0 <= frame*STRIDE-n < STRIDE
        assert 0<=frame<480
        rows.append(row)
    with (out/'sync-audit.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=rows[0],lineterminator='\n');w.writeheader();w.writerows(rows)
    ae=max(abs(motion.rotor(i/FPS)[0]-a) for i,a in enumerate(motion.COL['angle']))
    ve=max(abs(motion.rotor(i/FPS)[1]-v) for i,v in enumerate(motion.COL['speed']))
    assert ae<1e-12 and ve<1e-12
    assert max(map(abs,contact_errors))<.02
    epsilon=1e-8
    first=flat(motion.state(0));left=flat(motion.state(8-epsilon));wrapped=flat(motion.state(8))
    # Exclude raw rotor and time. Modulo state(8) equality alone proves no physical closure.
    nonrotor=[k for k in first if k not in ['t','angle','speed']]
    deltas={k:left[k]-first[k] for k in nonrotor}
    same_cycle={k:wrapped[k]-first[k] for k in nonrotor}
    assert max(map(abs,deltas.values()))<2e-6
    assert max(map(abs,same_cycle.values()))==0
    a0,v0=motion.rotor(0);a8,v8=motion.rotor(8)
    travel=a8-a0;deg=(travel-round(travel))*360
    source_audit=json.loads((HERE/'source-audit.json').read_text())
    hashes=source_audit['hashes'];actual_hashes={k:digest(ROOT/k) for k in hashes}
    assert actual_hashes==hashes
    delays=[r['displayQuantizationMilliseconds'] for r in rows]
    report={
        'kind':'morph09-state-and-render-audit','sourceCommit':source_audit['sourceCommit'],
        'scope':'Visual state, interpolation, event presentation, loop boundary; no engine or approved music changes.',
        'sourceFidelity':{'sha256MatchesSourceAudit':actual_hashes==hashes,'hashes':actual_hashes,'telemetrySamplesPreserved':480,'maximumAngleSampleErrorRevolutions':ae,'maximumSpeedSampleErrorRevPerSecond':ve,'interpolation':'Cubic Hermite in unwrapped revolutions using source endpoint velocities; exact derived mechanics endpoint used only on last interval.'},
        'events':{'count':len(rows),'trackCounts':source_audit['events']['trackCounts'],'displayPolicy':'Earliest eligible presentation frame for each source event is ceil(n/735). This is timing quantization, not a per-pixel visibility test; form, rotor, regime and duplicated chassis events describe the mechanism rather than each having a separate impulse. Direct envelopes use the authoritative sampleFrame. The event-map floor pictureFrame never triggers an event early. Previous-cycle response tails remain visible at the opening.','minimumDisplayDelayMs':min(delays),'meanDisplayDelayMs':sum(delays)/len(delays),'maximumDisplayDelayMs':max(delays),'displayDelayBoundMs':1000/FPS,'maximumCommutatorAngularErrorDegrees':max(map(abs,contact_errors)),'commutatorContactsChecked':len(contact_errors),'dedicatedPitchLock':next(r for r in rows if r['track']=='voice')},
        'loop':{'warning':'state(8) wraps to state(0) by definition; it is NOT evidence that raw physical telemetry closes exactly. The unwrapped rotor function is measured independently below.','rawRenderedRotor':{'beginningRevolutions':a0,'endpointRevolutions':a8,'travelRevolutions':travel,'orientationResidualDegrees':deg,'beginningSpeedRevPerSecond':v0,'endpointSpeedRevPerSecond':v8,'speedResidualRevPerSecond':v8-v0,'physicalEndpointExactlyMatchesOpening':False,'conservativeProjectedSeamResidualPixels':2.45*abs(math.radians(deg))*480/11.65,'projectionAssumptions':{'maximumRotorRadiusSceneUnits':2.45,'orthographicVerticalSpanSceneUnits':11.65,'proofVerticalPixels':480,'formula':'radius × abs(radians(orientationResidualDegrees)) × proofVerticalPixels / orthographicVerticalSpanSceneUnits','note':'Geometric upper bound on rotor edge displacement only. Camera tilt can reduce projection. Antialiasing and lighting differences are not bounded by this number.'},'renderNote':'Sixteen identical contacts and spokes have no unique angular marker. No angle correction or time retiming is applied.'},'fullPrecisionSourceMechanics':source_audit['seam'],'periodicLightingAndVibration':{'testEpsilonSeconds':epsilon,'largestLeftLimitStateDifference':max(map(abs,deltas.values())),'largestWrappedStateDifference':max(map(abs,same_cycle.values())),'leftLimitDifferenceByChannel':deltas,'openingBrushEmissionEnvelope':motion.state(0)['brush'],'openingResonatorEnvelopes':motion.state(0)['tines'],'openingVocalEnvelope':motion.state(0)['vox'],'openingBassEnvelope':motion.state(0)['bass'],'noBlackout':True,'method':'Deterministic modulo-eight event ages include previous-cycle tails; harmony is Am7 on both sides of the seam. Epsilon test approaches physical end before the modulo reset.'}},
        'checksPassed':['Approved audio/event map/telemetry hashes unchanged','All 480 source angle and speed samples preserved','All 205 event first-visible times quantified without early triggering','All 52 contact impact angles agree within 0.02 degree','Lighting, clamps and vibration close within 2e-6 at epsilon=1e-8','Raw source rotor residual measured independently and disclosed']}
    if args.proof:report['renderedProof']=audit_media(args.proof)
    (out/'loop-audit.json').write_text(json.dumps(report,indent=2)+'\n')
    make_timeline(out)
    print(json.dumps({'checksPassed':report['checksPassed'],'maxDisplayDelayMs':max(delays),'maxContactAngularErrorDeg':max(map(abs,contact_errors)),'physicalSeamResidualDeg':deg,'lightingVibrationEpsilonError':max(map(abs,deltas.values())),'outputs':['sync-audit.csv','loop-audit.json','sync-timeline.png']},indent=2))

if __name__=='__main__':main()
