// Score generator for the Opus Round 1 track. Writes ../project.json (DaemonV12 formatVersion 1).
//
//   node benchmarks/ultimate-beat-battle/round1/opus/tools/compose.ts [--out path]
//
// The score is authored here as musical data (16th-note slots, note names, syllables) and
// compiled to plain DaemonV12 JSON: positions, playbackRate/glide/offsetSeconds, gain/pan automation.
// Nothing here renders audio; the DaemonV12 CLI does that.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : join(HERE, '..', 'project.json');

// ---------------------------------------------------------------- time

const BPM = 140;
const BARS = 16;
const US_PER_QUARTER = Math.round(60_000_000 / BPM); // 428571, the engine's MIDI tempo
const TBAR = 3840, TBEAT = 960, T16 = 240;
const SWING = 60; // odd 16ths land 60 ticks (1/64 note, ~27 ms) late: a 62.5% 2-step shuffle

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }
function frac(ticks: number): string { const g = gcd(ticks, 3840); return `${ticks / g}/${3840 / g}`; }
function pos(ticks: number): string {
  const bar = Math.floor(ticks / TBAR) + 1, r = ticks % TBAR, beat = Math.floor(r / TBEAT) + 1, o = r % TBEAT;
  return o === 0 ? `${bar}:${beat}` : `${bar}:${beat}+${frac(o)}`;
}
/** Absolute tick of a 16th slot in a 1-based bar (slot may be fractional; odd integer slots swing). */
function at(bar: number, slot: number, swing = true): number {
  return (bar - 1) * TBAR + Math.round(slot * T16) + (swing && Number.isInteger(slot) && slot % 2 === 1 ? SWING : 0);
}
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const seconds = (ticks: number) => r6(ticks * US_PER_QUARTER / 960 / 1_000_000);
const rate = (semitones: number) => r6(2 ** (semitones / 12));

// ---------------------------------------------------------------- pitch

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midi(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name)!;
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const nameOf = (m: number) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
const VOX_BASE = midi('G#4');   // every vox syllable is sung on G#4
const SUB_BASE = midi('C#2');   // the 808 source is C#2
const GLASS_BASE = midi('C#5'); // GLASSHOUSE glass-hit is C#5

// ---------------------------------------------------------------- project model

type Note = Record<string, unknown>;
type Pattern = { id: string; description?: string; bars: number; notes: Note[] };
type Point = { at: { seconds: number } | { musical: string }; value: number; transition?: 'linear' };
type Track = {
  id: string; description: string; instrument: Record<string, string>;
  mix?: { gainDb?: number; pan?: number }; effects?: Record<string, unknown>[];
  automation?: { gainDb?: Point[]; pan?: Point[] };
  clips: { bar: number; pattern: string }[]; patterns: Pattern[];
};

const sn = (tick: number, fields: Note): Note => ({ start: pos(tick), ...fields });
const gm = (tick: number, pitch: string | string[], durTicks: number, velocity: number): Note => ({ start: pos(tick), pitch, duration: frac(durTicks), velocity: r6(velocity) });
const song = (notes: Note[], description?: string): Pick<Track, 'clips' | 'patterns'> =>
  ({ clips: [{ bar: 1, pattern: 'song' }], patterns: [{ id: 'song', ...(description ? { description } : {}), bars: BARS, notes }] });
/** Musical-time gain lane from [bar, beat, dB, linear?] tuples. */
const lane = (pts: [number, number, number, boolean?][]): Point[] => pts.map(([bar, beat, value, lin]) => ({ at: { musical: `${bar}:${beat}` }, value, ...(lin ? { transition: 'linear' as const } : {}) }));

// ---------------------------------------------------------------- the hook

type Syl = { slot: number; note: string; syl: string; vel: number; glideTo?: string; glideDur?: string; from?: number };

