/**
 * FABLE: two original 8-bar, 128 BPM, 15.000 s loop candidates, written as motif scores (score/2) for the
 * V12 SIGNATURE pack, the Living Bass and the Mechanical Orchestra, each with its own mix.
 *
 *   A  INDUSTRIAL PURSUIT  A phrygian. A galloping riff whose answer is the flat second; the riff jumps a tritone,
 *                          falls back by minor thirds, stalls under a ticking clock and slams home in 3-3-2.
 *   B  CHROME FUNK         C minor, swung sixteenths. A sliding, ghost-noted Living Bass line with an octave pop and
 *                          a chromatic crawl; a synth answers it; the whole riff shifts up a minor third, then a
 *                          sharp-nine dominant in stop time and a triplet fill walk back to the one.
 *
 * Both are original material. Neither reuses HOOK//10 or HOOK//30 notes.
 */
import type { FableScore, FablePart } from './bridge.ts';
import { type Ctx, sum, gainDb, toPeak, toRms, hp, lp, crushed, clipTo, pump, room, mono } from './mix.ts';
import type { Stereo } from '../crush/crush.ts';

type MN = [number, number, number, number?, Record<string, unknown>?];
type Note = [number, number, number, number?, Record<string, number | string>?];
const SCHEMA = 'daemonv12.signature-rack.score/2';
const ph = (motif: string, at: number, transforms: unknown[] = [], velocity = 1) => ({ motif, at, ...(transforms.length ? { transforms } : {}), ...(velocity !== 1 ? { velocity } : {}) });
const shift = (semitones: number) => ({ op: 'shift', semitones });
const bars = (...list: number[]) => list.flatMap(b => [0, 1, 2, 3].map(k => 4 * b + k));

