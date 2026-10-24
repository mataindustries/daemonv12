import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEventMap, cropEventMap, EventMapValidationError, serializeEventMap, validateEventMap,
  type ScheduledEvent, type EventMapOptions } from '../src/sync/index.ts';

const options = (): EventMapOptions => ({ sampleRate: 44100, fps: { numerator: 60, denominator: 1 },
  source: { repository: 'custom-score', ref: 'fixed', path: 'score.mjs' } });
const event = (sampleFrame: number, eventId = String(sampleFrame), trackId = 'cable'): ScheduledEvent =>
  ({ sampleFrame, trackId, eventId, velocity: 1.5, source: { generator: 'custom-score', index: sampleFrame } });

test('sample-frame authority, exact floor picture projection and unbounded linear performance accents', () => {
  const map = buildEventMap([0, 367, 368, 734, 735, 736, 44100].map(frame => event(frame)), options());
  assert.deepEqual(map.events.map(e => e.sampleFrame), [0, 367, 368, 734, 735, 736, 44100]);
  assert.deepEqual(map.events.map(e => e.pictureFrame), [0, 0, 0, 0, 1, 1, 60]);
  assert.ok(map.events.every(e => e.velocity === 1.5));
  assert.deepEqual(validateEventMap(map), []);
});

test('rational FPS uses exact integer math without long-timeline drift or unsafe derived frames', () => {
  const frames = [0, 1471, 1472, 44100, 44100 * 600, Number.MAX_SAFE_INTEGER];
  const map = buildEventMap(frames.map(frame => event(frame)), { ...options(), fps: { numerator: 60000, denominator: 2002 } });
  assert.deepEqual(map.fps, { numerator: 30000, denominator: 1001 });
  assert.deepEqual(map.events.map(e => e.pictureFrame), frames.map(frame => Number(BigInt(frame) * 30000n / (44100n * 1001n))));
  assert.throws(() => buildEventMap([event(Number.MAX_SAFE_INTEGER)], { ...options(), sampleRate: 1,
    fps: { numerator: Number.MAX_SAFE_INTEGER, denominator: 1 } }), /Derived picture frame exceeds/);
});

test('half-open sample cropping retains absolute timing, recomputes local floor and includes picture frame zero', () => {
  const full = buildEventMap([734, 735, 736, 1468, 1469, 1470].map(frame => event(frame)), options());
  const cropped = cropEventMap(full, 735, 1470);
  assert.deepEqual(cropped.events.map(e => [e.sampleFrame, e.clipSampleFrame, e.pictureFrame, e.sourcePictureFrame]),
    [[735, 0, 0, 1], [736, 1, 0, 1], [1468, 733, 0, 1], [1469, 734, 0, 1]]);
  const unaligned = cropEventMap(full, 734, 1470);
  assert.equal(unaligned.events.find(e => e.sampleFrame === 735)!.pictureFrame, 0);
  assert.equal(unaligned.events.find(e => e.sampleFrame === 735)!.sourcePictureFrame, 1);
  assert.equal(cropEventMap(full, 1470, 1470).events.length, 0);
  assert.deepEqual(cropEventMap(cropped, 0, 2000), cropped);
  assert.deepEqual(cropEventMap(cropped, 736, 1469), cropEventMap(full, 736, 1469));
  assert.deepEqual(cropEventMap(cropped, 2000, 3000).clip, { startSampleFrame: 2000, endSampleFrame: 2000 });
  assert.equal(cropEventMap(cropped, 2000, 3000).events.length, 0);
});

test('canonical export is independent of input/key/role order and does not mutate or retain source references', () => {
  const a = { ...event(20, 'b', 'ratchet'), visualRoles: ['pulse', 'impact'], source: { z: 1, a: { y: 2, x: 3 } } };
  const b = event(20, 'a', 'cable');
  const original = structuredClone([a, b]);
  const first = buildEventMap([a, b], options());
  const second = buildEventMap([b, { ...a, visualRoles: ['impact', 'pulse'], source: { a: { x: 3, y: 2 }, z: 1 } }], options());
  assert.equal(serializeEventMap(first), serializeEventMap(second));
  assert.deepEqual([a, b], original);
  assert.deepEqual(first.events.map(e => [e.trackId, e.eventId]), [['cable', 'a'], ['ratchet', 'b']]);
  a.source.a.x = 999;
  assert.equal((first.events[1]!.source.a as Record<string, number>).x, 3);
  const serialized = serializeEventMap(first);
  assert.ok(serialized.endsWith('\n'));
  assert.equal(serialized, serializeEventMap(JSON.parse(serialized)));
  assert.deepEqual(validateEventMap(JSON.parse(serialized)), []);
});

