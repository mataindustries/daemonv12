/** SAMPLE LAB 02: the announcer of the fictional station. A small Klatt-style cascade formant synthesizer: a band-limited
 * KLGLOTT88 glottal source with jitter and shimmer, pulsed aspiration, a nasal pole-zero pair, five formant resonators
 * and a parallel frication branch. It speaks in a near-monotone, like an automated numbers-station voice, so that its
 * syllables can later be tuned exactly by playback rate. Original synthesis only (no recorded or third-party speech). */
import { RATE, TAU, frames, gaussian, wander, resonator, antiResonator, onePoleHigh, onePoleLow, rng, mix, type Wave } from './dsp.ts';

interface Target { f: number[]; b: number[]; av: number; ah: number; af: number; fc: number; fb: number; nz: number }
const NASAL_POLE = 270;
const V = (f1: number, f2: number, f3: number, b1 = 70, b2 = 100, b3 = 150): Target =>
  ({ f: [f1, f2, f3, 3900, 4700], b: [b1, b2, b3, 250, 320], av: 1, ah: 0.035, af: 0, fc: 4000, fb: 2000, nz: NASAL_POLE });
/** Female targets (Hz). Nasals open the zero away from the pole; fricatives open the parallel noise branch. */
export const PHONES: Record<string, Target> = {
  E: V(640, 2050, 2900),                       // ɛ in "echo"
  o: V(560, 980, 2750),                        // onset of oʊ
  u: V(420, 860, 2650, 70, 90, 150),           // offset of oʊ, lips rounding
  a: V(860, 1450, 2850, 90, 110, 160),         // onset of aɪ
  I: V(440, 2350, 3050),                       // offset of aɪ
  R: V(500, 1520, 1880, 80, 110, 120),         // ɚ, r-coloured (low F3)
  n: { f: [280, 1650, 2700, 3900, 4700], b: [90, 260, 350, 300, 350], av: 0.5, ah: 0, af: 0, fc: 4000, fb: 2000, nz: 1450 },
  v: { f: [330, 1250, 2500, 3900, 4700], b: [90, 160, 250, 300, 350], av: 0.42, ah: 0.02, af: 0.16, fc: 4200, fb: 3000, nz: NASAL_POLE },
  kc: { f: [330, 1750, 2550, 3900, 4700], b: [120, 160, 200, 300, 350], av: 0, ah: 0, af: 0, fc: 1900, fb: 900, nz: NASAL_POLE }, // velar closure
  kh: { f: [560, 1300, 2600, 3900, 4700], b: [200, 160, 200, 300, 350], av: 0, ah: 0.55, af: 0.06, fc: 1900, fb: 900, nz: NASAL_POLE }, // aspiration into "o"
  _: { f: [500, 1500, 2700, 3900, 4700], b: [100, 120, 160, 300, 350], av: 0, ah: 0, af: 0, fc: 4000, fb: 2000, nz: NASAL_POLE },
};

export interface Segment {
  ph: string | [string, string];   // a phone, or [start, end] for a diphthong glide
  dur: number;                     // seconds
  tr?: number;                     // transition into this segment, seconds (centred on the boundary)
  amp?: number;                    // stress
  f0?: number;                     // pitch multiplier at the end of the segment (falls, lifts); default 1
  burst?: { center: number; q: number; ms: number; gain: number }; // plosive release at segment start
}
const ECHO: Segment[] = [
  { ph: 'E', dur: 0.15, tr: 0.03, amp: 1 },
  { ph: 'kc', dur: 0.065, tr: 0.018 },
  { ph: 'kh', dur: 0.045, tr: 0.004, burst: { center: 1850, q: 1.6, ms: 9, gain: 0.9 } },
  { ph: ['o', 'u'], dur: 0.3, tr: 0.03, amp: 0.95 },
];
const NINER: Segment[] = [
  { ph: 'n', dur: 0.075, tr: 0.03, amp: 0.9 },
  { ph: ['a', 'I'], dur: 0.24, tr: 0.035, amp: 1 },
  { ph: 'n', dur: 0.065, tr: 0.03, amp: 0.85 },
  { ph: 'R', dur: 0.21, tr: 0.04, amp: 0.85, f0: 0.95 },
];
const OVER: Segment[] = [
  { ph: ['o', 'u'], dur: 0.2, tr: 0.03, amp: 1 },
  { ph: 'v', dur: 0.075, tr: 0.03, amp: 0.8 },
  { ph: 'R', dur: 0.24, tr: 0.04, amp: 0.85, f0: 0.94 },
];
export const WORDS: Record<string, Segment[]> = { ECHO, NINER, OVER };