// Q (call): rises G#-B-C#, leaps to E and settles on D#, the 9th of C#m: a question.
// A (answer): circles C#-B-C#-B and falls to G#. Both use the same 3-3-4-2-4 rhythm.
const HOOK_Q: Syl[] = [
  { slot: 0, note: 'G#4', syl: 'ya-m', vel: 0.86 },
  { slot: 3, note: 'B4', syl: 'ya-s', vel: 0.72 },
  { slot: 6, note: 'C#5', syl: 'wo-m', vel: 0.84 },
  { slot: 10, note: 'E5', syl: 'hey-s', vel: 0.9 },
  { slot: 12, note: 'D#5', syl: 'ah-l', vel: 0.8 },
];
const HOOK_A: Syl[] = [
  { slot: 0, note: 'C#5', syl: 'da-m', vel: 0.88 },
  { slot: 3, note: 'B4', syl: 'da-s', vel: 0.7 },
  { slot: 6, note: 'C#5', syl: 'wo-m', vel: 0.82 },
  { slot: 10, note: 'B4', syl: 'ya-s', vel: 0.78 },
  { slot: 12, note: 'G#4', syl: 'ah-l', vel: 0.8 },
];

function vox(bar: number, s: Syl, transpose = 0, velScale = 1): Note {
  const f: Note = { pitch: s.syl, velocity: r6(Math.min(1, s.vel * velScale)), playbackRate: s.from ?? rate(midi(s.note) + transpose - VOX_BASE) };
  if (s.glideTo) f.glide = { to: rate(midi(s.glideTo) + transpose - VOX_BASE), duration: s.glideDur ?? '1/8' };
  return sn(at(bar, s.slot), f);
}
const phrase = (bar: number, p: Syl[], transpose = 0, velScale = 1) => p.map(s => vox(bar, s, transpose, velScale));

// ---------------------------------------------------------------- harmony

// Rootless, voice-led EP voicings (each change moves one or two voices).
const CHORDS: Record<string, { ep: string[]; root: string; choir: string[] }> = {
  'C#m9': { ep: ['E3', 'G#3', 'B3', 'D#4'], root: 'C#2', choir: ['G#3', 'B3', 'E4'] },
  'Amaj9': { ep: ['E3', 'G#3', 'B3', 'C#4'], root: 'A1', choir: ['G#3', 'C#4', 'E4'] },
  'F#m9': { ep: ['E3', 'G#3', 'A3', 'C#4'], root: 'F#1', choir: ['A3', 'C#4', 'E4'] },
  'G#7sus': { ep: ['D#3', 'F#3', 'A#3', 'C#4'], root: 'G#1', choir: ['F#3', 'C#4', 'D#4'] },
  'G#7b9': { ep: ['D#3', 'F#3', 'A3', 'C4'], root: 'G#1', choir: ['F#3', 'C4', 'D#4'] },
};
// Chord per bar (index = bar). Bar 15 moves F#m9 -> G#7b9 at beat 3; bar 16 resolves to C#m9.
const PROG = ['', 'C#m9', 'Amaj9', 'F#m9', 'G#7sus', 'C#m9', 'Amaj9', 'F#m9', 'G#7sus', 'Amaj9', 'F#m9', 'G#7sus', 'G#7b9', 'C#m9', 'Amaj9', 'F#m9', 'C#m9'];

/** EP comp in the 2-step stab rhythm: 0 (3 slots), swung 7 (short), 10 (held). */
function stabs(bar: number, chord: string, vel: number): Note[] {
  const v = CHORDS[chord].ep;
  return [gm(at(bar, 0), v, 3 * T16 - 20, vel), gm(at(bar, 7), v, T16 - SWING - 20, vel * 0.72), gm(at(bar, 10), v, 5 * T16, vel * 0.9)];
}

// ---------------------------------------------------------------- rhythm section data

type Hit = [slot: number, pitch: string, vel: number];
const KICK_A: Hit[] = [[0, 'kick', 0.95], [10, 'kick', 0.85]];
const KICK_B: Hit[] = [[0, 'kick', 0.95], [3, 'kick', 0.42], [10, 'kick', 0.85], [15, 'kick', 0.5]];
const CLAP: Hit[] = [[4, 'clap', 0.9], [12, 'clap', 0.92]];
const HATS_A: Hit[] = [[2, 'hat', 0.72], [3, 'hat', 0.34], [6, 'hat', 0.74], [7, 'hat', 0.32], [10, 'hat', 0.72], [11, 'hat', 0.36], [13, 'hat', 0.3], [14, 'hat', 0.76], [15, 'hat', 0.38]];
const HATS_B: Hit[] = [[2, 'hat', 0.72], [3, 'hat', 0.34], [5, 'rim', 0.62], [6, 'hat', 0.74], [7, 'hat', 0.32], [10, 'hat', 0.72], [11, 'rim', 0.58], [13, 'hat', 0.32], [14, 'hat-open', 0.6]];

