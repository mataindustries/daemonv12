/**
 * DAEMON//STUDIO 001 · Signature Instrument Rack — public, versioned instrument interface.
 * Pure types and constants: no audio code, no I/O. Everything a composer or another tool needs to address the
 * three approved instrument families from a new project.
 */

/** Interface contract version. Breaking changes to these types bump the major version. */
export const RACK_INTERFACE_VERSION = '1.1.0';
/** Saved-score schema identifier. */
export const SCORE_SCHEMA = 'daemonv12.signature-rack.score/1';
/** Motif score schema (v0.9): `motifs` and `parts[].phrases`, lowered to a `/1` score before anything renders. */
export const SCORE_SCHEMA_V2 = 'daemonv12.signature-rack.score/2';
/** Package (bounce) schema identifier. */
export const PACKAGE_SCHEMA = 'daemonv12.signature-rack.package/1';

/**
 * A continuous control over musical time (beats, quarter notes from the start of the piece).
 * - a number: constant;
 * - `[[beat, value], ...]`: smooth (smoothstep) ramps between breakpoints, held outside them;
 * - `{ steps: [[beat, value], ...], glide }`: holds each value, gliding into it over `glide` beats.
 */
export type Curve = number | [number, number][] | { steps: [number, number][]; glide?: number };

export type Family = 'living-bass' | 'impossible-voice' | 'mechanical-orchestra' | 'context';

/** One performed note after score normalisation. Times are in beats; pitch is MIDI (fractional allowed). */
export interface NoteEvent {
  beat: number;
  beats: number;
  pitch: number;
  velocity: number;
  /** instrument-specific articulation name; see the instrument's `articulations` */
  articulation?: string;
  /** legato travel time from the previous pitch, in beats */
  slide?: number;
  /** instrument-specific per-note values (vowel, scoop, cry, fall, dive, damp, hardness, ...) */
  params?: Record<string, number | string>;
}

export interface Breath { beat: number; beats: number; kind: 'in' | 'out'; velocity?: number }
/** Tempo-synced rhythmic modulation for the Living Bass (beats). `preset` or an explicit pattern. */
export interface MotionSpan {
  fromBeat: number; toBeat: number;
  preset?: 'none' | 'breath' | 'eighths' | 'sixteenths' | 'triplets' | 'revving' | 'thirty-seconds' | 'growl';
  div?: number; pattern?: number[]; shape?: 'decay' | 'ramp' | 'gate' | 'hold'; tau?: number;
}

/** Everything one part asks of its instrument. */
export interface PartPerformance {
  notes: NoteEvent[];
  /** the family's transformation macro, 0 (first state) .. 1 (second state) */
  macro: Curve;
  /** absolute values for continuous timbre controls (replace the macro mapping) */
  controls: Record<string, Curve>;
  /** offsets added to the macro mapping of a control */
  offsets: Record<string, Curve>;
  /** dynamics/intensity, 0..1 (0.7 = neutral); shapes level and brightness continuously */
  expression: Curve;
  /** per-part fixed options (seed, voice size, detune, hocket spread, halo pitches, ...) */
  setup: Record<string, number | string | number[]>;
  breaths: Breath[];
  motion: MotionSpan[];
  /** Impossible Voice overtone-melody lane (harmonic numbers) */
  overtone?: Curve;
}

export interface Key { tonic: number; mode: 'major' | 'minor'; label: string }
export interface RenderContext {
  bpm: number;
  /** seconds per beat exactly as the DaemonV12 engine computes it (integer microseconds) */
  beatSeconds: number;
  swing: number;
  key: Key;
  seed: number;
  /** total frames of the render (end of the last bar plus tail) */
  frames: number;
  partIndex: number;
}

export interface ControlSpec { name: string; min: number; max: number; description: string }
export interface InstrumentInfo {
  id: string;
  family: Family;
  name: string;
  /** instrument version: the rack adapter version plus the frozen engine it plays */
  version: string;
  macro: { id: string; label: string; from: string; to: string };
  description: string;
  /** MIDI range that sounds and stays in tune */
  range: [number, number];
  articulations: Record<string, string>;
  controls: ControlSpec[];
  setup: ControlSpec[];
  params: Record<string, string>;
  /** suggested part gain (dB) from the approved audition balance */
  suggestedGainDb: number;
  /** portable gestures (v0.9): how each gesture is played here, using only this instrument's own articulations and params */
  gestures?: Partial<Record<Gesture, GestureMap>>;
}
export interface RackInstrument extends InstrumentInfo {
  /** Render a part as stereo float channels of exactly `ctx.frames` frames at 44.1 kHz, at the calibrated nominal level. */
  render(perf: PartPerformance, ctx: RenderContext): Promise<[Float64Array, Float64Array]>;
}

/** Saved performance score, as authored (JSON). See studio-001/README.md for the full reference. */
export type NoteInput = [number, number, string | number, number?, Record<string, number | string>?] | {
  beat: number; beats: number; pitch: string | number; velocity?: number; articulation?: string; slide?: number; [param: string]: unknown;
};
export interface RepeatInput { fromBeat: number; toBeat: number; lengthBeats: number; notes: NoteInput[] }
export interface TextureInput { fromBeat: number; toBeat: number; density: Curve; pitches: (string | number)[]; velocity?: [number, number]; beats?: number; seed?: number }
export interface HumanizeInput { timingMs?: number; velocity?: number; seed?: number }
export interface PartInput {
  id: string; instrument: string;
  gainDb?: number; pan?: number; room?: number; context?: boolean;
  macro?: Curve; controls?: Record<string, Curve>; offsets?: Record<string, Curve>; expression?: Curve;
  setup?: Record<string, number | string | (string | number)[]>;
  notes?: NoteInput[]; repeats?: RepeatInput[]; textures?: TextureInput[]; humanize?: HumanizeInput;
  breaths?: Breath[]; motion?: MotionSpan[]; overtone?: Curve;
}
export interface SectionInput { id: string; bars: number; development?: string }
export interface ScoreInput {
  schema: string; title: string; bpm: number; key: string; timeSignature?: '4/4';
  swing?: number; seed?: number; transpose?: number; tailSeconds?: number; masterGainDb?: number;
  description?: string;
  sections: SectionInput[];
  room?: { rt60?: number; size?: number; damp?: number; predelayMs?: number; lowCut?: number };
  parts: PartInput[];
}

// ============================================================ v0.9 motif development layer (score/2), additive
export type ScaleName = 'major' | 'minor' | 'harmonic-minor';
/** Portable expressive gestures. Each instrument maps them onto its own articulations (see `InstrumentInfo.gestures`). */
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
