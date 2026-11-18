/** WEST//GHOST 001: original offline performance DSP. No audio/preset inputs. */
export const SR = 44100;
export const TAU = 2 * Math.PI;
export type Point = { time: number; value: number };
export type Curve = readonly Point[];
export interface Performance {
  instrument: 'gravity' | 'vandal' | 'apparition' | 'iron-bloom';
  note: number;
  gate: number;
  release?: number;
  velocity?: number;
  articulation?: string;
  seed?: number;
  /** Absolute MIDI pitch, seconds relative to onset. Slides preserve oscillator phase. */
  pitch?: Curve;
  expression?: Curve;
  timbre?: Curve;
  motion?: Curve;
  breath?: Curve;
}
export function valueAt(curve: Curve | undefined, time: number, fallback: number): number {
  if (!curve?.length || time < curve[0]!.time) return fallback;
  for (let k = 1; k < curve.length; k++) {
    const a = curve[k - 1]!, b = curve[k]!;
    if (time <= b.time) return a.value + (b.value - a.value) * ((time - a.time) / (b.time - a.time));
  }
  return curve.at(-1)!.value;
}
export const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
export function random(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296 * 2 - 1; };
}
export function envelope(t: number, gate: number, release: number, attack: number): number {
  const a = Math.min(1, t / attack);
  return t < gate ? a : a * Math.max(0, 1 - (t - gate) / release) ** 2;
}
export const softClip = (x: number) => Math.tanh(x);
export function removeDc(x: Float64Array): Float64Array {
  let prior = 0, y = 0;
  const r = Math.exp(-TAU * 12 / SR);
  for (let i = 0; i < x.length; i++) { const v = x[i]!; y = v - prior + r * y; prior = v; x[i] = y; }
  // Exact silent edges make portable sample truncation safe.
  const fade = Math.min(Math.round(SR * 0.004), Math.floor(x.length / 2));
  for (let i = 0; i < fade; i++) { x[i] = x[i]! * (i / fade); x[x.length - 1 - i] = x[x.length - 1 - i]! * (i / fade); }
  return x;
}
/** Validation bounds CPU/memory and keeps curve extrapolation explicit. */
export function validatePerformance(p: Performance): void {
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new RangeError('Performance must be an object');
  for (const key of Object.keys(p)) if (!['instrument', 'note', 'gate', 'release', 'velocity', 'articulation', 'seed', 'pitch', 'expression', 'timbre', 'motion', 'breath'].includes(key)) throw new RangeError(`Unknown performance field: ${key}`);
  if (!['gravity', 'vandal', 'apparition', 'iron-bloom'].includes(p.instrument)) throw new RangeError('Unknown WEST//GHOST instrument');
  const ranges = { gravity: [24, 60], vandal: [28, 64], apparition: [48, 84], 'iron-bloom': [36, 84] };
  const [lo, hi] = ranges[p.instrument]!;
  if (!Number.isFinite(p.note) || p.note < lo! || p.note > hi!) throw new RangeError(`${p.instrument} note must be ${lo}..${hi} MIDI`);
  if (!Number.isFinite(p.gate) || p.gate < 0.02 || p.gate > 30) throw new RangeError('Gate must be 0.02..30 seconds');
  if (p.release !== undefined && (!Number.isFinite(p.release) || p.release < 0.01 || p.release > 5)) throw new RangeError('Release must be 0.01..5 seconds');
  if (p.velocity !== undefined && (!Number.isFinite(p.velocity) || p.velocity <= 0 || p.velocity > 1)) throw new RangeError('Velocity must be (0,1]');
  const arts = { gravity: ['sustain', 'impact'], vandal: ['sustain', 'bite'], apparition: ['sustain', 'whisper'], 'iron-bloom': ['strike', 'bow'] };
  if (p.articulation !== undefined && !arts[p.instrument].includes(p.articulation)) throw new RangeError(`Unsupported ${p.instrument} articulation`);
  if (p.seed !== undefined && (!Number.isSafeInteger(p.seed) || p.seed < 0 || p.seed > 0xffffffff)) throw new RangeError('Seed must be uint32');
  for (const key of ['pitch', 'expression', 'timbre', 'motion', 'breath'] as const) {
    const curve = p[key];
    if (curve !== undefined && (!Array.isArray(curve) || curve.length > 128)) throw new RangeError(`${key}: at most 128 points`);
    for (let i = 0; i < (curve?.length ?? 0); i++) {
      const point = curve![i]!;
      if (!Number.isFinite(point.time) || point.time < 0 || point.time > p.gate + (p.release ?? 0.4) || (i > 0 && point.time <= curve![i - 1]!.time)) throw new RangeError(`${key}: strictly increasing bounded seconds`);
      const min = key === 'pitch' ? lo! : 0, max = key === 'pitch' ? hi! : 1;
      if (!Number.isFinite(point.value) || point.value < min || point.value > max) throw new RangeError(`${key}: values ${min}..${max}`);
    }
  }
}

