import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {parsePromoData, PromoDataError, STEM_IDS, type PromoData} from '../src/data/contract.ts';
import {buildFixture, FIXTURE_SEED, mulberry32} from '../src/data/fixture.ts';
import {automationAt, density, envAt, hitAt, lastOnsetIndex, snapToOnset, stopAt} from '../src/data/signals.ts';
import {CUES, cue, cueGrid, type CueName} from '../src/timeline/cues.ts';
import {DURATION_SECONDS} from '../src/timeline/grid.ts';

const clone = (d: PromoData): PromoData => JSON.parse(JSON.stringify(d));

// Golden hash of the fixture JSON. Update only after an intentional fixture change.
const FIXTURE_SHA256 = '123b6140e67d2e70a28d8ef86f05e5a22c61f6abc719d3aff5a6e018728c2b0a';

test('fixture is deterministic and valid against the contract', () => {
  const a = buildFixture();
  const b = buildFixture();
  assert.deepEqual(a, b);
  assert.doesNotThrow(() => parsePromoData(a));
  const hash = createHash('sha256').update(JSON.stringify(a)).digest('hex');
  assert.equal(hash, FIXTURE_SHA256, 'fixture bytes changed; if intentional, update FIXTURE_SHA256');
  assert.notDeepEqual(buildFixture(FIXTURE_SEED + 1).stems.hat.onsets, a.stems.hat.onsets);
});

test('mulberry32 is a stable sequence', () => {
  const r = mulberry32(1);
  assert.deepEqual([r(), r(), r()].map(v => v.toFixed(9)), ['0.627073941', '0.002735721', '0.527447040']);
});

test('fixture content stays inside the 24-second piece', () => {
  const data = buildFixture();
  for (const id of STEM_IDS) {
    for (const o of data.stems[id].onsets) {
      assert.ok(o.t >= 0 && o.t < DURATION_SECONDS, `${id} onset ${o.t}`);
      assert.ok(o.t + (o.duration ?? 0) <= DURATION_SECONDS, `${id} note ends past the piece`);
    }
    assert.equal(data.stems[id].envelope.values.length, 24 * 60 + 1);
  }
  assert.ok(data.markers.every(m => m.t + (m.duration ?? 0) <= DURATION_SECONDS));
  // The arrangement honours its own stops: nothing sounds inside them.
  for (const stop of data.markers.filter(m => m.kind === 'stop')) {
    for (const id of STEM_IDS) {
      const inside = data.stems[id].onsets.filter(o => o.t >= stop.t && o.t < stop.t + stop.duration!);
      assert.equal(inside.length, 0, `${id} plays inside ${stop.id}`);
    }
  }
});

test('contract rejects documents that would desync the film', () => {
  const base = buildFixture();
  const wrongTempo = clone(base) as unknown as {timing: {bpm: number}};
  wrongTempo.timing.bpm = 150;
  assert.throws(() => parsePromoData(wrongTempo), PromoDataError);

  const unsorted = clone(base);
  unsorted.stems.kick.onsets.reverse();
  assert.throws(() => parsePromoData(unsorted), /not sorted/);

  const short = clone(base);
  short.master.envelope.values = short.master.envelope.values.slice(0, 600);
  assert.throws(() => parsePromoData(short), /cover less than 24 s/);

  const late = clone(base);
  late.stems.glass.onsets.push({t: 24.5, strength: 1});
  assert.throws(() => parsePromoData(late), PromoDataError);

  const loud = clone(base);
  loud.stems.hat.envelope.values[10] = 1.5;
  assert.throws(() => parsePromoData(loud), PromoDataError);

  const extra = {...clone(base), surprise: true};
  assert.throws(() => parsePromoData(extra), PromoDataError);
});

test('signal reads', () => {
  const env = {rate: 10, values: [0, 1, 0.5]};
  assert.equal(envAt(env, 0.05), 0.5);
  assert.equal(envAt(env, 0.15), 0.75);
  assert.equal(envAt(env, -1), 0);
  assert.equal(envAt(env, 5), 0);
  const onsets = [{t: 1, strength: 1}, {t: 2, strength: 0.5}, {t: 3, strength: 1}];
  assert.equal(lastOnsetIndex(onsets, 0.5), -1);
  assert.equal(lastOnsetIndex(onsets, 2), 1);
  assert.equal(lastOnsetIndex(onsets, 9), 2);
  assert.equal(hitAt(onsets, 0.99, {decay: 0.1}), 0);
  assert.ok(hitAt(onsets, 2.01, {decay: 0.1}) > 0.4);
  assert.ok(density(onsets, 3, 0.5) > 0);
  const lpf = {id: 'x.lpf', label: 'LPF', target: 'glass' as const, unit: 'Hz' as const, range: [100, 10000] as [number, number], points: [{t: 0, v: 100}, {t: 1, v: 10000}]};
  assert.ok(Math.abs(automationAt(lpf, 0.5) - 1000) < 1e-9, 'Hz automation is log-linear');
  assert.equal(automationAt(lpf, 5), 10000);
  assert.ok(stopAt([{t: 1, kind: 'stop', id: 's', duration: 0.5}], 1.2));
  assert.equal(stopAt([{t: 1, kind: 'stop', id: 's', duration: 0.5}], 1.5), null);
});

test('cues land on the grid with the fixture and follow real onsets when they move', () => {
  const data = buildFixture();
  for (const name of Object.keys(CUES) as CueName[]) assert.equal(cue(data, name), cueGrid(name), name);
  // Shift the real kick 20 ms late at the drop: the cue follows it.
  const late = clone(data);
  const drop = cueGrid('drop1');
  const kick = late.stems.kick.onsets.find(o => Math.abs(o.t - drop) < 1e-9)!;
  kick.t += 0.02;
  assert.ok(Math.abs(cue(late, 'drop1') - (drop + 0.02)) < 1e-9);
  // Beyond the window it stays on the grid.
  assert.equal(snapToOnset(late, 'kick', drop + 0.5, 0.05), drop + 0.5);
});
