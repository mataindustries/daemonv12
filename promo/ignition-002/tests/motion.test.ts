import assert from 'node:assert/strict';
import {test} from 'node:test';
import {SPRINGS, cycleSpring, hitEnv, integratedAngle, netMove, ratchet, springStep, type Move} from '../src/motion/periodic.ts';
import {BEAT, LOOP} from '../src/timeline.ts';

test('spring step starts at rest and settles at 1', () => {
  for (const p of Object.values(SPRINGS)) {
    assert.equal(springStep(0, p), 0);
    assert.ok(Math.abs(springStep(1e-5, p)) < 1e-4, 'zero initial velocity');
    assert.ok(Math.abs(springStep(12, p) - 1) < 1e-6);
  }
});

test('a cycle spring whose moves sum to zero is periodic in value and velocity', () => {
  const moves: Move[] = [
    {t: 2, d: 1},
    {t: 9, d: -0.4, p: SPRINGS.lock},
    {t: 14.2, d: -0.6},
  ];
  assert.equal(netMove(moves), 0);
  const f = (t: number) => cycleSpring(t, 0.5, moves, SPRINGS.heavy);
  const h = 1e-4;
  assert.ok(Math.abs(f(LOOP - h) - f(-h)) < 1e-12);
  const vEnd = (f(LOOP) - f(LOOP - h)) / h;
  const vStart = (f(h) - f(0)) / h;
  assert.ok(Math.abs(vEnd - vStart) < 1e-2, `${vEnd} vs ${vStart}`);
});

test('integrated angles turn an exact whole number of revolutions', () => {
  const a = integratedAngle(-6, t => 1 + Math.sin((2 * Math.PI * t) / LOOP) ** 2);
  assert.ok(Math.abs(a.angle(LOOP - 1e-9) - -6 * 2 * Math.PI) < 1e-6);
  assert.ok(Math.abs(a.angle(0)) < 1e-12);
});

test('the ratchet lands one full turn per loop and only recoils within its overshoot', () => {
  const ticks = Array.from({length: 32}, (_, i) => i * BEAT);
  const detent = (2 * Math.PI) / 32;
  let prev = -Infinity;
  for (let t = 0.05; t < LOOP; t += 0.05) {
    const a = ratchet(t, ticks, 1);
    assert.ok(a > prev - 0.3 * detent, 'recoil stays under a third of a detent');
    prev = a;
  }
  const end = ratchet(LOOP - 1e-6, ticks, 1);
  const start = ratchet(0, ticks, 1);
  assert.ok(Math.abs(end - start - 2 * Math.PI) < 1e-3, `${end} − ${start}`);
});

test('hit envelopes wrap around the loop point', () => {
  const hits = [{t: 14.95, s: 1}];
  assert.ok(hitEnv(0.01, hits, 0.1) > 0.5, 'a hit just before the loop point decays into the next cycle');
  assert.ok(hitEnv(14.945, [{t: 0, s: 1}], 0.1) === 0);
  assert.ok(hitEnv(LOOP - 0.005, [{t: 0, s: 1}], 0.1, 0.012) > 0.5, 'the attack of a downbeat hit starts before the loop point');
});
