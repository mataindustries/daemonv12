/**
 * MUTATION C · MECHANICAL ORCHESTRA auditions (original, A minor, 112 BPM, straight sixteenths, seeded micro-timing).
 *   node mutation-001/tools/c-mechanical-orchestra.ts [auditionsRoot=mutation-001/auditions]
 * c1  transformation, dry (12 bars): a clockwork music box (two tuned bars hocketing the theme left/right, clean tines
 *     in dotted eighths = 3 against 4, an escapement) gains a spring bass, then friction-bowed metal and buzzing tines;
 *     the bars' modes bend from a consonant tuning into an alien gong; the theme returns in bar 9 on the strange
 *     machines, the clock sprouts spring "zips", bearings rain; cadence on A.
 * c2  the same performance in a hall over a fixed half-time kick and snare (HEADLINER 001 patches).
 * c3  states, dry: the two-bar theme on bars, tines, spring and clock with the morph frozen at 0, 0.5 and 1.
 */
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import * as I from './instruments.ts';
import * as MO from './mechanical-orchestra.ts';
import { Grid, pn, ramp } from './score.ts';
import { SR, Rng, midiHz, zeros, addInto, peakOf, fdnReverb, smooth, type Wave } from './dsp.ts';
import { deliver, writeManifest, segmentStats, sha256 } from './deliver.ts';

const root = process.argv[2] ?? 'mutation-001/auditions', outDir = join(root, 'c-mechanical-orchestra'), tmp = join(root, '..', 'build', 'tmp');
const g = new Grid(112);
const FAMS = ['bars', 'tines', 'spring', 'bow', 'clock', 'bearings'] as const;
type Fam = typeof FAMS[number];

// ---------------------------------------------------------------- calibration: each family relative to a reference note
const rmsOf = (w: Wave, a = 0, b = Math.round(0.3 * SR)) => { let s = 0; const e = Math.min(b, w.length); for (let i = a; i < e; i++) s += w[i]! ** 2; return Math.sqrt(s / (e - a)); };
const REF: Record<Fam, number> = {
  bars: rmsOf(MO.malletBar(69, 0.8, 0)), tines: rmsOf(MO.tine(81, 0.8)), spring: rmsOf(MO.spring(33, 0.8, 0)),
  bow: rmsOf(MO.bowedBar(69, 1.5, 0.8, 0), Math.round(0.5 * SR), Math.round(1.5 * SR)), clock: rmsOf(MO.tick(1, false, 1), 0, Math.round(0.03 * SR)),
  bearings: rmsOf(MO.malletBar(93, 0.8, 0, { damp: 0.3, hard: 0.95 })),
};
/** Family levels in dB re each family's reference note. */
const LEVEL: Record<Fam, number> = { bars: -8, tines: -11, spring: -5, bow: -14, clock: -14, bearings: -22 };

// ---------------------------------------------------------------- score
type N = [number, string];
const THEME: N[][] = [
  [[0, 'A4'], [2, 'E5'], [4, 'C5'], [6, 'B4'], [8, 'E5'], [12, 'D5'], [14, 'C5']],
  [[0, 'B4'], [2, 'G4'], [4, 'A4'], [8, 'C5'], [10, 'B4'], [12, 'E4']],
];
const F_VAR: N[][] = [
  [[0, 'A4'], [2, 'F5'], [4, 'C5'], [6, 'B4'], [8, 'E5'], [12, 'D5'], [14, 'C5']],
  [[0, 'B4'], [2, 'G4'], [4, 'A4'], [8, 'C5'], [10, 'E5'], [12, 'G5']],
];
const D_VAR: N[][] = [
  [[0, 'A5'], [4, 'G5'], [6, 'F5'], [8, 'E5'], [12, 'C5'], [14, 'D5']],
  [[0, 'F5'], [2, 'E5'], [4, 'D5'], [6, 'C5'], [8, 'A4']],
];
const E_VAR: N[][] = [
  [[0, 'B4'], [2, 'E5'], [4, 'A5'], [6, 'G#5'], [8, 'B5'], [12, 'A5'], [14, 'F5']],
  [[0, 'E5'], [2, 'D5'], [4, 'G#4'], [6, 'B4'], [8, 'D5'], [10, 'F5'], [12, 'G#5']],
];
const MELODY = [...THEME, ...F_VAR, ...D_VAR, ...E_VAR, ...THEME, F_VAR[0]!, [[0, 'B4'], [2, 'G#4'], [4, 'A4']] as N[]];
const CHORD = ['Am', 'Am', 'F', 'F', 'Dm', 'Dm', 'E', 'E7', 'Am', 'Am', 'F', 'Am'];
const ROOT: Record<string, string> = { Am: 'A1', F: 'F1', Dm: 'D2', E: 'E1', E7: 'E1' };
const TONES: Record<string, string[]> = { Am: ['A5', 'C6', 'E6', 'B6'], F: ['F5', 'A5', 'C6', 'E6'], Dm: ['D5', 'F5', 'A5', 'E6'], E: ['E5', 'G#5', 'B5', 'D6'], E7: ['E5', 'G#5', 'D6', 'F6'] };
const BOW: [number, number, string[]][] = [[4, 2, ['D4', 'A4']], [6, 1, ['E4', 'B4']], [7, 1, ['G#4', 'D5']], [8, 2, ['A3', 'E4']], [10, 1, ['F4', 'C5']], [11, 1.5, ['A3', 'E4', 'C5']]];

