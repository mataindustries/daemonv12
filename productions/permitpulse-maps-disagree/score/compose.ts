/** PERMITPULSE // THE MAPS DISAGREE — score generator.
 *
 * The cue is written in picture seconds and in the beats of a conducted tempo
 * map (film-scoring practice: the tempo bends so hit points fall on beats). It
 * emits an ordinary DaemonV12 project: 120 BPM container (1 tick = 1/1920 s, so
 * every onset lands within 0.26 ms of its picture time), one 14-bar pattern per
 * track, `render.duration` = 28 s. Edit CUES to re-sync; edit the score below to
 * recompose.
 *
 *   node productions/permitpulse-maps-disagree/score/compose.ts v1|v2|v3
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const version = process.argv[2] ?? 'v3';
if (!['v1', 'v2', 'v3'].includes(version)) throw new Error('Usage: compose.ts v1|v2|v3');
/** V2 includes every V2 change; V3 builds on V2. */
const V2 = version !== 'v1', V3 = version === 'v3';
const production = join(dirname(fileURLToPath(import.meta.url)), '..');

// ------------------------------------------------------------- picture lock
/** Exact picture times in seconds (60 fps final; 30 fps proxy measured the same). */
export const CUES = {
  start: 0,
  titleOn: 0.2,          // ABOUT TO COMMIT? (proxy frame 6)
  unitLands: 1.6,
  sourceASeats: 3.1,
  looksClear: 3.7,       // LOOKS CLEAR. (proxy frame 111)
  sourceBReveal: 5.5,
  disagree: 6.8,
  disagreeTitle: 7.1,    // THE MAPS DISAGREE. fades in 7.10-7.23
  amberTraceIn: 7.5,
  amberTraceOut: 9.0,
  cameraMove: 9.0,
  evidenceCut: 41 / 3,   // 13.6667 = frame 820 @ 60 fps (proxy frame 410)
  briefEstablished: 15.0,
  findingCard: 17.4,     // hard cut to the 02 FIRE-HAZARD ZONE card (proxy frame 522)
  verifyTitle: 18.1,     // KNOW WHAT TO VERIFY FIRST. + amber underline (proxy frame 543)
  titleOff: 20.9,
  brandCut: 21.0,
  neverGuess: 21.5,
  sendIt: 23.6,
  url: 23.8,
  disclaimer: 24.4,
  end: 28.0,
} as const;

// ------------------------------------------------------------- tempo map
/** Beats → seconds. 75 BPM heartbeat; accelerando 75→T1 under the camera move,
 * T1 to the cut (beat 18); 90 BPM settle; 100 BPM research pulse to the brand cut (beat 30). */
const T0 = 75, RAMP_FROM = 11.25, RAMP_TO = 14, CUT_BEAT = 18;
const rampSeconds = (t1: number) => 60 * (RAMP_TO - RAMP_FROM) / (t1 - T0) * Math.log(t1 / T0);
const T1 = (() => {
  const span = CUES.evidenceCut - CUES.cameraMove;
  let lo = 76, hi = 140;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (rampSeconds(mid) + 60 * (CUT_BEAT - RAMP_TO) / mid > span) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
})();
export function beat(b: number): number {
  if (b <= RAMP_FROM) return b * 60 / T0;
  if (b <= RAMP_TO) { const k = (T1 - T0) / (RAMP_TO - RAMP_FROM); return CUES.cameraMove + 60 / k * Math.log((T0 + k * (b - RAMP_FROM)) / T0); }
  const rampEnd = CUES.cameraMove + rampSeconds(T1);
  if (b <= CUT_BEAT) return rampEnd + (b - RAMP_TO) * 60 / T1;
  if (b <= 20) return CUES.evidenceCut + (b - CUT_BEAT) * 60 / 90;
  return CUES.briefEstablished + (b - 20) * 60 / 100;
}

// ------------------------------------------------------------- engine time
const TICKS_PER_SECOND = 1920; // 120 BPM, 960 PPQ
const BARS = 14;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const ticks = (seconds: number) => Math.round(seconds * TICKS_PER_SECOND);
export const frameOfTick = (tick: number) => Number((BigInt(tick) * 500000n * 44100n + 480000000n) / 960000000n);
function position(seconds: number): string {
  const t = ticks(seconds); if (t < 0 || t >= BARS * 3840) throw new RangeError(`Onset outside cue: ${seconds}`);
  const bar = Math.floor(t / 3840) + 1, r = t % 3840, b = Math.floor(r / 960) + 1, o = r % 960;
  if (!o) return `${bar}:${b}`;
  const g = gcd(o, 3840); return `${bar}:${b}+${o / g}/${3840 / g}`;
}
function fraction(seconds: number): string {
  let t = Math.max(1, ticks(seconds)), g = gcd(t, 3840);
  if (t / g > 9999) { t = Math.max(15, Math.round(t / 15) * 15); g = gcd(t, 3840); }
  return `${t / g}/${3840 / g}`;
}
const rate = (semitones: number) => Number((2 ** (semitones / 12)).toFixed(6));
const round6 = (x: number) => Number(x.toFixed(6));

