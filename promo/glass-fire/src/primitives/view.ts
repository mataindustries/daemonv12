// One shared time→x mapping, so lanes, grid, automation, spectrum and markers scroll as
// a single instrument. The playhead is fixed; music flows right to left through it.

export type TimeView = {
  /** Current time in seconds (global). */
  now: number;
  /** Screen x of the playhead. */
  playheadX: number;
  /** Pixels per second. 160 BPM: one beat = 0.375 s. */
  pps: number;
  /** Visible screen span. */
  left: number;
  right: number;
};

export const tx = (view: TimeView, t: number) => view.playheadX + (t - view.now) * view.pps;

export const visibleTimes = (view: TimeView): [number, number] => [
  view.now - (view.playheadX - view.left) / view.pps,
  view.now + (view.right - view.playheadX) / view.pps,
];

/** Crisp 1px lines: snap to pixel centres. */
export const crisp = (v: number) => Math.round(v) + 0.5;
