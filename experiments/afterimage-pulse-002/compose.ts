/**
 * AFTERIMAGE//PULSE V2 · DaemonV12 Sound Lab 03. E major, 136 BPM, 2-step swing, 28 bars + 2.0 s of ring = 51.4 s.
 *
 * What stays from V1 (experiments/afterimage-pulse-001, unchanged): the pulse-pair hook (a pickup leaping a sixth into
 * a held note, onsets 0-2 | 5-7 | 10-12, the answer that settles / yearns / resolves), 136 BPM, the music-box
 * afterimage a dotted eighth behind, and the vulnerable choir passage with its sink into C major.
 *
 * What V2 changes:
 *   1. The hook's voice. No toy pluck: THRONE//VOLT plays it from bar 1. Every pickup is closed and dark; every held
 *      note opens through a sync sweep (a "da-YOW"); long notes grow growl and late vibrato. Three performances:
 *      dark and close (image), talking (pulse), full voice (payoff), each shaped per phrase rather than per section.
 *   2. The groove. Eight bars that never repeat a bar: displaced kicks, a late snare, ghost and hat accents that move.
 *      In bars 9-11 the bass breaks into dotted eighths (the afterimage's own delay) against the hook, dragging the
 *      kick with it off the downbeat, and realigns on bar 12's downbeat.
 *   3. The glitch passage: voice and bass take the melody apart and rebuild it. Bar 13: pickups in the voice, held notes
 *      in the bass. Bar 14: they swap. Bar 15: the bass leads and the voice is its afterimage. Bar 16: they converge in
 *      octaves, then three sixteenths of total silence, then the cry.
 *   4. The payoff (8 bars): C -> A lifts; a choir descant rises against the falling hook; the hook is heard over the
 *      tonic for the first time (bar 23); the bass finishes the hook's answer (bar 24); the pulse pairs break free as a
 *      5-sixteenth cascade that climbs across the bar lines over a falling bass, kick and bass on every pickup (bars
 *      25-26), and realigns exactly on bar 27's downbeat, where lead and descant meet on B; then D# -> E. The music box
 *      ends the record with the opening image.
 *
 *   node experiments/afterimage-pulse-002/compose.ts [--candidate]     writes source/
 *
 * Times are beats from the start of bar 1; s = sixteenths within a bar. --candidate reproduces the composition exactly
 * as rendered and measured before the one bounded QA/fix pass (README).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const CANDIDATE = process.argv.includes('--candidate') || process.env.AFTERIMAGE_CANDIDATE === '1';
export const BPM = 136, BARS = 28, END = BARS * 4, TAIL_SECONDS = 2, KEY = 'E major';
export const BEAT_SECONDS = 60 / BPM;
const SCHEMA = 'daemonv12.signature-rack.score/1';

// ================================================================================================ helpers (as V1)
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
export function pos(beat: number): string {
  const tick = Math.round(beat * 960), bar = Math.floor(tick / 3840) + 1, inBar = tick % 3840, b = Math.floor(inBar / 960) + 1, off = inBar % 960;
  if (!off) return `${bar}:${b}`;
  const g = gcd(off, 3840);
  return `${bar}:${b}+${off / g}/${3840 / g}`;
}
export function dur(beats: number): string { const t = Math.max(1, Math.round(beats * 960)), g = gcd(t, 3840); return `${t / g}/${3840 / g}`; }
const ms = (m: number) => m / 1000 / BEAT_SECONDS;
const semis = (n: number) => r6(Math.pow(2, n / 12));
const hash = (i: number) => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NN: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export function midi(n: string): number { const m = /^([A-G][#b]?)(-?\d)$/.exec(n); if (!m) throw new Error(`bad pitch ${n}`); return 12 * (Number(m[2]) + 1) + NN[m[1]!]!; }
const nm = (m: number) => `${SHARP[m % 12]}${Math.floor(m / 12) - 1}`;
const tr = (n: string, k: number) => (k ? nm(midi(n) + k) : n);
export const at = (bar: number, s = 0) => 4 * (bar - 1) + s / 4;
const SWING: [number, number][] = [[0, 0.55], [16, 0.57], [48, 0.6], [64, 0.5], [80, 0.57]];
const swingAt = (beat: number) => { let s = SWING[0]![1]; for (const [b, v] of SWING) if (beat >= b - 1e-9) s = v; return s; };
export function sw(beat: number, amount = swingAt(beat)): number {
  const q = beat * 4, k = Math.round(q);
  return Math.abs(q - k) < 1e-6 && k % 2 !== 0 ? beat + (amount - 0.5) * 0.5 : beat;
}
const S = (bar: number, s: number, amount?: number) => r6(sw(at(bar, s), amount));
type Opts = Record<string, string | number>;
export type RackNote = [number, number, string, number, Opts?];
const rn = (beat: number, beats: number, pitch: string, vel: number, o?: Opts): RackNote => { const v = r6(Math.min(1, vel)); return o && Object.keys(o).length ? [r6(beat), r6(beats), pitch, v, o] : [r6(beat), r6(beats), pitch, v]; };
const n16 = (bar: number, s: number, d: number, pitch: string, vel: number, o?: Opts, amount?: number, gate = 1): RackNote => {
  const a = S(bar, s, amount), b = S(bar, s + d, amount);
  return rn(a, (b - a) * gate, pitch, vel, o);
};

// ================================================================================================ form
export const SECTIONS = [
  { id: 'image', bars: 4, development: 'The hook on THRONE//VOLT, dark and close: closed pickups, held notes that open; the music box behind it; kick and bass from bar 3; a hand-drum answer.' },
  { id: 'pulse', bars: 8, development: 'Eight bars of 2-step that never repeat a bar. The hook talks; the bass answers each held note with its own phrase, then in bars 9-11 pulls against the hook in dotted eighths and drags the kick off the downbeat until bar 12 realigns.' },
  { id: 'glitch', bars: 4, development: 'E minor: Am, B7, Cmaj7#11, D7. Voice and bass split the melody (pickups/held notes), swap, become leader and afterimage, converge in octaves; three sixteenths of silence; the cry.' },
  { id: 'afterimage', bars: 4, development: 'As V1: no drums, a heartbeat, the hook at half speed in the choir, the music box at tempo; the sink into C major and the bloom.' },
  { id: 'payoff', bars: 8, development: 'The lift to A; a rising descant against the falling hook; the hook over the tonic; the bass finishes the answer; the 5-sixteenth cascade climbs across the bar lines over a falling bass and lands on a downbeat; D# -> E; the music box replays the opening image.' },
];
export const SEC = { image: 0, pulse: 16, glitch: 48, afterimage: 64, payoff: 80, cascade: 96, home: 104, end: END } as const;

// ================================================================================================ the hook (as V1)
type Cell = [number, number, string][];
export const H1: Cell = [[0, 2, 'G#4'], [2, 3, 'E5'], [5, 2, 'F#4'], [7, 3, 'D#5'], [10, 2, 'E4'], [12, 4, 'C#5']];
export const H1R: Cell = [[0, 2, 'G#4'], [2, 3, 'E5'], [5, 2, 'F#4'], [7, 3, 'D#5'], [10, 2, 'B4'], [12, 4, 'G#5']];
export const H2A: Cell = [[0, 2, 'B4'], [2, 3, 'C#5'], [5, 2, 'E5'], [7, 9, 'B4']];
export const H2B: Cell = [[0, 2, 'B4'], [2, 3, 'C#5'], [5, 2, 'E5'], [7, 9, 'G#5']];
// V2 developments of the second groove statement
const H2RISE: Cell = [[0, 2, 'B4'], [2, 3, 'C#5'], [5, 2, 'E5'], [7, 9, 'F#5']];                                         // the answer rises instead of settling
const H1HIGH: Cell = [[0, 2, 'G#4'], [2, 3, 'E5'], [5, 2, 'F#4'], [7, 3, 'D#5'], [10, 2, 'C#5'], [12, 4, 'A5']];            // the reach goes a step further
const isPickup = (c: Cell, i: number) => c[i]![1] === 2 && i % 2 === 0;
/** The payoff cascade: seven pulse pairs every 5 sixteenths from bar 25, each a sixth, climbing; the seventh target lands on bar 27's downbeat. */
const CASCADE: [string, string][] = [['E4', 'C#5'], ['F#4', 'D#5'], ['G#4', 'E5'], ['A4', 'F#5'], ['B4', 'G#5'], ['C#5', 'A5'], ['D#5', 'B5']];

