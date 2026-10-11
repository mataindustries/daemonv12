// Score generator for the Opus Round 1 track. Writes ../project.json (DaemonV12 formatVersion 1).
//
//   node benchmarks/ultimate-beat-battle/round1/opus/tools/compose.ts [--out path]
//
// The score is authored here as musical data (16th-note slots, scale degrees, syllables) and
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
const US_PER_QUARTER = Math.round(60_000_000 / BPM); // 428571, as the engine's MIDI tempo
const TBAR = 3840, TBEAT = 960, T16 = 240;
const SWING = 60; // odd 16ths land 60 ticks (1/64 note, ~27 ms) late: a 62.5% 2-step shuffle

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }
function frac(ticks: number): string { const g = gcd(ticks, 3840); return `${ticks / g}/${3840 / g}`; }
function pos(ticks: number): string {
  const bar = Math.floor(ticks / TBAR) + 1, r = ticks % TBAR, beat = Math.floor(r / TBEAT) + 1, o = r % TBEAT;
  return o === 0 ? `${bar}:${beat}` : `${bar}:${beat}+${frac(o)}`;
}
/** Tick of a 16th slot inside a bar (bar is 1-based, slot may be fractional; odd integer slots swing). */
function at(bar: number, slot: number, swing = true): number {
  const base = (bar - 1) * TBAR + Math.round(slot * T16);
  return base + (swing && Number.isInteger(slot) && slot % 2 === 1 ? SWING : 0);
}
function seconds(ticks: number): number { return Math.round(ticks * US_PER_QUARTER / 960) / 1_000_000; }
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const rate = (semitones: number) => r6(2 ** (semitones / 12));

// ---------------------------------------------------------------- pitch helpers

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midi(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name)!;
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
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

/** Sample note at an absolute tick inside a pattern that starts at `patternBar`. */
function sn(patternBar: number, tick: number, fields: Note): Note {
  const rel = tick - (patternBar - 1) * TBAR;
  return { start: pos(rel), ...fields };
}
function gm(patternBar: number, tick: number, pitch: string | string[], durTicks: number, velocity: number): Note {
  const rel = tick - (patternBar - 1) * TBAR;
  return { start: pos(rel), pitch, duration: frac(durTicks), velocity };
}

// ---------------------------------------------------------------- the hook

// One syllable event of the hook: 16th slot, pitch (note name), syllable, velocity.
type Syl = { slot: number; note: string; syl: string; vel: number; glideTo?: string; glideDur?: string };

// Q (call): rises G#-B-C#, leaps to E and settles on D#, the 9th of C#m: a question.
// A (answer): circles C#-B-C#-B and falls to G#: the same 3-3-4-2-4 rhythm, an answer.
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

function voxNote(patternBar: number, bar: number, s: Syl, transpose = 0, velScale = 1): Note {
  const semis = midi(s.note) + transpose - VOX_BASE;
  const f: Note = { pitch: s.syl, velocity: r6(Math.min(1, s.vel * velScale)), playbackRate: rate(semis) };
  if (s.glideTo) f.glide = { to: rate(midi(s.glideTo) + transpose - VOX_BASE), duration: s.glideDur ?? '1/8' };
  return sn(patternBar, at(bar, s.slot), f);
}

// ---------------------------------------------------------------- harmony

// Rootless, voice-led EP voicings (each chord moves one or two voices).
const CHORDS: Record<string, { ep: string[]; root: string; choir: string[] }> = {
  'C#m9': { ep: ['E3', 'G#3', 'B3', 'D#4'], root: 'C#2', choir: ['G#3', 'B3', 'E4'] },
  'Amaj9': { ep: ['E3', 'G#3', 'B3', 'C#4'], root: 'A1', choir: ['G#3', 'C#4', 'E4'] },
  'F#m9': { ep: ['E3', 'G#3', 'A3', 'C#4'], root: 'F#1', choir: ['A3', 'C#4', 'E4'] },
  'G#7sus': { ep: ['D#3', 'F#3', 'A#3', 'C#4'], root: 'G#1', choir: ['F#3', 'C#4', 'D#4'] },
  'G#7b9': { ep: ['D#3', 'F#3', 'A3', 'C4'], root: 'G#1', choir: ['F#3', 'C4', 'D#4'] },
};
// Chord per bar (1-based). Bar 15 splits F#m9 -> G#7b9 at beat 3; bar 16 resolves.
const PROG: string[] = ['', 'C#m9', 'Amaj9', 'F#m9', 'G#7sus', 'C#m9', 'Amaj9', 'F#m9', 'G#7sus', 'Amaj9', 'F#m9', 'G#7sus', 'G#7b9', 'C#m9', 'Amaj9', 'F#m9', 'C#m9'];

