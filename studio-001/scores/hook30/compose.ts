/**
 * Authoring script for HOOK//30 (two candidates). Writes hook30-groove.score.json and hook30-ascension.score.json,
 * the score/2 files that the motif layer lowers and the unchanged rack renders. The JSON files are the source of
 * truth; this script only keeps the shared B1 material and the bar arithmetic exact while composing.
 *
 *   node studio-001/scores/hook30/compose.ts
 *
 * Both pieces: 96 BPM, 12 bars (48 beats, exactly 1,323,000 frames), three movements of four bars.
 * The eight B1 motifs (hook, head, echo, stretto, cadence, riff, riff-half, pulse) are copied verbatim from
 * hook10-b1.score.json; a test compares them. Everything melodic in both pieces is a statement of those motifs.
 *
 *   GROOVE     Dm Bb | Gm-C | Dm-A7  ·  Gm7 | C9 | F-Bb | Em7b5-Eb9, break  ·  Dm | F | Gm-C | Dm/A-A7
 *   ASCENSION  Dm Bb | Gm-C | Dm-A7  ·  Bb | G7/B | C7 | A7/C#, break       ·  D major | G | Gm-C7/E | Dm/A-A7b9
 */
import { readFileSync, writeFileSync } from 'node:fs';

type Opt = { alt?: -1 | 0 | 1; gesture?: string; articulation?: string; slide?: number; params?: Record<string, number | string> };
type MN = [number, number, number, number?, Opt?];
type Tf = Record<string, unknown>;
type Motif = { id: string; role?: string; octave?: number; lengthBeats?: number; notes?: MN[]; from?: string; transforms?: Tf[] };
type Phrase = { id: string; motif: string; at: { section: string; bar: number; beat?: number }; transforms?: Tf[]; velocity?: number; fit?: string };
type Curve = number | [number, number][];

// ---------------------------------------------------------------- transform shorthands
const tr = (steps: number): Tf => ({ op: 'transpose', steps });
const oct = (by: number): Tf => ({ op: 'octave', by });
const frag = (from: number, to: number): Tf => ({ op: 'fragment', from, to });
const seq = (steps: number[], every: number): Tf => ({ op: 'sequence', steps, every });
const dyn = (from: number, to: number): Tf => ({ op: 'dynamics', from, to });
const scale = (factor: number): Tf => ({ op: 'scale', factor });
const gest = (set: string, at?: number[]): Tf => (at ? { op: 'gesture', set, at } : { op: 'gesture', set });
const displace = (beats: number): Tf => ({ op: 'displace', beats });
const endOn = (step: number, alt?: number): Tf => (alt ? { op: 'endOn', step, alt } : { op: 'endOn', step });
const mode = (to: string): Tf => ({ op: 'mode', to });
const shift = (semitones: number): Tf => ({ op: 'shift', semitones });
const rhythm = (durations: number[]): Tf => ({ op: 'rhythm', durations });

// ---------------------------------------------------------------- sections and placement (bars are 1..12)
const SECTIONS = ['recognition', 'transformation', 'payoff'];
const at = (bar: number, beat = 0) => ({ section: SECTIONS[Math.floor((bar - 1) / 4)]!, bar: ((bar - 1) % 4) + 1, ...(beat ? { beat } : {}) });
const ph = (id: string, motif: string, bar: number, beat = 0, transforms: Tf[] = [], velocity?: number): Phrase =>
  ({ id, motif, at: at(bar, beat), ...(transforms.length ? { transforms } : {}), ...(velocity !== undefined ? { velocity } : {}) });
const B = (bar: number, beat = 0) => (bar - 1) * 4 + beat;

// ---------------------------------------------------------------- the B1 motifs, verbatim
const b1 = JSON.parse(readFileSync(new URL('../hook10/hook10-b1.score.json', import.meta.url), 'utf8')) as { motifs: Motif[] };
const B1_MOTIFS = b1.motifs;

// ---------------------------------------------------------------- shared new motifs (rhythm section and figures)
const SHARED: Motif[] = [
  // the hook's first rhythm (a dotted eighth, then the long note) as a two-hit cell for stop-time accents
  { id: 'pair', role: 'figure', octave: 4, lengthBeats: 1.5, notes: [[0, 0.5, 7, 0.84, { gesture: 'accent' }], [0.75, 0.5, 7, 0.8, { gesture: 'short' }]] },
  // bass figures
  { id: 'comp', role: 'bass', octave: 2, lengthBeats: 4, notes: [[0, 0.5, 0, 0.95, { gesture: 'accent' }], [2.75, 0.25, 0, 0.5, { gesture: 'soft' }], [3.5, 0.5, 7, 0.72, { gesture: 'short' }]] },
  { id: 'pop', role: 'bass', octave: 2, lengthBeats: 0.5, notes: [[0, 0.25, 7, 0.62, { gesture: 'short' }], [0.25, 0.25, 0, 0.5, { gesture: 'soft' }]] },
  // drums: the bass riff's 3+3+2 opening is the kick
  { id: 'kick', role: 'figure', octave: 1, lengthBeats: 4, notes: [[0, 0.5, 4, 1], [0.75, 0.5, 4, 0.6], [1.5, 0.5, 4, 0.82], [2.5, 0.5, 4, 0.72]] },
  { id: 'kick-push', role: 'figure', octave: 1, lengthBeats: 4, notes: [[0, 0.5, 4, 1], [0.75, 0.5, 4, 0.6], [2, 0.5, 4, 0.9], [2.75, 0.5, 4, 0.6]] },
  { id: 'kick-drive', role: 'figure', octave: 1, lengthBeats: 4, notes: [[0, 0.5, 4, 1], [0.75, 0.5, 4, 0.58], [1.5, 0.5, 4, 0.8], [2, 0.5, 4, 0.9], [2.75, 0.5, 4, 0.58], [3.5, 0.5, 4, 0.7]] },
  { id: 'kick-four', role: 'figure', octave: 1, lengthBeats: 4, notes: [[0, 0.5, 4, 1], [1, 0.5, 4, 0.8], [2, 0.5, 4, 0.92], [3, 0.5, 4, 0.8]] },
  { id: 'kick-one', role: 'figure', octave: 1, lengthBeats: 0.5, notes: [[0, 0.5, 4, 0.9]] },
  { id: 'backbeat', role: 'figure', octave: 4, lengthBeats: 4, notes: [[1, 0.5, 0, 0.85], [3, 0.5, 0, 0.9]] },
  { id: 'ghost', role: 'figure', octave: 4, lengthBeats: 0.25, notes: [[0, 0.25, 0, 0.34, { articulation: 'ghost' }]] },
  { id: 'clap', role: 'figure', octave: 4, lengthBeats: 0.5, notes: [[0, 0.5, 0, 0.8, { articulation: 'clap' }]] },
  // spring: damped off-beat plucks (the "a" of beats 2, 3 and 4)
  { id: 'sprang', role: 'figure', octave: 3, lengthBeats: 4, notes: [[1.75, 0.25, 7, 0.6, { gesture: 'short' }], [2.75, 0.25, 4, 0.52, { gesture: 'short' }], [3.75, 0.25, 7, 0.56, { gesture: 'short' }]] },
  // the roots of the circle of fifths in GROOVE's second movement (G, C, F, Bb), one damped pluck each
  { id: 'thuds', role: 'figure', octave: 2, lengthBeats: 12, notes: [[0, 0.5, 3, 0.8, { gesture: 'short' }], [4, 0.5, 6, 0.78, { gesture: 'short' }], [8, 0.5, 2, 0.8, { gesture: 'short' }], [10, 0.5, 5, 0.8, { gesture: 'short' }]] },
  { id: 'crack', role: 'figure', octave: 4, lengthBeats: 0.5, notes: [[0, 0.5, 0, 0.88]] },
  { id: 'kick-lite', role: 'figure', octave: 1, lengthBeats: 4, notes: [[0, 0.5, 4, 1], [2.5, 0.5, 4, 0.7]] },
];

