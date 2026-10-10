import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { createAudioProcessor, decodePcm } from '../src/render/index.ts';
const processor=await createAudioProcessor({env:process.env});
test('V0.5 real stdio create/read/transactional patch/validate/render supports the schema with nine tools',{skip:processor.diagnostic?.message??false},async t=>{
  const root=mkdtempSync(join(tmpdir(),'v05-stdio-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  cpSync('examples/assets',join(root,'assets'),{recursive:true});
  const client=new Client({name:'v05-test',version:'1'});
  const transport=new StdioClientTransport({command:process.execPath,args:[resolve('bin/daemonv12-mcp.js'),'--root',root]});
  await client.connect(transport);t.after(async()=>{await client.close();});
  const listed=await client.listTools();assert.equal(listed.tools.length,9);
  const call=async(name:string,args:Record<string,unknown>)=>(await client.callTool({name:`daemonv12_${name}`,arguments:args})).structuredContent as any;
  const project='cue.json';
  let current=await call('project_create',{project,title:'V0.5 MCP',bars:2,render:{duration:{seconds:3},tail:'none'}});
  assert.equal(current.ok,true,JSON.stringify(current));
  const automation={gainDb:[{at:{seconds:0},value:-12,transition:'linear'},{at:{seconds:1},value:-6}],pan:[{at:{musical:'1:1'},value:-0.5,transition:'linear'},{at:{musical:'2:1'},value:0.5}]};
  const effects=[{type:'compressor',thresholdDb:-18,ratio:3,attackMs:20,releaseMs:200},{type:'reverb',roomSize:0.5,decaySeconds:0.5,wet:0.2},{type:'saturation',driveDb:3,mix:0.2}];
  current=await call('project_patch',{project,expectedSha256:current.sha256,edits:[
    {op:'track_update',trackId:'lead',fields:{instrument:{type:'sampler',sample:'assets/orbital-foundry/10-dark-drone.wav'},automation,effects}},
    {op:'pattern_put',trackId:'lead',pattern:{id:'cue',bars:2,notes:[{start:'1:1',velocity:0.6}]}},
    {op:'clips_set',trackId:'lead',clips:[{bar:1,pattern:'cue'}]},
    {op:'project_update',fields:{master:{gainDb:-1,ducking:{source:'assets/v05/synthetic-vo.wav',amountDb:10,thresholdDb:-35,attackMs:50,releaseMs:300}}}},
  ]});assert.equal(current.ok,true,JSON.stringify(current));
  const before=readFileSync(join(root,project));
  const invalid=[
    {op:'project_update',fields:{render:{duration:{seconds:1,bars:1}}}},
    {op:'project_update',fields:{render:{duration:{seconds:0.0000001}}}},
    {op:'track_update',trackId:'lead',fields:{automation:{gainDb:[{at:{seconds:0},value:0},{at:{seconds:0},value:-6}]}}},
    {op:'project_update',fields:{master:{ducking:{source:'assets/../../outside.wav',amountDb:10,thresholdDb:-35,attackMs:50,releaseMs:300}}}},
    {op:'project_update',fields:{master:{ducking:{source:'assets/missing.wav',amountDb:10,thresholdDb:-35,attackMs:50,releaseMs:300}}}},
    {op:'track_update',trackId:'lead',fields:{effects:[{type:'reverb',roomSize:2,decaySeconds:1,wet:0.1}]}},
  ];
  for(const edit of invalid) {
    const result=await call('project_patch',{project,expectedSha256:current.sha256,edits:[{op:'project_update',fields:{title:'Must roll back'}},edit]});
    assert.equal(result.ok,false);assert.ok(result.errors[0].code);assert.deepEqual(readFileSync(join(root,project)),before);
  }
  const read=await call('project_read',{project});assert.equal(read.sha256,current.sha256);assert.deepEqual(read.document.render,{duration:{seconds:3},tail:'none'});assert.deepEqual(read.document.tracks[0].automation,automation);
  assert.equal((await call('project_validate',{project})).ok,true);
  const first=await call('render',{project,stems:true,format:'wav,mp3'});assert.equal(first.ok,true,JSON.stringify(first));
  assert.equal(decodePcm(readFileSync(join(root,first.artifacts.wav))).pcm!.frames,132300);
  assert.equal(decodePcm(readFileSync(join(root,first.artifacts.stems[0].wav))).pcm!.frames,132300);
  const info=await call('render_info',{manifest:first.artifacts.manifest,detail:'full'});
  assert.equal(info.manifest.production.master.ducking.mixedIntoMaster,false);assert.equal(info.manifest.timeline.resultingFrames,132300);
  assert.deepEqual(info.manifest.production.tracks[0].effects,effects);
  const second=await call('render',{project,stems:true});assert.equal(second.ok,true);
  assert.deepEqual(readFileSync(join(root,first.artifacts.wav)),readFileSync(join(root,second.artifacts.wav)));
  current=await call('project_patch',{project,expectedSha256:current.sha256,edits:[{op:'project_update',fields:{render:null,master:null}},{op:'track_update',trackId:'lead',fields:{automation:null,effects:null}}]});
  assert.equal(current.ok,true);const final=await call('project_read',{project});assert.equal(final.document.render,undefined);assert.equal(final.document.tracks[0].automation,undefined);
});
