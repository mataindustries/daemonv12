import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { createServer } from '../mcp/server.ts';
import { decodePcm } from '../src/render/index.ts';

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

test('V0.7 MCP: nine tools publish articulation and render authored slices, gates and choke groups deterministically', async t => {
  const root = mkdtempSync(join(tmpdir(), 'daemon-v07-mcp-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync('examples/assets', join(root, 'assets'), { recursive: true });
  const server = createServer(root, { DAEMONV12_FLUIDSYNTH: '/missing/fluidsynth', DAEMONV12_FFMPEG: '/missing/ffmpeg' });
  const client = new Client({ name: 'v07-test', version: '1' });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide); await client.connect(clientSide);
  t.after(() => { void client.close(); void server.close(); });
  const listed = await client.listTools();
  assert.equal(listed.tools.length, 9);
  assert.match(client.getInstructions() ?? '', /endSeconds \(exclusive source endpoint\)/);
  assert.match(client.getInstructions() ?? '', /Gate and envelope use output time, independent of playbackRate\/glide/);
  const noteSchemas: Record<string, any>[] = [];
  const find = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const properties = (node as { properties?: Record<string, unknown> }).properties;
    if (properties && 'playbackRate' in properties) noteSchemas.push(properties as Record<string, any>);
    Object.values(node).forEach(find);
  };
  find(listed.tools.find(tool => tool.name === 'daemonv12_project_patch')!.inputSchema);
  assert.ok(noteSchemas.length >= 1);
  for (const note of noteSchemas) {
    assert.deepEqual([note.endSeconds.type, note.endSeconds.minimum, note.endSeconds.maximum], ['number', 0, 600]);
    assert.equal(note.gate.type, 'string');
    assert.match(note.gate.description, /whole-note fraction/);
    assert.deepEqual([note.envelope.type, note.envelope.additionalProperties], ['object', false]);
    assert.equal(note.envelope.required, undefined, 'partial or empty envelope selects defaults');
    for (const field of ['attackSeconds', 'releaseSeconds'])
      assert.deepEqual([note.envelope.properties[field].type, note.envelope.properties[field].minimum, note.envelope.properties[field].maximum], ['number', 0, 10]);
    assert.equal(note.chokeGroup.pattern, '^[a-z][a-z0-9-]{0,31}$');
    assert.match(note.envelope.description, /Any endSeconds, gate, envelope or chokeGroup opts into the default envelope/);
  }
  const call = async (name: string, args: Record<string, unknown>) => (await client.callTool({ name: `daemonv12_${name}`, arguments: args })).structuredContent as
    Record<string, any> & { ok: boolean; errors: { code: string; path: string; hint?: string; expected?: string }[] };
  const project = 'articulation.json';
  let current = await call('project_create', { project, title: 'Articulated one sound', bpm: 120, bars: 1 });
  assert.equal(current.ok, true, JSON.stringify(current));
  const firstNotes = [
    { start: '1:1', velocity: 0.4, endSeconds: 0.65, gate: '1/8', envelope: { attackSeconds: 0.003, releaseSeconds: 0.025 }, chokeGroup: 'vowel' },
    { start: '1:1+1/16', velocity: 0.4, offsetSeconds: 0.15, endSeconds: 0.5, playbackRate: 0.5, glide: { to: 2, duration: '1/4' }, gate: '1/16', chokeGroup: 'vowel' },
  ];
  const appended = { start: '1:2', velocity: 0.4, offsetSeconds: 0.05, endSeconds: 0.42, playbackRate: 2, gate: '1/8', envelope: {} };
  current = await call('project_patch', { project, expectedSha256: current.sha256, edits: [
    { op: 'track_update', trackId: 'lead', fields: { instrument: { type: 'sampler', sample: 'assets/glasshouse/04-ghost-vox.wav' } } },
    { op: 'pattern_put', trackId: 'lead', pattern: { id: 'slices', bars: 1, notes: firstNotes } },
    { op: 'notes_append', trackId: 'lead', patternId: 'slices', notes: [appended] },
    { op: 'clips_set', trackId: 'lead', clips: [{ bar: 1, pattern: 'slices' }] },
    { op: 'track_add', track: { id: 'kit', instrument: { type: 'drumkit', kit: 'assets/glasshouse/kit.json' },
      patterns: [{ id: 'hits', bars: 1, notes: [{ start: '1:3', pitch: 'chrome-clap', velocity: 0.3, endSeconds: 0.09, gate: '1/32', envelope: { releaseSeconds: 0.01 }, chokeGroup: 'clap' }] }],
      clips: [{ bar: 1, pattern: 'hits' }] } },
  ] });
  assert.equal(current.ok, true, JSON.stringify(current));
  const read = await call('project_read', { project, trackId: 'lead' });
  assert.deepEqual(read.document.patterns[0].notes, [...firstNotes, appended]);
  assert.equal((await call('project_validate', { project })).ok, true);

  const before = readFileSync(join(root, project));
  const replace = (note: unknown) => ({ op: 'pattern_put', trackId: 'lead', pattern: { id: 'slices', bars: 1, notes: [note] } });
  const malformed: [unknown, string, string][] = [
    [replace({ start: '1:1', endSeconds: -1 }), 'INVALID_ARGUMENT', 'edits.1.pattern.notes.0.endSeconds'],
    [replace({ start: '1:1', envelope: { releaseSeconds: 11 } }), 'INVALID_ARGUMENT', 'edits.1.pattern.notes.0.envelope.releaseSeconds'],
    [replace({ start: '1:1', envelope: { shape: 'linear' } }), 'INVALID_ARGUMENT', 'edits.1.pattern.notes.0.envelope'],
    [replace({ start: '1:1', chokeGroup: 'Hat Group' }), 'INVALID_ARGUMENT', 'edits.1.pattern.notes.0.chokeGroup'],
    [replace({ start: '1:1', gate: 0.5 }), 'INVALID_ARGUMENT', 'edits.1.pattern.notes.0.gate'],
    [replace({ start: '1:1', endSeconds: 0.96 }), 'OUT_OF_RANGE', 'tracks[0].patterns[0].notes[0].endSeconds'],
    [replace({ start: '1:1', offsetSeconds: 0.2, endSeconds: 0.2 }), 'OUT_OF_RANGE', 'tracks[0].patterns[0].notes[0].endSeconds'],
    [replace({ start: '1:1', offsetSeconds: 0.2, endSeconds: 0.200001 }), 'OUT_OF_RANGE', 'tracks[0].patterns[0].notes[0].endSeconds'],
    [replace({ start: '1:1', gate: '0/4' }), 'INVALID_DURATION', 'tracks[0].patterns[0].notes[0].gate'],
    [replace({ start: '1:1', gate: '1/7' }), 'OFF_GRID', 'tracks[0].patterns[0].notes[0].gate'],
    [replace({ start: '1:1', endSeconds: 0.5000001 }), 'INVALID_DURATION', 'tracks[0].patterns[0].notes[0].endSeconds'],
    [replace({ start: '1:1', envelope: { attackSeconds: 0.0000001 } }), 'INVALID_DURATION', 'tracks[0].patterns[0].notes[0].envelope.attackSeconds'],
    [replace({ start: '1:1', envelope: { releaseSeconds: 0.000011 } }), 'OUT_OF_RANGE', 'tracks[0].patterns[0].notes[0].envelope.releaseSeconds'],
    [{ op: 'track_add', track: { id: 'keys', instrument: { type: 'gm', program: 'electric_piano_1' }, patterns: [{ id: 'k', bars: 1, notes: [{ start: '1:1', pitch: 'C4', duration: '1/4', gate: '1/8' }] }], clips: [{ bar: 1, pattern: 'k' }] } },
      'UNKNOWN_FIELD', 'tracks[2].patterns[0].notes[0].gate'],
  ];
  for (const [edit, code, path] of malformed) {
    const result = await call('project_patch', { project, expectedSha256: current.sha256, edits: [{ op: 'project_update', fields: { title: 'Must roll back' } }, edit] });
    assert.equal(result.ok, false);
    assert.equal(result.errors[0]!.code, code, JSON.stringify(result.errors));
    assert.equal(result.errors[0]!.path, path, JSON.stringify(result.errors));
    assert.ok(result.errors[0]!.hint || result.errors[0]!.expected, 'repair diagnostics state a hint or expected value');
    assert.deepEqual(readFileSync(join(root, project)), before, 'failed transactions preserve authored bytes');
  }
  const pastEnd = await call('project_patch', { project, expectedSha256: current.sha256, edits: [malformed[5]![0]] });
  assert.match(pastEnd.errors[0]!.expected ?? '', /04-ghost-vox\.wav/);
  assert.match(pastEnd.errors[0]!.hint ?? '', /0\.95/);

  const first = await call('render', { project, stems: true });
  const second = await call('render', { project, stems: true });
  assert.equal(first.ok, true, JSON.stringify(first)); assert.equal(second.ok, true, JSON.stringify(second));
  assert.notEqual(first.artifacts.wav, second.artifacts.wav, 'renders use fresh output directories');
  const artifacts = (result: typeof first) => [result.artifacts.wav, ...result.artifacts.stems.map((stem: { wav: string }) => stem.wav)];
  assert.equal(artifacts(first).length, 3);
  const expectedFrames = 88_200;
  for (const [index, path] of artifacts(first).entries()) {
    const bytes = readFileSync(join(root, path));
    assert.equal(decodePcm(bytes).pcm!.frames, expectedFrames, 'master and stems align exactly');
    assert.equal(sha256(bytes), sha256(readFileSync(join(root, artifacts(second)[index]))));
  }
  assert.equal(first.manifest.samples.articulation.name, 'daemonv12-articulation', 'compact provenance names the articulation algorithm');
  assert.equal(first.manifest.samples.articulation.version, '1');
  assert.equal(first.manifest.samples.tracks, undefined);
  const full = await call('render_info', { manifest: first.artifacts.manifest, detail: 'full' });
  assert.deepEqual(full.manifest.samples.articulation, first.manifest.samples.articulation);
  for (const track of full.manifest.samples.tracks)
    for (const trigger of track.triggers) assert.ok(trigger.articulation, 'full provenance records each articulated trigger');
  const triggers = full.manifest.samples.tracks[0].triggers;
  assert.deepEqual(triggers[0].articulation.sourceEnd, { seconds: 0.65, frames: 28_665 });
  assert.deepEqual(triggers[0].articulation.gate, { duration: '1/8', frames: 11_025 });
  assert.deepEqual(triggers[0].articulation.envelope, { attackSeconds: 0.003, attackFrames: 132, releaseSeconds: 0.025, releaseFrames: 1_103 });
  assert.equal(triggers[0].articulation.chokeGroup, 'vowel');
  assert.deepEqual(triggers[0].articulation.choke, { frame: 5_513, frames: 5_513 });
  assert.deepEqual(triggers[1].articulation.envelope, { attackSeconds: 0.001, attackFrames: 44, releaseSeconds: 0.005, releaseFrames: 221 }, 'omitted envelope uses articulated defaults');
  assert.deepEqual(triggers[2].articulation.envelope, triggers[1].articulation.envelope, 'empty envelope uses articulated defaults');
  for (const trigger of triggers) {
    assert.ok(trigger.articulation.renderedFrames <= trigger.articulation.voiceFrames);
    assert.ok(trigger.articulation.renderedFrames < 41_895, 'early stops reduce work relative to the full source');
  }
  assert.deepEqual(full.manifest, JSON.parse(readFileSync(join(root, first.artifacts.manifest), 'utf8')));
  const summary = await call('render_info', { manifest: first.artifacts.manifest });
  assert.deepEqual(summary.manifest.samples.articulation, first.manifest.samples.articulation);
  assert.equal(summary.manifest.samples.tracks, undefined);
});
