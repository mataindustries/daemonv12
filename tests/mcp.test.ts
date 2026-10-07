import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { DaemonTools, type ToolResult } from '../mcp/handlers.ts';
import { createServer } from '../mcp/server.ts';
import { schemas } from '../mcp/schemas.ts';
import { Workspace, hash } from '../mcp/workspace.ts';
import { compileProjectFile, compileProjectTextWithAssets } from '../src/pipeline.ts';

function fixture(t: {after: (fn: () => void) => void}) {
  const root = mkdtempSync(join(tmpdir(), 'daemon-mcp-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  cpSync('examples/assets', join(root, 'assets'), {recursive: true});
  const tools = new DaemonTools(root);
  return {root, tools, call: (suffix: string, args: unknown = {}) => tools.call(`daemonv12_${suffix}`, args)};
}
function code(result: ToolResult) { return (result.errors as {code: string}[])[0]?.code; }
const project = 'music.json';
const pattern = {id: 'one', bars: 1, notes: [{start: '1:1', pitch: 'C4', duration: '1/4'}]};

test('MCP initialization, nine schemas, structured protocol results and invalid arguments', async t => {
  const {root} = fixture(t), server = createServer(root);
  const client = new Client({name: 'test', version: '1'});
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  t.after(() => { void client.close(); void server.close(); });
  assert.equal(client.getServerVersion()?.name, 'daemonv12');
  const listed = await client.listTools();
  assert.deepEqual(listed.tools.map(t => t.name).sort(), Object.keys(schemas).sort());
  assert.deepEqual(listed.tools.find(t => t.name === 'daemonv12_project_create')?.inputSchema.required, ['project', 'title']);
  assert.deepEqual(listed.tools.find(t => t.name === 'daemonv12_render')?.inputSchema.required, ['project']);
  for (const tool of listed.tools) {
    assert.equal(tool.inputSchema.type, 'object');
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.equal(tool.annotations?.openWorldHint, false);
  }
  const created = await client.callTool({name: 'daemonv12_project_create', arguments: {project, title: 'MCP'}});
  assert.equal(created.isError, false); assert.equal((created.structuredContent as ToolResult).ok, true);
  const invalid = await client.callTool({name: 'daemonv12_project_patch', arguments: {project, edits: []}});
  assert.equal(invalid.isError, true); assert.equal(code(invalid.structuredContent as ToolResult), 'INVALID_ARGUMENT');
  const unknown = await client.callTool({name: 'missing', arguments: {}});
  assert.equal(code(unknown.structuredContent as ToolResult), 'UNKNOWN_TOOL');
});

test('create defaults, read summary, validation, and byte-preserving overwrite refusal', async t => {
  const {root, call} = fixture(t);
  const created = await call('project_create', {project, title: 'Test'});
  assert.equal(created.ok, true);
  const bytes = readFileSync(join(root, project));
  const doc = JSON.parse(bytes.toString());
  assert.equal(doc.bpm, 120); assert.equal(doc.bars, 4); assert.equal(doc.seed, 0);
  assert.equal(doc.tracks[0].instrument.program, 'acoustic_grand_piano');
  assert.equal(created.sha256, hash(bytes)); assert.ok(created.nextActions);
  assert.equal(code(await call('project_create', {project, title: 'Replace'})), 'PROJECT_EXISTS');
  assert.deepEqual(readFileSync(join(root, project)), bytes);
  const read = await call('project_read', {project});
  assert.equal(read.ok, true); assert.equal(read.sha256, created.sha256);
  assert.equal((read.document as {title: string}).title, 'Test');
  assert.equal((await call('project_validate', {project})).ok, true);
  assert.equal(compileProjectFile(join(root, project)).timeline?.ppq, 960);
});

test('semantic edits: tracks, patterns, notes, clips, instruments, mix, effects, metadata and removals', async t => {
  const {call, root} = fixture(t);
  let current = await call('project_create', {project, title: 'Test'});
  current = await call('project_patch', {project, expectedSha256: current.sha256, edits: [
    {op: 'project_update', fields: {bpm: 96, key: 'D minor', description: 'Intent', master: {gainDb: -1}}},
    {op: 'track_update', trackId: 'lead', fields: {instrument: {type: 'gm', program: 'electric_piano_1'}, mix: {gainDb: -4, pan: -0.2}, effects: [{type: 'highpass', frequencyHz: 120}]}},
    {op: 'pattern_put', trackId: 'lead', pattern},
    {op: 'notes_append', trackId: 'lead', patternId: 'one', notes: [{start: '1:2', pitch: 'D4', duration: '1/4'}]},
    {op: 'clips_set', trackId: 'lead', clips: [{bar: 1, pattern: 'one'}]},
    {op: 'track_add', track: {id: 'drums', instrument: {type: 'drumkit', kit: 'assets/pulse-kit/kit.json'}}},
  ]});
  assert.equal(current.ok, true, JSON.stringify(current.errors));
  const c = compileProjectFile(join(root, project));
  assert.equal(c.project?.bpm, 96); assert.equal(c.project?.tracks.length, 2);
  assert.equal(c.timeline?.tracks[0]?.notes.length, 2);
  const read = await call('project_read', {project, trackId: 'lead', noteOffset: 1, noteLimit: 1});
  const document = read.document as {patterns: {notes: {pitch: string}[]; totalNotes: number}[]};
  assert.equal(document.patterns[0]?.notes[0]?.pitch, 'D4');
  assert.equal(document.patterns[0]?.totalNotes, 2);
  current = await call('project_patch', {project, expectedSha256: current.sha256, edits: [
    {op: 'track_remove', trackId: 'drums'}, {op: 'clips_set', trackId: 'lead', clips: []},
    {op: 'pattern_remove', trackId: 'lead', patternId: 'one'},
    {op: 'track_update', trackId: 'lead', fields: {effects: null, mix: null}},
    {op: 'project_update', fields: {master: null, key: null}},
  ]});
  assert.equal(current.ok, true);
  const final = JSON.parse(readFileSync(join(root, project), 'utf8'));
  assert.equal(final.tracks.length, 1); assert.equal(final.tracks[0].patterns.length, 0);
  assert.equal(final.tracks[0].effects, undefined); assert.equal(final.master, undefined);
});

test('invalid patches are transactional: overlaps, assets, bounds, missing targets, prototype keys', async t => {
  const {root, call} = fixture(t);
  const created = await call('project_create', {project, title: 'Original'});
  const original = readFileSync(join(root, project));
  const attempts = [
    [{op: 'pattern_put', trackId: 'lead', pattern: {...pattern, notes: [...pattern.notes, ...pattern.notes]}}, {op: 'clips_set', trackId: 'lead', clips: [{bar: 1, pattern: 'one'}]}],
    [{op: 'track_add', track: {id: 'sample', instrument: {type: 'sampler', sample: 'assets/missing.wav'}}}],
    [{op: 'track_add', track: {id: 'sample', instrument: {type: 'sampler', sample: 'assets/../../outside.wav'}}}],
    [{op: 'track_remove', trackId: 'lead'}],
    [{op: 'track_remove', trackId: 'absent'}],
    [JSON.parse('{"op":"project_update","fields":{"__proto__":{"polluted":true}}}')],
  ];
  for (const edits of attempts) {
    const result = await call('project_patch', {project, expectedSha256: created.sha256,
      edits: [{op: 'project_update', fields: {title: 'Must not persist'}}, ...edits]});
    assert.equal(result.ok, false); assert.ok(code(result));
    assert.deepEqual(readFileSync(join(root, project)), original);
    assert.ok(!readdirSync(root).some(p => p.startsWith('.daemonv12-edit-')));
  }
  assert.equal(({} as {polluted?: boolean}).polluted, undefined);
});

test('concurrent stale edits: one succeeds and one conflicts; atomic publisher checks revisions', async t => {
  const {root, call} = fixture(t), created = await call('project_create', {project, title: 'Original'});
  const results = await Promise.all(['First', 'Second'].map(title => call('project_patch', {project, expectedSha256: created.sha256,
    edits: [{op: 'project_update', fields: {title}}]})));
  assert.equal(results.filter(r => r.ok).length, 1);
  assert.equal(code(results[1]!), 'PROJECT_CONFLICT');
  const ws = new Workspace(root);
  assert.throws(() => ws.publish(project, '{}', created.sha256 as string), /changed/);
  assert.equal(JSON.parse(readFileSync(join(root, project), 'utf8')).title, 'First');
});

test('path safety rejects traversal, absolute paths, hidden areas, assets writes and links', async t => {
  const {root, call} = fixture(t);
  for (const project of ['../escape.json', '/tmp/escape.json', 'dir/../escape.json', 'dir\\escape.json', '.git/config.json', 'assets/kit.json', 'node_modules/pkg.json', 'file.txt']) {
    assert.equal(code(await call('project_create', {project, title: 'Unsafe'})), 'PATH_UNSAFE', project);
    assert.equal(code(await call('project_read', {project})), 'PATH_UNSAFE', project);
  }
  const outside = mkdtempSync(join(tmpdir(), 'daemon-outside-'));
  t.after(() => rmSync(outside, {recursive: true, force: true}));
  writeFileSync(join(outside, 'secret.json'), 'unchanged');
  symlinkSync(outside, join(root, 'escape'));
  symlinkSync(join(outside, 'secret.json'), join(root, 'link.json'));
  linkSync(join(outside, 'secret.json'), join(root, 'hard.json'));
  for (const project of ['escape/secret.json', 'link.json', 'hard.json']) {
    assert.equal(code(await call('project_read', {project})), 'PATH_UNSAFE');
    assert.equal(code(await call('project_create', {project, title: 'Unsafe'})), 'PATH_UNSAFE');
  }
  symlinkSync(outside, join(root, '.daemonv12-renders'));
  await call('project_create', {project, title: 'Safe'});
  assert.equal(code(await call('render', {project})), 'PATH_UNSAFE');
  assert.equal(code(await call('analyze', {audio: '../secret.wav'})), 'PATH_UNSAFE');
  assert.equal(code(await call('render_info', {manifest: '../secret.render.json'})), 'PATH_UNSAFE');
  assert.equal(readFileSync(join(outside, 'secret.json'), 'utf8'), 'unchanged');
});

test('discovery returns all GM names, playable sample paths and validated named kit mappings', async t => {
  const {call, root} = fixture(t);
  const gm = await call('instruments_list');
  assert.equal((gm.gm as string[]).length, 128);
  const found = await call('instruments_list', {project, query: 'impact'});
  assert.ok((found.samples as string[]).includes('assets/pulse-kit/impact.wav'));
  const kits = await call('drumkits_list', {project});
  assert.equal(kits.ok, true); assert.equal(kits.totalKits, 2);
  assert.deepEqual(kits.warnings, []);
  const discovered = kits.kits as {kit: string; samples: {name: string}[]}[];
  assert.deepEqual(discovered.map(k => k.kit), ['assets/orbital-foundry/kit.json', 'assets/pulse-kit/kit.json']);
  assert.deepEqual(discovered[1]!.samples.map(s => s.name), ['kick', 'snare', 'hat']);
  assert.deepEqual(discovered[0]!.samples.map(s => s.name), [
    'sub-pulse', 'mechanical-kick', 'metallic-strike', 'machine-tick',
    'industrial-snare', 'low-boom', 'cinematic-impact',
  ]);
  mkdirSync(join(root, 'empty'));
  assert.equal((await call('drumkits_list', {project: 'empty/new.json'})).totalKits, 0);
});

test('candidate asset validation matches the existing file API, including escaping asset symlinks', async t => {
  const {root, call} = fixture(t), created = await call('project_create', {project, title: 'Test'});
  const text = readFileSync(join(root, project), 'utf8');
  assert.deepEqual(compileProjectTextWithAssets(text, join(root, project)).timeline, compileProjectFile(join(root, project)).timeline);
  const outside = mkdtempSync(join(tmpdir(), 'daemon-outside-asset-'));
  t.after(() => rmSync(outside, {recursive: true, force: true}));
  cpSync('examples/assets/pulse-kit/impact.wav', join(outside, 'out.wav'));
  symlinkSync(outside, join(root, 'assets', 'escape'));
  const result = await call('project_patch', {project, expectedSha256: created.sha256, edits: [
    {op: 'track_add', track: {id: 'sample', instrument: {type: 'sampler', sample: 'assets/escape/out.wav'}}},
  ]});
  assert.equal(code(result), 'INVALID_ASSET_PATH'); assert.equal(readFileSync(join(root, project), 'utf8'), text);
});

test('structured failures: malformed JSON, missing files, invalid arguments and resource cap', async t => {
  const {root, call} = fixture(t);
  assert.equal(code(await call('project_read', {project})), 'FILE_NOT_FOUND');
  writeFileSync(join(root, project), '{');
  assert.equal(code(await call('project_read', {project})), 'JSON_PARSE_ERROR');
  assert.equal(code(await call('project_validate', {project})), 'JSON_PARSE_ERROR');
  assert.equal(code(await call('project_create', {project: 'new.json', title: 'Test', bpm: 500})), 'INVALID_ARGUMENT');
  writeFileSync(join(root, project), ' '.repeat(2 * 1024 * 1024 + 1));
  assert.equal(code(await call('project_read', {project})), 'RESOURCE_LIMIT');
});

test('sample-only handler render needs no audio executables; failed export preserves earlier artifacts', async t => {
  const {root} = fixture(t);
  const tools = new DaemonTools(root, {DAEMONV12_FLUIDSYNTH: '/missing/fluidsynth', DAEMONV12_FFMPEG: '/missing/ffmpeg'});
  const created = await tools.call('daemonv12_project_create', {project, title: 'Samples'});
  const patched = await tools.call('daemonv12_project_patch', {project, expectedSha256: created.sha256, edits: [
    {op: 'track_update', trackId: 'lead', fields: {instrument: {type: 'sampler', sample: 'assets/pulse-kit/impact.wav'}}},
    {op: 'pattern_put', trackId: 'lead', pattern: {id: 'hit', bars: 1, notes: [{start: '1:1'}]}},
    {op: 'clips_set', trackId: 'lead', clips: [{bar: 1, pattern: 'hit'}]},
  ]});
  assert.equal(patched.ok, true);
  const rendered = await tools.call('daemonv12_render', {project, stems: true});
  assert.equal(rendered.ok, true, JSON.stringify(rendered));
  const artifacts = rendered.artifacts as {wav: string; manifest: string; stems: {wav: string}[]};
  assert.equal(artifacts.stems.length, 1);
  assert.ok(!JSON.stringify(rendered).includes('base64'));
  const wav = readFileSync(join(root, artifacts.wav));
  const info = await tools.call('daemonv12_render_info', {manifest: artifacts.manifest});
  assert.equal(info.ok, true);
  const analyzed = await tools.call('daemonv12_analyze', {audio: artifacts.wav});
  assert.equal(code(analyzed), 'AUDIO_TOOL_NOT_FOUND');
  const failed = await tools.call('daemonv12_render', {project, format: 'mp3'});
  assert.equal(code(failed), 'AUDIO_TOOL_NOT_FOUND');
  assert.deepEqual(failed.artifacts, {});
  assert.deepEqual(readFileSync(join(root, artifacts.wav)), wav);
  assert.equal((await tools.call('daemonv12_render_info', {manifest: artifacts.manifest})).ok, true);
  writeFileSync(join(root, artifacts.manifest), '{');
  assert.equal(code(await tools.call('daemonv12_render_info', {manifest: artifacts.manifest})), 'INVALID_MANIFEST');
});
