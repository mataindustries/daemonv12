/**
 * CONCRETE GOSPEL · 16 bars, 144 BPM (halftime feel), F minor.
 *
 * The single source of truth for the piece. It writes two files that must stay in step:
 *   source/concrete-gospel.rack.json  Signature Rack + Timbre Lab performance score (reed, choir, 808, kick layers)
 *   source/concrete-gospel.project.json  DaemonV12 v0.7 project that mixes the rack stems with V12 Signature drums
 * The kick pattern, the 808 ducking and the far/near crossfades are generated from the same lists below, so the
 * rack layers and the engine hits land on the same frames.
 *
 *   node experiments/concrete-gospel-001/compose.ts
 *
 * Times are beats (quarter notes) from the start of bar 1; a bar is 4 beats; the piece is 64 beats.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const BPM = 144, BARS = 16, END = BARS * 4, TAIL_SECONDS = 2.4;

// ------------------------------------------------------------------------------------------------ helpers
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** Engine position (960 PPQ, 4/4) of an absolute beat: "BAR:BEAT" or "BAR:BEAT+N/D". */
export function pos(beat: number): string {
  const tick = Math.round(beat * 960), bar = Math.floor(tick / 3840) + 1, inBar = tick % 3840, b = Math.floor(inBar / 960) + 1, off = inBar % 960;
  if (!off) return `${bar}:${b}`;
  const g = gcd(off, 3840);
  return `${bar}:${b}+${off / g}/${3840 / g}`;
}
/** Engine duration ("N/D" of a whole note) of a length in beats. */
export function dur(beats: number): string {
  const t = Math.round(beats * 960), g = gcd(t, 3840);
  return `${t / g}/${3840 / g}`;
}
const semis = (n: number) => r6(Math.pow(2, n / 12));
/** Small deterministic jitter (no Math.random): a fixed hash of the index. */
const jit = (i: number, amount: number) => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return (s - Math.floor(s) - 0.5) * 2 * amount; };

type Opts = Record<string, string | number>;
type RackNote = [number, number, string, number, Opts?];
const rn = (beat: number, beats: number, pitch: string, vel: number, o?: Opts): RackNote => (o ? [r6(beat), r6(beats), pitch, r6(vel), o] : [r6(beat), r6(beats), pitch, r6(vel)]);

// ------------------------------------------------------------------------------------------------ form
// cycle = two bars = one statement of the hook (call in the first bar, answer in the second)
//   C1 bars 1-2   sermon   the hook heard through a concrete wall (band-limited), choir "oo", bell toll
//   C2 bars 3-4   sermon   the same, a little closer; quiet hats; silence on the last half beat
//   C3 bars 5-6   doors    the wall opens: kick, 808, snare+clap, hats, steel clank; groove A
//   C4 bars 7-8   floor    groove A again, hat roll into bar 9
//   C5 bars 9-10  push     groove B: stutter kicks, 808 octave hop and Db-C-F walk-down; the moan falls deeper
//   C6 bars 11-12 crack    bar 11 as usual; bar 12 the floor tape-stops away and a choir answers the hook in MAJOR
//   C7 bars 13-14 return   slam on F minor: bell, groove B, the reed pushed (growl) and the 808 grittier
//   C8 bars 15-16 amen     groove B, then the last answer: drums stop on the bar-16 snare, 808 dives, minor amen
export const SECTIONS = [
  { id: 'sermon', bars: 4, development: 'Hook alone on the reed, heard through concrete (band-limited); choir oo on Fm/Bbm; bell toll.' },
  { id: 'doors', bars: 4, development: 'The wall opens on bar 5: full-band reed, kick + 808 + snare/clap + hats + steel clank (groove A twice).' },
  { id: 'crack', bars: 4, development: 'Groove B pushes; the moan falls deeper; bar 12 the floor tape-stops away and the congregation answers in major.' },
  { id: 'amen', bars: 4, development: 'Slam back to F minor, reed and 808 hotter; final answer, 808 dive, minor amen, bell.' },
];

