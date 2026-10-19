// Locked musical grid for IGNITION 002: SECOND WIND.
// 128 BPM, 4/4, eight bars, 32 beats: exactly 15 s, which is exactly 900 frames at 60 fps.
// A beat is 28.125 frames and a bar 112.5 frames, so continuous motion always samples the
// exact time t = frame / FPS rather than rounding musical positions to frames.

export const FPS = 60;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export const BPM = 128;
export const BEAT = 60 / BPM; // 0.46875 s
export const BAR = 4 * BEAT; // 1.875 s
export const BARS = 8;
export const BEATS = BARS * 4;
export const STEPS = BEATS * 4; // sixteenth notes in the loop
export const STEP = BEAT / 4;
export const LOOP = BARS * BAR; // 15 s
export const DURATION_IN_FRAMES = LOOP * FPS; // 900

/** The four two-bar movements of the brief. */
export const SECTION = 2 * BAR; // 3.75 s
export const SECTIONS = [
  {name: 'ACTIVE', start: 0},
  {name: 'ACCELERATE', start: SECTION},
  {name: 'OPEN', start: 2 * SECTION},
  {name: 'CONVERGE', start: 3 * SECTION},
] as const;

/** Wraps any time into [0, LOOP). */
export const wrap = (t: number) => ((t % LOOP) + LOOP) % LOOP;

/** Time of a beat (0-based, may be fractional). */
export const beat = (b: number) => b * BEAT;
/** Time of a bar line (0-based bar index). */
export const bar = (b: number) => b * BAR;

/** Seconds from `from` forward to `t` around the loop, in [0, LOOP). */
export const since = (t: number, from: number) => wrap(t - from);
