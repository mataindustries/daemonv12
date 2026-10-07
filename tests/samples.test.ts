import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import tonejs from '@tonejs/midi';
import { compileProjectFile, compileProjectText, runCommand } from '../src/pipeline.ts';
import { encodePcm, decodePcm, mixPcm } from '../src/render/index.ts';
import { ticksToFrames } from '../src/timing/musical-time.ts';
import { encodeSmf } from '../src/midi/smf.ts';
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
function fixture(t:TestContext) {
  const root=mkdtempSync(join(tmpdir(),'daemon-samples-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  mkdirSync(join(root,'assets/kit'),{recursive:true});
  const wave=encodePcm(new Int16Array([1000,-1000,2000,-2000,3000,-3000,4000,-4000]));
  writeFileSync(join(root,'assets/kit/kick.wav'),wave);
  writeFileSync(join(root,'assets/kit/snare.wav'),encodePcm(new Int16Array([500,500,600,600])));
  const kit={formatVersion:1,samples:[{name:'kick',pitch:36,file:'kick.wav'},{name:'snare',pitch:'D2',file:'snare.wav'}]};
  writeFileSync(join(root,'assets/kit/kit.json'),JSON.stringify(kit));
  const project:any={formatVersion:1,title:'Samples',bpm:120,timeSignature:'4/4',bars:1,tracks:[{id:'drums',instrument:{type:'drumkit',kit:'assets/kit/kit.json'},clips:[{bar:1,pattern:'beat'}],patterns:[{id:'beat',bars:1,notes:[{start:'1:2',pitch:'kick',velocity:0.5},{start:'1:2',pitch:36,velocity:1},{start:'1:3',pitch:'D2',velocity:1}]}]}]};
  const path=join(root,'sample.json'),outDir=join(root,'out');
  const save=()=>writeFileSync(path,JSON.stringify(project));save();
  return {root,path,outDir,project,kit,wave,save};
}
test('absolute frames: tempo rounding, half-frame tie, fractional tempos, large ticks and ceil timeline',()=>{
  assert.equal(ticksToFrames(960,500000),22050);
  assert.equal(ticksToFrames(32,500000),735);
  assert.equal(ticksToFrames(480,625000),13781);
  assert.equal(ticksToFrames(960,625000),27563); // 27562.5 ties later
  for(const tempo of [545455,Math.round(60000000/123.456),3000000])for(const tick of [15,320,122879999,122880000]) {
    const n=BigInt(tick)*BigInt(tempo)*44100n,d=960000000n;
    assert.equal(ticksToFrames(tick,tempo),Number((2n*n+d)/(2n*d)));
    assert.equal(ticksToFrames(tick,tempo,44100,true),Number((n+d-1n)/d));
  }
});
test('kit names and pitches resolve identically; samples overlap, use exact frames and linear velocity',async t=>{
  const f=fixture(t),compiled=compileProjectFile(f.path);assert.deepEqual(compiled.diagnostics,[]);
  assert.deepEqual(compiled.timeline!.tracks[0]!.notes.map(n=>n.pitch),[36,36,38]);
  const r=await runCommand('render',f.path,{outDir:f.outDir,stems:true});assert.equal(r.exitCode,0,JSON.stringify(r.result));
  const bytes=readFileSync(join(f.outDir,'sample.wav')),pcm=decodePcm(bytes).pcm!;
  assert.equal(pcm.frames,88200);
  assert.deepEqual(Array.from(pcm.samples.slice(22050*2,22050*2+8)),[1500,-1500,3000,-3000,4500,-4500,6000,-6000]);
  assert.ok(pcm.samples.slice(0,22050*2).every(v=>v===0));
  assert.deepEqual(Array.from(pcm.samples.slice(44100*2,44100*2+4)),[500,500,600,600]);
  assert.deepEqual(readFileSync(join(f.outDir,'sample.stems/drums.wav')),bytes);
  const manifest:any=r.result.manifest;
  assert.equal(manifest.soundfont,null);assert.equal(manifest.midi.notes,0);
  assert.equal(manifest.samples.assets.length,3);
  for(const asset of manifest.samples.assets)assert.equal(asset.sha256,hash(readFileSync(join(f.root,asset.file))));
  assert.equal(manifest.wav.sha256,hash(bytes));assert.equal(manifest.stems[0].wav.sha256,hash(bytes));
  assert.deepEqual(manifest.samples.tracks[0].triggers.map((x:any)=>x.frame),[22050,22050,44100]);
  assert.equal((await runCommand('render',f.path,{outDir:f.outDir,stems:true})).exitCode,0);
  assert.deepEqual(readFileSync(join(f.outDir,'sample.wav')),bytes);
  assert.deepEqual(JSON.parse(readFileSync(join(f.outDir,'sample.render.json'),'utf8')),manifest);
});
test('one-shots, full overlapping tails, silent tracks, sample stem isolation and master sum',async t=>{
  const f=fixture(t);
  const long=encodePcm(new Int16Array(88200*2).fill(100));writeFileSync(join(f.root,'assets/long.wav'),long);
  f.project.tracks.push({id:'impact',instrument:{type:'sampler',sample:'assets/long.wav'},clips:[{bar:1,pattern:'hit'}],patterns:[{id:'hit',bars:1,notes:[{start:'1:4',velocity:0.5},{start:'1:4+1/8',velocity:1}]}]});
  f.project.tracks.push({id:'silent',instrument:{type:'sampler',sample:'assets/long.wav'},clips:[],patterns:[]});f.save();
  const r=await runCommand('render',f.path,{outDir:f.outDir,stems:true});assert.equal(r.exitCode,0,JSON.stringify(r.result));
  const master=decodePcm(readFileSync(join(f.outDir,'sample.wav'))).pcm!;
  const stems=['drums','impact','silent'].map(id=>decodePcm(readFileSync(join(f.outDir,`sample.stems/${id}.wav`))).pcm!);
  assert.equal(master.frames,77175+88200);
  assert.ok(stems[2]!.samples.every(v=>v===0));assert.equal(stems[2]!.frames,88200);
  assert.equal(stems[1]!.samples[70000*2],50);assert.equal(stems[1]!.samples[80000*2],150);
  for(let i=0;i<master.samples.length;i++)assert.equal(master.samples[i],stems.reduce((n,s)=>n+(s.samples[i]??0),0));
  const before=readFileSync(join(f.outDir,'sample.wav'));f.project.tracks[1].patterns[0].notes.reverse();f.project.tracks[0].patterns[0].notes.reverse();f.save();
  assert.equal((await runCommand('render',f.path,{outDir:f.outDir})).exitCode,0);assert.deepEqual(readFileSync(join(f.outDir,'sample.wav')),before);
  assert.ok(!readdirSync(f.outDir).includes('sample.stems'));
});
test('mono expansion, per-voice rounding and deterministic saturation',()=>{
  const mono={channels:1,frames:2,samples:new Int16Array([32767,-32768])};
  const r=mixPcm([{frame:0,velocity:1,pcm:mono},{frame:0,velocity:0.5,pcm:mono}],2);
  assert.equal(r.clippedSamples,4);assert.deepEqual(Array.from(decodePcm(r.bytes).pcm!.samples),[32767,32767,-32768,-32768]);
  const wave=Buffer.alloc(48);encodePcm(new Int16Array([100,200])).copy(wave);wave.writeUInt16LE(1,22);wave.writeUInt32LE(88200,28);wave.writeUInt16LE(2,32);
  const decoded=decodePcm(wave);assert.equal(decoded.pcm?.channels,1);assert.equal(decoded.pcm?.frames,2);
});
test('strict sample schemas, unmapped hits, velocity and musical bounds',t=>{
  const f=fixture(t);
  for(const [edit,code] of [
    [(p:any)=>p.tracks[0].patterns[0].notes[0].pitch='missing','UNKNOWN_DRUM_HIT'],
    [(p:any)=>p.tracks[0].patterns[0].notes[0].pitch=37,'UNKNOWN_DRUM_HIT'],
    [(p:any)=>p.tracks[0].patterns[0].notes[0].pitch=['kick'],'UNKNOWN_DRUM_HIT'],
    [(p:any)=>p.tracks[0].patterns[0].notes[0].duration='1/4','UNKNOWN_FIELD'],
    [(p:any)=>p.tracks[0].patterns[0].notes[0].velocity=0,'OUT_OF_RANGE'],
    [(p:any)=>p.tracks[0].patterns[0].notes[0].start='2:1','POSITION_OUT_OF_RANGE'],
    [(p:any)=>p.tracks[0].clips[0].bar=2,'CLIP_EXCEEDS_PROJECT'],
  ] as const) {
    const p=structuredClone(f.project);edit(p);writeFileSync(f.path,JSON.stringify(p));
    assert.ok(compileProjectFile(f.path).diagnostics.some(d=>d.code===code),code);
  }
  const p=structuredClone(f.project);p.tracks[0].instrument={type:'sampler',sample:'assets/kit/kick.wav'};p.tracks[0].patterns[0].notes=[{start:'1:1'}];
  assert.ok(compileProjectText(JSON.stringify(p)).timeline);
  p.tracks[0].patterns[0].notes[0].pitch=60;assert.ok(compileProjectText(JSON.stringify(p)).diagnostics.some(d=>d.code==='UNKNOWN_FIELD'));
});
test('kit validation: malformed JSON, duplicate names/pitches, closed objects, missing files',t=>{
  const f=fixture(t);
  for(const kit of ['{',JSON.stringify({...f.kit,extra:1}),JSON.stringify({...f.kit,samples:[]}),JSON.stringify({...f.kit,samples:[f.kit.samples[0],f.kit.samples[0]]}),JSON.stringify({...f.kit,samples:[{name:'kick',pitch:36,file:'../escape.wav'}]})]) {
    writeFileSync(join(f.root,'assets/kit/kit.json'),kit);assert.ok(compileProjectFile(f.path).diagnostics.some(d=>d.code==='INVALID_DRUMKIT'));
  }
  writeFileSync(join(f.root,'assets/kit/kit.json'),JSON.stringify(f.kit));rmSync(join(f.root,'assets/kit/snare.wav'));
  assert.ok(compileProjectFile(f.path).diagnostics.some(d=>d.code==='ASSET_NOT_FOUND'));
  rmSync(join(f.root,'assets/kit/kit.json'));assert.ok(compileProjectFile(f.path).diagnostics.some(d=>d.code==='ASSET_NOT_FOUND'));
});
test('asset containment rejects traversal, absolute paths and symlink escapes',t=>{
  const f=fixture(t);
  f.project.tracks[0].instrument={type:'sampler',sample:''};f.project.tracks[0].patterns[0].notes=[{start:'1:1'}];
  for(const path of ['../kick.wav','/tmp/kick.wav','assets/../kick.wav','assets/./kick.wav','assets//kick.wav','assets\\kick.wav','assets/%2e%2e/kick.wav']) {
    f.project.tracks[0].instrument.sample=path;f.save();assert.ok(compileProjectFile(f.path).diagnostics.some(d=>d.code==='INVALID_ASSET_PATH'),path);
  }
  writeFileSync(join(f.root,'outside.wav'),f.wave);symlinkSync(join(f.root,'outside.wav'),join(f.root,'assets/escape.wav'));
  f.project.tracks[0].instrument.sample='assets/escape.wav';f.save();assert.ok(compileProjectFile(f.path).diagnostics.some(d=>d.code==='INVALID_ASSET_PATH'));
  symlinkSync(f.root,join(f.root,'assets/link'));f.project.tracks[0].instrument.sample='assets/link/outside.wav';f.save();assert.ok(compileProjectFile(f.path).diagnostics.some(d=>d.code==='INVALID_ASSET_PATH'));
});
test('unsupported and malformed WAV formats fail validation and clear stale artifacts',async t=>{
  const f=fixture(t);
  const variants=[Buffer.from('not wave'),f.wave.subarray(0,43),...[[20,3],[22,3],[24,48000],[34,24]].map(([offset,value])=>{const b=Buffer.from(f.wave);if(offset===24)b.writeUInt32LE(value!,offset);else b.writeUInt16LE(value!,offset!);return b;})];
  for(const bytes of variants) {
    writeFileSync(join(f.root,'assets/kit/kick.wav'),bytes);mkdirSync(join(f.outDir,'sample.stems'),{recursive:true});
    for(const name of ['sample.wav','sample.mid','sample.render.json','sample.wav.tmp'])writeFileSync(join(f.outDir,name),'stale');
    writeFileSync(join(f.outDir,'sample.stems/old.wav'),'stale');
    const r=await runCommand('render',f.path,{outDir:f.outDir,stems:true});assert.equal(r.exitCode,1);assert.ok(r.result.errors.some(d=>d.code==='UNSUPPORTED_WAV'));assert.deepEqual(readdirSync(f.outDir),[]);
  }
});
test('mixed GM/sample master uses original GM render, original channels and isolated GM stems',async t=>{
  const f=fixture(t),minimal=JSON.parse(readFileSync('tests/fixtures/valid/minimal.json','utf8'));
  f.project.tracks.push(minimal.tracks[0]);f.save();
  const compiled=compileProjectFile(f.path),midi=encodeSmf(compiled.timeline!),parsed=new tonejs.Midi(midi);
  assert.equal(parsed.tracks.length,1);assert.equal(parsed.tracks[0]!.channel,1);assert.equal(parsed.tracks[0]!.notes.length,2);
  const options={outDir:f.outDir,stems:true,soundfont:'tests/fixtures/fake.sf2',env:{...process.env,DAEMONV12_FLUIDSYNTH:resolve('tests/helpers/fake-fluidsynth.mjs'),FAKE_FRAMES:'88200'}};
  const r=await runCommand('render',f.path,options);assert.equal(r.exitCode,0,JSON.stringify(r.result));
  const manifest:any=r.result.manifest;assert.equal(manifest.midi.notes,2);assert.equal(manifest.stems.length,2);assert.equal(manifest.gmRenderer.name,'fluidsynth');assert.equal(manifest.stems[1].renderer.name,'fluidsynth');
  assert.equal(manifest.stems[1].midi.sha256,hash(encodeSmf(compiled.timeline!,'lead')));
  const master=decodePcm(readFileSync(join(f.outDir,'sample.wav'))).pcm!;
  const drums=decodePcm(readFileSync(join(f.outDir,'sample.stems/drums.wav'))).pcm!;
  const gm=decodePcm(readFileSync(join(f.outDir,'sample.stems/lead.wav'))).pcm!;
  for(let i=0;i<master.samples.length;i++)assert.equal(master.samples[i],Math.max(-32768,Math.min(32767,drums.samples[i]!+gm.samples[i]!)));
  const failed=await runCommand('render',f.path,{...options,env:{...options.env,FAKE_FAIL_OUTPUT:'lead',FAKE_FLUIDSYNTH_MODE:'bad-wav'}});assert.equal(failed.exitCode,3);assert.deepEqual(readdirSync(f.outDir),[]);
});
test('sample-only CLI needs no SoundFont, MIDI warns, validate writes nothing, kit is portable',async t=>{
  const f=fixture(t);
  const cli=spawnSync(process.execPath,['bin/daemonv12.js','render',f.path,'--out-dir',f.outDir,'--stems'],{encoding:'utf8',env:{...process.env,DAEMONV12_FLUIDSYNTH:'/missing',DAEMONV12_SOUNDFONT:'/missing'}});
  assert.equal(cli.status,0,cli.stderr);assert.match(cli.stdout,/daemonv12-pcm/);
  const before=readFileSync(join(f.outDir,'sample.render.json'));
  assert.equal((await runCommand('validate',f.path,{outDir:f.outDir})).exitCode,0);assert.deepEqual(readFileSync(join(f.outDir,'sample.render.json')),before);
  const midi=await runCommand('midi',f.path,{outDir:f.outDir});assert.equal(midi.exitCode,0);assert.ok(midi.result.warnings.some(d=>d.code==='SAMPLES_OMITTED'));assert.deepEqual(readdirSync(f.outDir),['sample.mid']);
  const other=join(f.root,'another.json');writeFileSync(other,JSON.stringify({...f.project,title:'Another project'}));assert.ok(compileProjectFile(other).timeline);
});
test('output directories cannot overwrite source assets, including symlink aliases',async t=>{
  const f=fixture(t);writeFileSync(join(f.root,'assets/sample.wav'),f.wave);
  symlinkSync(join(f.root,'assets'),join(f.root,'alias'));
  for(const outDir of [join(f.root,'assets'),join(f.root,'alias'),join(f.root,'assets/new')]) {
    const r=await runCommand('render',f.path,{outDir});assert.equal(r.exitCode,3);assert.ok(r.result.errors.some(d=>d.code==='OUTPUT_WRITE_FAILED'));
    assert.deepEqual(readFileSync(join(f.root,'assets/sample.wav')),f.wave);
  }
});
test('symlinked asset root escape is rejected and unsupported formatVersion wins before asset reads',t=>{
  const f=fixture(t),second=join(f.root,'nested');mkdirSync(second);symlinkSync(join(f.root,'assets'),join(second,'assets'));
  const path=join(second,'p.json');writeFileSync(path,JSON.stringify(f.project));assert.ok(compileProjectFile(path).diagnostics.some(d=>d.code==='INVALID_ASSET_PATH'));
  f.project.formatVersion=2;f.project.tracks[0].instrument.kit='assets/missing.json';f.save();
  assert.deepEqual(compileProjectFile(f.path).diagnostics.map(d=>d.code),['UNSUPPORTED_FORMAT_VERSION']);
});
test('sample provenance changes when sample bytes change, independent of unchanged project/MIDI',async t=>{
  const f=fixture(t),first=await runCommand('render',f.path,{outDir:f.outDir});assert.equal(first.exitCode,0);
  const before:any=first.result.manifest;
  writeFileSync(join(f.root,'assets/kit/kick.wav'),encodePcm(new Int16Array([9000,9000])));
  const second=await runCommand('render',f.path,{outDir:f.outDir});assert.equal(second.exitCode,0);
  const after:any=second.result.manifest;
  assert.deepEqual(after.project,before.project);assert.deepEqual(after.midi,before.midi);assert.notEqual(after.wav.sha256,before.wav.sha256);
  assert.notDeepEqual(after.samples.assets,before.samples.assets);
});
test('resource limit fails cleanly before PCM allocation; generated fixtures are reproducible',async t=>{
  const f=fixture(t);f.project.bars=1000;f.save();const r=await runCommand('render',f.path,{outDir:f.outDir});assert.equal(r.exitCode,3);assert.deepEqual(readdirSync(f.outDir),[]);
  const generated=spawnSync(process.execPath,['scripts/generate-sample-demo.ts',f.root],{encoding:'utf8'});assert.equal(generated.status,0,generated.stderr);
  for(const file of ['kick.wav','snare.wav','hat.wav','impact.wav','kit.json'])assert.deepEqual(readFileSync(join(f.root,'assets/pulse-kit',file)),readFileSync(join('examples/assets/pulse-kit',file)));
  assert.deepEqual(readFileSync(join(f.root,'sample-demo.json')),readFileSync('examples/sample-demo.json'));
  assert.deepEqual(readFileSync(join(f.root,'production-demo.json')),readFileSync('examples/production-demo.json'));
});