const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
const vox = (vowel: string, to?: string) => ({ vowel, ...(to ? { to } : {}) });

// ================================================================================================ GROOVE
function groove() {
  const motifs: Motif[] = [...B1_MOTIFS, ...SHARED];
  const voice = {
    id: 'voice', instrument: 'impossible-voice', gainDb: -1, pan: 0.05, room: 0.22,
    macro: [[0, 0.3], [8, 0.3], [12, 0.55], [16, 0.3], [32, 0.32], [40, 0.42], [44, 0.5], [47, 0.42], [48, 0.3]] as Curve,
    expression: [[0, 0.72], [8, 0.7], [11, 0.85], [14, 0.8], [16, 0.72], [26, 0.76], [28, 0.84], [31, 0.8], [32, 0.86], [36, 0.9], [40, 0.92], [44, 0.86], [48, 0.72]] as Curve,
    setup: { vibRate: 5.3 },
    breaths: [
      { beat: 7.74, beats: 0.24, kind: 'in', velocity: 0.4 }, { beat: 15.74, beats: 0.24, kind: 'in', velocity: 0.45 },
      { beat: 25.7, beats: 0.28, kind: 'in', velocity: 0.4 }, { beat: 30.85, beats: 0.95, kind: 'in', velocity: 0.62 },
      { beat: 39.74, beats: 0.24, kind: 'in', velocity: 0.45 }, { beat: 47.74, beats: 0.24, kind: 'in', velocity: 0.45 },
    ],
    phrases: [
      // I · recognition: B1, note for note
      ph('voice.hook', 'hook', 1),
      ph('voice.answer', 'hook', 2, 0, [tr(-2)], 0.94),
      ph('voice.climb', 'head', 3, 0, [tr(-4), seq([0, 1], 2), dyn(0.94, 1.1)]),
      ph('voice.cadence', 'cadence', 4),
      // II · transformation: the lead rests while the bass and a second voice trade the hook, then answers in twos
      ph('voice.trade', 'head', 7, 2, [tr(-2), dyn(1, 1.08)]),
      ph('voice.hits-a', 'pair', 8, 0, [gest('accent')]),
      ph('voice.hits-b', 'pair', 8, 1.5, [shift(-1), gest('accent', [0]), gest('fall', [1])]),
      // III · payoff: the hook, then answered a third HIGHER for the first time, the reach, the inverted cadence
      ph('voice.drop', 'hook', 9, 0, [], 1.04),
      ph('voice.lift', 'hook', 10, 0, [tr(2)], 1.04),
      ph('voice.reach', 'head', 11, 0, [tr(3), seq([0, 1], 2), dyn(1, 1.06)]),
      ph('voice.cadence-out', 'cadence', 12),
    ],
  };
  const voice2 = {
    id: 'voice-2', instrument: 'impossible-voice', gainDb: -3, pan: -0.22, room: 0.24, macro: [[0, 0.18], [32, 0.18], [40, 0.3], [48, 0.18]] as Curve,
    expression: [[16, 0.8], [24, 0.82], [30, 0.6], [32, 0.56], [40, 0.6], [46, 0.6], [48, 0.5]] as Curve,
    controls: { whistle: 0 }, setup: { size: -0.3, detune: -5, vibRate: 4.9, vibCents: 22, seed: 47, haloGain: 0.6 },
    breaths: [{ beat: 20.1, beats: 0.34, kind: 'in', velocity: 0.4 }],
    phrases: [
      ph('voice-2.reply', 'hook', 6, 0, [tr(-1), oct(-1), displace(0.5)]),
      ph('voice-2.under', 'hook', 9, 0, [tr(-2), endOn(4)], 0.82),
      ph('voice-2.under-lift', 'hook', 10, 0, [gest('legato', [2, 3])], 0.82),
      ph('voice-2.under-reach', 'head', 11, 0, [tr(1), seq([0, 1], 2)], 0.82),
    ],
  };
  const bass = {
    id: 'bass', instrument: 'living-bass', gainDb: -2, room: 0.05,
    macro: [[0, 0.3], [8, 0.35], [12, 0.65], [15.5, 0.4], [16, 0.72], [24, 0.72], [28, 0.8], [31, 0.8], [32, 0.55], [40, 0.66], [44, 0.82], [47.5, 0.8], [48, 0.3]] as Curve,
    expression: [[0, 0.75], [16, 0.8], [28, 0.84], [32, 0.8], [44, 0.84], [48, 0.75]] as Curve,
    phrases: [
      ph('bass.riff', 'riff', 1),
      ph('bass.answer', 'riff', 2, 0, [tr(-2)]),
      ph('bass.climb', 'riff-half', 3, 0, [seq([-4, -1], 2)]),
      ph('bass.turn', 'riff-half', 4, 0, [seq([0, -3], 2), endOn(6, 1)]),
      // II: the bass sings the hook (a fifth lower, an octave down, half a beat late)
      ph('bass.call', 'hook', 5, 0, [tr(-4), oct(-1), rhythm([0.75, 1.25, 0.5, 0.5, 0.5]), displace(0.5)], 1.05),
      ph('bass.comp', 'comp', 6, 0, [tr(-1)]),
      ph('bass.trade', 'head', 7, 0, [oct(-2)], 1.05),
      ph('bass.trade-root', 'riff-half', 7, 2, [tr(-2)]),
      ph('bass.hits-a', 'pair', 8, 0, [tr(-6), oct(-2), gest('accent')]),
      ph('bass.hits-b', 'pair', 8, 1.5, [tr(-6), oct(-2), shift(-1), gest('accent')]),
      // III
      ph('bass.drop', 'riff', 9),
      ph('bass.drop-pop', 'pop', 9, 2),
      ph('bass.lift', 'riff', 10, 0, [tr(2)]),
      ph('bass.lift-pop', 'pop', 10, 2, [tr(2)]),
      ph('bass.reach', 'riff-half', 11, 0, [seq([-4, -1], 2)]),
      ph('bass.pedal', 'riff-half', 12, 0, [tr(4), seq([0, 0], 2), endOn(6, 1)]),
    ],
  };
  const bars = {
    id: 'bars', instrument: 'mechanical-orchestra/bar', gainDb: -7, pan: -0.12, room: 0.28, macro: [[0, 0.12], [32, 0.12], [40, 0.2], [48, 0.12]] as Curve, setup: { spread: 0.45 },
    notes: [
      [14, 1, 'C#5', 0.62, { hardness: 0.9, damp: 0.3 }], [14, 1, 'E5', 0.56, { hardness: 0.9, damp: 0.3 }],
      [46, 1, 'C#5', 0.66, { hardness: 0.9, damp: 0.3 }], [46, 1, 'E5', 0.6, { hardness: 0.9, damp: 0.3 }],
    ],
    phrases: [
      ph('bars.head', 'head', 1, 0, [oct(1)], 0.8),
      ph('bars.echo', 'echo', 1, 3.25, [], 0.8),
      ph('bars.head-answer', 'head', 2, 0, [oct(1), tr(-2)], 0.8),
      ph('bars.echo-answer', 'echo', 2, 3.25, [tr(-2)], 0.8),
      ph('bars.stretto', 'stretto', 3, 0, [tr(-4), seq([0, 1, 2, 3], 1), dyn(0.7, 1)]),
      ph('bars.cadence', 'cadence', 4, 0, [frag(0, 2), oct(1)], 0.8),
      ph('bars.pickup', 'echo', 4, 3.25, [tr(-3)], 0.85),
      // II: the head upside down against the rising head (contrary motion), then the stop-time chords
      ph('bars.mirror-f', 'cadence', 7, 0, [frag(0, 2), tr(4)], 0.74),
      ph('bars.mirror-bb', 'cadence', 7, 2, [frag(0, 2), oct(1)], 0.8),
      ph('bars.hits-a-top', 'pair', 8, 0, [oct(1), gest('short')], 0.96),
      ph('bars.hits-a-mid', 'pair', 8, 0, [tr(-2), oct(1), gest('short')], 0.86),
      ph('bars.hits-a-low', 'pair', 8, 0, [tr(-4), oct(1), gest('short')], 0.86),
      ph('bars.hits-b-top', 'pair', 8, 1.5, [oct(1), shift(-1), gest('short')], 0.96),
      ph('bars.hits-b-mid', 'pair', 8, 1.5, [tr(-3), oct(1), gest('short')], 0.86),
      ph('bars.hits-b-low', 'pair', 8, 1.5, [tr(-4), oct(1), gest('short')], 0.86),
      ph('bars.pickup-drop', 'echo', 8, 3.25, [tr(-3)], 0.9),
      // III: the B1 doubling returns, lifts with the voice, then the speeding conversation with the tines
      ph('bars.head-drop', 'head', 9, 0, [oct(1)], 0.86),
      ph('bars.echo-drop', 'echo', 9, 3.25, [], 0.86),
      ph('bars.head-lift', 'head', 10, 0, [oct(1), tr(2)], 0.86),
      ph('bars.echo-lift', 'echo', 10, 3.25, [tr(2)], 0.86),
      ph('bars.call-1', 'stretto', 11, 0, [tr(-4)], 0.82),
      ph('bars.call-2', 'stretto', 11, 2, [tr(-2)], 0.9),
      ph('bars.triplet-1', 'stretto', 12, 0, [scale(0.6667)], 0.9),
      ph('bars.triplet-3', 'stretto', 12, 1.333333, [scale(0.6667), tr(2)], 1),
      ph('bars.pickup-loop', 'echo', 12, 3.25, [tr(-3)], 0.9),
    ],
  };
  const tines = {
    id: 'tines', instrument: 'mechanical-orchestra/tine', gainDb: -8, pan: 0.3, room: 0.26, macro: [[0, 0.1], [32, 0.1], [40, 0.3], [48, 0.1]] as Curve, setup: { spread: 0.2 },
    notes: [
      [B(5), 0.5, 'D6', 0.62], [B(5), 0.5, 'F6', 0.56], [B(6), 0.5, 'Bb5', 0.62], [B(6), 0.5, 'E6', 0.58],
      [B(9), 0.5, 'D6', 0.66], [B(9), 0.5, 'A6', 0.58], [B(10), 0.5, 'C6', 0.66], [B(10), 0.5, 'F6', 0.6],
    ],
    phrases: [
      ph('tines.answer-gm', 'echo', 5, 3.25, [tr(-4)], 0.85),
      ph('tines.answer-c', 'echo', 6, 3.25, [tr(-1)], 0.85),
      ph('tines.answer-bb', 'echo', 7, 3.25, [tr(-2)], 0.88),
      ph('tines.reply-1', 'stretto', 11, 1, [tr(-3)], 0.9),
      ph('tines.reply-2', 'stretto', 11, 3, [tr(-1)], 0.96),
      ph('tines.triplet-2', 'stretto', 12, 0.666667, [scale(0.6667), tr(1)], 0.96),
      ph('tines.run', 'echo', 12, 2.25, [mode('harmonic-minor')], 0.96),
      ph('tines.run-2', 'stretto', 12, 3, [scale(0.5), seq([-1, 2], 0.5), mode('harmonic-minor'), dyn(0.9, 1.1)]),
    ],
  };
  const clock = {
    id: 'clock', instrument: 'mechanical-orchestra/clock', gainDb: -12, room: 0.12,
    macro: [[0, 0.25], [8, 0.3], [12, 0.75], [16, 0.25], [28, 0.3], [32, 0.45], [40, 0.6], [44, 0.8], [48, 0.25]] as Curve, humanize: { timingMs: 0, velocity: 0.1 },
    phrases: [
      ph('clock.bar1', 'pulse', 1), ph('clock.bar2', 'pulse', 2),
      ph('clock.double', 'pulse', 3, 0, [scale(0.5), seq([0, 0], 2)]),
      ph('clock.bar4', 'pulse', 4, 0, [frag(0, 6)]),
      ph('clock.roll', 'pulse', 4, 2.5, [frag(1, 3), seq([0, 0, 0], 0.5), dyn(0.9, 1.5)]),
      ph('clock.half', 'pulse', 5, 0, [scale(2)], 0.9),
      ph('clock.bar7', 'pulse', 7),
      ph('clock.roll-drop', 'pulse', 8, 3, [frag(1, 3), seq([0, 0], 0.5), dyn(0.8, 1.5)]),
      ph('clock.drive-9', 'pulse', 9, 0, [scale(0.5), seq([0, 0], 2)]),
      ph('clock.drive-10', 'pulse', 10, 0, [scale(0.5), seq([0, 4], 2)]),
      ph('clock.drive-11', 'pulse', 11, 0, [scale(0.5), seq([0, 0], 2), dyn(0.9, 1.2)]),
      ph('clock.bar12', 'pulse', 12, 0, [frag(0, 6)]),
      ph('clock.roll-loop', 'pulse', 12, 2.5, [frag(1, 3), seq([0, 0, 0], 0.5), dyn(0.9, 1.5)]),
    ],
  };
  const spring = {
    id: 'spring', instrument: 'mechanical-orchestra/spring', gainDb: -10, pan: 0.1, room: 0.12, macro: 0.15,
    phrases: [
      ph('spring.roots', 'thuds', 5),
      ph('spring.hits-a', 'pair', 8, 0, [tr(-6), oct(-1), gest('short')]),
      ph('spring.hits-b', 'pair', 8, 1.5, [tr(-6), oct(-1), shift(-1), gest('short')]),
      ph('spring.drop', 'sprang', 9), ph('spring.lift', 'sprang', 10, 0, [tr(2)]),
      ph('spring.reach', 'sprang', 11, 0, [tr(3)]),
      ph('spring.pedal', 'sprang', 12, 1.75, [tr(4), frag(0, 2)]),
    ],
  };
  const kick = {
    id: 'kick', instrument: 'context/kick', gainDb: 1,
    phrases: [
      ph('kick.1', 'kick', 1), ph('kick.2', 'kick', 2), ph('kick.2-push', 'kick-one', 2, 3.5, [], 0.66),
      ph('kick.3', 'kick-push', 3), ph('kick.4', 'kick', 4, 0, [frag(0, 3)]), ph('kick.4-push', 'kick-one', 4, 3.5, [], 0.7),
      ph('kick.5', 'kick-one', 5, 0, [], 1.1), ph('kick.5-push', 'kick-one', 5, 3.5, [], 0.62),
      ph('kick.6', 'kick-one', 6, 0, [], 1.1), ph('kick.6-push', 'kick-one', 6, 3.5, [], 0.62),
      ph('kick.7', 'kick-push', 7),
      ph('kick.hits-a', 'pair', 8, 0, [tr(-3), oct(-3), gest('accent')]), ph('kick.hits-b', 'pair', 8, 1.5, [tr(-3), oct(-3), gest('accent')]),
      ph('kick.9', 'kick-drive', 9), ph('kick.10', 'kick-drive', 10), ph('kick.11', 'kick-push', 11), ph('kick.11-push', 'kick-one', 11, 3.5, [], 0.7),
      ph('kick.12', 'kick', 12, 0, [frag(0, 3)]), ph('kick.12-push', 'kick-one', 12, 3.5, [], 0.78),
    ],
  };
  const snare = {
    id: 'snare', instrument: 'context/snare', gainDb: -6, room: 0.18,
    phrases: [
      ph('snare.1', 'backbeat', 1), ph('snare.2', 'backbeat', 2), ph('snare.2-ghost', 'ghost', 2, 3.75),
      ph('snare.3', 'backbeat', 3), ph('snare.3-ghost', 'ghost', 3, 1.75),
      ph('snare.4', 'backbeat', 4), ph('snare.4-ghost-a', 'ghost', 4, 3.5), ph('snare.4-ghost-b', 'ghost', 4, 3.75, [], 1.4),
      ph('snare.5-clap', 'clap', 5, 2), ph('snare.6-clap', 'clap', 6, 2), ph('snare.6-ghost', 'ghost', 6, 3.75),
      ph('snare.7', 'backbeat', 7), ph('snare.7-ghost', 'ghost', 7, 3.75),
      ph('snare.hits-a', 'crack', 8, 0.75), ph('snare.hits-b', 'crack', 8, 2.25, [], 1.08), ph('snare.hits-clap', 'clap', 8, 2.25, [], 0.9),
      ph('snare.9', 'backbeat', 9), ph('snare.9-ghost-a', 'ghost', 9, 1.75), ph('snare.9-ghost-b', 'ghost', 9, 3.75),
      ph('snare.10', 'backbeat', 10), ph('snare.10-ghost-a', 'ghost', 10, 2.25), ph('snare.10-ghost-b', 'ghost', 10, 3.75),
      ph('snare.11', 'backbeat', 11), ph('snare.11-ghost', 'ghost', 11, 3.75),
      ph('snare.12', 'crack', 12, 1, [], 0.96), ...[0, 1, 2, 3].map(k => ph(`snare.12-roll-${k + 1}`, 'ghost', 12, 3 + k / 4, [], 0.9 + 0.42 * k)),
    ],
  };
  return {
    schema: 'daemonv12.signature-rack.score/2',
    title: 'HOOK//30 GROOVE (recognition, transformation, payoff)',
    bpm: 96, key: 'D minor', timeSignature: '4/4', swing: 0.55, seed: 30, tailSeconds: 10, masterGainDb: 0,
    description: 'HOOK//30 candidate A. The B1 hook over a 3+3+2 kick and backbeat; then the bass sings the hook half a beat late, a low second voice answers, they trade twos, four stop-time chords and a breath; then the hook returns and is answered a third higher, and the B1 mallet stretto becomes a conversation between bars and tines that speeds from eighths to triplets to sixteenths into the loop.',
    sections: [
      { id: 'recognition', bars: 4, development: 'B1 note for note in voice, bass, mallets and clock, now over a 3+3+2 kick (the bass riff\'s own rhythm) and a backbeat. Dm | Bb | Gm C | Dm A7' },
      { id: 'transformation', bars: 4, development: 'stop-time, half-time clock: the bass sings the hook a fifth lower and half a beat late; a low second voice answers; bass and lead trade the rising sixth in twos against the mallets\' falling sixth; four syncopated chords on the hook\'s dotted rhythm, then silence and one breath. Gm7 | C9 | F Bb | Em7b5 Eb9' },
      { id: 'payoff', bars: 4, development: 'the hook with its own answer sung under it; then answered a third higher for the first time (the answer becomes the harmony); the mallet stretto split between bars and tines, speeding from eighths to triplets to sixteenths; the inverted cadence over a dominant pedal. Dm | F | Gm C | Dm/A A7' },
    ],
    annotations: {
      harmony: [[0, 'Dm'], [4, 'Bb'], [8, 'Gm'], [10, 'C'], [12, 'Dm'], [14, 'A7'], [16, 'Gm7'], [20, 'C9'], [24, 'F'], [26, 'Bb'], [28, 'Em7b5'], [29.5, 'Eb9#11'], [32, 'Dm'], [36, 'F'], [40, 'Gm'], [42, 'C'], [44, 'Dm/A'], [46, 'A7']],
      cues: [
        { id: 'hook', beat: 0, label: 'the B1 hook (voice), over the 3+3+2 kick' },
        { id: 'cry', beat: 0.75, label: 'the cry: the rising sixth lands on F5' },
        { id: 'answer', beat: 4, label: 'the answer, a third lower' },
        { id: 'stretto', beat: 8, label: 'B1 stretto: mallets play the rising sixth twice as fast against the voice' },
        { id: 'cadence', beat: 12, label: 'the hook upside down' },
        { id: 'bass-call', beat: 16.5, label: 'movement II: the bass sings the hook, half a beat late' },
        { id: 'low-reply', beat: 20.5, label: 'a low second voice answers' },
        { id: 'trade', beat: 24, label: 'bass and lead trade the rising sixth; mallets mirror it downwards' },
        { id: 'hits', beat: 28, label: 'four stop-time chords on the hook\'s dotted rhythm (beats 28, 28.75, 29.5, 30.25)' },
        { id: 'break', beat: 30.75, label: 'silence, one breath' },
        { id: 'pickup', beat: 31.25, label: 'the B1 pickup announces the hook' },
        { id: 'drop', beat: 32, label: 'movement III: the hook returns with its answer sung under it' },
        { id: 'lift', beat: 36, label: 'the hook answered a third higher for the first time' },
        { id: 'peak-a5', beat: 36.75, label: 'A5' },
        { id: 'conversation', beat: 40, label: 'bars and tines trade the stretto in eighths while the voice reaches up' },
        { id: 'top-c6', beat: 42.75, label: 'C6, the highest sung note' },
        { id: 'triplets', beat: 44, label: 'the trade speeds up: eighth triplets' },
        { id: 'sixteenths', beat: 46.25, label: 'sixteenths: the tines run, then the stretto at four times its first speed against the B1 pickup, ending on octave As' },
        { id: 'loop', beat: 48, label: 'loop point: A7 resolves to the first bar' },
      ],
    },
    room: { rt60: 1.6, size: 1.05, damp: 5600, predelayMs: 18, lowCut: 240 },
    motifs,
    parts: [voice, voice2, bass, bars, tines, clock, spring, kick, snare],
  };
}

