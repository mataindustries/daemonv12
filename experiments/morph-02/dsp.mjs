// MORPH//02 shared DSP kit. Node built-ins only, seeded, offline, 44.1 kHz float64.
// Deliberately small: just the pieces the three sketches share.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const SR = 44100;
export const TAU = Math.PI * 2;
export const mtof = m => 440 * 2 ** ((m - 69) / 12);
export const dbToGain = db => 10 ** (db / 20);
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
export const buf = seconds => new Float64Array(Math.ceil(seconds * SR));
export const stereo = seconds => ({ L: buf(seconds), R: buf(seconds) });

/** mulberry32: deterministic [0,1). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const bipolar = r => () => r() * 2 - 1;

/** Smoothed random walk ("drift") in [-1,1] with a given rate in Hz. */
export function drift(seed, rateHz) {
  const r = rng(seed);
  let a = r() * 2 - 1, b = r() * 2 - 1, phase = 0;
  return () => {
    phase += rateHz / SR;
    if (phase >= 1) { phase -= 1; a = b; b = r() * 2 - 1; }
    return a + (b - a) * smooth(phase);
  };
}

// ---------- mixing ----------
export function addAt(dst, src, at = 0, gain = 1) {
  const o = Math.round(at * SR);
  const n = Math.min(src.length, dst.length - o);
  for (let i = Math.max(0, -o); i < n; i++) dst[o + i] += src[i] * gain;
}
/** Constant-power pan of a mono source into a stereo bus. p in [-1,1]. */
export function addPan(bus, src, at = 0, gain = 1, p = 0) {
  const a = (clamp(p, -1, 1) + 1) * Math.PI / 4;
  addAt(bus.L, src, at, gain * Math.cos(a));
  addAt(bus.R, src, at, gain * Math.sin(a));
}
export function addStereo(bus, s, at = 0, gain = 1) { addAt(bus.L, s.L, at, gain); addAt(bus.R, s.R, at, gain); }
export function scale(x, g) { for (let i = 0; i < x.length; i++) x[i] *= g; return x; }
/** Scale a mono buffer to a given absolute peak (gain staging for layers, not mastering). */
export function norm(x, peak = 1) { let p = 0; for (const v of x) p = Math.max(p, Math.abs(v)); return p > 0 ? scale(x, peak / p) : x; }
export function applyEnv(x, fn) { for (let i = 0; i < x.length; i++) x[i] *= fn(i / SR, i); return x; }

// ---------- filters ----------
/** Topology-preserving state-variable filter; tune per sample if needed. */
export class SVF {
  constructor(fc = 1000, q = 0.707) { this.s1 = 0; this.s2 = 0; this.set(fc, q); }
  set(fc, q = this.q) {
    this.q = q;
    const g = Math.tan(Math.PI * clamp(fc, 5, SR * 0.49) / SR), k = 1 / q;
    this.g = g; this.k = k; this.a1 = 1 / (1 + g * (g + k)); this.a2 = g * this.a1; this.a3 = g * this.a2;
  }
  tick(x) {
    const v3 = x - this.s2, v1 = this.a1 * this.s1 + this.a2 * v3, v2 = this.s2 + this.a2 * this.s1 + this.a3 * v3;
    this.s1 = 2 * v1 - this.s1; this.s2 = 2 * v2 - this.s2;
    this.lp = v2; this.bp = v1; this.hp = x - this.k * v1 - v2;
    return v2;
  }
}
/** RBJ biquad, direct form I. */
export class Biquad {
  constructor(type, fc, q = 0.707, gainDb = 0) { this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(type, fc, q, gainDb); }
  set(type, fc, q = 0.707, gainDb = 0) {
    const w = TAU * clamp(fc, 5, SR * 0.49) / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q), A = 10 ** (gainDb / 40);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === 'peak') { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; }
    else if (type === 'ls' || type === 'hs') {
      const sq = 2 * Math.sqrt(A) * al, sign = type === 'ls' ? 1 : -1;
      b0 = A * ((A + 1) - sign * (A - 1) * c + sq); b1 = 2 * sign * A * ((A - 1) - sign * (A + 1) * c);
      b2 = A * ((A + 1) - sign * (A - 1) * c - sq); a0 = (A + 1) + sign * (A - 1) * c + sq;
      a1 = -2 * sign * ((A - 1) + sign * (A + 1) * c); a2 = (A + 1) + sign * (A - 1) * c - sq;
    } else throw new Error(`biquad type ${type}`);
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    return this;
  }
  tick(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
  run(x) { for (let i = 0; i < x.length; i++) x[i] = this.tick(x[i]); return x; }
}
export const filt = (x, type, fc, q, g) => new Biquad(type, fc, q, g).run(x);
export function eqStereo(bus, bands) {
  for (const ch of [bus.L, bus.R]) for (const [type, fc, q, g] of bands) new Biquad(type, fc, q, g).run(ch);
  return bus;
}
export class DCBlock { constructor(fc = 12) { this.r = Math.exp(-TAU * fc / SR); this.x1 = 0; this.y1 = 0; }
  tick(x) { const y = x - this.x1 + this.r * this.y1; this.x1 = x; this.y1 = y; return y; } }

