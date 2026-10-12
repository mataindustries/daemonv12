#!/usr/bin/env node
// Per-bar evidence for a DaemonV12 WAV: RMS, peak, and spectral band shares.
// Read-only diagnostic. Usage: node section-analysis.mjs <wav> [--bpm 130] [--bars 15] [--json out.json]
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const file = args[0];
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const bpm = Number(opt('--bpm', 130));
const bars = Number(opt('--bars', 15));
const jsonOut = opt('--json', null);

// Minimal RIFF/WAVE PCM16 reader. Returns interleaved left/right as mono mid and per-channel arrays.
function readWav(path) {
  const buf = readFileSync(path);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not WAVE');
  let off = 12;
  let fmt = null;
  let data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === 'fmt ') fmt = { channels: buf.readUInt16LE(body + 2), rate: buf.readUInt32LE(body + 4), bits: buf.readUInt16LE(body + 14) };
    if (id === 'data') data = buf.subarray(body, body + size);
    off = body + size + (size & 1);
  }
  if (!fmt || !data || fmt.bits !== 16) throw new Error('unsupported WAV');
  const frames = Math.floor(data.length / (2 * fmt.channels));
  const ch = Array.from({ length: fmt.channels }, () => new Float64Array(frames));
  for (let i = 0; i < frames; i++)
    for (let c = 0; c < fmt.channels; c++) ch[c][i] = data.readInt16LE((i * fmt.channels + c) * 2) / 32768;
  return { rate: fmt.rate, channels: ch };
}

// In-place iterative radix-2 FFT on re/im arrays of length n (power of two).
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k + len / 2] = re[i + k] - ar;
        im[i + k + len / 2] = im[i + k] - ai;
        re[i + k] += ar;
        im[i + k] += ai;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

// Average power spectrum over Hann windows; returns band energy shares (linear power).
const BANDS = [
  ['sub<120', 0, 120],
  ['low120-500', 120, 500],
  ['mid500-2k', 500, 2000],
  ['upper2k-6k', 2000, 6000],
  ['air>6k', 6000, 1e9],
];
function bandShares(x, rate, n = 8192) {
  const power = new Float64Array(n / 2);
  const hann = Float64Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
  let windows = 0;
  for (let start = 0; start + n <= x.length; start += n / 2) {
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = x[start + i] * hann[i];
    fft(re, im);
    for (let k = 0; k < n / 2; k++) power[k] += re[k] * re[k] + im[k] * im[k];
    windows++;
  }
  const bandPower = BANDS.map(() => 0);
  let total = 0;
  for (let k = 1; k < n / 2; k++) {
    const f = (k * rate) / n;
    const p = windows ? power[k] / windows : 0;
    total += p;
    BANDS.forEach(([, lo, hi], b) => {
      if (f >= lo && f < hi) bandPower[b] += p;
    });
  }
  return total > 0 ? bandPower.map((p) => p / total) : bandPower;
}

function measure(wav) {
  const { rate, channels } = readWav(wav);
  const mid = channels[0].map((v, i) => (channels.length > 1 ? (v + channels[1][i]) / 2 : v));
  const barSec = (4 * 60) / bpm;
  const rows = [];
  for (let b = 1; b <= bars; b++) {
    const s0 = Math.round((b - 1) * barSec * rate);
    const s1 = Math.min(mid.length, Math.round(b * barSec * rate));
    const seg = mid.subarray(s0, s1);
    let sq = 0;
    let pk = 0;
    for (const v of seg) {
      sq += v * v;
      if (Math.abs(v) > pk) pk = Math.abs(v);
    }
    const rms = Math.sqrt(sq / Math.max(1, seg.length));
    const shares = bandShares(seg, rate);
    rows.push({
      bar: b,
      startSec: Number(((b - 1) * barSec).toFixed(3)),
      rmsDbfs: Number((20 * Math.log10(rms + 1e-12)).toFixed(2)),
      peakDbfs: Number((20 * Math.log10(pk + 1e-12)).toFixed(2)),
      bands: Object.fromEntries(BANDS.map(([name], i) => [name, Number((shares[i] * 100).toFixed(1))])),
    });
  }
  return rows;
}

const rows = measure(file);
const header = ['bar', 'start', 'rms', 'peak', ...BANDS.map(([n]) => n)];
console.log(header.map((h) => h.padEnd(12)).join(''));
for (const r of rows) {
  console.log(
    [String(r.bar), r.startSec.toFixed(2), r.rmsDbfs.toFixed(1), r.peakDbfs.toFixed(1), ...BANDS.map(([n]) => r.bands[n].toFixed(1))]
      .map((v) => String(v).padEnd(12))
      .join(''),
  );
}
if (jsonOut) writeFileSync(jsonOut, `${JSON.stringify({ file, bpm, bars, rows }, null, 2)}\n`);
