/**
 * HEADLINER 001 DSP toolkit. Original float64 DSP written for this single.
 * Deterministic: seeded PRNG only, no clock, no input files, no external audio, no platform randomness.
 * V8 implements Math.sin/cos/tan/exp/log/pow/tanh with its own fdlibm port, so output bytes repeat.
 */
export const SR = 44100;
export const TAU = Math.PI * 2;
export type Wave = Float64Array;
export const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export const dbAmp = (db: number) => Math.pow(10, db / 20);
export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
export const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
export const cents = (c: number) => Math.pow(2, c / 1200);

/** mulberry32: small, fast, fully deterministic 32-bit PRNG. */
export class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  bi(): number { return this.next() * 2 - 1; }
  range(a: number, b: number): number { return a + (b - a) * this.next(); }
  gauss(): number { const u = Math.max(1e-12, this.next()), v = this.next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }
}

// ---------------------------------------------------------------- oscillators
export function polyBlep(t: number, dt: number): number {
  if (t < dt) { const x = t / dt; return x + x - x * x - 1; }
  if (t > 1 - dt) { const x = (t - 1) / dt; return x * x + x + x + 1; }
  return 0;
}
/** Phase-accumulating oscillator; `fs` lets oversampled patches reuse it. */
export class Osc {
  phase: number; fs: number;
  constructor(phase = 0, fs = SR) { this.phase = phase - Math.floor(phase); this.fs = fs; }
  private adv(dt: number) { this.phase += dt; if (this.phase >= 1) this.phase -= Math.floor(this.phase); }
  sine(f: number): number { const v = Math.sin(TAU * this.phase); this.adv(f / this.fs); return v; }
  saw(f: number): number { const dt = Math.min(0.5, f / this.fs); const v = 2 * this.phase - 1 - polyBlep(this.phase, dt); this.adv(dt); return v; }
  pulse(f: number, pw = 0.5): number {
    const dt = Math.min(0.5, f / this.fs); let v = this.phase < pw ? 1 : -1;
    v += polyBlep(this.phase, dt); let p2 = this.phase + 1 - pw; p2 -= Math.floor(p2); v -= polyBlep(p2, dt);
    this.adv(dt); return v;
  }
  tri(f: number): number { const v = 4 * Math.abs(this.phase - 0.5) - 1; this.adv(f / this.fs); return v; }
}