// ------------------------------------------------------------- notes
interface Note {
  at: number; v: number; hit?: string; n?: number; glideTo?: number; glideSeconds?: number;
  until?: number; attack?: number; release?: number; offset?: number; choke?: string; why?: string;
}
const tracks: Record<string, Note[]> = {};
const add = (track: string, note: Note) => { (tracks[track] ??= []).push(note); };
const notes = (track: string, list: Note[]) => list.forEach(n => add(track, n));

// Pitch names relative to each source's D root.
const P = { A3: -17, Bb3: -16, D4: -12, E4: -10, A4: -5, Bb4: -4, C5: -2, D5: 0, E5: 2, F5: 3, Fs5: 4, G5: 5, A5: 7, B5: 9, D6: 12, E6: 14, F6: 15, Fs6: 16, A6: 19 };
/** Multi-sampled kits: bass/pulse by root name, pad by note name (rate 1, true decays). */
const BASS = { D: 'd', C: 'c', Bb: 'bb', A: 'a', G: 'g' } as const;
const PAD = { D3: 'pad-d3', F3: 'pad-f3', G3: 'pad-g3', A3: 'pad-a3', Bb3: 'pad-bb3', C4: 'pad-c4', D4: 'pad-d4', E4: 'pad-e4', F4: 'pad-f4', Fs4: 'pad-fs4', G4: 'pad-g4', A4: 'pad-a4', Bb4: 'pad-bb4', B4: 'pad-b4', C5: 'pad-c5', D5: 'pad-d5', E5: 'pad-e5' } as const;
const lub = (root: string) => `pulse-lub-${root}`, dub = (root: string) => `pulse-dub-${root}`;

/** The PermitPulse motif: short, short, LONG (D–E–A) + an answer tone T. */
function motif(track: string, at: (i: number) => number, root: number, velocity: number, answer?: { at: number; n: number; v: number }, until?: number) {
  [P.D5, P.E5, P.A5].forEach((n, i) => add(track, { at: at(i), n: n + root, v: velocity * [1, 0.82, 1.05][i]!, until, release: 0.01 }));
  if (answer) add(track, { at: answer.at, n: answer.n + root, v: answer.v, until, release: 0.01 });
}
const cut = CUES.evidenceCut;

// ============================================================= I. CONFIDENCE
// Hook: heartbeat + glass motif from frame zero; the unit landing completes it (F#).
motif('glass-a', i => beat(i * 0.25), 0, 0.92, { at: CUES.unitLands, n: P.Fs5, v: 0.86 });
add('glass-a', { at: beat(3.5), n: P.A4, v: 0.26 });
// Map A seats: the motif restated with full harmony; LOOKS CLEAR lands between A and F#.
motif('glass-a', i => beat(4 + i * 0.25), 0, 0.78, { at: beat(6), n: P.Fs5, v: 0.8 });
// Map A insists just as B arrives (its A5 coincides with B's first note at 6.800).
motif('glass-a', i => beat(8 + i * 0.25), 0, 0.68, { at: beat(10), n: P.Fs5, v: 0.72 }, cut);

for (let b = 0; b <= 8; b++) {
  const strong = b === 0 || b === 2 || b === 4;
  add('pulse', { at: beat(b), hit: lub('d'), v: b === 0 ? 1 : strong ? 0.9 : V2 ? 0.5 : 0.6 });
  add('pulse', { at: beat(b + 0.25), hit: dub('d'), v: b === 0 ? 0.82 : strong ? 0.68 : V2 ? 0.34 : 0.42 });
}
notes('bass', [
  // V2: the hook's low end is the heartbeat alone; the sustained ground arrives when Map A seats.
  ...(V2 ? [{ at: CUES.sourceASeats, hit: 'bass-d', v: 0.72, until: CUES.sourceBReveal, release: 0.15 }] : [
    { at: 0, hit: 'bass-d', v: 0.85, until: beat(4), release: 0.12 },
    { at: beat(4), hit: 'bass-d', v: 0.72, offset: 0.4, attack: 0.04, until: CUES.sourceBReveal, release: 0.15 }]),
  // The ground shifts with Map B: D2 glides to Bb1 across the 5.5–6.8 slide.
  { at: CUES.sourceBReveal, hit: 'bass-d', glideTo: -4, glideSeconds: CUES.disagree - CUES.sourceBReveal, v: 0.78, offset: 1.2, attack: 0.15, until: CUES.cameraMove, release: 0.08 },
]);
add('sub', { at: 0, n: 0, v: 0.6, until: 3.0, release: 0.6 });
add('foley', { at: CUES.unitLands, hit: 'thock', v: 1 });
add('foley', { at: CUES.sourceASeats, hit: 'plate-seat', v: 0.9 });
// Map A harmony arrives with the seated plate: D add9, still without commitment.
[PAD.D3, PAD.A3, PAD.E4, PAD.Fs4].forEach((hit, i) => add('pad', { at: beat(4), hit, v: [0.42, 0.36, 0.3, 0.3][i]!, until: CUES.disagree, release: 0.35 }));
for (let b = 4; b < 8.5; b += 0.5) add('ticks-a', { at: beat(b), hit: 'tick-a', v: Number.isInteger(b) ? 0.5 : 0.3 });

