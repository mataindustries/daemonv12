/** Authoring helpers for the SAMPLE LAB 02 sketches. Adapted from sample-lab-01/scripts/score.ts and made meter-aware,
 * because the three sketches use 6/4, 4/4 and 5/4. Positions are absolute pattern ticks (960 PPQ) written with the
 * engine's own formatter, so every human offset lands on an exact tick. */
import { formatPosition, type TimeSignature } from '../../../src/timing/musical-time.ts';

export const PPQ = 960, SIXTEENTH = 240;
export const meter = (ts: string): TimeSignature => { const [n, d] = ts.split('/').map(Number); return { numerator: n!, denominator: d! }; };
export const barTicks = (m: TimeSignature) => m.numerator * 3840 / m.denominator;
export const msToTicks = (ms: number, bpm: number) => Math.round(ms * bpm * PPQ / 60000);
export const rate = (semitones: number) => +(2 ** (semitones / 12)).toFixed(6);
export const round6 = (x: number) => +x.toFixed(6);
export const wrap = (t: number, cycle: number) => ((t % cycle) + cycle) % cycle;

export interface Note {
  start: string; velocity: number; playbackRate?: number; offsetSeconds?: number; endSeconds?: number;
  gate?: string; envelope?: { attackSeconds?: number; releaseSeconds?: number }; chokeGroup?: string;
  glide?: { to: number; duration: string };
}
/** One authored event: `t` is where it plays, `nominal` the grid tick it was written against (t - nominal is the
 * player's human offset). */
export interface Ev { t: number; nominal: number; note: Omit<Note, 'start'> }

/** A sketch's clock: its tempo, meter and cycle length (one cycle is one pattern of `bars` bars). */
export function clock(bpm: number, ts: string, bars: number) {
  const m = meter(ts), cycle = bars * barTicks(m);
  /** Beat (1-based, may be fractional in sixteenths via `sixteenths`) plus a human offset in ms. */
  const at = (beat: number, sixteenths = 0, ms = 0): { t: number; nominal: number } => {
    const nominal = Math.round((beat - 1) * PPQ + sixteenths * SIXTEENTH);
    return { t: nominal + msToTicks(ms, bpm), nominal };
  };
  /** Pattern note list, sorted; ticks wrap into the cycle so pushes before 1:1 sound at the end of the loop. */
  const notes = (events: Ev[]): Note[] => events.map((e, i) => ({ t: wrap(e.t, cycle), i, e }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map(({ t, e }) => ({ start: formatPosition(t, m), ...clean(e.note) }));
  /** A sampler track: one pattern placed `cycles` times back to back. */
  const track = (id: string, description: string, sample: string, events: Ev[], o: { cycles: number; gainDb?: number; pan?: number; effects?: object[]; automation?: object }) => ({
    id, description, instrument: { type: 'sampler', sample },
    mix: { gainDb: o.gainDb ?? 0, ...(o.pan ? { pan: o.pan } : {}) },
    ...(o.effects?.length ? { effects: o.effects } : {}),
    ...(o.automation ? { automation: o.automation } : {}),
    clips: Array.from({ length: o.cycles }, (_, c) => ({ bar: 1 + c * bars, pattern: 'loop' })),
    patterns: [{ id: 'loop', bars, notes: notes(events) }],
  });
  return { bpm, ts, meter: m, bars, cycle, at, notes, track, position: (t: number) => formatPosition(t, m) };
}
function clean(n: Omit<Note, 'start'>): Omit<Note, 'start'> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(n)) if (v !== undefined) out[k] = typeof v === 'number' ? round6(v) : v;
  if (typeof out.velocity === 'number') out.velocity = Math.min(1, Math.max(0.01, +(out.velocity as number).toFixed(3)));
  if (out.glide && typeof out.glide === 'object') { const g = out.glide as { to: number; duration: string }; out.glide = { to: round6(g.to), duration: g.duration }; }
  return out as Omit<Note, 'start'>;
}
/** A one-shot print: render a single performed note of a source into a new sample (a resampling generation). */
export function printProject(o: { title: string; description: string; sample: string; seconds: number; note: Omit<Note, 'start'>; effects?: object[] }) {
  return {
    formatVersion: 1, title: o.title, description: o.description, bpm: 120, timeSignature: '4/4', bars: 1, seed: 1,
    render: { duration: { seconds: o.seconds }, tail: 'none' },
    master: { gainDb: 0, ...(o.effects ? { effects: o.effects } : {}) },
    tracks: [{ id: 'print', description: o.description, instrument: { type: 'sampler', sample: o.sample }, mix: { gainDb: 0 },
      clips: [{ bar: 1, pattern: 'one' }], patterns: [{ id: 'one', bars: 1, notes: [{ start: '1:1', ...clean(o.note) }] }] }],
  };
}
