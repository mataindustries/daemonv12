/**
 * CONCRETE GOSPEL V3 · DARK TO DIVINE. 16 bars, 144 BPM (half time), F minor. The single source of truth: every note,
 * control curve, mix level and automation point of the V3 sketch.
 *
 * Foundation: the approved Concrete Gospel V2 drum and 808 tracks, unchanged (kick, snare, hats, toll, clank, 808, with
 * V2's gains, effects, 808 duck and master chain), taken from the byte-identical V2 sources vendored in
 * ../cathedral-experiment-001/upstream/. The V2 reed, V2 choir and their room are not used.
 *
 * On top, the three approved Cathedral Experiment instruments, played (not redesigned):
 *   THRONE//VOLT       the lead: the V2 hook rewritten an octave lower, sparser, with a commanding moan
 *   CATHEDRAL//ENGINE  the harmony: chord responses in the lead's rests, full organ only at the summit
 *   HEAVEN//MASS       the choir: a hum in the dark, small responses, an a-cappella breath, then the ceiling opens
 *
 * The form (beats from the start of bar 1; the V2 backing decides where the drums are):
 *   bars 1-4    darkness  bell, then quiet hats. The choir alone hums the hook's shape (Fm, Db, C): 1-3 voices per part
 *   bars 5-8    command   the drop. THRONE//VOLT states the new hook; the organ answers each phrase in its rests
 *   bars 9-11   tension   groove B. The hook climbs; Neapolitan colour (Gb); a few singers join the organ's answers
 *   bar 12      breath    V2's hole: drums and 808 vanish. The choir alone, close, Bbm9 - C7sus4 - C7b9, then silence
 *   bars 13-16  divine    the slam. The lead calls low; the choir answers high and wide; full-organ hits in the rests;
 *                         bar 16: minor plagal amen, then F MAJOR as the drums stop, the lead's moan landing on A
 *
 *   node experiments/concrete-gospel-003/compose.ts     writes source/
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as V1 from '../cathedral-experiment-001/upstream/concrete-gospel-001/compose.ts';
import * as V2 from '../cathedral-experiment-001/upstream/concrete-gospel-002/compose.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
export const BPM = 144, BARS = 16, TAIL_SECONDS = 4.5;
/**
 * The QA switch. `node build.ts --candidate` (or V3_CANDIDATE=1) rebuilds the composition exactly as it was measured
 * before the one technical QA/fix pass; without it the fixes (FIX below, listed in the README) apply.
 */
export const CANDIDATE = process.argv.includes('--candidate') || process.env.V3_CANDIDATE === '1';
const FIX = !CANDIDATE;
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
type Opts = Record<string, string | number>;
export type RackNote = [number, number, string, number, Opts?];
const rn = (beat: number, beats: number, pitch: string, vel: number, o?: Opts): RackNote => (o && Object.keys(o).length ? [r6(beat), r6(beats), pitch, r6(vel), o] : [r6(beat), r6(beats), pitch, r6(vel)]);
const chord = (beat: number, beats: number, pitches: string[], vel: number, o?: Opts) => pitches.map(p => rn(beat, beats, p, vel, o));
const SCHEMA = 'daemonv12.signature-rack.score/1';
export const SECTIONS = [
  { id: 'darkness', bars: 4, development: 'Bell and quiet hats. The choir alone hums the hook\'s shape: basses, then tenors, then altos (Fm, Db, C).' },
  { id: 'command', bars: 4, development: 'The drop. THRONE//VOLT states the V3 hook, low and sparse; the organ answers in its rests.' },
  { id: 'tension', bars: 3, development: 'Groove B. The hook climbs to Ab4 over a Neapolitan Gb; a few singers join the organ\'s answers.' },
  { id: 'breath', bars: 1, development: 'V2\'s hole. The choir alone and close: Bbm9, C7sus4, C7b9, then a breath of silence.' },
  { id: 'divine', bars: 4, development: 'The slam. Low lead calls, high wide choir answers, full-organ hits; the plagal amen resolves to F major.' },
];

// ================================================================================================ 1 · THRONE//VOLT
/**
 * The V3 hook, derived from V2's (call: Ab Bb B -> C held; answer: Eb Db C -> Ab moaning down to F) and rewritten:
 *   - an octave lower (Ab3-F4 instead of Ab4-Eb5), so it speaks from the chest of the mix, under the choir's ceiling
 *   - the triplet walk-ups are gone: the call's Ab-Bb-B-C becomes one deliberate bend (Ab3 gliding up to C4), the
 *     answer's Eb-Db-C-Ab becomes a leap (Eb4 down to Ab3, a fifth) that moans home to F3
 *   - phrased in four-bar sentences: bars 5-6 ask (the answer stops on Db, unresolved), bars 7-8 answer (moan home);
 *     bars 9-11 climb (C-Eb-F, then Gb, the Neapolitan, and Ab4, the peak); bars 13 and 15 are the calls alone (the
 *     choir answers); bar 16's moan falls C4 -> A3, onto the major third of the last chord
 * Accents spike the filter and sag the supply; held notes bloom; the sync scream is held down (authority, not squeal).
 */
