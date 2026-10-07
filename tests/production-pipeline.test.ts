import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { runCommand } from '../src/pipeline.ts';
import { encodePcm, decodePcm, createAudioProcessor } from '../src/render/index.ts';
const real=await createAudioProcessor({env:process.env});
const skip=real.diagnostic?.message??false;
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
function fixture(t:TestContext) {
  const root=mkdtempSync(join(tmpdir(),'production-pipeline-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  mkdirSync(join(root,'assets'));const pcm=new Int16Array(110250*2);pcm.fill(10000);writeFileSync(join(root,'assets/hit.wav'),encodePcm(pcm));
  const project:any={formatVersion:1,title:'Mix',bpm:120,timeSignature:'4/4',bars:1,master:{gainDb:-6.020599913},tracks:[
    {id:'sample',instrument:{type:'sampler',sample:'assets/hit.wav'},mix:{gainDb:-6.020599913,pan:-1},clips:[{bar:1,pattern:'one'}],patterns:[{id:'one',bars:1,notes:[{start:'1:1',velocity:1}]}]},
    {id:'piano',instrument:{type:'gm',program:'acoustic_grand_piano'},mix:{gainDb:0,pan:1},clips:[{bar:1,pattern:'one'}],patterns:[{id:'one',bars:1,notes:[{start:'1:1',pitch:'C4',duration:'1/4'}]}]},
  ]};
  const path=join(root,'mix.json'),outDir=join(root,'out');const save=()=>writeFileSync(path,JSON.stringify(project));save();
  const options={outDir,stems:true,soundfont:'tests/fixtures/fake.sf2',env:{...process.env,DAEMONV12_FLUIDSYNTH:resolve('tests/helpers/fake-fluidsynth.mjs'),FAKE_FRAMES:'88200',FAKE_SAMPLE_VALUE:'2000'}};
  return {root,path,outDir,project,save,options};
}
test('sample and MIDI processing, exact gain/pan, common tails, master gain, provenance and repeats',{skip},async t=>{
  const f=fixture(t);const r=await runCommand('render',f.path,f.options);assert.equal(r.exitCode,0,JSON.stringify(r));
  const manifest:any=r.result.manifest;
  const master=decodePcm(readFileSync(r.result.artifacts.wav!)).pcm!;
  assert.deepEqual([...master.samples.slice(0,2)],[2500,1000]);assert.equal(master.frames,110250);
  const left=decodePcm(readFileSync(r.result.artifacts.stems![0]!.wav)).pcm!;
  const right=decodePcm(readFileSync(r.result.artifacts.stems![1]!.wav)).pcm!;
  assert.deepEqual([...left.samples.slice(0,2)],[5000,0]);assert.deepEqual([...right.samples.slice(0,2)],[0,2000]);
  assert.equal(right.frames,left.frames);assert.ok(right.samples.slice(88200*2).every(v=>v===0));
  assert.equal(manifest.production.tracks[0].gainDb,f.project.tracks[0].mix.gainDb);assert.equal(manifest.analysis.tracks.length,2);
  assert.equal(manifest.wav.sha256,hash(readFileSync(r.result.artifacts.wav!)));assert.equal(manifest.analysis.master.clipping,false);
  const before=readFileSync(r.result.artifacts.manifest!);
  assert.equal((await runCommand('render',f.path,f.options)).exitCode,0);assert.deepEqual(readFileSync(r.result.artifacts.manifest!),before);
  const noStems=await runCommand('render',f.path,{...f.options,stems:false});assert.equal(noStems.exitCode,0);assert.deepEqual(readFileSync(noStems.result.artifacts.wav!),encodePcm(master.samples));assert.ok(!readdirSync(f.outDir).includes('mix.stems'));
});
test('sample overlap is attenuated before quantization; track clipping remains visible after master attenuation',{skip},async t=>{
  const f=fixture(t);f.project.tracks=f.project.tracks.slice(0,1);f.project.tracks[0].patterns[0].notes=Array(4).fill({start:'1:1',velocity:1});f.save();
  let r=await runCommand('render',f.path,f.options);assert.equal(r.exitCode,0);let m:any=r.result.manifest;assert.equal(m.production.tracks[0].clippedSamples,0);
  f.project.tracks[0].mix.gainDb=0;f.save();r=await runCommand('render',f.path,f.options);assert.equal(r.exitCode,0);m=r.result.manifest;
  assert.ok(m.production.tracks[0].clippedSamples>0);assert.equal(m.analysis.master.clipping,false);assert.ok(r.result.warnings.some(d=>d.code==='AUDIO_CLIPPING'));
});
test('track and master delay tails align every stem and preserve the timeline',{skip},async t=>{
  const f=fixture(t);f.project.tracks[0].effects=[{type:'delay',timeMs:100,wet:0.2}];f.project.master.effects=[{type:'delay',timeMs:200,wet:0.1}];f.save();
  const r=await runCommand('render',f.path,f.options);assert.equal(r.exitCode,0,JSON.stringify(r));const m:any=r.result.manifest;
  assert.equal(m.wav.frames,123480);assert.ok(m.stems.every((s:any)=>s.wav.frames===m.wav.frames));assert.equal(m.production.tracks[0].effects[0].type,'delay');
});
test('MP3 export and analyze CLI produce valid artifacts and JSON; legacy export leaves WAV bytes unchanged',{skip},async t=>{
  const f=fixture(t);delete f.project.master;for(const track of f.project.tracks)delete track.mix;f.save();
  const old=await runCommand('render',f.path,f.options);assert.equal(old.exitCode,0);const before=readFileSync(old.result.artifacts.wav!);
  const r=await runCommand('render',f.path,{...f.options,format:'mp3'});assert.equal(r.exitCode,0,JSON.stringify(r));assert.deepEqual(readFileSync(r.result.artifacts.wav!),before);
  const m:any=r.result.manifest;assert.equal(m.mp3.sha256,hash(readFileSync(r.result.artifacts.mp3!)));assert.equal(m.mp3.bitrateKbps,192);
  const cli=spawnSync(process.execPath,['bin/daemonv12.js','analyze',r.result.artifacts.wav!,'--json'],{encoding:'utf8'});assert.equal(cli.status,0,cli.stdout);assert.deepEqual(JSON.parse(cli.stdout).analysis,m.analysis.master);
  const decoded=spawnSync('ffmpeg',['-v','error','-i',r.result.artifacts.mp3!,'-f','null','-'],{encoding:'utf8'});assert.equal(decoded.status,0,decoded.stderr);
  const rerun=await runCommand('render',f.path,{...f.options,format:'wav'});assert.equal(rerun.exitCode,0);assert.ok(!readdirSync(f.outDir).includes('mix.mp3'));
  assert.equal((await runCommand('midi',f.path,f.options)).exitCode,0);assert.deepEqual(readdirSync(f.outDir),['mix.mid']);
});
test('missing FFmpeg, MP3 failure and malformed analysis clear all partial/stale production artifacts',async t=>{
  const f=fixture(t);
  for(const extra of [{DAEMONV12_FFMPEG:'/missing'},{DAEMONV12_FFMPEG:resolve('tests/helpers/fake-ffmpeg.mjs')},{DAEMONV12_FFMPEG:resolve('tests/helpers/fake-ffmpeg.mjs'),FAKE_AUDIO_MODE:'malformed'}]) {
    mkdirSync(f.outDir,{recursive:true});for(const ext of ['mp3','analysis.json','mp3.tmp','analysis.json.tmp'])writeFileSync(join(f.outDir,`mix.${ext}`),'stale');
    const r=await runCommand('render',f.path,{...f.options,format:'mp3',env:{...f.options.env,...extra}});assert.equal(r.exitCode,3,JSON.stringify(r));assert.deepEqual(readdirSync(f.outDir),[]);assert.deepEqual(r.result.artifacts,{});
  }
});
test('analysis silence has finite JSON or explicit null and never rewrites input',{skip},async t=>{
  const f=fixture(t),path=join(f.root,'silence.wav'),bytes=encodePcm(new Int16Array(44100*2));writeFileSync(path,bytes);
  const r=await runCommand('analyze',path,{env:process.env});assert.equal(r.exitCode,0);const a:any=r.result.analysis;assert.equal(a.integratedLufs,null);assert.equal(a.truePeakDbfs,null);assert.equal(a.clipping,false);assert.deepEqual(readFileSync(path),bytes);
  assert.equal((await runCommand('analyze',join(f.root,'missing'),{env:process.env})).exitCode,2);
});
test('master overload is reported without implicit gain changes',{skip},async t=>{
  const f=fixture(t);f.project.master.gainDb=12;f.project.tracks[0].mix.gainDb=0;f.save();
  const r=await runCommand('render',f.path,f.options);assert.equal(r.exitCode,0);const m:any=r.result.manifest;
  assert.ok(m.production.master.clippedSamples>0);assert.equal(m.analysis.master.clipping,true);assert.ok(r.result.warnings.some(d=>d.code==='AUDIO_CLIPPING'));
});
test('new CLI flags are render-only and invalid format values remain usage errors',()=>{
  for(const args of [['--help','--format','wav'],['--version','--format','wav'],['validate','examples/demo.json','--format','wav'],['render','examples/demo.json','--format','flac'],['analyze','a.wav','--stems'],['analyze','a.wav','--out-dir','out']]) {
    const r=spawnSync(process.execPath,['bin/daemonv12.js',...args,'--json'],{encoding:'utf8'});assert.equal(r.status,2);assert.equal(JSON.parse(r.stdout).errors[0].code,'USAGE_ERROR');
  }
});
