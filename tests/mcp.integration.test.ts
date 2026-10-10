import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { runDemo } from '../mcp/demo.ts';
import { ENGINE_VERSION } from '../src/version.ts';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const available = ['fluidsynth', 'ffmpeg'].every(command => spawnSync(command, ['-version'], {encoding: 'utf8'}).error === undefined);
test('real stdio agent session: create/edit/render WAV+MP3+stems/analyze/provenance/errors/repeat hashes', {skip: !available && 'Requires FluidSynth and FFmpeg'}, async t => {
  const root = mkdtempSync(join(tmpdir(), 'daemon-mcp-stdio-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const report = await runDemo(root);
  assert.equal(report.ok, true); assert.deepEqual(report.deterministic, ['master WAV', 'stems', 'analysis', 'manifest']);
});

test('stdio initialization and structured tool failures require no audio executables', async t => {
  const root = mkdtempSync(join(tmpdir(), 'daemon-mcp-smoke-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const client = new Client({name: 'stdio-smoke', version: '1'});
  const transport = new StdioClientTransport({command: process.execPath, args: ['bin/daemonv12-mcp.js', '--root', root]});
  try {
    await client.connect(transport);
    assert.equal((await client.listTools()).tools.length, 9);
    assert.match(client.getInstructions() ?? '', /daemonv12_project_patch.*daemonv12_render.*FluidSynth.*FFmpeg/s);
    const result = await client.callTool({name: 'daemonv12_project_read', arguments: {project: '../escape.json'}});
    assert.equal(result.isError, true);
    assert.equal((result.structuredContent as {errors: {code: string}[]}).errors[0]?.code, 'PATH_UNSAFE');
  } finally { await client.close(); }
});

test('stdio requires an explicit existing workspace root and writes no stdout banner', () => {
  for (const bin of ['bin/daemonv12-mcp.js', 'mcp/bin/daemonv12-mcp.js']) for (const args of [[], ['--root', '/daemonv12-does-not-exist'], ['--root', 'package.json'], ['--unknown']]) {
    const result = spawnSync(process.execPath, [bin, ...args], {encoding: 'utf8'});
    assert.equal(result.status, 2, bin + args.join(' ')); assert.equal(result.stdout, ''); assert.match(result.stderr, /--root/);
  }
  const tilde = spawnSync(process.execPath, ['bin/daemonv12-mcp.js', '--root', '~/daemonv12-music'], {encoding: 'utf8'});
  assert.equal(tilde.status, 2); assert.match(tilde.stderr, /do not expand ~/);
});

test('MCP executable prints help and version without starting the protocol', () => {
  const help = spawnSync(process.execPath, ['bin/daemonv12-mcp.js', '--help'], {encoding: 'utf8'});
  assert.equal(help.status, 0); assert.match(help.stdout, /--root <dir>/); assert.match(help.stdout, /daemonv12 init/);
  const version = spawnSync(process.execPath, ['bin/daemonv12-mcp.js', '-v'], {encoding: 'utf8'});
  assert.equal(version.status, 0); assert.equal(version.stdout, `daemonv12-mcp ${ENGINE_VERSION}\n`);
});

test('launcher explains missing runtime dependencies and incomplete installations', t => {
  const dir = mkdtempSync(join(tmpdir(), 'daemon-launch-'));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  mkdirSync(join(dir, 'bin')); mkdirSync(join(dir, 'mcp'));
  for (const file of ['launch.js', 'daemonv12-mcp.js']) copyFileSync(resolve('bin', file), join(dir, 'bin', file));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({type: 'module'}));
  const incomplete = spawnSync(process.execPath, [join(dir, 'bin/daemonv12-mcp.js'), '--root', dir], {encoding: 'utf8'});
  assert.equal(incomplete.status, 2); assert.match(incomplete.stderr, /incomplete installation/);
  writeFileSync(join(dir, 'mcp/main.ts'), "import 'daemonv12-missing-runtime-package';\n");
  const missing = spawnSync(process.execPath, [join(dir, 'bin/daemonv12-mcp.js'), '--root', dir], {encoding: 'utf8'});
  assert.equal(missing.status, 2); assert.equal(missing.stdout, '');
  assert.match(missing.stderr, /missing runtime dependency daemonv12-missing-runtime-package\. Run npm ci/);
});
