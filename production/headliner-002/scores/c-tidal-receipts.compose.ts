// DAEMON//HEADLINER 002 — Sketch C: THE MOON KEEPS RECEIPTS (Beyond the Known)
// Original material. E major (Lydian colour: A#), 116 BPM, 18 bars = 72 beats = 37.2 s + tail.
// Invention: the hook is a 5-note "gravity motif" (E5-G#5-B5-A#5-F#5) stated in 7-beat cells
// that cross the barlines, hocketed between spring and bars so no single instrument owns it.
// The bass answers in the same 7-beat cycle. Only later does a voice sing it whole — and the
// finale gives it to the voice's overtone lane while the sung note just holds the root.
import { writeFileSync } from 'node:fs';
type N = [number, number, string, number, Record<string, unknown>?];
const MOTIF = ['E5', 'G#5', 'B5', 'A#5', 'F#5'];           // offsets inside a 7-beat cell:
const OFF = [0, 1.5, 3, 4.5, 5.5];
const spring: N[] = [], bars: N[] = [], bass: N[] = [], voice: N[] = [], bow: N[] = [];
// Signal (0-28): three 7-beat cells + a 7-beat tail, hocket spring(even idx)/bars(odd idx)
[0, 7, 14, 21].forEach((cell, ci) => {
  MOTIF.forEach((p, i) => { if (cell + OFF[i]! >= 28) return; const note: N = [cell + OFF[i]!, i === 4 ? 1.5 : 1, i % 2 ? p : p.replace('5', '4'), 0.55 + ci * 0.06, i % 2 ? { articulation: 'strike' } : { articulation: 'pluck' } ]; (i % 2 ? bars : spring).push(note); });
});
// Gravity (28-56): bass pulses every 7 beats against the barlines; motif fragments answer
for (let b = 28, i = 0; b < 56; b += 7, i++) bass.push([b, 2.5, ['E1', 'C#2', 'A1', 'B1'][i % 4]!, 0.88, { articulation: 'accent', scoop: 1.5 }]);
bass.push([35, 1, 'E2', 0.6, { articulation: 'ghost' }], [49, 1, 'B1', 0.6, { articulation: 'ghost' }]);
[28, 35, 42, 49].forEach((cell) => { bars.push([cell + 3, 1, 'B5', 0.5], [cell + 4.5, 1, 'A#5', 0.45], [cell + 5.5, 1.5, 'F#5', 0.48]); });
// Human hook (28-56 overlapping gravity): the voice finally sings the motif whole, twice
for (const start of [30, 44]) MOTIF.forEach((p, i) => voice.push([start + OFF[i]! * 1.4, i === 4 ? 2 : 1.3, p.replace('5', '4'), 0.68, { vowel: i < 2 ? 'oo' : 'ah', slide: i ? 0.09 : undefined }]));
// Zero-gravity break (56-64): bowed subharmonic + one motif note alone
bow.push([56, 8, 'E3', 0.6, { articulation: 'overpressure' }], [56, 8, 'B2', 0.45, { articulation: 'swell' }]);
bars.push([60, 2, 'A#5', 0.55, { articulation: 'ring' }]);
// Return (64-72): motif inverted-ish, an octave up in tines register via bars, voice holds root
['F#5', 'A#5', 'B5', 'G#5', 'E5'].forEach((p, i) => bars.push([64 + OFF[i]!, i === 4 ? 2 : 1, p, 0.6, { articulation: 'hard' }]));
voice.push([64, 7, 'E4', 0.6, { vowel: 'oo', to: 'oh', articulation: 'hum' }]);
bass.push([64, 3, 'E1', 0.9, { articulation: 'accent', scoop: 2 }], [68, 3, 'E1', 0.85, { dive: 4, diveBeats: 2 }]);
const clock: N[] = [[0, 0.1, 'E7', 0.7, { articulation: 'tock' }], [28, 0.1, 'E7', 0.7, { articulation: 'tock' }], [56, 0.1, 'E7', 0.6, { articulation: 'tock' }], [64, 0.1, 'E7', 0.8, { articulation: 'tock' }]];

