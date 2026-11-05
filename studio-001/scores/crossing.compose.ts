/**
 * Authoring script for CROSSING (DAEMON//STUDIO 001 demonstration). Writes crossing.score.json, the saved
 * performance score that the rack renders and bounces. The JSON is the source of truth; this file only keeps the
 * repeated motifs exact while composing.   node studio-001/scores/crossing.compose.ts
 *
 * C minor, 84 BPM, 18 bars. The three families transform in opposite directions and cross:
 *   voice      impossible -> human        (macro 1 -> 0)
 *   orchestra  alien machinery -> clockwork (macro 1 -> 0)
 *   bass       warm -> machine -> warm    (macro 0 -> 1, then back inside the final held note)
 * At bar 11 every macro sits near 0.5 and voice and bars sing the theme in unison. In the coda the glass halo
 * returns on the human voice's last note: one impossible echo.
 */
import { writeFileSync } from 'node:fs';

type O = Record<string, number | string>;
type N = [number, number, string, number, O?];
const at = (notes: N[], shift: number): N[] => notes.map(([b, l, p, v, o]) => (o ? [b + shift, l, p, v, o] : [b + shift, l, p, v]));

// ---------------------------------------------------------------- the theme (8 + 8 beats)
const T1: N[] = [
  [0, 1.5, 'G4', 0.62, { vowel: 'oo', to: 'oh' }], [1.5, 0.5, 'Ab4', 0.58, { vowel: 'oh' }], [2, 1, 'Bb4', 0.66, { vowel: 'oh', to: 'ah' }],
  [3, 1, 'Eb5', 0.74, { vowel: 'ah', slide: 0.12 }], [4, 2, 'D5', 0.8, { vowel: 'ah', to: 'aw' }], [6, 1, 'C5', 0.68, { vowel: 'aw', to: 'oh' }],
  [7, 0.5, 'Bb4', 0.6, { vowel: 'oh' }], [7.5, 0.45, 'G4', 0.55, { vowel: 'oh', to: 'oo' }],
];
const T2: N[] = [
  [8, 1, 'G4', 0.6, { vowel: 'oo' }], [9, 0.5, 'Ab4', 0.62, { vowel: 'oh' }], [9.5, 0.5, 'Bb4', 0.66, { vowel: 'oh' }],
  [10, 2, 'G5', 0.86, { vowel: 'ah', articulation: 'cry', cry: 1 }], [12, 1.5, 'F5', 0.76, { vowel: 'ah', to: 'eh', slide: 0.1 }],
  [13.5, 0.5, 'Eb5', 0.68, { vowel: 'eh' }], [14, 1.8, 'D5', 0.6, { vowel: 'oh', to: 'oo', articulation: 'fall', fall: 0.6 }],
];
// overtone melody (harmonic numbers) that follows the theme; only octaves, fifths and chord tones of each sung note
const OT1: [number, number][] = [[0, 4], [0.75, 6], [1.5, 5], [2, 4], [2.5, 6], [3, 3], [3.5, 4], [4, 4], [5, 2], [5.5, 4], [6, 3], [6.5, 4], [7, 6], [7.5, 8]];
const OT2: [number, number][] = [[8, 6], [9, 5], [9.5, 4], [10, 2], [11, 3], [12, 2], [12.75, 3], [13.5, 3], [14, 4]];
const shiftPts = (p: [number, number][], s: number) => p.map(([b, v]) => [b + s, v] as [number, number]);

// ---------------------------------------------------------------- macro paths (beats)
const VOICE_MACRO = [[0, 1], [16, 1], [32, 0.72], [40, 0.5], [44, 0.45], [52, 0.2], [60, 0], [74, 0]];
const ORCH_MACRO = [[0, 1], [16, 1], [32, 0.72], [40, 0.5], [44, 0.42], [56, 0.12], [60, 0], [74, 0]];
const BASS_MACRO = [[0, 0], [16, 0], [32, 0.05], [40, 0.5], [44, 0.62], [56, 0.95], [60, 1], [64, 1], [69, 0.12], [74, 0.12]];
const GLASS = [[0, 1], [16, 1], [32, 0.75], [40, 0.42], [52, 0.12], [64, 0.1], [66.5, 0.1], [69.5, 0.8], [74, 0.8]];

