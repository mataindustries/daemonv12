// MORPH//03 throat: the MORPH//02 Kelly-Lochbaum vocal tract (44 oral + 28 nasal sections,
// calibrated vowels, consonant constrictions, variable size) driven by an EXTERNAL source.
// Feeding it a bowed cable makes the cable growl through a mouth: every wobble is an
// articulation (lips, tongue, closures), not a filter LFO.
import { SR, TAU, clamp, smooth, rng, bipolar, Biquad } from './dsp.mjs';

export const N = 44;
const NOSE = 28, VELUM = 17, BASE_RATE = 2 * SR;

export function tractShape({ tongueIndex = 20, tongueDiam = 1.5, lipDiam = 1.5, tipIndex = 36, tipDiam = 3 }) {
  const d = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    let v = i < 7 ? 0.6 + 0.13 * i : 1.5;
    if (i >= 7 && i < 12) v = 1.5 + 0.1 * Math.sin((i - 7) / 5 * Math.PI);
    const u = (i - tongueIndex) / 9;
    if (i >= 7 && i < N - 3 && Math.abs(u) < 1) v = Math.min(v, v - (v - tongueDiam) * Math.cos(u * Math.PI / 2) ** 2);
    const w = (i - tipIndex) / 2.2;
    if (Math.abs(w) < 1) v = Math.min(v, v - (v - tipDiam) * Math.cos(w * Math.PI / 2) ** 2);
    if (i >= N - 3) v = lipDiam + (i === N - 3 ? (v - lipDiam) * 0.4 : 0);
    d[i] = Math.max(0, v);
  }
  return d;
}

export class Tract {
  constructor() {
    this.R = new Float64Array(N); this.L = new Float64Array(N);
    this.nR = new Float64Array(NOSE); this.nL = new Float64Array(NOSE);
    this.A = new Float64Array(N).fill(2.25); this.nA = new Float64Array(NOSE);
    for (let i = 0; i < NOSE; i++) { const d = i < 6 ? 0.4 + 0.12 * i : 1.0 - 0.012 * (i - 6); this.nA[i] = d * d; }
    this.velum = 0; this.lipLp = 0; this.glottalRefl = 0.75; this.lipRefl = -0.85; this.loss = 0.9993;
    this.newR = new Float64Array(N); this.newL = new Float64Array(N);
    this.newNR = new Float64Array(NOSE); this.newNL = new Float64Array(NOSE);
  }
  setDiameters(d) { for (let i = 0; i < N; i++) this.A[i] = Math.max(1e-5, d[i] * d[i]); }
  step(glottal, noiseIndex = -1, noiseValue = 0) {
    const { R, L, A, newR, newL, nR, nL, nA, newNR, newNL } = this;
    newR[0] = this.glottalRefl * L[0] + glottal;
    this.lipLp += 0.5 * (R[N - 1] - this.lipLp);
    newL[N - 1] = this.lipRefl * this.lipLp;
    for (let i = 1; i < N; i++) {
      if (i === VELUM && this.velum > 1e-4) {
        const a1 = A[i - 1], a2 = A[i], a3 = this.velum;
        const pj = 2 * (a1 * R[i - 1] + a2 * L[i] + a3 * nL[0]) / (a1 + a2 + a3);
        newR[i] = pj - L[i]; newL[i - 1] = pj - R[i - 1]; newNR[0] = pj - nL[0];
      } else {
        const pj = 2 * (A[i - 1] * R[i - 1] + A[i] * L[i]) / (A[i - 1] + A[i]);
        newR[i] = pj - L[i]; newL[i - 1] = pj - R[i - 1];
      }
    }
    if (noiseIndex > 0 && noiseIndex < N - 1) { newR[noiseIndex] += noiseValue; newL[noiseIndex - 1] += noiseValue; }
    const loss = this.loss;
    for (let i = 0; i < N; i++) { R[i] = newR[i] * loss; L[i] = newL[i] * loss; }
    let nose = 0;
    if (this.velum > 1e-4) {
      newNL[NOSE - 1] = -0.85 * nR[NOSE - 1];
      for (let i = 1; i < NOSE; i++) {
        const pj = 2 * (nA[i - 1] * nR[i - 1] + nA[i] * nL[i]) / (nA[i - 1] + nA[i]);
        newNR[i] = pj - nL[i]; newNL[i - 1] = pj - nR[i - 1];
      }
      for (let i = 0; i < NOSE; i++) { nR[i] = newNR[i] * 0.999; nL[i] = newNL[i] * 0.999; }
      nose = nR[NOSE - 1] * nA[NOSE - 1];
    } else { nR.fill(0); nL.fill(0); }
    return R[N - 1] * A[N - 1] / 2.25 + nose;
  }
}

