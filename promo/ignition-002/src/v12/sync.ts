// Music data for the V12 film, written by `scripts/analyze-v12.ts` from the approved WAV.
// Extends the V1 contract with the two layers this film needs: brass (stabs and phrases) and
// a sustained bass envelope, measured separately from the kick.
import type {Hit} from '../motion/periodic.ts';
import {DURATION_IN_FRAMES, LOOP} from '../timeline.ts';

export type Phrase = {start: number; end: number; s: number};

export type V12Sync = {
  version: 1;
  source: 'analysis' | 'grid';
  note: string;
  audio: null | {file: string; sha256: string; sampleRate: number; channels: number; bitsPerSample: number; frames: number; seconds: number};
  bpm: number;
  loopSeconds: number;
  gridOffset: number;
  kick: Hit[];
  snare: Hit[];
  hat: Hit[];
  /** Tonal brass/horn stab onsets. */
  brass: Hit[];
  /** Sustained brass phrases (start/end seconds, strength). */
  brassPhrases: Phrase[];
  /** Structural accents: the re-ignition after the dropout and the payoff. */
  accents: Hit[];
  /** Spans where the whole mix collapses. */
  dropouts: Phrase[];
  /** Named structural moments (seconds), measured: re-ignition after the dropout, and the payoff. */
  markers: {reignite: number; payoff: number};
  /** Per video frame (900 values), 0…1. */
  bass: number[];
  loudness: number[];
};

export const assertV12Sync = (d: V12Sync): V12Sync => {
  const fail = (m: string) => {
    throw new Error(`V12 sync data: ${m}`);
  };
  if (d.version !== 1) fail('version must be 1');
  if (d.loopSeconds !== LOOP) fail(`loop must be ${LOOP} s`);
  for (const k of ['kick', 'snare', 'hat', 'brass', 'accents'] as const) for (const h of d[k]) if (!(h.t >= 0 && h.t < LOOP && h.s >= 0 && h.s <= 1)) fail(`${k} hit out of range ${JSON.stringify(h)}`);
  for (const p of d.brassPhrases) if (!(p.start >= 0 && p.end > p.start && p.end <= LOOP + 1e-9 && p.s >= 0 && p.s <= 1)) fail(`bad phrase ${JSON.stringify(p)}`);
  for (const k of ['bass', 'loudness'] as const) if (d[k].length !== DURATION_IN_FRAMES) fail(`${k} must have ${DURATION_IN_FRAMES} values`);
  if (d.kick.length === 0) fail('no kicks');
  for (const [k, v] of Object.entries(d.markers ?? {})) if (!(v >= 0 && v < LOOP)) fail(`marker ${k} out of range`);
  if (!d.markers) fail('missing markers');
  return d;
};
