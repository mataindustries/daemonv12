/**
 * THE IMPOSSIBLE STAIRWELL · Opus 5.5 candidate · authoring script.
 *
 *   node production/infinite-stairwell/opus-55/compose.ts
 *
 * Writes score.json beside this file: a Signature Rack performance score (schema daemonv12.signature-rack.score/1).
 * The JSON is the editable source of truth; this script only keeps the four-bar cycle exact and periodic.
 *
 * Locked clock: 96 BPM, 4/4, four bars = 16 beats = exactly 10.000 s = 441,000 frames = 240 picture frames
 * (15 frames per beat). The film is a seamless loop. The score is ONE four-bar cycle ("ascent") rendered with a
 * six-second tail; build.ts makes the loop project play each phrase two times from bar 1, once from its start and
 * once from source second 10.000, so the cycle's own tails, reflections and releases lie over its opening. That
 * periodic fold is exact: the wrap from the last frame to the first is the same continuous signal as the rack take.
 *
 * Musical idea: an ascent with no top. Each bar is one flight of the square stairwell and rises a minor third
 * (D minor -> F minor -> A-flat minor -> B minor -> D minor). The four roots D F A-flat B form one diminished-seventh
 * chord, the fourfold symmetry of the square shaft, and the glass halo of every voice is tuned to it: the stone
 * resonates on the axis the building turns around.
 *
 * The memorable idea ("the Sigh of the Stair") is one four-note figure per flight: the held root, a leap up a
 * minor sixth that sighs down a semitone onto the fifth, then a fall to the minor third. That minor third is
 * exactly the next flight's root, so the voice holds it across the bar line while the building turns beneath it.
 * Two witnesses sing the figure in octaves (Shepard pair): the upper one fades as it climbs, the lower one grows.
 * At the loop point the lower witness hands its D4 to the upper witness's fresh D4, so the climb never resolves.
 *
 * Dialogue: witnesses (the figure) <-> echoes (distant presences repeat the sigh at other depths, a murmuring crowd
 * on chord tones, a giant undertone voice) <-> resonant stone (bowed bar with a twelfth-below subharmonic, a warm
 * sub floor) <-> the recurring mechanical gesture: an escapement that ticks every beat (15 picture frames) and, at
 * the end of every flight, three rising hocketed strikes that "turn the key" into the next chord, landing on a
 * bell strike at the next downbeat. Bar 3 is the crest (crowd densest, the sigh becomes a cry, the machine turns
 * alien); bar 4 withdraws to almost nothing, the building inhales, and the key turns back to bar 1.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type O = Record<string, number | string>;
type N = [number, number, string | number, number, O?];
type Pt = [number, number];

const CYCLE = 16;
/** Roots of the four flights (MIDI), upper-witness octave: D4, F4, G#4 (A-flat), B4. */
const ROOT = [62, 65, 68, 71];
/** Diminished-seventh axis for the glass halos (D6 F6 G#6 B6 D7). */
const AXIS = [86, 89, 92, 95, 98];