// ---------------------------------------------------------------- voices
const lead: N[] = [
  ...at(T1, 8), ...at(T1, 16), ...at(T2, 16),
  [36.5, 1.5, 'Eb5', 0.6, { vowel: 'oo', to: 'oh' }], [38, 1.5, 'D5', 0.55, { vowel: 'oh' }],
  ...at(T1, 40),
  [48, 1.5, 'C5', 0.55, { vowel: 'mm', to: 'oo', articulation: 'hum' }], [49.5, 0.5, 'Bb4', 0.55, { vowel: 'oo' }], [50, 1, 'Ab4', 0.6, { vowel: 'oo', to: 'oh' }],
  [51, 1, 'C5', 0.64, { vowel: 'oh' }], [52, 2, 'Eb5', 0.74, { vowel: 'oh', to: 'ah' }], [54, 1, 'D5', 0.66, { vowel: 'ah', to: 'oh' }], [55, 1, 'C5', 0.62, { vowel: 'oh' }],
  [56, 1.5, 'Ab4', 0.62, { vowel: 'oh' }], [57.5, 0.5, 'F4', 0.55, { vowel: 'oh' }], [58, 2, 'D5', 0.72, { vowel: 'oh', to: 'ah', slide: 0.12 }],
  [60, 1.5, 'B4', 0.68, { vowel: 'ah' }], [61.5, 0.5, 'Ab4', 0.6, { vowel: 'ah', to: 'oh' }], [62, 1.6, 'G4', 0.56, { vowel: 'oh', to: 'oo', articulation: 'fall', fall: 0.5 }],
  [64, 1, 'G4', 0.5, { vowel: 'mm', to: 'oo', articulation: 'hum' }], [65, 0.5, 'Ab4', 0.52, { vowel: 'oo' }], [65.5, 0.5, 'Bb4', 0.55, { vowel: 'oo', to: 'oh' }],
  [66, 5.6, 'C5', 0.6, { vowel: 'oh', to: 'oo' }],
];
const harmony: N[] = [
  [32, 4, 'Eb4', 0.45, { vowel: 'oo' }], [36, 3.8, 'D4', 0.45, { vowel: 'oo', to: 'oh', slide: 0.3 }],
  [40, 1.5, 'Eb4', 0.5, { vowel: 'oo', to: 'oh' }], [41.5, 0.5, 'F4', 0.48, { vowel: 'oh' }], [42, 1, 'G4', 0.52, { vowel: 'oh', to: 'ah' }], [43, 1, 'C5', 0.56, { vowel: 'ah', slide: 0.12 }],
  [44, 2, 'Bb4', 0.6, { vowel: 'ah', to: 'aw' }], [46, 1, 'Ab4', 0.54, { vowel: 'aw', to: 'oh' }], [47, 0.5, 'G4', 0.5, { vowel: 'oh' }], [47.5, 0.45, 'Eb4', 0.46, { vowel: 'oh', to: 'oo' }],
  [48, 4, 'Ab4', 0.45, { vowel: 'oh' }], [52, 4, 'G4', 0.48, { vowel: 'oh', to: 'ah', slide: 0.2 }], [56, 4, 'F4', 0.46, { vowel: 'ah', to: 'oh', slide: 0.2 }],
  [60, 2, 'F4', 0.46, { vowel: 'oh' }], [62, 1.8, 'D4', 0.42, { vowel: 'oh', to: 'oo', slide: 0.15 }],
  [64, 7.6, 'Eb4', 0.42, { vowel: 'mm', to: 'oo', articulation: 'hum' }],
];

