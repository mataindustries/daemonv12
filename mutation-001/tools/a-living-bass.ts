/**
 * MUTATION A · LIVING BASS auditions (original phrase in D minor, 96 BPM, 57 % swing).
 *   node mutation-001/tools/a-living-bass.ts [auditionsRoot=mutation-001/auditions]
 * a1  transformation, dry: ten bars, one continuous take; warm West Coast groove -> growling machine; the
 *     opening riff returns in bars 9-10 in the machine state and powers down with a ratcheting dive.
 * a2  the same bass take inside a groove (HEADLINER 001 drum and FM-keys patches, unchanged all the way through,
 *     so the only thing that changes is the bass).
 * a3  states, dry: the opening two-bar riff played three times with the morph frozen at 0, 0.5 and 1.
 */
import { join } from 'node:path';
import * as I from './instruments.ts';
import { livingBass, type Art, type BNote } from './living-bass.ts';
import { Grid, pn, ramp, motionLane, type MotionSeg } from './score.ts';
import { SR, midiHz, zeros, addInto, peakOf, type Wave } from './dsp.ts';
import { deliver, writeManifest, segmentStats, sha256 } from './deliver.ts';
import { readFileSync } from 'node:fs';

const root = process.argv[2] ?? 'mutation-001/auditions', outDir = join(root, 'a-living-bass'), tmp = join(root, '..', 'build', 'tmp');
const g = new Grid(96, 0.57);

// ---------------------------------------------------------------- the phrase
/** [bar, sixteenth, length in sixteenths, pitch, flags]; flags: a accent, g ghost, s staccato, /ms slide, ^n scoop, vN:ms dive */
type Ev = [number, number, number, string, string?];
const A: Ev[] = [
  [0, 0, 5, 'D1', 'a ^3'], [0, 6, 1, 'D1', 'g'], [0, 7, 1, 'F1'], [0, 8, 3, 'A1', '/60'], [0, 12, 2, 'C2'], [0, 14, 2, 'A1', '/50'],
  [1, 0, 4, 'G1', 'a'], [1, 5, 1, 'G1', 'g'], [1, 6, 1, 'D2', 's'], [1, 7, 1, 'C2', 's'], [1, 8, 5, 'D1', '/110'], [1, 14, 2, 'F1', '/40'],
];
const A2: Ev[] = [
  [0, 0, 5, 'D1', 'a ^3'], [0, 6, 1, 'D1', 'g'], [0, 7, 1, 'F1'], [0, 8, 3, 'A1', '/60'], [0, 12, 2, 'C2'], [0, 14, 2, 'D2', '/50'],
  [1, 0, 4, 'Bb1', 'a /90'], [1, 5, 1, 'Bb1', 'g'], [1, 6, 1, 'F1', 's'], [1, 7, 1, 'G1', 's'], [1, 8, 4, 'A1', 'a'],
  [1, 12, 1, 'E2', 's'], [1, 13, 1, 'C#2', 's'], [1, 14, 2, 'A1', '/45'],
];
const B: Ev[] = [
  [0, 0, 3, 'D1', 'a'], [0, 3, 1, 'D2', 's'], [0, 4, 2, 'D1', 'g'], [0, 6, 2, 'F1', '/50'], [0, 8, 6, 'G1', 'a /70'], [0, 14, 2, 'A1', '/50'],
  [1, 0, 3, 'C2', 'a'], [1, 3, 1, 'C2', 'g'], [1, 4, 2, 'A1', 's'], [1, 6, 2, 'G1', '/45'], [1, 8, 6, 'D1', 'a /140'], [1, 14, 1, 'D2', 's'], [1, 15, 1, 'C2', 's'],
];
const B2: Ev[] = [
  [0, 0, 6, 'D1', 'a'], [0, 6, 1, 'D1', 'g'], [0, 7, 1, 'D2', 's'], [0, 8, 2, 'C2', 'a'], [0, 10, 2, 'A1', 's'], [0, 12, 4, 'G1', '/80'],
  [1, 0, 6, 'Bb1', 'a /120'], [1, 6, 2, 'A1', '/50'], [1, 8, 3, 'A1', 'a'], [1, 11, 1, 'A1', 'g'], [1, 12, 2, 'E1', 's'], [1, 14, 2, 'C#2', 'a /70'],
];
const FINAL: Ev[] = [...A.slice(0, 10), [1, 8, 12, 'D1', '/110 v7:1500']];

