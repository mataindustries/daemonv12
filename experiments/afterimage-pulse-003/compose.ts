/**
 * AFTERIMAGE//PULSE · the full-length record. E major (with C# minor and C major worlds), 136 BPM, 86 bars + 2.5 s of
 * ring = 154.3 s (2:34). Built on V2 (experiments/afterimage-pulse-002, unchanged): its hook cells, its THRONE//VOLT
 * performance lanes, its groove, glitch, afterimage passage and cascade are the foundation; everything else is new.
 *
 * Two melodies:
 *   the HOOK      pulse pairs: a short pickup leaping a sixth into a held note (onsets 0-2 | 5-7 | 10-12), as V1/V2
 *   the REPLY     new: a held root that leaps up a seventh, then falls through the fifth, fourth and third
 *                 (rhythm 6 + 2 + 3 + 3 + 2 sixteenths). It is a dark bass riff in C# minor (Undertow), a hymn in E
 *                 major (the choir), and the bass line under the hook in the finale. The two melodies fit note against note.
 *
 *   bars  1-4   IMAGE       V2: the hook dark and close, the music box behind it
 *   bars  5-12  PULSE       V2: 2-step; the bass answers, then pulls in dotted eighths and realigns
 *   bars 13-26  UNDERTOW    C#m - A - F#m - G#7. The bass leads with the reply; the synth answers with single pulse pairs,
 *                           one per bar (the hook implied); new drums that follow the bass; the voice takes two notes of
 *                           every riff in the third cycle; a breakdown and a stop on the pulse
 *   bars 27-34  DARK UNION  the hook over the reply, in C# minor: the two melodies meet in the dark
 *   bars 35-39  GLITCH      the melody passed between voice, bass, talking drum (each pair one bent stroke) and log;
 *                           the conversation converges, three sixteenths of silence, the cry
 *   bars 40-43  AFTERIMAGE  V2's choir passage, note for note: the hook at half speed, the sink into C major, the bloom
 *   bars 44-53  HYMN        C turns to E (G -> G#). The reply as a hymn at half speed: altos sing it, sopranos follow a
 *                           dotted quarter behind (the afterimage, human), the music box joins as a third voice; the
 *                           glitch's own chords (D, Am) become the tender cadence; the canon converges on the last chord
 *   bars 54-63  RETURN      the heartbeat quickens into the groove; the reply as a bass riff in E major; the synth answers
 *   bars 64-82  FINALE      the hook over the reply in the light; lead and bass swap melodies; the choir follows the
 *                           lead as an afterimage and catches up through the cascade; the cascade lands deceptively on
 *                           C major (every voice of the dominant rises a semitone) at full power; C - D - E and the
 *                           resolving pair at the top; the last groove; a bass break with the voice; the first pulse pair
 *   bars 83-86  ENDING      the music box alone: the opening image, the reply, then D# -> E. The story resolves
 *
 *   node experiments/afterimage-pulse-003/compose.ts [--candidate]     writes source/
 *
 * Times are beats from the start of bar 1; s = sixteenths within a bar.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const CANDIDATE = process.argv.includes('--candidate') || process.env.AFTERIMAGE_CANDIDATE === '1';
export const BPM = 136, BARS = 86, END = BARS * 4, TAIL_SECONDS = 2.5, KEY = 'E major';
export const BEAT_SECONDS = 60 / BPM;
const SCHEMA = 'daemonv12.signature-rack.score/1';

// ================================================================================================ helpers (as V2)
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

// ================================================================================================ form
export const SB = { image: 1, pulse: 5, undertow: 13, dark: 27, glitch: 35, after: 40, hymn: 44, ret: 54, union: 64, swap: 68, echo: 70, cascade: 72, land: 74, victory: 77, ending: 83, end: 87 } as const;
export const SECTIONS = [
  { id: 'image', bars: 4, development: 'V2: the hook dark and close; the music box behind it; kick and bass from bar 3.' },
  { id: 'pulse', bars: 8, development: 'V2: 2-step; the bass answers each held note, then pulls in dotted eighths and realigns.' },
  { id: 'undertow', bars: 14, development: 'C#m A F#m G#7: the bass leads with the reply; the synth answers with single pulse pairs; the voice takes two notes of each riff; breakdown and a stop on the pulse.' },
  { id: 'dark-union', bars: 8, development: 'The hook over the reply in C# minor.' },
  { id: 'glitch', bars: 5, development: 'One melody passed between voice, bass, talking drum and log; convergence; silence; the cry.' },
  { id: 'afterimage', bars: 4, development: 'V2 note for note: the hook at half speed in the choir; the sink into C major; the bloom.' },
  { id: 'hymn', bars: 10, development: 'C turns to E; the reply as a hymn in canon (altos, sopranos, music box); the glitch chords become the cadence.' },
  { id: 'return', bars: 10, development: 'The heartbeat quickens into the groove; the reply as an E major bass riff; the synth answers.' },
  { id: 'finale', bars: 19, development: 'Hook over reply; the swap; the choir catches up through the cascade; the deceptive landing on C; C D E; the last groove; the bass break; the first pulse pair.' },
  { id: 'ending', bars: 4, development: 'The music box alone: the opening image, the reply, the resolving pair.' },
];
const SEC_BEATS: [string, number][] = SECTIONS.reduce((acc, s) => { const from = acc.length ? acc[acc.length - 1]![1] + SECTIONS[acc.length - 1]!.bars * 4 : 0; acc.push([s.id, from]); return acc; }, [] as [string, number][]);
if (SECTIONS.reduce((n, s) => n + s.bars, 0) !== BARS) throw new Error('sections do not add up');

// swing per section (odd sixteenths delayed); the hymn and the afterimage are straight
const SWING: [number, number][] = [[0, 0.55], [at(SB.pulse), 0.57], [at(SB.undertow), 0.58], [at(SB.glitch), 0.6], [at(SB.after), 0.5], [at(SB.ret) + 8, 0.57], [at(SB.ending), 0.55]];
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

// ================================================================================================ harmony (one entry per bar; half-bar changes as "X|Y")
export const HARMONY: Record<number, string> = {
  1: 'A', 2: 'Bsus', 3: 'A', 4: 'C#m', 5: 'A', 6: 'Bsus', 7: 'A', 8: 'C#m', 9: 'A', 10: 'Bsus', 11: 'A', 12: 'C#m',
  35: 'Am', 36: 'B7', 37: 'Cmaj7#11', 38: 'Am', 39: 'D7', 40: 'F#m9', 41: 'Amaj9', 42: 'C#m7|C', 43: 'C',
  44: 'C|E', 45: 'E|E/D#', 46: 'C#m7|Amaj7', 47: 'F#m9|F#m7/E', 48: 'A|B7', 49: 'C#m|B', 50: 'G#m7|F#m7', 51: 'D', 52: 'A|Am|E/B', 53: 'E',
  54: 'E', 55: 'F#m', 56: 'C#m', 57: 'A', 58: 'E', 59: 'F#m', 60: 'C#m', 61: 'A', 62: 'E', 63: 'B',
  64: 'E', 65: 'F#m', 66: 'C#m', 67: 'A', 68: 'E', 69: 'F#m', 70: 'C#m', 71: 'C#m', 72: 'A|E/G#', 73: 'F#m9|B7', 74: 'C', 75: 'D', 76: 'E',
  77: 'E', 78: 'F#m', 79: 'C#m', 80: 'A', 81: 'B', 82: 'E',
};
const UNDER: string[] = ['C#m', 'A', 'F#m', 'G#7'];
for (let b = SB.undertow; b < SB.dark; b++) HARMONY[b] = UNDER[(b - SB.undertow) % 4]!;
for (let b = SB.dark; b < SB.glitch; b++) HARMONY[b] = UNDER[(b - SB.dark) % 4]!;
HARMONY[25] = 'C#m'; HARMONY[26] = 'G#7';

// ================================================================================================ the hook (V2 cells)
type Cell = [number, number, string][];
export const H1: Cell = [[0, 2, 'G#4'], [2, 3, 'E5'], [5, 2, 'F#4'], [7, 3, 'D#5'], [10, 2, 'E4'], [12, 4, 'C#5']];
export const H1R: Cell = [[0, 2, 'G#4'], [2, 3, 'E5'], [5, 2, 'F#4'], [7, 3, 'D#5'], [10, 2, 'B4'], [12, 4, 'G#5']];
export const H2A: Cell = [[0, 2, 'B4'], [2, 3, 'C#5'], [5, 2, 'E5'], [7, 9, 'B4']];
export const H2B: Cell = [[0, 2, 'B4'], [2, 3, 'C#5'], [5, 2, 'E5'], [7, 9, 'G#5']];
const H2RISE: Cell = [[0, 2, 'B4'], [2, 3, 'C#5'], [5, 2, 'E5'], [7, 9, 'F#5']];
const H1HIGH: Cell = [[0, 2, 'G#4'], [2, 3, 'E5'], [5, 2, 'F#4'], [7, 3, 'D#5'], [10, 2, 'C#5'], [12, 4, 'A5']];
const H2G: Cell = [[0, 2, 'C5'], [2, 3, 'C#5'], [5, 2, 'D#5'], [7, 9, 'G#5']];         // the answer on the dominant G#7 (C5 = B#4, the leading tone)
const H2V: Cell = [[0, 2, 'B4'], [2, 3, 'C#5'], [5, 2, 'D#5'], [7, 9, 'F#5']];          // the answer on B, into the finale
const isPickup = (c: Cell, i: number) => c[i]![1] === 2 && i % 2 === 0;
const CASCADE: [string, string][] = [['E4', 'C#5'], ['F#4', 'D#5'], ['G#4', 'E5'], ['A4', 'F#5'], ['B4', 'G#5'], ['C#5', 'A5'], ['E5', 'C6']];

// ================================================================================================ the reply
/** The reply in the bass register, per chord: a held root, a seventh up, then the fifth, the fourth and the third. */
const REPLY: Record<string, [string, string, string, string, string]> = {
  'C#m': ['C#2', 'B2', 'G#2', 'F#2', 'E2'], A: ['A1', 'G#2', 'E2', 'D#2', 'C#2'], 'F#m': ['F#1', 'E2', 'C#2', 'B1', 'A1'], 'G#7': ['G#1', 'F#2', 'D#2', 'C#2', 'C2'],
  E: ['E2', 'D#3', 'B2', 'A2', 'G#2'], 'F#mE': ['F#2', 'E3', 'C#3', 'B2', 'A2'], B: ['B1', 'A2', 'F#2', 'E2', 'D#2'], C: ['C2', 'B2', 'G2', 'F#2', 'E2'], D: ['D2', 'C#3', 'A2', 'G#2', 'F#2'],
};
export const REPLY_RHYTHM: [number, number][] = [[0, 6], [6, 2], [8, 3], [11, 3], [14, 2]];

