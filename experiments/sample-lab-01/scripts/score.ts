/** Shared authoring helpers for the SAMPLE LAB 01 projects: tick arithmetic, human timing, pitch rates and note builders.
 * Positions are authored in absolute pattern ticks (960 PPQ) and written with the engine's own formatter, so every
 * micro-timing offset lands on an exact tick. One tick at 96 BPM is 0.651 ms (28.71 frames). */
import { formatPosition } from '../../../src/timing/musical-time.ts';

export const PPQ = 960, BEAT = 960, BAR = 3840, SIXTEENTH = 240;
const METER = { numerator: 4, denominator: 4 };

/** Milliseconds to ticks at a tempo, rounded to the nearest tick. */
export const msToTicks = (ms: number, bpm: number) => Math.round(ms * bpm * PPQ / 60000);
/** Pattern-relative tick for bar (1-based), beat (1-based) and sixteenths (may be fractional), plus a human offset in ms. */
export function tick(bpm: number, bar: number, beat: number, sixteenths = 0, ms = 0): number {
  return (bar - 1) * BAR + (beat - 1) * BEAT + Math.round(sixteenths * SIXTEENTH) + msToTicks(ms, bpm);
}
/** Wrap a tick into a pattern of `bars` bars so pushes before 1:1 land at the end of the last bar (the loop wraps). */
export function wrap(t: number, bars: number): number { const n = bars * BAR; return ((t % n) + n) % n; }
export const position = (t: number) => formatPosition(t, METER);
/** Equal-tempered playback rate for a semitone shift, six decimals as the schema allows. */
export const rate = (semitones: number) => +(2 ** (semitones / 12)).toFixed(6);
export const round6 = (x: number) => +x.toFixed(6);

export interface Note {
  start: string; velocity: number; pitch?: string; playbackRate?: number; offsetSeconds?: number; endSeconds?: number;
  gate?: string; envelope?: { attackSeconds?: number; releaseSeconds?: number }; chokeGroup?: string;
  glide?: { to: number; duration: string };
}
/** One authored event: `t` is where it plays, `nominal` the grid position it was written against (t - nominal is the
 * player's human offset). */
export interface Ev { t: number; nominal?: number; note: Omit<Note, 'start'> }
/** Grid position plus a human offset in ms, as an event's `t`/`nominal` pair. */
export function place(bpm: number, bar: number, sixteenths: number, ms = 0): { t: number; nominal: number } {
  return { t: tick(bpm, bar, 1, sixteenths, ms), nominal: tick(bpm, bar, 1, sixteenths) };
}

/** Turn events into a sorted pattern note list; ticks wrap into the pattern. Same-tick events stay in authoring order. */
export function notes(events: Ev[], bars: number): Note[] {
  return events.map((e, i) => ({ t: wrap(e.t, bars), i, e }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map(({ t, e }) => ({ start: position(t), ...clean(e.note) }));
}
function clean(n: Omit<Note, 'start'>): Omit<Note, 'start'> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(n)) if (v !== undefined) out[k] = typeof v === 'number' ? round6(v) : v;
  if (typeof out.velocity === 'number') out.velocity = Math.min(1, Math.max(0.01, +(out.velocity as number).toFixed(3)));
  return out as Omit<Note, 'start'>;
}

/** A sampler track holding one pattern that is placed `cycles` times back to back. */
export function samplerTrack(id: string, description: string, sample: string, events: Ev[], opts: {
  bars: number; cycles: number; gainDb?: number; pan?: number; effects?: object[]; automation?: object;
}) {
  return {
    id, description,
    instrument: { type: 'sampler', sample },
    mix: { gainDb: opts.gainDb ?? 0, ...(opts.pan ? { pan: opts.pan } : {}) },
    ...(opts.effects?.length ? { effects: opts.effects } : {}),
    ...(opts.automation ? { automation: opts.automation } : {}),
    clips: Array.from({ length: opts.cycles }, (_, c) => ({ bar: 1 + c * opts.bars, pattern: 'loop' })),
    patterns: [{ id: 'loop', bars: opts.bars, notes: notes(events, opts.bars) }],
  };
}
