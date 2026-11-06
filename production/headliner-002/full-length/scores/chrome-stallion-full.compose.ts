// DAEMON//HEADLINER 002 — CHROME STALLION (full-length V1)
// Original development of the approved 41 s sketch B. G minor, 98 BPM, swing 0.58.
// 76 bars = 304 beats = 186.1 s + 2.5 s tail = 3:08.6. DNA: see ../FROZEN_SKETCH.json.
// Arc: ignition -> original groove -> harmonic development + voice melody -> strange-beauty
// break -> displaced evolution -> ORGANISM rupture (half-time, riff rhythm transfers to
// mechanical percussion, negative space, stop-time return) -> heavy evolved return ->
// high-register machine payoff -> warm coda (machine relaxes inside one held note).
import { writeFileSync } from 'node:fs';
type N = [number, number, string, number, Record<string, unknown>?];
interface CellP { r: string; t: string; d: string; l: string; m: string; e: string }
// The signature cell (sketch DNA): accent root w/ scoop, ghost, third, slid root, step-down, root, lift, staccato, held end.
function cell(base: number, p: CellP, shift = 0): N[] {
  const b = base + shift;
  return [
    [b, 1, p.r, 0.95, { articulation: 'accent', scoop: 2 }], [b + 1.25, 0.25, p.r, 0.5, { articulation: 'ghost' }],
    [b + 1.5, 0.5, p.t, 0.75], [b + 2, 0.75, p.r, 0.85, { slide: 0.08 }], [b + 3, 0.5, p.d, 0.7],
    [b + 3.5, 0.5, p.r, 0.75, { slide: 0.06 }], [b + 4, 1, p.l, 0.85, { articulation: 'accent' }],
    [b + 5.25, 0.25, p.l, 0.5, { articulation: 'ghost' }], [b + 5.5, 0.5, p.m, 0.7, { articulation: 'staccato' }],
    [b + 6, 1.5, p.e, 0.85, { slide: 0.12 }],
  ];
}
const G: CellP = { r: 'G1', t: 'Bb1', d: 'F1', l: 'Eb2', m: 'D2', e: 'F1' };
const G2nd: CellP = { ...G, e: 'G1' };
const EB: CellP = { r: 'Eb1', t: 'G1', d: 'Db1', l: 'Bb1', m: 'C2', e: 'F1' };
const CM: CellP = { r: 'C1', t: 'Eb2', d: 'Bb1', l: 'G1', m: 'F2', e: 'D2' };
const F: CellP = { r: 'F1', t: 'A1', d: 'Eb1', l: 'C2', m: 'Bb1', e: 'G1' };
const D: CellP = { r: 'D2', t: 'F#2', d: 'C2', l: 'A1', m: 'G1', e: 'A1' };
const GHI: CellP = { r: 'G2', t: 'Bb2', d: 'F2', l: 'Eb3', m: 'D3', e: 'G2' };

