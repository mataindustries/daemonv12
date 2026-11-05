/** Pitch names, voicings and groove helpers shared by every HEADLINER 001 score. */
import { Rng } from './dsp.ts';

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** Scientific pitch name ("Eb5", "F#2") -> MIDI number, C4 = 60. */
export function m(name: string): number {
  const r = /^([A-G])(#|b)?(-?\d)$/.exec(name); if (!r) throw new Error(`bad pitch ${name}`);
  return 12 * (Number(r[3]) + 1) + PC[r[1]!]! + (r[2] === '#' ? 1 : r[2] === 'b' ? -1 : 0);
}
const NAMES = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b'];
/** MIDI -> kit-safe hit name, e.g. 29 -> "f1", 32 -> "ab1". */
export function hitName(midi: number): string { return `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`.replace('-', 'm'); }
export const ms = (...names: string[]) => names.map(m);

/** Swung sixteenths: the second and fourth sixteenth of every beat land `swing` ticks late. */
export function swung(step: number, swing: number): number { return step % 2 === 0 ? swing : 0; }

/** Deterministic humanizer: small timing (ticks) and velocity variation from a seeded stream. */
export class Feel {
  private r: Rng;
  constructor(seed: number) { this.r = new Rng(seed); }
  t(spread: number): number { return Math.round(this.r.bi() * spread); }
  v(base: number, spread: number): number { return Math.min(1, Math.max(0.05, base + this.r.bi() * spread)); }
  pick<T>(xs: T[]): T { return xs[Math.floor(this.r.next() * xs.length)]!; }
  chance(p: number): boolean { return this.r.next() < p; }
}
/** Equal-tempered playback rate for a semitone shift. */
export const semis = (n: number) => Number(Math.pow(2, n / 12).toFixed(6));