// ============================================================= II. DOUBT
add('foley', { at: CUES.sourceBReveal, hit: 'slide', v: 0.8, until: CUES.disagree + 0.02, release: 0.02 });
add('foley', { at: CUES.disagree, hit: 'plate-seat', n: -5, v: 0.75 });
// Map B: same motif, darker metal, an 8th off A's grid; its long A5 lands on the title (7.2),
// its answer is F natural — the disputed boundary.
motif('metal-b', i => beat(8.5 + i * 0.25), 0, 0.85, { at: beat(10.75), n: P.F5, v: 0.8 }, cut);
// V3: B's F sounds under its first note, so the F/F# contradiction is immediate at 6.800.
if (V3) add('metal-b', { at: CUES.disagree, n: P.F5, v: 0.5, until: cut, release: 0.01 });
[PAD.Bb3, PAD.D4, PAD.F4, PAD.A4].forEach((hit, i) => add('pad', { at: CUES.disagree, hit, v: [0.4, 0.34, 0.32, 0.26][i]!, until: CUES.cameraMove, release: 0.3, ...(V3 ? { offset: 0.45, attack: 0.02 } : {}) }));
// Two heartbeats: A keeps D on the beat; B beats Bb on a dotted-eighth grid (3 against 4).
// V3 fix: heartbeats still ringing at the evidence cut stop with it.
const cutGate: Partial<Note> = V3 ? { until: cut, release: 0.012 } : {};
for (let b = 8.5; b < CUT_BEAT; b += 0.75) {
  // V3 mix: where both heartbeats coincide (every third beat) B's beat yields, keeping peaks off the low end.
  const coincide = V3 && Number.isInteger(b);
  add('pulse', { at: beat(b), hit: lub('bb'), v: (b === 8.5 ? (V3 ? 0.85 : 1) : 0.5 + 0.2 * (b - 8.5) / 9.5) * (coincide ? 0.6 : 1), ...cutGate });
  if (b === 8.5) add('pulse', { at: beat(b + 0.25), hit: dub('bb'), v: 0.7, ...cutGate });
}
for (let b = 9; b < CUT_BEAT; b++) {
  add('pulse', { at: beat(b), hit: lub('d'), v: 0.55 + 0.25 * (b - 9) / 8, ...cutGate });
  add('pulse', { at: beat(b + 0.25), hit: dub('d'), v: 0.38 + 0.2 * (b - 9) / 8, ...cutGate });
}
// (V3: from beat 16 the triplet run below replaces the dotted grid instead of doubling it.)
for (let b = 8.5; b < (V3 ? 16 : CUT_BEAT); b += 0.75) add('ticks-b', { at: beat(b), hit: 'tick-b', v: 0.42 + 0.3 * (b - 8.5) / 9.5 });
for (let b = 9; b < RAMP_FROM; b += 0.5) add('ticks-a', { at: beat(b), hit: 'tick-a', v: Number.isInteger(b) ? 0.5 : 0.3 });
// The amber trace draws the boundary: F#5 sinks to F5 across 7.5–9.0.
add('amber', { at: CUES.amberTraceIn, n: P.Fs5, glideTo: P.F5, glideSeconds: CUES.amberTraceOut - CUES.amberTraceIn, v: 0.6, attack: 0.25, until: CUES.amberTraceOut + 0.15, release: 0.45 });