// ------------------------------------------------------------------------------------------------ the hook (breath reed)
// Call: a triplet walk-up through the blue note (Ab Bb B) into a held C5. Answer, an eighth late: Eb Db C, then a
// long Ab4 that moans down to F4 as the breath lets go. The moan lands where the next call starts.
interface CallO { first: string; v: number; vLong: number }
interface AnsO { first: string; v: number; vLong: number; fall: number; longBeats?: number }
const T3 = 1 / 3;
function call(c: number, o: CallO): RackNote[] {
  return [
    rn(c, T3, 'Ab4', o.v, { articulation: o.first }),
    rn(c + T3, T3, 'Bb4', o.v - 0.05, { articulation: 'legato', slide: 0.08 }),
    rn(c + 2 * T3, T3, 'B4', o.v - 0.05, { articulation: 'legato', slide: 0.08 }),
    rn(c + 1, 1.5, 'C5', o.vLong, { articulation: 'legato', slide: 0.1 }),
  ];
}
function answer(c: number, o: AnsO): RackNote[] {
  return [
    rn(c + 4.5, T3, 'Eb5', o.v, { articulation: o.first }),
    rn(c + 4.5 + T3, T3, 'Db5', o.v - 0.07, { articulation: 'legato', slide: 0.08 }),
    rn(c + 4.5 + 2 * T3, T3, 'C5', o.v - 0.1, { articulation: 'legato', slide: 0.08 }),
    rn(c + 5.5, o.longBeats ?? 2, 'Ab4', o.vLong, { articulation: 'legato', slide: 0.12, fall: o.fall }),
  ];
}
const reedNotes: RackNote[] = [
  ...call(0, { first: 'tongued', v: 0.72, vLong: 0.74 }), ...answer(0, { first: 'tongued', v: 0.74, vLong: 0.76, fall: 3 }),
  ...call(8, { first: 'tongued', v: 0.75, vLong: 0.77 }), ...answer(8, { first: 'tongued', v: 0.77, vLong: 0.8, fall: 3 }),
  ...call(16, { first: 'accent', v: 0.92, vLong: 0.86 }), ...answer(16, { first: 'accent', v: 0.88, vLong: 0.86, fall: 3 }),
  ...call(24, { first: 'tongued', v: 0.84, vLong: 0.85 }), ...answer(24, { first: 'accent', v: 0.86, vLong: 0.86, fall: 3 }),
  ...call(32, { first: 'tongued', v: 0.85, vLong: 0.86 }), ...answer(32, { first: 'accent', v: 0.88, vLong: 0.88, fall: 5 }),
  ...call(40, { first: 'tongued', v: 0.86, vLong: 0.88 }),
  // bar 12: the reed is silent while the congregation answers; it only draws breath before the slam
  rn(47.5, 0.45, 'Ab4', 0.5, { articulation: 'breathy' }),
  ...call(48, { first: 'accent', v: 0.95, vLong: 0.92 }), ...answer(48, { first: 'accent', v: 0.92, vLong: 0.9, fall: 3 }),
  ...call(56, { first: 'tongued', v: 0.9, vLong: 0.9 }), ...answer(56, { first: 'accent', v: 0.92, vLong: 0.9, fall: 3, longBeats: 2.5 }),
];

// ------------------------------------------------------------------------------------------------ choir (impossible voice x3)
// Intro: closed "oo" on Fm / Bbm. Bar 12: the answer phrase sung by three voices in MAJOR over an F pedal
// (F7sus - Bb/F - F - Bb/F, a plagal amen), open "ah" closing to "oh", the glass halo ringing. Bar 16: a quiet
// minor amen ("oh" closing to "mm") under the last moan.
const choir = {
  top: [
    rn(0, 4, 'C4', 0.55, { vowel: 'oo' }), rn(4, 3.8, 'Db4', 0.55, { articulation: 'legato', slide: 0.35, vowel: 'oo' }),
    rn(8, 4, 'C4', 0.58, { vowel: 'oo' }), rn(12, 3, 'Db4', 0.58, { articulation: 'legato', slide: 0.35, vowel: 'oo' }),
    rn(44.5, T3, 'Eb4', 0.8, { vowel: 'ah' }), rn(44.5 + T3, T3, 'D4', 0.8, { articulation: 'legato', slide: 0.06, vowel: 'ah' }),
    rn(44.5 + 2 * T3, T3, 'C4', 0.78, { articulation: 'legato', slide: 0.06, vowel: 'ah' }), rn(45.5, 2.1, 'D4', 0.82, { articulation: 'legato', slide: 0.1, vowel: 'ah', to: 'oh' }),
    rn(62, 2.4, 'C4', 0.6, { vowel: 'oh', to: 'mm' }),
  ],
  mid: [
    rn(0, 4, 'Ab3', 0.55, { vowel: 'oo' }), rn(4, 3.8, 'Bb3', 0.55, { articulation: 'legato', slide: 0.35, vowel: 'oo' }),
    rn(8, 4, 'Ab3', 0.58, { vowel: 'oo' }), rn(12, 3, 'Bb3', 0.58, { articulation: 'legato', slide: 0.35, vowel: 'oo' }),
    rn(44.5, T3, 'C4', 0.78, { vowel: 'ah' }), rn(44.5 + T3, T3, 'Bb3', 0.78, { articulation: 'legato', slide: 0.06, vowel: 'ah' }),
    rn(44.5 + 2 * T3, T3, 'A3', 0.76, { articulation: 'legato', slide: 0.06, vowel: 'ah' }), rn(45.5, 2.1, 'Bb3', 0.8, { articulation: 'legato', slide: 0.1, vowel: 'ah', to: 'oh' }),
    rn(62, 2.4, 'Ab3', 0.6, { vowel: 'oh', to: 'mm' }),
  ],
  low: [
    rn(0, 7.8, 'F3', 0.55, { vowel: 'oo' }), rn(8, 7, 'F3', 0.58, { vowel: 'oo' }),
    rn(44.5, 3.1, 'F3', 0.8, { vowel: 'ah', to: 'oh' }),
    rn(62, 2.4, 'F3', 0.6, { vowel: 'oh', to: 'mm' }),
  ],
};