// ---------------------------------------------------------------- bass (enters warm at bar 5)
const BAR5: N[] = [[0, 1.25, 'C2', 0.95, { articulation: 'accent', scoop: 3 }], [1.5, 0.25, 'C2', 0.5, { articulation: 'ghost' }], [1.75, 0.25, 'Eb2', 0.7], [2, 0.75, 'G2', 0.8, { slide: 0.06 }], [3, 0.5, 'Bb2', 0.75], [3.5, 0.5, 'G2', 0.7, { slide: 0.05 }]];
const bass: N[] = [
  ...at(BAR5, 16),
  [20, 1, 'Ab1', 0.95, { articulation: 'accent' }], [21.25, 0.25, 'Ab1', 0.5, { articulation: 'ghost' }], [21.5, 0.25, 'Ab2', 0.7, { articulation: 'staccato' }], [21.75, 0.25, 'G2', 0.7, { articulation: 'staccato' }], [22, 1.25, 'Eb2', 0.85, { slide: 0.1 }], [23.5, 0.5, 'G1', 0.75, { slide: 0.05 }],
  [24, 1.25, 'F1', 0.95, { articulation: 'accent', scoop: 2 }], [25.5, 0.25, 'F1', 0.5, { articulation: 'ghost' }], [25.75, 0.25, 'Ab1', 0.7], [26, 0.75, 'C2', 0.8, { slide: 0.06 }], [27, 0.5, 'Eb2', 0.75], [27.5, 0.5, 'C2', 0.7],
  [28, 1, 'G1', 0.95, { articulation: 'accent' }], [29.25, 0.25, 'G1', 0.5, { articulation: 'ghost' }], [29.5, 0.25, 'G2', 0.7, { articulation: 'staccato' }], [29.75, 0.25, 'F2', 0.7, { articulation: 'staccato' }], [30, 1, 'D2', 0.85, { slide: 0.08 }], [31, 1, 'B1', 0.8],
  [32, 1.25, 'Ab1', 0.95, { articulation: 'accent', slide: 0.08 }], [33.5, 0.25, 'Ab1', 0.5, { articulation: 'ghost' }], [33.75, 0.25, 'C2', 0.7], [34, 0.75, 'Eb2', 0.8, { slide: 0.06 }], [35, 0.5, 'G2', 0.75], [35.5, 0.5, 'Eb2', 0.7],
  [36, 1.25, 'Bb1', 0.95, { articulation: 'accent' }], [37.5, 0.25, 'Bb1', 0.5, { articulation: 'ghost' }], [37.75, 0.25, 'D2', 0.7], [38, 0.75, 'F2', 0.8, { slide: 0.06 }], [39, 0.5, 'Ab2', 0.75], [39.5, 0.5, 'B1', 0.8, { slide: 0.12 }],
  ...at(BAR5, 40),
  [44, 1.25, 'C2', 0.95, { articulation: 'accent' }], [45.5, 0.25, 'C2', 0.5, { articulation: 'ghost' }], [45.75, 0.25, 'C3', 0.7, { articulation: 'staccato' }], [46, 0.5, 'Bb2', 0.75], [46.5, 0.5, 'G2', 0.75], [47, 0.5, 'Eb2', 0.75], [47.5, 0.5, 'D2', 0.8, { slide: 0.06 }],
  [48, 1.5, 'F1', 1, { articulation: 'accent' }], [49.5, 0.25, 'F1', 0.5, { articulation: 'ghost' }], [49.75, 0.25, 'F2', 0.7, { articulation: 'staccato' }], [50, 1.5, 'C2', 0.85, { slide: 0.1 }], [51.5, 0.5, 'Eb2', 0.75],
  [52, 1.5, 'Ab1', 1, { articulation: 'accent', slide: 0.14 }], [53.5, 0.25, 'Ab1', 0.5, { articulation: 'ghost' }], [53.75, 0.25, 'Ab2', 0.7, { articulation: 'staccato' }], [54, 1.5, 'Eb2', 0.85, { slide: 0.1 }], [55.5, 0.5, 'G2', 0.75],
  [56, 1.5, 'D2', 1, { articulation: 'accent' }], [57.5, 0.25, 'D2', 0.5, { articulation: 'ghost' }], [57.75, 0.25, 'D3', 0.7, { articulation: 'staccato' }], [58, 1, 'Ab1', 0.9, { slide: 0.16 }], [59, 1, 'C2', 0.8],
  [60, 2, 'G1', 1, { articulation: 'accent' }], [62, 0.5, 'G2', 0.75, { articulation: 'staccato' }], [62.5, 0.5, 'F2', 0.75], [63, 0.5, 'D2', 0.75], [63.5, 0.5, 'B1', 0.8],
  [64, 6.5, 'C1', 1, { articulation: 'accent', scoop: 5 }],
];