// Camera move: alternating ground, conflict chord, canon at the eighth, closing trill.
const bassMoves: [number, string][] = [[RAMP_FROM, BASS.D], [12, BASS.Bb], [13, BASS.D], [14, BASS.Bb], [15, BASS.D], [16, BASS.Bb], [16.5, BASS.D], [17, BASS.Bb], [17.5, BASS.D]];
if (!V2) bassMoves.forEach(([b, root], i) => add('bass', { at: beat(b), hit: `bass-${root}`, v: 0.7 + 0.1 * i / bassMoves.length, until: i + 1 < bassMoves.length ? beat(bassMoves[i + 1]![0]) : cut, release: 0.03 }));
if (V2) {
  // Analog ostinato: eighths that alternate the two grounds per beat, then per eighth, then per
  // sixteenth in the last beat. The accelerando does the driving; nothing rises in pitch.
  add('bass', { at: CUES.cameraMove, hit: 'bass-d', v: 0.82, until: beat(11.5), release: 0.03 });
  const steps: number[] = [];
  for (let b = 11.5; b < 17; b += 0.5) steps.push(b);
  for (let b = 17; b < CUT_BEAT; b += 0.25) steps.push(b);
  steps.forEach((b, i) => {
    const root = b >= 17 ? (i % 2 ? 'bb' : 'd') : b >= 16 ? (Math.round(b * 2) % 2 ? 'bb' : 'd') : Math.floor(b) % 2 ? 'bb' : 'd';
    const next = steps[i + 1] ?? CUT_BEAT;
    add('bass', { at: beat(b), hit: `bass-${root}`, v: 0.6 + 0.25 * (b - 11.5) / 6.5, until: Math.min(cut, beat(b + (next - b) * 0.72)), release: 0.035 });
  });
  // Map B's ratchet switches to eighth-note triplets for the last two beats: 3 against A's 4.
  for (let b = 16; b < CUT_BEAT - 0.01; b += 1 / 3) add('ticks-b', { at: beat(b), hit: 'tick-b', v: V3 ? 0.55 : 0.62 });
}
[PAD.D3, PAD.D4, PAD.Fs4, PAD.Bb4].forEach((hit, i) => add('pad', { at: CUES.cameraMove, hit, v: [0.4, 0.34, 0.32, 0.3][i]!, until: cut, release: 0.008 }));
motif('glass-a', i => beat(12 + i * 0.25), 0, 0.62, { at: beat(13.5), n: P.Fs5, v: 0.62 }, cut);
motif('metal-b', i => beat(13 + i * 0.25), 0, 0.66, { at: beat(14.5), n: P.F5, v: 0.62 }, cut);
motif('glass-a', i => beat(14 + i * 0.25), 0, 0.66, { at: beat(15), n: P.Fs5, v: 0.64 }, cut);
motif('metal-b', i => beat(14.5 + i * 0.25), 0, 0.7, { at: beat(15.5), n: P.F5, v: 0.66 }, cut);
motif('glass-a', i => beat(16 + i * 0.25), 12, 0.5, undefined, cut);
motif('metal-b', i => beat(16.25 + i * 0.25), 12, 0.52, undefined, cut);
[17, 17.5].forEach(b => add('glass-a', { at: beat(b), n: P.Fs5, v: 0.7, until: cut, release: 0.01 }));
[17.25, 17.75].forEach(b => add('metal-b', { at: beat(b), n: P.F5, v: 0.72, until: cut, release: 0.01 }));
for (let b = RAMP_FROM; b < CUT_BEAT; b += 0.25) add('ticks-a', { at: beat(b), hit: 'tick-a', v: (Number.isInteger(b) ? 0.5 : 0.28) + 0.18 * (b - RAMP_FROM) / 6.75 });

// ============================================================= III. EVIDENCE CUT
// Everything above stops on the cut. What remains is the motif made clean:
// pure bell, slower, ending on the octave — no third, no guess.
add('foley', { at: cut, hit: 'paper', v: 0.7 });
(V3 ? [[18, P.D5, 0.74], [18.5, P.E5, 0.6], [19, P.A5, 0.74], [20, P.D6, 0.55]] : [[18, P.D5, 0.9], [18.5, P.E5, 0.72], [19, P.A5, 0.88], [20, P.D6, 0.62]]).forEach(([b, n, v]) => add('sig', { at: beat(b!), n: n!, v: v! }));
add('sub', { at: cut, n: 0, v: 0.7, until: CUES.findingCard, release: 1.0 });
if (!V2) add('bass', { at: cut, hit: 'bass-d', v: 0.45, offset: 0.5, attack: 0.06, until: CUES.findingCard, release: 0.4 });
[PAD.D3, PAD.A3, PAD.D4, PAD.E4].forEach((hit, i) => add('pad', { at: cut, hit, v: [0.42, 0.36, 0.3, 0.26][i]!, until: CUES.findingCard, release: 0.7 }));
// Cited findings: the motif in retrograde as three small pings.
[[21, P.A6, 0.2], [22, P.E6, 0.17], [23, P.D6, 0.15]].forEach(([b, n, v]) => add('sig', { at: beat(b!), n: n!, v: v! }));
for (let b = 20; b < 29; b++) add('ticks-a', { at: beat(b), hit: 'tick-a', v: V3 ? 0.42 : V2 ? 0.34 : 0.2 });
([[20, 'd', 0.42], [24, 'bb', 0.45], [28, 'g', 0.42]] as const).forEach(([b, root, v]) => add('pulse', { at: beat(b), hit: lub(root), v }));

