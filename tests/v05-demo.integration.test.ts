import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAudioProcessor, encodePcm } from '../src/render/index.ts';
import { syntheticVoiceover, v05DemoProject, v05LoopProject } from '../scripts/generate-v05-fixtures.ts';
import { verifyV05 } from '../scripts/verify-v05.ts';
const probe=await createAudioProcessor({env:process.env});
test('V0.5 synthetic VO and both project fixtures regenerate exactly',()=>{
  assert.deepEqual(readFileSync('examples/assets/v05/synthetic-vo.wav'),encodePcm(syntheticVoiceover().samples));
  assert.equal(readFileSync('examples/v05-video-demo.json','utf8'),JSON.stringify(v05DemoProject(),null,2)+'\n');
  assert.equal(readFileSync('examples/v05-loop-demo.json','utf8'),JSON.stringify(v05LoopProject(),null,2)+'\n');
});
test('V0.5 Foundry acceptance: exact WAV/gapless MP3, automation/effects/ducking, aligned loop and canonical repeats',{skip:probe.diagnostic?.message??false},async t=>{
  const outDir=mkdtempSync(join(tmpdir(),'v05-acceptance-'));t.after(()=>rmSync(outDir,{recursive:true,force:true}));
  const report=await verifyV05(outDir,process.env);
  assert.equal(report.video.repeatIdentical,true);assert.equal(report.loop.alignedStems,2);
  t.diagnostic(JSON.stringify({video:report.video.metrics,regions:report.video.duckingRegions,loop:report.loop.metrics}));
});