/** A shared zero-phase start controls the clean sub and harmonics as a single oscillator. */
export function gravity(p: Performance): Float64Array {
  const release = p.release ?? 0.4, out = new Float64Array(Math.round((p.gate + release) * SR));
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR, e = valueAt(p.expression, t, 0.8), tone = valueAt(p.timbre, t, 0.45);
    const drop = p.articulation === 'impact' ? 14 * Math.exp(-t / 0.024) : 0;
    const hz = frequency(valueAt(p.pitch, t, p.note) + drop);
    const sine = Math.sin(phase), harmonics = Math.tanh((1 + tone * 5) * sine) - sine;
    const attack = p.articulation === 'impact' ? 0.002 : 0.007;
    out[i] = (0.46 * sine + (0.06 + tone * 0.13) * harmonics) * envelope(t, p.gate, release, attack) * (0.3 + e * 0.7) * (p.velocity ?? 0.85);
    phase = (phase + TAU * hz / SR) % TAU;
  }
  return removeDc(out);
}

/** Two-times oversampled FM/waveshaping into a moving state-variable filter.
 * Two 9 kHz biquads form a fourth-order Butterworth antialias low-pass before decimation.
 * This is a controlled prototype, not an alias-free nonlinear synthesis claim. */
export function vandal(p: Performance): Float64Array {
  const release = p.release ?? 0.4, out = new Float64Array(Math.round((p.gate + release) * SR));
  let phase = 0, motionPhase = 0, s1 = 0, s2 = 0, sub = 0;
  const fs = SR * 2, ah = 1 - Math.exp(-TAU * 105 / SR);
  const w = TAU * 9000 / fs, cosine = Math.cos(w), sine = Math.sin(w);
  const antialias = [0.5411961001, 1.3065629649].map(q => {
    const a0 = 1 + sine / (2 * q);
    return { b0: (1 - cosine) / (2 * a0), b1: (1 - cosine) / a0, a1: -2 * cosine / a0, a2: (1 - sine / (2 * q)) / a0, z1: 0, z2: 0 };
  });
  for (let i = 0; i < out.length; i++) {
    let sample = 0;
    for (let j = 0; j < 2; j++) {
      const t = (i + j / 2) / SR, expression = valueAt(p.expression, t, 0.8), tone = valueAt(p.timbre, t, 0.6), motion = valueAt(p.motion, t, 0.4);
      const hz = frequency(valueAt(p.pitch, t, p.note)), wobble = 0.5 + 0.5 * Math.sin(motionPhase);
      const index = 0.3 + tone * 3 + motion * wobble;
      const source = Math.sin(phase + index * Math.sin(2 * phase + 0.32 * Math.sin(motionPhase * 0.5))) + 0.22 * Math.sin(3 * phase);
      const input = Math.tanh(source * (1.5 + tone * 5 + expression));
      const cutoff = 260 + 4000 * (0.12 + tone * 0.5 + wobble * motion * 0.38), g = Math.tan(Math.PI * cutoff / fs), k = 0.85;
      const hp = (input - (k + g) * s1 - s2) / (1 + g * (k + g)), bp = g * hp + s1, lp = g * bp + s2;
      s1 = g * hp + bp; s2 = g * bp + lp;
      sample = 0.65 * lp + 0.4 * bp;
      for (const f of antialias) {
        const y = f.b0 * sample + f.z1;
        f.z1 = f.b1 * sample - f.a1 * y + f.z2; f.z2 = f.b0 * sample - f.a2 * y; sample = y;
      }
      phase = (phase + TAU * hz / fs) % TAU;
      motionPhase = (motionPhase + TAU * (0.5 + motion * 8) / fs) % (TAU * 2);
    }
    const t = i / SR, e = valueAt(p.expression, t, 0.8), m = valueAt(p.motion, t, 0.4);
    sub += ah * (sample - sub);
    const pulse = 1 - 0.28 * m + 0.28 * m * Math.sin(motionPhase);
    out[i] = (sample - sub) * 0.34 * pulse * envelope(t, p.gate, release, p.articulation === 'bite' ? 0.002 : 0.008) * (0.3 + e * 0.7) * (p.velocity ?? 0.85);
  }
  return removeDc(out);
}
