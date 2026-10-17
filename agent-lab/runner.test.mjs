import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { encodePcm } from '../src/render/pcm.ts';
import { load, tree, sha, changes, timing } from './runner.mjs';
const cli = resolve('agent-lab/cli.mjs');
const put = (p, v) => writeFileSync(p, JSON.stringify(v));
async function call(...args) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 180000);
    child.stdout.on('data', c => { stdout += c; }); child.stderr.on('data', c => { stderr += c; });
    child.on('error', reject); child.on('close', status => { clearTimeout(timer); resolveResult({ stdout, stderr, status }); });
  });
}
function ok(r) { assert.equal(r.status, 0, r.stdout + r.stderr); return JSON.parse(r.stdout); }
function fail(r, code) { assert.equal(r.status, 1, r.stdout + r.stderr); assert.equal(r.stdout, ''); const d = JSON.parse(r.stderr); if (code) assert.equal(d.code, code, r.stderr); assert.ok(d.repair); }
async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'agent-lab-test-')); mkdirSync(join(dir, 'assets'));
  const samples = new Int16Array(44100 * 4 * 2);
  for (let f = 0; f < samples.length / 2; f++) {
    const x = Math.round(10000 * (Math.sin(f * 2 * Math.PI * 440 / 44100) + 0.2 * Math.sin(f * 2 * Math.PI * 2200 / 44100)));
    samples[f * 2] = samples[f * 2 + 1] = x;
  }
  writeFileSync(join(dir, 'assets/tone.wav'), encodePcm(samples));
  const p = { formatVersion: 1, title: 'Private synthetic fixture', bpm: 120, timeSignature: '4/4', bars: 2, seed: 3,
    render: { duration: { seconds: 4 }, tail: 'none' }, master: { gainDb: 0 }, tracks: [{ id: 'tone', instrument: { type: 'sampler', sample: 'assets/tone.wav' },
      patterns: [{ id: 'p', bars: 2, notes: [{ start: '1:1', velocity: 1, gate: '7/4', envelope: { attackSeconds: 0.01, releaseSeconds: 0.01 } }] }], clips: [{ bar: 1, pattern: 'p' }], mix: { gainDb: -10 } }] };
  put(join(dir, 'source.json'), p);
  for (let i = 1; i <= 3; i++) { const c = structuredClone(p); c.tracks[0].patterns[0].notes[0].playbackRate = [1, 1.25, 0.75][i - 1]; c.tracks[0].mix.gainDb -= i; put(join(dir, `secret-${i}.json`), c); }
  const spec = { version: 1, source: 'source.json', seed: 'private-test-seed', frames: 176400, window: { startFrame: 11025, frames: 132300 },
    loudness: { targetLufs: -5, ceilingDbtp: -6 }, candidates: [1, 2, 3].map(i => ({ id: `secret-${i}`, project: `secret-${i}.json`, hypothesis: `private-hypothesis-${i}` })),
    constraints: [{ kind: 'triggers', track: 'tone', frames: [0] }, { kind: 'silence', track: '$master', startFrame: 165375, endFrame: 176400, maxPeakDbfs: -80 }] };
  const experiment = join(dir, 'experiment.json'), lock = join(dir, 'toolchain.json'); put(experiment, spec); ok(await call('pin', experiment, lock));
  return { dir, spec, p, experiment, lock };
}
test('complete real-audio comparison repeats byte-for-byte, preserves inputs, hides identities and reveals only with complete scores', async () => {
  const f = await fixture(), { dir, experiment, lock, spec } = f;
  try {
    const before = tree(dir), one = join(dir, 'one'), two = join(dir, 'two');
    const summary = ok(await call('run', experiment, lock, one)); ok(await call('run', experiment, lock, two));
    assert.deepEqual(tree(one), tree(two));
    for (const [p, hash] of Object.entries(before)) assert.equal(sha(join(dir, p)), hash);
    assert.equal(summary.loweredForHeadroom, true); assert.equal(summary.limiterApplied, false);
    const key = load(join(one, 'private/blind-key.json')), pub = join(one, 'public');
    assert.equal(statSync(join(one, 'private')).mode & 0o777, 0o700); assert.equal(statSync(join(one, 'private/blind-key.json')).mode & 0o777, 0o600);
    assert.deepEqual(readdirSync(pub).sort(), ['A-window.wav', 'A.wav', 'B-window.wav', 'B.wav', 'C-window.wav', 'C.wav', 'listening.json', 'scores-template.json']);
    const publicText = readFileSync(join(pub, 'listening.json'), 'utf8') + readFileSync(join(pub, 'scores-template.json'), 'utf8') + JSON.stringify(summary);
    for (const secret of [spec.seed, ...spec.candidates.flatMap(c => [c.id, c.project, c.hypothesis]), ...key.entries.map(e => e.projectSha256)]) assert.ok(!publicText.includes(secret), secret);
    assert.equal(summary.keySha256, sha(join(one, 'private/blind-key.json')));
    for (const e of key.entries) {
      assert.equal(e.analysis.frames, 176400); assert.equal(e.listening.whole.frames, 176400); assert.equal(e.listening.window.frames, 132300);
      assert.ok(Math.abs(e.listening.whole.integratedLufs - summary.effectiveTargetLufs) <= 0.3); assert.ok(e.listening.whole.truePeakDbfs <= -6); assert.ok(e.listening.window.truePeakDbfs <= -6);
      assert.equal(e.listening.whole.clipping, false); assert.ok(e.changes.length); assert.ok(e.timing.every(t => t.passed));
      const bytes = readFileSync(join(pub, `${e.label}.wav`)); assert.equal(bytes.length, 44 + 176400 * 4); assert.equal(bytes.toString('ascii', 36, 40), 'data');
    }
    const scores = load(join(pub, 'scores-template.json')), scoreFile = join(dir, 'scores.json'), report = join(dir, 'report.json');
    put(scoreFile, scores); fail(await call('evaluate', one, scoreFile, report), 'SCORES_INCOMPLETE'); assert.ok(!existsSync(report));
    scores.judge = 'Human-test-data (not a real listening result)'; scores.scores = { A: 7, B: 9, C: 6 }; put(scoreFile, scores);
    const reveal = ok(await call('evaluate', one, scoreFile, report)); assert.deepEqual(reveal.winners, [key.entries.find(e => e.label === 'B').id]);
    assert.equal(load(report).scoresSha256, sha(scoreFile)); fail(await call('evaluate', one, scoreFile, report), 'OUTPUT_EXISTS');
    const copy = join(pub, 'A.wav'), bytes = readFileSync(copy); bytes[100] ^= 1; writeFileSync(copy, bytes);
    fail(await call('evaluate', one, scoreFile, join(dir, 'tampered-report.json')), 'COPY_CHANGED');
    writeFileSync(copy, readFileSync(join(two, 'public/A.wav')));
    scores.scores = { A: 8, B: 8, C: 8 }; put(scoreFile, scores); assert.equal(ok(await call('evaluate', one, scoreFile, join(dir, 'tie.json'))).tied, true);
    const original = tree(one); fail(await call('run', experiment, lock, one), 'OUTPUT_EXISTS'); assert.deepEqual(tree(one), original);
    // Changing only the private seed changes assignment/commitment, never the audio multiset.
    spec.seed = 'another-private-seed'; put(experiment, spec); ok(await call('run', experiment, lock, join(dir, 'three')));
    const hashes = p => readdirSync(p).filter(n => n.endsWith('.wav')).map(n => sha(join(p, n))).sort();
    assert.deepEqual(hashes(join(dir, 'three/public')), hashes(pub));
    ok(await call('run', join(one, 'private/replay-experiment.json'), join(one, 'private/toolchain.json'), join(dir, 'replay')));
    assert.deepEqual(hashes(join(dir, 'replay/public')), hashes(pub));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('invalid, missing, duplicate and unsafe inputs fail clearly and preserve prior output', async () => {
  const { dir, experiment, lock, spec } = await fixture();
  try {
    const out = join(dir, 'result'), valid = structuredClone(spec), originalPin = readFileSync(lock);
    async function rejected(code) { fail(await call('run', experiment, lock, out), code); assert.ok(!existsSync(out)); assert.ok(!readdirSync(dir).some(n => n.startsWith('.agent-lab-'))); }
    spec.candidates[2].project = 'missing.json'; put(experiment, spec); await rejected('ENOENT');
    const candidateFile = join(dir, 'secret-3.json'), candidateBytes = readFileSync(candidateFile);
    writeFileSync(candidateFile, '{broken'); put(experiment, valid); await rejected('PROJECT_INVALID'); writeFileSync(candidateFile, candidateBytes);
    const invalid = JSON.parse(candidateBytes); invalid.tracks[0].instrument.sample = 'assets/missing.wav'; put(candidateFile, invalid); await rejected('PROJECT_INVALID'); writeFileSync(candidateFile, candidateBytes);
    put(experiment, { ...valid, candidates: valid.candidates.slice(0, 2) }); await rejected('CANDIDATE_COUNT');
    const duplicate = structuredClone(valid); duplicate.candidates[2].project = duplicate.candidates[0].project; put(experiment, duplicate); await rejected('DUPLICATE_CANDIDATE');
    const bad = structuredClone(valid); bad.window.frames = 999999; put(experiment, bad); await rejected('INVALID_WINDOW');
    put(experiment, { ...valid, invented: true }); await rejected('INVALID_DEFINITION');
    put(experiment, valid); const pin = load(lock); pin.node.version = 'wrong'; put(lock, pin); await rejected('TOOLCHAIN_MISMATCH'); writeFileSync(lock, originalPin);
    const timing = structuredClone(valid); timing.constraints[0].frames = [1]; put(experiment, timing); await rejected('TIMING_FAILED');
    put(experiment, { ...valid, frames: valid.frames + 1 }); await rejected('DURATION_FAILED');
    put(experiment, valid); const c = load(join(dir, 'secret-3.json')); c.tracks[0].mix.gainDb = 12; c.master.gainDb = 12; put(join(dir, 'secret-3.json'), c); await rejected('CLIPPING');
    c.tracks[0].mix.gainDb = -13; c.master.gainDb = -60; put(join(dir, 'secret-3.json'), c); await rejected('UNMEASURABLE_LOUDNESS');
    symlinkSync(join(dir, 'absent'), out); fail(await call('run', experiment, lock, out), 'OUTPUT_EXISTS');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('JSON changes preserve added, removed, escaped and array paths', async () => {
  assert.deepEqual(changes({ 'a/b': 1, gone: true, a: [1, 2] }, { 'a/b': 2, a: [1], added: 3 }), [
    { path: '/a/1', before: 2 }, { path: '/a~1b', before: 1, after: 2 }, { path: '/added', after: 3 }, { path: '/gone', before: true }
  ]);
});

test('declared audio-onset detector catches a one-frame drift and failed quiet/peak gates', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agent-lab-onset-'));
  try {
    const file = join(dir, 'impulse.wav'), samples = new Int16Array(8820);
    samples[200] = samples[201] = 10000; writeFileSync(file, encodePcm(samples));
    const render = { artifacts: { wav: file, stems: [{ trackId: 'contact', wav: file }] } };
    const constraint = { kind: 'onset', track: 'contact', startFrame: 0, endFrame: 4410, expectedFrame: 100, toleranceFrames: 0, thresholdFraction: 0.25, minPeakDbfs: -50 };
    assert.equal(timing({}, render, { constraints: [constraint] })[0].measuredFrame, 100);
    assert.throws(() => timing({}, render, { constraints: [{ ...constraint, expectedFrame: 101 }] }), e => e.code === 'TIMING_FAILED');
    assert.throws(() => timing({}, render, { constraints: [{ ...constraint, minPeakDbfs: -1 }] }), e => e.code === 'TIMING_FAILED');
    assert.throws(() => timing({}, render, { constraints: [{ kind: 'silence', track: '$master', startFrame: 0, endFrame: 4410, maxPeakDbfs: -80 }] }), e => e.code === 'TIMING_FAILED');
    samples.fill(0); writeFileSync(file, encodePcm(samples));
    assert.throws(() => timing({}, render, { constraints: [constraint] }), e => e.code === 'TIMING_FAILED');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a sabotaged static-gain pass fails measured target verification without publishing a bundle', async () => {
  const { dir, experiment, spec } = await fixture(), original = process.env.DAEMONV12_FFMPEG;
  try {
    spec.loudness = { targetLufs: -23, ceilingDbtp: -1 }; put(experiment, spec);
    const wrapper = join(dir, 'ffmpeg-wrapper.mjs'), real = original || 'ffmpeg';
    writeFileSync(wrapper, `#!${process.execPath}\nimport {spawn} from 'node:child_process';\nconst args=process.argv.slice(2);const i=args.indexOf('-af');if(i>=0&&args[i+1].startsWith('volume='))args[i+1]+=',volume=3dB';const c=spawn(${JSON.stringify(real)},args,{stdio:'inherit'});c.on('error',()=>process.exitCode=1);c.on('close',code=>process.exitCode=code??1);\n`, { mode: 0o700 });
    process.env.DAEMONV12_FFMPEG = wrapper;
    const lock = join(dir, 'wrapper-lock.json'), out = join(dir, 'failed-target');
    ok(await call('pin', experiment, lock)); fail(await call('run', experiment, lock, out), 'LOUDNESS_TARGET_FAILED');
    assert.ok(!existsSync(out)); assert.ok(!readdirSync(dir).some(n => n.startsWith('.agent-lab-')));
  } finally {
    if (original === undefined) delete process.env.DAEMONV12_FFMPEG; else process.env.DAEMONV12_FFMPEG = original;
    rmSync(dir, { recursive: true, force: true });
  }
});