// ================================================================================================ THRONE//VOLT · lead
interface Style { name: string; vPick: number; vTarget: number; slide: number; syncLo: number; syncHi: number; growl: number; accent?: boolean }
const DARK: Style = { name: 'dark', vPick: 0.6, vTarget: 0.72, slide: 0.16, syncLo: 0, syncHi: 0.16, growl: 0 };
const TALK: Style = { name: 'talk', vPick: 0.74, vTarget: 0.86, slide: 0.1, syncLo: 0.02, syncHi: 0.3, growl: 0.14 };
const TALK2: Style = { name: 'talk2', vPick: 0.78, vTarget: 0.9, slide: 0.08, syncLo: 0.03, syncHi: 0.4, growl: 0.24, accent: true };
const FULL: Style = { name: 'full', vPick: 0.82, vTarget: 0.95, slide: 0.07, syncLo: 0.04, syncHi: 0.5, growl: 0.32, accent: true };
interface LeadNote { note: RackNote; target: boolean; style: Style }
const LEAD: LeadNote[] = [];
/** One bar of the hook. Within a bar the three pairs crescendo slightly (the descending line leans forward). */
function leadBar(bar: number, cell: Cell, st: Style, last?: Opts) {
  cell.forEach(([s, d, p], i) => {
    const pick = isPickup(cell, i), arc = 0.03 * Math.floor(i / 2);
    if (pick) { LEAD.push({ note: n16(bar, s, d, p, st.vPick + arc + 0.02 * hash(bar * 17 + i)), target: false, style: st }); return; }
    const o: Opts = { slide: st.slide };
    if (st.accent && i === 1) o.articulation = 'accent';
    if (i === cell.length - 1 && last) Object.assign(o, last);
    LEAD.push({ note: n16(bar, s, d, p, st.vTarget + arc + 0.02 * hash(bar * 31 + i), o), target: true, style: st });
  });
}
leadBar(1, H1, DARK); leadBar(2, H2A, DARK); leadBar(3, H1R, DARK); leadBar(4, H2B, DARK);
leadBar(5, H1, TALK); leadBar(6, H2A, TALK); leadBar(7, H1R, TALK); leadBar(8, H2B, TALK);
leadBar(9, H1, TALK2); leadBar(10, H2RISE, TALK2); leadBar(11, H1HIGH, TALK2); leadBar(12, H2B, TALK2, { articulation: 'fall', fall: 5, fallBeats: 0.9 });
// payoff: the original octave, full voice
leadBar(21, H1, FULL); leadBar(22, H2B, FULL); leadBar(23, H1R, FULL);
LEAD.push({ note: n16(24, 0, 2, 'B4', 0.82), target: false, style: FULL }, { note: n16(24, 2, 3, 'C#5', 0.94, { slide: 0.07, articulation: 'accent' }), target: true, style: FULL });
CASCADE.forEach(([p, t], i) => {
  const s = 5 * i, v = 0.8 + 0.025 * i;
  LEAD.push({ note: n16(25, s, 2, p, v), target: false, style: FULL });
  LEAD.push({ note: n16(25, s + 2, i === 6 ? 5 : 3, t, v + 0.08, { slide: 0.06, ...(i === 6 ? { articulation: 'accent' } : {}) }), target: true, style: FULL });
});
LEAD.push({ note: n16(27, 5, 2, 'D#5', 0.86), target: false, style: FULL }, { note: n16(27, 7, 13, 'E5', 0.98, { slide: 0.07 }), target: true, style: { ...FULL, growl: 0.12 } });
const leadNotes = LEAD.map(l => l.note);

/** Per-note timbre lanes: sync opens through each held note ("da-YOW"), growl grows late in the long ones. */
function leadLanes() {
  const sync: [number, number][] = [], growl: [number, number][] = [];
  const L = [...LEAD].sort((a, b) => a.note[0] - b.note[0]);
  L.forEach((l, i) => {
    const [a, d] = l.note, e = a + d, nxt = L[i + 1]?.note[0] ?? e + 1, st = l.style;
    if (!l.target) { sync.push([a, st.syncLo]); return; }
    const rise = Math.min(0.45, 0.6 * d);
    sync.push([a, st.syncLo], [a + rise, st.syncHi]);
    if (nxt - 0.06 > a + rise) sync.push([nxt - 0.06, st.syncHi * 0.9]);
    if (d >= 1.4 && st.growl > 0) growl.push([a, 0], [a + 0.4 * d, 0], [a + 0.85 * d, st.growl], [Math.min(nxt, e + 0.15), 0]);
  });
  const clean = (xs: [number, number][]) => { const out: [number, number][] = []; for (const [b, v] of xs.sort((x, y) => x[0] - y[0])) { const p = out[out.length - 1]; if (p && b <= p[0] + 1e-4) { p[1] = r6(v); continue; } out.push([r6(b), r6(v)]); } return out; };
  return { sync: clean(sync), growl: clean([[0, 0], ...growl]) };
}
const LANES = leadLanes();

// ================================================================================================ THRONE//VOLT · pad (breathes in the hook rhythm in the engine)
const CH = {
  A: ['A3', 'C#4', 'E4', 'G#4'], Bs: ['B3', 'E4', 'F#4', 'A4'], Cm: ['B3', 'C#4', 'E4', 'G#4'], B7: ['B3', 'D#4', 'F#4', 'A4'],
  Am: ['A3', 'C4', 'E4', 'G4'], C: ['C4', 'E4', 'G4', 'B4'], D7: ['A3', 'C4', 'D4', 'F#4'],
  E: ['B3', 'E4', 'F#4', 'G#4'], EG: ['G#3', 'B3', 'E4', 'F#4'], Fsm9: ['A3', 'C#4', 'E4', 'G#4'],
} as const;
type ChordId = keyof typeof CH;
const padNotes: RackNote[] = [];
const pad = (from: number, to: number, c: ChordId, v: number, art = 'normal') => { for (const p of CH[c]) padNotes.push(rn(from, to - from, p, v, art === 'normal' ? undefined : { articulation: art })); };
const PADI: ChordId[] = ['A', 'Bs', 'A', 'Cm'];
PADI.forEach((c, i) => pad(at(1 + i), at(2 + i), c, 0.56, i === 0 ? 'swell' : 'normal'));
for (let i = 0; i < 8; i++) pad(at(5 + i), at(6 + i), PADI[i % 4]!, 0.64);
(['Am', 'B7', 'C'] as ChordId[]).forEach((c, i) => pad(at(13 + i), at(14 + i), c, 0.58));
pad(at(16), S(16, 6), 'D7', 0.58);
pad(at(21), at(22), 'A', 0.62); pad(at(22), at(23), 'B7', 0.62); pad(at(23), at(24), 'E', 0.66); pad(at(24), at(25), 'Cm', 0.62);
pad(at(25), at(25, 8), 'A', 0.64); pad(at(25, 8), at(26), 'EG', 0.64); pad(at(26), at(26, 8), 'Fsm9', 0.66); pad(at(26, 8), at(27), 'B7', 0.68);
pad(at(27), S(27, 7), 'Bs', 0.66); pad(S(27, 7), at(28, 8), 'E', 0.7);

// ================================================================================================ the afterimage (music box): frames the record
function echoTargets(bar: number, cell: Cell, v: number, art?: string): RackNote[] {
  return cell.filter((_, i) => !isPickup(cell, i)).map(([s, d, p], i) => n16(bar, s + 3, Math.min(d, 4), tr(p, 12), v + 0.04 * hash(bar * 13 + i), art ? { articulation: art } : undefined));
}
const memory = (bar: number, cell: Cell, v: number): RackNote[] =>
  cell.map(([s, d, p], i) => n16(bar, s, Math.min(d, 3), tr(p, 12), v * (isPickup(cell, i) ? 0.8 : 1) + 0.03 * hash(bar * 19 + i), { articulation: 'soft' }, 0.57));
const echoNotes: RackNote[] = [
  ...echoTargets(1, H1, 0.5), ...echoTargets(2, H2A, 0.5), ...echoTargets(3, H1R, 0.52), ...echoTargets(4, H2B, 0.52),
  ...memory(17, H1, 0.3), ...memory(18, H1, 0.24),
  // the end: the opening image once more, alone (E6, D#6, then C#6 left ringing)
  ...echoTargets(28, H1, 0.5).map((n, i, a) => (i === a.length - 1 ? rn(n[0], 1.6, n[2], 0.55, { articulation: 'ring' }) : n)),
];