// ---------- band-limited oscillators ----------
function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
/** Phase-continuous polyBLEP oscillator; freq may change every sample. */
export class Osc {
  constructor(phase = 0) { this.p = phase; }
  saw(f) { const dt = f / SR; let y = 2 * this.p - 1 - blep(this.p, dt); this.p += dt; if (this.p >= 1) this.p -= 1; return y; }
  square(f, pw = 0.5) {
    const dt = f / SR; let y = this.p < pw ? 1 : -1;
    y += blep(this.p, dt); y -= blep((this.p + 1 - pw) % 1, dt);
    this.p += dt; if (this.p >= 1) this.p -= 1; return y;
  }
  sine(f) { const y = Math.sin(TAU * this.p); this.p += f / SR; if (this.p >= 1) this.p -= 1; return y; }
}

// ---------- oversampled nonlinearity ----------
function sincLowpass(taps, cutoff) { // cutoff as fraction of the (oversampled) rate
  const h = new Float64Array(taps), m = (taps - 1) / 2; let sum = 0;
  for (let i = 0; i < taps; i++) {
    const x = i - m, w = 0.42 - 0.5 * Math.cos(TAU * i / (taps - 1)) + 0.08 * Math.cos(2 * TAU * i / (taps - 1));
    h[i] = (x === 0 ? 2 * cutoff : Math.sin(TAU * cutoff * x) / (Math.PI * x)) * w; sum += h[i];
  }
  for (let i = 0; i < taps; i++) h[i] /= sum;
  return h;
}
const OS = 4, OS_TAPS = 128, OS_H = sincLowpass(OS_TAPS, 0.5 / OS * 0.92);
/** Apply a memoryless shaper at 4x with windowed-sinc interpolation/decimation. drive may be an array. */
export function shape(x, fn, drive = 1) {
  const n = x.length, up = new Float64Array(n * OS + OS_TAPS);
  for (let i = 0; i < n; i++) {
    const d = typeof drive === 'number' ? drive : drive[i];
    up[i * OS] = x[i] * OS * d;
  }
  // interpolate
  const y = new Float64Array(n * OS);
  for (let j = 0; j < n * OS; j++) {
    let acc = 0; const k0 = j % OS; // only nonzero taps contribute
    for (let k = k0; k < OS_TAPS; k += OS) { const idx = j - k; if (idx >= 0) acc += OS_H[k] * up[idx]; }
    y[j] = fn(acc);
  }
  const out = new Float64Array(n), delay = OS_TAPS - 1; // total FIR delay (two filters) in OS samples
  for (let i = 0; i < n; i++) {
    const j = i * OS + delay; let acc = 0;
    for (let k = 0; k < OS_TAPS; k++) { const idx = j - k; if (idx >= 0 && idx < y.length) acc += OS_H[k] * y[idx]; }
    out[i] = acc;
  }
  return out;
}
export const tanh = Math.tanh;
/** True-peak estimate: peak of the 4x windowed-sinc interpolated signal. */
export function truePeak(bus) {
  let p = 0;
  for (const x of [bus.L, bus.R]) {
    const n = x.length;
    for (let j = 0; j < n * OS; j++) {
      let acc = 0; const k0 = j % OS;
      for (let k = k0; k < OS_TAPS; k += OS) { const idx = (j - k) / OS; if (idx >= 0 && idx < n) acc += OS_H[k] * x[idx] * OS; }
      if (Math.abs(acc) > p) p = Math.abs(acc);
    }
  }
  return p;
}
/** Limit, then trim any residual inter-sample overshoot so the 4x true peak meets the ceiling. */
export function master(bus, { targetLufs, ceilingDb = -1.2, release = 0.06 }) {
  const loud = lufs(bus);
  scale(bus.L, dbToGain(targetLufs - loud)); scale(bus.R, dbToGain(targetLufs - loud));
  // report where the limiter will work hardest (> 2 dB), in 50 ms bins, for mix diagnosis
  const hot = new Set(), ceil = dbToGain(ceilingDb - 2.3);
  for (const ch of [bus.L, bus.R]) for (let i = 0; i < ch.length; i++) if (Math.abs(ch[i]) > ceil) hot.add(Math.round(i / SR * 20) / 20);
  const limiterDb = limit(bus, { ceilingDb: ceilingDb - 0.3, lookahead: 0.003, release });
  const tp = truePeak(bus), trimDb = Math.min(0, ceilingDb - 20 * Math.log10(tp));
  scale(bus.L, dbToGain(trimDb)); scale(bus.R, dbToGain(trimDb));
  return { preMasterLufs: loud, limiterMaxDb: limiterDb, truePeakTrimDb: trimDb, limiterOver2dBAt: [...hot].sort((a, b) => a - b) };
}
/** Asymmetric tube-ish curve: even harmonics + soft knee. */
export const tube = v => Math.tanh(v + 0.25 * v * v / (1 + Math.abs(v))) ;
export const fold = v => Math.sin(v); // sine wavefolder for metallic buzz

