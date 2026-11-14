/**
 * DAEMON//CRUSH v1: an opt-in, one-knob saturation and dynamics stage for stems, buses and masters.
 *
 * Original DSP written for this lab. It is not a model, clone or measurement of any plugin or hardware unit. The
 * only thing borrowed is the general workflow of "one knob that makes it fatter". Nothing in the engine, the rack
 * or the frozen instrument sources imports this file; a caller has to ask for it.
 *
 * Signal path (4x oversampled, zero latency, deterministic, no randomness):
 *
 *   1. DRIVE    Linkwitz-Riley split into three bands (150 Hz, 2.5 kHz). Each band has its own level-normalised
 *               shaper: a peak at the reference level stays where it is and everything under it is lifted. The
 *               low band is driven for sustain, the mid band hardest (body and growl), the top barely, so hats
 *               and air keep their place in the balance and the sub does not intermodulate with the mids.
 *   2. SQUEEZE  One stereo-linked feed-forward compressor on the recombined signal with a slow attack. The attack
 *               lets the front of each hit through; the release makes the bus breathe between hits.
 *   3. CLIP     A soft-knee clipper at the ceiling shaves the fronts the compressor let through.
 *
 * Calibration: the thresholds are fixed, so the input should peak near `referenceDb` (default -3 dBFS).
 * `amount` 0 returns the input unchanged (bit-exact copy). Stages can be switched off individually for ablation.
 */
export const SR = 44100;
export const OS = 4;
export type Stereo = [Float64Array, Float64Array];

export interface CrushOptions {
  /** the one knob, 0..1 */
  amount: number;
  /** clip ceiling in dBFS (sample peak at the oversampled rate), default -1 */
  ceilingDb?: number;
  /** the sample peak the input was calibrated to, dBFS, default -3 */
  referenceDb?: number;
  /** ablation switches, all default true */
  drive?: boolean; squeeze?: boolean; clip?: boolean;
}
export interface CrushReport {
  amount: number; ceilingDb: number;
  /** resolved internal settings, so a render can be reproduced and reasoned about */
  settings: { splitHz: [number, number]; lowDriveDb: number; midDriveDb: number; highDriveDb: number; thresholdDb: number; ratio: number; attackMs: number; releaseMs: number; makeupDb: number };
  /** deepest and mean gain reduction of the compressor, dB */
  maxReductionDb: number; meanReductionDb: number;
  /** share of oversampled samples above the clipper knee, and the deepest shave in dB */
  clippedShare: number; maxShaveDb: number;
}

const dbAmp = (db: number) => Math.pow(10, db / 20);
const ampDb = (a: number) => (a > 0 ? 20 * Math.log10(a) : -Infinity);

// ---------------------------------------------------------------- resampling (linear phase, centred: no latency)
function besselI0(x: number): number { let s = 1, t = 1; for (let k = 1; k <= 60; k++) { t *= (x / (2 * k)) ** 2; s += t; } return s; }
const firCache = new Map<number, Float64Array>();
/** Kaiser-windowed sinc low-pass for an `os`-times rate change: flat to about 19.5 kHz, stop band beyond -100 dB. */
export function resampleFir(os: number): Float64Array {
  const hit = firCache.get(os); if (hit) return hit;
  const taps = 96 * os + 1, mid = (taps - 1) / 2, fc = 0.45 / os, beta = 10.5, norm = besselI0(beta), h = new Float64Array(taps);
  let sum = 0;
  for (let i = 0; i < taps; i++) {
    const x = i - mid, s = x === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * x) / (Math.PI * x), r = x / mid;
    h[i] = s * besselI0(beta * Math.sqrt(Math.max(0, 1 - r * r))) / norm; sum += h[i]!;
  }
  for (let i = 0; i < taps; i++) h[i] = h[i]! / sum;
  firCache.set(os, h); return h;
}
/** Zero-stuff and low-pass: output frame m*os is time-aligned with input frame m. */
export function upsample(x: Float64Array, os: number): Float64Array {
  if (os === 1) return x.slice();
  const h = resampleFir(os), mid = (h.length - 1) / 2, n = x.length, y = new Float64Array(n * os);
  for (let m = 0; m < y.length; m++) {
    // y[m] = os * sum_j h[j] * xz[m + mid - j], xz non-zero only where (m + mid - j) % os === 0
    let acc = 0;
    for (let j = (m + mid) % os; j < h.length; j += os) { const i = (m + mid - j) / os; if (i >= 0 && i < n) acc += h[j]! * x[i]!; }
    y[m] = acc * os;
  }
  return y;
}
export function downsample(y: Float64Array, os: number): Float64Array {
  if (os === 1) return y.slice();
  const h = resampleFir(os), mid = (h.length - 1) / 2, n = Math.floor(y.length / os), x = new Float64Array(n);
  for (let m = 0; m < n; m++) {
    const c = m * os; let acc = 0;
    const a = Math.max(0, mid - c), z = Math.min(h.length, y.length - c + mid);
    for (let k = a; k < z; k++) acc += h[k]! * y[c + k - mid]!;
    x[m] = acc;
  }
  return x;
}