function drumPattern(id: string, bars: number, layout: (bar: number) => Hit[], description?: string): Pattern {
  const notes: Note[] = [];
  for (let b = 1; b <= bars; b++) for (const [slot, pitch, vel] of layout(b)) notes.push({ start: pos(at(b, slot)), pitch, velocity: vel });
  return { id, ...(description ? { description } : {}), bars, notes };
}

// Absolute kick ticks (for the 808 ducking). Mirrors the kick track's clips below.
const kickTicks: number[] = [];
for (const bar of [5, 7, 13]) for (const [b, hits] of [[bar, KICK_A], [bar + 1, KICK_B]] as [number, Hit[]][]) for (const [s] of hits) kickTicks.push(at(b, s));
for (let k = 0; k < 7; k++) kickTicks.push(at(11 + Math.floor(k / 4), (k % 4) * 4));
for (const s of [0, 10, 14]) kickTicks.push(at(15, s));
kickTicks.push(at(16, 0));
kickTicks.sort((a, b) => a - b);

// ---------------------------------------------------------------- tracks

const tracks: Track[] = [];

// VOX: the hook, close and clear from the first second.
{
  const notes: Note[] = [];
  // 0:00 tape start: the first syllable spins up from quarter speed into G#4.
  notes.push(vox(1, { ...HOOK_Q[0], from: 0.25, glideTo: 'G#4', glideDur: '1/8' }));
  notes.push(...phrase(1, HOOK_Q.slice(1)), ...phrase(2, HOOK_A), ...phrase(3, HOOK_Q));
  notes.push(...phrase(4, HOOK_A.slice(0, 4)));                       // beat 4 of bar 4 is left to the reverse glass
  notes.push(...phrase(5, HOOK_Q), ...phrase(6, HOOK_A), ...phrase(7, HOOK_Q));
  notes.push(...phrase(8, HOOK_A.slice(0, 4)));
  for (let k = 0; k < 6; k++) notes.push(sn(at(8, 12 + k * 0.5, false), { pitch: 'da-s', velocity: r6(0.5 + k * 0.07), playbackRate: rate(k) })); // stutter climbs G#->C#
  // Switch: the high voice calls with the first half of each phrase; vox-low answers.
  notes.push(...phrase(9, HOOK_Q.slice(0, 3), 0, 0.85), ...phrase(10, HOOK_A.slice(0, 3), 0, 0.85));
  notes.push(...phrase(13, HOOK_Q), ...phrase(14, HOOK_A));
  // Bar 15: the held C#5 bends to B#4 as the harmony turns to G#7b9 (the suspension resolves).
  notes.push(...phrase(15, HOOK_Q.slice(0, 4)), vox(15, { slot: 12, note: 'C#5', syl: 'ah-l', vel: 0.86, glideTo: 'C5', glideDur: '1/8' }));
  // Bar 16: last word on the tonic while the tape stops under it (1.335 -> 0.25 over two beats).
  notes.push(sn(at(16, 0), { pitch: 'ah-l', velocity: 0.9, playbackRate: rate(midi('C#5') - VOX_BASE), glide: { to: 0.25, duration: '1/2' } }));
  tracks.push({
    id: 'vox', description: 'The hook: synthetic vowel syllables sung on G#4, pitched per note with playbackRate; tape start at 0:00, tape stop at the end.',
    instrument: { type: 'drumkit', kit: 'assets/opus-vox/kit.json' },
    mix: { gainDb: -1, pan: 0 },
    effects: [
      { type: 'highpass', frequencyHz: 170 },
      { type: 'compressor', thresholdDb: -20, ratio: 3, attackMs: 5, releaseMs: 90, makeupGainDb: 2 },
      { type: 'saturation', driveDb: 4, mix: 0.25 },
      { type: 'delay', timeMs: 321, wet: 0.14 },
      { type: 'reverb', roomSize: 0.55, decaySeconds: 1.4, wet: 0.18 },
    ],
    ...song(notes, 'Hook bars 1-8 and 13-16; switch calls in 9-10; bar 8 stutter; bar 15 suspension bend; bar 16 tape stop.'),
  });
}