// ---------------------------------------------------------------- tracks

const tracks: Track[] = [];

// VOX (main hook, the singer's real register)
{
  const notes: Note[] = [];
  // Bars 3-4: the hook appears in its true register; bars 5-8 and 13-15 carry it over the beat.
  for (const bar of [3, 5, 7, 13]) for (const s of HOOK_Q) notes.push(voxNote(1, bar, s));
  for (const bar of [4, 6, 14]) for (const s of HOOK_A) notes.push(voxNote(1, bar, s));
  // Bar 8: answer phrase, but the last note becomes a 32nd-note stutter that climbs into the breakdown.
  for (const s of HOOK_A.slice(0, 4)) notes.push(voxNote(1, 8, s));
  for (let k = 0; k < 6; k++) notes.push(sn(1, at(8, 12 + k * 0.5, false), { pitch: 'da-s', velocity: r6(0.5 + k * 0.07), playbackRate: rate(midi('G#4') - VOX_BASE + k) }));
  // Bar 15: Q over F#m9 -> G#7b9; the held C#5 bends down to B#4 (C5), resolving the suspension.
  for (const s of HOOK_Q.slice(0, 3)) notes.push(voxNote(1, 15, s));
  notes.push(voxNote(1, 15, { slot: 10, note: 'E5', syl: 'hey-s', vel: 0.9 }));
  notes.push(voxNote(1, 15, { slot: 12, note: 'C#5', syl: 'ah-l', vel: 0.86, glideTo: 'C5', glideDur: '1/8' }));
  // Bar 16: final word on the tonic, then the tape stops under it (1 -> 0.25 over two beats).
  notes.push(sn(1, at(16, 0), { pitch: 'ah-l', velocity: 0.9, playbackRate: rate(midi('C#5') - VOX_BASE), glide: { to: 0.25, duration: '1/2' } }));
  tracks.push({
    id: 'vox', description: 'The hook: synthetic vowel syllables sung on G#4, pitched per note with playbackRate.',
    instrument: { type: 'drumkit', kit: 'assets/opus-vox/kit.json' },
    mix: { gainDb: -3, pan: 0 },
    effects: [
      { type: 'highpass', frequencyHz: 170 },
      { type: 'compressor', thresholdDb: -20, ratio: 3, attackMs: 5, releaseMs: 90, makeupGainDb: 2 },
      { type: 'saturation', driveDb: 4, mix: 0.25 },
      { type: 'delay', timeMs: 321, wet: 0.16 },
      { type: 'reverb', roomSize: 0.55, decaySeconds: 1.5, wet: 0.2 },
    ],
    clips: [{ bar: 1, pattern: 'song' }],
    patterns: [{ id: 'song', description: 'Hook statements bars 3-8 and 13-16; bar 8 stutter; bar 15 suspension bend; bar 16 tape stop.', bars: BARS, notes }],
  });
}

// VOX-LOW: the same singer an octave down (rate x0.5): intro, breakdown answers, last word.
{
  const notes: Note[] = [];
  const low = (bar: number, s: Syl, vel = 1) => voxNote(1, bar, s, -12, vel);
  // Bar 1 opens with a tape start: the first syllable spins up from rate 0.25 into G#3.
  notes.push(sn(1, at(1, 0), { pitch: 'ya-m', velocity: 0.85, playbackRate: 0.25, glide: { to: rate(-12), duration: '1/8' } }));
  for (const s of HOOK_Q.slice(1)) notes.push(low(1, s, 0.95));
  for (const s of HOOK_A) notes.push(low(2, s, 0.95));
  // Breakdown (bars 9-10): the low voice answers the high voice's half-phrases.
  for (const s of HOOK_A.slice(3)) notes.push(low(9, s, 0.9));
  for (const s of HOOK_Q.slice(3)) notes.push(low(10, s, 0.9));
  // Ending: a soft low "oo" on C#4 after the tape stop.
  notes.push(sn(1, at(16, 8), { pitch: 'oo-l', velocity: 0.55, playbackRate: rate(midi('C#4') - VOX_BASE) }));
  tracks.push({
    id: 'vox-low', description: 'The hook an octave down: dark, slowed-tape version for the intro, breakdown answers and outro.',
    instrument: { type: 'drumkit', kit: 'assets/opus-vox/kit.json' },
    mix: { gainDb: -4, pan: 0 },
    effects: [
      { type: 'highpass', frequencyHz: 110 },
      { type: 'lowpass', frequencyHz: 3200 },
      { type: 'reverb', roomSize: 0.7, decaySeconds: 2.0, wet: 0.3 },
    ],
    clips: [{ bar: 1, pattern: 'song' }],
    patterns: [{ id: 'song', bars: BARS, notes }],
  });
}

