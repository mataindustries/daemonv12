/**
 * CONCRETE GOSPEL · FULL-LENGTH EDITION. 76 bars at 144 BPM (half time), F minor: about 2:12 with the last chord's ring.
 * The single source of truth: every drum hit, 808 note, lead, organ and choir note, control curve, level and ride.
 *
 * Foundation: the approved Concrete Gospel V2 kick, snare, hats, bell, steel and 808, with V2's own hit layering, gains,
 * effects, 808 duck and master chain. The hook section (bars 9-16) and the drums of the ending (bars 69-72) are V2's
 * own bars 5-12 and 13-16, note for note; the verses and choruses are new patterns built from the same hits and the
 * same 808 (V2's Living Bass part, new notes). On top, the three Cathedral Experiment instruments, played, not modified.
 *
 *   bars  1-8   INTRO     the preacher alone: the lead's call, the organ answers, the lead answers, the choir hums
 *   bars  9-16  HOOK      the drop (V2's pocket): the V3 hook, organ answers in its rests, V2's hole at bar 16
 *   bars 17-32  VERSE 1   room for a voice: a new 808 line (Fm Fm Db C), the lead only tags each 4-bar line
 *   bars 33-40  CHORUS 1  the second hook, a conversation: the lead calls F-Ab-C, a few singers answer Eb-Db-C
 *   bars 41-52  VERSE 2   more pressure, then a half-time floor and one stop-time on the second hook's rhythm
 *   bars 53-60  BRIDGE    no drums, no 808: the choir alone (Bbm9, the Neapolitan Gb), then the organ, the Pedal, the lead
 *   bars 61-68  CHORUS 2  the ceiling opens: the lead calls with the first hook, the full choir answers with the second
 *   bars 69-76  OUTRO     V2's amen groove and dive; the lead holds Ab through Db and C7, the choir turns to F MAJOR and
 *                         the lead bends Ab up to A: the first gesture of the record, answered
 *
 *   node experiments/concrete-gospel-004/compose.ts     writes source/
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as V1 from '../cathedral-experiment-001/upstream/concrete-gospel-001/compose.ts';
import * as V2 from '../cathedral-experiment-001/upstream/concrete-gospel-002/compose.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
export const BPM = 144, BARS = 76, END = BARS * 4, TAIL_SECONDS = 5;
/** The QA switch: `build.ts --candidate` (or FL_CANDIDATE=1) rebuilds the composition exactly as measured before the fix pass. */
export const CANDIDATE = process.argv.includes('--candidate') || process.env.FL_CANDIDATE === '1';
const FIX = !CANDIDATE;
const { pos, dur } = V1;
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const semis = (n: number) => r6(Math.pow(2, n / 12));
type Opts = Record<string, string | number>;
export type RackNote = [number, number, string, number, Opts?];
const rn = (beat: number, beats: number, pitch: string, vel: number, o?: Opts): RackNote => (o && Object.keys(o).length ? [r6(beat), r6(beats), pitch, r6(vel), o] : [r6(beat), r6(beats), pitch, r6(vel)]);
const SCHEMA = 'daemonv12.signature-rack.score/1';

/** Section starts in beats (a bar is 4 beats; bar n starts at beat 4(n-1)). */
export const SEC = { intro: 0, hook: 32, verse1: 64, chorus1: 128, verse2: 160, bridge: 208, chorus2: 240, outro: 272, amen: 288, end: 304 } as const;
export const SECTIONS = [
  { id: 'intro', bars: 8, development: 'The preacher alone: the lead\'s call, the organ\'s answer, the lead\'s answer, the choir\'s hum; Fm, Db, then C7 and a breath.' },
  { id: 'hook', bars: 8, development: 'The drop on V2\'s own pocket: the V3 hook as a four-bar question and answer, the climb, the peak, V2\'s hole.' },
  { id: 'verse-1', bars: 16, development: 'Room for a voice: a new 808 line (Fm Fm Db C); the lead only tags the end of each four-bar line; a hum enters halfway.' },
  { id: 'chorus-1', bars: 8, development: 'The second hook: the lead calls F-Ab-C, a few singers answer Eb-Db-C, the organ echoes; Db Eb Fm C.' },
  { id: 'verse-2', bars: 12, development: 'More pressure (stutter kicks, sixteenth hats, octave hops); then a half-time floor and one stop-time on the second hook.' },
  { id: 'bridge', bars: 8, development: 'No drums, no 808: the choir alone (Bbm9, the Neapolitan Gb, C7b9), then the organ and Pedal and the lead\'s cry.' },
  { id: 'chorus-2', bars: 8, development: 'The ceiling opens: the lead calls with the first hook, the full choir answers with the second, full-organ hits.' },
  { id: 'outro', bars: 8, development: 'V2\'s amen groove and dive; Db, C7, then F major; the lead bends its Ab up to A.' },
];

// ================================================================================================ the drums
type EN = Record<string, unknown>;
const beatOf = (m: string) => { const g = /^(\d+):(\d+)(?:\+(\d+)\/(\d+))?$/.exec(m)!; return (Number(g[1]) - 1) * 4 + Number(g[2]) - 1 + (g[3] ? Number(g[3]) / Number(g[4]) * 4 : 0); };
type V2Track = { id: string; patterns: { notes: EN[] }[] } & Record<string, unknown>;
const v2track = (id: string) => (V2.project.tracks as unknown as V2Track[]).find(t => t.id === id)!;
/** V2's own engine notes of one track in [from, to), moved by `shift` beats (the approved programming, note for note). */
const v2window = (id: string, from: number, to: number, shift: number): EN[] =>
  v2track(id).patterns[0]!.notes.filter(n => { const b = beatOf(n.start as string); return b >= from - 1e-9 && b < to - 1e-9; }).map(n => ({ ...structuredClone(n), start: pos(beatOf(n.start as string) + shift) }));
const KL = V2.KICK_LAYER, SL = V2.SNARE_LAYER;
/** One kick = V2's three layers (IRON PULSE body, skin knock, log click), exactly as V2 builds them. */
const kickHits = (b: number, v: number): EN[] => [
  { start: pos(b), pitch: 'iron-pulse', velocity: r6(v * KL.body), playbackRate: semis(3), gate: dur(0.5), envelope: { attackSeconds: 0, releaseSeconds: 0.04 }, chokeGroup: 'body' },
  { start: pos(b), pitch: 'knock', velocity: r6(v * KL.knock), offsetSeconds: 0.0015, envelope: { attackSeconds: 0.0005, releaseSeconds: 0.02 }, gate: dur(0.25), chokeGroup: 'knock' },
  { start: pos(b), pitch: 'click', velocity: r6(v * KL.click), gate: dur(0.125), envelope: { attackSeconds: 0, releaseSeconds: 0.01 }, chokeGroup: 'click' },
];
/** One backbeat = V2's three snare layers (TITANIUM CRACK -2 st, HEADLINER body, skin front); a ghost = the crack alone. */
const snareHits = (b: number, scale = 1): EN[] => [
  { start: pos(b), pitch: 'crack', velocity: r6(SL.crack * scale), playbackRate: semis(-2), gate: dur(0.5), envelope: { attackSeconds: 0, releaseSeconds: 0.06 }, chokeGroup: 'crack' },
  { start: pos(b), pitch: 'body', velocity: r6(SL.body * scale), gate: dur(0.5), envelope: { attackSeconds: 0, releaseSeconds: 0.05 }, chokeGroup: 'body' },
  { start: pos(b), pitch: 'front', velocity: r6(SL.front * scale), chokeGroup: 'front' },
];
const ghostHit = (b: number, v: number): EN => ({ start: pos(b), pitch: 'crack', velocity: r6(v), playbackRate: semis(-2), gate: dur(0.125), envelope: { attackSeconds: 0.001, releaseSeconds: 0.02 }, chokeGroup: 'crack' });
const jit = (i: number, amount: number) => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return (s - Math.floor(s) - 0.5) * 2 * amount; };

export const KICKS: [number, number][] = [];
export const SNARES: number[] = [];
const KICK_N: EN[] = [], SNARE_N: EN[] = [], HAT_N: EN[] = [], TOLL_N: EN[] = [], CLANK_N: EN[] = [];
const kick = (b: number, v: number) => { KICKS.push([r6(b), v]); KICK_N.push(...kickHits(b, v)); };
const snare = (b: number, scale = 1) => { SNARES.push(r6(b)); SNARE_N.push(...snareHits(b, scale)); };
const ghost = (b: number, v: number) => SNARE_N.push(ghostHit(b, v));
let hi = 0;
const hat = (b: number, v: number, rate = 1, lean = true) => {
  const late = lean && Math.abs((b * 2) % 2 - 1) < 1e-9 ? 6 / 960 : 0;   // off-beat eighths 6 ticks late, as V2
  const n: EN = { start: pos(b + late), pitch: 'ghost-tick', velocity: r6(Math.min(1, Math.max(0.05, v + jit(hi++, 0.03)))), chokeGroup: 'hats' };
  if (rate !== 1) n.playbackRate = r6(rate);
  HAT_N.push(n);
};
const openHat = (b: number, v: number) => HAT_N.push({ start: pos(b), pitch: 'open-circuit', velocity: v, gate: dur(0.5), envelope: { attackSeconds: 0.001, releaseSeconds: 0.06 }, chokeGroup: 'hats' });
const near = (b: number, list: number[]) => list.some(s => Math.abs(s - b) < 1e-6);
const eighths = (from: number, to: number, skip: number[], on = 0.66, off = 0.42) => { for (let b = from; b < to - 1e-9; b += 0.5) if (!near(b, skip)) hat(b, Math.abs(b % 1) < 1e-9 ? on : off); };
const triplets = (from: number, to: number, skip: number[], v0 = 0.52, v1 = 0.38) => { for (let b = from, i = 0; b < to - 1e-9; b += 1 / 3, i++) if (!near(r6(b), skip)) hat(r6(b), i % 3 === 0 ? v0 : v1, 1, false); };
const sixteenths = (from: number, to: number, skip: number[]) => { for (let b = from, i = 0; b < to - 1e-9; b += 0.25, i++) if (!near(b, skip)) hat(b, [0.62, 0.3, 0.46, 0.34][i % 4]!, 1, false); };
const roll = (from: number, to: number, step: number, v0: number, v1: number, rate0 = 1, rate1 = 1) => {
  const n = Math.round((to - from) / step);
  for (let i = 0; i < n; i++) { const x = n > 1 ? i / (n - 1) : 0; hat(from + i * step, v0 + (v1 - v0) * x, rate0 + (rate1 - rate0) * x, false); }
};
const F4 = semis(-4), F3 = semis(-16), C5 = semis(3), F5 = semis(8);
/** The bell: V12 CHROME STRIKE at F4 + F3 (V1's toll). */
const toll = (b: number, v: number, gateBeats = 8, release = 1.2) => {
  TOLL_N.push({ start: pos(b), pitch: 'chrome-strike', velocity: r6(v), playbackRate: F4, gate: dur(gateBeats), envelope: { attackSeconds: 0, releaseSeconds: release } });
  TOLL_N.push({ start: pos(b), pitch: 'chrome-strike', velocity: r6(v * 0.8), playbackRate: F3, gate: dur(gateBeats), envelope: { attackSeconds: 0, releaseSeconds: release } });
};
const clank = (b: number, rate: number, v: number) => CLANK_N.push({ start: pos(b), pitch: 'chrome-strike', velocity: v, playbackRate: rate, gate: dur(0.25), envelope: { attackSeconds: 0, releaseSeconds: 0.08 } });
const steel = (c: number) => { clank(c + 1.25, C5, 0.62); clank(c + 3.25, F5, 0.55); clank(c + 5.75, C5, 0.58); };   // V1's off-beat figure, one 2-bar cycle