const score = {
  schema: 'daemonv12.signature-rack.score/1', title: 'THE MOON KEEPS RECEIPTS — Sketch C (Beyond the Known)', bpm: 116, key: 'E major', timeSignature: '4/4', swing: 0.5, seed: 303, tailSeconds: 2, masterGainDb: 0,
  description: 'Original experimental sketch: a 5-note Lydian gravity motif in 7-beat cells crossing 4/4 barlines, hocketed between spring and bars; bass pulses in the same 7-cycle; a voice only later sings the motif whole; a subharmonic zero-gravity break; finale gives the motif to the overtone lane over a held root.',
  sections: [
    { id: 'signal', bars: 7, development: 'motif transmitted in four 7-beat cells crossing the barlines, hocketed spring (low octave)/bars, bearings rain, no voice, no bass (beats 0-28)' },
    { id: 'gravity-hook', bars: 7, development: 'bass pulses every 7 beats (E-C#-A-B) against the barlines while the voice finally sings the motif whole twice (beats 28-56)' },
    { id: 'zero-gravity', bars: 2, development: 'everything drops: bowed octave-subharmonic drone and one lone A# ring (beats 56-64)' },
    { id: 'return', bars: 2, development: 'motif returns reordered and harder in bars; voice holds only the root while its overtone lane plays the motif; final bass dive (beats 64-72)' },
  ],
  room: { rt60: 2.2, size: 1.1, damp: 5600, predelayMs: 18, lowCut: 200 },
  parts: [
    { id: 'spring', instrument: 'mechanical-orchestra/spring', gainDb: -10, pan: -0.2, room: 0.22,
      macro: [[0, 0.15], [28, 0.35], [56, 0.5], [64, 0.65]], notes: spring },
    { id: 'bars', instrument: 'mechanical-orchestra/bar', gainDb: -9, pan: 0.2, room: 0.25,
      macro: [[0, 0.15], [28, 0.35], [56, 0.5], [64, 0.7]], setup: { spread: 0.55 }, notes: bars },
    { id: 'bass', instrument: 'living-bass', gainDb: -3, room: 0.05,
      macro: [[28, 0.1], [56, 0.3], [64, 0.45]], motion: [{ fromBeat: 28, toBeat: 56, preset: 'breath' }], notes: bass },
    { id: 'voice', instrument: 'impossible-voice', gainDb: -2, pan: 0, room: 0.25,
      macro: [[28, 0.1], [44, 0.3], [64, 0.9]], controls: { glass: [[28, 0.1], [64, 0.85]], whistle: [[28, 0], [64, 0.9]] },
      expression: [[28, 0.65], [64, 0.6]],
      overtone: { steps: [[64, 5], [65.5, 6], [67, 8], [68.5, 7], [69.5, 6]], glide: 0.12 },
      breaths: [{ beat: 29.2, beats: 0.5, kind: 'in', velocity: 0.35 }], notes: voice },
    { id: 'bow', instrument: 'mechanical-orchestra/bow', gainDb: -14, room: 0.35,
      macro: [[56, 0.85]], setup: { spread: 0.3 }, notes: bow },
    { id: 'clock', instrument: 'mechanical-orchestra/clock', gainDb: -17, room: 0.12,
      macro: [[0, 0.3], [64, 0.6]], notes: clock },
    { id: 'bearings', instrument: 'mechanical-orchestra/bearings', gainDb: -21, room: 0.4,
      macro: [[0, 0.25], [64, 0.6]],
      textures: [{ fromBeat: 0, toBeat: 28, density: [[0, 2], [28, 0.8]], pitches: ['E6', 'G#6', 'B6', 'F#6'] }, { fromBeat: 56, toBeat: 64, density: [[56, 0.7], [64, 0.2]], pitches: ['E6', 'B6'] }] },
  ],
};
writeFileSync(new URL('./c-tidal-receipts.score.json', import.meta.url), JSON.stringify(score, null, 2) + '\n');
console.log('wrote c-tidal-receipts.score.json');