// ---------- delays ----------
export class Delay {
  constructor(maxSeconds) { this.n = Math.ceil(maxSeconds * SR) + 4; this.b = new Float64Array(this.n); this.w = 0; }
  write(x) { this.b[this.w] = x; this.w = (this.w + 1) % this.n; }
  /** Cubic (Hermite) fractional read, d in samples (>= 1). */
  read(d) {
    const p = this.w - d - 1 + this.n * 4, i = Math.floor(p), f = p - i, n = this.n, b = this.b;
    const y0 = b[(i - 1) % n], y1 = b[i % n], y2 = b[(i + 1) % n], y3 = b[(i + 2) % n];
    const c1 = 0.5 * (y2 - y0), c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3, c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
    return ((c3 * f + c2) * f + c1) * f + y1;
  }
}
/** Tempo-synced stereo feedback delay (ping-pong optional) returning a wet bus. */
export function echo(bus, { left, right, feedback = 0.4, lp = 5000, hp = 200, pingpong = false }) {
  const n = bus.L.length, out = { L: new Float64Array(n), R: new Float64Array(n) };
  const dl = new Delay(left + 0.1), dr = new Delay(right + 0.1);
  const fl = new Biquad('lp', lp), fr = new Biquad('lp', lp), hl = new Biquad('hp', hp), hr = new Biquad('hp', hp);
  for (let i = 0; i < n; i++) {
    const yl = dl.read(left * SR), yr = dr.read(right * SR);
    const l = hl.tick(fl.tick(yl)), r = hr.tick(fr.tick(yr));
    out.L[i] = yl; out.R[i] = yr;
    if (pingpong) { dl.write(bus.L[i] + bus.R[i] * 0.5 + r * feedback); dr.write(l * feedback); }
    else { dl.write(bus.L[i] + l * feedback); dr.write(bus.R[i] + r * feedback); }
  }
  return out;
}