// ================================================================================================ Living Bass
type B16 = [number, number, string, number, Opts?];
const bassNotes: RackNote[] = [], BASS_MELODY: RackNote[] = [];
const bassBar = (bar: number, ns: B16[], melodic = false) => ns.forEach(([s, d, p, v, o]) => { const n = n16(bar, s, d, p, v, o, undefined, 0.94); bassNotes.push(n); if (melodic) BASS_MELODY.push(n); });
const acc = { articulation: 'accent' }, st = { articulation: 'staccato' }, gh = { articulation: 'ghost' };
const leg = (slide = 0.06, extra: Opts = {}) => ({ articulation: 'legato', slide, ...extra });
// image
bassBar(3, [[0, 3, 'A1', 0.82], [10, 3, 'A1', 0.78], [14, 2, 'A2', 0.5, gh]]);
bassBar(4, [[0, 3, 'C#2', 0.84], [10, 2, 'C#2', 0.74], [14, 2, 'B1', 0.7, leg(0.12)]]);
// pulse, statement 1: support, then answer each held note with a phrase of its own
bassBar(5, [[0, 2, 'A1', 0.95, acc], [3, 1, 'A2', 0.55, st], [6, 2, 'E2', 0.7], [10, 2, 'A1', 0.86], [13, 1, 'C#2', 0.6, st], [14, 2, 'A#1', 0.7, leg(0.1)]]);
bassBar(6, [[0, 3, 'B1', 0.95, acc], [3, 1, 'B2', 0.55, st], [7, 2, 'F#2', 0.78], [9, 1, 'A2', 0.66], [10, 2, 'B2', 0.82, leg(0.05)], [12, 1, 'D#3', 0.7], [13, 1, 'C#3', 0.66], [14, 1, 'B2', 0.64], [15, 1, 'G#2', 0.62]]);
bassBar(7, [[0, 2, 'A1', 0.95, acc], [2, 1, 'E2', 0.5, gh], [5, 2, 'A2', 0.74], [8, 1, 'A1', 0.7, st], [10, 2, 'E2', 0.8], [13, 1, 'G#2', 0.64, st], [14, 2, 'B1', 0.72, leg(0.1)]]);
bassBar(8, [[0, 3, 'C#2', 0.95, acc], [3, 1, 'C#3', 0.55, st], [7, 1, 'G#2', 0.74], [8, 1, 'B2', 0.7], [9, 2, 'C#3', 0.82, leg(0.05, { scoop: 2 })], [11, 1, 'E3', 0.72], [12, 1, 'D#3', 0.7], [13, 1, 'B2', 0.68], [14, 2, 'G#2', 0.72, leg(0.12)]]);
// pulse, statement 2: the bass pulls against the hook in dotted eighths (every 3 sixteenths) from bar 9 to bar 12's downbeat
const DOTTED: [string, number, Opts?][] = [
  ['A1', 0.96, acc], ['A2', 0.66], ['E2', 0.76], ['A1', 0.86], ['A2', 0.68], ['C#2', 0.74],      // bar 9 (A)
  ['B1', 0.94, acc], ['B2', 0.68], ['F#2', 0.78], ['B1', 0.86], ['B2', 0.7],                     // bar 10 (B), from s2
  ['A1', 0.94, acc], ['A2', 0.7], ['E2', 0.8], ['A1', 0.88], ['B1', 0.8, leg(0.1)],              // bar 11 (A), from s1
];
DOTTED.forEach(([p, v, o], k) => { const abs = 3 * k, bar = 9 + Math.floor(abs / 16); bassBar(bar, [[abs % 16, 2, p, v, o]]); });
bassBar(12, [[0, 3, 'C#2', 1, acc], [3, 1, 'C#3', 0.58, st], [7, 1, 'G#2', 0.74], [8, 1, 'B2', 0.7], [10, 2, 'C#3', 0.82, leg(0.05)], [13, 1, 'E2', 0.66], [14, 2, 'G#1', 0.72, leg(0.12)]]);
// glitch: the bass holds half of the melody (two octaves under the hook, so it reads as melody on a phone)
bassBar(13, [[2, 3, 'E3', 0.86, { scoop: 5 }], [7, 3, 'D3', 0.84, { scoop: 5 }], [12, 3, 'C3', 0.86, { scoop: 5 }], [15, 1, 'A1', 0.6, gh]], true);
bassBar(14, [[0, 2, 'B1', 0.95, acc], [5, 2, 'F#2', 0.86], [8, 6, 'B1', 0.84], [14, 2, 'C2', 0.8, leg(0.3)]], true);
bassBar(15, [[0, 2, 'G2', 0.88, acc], [2, 3, 'E3', 0.86, leg(0.08)], [5, 2, 'F#2', 0.84], [7, 3, 'D3', 0.84, leg(0.08)], [10, 2, 'B2', 0.86], [12, 4, 'G3', 0.88, leg(0.08)]], true);
bassBar(16, [[0, 1, 'A2', 0.9], [1, 1, 'F#3', 0.84], [2, 1, 'B2', 0.86], [3, 1, 'G3', 0.84], [4, 1, 'C3', 0.88], [5, 1, 'A3', 0.86], [9, 5, 'D2', 0.86, { dive: 7, diveBeats: 0.7 }]], true);
// afterimage (as V1): warm, long; C#2 sinks to C2 with the harmony on the and-of-4
bassBar(17, [[0, 15.5, 'F#1', 0.62]]); bassBar(18, [[0, 15.5, 'A1', 0.62]]);
bassBar(19, [[0, 14, 'C#2', 0.62]]); bassBar(19, [[14, 17.5, 'C2', 0.6]]);
// payoff
bassBar(21, [[0, 6, 'A1', 0.98, acc], [7, 1, 'E2', 0.66, st], [10, 2, 'A1', 0.86], [12, 1, 'C#2', 0.66, st], [13, 1, 'E2', 0.66, st], [14, 2, 'A#1', 0.72, leg(0.1)]]);
bassBar(22, [[0, 3, 'B1', 0.95, acc], [3, 1, 'B2', 0.6, st], [7, 2, 'F#2', 0.78], [10, 2, 'B2', 0.8], [13, 2, 'A2', 0.74], [15, 1, 'D#2', 0.72, leg(0.1)]]);
bassBar(23, [[0, 7, 'E1', 1, acc], [7, 1, 'E2', 0.7, st], [10, 2, 'B1', 0.86], [13, 1, 'D#2', 0.66, st], [14, 2, 'B1', 0.72, leg(0.1)]]);
// bar 24: the bass finishes the hook's answer (E -> B leap, the swoop), then walks into the cascade
bassBar(24, [[0, 3, 'C#2', 0.95, acc], [5, 2, 'E2', 0.86], [7, 3, 'B2', 0.92, leg(0.07)], [10, 2, 'C#3', 0.86], [12, 2, 'G#2', 0.82, leg(0.06)], [14, 2, 'F#2', 0.8]], true);
// the cascade: a low root on every pickup, its octave on every target, the roots falling A A G# G# F# B B while the melody climbs
const CROOT = ['A1', 'A1', 'G#1', 'G#1', 'F#1', 'B1', 'B1'];
CROOT.forEach((r, i) => {
  const s = 5 * i, bar = 25 + Math.floor(s / 16);
  bassBar(bar, [[s % 16, 2, r, 0.94, i === 0 ? acc : undefined], ...(i < 6 ? [[(s % 16) + 2, 3, tr(r, 12), 0.82, leg(0.06)] as B16] : [])]);   // the last target is bar 27's landing
});
bassBar(27, [[0, 5, 'B1', 1, acc], [7, 9, 'E1', 1, acc], [16, 2, 'E1', 0.9, acc]]);
bassNotes.sort((a, b) => a[0] - b[0]);
const bassMacro = { steps: [[0, 0.3], [16, 0.38], [32, 0.48], [48, 0.66], [56, 0.72], [60, 0.8], [64, 0.02], [80, 0.5], [96, 0.6], [104, 0.52]] as [number, number][], glide: 0.25 };
const bassMotion = [
  { fromBeat: 16, toBeat: 32, preset: 'eighths' }, { fromBeat: 32, toBeat: 44, preset: 'sixteenths' }, { fromBeat: 44, toBeat: 48, preset: 'eighths' },
  { fromBeat: 48, toBeat: 63, preset: 'growl' }, { fromBeat: 63, toBeat: 80, preset: 'none' }, { fromBeat: 80, toBeat: 112, preset: 'sixteenths' },
];

