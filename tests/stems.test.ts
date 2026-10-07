import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import tonejs from '@tonejs/midi';
import { compileProjectFile, compileProjectText, runCommand, stemFileName } from '../src/pipeline.ts';
import { encodeSmf } from '../src/midi/smf.ts';
const demo='examples/demo.json';
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const env={...process.env,DAEMONV12_FLUIDSYNTH:resolve('tests/helpers/fake-fluidsynth.mjs'),FAKE_FRAMES:'882000'};
const soundfont='tests/fixtures/fake.sf2';
function temp(t:TestContext) {const dir=mkdtempSync(join(tmpdir(),'daemonv12-stems-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return dir;}
function chunks(bytes:Uint8Array) {
 const b=Buffer.from(bytes),result:Buffer[]=[];
 for(let offset=14;offset<b.length;) {const end=offset+8+b.readUInt32BE(offset+4);result.push(b.subarray(offset,end));offset=end;}
 return result;
}
test('stem MIDI contains exactly its original track chunk and conductor, preserving ordering, channels and EOT',()=>{
 const timeline=compileProjectFile(demo).timeline!,master=chunks(encodeSmf(timeline));
 for (const [i,track] of timeline.tracks.entries()) {
  const bytes=encodeSmf(timeline,track.id);
  assert.deepEqual(chunks(bytes),[master[0],master[i+1]]);
  assert.deepEqual(encodeSmf(timeline,track.id),bytes);
  const parsed=new tonejs.Midi(bytes);assert.equal(parsed.tracks.length,1);
  const part=parsed.tracks[0]!;
  assert.equal(part.name,track.id);assert.equal(part.channel,i);assert.equal(part.instrument.number,track.instrument.program);
  assert.equal(part.endOfTrackTicks,timeline.endTick);
  assert.deepEqual(part.notes.map(n=>[n.ticks,n.durationTicks,n.midi,Math.round(n.velocity*127)]),track.notes.map(n=>[n.tick,n.durationTicks,n.pitch,Math.round(n.velocity*127)]));
 }
 assert.throws(()=>encodeSmf(timeline,'missing'),/Unknown/);
 const reordered=structuredClone(timeline);for(const track of reordered.tracks)track.notes.reverse();
 for(const track of timeline.tracks)assert.deepEqual(encodeSmf(reordered,track.id),encodeSmf(timeline,track.id));
});
test('stem MIDI preserves channels past the drum channel and empty-track timeline',()=>{
 const p=JSON.parse(readFileSync(demo,'utf8'));p.tracks=Array.from({length:15},(_,i)=>({...structuredClone(p.tracks[0]),id:`part-${i}`}));
 const timeline=compileProjectText(JSON.stringify(p)).timeline!;
 for(const [i,track] of timeline.tracks.entries())assert.equal(new tonejs.Midi(encodeSmf(timeline,track.id)).tracks[0]!.channel,i<9?i:i+1);
 timeline.tracks[14]!.notes=[];
 assert.deepEqual(chunks(encodeSmf(timeline,'part-14')),[chunks(encodeSmf(timeline))[0],chunks(encodeSmf(timeline))[15]]);
});
test('filenames are stable and injective, including device names',()=>{
 const ids=['bass','keys','a-b','ab','con','con-','aux','com1','lpt9','constructor'];
 assert.deepEqual(ids.map(stemFileName),['bass.wav','keys.wav','a-b.wav','ab.wav','_con.wav','con-.wav','_aux.wav','_com1.wav','_lpt9.wav','constructor.wav']);
 assert.equal(new Set(ids.map(stemFileName)).size,ids.length);
 for(const id of ids)assert.equal(stemFileName(id),stemFileName(id));
});
test('pipeline stems, actual submitted MIDI, provenance hashes, repeat renders and stale removed-track cleanup',async t=>{
 const root=temp(t),outDir=join(root,'out'),log=join(root,'calls.jsonl');
 const options={outDir,soundfont,env:{...env,FAKE_MIDI_LOG:log},stems:true};
 const first=await runCommand('render',demo,options);assert.equal(first.exitCode,0,JSON.stringify(first.result.errors));
 const manifest=JSON.parse(readFileSync(join(outDir,'demo.render.json'),'utf8'));
 assert.deepEqual(first.result.manifest,manifest);
 assert.deepEqual(first.result.artifacts.stems,[{trackId:'bass',wav:join(outDir,'demo.stems/bass.wav')},{trackId:'keys',wav:join(outDir,'demo.stems/keys.wav')}]);
 const calls=readFileSync(log,'utf8').trim().split('\n').map(s=>JSON.parse(s));assert.equal(calls.length,3);
 const timeline=compileProjectFile(demo).timeline!;
 for(const [i,stem] of manifest.stems.entries()) {
  const track=timeline.tracks[i]!,midi=encodeSmf(timeline,track.id),wav=readFileSync(join(outDir,stem.wav.file));
  assert.equal(stem.trackId,track.id);assert.equal(stem.trackIndex,i);
  assert.deepEqual(Buffer.from(calls[i+1].midi,'hex'),Buffer.from(midi));
  assert.equal(stem.midi.sha256,hash(midi));assert.equal(stem.midi.notes,track.notes.length);
  assert.equal(stem.wav.sha256,hash(wav));assert.equal(stem.wav.bytes,wav.length);assert.equal(stem.wav.durationSeconds,20);
  assert.deepEqual(stem.renderer,manifest.renderer);
 }
 const before=readFileSync(join(outDir,'demo.render.json'));
 writeFileSync(join(outDir,'demo.stems/removed.wav'),'stale');writeFileSync(join(outDir,'demo.stems/removed.mid.tmp'),'stale');
 assert.equal((await runCommand('render',demo,options)).exitCode,0);
 assert.deepEqual(readFileSync(join(outDir,'demo.render.json')),before);
 assert.deepEqual(readdirSync(join(outDir,'demo.stems')).sort(),['bass.wav','keys.wav']);
});
for(const target of ['bass','keys'])for(const mode of ['exit-1','bad-wav','empty-wav','wrong-rate','float-wav','no-output'])test(`stem ${target} ${mode}: cleans master, earlier stems, stale files and temporary MIDI`,async t=>{
 const root=temp(t),outDir=join(root,'out'),log=join(root,'calls.jsonl');mkdirSync(join(outDir,'demo.stems'),{recursive:true});
 for(const name of ['demo.mid','demo.wav','demo.render.json'])writeFileSync(join(outDir,name),'stale');
 writeFileSync(join(outDir,'demo.stems/old.wav'),'stale');
 const outcome=await runCommand('render',demo,{outDir,soundfont,stems:true,env:{...env,FAKE_FLUIDSYNTH_MODE:mode,FAKE_FAIL_OUTPUT:target,FAKE_MIDI_LOG:log}});
 assert.equal(outcome.exitCode,3);assert.equal(outcome.result.errors[0]!.code,'RENDERER_FAILED');
 assert.equal(outcome.result.errors[0]!.path,target==='bass'?'tracks[0]':'tracks[1]');
 assert.equal(readFileSync(log,'utf8').trim().split('\n').length,target==='bass'?2:3);
 assert.deepEqual(outcome.result.artifacts,{});assert.equal(outcome.result.manifest,null);assert.deepEqual(readdirSync(outDir),[]);
});
test('short valid WAV is rejected; missing renderer and SoundFont clean stale stems',async t=>{
 const outDir=temp(t);
 for(const extra of [{env:{...env,FAKE_FRAMES:'1'}},{env:{...env,DAEMONV12_FLUIDSYNTH:'/missing/fluidsynth'}},{soundfont:'/missing/font.sf2'}]) {
  mkdirSync(join(outDir,'demo.stems'));writeFileSync(join(outDir,'demo.stems/old.wav'),'stale');
  const outcome=await runCommand('render',demo,{outDir,soundfont,env,stems:true,...extra});
  assert.equal(outcome.exitCode,3);assert.deepEqual(readdirSync(outDir),[]);
 }
});
test('invalid and duplicate IDs reject instead of sanitizing filename collisions; validation failure cleans stems',async t=>{
 const root=temp(t),outDir=join(root,'out'),path=join(root,'demo.json');
 for(const ids of [['bass','bass'],['a b','a-b'],['../bass','keys']]) {
  const p=JSON.parse(readFileSync(demo,'utf8'));p.tracks.forEach((track:any,i:number)=>track.id=ids[i]);writeFileSync(path,JSON.stringify(p));
  mkdirSync(join(outDir,'demo.stems'),{recursive:true});writeFileSync(join(outDir,'demo.stems/old.wav'),'stale');
  const r=await runCommand('render',path,{outDir,soundfont,env,stems:true});assert.equal(r.exitCode,1);assert.ok(r.result.errors.some(d=>d.code==='INVALID_ID'||d.code==='DUPLICATE_ID'));assert.deepEqual(readdirSync(outDir),[]);
 }
});
test('output collisions fail safely without recursively deleting or following directories',async t=>{
 const root=temp(t),outside=join(root,'outside');mkdirSync(outside);writeFileSync(join(outside,'keep.wav'),'keep');
 for(const kind of ['file','symlink','nested','foreign']) {
  const outDir=join(root,kind);mkdirSync(outDir);const stems=join(outDir,'demo.stems');
  if(kind==='file')writeFileSync(stems,'keep');
  else if(kind==='symlink')symlinkSync(outside,stems);
  else {mkdirSync(stems);if(kind==='nested')mkdirSync(join(stems,'bass.wav'));else writeFileSync(join(stems,'keep.txt'),'keep');}
  const r=await runCommand('render',demo,{outDir,soundfont,env,stems:true});assert.equal(r.exitCode,3);assert.ok(r.result.errors.some(d=>d.code==='OUTPUT_WRITE_FAILED'));assert.deepEqual(r.result.artifacts,{});
  assert.deepEqual(readdirSync(outDir),['demo.stems']);assert.equal(readFileSync(join(outside,'keep.wav'),'utf8'),'keep');
 }
});
test('plain render and midi invalidate old stems; validate leaves them untouched',async t=>{
 const outDir=temp(t);
 for(const command of ['validate','midi','render'] as const) {
  mkdirSync(join(outDir,'demo.stems'),{recursive:true});writeFileSync(join(outDir,'demo.stems/old.wav'),'stale');
  const r=await runCommand(command,demo,{outDir,soundfont,env});assert.equal(r.exitCode,0);
  assert.equal(readdirSync(outDir).includes('demo.stems'),command==='validate');assert.equal(r.result.artifacts.stems,undefined);assert.equal(r.result.manifest?.stems,undefined);
 }
});
test('CLI --stems human and JSON output; render-only flag and JSON failures',t=>{
 const outDir=temp(t);
 const cli=(args:string[],extra={})=>spawnSync(process.execPath,['bin/daemonv12.js',...args],{encoding:'utf8',env:{...env,...extra}});
 const args=['render',demo,'--out-dir',outDir,'--soundfont',soundfont,'--stems'];
 const human=cli(args);assert.equal(human.status,0,human.stderr);assert.match(human.stdout,/bass.wav \(track bass\)/);assert.match(human.stdout,/keys.wav \(track keys\)/);
 const json=cli([...args,'--json']);assert.equal(json.status,0,json.stdout);const r=JSON.parse(json.stdout);assert.equal(r.artifacts.stems.length,2);assert.equal(r.manifest.stems.length,2);
 for(const args of [['validate',demo],['midi',demo],['--help'],['--version']]) {const r=cli([...args,'--stems','--json']);assert.equal(r.status,2);assert.equal(JSON.parse(r.stdout).errors[0].code,'USAGE_ERROR');}
 const failure=cli([...args,'--json'],{FAKE_FLUIDSYNTH_MODE:'bad-wav',FAKE_FAIL_OUTPUT:'keys'});assert.equal(failure.status,3);assert.equal(JSON.parse(failure.stdout).errors[0].path,'tracks[1]');assert.deepEqual(readdirSync(outDir),[]);
});