// ---- bars 1-8: the bell, footsteps from bar 7, half a beat of nothing before the drop
toll(0, 0.8); toll(16, 0.7);
eighths(24, 31, [], 0.26, 0.2);
// ---- bars 9-16: V2's bars 5-12, note for note (groove A twice, groove B, the crack, the hole)
const hookShift = SEC.hook - 16;
for (const [b, v] of V2.KICKS.filter(([b]) => b >= 16 && b < 48)) KICKS.push([b + hookShift, v]);
SNARES.push(...[18, 22, 26, 30, 34, 38, 42].map(b => b + hookShift));
KICK_N.push(...v2window('kick', 16, 48, hookShift)); SNARE_N.push(...v2window('snare', 16, 48, hookShift));
HAT_N.push(...v2window('hats', 16, 48, hookShift)); TOLL_N.push(...v2window('toll', 16, 48, hookShift)); CLANK_N.push(...v2window('clank', 16, 48, hookShift));
// ---- bars 17-32: the verse pocket (one 4-bar line = Fm Fm Db C; kicks where the 808 speaks, its swoops left alone)
const VERSE_KICKS: [number, number][] = [[0, 1], [1.5, 0.92], [2.75, 0.86], [4, 1], [5.5, 0.9], [8, 1], [9.5, 0.92], [10.75, 0.86], [12, 1], [13.5, 0.9], [15.25, 0.86]];
toll(SEC.verse1, 0.62, 4, 1);
for (let i = 0; i < 4; i++) {
  const c = SEC.verse1 + 16 * i;
  for (const [b, v] of VERSE_KICKS) kick(c + b, v);
  for (const b of [2, 6, 10, 14]) snare(c + b);
  if (i % 2 === 1) { ghost(c + 3.25, 0.22); ghost(c + 11.25, 0.2); }
  const bb = [2, 6, 10, 14].map(b => c + b);
  if (i === 0) { eighths(c, c + 16, bb); openHat(c + 7.5, 0.42); }
  if (i === 1) { eighths(c, c + 14.5, bb); roll(c + 14.5, c + 15, 1 / 6, 0.34, 0.5); roll(c + 15, c + 16, 0.125, 0.4, 0.6, 1, 1.12); }
  if (i === 2) { eighths(c, c + 16, bb); openHat(c + 7.5, 0.44); hat(c + 11.75, 0.38, 1, false); }
  if (i === 3) { eighths(c, c + 14, bb); roll(c + 14, c + 16, 1 / 6, 0.3, 0.64, 1, 1.18); ghost(c + 15.5, 0.26); ghost(c + 15.75, 0.4); } // a triplet roll: the chorus is in triplets
  if (i >= 2) { steel(c); steel(c + 8); }
}
// ---- bars 33-40 and 61-68: the chorus pocket (call bar + answer bar; triplet hats, the backbeat left alone)
const CHORUS_KICKS: [number, number][] = [[0, 1], [0.75, 0.84], [1.5, 0.92], [2.75, 0.86], [4, 1], [5.5, 0.92], [7.25, 0.88]];
function chorusDrums(start: number, hot: boolean) {
  toll(start, hot ? 0.9 : 0.72, 8, 1.2);
  for (let p = 0; p < 4; p++) {
    const c = start + 8 * p;
    for (const [b, v] of CHORUS_KICKS) kick(c + b, v);
    if (hot) { kick(c + 3.5, 0.82); if (p % 2 === 1) kick(c + 6.75, 0.84); }
    snare(c + 2); snare(c + 6); ghost(c + 3.25, 0.22);
    triplets(c, c + 7.5, [c + 2, c + 6]); openHat(c + 7.5, hot ? 0.5 : 0.44);
    if (hot && p % 2 === 0) openHat(c + 3.5, 0.42);
    if (hot) steel(c);
  }
  ghost(start + 31.5, 0.3); ghost(start + 31.75, 0.46);  // the drag out
}
chorusDrums(SEC.chorus1, false);
chorusDrums(SEC.chorus2, true);
// ---- bars 41-48: verse 2, the pressure pocket (V2's stutters), sixteenth hats
const PRESSURE_KICKS: [number, number][] = [[0, 1], [0.75, 0.84], [1.5, 0.92], [2.75, 0.86], [4, 1], [5.25, 0.88], [7.25, 0.9], [8, 1], [8.75, 0.84], [9.5, 0.92], [10.75, 0.86], [12, 1], [13.25, 0.88], [15.25, 0.88]];
toll(SEC.verse2, 0.66, 4, 1);
for (let i = 0; i < 2; i++) {
  const c = SEC.verse2 + 16 * i, bb = [2, 6, 10, 14].map(b => c + b);
  for (const [b, v] of PRESSURE_KICKS) kick(c + b, v);
  for (const b of bb) snare(b);
  for (const [b, v] of [[3.25, 0.22], [7.75, 0.3], [11.25, 0.22], [15.75, 0.32]] as const) ghost(c + b, v);
  sixteenths(c, c + (i === 1 ? 14.5 : 16), bb);
  if (i === 1) roll(c + 14.5, c + 16, 0.125, 0.38, 0.6, 1, 0.9);   // a roll that falls in pitch: the floor is coming
  steel(c); steel(c + 8);
}
// ---- bars 49-52: the floor (kick on the one, snare on three, nothing between) and one stop-time
const FLOOR = SEC.verse2 + 32;
for (const b of [0, 4, 8]) { kick(FLOOR + b, 1); snare(FLOOR + b + 2, 0.92); hat(FLOOR + b + 1, 0.34, 1, false); hat(FLOOR + b + 3, 0.3, 1, false); }
for (const [b, v] of [[12, 1], [12.75, 0.92], [13.5, 0.96]] as const) { kick(FLOOR + b, v); snare(FLOOR + b, 0.9); }   // the second hook's rhythm, then silence
// ---- bars 53-60: the bridge: only the bell
toll(SEC.bridge, 0.66, 8, 1.6);
// ---- bars 69-72: V2's bars 13-16, note for note (the slam, groove B, the amen, the last snare on beat 3 of bar 72)
const outShift = SEC.outro - 48;
for (const [b, v] of V2.KICKS.filter(([b]) => b >= 48)) KICKS.push([b + outShift, v]);
SNARES.push(...[50, 54, 58, 62].map(b => b + outShift));
KICK_N.push(...v2window('kick', 48, 64, outShift)); SNARE_N.push(...v2window('snare', 48, 64, outShift));
HAT_N.push(...v2window('hats', 48, 64, outShift)); TOLL_N.push(...v2window('toll', 48, 64, outShift)); CLANK_N.push(...v2window('clank', 48, 64, outShift));
KICKS.sort((a, b) => a[0] - b[0]); SNARES.sort((a, b) => a - b);

// ================================================================================================ the 808 (V2's Living Bass)
/**
 * V2's 808 part (Living Bass, seed 808, V1's controls), new notes. Bars 9-16 and 69-72 are V1/V2's own 808 bars 5-12 and
 * 13-16 (with the tape-stop dive into the hole and the final octave dive). The verse line is Fm Fm Db C (F1, Db2, C2,
 * the Eb-Db-C walk); the chorus line Db Eb Fm C. While it plays, nothing else goes below 120 Hz but the kick.
 */