// VOX-LOW: the same singer an octave down (rate x0.5): answers in the switch, spin-up riser,
// a quiet octave double in the final drop, and the last word.
{
  const notes: Note[] = [];
  notes.push(...phrase(9, HOOK_Q.slice(3), -12), ...phrase(10, HOOK_A.slice(3), -12));
  notes.push(sn(at(11, 8), { pitch: 'ah-l', velocity: 0.85, playbackRate: 0.25, glide: { to: 1, duration: '3/2' } })); // spin-up riser
  notes.push(...phrase(13, HOOK_Q, -12, 0.45), ...phrase(14, HOOK_A, -12, 0.45));
  notes.push(sn(at(16, 10), { pitch: 'oo-l', velocity: 0.6, playbackRate: rate(midi('C#4') - VOX_BASE) }));
  tracks.push({
    id: 'vox-low', description: 'The hook an octave down (slowed-tape voice): switch answers, six-beat spin-up riser, octave double under the final drop, closing "oo".',
    instrument: { type: 'drumkit', kit: 'assets/opus-vox/kit.json' },
    mix: { gainDb: -2, pan: -0.2 },
    effects: [{ type: 'highpass', frequencyHz: 140 }, { type: 'lowpass', frequencyHz: 3600 }, { type: 'reverb', roomSize: 0.7, decaySeconds: 1.8, wet: 0.28 }],
    ...song(notes),
  });
}

// VOX-HARM: final-drop harmony a diatonic third below, and the inhale before the final drop.
{
  const third: Record<string, string> = { 'G#4': 'E4', 'B4': 'G#4', 'C#5': 'A4', 'D#5': 'B4', 'E5': 'C#5' };
  const harm = (bar: number, p: Syl[]) => p.map(s => vox(bar, { ...s, note: third[s.note], vel: s.vel * 0.85 }));
  const notes: Note[] = [sn(at(12, 12), { pitch: 'breath-in', velocity: 1 }), ...harm(13, HOOK_Q), ...harm(14, HOOK_A)];
  tracks.push({
    id: 'vox-harm', description: 'Inhale filling the silent last beat of bar 12, then the hook harmonised a third below in the final drop.',
    instrument: { type: 'drumkit', kit: 'assets/opus-vox/kit.json' },
    mix: { gainDb: -5, pan: 0.4 },
    effects: [{ type: 'highpass', frequencyHz: 220 }, { type: 'reverb', roomSize: 0.6, decaySeconds: 1.6, wet: 0.26 }],
    ...song(notes),
  });
}

// KEYS: GM electric piano in the room. Fades in over bars 3-4 as the door opens.
{
  const notes: Note[] = [];
  for (let bar = 3; bar <= 8; bar++) notes.push(...stabs(bar, PROG[bar], 0.66));
  for (const bar of [9, 10]) notes.push(gm(at(bar, 0), CHORDS[PROG[bar]].ep, TBAR - 40, 0.52));
  notes.push(gm(at(11, 0), CHORDS['G#7sus'].ep, TBAR - 40, 0.55));
  for (let k = 0; k < 6; k++) notes.push(gm(at(12, k * 2), CHORDS['G#7b9'].ep, 2 * T16 - 30, 0.42 + k * 0.06)); // eighth pulse, crescendo; stops for the gap
  for (const bar of [13, 14]) notes.push(...stabs(bar, PROG[bar], 0.7));
  notes.push(gm(at(15, 0), CHORDS['F#m9'].ep, 3 * T16 - 20, 0.7), gm(at(15, 7), CHORDS['F#m9'].ep, T16 - SWING - 20, 0.52), gm(at(15, 8), CHORDS['G#7b9'].ep, 8 * T16 - 20, 0.7));
  notes.push(gm(at(16, 0), [...CHORDS['C#m9'].ep, 'G#4'], 2 * TBEAT, 0.72));
  tracks.push({
    id: 'keys', description: 'GM electric piano: rootless voice-led chords; 2-step stabs, held in the switch, eighth pulse into the gap.',
    instrument: { type: 'gm', program: 'electric_piano_1' },
    mix: { gainDb: 3, pan: -0.25 },
    effects: [{ type: 'highpass', frequencyHz: 140 }, { type: 'saturation', driveDb: 6, mix: 0.3 }, { type: 'lowpass', frequencyHz: 7000 }, { type: 'reverb', roomSize: 0.5, decaySeconds: 1.2, wet: 0.16 }],
    automation: { gainDb: lane([[3, 1, -16, true], [5, 1, 0]]) },
    ...song(notes),
  });
}

