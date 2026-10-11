import assert from 'node:assert/strict';
import {test} from 'node:test';
import {hash01, SPRINGS, springChain, springStep, velocity, type SpringParams} from '../src/motion/physics.ts';

const regimes: SpringParams[] = [SPRINGS.hit, SPRINGS.lock, SPRINGS.heavy, {freq: 3, damping: 2.5}];

test('spring step starts at rest and settles at 1 in every damping regime', () => {
  for (const p of regimes) {
    assert.equal(springStep(0, p), 0);
    assert.equal(springStep(-1, p), 0);
    assert.ok(Math.abs(springStep(10, p) - 1) < 1e-6, JSON.stringify(p));
    assert.ok(Math.abs(velocity(time => springStep(time, p), 1e-4)) < 50, 'starts from rest');
  }
  // Underdamped springs overshoot once; critical ones never do.
  const peakHit = Math.max(...Array.from({length: 200}, (_, i) => springStep(i / 200, SPRINGS.hit)));
  assert.ok(peakHit > 1.05);
  const peakLock = Math.max(...Array.from({length: 200}, (_, i) => springStep(i / 200, SPRINGS.lock)));
  assert.ok(peakLock <= 1 + 1e-9);
});

test('re-targeted springs keep position and velocity continuous', () => {
  const keys = [
    {t: 0, v: 0},
    {t: 0.2, v: 100},
    {t: 0.3, v: -40},
  ];
  const f = (time: number) => springChain(time, keys, SPRINGS.heavy);
  const peak = Math.max(...Array.from({length: 400}, (_, i) => Math.abs(velocity(f, i / 400, 1e-4))));
  for (const k of keys.slice(1)) {
    // Finite acceleration: over ±20 µs neither position nor velocity may jump.
    const e = 2e-5;
    assert.ok(Math.abs(f(k.t + e) - f(k.t - e)) < peak * 2 * e * 1.5, 'position continuous');
    const before = velocity(f, k.t - e, 2e-6);
    const after = velocity(f, k.t + e, 2e-6);
    assert.ok(Math.abs(after - before) < peak * 0.02, `velocity continuous at ${k.t}: ${before} → ${after} (peak ${peak})`);
  }
});

test('hash01 is deterministic and in range', () => {
  for (let i = 0; i < 1000; i++) {
    const v = hash01(i, 7);
    assert.ok(v >= 0 && v < 1);
    assert.equal(v, hash01(i, 7));
  }
  assert.notEqual(hash01(1, 2), hash01(2, 1));
});