// ================================================================================================ Impossible Voice (glitch): closed pickups, open targets
const V = (vowel: string, extra: Opts = {}) => ({ vowel, ...extra });
const voiceNotes: RackNote[] = [
  // bar 13 (Am): the voice keeps only the pickups; the bass sings the held notes
  n16(13, 0, 1.4, 'G4', 0.76, V('ee', { articulation: 'detached' })), n16(13, 5, 1.4, 'F#4', 0.74, V('ee', { articulation: 'detached' })), n16(13, 10, 1.4, 'E4', 0.74, V('ee', { articulation: 'detached' })),
  // bar 14 (B7): swapped: the bass has the pickups, the voice the held notes; the second cries up to A and holds
  n16(14, 2, 2.4, 'D#5', 0.86, V('ah', { articulation: 'cry', cry: 2 })), n16(14, 7, 6, 'A5', 0.88, V('ah', { to: 'ee', articulation: 'fall', fall: 2 })),
  // bar 15 (Cmaj7#11): the voice is the bass's afterimage, a dotted eighth behind and two octaves up
  n16(15, 3, 1.4, 'G4', 0.74, V('ee')), n16(15, 5, 2.4, 'E5', 0.84, V('ah')), n16(15, 8, 1.4, 'F#4', 0.72, V('ee')), n16(15, 10, 2.4, 'D5', 0.82, V('oh')),
  n16(15, 13, 1.4, 'B4', 0.76, V('eh')), n16(15, 15, 1, 'G5', 0.84, V('ah')),
  // bar 16 (D7): together in octaves on the quickened pairs; silence from s6 to s9; the cry carries into the afterimage
  n16(16, 0, 1, 'A4', 0.74, V('ee')), n16(16, 1, 1, 'F#5', 0.82, V('ah')), n16(16, 2, 1, 'B4', 0.76, V('ee')), n16(16, 3, 1, 'G5', 0.84, V('ah')),
  n16(16, 4, 1, 'C5', 0.78, V('ee')), n16(16, 5, 1, 'A5', 0.88, V('ah')),
  n16(16, 9, 11, 'A5', 0.86, V('ah', { to: 'oo', articulation: 'cry', cry: 1 })),
];

// ================================================================================================ HEAVEN//MASS
type Part = 'bass' | 'tenor' | 'alto' | 'soprano';
const CHOIR: Record<Part, RackNote[]> = { bass: [], tenor: [], alto: [], soprano: [] };
const sing = (p: Part, bar: number, s: number, d: number, pitch: string, v: number, o: Opts) => CHOIR[p].push(n16(bar, s, d, pitch, v, o, 0.5));
// afterimage: exactly as V1
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
// payoff: the descant rises one step a bar against the falling hook (G#5 A5 B5 C#6), holds C#6 over the cascade, comes down
// to B5 to meet the lead's landing, and settles on G#5 with it on E; basses on the roots; altos and tenors only for the last chord
const DESCANT: [number, number, number, string][] = [[21, 0, 16, 'G#5'], [22, 0, 16, 'A5'], [23, 0, 16, 'B5'], [24, 0, 32, 'C#6'], [26, 0, 23, 'B5'], [27, 7, 17, 'G#5']];
DESCANT.forEach(([bar, s, d, p], i) => sing('soprano', bar, s, d, p, 0.8 + 0.03 * Math.min(i, 4), { vowel: 'ah', articulation: i === 0 ? 'swell' : 'legato' }));
const ROOTS: [number, number, number, string][] = [[21, 0, 16, 'A2'], [22, 0, 16, 'B2'], [23, 0, 16, 'E3'], [24, 0, 16, 'C#3'], [25, 0, 8, 'A2'], [25, 8, 8, 'G#2'], [26, 0, 8, 'F#2'], [26, 8, 8, 'B2'], [27, 0, 7, 'B2'], [27, 7, 17, 'E3']];
ROOTS.forEach(([bar, s, d, p], i) => sing('bass', bar, s, d, p, 0.76, { vowel: 'oh', articulation: i === 0 ? 'swell' : 'legato' }));
sing('tenor', 27, 7, 17, 'G#3', 0.8, { vowel: 'ah', articulation: 'swell' }); sing('alto', 27, 7, 17, 'B4', 0.8, { vowel: 'ah', articulation: 'swell' });
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
const BLOOM = S(19, 14);
const CHOIR_MACRO = { steps: [[0, 0.06], [64, 0.06], [72, 0.14], [BLOOM + 0.2, 0.9], [80, 0.8], [96, 0.92], [104, 1]] as [number, number][], glide: 1.2 };
const CHOIR_ENSEMBLE = { steps: [[0, 0.2], [64, 0.2], [68, 0.34], [BLOOM, 0.42], [BLOOM + 2, 1], [80, 1]] as [number, number][], glide: 1.6 };
const CHOIR_EXPR: [number, number][] = [[64, 0.56], [72, 0.62], [BLOOM, 0.7], [79, 0.84], [80, 0.78], [96, 0.86], [104, 0.92]];

// ================================================================================================ percussion (rack)
const logNotes: RackNote[] = [], skinNotes: RackNote[] = [], clockNotes: RackNote[] = [];
const L = (bar: number, s: number, art: string, pitch: string, v: number) => logNotes.push(n16(bar, s, 1, pitch, v, { articulation: art }));
const K = (bar: number, s: number, d: number, art: string, pitch: string, v: number, o: Opts = {}, amount?: number) => skinNotes.push(n16(bar, s, d, pitch, v, { articulation: art, ...o }, amount));
for (let b = 1; b <= 4; b++) { L(b, 4, 'rim', 'D4', 0.34); L(b, 12, 'rim', 'D4', 0.38); }
// pulse: wood answers that move with the bar (never the same two bars running)
const WOOD: Record<number, [number, string, string, number][]> = {
  5: [[3, 'knuckle', 'B4', 0.3], [14, 'rim', 'E4', 0.3]], 6: [[7, 'rim', 'E4', 0.34], [9, 'knuckle', 'B4', 0.28], [15, 'knuckle', 'E5', 0.3]],
  7: [[6, 'knuckle', 'B4', 0.3], [11, 'rim', 'E4', 0.3]], 8: [[3, 'knuckle', 'B4', 0.3], [10, 'rim', 'E4', 0.34], [15, 'knuckle', 'E5', 0.38]],
  9: [[5, 'rim', 'E4', 0.3], [14, 'knuckle', 'B4', 0.3]], 10: [[1, 'knuckle', 'B4', 0.28], [7, 'rim', 'E4', 0.34]],
  11: [[3, 'knuckle', 'B4', 0.3], [9, 'rim', 'E4', 0.3], [14, 'rim', 'E4', 0.3]], 12: [[6, 'knuckle', 'B4', 0.3], [11, 'rim', 'E4', 0.34], [15, 'knuckle', 'E5', 0.4]],
  21: [[7, 'rim', 'E4', 0.3], [15, 'knuckle', 'B4', 0.32]], 22: [[9, 'rim', 'E4', 0.3]], 23: [[7, 'rim', 'E4', 0.3], [15, 'knuckle', 'B4', 0.32]], 24: [[3, 'rim', 'E4', 0.3]],
};
for (const [b, hits] of Object.entries(WOOD)) for (const [s, art, p, v] of hits) L(Number(b), s, art, p, v);
K(4, 8, 1, 'tap', 'E3', 0.45); K(4, 9, 1, 'slap', 'B3', 0.7); K(4, 11, 1, 'tap', 'F#3', 0.5); K(4, 12, 1, 'slap', 'C#4', 0.76);
K(4, 14, 1, 'open', 'G#3', 0.72); K(4, 15, 1, 'slap', 'E4', 0.84);
for (const b of [17, 18, 19]) for (const h of [0, 8]) { K(b, h, 1.5, 'bass', 'E2', 0.5, {}, 0.5); K(b, h + 2, 2, 'bass', 'E2', 0.7, {}, 0.5); }
K(20, 12, 1.5, 'bass', 'E2', 0.52, {}, 0.5); K(20, 14, 2, 'bass', 'E2', 0.74, {}, 0.5);
K(28, 8, 1.5, 'bass', 'E2', 0.46); K(28, 10, 2, 'bass', 'E2', 0.6);
// glitch: the clock ticks only where the voice's afterimage enters (bar 15), so the delay itself is audible
for (const s of [3, 8, 13]) clockNotes.push(n16(15, s, 0.5, 'E6', 0.46, { articulation: 'tick' }));
clockNotes.push(n16(14, 14, 0.5, 'B6', 0.4, { articulation: 'tick' }), n16(14, 15, 0.5, 'B6', 0.48, { articulation: 'tick' }));
for (const a of [logNotes, skinNotes, clockNotes]) a.sort((x, y) => x[0] - y[0]);

