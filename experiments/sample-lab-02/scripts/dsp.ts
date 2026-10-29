/** SAMPLE LAB 02 offline DSP: the "recording equipment" that makes the original sources, plus the two operations the
 * engine does not have (reverse playback and pitch-preserving time stretch). Everything the engine can do itself
 * (repitching, slicing, gates, envelopes, chokes, glides, filters, delay, reverb, saturation) is left to the engine.
 *
 * Node built-ins only, float64, explicit xorshift32 seeds; no input files, recordings or network. Math.sin/exp/pow are
 * the only transcendental functions used, so a fixed Node version reproduces every byte (checked by the build). */
import { createHash } from 'node:crypto';

export const RATE = 44100, TAU = 2 * Math.PI;
export type Wave = Float64Array;
export const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
export const frames = (seconds: number) => Math.round(seconds * RATE);
export const db = (x: number) => 10 ** (x / 20);
export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

// ---------------------------------------------------------------- randomness
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
/** Standard normal deviates (Box-Muller) from a uniform source. */
export function gaussian(rand: () => number): () => number {
  return () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(TAU * rand());
}
/** White noise, uniform in [-1, 1). */
export function noise(n: number, rand: () => number): Wave {
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = 2 * rand() - 1;
  return x;
}
/** Smooth random curve in [-1, 1]: cosine interpolation between random points `step` seconds apart. */
export function wander(n: number, step: number, rand: () => number): Wave {
  const k = Math.max(1, Math.round(step * RATE)), points = Array.from({ length: Math.ceil(n / k) + 2 }, () => 2 * rand() - 1);
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const p = Math.floor(i / k), f = (i - p * k) / k, w = 0.5 - 0.5 * Math.cos(Math.PI * f);
    x[i] = points[p]! * (1 - w) + points[p + 1]! * w;
  }
  return x;
}

// ---------------------------------------------------------------- filters
export function onePoleLow(x: Wave, cutoff: number): Wave {
  const a = Math.exp(-TAU * cutoff / RATE), y = new Float64Array(x.length);
  let z = 0;
  for (let i = 0; i < x.length; i++) y[i] = z = (1 - a) * x[i]! + a * z;
  return y;
}
export function onePoleHigh(x: Wave, cutoff: number): Wave {
  const low = onePoleLow(x, cutoff), y = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = x[i]! - low[i]!;
  return y;
}
export interface Biquad { b0: number; b1: number; b2: number; a1: number; a2: number }
/** RBJ cookbook biquads. `bandpass` has 0 dB peak gain. */
export const bq = {
  lowpass(f: number, q = Math.SQRT1_2): Biquad { const w = TAU * f / RATE, c = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al; return { b0: (1 - c) / 2 / a0, b1: (1 - c) / a0, b2: (1 - c) / 2 / a0, a1: -2 * c / a0, a2: (1 - al) / a0 }; },
  highpass(f: number, q = Math.SQRT1_2): Biquad { const w = TAU * f / RATE, c = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al; return { b0: (1 + c) / 2 / a0, b1: -(1 + c) / a0, b2: (1 + c) / 2 / a0, a1: -2 * c / a0, a2: (1 - al) / a0 }; },
  bandpass(f: number, q: number): Biquad { const w = TAU * f / RATE, c = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al; return { b0: al / a0, b1: 0, b2: -al / a0, a1: -2 * c / a0, a2: (1 - al) / a0 }; },
  peak(f: number, q: number, gainDb: number): Biquad { const A = 10 ** (gainDb / 40), w = TAU * f / RATE, c = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al / A; return { b0: (1 + al * A) / a0, b1: -2 * c / a0, b2: (1 - al * A) / a0, a1: -2 * c / a0, a2: (1 - al / A) / a0 }; },
};
export function filter(x: Wave, ...stages: Biquad[]): Wave {
  let y: Wave = x;
  for (const s of stages) {
    const out = new Float64Array(y.length);
    let z1 = 0, z2 = 0;
    for (let i = 0; i < y.length; i++) {
      const v = y[i]!, o = s.b0 * v + z1;
      z1 = s.b1 * v - s.a1 * o + z2; z2 = s.b2 * v - s.a2 * o; out[i] = o;
    }
    y = out;
  }
  return y;
}
/** Klatt's two-pole digital resonator with per-sample frequency and bandwidth (unity gain at DC). */
export function resonator(x: Wave, freq: (i: number) => number, bw: (i: number) => number): Wave {
  const y = new Float64Array(x.length);
  let y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const r = Math.exp(-Math.PI * bw(i) / RATE), B = 2 * r * Math.cos(TAU * freq(i) / RATE), C = -r * r, A = 1 - B - C;
    const o = A * x[i]! + B * y1 + C * y2; y2 = y1; y1 = o; y[i] = o;
  }
  return y;
}
/** Klatt's anti-resonator (two zeros), unity gain at DC. */
export function antiResonator(x: Wave, freq: (i: number) => number, bw: (i: number) => number): Wave {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0;
  for (let i = 0; i < x.length; i++) {
    const r = Math.exp(-Math.PI * bw(i) / RATE), B = 2 * r * Math.cos(TAU * freq(i) / RATE), C = -r * r, A = 1 - B - C;
    y[i] = (x[i]! - B * x1 - C * x2) / A; x2 = x1; x1 = x[i]!;
  }
  return y;
}