const v1bass = (V1.rackScore.parts.find(p => p.id === 'bass808')!.notes as RackNote[]);
const BASS: RackNote[] = [
  ...v1bass.filter(n => n[0] >= 16 && n[0] < 48).map(([b, d, p, v, o]) => rn(b + hookShift, d, p, v, o)),
  ...v1bass.filter(n => n[0] >= 48).map(([b, d, p, v, o]) => rn(b + outShift, d, p, v, o)),
];
const verseLine = (c: number, fresh: boolean, hops: boolean) => BASS.push(
  rn(c, 1.25, 'F1', 0.95, fresh ? { scoop: -3 } : { slide: 0.15 }), rn(c + 1.5, 0.5, 'F1', 0.85), rn(c + 2.75, 0.5, 'F2', 0.75), rn(c + 3.5, 0.5, 'Ab1', 0.86, { slide: 0.25 }),
  rn(c + 4, 1.25, 'F1', 0.9, { slide: 0.12 }), ...(hops ? [rn(c + 5.25, 0.25, 'F2', 0.72)] : []), rn(c + 5.5, 1.25, 'F1', 0.86, hops ? { slide: 0.1 } : {}), rn(c + 7, 0.5, 'Ab1', 0.8), rn(c + 7.5, 0.5, 'C2', 0.82, { slide: 0.1 }),
  rn(c + 8, 1.25, 'Db2', 0.92, { slide: 0.15 }), rn(c + 9.5, 0.5, 'Db2', 0.82), rn(c + 10.75, 0.5, 'Ab1', 0.8), rn(c + 11.5, 0.5, 'Db2', 0.8, { slide: 0.1 }),
  rn(c + 12, 1.25, 'C2', 0.92, { slide: 0.12 }), ...(hops ? [rn(c + 13.25, 0.25, 'C3', 0.7)] : []), rn(c + 13.5, 0.75, 'C2', 0.84, hops ? { slide: 0.1 } : {}),
  rn(c + 14.75, 0.25, 'Eb2', 0.76), rn(c + 15.25, 0.25, 'Db2', 0.8), rn(c + 15.5, 0.5, 'C2', 0.82, { slide: 0.1 }),
);
for (let i = 0; i < 4; i++) verseLine(SEC.verse1 + 16 * i, i === 0, false);
for (let i = 0; i < 2; i++) verseLine(SEC.verse2 + 16 * i, i === 0, true);
const chorusLine = (start: number, fresh: boolean) => {
  for (let p = 0; p < 4; p++) {
    const c = start + 8 * p, last = p === 3;
    if (p % 2 === 0) BASS.push(   // Db | Eb
      rn(c, 1.25, 'Db2', 0.95, fresh && p === 0 ? { scoop: -2 } : { slide: 0.15 }), rn(c + 0.75, 0.5, 'Db2', 0.8), rn(c + 1.5, 0.75, 'Db2', 0.88), rn(c + 2.75, 0.5, 'Ab1', 0.8), rn(c + 3.5, 0.5, 'Bb1', 0.84, { slide: 0.25 }),
      rn(c + 4, 1.25, 'Eb2', 0.92, { slide: 0.12 }), rn(c + 5.5, 1.5, 'Eb2', 0.86), rn(c + 7.25, 0.25, 'Bb1', 0.8), rn(c + 7.5, 0.5, 'Eb2', 0.8));
    else BASS.push(               // Fm | C
      rn(c, 1.25, 'F1', 0.95, { slide: 0.15 }), rn(c + 0.75, 0.5, 'F1', 0.8), rn(c + 1.5, 0.75, 'F1', 0.88), rn(c + 2.75, 0.5, 'F2', 0.78), rn(c + 3.5, 0.5, 'Ab1', 0.86, { slide: 0.25 }),
      rn(c + 4, 1.25, 'C2', 0.92, { slide: 0.12 }), rn(c + 5.5, 1.5, 'C2', 0.86), rn(c + 7.25, 0.25, last ? 'Db2' : 'Eb2', 0.8), rn(c + 7.5, 0.5, last ? 'C2' : 'Db2', 0.82, { slide: 0.1 }));
  }
};
chorusLine(SEC.chorus1, true);
chorusLine(SEC.chorus2, true);
// the floor: one long note per bar, then the stop-time and a short dive into the bridge
BASS.push(rn(FLOOR, 3.5, 'F1', 0.95, { scoop: -3 }), rn(FLOOR + 4, 3.5, 'F1', 0.9), rn(FLOOR + 8, 3.5, 'Db2', 0.92, { slide: 0.2 }),
  rn(FLOOR + 12, 0.5, 'C2', 0.95), rn(FLOOR + 12.75, 0.5, 'C2', 0.9), rn(FLOOR + 13.5, 1, 'C2', 0.95, { dive: 12, diveBeats: 0.75 }));
BASS.sort((a, b) => a[0] - b[0]);
const v1bassPart = V1.rackScore.parts.find(p => p.id === 'bass808')! as Record<string, unknown>;
/** V1's control values (main, hot); hot for the last chorus and the ending, as V1/V2 used them for their slam. */
const hot = (main: number, h: number): [number, number][] => [[0, main], [SEC.chorus2 - 0.1, main], [SEC.chorus2, h]];
const bassScore = {
  schema: SCHEMA, title: 'Concrete Gospel Full-Length: the 808', bpm: BPM, key: 'F minor', swing: 0.5, seed: 1440, tailSeconds: TAIL_SECONDS, masterGainDb: 0,
  description: 'V2\'s 808 part (Living Bass, seed 808, V1 controls) with the full-length line.', sections: SECTIONS,
  parts: [{
    ...structuredClone(v1bassPart), notes: BASS, motion: [{ fromBeat: 0, toBeat: END, preset: 'none' }],
    controls: { body: hot(0.5, 0.56), drive: hot(0.55, 0.75), fold: hot(0.25, 0.4), pm: hot(0.75, 0.9), bright: hot(0.3, 0.38), hold: 0.84, chassis: hot(0, 0.15), grind: 0, gear: 0, ratchet: 0, servo: 0, motion: 0, harm: 0 },
  }],
};

// ================================================================================================ THRONE//VOLT
/**
 * The lead. The first hook (V3): the call Ab3 bending up to C4, the answer leaping Eb4 down to Ab3 and moaning to F3.
 * The second hook (new, chorus 1): F4-Ab4-C5 on the 3+3+2 sixteenths, answered by the choir. In the verses it only tags
 * the end of each four-bar line (there is a voice to leave room for). At the end it holds its Ab3 through Db and C7 and
 * bends it up to A as the choir reaches F major.
 */
