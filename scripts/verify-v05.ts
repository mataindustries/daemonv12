import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand } from '../src/pipeline.ts';
import { decodePcm, sumFloat, gainPan, quantize, PCM_RATE, type Pcm } from '../src/render/index.ts';
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
function rms(pcm:Pcm,start:number,end:number) {
  let sum=0,count=0;
  for(let frame=Math.round(start*PCM_RATE);frame<Math.round(end*PCM_RATE);frame++)for(let c=0;c<2;c++){sum+=pcm.samples[frame*2+c]!**2;count++;}
  return Math.sqrt(sum/count);
}
export async function verifyV05(outDir=resolve('renders/v05'),env:NodeJS.ProcessEnv=process.env) {
  const video=await runCommand('render','examples/v05-video-demo.json',{outDir,env,stems:true,format:'wav,mp3'});
  assert.equal(video.exitCode,0,JSON.stringify(video.result.errors));assert.deepEqual(video.result.warnings,[]);
  const manifest:any=video.result.manifest,artifacts=video.result.artifacts;
  const master=decodePcm(readFileSync(artifacts.wav!)).pcm!;
  assert.equal(master.frames,352800);assert.equal(manifest.analysis.master.clipping,false);
  assert.ok(manifest.analysis.master.truePeakDbfs<-1);
  assert.ok(manifest.analysis.master.integratedLufs>-30&&manifest.analysis.master.integratedLufs<-14);
  assert.equal(manifest.production.master.clippedSamples,0);
  assert.ok(manifest.production.tracks.every((track:any)=>track.clippedSamples===0));
  const stems=artifacts.stems!.map(stem=>decodePcm(readFileSync(stem.wav)).pcm!);
  for(const stem of stems)assert.equal(stem.frames,master.frames);
  const unducked=quantize(gainPan(sumFloat(stems.map(pcm=>({frame:0,velocity:1,pcm})),master.frames),manifest.production.master.gainDb));
  assert.equal(unducked.clippedSamples,0);const comparison=decodePcm(unducked.bytes).pcm!;
  const regions=[['initial silence',0.3,0.9],['attack',1.2,1.3],['VO active',1.8,2.6],['between speech',3.8,4.1],['VO active again',4.9,5.6],['recovery',6.8,7]] as const;
  const measured=regions.map(([label,start,end])=>({label,startSeconds:start,endSeconds:end,reductionDb:Number((20*Math.log10(rms(master,start,end)/rms(comparison,start,end))).toFixed(3))}));
  assert.ok(Math.abs(measured[0]!.reductionDb)<0.01);assert.ok(measured[1]!.reductionDb<0&&measured[1]!.reductionDb>-12);
  assert.ok(Math.abs(measured[2]!.reductionDb+12)<0.1);assert.ok(measured[3]!.reductionDb>-0.6);
  assert.ok(Math.abs(measured[4]!.reductionDb+12)<0.1);assert.ok(measured[5]!.reductionDb>-0.6);
  assert.equal(manifest.production.master.ducking.reference.sha256,hash(readFileSync('examples/assets/v05/synthetic-vo.wav')));
  assert.equal(manifest.production.master.ducking.mixedIntoMaster,false);
  // MP3 containers include encoder padding; gapless decoding must recover the exact PCM timeline.
  const decoded=spawnSync(env.DAEMONV12_FFMPEG||'ffmpeg',['-v','error','-i',artifacts.mp3!,'-f','s16le','-c:a','pcm_s16le','pipe:1'],{env,maxBuffer:16*1024*1024,timeout:10000});
  assert.equal(decoded.status,0,decoded.stderr?.toString());assert.equal(decoded.stdout.length/4,master.frames);
  const canonicalPaths=[artifacts.wav!,artifacts.manifest!,artifacts.analysis!,...artifacts.stems!.map(stem=>stem.wav)];
  const before=new Map(canonicalPaths.map(path=>[path,hash(readFileSync(path))]));
  const repeated=await runCommand('render','examples/v05-video-demo.json',{outDir,env,stems:true,format:'wav,mp3'});
  assert.equal(repeated.exitCode,0);for(const [path,sha256] of before)assert.equal(hash(readFileSync(path)),sha256,path);
  const loop=await runCommand('render','examples/v05-loop-demo.json',{outDir,env,stems:true});assert.equal(loop.exitCode,0,JSON.stringify(loop.result.errors));
  const loopManifest:any=loop.result.manifest;assert.equal(loopManifest.wav.frames,423360); // 4 bars × 4 quarters × 0.6 seconds × 44100
  assert.ok(loopManifest.stems.every((stem:any)=>stem.wav.frames===423360));assert.equal(loopManifest.analysis.master.clipping,false);
  const report={video:{artifacts,metrics:manifest.analysis.master,duckingRegions:measured,reference:manifest.production.master.ducking.reference,
    canonicalHashes:Object.fromEntries(Array.from(before,([path,sha256])=>[path.slice(outDir.length+1),sha256])),repeatIdentical:true,mp3DecodedFrames:decoded.stdout.length/4},
    loop:{artifacts:loop.result.artifacts,metrics:loopManifest.analysis.master,expectedFrames:423360,alignedStems:loopManifest.stems.length,perceptuallySeamlessClaim:false}};
  writeFileSync(join(outDir,'v05-acceptance.json'),JSON.stringify(report,null,2)+'\n');
  writeFileSync(join(outDir,'acceptance-unducked.wav'),unducked.bytes);
  return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const report=await verifyV05();process.stdout.write(JSON.stringify(report,null,2)+'\n');
}
