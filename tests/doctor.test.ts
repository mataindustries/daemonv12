import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { formatDoctor, inspectEnvironment, supportedNode } from '../src/doctor.ts';

const cli = resolve('bin/daemonv12.js');
const fakeEnv = () => ({ ...process.env, DAEMONV12_FLUIDSYNTH: resolve('tests/helpers/fake-fluidsynth.mjs'),
  DAEMONV12_FFMPEG: resolve('tests/helpers/fake-ffmpeg.mjs'), DAEMONV12_SOUNDFONT: resolve('tests/fixtures/fake.sf2') });
function temp(t: import('node:test').TestContext) { const dir = mkdtempSync(join(tmpdir(), 'daemonv12-doctor-')); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir; }

test('doctor applies the documented minimum Node version', () => {
  for (const version of ['v20.19.0', '22.17.9', 'v21.7.3', 'garbage', '22.18.0-rc.1']) assert.equal(supportedNode(version), false, version);
  for (const version of ['v22.18.0', '22.23.3', 'v24.0.0', 'v26.1.0']) assert.equal(supportedNode(version), true, version);
});
test('doctor reports independent readiness and shares renderer and SoundFont selection', async () => {
  const result = await inspectEnvironment({ env: fakeEnv() });
  assert.equal(result.schemaVersion, 1); assert.equal(result.command, 'doctor'); assert.equal(result.ok, true);
  assert.deepEqual(result.readiness, { generalMidi: true, sampleOnly: true, productionEffects: true, mp3: true, loudnessAnalysis: true, mcp: true });
  assert.equal(result.fluidsynth.version, '9.9.9'); assert.equal(result.fluidsynth.path, fakeEnv().DAEMONV12_FLUIDSYNTH);
  assert.equal(result.ffmpeg.version, 'fake-1'); assert.equal(result.soundfont.selection, 'environment'); assert.equal(result.soundfont.bytes, 12);
  const flag = await inspectEnvironment({ env: fakeEnv(), soundfont: '/missing/explicit.sf2' });
  assert.equal(flag.soundfont.selection, 'argument'); assert.equal(flag.soundfont.valid, false); assert.equal(flag.readiness.generalMidi, false);
  const defaults = await inspectEnvironment({ env: { ...fakeEnv(), DAEMONV12_SOUNDFONT: '' }, defaults: ['tests/fixtures/fake.sf2'] });
  assert.equal(defaults.soundfont.selection, 'default'); assert.equal(defaults.soundfont.valid, true);
});
test('doctor leaves sample readiness true without audio tools or npm, and gives actionable fixes', async () => {
  const result = await inspectEnvironment({ env: { PATH: '', DAEMONV12_FLUIDSYNTH: '/missing/fluidsynth', DAEMONV12_FFMPEG: '/missing/ffmpeg' }, defaults: [] });
  assert.equal(result.ok, false); assert.equal(result.readiness.sampleOnly, true); assert.equal(result.readiness.mcp, true);
  assert.equal(result.readiness.generalMidi, false); assert.equal(result.readiness.productionEffects, false); assert.equal(result.readiness.mp3, false);
  assert.equal(result.npm.available, false); assert.equal(result.soundfont.selection, 'missing');
  for (const component of ['npm', 'fluidsynth', 'soundfont', 'ffmpeg']) assert.ok(result.fixes.some(fix => fix.component === component));
  assert.ok(result.fixes.some(fix => fix.action.includes('bootstrap-audio-tools.sh')));
});
test('doctor diagnoses invalid readable SoundFonts and missing workspace dependencies', async t => {
  const dir = temp(t), bad = join(dir, 'bad.sf2'); writeFileSync(bad, 'not a SoundFont');
  mkdirSync(join(dir, 'src/cli'), { recursive: true }); writeFileSync(join(dir, 'src/cli/main.ts'), '');
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'daemonv12', devDependencies: { 'daemonv12-missing-development-fixture': '1.0.0' },
    dependencies: { 'daemonv12-missing-runtime-fixture': '1.0.0' } }));
  const result = await inspectEnvironment({ env: fakeEnv(), soundfont: bad, dependencyRoot: dir });
  assert.deepEqual(result.installation, { mode: 'source', root: dir });
  assert.equal(result.soundfont.readable, true); assert.equal(result.soundfont.valid, false);
  assert.equal(result.dependencies.development.available, false); assert.equal(result.dependencies.mcp.available, false);
  assert.equal(result.dependencies.mcp.packages[0]?.version, null); assert.equal(result.readiness.mcp, false);
  assert.ok(result.fixes.some(fix => fix.component === 'dependencies' && fix.action.includes(`npm ci in ${dir}`)));
});
test('an installed package needs no development tools and points fixes at its own files', async t => {
  const dir = temp(t);
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'daemonv12', devDependencies: { 'daemonv12-missing-development-fixture': '1.0.0' },
    dependencies: { 'daemonv12-missing-runtime-fixture': '1.0.0' } }));
  const result = await inspectEnvironment({ env: { PATH: '', DAEMONV12_FLUIDSYNTH: '/missing/fluidsynth', DAEMONV12_FFMPEG: '/missing/ffmpeg' }, defaults: [], dependencyRoot: dir });
  assert.deepEqual(result.installation, { mode: 'package', root: dir }); assert.equal(result.readiness.mcp, false);
  const dependencies = result.fixes.filter(fix => fix.component === 'dependencies');
  assert.equal(dependencies.length, 1); assert.match(dependencies[0]!.action, /Reinstall daemonv12/); assert.doesNotMatch(dependencies[0]!.action, /npm ci/);
  assert.ok(result.fixes.some(fix => fix.component === 'fluidsynth' && fix.action.includes(join(dir, 'scripts', 'bootstrap-audio-tools.sh'))));
  const human = formatDoctor(result);
  assert.match(human, /installed package/); assert.match(human, /Development dependencies: not needed/);
  assert.match(human, /sampleOnly: ready — sampler\/drum-kit projects/); assert.match(human, /Summary: ready now: sampleOnly\. Not ready:/);
});
test('doctor distinguishes an installed FFmpeg from its missing production capabilities', async () => {
  const result = await inspectEnvironment({ env: { ...fakeEnv(), FAKE_AUDIO_MODE: 'missing-mp3' } });
  assert.equal(result.ffmpeg.available, true); assert.equal(result.readiness.mp3, false);
  assert.equal(result.readiness.productionEffects, true); assert.equal(result.readiness.loudnessAnalysis, true);
  const failed = await inspectEnvironment({ env: { ...fakeEnv(), FAKE_AUDIO_MODE: 'filters-fail' } });
  assert.equal(failed.ffmpeg.available, true); assert.equal(failed.readiness.productionEffects, false); assert.equal(failed.readiness.loudnessAnalysis, false);
});
test('doctor bounds hung probes and reports unsupported Node without declaring sample or MCP readiness', async () => {
  const result = await inspectEnvironment({ env: { ...fakeEnv(), FAKE_FLUIDSYNTH_MODE: 'probe-hang', FAKE_AUDIO_MODE: 'probe-hang' }, probeTimeoutMs: 150, nodeVersion: 'v20.0.0' });
  assert.equal(result.node.supported, false); assert.ok(Object.values(result.readiness).every(value => value === false));
  assert.match(result.fluidsynth.error!, /timed out/); assert.equal(result.ffmpeg.available, false);
});
test('doctor CLI emits one stable JSON report from another cwd and creates no artifacts', t => {
  const dir = temp(t); writeFileSync(join(dir, 'keep'), 'untouched');
  const result = spawnSync(process.execPath, [cli, 'doctor', '--json'], { encoding: 'utf8', cwd: dir, env: fakeEnv() });
  assert.equal(result.status, 0, result.stdout + result.stderr); assert.equal(result.stderr, '');
  const report = JSON.parse(result.stdout);
  assert.deepEqual(Object.keys(report), ['schemaVersion', 'command', 'engineVersion', 'installation', 'ok', 'platform', 'architecture', 'node', 'npm', 'fluidsynth', 'soundfont', 'ffmpeg', 'dependencies', 'readiness', 'fixes']);
  assert.deepEqual(report.installation, { mode: 'source', root: resolve('.') });
  assert.deepEqual(readdirSync(dir), ['keep']);
  const missing = spawnSync(process.execPath, [cli, 'doctor', '--json', '--soundfont', '/missing.sf2'], { encoding: 'utf8', cwd: dir, env: fakeEnv() });
  assert.equal(missing.status, 3); assert.equal(JSON.parse(missing.stdout).readiness.sampleOnly, true); assert.deepEqual(readdirSync(dir), ['keep']);
  const human = spawnSync(process.execPath, [cli, 'doctor'], { encoding: 'utf8', cwd: dir, env: fakeEnv() });
  assert.match(human.stdout, /sampleOnly: ready/); assert.match(human.stdout, /no audio was rendered/);
});
test('doctor rejects project arguments and rendering flags as usage errors', () => {
  for (const flags of [['project.json'], ['--stems'], ['--format', 'mp3'], ['--out-dir', '/tmp/no-output']]) {
    const result = spawnSync(process.execPath, [cli, 'doctor', ...flags, '--json'], { encoding: 'utf8' });
    assert.equal(result.status, 2); assert.equal(JSON.parse(result.stdout).errors[0].code, 'USAGE_ERROR');
  }
});
