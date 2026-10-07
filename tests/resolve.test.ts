import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileProjectText, compileProjectFile, summarize } from '../src/pipeline.ts';
const minimal=()=>JSON.parse(readFileSync('tests/fixtures/valid/minimal.json','utf8'));
test('clip offset, chord expansion, default velocity, exact musical length',()=>{
 const p=minimal();p.bars=5;p.tracks[0].clips[0].bar=5;p.tracks[0].patterns[0].notes[0].pitch=['G4','C4','E4'];
 const r=compileProjectText(JSON.stringify(p));assert.deepEqual(r.diagnostics,[]);const t=r.timeline!;
 assert.equal(t.endTick,19200);assert.deepEqual(t.tracks[0]!.notes.slice(0,3).map(n=>[n.tick,n.pitch,n.velocity]),[[15360,60,0.8],[15360,64,0.8],[15360,67,0.8]]);
});
test('same-pitch boundaries, layering, nested overlap, clip and chord provenance',()=>{
 const p=minimal();const n=p.tracks[0].patterns[0].notes;
 n[1]={start:'1:2',pitch:'C4',duration:'1/4'};
 assert.deepEqual(compileProjectText(JSON.stringify(p)).diagnostics,[]);
 n[1].start='1:1+1/8';const d=compileProjectText(JSON.stringify(p)).diagnostics[0]!;
 assert.equal(d.code,'NOTE_OVERLAP');assert.match(d.message,/clips\[0\].*1:1.*1:1\+1\/8/);assert.match(d.hint!,/1\/8/);
 n[0].pitch=['C4','C4'];assert.match(compileProjectText(JSON.stringify(p)).diagnostics[0]!.message,/same chord/);
 n[0].pitch='C4';n[1].pitch='E4';p.tracks[0].clips.push({bar:1,pattern:'one'});
 assert.match(compileProjectText(JSON.stringify(p)).diagnostics[0]!.message,/clips\[1\]/);
 p.tracks[0].clips.pop();n[0].duration='1/1';n[1]={start:'1:2',pitch:'C4',duration:'1/8'};n.push({start:'1:3',pitch:'C4',duration:'1/8'});
 assert.equal(compileProjectText(JSON.stringify(p)).diagnostics.filter(d=>d.code==='NOTE_OVERLAP').length,2);
});
test('different pitches may overlap; different tracks may share a pitch',()=>{
 const p=minimal();p.tracks[0].patterns[0].notes[1].start='1:1';p.tracks.push({...structuredClone(p.tracks[0]),id:'second'});
 assert.deepEqual(compileProjectText(JSON.stringify(p)).diagnostics,[]);
});
test('demo summary is the normative contract',()=>{
 const r=compileProjectFile('examples/demo.json');assert.deepEqual(r.diagnostics,[]);
 assert.deepEqual(r.timeline!.tracks.map(t=>t.notes.length),[29,60]);
 assert.deepEqual(summarize(r.project!,r.timeline!),{title:'DaemonV12 Demo',bars:8,timeSignature:'4/4',bpm:96,key:'D minor',tracks:2,notes:89,durationTicks:30720,durationSeconds:20});
});
test('diagnostic cap counts omitted errors and warnings without compiling invalid input',()=>{
 const p=minimal();p.tracks[0].patterns[0].notes=Array.from({length:120},()=>({start:'1:1',pitch:'X4',duration:'1/4'}));
 const r=compileProjectText(JSON.stringify(p));assert.equal(r.diagnostics.length,100);assert.equal(r.omitted,20);assert.equal(r.timeline,null);
});
