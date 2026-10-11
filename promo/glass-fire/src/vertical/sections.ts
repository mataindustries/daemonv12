// The five sections of the vertical cut, in output bars. Every boundary is a bar line and
// a hard cut, as in the landscape film.
import {songBarOf, V_BARS, V_DURATION_IN_FRAMES, V_FRAMES_PER_BAR} from './edit.ts';

export type VSectionId = 'hook' | 'drop1' | 'fakeout' | 'drop2' | 'payoff';

export type VSection = {
  id: VSectionId;
  title: string;
  /** 1-based output bars, inclusive. */
  firstBar: number;
  lastBar: number;
  from: number;
  durationInFrames: number;
  /** Song bars heard, for labels and reports. */
  songBars: number[];
};

const section = (id: VSectionId, title: string, firstBar: number, lastBar: number): VSection => ({
  id,
  title,
  firstBar,
  lastBar,
  from: (firstBar - 1) * V_FRAMES_PER_BAR,
  durationInFrames: (lastBar - firstBar + 1) * V_FRAMES_PER_BAR,
  songBars: Array.from({length: lastBar - firstBar + 1}, (_, i) => songBarOf(firstBar + i)),
});

export const V_SECTIONS: readonly VSection[] = [
  section('hook', 'HOOK', 1, 1),
  section('drop1', 'DROP 1', 2, 3),
  section('fakeout', 'FAKEOUT', 4, 5),
  section('drop2', 'DROP 2', 6, 8),
  section('payoff', 'PAYOFF', 9, 10),
];

export const V_SECTION: Readonly<Record<VSectionId, VSection>> = Object.fromEntries(V_SECTIONS.map(s => [s.id, s])) as Record<VSectionId, VSection>;

export const sectionAtFrame = (frame: number): VSection => {
  for (const s of V_SECTIONS) if (frame >= s.from && frame < s.from + s.durationInFrames) return s;
  return frame < 0 ? V_SECTIONS[0]! : V_SECTIONS[V_SECTIONS.length - 1]!;
};

{
  let cursor = 0;
  for (const s of V_SECTIONS) {
    if (s.from !== cursor) throw new Error(`section ${s.id} starts at ${s.from}, expected ${cursor}`);
    cursor += s.durationInFrames;
  }
  if (cursor !== V_DURATION_IN_FRAMES || V_SECTIONS[V_SECTIONS.length - 1]!.lastBar !== V_BARS) throw new Error(`sections cover ${cursor} frames, expected ${V_DURATION_IN_FRAMES}`);
}