// ================================================================================================ THRONE//VOLT · lead
const FIX_CENTS = CANDIDATE ? 0 : 5.5;            // F5 (see FIX below)
interface Style { name: string; vPick: number; vTarget: number; slide: number; syncLo: number; syncHi: number; growl: number; accent?: boolean }
const DARK: Style = { name: 'dark', vPick: 0.6, vTarget: 0.72, slide: 0.16, syncLo: 0, syncHi: 0.16, growl: 0 };
const TALK: Style = { name: 'talk', vPick: 0.74, vTarget: 0.86, slide: 0.1, syncLo: 0.02, syncHi: 0.3, growl: 0.14 };
const TALK2: Style = { name: 'talk2', vPick: 0.78, vTarget: 0.9, slide: 0.08, syncLo: 0.03, syncHi: 0.4, growl: 0.24, accent: true };
const NIGHT: Style = { name: 'night', vPick: 0.78, vTarget: 0.9, slide: 0.09, syncLo: 0.04, syncHi: 0.46, growl: 0.32, accent: true };     // the dark union: more growl
const SING: Style = { name: 'sing', vPick: 0.8, vTarget: 0.9, slide: 0.13, syncLo: 0.04, syncHi: 0.42, growl: 0.2 };                     // the lead sings the reply
const FULL: Style = { name: 'full', vPick: 0.82, vTarget: 0.95, slide: 0.07, syncLo: 0.04, syncHi: 0.5, growl: 0.32, accent: true };
interface LeadNote { note: RackNote; target: boolean; style: Style }
const LEAD: LeadNote[] = [];
const lp = (note: RackNote, target: boolean, style: Style) => LEAD.push({ note, target, style });
function leadBar(bar: number, cell: Cell, st: Style, last?: Opts) {
  cell.forEach(([s, d, p], i) => {
    const pick = isPickup(cell, i), arc = 0.03 * Math.floor(i / 2);
    if (pick) { lp(n16(bar, s, d, p, st.vPick + arc + 0.02 * hash(bar * 17 + i)), false, st); return; }
    const o: Opts = { slide: st.slide };
    if (st.accent && i === 1) o.articulation = 'accent';
    if (i === cell.length - 1 && last) Object.assign(o, last);
    lp(n16(bar, s, d, p, st.vTarget + arc + 0.02 * hash(bar * 31 + i), o), true, st);
  });
}
/** A single pulse pair answering the bass (the hook implied): pickup at s, target at s + 2. */
function answer(bar: number, s: number, pick: string, target: string, st: Style, tlen = 3, extra: Opts = {}) {
  lp(n16(bar, s, 2, pick, st.vPick + 0.02 * hash(bar * 7 + s)), false, st);
  lp(n16(bar, s + 2, tlen, target, st.vTarget + 0.02 * hash(bar * 11 + s), { slide: st.slide, ...extra }), true, st);
}
// image and pulse (V2)
leadBar(1, H1, DARK); leadBar(2, H2A, DARK); leadBar(3, H1R, DARK); leadBar(4, H2B, DARK);
leadBar(5, H1, TALK); leadBar(6, H2A, TALK); leadBar(7, H1R, TALK); leadBar(8, H2B, TALK);
leadBar(9, H1, TALK2); leadBar(10, H2RISE, TALK2); leadBar(11, H1HIGH, TALK2); leadBar(12, H2B, TALK2, { articulation: 'fall', fall: 5, fallBeats: 0.9 });
// undertow: the synth answers the bass, one pulse pair per bar, inside the bass's held note
const UPAIR: Record<string, [string, string]> = { 'C#m': ['G#4', 'E5'], A: ['F#4', 'D#5'], 'F#m': ['E4', 'C#5'], 'G#7': ['C5', 'G#5'] };
answer(16, 2, 'C5', 'G#5', TALK);
for (let b = 17; b <= 23; b++) { const [p, t] = UPAIR[HARMONY[b]!]!; answer(b, 2, p, t, b >= 21 ? TALK2 : TALK, b >= 21 ? 4 : 3); }
leadBar(24, H2G, TALK2);
answer(25, 2, 'G#4', 'E5', TALK2); answer(25, 10, 'E4', 'C#5', TALK2);
leadBar(26, H2G, TALK2);                                      // over the stop: the pickups are the hits, the G# hangs in the rest
// dark union
leadBar(27, H1, NIGHT); leadBar(28, H2B, NIGHT); leadBar(29, H1R, NIGHT); leadBar(30, H2G, NIGHT);
leadBar(31, H1, NIGHT); leadBar(32, H2RISE, NIGHT); leadBar(33, H1HIGH, NIGHT); leadBar(34, H2G, NIGHT, { articulation: 'fall', fall: 5, fallBeats: 0.9 });
// return: the answers again, in the major
const RPAIR: Record<string, [string, string]> = { 'C#m': ['E4', 'C#5'], A: ['B4', 'G#5'], E: ['G#4', 'E5'], 'F#m': ['F#4', 'D#5'] };
for (let b = 56; b <= 62; b++) { const [p, t] = RPAIR[HARMONY[b]!]!; answer(b, 2, p, t, TALK, HARMONY[b] === 'E' ? 2 : 3); }   // over E the held note gives way to the bass's swoop to D#
answer(62, 10, 'F#4', 'D#5', TALK);
leadBar(63, H2V, TALK2);
// finale: the hook over the reply
leadBar(64, H1, FULL); leadBar(65, H2B, FULL); leadBar(66, H1R, FULL); leadBar(67, H2RISE, FULL);
// the swap: the lead sings the reply (two octaves above the bass), swooping up each seventh
function replyLead(bar: number, chord: string, st: Style) {
  REPLY[chord]!.forEach((p, i) => {
    const [s, d] = REPLY_RHYTHM[i]!;
    lp(n16(bar, s, d, tr(p, 24), (i === 1 ? st.vTarget : st.vPick) + 0.02 * hash(bar * 5 + i), i === 1 ? { slide: st.slide } : i === 0 ? { articulation: 'accent' } : undefined), i === 1, st);
  });
}
replyLead(68, 'E', SING); replyLead(69, 'F#mE', SING);
leadBar(70, H1R, FULL);
lp(n16(71, 0, 2, 'B4', 0.82), false, FULL); lp(n16(71, 2, 3, 'C#5', 0.94, { slide: 0.07, articulation: 'accent' }), true, FULL);
// the cascade: seven pulse pairs every 5 sixteenths, climbing; the seventh lands on bar 74's downbeat, on C
CASCADE.forEach(([p, t], i) => {
  const s = 5 * i, v = 0.8 + 0.025 * i;
  lp(n16(SB.cascade, s, 2, p, v), false, FULL);
  lp(n16(SB.cascade, s + 2, i === 6 ? 16 : 3, t, v + 0.08, { slide: 0.06, ...(i === 6 ? { articulation: 'accent', ...(FIX_CENTS ? { cents: FIX_CENTS } : {}) } : {}) }), true, FULL);
});
const CLIMB: Style = { ...FULL, name: 'climb', growl: 0.28 };
lp(n16(75, 0, 16, 'D6', 0.95, { articulation: 'legato', slide: 0.3 }), true, CLIMB);
lp(n16(76, 0, 2, 'B5', 0.84), false, FULL); lp(n16(76, 2, 3, 'C#6', 0.92, { slide: 0.06 }), true, FULL);
lp(n16(76, 5, 2, 'D#6', 0.88), false, FULL); lp(n16(76, 7, 9, 'E6', 1, { slide: 0.06 }), true, { ...FULL, growl: 0.14 });
leadBar(77, H1, FULL); leadBar(78, H2B, FULL); leadBar(79, H1R, FULL); leadBar(80, H2RISE, FULL);
lp(n16(82, 0, 2, 'G#4', 0.86), false, FULL); lp(n16(82, 2, 3, 'E5', 0.96, { slide: 0.07, articulation: 'accent' }), true, FULL);
const leadNotes = LEAD.map(l => l.note).sort((a, b) => a[0] - b[0]);

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

// ================================================================================================ THRONE//VOLT · pad
const CH: Record<string, string[]> = {
  A: ['A3', 'C#4', 'E4', 'G#4'], Bsus: ['B3', 'E4', 'F#4', 'A4'], 'C#m': ['B3', 'C#4', 'E4', 'G#4'], B7: ['B3', 'D#4', 'F#4', 'A4'], B: ['B3', 'D#4', 'F#4', 'A4'],
  Am: ['A3', 'C4', 'E4', 'G4'], 'Cmaj7#11': ['C4', 'E4', 'G4', 'B4'], D7: ['A3', 'C4', 'D4', 'F#4'], 'F#m': ['A3', 'C#4', 'E4', 'G#4'], 'G#7': ['G#3', 'C4', 'D#4', 'F#4'],
  E: ['B3', 'E4', 'F#4', 'G#4'], 'E/G#': ['G#3', 'B3', 'E4', 'F#4'], 'F#m9': ['A3', 'C#4', 'E4', 'G#4'], C: ['C4', 'E4', 'G4', 'D5'], D: ['D4', 'F#4', 'A4', 'E5'],
};
const padNotes: RackNote[] = [];
const pad = (from: number, to: number, c: string, v: number, art = 'normal') => { for (const p of CH[c]!) padNotes.push(rn(from, to - from, p, v, art === 'normal' ? undefined : { articulation: art })); };
const PADI = ['A', 'Bsus', 'A', 'C#m'];
PADI.forEach((c, i) => pad(at(1 + i), at(2 + i), c, 0.56, i === 0 ? 'swell' : 'normal'));
for (let i = 0; i < 8; i++) pad(at(5 + i), at(6 + i), PADI[i % 4]!, 0.64);
for (let b = SB.undertow; b < SB.glitch; b++) pad(at(b), b === 26 ? S(26, 7) : at(b + 1), HARMONY[b]!, b < SB.dark ? 0.6 : 0.64);
(['Am', 'B7', 'Cmaj7#11', 'Am'] as const).forEach((c, i) => pad(at(35 + i), at(36 + i), c, 0.58));
pad(at(39), S(39, 6), 'D7', 0.58);
for (let b = SB.ret; b < SB.cascade; b++) { const c = HARMONY[b]!; pad(at(b), at(b + 1), c === 'F#m' ? 'F#m' : c, b < 56 ? 0.5 : 0.62); }
pad(at(72), at(72, 8), 'A', 0.64); pad(at(72, 8), at(73), 'E/G#', 0.64); pad(at(73), at(73, 8), 'F#m9', 0.66); pad(at(73, 8), at(74), 'B7', 0.68);
pad(at(74), at(75), 'C', 0.72); pad(at(75), at(76), 'D', 0.72); pad(at(76), at(77), 'E', 0.72);
for (let b = 77; b <= 81; b++) pad(at(b), at(b + 1), HARMONY[b]!, 0.64);
pad(at(82), S(82, 5), 'E', 0.66);

// ================================================================================================ the afterimage (music box)
function echoTargets(bar: number, cell: Cell, v: number, art?: string, oct = 12): RackNote[] {
  return cell.filter((_, i) => !isPickup(cell, i)).map(([s, d, p], i) => n16(bar, s + 3, Math.min(d, 4), tr(p, oct), v + 0.04 * hash(bar * 13 + i), art ? { articulation: art } : undefined));
}
const memory = (bar: number, cell: Cell, v: number): RackNote[] =>
  cell.map(([s, d, p], i) => n16(bar, s, Math.min(d, 3), tr(p, 12), v * (isPickup(cell, i) ? 0.8 : 1) + 0.03 * hash(bar * 19 + i), { articulation: 'soft' }, 0.57));
const echoNotes: RackNote[] = [
  ...echoTargets(1, H1, 0.5), ...echoTargets(2, H2A, 0.5), ...echoTargets(3, H1R, 0.52), ...echoTargets(4, H2B, 0.52),
  // the hook returns in the dark, and so does its afterimage
  ...echoTargets(31, H1, 0.42), ...echoTargets(32, H2RISE, 0.42), ...echoTargets(33, H1HIGH, 0.44),
  ...memory(40, H1, 0.3), ...memory(41, H1, 0.24),
  // the return: it follows the synth's answers
  ...[56, 57, 58, 59, 60, 61, 62].map(b => { const [, t] = RPAIR[HARMONY[b]!]!; return n16(b, 7, 3, tr(t, 12), 0.36 + 0.03 * hash(b), { articulation: 'soft' }); }),
  // the finale: the image is back
  ...echoTargets(64, H1, 0.4), ...echoTargets(66, H1R, 0.42), ...echoTargets(77, H1, 0.42), ...echoTargets(79, H1R, 0.44),
];
// the hymn: the third voice of the canon, a dotted half behind the altos, an octave up (filled in with the hymn below)
// the ending: the opening image; the reply; the resolving pair
echoNotes.push(...echoTargets(83, H1, 0.5));
REPLY.E.forEach((p, i) => { const [s, d] = REPLY_RHYTHM[i]!; echoNotes.push(n16(84, s, Math.min(d, 4), tr(p, 36), 0.48 + 0.03 * hash(i + 84), i === 0 ? { articulation: 'soft' } : undefined)); });
echoNotes.push(n16(85, 5, 2, 'D#6', 0.52), n16(85, 7, 8, 'E6', 0.6, { articulation: 'ring' }));

