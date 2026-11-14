import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crush, crushSettings, shaper, softClip, upsample, downsample, SR, type Stereo } from '../fable-lab/crush/crush.ts';
import { aliasingProbe, intermodProbe, peak, truePeak, ampDb, dbAmp, rms } from '../fable-lab/crush/measure.ts';

/** A deterministic drum-and-bass-like test signal: decaying 55 Hz hits, a 110 Hz buzz between them, a little top. */
function fixture(seconds = 1.5): Stereo {
  const n = Math.round(seconds * SR), l = new Float64Array(n), r = new Float64Array(n), beat = Math.round(0.46875 * SR);
  for (let i = 0; i < n; i++) {
    const t = (i % beat) / SR, kick = Math.sin(2 * Math.PI * (55 * t + 6 * (1 - Math.exp(-t / 0.02)))) * Math.exp(-t / 0.12);
    const bass = 0.22 * Math.sign(Math.sin(2 * Math.PI * 110 * i / SR)) * (t > 0.12 ? 1 : 0), top = 0.05 * Math.sin(2 * Math.PI * 7000 * i / SR) * (t > 0.23 && t < 0.26 ? 1 : 0);
    l[i] = 0.7 * kick + bass + top; r[i] = 0.7 * kick + bass - top;
  }
  const g = dbAmp(-3) / peak([l, r]); return [l.map(v => v * g), r.map(v => v * g)];
}

test('DAEMON//CRUSH: amount 0 is a bit-exact bypass and the input is never modified', () => {
  const x = fixture(), copy: Stereo = [x[0].slice(), x[1].slice()], y = crush(x, { amount: 0 }).audio;
  assert.deepEqual(y, copy); assert.notEqual(y[0], x[0]);
  crush(x, { amount: 0.7 }); assert.deepEqual(x, copy);
});
test('DAEMON//CRUSH: deterministic, same length, bounded by the ceiling', () => {
  const x = fixture(), a = crush(x, { amount: 0.7 }), b = crush(x, { amount: 0.7 });
  assert.deepEqual(a.audio, b.audio); assert.deepEqual(a.report, b.report);
  assert.equal(a.audio[0].length, x[0].length);
  for (const amount of [0.3, 0.7, 1]) for (const ceilingDb of [-1, -3]) {
    const y = crush(x, { amount, ceilingDb }).audio;
    assert.ok(y[0].every(Number.isFinite) && y[1].every(Number.isFinite));
    assert.ok(ampDb(truePeak(y)) <= ceilingDb + 0.3, `true peak ${ampDb(truePeak(y)).toFixed(2)} dB at amount ${amount}, ceiling ${ceilingDb}`);
  }
  assert.throws(() => crush(x, { amount: 0.5, ceilingDb: 1 }), RangeError);
});
test('DAEMON//CRUSH: every setting is denser than bypass under the same peak', () => {
  const x = fixture(), density = (amount: number) => { const y = crush(x, { amount }).audio; return ampDb(rms(y)) - ampDb(truePeak(y)); };
  const dry = density(0), low = density(0.35), mid = density(0.7), full = density(1);
  assert.ok(low > dry + 0.5 && mid > low && mid > dry + 1 && full > dry + 1, `rms-to-peak dB: ${[dry, low, mid, full].map(v => v.toFixed(2)).join(', ')}`);
  const r = crush(x, { amount: 0.7 }).report;
  assert.ok(r.maxReductionDb > 1 && r.maxShaveDb > 0.5 && r.clippedShare < 0.25);
});
test('DAEMON//CRUSH: shaper and clipper stay inside their bounds', () => {
  for (const [g, bias] of [[0.5, 0], [2.24, 0.12], [3.4, 0.08]] as const) {
    const f = shaper(g, bias);
    for (let u = -1; u <= 1; u += 0.01) assert.ok(Math.abs(f(u)) <= 1 + 1e-12);
    assert.ok(Math.abs(f(0)) < 1e-12 && f(0.1) > 0.1); // lifts quiet material, keeps zero at zero
  }
  assert.equal(shaper(0, 0.1)(0.37), 0.37);
  for (let u = -8; u <= 8; u += 0.05) { const y = softClip(u, 0.62); assert.ok(Math.abs(y) <= 1 && (Math.abs(u) > 0.62 || y === u)); }
  const s0 = crushSettings(0), s1 = crushSettings(1);
  assert.ok(s0.lowG === 0 && s0.midG === 0 && s0.ratio === 1 && s1.ratio > 1 && s1.midG > s1.lowG && s1.lowG > s1.highG);
});
test('DAEMON//CRUSH: resampler round trip is transparent and time-aligned', () => {
  const n = 4096, x = new Float64Array(n); for (let i = 0; i < n; i++) x[i] = 0.5 * Math.sin(2 * Math.PI * 1000 * i / SR) + 0.25 * Math.sin(2 * Math.PI * 9000 * i / SR);
  const y = downsample(upsample(x, 4), 4); let err = 0; for (let i = 400; i < n - 400; i++) err = Math.max(err, Math.abs(y[i]! - x[i]!));
  assert.ok(err < 1e-4, `round-trip error ${err}`);
});
test('DAEMON//CRUSH: folded harmonics and sub-on-mid intermodulation stay far below the engine tanh saturation', () => {
  const viaCrush = (x: Stereo) => crush(x, { amount: 0.7 }).audio, d = dbAmp(10);
  const engineTanh = (x: Stereo): Stereo => [x[0].map(v => Math.tanh(v * d)), x[1].map(v => Math.tanh(v * d))];
  const a = aliasingProbe(viaCrush), b = aliasingProbe(engineTanh), c = aliasingProbe(x => crush(x, { amount: 1, squeeze: false }).audio);
  assert.ok(a.totalDbc < -90 && c.totalDbc < -90, `aliasing ${a.totalDbc} / ${c.totalDbc} dBc`);
  assert.ok(b.totalDbc > -50, 'the probe must be able to see aliasing');
  assert.ok(intermodProbe(viaCrush).sidebandsDbc < intermodProbe(engineTanh).sidebandsDbc - 20);
});
