import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { resolveSoundfont, createDefaultRenderer } from '../src/render/index.ts';
import { readWavInfo } from '../src/render/wav.ts';
import { runCommand } from '../src/pipeline.ts';
import { verifyDemoAudio } from './helpers/wav-analysis.ts';
const env={...process.env};delete env.DAEMONV12_FLUIDSYNTH;delete env.DAEMONV12_SOUNDFONT;
const sf=await resolveSoundfont({env});
const probe=sf.value?await createDefaultRenderer({soundfont:sf.value,env}):null;
const skip=sf.diagnostic?sf.diagnostic.message:probe?.diagnostic?probe.diagnostic.message:false;
function inspect(bytes:Buffer,duration:number) {
 const parsed=readWavInfo(bytes);assert.ok(parsed.ok,parsed.ok?'':parsed.error);const info=parsed.info;
 assert.equal(info.formatTag,1);assert.equal(info.channels,2);assert.equal(info.sampleRate,44100);assert.equal(info.bitsPerSample,16);
 assert.ok(info.frames>=duration*44100);assert.ok(info.frames<=(duration+6)*44100);
 return info;
}
test('real demo stems: valid full timelines, repeat hashes, unchanged V0 master',{skip},async t=>{
 const outDir=mkdtempSync(join(tmpdir(),'daemonv12-real-stems-'));t.after(()=>rmSync(outDir,{recursive:true,force:true}));
 const plain=await runCommand('render','examples/demo.json',{outDir,env});assert.equal(plain.exitCode,0,JSON.stringify(plain.result.errors));
 const master=readFileSync(join(outDir,'demo.wav'));verifyDemoAudio(master);
 const first=await runCommand('render','examples/demo.json',{outDir,env,stems:true});assert.equal(first.exitCode,0,JSON.stringify(first.result.errors));
 assert.deepEqual(readFileSync(join(outDir,'demo.wav')),master);
 const outputs=new Map<string,Buffer>();
 for(const stem of first.result.artifacts.stems!) {
  const bytes=readFileSync(stem.wav),info=inspect(bytes,20);outputs.set(stem.wav,bytes);
  assert.ok(bytes.subarray(info.dataOffset,info.dataOffset+info.dataBytes).some(b=>b!==0),`${stem.trackId} has audio`);
  assert.notDeepEqual(bytes,master);
  t.diagnostic(JSON.stringify({trackId:stem.trackId,bytes:bytes.length,duration:info.frames/info.sampleRate,sha256:createHash('sha256').update(bytes).digest('hex'),...info}));
 }
 assert.notDeepEqual([...outputs.values()][0],[...outputs.values()][1]);
 const manifest=readFileSync(join(outDir,'demo.render.json'));
 const second=await runCommand('render','examples/demo.json',{outDir,env,stems:true});assert.equal(second.exitCode,0,JSON.stringify(second.result.errors));
 for(const [path,bytes] of outputs)assert.deepEqual(readFileSync(path),bytes);
 assert.deepEqual(readFileSync(join(outDir,'demo.wav')),master);assert.deepEqual(readFileSync(join(outDir,'demo.render.json')),manifest);
});
test('real delayed and empty tracks preserve initial silence and the full timeline',{skip},async t=>{
 const outDir=mkdtempSync(join(tmpdir(),'daemonv12-silent-stems-'));t.after(()=>rmSync(outDir,{recursive:true,force:true}));
 const p=JSON.parse(readFileSync('tests/fixtures/valid/minimal.json','utf8'));p.bars=2;p.tracks[0].clips[0].bar=2;
 p.tracks.push({id:'empty',instrument:{type:'gm',program:'electric_bass_finger'},clips:[],patterns:[]});
 const path=join(outDir,'silence.json');writeFileSync(path,JSON.stringify(p));
 const result=await runCommand('render',path,{outDir,env,stems:true});assert.equal(result.exitCode,0,JSON.stringify(result.result.errors));
 for(const stem of result.result.artifacts.stems!) {
  const bytes=readFileSync(stem.wav),info=inspect(bytes,4);
  const end=stem.trackId==='empty'?info.dataBytes:Math.floor(1.8*44100)*4;
  // s16 conversion may dither silence by one LSB. No per-window non-silence requirement.
  for(let i=info.dataOffset;i<info.dataOffset+end;i+=2)assert.ok(Math.abs(bytes.readInt16LE(i))<=1);
  if(stem.trackId==='lead')assert.ok(bytes.subarray(info.dataOffset+2*44100*4).some(b=>b>1));
 }
});
