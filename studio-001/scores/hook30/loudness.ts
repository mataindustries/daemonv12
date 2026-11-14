/**
 * An independent loudness meter for the HOOK//30 QA: ITU-R BS.1770-4 integrated loudness (K-weighting, 400 ms blocks
 * with 75 % overlap, absolute gate at -70 LUFS, relative gate at -10 LU) and true peak by 4x oversampling.
 * Pure TypeScript, no FFmpeg: it exists to cross-check the FFmpeg `ebur128` numbers in the manifest, not to replace them.
 */
/** K-weighting biquads for any sample rate (the constants are the analogue prototypes behind the BS.1770 48 kHz tables). */
function kWeighting(fs: number) {
  const f1 = 1681.974450955533, G = 3.999843853973347, Q1 = 0.7071752369554196, K1 = Math.tan(Math.PI * f1 / fs), Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416), a01 = 1 + K1 / Q1 + K1 * K1;
  const shelf = { b: [(Vh + Vb * K1 / Q1 + K1 * K1) / a01, 2 * (K1 * K1 - Vh) / a01, (Vh - Vb * K1 / Q1 + K1 * K1) / a01], a: [2 * (K1 * K1 - 1) / a01, (1 - K1 / Q1 + K1 * K1) / a01] };
  const f2 = 38.13547087602444, Q2 = 0.5003270373238773, K2 = Math.tan(Math.PI * f2 / fs), a02 = 1 + K2 / Q2 + K2 * K2;
  const high = { b: [1, -2, 1], a: [2 * (K2 * K2 - 1) / a02, (1 - K2 / Q2 + K2 * K2) / a02] };
  return [shelf, high];
}
function biquad(x: Float64Array, c: { b: number[]; a: number[] }): Float64Array {
  const y = new Float64Array(x.length), [b0, b1, b2] = c.b as [number, number, number], [a1, a2] = c.a as [number, number];
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = x[i]!, o = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = o; y[i] = o; }
  return y;
}
/** Integrated loudness in LUFS of float channels (left and right both weighted 1.0). */
export function integratedLufs(channels: Float64Array[], fs = 44100): number {
  const [shelf, high] = kWeighting(fs), weighted = channels.map(c => biquad(biquad(c, shelf!), high!));
  const block = Math.round(0.4 * fs), hop = Math.round(0.1 * fs), powers: number[] = [];
  for (let s = 0; s + block <= weighted[0]!.length; s += hop) {
    let z = 0; for (const c of weighted) { let sum = 0; for (let i = s; i < s + block; i++) sum += c[i]! * c[i]!; z += sum / block; }
    powers.push(z);
  }
  const lk = (z: number) => -0.691 + 10 * Math.log10(z), mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  const abs = powers.filter(z => lk(z) > -70); if (!abs.length) return -Infinity;
  const rel = lk(mean(abs)) - 10, kept = abs.filter(z => lk(z) > rel);
  return kept.length ? lk(mean(kept)) : -Infinity;
}
/** True peak in dBTP: the largest absolute value of the signal oversampled 4x with a 49-tap-per-phase windowed sinc. */
export function truePeakDb(channels: Float64Array[]): number {
  const OS = 4, HALF = 24, taps: Float64Array[] = [];
  for (let p = 0; p < OS; p++) {
    const h = new Float64Array(2 * HALF + 1);
    for (let k = -HALF; k <= HALF; k++) { const t = k - p / OS, w = 0.5 + 0.5 * Math.cos(Math.PI * t / (HALF + 1)); h[k + HALF] = (t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t)) * w; }
    taps.push(h);
  }
  let top = 0;
  for (const c of channels) for (let n = 0; n < c.length; n++) for (let p = 0; p < OS; p++) {
    const h = taps[p]!; let v = 0;
    for (let k = -HALF; k <= HALF; k++) { const i = n + k; if (i >= 0 && i < c.length) v += c[i]! * h[k + HALF]!; }
    const a = Math.abs(v); if (a > top) top = a;
  }
  return 20 * Math.log10(top);
}
/** Float channels of a 16-bit stereo PCM WAV with the canonical 44-byte header (what the rack writes). */
export function wavChannels(wav: Buffer): [Float64Array, Float64Array] {
  const pcm = new Int16Array(wav.buffer, wav.byteOffset + 44, (wav.length - 44) / 2), n = pcm.length / 2, l = new Float64Array(n), r = new Float64Array(n);
  for (let i = 0; i < n; i++) { l[i] = pcm[2 * i]! / 32768; r[i] = pcm[2 * i + 1]! / 32768; }
  return [l, r];
}
if (process.argv[1] && process.argv[1].endsWith('loudness.ts')) {
  const { readFileSync } = await import('node:fs');
  for (const f of process.argv.slice(2)) { const ch = wavChannels(readFileSync(f)); console.log(`${f}: ${integratedLufs(ch).toFixed(2)} LUFS, ${truePeakDb(ch).toFixed(2)} dBTP`); }
}
