/**
 * MUTATION B · IMPOSSIBLE VOICE auditions (original phrases in B minor, 78 BPM, three voices).
 *   node mutation-001/tools/b-impossible-voice.ts [auditionsRoot=mutation-001/auditions]
 * b1  transformation, dry (voices + their glass halo, no room): four phrases. 1 hums open into a restrained line;
 *     2 answers and a second voice grows out of unison; 3 is the transformation (a third, giant-throated voice, the
 *     overtone melody, split formants, bending harmonics); 4 returns phrase 1 sung by the alien and evaporates.
 * b2  the same performance in a fixed context: FDN hall, Living Bass (warm, unchanged code) on roots, heartbeat pulse.
 * b3  states, dry: phrase 1 sung three times with the morph frozen at 0, 0.5 and 1.
 */
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import * as I from './instruments.ts';
import { impossibleVoice, glassHalo, type VNote, type VowelName, type Breath, type VoiceOpts } from './impossible-voice.ts';
import { livingBass, type BNote } from './living-bass.ts';
import { Grid, pn, ramp } from './score.ts';
import { steps, shifted } from './lanes.ts';
import { SR, midiHz, zeros, addInto, peakOf, fdnReverb, type Wave } from './dsp.ts';
import { deliver, writeManifest, segmentStats, sha256 } from './deliver.ts';

const root = process.argv[2] ?? 'mutation-001/auditions', outDir = join(root, 'b-impossible-voice'), tmp = join(root, '..', 'build', 'tmp');
const g = new Grid(78), at = (beat: number) => beat * g.beat;

