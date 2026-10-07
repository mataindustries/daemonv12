import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateProject } from '../src/project/validate.ts';
import { loadProject, parseProjectText } from '../src/project/load.ts';
import { compileProjectText } from '../src/pipeline.ts';
import type { DiagnosticCode } from '../src/diagnostics.ts';
// These fixtures deliberately contain values outside the authored schema.
type Mutable = Record<string, any>;
export const minimal = (): Mutable => JSON.parse(readFileSync('tests/fixtures/valid/minimal.json','utf8'));
const np='tracks[0].patterns[0].notes';
type Case = [number,(p:Mutable,n:Mutable[])=>unknown,DiagnosticCode,string,string?];
const cases:Case[]=[
 [1,(_,n)=>n[0]!.pitch='H#4','INVALID_PITCH',`${np}[0].pitch`],
 [2,(_,n)=>n[0]!.pitch='G#9','INVALID_PITCH',`${np}[0].pitch`],
 [3,(_,n)=>n[0]!.pitch=['C4','X4'],'INVALID_PITCH',`${np}[0].pitch[1]`],
 [4,(_,n)=>n[0]!.pitch=[],'OUT_OF_RANGE',`${np}[0].pitch`],
 [5,(_,n)=>n[0]!.velocty=0.5,'UNKNOWN_FIELD',`${np}[0].velocty`,'velocity'],
 [6,(_,n)=>{delete n[0]!.duration;n[0]!.dur='1/4';},'MISSING_FIELD',`${np}[0].duration`],
 [7,p=>delete p.bpm,'MISSING_FIELD','bpm'],
 [8,p=>{delete p.bpm;p.tempo=120;},'MISSING_FIELD','bpm'],
 [9,p=>p.bars='1','WRONG_TYPE','bars'], [10,p=>p.bars=2.5,'WRONG_TYPE','bars'],
 [11,p=>p.bpm=500,'OUT_OF_RANGE','bpm'], [12,p=>p.title='   ','OUT_OF_RANGE','title'],
 [13,p=>p.timeSignature='4/3','INVALID_TIME_SIGNATURE','timeSignature'],
 [14,p=>p.timeSignature='4:4','INVALID_TIME_SIGNATURE','timeSignature','4/4'],
 [15,p=>p.key='D dorian','INVALID_KEY','key'], [16,p=>p.key='D# major','INVALID_KEY','key','Eb major'],
 [17,p=>p.formatVersion=2,'UNSUPPORTED_FORMAT_VERSION','formatVersion'],
 [18,p=>p.tracks[0].instrument.type='sampler','UNSUPPORTED_INSTRUMENT_TYPE','tracks[0].instrument.type'],
 [19,p=>p.tracks[0].instrument.program='acoustic_grand_pianoo','UNKNOWN_GM_PROGRAM','tracks[0].instrument.program','acoustic_grand_piano'],
 [20,p=>p.tracks[0].instrument.program=33,'WRONG_TYPE','tracks[0].instrument.program','electric_bass_finger'],
 [21,p=>p.tracks[0].id='Lead Synth','INVALID_ID','tracks[0].id','lead-synth'],
 [22,p=>p.tracks.push(structuredClone(p.tracks[0])),'DUPLICATE_ID','tracks[1].id'],
 [23,(_,n)=>n[0]!.start='1.2.1','INVALID_POSITION',`${np}[0].start`,'BAR:BEAT'],
 [24,(_,n)=>n[0]!.start='0:1','INVALID_POSITION',`${np}[0].start`,'1-based'],
 [25,(_,n)=>n[0]!.start='1:5','POSITION_OUT_OF_RANGE',`${np}[0].start`],
 [26,(_,n)=>n[1]!.start='1:2+1/4','POSITION_OUT_OF_RANGE',`${np}[1].start`,'1:3'],
 [27,(_,n)=>n[0]!.start='2:1','POSITION_OUT_OF_RANGE',`${np}[0].start`],
 [28,(_,n)=>n[0]!.duration='4n','INVALID_DURATION',`${np}[0].duration`,'1/4'],
 [29,(_,n)=>n[0]!.duration=0.25,'WRONG_TYPE',`${np}[0].duration`,'1/4'],
 [30,(_,n)=>n[0]!.duration='1/7','OFF_GRID',`${np}[0].duration`],
 [31,(_,n)=>n[0]!.start='1:1+1/7','OFF_GRID',`${np}[0].start`],
 [32,(_,n)=>n[0]!.duration='2/1','NOTE_EXCEEDS_PATTERN',`${np}[0].duration`],
 [33,(_,n)=>n[0]!.velocity=100,'OUT_OF_RANGE',`${np}[0].velocity`,'0.79'],
 [34,(_,n)=>n[0]!.velocity=0,'OUT_OF_RANGE',`${np}[0].velocity`],
 [35,p=>p.tracks[0].clips[0].pattern='onee','UNKNOWN_PATTERN','tracks[0].clips[0].pattern','one'],
 [36,p=>p.tracks[0].clips[0].bar=2,'CLIP_EXCEEDS_PROJECT','tracks[0].clips[0].bar'],
 [37,(_,n)=>n.push({start:'1:1+1/8',pitch:'C4',duration:'1/8'}),'NOTE_OVERLAP',`${np}[2]`],
 [38,(_,n)=>n[0]!.pitch=['C4','C4'],'NOTE_OVERLAP',`${np}[0]`],
 [39,p=>p.tracks=Array.from({length:16},(_,i)=>({...structuredClone(p.tracks[0]),id:`track-${i}`})),'OUT_OF_RANGE','tracks'],
 [40,p=>p.tracks=[],'OUT_OF_RANGE','tracks'],
 [41,()=>[], 'WRONG_TYPE',''],
 [42,p=>p.patterns=[],'UNKNOWN_FIELD','patterns','tracks[i].patterns'],
 [43,(p,n)=>{p.timeSignature='4/3';n[0]!.start='1:9';},'INVALID_TIME_SIGNATURE','timeSignature'],
 [44,(p,n)=>{n[0]!.pitch='H#4';p.bpm=500;n[0]!.velocty=1;},'OUT_OF_RANGE','bpm'],
];
const compile = compileProjectText;
for(const [index,mutate,code,path,hint] of cases) test(`handoff validation case ${index}`,()=>{
 const p=minimal();const changed=mutate(p,p.tracks[0].patterns[0].notes);
 const ds=compile(JSON.stringify(index===41?changed:p)).diagnostics;
 const errors=ds.filter(d=>d.severity==='error');
 assert.equal(errors[0]?.code,code);assert.equal(errors[0]?.path,path);
 if(hint)assert.ok(errors[0]?.hint?.includes(hint));
 if(index===6||index===8) {assert.equal(errors.length,2);assert.equal(errors[1]?.code,'UNKNOWN_FIELD');assert.ok(errors[1]?.hint?.includes(index===6?'duration':'bpm'));}
 if(index===17||index===43)assert.equal(ds.length,1);
 if(index===20)assert.ok(errors[0]?.hint?.includes('acoustic_bass'));
 if(index===44)assert.deepEqual(errors.map(d=>[d.code,d.path]),[['OUT_OF_RANGE','bpm'],['INVALID_PITCH',`${np}[0].pitch`],['UNKNOWN_FIELD',`${np}[0].velocty`]]);
});
test('handoff case 45: unused pattern warning',()=>{const p=minimal();p.tracks[0].patterns.push({id:'two',bars:1,notes:[]});const ds=compile(JSON.stringify(p)).diagnostics;assert.deepEqual(ds.map(d=>[d.code,d.path,d.severity]),[['PATTERN_UNUSED','tracks[0].patterns[1]','warning']]);});
test('handoff case 46: empty track warning',()=>{const p=minimal();p.tracks.push({id:'pad',instrument:{type:'gm',program:'pad_2_warm'},clips:[],patterns:[]});assert.deepEqual(compile(JSON.stringify(p)).diagnostics.map(d=>[d.code,d.path,d.severity]),[['TRACK_EMPTY','tracks[1].clips','warning']]);});
test('minimal and demo normalize without diagnostics',()=>{
 for(const path of ['tests/fixtures/valid/minimal.json','examples/demo.json']) {const r=validateProject(loadProject(path).value);assert.deepEqual(r.diagnostics,[]);assert.ok(r.project);assert.equal(r.project.tracks[0]!.patterns[0]!.notes[0]!.startTicks,0);}
 const p=validateProject(minimal()).project!;assert.equal(p.seed,0);assert.equal(p.key,null);assert.equal(p.description,null);assert.equal(p.tracks[0]!.patterns[0]!.notes[1]!.velocity,0.8);
});
test('loading BOM, syntax locations, empty input, missing and unreadable files',()=>{
 assert.deepEqual(parseProjectText('\uFEFF{}').value,{});
 const bad=loadProject('tests/fixtures/invalid/bad-syntax.json').diagnostics[0]!;
 assert.equal(bad.code,'JSON_PARSE_ERROR');assert.equal(bad.line,3);assert.ok(bad.column);
 assert.equal(parseProjectText('').diagnostics[0]?.code,'JSON_PARSE_ERROR');
 assert.equal(loadProject('/nonexistent/daemonv12.json').diagnostics[0]?.code,'FILE_NOT_FOUND');
 assert.equal(loadProject('tests').diagnostics[0]?.code,'FILE_READ_FAILED');
 assert.match(parseProjectText('{"duration":1/4}').diagnostics[0]!.hint!,/strings/);
});
test('closed objects, quoted unknown paths, aliases do not override present targets',()=>{
 const p=minimal();p.tracks[0]['my key']=1;p.tracks[0].clips[0].id='one';p.tracks[0].instrument.kind='gm';
 const ds=validateProject(p).diagnostics;assert.deepEqual(ds.map(d=>d.path),['tracks[0].instrument.kind','tracks[0].clips[0].id','tracks[0]["my key"]']);
 assert.equal(ds[0]!.hint,undefined);assert.equal(ds[1]!.hint,undefined);
});
test('malformed containers and independent errors never throw or cascade',()=>{
 for(const v of [null,[],true,42,'x'])assert.equal(validateProject(v).diagnostics[0]?.code,'WRONG_TYPE');
 for(const field of ['tracks','title','bpm','bars','seed','description']){const p=minimal();p[field]=null;assert.ok(validateProject(p).diagnostics.some(d=>d.path===field));}
 for(const field of ['instrument','clips','patterns']){const p=minimal();p.tracks[0][field]=null;assert.ok(validateProject(p).diagnostics.some(d=>d.path===`tracks[0].${field}`));}
 const p=minimal();p.formatVersion='1';p.bpm=500;assert.equal(validateProject(p).diagnostics.length,1);
 p.formatVersion=1;p.tracks[0].patterns[0].bars='bad';p.tracks[0].patterns[0].notes[0].duration='2/1';assert.ok(!validateProject(p).diagnostics.some(d=>d.code==='NOTE_EXCEEDS_PATTERN'));
});
test('numeric and length boundaries; duplicate local ids',()=>{
 for(const [field,bad] of [['seed',-1],['seed',4294967296],['bars',0],['bars',1001],['bpm',19.9],['bpm',300.1],['title','x'.repeat(201)],['description','x'.repeat(2001)]] as const){const p=minimal();p[field]=bad;assert.equal(validateProject(p).diagnostics[0]?.code,'OUT_OF_RANGE');}
 for(const [field,v] of [['seed',4294967295],['bpm',20],['bpm',300],['title','x'.repeat(200)],['description','x'.repeat(2000)]] as const){const p=minimal();p[field]=v;assert.deepEqual(validateProject(p).diagnostics,[]);}
 const p=minimal();p.tracks[0].patterns.push(structuredClone(p.tracks[0].patterns[0]));const d=validateProject(p).diagnostics.find(d=>d.code==='DUPLICATE_ID');assert.equal(d?.path,'tracks[0].patterns[1].id');assert.match(d!.hint!,/patterns\[0\].id/);
});