// ------------------------------------------------------------------------------------------------ groove: kicks and the 808
// Each groove is one two-bar cycle: kick beats, and 808 notes [beat, beats, pitch, velocity, options].
// Groove A: F1 on the one and the and-of-two; after the snare the 808 jumps to F2 and swoops down to Ab1, then
// climbs a step into Bb1 under the answer and holds through the moan; a C2 pickup falls back to F1.
// Groove B: stutter kicks, an octave hop on Bb, and a Db2-C2-F1 walk-down into the next cycle.
interface Groove { kicks: number[]; bass: RackNote[] }
function grooveA(c: number, freshStart: boolean, scoop = -2): Groove {
  return {
    kicks: [0, 1.5, 3.5, 4, 5.5].map(k => c + k),
    bass: [
      rn(c, 1.25, 'F1', 0.95, freshStart ? { scoop } : { slide: 0.15 }),
      rn(c + 1.5, 0.5, 'F1', 0.85),
      rn(c + 2.75, 0.5, 'F2', 0.75),
      rn(c + 3.5, 0.5, 'Ab1', 0.88, { slide: 0.25 }),
      rn(c + 4, 1.25, 'Bb1', 0.92, { slide: 0.12 }),
      rn(c + 5.5, 1.75, 'Bb1', 0.88),
      rn(c + 7.5, 0.5, 'C2', 0.8),
    ],
  };
}
function grooveB(c: number, freshStart: boolean, scoop = -2): Groove {
  return {
    kicks: [0, 0.75, 1.5, 3.5, 4, 5.5, 7.25].map(k => c + k),
    bass: [
      rn(c, 0.5, 'F1', 0.95, freshStart ? { scoop } : { slide: 0.15 }),
      rn(c + 0.75, 0.5, 'F1', 0.8),
      rn(c + 1.5, 0.75, 'F1', 0.88),
      rn(c + 2.75, 0.5, 'F2', 0.78),
      rn(c + 3.5, 0.5, 'Ab1', 0.88, { slide: 0.25 }),
      rn(c + 4, 1, 'Bb1', 0.92, { slide: 0.12 }),
      rn(c + 5.25, 0.25, 'Bb2', 0.72),
      rn(c + 5.5, 1.5, 'Bb1', 0.88, { slide: 0.1 }),
      rn(c + 7.25, 0.25, 'Db2', 0.82),
      rn(c + 7.5, 0.5, 'C2', 0.8, { slide: 0.1 }),
    ],
  };
}
/** Bar 11 as usual, then bar 12: the Ab1 swoop is held into the downbeat and dives 19 semitones (a tape stop). */
function grooveCrack(c: number): Groove {
  const a = grooveA(c, false);
  return {
    kicks: [0, 1.5, 3.5].map(k => c + k),
    bass: [
      ...a.bass.slice(0, 3),
      // written 1.2222 beats: the rack gates a normal note at 90 %, so the gate closes at beat c+4.6 and the
      // 19-semitone dive runs over its last 0.6 beat, from the bar-12 downbeat. The engine fades it out (see duck()).
      rn(c + 3.5, 1.222222, 'Ab1', 0.9, { slide: 0.25, dive: 19, diveBeats: 0.6 }),
    ],
  };
}
/** Bar 15 like groove B; bar 16: Bb1 under the answer, then a long F1 that dives an octave as everything stops. */
function grooveAmen(c: number): Groove {
  const b = grooveB(c, false);
  return {
    kicks: [0, 0.75, 1.5, 3.5, 4, 5.5].map(k => c + k),
    bass: [
      ...b.bass.slice(0, 6),
      // gate 90 % of 2.5 beats closes at c+7.75; the dive runs over its last 1.5 beats; the engine fades it out
      rn(c + 5.5, 2.5, 'F1', 0.92, { dive: 12, diveBeats: 1.5 }),
    ],
  };
}
const grooves: Groove[] = [
  grooveA(16, true, -4),   // bars 5-6: the doors open (bigger punch)
  grooveA(24, false),      // bars 7-8
  grooveB(32, false),      // bars 9-10
  grooveCrack(40),         // bars 11-12
  grooveB(48, true, -5),   // bars 13-14: the slam
  grooveAmen(56),          // bars 15-16
];
export const KICKS = grooves.flatMap(g => g.kicks);
const bassNotes = grooves.flatMap(g => g.bass);
/** Kicks that land on the strongest beats get full velocity; the syncopated ones a little less. */
const kickVel = (k: number) => (k % 4 === 0 ? 1 : k % 2 === 0 ? 0.95 : 0.88);

