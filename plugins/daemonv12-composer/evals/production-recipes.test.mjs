// Contract checks, not agent-behavior or musical-quality evaluations.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { compileProjectTextWithAssets, compileProjectFile } from '../../../src/pipeline.ts';
import { parsePosition, ticksToFrames } from '../../../src/timing/musical-time.ts';
import { renderPlan } from '../../../src/timing/render-plan.ts';
import { readWavInfo } from '../../../src/render/wav.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const fixtures = JSON.parse(readFileSync(new URL('../skills/daemonv12-composer/references/production-recipes.json', import.meta.url), 'utf8'));
assert.equal(fixtures.engineCommit, '02438eda48506a94d10ad2756c6aafff8c5a9469');
// A plugin commit may differ; the engine files must remain pinned to this base.
execFileSync('git', ['diff', '--exit-code', fixtures.engineCommit, '--', 'src/', 'bin/', 'package.json', 'package-lock.json', 'examples/'], { cwd: root, stdio: 'inherit' });
const destination = join(root, 'examples', 'composer-recipe-validation.json'); // virtual path; never written
function compile(project) {
  return compileProjectTextWithAssets(JSON.stringify(project), destination);
}
function valid(project) {
  const result = compile(project);
  assert.deepEqual(result.diagnostics, []);
  assert(result.project && result.timeline);
  return result;
}
function changedNote(fields, instrument) {
  const project = structuredClone(fixtures.recipes[0].project);
  project.tracks = [project.tracks[0]];
  if (instrument) project.tracks[0].instrument = instrument;
  project.tracks[0].patterns[0].notes = [{ start: '1:1', ...fields }];
  return project;
}
for (const { id, project } of fixtures.recipes) {
  test(`asset-aware v0.7 validation: ${id}`, () => valid(project));
}

test('B04/B08 accept sampled articulation independently, defaults and boundaries', () => {
  for (const fields of [
    { endSeconds: .4 }, { gate: '1/16' }, { envelope: {} }, { chokeGroup: 'bass' },
    { envelope: { attackSeconds: 0, releaseSeconds: 0 } },
    { envelope: { attackSeconds: .000012, releaseSeconds: 10 } },
    { offsetSeconds: .005, endSeconds: .005023, envelope: { attackSeconds: 0, releaseSeconds: 0 } },
    { playbackRate: .5, offsetSeconds: .1, endSeconds: .6, gate: '2/1', glide: { to: 2, duration: '1/4' }, envelope: { releaseSeconds: .012 }, chokeGroup: 'bass' },
  ]) {
    const result = valid(changedNote(fields));
    if (fields.envelope && !Object.keys(fields.envelope).length) {
      const a = result.project.tracks[0].patterns[0].notes[0].articulation;
      assert.equal(a.attackSeconds, .001);
      assert.equal(a.releaseSeconds, .005);
    }
  }
  valid(changedNote({ pitch: 'pixel-hat', gate: '1/16', endSeconds: .03, envelope: {}, chokeGroup: 'hats' }, { type: 'drumkit', kit: 'assets/glasshouse/kit.json' }));
});

test('B08 invented controls and misplaced GM fields fail rather than silently passing', () => {
  for (const fields of [
    { pitch: 'C4' }, { duration: '1/16' }, { noteOff: true }, { loop: true },
    { sustain: true }, { endOffset: .2 }, { sampleEnd: .2 }, { noteGate: '1/16' },
    { attackSeconds: .001 }, { releaseSeconds: .005 }, { choke: 'hats' },
    { envelope: { attackMs: 1 } }, { envelope: { releaseMs: 5 } },
    { envelope: { decaySeconds: .1 } }, { envelope: { sustain: .5 } },
    { rate: 2 }, { transpose: 7 }, { swing: .6 }, { timeStretch: 2 },
  ]) assert(compile(changedNote(fields)).diagnostics.some(d => d.code === 'UNKNOWN_FIELD'), JSON.stringify(fields));
  for (const fields of [{ endSeconds: .2 }, { gate: '1/16' }, { envelope: {} }, { chokeGroup: 'bass' }]) {
    assert(compile(changedNote({ pitch: 'C4', duration: '1/4', ...fields }, { type: 'gm', program: 0 })).diagnostics.some(d => d.code === 'UNKNOWN_FIELD'));
  }
  for (const edit of [
    p => { p.tracks[0].automation = { cutoff: [{ at: { seconds: 0 }, value: 600 }] }; },
    p => { p.tracks[0].effects = [{ type: 'limiter', ceilingDb: -1 }]; },
    p => { p.master = { sidechain: 'kick' }; },
  ]) {
    const p = changedNote({}); edit(p);
    assert(compile(p).diagnostics.length > 0);
  }
});

