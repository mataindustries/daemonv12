/** MORPH//08 master bus: loop-steady DC removal, one soft-knee ceiling and a pre-gain solved
 * so every candidate reaches the same integrated loudness. Measurements follow ITU-R
 * BS.1770-4 (K-weighting, 400 ms blocks, 75% overlap, absolute and relative gates) and a
 * 4x windowed-sinc true-peak estimate, wrapped around the loop. No dither, no lookahead.
 */
export const MASTER = { targetLufs: -12, ceilingDbfs: -1.8, kneeDbfs: -7, stemTrimDb: -6 } as const;
const RATE = 44100, CEILING = 10 ** (MASTER.ceilingDbfs / 20), KNEE = 10 ** (MASTER.kneeDbfs / 20);
type Stereo = [Float64Array, Float64Array];

/** Linear below the knee; above it a tanh shoulder that approaches the ceiling with slope 1 at the knee. */
export function softClip(x: number): number {
  const a = Math.abs(x);
  return a <= KNEE ? x : Math.sign(x) * (KNEE + (CEILING - KNEE) * Math.tanh((a - KNEE) / (CEILING - KNEE)));
}

/** One-pole DC blocker (pole 0.99972, as in the MORPH//07 master), run twice so the
 * loop's seam starts from its own steady state. */
function dcBlock(x: Float64Array): Float64Array {
  const out = new Float64Array(x.length);
  let x1 = 0, y1 = 0;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < x.length; i++) { const y = x[i]! - x1 + 0.99972 * y1; x1 = x[i]!; y1 = y; out[i] = y; }
  return out;
}

function biquad(x: Float64Array, b: number[], a: number[]): Float64Array {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b[0]! * x[i]! + b[1]! * x1 + b[2]! * x2 - a[0]! * y1 - a[1]! * y2;
    x2 = x1; x1 = x[i]!; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
// BS.1770 K-weighting at 44.1 kHz from the analog prototype (as libebur128 derives it).
function kWeight(x: Float64Array): Float64Array {
  let K = Math.tan(Math.PI * 1681.974450955533 / RATE), Q = 0.7071752369554196;
  const Vh = 10 ** (3.999843853973347 / 20), Vb = Vh ** 0.4996667741545416, a0 = 1 + K / Q + K * K;
  const shelf = biquad(x, [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0], [2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]);
  K = Math.tan(Math.PI * 38.13547087602444 / RATE); Q = 0.5003270373238773;
  const d = 1 + K / Q + K * K;
  return biquad(shelf, [1, -2, 1], [2 * (K * K - 1) / d, (1 - K / Q + K * K) / d]);
}
/** Integrated loudness in LUFS of a stereo signal. */
export function integratedLoudness(left: Float64Array, right: Float64Array): number {
  const [l, r] = [kWeight(left), kWeight(right)], block = 0.4 * RATE, hop = 0.1 * RATE, powers: number[] = [];
  for (let start = 0; start + block <= l.length; start += hop) {
    let s = 0;
    for (let i = start; i < start + block; i++) s += l[i]! * l[i]! + r[i]! * r[i]!;
    powers.push(s / block);
  }
  const lufs = (p: number) => -0.691 + 10 * Math.log10(p), mean = (ps: number[]) => ps.reduce((s, p) => s + p, 0) / ps.length;
  const absolute = powers.filter(p => lufs(p) > -70), relative = lufs(mean(absolute)) - 10;
  return lufs(mean(absolute.filter(p => lufs(p) > relative)));
}

/** Largest magnitude of the 4x band-limited reconstruction (Hann-windowed sinc, 16 taps a
 * side), read circularly because the file is a loop. */
export function truePeak(left: Float64Array, right: Float64Array): number {
  const taps = 16, kernels = [1, 2, 3].map(p => Array.from({ length: 2 * taps }, (_, j) => {
    const t = j - taps + 1 - p / 4, w = 0.5 + 0.5 * Math.cos(Math.PI * t / taps);
    return w * Math.sin(Math.PI * t) / (Math.PI * t);
  }));
  let peak = 0;
  for (const x of [left, right]) {
    const n = x.length;
    for (let i = 0; i < n; i++) {
      peak = Math.max(peak, Math.abs(x[i]!));
      for (const h of kernels) {
        let v = 0;
        for (let j = 0; j < 2 * taps; j++) v += h[j]! * x[(i + j - taps + 1 + n) % n]!;
        peak = Math.max(peak, Math.abs(v));
      }
    }
  }
  return peak;
}

/** Sum the stems, solve the pre-gain that reaches the target loudness through the soft
 * knee, and return the master plus the stems at that gain trimmed by `stemTrimDb`
 * (post-fader, pre-ceiling): softClip(10^(-stemTrimDb/20) · Σ stems) is the master. */
export function master(stems: Record<string, Stereo>, frames: number) {
  const blocked = Object.fromEntries(Object.entries(stems).map(([name, [l, r]]) => [name, [dcBlock(l), dcBlock(r)] as Stereo]));
  const sum: Stereo = [new Float64Array(frames), new Float64Array(frames)];
  for (const [l, r] of Object.values(blocked)) for (let i = 0; i < frames; i++) { sum[0][i]! += l[i]!; sum[1][i]! += r[i]!; }
  const apply = (g: number): Stereo => [sum[0].map(x => softClip(g * x)), sum[1].map(x => softClip(g * x))];
  let lo = -40, hi = 40;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2, [l, r] = apply(10 ** (mid / 20));
    if (integratedLoudness(l, r) < MASTER.targetLufs) lo = mid; else hi = mid;
  }
  const gain = 10 ** (((lo + hi) / 2) / 20), [left, right] = apply(gain);
  let peak = 0, clipped = 0, knee = 0, maxReductionDb = 0;
  for (const [c, ch] of [left, right].entries()) for (let i = 0; i < frames; i++) {
    const x = ch[i]!, raw = Math.abs(gain * sum[c]![i]!);
    peak = Math.max(peak, Math.abs(x));
    if (Math.abs(Math.round(x * 32767)) >= 32767) clipped++;
    if (raw > KNEE) { knee++; maxReductionDb = Math.max(maxReductionDb, 20 * Math.log10(raw / Math.abs(x))); }
  }
  const out: Record<string, Stereo> = {}, stemClipped: Record<string, number> = {};
  const trim = gain * 10 ** (MASTER.stemTrimDb / 20);
  for (const [name, [l, r]] of Object.entries(blocked)) {
    out[name] = [l.map(x => trim * x), r.map(x => trim * x)];
    stemClipped[name] = out[name].reduce((s, ch) => s + ch.filter(x => Math.abs(x) >= 1).length, 0);
  }
  return { left, right, stems: out, gain, peak, clipped, stemClipped, maxReductionDb, kneePercent: 100 * knee / (2 * frames) };
}