// The finding card: Map B's chord returns, now consonant and documented.
add('foley', { at: CUES.findingCard, hit: 'paper', v: 0.32 });
add('bass', { at: CUES.findingCard, hit: 'bass-bb', v: 0.45, offset: 0.5, attack: 0.06, until: beat(28), release: 0.3 });
[PAD.Bb3, PAD.D4, PAD.F4, PAD.A4, PAD.C5].forEach((hit, i) => add('pad', { at: CUES.findingCard, hit, v: [0.36, 0.3, 0.28, 0.26, 0.2][i]!, until: beat(28), release: 0.5 }));
// KNOW WHAT TO VERIFY FIRST: the amber underline holds the question tone (E, #11 over Bb).
add('amber', { at: CUES.verifyTitle, n: P.E5, v: 0.42, attack: 0.3, until: CUES.titleOff, release: 0.3 });
// Minor plagal approach: G minor 6 over G.
add('bass', { at: beat(28), hit: 'bass-g', v: 0.42, offset: 0.5, attack: 0.06, until: CUES.brandCut, release: 0.12 });
[PAD.G3, PAD.Bb3, PAD.D4, PAD.E4].forEach((hit, i) => add('pad', { at: beat(28), hit, v: [0.34, 0.3, 0.28, 0.28][i]!, until: CUES.brandCut, release: 0.2 }));
add('foley', { at: CUES.brandCut - 1.1, hit: 'glass-reverse', v: 0.45 });

// ============================================================= IV. NEVER GUESS
// The amber line rises from the card into the underline: D5 → A5, landing with GUESS.
add('amber', { at: CUES.brandCut, n: P.D5, glideTo: P.A5, glideSeconds: CUES.neverGuess - CUES.brandCut - 0.03, v: 0.4, attack: 0.05, until: CUES.sendIt, release: 1.2 });
// NE-ver GUESS: the hook rhythm broadened to 0.25 s; GUESS on 21.500.
[[CUES.brandCut, P.D5], [CUES.brandCut + 0.25, P.E5], [CUES.neverGuess, P.A5]].forEach(([at, n], i) => {
  add('glass-a', { at: at!, n: n!, v: [0.9, 0.76, 1][i]! });
  add('sig', { at: at!, n: n! + 12, v: (V3 ? [0.58, 0.5, 0.72] : [0.45, 0.38, 0.55])[i]! });
});
add('pulse', { at: CUES.neverGuess, hit: lub('d'), v: 1 });
add('pulse', { at: CUES.neverGuess + 0.2, hit: dub('d'), v: 0.72 });
add('bass', { at: CUES.neverGuess, hit: 'bass-d', v: 0.82, until: 27.6, release: 0.4 });
add('sub', { at: CUES.neverGuess, n: 0, v: V3 ? 1 : 0.85 });
if (!V2) [PAD.D3, PAD.A3, PAD.Fs4, PAD.B4, PAD.E5].forEach((hit, i) => add('pad', { at: CUES.neverGuess, hit, v: [0.44, 0.38, 0.34, 0.26, 0.24][i]! }));
// V2: D6/9 spread over three octaves — the widest, fullest chord of the film.
if (V2) [PAD.D3, PAD.A3, PAD.Fs4, PAD.A4, PAD.B4, PAD.D5, PAD.E5].forEach((hit, i) => add('pad', { at: CUES.neverGuess, hit, v: [0.46, 0.4, 0.36, 0.3, 0.28, 0.24, 0.24][i]! }));
// The answer finally arrives on the call to action; the URL closes on the tonic.
add('pulse', { at: CUES.sendIt, hit: lub('d'), v: 0.78 });
add('pulse', { at: CUES.url, hit: dub('d'), v: 0.62 });
add('glass-a', { at: CUES.sendIt, n: P.Fs5, v: 0.82 });
add('sig', { at: CUES.sendIt, n: P.Fs5, v: 0.5 });
add('sig', { at: CUES.url, n: P.D6, v: 0.72 });
add('glass-a', { at: CUES.url, n: P.D6, v: 0.45 });
add('pulse', { at: 25.6, hit: lub('d'), v: 0.34 });
add('pulse', { at: 25.8, hit: dub('d'), v: 0.24 });

// ============================================================= V3 GLINT
// One crystalline accent per picture hit: D/A colour, F/C (Map B's colour) at the disagreement.
if (V3) ([
  [CUES.start, 0, 0.55], [CUES.unitLands, 0, 0.42], [CUES.sourceASeats, 0, 0.36], [CUES.disagree, 3, 0.6],
  [cut, 0, 0.62], [CUES.briefEstablished, 0, 0.22], [CUES.findingCard, -4, 0.22], [CUES.brandCut, 0, 0.3],
  [CUES.neverGuess, 0, 0.75], [CUES.sendIt, 0, 0.42], [CUES.url, 7, 0.5],
] as const).forEach(([at, n, v]) => add('glint', { at, n, v }));