// ================================================================================================ Living Bass
type B16 = [number, number, string, number, Opts?];
const bassNotes: RackNote[] = [], BASS_MELODY: RackNote[] = [], REPLY_NOTES: RackNote[] = [];
const bassBar = (bar: number, ns: B16[], tag?: 'melody' | 'reply') => ns.forEach(([s, d, p, v, o]) => {
  const n = n16(bar, s, d, p, v, o, undefined, 0.94); bassNotes.push(n);
  if (tag === 'melody') BASS_MELODY.push(n); if (tag === 'reply') REPLY_NOTES.push(n);
});
const acc = { articulation: 'accent' }, st = { articulation: 'staccato' }, gh = { articulation: 'ghost' };
const leg = (slide = 0.06, extra: Opts = {}) => ({ articulation: 'legato', slide, ...extra });
/** The reply as a bass riff: the held root (scooped), the seventh as a swoop up, three falling notes. `skip` leaves notes to the voice. */
function replyBass(bar: number, chord: string, v = 0.92, skip: number[] = []) {
  const ps = REPLY[chord]!, os: (Opts | undefined)[] = [{ articulation: 'accent', scoop: 2 }, leg(0.1), undefined, undefined, st];
  bassBar(bar, REPLY_RHYTHM.map(([s, d], i) => [s, d, ps[i]!, v * [1, 0.9, 0.86, 0.84, 0.8][i]!, os[i]] as B16).filter((_, i) => !skip.includes(i)), 'reply');
}
// image + pulse (V2)
bassBar(3, [[0, 3, 'A1', 0.82], [10, 3, 'A1', 0.78], [14, 2, 'A2', 0.5, gh]]);
bassBar(4, [[0, 3, 'C#2', 0.84], [10, 2, 'C#2', 0.74], [14, 2, 'B1', 0.7, leg(0.12)]]);
bassBar(5, [[0, 2, 'A1', 0.95, acc], [3, 1, 'A2', 0.55, st], [6, 2, 'E2', 0.7], [10, 2, 'A1', 0.86], [13, 1, 'C#2', 0.6, st], [14, 2, 'A#1', 0.7, leg(0.1)]]);
bassBar(6, [[0, 3, 'B1', 0.95, acc], [3, 1, 'B2', 0.55, st], [7, 2, 'F#2', 0.78], [9, 1, 'A2', 0.66], [10, 2, 'B2', 0.82, leg(0.05)], [12, 1, 'D#3', 0.7], [13, 1, 'C#3', 0.66], [14, 1, 'B2', 0.64], [15, 1, 'G#2', 0.62]]);
bassBar(7, [[0, 2, 'A1', 0.95, acc], [2, 1, 'E2', 0.5, gh], [5, 2, 'A2', 0.74], [8, 1, 'A1', 0.7, st], [10, 2, 'E2', 0.8], [13, 1, 'G#2', 0.64, st], [14, 2, 'B1', 0.72, leg(0.1)]]);
bassBar(8, [[0, 3, 'C#2', 0.95, acc], [3, 1, 'C#3', 0.55, st], [7, 1, 'G#2', 0.74], [8, 1, 'B2', 0.7], [9, 2, 'C#3', 0.82, leg(0.05, { scoop: 2 })], [11, 1, 'E3', 0.72], [12, 1, 'D#3', 0.7], [13, 1, 'B2', 0.68], [14, 2, 'G#2', 0.72, leg(0.12)]]);
const DOTTED: [string, number, Opts?][] = [
  ['A1', 0.96, acc], ['A2', 0.66], ['E2', 0.76], ['A1', 0.86], ['A2', 0.68], ['C#2', 0.74], ['B1', 0.94, acc], ['B2', 0.68], ['F#2', 0.78], ['B1', 0.86], ['B2', 0.7],
  ['A1', 0.94, acc], ['A2', 0.7], ['E2', 0.8], ['A1', 0.88], ['B1', 0.8, leg(0.1)],
];
DOTTED.forEach(([p, v, o], k) => { const abs = 3 * k, bar = 9 + Math.floor(abs / 16); bassBar(bar, [[abs % 16, 2, p, v, o]]); });
bassBar(12, [[0, 3, 'C#2', 1, acc], [3, 1, 'C#3', 0.58, st], [7, 1, 'G#2', 0.74], [8, 1, 'B2', 0.7], [10, 2, 'C#3', 0.82, leg(0.05)], [13, 1, 'E2', 0.66], [14, 2, 'G#1', 0.72, leg(0.12)]]);
// undertow: the bass leads; in the third cycle the voice takes the riff's fifth and fourth
for (let b = SB.undertow; b <= 24; b++) replyBass(b, HARMONY[b]!, b < 17 ? 0.9 : 0.94, b >= 21 ? [2, 3] : []);
replyBass(25, 'C#m', 0.96);
bassBar(26, [[0, 3, 'G#1', 1, acc], [5, 2, 'D#2', 0.9], [14, 2, 'C2', 0.86, leg(0.1)]]);       // the stop: hits on the pulse, a held rest
for (let b = SB.dark; b < SB.glitch; b++) replyBass(b, HARMONY[b]!, 0.94);
// glitch: 35-36 as V2 (bars 13-14); 37 the bass leads the lydian shadow; 38 the round robin; 39 the convergence
bassBar(35, [[2, 3, 'E3', 0.86, { scoop: 5 }], [7, 3, 'D3', 0.84, { scoop: 5 }], [12, 3, 'C3', 0.86, { scoop: 5 }], [15, 1, 'A1', 0.6, gh]], 'melody');
bassBar(36, [[0, 2, 'B1', 0.95, acc], [5, 2, 'F#2', 0.86], [8, 6, 'B1', 0.84], [14, 2, 'C2', 0.8, leg(0.3)]], 'melody');
bassBar(37, [[0, 2, 'G2', 0.88, acc], [2, 3, 'E3', 0.86, leg(0.08)], [5, 2, 'F#2', 0.84], [7, 3, 'D3', 0.84, leg(0.08)], [10, 2, 'B2', 0.86], [12, 4, 'G3', 0.88, leg(0.08)]], 'melody');
bassBar(38, [[0, 1, 'A1', 0.7, gh], [2, 3, 'E3', 0.88, { scoop: 5 }], [5, 2, 'F#2', 0.86, acc], [14, 2, 'A1', 0.66]], 'melody');
bassBar(39, [[0, 1, 'A2', 0.9], [1, 1, 'F#3', 0.84], [2, 1, 'B2', 0.86], [3, 1, 'G3', 0.84], [4, 1, 'C3', 0.88], [5, 1, 'A3', 0.86], [9, 5, 'D2', 0.86, { dive: 7, diveBeats: 0.7 }]], 'melody');
// afterimage (V2): warm and long; C#2 sinks to C2 on the and-of-4
bassBar(40, [[0, 15.5, 'F#1', 0.62]]); bassBar(41, [[0, 15.5, 'A1', 0.62]]);
bassBar(42, [[0, 14, 'C#2', 0.62]]); bassBar(42, [[14, 17.5, 'C2', 0.6]]);
// hymn: warm roots under the choir
const HYMN_BASS: [number, number, number, string][] = [[44, 0, 8, 'C2'], [44, 8, 8, 'B1'], [45, 0, 12, 'E1'], [45, 12, 4, 'D#2'], [46, 0, 8, 'C#2'], [46, 8, 8, 'A1'],
  [47, 0, 12, 'F#1'], [47, 12, 4, 'E1'], [48, 0, 8, 'A1'], [48, 8, 8, 'B1'], [49, 0, 8, 'C#2'], [49, 8, 8, 'B1'], [50, 0, 8, 'G#1'], [50, 8, 8, 'F#1'],
  [51, 0, 16, 'D2'], [52, 0, 12, 'A1'], [52, 12, 4, 'B1'], [53, 0, 16, 'E1']];
for (const [b, s, d, p] of HYMN_BASS) bassBar(b, [[s, d - 0.3, p, 0.58]]);
// return: the reply as an E major riff, warm at first
for (let b = SB.ret; b < SB.union; b++) replyBass(b, HARMONY[b] === 'F#m' ? 'F#mE' : HARMONY[b]!, b < 56 ? 0.72 : 0.92);
// finale
for (let b = SB.union; b < SB.swap; b++) replyBass(b, HARMONY[b] === 'F#m' ? 'F#mE' : HARMONY[b]!, 0.95);
// the swap: the bass sings the hook (two octaves down), swooping into its held notes
bassBar(68, H1.map(([s, d, p], i) => [s, d, tr(p, -24), isPickup(H1, i) ? 0.9 : 0.86, isPickup(H1, i) ? (i === 0 ? acc : undefined) : leg(0.07)] as B16), 'melody');
bassBar(69, H2A.map(([s, d, p], i) => [s, d, tr(p, -24), isPickup(H2A, i) ? 0.9 : 0.86, isPickup(H2A, i) ? (i === 0 ? acc : undefined) : leg(0.07)] as B16), 'melody');
replyBass(70, 'C#m', 0.95);
bassBar(71, [[0, 3, 'C#2', 0.95, acc], [5, 2, 'E2', 0.86], [7, 3, 'B2', 0.92, leg(0.07)], [10, 2, 'C#3', 0.86], [12, 2, 'G#2', 0.82, leg(0.06)], [14, 2, 'F#2', 0.8]], 'melody');
const CROOT = ['A1', 'A1', 'G#1', 'G#1', 'F#1', 'B1', 'B1'];
CROOT.forEach((r, i) => { const s = 5 * i, bar = SB.cascade + Math.floor(s / 16); bassBar(bar, [[s % 16, 2, r, 0.94, i === 0 ? acc : undefined], ...(i < 6 ? [[(s % 16) + 2, 3, tr(r, 12), 0.82, leg(0.06)] as B16] : [])]); });
replyBass(74, 'C', 1); replyBass(75, 'D', 1);
bassBar(76, [[0, 7, 'E1', 1, acc], [7, 3, 'E2', 0.96, acc], [10, 6, 'B1', 0.86]]);
for (let b = SB.victory; b <= 80; b++) replyBass(b, HARMONY[b] === 'F#m' ? 'F#mE' : HARMONY[b]!, 0.96);
replyBass(81, 'B', 0.98);
bassBar(82, [[0, 3, 'E1', 1, acc]]);
bassNotes.sort((a, b) => a[0] - b[0]);
const bassMacro = { steps: [[0, 0.3], [16, 0.38], [32, 0.48], [at(13), 0.55], [at(21), 0.64], [at(27), 0.66], [at(35), 0.68], [at(37), 0.76], [at(40), 0.02], [at(54), 0.06], [at(56), 0.3], [at(60), 0.45], [at(64), 0.55], [at(72), 0.62], [at(77), 0.58], [at(81), 0.7], [at(82), 0.5]] as [number, number][], glide: 0.25 };
const bassMotion = [
  { fromBeat: 16, toBeat: 32, preset: 'eighths' }, { fromBeat: 32, toBeat: 44, preset: 'sixteenths' }, { fromBeat: 44, toBeat: at(13), preset: 'eighths' },
  { fromBeat: at(13), toBeat: at(27), preset: 'eighths' }, { fromBeat: at(27), toBeat: at(35), preset: 'sixteenths' }, { fromBeat: at(35), toBeat: at(40) - 1, preset: 'growl' },
  { fromBeat: at(40) - 1, toBeat: at(56), preset: 'none' }, { fromBeat: at(56), toBeat: at(64), preset: 'eighths' }, { fromBeat: at(64), toBeat: END, preset: 'sixteenths' },
];

