/**
 * MUTATION 001 score helpers, shared by the three mutations: a swung tempo grid, pitch names, smooth
 * automation lanes and tempo-synced step-modulation lanes. Deterministic, no I/O.
 */
import { smooth } from './dsp.ts';

/** A control signal as a function of time in seconds. */
export type Lane = (t: number) => number;

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** Scientific pitch name to MIDI (C4 = 60): 'D1' -> 26, 'Bb1' -> 34, 'C#2' -> 37. */
export function pn(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad pitch name ${name}`);
  return 12 * (Number(m[3]) + 1) + PC[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

/** 4/4 grid. `swing` is the share of each eighth taken by its first sixteenth (0.5 = straight). */
export class Grid {
  bpm: number; swing: number;
  constructor(bpm: number, swing = 0.5) { this.bpm = bpm; this.swing = swing; }
  get beat(): number { return 60 / this.bpm; }
  get bar(): number { return 4 * this.beat; }
  get s16(): number { return this.beat / 4; }
  /** Seconds at sixteenth `step` (may exceed 15 or be fractional) of bar `bar`, odd sixteenths swung. */
  at(bar: number, step = 0): number {
    const k = Math.floor(step), fr = step - k, odd = ((k % 2) + 2) % 2 === 1;
    const start = bar * this.bar + k * this.s16 + (odd ? (this.swing - 0.5) * 2 * this.s16 : 0);
    return start + fr * 2 * this.s16 * (odd ? 1 - this.swing : this.swing);
  }
}

/** Piecewise smoothstep automation through [seconds, value] points; holds the end values outside. */
export function ramp(points: [number, number][]): Lane {
  return (t: number) => {
    if (t <= points[0]![0]) return points[0]![1];
    for (let i = 1; i < points.length; i++) {
      const [t0, v0] = points[i - 1]!, [t1, v1] = points[i]!;
      if (t <= t1) return v0 + (v1 - v0) * smooth((t - t0) / Math.max(1e-9, t1 - t0));
    }
    return points[points.length - 1]![1];
  };
}

/**
 * One section of a step-modulation lane. `div` steps per beat (2 = eighths, 4 = sixteenths, 6 = sixteenth
 * triplets, 8 = thirty-seconds, 16 = sixty-fourths); `pattern` values cycle; `shape` is the contour inside
 * each step: 'decay' (struck, time constant `tau` in steps), 'ramp' (rising), 'gate' (on for `tau` of the
 * step) or 'hold'. Sixteenths follow the grid's swing so the modulation sits in the groove.
 */
export interface MotionSeg { from: number; to: number; div: number; pattern: number[]; shape?: 'decay' | 'ramp' | 'gate' | 'hold'; tau?: number }
/** Tempo-synced modulation lane in [0,1]; sections are given in bars. Returns 1 outside every section. */
export function motionLane(g: Grid, segs: MotionSeg[]): Lane {
  return (t: number) => {
    const barPos = t / g.bar, seg = segs.find(s => barPos >= s.from && barPos < s.to);
    if (!seg) return 1;
    const beats = (t - seg.from * g.bar) / g.beat;
    let k: number, fr: number;
    if (seg.div === 4 && g.swing !== 0.5) {
      const e = beats * 2, ke = Math.floor(e), fe = e - ke;
      if (fe < g.swing) { k = 2 * ke; fr = fe / g.swing; } else { k = 2 * ke + 1; fr = (fe - g.swing) / (1 - g.swing); }
    } else { const s = beats * seg.div; k = Math.floor(s); fr = s - k; }
    const v = seg.pattern[k % seg.pattern.length]!;
    switch (seg.shape ?? 'decay') {
      case 'decay': return v * Math.exp(-fr / (seg.tau ?? 0.4));
      case 'ramp': return v * fr;
      case 'gate': return fr < (seg.tau ?? 0.6) ? v : 0;
      default: return v;
    }
  };
}
