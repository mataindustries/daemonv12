/**
 * AFTERIMAGE//PULSE · DaemonV12 Sound Lab 03 · a 26-bar musical identity proof.
 * E major, 136 BPM, 2-step garage swing (per section), 26 bars + 2.0 s of ring = 47.9 s.
 *
 * The hook is a chain of "pulse pairs": a short pickup that leaps up a sixth into a held note, on a 2+3 sixteenth
 * grouping (onsets 0-2 | 5-7 | 10-12), three times per bar, each leap a step lower (G#-E, F#-D#, E-C#), answered by a
 * bar that climbs and lets go. Its answer bar has three endings: it settles (B), it yearns (up to G#), and only in the
 * payoff it resolves (D# -> E, the first tonic in the record).
 *
 * The "afterimage" is a music-box canon a dotted eighth behind whatever carries the hook. It is a texture in the
 * opening, a ghost in the tense passage, a memory at tempo under the slow choir, and in the last bar it finishes the
 * phrase alone after the band has stopped.
 *
 *   I    bars 1-4    image        the hook on an analog pluck, the music box behind it; kick and bass from bar 3
 *   II   bars 5-12   pulse        2-step groove; the hook on THRONE//VOLT, swooping into each held note; Living Bass talks
 *                                 in the holes; the second statement adds the full canon and open hats
 *   III  bars 13-16  glitch       E minor: Am - B7 - Cmaj7#11 - D7. Impossible Voice sings the hook as chops with
 *                                 impossible vowels; the bass answers at the machine end with ratchet dives; the beat
 *                                 breaks into half time; the pulse quickens and the band falls away one layer at a time
 *   IV   bars 17-20  afterimage   no drums: a hand-drum heartbeat. HEAVEN//MASS sings the hook at half speed, intimate,
 *                                 F#m9 - Amaj9 - C#m7, while the music box remembers it at tempo. The harmony sinks a
 *                                 semitone into C major (bass and tenor down, alto and soprano up to G) and the choir
 *                                 blooms from a few singers to all of them
 *   V    bars 21-26  payoff       C -> A: everything lifts a semitone. The lead an octave up at blaze, the choir singing
 *                                 the hook's long notes, the bass and kick locked to the pulse pairs; the answer finally
 *                                 resolves to E (bar 24). The hook starts again, the band stops on its first pair, and the
 *                                 music box finishes the phrase alone
 *
 *   node experiments/afterimage-pulse-001/compose.ts [--candidate]     writes source/ (scores, project, kits, map)
 *
 * Times are beats (quarter notes) from the start of bar 1. A bar is 4 beats; s = sixteenths within a bar.
 * --candidate reproduces the composition exactly as measured before the one bounded QA/fix pass (README).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const CANDIDATE = process.argv.includes('--candidate') || process.env.AFTERIMAGE_CANDIDATE === '1';
export const BPM = 136, BARS = 26, END = BARS * 4, TAIL_SECONDS = 2, KEY = 'E major';
export const BEAT_SECONDS = 60 / BPM;
const SCHEMA = 'daemonv12.signature-rack.score/1';

// ================================================================================================ helpers
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** Engine position (960 PPQ, 4/4) of an absolute beat. */
export function pos(beat: number): string {
  const tick = Math.round(beat * 960), bar = Math.floor(tick / 3840) + 1, inBar = tick % 3840, b = Math.floor(inBar / 960) + 1, off = inBar % 960;
  if (!off) return `${bar}:${b}`;
  const g = gcd(off, 3840);
  return `${bar}:${b}+${off / g}/${3840 / g}`;
}
export function dur(beats: number): string { const t = Math.max(1, Math.round(beats * 960)), g = gcd(t, 3840); return `${t / g}/${3840 / g}`; }
const ms = (m: number) => m / 1000 / BEAT_SECONDS;
const semis = (n: number) => r6(Math.pow(2, n / 12));
/** Deterministic variation (no Math.random): a fixed hash of an index, in [-1, 1). */
const hash = (i: number) => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NN: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export function midi(n: string): number { const m = /^([A-G][#b]?)(-?\d)$/.exec(n); if (!m) throw new Error(`bad pitch ${n}`); return 12 * (Number(m[2]) + 1) + NN[m[1]!]!; }
const nm = (m: number) => `${SHARP[m % 12]}${Math.floor(m / 12) - 1}`;
const tr = (n: string, k: number) => (k ? nm(midi(n) + k) : n);

/** Bar n, sixteenth s (s may exceed 16), unswung. */
export const at = (bar: number, s = 0) => 4 * (bar - 1) + s / 4;
/** Swing per section: odd sixteenths are delayed. 0.5 is straight. */
const SWING: [number, number][] = [[0, 0.55], [16, 0.57], [48, 0.6], [64, 0.5], [80, 0.57]];
const swingAt = (beat: number) => { let s = SWING[0]![1]; for (const [b, v] of SWING) if (beat >= b - 1e-9) s = v; return s; };
export function sw(beat: number, amount = swingAt(beat)): number {
  const q = beat * 4, k = Math.round(q);
  return Math.abs(q - k) < 1e-6 && k % 2 !== 0 ? beat + (amount - 0.5) * 0.5 : beat;
}
/** Swung position of bar n, sixteenth s. */
const S = (bar: number, s: number, amount?: number) => r6(sw(at(bar, s), amount));

type Opts = Record<string, string | number>;
export type RackNote = [number, number, string, number, Opts?];
const rn = (beat: number, beats: number, pitch: string, vel: number, o?: Opts): RackNote => (o && Object.keys(o).length ? [r6(beat), r6(beats), pitch, r6(vel), o] : [r6(beat), r6(beats), pitch, r6(vel)]);
/** A note from sixteenth s to s+d of bar n, both ends on the swung grid. */
const n16 = (bar: number, s: number, d: number, pitch: string, vel: number, o?: Opts, amount?: number, gate = 1): RackNote => {
  const a = S(bar, s, amount), b = S(bar, s + d, amount);
  return rn(a, (b - a) * gate, pitch, vel, o);
};

// ================================================================================================ form
export const SECTIONS = [
  { id: 'image', bars: 4, development: 'The hook alone on an analog pluck with the music-box afterimage behind it; light rims and hats; kick and bass join in bar 3; a hand-drum fill in the hook rhythm.' },
  { id: 'pulse', bars: 8, development: '2-step groove. THRONE//VOLT sings the hook, swooping into each held note; Living Bass talks in the holes. The second statement adds the full canon and open hats.' },
  { id: 'glitch', bars: 4, development: 'E minor: Am, B7, Cmaj7#11, D7. Impossible Voice chops the hook with impossible vowels; the bass answers with ratchet dives; half-time broken beat; the pulse quickens and the band falls away.' },
  { id: 'afterimage', bars: 4, development: 'No drums, a hand-drum heartbeat. The choir sings the hook at half speed (F#m9, Amaj9, C#m7) while the music box remembers it at tempo; the harmony sinks into C major and the choir blooms.' },
  { id: 'payoff', bars: 6, development: 'C to A: everything lifts a semitone. Lead an octave up at blaze, the choir on the long notes, bass and kick locked to the pulse pairs; the answer resolves to E. The band stops on the next first pair and the music box finishes alone.' },
];
export const SEC = { image: 0, pulse: 16, glitch: 48, afterimage: 64, payoff: 80, end: END } as const;

// ================================================================================================ the hook
/** [sixteenth, length in sixteenths, pitch] within one bar. Pickups are the short notes; targets the long ones. */
type Cell = [number, number, string][];
export const H1: Cell = [[0, 2, 'G#4'], [2, 3, 'E5'], [5, 2, 'F#4'], [7, 3, 'D#5'], [10, 2, 'E4'], [12, 4, 'C#5']];
export const H1R: Cell = [[0, 2, 'G#4'], [2, 3, 'E5'], [5, 2, 'F#4'], [7, 3, 'D#5'], [10, 2, 'B4'], [12, 4, 'G#5']];   // the reach
export const H2A: Cell = [[0, 2, 'B4'], [2, 3, 'C#5'], [5, 2, 'E5'], [7, 9, 'B4']];                                        // settles
export const H2B: Cell = [[0, 2, 'B4'], [2, 3, 'C#5'], [5, 2, 'E5'], [7, 9, 'G#5']];                                       // yearns
export const H2C: Cell = [[0, 2, 'B4'], [2, 3, 'C#5'], [5, 2, 'D#5'], [7, 9, 'E5']];                                       // resolves (payoff only)
const isPickup = (c: Cell, i: number) => c[i]![1] === 2 && i % 2 === 0;
/** The hook's E-minor shadow (section III): D# -> D, G# -> G, C# -> C. */
const minor = (p: string) => p.replace(/^D#/, 'D').replace(/^G#/, 'G').replace(/^C#/, 'C');

// ================================================================================================ THRONE//VOLT · lead
interface LeadStyle { oct: number; vPick: number; vTarget: number; slide: number; accentTargets?: boolean; scoopEvery?: number }
function leadBar(bar: number, cell: Cell, st: LeadStyle, last?: Opts): RackNote[] {
  return cell.map(([s, d, p], i) => {
    const pitch = tr(p, st.oct), pick = isPickup(cell, i);
    if (pick) return n16(bar, s, d, pitch, st.vPick + 0.03 * hash(bar * 17 + i));
    const o: Opts = { slide: st.slide };
    if (st.accentTargets && i === 1) o.articulation = 'accent';
    if (i === cell.length - 1 && last) Object.assign(o, last);
    return n16(bar, s, d, pitch, st.vTarget + 0.03 * hash(bar * 31 + i), o);
  });
}
const P1: LeadStyle = { oct: 0, vPick: 0.74, vTarget: 0.86, slide: 0.1 };
const P2: LeadStyle = { oct: 0, vPick: 0.78, vTarget: 0.9, slide: 0.12, accentTargets: true };
const PV: LeadStyle = { oct: 12, vPick: 0.82, vTarget: 0.95, slide: 0.09, accentTargets: true };
const leadNotes: RackNote[] = [
  // II, statement 1 and 2
  ...leadBar(5, H1, P1), ...leadBar(6, H2A, P1), ...leadBar(7, H1R, P1), ...leadBar(8, H2B, P1),
  ...leadBar(9, H1, P2), ...leadBar(10, H2A, P2), ...leadBar(11, H1R, P2), ...leadBar(12, H2B, P2, { articulation: 'fall', fall: 5, fallBeats: 0.9 }),
  // V, the payoff: an octave up; the answer yearns first, then resolves
  ...leadBar(21, H1, PV), ...leadBar(22, H2B, PV), ...leadBar(23, H1R, PV), ...leadBar(24, H2C, PV), ...leadBar(25, H1, PV),
  // bar 26: the first pair only, then the band stops
  n16(26, 0, 2, 'B5', 0.84), n16(26, 2, 2.6, 'C#6', 0.93, { slide: 0.09 }),
];

// ================================================================================================ THRONE//VOLT · pluck
/** The opening statement, and the payoff's body an octave under the lead. */
function pluckBar(bar: number, cell: Cell, v: number, oct = 0): RackNote[] {
  return cell.map(([s, d, p], i) => n16(bar, s, Math.min(d, isPickup(cell, i) ? 2 : 3), tr(p, oct), v * (isPickup(cell, i) ? 0.86 : 1) + 0.04 * hash(bar * 7 + i), undefined, undefined, 0.92));
}
const pluckNotes: RackNote[] = [
  ...pluckBar(1, H1, 0.8), ...pluckBar(2, H2A, 0.8), ...pluckBar(3, H1R, 0.82), ...pluckBar(4, H2B, 0.84),
  ...pluckBar(21, H1, 0.62), ...pluckBar(22, H2B, 0.62), ...pluckBar(23, H1R, 0.64), ...pluckBar(24, H2C, 0.66), ...pluckBar(25, H1, 0.64),
];

// ================================================================================================ THRONE//VOLT · pad
const CH = {
  A: ['A3', 'C#4', 'E4', 'G#4'], Bs: ['B3', 'E4', 'F#4', 'A4'], Cm: ['B3', 'C#4', 'E4', 'G#4'],
  Am: ['A3', 'C4', 'E4', 'G4'], B7: ['B3', 'D#4', 'F#4', 'A4'], C: ['C4', 'E4', 'G4', 'B4'], D7: ['A3', 'C4', 'D4', 'F#4'],
  E: ['B3', 'E4', 'F#4', 'G#4'], Bsus: ['B3', 'E4', 'F#4', 'A4'],
} as const;
type ChordId = keyof typeof CH;
const padNotes: RackNote[] = [];
const pad = (from: number, to: number, c: ChordId, v: number, art = 'normal') => {
  for (const p of CH[c]) padNotes.push(rn(from, to - from, p, v, art === 'normal' ? undefined : { articulation: art }));
};
const PADI: ChordId[] = ['A', 'Bs', 'A', 'Cm'];
PADI.forEach((c, i) => pad(at(1 + i), at(2 + i), c, 0.6, i === 0 ? 'swell' : 'normal'));
for (let i = 0; i < 8; i++) pad(at(5 + i), at(6 + i), PADI[i % 4]!, 0.66);
(['Am', 'B7', 'C', 'D7'] as ChordId[]).forEach((c, i) => pad(at(13 + i), at(14 + i) - (i === 3 ? 0.5 : 0), c, 0.6));
pad(at(21), at(22), 'A', 0.7); pad(at(22), at(23), 'Cm', 0.7); pad(at(23), at(24), 'A', 0.7);
pad(at(24), S(24, 7), 'Bsus', 0.7); pad(S(24, 7), at(25), 'E', 0.74); pad(at(25), at(26), 'A', 0.72); pad(at(26), S(26, 5), 'Bsus', 0.7);

// ================================================================================================ the afterimage (music box)
/** The canon: the given notes again, a dotted eighth (3 sixteenths) later, an octave up, softer, re-swung. */
function echo(bar: number, cell: Cell, o: { targetsOnly?: boolean; v?: number; oct?: number; minorize?: boolean; swing?: number; art?: string } = {}): RackNote[] {
  const out: RackNote[] = [];
  cell.forEach(([s, d, p], i) => {
    if (o.targetsOnly && isPickup(cell, i)) return;
    const pitch = tr(o.minorize ? minor(p) : p, o.oct ?? 12), v = (o.v ?? 0.5) * (isPickup(cell, i) ? 0.8 : 1) + 0.04 * hash(bar * 13 + i);
    out.push(n16(bar, s + 3, Math.min(d, 4), pitch, v, o.art ? { articulation: o.art } : undefined, o.swing));
  });
  return out;
}
/** The hook remembered at tempo, an octave up, soft mallet, 2-step swing (under the half-speed choir). */
const memory = (bar: number, cell: Cell, v: number): RackNote[] =>
  cell.map(([s, d, p], i) => n16(bar, s, Math.min(d, 3), tr(p, 12), v * (isPickup(cell, i) ? 0.8 : 1) + 0.03 * hash(bar * 19 + i), { articulation: 'soft' }, 0.57));
const echoNotes: RackNote[] = [
  ...echo(1, H1, { targetsOnly: true, v: 0.5 }), ...echo(2, H2A, { targetsOnly: true, v: 0.5 }), ...echo(3, H1R, { targetsOnly: true, v: 0.52 }), ...echo(4, H2B, { targetsOnly: true, v: 0.52 }),
  ...echo(9, H1, { v: 0.44 }), ...echo(10, H2A, { v: 0.44 }), ...echo(11, H1R, { v: 0.46 }), ...echo(12, H2B, { v: 0.46 }),
  // III: a ghost of the voice's long notes
  ...echo(13, H1, { targetsOnly: true, minorize: true, v: 0.42 }), ...echo(15, H1R, { targetsOnly: true, minorize: true, v: 0.44 }),
  // IV: the memory at tempo under the slow choir (the hook itself, not delayed, with the groove's swing)
  ...memory(17, H1, 0.3), ...memory(18, H1, 0.24),
  // V
  ...echo(21, H1, { targetsOnly: true, v: 0.36 }), ...echo(23, H1R, { targetsOnly: true, v: 0.38 }), ...echo(25, H1, { targetsOnly: true, v: 0.46 }),
  // bar 26: the band stops after the first pair; the music box finishes the resolving answer alone (D# -> E)
  n16(26, 3, 2, 'B5', 0.48), n16(26, 5, 3, 'C#6', 0.52), n16(26, 8, 2, 'D#6', 0.5), n16(26, 10, 6, 'E6', 0.58, { articulation: 'ring' }),
];

// ================================================================================================ Living Bass
type B16 = [number, number, string, number, Opts?];
const bassNotes: RackNote[] = [];
const bassBar = (bar: number, ns: B16[]) => ns.forEach(([s, d, p, v, o]) => bassNotes.push(n16(bar, s, d, p, v, o, undefined, 0.96)));
const acc = { articulation: 'accent' }, leg = (slide = 0.06) => ({ articulation: 'legato', slide }), st = { articulation: 'staccato' }, gh = { articulation: 'ghost' };
// I: bars 3-4
bassBar(3, [[0, 3, 'A1', 0.82], [10, 3, 'A1', 0.78], [14, 2, 'A2', 0.5, gh]]);
bassBar(4, [[0, 3, 'C#2', 0.84], [10, 2, 'C#2', 0.74], [14, 2, 'B1', 0.7, leg(0.12)]]);
// II: the talking 2-step bass
const BA: B16[] = [[0, 3, 'A1', 0.95, acc], [3, 1, 'A2', 0.55, st], [6, 2, 'A1', 0.68], [10, 3, 'A1', 0.86], [13, 1, 'E2', 0.55, st], [14, 2, 'A#1', 0.7, leg(0.1)]];
const BB: B16[] = [[0, 3, 'B1', 0.95, acc], [3, 1, 'B2', 0.55, st], [7, 2, 'F#2', 0.76], [9, 1, 'A2', 0.62], [10, 2, 'B2', 0.8, leg(0.05)], [12, 2, 'E2', 0.72], [14, 2, 'G#1', 0.7, leg(0.1)]];
const BAR_: B16[] = [[0, 3, 'A1', 0.95, acc], [3, 1, 'A2', 0.55, st], [6, 1, 'A1', 0.66], [7, 1, 'E2', 0.6, st], [10, 3, 'A1', 0.86], [13, 1, 'C#2', 0.6, st], [14, 2, 'C2', 0.7, leg(0.1)]];
const BC: B16[] = [[0, 3, 'C#2', 0.95, acc], [3, 1, 'C#3', 0.55, st], [7, 2, 'G#2', 0.76], [9, 1, 'B2', 0.62], [10, 2, 'C#3', 0.82, leg(0.05)], [12, 1, 'E2', 0.66], [13, 1, 'F#2', 0.68], [14, 2, 'G#1', 0.72, leg(0.1)]];
for (const b of [5, 9]) { bassBar(b, BA); bassBar(b + 1, BB); bassBar(b + 2, BAR_); bassBar(b + 3, BC); }
// III: the machine answers the voice in its gaps; ratchet dives between chords
bassBar(13, [[0, 2, 'A1', 0.95, acc], [3, 1, 'A2', 0.6, st], [8, 1, 'E2', 0.78], [9, 1, 'G2', 0.76, leg(0.05)], [13, 3, 'A2', 0.88, acc]]);
bassBar(14, [[0, 3, 'B1', 0.9, leg(0.32)], [5, 1, 'B2', 0.62, st], [8, 2, 'F#2', 0.8], [11, 1, 'A2', 0.7], [12, 2, 'B2', 0.82, leg(0.05)], [14, 2, 'B1', 0.75]]);
bassBar(15, [[0, 2, 'C2', 0.95, acc], [3, 1, 'C3', 0.6, st], [8, 1, 'G2', 0.78], [9, 1, 'B2', 0.76, leg(0.05)], [13, 3, 'C3', 0.9, acc]]);
bassBar(16, [[0, 3, 'D2', 0.92, leg(0.3)], [5, 2, 'D2', 0.8], [10, 4, 'D2', 0.84, { dive: 7, diveBeats: 0.6 }]]);
// IV: warm, long, under the choir; C#2 sinks to C2 with the harmony (anticipated on the and-of-4)
bassBar(17, [[0, 15.5, 'F#1', 0.62]]); bassBar(18, [[0, 15.5, 'A1', 0.62]]);
bassBar(19, [[0, 14, 'C#2', 0.62]]); bassBar(19, [[14, 17.5, 'C2', 0.6]]);
// V: the bass takes the hook's leaps (pickup low, target up) in unison with the kick on every pickup
const VA: B16[] = [[0, 2, 'A1', 0.96, acc], [2, 3, 'A2', 0.82, leg(0.07)], [5, 2, 'A1', 0.9], [7, 3, 'E2', 0.82, leg(0.07)], [10, 2, 'A1', 0.9], [12, 3, 'C#2', 0.82, leg(0.07)], [15, 1, 'A2', 0.5, gh]];
bassBar(21, VA);
bassBar(22, [[0, 2, 'C#2', 0.96, acc], [2, 3, 'C#3', 0.82, leg(0.07)], [5, 2, 'C#2', 0.9], [7, 3, 'G#2', 0.82, leg(0.07)], [10, 2, 'B1', 0.88], [12, 2, 'B2', 0.8, leg(0.07)], [14, 2, 'G#1', 0.76, leg(0.08)]]);
bassBar(23, [[0, 2, 'A1', 0.96, acc], [2, 3, 'A2', 0.82, leg(0.07)], [5, 2, 'A1', 0.9], [7, 3, 'E2', 0.82, leg(0.07)], [10, 2, 'A1', 0.9], [12, 3, 'G#2', 0.82, leg(0.07)], [15, 1, 'A#1', 0.6]]);
bassBar(24, [[0, 2, 'B1', 0.96, acc], [2, 3, 'B2', 0.82, leg(0.07)], [5, 2, 'B1', 0.9], [7, 6, 'E1', 1, acc], [13, 1, 'E2', 0.7, st], [14, 2, 'G#1', 0.76, leg(0.08)]]);
bassBar(25, VA.slice(0, 6));
bassBar(25, [[15, 1, 'A#1', 0.6]]);
bassBar(26, [[0, 2, 'B1', 0.96, acc], [2, 2.6, 'B2', 0.84, { articulation: 'legato', slide: 0.07, dive: 5, diveBeats: 0.35 }]]);
bassNotes.sort((a, b) => a[0] - b[0]);
const bassMacro = { steps: [[0, 0.3], [16, 0.38], [32, 0.46], [48, 0.78], [60, 0.85], [64, 0.02], [80, 0.55], [100, 0.5]] as [number, number][], glide: 0.25 };
const bassMotion = [
  { fromBeat: 16, toBeat: 48, preset: 'eighths' }, { fromBeat: 48, toBeat: 62, preset: 'growl' },
  { fromBeat: 62, toBeat: 80, preset: 'none' }, { fromBeat: 80, toBeat: 104, preset: 'sixteenths' },
];

// ================================================================================================ Impossible Voice (III)
const V = (vowel: string, extra: Opts = {}) => ({ vowel, ...extra });
const voiceNotes: RackNote[] = [
  // bar 13 (Am): the minor hook as chops; pickups "ee", long notes open
  n16(13, 0, 1.4, 'G4', 0.72, V('ee', { articulation: 'detached' })), n16(13, 2, 2.4, 'E5', 0.86, V('ah', { articulation: 'cry', cry: 2 })),
  n16(13, 5, 1.4, 'F#4', 0.7, V('ee', { articulation: 'detached' })), n16(13, 7, 2.4, 'D5', 0.82, V('oh')),
  n16(13, 10, 1.4, 'E4', 0.7, V('ee', { articulation: 'detached' })), n16(13, 12, 3, 'C5', 0.82, V('ah', { to: 'oo' })),
  // bar 14 (B7): the answer leaps up the dominant and moans down
  n16(14, 0, 1.4, 'B4', 0.74, V('eh', { articulation: 'detached' })), n16(14, 2, 2.4, 'D#5', 0.84, V('ah')),
  n16(14, 5, 1.4, 'F#5', 0.8, V('ee', { articulation: 'cry', cry: 1.5 })), n16(14, 7, 6, 'A5', 0.86, V('ah', { to: 'oh', articulation: 'fall', fall: 2 })),
  // bar 15 (Cmaj7#11): the hook's lydian shadow, reaching to G5
  n16(15, 0, 1.4, 'G4', 0.74, V('ee', { articulation: 'detached' })), n16(15, 2, 2.4, 'E5', 0.86, V('oh', { articulation: 'cry', cry: 2 })),
  n16(15, 5, 1.4, 'F#4', 0.72, V('ee', { articulation: 'detached' })), n16(15, 7, 2.4, 'D5', 0.84, V('ah')),
  n16(15, 10, 1.4, 'B4', 0.76, V('eh', { articulation: 'detached' })), n16(15, 12, 3, 'G5', 0.88, V('ah', { to: 'eh' })),
  // bar 16 (D7): the pulse quickens, pairs in sixteenths, then the long cry that carries into IV (A is in F#m)
  n16(16, 0, 1, 'A4', 0.72, V('ee')), n16(16, 1, 1, 'F#5', 0.8, V('ah')), n16(16, 2, 1, 'B4', 0.74, V('ee')), n16(16, 3, 1, 'G5', 0.82, V('ah')),
  n16(16, 4, 1, 'C5', 0.76, V('ee')), n16(16, 5, 1.4, 'A5', 0.86, V('ah')), n16(16, 7, 1.4, 'D5', 0.74, V('oh')),
  n16(16, 9, 11, 'A5', 0.84, V('ah', { to: 'oo', articulation: 'cry', cry: 1 })),
];

// ================================================================================================ HEAVEN//MASS
type Part = 'bass' | 'tenor' | 'alto' | 'soprano';
const CHOIR: Record<Part, RackNote[]> = { bass: [], tenor: [], alto: [], soprano: [] };
const sing = (p: Part, bar: number, s: number, d: number, pitch: string, v: number, o: Opts) => CHOIR[p].push(n16(bar, s, d, pitch, v, o, 0.5));
// IV: the hook at half speed (every sixteenth becomes an eighth), intimate; then the sink into C major and the bloom
([[0, 4, 'G#4', 'oo'], [4, 6, 'E5', 'oo'], [10, 4, 'F#4', 'oo'], [14, 6, 'D#5', 'oh'], [20, 4, 'E4', 'oh'], [24, 8, 'C#5', 'oh'],
  [32, 4, 'B4', 'oh'], [36, 6, 'C#5', 'oh'], [42, 4, 'E5', 'ah']] as const).forEach(([s, d, p, v], i) =>
  sing('soprano', 17, s, d, p, 0.66 + 0.02 * i, { vowel: v, articulation: i === 0 ? 'breathy' : 'legato' }));
sing('soprano', 17, 46, 18, 'G5', 0.86, { vowel: 'ah', articulation: 'legato' });
sing('alto', 17, 0, 16, 'C#4', 0.6, { vowel: 'oo', articulation: 'hum' }); sing('alto', 18, 0, 16, 'B3', 0.62, { vowel: 'oo' });
sing('alto', 19, 0, 14, 'E4', 0.64, { vowel: 'oh' }); sing('alto', 19, 14, 18, 'E4', 0.8, { vowel: 'ah' });
sing('tenor', 17, 0, 16, 'A3', 0.6, { vowel: 'oo', articulation: 'hum' }); sing('tenor', 18, 0, 16, 'G#3', 0.62, { vowel: 'oo' });
sing('tenor', 19, 0, 14, 'G#3', 0.64, { vowel: 'oh' }); sing('tenor', 19, 14, 18, 'G3', 0.8, { vowel: 'ah' });
sing('bass', 17, 0, 16, 'F#2', 0.62, { vowel: 'mm', to: 'oo', articulation: 'hum' }); sing('bass', 18, 0, 16, 'A2', 0.64, { vowel: 'oo' });
sing('bass', 19, 0, 14, 'C#3', 0.66, { vowel: 'oh' }); sing('bass', 19, 14, 18, 'C3', 0.82, { vowel: 'ah' });
// V: the hook's long notes, sung; alto in thirds and sixths below; tenor and bass hold the chord
const VS: [number, number, number, string, string, string, string][] = [
  // bar, s, d, soprano, alto, tenor, bass
  [21, 2, 5, 'E5', 'C#5', 'C#4', 'A2'], [21, 7, 5, 'D#5', 'B4', 'C#4', 'A2'], [21, 12, 11, 'C#5', 'A4', 'C#4', 'A2'],
  [22, 7, 11, 'G#5', 'E5', 'C#4', 'C#3'],
  [23, 2, 5, 'E5', 'C#5', 'C#4', 'A2'], [23, 7, 5, 'D#5', 'B4', 'C#4', 'A2'], [23, 12, 6, 'G#5', 'E5', 'C#4', 'A2'],
  [24, 2, 5, 'C#5', 'A4', 'B3', 'B2'], [24, 7, 9, 'E5', 'G#4', 'B3', 'E3'],
  [25, 0, 16, 'E5', 'C#5', 'C#4', 'A2'], [26, 0, 4, 'E5', 'C#5', 'C#4', 'A2'],
];
VS.forEach(([bar, s, d, so, al, te, ba], i) => {
  const v = 0.82 + 0.1 * (bar >= 24 ? 1 : 0), o: Opts = { vowel: bar >= 25 ? 'ah' : i % 2 ? 'ah' : 'oh', articulation: i === 0 ? 'swell' : 'legato' };
  sing('soprano', bar, s, d, so, v, o); sing('alto', bar, s, d, al, v - 0.04, o); sing('tenor', bar, s, d, te, v - 0.06, o); sing('bass', bar, s, d, ba, v - 0.06, o);
});
/** Touching notes of the same pitch become one sung note; parts may not overlap. */
for (const p of Object.keys(CHOIR) as Part[]) {
  const ns = CHOIR[p].sort((a, b) => a[0] - b[0]), out: RackNote[] = [];
  for (const n of ns) {
    const prev = out[out.length - 1];
    if (prev && n[0] < prev[0] + prev[1] - 1e-6) throw new Error(`choir ${p}: overlap at beat ${n[0]}`);
    if (prev && prev[2] === n[2] && Math.abs(prev[0] + prev[1] - n[0]) < 1e-6) { prev[1] = r6(prev[1] + n[1]); if (n[4]?.vowel) prev[4] = { ...prev[4], to: n[4].vowel }; continue; }
    out.push(n);
  }
  CHOIR[p] = out;
}
// the bloom: a few singers, then all of them on the C major chord; the payoff sings full
const CHOIR_MACRO = { steps: [[0, 0.06], [64, 0.06], [72, 0.14], [S(19, 14) + 0.2, 0.9], [80, 0.82], [92, 0.92], [100, 1]] as [number, number][], glide: 1.2 };
const CHOIR_ENSEMBLE = { steps: [[0, 0.2], [64, 0.2], [68, 0.34], [S(19, 14), 0.42], [S(19, 14) + 2, 1], [80, 1]] as [number, number][], glide: 1.6 };
const CHOIR_EXPR: [number, number][] = [[64, 0.56], [72, 0.62], [S(19, 14), 0.7], [79, 0.84], [80, 0.8], [92, 0.88], [100, 0.92]];

// ================================================================================================ percussion (rack)
const logNotes: RackNote[] = [], skinNotes: RackNote[] = [], clockNotes: RackNote[] = [];
const L = (bar: number, s: number, art: string, pitch: string, v: number) => logNotes.push(n16(bar, s, 1, pitch, v, { articulation: art }));
const K = (bar: number, s: number, d: number, art: string, pitch: string, v: number, o: Opts = {}, amount?: number) => skinNotes.push(n16(bar, s, d, pitch, v, { articulation: art, ...o }, amount));
for (let b = 1; b <= 4; b++) { L(b, 4, 'rim', 'D4', 0.34); L(b, 12, 'rim', 'D4', 0.38); }
for (let b = 5; b <= 12; b++) {
  L(b, b % 2 ? 3 : 9, 'knuckle', 'B4', 0.3); L(b, 14, 'rim', 'E4', 0.28 + 0.04 * (b % 2));
  if (b % 4 === 0) L(b, 15, 'knuckle', 'E5', 0.34);
}
for (let b = 21; b <= 25; b++) { L(b, 7, 'rim', 'E4', 0.3); L(b, 15, 'knuckle', 'B4', 0.32); }
// bar 4: hand drums answer the held G# in the hook's own rhythm, climbing into the groove
K(4, 8, 1, 'tap', 'E3', 0.45); K(4, 9, 1, 'slap', 'B3', 0.7); K(4, 11, 1, 'tap', 'F#3', 0.5); K(4, 12, 1, 'slap', 'C#4', 0.76);
K(4, 14, 1, 'open', 'G#3', 0.72); K(4, 15, 1, 'slap', 'E4', 0.84);
// III: talking hand drum in the gaps
for (const b of [13, 15]) { K(b, 4, 1, 'open', 'E3', 0.55, { bend: 3 }); K(b, 9, 1, 'slap', 'B3', 0.5); K(b, 14, 1, 'open', 'A3', 0.5, { bend: -2 }); }
K(14, 4, 1, 'mute', 'E3', 0.5); K(14, 13, 2, 'roll', 'B3', 0.5);
// IV: the heartbeat (lub-dub, twice a bar: 68 a minute); it skips while the C major chord blooms, then returns
for (const b of [17, 18, 19]) for (const h of [0, 8]) { K(b, h, 1.5, 'bass', 'E2', 0.5, {}, 0.5); K(b, h + 2, 2, 'bass', 'E2', 0.7, {}, 0.5); }
K(20, 12, 1.5, 'bass', 'E2', 0.52, {}, 0.5); K(20, 14, 2, 'bass', 'E2', 0.74, {}, 0.5);
// bar 26: the last heartbeat under the music box
K(26, 12, 1.5, 'bass', 'E2', 0.46); K(26, 14, 2, 'bass', 'E2', 0.6);
// III: escapement ticks, the playful clockwork, bursting at the ends of bars
for (const b of [13, 14, 15]) {
  for (const s of [1, 6, 11]) clockNotes.push(n16(b, s, 0.5, 'E6', 0.4, { articulation: 'tick' }));
  for (let k = 0; k < 4; k++) clockNotes.push(rn(at(b, 14) + k * 0.125, 0.1, 'B6', 0.36 + 0.08 * k, { articulation: 'tick' }));
}
clockNotes.push(n16(16, 0, 0.5, 'E6', 0.5, { articulation: 'tock' }), n16(16, 5, 0.5, 'E6', 0.4, { articulation: 'tick' }));
for (const a of [logNotes, skinNotes, clockNotes]) a.sort((x, y) => x[0] - y[0]);

// ================================================================================================ rack scores
const ROOM = { rt60: 1.5, size: 1.05, damp: 6500, predelayMs: 22, lowCut: 300 };
const base = (title: string, description: string, seed: number) => ({ schema: SCHEMA, title, description, bpm: BPM, key: KEY, swing: 0.5, seed, tailSeconds: TAIL_SECONDS, masterGainDb: 0, sections: SECTIONS, room: ROOM });
const LEAD_MACRO: [number, number][] = [[16, 0.42], [32, 0.5], [47, 0.56], [80, 0.74], [92, 0.8], [100, 0.82]];
export const SCORES: { id: string; score: Record<string, unknown> }[] = [
  {
    id: 'lead', score: {
      ...base('AFTERIMAGE//PULSE: THRONE//VOLT lead', 'The hook in the groove and the payoff.', 1361),
      parts: [{
        id: 'lead', instrument: 'throne-volt', gainDb: -3, pan: 0, room: 0.12,
        setup: { seed: 13601, glide: 0.06, release: 0.22, attack: 0.004, vibRate: 5.2, drift: 3, keytrack: 0.7, lowcut: 170 },
        macro: LEAD_MACRO, expression: [[16, 0.7], [47, 0.76], [80, 0.82], [100, 0.86]],
        controls: { width: 0.35, sub: [[16, 0.18], [80, 0.1]], sync: [[16, 0.03], [32, 0.08], [47, 0.1], [80, 0.22], [92, 0.3], [100, 0.3]], vowel: 0.22, bloom: 0.6 },
        offsets: { vib: -4, heat: 0.05, growl: [[0, 0], [S(24, 7), 0], [S(24, 7) + 0.25, 0.12], [at(25) - 0.2, 0.12], [at(25), 0]] },
        notes: leadNotes,
      }],
    },
  },
  {
    id: 'keys', score: {
      ...base('AFTERIMAGE//PULSE: THRONE//VOLT pluck and pad', 'The opening pluck (and its return under the payoff) and the pulsing chord bed.', 1362),
      parts: [
        {
          id: 'pluck', instrument: 'throne-volt', gainDb: -4, pan: 0, room: 0.26,
          setup: { seed: 13602, attack: 0.002, release: 0.16, drift: 2.5, keytrack: 0.85, lowcut: 150 },
          macro: 0.15,
          controls: { cutoff: 360, res: 1.7, env: [[0, 3.6], [16, 4], [80, 3.2]], drive: 0.3, heat: 0.22, sync: 0, detune: 5, sub: 0, growl: 0, vib: 0, bloom: 0, width: 0.55, air: 0.12, vowel: 0 },
          notes: pluckNotes,
        },
        {
          id: 'pad', instrument: 'throne-volt', gainDb: -12, pan: 0, room: 0.32,
          setup: { seed: 13603, attack: 0.03, release: 0.55, drift: 6, keytrack: 0.4, lowcut: 200, glide: 0.12 },
          macro: 0.2,
          controls: { cutoff: [[0, 520], [16, 760], [48, 900], [64, 760], [80, 1100]], res: 0.7, env: 0.9, drive: 0.2, heat: 0.18, sync: 0, detune: 14, sub: 0, growl: 0, vib: 4, bloom: 0.7, width: 0.9, air: 0.04, vowel: 0.1 },
          notes: padNotes.sort((a, b) => a[0] - b[0] || midi(a[2]) - midi(b[2])),
        },
      ],
    },
  },
  {
    id: 'bassvox', score: {
      ...base('AFTERIMAGE//PULSE: Living Bass and Impossible Voice', 'The talking bass and the glitch-section voice.', 1363),
      parts: [
        {
          id: 'bass', instrument: 'living-bass', gainDb: -2, pan: 0, room: 0, setup: { seed: 13604 },
          macro: bassMacro, motion: bassMotion,
          expression: [[0, 0.72], [16, 0.78], [48, 0.82], [64, 0.6], [80, 0.84]],
          controls: { hold: { steps: [[0, 0.6], [64, 0.84], [80, 0.6]], glide: 0.5 }, ratchet: { steps: [[0, 0], [48, 1], [64, 0]], glide: 0.05 }, servo: { steps: [[0, 0.3], [48, 0.85], [64, 0.1], [80, 0.4]], glide: 0.05 } },
          offsets: { grind: { steps: [[0, 0], [48, -0.35], [64, 0]], glide: 0.1 }, chassis: { steps: [[0, -0.2], [48, 0], [64, -0.5], [80, -0.25]], glide: 0.1 }, bright: { steps: [[0, 0.05], [80, 0.12]], glide: 0.5 } },
          notes: bassNotes,
        },
        {
          id: 'voice', instrument: 'impossible-voice', gainDb: -2, pan: 0, room: 0.3,
          setup: { seed: 13605, size: 0.15, vibRate: 5.6, vibCents: 22, vowelTau: 0.05, haloDecay: 0.9, haloGain: 0.8, halo: ['E5', 'B5', 'E6'] },
          macro: [[48, 0.3], [56, 0.5], [62, 0.72], [66, 0.6]],
          expression: [[48, 0.74], [60, 0.82], [66, 0.7]],
          controls: { tilt: 0.72, breath: 0.28, glass: [[48, 0.2], [62, 0.45]], split: [[48, 0], [60, 0.16], [66, 0.2]], stretch: [[48, 0], [62, 0.022]], shimmer: [[48, 0.1], [62, 0.4]], vib: 0.7 },
          notes: voiceNotes,
        },
      ],
    },
  },
  {
    id: 'perc', score: {
      ...base('AFTERIMAGE//PULSE: music box and hand percussion', 'The afterimage canon (Mechanical Orchestra bar), Timbre Lab hollow log and hand skin, escapement clock.', 1364),
      parts: [
        {
          id: 'echo', instrument: 'mechanical-orchestra/bar', gainDb: -6, pan: 0, room: 0.38, setup: { seed: 13606, spread: 0.85 },
          macro: { steps: [[0, 0.06], [48, 0.55], [64, 0.04], [80, 0.1]], glide: 0.5 },
          controls: { damp: { steps: [[0, 0.62], [48, 0.5], [64, 0.85], [80, 0.6], [at(26, 8), 1.2]], glide: 0.25 }, hardness: { steps: [[0, 0.55], [64, 0.35], [80, 0.6]], glide: 0.25 } },
          notes: echoNotes.sort((a, b) => a[0] - b[0]),
        },
        { id: 'log', instrument: 'organic-percussion/log', gainDb: -6, pan: -0.22, room: 0.12, setup: { seed: 13607, spread: 0.35 }, macro: 0.1, humanize: { timingMs: 3, velocity: 0.08, seed: 1371 }, notes: logNotes },
        { id: 'skin', instrument: 'organic-percussion/skin', gainDb: -4, pan: 0.08, room: 0.14, setup: { seed: 13608, spread: 0.3 }, macro: { steps: [[0, 0.2], [64, 0.45], [80, 0.25]], glide: 0.5 },
          controls: { damp: { steps: [[0, 1], [64, 1.3], [80, 1]], glide: 0.5 } }, humanize: { timingMs: 4, velocity: 0.06, seed: 1372 }, notes: skinNotes },
        { id: 'clock', instrument: 'mechanical-orchestra/clock', gainDb: -8, pan: 0.3, room: 0.1, setup: { seed: 13609, spread: 0.4 }, macro: 0.5, notes: clockNotes },
      ],
    },
  },
  ...(['low', 'high'] as const).map((bus, k) => ({
    id: `choir-${bus}`, score: {
      ...base(`AFTERIMAGE//PULSE: HEAVEN//MASS ${bus}`, 'The afterimage passage and the payoff\'s sung long notes.', 1365 + k),
      parts: (bus === 'low' ? ['bass', 'tenor'] : ['alto', 'soprano'] as Part[]).map((id, j) => ({
        id, instrument: `heaven-mass/${id}`, gainDb: id === 'soprano' ? -13 : id === 'alto' ? -12 : id === 'tenor' ? -13 : -12, pan: 0, room: 0,
        setup: { seed: 13610 + 2 * k + j, singers: id === 'soprano' ? 7 : 6, depth: 0.55, lowCut: 220, output: 'mix', ...(id === 'bass' ? { octavists: 2 } : {}) },
        macro: CHOIR_MACRO, expression: CHOIR_EXPR,
        controls: { ensemble: CHOIR_ENSEMBLE, air: { steps: [[0, 0.2], [S(19, 14), 0.25], [S(19, 14) + 1, 0.55], [80, 0.4]], glide: 1 },
          ...(id === 'bass' ? { octavist: { steps: [[0, 0], [S(19, 14), 0], [S(19, 14) + 0.5, 0.85], [80, 0]], glide: 0.8 } } : {}) },
        notes: CHOIR[id as Part],
      })),
    },
  })),
];

// ================================================================================================ engine drums
// Grid positions (unswung) first, then swing and a drummer's timing: the snare sits 5-8 ms behind, kicks and hats
// wander +-2-3 ms. Velocities vary a few percent.
type Hit = [number, number];
const KG: Hit[] = [], SG: Hit[] = [], GH: Hit[] = [], HG: [number, number, string][] = [];
const k = (bar: number, s: number, v: number) => KG.push([at(bar, s), v]);
const sn = (bar: number, s: number, v: number) => SG.push([at(bar, s), v]);
const ghost = (bar: number, s: number, v: number) => GH.push([at(bar, s), v]);
const hat = (bar: number, s: number, v: number, kind = 'pix') => HG.push([at(bar, s), v, kind]);
/** A bar of sixteenth hats; open hats replace the closed hat at their positions (they share a choke group). */
const hatBar = (bar: number, vel: (s: number) => number, opens: number[] = [], openV = 0.5) => {
  for (let s = 0; s < 16; s++) opens.includes(s) ? hat(bar, s, openV, 'open') : hat(bar, s, vel(s));
};
// I: hats from bar 1 (offbeats), kick from bar 3
for (let b = 1; b <= 2; b++) for (const s of [2, 6, 10, 14]) hat(b, s, 0.42 + 0.05 * (s === 6 || s === 14 ? 1 : 0));
for (let b = 3; b <= 4; b++) for (let s = 0; s < 16; s++) hat(b, s, s % 4 === 2 ? 0.6 : s % 2 ? 0.34 : 0.26);
k(3, 0, 0.9); k(3, 10, 0.84); k(4, 0, 0.9); k(4, 7, 0.6);
// II: 2-step
for (let b = 5; b <= 12; b++) {
  const odd = b % 2 === 1;
  k(b, 0, 1); k(b, 10, 0.9); if (!odd) k(b, 3, 0.58); if (b % 4 === 0) k(b, 15, 0.56);
  sn(b, 4, 0.96); sn(b, 12, 1);
  if (odd) { ghost(b, 9, 0.2); ghost(b, 15, 0.24); } else ghost(b, 7, 0.22);
  hatBar(b, s => (s % 4 === 2 ? 0.72 : s % 2 ? 0.44 : 0.32), b >= 9 && !odd ? [14] : [], 0.55);
  hat(b, odd ? 6 : 14, 0.5, 'tick');
}
// III: half time, broken; the dissolve in bar 16 (one layer leaves on each pickup)
for (const b of [13, 14, 15]) {
  k(b, 0, 1); k(b, 6, 0.72); k(b, 11, 0.86); sn(b, 8, 1); ghost(b, 13, 0.22); ghost(b, 15, 0.3);
  for (const s of [1, 3, 6, 9, 11, 14]) hat(b, s, s === 6 || s === 14 ? 0.6 : 0.4);
  hat(b, 7, 0.5, 'tick');
}
k(14, 14, 0.6);
k(16, 0, 1); for (const s of [1, 3]) hat(16, s, 0.4); sn(16, 4, 0.9); k(16, 10, 0.8);
// V: the kick locks to the hook's pickups (0, 5, 10); bar 24 adds the resolution on 7
for (let b = 21; b <= 25; b++) {
  k(b, 0, 1); k(b, 5, 0.9); k(b, 10, 0.92); if (b === 24) k(b, 7, 1); if (b % 2 === 1) k(b, 15, 0.52);
  sn(b, 4, 0.98); sn(b, 12, 1); ghost(b, 7, 0.22); ghost(b, 9, 0.18); if (b === 24) ghost(b, 14, 0.3);
  hatBar(b, s => (s % 2 ? 0.44 : 0.34), [2, 6, 10, 14], 0.46);
}
k(26, 0, 1); hat(26, 0, 0.6, 'open');
const hum = (hits: Hit[], spreadMs: number, lagMs: number, seed: number): Hit[] => hits.sort((a, b) => a[0] - b[0])
  .map(([b, v], i) => [r6(sw(b) + ms(lagMs + spreadMs * hash(i + seed))), r6(Math.min(1, v * (1 + 0.04 * hash(i + seed + 500))))]);
export const KICKS = hum(KG, 2, 0, 11), SNARES = hum(SG, 1.5, 6.5, 31), GHOSTS = hum(GH, 3, 5, 61);
export const HATS: [number, number, string][] = HG.sort((a, b) => a[0] - b[0]).map(([b, v, kind], i) => [r6(sw(b) + ms(2.5 * hash(i + 91))), r6(v * (1 + 0.07 * hash(i + 191))), kind]);

type EngineNote = Record<string, unknown>;
const kickHits: EngineNote[] = KICKS.flatMap(([b, v]) => [
  { start: pos(b), pitch: 'body', velocity: r6(v), gate: dur(0.5), envelope: { attackSeconds: 0, releaseSeconds: 0.05 }, chokeGroup: 'body' },
  { start: pos(b), pitch: 'knock', velocity: r6(v * 0.62), gate: dur(0.25), envelope: { attackSeconds: 0, releaseSeconds: 0.03 }, chokeGroup: 'knock' },
]);
const snareHits: EngineNote[] = [
  ...SNARES.flatMap(([b, v]) => [
    { start: pos(b), pitch: 'crack', velocity: r6(v * 0.9), playbackRate: semis(1), gate: dur(0.5), envelope: { attackSeconds: 0, releaseSeconds: 0.06 }, chokeGroup: 'crack' },
    { start: pos(b), pitch: 'clap', velocity: r6(v * 0.82), gate: dur(0.5), envelope: { attackSeconds: 0, releaseSeconds: 0.08 }, chokeGroup: 'clap' },
  ]),
  ...GHOSTS.map(([b, v]) => ({ start: pos(b), pitch: 'crack', velocity: v, playbackRate: semis(1), gate: dur(0.125), envelope: { attackSeconds: 0.0005, releaseSeconds: 0.02 }, chokeGroup: 'crack' })),
];
const hatHits: EngineNote[] = HATS.map(([b, v, kind]) => kind === 'open'
  ? { start: pos(b), pitch: 'open', velocity: v, gate: dur(0.4), envelope: { attackSeconds: 0, releaseSeconds: 0.06 }, chokeGroup: 'hat' }
  : kind === 'tick' ? { start: pos(b), pitch: 'tick', velocity: v, chokeGroup: 'tick' } : { start: pos(b), pitch: 'pix', velocity: v, chokeGroup: 'hat' });

export const KITS = {
  kick: { formatVersion: 1, samples: [{ name: 'body', pitch: 35, file: 'v12/02-iron-pulse.wav' }, { name: 'knock', pitch: 36, file: 'glasshouse/06-bass-punch-cs.wav' }] },
  snare: { formatVersion: 1, samples: [{ name: 'crack', pitch: 38, file: 'v12/03-titanium-crack.wav' }, { name: 'clap', pitch: 39, file: 'glasshouse/08-chrome-clap.wav' }] },
  hats: { formatVersion: 1, samples: [{ name: 'pix', pitch: 42, file: 'glasshouse/09-pixel-hat.wav' }, { name: 'tick', pitch: 44, file: 'v12/05-ghost-tick.wav' }, { name: 'open', pitch: 46, file: 'v12/06-open-circuit.wav' }] },
};
/** Sample sources copied into the isolated engine project: [project path, repository path]. */
export const SAMPLE_FILES: [string, string][] = [
  ['v12/02-iron-pulse.wav', 'packs/v12-signature-v1/assets/v12-signature/02-iron-pulse.wav'],
  ['v12/03-titanium-crack.wav', 'packs/v12-signature-v1/assets/v12-signature/03-titanium-crack.wav'],
  ['v12/05-ghost-tick.wav', 'packs/v12-signature-v1/assets/v12-signature/05-ghost-tick.wav'],
  ['v12/06-open-circuit.wav', 'packs/v12-signature-v1/assets/v12-signature/06-open-circuit.wav'],
  ['glasshouse/06-bass-punch-cs.wav', 'examples/assets/glasshouse/06-bass-punch-cs.wav'],
  ['glasshouse/08-chrome-clap.wav', 'examples/assets/glasshouse/08-chrome-clap.wav'],
  ['glasshouse/09-pixel-hat.wav', 'examples/assets/glasshouse/09-pixel-hat.wav'],
];

// ================================================================================================ automation
// Piecewise-linear lanes in ticks, combined on the union of their breakpoints (ducks by minimum). Edges are ramps.
type Point = { at: { musical: string }; value: number; transition: 'linear' };
const TPB = 960, RAMP = 6;
const tk = (beat: number) => Math.round(beat * TPB);
type Shape = [number, number][];
function evalShape(s: Shape, t: number, outside: number): number {
  if (t < s[0]![0] || t > s[s.length - 1]![0]) return outside;
  for (let i = 1; i < s.length; i++) { const [t0, v0] = s[i - 1]!, [t1, v1] = s[i]!; if (t <= t1) return t1 === t0 ? v1 : v0 + (v1 - v0) * (t - t0) / (t1 - t0); }
  return s[s.length - 1]![1];
}
function lane(base: number, shapes: Shape[], mode: 'min' | 'max' = 'min'): Point[] {
  const endTick = tk(END) - RAMP;
  const ts = [...new Set([0, endTick, ...shapes.flat().map(([t]) => t)])].filter(t => t >= 0 && t <= endTick).sort((a, b) => a - b);
  const vals = ts.map(t => Math.max(-60, Math.min(12, shapes.reduce((acc, s) => (mode === 'min' ? Math.min : Math.max)(acc, evalShape(s, t, base)), base))));
  const out: Point[] = [];
  for (let i = 0; i < ts.length; i++) {
    if (i > 0 && i < ts.length - 1 && Math.abs(vals[i]! - vals[i - 1]!) < 1e-9 && Math.abs(vals[i]! - vals[i + 1]!) < 1e-9) continue;
    out.push({ at: { musical: pos(ts[i]! / TPB) }, value: r6(vals[i]!), transition: 'linear' });
  }
  return out;
}
/** Section levels: dB relative to base over [from, to) beats, linear edges. */
type Seg = [number, number, number];
function levels(base: number, segs: Seg[], edge = 0.1): Shape {
  const s: Shape = [[0, base]];
  for (const [a, b, d] of segs) s.push([tk(a), base], [tk(a + edge), base + d], [tk(b - edge), base + d], [tk(b), base]);
  s.push([tk(END), base]);
  return s.filter((p, i) => i === 0 || p[0] > s[i - 1]![0] || p[1] !== s[i - 1]![1]);
}
/**
 * A section-level lane. Lanes combine by minimum, so the lane must start from the highest level it reaches: the candidate
 * started from `base`, which silently clipped positive offsets to 0 dB (QA finding F5); --candidate keeps that behaviour.
 */
const levelLane = (base: number, segs: Seg[], extra: Shape[] = []) => lane(CANDIDATE ? base : base + Math.max(0, ...segs.map(x => x[2])), [levels(base, segs), ...extra]);
const lvl = (base: number, segs: Seg[]) => { const sh = levels(base, segs); return { sh, top: base + Math.max(0, ...segs.map(x => x[2])) }; };
const duck = (beat: number, at: number, depth: number, holdMs: number, relMs: number): Shape => [[tk(beat) - 12, at], [tk(beat), at - depth], [tk(beat + ms(holdMs)), at - depth], [tk(beat + ms(holdMs + relMs)), at]];
/** A section-level lane with ducks; ducks are measured from the level at that moment. */
function ducked(base: number, segs: Seg[], hits: number[], depth: number, holdMs: number, relMs: number, extra: Shape[] = []): Point[] {
  const { sh, top } = lvl(base, segs);
  return lane(top, [sh, ...hits.map(b => duck(b, evalShape(sh, tk(b), base), depth, holdMs, relMs)), ...extra]);
}
/** The pulse: the pad breathes in the hook's rhythm (dips on each pickup, opens on each target). */
const PULSE_BEATS: number[] = [];
for (let b = 1; b <= 26; b++) if (b < 13 || b >= 21) for (const s of [0, 5, 10]) PULSE_BEATS.push(sw(at(b, s)));
const silence = (from: number, to: number): Shape => [[tk(from), 12], [tk(from) + RAMP, -60], [tk(to) - RAMP, -60], [tk(to), 12]];
const fadeOut = (from: number, to: number, base: number): Shape => [[tk(from), base], [tk(to), -60], [tk(END), -60]];
const DISSOLVE = { hats: sw(at(16, 4)), bass: sw(at(16, 14)) };
const STOP = sw(at(26, 4.6));           // the band stops after the first pair of bar 26

// ================================================================================================ engine project
/** The one bounded QA/fix pass (README). --candidate reproduces the mix exactly as measured before it. */
export const FIX = CANDIDATE ? { leadPulse: 0, bassMidPulse: 0, voiceGlitch: 0, hatDrift: false } : { leadPulse: 4, bassMidPulse: -1, voiceGlitch: 3.5, hatDrift: true };
/** F4: the hats drift between left and right once every two bars in the groove and the payoff (centre 0.2, +-0.35). */
function hatPan(): Point[] {
  const out: Point[] = [], val = (b: number) => (b >= SEC.pulse && b < SEC.glitch) || (b >= SEC.payoff && b < STOP) ? 0.2 + 0.35 * Math.sin(2 * Math.PI * (b - SEC.pulse) / 8) : 0.2;
  for (let b = 0; b <= END - 0.5; b += 0.5) out.push({ at: { musical: pos(b) }, value: r6(val(b)), transition: 'linear' });
  return out;
}
/** Track gains (dB). Set on the calibration renders (README). */
export const MIX = {
  kick: -1, snare: -0.5, hats: -4, perc: 2, echo: 3, bassSub: 4, bassMid: 0, voice: -1, lead: 0, pluck: -2, pad: -1, choirLow: -2, choirHigh: 1, room: 0,
  master: -2,
};
/** The choir carries the afterimage passage; in the payoff it supports the lead (dB relative to its afterimage level). */
const CHOIR_PAYOFF = { low: -7.5, high: -8 }, HEART_DB = -5;
const kickBeats = KICKS.map(([b]) => b);
const kitTrack = (id: string, description: string, kit: string, notes: EngineNote[], gainDb: number, effects: unknown[], automation?: Point[], pan?: number, panLane?: Point[]) => ({
  id, description, instrument: { type: 'drumkit', kit }, mix: { gainDb, ...(pan !== undefined ? { pan } : {}) }, effects,
  ...(automation || panLane ? { automation: { ...(automation ? { gainDb: automation } : {}), ...(panLane ? { pan: panLane } : {}) } } : {}),
  clips: [{ bar: 1, pattern: 'all' }], patterns: [{ id: 'all', bars: BARS, notes }],
});
const stemTrack = (id: string, description: string, sample: string, gainDb: number, effects: unknown[], automation?: Point[], pan?: number) => ({
  id, description, instrument: { type: 'sampler', sample }, mix: { gainDb, ...(pan !== undefined ? { pan } : {}) }, effects, ...(automation ? { automation: { gainDb: automation } } : {}),
  clips: [{ bar: 1, pattern: 'all' }], patterns: [{ id: 'all', bars: BARS, notes: [{ start: '1:1', velocity: 1 }] }],
});
const XO = 120;
/** Engine sampler assets made from rack stems: asset name -> [score id, file in that score's render]. Groups are summed. */
export const ASSETS: Record<string, [string, string][]> = {
  lead: [['lead', 'stems/lead.wav']], pluck: [['keys', 'stems/pluck.wav']], pad: [['keys', 'stems/pad.wav']],
  bass: [['bassvox', 'stems/bass.wav']], voice: [['bassvox', 'stems/voice.wav']],
  echo: [['perc', 'stems/echo.wav']], perc: [['perc', 'stems/log.wav'], ['perc', 'stems/skin.wav'], ['perc', 'stems/clock.wav']],
  'choir-low': [['choir-low', 'stems/bass.wav'], ['choir-low', 'stems/tenor.wav']], 'choir-high': [['choir-high', 'stems/alto.wav'], ['choir-high', 'stems/soprano.wav']],
  room: [['lead', 'stems/room.wav'], ['keys', 'stems/room.wav'], ['bassvox', 'stems/room.wav'], ['perc', 'stems/room.wav']],
};
const A = (id: string) => `assets/rack/${id}.wav`;

export const project = {
  formatVersion: 1,
  title: 'AFTERIMAGE//PULSE (identity proof)',
  description: 'DaemonV12 Sound Lab 03: 26 bars of melodic garage-bass, E major, 136 BPM. THRONE//VOLT, Living Bass, Impossible Voice, HEAVEN//MASS, Mechanical Orchestra, Timbre Lab; V12 Signature and GLASSHOUSE drums.',
  bpm: BPM, timeSignature: '4/4', key: KEY, bars: BARS, seed: 136,
  render: { tail: { seconds: TAIL_SECONDS } },
  master: { gainDb: MIX.master, effects: [{ type: 'highpass', frequencyHz: 26 }, { type: 'compressor', thresholdDb: -16, ratio: 1.5, attackMs: 25, releaseMs: 160 }, { type: 'saturation', driveDb: 1, mix: 0.6 }] },
  tracks: [
    kitTrack('kick', 'V12 IRON PULSE body + GLASSHOUSE bass-punch knock (small-speaker attack).', 'assets/kick-kit.json', kickHits, MIX.kick,
      [{ type: 'highpass', frequencyHz: 30 }, { type: 'saturation', driveDb: 3, mix: 0.25 }]),
    kitTrack('snare', 'V12 TITANIUM CRACK +1 st + GLASSHOUSE chrome clap (C#6 ring); laid back 5-8 ms; ghosts.', 'assets/snare-kit.json', snareHits, MIX.snare,
      [{ type: 'highpass', frequencyHz: 150 }, { type: 'compressor', thresholdDb: -14, ratio: 3, attackMs: 4, releaseMs: 80 }, { type: 'reverb', roomSize: 0.3, decaySeconds: 0.5, wet: 0.08 }]),
    kitTrack('hats', 'GLASSHOUSE pixel hat 16ths, V12 ghost tick and open circuit; swung.', 'assets/hats-kit.json', hatHits, MIX.hats,
      [{ type: 'highpass', frequencyHz: 4000 }], lane(MIX.hats, [silence(DISSOLVE.hats, at(21) - 0.02)]), 0.2, FIX.hatDrift ? hatPan() : undefined),
    stemTrack('perc', 'Timbre Lab hollow log (rims, knuckles), hand skin (fills, talking drum, the heartbeat), escapement clock.', A('perc'), MIX.perc,
      [{ type: 'highpass', frequencyHz: 45 }, { type: 'compressor', thresholdDb: -20, ratio: 2.5, attackMs: 3, releaseMs: 90, makeupGainDb: 2 }],
      lane(MIX.perc, [levels(MIX.perc, [[SEC.afterimage, SEC.payoff, HEART_DB]])])),
    stemTrack('echo', 'The afterimage: Mechanical Orchestra bar, a dotted eighth behind the hook.', A('echo'), MIX.echo,
      [{ type: 'highpass', frequencyHz: 350 }], levelLane(MIX.echo, [[SEC.payoff, at(25), -4], [at(25), END, 2]])),
    stemTrack('bass-sub', `Living Bass below ${XO} Hz: the phase-locked sine sub, mono, ducked under every kick.`, A('bass'), MIX.bassSub,
      [{ type: 'lowpass', frequencyHz: XO }, { type: 'lowpass', frequencyHz: XO }, { type: 'highpass', frequencyHz: 30 }],
      ducked(MIX.bassSub, [[SEC.afterimage, SEC.payoff, -2]], kickBeats, 9, 25, 110, [silence(DISSOLVE.bass, at(17) - 0.05), fadeOut(STOP, STOP + 0.3, MIX.bassSub)]), 0),
    stemTrack('bass-mid', `Living Bass above ${XO} Hz: the talking body, saturated for small speakers.`, A('bass'), MIX.bassMid,
      [{ type: 'highpass', frequencyHz: XO }, { type: 'highpass', frequencyHz: XO }, { type: 'saturation', driveDb: 6, mix: 0.5 }, { type: 'lowpass', frequencyHz: 6000 }],
      ducked(MIX.bassMid, [...(FIX.bassMidPulse ? [[SEC.pulse, SEC.glitch, FIX.bassMidPulse] as Seg] : []), [SEC.glitch, SEC.afterimage, 1.5], [SEC.afterimage, SEC.payoff, -6]], kickBeats, 4, 20, 90, [silence(DISSOLVE.bass, at(17) - 0.05), fadeOut(STOP, STOP + 0.3, MIX.bassMid)])),
    stemTrack('voice', 'Impossible Voice: the hook as chops in the glitch passage; the cry carried into the afterimage.', A('voice'), MIX.voice,
      [{ type: 'highpass', frequencyHz: 160 }, { type: 'compressor', thresholdDb: -20, ratio: 2, attackMs: 6, releaseMs: 120, makeupGainDb: 2 }, { type: 'delay', timeMs: r6(750 * BEAT_SECONDS), wet: 0.1 }],
      FIX.voiceGlitch ? levelLane(MIX.voice, [[SEC.glitch, SEC.afterimage + 2, FIX.voiceGlitch]]) : undefined),
    stemTrack('lead', 'THRONE//VOLT: the hook in the groove, an octave up at the payoff.', A('lead'), MIX.lead,
      [{ type: 'highpass', frequencyHz: 180 }, { type: 'compressor', thresholdDb: -18, ratio: 2, attackMs: 8, releaseMs: 120, makeupGainDb: 1 }, { type: 'delay', timeMs: r6(750 * BEAT_SECONDS), wet: 0.07 }],
      levelLane(MIX.lead, FIX.leadPulse ? [[SEC.pulse, SEC.glitch, FIX.leadPulse]] : [], [fadeOut(STOP, STOP + 0.4, MIX.lead)])),
    stemTrack('pluck', 'THRONE//VOLT pluck: the opening statement, and the body under the payoff lead.', A('pluck'), MIX.pluck,
      [{ type: 'highpass', frequencyHz: 160 }], lane(MIX.pluck, [levels(MIX.pluck, [[SEC.payoff, END, -6]]), fadeOut(STOP, STOP + 0.3, MIX.pluck - 6)])),
    stemTrack('pad', 'THRONE//VOLT pad: the chord bed, breathing in the hook rhythm (dips on each pickup).', A('pad'), MIX.pad,
      [{ type: 'highpass', frequencyHz: 190 }, { type: 'lowpass', frequencyHz: 7000 }],
      ducked(MIX.pad, [[SEC.image, at(2), -3], [SEC.glitch, SEC.afterimage, -2]], PULSE_BEATS, 7, 15, 170, [fadeOut(STOP, STOP + 0.6, MIX.pad)])),
    stemTrack('choir-low', 'HEAVEN//MASS basses (with octavists on the C major bloom) and tenors.', A('choir-low'), MIX.choirLow,
      [{ type: 'highpass', frequencyHz: 60 }], ducked(MIX.choirLow, [[SEC.payoff, END, CHOIR_PAYOFF.low]], kickBeats.filter(b => b >= SEC.payoff), 2, 20, 120, [fadeOut(STOP, STOP + 0.9, MIX.choirLow + CHOIR_PAYOFF.low)])),
    stemTrack('choir-high', 'HEAVEN//MASS altos and sopranos: the hook at half speed, the G that lifts to G#, the payoff\'s long notes.', A('choir-high'), MIX.choirHigh,
      [{ type: 'highpass', frequencyHz: 140 }], lane(MIX.choirHigh, [levels(MIX.choirHigh, [[SEC.payoff, END, CHOIR_PAYOFF.high]]), fadeOut(STOP, STOP + 0.9, MIX.choirHigh + CHOIR_PAYOFF.high)])),
    stemTrack('room', 'The shared rack room (wet only) of the lead, keys, voice and percussion scores.', A('room'), MIX.room, [{ type: 'highpass', frequencyHz: 280 }]),
  ],
};

/** Section and event map for the QA. */
export const MAP = {
  bpm: BPM, bars: BARS, tailSeconds: TAIL_SECONDS, beatSeconds: BEAT_SECONDS,
  sections: SECTIONS.map((s, i) => ({ id: s.id, fromBeat: [0, 16, 48, 64, 80][i]!, toBeat: [16, 48, 64, 80, 104][i]! })),
  kicks: KICKS.map(([b]) => b), snares: SNARES.map(([b]) => b),
  hook: [...pluckNotes.filter(n => n[0] < 16).map(n => ({ part: 'pluck', beat: n[0], beats: n[1], pitch: midi(n[2]) })),
    ...leadNotes.map(n => ({ part: 'lead', beat: n[0], beats: n[1], pitch: midi(n[2]), ...(n[4]?.fallBeats ? { fallBeats: n[4].fallBeats } : {}) })),
    ...voiceNotes.map(n => ({ part: 'voice', beat: n[0], beats: n[1], pitch: midi(n[2]) })),
    ...CHOIR.soprano.filter(n => n[0] < 80).map(n => ({ part: 'choir-high', beat: n[0], beats: n[1], pitch: midi(n[2]) }))],
  bloomBeat: S(19, 14), resolutionBeat: S(24, 7), stopBeat: STOP,
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = join(HERE, 'source');
  mkdirSync(out, { recursive: true });
  for (const { id, score } of SCORES) writeFileSync(join(out, `${id}.score.json`), JSON.stringify(score, null, 1) + '\n');
  writeFileSync(join(out, 'afterimage-pulse.project.json'), JSON.stringify(project, null, 1) + '\n');
  for (const [name, kit] of Object.entries(KITS)) writeFileSync(join(out, `${name}-kit.json`), JSON.stringify(kit, null, 2) + '\n');
  writeFileSync(join(out, 'map.json'), JSON.stringify(MAP, null, 1) + '\n');
  const count = (id: string) => SCORES.flatMap(s => (s.score.parts as { id: string; notes: unknown[] }[])).filter(p => p.id === id).reduce((n, p) => n + p.notes.length, 0);
  console.log(`wrote ${out}${CANDIDATE ? ' (candidate)' : ''}: lead ${count('lead')}, pluck ${count('pluck')}, pad ${count('pad')}, echo ${count('echo')}, bass ${count('bass')}, voice ${count('voice')}, ` +
    `choir ${CHOIR.soprano.length + CHOIR.alto.length + CHOIR.tenor.length + CHOIR.bass.length}; kicks ${KICKS.length}, snares ${SNARES.length}, ghosts ${GHOSTS.length}, hats ${HATS.length}`);
}
