import fs from 'node:fs';
import crypto from 'node:crypto';
import {Rotor} from '../../experiments/morph-07/motor.ts';
import {hypnoticMotor} from '../../experiments/morph-07/scores.ts';
const base='experiments/';
const telemetryPath=base+'morph-07/candidates/hypnotic-motor.telemetry.json';
const eventPath=base+'morph-08/candidates/overtone.events.json';
const audioPath=base+'morph-08/candidates/overtone.wav';
const telemetry=JSON.parse(fs.readFileSync(telemetryPath));
const eventMap=JSON.parse(fs.readFileSync(eventPath));
const c=telemetry.columns;
const s=hypnoticMotor(),r=new Rotor(s);
const reconstructionMaxError={angle:0,speed:0,torque:0,load:0};
let beginning,endpoint,lastLive;
const actual=[];
for(let n=0;n<=s.frames;n++) {
 r.step(n);
 if(n%735===0&&n<s.frames){const i=n/735;const row={angle:r.theta,speed:r.omega,torque:r.drive,load:r.load}; actual.push(row);for(const k of Object.keys(reconstructionMaxError))reconstructionMaxError[k]=Math.max(reconstructionMaxError[k],Math.abs(row[k]-c[k][i]));}
 if(n===0)beginning={sampleFrame:n,angle:r.theta,speed:r.omega,torque:r.drive};
 if(n===s.frames-1)lastLive={sampleFrame:n,angle:r.theta,speed:r.omega,torque:r.drive};
 if(n===s.frames)endpoint={sampleFrame:n,angle:r.theta,speed:r.omega,torque:r.drive};
}
const relevant=eventMap.events.filter(e=>['form','harmony','drive','voice','regime'].includes(e.trackId)).map(e=>({track:e.trackId,id:e.eventId,sampleFrame:e.sampleFrame,timeSeconds:e.sampleFrame/44100,source:e.source,roles:e.visualRoles}));
const hashes=Object.fromEntries([audioPath,eventPath,telemetryPath].map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const travel=endpoint.angle-beginning.angle;
const trackCounts=Object.fromEntries([...new Set(eventMap.events.map(e=>e.trackId))].map(k=>[k,eventMap.events.filter(e=>e.trackId===k).length]));
const report={
 sourceCommit:'dd705942faec535433b3b030c990e247261ce905',audio:{path:audioPath,sampleRate:44100,sampleFrames:352800,seconds:8,channels:2,pcmBits:16,sha256:hashes[audioPath],expectedSha256:eventMap.source.wav.sha256,hashMatches:hashes[audioPath]===eventMap.source.wav.sha256},hashes,
 telemetry:{angleUnits:'revolutions',speedUnits:'revolutions/second',fps:60,sampleCount:480,firstTimeSeconds:0,lastTimeSeconds:479/60,containsEightSecondBoundary:false,maximumSpeed:Math.max(...c.speed),minimumSpeed:Math.min(...c.speed),sourceRegimeCounts:Object.fromEntries([...new Set(c.regime)].map(k=>[k,c.regime.filter(x=>x===k).length])),reconstructionMaxAbsoluteError:reconstructionMaxError,reconstructionNote:'Unmodified Rotor + hypnoticMotor score rerun only for audit; source telemetry not edited.'},
 seam:{beginning,lastLive,endpointExtension: endpoint,travelRevolutions:travel,travelNearestInteger:Math.round(travel),orientationMismatchDegrees:(travel-Math.round(travel))*360,speedMismatchRevPerSecond:endpoint.speed-beginning.speed,speedMismatchPercent:100*(endpoint.speed-beginning.speed)/beginning.speed,note:'Raw source mechanics are nearly periodic, not mathematically exact. Frame 479 is not an endpoint. An identical sixteen-contact rotor hides symmetry multiples; endpoint discrepancy is below 0.013 degree. Do not claim raw mechanics have exact closure.'},
 events:{count:eventMap.events.length,trackCounts,firstSampleFrame:Math.min(...eventMap.events.map(e=>e.sampleFrame)),lastSampleFrame:Math.max(...eventMap.events.map(e=>e.sampleFrame)),pictureFrameConvention:'floor(sampleFrame / 735), not the time at which an event should be prematurely fired',meaningfulTransitions:relevant},
 recommendations:['Interpolate continuous angle with endpoint speeds (cubic Hermite), preserving all supplied 60fps angle samples. Never integrate a decorative speed estimate or retime the music.','For discrete event response evaluate authoritative sampleFrame/44100, preserving subframe onset. A 60fps rendered proof introduces at most one picture interval (16.667ms) of display quantization.','Use previous-cycle event tails and deterministic periodic envelope evaluation to make lighting and resonator response loop without blackout.','Distinguish sung vox (19 events) from motor harmonic-lock voice (1 event); they are separate tracks.','During fusion use telemetry speed to blend sixteen-contact rotor blur; do not fabricate impact events above the map export limit.','Keep raw residual seam quantified, or disclose any tiny visual seam correction. Full source audio must remain byte-identical; use PCM audio in MOV for a lossless verification deliverable.']
};
fs.writeFileSync('work/morph-09/endpoint.json', JSON.stringify({source:'Unmodified MORPH07 Rotor + hypnoticMotor score, derived extension only; source telemetry unchanged.',sampleRate:44100,pictureFrame:480,sampleFrame:352800,angle:endpoint.angle,speed:endpoint.speed,torque:endpoint.torque,load:0,gear:0,regime:'rhythm'},null,2)+'\n');
fs.writeFileSync('work/morph-09/source-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({seam:report.seam,counts:trackCounts,hashMatches:report.audio.hashMatches},null,2));
