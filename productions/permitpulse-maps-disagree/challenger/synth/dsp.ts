/** Offline DSP for the PermitPulse challenger instruments.
 * Everything renders deterministic Float64 buffers at 44.1 kHz from math and a
 * seeded integer PRNG. DaemonV12 then plays the results as sampler/kit voices. */
export const RATE = 44100, TAU = 2 * Math.PI;
export type Mono = Float64Array;
export type Stereo = [Float64Array, Float64Array];

export const frames = (seconds: number) => Math.max(1, Math.round(seconds * RATE));
export const midiHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
export const dbLin = (db: number) => 10 ** (db / 20);
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const smooth = (x: number) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
export const decay = (t: number, t60: number) => Math.exp(-6.907755 * t / t60);

/** mulberry32: identical integer sequence on every runtime. */
export function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2147483648 - 1;
  };
}
/** Stable 32-bit hash of a string, used to seed per-sample randomness. */
export function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function blep(t: number, dt: number): number {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
/** Band-limited (polyBLEP) oscillator with phase in cycles. */
export class Osc {
  phase: number;
  constructor(phase = 0) { this.phase = phase; }
  /** Advance by frequency `hz`; returns saw, square (width `pw`) and triangle-ish sine. */
  saw(hz: number): number {
    const dt = Math.min(0.49, hz / RATE), p = this.phase;
    const y = 2 * p - 1 - blep(p, dt);
    this.phase = p + dt; if (this.phase >= 1) this.phase -= 1;
    return y;
  }
  pulse(hz: number, pw = 0.5): number {
    const dt = Math.min(0.49, hz / RATE), p = this.phase;
    let y = p < pw ? 1 : -1;
    y += blep(p, dt);
    const q = (p - pw + 1) % 1; y -= blep(q, dt);
    this.phase = p + dt; if (this.phase >= 1) this.phase -= 1;
    return y;
  }
  sine(hz: number): number {
    const y = Math.sin(TAU * this.phase);
    this.phase += hz / RATE; if (this.phase >= 1) this.phase -= 1;
    return y;
  }
}

/** Four-pole transistor-ladder low-pass with tanh stages (2x internal oversampling). */
export class Ladder {
  s = [0, 0, 0, 0];
  process(x: number, cutoffHz: number, resonance: number): number {
    const fc = clamp(cutoffHz, 10, RATE * 0.45);
    const g = 1 - Math.exp(-TAU * fc / (2 * RATE));
    let y = 0;
    for (let k = 0; k < 2; k++) {
      const input = Math.tanh(x - resonance * 4 * this.s[3]!);
      this.s[0]! += g * (input - Math.tanh(this.s[0]!));
      this.s[1]! += g * (Math.tanh(this.s[0]!) - Math.tanh(this.s[1]!));
      this.s[2]! += g * (Math.tanh(this.s[1]!) - Math.tanh(this.s[2]!));
      this.s[3]! += g * (Math.tanh(this.s[2]!) - Math.tanh(this.s[3]!));
      y = this.s[3]!;
    }
    return y * (1 + resonance * 1.6);
  }
}

/** Zavalishin TPT state-variable filter. */
export class SVF {
  ic1 = 0; ic2 = 0; low = 0; band = 0; high = 0;
  process(x: number, hz: number, q: number): number {
    const g = Math.tan(Math.PI * clamp(hz, 10, RATE * 0.45) / RATE), k = 1 / q;
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x - this.ic2, v1 = a1 * this.ic1 + a2 * v3, v2 = this.ic2 + a2 * this.ic1 + a3 * v3;
    this.ic1 = 2 * v1 - this.ic1; this.ic2 = 2 * v2 - this.ic2;
    this.low = v2; this.band = v1; this.high = x - k * v1 - v2;
    return v1;
  }
}
/** One-pole smoothers / tone controls. */
export class OnePole {
  y = 0;
  lp(x: number, hz: number) { this.y += (1 - Math.exp(-TAU * hz / RATE)) * (x - this.y); return this.y; }
  hp(x: number, hz: number) { return x - this.lp(x, hz); }
}

/** RBJ biquad for shaping (low/high/band-pass, peaking and shelves). */
export function biquad(kind: 'lp' | 'hp' | 'bp' | 'peak' | 'lowshelf' | 'highshelf', hz: number, q = 0.707, gainDb = 0) {
  const w = TAU * hz / RATE, cos = Math.cos(w), sin = Math.sin(w), alpha = sin / (2 * q), A = 10 ** (gainDb / 40);
  let b0 = 1, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;
  if (kind === 'lp') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; }
  if (kind === 'hp') { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; }
  if (kind === 'bp') { b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; }
  if (kind === 'peak') { b0 = 1 + alpha * A; b1 = -2 * cos; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cos; a2 = 1 - alpha / A; }
  if (kind === 'lowshelf' || kind === 'highshelf') {
    const s = 2 * Math.sqrt(A) * alpha, sign = kind === 'lowshelf' ? 1 : -1;
    b0 = A * ((A + 1) - sign * (A - 1) * cos + s); b1 = 2 * sign * A * ((A - 1) - sign * (A + 1) * cos); b2 = A * ((A + 1) - sign * (A - 1) * cos - s);
    a0 = (A + 1) + sign * (A - 1) * cos + s; a1 = -2 * sign * ((A - 1) + sign * (A + 1) * cos); a2 = (A + 1) + sign * (A - 1) * cos - s;
  }
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x: number) => {
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y; return y;
  };
}

