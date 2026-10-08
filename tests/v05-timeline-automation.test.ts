import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileProjectText } from '../src/pipeline.ts';
import { renderPlan, automationFrames } from '../src/timing/render-plan.ts';
import { secondsToFrames, secondsToMicroseconds } from '../src/timing/wall-time.ts';
import { ticksToFrames } from '../src/timing/musical-time.ts';
import { automatedGainPan } from '../src/render/index.ts';
const project=()=>JSON.parse(readFileSync('tests/fixtures/valid/minimal.json','utf8'));
const compile=(p:unknown)=>compileProjectText(JSON.stringify(p));

test('V0.5 legacy duration remains natural with ceiling minimum; explicit boundaries round nearest once',()=>{
  const p=project();p.bpm=110;
  const legacy=renderPlan(compile(p).project!);
  assert.equal(legacy.outputFrames,null);assert.equal(legacy.audioEndFrames,null);
  assert.equal(legacy.minimumFrames,ticksToFrames(3840,545455,44100,true));
  p.bars=16;p.render={duration:{bars:16},tail:'none'};
  let plan=renderPlan(compile(p).project!);
  assert.equal(plan.outputFrames,ticksToFrames(16*3840,545455));
  p.render={duration:{musical:'1/240'},tail:'none'};p.bpm=120;
  plan=renderPlan(compile(p).project!);assert.equal(plan.outputFrames,368); // 16 ticks = 367.5 frames
  p.render={duration:{seconds:175.2},tail:'auto'};
  plan=renderPlan(compile(p).project!);assert.equal(plan.outputFrames,7726320);
  assert.equal(secondsToFrames(0.005),221);assert.equal(secondsToFrames(18.42),812322);
  assert.equal(secondsToMicroseconds(23.93),23930000n);
  assert.throws(()=>secondsToFrames(0.0000001));
});
test('V0.5 tail budget starts after authored end; explicit final duration caps/pads and never adds tail twice',()=>{
  const p=project();p.render={tail:'none'};
  assert.equal(renderPlan(compile(p).project!).outputFrames,88200);
  p.render={tail:{seconds:0.5}};
  assert.equal(renderPlan(compile(p).project!).outputFrames,110250);
  p.render={duration:{seconds:3},tail:'none'};
  let plan=renderPlan(compile(p).project!);assert.equal(plan.outputFrames,132300);assert.equal(plan.audioEndFrames,88200);
  p.render={duration:{seconds:3},tail:{seconds:0.5}};
  plan=renderPlan(compile(p).project!);assert.equal(plan.outputFrames,132300);assert.equal(plan.audioEndFrames,110250);
  p.render={duration:{seconds:1.5},tail:{seconds:2}};
  plan=renderPlan(compile(p).project!);assert.equal(plan.outputFrames,66150);assert.equal(plan.audioEndFrames,66150);
  p.bpm=110;p.render={tail:{seconds:0.005}};
  const expected=Number(((3840n*545455n+5000n*960n)*44100n+480000000n)/960000000n);
  assert.equal(renderPlan(compile(p).project!).outputFrames,expected);
});
test('V0.5 rejects invalid duration tags, precision, tails and oversized fixed output',()=>{
  for(const render of [null,[],{unknown:1},{duration:{}},{duration:{bars:4,seconds:8}},{duration:{seconds:0}},
    {duration:{seconds:0.000001}},{duration:{seconds:0.0000001}},{duration:{seconds:601}},
    {duration:{bars:0}},{duration:{musical:'1/7'}},{duration:{musical:'600/1'}},
    {tail:'natural'},{tail:{seconds:0}},{tail:{seconds:1,unknown:1}},{tail:{seconds:-1}}]) {
    const p=project();p.render=render;assert.equal(compile(p).timeline,null,JSON.stringify(render));
  }
});
test('V0.5 automation is canonical, ordered, bounded and uses a single tagged time basis per lane',()=>{
  const p=project();p.tracks[0].automation={gainDb:[{at:{musical:'1:1'},value:-12,transition:'linear'},{at:{musical:'2:1'},value:0}],pan:[{at:{seconds:0},value:-1},{at:{seconds:2},value:1}]};
  const c=compile(p);assert.ok(c.timeline,JSON.stringify(c.diagnostics));
  assert.deepEqual(automationFrames(c.project!.tracks[0]!.automation!.gainDb,c.project!),[{frame:0,value:-12,transition:'linear'},{frame:88200,value:0,transition:'step'}]);
  const invalid=[
    [],[{at:{seconds:1},value:0},{at:{seconds:1},value:1}],
    [{at:{seconds:1},value:0},{at:{seconds:0},value:1}],
    [{at:{seconds:0},value:0},{at:{seconds:0.000001},value:1}],
    [{at:{seconds:0},value:0},{at:{musical:'1:2'},value:1}],
    [{at:{seconds:0,musical:'1:1'},value:0}],
    [{at:{musical:'1:1+2/16'},value:0}],[{at:{musical:'2:2'},value:0}],
    [{at:{seconds:-1},value:0}],[{at:{seconds:0.0000001},value:0}],
    [{at:{seconds:0},value:13}],[{at:{seconds:0},value:-61}],
    [{at:{seconds:0},value:0,transition:'bezier'}],[{at:{seconds:0},value:0,unknown:1}],
    Array(1025).fill({at:{seconds:0},value:0}),
  ];
  for(const lane of invalid){p.tracks[0].automation={gainDb:lane};assert.equal(compile(p).timeline,null,JSON.stringify(lane).slice(0,300));}
  p.tracks[0].automation={pan:[{at:{seconds:0},value:1.1}]};assert.equal(compile(p).timeline,null);
});
test('V0.5 gain steps/linear dB ramps and pan steps/linear balance have exact boundary behavior',()=>{
  const samples=new Float64Array(22).fill(1000);
  const step=automatedGainPan(samples,-6,0,{gainDb:[{frame:2,value:0,transition:'step'},{frame:5,value:-12,transition:'step'}],pan:[{frame:4,value:-1,transition:'step'},{frame:7,value:1,transition:'step'}]});
  assert.ok(Math.abs(step[0]!-1000*10**(-6/20))<1e-8);assert.equal(step[4],1000);
  assert.equal(step[8],1000);assert.equal(step[9],0);assert.ok(Math.abs(step[10]!-1000*10**(-12/20))<1e-8);
  assert.equal(step[14],0);assert.ok(step[15]!>0);
  const linear=automatedGainPan(samples,0,0,{gainDb:[{frame:0,value:-20,transition:'linear'},{frame:10,value:0,transition:'step'}],pan:[{frame:0,value:-1,transition:'linear'},{frame:10,value:1,transition:'step'}]});
  assert.equal(linear[0],100);assert.equal(linear[1],0);
  assert.ok(Math.abs(linear[10]!-1000*10**(-10/20))<1e-8);assert.equal(linear[10],linear[11]);
  assert.equal(linear[20],0);assert.equal(linear[21],1000);
});
