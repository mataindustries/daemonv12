import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { createServer } from '../mcp/server.ts';
import { decodePcm } from '../src/render/index.ts';

test('V0.6 MCP: still nine tools; agents author, read, validate and render sample performance with structured errors', async t => {
  const root = mkdtempSync(join(tmpdir(), 'daemon-v06-mcp-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync('examples/assets', join(root, 'assets'), { recursive: true });
  // Sample-only rendering needs neither audio executable.
  const server = createServer(root, { DAEMONV12_FLUIDSYNTH: '/missing/fluidsynth', DAEMONV12_FFMPEG: '/missing/ffmpeg' });
  const client = new Client({ name: 'v06-test', version: '1' }), [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide); await client.connect(clientSide);
  t.after(() => { void client.close(); void server.close(); });
  const listed = await client.listTools();
  assert.equal(listed.tools.length, 9);
  assert.match(client.getInstructions() ?? '', /playbackRate \(0\.25-4; pitch and duration change together/);
  // The published input schema teaches the fields and their ranges.
  const notes: Record<string, any>[] = [];
  const find = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const properties = (node as { properties?: Record<string, unknown> }).properties;
    if (properties && 'playbackRate' in properties) notes.push(properties as Record<string, any>);
    Object.values(node).forEach(find);
  };
  find(listed.tools.find(tool => tool.name === 'daemonv12_project_patch')!.inputSchema);
  assert.ok(notes.length >= 1);
  for (const note of notes) {
    assert.deepEqual([note.playbackRate.type, note.playbackRate.minimum, note.playbackRate.maximum], ['number', 0.25, 4]);
    assert.deepEqual([note.offsetSeconds.minimum, note.offsetSeconds.maximum], [0, 600]);
    assert.deepEqual([note.glide.type, note.glide.required, note.glide.additionalProperties], ['object', ['to', 'duration'], false]);
    assert.match(note.playbackRate.description, /pitch and duration change together/);
  }
  const call = async (name: string, args: Record<string, unknown>) => (await client.callTool({ name: `daemonv12_${name}`, arguments: args })).structuredContent as
    Record<string, any> & { ok: boolean; errors: { code: string; path: string; hint?: string; expected?: string }[] };
  const project = 'ghost.json';
  let current = await call('project_create', { project, title: 'Ghost chops', bpm: 140, bars: 1 });
  assert.equal(current.ok, true, JSON.stringify(current));
  const chops = [{ start: '1:1', playbackRate: 1.498307, offsetSeconds: 0.24 }, { start: '1:2', offsetSeconds: 0.05, glide: { to: 0.5, duration: '1/8' } }];
  current = await call('project_patch', { project, expectedSha256: current.sha256, edits: [
    { op: 'track_update', trackId: 'lead', fields: { instrument: { type: 'sampler', sample: 'assets/glasshouse/04-ghost-vox.wav' } } },
    { op: 'pattern_put', trackId: 'lead', pattern: { id: 'chop', bars: 1, notes: chops } },
    { op: 'notes_append', trackId: 'lead', patternId: 'chop', notes: [{ start: '1:3', playbackRate: 2, glide: { to: 1, duration: '1/4' } }] },
    { op: 'clips_set', trackId: 'lead', clips: [{ bar: 1, pattern: 'chop' }] },
    { op: 'track_add', track: { id: 'kit', instrument: { type: 'drumkit', kit: 'assets/glasshouse/kit.json' },
      patterns: [{ id: 'k', bars: 1, notes: [{ start: '1:1', pitch: 'chrome-clap', playbackRate: 0.8 }] }], clips: [{ bar: 1, pattern: 'k' }] } },
  ] });
  assert.equal(current.ok, true, JSON.stringify(current));
  const read = await call('project_read', { project, trackId: 'lead' });
  assert.deepEqual(read.document.patterns[0].notes, [...chops, { start: '1:3', playbackRate: 2, glide: { to: 1, duration: '1/4' } }]);
  assert.equal((await call('project_validate', { project })).ok, true);

  const before = readFileSync(join(root, project));
  const invalid: [unknown, string, string][] = [
    // Zod rejects out-of-schema values before the engine sees them.
    [{ op: 'pattern_put', trackId: 'lead', pattern: { id: 'chop', bars: 1, notes: [{ start: '1:1', playbackRate: 8 }] } }, 'INVALID_ARGUMENT', 'edits.1.pattern.notes.0.playbackRate'],
    [{ op: 'pattern_put', trackId: 'lead', pattern: { id: 'chop', bars: 1, notes: [{ start: '1:1', glide: { to: 2, duration: '1/4', shape: 'exp' } }] } }, 'INVALID_ARGUMENT', 'edits.1.pattern.notes.0.glide'],
    // The engine checks the WAV, the glide's motion and the instrument type.
    [{ op: 'pattern_put', trackId: 'lead', pattern: { id: 'chop', bars: 1, notes: [{ start: '1:1', offsetSeconds: 0.95 }] } }, 'OUT_OF_RANGE', 'tracks[0].patterns[0].notes[0].offsetSeconds'],
    [{ op: 'pattern_put', trackId: 'lead', pattern: { id: 'chop', bars: 1, notes: [{ start: '1:1', playbackRate: 2, glide: { to: 2, duration: '1/4' } }] } }, 'OUT_OF_RANGE', 'tracks[0].patterns[0].notes[0].glide.to'],
    [{ op: 'track_add', track: { id: 'keys', instrument: { type: 'gm', program: 'electric_piano_1' }, patterns: [{ id: 'k', bars: 1, notes: [{ start: '1:1', pitch: 'C4', duration: '1/4', playbackRate: 2 }] }], clips: [{ bar: 1, pattern: 'k' }] } }, 'UNKNOWN_FIELD', 'tracks[2].patterns[0].notes[0].playbackRate'],
  ];
  for (const [edit, code, path] of invalid) {
    const result = await call('project_patch', { project, expectedSha256: current.sha256, edits: [{ op: 'project_update', fields: { title: 'Must roll back' } }, edit] });
    assert.equal(result.ok, false); assert.equal(result.errors[0]!.code, code, JSON.stringify(result.errors)); assert.equal(result.errors[0]!.path, path);
    assert.deepEqual(readFileSync(join(root, project)), before, 'failed batches leave the project bytes unchanged');
  }
  const pastEnd = await call('project_patch', { project, expectedSha256: current.sha256, edits: [invalid[2]![0]] });
  assert.equal(pastEnd.errors[0]!.hint, 'Use at most 0.949988 seconds.');
  assert.match(pastEnd.errors[0]!.expected!, /04-ghost-vox\.wav \(41895 frames, 0\.950000 s\)/);
  const gm = await call('project_patch', { project, expectedSha256: current.sha256, edits: [invalid[4]![0]] });
  assert.equal(gm.errors[0]!.hint, 'playbackRate, offsetSeconds and glide apply only to sampler and drum-kit notes.');

  const rendered = await call('render', { project, stems: true });
  assert.equal(rendered.ok, true, JSON.stringify(rendered));
  assert.equal(decodePcm(readFileSync(join(root, rendered.artifacts.wav))).pcm!.frames, decodePcm(readFileSync(join(root, rendered.artifacts.stems[0].wav))).pcm!.frames);
  assert.equal(rendered.manifest.samples.playback.name, 'daemonv12-playback', 'compact provenance names the resampler');
  assert.equal(rendered.manifest.samples.tracks, undefined, 'compact provenance omits triggers');
  const full = await call('render_info', { manifest: rendered.artifacts.manifest, detail: 'full' });
  const triggers = full.manifest.samples.tracks[0].triggers;
  assert.deepEqual(triggers.map((x: { playback: unknown }) => x.playback), [
    { rate: 1.498307, offset: { seconds: 0.24, frames: 10584 }, voiceFrames: Math.ceil((41895 - 10584) / 1.498307) },
    { rate: 1, offset: { seconds: 0.05, frames: 2205 }, glide: { to: 0.5, duration: '1/8', frames: 9450 }, voiceFrames: triggers[1].playback.voiceFrames },
    { rate: 2, glide: { to: 1, duration: '1/4', frames: 18900 }, voiceFrames: triggers[2].playback.voiceFrames },
  ]);
  assert.deepEqual(full.manifest.samples.tracks[1].triggers[0].playback, { rate: 0.8, voiceFrames: full.manifest.samples.tracks[1].triggers[0].playback.voiceFrames });
  const summary = await call('render_info', { manifest: rendered.artifacts.manifest });
  assert.equal(summary.manifest.samples.tracks, undefined);
});