// ---------------------------------------------------------------- score
/** [beat, beats, pitch, vowel, flags]; flags: >vowel drift, /ms slide, ^semis scoop, !semis cry, \semis fall, vN velocity, x detached */
type E = [number, number, string, VowelName, string?];
function sing(ev: E[], shift = 0): VNote[] {
  return ev.map(([b, len, p, vw, flags = '']) => {
    const f = flags.split(' ').filter(Boolean);
    const n: VNote = { t: at(b + shift), d: f.includes('x') ? at(len) * 0.8 : at(len) - 0.02, p: pn(p), vowel: vw };
    for (const x of f) {
      const k = x[0], v = x.slice(1);
      if (k === '>') n.to = v as VowelName; else if (k === '/') n.slide = Number(v) / 1000; else if (k === '^') n.scoop = Number(v);
      else if (k === '!') n.cry = Number(v); else if (k === '\\') n.fall = Number(v); else if (k === 'v') n.v = Number(v);
    }
    return n;
  });
}
const P1: E[] = [
  [1, 1.5, 'B4', 'mm', '>oo ^0.5 v0.6'], [2.5, 0.5, 'A4', 'oo', 'v0.55'], [3, 1, 'F#4', 'oo', '>oh v0.6'],
  [4, 2.5, 'D5', 'oh', '>ah /110 v0.78'], [6.5, 0.5, 'C#5', 'ah', '>oh v0.62'], [7, 0.85, 'B4', 'oh', '>oo v0.5'],
];
const P2: E[] = [
  [8.5, 0.5, 'F#4', 'oh', 'v0.55'], [9, 1, 'G4', 'oh', '>ah v0.62'], [10, 0.5, 'A4', 'ah', 'v0.64'], [10.5, 0.5, 'B4', 'ah', 'v0.68'],
  [11, 2, 'E5', 'ah', '>aw !1.1 v0.85'], [13, 1, 'D5', 'aw', '>oh /90 v0.72'], [14, 0.5, 'C#5', 'oh', 'v0.64'],
  [14.5, 0.5, 'A4', 'oh', '>uh v0.58'], [15, 0.85, 'F#4', 'uh', '>oo \\0.8 v0.52'],
];
const P3: E[] = [
  [16.5, 0.5, 'B4', 'oo', 'v0.6'], [17, 1.5, 'D5', 'oh', '>ah /100 v0.7'], [18.5, 0.5, 'E5', 'ah', 'v0.74'],
  [19, 2, 'F#5', 'ah', '>eh !1 v0.88'], [21, 0.5, 'E5', 'eh', '>ah v0.72'], [21.5, 0.5, 'D5', 'ah', 'v0.68'],
  [22, 1.5, 'C#5', 'ah', '>oh v0.66'], [23.5, 0.75, 'F#4', 'oh', '>oo /140 v0.55'],
];
const P4: E[] = [ // phrase 1 returns; the last note holds and evaporates
  [25, 1.5, 'B4', 'mm', '>oo ^0.5 v0.62'], [26.5, 0.5, 'A4', 'oo', 'v0.56'], [27, 1, 'F#4', 'oo', '>oh v0.6'],
  [28, 2.5, 'D5', 'oh', '>ah /110 v0.78'], [30.5, 0.5, 'C#5', 'ah', '>oh v0.62'], [31, 3, 'B4', 'oh', '>oo v0.58'],
];
const V2: E[] = [ // grows out of unison with the lead, then leans away
  [9, 1, 'G4', 'oh', '>ah v0.45'], [10, 1, 'F#4', 'ah', '/150 v0.45'], [11, 0.75, 'E5', 'ah', 'v0.5'], [11.75, 1.25, 'B4', 'ah', '>aw /250'],
  [13, 1, 'A4', 'aw', '>oh /120'], [14, 2, 'F#4', 'oh', '>oo /120 v0.4'],
  [17, 2, 'B4', 'oh', '>ah v0.45'], [19, 0.6, 'F#5', 'ah', 'v0.5'], [19.6, 1.4, 'D5', 'ah', '>eh /300'], [21, 1, 'B4', 'eh', '>ah /120'],
  [22, 2, 'A#4', 'ah', '>oh /120'],
  [25, 2, 'F#4', 'mm', '>oo v0.42'], [27, 1, 'D4', 'oo', '/150'], [28, 2.5, 'B4', 'oh', '>ah /200'], [30.5, 0.5, 'A4', 'ah', '/100'],
  [31, 3, 'F#4', 'oh', '>oo /150 v0.4'],
];
const V3: E[] = [ // the giant-throated low voice
  [16, 4, 'B3', 'oo', '>oh v0.4'], [20, 4, 'A#3', 'oh', '>oo /400'], [24.5, 3.5, 'B3', 'mm', '>oo v0.42'],
  [28, 3, 'G3', 'oo', '>oh /350'], [31, 3, 'B3', 'oh', '>oo /300'],
];
// overtone-melody lane (harmonic numbers), relative to a phrase-1 start at beat 0
const OT1: [number, number][] = [[0, 4], [1, 4], [1.75, 6], [2.5, 4], [3, 6], [3.5, 8], [4, 3], [4.6, 4], [5.2, 5], [5.8, 6], [6.2, 4], [6.5, 4], [7, 6], [8, 8], [9, 6], [9.6, 4]];
const OT3: [number, number][] = [[16.5, 4], [17.8, 3], [19, 2], [19.7, 3], [20.4, 4], [21, 3], [21.5, 4], [22.8, 3], [23.5, 6]];
const overtone = steps([[0, 4], ...OT3, ...OT1.map(([b, h]) => [b + 24, h] as [number, number])].map(([b, h]) => [at(b), h]), 0.07);
const breaths: Breath[] = [
  { t: at(0.3), d: at(0.6), kind: 'in', v: 0.5 }, { t: at(7.95), d: at(0.45), kind: 'in', v: 0.4 },
  { t: at(15.95), d: at(0.5), kind: 'in', v: 0.45 }, { t: at(24.3), d: at(0.65), kind: 'in', v: 0.55 }, { t: at(34), d: at(1.6), kind: 'out', v: 0.45 },
];
const morph = ramp([[0, 0], [at(11), 0], [at(16), 0.18], [at(24), 0.66], [at(28), 0.92], [at(30), 1], [at(40), 1]]);
const disperse = ramp([[0, 0], [at(31.4), 0], [at(33.8), 1]]);
const HALO = [83, 86, 90, 93, 95, 97].map(midiHz); // B5 D6 F#6 A6 B6 C#7
const HALO_GAIN = 30;