const L = (beat: number, beats: number, pitch: string, vel: number, o: Opts = {}) => rn(beat, beats, pitch, vel, o);
const ACC = { articulation: 'accent' }, LEG = (slide: number, extra: Opts = {}) => ({ articulation: 'legato', slide, ...extra });
export const LEAD: RackNote[] = [
  // bars 5-6: the question
  L(16, 0.5, 'Ab3', 0.94, ACC), L(16.5, 2, 'C4', 0.86, LEG(0.3, { fall: 1, fallBeats: 0.4 })),           // bend up, a blue sag at the end
  L(20.5, 1, 'Eb4', 0.9, ACC), L(21.5, 2, 'Db4', 0.84, LEG(0.1)),                                         // ends on Db: unresolved
  // bars 7-8: the answer
  L(24, 0.5, 'Ab3', 0.9, ACC), L(24.5, 1.5, 'C4', 0.85, LEG(0.3)), L(26, 0.5, 'Db4', 0.86, LEG(0.08)), L(26.5, 0.75, 'C4', 0.82, LEG(0.08)),
  L(28.5, 1, 'Eb4', 0.92, ACC), L(29.5, 2, 'Ab3', 0.86, LEG(0.06, { fall: 3, fallBeats: 1 })),           // the leap, the moan home to F3
  // bars 9-10: the climb, the Neapolitan
  L(32, 0.5, 'C4', 0.94, ACC), L(32.5, 1.5, 'Eb4', 0.86, LEG(0.25)), L(34, 1, 'F4', 0.88, LEG(0.1)),
  L(36.5, 1, 'Gb4', 0.92, ACC), L(37.5, 0.5, 'F4', 0.84, LEG(0.08)), L(38, 1.25, 'Db4', 0.84, LEG(0.1, { fall: 1, fallBeats: 0.5 })),
  // bar 11: the peak, then the lead dives with the 808 into the hole
  L(40, 0.5, 'Eb4', 0.95, ACC), L(40.5, 1.5, 'Ab4', 0.88, LEG(0.3)), L(42, 0.5, 'G4', 0.86, LEG(0.08)), L(42.5, 2, 'F4', 0.86, LEG(0.08, { fall: 5, fallBeats: 1.1 })),
  // bar 13: the call returns at the slam (the choir answers in bar 14)
  L(48, 0.5, 'Ab3', 1, ACC), L(48.5, 2, 'C4', 0.9, LEG(0.3)),
  // bar 15: the last call
  L(56, 0.5, 'Ab3', 0.98, ACC), L(56.5, 1.5, 'C4', 0.9, LEG(0.3)), L(58, 0.5, 'Db4', 0.9, LEG(0.08)), L(58.5, 1, 'C4', 0.86, LEG(0.08)),
  // bar 16: the last answer; the moan lands on A natural as the choir turns to F major
  L(60.5, 1, 'Eb4', 0.95, ACC), L(61.5, 1, 'C4', 0.9, LEG(0.08, { fall: 3, fallBeats: 0.6 })), L(62.5, 2, 'A3', 0.84, LEG(0.04)),
];
const voltPart = {
  // QA fix F2 (gain staging): rendered 6 dB hotter at rack stage (stem peak about -3 dBFS) so the engine track stays within
  // its +12 dB range; the engine levels below are 6 dB lower to match (the room send follows the part gain)
  id: 'volt', instrument: 'throne-volt', gainDb: FIX ? 3 : -3, pan: 0, room: 0.14,
  setup: { seed: 7071, glide: 0.07, release: 0.3, attack: 0.005, vibRate: 4.8, drift: 3, keytrack: 0.6, lowcut: 140 },
  // smoulder in the command, hotter in the climb, blazing at the slam
  macro: [[16, 0.42], [31.9, 0.46], [32, 0.54], [43.9, 0.62], [48, 0.8], [64, 0.84]],
  expression: [[16, 0.76], [31.9, 0.76], [32, 0.8], [47.9, 0.8], [48, 0.86]],
  controls: {
    width: 0.32,                                                                    // a centred, solid voice
    sync: [[16, 0.03], [31.9, 0.05], [32, 0.09], [43.9, 0.14], [48, 0.2], [64, 0.22]], // the scream kept low: authority, not squeal
  },
  offsets: {
    vib: -3.5,                                                                       // straighter tone (late vibrato 4-8 cents)
    vowel: 0.12,                                                                     // more throat ("aw" at 0.7 / 1.2 kHz): cuts through the beat
    growl: [[32.9, 0], [33.1, 0.12], [33.9, 0.12], [34, 0], [48.9, 0], [49.1, 0.3], [50.4, 0.3], [50.5, 0], [56.9, 0], [57.1, 0.24], [57.9, 0.24], [58, 0]],
  },
  notes: LEAD,
};
export const leadScore = {
  schema: SCHEMA, title: 'Concrete Gospel V3: THRONE//VOLT lead', bpm: BPM, key: 'F minor', swing: 0.5, seed: 3001, tailSeconds: TAIL_SECONDS, masterGainDb: 0,
  description: 'The V3 hook on THRONE//VOLT (bars 5-16), with V2\'s own room for its lead.',
  sections: SECTIONS,
  room: { rt60: 1.9, size: 1.2, damp: 5000, predelayMs: 24, lowCut: 250 },
  parts: [voltPart],
};