test('B08 invalid source bounds, gate syntax and envelope precision fail', () => {
  for (const fields of [
    { offsetSeconds: .2, endSeconds: .1 }, { offsetSeconds: .1, endSeconds: .100001 },
    { endSeconds: 2 }, { endSeconds: .1000001 }, { gate: .1 }, { gate: '1/7' },
    { gate: '0/1' }, { envelope: { attackSeconds: .000011 } },
    { envelope: { releaseSeconds: .000011 } }, { envelope: { attackSeconds: 11 } },
    { envelope: { releaseSeconds: -.1 } }, { chokeGroup: 'Hat Group' },
    { playbackRate: 0 }, { glide: { to: 0, duration: '1/4' } },
  ]) assert(compile(changedNote(fields)).diagnostics.length > 0, JSON.stringify(fields));
});

test('video cue positions use authoritative quantized tempo and absolute frame rounding', () => {
  const project = changedNote({ gate: '1/16' });
  project.bars = 8; project.render = { duration: { bars: 8 }, tail: 'none' };
  const { project: compiled, timeline } = valid(project);
  assert.equal(timeline.usPerQuarter, 428571);
  const cue = position => ticksToFrames(parsePosition(position, compiled.timeSignature, compiled.bars + 1).value, timeline.usPerQuarter);
  assert.equal(cue('3:1'), 151200);
  assert.equal(cue('9:1'), 604799);
  assert.equal(renderPlan(compiled).outputFrames, cue('9:1'));
  assert.notEqual(cue('9:1'), Math.round(32 * 60 / 140 * 44100));
});

// Optional real production smoke: no entries created; temporary fixtures are removed.
test('all recipes render production WAV, aligned stems, manifest and analysis', { skip: process.env.COMPOSER_RENDER_RECIPES !== '1' }, () => {
  const workspace = mkdtempSync(join(tmpdir(), 'composer-v03-recipes-'));
  try {
    for (const pack of ['glasshouse', 'orbital-foundry']) cpSync(join(root, 'examples/assets', pack), join(workspace, 'assets', pack), { recursive: true });
    for (const { id, project } of fixtures.recipes) {
      const file = join(workspace, `${id}.json`), output = join(workspace, id);
      writeFileSync(file, JSON.stringify(project));
      const compilation = compileProjectFile(file);
      assert.deepEqual(compilation.diagnostics, []);
      execFileSync(process.execPath, [join(root, 'bin/daemonv12.js'), 'validate', file, '--json'], { cwd: root, stdio: 'ignore' });
      execFileSync(process.execPath, [join(root, 'bin/daemonv12.js'), 'render', file, '--out-dir', output, '--stems', '--format', 'wav', '--json'], { cwd: root, timeout: 120000, stdio: 'ignore' });
      const wav = readWavInfo(join(output, `${id}.wav`));
      assert(wav.ok); assert.equal(wav.info.frames, renderPlan(compilation.project).outputFrames);
      const manifest = JSON.parse(readFileSync(join(output, `${id}.render.json`), 'utf8'));
      assert.equal(manifest.engine.version, '0.7.0');
      assert.equal(manifest.timeline.resultingFrames, wav.info.frames);
      assert.equal(manifest.production.master.clippedSamples, 0);
      for (const track of manifest.production.tracks) assert.equal(track.clippedSamples, 0);
      const analysis = JSON.parse(readFileSync(join(output, `${id}.analysis.json`), 'utf8'));
      assert(Number.isFinite(analysis.master.truePeakDbfs));
      assert.equal(analysis.master.fullScaleSamples, 0);
      console.log(`${id}: ${wav.info.frames} frames; ${project.tracks.length} aligned stems; true peak ${analysis.master.truePeakDbfs} dBTP; no clipped/full-scale samples`);
      const stemDir = join(output, `${id}.stems`);
      const stems = readdirSync(stemDir).filter(f => f.endsWith('.wav'));
      assert.equal(stems.length, project.tracks.length);
      for (const stem of stems) assert.equal(readWavInfo(join(stemDir, stem)).info.frames, wav.info.frames);
    }
  } finally { rmSync(workspace, { recursive: true, force: true }); }
});