interface Hit { fam: Fam; t: number; w: Wave; pan: number; gain: number }
/** The ensemble. `full` adds the spring entry at bar 3, the bowed metal, the bearings and the cadence. */
function play(melody: N[][], chord: string[], mOf: (t: number) => number, full: boolean, seed: number): Hit[] {
  const r = new Rng(seed), hits: Hit[] = [], nb = melody.length, J = (ms: number) => r.gauss() * ms / 1000;
  const add = (fam: Fam, t: number, w: Wave, pan: number, gain = 1) => hits.push({ fam, t: Math.max(0, t), w, pan, gain });
  const endStep = full ? (nb - 1) * 16 + 5 : nb * 16;
  // bars: the theme hocketed between a left and a right bar
  let k = 0;
  for (let b = 0; b < nb; b++) for (const [st, p] of melody[b]!) {
    const t = g.at(b, st) + J(4), v = 0.7 + (st % 4 === 0 ? 0.18 : 0) + 0.07 * r.bi();
    const m = mOf(t); // the strange bars ring longer; damp them a little so the hocket stays articulate
    add('bars', t, MO.malletBar(pn(p), v, m, { seed: 100 + k, damp: 0.75 - 0.2 * m, cents: 3 * r.bi() }), k % 2 ? 0.45 : -0.45); k++;
  }
  // tines: dotted eighths (3 against 4), a wave through the chord tones
  const shape = [0, 1, 2, 3, 2, 1];
  for (let s = 0, j = 0; s < endStep; s += 3, j++) {
    const b = Math.floor(s / 16), st = s % 16, t = g.at(b, st) + J(5), m = mOf(t);
    const v = (st < 3 ? 0.8 : 0.55) + 0.1 * r.bi();
    add('tines', t, MO.tine(pn(TONES[chord[b]!]![shape[j % 6]!]!), v, { buzz: 0.9 * smooth((m - 0.3) / 0.6), seed: 300 + j, cents: 4 * r.bi() }), j % 2 ? 0.3 : 0.1);
  }
  // spring bass ostinato; busier in the E bars; the cadence is one long A
  for (let b = full ? 2 : 0; b < nb; b++) {
    const pat = full && b === nb - 1 ? [[0, 0, 1]] : b === 6 || b === 7 ? [[0, 0, 1], [3, 0, 0.6], [6, 12, 0.8], [8, 10, 0.7], [11, 7, 0.7], [14, 0, 0.6]] : [[0, 0, 1], [3, 0, 0.55], [6, 12, 0.75], [10, 7, 0.7], [13, 0, 0.5]];
    for (const [st, iv, v] of pat) { const t = g.at(b, st!) + J(3); add('spring', t, MO.spring(pn(ROOT[chord[b]!]!) + iv!, v! * (0.92 + 0.08 * r.bi()), mOf(t), { seed: 500 + b * 16 + st! }), 0); }
  }
  // clock: escapement ticks on sixteenths (tock on beats 1 and 3), micro-timing, velocity, the odd missed tick;
  // as the machines turn strange each eighth also fires a tiny high spring "zip"
  const ZIP = [81, 88, 93, 84];
  for (let s = 0; s < endStep; s++) {
    const b = Math.floor(s / 16), st = s % 16;
    if (st % 4 !== 0 && r.next() < 0.05) continue;
    const t = g.at(b, st) + J(2.5), m = mOf(t), acc = [1, 0.32, 0.55, 0.32][st % 4]! * (0.88 + 0.24 * r.next());
    add('clock', t, MO.tick(acc, st % 8 === 0, 700 + s), 0.15 + 0.1 * r.bi());
    const zip = smooth((m - 0.4) / 0.5);
    if (zip > 0.01 && st % 2 === 0) add('clock', t, MO.spring(ZIP[(st / 2) % 4]!, 0.35 * acc, 1, { len: 0.35, t60: 0.3, seed: 900 + s }), 0.5 * r.bi(), 1.6 * zip);
  }
  if (full) {
    // friction: bowed metal chords from bar 5
    for (const [b, len, ps] of BOW) ps.forEach((p, i) => {
      const t = g.at(b, 0) + 0.03 * i, m = mOf(t);
      add('bow', t, MO.bowedBar(pn(p), len * g.bar - 0.05, 0.8, m, { seed: 1000 + b * 4 + i, sub: 0.85 * smooth((m - 0.55) / 0.4), subN: m > 0.88 ? 3 : 2, chatter: 0.04 + 0.3 * m, attack: 0.5 }), i % 2 ? 0.3 : -0.3);
    });
    // bearings: tiny tuned pings that thicken from bar 8 (Poisson, seeded)
    const t0 = g.at(7, 0), t1 = g.at(11, 8);
    for (let t = t0; ;) {
      t += -Math.log(1 - r.next()) / (3 + 11 * smooth((t - t0) / (t1 - t0)));
      if (t >= t1) break;
      const b = Math.min(nb - 1, Math.floor(t / g.bar)), p = pn(TONES[chord[b]!]![Math.floor(r.next() * 4)]!) + 12;
      add('bearings', t, MO.malletBar(p, 0.25 + 0.3 * r.next(), mOf(t), { damp: 0.3, hard: 0.95, seed: 2000 + Math.round(t * 1000) }), 0.8 * r.bi());
    }
  }
  return hits;
}