// VOX-HI: breakdown calls and the final-drop harmony a third/fourth below the hook (diatonic).
{
  const notes: Note[] = [];
  for (const s of HOOK_Q.slice(0, 3)) notes.push(voxNote(1, 9, s, 0, 0.85));
  for (const s of HOOK_A.slice(0, 3)) notes.push(voxNote(1, 10, s, 0, 0.85));
  // Harmony under the final drop: diatonic thirds below in C# minor.
  const third: Record<string, string> = { 'G#4': 'E4', 'B4': 'G#4', 'C#5': 'A4', 'D#5': 'B4', 'E5': 'C#5' };
  const harm = (bar: number, phrase: Syl[]) => { for (const s of phrase) notes.push(voxNote(1, bar, { ...s, note: third[s.note], vel: s.vel * 0.8 })); };
  harm(13, HOOK_Q); harm(14, HOOK_A);
  tracks.push({
    id: 'vox-harm', description: 'Breakdown call phrases (answered by vox-low) and the final-drop harmony a diatonic third below.',
    instrument: { type: 'drumkit', kit: 'assets/opus-vox/kit.json' },
    mix: { gainDb: -8, pan: 0.35 },
    effects: [
      { type: 'highpass', frequencyHz: 220 },
      { type: 'reverb', roomSize: 0.65, decaySeconds: 1.8, wet: 0.3 },
    ],
    clips: [{ bar: 1, pattern: 'song' }],
    patterns: [{ id: 'song', bars: BARS, notes }],
  });
}

// VOX-FX: spin-up riser into the final drop and the breath in the silence before it.
{
  const notes: Note[] = [
    sn(1, at(11, 8), { pitch: 'ah-l', velocity: 0.7, playbackRate: 0.25, glide: { to: 1, duration: '3/2' } }),
    sn(1, at(12, 12), { pitch: 'breath-in', velocity: 1 }),
  ];
  tracks.push({
    id: 'vox-fx', description: 'Tape spin-up riser (0.25 -> 1 over six beats) and an inhale filling the last beat of silence before bar 13.',
    instrument: { type: 'drumkit', kit: 'assets/opus-vox/kit.json' },
    mix: { gainDb: -6, pan: 0 },
    effects: [{ type: 'highpass', frequencyHz: 200 }, { type: 'reverb', roomSize: 0.6, decaySeconds: 1.2, wet: 0.25 }],
    clips: [{ bar: 1, pattern: 'song' }],
    patterns: [{ id: 'song', bars: BARS, notes }],
  });
}

