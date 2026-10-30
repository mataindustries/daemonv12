// Objective evidence for the hybrid auditions (no listening implied). Pure functions over
// decoded PCM: masking between parts, temporal overlap, master compressor activity, bar variety
// and pitch probes. Used by render-ac.mjs on both hybrids and on the original SOCK SLIDE.
import { pitchHz } from '../../tools/inspect-palette.mjs';

export const SR = 44100;
const db = (x) => (x > 0 ? 10 * Math.log10(x) : -Infinity);
const r = (x, d = 2) => (Number.isFinite(x) ? Number(x.toFixed(d)) : null);
export const toMono = (ch) => (ch.length === 1 ? ch[0] : ch[0].map((v, i) => (v + ch[1][i]) / 2));

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
        const ur = re[i + k], ui = im[i + k], j = i + k + len / 2;
        const vr = re[j] * cr - im[j] * ci, vi = re[j] * ci + im[j] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[j] = ur - vr; im[j] = ui - vi;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

// Third-octave bands, 100 Hz - 12.5 kHz.
export const THIRDS = Array.from({ length: 22 }, (_, k) => 100 * 2 ** (k / 3));
const N = 2048, HOP = 1024;
// Band energies per frame: E[frame][band].
export function bandFrames(x) {
  const frames = [], win = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
  const edges = THIRDS.map((c) => [c * 2 ** (-1 / 6), c * 2 ** (1 / 6)]);
  for (let s = 0; s + N <= x.length; s += HOP) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = x[s + i] * win[i];
    fft(re, im);
    const e = new Float64Array(THIRDS.length);
    for (let k = 1; k < N / 2; k++) {
      const hz = k * SR / N;
      for (let b = 0; b < edges.length; b++) if (hz >= edges[b][0] && hz < edges[b][1]) { e[b] += re[k] ** 2 + im[k] ** 2; break; }
    }
    frames.push(e);
  }
  return frames;
}
const sumFrames = (list) => list[0].map((_, f) => list[0][f].map((_, b) => list.reduce((s, x) => s + x[f][b], 0)));
const total = (e) => e.reduce((a, b) => a + b, 0);

// A part is "active" in a frame when it is within 30 dB of its own loudest frame.
function activeMask(frames, rangeDb = 30) {
  const t = frames.map(total), max = Math.max(...t);
  return t.map((v) => v > 0 && db(v) > db(max) - rangeDb);
}

// Masking evidence for a lead part L against everything else R, per frame and third-octave band:
// - unmaskedShare: share of L's energy (in frames where L is active) in bands where L is louder than R.
// - Its complement is the share of the lead's energy that the rest of the mix out-powers.
export function maskingReport(stemFrames, leadIds) {
  const ids = Object.keys(stemFrames).filter((id) => leadIds.includes(id));
  if (!ids.length) return null;
  const L = sumFrames(ids.map((id) => stemFrames[id]));
  const R = sumFrames(Object.keys(stemFrames).filter((id) => !leadIds.includes(id)).map((id) => stemFrames[id]));
  const act = activeMask(L);
  let all = 0, un = 0;
  L.forEach((e, f) => { if (!act[f]) return; e.forEach((v, b) => { all += v; if (v > R[f][b]) un += v; }); });
  return { parts: ids, activeSeconds: r(act.filter(Boolean).length * HOP / SR), unmaskedShare: r(un / all, 3) };
}

// Whistle vs appliance voices: how often both sound at once, and when they do, how much of the
// whistle's energy sits in bands where the voices come within 6 dB of it ("contested").
export function conflictReport(stemFrames, a, b) {
  const A = sumFrames(a.filter((id) => stemFrames[id]).map((id) => stemFrames[id]));
  const bIds = b.filter((id) => stemFrames[id]);
  if (!bIds.length) return null;
  const B = sumFrames(bIds.map((id) => stemFrames[id]));
  const actA = activeMask(A, 25), actB = activeMask(B, 25);
  let both = 0, onlyA = 0, onlyB = 0, eA = 0, contested = 0;
  A.forEach((e, f) => {
    if (actA[f] && actB[f]) {
      both++;
      e.forEach((v, k) => { eA += v; if (B[f][k] > v / 4) contested += v; });
    } else if (actA[f]) onlyA++; else if (actB[f]) onlyB++;
  });
  const sec = (n) => r(n * HOP / SR);
  return { a, b: bIds, aOnlySeconds: sec(onlyA), bOnlySeconds: sec(onlyB), simultaneousSeconds: sec(both),
    simultaneousShareOfB: r(both / (both + onlyB || 1), 3), contestedShareOfAWhenSimultaneous: both ? r(contested / eA, 3) : 0 };
}

// Spectral centroid (Hz) of a part over its active frames: where in the spectrum it lives.
export function centroid(frames) {
  const act = activeMask(frames);
  let num = 0, den = 0;
  frames.forEach((e, f) => { if (act[f]) e.forEach((v, b) => { num += v * THIRDS[b]; den += v; }); });
  return den ? Math.round(num / den) : null;
}