const bass: N[] = [
  // ignition (0-8): the riff's first gesture stretched, alone
  [0, 1.5, 'G1', 0.98, { articulation: 'accent', scoop: 3 }], [2, 0.5, 'Bb1', 0.7], [3, 1, 'G1', 0.85, { slide: 0.1 }], [5, 2, 'Eb2', 0.8, { slide: 0.12 }],
  // original groove (8-40): sketch cells verbatim in spirit
  ...cell(8, G), ...cell(16, G2nd), ...cell(24, G),
  [32, 1, 'C2', 0.9, { articulation: 'accent' }], [33.25, 0.25, 'C2', 0.5, { articulation: 'ghost' }], [33.5, 0.5, 'Eb2', 0.75], [34, 0.75, 'C2', 0.85, { slide: 0.08 }], [35, 0.5, 'Bb1', 0.7], [35.5, 0.5, 'C2', 0.75], [36, 1, 'D2', 0.9, { articulation: 'accent' }], [37.5, 0.5, 'A1', 0.7], [38, 1.5, 'G1', 0.9, { slide: 0.14, dive: 3, diveBeats: 1 }],
  // development (40-72): same cell, new harmony Eb / Cm / Eb / F
  ...cell(40, EB), ...cell(48, CM), ...cell(56, EB), ...cell(64, F),
  // strange-beauty break (72-104): warm long roots only
  [72, 6, 'G1', 0.8, { articulation: 'accent', scoop: 1 }], [80, 6, 'Eb1', 0.78], [88, 6, 'Bb1', 0.78], [96, 6, 'F1', 0.8, { slide: 0.1 }],
  // evolution (104-136): G G Eb(displaced +0.5) F
  ...cell(104, G), ...cell(112, G2nd), ...cell(120, EB, 0.5), ...cell(128, F),
  // ORGANISM (136-176): long machine notes under transferred rhythm; silence 156-164; stop-time hits
  [136, 7, 'G1', 0.95, { articulation: 'accent', scoop: 2 }], [144, 7, 'Eb1', 0.95, { articulation: 'accent', scoop: 1.5 }], [152, 3.5, 'G1', 0.92, { articulation: 'accent' }],
  [164, 1, 'G1', 0.98, { articulation: 'accent', scoop: 2 }], [166.5, 0.5, 'G1', 0.9, { articulation: 'accent' }], [168, 2.5, 'Eb1', 0.95, { articulation: 'accent', scoop: 1.5 }], [171, 0.5, 'F1', 0.9, { articulation: 'accent' }], [172, 3.5, 'G1', 0.95, { slide: 0.1 }],
  // heavy return (176-240)
  ...cell(176, G), ...cell(184, G2nd), ...cell(192, EB), ...cell(200, F), ...cell(208, G), ...cell(216, G2nd), ...cell(224, CM), ...cell(232, D),
  // payoff (240-272): riff an octave up as machine, then low growl cells
  ...cell(240, GHI), ...cell(248, GHI), ...cell(256, G),
  [264, 1, 'G1', 0.98, { articulation: 'accent', scoop: 2 }], [265.25, 0.25, 'G1', 0.55, { articulation: 'ghost' }], [265.5, 0.5, 'Bb1', 0.8], [266, 0.75, 'G1', 0.9, { slide: 0.08 }], [267, 0.5, 'F1', 0.75], [267.5, 0.5, 'G1', 0.8], [268, 3.5, 'G1', 0.95, { slide: 0.1, dive: 5, diveBeats: 1.5 }],
  // coda (272-304): warm fragments, then one held G: machine -> warm inside the note
  [272, 1.5, 'G1', 0.85, { articulation: 'accent', scoop: 1.5 }], [274, 1, 'Bb1', 0.65], [275.5, 2, 'G1', 0.75, { slide: 0.1 }], [280, 1.5, 'Eb2', 0.7], [282, 2, 'D2', 0.65, { slide: 0.12 }],
  [288, 8, 'G1', 0.85, { articulation: 'accent', scoop: 1 }], [300, 2.5, 'G1', 0.55, { articulation: 'accent', scoop: 1 }],
];

// drums: sketch pocket (kick 0/1.75/2.5, snare 1/3 + ghost), with section-aware ranges
const kick: N[] = [], snare: N[] = [];
function groove(from: number, to: number, vel = 1) {
  for (let b = from; b < to; b += 4) {
    kick.push([b, 0.5, 'G1', 1 * vel], [b + 1.75, 0.5, 'G1', 0.6 * vel], [b + 2.5, 0.5, 'G1', 0.85 * vel]);
    snare.push([b + 1, 0.5, 'C4', 0.9 * vel, { articulation: 'snare' }], [b + 3, 0.5, 'C4', 0.9 * vel, { articulation: 'snare' }]);
    if (b % 8 === 4) snare.push([b + 3.75, 0.25, 'C4', 0.45 * vel, { articulation: 'ghost' }]);
  }
}
groove(8, 72); groove(88, 104, 0.7); groove(104, 136); groove(176, 272);
// organism half-time + stop-time drums
for (let b = 136; b < 156; b += 4) { kick.push([b, 0.5, 'G1', 1]); snare.push([b + 2, 0.5, 'C4', 0.95, { articulation: 'snare' }]); }
kick.push([164, 0.5, 'G1', 1], [166.5, 0.5, 'G1', 0.9], [168, 0.5, 'G1', 1], [171, 0.5, 'G1', 0.9], [172, 0.5, 'G1', 1]);
snare.push([164, 0.5, 'C4', 0.9, { articulation: 'snare' }], [168, 0.5, 'C4', 0.9, { articulation: 'snare' }], [172, 0.5, 'C4', 0.95, { articulation: 'snare' }]);
kick.push([272, 0.5, 'G1', 0.8], [288, 0.5, 'G1', 0.7]); // coda heartbeats