// KEYS: GM electric piano, 2-step stabs (0, 7, 10) in the drops, sustained in the switch.
{
  const notes: Note[] = [];
  const stab = (bar: number, chord: string, vel: number) => {
    const v = CHORDS[chord].ep;
    notes.push(gm(1, at(bar, 0), v, 3 * T16 - 20, vel));
    notes.push(gm(1, at(bar, 7), v, T16 - 20, vel * 0.75));
    notes.push(gm(1, at(bar, 10), v, 5 * T16, vel * 0.9));
  };
  for (const bar of [3, 4]) notes.push(gm(1, at(bar, 0), CHORDS[PROG[bar]].ep, TBAR - 40, 0.55));
  for (let bar = 5; bar <= 8; bar++) stab(bar, PROG[bar], 0.66);
  for (const bar of [9, 10]) notes.push(gm(1, at(bar, 0), CHORDS[PROG[bar]].ep, TBAR - 40, 0.5));
  notes.push(gm(1, at(11, 0), CHORDS['G#7sus'].ep, TBAR - 40, 0.55));
  for (let k = 0; k < 8; k++) notes.push(gm(1, at(12, k * 2), CHORDS['G#7b9'].ep, T16 * 2 - 30, r6(0.4 + k * 0.045))); // eighth pulse, crescendo
  for (const bar of [13, 14]) stab(bar, PROG[bar], 0.7);
  notes.push(gm(1, at(15, 0), CHORDS['F#m9'].ep, 3 * T16 - 20, 0.7));
  notes.push(gm(1, at(15, 7), CHORDS['F#m9'].ep, T16 - SWING - 20, 0.52));
  notes.push(gm(1, at(15, 8), CHORDS['G#7b9'].ep, 8 * T16, 0.7));
  notes.push(gm(1, at(16, 0), [...CHORDS['C#m9'].ep, 'G#4'], TBAR - 40, 0.72));
  tracks.push({
    id: 'keys', description: 'GM electric piano: rootless voice-led chords, 2-step stabs in the drops, held in the switch.',
    instrument: { type: 'gm', program: 'electric_piano_1' },
    mix: { gainDb: 2, pan: -0.15 },
    effects: [
      { type: 'highpass', frequencyHz: 140 },
      { type: 'saturation', driveDb: 6, mix: 0.3 },
      { type: 'lowpass', frequencyHz: 6500 },
      { type: 'reverb', roomSize: 0.5, decaySeconds: 1.2, wet: 0.18 },
    ],
    clips: [{ bar: 1, pattern: 'song' }],
    patterns: [{ id: 'song', bars: BARS, notes }],
  });
}

// KEYS-FAR: the same electric piano heard through a wall (intro only), low-passed and roomy.
{
  const notes: Note[] = [gm(1, at(1, 0), ['C#3', ...CHORDS['C#m9'].ep], TBAR - 40, 0.6), gm(1, at(2, 0), ['A2', ...CHORDS['Amaj9'].ep], TBAR - 40, 0.6)];
  tracks.push({
    id: 'keys-far', description: 'Intro chords, low-passed at 700 Hz like a room next door.',
    instrument: { type: 'gm', program: 'electric_piano_1' },
    mix: { gainDb: 3, pan: 0 },
    effects: [{ type: 'lowpass', frequencyHz: 700 }, { type: 'reverb', roomSize: 0.75, decaySeconds: 2.2, wet: 0.35 }],
    clips: [{ bar: 1, pattern: 'song' }],
    patterns: [{ id: 'song', bars: BARS, notes }],
  });
}

// CHOIR: GM choir pad under the switch and the final drop.
{
  const notes: Note[] = [];
  for (const bar of [9, 10, 11]) notes.push(gm(1, at(bar, 0), CHORDS[PROG[bar]].choir, TBAR - 40, 0.55));
  notes.push(gm(1, at(12, 0), CHORDS['G#7b9'].choir, TBAR - 4 * T16, 0.6));
  for (const bar of [13, 14]) notes.push(gm(1, at(bar, 0), CHORDS[PROG[bar]].choir, TBAR - 40, 0.45));
  notes.push(gm(1, at(15, 0), CHORDS['F#m9'].choir, 8 * T16 - 40, 0.45));
  notes.push(gm(1, at(15, 8), CHORDS['G#7b9'].choir, 8 * T16 - 40, 0.5));
  tracks.push({
    id: 'choir', description: 'GM choir aahs: a human halo behind the synthetic voice in the switch and final drop.',
    instrument: { type: 'gm', program: 'choir_aahs' },
    mix: { gainDb: -6, pan: 0 },
    effects: [{ type: 'highpass', frequencyHz: 300 }, { type: 'reverb', roomSize: 0.7, decaySeconds: 2.0, wet: 0.35 }],
    clips: [{ bar: 1, pattern: 'song' }],
    patterns: [{ id: 'song', bars: BARS, notes }],
  });
}