const LEAD: RackNote[] = [];
const L = (beat: number, beats: number, pitch: string, vel: number, o: Opts = {}) => LEAD.push(rn(beat, beats, pitch, vel, o));
const ACC = { articulation: 'accent' }, LEG = (slide: number, extra: Opts = {}) => ({ articulation: 'legato', slide, ...extra });
// intro: call (bar 1), answer (bar 3), call with the b6 sigh (bar 5), answer left hanging on Db (bar 7)
L(0, 0.5, 'Ab3', 0.84, ACC); L(0.5, 2.5, 'C4', 0.8, LEG(0.3, { fall: 1, fallBeats: 0.5 }));
L(8.5, 1, 'Eb4', 0.84, ACC); L(9.5, 2, 'Ab3', 0.8, LEG(0.06, { fall: 3, fallBeats: 1 }));
L(16, 0.5, 'Ab3', 0.86, ACC); L(16.5, 1.5, 'C4', 0.82, LEG(0.3)); L(18, 0.5, 'Db4', 0.82, LEG(0.08)); L(18.5, 1, 'C4', 0.8, LEG(0.08));
L(24.5, 1, 'Eb4', 0.88, ACC); L(25.5, 2, 'Db4', 0.82, LEG(0.1, { fall: 1, fallBeats: 0.75 }));
// hook: the question (bars 9-10), the answer (11-12), the climb and an answer on V2's own notes (13-14), the peak (15)
L(32, 0.5, 'Ab3', 0.94, ACC); L(32.5, 2, 'C4', 0.86, LEG(0.3, { fall: 1, fallBeats: 0.4 })); L(36.5, 1, 'Eb4', 0.9, ACC); L(37.5, 2, 'Db4', 0.84, LEG(0.1));
L(40, 0.5, 'Ab3', 0.9, ACC); L(40.5, 1.5, 'C4', 0.85, LEG(0.3)); L(42, 0.5, 'Db4', 0.86, LEG(0.08)); L(42.5, 0.75, 'C4', 0.82, LEG(0.08));
L(44.5, 1, 'Eb4', 0.92, ACC); L(45.5, 2, 'Ab3', 0.86, LEG(0.06, { fall: 3, fallBeats: 1 }));
L(48, 0.5, 'C4', 0.94, ACC); L(48.5, 1.5, 'Eb4', 0.86, LEG(0.25)); L(50, 1, 'F4', 0.88, LEG(0.1));
L(52.5, 1, 'Eb4', 0.9, ACC); L(53.5, 0.5, 'Db4', 0.84, LEG(0.08)); L(54, 1.25, 'C4', 0.84, LEG(0.08, { fall: 1, fallBeats: 0.5 }));
L(56, 0.5, 'Eb4', 0.95, ACC); L(56.5, 1.5, 'Ab4', 0.88, LEG(0.3)); L(58, 0.5, 'G4', 0.86, LEG(0.08)); L(58.5, 2, 'F4', 0.86, LEG(0.08, { fall: 5, fallBeats: 1.1 }));
// verse 1: one tag at the end of each four-bar line; the last one previews the second hook
L(76.5, 0.5, 'Eb4', 0.84, ACC); L(77, 0.5, 'Db4', 0.8, LEG(0.08)); L(77.5, 1.5, 'C4', 0.8, LEG(0.08, { fall: 1, fallBeats: 0.5 }));
L(92.5, 0.5, 'Ab3', 0.86, ACC); L(93, 1.75, 'C4', 0.82, LEG(0.3));
L(108.5, 0.5, 'F4', 0.86, ACC); L(109, 0.5, 'Eb4', 0.82, LEG(0.08)); L(109.5, 1.5, 'C4', 0.82, LEG(0.08, { fall: 2, fallBeats: 0.6 }));
L(124.5, 0.5, 'F4', 0.88, ACC); L(125.25, 0.5, 'Ab4', 0.84); L(126, 1.5, 'C5', 0.86, { fall: 1, fallBeats: 0.4 });
// chorus 1: the second hook's call, four times (the third reaches Db5, the fourth Eb5)
const C1 = SEC.chorus1;
L(C1, 0.5, 'F4', 0.94, ACC); L(C1 + 0.75, 0.5, 'Ab4', 0.86); L(C1 + 1.5, 1.5, 'C5', 0.9, { fall: 1, fallBeats: 0.4 });
L(C1 + 8, 0.5, 'F4', 0.94, ACC); L(C1 + 8.75, 0.5, 'Ab4', 0.86); L(C1 + 9.5, 1.75, 'C5', 0.9);
L(C1 + 16, 0.5, 'F4', 0.95, ACC); L(C1 + 16.75, 0.5, 'Ab4', 0.88); L(C1 + 17.5, 1.5, 'Db5', 0.92, { fall: 1, fallBeats: 0.5 });
L(C1 + 24, 0.5, 'F4', 0.95, ACC); L(C1 + 24.75, 0.5, 'Ab4', 0.88); L(C1 + 25.5, 0.5, 'C5', 0.88); L(C1 + 26, 1.25, 'Eb5', 0.95, { ...ACC, fall: 2, fallBeats: 0.5 });
// verse 2: hotter tags (the second one touches the Neapolitan Gb), the cry over the floor, the stop-time
L(172.5, 0.5, 'C4', 0.92, ACC); L(173, 1, 'Eb4', 0.86, LEG(0.25)); L(174, 0.5, 'Db4', 0.84, LEG(0.08)); L(174.5, 1.25, 'C4', 0.84, LEG(0.08, { fall: 1, fallBeats: 0.5 }));
L(188.5, 0.5, 'Eb4', 0.9, ACC); L(189, 0.5, 'F4', 0.86, LEG(0.08)); L(189.5, 1, 'Gb4', 0.9, ACC); L(190.5, 0.5, 'F4', 0.84, LEG(0.08)); L(191, 0.75, 'Db4', 0.84, LEG(0.08, { fall: 1, fallBeats: 0.4 }));
L(192.5, 0.5, 'Ab3', 0.9, ACC); L(193, 3, 'C4', 0.86, LEG(0.3)); L(200.5, 1, 'Eb4', 0.9, ACC); L(201.5, 2, 'Db4', 0.84, LEG(0.1, { fall: 1, fallBeats: 0.6 }));
L(204, 0.5, 'F4', 0.96, ACC); L(204.75, 0.5, 'Ab4', 0.9, ACC); L(205.5, 1, 'C5', 0.92, { ...ACC, fall: 2, fallBeats: 0.6 });
// bridge: the cry over the dominant, Db, the Neapolitan Gb, and the C7b9 (Ab4 sighing to G4)
L(222.5, 0.5, 'C4', 0.86, ACC); L(223, 1, 'Eb4', 0.84, LEG(0.25)); L(224, 1.5, 'F4', 0.84, LEG(0.1)); L(226, 0.5, 'Eb4', 0.82, LEG(0.08)); L(226.5, 1.5, 'Db4', 0.82, LEG(0.08, { fall: 1, fallBeats: 0.5 }));
L(228, 1, 'Gb4', 0.9, ACC); L(229, 0.5, 'F4', 0.84, LEG(0.08)); L(229.5, 2, 'Db4', 0.84, LEG(0.08));
L(232, 0.5, 'Eb4', 0.9, ACC); L(232.5, 1.5, 'Ab4', 0.88, LEG(0.3)); L(234, 2, 'G4', 0.86, LEG(0.08)); L(236, 1, 'Ab4', 0.86, LEG(0.08)); L(237, 1.5, 'G4', 0.84, LEG(0.08));
// chorus 2: the first hook's calls under the choir's second hook
const C2 = SEC.chorus2;
L(C2, 0.5, 'Ab3', 1, ACC); L(C2 + 0.5, 2, 'C4', 0.9, LEG(0.3));
L(C2 + 8, 0.5, 'Ab3', 0.96, ACC); L(C2 + 8.5, 1.5, 'C4', 0.9, LEG(0.3)); L(C2 + 10, 0.5, 'Db4', 0.9, LEG(0.08)); L(C2 + 10.5, 1, 'C4', 0.86, LEG(0.08));
L(C2 + 16, 0.5, 'C4', 0.96, ACC); L(C2 + 16.5, 1.5, 'Eb4', 0.9, LEG(0.25)); L(C2 + 18, 1, 'F4', 0.9, LEG(0.1));
L(C2 + 24, 0.5, 'Eb4', 0.97, ACC); L(C2 + 24.5, 1.5, 'Ab4', 0.9, LEG(0.3)); L(C2 + 26, 0.5, 'G4', 0.88, LEG(0.08)); L(C2 + 26.5, 1.5, 'F4', 0.88, LEG(0.08, { fall: 1, fallBeats: 0.5 }));
// outro: the last calls; the last answer falls C4 -> Ab3 (still minor), held through Db and C7, then bent up to A3
L(272, 0.5, 'Ab3', 1, ACC); L(272.5, 2, 'C4', 0.92, LEG(0.3));
L(280, 0.5, 'Ab3', 0.98, ACC); L(280.5, 1.5, 'C4', 0.9, LEG(0.3)); L(282, 0.5, 'Db4', 0.9, LEG(0.08)); L(282.5, 1, 'C4', 0.86, LEG(0.08));
L(284.5, 1, 'Eb4', 0.95, ACC); L(285.5, 1, 'C4', 0.9, LEG(0.08, { fall: 4, fallBeats: 0.7 })); L(286.5, 10, 'Ab3', 0.84, LEG(0.04)); L(296.5, 6, 'A3', 0.82, LEG(0.75));
const leadScore = {
  schema: SCHEMA, title: 'Concrete Gospel Full-Length: THRONE//VOLT', bpm: BPM, key: 'F minor', swing: 0.5, seed: 4001, tailSeconds: TAIL_SECONDS, masterGainDb: 0,
  description: 'The lead: the first hook, the second hook\'s calls, the verse tags, the bridge cry, the held Ab bent up to A.', sections: SECTIONS,
  room: { rt60: 1.9, size: 1.2, damp: 5000, predelayMs: 24, lowCut: 250 },
  parts: [{
    id: 'volt', instrument: 'throne-volt', gainDb: 3, pan: 0, room: 0.14,
    setup: { seed: 7071, glide: 0.07, release: 0.3, attack: 0.005, vibRate: 4.8, drift: 3, keytrack: 0.6, lowcut: 140 },
    macro: [[0, 0.22], [31, 0.32], [32, 0.44], [47.9, 0.48], [48, 0.54], [60, 0.6], [64, 0.46], [127.9, 0.5], [128, 0.6], [159.9, 0.62], [160, 0.52], [207.9, 0.6],
      [208, 0.42], [239.9, 0.6], [240, 0.8], [271.9, 0.82], [272, 0.84], [286, 0.84], [290, 0.6], [296, 0.55], [304, 0.5]],
    expression: [[0, 0.7], [31.9, 0.72], [32, 0.76], [127.9, 0.78], [128, 0.82], [159.9, 0.82], [160, 0.8], [207.9, 0.8], [208, 0.76], [239.9, 0.8], [240, 0.86], [286, 0.86], [296, 0.78]],
    controls: {
      width: 0.32,
      sync: [[0, 0.02], [31.9, 0.03], [32, 0.05], [63.9, 0.12], [64, 0.06], [127.9, 0.08], [128, 0.14], [159.9, 0.15], [160, 0.1], [207.9, 0.14], [208, 0.06], [239.9, 0.12], [240, 0.2], [286, 0.22], [288, 0.05]],
    },
    offsets: {
      vib: -3.5, vowel: 0.12,
      growl: [[173.1, 0], [173.3, 0.14], [173.9, 0.14], [174, 0], [193.4, 0], [193.8, 0.2], [195.6, 0.2], [195.9, 0], [240.9, 0], [241.1, 0.3], [242.3, 0.3], [242.4, 0],
        [248.9, 0], [249.1, 0.24], [249.9, 0.24], [250, 0], [272.9, 0], [273.1, 0.3], [274.3, 0.3], [274.4, 0], [280.9, 0], [281.1, 0.24], [281.9, 0.24], [282, 0]],
    },
    notes: LEAD.sort((a, b) => a[0] - b[0]),
  }],
};

// ================================================================================================ CATHEDRAL//ENGINE
/**
 * The organ speaks in the lead's rests and never doubles its line: the Swell answers (intro, hook, chorus echoes, verse-2
 * nods), the Great makes the dramatic responses (the hook's answers, the chorus exits, the bridge's dominant, the last
 * chords). The Pedal plays only where there is no 808: the bridge (16' and 8') and the end (with the 32').
 */