// ================================================================================================ 2 · CATHEDRAL//ENGINE
/**
 * The organ is the harmony, never a second melody. It speaks in the lead's rests (call -> response, as a gospel organ
 * answers a preacher) and colours the 808's roots with tension: over F, Fm9 and Db; over the C pickups, C7b9 and
 * C7(b9 b13); in bars 9-11 higher and longer, Db -> C7b9 -> Bbm/F. Bar 12 it is silent (the choir is alone). Bars 13-16
 * the Great's principal chorus and Mixture hit in the rests, the Swell carries the choir's answer, and only the final
 * F major is full organ, with the Pedal taking the floor as the 808 dives away.
 */
const NAVE = { rt60: 4.8, size: 1.6, predelay: 40, lowCut: 220, damp: 4300, width: 1.1 };
const SWELL: RackNote[] = [
  ...chord(18.5, 1.5, ['Ab3', 'C4', 'Eb4', 'G4'], 0.72),             // R1 Fm9 (over 808 F2 -> Ab1)
  ...chord(23.5, 0.5, ['Bb3', 'Db4', 'E4', 'G4'], 0.76, { articulation: 'detached' }), // R2 C7b9 (808 C2 pickup; Db held over from the lead)
  ...chord(27.25, 1.25, ['Ab3', 'Db4', 'F4', 'Ab4'], 0.74),          // R3 Db/F
  ...chord(31.5, 0.5, ['Bb3', 'Db4', 'E4', 'Ab4'], 0.78, { articulation: 'detached' }), // R4 C7(b9 b13), under the hat roll
  ...chord(35, 1.5, ['Ab4', 'Db5', 'F5'], 0.76),                     // R5 Db/F, an octave up (the singers double it)
  ...chord(39.25, 0.75, ['Bb4', 'Db5', 'E5'], 0.78),                 // R6 C7b9 over the 808's Db2 -> C2 walk-down
  ...chord(42.5, 1.5, ['Bb4', 'Db5', 'F5'], 0.78),                   // R7 Bbm/F; releases as the drums vanish
  // bar 14: the floor under the choir's answer (Eb/Bb -> Bbm7 -> C7b9)
  ...chord(52.5, 1, ['Bb3', 'Eb4', 'G4'], 0.72), ...chord(53.5, 1.75, ['Bb3', 'Db4', 'F4'], 0.72), ...chord(55.25, 0.75, ['Bb3', 'Db4', 'E4'], 0.74),
  // bar 16: the amen
  ...chord(60, 2, ['Db4', 'F4', 'Bb4'], 0.74), ...chord(62, 3, ['C4', 'F4', 'A4'], 0.8),
];
const GREAT: RackNote[] = [
  ...chord(50.5, 1.25, ['Ab3', 'Db4', 'F4', 'Ab4', 'Db5'], 0.86, { articulation: 'marcato' }), // the first full-chorus hit: Db, the ceiling lifts
  ...chord(55.5, 0.5, ['Bb3', 'Db4', 'E4', 'G4'], 0.84, { articulation: 'marcato' }),          // C7b9 punch on the 808's C2
  ...chord(62, 3, ['F3', 'C4', 'F4', 'A4', 'C5'], 0.9),                                       // F major: full organ
];
const PEDAL: RackNote[] = [rn(62.5, 2.5, 'F2', 0.88)];             // written 8' pitch: F1 on the 16', F0 resultant on the 32'
export const organScore = {
  schema: SCHEMA, title: 'Concrete Gospel V3: CATHEDRAL//ENGINE', bpm: BPM, key: 'F minor', swing: 0.5, seed: 3002, tailSeconds: TAIL_SECONDS, masterGainDb: 0,
  description: 'Chord responses in the lead\'s rests (Swell), full-chorus hits and the final full organ (Great), the Pedal after the 808 dives.',
  sections: SECTIONS,
  parts: [
    {
      // rack-stage headroom: the final full organ clipped the PCM16 stem at -6 dB; the engine track gets the 4 dB back
      id: 'great', instrument: 'cathedral-engine/great', gainDb: -10, pan: 0, room: 0,
      setup: { ...NAVE, seed: 8081, output: 'mix' },
      controls: {
        principal8: 0.85, octave4: 0.72, fifteenth: 0.55, twelfth: 0.38,
        mixture: [[48, 0.6], [61.9, 0.6], [62, 0.85]], trumpet8: [[48, 0], [61.9, 0], [62, 0.55]], bourdon16: [[48, 0], [61.9, 0], [62, 0.7]],
        space: [[48, 0.62], [61.9, 0.62], [62, 1]], chiff: 1.1, wind: 0.5,
      },
      expression: [[48, 0.8], [61.9, 0.8], [62, 0.86]],
      notes: GREAT,
    },
    {
      id: 'swell', instrument: 'cathedral-engine/swell', gainDb: -6, pan: 0, room: 0,
      setup: { ...NAVE, seed: 8082, output: 'mix' },
      controls: {
        gedackt8: 0.85, celeste8: 0.75, flute4: [[16, 0], [34.8, 0], [35, 0.3], [52, 0.3], [60, 0.45]], hautbois8: [[16, 0.32], [34.8, 0.32], [35, 0.2], [59.9, 0.2], [60, 0.4]],
        swell: [[16, 0.42], [31.9, 0.46], [35, 0.58], [43.9, 0.7], [52, 0.6], [59.9, 0.65], [60, 0.8], [62, 1]],
        space: [[16, 0.42], [34.8, 0.42], [35, 0.55], [59.9, 0.55], [60, 0.7], [62, 1.05]], trem: 0.12, wind: 0.45, chiff: 0.9,
      },
      notes: SWELL,
    },
    {
      id: 'pedal', instrument: 'cathedral-engine/pedal', gainDb: -6, pan: 0, room: 0,
      setup: { ...NAVE, seed: 8083, output: 'mix', width: 0.5 },   // half tower width: the only low note stays centred
      controls: { subbass16: 0.95, contra32: 0.6, octave8: 0.6, posaune16: 0.35, space: 0.7, wind: 0.5 },
      notes: PEDAL,
    },
  ],
};

