import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileProjectFile, productionRoute, runCommand } from '../src/pipeline.ts';
import { playbackBudget } from '../src/sample-render.ts';
import { DaemonTools } from '../mcp/handlers.ts';
import { decodePcm, voiceCost, voiceFrames, PLAYBACK_VOICE_BYTES_LIMIT, PLAYBACK_WORK_LIMIT, type Pcm, type VoiceArticulation } from '../src/render/index.ts';
import { wav } from './helpers/tones.ts';

const pcmOf = (frames: number, channels: 1 | 2 = 1): Pcm => ({ frames, channels, samples: new Int16Array(0) });
function workspace(t: TestContext, sources: Record<string, Buffer>) {
  const root = mkdtempSync(join(tmpdir(), 'daemon-v07-budget-'));
  t.after(() => rmSync(root, { recursive: true, force: true })); mkdirSync(join(root, 'assets'));
  for (const [name, bytes] of Object.entries(sources)) writeFileSync(join(root, 'assets', name), bytes);
  const path = join(root, 'cue.json');
  const save = (value: unknown) => writeFileSync(path, JSON.stringify(value));
  const compile = (value: unknown) => { save(value); return compileProjectFile(path); };
  return { root, path, save, compile };
}
const project = (notes: unknown[], clips = [{ bar: 1, pattern: 'p' }], sample = 'assets/one.wav') => ({
  formatVersion: 1, title: 'V0.7 budget', bpm: 120, timeSignature: '4/4', bars: 1, tracks: [
    { id: 'one', instrument: { type: 'sampler', sample }, clips, patterns: [{ id: 'p', bars: 1, notes }] },
  ],
});
const metric = (d: { received?: unknown } | undefined) => (d?.received as { metric?: string } | undefined)?.metric;

test('V0.7 cost: endpoints, gates, release tails and output caps charge only rendered frames while copy voices remain free', () => {
  const pcm = pcmOf(100000, 2), playback = { rate: 0.25, offset: 400 };
  const gate: VoiceArticulation = { stop: 100, attack: 44, release: 20 };
  const full = voiceCost(pcm, playback), stopped = voiceCost(pcm, playback, Infinity, gate);
  assert.equal(voiceFrames(pcm, playback, gate), 120);
  assert.equal(stopped.bytes, 120 * 2 * 8); assert.equal(stopped.work, 120 * (full.work / voiceFrames(pcm, playback)));
  assert.deepEqual(voiceCost(pcm, playback, 80, gate), { work: 80 * (stopped.work / 120), bytes: 80 * 2 * 8 });
  const slice = { end: 405, attack: 44, release: 1000 };
  assert.equal(voiceFrames(pcm, playback, slice), 20, 'release does not extend a source slice');
  assert.equal(voiceCost(pcm, playback, Infinity, slice).bytes, 20 * 2 * 8);
  assert.equal(voiceFrames(pcm, playback, { ...slice, stop: 1 }), 20, 'a long release still ends at the source boundary');
  assert.deepEqual(voiceCost(pcm, undefined, Infinity, gate), { work: 0, bytes: 0 });
  assert.deepEqual(voiceCost(pcm, { rate: 1, offset: 400 }, Infinity, slice), { work: 0, bytes: 0 });
  assert.deepEqual(voiceCost(pcm, playback, 0, gate), { work: 0, bytes: 0 });
});

test('V0.7 preflight: a stereo voice over the natural memory limit validates and renders when its gate stops it safely', async t => {
  const frames = PLAYBACK_VOICE_BYTES_LIMIT / 64 + 1;
  const w = workspace(t, { 'one.wav': wav(new Int16Array(frames * 2), 2) });
  const ungated = project([{ start: '1:1', playbackRate: 0.25 }]);
  const rejected = w.compile(ungated);
  assert.equal(rejected.timeline, null); assert.equal(metric(rejected.diagnostics[0]), 'performedVoiceBytes');
  const gated = project([{ start: '1:1', playbackRate: 0.25, gate: '1/256' }]);
  const c = w.compile(gated);
  assert.deepEqual(c.diagnostics, []);
  const actualFrames = 345 + 221;
  assert.equal(playbackBudget(c, productionRoute(c.project!), { work: actualFrames * 71, bytes: actualFrames * 2 * 8 }), undefined);
  assert.equal(metric(playbackBudget(c, false, { work: Infinity, bytes: actualFrames * 2 * 8 - 1 })), 'performedVoiceBytes');
  const rendered = await runCommand('render', w.path, { outDir: join(w.root, 'out'), stems: true });
  assert.equal(rendered.exitCode, 0, JSON.stringify(rendered.result.errors));
  const pcm = decodePcm(readFileSync(rendered.result.artifacts.wav!)).pcm!;
  assert.equal(pcm.frames, 88200, 'shortened tail fits inside the historical authored minimum');
  const manifest = rendered.result.manifest as any;
  assert.equal(manifest.samples.tracks[0].triggers[0].articulation.voiceFrames, actualFrames);
  assert.equal(manifest.samples.tracks[0].triggers[0].articulation.renderedFrames, actualFrames);
  assert.equal(pcm.samples.every(v => v === 0), true);
});