// GLASS: GLASSHOUSE glass-hit pitched with playbackRate: answers the hook, then a counter-line.
{
  const notes: Note[] = [];
  const g = (bar: number, slot: number, note: string, vel: number) => notes.push(sn(1, at(bar, slot), { pitch: 'glass-hit', velocity: vel, playbackRate: rate(midi(note) - GLASS_BASE) }));
  // Answers: an octave above the vocal's last note, in the rest after each phrase.
  g(2, 15, 'G#5', 0.5);
  for (const bar of [5, 7]) g(bar, 15, 'D#6', 0.45);
  for (const bar of [6]) g(bar, 15, 'G#5', 0.45);
  // Breakdown: slow falling line.
  g(9, 0, 'E6', 0.55); g(9, 6, 'C#6', 0.45); g(10, 0, 'B5', 0.55); g(10, 6, 'G#5', 0.45);
  // Final drop counter-line (3-3-2 against the hook), high register.
  const line: [number, number, string][] = [[13, 2, 'B5'], [13, 5, 'C#6'], [13, 8, 'E6'], [14, 2, 'D#6'], [14, 5, 'C#6'], [14, 8, 'B5'], [15, 2, 'C#6'], [15, 5, 'A5'], [15, 8, 'B#5']];
  for (const [b, s, n] of line) g(b, s, n, 0.5);
  g(16, 0, 'C#6', 0.6);
  tracks.push({
    id: 'glass', description: 'GLASSHOUSE glass-hit retuned per note: answers to the hook and a final-drop counter-line.',
    instrument: { type: 'drumkit', kit: 'assets/glasshouse/glass-kit.json' },
    mix: { gainDb: -9, pan: 0.25 },
    effects: [{ type: 'highpass', frequencyHz: 400 }, { type: 'delay', timeMs: 321, wet: 0.25 }, { type: 'reverb', roomSize: 0.6, decaySeconds: 1.6, wet: 0.25 }],
    automation: { pan: [{ at: { musical: '13:1' }, value: 0.35, transition: 'linear' }, { at: { musical: '16:1' }, value: -0.3 }] },
    clips: [{ bar: 1, pattern: 'song' }],
    patterns: [{ id: 'song', bars: BARS, notes }],
  });
}

// GLASS-FX: reverse glass into the drops, prism impact on the final drop and the last downbeat.
{
  const notes: Note[] = [
    sn(1, at(4, 8), { pitch: 'glass-reverse', velocity: 0.8 }),
    sn(1, at(12, 8), { pitch: 'glass-reverse', velocity: 0.75 }),
    sn(1, at(13, 0), { pitch: 'prism-impact', velocity: 0.8 }),
    sn(1, at(16, 0), { pitch: 'prism-impact', velocity: 0.7, playbackRate: 1, glide: { to: 0.5, duration: '1/1' } }),
  ];
  tracks.push({
    id: 'glass-fx', description: 'Reverse glass (two beats) into bars 5 and 13; prism impacts on 13:1 and the final downbeat (slowing to half speed).',
    instrument: { type: 'drumkit', kit: 'assets/glasshouse/glass-kit.json' },
    mix: { gainDb: -6, pan: 0 },
    effects: [{ type: 'highpass', frequencyHz: 120 }, { type: 'reverb', roomSize: 0.6, decaySeconds: 1.4, wet: 0.2 }],
    clips: [{ bar: 1, pattern: 'song' }],
    patterns: [{ id: 'song', bars: BARS, notes }],
  });
}

// DRUMS ------------------------------------------------------------------
type Hit = [slot: number, pitch: string, vel: number];
const KICK_A: Hit[] = [[0, 'kick', 0.95], [10, 'kick', 0.85]];
const KICK_B: Hit[] = [[0, 'kick', 0.95], [3, 'kick', 0.45], [10, 'kick', 0.85], [15, 'kick', 0.5]];
const CLAP: Hit[] = [[4, 'clap', 0.9], [12, 'clap', 0.92]];
const HATS_A: Hit[] = [[2, 'hat', 0.7], [3, 'hat', 0.32], [6, 'hat', 0.72], [7, 'hat', 0.3], [10, 'hat', 0.7], [11, 'hat', 0.34], [13, 'hat', 0.28], [14, 'hat', 0.74], [15, 'hat', 0.36]];
const HATS_B: Hit[] = [[2, 'hat', 0.7], [3, 'hat', 0.32], [5, 'rim', 0.6], [6, 'hat', 0.72], [7, 'hat', 0.3], [10, 'hat', 0.7], [11, 'rim', 0.55], [13, 'hat', 0.3], [14, 'hat-open', 0.55]];

function drumPattern(id: string, bars: number, layout: (bar: number) => Hit[]): Pattern {
  const notes: Note[] = [];
  for (let b = 1; b <= bars; b++) for (const [slot, pitch, vel] of layout(b)) notes.push({ start: pos(at(b, slot)), pitch, velocity: vel });
  return { id, bars, notes };
}

