/**
 * THE CATHEDRAL EXPERIMENT · compositions (single source of truth for every score and engine project).
 *
 * Three auditions over the approved Concrete Gospel V2 backing, and three dry examples:
 *   1 throne-volt      THRONE//VOLT plays V2's hook (bars 5-16) over V2's drums, 808, bell and clank
 *   2 cathedral-engine CATHEDRAL//ENGINE plays the same hook and its harmony (bars 5-16) over the same backing
 *   3 heaven-mass      HEAVEN//MASS sings an original four-part passage over V2's bars 1-12 (dark drums, 808, bell)
 *   dry-*              each instrument alone: no room, no master, no drums
 *
 * The hook, the bar-12 major answer and the bar-16 amen are taken from V2's own rack score (imported from the
 * byte-identical copies in upstream/), never retyped. The backing tracks are V2's own engine tracks (kick, snare,
 * hats, toll, clank, 808) with V2's gains, effects and 808 duck; only the reed, the old choir and their room are left
 * out. Times are beats (quarter notes at 144 BPM) from the start of bar 1, as in V2.
 *
 *   node experiments/cathedral-experiment-001/compose.ts     writes source/
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as V1 from './upstream/concrete-gospel-001/compose.ts';
import * as V2 from './upstream/concrete-gospel-002/compose.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
export const BPM = 144;
/**
 * The QA switch. `node build.ts --pre-qa` (or CATHEDRAL_PRE_QA=1) rebuilds the candidate exactly as it was measured
 * before the one QA/fix pass; without it, the fixes F1-F4 apply (see the README and qa/). F5 is in the QA tool only.
 */
export const PRE_QA = process.argv.includes('--pre-qa') || process.env.CATHEDRAL_PRE_QA === '1';
const QA = !PRE_QA;
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
type Opts = Record<string, string | number>;
export type RackNote = [number, number, string, number, Opts?];
const rn = (beat: number, beats: number, pitch: string, vel: number, o?: Opts): RackNote => (o && Object.keys(o).length ? [r6(beat), r6(beats), pitch, r6(vel), o] : [r6(beat), r6(beats), pitch, r6(vel)]);
const SCHEMA = 'daemonv12.signature-rack.score/1';
const V2_SECTIONS = [{ id: 'sermon', bars: 4 }, { id: 'doors', bars: 4 }, { id: 'crack', bars: 4 }, { id: 'amen', bars: 4 }];

// ------------------------------------------------------------------------------------------------ the approved material
const v2part = (id: string) => V2.rackScore.parts.find(p => p.id === id)!;
/** V2's hook from the drop (bar 5) on. The bar-12 breath (a reed-only gesture) is left to the reed. */
export const HOOK = (v2part('reed').notes as RackNote[]).filter(n => n[0] >= 16 && n[4]?.articulation !== 'breathy');
/** V2's three-voice answers: the bar-12 major "amen" and the bar-16 minor amen (from the old choir parts), per voice. */
const amenOf = (id: string) => (v2part(id).notes as RackNote[]).filter(n => n[0] >= 44);
const AMEN_TOP = amenOf('choir-top'), AMEN_MID = amenOf('choir-mid'), AMEN_LOW = amenOf('choir-low');
const AMEN = [...AMEN_TOP, ...AMEN_MID, ...AMEN_LOW];

// ------------------------------------------------------------------------------------------------ 1 · THRONE//VOLT
/**
 * The hook on the analog lead. Articulations translate one to one (accent -> accent, legato slides -> portamento,
 * tongued -> normal); the reed's breath falls become THRONE//VOLT pitch falls that accelerate like a moan over the last
 * part of the long Ab4 (with the filter closing as it goes). The macro moves smoulder -> blaze with the arrangement:
 * groove A warm and dark, groove B hotter, the bar-13 slam blazing with a growl on the held C5 (V2's growl spot).
 */
const voltLead: RackNote[] = HOOK.map(([b, d, p, v, o]) => {
  const x: Opts = {};
  if (o?.articulation === 'accent') x.articulation = 'accent';
  else if (o?.articulation === 'legato') { x.articulation = 'legato'; if (typeof o.slide === 'number') x.slide = o.slide; }
  if (typeof o?.fall === 'number') { x.fall = o.fall; x.fallBeats = r6(Math.min(1.25, d * 0.55)); }
  return rn(b, d, p, v, x);
});
/** The answers in bar 12 (major) and bar 16 (minor amen), as three analog voices: they glide voice by voice. */
const voltAmen: RackNote[] = AMEN.map(([b, d, p, v, o]) => rn(b, d, p, v, o?.articulation === 'legato' ? { articulation: 'legato', slide: o.slide as number } : b >= 62 ? { articulation: 'swell' } : {}));
export const throneScore = {
  schema: SCHEMA, title: 'Cathedral Experiment 1: THRONE//VOLT over Concrete Gospel V2', bpm: BPM, key: 'F minor', swing: 0.5, seed: 1441, tailSeconds: 3.4, masterGainDb: 0,
  description: 'THRONE//VOLT plays the Concrete Gospel hook from bar 5 (and the bar-12 and bar-16 answers) for the approved V2 drum/bass backing.',
  sections: V2_SECTIONS,
  room: { rt60: 1.9, size: 1.2, damp: 5000, predelayMs: 24, lowCut: 250 }, // V2's own room for its lead
  parts: [
    {
      id: 'volt', instrument: 'throne-volt', gainDb: -3, pan: 0, room: 0.2,
      setup: { seed: 7071, glide: 0.07, release: 0.32, attack: 0.005, vibRate: 5.0, drift: 3.5, keytrack: 0.6, lowcut: 140 },
      macro: [[16, 0.5], [31.9, 0.55], [32, 0.64], [43.9, 0.66], [48, 0.88], [55.9, 0.9], [56, 0.84], [64, 0.84]],
      expression: [[16, 0.74], [47.9, 0.74], [48, 0.84]],
      offsets: { growl: [[48.9, 0], [49.1, 0.32], [50.4, 0.32], [50.5, 0]], bloom: [[48, 0], [64, 0.2]] },
      notes: voltLead,
    },
    {
      id: 'volt-amen', instrument: 'throne-volt', gainDb: -3, pan: 0, room: 0.34,
      setup: { seed: 7072, glide: 0.05, release: 0.9, attack: 0.03, vibRate: 4.6, drift: 4, keytrack: 0.5, lowcut: 110 },
      macro: [[44, 0.34], [60, 0.3]], expression: [[44, 0.7], [62, 0.6]],
      controls: { width: 0.95, sub: 0.25, vib: 6 },
      notes: voltAmen,
    },
  ],
};