// KEYS-FAR: the same stabs heard through the wall (4-pole 600 Hz low-pass), fading as the door opens.
{
  const notes: Note[] = [];
  for (let bar = 1; bar <= 4; bar++) notes.push(...stabs(bar, PROG[bar], 0.72));
  tracks.push({
    id: 'keys-far', description: 'Bars 1-4: the electric piano next door; crossfades out against KEYS over bars 3-4.',
    instrument: { type: 'gm', program: 'electric_piano_1' },
    mix: { gainDb: 6, pan: 0 },
    effects: [{ type: 'lowpass', frequencyHz: 600 }, { type: 'lowpass', frequencyHz: 600 }, { type: 'reverb', roomSize: 0.7, decaySeconds: 1.4, wet: 0.3 }],
    automation: { gainDb: lane([[3, 1, 0, true], [4, 3, -18, true], [5, 1, -60]]) },
    ...song(notes),
  });
}

// CHOIR: GM choir pad under the switch, the build and the final drop.
{
  const notes: Note[] = [];
  for (const bar of [9, 10, 11]) notes.push(gm(at(bar, 0), CHORDS[PROG[bar]].choir, TBAR - 40, 0.6));
  notes.push(gm(at(12, 0), CHORDS['G#7b9'].choir, 3 * TBEAT - 40, 0.68));
  for (const bar of [13, 14]) notes.push(gm(at(bar, 0), CHORDS[PROG[bar]].choir, TBAR - 40, 0.5));
  notes.push(gm(at(15, 0), CHORDS['F#m9'].choir, 2 * TBEAT - 40, 0.5), gm(at(15, 8), CHORDS['G#7b9'].choir, 2 * TBEAT - 40, 0.55));
  tracks.push({
    id: 'choir', description: 'GM choir aahs: a human halo behind the synthetic voice.',
    instrument: { type: 'gm', program: 'choir_aahs' },
    mix: { gainDb: 4, pan: 0 },
    effects: [{ type: 'highpass', frequencyHz: 300 }, { type: 'reverb', roomSize: 0.7, decaySeconds: 2.0, wet: 0.35 }],
    ...song(notes),
  });
}

// GLASS: GLASSHOUSE glass-hit retuned per note: answers to the hook, then a counter-line.
{
  const notes: Note[] = [];
  const g = (bar: number, slot: number, note: string, vel: number) => notes.push(sn(at(bar, slot), { pitch: 'glass-hit', velocity: vel, playbackRate: rate(midi(note) - GLASS_BASE) }));
  // Answers in the rest after a phrase, an octave above the vocal's last note.
  g(2, 15, 'G#5', 0.6); g(5, 15, 'D#6', 0.6); g(6, 15, 'G#5', 0.55); g(7, 15, 'D#6', 0.6);
  // Switch: a slow falling line between the two voices.
  g(9, 8, 'E6', 0.62); g(9, 14, 'C#6', 0.5); g(10, 8, 'B5', 0.62); g(10, 14, 'G#5', 0.5);
  // Final drop counter-line, 3-3-2 against the hook.
  const line: [number, number, string][] = [[13, 2, 'B5'], [13, 5, 'C#6'], [13, 8, 'E6'], [14, 2, 'D#6'], [14, 5, 'C#6'], [14, 8, 'B5'], [15, 2, 'C#6'], [15, 5, 'A5'], [15, 8, 'B#5']];
  for (const [b, s, n] of line) g(b, s, n, 0.62);
  g(16, 0, 'C#6', 0.7);
  tracks.push({
    id: 'glass', description: 'GLASSHOUSE glass-hit at seven pitches: answers to the hook, a falling line in the switch, a counter-line in the final drop.',
    instrument: { type: 'drumkit', kit: 'assets/glasshouse/glass-kit.json' },
    mix: { gainDb: 0, pan: 0.35 },
    effects: [{ type: 'highpass', frequencyHz: 400 }, { type: 'delay', timeMs: 321, wet: 0.25 }, { type: 'reverb', roomSize: 0.6, decaySeconds: 1.6, wet: 0.25 }],
    automation: { pan: [{ at: { musical: '13:1' }, value: 0.4, transition: 'linear' }, { at: { musical: '16:1' }, value: -0.35 }] },
    ...song(notes),
  });
}

