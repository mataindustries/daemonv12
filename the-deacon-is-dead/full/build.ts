/**
 * THE DEACON KNOCKS BACK (FULL WAKE) · the definitive Velvet Hearse production, made from three generations of one record.
 *
 *   gen 1  THE VELVET HEARSE, "The Deacon Is Dead" (1972, imaginary): the rack print
 *   gen 2  THE DEACON KNOCKS BACK, the approved short version, sampled as a second record
 *   gen 3  THE OTHER SIDE: fragments of gen 2 with their frames reversed (full/dig.py)
 *
 * Everything is read by the unchanged DaemonV12 sampler. Seven equal steps throughout: gen 1 plays at R = 0.820336
 * (two of its steps down, 117.03 -> 96 BPM), gen 2 and gen 3 already live at 96 BPM and play at 1; any chop moves by
 * whole steps, rate x 2^(k/7).
 *
 * The conversation changes hands. The living knock and the dead answer; the dead knock first and the living answer;
 * the wake is heard from inside the coffin; the two argue in three against four; and on the last call nobody answers,
 * until the band has finished.
 *
 *   bars  1-2   VIEWING           the short version's opening, rebuilt: door, three knocks, the reply, the likembe
 *   bars  3-4   THUMB             the likembe alone, three knocks; from the other side an inhale into the reply
 *   bars  5-12  WAKE              the one-shot groove; four knock-and-reply pairs; in the last the third knock is his
 *   bars 13-20  HE KNOCKS FIRST   the dead knock in dotted eighths and the living answer with one knock on the one;
 *                                 the bass moves five steps, then three, under a likembe that stays put
 *   bars 21-32  SEANCE            the short version as a record: its wake heard through the lid; cut into sixteenths
 *                                 and dealt out again in 3+3+2; its seven-knock scale stacked into chords and smeared,
 *                                 answered by the scale backwards; the short version's laugh
 *   bars 33-36  ODILE             the floor: four bars of the record as found, no drums; her laugh stutters
 *   bars 37-44  FOURTEEN STEPS    the pallbearers' whole bars, then half bars, then the climb doubles an octave up,
 *                                 one step a beat; two stabs
 *   bar  45-46  KNOCK             silence and the door; dead and living knock at each other faster and faster;
 *                                 silence; his knock is the drop
 *   bars 47-54  KNOCKS BACK       the record's hot shout; the knocks as found, as a triad, as the scale, and at last
 *                                 the living climb while the dead climb down backwards
 *   bars 55-62  THE ARGUMENT      three against four: the dead are the kick, on dotted quarters; the spring answers
 *                                 between them, so the bass line passes between the living and the dead
 *   bars 63-66  LAST SHOUT        once more with the scale both ways; then the last call, and no answer
 *   bars 67-68  CLOSED CASKET     the record's last hit, the laser, the coins; one knock from inside, late; the door
 *
 *   node the-deacon-is-dead/full/build.ts [TAG]     (needs FFmpeg; writes the project and full/genealogy.json, renders into work/TAG)
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatPosition } from '../../src/timing/musical-time.ts';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '..'), REPO = resolve(ROOT, '..');
const CLI = join(REPO, 'bin', 'daemonv12.js'), WORK = join(ROOT, 'work');
export const TITLE = 'THE DEACON KNOCKS BACK (FULL WAKE)', SLUG = 'the-deacon-knocks-back-full-wake';
const BPM = 96, PPQ = 960, WHOLE = 4 * PPQ, BEAT_S = Math.round(60e6 / BPM) / 1e6, TICK_S = BEAT_S / PPQ, BARS = 69, SECONDS = 172;
const dig = JSON.parse(readFileSync(join(HERE, 'chops.json'), 'utf8'));
const chops: Record<string, { gen: number; source: string; offsetSeconds: number; endSeconds: number; leadSeconds: number }> = dig.chops;
/** gen 1 onto this grid: two of its seven steps down. gen 2 and gen 3 are already here. */
const R = +(0.51271 / BEAT_S).toFixed(6);
const base = (chop: string) => (chops[chop]!.gen === 1 ? R : 1);
const st = (k: number, b = R) => +(b * 2 ** (k / 7)).toFixed(6);
const REPLY = st(-4);   // his knock from inside, on the tonic an octave under the bass
const KNOCK_UP = 7;     // Iggy's knocks an octave above the record (the short version's R1)