// ---------- reverb: 8-line FDN with diffusion, modulation and frequency-dependent decay ----------
export function reverb(bus, { size = 1, rt60 = 2.5, hfRatio = 0.5, predelay = 0.02, diffusion = 0.7, mod = 1, seed = 7, lowCut = 120 } = {}) {
  const n = bus.L.length, out = { L: new Float64Array(n), R: new Float64Array(n) };
  const base = [0.0297, 0.0371, 0.0411, 0.0437, 0.0533, 0.0599, 0.0677, 0.0731];
  const lens = base.map(s => s * size * SR);
  const lines = lens.map(len => new Delay(len / SR + 0.01));
  const gains = lens.map(len => 10 ** (-3 * len / (rt60 * SR)));
  // one-pole damping per line so that HF decays hfRatio times faster
  const damp = lens.map((len, k) => {
    const gHf = 10 ** (-3 * len / (rt60 * hfRatio * SR));
    return clamp(1 - gHf / gains[k], 0, 0.95);
  });
  const lpState = new Float64Array(8);
  const pre = new Delay(predelay + 0.01);
  const apLens = [142, 107, 379, 277, 211, 163].map(v => Math.round(v * Math.max(0.5, size)));
  const aps = apLens.map(len => ({ d: new Float64Array(len), i: 0 }));
  const ap = (s, x) => { const y = s.d[s.i]; const v = x + diffusion * y; s.d[s.i] = v; s.i = (s.i + 1) % s.d.length; return y - diffusion * v; };
  const r = rng(seed); const lfoRate = lens.map(() => 0.1 + r() * 0.6), lfoPhase = lens.map(() => r() * TAU);
  const hpL = new Biquad('hp', lowCut), hpR = new Biquad('hp', lowCut);
  const v = new Float64Array(8), y = new Float64Array(8);
  for (let i = 0; i < n; i++) {
    pre.write((bus.L[i] + bus.R[i]) * 0.5);
    let x = pre.read(Math.max(1, predelay * SR));
    for (const s of aps) x = ap(s, x);
    const side = (bus.L[i] - bus.R[i]) * 0.5;
    for (let k = 0; k < 8; k++) {
      const m = mod * 6 * Math.sin(lfoPhase[k] + TAU * lfoRate[k] * i / SR);
      let o = lines[k].read(lens[k] + m);
      lpState[k] += (1 - damp[k]) * (o - lpState[k]);
      y[k] = lpState[k] * gains[k];
    }
    // 8x8 Hadamard (fast), normalized
    for (let k = 0; k < 8; k++) v[k] = y[k];
    for (let h = 1; h < 8; h *= 2) for (let a = 0; a < 8; a += h * 2) for (let b = a; b < a + h; b++) {
      const p = v[b], q = v[b + h]; v[b] = p + q; v[b + h] = p - q;
    }
    const norm = 1 / Math.sqrt(8);
    for (let k = 0; k < 8; k++) lines[k].write(v[k] * norm + (k % 2 ? x + side * 0.5 : x - side * 0.5) * 0.5);
    out.L[i] = hpL.tick(y[0] - y[2] + y[4] + y[6] * 0.7 - y[7] * 0.3);
    out.R[i] = hpR.tick(y[1] + y[3] - y[5] + y[7] * 0.7 - y[6] * 0.3);
  }
  return out;
}

// ---------- modal resonator bank (excite with any signal) ----------
/** modes: [{f, t60, gain}] — two-pole resonators summed. Returns mono.
 *  norm 'impulse': a unit impulse rings each mode at amplitude `gain` (struck objects).
 *  norm 'peak': steady-state gain at each mode's centre is ~`gain` (resonating a continuous signal). */
export function modal(input, modes, norm = 'impulse') {
  const out = new Float64Array(input.length);
  for (const { f, t60, gain = 1 } of modes) {
    if (f >= SR * 0.45) continue;
    const r = 10 ** (-3 / (t60 * SR)), w = TAU * f / SR, a1 = -2 * r * Math.cos(w), a2 = r * r;
    const peak = norm === 'peak';
    const g = peak ? gain * (1 - r * r) / 2 : gain * Math.sin(w);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < input.length; i++) {
      const x = input[i], yv = (peak ? g * (x - x2) : g * x1) - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = yv; out[i] += yv;
    }
  }
  return out;
}