// ================================================================================================ rack scores
const ROOM = { rt60: 1.5, size: 1.05, damp: 6500, predelayMs: 22, lowCut: 300 };
const base = (title: string, description: string, seed: number) => ({ schema: SCHEMA, title, description, bpm: BPM, key: KEY, swing: 0.5, seed, tailSeconds: TAIL_SECONDS, masterGainDb: 0, sections: SECTIONS, room: ROOM });
const LEAD_MACRO: [number, number][] = [[0, 0.16], [15, 0.22], [16, 0.42], [31, 0.5], [32, 0.5], [47, 0.6], [80, 0.5], [88, 0.6], [92, 0.68], [96, 0.66], [103.5, 0.8], [106, 0.6], [110, 0.56]];
export const SCORES: { id: string; score: Record<string, unknown> }[] = [
  {
    id: 'lead', score: {
      ...base('AFTERIMAGE//PULSE V2: THRONE//VOLT lead', 'The hook: dark and close, talking, full voice; the cascade and the resolution.', 2361),
      parts: [{
        id: 'lead', instrument: 'throne-volt', gainDb: -3, pan: 0, room: 0.14,
        setup: { seed: 23601, glide: 0.06, release: 0.24, attack: 0.006, vibRate: 5.1, drift: 3, keytrack: 0.7, lowcut: 160 },
        macro: LEAD_MACRO, expression: [[0, 0.62], [16, 0.72], [47, 0.78], [80, 0.74], [96, 0.84], [104, 0.88]],
        controls: {
          sync: LANES.sync, growl: LANES.growl,
          width: [[0, 0.3], [16, 0.38], [80, 0.45]], vowel: [[0, 0.42], [15, 0.4], [16, 0.24], [80, 0.2]],
          drive: [[0, 0.3], [16, 0.45], [32, 0.55], [80, 0.55], [96, 0.66], [106, 0.5]], heat: [[0, 0.25], [16, 0.36], [32, 0.42], [80, 0.45], [96, 0.56], [106, 0.42]],
          sub: [[0, 0.1], [16, 0.2], [80, 0.3], [106, 0.22]], vib: [[0, 14], [16, 9], [80, 11], [104, 16]], bloom: 0.65, detune: [[0, 8], [16, 9], [80, 11]],
        },
        notes: leadNotes,
      }],
    },
  },
  {
    id: 'keys', score: {
      ...base('AFTERIMAGE//PULSE V2: THRONE//VOLT pad', 'The chord bed; its level breathes in the hook rhythm in the engine.', 2362),
      parts: [{
        id: 'pad', instrument: 'throne-volt', gainDb: -12, pan: 0, room: 0.32,
        setup: { seed: 23603, attack: 0.03, release: 0.55, drift: 6, keytrack: 0.4, lowcut: 200, glide: 0.12 },
        macro: 0.2,
        controls: { cutoff: [[0, 520], [16, 760], [48, 900], [64, 760], [80, 1000], [104, 1200]], res: 0.7, env: 0.9, drive: 0.2, heat: 0.18, sync: 0, detune: 14, sub: 0, growl: 0, vib: 4, bloom: 0.7, width: 0.9, air: 0.04, vowel: 0.1 },
        notes: padNotes.sort((a, b) => a[0] - b[0] || midi(a[2]) - midi(b[2])),
      }],
    },
  },
  {
    id: 'bassvox', score: {
      ...base('AFTERIMAGE//PULSE V2: Living Bass and Impossible Voice', 'The bass that supports, answers and challenges the hook; the voice that takes it apart with it.', 2363),
      parts: [
        {
          id: 'bass', instrument: 'living-bass', gainDb: -2, pan: 0, room: 0, setup: { seed: 23604 },
          macro: bassMacro, motion: bassMotion,
          expression: [[0, 0.72], [16, 0.78], [48, 0.84], [64, 0.6], [80, 0.84], [96, 0.88]],
          controls: { hold: { steps: [[0, 0.6], [48, 0.72], [64, 0.84], [80, 0.6], [92, 0.7], [96, 0.6]], glide: 0.5 }, ratchet: { steps: [[0, 0], [48, 1], [56, 0.5], [60, 0], [64, 0]], glide: 0.05 },
            servo: { steps: [[0, 0.3], [48, 0.85], [64, 0.1], [80, 0.4]], glide: 0.05 } },
          offsets: { grind: { steps: [[0, 0], [48, -0.45], [64, 0]], glide: 0.1 }, chassis: { steps: [[0, -0.2], [48, -0.05], [64, -0.5], [80, -0.25]], glide: 0.1 },
            bright: { steps: [[0, 0.05], [48, 0.18], [64, 0], [80, 0.1], [92, 0.22], [96, 0.12]], glide: 0.5 }, fold: { steps: [[0, 0], [48, 0.12], [64, 0], [92, 0.1], [96, 0]], glide: 0.3 } },
          notes: bassNotes,
        },
        {
          id: 'voice', instrument: 'impossible-voice', gainDb: -2, pan: 0, room: 0.3,
          setup: { seed: 23605, size: 0.15, vibRate: 5.6, vibCents: 22, vowelTau: 0.045, haloDecay: 0.9, haloGain: 0.8, halo: ['E5', 'B5', 'E6'] },
          macro: [[48, 0.32], [56, 0.5], [60, 0.62], [63, 0.72], [66, 0.6]],
          expression: [[48, 0.76], [60, 0.84], [66, 0.7]],
          controls: { tilt: 0.72, breath: 0.26, glass: [[48, 0.15], [63, 0.5]], split: [[48, 0.04], [56, 0.1], [62, 0.18]], stretch: [[48, 0], [60, 0], [63, 0.022]], shimmer: [[48, 0.1], [63, 0.4]], vib: 0.7 },
          notes: voiceNotes,
        },
      ],
    },
  },
  {
    id: 'perc', score: {
      ...base('AFTERIMAGE//PULSE V2: music box and hand percussion', 'The afterimage (Mechanical Orchestra bar), Timbre Lab hollow log and hand skin, escapement clock.', 2364),
      parts: [
        {
          id: 'echo', instrument: 'mechanical-orchestra/bar', gainDb: -6, pan: 0, room: 0.38, setup: { seed: 23606, spread: 0.85 },
          macro: { steps: [[0, 0.06], [64, 0.04], [104, 0.06]], glide: 0.5 },
          controls: { damp: { steps: [[0, 0.62], [64, 0.85], [108, 1.2]], glide: 0.25 }, hardness: { steps: [[0, 0.55], [64, 0.35], [108, 0.5]], glide: 0.25 } },
          notes: echoNotes.sort((a, b) => a[0] - b[0]),
        },
        { id: 'log', instrument: 'organic-percussion/log', gainDb: -6, pan: -0.22, room: 0.12, setup: { seed: 23607, spread: 0.35 }, macro: 0.1, humanize: { timingMs: 3, velocity: 0.08, seed: 2371 }, notes: logNotes },
        { id: 'skin', instrument: 'organic-percussion/skin', gainDb: -4, pan: 0.08, room: 0.14, setup: { seed: 23608, spread: 0.3 }, macro: { steps: [[0, 0.2], [64, 0.45], [80, 0.3]], glide: 0.5 },
          controls: { damp: { steps: [[0, 1], [64, 1.3], [80, 1.2]], glide: 0.5 } }, humanize: { timingMs: 4, velocity: 0.06, seed: 2372 }, notes: skinNotes },
        { id: 'clock', instrument: 'mechanical-orchestra/clock', gainDb: -8, pan: 0.3, room: 0.1, setup: { seed: 23609, spread: 0.4 }, macro: 0.5, notes: clockNotes },
      ],
    },
  },
  ...(['low', 'high'] as const).map((bus, k) => ({
    id: `choir-${bus}`, score: {
      ...base(`AFTERIMAGE//PULSE V2: HEAVEN//MASS ${bus}`, 'The afterimage passage (as V1); the payoff descant, roots and last chord.', 2365 + k),
      parts: (bus === 'low' ? ['bass', 'tenor'] : ['alto', 'soprano'] as Part[]).map((id, j) => ({
        id, instrument: `heaven-mass/${id}`, gainDb: id === 'soprano' ? -13 : id === 'alto' ? -12 : id === 'tenor' ? -13 : -12, pan: 0, room: 0,
        setup: { seed: 13610 + 2 * k + j, singers: id === 'soprano' ? 7 : 6, depth: 0.55, lowCut: 220, output: 'mix', ...(id === 'bass' ? { octavists: 2 } : {}) },
        macro: CHOIR_MACRO, expression: CHOIR_EXPR,
        controls: { ensemble: CHOIR_ENSEMBLE, air: { steps: [[0, 0.2], [BLOOM, 0.25], [BLOOM + 1, 0.55], [80, 0.45]], glide: 1 },
          ...(id === 'bass' ? { octavist: { steps: [[0, 0], [BLOOM, 0], [BLOOM + 0.5, 0.85], [80, 0]], glide: 0.8 } } : {}) },
        notes: CHOIR[id as Part],
      })),
    },
  })),
];