// ---------------------------------------------------------------- filters
/** Zavalishin topology-preserving state-variable filter (zero-delay feedback). */
export class SVF {
  private ic1 = 0; private ic2 = 0; private a1 = 0; private a2 = 0; private a3 = 0; k = 1;
  lp = 0; bp = 0; hp = 0; fs: number;
  constructor(fs = SR) { this.fs = fs; }
  set(cutoff: number, q: number): this {
    const fc = clamp(cutoff, 5, this.fs * 0.48), g = Math.tan(Math.PI * fc / this.fs);
    this.k = 1 / Math.max(0.05, q); this.a1 = 1 / (1 + g * (g + this.k)); this.a2 = g * this.a1; this.a3 = g * this.a2;
    return this;
  }
  tick(x: number): number {
    const v3 = x - this.ic2, v1 = this.a1 * this.ic1 + this.a2 * v3, v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1; this.ic2 = 2 * v2 - this.ic2;
    this.lp = v2; this.bp = v1; this.hp = x - this.k * v1 - v2; return v2;
  }
  /** Unity-peak band-pass output of the last tick. */
  get bpn(): number { return this.k * this.bp; }
}
/** Four-pole zero-delay-feedback ladder with a saturating input stage; k in [0,4). */
export class Ladder {
  private s = [0, 0, 0, 0]; private G = 0; fs: number;
  constructor(fs = SR) { this.fs = fs; }
  set(cutoff: number): this { const g = Math.tan(Math.PI * clamp(cutoff, 10, this.fs * 0.45) / this.fs); this.G = g / (1 + g); return this; }
  tick(x: number, k: number, drive = 1): number {
    const G = this.G, s = this.s, m = 1 - G;
    const S = G * G * G * s[0]! * m + G * G * s[1]! * m + G * s[2]! * m + s[3]! * m, G4 = G * G * G * G;
    const y4 = (G4 * x + S) / (1 + k * G4);
    let u = Math.tanh(drive * (x - k * y4)) / Math.max(1, drive * 0.6);
    for (let i = 0; i < 4; i++) { const v = (u - s[i]!) * G, y = v + s[i]!; s[i] = y + v; u = y; }
    return u;
  }
}
export class OnePole {
  private z = 0; private a = 0; fs: number;
  constructor(cutoff: number, fs = SR) { this.fs = fs; this.set(cutoff); }
  set(cutoff: number): this { this.a = Math.exp(-TAU * clamp(cutoff, 1, this.fs * 0.49) / this.fs); return this; }
  lp(x: number): number { this.z = x * (1 - this.a) + this.z * this.a; return this.z; }
  hp(x: number): number { return x - this.lp(x); }
}
type BiquadKind = 'lp' | 'hp' | 'bp' | 'peak' | 'lowshelf' | 'highshelf' | 'notch';
/** RBJ cookbook biquad, transposed direct form II. */
export class Biquad {
  private b0 = 1; private b1 = 0; private b2 = 0; private a1 = 0; private a2 = 0; private z1 = 0; private z2 = 0;
  fs: number;
  constructor(kind: BiquadKind, f: number, q = 0.707, gainDb = 0, fs = SR) { this.fs = fs; this.set(kind, f, q, gainDb); }
  set(kind: BiquadKind, f: number, q = 0.707, gainDb = 0): this {
    const w = TAU * clamp(f, 5, this.fs * 0.49) / this.fs, c = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q), A = Math.pow(10, gainDb / 40);
    let b0 = 0, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;
    switch (kind) {
      case 'lp': b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; break;
      case 'hp': b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; break;
      case 'bp': b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; break;
      case 'notch': b0 = 1; b1 = -2 * c; b2 = 1; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; break;
      case 'peak': b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; break;
      case 'lowshelf': { const s2 = 2 * Math.sqrt(A) * al;
        b0 = A * ((A + 1) - (A - 1) * c + s2); b1 = 2 * A * ((A - 1) - (A + 1) * c); b2 = A * ((A + 1) - (A - 1) * c - s2);
        a0 = (A + 1) + (A - 1) * c + s2; a1 = -2 * ((A - 1) + (A + 1) * c); a2 = (A + 1) + (A - 1) * c - s2; break; }
      case 'highshelf': { const s2 = 2 * Math.sqrt(A) * al;
        b0 = A * ((A + 1) + (A - 1) * c + s2); b1 = -2 * A * ((A - 1) + (A + 1) * c); b2 = A * ((A + 1) + (A - 1) * c - s2);
        a0 = (A + 1) - (A - 1) * c + s2; a1 = 2 * ((A - 1) - (A + 1) * c); a2 = (A + 1) - (A - 1) * c - s2; break; }
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0; return this;
  }
  tick(x: number): number { const y = this.b0 * x + this.z1; this.z1 = this.b1 * x - this.a1 * y + this.z2; this.z2 = this.b2 * x - this.a2 * y; return y; }
}
export function filterWave(x: Wave, kind: BiquadKind, f: number, q = 0.707, gainDb = 0, fs = SR): Wave {
  const bq = new Biquad(kind, f, q, gainDb, fs), y = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = bq.tick(x[i]!);
  return y;
}

// ---------------------------------------------------------------- nonlinearities
export const sat = (x: number, drive = 1) => Math.tanh(x * drive);
/** West Coast sine wavefolder: smooth folding, harmonics grow with gain. */
export const sineFold = (x: number, gain: number) => Math.sin(x * gain * Math.PI / 2);
/** Triangle (Buchla-style) folder: piecewise-linear folds of the input. */
export function triFold(x: number, gain: number): number { const v = x * gain * 0.25 + 0.25; return 1 - 4 * Math.abs(v - Math.floor(v) - 0.5); }
/** Asymmetric soft clip, adds even harmonics like a driven tube stage. */
export const tube = (x: number, drive = 1, bias = 0.15) => Math.tanh(drive * (x + bias)) - Math.tanh(drive * bias);

