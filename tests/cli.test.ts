import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const cli=resolve('bin/daemonv12.js');
export function run(args:string[],env:NodeJS.ProcessEnv=process.env){return spawnSync(process.execPath,[cli,...args],{encoding:'utf8',env});}
function temp(t:import('node:test').TestContext){const dir=mkdtempSync(join(tmpdir(),'daemonv12-cli-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return dir;}
test('CLI demo validate human and JSON',()=>{
 const human=run(['validate','examples/demo.json']);assert.equal(human.status,0);assert.equal(human.stdout,'OK examples/demo.json\n  "DaemonV12 Demo": 8 bars of 4/4 at 96 BPM, D minor, 2 tracks, 89 notes, 20.000 s\n');
 const r=run(['validate','examples/demo.json','--json']);assert.equal(r.status,0);const j=JSON.parse(r.stdout);
 assert.equal(j.ok,true);assert.deepEqual(j.errors,[]);assert.deepEqual(j.warnings,[]);assert.deepEqual(j.artifacts,{});assert.equal(j.manifest,null);
 assert.deepEqual(j.summary,{title:'DaemonV12 Demo',bars:8,timeSignature:'4/4',bpm:96,key:'D minor',tracks:2,notes:89,durationTicks:30720,durationSeconds:20});
});
test('CLI midi golden artifact and invalidation of stale WAV and manifest',t=>{
 const dir=temp(t);for(const f of ['demo.wav','demo.render.json','demo.wav.tmp'])writeFileSync(join(dir,f),'stale');
 const r=run(['midi','examples/demo.json','--out-dir',dir,'--json']);assert.equal(r.status,0);const j=JSON.parse(r.stdout);
 assert.deepEqual(j.artifacts,{midi:join(dir,'demo.mid')});assert.deepEqual(readdirSync(dir),['demo.mid']);
 const b=readFileSync(j.artifacts.midi);assert.equal(b.length,911);assert.equal(createHash('sha256').update(b).digest('hex'),'32bf52317120de2c48a5cab8292a614724c63acf3940ffa84f24a5fcebd536dc');
});
test('CLI project failures: codes, paths, syntax location, empty input',()=>{
 const p=run(['validate','tests/fixtures/invalid/bad-pitch.json','--json']);assert.equal(p.status,1);const e=JSON.parse(p.stdout).errors[0];assert.equal(e.code,'INVALID_PITCH');assert.equal(e.path,'tracks[0].patterns[0].notes[0].pitch');assert.ok(e.expected);assert.equal(e.received,'H#4');assert.ok(e.hint);
 const s=run(['validate','tests/fixtures/invalid/bad-syntax.json','--json']);assert.equal(s.status,1);const d=JSON.parse(s.stdout).errors[0];assert.equal(d.code,'JSON_PARSE_ERROR');assert.ok(d.line);assert.ok(d.column);
 const human=run(['validate','tests/fixtures/invalid/bad-pitch.json']);assert.equal(human.stdout,'');assert.match(human.stderr,/error\[INVALID_PITCH\]/);assert.match(human.stderr,/FAILED .*: 1 error\(s\), 0 warning\(s\)/);
});
test('CLI usage errors, missing/unreadable projects, help/version',()=>{
 for(const args of [[],['nonsense'],['validate'],['validate','a','b'],['validate','a','--unknown'],['midi','a','--soundfont','b'],['validate','a','--out-dir','b'],['midi','a','--out-dir'],['validate','a','--json=false']]){
  const r=run([...args,'--json']);assert.equal(r.status,2,JSON.stringify(args));const j=JSON.parse(r.stdout);assert.equal(j.errors[0].code,'USAGE_ERROR');assert.deepEqual(j.artifacts,{});
 }
 for(const [path,code] of [['/no/daemonv12.json','FILE_NOT_FOUND'],['tests','FILE_READ_FAILED']]){const r=run(['validate',path!,'--json']);assert.equal(r.status,2);assert.equal(JSON.parse(r.stdout).errors[0].code,code);}
 assert.equal(run(['--version']).stdout,'daemonv12 0.3.0\n');assert.equal(run(['-v']).status,0);
 for(const args of [['help'],['--help'],['-h']]){const r=run(args);assert.equal(r.status,0);assert.match(r.stdout,/Usage:/);}
 const empty=run([]);assert.equal(empty.status,2);assert.equal(empty.stdout,'');assert.match(empty.stderr,/Usage:/);
});
test('invalid project removes all old artifacts and temporary siblings; validate writes nothing',t=>{
 const dir=temp(t),input=join(dir,'case.JSON'),out=join(dir,'out');writeFileSync(input,readFileSync('examples/demo.json'));
 assert.equal(run(['midi',input,'--out-dir',out]).status,0);
 for(const f of ['case.wav','case.render.json','case.mid.tmp','case.wav.tmp','case.render.json.tmp'])writeFileSync(join(out,f),'stale');
 writeFileSync(input,readFileSync('tests/fixtures/invalid/bad-pitch.json'));
 const r=run(['midi',input,'--out-dir',out,'--json']);assert.equal(r.status,1);assert.deepEqual(JSON.parse(r.stdout).artifacts,{});assert.deepEqual(readdirSync(out),[]);
 writeFileSync(join(out,'case.mid'),'preserve');run(['validate',input]);assert.equal(readFileSync(join(out,'case.mid'),'utf8'),'preserve');
});
test('output write failure maps to environment exit 3 and retains compiled summary',t=>{
 const dir=temp(t),file=join(dir,'file');writeFileSync(file,'obstruction');
 const r=run(['midi','examples/demo.json','--out-dir',file,'--json']);assert.equal(r.status,3);const j=JSON.parse(r.stdout);assert.equal(j.errors[0].code,'OUTPUT_WRITE_FAILED');assert.equal(j.summary.notes,89);assert.deepEqual(j.artifacts,{});
});
const fakeEnv=(mode='ok')=>({...process.env,DAEMONV12_FLUIDSYNTH:resolve('tests/helpers/fake-fluidsynth.mjs'),DAEMONV12_SOUNDFONT:resolve('tests/fixtures/fake.sf2'),FAKE_FLUIDSYNTH_MODE:mode});
test('CLI render fake success: manifest keys, hashes, file bytes and reported artifacts',t=>{
 const dir=temp(t),r=run(['render','examples/demo.json','--out-dir',dir,'--json'],fakeEnv());assert.equal(r.status,0,r.stdout);const j=JSON.parse(r.stdout);
 assert.deepEqual(Object.keys(j.manifest),['engine','project','midi','renderer','soundfont','wav']);assert.equal(j.manifest.renderer.version,'9.9.9');assert.equal(j.manifest.soundfont.file,'fake.sf2');
 assert.equal(j.manifest.midi.sha256,'32bf52317120de2c48a5cab8292a614724c63acf3940ffa84f24a5fcebd536dc');
 assert.deepEqual(readdirSync(dir),['demo.mid','demo.render.json','demo.wav']);assert.equal(readFileSync(j.artifacts.manifest,'utf8'),JSON.stringify(j.manifest,null,2)+'\n');
 for(const [key,path] of [['project','examples/demo.json'],['midi',j.artifacts.midi],['wav',j.artifacts.wav],['soundfont','tests/fixtures/fake.sf2']])assert.equal(j.manifest[key].sha256,createHash('sha256').update(readFileSync(path)).digest('hex'));
 assert.deepEqual(j.manifest.renderer.settings,{sampleRate:44100,sampleFormat:'s16',channels:2,gain:0.5,reverb:false,chorus:false,cpuCores:1});
 assert.equal(j.manifest.project.seed,1);assert.equal(j.manifest.wav.durationSeconds,0.1);
});
for(const mode of ['silent-error','exit-1','no-output','bad-wav','empty-wav','float-wav','wrong-rate'])test(`CLI render ${mode} exits 3 with no stale artifacts`,t=>{
 const dir=temp(t);for(const f of ['demo.mid','demo.wav','demo.render.json','demo.mid.tmp','demo.wav.tmp','demo.render.json.tmp'])writeFileSync(join(dir,f),'stale');
 const r=run(['render','examples/demo.json','--out-dir',dir,'--json'],fakeEnv(mode));assert.equal(r.status,3);const j=JSON.parse(r.stdout);assert.equal(j.errors[0].code,'RENDERER_FAILED');assert.equal(j.summary.notes,89);assert.deepEqual(j.artifacts,{});assert.equal(j.manifest,null);assert.deepEqual(readdirSync(dir),[]);
});
test('CLI missing renderer and SoundFont exit 3; compile precedes render preflight',t=>{
 const dir=temp(t);
 for(const [args,env,code] of [
  [['--soundfont','/nope.sf2'],fakeEnv(),'SOUNDFONT_NOT_FOUND'],
  [[],{...fakeEnv(),DAEMONV12_FLUIDSYNTH:'/nope/fluidsynth'},'RENDERER_NOT_FOUND'],
  [['--soundfont','tests/fixtures/invalid/bad-syntax.json'],fakeEnv(),'SOUNDFONT_INVALID'],
 ] as const){for(const f of ['demo.mid','demo.wav','demo.render.json'])writeFileSync(join(dir,f),'stale');const r=run(['render','examples/demo.json','--out-dir',dir,...args,'--json'],env);assert.equal(r.status,3);assert.equal(JSON.parse(r.stdout).errors[0].code,code);assert.deepEqual(readdirSync(dir),[]);}
 const r=run(['render','tests/fixtures/invalid/bad-pitch.json','--out-dir',dir,'--soundfont','/missing','--json'],fakeEnv());assert.equal(r.status,1);assert.equal(JSON.parse(r.stdout).errors[0].code,'INVALID_PITCH');
});
test('CLI diagnostic cap and warning-only success',t=>{
 const dir=temp(t),file=join(dir,'project.json'),p=JSON.parse(readFileSync('tests/fixtures/valid/minimal.json','utf8'));
 p.tracks[0].patterns[0].notes=Array.from({length:105},()=>({start:'1:1',pitch:'X4',duration:'1/4'}));writeFileSync(file,JSON.stringify(p));
 const r=run(['validate',file,'--json']);assert.equal(r.status,1);const j=JSON.parse(r.stdout);assert.equal(j.errors.length,100);assert.equal(j.omitted,5);
 assert.match(run(['validate',file]).stderr,/… and 5 more/);
 p.tracks[0].patterns[0].notes=[];p.tracks[0].clips=[];writeFileSync(file,JSON.stringify(p));const w=run(['validate',file,'--json']);assert.equal(w.status,0);assert.equal(JSON.parse(w.stdout).warnings.length,2);
});
test('human diagnostics preserve traversal order across warnings and errors',t=>{
 const dir=temp(t),file=join(dir,'mixed.json'),p=JSON.parse(readFileSync('tests/fixtures/valid/minimal.json','utf8'));
 p.tracks[0].clips=[];p.tracks[0].patterns[0].notes[0].pitch='H4';writeFileSync(file,JSON.stringify(p));
 const r=run(['validate',file]);assert.equal(r.status,1);assert.ok(r.stderr.indexOf('warning[TRACK_EMPTY]')<r.stderr.indexOf('error[INVALID_PITCH]'));
});
test('render preflight failure creates no output directory',t=>{
 const dir=temp(t),out=join(dir,'uncreated');const r=run(['render','examples/demo.json','--out-dir',out,'--soundfont','/missing','--json'],fakeEnv());
 assert.equal(r.status,3);assert.deepEqual(readdirSync(dir),[]);
});