interface Part { notes: VNote[]; o: VoiceOpts; pan: number; gain: number }
function perform(parts: Part[]): { mix: Wave[]; voices: Wave[] } {
  const takes = parts.map(p => ({ ...impossibleVoice(p.notes, p.o), p }));
  const len = Math.max(...takes.map(t => t.dry.length)) + Math.round(0.6 * SR), L = zeros(len), R = zeros(len), send = zeros(len);
  for (const { dry, send: s, p } of takes) {
    addInto(L, dry, 0, p.gain * Math.min(1, 1 - p.pan)); addInto(R, dry, 0, p.gain * Math.min(1, 1 + p.pan)); addInto(send, s, 0, p.gain);
  }
  const [hl, hr] = glassHalo(send, HALO, 1.1, HALO_GAIN);
  addInto(L, hl); addInto(R, hr);
  return { mix: [L, R], voices: [L.map((v, i) => v - hl[i]!), hl] };
}

const t0 = performance.now();
const common = { morph, over: { disperse } };
const b1 = perform([
  { notes: sing([...P1, ...P2, ...P3, ...P4]), o: { ...common, overtone, breaths, seed: 21, tail: 1.4 }, pan: 0, gain: 1 },
  { notes: sing(V2), o: { ...common, over: { disperse, whistle: () => 0 }, seed: 47, detune: -4, vibRate: 4.9, size: -0.08, tail: 1.4 }, pan: -0.38, gain: 0.55 },
  { notes: sing(V3), o: { ...common, over: { disperse, whistle: () => 0 }, seed: 83, detune: 3, vibRate: 4.6, size: -0.32, vibCents: 22, tail: 1.4 }, pan: 0.38, gain: 0.5 },
]);
console.log(`b1 performance ${(b1.mix[0]!.length / SR).toFixed(2)} s in ${(performance.now() - t0).toFixed(0)} ms`);

// ---------------------------------------------------------------- context: hall, Living Bass on roots, heartbeat
function context(mix: Wave[]): Wave[] {
  const len = mix[0]!.length + Math.round(0.6 * SR), L = zeros(len), R = zeros(len);
  const [wl, wr] = fdnReverb(mix[0]!, mix[1]!, { rt60: 3.2, size: 1.3, damp: 5200, predelayMs: 30, mod: 1.2, lowCut: 250, seed: 9 }, 0.6);
  addInto(L, mix[0]!); addInto(R, mix[1]!); addInto(L, wl, 0, 0.32); addInto(R, wr, 0, 0.32);
  const roots: [number, number, string, number?][] = [[0, 3.6, 'B1'], [4, 3.6, 'G1'], [8, 3.6, 'E1'], [12, 3.6, 'F#1'], [16, 3.6, 'B1'], [20, 3.6, 'F#1'], [24, 3.6, 'B1'], [28, 2.8, 'G1'], [31, 4, 'B1']];
  const bn: BNote[] = roots.map(([b, l, p]) => ({ t: at(b), d: at(l), p: pn(p), v: 0.7 }));
  const bass = livingBass(bn, { morph: () => 0.05, seed: 11, tail: 1 }), nb = 0.42 / peakOf([bass]);
  addInto(L, bass, 0, nb); addInto(R, bass, 0, nb);
  const kick = I.kick({ f0: midiHz(30), decay: 0.25, click: 0.3, drive: 1.2, start: 160 }), nk = 0.3 / peakOf(kick);
  for (let b = 0; b < 34; b += 2) for (const [o, v] of [[0, 1], [0.35, 0.55]] as [number, number][]) { addInto(L, kick[0]!, Math.round(at(b + o) * SR), v * nk); addInto(R, kick[0]!, Math.round(at(b + o) * SR), v * nk); }
  return [L, R];
}