// Second-order Butterworth sections (RBJ) for band-limiting analysis signals.
function biquad(x, type, f0) {
  const w = 2 * Math.PI * f0 / SR, c = Math.cos(w), al = Math.sin(w) / Math.SQRT2;
  const [b0, b1, b2] = type === 'lp' ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : [(1 + c) / 2, -(1 + c), (1 + c) / 2];
  const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al, y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
const band = (x) => biquad(biquad(x, 'hp', 300), 'lp', 5000);
// Fourth-order high-pass at 300 Hz: the musical layers without bass and kick (stereo width check).
export const above300 = (x) => biquad(biquad(x, 'hp', 300), 'hp', 300);

// Master compressor activity: the master versus the sum of its pre-master stems at the master
// gain, in 50 ms windows, band-limited to 300 Hz-5 kHz so the master high-pass does not count.
// Pumping shows up as gain reduction that swings a lot from window to window.
export function compressorActivity(master, stems, gainDb, makeupDb) {
  const g = 10 ** (gainDb / 20), sum = new Float64Array(master.length);
  for (const s of stems) for (let i = 0; i < sum.length; i++) sum[i] += s[i] * g;
  const m = band(master), p = band(sum), w = Math.round(0.05 * SR), gr = [];
  for (let s = 0; s + w <= m.length; s += w) {
    let em = 0, ep = 0;
    for (let i = s; i < s + w; i++) { em += m[i] ** 2; ep += p[i] ** 2; }
    if (db(ep / w) > -50) gr.push(makeupDb - db(em / ep));
  }
  gr.sort((a, b) => a - b);
  const q = (k) => gr[Math.min(gr.length - 1, Math.floor(k * gr.length))];
  const mean = gr.reduce((a, b) => a + b, 0) / gr.length;
  const sd = Math.sqrt(gr.reduce((a, b) => a + (b - mean) ** 2, 0) / gr.length);
  return { method: 'master vs sum of pre-master stems x master gain, 300 Hz-5 kHz, 50 ms windows; makeup gain removed',
    windows: gr.length, gainReductionDb: { median: r(q(0.5)), p95: r(q(0.95)), max: r(gr[gr.length - 1]), mean: r(mean), stdDev: r(sd) } };
}

// Bar variety: each bar becomes a (16 steps x 5 bands) log-energy fingerprint of the master;
// two bars "repeat" when their fingerprints correlate above 0.97.
export function barVariety(x, bars, barFrames, stepStarts) {
  const edges = [[20, 120], [120, 500], [500, 2000], [2000, 6000], [6000, 20000]];
  const prints = [];
  for (let b = 0; b < bars; b++) {
    const v = [];
    for (let s = 0; s < 16; s++) {
      const from = Math.round(b * barFrames + stepStarts[s]), len = 2048;
      const re = new Float64Array(len), im = new Float64Array(len);
      for (let i = 0; i < len && from + i < x.length; i++) re[i] = x[from + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / len));
      fft(re, im);
      const e = edges.map(() => 1e-12);
      for (let k = 1; k < len / 2; k++) { const hz = k * SR / len; edges.forEach(([lo, hi], j) => { if (hz >= lo && hz < hi) e[j] += re[k] ** 2 + im[k] ** 2; }); }
      v.push(...e.map((q) => db(q)));
    }
    prints.push(v);
  }
  const corr = (a, b) => {
    const ma = a.reduce((s, q) => s + q, 0) / a.length, mb = b.reduce((s, q) => s + q, 0) / b.length;
    let n = 0, da = 0, dbb = 0;
    for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; dbb += (b[i] - mb) ** 2; }
    return n / Math.sqrt(da * dbb);
  };
  const matrix = prints.map((a) => prints.map((b) => r(corr(a, b), 3)));
  const repeats = prints.map((_, i) => prints.slice(0, i).some((_, j) => matrix[i][j] > 0.97));
  const off = matrix.flatMap((row, i) => row.filter((_, j) => j > i));
  return { bars, distinctBars: repeats.filter((q) => !q).length, meanPairCorrelation: r(off.reduce((a, b) => a + b, 0) / off.length, 3), matrix };
}

// Pitch probes on a stem: measured Hz and cents from a reference at given times.
export function probe(x, at, { lo, hi, ref, win = 0.04 }) {
  const p = pitchHz(x, Math.round(at * SR), Math.round(win * SR), lo, hi);
  return p ? { seconds: r(at, 4), hz: r(p.hz), cents: Math.round(1200 * Math.log2(p.hz / ref)), clarity: p.clarity } : { seconds: r(at, 4), hz: null };
}

// Goertzel level (dB) of one frequency over a window: used to follow chord tones through a sag.
export function toneDb(x, at, hz, len = 0.12) {
  const n = Math.round(len * SR), from = Math.round(at * SR), k = 2 * Math.cos(2 * Math.PI * hz / SR);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < n; i++) { const s0 = x[from + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / n)) + k * s1 - s2; s2 = s1; s1 = s0; }
  return r(db((s1 * s1 + s2 * s2 - k * s1 * s2) / n ** 2), 1);
}