// ------------------------------------------------------------------------------------------------ rack score
const ctl = (main: number, ret: number): [number, number][] => [[0, main], [47.9, main], [48, ret]];
export const rackScore = {
  schema: 'daemonv12.signature-rack.score/1',
  title: 'Concrete Gospel',
  description: 'DaemonV12 First Listening Benchmark: 16 bars of dark Southern trap, 144 BPM halftime, F minor. Rack and Timbre Lab parts; drums and mix in the engine project.',
  bpm: BPM, key: 'F minor', swing: 0.5, seed: 1440, tailSeconds: TAIL_SECONDS, masterGainDb: 0,
  sections: SECTIONS,
  room: { rt60: 1.9, size: 1.2, damp: 5000, predelayMs: 24, lowCut: 250 },
  parts: [
    {
      id: 'reed', instrument: 'breath-reed', gainDb: 0, pan: 0, room: 0.22,
      setup: { seed: 314 },
      macro: [[0, 0.3], [15.9, 0.3], [16, 0.45], [47.9, 0.45], [48, 0.62]],
      expression: [[0, 0.62], [15.9, 0.62], [16, 0.74], [47.9, 0.74], [48, 0.84]],
      offsets: {
        drift: -0.3,
        // bar 12: the preacher only breathes in (under about 0.15 the reed gives air, not tone)
        breath: [[47.3, 0], [47.45, -0.88], [47.9, -0.88], [48, 0]],
        // bar 13: the held C5 of the slam is pushed into a throat growl
        growl: [[48.9, 0], [49.1, 0.3], [50.4, 0.3], [50.5, 0]],
      },
      notes: reedNotes,
    },
    ...(['top', 'mid', 'low'] as const).map((v, i) => ({
      id: `choir-${v}`, instrument: 'impossible-voice', gainDb: 0, pan: [-0.28, 0.28, 0][i], room: 0.35,
      setup: { size: [0.2, 0, -0.35][i]!, vibRate: [5.1, 5.4, 4.8][i]!, seed: 21 + i, haloDecay: 1.4, halo: ['F5', 'Bb5', 'C6', 'F6'] },
      macro: [[0, 0.12], [43, 0.12], [44.3, 0.3], [48, 0.3], [49, 0.12]],
      expression: [[0, 0.55], [43, 0.55], [44.3, 0.85], [48, 0.85], [49, 0.6]],
      controls: { glass: [[0, 0.06], [44, 0.06], [44.5, 0.5], [47.8, 0.5], [49, 0.06]] },
      notes: choir[v],
    })),
    {
      id: 'bass808', instrument: 'living-bass', gainDb: 6, pan: 0, room: 0,
      setup: { seed: 808 },
      macro: 0, expression: 0.75,
      motion: [{ fromBeat: 0, toBeat: END, preset: 'none' }],
      controls: {
        body: ctl(0.5, 0.56), drive: ctl(0.55, 0.75), fold: ctl(0.25, 0.4), pm: ctl(0.75, 0.9), bright: ctl(0.3, 0.38),
        hold: 0.84, chassis: ctl(0, 0.15), grind: 0, gear: 0, ratchet: 0, servo: 0, motion: 0, harm: 0,
      },
      notes: bassNotes,
    },
    {
      // kick punch layer: a palm in the centre of a tight skin, tuned to F2 (the 80-160 Hz knock the V12 kick lacks)
      id: 'kick-punch', instrument: 'organic-percussion/skin', gainDb: -8, pan: 0, room: 0, macro: 0.05,
      setup: { seed: 35, spread: 0 },
      notes: KICKS.map(k => rn(k, 0.25, 'F2', kickVel(k) * 0.95, { articulation: 'bass' })),
    },
    {
      // kick click layer: a dry rim knock on the log, high (C5) so it reads as attack, not pitch
      id: 'kick-click', instrument: 'organic-percussion/log', gainDb: -9, pan: 0, room: 0, macro: 0.05,
      setup: { seed: 36, spread: 0 },
      notes: KICKS.map(k => rn(k, 0.25, 'C5', kickVel(k) * 0.9, { articulation: 'rim' })),
    },
  ],
};

