/**
 * Musical time, curves, pitch and key helpers for the rack. Beat <-> seconds and beat -> frame use exactly the
 * DaemonV12 engine's arithmetic (integer-microsecond tempo, 960 PPQ, each absolute tick rounded independently),
 * so phrases bounced by the rack land on the same frames the engine computes.
 */
import type { Curve, Key } from './types.ts';

export const RATE = 44100;
export const PPQ = 960;
export const usPerQuarter = (bpm: number) => Math.round(60_000_000 / bpm);
export const beatSecondsOf = (bpm: number) => usPerQuarter(bpm) / 1_000_000;
/** Engine-identical frame of an absolute tick (round, ties toward the later frame). */
export function tickFrame(tick: number, bpm: number): number {
  const denominator = 960n * 1_000_000n, numerator = BigInt(tick) * BigInt(usPerQuarter(bpm)) * BigInt(RATE);
  return Number((numerator + denominator / 2n) / denominator);
}
export const beatTick = (beat: number) => Math.round(beat * PPQ);
export const beatFrame = (beat: number, bpm: number) => tickFrame(beatTick(beat), bpm);
/** Engine-identical output length for a project of `endBeat` beats with an explicit tail (render-plan.ts: one rounding). */
export function engineEndFrames(endBeat: number, bpm: number, tailSeconds: number): number {
  if (!(tailSeconds >= 0 && tailSeconds <= 600) || Number(tailSeconds.toFixed(6)) !== tailSeconds) throw new RangeError('tail seconds: 0..600 with at most six decimals');
  const endTick = BigInt(beatTick(endBeat)), tempo = BigInt(usPerQuarter(bpm)), tailUs = BigInt(tailSeconds.toFixed(6).replace('.', ''));
  return Number(((endTick * tempo + tailUs * 960n) * 44100n + 480000000n) / 960000000n);
}
export const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);

/** Delay notes that sit exactly on an odd sixteenth by the swing amount (0.5 = straight). */
export function swung(beat: number, swing: number): number {
  const s = beat * 4, k = Math.round(s);
  return Math.abs(s - k) < 1e-9 && ((k % 2) + 2) % 2 === 1 ? beat + (swing - 0.5) * 0.5 : beat;
}

/** Value of a curve at a beat. */
export function curveAt(c: Curve, beat: number): number {
  if (typeof c === 'number') return c;
  if (Array.isArray(c)) {
    if (!c.length) return 0;
    if (beat <= c[0]![0]) return c[0]![1];
    for (let i = 1; i < c.length; i++) {
      const [b0, v0] = c[i - 1]!, [b1, v1] = c[i]!;
      if (beat <= b1) return v0 + (v1 - v0) * smooth((beat - b0) / Math.max(1e-9, b1 - b0));
    }
    return c[c.length - 1]![1];
  }
  const pts = c.steps, glide = c.glide ?? 0.1;
  if (!pts.length) return 0;
  let i = -1;
  for (let k = 0; k < pts.length; k++) if (beat >= pts[k]![0]) i = k; else break;
  if (i < 0) return pts[0]![1];
  const from = i > 0 ? pts[i - 1]![1] : pts[0]![1], [bi, vi] = pts[i]!;
  return from + (vi - from) * smooth((beat - bi) / Math.max(1e-9, glide));
}
/** A curve as a function of seconds (what the frozen engines consume). */
export const laneOf = (c: Curve, beatSeconds: number) => (t: number) => curveAt(c, t / beatSeconds);
/** Shift every breakpoint of a curve by `beats` (used when a score section is rendered on its own). */
export function shiftCurve(c: Curve, beats: number): Curve {
  if (typeof c === 'number') return c;
  if (Array.isArray(c)) return c.map(([b, v]) => [b + beats, v] as [number, number]);
  return { steps: c.steps.map(([b, v]) => [b + beats, v] as [number, number]), glide: c.glide };
}

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** MIDI number from a number or a scientific pitch name: 'C4' = 60, 'Eb2', 'E♭2', 'F#1', 'F♯1'. */
export function pitchOf(p: string | number): number {
  if (typeof p === 'number') return p;
  const m = /^([A-Ga-g])(#|♯|b|♭)?(-?\d)$/.exec(p.trim());
  if (!m) throw new Error(`invalid pitch "${p}" (use e.g. C4, Eb2, F#3 or a MIDI number)`);
  const acc = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + PC[m[1]!.toUpperCase()]! + acc;
}
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const pitchName = (midi: number) => `${NAMES[((Math.round(midi) % 12) + 12) % 12]}${Math.floor(Math.round(midi) / 12) - 1}`;
/** 'C minor', 'F# major', 'Bb minor' -> tonic pitch class and mode. */
export function keyOf(label: string, transpose = 0): Key {
  const m = /^([A-G])(#|♯|b|♭)?\s+(major|minor)$/i.exec(label.trim());
  if (!m) throw new Error(`invalid key "${label}" (use e.g. "C minor" or "F# major")`);
  const acc = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0;
  const tonic = (((PC[m[1]!]! + acc + transpose) % 12) + 12) % 12, mode = m[3]!.toLowerCase() as Key['mode'];
  return { tonic, mode, label: `${NAMES[tonic]} ${mode}` };
}
/** Default glass-halo pitches for a key: tonic, third, fifth, seventh, octave and ninth around C6. */
export function haloPitches(key: Key): number[] {
  let root = 72 + key.tonic; if (root < 78) root += 12;
  return key.mode === 'minor' ? [root, root + 3, root + 7, root + 10, root + 12, root + 14] : [root, root + 4, root + 7, root + 11, root + 12, root + 14];
}
