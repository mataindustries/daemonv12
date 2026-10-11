// The six acts. Every boundary is a bar line, so every act starts on an integer frame
// and the largest visual transitions (hard cuts between acts) are frame-exact.
import {barFrame, BARS, DURATION_IN_FRAMES} from './grid.ts';

export type ActId = 'hook' | 'ignition' | 'drop1' | 'fakeout' | 'drop2' | 'payoff';

export type Act = {
  id: ActId;
  index: number;
  title: string;
  /** 1-based first bar. */
  firstBar: number;
  /** 1-based last bar (inclusive). */
  lastBar: number;
  from: number;
  durationInFrames: number;
};

const act = (id: ActId, index: number, title: string, firstBar: number, lastBar: number): Act => ({
  id,
  index,
  title,
  firstBar,
  lastBar,
  from: barFrame(firstBar),
  durationInFrames: barFrame(lastBar + 1) - barFrame(firstBar),
});

export const ACTS: readonly Act[] = [
  act('hook', 1, 'HOOK', 1, 2),
  act('ignition', 2, 'IGNITION', 3, 4),
  act('drop1', 3, 'DROP 1', 5, 8),
  act('fakeout', 4, 'FAKEOUT', 9, 10),
  act('drop2', 5, 'DROP 2', 11, 14),
  act('payoff', 6, 'PAYOFF', 15, 16),
];

export const ACT: Readonly<Record<ActId, Act>> = Object.fromEntries(ACTS.map(a => [a.id, a])) as Record<ActId, Act>;

export const actAtFrame = (frame: number): Act => {
  for (const a of ACTS) if (frame >= a.from && frame < a.from + a.durationInFrames) return a;
  return frame < 0 ? ACTS[0]! : ACTS[ACTS.length - 1]!;
};

// Structural sanity, checked at import so a bad edit fails loudly in Studio and tests.
{
  let cursor = 0;
  for (const a of ACTS) {
    if (a.from !== cursor) throw new Error(`act ${a.id} starts at ${a.from}, expected ${cursor}`);
    cursor += a.durationInFrames;
  }
  if (cursor !== DURATION_IN_FRAMES) throw new Error(`acts cover ${cursor} frames, expected ${DURATION_IN_FRAMES}`);
  if (ACTS[ACTS.length - 1]!.lastBar !== BARS) throw new Error('acts must end on the last bar');
}
