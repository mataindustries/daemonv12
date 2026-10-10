// Closed-form motion: every value is a pure function of time, so frames render
// independently and identically. No integration state, no frame-to-frame memory.

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
export const mix = lerp;
/** 0…1 progress of t through [t0, t1], clamped. */
export const progress = (t: number, t0: number, t1: number) => (t1 === t0 ? (t >= t1 ? 1 : 0) : clamp01((t - t0) / (t1 - t0)));

export const expoOut = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
export const expoIn = (x: number) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10));
export const cubicOut = (x: number) => 1 - Math.pow(1 - x, 3);
export const quartIn = (x: number) => x * x * x * x;

export type SpringParams = {
  /** Natural frequency in Hz. 4 = heavy, 9 = snappy, 14 = violent. */
  freq: number;
  /** Damping ratio. <1 overshoots, 1 is critical, >1 is sluggish. */
  damping: number;
};

export const SPRINGS = {
  /** Impact with one honest overshoot: for musical hits. */
  hit: {freq: 9, damping: 0.42},
  /** Locks into place without overshoot: quantize, grid snaps. */
  lock: {freq: 11, damping: 1},
  /** Heavy, slight overshoot: large layout moves on bar lines. */
  heavy: {freq: 4.2, damping: 0.72},
  /** Very fast settle: micro motion, labels. */
  snap: {freq: 18, damping: 0.9},
} as const satisfies Record<string, SpringParams>;

/**
 * Unit step response of a damped harmonic oscillator released at dt = 0 from rest at 0
 * toward 1. Exact analytic solution for under-, critically and over-damped springs.
 */
export const springStep = (dt: number, {freq, damping}: SpringParams): number => {
  if (dt <= 0) return 0;
  const w0 = 2 * Math.PI * freq;
  if (damping < 1) {
    const wd = w0 * Math.sqrt(1 - damping * damping);
    return 1 - Math.exp(-damping * w0 * dt) * (Math.cos(wd * dt) + ((damping * w0) / wd) * Math.sin(wd * dt));
  }
  if (damping === 1) return 1 - Math.exp(-w0 * dt) * (1 + w0 * dt);
  const s = Math.sqrt(damping * damping - 1);
  const r1 = -w0 * (damping - s);
  const r2 = -w0 * (damping + s);
  return 1 + (r2 * Math.exp(r1 * dt) - r1 * Math.exp(r2 * dt)) / (r1 - r2);
};

export type Key = {t: number; v: number};

/**
 * A spring that is re-targeted at each key. Because the spring is linear, superposing
 * the step responses of each target change gives the exact physical motion: position and
 * velocity stay continuous through every re-target (no restarts, no jumps).
 */
export const springChain = (t: number, keys: readonly Key[], params: SpringParams): number => {
  if (keys.length === 0) return 0;
  let value = keys[0]!.v;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i]!;
    if (t <= k.t) break;
    value += (k.v - keys[i - 1]!.v) * springStep(t - k.t, params);
  }
  return value;
};

/** Spring from a to b released at t0. */
export const springTo = (t: number, t0: number, a: number, b: number, params: SpringParams) => a + (b - a) * springStep(t - t0, params);

/** Numerical velocity of any pure motion function, per second. */
export const velocity = (fn: (t: number) => number, t: number, h = 1 / 240) => (fn(t + h / 2) - fn(t - h / 2)) / h;

/**
 * Motion blur length in pixels for a velocity in px/s with a 180° shutter at 60 fps.
 * Clamped so throws smear but never dissolve.
 */
export const smear = (pxPerSecond: number, max = 48) => Math.min(max, Math.abs(pxPerSecond) * (0.5 / 60));

/** Exponential impact envelope: 0 before t0, 1 at t0, 1/e after `decay` seconds. */
export const impact = (t: number, t0: number, decay: number) => (t < t0 ? 0 : Math.exp(-(t - t0) / decay));

/** Deterministic hash → 0…1 for per-element variation (no Math.random). */
export const hash01 = (a: number, b = 0) => {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x165667b1, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};

/**
 * Reveal that lands hard: more than half present on the event frame itself (a cut),
 * completing over `settle` seconds. 0 before t0.
 */
export const cutIn = (t: number, t0: number, settle: number) => (t < t0 ? 0 : 0.55 + 0.45 * expoOut(progress(t, t0, t0 + settle)));

/** Hold a continuous value for `frames` frames at a time: edited, stepped motion. */
export const stepped = (frame: number, frames: number) => Math.floor(frame / frames) * frames;
