import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateProject } from '../src/project/validate.ts';
import { gainAmplitude, balance, gainPan, quantize, analyzeWav, createAudioProcessor, encodePcm } from '../src/render/index.ts';
const project = () => JSON.parse(readFileSync('tests/fixtures/valid/minimal.json', 'utf8'));
test('gain and linear balance have exact neutral and endpoint behavior and bounded inputs', () => {
  assert.equal(gainAmplitude(0), 1); assert.ok(Math.abs(gainAmplitude(-6.020599913) - 0.5) < 1e-10);
  assert.deepEqual(balance(0), [1,1]); assert.deepEqual(balance(-1), [1,0]); assert.deepEqual(balance(1), [0,1]);
  assert.deepEqual([...gainPan(new Float64Array([100,200]), 0, -0.25)], [100,150]);
  for (const v of [NaN, Infinity, -Infinity, -61, 13]) assert.throws(() => gainAmplitude(v));
  for (const v of [NaN, Infinity, -1.01, 1.01]) assert.throws(() => balance(v));
});
test('closed production schema validates all settings and preserves absent fields', () => {
  assert.equal(validateProject(project()).project!.master, undefined);
  const p = project(); p.master = {gainDb:-2,effects:[{type:'lowpass',frequencyHz:18000}]};
  p.tracks[0].mix = {gainDb:-4,pan:-0.2}; p.tracks[0].effects = [{type:'highpass',frequencyHz:120},{type:'delay',timeMs:100,wet:0.2}];
  assert.ok(validateProject(p).project);
  for (const effect of [{type:'reverb'}, {type:'delay',timeMs:0,wet:0.2}, {type:'delay',timeMs:100,wet:0.6}, {type:'highpass',frequencyHz:NaN}, {type:'lowpass',frequencyHz:22050}, {type:'highpass',frequencyHz:100,unknown:1}, null]) {
    p.tracks[0].effects = [effect]; assert.equal(validateProject(p).project, null);
  }
  p.tracks[0].effects = Array(9).fill({type:'lowpass',frequencyHz:1000}); assert.equal(validateProject(p).project,null);
  delete p.tracks[0].effects;
  for (const value of [NaN,Infinity,-61,13]) {p.master.gainDb=value;assert.equal(validateProject(p).project,null);}
});
test('PCM export reports overload without normalization, analysis handles silence and full scale', t => {
  const dir=mkdtempSync(join(tmpdir(),'production-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const q=quantize(new Float64Array([40000,-40000,100,100]));assert.equal(q.clippedSamples,2);assert.ok(q.preClipPeakDbfs!>0);
  const path=join(dir,'a.wav');writeFileSync(path,q.bytes);
  const a=analyzeWav(path).value!;assert.equal(a.clipping,true);assert.equal(a.fullScaleSamples,2);assert.equal(a.peakDbfs,0);assert.equal(a.frames,2);
  writeFileSync(path,encodePcm(new Int16Array(88200)));const silence=analyzeWav(path).value!;assert.equal(silence.durationSeconds,1);assert.equal(silence.peakDbfs,null);assert.equal(silence.rmsDbfs,null);
});
test('FFmpeg preflight provides structured missing executable error', async () => {
  const p=await createAudioProcessor({env:{DAEMONV12_FFMPEG:'/missing-ffmpeg'}});assert.equal(p.diagnostic?.code,'AUDIO_TOOL_NOT_FOUND');
});
test('real filters attenuate DC/high frequencies and delay preserves dry signal with exact tail', async t => {
  const probe=await createAudioProcessor({env:process.env});if(!probe.value){t.skip(probe.diagnostic.message);return;}
  const samples=new Float64Array(44100*2).fill(1000);
  const high=await probe.value.effects(samples,[{type:'highpass',frequencyHz:100}]);assert.ok(high.value);assert.ok(Math.abs(high.value.at(-1)!)<1);
  for(let i=0;i<44100;i++)samples[i*2]=samples[i*2+1]=1000*Math.sin(2*Math.PI*10000*i/44100);
  const low=await probe.value.effects(samples,[{type:'lowpass',frequencyHz:1000}]);assert.ok(low.value);assert.ok(Math.max(...low.value.slice(20000,21000))<20);
  samples.fill(0);samples[0]=samples[1]=1000;
  const delay=await probe.value.effects(samples,[{type:'delay',timeMs:100,wet:0.25}]);assert.ok(delay.value);assert.equal(delay.value.length, samples.length+8820);
  assert.ok(Math.abs(delay.value[0]!-1000)<0.01);assert.ok(Math.abs(delay.value[8820]!-250)<0.01);
});
test('schema rejects malformed mix/master shapes, pan and non-finite effect settings', () => {
  for(const mix of [null,[],{pan:NaN},{pan:Infinity},{pan:1.01},{pan:-1.01},{gainDb:13},{gainDb:-61},{unknown:1}]) {
    const p=project();p.tracks[0].mix=mix;assert.equal(validateProject(p).project,null);
  }
  for(const master of [null,[],{pan:0},{effects:{}},{effects:[{type:'delay',timeMs:Infinity,wet:0.1}]}]) {
    const p=project();p.master=master;assert.equal(validateProject(p).project,null);
  }
});
test('sine analysis agrees with analytic PCM peak/RMS and LUFS follows a known gain difference',async t=>{
  const probe=await createAudioProcessor({env:process.env});if(!probe.value){t.skip(probe.diagnostic.message);return;}
  const root=mkdtempSync(join(tmpdir(),'analysis-sine-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const samples=new Int16Array(44100*2*4);
  for(let i=0;i<samples.length/2;i++)samples[2*i]=samples[2*i+1]=Math.round(3276.8*Math.sin(2*Math.PI*1000*i/44100));
  const path=join(root,'sine.wav');writeFileSync(path,encodePcm(samples));
  const a=analyzeWav(path).value!;assert.ok(Math.abs(a.peakDbfs!+20)<0.01);assert.ok(Math.abs(a.rmsDbfs!+23.0103)<0.01);
  const loud=await probe.value.loudness(path);assert.ok(loud.value);
  writeFileSync(path,encodePcm(samples.map(v=>Math.round(v/2))));const quiet=await probe.value.loudness(path);assert.ok(quiet.value);
  assert.ok(Math.abs(loud.value.integratedLufs!-quiet.value.integratedLufs!-6.0206)<0.1);
});
