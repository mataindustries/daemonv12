import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateProject } from '../src/project/validate.ts';
import { createAudioProcessor, builtinEffect, duckingEnvelope, applyDucking, PCM_RATE, type Pcm } from '../src/render/index.ts';
import { effectParameters, type Effect } from '../src/audio-types.ts';
const project=()=>JSON.parse(readFileSync('tests/fixtures/valid/minimal.json','utf8'));
function reference():Pcm {
  const samples=new Int16Array(PCM_RATE*4*2);
  for(let frame=PCM_RATE;frame<PCM_RATE*2;frame++) {
    const v=Math.round(8000*Math.sin(2*Math.PI*173*frame/PCM_RATE));
    samples[frame*2]=v;samples[frame*2+1]=-v; // Antiphase stereo must not cancel activity.
  }
  return {frames:samples.length/2,channels:2,samples};
}
const settings={amountDb:12,thresholdDb:-35,attackMs:100,releaseMs:300};
test('V0.5 VO RMS activity resists zero crossings; attack, release, amount and silence are measurable',()=>{
  const {reductionDb:r,metrics}=duckingEnvelope(reference(),4*PCM_RATE,settings);
  const at=(s:number)=>r[Math.round(s*PCM_RATE)]!;
  assert.equal(at(0.9),0);assert.ok(at(1.1)>6 && at(1.1)<8);
  assert.ok(at(1.6)>11.8);assert.ok(at(1.9)>11.98);
  assert.ok(at(2.32)>3.5&&at(2.32)<4.6);assert.ok(at(3.8)<0.04);
  assert.ok(metrics.activeFrames>PCM_RATE&&metrics.activeFrames<PCM_RATE*1.03);
  assert.equal(Math.round(metrics.maximumReductionDb),12);
  const silence=reference();silence.samples.fill(0);
  assert.ok(duckingEnvelope(silence,4*PCM_RATE,settings).reductionDb.every(v=>v===0));
  assert.ok(duckingEnvelope(reference(),4*PCM_RATE,{...settings,amountDb:0}).reductionDb.every(v=>v===0));
  assert.ok(duckingEnvelope(reference(),4*PCM_RATE,{...settings,thresholdDb:0}).reductionDb.every(v=>v===0));
  const fast=duckingEnvelope(reference(),4*PCM_RATE,{...settings,attackMs:10,releaseMs:30}).reductionDb;
  assert.ok(fast[Math.round(1.1*PCM_RATE)]!>r[Math.round(1.1*PCM_RATE)]!);
  assert.ok(fast[Math.round(2.32*PCM_RATE)]!<r[Math.round(2.32*PCM_RATE)]!);
});
test('V0.5 ducking is attenuation only, deterministic, and never mixes reference audio',()=>{
  const silent=new Float64Array(4*PCM_RATE*2);
  assert.ok(applyDucking(silent,reference(),settings).samples.every(v=>v===0));
  const music=new Float64Array(silent.length).fill(1000);
  const first=applyDucking(music,reference(),settings);
  assert.deepEqual(applyDucking(music,reference(),settings),first);
  assert.ok(Math.abs(first.samples[Math.round(1.9*PCM_RATE)*2]!-1000*10**(-12/20))<0.1);
  assert.ok(first.samples.every(v=>v>0&&v<=1000));
});
test('V0.5 all compressor/reverb/saturation parameters are closed, finite and bounded on tracks/master',()=>{
  for(const type of ['compressor','reverb','saturation'] as const) {
    const base={type,...Object.fromEntries(Object.entries(effectParameters[type]).map(([key,[min,max]])=>[key,(min+max)/2]))};
    const p=project();p.tracks[0].effects=[base];p.master={effects:[base]};assert.ok(validateProject(p).project);
    for(const [key,[min,max]] of Object.entries(effectParameters[type]))for(const value of [min-1,max+1,NaN,Infinity,null]) {
      p.tracks[0].effects=[{...base,[key]:value}];assert.equal(validateProject(p).project,null,`${type}.${key}=${value}`);
    }
    p.tracks[0].effects=[{...base,unknown:1}];assert.equal(validateProject(p).project,null);
  }
  const p=project();p.master={ducking:{source:'assets/vo.wav',...settings}};assert.ok(validateProject(p).project);
  for(const [key,value] of [['amountDb',-1],['amountDb',37],['thresholdDb',-61],['thresholdDb',1],['attackMs',0],['releaseMs',0],['releaseMs',9001],['amountDb',NaN]]) {
    p.master.ducking={source:'assets/vo.wav',...settings,[key as string]:value};assert.equal(validateProject(p).project,null);
  }
});
test('V0.5 algorithmic reverb decorrelates channels, adds finite tail and obeys explicit frame cap',()=>{
  const impulse=new Float64Array(PCM_RATE*2);impulse[0]=impulse[1]=10000;
  const effect:Effect={type:'reverb',roomSize:0.5,decaySeconds:0.5,wet:0.4};
  const output=builtinEffect(impulse,effect);
  assert.equal(output.length,PCM_RATE*3);assert.equal(output[0],6000);
  assert.ok(output.slice(2000).some(v=>Math.abs(v)>1));assert.notEqual(output[2*1116],output[2*1116+1]);
  assert.ok(output.slice(PCM_RATE*2).some(v=>v!==0));
  assert.equal(builtinEffect(impulse,effect,PCM_RATE).length,PCM_RATE*2);
  assert.deepEqual(builtinEffect(impulse,effect),output);
});
test('V0.5 saturation uses a smooth bounded transfer, mixes dry and creates measurable harmonics without normalization',()=>{
  const input=new Float64Array(PCM_RATE*2);
  for(let frame=0;frame<PCM_RATE;frame++)input[2*frame]=input[2*frame+1]=6000*Math.sin(2*Math.PI*440*frame/PCM_RATE);
  const saturated=builtinEffect(input,{type:'saturation',driveDb:18,mix:1});
  const amplitude=(samples:Float64Array,hz:number)=>{
    let sine=0,cosine=0;for(let i=0;i<PCM_RATE;i++){sine+=samples[i*2]!*Math.sin(2*Math.PI*hz*i/PCM_RATE);cosine+=samples[i*2]!*Math.cos(2*Math.PI*hz*i/PCM_RATE);}
    return 2*Math.hypot(sine,cosine)/PCM_RATE;
  };
  assert.ok(amplitude(saturated,1320)>500);assert.ok(amplitude(input,1320)<1e-8);
  assert.ok(Math.max(...saturated.slice(0,2000))>Math.max(...input.slice(0,2000)));
  assert.ok(saturated.every(v=>Math.abs(v)<32767));
  assert.deepEqual(builtinEffect(input,{type:'saturation',driveDb:18,mix:0}),input);
});
test('V0.5 FFmpeg compressor reduces peaks, makeup is explicit, and mixed effect order is preserved',async t=>{
  const probe=await createAudioProcessor({env:process.env});if(!probe.value){t.skip(probe.diagnostic.message);return;}
  const input=new Float64Array(PCM_RATE*2).fill(16000);
  const compressor:Effect={type:'compressor',thresholdDb:-18,ratio:4,attackMs:5,releaseMs:100};
  const reduced=(await probe.value.effects(input,[compressor])).value!;
  assert.ok(reduced.at(-1)!<6000&&reduced.at(-1)!>4500);
  const makeup=(await probe.value.effects(input,[{...compressor,makeupGainDb:6}])).value!;
  assert.ok(Math.abs(makeup.at(-1)!/reduced.at(-1)!-10**(6/20))<1e-8);
  const neutral=(await probe.value.effects(input,[{...compressor,ratio:1}])).value!;assert.ok(Math.abs(neutral.at(-1)!-16000)<1e-8);
  const saturation:Effect={type:'saturation',driveDb:8,mix:0.7};
  const a=(await probe.value.effects(input,[saturation,compressor])).value!;
  const b=(await probe.value.effects(input,[compressor,saturation])).value!;
  assert.ok(Math.abs(a.at(-1)!-b.at(-1)!)>500);
  assert.deepEqual((await probe.value.effects(input,[saturation,compressor])).value,a);
});