test('V0.7 preflight: overlapping transformed notes gain only safe work reduction from gates or actual track-local chokes', async t => {
  const w = workspace(t, { 'one.wav': wav(new Int16Array(44100).fill(1000)) });
  const notes = Array.from({ length: 100 }, () => ({ start: '1:1', playbackRate: 0.25 }));
  const clips = Array.from({ length: 100 }, () => ({ bar: 1, pattern: 'p' }));
  const rejected = w.compile(project(notes, clips));
  assert.equal(metric(rejected.diagnostics[0]), 'interpolationTaps');
  const gated = w.compile(project(notes.map(note => ({ ...note, gate: '1/256' })), clips));
  assert.deepEqual(gated.diagnostics, [], '10,000 very short released voices stay under the existing budget');
  assert.equal(playbackBudget(gated, false), undefined);
  assert.ok(10000 * (345 + 221) * 71 < PLAYBACK_WORK_LIMIT);
  // Same-frame group membership never silently removes simultaneous voices from the estimate.
  const simultaneous = w.compile(project(notes.map(note => ({ ...note, chokeGroup: 'hats' })), clips));
  assert.equal(metric(simultaneous.diagnostics[0]), 'interpolationTaps');
  assert.equal(simultaneous.timeline, null);

  const sequential = w.compile(project([
    { start: '1:1', playbackRate: 0.25, chokeGroup: 'hats' },
    { start: '1:1+1/256', playbackRate: 0.25, chokeGroup: 'hats', gate: '1/256' },
  ]));
  assert.deepEqual(sequential.diagnostics, []);
  assert.equal(playbackBudget(sequential, false, { work: 100000, bytes: PLAYBACK_VOICE_BYTES_LIMIT }), undefined,
    'the next distinct onset safely shortens the first voice in preflight');
  const independent = w.compile(project([
    { start: '1:1', playbackRate: 0.25, chokeGroup: 'hats' },
    { start: '1:1+1/256', playbackRate: 0.25, chokeGroup: 'other', gate: '1/256' },
  ]));
  assert.equal(metric(playbackBudget(independent, false, { work: 100000, bytes: PLAYBACK_VOICE_BYTES_LIMIT })), 'interpolationTaps',
    'a different group leaves the first natural voice charged');

  const tools = new DaemonTools(w.root, { DAEMONV12_FFMPEG: '/missing/ffmpeg', DAEMONV12_FLUIDSYNTH: '/missing/fluidsynth' });
  w.save(project([{ start: '1:1', playbackRate: 0.25, gate: '1/256' }]));
  const before = readFileSync(w.path), read = await tools.call('daemonv12_project_read', { project: 'cue.json' });
  const patched = await tools.call('daemonv12_project_patch', { project: 'cue.json', expectedSha256: read.sha256, edits: [
    { op: 'pattern_put', trackId: 'one', pattern: { id: 'p', bars: 1, notes } }, { op: 'clips_set', trackId: 'one', clips },
  ] });
  assert.equal(patched.ok, false); assert.equal(metric((patched.errors as unknown[])[0] as never), 'interpolationTaps');
  assert.deepEqual(readFileSync(w.path), before, 'unsafe replacement is not published');
  assert.equal(existsSync(join(w.root, 'renders')), false);
});

test('V0.7 resource failure: invalid endpoint is rejected before costing or audio tools and clears outputs', async t => {
  const w = workspace(t, { 'one.wav': wav(new Int16Array(44100)) });
  w.save(project([{ start: '1:1', playbackRate: 0.25, offsetSeconds: 0.4, endSeconds: 0.2, gate: '1/256' }]));
  const result = await runCommand('render', w.path, { outDir: join(w.root, 'out'), stems: true,
    env: { DAEMONV12_FFMPEG: '/missing/ffmpeg', DAEMONV12_FLUIDSYNTH: '/missing/fluidsynth' } });
  assert.equal(result.exitCode, 1);
  assert.ok(result.result.errors.some(d => d.path.endsWith('.endSeconds')));
  assert.equal(result.result.errors.some(d => /AUDIO_TOOL|INTERNAL_ERROR/.test(d.code)), false);
  assert.equal(result.result.manifest, null); assert.deepEqual(result.result.artifacts, {});
  assert.equal(existsSync(join(w.root, 'out')), false);
});
