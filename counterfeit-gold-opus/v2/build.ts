/**
 * FERRYMAN TAKES FAKES V2 · the definitive reconstruction.
 *
 * Three records and two prints (v2/chops.json), one native DaemonV12 project, 88 BPM. Every record runs at a speed
 * that puts its beat on this grid: the LP and the Procession Take at 0.840896 (F becomes D), V1 at 1 or at 0.5 (still
 * D minor, an octave down, half time). Nothing is synthesized here; every note is a slice of a print.
 *
 *  bars  1-2   THE BOX          the funeral at half speed, two tolls; two coins; Odile's shout bending up into
 *  bars  3-10  COUNTERFEIT      the V1 identity, rebuilt: the LP cut so Eb7#11 lands on the and-of-three, break
 *                               drums, the eternal Deacon underneath; pass 3 is a floor; pass 4 lets the riff peek in
 *  bars 11-17  THE CROSSING     the LP's whole 7/8 crossing played straight over 4/4: the drums keep to four, drop
 *                               out, then the kick follows the seven while the snare insists on four
 *  bar  18     CONVERGENCE      28 record beats are exactly 7 bars: the LP's own stop-time stab lands on the one
 *  bars 19-26  CUT HIM LOOSE    the second idea: the band's street take, the same tune in D7 blues, hip-hop low end
 *                               under a parade; in bar 25 the LP's ferryman chord hits with the street's own
 *  bars 27-28  THREE EZRAS      the riff alone, then one reed player stacked into a horn section (4ths and octave)
 *  bars 29-31  SHOUT            the street's shout chorus with a baritone Ezra under it
 *  bar  32     THE SINK         the parade sinks a minor third and slows as it goes: the coin is being bitten
 *  bar  33     THE BITE         the coins, bright; the same coins an octave down: brass; V1's swell inhales
 *  bars 34-45  COUNTERFEIT OF A COUNTERFEIT
 *                               V1 played as an old record at half speed (octave down, half time) with the eternal
 *                               Deacon sliding under it and Odile rapping on top; V1 wakes to real speed; the LP's
 *                               feral chorus collides with it
 *  bars 46-51  PAYMENT          the counterfeit loop one last time, answered by three Ezras
 *  bars 52-53  THE CADENCE      the LP's unresolved ferryman chord, and the street's F major (now D) resolving it:
 *                               a cadence across two records, 1971 to now
 *  bar  54     THE COIN         a coin spins down and falls flat, an octave too low; Odile breathes out
 *
 *   node counterfeit-gold-opus/v2/build.ts [TAG]           engine render (PCM16) into work/v2-TAG with stems
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatPosition } from '../../src/timing/musical-time.ts';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '..'), REPO = resolve(ROOT, '..');
const CLI = join(REPO, 'bin', 'daemonv12.js');
export const TITLE = 'FERRYMAN TAKES FAKES (V2)', SLUG = 'ferryman-takes-fakes-v2';
const BPM = 88, PPQ = 960, WHOLE = 4 * PPQ, BEAT_S = Math.round(60e6 / BPM) / 1e6, TICK_S = BEAT_S / PPQ;
const dig = JSON.parse(readFileSync(join(HERE, 'chops.json'), 'utf8'));
const FILES: Record<string, string> = Object.fromEntries(Object.entries(dig.sources as Record<string, { file: string }>).map(([k, v]) => [k, v.file]));
/** The LP's and the Procession Take's beat onto this grid. */
export const R = +(0.573338 / BEAT_S).toFixed(6);
const SEMI = (n: number) => 2 ** (n / 12);
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** A tick count as a reduced whole-note fraction (the engine allows four digits a side). */
const frac = (ticks: number) => { const t = Math.max(1, Math.round(ticks)), g = gcd(t, WHOLE); return `${t / g}/${WHOLE / g}`; };
/** Rate of an LP/street/eternal chop sounding `n` semitones above the slowed key (D). */
const st = (n: number) => +(R * SEMI(n)).toFixed(6);
const STREET_SWING = 0.05, LP_SWING = 0.03;   // where an odd sixteenth of each record really falls (beats)