// ------------------------------------------------------------------------------------------------ 2 · CATHEDRAL//ENGINE
/**
 * The same hook on the Great (Principal 8' + Octave 4' + Trumpet 8': a solo with brass fire and a principal's body).
 * An organ cannot bend, so each moan is played the organ's way: the long Ab4 steps down chromatically and the last key
 * is let up slowly (`sag`: the pallet half closes, the pipe droops and softens). Accents are marcato (fast key).
 */
function organHook(notes: RackNote[]): RackNote[] {
  const out: RackNote[] = [];
  for (const [b, d, p, v, o] of notes) {
    const art: Opts = o?.articulation === 'accent' ? { articulation: 'marcato' } : {};
    if (typeof o?.fall === 'number') {
      const steps = o.fall >= 5 ? ['G4', 'F4', 'Eb4'] : ['G4', 'F4'], last = d > 2 ? 0.75 : 0.5, head = d - 0.25 * (steps.length - 1) - last;
      out.push(rn(b, head, p, v, art));
      steps.forEach((s, i) => { const isLast = i === steps.length - 1; out.push(rn(b + head + 0.25 * i, isLast ? last : 0.25, s, v * (0.94 - 0.04 * i), isLast ? { sag: d > 2 ? 60 : 40 } : {})); });
    } else out.push(rn(b, d, p, v, art));
  }
  return out;
}
const greatNotes: RackNote[] = [
  ...organHook(HOOK),
  // bar 12: the major answer's top line on the full Great (the cathedral appears where the 808 tape-stops out)
  ...AMEN_TOP.filter(n => n[0] < 62).map(([b, d, p, v]) => rn(b, d, p, Math.min(1, v + 0.1))),
];
/**
 * The Swell answers with the harmony of V2's own groove (the 808 roots: F in the call bar, Bb in the answer bar, C on
 * the pickup), voice-led so every move is a step: Fm7 (F Ab C Eb) -> Bbm7 (F Ab Db F) -> C7 (E G Bb E) -> Fm7; the inner
 * line F-E-Eb is the chromatic gospel turn. Bar 12 is V2's major amen (its middle and low voices); bar 16 its minor amen.
 */
