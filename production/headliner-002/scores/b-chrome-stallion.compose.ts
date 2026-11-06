// DAEMON//HEADLINER 002 — Sketch B: CHROME STALLION (The Impossible Groove)
// Original material. G minor, 98 BPM, swing 0.58, 16 bars = 64 beats = 39.2 s + tail.
// The hook IS the bass riff: a swaggering G-minor cell with a late Eb->F lift,
// answered by tine stabs and short voice cries. Bar 9 drops the floor out:
// half-time, triplet gear-bass, stop-time hits; payoff returns the riff as machine.
import { writeFileSync } from 'node:fs';
type N = [number, number, string, number, Record<string, unknown>?];

// 2-bar bass cell (beats 0-8), then variations. Chords: Gm Gm | Eb F / Gm Gm | Cm D
function cell(base: number, endPitch: string, endArt: Record<string, unknown> = {}): N[] {
  return [
    [base, 1, 'G1', 0.95, { articulation: 'accent', scoop: 2 }], [base + 1.25, 0.25, 'G1', 0.5, { articulation: 'ghost' }],
    [base + 1.5, 0.5, 'Bb1', 0.75], [base + 2, 0.75, 'G1', 0.85, { slide: 0.08 }], [base + 3, 0.5, 'F1', 0.7],
    [base + 3.5, 0.5, 'G1', 0.75, { slide: 0.06 }], [base + 4, 1, 'Eb2', 0.85, { articulation: 'accent' }],
    [base + 5.25, 0.25, 'Eb2', 0.5, { articulation: 'ghost' }], [base + 5.5, 0.5, 'D2', 0.7, { articulation: 'staccato' }],
    [base + 6, 1.5, endPitch, 0.85, { slide: 0.12, ...endArt }],
  ] as N[];
}
const bass: N[] = [
  ...cell(0, 'F1'), ...cell(8, 'G1'),
  // hook statement, higher answer ending
  ...cell(16, 'F1'), [24, 1, 'C2', 0.9, { articulation: 'accent' }], [25.25, 0.25, 'C2', 0.5, { articulation: 'ghost' }],
  [25.5, 0.5, 'Eb2', 0.75], [26, 0.75, 'C2', 0.85, { slide: 0.08 }], [27, 0.5, 'Bb1', 0.7], [27.5, 0.5, 'C2', 0.75],
  [28, 1, 'D2', 0.9, { articulation: 'accent' }], [29.5, 0.5, 'A1', 0.7], [30, 1.5, 'G1', 0.9, { slide: 0.14, dive: 3, diveBeats: 1 }],
  // disruption (32-48): stop-time + held sub, triplet motion comes from the motion lane
  [32, 2.5, 'G1', 0.95, { articulation: 'accent', scoop: 2 }], [36, 0.5, 'G1', 0.85, { articulation: 'accent' }], [37.5, 0.5, 'Bb1', 0.8],
  [40, 2.5, 'Eb1', 0.95, { articulation: 'accent', scoop: 1.5 }], [44, 0.5, 'F1', 0.85, { articulation: 'accent' }], [45.5, 0.5, 'D2', 0.85, { articulation: 'staccato' }], [46, 0.5, 'C2', 0.8, { articulation: 'staccato' }], [46.5, 1, 'G1', 0.9, { slide: 0.1 }],
  // payoff: the riff as machine
  ...cell(48, 'F1'), [56, 1, 'G1', 0.98, { articulation: 'accent', scoop: 2 }], [57.25, 0.25, 'G1', 0.55, { articulation: 'ghost' }],
  [57.5, 0.5, 'Bb1', 0.8], [58, 0.75, 'G1', 0.9, { slide: 0.08 }], [59, 0.5, 'F1', 0.75], [59.5, 0.5, 'G1', 0.8],
  [60, 3.5, 'G1', 0.95, { slide: 0.1, dive: 5, diveBeats: 1.5 }],
];
const kick: N[] = [], snare: N[] = [], clock: N[] = [], tines: N[] = [], voice: N[] = [];
for (let b = 0; b < 64; b += 4) {
  if (b >= 32 && b < 40) { kick.push([b, 0.5, 'G1', 1]); } // half-time floor
  else if (!(b >= 40 && b < 44)) { kick.push([b, 0.5, 'G1', 1], [b + 1.75, 0.5, 'G1', 0.6], [b + 2.5, 0.5, 'G1', 0.85]); }
  if (b >= 32 && b < 40) { snare.push([b + 2, 0.5, 'C4', 0.95, { articulation: 'snare' }]); }
  else { snare.push([b + 1, 0.5, 'C4', 0.9, { articulation: 'snare' }], [b + 3, 0.5, 'C4', 0.9, { articulation: 'snare' }]); if (b % 8 === 4) snare.push([b + 3.75, 0.25, 'C4', 0.45, { articulation: 'ghost' }]); }
}
// tine stab answers in hook + payoff only
for (const b of [6, 14, 22, 30, 54, 62]) { tines.push([b, 0.4, 'G5', 0.6, { articulation: 'pluck' }], [b, 0.4, 'Bb5', 0.5], [b + 0.75, 0.4, 'D6', 0.55]); }
// voice: wordless cries answering the riff, hook + payoff
for (const b of [18, 26, 50, 58]) { voice.push([b, 0.75, 'G4', 0.62, { vowel: 'oh', to: 'ah', articulation: 'cry', cry: 1.2 }], [b + 1, 1.25, 'Bb4', 0.58, { vowel: 'ah', articulation: 'fall', fall: 0.8 }]); }
voice.push([46.5, 1, 'D5', 0.66, { vowel: 'ah', articulation: 'cry', cry: 1.5 }]);