// =====================================================================================================  A
export function scoreA(): FableScore {
  const kicks = [...bars(0, 1, 2), 12, 13, 14, ...bars(4, 5), 24, 28, 28.75, 29.5, 30, 30.75, 31.5];
  const backbeats = [1, 3, 5, 7, 9, 11, 13, 17, 19, 21, 23];
  const slam = [28, 28.75, 29.5, 30, 30.75, 31.5], slamShift = [0, 0, 3, 6, 5, 1]; // A A C | Eb D Bb -> A
  const hat: Note[] = [];
  for (let b = 0; b < 24; b++) if (b !== 15) [0.34, 0.2, 0.6, 0.24].forEach((v, k) => hat.push([b + k / 4, 0.2, 60, v * (b >= 16 ? 1.1 : 1)]));
  const roll: Note[] = [
    ...Array.from({ length: 8 }, (_, i): Note => [24 + i / 4, 0.12, 57, 0.16 + 0.04 * i]),
    ...Array.from({ length: 16 }, (_, i): Note => [26 + i / 8, 0.1, 57 + (i > 11 ? 2 : 0), 0.4 + 0.035 * i]),
    [29.5, 0.2, 57, 0.9], [31.5, 0.2, 57, 0.9], [31.75, 0.2, 57, 1],
  ];
  const riff = (part: 'body' | 'sub' | 'edge') => [
    ph('head', 0), ph('menace', 2), ph('head', 4), ph('fall', 6),
    ph('head', 8), ph('menace', 10), ph('head', 12), ph('fall', 14, [{ op: 'fragment', from: 0, to: 2 }]),
    ph('head', 16, [shift(6)]), ph('menace', 18, [shift(6)]), ph('head', 20, [shift(3)]), ph('fall', 22),
    // the stall: the gallop alone, climbing a semitone a beat
    ...(part === 'sub' ? [ph('gallop', 24)] : [0, 1, 2, 3].map(k => ph('gallop', 24 + k, [shift(k)], 0.8 + 0.06 * k))),
    ...slam.map((b, i) => ph('hit', b, [shift(slamShift[i]!)])),
  ];
  const parts: FablePart[] = [
    { id: 'kick', instrument: 'v12/sub-hammer', v12: { attackSeconds: 0.001, releaseSeconds: 0.04 }, notes: kicks.map((b): Note => [b, 0.5, 33, 0.95]) },
    { id: 'kick-top', instrument: 'v12/iron-pulse', v12: { oneShot: true }, notes: kicks.map((b, i): Note => [b, 0.5, 33, i % 2 ? 0.76 : 0.84]) },
    { id: 'snare', instrument: 'v12/titanium-crack', v12: { oneShot: true }, notes: backbeats.map((b): Note => [b, 0.5, 57, 0.85]) },
    { id: 'clap', instrument: 'v12/neon-clap', v12: { oneShot: true }, notes: backbeats.map((b): Note => [b, 0.5, 60, 0.7]) },
    { id: 'roll', instrument: 'v12/titanium-crack', v12: { attackSeconds: 0.001, releaseSeconds: 0.015 }, notes: roll },
    { id: 'hat', instrument: 'v12/ghost-tick', pan: 0.15, v12: { oneShot: true }, notes: hat },
    { id: 'ohat', instrument: 'v12/open-circuit', pan: -0.15, v12: { attackSeconds: 0.001, releaseSeconds: 0.05 },
      notes: [...[3.5, 7.5, 11.5].map((b): Note => [b, 0.4, 60, 0.5]), ...bars(4, 5).map((b): Note => [b + 0.5, 0.4, 60, 0.55])] },
    { id: 'body', instrument: 'v12/reactor', v12: { attackSeconds: 0.002, releaseSeconds: 0.02 }, phrases: riff('body') },
    { id: 'sub', instrument: 'v12/abyss', v12: { attackSeconds: 0.004, releaseSeconds: 0.03 }, phrases: riff('sub') },
    { id: 'edge', instrument: 'living-bass', gainDb: 0, macro: 1, expression: 0.85, motion: [{ fromBeat: 0, toBeat: 32, preset: 'sixteenths' }], setup: { seed: 2099 }, phrases: riff('edge') },
    { id: 'stab', instrument: 'v12/phantom', v12: { attackSeconds: 0.002, releaseSeconds: 0.04, offsetSeconds: 1 }, phrases: [
      ph('stabs', 8), ph('stabs', 12.75, [{ op: 'fragment', from: 0, to: 9 }]), ph('stabs', 16, [shift(6)]), ph('stabs', 20, [shift(3)]),
      ...slam.map((b, i) => ph('chord', b, [shift(slamShift[i]!)])) ] },
    { id: 'chrome', instrument: 'v12/chrome-strike', pan: 0.1, v12: { attackSeconds: 0.001, releaseSeconds: 0.25 },
      notes: [[2, 1.5, 70, 0.6], [10, 1.5, 70, 0.6], [15, 2.5, 75, 0.95], [18, 1.5, 76, 0.65], [22, 1.5, 75, 0.65], ...slam.map((b, i): Note => [b, 0.6, 69 + slamShift[i]!, 0.55])] },
    { id: 'anvil', instrument: 'mechanical-orchestra/bar', gainDb: 0, pan: -0.1, macro: 1, setup: { seed: 7, spread: 0.3 },
      notes: [...[17, 19, 21, 23].map((b, i): Note => [b, 0.4, i < 2 ? 63 : 60, 0.8, { articulation: 'muted' }]), ...slam.map((b, i): Note => [b, 0.5, 57 + slamShift[i]!, 0.9, { articulation: 'hard' }])] },
    { id: 'tick', instrument: 'mechanical-orchestra/clock', gainDb: 0, macro: 0.7, setup: { seed: 11, spread: 0.5 },
      notes: [...[15, 15.25, 15.5, 15.75].map((b, i): Note => [b, 0.2, 81, 0.5 + 0.12 * i, { articulation: 'tick' }]),
        ...Array.from({ length: 16 }, (_, i): Note => [24 + i / 4, 0.2, i % 4 === 0 ? 76 : 81, (i % 4 === 0 ? 0.75 : 0.42) + 0.012 * i, { articulation: i % 4 === 0 ? 'tock' : 'tick' }])] },
    { id: 'zap', instrument: 'mechanical-orchestra/spring', gainDb: 0, pan: 0.2, macro: 1, setup: { seed: 5 }, notes: [[15.5, 0.5, 57, 0.85, { articulation: 'laser' }], [27, 1, 52, 0.9, { articulation: 'laser' }]] },
    { id: 'riser', instrument: 'v12/ascension', v12: { endAligned: true, attackSeconds: 0.05, releaseSeconds: 0.01 }, notes: [[24, 4, 69, 0.7]] },
    { id: 'impact', instrument: 'v12/convergence', v12: { attackSeconds: 0.001, releaseSeconds: 0.5 }, notes: [[0, 2.5, 33, 0.8]] },
  ];
  const head: MN[] = [[0, 0.25, 0, 0.95, { gesture: 'accent' }], [0.25, 0.25, 0, 0.72], [0.5, 0.5, 7, 0.92, { gesture: 'accent' }], [1.25, 0.25, 0, 0.76], [1.5, 0.25, 0, 0.82], [1.75, 0.25, 2, 0.86]];
  const cluster = (beat: number, v: number): MN[] => [[beat, 0.25, 0, v], [beat, 0.25, 4, v], [beat, 0.25, 8, v, { alt: -1 }]];
  return {
    schema: SCHEMA, title: 'FABLE A - INDUSTRIAL PURSUIT', bpm: 128, key: 'A minor', swing: 0.5, seed: 2099, tailSeconds: 6,
    description: 'A phrygian. The riff gallops on A and answers on the flat second; the answer phrase falls from the tritone. Bar 4 cuts to a ticking clock, bar 5 restarts a tritone up, bar 6 a minor third up, bar 7 stalls, bar 8 slams home in 3-3-2 onto the flat second.',
    sections: [{ id: 'pursuit', bars: 4, development: 'riff and answer, stabs from bar 3, the cut on the last beat' }, { id: 'turn', bars: 2, development: 'the riff a tritone up, then a minor third up, falling home' },
      { id: 'stall', bars: 1, development: 'kick stops; the gallop climbs by semitones under a clock, a roll and a riser' }, { id: 'slam', bars: 1, development: 'six unison hits in 3-3-2 with silence between; the last is the flat second' }],
    motifs: [
      { id: 'head', role: 'hook', octave: 1, lengthBeats: 2, notes: head },
      { id: 'menace', role: 'answer', octave: 1, lengthBeats: 2, notes: [[0, 0.5, 1, 1, { alt: -1, gesture: 'accent' }], [0.5, 0.5, 0, 0.85], [1.25, 0.25, -1, 0.76], [1.5, 0.25, 0, 0.82], [1.75, 0.25, 1, 0.88, { alt: -1 }]] },
      { id: 'fall', role: 'answer', octave: 1, lengthBeats: 2, notes: [[0, 0.75, 4, 1, { alt: -1, gesture: 'accent' }], [0.75, 0.25, 3, 0.85], [1, 0.5, 2, 0.9], [1.5, 0.5, 1, 0.96, { alt: -1 }]] },
      { id: 'gallop', from: 'head', transforms: [{ op: 'fragment', from: 0, to: 3 }] },
      { id: 'hit', role: 'figure', octave: 1, lengthBeats: 0.5, notes: [[0, 0.4, 0, 1, { gesture: 'accent' }]] },
      { id: 'chord', role: 'figure', octave: 3, lengthBeats: 0.5, notes: [[0, 0.4, 0, 0.55], [0, 0.4, 4, 0.55], [0, 0.4, 8, 0.55, { alt: -1 }]] },
      { id: 'stabs', role: 'figure', octave: 3, lengthBeats: 4, notes: [...cluster(0.75, 0.45), ...cluster(1.5, 0.55), ...cluster(2.75, 0.45), ...cluster(3.5, 0.55)] },
    ],
    parts,
  };
}
export function mixA(s: (id: string) => Stereo, c: Ctx) {
  const kick = toPeak(sum(s('kick'), gainDb(s('kick-top'), -1)), -4.5);
  const sub = pump(toPeak(mono(lp(s('sub'), 110, true)), -8.5), c, 26, 210, 45);
  const body = toRms(lp(crushed(hp(s('body'), 110, true), 1, 12), 7500), -18.5);
  const edge = toRms(lp(crushed(hp(s('edge'), 170, true), 0.7, 6), 9000), -21);
  const bass = pump(clipTo(sum(body, edge), -7), c, 10, 180);
  const snare = gainDb(crushed(sum(toPeak(s('snare'), -9), toPeak(s('clap'), -12), toPeak(s('roll'), -9)), 0.7), 3);
  const hats = pump(sum(toPeak(hp(s('hat'), 3000), -16.5), toPeak(hp(s('ohat'), 2500), -15.5)), c, 3, 150);
  const metal = gainDb(crushed(sum(toPeak(s('chrome'), -11), toPeak(hp(s('anvil'), 200), -11), toPeak(hp(s('tick'), 800), -15), toPeak(hp(s('zap'), 250), -12)), 0.7), 2);
  const stab = pump(toPeak(lp(crushed(hp(s('stab'), 220, true), 1, 10), 10000), -9.5), c, 7, 170);
  const fx = sum(toPeak(hp(s('riser'), 300), -13), toPeak(hp(s('impact'), 140, true), -10));
  const wet = pump(gainDb(room(sum(gainDb(snare, -8), gainDb(metal, -4), gainDb(stab, -9), gainDb(fx, -8)), 1.3, 350), 3), c, 9, 220);
  const buses = { kick, sub, bass, snare, hats, metal, stab, fx, room: wet };
  return { buses, mix: sum(...Object.values(buses)) };
}