// ================================================================================================ engine drums
type Hit = [number, number];
const KG: Hit[] = [], SG: Hit[] = [], GH: Hit[] = [], HG: [number, number, string][] = [];
const k = (bar: number, s: number, v: number) => KG.push([at(bar, s), v]);
const sn = (bar: number, s: number, v: number) => SG.push([at(bar, s), v]);
const ghost = (bar: number, s: number, v: number) => GH.push([at(bar, s), v]);
const hat = (bar: number, s: number, v: number, kind = 'pix') => HG.push([at(bar, s), v, kind]);
const HAT_T: Record<string, (s: number) => number> = {
  even: s => (s % 4 === 2 ? 0.72 : s % 2 ? 0.44 : 0.32),                         // offbeat eighths lead
  push: s => (s % 4 === 3 ? 0.62 : s % 4 === 2 ? 0.52 : s % 2 ? 0.34 : 0.28),   // the 'a's push forward
  sparse: s => (s % 4 === 2 ? 0.7 : s === 7 || s === 15 ? 0.42 : 0),             // room for the dotted-eighth bass
};
const hatBar = (bar: number, t: keyof typeof HAT_T, opens: number[] = [], openV = 0.52, skip: number[] = []) => {
  for (let s = 0; s < 16; s++) { if (skip.includes(s)) continue; if (opens.includes(s)) { hat(bar, s, openV, 'open'); continue; } const v = HAT_T[t]!(s); if (v > 0) hat(bar, s, v); }
};
// image (as V1)
for (let b = 1; b <= 2; b++) for (const s of [2, 6, 10, 14]) hat(b, s, 0.42 + 0.05 * (s === 6 || s === 14 ? 1 : 0));
for (let b = 3; b <= 4; b++) for (let s = 0; s < 16; s++) hat(b, s, s % 4 === 2 ? 0.6 : s % 2 ? 0.34 : 0.26);
k(3, 0, 0.9); k(3, 10, 0.84); k(4, 0, 0.9); k(4, 7, 0.6);
// pulse: an eight-bar arc, no two bars alike. [kicks], [snares], [ghosts], hats, opens
const PULSE: [number, Hit[], Hit[], Hit[], keyof typeof HAT_T, number[]][] = [
  [5, [[0, 1], [10, 0.9]], [[4, 0.95], [12, 1]], [[9, 0.2]], 'even', []],
  [6, [[0, 1], [3, 0.58], [11, 0.86]], [[4, 0.95], [12, 1]], [[7, 0.22], [14, 0.24]], 'even', [14]],
  [7, [[0, 1], [7, 0.66], [10, 0.9]], [[4, 0.95], [12, 1]], [[15, 0.26]], 'push', []],
  [8, [[0, 1], [6, 0.7], [11, 0.86], [14, 0.6]], [[4, 0.95], [13, 1]], [[10, 0.22]], 'even', [6]],                     // the snare drags to s13
  [9, [[0, 1], [9, 0.9]], [[4, 0.95], [12, 1]], [[7, 0.2]], 'sparse', []],                                                // the kick follows the dotted bass
  [10, [[2, 0.95], [8, 0.82]], [[4, 0.95], [12, 1]], [[14, 0.24]], 'push', [10]],                                        // no kick on the downbeat
  [11, [[7, 0.9], [13, 0.84]], [[4, 0.95], [12, 1]], [[1, 0.22], [9, 0.24]], 'push', []],                                // still off it
  [12, [[0, 1], [6, 0.74], [10, 0.9], [13, 0.62]], [[4, 0.95], [12, 1], [15, 0.55]], [[7, 0.24]], 'even', [14]],        // realigned
];
for (const [b, ks, ss, gs, t, op] of PULSE) { ks.forEach(([s, v]) => k(b, s, v)); ss.forEach(([s, v]) => sn(b, s, v)); gs.forEach(([s, v]) => ghost(b, s, v)); hatBar(b, t, op); hat(b, b % 2 ? 6 : 14, 0.46, 'tick'); }
// glitch: half time with holes; bar 15 has no downbeat; bar 16 stops dead at s6
k(13, 0, 1); k(13, 11, 0.86); sn(13, 8, 1); ghost(13, 13, 0.24); for (const s of [3, 6, 11, 14]) hat(13, s, s === 6 || s === 14 ? 0.6 : 0.4);
k(14, 0, 1); k(14, 6, 0.74); sn(14, 8, 1); ghost(14, 15, 0.3); for (const s of [2, 9, 14]) hat(14, s, 0.5); hat(14, 7, 0.5, 'tick');
k(15, 3, 0.8); k(15, 10, 0.9); sn(15, 8, 1); for (const s of [6, 14]) hat(15, s, 0.56);
k(16, 0, 1); sn(16, 4, 0.92); for (const s of [1, 2, 3, 5]) hat(16, s, 0.36 + 0.06 * s);
// payoff
const PAY: [number, Hit[], Hit[], Hit[], keyof typeof HAT_T, number[]][] = [
  [21, [[0, 1], [10, 0.92]], [[4, 0.98], [12, 1]], [[9, 0.2]], 'even', [6, 14]],
  [22, [[0, 1], [3, 0.6], [11, 0.88]], [[4, 0.98], [12, 1]], [[7, 0.22]], 'even', [14]],
  [23, [[0, 1], [7, 0.8], [10, 0.92]], [[4, 0.98], [12, 1]], [[15, 0.26]], 'push', [6, 14]],
  [24, [[0, 1], [5, 0.86], [10, 0.9]], [[4, 0.98], [12, 1]], [[14, 0.24]], 'sparse', []],
  // the cascade: a kick on every pulse pickup (every 5 sixteenths), the snare anchoring 2 and 4
  [25, [[0, 1], [5, 0.9], [10, 0.92], [15, 0.9]], [[4, 0.98], [12, 1]], [], 'push', []],
  [26, [[4, 0.94], [9, 0.92], [14, 0.95]], [[4, 0.98], [12, 1]], [], 'push', [1, 6, 11]],
  [27, [[0, 1], [7, 1]], [[4, 0.98], [12, 1]], [[10, 0.22]], 'even', [7]],
];
for (const [b, ks, ss, gs, t, op] of PAY) { ks.forEach(([s, v]) => k(b, s, v)); ss.forEach(([s, v]) => sn(b, s, v)); gs.forEach(([s, v]) => ghost(b, s, v)); hatBar(b, t, op, 0.48); }
k(28, 0, 1); hat(28, 0, 0.56, 'open');
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
export const SAMPLE_FILES: [string, string][] = [
  ['v12/02-iron-pulse.wav', 'packs/v12-signature-v1/assets/v12-signature/02-iron-pulse.wav'],
  ['v12/03-titanium-crack.wav', 'packs/v12-signature-v1/assets/v12-signature/03-titanium-crack.wav'],
  ['v12/05-ghost-tick.wav', 'packs/v12-signature-v1/assets/v12-signature/05-ghost-tick.wav'],
  ['v12/06-open-circuit.wav', 'packs/v12-signature-v1/assets/v12-signature/06-open-circuit.wav'],
  ['glasshouse/06-bass-punch-cs.wav', 'examples/assets/glasshouse/06-bass-punch-cs.wav'],
  ['glasshouse/08-chrome-clap.wav', 'examples/assets/glasshouse/08-chrome-clap.wav'],
  ['glasshouse/09-pixel-hat.wav', 'examples/assets/glasshouse/09-pixel-hat.wav'],
];

// ================================================================================================ automation (V1's helpers, with V1's F5 fix built in)
type Point = { at: { musical: string }; value: number; transition: 'linear' };
const TPB = 960, RAMP = 6;
const tk = (beat: number) => Math.round(beat * TPB);
type Shape = [number, number][];
function evalShape(s: Shape, t: number, outside: number): number {
  if (t < s[0]![0] || t > s[s.length - 1]![0]) return outside;
  for (let i = 1; i < s.length; i++) { const [t0, v0] = s[i - 1]!, [t1, v1] = s[i]!; if (t <= t1) return t1 === t0 ? v1 : v0 + (v1 - v0) * (t - t0) / (t1 - t0); }
  return s[s.length - 1]![1];
}
function lane(top: number, shapes: Shape[]): Point[] {
  const endTick = tk(END) - RAMP;
  const ts = [...new Set([0, endTick, ...shapes.flat().map(([t]) => t)])].filter(t => t >= 0 && t <= endTick).sort((a, b) => a - b);
  const vals = ts.map(t => Math.max(-60, Math.min(12, shapes.reduce((acc, s) => Math.min(acc, evalShape(s, t, top)), top))));
  const out: Point[] = [];
  for (let i = 0; i < ts.length; i++) {
    if (i > 0 && i < ts.length - 1 && Math.abs(vals[i]! - vals[i - 1]!) < 1e-9 && Math.abs(vals[i]! - vals[i + 1]!) < 1e-9) continue;
    out.push({ at: { musical: pos(ts[i]! / TPB) }, value: r6(vals[i]!), transition: 'linear' });
  }
  return out;
}
type Seg = [number, number, number];
function levels(base: number, segs: Seg[], edge = 0.1): Shape {
  const s: Shape = [[0, base]];
  for (const [a, b, d] of segs) s.push([tk(a), base], [tk(a + edge), base + d], [tk(b - edge), base + d], [tk(b), base]);
  if (s[s.length - 1]![0] < tk(END)) s.push([tk(END), base]);       // a level may run past the end (into the ring)
  return s.filter((p, i) => i === 0 || p[0] > s[i - 1]![0] || p[1] !== s[i - 1]![1]);
}
/** Section levels (positive offsets allowed: the lane starts from its top) plus extra shapes (silences, fades, ducks). */
const levelLane = (base: number, segs: Seg[], extra: Shape[] = []) => lane(base + Math.max(0, ...segs.map(x => x[2])), [levels(base, segs), ...extra]);
const duck = (beat: number, lvl: number, depth: number, holdMs: number, relMs: number): Shape => [[tk(beat) - 12, lvl], [tk(beat), lvl - depth], [tk(beat + ms(holdMs)), lvl - depth], [tk(beat + ms(holdMs + relMs)), lvl]];
function ducked(base: number, segs: Seg[], hits: number[], depth: number, holdMs: number, relMs: number, extra: Shape[] = []): Point[] {
  const sh = levels(base, segs), top = base + Math.max(0, ...segs.map(x => x[2]));
  return lane(top, [sh, ...hits.map(b => duck(b, evalShape(sh, tk(b), base), depth, holdMs, relMs)), ...extra]);
}
const silence = (from: number, to: number): Shape => [[tk(from), 12], [tk(from) + RAMP, -60], [tk(to) - RAMP, -60], [tk(to), 12]];
const fadeOut = (from: number, to: number, lvl: number): Shape => [[tk(from), lvl], [tk(to), -60], [tk(END), -60]];
/** The pad's pulse: it dips on every pickup (the hook's own pickups, and the cascade's every 5 sixteenths). */
const PULSE_BEATS: number[] = [];
for (let b = 1; b <= 24; b++) if (b < 13 || b >= 21) for (const s of [0, 5, 10]) PULSE_BEATS.push(sw(at(b, s)));
for (let i = 0; i < 7; i++) PULSE_BEATS.push(sw(at(25, 5 * i)));
PULSE_BEATS.push(sw(at(27, 0)), sw(at(27, 5)));
const HOLE = { from: S(16, 6), to: S(16, 9) };      // the glitch's three sixteenths of nothing
const HATS_OUT = { from: S(16, 6), to: at(21) - 0.02 };
const STOP = S(28, 8);                              // the band releases; the music box and the heartbeat remain

