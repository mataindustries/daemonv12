#!/usr/bin/env node
// Objective checks on generated source WAVs (no listening implied): tuning error in cents
// for pitched hits, and the share of energy in bands a phone speaker can reproduce.
//
//   node experiments/thingmania-ost/tools/inspect-palette.mjs <audition-dir>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { noteFreq } from './dsp.mjs';

export function readWav(path) {
  const b = readFileSync(path);
  const ch = b.readUInt16LE(22), n = b.readUInt32LE(40) / (2 * ch);
  const chans = Array.from({ length: ch }, () => new Float64Array(n));
  for (let i = 0, o = 44; i < n; i++) for (let c = 0; c < ch; c++, o += 2) chans[c][i] = b.readInt16LE(o) / 32768;
  return chans;
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

export const BANDS = [['sub<120', 20, 120], ['lowmid120-500', 120, 500], ['mid500-2k', 500, 2000], ['upper2k-6k', 2000, 6000], ['high>6k', 6000, 22050]];
// Energy share per band over the whole signal (mono sum), via 8192-point Hann frames.
export function bandShares(mono, sr = 44100) {
  const N = 8192, e = BANDS.map(() => 0);
  for (let s = 0; s + 1 < mono.length || s === 0; s += N / 2) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N && s + i < mono.length; i++) re[i] = mono[s + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
    fft(re, im);
    for (let k = 1; k < N / 2; k++) {
      const hz = k * sr / N, p = re[k] ** 2 + im[k] ** 2;
      BANDS.forEach(([, lo, hi], j) => { if (hz >= lo && hz < hi) e[j] += p; });
    }
    if (s + N >= mono.length) break;
  }
  const tot = e.reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(BANDS.map(([name], j) => [name, Number((e[j] / tot).toFixed(3))]));
}

// Normalized-autocorrelation pitch over a steady window, refined by parabolic interpolation.
export function pitchHz(x, from, len, lo = 30, hi = 2500, sr = 44100) {
  const seg = x.subarray(from, from + len);
  let best = 0, bestLag = 0;
  const r = (lag) => {
    let s = 0, a = 0, b = 0;
    for (let i = 0; i + lag < seg.length; i++) { s += seg[i] * seg[i + lag]; a += seg[i] ** 2; b += seg[i + lag] ** 2; }
    return s / Math.sqrt(a * b || 1);
  };
  const minLag = Math.floor(sr / hi), maxLag = Math.ceil(sr / lo);
  const vals = [];
  for (let lag = minLag; lag <= maxLag; lag++) vals[lag] = r(lag);
  // first peak within 90% of the global maximum avoids octave errors
  const gmax = Math.max(...vals.slice(minLag));
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (vals[lag] > 0.9 * gmax && vals[lag] >= vals[lag - 1] && vals[lag] >= vals[lag + 1]) { bestLag = lag; best = vals[lag]; break; }
  }
  if (!bestLag) return null;
  const [a, b, c] = [vals[bestLag - 1], vals[bestLag], vals[bestLag + 1]];
  const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
  return { hz: sr / (bestLag + shift), clarity: Number(best.toFixed(3)) };
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const dir = process.argv[2];
  const palette = JSON.parse(readFileSync(join(dir, 'assets', 'palette.json'), 'utf8'));
  const rows = [];
  for (const k of palette.kits) {
    const kitDir = join(dir, k.kit.replace(/kit\.json$/, ''));
    for (const s of k.samples) {
      const ch = readWav(join(kitDir, s.file));
      const mono = ch[0].map((v, i) => (ch.length > 1 ? (v + ch[1][i]) / 2 : v));
      const row = { file: `${k.kit.replace('/kit.json', '')}/${s.file}`, tuning: s.tuning, bands: bandShares(mono) };
      const note = /^([A-G](#|b)?-?\d)$/.exec(String(s.tuning).split(' ')[0]);
      if (note && !/drip/.test(s.name)) {
        const target = noteFreq(note[1]);
        const win = Math.round(0.12 * 44100), from = Math.min(Math.round(0.08 * 44100), Math.max(0, mono.length - win - 1));
        const p = pitchHz(mono, from, win, target / 1.6, target * 1.6);
        if (p) Object.assign(row, { targetHz: Number(target.toFixed(2)), measuredHz: Number(p.hz.toFixed(2)), cents: Number((1200 * Math.log2(p.hz / target)).toFixed(1)), clarity: p.clarity });
      }
      row.phoneShare = Number((1 - row.bands['sub<120']).toFixed(3));
      rows.push(row);
    }
  }
  writeFileSync(join(dir, 'analysis', 'palette-inspection.json'), JSON.stringify({ method: 'autocorrelation pitch 80-200 ms; band shares of mono energy (8192 Hann FFT)', rows }, null, 1) + '\n');
  for (const r of rows) console.log(r.file.padEnd(28), String(r.cents ?? '').padStart(6), 'c', JSON.stringify(r.bands));
}