// ================================================================================================ 3 · HEAVEN//MASS
/**
 * Six lines, written as a real chorale (each line moves by step or common tone wherever it can):
 *   bars 1-4   basses hum F2 alone; tenors join on C3 and sigh to Db3; altos hum the hook's bend (Ab3 -> C4); the basses
 *              walk F -> Db -> C2 for a half cadence (Db major -> C major). Just-intoned, 1-3 voices per part.
 *   bars 9-11  three answers with the organ, "oo", a few voices each, an octave above the lead (Db, C7b9, Bbm/F)
 *   bar 12     a cappella, close: Bbm9 -> C7sus4 -> C7b9 (the sopranos' F5 suspension falls to E5 while the second
 *              sopranos rise C5 -> Db5), the basses taking the floor the 808 has left; then a breath of silence
 *   bars 13-16 the ceiling: Fm high (F5 C5 Ab4) under each lead call; Db major lifting in the rests (S1 F5 -> Ab5);
 *              bar 14 the choir sings the answer (Eb/Bb -> Bbm7 -> C7b9, every voice stepping down); a descant on C6;
 *              bar 16 Bbm (the minor plagal amen) -> F major: Bb5 -> A5 and Db5 -> C5, octavists on F1 as the 808 dives
 * Low end: while the 808 plays, no choir note is below Db3 and the octavists are silent; the low notes (F2, C2, Bb2) are
 * sung only where there is no 808 (bars 1-4, bar 12, the final chord).
 */