/** Exponential ADSR evaluated at time t for a note held `hold` seconds. */
export function adsr(t: number, hold: number, a: number, d: number, s: number, r: number): number {
  const level = (u: number) => u < a ? u / a : s + (1 - s) * Math.exp(-(u - a) / Math.max(1e-4, d));
  if (t < hold) return level(t);
  return level(hold) * Math.exp(-(t - hold) / Math.max(1e-4, r));
}

/** Sum of exponentially decaying sine partials (struck objects, bells, plates). */
export function modal(out: Float64Array, partials: { hz: number; amp: number; t60: number; phase?: number }[], start = 0) {
  for (const p of partials) {
    if (p.hz >= RATE * 0.45) continue;
    const w = TAU * p.hz / RATE; let ph = p.phase ?? 0;
    for (let i = start; i < out.length; i++) {
      const t = (i - start) / RATE, env = decay(t, p.t60);
      if (env < 1e-5) break;
      out[i]! += p.amp * Math.sin(ph) * env; ph += w;
    }
  }
}
export function noiseBurst(out: Float64Array, seed: number, start: number, seconds: number, amp: number, shape: (x: number) => number, t60: number) {
  const random = prng(seed), n = frames(seconds);
  for (let i = 0; i < n && start + i < out.length; i++) out[start + i]! += amp * shape(random()) * decay(i / RATE, t60);
}

export const mono = (n: number) => new Float64Array(n);
export const stereo = (n: number): Stereo => [new Float64Array(n), new Float64Array(n)];
export const toStereo = (m: Mono): Stereo => [m, Float64Array.from(m)];
export function mix(target: Float64Array, source: Float64Array, gain = 1, offset = 0) {
  for (let i = 0; i < source.length && offset + i < target.length; i++) target[offset + i]! += gain * source[i]!;
}
export function fadeEdges(buf: Float64Array, inSeconds: number, outSeconds: number) {
  const a = frames(inSeconds), b = frames(outSeconds);
  for (let i = 0; i < Math.min(a, buf.length); i++) buf[i]! *= i / a;
  for (let i = 0; i < Math.min(b, buf.length); i++) buf[buf.length - 1 - i]! *= i / b;
}
export const softClip = (x: number, drive: number) => Math.tanh(x * drive) / Math.tanh(drive);

/** RIFF PCM16 writer, mono or stereo, at a fixed instrument gain (no per-file normalization,
 * so accents and dynamics designed into an instrument survive). Refuses to clip. */
export function wav(data: Mono | Stereo, gain = 1): Buffer {
  const channels = data instanceof Float64Array ? [data] : data;
  const length = channels[0]!.length;
  let peak = 0; for (const c of channels) for (const x of c) { if (!Number.isFinite(x)) throw new Error('Nonfinite synthesis'); peak = Math.max(peak, Math.abs(x * gain)); }
  if (!peak) throw new Error('Silent synthesis');
  if (peak > 0.995) throw new Error(`Sample would clip (peak ${peak.toFixed(3)}); lower the instrument gain`);
  const bytes = Buffer.alloc(44 + length * channels.length * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8); bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(channels.length, 22); bytes.writeUInt32LE(RATE, 24);
  bytes.writeUInt32LE(RATE * 2 * channels.length, 28); bytes.writeUInt16LE(2 * channels.length, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(length * channels.length * 2, 40);
  for (let i = 0; i < length; i++) channels.forEach((c, k) => {
    bytes.writeInt16LE(Math.round(c[i]! * gain * 32767), 44 + (i * channels.length + k) * 2);
  });
  return bytes;
}
export const peakOf = (data: Mono | Stereo) => { let p = 0; for (const c of data instanceof Float64Array ? [data] : data) for (const x of c) p = Math.max(p, Math.abs(x)); return p; };