// ================================================================================================ Impossible Voice
const V = (vowel: string, extra: Opts = {}) => ({ vowel, ...extra });
const voiceNotes: RackNote[] = [];
// undertow, third cycle: the voice takes the riff's fifth and fourth, two octaves up, opening then rounding
for (let b = 21; b <= 24; b++) { const ps = REPLY[HARMONY[b]!]!; voiceNotes.push(n16(b, 8, 2.6, tr(ps[2]!, 24), 0.74, V('ah', { articulation: 'detached' })), n16(b, 11, 2.6, tr(ps[3]!, 24), 0.7, V('oh', { articulation: 'detached' }))); }
// glitch
voiceNotes.push(
  n16(35, 0, 1.4, 'G4', 0.76, V('ee', { articulation: 'detached' })), n16(35, 5, 1.4, 'F#4', 0.74, V('ee', { articulation: 'detached' })), n16(35, 10, 1.4, 'E4', 0.74, V('ee', { articulation: 'detached' })),
  n16(36, 2, 2.4, 'D#5', 0.86, V('ah', { articulation: 'cry', cry: 2 })), n16(36, 7, 6, 'A5', 0.88, V('ah', { to: 'ee', articulation: 'fall', fall: 2 })),
  // 38: the round robin: voice pickup -> bass target; bass pickup -> log target; log pickup -> voice target
  n16(38, 0, 1.6, 'G4', 0.78, V('ee', { articulation: 'detached' })), n16(38, 12, 3.5, 'C5', 0.86, V('ah', { articulation: 'cry', cry: 1.5, to: 'oh' })),
  // 39: together in octaves on the quickened pairs; silence; the cry into the afterimage
  n16(39, 0, 1, 'A4', 0.74, V('ee')), n16(39, 1, 1, 'F#5', 0.82, V('ah')), n16(39, 2, 1, 'B4', 0.76, V('ee')), n16(39, 3, 1, 'G5', 0.84, V('ah')),
  n16(39, 4, 1, 'C5', 0.78, V('ee')), n16(39, 5, 1, 'A5', 0.88, V('ah')), n16(39, 9, 11, 'A5', 0.86, V('ah', { to: 'oo', articulation: 'cry', cry: 1 })),
);
// the bass break before the end: the voice answers the bass one last time
voiceNotes.push(n16(81, 2, 2, 'F#4', 0.76, V('ee')), n16(81, 4, 4, 'D#5', 0.86, V('ah', { articulation: 'cry', cry: 1.5 })),
  n16(81, 10, 2, 'B4', 0.78, V('ee')), n16(81, 12, 4, 'F#5', 0.88, V('ah', { to: 'oh' })));
voiceNotes.sort((a, b) => a[0] - b[0]);

// ================================================================================================ HEAVEN//MASS
type Part = 'bass' | 'tenor' | 'alto' | 'soprano';
const CHOIR: Record<Part, RackNote[]> = { bass: [], tenor: [], alto: [], soprano: [] };
const sing = (p: Part, bar: number, s: number, d: number, pitch: string, v: number, o: Opts) => CHOIR[p].push(n16(bar, s, d, pitch, v, o, 0.5));
// afterimage: V2 note for note (V2 bars 17-20 are bars 40-43 here)
const A0 = SB.after;
([[0, 4, 'G#4', 'oo'], [4, 6, 'E5', 'oo'], [10, 4, 'F#4', 'oo'], [14, 6, 'D#5', 'oh'], [20, 4, 'E4', 'oh'], [24, 8, 'C#5', 'oh'],
  [32, 4, 'B4', 'oh'], [36, 6, 'C#5', 'oh'], [42, 4, 'E5', 'ah']] as const).forEach(([s, d, p, v], i) =>
  sing('soprano', A0, s, d, p, 0.66 + 0.02 * i, { vowel: v, articulation: i === 0 ? 'breathy' : 'legato' }));
sing('soprano', A0, 46, 18, 'G5', 0.86, { vowel: 'ah', articulation: 'legato' });
sing('alto', A0, 0, 16, 'C#4', 0.6, { vowel: 'oo', articulation: 'hum' }); sing('alto', A0 + 1, 0, 16, 'B3', 0.62, { vowel: 'oo' });
sing('alto', A0 + 2, 0, 14, 'E4', 0.64, { vowel: 'oh' }); sing('alto', A0 + 2, 14, 18, 'E4', 0.8, { vowel: 'ah' });
sing('tenor', A0, 0, 16, 'A3', 0.6, { vowel: 'oo', articulation: 'hum' }); sing('tenor', A0 + 1, 0, 16, 'G#3', 0.62, { vowel: 'oo' });
sing('tenor', A0 + 2, 0, 14, 'G#3', 0.64, { vowel: 'oh' }); sing('tenor', A0 + 2, 14, 18, 'G3', 0.8, { vowel: 'ah' });
sing('bass', A0, 0, 16, 'F#2', 0.62, { vowel: 'mm', to: 'oo', articulation: 'hum' }); sing('bass', A0 + 1, 0, 16, 'A2', 0.64, { vowel: 'oo' });
sing('bass', A0 + 2, 0, 14, 'C#3', 0.66, { vowel: 'oh' }); sing('bass', A0 + 2, 14, 18, 'C3', 0.82, { vowel: 'ah' });
// hymn, bar 44: the C major chord holds, then turns to E (G -> G#, C -> B)
sing('soprano', 44, 0, 8, 'G5', 0.82, { vowel: 'ah' }); sing('soprano', 44, 8, 8, 'G#5', 0.8, { vowel: 'ah', articulation: 'legato' });
sing('alto', 44, 0, 16, 'E4', 0.76, { vowel: 'ah' });
sing('tenor', 44, 0, 8, 'G3', 0.76, { vowel: 'ah' }); sing('tenor', 44, 8, 8, 'G#3', 0.74, { vowel: 'ah', articulation: 'legato' });
sing('bass', 44, 0, 8, 'C3', 0.76, { vowel: 'ah' }); sing('bass', 44, 8, 8, 'B2', 0.74, { vowel: 'ah', articulation: 'legato' });
// the hymn: the reply at half speed (altos), the sopranos a dotted quarter behind, converging on the cadence
const HYMN_ALTO: [number, number, number, string][] = [
  [45, 0, 12, 'E4'], [45, 12, 4, 'D#5'], [46, 0, 6, 'B4'], [46, 6, 6, 'A4'], [46, 12, 4, 'G#4'], [47, 0, 12, 'F#4'], [47, 12, 4, 'E5'], [48, 0, 6, 'C#5'], [48, 6, 6, 'B4'], [48, 12, 4, 'A4'],
  [49, 0, 12, 'E4'], [49, 12, 4, 'D#5'], [50, 0, 6, 'B4'], [50, 6, 6, 'A4'], [50, 12, 4, 'G#4'], [51, 0, 12, 'F#4'], [51, 12, 4, 'E5'], [52, 0, 6, 'C#5'], [52, 6, 6, 'C5'], [52, 12, 4, 'B4'], [53, 0, 18, 'G#4'],
];
const hymnVowel = (bar: number) => (bar < 47 ? 'oo' : bar < 49 ? 'oh' : 'ah');
HYMN_ALTO.forEach(([b, s, d, p], i) => sing('alto', b, s, d, p, 0.7 + 0.01 * i, { vowel: hymnVowel(b), articulation: i === 0 ? 'breathy' : 'legato' }));
// sopranos: the same line 6 sixteenths later until bar 52, where they join the altos (the afterimage catches up)
HYMN_ALTO.filter(([b]) => b <= 51).forEach(([b, s, d, p], i) => { const a = 16 * (b - 45) + s + 6, end = Math.min(a + d, 16 * 7 + 2); if (end - a > 0) sing('soprano', 45, a, end - a, p, 0.6 + 0.01 * i, { vowel: hymnVowel(b), articulation: i === 0 ? 'breathy' : 'legato' }); });
sing('soprano', 52, 2, 4, 'C#5', 0.74, { vowel: 'ah', articulation: 'legato' }); sing('soprano', 52, 6, 6, 'C5', 0.74, { vowel: 'ah' }); sing('soprano', 52, 12, 4, 'B4', 0.74, { vowel: 'ah' });
sing('soprano', 53, 0, 18, 'G#4', 0.74, { vowel: 'ah' });
// tenors and basses: the hymn's chords
const HYMN_LOW: [number, number, number, string, string][] = [
  [45, 0, 8, 'B3', 'E2'], [45, 8, 8, 'B3', 'D#3'], [46, 0, 8, 'G#3', 'C#3'], [46, 8, 8, 'E3', 'A2'], [47, 0, 8, 'A3', 'F#2'], [47, 8, 8, 'A3', 'E2'], [48, 0, 8, 'E3', 'A2'], [48, 8, 8, 'D#3', 'B2'],
  [49, 0, 8, 'G#3', 'C#3'], [49, 8, 8, 'F#3', 'B2'], [50, 0, 8, 'D#3', 'G#2'], [50, 8, 8, 'C#3', 'F#2'], [51, 0, 16, 'A3', 'D3'], [52, 0, 6, 'E3', 'A2'], [52, 6, 6, 'E3', 'A2'], [52, 12, 4, 'E3', 'B2'], [53, 0, 18, 'B3', 'E3'],
];
for (const [b, s, d, t, ba] of HYMN_LOW) { sing('tenor', b, s, d, t, 0.66, { vowel: hymnVowel(b) }); sing('bass', b, s, d, ba, 0.68, { vowel: hymnVowel(b) }); }
// finale, bar 70-73: the sopranos follow the lead's held notes, a dotted eighth behind, then catch up through the cascade
sing('soprano', 70, 5, 2, 'E5', 0.76, { vowel: 'ah', articulation: 'swell' });   // breathes before the lead's D# sing('soprano', 70, 10, 5, 'D#5', 0.78, { vowel: 'ah' }); sing('soprano', 70, 15, 6, 'G#5', 0.8, { vowel: 'ah' });
sing('soprano', 71, 5, 16, 'C#5', 0.8, { vowel: 'ah' });
const ECHO_DELAY = [3, 3, 2, 2, 1, 1, 0];
CASCADE.forEach(([, t], i) => { const a = 5 * i + 2 + ECHO_DELAY[i]!, b = i < 6 ? 5 * (i + 1) + 2 + ECHO_DELAY[i + 1]! : a + 16; sing('soprano', SB.cascade, a, b - a, t, 0.82 + 0.02 * i, { vowel: 'ah' }); });
for (const [b, s, d, p] of [[72, 0, 8, 'A2'], [72, 8, 8, 'G#2'], [73, 0, 8, 'F#2'], [73, 8, 8, 'B2']] as const) sing('bass', b, s, d, p, 0.74, { vowel: 'oh', articulation: 'legato' });
// the landing: C, D, E at full voice; the altos' G finally becomes G#
const LAND: [number, string, string, string, string][] = [[74, 'C6', 'G4', 'E4', 'C3'], [75, 'A5', 'A4', 'F#4', 'D3'], [76, 'G#5', 'G#4', 'E4', 'E3']];
for (const [b, so, al, te, ba] of LAND) {
  if (b > 74) sing('soprano', b, 0, 16, so, 0.94, { vowel: 'ah' });
  sing('alto', b, 0, 16, al, 0.9, { vowel: 'ah' }); sing('tenor', b, 0, 16, te, 0.88, { vowel: 'ah' }); sing('bass', b, 0, 16, ba, 0.9, { vowel: 'ah' });
}
// the last groove: the G# and B held over it like an afterglow; the final E chord on the first pulse pair
sing('soprano', 77, 0, 64, 'G#5', 0.7, { vowel: 'ah', articulation: 'legato' }); sing('alto', 77, 0, 64, 'B4', 0.66, { vowel: 'ah', articulation: 'legato' });
sing('soprano', 81, 0, 21, 'G#5', 0.74, { vowel: 'ah' }); sing('alto', 81, 0, 21, 'B4', 0.7, { vowel: 'ah' });
sing('tenor', 82, 0, 5, 'E4', 0.84, { vowel: 'ah' }); sing('bass', 82, 0, 5, 'E3', 0.86, { vowel: 'ah' });
// the ending: a soft hum under the music box
sing('bass', 83, 0, 44, 'E3', 0.5, { vowel: 'mm', articulation: 'hum' }); sing('tenor', 83, 0, 44, 'B3', 0.48, { vowel: 'mm', articulation: 'hum' }); sing('alto', 83, 0, 44, 'G#4', 0.46, { vowel: 'mm', articulation: 'hum' });
for (const p of Object.keys(CHOIR) as Part[]) {
  const ns = CHOIR[p].sort((a, b) => a[0] - b[0]), out: RackNote[] = [];
  for (const n of ns) {
    const prev = out[out.length - 1];
    if (prev && n[0] < prev[0] + prev[1] - 1e-6) throw new Error(`choir ${p}: overlap at beat ${n[0]} (bar ${Math.floor(n[0] / 4) + 1})`);
    if (prev && prev[2] === n[2] && Math.abs(prev[0] + prev[1] - n[0]) < 1e-6) { prev[1] = r6(prev[1] + n[1]); if (n[4]?.vowel) prev[4] = { ...prev[4], to: n[4].vowel }; continue; }
    out.push(n);
  }
  CHOIR[p] = out;
}
const BLOOM = S(SB.after + 2, 14);
const CHOIR_MACRO = { steps: [[0, 0.06], [at(40), 0.06], [at(42), 0.14], [BLOOM + 0.2, 0.9], [at(45), 0.34], [at(49), 0.5], [at(52), 0.64], [at(54), 0.5], [at(70), 0.62], [at(72), 0.78], [at(74), 1], [at(77), 0.74], [at(83), 0.2]] as [number, number][], glide: 1.2 };
const CHOIR_ENSEMBLE = { steps: [[0, 0.2], [at(40), 0.2], [at(41), 0.34], [BLOOM, 0.42], [BLOOM + 2, 1], [at(45), 0.4], [at(49), 0.66], [at(52), 0.9], [at(70), 0.6], [at(72), 0.8], [at(74), 1], [at(83), 0.35]] as [number, number][], glide: 1.6 };
const CHOIR_EXPR: [number, number][] = [[at(40), 0.56], [at(42), 0.62], [BLOOM, 0.7], [at(43) + 3, 0.84], [at(45), 0.62], [at(49), 0.7], [at(52), 0.78], [at(54), 0.7], [at(70), 0.76], [at(74), 0.95], [at(77), 0.8], [at(83), 0.6]];

