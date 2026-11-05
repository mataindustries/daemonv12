import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encodePcm } from '../src/render/pcm.ts';
import { quantize } from '../src/render/production.ts';
import { readWavInfo } from '../src/render/wav.ts';
import { sumFloatPrecise, quantize24, fitPcm24, analyzePcm24 } from '../src/render/precision.ts';
import { renderProduction24 } from '../src/precision-render.ts';
import { diagnostic } from '../src/diagnostics.ts';
import { builtinEffect } from '../src/render/dynamics.ts';
import { createAudioProcessor, type AudioProcessor } from '../src/render/ffmpeg.ts';

const processor: AudioProcessor = { identity: {name:'test-float-pass-through',version:'1'},
  async effects(samples, effects, limit) { let value = samples; for (const effect of effects) {
    if (effect.type !== 'saturation' && effect.type !== 'reverb') throw new Error('Unexpected test effect.');
    value = builtinEffect(value, effect, limit);
  } return {value}; },
  async loudness() { return { value: { integratedLufs: null, loudnessRangeLu: null, truePeakDbfs: null } }; },
  async mp3() { throw new Error('No MP3 in precision unit tests.'); },
};
function fixture(t: TestContext, value = 1) {
  const root = mkdtempSync(join(tmpdir(), 'precision-')); t.after(() => rmSync(root, {recursive:true,force:true}));
  mkdirSync(join(root, 'assets')); const samples = new Int16Array(4410 * 2).fill(value);
  writeFileSync(join(root, 'assets/source.wav'), encodePcm(samples));
  const project: any = { formatVersion:1,title:'Precision proof',bpm:120,timeSignature:'4/4',bars:1,
    render:{duration:{seconds:0.1},tail:'none'},master:{gainDb:6.020599913},
    tracks:[{id:'voice',instrument:{type:'sampler',sample:'assets/source.wav'},mix:{gainDb:-6.020599913},
      patterns:[{id:'one',bars:1,notes:[{start:'1:1',velocity:0.1}]}],clips:[{bar:1,pattern:'one'}]}] };
  const path = join(root, 'proof.json'); const save = () => writeFileSync(path, JSON.stringify(project)); save();
  return {root, path, project, save};
}
test('real fractional voice detail survives PCM24 while the PCM16 route discards it', () => {
  const precise = sumFloatPrecise([{pcm:{frames:2,channels:1,samples:new Int16Array([1,-1])},frame:0,velocity:0.1}],2);
  assert.deepEqual([...precise], [0.1,0.1,-0.1,-0.1]);
  assert.equal(quantize(precise).bytes.readInt16LE(44),0);
  const output = quantize24(precise); assert.equal(output.bytes.readIntLE(44,3),26); assert.equal(output.bytes.readIntLE(50,3),-26);
  assert.equal(output.clippedSamples,0); assert.equal(readWavInfo(output.bytes).ok,true);
  assert.equal(analyzePcm24(output.bytes).nonzeroLowBytes,4);
  for(const v of [NaN,Infinity,-Infinity]) assert.throws(()=>quantize24(new Float64Array([v,0])));
  assert.throws(()=>quantize24(new Float64Array(3))); assert.throws(()=>quantize24(new Float64Array()));
});
test('PCM24 saturation, padding, mono cancellation and stereo statistics are explicit', () => {
  const clip=quantize24(new Float64Array([40000,-40000])); assert.equal(clip.clippedSamples,2);
  assert.equal(clip.bytes.readIntLE(44,3),8388607); assert.equal(clip.bytes.readIntLE(47,3),-8388608);
  const clean=quantize24(new Float64Array([1000,-1000,0.25,-0.25]));
  const analysis=analyzePcm24(clean.bytes); assert.equal(analysis.stereoCorrelation,-1); assert.equal(analysis.monoFoldRmsDbfs,null); assert.equal(analysis.monoFoldChangeDb,null);
  const fitted=fitPcm24(clean.bytes,4); assert.deepEqual(fitted.subarray(44,56),clean.bytes.subarray(44)); assert.ok(fitted.subarray(56).every(v=>v===0));
  assert.deepEqual(fitPcm24(fitted,2),clean.bytes); assert.equal(analyzePcm24(quantize24(new Float64Array(4)).bytes).stereoCorrelation,null);
});
test('native opt-in render retains fractional track gain, master gain and nonlinear effect detail; deterministic aligned24 stems',async t=>{
  const f=fixture(t); f.project.tracks[0].effects=[{type:'saturation',driveDb:6,mix:0.5}]; f.save();
  const a=await renderProduction24(f.path,join(f.root,'a'),{processor}); const b=await renderProduction24(f.path,join(f.root,'b'),{processor});
  const bytes=readFileSync(a.wav); assert.deepEqual(bytes,readFileSync(b.wav)); assert.deepEqual(a.manifest,b.manifest);
  assert.ok(bytes.readIntLE(44,3)>26); assert.ok(bytes.readIntLE(44,3)<52);
  assert.equal(a.manifest.master.analysis.nonzeroLowBytes,8820); assert.equal(a.manifest.stems[0]!.analysis.frames,4410);
  assert.equal(a.manifest.master.analysis.frames,4410); assert.equal(a.manifest.master.analysis.stereoCorrelation,1);
  assert.equal(a.manifest.master.clippedSamples,0); assert.equal(a.manifest.export.bitsPerSample,24);
  await assert.rejects(renderProduction24(f.path,join(f.root,'a'),{processor}),/new output directory/);
});
test('track overload remains floating until master attenuation, while exported stem clipping is reported',async t=>{
  const f=fixture(t,10000); f.project.tracks[0].patterns[0].notes=Array.from({length:4},()=>({start:'1:1',velocity:1}));
  f.project.tracks[0].mix.gainDb=0; f.project.master.gainDb=-6.020599913; f.save();
  const result=await renderProduction24(f.path,join(f.root,'render'),{processor});
  assert.equal(readFileSync(result.wav).readIntLE(44,3),5120000); assert.equal(result.manifest.master.clippedSamples,0);
  assert.equal(result.manifest.stems[0]!.clippedSamples,8820); assert.ok(result.manifest.warnings.some(w=>w.includes('stems overloaded')));
});
test('invalid or GM projects and processing failures leave no output or intermediate artifacts',async t=>{
  const f=fixture(t), out=join(f.root,'failed');
  const broken={...processor,async effects() {return {diagnostic:diagnostic('AUDIO_PROCESSING_FAILED','','test','working float effects')};}};
  await assert.rejects(renderProduction24(f.path,out,{processor:broken}),/Track voice/);
  assert.equal(existsSync(out),false); assert.ok(!readdirSync(f.root).some(n=>n.startsWith('.production24-')));
  f.project.tracks[0].instrument={type:'gm',program:'acoustic_grand_piano'};
  f.project.tracks[0].patterns[0].notes=[{start:'1:1',pitch:'C4',duration:'1/4'}]; f.save();
  await assert.rejects(renderProduction24(f.path,out,{processor}),/sampler\/drumkit tracks only/); assert.equal(existsSync(out),false);
});
test('real FFmpeg float filtering and loudness accept a PCM24 master with sub16 signal',async t=>{
  const real=await createAudioProcessor({env:process.env}); if(!real.value){t.skip(real.diagnostic.message);return;}
  const f=fixture(t,1000);f.project.tracks[0].effects=[{type:'highpass',frequencyHz:120}]; f.project.tracks[0].mix.gainDb=-60; f.project.master.gainDb=-12; f.save();
  const result=await renderProduction24(f.path,join(f.root,'real'),{processor:real.value});
  assert.equal(result.manifest.master.analysis.bitsPerSample,24); assert.ok(result.manifest.master.analysis.nonzeroLowBytes>0);
  assert.ok(result.manifest.master.analysis.peakDbfs! < -100); assert.equal(result.manifest.master.clippedSamples,0);
  assert.ok(Object.hasOwn(result.manifest.master.analysis,'truePeakDbfs'));
});