// ---------------------------------------------------------------- spectral tools
const twiddles = new Map<number, { cos: Float64Array; sin: Float64Array; rev: Uint32Array }>();
function plan(n: number) {
  let p = twiddles.get(n);
  if (!p) {
    const bits = Math.log2(n), rev = new Uint32Array(n), cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
    if (!Number.isInteger(bits)) throw new RangeError(`FFT size ${n} is not a power of two`);
    for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r >>> 0; }
    for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos(TAU * i / n); sin[i] = Math.sin(TAU * i / n); }
    p = { cos, sin, rev }; twiddles.set(n, p);
  }
  return p;
}
/** In-place iterative radix-2 FFT. The inverse is scaled by 1/n. */
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length, { cos, sin, rev } = plan(n), sign = inverse ? 1 : -1;
  for (let i = 0; i < n; i++) { const j = rev[i]!; if (j > i) { [re[i], re[j]] = [re[j]!, re[i]!]; [im[i], im[j]] = [im[j]!, im[i]!]; } }
  for (let size = 2; size <= n; size *= 2) {
    const half = size / 2, step = n / size;
    for (let start = 0; start < n; start += size) for (let k = 0; k < half; k++) {
      const wr = cos[k * step]!, wi = sign * sin[k * step]!, a = start + k, b = a + half;
      const tr = re[b]! * wr - im[b]! * wi, ti = re[b]! * wi + im[b]! * wr;
      re[b] = re[a]! - tr; im[b] = im[a]! - ti; re[a]! += tr; im[a]! += ti;
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i]! /= n; im[i]! /= n; }
}
const pow2 = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(2, n)));
/** Single-sideband frequency shift (what a mistuned SSB receiver does to a voice): every component moves by
 * `shift(i)` Hz, so harmonics stop being multiples of the fundamental. Analytic signal via FFT, zero-padded. */
export function frequencyShift(x: Wave, shift: (i: number) => number): Wave {
  const n = pow2(x.length * 2), re = new Float64Array(n), im = new Float64Array(n);
  re.set(x); fft(re, im);
  for (let k = 1; k < n / 2; k++) { re[k]! *= 2; im[k]! *= 2; }
  for (let k = n / 2 + 1; k < n; k++) { re[k] = 0; im[k] = 0; }
  fft(re, im, true);
  const y = new Float64Array(x.length);
  let phase = 0;
  for (let i = 0; i < x.length; i++) {
    y[i] = re[i]! * Math.cos(phase) - im[i]! * Math.sin(phase);
    phase += TAU * shift(i) / RATE; if (phase > Math.PI) phase -= TAU; if (phase < -Math.PI) phase += TAU;
  }
  return y;
}
/** Pitch-preserving time stretch: a phase vocoder with identity phase locking (Laroche and Dolson). `factor` > 1 makes
 * the sound longer. Transients smear, which is the point here: it is "slow motion", not a clean studio stretch. */
