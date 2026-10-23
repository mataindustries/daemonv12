// MORPH//03 household-machine kit, copied from MORPH//02 B (b-alarm-breaks-reality.mjs) so this
// experiment stays self-contained. Changes: the piezo beep can fall in pitch, the washer kick is
// tuned shorter for a bass-led groove, every one-shot starts from a zero sample.
import { SR, TAU, mtof, smooth, rng, bipolar, SVF, filt, Osc, shape, tube, Delay, modal, norm } from './dsp.mjs';

/** Piezo beeper: band-limited square through a plastic-housing resonance.
 *  fall: semitones the pitch drops across the beep (an exponential "falling down the well"). */
export function piezo(midi, seconds, { fall = 0, size = 1 } = {}) {
  // size > 1: a bigger housing, its resonances lower (the beeper grows as it falls into the machine)
  const n = Math.round((seconds + 0.03) * SR), out = new Float64Array(n);
  const osc = new Osc(0.25), body = new SVF(3150 / size, 7), shell = new SVF(5400 / size, 3), f = mtof(midi);
  for (let i = 0; i < n; i++) {
    const t = i / SR, gate = smooth(t / 0.0012) * (1 - smooth((t - seconds) / 0.003));
    const u = Math.min(1, t / Math.max(0.01, seconds));
    const sq = osc.square(f * 2 ** (-fall * (1 - Math.exp(-3 * u)) / (1 - Math.exp(-3)) / 12), 0.5);
    body.tick(sq); shell.tick(sq);
    out[i] = (0.22 * sq + 0.9 * body.bp + 0.35 * shell.bp) * gate;
  }
  return norm(out);
}

/** Washer-drum kick: pitched body + tub thunk + click; tighter than B's for a bass-led groove. */
export function washerKick(seed = 11) {
  const n = Math.round(0.45 * SR), body = new Float64Array(n), r = bipolar(rng(seed));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = 52 + 140 * Math.exp(-t / 0.025) + 20 * Math.exp(-t / 0.12);
    ph += TAU * f / SR;
    body[i] = Math.sin(ph) * (t < 0.025 ? 1 : Math.exp(-(t - 0.025) / 0.14)) * smooth(t / 0.0012);
  }
  const hot = norm(shape(body, Math.tanh, 1.6));
  const burst = new Float64Array(n);
  for (let i = 0; i < 260; i++) burst[i] = r() * Math.exp(-i / 40) * smooth(i / 12);
  const tub = norm(modal(burst, [{ f: 118, t60: 0.12, gain: 1 }, { f: 197, t60: 0.1, gain: 0.8 }, { f: 289, t60: 0.08, gain: 0.6 }, { f: 433, t60: 0.06, gain: 0.4 }]));
  const click = norm(filt(burst.slice(), 'hp', 2500, 0.7));
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = hot[i] + 0.25 * tub[i] + 0.12 * click[i];
  return norm(out);
}

/** Dispersive "toaster spring" (allpass chain in a short feedback loop) + layered clap + body. */
export function springSnare(seed = 21, { boing = 0.45 } = {}) {
  const n = Math.round(0.6 * SR), r = bipolar(rng(seed));
  const spring = new Float64Array(n), stages = 48, a = -0.62, z = new Float64Array(stages), loop = new Delay(0.05);
  for (let i = 0; i < n; i++) {
    let x = (i > 0 && i < 5 ? 1 - i / 5 : 0) + 0.55 * loop.read(0.0213 * SR);
    for (let s = 0; s < stages; s++) { const y = a * x + z[s]; z[s] = x - a * y; x = y; }
    loop.write(x); spring[i] = x;
  }
  filt(spring, 'hp', 300, 0.7); filt(spring, 'lp', 7000, 0.7); norm(spring);
  const clap = new Float64Array(n), bp = new SVF(1350, 1.6);
  for (let i = 0; i < n; i++) {
    const t = i / SR; let env = 0;
    for (const o of [0, 0.009, 0.019, 0.031]) if (t >= o) env = Math.max(env, Math.exp(-(t - o) / (o === 0.031 ? 0.11 : 0.006)) * smooth((t - o) / 0.0006));
    bp.tick(r()); clap[i] = bp.bp * env;
  }
  norm(clap);
  const body = new Float64Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (185 + 60 * Math.exp(-t / 0.01)) / SR; body[i] = Math.sin(ph) * Math.exp(-t / 0.06) * smooth(t / 0.001); }
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = boing * spring[i] + 1 * clap[i] + 0.35 * body[i];
  return norm(out);
}

