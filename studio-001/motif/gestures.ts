/**
 * Portable gestures (v0.9, data only): how each of the six motif gestures is played on every rack instrument, using
 * only articulations and per-note params the approved instruments already have. A missing gesture leaves the note
 * as written. The rack and its instruments are not changed; tests check every entry against the live registry.
 */
import type { Gesture, GestureMap } from './types.ts';

export type Gestures = Partial<Record<Gesture, GestureMap>>;
const PLAIN_GESTURES: Gestures = { accent: { velocity: 1.15 }, soft: { velocity: 0.7 }, short: { beats: 0.5 } };
export const GESTURE_TABLE: Record<string, Gestures> = {
  'living-bass': { accent: { articulation: 'accent' }, soft: { articulation: 'ghost' }, short: { articulation: 'staccato' }, legato: { articulation: 'legato' },
    lift: { articulation: 'normal', params: { scoop: 2 } }, fall: { articulation: 'normal', params: { dive: 2 } } },
  'impossible-voice': { accent: { articulation: 'sung', velocity: 1.12 }, soft: { articulation: 'hum', velocity: 0.7 }, short: { articulation: 'detached' }, legato: { articulation: 'legato' },
    lift: { articulation: 'sung', params: { cry: 1 } }, fall: { articulation: 'fall', params: { fall: 0.8 } } },
  'mechanical-orchestra/bar': { accent: { articulation: 'hard' }, soft: { articulation: 'soft' }, short: { articulation: 'muted' }, legato: { articulation: 'ring' },
    lift: { articulation: 'strike', params: { hardness: 0.7 } }, fall: { articulation: 'ring', params: { damp: 1.2 } } },
  'mechanical-orchestra/bow': { accent: { articulation: 'bite' }, soft: { articulation: 'swell', velocity: 0.7 }, short: { articulation: 'bite', beats: 0.5 }, legato: { articulation: 'swell' },
    lift: { articulation: 'swell' }, fall: { articulation: 'swell' } },
  'mechanical-orchestra/spring': { accent: { articulation: 'twang' }, soft: { articulation: 'pluck', velocity: 0.7 }, short: { articulation: 'damped' }, lift: { articulation: 'twang' } },
  'mechanical-orchestra/tine': { accent: { articulation: 'buzz' }, soft: { articulation: 'clean', velocity: 0.7 }, short: { articulation: 'clean', beats: 0.5 } },
  'mechanical-orchestra/clock': PLAIN_GESTURES, 'mechanical-orchestra/bearings': PLAIN_GESTURES, 'context/kick': PLAIN_GESTURES, 'context/snare': PLAIN_GESTURES,
};
/** The gesture table of an instrument id (empty for an unknown id). */
export const gesturesOf = (instrument: string): Gestures => GESTURE_TABLE[instrument] ?? {};