{
  // Kick: drops at bar 5 (2-step, never on beat 3), out for the switch, back at 13, final hit at 16:1.
  tracks.push({
    id: 'kick', description: '2-step kick: 1 and the and-of-3, with a swung ghost and pickup on alternate bars.',
    instrument: { type: 'drumkit', kit: 'assets/opus-drums/kit.json' },
    mix: { gainDb: -2 },
    effects: [{ type: 'highpass', frequencyHz: 40 }],
    clips: [{ bar: 5, pattern: 'two-step' }, { bar: 7, pattern: 'two-step' }, { bar: 13, pattern: 'two-step' }, { bar: 15, pattern: 'last' }, { bar: 16, pattern: 'end' }],
    patterns: [
      drumPattern('two-step', 2, b => (b === 1 ? KICK_A : KICK_B)),
      drumPattern('last', 1, () => [[0, 'kick', 0.95], [10, 'kick', 0.85], [14, 'kick', 0.6]]),
      drumPattern('end', 1, () => [[0, 'kick', 1]]),
    ],
  });
  tracks.push({
    id: 'clap', description: 'Clap on 2 and 4 in the drops, half-time on 3 in the switch.',
    instrument: { type: 'drumkit', kit: 'assets/opus-drums/kit.json' },
    mix: { gainDb: -6, pan: 0 },
    effects: [{ type: 'highpass', frequencyHz: 200 }, { type: 'reverb', roomSize: 0.45, decaySeconds: 0.9, wet: 0.18 }],
    clips: [{ bar: 3, pattern: 'intro' }, { bar: 5, pattern: 'drop' }, { bar: 9, pattern: 'half' }, { bar: 13, pattern: 'drop3' }],
    patterns: [
      drumPattern('intro', 2, b => (b === 2 ? [[12, 'clap', 0.7]] : [])),
      drumPattern('drop', 4, b => (b === 4 ? [[4, 'clap', 0.9], [12, 'clap', 0.92], [14, 'snare', 0.5], [15, 'snare', 0.6]] : CLAP)),
      drumPattern('half', 2, () => [[8, 'clap', 0.85]]),
      drumPattern('drop3', 3, () => CLAP),
    ],
  });
  // Hats/perc: shuffled offbeat hats + rims from bar 3; build roll (snare, rising pitch) bars 11-12.
  const roll: Note[] = [];
  for (let k = 0; k < 8; k++) roll.push({ start: pos(at(1, k * 2, false)), pitch: 'snare', velocity: r6(0.35 + k * 0.03), playbackRate: rate(k * 0.5) });
  for (let k = 0; k < 8; k++) roll.push({ start: pos(at(2, k, false)), pitch: 'snare', velocity: r6(0.6 + k * 0.03), playbackRate: rate(4 + k * 0.5) });
  for (let k = 0; k < 8; k++) roll.push({ start: pos(at(2, 8 + k * 0.5, false)), pitch: 'snare', velocity: r6(0.82 + k * 0.02), playbackRate: rate(8 + k * 0.5) });
  tracks.push({
    id: 'hats', description: 'Swung offbeat hats, rims answering the vocal, shaker in the switch, rising snare roll in the build.',
    instrument: { type: 'drumkit', kit: 'assets/opus-drums/kit.json' },
    mix: { gainDb: -9, pan: 0.1 },
    effects: [{ type: 'highpass', frequencyHz: 350 }],
    automation: { pan: [{ at: { musical: '11:1' }, value: -0.3, transition: 'linear' }, { at: { musical: '12:4' }, value: 0.3 }, { at: { musical: '13:1' }, value: 0.1 }] },
    clips: [{ bar: 3, pattern: 'intro' }, { bar: 5, pattern: 'groove' }, { bar: 7, pattern: 'groove' }, { bar: 9, pattern: 'shaker' }, { bar: 11, pattern: 'roll' }, { bar: 13, pattern: 'groove' }, { bar: 15, pattern: 'last' }],
    patterns: [
      drumPattern('intro', 2, b => (b === 1 ? HATS_A.filter(h => h[0] % 4 === 2) : HATS_A.filter(h => h[0] % 4 === 2).concat([[11, 'rim', 0.5]]))),
      drumPattern('groove', 2, b => (b === 1 ? HATS_A : HATS_B)),
      drumPattern('shaker', 2, () => [[2, 'shaker', 0.6], [6, 'shaker', 0.5], [10, 'shaker', 0.6], [13, 'shaker', 0.4], [14, 'shaker', 0.55]]),
      { id: 'roll', bars: 2, notes: roll },
      drumPattern('last', 1, () => HATS_A),
    ],
  });
}

