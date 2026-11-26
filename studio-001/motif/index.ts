/** DaemonV12 v0.9 motif development layer: public entry point. Sits on top of the unchanged Signature Rack. */
import { normalizeScore, type NormalizedScore, type NormalizeOptions } from '../rack/score.ts';
import { lowerScore } from './motif.ts';
import { SCORE_SCHEMA_V2 } from './types.ts';

export * from './types.ts';
export { lowerScore, expandMotif, applyTransform, transformLabel, stepToMidi, cellPitches, SCALES, GESTURES, TRANSFORM_OPS, NON_DEVELOPING, LIMITS as MOTIF_LIMITS, type LowerOptions } from './motif.ts';
export { GESTURE_TABLE, gesturesOf, type Gestures } from './gestures.ts';
export { motifReport, motifEvents, onsetFrame, hook10Gate, type MotifReport, type MotifEvents, type MotifEvent } from './report.ts';

export const isMotifScore = (input: unknown): boolean => (input as { schema?: unknown } | null)?.schema === SCORE_SCHEMA_V2;
/**
 * Normalise any saved score. A `score/2` is lowered first and then handed to the rack's `normalizeScore`; a `score/1`
 * goes to the rack untouched, so its performance and audio are what the approved rack alone produces.
 */
export function normalizeAnyScore(input: unknown, opts: NormalizeOptions = {}): NormalizedScore {
  return normalizeScore(isMotifScore(input) ? lowerScore(input, opts.transpose !== undefined ? { transpose: opts.transpose } : {}).score : input, opts);
}