// ---------------------------------------------------------------- mechanical orchestra
const ARP: Record<string, string[]> = {
  Cm: ['C5', 'G4', 'Eb5', 'D5', 'G4', 'C5', 'Bb4', 'G4'], Ab: ['C5', 'Ab4', 'Eb5', 'G5', 'Eb5', 'C5', 'G4', 'Ab4'], Fm: ['C5', 'F4', 'Ab4', 'G5', 'Ab4', 'C5', 'Eb5', 'C5'],
  G7: ['B4', 'D5', 'F5', 'Ab5', 'F5', 'D5', 'B4', 'G4'], AbHi: ['C5', 'Eb5', 'G5', 'C6', 'G5', 'Eb5', 'C5', 'Ab4'], Bb: ['D5', 'F5', 'Bb5', 'F5', 'D5', 'Bb4', 'F5', 'Ab5'],
  FmBox: ['F5', 'C6', 'Ab5', 'G5', 'C6', 'Ab5', 'F5', 'C5'], AbBox: ['Eb5', 'C6', 'G5', 'Ab5', 'C6', 'G5', 'Eb5', 'C5'], DhBox: ['D5', 'Ab5', 'F5', 'C6', 'Ab5', 'F5', 'D5', 'F5'], G7Box: ['G5', 'B5', 'D6', 'F6', 'Ab5', 'F5', 'D5', 'B4'],
};
const arp = (bar: number, name: string, v: number, w: number): N[] => ARP[name]!.map((p, i) => [bar * 4 + i * 0.5, 0.5, p, i % 2 ? w : v] as N);
const bars: N[] = [
  [0, 3, 'G4', 0.75], [3, 1, 'Ab4', 0.6], [4, 2, 'Bb4', 0.7], [6, 2, 'Eb5', 0.75], [8, 4, 'C4', 0.55], [8, 4, 'G4', 0.5], [12, 4, 'Ab3', 0.5], [12, 4, 'Eb4', 0.5], [14, 2, 'D5', 0.55],
  ...arp(4, 'Cm', 0.5, 0.4), ...arp(5, 'Ab', 0.5, 0.4), ...arp(6, 'Fm', 0.5, 0.4), ...arp(7, 'G7', 0.52, 0.42),
  ...arp(8, 'AbHi', 0.55, 0.45), ...arp(9, 'Bb', 0.58, 0.46),
  ...at(T1.map(([b, l, p]) => [b, l, p, 0.72] as N), 40),
  ...arp(12, 'FmBox', 0.55, 0.45), ...arp(13, 'AbBox', 0.55, 0.45), ...arp(14, 'DhBox', 0.55, 0.45), ...arp(15, 'G7Box', 0.58, 0.48),
  [64, 1, 'C5', 0.6], [65, 1, 'Eb5', 0.55], [66, 1, 'G5', 0.55], [67, 1, 'D6', 0.5], [68, 4, 'C6', 0.55], [70, 2, 'G5', 0.4],
];
const TINE: Record<string, string[]> = { Cm: ['C6', 'Eb6', 'G6', 'D7'], Ab: ['C6', 'Eb6', 'G6', 'C7'], Fm: ['F5', 'Ab5', 'C6', 'G6'], G7: ['B5', 'D6', 'F6', 'Ab6'], Bb: ['D6', 'F6', 'Bb6', 'C7'], Dh: ['D6', 'F6', 'Ab6', 'C7'] };
const CHORDS = ['Cm', 'Ab', 'Cm', 'Ab', 'Cm', 'Ab', 'Fm', 'G7', 'Ab', 'Bb', 'Cm', 'Cm', 'Fm', 'Ab', 'Dh', 'G7', 'Cm', 'Cm'];
const shape = [0, 1, 2, 3, 2, 1];
const tines: N[] = [];
for (const [from, to] of [[16, 32], [48, 66]] as [number, number][])
  for (let b = from, j = 0; b < to; b += 0.75, j++) tines.push([b, 0.5, TINE[CHORDS[Math.floor(b / 4)]!]![shape[j % 6]!]!, Number.isInteger(b / 4) ? 0.75 : 0.55]);
