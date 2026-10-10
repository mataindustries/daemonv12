// Pure, deterministic reads of PromoData at an exact time. Components call these with
// t = globalFrame / FPS and never keep state between frames, so any frame renders the
// same in isolation, in any order, on any worker.
import type {AutomationLane, Envelope, Marker, Onset, PromoData, Spectrum, StemId} from './contract.ts';

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Linear interpolation of an envelope; 0 outside it. */
export const envAt = (env: Envelope, t: number): number => {
  const x = t * env.rate;
  if (x < 0 || x > env.values.length - 1) return 0;
  const i = Math.floor(x);
  const a = env.values[i] ?? 0;
  const b = env.values[i + 1] ?? a;
  return a + (b - a) * (x - i);
};

/** Max of an envelope over [t0, t1], sampled at its own rate. */
export const envPeak = (env: Envelope, t0: number, t1: number): number => {
  let peak = 0;
  const from = Math.max(0, Math.floor(t0 * env.rate));
  const to = Math.min(env.values.length - 1, Math.ceil(t1 * env.rate));
  for (let i = from; i <= to; i++) peak = Math.max(peak, env.values[i] ?? 0);
  return peak;
};

/** Index of the last onset at or before t, or −1. Binary search; onsets are sorted. */
export const lastOnsetIndex = (onsets: readonly Onset[], t: number): number => {
  let lo = 0;
  let hi = onsets.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (onsets[mid]!.t <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
};

export const onsetsBetween = (onsets: readonly Onset[], t0: number, t1: number): Onset[] => {
  const out: Onset[] = [];
  for (let i = Math.max(0, lastOnsetIndex(onsets, t0)); i < onsets.length; i++) {
    const o = onsets[i]!;
    if (o.t > t1) break;
    if (o.t >= t0) out.push(o);
  }
  return out;
};

export type PulseShape = {
  /** Seconds for the envelope to fall to 1/e. */
  decay: number;
  /** Rise time in seconds; default lands the peak inside the onset's first frame. */
  attack?: number;
};

/** A single hit envelope: 0 before the onset, fast rise, exponential decay. */
export const pulse = (dt: number, {decay, attack = 1 / 240}: PulseShape): number => {
  if (dt < 0) return 0;
  const rise = attack > 0 ? Math.min(1, dt / attack) : 1;
  return rise * Math.exp(-Math.max(0, dt - attack) / decay);
};

/**
 * The combined hit response of a stem at time t: the strongest recent onset's pulse.
 * Max (not sum) keeps dense hats from saturating.
 */
export const hitAt = (onsets: readonly Onset[], t: number, shape: PulseShape): number => {
  let value = 0;
  const horizon = shape.decay * 7;
  for (let i = lastOnsetIndex(onsets, t); i >= 0; i--) {
    const o = onsets[i]!;
    const dt = t - o.t;
    if (dt > horizon) break;
    value = Math.max(value, o.strength * pulse(dt, shape));
  }
  return value;
};

export const lastOnset = (onsets: readonly Onset[], t: number): {onset: Onset; dt: number; index: number} | null => {
  const index = lastOnsetIndex(onsets, t);
  if (index < 0) return null;
  const onset = onsets[index]!;
  return {onset, dt: t - onset.t, index};
};

export const nextOnset = (onsets: readonly Onset[], t: number): Onset | null => onsets[lastOnsetIndex(onsets, t) + 1] ?? null;

/** Onsets per second in the trailing window, smoothed by triangular weighting. */
export const density = (onsets: readonly Onset[], t: number, window = 0.375): number => {
  let weight = 0;
  for (let i = lastOnsetIndex(onsets, t); i >= 0; i--) {
    const dt = t - onsets[i]!.t;
    if (dt > window) break;
    weight += 1 - dt / window;
  }
  return (weight * 2) / window;
};

export const spectrumAt = (spectrum: Spectrum, t: number): number[] => {
  const x = t * spectrum.rate;
  const bands = spectrum.bandEdgesHz.length - 1;
  if (x < 0 || x > spectrum.values.length - 1) return new Array<number>(bands).fill(0);
  const i = Math.floor(x);
  const a = spectrum.values[i]!;
  const b = spectrum.values[i + 1] ?? a;
  const f = x - i;
  return a.map((v, k) => v + ((b[k] ?? v) - v) * f);
};

const toNorm = (lane: AutomationLane, v: number) => {
  const [lo, hi] = lane.range;
  if (lane.unit === 'Hz') return clamp01(Math.log(v / lo) / Math.log(hi / lo));
  return clamp01((v - lo) / (hi - lo));
};

/** Automation value in its own unit (log-linear between Hz breakpoints). Holds outside. */
export const automationAt = (lane: AutomationLane, t: number): number => {
  const pts = lane.points;
  if (t <= pts[0]!.t) return pts[0]!.v;
  for (let i = 1; i < pts.length; i++) {
    const b = pts[i]!;
    if (t <= b.t) {
      const a = pts[i - 1]!;
      const f = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t);
      return lane.unit === 'Hz' ? a.v * Math.pow(b.v / a.v, f) : a.v + (b.v - a.v) * f;
    }
  }
  return pts[pts.length - 1]!.v;
};

