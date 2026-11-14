/**
 * Measurement helpers for the DAEMON//CRUSH lab. Signal statistics only: none of these is a quality score.
 * Loudness uses FFmpeg's ebur128 filter, the measurement tool the repository already relies on.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { SR, upsample, type Stereo } from './crush.ts';

const ffmpeg = process.env.DAEMONV12_FFMPEG || 'ffmpeg';
export const ampDb = (a: number) => (a > 0 ? 20 * Math.log10(a) : -Infinity);
export const dbAmp = (db: number) => Math.pow(10, db / 20);
export const round = (x: number, d = 2) => (Number.isFinite(x) ? Number(x.toFixed(d)) : x);

// ---------------------------------------------------------------- WAV
export function readWav(path: string): Stereo {
  const b = readFileSync(path);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`not a WAV file: ${path}`);
  let at = 12, fmt: { ch: number; sr: number; bits: number } | undefined;
  while (at + 8 <= b.length) {
    const id = b.toString('ascii', at, at + 4), size = b.readUInt32LE(at + 4), body = at + 8;
    if (id === 'fmt ') { if (b.readUInt16LE(body) !== 1) throw new Error('PCM only'); fmt = { ch: b.readUInt16LE(body + 2), sr: b.readUInt32LE(body + 4), bits: b.readUInt16LE(body + 14) }; }
    if (id === 'data') {
      if (!fmt || fmt.sr !== SR || (fmt.bits !== 16 && fmt.bits !== 24) || fmt.ch < 1 || fmt.ch > 2) throw new Error(`unsupported WAV format: ${path}`);
      const bytes = fmt.bits / 8, frames = Math.floor(Math.min(size, b.length - body) / (bytes * fmt.ch));
      const out: Stereo = [new Float64Array(frames), new Float64Array(frames)];
      for (let i = 0; i < frames; i++) for (let c = 0; c < 2; c++) {
        const o = body + (i * fmt.ch + Math.min(c, fmt.ch - 1)) * bytes;
        out[c]![i] = bytes === 2 ? b.readInt16LE(o) / 32768 : b.readIntLE(o, 3) / 8388608;
      }
      return out;
    }
    at = body + size + (size & 1);
  }
  throw new Error(`no data chunk: ${path}`);
}
/** Canonical 44.1 kHz stereo PCM16, plain rounding (no dither, so the bytes repeat). Returns the clipped-sample count. */
export function writeWav16(path: string, x: Stereo): number {
  const n = x[0].length, data = Buffer.alloc(n * 4), hdr = Buffer.alloc(44); let clipped = 0;
  for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) {
    const v = Math.round(x[c]![i]! * 32768);
    if (v > 32767 || v < -32768) clipped++;
    data.writeInt16LE(Math.max(-32768, Math.min(32767, v)), (i * 2 + c) * 2);
  }
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16);
  hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28);
  hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([hdr, data]));
  return clipped;
}
export function mp3(wav: string, out: string, kbps = 256) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', '-v', 'error', '-y', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', `${kbps}k`, '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', out], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg mp3: ${r.stderr}`);
}

// ---------------------------------------------------------------- level
export const gain = (x: Stereo, g: number): Stereo => [x[0].map(v => v * g), x[1].map(v => v * g)];
export function peak(x: Stereo): number { let p = 0; for (const c of x) for (let i = 0; i < c.length; i++) { const a = Math.abs(c[i]!); if (a > p) p = a; } return p; }
export function rms(x: Stereo, from = 0, to = x[0].length): number {
  let s = 0; for (const c of x) for (let i = from; i < to; i++) s += c[i]! * c[i]!;
  return Math.sqrt(s / Math.max(1, 2 * (to - from)));
}
/** Inter-sample (true) peak: the largest magnitude of the 4x oversampled waveform. */
export function truePeak(x: Stereo): number { return Math.max(peak([upsample(x[0], 4), upsample(x[1], 4)]), peak(x)); }
/** EBU R128 integrated loudness, range and true peak of a WAV file (FFmpeg ebur128). */
export function r128(wav: string): { lufs: number; lra: number; truePeakDb: number } {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', '-nostats', '-i', wav, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg ebur128: ${r.stderr}`);
  const sum = r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
  const num = (re: RegExp) => { const m = re.exec(sum); if (!m) throw new Error(`ebur128 parse: ${sum}`); return m[1] === '-inf' ? -Infinity : Number(m[1]); };
  return { lufs: num(/I:\s+(-?[\d.]+|-inf) LUFS/), lra: num(/LRA:\s+(-?[\d.]+) LU/), truePeakDb: num(/Peak:\s+(-?[\d.]+|-inf) dBFS/) };
}