const ROOT: Record<string, [string, string]> = { Cm: ['C3', 'G2'], Ab: ['Ab2', 'Eb3'], Fm: ['F2', 'C3'], G7: ['G2', 'D3'], Bb: ['Bb2', 'F2'], Dh: ['D3', 'Ab2'] };
const springs: N[] = [[0, 4, 'C2', 0.8], [4, 4, 'Eb2', 0.6], [8, 4, 'C2', 0.8], [12, 4, 'Ab1', 0.7]];
for (let bar = 4; bar < 16; bar++) {
  const [r, f] = ROOT[CHORDS[bar]!]!, busy = bar >= 12;
  for (const [o, p, v] of (busy ? [[0.75, r, 0.45], [1.75, f, 0.35], [2.75, r, 0.45], [3.5, f, 0.35]] : [[0.75, r, 0.45], [2.75, f, 0.4]]) as [number, string, number][]) springs.push([bar * 4 + o, 0.5, p, v]);
}
springs.push([64, 4, 'C2', 0.6]);
const bows: N[] = [
  [0, 16, 'C3', 0.75, { articulation: 'fifth-under' }], [0, 16, 'G3', 0.6],
  [32, 4, 'Ab3', 0.6], [32, 4, 'Eb4', 0.55], [36, 4, 'Bb3', 0.6], [36, 4, 'F4', 0.55], [40, 8, 'C4', 0.6], [40, 8, 'G4', 0.55],
  [48, 4, 'Ab3', 0.55], [48, 4, 'C4', 0.5], [52, 4, 'G3', 0.55], [52, 4, 'Eb4', 0.5], [56, 4, 'Ab3', 0.55], [56, 4, 'D4', 0.5], [60, 4, 'G3', 0.6], [60, 4, 'F4', 0.55],
  [64, 8, 'C4', 0.55], [64, 8, 'G4', 0.5], [64, 8, 'Eb4', 0.45],
];
const kick: N[] = [], snare: N[] = [];
for (let bar = 4; bar < 16; bar++) {
  for (const [o, v] of (bar === 15 ? [[0, 1], [1.75, 0.6], [2.5, 0.85], [3.5, 0.7]] : [[0, 1], [1.75, 0.6], [2.5, 0.85]]) as [number, number][]) kick.push([bar * 4 + o, 0.5, 'G1', v]);
  snare.push([bar * 4 + 1, 0.5, 'C4', 0.8, ...(bar >= 12 ? [{ articulation: 'clap' }] : [])] as N, [bar * 4 + 3, 0.5, 'C4', 0.85]);
  if (bar % 2) snare.push([bar * 4 + 3.75, 0.25, 'C4', 0.35, { articulation: 'ghost' }]);
}
kick.push([64, 0.5, 'G1', 0.9]);