/** Mechanical alarm-clock bell struck by its hammer: the hats. which = 0/1 picks one of two bells. */
export function bellHat(which, decay = 1, seed = 31) {
  const n = Math.round((0.2 + 0.25 * decay) * SR), x = new Float64Array(n), r = bipolar(rng(seed));
  for (let i = 1; i < 60; i++) x[i] = r() * Math.exp(-i / 9);
  const f0 = which ? 3740 : 3290;
  const y = modal(x, [1, 1.47, 2.09, 2.56, 3.02].map((k, j) => ({ f: f0 * k, t60: (0.16 - j * 0.022) * decay, gain: [1, 0.6, 0.5, 0.35, 0.25][j] })));
  for (let i = 0; i < n; i++) y[i] += x[i] * 0.3;
  return norm(filt(y, 'hp', 2800, 0.7));
}

/** Hydraulic press stamp: a falling thud, steel-plate modes and a pneumatic exhale. */
export function clank(seed, size = 1) {
  const n = Math.round(0.9 * SR), r = bipolar(rng(seed)), hit = new Float64Array(n), thud = new Float64Array(n), hiss = new Float64Array(n);
  for (let i = 1; i < 400; i++) hit[i] = r() * Math.exp(-i / 60);
  const plate = modal(hit, [97, 163, 241, 337, 452, 611, 787, 1043].map((f, k) => ({ f: f / size, t60: 0.35 - k * 0.03, gain: 1 / (1 + k * 0.4) })));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += TAU * (60 + 120 * Math.exp(-t / 0.025)) / SR;
    thud[i] = Math.sin(ph) * Math.exp(-t / 0.08) * smooth(t / 0.001);
  }
  const hp = new SVF(4200, 0.7);
  for (let i = 0; i < n; i++) { const t = i / SR - 0.07; hp.tick(r()); hiss[i] = t > 0 ? hp.hp * smooth(t / 0.03) * Math.exp(-t / 0.16) : 0; }
  norm(plate); norm(thud); norm(hiss);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = 0.55 * plate[i] + 0.7 * thud[i] + 0.16 * hiss[i];
  return norm(filt(shape(out, tube, 1.6), 'hp', 45, 0.7));
}

/** Kitchen-timer tick (plastic). */
export function tick(seed = 3) {
  const n = Math.round(0.06 * SR), x = new Float64Array(n), r = bipolar(rng(seed));
  for (let i = 1; i < 90; i++) x[i] = r() * Math.exp(-i / 18);
  const y = modal(x, [1830, 3120, 4410, 6230].map((f, k) => ({ f, t60: 0.025 + 0.01 * k, gain: [1, 0.7, 0.45, 0.3][k] })));
  for (let i = 0; i < n; i++) y[i] = y[i] + x[i] * 0.4;
  return norm(y);
}

/** Microwave "DING": inharmonic bell plus a shadow three octaves down (no sub drop: the cable owns the low end). */
export function ding() {
  const n = Math.round(1.6 * SR), x = new Float64Array(n), r = bipolar(rng(61));
  for (let i = 1; i < 80; i++) x[i] = r() * Math.exp(-i / 12);
  const bell = norm(modal(x, [1, 2.76, 5.40, 8.93, 1.5, 3.9].map((k, j) => ({ f: 1318.5 * k, t60: [2.2, 1.4, 0.9, 0.5, 1.6, 1.0][j], gain: [1, 0.5, 0.3, 0.15, 0.25, 0.2][j] }))));
  const giant = norm(modal(x, [1, 2.76, 5.40, 8.93].map((k, j) => ({ f: 164.8 * k, t60: [2.2, 1.6, 1.1, 0.7][j], gain: [1, 0.5, 0.3, 0.15][j] }))));
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = bell[i] * 0.6 + giant[i] * 0.5;
  return norm(out);
}