/** Automation value mapped to 0…1 of its display range. */
export const automationNormAt = (lane: AutomationLane, t: number) => toNorm(lane, automationAt(lane, t));

/** How fast a lane is moving right now, 0…1. Effect names appear only while this is high. */
export const automationMotion = (lane: AutomationLane, t: number, window = 0.09): number =>
  clamp01((Math.abs(automationNormAt(lane, t + window) - automationNormAt(lane, t - window)) / (2 * window)) * 0.35);

/** Spread (max − min, normalized) of a lane over [t0, t1]: 0 when it is resting there. */
export const automationSpread = (lane: AutomationLane, t0: number, t1: number, steps = 48): number => {
  let lo = 1;
  let hi = 0;
  for (let i = 0; i <= steps; i++) {
    const v = automationNormAt(lane, t0 + ((t1 - t0) * i) / steps);
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return Math.max(0, hi - lo);
};

export const formatAutomation = (lane: AutomationLane, v: number): string => {
  switch (lane.unit) {
    case 'Hz':
      return v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${Math.round(v)}`;
    case 'dB':
      return `${v <= -0.05 ? '−' : ''}${Math.abs(v).toFixed(1)} dB`;
    case '%':
      return `${Math.round(v)}%`;
    case 'pan':
      return Math.abs(v) < 0.02 ? 'C' : `${v < 0 ? 'L' : 'R'}${Math.round(Math.abs(v) * 100)}`;
  }
};

/** A stop (musical silence) covering t, if any. Visual layers go dark inside it. */
export const stopAt = (markers: readonly Marker[], t: number): Marker | null => {
  for (const m of markers) if (m.kind === 'stop' && t >= m.t && t < m.t + (m.duration ?? 0)) return m;
  return null;
};

export const markerById = (markers: readonly Marker[], id: string): Marker | null => markers.find(m => m.id === id) ?? null;

/**
 * Cue resolution: a visual cue is written at a musical time, but if the real stem has an
 * onset within `window` seconds it snaps to that onset. With the fixture these coincide;
 * with analyzed data a cue follows the actual hit instead of the theoretical grid.
 */
export const snapToOnset = (data: PromoData, stem: StemId, seconds: number, window = 0.09): number => {
  const onsets = data.stems[stem].onsets;
  const i = lastOnsetIndex(onsets, seconds + window);
  let best = seconds;
  let bestDistance = window + 1e-9;
  for (let k = i; k >= 0; k--) {
    const d = Math.abs(onsets[k]!.t - seconds);
    if (onsets[k]!.t < seconds - window) break;
    if (d < bestDistance) {
      best = onsets[k]!.t;
      bestDistance = d;
    }
  }
  return best;
};