const JI = { m3: 15.6, M3: -13.7, P5: 2, m6: 13.7 };           // just intonation (cents from equal temperament), a cappella only
const CHOIR = {
  bass: [
    rn(0, 7.8, 'F2', 0.68, { articulation: 'swell', vowel: 'mm', to: 'oo' }), rn(8, 4, 'F2', 0.72, { vowel: 'oo' }), rn(12, 2, 'Db2', 0.72, { vowel: 'oh' }), rn(14, 1.4, 'C2', 0.74, { vowel: 'oh' }),
    rn(44, 1.5, 'Bb2', 0.8, { vowel: 'oh', to: 'ah' }), rn(45.5, 1.9, 'C3', 0.82, { vowel: 'ah' }),
    rn(50.5, 2, 'Db3', 0.82, { vowel: 'ah' }), rn(52.5, 1, 'Eb3', 0.84, { vowel: 'ah' }), rn(53.5, 1.75, 'Db3', 0.82, { vowel: 'ah' }), rn(55.25, 0.75, 'C3', 0.84, { vowel: 'ah' }),
    rn(60, 2, 'Bb2', 0.86, { vowel: 'ah' }), rn(62, 3.5, 'F2', 0.9, { vowel: 'ah', to: 'oh' }),
  ],
  tenor: [
    rn(2, 2, 'C3', 0.62, { vowel: 'mm', cents: JI.P5 }), rn(4, 4, 'Db3', 0.66, { vowel: 'oo', cents: JI.m6 }), rn(8, 4, 'C3', 0.7, { vowel: 'oo', cents: JI.P5 }),
    rn(12, 2, 'F3', 0.72, { vowel: 'oh', cents: JI.M3 }), rn(14, 1.4, 'E3', 0.74, { vowel: 'oh', cents: JI.M3 }),
    rn(42.5, 3, 'Db4', 0.74, { vowel: 'oo', to: 'oh' }), rn(45.5, 1.9, 'Bb3', 0.78, { vowel: 'ah' }),
    rn(50.5, 2, 'Ab4', 0.8, { vowel: 'ah' }), rn(52.5, 1, 'G4', 0.82, { vowel: 'ah' }), rn(53.5, 1.75, 'F4', 0.8, { vowel: 'ah' }), rn(55.25, 0.75, 'G4', 0.82, { vowel: 'ah' }),
    rn(60, 5.5, 'F4', 0.86, { vowel: 'ah', to: 'oh' }),
  ],
  alto: [
    rn(8, 0.5, 'Ab3', 0.66, { vowel: 'oo', cents: JI.m3 }), rn(8.5, 3.5, 'C4', 0.7, { vowel: 'oo', cents: JI.P5, slide: 0.25 }),
    rn(12, 2, 'Db4', 0.72, { vowel: 'oh' }), rn(14, 1.4, 'C4', 0.74, { vowel: 'oh' }),
    rn(35, 1.5, 'Ab4', 0.66, { vowel: 'oo' }), rn(39.25, 0.75, 'Bb4', 0.68, { vowel: 'oo' }),
    rn(42.5, 1.5, 'Bb4', 0.72, { vowel: 'oo', to: 'oh' }), rn(44, 1.5, 'Ab4', 0.76, { vowel: 'oh' }), rn(45.5, 1.9, 'G4', 0.8, { vowel: 'ah' }),
    rn(48, 2.5, 'Ab4', 0.8, { vowel: 'ah' }), rn(50.5, 2, 'Db5', 0.84, { vowel: 'ah' }),
    rn(52.5, 1, 'Bb4', 0.84, { vowel: 'ah' }), rn(53.5, 1.75, 'Ab4', 0.82, { vowel: 'ah' }), rn(55.25, 0.75, 'Bb4', 0.84, { vowel: 'ah' }),
    rn(56, 4, 'Ab4', 0.82, { vowel: 'ah' }), rn(60, 2, 'Db5', 0.86, { vowel: 'ah' }), rn(62, 3.5, 'C5', 0.9, { vowel: 'ah', to: 'oh' }),
  ],
  soprano: [
    rn(35, 1.5, 'F5', 0.66, { vowel: 'oo' }), rn(39.25, 0.75, 'E5', 0.68, { vowel: 'oo' }),
    rn(42.5, 4, 'F5', 0.74, { vowel: 'oo', to: 'ah' }), rn(46.5, 0.9, 'E5', 0.82, { vowel: 'ah' }),
    rn(48, 2.5, 'F5', 0.82, { vowel: 'ah' }), rn(50.5, 2, 'Ab5', 0.88, { vowel: 'ah' }),
    rn(52.5, 1, 'G5', 0.88, { vowel: 'ah' }), rn(53.5, 1.75, 'F5', 0.86, { vowel: 'ah' }), rn(55.25, 0.75, 'E5', 0.86, { vowel: 'ah' }),
    rn(56, 4, 'F5', 0.86, { vowel: 'ah' }), rn(60, 2, 'Bb5', 0.92, { vowel: 'ah' }), rn(62, 3.5, 'A5', 0.94, { vowel: 'ah', to: 'oh' }),
  ],
  'soprano-2': [
    rn(35, 1.5, 'Db5', 0.66, { vowel: 'oo' }), rn(39.25, 0.75, 'Db5', 0.68, { vowel: 'oo' }),
    rn(42.5, 1.5, 'Db5', 0.72, { vowel: 'oo' }), rn(44, 2.5, 'C5', 0.76, { vowel: 'oh', to: 'ah' }), rn(46.5, 0.9, 'Db5', 0.82, { vowel: 'ah' }),
    rn(48, 2.5, 'C5', 0.8, { vowel: 'ah' }), rn(50.5, 2, 'F5', 0.86, { vowel: 'ah' }),
    rn(52.5, 1, 'Eb5', 0.86, { vowel: 'ah' }), rn(53.5, 2.5, 'Db5', 0.84, { vowel: 'ah' }),
    rn(56, 4, 'C5', 0.84, { vowel: 'ah' }), rn(60, 5.5, 'F5', 0.9, { vowel: 'ah', to: 'oh' }),
  ],
  descant: [
    rn(56, 4, 'C6', 0.6, { articulation: 'swell', vowel: 'oo' }), rn(60, 2, 'Db6', 0.66, { vowel: 'oo' }), rn(62, 3.5, 'C6', 0.7, { vowel: 'oo', to: 'ah' }),
  ],
} satisfies Record<string, RackNote[]>;
/** Intimate (one or two singers per part) to heavenly (the full section, wide, airy, deep in the Nave). */
const CHOIR_MACRO: [number, number][] = [[0, 0.02], [8, 0.1], [15.4, 0.18], [35, 0.3], [42.5, 0.42], [44, 0.55], [47.4, 0.68], [48, 0.86], [56, 0.92], [60, 1]];
const CHOIR_EXPR: [number, number][] = [[0, 0.62], [15.4, 0.7], [35, 0.66], [42.5, 0.72], [44, 0.74], [46.5, 0.8], [48, 0.84], [60, 0.9], [62, 0.95], [65.5, 0.9]];
/** Rack-stage gains: headroom in the PCM16 stems and the balance inside each choir bus (the engine mix sets the rest). */
const CHOIR_GAIN: Record<string, number> = { bass: -14, tenor: -12, alto: -10, soprano: -13, 'soprano-2': -13, descant: -15 };
const SETUPS: Record<string, Opts> = {
  bass: { seed: 9001, singers: 6, octavists: 3, center: -0.05 }, tenor: { seed: 9002, singers: 6 }, alto: { seed: 9003, singers: 6 },
  soprano: { seed: 9004, singers: 6 }, 'soprano-2': { seed: 9005, singers: 6, center: -0.18 }, descant: { seed: 9006, singers: 3, center: 0.12, depth: 1 },
};
const INSTR: Record<string, string> = { bass: 'heaven-mass/bass', tenor: 'heaven-mass/tenor', alto: 'heaven-mass/alto', soprano: 'heaven-mass/soprano', 'soprano-2': 'heaven-mass/soprano', descant: 'heaven-mass/soprano' };
type Section = keyof typeof CHOIR;
const choirPart = (id: Section) => ({
  id, instrument: INSTR[id]!, gainDb: CHOIR_GAIN[id]!, pan: 0, room: 0,
  setup: { depth: 0.6, lowCut: 200, output: 'mix', ...SETUPS[id] },
  macro: id === 'descant' ? 1 : CHOIR_MACRO, expression: id === 'descant' ? [[56, 0.62], [60, 0.8], [62, 0.86], [65.5, 0.8]] : CHOIR_EXPR,
  ...(id === 'bass' ? { controls: { octavist: [[0, 0], [62.3, 0], [63, 0.9], [66, 0.9]] } } : {}),
  ...(id === 'descant' ? { controls: { air: 0.75, room: 1.2, width: 0.6 } } : {}),
  ...(id === 'soprano' || id === 'soprano-2' ? { offsets: { air: [[0, 0], [47.9, 0], [48, 0.1]] } } : {}),
  notes: CHOIR[id],
});
/** Three rack scores, one per engine bus (each renders on its own core): low (basses), mid (tenors, altos), high. */
const choirScore = (bus: string, ids: Section[]) => ({
  schema: SCHEMA, title: `Concrete Gospel V3: HEAVEN//MASS ${bus}`, bpm: BPM, key: 'F minor', swing: 0.5, seed: 3003, tailSeconds: TAIL_SECONDS, masterGainDb: 0,
  description: `HEAVEN//MASS, ${ids.join(' + ')}: the ${bus} choir bus of Concrete Gospel V3.`,
  sections: SECTIONS, parts: ids.map(choirPart),
});
export const choirLowScore = choirScore('low', ['bass']);
export const choirMidScore = choirScore('mid', ['tenor', 'alto']);
export const choirHighScore = choirScore('high', ['soprano', 'soprano-2', 'descant']);