// ================================================================================================ percussion (rack)
const logNotes: RackNote[] = [], skinNotes: RackNote[] = [], clockNotes: RackNote[] = [];
const L = (bar: number, s: number, art: string, pitch: string, v: number, d = 1) => logNotes.push(n16(bar, s, d, pitch, v, { articulation: art }));
const K = (bar: number, s: number, d: number, art: string, pitch: string, v: number, o: Opts = {}, amount?: number) => skinNotes.push(n16(bar, s, d, pitch, v, { articulation: art, ...o }, amount));
for (let b = 1; b <= 4; b++) { L(b, 4, 'rim', 'D4', 0.34); L(b, 12, 'rim', 'D4', 0.38); }
const WOOD: Record<number, [number, string, string, number][]> = {
  5: [[3, 'knuckle', 'B4', 0.3], [14, 'rim', 'E4', 0.3]], 6: [[7, 'rim', 'E4', 0.34], [9, 'knuckle', 'B4', 0.28], [15, 'knuckle', 'E5', 0.3]],
  7: [[6, 'knuckle', 'B4', 0.3], [11, 'rim', 'E4', 0.3]], 8: [[3, 'knuckle', 'B4', 0.3], [10, 'rim', 'E4', 0.34], [15, 'knuckle', 'E5', 0.38]],
  9: [[5, 'rim', 'E4', 0.3], [14, 'knuckle', 'B4', 0.3]], 10: [[1, 'knuckle', 'B4', 0.28], [7, 'rim', 'E4', 0.34]],
  11: [[3, 'knuckle', 'B4', 0.3], [9, 'rim', 'E4', 0.3], [14, 'rim', 'E4', 0.3]], 12: [[6, 'knuckle', 'B4', 0.3], [11, 'rim', 'E4', 0.34], [15, 'knuckle', 'E5', 0.4]],
};
for (const [b, hits] of Object.entries(WOOD)) for (const [s, art, p, v] of hits) L(Number(b), s, art, p, v);
// undertow and the dark union: wooden answers between the bass notes (s3, s9, s13), moving per chord
for (let b = SB.undertow; b < SB.glitch; b++) { if (b === 26) continue; const c = HARMONY[b]!; L(b, c === 'A' ? 2 : 3, 'knuckle', 'C#5', 0.28); L(b, c === 'G#7' ? 7 : 13, 'rim', 'E4', 0.32); if (b >= 17) L(b, 9, 'knuckle', 'G#4', 0.24); }
for (let b = 57; b <= 81; b++) { if (b >= 74 && b <= 76) continue; L(b, 7, 'rim', 'E4', 0.3); L(b, 15, 'knuckle', 'B4', 0.3); }
// bar 4: the hand drums answer the held G#
K(4, 8, 1, 'tap', 'E3', 0.45); K(4, 9, 1, 'slap', 'B3', 0.7); K(4, 11, 1, 'tap', 'F#3', 0.5); K(4, 12, 1, 'slap', 'C#4', 0.76); K(4, 14, 1, 'open', 'G#3', 0.72); K(4, 15, 1, 'slap', 'E4', 0.84);
// undertow, third cycle: the talking drum answers each riff with the hook's leap (one stroke bending a sixth)
for (let b = 21; b <= 24; b++) K(b, 14, 2, 'open', 'C#3', 0.54, { bend: b % 2 ? 9 : 8 });
// glitch 37: the talking drum is the bass's afterimage, a dotted eighth behind; every pulse pair is one stroke bending a sixth
K(37, 3, 4, 'open', 'G3', 0.78, { bend: 9 }); K(37, 8, 4, 'open', 'F#3', 0.76, { bend: 8 }); K(37, 13, 3, 'open', 'B3', 0.8, { bend: 8 });
// glitch 39: the talking drum joins the convergence
for (const [s, p] of [[0, 'A3'], [1, 'F#4'], [2, 'B3'], [3, 'G4'], [4, 'C4'], [5, 'A4']] as const) K(39, s, 1, 'slap', p, 0.62 + 0.03 * s);
// glitch 38: the log carries the middle of the melody (bass pickup -> log target; log pickup -> voice target)
L(38, 7, 'strike', 'D5', 0.8, 3); L(38, 10, 'knuckle', 'E4', 0.7, 2);
// heartbeats: the afterimage (V2), the hymn (softer), the return (quickening into the groove), the end
for (const b of [40, 41, 42]) for (const h of [0, 8]) { K(b, h, 1.5, 'bass', 'E2', 0.5, {}, 0.5); K(b, h + 2, 2, 'bass', 'E2', 0.7, {}, 0.5); }
K(43, 12, 1.5, 'bass', 'E2', 0.52, {}, 0.5); K(43, 14, 2, 'bass', 'E2', 0.74, {}, 0.5);
for (let b = 45; b <= 53; b++) for (const h of [0, 8]) { K(b, h, 1.5, 'bass', 'E2', 0.38, {}, 0.5); K(b, h + 2, 2, 'bass', 'E2', 0.52, {}, 0.5); }
for (const h of [0, 8]) { K(54, h, 1.5, 'bass', 'E2', 0.46, {}, 0.5); K(54, h + 2, 2, 'bass', 'E2', 0.62, {}, 0.5); }
for (const h of [0, 4, 8, 12]) { K(55, h, 1.5, 'bass', 'E2', 0.5 + 0.02 * h, {}, 0.5); K(55, h + 2, 2, 'bass', 'E2', 0.66 + 0.02 * h, {}, 0.5); }
K(85, 12, 1.5, 'bass', 'E2', 0.42); K(85, 14, 2, 'bass', 'E2', 0.56);
// clock: the glitch's afterimage ticks (bar 37) and the dotted-eighth ticks against the round robin (bar 38)
for (const s of [3, 8, 13]) clockNotes.push(n16(37, s, 0.5, 'E6', 0.46, { articulation: 'tick' }));
clockNotes.push(n16(36, 14, 0.5, 'B6', 0.4, { articulation: 'tick' }), n16(36, 15, 0.5, 'B6', 0.48, { articulation: 'tick' }));
for (const s of [0, 3, 6, 9, 12, 15]) clockNotes.push(n16(38, s, 0.5, 'B6', 0.36 + 0.02 * s, { articulation: 'tick' }));
for (const a of [logNotes, skinNotes, clockNotes]) a.sort((x, y) => x[0] - y[0]);

// the hymn's third voice: the music box, 12 sixteenths behind the altos (phrase 2), an octave up; then the last G# rings
HYMN_ALTO.filter(([b]) => b >= 49 && b <= 51).forEach(([b, s, d, p], i) => echoNotes.push(n16(b, s + 12, Math.min(d, 6), tr(p, 12), 0.36 + 0.02 * i, { articulation: 'soft' })));
echoNotes.push(n16(53, 4, 8, 'G#5', 0.42, { articulation: 'ring' }));

// ================================================================================================ rack scores
const ROOM = { rt60: 1.5, size: 1.05, damp: 6500, predelayMs: 22, lowCut: 300 };
const base = (title: string, description: string, seed: number) => ({ schema: SCHEMA, title, description, bpm: BPM, key: KEY, swing: 0.5, seed, tailSeconds: TAIL_SECONDS, masterGainDb: 0, sections: SECTIONS, room: ROOM });
const LEAD_MACRO: [number, number][] = [[0, 0.16], [15, 0.22], [16, 0.42], [31, 0.5], [32, 0.5], [47, 0.6], [at(13), 0.48], [at(21), 0.56], [at(27), 0.58], [at(33), 0.64],
  [at(56), 0.46], [at(63), 0.54], [at(64), 0.6], [at(68), 0.56], [at(70), 0.64], [at(72), 0.68], [at(74) - 0.5, 0.82], [at(75), 0.84], [at(76), 0.78], [at(76, 8), 0.62], [at(77), 0.66], [at(81), 0.62]];