// ------------------------------------------------------------- mix
type Effect = Record<string, number | string>;
interface TrackSpec { id: string; description: string; instrument: Record<string, string>; gainDb: number; pan?: number; effects: Effect[]; gainPoints?: [number, number, boolean?][]; panPoints?: [number, number, boolean?][] }
const fadeOut: [number, number, boolean?][] = [[26.6, 0, true], [27.95, -60]];
const relative = (gain: number, points: [number, number, boolean?][]) => points.map(([t, v, lin]) => [t, v === -60 ? -60 : gain + v, lin] as [number, number, boolean?]);
const reverb = (roomSize: number, decaySeconds: number, wet: number): Effect => ({ type: 'reverb', roomSize, decaySeconds, wet });
const specs: TrackSpec[] = [
  { id: 'pulse', description: 'Heartbeat LUB-DUB on D (Map A) and Bb (Map B): the PermitPulse rhythmic identity.', instrument: { type: 'drumkit', kit: 'assets/permitpulse/pulse.kit.json' }, gainDb: V2 ? -7 : -4,
    effects: [{ type: 'highpass', frequencyHz: 28 }, { type: 'saturation', driveDb: V2 ? 5 : 3, mix: V2 ? 0.4 : 0.3 }], gainPoints: relative(V2 ? -7 : -4, fadeOut) },
  { id: 'bass', description: 'Deep controlled analog bass; glides with Map B; alternates the two grounds under the camera move.', instrument: { type: 'drumkit', kit: 'assets/permitpulse/bass.kit.json' }, gainDb: V2 ? -11 : -8,
    effects: [{ type: 'highpass', frequencyHz: V2 ? 38 : 30 }, { type: 'lowpass', frequencyHz: 2400 }, { type: 'saturation', driveDb: V2 ? 6 : 4, mix: V2 ? 0.35 : 0.25 }], gainPoints: relative(V2 ? -11 : -8, fadeOut) },
  { id: 'sub', description: 'Controlled D1 sub: hook, evidence cut, brand bloom.', instrument: { type: 'sampler', sample: 'assets/permitpulse/sub-sine.wav' }, gainDb: V2 ? -10 : -8,
    effects: [{ type: 'highpass', frequencyHz: 24 }], gainPoints: relative(V2 ? -10 : -8, fadeOut) },
  { id: 'glass-a', description: 'Map A: glass motif D-E-A answered by F#.', instrument: { type: 'sampler', sample: 'assets/permitpulse/glass-a.wav' }, gainDb: V2 ? -4.5 : -7, pan: V2 ? -0.25 : -0.15,
    effects: [{ type: 'highpass', frequencyHz: 180 }, reverb(0.55, 2.2, 0.22)],
    gainPoints: relative(V2 ? -4.5 : -7, [[CUES.cameraMove, -1, true], [cut - 0.05, 2], [cut, 0], ...(V3 ? [[CUES.brandCut, 1.5]] as [number, number][] : []), ...fadeOut]) },
  { id: 'metal-b', description: 'Map B: the same motif in darker metal, off-grid, answered by F natural.', instrument: { type: 'sampler', sample: 'assets/permitpulse/metal-b.wav' }, gainDb: V2 ? -6 : -8, pan: V2 ? 0.25 : 0.2,
    effects: [{ type: 'highpass', frequencyHz: 200 }, reverb(0.5, 1.8, 0.2)],
    gainPoints: relative(V2 ? -6 : -8, [[CUES.cameraMove, -1, true], [cut - 0.05, 2], [cut, 0]]) },
  { id: 'sig', description: 'The clean evidence voice: the motif without beating or third; brand octave.', instrument: { type: 'sampler', sample: 'assets/permitpulse/sig-bell.wav' }, gainDb: V2 ? -4 : -6,
    effects: [{ type: 'highpass', frequencyHz: 220 }, { type: 'delay', timeMs: 333, wet: 0.12 }, reverb(0.7, 2.8, 0.24)], gainPoints: relative(V2 ? -4 : -6, V3 ? [[CUES.brandCut, 1.5], ...fadeOut] : fadeOut) },
  { id: 'pad', description: 'Bowed-glass harmony: D add9 → Bbmaj7 → D/F#/Bb conflict → D sus2 → Bbmaj9 → Gm6 → D6/9.', instrument: { type: 'drumkit', kit: 'assets/permitpulse/pad.kit.json' }, gainDb: -13,
    effects: [{ type: 'highpass', frequencyHz: 110 }, { type: 'lowpass', frequencyHz: 5200 }, reverb(0.8, 3.2, 0.28)],
    gainPoints: relative(-13, V2 ? [[CUES.cameraMove, 0, true], [cut - 0.05, 6], [cut, 0], [CUES.neverGuess - 0.01, 0], [CUES.neverGuess, 2.5], ...fadeOut] : [[CUES.cameraMove, 0, true], [cut - 0.05, 3], [cut, 0], ...fadeOut]) },
  { id: 'amber', description: 'The amber evidence line: boundary trace, verify underline, rising brand line.', instrument: { type: 'sampler', sample: 'assets/permitpulse/amber-tone.wav' }, gainDb: V2 ? -10 : -11,
    effects: [{ type: 'highpass', frequencyHz: 200 }, reverb(0.6, 2.4, 0.25)], gainPoints: relative(V2 ? -10 : -11, fadeOut) },
  { id: 'ticks-a', description: 'Map A precise escapement ticks; soft research clock after the cut.', instrument: { type: 'drumkit', kit: 'assets/permitpulse/ticks.kit.json' }, gainDb: V3 ? -6 : V2 ? -9 : -15, pan: V2 ? -0.35 : -0.25,
    effects: [{ type: 'highpass', frequencyHz: 450 }, reverb(0.3, 0.7, 0.1)], gainPoints: relative(V3 ? -6 : V2 ? -9 : -15, V2 ? [[CUES.cameraMove, 0, true], [cut - 0.05, 6], [cut, -6]] : [[CUES.cameraMove, 0, true], [cut - 0.05, 3], [cut, -4]]) },
  { id: 'ticks-b', description: 'Map B ratchet on the dotted-eighth grid (3 against 4).', instrument: { type: 'drumkit', kit: 'assets/permitpulse/ticks.kit.json' }, gainDb: V3 ? -7.5 : V2 ? -10 : -15, pan: V2 ? 0.35 : 0.3,
    effects: [{ type: 'highpass', frequencyHz: 500 }, reverb(0.3, 0.7, 0.1)], gainPoints: relative(V3 ? -7.5 : V2 ? -10 : -15, [[CUES.cameraMove, 0, true], [cut - 0.05, V2 ? 6 : 3]]) },
  ...(V3 ? [{ id: 'glint', description: 'V3: crystalline accent on each picture hit (small-speaker presence).', instrument: { type: 'sampler', sample: 'assets/permitpulse/glint.wav' }, gainDb: -9,
    effects: [{ type: 'highpass', frequencyHz: 1200 }, reverb(0.6, 1.8, 0.22)], gainPoints: relative(-9, fadeOut) }] : []),
  { id: 'foley', description: 'Tabletop: unit lands, plates seat, Map B slides in, the editorial paper cut, the inhale.', instrument: { type: 'drumkit', kit: 'assets/permitpulse/foley.kit.json' }, gainDb: V2 ? -7 : -8,
    effects: [{ type: 'highpass', frequencyHz: 40 }, reverb(0.35, 0.9, 0.12)], panPoints: [[CUES.sourceBReveal, 0.55, true], [CUES.disagree, 0]] },
];