// clock: hat in groove, sparse in break/coda, transferred riff-rhythm in organism, double in payoff
const clockNotes: N[] = [];
for (let b = 88; b < 104; b += 1) clockNotes.push([b, 0.1, 'G6', 0.35, { articulation: 'tock' }]);
for (const b of [163.5, 272, 276, 280, 284, 288, 296]) clockNotes.push([b, 0.1, 'G6', b === 163.5 ? 0.3 : 0.4, { articulation: 'tock' }]);

// tines: stab answers (sketch DNA), break sparkle, organism rhythm transfer, payoff stabs
const tines: N[] = [];
for (const b of [14, 22, 30, 38, 62, 70, 110, 118, 134, 182, 190, 198, 206, 214, 222, 230, 238, 246, 254, 262]) {
  tines.push([b, 0.4, 'G5', 0.6], [b, 0.4, 'Bb5', 0.5], [b + 0.75, 0.4, 'D6', 0.55]);
}
const RIFF_OFF = [0, 1.25, 1.5, 2, 3, 3.5, 4, 5.25, 5.5, 6];
for (const start of [136, 144, 152]) RIFF_OFF.forEach((o, i) => { tines.push([start + o, 0.3, ['G5', 'Bb5', 'D6', 'G6'][i % 4]!, 0.42 + (i % 3) * 0.08]); });

// bars: break melody + organism transfer (low rotation) + heavy-return accents
const bars: N[] = [
  [74, 1, 'D6', 0.4, { articulation: 'soft' }], [82, 1, 'Bb5', 0.38, { articulation: 'soft' }], [90, 1, 'F6', 0.38, { articulation: 'soft' }], [98, 1, 'D6', 0.4, { articulation: 'soft' }],
  [270, 1, 'G6', 0.45], [300, 2, 'G6', 0.38, { articulation: 'ring' }],
];
for (const start of [136, 144, 152]) RIFF_OFF.forEach((o, i) => { if (i % 2 === 0) bars.push([start + o, 0.4, ['G4', 'Eb5', 'Bb4', 'D5'][i % 4]!, 0.5]); });
for (const b of [192, 200, 224, 232]) bars.push([b, 0.5, 'G5', 0.5], [b + 4, 0.5, 'Eb5', 0.45]);