// ---------------------------------------------------------------- filters
/** RBJ Butterworth section (Q = 1/sqrt 2), transposed direct form II. */
class Bq {
  private b0 = 1; private b1 = 0; private b2 = 0; private a1 = 0; private a2 = 0; private z1 = 0; private z2 = 0;
  constructor(kind: 'lp' | 'hp', f: number, fs: number) {
    const w = 2 * Math.PI * f / fs, c = Math.cos(w), al = Math.sin(w) / (2 * Math.SQRT1_2), a0 = 1 + al;
    if (kind === 'lp') { this.b0 = (1 - c) / 2 / a0; this.b1 = (1 - c) / a0; this.b2 = this.b0; }
    else { this.b0 = (1 + c) / 2 / a0; this.b1 = -(1 + c) / a0; this.b2 = this.b0; }
    this.a1 = -2 * c / a0; this.a2 = (1 - al) / a0;
  }
  tick(x: number): number { const y = this.b0 * x + this.z1; this.z1 = this.b1 * x - this.a1 * y + this.z2; this.z2 = this.b2 * x - this.a2 * y; return y; }
}
/** Fourth-order Linkwitz-Riley pair: low + high sums to an all-pass of the input (flat magnitude). */
class Lr4 {
  private l1: Bq; private l2: Bq; private h1: Bq; private h2: Bq; low = 0; high = 0;
  constructor(f: number, fs: number) { this.l1 = new Bq('lp', f, fs); this.l2 = new Bq('lp', f, fs); this.h1 = new Bq('hp', f, fs); this.h2 = new Bq('hp', f, fs); }
  tick(x: number) { this.low = this.l2.tick(this.l1.tick(x)); this.high = this.h2.tick(this.h1.tick(x)); }
}
class DcBlock {
  private x1 = 0; private y1 = 0; private r: number;
  constructor(f: number, fs: number) { this.r = Math.exp(-2 * Math.PI * f / fs); }
  tick(x: number): number { const y = x - this.x1 + this.r * this.y1; this.x1 = x; this.y1 = y; return y; }
}

// ---------------------------------------------------------------- nonlinearities
/**
 * Level-normalised asymmetric shaper on a signal scaled so the reference peak is 1. g = 0 is the identity. For
 * g > 0 a peak at 1 stays at or under 1 on both sides and the small-signal gain is about g / tanh(g): quiet
 * material comes up under an unchanged peak. The bias makes the two half-waves differ (even harmonics); the DC it
 * creates is removed by the caller.
 */
export function shaper(g: number, bias: number): (u: number) => number {
  if (g <= 1e-9) return u => u;
  const off = Math.tanh(g * bias), norm = 1 / (Math.tanh(g * (1 - bias)) + off); // the larger (negative) side maps to -1
  return u => (Math.tanh(g * (u + bias)) - off) * norm;
}
/** Linear below the knee, then a tanh shoulder that never exceeds 1. Continuous slope at the knee. */
export function softClip(u: number, knee: number): number {
  const a = Math.abs(u); if (a <= knee) return u;
  const y = knee + (1 - knee) * Math.tanh((a - knee) / (1 - knee));
  return u < 0 ? -y : y;
}

/** The one-knob mapping. Everything the processor does is a function of `amount`, the reference and the ceiling. */
export function crushSettings(amount: number) {
  const a = Math.min(1, Math.max(0, amount));
  return {
    splitLowHz: 150, splitHighHz: 2500,
    lowG: 3.2 * a, lowBias: 0.12,          // sub and bass: sustain, mostly 2nd and 3rd harmonic
    midG: 3.4 * a, midBias: 0.08,          // body and growl: the crunch
    highG: 0.9 * a, highBias: 0,           // top: nearly clean
    thresholdUnderRefDb: 3 + 9 * a, ratio: 1 + 4 * a, kneeDb: 6,
    attackMs: 14, releaseMs: 120,
    makeupShare: 0.65,                     // share of the static reduction at the reference peak given back as make-up
    clipKnee: 0.62,
  };
}
const smallSignalDb = (g: number, bias: number) => (g <= 1e-9 ? 0 : ampDb(g * (1 - Math.tanh(g * bias) ** 2) / (Math.tanh(g * (1 - bias)) + Math.tanh(g * bias))));