// ================================================================================================ engine project
/** Track gains (dB), from V1's calibrated mix with V1's QA fixes folded in (lead and voice written into their bases). */
export const MIX = { kick: -1, snare: -0.5, hats: -4, perc: 2, echo: 3, bassSub: 4, bassMid: 0, voice: 1, lead: 3, pad: -1, choirLow: -2, choirHigh: 1, room: 0, master: -2 };
/**
 * The one bounded QA/fix pass (README). --candidate reproduces the mix exactly as rendered and measured before it.
 *   F1 the payoff descant covered the hook in 1-4 kHz: lead +4 dB written (it feeds a 2:1 compressor), descant -3 dB
 *   F2 the glitch voice sat under the melodic bass in 1-4 kHz: voice +3 dB written, the bass's glitch level -1 dB
 *   F3 the glitch was the narrowest passage (side 23 dB under mid): the voice moves to tell the story in space
 *   F4 the opening was 2 LU louder than V1's and flattened the arc: the opening lead -2.5 dB
 */
export const FIX = CANDIDATE
  ? { leadPayoff: -1, descant: -5, voiceGlitch: 0, bassMidGlitch: 2, voicePan: false, imageLead: -2 }
  : { leadPayoff: 3, descant: -8, voiceGlitch: 3, bassMidGlitch: 1, voicePan: true, imageLead: -4.5 };
const PAYOFF_DB = { lead: FIX.leadPayoff, choirLow: -7.5, choirHigh: FIX.descant, pad: -2 }, IMAGE_LEAD_DB = FIX.imageLead, HEART_DB = -5;
/** F3: bar 13 the voice's pickups sit left, bar 14 its held notes right, bar 15 the afterimage canon further right, bar 16 the octaves converge. */
function voicePan(): Point[] {
  const pts: [number, number][] = [[0, 0], [at(13) - 0.05, 0], [at(13), -0.3], [at(14) - 0.15, -0.3], [at(14), 0.3], [at(15) - 0.15, 0.3], [S(15, 3) - 0.1, 0.45],
    [at(16) - 0.25, 0.45], [at(16), 0.1], [S(16, 6), 0], [END - 0.5, 0]];
  return pts.map(([b, v]) => ({ at: { musical: pos(b) }, value: v, transition: 'linear' as const }));
}
const kickBeats = KICKS.map(([b]) => b);
const kitTrack = (id: string, description: string, kit: string, notes: EngineNote[], gainDb: number, effects: unknown[], automation?: Point[], pan?: number, panLane?: Point[]) => ({
  id, description, instrument: { type: 'drumkit', kit }, mix: { gainDb, ...(pan !== undefined ? { pan } : {}) }, effects,
  ...(automation || panLane ? { automation: { ...(automation ? { gainDb: automation } : {}), ...(panLane ? { pan: panLane } : {}) } } : {}),
  clips: [{ bar: 1, pattern: 'all' }], patterns: [{ id: 'all', bars: BARS, notes }],
});
const stemTrack = (id: string, description: string, sample: string, gainDb: number, effects: unknown[], automation?: Point[], pan?: number, panLane?: Point[]) => ({
  id, description, instrument: { type: 'sampler', sample }, mix: { gainDb, ...(pan !== undefined ? { pan } : {}) }, effects,
  ...(automation ? { automation: { gainDb: automation, ...(panLane ? { pan: panLane } : {}) } } : {}),
  clips: [{ bar: 1, pattern: 'all' }], patterns: [{ id: 'all', bars: BARS, notes: [{ start: '1:1', velocity: 1 }] }],
});
/** V1's F4: the hats drift across the field once every two bars, in the groove and the payoff only. */
function hatPan(): Point[] {
  const out: Point[] = [], val = (b: number) => (b >= SEC.pulse && b < SEC.glitch) || (b >= SEC.payoff && b < STOP) ? 0.2 + 0.35 * Math.sin(2 * Math.PI * (b - SEC.pulse) / 8) : 0.2;
  for (let b = 0; b <= END - 0.5; b += 0.5) out.push({ at: { musical: pos(b) }, value: r6(val(b)), transition: 'linear' });
  return out;
}
const XO = 120;
export const ASSETS: Record<string, [string, string][]> = {
  lead: [['lead', 'stems/lead.wav']], pad: [['keys', 'stems/pad.wav']],
  bass: [['bassvox', 'stems/bass.wav']], voice: [['bassvox', 'stems/voice.wav']],
  echo: [['perc', 'stems/echo.wav']], perc: [['perc', 'stems/log.wav'], ['perc', 'stems/skin.wav'], ['perc', 'stems/clock.wav']],
  'choir-low': [['choir-low', 'stems/bass.wav'], ['choir-low', 'stems/tenor.wav']], 'choir-high': [['choir-high', 'stems/alto.wav'], ['choir-high', 'stems/soprano.wav']],
  room: [['lead', 'stems/room.wav'], ['keys', 'stems/room.wav'], ['bassvox', 'stems/room.wav'], ['perc', 'stems/room.wav']],
};
const A = (id: string) => `assets/rack/${id}.wav`;
const holeIn = (): Shape[] => [silence(HOLE.from, HOLE.to)];

