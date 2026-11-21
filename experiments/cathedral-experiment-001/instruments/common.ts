/**
 * CATHEDRAL EXPERIMENT · shared instrument plumbing (no audio files, no I/O).
 *
 * - The approved HEADLINER/MUTATION DSP primitives (polyBLEP oscillators, ZDF ladder and state-variable filters, the
 *   Kaiser decimator) are reused through the rack's hash-verified loader (studio-001/rack/frozen.ts): the frozen file
 *   is checked against its SHA-256 before it is imported and is never copied or edited.
 * - Everything new (sync oscillator, pipe and voice models, the Nave space) is original code written for this lab.
 * - Deterministic: seeded PRNGs only, no clock, no platform randomness.
 */
import { frozen } from '../../../studio-001/rack/frozen.ts';
import { RATE, curveAt, clamp, smooth } from '../../../studio-001/rack/curves.ts';
import type { ControlSpec, Curve, PartPerformance, RackInstrument } from '../../../studio-001/rack/types.ts';

export { RATE, curveAt, clamp, smooth };
export const LAB_VERSION = '0.1.0';
export type CathedralFamily = 'throne-volt' | 'cathedral-engine' | 'heaven-mass';
/** A rack instrument whose family is not one of the frozen ones (consumers treat the family as a plain string). */
export type LabInstrument = Omit<RackInstrument, 'family'> & { family: CathedralFamily };
export type Stereo = [Float64Array, Float64Array];
export const NOMINAL_RMS = 0.1; // -20 dBFS: the rack's calibration level for a reference note
export const TAU = 2 * Math.PI;

// ------------------------------------------------------------------ frozen DSP, typed view (hash-verified load)
export interface OscLike { phase: number; sine(f: number): number; saw(f: number): number; pulse(f: number, pw?: number): number; tri(f: number): number }
export interface LadderLike { set(cutoff: number): LadderLike; tick(x: number, k: number, drive?: number): number }
export interface SVFLike { set(cutoff: number, q: number): SVFLike; tick(x: number): number; lp: number; bp: number; hp: number; readonly bpn: number }
export interface OnePoleLike { set(cutoff: number): OnePoleLike; lp(x: number): number; hp(x: number): number }
export interface BiquadLike { set(kind: string, f: number, q?: number, gainDb?: number): BiquadLike; tick(x: number): number }
export interface LabDsp {
  Osc: new (phase?: number, fs?: number) => OscLike;
  Ladder: new (fs?: number) => LadderLike;
  SVF: new (fs?: number) => SVFLike;
  OnePole: new (cutoff: number, fs?: number) => OnePoleLike;
  Biquad: new (kind: string, f: number, q?: number, gainDb?: number, fs?: number) => BiquadLike;
  decimate(x: Float64Array, os: number): Float64Array;
  tube(x: number, drive?: number, bias?: number): number;
}
/** mutation-001/tools/dsp.ts, loaded only after the rack has verified every frozen engine file's hash. */
export async function labDsp(): Promise<LabDsp> { return (await frozen()).dsp as unknown as LabDsp; }

