// Fit articulator parameters of voice.mjs to vowel formant targets (size 1, 88.2 kHz tract).
// Prints measured F1/F2/F3 of the shipped PHONEMES, then a coarse grid search per vowel.
// Usage: node experiments/morph-02/calibrate-voice.mjs [--search]
import { Tract, tractShape, PHONEMES } from './voice.mjs';

const RATE = 88200, STEPS = 8192;
const freqs = Array.from({ length: 360 }, (_, k) => 90 * (4200 / 90) ** (k / 359));
const cosT = freqs.map(f => Float64Array.from({ length: STEPS }, (_, n) => Math.cos(2 * Math.PI * f * n / RATE)));
const sinT = freqs.map(f => Float64Array.from({ length: STEPS }, (_, n) => Math.sin(2 * Math.PI * f * n / RATE)));
export function formants(shape, velum = 0) {
  const t = new Tract(); t.setDiameters(tractShape(shape)); t.velum = velum * velum;
  const ir = new Float64Array(STEPS); let prev = 0;
  for (let n = 0; n < STEPS; n++) { const y = t.step(n === 0 ? 1 : 0); ir[n] = y - prev; prev = y; }
  const mag = freqs.map((f, k) => {
    let re = 0, im = 0; const c = cosT[k], s = sinT[k];
    for (let n = 0; n < STEPS; n++) { re += ir[n] * c[n]; im -= ir[n] * s[n]; }
    return Math.hypot(re, im) / (f / 1000); // remove the radiation tilt before peak picking
  });
  const peaks = [];
  for (let k = 1; k < mag.length - 1; k++) if (mag[k] > mag[k - 1] && mag[k] >= mag[k + 1]) peaks.push(Math.round(freqs[k]));
  return peaks.slice(0, 4);
}
const TARGET = { ee: [270, 2290], ih: [390, 1990], eh: [530, 1840], ah: [730, 1090], uh: [640, 1190], oh: [450, 800], oo: [300, 870] };
for (const [ph, p] of Object.entries(PHONEMES)) console.log(ph.padEnd(3), JSON.stringify(formants(p, p.velum ?? 0)), TARGET[ph] ? `target ${TARGET[ph]}` : '');
if (process.argv.includes('--search')) {
  for (const [ph, [f1, f2]] of Object.entries(TARGET)) {
    let best = null;
    for (let ti = 10; ti <= 32; ti += 1) for (const td of [0.35, 0.45, 0.55, 0.7, 0.85, 1.0, 1.2, 1.4]) for (const ld of [0.3, 0.5, 0.7, 1.0, 1.3, 1.5]) {
      const f = formants({ tongueIndex: ti, tongueDiam: td, lipDiam: ld });
      if (f.length < 2) continue;
      const err = Math.log(f[0] / f1) ** 2 + Math.log(f[1] / f2) ** 2;
      if (!best || err < best.err) best = { err, ti, td, ld, f };
    }
    console.log('fit', ph, JSON.stringify(best));
  }
}