/** Process a stereo buffer (floats in +/-1). Returns new buffers of the same length; the input is not modified. */
export function crush(input: Stereo, options: CrushOptions): { audio: Stereo; report: CrushReport } {
  const amount = Math.min(1, Math.max(0, options.amount)), ceilingDb = options.ceilingDb ?? -1, s = crushSettings(amount);
  const referenceDb = options.referenceDb ?? -3, thresholdDb = referenceDb - s.thresholdUnderRefDb;
  if (!(ceilingDb <= 0 && ceilingDb >= -24)) throw new RangeError('ceilingDb must be -24..0');
  if (!(referenceDb <= 0 && referenceDb >= -24)) throw new RangeError('referenceDb must be -24..0');
  const makeupDb = s.makeupShare * (1 - 1 / s.ratio) * s.thresholdUnderRefDb;
  const report: CrushReport = {
    amount, ceilingDb,
    settings: { splitHz: [s.splitLowHz, s.splitHighHz], lowDriveDb: +smallSignalDb(s.lowG, s.lowBias).toFixed(2), midDriveDb: +smallSignalDb(s.midG, s.midBias).toFixed(2), highDriveDb: +smallSignalDb(s.highG, s.highBias).toFixed(2),
      thresholdDb: +thresholdDb.toFixed(2), ratio: +s.ratio.toFixed(2), attackMs: s.attackMs, releaseMs: s.releaseMs, makeupDb: +makeupDb.toFixed(2) },
    maxReductionDb: 0, meanReductionDb: 0, clippedShare: 0, maxShaveDb: 0,
  };
  if (amount === 0) return { audio: [input[0].slice(), input[1].slice()], report };
  const useDrive = options.drive !== false, useSqueeze = options.squeeze !== false, useClip = options.clip !== false;
  const fs = SR * OS, n = input[0].length * OS;
  const hi = [upsample(input[0], OS), upsample(input[1], OS)];

  // 1. DRIVE
  if (useDrive) {
    const ref = dbAmp(referenceDb), lowShape = shaper(s.lowG, s.lowBias), midShape = shaper(s.midG, s.midBias), highShape = shaper(s.highG, s.highBias);
    for (const ch of hi) {
      const x1 = new Lr4(s.splitLowHz, fs), x2 = new Lr4(s.splitHighHz, fs), dcL = new DcBlock(8, fs), dcM = new DcBlock(8, fs);
      for (let i = 0; i < n; i++) {
        x1.tick(ch[i]! / ref); x2.tick(x1.high);
        ch[i] = ref * (dcL.tick(lowShape(x1.low)) + dcM.tick(midShape(x2.low)) + highShape(x2.high));
      }
    }
  }
  // 2. SQUEEZE (stereo-linked, log domain, smoothed gain reduction)
  if (useSqueeze) {
    const att = 1 - Math.exp(-1 / (s.attackMs * fs / 1000)), rel = 1 - Math.exp(-1 / (s.releaseMs * fs / 1000));
    const T = thresholdDb, slope = 1 - 1 / s.ratio, W = s.kneeDb, mk = dbAmp(makeupDb), L = hi[0]!, R = hi[1]!;
    let gr = 0, sum = 0, max = 0;
    for (let i = 0; i < n; i++) {
      const lvl = ampDb(Math.max(Math.abs(L[i]!), Math.abs(R[i]!), 1e-9)), over = lvl - T;
      const target = over <= -W / 2 ? 0 : over >= W / 2 ? slope * over : slope * (over + W / 2) ** 2 / (2 * W);
      gr += (target - gr) * (target > gr ? att : rel);
      const g = dbAmp(-gr) * mk; L[i] = L[i]! * g; R[i] = R[i]! * g;
      sum += gr; if (gr > max) max = gr;
    }
    report.maxReductionDb = +max.toFixed(2); report.meanReductionDb = +(sum / n).toFixed(2);
  }
  // 3. CLIP
  if (useClip) {
    const c = dbAmp(ceilingDb); let over = 0, shave = 0;
    for (const ch of hi) for (let i = 0; i < n; i++) {
      const u = ch[i]! / c, y = softClip(u, s.clipKnee);
      if (y !== u) { over++; const d = ampDb(Math.abs(u)) - ampDb(Math.abs(y)); if (d > shave) shave = d; }
      ch[i] = y * c;
    }
    report.clippedShare = +(over / (2 * n)).toFixed(5); report.maxShaveDb = +shave.toFixed(2);
  }
  return { audio: [downsample(hi[0]!, OS), downsample(hi[1]!, OS)], report };
}