// ---------------------------------------------------------------- noise
export function white(n: number, seed: number): Wave { const r = new Rng(seed), y = new Float64Array(n); for (let i = 0; i < n; i++) y[i] = r.bi(); return y; }
/** Paul Kellet's economy pink filter on seeded white noise. */
export function pink(n: number, seed: number): Wave {
  const r = new Rng(seed), y = new Float64Array(n); let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) { const w = r.bi(); b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; y[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
  return y;
}
export function brown(n: number, seed: number): Wave {
  const r = new Rng(seed), y = new Float64Array(n); let z = 0;
  for (let i = 0; i < n; i++) { z = z * 0.9985 + r.bi() * 0.04; y[i] = z; }
  return y;
}
/** Smooth seeded random walk in [-1,1], `rate` Hz bandwidth. */
export function drift(n: number, seed: number, rate: number, fs = SR): Wave {
  const r = new Rng(seed), y = new Float64Array(n), lp1 = new OnePole(rate, fs), lp2 = new OnePole(rate, fs);
  let peak = 1e-9; for (let i = 0; i < n; i++) { y[i] = lp2.lp(lp1.lp(r.bi())); peak = Math.max(peak, Math.abs(y[i]!)); }
  for (let i = 0; i < n; i++) y[i] = y[i]! / peak;
  return y;
}

// ---------------------------------------------------------------- delay lines and space
export class DelayLine {
  private buf: Float64Array; private w = 0;
  constructor(maxSamples: number) { this.buf = new Float64Array(Math.ceil(maxSamples) + 4); }
  write(x: number) { this.buf[this.w] = x; this.w = (this.w + 1) % this.buf.length; }
  /** Read `d` samples behind the most recent write, linear interpolation. */
  read(d: number): number {
    const n = this.buf.length, pos = this.w - 1 - d, i = Math.floor(pos), f = pos - i;
    const a = this.buf[((i % n) + n) % n]!, b = this.buf[(((i + 1) % n) + n) % n]!;
    return a + (b - a) * f;
  }
}
class Allpass {
  private line: DelayLine; private d: number; private g: number;
  constructor(d: number, g: number) { this.d = d; this.g = g; this.line = new DelayLine(d + 2); }
  tick(x: number): number { const z = this.line.read(this.d - 1), v = x + this.g * z; this.line.write(v); return z - this.g * v; }
}
export interface ReverbOptions { rt60: number; size?: number; damp?: number; predelayMs?: number; mod?: number; lowCut?: number; diffusion?: number; seed?: number }
/**
 * Eight-line feedback delay network: input diffusion, Householder feedback, per-line damping and slow
 * delay modulation on four lines (suppresses metallic ringing). Returns the wet signal only, stereo.
 */
export function fdnReverb(inL: Wave, inR: Wave, o: ReverbOptions, tailSeconds = o.rt60 * 1.1): [Wave, Wave] {
  const size = o.size ?? 1, damp = o.damp ?? 6000, rng = new Rng(o.seed ?? 77);
  const base = [1433, 1601, 1867, 2053, 2311, 2633, 2903, 3181];
  const lens = base.map((b, i) => Math.round(b * size * (1 + 0.02 * rng.bi())) + i);
  const N = lens.length, total = inL.length + Math.round(tailSeconds * SR);
  const lines = lens.map(l => new DelayLine(l + 80)), gains = lens.map(l => Math.pow(10, -3 * l / (o.rt60 * SR)));
  const dampers = lens.map(() => new OnePole(damp)), pre = new DelayLine(Math.round((o.predelayMs ?? 12) * SR / 1000) + 4);
  const pd = Math.round((o.predelayMs ?? 12) * SR / 1000);
  const dg = o.diffusion ?? 0.62;
  const diff = [142, 107, 379, 277, 211, 331].map((d, i) => new Allpass(Math.round(d * Math.max(0.5, size)), i % 2 ? -dg : dg));
  const modDepth = clamp(o.mod ?? 1, 0, 4) * 6, modRates = [0.31, 0.47, 0.23, 0.39].map(r => r * TAU / SR), modPh = [0, 1.7, 3.1, 4.4];
  const lc = new OnePole(o.lowCut ?? 120), lcR = new OnePole(o.lowCut ?? 120);
  const outL = new Float64Array(total), outR = new Float64Array(total), d = new Float64Array(N);
  const sgnL = [1, -1, 1, -1, 1, 1, -1, -1], sgnR = [1, 1, -1, -1, -1, 1, 1, -1];
  for (let t = 0; t < total; t++) {
    const x = t < inL.length ? 0.5 * (inL[t]! + inR[t]!) : 0;
    pre.write(x); let v = pd > 0 ? pre.read(pd - 1) : x;
    for (const ap of diff) v = ap.tick(v);
    let sum = 0;
    for (let i = 0; i < N; i++) {
      const m = i < 4 ? modDepth * Math.sin(modRates[i]! * t + modPh[i]!) : 0;
      d[i] = dampers[i]!.lp(lines[i]!.read(lens[i]! - 1 + modDepth + m)) * gains[i]!; sum += d[i]!;
    }
    const h = (2 / N) * sum;
    let l = 0, r = 0;
    for (let i = 0; i < N; i++) { const fb = d[i]! - h; lines[i]!.write(fb + v * (i % 2 ? -0.35 : 0.35)); l += d[i]! * sgnL[i]!; r += d[i]! * sgnR[i]!; }
    outL[t] = lc.hp(l * 0.35); outR[t] = lcR.hp(r * 0.35);
  }
  return [outL, outR];
}
/** Stereo ping-pong delay, wet only, damped feedback. */
export function pingPong(inL: Wave, inR: Wave, delaySec: number, feedback: number, damp = 4500, tailSeconds = 3, lowCut = 200): [Wave, Wave] {
  const d = Math.round(delaySec * SR), total = inL.length + Math.round(tailSeconds * SR);
  const a = new DelayLine(d + 4), b = new DelayLine(d + 4), la = new OnePole(damp), lb = new OnePole(damp), ha = new OnePole(lowCut), hb = new OnePole(lowCut);
  const L = new Float64Array(total), R = new Float64Array(total);
  for (let t = 0; t < total; t++) {
    const x = t < inL.length ? 0.5 * (inL[t]! + inR[t]!) : 0;
    const ya = a.read(d - 1), yb = b.read(d - 1);
    a.write(ha.hp(x + lb.lp(yb) * feedback)); b.write(la.lp(ya));
    L[t] = ya; R[t] = yb;
  }
  return [L, R];
}
/** Two-voice stereo chorus/ensemble, returns full (dry+wet) stereo. */
export function chorus(inL: Wave, inR: Wave, depthMs = 2.5, rate = 0.45, mix = 0.5, baseMs = 14): [Wave, Wave] {
  const n = inL.length, max = Math.round((baseMs + depthMs * 2) * SR / 1000) + 8;
  const dl = new DelayLine(max), dr = new DelayLine(max), L = new Float64Array(n), R = new Float64Array(n);
  for (let t = 0; t < n; t++) {
    dl.write(inL[t]!); dr.write(inR[t]!);
    const ml = (baseMs + depthMs * Math.sin(TAU * rate * t / SR)) * SR / 1000;
    const mr = (baseMs + depthMs * Math.sin(TAU * rate * t / SR + 2.1)) * SR / 1000;
    L[t] = inL[t]! * (1 - mix * 0.5) + dr.read(mr) * mix; R[t] = inR[t]! * (1 - mix * 0.5) + dl.read(ml) * mix;
  }
  return [L, R];
}

// ---------------------------------------------------------------- oversampling
function besselI0(x: number): number { let s = 1, t = 1; for (let k = 1; k <= 50; k++) { t *= (x / (2 * k)) ** 2; s += t; } return s; }
const firCache = new Map<number, Float64Array>();
/** Kaiser-windowed sinc low-pass for decimation by `os` (passband to ~19.5 kHz at 44.1 kHz output). */
function decimFir(os: number): Float64Array {
  const cached = firCache.get(os); if (cached) return cached;
  const taps = 64 * os + 1, mid = (taps - 1) / 2, fc = 0.442 / os, beta = 9, norm = besselI0(beta), h = new Float64Array(taps);
  let sum = 0;
  for (let i = 0; i < taps; i++) {
    const x = i - mid, s = x === 0 ? 2 * fc : Math.sin(TAU * fc * x) / (Math.PI * x), r = x / mid;
    h[i] = s * besselI0(beta * Math.sqrt(Math.max(0, 1 - r * r))) / norm; sum += h[i]!;
  }
  for (let i = 0; i < taps; i++) h[i] = h[i]! / sum;
  firCache.set(os, h); return h;
}
export function decimate(x: Wave, os: number): Wave {
  if (os === 1) return x;
  const h = decimFir(os), mid = (h.length - 1) / 2, n = Math.floor(x.length / os), y = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    const c = j * os; let acc = 0;
    for (let k = 0; k < h.length; k++) { const idx = c + k - mid; if (idx >= 0 && idx < x.length) acc += h[k]! * x[idx]!; }
    y[j] = acc;
  }
  return y;
}