// ================================================================================================ engine project
type Pt = { at: { musical: string }; value: number; transition?: 'linear' };
const BACKING = ['kick', 'snare', 'hats', 'toll', 'clank', 'bass808'];
/** V2's own drum and 808 tracks, unchanged (gains, effects, the 808 duck), from the vendored V2 compose module. */
export const backingTracks = () => (structuredClone(V2.project.tracks) as unknown as { id: string }[]).filter(t => BACKING.includes(t.id));
export const KICK_BEATS = V2.KICKS.map(([b]) => b);
export const SNARE_BEATS = [18, 22, 26, 30, 34, 38, 42, 50, 54, 58, 62];
/**
 * A gain lane in dB: a piecewise-linear base (rides) minus a short duck under each listed hit (full depth on the hit,
 * 40 % after 140 ticks, gone after 360 ticks: about 150 ms), so sustained parts step aside for the kick and snare.
 */
function lane(base: [number, number][], hits: number[], depth: number): Pt[] {
  const at = (b: number) => { if (b <= base[0]![0]) return base[0]![1]; for (let i = 1; i < base.length; i++) { const [b1, v1] = base[i]!, [b0, v0] = base[i - 1]!; if (b <= b1) return b1 === b0 ? v1 : v0 + (v1 - v0) * (b - b0) / (b1 - b0); } return base[base.length - 1]![1]; };
  const A = 30 / 960, H = 140 / 960, Z = 360 / 960;
  const duck = (b: number) => { let d = 0; for (const h of hits) { const x = b >= h - A && b < h ? (b - h + A) / A : b >= h && b < h + H ? 1 - 0.6 * (b - h) / H : b >= h + H && b < h + Z ? 0.4 * (1 - (b - h - H) / (Z - H)) : 0; d = Math.max(d, x); } return d * depth; };
  const ticks = new Set<number>();
  for (const [b] of base) ticks.add(Math.round(b * 960));
  for (const h of hits) for (const t of [h - A, h, h + H, h + Z]) ticks.add(Math.round(t * 960));
  return [...ticks].filter(t => t >= 0).sort((a, b) => a - b).map(t => ({ at: { musical: V1.pos(t / 960) }, value: r6(at(t / 960) - duck(t / 960)), transition: 'linear' as const }));
}
const labTrack = (id: string, description: string, gainDb: number, effects: unknown[], automation?: Pt[]) => ({
  id, description, instrument: { type: 'sampler', sample: `assets/lab/${id}.wav` }, mix: { gainDb }, effects, ...(automation ? { automation: { gainDb: automation } } : {}),
  clips: [{ bar: 1, pattern: 'all' }], patterns: [{ id: 'all', bars: BARS, notes: [{ start: '1:1', velocity: 1 }] }],
});
/**
 * Engine mix: each new track's level in dB, per section ([from beat, dB, ramp in beats before that beat]). Set by one
 * calibration render during composing (per-section loudness of every stem against V2's own stems; see the README):
 *   - the lead sits at the V2 reed's in-mix loudness (it already did: -17.4 / -16.5 / -16.7 LUFS against the reed's
 *     -17.1 / -16.9 / -16.4 in bars 5-8 / 9-11 / 13-16), +1.5 dB from the slam as V2 did
 *   - the organ's answers about 4 LU under the lead; the Great's hits and the final chord under the choir
 *   - the choir: the hum as it is; bar 12 a breath, quieter than the groove; bars 13-16 just above the 808, the
 *     sopranos 2.5 dB back while the lead calls
 */