// ------------------------------------------------------------- build
/** Repitched struck voices are gated to a musical ring (keeps the interpolation budget sane). */
const RING: Record<string, number> = { 'glass-a': 2.4, 'metal-b': 2.0, sig: 2.6, glint: 0.7 };
function engineNote(track: string, raw: Note, kit: boolean): Record<string, unknown> {
  const ring = RING[track];
  const n: Note = ring && raw.until === undefined ? { ...raw, until: Math.min(CUES.end, raw.at + ring), release: 0.9 } : raw;
  const out: Record<string, unknown> = { start: position(n.at) };
  if (kit) out.pitch = n.hit;
  out.velocity = round6(Math.min(1, Math.max(0.01, n.v)));
  if (n.n !== undefined && n.n !== 0) out.playbackRate = rate(n.n);
  if (n.offset !== undefined) out.offsetSeconds = n.offset;
  if (n.glideTo !== undefined) out.glide = { to: rate(n.glideTo), duration: fraction(n.glideSeconds!) };
  if (n.until !== undefined) {
    if (n.until <= n.at) throw new Error(`${track}: gate before onset at ${n.at}`);
    out.gate = fraction(n.until - n.at);
  }
  if (n.attack !== undefined || n.release !== undefined) out.envelope = { attackSeconds: round6(n.attack ?? 0.001), releaseSeconds: round6(n.release ?? 0.005) };
  if (n.choke) out.chokeGroup = n.choke;
  return out;
}
const lane = (points: [number, number, boolean?][]) => points.map(([t, v, lin]) => ({ at: { seconds: round6(t) }, value: round6(v), ...(lin ? { transition: 'linear' } : {}) }));

const project = {
  formatVersion: 1,
  title: `PermitPulse - The Maps Disagree (${version.toUpperCase()})`,
  description: 'Original 28-second score for the PermitPulse commercial THE MAPS DISAGREE. Picture-locked: 28.000 s, 60 fps. Generated by score/compose.ts; container tempo 120 BPM (one tick = 1/1920 s), musical tempo map 75 → 90 → 100 BPM lives in the generator.',
  bpm: 120, timeSignature: '4/4', key: 'D major', bars: BARS,
  render: { duration: { seconds: CUES.end }, tail: 'auto' },
  master: { gainDb: V3 ? 6 : V2 ? 1 : 0, effects: [{ type: 'compressor', thresholdDb: V2 ? -18 : -16, ratio: 2, attackMs: 25, releaseMs: 220 }] },
  tracks: specs.map(spec => {
    const kit = spec.instrument.type === 'drumkit';
    const list = (tracks[spec.id] ?? []).slice().sort((a, b) => a.at - b.at || (a.n ?? 0) - (b.n ?? 0));
    const automation: Record<string, unknown> = {};
    if (spec.gainPoints) automation.gainDb = lane(spec.gainPoints);
    if (spec.panPoints) automation.pan = lane(spec.panPoints);
    return {
      id: spec.id, description: spec.description, instrument: spec.instrument,
      clips: [{ bar: 1, pattern: 'cue' }],
      patterns: [{ id: 'cue', bars: BARS, notes: list.map(n => engineNote(spec.id, n, kit)) }],
      mix: { gainDb: spec.gainDb, ...(spec.pan ? { pan: spec.pan } : {}) },
      effects: spec.effects,
      ...(Object.keys(automation).length ? { automation } : {}),
    };
  }),
};