// ---------------------------------------------------------------- utilities
export const zeros = (n: number) => new Float64Array(n);
export function addInto(dst: Wave, src: Wave, offset = 0, gain = 1) { for (let i = 0; i < src.length && i + offset < dst.length; i++) if (i + offset >= 0) dst[i + offset] += src[i]! * gain; }
export function scale(x: Wave, g: number): Wave { for (let i = 0; i < x.length; i++) x[i] = x[i]! * g; return x; }
export function peakOf(chs: Wave[]): number { let p = 0; for (const c of chs) for (let i = 0; i < c.length; i++) p = Math.max(p, Math.abs(c[i]!)); return p; }
export function dcBlock(x: Wave, cutoff = 12): Wave { const hp = new OnePole(cutoff), y = new Float64Array(x.length); for (let i = 0; i < x.length; i++) y[i] = hp.hp(x[i]!); return y; }
/** Raised-cosine fade at both ends so first and last frames are exactly zero. */
export function edgeFade(x: Wave, inSec = 0.0005, outSec = 0.004): Wave {
  const a = Math.max(1, Math.round(inSec * SR)), b = Math.max(2, Math.round(outSec * SR)), n = x.length;
  for (let i = 0; i < Math.min(a, n); i++) x[i] = x[i]! * (0.5 - 0.5 * Math.cos(Math.PI * i / a));
  for (let i = 0; i < Math.min(b, n); i++) x[n - 1 - i] = x[n - 1 - i]! * (0.5 - 0.5 * Math.cos(Math.PI * i / b));
  x[0] = 0; x[n - 1] = 0; return x;
}
/** Trim trailing near-silence (relative to peak) to keep assets small; keeps a short pad. */
export function trimTail(chs: Wave[], thresholdDb = -72, padSec = 0.05): Wave[] {
  const p = peakOf(chs), th = p * dbAmp(thresholdDb); let last = 0;
  for (const c of chs) for (let i = c.length - 1; i >= 0; i--) if (Math.abs(c[i]!) > th) { last = Math.max(last, i); break; }
  const n = Math.min(chs[0]!.length, last + Math.round(padSec * SR));
  return chs.map(c => c.slice(0, n));
}
export function encodeWav(chs: Wave[], gain: number): Buffer {
  const ch = chs.length, n = chs[0]!.length, data = Buffer.alloc(n * ch * 2), hdr = Buffer.alloc(44);
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const v = Math.round(chs[c]![i]! * gain * 32767);
    data.writeInt16LE(v < -32768 ? -32768 : v > 32767 ? 32767 : v, (i * ch + c) * 2);
  }
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12);
  hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(ch, 22); hdr.writeUInt32LE(SR, 24);
  hdr.writeUInt32LE(SR * ch * 2, 28); hdr.writeUInt16LE(ch * 2, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
  return Buffer.concat([hdr, data]);
}