// ------------------------------------------------------------------ small helpers
export const spec = (name: string, min: number, max: number, description: string): ControlSpec => ({ name, min, max, description });
export const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
export const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
export const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
export const dbAmp = (db: number) => Math.pow(10, db / 20);
export const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
/** Deterministic PRNG (mulberry32): uniform in [0, 1). */
export function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => { let t = (s = (s + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function gaussOf(r: () => number): () => number {
  return () => Math.sqrt(-2 * Math.log(Math.max(1e-12, r()))) * Math.cos(TAU * r());
}
/** Stable 32-bit hash of a few integers (seed derivation that does not depend on call order). */
export function hashSeed(...xs: number[]): number {
  let h = 0x811c9dc5;
  for (const x of xs) { h ^= (Math.round(x * 1000) | 0); h = Math.imul(h, 0x01000193) >>> 0; h ^= h >>> 13; }
  return h >>> 0;
}

/**
 * Slow wander with unit standard deviation (an Ornstein-Uhlenbeck process stepped at control rate). `rateHz` sets
 * how fast it moves; values stay within about +-3.
 */
export class Wander {
  private x: number; private a: number; private s: number; private g: () => number;
  constructor(seed: number, rateHz: number, stepSeconds: number) {
    const r = mulberry(seed); this.g = gaussOf(r);
    const theta = TAU * rateHz; this.a = Math.exp(-theta * stepSeconds); this.s = Math.sqrt(1 - this.a * this.a);
    this.x = clamp(this.g(), -2.5, 2.5);
  }
  next(): number { this.x = clamp(this.a * this.x + this.s * this.g(), -3, 3); return this.x; }
}

/** Fast sine of a phase in cycles (4096-point table, linear interpolation: about -130 dB error). */
const SN = 4096, SIN = new Float64Array(SN + 1);
for (let i = 0; i <= SN; i++) SIN[i] = Math.sin(TAU * i / SN);
export function fsin(phaseCycles: number): number {
  const x = (phaseCycles - Math.floor(phaseCycles)) * SN, i = x | 0, f = x - i;
  return SIN[i]! + (SIN[i + 1]! - SIN[i]!) * f;
}

/** A control as a function of beats: the explicit curve, else the macro mapping plus an optional offset; clamped. */
export function controlAt(perf: PartPerformance, c: ControlSpec, byMacro: (m: number) => number): (beat: number) => number {
  const abs = perf.controls[c.name], off = perf.offsets[c.name];
  return beat => clamp(abs !== undefined ? curveAt(abs, beat) : byMacro(clamp(curveAt(perf.macro, beat), 0, 1)) + (off !== undefined ? curveAt(off, beat) : 0), c.min, c.max);
}
export const curveFn = (c: Curve) => (beat: number) => curveAt(c, beat);
/** Exponential map 0..1 -> lo..hi (for frequencies and times). */
export const expMap = (x: number, lo: number, hi: number) => lo * Math.pow(hi / lo, clamp(x, 0, 1));
/** Smoothstep window from a to b (0 below a, 1 above b). */
export const win = (x: number, a: number, b: number) => smooth((x - a) / Math.max(1e-9, b - a));

export function rmsOf(w: Float64Array, from: number, to: number): number {
  let s = 0; const e = Math.min(to, w.length);
  for (let i = Math.max(0, from); i < e; i++) s += w[i]! * w[i]!;
  return Math.sqrt(s / Math.max(1, e - from));
}
export const stereoRms = (st: Stereo, from: number, to: number) => Math.sqrt(0.5 * (rmsOf(st[0], from, to) ** 2 + rmsOf(st[1], from, to) ** 2));
/** Constant-power pan gains for pan in -1..1. */
export function panLR(pan: number): [number, number] { const a = (clamp(pan, -1, 1) + 1) * Math.PI / 4; return [Math.cos(a), Math.sin(a)]; }
/** Raised-cosine fades at both ends (first and last frame exactly zero). */
export function edgeFade(st: Stereo, inSec = 0.0008, outSec = 0.01): Stereo {
  const n = st[0].length, a = Math.max(1, Math.round(inSec * RATE)), b = Math.max(2, Math.round(outSec * RATE));
  for (const c of st) {
    for (let i = 0; i < Math.min(a, n); i++) c[i] = c[i]! * (0.5 - 0.5 * Math.cos(Math.PI * i / a));
    for (let i = 0; i < Math.min(b, n); i++) c[n - 1 - i] = c[n - 1 - i]! * (0.5 - 0.5 * Math.cos(Math.PI * i / b));
    if (n) { c[0] = 0; c[n - 1] = 0; }
  }
  return st;
}
/** One-pole DC blocker in place. */
export function dcBlock(x: Float64Array, cutoffHz = 8): Float64Array {
  const a = Math.exp(-TAU * cutoffHz / RATE); let xm = 0, ym = 0;
  for (let i = 0; i < x.length; i++) { const v = x[i]!; const y = v - xm + a * ym; xm = v; ym = y; x[i] = y; }
  return x;
}
export const blank = (frames: number): Stereo => [new Float64Array(frames), new Float64Array(frames)];

/** Cached calibration scale per instrument id: NOMINAL_RMS / RMS of a reference render window. */
const scaleCache = new Map<string, number>();
export async function calibrated(id: string, ref: () => Promise<Stereo>, fromSec: number, toSec: number): Promise<number> {
  let k = scaleCache.get(id);
  if (k === undefined) { const st = await ref(); k = NOMINAL_RMS / Math.max(1e-9, stereoRms(st, Math.round(fromSec * RATE), Math.round(toSec * RATE))); scaleCache.set(id, k); }
  return k;
}

// ------------------------------------------------------------------ simple filters used by the new code
/** Two-pole state-variable filter (Chamberlin-free TPT form), own copy so per-sample cutoff changes stay cheap. */
export class Tpt {
  private s1 = 0; private s2 = 0; private g = 0; private k = 1; private h = 1;
  lp = 0; bp = 0; hp = 0;
  set(cutoff: number, q: number, fs = RATE): this {
    this.g = Math.tan(Math.PI * clamp(cutoff, 5, fs * 0.47) / fs); this.k = 1 / Math.max(0.05, q); this.h = 1 / (1 + this.g * (this.g + this.k)); return this;
  }
  tick(x: number): number {
    const hp = (x - this.s1 * (this.g + this.k) - this.s2) * this.h, v1 = this.g * hp, bp = v1 + this.s1, v2 = this.g * bp, lp = v2 + this.s2;
    this.s1 = bp + v1; this.s2 = lp + v2; this.hp = hp; this.bp = bp; this.lp = lp; return lp;
  }
  /** Band-pass of the last tick normalised to unity gain at the centre frequency. */
  get bpn(): number { return this.k * this.bp; }
}
/** RBJ biquad (own copy; same cookbook as dsp.ts) with typed kinds. */
export class Bq {
  private b0 = 1; private b1 = 0; private b2 = 0; private a1 = 0; private a2 = 0; private z1 = 0; private z2 = 0;
  constructor(kind: 'lp' | 'hp' | 'bp' | 'peak' | 'lowshelf' | 'highshelf', f: number, q = 0.707, gainDb = 0, fs = RATE) { this.set(kind, f, q, gainDb, fs); }
  set(kind: 'lp' | 'hp' | 'bp' | 'peak' | 'lowshelf' | 'highshelf', f: number, q = 0.707, gainDb = 0, fs = RATE): this {
    const w = TAU * clamp(f, 5, fs * 0.49) / fs, c = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q), A = Math.pow(10, gainDb / 40);
    let b0 = 0, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;
    if (kind === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (kind === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (kind === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (kind === 'peak') { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; }
    else {
      const s2 = 2 * Math.sqrt(A) * al, sg = kind === 'lowshelf' ? 1 : -1;
      b0 = A * ((A + 1) - sg * (A - 1) * c + s2); b1 = sg * 2 * A * ((A - 1) - sg * (A + 1) * c); b2 = A * ((A + 1) - sg * (A - 1) * c - s2);
      a0 = (A + 1) + sg * (A - 1) * c + s2; a1 = -sg * 2 * ((A - 1) + sg * (A + 1) * c); a2 = (A + 1) + sg * (A - 1) * c - s2;
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0; return this;
  }
  tick(x: number): number { const y = this.b0 * x + this.z1; this.z1 = this.b1 * x - this.a1 * y + this.z2; this.z2 = this.b2 * x - this.a2 * y; return y; }
  run(x: Float64Array): Float64Array { for (let i = 0; i < x.length; i++) x[i] = this.tick(x[i]!); return x; }
}

// ------------------------------------------------------------------ the Nave: an original large-space model
/**
 * Stone-nave space (wet only): pre-delay, twenty early reflections that keep the source's side, then a 16-line
 * feedback delay network (Hadamard mixing, per-line damping, a low-frequency loop cut so the tail never booms,
 * slow delay modulation on four lines against metallic ringing). The tail is high-passed at `lowCut` and its
 * width is adjustable, so a long cathedral decay can sit above a trap 808 instead of on top of it.
 */
export interface NaveOptions {
  rt60: number; size?: number; predelayMs?: number; lowCut?: number; damp?: number; loopLowCut?: number;
  early?: number; late?: number; width?: number; seed?: number;
}
const NAVE_LINES = [1103, 1307, 1499, 1693, 1879, 2083, 2287, 2503, 2711, 2909, 3119, 3329, 3541, 3739, 3947, 4157];
const ER_L: [number, number, number][] = [[11.3, 0.62, 0], [19.7, 0.5, 1], [27.1, 0.47, 0], [35.9, 0.38, 0], [44.3, 0.34, 1], [53.9, 0.3, 0], [61.7, 0.26, 1], [72.1, 0.22, 0], [83.3, 0.19, 1], [97.1, 0.15, 0]];
const ER_R: [number, number, number][] = [[13.9, 0.6, 1], [21.1, 0.52, 0], [29.3, 0.45, 1], [38.3, 0.37, 1], [46.1, 0.33, 0], [57.7, 0.29, 1], [64.9, 0.25, 0], [75.7, 0.21, 1], [88.9, 0.18, 0], [101.3, 0.14, 1]];
export function nave(inL: Float64Array, inR: Float64Array, o: NaveOptions): Stereo {
  const n = inL.length, size = o.size ?? 1.4, rng = mulberry(o.seed ?? 4099);
  const pre = Math.max(1, Math.round((o.predelayMs ?? 40) * RATE / 1000));
  const LEN = NAVE_LINES.map((b, i) => Math.round(b * size * (1 + 0.015 * (rng() * 2 - 1))) + i);
  const N = LEN.length, maxLen = Math.max(...LEN) + 128;
  let cap = 1; while (cap < maxLen) cap <<= 1;
  const MASK = cap - 1, buf = LEN.map(() => new Float64Array(cap)), gain = LEN.map(l => Math.pow(10, -3 * l / (o.rt60 * RATE)));
  const dampA = Math.exp(-TAU * (o.damp ?? 5200) / RATE), loopA = Math.exp(-TAU * (o.loopLowCut ?? 70) / RATE);
  const dz = new Float64Array(N), lz = new Float64Array(N), lx = new Float64Array(N);
  // pre-delay + early reflections share one stereo ring buffer
  const erMax = Math.round((Math.max(...ER_L.map(e => e[0]), ...ER_R.map(e => e[0])) * size + 4) * RATE / 1000) + pre + 4;
  let ecap = 1; while (ecap < erMax) ecap <<= 1;
  const EM = ecap - 1, eL = new Float64Array(ecap), eR = new Float64Array(ecap);
  const tapsL = ER_L.map(([ms, g, src]) => [pre + Math.round(ms * size * RATE / 1000), g, src] as [number, number, number]);
  const tapsR = ER_R.map(([ms, g, src]) => [pre + Math.round(ms * size * RATE / 1000), g, src] as [number, number, number]);
  const erLp = [Math.exp(-TAU * 7000 / RATE), 0, 0]; let erl = 0, err = 0;
  // input diffusion: two allpasses per channel
  const apLen = [149, 211, 163, 227].map(x => Math.round(x * Math.max(0.6, size))), apBuf = apLen.map(l => new Float64Array(l)), apPos = [0, 0, 0, 0];
  const ap = (k: number, x: number, g: number) => { const b = apBuf[k]!, p = apPos[k]!, z = b[p]!, v = x + g * z; b[p] = v; apPos[k] = (p + 1) % b.length; return z - g * v; };
  const modRate = [0.11, 0.17, 0.23, 0.31].map(r => TAU * r / RATE), modPh = [0, 1.3, 2.9, 4.1].map(p => p + rng()), modDepth = 0.0006 * RATE * size;
  const sgnL = [1, -1, 1, -1, 1, 1, -1, -1, 1, -1, -1, 1, -1, 1, 1, -1], sgnR = [1, 1, -1, -1, -1, 1, 1, -1, -1, -1, 1, 1, 1, 1, -1, -1];
  const early = o.early ?? 0.55, late = o.late ?? 1, width = clamp(o.width ?? 1, 0, 1.5);
  const outL = new Float64Array(n), outR = new Float64Array(n), y = new Float64Array(N);
  let w = 0, ew = 0;
  for (let t = 0; t < n; t++) {
    eL[ew] = inL[t]!; eR[ew] = inR[t]!;
    const dL = eL[(ew - pre) & EM]!, dR = eR[(ew - pre) & EM]!;
    let el = 0, er = 0;
    for (const [d, g, src] of tapsL) el += g * (src ? eR : eL)[(ew - d) & EM]!;
    for (const [d, g, src] of tapsR) er += g * (src ? eL : eR)[(ew - d) & EM]!;
    erl = el + (erl - el) * erLp[0]!; err = er + (err - er) * erLp[0]!;
    ew = (ew + 1) & EM;
    // late network input: pre-delayed dry plus a little of the early field, diffused per side
    const xl = ap(1, ap(0, dL + 0.3 * erl, 0.62), -0.62), xr = ap(3, ap(2, dR + 0.3 * err, 0.62), -0.62);
    for (let i = 0; i < N; i++) {
      let d = LEN[i]!;
      if (i < 4) d += modDepth * (1 + Math.sin(modRate[i]! * t + modPh[i]!));
      const pos = w - d, j = Math.floor(pos), f = pos - j, b = buf[i]!;
      let v = b[j & MASK]! * (1 - f) + b[(j + 1) & MASK]! * f;
      dz[i] = v + (dz[i]! - v) * dampA; v = dz[i]!;                 // high damping
      lz[i] = v + (lz[i]! - v) * loopA; v = v - lz[i]!;              // low cut inside the loop
      y[i] = v * gain[i]!;
    }
    // Hadamard 16 (fast Walsh-Hadamard), normalised
    for (let i = 0; i < N; i++) lx[i] = y[i]!;
    for (let h = 1; h < N; h <<= 1) for (let i = 0; i < N; i += h << 1) for (let j = i; j < i + h; j++) { const a = lx[j]!, b = lx[j + h]!; lx[j] = a + b; lx[j + h] = a - b; }
    let l = 0, r = 0;
    for (let i = 0; i < N; i++) {
      buf[i]![w & MASK] = lx[i]! * 0.25 + (i % 2 ? xr : xl) * 0.42;
      l += y[i]! * sgnL[i]!; r += y[i]! * sgnR[i]!;
    }
    w = (w + 1) & MASK;
    const L = early * erl + late * 0.3 * l, R = early * err + late * 0.3 * r, M = 0.5 * (L + R), S = 0.5 * (L - R) * width;
    outL[t] = M + S; outR[t] = M - S;
  }
  const lc = o.lowCut ?? 160, hl = new Bq('hp', lc, 0.6), hr = new Bq('hp', lc, 0.6), ll = new Bq('lp', Math.min(16000, (o.damp ?? 5200) * 1.8), 0.6), lr = new Bq('lp', Math.min(16000, (o.damp ?? 5200) * 1.8), 0.6);
  for (let t = 0; t < n; t++) { outL[t] = ll.tick(hl.tick(outL[t]!)); outR[t] = lr.tick(hr.tick(outR[t]!)); }
  return [outL, outR];
}