const NAVE = { rt60: 4.6, size: 1.6, predelay: 40, lowCut: 220, damp: 4300, width: 1.1 };
const GREAT: RackNote[] = [], SWELL: RackNote[] = [], PEDAL: RackNote[] = [];
const oc = (to: RackNote[], at: number, len: number, ps: string[], v: number, o?: Opts) => ps.forEach(p => to.push(rn(at, len, p, v, o)));
const DET = { articulation: 'detached' }, MARC = { articulation: 'marcato' };
// intro
oc(SWELL, 3.5, 2.5, ['Ab3', 'C4', 'Eb4', 'G4'], 0.62); oc(SWELL, 19.5, 2.5, ['Ab3', 'Db4', 'F4'], 0.64);
oc(SWELL, 28, 2, ['G3', 'Bb3', 'C4', 'F4'], 0.66); oc(SWELL, 30, 1.25, ['G3', 'Bb3', 'Db4', 'E4'], 0.68);
// hook: answers in the rests (Great principal for the long ones, Swell for the pickups), the hole
oc(GREAT, 34.5, 1.5, ['Ab3', 'C4', 'Eb4', 'G4'], 0.78, MARC); oc(SWELL, 39.5, 0.5, ['Bb3', 'Db4', 'E4', 'G4'], 0.76, DET);
oc(GREAT, 43.25, 1.25, ['Ab3', 'Db4', 'F4', 'Ab4'], 0.8, MARC); oc(SWELL, 47.5, 0.5, ['Bb3', 'Db4', 'E4', 'Ab4'], 0.78, DET);
oc(GREAT, 51, 1.5, ['Ab4', 'Db5', 'F5'], 0.8); oc(SWELL, 55.25, 0.75, ['Bb4', 'Db5', 'E5'], 0.78);
oc(SWELL, 60, 2, ['F4', 'Bb4', 'Db5'], 0.74); oc(GREAT, 60, 2, ['F3', 'Bb3', 'Db4'], 0.74); oc(SWELL, 62, 1.25, ['E4', 'Bb4', 'Db5'], 0.78); oc(GREAT, 62, 1.25, ['G3', 'Bb3', 'Db4'], 0.78);
// verse 1: a warm Db under the third bar of the last two lines, the C7b9 pickup into the chorus's Db
oc(SWELL, 104, 3, ['Ab3', 'C4', 'Db4', 'F4'], 0.6); oc(SWELL, 120, 3, ['Ab3', 'C4', 'Eb4', 'F4'], 0.62); oc(SWELL, 127.5, 0.5, ['Bb3', 'Db4', 'E4', 'G4'], 0.72, DET);
// chorus 1: the Swell echoes each sung answer; the Great slams the exit
for (let p = 0; p < 3; p++) oc(SWELL, C1 + 8 * p + 7.25, 0.5, p % 2 === 0 ? ['Ab3', 'C4', 'Eb4'] : ['Bb3', 'Db4', 'E4'], 0.72, DET);
oc(GREAT, C1 + 31.25, 0.75, ['Bb3', 'Db4', 'E4', 'G4'], 0.86, MARC);
// verse 2: two nods mid-line, then a slowly opening drone over the floor
oc(SWELL, 167, 1, ['Ab3', 'C4', 'Eb4', 'G4'], 0.62, DET); oc(SWELL, 183, 1, ['Ab3', 'Db4', 'F4'], 0.64, DET);
oc(SWELL, FLOOR, 4, ['Ab3', 'C4', 'G4'], 0.62); oc(SWELL, FLOOR + 4, 4, ['Ab3', 'C4', 'F4'], 0.64); oc(SWELL, FLOOR + 8, 3.5, ['Ab3', 'Db4', 'F4'], 0.66);
// bridge: the organ enters under the lead (Db, the Neapolitan Gb, the dominant); the Great joins on the C7b9
oc(SWELL, 224, 4, ['Ab3', 'Db4', 'F4'], 0.7); oc(SWELL, 228, 4, ['Bb3', 'Db4', 'Gb4'], 0.72); oc(SWELL, 232, 2, ['G3', 'Bb3', 'C4', 'F4'], 0.74); oc(SWELL, 234, 4.25, ['G3', 'Bb3', 'Db4', 'E4'], 0.76);
oc(GREAT, 236, 2.25, ['G3', 'Bb3', 'Db4', 'E4', 'G4'], 0.8);
oc(PEDAL, 224, 4, ['Db2'], 0.7); oc(PEDAL, 228, 4, ['Gb2'], 0.72); oc(PEDAL, 232, 6.25, ['C2'], 0.75);
// chorus 2: the Swell under each sung answer, a full-chorus hit after it
for (let p = 0; p < 4; p++) {
  const c = C2 + 8 * p, eb = p % 2 === 0;
  oc(SWELL, c + 4, 3.25, eb ? ['Bb3', 'Eb4', 'G4'] : ['Bb3', 'Db4', 'E4'], 0.72);
  oc(GREAT, c + 7.25, 0.75, eb ? ['Ab3', 'C4', 'Eb4', 'Ab4'] : ['Bb3', 'Db4', 'E4', 'G4', ...(p === 3 ? ['Bb4'] : [])], 0.88, MARC);
}
// outro: under the sung answer, the amen, Db, C7, F major with the Pedal's 32'
oc(SWELL, 276, 3.25, ['Db4', 'F4', 'Bb4'], 0.72); oc(GREAT, 279.25, 0.75, ['Bb3', 'Db4', 'E4', 'G4'], 0.88, MARC);
oc(SWELL, 284, 4, ['Db4', 'F4', 'Bb4'], 0.74);
// QA fix F4: the candidate doubled the lead's held Ab3 (and its last A3) in unison, hiding the closing bend: the organ leaves those pitches to the lead
oc(SWELL, 288, 4, FIX ? ['Db4', 'F4', 'Ab4'] : ['Ab3', 'Db4', 'F4', 'Ab4'], 0.78); oc(GREAT, 288, 4, FIX ? ['Db4', 'F4', 'Ab4', 'Db5'] : ['Ab3', 'Db4', 'F4', 'Ab4', 'Db5'], 0.84);
oc(SWELL, 292, 2, ['G3', 'Bb3', 'C4', 'F4'], 0.78); oc(GREAT, 292, 2, ['G3', 'Bb3', 'C4', 'F4'], 0.84);
oc(SWELL, 294, 2, ['G3', 'Bb3', 'Db4', 'E4'], 0.8); oc(GREAT, 294, 2, ['G3', 'Bb3', 'Db4', 'E4', 'G4'], 0.86);
oc(SWELL, 296, 6, FIX ? ['C4', 'F4', 'A4'] : ['A3', 'C4', 'F4', 'A4'], 0.82); oc(GREAT, 296, 6, ['F3', 'C4', 'F4', 'A4', 'C5'], 0.9);
oc(PEDAL, 288, 4, ['Db2'], 0.8); oc(PEDAL, 292, 4, ['C2'], 0.82); oc(PEDAL, 296.25, 6, ['F2'], 0.9);
const organScore = (id: 'great' | 'swell' | 'pedal', notes: RackNote[], part: Record<string, unknown>) => ({
  schema: SCHEMA, title: `Concrete Gospel Full-Length: CATHEDRAL//ENGINE ${id}`, bpm: BPM, key: 'F minor', swing: 0.5, seed: 4002, tailSeconds: TAIL_SECONDS, masterGainDb: 0,
  description: `CATHEDRAL//ENGINE ${id} with its Nave.`, sections: SECTIONS,
  parts: [{ id, instrument: `cathedral-engine/${id}`, pan: 0, room: 0, ...part, notes: notes.sort((a, b) => a[0] - b[0] || a[2].localeCompare(b[2])) }],
});
const greatScore = organScore('great', GREAT, {
  gainDb: -10, setup: { ...NAVE, seed: 8081, output: 'mix' },
  controls: {
    principal8: 0.82, octave4: [[0, 0.35], [127.9, 0.35], [128, 0.5], [239.9, 0.5], [240, 0.7], [287.9, 0.7], [288, 0.75]],
    fifteenth: [[0, 0], [127.9, 0], [128, 0.3], [239.9, 0.3], [240, 0.5], [287.9, 0.5], [288, 0.6]], twelfth: [[0, 0], [239.9, 0], [240, 0.35], [287.9, 0.35], [288, 0.4]],
    mixture: [[0, 0], [127.9, 0], [128, 0.3], [239.9, 0.3], [240, 0.55], [295.9, 0.6], [296, 0.85]], trumpet8: [[0, 0], [295.9, 0], [296, 0.5]],
    bourdon16: [[0, 0], [287.9, 0], [288, 0.5], [295.9, 0.5], [296, 0.7]],
    space: [[0, 0.35], [127.9, 0.35], [128, 0.55], [207.9, 0.55], [208, 0.7], [239.9, 0.7], [240, 0.6], [287.9, 0.6], [288, 1]], chiff: 1.1, wind: 0.5,
  },
  expression: [[0, 0.76], [239.9, 0.78], [240, 0.82], [295.9, 0.82], [296, 0.88]],
});
const swellScore = organScore('swell', SWELL, {
  gainDb: -6, setup: { ...NAVE, seed: 8082, output: 'mix' },
  controls: {
    gedackt8: 0.85, celeste8: 0.75, flute4: [[0, 0], [207.9, 0], [208, 0.3], [287.9, 0.3], [288, 0.45]], hautbois8: [[0, 0.2], [31.9, 0.2], [32, 0.32], [63.9, 0.32], [64, 0.2], [287.9, 0.2], [288, 0.4]],
    swell: [[0, 0.3], [31.9, 0.3], [32, 0.45], [63.9, 0.45], [64, 0.32], [127.9, 0.32], [128, 0.5], [159.9, 0.5], [160, 0.38], [191.9, 0.38], [192, 0.3], [203.5, 0.6],
      [208, 0.55], [237, 0.75], [240, 0.6], [287.9, 0.7], [288, 0.85], [296, 1]],
    space: [[0, 0.5], [31.9, 0.5], [32, 0.42], [63.9, 0.42], [64, 0.35], [127.9, 0.35], [128, 0.5], [159.9, 0.5], [160, 0.4], [207.9, 0.4], [208, 0.7], [239.9, 0.7], [240, 0.55], [287.9, 0.55], [288, 1.05]],
    trem: 0.12, wind: 0.45, chiff: 0.9,
  },
});
const pedalScore = organScore('pedal', PEDAL, {
  gainDb: -6, setup: { ...NAVE, seed: 8083, output: 'mix', width: 0.5 },
  controls: { subbass16: 0.85, octave8: 0.55, contra32: [[0, 0], [295.9, 0], [296, 0.6]], posaune16: [[0, 0], [295.9, 0], [296, 0.35]], space: 0.6, wind: 0.5 },
});

// ================================================================================================ HEAVEN//MASS
/**
 * Six lines. The choir is held back: a hum in the intro, a soft bed under the second half of each verse (tenors and altos,
 * "oo"), a few singers answering in chorus 1. Its real voice arrives in the bridge (a cappella, close) and its full size
 * only in chorus 2 and the ending. While the 808 plays no choir note is below Db3 and the octavists are silent; low
 * notes (F2, C2, Bb2, Gb2) are sung only in the intro, the bridge and after the 808's last dive.
 */
type Part = 'bass' | 'tenor' | 'alto' | 'soprano' | 'soprano-2' | 'descant';
const CH: Record<Part, RackNote[]> = { bass: [], tenor: [], alto: [], soprano: [], 'soprano-2': [], descant: [] };
const sing = (p: Part, at: number, len: number, pitch: string, v: number, o: Opts = {}) => CH[p].push(rn(at, len, pitch, v, o));
const JI = { m3: 15.6, M3: -13.7, P4: -2, P5: 2 };
const chord = (at: number, len: number, voices: Partial<Record<Part, string>>, v: number, o: Opts = {}) => { for (const [p, pitch] of Object.entries(voices)) sing(p as Part, at, len, pitch!, v, o); };
// intro: the hum (just intonation, one or two singers a part)
sing('bass', 4, 8, 'F2', 0.66, { articulation: 'swell', vowel: 'mm', to: 'oo' }); sing('bass', 12, 2, 'Db2', 0.7, { vowel: 'oo' }); sing('bass', 14, 1.5, 'C2', 0.72, { vowel: 'oh' });
sing('bass', 16, 8, 'F2', 0.72, { vowel: 'oo' }); sing('bass', 24, 4, 'Db2', 0.74, { vowel: 'oh' }); sing('bass', 28, 3.25, 'C2', 0.76, { vowel: 'oh', to: 'ah' });
sing('tenor', 12, 2, 'F3', 0.66, { vowel: 'oo', cents: JI.M3 }); sing('tenor', 14, 1.5, 'E3', 0.68, { vowel: 'oh', cents: JI.M3 }); sing('tenor', 16, 8, 'C3', 0.64, { vowel: 'mm', cents: JI.P5 });
sing('tenor', 24, 4, 'F3', 0.7, { vowel: 'oh', cents: JI.M3 }); sing('tenor', 28, 2, 'F3', 0.74, { vowel: 'ah', cents: JI.P4 }); sing('tenor', 30, 1.25, 'E3', 0.76, { vowel: 'ah', cents: JI.M3 });
sing('alto', 12, 2, 'Ab3', 0.66, { vowel: 'oo', cents: JI.P5 }); sing('alto', 14, 1.5, 'G3', 0.68, { vowel: 'oh', cents: JI.P5 }); sing('alto', 16, 8, 'Ab3', 0.66, { vowel: 'mm', cents: JI.m3 });
sing('alto', 24, 4, 'Ab3', 0.7, { vowel: 'oh', cents: JI.P5 }); sing('alto', 28, 3.25, 'Bb3', 0.74, { vowel: 'ah' });
// the verse bed (the second half of verse 1, the first two lines of verse 2): i-i-VI-V voiced C-Db-C over Ab-G
const bed = (c: number, top: boolean) => {
  sing('tenor', c, 12, 'Ab3', 0.6, { vowel: 'oo' }); sing('tenor', c + 12, 3.25, 'G3', 0.6, { vowel: 'oo' });
  sing('alto', c, 8, 'C4', 0.6, { vowel: 'oo' }); sing('alto', c + 8, 4, 'Db4', 0.62, { vowel: 'oo' }); sing('alto', c + 12, 3.25, 'C4', 0.6, { vowel: 'oo' });
  if (top) { sing('soprano-2', c, 8, 'C5', 0.58, { vowel: 'oo' }); sing('soprano-2', c + 8, 4, 'Db5', 0.6, { vowel: 'oo' }); sing('soprano-2', c + 12, 3.25, 'C5', 0.58, { vowel: 'oo' }); }
};
bed(SEC.verse1 + 32, false); bed(SEC.verse1 + 48, false); bed(SEC.verse2, false); bed(SEC.verse2 + 16, true);
/**
 * The second hook's answer: Eb-Db-C sung (V2's own answer, now a choral reply), slurred, on the and of one of the answer
 * bar. Over Eb it closes on Ab/Eb (a gospel plagal colour); over C it is C7(#9 b9), the shout.
 */