// ------------------------------------------------------------------------------------------------ engine drums (V12 Signature)
type EngineNote = Record<string, unknown>;
const KIT = 'assets/v12/kit.json';
const kickHits: EngineNote[] = KICKS.map(k => ({ start: pos(k), pitch: 'iron-pulse', velocity: kickVel(k), playbackRate: semis(3), gate: dur(0.25), envelope: { attackSeconds: 0, releaseSeconds: 0.03 }, chokeGroup: 'kick' }));
// the rack layers are full-length stems placed once at 1:1
kickHits.unshift({ start: '1:1', pitch: 'punch', velocity: 1 }, { start: '1:1', pitch: 'click', velocity: 1 });

const snareHits: EngineNote[] = [];
const backbeat = (b: number, v = 1) => {
  snareHits.push({ start: pos(b), pitch: 'titanium-crack', velocity: r6(0.92 * v), playbackRate: semis(-1) });
  snareHits.push({ start: pos(b), pitch: 'neon-clap', velocity: r6(0.8 * v) });
};
for (const c of [16, 24, 32, 48, 56]) { backbeat(c + 2); backbeat(c + 6); }
backbeat(42); // bar 11 (bar 12 has no backbeat)
// bar 8 pickup into groove B: two soft cracks
snareHits.push({ start: pos(31.5), pitch: 'titanium-crack', velocity: 0.32, playbackRate: semis(-1), gate: dur(0.125), envelope: { attackSeconds: 0.001, releaseSeconds: 0.02 }, chokeGroup: 'snare' });
snareHits.push({ start: pos(31.75), pitch: 'titanium-crack', velocity: 0.5, playbackRate: semis(-1), gate: dur(0.125), envelope: { attackSeconds: 0.001, releaseSeconds: 0.02 }, chokeGroup: 'snare' });

