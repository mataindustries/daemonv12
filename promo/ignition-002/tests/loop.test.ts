// The loop point must be invisible: every quantity of the film is exactly periodic, and every
// smooth motion keeps its position and velocity through t = 15 s → 0 s.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {test} from 'node:test';
import {makeChoreo, type FrameState} from '../src/choreo.ts';
import {gridSync, type SyncData} from '../src/sync/contract.ts';
import {LOOP, DURATION_IN_FRAMES, FPS} from '../src/timeline.ts';

const committed = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'src', 'sync', 'sync.json'), 'utf8')) as SyncData;

const TAU = Math.PI * 2;
/** Smooth drivers (no event envelopes), with the period of their visual effect. */
const smooth = (s: FrameState) => {
  const v: Record<string, [number, number]> = {
    power: [s.power, 0],
    open: [s.open, 0],
    speed: [s.speed, 0],
    precess: [s.precess, 0],
    dolly: [s.dolly, 0],
    yaw: [s.camera.yaw, 0],
    pitch: [s.camera.pitch, 0],
    roll: [s.camera.roll, 0],
    statorTilt: [s.stator.tilt, 0],
    statorSpin: [s.stator.spin, TAU],
    ratchet: [s.ratchet, TAU],
    fieldSpin: [s.field.spin, TAU],
    hazeShift: [s.hazeShift, 1],
    rays: [s.rays, TAU],
    jetFlow: [s.jets.flow, 1],
  };
  s.gyros.forEach((g, i) => {
    v[`gyro${i}.tilt`] = [g.tilt, 0];
    v[`gyro${i}.axis`] = [g.axis, TAU];
    v[`gyro${i}.spin`] = [g.spin, TAU];
  });
  s.core.spins.forEach((a, i) => (v[`core.spin${i}`] = [a, TAU]));
  s.clamps.forEach((c, k) => (v[`clamp${k}.p`] = [c.p, 0]));
  s.paths.forEach((p, k) => (v[`path${k}`] = [p, 0]));
  return v;
};
const wrapDelta = (d: number, period: number) => (period ? d - period * Math.round(d / period) : d);

for (const [label, sync] of [
  ['committed sync data', committed],
  ['grid placeholder', gridSync()],
] as const) {
  const choreo = makeChoreo(sync);

  test(`${label}: every value is exactly periodic`, () => {
    for (let i = 0; i < 40; i++) {
      const t = (i * 0.3791) % LOOP;
      assert.deepEqual(JSON.stringify(choreo.at(t + LOOP)), JSON.stringify(choreo.at(t)));
    }
  });

  test(`${label}: smooth motion keeps position and velocity through the loop point`, () => {
    const h = 1e-4;
    const at = (t: number) => smooth(choreo.at(t));
    const [m2, m1, z, p1] = [at(LOOP - 2 * h), at(LOOP - h), at(0), at(h)];
    for (const key of Object.keys(z)) {
      const period = z[key]![1];
      const before = wrapDelta(m1[key]![0] - m2[key]![0], period);
      const across = wrapDelta(z[key]![0] - m1[key]![0], period);
      const after = wrapDelta(p1[key]![0] - z[key]![0], period);
      // Steps of h = 0.1 ms: a jump or a kink at the seam would dwarf these tolerances.
      assert.ok(Math.abs(across - before) < 2e-4 && Math.abs(after - across) < 2e-4, `${key}: steps ${before} | ${across} | ${after}`);
    }
  });

  test(`${label}: the seam is no smoother or rougher than any other frame boundary`, () => {
    // Largest per-frame change of every smooth driver: the seam must sit inside the film's range.
    const frames = Array.from({length: DURATION_IN_FRAMES + 1}, (_, f) => smooth(choreo.at(f / FPS)));
    for (const key of Object.keys(frames[0]!)) {
      const period = frames[0]![key]![1];
      let max = 0;
      for (let f = 0; f < DURATION_IN_FRAMES - 1; f++) max = Math.max(max, Math.abs(wrapDelta(frames[f + 1]![key]![0] - frames[f]![key]![0], period)));
      const seam = Math.abs(wrapDelta(frames[DURATION_IN_FRAMES]![key]![0] - frames[DURATION_IN_FRAMES - 1]![key]![0], period));
      assert.ok(seam <= max + 1e-9, `${key}: seam step ${seam} exceeds largest in-film step ${max}`);
    }
  });
}

test('rings land with their index marks aligned at the loop point', () => {
  const s = makeChoreo(committed).at(0);
  for (const g of s.gyros) assert.ok(Math.abs(wrapDelta(g.spin, TAU)) < 1e-9);
  assert.ok(Math.abs(wrapDelta(s.stator.spin, TAU)) < 1e-9);
});

test('all sixteen clamps are locked at the loop point and released in OPEN', () => {
  const ch = makeChoreo(committed);
  for (const c of ch.at(0).clamps) assert.ok(Math.abs(c.p) < 0.08, `clamp at ${c.p}`);
  for (const c of ch.at(9.4).clamps) assert.ok(c.p > 0.9, `clamp at ${c.p}`);
});
