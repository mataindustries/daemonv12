import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import type { ToolResult } from './handlers.ts';
import { hash } from './workspace.ts';
import { decodePcm } from '../src/render/index.ts';

// Asset installation is operator setup; every project/music operation below is an MCP call.
export async function runDemo(root: string, env: Record<string, string> = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined))) {
  cpSync(fileURLToPath(new URL('../examples/assets', import.meta.url)), join(root, 'assets'), {recursive: true});
  const client = new Client({name: 'daemonv12-agent-demo', version: '0.4.0'});
  const transport = new StdioClientTransport({command: process.execPath,
    args: [fileURLToPath(new URL('../bin/daemonv12-mcp.js', import.meta.url)), '--root', root], env, stderr: 'pipe'});
  let stderr = '';
  transport.stderr?.on('data', chunk => { stderr += String(chunk); });
  const transcript: {tool: string; arguments: Record<string, unknown>; result: ToolResult}[] = [];
  async function call(tool: string, args: Record<string, unknown>, success = true) {
    const response = await client.callTool({name: `daemonv12_${tool}`, arguments: args});
    const result = response.structuredContent as ToolResult;
    assert.ok(result, JSON.stringify(response));
    assert.equal(result.ok, success, JSON.stringify(result));
    assert.equal(response.isError, !success);
    transcript.push({tool, arguments: args, result});
    return result;
  }
  try {
    await client.connect(transport);
    assert.equal((await client.listTools()).tools.length, 9);
    const project = 'agent-demo.json';
    let revision = await call('project_create', {project, title: 'MCP agent demo', bpm: 120, bars: 2, key: 'D minor', seed: 7});
    await call('instruments_list', {project, query: 'piano'});
    await call('drumkits_list', {project});
    revision = await call('project_patch', {project, expectedSha256: revision.sha256, edits: [
      {op: 'track_add', track: {id: 'keys', instrument: {type: 'gm', program: 'electric_piano_1'}}},
      {op: 'track_remove', trackId: 'lead'},
      {op: 'track_add', track: {id: 'drums', instrument: {type: 'drumkit', kit: 'assets/pulse-kit/kit.json'}}},
      {op: 'pattern_put', trackId: 'keys', pattern: {id: 'phrase', bars: 1, notes: []}},
      {op: 'pattern_put', trackId: 'drums', pattern: {id: 'beat', bars: 1, notes: []}},
    ]});
    revision = await call('project_patch', {project, expectedSha256: revision.sha256, edits: [
      {op: 'notes_append', trackId: 'keys', patternId: 'phrase', notes: [
        {start: '1:1', pitch: ['D4', 'F4', 'A4'], duration: '1/4', velocity: 0.65},
        {start: '1:3', pitch: 'A4', duration: '1/4', velocity: 0.55},
      ]},
      {op: 'notes_append', trackId: 'drums', patternId: 'beat', notes: [
        {start: '1:1', pitch: 'kick', velocity: 0.8}, {start: '1:2', pitch: 'snare', velocity: 0.6},
        {start: '1:3', pitch: 'kick', velocity: 0.7}, {start: '1:4', pitch: 'snare', velocity: 0.55},
      ]},
      {op: 'clips_set', trackId: 'keys', clips: [{bar: 1, pattern: 'phrase'}, {bar: 2, pattern: 'phrase'}]},
      {op: 'clips_set', trackId: 'drums', clips: [{bar: 1, pattern: 'beat'}, {bar: 2, pattern: 'beat'}]},
      {op: 'track_update', trackId: 'keys', fields: {mix: {gainDb: -4, pan: -0.2}, effects: [{type: 'highpass', frequencyHz: 120}]}},
      {op: 'track_update', trackId: 'drums', fields: {mix: {gainDb: -5, pan: 0.15}}},
      {op: 'project_update', fields: {master: {gainDb: -1}}},
    ]});
    await call('project_read', {project});
    await call('project_validate', {project});
    const before = readFileSync(join(root, project));
    const invalid = await call('project_patch', {project, expectedSha256: revision.sha256, edits: [
      {op: 'project_update', fields: {title: 'Must not persist'}},
      {op: 'notes_append', trackId: 'keys', patternId: 'phrase', notes: [{start: '1:1', pitch: 'D4', duration: '1/4'}]},
    ]}, false);
    assert.ok((invalid.errors as {code: string}[]).some(e => e.code === 'NOTE_OVERLAP'));
    assert.deepEqual(readFileSync(join(root, project)), before);
    await call('project_create', {project, title: 'Must not overwrite'}, false);
    await call('project_read', {project: '../escape.json'}, false);
    const first = await call('render', {project, stems: true, format: 'wav,mp3'});
    const artifacts = first.artifacts as {wav: string; mp3: string; manifest: string; analysis: string; stems: {trackId: string; wav: string}[]};
    assert.equal(artifacts.stems.length, 2);
    const analysis = await call('analyze', {audio: artifacts.wav});
    await call('analyze', {audio: artifacts.stems[0]!.wav});
    const metrics = analysis.analysis as {sampleRate: number; channels: number; integratedLufs: number; clipping: boolean};
    assert.equal(metrics.sampleRate, 44100); assert.equal(metrics.channels, 2);
    assert.equal(typeof metrics.integratedLufs, 'number'); assert.equal(metrics.clipping, false);
    const info = await call('render_info', {manifest: artifacts.manifest, detail: 'full'});
    const diskManifest = JSON.parse(readFileSync(join(root, artifacts.manifest), 'utf8'));
    assert.deepEqual(info.manifest, diskManifest);
    assert.equal(diskManifest.project.sha256, hash(before));
    assert.equal(diskManifest.wav.sha256, hash(readFileSync(join(root, artifacts.wav))));
    assert.equal(diskManifest.mp3.sha256, hash(readFileSync(join(root, artifacts.mp3))));
    const master = decodePcm(readFileSync(join(root, artifacts.wav))).pcm!;
    assert.ok(master); assert.ok(master.samples.some(v => v !== 0));
    for (const [i, stem] of artifacts.stems.entries()) {
      const bytes = readFileSync(join(root, stem.wav));
      assert.equal(decodePcm(bytes).pcm?.frames, master.frames);
      assert.equal(hash(bytes), diskManifest.stems[i].wav.sha256);
    }
    const second = await call('render', {project, stems: true, format: 'wav,mp3'});
    const repeated = second.artifacts as typeof artifacts;
    assert.notEqual(artifacts.wav, repeated.wav);
    for (const kind of ['wav', 'manifest', 'analysis'] as const)
      assert.deepEqual(readFileSync(join(root, artifacts[kind])), readFileSync(join(root, repeated[kind])));
    for (let i = 0; i < artifacts.stems.length; i++)
      assert.deepEqual(readFileSync(join(root, artifacts.stems[i]!.wav)), readFileSync(join(root, repeated.stems[i]!.wav)));
    const report = {ok: true, root, project, sha256: revision.sha256, artifacts, analysis: analysis.analysis,
      deterministic: ['master WAV', 'stems', 'analysis', 'manifest'], calls: transcript.length, stderr};
    writeFileSync(join(root, 'mcp-transcript.json'), JSON.stringify(transcript, null, 2) + '\n');
    writeFileSync(join(root, 'mcp-verification.json'), JSON.stringify(report, null, 2) + '\n');
    return report;
  } finally { await client.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync('renders', {recursive: true});
  const root = mkdtempSync(resolve('renders/mcp-demo-'));
  process.stdout.write(JSON.stringify(await runDemo(root), null, 2) + '\n');
}
