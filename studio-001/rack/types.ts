/**
 * DAEMON//STUDIO 001 · Signature Instrument Rack — public, versioned instrument interface.
 * Pure types and constants: no audio code, no I/O. Everything a composer or another tool needs to address the
 * three approved instrument families from a new project.
 */

/** Interface contract version. Breaking changes to these types bump the major version. */
export const RACK_INTERFACE_VERSION = '1.0.0';
/** Saved-score schema identifier. */
export const SCORE_SCHEMA = 'daemonv12.signature-rack.score/1';
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