// GLASS-FX: reverse glass into the drops, prism impacts on the final drop and the last downbeat.
{
  const notes: Note[] = [
    sn(at(4, 8), { pitch: 'glass-reverse', velocity: 0.85 }),
    sn(at(12, 8), { pitch: 'glass-reverse', velocity: 0.6 }),
    sn(at(13, 0), { pitch: 'prism-impact', velocity: 0.85 }),
    sn(at(16, 0), { pitch: 'prism-impact', velocity: 0.75, glide: { to: 0.5, duration: '1/1' } }),
  ];
  tracks.push({
    id: 'glass-fx', description: 'Reverse glass (two beats) into bars 5 and 13; prism impacts on 13:1 and on the final downbeat, slowing to half speed.',
    instrument: { type: 'drumkit', kit: 'assets/glasshouse/glass-kit.json' },
    mix: { gainDb: -2, pan: 0 },
    effects: [{ type: 'highpass', frequencyHz: 120 }, { type: 'reverb', roomSize: 0.6, decaySeconds: 1.4, wet: 0.2 }],
    ...song(notes),
  });
}

// DRUMS-FAR: the party next door (bars 1-4): kick, clap and hats through a 4-pole 450 Hz wall.
tracks.push({
  id: 'drums-far', description: 'Bars 1-4: the 2-step beat heard through a wall; fades out as the door opens.',
  instrument: { type: 'drumkit', kit: 'assets/opus-drums/kit.json' },
  mix: { gainDb: 2 },
  effects: [{ type: 'lowpass', frequencyHz: 450 }, { type: 'lowpass', frequencyHz: 450 }, { type: 'reverb', roomSize: 0.65, decaySeconds: 0.9, wet: 0.25 }],
  automation: { gainDb: lane([[3, 1, 0, true], [4, 4, -20, true], [5, 1, -60]]) },
  clips: [{ bar: 1, pattern: 'next-door' }, { bar: 3, pattern: 'next-door' }],
  patterns: [drumPattern('next-door', 2, b => [...(b === 1 ? KICK_A : KICK_B), ...CLAP, ...HATS_A.filter(h => h[0] % 4 === 2)])],
});

// KICK: in the room from bar 5; quarter notes only in the build; one last hit at 16:1.
tracks.push({
  id: 'kick', description: '2-step kick (1 and the and-of-3, swung ghost and pickup on alternate bars); quarters in the build.',
  instrument: { type: 'drumkit', kit: 'assets/opus-drums/kit.json' },
  mix: { gainDb: -3 },
  effects: [{ type: 'highpass', frequencyHz: 45 }],
  clips: [{ bar: 5, pattern: 'two-step' }, { bar: 7, pattern: 'two-step' }, { bar: 11, pattern: 'build' }, { bar: 13, pattern: 'two-step' }, { bar: 15, pattern: 'last' }, { bar: 16, pattern: 'end' }],
  patterns: [
    drumPattern('two-step', 2, b => (b === 1 ? KICK_A : KICK_B)),
    drumPattern('build', 2, b => [0, 4, 8, 12].filter(s => b === 1 || s < 12).map((s, i) => [s, 'kick', 0.7 + 0.04 * (i + (b - 1) * 4)] as Hit), 'Quarter notes; beat 4 of bar 12 is silent.'),
    drumPattern('last', 1, () => [[0, 'kick', 0.95], [10, 'kick', 0.85], [14, 'kick', 0.6]]),
    drumPattern('end', 1, () => [[0, 'kick', 1]]),
  ],
});

// CLAP: on 2 and 4 from bar 3 (fading in with the door), half-time in the switch.
tracks.push({
  id: 'clap', description: 'Clap on 2 and 4, a snare flick into the switch, half-time on 3 in the switch.',
  instrument: { type: 'drumkit', kit: 'assets/opus-drums/kit.json' },
  mix: { gainDb: 3, pan: 0 },
  effects: [{ type: 'highpass', frequencyHz: 180 }, { type: 'reverb', roomSize: 0.45, decaySeconds: 0.9, wet: 0.16 }],
  automation: { gainDb: lane([[3, 1, -14, true], [5, 1, 0]]) },
  clips: [{ bar: 3, pattern: 'door' }, { bar: 5, pattern: 'drop' }, { bar: 9, pattern: 'half' }, { bar: 13, pattern: 'drop-b' }],
  patterns: [
    drumPattern('door', 2, () => CLAP),
    drumPattern('drop', 4, b => (b === 4 ? [...CLAP, [14, 'snare', 0.5], [15, 'snare', 0.62]] as Hit[] : CLAP)),
    drumPattern('half', 2, () => [[8, 'clap', 0.85]]),
    drumPattern('drop-b', 3, () => CLAP),
  ],
});

