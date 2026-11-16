/** Shared helpers for the Timbre Lab instruments: no audio code from the frozen engines, no I/O. */
import { curveAt, clamp } from '../studio-001/rack/curves.ts';
import type { ControlSpec, PartPerformance, RackInstrument } from '../studio-001/rack/types.ts';

export const LAB_VERSION = '0.1.0';
export type LabFamily = 'organic-percussion' | 'breath-reed';
/** A rack instrument whose family is not one of the three frozen ones. */
export type LabInstrument = Omit<RackInstrument, 'family'> & { family: LabFamily };

export const NOMINAL_RMS = 0.1; // -20 dBFS, the rack's calibration level
export const spec = (name: string, min: number, max: number, description: string): ControlSpec => ({ name, min, max, description });
export const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
/** Deterministic PRNG (mulberry32): uniform in [0, 1). */
export function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => { let t = (s = (s + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** A control as a function of beats: the explicit curve, else the macro mapping plus an optional offset; always clamped. */
export function controlAt(perf: PartPerformance, c: ControlSpec, byMacro: (m: number) => number): (beat: number) => number {
  const abs = perf.controls[c.name], off = perf.offsets[c.name];
  return beat => clamp(abs !== undefined ? curveAt(abs, beat) : byMacro(clamp(curveAt(perf.macro, beat), 0, 1)) + (off !== undefined ? curveAt(off, beat) : 0), c.min, c.max);
}
export function rmsOf(w: Float64Array, from: number, to: number): number {
  let s = 0; const e = Math.min(to, w.length);
  for (let i = from; i < e; i++) s += w[i]! * w[i]!;
  return Math.sqrt(s / Math.max(1, e - from));
}