// BASS: one 808 source on three round-robin tracks so each note can be choked (monophonic 808).
{
  type BassNote = { bar: number; slot: number; note: string; end?: [number, number]; glideTo?: string; glideDur?: string; vel?: number };
  const riff = (bar: number, chord: string): BassNote[] => {
    const root = CHORDS[chord].root;
    const up = (n: string, s: number) => { const m = midi(n) + s; return ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][m % 12] + String(Math.floor(m / 12) - 1); };
    if (chord === 'G#7sus') return [{ bar, slot: 0, note: root }, { bar, slot: 10, note: root, glideTo: up(root, 5), glideDur: '1/8' }];
    return [{ bar, slot: 0, note: root }, { bar, slot: 10, note: root }, { bar, slot: 14, note: up(root, 12), vel: 0.6 }];
  };
  const seq: BassNote[] = [];
  for (let bar = 5; bar <= 8; bar++) seq.push(...riff(bar, PROG[bar]));
  // Switch: one long dive from A1 two octaves down to A-1... limited to rate 0.25: a 2-bar fall.
  seq.push({ bar: 9, slot: 0, note: 'A1', glideTo: 'A0', glideDur: '2/1', end: [11, 0] });
  for (const bar of [13, 14]) seq.push(...riff(bar, PROG[bar]));
  seq.push({ bar: 15, slot: 0, note: 'F#1' }, { bar: 15, slot: 8, note: 'G#1' }, { bar: 15, slot: 14, note: 'G#2', vel: 0.65 });
  seq.push({ bar: 16, slot: 0, note: 'C#2', glideTo: 'C#1', glideDur: '1/2', end: [16, 12] });

  const ticks = seq.map(n => at(n.bar, n.slot));
  const lanes: Note[][] = [[], [], []];
  const autos: Point[][] = [[], [], []];
  const FADE = 0.008; // 8 ms choke ramp
  seq.forEach((n, i) => {
    const lane = i % 3;
    const f: Note = { velocity: n.vel ?? 0.9, playbackRate: rate(midi(n.note) - SUB_BASE) };
    if (n.glideTo) f.glide = { to: rate(midi(n.glideTo) - SUB_BASE), duration: n.glideDur ?? '1/8' };
    lanes[lane].push(sn(1, ticks[i], f));
    const endTick = n.end ? at(n.end[0], n.end[1], false) : ticks[i + 1];
    const on = seconds(ticks[i]), off = seconds(endTick);
    const pts = autos[lane];
    if (pts.length) pts.push({ at: { seconds: on }, value: 0 });
    pts.push({ at: { seconds: r6(off - FADE) }, value: 0, transition: 'linear' }, { at: { seconds: off }, value: -60 });
  });
  for (let lane = 0; lane < 3; lane++) {
    tracks.push({
      id: `bass-${'abc'[lane]}`, description: `808 voice ${lane + 1} of 3 (round robin); gain automation chokes each note when the next one starts.`,
      instrument: { type: 'sampler', sample: 'assets/opus-bass/sub-808-cs2.wav' },
      mix: { gainDb: -5 },
      effects: [{ type: 'saturation', driveDb: 5, mix: 0.25 }, { type: 'lowpass', frequencyHz: 900 }],
      automation: { gainDb: autos[lane] },
      clips: [{ bar: 1, pattern: 'song' }],
      patterns: [{ id: 'song', bars: BARS, notes: lanes[lane] }],
    });
  }
}

// ---------------------------------------------------------------- project

const project = {
  formatVersion: 1,
  title: 'Glass Lung',
  description: 'Ultimate Beat Battle Round 1 (Opus). A 2-step garage miniature in C# minor at 140 BPM: one synthetic singer heard an octave down through a wall, then in her real register over the beat; a monophonic 808 made from three choked voices; GLASSHOUSE glass answering the hook.',
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
      { type: 'compressor', thresholdDb: -16, ratio: 2, attackMs: 12, releaseMs: 150, makeupGainDb: 1 },
    ],
  },
  tracks,
};

writeFileSync(OUT, JSON.stringify(project, null, 1) + '\n');
console.log(`wrote ${OUT}: ${tracks.length} tracks`);