// hats: eighths with accents and a slight late lean on the off-beats; rolls are written out
const hatHits: EngineNote[] = [];
let hi = 0;
const hat = (b: number, v: number, rate = 1, lean = true) => {
  const late = lean && Math.abs((b * 2) % 2 - 1) < 1e-9 ? 6 / 960 : 0; // off-beat eighths 6 ticks (2.6 ms) late
  const n: EngineNote = { start: pos(b + late), pitch: 'ghost-tick', velocity: r6(Math.min(1, Math.max(0.05, v + jit(hi++, 0.035)))), chokeGroup: 'hats' };
  if (rate !== 1) n.playbackRate = r6(rate);
  hatHits.push(n);
};
const openHat = (b: number, v: number) => hatHits.push({ start: pos(b), pitch: 'open-circuit', velocity: v, gate: dur(0.5), envelope: { attackSeconds: 0.001, releaseSeconds: 0.06 }, chokeGroup: 'hats' });
const eighths = (from: number, to: number, on: number, off: number, skip: number[] = []) => {
  for (let b = from; b < to - 1e-9; b += 0.5) if (!skip.some(s => Math.abs(s - b) < 1e-9)) hat(b, Math.abs(b % 1) < 1e-9 ? on : off);
};
const roll = (from: number, to: number, step: number, v0: number, v1: number, rate0 = 1, rate1 = 1) => {
  const n = Math.round((to - from) / step);
  for (let i = 0; i < n; i++) { const x = n > 1 ? i / (n - 1) : 0; hat(from + i * step, v0 + (v1 - v0) * x, rate0 + (rate1 - rate0) * x, false); }
};
// bars 3-4: footsteps behind the wall, stopping on beat 3 of bar 4
eighths(8, 14, 0.26, 0.2);
// C3 bars 5-6
eighths(16, 19.5, 0.62, 0.46); roll(19.5, 20, 0.125, 0.34, 0.6); eighths(20, 23.5, 0.62, 0.46); openHat(23.5, 0.5);
// C4 bars 7-8: triplet answer to the hook in bar 7, rising pitched roll into bar 9
eighths(24, 26.5, 0.62, 0.46); roll(26.5, 27, 1 / 6, 0.4, 0.55); eighths(27, 31, 0.62, 0.46);
roll(31, 31.5, 1 / 6, 0.34, 0.5, 1, 1.12); roll(31.5, 32, 0.125, 0.5, 0.72, 1.12, 1.26);
// C5 bars 9-10: a hole under the start of the moan, sixteenth pickups
eighths(32, 36, 0.62, 0.46); hat(35.75, 0.4, 1, false); eighths(36, 40, 0.62, 0.46, [37.5]); hat(39.75, 0.42, 1, false);
// C6 bar 11, then nothing in bar 12
eighths(40, 43, 0.62, 0.46); roll(43, 43.5, 1 / 6, 0.36, 0.52, 1, 1.12); hat(43.5, 0.5, 1, false);
// C7 bars 13-14: open hat on the and-of-four, sixteenths in the back half of bar 14
eighths(48, 51.5, 0.64, 0.48); openHat(51.5, 0.5); eighths(52, 54, 0.64, 0.48);
for (let b = 54; b < 56 - 1e-9; b += 0.25) hat(b, Math.abs(b % 1) < 1e-9 ? 0.62 : Math.abs(b % 0.5) < 1e-9 ? 0.5 : 0.36, 1, false);
// C8 bar 15, 32nd roll into bar 16, eighths until the last snare
eighths(56, 59.5, 0.64, 0.48); roll(59.5, 60, 0.125, 0.4, 0.7, 1, 1.19); eighths(60, 62.5, 0.64, 0.48);

// steel: the same CHROME bell tolls the sections (F4 + F3) and, gated short, clanks a sparse off-beat figure
const F4 = semis(-4), F3 = semis(-16), C5 = semis(3), F5 = semis(8);
const tollHits: EngineNote[] = [];
const toll = (b: number, v: number, gateBeats: number, release: number) => {
  tollHits.push({ start: pos(b), pitch: 'chrome-strike', velocity: v, playbackRate: F4, gate: dur(gateBeats), envelope: { attackSeconds: 0, releaseSeconds: release } });
  tollHits.push({ start: pos(b), pitch: 'chrome-strike', velocity: r6(v * 0.8), playbackRate: F3, gate: dur(gateBeats), envelope: { attackSeconds: 0, releaseSeconds: release } });
};
toll(0, 0.8, 8, 1.2); toll(16, 0.85, 8, 1.2); toll(48, 0.9, 8, 1.2); toll(62, 0.85, 4, 1.1);
const clankHits: EngineNote[] = [];
const clank = (b: number, rate: number, v: number) => clankHits.push({ start: pos(b), pitch: 'chrome-strike', velocity: v, playbackRate: rate, gate: dur(0.25), envelope: { attackSeconds: 0, releaseSeconds: 0.08 } });
for (const c of [16, 24, 32, 48, 56]) {
  clank(c + 1.25, C5, 0.62); clank(c + 3.25, F5, 0.55); clank(c + 5.75, C5, 0.58);
  if (c === 32 || c === 48) clank(c + 7.75, F5, 0.5);
}
clank(41.25, C5, 0.62); clank(43.25, F5, 0.55);

// ------------------------------------------------------------------------------------------------ automation
type Point = { at: { musical: string }; value: number; transition?: 'linear' };
const pt = (beat: number, value: number, linear = true): Point => ({ at: { musical: pos(beat) }, value: r6(value), ...(linear ? { transition: 'linear' as const } : {}) });
/**
 * 808 gain: a 5 dB dip under every kick (from 1/128 note before to 1/16 after) so the kick reads first; the bar-12
 * tape stop and the final dive fade out before their gates close (the Living Bass springs back to pitch on release).
 */
