import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { runDemo } from '../mcp/demo.ts';
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
  const transport = new StdioClientTransport({command: process.execPath, args: ['mcp/bin/daemonv12-mcp.js', '--root', root]});
  try {
    await client.connect(transport);
    assert.equal((await client.listTools()).tools.length, 9);
    const result = await client.callTool({name: 'daemonv12_project_read', arguments: {project: '../escape.json'}});
    assert.equal(result.isError, true);
    assert.equal((result.structuredContent as {errors: {code: string}[]}).errors[0]?.code, 'PATH_UNSAFE');
  } finally { await client.close(); }
});

test('stdio requires an explicit existing workspace root and writes no stdout banner', () => {
  for (const args of [[], ['--root', '/daemonv12-does-not-exist']]) {
    const result = spawnSync(process.execPath, ['mcp/bin/daemonv12-mcp.js', ...args], {encoding: 'utf8'});
    assert.equal(result.status, 2); assert.equal(result.stdout, ''); assert.match(result.stderr, /--root/);
  }
});