// =====================================================================================================  B
export function scoreB(): FableScore {
  const kicks = [...bars(0, 1, 2, 3, 4, 5, 6), 28, 28.75, 29.5, 30, 31];
  const hat: Note[] = [], ghost: Note[] = [], tock: Note[] = [];
  for (let b = 0; b < 28; b++) [0.5, 0.2, 0.62, 0.28].forEach((v, k) => hat.push([b + k / 4, 0.2, 60, v]));
  for (let bar = 0; bar < 7; bar++) {
    ghost.push([4 * bar + 1.75, 0.12, 57, 0.2], [4 * bar + 2.25, 0.12, 57, 0.15], [4 * bar + 3.75, 0.12, 57, 0.24]);
    [[0.75, 79], [1.5, 76], [2.75, 79], [3.25, 76]].forEach(([o, p], i) => tock.push([4 * bar + o!, 0.2, p!, i === 1 ? 0.8 : 0.55, { articulation: 'tock' }]));
  }
  const fill: Note[] = [[29.5, 0.2, 57, 0.85], ...[0, 1, 2].map((i): Note => [30 + i / 3, 0.15, 57, 0.35 + 0.08 * i]), ...[0, 1, 2, 3, 4, 5].map((i): Note => [31 + i / 6, 0.1, 57 + (i > 3 ? 2 : 0), 0.5 + 0.09 * i])];
  const parts: FablePart[] = [
    { id: 'kick', instrument: 'v12/sub-hammer', v12: { attackSeconds: 0.001, releaseSeconds: 0.04 }, notes: kicks.map((b): Note => [b, 0.5, 36, 0.95]) },
    { id: 'kick-top', instrument: 'v12/iron-pulse', v12: { oneShot: true }, notes: kicks.map((b, i): Note => [b, 0.5, 36, i % 2 ? 0.76 : 0.84]) },
    { id: 'clap', instrument: 'v12/neon-clap', v12: { oneShot: true }, notes: [...bars(0, 1, 2, 3, 4, 5, 6).filter(b => b % 2 === 1).map((b): Note => [b, 0.5, 60, 0.8]), [29.5, 0.5, 60, 0.8]] },
    { id: 'ghost', instrument: 'v12/titanium-crack', v12: { attackSeconds: 0.001, releaseSeconds: 0.02 }, notes: [...ghost, ...fill] },
    { id: 'hat', instrument: 'v12/ghost-tick', pan: 0.15, v12: { oneShot: true }, notes: hat },
    { id: 'ohat', instrument: 'v12/open-circuit', pan: -0.15, v12: { attackSeconds: 0.001, releaseSeconds: 0.05 },
      notes: [...[0, 1, 2, 3, 4, 5, 6].map((bar): Note => [4 * bar + 3.5, 0.4, 60, 0.55]), ...[4, 5, 6].map((bar): Note => [4 * bar + 1.5, 0.4, 60, 0.45])] },
    { id: 'bass', instrument: 'living-bass', gainDb: 0, macro: 0.84, expression: 0.82, motion: [{ fromBeat: 0, toBeat: 32, preset: 'sixteenths' }], setup: { seed: 128 }, phrases: [
      ph('strut', 0), ph('pop', 2), ph('strut', 4), ph('crawl', 6),
      ph('strut', 8), ph('pop', 10), ph('strut', 12), ph('zip', 14),
      ph('strut', 16), ph('anchor', 18), ph('strut', 20, [{ op: 'transpose', steps: -2 }]), ph('anchor', 22, [{ op: 'transpose', steps: -2 }]),
      ph('strut', 24, [shift(3)]), ph('pop', 26, [shift(3)]),
      ph('turn', 28) ] },
    { id: 'stab', instrument: 'v12/phantom', v12: { attackSeconds: 0.002, releaseSeconds: 0.035, offsetSeconds: 1 }, phrases: [
      ...[0, 1, 2, 3].flatMap(bar => [ph('jab', 4 * bar + 1.75), ph('jab', 4 * bar + 3.25, [], 0.85)]),
      ph('jab', 17.75), ph('jab', 21.75),
      ...[24.75, 25.75, 26.5, 27.25].map(b => ph('jab', b, [], 1.05)),
      ...[28, 28.75, 29.5].map(b => ph('sharp-nine', b)) ] },
    { id: 'lead', instrument: 'v12/signal', pan: -0.1, v12: { attackSeconds: 0.002, releaseSeconds: 0.05 }, phrases: [
      ph('pop', 18, [{ op: 'octave', by: 2 }]), ph('pop', 22, [{ op: 'octave', by: 2 }, { op: 'transpose', steps: 2 }]),
      ph('pop', 26, [{ op: 'octave', by: 2 }, shift(3)], 0.9) ] },
    { id: 'tock', instrument: 'mechanical-orchestra/clock', gainDb: 0, pan: 0.25, macro: 0.25, setup: { seed: 3, spread: 0.2 }, notes: tock },
    { id: 'boing', instrument: 'mechanical-orchestra/spring', gainDb: 0, pan: -0.2, macro: 0.4, setup: { seed: 9 },
      notes: [[15.5, 0.5, 48, 0.85, { articulation: 'twang' }], [19.75, 0.25, 55, 0.7, { articulation: 'twang' }], [23.75, 0.25, 58, 0.7, { articulation: 'twang' }]] },
    { id: 'chrome', instrument: 'v12/chrome-strike', pan: 0.1, v12: { attackSeconds: 0.001, releaseSeconds: 0.25 }, notes: [[0, 2, 72, 0.5], [24, 2, 75, 0.6], [28, 0.6, 71, 0.5], [28.75, 0.6, 71, 0.5], [29.5, 0.6, 71, 0.6]] },
  ];
  return {
    schema: SCHEMA, title: 'FABLE B - CHROME FUNK', bpm: 128, key: 'C minor', swing: 0.57, seed: 128, tailSeconds: 6,
    description: 'C minor, swung sixteenths. The Living Bass struts on the one, pops the octave and crawls F sharp to G; the answer bar crawls B flat, B up to the one. A synth answers the pop two octaves up. Bar 7 shifts the riff up a minor third onto a plain major triad; bar 8 is a sharp-nine dominant in stop time with a triplet fill and a chromatic walk home.',
    sections: [{ id: 'groove', bars: 4, development: 'two-bar riff twice; the fourth bar ends in a ratcheting dive' }, { id: 'answer', bars: 2, development: 'the bass keeps the strut; the synth answers with the pop; the strut drops to the flat sixth' },
      { id: 'gear', bars: 1, development: 'the whole riff a minor third up; the stabs become a major triad' }, { id: 'turnaround', bars: 1, development: 'three stop-time hits on a sharp-nine dominant, triplet fill, chromatic walk G A B-flat B to C' }],
    motifs: [
      { id: 'strut', role: 'hook', octave: 2, lengthBeats: 2, notes: [[0, 0.5, 0, 1, { gesture: 'accent' }], [0.75, 0.25, 0, 0.7, { gesture: 'soft' }], [1.25, 0.25, 2, 0.85], [1.5, 0.5, 3, 0.9, { gesture: 'legato', slide: 0.12 }]] },
      { id: 'pop', role: 'answer', octave: 2, lengthBeats: 2, notes: [[0.25, 0.25, 7, 1, { gesture: 'accent' }], [0.5, 0.5, 6, 0.85], [1, 0.5, 4, 0.9], [1.5, 0.25, 3, 0.8, { alt: 1 }], [1.75, 0.25, 4, 0.9, { gesture: 'legato', slide: 0.08 }]] },
      { id: 'crawl', role: 'answer', octave: 2, lengthBeats: 2, notes: [[0, 0.75, 3, 1, { alt: 1, gesture: 'accent' }], [0.75, 0.25, 4, 0.85, { gesture: 'legato', slide: 0.15 }], [1, 0.5, -1, 0.95, { gesture: 'lift' }], [1.5, 0.5, -1, 0.9, { alt: 1, gesture: 'short' }]] },
      { id: 'zip', role: 'answer', octave: 2, lengthBeats: 2, notes: [[0, 0.75, 3, 1, { alt: 1, gesture: 'accent' }], [0.75, 0.25, 4, 0.85, { gesture: 'legato', slide: 0.15 }], [1, 1, 7, 1, { gesture: 'accent', params: { dive: 12, diveBeats: 0.8 } }]] },
      { id: 'anchor', role: 'bass', octave: 2, lengthBeats: 2, notes: [[0, 0.5, 0, 0.95, { gesture: 'accent' }], [1, 0.25, 0, 0.8, { gesture: 'short' }], [1.5, 0.5, -3, 0.9]] },
      { id: 'turn', role: 'bass', octave: 1, lengthBeats: 4, notes: [[0, 0.5, 4, 1, { gesture: 'accent' }], [0.75, 0.5, 11, 0.95, { gesture: 'accent' }], [1.5, 0.5, 4, 1, { gesture: 'accent' }],
        [2, 0.5, 4, 0.9], [2.5, 0.5, 5, 0.9, { alt: 1, gesture: 'legato', slide: 0.1 }], [3, 0.5, 6, 0.95], [3.5, 0.5, 6, 1, { alt: 1, gesture: 'legato', slide: 0.1 }]] },
      { id: 'jab', role: 'figure', octave: 3, lengthBeats: 0.25, notes: [[0, 0.25, 6, 0.5], [0, 0.25, 9, 0.5], [0, 0.25, 11, 0.5]] },
      { id: 'sharp-nine', role: 'figure', octave: 3, lengthBeats: 0.5, notes: [[0, 0.4, 6, 0.55, { alt: 1 }], [0, 0.4, 10, 0.55], [0, 0.4, 13, 0.55]] },
    ],
    parts,
  };
}
export function mixB(s: (id: string) => Stereo, c: Ctx) {
  const kick = toPeak(sum(s('kick'), gainDb(s('kick-top'), -1)), -4.5);
  const sub = pump(toPeak(mono(lp(s('bass'), 120, true)), -8.5), c, 24, 200, 40);
  const bass = pump(toRms(lp(crushed(hp(s('bass'), 120, true), 0.85, 9), 9000), -17), c, 8, 170);
  const snare = gainDb(crushed(sum(toPeak(s('clap'), -9.5), toPeak(s('ghost'), -10)), 0.7), 3);
  const hats = pump(sum(toPeak(hp(s('hat'), 3000), -16), toPeak(hp(s('ohat'), 2500), -15)), c, 3, 150);
  const perc = gainDb(crushed(sum(toPeak(hp(s('tock'), 500), -14), toPeak(hp(s('boing'), 150), -12), toPeak(s('chrome'), -13)), 0.7), 3);
  const stab = pump(toPeak(lp(crushed(hp(s('stab'), 220, true), 1, 9), 10000), -10), c, 6, 160);
  const lead = pump(toPeak(lp(crushed(hp(s('lead'), 250, true), 0.9, 8), 9000), -10.5), c, 4, 160);
  const wet = pump(gainDb(room(sum(gainDb(snare, -9), gainDb(perc, -6), gainDb(stab, -9), gainDb(lead, -7)), 1.0, 350), 2), c, 9, 200);
  const buses = { kick, sub, bass, snare, hats, perc, stab, lead, room: wet };
  return { buses, mix: sum(...Object.values(buses)) };
}
/** Shared master: the mix peak-normalised to the CRUSH reference, then the clipper only (no drive, no compressor). */
export const MASTER = { amount: 0.7, drive: false, squeeze: false, clip: true } as const;