// ================================================================================================ ASCENSION
function ascension() {
  const motifs: Motif[] = [...B1_MOTIFS, ...SHARED,
    // the bass line of the second movement: one chromatic ascent, B-flat to C-sharp, a bar per note
    { id: 'rise', role: 'bass', octave: 2, lengthBeats: 16, notes: [[0, 3.95, 5, 0.86], [4, 3.95, 5, 0.88, { alt: 1, gesture: 'legato' }], [8, 3.95, 6, 0.92, { gesture: 'legato' }], [12, 1.5, 6, 1, { alt: 1, gesture: 'accent' }]] },
    // the unresolved seventh of A7 (lead) and its fifth (second voice), held into the silence
    { id: 'hang', role: 'answer', octave: 4, lengthBeats: 1.5, notes: [[0, 1.5, 10, 0.9, { gesture: 'fall', params: vox('ah', 'oh') }]] },
    { id: 'hang-low', role: 'answer', octave: 4, lengthBeats: 1.5, notes: [[0, 1.5, 1, 0.8, { params: vox('oh', 'oo') }]] },
    { id: 'pedal-hum', role: 'figure', octave: 3, lengthBeats: 4, notes: [[0, 3.6, 4, 0.7, { articulation: 'hum', params: vox('mm', 'oh') }]] },
  ];
  const voice = {
    id: 'voice', instrument: 'impossible-voice', gainDb: -1, pan: 0.05, room: 0.24,
    macro: [[0, 0.3], [8, 0.3], [12, 0.55], [16, 0.32], [24, 0.4], [29, 0.55], [32, 0.3], [40, 0.36], [44, 0.5], [47, 0.42], [48, 0.3]] as Curve,
    expression: [[0, 0.72], [8, 0.7], [11, 0.85], [14, 0.8], [16, 0.7], [24, 0.76], [28, 0.86], [31, 0.8], [32, 0.88], [36, 0.92], [40, 0.9], [44, 0.86], [48, 0.72]] as Curve,
    // the glass halo is tuned to D minor (F and C resonators): its send is closed while the piece is in D major
    offsets: { glass: [[0, 0], [31, 0], [31.5, -1], [39.5, -1], [40.5, 0], [48, 0]] },
    setup: { vibRate: 5.3 },
    breaths: [
      { beat: 7.74, beats: 0.24, kind: 'in', velocity: 0.4 }, { beat: 15.74, beats: 0.24, kind: 'in', velocity: 0.45 },
      { beat: 17.6, beats: 0.36, kind: 'in', velocity: 0.4 }, { beat: 30.9, beats: 0.95, kind: 'in', velocity: 0.62 },
      { beat: 39.74, beats: 0.24, kind: 'in', velocity: 0.45 }, { beat: 47.74, beats: 0.24, kind: 'in', velocity: 0.45 },
    ],
    phrases: [
      // I · recognition: B1, note for note
      ph('voice.hook', 'hook', 1),
      ph('voice.answer', 'hook', 2, 0, [tr(-2)], 0.94),
      ph('voice.climb', 'head', 3, 0, [tr(-4), seq([0, 1], 2), dyn(0.94, 1.1)]),
      ph('voice.cadence', 'cadence', 4),
      // II · transformation: the hook at its own pitch, twice, two beats behind the low voice, over a bass that climbs by semitones
      ph('voice.canon-1', 'hook', 5, 2, [], 0.96),
      ph('voice.canon-2', 'hook', 6, 2, [endOn(10)]),
      ph('voice.rise', 'head', 7, 2, [tr(2), dyn(1, 1.1)]),
      ph('voice.hang', 'hang', 8),
      // III · payoff: the hook in D major, answered a fourth higher, darkened to G minor, closed by the inverted cadence
      ph('voice.major', 'hook', 9, 0, [mode('major')], 1.04),
      ph('voice.ascent', 'hook', 10, 0, [tr(3), mode('major')], 1.04),
      ph('voice.darken', 'head', 11, 0, [tr(3), seq([0, 1], 2), dyn(1, 1.06)]),
      ph('voice.cadence-out', 'cadence', 12),
    ],
  };
  const voice2 = {
    id: 'voice-2', instrument: 'impossible-voice', gainDb: -4, pan: -0.22, room: 0.26, macro: [[0, 0.2], [28, 0.34], [32, 0.18], [48, 0.18]] as Curve,
    expression: [[16, 0.66], [24, 0.72], [28, 0.8], [31, 0.7], [32, 0.58], [40, 0.62], [44, 0.6], [48, 0.5]] as Curve,
    controls: { whistle: 0 }, offsets: { glass: [[0, 0], [31, 0], [31.5, -1], [39.5, -1], [40.5, 0], [48, 0]] }, setup: { size: -0.3, detune: -5, vibRate: 4.9, vibCents: 22, seed: 47, haloGain: 0.6 },
    breaths: [{ beat: 15.6, beats: 0.34, kind: 'in', velocity: 0.4 }],
    phrases: [
      ph('voice-2.canon-1', 'hook', 5, 0, [tr(-2), oct(-1)]),
      ph('voice-2.canon-2', 'hook', 6, 0, [oct(-1)]),
      ph('voice-2.canon-3', 'hook', 7, 0, [tr(1), oct(-1)], 1.04),
      ph('voice-2.hang', 'hang-low', 8),
      ph('voice-2.under-major', 'hook', 9, 0, [tr(-2), mode('major'), endOn(4)], 0.84),
      ph('voice-2.under-ascent', 'hook', 10, 0, [tr(-2), mode('major')], 0.84),
      ph('voice-2.under-darken', 'head', 11, 0, [tr(1), seq([0, 1], 2)], 0.84),
      ph('voice-2.pedal', 'pedal-hum', 12),
    ],
  };
  const bass = {
    id: 'bass', instrument: 'living-bass', gainDb: -2, room: 0.05,
    macro: [[0, 0.3], [8, 0.35], [12, 0.65], [15.5, 0.4], [16, 0.2], [24, 0.4], [28, 0.7], [30, 0.85], [32, 0.5], [40, 0.6], [44, 0.78], [47.5, 0.78], [48, 0.3]] as Curve,
    expression: [[0, 0.75], [16, 0.6], [24, 0.68], [29, 0.84], [32, 0.8], [44, 0.84], [48, 0.75]] as Curve,
    motion: [{ fromBeat: 0, toBeat: 16, preset: 'sixteenths' }, { fromBeat: 16, toBeat: 24, preset: 'eighths' }, { fromBeat: 24, toBeat: 28, preset: 'triplets' }, { fromBeat: 28, toBeat: 32, preset: 'revving' }, { fromBeat: 32, toBeat: 60, preset: 'sixteenths' }],
    phrases: [
      ph('bass.riff', 'riff', 1),
      ph('bass.answer', 'riff', 2, 0, [tr(-2)]),
      ph('bass.climb', 'riff-half', 3, 0, [seq([-4, -1], 2)]),
      ph('bass.turn', 'riff-half', 4, 0, [seq([0, -3], 2), endOn(6, 1)]),
      ph('bass.rise', 'rise', 5, 0, [], 0.82),
      ph('bass.major', 'riff', 9, 0, [mode('major')]),
      ph('bass.major-pop', 'pop', 9, 2),
      ph('bass.ascent', 'riff', 10, 0, [tr(3), mode('major')]),
      ph('bass.ascent-pop', 'pop', 10, 2, [tr(3)]),
      ph('bass.darken', 'riff-half', 11, 0, [seq([3, 1], 2)]),
      ph('bass.pedal', 'riff-half', 12, 0, [tr(4), seq([0, 0], 2), endOn(6, 1)]),
    ],
  };
  const bars = {
    id: 'bars', instrument: 'mechanical-orchestra/bar', gainDb: -7, pan: -0.12, room: 0.3, macro: [[0, 0.12], [32, 0.1], [40, 0.18], [48, 0.12]] as Curve, setup: { spread: 0.45 },
    notes: [
      [14, 1, 'C#5', 0.62, { hardness: 0.9, damp: 0.3 }], [14, 1, 'E5', 0.56, { hardness: 0.9, damp: 0.3 }],
      [B(8), 1, 'C#5', 0.8, { hardness: 0.95, damp: 0.4 }], [B(8), 1, 'E5', 0.72, { hardness: 0.95, damp: 0.4 }], [B(8), 1, 'G5', 0.72, { hardness: 0.95, damp: 0.4 }],
      [46, 1, 'C#5', 0.66, { hardness: 0.9, damp: 0.3 }], [46, 1, 'E5', 0.6, { hardness: 0.9, damp: 0.3 }],
    ],
    phrases: [
      ph('bars.head', 'head', 1, 0, [oct(1)], 0.8),
      ph('bars.echo', 'echo', 1, 3.25, [], 0.8),
      ph('bars.head-answer', 'head', 2, 0, [oct(1), tr(-2)], 0.8),
      ph('bars.echo-answer', 'echo', 2, 3.25, [tr(-2)], 0.8),
      ph('bars.stretto', 'stretto', 3, 0, [tr(-4), seq([0, 1, 2, 3], 1), dyn(0.7, 1)]),
      ph('bars.cadence', 'cadence', 4, 0, [frag(0, 2), oct(1)], 0.8),
      ph('bars.pickup', 'echo', 4, 3.25, [tr(-3)], 0.85),
      // II: silent until the break; the pickup arrives with a B natural, announcing the major
      ph('bars.pickup-major', 'echo', 8, 3.25, [tr(-3), mode('major')], 0.92),
      // III
      ph('bars.head-major', 'head', 9, 0, [oct(1), mode('major')], 0.86),
      ph('bars.echo-major', 'echo', 9, 3.25, [mode('major')], 0.86),
      ph('bars.head-ascent', 'head', 10, 0, [oct(1), tr(3), mode('major')], 0.84),
      ph('bars.echo-ascent', 'echo', 10, 3.25, [tr(3), mode('major')], 0.84),
      ph('bars.call-1', 'stretto', 11, 0, [tr(-4)], 0.82),
      ph('bars.call-2', 'stretto', 11, 2, [tr(-2)], 0.9),
      ph('bars.triplet-1', 'stretto', 12, 0, [scale(0.6667)], 0.9),
      ph('bars.triplet-3', 'stretto', 12, 1.333333, [scale(0.6667), tr(2)], 1),
      ph('bars.pickup-loop', 'echo', 12, 3.25, [tr(-3)], 0.9),
    ],
  };
  const tines = {
    id: 'tines', instrument: 'mechanical-orchestra/tine', gainDb: -8, pan: 0.3, room: 0.28, macro: [[0, 0.1], [28, 0.25], [32, 0.1], [40, 0.25], [48, 0.1]] as Curve, setup: { spread: 0.2 },
    notes: [
      [B(9), 0.5, 'D6', 0.66], [B(9), 0.5, 'F#6', 0.6], [B(9), 0.5, 'A6', 0.56],
      [B(10), 0.5, 'D6', 0.66], [B(10), 0.5, 'G6', 0.6], [B(10), 0.5, 'B6', 0.56],
    ],
    phrases: [
      // the chromatic ascent three octaves above the bass, struck on beats 1 and 3 of every bar
      ph('tines.rise', 'rise', 5, 0, [oct(3)], 0.8),
      ph('tines.rise-echo', 'rise', 5, 2, [oct(3), frag(0, 3)], 0.56),
      ph('tines.reply-1', 'stretto', 11, 1, [tr(-3)], 0.9),
      ph('tines.reply-2', 'stretto', 11, 3, [tr(-1)], 0.96),
      ph('tines.triplet-2', 'stretto', 12, 0.666667, [scale(0.6667), tr(1)], 0.96),
      ph('tines.run', 'echo', 12, 2.25, [mode('harmonic-minor')], 0.96),
      ph('tines.run-2', 'stretto', 12, 3, [scale(0.5), seq([-1, 2], 0.5), mode('harmonic-minor'), dyn(0.9, 1.1)]),
    ],
  };
  const bowNote = (bar: number, beat: number, beats: number, pitch: string, v: number, o: Record<string, number | string> = {}) => [B(bar, beat), beats, pitch, v, ...(Object.keys(o).length ? [o] : [])];
  const chord = (bar: number, beat: number, beats: number, pitches: string[], v: number, o: Record<string, number | string> = {}) => pitches.map((p, i) => bowNote(bar, beat, beats, p, v - 0.05 * i, o));
  const bow = {
    id: 'bow', instrument: 'mechanical-orchestra/bow', gainDb: -15, room: 0.32, macro: [[0, 0.08], [16, 0.12], [28, 0.4], [32, 0], [48, 0.08]] as Curve,
    expression: [[0, 0.6], [16, 0.62], [28, 0.8], [30, 0.6], [32, 0.78], [40, 0.74], [46, 0.84], [48, 0.6]] as Curve, setup: { spread: 0.3 },
    notes: [
      ...chord(1, 0, 4, ['A4', 'D4'], 0.6), ...chord(2, 0, 4, ['Bb4', 'D4'], 0.6),
      ...chord(3, 0, 2, ['G4', 'D4'], 0.6, { attack: 0.2 }), ...chord(3, 2, 2, ['G4', 'E4'], 0.62, { attack: 0.2 }),
      ...chord(4, 0, 2, ['F4', 'D4'], 0.6, { attack: 0.2 }), ...chord(4, 2, 2, ['G4', 'E4', 'C#4'], 0.64, { attack: 0.2 }),
      ...chord(5, 0, 4, ['A4', 'F4', 'D4'], 0.6), ...chord(6, 0, 4, ['G4', 'F4', 'D4'], 0.62), ...chord(7, 0, 4, ['Bb4', 'G4', 'E4'], 0.66),
      ...chord(8, 0, 1.5, ['A4', 'G4', 'E4'], 0.74, { articulation: 'bite' }),
      ...chord(9, 0, 4, ['A4', 'F#4', 'D4'], 0.66, { attack: 0.12 }), ...chord(10, 0, 4, ['B4', 'G4', 'D4'], 0.66, { attack: 0.2 }),
      ...chord(11, 0, 2, ['Bb4', 'G4', 'D4'], 0.64, { attack: 0.2 }), ...chord(11, 2, 2, ['Bb4', 'G4', 'E4'], 0.64, { attack: 0.2 }),
      ...chord(12, 0, 2, ['A4', 'F4', 'D4'], 0.64, { attack: 0.2 }), ...chord(12, 2, 2, ['G4', 'E4', 'C#4'], 0.7, { attack: 0.2 }),
    ],
  };
  const clock = {
    id: 'clock', instrument: 'mechanical-orchestra/clock', gainDb: -12, room: 0.12,
    macro: [[0, 0.25], [8, 0.3], [12, 0.75], [16, 0.25], [28, 0.3], [32, 0.45], [40, 0.6], [44, 0.8], [48, 0.25]] as Curve, humanize: { timingMs: 0, velocity: 0.1 },
    phrases: [
      ph('clock.bar1', 'pulse', 1), ph('clock.bar2', 'pulse', 2),
      ph('clock.double', 'pulse', 3, 0, [scale(0.5), seq([0, 0], 2)]),
      ph('clock.bar4', 'pulse', 4, 0, [frag(0, 6)]),
      ph('clock.roll', 'pulse', 4, 2.5, [frag(1, 3), seq([0, 0, 0], 0.5), dyn(0.9, 1.5)]),
      ph('clock.half', 'pulse', 5, 0, [scale(2)], 0.9),
      ph('clock.bar7', 'pulse', 7),
      ph('clock.roll-break', 'pulse', 8, 3, [frag(1, 3), seq([0, 0], 0.5), dyn(0.8, 1.5)]),
      ph('clock.drive-9', 'pulse', 9, 0, [scale(0.5), seq([0, 0], 2)]),
      ph('clock.drive-10', 'pulse', 10, 0, [scale(0.5), seq([0, 4], 2)]),
      ph('clock.drive-11', 'pulse', 11, 0, [scale(0.5), seq([0, 0], 2), dyn(0.9, 1.2)]),
      ph('clock.bar12', 'pulse', 12, 0, [frag(0, 6)]),
      ph('clock.roll-loop', 'pulse', 12, 2.5, [frag(1, 3), seq([0, 0, 0], 0.5), dyn(0.9, 1.5)]),
    ],
  };
  const spring = {
    id: 'spring', instrument: 'mechanical-orchestra/spring', gainDb: -10, pan: 0.1, room: 0.12, macro: 0.15,
    phrases: [
      ph('spring.1', 'sprang', 1), ph('spring.2', 'sprang', 2, 0, [tr(-2)]), ph('spring.3', 'sprang', 3, 0, [tr(3)]), ph('spring.4', 'sprang', 4, 0, [endOn(8)]),
      ph('spring.major', 'sprang', 9), ph('spring.ascent', 'sprang', 10, 0, [tr(3)]),
      ph('spring.darken', 'sprang', 11, 0, [tr(3), endOn(8)]),
      ph('spring.pedal', 'sprang', 12, 1.75, [tr(4), frag(0, 2)]),
    ],
  };
  const kick = {
    id: 'kick', instrument: 'context/kick', gainDb: 1,
    phrases: [
      ph('kick.1', 'kick-lite', 1), ph('kick.2', 'kick-lite', 2), ph('kick.2-push', 'kick-one', 2, 3.5, [], 0.6),
      ph('kick.3', 'kick-lite', 3, 0, [rhythm([2, 0.5])]), ph('kick.4', 'kick-lite', 4, 0, [rhythm([2, 0.5])]), ph('kick.4-push', 'kick-one', 4, 3.5, [], 0.66),
      ph('kick.5', 'kick-one', 5), ph('kick.6', 'kick-one', 6), ph('kick.7', 'kick-lite', 7, 0, [rhythm([2, 0.5])]), ph('kick.7-push', 'kick-one', 7, 3.5, [], 0.7),
      ph('kick.8', 'kick-one', 8, 0, [], 1.1),
      ph('kick.9', 'kick-four', 9), ph('kick.10', 'kick-four', 10), ph('kick.10-push', 'kick-one', 10, 3.5, [], 0.62),
      ph('kick.11', 'kick-four', 11), ph('kick.11-push', 'kick-one', 11, 2.75, [], 0.62),
      ph('kick.12', 'kick', 12, 0, [frag(0, 3)]), ph('kick.12-push', 'kick-one', 12, 3.5, [], 0.78),
    ],
  };
  const snare = {
    id: 'snare', instrument: 'context/snare', gainDb: -6, room: 0.2,
    phrases: [
      ph('snare.8-clap', 'clap', 8, 0, [], 0.9),
      ph('snare.9', 'backbeat', 9), ph('snare.9-ghost', 'ghost', 9, 3.75),
      ph('snare.10', 'backbeat', 10), ph('snare.10-ghost-a', 'ghost', 10, 1.75), ph('snare.10-ghost-b', 'ghost', 10, 3.75),
      ph('snare.11', 'backbeat', 11), ph('snare.11-ghost', 'ghost', 11, 2.75),
      ph('snare.12', 'crack', 12, 1, [], 0.96), ...[0, 1, 2, 3].map(k => ph(`snare.12-roll-${k + 1}`, 'ghost', 12, 3 + k / 4, [], 0.9 + 0.42 * k)),
    ],
  };
  return {
    schema: 'daemonv12.signature-rack.score/2',
    title: 'HOOK//30 ASCENSION (recognition, transformation, payoff)',
    bpm: 96, key: 'D minor', timeSignature: '4/4', seed: 31, tailSeconds: 10, masterGainDb: 0,
    description: 'HOOK//30 candidate B. The B1 hook over bowed bars and a light pulse; then a low second voice and the lead sing the hook in canon two beats apart while the bass climbs by semitones from B-flat to C-sharp, an unresolved seventh, silence and a breath; then the hook in D major, answered a fourth higher, darkened through G minor, with the B1 mallet stretto as a conversation that speeds from eighths to triplets to sixteenths into the loop.',
    sections: [
      { id: 'recognition', bars: 4, development: 'B1 note for note in voice, bass, mallets and clock, with bowed bars holding the harmony and a kick and damped spring marking the bass riff. Dm | Bb | Gm C | Dm A7' },
      { id: 'transformation', bars: 4, development: 'deceptive arrival on B-flat. A low second voice sings the hook, rising each bar; the lead follows two beats later, twice at its original pitch, so the same notes are reharmonised by a bass that climbs a semitone per bar (tines mark the line three octaves up). The lead hangs on the seventh of A7; silence; one breath; the pickup returns with a B natural. Bb | G7/B | C7 | A7/C#' },
      { id: 'payoff', bars: 4, development: 'the hook in D major with the second voice a sixth below; answered a fourth higher (the highest note of the piece); the same reach darkened to G minor while bars and tines trade the stretto, speeding from eighths to triplets to sixteenths; the inverted cadence over a dominant pedal back to D minor. D | G | Gm C7/E | Dm/A A7b9' },
    ],
    annotations: {
      harmony: [[0, 'Dm'], [4, 'Bb'], [8, 'Gm'], [10, 'C'], [12, 'Dm'], [14, 'A7'], [16, 'Bbmaj7'], [20, 'G7/B'], [24, 'C7'], [28, 'A7/C#'], [32, 'D'], [36, 'G'], [40, 'Gm'], [42, 'C7/E'], [44, 'Dm/A'], [46, 'A7b9']],
      cues: [
        { id: 'hook', beat: 0, label: 'the B1 hook (voice), over bowed bars' },
        { id: 'cry', beat: 0.75, label: 'the cry: the rising sixth lands on F5' },
        { id: 'answer', beat: 4, label: 'the answer, a third lower' },
        { id: 'stretto', beat: 8, label: 'B1 stretto: mallets play the rising sixth twice as fast against the voice' },
        { id: 'cadence', beat: 12, label: 'the hook upside down' },
        { id: 'canon-low', beat: 16, label: 'movement II: deceptive arrival on B-flat; a low second voice sings the hook' },
        { id: 'canon-lead', beat: 18, label: 'the lead follows two beats later, at the original pitch' },
        { id: 'bass-b', beat: 20, label: 'the bass climbs a semitone: B natural under the hook\'s F' },
        { id: 'canon-lead-2', beat: 22, label: 'the lead sings the hook again; this time it ends upwards' },
        { id: 'bass-c', beat: 24, label: 'the bass climbs again: C' },
        { id: 'hang', beat: 28, label: 'A7 over C-sharp: the lead hangs on the seventh' },
        { id: 'silence', beat: 29.5, label: 'silence' },
        { id: 'breath', beat: 30.9, label: 'one breath' },
        { id: 'pickup-major', beat: 31.25, label: 'the B1 pickup, now with a B natural' },
        { id: 'major', beat: 32, label: 'movement III: the hook in D major' },
        { id: 'major-third', beat: 32.75, label: 'F-sharp: the seventh resolves' },
        { id: 'ascent', beat: 36, label: 'the hook answered a fourth higher' },
        { id: 'peak-b5', beat: 36.75, label: 'B5' },
        { id: 'darken', beat: 40, label: 'the same reach in G minor (B-flat again); bars and tines trade the stretto in eighths' },
        { id: 'top-c6', beat: 42.75, label: 'C6, the highest sung note' },
        { id: 'triplets', beat: 44, label: 'the trade speeds up: eighth triplets over the dominant pedal' },
        { id: 'sixteenths', beat: 46.25, label: 'sixteenths: the tines run, then the stretto at four times its first speed against the B1 pickup, ending on octave As' },
        { id: 'loop', beat: 48, label: 'loop point: A7 resolves to D minor in the first bar' },
      ],
    },
    room: { rt60: 1.9, size: 1.1, damp: 5600, predelayMs: 20, lowCut: 220 },
    motifs,
    parts: [voice, voice2, bass, bars, tines, bow, clock, spring, kick, snare],
  };
}

if (process.argv[1] && process.argv[1].endsWith('compose.ts')) {
  writeFileSync(new URL('./hook30-groove.score.json', import.meta.url), json(groove()));
  writeFileSync(new URL('./hook30-ascension.score.json', import.meta.url), json(ascension()));
  console.log('wrote studio-001/scores/hook30/hook30-groove.score.json and hook30-ascension.score.json');
}
export { groove, ascension, B1_MOTIFS, SHARED, at, ph, B, tr, oct, frag, seq, dyn, scale, gest, displace, endOn, mode, shift, rhythm, json, vox, type Motif, type Phrase, type Tf, type Curve, type MN };
