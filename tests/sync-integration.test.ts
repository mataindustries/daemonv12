import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { compileProjectFile, runCommand } from '../src/pipeline.ts';
import { scheduledEventsFromTimeline } from '../src/sync-timeline.ts';
import { buildEventMap, cropEventMap, serializeEventMap } from '../src/sync/index.ts';
import { extractWavFrames, decodePcm } from '../src/render/index.ts';

test('native adapter uses exactly the sampler render trigger frames without affecting render bytes', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'daemon-sync-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const project = 'examples/sample-only-demo.json', c = compileProjectFile(project);
  assert.ok(c.timeline);
  const source = { file: project };
  const map = buildEventMap(scheduledEventsFromTimeline(c.timeline, source), { sampleRate: 44100, fps: { numerator: 60000, denominator: 1001 }, source });
  const rendered = await runCommand('render', project, { outDir: dir, env: {} });
  assert.equal(rendered.exitCode, 0);
  const tracks = (rendered.result.manifest!.samples as { tracks: { trackId: string; triggers: { frame: number; velocity: number }[] }[] }).tracks;
  for (const track of tracks) {
    const rows = map.events.filter(e => e.trackId === track.trackId).sort((a, b) => Number(a.eventId) - Number(b.eventId));
    assert.deepEqual(rows.map(e => [e.sampleFrame, e.velocity]), track.triggers.map(e => [e.frame, e.velocity]));
  }
});

test('exact WAV crop keeps PCM bytes for 16/24-bit audio and applies half-open sample offsets', () => {
  for (const bits of [16, 24]) {
    const channels = 2, stride = channels * bits / 8, frames = 1003;
    const bytes = Buffer.alloc(44 + frames * stride);
    bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
    bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(channels, 22);
    bytes.writeUInt32LE(44100, 24); bytes.writeUInt32LE(44100 * stride, 28); bytes.writeUInt16LE(stride, 32);
    bytes.writeUInt16LE(bits, 34); bytes.write('data', 36); bytes.writeUInt32LE(frames * stride, 40);
    for (let i = 44; i < bytes.length; i++) bytes[i] = i % 251;
    const crop = extractWavFrames(bytes, 17, 901);
    assert.deepEqual(crop.subarray(44), bytes.subarray(44 + 17 * stride, 44 + 901 * stride));
    assert.deepEqual(extractWavFrames(crop, 3, 6), extractWavFrames(bytes, 20, 23));
    for (const bounds of [[0.5, 2], [-1, 2], [0, 1004], [1, 1], [2, 1]])
      assert.throws(() => extractWavFrames(bytes, bounds[0]!, bounds[1]!), /integer sample offsets/);
    if (bits === 16) assert.equal(decodePcm(crop).pcm!.frames, 884);
  }
});

test('sync CLI supports custom schedules, rational FPS, project adapter, valid map recropping and diagnostics', t => {
  const dir = mkdtempSync(join(tmpdir(), 'daemon-sync-cli-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const source = { generator: 'custom-score.mjs', revision: 'test' };
  const events = [0, 734, 735, 736, 44100].map((sampleFrame, i) => ({ sampleFrame, trackId: 'cable', eventId: String(i), velocity: i === 0 ? 1.5 : 0.6, source: { ...source, index: i } }));
  const schedule = { sampleRate: 44100, fps: { numerator: 60, denominator: 1 }, source, events };
  const input = join(dir, 'schedule.json'), output = join(dir, 'events.json');
  writeFileSync(input, JSON.stringify(schedule));
  const cli = (args: string[]) => spawnSync(process.execPath, ['bin/daemonv12.js', 'sync', ...args, '--json'], { encoding: 'utf8' });
  const result = cli([input, '--out', output, '--start-sample', '734', '--end-sample', '44100']);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const map = cropEventMap(buildEventMap(events, { sampleRate: schedule.sampleRate, fps: schedule.fps, source }), 734, 44100);
  assert.equal(readFileSync(output, 'utf8'), serializeEventMap(map));
  const second = join(dir, 'second.json');
  assert.equal(cli([output, '--out', second, '--fps', '60000/1001']).status, 0);
  assert.equal(JSON.parse(readFileSync(second, 'utf8')).events.length, 3);
  assert.equal(cli(['examples/sample-only-demo.json', '--project', '--out', second]).status, 0);
  assert.equal(cli([input, '--out', input]).status, 2);
  assert.equal(cli([input, '--out', output, '--fps', '59.94']).status, 2);
  assert.equal(cli([input, '--out', output, '--start-sample', '1']).status, 2);
  const invalid = join(dir, 'invalid.json'); writeFileSync(invalid, '{');
  assert.equal(cli([invalid, '--out', output]).status, 1);
  writeFileSync(invalid, JSON.stringify({ ...schedule, events: [{ ...events[0], sampleFrame: 0.4 }] }));
  const bad = cli([invalid, '--out', output]);
  assert.equal(bad.status, 1); assert.match(bad.stdout, /sampleFrame/, bad.stderr);
  const before = readFileSync(output, 'utf8');
  for (const clip of [false, 0, '', null]) {
    writeFileSync(invalid, JSON.stringify({ ...schedule, clip }));
    const result = cli([invalid, '--out', output]);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /clip/);
    assert.equal(readFileSync(output, 'utf8'), before);
  }
  writeFileSync(output + '.tmp', 'unrelated');
  assert.equal(cli([input, '--out', output]).status, 3);
  assert.equal(readFileSync(output, 'utf8'), before);
  assert.equal(readFileSync(output + '.tmp', 'utf8'), 'unrelated');
});