/** Fourier series of one KLGLOTT88 glottal-flow-derivative period (open quotient `oq`), so the source can be built
 * from harmonics below Nyquist: band-limited by construction, with the pulse's asymmetric phase intact. */
function glottalSeries(oq: number, harmonics: number) {
  const N = 8192, wave = new Float64Array(N);
  for (let i = 0; i < N; i++) { const t = i / N; wave[i] = t < oq ? 2 * t - 3 * t * t / oq : 0; }
  const re = new Float64Array(harmonics + 1), im = new Float64Array(harmonics + 1);
  for (let k = 1; k <= harmonics; k++) {
    let a = 0, b = 0;
    for (let i = 0; i < N; i++) { const p = TAU * k * i / N; a += wave[i]! * Math.cos(p); b -= wave[i]! * Math.sin(p); }
    re[k] = 2 * a / N; im[k] = 2 * b / N;
  }
  return { re, im };
}

export interface Placed { word: string; at: number; amp?: number }
export type WordTiming = { word: string; segments: { ph: string; start: number; end: number }[] };
/** Where every segment of every placed word falls, without synthesizing audio (the chop map of a recording). */
export function wordTimes(placed: Placed[]): WordTiming[] {
  return placed.map(w => {
    let t = w.at;
    return { word: w.word, segments: WORDS[w.word]!.map(s => { const r = { ph: Array.isArray(s.ph) ? s.ph.join('>') : s.ph, start: t, end: t + s.dur }; t += s.dur; return r; }) };
  });
}
/** Speak words at absolute times into a buffer of `seconds`; returns the dry voice and each word's segment times. */
export function speak(placed: Placed[], seconds: number, opts: { f0: number; seed: number; oq?: number }) {
  const n = frames(seconds), rand = rng(opts.seed), g = gaussian(rand), oq = opts.oq ?? 0.62;
  const keys: { t: number; p: Target; f0: number }[] = [], bursts: { at: number; center: number; q: number; ms: number; gain: number }[] = [];
  const blend = (a: Target, b: Target, w: number): Target => ({
    f: a.f.map((v, i) => v + (b.f[i]! - v) * w), b: a.b.map((v, i) => v + (b.b[i]! - v) * w),
    av: a.av + (b.av - a.av) * w, ah: a.ah + (b.ah - a.ah) * w, af: a.af + (b.af - a.af) * w, fc: a.fc + (b.fc - a.fc) * w, fb: a.fb + (b.fb - a.fb) * w, nz: a.nz + (b.nz - a.nz) * w,
  });
  const scaled = (p: Target, amp: number): Target => ({ ...p, av: p.av * amp, ah: p.ah * amp, af: p.af * amp });
  keys.push({ t: 0, p: PHONES._!, f0: 1 });
  for (const w of placed) {
    let t = w.at;
    const segs = WORDS[w.word]!;
    keys.push({ t: Math.max(0, t - 0.004), p: PHONES._!, f0: 1 }); // silence holds until the word begins
    segs.forEach((s, i) => {
      const [a, b] = Array.isArray(s.ph) ? s.ph : [s.ph, s.ph];
      const amp = (s.amp ?? 1) * (w.amp ?? 1), trIn = (s.tr ?? 0.03) / 2, trOut = ((segs[i + 1]?.tr) ?? 0.04) / 2;
      const prevF0 = i ? (segs[i - 1]!.f0 ?? 1) : 1;
      keys.push({ t: t + trIn, p: scaled(PHONES[a]!, amp), f0: prevF0 });
      keys.push({ t: t + s.dur - trOut, p: scaled(PHONES[b]!, amp), f0: s.f0 ?? 1 });
      if (s.burst) bursts.push({ at: t, ...s.burst, gain: s.burst.gain * (w.amp ?? 1) });
      t += s.dur;
    });
    keys.push({ t: t + 0.03, p: PHONES._!, f0: 0.94 });
  }
  keys.push({ t: seconds, p: PHONES._!, f0: 1 });
  keys.sort((x, y) => x.t - y.t);

  // Per-sample parameter tracks by linear interpolation between key frames.
  const P = Array.from({ length: 16 }, () => new Float64Array(n)), F0 = new Float64Array(n);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    while (k + 1 < keys.length - 1 && keys[k + 1]!.t <= t) k++;
    const A = keys[k]!, B = keys[Math.min(k + 1, keys.length - 1)]!, w = B.t > A.t ? Math.min(1, Math.max(0, (t - A.t) / (B.t - A.t))) : 1;
    const p = blend(A.p, B.p, w);
    for (let j = 0; j < 5; j++) { P[j]![i] = p.f[j]!; P[5 + j]![i] = p.b[j]!; }
    P[10]![i] = p.av; P[11]![i] = p.ah; P[12]![i] = p.af; P[13]![i] = p.fc; P[14]![i] = p.fb; P[15]![i] = p.nz;
    F0[i] = A.f0 + (B.f0 - A.f0) * w;
  }

  // Source: band-limited glottal pulses at f0 with slow jitter and shimmer, and aspiration pulsed by the glottal cycle.
  const H = Math.floor(0.45 * RATE / (opts.f0 * 0.85)), series = glottalSeries(oq, H);
  const jitter = wander(n, 0.045, rand), shimmer = wander(n, 0.06, rand), drift = wander(n, 0.7, rand);
  const source = new Float64Array(n), asp = new Float64Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const f = opts.f0 * F0[i]! * (1 + 0.0045 * jitter[i]! + 0.004 * drift[i]!), K = Math.min(H, Math.floor(0.45 * RATE / f));
    phase += TAU * f / RATE; if (phase >= TAU) phase -= TAU;
    const c1 = Math.cos(phase), s1 = Math.sin(phase);
    let ck = c1, sk = s1, cPrev = 1, sPrev = 0, v = 0;
    for (let h = 1; h <= K; h++) {
      v += series.re[h]! * ck - series.im[h]! * sk;
      const cn = 2 * c1 * ck - cPrev, sn = 2 * c1 * sk - sPrev; cPrev = ck; sPrev = sk; ck = cn; sk = sn;
    }
    source[i] = v * (1 + 0.05 * shimmer[i]!) * P[10]![i]!;
    const open = (phase / TAU) < oq ? 1 : 0.35;
    asp[i] = g() * 0.5 * open * P[11]![i]!;
  }
  const tilted = onePoleLow(source, 4200), breath = onePoleLow(asp, 6000);
  const input = new Float64Array(n);
  for (let i = 0; i < n; i++) input[i] = 4 * tilted[i]! + breath[i]!;
  // Cascade: nasal pole-zero pair, then F1..F5.
  let y = resonator(input, () => NASAL_POLE, () => 100);
  y = antiResonator(y, i => P[15]![i]!, () => 100);
  for (let j = 0; j < 5; j++) { const fj = P[j]!, bj = P[5 + j]!; y = resonator(y, i => fj[i]!, i => bj[i]!); }
  // Frication: noise through a broad resonance, high-passed so it adds only hiss.
  const fricIn = new Float64Array(n);
  for (let i = 0; i < n; i++) fricIn[i] = g() * P[12]![i]!;
  const fric = onePoleHigh(resonator(fricIn, i => P[13]![i]!, i => P[14]![i]!), 900);
  // Plosive bursts: short shaped noise transients at the release.
  const burst = new Float64Array(n);
  for (const b of bursts) {
    const len = frames(b.ms / 1000), x = new Float64Array(len);
    for (let i = 0; i < len; i++) x[i] = g() * Math.exp(-i / (len / 3)) * Math.min(1, i / 22);
    mix(burst, onePoleHigh(resonator(x, () => b.center, () => b.center / b.q), 500), frames(b.at), b.gain * 0.2);
  }
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = y[i]! + 0.35 * fric[i]! + burst[i]!;
  return { voice: onePoleHigh(out, 70), times: wordTimes(placed) };
}