const score = {
  schema: 'daemonv12.signature-rack.score/1', title: 'CHROME STALLION — Sketch B (The Impossible Groove)', bpm: 98, key: 'G minor', timeSignature: '4/4', swing: 0.58, seed: 202, tailSeconds: 1.8, masterGainDb: 0,
  description: 'Original Impossible Groove sketch: West-Coast swagger bass riff (the hook) with tine stab and voice-cry answers; bar 9 drops to half-time stop-time with triplet gear bass; payoff returns the riff as full machine with a final dive.',
  sections: [
    { id: 'swagger', bars: 4, development: 'warm bass riff twice with kick/snare/clock groove, no answers yet' },
    { id: 'hook', bars: 4, development: 'riff develops to Cm-D lift; tine stabs and voice cries answer; ending dive' },
    { id: 'disruption', bars: 4, development: 'half-time stop-time hits, held subs, triplet/revving bass motion, one high cry' },
    { id: 'payoff', bars: 4, development: 'riff returns as machine (macro->0.9, growl motion), stabs+cries, final 5-semitone dive' },
  ],
  room: { rt60: 1.6, size: 1, damp: 6000, predelayMs: 12, lowCut: 250 },
  parts: [
    { id: 'bass', instrument: 'living-bass', gainDb: -2, room: 0.04,
      macro: [[0, 0.08], [16, 0.15], [32, 0.45], [48, 0.65], [56, 0.9], [64, 0.9]],
      expression: [[0, 0.75], [32, 0.85], [48, 0.9]],
      humanize: { timingMs: 4, velocity: 0.06, seed: 7 },
      motion: [{ fromBeat: 0, toBeat: 32, preset: 'eighths' }, { fromBeat: 32, toBeat: 40, preset: 'triplets' }, { fromBeat: 40, toBeat: 48, preset: 'revving' }, { fromBeat: 48, toBeat: 60, preset: 'sixteenths' }, { fromBeat: 60, toBeat: 64, preset: 'growl' }],
      notes: bass },
    { id: 'tines', instrument: 'mechanical-orchestra/tine', gainDb: -12, pan: 0.25, room: 0.18,
      macro: [[0, 0.2], [32, 0.5], [48, 0.7]], setup: { spread: 0.25 }, humanize: { timingMs: 3, velocity: 0.08, seed: 8 }, notes: tines },
    { id: 'voice', instrument: 'impossible-voice', gainDb: -5, pan: -0.2, room: 0.15,
      macro: [[0, 0.25], [32, 0.5], [48, 0.65]], controls: { whistle: 0, glass: 0.15 },
      breaths: [{ beat: 17.4, beats: 0.4, kind: 'in', velocity: 0.3 }], notes: voice },
    { id: 'clock', instrument: 'mechanical-orchestra/clock', gainDb: -16, pan: -0.15, room: 0.1,
      macro: [[0, 0.15], [32, 0.6], [48, 0.8]], humanize: { timingMs: 2.5, velocity: 0.12, seed: 9 },
      repeats: [{ fromBeat: 0, toBeat: 32, lengthBeats: 1, notes: [[0, 0.1, 'G6', 0.7, { articulation: 'tock' }], [0.5, 0.1, 'D7', 0.4]] },
                { fromBeat: 40, toBeat: 64, lengthBeats: 1, notes: [[0, 0.1, 'G6', 0.85, { articulation: 'tock' }], [0.25, 0.1, 'D7', 0.35], [0.5, 0.1, 'Bb6', 0.55], [0.75, 0.1, 'D7', 0.35]] }] },
    { id: 'kick', instrument: 'context/kick', gainDb: -5, context: true, humanize: { timingMs: 2, velocity: 0.05, seed: 10 }, notes: kick },
    { id: 'snare', instrument: 'context/snare', gainDb: -8, room: 0.18, context: true, humanize: { timingMs: 3, velocity: 0.06, seed: 11 }, notes: snare },
  ],
};
writeFileSync(new URL('./b-chrome-stallion.score.json', import.meta.url), JSON.stringify(score, null, 2) + '\n');
console.log('wrote b-chrome-stallion.score.json');