function duck808(base: number): Point[] {
  const pts: Point[] = [];
  const W = 30 / 960, A = 120 / 960, B = 240 / 960;
  for (const k of KICKS) {
    // bar 12: the first 0.2 beat of the dive at full level, then fade before the gate closes (44.6); hold silent
    if (k === 48) pts.push(pt(44.2, base), pt(44.6, base - 40, false), pt(k - W, base));
    else pts.push(pt(k - W, base));
    pts.push(pt(k, base - 5), pt(k + A, base - 2), pt(k + B, base, k !== 61.5));
  }
  pts.push(pt(62.25, base), pt(63.75, base - 45, false));
  return pts;
}
/** Far/near pair: the far copy plays until bar 4 beat 4 and gives way, in silence, to the near copy at bar 5. */
const farOut = (g: number): Point[] => [pt(15.6, g), pt(15.95, -60, false)];
const nearIn = (g: number): Point[] => [pt(15.6, -60), pt(15.95, g, false)];

// ------------------------------------------------------------------------------------------------ engine project
const kitTrack = (id: string, description: string, kit: string, notes: EngineNote[], mix: Record<string, number>, effects: unknown[], automation?: unknown) => ({
  id, description, instrument: { type: 'drumkit', kit }, mix, effects, ...(automation ? { automation } : {}),
  clips: [{ bar: 1, pattern: 'all' }], patterns: [{ id: 'all', bars: BARS, notes }],
});
const stemTrack = (id: string, description: string, sample: string, mix: Record<string, number>, effects: unknown[], automation?: unknown) => ({
  id, description, instrument: { type: 'sampler', sample }, mix, effects, ...(automation ? { automation } : {}),
  clips: [{ bar: 1, pattern: 'all' }], patterns: [{ id: 'all', bars: BARS, notes: [{ start: '1:1', velocity: 1 }] }],
});
const CHOIR_KIT = 'assets/choir-kit.json';
const choirNotes = [{ start: '1:1', pitch: 'top', velocity: 1 }, { start: '1:1', pitch: 'mid', velocity: 1 }, { start: '1:1', pitch: 'low', velocity: 1 }];

/**
 * Engine mix (dB), set from per-stem loudness measured on a calibration render (see README): the 808 leads the meter,
 * the hook sits about 2 LU under it, hats and steel are raised to audible, the bar-12 choir is kept below the beat.
 */
export const MIX = { kick: 0, snare: 1, hats: -1, toll: -5, clank: -7, bass: 0, reedFar: 2, reed: 3, choirFar: -2, choir: -8.5, roomFar: 1, room: 2, master: 1 };

