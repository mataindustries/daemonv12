// Closed-form, exactly periodic motion. Every value is a pure function of t, and every
// function here returns the same value and the same velocity at t and t + LOOP, so the last
// frame flows into the first exactly as any frame flows into the next.
import {LOOP, wrap} from '../timeline.ts';

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const u = clamp01((x - e0) / (e1 - e0));
  return u * u * (3 - 2 * u);
};
export const TAU = Math.PI * 2;

/** Deterministic hash in [0, 1). Math.random is never used. */
export const hash01 = (...n: number[]) => {
  let h = 2166136261;
  for (const x of n) {
    h ^= Math.floor(x * 1000003) | 0;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
};

export type SpringParams = {
  /** Natural frequency in Hz. */
  freq: number;
  /** Damping ratio. Below 1 overshoots, 1 is critical. */
  damping: number;
};

export const SPRINGS = {
  /** Mechanical lock: fast, one small overshoot. */
  lock: {freq: 7.5, damping: 0.5},
  /** Heavy machinery: slow, one honest overshoot. */
  heavy: {freq: 1.6, damping: 0.62},
  /** Very heavy gimbal moves. */
  gimbal: {freq: 0.9, damping: 0.72},
  /** A ratchet tooth clicking over. */
  tick: {freq: 11, damping: 0.45},
  /** Macro intensity, no overshoot. */
  swell: {freq: 0.7, damping: 1},
} as const satisfies Record<string, SpringParams>;

/**
 * Unit step response of a damped harmonic oscillator released at dt = 0 from rest at 0
 * toward 1. Exact analytic solution for under-, critically and over-damped springs.
 */
export const springStep = (dt: number, {freq, damping}: SpringParams): number => {
  if (dt <= 0) return 0;
  const w0 = TAU * freq;
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

/** A change of target `d` released at time `t` (seconds inside the loop), optionally with its own spring. */
export type Move = {t: number; d: number; p?: SpringParams};

/** Cycles summed into the past. Springs here settle in well under one 15 s cycle. */
const HISTORY = 3;

/**
 * A spring re-targeted at each move, repeating every LOOP. The moves must sum to zero so
 * the target returns to `base` once per cycle. Superposing the step responses of every move
 * in this and earlier cycles gives one physical, linear spring: position and velocity are
 * continuous through every re-target and through the loop point.
 */
export const cycleSpring = (t: number, base: number, moves: readonly Move[], params: SpringParams): number => {
  const tt = wrap(t);
  let v = base;
  for (let c = 0; c <= HISTORY; c++) {
    for (const m of moves) v += m.d * springStep(tt + c * LOOP - m.t, m.p ?? params);
  }
  // Settled cycles contribute sum(d) each; that sum is zero by contract.
  return v;
};

/** Sum of the moves; must be zero for a periodic spring. */
export const netMove = (moves: readonly Move[]) => moves.reduce((s, m) => s + m.d, 0);

/**
 * An angle whose angular speed follows a periodic profile and which turns exactly `turns`
 * whole revolutions per loop (negative turns counter-rotate). The profile is integrated once
 * at 1 ms resolution and normalised so the loop total is exact, so both the angle (mod 2π)
 * and the angular velocity are continuous through the loop point.
 */
export const integratedAngle = (turns: number, speed: (t: number) => number) => {
  const N = Math.round(LOOP * 1000);
  const table = new Float64Array(N + 1);
  let acc = 0;
  let prev = speed(0);
  for (let i = 1; i <= N; i++) {
    const s = speed((i / N) * LOOP);
    acc += ((prev + s) / 2) * (LOOP / N);
    table[i] = acc;
    prev = s;
  }
  const total = acc;
  const scale = (turns * TAU) / total;
  const angle = (t: number) => {
    const tt = wrap(t);
    const x = (tt / LOOP) * N;
    const i = Math.min(N - 1, Math.floor(x));
    const f = x - i;
    return (table[i]! + (table[i + 1]! - table[i]!) * f) * scale;
  };
  return {angle, /** Angular velocity in rad/s at t. */ velocity: (t: number) => speed(wrap(t)) * scale};
};

/**
 * A ratchet that advances one detent per tick and lands exactly one full turn per loop.
 * Each tick is a spring step, so ticks that come quickly overlap like a real escapement.
 */
export const ratchet = (t: number, ticks: readonly number[], turns: number, params: SpringParams = SPRINGS.tick) => {
  const step = (turns * TAU) / ticks.length;
  const tt = wrap(t);
  let a = 0;
  for (const tk of ticks) {
    a += springStep(tt - tk, params);
    // Last cycle's late ticks still settling into this cycle.
    a += springStep(tt + LOOP - tk, params) - 1;
  }
  return a * step;
};

export type Hit = {t: number; s: number};

/** Exponential hit envelope with wrap-around: the strongest recent hit, decaying. */
export const hitEnv = (t: number, hits: readonly Hit[], decay: number, attack = 0.012) => {
  const tt = wrap(t);
  let best = 0;
  for (const h of hits) {
    for (const dt of [tt - h.t, tt + LOOP - h.t, tt - LOOP - h.t]) {
      if (dt < -attack || dt > decay * 8) continue;
      const a = dt < 0 ? 1 + dt / attack : Math.exp(-dt / decay);
      best = Math.max(best, h.s * a);
    }
  }
  return best;
};

/** The most recent hit at or before t (around the loop), with the time since it. */
export const lastHit = (t: number, hits: readonly Hit[]) => {
  const tt = wrap(t);
  let best: {index: number; hit: Hit; dt: number} | null = null;
  hits.forEach((h, index) => {
    const dt = wrap(tt - h.t);
    if (!best || dt < best.dt) best = {index, hit: h, dt};
  });
  return best as {index: number; hit: Hit; dt: number} | null;
};

/** Linear interpolation into a per-frame series that wraps around the loop. */
export const sampleSeries = (t: number, series: readonly number[]) => {
  if (series.length === 0) return 0;
  const x = (wrap(t) / LOOP) * series.length;
  const i = Math.floor(x) % series.length;
  const j = (i + 1) % series.length;
  const f = x - Math.floor(x);
  return series[i]! + (series[j]! - series[i]!) * f;
};
