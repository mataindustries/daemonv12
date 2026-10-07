import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { resolveSoundfont, createDefaultRenderer, decodePcm } from '../src/render/index.ts';
import { runCommand } from '../src/pipeline.ts';
const env={...process.env};delete env.DAEMONV12_FLUIDSYNTH;delete env.DAEMONV12_SOUNDFONT;
const sf=await resolveSoundfont({env}),probe=sf.value?await createDefaultRenderer({soundfont:sf.value,env}):null;
const skip=sf.diagnostic?sf.diagnostic.message:probe?.diagnostic?probe.diagnostic.message:false;
test('real sampled demo: six aligned stems, active rhythm, bar-eight impact, unclipped master and repeat identity',{skip},async t=>{
  const outDir=mkdtempSync(join(tmpdir(),'daemon-sample-real-'));t.after(()=>rmSync(outDir,{recursive:true,force:true}));
  const first=await runCommand('render','examples/sample-demo.json',{outDir,env,stems:true});assert.equal(first.exitCode,0,JSON.stringify(first.result));
  const manifest:any=first.result.manifest,master=readFileSync(join(outDir,'sample-demo.wav')),pcm=decodePcm(master).pcm!;
  assert.equal(first.result.summary!.notes,186);assert.equal(manifest.midi.notes,89);
  assert.equal(manifest.samples.tracks.reduce((n:number,t:any)=>n+t.triggers.length,0),97);
  assert.equal(manifest.mix.clippedSamples,0);assert.equal(manifest.stems.length,6);
  assert.ok(pcm.frames>=882000 && pcm.frames<=1146600);
  let peak=0,squares=0;
  for(const value of pcm.samples) {peak=Math.max(peak,Math.abs(value));squares+=(value/32768)**2;}
  assert.ok(peak<32767 && peak>3000);
  const barRms=Array.from({length:8},(_,bar)=>{
    const start=bar*110250*2,end=start+110250*2;let sum=0;
    for(let i=start;i<end;i++)sum+=(pcm.samples[i]!/32768)**2;
    return 20*Math.log10(Math.sqrt(sum/(end-start)));
  });
  assert.ok(barRms.every(v=>v>-40));
  const outputs=new Map<string,Buffer>();
  for(const stem of first.result.artifacts.stems!) {
    const bytes=readFileSync(stem.wav),part=decodePcm(bytes).pcm!;outputs.set(stem.wav,bytes);
    assert.ok(part.frames>=882000);assert.ok(part.samples.some(v=>Math.abs(v)>1));
    if(stem.trackId==='impact')assert.ok(part.samples.slice(0,771750*2).every(v=>v===0));
    if(['kick','snare','hats','impact'].includes(stem.trackId))assert.equal(part.frames,882000);
  }
  const before=readFileSync(join(outDir,'sample-demo.render.json'));
  const second=await runCommand('render','examples/sample-demo.json',{outDir,env,stems:true});assert.equal(second.exitCode,0);
  assert.deepEqual(readFileSync(join(outDir,'sample-demo.wav')),master);assert.deepEqual(readFileSync(join(outDir,'sample-demo.render.json')),before);
  for(const [path,bytes] of outputs)assert.deepEqual(readFileSync(path),bytes);
  t.diagnostic(JSON.stringify({frames:pcm.frames,durationSeconds:pcm.frames/44100,peakDbfs:20*Math.log10(peak/32768),rmsDbfs:20*Math.log10(Math.sqrt(squares/pcm.samples.length)),barRms,sha256:createHash('sha256').update(master).digest('hex')}));
});
