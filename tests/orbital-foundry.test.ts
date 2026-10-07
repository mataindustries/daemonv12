import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { generatePack, sounds } from '../scripts/generate-orbital-foundry.ts';
import { inspect } from '../scripts/inspect-orbital-foundry.ts';
import { decodePcm, encodePcm } from '../src/render/index.ts';
import { readWavInfo } from '../src/render/wav.ts';
import { compileProjectFile } from '../src/pipeline.ts';
import { parseKit } from '../src/project/sample-schema.ts';
import { DaemonTools } from '../mcp/handlers.ts';
const directory='examples/assets/orbital-foundry';
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');

test('Orbital Foundry regenerates exact checked-in source WAVs, kit, catalog and audition idempotently',t=>{
  const temp=mkdtempSync(join(tmpdir(),'orbital-source-'));t.after(()=>rmSync(temp,{recursive:true,force:true}));
  generatePack(temp);
  const files=readdirSync(directory).filter(f=>f.endsWith('.wav')||f==='kit.json');
  assert.equal(files.length,13);
  for(const file of files)assert.deepEqual(readFileSync(join(temp,'assets/orbital-foundry',file)),readFileSync(join(directory,file)),file);
  assert.deepEqual(readFileSync(join(temp,'orbital-foundry.catalog.json')),readFileSync('examples/orbital-foundry.catalog.json'));
  generatePack(temp);
  for(const file of files)assert.deepEqual(readFileSync(join(temp,'assets/orbital-foundry',file)),readFileSync(join(directory,file)),file);
  const generated=spawnSync(process.execPath,['scripts/create-orbital-foundry-audition.ts',temp],{encoding:'utf8'});
  assert.equal(generated.status,0,generated.stderr);
  assert.deepEqual(readFileSync(join(temp,'orbital-foundry-audition.json')),readFileSync('examples/orbital-foundry-audition.json'));
  assert.deepEqual(compileProjectFile(join(temp,'orbital-foundry-audition.json')).diagnostics,[]);
});

test('Orbital Foundry: twelve unique PCM16/44100 sources, intentional channel layouts, headroom and finite tails',()=>{
  const catalog=JSON.parse(readFileSync('examples/orbital-foundry.catalog.json','utf8'));
  const hashes=new Set<string>();
  for(const [i,s] of sounds.entries()) {
    const entry=catalog.sounds[i],bytes=readFileSync(join('examples',entry.file)),info=readWavInfo(bytes);
    assert.ok(info.ok);assert.equal(info.info.sampleRate,44100);assert.equal(info.info.bitsPerSample,16);
    assert.equal(info.info.formatTag,1);assert.equal(info.info.channels,s.channels);
    const pcm=decodePcm(bytes).pcm!;assert.equal(pcm.frames,Math.round(s.seconds*44100));
    let peak=0,sum=0,mean=0;
    for(const v of pcm.samples){peak=Math.max(peak,Math.abs(v));sum+=v*v;mean+=v;assert.ok(v>-32768&&v<32767);}
    assert.ok(Math.abs(20*Math.log10(peak/32768)-s.peak)<0.003,s.id);
    assert.ok(Math.sqrt(sum/pcm.samples.length)>100,s.id);
    assert.ok(Math.abs(mean/pcm.samples.length/32768)<0.001,s.id);
    for(let c=0;c<s.channels;c++){assert.equal(pcm.samples[c],0);assert.equal(pcm.samples[pcm.samples.length-1-c],0);}
    if(s.channels===2)assert.ok(pcm.samples.some((v,j)=>j%2===0&&v!==pcm.samples[j+1]),s.id);
    assert.equal(entry.sha256,hash(bytes));hashes.add(entry.sha256);
  }
  assert.equal(hashes.size,12);
});

test('Orbital Foundry kit names and sampler filenames are discoverable through existing MCP tools',async()=>{
  const kit=parseKit(JSON.parse(readFileSync(join(directory,'kit.json'),'utf8')),'kit');
  assert.deepEqual(kit.diagnostics,[]);assert.equal(kit.entries.length,7);
  assert.deepEqual(kit.entries.map(s=>s.name),sounds.filter(s=>s.pitch!==null).map(s=>s.id));
  const api=new DaemonTools(resolve('.'));
  const samples=await api.call('daemonv12_instruments_list',{project:'examples/orbital-foundry-audition.json',query:'orbital-foundry',limit:50});
  assert.equal(samples.ok,true);assert.deepEqual(samples.warnings,[]);assert.equal(samples.totalSamples,12);
  const kits=await api.call('daemonv12_drumkits_list',{project:'examples/orbital-foundry-audition.json'});
  assert.equal(kits.ok,true);assert.deepEqual(kits.warnings,[]);
  assert.ok((kits.kits as {kit:string}[]).some(k=>k.kit==='assets/orbital-foundry/kit.json'));
  const compiled=compileProjectFile('examples/orbital-foundry-audition.json');
  assert.deepEqual(compiled.diagnostics,[]);assert.equal(compiled.timeline!.tracks.length,12);
  assert.ok(compiled.timeline!.tracks.every(t=>t.notes.length>0));
});

test('offline spectral QC measures a known tone and includes very early transients',t=>{
  const temp=mkdtempSync(join(tmpdir(),'orbital-qc-'));t.after(()=>rmSync(temp,{recursive:true,force:true}));
  const path=join(temp,'tone.wav');
  writeFileSync(path,encodePcm(Int16Array.from({length:88200},(_,i)=>Math.round(10000*Math.sin(2*Math.PI*1000*Math.floor(i/2)/44100)))));
  assert.ok(inspect(path).bandPowerPercent['500-2000 Hz']!>99);
  const impulse=new Int16Array(8820);impulse[0]=10000;impulse[1]=10000;writeFileSync(path,encodePcm(impulse));
  const bands=Object.values(inspect(path).bandPowerPercent);assert.ok(bands.every(Number.isFinite));
  assert.ok(Math.abs(bands.reduce((a,b)=>a+b,0)-100)<0.1);
});

test('Orbital Foundry spectral roles contrast, rises build energy and low pulse recovers',()=>{
  const byId=Object.fromEntries(sounds.map((s,i)=>[s.id,inspect(`${directory}/${String(i+1).padStart(2,'0')}-${s.id}.wav`)]));
  assert.ok(byId['sub-pulse']!.bandPowerPercent['30-120 Hz']!>65);
  assert.ok(byId['machine-tick']!.bandPowerPercent['2000-6000 Hz']!>35);
  assert.ok(byId['metallic-strike']!.bandPowerPercent['30-120 Hz']!<1);
  assert.ok(byId['air-texture']!.bandPowerPercent['30-120 Hz']!<1);
  assert.ok(byId['dark-drone']!.bandPowerPercent['120-500 Hz']!>45);
  for(const id of ['tension-riser','reverse-swell']) {
    const levels=byId[id]!.perSecondRmsDbfs;
    assert.ok(levels.at(-1)!>levels[0]!+6,id);
  }
  const pcm=decodePcm(readFileSync(`${directory}/01-sub-pulse.wav`)).pcm!;
  let tail=0;for(const v of pcm.samples.slice(-2205))tail+=v*v;
  assert.ok(20*Math.log10(Math.sqrt(tail/2205)/32768)<-40);
});