test('event identity is per track and separate from simultaneous ordering', () => {
  assert.equal(buildEventMap([event(0, 'hit', 'a'), event(0, 'hit', 'b')], options()).events.length, 2);
  assert.throws(() => buildEventMap([event(0, 'hit'), event(1, 'hit')], options()), /DUPLICATE_ID events\[1\].eventId/);
});

test('strict validation rejects malformed authority, metadata and unsupported fields with actionable paths', () => {
  const invalid: unknown[] = [
    { ...event(0), sampleFrame: 0.5 }, { ...event(0), sampleFrame: -1 }, { ...event(0), sampleFrame: Number.MAX_SAFE_INTEGER + 1 },
    { ...event(0), velocity: -1 }, { ...event(0), velocity: Infinity }, { ...event(0), velocity: NaN },
    { ...event(0), eventId: '' }, { ...event(0), trackId: '  ' }, { ...event(0), source: {} },
    { ...event(0), visualRoles: ['pulse', 'pulse'] }, { ...event(0), visualRoles: [1] },
    { ...event(0), source: { missing: undefined } }, { ...event(0), frames: 1 },
  ];
  for (const value of invalid) assert.throws(() => buildEventMap([value as ScheduledEvent], options()), EventMapValidationError);
  for (const value of [null, [], { numerator: 0, denominator: 1 }, { numerator: 60, denominator: 0 }, { numerator: 59.94, denominator: 1 }])
    assert.throws(() => buildEventMap([], { ...options(), fps: value as EventMapOptions['fps'] }), EventMapValidationError);
  assert.throws(() => buildEventMap([], { ...options(), sampleRate: 0 }), /options.sampleRate/);
  assert.throws(() => buildEventMap([], { ...options(), clip: { startSampleFrame: 2, endSampleFrame: 1 } }), /Clip end precedes/);
  const circular: Record<string, unknown> = {}; circular.self = circular;
  assert.throws(() => buildEventMap([{ ...event(0), source: circular as ScheduledEvent['source'] }], options()), /contains a cycle/);
  assert.throws(() => buildEventMap(Array(1) as ScheduledEvent[], options()), /dense JSON array/);
  assert.throws(() => buildEventMap([{ ...event(0), visualRoles: Array(1) as string[] }], options()), /dense JSON array/);
  assert.throws(() => buildEventMap([{ ...event(0), source: { values: Array(1) as string[] } }], options()), /dense JSON arrays/);
});

test('JSON map validation catches forged derived timing, ordering, clip leakage and schema mismatches', () => {
  const map = buildEventMap([event(735), event(1470)], options());
  const altered = structuredClone(map); altered.events[0]!.pictureFrame = 2;
  assert.ok(validateEventMap(altered).some(d => d.path === 'events[0].pictureFrame' && d.hint));
  assert.throws(() => serializeEventMap(altered), EventMapValidationError);
  assert.throws(() => cropEventMap(altered, 0, 2000), EventMapValidationError);
  assert.ok(validateEventMap({ ...map, events: [...map.events].reverse() }).some(d => /canonical/.test(d.message)));
  assert.ok(validateEventMap({ ...map, clip: { startSampleFrame: 735, endSampleFrame: 1470 } }).some(d => d.path === 'events[1].sampleFrame'));
  assert.ok(validateEventMap({ ...map, fps: { numerator: 120, denominator: 2 } }).some(d => d.path === 'fps'));
  assert.ok(validateEventMap({ ...map, formatVersion: 2 }).some(d => d.code === 'UNSUPPORTED_FORMAT_VERSION'));
  assert.ok(validateEventMap({ ...map, extra: true }).some(d => d.code === 'UNKNOWN_FIELD'));
  assert.ok(validateEventMap(null).some(d => d.code === 'WRONG_TYPE'));
});
