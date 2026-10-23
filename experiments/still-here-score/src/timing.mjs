// Engine-exact timing. Every external event is scheduled on the frame DaemonV12 itself would
// resolve for the same musical position, using the engine's own compiled functions
// (dist/src/timing/musical-time.js, built by `npm ci`). Positions are counted in absolute
// sixteenths from the start of the piece; quarter-sixteenths (32nds, 64ths) are allowed.
import { ticksToFrames, usPerQuarter, formatPosition } from '../../../dist/src/timing/musical-time.js';

export const RATE = 44100, FPS = 60, FRAMES = 529200, SECONDS = 12, IGNITION_FRAME = 176400;
export const TICKS_PER_16TH = 240;

/** A 4/4 grid at `bpm`. pos = absolute sixteenths from the start (may be fractional on the 960-PPQ grid). */
export function grid(bpm) {
  const tempo = usPerQuarter(bpm), meter = { numerator: 4, denominator: 4 };
  const tick = pos => {
    const t = pos * TICKS_PER_16TH;
    if (!Number.isInteger(t)) throw new RangeError(`position ${pos} is off the 960-PPQ grid`);
    return t;
  };
  const frame = pos => ticksToFrames(tick(pos), tempo);
  return {
    bpm, tempo,
    tick, frame,
    /** Seconds of the engine-resolved frame (what the listener hears). */
    sec: pos => frame(pos) / RATE,
    /** Pattern-relative position string for a note inside a pattern that starts at bar 1. */
    position: pos => formatPosition(tick(pos), meter),
    /** 60 fps picture frame showing when the event sounds (floor, MORPH convention). */
    picture: pos => Math.floor(frame(pos) * FPS / RATE),
  };
}

export const pictureOfFrame = f => Math.floor(f * FPS / RATE);
/** Wall seconds -> nearest frame, ties later (the engine's wall-time rule). */
export const frameOfSeconds = s => Math.floor(s * RATE + 0.5);
