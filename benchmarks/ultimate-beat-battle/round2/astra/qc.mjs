#!/usr/bin/env node
// Read-only listening proxies for this record; no quality score or loudness target.
// Usage: node qc.mjs RENDER_DIR_OR_MASTER_WAV PROJECT_JSON [REPORT_JSON] [BASENAME]
import {readFileSync, writeFileSync, readdirSync, existsSync, mkdtempSync, rmSync} from 'node:fs';
import {resolve, dirname, join, basename, extname} from 'node:path';
import {tmpdir} from 'node:os';
import {inspect} from '../../../../scripts/inspect-orbital-foundry.ts';
import {decodePcm, encodePcm} from '../../../../src/render/pcm.ts';

const RATE=44100;
const [renderArg, projectArg, reportArg, nameArg]=process.argv.slice(2);
if(!renderArg || !projectArg)throw new Error('Usage: node qc.mjs RENDER_DIR_OR_MASTER_WAV PROJECT_JSON [REPORT_JSON] [BASENAME]');
let masterFile=resolve(renderArg);
if(extname(masterFile)!=='.wav') {
  const files=readdirSync(masterFile).filter(x=>x.endsWith('.wav'));
  if(!nameArg && files.length!==1)throw new Error(`Expected one master WAV or explicit basename, received ${files.length}`);
  masterFile=join(masterFile,nameArg?nameArg.replace(/\.wav$/,'')+'.wav':files[0]);
}
const renderDir=dirname(masterFile), stem=basename(masterFile,'.wav');
const project=JSON.parse(readFileSync(resolve(projectArg),'utf8'));
const manifestFile=join(renderDir,stem+'.render.json');
if(!existsSync(manifestFile))throw new Error('Missing provenance '+manifestFile);
const manifest=JSON.parse(readFileSync(manifestFile,'utf8'));
const pcm=loadPcm(masterFile), seconds=pcm.frames/RATE;
const bpm=project.bpm??project.tempo?.bpm??project.tempo??138;
if(typeof bpm!=='number')throw new Error('Unexpected project tempo shape');
// Match engine tempo quantization before rounding absolute frame positions.
const barSeconds=4*Math.round(60000000/bpm)/1000000;
const sectionDefs={first5:[0,5],establishment:[2*barSeconds,6*barSeconds],development:[6*barSeconds,8*barSeconds],disruption:[8*barSeconds,10*barSeconds],payoff:[10*barSeconds,14*barSeconds],final3:[seconds-3,seconds]};
const temporary=mkdtempSync(join(tmpdir(),'astra-qc-'));
const round=(n,d=6)=>Number.isFinite(n)?Number(n.toFixed(d)):null;
const db=x=>x>0?round(20*Math.log10(x)):null;
function loadPcm(file) {const d=decodePcm(readFileSync(file));if(!d.pcm)throw new Error(file+': '+d.error);return d.pcm;}
function limits(p,a,b){return [Math.max(0,Math.round(a*RATE)),Math.min(p.frames,Math.round(b*RATE))];}
function at(p,i,c){return p.samples[i*p.channels+Math.min(c,p.channels-1)]/32768;}
function stats(p,a=0,b=p.frames/RATE) {
  const [start,end]=limits(p,a,b);let power=0,peak=0,ll=0,rr=0,lr=0,mid=0,side=0,dc=0;
  let activePower=0,activeSamples=0,activeWindows=0;const hop=Math.round(.02*RATE);
  for(let k=start;k<end;k+=hop){let windowPower=0;const bound=Math.min(end,k+hop);
    for(let i=k;i<bound;i++){const l=at(p,i,0),r=at(p,i,1);const e=(l*l+r*r)/2;power+=e;windowPower+=e;
      peak=Math.max(peak,Math.abs(l),Math.abs(r));ll+=l*l;rr+=r*r;lr+=l*r;mid+=((l+r)/2)**2;side+=((l-r)/2)**2;dc+=(l+r)/2;}
    if(windowPower/(bound-k)>1e-6){activePower+=windowPower;activeSamples+=bound-k;activeWindows++;}
  }
  const frames=end-start,rms=Math.sqrt(power/frames),peakDbfs=db(peak),rmsDbfs=db(rms);
  return {startSeconds:round(start/RATE),endSeconds:round(end/RATE),rmsDbfs,peakDbfs,crestDb:peakDbfs===null||rmsDbfs===null?null:round(peakDbfs-rmsDbfs),
    stereoCorrelation:ll&&rr?round(lr/Math.sqrt(ll*rr),4):null,midRmsDbfs:db(Math.sqrt(mid/frames)),sideRmsDbfs:db(Math.sqrt(side/frames)),
    monoFoldDownDeltaDb:power?round(10*Math.log10(mid/power)):null,dc:round(dc/frames,8),activeRmsDbfs:db(Math.sqrt(activePower/activeSamples)),activeFraction:round(activeSamples/frames,4),active20msWindows:activeWindows};
}
function transientProxy(p,a,b) {
  const [start,end]=limits(p,a,b),hop=441,energy=[];let maximumJump=0,maximumJumpAt=0;
  for(let k=start;k<end;k+=hop){let sum=0;const bound=Math.min(end,k+hop);
    for(let i=k;i<bound;i++){const l=at(p,i,0),r=at(p,i,1);sum+=(l*l+r*r)/2;
      if(i>start){const jump=Math.max(Math.abs(l-at(p,i-1,0)),Math.abs(r-at(p,i-1,1)));if(jump>maximumJump){maximumJump=jump;maximumJumpAt=i;}}}
    energy.push(sum/(bound-k));}
  let last=-99;const attacks=[];
  for(let i=1;i<energy.length;i++){
    const prev=energy.slice(Math.max(0,i-5),i),base=prev.reduce((s,x)=>s+x,0)/prev.length;
    const rise=10*Math.log10(energy[i]/Math.max(1e-12,base));
    if(rise>5&&energy[i]>10**(-45/10)&&i-last>=4){attacks.push({seconds:round((start+i*hop)/RATE,4),riseDb:round(rise,2)});last=i;}}
  return {energyRiseAttacks:attacks.length,attacksPerSecond:round(attacks.length/((end-start)/RATE),3),attackTimes:attacks,
    maxAdjacentSampleJump:round(maximumJump,6),maxAdjacentSampleJumpDbfs:db(maximumJump),maxAdjacentSampleJumpSeconds:round(maximumJumpAt/RATE,6)};
}
function lowpass(p) {
  const output={...p,samples:new Float64Array(p.samples.length)};
  for(let c=0;c<p.channels;c++) {
    let source=Float64Array.from({length:p.frames},(_,i)=>p.samples[i*p.channels+c]);
    for(const q of [.541196100146197,1.306562964876377]) {
      const omega=2*Math.PI*120/RATE,cs=Math.cos(omega),alpha=Math.sin(omega)/(2*q),a0=1+alpha;
      const b0=(1-cs)/2/a0,b1=(1-cs)/a0,b2=b0,a1=-2*cs/a0,a2=(1-alpha)/a0;
      let x1=0,x2=0,y1=0,y2=0;const filtered=new Float64Array(p.frames);
      for(let i=0;i<p.frames;i++){const x=source[i],y=b0*x+b1*x1+b2*x2-a1*y1-a2*y2;filtered[i]=y;x2=x1;x1=x;y2=y1;y1=y;}
      source=filtered;
    }
    for(let i=0;i<p.frames;i++)output.samples[i*p.channels+c]=source[i];
  }
  return output;
}
function spectrum(p,a,b,key) {
  const [start,end]=limits(p,a,b),samples=new Int16Array((end-start)*2);
  for(let i=start;i<end;i++)for(let c=0;c<2;c++)samples[(i-start)*2+c]=p.samples[i*p.channels+Math.min(c,p.channels-1)];
  const path=join(temporary,key+'.wav');writeFileSync(path,encodePcm(samples));const result=inspect(path);rmSync(path);
  return result.bandPowerPercent;
}
function discontinuities(p){
  const candidates=[];let largestInBin=0,atFrame=0;const binFrames=441;
  for(let i=1;i<p.frames;i++) {
    const jump=Math.max(Math.abs(at(p,i,0)-at(p,i-1,0)),Math.abs(at(p,i,1)-at(p,i-1,1)));
    if(jump>largestInBin){largestInBin=jump;atFrame=i;}
    if(i%binFrames===0||i===p.frames-1){candidates.push({seconds:round(atFrame/RATE),jump:round(largestInBin),jumpDbfs:db(largestInBin)});largestInBin=0;}
  }
  candidates.sort((a,b)=>b.jump-a.jump);
  let lastNonzero=-1,firstNonzero=-1;
  for(let i=0;i<p.frames;i++)if(Math.max(Math.abs(at(p,i,0)),Math.abs(at(p,i,1)))>1/32768){if(firstNonzero<0)firstNonzero=i;lastNonzero=i;}
  const first=[at(p,0,0),at(p,0,1)],last=[at(p,p.frames-1,0),at(p,p.frames-1,1)];
  return {firstSample:first,lastSample:last,endToStartJump:first.map((x,i)=>round(x-last[i],8)),firstNonzeroSeconds:round(firstNonzero/RATE),
    trailingNearSilenceSeconds:round((p.frames-1-lastNonzero)/RATE),last50ms:stats(p,seconds-.05,seconds),largestAdjacentSampleJumps:candidates.slice(0,12),
    interpretation:'Large adjacent-sample differences may be intentional transients; this proxy cannot certify click audibility.'};
}
function laneValue(points,fallback,frame) {
  let index=-1;for(let i=0;i<(points?.length??0);i++)if(points[i].frame<=frame)index=i;else break;
  if(index<0)return fallback;const p=points[index],n=points[index+1];
  return p.transition==='linear'&&n?p.value+(n.value-p.value)*(frame-p.frame)/(n.frame-p.frame):p.value;
}
function automationReport(){return (manifest.production?.tracks??[]).map(t=>{
  const points=t.resolvedAutomation??{};
  const sectionValues=Object.fromEntries(Object.entries(sectionDefs).map(([name,[a,b]])=>[name,[a,(a+b)/2,b].map(seconds=>({seconds:round(seconds),gainDb:round(laneValue(points.gainDb,t.gainDb,Math.round(seconds*RATE))),pan:round(laneValue(points.pan,t.pan,Math.round(seconds*RATE)))}))]));
  return {trackId:t.trackId,staticGainDb:t.gainDb,staticPan:t.pan,points:points,sectionValues,
    boundaries:Object.fromEntries(Object.entries(points).map(([lane,ps])=>[lane,ps.map(p=>({seconds:round(p.frame/RATE),transition:p.transition,
      immediatelyBefore:round(laneValue(ps,t[lane],p.frame-1)),atPoint:p.value,immediatelyAfter:round(laneValue(ps,t[lane],p.frame+1))}))]))};
});}
function sourceVoices() {
  const framesByAsset=new Map((manifest.samples?.assets??[]).map(a=>[a.file,a.frames]));
  return (manifest.samples?.tracks??[]).map(t=>{
    const voices=t.triggers.map(x=>({start:x.frame,end:Math.min(pcm.frames,x.frame+(x.playback?.voiceFrames??framesByAsset.get(x.file)??0))}));
    const points=voices.flatMap(v=>[[v.start,1],[v.end,-1]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    let simultaneous=0,maxSimultaneous=0,pairOverlapFrames=0;
    for(const [,delta] of points){simultaneous+=delta;maxSimultaneous=Math.max(maxSimultaneous,simultaneous);}
    for(let i=0;i<voices.length;i++)for(let j=i+1;j<voices.length;j++)pairOverlapFrames+=Math.max(0,Math.min(voices[i].end,voices[j].end)-Math.max(voices[i].start,voices[j].start));
    return {trackId:t.trackId,maxSimultaneousSourceVoices:maxSimultaneous,pairOverlapSeconds:round(pairOverlapFrames/RATE),sourceVoices:voices.map(v=>({startSeconds:round(v.start/RATE),endSeconds:round(v.end/RATE)}))};
  });
}
try {
  const low=lowpass(pcm);
  const sections=Object.fromEntries(Object.entries(sectionDefs).map(([key,[a,b]])=>[key,{...stats(pcm,a,b),transients:transientProxy(pcm,a,b),low120Hz:stats(low,a,b),bandPowerPercent:spectrum(pcm,a,b,key)}]));
  const stems=(manifest.stems??[]).map(s=>{
    const file=join(renderDir,s.wav.file),audio=loadPcm(file);
    return {trackId:s.trackId,file:s.wav.file,aligned:audio.frames===pcm.frames,whole:stats(audio),sections:Object.fromEntries(Object.entries(sectionDefs).map(([name,[a,b]])=>[name,stats(audio,a,b)]))};
  });
  const sampleTransforms=(manifest.samples?.tracks??[]).map(t=>({trackId:t.trackId,triggers:t.triggers.length,transformedTriggers:t.triggers.filter(x=>x.playback).map(t=>({seconds:round(t.frame/RATE),file:t.file,...t.playback}))}));
  const report={method:{kind:'Read-only listening proxies; no auditory judgment or quality score',node:process.version,sampleRate:RATE,bitsPerSample:16,bpm,
    spectrum:'Existing inspect(): 8192-point Hann FFT, 50% overlap, summed independent-channel power, unweighted bands, includes fades and silence',
    transientProxy:'10 ms windows; energy increase >5 dB against previous up to 50 ms, current RMS >-45 dBFS, minimum separation 40 ms. Not a perceptual onset detector.',
    activeEnergy:'20 ms windows above -60 dBFS RMS; active RMS excludes lower windows',
    lowBand:'Causal fourth-order Butterworth low-pass at 120 Hz (Q 0.541196, 1.306563); applied from beginning before sections',
    mono:'Mono=(L+R)/2, reference stereo power=(L²+R²)/2. Relative RMS energy delta includes expected reduction for decorrelated stereo.',
    automation:'Manifest-resolved sample frames; absolute values replace static parameters; outgoing linear dB/pan segments, default step, final hold',
    loudness:'Reuse native .analysis.json; LUFS and true peak are deliberately not reimplemented',
    limitations:'Spectral/energy/waveform evidence is not human audition. Stems are post-track and pre-master; nonlinear master processing prevents exact stem summation.'},
    masterFile,projectFile:resolve(projectArg),durationSeconds:round(seconds),whole:stats(pcm),wholeBandPowerPercent:inspect(masterFile).bandPowerPercent,
    low120HzWhole:stats(low),sections,bars:Array.from({length:project.bars??Math.round(seconds/barSeconds)},(_,i)=>({bar:i+1,...stats(pcm,i*barSeconds,Math.min(seconds,(i+1)*barSeconds)),transients:transientProxy(pcm,i*barSeconds,Math.min(seconds,(i+1)*barSeconds))})),
    stems,discontinuityRisk:discontinuities(pcm),automation:automationReport(),sampleTransforms,
    sourceVoiceActivity:{method:'Manifest trigger frames and transformed voiceFrames (or source asset frames), capped at master boundary; excludes track effect tails and amplitude envelopes.',tracks:sourceVoices()},
    productionOverloads:{master:manifest.production?.master,tracks:manifest.production?.tracks?.map(t=>({trackId:t.trackId,clippedSamples:t.clippedSamples,preClipPeakDbfs:t.preClipPeakDbfs}))}};
  const json=JSON.stringify(report,null,2)+'\n';if(reportArg)writeFileSync(resolve(reportArg),json);else process.stdout.write(json);
} finally {rmSync(temporary,{recursive:true,force:true});}