/** Compact JSON: structure indented, one note / automation point per line. */
function serialize(value: unknown, indent = ''): string {
  if (Array.isArray(value)) {
    if (value.every(v => typeof v !== 'object' || v === null || (!Array.isArray(v) && Object.values(v).every(x => typeof x !== 'object' || (x !== null && !Array.isArray(x) && Object.values(x).every(y => typeof y !== 'object'))))))
      return value.length ? `[\n${value.map(v => `${indent}  ${JSON.stringify(v)}`).join(',\n')}\n${indent}]` : '[]';
    return `[\n${value.map(v => `${indent}  ${serialize(v, indent + '  ')}`).join(',\n')}\n${indent}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.every(([, v]) => typeof v !== 'object' || v === null)) return JSON.stringify(value);
    return `{\n${entries.map(([k, v]) => `${indent}  ${JSON.stringify(k)}: ${serialize(v, indent + '  ')}`).join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(value);
}
const projectPath = join(production, 'project', `permitpulse-${version}.json`);
writeFileSync(projectPath, serialize(project) + '\n');

// Sync schedule for `daemonv12 sync`: the picture-facing hits, at exact engine frames.
const syncEvents: [string, string, number, string[]][] = [
  ['hook', 'glass-a', CUES.start, ['hook', 'heartbeat']], ['unit-lands', 'foley', CUES.unitLands, ['impact', 'motif-answer']],
  ['source-a-seats', 'foley', CUES.sourceASeats, ['glass-seat']], ['map-a-motif', 'glass-a', beat(4), ['motif']],
  ['source-b-reveal', 'bass', CUES.sourceBReveal, ['slide', 'bass-glide']], ['maps-disagree', 'metal-b', CUES.disagree, ['conflict', 'map-b-arrival']],
  ['disagree-title', 'metal-b', beat(9), ['motif-long-note']], ['amber-trace', 'amber', CUES.amberTraceIn, ['amber-line', 'glide']],
  ['camera-move', 'bass', CUES.cameraMove, ['accelerando']], ['tempo-plateau', 'bass', beat(RAMP_TO), ['tempo-90']],
  ['evidence-cut', 'sig', cut, ['hard-cut', 'transformation']], ['brief-established', 'sig', CUES.briefEstablished, ['motif-octave', 'clock']],
  ['finding-card', 'pad', CUES.findingCard, ['harmony-bbmaj9']], ['verify-underline', 'amber', CUES.verifyTitle, ['amber-line']],
  ['plagal-approach', 'pad', beat(28), ['harmony-gm6']], ['brand-cut', 'glass-a', CUES.brandCut, ['never']],
  ['never-guess', 'glass-a', CUES.neverGuess, ['guess', 'resolution', 'heartbeat']], ['send-it', 'pulse', CUES.sendIt, ['lub', 'answer-f-sharp']],
  ['url', 'pulse', CUES.url, ['dub', 'tonic']],
];
const schedule = {
  sampleRate: 44100, fps: { numerator: 60, denominator: 1 },
  source: { repository: 'mataindustries/daemonv12', path: `productions/permitpulse-maps-disagree/project/permitpulse-${version}.json`, generator: 'productions/permitpulse-maps-disagree/score/compose.ts' },
  events: syncEvents.map(([id, track, seconds, roles], index) => ({
    sampleFrame: frameOfTick(ticks(seconds)), trackId: track, eventId: id, velocity: 1, visualRoles: roles,
    source: { index, pictureSeconds: round6(seconds), engineTick: ticks(seconds) },
  })),
};
writeFileSync(join(production, 'score', `sync-schedule-${version}.json`), JSON.stringify(schedule, null, 2) + '\n');

const counts = specs.map(s => `${s.id}:${(tracks[s.id] ?? []).length}`).join(' ');
console.log(`${version}: T1=${T1.toFixed(3)} BPM, ramp ends ${(CUES.cameraMove + rampSeconds(T1)).toFixed(3)} s; ${counts}`);
console.log(`beats: b4=${beat(4).toFixed(3)} b8.5=${beat(8.5).toFixed(3)} b12=${beat(12).toFixed(3)} b16=${beat(16).toFixed(3)} b18=${beat(18).toFixed(4)} b20=${beat(20).toFixed(3)} b24=${beat(24).toFixed(3)} b28=${beat(28).toFixed(3)} b30=${beat(30).toFixed(3)}`);
