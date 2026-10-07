import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { runCommand } from '../src/pipeline.ts';
import { createAudioProcessor, createDefaultRenderer, resolveSoundfont, decodePcm } from '../src/render/index.ts';
const env={...process.env};delete env.DAEMONV12_FLUIDSYNTH;delete env.DAEMONV12_SOUNDFONT;delete env.DAEMONV12_FFMPEG;
const sf=await resolveSoundfont({env}),renderer=sf.value?await createDefaultRenderer({soundfont:sf.value,env}):null,processor=await createAudioProcessor({env});
const skip=sf.diagnostic?.message??renderer?.diagnostic?.message??processor.diagnostic?.message??false;
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
test('real production demo: stereo intent, unclipped aligned stems, valid provenance and repeatable canonical artifacts',{skip},async t=>{
  const outDir=mkdtempSync(join(tmpdir(),'production-real-'));t.after(()=>rmSync(outDir,{recursive:true,force:true}));
  const options={outDir,env,stems:true,format:'wav,mp3' as const};
  const first=await runCommand('render','examples/production-demo.json',options);assert.equal(first.exitCode,0,JSON.stringify(first));
  assert.deepEqual(first.result.warnings,[]);const manifest:any=first.result.manifest;
  const master=decodePcm(readFileSync(first.result.artifacts.wav!)).pcm!;
  assert.equal(first.result.summary!.notes,186);assert.equal(manifest.analysis.master.clipping,false);
  assert.ok(manifest.analysis.master.integratedLufs>-40 && manifest.analysis.master.integratedLufs<-10);
  const before=new Map<string,Buffer>();
  for(const path of [first.result.artifacts.wav!,first.result.artifacts.manifest!,first.result.artifacts.analysis!,...first.result.artifacts.stems!.map(s=>s.wav)])before.set(path,readFileSync(path));
  for(const stem of first.result.artifacts.stems!) {
    const pcm=decodePcm(readFileSync(stem.wav)).pcm!;assert.equal(pcm.frames,master.frames);
    let left=0,right=0;for(let i=0;i<pcm.samples.length;i+=2){left+=pcm.samples[i]!**2;right+=pcm.samples[i+1]!**2;}
    assert.ok(left>0 && right>0);
    if(stem.trackId==='keys')assert.ok(left>right*1.5);
    if(stem.trackId==='hats')assert.ok(right>left*4);
    if(stem.trackId==='impact')assert.ok(pcm.samples.slice(0,771750*2).every(v=>v===0));
    const entry=manifest.stems.find((s:any)=>s.trackId===stem.trackId);assert.equal(entry.wav.sha256,hash(readFileSync(stem.wav)));
  }
  assert.ok(manifest.production.tracks.every((p:any)=>p.clippedSamples===0));assert.equal(manifest.production.master.clippedSamples,0);
  const second=await runCommand('render','examples/production-demo.json',options);assert.equal(second.exitCode,0);
  for(const [path,bytes] of before)assert.deepEqual(readFileSync(path),bytes);
});