// HATS: swung offbeat hats and rims, shaker in the switch, a rising snare roll in the build.
{
  const roll: Note[] = [];
  for (let k = 0; k < 8; k++) roll.push({ start: pos(at(1, k * 2, false)), pitch: 'snare', velocity: r6(0.45 + k * 0.03), playbackRate: rate(k * 0.5) });
  for (let k = 0; k < 8; k++) roll.push({ start: pos(at(2, k, false)), pitch: 'snare', velocity: r6(0.68 + k * 0.025), playbackRate: rate(4 + k * 0.5) });
  for (let k = 0; k < 8; k++) roll.push({ start: pos(at(2, 8 + k * 0.5, false)), pitch: 'snare', velocity: r6(0.86 + k * 0.015), playbackRate: rate(8 + k * 0.5) });
  tracks.push({
    id: 'hats', description: 'Swung offbeat hats with rims answering the vocal; shaker in the switch; snare roll climbing an octave in the build.',
    instrument: { type: 'drumkit', kit: 'assets/opus-drums/kit.json' },
    mix: { gainDb: 0, pan: 0.15 },
    effects: [{ type: 'highpass', frequencyHz: 300 }],
    automation: {
      gainDb: lane([[3, 1, -16, true], [5, 1, 0]]),
      pan: lane([[11, 1, -0.35, true], [12, 3, 0.35], [13, 1, 0.15]]),
    },
    clips: [{ bar: 3, pattern: 'groove' }, { bar: 5, pattern: 'groove' }, { bar: 7, pattern: 'groove' }, { bar: 9, pattern: 'shaker' }, { bar: 11, pattern: 'roll' }, { bar: 13, pattern: 'groove' }, { bar: 15, pattern: 'last' }],
    patterns: [
      drumPattern('groove', 2, b => (b === 1 ? HATS_A : HATS_B)),
      drumPattern('shaker', 2, () => [[2, 'shaker', 0.7], [6, 'shaker', 0.6], [10, 'shaker', 0.7], [13, 'shaker', 0.45], [14, 'shaker', 0.62]]),
      { id: 'roll', description: 'Eighths, sixteenths, then thirty-seconds; each hit 1/2 semitone higher (playbackRate).', bars: 2, notes: roll },
      drumPattern('last', 1, () => HATS_A),
    ],
  });
}