function mixdown(hits: Hit[], seconds: number, fadeFrom: number): { mix: Wave[]; buses: Record<Fam, Wave> } {
  const len = Math.round(seconds * SR), L = zeros(len), R = zeros(len);
  const buses = Object.fromEntries(FAMS.map(f => [f, zeros(len)])) as Record<Fam, Wave>;
  for (const h of hits) {
    const k = h.gain * Math.pow(10, LEVEL[h.fam] / 20) / REF[h.fam], off = Math.round(h.t * SR);
    addInto(L, h.w, off, k * Math.min(1, 1 - h.pan)); addInto(R, h.w, off, k * Math.min(1, 1 + h.pan)); addInto(buses[h.fam], h.w, off, k);
  }
  const a = Math.round(fadeFrom * SR);
  for (let i = a; i < len; i++) { const x = 0.5 + 0.5 * Math.cos(Math.PI * (i - a) / (len - a)); L[i] *= x; R[i] *= x; for (const f of FAMS) buses[f][i] *= x; }
  return { mix: [L, R], buses };
}

const t0 = performance.now();
const morph = ramp([[0, 0], [g.bar * 2, 0], [g.bar * 4, 0.35], [g.bar * 8, 0.72], [g.bar * 9.5, 1], [g.bar * 14, 1]]);
const c1 = mixdown(play(MELODY, CHORD, morph, true, 112), 27.6, 25.8);
console.log(`c1 ensemble rendered in ${(performance.now() - t0).toFixed(0)} ms`);

