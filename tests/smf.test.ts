import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import tonejs from '@tonejs/midi';
import { encodeSmf, encodeVlq } from '../src/midi/smf.ts';
import { compileProjectFile, compileProjectText } from '../src/pipeline.ts';
const minimal=()=>JSON.parse(readFileSync('tests/fixtures/valid/minimal.json','utf8'));
const encode=(p:unknown)=>{const c=compileProjectText(JSON.stringify(p));assert.deepEqual(c.diagnostics,[]);return Buffer.from(encodeSmf(c.timeline!));};
test('minimal 96 golden bytes and SHA-256',()=>{
 const bytes=Buffer.from(encodeSmf(compileProjectFile('tests/fixtures/valid/minimal.json').timeline!));
 const hex=`4d546864000000060001000203c0 4d54726b0000001f 00ff03074d696e696d616c 00ff580404021808 00ff510307a120 9e00ff2f00 4d54726b00000023 00ff03046c656164 00c000 00903c66 8740803c40 8360904066 8360804040 8f00ff2f00`.replaceAll(' ','');
 assert.equal(bytes.toString('hex'),hex);assert.equal(bytes.length,96);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'8c96235bf3f12d96cd33c370ff238962a9fd5c0e3cc45e53fe4480dd4f05e6fc');
});
test('all VLQ golden values',()=>{
 for(const [n,h] of [[0,'00'],[127,'7f'],[128,'8100'],[480,'8360'],[960,'8740'],[1920,'8f00'],[3840,'9e00'],[16383,'ff7f'],[16384,'818000'],[30720,'81f000'],[0x0fffffff,'ffffff7f']] as const)assert.equal(Buffer.from(encodeVlq(n)).toString('hex'),h);
});
test('canonical bytes ignore note, chord, pattern, clip and JSON key order',()=>{
 const p=JSON.parse(readFileSync('examples/demo.json','utf8'));const original=encode(p);assert.deepEqual(encode(p),original);
 for(const t of p.tracks){t.clips.reverse();t.patterns.reverse();for(const pat of t.patterns){pat.notes.reverse();for(const note of pat.notes)if(Array.isArray(note.pitch))note.pitch.reverse();}}
 assert.deepEqual(encode(p),original);
 const reverse=(v:any):any=>Array.isArray(v)?v.map(reverse):v && typeof v==='object'?Object.fromEntries(Object.entries(v).reverse().map(([k,x])=>[k,reverse(x)])):v;
 assert.deepEqual(encode(reverse(p)),original);p.tracks.reverse();assert.notDeepEqual(encode(p),original);
});
test('same tick note-off precedes note-on and every event has status',()=>{
 const p=minimal();p.tracks[0].patterns[0].notes[1]={start:'1:2',pitch:'C4',duration:'1/4'};
 assert.ok(encode(p).includes(Buffer.from('8740803c4000903c66','hex')));
});
test('12 tracks skip channel 9; velocity clamp and UTF-8 byte lengths',()=>{
 const p=minimal();p.tracks=Array.from({length:12},(_,i)=>({...structuredClone(p.tracks[0]),id:`track-${i}`}));
 const midi=new tonejs.Midi(encode(p));assert.deepEqual(midi.tracks.map(t=>t.channel),[0,1,2,3,4,5,6,7,8,10,11,12]);
 const q=minimal();q.title='🎵'.repeat(70);q.tracks[0].patterns[0].notes[0].velocity=Number.MIN_VALUE;
 const bytes=encode(q);assert.ok(bytes.includes(Buffer.from([0,0xff,3,0x82,0x18])));assert.equal(new tonejs.Midi(bytes).tracks[0]!.notes[0]!.velocity,1/127);
});
test('meter/key metadata, tempo rounding, EOT includes trailing silence',()=>{
 const p=minimal();p.timeSignature='6/8';p.key='D minor';p.bpm=110;p.tracks[0].patterns[0].notes[1].start='1:2';p.tracks[0].patterns[0].notes[0].duration='1/8';
 const bytes=encode(p);assert.ok(bytes.includes(Buffer.from('ff580406030c08','hex')));assert.ok(bytes.includes(Buffer.from('ff5902ff01','hex')));assert.ok(bytes.includes(Buffer.from('ff51030852af','hex')));
 const midi=new tonejs.Midi(bytes);assert.equal(midi.tracks[0]!.endOfTrackTicks,2880);
});
