import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { generator, renderCandidate } from '../experiments/morph-07/render.ts';
import { scores } from '../experiments/morph-07/scores.ts';
import { validateEventMap, type EventMap } from '../src/sync/index.ts';
import { decodePcm } from '../src/render/index.ts';

const dir = 'experiments/morph-07/candidates';
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const report = JSON.parse(readFileSync(join(dir, 'verification.json'), 'utf8'));
const renders = scores.map(make => { const score = make(); return { score, ...renderCandidate(score) }; });
const roles = (map: EventMap) => new Set(map.events.flatMap(e => e.visualRoles ?? []));

test('MORPH//07: both candidates regenerate byte-identically from the checked source with Node alone', () => {
  assert.deepEqual(report.generator, generator);
  for (const { score, wav, events, telemetry, schedule } of renders) {
    const recorded = report.candidates[score.id];
    assert.deepEqual(wav, readFileSync(join(dir, `${score.id}.wav`)), score.id);
    assert.equal(events, readFileSync(join(dir, `${score.id}.events.json`), 'utf8'));
    assert.equal(telemetry, readFileSync(join(dir, `${score.id}.telemetry.json`), 'utf8'));
    assert.equal(schedule, readFileSync(join(dir, `${score.id}.schedule.json`), 'utf8'));
    assert.equal(recorded.wav.sha256, hash(wav)); assert.equal(recorded.eventMap.sha256, hash(events));
    assert.equal(recorded.telemetry.sha256, hash(telemetry));
    // The MP3 is a listening copy whose bytes depend on the encoder build; check the recorded file.
    assert.equal(recorded.mp3.sha256, hash(readFileSync(join(dir, `${score.id}.mp3`))));
    assert.equal(recorded.mp3.bitrateKbps, 192);
  }
});

test('MORPH//07: masters keep headroom, never clip, A loops on its downbeat and B ends in silence', () => {
  const [hypnotic, awakening] = renders;
  for (const { score, wav } of renders) {
    const pcm = decodePcm(wav).pcm!;
    assert.equal(pcm.channels, 2); assert.equal(pcm.frames, score.frames);
    let peak = 0, energy = 0;
    for (const x of pcm.samples) { peak = Math.max(peak, Math.abs(x)); energy += x * x; }
    assert.ok(peak < 32767 && 20 * Math.log10(peak / 32768) <= -0.99, `${score.id} keeps 1 dB of headroom`);
    assert.ok(10 * Math.log10(energy / pcm.samples.length / 32768 ** 2) > -20, `${score.id} is loud enough for a phone`);
  }
  assert.equal(hypnotic!.score.frames, 352800);
  const seconds = awakening!.score.frames / 44100;
  assert.ok(seconds >= 8 && seconds <= 12, `THE AWAKENING lasts ${seconds} s`);
  // Loop seam: the opening downbeat is the only one; the closing downbeat falls past the end.
  const impacts = hypnotic!.map.events.filter(e => e.trackId === 'commutator');
  assert.equal(impacts[0]!.eventId, 'r0.s0'); assert.ok(impacts[0]!.sampleFrame < 441);
  assert.ok(impacts.at(-1)!.sampleFrame < 352800 - 4410);
  const loop = decodePcm(hypnotic!.wav).pcm!.samples, last = loop.length - 2;
  assert.ok(Math.abs(loop[0]! - loop[last]!) < 400 && Math.abs(loop[1]! - loop[last + 1]!) < 400, 'the wrapped ring-out makes the seam continuous');
  const ending = decodePcm(awakening!.wav).pcm!.samples.subarray(-4410);
  let tail = 0; for (const x of ending) tail += x * x;
  assert.ok(10 * Math.log10(tail / ending.length / 32768 ** 2) < -40);
});

test('MORPH//07: Sync Pack maps validate, carry meaningful roles and are reproduced by the sync CLI', t => {
  const work = mkdtempSync(join(tmpdir(), 'daemon-morph07-')); t.after(() => rmSync(work, { recursive: true, force: true }));
  for (const { score, map, events, schedule } of renders) {
    assert.deepEqual(validateEventMap(map), [], score.id);
    assert.deepEqual(map.clip, { startSampleFrame: 0, endSampleFrame: score.frames });
    for (const role of ['revolution', 'impact', 'torque', 'harmonic-transition', 'section', 'fusion', 'harmonic-lock', 'tine', 'low-end'])
      assert.ok(roles(map).has(role), `${score.id} exports ${role}`);
    // Every scheduled pitch arrives, in order, after the gesture that asked for it.
    const notes = map.events.filter(e => e.trackId === 'voice');
    assert.equal(notes.length, score.notes.length);
    notes.forEach((e, i) => assert.ok(e.sampleFrame >= score.notes[i]!.frame));
    // Impacts are resolvable: at least 30 ms apart on the commutator.
    const impacts = map.events.filter(e => e.trackId === 'commutator');
    impacts.slice(1).forEach((e, i) => assert.ok(e.sampleFrame - impacts[i]!.sampleFrame >= 1323));
    writeFileSync(join(work, `${score.id}.schedule.json`), schedule);
    const cli = spawnSync(process.execPath, ['bin/daemonv12.js', 'sync', join(work, `${score.id}.schedule.json`), '--out', join(work, `${score.id}.json`), '--json'], { encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stdout + cli.stderr);
    assert.equal(readFileSync(join(work, `${score.id}.json`), 'utf8'), events);
  }
  // THE AWAKENING: jolts and a breakaway precede the servo catching the grid.
  const awake = renders[1]!.map, first = (role: string) => awake.events.find(e => e.visualRoles?.includes(role))!.sampleFrame;
  assert.ok(first('jolt') < first('breakaway') && first('breakaway') < first('servo-lock') && first('servo-lock') < first('fusion'));
  assert.ok(roles(awake).has('climax'));
});
