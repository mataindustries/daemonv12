// V12 OVERDRIVE must loop invisibly: every quantity exactly periodic, every smooth motion
// continuous in position and velocity through t = 15 s → 0 s.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {test} from 'node:test';
import {makeV12Choreo, type V12State} from '../src/v12/choreo.ts';
import {assertV12Sync, type V12Sync} from '../src/v12/sync.ts';
import {DURATION_IN_FRAMES, FPS, LOOP} from '../src/timeline.ts';

const sync = assertV12Sync(JSON.parse(readFileSync(join(import.meta.dirname, '..', 'src', 'v12', 'sync.json'), 'utf8')) as V12Sync);
const choreo = makeV12Choreo(sync);
const TAU = Math.PI * 2;

/** Smooth drivers with the period of their visual effect (0 = not an angle). */
const smooth = (s: V12State) => {
  const v: Record<string, [number, number]> = {
    crank: [s.theta, TAU],
    cam: [s.cam, TAU],
    power: [s.power, 0],
    reveal: [s.reveal, 0],
    overdrive: [s.overdrive, 0],
    roll: [s.roll, 0],
    shake: [s.shake, 0],
  };
  for (const [k, val] of Object.entries(s.camera)) v[`camera.${k}`] = [val, 0];
  s.cylinders.forEach((c, i) => {
    v[`piston${i + 1}`] = [c.pose.pin, 0];
    v[`rod${i + 1}`] = [c.pose.rodAngle, 0];
    v[`phase${i + 1}`] = [c.phase, 2 * TAU];
    v[`exValve${i + 1}`] = [c.exLift, 0];
    v[`inValve${i + 1}`] = [c.inLift, 0];
  });
  return v;
};
const wrapDelta = (d: number, period: number) => (period ? d - period * Math.round(d / period) : d);

test('the committed V12 sync data is the measured analysis, not a placeholder', () => {
  assert.equal(sync.source, 'analysis');
  assert.equal(sync.audio?.sha256, '6938bf3b8efd90d9c9818dc20689b71e408d9d22be1cab7e01da597da22a80e1');
});

test('every V12 quantity is exactly periodic', () => {
  for (let i = 0; i < 30; i++) {
    const t = (i * 0.4931) % LOOP;
    assert.equal(JSON.stringify(choreo.at(t + LOOP)), JSON.stringify(choreo.at(t)));
  }
});

test('virtual frame 900 has the state of frame 0: pistons, crank, rods, cams, lights, camera', () => {
  const a = choreo.at(0);
  const b = choreo.at(DURATION_IN_FRAMES / FPS);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(a.theta, 0);
});

test('smooth V12 motion keeps position and velocity through the loop point', () => {
  const h = 1e-4;
  const at = (t: number) => smooth(choreo.at(t));
  const [m2, m1, z, p1] = [at(LOOP - 2 * h), at(LOOP - h), at(0), at(h)];
  for (const key of Object.keys(z)) {
    const period = z[key]![1];
    const before = wrapDelta(m1[key]![0] - m2[key]![0], period);
    const across = wrapDelta(z[key]![0] - m1[key]![0], period);
    const after = wrapDelta(p1[key]![0] - z[key]![0], period);
    assert.ok(Math.abs(across - before) < 3e-4 && Math.abs(after - across) < 3e-4, `${key}: ${before} | ${across} | ${after}`);
  }
});

test('the seam step of every smooth V12 driver is within its in-film range', () => {
  const frames = Array.from({length: DURATION_IN_FRAMES + 1}, (_, f) => smooth(choreo.at(f / FPS)));
  for (const key of Object.keys(frames[0]!)) {
    const period = frames[0]![key]![1];
    let max = 0;
    for (let f = 0; f < DURATION_IN_FRAMES - 1; f++) max = Math.max(max, Math.abs(wrapDelta(frames[f + 1]![key]![0] - frames[f]![key]![0], period)));
    const seam = Math.abs(wrapDelta(frames[DURATION_IN_FRAMES]![key]![0] - frames[DURATION_IN_FRAMES - 1]![key]![0], period));
    assert.ok(seam <= max + 1e-9, `${key}: seam ${seam} > max ${max}`);
  }
});

test('the music drives the big moments: dropout darkens, re-ignition and payoff surge', () => {
  const inDrop = choreo.at(3.88);
  assert.ok(inDrop.drop > 0.9, `drop ${inDrop.drop}`);
  const before = choreo.at(sync.markers.payoff - 0.05);
  const after = choreo.at(sync.markers.payoff + 0.12);
  assert.ok(after.overdrive > before.overdrive + 0.2 && after.accent > 0.6);
  assert.ok(choreo.at(sync.markers.reignite + 0.05).cylinders.some(c => c.surge > 0.5));
});