// ---------- dynamics ----------
/** Feed-forward stereo-linked compressor. sidechain optional (mono array). */
export function compress(bus, { threshold = -18, ratio = 3, attack = 0.01, release = 0.15, makeup = 0, knee = 6, sidechain } = {}) {
  const n = bus.L.length, aA = Math.exp(-1 / (attack * SR)), aR = Math.exp(-1 / (release * SR));
  let env = 0; const gr = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const s = sidechain ? Math.abs(sidechain[i]) : Math.max(Math.abs(bus.L[i]), Math.abs(bus.R[i]));
    env = s > env ? aA * env + (1 - aA) * s : aR * env + (1 - aR) * s;
    const lvl = 20 * Math.log10(env + 1e-9), over = lvl - threshold;
    let red = 0;
    if (over > knee / 2) red = over * (1 - 1 / ratio);
    else if (over > -knee / 2) red = (1 - 1 / ratio) * (over + knee / 2) ** 2 / (2 * knee);
    const g = 10 ** ((makeup - red) / 20); gr[i] = red;
    bus.L[i] *= g; bus.R[i] *= g;
  }
  return gr;
}
/** Lookahead brickwall-ish limiter with 4x-interpolated peak detection. Returns max gain reduction dB. */
export function limit(bus, { ceilingDb = -1.2, lookahead = 0.003, release = 0.08 } = {}) {
  const n = bus.L.length, ceil = dbToGain(ceilingDb), la = Math.round(lookahead * SR);
  const peak = new Float64Array(n);
  for (const ch of [bus.L, bus.R]) for (let i = 0; i < n; i++) {
    // cheap inter-sample estimate: cubic midpoints
    const a = ch[Math.max(0, i - 1)], b = ch[i], c = ch[Math.min(n - 1, i + 1)], d = ch[Math.min(n - 1, i + 2)];
    const mid = (-a + 9 * b + 9 * c - d) / 16;
    peak[i] = Math.max(peak[i], Math.abs(b), Math.abs(mid));
  }
  const target = new Float64Array(n);
  for (let i = 0; i < n; i++) target[i] = peak[i] > ceil ? ceil / peak[i] : 1;
  // future-window minimum: gmin[i] = min(target[i..i+la])
  const gmin = new Float64Array(n);
  for (let i = n - 1, dq = [], h = 0; i >= 0; i--) {
    while (dq.length > h && target[dq[dq.length - 1]] >= target[i]) dq.pop();
    dq.push(i);
    while (dq[h] > i + la) h++;
    gmin[i] = target[dq[h]];
  }
  // trailing box average over la+1 samples keeps every peak under its target and ramps smoothly
  const aR = Math.exp(-1 / (release * SR));
  let acc = la + 1, g = 1, maxRed = 0; // window gmin[i-la..i], virtual history of 1s
  for (let i = 0; i < n; i++) {
    acc += gmin[i] - (i > la ? gmin[i - la - 1] : 1);
    const boxed = acc / (la + 1);
    g = boxed < g ? boxed : g + (1 - aR) * (boxed - g);
    bus.L[i] *= g; bus.R[i] *= g;
    maxRed = Math.max(maxRed, -20 * Math.log10(g));
  }
  return maxRed;
}
/** Sidechain-style duck envelope from trigger times. */
export function duckCurve(n, times, { depth = 0.7, attack = 0.004, hold = 0.02, release = 0.18 } = {}) {
  const g = new Float64Array(n).fill(1);
  for (const t of times) {
    const s = Math.round(t * SR);
    for (let i = Math.max(0, s - Math.round(attack * SR)); i < Math.min(n, s + Math.round((hold + release * 4) * SR)); i++) {
      const dt = (i - s) / SR;
      const d = dt < 0 ? smooth(1 + dt / attack) : dt < hold ? 1 : Math.exp(-(dt - hold) / release);
      g[i] = Math.min(g[i], 1 - depth * d);
    }
  }
  return g;
}