function context(mix: Wave[]): Wave[] {
  const len = mix[0]!.length, L = zeros(len), R = zeros(len);
  const [wl, wr] = fdnReverb(mix[0]!, mix[1]!, { rt60: 2.4, size: 1.1, damp: 6000, predelayMs: 18, mod: 1, lowCut: 220, seed: 12 }, 0);
  addInto(L, mix[0]!); addInto(R, mix[1]!); addInto(L, wl, 0, 0.24); addInto(R, wr, 0, 0.24);
  const kick = I.kick({ f0: midiHz(33), decay: 0.28 }), snare = I.snare({ clap: 0.4 }), nk = 0.5 / peakOf(kick), ns = 0.34 / peakOf(snare);
  const put = (w: Wave[], t: number, k: number) => { addInto(L, w[0]!, Math.round(t * SR), k); addInto(R, w[1] ?? w[0]!, Math.round(t * SR), k); };
  for (let b = 0; b < 11; b++) { for (const st of b % 2 ? [0, 7, 10] : [0, 10]) put(kick, g.at(b, st), nk); put(snare, g.at(b, 8), ns); }
  put(kick, g.at(11, 0), nk);
  return [L.slice(0, len), R.slice(0, len)];
}

function states(): Wave[] {
  const gap = Math.round(0.4 * SR);
  const takes = [0, 0.5, 1].map(mv => mixdown(play(THEME, ['Am', 'Am'], () => mv, false, 112), g.bar * 2 + 1.4, g.bar * 2 + 0.6).mix);
  const len = takes.reduce((a, w) => a + w[0]!.length + gap, 0), L = zeros(len), R = zeros(len), k = 1 / peakOf(takes.flat());
  let off = 0; for (const [l, r] of takes) { addInto(L, l!, off, k); addInto(R, r!, off, k); off += l!.length + gap; }
  return [L, R];
}

const c3 = states();
const mono = (w: Wave[]) => w[0]!.map((v, i) => 0.5 * (v + w[1]![i]!));
const segs: [string, number, number][] = [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12]].map(([a, b]) => [`bars ${a}-${b}`, g.bar * (a! - 1), Math.min(27.6, g.bar * b!)]);
const famDb = segs.map(([label, a, b]) => {
  const row: Record<string, number | string> = { segment: label };
  for (const f of FAMS) { let s = 0; for (let i = Math.round(a * SR); i < Math.round(b * SR); i++) s += c1.buses[f][i]! ** 2; row[f] = +(10 * Math.log10(s / ((b - a) * SR) + 1e-20)).toFixed(1); }
  return row;
});
const files = [
  deliver(outDir, 'c1-mechanical-orchestra-transformation-dry', c1.mix, 'transformation, six machine families, no room (stereo)', tmp),
  deliver(outDir, 'c2-mechanical-orchestra-transformation-context', context(c1.mix), 'same performance in a hall over a fixed half-time kick and snare (stereo)', tmp),
  deliver(outDir, 'c3-mechanical-orchestra-states-dry', c3, 'two-bar theme three times: morph 0, 0.5, 1 (stereo)', tmp),
];
const sl = c3[0]!.length / SR / 3;
const tools = ['dsp.ts', 'instruments.ts', 'score.ts', 'mechanical-orchestra.ts', 'deliver.ts', 'c-mechanical-orchestra.ts']
  .map(f => ({ file: `mutation-001/tools/${f}`, sha256: sha256(readFileSync(new URL(f, import.meta.url))) }));
writeManifest(root, 'C-mechanical-orchestra', {
  title: 'MECHANICAL ORCHESTRA', key: 'A minor', bpm: g.bpm, command: 'node mutation-001/tools/c-mechanical-orchestra.ts', node: process.version, generator: tools,
  measurements: {
    note: 'Plain signal measurements of the dry renders, mono fold-down (RMS re file peak, spectral centroid, energy share above 2 kHz) and per-family RMS (dBFS, before loudness normalisation). Not quality scores and not listening impressions.',
    c1PerSection: segmentStats(mono(c1.mix), segs, 2000),
    c1FamilyRmsDb: famDb,
    c3PerState: segmentStats(mono(c3), [['morph 0', 0, sl], ['morph 0.5', sl, 2 * sl], ['morph 1', 2 * sl, 3 * sl]], 2000),
  },
}, files, 'c-mechanical-orchestra');
for (const f of files) console.log(`${f.file.padEnd(52)} ${f.seconds.toFixed(2)} s ch${f.channels} ${f.lufs} LUFS LRA ${f.lra} TP ${f.truePeakDb} dBTP ${f.note ?? ''}`);
const mf = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')).mutations['C-mechanical-orchestra'].measurements;
console.table(mf.c1PerSection); console.table(mf.c1FamilyRmsDb); console.table(mf.c3PerState);