// ------------------------------------------------------------------------------------------------ placing chops
type Track = 'lik' | 'knock' | 'reply' | 'dead' | 'kick' | 'snare' | 'hat' | 'bass' | 'whoop' | 'odile' | 'loop' | 'door' | 'ghost' | 'cut' | 'other';
interface Ev { track: Track; beat: number; chop: string; rate?: number; vel?: number; gate?: number; ms?: number; attack?: number; release?: number; choke?: string; glide?: [number, number] }
const events: Ev[] = [];
const put = (track: Track, beat: number, chop: string, o: Omit<Ev, 'track' | 'beat' | 'chop'> = {}) => { if (!chops[chop]) throw new Error(`no chop ${chop}`); events.push({ track, beat, chop, ...o }); };
let seed = 1972;
const rnd = () => { let t = (seed = (seed + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const jitter = (ms: number) => (rnd() * 2 - 1) * ms;
const sw = (beat: number) => { const s = beat * 4, k = Math.round(s); return Math.abs(s - k) < 1e-9 && ((k % 2) + 2) % 2 === 1 ? beat + 0.02 : beat; };
function note(e: Ev) {
  const c = chops[e.chop]!, rate = e.rate ?? base(e.chop);
  const tick = Math.max(0, Math.round(sw(e.beat) * PPQ - c.leadSeconds / rate / TICK_S + (e.ms ?? 0) / 1000 / TICK_S));
  const n: Record<string, unknown> = { tick, velocity: +Math.min(1, Math.max(0.01, e.vel ?? 1)).toFixed(3) };
  if (Math.abs(rate - 1) > 1e-9) n.playbackRate = rate;
  if (c.offsetSeconds > 0) n.offsetSeconds = c.offsetSeconds;
  n.endSeconds = c.endSeconds;
  if (e.gate !== undefined) n.gate = `${Math.max(1, Math.round(e.gate * PPQ))}/${WHOLE}`;
  n.envelope = { attackSeconds: e.attack ?? 0.002, releaseSeconds: e.release ?? 0.012 };
  if (e.choke) n.chokeGroup = e.choke;
  if (e.glide) n.glide = { to: e.glide[0], duration: `${Math.max(1, Math.round(e.glide[1] * PPQ))}/${WHOLE}` };
  return n;
}

// ------------------------------------------------------------------------------------------------ the players
const bar = (n: number) => 4 * (n - 1), S = (slot: number) => slot / 4;
const drum = { attack: 0.0005, release: 0.03 };
const kick = (b: number, v: number, ms = 0) => put('kick', b, 'kick', { ...drum, gate: 0.4, vel: v, ms: ms + jitter(2) });
const snare = (b: number, v: number, ms = 14) => put('snare', b, 'snare', { ...drum, gate: 0.62, release: 0.06, vel: v, ms: ms + jitter(3) });
const ghostNote = (b: number, v = 0.5) => put('snare', b, 'tap', { ...drum, gate: 0.2, vel: v, ms: 8 + jitter(3) });
const hats = (b0: number, slots: number, vel = 1, from = 0) => { for (let s = from; s < slots; s++) put('hat', b0 + S(s), 'coins', { attack: 0.0005, release: 0.01, gate: 0.18, vel: (s % 4 === 2 ? 0.95 : s % 2 ? 0.55 : 0.7) * vel + jitter(0.06), ms: jitter(3) }); };
/** Iggy, the living: crisp knocks an octave above the record. */
const iggy = (b: number, k = 0, v = 1, which = 'knock-1', gate = 0.45) => put('knock', b, which, { rate: st(k + KNOCK_UP), gate, release: 0.04, vel: v });
const knocks = (b0: number, steps: [number, number, number] = [0, 0, 0], v = 1) => (['knock-1', 'knock-2', 'knock-3']).forEach((c, i) => iggy(b0 + 2.5 + 0.5 * i, steps[i], v, c));
/** The Deacon: the reply (on the tonic, an octave under the bass) and his knocks as recorded. */
const reply = (b: number, v = 1, gate = 1) => put('reply', b, 'inside-3', { rate: REPLY, gate, release: 0.2, vel: v, choke: 'reply' });
// Refinement R1: his knocks are knocks, not tones: gate 0.7 -> 0.45 beats (the arrangement pass had 57 % of
// HE KNOCKS FIRST's energy below 120 Hz).
// Refinement R3: they play on their own lightly driven track (the reply's 18 dB saturation flattened every level change).
const deacon = (b: number, i: 1 | 2 | 3, v = 1) => put('dead', b, `inside-${i}`, { gate: 0.45, release: 0.06, vel: v });
/** The spring bass, one bar, on a root (steps). */
const bassBar = (b0: number, knockBar: boolean, replied: boolean, root = 0) => {
  const sp = (slot: number, k: number, gate: number, v: number, glide?: [number, number]) =>
    put('bass', b0 + S(slot), 'boing-0', { rate: st(k + root), gate, vel: v, choke: 'bass', attack: 0.002, release: 0.05, ms: -4, ...(glide ? { glide: [st(glide[0] + root), glide[1]] as [number, number] } : {}) });
  if (!replied) sp(0, 0, 0.7, 1);
  if (!knockBar) { sp(6, 4, 1.1, 0.95); sp(11, 2, 0.35, 0.72); sp(14, 6, 0.5, 0.85, [7, 0.25]); }
  else sp(6, 4, 1.05, 0.95, [3, 0.6]);
};
/** The one-shot groove under a bar pair (A, then the knock bar B). */
function groove(A: number, o: { replied: boolean; ghosts: boolean; root?: number; hatVel?: number; likB?: number; kickB?: boolean }) {
  const B = A + 4;
  put('lik', A, 'thumb-a', { gate: 4, choke: 'lik', release: 0.015 });
  put('lik', B, 'thumb-b', { gate: o.likB ?? 2.45, choke: 'lik', release: 0.04 });
  if (!o.replied) kick(A, 1);
  kick(A + S(3), 0.45); kick(A + S(10), 0.92); kick(A + S(14), 0.4); kick(B, 1); kick(B + S(7), 0.7);
  snare(A + 1, 0.95); snare(A + 3, 0.95); snare(B + 1, 0.95);
  if (o.ghosts) { ghostNote(A + S(7)); ghostNote(A + S(9), 0.4); ghostNote(A + S(15), 0.45); ghostNote(B + S(6), 0.4); }
  hats(A, 16, o.hatVel ?? 1); hats(B, Math.floor((o.likB ?? 2.45) * 4) + 1, o.hatVel ?? 1);
  bassBar(A, false, o.replied, o.root ?? 0); bassBar(B, true, false, o.root ?? 0);
}
const SECTIONS: [string, number][] = [];
const section = (name: string, startBar: number) => SECTIONS.push([name, bar(startBar)]);

// ------------------------------------------------------------------------------------------------ bars 1-2, VIEWING (the short version's opening)
section('viewing', 1);
put('door', 0, 'door-lid', { rate: R / 2, gate: 2.3, attack: 0.05, release: 0.25, vel: 0.9 });
knocks(0);
reply(4);
put('bass', 5.5, 'boing-0', { rate: R, gate: 0.9, release: 0.1, vel: 0.8, choke: 'bass' });
put('lik', 6.25, 'lik-pick', { gate: 1.75, choke: 'lik', release: 0.02 });

// ------------------------------------------------------------------------------------------------ bars 3-4, THUMB
section('thumb', 3);
put('lik', bar(3), 'thumb-a', { gate: 4, choke: 'lik', release: 0.015 });
put('lik', bar(4), 'thumb-b', { gate: 2.45, choke: 'lik', release: 0.04 });
knocks(bar(4));
put('other', bar(5), 'g3-reply-rev', { gate: 2.2, attack: 0.02, release: 0.004, vel: 0.9 });   // an inhale from the other side, into the reply

// ------------------------------------------------------------------------------------------------ bars 5-12, WAKE
section('wake', 5);
for (let p = 0; p < 4; p++) {
  const A = bar(5) + 8 * p, B = A + 4;
  reply(A, 0.95);
  groove(A, { replied: true, ghosts: p > 0, hatVel: p ? 1 : 0.8 });
  if (p < 3) knocks(B);
  else { iggy(B + 2.5, 0, 1, 'knock-1'); iggy(B + 3, 0, 1, 'knock-2'); deacon(B + 3.5, 3); }   // the third knock is his
  if (p > 0) put('whoop', A + S(9), 'whoop', { gate: 0.4, vel: 0.85, ms: -3 });
  if (p === 1) put('odile', A + S(7), 'hihi', { gate: 0.6, vel: 0.95, release: 0.04 });
  if (p === 2) put('odile', A + S(6), 'ooo', { gate: 0.9, vel: 0.95, release: 0.06 });
  if (p === 3) put('odile', A + S(7), 'laugh', { gate: 0.5, vel: 0.95, release: 0.02 });
}

// ------------------------------------------------------------------------------------------------ bars 13-20, HE KNOCKS FIRST
section('he-knocks-first', 13);
for (let p = 0; p < 4; p++) {
  const A = bar(13) + 8 * p, B = A + 4, root = p < 2 ? 5 : 3;
  if (p === 0) reply(A, 0.95);
  else { iggy(A, 0, 1, 'knock-3'); }                       // the living answer: one knock on the one
  groove(A, { replied: p === 0, ghosts: true, root, likB: 2 });
  deacon(B + 2, 1, 0.95); deacon(B + 2.75, 2, 0.95); deacon(B + 3.5, 3, 1);   // dotted eighths, from inside
  put('odile', A + S(7), ['laugh', 'ooo', 'hihi', 'scream'][p]!, { gate: p === 1 ? 0.9 : 0.6, vel: 0.95, release: 0.04 });
  if (p % 2) put('whoop', A + S(9), 'whoop', { gate: 0.4, vel: 0.85, ms: -3 });
}

// ------------------------------------------------------------------------------------------------ bars 21-32, SEANCE (the short version as a record)
section('seance', 21);
iggy(bar(21), 0, 1, 'knock-3'); kick(bar(21), 1);          // the living answer the last dead knocks
// bars 21-24: its wake (pair 2: reply, groove, Odile, knocks) heard through the coffin lid
put('ghost', bar(21), 'g2-groove', { gate: 8, choke: 'ghost', release: 0.02 });
put('ghost', bar(23), 'g2-groove', { gate: 8, choke: 'ghost', release: 0.02, vel: 1 });
hats(bar(21), 16, 0.45); hats(bar(22), 16, 0.5); hats(bar(23), 16, 0.55); hats(bar(24), 10, 0.6);
put('other', bar(25), 'g3-reply-rev', { gate: 2.2, attack: 0.02, release: 0.004, vel: 0.85 });
// bars 25-28: cut into sixteenths and dealt out again in 3+3+2
const DEAL: number[][] = [
  [0, 1, 2, 0, 1, 2, 4, 5, 8, 9, 10, 0, 1, 12, 13, 14],
  [0, 1, 2, 0, 1, 2, 4, 5, 14, 15, 14, 15, 12, 12, 12, 12],
  [0, 1, 2, 0, 1, 2, 4, 5, 8, 9, 10, 0, 1, 12, 13, 14],
  [0, 1, 2, 3, 0, 1, 2, 3, 4, 5],                           // then out for the knocks
];
DEAL.forEach((row, i) => row.forEach((k, s) => put('cut', bar(25 + i) + S(s), `g2a-${k}`, { gate: 0.25, choke: 'cut', attack: 0.001, release: 0.006 })));
knocks(bar(28));
// bars 29-32: its seven-knock scale stacked into neutral chords and smeared (each voice a different speed),
// answered by the scale backwards landing on the next one; half time underneath
[0, 5, 3, 6].forEach((root, i) => {
  const b0 = bar(29 + i);
  reply(b0, i ? 0.85 : 1, 1);
  if (i) kick(b0, 0.8);
  snare(b0 + 2, 1); hats(b0, 16, 0.6);
  for (const k of [0, 2, 4]) put('cut', b0 + 0.25, 'g2-scale', { rate: st(root + k, 1), gate: 1.72, release: 0.02, vel: k ? 0.75 : 0.95 });
  if (i < 3) put('other', b0 + 4, 'g3-scale-rev', { rate: st(root, 1), attack: 0.01, release: 0.004, vel: 0.8 });
  put('bass', b0, 'boing-0', { rate: st(root), gate: 1.6, vel: 0.95, choke: 'bass', release: 0.08 });
  put('bass', b0 + 2.5, 'boing-0', { rate: st(root + 4), gate: 1.1, vel: 0.85, choke: 'bass', release: 0.08, glide: [st(root + 3), 1] });
});
put('cut', bar(32) + 2, 'g2-laugh', { gate: 2, release: 0.03, vel: 1 });   // the short version's laugh, sampled

// ------------------------------------------------------------------------------------------------ bars 33-36, ODILE (the floor: the record as found, no drums)
section('odile', 33);
put('loop', bar(33), 'odile-ab', { gate: 8, choke: 'loop', release: 0.03 });
put('loop', bar(35), 'odile-cd', { gate: 6, choke: 'loop', release: 0.03 });
for (const [b, g] of [[2, 0.5], [2.5, 0.5], [3, 1]] as [number, number][]) put('odile', bar(36) + b, 'laugh', { gate: g, vel: 1, choke: 'laugh', release: 0.02 });
hats(bar(36) + 2, 8, 0.5);

// ------------------------------------------------------------------------------------------------ bars 37-44, FOURTEEN STEPS
section('fourteen-steps', 37);
for (let i = 0; i < 4; i++) {
  const b0 = bar(37 + i);
  put('loop', b0, `stair-${i + 1}`, { gate: 4, choke: 'loop', release: 0.015 });
  for (let q = 0; q < 4; q++) if (i >= 2 || q % 2 === 0) kick(b0 + q, 0.7 + 0.05 * i);
  hats(b0, 16, 0.5 + 0.1 * i);
}
// half bars (steps 5 6 7), then an octave up one step a beat (rate doubled: each two-beat chop lasts one beat)
const climb: [number, string, number, number][] = [[160, 'step-5', 0, 2], [162, 'step-6', 0, 2], [164, 'step-7', 0, 2]];
for (let i = 0; i < 7; i++) climb.push([166 + i, `step-${i + 1}`, 7, 1]);
for (const [b, c, k, g] of climb) put('loop', b, c, { rate: st(k), gate: g, choke: 'loop', release: 0.015 });
for (let q = 160; q < 173; q++) { kick(q, 0.75 + 0.25 * (q - 160) / 12); if (q % 2) snare(q, 0.8 + 0.15 * (q - 160) / 12, 10); hats(q, 4, 0.6 + 0.4 * (q - 160) / 12); }
for (const s of [1, 2, 3]) ghostNote(171 + S(s), 0.35 + 0.15 * s);
for (const [b, c] of [[173, 'stab-1'], [173.75, 'stab-2']] as [number, string][]) { put('loop', b, c, { gate: c === 'stab-1' ? 0.7 : 1.2, release: 0.12 }); kick(b, 1); }

// ------------------------------------------------------------------------------------------------ bars 45-46, KNOCK: faster and faster, then his knock is the drop
section('knock', 45);
put('door', bar(45) + 0.25, 'door-knock', { rate: R / 2, gate: 1.9, attack: 0.1, release: 0.3, vel: 0.85 });
const EXCHANGE: [number, 'dead' | 'living'][] = [[178.5, 'dead'], [179.5, 'living'], [180.25, 'dead'], [180.75, 'living'], [181.25, 'dead'], [181.5, 'living'], [181.75, 'dead'], [182, 'living'], [182.25, 'dead'], [182.5, 'living']];
EXCHANGE.forEach(([b, who], i) => (who === 'dead' ? deacon(b, ((i / 2) % 2 ? 2 : 1) as 1 | 2, 0.9 + 0.02 * i) : iggy(b, 0, 0.9 + 0.02 * i, i % 4 === 1 ? 'knock-1' : 'knock-2', 0.35)));

// ------------------------------------------------------------------------------------------------ bars 47-54, KNOCKS BACK
section('knocks-back', 47);
deacon(bar(47), 3);
for (let p = 0; p < 4; p++) {
  const A = bar(47) + 8 * p, B = A + 4;
  reply(A, 1);
  put('loop', A, 'shout-a', { gate: 4, choke: 'loop', release: 0.015 });
  if (p === 0) put('loop', B, 'shout-bk', { gate: 4, choke: 'loop', release: 0.04 });
  else put('loop', B, 'shout-b', { gate: p >= 2 ? 2.2 : 2.45, choke: 'loop', release: 0.04 });
  if (p === 1) knocks(B, [0, 2, 4]);
  if (p >= 2) for (let k = 0; k < 7; k++) iggy(B + 2.25 + S(k), k, 0.85 + 0.02 * k, ['knock-1', 'knock-2', 'knock-3'][k % 3]!, 0.3);
  if (p === 3) put('other', B + 4, 'g3-scale-rev', { attack: 0.01, release: 0.004, vel: 0.9 });   // the dead climb down as the living climb up
  kick(A + S(10), 0.9); kick(A + S(14), 0.45); kick(B, 1); kick(B + S(7), 0.75);
  snare(A + 1, 1); snare(A + 3, 1); snare(B + 1, 1); ghostNote(A + S(7), 0.5); ghostNote(A + S(15), 0.5);
  hats(A, 16); hats(B, p >= 2 ? 9 : 10);
}

// ------------------------------------------------------------------------------------------------ bars 55-62, THE ARGUMENT: three against four
section('argument', 55);
const ARG = bar(55), ARG_END = bar(63);
// the dead are the kick, on dotted quarters; the spring answers a dotted eighth later, so the line passes between them
const LINE = [4, 2, 6, 3, 4, 2, 7, 6];
let n = 0;
for (let b = ARG; b < ARG_END - 2; b += 1.5, n++) {
  const root = b >= bar(59) && b < bar(61) ? 5 : 0;
  // Refinement R2: shorter and softer between accents (was 0.55 beats, 0.86); R3: the unaccented ones on the dead track
  if (n % 4 === 0) reply(b, 1, 0.4); else put('dead', b, 'inside-3', { rate: REPLY, gate: 0.4, release: 0.2, vel: 0.78 });
  const k = LINE[n % LINE.length]!;
  put('bass', b + 0.75, 'boing-0', { rate: st(k + root), gate: 0.6, vel: 0.9, choke: 'bass', ms: -4, ...(n % 4 === 3 ? { glide: [st(k + root - 1), 0.4] as [number, number] } : {}) });
}
for (let i = 0; i < 8; i++) {
  const b0 = ARG + 4 * i, last = i === 7, knockBar = i === 3 || last;
  put('lik', b0, knockBar ? 'thumb-b' : 'thumb-a', { gate: knockBar ? 2.45 : 4, choke: 'lik', release: 0.02 });
  snare(b0 + 1, 1); if (!knockBar) snare(b0 + 3, 1);
  ghostNote(b0 + S(7), 0.45); if (!knockBar) ghostNote(b0 + S(15), 0.45);
  hats(b0, knockBar ? 10 : 16);
  if (knockBar) knocks(b0, last ? [0, 0, 0] : [4, 2, 0]);
  if (i === 1 || i === 5) put('odile', b0 + S(7), 'scream', { gate: 0.9, vel: 0.95, release: 0.05 });
  if (i === 2 || i === 6) put('whoop', b0 + S(9), 'whoop', { gate: 0.4, vel: 0.9, ms: -3 });
}

// ------------------------------------------------------------------------------------------------ bars 63-66, LAST SHOUT: the last call goes unanswered
section('last-shout', 63);
for (let p = 0; p < 2; p++) {
  const A = bar(63) + 8 * p, B = A + 4;
  reply(A, 1);
  put('loop', A, 'shout-a', { gate: 4, choke: 'loop', release: 0.015 });
  put('loop', B, 'shout-b', { gate: 2.2, choke: 'loop', release: 0.04 });
  for (let k = 0; k < 7; k++) iggy(B + 2.25 + S(k), k, 0.85 + 0.02 * k, ['knock-1', 'knock-2', 'knock-3'][k % 3]!, 0.3);
  if (p === 0) put('other', B + 4, 'g3-scale-rev', { attack: 0.01, release: 0.004, vel: 0.9 });
  kick(A + S(10), 0.9); kick(A + S(14), 0.45); kick(B, 1); kick(B + S(7), 0.75);
  snare(A + 1, 1); snare(A + 3, 1); snare(B + 1, 1); ghostNote(A + S(7), 0.5); ghostNote(A + S(15), 0.5);
  hats(A, 16); hats(B, 9);
}

// ------------------------------------------------------------------------------------------------ bars 67-68, CLOSED CASKET (the short version's ending, now a late answer)
section('closed-casket', 67);
const END = bar(67);
put('loop', END, 'out', { gate: 4, choke: 'loop', release: 0.5 });
put('reply', END + 4, 'inside-out', { rate: REPLY, gate: 1.5, release: 0.3, vel: 0.9 });
put('door', END + 4.75, 'door-out', { gate: 2.6, attack: 0.05, release: 0.4, vel: 0.85 });

// ------------------------------------------------------------------------------------------------ the project
const m = { numerator: 4, denominator: 4 };
const sat = (driveDb: number, mix: number) => ({ type: 'saturation', driveDb, mix });
const comp = (thresholdDb: number, ratio: number, attackMs: number, releaseMs: number, makeupGainDb: number) => ({ type: 'compressor', thresholdDb, ratio, attackMs, releaseMs, makeupGainDb });
const hp = (f: number) => ({ type: 'highpass', frequencyHz: f }), lp = (f: number) => ({ type: 'lowpass', frequencyHz: f });
const verb = (roomSize: number, decaySeconds: number, wet: number) => ({ type: 'reverb', roomSize, decaySeconds, wet });
const GEN1 = 'assets/record/the-velvet-hearse--the-deacon-is-dead.wav', GEN2 = 'assets/short/the-deacon-knocks-back.wav', GEN3 = 'assets/full/the-other-side.wav';
const TRACKS: Record<Track, { description: string; sample: string; gainDb: number; pan?: number; effects: object[] }> = {
  lik: { description: "gen 1: Lucius's likembe alone, the bed.", sample: GEN1, gainDb: 2, pan: 0.15, effects: [hp(220), lp(8000), sat(6, 0.3)] },
  knock: { description: "gen 1: Iggy's knocks on the lid, an octave up; as calls, as a triad, as the seven-step scale, in the exchange.", sample: GEN1, gainDb: 3, effects: [hp(120), sat(15, 0.55), comp(-18, 3, 3, 90, 2), verb(0.3, 0.6, 0.08)] },
  reply: { description: 'gen 1: the Deacon from inside: the reply (rate 0.552, the tonic an octave down), his knocks as recorded, the dead kick of the argument.', sample: GEN1, gainDb: -3, effects: [lp(4000), sat(18, 0.6), comp(-16, 3, 8, 160, 2)] },
  dead: { description: 'gen 1: the Deacon\'s knocks from inside as recorded, and the argument\'s dead kick between its accents; lightly driven (R3).', sample: GEN1, gainDb: -2, effects: [hp(40), lp(3500), sat(6, 0.3), comp(-18, 3, 6, 120, 1)] },
  kick: { description: 'gen 1: the urn, one palm thud.', sample: GEN1, gainDb: 1, effects: [hp(32), sat(8, 0.4), comp(-16, 4, 5, 80, 3)] },
  snare: { description: 'gen 1: the bead slap and tap, laid back.', sample: GEN1, gainDb: 6, pan: 0.05, effects: [hp(140), sat(8, 0.4), comp(-18, 3, 4, 110, 2), verb(0.35, 0.8, 0.1)] },
  hat: { description: 'gen 1: one shake of the collection plate.', sample: GEN1, gainDb: 11, pan: -0.25, effects: [hp(1400), lp(13000)] },
  bass: { description: 'gen 1: the hearse spring tried once on A1, played in seven steps with glides.', sample: GEN1, gainDb: 0, effects: [lp(2600), sat(9, 0.4), comp(-18, 3, 8, 140, 2)] },
  whoop: { description: "gen 1: the urn's whoop.", sample: GEN1, gainDb: 8, pan: 0.2, effects: [hp(90)] },
  odile: { description: "gen 1: Odile's friction drum.", sample: GEN1, gainDb: 6, pan: -0.2, effects: [hp(200), lp(5000), { type: 'delay', timeMs: 469, wet: 0.16 }, verb(0.5, 1.4, 0.14)] },
  loop: { description: 'gen 1: the record as found: Odile, the stairs whole, halved and doubled, the two stabs, the hot shout, the last bar.', sample: GEN1, gainDb: -1, effects: [hp(55), sat(4, 0.25), comp(-18, 2.5, 12, 120, 2)] },
  door: { description: 'gen 1: the door opening, lifting, closing.', sample: GEN1, gainDb: 8, pan: -0.35, effects: [hp(45), verb(0.7, 2.2, 0.22)] },
  ghost: { description: 'gen 2: the short version\'s wake heard through the coffin lid.', sample: GEN2, gainDb: -6, effects: [hp(60), lp(1100), verb(0.55, 1.3, 0.2)] },
  cut: { description: 'gen 2: the short version cut into sixteenths and dealt out again; its seven-knock scale stacked; its laugh.', sample: GEN2, gainDb: -6, effects: [hp(35), sat(5, 0.3), comp(-18, 2.5, 4, 100, 1)] },
  other: { description: 'gen 3: the other side: the reply, the knocks and the scale from the short version, backwards.', sample: GEN3, gainDb: -4, pan: 0.1, effects: [hp(60), verb(0.6, 1.8, 0.22)] },
};

export function project() {
  return {
    formatVersion: 1, title: TITLE,
    description: 'The definitive Velvet Hearse production: THE VELVET HEARSE, "The Deacon Is Dead" (1972, imaginary), the approved short version THE DEACON KNOCKS BACK sampled as a second record, and fragments of it reversed. Seven equal steps, 96 BPM; a conversation between the living and the dead.',
    bpm: BPM, timeSignature: '4/4', bars: BARS, seed: 1972,   // no key: seven equal steps have no 12-tone key
    render: { duration: { seconds: SECONDS }, tail: 'auto' },
    // as the short version (with its R3): 0.1 ms attack for the bead snare's spikes, tanh at full mix as the ceiling
    master: { gainDb: 0, effects: [hp(24), comp(-12, 2.5, 0.1, 90, 6.5), sat(0, 1)] },
    tracks: (Object.keys(TRACKS) as Track[]).map(id => {
      const t = TRACKS[id], notes = events.filter(e => e.track === id).map(note).sort((a, b) => (a.tick as number) - (b.tick as number));
      for (const e of events.filter(e => e.track === id)) if (chops[e.chop]!.source !== t.sample) throw new Error(`${e.chop} is not on ${id}'s source`);
      return { id, description: t.description, instrument: { type: 'sampler', sample: t.sample }, mix: { gainDb: t.gainDb, ...(t.pan ? { pan: t.pan } : {}) }, effects: t.effects,
        clips: [{ bar: 1, pattern: 'song' }], patterns: [{ id: 'song', bars: BARS, notes: notes.map(({ tick, ...rest }) => ({ start: formatPosition(tick as number, m), ...rest })) }] };
    }),
  };
}

/** Every file's parents and hash, and every chop the full wake plays: source, generation, tracks, rates, events. */
function genealogy() {
  const sha = (p: string) => createHash('sha256').update(readFileSync(join(ROOT, p))).digest('hex');
  const used: Record<string, { gen: number; source: string; tracks: string[]; rates: number[]; events: number; firstBar: number }> = {};
  for (const e of events) {
    const c = chops[e.chop]!, u = (used[e.chop] ??= { gen: c.gen, source: c.source, tracks: [], rates: [], events: 0, firstBar: Math.floor(e.beat / 4) + 1 });
    const rate = +(e.rate ?? base(e.chop)).toFixed(6);
    if (!u.tracks.includes(e.track)) u.tracks.push(e.track);
    if (!u.rates.includes(rate)) u.rates.push(rate);
    u.events++;
  }
  const byGen = [1, 2, 3].map(g => ({ gen: g, chops: Object.values(used).filter(u => u.gen === g).length, events: Object.values(used).filter(u => u.gen === g).reduce((a, u) => a + u.events, 0) }));
  return {
    schema: 'daemonv12.the-deacon-is-dead.genealogy/1', title: TITLE,
    files: [
      { file: 'source/compose.ts', gen: 0, role: 'the composer script', sha256: sha('source/compose.ts') },
      { file: 'source/the-deacon-is-dead.score.json', gen: 0, parents: ['source/compose.ts'], role: 'the rack score', sha256: sha('source/the-deacon-is-dead.score.json') },
      { file: GEN1, gen: 1, parents: ['source/the-deacon-is-dead.score.json'], role: 'THE VELVET HEARSE, "The Deacon Is Dead": the rack print', sha256: sha(GEN1) },
      { file: 'the-deacon-knocks-back.json', gen: 2, parents: [GEN1, 'production/chops.json'], role: 'the approved short version\'s project', sha256: sha('the-deacon-knocks-back.json') },
      { file: 'production/the-deacon-knocks-back.wav', gen: 2, parents: ['the-deacon-knocks-back.json', GEN1], role: 'THE DEACON KNOCKS BACK, the approved short version (preserved byte for byte)', sha256: sha('production/the-deacon-knocks-back.wav') },
      { file: GEN2, gen: 2, parents: ['production/the-deacon-knocks-back.wav'], role: 'a byte-identical copy of the approved master, where the engine reads samples; sampled here as a second record', sha256: sha(GEN2) },
      { file: GEN3, gen: 3, parents: [GEN2], role: 'THE OTHER SIDE: three gen-2 fragments, frames reversed bit-exact (full/dig.py)', sha256: sha(GEN3), pieces: Object.fromEntries(Object.entries(chops).filter(([, c]) => c.gen === 3).map(([k, c]) => [k, (c as unknown as { derivedFrom: object }).derivedFrom])) },
      { file: `${SLUG}.json`, gen: 4, parents: [GEN1, GEN2, GEN3, 'full/chops.json'], role: 'this project' },
    ],
    summary: { chops: Object.keys(used).length, events: events.length, byGeneration: byGen },
    chops: used,
  };
}

// ------------------------------------------------------------------------------------------------ build
if (import.meta.url === `file://${process.argv[1]}`) {
  const file = join(ROOT, `${SLUG}.json`);
  writeFileSync(file, JSON.stringify(project(), null, 1) + '\n');
  writeFileSync(join(HERE, 'genealogy.json'), JSON.stringify(genealogy(), null, 1) + '\n');
  writeFileSync(join(HERE, 'sections.json'), JSON.stringify(SECTIONS) + '\n');
  if (process.argv[2] === '--project-only') process.exit(0);
  const tag = process.argv[2] ?? 'full', out = join(WORK, tag);
  rmSync(out, { recursive: true, force: true });
  const t0 = Date.now();
  const res = JSON.parse(execFileSync(process.execPath, [CLI, 'render', file, '--out-dir', out, '--stems', '--format', 'wav', '--reuse-voices', '--json'], { encoding: 'utf8', maxBuffer: 1 << 28 }));
  if (!res.ok) throw new Error(JSON.stringify(res.errors ?? res, null, 1));
  const manifest = JSON.parse(readFileSync(join(out, `${SLUG}.render.json`), 'utf8'));
  const an = JSON.parse(execFileSync(process.execPath, [CLI, 'analyze', join(out, `${SLUG}.wav`), '--json'], { encoding: 'utf8' })).analysis;
  console.log(`${TITLE}: ${relative(REPO, out)} in ${((Date.now() - t0) / 1000).toFixed(1)} s; ${an.durationSeconds ?? ''} s, ${an.integratedLufs} LUFS, ${an.truePeakDbfs} dBTP, LRA ${an.loudnessRangeLu}`);
  const prod = manifest.production ?? {};
  console.log(`master clipped ${prod.master?.clippedSamples} pre-clip ${prod.master?.preClipPeakDbfs}; tracks clipped: ${(prod.tracks ?? []).filter((t: { clippedSamples: number }) => t.clippedSamples).map((t: { trackId: string }) => t.trackId).join(',') || 'none'}`);
  console.log(`events ${events.length}; taps ${manifest.samples?.reuse?.interpolationTaps}`);
  if (res.warnings?.length) console.log('warnings:', JSON.stringify(res.warnings).slice(0, 600));
}