const RESP: Record<'Eb' | 'C', Partial<Record<Part, [string, string, string]>>> = {
  Eb: { soprano: ['Eb5', 'Db5', 'C5'], 'soprano-2': ['C5', 'Bb4', 'Ab4'], alto: ['G4', 'G4', 'Eb4'], tenor: ['Eb4', 'Db4', 'C4'], bass: ['Eb3', 'Eb3', 'Eb3'] },
  C: { soprano: ['Eb5', 'Db5', 'C5'], 'soprano-2': ['C5', 'Bb4', 'Ab4'], alto: ['G4', 'E4', 'E4'], tenor: ['Eb4', 'Db4', 'C4'], bass: ['E3', 'E3', 'E3'] },
};
const answer = (c: number, h: 'Eb' | 'C', parts: Part[], v: number) => {
  for (const p of parts) { const [a, b, z] = RESP[h][p]!; sing(p, c + 4.5, 0.5, a, v, { vowel: 'ah' }); sing(p, c + 5, 0.5, b, v - 0.03, { vowel: 'ah' }); sing(p, c + 5.5, 1.75, z, v - 0.04, { vowel: 'ah', to: 'oh' }); }
};
// chorus 1: a few singers, three parts (tenors double the melody in the second half)
for (let p = 0; p < 4; p++) answer(C1 + 8 * p, p % 2 === 0 ? 'Eb' : 'C', ['soprano', 'soprano-2', 'alto', ...(p >= 2 ? ['tenor' as Part] : [])], 0.74);
// bridge: a cappella, close (Bbm9, Gbmaj7/Bb, Fm7/Ab, Db, C7sus4, C7b9), then with the organ (Db, the Neapolitan Gb, the dominant)
const BR: [number, number, Partial<Record<Part, string>>, string, string?][] = [
  [208, 2, { bass: 'Bb2', tenor: 'Db4', alto: 'Ab4', 'soprano-2': 'C5', soprano: 'F5' }, 'oh'],
  [210, 2, { bass: 'Bb2', tenor: 'Db4', alto: 'Gb4', 'soprano-2': 'Bb4', soprano: 'F5' }, 'oh'],
  [212, 2, { bass: 'Ab2', tenor: 'C4', alto: 'F4', 'soprano-2': 'Ab4', soprano: 'Eb5' }, 'oh', 'ah'],
  [214, 2, { bass: 'Db3', tenor: 'Ab3', alto: 'F4', 'soprano-2': 'Ab4', soprano: 'Eb5' }, 'ah'],
  [216, 2, { bass: 'C3', tenor: 'Bb3', alto: 'F4', 'soprano-2': 'G4', soprano: 'F5' }, 'ah'],
  [218, 6, { bass: 'C3', tenor: 'Bb3', alto: 'E4', 'soprano-2': 'G4', soprano: 'Db5' }, 'ah', 'oh'],
  [224, 4, { bass: 'Db3', tenor: 'Ab3', alto: 'F4', 'soprano-2': 'Ab4', soprano: 'Db5' }, 'oh'],
  [228, 4, { bass: 'Gb2', tenor: 'Bb3', alto: 'Gb4', 'soprano-2': 'Bb4', soprano: 'Db5' }, 'oh', 'ah'],
  [232, 2, { bass: 'C3', tenor: 'Bb3', alto: 'F4', 'soprano-2': 'G4', soprano: 'C5' }, 'ah'],
  [234, 4.25, { bass: 'C3', tenor: 'Bb3', alto: 'E4', 'soprano-2': 'G4', soprano: 'Db5' }, 'ah'],
];
BR.forEach(([at, len, vs, vowel, to], i) => chord(at, len, vs, 0.74 + 0.012 * i, { vowel, ...(to ? { to } : {}) }));
// chorus 2: the ceiling (F5 C5 Ab4: Dbmaj7 over the Db bars, Fm over the F bars) under each call; the full answer
for (let p = 0; p < 4; p++) {
  const c = C2 + 8 * p;
  chord(c, 3.75, { soprano: 'F5', 'soprano-2': 'C5', alto: 'Ab4' }, 0.7, { vowel: 'ah' });
  answer(c, p % 2 === 0 ? 'Eb' : 'C', ['soprano', 'soprano-2', 'alto', 'tenor', 'bass'], 0.9);
}
sing('descant', C2 + 20.5, 1, 'Bb5', 0.66, { vowel: 'oo' }); sing('descant', C2 + 21.5, 1.75, 'Ab5', 0.66, { vowel: 'oo' }); sing('descant', C2 + 28.5, 2.75, 'C6', 0.7, { vowel: 'oo' });
// outro: ceilings under the last calls, the answer over V2's Bb, the amen (Bbm, Bbm/F), Db, C7sus4, C7b9, F major
chord(272, 3.75, { soprano: 'F5', 'soprano-2': 'C5', alto: 'Ab4', descant: 'C6' }, 0.72, { vowel: 'ah' });
for (const [p, ps] of Object.entries({ soprano: ['Eb5', 'Db5', 'C5'], 'soprano-2': ['Bb4', 'Bb4', 'Bb4'], alto: ['Gb4', 'F4', 'F4'], tenor: ['Db4', 'Db4', 'Db4'], bass: ['Db3', 'Db3', 'Db3'], descant: ['Db6', 'Db6', 'C6'] }) as [Part, string[]][]) {
  sing(p, 276.5, 0.5, ps[0]!, 0.92, { vowel: 'ah' }); sing(p, 277, 0.5, ps[1]!, 0.9, { vowel: 'ah' }); sing(p, 277.5, 1.75, ps[2]!, 0.88, { vowel: 'ah', to: 'oh' });
}
chord(280, 3.75, { soprano: 'F5', 'soprano-2': 'C5', alto: 'Ab4', descant: 'C6' }, 0.72, { vowel: 'ah' });
const AMEN: [number, number, Partial<Record<Part, string>>, number][] = [
  [284, 2, { bass: 'Db3', tenor: 'F4', alto: 'Bb4', 'soprano-2': 'Db5', soprano: 'F5', descant: 'Bb5' }, 0.9],
  [286, 2, { bass: 'F3', tenor: 'F4', alto: 'Bb4', 'soprano-2': 'Db5', soprano: 'F5', descant: 'Bb5' }, 0.88],
  [288, 4, { bass: 'Db3', tenor: 'F4', alto: 'Ab4', 'soprano-2': 'Db5', soprano: 'F5', descant: 'Ab5' }, 0.88],
  [292, 2, { bass: 'C3', tenor: 'F4', alto: 'G4', 'soprano-2': 'Bb4', soprano: 'F5', descant: 'G5' }, 0.9],
  [294, 2, { bass: 'C3', tenor: 'E4', alto: 'G4', 'soprano-2': 'Bb4', soprano: 'Db5', descant: 'G5' }, 0.92],
  [296, 6.5, { bass: 'F2', tenor: 'F4', alto: 'A4', 'soprano-2': 'C5', soprano: 'F5', descant: 'A5' }, 0.96],
];
AMEN.forEach(([at, len, vs, v], i) => chord(at, len, vs, v, { vowel: i === AMEN.length - 1 ? 'ah' : 'ah', ...(i === AMEN.length - 1 ? { to: 'oh' } : {}) }));
/** Touching notes of the same pitch in a part are one sung note (no re-articulation); parts must not overlap. */
for (const p of Object.keys(CH) as Part[]) {
  const ns = CH[p].sort((a, b) => a[0] - b[0]), out: RackNote[] = [];
  for (const n of ns) {
    const prev = out[out.length - 1];
    if (prev && n[0] < prev[0] + prev[1] - 1e-6) throw new Error(`choir ${p}: overlapping notes at beat ${n[0]}`);
    if (prev && prev[2] === n[2] && Math.abs(prev[0] + prev[1] - n[0]) < 1e-6 && (prev[4]?.cents ?? 0) === (n[4]?.cents ?? 0)) { prev[1] = r6(prev[1] + n[1]); prev[4] = { ...prev[4], ...(n[4]?.to ? { to: n[4].to } : {}) }; continue; }
    out.push(n);
  }
  CH[p] = out;
}
const CHOIR_MACRO: [number, number][] = [[0, 0.02], [12, 0.05], [24, 0.1], [31.25, 0.14], [96, 0.1], [127.25, 0.16], [128, 0.34], [159.9, 0.42], [160, 0.16], [191.5, 0.22],
  [208, 0.5], [222, 0.58], [234, 0.7], [238.25, 0.74], [240, 0.86], [271.9, 0.92], [272, 0.92], [286, 0.95], [288, 0.88], [294, 0.95], [296, 1]];
