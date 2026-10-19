// The analyser on a synthetic loop with known hits: it must find them on the grid, measure
// their different strengths, and treat the loop as circular.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {analyzeLoop, seamReport} from '../scripts/lib/analyze.ts';
import {BEAT, LOOP, STEP} from '../src/timeline.ts';

const SR = 48000;
const synth = () => {
  const n = Math.round(LOOP * SR);
  const x = new Float32Array(n);
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296) * 2 - 1;
  const add = (t0: number, fn: (dt: number) => number, dur: number) => {
    for (let i = 0; i < dur * SR; i++) x[(Math.round(t0 * SR) + i) % n]! += fn(i / SR);
  };
  for (let b = 0; b < 32; b++) {
    const amp = b % 4 === 0 ? 0.9 : 0.45; // downbeats are much stronger
    add(b * BEAT, dt => amp * Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-dt * 30)) * dt) * Math.exp(-dt * 14), 0.3);
    if (b % 4 === 1 || b % 4 === 3) {
      let lp = 0;
      add(b * BEAT, dt => {
        lp += 0.35 * (rnd() - lp);
        return 0.35 * (rnd() - lp) * Math.exp(-dt * 30);
      }, 0.2);
    }
  }
  for (let s = 2; s < 128; s += 4) {
    let prev = 0;
    add(s * STEP, dt => {
      const r = rnd();
      const hp = r - prev;
      prev = r;
      return 0.12 * hp * Math.exp(-dt * 120);
    }, 0.05);
  }
  return x;
};

test('finds kicks on every beat with measured, unequal strengths', () => {
  const a = analyzeLoop(synth(), SR);
  assert.ok(Math.abs(a.gridOffset) <= 0.006, `grid offset ${a.gridOffset}`);
  assert.equal(a.kick.length, 32, `kicks ${a.kick.length}`);
  for (const k of a.kick) {
    const beat = k.t / BEAT;
    assert.ok(Math.abs(beat - Math.round(beat)) * BEAT < 0.012 || Math.abs(beat - 32) * BEAT < 0.012, `kick off grid at ${k.t}`);
  }
  const down = a.kick.filter(k => Math.round(k.t / BEAT) % 4 === 0).map(k => k.s);
  const other = a.kick.filter(k => Math.round(k.t / BEAT) % 4 !== 0).map(k => k.s);
  const mean = (v: number[]) => v.reduce((p, q) => p + q, 0) / v.length;
  assert.ok(mean(down) > mean(other) + 0.15, `downbeats ${mean(down)} vs others ${mean(other)}`);
});

test('finds the backbeat in the mid band and off-beat hats in the high band', () => {
  const a = analyzeLoop(synth(), SR);
  const backbeats = a.snare.filter(s => [1, 3].includes(Math.round(s.t / BEAT) % 4));
  assert.ok(backbeats.length >= 14, `backbeat hits ${backbeats.length}/16`);
  const offbeats = a.hat.filter(h => Math.round(h.t / STEP) % 4 === 2);
  assert.ok(offbeats.length >= 28, `off-beat hats ${offbeats.length}/32`);
  assert.equal(a.frames.full.length, 900);
});

test('a seamless loop has no click at its loop point', () => {
  const x = new Float32Array(SR);
  for (let i = 0; i < SR; i++) x[i] = Math.sin((2 * Math.PI * 4 * i) / SR);
  const [r] = seamReport([x], SR);
  assert.ok(r!.jump <= r!.p999Step + 1e-6);
});