// BASS: one 808 source on three round-robin tracks. Gain automation makes it monophonic (each
// note is choked 8 ms before the next starts), ducks it 5 dB under every kick (75 ms recovery),
// and sets section levels (next door: -9 dB; door opening: -9 -> 0 dB).
{
  type BassNote = { bar: number; slot: number; note: string; end?: number; glideTo?: string; glideDur?: string; vel?: number };
  const seq: BassNote[] = [];
  const riff = (bar: number, chord: string) => {
    const root = CHORDS[chord].root, r = midi(root);
    if (chord === 'G#7sus') seq.push({ bar, slot: 0, note: root }, { bar, slot: 10, note: root, glideTo: nameOf(r + 1), glideDur: '1/8' }); // creeps up to A1 for bar 9
    else seq.push({ bar, slot: 0, note: root }, { bar, slot: 10, note: root }, { bar, slot: 14, note: nameOf(r + 12), vel: 0.6 });
  };
  for (const bar of [1, 2, 3, 4]) { const r = CHORDS[PROG[bar]].root; seq.push({ bar, slot: 0, note: r }, { bar, slot: 10, note: r }); }
  for (let bar = 5; bar <= 8; bar++) riff(bar, PROG[bar]);
  seq.push({ bar: 9, slot: 0, note: 'A1', end: at(9, 8, false) });
  for (let k = 0; k < 15; k++) seq.push({ bar: 11 + Math.floor(k / 8), slot: (k % 8) * 2, note: 'G#1', vel: r6(0.55 + k * 0.027) }); // dominant pedal in eighths
  seq[seq.length - 1].end = at(12, 12, false);                                                                                  // silence on 12:4
  for (const bar of [13, 14]) riff(bar, PROG[bar]);
  seq.push({ bar: 15, slot: 0, note: 'F#1' }, { bar: 15, slot: 8, note: 'G#1' }, { bar: 15, slot: 14, note: 'G#1', glideTo: 'C#2', glideDur: '1/8' });
  seq.push({ bar: 16, slot: 0, note: 'C#2', glideTo: 'C#1', glideDur: '1/2', end: at(16, 8, false) });

  const base = (t: number) => { // section level in dB at tick t
    if (t < at(3, 0, false)) return -9;
    if (t < at(5, 0, false)) return -9 + 9 * (t - at(3, 0, false)) / (2 * TBAR);
    return 0;
  };
  const ticks = seq.map(n => at(n.bar, n.slot));
  const notes: Note[][] = [[], [], []];
  const pts: Point[][] = [[], [], []];
  const push = (l: number, t: number, value: number, linear: boolean) => {
    const p = pts[l], last = p[p.length - 1];
    const s = r6(t);
    if (last && 'seconds' in last.at && s <= last.at.seconds + 0.0005) p.pop(); // later definition wins on a collision
    p.push({ at: { seconds: s }, value: r6(value), ...(linear ? { transition: 'linear' as const } : {}) });
  };
  const DUCK = 5, DUCK_S = 0.075, FADE = 0.008, sec = (t: number) => seconds(t);
  seq.forEach((n, i) => {
    const l = i % 3, on = ticks[i], off = n.end ?? ticks[i + 1];
    const f: Note = { velocity: n.vel ?? 0.9, playbackRate: rate(midi(n.note) - SUB_BASE) };
    if (n.glideTo) f.glide = { to: rate(midi(n.glideTo) - SUB_BASE), duration: n.glideDur ?? '1/8' };
    notes[l].push(sn(on, f));
    const kicks = kickTicks.filter(k => k >= on && k < off);
    if (kicks[0] === on) { push(l, sec(on), base(on) - DUCK, true); push(l, sec(on) + DUCK_S, base(on), true); }
    else push(l, sec(on), base(on), true);
    for (const k of kicks) if (k !== on && sec(k) + DUCK_S < sec(off) - FADE) {
      push(l, sec(k) - 0.002, base(k), true); push(l, sec(k), base(k) - DUCK, true); push(l, sec(k) + DUCK_S, base(k), true);
    }
    push(l, sec(off) - FADE, base(off), true);
    push(l, sec(off), -60, false);
  });
  for (let l = 0; l < 3; l++) {
    tracks.push({
      id: `bass-${'abc'[l]}`, description: `808 voice ${l + 1} of 3 (round robin). Automation: choke, kick duck, section level.`,
      instrument: { type: 'sampler', sample: 'assets/opus-bass/sub-808-cs2.wav' },
      mix: { gainDb: -11 },
      effects: [{ type: 'saturation', driveDb: 9, mix: 0.35 }, { type: 'lowpass', frequencyHz: 1100 }],
      automation: { gainDb: pts[l] },
      ...song(notes[l]),
    });
  }
}

// ---------------------------------------------------------------- project

const project = {
  formatVersion: 1,
  title: 'Next Door',
  description: 'Ultimate Beat Battle Round 1 (Opus). A 2-step garage miniature in C# minor at 140 BPM. A synthetic singer is in the room with you while the party plays through the wall; at bar 5 the door opens. One 808 made monophonic from three choked voices; the same voice an octave down answers in the switch; GLASSHOUSE glass answers the hook.',
  bpm: BPM,
  timeSignature: '4/4',
  key: 'C# minor',
  bars: BARS,
  seed: 1,
  render: { duration: { seconds: 29.6 }, tail: 'auto' },
  master: {
    gainDb: 0,
    effects: [
      { type: 'highpass', frequencyHz: 28 },
      { type: 'compressor', thresholdDb: -18, ratio: 2, attackMs: 15, releaseMs: 160, makeupGainDb: 2 },
    ],
  },
  tracks,
};

writeFileSync(OUT, JSON.stringify(project, null, 1) + '\n');
console.log(`wrote ${OUT}: ${tracks.length} tracks`);