// Calibrated in MORPH//02 (calibrate-voice.mjs): vowels F1/F2 within ~10 % of targets.
export const PHONEMES = {
  ee: { tongueIndex: 29, tongueDiam: 0.35, lipDiam: 1.0 },
  ih: { tongueIndex: 27, tongueDiam: 0.55, lipDiam: 1.5 },
  eh: { tongueIndex: 28, tongueDiam: 1.2, lipDiam: 1.5 },
  ah: { tongueIndex: 10, tongueDiam: 0.45, lipDiam: 2.1 },
  uh: { tongueIndex: 11, tongueDiam: 0.55, lipDiam: 1.5 },
  oh: { tongueIndex: 15, tongueDiam: 0.45, lipDiam: 0.5 },
  oo: { tongueIndex: 25, tongueDiam: 0.35, lipDiam: 0.5 },
  ww: { tongueIndex: 24, tongueDiam: 0.4, lipDiam: 0.18 },      // tightly rounded lips: the "w" of a wob
  mm: { tongueIndex: 18, tongueDiam: 1.2, lipDiam: 0, velum: 0.6 },
  nn: { tongueIndex: 25, tongueDiam: 1.0, lipDiam: 1.3, tipIndex: 36, tipDiam: 0, velum: 0.6 },
  ng: { tongueIndex: 19, tongueDiam: 0, lipDiam: 1.4, velum: 0.6 },   // back closure, nasal: "-ng"
  kk: { tongueIndex: 19, tongueDiam: 0, lipDiam: 1.4 },               // velar closure: a choke
  hh: { aspiration: 1, voicing: 0 },
};

/** Articulator targets over time from [{t, ph, glide}] (glide = seconds to reach the target). */
export function articulation(seq) {
  const full = seq.map(({ t, ph, glide = 0.04, ...over }) => ({
    t, glide, ph, p: { tongueIndex: 20, tongueDiam: 1.5, lipDiam: 1.5, tipIndex: 36, tipDiam: 3, velum: 0, aspiration: 0, voicing: 1, ...PHONEMES[ph], ...over },
  })).sort((a, b) => a.t - b.t);
  for (let k = 0; k < full.length; k++) if (full[k].ph === 'hh' && full[k + 1]) {
    const nx = full[k + 1].p; Object.assign(full[k].p, { tongueIndex: nx.tongueIndex, tongueDiam: nx.tongueDiam, lipDiam: nx.lipDiam });
  }
  const keys = Object.keys(full[0].p);
  return t => {
    let cur = full[0].p;
    for (let k = 1; k < full.length; k++) {
      const { t: tk, glide, p } = full[k];
      if (t < tk) break;
      const u = smooth((t - tk) / glide);
      if (u >= 1) { cur = p; continue; }
      const mix = {};
      for (const key of keys) mix[key] = cur[key] + (p[key] - cur[key]) * u;
      cur = mix;
    }
    return cur;
  };
}

/**
 * Pass an external source (Float64Array at SR) through the tract.
 * art(t) -> articulator targets; size(t) scales the tract (formants); metal(t) makes walls ring.
 */
export function throat(src, { art, size = () => 1, metal = () => 0.3, breath = 0.6, seed = 1 }) {
  const n = src.length, out = new Float64Array(n), tract = new Tract(), noise = bipolar(rng(seed));
  const aaf1 = new Biquad('lp', 1000, 0.5412), aaf2 = new Biquad('lp', 1000, 1.3065), aspHp = new Biquad('hp', 500, 0.7), aspLp = new Biquad('lp', 5000, 0.7);
  const hist = new Float64Array(8);
  let a = art(0), rate = BASE_RATE, stepClock = 0, produced = 0, tractTime = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    if ((i & 31) === 0) {
      a = art(t);
      tract.setDiameters(tractShape(a));
      tract.velum = a.velum * a.velum;
      const m = metal(t);
      tract.loss = 0.9993 + 0.0006 * m; tract.glottalRefl = 0.75 + 0.2 * m; tract.lipRefl = -0.85 - 0.1 * m;
      rate = BASE_RATE * size(t);
      const fc = Math.min(0.45 * SR, 0.45 * rate) / rate;
      aaf1.set('lp', fc * SR, 0.5412); aaf2.set('lp', fc * SR, 1.3065);
      aspHp.set('hp', 500 * SR / rate, 0.7); aspLp.set('lp', 5000 * SR / rate, 0.7);
    }
    stepClock += rate / SR;
    while (produced < stepClock) {
      // source value at this tract step's time (linear interpolation)
      const p = tractTime * SR, j = Math.floor(p), f = p - j;
      const s = (src[j] ?? 0) * (1 - f) + (src[j + 1] ?? 0) * f;
      const asp = aspLp.tick(aspHp.tick(noise())) * a.aspiration * breath;
      const v = aaf2.tick(aaf1.tick(tract.step(s * a.voicing + asp)));
      hist.copyWithin(0, 1); hist[7] = v; produced++; tractTime += 1 / rate;
    }
    const frac = 1 - (produced - stepClock);
    const y0 = hist[4], y1 = hist[5], y2 = hist[6], y3 = hist[7];
    const c1 = 0.5 * (y2 - y0), c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3, c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
    out[i] = ((c3 * frac + c2) * frac + c1) * frac + y1;
  }
  return out;
}

/**
 * Wobble writer: a rhythmic sequence of mouth shapes. Each cell opens from `from` to `to`
 * in `open` of its length and closes back over the rest (or holds), so cells can be
 * asymmetric ("wa"), symmetric ("wom"), or two-stage ("yoi" = from -> to -> back).
 */
export function wobbles(cells) {
  const seq = [];
  for (const { t, len, from, to, back = from, open = 0.3, close = 0.6, end } of cells) {
    seq.push({ t, ph: from, glide: Math.min(0.012, len * 0.1) });
    seq.push({ t: t + len * 0.08, ph: to, glide: len * open });
    seq.push({ t: t + len * (0.1 + open), ph: back, glide: len * close });
    if (end) seq.push({ t: t + len * 0.92, ph: end, glide: len * 0.06 });
  }
  return seq;
}
