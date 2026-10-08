import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync, symlinkSync, linkSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { compileProjectFile, runCommand } from '../src/pipeline.ts';
import { encodePcm, decodePcm, createAudioProcessor, createDefaultRenderer, resolveSoundfont, PCM_RATE, type Pcm } from '../src/render/index.ts';
import { syntheticVoiceover } from '../scripts/generate-v05-fixtures.ts';
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const processor=await createAudioProcessor({env:process.env}),skip=processor.diagnostic?.message??false;
function fixture(t:TestContext,seconds=3,bars=1) {
  const root=mkdtempSync(join(tmpdir(),'daemon-v05-'));t.after(()=>rmSync(root,{recursive:true,force:true}));mkdirSync(join(root,'assets'));
  const samples=new Int16Array(Math.round(seconds*PCM_RATE)*2);
  for(let frame=0;frame<samples.length/2;frame++)samples[frame*2]=samples[frame*2+1]=Math.round(10000*Math.sin(2*Math.PI*220*frame/PCM_RATE));
  writeFileSync(join(root,'assets/tone.wav'),encodePcm(samples));writeFileSync(join(root,'assets/vo.wav'),encodePcm(syntheticVoiceover().samples));
  const project:any={formatVersion:1,title:'V0.5 test',bpm:120,timeSignature:'4/4',bars,tracks:[
    {id:'tone',instrument:{type:'sampler',sample:'assets/tone.wav'},clips:[{bar:1,pattern:'one'}],patterns:[{id:'one',bars,notes:[{start:'1:1',velocity:1}]}]},
  ]};
  const path=join(root,'cue.json'),save=()=>writeFileSync(path,JSON.stringify(project));save();
  const options={outDir:join(root,'out'),env:process.env,stems:true};
  return {root,path,project,save,options};
}
function pcm(path:string):Pcm{return decodePcm(readFileSync(path)).pcm!;}
function rms(audio:Pcm,start:number,end:number) {
  let sum=0,count=0;for(let frame=Math.round(start*PCM_RATE);frame<Math.min(audio.frames,Math.round(end*PCM_RATE));frame++)for(let c=0;c<audio.channels;c++){sum+=audio.samples[frame*audio.channels+c]!**2;count++;}
  return Math.sqrt(sum/count);
}
test('V0.5 pipeline legacy auto, musical/wall exact duration, no tail, finite tail and final silence padding',{skip},async t=>{
  const f=fixture(t);let r=await runCommand('render',f.path,f.options);assert.equal(r.exitCode,0);assert.equal(pcm(r.result.artifacts.wav!).frames,132300);
  const policies=[
    [{duration:{bars:1},tail:'none'},88200,88200],
    [{duration:{musical:'1/2'},tail:'auto'},44100,44100],
    [{duration:{seconds:1.005},tail:'none'},44321,44321],
    [{tail:'none'},88200,88200],
    [{tail:{seconds:0.25}},99225,99225],
    [{duration:{seconds:4},tail:'none'},176400,88200],
    [{duration:{seconds:4},tail:{seconds:0.25}},176400,99225],
    [{duration:{seconds:4},tail:'auto'},176400,132300],
  ] as const;
  for(const [render,frames,audioEnd] of policies) {
    f.project.render=render;f.save();r=await runCommand('render',f.path,f.options);assert.equal(r.exitCode,0,JSON.stringify(r.result.errors));
    const master=pcm(r.result.artifacts.wav!),stem=pcm(r.result.artifacts.stems![0]!.wav);
    assert.equal(master.frames,frames,JSON.stringify(render));assert.equal(stem.frames,frames);
    assert.ok(master.samples.slice(audioEnd*2).every(v=>v===0));assert.deepEqual(master.samples,stem.samples);
  }
});
test('V0.5 sample + MIDI automation share exact frame semantics and aligned stems with explicit tails',{skip},async t=>{
  const f=fixture(t);f.project.render={duration:{seconds:2},tail:'none'};
  const automation={gainDb:[{at:{seconds:0},value:-20,transition:'linear'},{at:{seconds:1},value:0},{at:{seconds:1.5},value:-12}],pan:[{at:{seconds:0},value:-1,transition:'linear'},{at:{seconds:1},value:1},{at:{seconds:1.5},value:-1}]};
  f.project.tracks[0].automation=automation;
  f.project.tracks.push({id:'piano',instrument:{type:'gm',program:'acoustic_grand_piano'},automation,clips:[],patterns:[]});f.save();
  const r=await runCommand('render',f.path,{...f.options,soundfont:'tests/fixtures/fake.sf2',env:{...process.env,DAEMONV12_FLUIDSYNTH:resolve('tests/helpers/fake-fluidsynth.mjs'),FAKE_FRAMES:'110250',FAKE_SAMPLE_VALUE:'10000'}});
  assert.equal(r.exitCode,0,JSON.stringify(r.result.errors));
  const gm=pcm(r.result.artifacts.stems![1]!.wav),sample=pcm(r.result.artifacts.stems![0]!.wav);
  assert.equal(gm.frames,88200);assert.equal(sample.frames,88200);
  assert.deepEqual([...gm.samples.slice(0,2)],[1000,0]);
  assert.deepEqual([...gm.samples.slice(44100*2,44100*2+2)],[0,10000]);
  assert.deepEqual([...gm.samples.slice(66150*2,66150*2+2)],[2512,0]);
  assert.ok(sample.samples.slice(44100*2,66150*2).filter((_,i)=>i%2===0).every(v=>v===0));
  const m:any=r.result.manifest;assert.deepEqual(m.production.tracks[0].automation,m.production.tracks[1].automation);
  assert.equal(m.production.tracks[1].resolvedAutomation.gainDb[1].frame,44100);
});
test('V0.5 real effects obey timeline/tail caps on master and tracks without silently fading boundaries',{skip},async t=>{
  const f=fixture(t,2);f.project.master={effects:[{type:'delay',timeMs:100,wet:0.2}]};
  f.project.tracks[0].effects=[{type:'reverb',roomSize:0.7,decaySeconds:0.5,wet:0.4}];f.save();
  let r=await runCommand('render',f.path,f.options);assert.equal(r.exitCode,0);assert.equal(pcm(r.result.artifacts.wav!).frames,114660);
  f.project.render={duration:{bars:1},tail:'none'};f.save();r=await runCommand('render',f.path,f.options);assert.equal(r.exitCode,0);
  const audio=pcm(r.result.artifacts.wav!);assert.equal(audio.frames,88200);assert.equal(pcm(r.result.artifacts.stems![0]!.wav).frames,88200);
  assert.ok(audio.samples.slice(-200).some(v=>Math.abs(v)>100),'Hard boundary must not hide a composition click with an implicit fade.');
  f.project.render={tail:{seconds:0.2}};f.save();r=await runCommand('render',f.path,f.options);assert.equal(r.exitCode,0);assert.equal(pcm(r.result.artifacts.wav!).frames,97020);
});
test('V0.5 narrated fixture ducks, attacks/releases, recovers, excludes VO, keeps stems pre-master and repeats provenance',{skip},async t=>{
  const f=fixture(t,8,4);f.project.render={duration:{seconds:8},tail:'none'};
  f.project.master={ducking:{source:'assets/vo.wav',amountDb:12,thresholdDb:-35,attackMs:80,releaseMs:300}};f.save();
  let r=await runCommand('render',f.path,f.options);assert.equal(r.exitCode,0,JSON.stringify(r.result.errors));
  const master=pcm(r.result.artifacts.wav!),stem=pcm(r.result.artifacts.stems![0]!.wav);
  assert.equal(master.frames,352800);assert.equal(stem.frames,352800);
  const ratio=(start:number,end:number)=>rms(master,start,end)/rms(stem,start,end);
  assert.equal(ratio(0.2,0.8),1);assert.ok(Math.abs(ratio(2,2.6)-10**(-12/20))<0.001);
  assert.ok(ratio(1.21,1.25)>ratio(1.4,1.45));assert.ok(ratio(2.9,3)>ratio(2.5,2.6));
  assert.ok(ratio(3.9,4.2)>0.94);assert.ok(ratio(7.5,7.9)>0.99);
  const manifest:any=r.result.manifest;
  assert.equal(manifest.production.master.ducking.reference.sha256,hash(readFileSync(join(f.root,'assets/vo.wav'))));
  assert.equal(manifest.production.master.ducking.mixedIntoMaster,false);assert.equal(manifest.timeline.requestedFinalFrames,352800);
  assert.equal(manifest.production.master.ducking.reference.frames,352800);
  const before=new Map([r.result.artifacts.wav!,r.result.artifacts.manifest!,r.result.artifacts.analysis!,r.result.artifacts.stems![0]!.wav].map(path=>[path,readFileSync(path)]));
  r=await runCommand('render',f.path,f.options);assert.equal(r.exitCode,0);for(const [path,bytes] of before)assert.deepEqual(readFileSync(path),bytes);
  f.project.tracks[0].clips=[];f.save();r=await runCommand('render',f.path,f.options);assert.equal(r.exitCode,0);assert.ok(pcm(r.result.artifacts.wav!).samples.every(v=>v===0),'Reference alone must never be audible.');
});
test('V0.5 reference security rejects unsafe paths, missing files, unsupported WAV, symlinks and hard links',t=>{
  const f=fixture(t);f.project.master={ducking:{source:'assets/vo.wav',amountDb:12,thresholdDb:-35,attackMs:50,releaseMs:300}};
  const check=(source:string,code:string)=>{f.project.master.ducking.source=source;f.save();const c=compileProjectFile(f.path);assert.equal(c.timeline,null);assert.ok(c.diagnostics.some(d=>d.code===code&&d.path==='master.ducking.source'),JSON.stringify(c.diagnostics));};
  for(const source of ['/etc/passwd','../vo.wav','assets/../../vo.wav','assets\\vo.wav','vo.wav'])check(source,'INVALID_ASSET_PATH');
  check('assets/missing.wav','ASSET_NOT_FOUND');
  writeFileSync(join(f.root,'assets/bad.wav'),'not a WAV');check('assets/bad.wav','UNSUPPORTED_WAV');
  const bytes=readFileSync(join(f.root,'assets/vo.wav'));bytes.writeUInt32LE(48000,24);bytes.writeUInt32LE(48000*4,28);writeFileSync(join(f.root,'assets/rate.wav'),bytes);check('assets/rate.wav','UNSUPPORTED_WAV');
  symlinkSync(join(f.root,'assets/vo.wav'),join(f.root,'assets/link.wav'));check('assets/link.wav','INVALID_ASSET_PATH');
  linkSync(join(f.root,'assets/vo.wav'),join(f.root,'assets/hard.wav'));check('assets/hard.wav','INVALID_ASSET_PATH');
  const outside=mkdtempSync(join(tmpdir(),'vo-outside-'));t.after(()=>rmSync(outside,{recursive:true,force:true}));
  writeFileSync(join(outside,'outside.wav'),encodePcm(syntheticVoiceover().samples));symlinkSync(outside,join(f.root,'assets/escape'));
  check('assets/escape/outside.wav','INVALID_ASSET_PATH');
  renameSync(join(f.root,'assets'),join(f.root,'actual-assets'));symlinkSync(join(f.root,'actual-assets'),join(f.root,'assets'));
  check('assets/vo.wav','INVALID_ASSET_PATH');
});
test('V0.5 real FluidSynth releases, sample releases and reverb stop at the same exact musical boundary',{skip},async t=>{
  const sf=await resolveSoundfont({env:process.env});if(!sf.value){t.skip(sf.diagnostic.message);return;}
  const renderer=await createDefaultRenderer({soundfont:sf.value,env:process.env});if(!renderer.value){t.skip(renderer.diagnostic.message);return;}
  const f=fixture(t,3);f.project.render={duration:{bars:1},tail:'none'};
  f.project.tracks[0].mix={gainDb:-8};f.project.tracks[0].effects=[{type:'reverb',roomSize:0.5,decaySeconds:1,wet:0.2}];
  f.project.tracks.push({id:'piano',instrument:{type:'gm',program:'acoustic_grand_piano'},mix:{gainDb:-8},clips:[{bar:1,pattern:'held'}],patterns:[{id:'held',bars:1,notes:[{start:'1:1',pitch:'C4',duration:'1/1',velocity:0.5}]}]});f.save();
  const r=await runCommand('render',f.path,f.options);assert.equal(r.exitCode,0,JSON.stringify(r.result.errors));
  assert.equal(pcm(r.result.artifacts.wav!).frames,88200);for(const stem of r.result.artifacts.stems!)assert.equal(pcm(stem.wav).frames,88200);
  const master=readFileSync(r.result.artifacts.wav!);assert.equal((await runCommand('render',f.path,{...f.options,stems:false})).exitCode,0);
  assert.deepEqual(readFileSync(join(f.options.outDir,'cue.wav')),master);
});
test('V0.5 bad sidechain render clears artifacts and source assets remain protected',{skip},async t=>{
  const f=fixture(t);f.project.render={duration:{seconds:2},tail:'none'};f.save();
  assert.equal((await runCommand('render',f.path,f.options)).exitCode,0);
  f.project.master={ducking:{source:'assets/missing.wav',amountDb:12,thresholdDb:-35,attackMs:50,releaseMs:300}};f.save();
  const failure=await runCommand('render',f.path,f.options);assert.equal(failure.exitCode,1);assert.deepEqual(failure.result.artifacts,{});assert.deepEqual(readdirSync(f.options.outDir),[]);
  f.project.master.ducking.source='assets/vo.wav';f.save();const before=readFileSync(join(f.root,'assets/vo.wav'));
  const unsafe=await runCommand('render',f.path,{...f.options,outDir:join(f.root,'assets')});assert.equal(unsafe.exitCode,3);assert.deepEqual(readFileSync(join(f.root,'assets/vo.wav')),before);
});