// voice: cries (sketch DNA) + haunting melody (development/break) + harmonies + overtone payoff
const voice: N[] = [];
for (const b of [26, 34, 108, 124, 186, 218]) voice.push([b, 0.75, 'G4', 0.6, { vowel: 'oh', to: 'ah', articulation: 'cry', cry: 1.2 }], [b + 1, 1.25, 'Bb4', 0.56, { vowel: 'ah', articulation: 'fall', fall: 0.8 }]);
voice.push(
  // development melody (40-64)
  [40, 2, 'G4', 0.66, { vowel: 'oo', to: 'oh' }], [42, 1.5, 'Bb4', 0.64, { vowel: 'oh' }], [43.5, 0.5, 'A4', 0.6, { slide: 0.08 }], [44, 2, 'G4', 0.66, { vowel: 'ah' }], [46, 2, 'F4', 0.62, { vowel: 'ah', to: 'oh' }],
  [48, 2, 'Eb4', 0.62, { vowel: 'oh' }], [50, 1.5, 'G4', 0.64, { vowel: 'oh' }], [51.5, 0.5, 'Bb4', 0.62, { slide: 0.08 }], [52, 2.5, 'C5', 0.72, { vowel: 'ah', articulation: 'cry', cry: 0.8 }], [54.5, 1.5, 'Bb4', 0.64, { slide: 0.08 }],
  [56, 2, 'Bb4', 0.62, { vowel: 'oh' }], [58, 2, 'G4', 0.62, { vowel: 'oh', to: 'ah' }], [60, 1.5, 'F4', 0.6, { vowel: 'ah' }], [61.5, 0.5, 'Eb4', 0.58, { slide: 0.08 }], [62, 2, 'D4', 0.62, { vowel: 'oh', articulation: 'fall', fall: 0.6 }],
  // strange-beauty break: the same melody, slower and bare (72-102)
  [72, 3.5, 'D5', 0.68, { vowel: 'oo', to: 'oh' }], [76, 2, 'Bb4', 0.62, { vowel: 'oh' }], [78, 1.5, 'A4', 0.6, { slide: 0.1 }], [79.5, 2.5, 'G4', 0.64, { vowel: 'oh', to: 'ah' }],
  [82, 2, 'F4', 0.6, { vowel: 'ah' }], [84, 3.5, 'Eb4', 0.62, { vowel: 'oh', articulation: 'fall', fall: 0.5 }],
  [88, 3, 'D4', 0.6, { vowel: 'oo' }], [92, 2, 'F4', 0.62, { vowel: 'oh' }], [94, 2.5, 'Bb4', 0.68, { vowel: 'ah', articulation: 'cry', cry: 0.7 }], [96.5, 1, 'A4', 0.6, { slide: 0.08 }], [98, 3, 'G4', 0.64, { vowel: 'ah', to: 'oo', articulation: 'fall', fall: 0.5 }],
  // organism: one hum in the negative space, one cry on the stop-time return
  [158, 5, 'G3', 0.5, { vowel: 'mm', articulation: 'hum' }], [164, 1, 'D5', 0.66, { vowel: 'ah', articulation: 'cry', cry: 1.5 }],
  // heavy return: melody fragment an octave of feeling higher
  [208, 2, 'D5', 0.56, { vowel: 'oo', to: 'ah' }], [210, 1.5, 'Bb4', 0.54, { slide: 0.08 }], [211.5, 0.5, 'A4', 0.52, { slide: 0.06 }], [212, 2.5, 'G4', 0.56, { vowel: 'ah', articulation: 'fall', fall: 0.6 }],
  // payoff: held root, the overtone lane sings (see overtone steps)
  [240, 7, 'G4', 0.62, { vowel: 'oo', to: 'oh', articulation: 'hum' }], [248, 7, 'G4', 0.6, { vowel: 'oh', to: 'ah', articulation: 'hum' }], [256, 3, 'Bb4', 0.64, { vowel: 'ah', articulation: 'cry', cry: 1 }],
  // coda resolution
  [272, 3.5, 'D5', 0.6, { vowel: 'oo', to: 'oh' }], [276, 2.5, 'Bb4', 0.58, { slide: 0.1 }], [279, 4, 'G4', 0.6, { vowel: 'oh', to: 'oo' }], [288, 4, 'G4', 0.5, { vowel: 'mm', articulation: 'hum' }],
);
const voice2: N[] = [];
for (const [b, p] of [[176, 'G3'], [184, 'G3'], [192, 'Eb3'], [200, 'F3'], [208, 'G3'], [216, 'G3'], [224, 'C4'], [232, 'D4']] as [number, string][]) {
  voice2.push([b, 6, p, 0.42, { vowel: 'oo', articulation: 'hum' }]);
}
const bow: N[] = [
  [72, 16, 'G3', 0.45, { articulation: 'swell' }], [72, 16, 'Bb3', 0.38, { articulation: 'swell' }], [88, 16, 'Eb3', 0.42, { articulation: 'swell' }], [88, 16, 'G3', 0.36, { articulation: 'swell' }],
  [156, 8, 'G3', 0.5, { articulation: 'overpressure' }], [156, 8, 'D3', 0.4, { articulation: 'swell' }],
];
const spring: N[] = [[72, 1, 'G2', 0.6, { articulation: 'pluck' }], [80, 1, 'Eb2', 0.55], [88, 1, 'Bb2', 0.55], [96, 1, 'F2', 0.58], [164, 1, 'G2', 0.65, { articulation: 'twang' }]];

