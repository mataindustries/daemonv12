// The one document the film reads from the music. `scripts/analyze.ts` writes it from the
// approved WAV (source "analysis"); `--grid` writes a labelled stand-in from the locked
// 128 BPM grid (source "grid") so the picture can be built before the audio arrives.
import {BAR, BEAT, BEATS, DURATION_IN_FRAMES, LOOP, STEP, STEPS} from '../timeline.ts';
import type {Hit} from '../motion/periodic.ts';

export type SyncData = {
  version: 1;
  source: 'analysis' | 'grid';
  note: string;
  audio: null | {
    file: string;
    sha256: string;
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
    frames: number;
    seconds: number;
  };
  bpm: number;
  loopSeconds: number;
  /** Measured offset of the first downbeat from t = 0, seconds (0 for the grid). */
  gridOffset: number;
  /** Low-band transients (kick). Times in seconds inside the loop, strengths 0…1. */
  kick: Hit[];
  /** Mid-band transients (snare, clap, stabs). */
  snare: Hit[];
  /** High-band transients (hats, shakers, ticks). */
  hat: Hit[];
  /** The structurally strongest moments, broadband. */
  accents: Hit[];
  /** Per video frame (900 values), 0…1. */
  loudness: number[];
  low: number[];
  mid: number[];
  high: number[];
};

export const assertSync = (data: SyncData): SyncData => {
  const fail = (m: string) => {
    throw new Error(`sync data: ${m}`);
  };
  if (data.version !== 1) fail('version must be 1');
  if (data.loopSeconds !== LOOP) fail(`loop must be ${LOOP} s`);
  for (const key of ['kick', 'snare', 'hat', 'accents'] as const) {
    for (const h of data[key]) if (!(h.t >= 0 && h.t < LOOP && h.s >= 0 && h.s <= 1)) fail(`${key} hit out of range: ${JSON.stringify(h)}`);
  }
  for (const key of ['loudness', 'low', 'mid', 'high'] as const) {
    if (data[key].length !== DURATION_IN_FRAMES) fail(`${key} must have ${DURATION_IN_FRAMES} values`);
  }
  if (data.kick.length === 0) fail('no kick hits');
  return data;
};

const round = (v: number) => Math.round(v * 10000) / 10000;

/**
 * The locked grid as a stand-in, before the approved WAV is analysed. It is a placeholder,
 * not a claim about the track: kick on every beat, backbeat on 2 and 4, off-beat hats,
 * phrase accents on odd bar lines, flat loudness.
 */
export const gridSync = (): SyncData => {
  const kick: Hit[] = [];
  const snare: Hit[] = [];
  const hat: Hit[] = [];
  const accents: Hit[] = [];
  for (let b = 0; b < BEATS; b++) {
    kick.push({t: round(b * BEAT), s: b % 4 === 0 ? 1 : 0.85});
    if (b % 4 === 1 || b % 4 === 3) snare.push({t: round(b * BEAT), s: 0.8});
  }
  for (let s = 0; s < STEPS; s++) if (s % 4 === 2) hat.push({t: round(s * STEP), s: 0.5});
  for (let b = 0; b < 8; b += 2) accents.push({t: round(b * BAR), s: 1});
  const flat = (v: number) => Array.from({length: DURATION_IN_FRAMES}, () => v);
  return {
    version: 1,
    source: 'grid',
    note: 'Placeholder from the locked 128 BPM grid. The approved WAV has not been analysed; run scripts/analyze.ts on it before the final render.',
    audio: null,
    bpm: 128,
    loopSeconds: LOOP,
    gridOffset: 0,
    kick,
    snare,
    hat,
    accents,
    loudness: flat(0.7),
    low: flat(0.6),
    mid: flat(0.5),
    high: flat(0.4),
  };
};