export const SCORES: { id: string; score: Record<string, unknown> }[] = [
  {
    id: 'lead', score: {
      ...base('AFTERIMAGE//PULSE (full length): THRONE//VOLT lead', 'The hook in all its characters, the answers, the reply sung, the cascade, the climb.', 3361),
      parts: [{
        id: 'lead', instrument: 'throne-volt', gainDb: -3, pan: 0, room: 0.14,
        setup: { seed: 33601, glide: 0.06, release: 0.24, attack: 0.006, vibRate: 5.1, drift: 3, keytrack: 0.7, lowcut: 160 },
        macro: LEAD_MACRO, expression: [[0, 0.62], [16, 0.72], [47, 0.78], [at(13), 0.74], [at(27), 0.8], [at(56), 0.72], [at(64), 0.8], [at(72), 0.86], [at(74), 0.92], [at(77), 0.84]],
        controls: {
          sync: LANES.sync, growl: LANES.growl,
          width: [[0, 0.3], [16, 0.38], [at(64), 0.45]], vowel: [[0, 0.42], [15, 0.4], [16, 0.24], [at(27), 0.3], [at(35), 0.24], [at(64), 0.2]],
          drive: [[0, 0.3], [16, 0.45], [32, 0.55], [at(27), 0.6], [at(56), 0.45], [at(64), 0.58], [at(72), 0.66], [at(77), 0.56]],
          heat: [[0, 0.25], [16, 0.36], [32, 0.42], [at(27), 0.5], [at(56), 0.36], [at(64), 0.46], [at(72), 0.56], [at(77), 0.46]],
          sub: [[0, 0.1], [16, 0.2], [at(27), 0.26], [at(56), 0.18], [at(64), 0.28], [at(74), 0.2]], vib: [[0, 14], [16, 9], [at(64), 11], [at(74), 16], [at(77), 11]],
          bloom: 0.65, detune: [[0, 8], [16, 9], [at(64), 11]],
        },
        notes: leadNotes,
      }],
    },
  },
  {
    id: 'keys', score: {
      ...base('AFTERIMAGE//PULSE (full length): THRONE//VOLT pad', 'The chord bed; it breathes with the pulse in the engine.', 3362),
      parts: [{
        id: 'pad', instrument: 'throne-volt', gainDb: -12, pan: 0, room: 0.32,
        setup: { seed: 33603, attack: 0.03, release: 0.55, drift: 6, keytrack: 0.4, lowcut: 200, glide: 0.12 },
        macro: 0.2,
        controls: { cutoff: [[0, 520], [16, 760], [at(13), 620], [at(27), 760], [at(35), 900], [at(54), 600], [at(64), 1000], [at(74), 1300], [at(77), 1100]], res: 0.7, env: 0.9, drive: 0.2, heat: 0.18, sync: 0, detune: 14, sub: 0, growl: 0, vib: 4, bloom: 0.7, width: 0.9, air: 0.04, vowel: 0.1 },
        notes: padNotes.sort((a, b) => a[0] - b[0] || midi(a[2]) - midi(b[2])),
      }],
    },
  },
  {
    id: 'bassvox', score: {
      ...base('AFTERIMAGE//PULSE (full length): Living Bass and Impossible Voice', 'The bass: answers, the reply, the dark riff, the hook sung low; the voice: the conversation.', 3363),
      parts: [
        {
          id: 'bass', instrument: 'living-bass', gainDb: -2, pan: 0, room: 0, setup: { seed: 33604 },
          macro: bassMacro, motion: bassMotion,
          expression: [[0, 0.72], [16, 0.78], [at(13), 0.82], [at(35), 0.84], [at(40), 0.6], [at(56), 0.76], [at(64), 0.86], [at(74), 0.9], [at(77), 0.86]],
          controls: { hold: { steps: [[0, 0.6], [at(13), 0.66], [at(35), 0.72], [at(40), 0.84], [at(56), 0.62], [at(64), 0.66]], glide: 0.5 },
            ratchet: { steps: [[0, 0], [at(35), 1], [at(37), 0.5], [at(38), 0], [at(40), 0]], glide: 0.05 },
            servo: { steps: [[0, 0.3], [at(13), 0.5], [at(35), 0.85], [at(40), 0.1], [at(56), 0.4]], glide: 0.05 } },
          offsets: { grind: { steps: [[0, 0], [at(13), -0.25], [at(35), -0.45], [at(40), 0], [at(64), -0.15]], glide: 0.1 }, chassis: { steps: [[0, -0.2], [at(13), -0.1], [at(35), -0.05], [at(40), -0.5], [at(56), -0.25]], glide: 0.1 },
            bright: { steps: [[0, 0.05], [at(13), 0.12], [at(35), 0.18], [at(40), 0], [at(56), 0.08], [at(68), 0.22], [at(70), 0.12]], glide: 0.5 }, fold: { steps: [[0, 0], [at(13), 0.06], [at(35), 0.12], [at(40), 0], [at(68), 0.1], [at(70), 0]], glide: 0.3 } },
          notes: bassNotes,
        },
        {
          id: 'voice', instrument: 'impossible-voice', gainDb: -2, pan: 0, room: 0.3,
          setup: { seed: 33605, size: 0.15, vibRate: 5.6, vibCents: 22, vowelTau: 0.045, haloDecay: 0.9, haloGain: 0.8, halo: ['E5', 'B5', 'E6'] },
          macro: [[at(21), 0.24], [at(25), 0.3], [at(35), 0.32], [at(37), 0.5], [at(39), 0.62], [at(39, 10), 0.72], [at(41), 0.6], [at(81), 0.4]],
          expression: [[at(21), 0.7], [at(35), 0.76], [at(39), 0.84], [at(41), 0.7], [at(81), 0.8]],
          controls: { tilt: 0.72, breath: 0.26, glass: [[at(21), 0.1], [at(35), 0.15], [at(39, 10), 0.5], [at(41), 0.3], [at(81), 0.25]], split: [[at(21), 0.02], [at(35), 0.04], [at(37), 0.1], [at(39), 0.18], [at(41), 0.05]],
            stretch: [[at(21), 0], [at(39), 0], [at(39, 10), 0.022], [at(41), 0]], shimmer: [[at(21), 0.1], [at(39, 10), 0.4], [at(41), 0.15]], vib: 0.7 },
          notes: voiceNotes,
        },
      ],
    },
  },
  {
    id: 'perc', score: {
      ...base('AFTERIMAGE//PULSE (full length): music box and hand percussion', 'The afterimage (Mechanical Orchestra bar), Timbre Lab hollow log and hand skin (talking drum, heartbeat), escapement clock.', 3364),
      parts: [
        {
          id: 'echo', instrument: 'mechanical-orchestra/bar', gainDb: -6, pan: 0, room: 0.38, setup: { seed: 33606, spread: 0.85 },
          macro: { steps: [[0, 0.06], [at(40), 0.04], [at(83), 0.06]], glide: 0.5 },
          controls: { damp: { steps: [[0, 0.62], [at(40), 0.85], [at(49), 0.9], [at(54), 0.62], [at(83), 0.9], [at(85), 1.3]], glide: 0.25 }, hardness: { steps: [[0, 0.55], [at(40), 0.35], [at(54), 0.45], [at(64), 0.55], [at(83), 0.42]], glide: 0.25 } },
          notes: echoNotes.sort((a, b) => a[0] - b[0]),
        },
        { id: 'log', instrument: 'organic-percussion/log', gainDb: -6, pan: -0.22, room: 0.12, setup: { seed: 33607, spread: 0.35 }, macro: 0.1, humanize: { timingMs: 3, velocity: 0.08, seed: 3371 }, notes: logNotes },
        { id: 'skin', instrument: 'organic-percussion/skin', gainDb: -4, pan: 0.08, room: 0.14, setup: { seed: 33608, spread: 0.3 }, macro: { steps: [[0, 0.2], [at(21), 0.3], [at(40), 0.45], [at(56), 0.3]], glide: 0.5 },
          controls: { damp: { steps: [[0, 1], [at(21), 1.1], [at(40), 1.3], [at(56), 1.2]], glide: 0.5 } }, humanize: { timingMs: 4, velocity: 0.06, seed: 3372 }, notes: skinNotes },
        { id: 'clock', instrument: 'mechanical-orchestra/clock', gainDb: -8, pan: 0.3, room: 0.1, setup: { seed: 33609, spread: 0.4 }, macro: 0.5, notes: clockNotes },
      ],
    },
  },
  ...(['low', 'high'] as const).map((bus, k) => ({
    id: `choir-${bus}`, score: {
      ...base(`AFTERIMAGE//PULSE (full length): HEAVEN//MASS ${bus}`, 'The afterimage passage (V2), the hymn, the catching-up echo, the landing, the afterglow, the hum.', 3365 + k),
      parts: (bus === 'low' ? ['bass', 'tenor'] : ['alto', 'soprano'] as Part[]).map((id, j) => ({
        id, instrument: `heaven-mass/${id}`, gainDb: id === 'soprano' ? -13 : id === 'alto' ? -12 : id === 'tenor' ? -13 : -12, pan: 0, room: 0,
        setup: { seed: 13610 + 2 * k + j, singers: id === 'soprano' ? 7 : 6, depth: 0.55, lowCut: 220, output: 'mix', ...(id === 'bass' ? { octavists: 2 } : {}) },
        macro: CHOIR_MACRO, expression: CHOIR_EXPR,
        controls: { ensemble: CHOIR_ENSEMBLE, air: { steps: [[0, 0.2], [BLOOM, 0.25], [BLOOM + 1, 0.55], [at(45), 0.3], [at(52), 0.45], [at(72), 0.5], [at(77), 0.4], [at(83), 0.2]], glide: 1 },
          ...(id === 'bass' ? { octavist: { steps: [[0, 0], [BLOOM, 0], [BLOOM + 0.5, 0.85], [at(44, 8), 0], [at(74), 0.8], [at(75), 0.4], [at(76), 0.8], [at(77), 0]], glide: 0.8 } } : {}) },
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
  even: s => (s % 4 === 2 ? 0.72 : s % 2 ? 0.44 : 0.32),
  push: s => (s % 4 === 3 ? 0.62 : s % 4 === 2 ? 0.52 : s % 2 ? 0.34 : 0.28),
  sparse: s => (s % 4 === 2 ? 0.7 : s === 7 || s === 15 ? 0.42 : 0),
  under: s => (s % 2 ? 0.36 : s % 4 === 2 ? 0 : 0.22),               // undertow: soft shuffled sixteenths; the ticks take the offbeats
};
const hatBar = (bar: number, t: string, opens: number[] = [], openV = 0.52, skip: number[] = []) => {
  for (let s = 0; s < 16; s++) { if (skip.includes(s)) continue; if (opens.includes(s)) { hat(bar, s, openV, 'open'); continue; } const v = HAT_T[t]!(s); if (v > 0) hat(bar, s, v); }
};
type Pat = [number, Hit[], Hit[], Hit[], string, number[]];
const play = (pats: Pat[], openV = 0.52) => { for (const [b, ks, ss, gs, t, op] of pats) { ks.forEach(([s, v]) => k(b, s, v)); ss.forEach(([s, v]) => sn(b, s, v)); gs.forEach(([s, v]) => ghost(b, s, v)); hatBar(b, t, op, openV); } };
// image + pulse (V2)
for (let b = 1; b <= 2; b++) for (const s of [2, 6, 10, 14]) hat(b, s, 0.42 + 0.05 * (s === 6 || s === 14 ? 1 : 0));
for (let b = 3; b <= 4; b++) for (let s = 0; s < 16; s++) hat(b, s, s % 4 === 2 ? 0.6 : s % 2 ? 0.34 : 0.26);
k(3, 0, 0.9); k(3, 10, 0.84); k(4, 0, 0.9); k(4, 7, 0.6);
play([
  [5, [[0, 1], [10, 0.9]], [[4, 0.95], [12, 1]], [[9, 0.2]], 'even', []],
  [6, [[0, 1], [3, 0.58], [11, 0.86]], [[4, 0.95], [12, 1]], [[7, 0.22], [14, 0.24]], 'even', [14]],
  [7, [[0, 1], [7, 0.66], [10, 0.9]], [[4, 0.95], [12, 1]], [[15, 0.26]], 'push', []],
  [8, [[0, 1], [6, 0.7], [11, 0.86], [14, 0.6]], [[4, 0.95], [13, 1]], [[10, 0.22]], 'even', [6]],
  [9, [[0, 1], [9, 0.9]], [[4, 0.95], [12, 1]], [[7, 0.2]], 'sparse', []],
  [10, [[2, 0.95], [8, 0.82]], [[4, 0.95], [12, 1]], [[14, 0.24]], 'push', [10]],
  [11, [[7, 0.9], [13, 0.84]], [[4, 0.95], [12, 1]], [[1, 0.22], [9, 0.24]], 'push', []],
  [12, [[0, 1], [6, 0.74], [10, 0.9], [13, 0.62]], [[4, 0.95], [12, 1], [15, 0.55]], [[7, 0.24]], 'even', [14]],
]);
for (let b = 5; b <= 12; b++) hat(b, b % 2 ? 6 : 14, 0.46, 'tick');
// undertow: the kick follows the bass; the snare is pushed and pulled; each G#7 bar ends in a held rest
const UPAT: Record<string, [Hit[], Hit[], Hit[]]> = {
  'C#m': [[[0, 1], [6, 0.82], [11, 0.88]], [[4, 0.95], [12, 1]], [[9, 0.2], [15, 0.26]]],
  A: [[[0, 1], [8, 0.86], [14, 0.72]], [[4, 0.95], [12, 1]], [[7, 0.22], [10, 0.18]]],
  'F#m': [[[0, 1], [6, 0.82], [11, 0.88]], [[4, 0.95], [13, 1]], [[2, 0.18], [10, 0.22]]],
  'G#7': [[[0, 1], [3, 0.7], [8, 0.9]], [[4, 0.95]], [[6, 0.22]]],
};
for (let b = SB.undertow; b < SB.glitch; b++) {
  if (b === 25 || b === 26) continue;
  const c = HARMONY[b]!, [ks, ss, gs] = UPAT[c]!, cyc = b < 17 ? 0 : b < 21 ? 1 : b < SB.dark ? 2 : 3;
  ks.forEach(([s, v]) => k(b, s, v)); ss.forEach(([s, v]) => sn(b, s, v)); if (cyc >= 1) gs.forEach(([s, v]) => ghost(b, s, v));
  const opens = cyc >= 1 && (c === 'C#m' || c === 'F#m') ? [6] : cyc >= 3 && c === 'A' ? [14] : [];
  hatBar(b, 'under', opens, 0.5, c === 'G#7' ? [10, 11, 12, 13, 14, 15] : []);
  for (const s of [2, 6, 10, 14]) if (!(c === 'G#7' && s >= 10) && !opens.includes(s)) hat(b, s, cyc ? 0.56 : 0.48, 'tick');
}
// 25: the breakdown, only the kick with the bass and a clap on 4; 26: the stop on the pulse (0 and 5), then a held rest
k(25, 0, 0.9); k(25, 6, 0.74); k(25, 11, 0.8); sn(25, 12, 0.9);
k(26, 0, 1); sn(26, 0, 0.8); k(26, 5, 0.95); sn(26, 5, 0.9); hat(26, 0, 0.6, 'open'); hat(26, 5, 0.56, 'open');
// glitch (V2 bars 13-16 at 35, 36, 37, 39; 38 is new)
k(35, 0, 1); k(35, 11, 0.86); sn(35, 8, 1); ghost(35, 13, 0.24); for (const s of [3, 6, 11, 14]) hat(35, s, s === 6 || s === 14 ? 0.6 : 0.4);
k(36, 0, 1); k(36, 6, 0.74); sn(36, 8, 1); ghost(36, 15, 0.3); for (const s of [2, 9, 14]) hat(36, s, 0.5); hat(36, 7, 0.5, 'tick');
k(37, 3, 0.8); k(37, 10, 0.9); sn(37, 8, 1); for (const s of [6, 14]) hat(37, s, 0.56);
k(38, 0, 0.9); k(38, 10, 0.86); sn(38, 8, 1); for (const s of [6, 14]) hat(38, s, 0.5);
k(39, 0, 1); sn(39, 4, 0.92); for (const s of [1, 2, 3, 5]) hat(39, s, 0.36 + 0.06 * s);
// return: kick from 56 (with the bass), snare from 58, the full groove from 60
const RK: Record<string, Hit[]> = { E: [[0, 1], [6, 0.8], [11, 0.86]], 'F#m': [[0, 1], [6, 0.8], [11, 0.86]], 'C#m': [[0, 1], [6, 0.82], [11, 0.88]], A: [[0, 1], [8, 0.86], [14, 0.72]], B: [[0, 1], [6, 0.8], [10, 0.86], [13, 0.7]] };
for (let b = 56; b <= 63; b++) {
  const c = HARMONY[b]!; RK[c]!.forEach(([s, v]) => k(b, s, v * (b < 58 ? 0.85 : 1)));
  if (b >= 58) { sn(b, 4, 0.92); sn(b, 12, 0.98); }
  if (b >= 60) { ghost(b, 9, 0.2); ghost(b, 15, 0.24); }
  if (b < 58) for (const s of [2, 6, 10, 14]) hat(b, s, 0.5); else hatBar(b, b < 60 ? 'sparse' : b % 2 ? 'push' : 'even', b >= 60 ? [6] : []);
}
sn(63, 15, 0.5);
// finale
const FK = (c: string): Hit[] => (c === 'A' ? [[0, 1], [8, 0.88], [14, 0.74]] : [[0, 1], [6, 0.84], [11, 0.9]]);
for (const b of [64, 65, 66, 67, 70, 77, 78, 79, 80]) { const c = HARMONY[b]!; FK(c).forEach(([s, v]) => k(b, s, v)); sn(b, 4, 0.98); sn(b, 12, 1); ghost(b, 9, 0.2); ghost(b, 15, 0.24); hatBar(b, b % 2 ? 'push' : 'even', [6, 14], 0.48); }
for (const b of [68, 69]) { for (const [s, v] of [[0, 1], [5, 0.9], [10, 0.92]] as Hit[]) k(b, s, v); sn(b, 4, 0.98); sn(b, 12, 1); ghost(b, 7, 0.22); hatBar(b, 'even', [14], 0.48); }
play([[71, [[0, 1], [5, 0.86], [10, 0.9]], [[4, 0.98], [12, 1]], [[14, 0.24]], 'sparse', []],
  [72, [[0, 1], [5, 0.9], [10, 0.92], [15, 0.9]], [[4, 0.98], [12, 1]], [], 'push', []],
  [73, [[4, 0.94], [9, 0.92], [14, 0.95]], [[4, 0.98], [12, 1]], [], 'push', [1, 6, 11]],
  [74, [[0, 1], [6, 0.86], [11, 0.9]], [[4, 1], [12, 1]], [[9, 0.24]], 'even', [2, 6, 10, 14]],
  [75, [[0, 1], [6, 0.86], [11, 0.9]], [[4, 1], [12, 1]], [[9, 0.24], [15, 0.3]], 'even', [2, 6, 10, 14]],
  [76, [[0, 1], [7, 1], [10, 0.88]], [[4, 1], [12, 1]], [[15, 0.26]], 'even', [7]],
], 0.5);
// 81: the bass break: the kick only where the bass plays; 82: the first pulse pair, then nothing
for (const [s, v] of [[0, 1], [6, 0.8], [8, 0.78], [11, 0.82], [14, 0.76]] as Hit[]) k(81, s, v);
k(82, 0, 1); sn(82, 2, 0.6); hat(82, 0, 0.56, 'open');
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

// ================================================================================================ automation (V2's helpers)
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
/** Section levels: dB relative to base over [from, to). Touching sections cross-fade into each other (no return to base between them). */
function levels(base: number, segs: Seg[], edge = 0.1): Shape {
  const s: Shape = [[0, base]];
  let prevEnd = -1;
  for (const [a, b, d] of [...segs].sort((x, y) => x[0] - y[0])) {
    if (Math.abs(a - prevEnd) < 1e-9) { s.pop(); s.push([tk(a + edge), base + d]); } else s.push([tk(a), base], [tk(a + edge), base + d]);
    s.push([tk(b - edge), base + d], [tk(b), base]);
    prevEnd = b;
  }
  if (s[s.length - 1]![0] < tk(END)) s.push([tk(END), base]);
  return s.filter((p, i) => i === 0 || p[0] > s[i - 1]![0] || p[1] !== s[i - 1]![1]);
}
const levelLane = (base: number, segs: Seg[], extra: Shape[] = []) => lane(base + Math.max(0, ...segs.map(x => x[2])), [levels(base, segs), ...extra]);
const duck = (beat: number, lvl: number, depth: number, holdMs: number, relMs: number): Shape => [[tk(beat) - 12, lvl], [tk(beat), lvl - depth], [tk(beat + ms(holdMs)), lvl - depth], [tk(beat + ms(holdMs + relMs)), lvl]];
function ducked(base: number, segs: Seg[], hits: number[], depth: number, holdMs: number, relMs: number, extra: Shape[] = []): Point[] {
  const sh = levels(base, segs), top = base + Math.max(0, ...segs.map(x => x[2]));
  return lane(top, [sh, ...hits.map(b => duck(b, evalShape(sh, tk(b), base), depth, holdMs, relMs)), ...extra]);
}
const silence = (from: number, to: number): Shape => [[tk(from), 12], [tk(from) + RAMP, -60], [tk(to) - RAMP, -60], [tk(to), 12]];
const fadeOut = (from: number, to: number, lvl: number): Shape => [[tk(from), lvl], [tk(to), -60], [tk(END), -60]];
/** The pad breathes: it dips on every pulse pickup (the hook's, the answers', the cascade's) and on the reply's held root and swoop. */
const PULSE_BEATS: number[] = [];
const HOOKBARS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 24, 27, 28, 29, 30, 31, 32, 33, 34, 63, 64, 65, 66, 67, 70, 77, 78, 79, 80];
for (const b of HOOKBARS) for (const s of [0, 5, 10]) PULSE_BEATS.push(sw(at(b, s)));
for (const b of [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 25, 56, 57, 58, 59, 60, 61, 62, 68, 69, 74, 75, 81]) for (const s of [0, 6]) PULSE_BEATS.push(sw(at(b, s)));
for (let i = 0; i < 7; i++) PULSE_BEATS.push(sw(at(SB.cascade, 5 * i)));
PULSE_BEATS.sort((a, b) => a - b);
const HOLE = { from: S(39, 6), to: S(39, 9) };       // the glitch's three sixteenths of nothing
const REST26 = { from: S(26, 7), to: at(27) - 0.02 };  // the stop: the band rests under the held G#
const STOP = S(82, 5);                               // the band stops after the first pulse pair; the music box remains
const holeIn = (): Shape[] => [silence(HOLE.from, HOLE.to)];
const rest26 = (): Shape[] => [silence(REST26.from, REST26.to)];

// ================================================================================================ engine project
/** Track gains (dB): V2's final mix as the starting point. */
export const MIX = { kick: -1, snare: -0.5, hats: -4, perc: 2, echo: 3, bassSub: 4, bassMid: 0, voice: 1, lead: 3, pad: -1, choirLow: -2, choirHigh: 1, room: 0, master: -2 };
/**
 * The one bounded QA/fix pass (README). --candidate reproduces the candidate exactly as rendered and measured.
 *   F1 the landing: the full-voice choir covered the climbing lead in 1-4 kHz -> lead +3 dB written (2:1 compressor), choir -3 dB
 *   F2 the last groove: the afterglow choir competed with the hook -> afterglow -2 dB
 *   F3 the reply was barely above the groove in the phone band where the bass leads -> bass mid +2.5 dB (undertow), +2 dB (return)
 *   F4 the undertow's voice hocket was faint -> voice +3 dB written
 *   F5 the landing C6 read -5.5 cents against the choir's C6 (analog drift) -> +5.5 cents on that note (the lead score re-renders)
 *   F6 the undertow and the return were narrow -> the shared room +4 dB there
 */
export const FIX = CANDIDATE
  ? { landLead: 0, landChoir: 0, afterglow: -9, bassUnder: 1.5, bassReturn: 0, voiceUnder: 2, landCents: 0, roomWide: 0 }
  : { landLead: 3, landChoir: -3, afterglow: -11, bassUnder: 4, bassReturn: 2, voiceUnder: 5, landCents: 5.5, roomWide: 4 };
const R = (a: number, b: number) => [at(a), at(b)] as const;
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
/** The hats drift across the field once every two bars in the grooves (V2's F4). */
function hatPan(): Point[] {
  const groove = (b: number) => (b >= at(5) && b < at(35)) || (b >= at(56) && b < STOP);
  const out: Point[] = [];
  for (let b = 0; b <= END - 0.5; b += 0.5) out.push({ at: { musical: pos(b) }, value: r6(groove(b) ? 0.2 + 0.35 * Math.sin(2 * Math.PI * (b - 16) / 8) : 0.2), transition: 'linear' });
  return out;
}
/** The voice moves to tell the glitch in space (V2's F3); in the undertow it sits left of the bass; in the break, right. */
function voicePan(): Point[] {
  const pts: [number, number][] = [[0, 0], [at(21) - 0.1, -0.25], [at(25) - 0.1, -0.25], [at(35) - 0.05, -0.3], [at(36) - 0.15, -0.3], [at(36), 0.3], [at(37) - 0.15, 0.3], [at(38) - 0.15, 0.1],
    [at(38), -0.35], [at(38, 10), 0.35], [at(39) - 0.25, 0.3], [at(39), 0.05], [S(39, 6), 0], [at(81) - 0.2, 0], [at(81), 0.25], [at(82), 0.25], [END - 0.5, 0]];
  return pts.map(([b, v]) => ({ at: { musical: pos(b) }, value: v, transition: 'linear' as const }));
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
const [UND0, UND1] = R(SB.undertow, SB.glitch), [GL0, GL1] = R(SB.glitch, SB.after), [AF0, AF1] = R(SB.after, SB.ret), [FIN0] = R(SB.union, SB.end);

export const project = {
  formatVersion: 1,
  title: 'AFTERIMAGE//PULSE',
  description: 'DaemonV12 Sound Lab 03, the full-length record: 86 bars, E major, 136 BPM. THRONE//VOLT, Living Bass, Impossible Voice, HEAVEN//MASS, Mechanical Orchestra, Timbre Lab; V12 Signature and GLASSHOUSE drums.',
  bpm: BPM, timeSignature: '4/4', key: KEY, bars: BARS, seed: 336,
  render: { tail: { seconds: TAIL_SECONDS } },
  master: { gainDb: MIX.master, effects: [{ type: 'highpass', frequencyHz: 26 }, { type: 'compressor', thresholdDb: -16, ratio: 1.5, attackMs: 25, releaseMs: 160 }, { type: 'saturation', driveDb: 1, mix: 0.6 }] },
  tracks: [
    kitTrack('kick', 'V12 IRON PULSE body + GLASSHOUSE bass-punch knock; follows the bass in the undertow and the finale, every pickup in the cascade.', 'assets/kick-kit.json', kickHits, MIX.kick,
      [{ type: 'highpass', frequencyHz: 30 }, { type: 'saturation', driveDb: 3, mix: 0.25 }]),
    kitTrack('snare', 'V12 TITANIUM CRACK +1 st + GLASSHOUSE chrome clap; 5-8 ms late; pushed and dragged backbeats; ghosts.', 'assets/snare-kit.json', snareHits, MIX.snare,
      [{ type: 'highpass', frequencyHz: 150 }, { type: 'compressor', thresholdDb: -14, ratio: 3, attackMs: 4, releaseMs: 80 }, { type: 'reverb', roomSize: 0.3, decaySeconds: 0.5, wet: 0.08 }]),
    kitTrack('hats', 'GLASSHOUSE pixel hat, V12 ghost tick and open circuit; patterns that change with the section; drifting pan.', 'assets/hats-kit.json', hatHits, MIX.hats,
      [{ type: 'highpass', frequencyHz: 4000 }], lane(MIX.hats, [silence(S(39, 6), at(56) - 0.02), ...rest26()]), 0.2, hatPan()),
    stemTrack('perc', 'Timbre Lab hollow log and hand skin (fill, talking drum, heartbeats), escapement clock.', A('perc'), MIX.perc,
      [{ type: 'highpass', frequencyHz: 45 }, { type: 'compressor', thresholdDb: -20, ratio: 2.5, attackMs: 3, releaseMs: 90, makeupGainDb: 2 }],
      levelLane(MIX.perc, [[GL0, GL1, 2], [AF0, AF1, -5], [at(54), at(56), -3]], [...holeIn(), ...rest26()])),
    stemTrack('echo', 'The afterimage: Mechanical Orchestra bar. The opening, the dark return, the memory, the hymn\'s third voice, the finale, the ending.', A('echo'), MIX.echo,
      [{ type: 'highpass', frequencyHz: 350 }], levelLane(MIX.echo, [[at(SB.ending), END + 4, 2]])),
    stemTrack('bass-sub', `Living Bass below ${XO} Hz: mono, ducked under every kick.`, A('bass'), MIX.bassSub,
      [{ type: 'lowpass', frequencyHz: XO }, { type: 'lowpass', frequencyHz: XO }, { type: 'highpass', frequencyHz: 30 }],
      ducked(MIX.bassSub, [[AF0, at(56), -2]], kickBeats, 9, 25, 110, [...holeIn(), fadeOut(STOP, STOP + 0.5, MIX.bassSub)]), 0),
    stemTrack('bass-mid', `Living Bass above ${XO} Hz: the talking body, the reply, the melodic bass; saturated for small speakers.`, A('bass'), MIX.bassMid,
      [{ type: 'highpass', frequencyHz: XO }, { type: 'highpass', frequencyHz: XO }, { type: 'saturation', driveDb: 6, mix: 0.5 }, { type: 'lowpass', frequencyHz: 6000 }],
      ducked(MIX.bassMid, [[at(5), UND0, -1], [UND0, at(27), FIX.bassUnder], [GL0, GL1, 1], [AF0, at(54), -6], [at(54), at(56), -3], ...(FIX.bassReturn ? [[at(56), at(64), FIX.bassReturn] as Seg] : []), [at(68), at(70), 2], [at(81), at(82), 1]], kickBeats, 4, 20, 90, [...holeIn(), fadeOut(STOP, STOP + 0.5, MIX.bassMid)])),
    stemTrack('voice', 'Impossible Voice: two notes of every riff in the undertow, the glitch passage, the last answer before the end.', A('voice'), MIX.voice,
      [{ type: 'highpass', frequencyHz: 160 }, { type: 'compressor', thresholdDb: -20, ratio: 2, attackMs: 6, releaseMs: 120, makeupGainDb: 2 }, { type: 'delay', timeMs: r6(750 * BEAT_SECONDS), wet: 0.08 }],
      levelLane(MIX.voice, [[at(21), at(25), FIX.voiceUnder], [GL0, at(41), 3], [at(81), at(82) + 1, 2]], holeIn()), undefined, voicePan()),
    stemTrack('lead', 'THRONE//VOLT: the hook dark, talking, at night, singing the reply, at full voice; the cascade and the climb.', A('lead'), MIX.lead,
      [{ type: 'highpass', frequencyHz: 170 }, { type: 'compressor', thresholdDb: -18, ratio: 2, attackMs: 8, releaseMs: 120, makeupGainDb: 1 }, { type: 'delay', timeMs: r6(750 * BEAT_SECONDS), wet: 0.06 }],
      levelLane(MIX.lead, FIX.landLead ? [[at(1), at(5), -4.5], [FIN0, at(74), 3], [at(74), at(77), 3 + FIX.landLead], [at(77), END, 3]] : [[at(1), at(5), -4.5], [FIN0, END, 3]], [fadeOut(STOP + 0.8, STOP + 1.6, MIX.lead + 3)])),
    stemTrack('pad', 'THRONE//VOLT pad: the chord bed, breathing with the pulse.', A('pad'), MIX.pad,
      [{ type: 'highpass', frequencyHz: 190 }, { type: 'lowpass', frequencyHz: 7000 }],
      ducked(MIX.pad, [[at(1), at(2), -3], [GL0, GL1, -2], [at(54), at(56), -4], [FIN0, END, -2]], PULSE_BEATS, 7, 15, 170, [...holeIn(), ...rest26(), fadeOut(STOP, STOP + 0.8, MIX.pad - 2)])),
    stemTrack('choir-low', 'HEAVEN//MASS basses (octavists on the blooms and the landing) and tenors.', A('choir-low'), MIX.choirLow,
      [{ type: 'highpass', frequencyHz: 60 }], ducked(MIX.choirLow, [[at(72), at(74), -6], [at(74), at(77), -3], [at(82), END, -4]], kickBeats.filter(b => b >= at(72)), 2, 20, 120)),
    stemTrack('choir-high', 'HEAVEN//MASS altos and sopranos: the half-speed hook, the hymn in canon, the catching-up echo, the landing, the afterglow.', A('choir-high'), MIX.choirHigh,
      [{ type: 'highpass', frequencyHz: 140 }], levelLane(MIX.choirHigh, [[at(70), at(74), -5], ...(FIX.landChoir ? [[at(74), at(77), FIX.landChoir] as Seg] : []), [at(77), at(82), FIX.afterglow], [at(83), END + 4, -6]])),
    stemTrack('room', 'The shared rack room (wet only) of the lead, pad, bass/voice and percussion scores.', A('room'), MIX.room, [{ type: 'highpass', frequencyHz: 280 }], FIX.roomWide ? levelLane(MIX.room, [[UND0, at(SB.glitch), FIX.roomWide], [at(56), at(64), FIX.roomWide]], [...holeIn(), ...rest26()]) : lane(MIX.room, [...holeIn(), ...rest26()])),
  ],
};

/** Section and event map for the QA. */
export const MAP = {
  bpm: BPM, bars: BARS, tailSeconds: TAIL_SECONDS, beatSeconds: BEAT_SECONDS,
  sections: SEC_BEATS.map(([id, from], i) => ({ id, fromBeat: from, toBeat: from + SECTIONS[i]!.bars * 4 })),
  kicks: KICKS.map(([b]) => b), snares: SNARES.map(([b]) => b),
  hook: [...leadNotes.map(n => ({ part: 'lead', beat: n[0], beats: n[1], pitch: midi(n[2]), ...(n[4]?.fallBeats ? { fallBeats: n[4].fallBeats } : {}) })),
    ...voiceNotes.map(n => ({ part: 'voice', beat: n[0], beats: n[1], pitch: midi(n[2]) })),
    ...[...BASS_MELODY, ...REPLY_NOTES].map(n => ({ part: 'bass-mid', beat: n[0], beats: n[1], pitch: midi(n[2]) })),
    ...CHOIR.soprano.filter(n => n[0] < at(SB.ret)).map(n => ({ part: 'choir-high', beat: n[0], beats: n[1], pitch: midi(n[2]) })),
    ...CHOIR.alto.filter(n => n[0] >= at(45) && n[0] < at(SB.ret)).map(n => ({ part: 'choir-high', beat: n[0], beats: n[1], pitch: midi(n[2]) }))],
  counter: CHOIR.soprano.filter(n => n[0] >= at(70) && n[0] < at(74)).map(n => ({ part: 'choir-high', beat: n[0], beats: n[1], pitch: midi(n[2]) })),
  hole: HOLE, rest: REST26, bloomBeat: BLOOM, landingBeat: at(74), resolutionBeat: S(76, 7), stopBeat: STOP, sectionBars: SB,
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = join(HERE, 'source');
  mkdirSync(out, { recursive: true });
  for (const { id, score } of SCORES) writeFileSync(join(out, `${id}.score.json`), JSON.stringify(score, null, 1) + '\n');
  writeFileSync(join(out, 'afterimage-pulse-full.project.json'), JSON.stringify(project, null, 1) + '\n');
  for (const [name, kit] of Object.entries(KITS)) writeFileSync(join(out, `${name}-kit.json`), JSON.stringify(kit, null, 2) + '\n');
  writeFileSync(join(out, 'map.json'), JSON.stringify(MAP, null, 1) + '\n');
  const count = (id: string) => SCORES.flatMap(s => (s.score.parts as { id: string; notes: unknown[] }[])).filter(p => p.id === id).reduce((n, p) => n + p.notes.length, 0);
  console.log(`wrote ${out}${CANDIDATE ? ' (candidate)' : ''}: ${BARS} bars, ${(END * BEAT_SECONDS + TAIL_SECONDS).toFixed(1)} s; lead ${count('lead')}, pad ${count('pad')}, echo ${count('echo')}, bass ${count('bass')}, voice ${count('voice')}, ` +
    `choir ${CHOIR.soprano.length + CHOIR.alto.length + CHOIR.tenor.length + CHOIR.bass.length}, skin ${count('skin')}, log ${count('log')}; kicks ${KICKS.length}, snares ${SNARES.length}, ghosts ${GHOSTS.length}, hats ${HATS.length}`);
}