const FM7 = ['F3', 'Ab3', 'C4', 'Eb4'], BBM7 = ['F3', 'Ab3', 'Db4', 'F4'], C7 = ['E3', 'G3', 'Bb3', 'E4'];
const swellNotes: RackNote[] = [];
const chord = (b: number, d: number, ps: string[], v: number, o?: Opts) => ps.forEach(p => swellNotes.push(rn(b, d, p, v, o)));
for (const c of [16, 24, 32, 48]) { chord(c, 4, FM7, 0.75); chord(c + 4, 3.5, BBM7, 0.75); chord(c + 7.5, 0.5, C7, 0.8); }
chord(40, 4.4, FM7, 0.75);                                                     // bar 11 into the bar-12 answer
[...AMEN_MID, ...AMEN_LOW].filter(n => n[0] < 62).forEach(([b, d, p, v]) => swellNotes.push(rn(b, d + (p === 'F3' ? 0.3 : 0), p, v)));
chord(56, 4, FM7, 0.75); chord(60, 2, BBM7, 0.75);                             // bars 15-16
AMEN.filter(n => n[0] >= 62).forEach(([b, d, p, v]) => swellNotes.push(rn(b, d + 0.6, p, v)));  // the minor amen, all three voices, held into the Nave
const pedalNotes: RackNote[] = [rn(44.5, 3.45, 'F2', 0.9), rn(62, 3.1, 'F2', 0.85)];  // only where the 808 is gone
const NAVE = { rt60: 5.6, size: 1.7, predelay: 48, lowCut: 180, damp: 4500, width: 1.1, ...(QA ? {} : { lowMono: 0 }) };
export const cathedralScore = {
  schema: SCHEMA, title: 'Cathedral Experiment 2: CATHEDRAL//ENGINE over Concrete Gospel V2', bpm: BPM, key: 'F minor', swing: 0.5, seed: 1442, tailSeconds: 3.4, masterGainDb: 0,
  description: 'CATHEDRAL//ENGINE plays the Concrete Gospel hook and its harmony from bar 5 for the approved V2 drum/bass backing; full organ and the 32\' take the floor where the 808 drops out.',
  sections: V2_SECTIONS,
  parts: [
    {
      id: 'great', instrument: 'cathedral-engine/great', gainDb: -6, pan: 0, room: 0,
      setup: { ...NAVE, seed: 8081, output: 'mix' },
      controls: {
        principal8: 0.8, trumpet8: [[16, 0.78], [43.6, 0.78], [44.2, 0.95], [47.8, 0.95], [48, 0.85]],
        octave4: [[16, 0.35], [43.6, 0.35], [44.2, 0.85], [47.8, 0.85], [48, 0.6], [55.8, 0.6], [56, 0.4]],
        fifteenth: [[16, 0], [43.6, 0], [44.2, 0.8], [47.8, 0.8], [48, 0.45], [55.8, 0.45], [56, 0]],
        twelfth: [[16, 0], [43.6, 0], [44.2, 0.6], [47.8, 0.6], [48, 0]],
        mixture: [[16, 0], [43.6, 0], [44.2, 0.9], [47.8, 0.9], [48, 0.5], [55.8, 0.5], [56, 0]],
        bourdon16: [[16, 0], [43.6, 0], [44.2, 0.75], [47.8, 0.75], [48, 0]],
        space: [[16, 0.32], [43.6, 0.32], [44.3, 0.8], [47.8, 0.8], [48, 0.36], [61.5, 0.36], [62.2, 0.85]],
        chiff: 1.1, wind: 0.5,
      },
      expression: [[16, 0.72], [47.9, 0.72], [48, 0.8]],
      notes: greatNotes,
    },
    {
      id: 'swell', instrument: 'cathedral-engine/swell', gainDb: -6, pan: 0, room: 0,
      setup: { ...NAVE, seed: 8082, output: 'mix' },
      controls: {
        gedackt8: 0.9, celeste8: 0.75, flute4: [[16, 0], [31.8, 0], [32.2, 0.4], [43.6, 0.4], [44.2, 0.8], [47.8, 0.8], [48, 0.35]], hautbois8: [[16, 0], [43.6, 0], [44.2, 0.6], [47.8, 0.6], [48, 0]],
        swell: [[16, 0.28], [31.8, 0.3], [32.2, 0.45], [43.6, 0.48], [44.3, 0.9], [47.8, 0.9], [48, 0.55], [61.5, 0.55], [62.5, 0.95]],
        space: [[16, 0.42], [43.6, 0.42], [44.3, 0.95], [47.8, 0.95], [48, 0.45], [61.5, 0.45], [62.2, 1]], trem: 0, wind: 0.45,
      },
      notes: swellNotes,
    },
    {
      id: 'pedal', instrument: 'cathedral-engine/pedal', gainDb: -6, pan: 0, room: 0,
      // QA fix F1 (completed): a single pedal note stood wholly in its tower (the right one for F); half width keeps a tower
      // feel without leaving the only bass of bar 12 on one side
      setup: { ...NAVE, seed: 8083, output: 'mix', ...(QA ? { width: 0.5 } : {}) },
      controls: { subbass16: 0.95, contra32: 0.85, octave8: [[44, 0.8], [60, 0.55]], posaune16: [[44, 0.75], [60, 0]], space: 0.55, wind: 0.5 },
      notes: pedalNotes,
    },
  ],
};

// ------------------------------------------------------------------------------------------------ 3 · HEAVEN//MASS
/**
 * An original passage for the choir (not the hook), over V2's own first twelve bars: the a-cappella "sermon" (bell, then
 * quiet hats), the drop at bar 5 (kick, 808, snare, hats, clank), groove B, and the bar-12 hole where the 808 tape-stops
 * and the drums vanish. It grows from dark and intimate to enormous and heavenly:
 *   bars 1-2  basses hum F alone, tenors join on the fifth and sigh up to Db: two or three voices, close, breathing
 *   bars 3-4  altos join (Fm), the line walks F-Db-C in the basses down to a low C: a half cadence into the drop
 *   bars 5-8  sopranos enter with the drums; Fm7 / Bbm7 / C7(b9) with V2's 808; vowels open oh -> aw -> ah; singers join
 *   bars 9-10 a second soprano part; the melody climbs F5 G5 Ab5 over Fm9 and Bbm7, a C7(b9) pulls back to Fm
 *   bar 11    Fm, then Bbm over the F pedal (the minor plagal "amen"), the melody prepared on Bb5
 *   bar 12    the drums drop out: Bb5 and Bb3 hang as suspensions over F, then fall to A natural together: F MAJOR, the
 *             Picardy third, the first light in the piece. Octavists sing F1 beneath, a far descant floats on C6.
 * Sustained chord tones are tuned just against the bass (thirds and sixths pure), so the big chords ring.
 */