type Level = [number, number, number?];
export const LEVELS: Record<string, Level[]> = {
  // QA fix F2: the lead louder: +1 dB from the drop and +2.5 dB from the slam, measured after its 2:1 compressor (which
  // this track gain feeds, so the steps here are twice that: +2 / +5 dB). The bar-15 call only +1 dB: its accent is a
  // resonant spike that passes the compressor's 12 ms attack, and at +2.5 dB it reached +1.06 dBFS on the track (here
  // -0.44). The candidate: 7.5, then 9 from the slam, with the part rendered 6 dB lower at rack stage.
  volt: FIX ? [[0, 3.5], [48, 8, 0.1], [56, 5, 0.1], [59.9, 8, 0.3]] : [[0, 7.5], [48, 9, 0.1]],
  'volt-room': [[0, FIX ? 2 : 8]],
  great: [[0, 1.4], [62, -3.5, 0.25]],
  swell: [[0, 7], [34, 2, 0.5], [48, -2.2, 0.5], [62, -6.9, 0.25]],
  pedal: [[0, 4.9]],
  'choir-low': [[0, 4], [44, -0.8, 0.5], [48, -3.2, 0.4], [62, -1, 0.25]],
  'choir-mid': [[0, 3], [34, 2.2, 1], [44, -3.6, 0.5], [48, -5.8, 0.4], [62, -4.3, 0.25]],
  'choir-high': [[0, 2.8], [44, -2.8, 0.5], [48, -6, 0.4], [50.5, -3.5, 0.25], [56, -6, 0.25], [59.5, -3.5, 0.25], [62, -3.9, 0.25]],
};
/**
 * Rides on top of the section levels: [from beat, to beat, dB down, ramp in beats either side].
 * QA fix F1: in the candidate the choir and organ covered the lead's own notes in the climax (the lead 0 to -7 dB under
 * the rest of the mix where V2's reed led by +4 to +6). The choir now steps back further while the lead calls (bar 13:
 * sopranos 5 dB more, tenors and altos 6; bar 15: 8 and 9) and under its last answer (sopranos 11, the others and the
 * Swell 9), and opens back up on the F major chord at beat 62; it is unchanged in its own answers and responses.
 * QA fix F3: bar 11's answer (choir and Swell, Bbm/F) 3 dB down while the lead's F4 falls through it into the hole.
 */