export function stretch(input: Wave, factor: number, n = 4096): Wave {
  const hs = n / 8, ha = hs / factor, half = n / 2, x = new Float64Array(input.length + n);
  x.set(input);
  const win = new Float64Array(n); for (let i = 0; i < n; i++) win[i] = 0.5 - 0.5 * Math.cos(TAU * i / n);
  const count = Math.max(1, Math.floor((x.length - n) / ha) + 1), out = new Float64Array(count * hs + n), norm = new Float64Array(out.length);
  const prev = new Float64Array(half + 1), synth = new Float64Array(half + 1), mag = new Float64Array(half + 1), ph = new Float64Array(half + 1);
  const re = new Float64Array(n), im = new Float64Array(n);
  let prevPos = 0;
  for (let m = 0; m < count; m++) {
    const pos = Math.round(m * ha);
    for (let i = 0; i < n; i++) { re[i] = (x[pos + i] ?? 0) * win[i]!; im[i] = 0; }
    fft(re, im);
    for (let k = 0; k <= half; k++) { mag[k] = Math.hypot(re[k]!, im[k]!); ph[k] = Math.atan2(im[k]!, re[k]!); }
    if (m === 0) synth.set(ph);
    else {
      const step = pos - prevPos;
      // Peaks carry the phase advance of their measured frequency; every other bin keeps its phase offset to its peak.
      const peaks: number[] = [];
      for (let k = 2; k < half - 1; k++) if (mag[k]! > mag[k - 1]! && mag[k]! >= mag[k + 1]! && mag[k]! > mag[k - 2]! && mag[k]! >= mag[k + 2]!) peaks.push(k);
      if (!peaks.length) peaks.push(1);
      const advanced = new Float64Array(half + 1);
      for (const k of peaks) {
        const omega = TAU * k / n;
        let d = ph[k]! - prev[k]! - omega * step; d -= TAU * Math.round(d / TAU);
        advanced[k] = synth[k]! + (omega + (step ? d / step : 0)) * hs;
      }
      let p = 0;
      for (let k = 0; k <= half; k++) {
        while (p + 1 < peaks.length && Math.abs(peaks[p + 1]! - k) < Math.abs(peaks[p]! - k)) p++;
        const peak = peaks[p]!;
        synth[k] = advanced[peak]! + ph[k]! - ph[peak]!;
      }
    }
    prev.set(ph); prevPos = pos;
    for (let k = 0; k <= half; k++) { re[k] = mag[k]! * Math.cos(synth[k]!); im[k] = mag[k]! * Math.sin(synth[k]!); }
    for (let k = 1; k < half; k++) { re[n - k] = re[k]!; im[n - k] = -im[k]!; }
    fft(re, im, true);
    const at = m * hs;
    for (let i = 0; i < n; i++) { out[at + i]! += re[i]! * win[i]!; norm[at + i]! += win[i]! * win[i]!; }
  }
  for (let i = 0; i < out.length; i++) out[i] = norm[i]! > 1e-3 ? out[i]! / norm[i]! : 0;
  return out.slice(0, Math.round(input.length * factor));
}
export function reverse(x: Wave): Wave { return Float64Array.from(x).reverse(); }

// ---------------------------------------------------------------- space
export interface SpaceOptions {
  rt60: number;            // seconds to -60 dB
  size: number;            // scales the delay lines (1 = a small room)
  damping: number;         // 0..0.9: high frequencies decay faster
  predelayMs: number;
  early: [ms: number, left: number, right: number][]; // discrete early reflections
  flutter?: { ms: number; feedback: number };        // parallel-wall flutter echo on the early field
}
/** A stereo room: discrete early reflections (optionally ringing as a flutter echo) into an 8-line feedback delay
 * network with a Hadamard mix and per-line damping. Returns the wet field only. */