const score = {
  schema: 'daemonv12.signature-rack.score/1', title: 'CROSSING', bpm: 84, key: 'C minor', timeSignature: '4/4', swing: 0.55, seed: 11, tailSeconds: 2.4, masterGainDb: 1.5,
  description: 'DAEMON//STUDIO 001 demonstration. Three approved instrument families transform in opposite directions and cross at bar 11.',
  sections: [
    { id: 'alien-night', bars: 4, development: 'alien machinery and the impossible voice: gong bars, laser springs, a bowed drone with a twelfth-below subharmonic, bearings, zipping clock; the theme as a fragment' },
    { id: 'arrival', bars: 4, development: 'the Living Bass enters warm with a West Coast groove; tines and clock wake; the voice sings the whole theme, still strange' },
    { id: 'crossing', bars: 4, development: 'voice and orchestra fall toward human and clockwork while the bass rises toward the machine; at bar 11 every macro is near 0.5 and voice and bars sing the theme in unison' },
    { id: 'exchange', bars: 4, development: 'roles exchanged: a human voice and a clockwork music box over a growling machine bass with triplet and thirty-second gear motion' },
    { id: 'coda', bars: 2, development: 'the machine bass relaxes back to warm inside one held low C; the human hum ends on C and the glass halo returns as an echo' },
  ],
  room: { rt60: 2.6, size: 1.2, damp: 5200, predelayMs: 24, lowCut: 220 },
  parts: [
    { id: 'voice', instrument: 'impossible-voice', gainDb: -2, pan: 0.06, room: 0.22, macro: VOICE_MACRO, controls: { glass: GLASS },
      expression: [[0, 0.6], [16, 0.65], [24, 0.8], [40, 0.75], [48, 0.6], [56, 0.75], [64, 0.55], [72, 0.5]], setup: { vibRate: 5.1 },
      overtone: { steps: [...shiftPts(OT1, 8), ...shiftPts([...OT1, ...OT2], 16), ...shiftPts(OT1, 40)], glide: 0.1 },
      breaths: [[7.3, 0.6], [15.45, 0.5], [35.9, 0.55], [39.45, 0.5], [47.4, 0.55], [63.4, 0.55]].map(([beat, beats]) => ({ beat, beats, kind: 'in', velocity: 0.45 })).concat([{ beat: 71.7, beats: 1.4, kind: 'out', velocity: 0.45 }]),
      notes: lead },
    { id: 'voice-2', instrument: 'impossible-voice', gainDb: -8, pan: -0.3, room: 0.25, macro: VOICE_MACRO, controls: { glass: GLASS, whistle: 0 },
      setup: { size: -0.12, detune: -4, vibRate: 4.8, vibCents: 24, seed: 47 }, notes: harmony },
    { id: 'bass', instrument: 'living-bass', gainDb: -3, room: 0.06, macro: BASS_MACRO, expression: [[16, 0.7], [60, 0.8], [66, 0.75], [72, 0.6]],
      motion: [{ fromBeat: 0, toBeat: 32, preset: 'none' }, { fromBeat: 32, toBeat: 40, preset: 'eighths' }, { fromBeat: 40, toBeat: 48, preset: 'sixteenths' }, { fromBeat: 48, toBeat: 56, preset: 'triplets' },
        { fromBeat: 56, toBeat: 60, preset: 'revving' }, { fromBeat: 60, toBeat: 64, preset: 'thirty-seconds' }, { fromBeat: 64, toBeat: 67, preset: 'growl' }, { fromBeat: 67, toBeat: 70, preset: 'sixteenths' }, { fromBeat: 70, toBeat: 80, preset: 'none' }],
      notes: bass },
    { id: 'bars', instrument: 'mechanical-orchestra/bar', gainDb: -9, room: 0.25, macro: ORCH_MACRO, expression: [[0, 0.6], [40, 0.8], [48, 0.65], [64, 0.6]], setup: { spread: 0.45 }, notes: bars },
    { id: 'tines', instrument: 'mechanical-orchestra/tine', gainDb: -13, room: 0.25, macro: ORCH_MACRO, setup: { spread: 0.25 }, notes: tines },
    { id: 'spring', instrument: 'mechanical-orchestra/spring', gainDb: -10, room: 0.2, macro: ORCH_MACRO, notes: springs },
    { id: 'bow', instrument: 'mechanical-orchestra/bow', gainDb: -14, room: 0.3, macro: ORCH_MACRO, setup: { spread: 0.3 }, notes: bows },
    { id: 'clock', instrument: 'mechanical-orchestra/clock', gainDb: -15, room: 0.15, macro: ORCH_MACRO, humanize: { timingMs: 2.5, velocity: 0.12 },
      repeats: [
        { fromBeat: 0, toBeat: 16, lengthBeats: 1, notes: [[0, 0.1, 'C7', 0.8, { articulation: 'tock' }], [0.5, 0.1, 'G6', 0.6]] },
        { fromBeat: 16, toBeat: 64, lengthBeats: 1, notes: [[0, 0.1, 'C7', 1, { articulation: 'tock' }], [0.25, 0.1, 'G6', 0.32], [0.5, 0.1, 'Eb7', 0.55], [0.75, 0.1, 'G6', 0.32]] },
      ],
      notes: [[64, 0.1, 'C7', 0.9, { articulation: 'tock' }], [66, 0.1, 'C7', 0.7, { articulation: 'tock' }], [68, 0.1, 'C7', 0.5, { articulation: 'tock' }], [70, 0.1, 'C7', 0.35, { articulation: 'tock' }]] },
    { id: 'bearings', instrument: 'mechanical-orchestra/bearings', gainDb: -20, room: 0.35, macro: ORCH_MACRO,
      textures: [{ fromBeat: 0, toBeat: 16, density: [[0, 4], [16, 2]], pitches: ['C6', 'Eb6', 'G6', 'D7', 'Bb6'] }, { fromBeat: 32, toBeat: 46, density: [[32, 1.5], [40, 3], [46, 0.5]], pitches: ['Eb6', 'G6', 'C7', 'D7'] }] },
    { id: 'kick', instrument: 'context/kick', gainDb: -5, context: true, notes: kick },
    { id: 'snare', instrument: 'context/snare', gainDb: -8, room: 0.25, context: true, notes: snare },
  ],
};
writeFileSync(new URL('./crossing.score.json', import.meta.url), JSON.stringify(score, null, 2) + '\n');
console.log('wrote studio-001/scores/crossing.score.json');