export const project = {
  formatVersion: 1,
  title: 'Concrete Gospel',
  description: 'DaemonV12 First Listening Benchmark. 16 bars, 144 BPM halftime, F minor. Rack/Timbre Lab stems (reed, choir, Living Bass 808, kick layers, room) mixed with V12 Signature drums and steel.',
  bpm: BPM, timeSignature: '4/4', key: 'F minor', bars: BARS, seed: 1440,
  render: { tail: { seconds: TAIL_SECONDS } },
  master: { gainDb: MIX.master, effects: [{ type: 'highpass', frequencyHz: 25 }, { type: 'compressor', thresholdDb: -16, ratio: 2, attackMs: 20, releaseMs: 160 }, { type: 'saturation', driveDb: 2, mix: 1 }] },
  tracks: [
    kitTrack('kick', 'V12 IRON PULSE tuned to C2 and gated, layered with the rack skin punch (F2) and log rim click stems.', 'assets/kick-kit.json', kickHits,
      { gainDb: MIX.kick }, [{ type: 'highpass', frequencyHz: 30 }, { type: 'saturation', driveDb: 5, mix: 0.35 }]),
    kitTrack('snare', 'V12 TITANIUM CRACK (down a semitone) stacked with NEON CLAP on the halftime backbeat.', KIT, snareHits,
      { gainDb: MIX.snare }, [{ type: 'saturation', driveDb: 4, mix: 0.3 }, { type: 'reverb', roomSize: 0.35, decaySeconds: 0.8, wet: 0.12 }]),
    kitTrack('hats', 'V12 GHOST TICK eighths, written rolls and OPEN CIRCUIT, one choke group.', KIT, hatHits,
      { gainDb: MIX.hats, pan: 0.12 }, [{ type: 'highpass', frequencyHz: 4000 }]),
    kitTrack('toll', 'V12 CHROME STRIKE at F4 + F3: the bell that marks bars 1, 5, 13 and the end.', KIT, tollHits,
      { gainDb: MIX.toll }, [{ type: 'highpass', frequencyHz: 150 }, { type: 'reverb', roomSize: 0.75, decaySeconds: 2.2, wet: 0.25 }]),
    kitTrack('clank', 'The same bell gated short on C5/F5: a sparse steel off-beat figure.', KIT, clankHits,
      { gainDb: MIX.clank, pan: -0.22 }, [{ type: 'highpass', frequencyHz: 500 }, { type: 'delay', timeMs: 312.5, wet: 0.22 }]),
    // QA fix: the low-pass after the saturation keeps the growl (160-1280 Hz) and takes the fizz out of the hook's band
    stemTrack('bass808', 'Living Bass played as a tuned sliding 808 (rack stem), ducked under every kick.', 'assets/rack/bass808.wav',
      { gainDb: MIX.bass }, [{ type: 'highpass', frequencyHz: 28 }, { type: 'saturation', driveDb: 9, mix: 0.5 }, { type: 'lowpass', frequencyHz: 1600 }], { gainDb: duck808(MIX.bass) }),
    stemTrack('reed-far', 'The breath reed hook behind the concrete wall (bars 1-4 only).', 'assets/rack/reed.wav',
      { gainDb: MIX.reedFar }, [{ type: 'highpass', frequencyHz: 320 }, { type: 'lowpass', frequencyHz: 1500 }], { gainDb: farOut(MIX.reedFar) }),
    // QA fix: +1 dB makeup overall and +1.5 dB from bar 13, where the grittier 808 had narrowed the hook's lead
    stemTrack('reed', 'The breath reed hook, full band from bar 5.', 'assets/rack/reed.wav',
      { gainDb: -60 }, [{ type: 'highpass', frequencyHz: 180 }, { type: 'compressor', thresholdDb: -20, ratio: 2.5, attackMs: 6, releaseMs: 120, makeupGainDb: 3 }, { type: 'saturation', driveDb: 3, mix: 0.2 }],
      { gainDb: [...nearIn(MIX.reed), pt(47.9, MIX.reed), pt(48, MIX.reed + 1.5, false)] }),
    kitTrack('choir-far', 'Three impossible voices behind the wall (bars 1-4).', CHOIR_KIT, choirNotes,
      { gainDb: MIX.choirFar }, [{ type: 'highpass', frequencyHz: 220 }, { type: 'lowpass', frequencyHz: 1400 }], { gainDb: farOut(MIX.choirFar) }),
    kitTrack('choir', 'The same voices in the room: the bar-12 major answer and the last amen.', CHOIR_KIT, choirNotes,
      { gainDb: -60 }, [{ type: 'highpass', frequencyHz: 150 }], { gainDb: nearIn(MIX.choir) }),
    stemTrack('room-far', 'The rack room (FDN) on the reed and choir, behind the wall.', 'assets/rack/room.wav',
      { gainDb: MIX.roomFar }, [{ type: 'lowpass', frequencyHz: 1400 }], { gainDb: farOut(MIX.roomFar) }),
    stemTrack('room', 'The rack room, full band from bar 5.', 'assets/rack/room.wav',
      { gainDb: -60 }, [{ type: 'highpass', frequencyHz: 200 }], { gainDb: nearIn(MIX.room) }),
  ],
};

export const KICK_KIT = { formatVersion: 1, samples: [
  { name: 'iron-pulse', pitch: 35, file: 'v12/02-iron-pulse.wav' },
  { name: 'punch', pitch: 36, file: 'rack/kick-punch.wav' },
  { name: 'click', pitch: 37, file: 'rack/kick-click.wav' },
] };
export const CHOIR_KIT_JSON = { formatVersion: 1, samples: [
  { name: 'top', pitch: 60, file: 'rack/choir-top.wav' },
  { name: 'mid', pitch: 61, file: 'rack/choir-mid.wav' },
  { name: 'low', pitch: 62, file: 'rack/choir-low.wav' },
] };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = join(HERE, 'source');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'concrete-gospel.rack.json'), JSON.stringify(rackScore, null, 1) + '\n');
  writeFileSync(join(out, 'concrete-gospel.project.json'), JSON.stringify(project, null, 1) + '\n');
  writeFileSync(join(out, 'kick-kit.json'), JSON.stringify(KICK_KIT, null, 2) + '\n');
  writeFileSync(join(out, 'choir-kit.json'), JSON.stringify(CHOIR_KIT_JSON, null, 2) + '\n');
  console.log(`wrote ${out}: ${reedNotes.length} reed notes, ${bassNotes.length} 808 notes, ${KICKS.length} kicks, ${hatHits.length} hats, ${snareHits.length} snare/clap, ${clankHits.length} clanks, ${tollHits.length} toll voices`);
}