/** Deterministic PRNG (mulberry32), independent of the audio engines. */
function prng(seed: number) {
  let s = seed >>> 0;
  return () => { let t = (s = (s + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const r3 = (x: number) => Math.round(x * 1000) / 1000;
/** One cycle of notes (kept as a function so each part's material stays readable). */
const once = (cycle: () => N[]): N[] => cycle().map(([b, l, p, v, o]) => (o ? [r3(b), l, p, v, o] : [r3(b), l, p, v]) as N);
/** A cyclic curve: points inside the cycle. The value at beat 16 holds through the tail (the releases being folded). */
function periodic(points: Pt[]): Pt[] {
  if (points[0]![0] !== 0) throw new Error('cyclic curve must start at beat 0');
  return points.filter(([b]) => b <= CYCLE).map(([b, v]) => [r3(b), v] as Pt);
}

// ------------------------------------------------------------------------------------------- the Sigh of the Stair
const VOWELS: [string, string][] = [['oo', 'oh'], ['oh', 'ah'], ['ah', 'ah'], ['oh', 'oo']];
/**
 * The figure for one witness, `octave` semitones below the upper witness. Bar k (root r):
 *   (r held from the previous bar) · r+8 at .75 (the leap) · r+7 at 1.5 (the sigh) · r+3 at 2.5, held over the bar
 *   line where it becomes the next bar's root. Only the first bar sings a fresh root; the cycle closes at beat 16.
 */
function figure(octave: number): N[] {
  const notes: N[] = [];
  for (let k = 0; k < 4; k++) {
    const r = ROOT[k]! - octave, b = 4 * k, [v1, v2] = VOWELS[k]!;
    if (k === 0) notes.push([0, 0.75, r, 0.7, { vowel: 'oo', scoop: 0.6 }]);
    const crest = k === 2;
    notes.push([b + 0.75, 0.75, r + 8, crest ? 0.82 : 0.7, crest ? { articulation: 'cry', cry: 1.2, vowel: v1 } : { articulation: 'legato', slide: 0.1, vowel: v1 }]);
    notes.push([b + 1.5, 1, r + 7, crest ? 0.74 : 0.64, { articulation: 'legato', slide: 0.22, vowel: v1, to: v2 }]);
    // Held minor third: over the bar line (2.25 beats) except in the last bar, which hands over at the loop point.
    notes.push([b + 2.5, k === 3 ? 1.48 : 2.25, r + 3, crest ? 0.72 : 0.66, { articulation: 'legato', slide: 0.16, vowel: v2, to: k === 3 ? 'oo' : v2 }]);
  }
  return notes;
}

// ------------------------------------------------------------------------------------------------ the presences
/** A near presence repeats the sigh (leap + fall) while the witnesses hold the third. */
function echoNear(): N[] {
  return ROOT.flatMap((r, k): N[] => k === 3 ? [] : [
    [4 * k + 2.0, 0.5, r + 8, 0.5, { articulation: 'hum', vowel: 'mm', to: 'oo' }],
    [4 * k + 2.5, 0.85, r + 7, 0.46, { articulation: 'legato', slide: 0.25, vowel: 'oo', to: 'oh' }],
  ]);
}
/** A far presence answers an octave lower and later, as if from several landings down. */
function echoFar(): N[] {
  return ROOT.flatMap((r, k): N[] => k === 3 ? [[13.0, 1.6, r - 12 + 7, 0.36, { articulation: 'fall', fall: 0.5, vowel: 'oo' }]] : [
    [4 * k + 3.0, 0.5, r - 12 + 8, 0.44, { vowel: 'oh', scoop: 0.4 }],
    [4 * k + 3.5, 1.15, r - 12 + 7, 0.4, { articulation: 'legato', slide: 0.3, vowel: 'oh', to: 'oo' }],
  ]);
}
/** The giant voice beneath: the fifth of every flight, sung by a vast tract with undertones (stone that breathes). */
function deep(): N[] {
  return ROOT.map((r, k): N => [4 * k + 0.25, k === 3 ? 3.2 : 3.6, r - 5, [0.5, 0.6, 0.78, 0.22][k]!, { articulation: 'hum', vowel: 'mm', to: k === 2 ? 'oh' : 'oo', scoop: 0.3 }]);
}
/**
 * The crowd: short murmurs on chord tones (root, third, fifth, ninth) at seeded times. Density follows the form:
 * present in bar 1, gathering in bar 2, crowding the crest in bar 3, almost gone in bar 4.
 */
function murmurs(seed: number, base: number, perBar: number[]): N[] {
  const rand = prng(seed), out: N[] = [], vowels = ['oo', 'oh', 'mm', 'ah', 'aw'];
  for (let k = 0; k < 4; k++) {
    const r = ROOT[k]! + base, tones = [r, r + 3, r + 7, r + 14, r + 12], count = perBar[k]!;
    let b = 4 * k + 0.1 + rand() * 0.4;
    for (let i = 0; i < count; i++) {
      const len = 0.35 + rand() * 0.55, end = 4 * k + (k === 3 ? 2.6 : 3.9);
      if (b + len > end) break;
      let p = tones[Math.floor(rand() * tones.length)]!; while (p > 84) p -= 12;
      const v = vowels[Math.floor(rand() * vowels.length)]!;
      out.push([r3(b), r3(len), p, r3(0.32 + rand() * 0.3), { vowel: v, to: vowels[Math.floor(rand() * vowels.length)]!, scoop: r3(0.2 + rand() * 0.6) }]);
      b += len + 0.08 + rand() * (count > 4 ? 0.2 : 0.6);
    }
  }
  return out;
}

// --------------------------------------------------------------------------------------------- stone and machine
/** Bowed stone: every flight's fifth bowed with a twelfth-below subharmonic (the shaft resonating on the root). */
function bow(): N[] {
  return ROOT.map((r, k): N => [4 * k, k === 3 ? 3.4 : 3.9, r - 12 + 7, [0.58, 0.68, 0.92, 0.28][k]!, { articulation: 'fifth-under' }]);
}
/** Warm sub floor; it drops below the crest (A-flat 1) instead of climbing, so the ground falls away there. */
function bass(): N[] {
  const roots = [38, 41, 32, 35];
  return roots.map((p, k): N => [4 * k, k === 3 ? 3.0 : 3.5, p, [0.72, 0.76, 0.92, 0.34][k]!, k === 2 ? { articulation: 'accent', scoop: 1 } : { articulation: 'normal', scoop: 0.5 }]);
}
/** The recurring mechanical gesture: a bell on each downbeat, three rising hocketed strikes that turn the key. */
function lift(): N[] {
  const out: N[] = [];
  for (let k = 0; k < 4; k++) {
    const r = ROOT[k]!, next = k === 3 ? ROOT[0]! + 12 : ROOT[k + 1]! + 12, b = 4 * k;
    out.push([b, 2.5, r, 0.6, { articulation: 'ring' }], [b, 1.5, r + 19, 0.3, { articulation: 'soft' }]);
    out.push([b + 3.25, 0.5, next, 0.4], [b + 3.5, 0.5, next + 3, 0.47], [b + 3.75, 0.75, next + 7, 0.55, { articulation: 'hard' }]);
  }
  return out;
}
/** Escapement: tock on every downbeat, tick on the other beats (15 picture frames apart), tuned to the flight. */
function escapement(): N[] {
  const out: N[] = [];
  for (let beat = 0; beat < CYCLE; beat++) {
    const k = Math.floor(beat / 4), r = ROOT[k]! + 24;
    if (beat % 4 === 0) out.push([beat, 0.2, r, 0.62, { articulation: 'tock' }]);
    else out.push([beat, 0.1, r - 5, beat % 4 === 2 ? 0.46 : 0.38, { articulation: 'tick' }]);
  }
  return out;
}
/** Dust in the lamplight: tiny tuned pings on the diminished axis, densest at the crest. */
function dust(): N[] {
  const rand = prng(5591), out: N[] = [], perBar = [3, 4, 8, 1];
  for (let k = 0; k < 4; k++) for (let i = 0; i < perBar[k]!; i++) {
    const b = 4 * k + 0.2 + (3.4 * (i + rand() * 0.8)) / perBar[k]!;
    out.push([r3(b), 0.25, AXIS[Math.floor(rand() * AXIS.length)]!, r3(0.25 + rand() * 0.25)]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

// ----------------------------------------------------------------------------------------------------- the score
const halo = AXIS.slice(0, 4);
// Shepard pair: the upper witness fades as it climbs; the lower grows; at the loop point they trade octaves.
// The form envelope (bloom on the first leap, crest in bar 3, withdrawal in bar 4) multiplies both witnesses.
const FORM: Pt[] = [[0, 0.82], [0.75, 0.92], [4, 0.95], [8, 1.0], [9, 1.1], [11.5, 1.12], [12.5, 0.74], [15.2, 0.6], [16, 0.66]];
const formAt = (b: number) => { for (let i = 1; i < FORM.length; i++) { const [b0, v0] = FORM[i - 1]!, [b1, v1] = FORM[i]!; if (b <= b1) return v0 + ((v1 - v0) * (b - b0)) / (b1 - b0); } return FORM[0]![1]; };
/** Shepard ramp (start -> end over the cycle) times the form, sampled every half beat. */
function shepard(start: number, end: number): Pt[] {
  const pts: Pt[] = [];
  for (let b = 0; b <= 16; b += 0.5) pts.push([b, r3(Math.min(1, (start + ((end - start) * b) / 16) * formAt(Math.min(b, 15.99))))]);
  return pts;
}
const UPPER_EXPR = shepard(0.9, 0.5);
const LOWER_EXPR = shepard(0.5, 0.9);
// Form: bars 1-2 gather, bar 3 is the crest, bar 4 withdraws.
const CREST = (lo: number, hi: number, out = lo): Pt[] => [[0, lo], [7, (lo + hi) / 2], [9, hi], [11.5, hi], [13, out], [15.5, lo]];

const score = {
  schema: 'daemonv12.signature-rack.score/1',
  title: 'THE IMPOSSIBLE STAIRWELL — Opus 5.5 candidate',
  bpm: 96,
  key: 'D minor',
  timeSignature: '4/4',
  seed: 5505,
  tailSeconds: 6,
  masterGainDb: 1.5,
  description: 'A seamless ten-second ascent in four flights: each bar rises a minor third (D, F, A-flat, B minor) around a diminished-seventh axis, so the stair climbs forever and returns to its start. Two witnesses sing the Sigh of the Stair in a Shepard octave pair; distant presences echo it; a bowed stone and warm sub answer; an escapement ticks every beat and turns the key into each flight.',
  sections: [
    { id: 'ascent', bars: 4, development: 'The delivered cycle: D minor (identity in the first second: bell, tock, stone, and the sigh), F minor (the presences gather), A-flat minor (crest: the sigh becomes a cry, the machine turns alien, the floor falls away), B minor (withdrawal; the building inhales; the key turns back to D).' },
  ],
  room: { rt60: 2.9, size: 1.45, damp: 4600, predelayMs: 31, lowCut: 190 },
  parts: [
    { id: 'stone-sub', instrument: 'living-bass', gainDb: -7.5, pan: 0, room: 0.06,
      macro: periodic(CREST(0.04, 0.32)), expression: periodic([[0, 0.66], [8, 0.8], [12, 0.6]]), setup: { seed: 7 }, notes: once(bass) },
    { id: 'stone-bow', instrument: 'mechanical-orchestra/bow', gainDb: -7, pan: -0.08, room: 0.5,
      macro: periodic(CREST(0.55, 0.85, 0.6)), setup: { seed: 41, spread: 0.25 }, notes: once(bow) },
    { id: 'lift', instrument: 'mechanical-orchestra/bar', gainDb: -6.5, pan: 0.05, room: 0.42,
      macro: periodic([[0, 0.1], [7.5, 0.22], [8.5, 0.62], [11.5, 0.58], [12.5, 0.16], [15.5, 0.1]]), setup: { seed: 19, spread: 0.55 },
      // The last flight's bell and key-turn ring shorter, so the whole cycle has rung out inside the folded tail.
      controls: { damp: { steps: [[0, 0.72], [12, 0.4]], glide: 0 } }, notes: once(lift) },
    { id: 'escapement', instrument: 'mechanical-orchestra/clock', gainDb: -8, pan: 0.22, room: 0.3,
      macro: periodic([[0, 0.2], [8, 0.5], [11.8, 0.55], [12.2, 0.2]]), setup: { seed: 23, spread: 0.2 }, notes: once(escapement) },
    { id: 'dust', instrument: 'mechanical-orchestra/bearings', gainDb: -19, pan: 0, room: 0.75,
      macro: periodic([[0, 0.4], [8, 0.7], [12, 0.4]]), setup: { seed: 29, spread: 0.85 }, notes: once(dust) },
    { id: 'witness-upper', instrument: 'impossible-voice', gainDb: -3.5, pan: 0.12, room: 0.4,
      macro: periodic(CREST(0.32, 0.55, 0.38)), expression: UPPER_EXPR,
      controls: { glass: periodic(CREST(0.25, 0.6, 0.3)), whistle: periodic([[0, 0], [8.5, 0], [9.25, 0.45], [11.5, 0.4], [12.25, 0]]) },
      overtone: { steps: [[0, 6], [8.75, 8], [9.5, 6], [10.5, 5], [11.25, 6]], glide: 0.12 },
      setup: { size: 0.25, vibRate: 5.0, vibCents: 22, vowelTau: 0.14, seed: 101, halo, haloDecay: 1.6 }, notes: once(() => figure(0)) },
    { id: 'witness-lower', instrument: 'impossible-voice', gainDb: -4, pan: -0.12, room: 0.4,
      macro: periodic(CREST(0.3, 0.52, 0.36)), expression: LOWER_EXPR,
      controls: { glass: periodic(CREST(0.2, 0.5, 0.25)) },
      setup: { size: -0.25, vibRate: 4.7, vibCents: 20, vowelTau: 0.16, seed: 211, halo, haloDecay: 1.6 }, notes: once(() => figure(12)) },
    { id: 'echo-near', instrument: 'impossible-voice', gainDb: 0, pan: -0.5, room: 0.62,
      macro: periodic(CREST(0.55, 0.75, 0.6)), expression: 0.62,
      setup: { size: 0.45, detune: -9, vibRate: 5.6, seed: 307, halo, haloDecay: 2.2, haloGain: 1.4 },
      breaths: [{ beat: 15.3, beats: 0.6, kind: 'in', velocity: 0.55 }],
      notes: once(echoNear) },
    { id: 'echo-far', instrument: 'impossible-voice', gainDb: -3, pan: 0.66, room: 0.92,
      macro: periodic(CREST(0.75, 0.92, 0.8)), expression: 0.55,
      setup: { size: -0.1, detune: 11, vibRate: 4.3, seed: 401, halo, haloDecay: 2.6, haloGain: 1.6 }, notes: once(echoFar) },
    { id: 'echo-deep', instrument: 'impossible-voice', gainDb: -7, pan: -0.18, room: 0.75,
      macro: periodic(CREST(0.82, 1, 0.85)), expression: periodic(CREST(0.5, 0.75, 0.48)),
      controls: { under: periodic(CREST(0.55, 0.95, 0.6)) },
      setup: { size: -0.95, detune: -6, vibRate: 3.4, vibCents: 12, vowelTau: 0.3, seed: 503, halo, haloDecay: 2.8 }, notes: once(deep) },
    { id: 'crowd-left', instrument: 'impossible-voice', gainDb: -6.5, pan: -0.82, room: 0.95,
      macro: periodic(CREST(0.7, 0.95, 0.75)), expression: periodic(CREST(0.45, 0.72, 0.4)),
      setup: { size: 0.6, detune: -17, vibRate: 6.1, seed: 601, halo, haloDecay: 2.4, haloGain: 1.8 }, notes: once(() => murmurs(6011, 0, [3, 4, 7, 1])) },
    { id: 'crowd-right', instrument: 'impossible-voice', gainDb: -5, pan: 0.84, room: 0.95,
      macro: periodic(CREST(0.7, 0.95, 0.75)), expression: periodic(CREST(0.45, 0.72, 0.4)),
      setup: { size: 0.1, detune: 14, vibRate: 5.3, seed: 701, halo, haloDecay: 2.4, haloGain: 1.8 }, notes: once(() => murmurs(7013, -12, [2, 4, 7, 1])) },
  ],
};

const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, 'score.json'), JSON.stringify(score, null, 2) + '\n');
console.log(`wrote ${join(here, 'score.json')}: ${score.parts.length} parts, ${score.parts.reduce((n, p) => n + p.notes.length, 0)} notes`);