type Dip = [number, number, number, number?];
export const DIPS: Record<string, Dip[]> = FIX ? {
  'choir-high': [[42.5, 43.9, 3], [48, 50.5, 5], [56, 59.5, 8], [60.5, 61.75, 11]],
  'choir-mid': [[42.5, 43.9, 3], [48, 50.5, 6], [56, 59.5, 9], [60.5, 61.75, 9]],
  'choir-low': [[60.5, 61.75, 9]],
  swell: [[42.5, 43.9, 3], [60.5, 61.75, 9]],
} : {};
const stepsOf = (levels: Level[]): [number, number][] => levels.flatMap(([b, v, ramp = 0.5], i) => (i === 0 ? [[b, v]] : [[b - ramp, levels[i - 1]![1]], [b, v]]) as [number, number][]);
const dipsOf = (dips: Dip[]): [number, number][] => [[0, 0], ...dips.flatMap(([a, z, d, r = 0.25]) => [[a - r, 0], [a, -d], [z, -d], [z + r, 0]] as [number, number][])];
const curveAt = (pts: [number, number][], b: number) => {
  if (b <= pts[0]![0]) return pts[0]![1];
  for (let i = 1; i < pts.length; i++) { const [b1, v1] = pts[i]!, [b0, v0] = pts[i - 1]!; if (b <= b1) return b1 === b0 ? v1 : v0 + (v1 - v0) * (b - b0) / (b1 - b0); }
  return pts[pts.length - 1]![1];
};
/** Section levels plus rides, as one piecewise-linear curve (breakpoints of both). */
function baseOf(id: string): [number, number][] {
  const st = stepsOf(LEVELS[id]!), dp = dipsOf(DIPS[id] ?? []);
  return [...new Set([...st, ...dp].map(([b]) => b))].sort((a, b) => a - b).map(b => [b, r6(curveAt(st, b) + curveAt(dp, b))]);
}
const DRUMS = [...KICK_BEATS, ...SNARE_BEATS].sort((a, b) => a - b).filter(b => b < 62);
/** A track's gain lane: its section levels and rides, ducked under the kick and snare by `duck` dB. */
const gains = (id: string, duck = 0) => lane(baseOf(id), duck ? DRUMS : [], duck);
const level0 = (id: string) => LEVELS[id]![0]![1];
export const project = {
  formatVersion: 1, title: 'Concrete Gospel V3: Dark to Divine',
  description: 'Concrete Gospel V3 sketch. The approved V2 drums and 808 (unchanged) with THRONE//VOLT (lead), CATHEDRAL//ENGINE (harmony) and HEAVEN//MASS (choir).',
  bpm: BPM, timeSignature: '4/4', key: 'F minor', bars: BARS, seed: 1440, render: { tail: { seconds: TAIL_SECONDS } },
  master: structuredClone(V2.project.master),
  tracks: [
    ...backingTracks(),
    labTrack('volt', 'THRONE//VOLT: the V3 hook (rack stem). +1.5 dB from the slam, as V2 did for its lead.', level0('volt'),
      [{ type: 'highpass', frequencyHz: 150 }, { type: 'compressor', thresholdDb: -22, ratio: 2, attackMs: 12, releaseMs: 160, makeupGainDb: 2 }, { type: 'lowpass', frequencyHz: 9000 }], gains('volt')),
    labTrack('volt-room', 'V2\'s room (rack FDN) on THRONE//VOLT.', level0('volt-room'), [{ type: 'highpass', frequencyHz: 200 }]),
    labTrack('great', 'CATHEDRAL//ENGINE Great with its Nave: the full-chorus hits (bars 13-14) and the final full organ.', level0('great'),
      [{ type: 'highpass', frequencyHz: 90 }], gains('great', 2)),
    labTrack('swell', 'CATHEDRAL//ENGINE Swell with its Nave: the chord responses (bars 5-11), the floor under the choir\'s answer, the amen.', level0('swell'),
      [{ type: 'highpass', frequencyHz: 90 }], gains('swell', 2)),
    labTrack('pedal', 'CATHEDRAL//ENGINE Pedal: 16\', resultant 32\', 8\', Posaune, only after the 808 dives away.', level0('pedal'), []),
    labTrack('choir-low', 'HEAVEN//MASS basses (octavists on the final chord) with their Nave; a 4 dB duck on each kick and snare.', level0('choir-low'),
      [{ type: 'highpass', frequencyHz: 40 }], gains('choir-low', 4)),
    labTrack('choir-mid', 'HEAVEN//MASS tenors and altos with their Nave; a 2.5 dB duck on each kick and snare.', level0('choir-mid'),
      [{ type: 'highpass', frequencyHz: 80 }], gains('choir-mid', 2.5)),
    labTrack('choir-high', 'HEAVEN//MASS sopranos, second sopranos and descant with their Nave: back 2.5 dB under the lead\'s calls in the climax.', level0('choir-high'),
      [{ type: 'highpass', frequencyHz: 120 }], gains('choir-high', 1.5)),
  ],
};
/** What each engine asset is made of (rack render directory and file). */
export const ASSETS: Record<string, [string, string]> = {
  volt: ['v3-lead', 'stems/volt.wav'], 'volt-room': ['v3-lead', 'stems/room.wav'],
  great: ['v3-organ', 'stems/great.wav'], swell: ['v3-organ', 'stems/swell.wav'], pedal: ['v3-organ', 'stems/pedal.wav'],
  'choir-low': ['v3-choir-low', 'mix-dry.wav'], 'choir-mid': ['v3-choir-mid', 'mix-dry.wav'], 'choir-high': ['v3-choir-high', 'mix-dry.wav'],
};
export const SCORES = [
  { id: 'v3-lead', score: leadScore }, { id: 'v3-organ', score: organScore },
  { id: 'v3-choir-low', score: choirLowScore }, { id: 'v3-choir-mid', score: choirMidScore }, { id: 'v3-choir-high', score: choirHighScore },
] as const;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = join(HERE, 'source');
  mkdirSync(out, { recursive: true });
  for (const s of SCORES) writeFileSync(join(out, `${s.id}.score.json`), JSON.stringify(s.score, null, 1) + '\n');
  writeFileSync(join(out, 'concrete-gospel-v3.project.json'), JSON.stringify(project, null, 1) + '\n');
  const choirNotes = Object.values(CHOIR).reduce((a, n) => a + n.length, 0);
  console.log(`wrote ${out}: ${SCORES.length} rack scores, 1 engine project (${project.tracks.length} tracks); lead ${LEAD.length} notes, organ ${SWELL.length + GREAT.length + PEDAL.length}, choir ${choirNotes}${CANDIDATE ? ' [candidate]' : ''}`);
}
