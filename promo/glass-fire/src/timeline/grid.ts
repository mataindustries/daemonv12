// The locked GLASS//FIRE timeline. Every visual and data position derives from here.
//
// 160 BPM in 4/4 at 60 fps: a bar is exactly 90 frames, but a beat is 22.5 frames,
// so odd beats fall between frames. Musical positions are therefore stored as integer
// ticks (DaemonV12's resolution, 960 per beat) and converted to frames only at the edge.
//
//   one tick  = 60 / (160 · 960) s = 1/2560 s
//   frames    = ticks · 60/2560    = ticks · 3/128
//
// ticks · 3/128 is a dyadic rational, so the conversion is exact in IEEE doubles for
// any tick count this promo can reach. Seconds (ticks / 2560) are for display and data
// exchange; comparisons happen in ticks or frames.

export const FPS = 60;
export const BPM = 160;
export const BEATS_PER_BAR = 4;
export const BARS = 16;
export const TICKS_PER_BEAT = 960;
export const TICKS_PER_BAR = TICKS_PER_BEAT * BEATS_PER_BAR;
export const TOTAL_TICKS = TICKS_PER_BAR * BARS;
export const DURATION_IN_FRAMES = 1440;
export const DURATION_SECONDS = 24;
export const FRAMES_PER_BAR = 90;
/** 22.5: deliberately not an integer. */
export const FRAMES_PER_BEAT = 22.5;
export const SECONDS_PER_BEAT = 0.375;
export const SECONDS_PER_BAR = 1.5;

/** Tolerance used when snapping data times (floats from analysis) to frames. */
const FRAME_EPSILON = 1e-6;

export type Ticks = number;

export const ticksToFrames = (ticks: Ticks): number => (ticks * 3) / 128;
export const ticksToSeconds = (ticks: Ticks): number => ticks / 2560;
export const framesToTicks = (frames: number): number => (frames * 128) / 3;
export const framesToSeconds = (frames: number): number => frames / FPS;
export const secondsToFrames = (seconds: number): number => seconds * FPS;
export const secondsToTicks = (seconds: number): number => seconds * 2560;
export const secondsToBeats = (seconds: number): number => seconds / SECONDS_PER_BEAT;
export const beatsToSeconds = (beats: number): number => beats * SECONDS_PER_BEAT;

/**
 * The frame on which a discrete event (a cut, a type hit) lands: the first frame whose
 * timestamp is at or after the event. Bar lines map to themselves (bar 2 → frame 90);
 * an off-frame beat such as 1:2 (frame 22.5) lands on frame 23.
 * Continuous motion never uses this: it samples exact time (frame / FPS) instead.
 */
export const eventFrame = (ticks: Ticks): number => Math.ceil(ticksToFrames(ticks));
export const eventFrameFromSeconds = (seconds: number): number =>
  Math.ceil(secondsToFrames(seconds) - FRAME_EPSILON);

/** Start of a 1-based bar, in ticks. barTicks(17) is the end of the piece. */
export const barTicks = (bar: number): Ticks => {
  if (!Number.isInteger(bar) || bar < 1 || bar > BARS + 1) {
    throw new RangeError(`bar ${bar} is outside 1…${BARS + 1}`);
  }
  return (bar - 1) * TICKS_PER_BAR;
};
/** Start of a 1-based bar, in frames. Always an integer: 90 · (bar − 1). */
export const barFrame = (bar: number): number => ticksToFrames(barTicks(bar));

const POSITION = /^([1-9][0-9]?):([1-4])(?:\+([1-9][0-9]{0,2})\/([1-9][0-9]{0,2}))?$/;

/**
 * DaemonV12 position notation (docs/V0_SPEC.md §3.3): "BAR:BEAT" or "BAR:BEAT+N/D",
 * 1-based, with the offset in whole-note fractions ("5:2+1/8" is an eighth after beat 2).
 * The offset must stay inside its beat and land on the tick grid.
 */
export const pos = (position: string): Ticks => {
  const match = POSITION.exec(position);
  if (!match) throw new SyntaxError(`invalid position "${position}"; write BAR:BEAT or BAR:BEAT+N/D`);
  const bar = Number(match[1]);
  const beat = Number(match[2]);
  if (bar > BARS) throw new RangeError(`position "${position}" is past bar ${BARS}`);
  let offset = 0;
  if (match[3] !== undefined && match[4] !== undefined) {
    offset = (TICKS_PER_BAR * Number(match[3])) / Number(match[4]);
    if (!Number.isInteger(offset)) throw new RangeError(`position "${position}" is off the ${TICKS_PER_BEAT}-tick grid`);
    if (offset >= TICKS_PER_BEAT) throw new RangeError(`offset in "${position}" must be shorter than one beat`);
  }
  return barTicks(bar) + (beat - 1) * TICKS_PER_BEAT + offset;
};

/** Whole-note fraction ("1/8", "3/16") to ticks. */
export const dur = (fraction: string): Ticks => {
  const match = /^([1-9][0-9]{0,2})\/([1-9][0-9]{0,2})$/.exec(fraction);
  if (!match) throw new SyntaxError(`invalid duration "${fraction}"`);
  const ticks = (TICKS_PER_BAR * Number(match[1])) / Number(match[2]);
  if (!Number.isInteger(ticks)) throw new RangeError(`duration "${fraction}" is off the tick grid`);
  return ticks;
};

export type MusicalTime = {
  /** 1-based bar, clamped to 1…16. */
  bar: number;
  /** 1-based beat in the bar. */
  beat: number;
  /** 1-based sixteenth inside the beat (1…4). */
  sixteenth: number;
  /** 0…1 progress through the current beat. */
  beatPhase: number;
  /** 0…1 progress through the current bar. */
  barPhase: number;
  /** Continuous beat count from the start (0 at frame 0). */
  beats: number;
};

export const musicalTimeAtFrame = (frame: number): MusicalTime => {
  const ticks = Math.min(Math.max(framesToTicks(frame), 0), TOTAL_TICKS - 1e-6);
  const barIndex = Math.floor(ticks / TICKS_PER_BAR);
  const inBar = ticks - barIndex * TICKS_PER_BAR;
  const beatIndex = Math.floor(inBar / TICKS_PER_BEAT);
  const inBeat = inBar - beatIndex * TICKS_PER_BEAT;
  return {
    bar: barIndex + 1,
    beat: beatIndex + 1,
    sixteenth: Math.floor(inBeat / (TICKS_PER_BEAT / 4)) + 1,
    beatPhase: inBeat / TICKS_PER_BEAT,
    barPhase: inBar / TICKS_PER_BAR,
    beats: ticks / TICKS_PER_BEAT,
  };
};

/** Every beat in [fromSeconds, toSeconds], as exact beat indices and times. */
export const beatsBetween = (fromSeconds: number, toSeconds: number) => {
  const first = Math.max(0, Math.ceil(secondsToBeats(fromSeconds) - 1e-9));
  const last = Math.min(BARS * BEATS_PER_BAR, Math.floor(secondsToBeats(toSeconds) + 1e-9));
  const beats: {index: number; seconds: number; isBar: boolean; bar: number}[] = [];
  for (let index = first; index <= last; index++) {
    beats.push({
      index,
      seconds: beatsToSeconds(index),
      isBar: index % BEATS_PER_BAR === 0,
      bar: Math.floor(index / BEATS_PER_BAR) + 1,
    });
  }
  return beats;
};
