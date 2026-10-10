import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DaemonTools } from '../mcp/handlers.ts';
import { formatInit, initWorkspace, STARTER_PROJECTS } from '../src/cli/init.ts';
import { runCommand } from '../src/pipeline.ts';

const cli = resolve('bin/daemonv12.js');
function temp(t: import('node:test').TestContext) { const dir = mkdtempSync(join(tmpdir(), 'daemonv12-init-')); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir; }

test('init creates a self-contained workspace whose projects validate where they land', async t => {
  const dir = temp(t), workspace = join(dir, 'music');
  const result = spawnSync(process.execPath, [cli, 'init', 'music', '--json'], { encoding: 'utf8', cwd: dir,
    env: { ...process.env, DAEMONV12_FFMPEG: '/opt/audio/ffmpeg', DAEMONV12_FLUIDSYNTH: 'fluidsynth', DAEMONV12_SOUNDFONT: '' } });
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, '');
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true); assert.equal(report.command, 'init'); assert.equal(report.workspace, workspace);
  assert.equal(report.mcp.command, process.execPath);
  assert.deepEqual(report.mcp.args, [resolve('bin/daemonv12-mcp.js'), '--root', workspace]);
  assert.deepEqual(report.mcp.env, { DAEMONV12_FLUIDSYNTH: 'fluidsynth', DAEMONV12_FFMPEG: '/opt/audio/ffmpeg' });
  assert.deepEqual(readdirSync(join(workspace, 'assets')).sort(), ['glasshouse', 'orbital-foundry', 'pulse-kit', 'v05']);
  for (const pack of ['orbital-foundry', 'glasshouse']) assert.ok(existsSync(join(workspace, `assets/${pack}/LICENSE`)), `CC0 notice travels with ${pack}`);
  assert.deepEqual(readFileSync(join(workspace, 'README.md')), readFileSync('examples/README.md'));
  for (const project of STARTER_PROJECTS) {
    const validation = await runCommand('validate', join(workspace, project));
    assert.equal(validation.exitCode, 0, project + JSON.stringify(validation.result.errors));
  }
  // An agent discovers the bundled kit from a project it has not created yet, at the workspace root.
  const kits = await new DaemonTools(workspace).call('daemonv12_drumkits_list', { project: 'new-cue.json' });
  for (const kit of ['assets/orbital-foundry/kit.json', 'assets/glasshouse/kit.json'])
    assert.ok((kits.kits as { kit: string }[]).some(found => found.kit === kit), JSON.stringify(kits));
});

test('init renders sample-only audio immediately with Node alone', async t => {
  const workspace = join(temp(t), 'music');
  assert.equal(initWorkspace(workspace, {}).ok, true);
  const render = await runCommand('render', join(workspace, 'sample-only-demo.json'), { outDir: join(workspace, 'renders'),
    env: { DAEMONV12_FLUIDSYNTH: '/missing/fluidsynth', DAEMONV12_SOUNDFONT: '/missing.sf2', DAEMONV12_FFMPEG: '/missing/ffmpeg' } });
  assert.equal(render.exitCode, 0, JSON.stringify(render.result.errors));
  assert.equal((render.result.manifest!.wav as { durationSeconds: number }).durationSeconds, 20);
});

test('init never overwrites, rejects files and validates its arguments', t => {
  const dir = temp(t); writeFileSync(join(dir, 'keep.txt'), 'mine');
  const busy = spawnSync(process.execPath, [cli, 'init', dir], { encoding: 'utf8' });
  assert.equal(busy.status, 2); assert.match(busy.stderr, /not empty/); assert.deepEqual(readdirSync(dir), ['keep.txt']);
  const file = spawnSync(process.execPath, [cli, 'init', join(dir, 'keep.txt'), '--json'], { encoding: 'utf8' });
  assert.equal(file.status, 2); assert.equal(JSON.parse(file.stdout).errors[0].code, 'USAGE_ERROR');
  for (const args of [['init'], ['init', 'a', 'b'], ['init', 'a', '--stems'], ['init', 'a', '--format', 'mp3']]) {
    const usage = spawnSync(process.execPath, [cli, ...args, '--json'], { encoding: 'utf8', cwd: dir });
    assert.equal(usage.status, 2, args.join(' ')); assert.equal(JSON.parse(usage.stdout).errors[0].code, 'USAGE_ERROR');
  }
  assert.deepEqual(readdirSync(dir), ['keep.txt']);
});

test('init accepts an empty directory and creates nothing from an incomplete installation', t => {
  const dir = temp(t), empty = join(dir, 'empty'); mkdirSync(empty);
  assert.equal(initWorkspace(empty, {}).ok, true);
  const broken = join(dir, 'broken-package'); mkdirSync(join(broken, 'examples'), { recursive: true });
  const failed = initWorkspace(join(dir, 'never'), {}, broken);
  assert.equal(failed.ok, false); assert.equal(failed.errors[0]?.code, 'INTERNAL_ERROR'); assert.equal(existsSync(join(dir, 'never')), false);
});

test('human init output gives runnable render and MCP registration commands', t => {
  const workspace = join(temp(t), "it's music");
  const text = formatInit(initWorkspace(workspace, { PATH: '' }));
  assert.match(text, /Hear it now \(Node only/);
  assert.ok(text.includes(`${process.execPath} ${resolve('bin/daemonv12.js')} render sample-only-demo.json`));
  assert.ok(text.includes(`'${workspace.replaceAll("'", `'\\''`)}'`), 'paths with quotes are shell-quoted');
  assert.match(text, /claude mcp add --transport stdio daemonv12 -- /);
  assert.match(text, /codex mcp add daemonv12 -- /);
  assert.match(text, /"mcpServers"/);
});