export const project = {
  formatVersion: 1,
  title: 'AFTERIMAGE//PULSE V2',
  description: 'DaemonV12 Sound Lab 03, V2: 28 bars of melodic garage-bass, E major, 136 BPM. THRONE//VOLT, Living Bass, Impossible Voice, HEAVEN//MASS, Mechanical Orchestra, Timbre Lab; V12 Signature and GLASSHOUSE drums.',
  bpm: BPM, timeSignature: '4/4', key: KEY, bars: BARS, seed: 236,
  render: { tail: { seconds: TAIL_SECONDS } },
  master: { gainDb: MIX.master, effects: [{ type: 'highpass', frequencyHz: 26 }, { type: 'compressor', thresholdDb: -16, ratio: 1.5, attackMs: 25, releaseMs: 160 }, { type: 'saturation', driveDb: 1, mix: 0.6 }] },
  tracks: [
    kitTrack('kick', 'V12 IRON PULSE body + GLASSHOUSE bass-punch knock; displaced in the groove, on every pickup in the cascade.', 'assets/kick-kit.json', kickHits, MIX.kick,
      [{ type: 'highpass', frequencyHz: 30 }, { type: 'saturation', driveDb: 3, mix: 0.25 }]),
    kitTrack('snare', 'V12 TITANIUM CRACK +1 st + GLASSHOUSE chrome clap; 5-8 ms late; one dragged backbeat; ghosts.', 'assets/snare-kit.json', snareHits, MIX.snare,
      [{ type: 'highpass', frequencyHz: 150 }, { type: 'compressor', thresholdDb: -14, ratio: 3, attackMs: 4, releaseMs: 80 }, { type: 'reverb', roomSize: 0.3, decaySeconds: 0.5, wet: 0.08 }]),
    kitTrack('hats', 'GLASSHOUSE pixel hat, V12 ghost tick and open circuit; accent patterns that change bar to bar; drifting pan.', 'assets/hats-kit.json', hatHits, MIX.hats,
      [{ type: 'highpass', frequencyHz: 4000 }], lane(MIX.hats, [silence(HATS_OUT.from, HATS_OUT.to)]), 0.2, hatPan()),
    stemTrack('perc', 'Timbre Lab hollow log and hand skin (fill, heartbeat), escapement clock (the glitch canon\'s ticks).', A('perc'), MIX.perc,
      [{ type: 'highpass', frequencyHz: 45 }, { type: 'compressor', thresholdDb: -20, ratio: 2.5, attackMs: 3, releaseMs: 90, makeupGainDb: 2 }],
      levelLane(MIX.perc, [[SEC.afterimage, SEC.payoff, HEART_DB]], holeIn())),
    stemTrack('echo', 'The afterimage: Mechanical Orchestra bar; the opening, the memory under the choir, the ending.', A('echo'), MIX.echo,
      [{ type: 'highpass', frequencyHz: 350 }], levelLane(MIX.echo, [[SEC.home + 4, END + 4, 2]])),
    stemTrack('bass-sub', `Living Bass below ${XO} Hz: mono, ducked under every kick.`, A('bass'), MIX.bassSub,
      [{ type: 'lowpass', frequencyHz: XO }, { type: 'lowpass', frequencyHz: XO }, { type: 'highpass', frequencyHz: 30 }],
      ducked(MIX.bassSub, [[SEC.afterimage, SEC.payoff, -2]], kickBeats, 9, 25, 110, [...holeIn(), fadeOut(STOP, STOP + 0.4, MIX.bassSub)]), 0),
    stemTrack('bass-mid', `Living Bass above ${XO} Hz: the talking body and the melodic bass, saturated for small speakers.`, A('bass'), MIX.bassMid,
      [{ type: 'highpass', frequencyHz: XO }, { type: 'highpass', frequencyHz: XO }, { type: 'saturation', driveDb: 6, mix: 0.5 }, { type: 'lowpass', frequencyHz: 6000 }],
      ducked(MIX.bassMid, [[SEC.pulse, SEC.glitch, -1], [SEC.glitch, SEC.afterimage, FIX.bassMidGlitch], [SEC.afterimage, SEC.payoff, -6]], kickBeats, 4, 20, 90, [...holeIn(), fadeOut(STOP, STOP + 0.4, MIX.bassMid)])),
    stemTrack('voice', 'Impossible Voice: the glitch passage, with the bass; the cry into the afterimage.', A('voice'), MIX.voice,
      [{ type: 'highpass', frequencyHz: 160 }, { type: 'compressor', thresholdDb: -20, ratio: 2, attackMs: 6, releaseMs: 120, makeupGainDb: 2 }, { type: 'delay', timeMs: r6(750 * BEAT_SECONDS), wet: 0.08 }],
      FIX.voiceGlitch ? levelLane(MIX.voice, [[SEC.glitch, SEC.afterimage + 2, FIX.voiceGlitch]], holeIn()) : lane(MIX.voice, holeIn()), undefined, FIX.voicePan ? voicePan() : undefined),
    stemTrack('lead', 'THRONE//VOLT: the hook, dark, talking, full voice; the cascade; the resolution.', A('lead'), MIX.lead,
      [{ type: 'highpass', frequencyHz: 170 }, { type: 'compressor', thresholdDb: -18, ratio: 2, attackMs: 8, releaseMs: 120, makeupGainDb: 1 }, { type: 'delay', timeMs: r6(750 * BEAT_SECONDS), wet: 0.06 }],
      levelLane(MIX.lead, [[SEC.image, SEC.pulse, IMAGE_LEAD_DB], [SEC.payoff, END, PAYOFF_DB.lead]], [fadeOut(STOP, STOP + 0.6, MIX.lead + PAYOFF_DB.lead)])),
    stemTrack('pad', 'THRONE//VOLT pad: the chord bed, breathing in the hook rhythm.', A('pad'), MIX.pad,
      [{ type: 'highpass', frequencyHz: 190 }, { type: 'lowpass', frequencyHz: 7000 }],
      ducked(MIX.pad, [[SEC.image, at(2), -3], [SEC.glitch, SEC.afterimage, -2], [SEC.payoff, END, PAYOFF_DB.pad]], PULSE_BEATS, 7, 15, 170, [...holeIn(), fadeOut(STOP, STOP + 0.8, MIX.pad + PAYOFF_DB.pad)])),
    stemTrack('choir-low', 'HEAVEN//MASS basses (octavists on the C major bloom) and tenors; payoff roots and the last chord.', A('choir-low'), MIX.choirLow,
      [{ type: 'highpass', frequencyHz: 60 }], ducked(MIX.choirLow, [[SEC.payoff, END, PAYOFF_DB.choirLow]], kickBeats.filter(b => b >= SEC.payoff), 2, 20, 120, [fadeOut(STOP, STOP + 1.2, MIX.choirLow + PAYOFF_DB.choirLow)])),
    stemTrack('choir-high', 'HEAVEN//MASS altos and sopranos: the half-speed hook and the G that lifts; the payoff descant.', A('choir-high'), MIX.choirHigh,
      [{ type: 'highpass', frequencyHz: 140 }], levelLane(MIX.choirHigh, [[SEC.payoff, END, PAYOFF_DB.choirHigh]], [fadeOut(STOP, STOP + 1.2, MIX.choirHigh + PAYOFF_DB.choirHigh)])),
    stemTrack('room', 'The shared rack room (wet only) of the lead, pad, voice/bass and percussion scores.', A('room'), MIX.room, [{ type: 'highpass', frequencyHz: 280 }], lane(MIX.room, holeIn())),
  ],
};

/** Section and event map for the QA. */
export const MAP = {
  bpm: BPM, bars: BARS, tailSeconds: TAIL_SECONDS, beatSeconds: BEAT_SECONDS,
  sections: SECTIONS.map((s, i) => ({ id: s.id, fromBeat: [0, 16, 48, 64, 80][i]!, toBeat: [16, 48, 64, 80, 112][i]! })),
  kicks: KICKS.map(([b]) => b), snares: SNARES.map(([b]) => b),
  hook: [...leadNotes.map(n => ({ part: 'lead', beat: n[0], beats: n[1], pitch: midi(n[2]), ...(n[4]?.fallBeats ? { fallBeats: n[4].fallBeats } : {}) })),
    ...voiceNotes.map(n => ({ part: 'voice', beat: n[0], beats: n[1], pitch: midi(n[2]) })),
    ...BASS_MELODY.map(n => ({ part: 'bass-mid', beat: n[0], beats: n[1], pitch: midi(n[2]) })),
    ...CHOIR.soprano.filter(n => n[0] < 80).map(n => ({ part: 'choir-high', beat: n[0], beats: n[1], pitch: midi(n[2]) }))],
  counter: CHOIR.soprano.filter(n => n[0] >= 80).map(n => ({ part: 'choir-high', beat: n[0], beats: n[1], pitch: midi(n[2]) })),
  hole: HOLE, bloomBeat: BLOOM, landingBeat: S(27, 0), resolutionBeat: S(27, 7), stopBeat: STOP,
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = join(HERE, 'source');
  mkdirSync(out, { recursive: true });
  for (const { id, score } of SCORES) writeFileSync(join(out, `${id}.score.json`), JSON.stringify(score, null, 1) + '\n');
  writeFileSync(join(out, 'afterimage-pulse-v2.project.json'), JSON.stringify(project, null, 1) + '\n');
  for (const [name, kit] of Object.entries(KITS)) writeFileSync(join(out, `${name}-kit.json`), JSON.stringify(kit, null, 2) + '\n');
  writeFileSync(join(out, 'map.json'), JSON.stringify(MAP, null, 1) + '\n');
  const count = (id: string) => SCORES.flatMap(s => (s.score.parts as { id: string; notes: unknown[] }[])).filter(p => p.id === id).reduce((n, p) => n + p.notes.length, 0);
  console.log(`wrote ${out}${CANDIDATE ? ' (candidate)' : ''}: lead ${count('lead')} (sync lane ${LANES.sync.length} points), pad ${count('pad')}, echo ${count('echo')}, bass ${count('bass')}, voice ${count('voice')}, ` +
    `choir ${CHOIR.soprano.length + CHOIR.alto.length + CHOIR.tenor.length + CHOIR.bass.length}; kicks ${KICKS.length}, snares ${SNARES.length}, ghosts ${GHOSTS.length}, hats ${HATS.length}`);
}