function toNotes(phrases: [number, Ev[]][]): BNote[] {
  const out: BNote[] = [];
  for (const [bar0, ev] of phrases) for (const [bar, st, len, name, flags = ''] of ev) {
    const t = g.at(bar0 + bar, st), full = g.at(bar0 + bar, st + len) - t, f = flags.split(' ');
    const art: Art = f.includes('a') ? 'accent' : f.includes('g') ? 'ghost' : f.includes('s') ? 'stacc' : 'normal';
    const n: BNote = { t, d: full * (art === 'stacc' ? 0.45 : art === 'ghost' ? 0.5 : 0.9), p: pn(name), art };
    for (const x of f) {
      if (x.startsWith('/')) n.slide = Number(x.slice(1)) / 1000;
      if (x.startsWith('^')) n.scoop = Number(x.slice(1));
      if (x.startsWith('v')) { const [st2, ms] = x.slice(1).split(':'); n.dive = Number(st2); n.diveSec = Number(ms) / 1000; }
    }
    out.push(n);
  }
  // a slide needs the previous note still sounding: extend it into the slide (legato)
  for (let i = 1; i < out.length; i++) if (out[i]!.slide) out[i - 1]!.d = Math.max(out[i - 1]!.d, out[i]!.t - out[i - 1]!.t + 0.02);
  return out;
}

// ---------------------------------------------------------------- the transformation
const bars = (b: number) => b * g.bar;
const morph = ramp([[0, 0], [bars(2), 0], [bars(4), 0.38], [bars(6), 0.72], [bars(7.5), 1], [bars(12), 1]]);
const MOTION: MotionSeg[] = [
  { from: 0, to: 2, div: 2, pattern: [1], shape: 'hold' },
  { from: 2, to: 4, div: 2, pattern: [1, 0.35], tau: 0.5 },                                              // eighths: breathing
  { from: 4, to: 6, div: 4, pattern: [1, .15, .55, .25, .85, .1, .45, .9, 1, .2, .6, .15, .8, .35, .5, .7], tau: 0.4 }, // swung sixteenths
  { from: 6, to: 7, div: 6, pattern: [1, .3, .55], tau: 0.45 },                                          // triplet churn
  { from: 7, to: 8, div: 6, pattern: [1, .6, .8], shape: 'ramp' },                                       // revving
  { from: 8, to: 9, div: 8, pattern: [1, .5], tau: 0.5 },                                                // thirty-seconds
  { from: 9, to: 12, div: 16, pattern: [1, .6], tau: 0.6 },                                              // rhythm becomes growl
];
const notes = toNotes([[0, A], [2, A2], [4, B], [6, B2], [8, FINAL]]);
const t0 = performance.now();
const bass = livingBass(notes, { morph, motion: motionLane(g, MOTION), seed: 11, tail: 0.6 });
console.log(`a1 bass take ${(bass.length / SR).toFixed(2)} s in ${(performance.now() - t0).toFixed(0)} ms`);