// ---------------------------------------------------------------- states: phrase 1, morph frozen
function states(): Wave[] {
  const gap = Math.round(0.5 * SR), ot = steps(OT1.map(([b, h]) => [at(b), h]), 0.07);
  const takes = [0, 0.5, 1].map(mv => perform([{ notes: sing(P1), o: { morph: () => mv, overtone: ot, breaths: breaths.slice(0, 1), seed: 21, tail: 1.4 }, pan: 0, gain: 1 }]).mix);
  const len = takes.reduce((a, w) => a + w[0]!.length + gap, 0), L = zeros(len), R = zeros(len), k = 1 / peakOf(takes.flat());
  let off = 0; for (const [l, r] of takes) { addInto(L, l!, off, k); addInto(R, r!, off, k); off += l!.length + gap; }
  return [L, R];
}

const b3 = states();
const mono = (w: Wave[]) => w[0]!.map((v, i) => 0.5 * (v + w[1]![i]!));
const haloDb = (a: number, b: number) => { let h = 0, d = 0; for (let i = Math.round(a * SR); i < Math.round(b * SR); i++) { h += b1.voices[1]![i]! ** 2; d += b1.voices[0]![i]! ** 2; } return +(10 * Math.log10(h / d)).toFixed(1); };
const files = [
  deliver(outDir, 'b1-impossible-voice-transformation-dry', b1.mix, 'transformation, three voices + glass halo, no room (stereo)', tmp),
  deliver(outDir, 'b2-impossible-voice-transformation-context', context(b1.mix), 'same performance with hall, warm Living Bass roots and a heartbeat pulse, all fixed (stereo)', tmp),
  deliver(outDir, 'b3-impossible-voice-states-dry', b3, 'phrase 1 three times: morph 0, 0.5, 1 (stereo)', tmp),
];
const segs: [string, number, number][] = [['phrase 1', 0, at(8)], ['phrase 2', at(8), at(16)], ['phrase 3', at(16), at(24)], ['phrase 4', at(24), at(34)]];
const sl = b3[0]!.length / SR / 3;
const tools = ['dsp.ts', 'instruments.ts', 'score.ts', 'lanes.ts', 'living-bass.ts', 'impossible-voice.ts', 'deliver.ts', 'b-impossible-voice.ts']
  .map(f => ({ file: `mutation-001/tools/${f}`, sha256: sha256(readFileSync(new URL(f, import.meta.url))) }));
writeManifest(root, 'B-impossible-voice', {
  title: 'IMPOSSIBLE VOICE', key: 'B minor', bpm: g.bpm, command: 'node mutation-001/tools/b-impossible-voice.ts', node: process.version, generator: tools,
  measurements: {
    note: 'Plain signal measurements of the dry renders, mono fold-down (RMS re file peak, spectral centroid, energy share above 2 kHz; halo = glass-resonator energy relative to the voices). Not quality scores and not listening impressions.',
    b1PerPhrase: segmentStats(mono(b1.mix), segs, 2000).map((s, k) => ({ ...s, haloDb: haloDb(segs[k]![1], segs[k]![2]) })),
    b3PerState: segmentStats(mono(b3), [['morph 0', 0, sl], ['morph 0.5', sl, 2 * sl], ['morph 1', 2 * sl, 3 * sl]], 2000),
  },
}, files, 'b-impossible-voice');
for (const f of files) console.log(`${f.file.padEnd(48)} ${f.seconds.toFixed(2)} s ch${f.channels} ${f.lufs} LUFS LRA ${f.lra} TP ${f.truePeakDb} dBTP ${f.note ?? ''}`);
const mf = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')).mutations['B-impossible-voice'].measurements;
console.table(mf.b1PerPhrase); console.table(mf.b3PerState);
