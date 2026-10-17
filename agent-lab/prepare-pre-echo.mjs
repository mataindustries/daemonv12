// Read the private benchmark as data only. Never execute scripts from its ZIP.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, renameSync, rmSync, lstatSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { compileProjectFile } from '../src/pipeline.ts';
import { save } from './runner.mjs';
import { requireLab as check } from './schema.mjs';
const [sourceDir, output, ...extra] = process.argv.slice(2);
let stage;
try {
  check(sourceDir && output && !extra.length, 'USAGE', 'Usage: node agent-lab/prepare-pre-echo.mjs PRIVATE_PRE_ECHO_DIRECTORY FRESH_WORKSPACE', 'Extract the supplied ZIP privately first.');
  const out = resolve(output);
  try { lstatSync(out); throw new Error('Output exists; choose a fresh workspace.'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const source = resolve(sourceDir, 'project.json'), c = compileProjectFile(source);
  check(c.timeline, 'PROJECT_INVALID', 'Private source is invalid.', 'Repair existing engine diagnostics.', c.diagnostics);
  const intent = JSON.parse(readFileSync(resolve(sourceDir, 'intent.json'), 'utf8'));
  check(intent.clock.audioSampleFrames === 529200 && intent.events.length === 4 && intent.events.map(e => e.targetAudioSample).join(',') === '66150,198450,374850,383670',
    'BENCHMARK_MISMATCH', 'This is not the expected PRE-ECHO 001 clock.', 'Use an experiment definition tailored to this source.');
  stage = mkdtempSync(join(dirname(out), '.pre-echo-'));
  writeFileSync(join(stage, 'source.json'), c.projectBytes, { flag: 'wx', mode: 0o600 });
  for (const [name, asset] of c.assets) { const p = join(stage, name); mkdirSync(dirname(p), { recursive: true, mode: 0o700 }); writeFileSync(p, asset.bytes, { flag: 'wx', mode: 0o600 }); }
  const original = JSON.parse(Buffer.from(c.projectBytes).toString()), candidates = [
    { id: 'closer-room', hypothesis: 'A louder, darker room bed may make the dry contacts feel closer and the final silence more abrupt.' },
    { id: 'pressure-rise', hypothesis: 'A quieter room and stronger low-mid dread arc may increase anticipation before the reflected taps.' },
    { id: 'split-space', hypothesis: 'Opposing room and dread placement with a darker pressure bed may suggest an unstable reflected space.' }
  ];
  candidates.forEach((candidate, i) => {
    const p = structuredClone(original), room = p.tracks.find(t => t.id === 'room'), dread = p.tracks.find(t => t.id === 'dread');
    if (i === 0) { room.mix.gainDb = -17; room.effects[0].frequencyHz = 2400; }
    if (i === 1) { room.mix.gainDb = -23; dread.automation.gainDb.forEach(point => { point.value += 3; }); }
    if (i === 2) { room.mix.pan = -0.3; dread.mix.pan = 0.3; dread.effects.find(e => e.type === 'lowpass').frequencyHz = 700; }
    candidate.project = `candidate-${i + 1}.json`; save(join(stage, candidate.project), p);
  });
  const constraints = [
    { kind: 'triggers', track: 'latch', frames: [66150] },
    { kind: 'triggers', track: 'glass', frames: [198450] },
    { kind: 'triggers', track: 'fingernails', frames: [374850, 383670] },
    ...intent.events.map((e, i) => ({ kind: 'onset', track: i < 2 ? e.id : 'fingernails', startFrame: e.targetAudioSample - 2205, endFrame: e.targetAudioSample + 2205,
      expectedFrame: e.targetAudioSample, toleranceFrames: 1, thresholdFraction: 0.25, minPeakDbfs: -50 })),
    { kind: 'silence', track: '$master', startFrame: 485100, endFrame: 529200, maxPeakDbfs: -80 }
  ];
  save(join(stage, 'experiment.json'), { version: 1, source: 'source.json', candidates, seed: 'pre-echo-agent-lab-v01-private-reproduction-seed', frames: 529200,
    window: { startFrame: 308700, frames: 132300 }, loudness: { targetLufs: -23, ceilingDbtp: -1 }, constraints });
  renameSync(stage, out); stage = undefined;
  process.stdout.write(JSON.stringify({ ok: true, benchmark: 'PRE-ECHO 001', candidates: candidates.map(c => c.id) }) + '\n');
} catch (e) {
  if (stage) rmSync(stage, { recursive: true, force: true });
  process.stderr.write(JSON.stringify({ ok: false, code: e.code || 'PREPARATION_FAILED', message: e.message, details: e.details }) + '\n'); process.exitCode = 1;
}
