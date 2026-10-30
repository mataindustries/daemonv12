// Deterministic DSP primitives for the THING//MANIA audition palette.
// No clocks, no Math.random: every sound is a pure function of its recipe and seed.
// Output is 44.1 kHz signed 16-bit PCM WAV, the format DaemonV12 samplers accept.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

export const SR = 44100;
const TAU = Math.PI * 2;

const LETTERS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteToMidi(name) {
  const m = /^([A-G])(#|b)?(-1|[0-9])$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  return 12 * (Number(m[3]) + 1) + LETTERS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
export const midiToFreq = (m) => 440 * 2 ** ((m - 69) / 12);
export const noteFreq = (name) => midiToFreq(noteToMidi(name));
// Kit hit names must match DaemonV12's id grammar: "C#4" -> "cs4", "Bb1" -> "bb1".
export const hitName = (name) => name.toLowerCase().replace('#', 's');
export const semis = (n) => Number((2 ** (n / 12)).toFixed(6));

export function rng(seed) {
  let s = seed >>> 0 || 0x9e3779b9;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return (s / 4294967296) * 2 - 1;
  };
}

// Topology-preserving state-variable filter (Zavalishin/Simper). Time-varying cutoff is safe.
export class SVF {
  constructor() { this.ic1 = 0; this.ic2 = 0; this.lp = 0; this.bp = 0; this.hp = 0; this.bpn = 0; }
  run(x, fc, q = 0.7071) {
    const g = Math.tan(Math.PI * Math.min(Math.max(fc, 10), SR * 0.45) / SR);
    const k = 1 / q;
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x - this.ic2;
    const v1 = a1 * this.ic1 + a2 * v3;
    const v2 = this.ic2 + a2 * this.ic1 + a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.lp = v2; this.bp = v1; this.hp = x - k * v1 - v2; this.bpn = k * v1;
    return v2;
  }
}

export class DCBlock {
  constructor(hz = 20) { this.r = Math.exp(-TAU * hz / SR); this.x1 = 0; this.y1 = 0; }
  run(x) { const y = x - this.x1 + this.r * this.y1; this.x1 = x; this.y1 = y; return y; }
}

export function polyblep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
// Band-limited oscillator sharing one phase across waveforms.
export class Osc {
  constructor(phase = 0) { this.p = phase; this.dt = 0; }
  step(f) { this.dt = f / SR; const p = this.p; this.p += this.dt; if (this.p >= 1) this.p -= 1; return p; }
  static saw(p, dt) { return 2 * p - 1 - polyblep(p, dt); }
  static pulse(p, dt, duty = 0.5) {
    const naive = p < duty ? 1 : -1;
    return naive + polyblep(p, dt) - polyblep((p + 1 - duty) % 1, dt);
  }
  static sine(p) { return Math.sin(TAU * p); }
}

export const smoothstep = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
export const expDecay = (t, tau) => Math.exp(-t / tau);
export const attack = (t, a) => (a <= 0 ? 1 : Math.min(1, t / a));
export const sat = (x, drive = 1) => Math.tanh(x * drive) / Math.tanh(drive);

export function buffer(seconds) { return new Float64Array(Math.round(seconds * SR)); }
export function fadeTail(buf, seconds = 0.012) {
  const n = Math.min(buf.length, Math.round(seconds * SR));
  for (let i = 0; i < n; i++) buf[buf.length - 1 - i] *= i / n;
  return buf;
}
export function peak(chans) {
  let p = 0;
  for (const c of chans) for (let i = 0; i < c.length; i++) p = Math.max(p, Math.abs(c[i]));
  return p;
}
export function normalize(chans, dbfs) {
  const p = peak(chans);
  const g = p > 0 ? 10 ** (dbfs / 20) / p : 0;
  for (const c of chans) for (let i = 0; i < c.length; i++) c[i] *= g;
  return chans;
}
export function mixInto(dst, src, gain = 1, offset = 0) {
  for (let i = 0; i < src.length && i + offset < dst.length; i++) dst[i + offset] += src[i] * gain;
  return dst;
}

// Canonical 44-byte PCM16 header, no metadata: identical recipes give identical bytes.
export function encodeWav(chans) {
  const ch = chans.length, n = chans[0].length;
  const b = Buffer.alloc(44 + n * ch * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * ch * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * ch * 2, 28); b.writeUInt16LE(ch * 2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * ch * 2, 40);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const v = Math.max(-1, Math.min(1, chans[c][i]));
    b.writeInt16LE(Math.round(v * 32767), o); o += 2;
  }
  return b;
}
export function writeWav(path, chans) {
  mkdirSync(dirname(path), { recursive: true });
  const bytes = encodeWav(chans);
  writeFileSync(path, bytes);
  return { bytes: bytes.length, frames: chans[0].length, channels: chans.length,
    sha256: createHash('sha256').update(bytes).digest('hex') };
}