// ------------------------------------------------------------------------------------------------ events
type Track = 'lp' | 'seven' | 'stabs' | 'vox' | 'bell' | 'kick' | 'snare' | 'hat' | 'perc' | 'street' | 'horns' | 'v1' | 'sub' | 'fx';
const SOURCE_OF: Record<Track, string> = { lp: 'lp', seven: 'lp', stabs: 'lp', vox: 'lp', bell: 'lp', kick: 'lp', snare: 'lp', hat: 'lp', perc: 'lp', street: 'street', horns: 'street', v1: 'v1', sub: 'eternal', fx: 'reversed' };
interface Ev { track: Track; beat: number; chop: string; rate?: number; vel?: number; gate?: number; ms?: number; attack?: number; release?: number; choke?: string; glide?: [number, number] }
const events: Ev[] = [];
function put(track: Track, beat: number, chop: string, o: Omit<Ev, 'track' | 'beat' | 'chop'> = {}) {
  const c = dig.chops[chop];
  if (!c) throw new Error(`no chop ${chop}`);
  if (c.src !== SOURCE_OF[track]) throw new Error(`${chop} is from ${c.src}, track ${track} plays ${SOURCE_OF[track]}`);
  events.push({ track, beat, chop, ...o });
}
let seed = 2026;
const rnd = () => { let t = (seed = (seed + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const jit = (ms: number) => (rnd() * 2 - 1) * ms;
const defaultRate = (t: Track) => (SOURCE_OF[t] === 'v1' || SOURCE_OF[t] === 'reversed' ? 1 : R);

function note(e: Ev) {
  const c = dig.chops[e.chop], rate = e.rate ?? (e.track === 'fx' ? R : defaultRate(e.track));
  const tick = Math.max(0, Math.round(e.beat * PPQ - c.leadSeconds / rate / TICK_S + (e.ms ?? 0) / 1000 / TICK_S));
  const n: Record<string, unknown> = { tick, velocity: +Math.min(1, Math.max(0.01, e.vel ?? 1)).toFixed(3) };
  if (Math.abs(rate - 1) > 1e-9) n.playbackRate = rate;
  if (c.offsetSeconds > 0) n.offsetSeconds = c.offsetSeconds;
  n.endSeconds = c.endSeconds;
  if (e.gate !== undefined) n.gate = frac(e.gate * PPQ);
  n.envelope = { attackSeconds: e.attack ?? 0.002, releaseSeconds: e.release ?? 0.012 };
  if (e.choke) n.chokeGroup = e.choke;
  if (e.glide) n.glide = { to: +e.glide[0].toFixed(6), duration: frac(e.glide[1] * PPQ) };
  return n;
}

// ------------------------------------------------------------------------------------------------ instruments
const loop = { choke: 'loop', attack: 0.002, release: 0.014 };
const drum = { attack: 0.0005, release: 0.04 };
/** Refinement R1: the kick's punch above 58 Hz (two highpasses in series); below that belongs to the Deacon. */
const KICK_RATE = 1;   // at its own speed: an exact copy (retuning it would cost the engine's interpolation budget)
const KICK = 'kick-3', SNARE = 'snare-2', GHOST = 'snare-0', HATS = ['snare-0', 'snare-2'];
type Hit = [number, number, number];
interface Groove { kick: Hit[]; snare: Hit[]; ghost?: Hit[]; hats: Hit[]; bars: number; hatSwing?: number; hatGate?: number }
const hatRow = (bars: number, vel: (i: number) => number, every = 0.25, swing = 0): Hit[] => Array.from({ length: bars * 4 / every }, (_, i) => [i * every + (i % 2 ? swing : 0), vel(i), 0] as Hit);
const GROOVE_A: Groove = {
  bars: 2,
  kick: [[0, 1, 0], [0.75, 0.5, -4], [1.75, 0.72, -6], [2.5, 0.95, -4], [4.75, 0.88, 0], [5.5, 0.55, -3], [6.5, 0.92, -4], [7.25, 0.45, 0]],
  snare: [[1, 0.95, 22], [3, 0.92, 26], [5, 0.95, 20], [7, 0.93, 28]],
  ghost: [[3.75, 0.22, 10], [6.25, 0.22, 10], [7.75, 0.26, 12]],
  hats: hatRow(2, i => [0.35, 0.18, 0.8, 0.3][i % 4]!),
};
const GROOVE_HALF: Groove = {
  bars: 1, kick: [[0, 1, 0], [1.75, 0.7, -5], [2.5, 0.82, -3]], snare: [[2, 0.98, 26]], ghost: [[3.5, 0.2, 10]],
  hats: hatRow(1, i => [0.6, 0.25, 0.45, 0.28][i % 4]! * (i === 14 ? 1.3 : 1)),
};
const GROOVE_STREET: Groove = {
  bars: 2, kick: [[0, 1, 0], [2.5, 0.82, -3], [4.75, 0.84, 0], [6.5, 0.88, -3]], snare: [[1, 0.55, 6], [3, 0.58, 6], [5, 0.55, 6], [7, 0.6, 6]],
  hats: hatRow(2, i => [0.32, 0.16, 0.26, 0.16][i % 4]!, 0.25, STREET_SWING),
};
function groove(g: Groove, from: number, bars: number, o: { noKickBefore?: number; noSnareBefore?: number; hats?: boolean } = {}) {
  for (let b = 0; b < bars; b += g.bars) {
    const at = from + 4 * b, inRange = (x: number) => x < 4 * Math.min(g.bars, bars - b);
    for (const [x, v, ms] of g.kick) if (inRange(x) && at + x >= (o.noKickBefore ?? -1)) put('kick', at + x, KICK, { ...drum, rate: KICK_RATE, gate: 0.45, vel: v, ms: ms + jit(2) });
    for (const [x, v, ms] of g.snare) if (inRange(x) && at + x >= (o.noSnareBefore ?? -1)) put('snare', at + x, SNARE, { ...drum, rate: 0.94, gate: 0.6, release: 0.06, vel: v, ms: ms + jit(3) });
    for (const [x, v, ms] of g.ghost ?? []) if (inRange(x) && at + x >= (o.noSnareBefore ?? -1)) put('snare', at + x, GHOST, { ...drum, gate: 0.2, vel: v, ms });
    if (o.hats !== false) for (const [x, v] of g.hats) if (inRange(x)) put('hat', at + x, HATS[Math.round(x * 4) % 2]!, { attack: 0.0005, release: 0.015, rate: 1, gate: 0.11, vel: Math.min(1, v + jit(0.05)), ms: jit(3) });
  }
}
/** The eternal Deacon: `pluck` starts with his attack; `slide` is legato from inside the sustain (808 glides). */
const pluck = (beat: number, n: number, gate: number, vel = 1, glide?: [number, number]) =>
  put('sub', beat, 'eternal', { rate: st(n), gate, vel, choke: 'bass', attack: 0.003, release: 0.04, ...(glide ? { glide: [st(glide[0]), glide[1]] as [number, number] } : {}) });
const slide = (beat: number, from: number, to: number, beats: number, gate: number, vel = 0.8) =>
  put('sub', beat, 'eternal-hold', { rate: st(from), glide: [st(to), beats], gate, vel, choke: 'bass', attack: 0.012, release: 0.04 });
const RIFF_AT = [0, 0.5, 0.75 + STREET_SWING, 1, 1.5, 2, 3, 3.25 + STREET_SWING, 3.5], RIFF_LEN = [0.5, 0.25, 0.25, 0.5, 0.5, 1, 0.25, 0.25, 0.5];
/** Brother Ezra, stacked: each riff note at once in unison, a fourth up and an octave down. */
function ezras(at: number, notes: number[], voices: [number, number][]) {
  for (const i of notes) for (const [mult, vel] of voices) put('horns', at + RIFF_AT[i]!, `riff-${i}`, { rate: +(R * mult).toFixed(6), gate: RIFF_LEN[i]!, vel, release: 0.05 });
}
const UNISON: [number, number] = [1, 0.9], FOURTH: [number, number] = [SEMI(5), 0.62], BARITONE: [number, number] = [0.5, 0.78];
/** Odile, re-sung from her own syllables: [beat, syllable, semitone shift, gate?, glide multiplier?, glide beats?] */
type Syl = [number, string, number, number?, number?, number?];
function odile(at: number, line: Syl[], vel = 0.95) {
  for (const [x, syl, shift, gate, gm, gb] of line)
    put('vox', at + x, syl, { rate: +(R * SEMI(shift)).toFixed(6), gate: gate ?? 0.25, vel, release: 0.02, choke: 'odile', ...(gm ? { glide: [+(R * SEMI(shift) * gm).toFixed(6), gb ?? 0.25] as [number, number] } : {}) });
}

// ------------------------------------------------------------------------------------------------ the arrangement (grid beats)
export const MAP = { box: 0, counterfeit: 8, crossing: 40, convergence: 68, cut: 72, ezras: 104, shout: 112, sink: 124, bite: 128, coc: 132, payment: 180, cadence: 204, coin: 212, end: 216 };

// bars 1-2, THE BOX
put('street', 0, 'dirge', { gate: 5, release: 0.06, vel: 0.5 });                 // two tolls, "C .. C .. Eb" at half speed, hums
pluck(0, 0, 3.6, 0.42); pluck(4, 7, 1, 0.4);                           // the pram tuba's D and A, given weight
put('lp', 5, 'coins', { ...loop, gate: 0.5, vel: 0.8 });                         // two coins, dry
put('street', 5.5, 'roll-shout', { gate: 2.5, release: 0.01, vel: 0.8 });         // the press roll and Odile bending up a fifth

// bars 3-10, COUNTERFEIT
const counterfeitBass = (L: number, last = false) => {
  pluck(L, 0, 1.4, 1); pluck(L + 1.75, 0, 0.5, 0.6); pluck(L + 2.5, 1, 2.1, 0.95); pluck(L + 4.75, 1, 0.9, 0.85);
  pluck(L + 6.5, last ? 5 : 0, 0.9, 0.9);
  if (!last) pluck(L + 7.5, -2, 0.45, 0.6, [0, 0.125]);
};
for (let k = 0; k < 4; k++) {
  const L = 8 + 8 * k, floor = k === 2;
  put('lp', L, 'a-coins', { ...loop, gate: 2.5 }); put('lp', L + 2.5, 'a-ferry', { ...loop, gate: 4 });
  groove(GROOVE_A, L, 2, floor ? { noKickBefore: L + 2.5, noSnareBefore: L + 2.5 } : {});
  if (!floor) counterfeitBass(L, k === 3); else { pluck(L + 2.5, 1, 2.1, 1); pluck(L + 4.75, 1, 0.9, 0.85); pluck(L + 6.5, 0, 0.9, 0.9); pluck(L + 7.5, -2, 0.45, 0.6, [0, 0.125]); }
  if (k >= 1) { put('perc', L + 3.75, 'conga-open', { ...drum, gate: 0.4, vel: 0.6, ms: 12 }); put('perc', L + 7.25, 'conga-low', { ...drum, gate: 0.4, vel: 0.65, ms: 18 }); }
  if (k === 0) put('lp', L + 6.5, 'a-sigh', { ...loop, gate: 1.5, release: 0.03 });
  if (k === 1) odile(L + 6.5, [[0, 'deh', 0], [0.25, 'dah', 0], [0.5, 'scat-2', 0], [0.75, 'scat-1', 2], [1, 'scat-3', 0, 0.5, 0.5, 0.125]]);   // "deh-dah-oo-ah-AH" and an octave dive
  if (k === 2) { odile(L + 0.5, [[0, 'deh', 0], [0.25 + LP_SWING, 'dah', 0]], 0.85); for (const x of [6.5, 7, 7.5]) put('lp', L + x, 'coins', { ...loop, gate: 0.5, vel: x === 7.5 ? 1 : 0.85 }); }
  if (k === 3) ezras(L + 6.5, [0, 1, 2, 3], [UNISON]);                 // the riff's head peeks in: D F D A
}

// bars 11-17, THE CROSSING (and the drummer arguing with it)
put('seven', 40, 'crossing-run', { gate: 28, release: 0.01 });
for (let bar = 0; bar < 2; bar++) {
  const O = 40 + 4 * bar;
  put('kick', O, KICK, { ...drum, rate: KICK_RATE, gate: 0.45 }); put('kick', O + 2.5, KICK, { ...drum, rate: KICK_RATE, gate: 0.45, vel: 0.8, ms: -4 });
  put('snare', O + 2, SNARE, { ...drum, rate: 0.94, gate: 0.6, release: 0.06, vel: 0.95, ms: 24 });
  for (let q = 0; q < 4; q++) put('hat', O + q, HATS[q % 2]!, { attack: 0.0005, release: 0.015, rate: 1, gate: 0.11, vel: q ? 0.45 : 0.62 });
}
pluck(40, 0, 2, 0.85);
// bars 13-14: the drums leave; the record's 7/8 and Odile's undertones alone
// bars 15-16: the kick follows the seven (2+2+3 group starts), the snare insists on four
for (const [x, v] of [[56, 0.9], [57.5, 1], [59.5, 0.8], [61, 1], [63, 0.8]] as [number, number][]) put('kick', x, KICK, { ...drum, rate: KICK_RATE, gate: 0.45, vel: v });
for (const x of [58, 62]) put('snare', x, SNARE, { ...drum, rate: 0.94, gate: 0.6, release: 0.06, vel: 0.97, ms: 24 });
for (let i = 0; i < 40; i++) put('hat', 56 + i * 0.25, HATS[i % 2]!, { attack: 0.0005, release: 0.015, rate: 1, gate: 0.11, vel: [0.55, 0.22, 0.4, 0.25][i % 4]! });
// bar 17: the seven's last cycle, a snare climb, the bell inhaling into
put('kick', 64.5, KICK, { ...drum, rate: KICK_RATE, gate: 0.45 }); put('kick', 66.5, KICK, { ...drum, rate: KICK_RATE, gate: 0.45, vel: 0.85 });
for (let i = 0; i < 8; i++) put('snare', 66 + i * 0.25, GHOST, { ...drum, gate: 0.2, vel: 0.3 + 0.09 * i });
put('fx', 68, 'bell-reversed', { rate: R, attack: 0.05, release: 0.003, vel: 0.9 });

// bar 18, CONVERGENCE: the record's own stop-time lands on the one
put('stabs', 68, 'stop-bar', { gate: 3, release: 0.05 });
put('kick', 68, KICK, { ...drum, rate: KICK_RATE, gate: 0.45 }); put('kick', 68.75, KICK, { ...drum, rate: KICK_RATE, gate: 0.45 });
pluck(68, 0, 0.6, 1); pluck(68.75, 1, 0.6, 1); pluck(70, 0, 1, 0.9);
put('bell', 68, 'bell', { rate: R / 2, gate: 6, release: 0.8, vel: 0.9 });
put('street', 70.5, 'roll-late', { gate: 1.5, release: 0.01 });

// bars 19-26, CUT HIM LOOSE: the street take, D7 G7 D7 A7 D7 G7 D7|Eb7 D7
put('street', 72, 'line', { gate: 32, release: 0.02 });
groove(GROOVE_STREET, 72, 8);
const LINE_ROOTS = [0, 5, 0, 7, 0, 5, 0, 0];
LINE_ROOTS.forEach((r, i) => {
  const O = 72 + 4 * i, next = LINE_ROOTS[i + 1] ?? 0;
  pluck(O, r, 1.6, 1);
  if (i === 6) { pluck(O + 2, 1, 1.5, 0.95); slide(O + 3.5, 1, next, 0.25, 0.5, 0.7); }
  else { pluck(O + 2.5, r, 0.9, 0.8); if (i < 7) slide(O + 3.5, r, next, 0.25, 0.5, 0.65); }
});
put('lp', 98, 'a-ferry', { ...loop, gate: 1.5, vel: 0.9 });          // the LP's ferryman chord hits with the street's own
put('kick', 98, KICK, { ...drum, rate: KICK_RATE, gate: 0.45 });

// bars 27-28, THREE EZRAS
put('horns', 104, 'riff', { gate: 4, release: 0.05 });
ezras(108, [0, 1, 2, 3, 4, 5, 6, 7, 8], [UNISON, FOURTH, BARITONE]);
groove(GROOVE_A, 108, 1);
pluck(108, 0, 1.4, 1); pluck(110.5, 0, 1.2, 0.9);

// bars 29-31, SHOUT
put('street', 112, 'shout-a', { gate: 12, release: 0.02 });
ezras(112, [0, 1, 2, 3, 4, 5, 6, 7, 8], [BARITONE]); ezras(120, [0, 1, 2, 3, 4, 5, 6, 7, 8], [BARITONE]);
groove(GROOVE_STREET, 112, 3);
[0, 5, 0].forEach((r, i) => { const O = 112 + 4 * i; pluck(O, r, 1.6, 1); pluck(O + 2.5, r, 0.9, 0.8); slide(O + 3.5, r, [5, 0, 7][i]!, 0.25, 0.5, 0.65); });

// bar 32, THE SINK
put('street', 124, 'shout-4', { glide: [+(R * SEMI(-3)).toFixed(6), 4], gate: 4, release: 0.03 });
put('kick', 124, KICK, { ...drum, rate: KICK_RATE, gate: 0.45 });
pluck(124, 7, 4, 0.95, [4, 4]);

// bar 33, THE BITE
put('lp', 128, 'coins', { ...loop, gate: 0.5 });
put('lp', 129.5, 'coins', { ...loop, rate: R / 2, gate: 1, vel: 0.9 });  // the same coins an octave down: brass
put('fx', 132, 'swell-reversed', { rate: R, attack: 0.05, release: 0.003, vel: 0.9 });

// bars 34-45, COUNTERFEIT OF A COUNTERFEIT
put('v1', 132, 'v1-shout-1', { rate: 0.5, gate: 16, release: 0.02 });
put('v1', 148, 'v1-shout-2', { rate: 0.5, gate: 16, release: 0.02 });
groove(GROOVE_HALF, 132, 8);
const halfBass = (L: number) => {
  pluck(L, 0, 3.5, 1); slide(L + 3.5, 0, 1, 0.125, 0.5, 0.7);
  pluck(L + 4, 1, 3, 0.95); pluck(L + 7.5, 1, 0.5, 0.6);
  pluck(L + 8, 1, 2.5, 0.9); slide(L + 10.5, 1, -2, 0.25, 1.5, 0.75);
  pluck(L + 12, 1, 3.5, 0.9); slide(L + 15.5, 1, 0, 0.125, 0.5, 0.7);
};
halfBass(132); halfBass(148);
ezras(134.5, [0, 1, 2, 3], [UNISON, FOURTH, BARITONE]);
// Odile raps over the half-speed record (bar 38 on D minor, bar 39 retuned to Eb7#11)
odile(148, [[0, 'dah', 0], [0.25, 'deh', 0], [0.5, 'scat-2', 0], [1, 'scat-3', 0], [1.25, 'scat-4', 0], [1.5, 'scat-5', 0], [1.75, 'scat-7', 0],
  [2, 'dah', 0], [2.25, 'dah', 0], [2.5, 'dah', 0], [2.75, 'scat-cry', 0, 0.75, SEMI(7), 0.125],
  [4, 'scat-0', 0], [4.25, 'scat-1', 0], [4.5, 'scat-2', -1], [4.75, 'scat-3', 0], [5, 'scat-3', 0], [5.25, 'scat-4', -1], [5.5, 'scat-5', 0], [5.75, 'scat-6', -1],
  [6, 'scat-cry', -1, 1.5, 0.5, 0.25], [7.5, 'deh', 0], [7.75, 'dah', 0]]);
put('v1', 164, 'v1-shout-1', { rate: 1, gate: 8, release: 0.02 });   // it wakes up
for (let i = 0; i < 32; i++) put('hat', 164 + i * 0.25, HATS[i % 2]!, { attack: 0.0005, release: 0.015, rate: 1, gate: 0.11, vel: [0.45, 0.2, 0.35, 0.22][i % 4]! });
put('kick', 164, KICK, { ...drum, rate: KICK_RATE, gate: 0.45 });
put('lp', 172, 's-coins', { ...loop, gate: 2 }); put('lp', 174, 's-ferry', { ...loop, gate: 4 }); put('lp', 178, 's-ferry-tail', { ...loop, gate: 2 });
groove(GROOVE_A, 172, 2);
pluck(172, 0, 1.5, 1); pluck(174, 1, 1.9, 0.95); pluck(176.5, 1, 0.9, 0.85); pluck(178.5, 1, 0.9, 0.9); pluck(179.5, -2, 0.45, 0.6, [0, 0.125]);

// bars 46-51, PAYMENT
for (let k = 0; k < 3; k++) {
  const L = 180 + 8 * k;
  put('lp', L, 'a-coins', { ...loop, gate: 2.5 }); put('lp', L + 2.5, 'a-ferry', { ...loop, gate: 4 });
  groove(GROOVE_A, L, 2);
  counterfeitBass(L);
  odile(L + 0.5, [[0, 'deh', 0], [0.25 + LP_SWING, 'dah', 0]], 0.8);
  put('perc', L + 3.75, 'conga-open', { ...drum, gate: 0.4, vel: 0.6, ms: 12 });
  if (k < 2) ezras(L + 6.5, [0, 1, 2, 3], [UNISON, FOURTH, BARITONE]);
  if (k < 2) for (let i = 0; i < 4; i++) put('snare', L + 7.5 + i * 0.125, GHOST, { ...drum, gate: 0.1, vel: 0.2 + 0.07 * i });   // a parade press into the next pass
}
put('street', 202.5, 'roll-late', { gate: 1.5, release: 0.01 });            // the street's press roll into the cadence

// bars 52-53, THE CADENCE: Eb7#11 (the LP, 1971) -> D (the street, the same day)
put('stabs', 204, 'ferryman-end', { gate: 3.2, release: 0.2 });
put('kick', 204, KICK, { ...drum, rate: KICK_RATE, gate: 0.6 });
pluck(204, 1, 2.9, 1, [0, 2.5]);                                         // the bass slides Eb -> D, bII -> I
put('street', 207, 'home', { gate: 10, release: 0.6 });
pluck(207, 0, 5, 0.85); put('kick', 207, KICK, { ...drum, rate: KICK_RATE, gate: 0.6, vel: 0.7 });

// bar 54, THE COIN: spins down, falls flat
let t = 211.5, gap = 0.5, v = 0.72, k = 0;
while (gap > 0.06) { put('lp', t, 'clink', { gate: 0.3, rate: +(R * (1 + 0.015 * k)).toFixed(6), vel: v, release: 0.03 }); t += gap; gap *= 0.78; v *= 0.9; k++; }
put('lp', t + 0.25, 'clink', { gate: 0.6, rate: +(R / 2).toFixed(6), vel: 0.85, release: 0.08 });
put('vox', 215.25, 'breath-out', { gate: 3, attack: 0.05, release: 0.3, vel: 1 });

// ------------------------------------------------------------------------------------------------ the project
const fx = (o: object) => o;
const TRACKS: Record<Track, { description: string; gainDb: number; pan?: number; effects: object[] }> = {
  lp: { description: 'The LP: the counterfeit cut (head-a bar 1 into bar 4), its feral twin from the shout, the coins.', gainDb: -2,
    effects: [fx({ type: 'highpass', frequencyHz: 170 }), fx({ type: 'saturation', driveDb: 5, mix: 0.3 }), fx({ type: 'compressor', thresholdDb: -20, ratio: 2.5, attackMs: 15, releaseMs: 120, makeupGainDb: 2 })] },
  seven: { description: "The LP's whole 7/8 crossing, played straight across 4/4.", gainDb: -5,
    effects: [fx({ type: 'highpass', frequencyHz: 60 }), fx({ type: 'lowpass', frequencyHz: 6000 }), fx({ type: 'saturation', driveDb: 8, mix: 0.4 })] },
  stabs: { description: "The LP's stop bar (on the one, after seven bars of 7/8) and its unresolved last chord.", gainDb: -1,
    effects: [fx({ type: 'highpass', frequencyHz: 80 }), fx({ type: 'saturation', driveDb: 6, mix: 0.35 }), fx({ type: 'reverb', roomSize: 0.6, decaySeconds: 2.2, wet: 0.18 })] },
  vox: { description: "Odile re-sung from her own syllables: the count, the rap, octave dives, a fifth bent up; her last breath.", gainDb: 7, pan: -0.08,
    effects: [fx({ type: 'highpass', frequencyHz: 280 }), fx({ type: 'delay', timeMs: 511, wet: 0.18 }), fx({ type: 'reverb', roomSize: 0.55, decaySeconds: 1.8, wet: 0.16 })] },
  bell: { description: 'The viewing-room bell two octaves down, at the convergence.', gainDb: 1,
    effects: [fx({ type: 'highpass', frequencyHz: 28 }), fx({ type: 'reverb', roomSize: 0.85, decaySeconds: 3.5, wet: 0.25 })] },
  kick: { description: "Iggy's break kick (LP bar 8, beat 1) at its own speed, its punch above 58 Hz; below that belongs to the Deacon.", gainDb: 0,
    effects: [fx({ type: 'highpass', frequencyHz: 58 }), fx({ type: 'highpass', frequencyHz: 58 }), fx({ type: 'lowpass', frequencyHz: 7000 }), fx({ type: 'saturation', driveDb: 8, mix: 0.45 }), fx({ type: 'compressor', thresholdDb: -16, ratio: 4, attackMs: 6, releaseMs: 90, makeupGainDb: 3 })] },
  snare: { description: "Iggy's break snare, laid back; its ghost as parade presses and climbs.", gainDb: 3,
    effects: [fx({ type: 'highpass', frequencyHz: 150 }), fx({ type: 'saturation', driveDb: 9, mix: 0.45 }), fx({ type: 'compressor', thresholdDb: -18, ratio: 3, attackMs: 4, releaseMs: 120, makeupGainDb: 2 }), fx({ type: 'reverb', roomSize: 0.3, decaySeconds: 0.7, wet: 0.08 })] },
  hat: { description: 'The break snares above 6.5 kHz: the wires and the room, cut to a sixteenth.', gainDb: 10, pan: -0.2,
    effects: [fx({ type: 'highpass', frequencyHz: 6500 }), fx({ type: 'lowpass', frequencyHz: 15000 })] },
  perc: { description: "Iggy's conga roll, one hand at a time.", gainDb: 7, pan: 0.35,
    effects: [fx({ type: 'highpass', frequencyHz: 140 }), fx({ type: 'reverb', roomSize: 0.35, decaySeconds: 1, wet: 0.12 })] },
  street: { description: 'The Procession Take: the dirge, the press roll and shout, the second line, the shout chorus sinking, the F major home.', gainDb: 0.5,
    effects: [fx({ type: 'highpass', frequencyHz: 90 }), fx({ type: 'saturation', driveDb: 3, mix: 0.2 }), fx({ type: 'compressor', thresholdDb: -18, ratio: 2, attackMs: 20, releaseMs: 150, makeupGainDb: 1 })] },
  horns: { description: 'Brother Ezra: the riff alone, then stacked into a horn section of one man (unison, a fourth up, an octave down).', gainDb: 0, pan: 0.1,
    effects: [fx({ type: 'highpass', frequencyHz: 120 }), fx({ type: 'saturation', driveDb: 7, mix: 0.35 }), fx({ type: 'compressor', thresholdDb: -18, ratio: 3, attackMs: 8, releaseMs: 120, makeupGainDb: 2 }), fx({ type: 'reverb', roomSize: 0.45, decaySeconds: 1.2, wet: 0.15 })] },
  v1: { description: 'FERRYMAN TAKES FAKES V1, sampled as an old record: its shout at half speed, then at its own.', gainDb: -2,
    effects: [fx({ type: 'highpass', frequencyHz: 32 }), fx({ type: 'saturation', driveDb: 4, mix: 0.25 })] },
  sub: { description: "The eternal Deacon: his one plucked F, spliced to last forever, played as the bass with 808 glides.", gainDb: -4,
    effects: [fx({ type: 'lowpass', frequencyHz: 380 }), fx({ type: 'saturation', driveDb: 10, mix: 0.45 }), fx({ type: 'compressor', thresholdDb: -18, ratio: 3, attackMs: 10, releaseMs: 150, makeupGainDb: 2 })] },
  fx: { description: 'Reversed slices of the LP: the bell inhaling into the convergence, the shout downbeat swelling into V1.', gainDb: -3,
    effects: [fx({ type: 'highpass', frequencyHz: 90 }), fx({ type: 'reverb', roomSize: 0.6, decaySeconds: 2, wet: 0.2 })] },
};
export const MASTER = { gainDb: -3.6, effects: [{ type: 'highpass', frequencyHz: 26 }, { type: 'compressor', thresholdDb: -14, ratio: 2, attackMs: 15, releaseMs: 150, makeupGainDb: 2 }, { type: 'saturation', driveDb: 4, mix: 0.3 }] };
export const DURATION = 152;
const BARS = MAP.end / 4;
export function project() {
  const m = { numerator: 4, denominator: 4 };
  return {
    formatVersion: 1, title: TITLE,
    description: 'The definitive reconstruction: the LP, its unreleased Procession Take and the V1 beat, sampled at 88 BPM; the LP\'s 7/8 crossing landing on the one after seven bars; a second line in D7; V1 at half speed; a cadence across two records.',
    bpm: BPM, timeSignature: '4/4', key: 'D minor', bars: BARS, seed: 2026,
    render: { duration: { seconds: DURATION }, tail: 'auto' },
    master: MASTER,
    tracks: (Object.keys(TRACKS) as Track[]).map(id => {
      const t = TRACKS[id], notes = events.filter(e => e.track === id).map(note).sort((a, b) => (a.tick as number) - (b.tick as number));
      return { id, description: t.description, instrument: { type: 'sampler', sample: FILES[SOURCE_OF[id]] }, mix: { gainDb: t.gainDb, ...(t.pan ? { pan: t.pan } : {}) }, effects: t.effects,
        clips: [{ bar: 1, pattern: 'song' }], patterns: [{ id: 'song', bars: BARS, notes: notes.map(({ tick, ...rest }) => ({ start: formatPosition(tick as number, m), ...rest })) }] };
    }),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = join(ROOT, `${SLUG}.json`);
  writeFileSync(file, JSON.stringify(project(), null, 1) + '\n');
  writeFileSync(join(HERE, 'map.json'), JSON.stringify({ bpm: BPM, beatSeconds: BEAT_S, rate: R, sections: MAP, events: events.length }, null, 1) + '\n');
  const tag = process.argv[2] ?? 'dev', out = join(ROOT, 'work', `v2-${tag}`);
  rmSync(out, { recursive: true, force: true });
  const t0 = Date.now();
  let res: { ok: boolean; errors?: unknown; warnings?: unknown[] };
  try { res = JSON.parse(execFileSync(process.execPath, [CLI, 'render', file, '--out-dir', out, '--stems', '--format', 'wav', '--json'], { encoding: 'utf8', maxBuffer: 1 << 28 })); }
  catch (e) { const s = (e as { stdout?: string }).stdout; console.error((s ?? String(e)).slice(0, 4000)); process.exit(1); }
  if (!res.ok) { console.error(JSON.stringify(res.errors, null, 1).slice(0, 4000)); process.exit(1); }
  const manifest = JSON.parse(readFileSync(join(out, `${SLUG}.render.json`), 'utf8'));
  const an = JSON.parse(execFileSync(process.execPath, [CLI, 'analyze', join(out, `${SLUG}.wav`), '--json'], { encoding: 'utf8' })).analysis;
  console.log(`${TITLE}: ${relative(REPO, out)} in ${((Date.now() - t0) / 1000).toFixed(0)} s; ${an.integratedLufs} LUFS, ${an.truePeakDbfs} dBTP, LRA ${an.loudnessRangeLu}; ${events.length} events`);
  const prod = manifest.production ?? {};
  console.log(`master clipped ${prod.master?.clippedSamples} pre-clip peak ${prod.master?.preClipPeakDbfs?.toFixed?.(2)}`);
  for (const tr of prod.tracks ?? []) console.log(`  ${tr.trackId.padEnd(7)} clipped ${String(tr.clippedSamples).padStart(6)}  pre-clip peak ${tr.preClipPeakDbfs?.toFixed?.(2)}`);
  if (res.warnings?.length) console.log('warnings:', JSON.stringify(res.warnings).slice(0, 1500));
}