// ---------------------------------------------------------------- context: fixed drums + keys under the same take
function context(b: Wave): Wave[] {
  const len = b.length + Math.round(0.8 * SR), L = zeros(len), R = zeros(len);
  const put = (w: Wave[], t: number, gain: number, pan = 0) => {
    const off = Math.round(t * SR), l = gain * Math.min(1, 1 - pan), r = gain * Math.min(1, 1 + pan);
    addInto(L, w[0]!, off, l); addInto(R, w[1] ?? w[0]!, off, r);
  };
  const kick = I.kick({ f0: midiHz(26), decay: 0.22 }), snare = I.snare({ clap: 0.55 }), hat = I.hat(0.022, 0.12), open = I.hat(0.24, 0.8, 0.95, 53);
  const nk = 1 / peakOf(kick), ns = 1 / peakOf(snare), nh = 1 / peakOf(hat), no = 1 / peakOf(open);
  const chords: Record<string, number[]> = { Dm9: [53, 57, 60, 64], Gm9: [58, 62, 65, 69], Bbmaj7: [58, 62, 65, 69], A7b9: [55, 61, 64, 70] };
  const prog: [string, string?][] = [['Dm9'], ['Gm9'], ['Dm9'], ['Bbmaj7', 'A7b9'], ['Dm9'], ['Gm9'], ['Dm9'], ['Bbmaj7', 'A7b9'], ['Dm9'], ['Gm9']];
  const keyCache = new Map<string, Wave[]>(), keys = (c: string, l: number, v: number) => {
    const id = `${c}:${l}:${v}`; let w = keyCache.get(id); if (!w) { w = I.epChord(chords[c]!, l, v, 171); keyCache.set(id, w); } return w;
  };
  for (let bar = 0; bar < 10; bar++) {
    const odd = bar % 2 === 1;
    for (const [st, v] of (odd ? [[0, 1], [3, 0.55], [10, 0.9], [15, 0.5]] : [[0, 1], [6, 0.8], [10, 0.9]]) as [number, number][]) put(kick, g.at(bar, st), 0.8 * v * nk);
    for (const st of [4, 12]) put(snare, g.at(bar, st), 0.52 * ns);
    for (let st = 0; st < 16; st++) {
      if (odd && st === 14) { put(open, g.at(bar, st), 0.13 * no, 0.3); continue; }
      put(hat, g.at(bar, st), [0.2, 0.08, 0.14, 0.08][st % 4]! * nh, 0.3);
    }
    const [c1, c2] = prog[bar]!;
    put(keys(c1, c2 ? 1.2 : 2.3, 0.7), g.at(bar, 0), 0.38);
    if (c2) put(keys(c2, 1.2, 0.7), g.at(bar, 8), 0.38); else put(keys(c1, 0.35, 0.5), g.at(bar, 10), 0.3);
  }
  put(kick, g.at(10, 0), 0.8 * nk); put(keys('Dm9', 2.3, 0.6), g.at(10, 0), 0.34);
  addInto(L, b, 0, 0.62 / peakOf([b])); addInto(R, b, 0, 0.62 / peakOf([b]));
  return [L, R];
}

// ---------------------------------------------------------------- states: the same two bars, morph frozen
function states(): Wave {
  const riff = toNotes([[0, A]]), gap = Math.round(0.6 * SR);
  const takes = ([[0, [{ from: 0, to: 9, div: 2, pattern: [1], shape: 'hold' }]], [0.5, [MOTION[2]!].map(s => ({ ...s, from: 0, to: 9 }))], [1, [MOTION[3]!].map(s => ({ ...s, from: 0, to: 9 }))]] as [number, MotionSeg[]][])
    .map(([m, mo]) => livingBass(riff, { morph: () => m, motion: motionLane(g, mo), seed: 11, tail: 0.5 }));
  const out = zeros(takes.reduce((a, w) => a + w.length + gap, 0)); let off = 0;
  for (const w of takes) { addInto(out, w, off, 1 / peakOf(takes)); off += w.length + gap; }
  return out;
}

const a3 = states();
const files = [
  deliver(outDir, 'a1-living-bass-transformation-dry', [bass], 'transformation, dry (mono)', tmp),
  deliver(outDir, 'a2-living-bass-transformation-context', context(bass), 'transformation inside a fixed drum + keys groove (stereo)', tmp),
  deliver(outDir, 'a3-living-bass-states-dry', [a3], 'opening riff three times: morph 0, 0.5, 1 (mono)', tmp),
];
const segs: [string, number, number][] = [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]].map(([a, b]) => [`bars ${a}-${b}`, bars(a! - 1), bars(b!)]);
const stateLen = (a3.length / SR) / 3;
const tools = ['dsp.ts', 'instruments.ts', 'score.ts', 'living-bass.ts', 'deliver.ts', 'a-living-bass.ts']
  .map(f => ({ file: `mutation-001/tools/${f}`, sha256: sha256(readFileSync(new URL(f, import.meta.url))) }));
writeManifest(root, 'A-living-bass', {
  title: 'LIVING BASS', key: 'D minor', bpm: g.bpm, swing: g.swing, command: 'node mutation-001/tools/a-living-bass.ts',
  node: process.version, generator: tools,
  measurements: {
    note: 'Plain signal measurements of the dry renders (RMS re file peak, spectral centroid, energy share above 150 Hz). Not quality scores and not listening impressions.',
    a1PerSection: segmentStats(bass, segs, 150),
    a3PerState: segmentStats(a3, [['morph 0', 0, stateLen], ['morph 0.5', stateLen, 2 * stateLen], ['morph 1', 2 * stateLen, 3 * stateLen]], 150),
  },
}, files, 'a-living-bass');
for (const f of files) console.log(`${f.file.padEnd(44)} ${f.seconds.toFixed(2)} s ch${f.channels} ${f.lufs} LUFS LRA ${f.lra} TP ${f.truePeakDb} dBTP ${f.note ?? ''}`);
console.table(segmentStats(bass, segs, 150));
