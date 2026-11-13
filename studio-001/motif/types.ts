/**
 * DaemonV12 v0.9 motif development layer: public, versioned types. Pure types and constants.
 * The layer sits on top of the approved Signature Rack (studio-001/rack, interface 1.0.0) and never changes it:
 * a `score/2` score lowers to an ordinary rack `score/1` score before the rack sees anything.
 */
import type { PartInput, ScoreInput } from '../rack/types.ts';

/** Interface contract version of the motif layer. */
export const MOTIF_INTERFACE_VERSION = '0.9.0';
/** Motif score schema: `motifs` and `parts[].phrases`, lowered to a rack `score/1` before anything renders. */
export const SCORE_SCHEMA_V2 = 'daemonv12.signature-rack.score/2';
/** Symbolic report and event-map schema identifiers. */
export const REPORT_SCHEMA = 'daemonv12.motif-report/1';
export const EVENTS_SCHEMA = 'daemonv12.motif-events/1';

export type ScaleName = 'major' | 'minor' | 'harmonic-minor';
/** Portable expressive gestures. Each instrument maps them onto its own articulations (see gestures.ts). */
export type Gesture = 'accent' | 'soft' | 'short' | 'legato' | 'lift' | 'fall';
/** What a gesture means on one instrument: an articulation, per-note params, and velocity / length multipliers. */
export interface GestureMap { articulation?: string; params?: Record<string, number | string>; velocity?: number; beats?: number }

export interface MotifNoteOptions {
  /** chromatic alteration of the scale step (e.g. the raised 7th) */
  alt?: -1 | 0 | 1;
  gesture?: Gesture;
  /** explicit articulation and slide; an explicit articulation overrides the gesture's */
  articulation?: string; slide?: number;
  /** instrument per-note params, e.g. { vowel: 'oh', to: 'ah' }; override the gesture's */
  params?: Record<string, number | string>;
}
/**
 * [beat, beats, step, velocity?, options?]. `beat` is relative to the motif start. `step` is a scale step relative to
 * the key tonic in the motif's `octave`: 0 = tonic, 7 = tonic + 1 octave, -1 = the 7th degree below.
 */
export type MotifNoteInput = [number, number, number, number?, MotifNoteOptions?];
export interface MotifInput {
  id: string;
  role?: 'hook' | 'answer' | 'figure' | 'bass';
  /** octave of step 0, default 4 (C minor: C4 = 60). A derived motif inherits its source's octave. */
  octave?: number;
  /** default: the end of the last note */
  lengthBeats?: number;
  /** a literal motif ... */
  notes?: MotifNoteInput[];
  /** ... or a derived one: the source motif id and the transforms applied to it (exclusive with `notes`) */
  from?: string;
  transforms?: Transform[];
}
export type Transform =
  | { op: 'transpose'; steps: number }
  | { op: 'shift'; semitones: number }
  | { op: 'octave'; by: number }
  | { op: 'invert'; axis?: number }
  | { op: 'retrograde' }
  | { op: 'scale'; factor: 0.25 | 0.5 | 0.6667 | 1.5 | 2 | 4 }
  | { op: 'rhythm'; durations: number[] }
  | { op: 'fragment'; from: number; to: number }
  | { op: 'sequence'; steps: number[]; every: number }
  | { op: 'displace'; beats: number }
  | { op: 'endOn'; step: number; alt?: -1 | 0 | 1 }
  | { op: 'mode'; to: ScaleName }
  | { op: 'ornament'; at: number; kind: 'turn' | 'upper' | 'lower' }
  | { op: 'gesture'; set: Gesture; at?: number[] }
  | { op: 'dynamics'; from: number; to: number };
export interface PhraseInput {
  /** used in traces and event maps; default `${part}.p${index}` */
  id?: string;
  motif: string;
  /** absolute beat, or a section-relative position: `bar` is 1-based, `beat` is the 0-based offset inside the bar (4/4) */
  at: number | { section: string; bar: number; beat?: number };
  /** applied after the motif's own chain */
  transforms?: Transform[];
  /** velocity multiplier, default 1 */
  velocity?: number;
  /** out-of-range handling, default 'error'; 'octave' moves the whole phrase by the fewest octaves that fit */
  fit?: 'error' | 'octave';
}
export interface ScoreInputV2 extends Omit<ScoreInput, 'schema' | 'parts'> {
  schema: typeof SCORE_SCHEMA_V2;
  motifs: MotifInput[];
  parts: (PartInput & { phrases?: PhraseInput[] })[];
}

/** One note of a motif cell while it is being transformed; pitch is resolved only when the cell is lowered. */
export interface CellNote {
  beat: number; beats: number; step: number; alt: number; semis: number; velocity: number;
  gesture?: Gesture; articulation?: string; slide?: number; params?: Record<string, number | string>;
  /** analysis only: which `sequence` copy the note belongs to, and its ornament group (`main` marks the principal piece) */
  seg: number; orn?: number; main?: boolean;
}
export interface Cell { lengthBeats: number; scale: ScaleName; octave: number; notes: CellNote[] }

/** One placed statement of a motif, with everything the report and the event map need. */
export interface LoweredPhrase {
  id: string; part: string; motif: string;
  /** the literal motif this statement ultimately derives from, and that motif's role */
  root: string; role: string | null;
  /** every transform between the root motif and these notes, in order */
  chain: string[];
  /** where the phrase was placed, the onset of its first note, and the cell length */
  at: number; beat: number; lengthBeats: number;
  /** octaves moved by `fit: 'octave'` */
  octaveShift: number;
  /** no pitch- or rhythm-changing transform in the chain */
  literal: boolean;
  /** the statement keeps (a contiguous window of) the root motif's Parsons contour / onset-duration pattern */
  keepsContour: boolean; keepsRhythm: boolean;
  notes: { beat: number; beats: number; pitch: number; velocity: number }[];
}
export interface LoweredScore {
  /** schema /1, plain notes: what `normalizeScore` and every renderer see */
  score: ScoreInput;
  /** one entry per lowered note, in output order */
  trace: { part: string; phrase: string; motif: string; note: number; chain: string[] }[];
  /** warnings (lowering errors throw): dropped foreign params and articulations, with fix hints */
  problems: string[];
  phrases: LoweredPhrase[];
  /** how many motif-note params or articulations were dropped because the target instrument does not have them */
  droppedParams: number;
}
