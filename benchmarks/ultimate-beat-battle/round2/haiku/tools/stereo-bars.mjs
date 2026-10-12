#!/usr/bin/env node
// Per-bar stereo balance: side (L-R) versus mid (L+R) RMS, in dB. Read-only diagnostic.
// Usage: node stereo-bars.mjs <wav> [--bpm 130] [--bars 15]
import { readFileSync } from 'node:fs';
const [file, ...rest] = process.argv.slice(2);
const opt = (n, d) => (rest.includes(n) ? rest[rest.indexOf(n) + 1] : d);
const bpm = Number(opt('--bpm', 130));
const bars = Number(opt('--bars', 15));
const b = readFileSync(file);
let o = 12;
let fmt;
let data;
while (o + 8 <= b.length) {
  const id = b.toString('ascii', o, o + 4);
  const sz = b.readUInt32LE(o + 4);
  const body = o + 8;
  if (id === 'fmt ') fmt = { ch: b.readUInt16LE(body + 2), rate: b.readUInt32LE(body + 4) };
  if (id === 'data') data = b.subarray(body, body + sz);
  o = body + sz + (sz & 1);
}
const n = Math.floor(data.length / (2 * fmt.ch));
const L = new Float64Array(n);
const R = new Float64Array(n);
for (let i = 0; i < n; i++) {
  L[i] = data.readInt16LE(i * 2 * fmt.ch) / 32768;
  R[i] = data.readInt16LE(i * 2 * fmt.ch + 2) / 32768;
}
const barSec = (4 * 60) / bpm;
const rows = [];
for (let k = 1; k <= bars; k++) {
  const s0 = Math.round((k - 1) * barSec * fmt.rate);
  const s1 = Math.min(n, Math.round(k * barSec * fmt.rate));
  let m = 0;
  let s = 0;
  let corr = 0;
  let ll = 0;
  let rr = 0;
  for (let i = s0; i < s1; i++) {
    const mid = (L[i] + R[i]) / 2;
    const side = (L[i] - R[i]) / 2;
    m += mid * mid;
    s += side * side;
    corr += L[i] * R[i];
    ll += L[i] * L[i];
    rr += R[i] * R[i];
  }
  rows.push({ bar: k, sideToMidDb: Number((10 * Math.log10((s + 1e-14) / (m + 1e-14))).toFixed(1)),
    lrCorrelation: Number((corr / Math.sqrt(ll * rr + 1e-14)).toFixed(3)) });
}
console.log('bar  side/mid(dB)  L/R corr');
for (const r of rows) console.log(`${String(r.bar).padEnd(5)}${String(r.sideToMidDb).padEnd(13)}${r.lrCorrelation}`);
