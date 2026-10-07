import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, symlinkSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { resolveSoundfont, createDefaultRenderer } from '../src/render/index.ts';
import { buildArgs } from '../src/render/fluidsynth.ts';
import { readWavInfo } from '../src/render/wav.ts';
const fake=resolve('tests/helpers/fake-fluidsynth.mjs');
function temp(t:import('node:test').TestContext){const dir=mkdtempSync(join(tmpdir(),'daemonv12-adapter-'));t.after(()=>rmSync(dir,{force:true,recursive:true}));return dir;}
const env=(mode:string)=>({...process.env,DAEMONV12_FLUIDSYNTH:fake,FAKE_FLUIDSYNTH_MODE:mode});
const sf=()=>resolveSoundfont({soundfont:'tests/fixtures/fake.sf2',env:{}});
test('SoundFont precedence, defaults, identity, missing paths and invalid magic',async t=>{
 const dir=temp(t),bad=join(dir,'bad.sf2'),link=join(dir,'alias.sf2');writeFileSync(bad,'not sf2');symlinkSync(resolve('tests/fixtures/fake.sf2'),link);
 const flag=await resolveSoundfont({soundfont:link,env:{DAEMONV12_SOUNDFONT:'/missing'},defaults:['/missing']});assert.ok(flag.value);assert.equal(flag.value.file,'fake.sf2');assert.equal(flag.value.bytes,12);assert.equal(flag.value.sha256,createHash('sha256').update(readFileSync(link)).digest('hex'));
 assert.ok((await resolveSoundfont({env:{DAEMONV12_SOUNDFONT:link},defaults:[]})).value);
 assert.ok((await resolveSoundfont({env:{DAEMONV12_SOUNDFONT:''},defaults:['/missing',link]})).value);
 for(const options of [{soundfont:'/missing',env:{DAEMONV12_SOUNDFONT:link}},{env:{DAEMONV12_SOUNDFONT:'/missing'},defaults:[link]},{env:{},defaults:[]}])assert.equal((await resolveSoundfont(options)).diagnostic?.code,'SOUNDFONT_NOT_FOUND');
 for(const soundfont of [bad,dir])assert.equal((await resolveSoundfont({soundfont,env:{}})).diagnostic?.code,'SOUNDFONT_INVALID');
 const denied=join(dir,'denied.sf2');writeFileSync(denied,readFileSync(link));chmodSync(denied,0);if(process.getuid?.()!==0)assert.equal((await resolveSoundfont({soundfont:denied,env:{}})).diagnostic?.code,'SOUNDFONT_INVALID');
});
test('exact FluidSynth argv',()=>assert.deepEqual(buildArgs('sound font.sf2','input.mid','out.wav.tmp'),['-n','-i','-F','out.wav.tmp','-T','wav','-O','s16','-r','44100','-g','0.5','-R','0','-C','0','-o','synth.cpu-cores=1','sound font.sf2','input.mid']));
test('fake success and WAV chunk parsing including odd-size padding',async t=>{
 const dir=temp(t),wav=join(dir,'out.wav');const factory=await createDefaultRenderer({soundfont:(await sf()).value!,env:env('ok')});assert.ok(factory.value);
 const r=await factory.value.render({midiPath:'input.mid',wavPath:wav});assert.ok(r.ok);assert.equal(r.renderer.version,'9.9.9');assert.equal(r.wav.frames,4410);
 const b=readFileSync(wav),parsed=readWavInfo(b);assert.ok(parsed.ok);assert.equal(parsed.info.dataOffset,44);
 const junk=Buffer.from('4a554e4b0300000061626300','hex'),extended=Buffer.concat([b.subarray(0,12),junk,b.subarray(12)]);extended.writeUInt32LE(extended.length-8,4);
 const extra=readWavInfo(extended);assert.ok(extra.ok);assert.equal(extra.info.dataOffset,56);
 for(const broken of [Buffer.alloc(0),Buffer.from('not a wav'),b.subarray(0,30),b.subarray(0,b.length-1)])assert.equal(readWavInfo(broken).ok,false);
 const inconsistent=Buffer.from(b);inconsistent.writeUInt16LE(7,32);assert.equal(readWavInfo(inconsistent).ok,false);
});
for(const mode of ['silent-error','exit-1','no-output','bad-wav','hang','empty-wav','float-wav','wrong-rate','long-error'])test(`fake failure ${mode}: rejects false success and removes stale WAV/tmp`,async t=>{
 const dir=temp(t),wav=join(dir,'out.wav');writeFileSync(wav,'stale');writeFileSync(wav+'.tmp','stale');
 const factory=await createDefaultRenderer({soundfont:(await sf()).value!,env:env(mode),timeoutMs:mode==='hang'?150:5000});assert.ok(factory.value);
 const r=await factory.value.render({midiPath:'input.mid',wavPath:wav});assert.equal(r.ok,false);if(r.ok)return;
 assert.equal(r.diagnostic.code,'RENDERER_FAILED');assert.ok(r.diagnostic.hint?.includes('-F'));assert.ok(r.diagnostic.message);
 assert.ok((r.diagnostic.received as {stderr:string}).stderr.length<=2000);assert.deepEqual(readdirSync(dir),[]);
});
test('probe missing, non-executable, failure, timeout and unknown version',async t=>{
 const soundfont=(await sf()).value!,dir=temp(t),notExecutable=join(dir,'binary');writeFileSync(notExecutable,'#!/bin/sh\nexit 0\n');
 assert.equal((await createDefaultRenderer({soundfont,env:{...process.env,DAEMONV12_FLUIDSYNTH:'/missing/fluidsynth'}})).diagnostic?.code,'RENDERER_NOT_FOUND');
 assert.equal((await createDefaultRenderer({soundfont,env:{...process.env,DAEMONV12_FLUIDSYNTH:notExecutable}})).diagnostic?.code,'RENDERER_FAILED');
 for(const mode of ['probe-fail','probe-hang'])assert.equal((await createDefaultRenderer({soundfont,env:env(mode),probeTimeoutMs:100})).diagnostic?.code,'RENDERER_FAILED');
 const r=await createDefaultRenderer({soundfont,env:env('unknown-version')});assert.ok(r.value);const out=await r.value.render({midiPath:'input.mid',wavPath:join(dir,'unknown.wav')});assert.ok(out.ok);assert.equal(out.renderer.version,'unknown');
});