export function space(x: Wave, o: SpaceOptions, tailSeconds = o.rt60): [Wave, Wave] {
  const n = x.length + frames(tailSeconds + o.predelayMs / 1000 + 0.05), L = new Float64Array(n), R = new Float64Array(n);
  const pre = frames(o.predelayMs / 1000), erL = new Float64Array(n), erR = new Float64Array(n);
  for (const [ms, gl, gr] of o.early) {
    const d = pre + frames(ms / 1000);
    for (let i = 0; i < x.length && i + d < n; i++) { erL[i + d]! += gl * x[i]!; erR[i + d]! += gr * x[i]!; }
  }
  if (o.flutter) for (const er of [erL, erR]) {
    const d = frames(o.flutter.ms / 1000); let lp = 0;
    for (let i = d; i < n; i++) { lp = 0.7 * lp + 0.3 * er[i - d]!; er[i]! += o.flutter.feedback * lp; }
  }
  const base = [1031, 1327, 1523, 1801, 2063, 2333, 2621, 2953].map(v => Math.round(v * o.size));
  const lines = base.map(len => ({ buf: new Float64Array(len), i: 0, g: 10 ** (-3 * len / (o.rt60 * RATE)), lp: 0 }));
  const inSign = [1, -1, 1, 1, -1, 1, -1, -1], outL = [1, 1, -1, 1, -1, -1, 1, -1], outR = [1, -1, 1, -1, 1, -1, -1, 1];
  const v = new Float64Array(8), s = 1 / Math.sqrt(8);
  for (let t = 0; t < n; t++) {
    const input = (t >= pre && t - pre < x.length ? x[t - pre]! : 0) + 0.5 * (erL[t]! + erR[t]!);
    for (let k = 0; k < 8; k++) { const ln = lines[k]!, o2 = ln.buf[ln.i]!; ln.lp = (1 - o.damping) * o2 + o.damping * ln.lp; v[k] = ln.lp * ln.g; }
    let l = 0, r = 0;
    for (let k = 0; k < 8; k++) { l += outL[k]! * v[k]!; r += outR[k]! * v[k]!; }
    // 8x8 Hadamard (fast Walsh-Hadamard transform), normalized.
    for (let h = 1; h < 8; h *= 2) for (let a = 0; a < 8; a += 2 * h) for (let b = a; b < a + h; b++) { const p = v[b]!, q = v[b + h]!; v[b] = p + q; v[b + h] = p - q; }
    for (let k = 0; k < 8; k++) { const ln = lines[k]!; ln.buf[ln.i] = v[k]! * s + inSign[k]! * input * 0.35; ln.i = (ln.i + 1) % ln.buf.length; }
    L[t] = erL[t]! + 0.6 * l; R[t] = erR[t]! + 0.6 * r;
  }
  return [L, R];
}

// ---------------------------------------------------------------- buffers and files
export function mix(dst: Wave, src: Wave, at = 0, gain = 1): void {
  for (let i = 0; i < src.length; i++) { const j = at + i; if (j >= 0 && j < dst.length) dst[j]! += gain * src[i]!; }
}
export function peak(...channels: Wave[]): number { let p = 0; for (const c of channels) for (const v of c) p = Math.max(p, Math.abs(v)); return p; }
export function scaleTo(channels: Wave[], dbfs: number): void {
  const k = db(dbfs) / peak(...channels);
  for (const c of channels) for (let i = 0; i < c.length; i++) c[i]! *= k;
}
/** Raised-cosine fade in and out, ending on exact zeros. */
export function taper(x: Wave, inFrames: number, outFrames: number): void {
  for (let i = 0; i < inFrames; i++) x[i]! *= 0.5 - 0.5 * Math.cos(Math.PI * i / inFrames);
  for (let i = 0; i < outFrames; i++) x[x.length - 1 - i]! *= 0.5 - 0.5 * Math.cos(Math.PI * i / outFrames);
  x[0] = 0; x[x.length - 1] = 0;
}
export function wavBytes(channels: Wave[]): Buffer {
  const n = channels[0]!.length, ch = channels.length, bytes = Buffer.alloc(44 + n * ch * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(ch, 22); bytes.writeUInt32LE(RATE, 24);
  bytes.writeUInt32LE(RATE * ch * 2, 28); bytes.writeUInt16LE(ch * 2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(n * ch * 2, 40);
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) bytes.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(channels[c]![i]! * 32767))), 44 + (i * ch + c) * 2);
  return bytes;
}
/** PCM16 WAV (44.1 kHz) to float channels in [-1, 1). */
export function readWavFloat(bytes: Buffer): Wave[] {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAV file');
  let p = 12, ch = 0, data: Buffer | null = null;
  while (p + 8 <= bytes.length) {
    const id = bytes.toString('ascii', p, p + 4), size = bytes.readUInt32LE(p + 4);
    if (id === 'fmt ') {
      ch = bytes.readUInt16LE(p + 10);
      if (bytes.readUInt16LE(p + 8) !== 1 || bytes.readUInt32LE(p + 12) !== RATE || bytes.readUInt16LE(p + 22) !== 16) throw new Error('expected 44.1 kHz PCM16');
    } else if (id === 'data') data = bytes.subarray(p + 8, p + 8 + size);
    p += 8 + size + (size & 1);
  }
  if (!ch || !data) throw new Error('incomplete WAV');
  const n = data.length / 2 / ch, out = Array.from({ length: ch }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) out[c]![i] = data.readInt16LE((i * ch + c) * 2) / 32768;
  return out;
}