// ---------------------------------------------------------------- spectrum
/** In-place radix-2 complex FFT. */
export function fft(re: Float64Array, im: Float64Array) {
  const n = re.length; if (n & (n - 1)) throw new Error('fft length must be a power of two');
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { const tr = re[i]!; re[i] = re[j]!; re[j] = tr; const ti = im[i]!; im[i] = im[j]!; im[j] = ti; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2, xr = re[b]! * cr - im[b]! * ci, xi = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - xr; im[b] = im[a]! - xi; re[a] = re[a]! + xr; im[a] = im[a]! + xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
const BH = [0.35875, 0.48829, 0.14128, 0.01168];
/** Blackman-Harris power spectrum of one window of `n` samples starting at `from`. */
export function powerSpectrum(x: Float64Array, from: number, n: number): Float64Array {
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) { const t = 2 * Math.PI * i / n; re[i] = (x[from + i] ?? 0) * (BH[0]! - BH[1]! * Math.cos(t) + BH[2]! * Math.cos(2 * t) - BH[3]! * Math.cos(3 * t)); }
  fft(re, im);
  const p = new Float64Array(n / 2 + 1); for (let k = 0; k <= n / 2; k++) p[k] = re[k]! * re[k]! + im[k]! * im[k]!;
  return p;
}
export const BANDS: [string, number, number][] = [['sub 20-60', 20, 60], ['bass 60-150', 60, 150], ['low-mid 150-500', 150, 500], ['mid 500-2k', 500, 2000], ['high 2k-8k', 2000, 8000], ['air 8k-20k', 8000, 20000]];
/** Share of total energy per band (Welch average, mid channel), in dB relative to the whole signal. */
export function bandBalance(x: Stereo): Record<string, number> {
  const n = 8192, hop = 4096, mid = x[0].map((v, i) => 0.5 * (v + x[1][i]!)), acc = new Float64Array(n / 2 + 1);
  for (let at = 0; at + n <= mid.length; at += hop) { const p = powerSpectrum(mid, at, n); for (let k = 0; k < p.length; k++) acc[k] = acc[k]! + p[k]!; }
  let total = 0; for (let k = 1; k < acc.length; k++) total += acc[k]!;
  const out: Record<string, number> = {};
  for (const [name, lo, hi] of BANDS) { let s = 0; for (let k = Math.ceil(lo * n / SR); k <= Math.floor(hi * n / SR); k++) s += acc[k]!; out[name] = round(10 * Math.log10(Math.max(1e-30, s / total)), 2); }
  return out;
}

// ---------------------------------------------------------------- transients
/**
 * For each onset: the largest sample in the first 12 ms against the RMS of the following 20..150 ms.
 * A hit that keeps its front while its body gets louder scores lower here, and one whose front was flattened
 * scores much lower. The number is gain-independent. Also the plain crest factor of each hit window.
 */
export function transientStats(x: Stereo, onsets: number[]) {
  const a12 = Math.round(0.012 * SR), b20 = Math.round(0.02 * SR), b150 = Math.round(0.15 * SR); let front = 0, crest = 0, count = 0;
  for (const o of onsets) {
    if (o + b150 > x[0].length) continue;
    let pk = 0; for (const c of x) for (let i = o; i < o + a12; i++) pk = Math.max(pk, Math.abs(c[i]!));
    front += ampDb(pk) - ampDb(rms(x, o + b20, o + b150));
    let all = 0; for (const c of x) for (let i = o; i < o + b150; i++) all = Math.max(all, Math.abs(c[i]!));
    crest += ampDb(all) - ampDb(rms(x, o, o + b150)); count++;
  }
  return { onsets: count, frontToBodyDb: round(front / Math.max(1, count)), hitCrestDb: round(crest / Math.max(1, count)) };
}

// ---------------------------------------------------------------- distortion products
const N = 65536;
export const binHz = (k: number) => k * SR / N;
function sine(k: number, amp: number, len: number): Float64Array { const y = new Float64Array(len), w = 2 * Math.PI * k / N; for (let i = 0; i < len; i++) y[i] = amp * Math.sin(w * i); return y; }
function spurScan(p: Float64Array, keep: (k: number) => boolean, ref: number) {
  // anything that is neither a wanted line (+/- 6 bins of window leakage) nor DC is an unwanted product
  let total = 0, worst = 0, worstBin = 0;
  for (let k = 12; k < p.length; k++) if (!keep(k)) { total += p[k]!; if (p[k]! > worst) { worst = p[k]!; worstBin = k; } }
  return { totalDbc: round(10 * Math.log10(Math.max(1e-30, total / ref)), 1), worstDbc: round(10 * Math.log10(Math.max(1e-30, worst / ref)), 1), worstHz: round(binHz(worstBin), 0) };
}
/**
 * Aliasing probe: one sine near 4.19 kHz at -3 dBFS. Its true harmonics below Nyquist are expected; every other
 * line is a harmonic that folded back from above Nyquist. Reported relative to the fundamental (dBc).
 */
export function aliasingProbe(process: (x: Stereo) => Stereo) {
  const k0 = 6221, len = SR * 2, s = sine(k0, dbAmp(-3), len), y = process([s, s.slice()])[0];
  const p = powerSpectrum(y, len - N - 2048, N); let ref = 0; for (let d = -6; d <= 6; d++) ref += p[k0 + d]!;
  const harmonic = (k: number) => { const r = k % k0, d = Math.min(r, k0 - r); return d <= 6 && Math.round(k / k0) >= 1; };
  return { toneHz: round(binHz(k0), 1), ...spurScan(p, harmonic, ref) };
}
/**
 * Intermodulation probe: 55 Hz at -6 dBFS (a sub) plus 3 kHz at -15 dBFS (a mid). A processor that treats the sum
 * as one signal stamps the sub's rhythm onto the mid: sidebands at 3000 +/- n x 55 Hz. Reported as the total
 * sideband power within 600 Hz of the 3 kHz tone, relative to that tone (dBc).
 */
export function intermodProbe(process: (x: Stereo) => Stereo) {
  const kLow = 82, kMid = 4458, len = SR * 2, a = sine(kLow, dbAmp(-6), len), b = sine(kMid, dbAmp(-15), len), s = a.map((v, i) => v + b[i]!);
  const y = process([s, s.slice()])[0], p = powerSpectrum(y, len - N - 2048, N);
  let ref = 0; for (let d = -6; d <= 6; d++) ref += p[kMid + d]!;
  let side = 0; const span = Math.round(600 * N / SR);
  for (let k = kMid - span; k <= kMid + span; k++) if (Math.abs(k - kMid) > 6) side += p[k]!;
  return { lowHz: round(binHz(kLow), 1), midHz: round(binHz(kMid), 1), sidebandsDbc: round(10 * Math.log10(Math.max(1e-30, side / ref)), 1) };
}