// ---------- utilities ----------
export function widen(bus, width = 1.3) {
  for (let i = 0; i < bus.L.length; i++) {
    const m = (bus.L[i] + bus.R[i]) / 2, s = (bus.L[i] - bus.R[i]) / 2 * width;
    bus.L[i] = m + s; bus.R[i] = m - s;
  }
  return bus;
}
/** Keep lows mono below fc (mid/side split with a 2nd-order crossover on the side). */
export function monoBass(bus, fc = 140) {
  const hp = new Biquad('hp', fc, 0.707), hp2 = new Biquad('hp', fc, 0.707);
  for (let i = 0; i < bus.L.length; i++) {
    const m = (bus.L[i] + bus.R[i]) / 2, s = hp2.tick(hp.tick((bus.L[i] - bus.R[i]) / 2));
    bus.L[i] = m + s; bus.R[i] = m - s;
  }
  return bus;
}
export function fadeTail(bus, seconds = 0.05) {
  const n = bus.L.length, k = Math.round(seconds * SR);
  for (let i = 0; i < k; i++) { const g = smooth(i / k); bus.L[n - 1 - i] *= g; bus.R[n - 1 - i] *= g; }
  bus.L[0] = bus.R[0] = 0;
  return bus;
}
export function peakOf(bus) { let p = 0; for (const ch of [bus.L, bus.R]) for (const v of ch) p = Math.max(p, Math.abs(v)); return p; }
export function rmsOf(bus) { let s = 0; for (const ch of [bus.L, bus.R]) for (const v of ch) s += v * v; return Math.sqrt(s / (2 * bus.L.length)); }
/** Approximate BS.1770 integrated loudness (gated), for gain staging only. FFmpeg is the reported measure. */
export function lufs(bus) {
  const kw = ch => {
    const a = new Biquad('hs', 1681.97, 0.7071752, 3.99984), b = new Biquad('hp', 38.135, 0.5003);
    return Float64Array.from(ch, v => b.tick(a.tick(v)));
  };
  const L = kw(bus.L), R = kw(bus.R), win = Math.round(0.4 * SR), hop = Math.round(0.1 * SR), blocks = [];
  for (let s = 0; s + win <= L.length; s += hop) {
    let z = 0; for (let i = s; i < s + win; i++) z += L[i] * L[i] + R[i] * R[i];
    blocks.push(z / win);
  }
  const abs = blocks.filter(z => -0.691 + 10 * Math.log10(z + 1e-20) > -70);
  const mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const rel = -0.691 + 10 * Math.log10(mean(abs) + 1e-20) - 10;
  return -0.691 + 10 * Math.log10(mean(abs.filter(z => -0.691 + 10 * Math.log10(z + 1e-20) > rel)) + 1e-20);
}

// ---------- WAV ----------
export function encodeWav(bus, bits = 24, seed = 1) {
  const n = bus.L.length, bytesPer = bits / 8, data = n * 2 * bytesPer, wav = Buffer.alloc(44 + data);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + data, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 2 * bytesPer, 28);
  wav.writeUInt16LE(2 * bytesPer, 32); wav.writeUInt16LE(bits, 34);
  wav.write('data', 36); wav.writeUInt32LE(data, 40);
  const full = bits === 24 ? 8388607 : 32767, r = rng(seed);
  let o = 44, clipped = 0;
  for (let i = 0; i < n; i++) for (const ch of [bus.L, bus.R]) {
    const v = ch[i];
    if (!Number.isFinite(v)) throw new RangeError(`non-finite sample at ${i}`);
    if (Math.abs(v) > 1) clipped++;
    const dither = bits === 16 ? r() - r() : 0; // TPDF for 16-bit only
    const q = Math.max(-full - 1, Math.min(full, Math.round(v * full + dither)));
    if (bits === 24) wav.writeIntLE(q, o, 3); else wav.writeInt16LE(q, o);
    o += bytesPer;
  }
  if (clipped) throw new RangeError(`${clipped} samples exceed full scale; fix gain staging, do not clip`);
  return wav;
}
export function writeWav(path, bus, bits = 24) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, encodeWav(bus, bits)); }