const CHOIR_EXPR: [number, number][] = [[0, 0.62], [31.25, 0.68], [96, 0.6], [127.9, 0.62], [128, 0.72], [159.9, 0.74], [160, 0.6], [208, 0.72], [234, 0.82], [240, 0.86], [272, 0.88], [296, 0.95], [302.5, 0.9]];
const CHOIR_GAIN: Record<Part, number> = { bass: -14, tenor: -12, alto: -10, soprano: -13, 'soprano-2': -13, descant: -15 };
const SETUPS: Record<Part, Opts> = {
  bass: { seed: 9001, singers: 6, octavists: 3, center: -0.05 }, tenor: { seed: 9002, singers: 6 }, alto: { seed: 9003, singers: 6 },
  soprano: { seed: 9004, singers: 6 }, 'soprano-2': { seed: 9005, singers: 6, center: -0.18 }, descant: { seed: 9006, singers: 3, center: 0.12, depth: 1 },
};
const INSTR: Record<Part, string> = { bass: 'heaven-mass/bass', tenor: 'heaven-mass/tenor', alto: 'heaven-mass/alto', soprano: 'heaven-mass/soprano', 'soprano-2': 'heaven-mass/soprano', descant: 'heaven-mass/soprano' };
const choirPart = (id: Part) => ({
  id, instrument: INSTR[id], gainDb: CHOIR_GAIN[id], pan: 0, room: 0,
  setup: { depth: 0.6, lowCut: 200, output: 'mix', ...SETUPS[id] },
  macro: id === 'descant' ? 1 : CHOIR_MACRO, expression: id === 'descant' ? [[256, 0.6], [272, 0.7], [296, 0.86], [302.5, 0.8]] : CHOIR_EXPR,
  ...(id === 'bass' ? { controls: { octavist: [[0, 0], [295.9, 0], [296.5, 0.9], [304, 0.9]] } } : {}),
  ...(id === 'descant' ? { controls: { air: 0.75, room: 1.2, width: 0.6 } } : {}),
  ...(id === 'soprano' || id === 'soprano-2' ? { offsets: { air: [[0, 0], [239.9, 0], [240, 0.1]] } } : {}),
  notes: CH[id],
});
const choirScore = (bus: string, ids: Part[]) => ({
  schema: SCHEMA, title: `Concrete Gospel Full-Length: HEAVEN//MASS ${bus}`, bpm: BPM, key: 'F minor', swing: 0.5, seed: 4003, tailSeconds: TAIL_SECONDS, masterGainDb: 0,
  description: `HEAVEN//MASS, ${ids.join(' + ')}: the ${bus} choir bus.`, sections: SECTIONS, parts: ids.map(choirPart),
});

// ================================================================================================ engine project
type Pt = { at: { musical: string }; value: number; transition?: 'linear' };
const ptAt = (beat: number, value: number, linear = true): Pt => ({ at: { musical: pos(beat) }, value: r6(value), ...(linear ? { transition: 'linear' as const } : {}) });
/** V2's 808 duck (-14 dB on the kick, -8 dB at 96 ticks, back by 250 ticks), plus the fades after each dive. */
function duck808(base: number): Pt[] {
  const D = V2.DUCK, t = (n: number) => n / 960, pts: Pt[] = [];
  const fades: [number, number, number][] = [[60.2, 60.6, -40], [FLOOR + 13.9, FLOOR + 14.45, -40], [286.25, 287.75, -45]];
  for (const [k] of KICKS) {
    for (const [a, z, d] of fades) if (k > z && !pts.some(p => p.at.musical === pos(a))) pts.push(ptAt(a, base), ptAt(z, base + d, false));
    pts.push(ptAt(k - t(D.preTicks), base), ptAt(k, base - D.depthDb), ptAt(k + t(D.holdTicks), base - D.holdDb), ptAt(k + t(D.backTicks), base));
  }
  const last = fades[fades.length - 1]!; pts.push(ptAt(last[0], base), ptAt(last[1], base + last[2], false));
  return pts;
}
/** A gain lane in dB: a piecewise-linear base minus a short duck under each listed hit (V3's lane). */
function lane(base: [number, number][], hits: number[], depth: number): Pt[] {
  const at = (b: number) => { if (b <= base[0]![0]) return base[0]![1]; for (let i = 1; i < base.length; i++) { const [b1, v1] = base[i]!, [b0, v0] = base[i - 1]!; if (b <= b1) return b1 === b0 ? v1 : v0 + (v1 - v0) * (b - b0) / (b1 - b0); } return base[base.length - 1]![1]; };
  const A = 30 / 960, H = 140 / 960, Z = 360 / 960;
  const duck = (b: number) => { let d = 0; for (const h of hits) { const x = b >= h - A && b < h ? (b - h + A) / A : b >= h && b < h + H ? 1 - 0.6 * (b - h) / H : b >= h + H && b < h + Z ? 0.4 * (1 - (b - h - H) / (Z - H)) : 0; d = Math.max(d, x); } return d * depth; };
  const ticks = new Set<number>();
  for (const [b] of base) ticks.add(Math.round(b * 960));
  for (const h of hits) for (const x of [h - A, h, h + H, h + Z]) ticks.add(Math.round(x * 960));
  return [...ticks].filter(x => x >= 0).sort((a, b) => a - b).map(x => ptAt(x / 960, at(x / 960) - duck(x / 960)));
}
/**
 * Engine levels per section ([from beat, dB, ramp in beats before]): the Cathedral Experiment's and V3's calibrated values
 * for each role (the lead at the V2 reed's in-mix level, organ answers about 4 LU under it, the choir's hum, breath and
 * ceiling as V3), adapted to the sections; the QA/fix pass corrects them where the measurements say so.
 */
type Level = [number, number, number?];
export const LEVELS: Record<string, Level[]> = {
  // QA fixes (after its 2:1 compressor, which this gain feeds, each change is half as large): verse 2 -1 dB (F3), the bridge
  // +1.5 dB (F2), the held Ab and the bend to A +3 dB (F4). The candidate: 3 / 2.5 / 5 / 4 in those places.
  volt: FIX ? [[0, 1.5], [32, 3.5, 0.1], [64, 2.5, 0.1], [128, 4, 0.1], [160, 1, 0.1], [208, 5.5, 0.1], [240, 7, 0.1], [286.5, 11, 1], [296, 10, 0.5]]
    : [[0, 1.5], [32, 3.5, 0.1], [64, 2.5, 0.1], [128, 4, 0.1], [160, 3, 0.1], [208, 2.5, 0.1], [240, 7, 0.1], [286.5, 5, 1], [296, 4, 0.5]],
  'volt-room': [[0, 5], [32, 2, 1], [208, 4, 0.5], [240, 2, 0.5], [286.5, 5, 1]],
  great: [[0, 4], [128, 3, 0.5], [208, 2, 0.5], [240, 1.4, 0.5], [287.5, -3.5, 0.5]],
  swell: [[0, 4], [32, 7, 0.5], [64, 2, 0.5], [128, 5, 0.5], [160, 4, 0.5], [192, 3, 0.5], [208, 2, 0.5], [240, -2.2, 0.5], [287.5, -6.9, 0.5]],
  pedal: [[0, 2], [287, 4.9, 0.5]],
  'choir-low': [[0, 4], [64, 2, 0.5], [208, -0.8, 0.5], [240, -3.2, 0.4], [287.5, -1, 0.5]],
  'choir-mid': [[0, 3], [64, 0, 0.5], [128, 2.5, 0.5], [160, 0, 0.5], [208, -3.6, 0.5], [240, -5.8, 0.4], [287.5, -4.3, 0.5]],
  'choir-high': [[0, 3], [128, 3, 0.5], [160, 0, 0.5], [208, -2.8, 0.5], [240, -3.5, 0.4], [287.5, -3.9, 0.5]],
};
/** Rides: [from, to, dB down, ramp]. V3's lesson, written in from the start: the choir sits back under the lead's calls. */
type Dip = [number, number, number, number?];
const CALLS: [number, number][] = [[C2, C2 + 2.5], [C2 + 8, C2 + 11.5], [C2 + 16, C2 + 19], [C2 + 24, C2 + 28], [272, 274.5], [280, 283.5], [284.5, 286.5]];
/**
 * The QA/fix pass (FIX), as rides on top (negative = up):
 *   F1 the choir's arc ran backwards (chorus 1 -17.1 LUFS and the bridge -16.2 louder than chorus 2's full choir, -18.4):
 *      chorus 1 -2 dB, chorus 2 and the outro +2 dB (the calls' dips 2 dB deeper, so under the lead nothing changes), the
 *      bridge -3 dB
 *   F2 the lead's cry was covered in the bridge (-4.0 dB under the rest of the mix): the choir 4 dB and the organ 3 dB
 *      back under it
 *   F3 verse 2 left no room for a voice (melodic parts +1.8 dB over the beat at 300 Hz-3 kHz, busy 98 %): its bed -8 dB,
 *      the Swell -6 dB, verse 1's bed -3 dB
 *   F4 the ending: the choir and Swell 3 dB further back under the lead's last answer
 */