type V = 'mm' | 'oo' | 'oh' | 'aw' | 'ah' | 'uh' | 'eh' | 'ee';
interface Ch { at: number; len: number; b: string; t: string; a: string; s1?: string; s2?: string; v: number; vowel: V; to?: V }
const CHORDS: Ch[] = [
  { at: 12, len: 2, b: 'Db2', t: 'F3', a: 'Ab3', v: 0.62, vowel: 'oh' },
  { at: 14, len: 2, b: 'C2', t: 'E3', a: 'G3', v: 0.66, vowel: 'oh' },
  { at: 16, len: 2, b: 'F2', t: 'Ab3', a: 'Eb4', s1: 'C5', v: 0.7, vowel: 'oh' },
  { at: 18, len: 2, b: 'F2', t: 'C4', a: 'Ab4', s1: 'Eb5', v: 0.72, vowel: 'oh' },
  { at: 20, len: 3.5, b: 'Bb2', t: 'Db4', a: 'Ab4', s1: 'Db5', v: 0.74, vowel: 'oh', to: 'aw' },
  { at: 23.5, len: 0.5, b: 'C3', t: 'Bb3', a: 'G4', s1: 'Db5', v: 0.76, vowel: 'aw' },
  { at: 24, len: 2, b: 'F2', t: 'Ab3', a: 'Ab4', s1: 'C5', v: 0.74, vowel: 'aw' },
  { at: 26, len: 2, b: 'F2', t: 'C4', a: 'Ab4', s1: 'F5', v: 0.78, vowel: 'aw', to: 'ah' },
  { at: 28, len: 2, b: 'Bb2', t: 'Db4', a: 'Ab4', s1: 'Eb5', v: 0.8, vowel: 'ah' },
  { at: 30, len: 1.5, b: 'Bb2', t: 'Db4', a: 'F4', s1: 'Db5', v: 0.8, vowel: 'ah' },
  { at: 31.5, len: 0.5, b: 'C3', t: 'Bb3', a: 'E4', s1: 'C5', v: 0.84, vowel: 'ah' },
  { at: 32, len: 2, b: 'F2', t: 'Ab3', a: 'F4', s2: 'C5', s1: 'F5', v: 0.84, vowel: 'ah' },
  { at: 34, len: 2, b: 'F2', t: 'C4', a: 'Ab4', s2: 'Eb5', s1: 'G5', v: 0.86, vowel: 'ah' },
  { at: 36, len: 3.5, b: 'Bb2', t: 'Db4', a: 'F4', s2: 'Db5', s1: 'Ab5', v: 0.88, vowel: 'ah' },
  { at: 39.5, len: 0.5, b: 'C3', t: 'Bb3', a: 'E4', s2: 'Db5', s1: 'G5', v: 0.9, vowel: 'ah' },
  { at: 40, len: 2, b: 'F2', t: 'Ab3', a: 'F4', s2: 'C5', s1: 'Ab5', v: 0.9, vowel: 'ah' },
  { at: 42, len: 2, b: 'F2', t: 'Bb3', a: 'F4', s2: 'Db5', s1: 'Bb5', v: 0.94, vowel: 'ah' },
  { at: 44, len: 1, b: 'F2', t: 'Bb3', a: 'F4', s2: 'C5', s1: 'Bb5', v: 0.98, vowel: 'ah' },
  { at: 45, len: 5.2, b: 'F2', t: 'A3', a: 'F4', s2: 'C5', s1: 'A5', v: 1, vowel: 'ah' },
];
/** Just intonation against the bass, in cents from equal temperament (7ths, 9ths and 2nds stay equal-tempered). */
const JUST: Record<number, number> = { 0: 0, 2: 0, 3: 15.6, 4: -13.7, 5: -2, 7: 2, 8: 13.7, 9: -15.6 };
const midiOf = (p: string) => { const m = /^([A-G])(b|#)?(-?\d)$/.exec(p)!; return 12 * (Number(m[3]) + 1) + ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 } as Record<string, number>)[m[1]!]! + (m[2] === 'b' ? -1 : m[2] === '#' ? 1 : 0); };
const justCents = (p: string, bass: string, len: number) => (len >= 1 ? JUST[((midiOf(p) - midiOf(bass)) % 12 + 12) % 12] ?? 0 : 0);
function voice(key: 'b' | 't' | 'a' | 's1' | 's2'): RackNote[] {
  const out: RackNote[] = [];
  for (const c of CHORDS) {
    const p = c[key]; if (!p) continue;
    const prev = out[out.length - 1], o: Opts = { vowel: c.vowel, ...(c.to ? { to: c.to } : {}) };
    const cents = key === 'b' ? 0 : justCents(p, c.b, c.len); if (cents) o.cents = r6(cents);
    // a held note that continues into the next chord at the same pitch is one sung note (no re-articulation)
    if (prev && prev[2] === p && Math.abs(prev[0] + prev[1] - c.at) < 1e-6 && !(key === 's1' && c.at === 45) && (prev[4]?.cents ?? 0) === (o.cents ?? 0)) { prev[1] = r6(prev[1] + c.len); if (c.to) prev[4] = { ...prev[4], to: c.to }; continue; }
    out.push(rn(c.at, c.len, p, c.v, o));
  }
  return out;
}
// the intimate opening, before the chorale proper: basses hum F alone, tenors join on the fifth and sigh up to Db
const choirB: RackNote[] = [rn(0, 8, 'F2', 0.68, { vowel: 'mm', to: 'oo', articulation: 'swell' }), rn(8, 4, 'F2', 0.72, { vowel: 'oo' }), ...voice('b')];
const choirT: RackNote[] = [rn(2, 2, 'C3', 0.62, { vowel: 'mm', cents: 2 }), rn(4, 4, 'Db3', 0.66, { vowel: 'oo', cents: 13.7 }), rn(8, 4, 'C3', 0.7, { vowel: 'oo', cents: 2 }), ...voice('t')];
const choirA: RackNote[] = [rn(8, 4, 'Ab3', 0.68, { vowel: 'oo', cents: 15.6, articulation: 'swell' }), ...voice('a')];
const choirS1 = voice('s1'), choirS2 = voice('s2');
const descant: RackNote[] = [rn(45.5, 4.7, 'C6', 0.62, { vowel: 'oo', articulation: 'swell', cents: 2 })];
const CHOIR_MACRO: [number, number][] = [[0, 0.02], [14, 0.16], [16, 0.32], [31, 0.55], [32, 0.65], [39, 0.78], [40, 0.82], [43.5, 0.9], [44, 1]];
// calibration: the first render spanned 24 dB from bar 1 to bar 12 (LRA 14 LU): the opening was too faint for a phone
const CHOIR_EXPR: [number, number][] = [[0, 0.62], [8, 0.66], [15.5, 0.7], [16, 0.66], [31.5, 0.72], [32, 0.78], [40, 0.84], [44, 0.9], [46.5, 0.94], [49, 0.88], [50.2, 0.6]];
/** Rack-stage gains (headroom in the PCM16 stems); the engine mix (MIX) restores the balance. */
const RACK_GAIN: Record<string, number> = { bass: -14, tenor: -12, alto: -10, soprano: -13, 'soprano-2': -10, descant: -6 };
const section = (id: string, instrument: string, notes: RackNote[], setup: Opts, extra: Record<string, unknown> = {}) => ({
  id, instrument, gainDb: RACK_GAIN[id] ?? -12, pan: 0, room: 0, setup: { depth: 0.65, lowCut: 150, output: 'mix', ...(QA ? {} : { centre: 0 }), ...setup }, macro: CHOIR_MACRO, expression: CHOIR_EXPR, notes, ...extra,
});
export const heavenScore = {
  schema: SCHEMA, title: 'Cathedral Experiment 3: HEAVEN//MASS over the Concrete Gospel V2 drums', bpm: BPM, key: 'F minor', swing: 0.5, seed: 1443, tailSeconds: 4, masterGainDb: 0,
  description: 'HEAVEN//MASS sings an original four-part passage (with divisi sopranos, octavists and a far descant) over the first twelve bars of the approved V2 drum/bass backing, growing from intimate to heavenly.',
  sections: [{ id: 'sermon', bars: 4 }, { id: 'doors', bars: 4 }, { id: 'crack', bars: 4 }],
  parts: [
    section('bass', 'heaven-mass/bass', choirB, { seed: 9001, singers: 6, octavists: 3, ...(QA ? { center: -0.05 } : {}) }, { controls: { octavist: [[0, 0], [43.9, 0], [44.4, 0.95], [50.5, 0.95]] } }),
    section('tenor', 'heaven-mass/tenor', choirT, { seed: 9002, singers: 6 }),
    section('alto', 'heaven-mass/alto', choirA, { seed: 9003, singers: 6 }),
    section('soprano', 'heaven-mass/soprano', choirS1, { seed: 9004, singers: 6 }),
    section('soprano-2', 'heaven-mass/soprano', choirS2, { seed: 9005, singers: 5, center: -0.18 }),
    section('descant', 'heaven-mass/soprano', descant, { seed: 9006, singers: 3, center: 0.12, depth: 1 }, { macro: 1, expression: [[45, 0.7], [47, 0.86], [49.5, 0.8], [50.2, 0.55]], controls: { air: 0.75, room: 1.25, width: 0.6 } }),
  ],
};

// ------------------------------------------------------------------------------------------------ dry examples
const at = (notes: RackNote[], from: number, to: number) => notes.map(([b, d, p, v, o]) => rn(b - from + to, d, p, v, o));
const call = HOOK.filter(n => n[0] >= 16 && n[0] < 24);           // the hook's first statement (call + answer)
export const dryVoltScore = {
  schema: SCHEMA, title: 'Cathedral Experiment dry: THRONE//VOLT', bpm: BPM, key: 'F minor', swing: 0.5, seed: 2001, tailSeconds: 2.5, masterGainDb: 0,
  description: 'THRONE//VOLT alone, no room: a held note (attack, bloom, late vibrato, release), the hook warm, portamento and a growl, a chord swept smoulder -> blaze, the hook blazing.',
  sections: [{ id: 'held', bars: 2 }, { id: 'hook', bars: 2 }, { id: 'glide', bars: 2 }, { id: 'chord', bars: 2 }, { id: 'blaze', bars: 2 }],
  parts: [{
    id: 'volt', instrument: 'throne-volt', gainDb: -3, pan: 0, room: 0, setup: { seed: 7071, glide: 0.07, release: 0.32, drift: 3.5, lowcut: 100 },
    macro: [[0, 0.3], [7.9, 0.3], [8, 0.55], [15.9, 0.55], [16, 0.75], [23.9, 0.75], [24, 0.2], [31, 1], [32, 1]],
    offsets: { growl: [[16, 0], [20.4, 0], [20.8, 0.45], [23.5, 0.45], [23.6, 0]] },
    notes: [
      rn(0, 6, 'C4', 0.8),
      ...at(call.map(([b, d, p, v, o]) => [b, d, p, v, voltLead.find(x => x[0] === b)?.[4]] as RackNote), 16, 8),
      rn(16, 2, 'F4', 0.85), rn(18, 2, 'C5', 0.85, { articulation: 'legato', slide: 0.5 }), rn(20, 3.5, 'Ab4', 0.85, { articulation: 'legato', slide: 0.35, fall: 5, fallBeats: 1.5 }),
      ...['F3', 'Ab3', 'C4', 'Eb4', 'G4'].map(p => rn(24, 7.2, p, 0.72, { articulation: 'swell' })),
      ...at(call.map(([b, d, p, v, o]) => [b, d, p, Math.min(1, v + 0.06), voltLead.find(x => x[0] === b)?.[4]] as RackNote), 16, 32),
    ],
  }],
};
export const dryCathedralScore = {
  schema: SCHEMA, title: 'Cathedral Experiment dry: CATHEDRAL//ENGINE', bpm: BPM, key: 'F minor', swing: 0.5, seed: 2002, tailSeconds: 3, masterGainDb: 0,
  description: 'CATHEDRAL//ENGINE with no Nave: Principal 8\' alone, then the chorus builds (Octave 4\', Fifteenth, Mixture), the Trumpet plays the hook\'s call, the Swell opens its box on the Celeste, the Pedal 16\' and the resultant 32\', then full organ: F minor, then F major.',
  sections: [{ id: 'chorus', bars: 3 }, { id: 'trumpet', bars: 1 }, { id: 'swell', bars: 2 }, { id: 'pedal', bars: 1 }, { id: 'tutti', bars: 2 }],
  parts: [
    {
      id: 'great', instrument: 'cathedral-engine/great', gainDb: -10, pan: 0, room: 0, setup: { seed: 8081, output: 'dry', ...(QA ? {} : { lowMono: 0 }) },
      controls: {
        principal8: [[0, 0.8], [11.9, 0.8], [12, 0.6], [15.9, 0.6], [16, 0.8]], octave4: [[0, 0], [3.9, 0], [4, 0.8], [11.9, 0.8], [12, 0], [27.9, 0], [28, 0.85]],
        fifteenth: [[0, 0], [3.9, 0], [4, 0.75], [11.9, 0.75], [12, 0], [27.9, 0], [28, 0.8]], mixture: [[0, 0], [7.9, 0], [8, 0.85], [11.9, 0.85], [12, 0], [27.9, 0], [28, 0.9]],
        twelfth: [[0, 0], [27.9, 0], [28, 0.6]], bourdon16: [[0, 0], [27.9, 0], [28, 0.75]], trumpet8: [[0, 0], [11.9, 0], [12, 0.9], [15.9, 0.9], [16, 0], [27.9, 0], [28, 0.95]],
      },
      notes: [rn(0, 2, 'C4', 0.8), rn(2, 2, 'F4', 0.8), ...['F3', 'Ab3', 'C4'].map(p => rn(4, 4, p, 0.8)), ...['F3', 'Ab3', 'C4', 'F4'].map(p => rn(8, 4, p, 0.8)),
        ...organHook(call).filter(n => n[0] < 24).map(([b, d, p, v, o]) => rn(b - 4, d, p, v, o)).filter(n => n[0] < 16),
        ...['F3', 'Ab3', 'C4', 'F4'].map(p => rn(28, 4, p, 0.85)), ...['F3', 'A3', 'C4', 'F4'].map(p => rn(32, 4.5, p, 0.85))],
    },
    {
      id: 'swell', instrument: 'cathedral-engine/swell', gainDb: -10, pan: 0, room: 0, setup: { seed: 8082, output: 'dry', ...(QA ? {} : { lowMono: 0 }) },
      controls: { gedackt8: 0.9, celeste8: 0.8, flute4: [[0, 0], [27.9, 0], [28, 0.6]], hautbois8: [[0, 0], [27.9, 0], [28, 0.7]], swell: [[16, 0], [23.5, 1]] },
      notes: [...['Ab3', 'C4', 'Eb4'].map(p => rn(16, 7.6, p, 0.75)), ...['Ab4', 'C5'].map(p => rn(28, 4, p, 0.8)), ...['A4', 'C5'].map(p => rn(32, 4.5, p, 0.8))],
    },
    {
      id: 'pedal', instrument: 'cathedral-engine/pedal', gainDb: -10, pan: 0, room: 0, setup: { seed: 8083, output: 'dry', ...(QA ? {} : { lowMono: 0 }) },
      controls: { subbass16: 0.95, contra32: [[0, 0], [25.9, 0], [26, 0.9]], octave8: [[0, 0], [27.9, 0], [28, 0.8]], posaune16: [[0, 0], [27.9, 0], [28, 0.8]] },
      notes: [rn(24, 2, 'F2', 0.85), rn(26, 2, 'F2', 0.85), rn(28, 4, 'F2', 0.9), rn(32, 4.5, 'F2', 0.9)],
    },
  ],
};
const sec = (id: string, inst: string, seed: number, notes: RackNote[], macro: unknown, extra: Record<string, unknown> = {}) =>
  ({ id, instrument: inst, gainDb: -13, pan: 0, room: 0, setup: { seed, singers: 6, octavists: 3, output: 'dry', ...(QA ? {} : { centre: 0 }) }, macro, notes, ...extra });
const TUTTI: [number, string, string, string, string][] = [[32, 'F2', 'Ab3', 'F4', 'C5'], [36, 'F2', 'Bb3', 'F4', 'Db5'], [40, 'F2', 'Bb3', 'F4', 'Bb5'], [42, 'F2', 'A3', 'F4', 'A5']];
const tutti = (k: 1 | 2 | 3 | 4, vowelTo: V) => TUTTI.map(([b, ...ps], i) => rn(b, b === 42 ? 6 : b === 40 ? 2 : 4, ps[k - 1]!, 0.75 + 0.06 * i, { vowel: 'ah', ...(i === 0 ? { vowel: 'oh', to: vowelTo } : {}), ...(k > 1 ? { cents: r6(justCents(ps[k - 1]!, 'F2', 4)) } : {}) }));
export const dryHeavenScore = {
  schema: SCHEMA, title: 'Cathedral Experiment dry: HEAVEN//MASS', bpm: BPM, key: 'F minor', swing: 0.5, seed: 2003, tailSeconds: 3, masterGainDb: 0,
  description: 'HEAVEN//MASS with no room: basses alone (octavists join), tenors, altos, sopranos, then all four growing from intimate to heavenly: Fm, Bbm/F, the Bb5 suspension and F major.',
  sections: [{ id: 'basses', bars: 2 }, { id: 'tenors', bars: 2 }, { id: 'altos', bars: 2 }, { id: 'sopranos', bars: 2 }, { id: 'tutti', bars: 4 }],
  parts: [
    sec('bass', 'heaven-mass/bass', 9001, [rn(0, 4, 'F2', 0.7, { vowel: 'mm', to: 'oo' }), rn(4, 2, 'C2', 0.75, { vowel: 'oh' }), rn(6, 2, 'F2', 0.8, { vowel: 'oh', to: 'ah' }), ...tutti(1, 'ah')],
      [[0, 0.45], [32, 0.3], [44, 1]], { controls: { octavist: [[0, 0], [5.8, 0], [6.4, 0.9], [7.9, 0.9], [8, 0], [41.8, 0], [42.4, 0.9]] } }),
    sec('tenor', 'heaven-mass/tenor', 9002, [rn(8, 2, 'C3', 0.72, { vowel: 'oh' }), rn(10, 2, 'Db3', 0.76, { vowel: 'oh' }), rn(12, 4, 'C3', 0.8, { vowel: 'oh', to: 'ah' }), ...tutti(2, 'ah')], [[0, 0.45], [32, 0.3], [44, 1]]),
    sec('alto', 'heaven-mass/alto', 9003, [rn(16, 2, 'Ab3', 0.72, { vowel: 'oo' }), rn(18, 2, 'Bb3', 0.76, { vowel: 'oo', to: 'oh' }), rn(20, 4, 'C4', 0.8, { vowel: 'oh', to: 'ah' }), ...tutti(3, 'ah')], [[0, 0.45], [32, 0.3], [44, 1]]),
    sec('soprano', 'heaven-mass/soprano', 9004, [rn(24, 2, 'C5', 0.74, { vowel: 'oh' }), rn(26, 2, 'Eb5', 0.8, { vowel: 'oh', to: 'ah' }), rn(28, 4, 'A5', 0.86, { vowel: 'ah' }), ...tutti(4, 'ah')], [[0, 0.5], [32, 0.3], [44, 1]]),
  ],
};

// ------------------------------------------------------------------------------------------------ engine projects
type Track = { id: string; mix?: { gainDb?: number; pan?: number }; patterns?: { id: string; bars: number; notes: { start: string }[] }[]; automation?: { gainDb?: { at: { musical: string }; value: number; transition?: string }[] } } & Record<string, unknown>;
const BACKING = ['kick', 'snare', 'hats', 'toll', 'clank', 'bass808'];
const barOf = (start: string) => Number(start.split(':')[0]);
const beatOf = (musical: string) => { const m = /^(\d+):(\d+)(?:\+(\d+)\/(\d+))?$/.exec(musical)!; return (Number(m[1]) - 1) * 4 + Number(m[2]) - 1 + (m[3] ? Number(m[3]) / Number(m[4]) * 4 : 0); };
/** V2's backing tracks, unchanged; for a shorter excerpt, everything after the last bar is left out and the 808 stays silent. */
export function backing(bars: number): Track[] {
  return (structuredClone(V2.project.tracks) as unknown as Track[]).filter(t => BACKING.includes(t.id)).map(t => {
    if (bars >= V1.BARS) return t;
    for (const p of t.patterns ?? []) { p.bars = bars; p.notes = p.notes.filter(n => barOf(n.start) <= bars); }
    if (t.automation?.gainDb) {
      const end = bars * 4;
      t.automation.gainDb = t.automation.gainDb.filter(pt => beatOf(pt.at.musical) < end - 0.1);
      if (t.id === 'bass808') t.automation.gainDb.push({ at: { musical: V1.pos(end - 3.3) }, value: -60 }); // the dive has faded by then; nothing after the hole
    }
    return t;
  });
}
const labTrack = (id: string, description: string, gainDb: number, bars: number, effects: unknown[] = []) => ({
  id, description, instrument: { type: 'sampler', sample: `assets/lab/${id}.wav` }, mix: { gainDb }, effects,
  clips: [{ bar: 1, pattern: 'all' }], patterns: [{ id: 'all', bars, notes: [{ start: '1:1', velocity: 1 }] }],
});
/**
 * Mix levels of the new instruments. The lead tracks are set so the new hook sits at the V2 reed's in-mix loudness
 * over bars 5-16 (measured on calibration renders; see the README); the rest is balanced around them.
 */
export const MIX = {
  volt: 7.5, voltAmen: 1, voltRoom: -2,
  great: 5, swell: -3, pedal: 2.5,
  bass: 4, tenor: 3, alto: 3, soprano: 4, soprano2: 2, descant: -5,
};
const master = structuredClone(V2.project.master);
const projectBase = (title: string, description: string, bars: number, tail: number, tracks: unknown[]) => ({
  formatVersion: 1, title, description, bpm: BPM, timeSignature: '4/4', key: 'F minor', bars, seed: 1440, render: { tail: { seconds: tail } }, master, tracks,
});
/** The choir's basses and tenors give way a little at each kick (bars 5-11), as V2's 808 does, so the dark drums stay in front. */
type Pt = { at: { musical: string }; value: number; transition?: 'linear' };
const gpt = (beat: number, value: number): Pt => ({ at: { musical: V1.pos(beat) }, value: r6(value), transition: 'linear' });
/** QA fix F3: the choir sits 1.5 dB lower while the drums play (bars 5-11), so the kick and snare keep V2's punch. */
const RIDE = QA ? -1.5 : 0;
const ride = (base: number, beat: number) => base + (beat >= 15.95 && beat < 43.5 ? RIDE : beat >= 43.5 && beat < 44 ? RIDE * (44 - beat) / 0.5 : 0);
export function duckOnKicks(base: number, depth: number, untilBeat: number): Pt[] {
  const pts: Pt[] = [gpt(0, base), ...(RIDE ? [gpt(15.9, base)] : [])];
  for (const [k] of V2.KICKS.filter(([b]) => b < untilBeat)) pts.push(gpt(k - 30 / 960, ride(base, k)), gpt(k, ride(base, k) - depth), gpt(k + 140 / 960, ride(base, k) - 0.4 * depth), gpt(k + 360 / 960, ride(base, k)));
  if (RIDE) pts.push(gpt(43.5, ride(base, 43.4)), gpt(44, base));
  return pts;
}
const rideOnly = (base: number): Pt[] => [gpt(0, base), gpt(15.9, base), gpt(16, base + RIDE), gpt(43.5, base + RIDE), gpt(44, base)];
export const throneProject = projectBase('Cathedral Experiment 1: THRONE//VOLT', 'V2 backing (kick, snare, hats, toll, clank, 808) with THRONE//VOLT on the hook and the answers.', 16, throneScore.tailSeconds, [
  ...backing(16),
  // QA fix F4: +1.5 dB from the bar-13 slam (at "blaze" the lead's energy moves up and it led the mix by only 2.8 dB at 300 Hz-1 kHz)
  { ...labTrack('volt', 'THRONE//VOLT: the Concrete Gospel hook (rack stem).', MIX.volt, 16, [{ type: 'highpass', frequencyHz: 150 }, { type: 'compressor', thresholdDb: -22, ratio: 2, attackMs: 12, releaseMs: 160, makeupGainDb: 2 }, { type: 'lowpass', frequencyHz: 9000 }]),
    ...(QA ? { automation: { gainDb: [gpt(0, MIX.volt), gpt(47.9, MIX.volt), gpt(48, MIX.volt + 1.5)] } } : {}) },
  labTrack('volt-amen', 'THRONE//VOLT: the bar-12 major answer and the bar-16 minor amen, three voices.', MIX.voltAmen, 16, [{ type: 'highpass', frequencyHz: 120 }, { type: 'lowpass', frequencyHz: 8000 }]),
  labTrack('room', 'The rack room on the THRONE//VOLT parts (V2\'s room settings).', MIX.voltRoom, 16, [{ type: 'highpass', frequencyHz: 200 }]),
]);
export const cathedralProject = projectBase('Cathedral Experiment 2: CATHEDRAL//ENGINE', 'V2 backing with CATHEDRAL//ENGINE: the hook on the Great, the harmony on the Swell, the Pedal where the 808 is gone.', 16, cathedralScore.tailSeconds, [
  ...backing(16),
  labTrack('great', 'CATHEDRAL//ENGINE Great: the hook (Principal, Octave, Trumpet; full chorus in bar 12), with its Nave.', MIX.great, 16, [{ type: 'highpass', frequencyHz: 70 }]),
  labTrack('swell', 'CATHEDRAL//ENGINE Swell: the harmony (Gedackt, Celeste; the box opens in bar 12), with its Nave.', MIX.swell, 16, [{ type: 'highpass', frequencyHz: 70 }]),
  labTrack('pedal', 'CATHEDRAL//ENGINE Pedal: 32\' resultant, 16\', 8\' and Posaune where the 808 drops out (bar 12, the end).', MIX.pedal, 16),
]);
export const heavenProject = projectBase('Cathedral Experiment 3: HEAVEN//MASS', 'V2 backing, bars 1-12 (bell, hats, then kick, snare, 808, clank), with HEAVEN//MASS: an original four-part passage.', 12, heavenScore.tailSeconds, [
  ...backing(12),
  { ...labTrack('bass', 'HEAVEN//MASS basses (octavists in bar 12), with their Nave; a 4 dB duck on each kick.', MIX.bass, 12), automation: { gainDb: duckOnKicks(MIX.bass, 4, 44) } },
  { ...labTrack('tenor', 'HEAVEN//MASS tenors; a 2 dB duck on each kick.', MIX.tenor, 12), automation: { gainDb: duckOnKicks(MIX.tenor, 2, 44) } },
  { ...labTrack('alto', 'HEAVEN//MASS altos.', MIX.alto, 12), ...(QA ? { automation: { gainDb: rideOnly(MIX.alto) } } : {}) },
  { ...labTrack('soprano', 'HEAVEN//MASS sopranos: the melody.', MIX.soprano, 12), ...(QA ? { automation: { gainDb: rideOnly(MIX.soprano) } } : {}) },
  { ...labTrack('soprano-2', 'HEAVEN//MASS second sopranos (bars 9-12).', MIX.soprano2, 12), ...(QA ? { automation: { gainDb: rideOnly(MIX.soprano2) } } : {}) },
  labTrack('descant', 'HEAVEN//MASS far descant on C6 (bar 12).', MIX.descant, 12),
]);

export const AUDITIONS = [
  { id: '1-throne-volt', score: throneScore, project: throneProject, fromBeat: 16, label: 'THRONE//VOLT over Concrete Gospel V2, bars 5-16' },
  { id: '2-cathedral-engine', score: cathedralScore, project: cathedralProject, fromBeat: 16, label: 'CATHEDRAL//ENGINE over Concrete Gospel V2, bars 5-16' },
  { id: '3-heaven-mass', score: heavenScore, project: heavenProject, fromBeat: 0, label: 'HEAVEN//MASS over the Concrete Gospel V2 drums, bars 1-12' },
] as const;
export const DRY = [
  { id: 'dry-throne-volt', score: dryVoltScore, label: 'THRONE//VOLT alone, no room' },
  { id: 'dry-cathedral-engine', score: dryCathedralScore, label: 'CATHEDRAL//ENGINE alone, no Nave' },
  { id: 'dry-heaven-mass', score: dryHeavenScore, label: 'HEAVEN//MASS alone, no room' },
] as const;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = join(HERE, 'source');
  mkdirSync(out, { recursive: true });
  for (const a of AUDITIONS) {
    writeFileSync(join(out, `${a.id}.score.json`), JSON.stringify(a.score, null, 1) + '\n');
    writeFileSync(join(out, `${a.id}.project.json`), JSON.stringify(a.project, null, 1) + '\n');
  }
  for (const d of DRY) writeFileSync(join(out, `${d.id}.score.json`), JSON.stringify(d.score, null, 1) + '\n');
  console.log(`wrote ${out}: ${AUDITIONS.length} auditions (score + project) and ${DRY.length} dry scores; hook ${HOOK.length} notes, choir chords ${CHORDS.length}`);
}
