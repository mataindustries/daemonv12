// Objective evidence for the final soundtrack package (no listening implied). Builds on
// hybrid-ac/tools/analysis-ac.mjs (imported unmodified) with the measurements this phase adds:
// per-bar hook legibility, UI-click headroom for the menu, loop and stem alignment, and the
// shape of the demo's start and ending.
import * as A from '../../hybrid-ac/tools/analysis-ac.mjs';

export const SR = 44100;
const r = (x, d = 2) => (Number.isFinite(x) ? Number(x.toFixed(d)) : null);
const db = (x) => (x > 0 ? 10 * Math.log10(x) : -Infinity);
const HOP = 1024;

// Masking of a lead inside one window of bars. Band frames come from A.bandFrames (hop 1024);
// frame f covers samples [f*1024, f*1024 + 2048).
export function windowMasking(stemFrames, leadIds, fromSec, toSec) {
  const f0 = Math.floor(fromSec * SR / HOP), f1 = Math.floor(toSec * SR / HOP);
  const sliced = Object.fromEntries(Object.entries(stemFrames).map(([id, f]) => [id, f.slice(f0, f1)]));
  return A.maskingReport(sliced, leadIds);
}

// How much room the music leaves for UI sounds. A synthetic button click (3 kHz, 4 ms decay,
// -20 dBFS peak; used only for this measurement) is laid over the mix on every eighth note.
// For each click, the click's energy in 2-6 kHz over 20 ms is compared with the music's energy
// in the same band and window: the click-to-music ratio. Higher means the click reads more clearly.
export function uiClickHeadroom(mono, { startSec = 0, eighthSec = 0.2828125 } = {}) {
  const len = Math.round(0.02 * SR), click = new Float64Array(len), amp = 10 ** (-20 / 20);
  for (let i = 0; i < len; i++) click[i] = amp * Math.sin(2 * Math.PI * 3000 * i / SR) * Math.exp(-i / (0.004 * SR));
  const bandE = (x) => { const y = bandpass2to6(x); let e = 0; for (const v of y) e += v * v; return e; };
  const clickE = bandE(click), ratios = [];
  for (let t = startSec; (t + 0.02) * SR < mono.length; t += eighthSec) {
    const from = Math.round(t * SR), seg = mono.subarray(from, from + len);
    ratios.push(db(clickE) - db(bandE(seg) + 1e-20));
  }
  ratios.sort((a, b) => a - b);
  const q = (k) => ratios[Math.min(ratios.length - 1, Math.floor(k * ratios.length))];
  return { method: 'synthetic 3 kHz click, 4 ms decay, -20 dBFS peak, on every eighth note; click vs music energy in 2-6 kHz over 20 ms',
    clicks: ratios.length, clickToMusicDb: { p10: r(q(0.1), 1), median: r(q(0.5), 1), p90: r(q(0.9), 1) } };
}
function biquad(x, type, f0, q = Math.SQRT1_2) {
  const w = 2 * Math.PI * f0 / SR, c = Math.cos(w), al = Math.sin(w) / (2 * q);
  const [b0, b1, b2] = type === 'lp' ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : [(1 + c) / 2, -(1 + c), (1 + c) / 2];
  const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al, y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
const bandpass2to6 = (x) => biquad(biquad(biquad(biquad(x, 'hp', 2000), 'hp', 2000), 'lp', 6000), 'lp', 6000);

// The music's own level in the UI band: 2-6 kHz RMS over 20 ms windows, in dBFS.
export function highBandLevel(mono) {
  const y = bandpass2to6(mono), w = Math.round(0.02 * SR), lv = [];
  for (let s = 0; s + w <= y.length; s += w) { let e = 0; for (let i = s; i < s + w; i++) e += y[i] * y[i]; lv.push(db(e / w + 1e-20)); }
  lv.sort((a, b) => a - b);
  const q = (k) => r(lv[Math.min(lv.length - 1, Math.floor(k * lv.length))], 1);
  return { method: '2-6 kHz band, RMS over 20 ms windows, dBFS', median: q(0.5), p90: q(0.9) };
}

// Level in short windows: used for the demo's cold open and its ending.
export function windowDb(ch, fromSec, toSec) {
  const a = Math.max(0, Math.round(fromSec * SR)), b = Math.min(ch[0].length, Math.round(toSec * SR));
  let e = 0, p = 0;
  for (let c = 0; c < ch.length; c++) for (let i = a; i < b; i++) { e += ch[c][i] ** 2; p = Math.max(p, Math.abs(ch[c][i])); }
  return { rmsDbfs: r(db(e / (ch.length * Math.max(1, b - a)) + 1e-30), 1), peakDbfs: r(20 * Math.log10(p + 1e-30), 1) };
}
export function firstOnsetSeconds(ch, thresholdDb = -40) {
  const t = 10 ** (thresholdDb / 20);
  for (let i = 0; i < ch[0].length; i++) if (Math.abs(ch[0][i]) > t || Math.abs(ch[1][i]) > t) return r(i / SR, 4);
  return null;
}

export { A };
