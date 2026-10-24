import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildEventMap, cropEventMap, serializeEventMap } from '../src/sync/index.ts';

type SourceRow = [sampleFrame: number, pictureFrame60: number, trackId: string, eventName: string, velocity: number];
type CircuitRow = [sourceIndex: number, sourceSampleFrame: number, clipSampleFrame: number,
  sourcePictureFrame60: number, pictureFrame60: number, trackId: string, eventName: string, velocity: number];
const source = JSON.parse(readFileSync(new URL('./fixtures/morph-sync/morph06-b.json', import.meta.url), 'utf8')) as {
  source: { repository: string; commit: string; path: string; sha256: string; gitBlob: string };
  sampleRate: number; totalSampleFrames: number; rows: SourceRow[];
};
const circuit = JSON.parse(readFileSync(new URL('./fixtures/morph-sync/the-circuit.json', import.meta.url), 'utf8')) as {
  sampleRate: number; fps: { numerator: number; denominator: number };
  startSampleFrame: number; endSampleFrame: number; rows: CircuitRow[];
};
const events = source.rows.map(([sampleFrame, , trackId, eventName, velocity], index) => ({
  sampleFrame, trackId, eventId: `morph06-b/${index}`, velocity,
  visualRoles: eventName === 'wind strike' ? ['cable-attack'] : [],
  source: { ...source.source, index, eventName },
}));
const options = { sampleRate: source.sampleRate, fps: circuit.fps, source: source.source };
const clip = { startSampleFrame: circuit.startSampleFrame, endSampleFrame: circuit.endSampleFrame };

test('all 595 MORPH//06 source rows retain their authoritative sample and 60 fps picture frames', () => {
  const map = buildEventMap(events, { ...options, clip: { startSampleFrame: 0, endSampleFrame: source.totalSampleFrames } });
  assert.equal(map.events.length, 595);
  for (const event of map.events) {
    const index = Number(event.eventId.split('/')[1]);
    const row = source.rows[index]!;
    assert.equal(event.sampleFrame, row[0]);
    assert.equal(event.sourcePictureFrame, row[1]);
    assert.equal(event.pictureFrame, row[1]);
    assert.equal(event.clipSampleFrame, row[0]);
    assert.deepEqual(event.source, events[index]!.source);
  }
});

test('44,100 Hz / 60 fps export agrees with every known THE CIRCUIT mapping row', () => {
  const map = buildEventMap(events, { ...options, clip });
  const actual = map.events.map(event => {
    const index = Number(event.eventId.split('/')[1]);
    return [index, event.sampleFrame, event.clipSampleFrame, event.sourcePictureFrame,
      event.pictureFrame, event.trackId, source.rows[index]![3], event.velocity] as CircuitRow;
  }).sort((a, b) => a[0] - b[0]);
  assert.equal(actual.length, 361);
  assert.deepEqual(actual, circuit.rows);
  // Unselected/coalesced visual rows remain in the map, as do linear gains above one.
  assert.equal(actual[0]![7], 1.5);
  const cutoff = map.events.find(event => event.source && event.eventId === 'morph06-b/591')!;
  assert.equal(cutoff.sampleFrame, 1217160);
  assert.equal(cutoff.clipSampleFrame, 335160);
  assert.equal(cutoff.pictureFrame, 456);
});

test('integer-offset cropping keeps every valid event and its absolute source timing', () => {
  const full = buildEventMap(events, { ...options, clip: { startSampleFrame: 0, endSampleFrame: source.totalSampleFrames } });
  const cropped = cropEventMap(full, clip.startSampleFrame, clip.endSampleFrame);
  assert.equal(serializeEventMap(cropped), serializeEventMap(buildEventMap(events, { ...options, clip })));
  // One sample after the old origin is deliberately not a picture-frame boundary.
  const start = 882001, end = 1217161;
  const direct = buildEventMap(events, { ...options, clip: { startSampleFrame: start, endSampleFrame: end } });
  const nested = cropEventMap(cropped, start, end);
  assert.equal(serializeEventMap(nested), serializeEventMap(direct));
  const expectedIds = events.filter(event => start <= event.sampleFrame && event.sampleFrame < end)
    .map(event => event.eventId).sort();
  assert.deepEqual(nested.events.map(event => event.eventId).sort(), expectedIds);
  for (const event of nested.events) {
    const original = events[Number(event.eventId.split('/')[1])]!;
    assert.equal(event.sampleFrame, original.sampleFrame);
    assert.equal(event.clipSampleFrame, original.sampleFrame - start);
    assert.equal(event.pictureFrame, Math.floor((original.sampleFrame - start) / 735));
    assert.deepEqual(event.source, original.source);
    assert.deepEqual(event.visualRoles, original.visualRoles);
  }
  // The half-open boundary includes the last sample before end and excludes end itself.
  const atCut = cropEventMap(full, 1217160, 1217161);
  assert.equal(atCut.events.length, 4);
  assert.ok(atCut.events.every(event => event.clipSampleFrame === 0 && event.pictureFrame === 0));
  assert.equal(cropEventMap(full, 1217161, 1234800).events.length, 0);
});

test('a repeated CIRCUIT export has identical canonical JSON', () => {
  const first = serializeEventMap(buildEventMap(events, { ...options, clip }));
  const second = serializeEventMap(buildEventMap(events, { ...options, clip }));
  assert.equal(first, second);
  assert.deepEqual(JSON.parse(first).events.length, 361);
});