const score = {
  schema: 'daemonv12.signature-rack.score/1', title: 'CHROME STALLION — Full Length', bpm: 98, key: 'G minor', timeSignature: '4/4', swing: 0.58, seed: 202, tailSeconds: 2.0, masterGainDb: 2.2,
  description: 'Full-length original development of sketch B: futuristic West Coast x industrial funk. The signature bass cell recurs through changing harmony, a haunting voice melody, a displaced evolution, a half-time ORGANISM rupture where mechanical percussion takes over the riff rhythm, an evolved heavy return, a high-register machine payoff, and a warm coda.',
  sections: [
    { id: 'ignition', bars: 2, development: 'stretched first gesture of the riff, bass alone with sparse clock' },
    { id: 'stallion-groove', bars: 8, development: 'the original sketch groove: G cells, Cm-D lift, tine stabs, voice cries, dive' },
    { id: 'development', bars: 8, development: 'signature cell over Eb/Cm/Eb/F; haunting voice melody enters' },
    { id: 'strange-beauty', bars: 8, development: 'drums withdraw; voice melody slow over bowed chords and warm long bass roots; soft drums return' },
    { id: 'evolution', bars: 8, development: 'groove returns, bass edges machine; Eb cell displaced +0.5 beat against unchanged drums' },
    { id: 'organism', bars: 10, development: 'half-time: bass becomes long machine notes while clock/tines/bars play the riff rhythm; 2-bar negative space (bow subharmonic + hum); stop-time return' },
    { id: 'heavy-return', bars: 16, development: 'full pocket returns evolved: G G Eb F G G Cm D cells, second voice hums harmony, melody fragment, machine bass' },
    { id: 'payoff', bars: 8, development: 'riff an octave up as machine, overtone-lane voice over held roots, growl cell and 5-semitone dive' },
    { id: 'coda', bars: 8, development: 'warm riff fragments, voice resolves D5-Bb4-G4, sparse clock; one held G relaxes machine->warm inside the note; final tine G' },
  ],
  room: { rt60: 1.9, size: 1.05, damp: 5800, predelayMs: 14, lowCut: 240 },
  parts: [
    { id: 'bass', instrument: 'living-bass', gainDb: -2, room: 0.04,
      macro: [[0, 0.3], [8, 0.08], [40, 0.15], [72, 0.05], [104, 0.35], [120, 0.5], [136, 0.6], [152, 0.85], [156, 0.4], [164, 0.95], [176, 0.75], [208, 0.85], [240, 0.9], [264, 1], [272, 0.5], [288, 0.65], [296, 0.05], [304, 0.02]],
      expression: [[0, 0.8], [72, 0.48], [104, 0.85], [176, 0.9], [240, 0.97], [272, 0.7], [304, 0.55]],
      humanize: { timingMs: 4, velocity: 0.06, seed: 7 },
      motion: [{ fromBeat: 8, toBeat: 72, preset: 'eighths' }, { fromBeat: 104, toBeat: 136, preset: 'sixteenths' }, { fromBeat: 136, toBeat: 144, preset: 'triplets' }, { fromBeat: 144, toBeat: 152, preset: 'revving' }, { fromBeat: 152, toBeat: 156, preset: 'thirty-seconds' }, { fromBeat: 164, toBeat: 172, preset: 'thirty-seconds' }, { fromBeat: 172, toBeat: 176, preset: 'growl' }, { fromBeat: 176, toBeat: 240, preset: 'sixteenths' }, { fromBeat: 240, toBeat: 256, preset: 'sixteenths' }, { fromBeat: 256, toBeat: 268, preset: 'growl' }],
      notes: bass },
    { id: 'voice', instrument: 'impossible-voice', gainDb: -3.5, pan: -0.12, room: 0.2,
      macro: [[40, 0.15], [72, 0.2], [88, 0.45], [104, 0.3], [176, 0.35], [208, 0.6], [240, 0.85], [272, 0.25], [288, 0.1], [304, 0.05]],
      controls: { glass: [[40, 0.15], [72, 0.35], [240, 0.85], [272, 0.3]], whistle: [[0, 0], [240, 0.85], [256, 0.4], [272, 0]] },
      expression: [[40, 0.65], [72, 0.5], [176, 0.62], [240, 0.8], [272, 0.55]],
      overtone: { steps: [[240, 3], [242, 5], [244, 4], [246, 6], [248, 5], [250, 8], [252, 6], [254, 4]], glide: 0.12 },
      breaths: [{ beat: 39.2, beats: 0.5, kind: 'in', velocity: 0.35 }, { beat: 71.2, beats: 0.6, kind: 'in', velocity: 0.35 }, { beat: 157.2, beats: 0.5, kind: 'in', velocity: 0.3 }, { beat: 271.2, beats: 0.6, kind: 'in', velocity: 0.3 }],
      notes: voice },
    { id: 'voice-2', instrument: 'impossible-voice', gainDb: -11.5, pan: 0.25, room: 0.25,
      macro: [[176, 0.3], [240, 0.5]], controls: { whistle: 0, glass: 0.1 }, setup: { size: -0.15, detune: -4, vibRate: 4.7, vibCents: 22, seed: 47 }, notes: voice2 },
    { id: 'tines', instrument: 'mechanical-orchestra/tine', gainDb: -12, pan: 0.25, room: 0.18,
      macro: [[0, 0.2], [136, 0.55], [176, 0.6], [240, 0.75]], expression: [[0, 0.8], [240, 0.95], [272, 0.7]], setup: { spread: 0.25 }, humanize: { timingMs: 3, velocity: 0.08, seed: 8 }, notes: tines },
    { id: 'bars', instrument: 'mechanical-orchestra/bar', gainDb: -10, pan: -0.2, room: 0.22,
      macro: [[72, 0.25], [136, 0.6], [176, 0.55], [272, 0.3]], setup: { spread: 0.5 }, humanize: { timingMs: 3, velocity: 0.08, seed: 12 }, notes: bars },
    { id: 'bow', instrument: 'mechanical-orchestra/bow', gainDb: -15, room: 0.35,
      macro: [[72, 0.3], [156, 0.85], [176, 0.3]], setup: { spread: 0.3 }, notes: bow },
    { id: 'spring', instrument: 'mechanical-orchestra/spring', gainDb: -9, pan: -0.3, room: 0.2,
      macro: [[72, 0.25], [164, 0.6]], notes: spring },
    { id: 'clock', instrument: 'mechanical-orchestra/clock', gainDb: -16, pan: -0.15, room: 0.1,
      macro: [[0, 0.15], [136, 0.65], [176, 0.6], [240, 0.85], [272, 0.3]], humanize: { timingMs: 2.5, velocity: 0.12, seed: 9 },
      repeats: [
        { fromBeat: 8, toBeat: 88, lengthBeats: 1, notes: [[0, 0.1, 'G6', 0.7, { articulation: 'tock' }], [0.5, 0.1, 'D7', 0.4]] },
        { fromBeat: 104, toBeat: 136, lengthBeats: 1, notes: [[0, 0.1, 'G6', 0.75, { articulation: 'tock' }], [0.5, 0.1, 'D7', 0.42]] },
        { fromBeat: 136, toBeat: 156, lengthBeats: 8, notes: RIFF_OFF.map((o, i) => [o, 0.1, i % 2 ? 'D7' : 'G6', 0.5 + (i % 3) * 0.12, { articulation: 'tock' }]) },
        { fromBeat: 168, toBeat: 176, lengthBeats: 8, notes: RIFF_OFF.map((o, i) => [o, 0.1, i % 2 ? 'D7' : 'G6', 0.55 + (i % 3) * 0.12, { articulation: 'tock' }]) },
        { fromBeat: 176, toBeat: 240, lengthBeats: 1, notes: [[0, 0.1, 'G6', 0.8, { articulation: 'tock' }], [0.5, 0.1, 'D7', 0.45]] },
        { fromBeat: 240, toBeat: 272, lengthBeats: 1, notes: [[0, 0.1, 'G6', 0.85, { articulation: 'tock' }], [0.25, 0.1, 'D7', 0.35], [0.5, 0.1, 'Bb6', 0.55], [0.75, 0.1, 'D7', 0.35]] },
      ], notes: clockNotes },
    { id: 'bearings', instrument: 'mechanical-orchestra/bearings', gainDb: -22, room: 0.4,
      macro: [[72, 0.3], [156, 0.6], [272, 0.25]],
      textures: [{ fromBeat: 72, toBeat: 96, density: [[72, 1.2], [96, 0.5]], pitches: ['G6', 'Bb6', 'D6', 'Eb6'] }, { fromBeat: 152, toBeat: 164, density: [[152, 2], [158, 0.4], [164, 1]], pitches: ['G6', 'D7', 'Bb6'] }] },
    { id: 'kick', instrument: 'context/kick', gainDb: -5, context: true, humanize: { timingMs: 2, velocity: 0.05, seed: 10 }, notes: kick },
    { id: 'snare', instrument: 'context/snare', gainDb: -8, room: 0.18, context: true, humanize: { timingMs: 3, velocity: 0.06, seed: 11 }, notes: snare },
  ],
};
writeFileSync(new URL('./chrome-stallion-full.score.json', import.meta.url), JSON.stringify(score, null, 2) + '\n');
console.log('wrote chrome-stallion-full.score.json');