const CALLS2 = CALLS.slice(0, 6);
const choirFix = (low: boolean): Dip[] => [
  ...(low ? [] : [[128, 159.9, 2, 0.5], [64, 127.9, 3, 0.5], [160, 191.9, 8, 0.5]] as Dip[]),
  [240, 287.4, -2, 0.5], ...CALLS2.map(([a, z]) => [a, z, 2] as Dip), [208, 239.5, 3, 0.5], [222.25, 238.5, 4], [284.5, 286.5, 3],
];
export const DIPS: Record<string, Dip[]> = {
  'choir-high': [...CALLS.map(([a, z]) => [a, z, 5] as Dip), ...(FIX ? choirFix(false) : [])],
  'choir-mid': [...CALLS.map(([a, z]) => [a, z, 6] as Dip), ...(FIX ? choirFix(false) : [])],
  ...(FIX ? { 'choir-low': choirFix(true), swell: [[160, 207, 6, 0.5], [222.25, 238.5, 3], [284.5, 286.5, 3]] as Dip[], great: [[222.25, 238.5, 3]] as Dip[] } : {}),
};
const stepsOf = (levels: Level[]): [number, number][] => levels.flatMap(([b, v, ramp = 0.5], i) => (i === 0 ? [[b, v]] : [[b - ramp, levels[i - 1]![1]], [b, v]]) as [number, number][]);
const dipOf = ([a, z, d, r = 0.25]: Dip): [number, number][] => [[a - r, 0], [a, -d], [z, -d], [z + r, 0]];
const curveAt = (pts: [number, number][], b: number) => { if (b <= pts[0]![0]) return pts[0]![1]; for (let i = 1; i < pts.length; i++) { const [b1, v1] = pts[i]!, [b0, v0] = pts[i - 1]!; if (b <= b1) return b1 === b0 ? v1 : v0 + (v1 - v0) * (b - b0) / (b1 - b0); } return pts[pts.length - 1]![1]; };
/** Section levels plus every ride, summed (each ride is zero outside its span), sampled at all their breakpoints. */
function baseOf(id: string): [number, number][] {
  const st = stepsOf(LEVELS[id]!), dps = (DIPS[id] ?? []).map(dipOf), ride = (b: number, d: [number, number][]) => (b <= d[0]![0] || b >= d[3]![0] ? 0 : curveAt(d, b));
  return [...new Set([...st, ...dps.flat()].map(([b]) => b))].filter(b => b >= 0).sort((a, b) => a - b).map(b => [b, r6(curveAt(st, b) + dps.reduce((a, d) => a + ride(b, d), 0))]);
}
/** Where a part sounds (its notes plus a beat of release), so ducks are written only where they do something. */
const spans = (notes: RackNote[]) => notes.map(([b, d]) => [b, b + d + 1] as [number, number]);
const DRUM_HITS = [...KICKS.map(([b]) => b), ...SNARES].sort((a, b) => a - b).filter((b, i, a) => i === 0 || b - a[i - 1]! > 1e-6);
const hitsIn = (sp: [number, number][]) => DRUM_HITS.filter(h => sp.some(([a, z]) => h >= a && h <= z));
const gains = (id: string, sp: [number, number][], duck: number) => lane(baseOf(id), duck ? hitsIn(sp) : [], duck);
const level0 = (id: string) => LEVELS[id]![0]![1];
const labTrack = (id: string, description: string, effects: unknown[], automation?: Pt[]) => ({
  id, description, instrument: { type: 'sampler', sample: `assets/lab/${id}.wav` }, mix: { gainDb: level0(id) }, effects, ...(automation ? { automation: { gainDb: automation } } : {}),
  clips: [{ bar: 1, pattern: 'all' }], patterns: [{ id: 'all', bars: BARS, notes: [{ start: '1:1', velocity: 1 }] }],
});
const drumTrack = (id: string, description: string, notes: EN[]) => {
  const t = structuredClone(v2track(id)) as Record<string, unknown>;
  return { ...t, id, description, clips: [{ bar: 1, pattern: 'all' }], patterns: [{ id: 'all', bars: BARS, notes }] };
};
const bass808 = (() => {
  const t = structuredClone(v2track('bass808')) as Record<string, unknown>;
  const base = (t.mix as { gainDb: number }).gainDb;
  return { ...t, id: 'bass808', description: 'V2\'s 808 (Living Bass rack stem, new line) with V2\'s effects and duck: -14 dB under every kick, back in about 110 ms.',
    instrument: { type: 'sampler', sample: 'assets/lab/bass808.wav' }, automation: { gainDb: duck808(base) }, clips: [{ bar: 1, pattern: 'all' }], patterns: [{ id: 'all', bars: BARS, notes: [{ start: '1:1', velocity: 1 }] }] };
})();
const choirNotes = (ids: Part[]) => ids.flatMap(i => CH[i]);
export const project = {
  formatVersion: 1, title: 'Concrete Gospel (Full-Length Edition)',
  description: 'Concrete Gospel, full length. V2\'s kick, snare, hats, bell, steel and 808 (V2\'s own hits, gains, effects and duck) with THRONE//VOLT, CATHEDRAL//ENGINE and HEAVEN//MASS.',
  bpm: BPM, timeSignature: '4/4', key: 'F minor', bars: BARS, seed: 1440, render: { tail: { seconds: TAIL_SECONDS } },
  master: structuredClone(V2.project.master),
  tracks: [
    drumTrack('kick', 'V2\'s kick (IRON PULSE + skin knock + log click per hit). Bars 9-16 and 69-72 are V2\'s own; the verse, pressure, floor and chorus pockets are new.', KICK_N),
    drumTrack('snare', 'V2\'s snare (TITANIUM CRACK + HEADLINER body + skin front per backbeat; crack-only ghosts).', SNARE_N),
    drumTrack('hats', 'V2\'s V12 GHOST TICK / OPEN CIRCUIT: footsteps, V2\'s hats, verse eighths, chorus triplets, verse-2 sixteenths.', HAT_N),
    drumTrack('toll', 'The V12 CHROME STRIKE bell on F: it marks the sections.', TOLL_N),
    drumTrack('clank', 'The same bell gated short on C5/F5: V1\'s off-beat steel figure.', CLANK_N),
    bass808,
    labTrack('volt', 'THRONE//VOLT (rack stem): both hooks, the tags, the cry, the last bend.',
      [{ type: 'highpass', frequencyHz: 150 }, { type: 'compressor', thresholdDb: -22, ratio: 2, attackMs: 12, releaseMs: 160, makeupGainDb: 2 }, { type: 'compressor', thresholdDb: -8, ratio: 6, attackMs: 1, releaseMs: 60 }, { type: 'lowpass', frequencyHz: 9000 }],
      gains('volt', [], 0)),
    labTrack('volt-room', 'V2\'s room (rack FDN) on THRONE//VOLT.', [{ type: 'highpass', frequencyHz: 200 }], gains('volt-room', [], 0)),
    labTrack('great', 'CATHEDRAL//ENGINE Great with its Nave: the dramatic responses and the last chords.', [{ type: 'highpass', frequencyHz: 90 }], gains('great', spans(GREAT), 2)),
    labTrack('swell', 'CATHEDRAL//ENGINE Swell with its Nave: the answers, the echoes, the floor, the bridge.', [{ type: 'highpass', frequencyHz: 90 }], gains('swell', spans(SWELL), 2)),
    labTrack('pedal', 'CATHEDRAL//ENGINE Pedal: only where there is no 808 (the bridge, the end).', [], gains('pedal', [], 0)),
    labTrack('choir-low', 'HEAVEN//MASS basses (octavists on the last chord) with their Nave; 4 dB out of the way of each kick and snare.', [{ type: 'highpass', frequencyHz: 40 }], gains('choir-low', spans(CH.bass), 4)),
    labTrack('choir-mid', 'HEAVEN//MASS tenors and altos with their Nave; 2.5 dB under each kick and snare; back 6 dB under the lead\'s calls.', [{ type: 'highpass', frequencyHz: 80 }], gains('choir-mid', spans(choirNotes(['tenor', 'alto'])), 2.5)),
    labTrack('choir-high', 'HEAVEN//MASS sopranos, second sopranos and descant with their Nave; back 5 dB under the lead\'s calls.', [{ type: 'highpass', frequencyHz: 120 }], gains('choir-high', spans(choirNotes(['soprano', 'soprano-2', 'descant'])), 1.5)),
  ],
};
/** Rack scores (each renders on its own core) and what each engine asset is made of. */
export const SCORES = [
  { id: 'fl-808', score: bassScore }, { id: 'fl-lead', score: leadScore },
  { id: 'fl-great', score: greatScore }, { id: 'fl-swell', score: swellScore }, { id: 'fl-pedal', score: pedalScore },
  { id: 'fl-choir-low', score: choirScore('low', ['bass']) }, { id: 'fl-choir-mid', score: choirScore('mid', ['tenor', 'alto']) }, { id: 'fl-choir-high', score: choirScore('high', ['soprano', 'soprano-2', 'descant']) },
] as const;
export const ASSETS: Record<string, [string, string]> = {
  bass808: ['fl-808', 'stems/bass808.wav'], volt: ['fl-lead', 'stems/volt.wav'], 'volt-room': ['fl-lead', 'stems/room.wav'],
  great: ['fl-great', 'stems/great.wav'], swell: ['fl-swell', 'stems/swell.wav'], pedal: ['fl-pedal', 'stems/pedal.wav'],
  'choir-low': ['fl-choir-low', 'mix-dry.wav'], 'choir-mid': ['fl-choir-mid', 'mix-dry.wav'], 'choir-high': ['fl-choir-high', 'mix-dry.wav'],
};
/** For the QA: where things are. */
export const MAP = {
  sections: Object.fromEntries(SECTIONS.map((s, i) => [s.id, [SECTIONS.slice(0, i).reduce((a, x) => a + x.bars * 4, 0), SECTIONS.slice(0, i + 1).reduce((a, x) => a + x.bars * 4, 0)]])),
  kicks: KICKS.map(([b]) => b), snares: SNARES, calls: CALLS,
  drumSections: { hook: [32, 60], 'verse-1': [64, 128], 'chorus-1': [128, 160], 'verse-2': [160, 204], 'chorus-2': [240, 272], outro: [272, 286.5] },
  bass808Windows: [[32, 60.6], [64, 206.4], [240, 287.75]], leadNotes: LEAD.map(([b, d]) => [b, b + d]),
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = join(HERE, 'source');
  mkdirSync(out, { recursive: true });
  for (const s of SCORES) writeFileSync(join(out, `${s.id}.score.json`), JSON.stringify(s.score, null, 1) + '\n');
  writeFileSync(join(out, 'concrete-gospel-full-length.project.json'), JSON.stringify(project, null, 1) + '\n');
  writeFileSync(join(out, 'map.json'), JSON.stringify(MAP, null, 1) + '\n');
  const n = (k: Part[]) => k.reduce((a, p) => a + CH[p].length, 0);
  const auto = project.tracks.map(t => [t.id, (t as { automation?: { gainDb?: unknown[] } }).automation?.gainDb?.length ?? 0]);
  console.log(`wrote ${out}: ${SCORES.length} rack scores, 1 engine project (${project.tracks.length} tracks, ${BARS} bars); kicks ${KICKS.length}, snares ${SNARES.length}, hats ${HAT_N.length}; 808 ${BASS.length}, lead ${LEAD.length}, organ ${GREAT.length + SWELL.length + PEDAL.length}, choir ${n(['bass', 'tenor', 'alto', 'soprano', 'soprano-2', 'descant'])}; automation ${JSON.stringify(auto)}${CANDIDATE ? ' [candidate]' : ''}`);
}
